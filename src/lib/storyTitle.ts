import { chatStream, type ApiMessage } from "@/providers/openai";
import { loadMessages } from "@/lib/db";
import { parseSceneReply } from "@/lib/sceneTemplate";
import { parseSceneAnalysis } from "@/lib/sceneAnalyzer";
import { getTopicScheme } from "@/lib/topicSchemes";
import { WORLD_FOUNDATIONS } from "@/lib/worldFoundations";
import { logError } from "@/lib/appLog";
import type { Message, Story } from "@/types";
import { useProviderStore } from "@/stores/providerStore";
import { useSessionStore } from "@/stores/sessionStore";
import { useWorldStore } from "@/stores/worldStore";

const PLACEHOLDER_EXACT = new Set([
  "新冒险",
  "未命名稿纸",
  "空白会话",
  "会话",
  "未命名",
  "新故事",
]);

const REASONING_MARK =
  /用户现在|需要起|首先看|素材里|根据素材|根据下面|书名必须|只输出|严禁|合格例|网文责编|分析一下|所以书名|可以叫作/;

/** 开局占位名：某某的冒险 / 未命名稿纸 / 扮演·角色 等 */
export function isPlaceholderTitle(title: string | null | undefined): boolean {
  const t = (title || "").trim();
  if (!t) return true;
  if (PLACEHOLDER_EXACT.has(t)) return true;
  if (/的冒险$/.test(t)) return true;
  if (/^扮演[·•]/.test(t)) return true;
  if (/^未命名/.test(t)) return true;
  if (REASONING_MARK.test(t)) return true;
  return false;
}

function stripThink(raw: string): string {
  return (raw || "")
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/<think>[\s\S]*$/gi, "")
    .replace(/<\/?think>/gi, "")
    .trim();
}

function polishTitleLine(line: string): string {
  let t = line.trim();
  t = t.replace(/^[\s"'「」『』【】《》〈〉*#\->]+|[\s"'「」『』【】《》〈〉]+$/g, "");
  t = t.replace(/^(?:书名|标题|书名是|推荐书名|输出|答案)[:：]\s*/, "");
  t = t.replace(/^\d+[\.、.)）]\s*/, "");
  t = t.replace(/\s+/g, "");
  if (/[。！？.!?…]$/.test(t)) t = t.slice(0, -1);
  return t;
}

export function isBadGeneratedTitle(title: string): boolean {
  const t = (title || "").trim();
  if (!t) return true;
  if (t.length < 4 || t.length > 20) return true;
  if (isPlaceholderTitle(t)) return true;
  if (REASONING_MARK.test(t)) return true;
  if (/[。！？!?…]/.test(t)) return true;
  if (/因为|所以|但是|然后|首先|如果|可以|应该|需要|我们|这个|那个|素材|模型/.test(t)) return true;
  if (/^(建议|如下|可以叫|好的|当然|书名|标题|嗯|哦)/.test(t)) return true;
  if (/(的书名|这本书|起名|取名|命名)$/.test(t)) return true;
  if (!/[\u4e00-\u9fff]/.test(t)) return true;
  return false;
}

function quotedTitle(text: string): string | null {
  const matches = [...text.matchAll(/[《「『【]([^》」』】]{4,20})[》」』】]/g)];
  for (let i = matches.length - 1; i >= 0; i--) {
    const t = polishTitleLine(matches[i][1]);
    if (t && !isBadGeneratedTitle(t)) return t;
  }
  return null;
}

function titleFromJson(text: string): string | null {
  const m = text.match(/"title"\s*:\s*"([^"]{2,24})"/);
  if (!m) return null;
  const t = polishTitleLine(m[1]);
  return t && !isBadGeneratedTitle(t) ? t : null;
}

