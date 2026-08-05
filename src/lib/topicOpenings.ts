import type { OpeningScenario } from "@/stores/onboardingStore";
import { getTopicScheme } from "@/lib/topicSchemes";
import { worldFoundationLabel } from "@/lib/worldFoundations";

export function getTopicOpeningScenarios(
  topicSchemeId: string | null | undefined,
  worldBaseId?: string | null,
): OpeningScenario[] {
  const topic = getTopicScheme(topicSchemeId);
  if (!topic) return [];
  const base = worldBaseId ?? topic.worldBaseId;
  const worldLabel = worldFoundationLabel(base);
  // 底座专属 seeds 优先，通用 seeds（无 bases）兜底补位，保证最多 3 条
  const specific = topic.openingSeeds.filter((seed) => (seed.bases as string[] | undefined)?.includes(base));
  const generic = topic.openingSeeds.filter((seed) => !seed.bases);
  const seeds = [...specific, ...generic].slice(0, 3);

  return seeds.map((seed) => ({
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
) {
  return getTopicOpeningScenarios(topicSchemeId, worldBaseId).find((scenario) => scenario.id === scenarioId);
}
