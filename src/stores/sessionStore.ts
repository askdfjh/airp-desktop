import { create } from "zustand";
import type { Session } from "@/types";
import {
  loadSessions, insertSession, deleteSession, deleteAllSessions, updateSession,
  loadTrashedSessions, restoreSession as restoreSessionDb,
  purgeSession as purgeSessionDb, purgeExpiredTrash,
  loadFavorites, addFavorite as addFavoriteDb,
  removeFavorite as removeFavoriteDb, searchMessages as searchMessagesDb,
  type Favorite, type SearchResult,
} from "@/lib/db";

interface SessionState {
  sessions: Session[];
  trash: Session[];
  activeId: string | null;
  loaded: boolean;
  favorites: Favorite[];
  searchQuery: string;
  searchResults: SearchResult[];
  searching: boolean;
  targetMessageId: string | null;
  add: (s: Session) => void;
  remove: (id: string) => { ok: boolean; reason?: string };
  removeAll: () => void;
  rename: (id: string, title: string) => void;
  setActive: (id: string) => void;
  updateTimestamp: (id: string) => void;
  updateSessionModel: (id: string, providerId: string, model: string, thinkingSupported?: boolean) => void;
  favorite: (sessionId: string) => Promise<void>;
  unfavorite: (favoriteId: string) => void;
  isFavorited: (sessionId: string) => boolean;
  loadFromDb: () => Promise<void>;
  loadTrashFromDb: () => Promise<void>;
  restoreFromTrash: (id: string) => void;
  purgeFromTrash: (id: string) => void;
  clearExpiredTrash: () => Promise<void>;
  setSearchQuery: (q: string) => void;
  doSearch: (q: string) => Promise<void>;
  clearSearch: () => void;
  jumpToMessage: (sessionId: string, messageId: string) => void;
  clearTargetMessage: () => void;
  createBlankSession: () => string;
  updateSystemPrompt: (id: string, systemPrompt: string) => void;
  toggleThinking: (id: string) => void;
  setThinkingEnabled: (id: string, enabled: boolean) => void;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  sessions: [],
  trash: [],
  activeId: null,
  loaded: false,
  favorites: [],
  searchQuery: "",
  searchResults: [],
  searching: false,
  targetMessageId: null,

  add: (s) => {
    set((st) => ({ sessions: [s, ...st.sessions], activeId: s.id }));
    insertSession(s).catch((e) => console.error("[db] insertSession failed:", e));
  },

  remove: (id) => {
    const isFav = get().favorites.some((f) => f.sessionId === id);
    if (isFav) {
      return { ok: false, reason: "该对话已收藏，请先取消收藏再删除" };
    }
    const target = get().sessions.find((s) => s.id === id);
    set((st) => ({
      sessions: st.sessions.filter((s) => s.id !== id),
      trash: target ? [{ ...target, deletedAt: Date.now() }, ...st.trash] : st.trash,
      activeId: st.activeId === id ? null : st.activeId,
    }));
    deleteSession(id).catch((e) => console.error("[db] deleteSession failed:", e));
    return { ok: true };
  },

  removeAll: () => {
    set((st) => ({
      sessions: [],
      trash: [
        ...st.sessions.map((s) => ({ ...s, deletedAt: Date.now() })),
        ...st.trash,
      ],
      activeId: null,
      favorites: [],
    }));
    deleteAllSessions().catch((e) => console.error("[db] deleteAllSessions failed:", e));
  },

  rename: (id, title) => {
    const now = Date.now();
    set((st) => ({
      sessions: st.sessions.map((s) =>
        s.id === id ? { ...s, title, updatedAt: now } : s
      ),
    }));
    updateSession(id, { title, updatedAt: now }).catch((e) =>
      console.error("[db] updateSession failed:", e)
    );
  },

  setActive: (id) => set({ activeId: id }),

  updateTimestamp: (id) => {
    const now = Date.now();
    set((st) => ({
      sessions: st.sessions.map((s) => (s.id === id ? { ...s, updatedAt: now } : s)),
    }));
    updateSession(id, { updatedAt: now }).catch((e) =>
      console.error("[db] updateSession failed:", e)
    );
  },

  updateSessionModel: (id, providerId, model, thinkingSupported) => {
    const now = Date.now();
    set((st) => ({
      sessions: st.sessions.map((s) =>
        s.id === id ? { ...s, providerId, model, thinkingEnabled: thinkingSupported !== undefined ? !!thinkingSupported : s.thinkingEnabled, updatedAt: now } : s
      ),
    }));
    updateSession(id, { providerId, model, thinkingEnabled: thinkingSupported !== undefined ? (thinkingSupported ? 1 : 0) : undefined, updatedAt: now } as any).catch((e) =>
      console.error("[db] updateSessionModel failed:", e)
    );
  },

