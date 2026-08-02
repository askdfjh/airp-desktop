import {
  snapshotSettingsTables,
  snapshotConversations,
  mergeWorldBooks,
  mergeCharacterCards,
  restoreConversations,
  getAppSetting,
  setAppSetting,
  type ConversationsSnapshot,
} from "@/lib/db";

/** WebDAV 云端同步：三组独立文件（对应 AIRP-移动端开发日志 P1 同步架构） */

export const SYNC_SPEC = "airp_sync_v1";

export type SyncGroup = "worldbooks" | "charactercards" | "conversations";

export const SYNC_GROUPS: SyncGroup[] = ["worldbooks", "charactercards", "conversations"];

export const SYNC_GROUP_LABELS: Record<SyncGroup, string> = {
  worldbooks: "世界书与词条",
  charactercards: "角色卡与提取卡",
  conversations: "会话与消息",
};

/** 云端文件名（目录名固定 AIRP） */
export const SYNC_FILE_NAMES: Record<SyncGroup, string> = {
  worldbooks: "worldbooks.json",
  charactercards: "charactercards.json",
  conversations: "conversations.json",
};

export interface SyncFile {
  spec: string;
  group: SyncGroup;
  updatedAt: number;
  data: unknown;
}

export interface WorldBooksData {
  worldBooks: Record<string, unknown>[];
  worldBookEntries: Record<string, unknown>[];
}

export interface CharacterCardsData {
  characterCards: Record<string, unknown>[];
}

/** 生成本组数据快照（原始行，含 isBuiltin 等标记） */
export async function buildWorldBooksData(): Promise<WorldBooksData> {
  const s = await snapshotSettingsTables(["worldBooks", "worldBookEntries"]);
  return { worldBooks: s.worldBooks ?? [], worldBookEntries: s.worldBookEntries ?? [] };
}

export async function buildCharacterCardsData(): Promise<CharacterCardsData> {
  const s = await snapshotSettingsTables(["characterCards"]);
  return { characterCards: s.characterCards ?? [] };
}

export async function buildConversationsData(): Promise<ConversationsSnapshot> {
  return snapshotConversations();
}

/** 组级时间戳：本组所有行的最新修改时间（无 updatedAt 的表用 createdAt） */
export function computeGroupUpdatedAt(group: SyncGroup, data: unknown): number {
  if (group === "worldbooks") {
    const d = data as WorldBooksData;
    return Math.max(
      0,
      ...(d.worldBooks ?? []).map((r) => Number(r.updatedAt) || 0),
      ...(d.worldBookEntries ?? []).map((r) => Number(r.updatedAt) || 0)
    );
  }
  if (group === "charactercards") {
    const d = data as CharacterCardsData;
    return Math.max(0, ...(d.characterCards ?? []).map((r) => Number(r.updatedAt) || 0));
  }
  const d = data as ConversationsSnapshot;
  return Math.max(
    0,
    ...(d.sessions ?? []).map((r) => Number(r.updatedAt) || 0),
    ...(d.messages ?? []).map((r) => Number(r.createdAt) || 0),
    ...(d.favorites ?? []).map((r) => Number(r.createdAt) || 0),
    ...(d.sessionCharacters ?? []).map((r) => Number(r.createdAt) || 0),
    ...(d.sessionCharacterCards ?? []).map((r) => Number(r.createdAt) || 0),
    ...(d.characterArcs ?? []).map((r) => Number(r.createdAt) || 0)
  );
}

export function buildSyncFile(group: SyncGroup, data: unknown): SyncFile {
  return { spec: SYNC_SPEC, group, updatedAt: computeGroupUpdatedAt(group, data), data };
}

/** 解析并校验云端文件（spec / group / updatedAt / data） */
export function parseSyncFile(raw: string): SyncFile {
  const parsed: unknown = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object") throw new Error("云端文件不是有效 JSON");
  const f = parsed as Partial<SyncFile>;
  if (f.spec !== SYNC_SPEC || !SYNC_GROUPS.includes(f.group as SyncGroup) || typeof f.updatedAt !== "number" || f.data === undefined || f.data === null) {
    throw new Error("云端文件格式无效或版本不匹配");
  }
  return f as SyncFile;
}

/** 合并导入（INSERT OR IGNORE，同 ID 跳过，不覆盖现有）；返回中文摘要 */
export async function mergeSyncData(group: SyncGroup, data: unknown): Promise<string> {
  if (group === "worldbooks") {
    const { books, entries } = await mergeWorldBooks(data as WorldBooksData);
    return `世界书 ${books} 本 / 词条 ${entries} 条`;
  }
  if (group === "charactercards") {
    const n = await mergeCharacterCards((data as CharacterCardsData).characterCards ?? []);
    return `角色卡 ${n} 张`;
  }
  await restoreConversations(data as ConversationsSnapshot);
  return "会话与消息已合并（同 ID 跳过）";
}

/* ---------- 同步配置与状态持久化（app_settings） ---------- */

export interface SyncConfig {
  url: string;
  username: string;
  password: string;
}

export interface SyncState {
  /** 每组上次成功同步时间（组级 updatedAt） */
  lastSyncedAt: Partial<Record<SyncGroup, number>>;
}

const SYNC_CONFIG_KEY = "sync_config";
const SYNC_STATE_KEY = "sync_state";

export async function loadSyncConfig(): Promise<SyncConfig> {
  const raw = await getAppSetting(SYNC_CONFIG_KEY);
  if (!raw) return { url: "", username: "", password: "" };
  try {
    const c = JSON.parse(raw) as Partial<SyncConfig>;
    return { url: c.url ?? "", username: c.username ?? "", password: c.password ?? "" };
  } catch {
    return { url: "", username: "", password: "" };
  }
}

export async function saveSyncConfig(cfg: SyncConfig): Promise<void> {
  await setAppSetting(SYNC_CONFIG_KEY, JSON.stringify(cfg));
}

export async function loadSyncState(): Promise<SyncState> {
  const raw = await getAppSetting(SYNC_STATE_KEY);
  if (!raw) return { lastSyncedAt: {} };
  try {
    const s = JSON.parse(raw) as Partial<SyncState>;
    return { lastSyncedAt: s.lastSyncedAt ?? {} };
  } catch {
    return { lastSyncedAt: {} };
  }
}

export async function saveSyncState(state: SyncState): Promise<void> {
  await setAppSetting(SYNC_STATE_KEY, JSON.stringify(state));
}
