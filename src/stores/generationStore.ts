import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { GenerationPreset } from "@/types";

export const BUILTIN_PRESETS: GenerationPreset[] = [
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
    outputStyle: "以生动的场景描写与人物对话推进故事，保持角色设定一致。每次回复要有充足篇幅（通常500-1000字），场景、动作、对话、心理描写均衡展开，细节到位，严禁简略。",
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
    outputStyle: "回答准确、结构清晰、直奔主题，避免冗余铺垫。涉及故事叙述时保持充足篇幅（通常400-800字），把事件与设定交代完整清楚。",
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
    outputStyle: "大胆发挥想象力，制造意外转折与新颖设定，文风自由奔放。每次回复篇幅要足（通常800-1200字），尽情铺陈奇景、奇遇与人物张力，把脑洞展开彻底。",
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
    outputStyle: "始终以角色身份回应，用行动、神态与内心活动代替干瘪叙述，对话自然口语化。每次回复充分展开（通常500-1000字），情绪张力与细节描写到位，让玩家沉浸其中。",
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
    outputStyle: "以小说笔法分段续写，场景、动作、对话、心理层层递进，结尾留出钩子便于继续。篇幅充沛（通常1200-2000字），一段回复要像小说的一个完整章节般充实饱满。",
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
- 生动反馈：每回合聚焦玩家行动的直接后果，但环境与 NPC 的反馈要描写充分、有画面感（篇幅适中，通常400-800字），让玩家看见、听见、闻到这个世界。
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
    { name: "airp-generation-v1", version: 5, migrate: (persisted: unknown) => {
      const old = persisted as Partial<GenerationState> | undefined;
      const presets = Array.isArray(old?.presets) ? old.presets : [];
      // 清除 dm-master + 旧 jailbreak 字段
      const cleaned = presets
        .filter((p: GenerationPreset & { jailbreak?: unknown }) => p?.id !== "dm-master")
        .map((p: GenerationPreset & { jailbreak?: unknown }) => {
          const { jailbreak: _drop, ...rest } = p;
          return rest;
        });
      // 内置预设：缺失则补入，已存在则用最新定义覆盖（保证内置参数/文风同步更新）
      for (const builtin of BUILTIN_PRESETS) {
        const idx = cleaned.findIndex((p: GenerationPreset) => p.id === builtin.id);
        if (idx === -1) {
          cleaned.push(builtin);
        } else if (builtin.isBuiltin) {
          cleaned[idx] = builtin;
        }
      }
      return { ...old, presets: cleaned } as GenerationState;
    } },
  ),
);
