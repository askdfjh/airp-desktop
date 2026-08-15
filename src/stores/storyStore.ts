import { create } from "zustand";
import type { Story } from "@/types";
import {
  loadStories, loadTrashedStories, insertStory, updateStory,
  softDeleteStory, restoreStory, purgeStory, purgeExpiredStories, loadMessages,
} from "@/lib/db";
import { countStoryChars } from "@/lib/storyExport";
import { generateStoryTitle, isBadGeneratedTitle, isPlaceholderTitle } from "@/lib/storyTitle";
import { getTopicScheme } from "@/lib/topicSchemes";
import { getWorldFoundation } from "@/lib/worldFoundations";
import { useSessionStore } from "./sessionStore";
import { useUIStore } from "./uiStore";
import { useWorldStore } from "./worldStore";
import { useGenerationStore } from "./generationStore";

const titling = new Set<string>();

interface StoryState {
  stories: Story[];
  trash: Story[];
  activeStoryId: string | null;
  loaded: boolean;
  loadFromDb: () => Promise<void>;
  loadTrash: () => Promise<void>;
  openStory: (id: string) => Promise<void>;
  startNewAdventure: () => void;
  startSameWorld: (id: string) => void;
  createDraftStory: () => Promise<string>;
  addStory: (s: Story) => void;
  rename: (id: string, title: string) => void;
  autoTitle: (id: string, opts?: { force?: boolean; silent?: boolean }) => Promise<string | null>;
  setPinned: (id: string, pinned: boolean) => void;
  setStatus: (id: string, status: Story["status"]) => void;
  patch: (id: string, fields: Partial<Story>) => void;
  remove: (id: string) => void;
  restore: (id: string) => void;
  purge: (id: string) => void;
  recountWords: (id: string) => Promise<number>;
  volumesOf: (storyId: string) => ReturnType<typeof useSessionStore.getState>["sessions"];
}

export const useStoryStore = create<StoryState>((set, get) => ({
  stories: [],
  trash: [],
  activeStoryId: null,
  loaded: false,

  loadFromDb: async () => {
    try {
      await purgeExpiredStories().catch(() => 0);
      const [stories, trash] = await Promise.all([loadStories(), loadTrashedStories()]);
      set({ stories, trash, loaded: true });
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
    const unlocked = useSessionStore.getState().sessions.filter((s) => s.storyId === id && !s.locked);
    const lastOk = story.lastVolumeId && unlocked.some((s) => s.id === story.lastVolumeId);
    const targetId = lastOk
      ? story.lastVolumeId!
      : [...unlocked].sort((a, b) => {
          const byChain = (b.chainIndex ?? 1) - (a.chainIndex ?? 1);
          return byChain !== 0 ? byChain : (b.updatedAt ?? 0) - (a.updatedAt ?? 0);
        })[0]?.id ?? null;
    set({ activeStoryId: id });
    get().patch(id, { lastOpenedAt: now, lastVolumeId: targetId });
    if (targetId) useSessionStore.getState().setActive(targetId);
    if (story.worldBookId) {
      await useWorldStore.getState().setActiveBook(story.worldBookId).catch(() => {});
    } else {
      await useWorldStore.getState().deactivateAllBooks().catch(() => {});
    }
    if (story.generationPresetId) {
      useGenerationStore.getState().setActivePreset(story.generationPresetId);
    }
    useUIStore.getState().hydrateReaderForStory(id);
    useUIStore.getState().setAppPhase("reading");
    void get().autoTitle(id, { silent: true });
    void get().recountWords(id);
  },

  startSameWorld: (id: string) => {
    const story = get().stories.find((s) => s.id === id);
    if (!story) return;
    const ui = useUIStore.getState();
    ui.resetOnboarding();
    const topic = getTopicScheme(story.topicSchemeId);
    const book = story.worldBookId
      ? useWorldStore.getState().books.find((b) => b.id === story.worldBookId)
      : null;
    const foundation = getWorldFoundation(story.worldBaseId);
    const worldId = story.worldBaseId || story.worldBookId || null;
    const worldName = book?.name || foundation.label || story.worldBaseId || null;
    ui.setSelectedWorld(worldId, worldName);
    if (topic) ui.setSelectedTopicScheme(topic.id, topic.label);
    ui.setOnboardingStep(topic || worldId ? 2 : 1);
    ui.setAppPhase("onboarding");
  },

  startNewAdventure: () => {
    useUIStore.getState().resetOnboarding();
    useUIStore.getState().setAppPhase("onboarding");
  },

  createDraftStory: async () => {
    const now = Date.now();
    const story: Story = {
      id: crypto.randomUUID(),
      title: "未命名稿纸",
      kind: "blank",
      status: "writing",
      cover: null,
      groupId: "draft",
      pinned: false,
      synopsis: "",
      tags: [],
      wordCount: 0,
      createdAt: now,
      updatedAt: now,
    };
    await insertStory(story);
    set((st) => ({ stories: [story, ...st.stories] }));
    useSessionStore.getState().createBlankSession(story.id);
    await get().openStory(story.id);
    return story.id;
  },

  addStory: (s) => set((st) => ({ stories: [s, ...st.stories], activeStoryId: s.id })),

  rename: (id, title) => get().patch(id, { title, updatedAt: Date.now() }),

  autoTitle: async (id, opts) => {
    const story = get().stories.find((s) => s.id === id);
    if (!story) return null;
    if (!opts?.force && !isPlaceholderTitle(story.title)) return null;
    if (titling.has(id)) return null;
    titling.add(id);
    if (opts?.force) useUIStore.getState().notify("正在取书名…");
    try {
      const { title, error } = await generateStoryTitle(story, { allowMetaOnly: true });
      if (!title || title === story.title || isBadGeneratedTitle(title)) {
        if (opts?.force) useUIStore.getState().notify(error ? `取书名失败：${error}` : "取书名失败，请稍后再试");
        return null;
      }
      get().rename(id, title);
      const sessions = useSessionStore.getState().sessions.filter((s) => s.storyId === id);
      for (const sess of sessions) {
        if (isPlaceholderTitle(sess.title) || sess.title === story.title) {
          useSessionStore.getState().rename(sess.id, title);
        }
      }
      if (!opts?.silent) {
        useUIStore.getState().notify(error ? `${error}：${title}` : `书名：${title}`);
      }
      return title;
    } catch (e) {
      console.error("[story] autoTitle failed:", e);
      if (opts?.force) useUIStore.getState().notify("取书名失败，请稍后再试");
      return null;
    } finally {
      titling.delete(id);
    }
  },

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

  recountWords: async (id) => {
    const vols = useSessionStore.getState().sessions
      .filter((s) => s.storyId === id)
      .sort((a, b) => (a.chainIndex ?? 1) - (b.chainIndex ?? 1));
    const bags = [];
    for (const v of vols) bags.push(await loadMessages(v.id));
    const wordCount = countStoryChars(bags);
    get().patch(id, { wordCount });
    return wordCount;
  },

  volumesOf: (storyId) =>
    useSessionStore.getState().sessions
      .filter((s) => s.storyId === storyId)
      .sort((a, b) => (a.chainIndex ?? 1) - (b.chainIndex ?? 1)),
}));
