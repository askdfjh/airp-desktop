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
import { useUIStore } from "@/stores/uiStore";

const PLACEHOLDER_EXACT = new Set([
  "新冒险",
  "未命名稿纸",
  "空白会话",
  "会话",
  "未命名",
  "新故事",
]);

/** 开局占位名：某某的冒险 / 未命名稿纸 / 扮演·角色 等 */
export function isPlaceholderTitle(title: string | null | undefined): boolean {
  const t = (title || "").trim();
  if (!t) return true;
  if (PLACEHOLDER_EXACT.has(t)) return true;
  if (/的冒险$/.test(t)) return true;
  if (/^扮演[·•]/.test(t)) return true;
  if (/^未命名/.test(t)) return true;
  return false;
}

/** 从模型输出里抠出一行书名 */
export function parseGeneratedTitle(raw: string): string | null {
  let t = (raw || "").trim();
  if (!t) return null;
  const fence = t.match(/```(?:\w+)?\s*([\s\S]*?)```/);
  if (fence) t = fence[1].trim();
  try {
    const parsed = JSON.parse(t) as unknown;
    if (parsed && typeof parsed === "object" && typeof (parsed as { title?: unknown }).title === "string") {
      t = (parsed as { title: string }).title;
    } else if (typeof parsed === "string") {
      t = parsed;
    }
  } catch {
    /* 按纯文本处理 */
  }
  t = t.split(/\r?\n/).map((s) => s.trim()).find(Boolean) || "";
  t = t.replace(/^[\s"'「」『』【】《》〈〉]+|[\s"'「」『』【】《》〈〉]+$/g, "");
  t = t.replace(/^(?:书名|标题|书名是|推荐书名)[:：]\s*/, "");
  t = t.replace(/^\d+[\.、.)）]\s*/, "");
  t = t.replace(/\s+/g, "");
  if (/[。！？.!?…]$/.test(t)) t = t.slice(0, -1);
  if (t.length < 2 || t.length > 24) return null;
  if (isPlaceholderTitle(t)) return null;
  if (/^(建议|如下|可以叫)/.test(t)) return null;
  return t || null;
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
  const vols = useSessionStore.getState().sessions
    .filter((s) => s.storyId === story.id)
    .sort((a, b) => (a.chainIndex ?? 1) - (b.chainIndex ?? 1));
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
  const fm = useUIStore.getState().formatModel;
  let provider = ps.providers.find((p) => p.id === ps.activeProviderId);
  let model = ps.activeModel;
  if (fm?.mode === "custom") {
    const cp = ps.providers.find((p) => p.id === fm.providerId);
    if (cp && fm.model) {
      provider = cp;
      model = fm.model;
    }
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

  return `你是网文责编。根据素材起一个书名，只输出书名本身。

书名必须是起点/番茄常见的网文风：把身份、金手指、处境或反差一次说清，让人想点进去。
必须贴合下面素材里的具体情节与设定，禁止套用无关热门梗。

合格例（仅学句式，勿照搬）：
- 开局觉醒SSS级天赋
- 我在末世囤积百亿物资
- 离婚后，前夫他慌了
- 苟在宗门当咸鱼
- 重生那年我亲手改了命

严禁：
- XX的冒险 / XX之旅 / XX传奇 / 命运的交织 / 光与影 / 当A遇见B
- 书名号、引号、序号、副标题、解释、空行
- 翻译腔、鸡汤、诗意空标题

长度 8–18 个汉字为宜，可含逗号或「后」。只输出一行书名。

【素材】
${meta || "（无元信息）"}

${input.excerpt ? `【正文摘录】\n${clip(input.excerpt, 1600)}` : "【正文摘录】（尚少，请根据世界与题材起一个能当封面的开局书名）"}`;
}

export async function generateStoryTitle(story: Story, opts?: { allowMetaOnly?: boolean }): Promise<string | null> {
  const creds = resolveProvider();
  if (!creds) return null;

  const { excerpt, chapters } = await collectExcerpt(story);
  const topic = getTopicScheme(story.topicSchemeId)?.label;
  const worldName = story.worldBookId
    ? useWorldStore.getState().books.find((b) => b.id === story.worldBookId)?.name
    : null;
  const worldBase = WORLD_FOUNDATIONS.find((f) => f.id === story.worldBaseId)?.label;

  if (!excerpt && !opts?.allowMetaOnly) return null;
  if (!excerpt && !story.protagonistName && !topic && !worldName) return null;

  const prompt = buildTitlePrompt({
    protagonist: story.protagonistName,
    worldName,
    topic,
    worldBase,
    chapters,
    excerpt,
  });
  const messages: ApiMessage[] = [
    { role: "system", content: prompt },
    { role: "user", content: "给出书名。" },
  ];

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error("取书名超时")), 30_000);
  let out = "";
  try {
    for await (const chunk of chatStream(
      messages,
      creds.model,
      creds.baseUrl,
      creds.apiKey,
      false,
      undefined,
      controller.signal,
      { temperature: 0.85, max_tokens: 64 },
    )) {
      if (controller.signal.aborted) break;
      if (chunk.done) break;
      out += chunk.content;
      if (!chunk.content && chunk.thinking) out += chunk.thinking;
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logError("storyTitle", "取书名请求失败", { model: creds.model, reason: msg });
    return null;
  } finally {
    clearTimeout(timer);
  }

  const title = parseGeneratedTitle(out);
  if (!title) {
    logError("storyTitle", "取书名无法解析", { head: out.slice(0, 200) });
  }
  return title;
}
