import type { Message } from "@/types";
import { chatStream } from "@/providers/openai";
import {
  findExtractedCharacterCardByName,
  insertCharacterCard,
  updateCharacterCard,
  insertSessionCharacterCard,
  deleteSessionCharacterCardByCard,
} from "./db";
import { parseSceneReply } from "./sceneTemplate";

/** 单次提取的角色上限 */
export const MAX_EXTRACT_CHARACTERS = 5;
/** 提取窗口总字符上限（超出截断，控制 token 消耗） */
export const EXTRACT_WINDOW_CHARS = 15000;
/** 出场频率兜底阈值：场景信息中至少出现 N 次才算主要角色 */
export const MIN_MENTIONS = 3;

/** 粗估 token 数：中英混合约 1.6 字符/token */
export function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil((text || "").length / 1.6));
}

export interface ExtractedCharacterInfo {
  name: string;
  aliases: string[];
  appearance: string;
  personality: string;
  speechStyle: string;
  background: string;
  relationships: string;
  currentStatus: string;
}

export interface ExtractParams {
  /** 摘要窗口内的消息（用于提取角色的对话文本） */
  messages: Message[];
  /** 玩家角色名（提取时排除） */
  playerCharacterName?: string;
  /** 当前世界书名称（写入 prompt 上下文） */
  worldBookName?: string;
  /** 调用 LLM 所需的 Provider 信息 */
  provider: { model: string; baseUrl: string; apiKey: string };
  signal?: AbortSignal;
}

function normalizeName(s: string): string {
  return (s || "").trim().replace(/\s+/g, "");
}

function buildWindowText(messages: Message[]): string {
  const recent = messages.slice(-40);
  const out: string[] = [];
  let total = 0;
  for (const m of recent) {
    if (m.role === "system") continue;
    const label = m.role === "user" ? "玩家" : "AI";
    const text = (m.content || "").slice(0, 600);
    out.push(`${label}：${text}`);
    total += text.length + label.length + 2;
    if (total > EXTRACT_WINDOW_CHARS) break;
  }
  return out.join("\n");
}

/** 宽松 JSON 数组解析：容忍 markdown 代码块与前后说明文字 */
function parseJsonArray(text: string): ExtractedCharacterInfo[] | null {
  const clean = (text || "").replace(/```json/gi, "").replace(/```/g, "").trim();
  const start = clean.indexOf("[");
  const end = clean.lastIndexOf("]");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    const arr = JSON.parse(clean.slice(start, end + 1));
    if (!Array.isArray(arr)) return null;
    return arr
      .filter((x) => x && typeof x === "object" && typeof x.name === "string" && x.name.trim())
      .map((x) => ({
        name: String(x.name).trim(),
        aliases: Array.isArray(x.aliases)
          ? x.aliases.filter((a: unknown) => typeof a === "string").map((a: string) => a.trim()).filter(Boolean)
          : [],
        appearance: String(x.appearance || "").trim(),
        personality: String(x.personality || "").trim(),
        speechStyle: String(x.speechStyle || "").trim(),
        background: String(x.background || "").trim(),
        relationships: String(x.relationships || "").trim(),
        currentStatus: String(x.currentStatus || "").trim(),
      }));
  } catch {
    return null;
  }
}

function cleanCharacters(
  list: ExtractedCharacterInfo[],
  playerCharacterName?: string,
): ExtractedCharacterInfo[] {
  const seen = new Set<string>();
  const out: ExtractedCharacterInfo[] = [];
  for (const c of list) {
    const key = normalizeName(c.name);
    if (!key) continue;
    if (playerCharacterName && key === normalizeName(playerCharacterName)) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(c);
    if (out.length >= MAX_EXTRACT_CHARACTERS) break;
  }
  return out;
}

/**
 * 兜底提取：遍历消息解析【场景信息】的「出场角色」字段做频率统计，
 * 出场 ≥ MIN_MENTIONS 次的角色按频率降序取前 MAX_EXTRACT_CHARACTERS 个。
 */
