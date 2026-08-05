import type { OpeningScenario } from "@/stores/onboardingStore";
import { getTopicScheme, type TopicAudience, type TopicOpeningSeed } from "@/lib/topicSchemes";
import { worldFoundationLabel } from "@/lib/worldFoundations";

export function getTopicOpeningScenarios(
  topicSchemeId: string | null | undefined,
  worldBaseId?: string | null,
  audience?: TopicAudience,
): OpeningScenario[] {
  const topic = getTopicScheme(topicSchemeId);
  if (!topic) return [];
  const base = worldBaseId ?? topic.worldBaseId;
  const worldLabel = worldFoundationLabel(base);
  // 优先级：底座+频道都匹配 → 底座匹配（中性） → 全底座频道匹配 → 全通用
  // 全部 tab（audience=all/未传）：频道不限，底座匹配的全部开局都展示（男女频混合）
  const matchBase = (seed: TopicOpeningSeed) => (seed.bases as string[] | undefined)?.includes(base) ?? false;
  const matchAud = (seed: TopicOpeningSeed) =>
    !audience || audience === "all" || ((seed.audiences as string[] | undefined)?.includes(audience) ?? false);
  const neutral = (seed: TopicOpeningSeed) => !seed.audiences;
  const ranked = topic.openingSeeds
    .map((seed) => ({
      seed,
      score:
        (matchBase(seed) && matchAud(seed) ? 3 : 0) +
        (matchBase(seed) && neutral(seed) ? 2 : 0) +
        (!(seed.bases?.length) && matchAud(seed) ? 1 : 0),
    }))
    .sort((a, b) => b.score - a.score)
    .map((r) => r.seed);
  // 全部 tab（audience=all/未传）：按底座过滤 + 频道不限（男女频混合），跨底座的不混入
  const seeds = audience && audience !== "all" ? ranked.slice(0, 3) : ranked.filter((s) => matchBase(s) || !s.bases?.length);

  return seeds.map((seed) => ({
    id: `topic:${topic.id}:${seed.id}`,
    name: seed.name,
    description: seed.focus,
    keywords: [topic.label, worldLabel, ...seed.tags].slice(0, 4),
    theme: base,
    audience: (seed.audiences as string[] | undefined)?.length ? ((seed.audiences as string[])[0] as "male" | "female") : undefined,
    systemPromptTemplate:
      `你正在写一部发生在「${worldLabel}」中的沉浸式故事。题材是「${topic.label}」。` +
      `\n题材基础：${topic.description}` +
      `\n题材条目方向：${topic.entryHints.join("、")}` +
      `\n本次开局：${seed.name}。${seed.focus}` +
      "\n世界只负责通用规则，题材条目只负责叙事冲突；不要引用任何具体作品。",
    openingMessage:
      `请从「${seed.name}」开始。` +
      `\n世界：${worldLabel}。题材：${topic.label}。` +
      `\n开局重点：${seed.focus}` +
      "\n请直接开始故事，不要列出选项，不要提问。",
  }));
}

export function getTopicOpeningScenario(
  topicSchemeId: string | null | undefined,
  scenarioId: string | null | undefined,
  worldBaseId?: string | null,
  audience?: TopicAudience,
) {
  return getTopicOpeningScenarios(topicSchemeId, worldBaseId, audience).find((scenario) => scenario.id === scenarioId);
}
