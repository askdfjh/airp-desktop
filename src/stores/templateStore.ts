import { create } from "zustand";
import type { PromptTemplate } from "@/types";
import {
  loadPromptTemplates,
  insertPromptTemplate,
  updatePromptTemplate,
  deletePromptTemplate,
  initBuiltinTemplates,
} from "@/lib/db";

interface TemplateState {
  templates: PromptTemplate[];
  loaded: boolean;
  loadFromDb: () => Promise<void>;
  add: (t: Omit<PromptTemplate, "createdAt" | "updatedAt">) => Promise<void>;
  update: (id: string, fields: { title?: string; content?: string; category?: string }) => Promise<void>;
  remove: (id: string) => Promise<void>;
  getByCategory: (category: string) => PromptTemplate[];
  getAllCategories: () => string[];
}

export const useTemplateStore = create<TemplateState>((set, get) => ({
  templates: [],
  loaded: false,

  loadFromDb: async () => {
    try {
      await initBuiltinTemplates();
      const templates = await loadPromptTemplates();
      set({ templates, loaded: true });
    } catch (e) {
      console.error("[db] loadPromptTemplates failed:", e);
      set({ loaded: true });
    }
  },

  add: async (t) => {
    const now = Date.now();
    const newT: PromptTemplate = {
      ...t,
      createdAt: now,
      updatedAt: now,
    };
    await insertPromptTemplate(newT);
    set((st) => ({ templates: [newT, ...st.templates] }));
  },

  update: async (id, fields) => {
    const now = Date.now();
    await updatePromptTemplate(id, { ...fields, updatedAt: now });
    set((st) => ({
      templates: st.templates.map((t) =>
        t.id === id ? { ...t, ...fields, updatedAt: now } : t
      ),
    }));
  },

  remove: async (id) => {
    await deletePromptTemplate(id);
    set((st) => ({ templates: st.templates.filter((t) => t.id !== id) }));
  },

  getByCategory: (category) => {
    return get().templates.filter((t) => t.category === category);
  },

  getAllCategories: () => {
    const cats = new Set(get().templates.map((t) => t.category));
    return Array.from(cats).sort();
  },
}));
