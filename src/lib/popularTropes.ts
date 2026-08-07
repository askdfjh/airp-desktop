import type { WorldAudience } from "@/lib/worldAudience";

export type WorldviewId =
  | "modern"
  | "cultivation"
  | "fantasy"
  | "urban"
  | "infinite"
  | "scifi"
  | "apocalypse"
  | "folklore"
  | "rulehorror"
  | "palace"
  | "zhaidou"
  | "retro"
  | "romance"
  | "entertainment"
  | "custom";

export type TropeCategory = "通用热门" | "男频高频" | "女频高频";

export type HotTropeId =
  | "none"
  | "system"
  | "reincarnation"
  | "transmigration"
  | "upgrade"
  | "infinite"
  | "apocalypse"
  | "rules"
  | "comeback"
  | "marriage"
  | "business"
  | "entertainment"
  | "palace"
  | "era"
  | "sweet";

export interface HotTrope {
  id: HotTropeId;
  label: string;
  category: TropeCategory;
  hook: string;
  rule: string;
  audiences: Array<WorldAudience | "all">;
  compatibleWorldviews: WorldviewId[];
  keywords: RegExp[];
}

export const WORLDVIEW_LABELS: Record<WorldviewId, string> = {
  modern: "现代都市",
  cultivation: "修炼体系",
  fantasy: "玄幻大陆",
  urban: "现代都市",
  infinite: "副本空间",
  scifi: "科幻星际",
  apocalypse: "末世求生",
  folklore: "民俗悬疑",
  rulehorror: "规则怪谈",
  palace: "古代宫廷",
  zhaidou: "古代宅门",
  retro: "年代生活",
  romance: "现代情感",
  entertainment: "现代娱乐",
  custom: "自定义",
};

