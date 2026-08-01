import type { Message, Session } from "@/types";
import { chatStream } from "@/providers/openai";
import { loadMessages, updateSession } from "./db";
import { extractCharacters, saveExtractedCharacters, estimateTokens } from "./characterExtract";
import { useProviderStore } from "@/stores/providerStore";
import { useSessionStore } from "@/stores/sessionStore";
import { useUIStore } from "@/stores/uiStore";
import { useWorldStore } from "@/stores/worldStore";

/** 压缩时保留的最近消息条数（原文不摘要） */
export const KEEP_RECENT = 30;
/** 自动触发阈值：消息条数 */
export const AUTO_TRIGGER_COUNT = 60;
/** 自动触发阈值：历史总估算 token */
export const AUTO_TRIGGER_TOKENS = 12000;
/** 压缩超时（毫秒） */
export const COMPRESS_TIMEOUT_MS = 90_000;
/** 「暂不整理」后再次提醒的冷却时间（毫秒） */
export const REMIND_COOLDOWN_MS = 30 * 60 * 1000;
/** 摘要窗口文本总字符上限 */
const SUMMARY_WINDOW_CHARS = 20000;
/** 提取 + 摘要两段 prompt 的固定开销（token 粗估） */
const PROMPT_OVERHEAD_TOKENS = 1600;

export type CompressStage = "extracting" | "summarizing";

export interface CompressContext {
  session: Session;
  messages: Message[];
  playerCharacterName?: string;
  worldBookName?: string;
  worldBookId: string | null;
  provider: { model: string; baseUrl: string; apiKey: string };
  signal?: AbortSignal;
  onStage?: (stage: CompressStage) => void;
}

export interface CompressResult {
  ok: boolean;
  reason?: string;
  charactersSaved: number;
  windowCount: number;
  keptCount: number;
  estimatedTokens: number;
  /** 合并后的完整摘要（写回 DB 后供内存同步） */
  mergedSummary?: string;
  /** 新的压缩点（摘要窗口最后一条消息 id） */
  lastSummarizedMessageId?: string;
}

function isAbort(e: unknown): boolean {
  return e instanceof DOMException && e.name === "AbortError";
}

/** 计算增量压缩窗口：上次摘要点之后 → 最近 KEEP_RECENT 条之前；其余为保留原文 */
export function computeCompressWindow(
  session: Session,
  messages: Message[],
): { window: Message[]; kept: Message[] } {
  const kept = messages.slice(-KEEP_RECENT);
  const cutIdx = session.lastSummarizedMessageId
    ? messages.findIndex((m) => m.id === session.lastSummarizedMessageId)
    : -1;
  const start = cutIdx >= 0 ? cutIdx + 1 : 0;
  const end = Math.max(start, messages.length - KEEP_RECENT);
  const window = messages.slice(start, end);
  return { window, kept };
}

/** 估算历史总 token（自动触发判断用） */
export function estimateHistoryTokens(messages: Message[]): number {
  return messages.reduce((t, m) => t + estimateTokens(m.content || ""), 0);
}

/** 估算一次压缩的 token 消耗（输入 + 输出） */
export function estimateCompressTokens(session: Session, messages: Message[]): number {
  const { window } = computeCompressWindow(session, messages);
  const input = window.reduce((t, m) => t + estimateTokens(m.content || ""), 0) + PROMPT_OVERHEAD_TOKENS;
  return input + 1000;
}

function buildSummaryWindowText(window: Message[]): string {
  const out: string[] = [];
  let total = 0;
  for (const m of window) {
    if (m.role === "system") continue;
    const label = m.role === "user" ? "玩家" : "AI";
    const text = (m.content || "").slice(0, 800);
    out.push(`${label}：${text}`);
    total += text.length + label.length + 2;
    if (total > SUMMARY_WINDOW_CHARS) break;
  }
  return out.join("\n");
}

