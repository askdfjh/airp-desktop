import { invoke } from "@tauri-apps/api/core";
import {
  buildWorldBooksData,
  buildCharacterCardsData,
  buildConversationsData,
  buildSyncFile,
  parseSyncFile,
  computeGroupUpdatedAt,
  mergeSyncData,
  SYNC_GROUPS,
  SYNC_FILE_NAMES,
  SYNC_GROUP_LABELS,
  loadSyncState,
  saveSyncState,
  type SyncConfig,
  type SyncGroup,
  type SyncFile,
} from "@/lib/webdavSync";
import {
  validateSettingsBackup,
  getBackupGroups,
  countBackupGroupItems,
  BACKUP_GROUP_LABELS,
  type SettingsBackup,
  type BackupGroupKey,
} from "@/lib/settingsBackup";

/** WebDAV 客户端：上传/下载/冲突检测（AIRP-移动端开发日志 P1 架构） */

export type ConflictChoice = "upload" | "download" | "cancel";

export interface SyncOutcome {
  group: SyncGroup;
  status: "uploaded" | "merged" | "conflict_cancelled" | "uptodate" | "skipped_local_only" | "error";
  detail: string;
}

function normalizeBaseUrl(url: string): string {
  let u = url.trim().replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(u)) u = "https://" + u;
  return u;
}

function fileUrl(cfg: SyncConfig, group: SyncGroup): string {
  return `${normalizeBaseUrl(cfg.url)}/AIRP/${SYNC_FILE_NAMES[group]}`;
}

function dirUrl(cfg: SyncConfig): string {
  return `${normalizeBaseUrl(cfg.url)}/AIRP`;
}

async function wd(
  method: "GET" | "PUT" | "MKCOL" | "PROPFIND" | "DELETE",
  url: string,
  cfg: SyncConfig,
  body?: string,
  headers?: Record<string, string>
): Promise<{ status: number; body: string }> {
  try {
    // 注意：Rust 端命令签名为 webdav_request(args: WebdavArgs)，invoke 必须用 { args: {...} } 包裹
    const [status, text] = await invoke<[number, string]>("webdav_request", {
      args: {
        url,
        method,
        username: cfg.username,
        password: cfg.password,
        body: body ?? null,
        headers: headers ?? {},
      },
    });
    return { status, body: text };
  } catch (e) {
    throw new Error(typeof e === "string" ? e : "网络请求失败");
  }
}

function authError(status: number): string {
  if (status === 401 || status === 403) return `认证失败 (HTTP ${status})，请检查账号与应用密码`;
  return `请求失败 (HTTP ${status})`;
}

/** 确保云端 AIRP 目录存在（MKCOL；405=已存在视为成功） */
async function ensureAirpDir(cfg: SyncConfig): Promise<void> {
  const res = await wd("MKCOL", dirUrl(cfg), cfg);
  if ([200, 201, 204, 405].includes(res.status)) return;
  if (res.status === 401 || res.status === 403) throw new Error(authError(res.status));
  throw new Error(`同步目录创建失败 (HTTP ${res.status})，请检查 WebDAV 地址`);
}

/** 上传单组（覆盖云端） */
async function uploadGroup(cfg: SyncConfig, group: SyncGroup, data: unknown): Promise<number> {
  const file = buildSyncFile(group, data);
  let res = await wd("PUT", fileUrl(cfg, group), cfg, JSON.stringify(file));
  if (res.status === 409) {
    await ensureAirpDir(cfg);
    res = await wd("PUT", fileUrl(cfg, group), cfg, JSON.stringify(file));
  }
  if (![200, 201, 204].includes(res.status)) throw new Error(authError(res.status));
  return file.updatedAt;
}

/** 下载单组（返回 null = 云端无文件） */
async function downloadGroup(cfg: SyncConfig, group: SyncGroup): Promise<SyncFile | null> {
  const res = await wd("GET", fileUrl(cfg, group), cfg);
  if (res.status === 404) return null;
  if (![200, 201].includes(res.status)) throw new Error(authError(res.status));
  return parseSyncFile(res.body);
}

async function buildGroupData(group: SyncGroup): Promise<unknown> {
  if (group === "worldbooks") return buildWorldBooksData();
  if (group === "charactercards") return buildCharacterCardsData();
  return buildConversationsData();
}

/**
 * 同步全部三组。
 * mode: "upload" 时本地独有修改自动上传、远程独有修改自动下载合并；"download" 时远程独有修改自动下载合并、本地独有修改跳过。
 * 双端都有修改 → 调用 onConflict(group, localUpdatedAt, remoteUpdatedAt) 让用户选择方向；返回 "cancel" 则后续组全部跳过。
 */
