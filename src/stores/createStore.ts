import { create } from "zustand";
import type { Message, CustomOpeningSeed } from "@/types";
import type { CreateType, GuideMode } from "@/lib/createGuide";

/* ---------- 草稿（提取结果）类型 ---------- */

export interface CharacterDraft {
  name: string;
  emoji: string;
  tags: string[];
  description: string;
  appearance: string;
  personality: string;
  speechStyle: string;
  background: string;
  relationships: string;
  goals: string;
  triggerWords: string[];
}

export type EntryPosition = "system" | "situation" | "last";

export interface WorldEntryDraft {
  category: string;
  title: string;
  key: string[];
  content: string;
  position: EntryPosition;
  /** 增量提炼时的对比状态：unchanged 不标亮 */
  status?: "new" | "changed" | "unchanged";
}

export interface WorldDraft {
  name: string;
  theme: string;
  description: string;
  tags: string[];
  /** AI 匹配的世界底座 id（可在预览中修改） */
  worldBaseId?: string;
  /** AI 生成的自定义开局种子（可在预览中修改） */
  openings?: CustomOpeningSeed[];
  entries: WorldEntryDraft[];
}

export type CreateDraft = CharacterDraft | WorldDraft;

/* ---------- 历史记录 ---------- */

export interface CreateHistoryItem {
  id: string;
  type: CreateType;
  guideMode: GuideMode;
  title: string;
  messages: Message[];
  savedResult: CreateDraft | null;
  createdAt: number;
  updatedAt: number;
}

const HISTORY_KEY = "airp-create-history-v1";
export const HISTORY_LIMIT = 20;

function loadHistoryFromStorage(): CreateHistoryItem[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.filter((x) => x && typeof x === "object" && x.id).slice(0, HISTORY_LIMIT);
  } catch {
    return [];
  }
}

function persistHistory(items: CreateHistoryItem[]) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(items.slice(0, HISTORY_LIMIT)));
  } catch {
    // ignore quota errors
  }
}

/* ---------- Store ---------- */

interface CreateState {
  type: CreateType;
  guideMode: GuideMode;
  messages: Message[];
  streaming: boolean;
  generating: boolean;
  preview: CreateDraft | null;
  /** 当前对话已保存过的结果（增量模式上下文） */
  savedDraft: CreateDraft | null;
  history: CreateHistoryItem[];

  open: (type: CreateType) => void;
  close: () => void;
  setGuideMode: (mode: GuideMode) => void;
  pushMessage: (m: Message) => void;
  updateLastAssistant: (content: string, thinking?: string) => void;
  updateMessage: (id: string, patch: Partial<Message>) => void;
  removeMessage: (id: string) => void;
  setStreaming: (v: boolean) => void;
  setGenerating: (v: boolean) => void;
  setPreview: (d: CreateDraft | null) => void;
  setSavedDraft: (d: CreateDraft | null) => void;
  /** 从历史重新载入：恢复消息并覆盖当前状态 */
  loadFromHistory: (item: CreateHistoryItem) => void;
  /** 保存当前对话为一条历史（含已保存结果） */
  commitHistory: (title: string) => CreateHistoryItem;
  removeHistory: (id: string) => void;
  clearHistory: () => void;
}

let msgSeq = 0;
export function createMessage(role: Message["role"], content: string): Message {
  msgSeq++;
  return {
    id: "cr_" + Date.now() + "_" + msgSeq + "_" + Math.random().toString(36).slice(2, 6),
    sessionId: "create-mode",
    role,
    content,
    createdAt: Date.now(),
  };
}

export function getIncrementalDraft(d: CreateDraft): CreateDraft | null {
  return d && typeof d === "object" && "name" in d && (d as CharacterDraft).name ? d : null;
}

export const useCreateStore = create<CreateState>((set, get) => ({
  type: "character",
  guideMode: "ask",
  messages: [],
  streaming: false,
  generating: false,
  preview: null,
  savedDraft: null,
  history: loadHistoryFromStorage(),

  open: (type) =>
    set({
      type,
      guideMode: "ask",
      messages: [],
      streaming: false,
      generating: false,
      preview: null,
      savedDraft: null,
    }),

  close: () =>
    set({
      messages: [],
      streaming: false,
      generating: false,
      preview: null,
      savedDraft: null,
    }),

  setGuideMode: (mode) => set({ guideMode: mode }),

  pushMessage: (m) => set((s) => ({ messages: [...s.messages, m] })),

  updateLastAssistant: (content, thinking) =>
    set((s) => {
      const messages = [...s.messages];
      const last = messages[messages.length - 1];
      if (!last) return s;
      if (last.role === "assistant") {
        messages[messages.length - 1] = { ...last, content, ...(thinking !== undefined ? { thinking } : {}) };
      } else {
        messages.push({
          ...createMessage("assistant", content),
          ...(thinking !== undefined ? { thinking } : {}),
        });
      }
      return { messages };
    }),

  updateMessage: (id, patch) =>
    set((s) => ({ messages: s.messages.map((m) => (m.id === id ? { ...m, ...patch } : m)) })),

  removeMessage: (id) =>
    set((s) => ({ messages: s.messages.filter((m) => m.id !== id) })),

  setStreaming: (v) => set({ streaming: v }),
  setGenerating: (v) => set({ generating: v }),
  setPreview: (d) => set({ preview: d }),
  setSavedDraft: (d) => set({ savedDraft: d }),

  loadFromHistory: (item) =>
    set({
      type: item.type,
      guideMode: item.guideMode,
      messages: item.messages.map((m) => ({ ...m, sessionId: "create-mode" })),
      streaming: false,
      generating: false,
      preview: null,
      savedDraft: item.savedResult,
    }),

  commitHistory: (title) => {
    const s = get();
    const now = Date.now();
    let item: CreateHistoryItem | null = null;
    const history = [...s.history];
    // 若最近一条同类型且消息首条一致（同一会话），更新而非新增
    const last = history[0];
    if (
      last &&
      last.type === s.type &&
      last.messages.length === s.messages.length &&
      last.messages[0]?.id === s.messages[0]?.id
    ) {
      item = {
        ...last,
        guideMode: s.guideMode,
        title,
        messages: s.messages,
        savedResult: s.savedDraft,
        updatedAt: now,
      };
      history[0] = item;
    } else {
      item = {
        id: "ch_" + now + "_" + Math.random().toString(36).slice(2, 6),
        type: s.type,
        guideMode: s.guideMode,
        title,
        messages: s.messages,
        savedResult: s.savedDraft,
        createdAt: now,
        updatedAt: now,
      };
      history.unshift(item);
    }
    persistHistory(history);
    set({ history });
    return item;
  },

  removeHistory: (id) => {
    const history = get().history.filter((x) => x.id !== id);
    persistHistory(history);
    set({ history });
  },

  clearHistory: () => {
    persistHistory([]);
    set({ history: [] });
  },
}));