/** 从模型输出里抠书名。推理句丢掉，优先取最后一行像书名的短句。 */
export function parseGeneratedTitle(raw: string): string | null {
  let t = stripThink(raw);
  if (!t) return null;
  const fence = t.match(/```(?:\w+)?\s*([\s\S]*?)```/);
  if (fence) t = fence[1].trim();
  const fromJson = titleFromJson(t);
  if (fromJson) return fromJson;
  try {
    const parsed = JSON.parse(t) as unknown;
    if (parsed && typeof parsed === "object" && typeof (parsed as { title?: unknown }).title === "string") {
      const one = polishTitleLine((parsed as { title: string }).title);
      if (one && !isBadGeneratedTitle(one)) return one;
    }
  } catch {
    /* 按纯文本处理 */
  }
  const quoted = quotedTitle(t);
  if (quoted) return quoted;
  const labeled = t.match(/(?:书名|标题)\s*[:：是为]\s*[「『《"]?([^\n」』》"]{4,20})/);
  if (labeled) {
    const one = polishTitleLine(labeled[1]);
    if (one && !isBadGeneratedTitle(one)) return one;
  }
  const lines = t.split(/\r?\n/).map((s) => polishTitleLine(s)).filter(Boolean);
  const good = lines.filter((c) => !isBadGeneratedTitle(c));
  if (good.length) return good[good.length - 1];
  return null;
}

export function composeFallbackTitle(story: Story): string {
  const topic = getTopicScheme(story.topicSchemeId)?.label || "";
  const name = (story.protagonistName || "").replace(/\s+/g, "");
  const world = WORLD_FOUNDATIONS.find((f) => f.id === story.worldBaseId)?.label || "";
  const genre = topic || world;
  if (name && genre && name !== "主角") {
    const a = `${name}${genre}开局`;
    if (a.length <= 16) return a;
    return `${genre}里的${name}`.slice(0, 16);
  }
  if (genre) return `${genre}开局我能翻盘`.slice(0, 16);
  if (name && name !== "主角") return `${name}开局就翻盘`.slice(0, 16);
  return "开局一把破剑走天下";
}

function clip(s: string, max: number): string {
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > max ? t.slice(0, max) + "…" : t;
}

function bodyOf(m: Message): string {
  if (m.role !== "assistant") return (m.content || "").trim();
  return parseSceneReply(m.content || "").body || (m.content || "").trim();
}

function chapterOf(m: Message): string {
  const fromTpl = parseSceneReply(m.content || "").chapterTitle;
  if (fromTpl) return fromTpl;
  if (!m.sceneAnalysis) return "";
  return parseSceneAnalysis(m.sceneAnalysis)?.chapterTitle || "";
}

async function collectExcerpt(story: Story): Promise<{ excerpt: string; chapters: string[] }> {
  const all = useSessionStore.getState().sessions;
  let vols = all
    .filter((s) => s.storyId === story.id)
    .sort((a, b) => (a.chainIndex ?? 1) - (b.chainIndex ?? 1));
  if (vols.length === 0 && story.lastVolumeId) {
    const one = all.find((s) => s.id === story.lastVolumeId);
    if (one) vols = [one];
  }
  const bags: Message[][] = [];
  const pick = vols.length <= 2 ? vols : [vols[0], vols[vols.length - 1]];
  for (const v of pick) bags.push(await loadMessages(v.id));

  const chapters: string[] = [];
  const seenCh = new Set<string>();
  const snippets: string[] = [];
  for (const msgs of bags) {
    const narrative = msgs.filter((m) => !m.opening && (m.role === "assistant" || m.role === "user"));
    const chosen = narrative.length <= 3
      ? narrative
      : [...narrative.slice(0, 2), narrative[narrative.length - 1]];
    for (const m of chosen) {
      const ch = chapterOf(m);
      if (ch && !seenCh.has(ch)) {
        seenCh.add(ch);
        chapters.push(ch);
      }
      const body = bodyOf(m);
      if (!body) continue;
      const tag = m.role === "user" ? "行动" : "正文";
      snippets.push(`【${tag}】${clip(body, 360)}`);
    }
  }
  return { excerpt: snippets.join("\n"), chapters };
}

