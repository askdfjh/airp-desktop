import { create } from "zustand";

export interface OpeningScenario {
  id: string;
  name: string;
  description: string;
  keywords: string[];
  theme: string; // which world theme this belongs to
  systemPromptTemplate: string; // template with {characterName} placeholder
}

const defaultScenarios: OpeningScenario[] = [
  {
    id: "zongmen-dabi",
    name: "宗门大比",
    description: "一年一度的宗门比武大会即将开始，各方弟子摩拳擦掌",
    keywords: ["竞技", "热血", "成长"],
    theme: "cultivation",
    systemPromptTemplate: "你正在写一部修仙小说。当前场景：宗门大比——一年一度的宗门比武大会正在进行。{characterName}是参赛弟子之一。请以沉浸式的小说笔法续写故事，描写战斗场面、人物心理和周围观众的反应。每次回复约100-200字。",
  },
  {
    id: "mijing-tanxian",
    name: "秘境探险",
    description: "远古秘境突然出现，修仙者们纷纷前往探索其中的机缘与危险",
    keywords: ["探索", "奇遇", "危机"],
    theme: "cultivation",
    systemPromptTemplate: "你正在写一部修仙小说。当前场景：秘境探险——{characterName}进入了一处远古秘境。请描写秘境的环境、遇到的机缘与危险、其他修仙者的互动。以沉浸式小说笔法续写，每次回复约100-200字。",
  },
  {
    id: "fangshi-fengbo",
    name: "坊市风波",
    description: "坊市拍卖会上出现了一件神秘宝物，引发各方势力争夺",
    keywords: ["谋略", "交易", "暗流"],
    theme: "cultivation",
    systemPromptTemplate: "你正在写一部修仙小说。当前场景：坊市风波——{characterName}在坊市拍卖会上目睹了一场争夺。请描写各方势力的博弈、宝物的来历、以及主角的抉择。以沉浸式小说笔法续写，每次回复约100-200字。",
  },
  // Placeholder scenarios for other themes (can be expanded later)
  {
    id: "urban-night",
    name: "午夜觉醒",
    description: "城市的霓虹灯下，异能者们在暗夜中觉醒",
    keywords: ["觉醒", "都市", "暗面"],
    theme: "urban",
    systemPromptTemplate: "你正在写一部都市异能小说。当前场景：{characterName}在午夜的城市中觉醒了异能。请描写觉醒的过程、都市暗面的世界、以及其他异能者的反应。每次回复约100-200字。",
  },
  {
    id: "scifi-firstjump",
    name: "首次跃迁",
    description: "星际飞船即将进行首次超光速跃迁",
    keywords: ["探索", "科技", "未知"],
    theme: "scifi",
    systemPromptTemplate: "你正在写一部科幻星际小说。当前场景：{characterName}所在的飞船即将进行首次超光速跃迁。请描写跃迁的体验、未知的星系、船员的反应。每次回复约100-200字。",
  },
  {
    id: "fantasy-clanwar",
    name: "万族之战",
    description: "各大种族之间的战争一触即发",
    keywords: ["战争", "种族", "英雄"],
    theme: "fantasy",
    systemPromptTemplate: "你正在写一部东方玄幻小说。当前场景：万族之战——{characterName}身处各大种族的战争漩涡中。请描写战争场面、种族纷争、主角的抉择。每次回复约100-200字。",
  },
  {
    id: "infinite-first",
    name: "初入副本",
    description: "系统提示音响起，你被传送到了第一个副本世界",
    keywords: ["副本", "系统", "生存"],
    theme: "infinite",
    systemPromptTemplate: "你正在写一部无限流小说。当前场景：{characterName}被传送到了第一个副本世界。请描写副本规则、任务目标、其他玩家、以及生存挑战。每次回复约100-200字。",
  },
  {
    id: "palace-intrigue",
    name: "后宫暗涌",
    description: "后宫之中看似平静，实则暗流涌动",
    keywords: ["宫斗", "权谋", "人心"],
    theme: "palace",
    systemPromptTemplate: "你正在写一部宫廷古装小说。当前场景：后宫暗涌——{characterName}卷入了一场后宫的权谋博弈。请描写宫廷的勾心斗角、人物关系、以及主角的应对之策。每次回复约100-200字。",
  },
];

interface OnboardingState {
  scenarios: OpeningScenario[];
  getScenariosByTheme: (theme: string) => OpeningScenario[];
  getScenarioById: (id: string) => OpeningScenario | undefined;
  buildSystemPrompt: (scenarioId: string, characterName: string, mode: string) => string;
}

export const useOnboardingStore = create<OnboardingState>((set, get) => ({
  scenarios: defaultScenarios,

  getScenariosByTheme: (theme: string) => {
    return get().scenarios.filter((s) => s.theme === theme);
  },

  getScenarioById: (id: string) => {
    return get().scenarios.find((s) => s.id === id);
  },

  buildSystemPrompt: (scenarioId: string, characterName: string, mode: string) => {
    const scenario = get().scenarios.find((s) => s.id === scenarioId);
    if (!scenario) return "";

    let prompt = scenario.systemPromptTemplate.replace("{characterName}", characterName);

    // Add mode-specific instructions
    if (mode === "novel") {
      prompt += "\n\n【叙事规则】使用第三人称叙事，用「他/她」来描述角色。像写小说一样描写场景、动作、对话和心理活动。";
    } else if (mode === "player") {
      prompt += "\n\n【叙事规则】用户以第一人称「我」的视角参与故事。你用第二人称「你」来描述用户的角色，用其他角色的名字来描述NPC。描写环境和其他角色的行为，让用户做出选择和行动。";
    }

    return prompt;
  },
}));
