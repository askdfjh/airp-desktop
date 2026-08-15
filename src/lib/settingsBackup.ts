import {
  snapshotSettingsTables,
  restoreSettingsTables,
  snapshotConversations,
  restoreConversations,
  type SettingsDbSnapshot,
  type ConversationsSnapshot,
} from "@/lib/db";
import { useProviderStore } from "@/stores/providerStore";
import { useUIStore } from "@/stores/uiStore";
import { useGenerationStore } from "@/stores/generationStore";
import { usePromptInjectionStore } from "@/stores/promptInjectionStore";
import { useWorldStore } from "@/stores/worldStore";
import { useTemplateStore } from "@/stores/templateStore";
import { useCharacterStore } from "@/stores/characterStore";
import { useMcpStore } from "@/stores/mcpStore";
import { useSessionStore } from "@/stores/sessionStore";
import { useStoryStore } from "@/stores/storyStore";

/** 备份文件标识与版本 */
export const SETTINGS_BACKUP_TYPE = "airp-settings-backup";
export const SETTINGS_BACKUP_VERSION = 1;

/** 可独立勾选导出的数据项（设置 + 对话记录） */
export type BackupGroupKey =
  | "providers"
  | "ui"
  | "generation"
  | "promptInjection"
  | "tools"
  | "mcp"
  | "templates"
  | "characterCards"
  | "characters"
  | "worldRules"
  | "worldBooks"
  | "conversations"
  | "stories";

export const ALL_BACKUP_GROUPS: BackupGroupKey[] = [
  "providers",
  "ui",
  "generation",
  "promptInjection",
  "tools",
  "mcp",
  "templates",
  "characterCards",
  "characters",
  "worldRules",
  "worldBooks",
  "conversations",
  "stories",
];

export const BACKUP_GROUP_LABELS: Record<BackupGroupKey, string> = {
  providers: "模型服务配置（含 API 密钥）",
  ui: "界面偏好（主题 / 字体 / 联网 / MCP 开关）",
  generation: "输出预设",
  promptInjection: "提示词注入规则",
  tools: "工具设置（搜索服务商 / API Key）",
  mcp: "MCP 服务器配置",
  templates: "Prompt 模板库",
  characterCards: "角色卡",
  characters: "角色设定",
  worldRules: "旧规则表（已废弃，仅兼容导入）",
  worldBooks: "规则书与词条",
  conversations: "会话与消息（含收藏 / 回收站 / 角色弧光 / 提取角色卡）",
  stories: "故事 / 书架",
};

/** 每个数据项对应的 localStorage 键 */
const GROUP_LOCAL_STORAGE_KEYS: Record<BackupGroupKey, string[]> = {
  providers: ["airp-providers"],
  ui: ["airp-ui-v3"],
  generation: ["airp-generation-v1"],
  promptInjection: ["airp-prompt-injection-v1"],
  tools: [],
  mcp: [],
  templates: [],
  characterCards: [],
  characters: [],
  worldRules: [],
  worldBooks: [],
  conversations: [],
  stories: [],
};

/** 每个数据项对应的 SQLite 设置表 */
const GROUP_DB_TABLES: Record<BackupGroupKey, (keyof SettingsDbSnapshot)[]> = {
  providers: [],
  ui: [],
  generation: [],
  promptInjection: [],
  tools: ["appSettings"],
  mcp: ["mcpServers"],
  templates: ["promptTemplates"],
  characterCards: ["characterCards"],
  characters: ["characters"],
  worldRules: ["worldRules"],
  worldBooks: ["worldBooks", "worldBookEntries"],
  conversations: [],
  stories: ["stories"],
};

export interface SettingsBackup {
  app: string;
  type: string;
  version: number;
  exportedAt: string;
  /** 导出设备：desktop（桌面端）/ android（安卓端）；兼容旧备份（无此字段） */
  device?: "desktop" | "android";
  groups: BackupGroupKey[];
  localStorage: Record<string, string | null>;
  database: Partial<SettingsDbSnapshot>;
  /** 勾选「会话与消息」时写入 */
  conversations?: ConversationsSnapshot;
}

export const DEVICE_LABELS: Record<string, string> = {
  desktop: "桌面端",
  android: "安卓端",
};

export function currentDevice(): "desktop" | "android" {
  return typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent) ? "android" : "desktop";
}

