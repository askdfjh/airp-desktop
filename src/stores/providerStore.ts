import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ProviderConfig } from "@/types";

interface ProviderState {
  providers: ProviderConfig[];
  activeProviderId: string | null;
  activeModel: string;
  enabledProviders: Record<string, boolean>;
  addProvider: (p: ProviderConfig) => void;
  removeProvider: (id: string) => void;
  updateProvider: (id: string, p: Partial<ProviderConfig>) => void;
  setActiveProvider: (id: string) => void;
  setActiveModel: (m: string) => void;
  setEnabledProvider: (id: string, enabled: boolean) => void;
  initEnabledProviders: (providers: ProviderConfig[]) => void;
}

export const useProviderStore = create<ProviderState>()(
  persist(
    (set, get) => ({
      providers: [],
      activeProviderId: null,
      activeModel: "",
      enabledProviders: {},
      addProvider: (p) => set((st) => ({
        providers: [...st.providers, p],
        activeProviderId: st.activeProviderId ?? p.id,
        enabledProviders: { ...st.enabledProviders, [p.id]: true },
      })),
      removeProvider: (id) => set((st) => {
        const { [id]: _, ...rest } = st.enabledProviders;
        return {
          providers: st.providers.filter((p) => p.id !== id),
          activeProviderId: st.activeProviderId === id ? null : st.activeProviderId,
          enabledProviders: rest,
        };
      }),
      updateProvider: (id, partial) => set((st) => ({
        providers: st.providers.map((p) => (p.id === id ? { ...p, ...partial } : p)),
      })),
      setActiveProvider: (id) => set({ activeProviderId: id }),
      setActiveModel: (m) => set({ activeModel: m }),
      setEnabledProvider: (id, enabled) => set((st) => ({
        enabledProviders: { ...st.enabledProviders, [id]: enabled },
      })),
      initEnabledProviders: (providers) => set((st) => {
        const ep: Record<string, boolean> = {};
        for (const p of providers) {
          ep[p.id] = st.enabledProviders[p.id] ?? true;
        }
        return { enabledProviders: ep };
      }),
    }),
    { name: "airp-providers" },
  ),
);