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
  method: "GET" | "PUT" | "MKCOL",
  url: string,
  cfg: SyncConfig,
  body?: string
): Promise<{ status: number; body: string }> {
  try {
    const [status, text] = await invoke<[number, string]>("webdav_request", {
      args: {
        url,
        method,
        username: cfg.username,
        password: cfg.password,
        body: body ?? null,
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
