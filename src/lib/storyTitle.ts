import { chatStream, isThinkingModel, type ApiMessage } from "@/providers/openai";
import { getTopicScheme } from "@/lib/topicSchemes";
import { WORLD_FOUNDATIONS } from "@/lib/worldFoundations";
import { logError } from "@/lib/appLog";
import type { ProviderConfig, Story } from "@/types";
import { useProviderStore } from "@/stores/providerStore";
import { useSessionStore } from "@/stores/sessionStore";

const PLACEHOLDER_EXACT = new Set([
  "新冒险",
  "未命名稿纸",
  "空白会话",
  "会话",
  "未命名",
  "新故事",
]);

const REASONING_MARK =
  /用户现在|需要起|首先看|素材里|根据素材|根据下面|书名必须|只输出|严禁|合格例|网文责编|分析一下|所以书名|可以叫作|起末世|起一个书名/;

const PROSE_MARK =
  /因为|所以|但是|然后|首先|如果|可以|应该|需要|我们|这个|那个|素材|模型|用户/;

const TITLE_BANK: Record<string, string[]> = {
  "all-rebirth": [
    "重生之开局改天命",
    "这一世我不认命",
    "重生后我先下手为强",
    "回到命运转折前一夜",
    "重生从高考前夜开始",
    "上一世的坑这一世填",
  ],
  "all-transmigration": [
    "穿成炮灰后我先跑路",
    "醒来已是剧情牺牲品",
    "穿书后我不按原著活",
    "错位身份从今天演起",
    "原主死局我来拆",
    "穿越当夜剧情就杀到",
  ],
  "all-system": [
    "系统上线先罚我三天",
    "签到第十天古剑裂了",
    "面板弹出却先要命",
    "开局系统让我选死路",
    "新手两条路都是坑",
    "系统逼我三小时涨粉",
  ],
  "all-apocalypse": [
    "末世从停电那晚开始",
    "灾变夜我先封了整栋楼",
    "末世我有无限仓库",
    "开局一座避难所",
    "全球崩了只我有粮仓",
    "超市被抢空前我到了",
    "末世第一夜邻人砸门",
  ],
  "all-infinite": [
    "副本倒计时只剩三秒",
    "第一个副本就是必死局",
    "轮回到第七次我记住了",
    "通关奖励是一条假命",
    "无限空间点名我先死",
    "副本规则写在血里",
  ],
  "all-rules": [
    "规则怪谈从我家楼道起",
    "别在凌晨回那条短信",
    "小区公约第十三条",
    "禁止回头的那栋楼",
    "门缝里塞进来的守则",
    "今晚不要数走廊的灯",
  ],
  "all-business": [
    "开局一块田我先养鸡",
    "小农门前先挖一口井",
    "从路边摊接到第一单",
    "荒村开铺从一袋米起",
    "我在异乡种出一条街",
    "账本比刀锋更先开口",
  ],
  "all-folklore": [
    "回乡那晚河灯全灭了",
    "村里禁说的第三声鼓",
    "纸人店只在雨夜开门",
    "祖坟前多了一双新鞋",
    "宴席上少了一只碗",
    "接亲路上的旧规矩",
  ],
  "male-upgrade": [
    "从外门杂役往上爬",
    "底层开局一步一翻盘",
    "被退婚后我开始升级",
    "废灵根也能踏碎山门",
    "从被人踩到踩回去",
    "逆袭从今晚的冷眼起",
  ],
  "male-invincible": [
    "开局已无敌我装普通人",
    "全场唯我不能惹",
    "我在江湖提前满级",
    "无敌后我只想种田",
    "他们还在练我已收手",
    "开局一剑压住满座",
  ],
  "male-cautious": [
    "我在修仙界先苟三年",
    "能躲的劫我绝不硬抗",
    "开局装死活过天劫",
    "风头让给别人命留给自己",
    "我把杀机写进日记",
    "每次出村我都留后路",
  ],
  "male-behind": [
    "棋子不知棋手是我",
    "我在幕后改了剧本",
    "朝堂上的影子是我",
    "他们争锋我收残局",
    "暗处落子比刀快",
    "我让英雄自己走上台",
  ],
  "male-power": [
    "从边城夺下一枚印",
    "权柄比刀锋更干净",
    "我在朝堂先换一个人",
    "争霸从一场夜宴起",
    "印绶到手夜未央",
    "先拿人心再拿城",
  ],
  "male-career": [
    "裁员名单上没有我",
    "从实习生拿到项目章",
    "我把黑料写成方案",
    "职场开局先抢回功劳",
    "合同签署前我改了一行",
    "升职那天旧上司哑火",
  ],
  "female-entertainment": [
    "十八线开局我先解约",
    "热搜是我自己写的",
    "从替身拿到正主剧本",
    "镜头外我先撕了合同",
    "选秀夜我不当背景板",
    "黑红开局我做成正红",
  ],
  "female-palace": [
    "及笄夜我掀开了茶盏",
    "侯府账房有一只黑手",
    "侧妃位上我不认命",
    "宫宴失仪是有人做的",
    "嫁妆单被扣我连夜抄",
    "后院风波从一封信起",
  ],
  "female-romance": [
    "婚书未下我先抽身",
    "他来认亲我已出门",
    "我把旧情写成了句号",
    "婚礼前夜我换了回答",
    "这一次我不回头看他",
    "告白那天我先说再见",
  ],
  "female-era": [
    "供销社柜台后的她",
    "回城名额我自己争",
    "煤油灯下先记一笔账",
    "大院门口的第一份工",
    "粮票比情书先到",
    "那年夏天我进了厂",
  ],
  "female-career": [
    "转正名额我自己拿回",
    "项目被抢后我另起炉灶",
    "职场开局我不陪笑",
    "她把方案写成了刀",
    "离职那天我带走客户",
    "会议室里我先开口",
  ],
  "female-daily": [
    "小院春来先开一扇窗",
    "烟火里把日子过响",
    "从一碗面开始的冬天",
    "邻里长短我不接茬",
    "把日子过成自己的",
    "晴天我去市场转一圈",
  ],
  "female-change": [
    "从今天起我不内耗",
    "她把委屈还回原主",
    "改命从拒绝那杯茶起",
    "我不在旧局里耗着",
    "退一步是她自己选的",
    "这一次我先放过自己",
  ],
};

