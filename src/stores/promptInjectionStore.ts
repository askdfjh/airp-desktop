import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { PromptInjection } from "@/types";

const LEGACY_KEY = "airp-jailbreak-v1";

function migrateLegacy(): PromptInjection[] {
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    const byModel: Record<string, string> = parsed?.state?.byModel ?? {};
    const items = Object.entries(byModel).map(([model, text]) => ({
      id: "legacy-" + model,
      text: String(text),
      modelIds: [model],
      applied: true,
      createdAt: Date.now(),
    }));
    localStorage.removeItem(LEGACY_KEY);
    return items;
  } catch {
    return [];
  }
}

interface PromptInjectionState {
  items: PromptInjection[];
  addItem: (text: string, modelIds: string[]) => void;
  updateItem: (id: string, fields: Partial<Omit<PromptInjection, "id" | "createdAt">>) => void;
  removeItem: (id: string) => void;
}

export const usePromptInjectionStore = create<PromptInjectionState>()(
  persist(
    (set) => ({
      items: migrateLegacy(),

      addItem: (text, modelIds) =>
        set((st) => ({
          items: [
            ...st.items,
            {
              id: crypto.randomUUID(),
              text,
              modelIds,
              applied: false,
              createdAt: Date.now(),
            },
          ],
        })),

      updateItem: (id, fields) =>
        set((st) => ({
          items: st.items.map((i) => (i.id === id ? { ...i, ...fields } : i)),
        })),

      removeItem: (id) =>
        set((st) => ({ items: st.items.filter((i) => i.id !== id) })),
    }),
    { name: "airp-prompt-injection-v1" },
  ),
);