export const HOT_TROPES: HotTrope[] = [
  {
    id: "system",
    label: "系统流",
    category: "通用热门",
    hook: "第一章出现系统面板、任务、奖励与代价。",
    rule: "系统只能作为推进剧情的工具，不要替代世界原本的力量体系；奖励要有代价或限制。",
    audiences: ["all"],
    compatibleWorldviews: ["modern", "cultivation", "fantasy", "urban", "infinite", "scifi", "apocalypse", "folklore", "retro", "entertainment", "custom"],
    keywords: [/系统流|签到流|任务系统|系统提示|开局系统|打卡系统|成就面板|面板/],
  },
  {
    id: "reincarnation",
    label: "重生 / 回档",
    category: "通用热门",
    hook: "主角回到命运转折点，带着记忆抢先改命。",
    rule: "前世记忆只提供信息差，不直接破坏世界规则；第一章要给出明确的改命目标。",
    audiences: ["all"],
    compatibleWorldviews: ["modern", "cultivation", "fantasy", "urban", "apocalypse", "folklore", "palace", "zhaidou", "retro", "romance", "entertainment", "custom"],
    keywords: [/重生|回档|回到.*年|再活一次|逆转人生|改命/],
  },
  {
    id: "transmigration",
    label: "穿越 / 穿书",
    category: "通用热门",
    hook: "主角醒来进入新身份，立刻面对身份危机或原剧情节点。",
    rule: "不要引用具体作品、人物或原书名；只保留“错位身份”和“剧情节点”的抽象结构。",
    audiences: ["all"],
    compatibleWorldviews: ["modern", "cultivation", "fantasy", "urban", "scifi", "apocalypse", "palace", "zhaidou", "retro", "romance", "entertainment", "custom"],
    keywords: [/穿书|穿越|穿到|穿成|路人甲|炮灰|反派自救|新身份/],
  },
  {
    id: "infinite",
    label: "无限 / 副本",
    category: "通用热门",
    hook: "副本、任务、倒计时和陌生队友同时出现。",
    rule: "副本规则必须清晰可验证；不要把副本设定写成某个已有作品的复刻。",
    audiences: ["all"],
    compatibleWorldviews: ["modern", "infinite", "urban", "apocalypse", "folklore", "rulehorror", "scifi", "custom"],
    keywords: [/无限流|副本|轮回者|通关|任务面板|倒计时/],
  },
  {
    id: "apocalypse",
    label: "末世求生",
    category: "通用热门",
    hook: "灾变初夜、物资争夺、避难所选择或队伍分裂。",
    rule: "先写生存压力，再写能力优势；物资、地点和队友关系要具体。",
    audiences: ["all"],
    compatibleWorldviews: ["modern", "urban", "cultivation", "scifi", "apocalypse", "infinite", "rulehorror", "custom"],
    keywords: [/末世|丧尸|天灾|求生|避难所|灾变|物资/],
  },
  {
    id: "rules",
    label: "规则怪谈",
    category: "通用热门",
    hook: "纸条、禁忌、异常现象与第一次试探。",
    rule: "规则要服务当前世界观，避免直接套用具体作品的名词、组织、仪式或人物。",
    audiences: ["all"],
    compatibleWorldviews: ["modern", "rulehorror", "folklore", "urban", "infinite", "apocalypse", "custom"],
    keywords: [/规则怪谈|规则|禁忌|纸条|怪谈|诡异守则/],
  },
  {
    id: "upgrade",
    label: "升级流 / 高武",
    category: "男频高频",
    hook: "资质测试、灵气复苏、战力面板或第一场越级挑战。",
    rule: "升级路径要和世界力量体系一致，第一章只给短期目标，不要一步封顶。",
    audiences: ["male"],
    compatibleWorldviews: ["modern", "cultivation", "fantasy", "urban", "infinite", "scifi", "apocalypse", "custom"],
    keywords: [/高武|武道|灵气复苏|升级流|战力|觉醒|资质测试|修炼等级/],
  },
  {
    id: "comeback",
    label: "退婚 / 逆袭",
    category: "男频高频",
    hook: "被轻视、被退婚、被逐出或被当众羞辱后，第一步反击。",
    rule: "重点写压迫、目标和反击节奏；不要把人物关系写成具体书的桥段。",
    audiences: ["male"],
    compatibleWorldviews: ["modern", "cultivation", "fantasy", "urban", "palace", "custom"],
    keywords: [/退婚流|退婚|逆袭|废柴|被逐出|当众羞辱|赘婿|战神回归/],
  },
  {
    id: "business",
    label: "经营 / 基建",
    category: "男频高频",
    hook: "开局一间店、一块地、一座领地或一个濒危组织。",
    rule: "经营目标要具体，第一位客人、第一笔订单或第一场危机要马上出现。",
    audiences: ["male", "female"],
    compatibleWorldviews: ["modern", "cultivation", "fantasy", "urban", "scifi", "retro", "palace", "zhaidou", "custom"],
    keywords: [/经营|基建|开店|店铺|领地|工坊|种田|发家致富/],
  },
  {
    id: "marriage",
    label: "先婚后爱",
    category: "女频高频",
    hook: "协议、领证、同居、公开场合和关系误判。",
    rule: "感情推进要靠冲突和相处，不要直接跳到无条件宠爱。",
    audiences: ["female"],
    compatibleWorldviews: ["modern", "romance", "urban", "palace", "zhaidou", "custom"],
    keywords: [/先婚后爱|契约婚姻|协议婚姻|闪婚|婚后|联姻/],
  },
  {
    id: "palace",
    label: "宫斗 / 宅斗",
    category: "女频高频",
    hook: "入宫入府、请安、掌家、选秀或第一场礼貌试探。",
    rule: "冲突来自制度、身份和利益，不要把宅斗写成单纯吵架。",
    audiences: ["female"],
    compatibleWorldviews: ["palace", "zhaidou", "cultivation", "fantasy", "custom"],
    keywords: [/宫斗|宅斗|古言|选秀|后宅|入宫|请安|掌家/],
  },
  {
    id: "era",
    label: "年代 / 种田",
    category: "女频高频",
    hook: "回到旧年代，家庭风波、第一桶金和生活改善同时展开。",
    rule: "时代细节要具体，爽点来自选择、手艺、资源调配和关系修复。",
    audiences: ["female", "male"],
    compatibleWorldviews: ["modern", "retro", "urban", "custom"],
    keywords: [/年代文|重生年代|八零|七零|六零|下乡|赶山|赶海/],
  },
  {
    id: "entertainment",
    label: "热搜 / 娱乐圈",
    category: "女频高频",
    hook: "热搜、片场、选秀、经纪人、公关危机或翻红机会。",
    rule: "行业事件要具体，主角要有可展示的能力或选择，而不只是被动挨骂。",
    audiences: ["female"],
    compatibleWorldviews: ["modern", "entertainment", "romance", "urban", "custom"],
    keywords: [/娱乐圈|选秀|热搜|片场|经纪人|明星|公关危机/],
  },
  {
    id: "sweet",
    label: "甜宠 / 治愈",
    category: "女频高频",
    hook: "温暖相遇、误会解除、共同生活或互相救场。",
    rule: "甜感来自行动细节和关系递进，避免无缘由的单向宠溺。",
    audiences: ["female"],
    compatibleWorldviews: ["modern", "romance", "retro", "zhaidou", "palace", "custom"],
    keywords: [/甜宠|治愈|双向奔赴|破镜重圆|久别重逢|日常/],
  },
];