export async function runSync(
  cfg: SyncConfig,
  mode: "upload" | "download",
  onConflict: (group: SyncGroup, localUpdatedAt: number, remoteUpdatedAt: number) => Promise<ConflictChoice>
): Promise<SyncOutcome[]> {
  const state = await loadSyncState();
  const outcomes: SyncOutcome[] = [];
  let cancelled = false;

  for (const group of SYNC_GROUPS) {
    if (cancelled) {
      outcomes.push({ group, status: "conflict_cancelled", detail: "已取消，未同步" });
      continue;
    }
    try {
      const data = await buildGroupData(group);
      const localUpdatedAt = computeGroupUpdatedAt(group, data);
      const remote = await downloadGroup(cfg, group);
      const remoteUpdatedAt = remote?.updatedAt ?? 0;
      const last = state.lastSyncedAt[group] ?? 0;
      const localChanged = localUpdatedAt > last;
      const remoteChanged = remoteUpdatedAt > last;

      if (localChanged && remoteChanged) {
        const choice = await onConflict(group, localUpdatedAt, remoteUpdatedAt);
        if (choice === "upload") {
          await uploadGroup(cfg, group, data);
          state.lastSyncedAt[group] = localUpdatedAt;
          outcomes.push({ group, status: "uploaded", detail: "云端已覆盖为本地版本" });
        } else if (choice === "download") {
          await mergeSyncData(group, remote!.data);
          state.lastSyncedAt[group] = Math.max(localUpdatedAt, remoteUpdatedAt);
          outcomes.push({ group, status: "merged", detail: "已下载合并（不覆盖现有）" });
        } else {
          cancelled = true;
          outcomes.push({ group, status: "conflict_cancelled", detail: "已取消，未同步" });
        }
      } else if (localChanged) {
        if (mode === "upload") {
          await uploadGroup(cfg, group, data);
          state.lastSyncedAt[group] = localUpdatedAt;
          outcomes.push({ group, status: "uploaded", detail: "已上传到云端" });
        } else {
          outcomes.push({ group, status: "skipped_local_only", detail: "本地有修改未上传（可点「上传到云端」）" });
        }
      } else if (remoteChanged) {
        await mergeSyncData(group, remote!.data);
        state.lastSyncedAt[group] = Math.max(localUpdatedAt, remoteUpdatedAt);
        outcomes.push({ group, status: "merged", detail: "已下载合并（云端较新）" });
      } else {
        outcomes.push({ group, status: "uptodate", detail: "已是最新" });
      }
    } catch (e) {
      outcomes.push({ group, status: "error", detail: e instanceof Error ? e.message : String(e) });
    }
  }

  await saveSyncState(state);
  return outcomes;
}

/** 测试连接：确保目录存在并读取 worldbooks.json，返回诊断信息 */
export async function testConnection(cfg: SyncConfig): Promise<string> {
  await ensureAirpDir(cfg);
  const res = await wd("GET", fileUrl(cfg, "worldbooks"), cfg);
  if (res.status === 404) return "连接成功，云端目录可读写（尚无同步文件）";
  if ([200, 201].includes(res.status)) return "连接成功，云端目录可读写";
  throw new Error(authError(res.status));
}

export function groupLabel(group: SyncGroup): string {
  return SYNC_GROUP_LABELS[group];
}

/* ================= 云端备份（按时间戳文件，不覆盖） ================= */

const BACKUP_DIR = "/AIRP/backups";
const BACKUP_FILE_RE = /backup-(\d{8})-(\d{6})(?:-(\d+))?\.json/i;

function backupDirUrl(cfg: SyncConfig): string {
  return `${normalizeBaseUrl(cfg.url)}${BACKUP_DIR}`;
}

function backupFileUrl(cfg: SyncConfig, name: string): string {
  return `${normalizeBaseUrl(cfg.url)}${BACKUP_DIR}/${name}`;
}

/** 解析 PROPFIND XML 中的 href 列表（兼容 D: 前缀 / 无前缀） */
function parsePropfindHrefs(xml: string): string[] {
  const hrefs: string[] = [];
  const re = /<[^>]*href[^>]*>([\s\S]*?)<\/[^>]*href[^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    const href = m[1].trim();
    if (href) hrefs.push(href);
  }
  return hrefs;
}

/** 从备份文件名解析时间戳（backup-YYYYMMDD-HHMMSS-ms.json），解析失败返回 0 */
function backupTimeFromName(name: string): number {
  const m = BACKUP_FILE_RE.exec(name);
  if (!m) return 0;
  const [, date, time, ms] = m;
  const t = new Date(
    Number(date.slice(0, 4)),
    Number(date.slice(4, 6)) - 1,
    Number(date.slice(6, 8)),
    Number(time.slice(0, 2)),
    Number(time.slice(2, 4)),
    Number(time.slice(4, 6))
  );
  return t.getTime() + (ms ? Number(ms) : 0);
}