/** 按勾选收集数据（localStorage + SQLite 设置表 + 会话消息）；不传则导出全部 */
export async function exportAllData(
  groups: BackupGroupKey[] = ALL_BACKUP_GROUPS
): Promise<SettingsBackup> {
  const selected = new Set(groups);
  const localStorageData: Record<string, string | null> = {};
  const tables = new Set<keyof SettingsDbSnapshot>();
  for (const key of ALL_BACKUP_GROUPS) {
    if (!selected.has(key)) continue;
    for (const lsKey of GROUP_LOCAL_STORAGE_KEYS[key]) {
      localStorageData[lsKey] = localStorage.getItem(lsKey);
    }
    for (const t of GROUP_DB_TABLES[key]) {
      tables.add(t);
    }
  }
  const database = await snapshotSettingsTables([...tables]);
  const conversations = selected.has("conversations") ? await snapshotConversations() : undefined;
  return {
    app: "AIRP",
    type: SETTINGS_BACKUP_TYPE,
    version: SETTINGS_BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    device: currentDevice(),
    groups: ALL_BACKUP_GROUPS.filter((k) => selected.has(k)),
    localStorage: localStorageData,
    database,
    ...(conversations ? { conversations } : {}),
  };
}

/** 校验导入文件是否为合法的 AIRP 备份（兼容旧版本：app 标识、type、version、缺字段均放宽） */
export function validateSettingsBackup(data: unknown): data is SettingsBackup {
  if (!data || typeof data !== "object") return false;
  const d = data as Record<string, unknown>;
  // app 标识：新版 "AIRP"，兼容旧标识（含 airp）
  const appOk = d.app === "AIRP" || (typeof d.app === "string" && d.app.toLowerCase().includes("airp"));
  // type：必须为 AIRP 备份类型（兼容历史 type 前缀）
  const typeOk = typeof d.type === "string" && d.type.toLowerCase().includes("airp");
  if (!appOk || !typeOk) return false;
  // localStorage / database 允许缺失（旧版可能只存其一）
  if (d.localStorage !== undefined && (typeof d.localStorage !== "object" || d.localStorage === null)) return false;
  if (d.database !== undefined && (typeof d.database !== "object" || d.database === null)) return false;
  return true;
}

/** 备份实际包含的数据项（兼容旧版备份文件：无 groups 字段时按内容推导；localStorage/database 可能缺失） */
export function getBackupGroups(data: SettingsBackup): BackupGroupKey[] {
  if (Array.isArray(data.groups) && data.groups.length > 0) {
    return ALL_BACKUP_GROUPS.filter((k) => (data.groups as string[]).includes(k));
  }
  const ls = data.localStorage ?? {};
  const dbSnap = data.database ?? {};
  const inferred = ALL_BACKUP_GROUPS.filter((key) => {
    const hasLs = GROUP_LOCAL_STORAGE_KEYS[key].some((k) => k in ls);
    const hasDb = GROUP_DB_TABLES[key].some((t) => dbSnap[t] !== undefined);
    return hasLs || hasDb;
  });
  if (data.conversations) inferred.push("conversations");
  return inferred;
}

function countGroupItems(data: SettingsBackup, key: BackupGroupKey): number {  let n = 0;
  const ls = data.localStorage ?? {};
  const dbSnap = data.database ?? {};
  for (const lsKey of GROUP_LOCAL_STORAGE_KEYS[key]) {
    const raw = ls[lsKey];
    if (!raw) continue;
    try {
      const st = JSON.parse(raw)?.state;
      if (lsKey === "airp-providers") n += Array.isArray(st?.providers) ? st.providers.length : 1;
      else if (lsKey === "airp-generation-v1") n += Array.isArray(st?.presets) ? st.presets.length : 1;
      else if (lsKey === "airp-prompt-injection-v1") n += Array.isArray(st?.items) ? st.items.length : 1;
      else n += 1;
    } catch {
      n += 1;
    }
  }
  for (const t of GROUP_DB_TABLES[key]) {
    const rows = dbSnap[t];
    if (Array.isArray(rows)) n += rows.length;
  }
  return n;
}

/** 某组在备份中的条目数（localStorage store 元素数 + SQLite 行数）；供列表预览使用 */
export function countBackupGroupItems(data: SettingsBackup, key: BackupGroupKey): number {
  return countGroupItems(data, key);
}

