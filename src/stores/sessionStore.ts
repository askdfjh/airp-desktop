import { create } from "zustand";
import type { Session, SessionEntry } from "@/types";
import { useUIStore } from "./uiStore";
import { useProviderStore } from "./providerStore";
import {
  loadSessions, insertSession, deleteSession, deleteAllSessions, updateSession,
  loadTrashedSessions, restoreSession as restoreSessionDb,
  purgeSession as purgeSessionDb, purgeExpiredTrash,
  createBranchSession,
  loadFavorites, addFavorite as addFavoriteDb,
  removeFavorite as removeFavoriteDb, searchMessages as searchMessagesDb,
  loadSessionCharacterCards, duplicateCharacterCard, insertMessage,
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
  targetKeyword: string | null;
  add: (s: Session) => void;
  remove: (id: string) => { ok: boolean; reason?: string };
  removeAll: () => void;
  rename: (id: string, title: string) => void;
  setActive: (id: string) => void;
  updateTimestamp: (id: string) => void;
  updateSessionModel: (id: string, providerId: string, model: string, thinkingSupported?: boolean) => void;
  /** 切换会话格式类型：blank(空白对话) ↔ adventure(冒险格式：章节/场景/文风) */
  setSessionKind: (id: string, kind: "blank" | "adventure") => void;
  /** 空白会话的格式开关：仅启用格式分析（章节/场景/推荐），不改变内容注入（保持空白） */
  setFormatEnabled: (id: string, enabled: boolean) => void;
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
  jumpToMessage: (sessionId: string, messageId: string, keyword?: string) => void;
  clearTargetMessage: () => void;
  createBlankSession: (storyId?: string) => string;
  updateSystemPrompt: (id: string, systemPrompt: string) => void;
  toggleThinking: (id: string) => void;
  setThinkingEnabled: (id: string, enabled: boolean) => void;
  branchFromMessage: (sourceId: string, messageId: string) => Promise<boolean>;
  /** 创建续集会话（继承设定 + 复制前卷基线卡 + 写入档案/索引 + 继承临时条目），返回新会话 id */
  createContinuationSession: (source: Session, opts: { archive: string; contextIndex: string; sessionEntries?: SessionEntry[] }) => Promise<string>;
  /** 锁定会话（压缩后只读，可分支） */
  lockSession: (id: string) => void;
  /** 创建角色扮演会话（AI 扮演该角色，空白会话类型 + 自动开场自我介绍），返回新会话 id */
  createRoleplaySession: (role: { name: string; systemPrompt: string; intro?: string }) => Promise<string>;
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
  targetKeyword: null,

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

  setActive: (id) => {
    // 压缩期间禁止切换会话，防止状态混乱
    if (useUIStore.getState().compressing) return;
    set({ activeId: id });
  },

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

  setSessionKind: (id, kind) => {
    const now = Date.now();
    set((st) => ({
      sessions: st.sessions.map((s) =>
        s.id === id ? { ...s, kind, updatedAt: now } : s
      ),
    }));
    updateSession(id, { kind, updatedAt: now } as any).catch((e) =>
      console.error("[db] setSessionKind failed:", e)
    );
  },

  setFormatEnabled: (id, enabled) => {
    const now = Date.now();
    set((st) => ({
      sessions: st.sessions.map((s) =>
        s.id === id ? { ...s, formatEnabled: enabled, updatedAt: now } : s
      ),
    }));
    updateSession(id, { formatEnabled: enabled ? 1 : 0, updatedAt: now } as any).catch((e) =>
      console.error("[db] setFormatEnabled failed:", e)
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
    // 只加载；不 createBlankSession，也不按上次会话 setActive
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

  /** 创建分支话题：复制源会话中 messageId（含）及之前的所有内容到新会话并切换过去 */
  branchFromMessage: async (sourceId: string, messageId: string): Promise<boolean> => {
    const source = get().sessions.find((s) => s.id === sourceId);
    if (!source) return false;
    const now = Date.now();
    const newId = "s_" + now + "_" + Math.random().toString(36).slice(2, 8);
    const newSession: Session = {
      id: newId,
      title: source.title,
      systemPrompt: source.systemPrompt,
      providerId: source.providerId,
      model: source.model,
      thinkingEnabled: source.thinkingEnabled,
      kind: source.kind,
      contextSummary: source.contextSummary,
      summaryUpdatedAt: source.summaryUpdatedAt,
      summaryCount: source.summaryCount,
      lastSummarizedMessageId: source.lastSummarizedMessageId,
      sessionEntries: source.sessionEntries,
      createdAt: now,
      updatedAt: now,
    };
    try {
      await createBranchSession(sourceId, messageId, newSession);
    } catch (e) {
      console.error("[db] createBranchSession failed:", e);
      return false;
    }
    set((st) => ({ sessions: [newSession, ...st.sessions], activeId: newId }));
    return true;
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

  jumpToMessage: (sessionId, messageId, keyword) => {
    set({ activeId: sessionId, targetMessageId: messageId, targetKeyword: keyword || null });
  },

  clearTargetMessage: () => set({ targetMessageId: null, targetKeyword: null }),

  createBlankSession: (storyId?) => {
    const now = Date.now();
    const id = 's_' + now + '_' + Math.random().toString(36).slice(2, 8);
    const session: Session = {
      id,
      title: storyId ? '未命名稿纸' : '空白会话',
      systemPrompt: '',
      providerId: '',
      model: '',
      thinkingEnabled: true,
      kind: 'blank',
      createdAt: now,
      updatedAt: now,
      ...(storyId ? { storyId, chainId: storyId, chainIndex: 1 } : {}),
    };
    set((st) => ({ sessions: [session, ...st.sessions], activeId: id }));
    insertSession(session).catch((e) => console.error('[db] insertSession failed:', e));
    return id;
  },

  createContinuationSession: async (source, opts) => {
    const now = Date.now();
    const id = crypto.randomUUID();
    const session: Session = {
      id,
      title: source.title,
      systemPrompt: source.systemPrompt,
      providerId: source.providerId,
      model: source.model,
      thinkingEnabled: source.thinkingEnabled ?? true,
      kind: source.kind ?? "adventure",
      createdAt: now,
      updatedAt: now,
      storyId: source.storyId,
      chainId: source.chainId || source.storyId || source.id,
      chainIndex: (source.chainIndex ?? 1) + 1,
      parentId: source.id,
      archive: opts.archive,
      contextIndex: opts.contextIndex,
      // 临时条目：压缩提取结果写入续集（无新提取时继承父卷条目，保证设定不断层）
      sessionEntries: opts.sessionEntries && opts.sessionEntries.length > 0
        ? opts.sessionEntries
        : source.sessionEntries,
    };
    // 复制前卷绑定卡作为续集基线（C2 包含 C1，各自独立；仅冒险会话有绑定卡）
    if (session.kind !== "blank") {
      try {
        const cards = await loadSessionCharacterCards(source.id);
        for (const c of cards) {
          await duplicateCharacterCard(c.characterCardId, id, c.worldBookId ?? null);
        }
      } catch (e) {
        console.warn("[continuation] copy baseline cards failed:", e);
      }
    }
    insertSession(session).catch((e) => console.error("[db] insertSession(continuation) failed:", e));
    set((st) => ({ sessions: [session, ...st.sessions], activeId: id }));
    if (session.storyId) {
      import("./storyStore").then(({ useStoryStore }) => {
        useStoryStore.getState().patch(session.storyId!, { lastVolumeId: id, updatedAt: now });
      }).catch(() => {});
    }
    return id;
  },

  lockSession: (id) => {
    set((st) => ({
      sessions: st.sessions.map((s) => (s.id === id ? { ...s, locked: true, updatedAt: Date.now() } : s)),
    }));
    updateSession(id, { locked: true, updatedAt: Date.now() }).catch((e) =>
      console.error("[db] lockSession failed:", e)
    );
  },

  createRoleplaySession: async (role) => {
    const now = Date.now();
    const id = crypto.randomUUID();
    const ps = useProviderStore.getState();
    const session: Session = {
      id,
      title: `扮演·${role.name}`,
      systemPrompt: role.systemPrompt,
      providerId: ps.activeProviderId ?? "",
      model: ps.activeModel ?? "",
      thinkingEnabled: true,
      kind: "blank",
      createdAt: now,
      updatedAt: now,
    };
    // 自动开场：角色自我介绍（本地模板，不消耗 token）
    const intro = role.intro?.trim()
      ? `你好，我是「${role.name}」。${role.intro.trim()}你可以直接告诉我需求，我们开始吧。`
      : `你好，我是「${role.name}」。${role.systemPrompt.slice(0, 60)}有什么可以帮你的，直接告诉我就好。`;
    // 先落库再激活：避免 useChat 加载消息时开场白尚未写入（时序竞态导致开场白丢失）
    try {
      await insertSession(session);
      await insertMessage({
        id: crypto.randomUUID(),
        sessionId: id,
        role: "assistant",
        content: intro,
        createdAt: now,
      });
    } catch (e) {
      console.error("[db] roleplay session init failed:", e);
    }
    set((st) => ({ sessions: [session, ...st.sessions], activeId: id }));
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