export function resolveWorldviewId(id: string | null | undefined): WorldviewId {
  if (!id) return "custom";
  const alias: Record<string, WorldviewId> = {
    "修仙/仙侠": "cultivation",
    仙侠: "cultivation",
    修仙: "cultivation",
    玄幻: "fantasy",
    东方玄幻: "fantasy",
     都市: "urban",
     现代都市: "modern",
     "现代都市·异能": "urban",
    无限流: "infinite",
    副本: "infinite",
    科幻: "scifi",
    星际: "scifi",
    末日求生: "apocalypse",
    末世求生: "apocalypse",
    民俗悬疑: "folklore",
    规则怪谈: "rulehorror",
    "古代·宫廷": "palace",
    宫廷: "palace",
    古言宅斗: "zhaidou",
    宅斗: "zhaidou",
    重生年代: "retro",
    年代: "retro",
    现代言情: "romance",
    "现代都市·甜宠": "romance",
    "现代都市·娱乐圈": "entertainment",
    娱乐圈: "entertainment",
  };
  if (alias[id]) return alias[id];
  return (Object.prototype.hasOwnProperty.call(WORLDVIEW_LABELS, id) ? id : "custom") as WorldviewId;
}

export function worldviewLabelForId(id: string | null | undefined) {
  return WORLDVIEW_LABELS[resolveWorldviewId(id)];
}

export const TROPE_DEFAULT_WORLDVIEW: Record<Exclude<HotTropeId, "none">, WorldviewId> = {
  system: "cultivation",
  reincarnation: "retro",
  transmigration: "palace",
  upgrade: "cultivation",
  infinite: "infinite",
  apocalypse: "apocalypse",
  rules: "rulehorror",
  comeback: "cultivation",
  business: "urban",
  marriage: "romance",
  palace: "palace",
  era: "retro",
  entertainment: "entertainment",
  sweet: "romance",
};

export function defaultWorldviewForTrope(id: HotTropeId | string | null | undefined): WorldviewId {
  const trope = getTropeById(id);
  if (!trope || trope.id === "none") return "custom";
  return TROPE_DEFAULT_WORLDVIEW[trope.id as Exclude<HotTropeId, "none">] || trope.compatibleWorldviews[0] || "custom";
}

export interface StarterTopicOption {
  id: string;
  label: string;
  tropeId: Exclude<HotTropeId, "none">;
  worldviewId: WorldviewId;
  description: string;
}

export const STARTER_TOPIC_OPTIONS: StarterTopicOption[] = [
  {
    id: "cultivation-system",
    label: "系统修仙",
    tropeId: "system",
    worldviewId: "cultivation",
    description: "修仙世界为底座，系统只负责推动任务、奖励和代价。",
  },
  {
    id: "cultivation-comeback",
    label: "退婚逆袭",
    tropeId: "comeback",
    worldviewId: "cultivation",
    description: "修仙/玄幻底座下的羞辱、退婚、反击和成长线。",
  },
  {
    id: "urban-apocalypse",
    label: "现实末世求生",
    tropeId: "apocalypse",
    worldviewId: "apocalypse",
    description: "现实城市或近未来社会崩塌后的物资、避难与队伍选择。",
  },
  {
    id: "cultivation-apocalypse",
    label: "修仙末世求生",
    tropeId: "apocalypse",
    worldviewId: "cultivation",
    description: "修仙世界遭遇灵气灾变、魔潮或宗门秩序崩塌后的求生。",
  },
  {
    id: "retro-rebirth",
    label: "重生年代",
    tropeId: "reincarnation",
    worldviewId: "retro",
    description: "重生到七八十年代，围绕家庭、资源和命运改写展开。",
  },
  {
    id: "palace-rebirth",
    label: "重生古代",
    tropeId: "reincarnation",
    worldviewId: "palace",
    description: "重生到古代宫廷/权力结构中，用记忆差改写命运。",
  },
  {
    id: "infinite-instance",
    label: "无限副本",
    tropeId: "infinite",
    worldviewId: "infinite",
    description: "副本、任务、倒计时和通关规则共同推动第一幕。",
  },
  {
    id: "rule-horror",
    label: "规则怪谈",
    tropeId: "rules",
    worldviewId: "rulehorror",
    description: "围绕禁忌、纸条、异常规则和第一次试探开局。",
  },
  {
    id: "entertainment-hotsearch",
    label: "娱乐圈热搜",
    tropeId: "entertainment",
    worldviewId: "entertainment",
    description: "娱乐圈行业规则下的热搜、片场、选秀或公关危机。",
  },
  {
    id: "romance-marriage",
    label: "现代先婚后爱",
    tropeId: "marriage",
    worldviewId: "romance",
    description: "现代情感底座下的协议、误会、相处和关系推进。",
  },
  {
    id: "palace-intrigue",
    label: "宫廷宅斗",
    tropeId: "palace",
    worldviewId: "palace",
    description: "古代制度、身份与利益结构下的权谋和生存。",
  },
  {
    id: "urban-business",
    label: "经营基建",
    tropeId: "business",
    worldviewId: "urban",
    description: "现实/都市底座下，从店铺、组织或据点经营切入。",
  },
];

