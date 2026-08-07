import type { Message } from "@/types";
import { chatStream } from "@/providers/openai";
import { parseJsonObject } from "./characterExtract";
import type { WorldDraft, WorldEntryDraft } from "@/stores/createStore";

/** 提取窗口总字符上限 */
export const EXTRACT_WINDOW_CHARS = 12000;

function buildWindowText(messages: Message[]): string {
  const out: string[] = [];
  let total = 0;
  for (const m of messages.slice(-30)) {
    if (m.role === "system") continue;
    const label = m.role === "user" ? "用户" : "设定师";
    const text = (m.content || "").slice(0, 600);
    out.push(`${label}：${text}`);
    total += text.length + label.length + 2;
    if (total > EXTRACT_WINDOW_CHARS) break;
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

function normalizeEntry(raw: Record<string, unknown>): WorldEntryDraft | null {
  const title = toStr(raw.title);
  if (!title) return null;
  const key = toStrArray(raw.key);
  const position = toStr(raw.position);
  return {
    category: toStr(raw.category) || "其他",
    title,
    key: key.length > 0 ? key : [title],
    content: toStr(raw.content),
    position: position === "situation" || position === "last" ? position : "system",
  };
}

function normalizeWorld(raw: Record<string, unknown>): WorldDraft | null {
  const name = toStr(raw.name);
  const entriesRaw = Array.isArray(raw.entries) ? raw.entries : [];
  const entries: WorldEntryDraft[] = [];
  for (const e of entriesRaw) {
    if (e && typeof e === "object") {
      const entry = normalizeEntry(e as Record<string, unknown>);
      if (entry && entry.content) entries.push(entry);
    }
  }
  return {
    name: name || "未命名规则书",
    theme: toStr(raw.theme),
    description: toStr(raw.description),
    tags: toStrArray(raw.tags),
    entries,
  };
}

/** 已有条目文本（增量提炼上下文） */
function buildExistingText(existing: WorldDraft | null): string {
  if (!existing) return "";
  const entries = (existing.entries || [])
    .filter((e) => e.title && e.content)
    .map((e) => `- ${e.title}（触发词：${e.key.join("/") || "无"}）：${e.content}`)
    .join("\n");
  return `名称：${existing.name}${existing.theme ? `\n主题：${existing.theme}` : ""}${existing.description ? `\n描述：${existing.description}` : ""}${entries ? `\n\n已有条目：\n${entries}` : ""}`;
}

export interface ExtractParams {
  messages: Message[];
  /** 增量模式：已保存的世界设定（prompt 中提供，AI 全量重出，同名覆盖） */
  existing?: WorldDraft | null;
  provider: { model: string; baseUrl: string; apiKey: string };
  signal?: AbortSignal;
}

/**
 * 从创建模式对话中提炼世界设定（元信息 + 条目数组）。
 * 返回 null 表示解析失败（调用方提示重试）。
 */
export async function extractWorld(params: ExtractParams): Promise<WorldDraft | null> {
  const { messages, existing, provider, signal } = params;
  const windowText = buildWindowText(messages);

  const systemPrompt =
    "你是一位世界观架构师。请从用户的创建对话中提炼出完整的「世界设定」，用于规则书系统。" +
    "只输出一个 JSON 对象，不要任何解释文字或 markdown 代码块。";

  let userPrompt =
    "请从下面的创建对话中提炼世界设定：\n" +
    "要求：\n" +
    "1. 只使用对话中明确提及的信息，不要编造；\n" +
    "2. 输出 JSON 对象，格式：\n" +
    '{"name":"规则书名","theme":"题材基调","description":"一句话简介","tags":["标签"],"entries":[{"category":"分类","title":"条目名","key":["触发关键词"],"content":"条目详细内容","position":"system|situation|last"}]}\n' +
    "3. entries 中的每条代表一条世界规则/设定，内容要具体完整（30-120字），触发关键词用对话中的专有名词（地点/物品/概念）；\n" +
    "4. 没有的信息填空字符串或空数组；\n" +
    "5. position 默认 system，情境规则用 situation，对话末尾追加的用 last。";

  if (existing) {
    userPrompt +=
      "\n6. 这是增量修改：下面提供「已有设定」，请输出完整的最新版本（新增条目 + 对已有条目同名更新）。已有条目与对话冲突时以新对话为准。";
  }

  userPrompt +=
    (existing ? `\n\n【已有设定】\n${buildExistingText(existing)}\n` : "") +
    "\n创建对话如下（==== 之间）：\n====\n" + windowText + "\n====";

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
    console.warn("[worldExtract] LLM call failed:", e);
    return null;
  }

  const parsed = parseJsonObject<Record<string, unknown>>(raw);
  if (!parsed) {
    console.warn("[worldExtract] JSON parse failed");
    return null;
  }
  return normalizeWorld(parsed);
}