const WORLD_BANK: Record<string, string[]> = {
  modern: ["都市开局我先改剧本", "今夜城市先停电"],
  ancient: ["侯府深夜账房失窃", "边城夜印未冷"],
  cultivation: ["外门杂役拔动古剑", "宗门外的第一夜"],
  future: ["太空城停电那一夜", "义体回收站来了活物"],
  otherworld: ["零阶法师闯进法师塔", "王国悬赏点到我头上"],
  infinite: ["副本点名我先入场", "倒计时亮起我还没醒"],
};

function hashPick(pool: string[], salt: string): string {
  if (pool.length === 0) return "开局一把破剑走天下";
  let h = 2166136261;
  for (let i = 0; i < salt.length; i++) {
    h ^= salt.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return pool[(h >>> 0) % pool.length];
}

/** 开局占位名：某某的冒险 / 未命名稿纸 / 扮演·角色 / 模型推理句 */
export function isPlaceholderTitle(title: string | null | undefined): boolean {
  const t = (title || "").trim();
  if (!t) return true;
  if (PLACEHOLDER_EXACT.has(t)) return true;
  if (/的冒险$/.test(t)) return true;
  if (/^扮演[·•]/.test(t)) return true;
  if (/^未命名/.test(t)) return true;
  if (REASONING_MARK.test(t)) return true;
  if (/[。；]/.test(t)) return true;
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
  t = t.replace(/^(?:叫作|叫做|就叫|取名|命名为)\s*/, "");
  t = t.replace(/^\d+[\.、.)）]\s*/, "");
  t = t.replace(/\s+/g, "");
  if (/[。！？.!?…]$/.test(t)) t = t.slice(0, -1);
  return t;
}

export function isBadGeneratedTitle(title: string): boolean {
  const t = (title || "").trim();
  if (!t) return true;
  if (t.length < 4 || t.length > 16) return true;
  if (isPlaceholderTitle(t)) return true;
  if (REASONING_MARK.test(t)) return true;
  if (/[。！？!?…，、；;：:]/.test(t)) return true;
  if (PROSE_MARK.test(t)) return true;
  if (/^(建议|如下|好的|当然|书名|标题|嗯|哦)/.test(t)) return true;
  if (/(的书名|这本书|起名|取名|命名)$/.test(t)) return true;
  if (!/[\u4e00-\u9fff]/.test(t)) return true;
  const han = (t.match(/[\u4e00-\u9fff]/g) || []).length;
  if (han < 4) return true;
  return false;
}

function quotedTitle(text: string): string | null {
  const matches = [...text.matchAll(/[《「『【]([^》」』】]{4,16})[》」』】]/g)];
  for (let i = matches.length - 1; i >= 0; i--) {
    const t = polishTitleLine(matches[i][1]);
    if (t && !isBadGeneratedTitle(t)) return t;
  }
  return null;
}

