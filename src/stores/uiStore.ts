import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { HotTropeId } from "@/lib/popularTropes";
import {
  clampReaderPrefs,
  DEFAULT_READER_PREFS,
  readerFontSizeFromMessage,
  type ReaderPrefs,
} from "@/lib/readerPrefs";

export type ThemeMode = "dark" | "light" | "system";
export type MessageFontSize = "xs" | "sm" | "md" | "lg" | "xl";
export type OnboardingStep = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export type AppPhase = "welcome" | "bookshelf" | "onboarding" | "reading" | "create";

/** 格式分析（章节/场景/对话推荐）执行模型设置：跟随当前模型 / 指定模型 / 关闭 */
export interface FormatModelConfig {
  mode: "follow" | "custom" | "off";
  providerId?: string;
  model?: string;
}

let toastTimer: ReturnType<typeof setTimeout> | null = null;

interface UIState {
  sidebarOpen: boolean;
  setSidebarOpen: (v: boolean) => void;
  settingsOpen: boolean;
  theme: ThemeMode;
  messageFontSize: MessageFontSize;
  reader: ReaderPrefs;
  readerSettingsOpen: boolean;
  setReader: (p: Partial<ReaderPrefs>) => void;
  setReaderSettingsOpen: (v: boolean) => void;
  resetReader: () => void;
  readerByStory: Record<string, ReaderPrefs>;
  readerStoryId: string | null;
  hydrateReaderForStory: (storyId: string | null) => void;
  openingError: string | null;
  lastOpeningMessage: string | null;
  setOpeningError: (msg: string | null) => void;
  webSearchOn: boolean;
  mcpActive: boolean;
  // 格式分析执行模型（章节/场景/对话推荐独立请求所用模型）
  formatModel: FormatModelConfig;
  setFormatModel: (c: FormatModelConfig) => void;
  // 叙事约束开关（插件设置页）：叙事防护 / 剧情推进
  narrativeGuardOn: boolean;
  setNarrativeGuardOn: (v: boolean) => void;
  progressionGuardOn: boolean;
  setProgressionGuardOn: (v: boolean) => void;
  // 角色群像（NPC 以自身利益为中心）
  ensembleGuardOn: boolean;
  setEnsembleGuardOn: (v: boolean) => void;
  // 角色后台进展（隐藏幕后进展注入正文生成，默认开启）
  hiddenProgressOn: boolean;
  setHiddenProgressOn: (v: boolean) => void;
  // 随机世界事件（插件设置页开关，默认关闭）：世界书条目按节奏随机注入剧情
  randomWorldEventOn: boolean;
  setRandomWorldEventOn: (v: boolean) => void;
  toast: string | null;
  toastAction: "settings" | null;
  notify: (msg: string, action?: "settings" | null) => void;
  // Onboarding state（welcome/create 保留在联合类型，实际走 overlay）
  appPhase: AppPhase;
  onboardingStep: OnboardingStep;
  selectedWorldId: string | null;
  selectedWorldName: string | null;
  selectedTopicSchemeId: string | null;
  selectedTopicSchemeName: string | null;
  selectedMainEntryId: string | null;
  selectedMainEntryName: string | null;
  selectedStylePresetId: string | null;
  selectedStylePresetName: string | null;
  selectedMode: "novel" | "player" | "custom" | null;
  selectedCharacterId: string | null;
  selectedCharacterName: string | null;
  selectedScenarioId: string | null;
  selectedScenarioName: string | null;
  selectedTropeId: HotTropeId | null;
  selectedTropeName: string | null;
  // 玩家主角名（开局第 3 步输入，未填时兜底「主角」；选角色卡时自动带入可改）
  playerName: string;
  // 开局进入的频道 tab（全部/男频/女频），用于按频道区分开局文案
  onboardingAudience: "all" | "male" | "female";
  // 开局自动发送标记：开始冒险后由 OnboardingFlow 写入，useChat 加载完成后消费
  pendingOpeningMessage: string | null;
  // Existing methods
  toggleSidebar: () => void;
  setSettingsOpen: (v: boolean) => void;
  setTheme: (t: ThemeMode) => void;
  setMessageFontSize: (s: MessageFontSize) => void;
  setWebSearchOn: (v: boolean) => void;
  setMcpActive: (v: boolean) => void;
  effectiveTheme: () => "dark" | "light";
  // Onboarding methods
  setAppPhase: (phase: AppPhase) => void;
  shelfView: "grid" | "list";
  shelfSort: "opened" | "updated" | "title" | "created";
  shelfGroup: "all" | "writing" | "finished" | "draft";
  setShelfView: (v: "grid" | "list") => void;
  setShelfSort: (v: "opened" | "updated" | "title" | "created") => void;
  setShelfGroup: (v: "all" | "writing" | "finished" | "draft") => void;
  setOnboardingStep: (step: OnboardingStep) => void;
  setSelectedWorld: (id: string | null, name: string | null) => void;
  setSelectedTopicScheme: (id: string | null, name: string | null) => void;
  setSelectedMainEntry: (id: string | null, name: string | null) => void;
  setSelectedStylePreset: (id: string | null, name: string | null) => void;
  setSelectedMode: (mode: "novel" | "player" | "custom" | null) => void;
  setSelectedCharacter: (id: string | null, name: string | null) => void;
  setSelectedScenario: (id: string | null, name: string | null) => void;
  setSelectedTrope: (id: HotTropeId | null, name: string | null) => void;
  setPlayerName: (name: string) => void;
  setOnboardingAudience: (a: "all" | "male" | "female") => void;
  setPendingOpeningMessage: (msg: string | null) => void;
  resetOnboarding: () => void;
  // 长对话压缩：全局锁 + 阶段 + 自动确认框
  compressing: boolean;
  compressStage: "extracting" | "summarizing" | "";
  compressPrompt: {
    sessionId: string;
    count: number;
    estimatedTokens: number;
    windowCount: number;
    keptCount: number;
  } | null;
  compressPromptCallbacks: { onConfirm: () => void; onCancel: () => void } | null;
  lastCompressDeclineAt: number;
  setCompressing: (v: boolean) => void;
  setCompressStage: (s: "extracting" | "summarizing" | "") => void;
  setCompressPrompt: (p: UIState["compressPrompt"]) => void;
  setCompressPromptCallbacks: (c: UIState["compressPromptCallbacks"]) => void;
  markCompressDeclined: () => void;
  // AI 创建模式（角色/世界）：null = 未打开
  createMode: "character" | "world" | null;
  setCreateMode: (m: "character" | "world" | null) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set, get) => ({
      sidebarOpen: false,
      settingsOpen: false,
      theme: "system",
      messageFontSize: "sm",
      reader: DEFAULT_READER_PREFS,
      readerSettingsOpen: false,
      readerByStory: {},
      readerStoryId: null,
      setReader: (p) =>
        set((s) => {
          const reader = clampReaderPrefs({ ...s.reader, ...p });
          const sid = s.readerStoryId;
          return {
            reader,
            readerByStory: sid ? { ...s.readerByStory, [sid]: reader } : s.readerByStory,
          };
        }),
      setReaderSettingsOpen: (v) => set({ readerSettingsOpen: v }),
      resetReader: () =>
        set((s) => {
          const next = { ...s.readerByStory };
          if (s.readerStoryId) delete next[s.readerStoryId];
          return { reader: DEFAULT_READER_PREFS, readerByStory: next };
        }),
      hydrateReaderForStory: (storyId) =>
        set((s) => ({
          readerStoryId: storyId,
          reader: storyId && s.readerByStory[storyId]
            ? clampReaderPrefs(s.readerByStory[storyId])
            : s.reader,
        })),
      openingError: null,
      lastOpeningMessage: null,
      setOpeningError: (msg) => set({ openingError: msg }),
      webSearchOn: false,
      mcpActive: false,
      formatModel: { mode: "follow" },
      setFormatModel: (c) => set({ formatModel: c }),
      narrativeGuardOn: false,
      setNarrativeGuardOn: (v) => set({ narrativeGuardOn: v }),
      progressionGuardOn: false,
      setProgressionGuardOn: (v) => set({ progressionGuardOn: v }),
      ensembleGuardOn: false,
      setEnsembleGuardOn: (v) => set({ ensembleGuardOn: v }),
      hiddenProgressOn: true,
      setHiddenProgressOn: (v) => set({ hiddenProgressOn: v }),
      randomWorldEventOn: false,
      setRandomWorldEventOn: (v) => set({ randomWorldEventOn: v }),
      toast: null,
      toastAction: null,
      notify: (msg, action) => {
        set({ toast: msg, toastAction: action ?? null });
        if (toastTimer) clearTimeout(toastTimer);
        toastTimer = setTimeout(() => set({ toast: null, toastAction: null }), 2200);
      },
      // Onboarding state defaults
      appPhase: "bookshelf",
      onboardingStep: 1,
      selectedWorldId: null,
      selectedWorldName: null,
      selectedTopicSchemeId: null,
      selectedTopicSchemeName: null,
      selectedMainEntryId: null,
      selectedMainEntryName: null,
      selectedStylePresetId: null,
      selectedStylePresetName: null,
      selectedMode: null,
      selectedCharacterId: null,
      selectedCharacterName: null,
      selectedScenarioId: null,
      selectedScenarioName: null,
      selectedTropeId: null,
      selectedTropeName: null,
      playerName: "",
      onboardingAudience: "all",
      pendingOpeningMessage: null,
      // Existing methods
      setSidebarOpen: (v) => set({ sidebarOpen: v }),
      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
      setSettingsOpen: (v) => set({ settingsOpen: v }),
      setTheme: (t) => set({ theme: t }),
      setMessageFontSize: (s) => set({ messageFontSize: s }),
      setWebSearchOn: (v: boolean) => set({ webSearchOn: v }),
      setMcpActive: (v: boolean) => set({ mcpActive: v }),
      effectiveTheme: () => {
        const t = get().theme;
        if (t === "system") {
          return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
        }
        return t;
      },
      // Onboarding methods
      // welcome/create 只走 overlay，不写入 live phase
      setAppPhase: (phase) => {
        if (phase === "welcome" || phase === "create") return;
        set({ appPhase: phase });
      },
      shelfView: "grid",
      shelfSort: "opened",
      shelfGroup: "all",
      setShelfView: (v) => set({ shelfView: v }),
      setShelfSort: (v) => set({ shelfSort: v }),
      setShelfGroup: (v) => set({ shelfGroup: v }),
      setOnboardingStep: (step) => set({ onboardingStep: step }),
      setSelectedWorld: (id, name) => set({ selectedWorldId: id, selectedWorldName: name }),
      setSelectedTopicScheme: (id, name) => set({ selectedTopicSchemeId: id, selectedTopicSchemeName: name }),
      setSelectedMainEntry: (id, name) => set({ selectedMainEntryId: id, selectedMainEntryName: name }),
      setSelectedStylePreset: (id, name) => set({ selectedStylePresetId: id, selectedStylePresetName: name }),
      setSelectedMode: (mode) => set({ selectedMode: mode }),
      setSelectedCharacter: (id, name) => set({ selectedCharacterId: id, selectedCharacterName: name }),
      setSelectedScenario: (id, name) => set({ selectedScenarioId: id, selectedScenarioName: name }),
      setSelectedTrope: (id, name) => set({ selectedTropeId: id, selectedTropeName: name }),
      setPlayerName: (name) => set({ playerName: name }),
      setOnboardingAudience: (a) => set({ onboardingAudience: a }),
      setPendingOpeningMessage: (msg) =>
        set((s) => ({
          pendingOpeningMessage: msg,
          lastOpeningMessage: msg ?? s.lastOpeningMessage,
          openingError: msg ? null : s.openingError,
        })),
      resetOnboarding: () =>
        set({
          onboardingStep: 1,
          selectedWorldId: null,
          selectedWorldName: null,
          selectedTopicSchemeId: null,
          selectedTopicSchemeName: null,
          selectedMainEntryId: null,
          selectedMainEntryName: null,
          selectedStylePresetId: null,
          selectedStylePresetName: null,
          selectedMode: null,
          selectedCharacterId: null,
          selectedCharacterName: null,
          selectedScenarioId: null,
          selectedScenarioName: null,
          selectedTropeId: null,
          selectedTropeName: null,
          playerName: "",
          pendingOpeningMessage: null,
        }),
      // 长对话压缩状态（不持久化）
      compressing: false,
      compressStage: "",
      compressPrompt: null,
      compressPromptCallbacks: null,
      lastCompressDeclineAt: 0,
      setCompressing: (v) => set({ compressing: v }),
      setCompressStage: (s) => set({ compressStage: s }),
      setCompressPrompt: (p) => set({ compressPrompt: p }),
      setCompressPromptCallbacks: (c) => set({ compressPromptCallbacks: c }),
      markCompressDeclined: () => set({ lastCompressDeclineAt: Date.now() }),
      // AI 创建模式（不持久化）
      createMode: null,
      setCreateMode: (m) => set({ createMode: m }),
    }),
    {
      name: "airp-ui-v3",
      // 仅持久化用户偏好；appPhase 与开局选择不写入，冷启动由 AppShell 定为 bookshelf
      partialize: (s) => ({
        sidebarOpen: s.sidebarOpen,
        settingsOpen: s.settingsOpen,
        theme: s.theme,
        messageFontSize: s.messageFontSize,
        reader: s.reader,
        readerByStory: s.readerByStory,
        webSearchOn: s.webSearchOn,
        mcpActive: s.mcpActive,
        formatModel: s.formatModel,
        narrativeGuardOn: s.narrativeGuardOn,
        progressionGuardOn: s.progressionGuardOn,
        ensembleGuardOn: s.ensembleGuardOn,
        hiddenProgressOn: s.hiddenProgressOn,
        randomWorldEventOn: s.randomWorldEventOn,
        shelfView: s.shelfView,
        shelfSort: s.shelfSort,
        shelfGroup: s.shelfGroup,
      }),
      // 旧 airp-ui-v3 可能仍带 appPhase/onboardingStep/selected*，禁止回灌
      merge: (persistedState, currentState) => {
        const raw =
          persistedState && typeof persistedState === "object"
            ? { ...(persistedState as Record<string, unknown>) }
            : {};
        delete raw.appPhase;
        delete raw.onboardingStep;
        delete raw.createMode;
        delete raw.readerSettingsOpen;
        delete raw.readerStoryId;
        delete raw.openingError;
        delete raw.lastOpeningMessage;
        for (const key of Object.keys(raw)) {
          if (key.startsWith("selected")) delete raw[key];
        }
        const persistedReader = raw.reader;
        delete raw.reader;
        const persistedByStory = raw.readerByStory;
        delete raw.readerByStory;
        const migratedSize = readerFontSizeFromMessage(
          typeof raw.messageFontSize === "string" ? raw.messageFontSize : undefined,
        );
        const reader = clampReaderPrefs({
          ...DEFAULT_READER_PREFS,
          ...(migratedSize ? { fontSize: migratedSize } : {}),
          ...(persistedReader && typeof persistedReader === "object"
            ? (persistedReader as Partial<ReaderPrefs>)
            : {}),
        });
        const readerByStory: Record<string, ReaderPrefs> = {};
        if (persistedByStory && typeof persistedByStory === "object") {
          for (const [k, v] of Object.entries(persistedByStory as Record<string, unknown>)) {
            if (v && typeof v === "object") readerByStory[k] = clampReaderPrefs(v as Partial<ReaderPrefs>);
          }
        }
        return { ...currentState, ...raw, reader, readerByStory };
      },
    },
  ),
);