export function fallbackExtractBySceneFields(
  messages: Message[],
  playerCharacterName?: string,
): ExtractedCharacterInfo[] {
  const counts = new Map<string, number>();
  for (const m of messages) {
    if (m.role !== "assistant" || !m.content) continue;
    const scene = parseSceneReply(m.content).scene;
    if (!scene?.characters) continue;
    for (const raw of scene.characters.split(/[、，,／/]/)) {
      const name = raw.trim();
      if (!name || name.length > 12) continue;
      if (playerCharacterName && normalizeName(name) === normalizeName(playerCharacterName)) continue;
      counts.set(name, (counts.get(name) || 0) + 1);
    }
  }
  return [...counts.entries()]
    .filter(([, c]) => c >= MIN_MENTIONS)
    .sort((a, b) => b[1] - a[1])
    .slice(0, MAX_EXTRACT_CHARACTERS)
    .map(([name]) => ({
      name,
      aliases: [],
      appearance: "",
      personality: "",
      speechStyle: "",
      background: "",
      relationships: "",
      currentStatus: "",
    }));
}

/** 组装角色卡注入正文（P2 注入时使用） */
export function buildCharacterCardContent(info: ExtractedCharacterInfo): string {
  const parts: string[] = [];
  const push = (label: string, v: string) => {
    if (v && v.trim()) parts.push(`${label}：${v.trim()}`);
  };
  push("定位", info.relationships ? `${info.name}（${info.relationships}）` : "");
  push("外貌", info.appearance);
  push("性格", info.personality);
  push("说话风格", info.speechStyle);
  push("背景", info.background);
  push("关系", info.relationships);
  push("近况", info.currentStatus);
  const body = parts.length > 0 ? parts.join("。") + "。" : "暂无详细信息。";
  return `【角色卡·${info.name}】${body}`;
}

/**
 * 用 LLM 从对话中提取主要 NPC 角色。JSON 解析失败时回退到场景字段频率统计。
 */
export async function extractCharacters(params: ExtractParams): Promise<ExtractedCharacterInfo[]> {
  const { messages, playerCharacterName, worldBookName, provider, signal } = params;
  const windowText = buildWindowText(messages);

  const systemPrompt =
    "你是一位资深小说编辑。请从用户提供的对话记录中，识别出出场的重要角色（NPC），用于建立角色卡，" +
    "保证长对话压缩后角色设定不跑偏。只输出 JSON 数组，不要任何解释文字或 markdown 代码块。";

  const userPrompt =
    "请从下面的对话记录中提取【出场的重要角色】（NPC）：\n" +
    "要求：\n" +
    "1. 只提取对剧情重要、出场频繁（一般 3 次以上）的角色；" +
    (playerCharacterName ? `当前玩家/主角「${playerCharacterName}」不提取；` : "") +
    "\n2. 最多输出 " + MAX_EXTRACT_CHARACTERS + " 个角色，按重要程度排序；\n" +
    "3. 严格输出 JSON 数组（不要 markdown 代码块、不要多余文字），每个元素格式：\n" +
    '[{"name":"角色名","aliases":["别名","昵称"],"appearance":"外貌特征","personality":"性格特点","speechStyle":"说话风格","background":"背景来历","relationships":"与玩家及其他角色的关系","currentStatus":"当前状态与近况"}]\n' +
    "4. 所有信息必须来自对话记录，不得编造；没有的信息填空字符串；\n" +
    "5. 对话发生在世界：" + (worldBookName || "未知世界") + "。\n" +
    "对话记录如下（==== 之间）：\n====\n" + windowText + "\n====";

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
    console.warn("[characterExtract] LLM call failed, falling back to scene fields:", e);
    return fallbackExtractBySceneFields(messages, playerCharacterName);
  }

  const parsed = parseJsonArray(raw);
  if (!parsed || parsed.length === 0) {
    console.warn("[characterExtract] JSON parse failed, falling back to scene fields");
    return fallbackExtractBySceneFields(messages, playerCharacterName);
  }
  const cleaned = cleanCharacters(parsed, playerCharacterName);
  return cleaned.length > 0 ? cleaned : fallbackExtractBySceneFields(messages, playerCharacterName);
}

/** 单次注入的角色卡上限 */
export const MAX_INJECT_CARDS = 5;
/** 单次注入总字符上限 */
export const INJECT_MAX_CHARS = 2000;