function titledByCue(text: string): string | null {
  const cues =
    /(?:书名|标题|叫作|叫做|就叫|取名|命名为|推荐)\s*[:：是为]?\s*[「『《"']?([\u4e00-\u9fffA-Za-z0-9]{4,16})/;
  const matches = [...text.matchAll(new RegExp(cues, "g"))];
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

/** 从模型输出里抠书名。推理句丢掉，只留像封面的短句。 */
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
  const cued = titledByCue(t);
  if (cued) return cued;
  const lines = t.split(/\r?\n/).map((s) => polishTitleLine(s)).filter(Boolean);
  const good = lines.filter((c) => !isBadGeneratedTitle(c));
  if (good.length) return good[good.length - 1];
  const compact = polishTitleLine(t);
  if (compact && !isBadGeneratedTitle(compact)) return compact;
  return null;
}

function namedTitles(name: string, topicId: string | null | undefined): string[] {
  const n = (name || "").replace(/\s+/g, "");
  if (!n || n === "主角" || n.length > 4) return [];
  const byTopic: Record<string, string[]> = {
    "all-apocalypse": [`${n}的末世囤货路`, `末世里的${n}先封楼`],
    "all-rebirth": [`${n}重生不认命`, `${n}回到转折前`],
    "all-transmigration": [`穿成${n}后先跑路`, `${n}不按原著活`],
    "all-system": [`${n}的系统先罚人`, `${n}签到古剑裂了`],
    "all-infinite": [`${n}的副本倒计时`, `${n}第七次轮回`],
    "all-rules": [`${n}别回那条短信`, `${n}的楼道守则`],
    "female-palace": [`${n}掀开了茶盏`, `${n}连夜抄嫁妆`],
    "female-entertainment": [`${n}先撕了合同`, `${n}不当背景板`],
  };
  const extra = byTopic[topicId || ""] || [`${n}的开局不按常理`, `${n}从今天开始翻盘`];
  return extra.filter((t) => t.length >= 4 && t.length <= 16 && !isBadGeneratedTitle(t));
}

export function composeLocalTitle(story: Story, avoid?: string): string {
  const topicId = story.topicSchemeId || "";
  const topic = getTopicScheme(topicId);
  const world = WORLD_FOUNDATIONS.find((f) => f.id === story.worldBaseId);
  const pool = [
    ...(TITLE_BANK[topicId] || []),
    ...(world ? WORLD_BANK[world.id] || [] : []),
    ...namedTitles(story.protagonistName || "", topicId),
  ].filter((t, i, arr) => arr.indexOf(t) === i && t !== avoid && t !== story.title && !isBadGeneratedTitle(t));

  if (pool.length === 0) {
    const genre = topic?.label?.replace(/\s*\/\s*/g, "") || world?.label || "";
    const name = (story.protagonistName || "").replace(/\s+/g, "");
    const last: string[] = [];
    if (genre) last.push(`${genre}开局先翻盘`.slice(0, 16));
    if (name && name !== "主角" && name.length <= 4) last.push(`${name}开局就翻盘`);
    last.push("开局一把破剑走天下");
    const ok = last.filter((t) => t !== avoid && t !== story.title && !isBadGeneratedTitle(t));
    return ok[0] || last[0];
  }
  const salt = `${story.id}:${Date.now()}:${Math.random()}`;
  return hashPick(pool, salt);
}

/** @deprecated 用 composeLocalTitle */
export function composeFallbackTitle(story: Story): string {
  return composeLocalTitle(story);
}

function pickTitleModel(provider: ProviderConfig, preferred: string): string {
  const listed = provider.models || [];
  const marked = new Set((provider.thinkingModels || []).map((m) => m.toLowerCase()));
  const think = (m: string) => marked.has(m.toLowerCase()) || isThinkingModel(m);
  if (preferred && !think(preferred)) return preferred;
  const non = listed.find((m) => !think(m));
  return non || preferred;
}

function resolveProvider(): { baseUrl: string; apiKey: string; model: string } | null {
  const ps = useProviderStore.getState();
  const session = useSessionStore.getState();
  const active = session.activeId ? session.sessions.find((s) => s.id === session.activeId) : null;

  const tried = new Set<string>();
  const ok = (pid?: string | null, model?: string | null) => {
    if (!pid || tried.has(pid)) return null;
    tried.add(pid);
    const provider = ps.providers.find((p) => p.id === pid);
    if (!provider || !provider.baseUrl || !provider.apiKey?.trim()) return null;
    if (ps.enabledProviders[provider.id] === false) return null;
    const m = model || ps.activeModel || provider.models[0];
    if (!m) return null;
    return { baseUrl: provider.baseUrl, apiKey: provider.apiKey, model: pickTitleModel(provider, m) };
  };

  return (
    ok(active?.providerId, active?.model) ||
    ok(ps.activeProviderId, ps.activeModel) ||
    ps.providers.map((p) => ok(p.id, p.models[0])).find(Boolean) ||
    null
  );
}

async function postComplete(url: string, apiKey: string, body: unknown): Promise<string> {
  const payload = JSON.stringify(body);
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    return await invoke<string>("http_fetch", {
      url,
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: payload,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/HTTP 4\d\d|unknown|unsupported|not supported|invalid argument/i.test(msg)) throw e;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: payload,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
    return await res.text();
  }
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("取书名超时")), ms);
    p.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e); },
    );
  });
}

