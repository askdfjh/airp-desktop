import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ThemeMode = "dark" | "light" | "system";
export type MessageFontSize = "xs" | "sm" | "md" | "lg" | "xl";

interface UIState {
  sidebarOpen: boolean;
  settingsOpen: boolean;
  theme: ThemeMode;
  messageFontSize: MessageFontSize;
  webSearchOn: boolean;
  mcpActive: boolean;
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
  resetOnboarding: () => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set, get) => ({
      sidebarOpen: true,
      settingsOpen: false,
      theme: "dark",
      messageFontSize: "sm",
      webSearchOn: false,
      mcpActive: false,
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
      // Existing methods
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
        }),
    }),
    {
      name: "airp-ui-v2",
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
