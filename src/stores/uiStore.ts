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
  toggleSidebar: () => void;
  setSettingsOpen: (v: boolean) => void;
  setTheme: (t: ThemeMode) => void;
  setMessageFontSize: (s: MessageFontSize) => void;
  setWebSearchOn: (v: boolean) => void;
  setMcpActive: (v: boolean) => void;
  effectiveTheme: () => "dark" | "light";
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
    }),
    { name: "airp-ui-v2" },
  ),
);
