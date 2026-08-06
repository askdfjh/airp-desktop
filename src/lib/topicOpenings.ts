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
  const matchBase = (seed: TopicOpeningSeed) => (seed.bases as string[] | undefined)?.includes(base) ?? false;
  // 题材级频道（男频/女频专属题材）直接全量归属该频道；通用题材按种子 audiences 判断
  const matchAud = (seed: TopicOpeningSeed) => {
    if (topic.audience !== "all") return topic.audience === audience;
    return (seed.audiences as string[] | undefined)?.includes(audience ?? "") ?? false;
  };
  // 频道 tab（男频/女频）：严格只展示该频道的开局（男女频完全分离）；
  // 底座匹配的种子优先展示，另加"无底座限制的通用种子"（任何底座下都成立）作为兜底，
  // 其余底座的种子严格排除——选了古代底座就不能出现修仙开局
  const seeds =
    audience && audience !== "all"
      ? [
          ...topic.openingSeeds.filter((s) => matchBase(s) && matchAud(s)),
          ...topic.openingSeeds.filter((s) => !s.bases?.length && matchAud(s)),
        ]
      : topic.openingSeeds.filter((s) => matchBase(s) || !s.bases?.length);

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
