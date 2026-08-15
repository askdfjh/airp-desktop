import type { Session, Story } from "@/types";
import {
  getAppSetting,
  setAppSetting,
  loadSessions,
  loadTrashedSessions,
  loadFavorites,
  updateSession,
  insertStoryIfAbsent,
  loadActiveWorldBook,
} from "./db";

function groupKey(s: Session): string {
  return s.chainId || s.id;
}

/** 启动一次性迁移：未删会话按链折成书。空库也写 marker。 */
export async function migrateStoriesOnInit(): Promise<void> {
  if ((await getAppSetting("story_migration")) !== "1") {
    await foldSessions({ onlyMissingStoryId: false });
    await setAppSetting("story_migration", "1");
  }
}

/** 只补 null storyId，不改已有 Story 元数据，不碰 marker。 */
export async function repairMissingStoryIds(): Promise<void> {
  await foldSessions({ onlyMissingStoryId: true });
}

async function foldSessions(opts: { onlyMissingStoryId: boolean }): Promise<void> {
  let sessions = await loadSessions();
  if (opts.onlyMissingStoryId) {
    sessions = sessions.filter((s) => !s.storyId);
  }
  const groups = new Map<string, Session[]>();
  for (const s of sessions) {
    const key = groupKey(s);
    const list = groups.get(key);
    if (list) list.push(s);
    else groups.set(key, [s]);
  }

  let worldBookId: string | null = null;
  try {
    worldBookId = (await loadActiveWorldBook())?.id ?? null;
  } catch {
    worldBookId = null;
  }

  const favoriteIds = new Set((await loadFavorites()).map((f) => f.sessionId));
  const trashed = await loadTrashedSessions();

  for (const [storyId, group] of groups) {
    const siblings = trashed.filter((t) => groupKey(t) === storyId);
    await insertStoryIfAbsent(buildStoryFromGroup(group, storyId, worldBookId, favoriteIds, siblings));
    for (const s of group) {
      if (s.storyId !== storyId) {
        await updateSession(s.id, { storyId });
      }
    }
    for (const t of siblings) {
      if (t.storyId !== storyId) {
        await updateSession(t.id, { storyId });
      }
    }
  }
}

function pickLatest(list: Session[]): Session {
  return list.reduce((a, b) => (b.updatedAt >= a.updatedAt ? b : a));
}

function buildStoryFromGroup(
  group: Session[],
  storyId: string,
  worldBookId: string | null,
  favoriteIds: Set<string>,
  deletedSiblings: Session[],
): Story {
  const latest = pickLatest(group);
  const raw = (latest.title ?? "").trim();
  const title = !raw || raw === "空白会话" ? "未命名稿纸" : raw;
  const kind = group.some((s) => s.kind !== "blank") ? "adventure" : "blank";
  const createdAt = group.reduce((min, s) => Math.min(min, s.createdAt), group[0].createdAt);
  const pinned =
    group.some((s) => favoriteIds.has(s.id)) ||
    deletedSiblings.some((s) => favoriteIds.has(s.id));
  return {
    id: storyId,
    title,
    kind,
    status: "writing",
    groupId: kind === "blank" ? "draft" : "writing",
    pinned,
    worldBookId,
    synopsis: "",
    tags: [],
    lastOpenedAt: latest.updatedAt,
    lastVolumeId: latest.id,
    wordCount: 0,
    createdAt,
    updatedAt: latest.updatedAt,
  };
}
