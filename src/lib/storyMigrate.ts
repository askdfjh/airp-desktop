import type { Session, Story } from "@/types";
import {
  getAppSetting,
  setAppSetting,
  loadSessions,
  updateSession,
  insertStoryIfAbsent,
  loadActiveWorldBook,
} from "./db";

/** 启动一次性迁移：未删会话按链折成书。空库也写 marker。 */
export async function migrateStoriesOnInit(): Promise<void> {
  if ((await getAppSetting("story_migration")) === "1") return;
  await foldSessions({ onlyMissingStoryId: false });
  await setAppSetting("story_migration", "1");
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
    const key = s.chainId || s.id;
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

  for (const [storyId, group] of groups) {
    await insertStoryIfAbsent(buildStoryFromGroup(group, storyId, worldBookId));
    for (const s of group) {
      if (s.storyId !== storyId) {
        await updateSession(s.id, { storyId });
      }
    }
  }
}

function pickLatest(list: Session[]): Session {
  return list.reduce((a, b) => (b.updatedAt >= a.updatedAt ? b : a));
}

function buildStoryFromGroup(group: Session[], storyId: string, worldBookId: string | null): Story {
  const latest = pickLatest(group);
  const unlocked = group.filter((s) => !s.locked);
  const titleSrc = unlocked.length > 0 ? pickLatest(unlocked) : latest;
  const title = titleSrc.title === "空白会话" ? "未命名稿纸" : titleSrc.title;
  const blankOnly = group.every((s) => s.kind === "blank");
  const createdAt = group.reduce((min, s) => Math.min(min, s.createdAt), group[0].createdAt);
  return {
    id: storyId,
    title,
    kind: blankOnly ? "blank" : "adventure",
    status: "writing",
    groupId: blankOnly ? "draft" : "writing",
    pinned: false,
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
