export type WorldBaseId =
  | "modern"
  | "ancient"
  | "cultivation"
  | "future"
  | "otherworld"
  | "infinite"
  | "custom";

export interface WorldFoundation {
  id: WorldBaseId;
  label: string;
  description: string;
  builtinBookId?: string;
  aliases: string[];
}

export const WORLD_FOUNDATIONS: WorldFoundation[] = [
  {
    id: "modern",
    label: "现代",
    description: "现实社会、都市生活、行业与家庭关系的通用底座。",
    builtinBookId: "wb-builtin-urban",
    aliases: ["现代", "现实", "都市", "城市"],
  },
  {
    id: "ancient",
    label: "古代",
    description: "王朝、礼制、身份、家族与江湖秩序的通用底座。",
    builtinBookId: "wb-builtin-palace",
    aliases: ["古代", "宫廷", "宅斗", "古言"],
  },
  {
    id: "cultivation",
    label: "修炼",
    description: "灵气、境界、宗门、法宝与超凡因果的通用底座。",
    builtinBookId: "wb-builtin-xianxia",
    aliases: ["修仙", "仙侠", "玄幻", "修炼"],
  },
  {
    id: "future",
    label: "未来",
    description: "科技文明、星际社会、人工智能与未来生存的通用底座。",
    builtinBookId: "wb-builtin-scifi",
    aliases: ["未来", "科幻", "星际", "赛博"],
  },
  {
    id: "otherworld",
    label: "异世",
    description: "魔法、种族、王国、冒险与异文明的通用底座。",
    builtinBookId: "wb-builtin-fantasy",
    aliases: ["异世界", "奇幻", "魔法", "西幻"],
  },
  {
    id: "infinite",
    label: "无限",
    description: "副本、任务、轮回、倒计时与通关规则的通用底座。",
    builtinBookId: "wb-builtin-infinite",
    aliases: ["无限", "副本", "轮回", "任务"],
  },
  {
    id: "custom",
    label: "自定义",
    description: "由用户创建的独立世界底座。",
    aliases: ["自定义"],
  },
];

const FOUNDATION_MAP = new Map(WORLD_FOUNDATIONS.map((foundation) => [foundation.id, foundation]));

export function getWorldFoundation(id: string | null | undefined) {
  return FOUNDATION_MAP.get(id as WorldBaseId) || WORLD_FOUNDATIONS.find((foundation) => foundation.aliases.includes(id || "")) || FOUNDATION_MAP.get("custom")!;
}

export function worldFoundationLabel(id: string | null | undefined) {
  return getWorldFoundation(id).label;
}
