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
  // 优先级：底座+频道都匹配 → 频道匹配（全底座） → 底座匹配（中性） → 全通用；取前 3
  const matchBase = (seed: TopicOpeningSeed) => (seed.bases as string[] | undefined)?.includes(base) ?? false;
  const matchAud = (seed: TopicOpeningSeed) => (seed.audiences as string[] | undefined)?.includes(audience ?? "") ?? false;
  const neutral = (seed: TopicOpeningSeed) => !seed.audiences;
  const ranked = topic.openingSeeds
    .map((seed) => ({
      seed,
      score:
        (matchBase(seed) && (audience ? matchAud(seed) : neutral(seed)) ? 3 : 0) +
        (matchBase(seed) && neutral(seed) ? 2 : 0) +
        (!(seed.bases?.length) && (audience ? matchAud(seed) : neutral(seed)) ? 1 : 0),
    }))
    .sort((a, b) => b.score - a.score)
    .map((r) => r.seed)
    .slice(0, 3);

  return ranked.map((seed) => ({
    id: `topic:${topic.id}:${seed.id}`,
    name: seed.name,
    description: seed.focus,
    keywords: [topic.label, worldLabel, ...seed.tags].slice(0, 4),
    theme: base,
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