function resolveProvider(): { baseUrl: string; apiKey: string; model: string } | null {
  const ps = useProviderStore.getState();
  const session = useSessionStore.getState();
  const active = session.activeId ? session.sessions.find((s) => s.id === session.activeId) : null;
  let provider = ps.providers.find((p) => p.id === (active?.providerId || ps.activeProviderId));
  let model = active?.model || ps.activeModel;
  if (!provider || !model) {
    provider = ps.providers.find((p) => p.id === ps.activeProviderId);
    model = ps.activeModel;
  }
  if (!provider || !model || !provider.baseUrl || !provider.apiKey?.trim()) return null;
  if (ps.enabledProviders[provider.id] === false) return null;
  return { baseUrl: provider.baseUrl, apiKey: provider.apiKey, model };
}

export function buildTitlePrompt(input: {
  protagonist?: string | null;
  worldName?: string | null;
  topic?: string | null;
  worldBase?: string | null;
  chapters: string[];
  excerpt: string;
}): string {
  const meta = [
    input.protagonist && `主角：${input.protagonist}`,
    input.worldName && `规则书/世界：${input.worldName}`,
    input.topic && `题材：${input.topic}`,
    input.worldBase && `底座：${input.worldBase}`,
    input.chapters.length && `已出现章节：${input.chapters.join("、")}`,
  ].filter(Boolean).join("\n");

  return `素材：
${meta || "（无）"}

${input.excerpt ? `摘录：\n${clip(input.excerpt, 1000)}` : "正文尚少，按题材起开局书名。"}`;
}

const TITLE_SYSTEM =
  '你是网文书名机。只输出一行 JSON：{"title":"八到十六个汉字的书名"}。不要解释，不要分析素材，不要复述任务。书名要像起点/番茄封面：身份或金手指一次说清。禁止「XX的冒险」「之旅」「传奇」。';

export async function generateStoryTitle(story: Story, opts?: { allowMetaOnly?: boolean }): Promise<{ title: string | null; error?: string }> {
  const creds = resolveProvider();
  if (!creds) return { title: null, error: "没有可用的模型服务" };

  const { excerpt, chapters } = await collectExcerpt(story);
  const topic = getTopicScheme(story.topicSchemeId)?.label;
  const worldName = story.worldBookId
    ? useWorldStore.getState().books.find((b) => b.id === story.worldBookId)?.name
    : null;
  const worldBase = WORLD_FOUNDATIONS.find((f) => f.id === story.worldBaseId)?.label;

  if (!excerpt && !opts?.allowMetaOnly) return { title: null, error: "正文还太少" };
  if (!excerpt && !story.protagonistName && !topic && !worldName) return { title: null, error: "缺少故事素材" };

  const material = buildTitlePrompt({
    protagonist: story.protagonistName,
    worldName,
    topic,
    worldBase,
    chapters,
    excerpt,
  });

  const ask = async (user: string): Promise<string> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(new Error("取书名超时")), 45_000);
    let content = "";
    let thinking = "";
    try {
      for await (const chunk of chatStream(
        [
          { role: "system", content: TITLE_SYSTEM },
          { role: "user", content: user },
        ] as ApiMessage[],
        creds.model,
        creds.baseUrl,
        creds.apiKey,
        false,
        undefined,
        controller.signal,
        { temperature: 0.4, max_tokens: 800 },
      )) {
        if (controller.signal.aborted) break;
        if (chunk.done) break;
        content += chunk.content || "";
        thinking += chunk.thinking || "";
      }
    } finally {
      clearTimeout(timer);
    }
    return parseGeneratedTitle(content) || parseGeneratedTitle(thinking) || "";
  };

  try {
    let title = await ask(`${material}\n\n只输出 JSON，例如 {"title":"我在末世囤积百亿物资"}`);
    if (!title) {
      title = await ask(`${material}\n\n现在只写书名四个字到十六个字，不要其他字。`);
    }
    if (!title || isBadGeneratedTitle(title)) {
      const fallback = composeFallbackTitle(story);
      logError("storyTitle", "取书名走题材兜底", { topic, worldBase });
      return { title: fallback, error: "模型没给可用书名，已用题材兜底" };
    }
    return { title };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logError("storyTitle", "取书名请求失败", { model: creds.model, reason: msg });
    return { title: composeFallbackTitle(story), error: msg };
  }
}