async function summarize(windowText: string, sessionTitle: string, provider: { model: string; baseUrl: string; apiKey: string }, signal?: AbortSignal): Promise<string> {
  const sys =
    "你是一位小说编辑。请把用户提供的对话记录压缩为「故事脉络摘要」，" +
    "用于长对话压缩后保持剧情连贯。只输出摘要正文，不要任何解释。";
  const user =
    `会话标题：${sessionTitle}\n` +
    "要求：\n" +
    "1. 按时间顺序概括关键事件（起因 / 经过 / 结果）；\n" +
    "2. 概括玩家（主角）的关键选择与后果；\n" +
    "3. 概括主要角色当前的处境、关系进展与恩怨；\n" +
    "4. 概括当前局势与未解决的伏笔；\n" +
    "5. 输出 300-600 字简体中文要点式（1. 2. 3. …），不要角色扮演、不要对话原文、不要【】模板。\n" +
    "对话记录如下（==== 之间）：\n====\n" + windowText + "\n====";
  let out = "";
  for await (const chunk of chatStream(
    [
      { role: "system", content: sys },
      { role: "user", content: user },
    ],
    provider.model,
    provider.baseUrl,
    provider.apiKey,
    false,
    undefined,
    signal,
  )) {
    out += chunk.content;
  }
  return out.trim() || "（摘要为空）";
}

/**
 * 压缩会话：① 提取主要 NPC 存角色卡并绑定 ② 增量摘要 ③ 写回 sessions（摘要合并 / 压缩点前移）。
 * 任一步失败（非中止）不阻塞整体：角色提取失败则只摘要，摘要失败则整体失败且不写回。
 */
export async function compressSession(ctx: CompressContext): Promise<CompressResult> {
  const { session, messages, provider, signal, onStage } = ctx;
  const { window, kept } = computeCompressWindow(session, messages);
  const estimatedTokens = estimateCompressTokens(session, messages);
  if (window.length === 0) {
    return { ok: false, reason: "没有可整理的内容（已全部在最近保留范围内）", charactersSaved: 0, windowCount: 0, keptCount: kept.length, estimatedTokens };
  }

  // 第 1 步：提取主要 NPC → 角色卡 + 绑定
  let charactersSaved = 0;
  onStage?.("extracting");
  try {
    const chars = await extractCharacters({
      messages: window,
      playerCharacterName: ctx.playerCharacterName,
      worldBookName: ctx.worldBookName,
      provider,
      signal,
    });
    charactersSaved = await saveExtractedCharacters(chars, session.id, ctx.worldBookId);
  } catch (e) {
    if (isAbort(e)) throw e;
    console.warn("[compress] character extraction failed, continuing with summary only:", e);
    charactersSaved = 0;
  }

  // 第 2 步：增量摘要
  onStage?.("summarizing");
  const windowText = buildSummaryWindowText(window);
  const summary = await summarize(windowText, session.title, provider, signal);

  // 第 3 步：写回（摘要增量合并，压缩点前移到窗口最后一条）
  const mergedSummary = session.contextSummary
    ? session.contextSummary + `\n\n【后续进展】\n${summary}`
    : summary;
  const lastWindowMsg = window[window.length - 1];
  await updateSession(session.id, {
    contextSummary: mergedSummary,
    summaryUpdatedAt: Date.now(),
    summaryCount: (session.summaryCount ?? 0) + 1,
    lastSummarizedMessageId: lastWindowMsg.id,
  });

  return {
    ok: true,
    charactersSaved,
    windowCount: window.length,
    keptCount: kept.length,
    estimatedTokens,
    mergedSummary,
    lastSummarizedMessageId: lastWindowMsg.id,
  };
}

/* ---------- 上层编排：手动/自动触发、锁、超时 ---------- */

let compressAbort: AbortController | null = null;
let _lastCompressAt = 0;
let _lastCompressSessionId = "";

/** 压缩完成后标记（下次发送 forceAll 注入角色卡） */
export function markCompressDone(sessionId: string) {
  _lastCompressAt = Date.now();
  _lastCompressSessionId = sessionId;
}

export function isPostCompress(sessionId: string): boolean {
  return Date.now() - _lastCompressAt < 5000 && _lastCompressSessionId === sessionId;
}

/** 中止当前压缩（停止按钮） */
export function stopCompress() {
  compressAbort?.abort();
}

/**
 * 自动触发检查：历史超阈值且距上次「暂不」超过冷却 → 弹出确认框并拦截本次发送。
 * 返回 true 表示已拦截（等待用户决策）。
 */