function matchAudience(trope: HotTrope, audience: WorldAudience | null | undefined) {
  return trope.audiences.includes("all") || (audience ? trope.audiences.includes(audience) : true);
}

function uniqueTropes(tropes: HotTrope[]) {
  const seen = new Set<string>();
  return tropes.filter((trope) => {
    if (seen.has(trope.id)) return false;
    seen.add(trope.id);
    return true;
  });
}

export function getHotTropes(audience: WorldAudience | null | undefined) {
  return HOT_TROPES.filter((trope) => matchAudience(trope, audience));
}

export function getTropeById(id: HotTropeId | string | null | undefined) {
  return HOT_TROPES.find((trope) => trope.id === id) || null;
}

export function detectHotTropes(text: string, audience: WorldAudience | null | undefined) {
  const target = text.replace(/\s+/g, "");
  return getHotTropes(audience).filter((trope) => trope.keywords.some((re) => re.test(target)));
}

export function isTropeCompatibleWithWorldview(
  trope: HotTrope,
  worldviewId: string | null | undefined,
) {
  return trope.compatibleWorldviews.includes(resolveWorldviewId(worldviewId));
}

export function getCompatibleTropes(params: {
  worldviewId?: string | null;
  audience?: WorldAudience | null;
  worldText?: string;
}) {
  const worldviewId = resolveWorldviewId(params.worldviewId);
  const compatible = getHotTropes(params.audience).filter((trope) => trope.compatibleWorldviews.includes(worldviewId));
  const detected = params.worldText
    ? detectHotTropes(params.worldText, params.audience).filter((trope) => trope.compatibleWorldviews.includes(worldviewId))
    : [];
  const pool = uniqueTropes([...detected, ...compatible]);
  return pool;
}

export function pickDeterministicTrope(params: {
  worldviewId?: string | null;
  audience?: WorldAudience | null;
  worldName: string;
  worldText?: string;
}) {
  const pool = getCompatibleTropes(params);
  if (pool.length === 0) return null;
  const signature = params.worldName
    .split("")
    .reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  return pool[signature % pool.length];
}

export function buildTropeSystemPrompt(params: {
  tropeId: HotTropeId | string | null | undefined;
  worldviewId?: string | null;
}) {
  const trope = getTropeById(params.tropeId);
  if (!trope) return "";
  const worldview = worldviewLabelForId(params.worldviewId);
  return (
    `【题材方向】本次采用「${trope.label}」作为叙事引擎。规则书仅提供世界基础规则与舞台；题材规则是本故事引擎，二者冲突时以题材规则为准，题材可覆盖规则书条目（世界名为「${worldview}」）。\n` +
    `第一钩子：${trope.hook}\n` +
    `执行规则：${trope.rule}\n` +
    "不要引用、复刻或暗示任何具体小说、影视、游戏的书名、人名、组织名、专有名词或标志性桥段。"
  );
}

export function buildTropeOpeningDirective(params: {
  tropeId: HotTropeId | string | null | undefined;
  worldviewId?: string | null;
}) {
  const trope = getTropeById(params.tropeId);
  if (!trope) return "";
  const worldview = worldviewLabelForId(params.worldviewId);
  return (
    `\n\n【开局题材校准】本次开局不要只按世界观随机出场景，而要把「${trope.label}」作为叙事引擎嵌入第一幕；` +
    `世界基础规则仅作舞台（世界名「${worldview}」），与题材规则冲突时以题材规则为准。第一处事件钩子请围绕：${trope.hook}` +
    "不要出现任何具体作品名、角色名、组织名或专有设定。"
  );
}

export function buildHotTropeHint(params: {
  audience: WorldAudience | null | undefined;
  worldName: string;
  worldviewId?: string | null;
  tropeId?: HotTropeId | string | null;
}) {
  const selected = getTropeById(params.tropeId);
  if (selected) {
    return buildTropeSystemPrompt({ tropeId: selected.id, worldviewId: params.worldviewId });
  }

  const picks = getCompatibleTropes({ worldviewId: params.worldviewId, audience: params.audience })
    .slice(0, 3);
  return (
    `【题材方向】可从这些热门题材中抽象借用其叙事引擎：${picks.map((t) => t.label).join("、")}。\n` +
    `只借用“开局钩子/节奏/冲突结构”，不要出现任何具体作品名称、人物、组织或专有设定。`
  );
}