/** 已加载的会话提取角色卡（绑定 + 卡内容） */
export interface LoadedExtractedCard {
  characterCardId: string;
  name: string;
  /** JSON 字符串：出场触发词（角色名 + 别称） */
  triggerWords: string;
  /** 缓存的注入正文（【角色卡·名】…） */
  systemPrompt: string;
  description: string;
}

function normalizeText(s: string): string {
  return (s || "").toLowerCase().replace(/\s+/g, "");
}

/**
 * 角色卡关键词注入（世界书同机制）：角色触发词（名/别称）出现在最近对话 → 注入该角色卡。
 * forceAll 为 true 时（压缩后首条请求）全量注入，帮助 AI 重建上下文。
 */
export function buildCharacterContext(
  cards: LoadedExtractedCard[],
  recentText: string,
  opts?: { maxCards?: number; maxChars?: number; forceAll?: boolean },
): string {
  if (!cards || cards.length === 0) return "";
  const maxCards = opts?.maxCards ?? MAX_INJECT_CARDS;
  const maxChars = opts?.maxChars ?? INJECT_MAX_CHARS;
  const haystack = normalizeText(recentText);

  const hit: LoadedExtractedCard[] = [];
  for (const c of cards) {
    if (hit.length >= maxCards) break;
    if (opts?.forceAll) {
      hit.push(c);
      continue;
    }
    if (!haystack) continue;
    let words: string[] = [];
    try {
      words = JSON.parse(c.triggerWords || "[]") as string[];
    } catch {
      words = [c.name];
    }
    const matched = words.some((w) => {
      const kw = normalizeText(w);
      return kw && kw.length >= 2 && haystack.includes(kw);
    });
    if (matched) hit.push(c);
  }
  if (hit.length === 0) return "";

  const sections: string[] = [];
  let total = 0;
  for (const c of hit) {
    const line = c.systemPrompt || `【角色卡·${c.name}】${c.description || ""}`;
    if (total + line.length + 1 > maxChars) break;
    sections.push(line);
    total += line.length + 1;
  }
  if (sections.length === 0) return "";
  return "【角色状态·当前会话】以下角色设定来自早前对话的自动提取，角色出场时自动注入，请保持角色设定一致：\n" + sections.join("\n");
}

/**
 * 幂等保存提取角色：同名提取卡更新内容，否则新建；均绑定到当前会话（先删旧绑再插）。
 * 返回实际保存/更新的角色数。
 */
export async function saveExtractedCharacters(
  cards: ExtractedCharacterInfo[],
  sessionId: string,
  worldBookId: string | null,
): Promise<number> {
  let saved = 0;
  for (const info of cards) {
    if (!normalizeName(info.name)) continue;
    const triggerWords = [info.name, ...info.aliases].filter(Boolean);
    const description = (info.relationships || info.name).slice(0, 80);
    const now = Date.now();
    const existing = await findExtractedCharacterCardByName(info.name);
    if (existing) {
      await updateCharacterCard(existing.id, {
        description,
        personality: info.personality,
        scenario: info.currentStatus,
        systemPrompt: buildCharacterCardContent(info),
        tags: [...(existing.tags || []).filter((t) => t !== "提取"), "提取"],
        worldBookId,
        isExtracted: true,
        triggerWords,
        updatedAt: now,
      });
      await deleteSessionCharacterCardByCard(sessionId, existing.id);
      await insertSessionCharacterCard({ sessionId, characterCardId: existing.id, worldBookId });
    } else {
      const id = "ccx_" + now + "_" + Math.random().toString(36).slice(2, 8);
      await insertCharacterCard({
        id,
        name: info.name,
        description,
        systemPrompt: buildCharacterCardContent(info),
        emoji: "🎭",
        tags: ["提取"],
        isBuiltin: false,
        isExtracted: true,
        triggerWords,
        personality: info.personality,
        scenario: info.currentStatus,
        worldBookId,
        createdAt: now,
        updatedAt: now,
      });
      await insertSessionCharacterCard({ sessionId, characterCardId: id, worldBookId });
    }
    saved++;
  }
  return saved;
}
