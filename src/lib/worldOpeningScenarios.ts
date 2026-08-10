import type { WorldBook, WorldBookEntry } from "@/types";
import type { OpeningScenario } from "@/stores/onboardingStore";function compact(s: string | undefined | null, fallback = "") {
  return (s || "").replace(/\s+/g, " ").trim() || fallback;
}

function clip(s: string, max = 120) {
  const text = compact(s);
  return text.length > max ? text.slice(0, max) + "..." : text;
}

function scenarioId(bookId: string, suffix: string) {
  return `worldbook:${bookId}:${suffix}`;
}

function pickEntry(entries: WorldBookEntry[], patterns: RegExp[], fallbackIndex: number) {
  return (
    entries.find((e) => patterns.some((re) => re.test(`${e.category} ${e.title} ${e.content}`))) ||
    entries[fallbackIndex] ||
    entries[0]
  );
}

function entryLabel(entry: WorldBookEntry | undefined, fallback: string) {
  return compact(entry?.title, fallback);
}

function entryText(entry: WorldBookEntry | undefined, fallback: string) {
  return clip(entry?.content || entry?.title || fallback, 140);
}

function keywords(book: WorldBook, extra: string[]) {
  const values = [...book.tags, book.theme, ...extra]
    .map((v) => compact(v))
    .filter(Boolean);
  return Array.from(new Set(values)).slice(0, 3);
}

function template(params: {
  worldName: string;
  worldDesc: string;
  sceneName: string;
  sceneFocus: string;
}) {
  return (
    `你正在写一部发生在「${params.worldName}」的沉浸式故事。\n` +
    `世界简介：${params.worldDesc}\n` +
    `当前开局：${params.sceneName}。\n` +
    `开局核心：${params.sceneFocus}\n` +
    "请严格遵守已启用的规则书设定，围绕{characterName}展开，描写场景、人物反应、冲突张力与可继续行动的余地。"
  );
}

function opening(params: {
  worldName: string;
  sceneName: string;
  sceneFocus: string;
}) {
  return (
    `请以「${params.worldName}」为舞台，从「${params.sceneName}」开局。` +
    `开局要围绕：${params.sceneFocus}。` +
    "我是{characterName}，请直接开始故事。"
  );
}

export function buildWorldOpeningScenarios(book: WorldBook): OpeningScenario[] {
  const worldName = compact(book.name, "自定义世界");
  const worldDesc = clip(book.description || book.theme || "这个世界的规则与势力由规则书条目定义。", 160);
  const entries = book.entries.filter((e) => !e.disable && compact(e.title) && compact(e.content));

  const place = pickEntry(entries, [/地点|地域|城市|城|村|山|海|星|区域|势力范围|场所|空间/], 0);
  const force = pickEntry(entries, [/势力|组织|门派|家族|阵营|公司|王朝|帝国|联盟|人物|NPC|角色/], 1);
  const rule = pickEntry(entries, [/规则|法则|体系|能力|禁忌|危机|冲突|主线|灾难|秘密|历史|事件/], 2);

  const placeName = entryLabel(place, worldName);
  const forceName = entryLabel(force, "暗流初现");
  const ruleName = entryLabel(rule, "命运转折");

  const arrivalFocus = entryText(place, `主角第一次踏入「${worldName}」的关键地点，并被卷入这个世界的第一场波澜。`);
  const disturbanceFocus = entryText(force, `围绕「${forceName}」出现异动，主角被迫面对势力、人物或组织带来的选择。`);
  const crossroadFocus = entryText(rule, `世界核心规则、禁忌或主线矛盾开始显露，主角站到命运的岔路口。`);

  return [
    {
      id: scenarioId(book.id, "arrival"),
      name: `初入${worldName}`,
      description: `从「${placeName}」切入，建立世界氛围与第一场事件`,
      keywords: keywords(book, ["初入", "探索", placeName]),
      theme: book.id,
      systemPromptTemplate: template({
        worldName,
        worldDesc,
        sceneName: `初入${worldName}`,
        sceneFocus: arrivalFocus,
      }),
      openingMessage: opening({
        worldName,
        sceneName: `初入${worldName}`,
        sceneFocus: arrivalFocus,
      }),
    },
    {
      id: scenarioId(book.id, "disturbance"),
      name: `${forceName}异动`,
      description: `围绕「${forceName}」制造一次有张力的遭遇或风波`,
      keywords: keywords(book, ["异动", "冲突", forceName]),
      theme: book.id,
      systemPromptTemplate: template({
        worldName,
        worldDesc,
        sceneName: `${forceName}异动`,
        sceneFocus: disturbanceFocus,
      }),
      openingMessage: opening({
        worldName,
        sceneName: `${forceName}异动`,
        sceneFocus: disturbanceFocus,
      }),
    },
    {
      id: scenarioId(book.id, "crossroad"),
      name: "命运交汇",
      description: `让「${ruleName}」成为主角卷入主线的契机`,
      keywords: keywords(book, ["主线", "抉择", ruleName]),
      theme: book.id,
      systemPromptTemplate: template({
        worldName,
        worldDesc,
        sceneName: "命运交汇",
        sceneFocus: crossroadFocus,
      }),
      openingMessage: opening({
        worldName,
        sceneName: "命运交汇",
        sceneFocus: crossroadFocus,
      }),
    },
  ];
}

export function getWorldOpeningScenario(book: WorldBook | null | undefined, id: string | null | undefined) {
  if (!book || !id) return undefined;
  return buildWorldOpeningScenarios(book).find((s) => s.id === id);
}

/**
 * 自定义规则书的开局池：优先 AI 生成的开局种子（customOpenings），
 * 没有时兜底用规则书条目自动提取的 3 个开局（buildWorldOpeningScenarios）。
 */
export function getCustomBookOpeningScenarios(book: WorldBook | null | undefined): OpeningScenario[] {
  if (!book) return [];
  const custom = (book.customOpenings || []).filter((o) => o.name && o.focus);
  if (custom.length > 0) {
    const worldName = compact(book.name, "自定义世界");
    const worldDesc = clip(book.description || book.theme || "这个世界的规则与势力由规则书条目定义。", 160);
    return custom.map((o, i) => ({
      id: `customopen:${book.id}:${i}`,
      name: o.name,
      description: o.focus,
      keywords: keywords(book, (o.tags || []).concat([o.name])),
      theme: book.id,
      systemPromptTemplate: template({
        worldName,
        worldDesc,
        sceneName: o.name,
        sceneFocus: o.focus,
      }),
      openingMessage: opening({
        worldName,
        sceneName: o.name,
        sceneFocus: o.focus,
      }),
    }));
  }
  return buildWorldOpeningScenarios(book);
}

export function getCustomBookOpeningScenario(book: WorldBook | null | undefined, id: string | null | undefined) {
  if (!book || !id) return undefined;
  return getCustomBookOpeningScenarios(book).find((s) => s.id === id);
}