async function askModelTitle(creds: { baseUrl: string; apiKey: string; model: string }, hint: string): Promise<string> {
  const url = `${creds.baseUrl.replace(/\/+$/, "")}/chat/completions`;
  const messages = [
    { role: "system", content: "只输出一个网文书名，一行，四到十六个汉字。不要解释，不要分析。" },
    { role: "user", content: hint },
  ];
  const bodies: Record<string, unknown>[] = [
    { model: creds.model, stream: false, temperature: 0.9, max_tokens: 128, enable_thinking: false, thinking: { type: "disabled" }, messages },
    { model: creds.model, stream: false, temperature: 0.9, max_tokens: 128, messages },
  ];
  let last = "";
  for (const body of bodies) {
    try {
      const raw = await withTimeout(postComplete(url, creds.apiKey, body), 12_000);
      const data = JSON.parse(raw) as {
        choices?: Array<{ message?: { content?: string; reasoning_content?: string; reasoning?: string } }>;
      };
      const msg = data.choices?.[0]?.message ?? {};
      const text = [msg.content, msg.reasoning_content, msg.reasoning].filter((x) => typeof x === "string").join("\n");
      const title = parseGeneratedTitle(text);
      if (title) return title;
      last = text;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      last = msg;
      if (!/400|unknown|unsupported|not supported|invalid|Unrecognized/i.test(msg)) throw e;
    }
  }

  // 非流失败再试一次极短流，给只支持 stream 的中转
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  let content = "";
  let thinking = "";
  try {
    for await (const chunk of chatStream(
      messages as ApiMessage[],
      creds.model,
      creds.baseUrl,
      creds.apiKey,
      false,
      undefined,
      controller.signal,
      { temperature: 0.9, max_tokens: 128 },
    )) {
      if (controller.signal.aborted) break;
      if (chunk.done) break;
      content += chunk.content || "";
      thinking += chunk.thinking || "";
    }
  } finally {
    clearTimeout(timer);
  }
  return parseGeneratedTitle(content) || parseGeneratedTitle(thinking) || parseGeneratedTitle(last) || "";
}

async function draftContentHint(storyId: string): Promise<string> {
  try {
    const { useSessionStore } = await import("@/stores/sessionStore");
    const { loadMessages } = await import("./db");
    const sessions = useSessionStore.getState().sessions.filter((s) => s.storyId === storyId);
    const texts: string[] = [];
    for (const s of sessions.slice(0, 2)) {
      const msgs = await loadMessages(s.id);
      for (const m of msgs) {
        if (m.opening) continue;
        const t = (m.content || "").trim();
        if (t) texts.push(t);
        if (texts.join("").length > 240) break;
      }
    }
    const blob = texts.join(" ").replace(/\s+/g, " ").trim().slice(0, 240);
    return blob ? `根据这段文字起一个四到十字的短书名，不要网文金手指套路：${blob}` : "";
  } catch {
    return "";
  }
}

export async function generateStoryTitle(
  story: Story,
  opts?: { allowMetaOnly?: boolean; avoid?: string },
): Promise<{ title: string; error?: string }> {
  const local = story.kind === "blank" ? "" : composeLocalTitle(story, opts?.avoid || story.title);
  const creds = resolveProvider();
  if (!creds) return { title: local };

  let hint = "";
  if (story.kind === "blank") {
    hint = await draftContentHint(story.id);
    if (!hint) return { title: "" };
  } else {
    const topic = getTopicScheme(story.topicSchemeId)?.label?.replace(/\s*\/\s*/g, "") || "";
    const world = WORLD_FOUNDATIONS.find((f) => f.id === story.worldBaseId)?.label || "";
    const name = (story.protagonistName || "").replace(/\s+/g, "");
    hint = [topic, world, name && name !== "主角" ? `主角${name}` : ""].filter(Boolean).join(" ") || "网文开局";
  }

  try {
    const title = await askModelTitle(creds, hint);
    if (title && !isBadGeneratedTitle(title) && title !== story.title) return { title };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logError("storyTitle", "取书名请求失败，改用本地书名", { model: creds.model, reason: msg });
  }
  return { title: local };
}
