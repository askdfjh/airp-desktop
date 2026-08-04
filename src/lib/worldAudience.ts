import type { WorldBook } from "@/types";

export type WorldAudience = "male" | "female";
export type WorldAudienceFilter = "all" | WorldAudience;

const FEMALE_RE = /女频|女主|女性|言情|甜宠|宫廷|宫斗|宅斗|后宫|古言|现言|娱乐圈|恋爱|婚恋|重生年代|破镜重圆|先婚后爱|快穿|穿书|年代文|重生年代|契约婚姻/;
const MALE_RE = /男频|男主|男性|修仙|仙侠|玄幻|东方玄幻|都市异能|无限流|科幻|星际|民俗|悬疑|规则怪谈|冒险|战斗|争霸|升级|系统流|签到流|任务系统|高武|灵气复苏|末世|赘婿|退婚流/;

export function inferWorldBookAudience(book: WorldBook): WorldAudience | null {
  const text = [book.name, book.theme, book.description, ...book.tags].join(" ");
  if (FEMALE_RE.test(text)) return "female";
  if (MALE_RE.test(text)) return "male";
  return null;
}

export function audienceLabel(audience: WorldAudience) {
  return audience === "female" ? "女频" : "男频";
}

export function defaultPlayerNameForAudience(audience: WorldAudience | null | undefined) {
  if (audience === "female") return "女主";
  if (audience === "male") return "男主";
  return "主角";
}

export function buildProtagonistPrompt(params: {
  playerName: string;
  typedName: boolean;
  audience: WorldAudience | null | undefined;
}) {
  if (params.typedName) {
    return `【主角设定】主角名为「${params.playerName}」。请根据这个名字的性别气质、时代语境与世界设定，自然生成相对应的主角身份与称谓；不要把主角性别写反。`;
  }
  if (params.audience === "female") {
    return "【主角设定】用户没有起名。本次为女频开局，主角默认为女性，可用「女主」代称，并围绕女性主角展开身份、处境与关系。";
  }
  if (params.audience === "male") {
    return "【主角设定】用户没有起名。本次为男频开局，主角默认为男性，可用「男主」代称，并围绕男性主角展开身份、处境与成长线。";
  }
  return "【主角设定】用户没有起名，主角可用「主角」代称，并根据当前世界自然设定身份。";
}