export interface CloudBackupMeta {
  name: string;
  time: number;
  /** 来源设备：desktop / android / unknown */
  device: string;
  /** 内容摘要：组名（数量） */
  summary: string[];
}

/** 列出云端备份：PROPFIND 目录 → 解析 backup-*.json → 按时间倒序 */
export async function listCloudBackups(cfg: SyncConfig): Promise<CloudBackupMeta[]> {
  await ensureAirpDir(cfg);
  const dirRes = await wd("MKCOL", backupDirUrl(cfg), cfg);
  if (![200, 201, 204, 405].includes(dirRes.status)) throw new Error(authError(dirRes.status));

  const res = await wd("PROPFIND", backupDirUrl(cfg), cfg, undefined, { Depth: "1" });
  if (res.status === 404) return [];
  if (res.status === 207) {
    const names: { name: string; time: number }[] = [];
    for (const href of parsePropfindHrefs(res.body)) {
      const name = decodeURIComponent(href.split("/").pop() || "");
      const time = backupTimeFromName(name);
      if (time > 0) names.push({ name, time });
    }
    names.sort((a, b) => b.time - a.time);
    const metas: CloudBackupMeta[] = [];
    for (const n of names) {
      try {
        const file = await downloadCloudBackup(cfg, n.name);
        metas.push({ name: n.name, time: n.time, device: file.device ?? "unknown", summary: summarizeBackup(file) });
      } catch {
        metas.push({ name: n.name, time: n.time, device: "unknown", summary: [] });
      }
    }
    return metas;
  }
  throw new Error(authError(res.status));
}

/** 上传当前数据为云端备份（时间戳文件名，不覆盖旧备份） */
export async function uploadCloudBackup(cfg: SyncConfig, data: SettingsBackup): Promise<string> {
  await ensureAirpDir(cfg);
  const dirRes = await wd("MKCOL", backupDirUrl(cfg), cfg);
  if (![200, 201, 204, 405].includes(dirRes.status)) throw new Error(authError(dirRes.status));

  const now = new Date();
  const pad = (n: number, w = 2) => String(n).padStart(w, "0");
  const name = `backup-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}-${pad(now.getMilliseconds(), 3)}.json`;
  const res = await wd("PUT", backupFileUrl(cfg, name), cfg, JSON.stringify(data));
  if (![200, 201, 204].includes(res.status)) throw new Error(authError(res.status));
  return name;
}

/** 下载指定备份并校验 */
export async function downloadCloudBackup(cfg: SyncConfig, name: string): Promise<SettingsBackup> {
  const res = await wd("GET", backupFileUrl(cfg, name), cfg);
  if (res.status === 404) throw new Error("云端文件不存在（可能已被删除）");
  if (![200, 201].includes(res.status)) throw new Error(authError(res.status));
  const parsed: unknown = JSON.parse(res.body);
  if (!validateSettingsBackup(parsed)) throw new Error("云端备份文件格式无效或版本不匹配");
  return parsed;
}

/** 备份内容摘要：每组「名称（数量）」 */
export function summarizeBackup(data: SettingsBackup): string[] {
  return getBackupGroups(data).map((key: BackupGroupKey) =>
    `${BACKUP_GROUP_LABELS[key]}（${countBackupGroupItems(data, key)} 项）`
  );
}

/** 获取云端最新一份备份（不存在返回 null） */
export async function findLatestCloudBackup(cfg: SyncConfig): Promise<SettingsBackup | null> {
  const list = await listCloudBackups(cfg);
  if (list.length === 0) return null;
  return downloadCloudBackup(cfg, list[0].name);
}

/** 删除指定云端备份 */
export async function deleteCloudBackup(cfg: SyncConfig, name: string): Promise<void> {
  const res = await wd("DELETE", backupFileUrl(cfg, name), cfg);
  if (![200, 202, 204, 404].includes(res.status)) throw new Error(authError(res.status));
}

/**
 * 按保留策略清理旧备份（仅保留最近 N 个，超出部分删除最旧的）；返回删除数量。
 * mode=all 或 count<=0 时不做清理。
 */
export async function cleanupCloudBackups(cfg: SyncConfig, retention: { mode: "limit" | "all"; count: number }): Promise<number> {
  if (retention.mode !== "limit" || retention.count <= 0) return 0;
  const list = await listCloudBackups(cfg);
  const excess = list.slice(retention.count);
  for (const b of excess) {
    try {
      await deleteCloudBackup(cfg, b.name);
    } catch {
      // 单个删除失败不阻塞其余清理
    }
  }
  return excess.length;
}
