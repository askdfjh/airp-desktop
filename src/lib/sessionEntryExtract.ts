import type { Message, SessionEntry } from "@/types";
import { chatStream } from "@/providers/openai";

/** 单条临时条目内容上限（字符） */
export const SESSION_ENTRY_MAX_CHARS = 150;
/** 单会话临时条目总上限（超出淘汰最旧） */
export const SESSION_ENTRY_MAX_COUNT = 8;
/** 提取窗口文本总字符上限 */
export const SESSION_ENTRY_WINDOW_CHARS = 20000;

export function buildSessionEntryWindowText(messages: Message[]): string {
  const out: string[] = [];
  let total = 0;
  for (const m of messages) {
    if (m.role === "system") continue;
    const label = m.role === "user" ? "玩家" : "AI";
    const text = (m.content || "").slice(0, 800);
    out.push(`${label}：${text}`);
    total += text.length + label.length + 2;
    if (total > SESSION_ENTRY_WINDOW_CHARS) break;
  }
  return out.join("\n");
}

function toStr(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function toStrArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x) => typeof x === "string").map((x) => x.trim()).filter(Boolean);
}

function normalizeKey(s: string): string {
  return s.replace(/\s+/g, "");
}

/** 宽松 JSON 数组解析：容忍 markdown 代码块与前后说明文字 */
function parseJsonArray(text: string): Record<string, unknown>[] | null {
  const clean = (text || "").replace(/```json/gi, "").replace(/```/g, "").trim();
  const start = clean.indexOf("[");
  const end = clean.lastIndexOf("]");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    const arr = JSON.parse(clean.slice(start, end + 1));
    return Array.isArray(arr) ? arr.filter((x) => x && typeof x === "object") : null;
  } catch {
    return null;
  }
}

/** 合并去重：同名/同触发词覆盖旧值；返回按创建时间排序的最新列表（上限 SESSION_ENTRY_MAX_COUNT） */
export function mergeSessionEntries(
  existing: SessionEntry[] | undefined,
  fresh: SessionEntry[],
  now = Date.now(),
): SessionEntry[] {
  const map = new Map<string, SessionEntry>();
  const put = (e: SessionEntry) => {
    if (!e || !e.title || !e.content) return;
    const normTitle = normalizeKey(e.title);
    if (!normTitle) return;
    map.set(normTitle, e);
  };
  for (const e of existing || []) put(e);
  for (const e of fresh) put(e);
  const list = [...map.values()].sort((a, b) => a.createdAt - b.createdAt);
  return list.slice(-SESSION_ENTRY_MAX_COUNT);
}

function normalizeEntry(raw: Record<string, unknown>): SessionEntry | null {
  const title = toStr(raw.title);
  if (!title) return null;
  const content = toStr(raw.content).slice(0, SESSION_ENTRY_MAX_CHARS);
  if (!content) return null;
  // 触发词：LLM 漏给 key 时回退标题，保证注入按 key 匹配时能命中
  const key = toStrArray(raw.key).slice(0, 6);
  return {
    id: crypto.randomUUID(),
    title,
    key: key.length > 0 ? key : [title],
    content,
    createdAt: Date.now(),
  };
}

export interface ExtractSessionEntriesParams {
  /** 对话窗口文本（复用压缩窗口构建结果） */
  windowText: string;
  /** 已有的临时条目（供去重：同名不再输出） */
  existing?: SessionEntry[];
  provider: { model: string; baseUrl: string; apiKey: string };
  signal?: AbortSignal;
}

/**
 * 从对话窗口中提取会话临时世界条目（新地点/物品/势力/灵物/遗迹等）。
 * 返回空数组表示无新条目或提取失败（调用方不应阻塞压缩流程）。
 */
export async function extractSessionEntries(params: ExtractSessionEntriesParams): Promise<SessionEntry[]> {
  const { windowText, existing, provider, signal } = params;
  const existingTitles = (existing || []).map((e) => e.title).join("、");

  const systemPrompt =
    "你是一位世界观架构师。请从对话记录中提取【新增的世界设定】——对话中首次出现的、值得记住的新地点、物品、灵物、遗迹、势力、规则等，用于在本次故事会话中保持设定一致。只输出 JSON 数组，不要任何解释文字或 markdown 代码块。";

  let userPrompt =
    "请从下面的对话记录中提取新增的世界设定：\n" +
    "要求：\n" +
    "1. 只提取对话中首次出现且对后续剧情可能重要的实体（新地点/物品/灵物/遗迹/势力/组织/特殊规则等）；\n" +
    "2. 每个条目：title 用对话中的专有名词（如「青玄剑冢」），key 是 1-3 个触发词（专有名词/别名），content 用一句话说明该设定的要点与当前状态（30-80 字，最多 150 字）；\n" +
    "3. 与下面「已有条目」同名的不要重复输出；\n" +
    "4. 最多输出 5 条，按重要程度排序；没有新设定输出空数组 []；\n" +
    "5. 输出格式：[{\"title\":\"...\",\"key\":[\"...\"],\"content\":\"...\"}]\n" +
    (existingTitles ? `\n已有条目（不要重复输出）：${existingTitles}\n` : "") +
    "\n对话记录如下（==== 之间）：\n====\n" + windowText + "\n====";

  let raw = "";
  try {
    for await (const chunk of chatStream(
      [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      provider.model,
      provider.baseUrl,
      provider.apiKey,
      false,
      undefined,
      signal,
    )) {
      raw += chunk.content;
    }
  } catch (e) {
    // 中止（用户停止/超时）向上传播，保证压缩流程能感知取消
    if (e instanceof DOMException && e.name === "AbortError") throw e;
    console.warn("[sessionEntryExtract] LLM call failed:", e);
    return [];
  }

  const parsed = parseJsonArray(raw);
  if (!parsed) {
    console.warn("[sessionEntryExtract] JSON parse failed");
    return [];
  }
  const out: SessionEntry[] = [];
  for (const e of parsed) {
    const entry = normalizeEntry(e);
    if (entry) out.push(entry);
  }
  return mergeSessionEntries(undefined, out);
}