export function maybePromptCompress(sessionId: string, messages: Message[]): boolean {
  const ui = useUIStore.getState();
  if (ui.compressing) return false;
  const ss = useSessionStore.getState();
  const session = ss.sessions.find((x) => x.id === sessionId);
  if (!session || session.kind === "blank") return false;
  if (messages.length < AUTO_TRIGGER_COUNT) return false;
  if (estimateHistoryTokens(messages) < AUTO_TRIGGER_TOKENS) return false;
  if (Date.now() - ui.lastCompressDeclineAt < REMIND_COOLDOWN_MS) return false;

  const { window } = computeCompressWindow(session, messages);
  ui.setCompressPrompt({
    sessionId,
    count: messages.length,
    estimatedTokens: estimateCompressTokens(session, messages),
    windowCount: window.length,
    keptCount: KEEP_RECENT,
  });
  ui.setCompressPromptCallbacks({
    onConfirm: () => {
      ui.setCompressPrompt(null);
      void runCompression();
    },
    onCancel: () => {
      ui.setCompressPrompt(null);
      ui.markCompressDeclined();
    },
  });
  return true;
}

/** 执行压缩（手动按钮 / 自动确认后）。压缩期间全局锁定，禁止其他操作。 */
export async function runCompression(): Promise<CompressResult> {
  const ui = useUIStore.getState();
  if (ui.compressing) return { ok: false, reason: "正在整理中，请稍候", charactersSaved: 0, windowCount: 0, keptCount: 0, estimatedTokens: 0 };

  // 模型服务检查（与发送拦截一致）
  const ps = useProviderStore.getState();
  const provider = ps.providers.find((p) => p.id === ps.activeProviderId);
  if (!provider || !provider.baseUrl || !provider.apiKey || !ps.activeModel) {
    ui.notify("未配置可用的模型服务，请先在设置中配置", "settings");
    return { ok: false, reason: "未配置模型服务", charactersSaved: 0, windowCount: 0, keptCount: 0, estimatedTokens: 0 };
  }

  const ss = useSessionStore.getState();
  const session = ss.sessions.find((x) => x.id === ss.activeId);
  if (!session) {
    ui.notify("没有可整理的会话");
    return { ok: false, reason: "无活跃会话", charactersSaved: 0, windowCount: 0, keptCount: 0, estimatedTokens: 0 };
  }

  let messages: Message[] = [];
  try {
    messages = await loadMessages(session.id);
  } catch (e) {
    console.error("[compress] loadMessages failed:", e);
    ui.notify("加载会话失败，无法整理");
    return { ok: false, reason: "加载会话失败", charactersSaved: 0, windowCount: 0, keptCount: 0, estimatedTokens: 0 };
  }
  if (messages.length === 0) {
    ui.notify("该会话还没有消息，无需整理");
    return { ok: false, reason: "会话无消息", charactersSaved: 0, windowCount: 0, keptCount: 0, estimatedTokens: 0 };
  }

  const ws = useWorldStore.getState();
  const ac = new AbortController();
  compressAbort = ac;
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    ac.abort();
  }, COMPRESS_TIMEOUT_MS);

  ui.setCompressing(true);
  ui.setCompressStage("extracting");
  try {
    const result = await compressSession({
      session,
      messages,
      playerCharacterName: useUIStore.getState().selectedCharacterName ?? undefined,
      worldBookName: useUIStore.getState().selectedWorldName ?? undefined,
      worldBookId: ws.activeBook?.id ?? null,
      provider: { model: ps.activeModel, baseUrl: provider.baseUrl, apiKey: provider.apiKey },
      signal: ac.signal,
      onStage: (stage) => useUIStore.getState().setCompressStage(stage),
    });
    if (result.ok) {
      useSessionStore.getState().applyCompression(
        session.id,
        result.mergedSummary ?? "",
        (session.summaryCount ?? 0) + 1,
        result.lastSummarizedMessageId ?? null,
      );
      markCompressDone(session.id);
      ui.notify(`整理完成：已记住 ${result.charactersSaved} 位角色，摘要 ${result.windowCount} 条消息（保留最近 ${result.keptCount} 条）`);
    } else {
      ui.notify(result.reason || "整理失败，请重试");
    }
    return result;
  } catch (e) {
    console.warn("[compress] aborted:", e);
    if (timedOut) {
      ui.notify("整理超时，已中止（未保存任何变更）");
    } else {
      ui.notify("已取消整理");
    }
    return { ok: false, reason: timedOut ? "整理超时" : "已取消", charactersSaved: 0, windowCount: 0, keptCount: 0, estimatedTokens: 0 };
  } finally {
    clearTimeout(timer);
    compressAbort = null;
    useUIStore.getState().setCompressing(false);
    useUIStore.getState().setCompressStage("");
  }
}
