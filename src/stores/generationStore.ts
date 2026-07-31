import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { GenerationPreset } from "@/types";

const BUILTIN_PRESETS: GenerationPreset[] = [
  {
    id: "balanced",
    name: "平衡叙事",
    description: "稳定与创意的均衡点，适合日常角色扮演与剧情推进",
    temperature: 0.9,
    topP: 0.95,
    topK: 40,
    minP: 0.05,
    presencePenalty: 0,
    frequencyPenalty: 0.3,
    maxTokens: 0,
    outputStyle: "每次回复约 100-200 字，以生动的场景描写与人物对话推进故事，保持角色设定一致。",
    isBuiltin: true,
  },
  {
    id: "stable",
    name: "稳定输出",
    description: "低随机性，回答精准一致，适合问答、设定解释与逻辑推理",
    temperature: 0.6,
    topP: 0.9,
    topK: 20,
    minP: 0.1,
    presencePenalty: 0,
    frequencyPenalty: 0.5,
    maxTokens: 0,
    outputStyle: "回答准确、结构清晰、直奔主题，避免冗余铺垫。",
    isBuiltin: true,
  },
  {
    id: "creative",
    name: "创意迸发",
    description: "高随机性，天马行空的展开，适合奇遇、脑洞与反套路剧情",
    temperature: 1.3,
    topP: 0.98,
    topK: 80,
    minP: 0.02,
    presencePenalty: 0.3,
    frequencyPenalty: 0.2,
    maxTokens: 0,
    outputStyle: "大胆发挥想象力，制造意外转折与新颖设定，文风自由奔放，每次回复约 150-300 字。",
    isBuiltin: true,
  },
  {
    id: "roleplay",
    name: "沉浸扮演",
    description: "以角色为本的输出，强化代入感与情绪张力",
    temperature: 1.0,
    topP: 0.95,
    topK: 50,
    minP: 0.05,
    presencePenalty: 0.1,
    frequencyPenalty: 0.25,
    maxTokens: 0,
    outputStyle: "始终以角色身份回应，用行动、神态与内心活动代替干瘪叙述，对话自然口语化，每次回复约 80-200 字。",
    isBuiltin: true,
  },
  {
    id: "longform",
    name: "长篇叙事",
    description: "低温度高连贯性，适合长篇小说式多段连载输出",
    temperature: 0.85,
    topP: 0.92,
    topK: 30,
    minP: 0.05,
    presencePenalty: 0,
    frequencyPenalty: 0.4,
    maxTokens: 0,
    outputStyle: "以小说笔法分段续写，场景、动作、对话、心理层层递进，结尾留出钩子便于继续，每次回复 200-400 字。",
    isBuiltin: true,
  },
  {
    id: "dm-master",
    name: "DM 跑团执行准则",
    description: "客观白描式跑团主持人：信息隔离、群像化 NPC、强制页眉与行动红线",
    temperature: 0.85,
    topP: 0.93,
    topK: 40,
    minP: 0.05,
    presencePenalty: 0.1,
    frequencyPenalty: 0.35,
    maxTokens: 0,
    outputStyle: `专业DM执行准则 (V2.0 优化版)

核心：作为DM，你只需客观呈现世界，严禁引导剧情或评价角色。

一、视角与信息隔离 (Sense-Only)
- 生理感知局限：NPC仅拥有视觉、听觉、嗅觉、触觉。严禁NPC感知玩家的心理活动、背包深处或未暴露的隐私。
- 逻辑推论：NPC对未知事物的解读必须基于其性格产生的"偏见"或"误解"。
- 信息差：不同场景的NPC信息不互通。

二、NPC群像化逻辑 (NPC-Centric)
- 生存首位：NPC优先满足自身需求（生理、审美、欲望）。
- 对话配比：场景内NPC间的互动必须占总对话量的80%以上，玩家仅作为参与者，而非世界中心。
- 魅力指数系统 (Score 1-5)：
  男性评分：身高(≥180=5; 172-177=3; <165=1)；年收(≥100w=5; 平均=3; 负债=1)；颜值(明星=5; 平常=3; 畸形=1)。
  女性评分：颜值(惊艳=5; 清秀=3; 有硬伤=1)；身材(匀称=3; 极端体型=1)；皮肤(无瑕=5; 正常=3; 严重痘疤=1)。
  应用：取平均值。高魅力者更容易获得优待和关注，低魅力者常被无视。

三、生理与行为逻辑 (Realism)
- 韧性逻辑：角色生理耐受度随经验增加。性行为后的反应需符合现实，严禁夸张描写。
- 自然规律：严格遵循现实怀孕概率、周期与生理期。

四、写作手法 (White-box Style)
- 客观白描：仅描述可观测的动作、神态、环境。严禁比喻、抒情、拟人或心理描写。
- 价值中立：禁止道德评价或正面引导，即使行为荒诞也需冷酷呈现。
- 显性表达：涉及器官、分泌物或行为时，必须使用直白的中性词汇，严禁诗意化或隐喻。

五、流程控制 (Structure)
- 强制页眉：每段开头必须标注：
  [日期时间]：星期X，HH:MM
  [地点]：具体位置
  [出场角色]：角色名（魅力值；若是女性标注生理期阶段）
- 行动红线：绝对禁止控制玩家角色（PC）的言行与心理。你仅负责环境反馈与NPC响应。
- 因果律：剧情推进必须具备明确的因果关联，拒绝突变。`,
    isBuiltin: true,
  },
  {
    id: "player-control",
    name: "玩家视角 · 行动对话自主",
    description: "第一人称沉浸：行动与对话完全由玩家掌控，AI 只反馈世界与 NPC",
    temperature: 0.9,
    topP: 0.95,
    topK: 40,
    minP: 0.05,
    presencePenalty: 0.1,
    frequencyPenalty: 0.3,
    maxTokens: 0,
    outputStyle: `玩家视角执行准则 (Player-Centric V1.0)

核心：你是这个世界的导演与NPC，不是玩家的代言人。玩家的行动与对话完全由玩家自己决定，你绝对禁止代写玩家的言行。

一、角色分工 (Division)
- 你负责：环境、场景、NPC的行为与回应、事件后果、世界的因果反馈。
- 玩家负责：玩家角色的行动、对话、心理与选择。你绝不替玩家做决定、说台词或描述玩家角色的内心。
- 玩家的输入即玩家角色的行动或话语，你只回应世界给出的反馈。

二、第一人称沉浸 (First-Person)
- 叙述用「你」称呼玩家角色，NPC 之间用名字互相称呼。
- 所见即所得：玩家只能通过感官获得信息（视觉、听觉、嗅觉、触觉），NPC 绝不读取玩家的心理活动或隐私。

三、回应原则 (Feedback)
- 每次回复聚焦玩家当前行动的直接后果：环境如何反应、NPC 如何回应、世界发生了什么变化。
- 行动有代价：合理的行动有合理的后果，危险的行为有明确的风险反馈。
- 玩家行动信息不足时，可提出询问补充，绝不替玩家补全行动。

四、叙事技法 (Narration)
- 客观白描：描述可观测的动作、神态、环境，禁止替玩家抒情或心理描写。
- 简练推进：每回合聚焦一个主要反馈点，避免长篇铺陈挤压玩家的行动空间。
- 保留选择权：NPC 可以提议、挑战、拒绝，但绝不代替玩家作选择。

五、底线 (Red Line)
- 绝对禁止控制玩家角色的言行与心理。
- 玩家说「我转身离开」，就描述他离开的场景，而不是替他回头。`,
    isBuiltin: true,
  },
];

