import type { WorldBook } from "@/types";
import type { WorldBaseId } from "@/lib/worldFoundations";

const BASE_PATTERNS: { id: WorldBaseId; re: RegExp }[] = [
  { id: "modern", re: /现代|都市|职场|校园|现实|高考|裁员|创业|直播|综艺|娱乐圈|网红|合租|地铁|外卖|快递|工厂|甜品|花店|咖啡|医院|白领|相亲|结婚/ },
  { id: "ancient", re: /古代|王朝|宫廷|宫斗|宅斗|王府|侯府|科举|镖局|绣坊|当铺|绸缎|药铺|祠堂|花轿|请安|嫡|庶|和离|纳妾|古言/ },
  { id: "cultivation", re: /修仙|仙侠|修真|宗门|灵根|灵气|渡劫|丹炉|法宝|灵石|秘境|尸潮|道观|剑修|灵田|丹药|洞府|修士|师门/ },
  { id: "future", re: /未来|科幻|星际|太空|飞船|星舰|义体|克隆|赛博|人工智能|机器人|基因|AI|机械|宇宙/ },
  { id: "otherworld", re: /异世界|异世|西幻|魔法|魔导|法师|骑士|王国|精灵|兽人|龙族|魔药|炼金|勇者|学院|佣兵|悬赏/ },
  { id: "infinite", re: /无限流|副本|轮回|主神|倒计时|任务空间|通关|玩家/ },
];

export function matchBaseByText(text: string | null | undefined): WorldBaseId | null {
  if (!text) return null;
  const clean = text.replace(/\s+/g, "");
  let best: { id: WorldBaseId; count: number } | null = null;
  for (const p of BASE_PATTERNS) {
    const count = (clean.match(new RegExp(p.re.source, "g")) || []).length;
    if (count > 0 && (!best || count > best.count)) {
      best = { id: p.id, count };
    }
  }
  return best ? best.id : null;
}

export function isValidWorldBaseId(id: string | null | undefined): id is WorldBaseId {
  return !!id && BASE_PATTERNS.some((p) => p.id === id) || id === "custom";
}

/** 规则书 → 世界底座：优先 AI 匹配结果（worldBaseId），否则按文本关键词推断，兜底 custom */
export function inferWorldBase(book: Pick<WorldBook, "worldBaseId" | "name" | "theme" | "description" | "tags"> | null | undefined): WorldBaseId {
  if (book?.worldBaseId && isValidWorldBaseId(book.worldBaseId)) return book.worldBaseId;
  const text = [book?.name, book?.theme, book?.description, ...(book?.tags || [])].filter(Boolean).join(" ");
  return matchBaseByText(text) ?? "custom";
}
