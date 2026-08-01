import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ThemeMode = "dark" | "light" | "system";
export type MessageFontSize = "xs" | "sm" | "md" | "lg" | "xl";

let toastTimer: ReturnType<typeof setTimeout> | null = null;

interface UIState {
  sidebarOpen: boolean;
  setSidebarOpen: (v: boolean) => void;
  settingsOpen: boolean;
  theme: ThemeMode;
  messageFontSize: MessageFontSize;
  webSearchOn: boolean;
  mcpActive: boolean;
  toast: string | null;
  toastAction: "settings" | null;
  notify: (msg: string, action?: "settings" | null) => void;
  // Onboarding state
  appPhase: "onboarding" | "dialogue";
  onboardingStep: 1 | 2 | 3;
  selectedWorldId: string | null;
  selectedWorldName: string | null;
  selectedMode: "novel" | "player" | "custom" | null;
  selectedCharacterId: string | null;
  selectedCharacterName: string | null;
  selectedScenarioId: string | null;
  selectedScenarioName: string | null;
  // 玩家主角名（开局第 3 步输入，未填时兜底「主角」；选角色卡时自动带入可改）
  playerName: string;
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
  setAppPhase: (phase: "onboarding" | "dialogue") => void;
  setOnboardingStep: (step: 1 | 2 | 3) => void;
  setSelectedWorld: (id: string | null, name: string | null) => void;
  setSelectedMode: (mode: "novel" | "player" | "custom" | null) => void;
  setSelectedCharacter: (id: string | null, name: string | null) => void;
  setSelectedScenario: (id: string | null, name: string | null) => void;
  setPlayerName: (name: string) => void;
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
}

export const useUIStore = create<UIState>()(
  persist(
    (set, get) => ({
      sidebarOpen: false,
      settingsOpen: false,
      theme: "dark",
      messageFontSize: "sm",
      webSearchOn: false,
      mcpActive: false,
      toast: null,
      toastAction: null,
      notify: (msg, action) => {
        set({ toast: msg, toastAction: action ?? null });
        if (toastTimer) clearTimeout(toastTimer);
        toastTimer = setTimeout(() => set({ toast: null, toastAction: null }), 2200);
      },
      // Onboarding state defaults
      appPhase: "onboarding",
      onboardingStep: 1,
      selectedWorldId: null,
      selectedWorldName: null,
      selectedMode: null,
      selectedCharacterId: null,
      selectedCharacterName: null,
      selectedScenarioId: null,
      selectedScenarioName: null,
      playerName: "",
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
      setAppPhase: (phase) => set({ appPhase: phase }),
      setOnboardingStep: (step) => set({ onboardingStep: step }),
      setSelectedWorld: (id, name) => set({ selectedWorldId: id, selectedWorldName: name }),
      setSelectedMode: (mode) => set({ selectedMode: mode }),
      setSelectedCharacter: (id, name) => set({ selectedCharacterId: id, selectedCharacterName: name }),
      setSelectedScenario: (id, name) => set({ selectedScenarioId: id, selectedScenarioName: name }),
      setPlayerName: (name) => set({ playerName: name }),
      setPendingOpeningMessage: (msg) => set({ pendingOpeningMessage: msg }),
      resetOnboarding: () =>
        set({
          onboardingStep: 1,
          selectedWorldId: null,
          selectedWorldName: null,
          selectedMode: null,
          selectedCharacterId: null,
          selectedCharacterName: null,
          selectedScenarioId: null,
          selectedScenarioName: null,
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
    }),
    {
      name: "airp-ui-v3",
      // 仅持久化用户偏好,不持久化开局流程状态
      // appPhase/onboardingStep/selected* 每次启动由 AppShell 根据有无活跃会话重新判定
      partialize: (s) => ({
        sidebarOpen: s.sidebarOpen,
        settingsOpen: s.settingsOpen,
        theme: s.theme,
        messageFontSize: s.messageFontSize,
        webSearchOn: s.webSearchOn,
        mcpActive: s.mcpActive,
      }),
    },
  ),
);