  favorite: async (sessionId) => {
    const fav = await addFavoriteDb(sessionId);
    set((st) => ({ favorites: [fav, ...st.favorites] }));
  },

  unfavorite: (favoriteId) => {
    set((st) => ({
      favorites: st.favorites.filter((f) => f.id !== favoriteId),
    }));
    removeFavoriteDb(favoriteId).catch((e) =>
      console.error("[db] removeFavorite failed:", e)
    );
  },

  isFavorited: (sessionId) => {
    return get().favorites.some((f) => f.sessionId === sessionId);
  },

  loadFromDb: async () => {
    try {
      const sessions = await loadSessions();
      const favorites = await loadFavorites();
      set({ sessions, favorites, loaded: true });
    } catch (e) {
      console.error("[db] loadSessions failed:", e);
      set({ loaded: true });
    }
  },

  loadTrashFromDb: async () => {
    try {
      const trash = await loadTrashedSessions();
      set({ trash });
    } catch (e) {
      console.error("[db] loadTrashedSessions failed:", e);
    }
  },

  restoreFromTrash: (id) => {
    const target = get().trash.find((t) => t.id === id);
    if (!target) return;
    set((st) => ({
      trash: st.trash.filter((t) => t.id !== id),
      sessions: [{ ...target, deletedAt: undefined }, ...st.sessions],
    }));
    restoreSessionDb(id).catch((e) => console.error("[db] restoreSession failed:", e));
  },

  purgeFromTrash: (id) => {
    set((st) => ({ trash: st.trash.filter((t) => t.id !== id) }));
    purgeSessionDb(id).catch((e) => console.error("[db] purgeSession failed:", e));
  },

  clearExpiredTrash: async () => {
    try {
      const n = await purgeExpiredTrash();
      if (n > 0) get().loadTrashFromDb();
    } catch (e) {
      console.error("[db] purgeExpiredTrash failed:", e);
    }
  },

  setSearchQuery: (q) => set({ searchQuery: q }),

  doSearch: async (q) => {
    const trimmed = q.trim();
    if (!trimmed) {
      set({ searchResults: [], searching: false });
      return;
    }
    set({ searching: true, searchQuery: trimmed });
    try {
      const results = await searchMessagesDb(trimmed);
      set({ searchResults: results, searching: false });
    } catch (e) {
      console.error("[db] searchMessages failed:", e);
      set({ searching: false, searchResults: [] });
    }
  },

  clearSearch: () => set({ searchQuery: "", searchResults: [], searching: false }),

  jumpToMessage: (sessionId, messageId) => {
    set({ activeId: sessionId, targetMessageId: messageId });
  },

  clearTargetMessage: () => set({ targetMessageId: null }),


  createBlankSession: () => {
    const now = Date.now();
    const id = 's_' + now + '_' + Math.random().toString(36).slice(2, 8);
    const session = {
      id,
      title: '空白会话',
      systemPrompt: '',
      providerId: '',
      model: '',
      thinkingEnabled: true,
      kind: 'blank' as const,
      createdAt: now,
      updatedAt: now,
    };
    set((st) => ({ sessions: [session, ...st.sessions], activeId: id }));
    insertSession(session).catch((e) => console.error('[db] insertSession failed:', e));
    return id;
  },

  updateSystemPrompt: (id, systemPrompt) => {
    const now = Date.now();
    set((st) => ({
      sessions: st.sessions.map((s) =>
        s.id === id ? { ...s, systemPrompt, updatedAt: now } : s
      ),
    }));
    updateSession(id, { systemPrompt, updatedAt: now }).catch((e) =>
      console.error("[db] updateSystemPrompt failed:", e)
    );
  },

  toggleThinking: (id) => {
    const now = Date.now();
    set((st) => ({
      sessions: st.sessions.map((s) => {
        if (s.id !== id) return s;
        const next = !s.thinkingEnabled;
        updateSession(id, { thinkingEnabled: next ? 1 : 0, updatedAt: now } as any).catch((e) =>
          console.error("[db] toggleThinking failed:", e)
        );
        return { ...s, thinkingEnabled: next, updatedAt: now };
      }),
    }));
  },

  setThinkingEnabled: (id, enabled) => {
    const now = Date.now();
    set((st) => ({
      sessions: st.sessions.map((s) =>
        s.id === id ? { ...s, thinkingEnabled: enabled, updatedAt: now } : s
      ),
    }));
    updateSession(id, { thinkingEnabled: enabled ? 1 : 0, updatedAt: now } as any).catch((e) =>
      console.error("[db] setThinkingEnabled failed:", e)
    );
  },
}));
