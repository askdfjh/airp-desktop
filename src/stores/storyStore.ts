import { create } from "zustand";
import type { Story } from "@/types";
import {
  loadStories, loadTrashedStories, insertStory, updateStory,
  softDeleteStory, restoreStory, purgeStory,
} from "@/lib/db";
import { useSessionStore } from "./sessionStore";
import { useUIStore } from "./uiStore";
import { useWorldStore } from "./worldStore";
import { useGenerationStore } from "./generationStore";

interface StoryState {
  stories: Story[];
  trash: Story[];
  activeStoryId: string | null;
  loaded: boolean;
  loadFromDb: () => Promise<void>;
  loadTrash: () => Promise<void>;
  openStory: (id: string) => Promise<void>;
  startNewAdventure: () => void;
  createDraftStory: () => Promise<string>;
  addStory: (s: Story) => void;
  rename: (id: string, title: string) => void;
  setPinned: (id: string, pinned: boolean) => void;
  setStatus: (id: string, status: Story["status"]) => void;
  patch: (id: string, fields: Partial<Story>) => void;
  remove: (id: string) => void;
  restore: (id: string) => void;
  purge: (id: string) => void;
  volumesOf: (storyId: string) => ReturnType<typeof useSessionStore.getState>["sessions"];
}

export const useStoryStore = create<StoryState>((set, get) => ({
  stories: [],
  trash: [],
  activeStoryId: null,
  loaded: false,

  loadFromDb: async () => {
    try {
      const stories = await loadStories();
      set({ stories, loaded: true });
    } catch (e) {
      console.error("[story] load failed:", e);
      set({ loaded: true });
    }
  },

  loadTrash: async () => {
    try {
      set({ trash: await loadTrashedStories() });
    } catch (e) {
      console.error("[story] load trash failed:", e);
    }
  },

  openStory: async (id) => {
    const story = get().stories.find((s) => s.id === id);
    if (!story) return;
    const now = Date.now();
    const sessions = useSessionStore.getState().sessions.filter((s) => s.storyId === id && !s.deletedAt);
    const unlocked = sessions.filter((s) => !s.locked);
    const targetId =
      (story.lastVolumeId && unlocked.some((s) => s.id === story.lastVolumeId) && story.lastVolumeId) ||
      [...unlocked].sort((a, b) => (b.chainIndex ?? 1) - (a.chainIndex ?? 1))[0]?.id ||
      sessions[0]?.id ||
      null;
    set({ activeStoryId: id });
    get().patch(id, { lastOpenedAt: now, lastVolumeId: targetId, updatedAt: now });
    if (targetId) useSessionStore.getState().setActive(targetId);
    if (story.worldBookId) {
      await useWorldStore.getState().setActiveBook(story.worldBookId).catch(() => {});
    } else {
      await useWorldStore.getState().deactivateAllBooks().catch(() => {});
    }
    if (story.generationPresetId) {
      useGenerationStore.getState().setActivePreset(story.generationPresetId);
    }
    useUIStore.getState().setAppPhase("reading");
  },

  startNewAdventure: () => {
    useUIStore.getState().resetOnboarding();
    useUIStore.getState().setAppPhase("onboarding");
  },

  createDraftStory: async () => {
    const now = Date.now();
    const sid = useSessionStore.getState().createBlankSession();
    const id = crypto.randomUUID();
    const story: Story = {
      id,
      title: "未命名稿纸",
      kind: "blank",
      status: "writing",
      cover: null,
      groupId: "draft",
      pinned: false,
      synopsis: "",
      tags: [],
      lastOpenedAt: now,
      lastVolumeId: sid,
      wordCount: 0,
      createdAt: now,
      updatedAt: now,
    };
    const { updateSession } = await import("@/lib/db");
    await updateSession(sid, { storyId: id, updatedAt: now }).catch(() => {});
    useSessionStore.setState((st) => ({
      sessions: st.sessions.map((s) => (s.id === sid ? { ...s, storyId: id, title: "未命名稿纸" } : s)),
    }));
    set((st) => ({ stories: [story, ...st.stories], activeStoryId: id }));
    insertStory(story).catch((e) => console.error("[story] insert draft failed:", e));
    useSessionStore.getState().setActive(sid);
    useUIStore.getState().setAppPhase("reading");
    return id;
  },

  addStory: (s) => set((st) => ({ stories: [s, ...st.stories], activeStoryId: s.id })),

  rename: (id, title) => get().patch(id, { title, updatedAt: Date.now() }),

  setPinned: (id, pinned) => get().patch(id, { pinned, updatedAt: Date.now() }),

  setStatus: (id, status) => get().patch(id, { status, groupId: status === "finished" ? "finished" : (get().stories.find((x) => x.id === id)?.kind === "blank" ? "draft" : "writing"), updatedAt: Date.now() }),

  patch: (id, fields) => {
    set((st) => ({
      stories: st.stories.map((s) => (s.id === id ? { ...s, ...fields } : s)),
    }));
    updateStory(id, fields).catch((e) => console.error("[story] update failed:", e));
  },

  remove: (id) => {
    const target = get().stories.find((s) => s.id === id);
    set((st) => ({
      stories: st.stories.filter((s) => s.id !== id),
      trash: target ? [{ ...target, deletedAt: Date.now() }, ...st.trash] : st.trash,
      activeStoryId: st.activeStoryId === id ? null : st.activeStoryId,
    }));
    softDeleteStory(id).catch((e) => console.error("[story] delete failed:", e));
    useSessionStore.setState((st) => ({
      sessions: st.sessions.filter((s) => s.storyId !== id),
      trash: [
        ...st.sessions.filter((s) => s.storyId === id).map((s) => ({ ...s, deletedAt: Date.now() })),
        ...st.trash,
      ],
    }));
  },

  restore: (id) => {
    const target = get().trash.find((s) => s.id === id);
    set((st) => ({
      trash: st.trash.filter((s) => s.id !== id),
      stories: target ? [{ ...target, deletedAt: undefined }, ...st.stories] : st.stories,
    }));
    restoreStory(id).catch((e) => console.error("[story] restore failed:", e));
    useSessionStore.getState().loadFromDb();
  },

  purge: (id) => {
    set((st) => ({ trash: st.trash.filter((s) => s.id !== id) }));
    purgeStory(id).catch((e) => console.error("[story] purge failed:", e));
  },

  volumesOf: (storyId) =>
    useSessionStore.getState().sessions
      .filter((s) => s.storyId === storyId)
      .sort((a, b) => (a.chainIndex ?? 1) - (b.chainIndex ?? 1)),
}));
