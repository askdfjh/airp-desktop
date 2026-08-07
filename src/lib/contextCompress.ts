import type { Message, Session } from "@/types";
import { chatStream } from "@/providers/openai";
import { loadMessages, updateSession, hardDeleteSession } from "./db";
import { extractCharacters, saveExtractedCharacters, estimateTokens, type ExtractedCharacterInfo } from "./characterExtract";
import { useProviderStore } from "@/stores/providerStore";
import { useSessionStore } from "@/stores/sessionStore";
import { useUIStore } from "@/stores/uiStore";
import { useWorldStore } from "@/stores/worldStore";

/** 压缩时保留的最近消息条数（原文不摘要） */
export const KEEP_RECENT = 30;
/** 模型上下文窗口（token）基准：按主流 128K 计（上下文占用百分比的分母） */
export const CONTEXT_WINDOW_TOKENS = 128000;
/** 达到窗口的此百分比（%）才提示 / 允许保存记忆 */
export const COMPRESS_ALLOW_PCT = 90;
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
  /** 新建的续集会话 id（成功时） */
  continuationSessionId?: string;
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

/** 生成剧情档案（结构化：局势/角色现状/关键事件/伏笔），注入父卷档案做衔接。 */
async function generateArchive(
  windowText: string,
  sessionTitle: string,
  parentArchive: string | undefined,
  provider: { model: string; baseUrl: string; apiKey: string },
  signal?: AbortSignal,
): Promise<string> {
  const sys =
    "你是一位小说编辑。把对话记录整理成「剧情档案」，用于续集会话保持剧情一致性。" +
    "只输出档案正文，不要任何解释。";
  const user =
    `会话标题：${sessionTitle}\n` +
    "输出结构（简体中文要点式，总篇幅 500-800 字）：\n" +
    "【当前局势】各方势力与人物当前状态、矛盾焦点、主角处境\n" +
    "【角色现状】每个主要角色一行：位置、处境、目标、恩怨\n" +
    "【关键事件】按时间顺序的剧情要点\n" +
    "【未解伏笔】尚未揭晓的悬念清单\n" +
    "要求：只写事实不评价；不要对话原文；不要【场景信息】等标签模板；" +
    (parentArchive ? "必须衔接上卷档案——上卷的重大事件结果与伏笔去向要纳入本卷（上卷档案见下）。\n上卷档案：\n" + parentArchive + "\n" : "（无上卷档案）\n") +
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
  return out.trim() || "（档案为空）";
}

/** 构建关键词索引：角色名/别名 → 窗口内包含该词的消息 id（触发式注入用）。 */
export function buildContextIndex(chars: ExtractedCharacterInfo[], window: Message[]): string {
  const keywords = new Set<string>();
  for (const c of chars) {
    if (c.name && c.name.trim().length >= 2) keywords.add(c.name.trim());
    for (const a of c.aliases || []) {
      if (a && a.trim().length >= 2) keywords.add(a.trim());
    }
  }
  const index: Record<string, string[]> = {};
  for (const kw of keywords) {
    const ids = window
      .filter((m) => m.role !== "system" && m.content && m.content.includes(kw))
      .map((m) => m.id);
    if (ids.length > 0) index[kw] = ids.slice(0, 8);
  }
  return JSON.stringify(index);
}

/**
 * 压缩会话（保存记忆）：
 * ① 提取主要 NPC（保存到续集会话，与基线卡合并）② 生成剧情档案（衔接父卷）③ 建关键词索引
 * ④ 创建续集会话（继承设定 + 复制前卷基线卡 + 写入档案/索引）⑤ 原会话锁定只读。
 * 任一步失败（非中止）不阻塞整体：角色提取失败则只生成档案；续集创建失败则整体失败并回滚。
 */
export async function compressSession(ctx: CompressContext): Promise<CompressResult> {
  const { session, messages, provider, signal, onStage } = ctx;
  const { window, kept } = computeCompressWindow(session, messages);
  const estimatedTokens = estimateCompressTokens(session, messages);
  if (window.length === 0) {
    return { ok: false, reason: "没有可整理的内容（已全部在最近保留范围内）", charactersSaved: 0, windowCount: 0, keptCount: kept.length, estimatedTokens };
  }

  // 第 1 步：提取主要 NPC（仅冒险会话；空白会话跳过——不提取角色、不关联规则书）
  let chars: ExtractedCharacterInfo[] = [];
  const isBlankSession = session.kind === "blank";
  if (!isBlankSession) {
    onStage?.("extracting");
    try {
      chars = await extractCharacters({
        messages: window,
        playerCharacterName: ctx.playerCharacterName,
        worldBookName: ctx.worldBookName,
        provider,
        signal,
      });
    } catch (e) {
      if (isAbort(e)) throw e;
      console.warn("[compress] character extraction failed, continuing with archive only:", e);
      chars = [];
    }
  }

  // 第 2 步：生成剧情档案（注入父卷档案衔接）
  onStage?.("summarizing");
  const windowText = buildSummaryWindowText(window);
  const parent = session.parentId
    ? useSessionStore.getState().sessions.find((s) => s.id === session.parentId)
    : undefined;
  const archive = await generateArchive(windowText, session.title, parent?.archive, provider, signal);

  // 第 3 步：关键词索引
  const contextIndex = buildContextIndex(chars, window);

  // 第 4 步：创建续集会话（复制基线卡）+ 在续集上保存提取 + 锁定原会话（原子：失败回滚）
  const ss = useSessionStore.getState();
  let continuationId = "";
  try {
    continuationId = await ss.createContinuationSession(session, { archive, contextIndex });
    const charactersSaved = chars.length > 0
      ? await saveExtractedCharacters(chars, continuationId, ctx.worldBookId)
      : 0;
    ss.lockSession(session.id);
    return {
      ok: true,
      charactersSaved,
      windowCount: window.length,
      keptCount: kept.length,
      estimatedTokens,
      continuationSessionId: continuationId,
    };
  } catch (e) {
    if (isAbort(e)) throw e;
    console.warn("[compress] continuation creation failed, rolling back:", e);
    if (continuationId) {
      await hardDeleteSession(continuationId).catch(() => {});
    }
    return {
      ok: false,
      reason: "整理失败（续集会话创建异常），已回滚，原会话未改动",
      charactersSaved: 0,
      windowCount: window.length,
      keptCount: kept.length,
      estimatedTokens,
    };
  }
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
  if (!session) return false;
  // 达到窗口 90% 才提示（不自动压缩，仅弹窗询问；未到 90% 不打扰）
  const pct = estimateHistoryTokens(messages) / CONTEXT_WINDOW_TOKENS * 100;
  if (pct < COMPRESS_ALLOW_PCT) return false;
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
  if (ui.compressing) return { ok: false, reason: "正在保存记忆中，请稍候", charactersSaved: 0, windowCount: 0, keptCount: 0, estimatedTokens: 0 };

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
      const contId = result.continuationSessionId ?? session.id;
      markCompressDone(contId);
      const cont = useSessionStore.getState().sessions.find((s) => s.id === contId);
      ui.notify(
        `整理完成：已新建续集会话（第 ${cont?.chainIndex ?? 1} 卷），记住 ${result.charactersSaved} 位角色；原会话已锁定只读，可创建分支继续`
      );
    } else {
      ui.notify(result.reason || "整理失败，请重试");
    }
    return result;
  } catch (e) {
    console.warn("[compress] aborted:", e);
    if (timedOut) {
      ui.notify("整理超时，已中止（未保存任何变更）。手机弱网下整理可能需要较长时间，可稍后重试");
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
