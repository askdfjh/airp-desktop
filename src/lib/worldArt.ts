import { WORLD_ART } from "@/assets/art";
import { getTopicScheme } from "@/lib/topicSchemes";
import type { TopicScheme } from "@/lib/topicSchemes";
import type { Story } from "@/types";

/** 规则书 id → 题材插画键（与 src/assets/art/worlds 十三张对应） */
const BOOK_ART: Record<string, string> = {
  "wb-builtin-xianxia": "cultivation",
  "wb-builtin-fantasy": "fantasy",
  "wb-builtin-urban": "urban",
  "wb-builtin-modern": "urban",
  "wb-builtin-infinite": "infinite",
  "wb-builtin-scifi": "scifi",
  "wb-builtin-apocalypse": "apocalypse",
  "wb-builtin-palace": "palace",
  "wb-builtin-folklore": "folklore",
  "wb-builtin-rulehorror": "rulehorror",
  "wb-builtin-zhaidou": "zhaidou",
  "wb-builtin-retro": "retro",
  "wb-builtin-romance": "romance",
  "wb-builtin-entertainment": "entertainment",
};

const TROPE_ART: Record<string, string> = {
  apocalypse: "apocalypse",
  rules: "rulehorror",
  infinite: "infinite",
  entertainment: "entertainment",
  palace: "palace",
  era: "retro",
  marriage: "romance",
  sweet: "romance",
  upgrade: "cultivation",
};

const BASE_ART: Record<string, string> = {
  modern: "urban",
  ancient: "palace",
  cultivation: "cultivation",
  future: "scifi",
  otherworld: "fantasy",
  infinite: "infinite",
};

const PRESET_ART = new Set(Object.keys(WORLD_ART));

export function artUrl(key?: string | null): string | undefined {
  if (!key) return undefined;
  if (WORLD_ART[key]) return WORLD_ART[key];
  if (BOOK_ART[key]) return WORLD_ART[BOOK_ART[key]];
  if (TROPE_ART[key]) return WORLD_ART[TROPE_ART[key]];
  if (BASE_ART[key]) return WORLD_ART[BASE_ART[key]];
  return undefined;
}

export function artKeyForTopic(topic: TopicScheme, worldBaseId?: string | null): string | undefined {
  const base = worldBaseId || topic.worldBaseId;
  if (base && base !== topic.worldBaseId && BASE_ART[base]) return BASE_ART[base];
  if (topic.worldBookId && BOOK_ART[topic.worldBookId]) return BOOK_ART[topic.worldBookId];
  if (TROPE_ART[topic.tropeId]) return TROPE_ART[topic.tropeId];
  if (BASE_ART[topic.worldBaseId]) return BASE_ART[topic.worldBaseId];
  return undefined;
}

export function artForTopic(topic: TopicScheme, worldBaseId?: string | null): string | undefined {
  return artUrl(artKeyForTopic(topic, worldBaseId));
}

export function artForStory(story: Pick<Story, "kind" | "worldBookId" | "topicSchemeId" | "worldBaseId">): string | undefined {
  if (story.kind === "blank") return undefined;
  if (story.worldBookId) {
    const fromBook = artUrl(story.worldBookId);
    if (fromBook) return fromBook;
  }
  const topic = getTopicScheme(story.topicSchemeId);
  if (topic) {
    const fromTopic = artForTopic(topic, story.worldBaseId);
    if (fromTopic) return fromTopic;
  }
  if (story.worldBaseId && PRESET_ART.has(story.worldBaseId)) return WORLD_ART[story.worldBaseId];
  return artUrl(story.worldBaseId);
}