/** 按指定组生成摘要：每项一行「名称（数量）」 */
export function summarizeGroups(data: SettingsBackup, groups: BackupGroupKey[]): string[] {
  return groups.map((key) => {
    if (key === "worldBooks") {
      const books = data.database?.worldBooks?.length ?? 0;
      const entries = data.database?.worldBookEntries?.length ?? 0;
      return `规则书与词条（${books} 本 / ${entries} 词条）`;
    }
    if (key === "stories") {
      const n = data.database?.stories?.length ?? 0;
      return `故事（${n} 本）`;
    }
    if (key === "conversations") {
      const sessions = data.conversations?.sessions?.length ?? 0;
      const messages = data.conversations?.messages?.length ?? 0;
      const trash = data.conversations?.sessions?.filter((s) => Number(s.deleted) === 1).length ?? 0;
      const cards = data.conversations?.sessionCharacterCards?.length ?? 0;
      const trashText = trash > 0 ? `，含回收站 ${trash} 个` : "";
      const cardsText = cards > 0 ? `，提取角色卡 ${cards} 张` : "";
      return `会话与消息（${sessions} 个会话 / ${messages} 条消息${trashText}${cardsText}）`;
    }
    return `${BACKUP_GROUP_LABELS[key]}（${countGroupItems(data, key)} 项）`;
  });
}

/** 导入结果摘要：每项一行「名称（数量）」 */
export function summarizeImportedGroups(data: SettingsBackup): string[] {
  return summarizeGroups(data, getBackupGroups(data));
}

/** 按勾选组比较两份备份内容是否一致（忽略元数据与未勾选组；跨设备时 localStorage 差异不影响判断） */
export function backupContentEquals(a: SettingsBackup, b: SettingsBackup, groups?: BackupGroupKey[]): boolean {
  const selected = new Set(groups ?? getBackupGroups(a));
  const lsKeys = new Set<string>();
  const tables = new Set<keyof SettingsDbSnapshot>();
  for (const key of ALL_BACKUP_GROUPS) {
    if (!selected.has(key)) continue;
    for (const k of GROUP_LOCAL_STORAGE_KEYS[key]) lsKeys.add(k);
    for (const t of GROUP_DB_TABLES[key]) tables.add(t);
  }
  const normLs = (d: SettingsBackup) => {
    const out: Record<string, string | null> = {};
    for (const k of lsKeys) out[k] = d.localStorage?.[k] ?? null;
    return JSON.stringify(out);
  };
  const normDb = (d: SettingsBackup) => {
    const out: Record<string, unknown> = {};
    for (const t of tables) out[t] = d.database?.[t];
    return JSON.stringify(out);
  };
  if (normLs(a) !== normLs(b)) return false;
  if (normDb(a) !== normDb(b)) return false;
  if (selected.has("conversations") && JSON.stringify(a.conversations ?? null) !== JSON.stringify(b.conversations ?? null)) return false;
  return true;
}

/** 导入备份：按勾选的组写回（localStorage + SQLite 表 + 会话合并），并重新水合各 store；不传 groups 则导入备份包含的全部组 */
export async function importAllData(data: SettingsBackup, groups?: BackupGroupKey[]): Promise<void> {
  const selected = new Set(groups ?? getBackupGroups(data));
  const lsData = data.localStorage ?? {};
  const dbData = data.database ?? {};
  // 1. localStorage（仅处理选中组的键，未选中的不动；旧备份缺失时跳过）
  for (const key of ALL_BACKUP_GROUPS) {
    if (!selected.has(key)) continue;
    for (const lsKey of GROUP_LOCAL_STORAGE_KEYS[key]) {
      const v = lsData[lsKey];
      if (v === null || v === undefined) {
        localStorage.removeItem(lsKey);
      } else {
        localStorage.setItem(lsKey, v);
      }
    }
  }
  // 2. SQLite 设置表整体替换（仅选中组对应的表）
  const tables = new Set<keyof SettingsDbSnapshot>();
  for (const key of ALL_BACKUP_GROUPS) {
    if (!selected.has(key)) continue;
    for (const t of GROUP_DB_TABLES[key]) tables.add(t);
  }
  const snap: Partial<SettingsDbSnapshot> = {};
  for (const t of tables) snap[t] = dbData[t];
  await restoreSettingsTables(snap);
  // 3. 会话与消息合并恢复（同 ID 跳过，不覆盖现有）
  if (selected.has("conversations") && data.conversations) {
    await restoreConversations(data.conversations);
  }
  // 4. 重新水合内存状态（localStorage store + DB store）
  await Promise.allSettled([
    useProviderStore.persist.rehydrate(),
    useUIStore.persist.rehydrate(),
    useGenerationStore.persist.rehydrate(),
    usePromptInjectionStore.persist.rehydrate(),
    useWorldStore.getState().loadFromDb(),
    useTemplateStore.getState().loadFromDb(),
    useCharacterStore.getState().loadFromDb(),
    useCharacterStore.getState().loadCharactersFromDb(),
    useMcpStore.getState().loadFromDb(),
    useSessionStore.getState().loadFromDb(),
  ]);
  const loadStoriesFromDb = useStoryStore.getState().loadFromDb;
  if (typeof loadStoriesFromDb === "function") {
    await loadStoriesFromDb();
  }
}