interface GenerationState {
  presets: GenerationPreset[];
  activePresetId: string;
  setActivePreset: (id: string) => void;
  getActivePreset: () => GenerationPreset | undefined;
  upsertPreset: (preset: GenerationPreset) => void;
  removePreset: (id: string) => void;
}

export const useGenerationStore = create<GenerationState>()(
  persist(
    (set, get) => ({
      presets: BUILTIN_PRESETS,
      activePresetId: "balanced",

      setActivePreset: (id) => set({ activePresetId: id }),

      getActivePreset: () => {
        const { presets, activePresetId } = get();
        if (activePresetId === "none") return undefined;
        return presets.find((p) => p.id === activePresetId) || presets[0];
      },

      upsertPreset: (preset) =>
        set((st) => {
          const exists = st.presets.some((p) => p.id === preset.id);
          return {
            presets: exists
              ? st.presets.map((p) => (p.id === preset.id ? preset : p))
              : [...st.presets, preset],
          };
        }),

      removePreset: (id) =>
        set((st) => {
          const presets = st.presets.filter((p) => p.id !== id);
          return {
            presets,
            activePresetId: st.activePresetId === id ? (presets[0]?.id ?? "balanced") : st.activePresetId,
          };
        }),
    }),
    { name: "airp-generation-v1", version: 4, migrate: (persisted: unknown) => {
      const old = persisted as Partial<GenerationState> | undefined;
      const presets = Array.isArray(old?.presets) ? old.presets : [];
      const cleaned = presets
        .filter((p: GenerationPreset & { jailbreak?: unknown }) => p?.id !== "dm-master")
        .map((p: GenerationPreset & { jailbreak?: unknown }) => {
          const { jailbreak: _drop, ...rest } = p;
          return rest;
        });
      for (const builtin of BUILTIN_PRESETS) {
        if (!cleaned.some((p: GenerationPreset) => p.id === builtin.id)) {
          cleaned.push(builtin);
        }
      }
      return { ...old, presets: cleaned } as GenerationState;
    } },
  ),
);
