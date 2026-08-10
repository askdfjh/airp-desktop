import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Download, Upload, ShieldAlert, CheckCircle2, Loader2, Check, Globe, CloudUpload, CloudDownload, RefreshCw, Clock, Bug } from "lucide-react";
import { buildDebugExport } from "@/lib/debugExport";
import { testConnection, listCloudBackups, uploadCloudBackup, downloadCloudBackup, cleanupCloudBackups, findLatestCloudBackup, summarizeBackup, type CloudBackupMeta } from "@/lib/webdavClient";
import { loadSyncConfig, saveSyncConfig, loadBackupRetention, saveBackupRetention, type SyncConfig, type BackupRetention } from "@/lib/webdavSync";
import { save, open } from "@tauri-apps/plugin-dialog";
import { writeTextFile, readTextFile } from "@tauri-apps/plugin-fs";
import {
  exportAllData,
  importAllData,
  validateSettingsBackup,
  summarizeGroups,
  getBackupGroups,
  backupContentEquals,
  ALL_BACKUP_GROUPS,
  BACKUP_GROUP_LABELS,
  DEVICE_LABELS,
  type SettingsBackup,
  type BackupGroupKey,
} from "@/lib/settingsBackup";
import { useUIStore } from "@/stores/uiStore";
import { ComplianceNotice } from "./ComplianceNotice";

interface ImportTarget {
  data: SettingsBackup;
  source: string;
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function DataPanel() {
  const notify = useUIStore((s) => s.notify);
  const effectiveTheme = useUIStore((s) => s.effectiveTheme);
  const isAndroid = typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent);
  const [busy, setBusy] = useState<"export" | "import" | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSummary, setImportSummary] = useState<string[] | null>(null);
  const [selectedGroups, setSelectedGroups] = useState<Set<BackupGroupKey>>(
    () => new Set(ALL_BACKUP_GROUPS)
  );
  // 导入确认（本地文件 / 云端备份共用）：显示内容让用户勾选后导入
  const [importTarget, setImportTarget] = useState<ImportTarget | null>(null);
  const [importGroups, setImportGroups] = useState<Set<BackupGroupKey>>(() => new Set());

  const toggleGroup = (key: BackupGroupKey) => {
    setSelectedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleExport = async () => {
    if (busy || selectedGroups.size === 0) return;
    setBusy("export");
    setImportError(null);
    try {
      const defaultName = `narra-backup-${new Date().toISOString().slice(0, 10)}.json`;
      const path = await save({
        title: "导出所选数据",
        defaultPath: defaultName,
        filters: [{ name: "JSON", extensions: ["json"] }],
      });
      if (!path) return;
      const picked = ALL_BACKUP_GROUPS.filter((k) => selectedGroups.has(k));
      const data = await exportAllData(picked);
      await writeTextFile(path, JSON.stringify(data, null, 2));
      notify(`已导出 ${data.groups.length} 项数据`);
    } catch (e) {
      console.error("[settings] export failed:", e);
      notify("导出失败：" + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(null);
    }
  };

  // 导出诊断信息（不含任何密钥）：完整请求上下文/注入/统计，供开发者定位问题
  const handleDebugExport = async () => {
    if (busy) return;
    setBusy("export");
    setImportError(null);
    try {
      const data = await buildDebugExport();
      const defaultName = `narra-debug-${new Date().toISOString().slice(0, 10)}.json`;
      const path = await save({
        title: "导出诊断信息",
        defaultPath: defaultName,
        filters: [{ name: "JSON", extensions: ["json"] }],
      });
      if (!path) return;
      await writeTextFile(path, JSON.stringify(data, null, 2));
      notify("诊断信息已导出（不含密钥），可发送给开发者分析");
    } catch (e) {
      console.error("[debug] export failed:", e);
      notify("诊断导出失败：" + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(null);
    }
  };

  const handlePickImport = async () => {
    if (busy) return;
    setImportError(null);
    setImportSummary(null);
    try {
      const path = await open({
        title: "导入备份文件",
        multiple: false,
        filters: [{ name: "JSON", extensions: ["json"] }],
      });
      if (!path || Array.isArray(path)) return;
      const raw = await readTextFile(path);
      const parsed: unknown = JSON.parse(raw);
      if (!validateSettingsBackup(parsed)) {
        setImportError("不是有效的备份文件");
        return;
      }
      openImportDialog(parsed, `本地文件 ${path.split(/[\\/]/).pop() || path}`);
    } catch (e) {
      console.error("[settings] import failed:", e);
      setImportError("读取文件失败，请确认文件格式正确");
    }
  };

  // 打开导入确认弹窗：默认勾选备份包含的全部组
  const openImportDialog = (data: SettingsBackup, source: string) => {
    setImportTarget({ data, source });
    setImportGroups(new Set(getBackupGroups(data)));
    setImportError(null);
  };

  const handleConfirmImport = async () => {
    if (!importTarget || importGroups.size === 0) return;
    const { data } = importTarget;
    setBusy("import");
    setImportError(null);
    try {
      await importAllData(data, ALL_BACKUP_GROUPS.filter((k) => importGroups.has(k)));
      const summary = summarizeGroups(data, ALL_BACKUP_GROUPS.filter((k) => importGroups.has(k)));
      setImportSummary(summary);
      notify(`已导入 ${summary.length} 项数据`);
    } catch (e) {
      console.error("[settings] import failed:", e);
      setImportError("导入失败，请重试");
    } finally {
      setBusy(null);
      setImportTarget(null);
      if (importTarget.source.startsWith("云端")) void refreshBackups();
    }
  };

  /* ---------- 云端备份（WebDAV） ---------- */
  const [syncCfg, setSyncCfg] = useState<SyncConfig>({ url: "", username: "", password: "" });
  const [syncBusy, setSyncBusy] = useState<"test" | "upload" | "list" | null>(null);
  const [syncNotice, setSyncNotice] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [backups, setBackups] = useState<CloudBackupMeta[] | null>(null);
  const [backupLoading, setBackupLoading] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [retention, setRetention] = useState<BackupRetention>({ mode: "limit", count: 30 });
  const cfgValid = syncCfg.url.trim() && syncCfg.username.trim() && syncCfg.password;

  useEffect(() => {
    loadSyncConfig().then((c) => setSyncCfg(c)).catch(() => {});
    loadBackupRetention().then((r) => setRetention(r)).catch(() => {});
  }, []);

  const checkCfg = (): boolean => {
    if (!cfgValid) {
      setSyncNotice({ type: "error", text: "请先填写 WebDAV 地址、账号与应用密码" });
      return false;
    }
    return true;
  };

  const handleTest = async () => {
    if (syncBusy) return;
    if (!checkCfg()) return;
    setSyncBusy("test");
    setSyncNotice(null);
    try {
      await saveSyncConfig(syncCfg);
      const msg = await testConnection(syncCfg);
      setSyncNotice({ type: "ok", text: msg });
    } catch (e) {
      setSyncNotice({ type: "error", text: e instanceof Error ? e.message : String(e) });
    } finally {
      setSyncBusy(null);
    }
  };

  // 刷新云端备份列表（按时间倒序 + 内容摘要）
  const refreshBackups = async () => {
    if (backupLoading) return;
    if (!checkCfg()) return;
    setBackupLoading(true);
    setSyncNotice(null);
    try {
      await saveSyncConfig(syncCfg);
      const list = await listCloudBackups(syncCfg);
      setBackups(list);
      if (list.length === 0) setSyncNotice({ type: "ok", text: "云端暂无备份" });
    } catch (e) {
      setSyncNotice({ type: "error", text: "获取备份列表失败：" + (e instanceof Error ? e.message : String(e)) });
      setBackups([]);
    } finally {
      setBackupLoading(false);
    }
  };

  // 上传当前数据为云端备份（时间戳文件名，不覆盖旧备份）
  const handleUploadBackup = async () => {
    if (syncBusy || busy) return;
    if (!checkCfg()) return;
    if (selectedGroups.size === 0) {
      setSyncNotice({ type: "error", text: "请先勾选要备份的内容" });
      return;
    }
    setSyncBusy("upload");
    setSyncNotice(null);
    try {
      await saveSyncConfig(syncCfg);
      const picked = ALL_BACKUP_GROUPS.filter((k) => selectedGroups.has(k));
      const data = await exportAllData(picked);
      // 内容相同（仅比较勾选组范围）→ 提示已是最新，不重复上传
      const latest = await findLatestCloudBackup(syncCfg);
      if (latest && backupContentEquals(data, latest, picked)) {
        setSyncNotice({ type: "ok", text: "内容未变化，已是最新备份，无需重复上传" });
        return;
      }
      const name = await uploadCloudBackup(syncCfg, data);
      // 按保留策略清理旧备份
      const removed = await cleanupCloudBackups(syncCfg, retention);
      setSyncNotice({ type: "ok", text: `已上传备份 ${formatTime(Date.now())}（${data.groups.length} 项内容）` + (removed > 0 ? `，已清理 ${removed} 个旧备份` : "") });
      await refreshBackups();
    } catch (e) {
      setSyncNotice({ type: "error", text: "上传失败：" + (e instanceof Error ? e.message : String(e)) });
    } finally {
      setSyncBusy(null);
    }
  };

  // 保留策略变更：保存
  const handleRetentionChange = (next: BackupRetention) => {
    setRetention(next);
    void saveBackupRetention(next);
  };

  // 选择云端备份 → 下载并弹出内容选择确认
  const handleImportBackup = async (name: string) => {
    if (busy) return;
    setSyncNotice(null);
    try {
      const data = await downloadCloudBackup(syncCfg, name);
      const deviceLabel = DEVICE_LABELS[data.device ?? "unknown"] ?? "未知设备";
      openImportDialog(data, `云端备份 ${formatTime(backupTimeOf(name))} · ${deviceLabel}`);
    } catch (e) {
      setSyncNotice({ type: "error", text: "下载备份失败：" + (e instanceof Error ? e.message : String(e)) });
    }
  };

  const backupTimeOf = (name: string): number => {
    const m = /backup-(\d{8})-(\d{6})/.exec(name);
    if (!m) return 0;
    const [, date, time] = m;
    return new Date(
      Number(date.slice(0, 4)), Number(date.slice(4, 6)) - 1, Number(date.slice(6, 8)),
      Number(time.slice(0, 2)), Number(time.slice(2, 4)), Number(time.slice(4, 6))
    ).getTime();
  };

  const inputStyle = { width: "100%", padding: "9px 12px", borderRadius: 12, background: "var(--seed-input-bg)", border: "1px solid var(--seed-border)", color: "var(--seed-fg)", fontSize: "var(--fs-12)", fontFamily: "inherit", outline: "none" } as const;

  const syncInput = (key: keyof SyncConfig, placeholder: string, type: "text" | "password" = "text") => (
    <input
      type={type}
      value={syncCfg[key]}
      placeholder={placeholder}
      onChange={(e) => setSyncCfg((prev) => ({ ...prev, [key]: e.target.value }))}
      style={inputStyle}
    />
  );

  const importDialogGroups = importTarget ? getBackupGroups(importTarget.data) : [];

  // 导入确认弹窗内容（桌面端内联渲染；安卓端挂到 body，避免被动画 transform 包含块截断遮罩）
  const importDialog = importTarget && (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 2000,
        background: "rgba(0,0,0,0.45)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)",
        display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
        animation: "seed-fade-in-up 0.18s ease-out",
      }}
      onClick={() => { if (busy !== "import") setImportTarget(null); }}
    >
      <div
        style={{
          width: 460, maxWidth: "calc(100vw - 32px)", maxHeight: "82vh",
          display: "flex", flexDirection: "column",
          padding: "26px 26px 22px", background: "var(--seed-surface)",
          border: "1px solid var(--seed-border)", borderRadius: 18,
          boxShadow: "0 16px 64px rgba(0,0,0,0.5)", animation: "seed-fade-in-up 0.22s ease-out",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
          <div style={{ width: 38, height: 38, borderRadius: 11, background: "var(--seed-accent-bg)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Upload size={16} style={{ color: "var(--seed-accent)" }} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "var(--seed-fg)" }}>导入备份</div>
            <div style={{ fontSize: "var(--fs-11)", color: "var(--seed-muted)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {importTarget.source}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "12px 0 8px" }}>
          <span style={{ fontSize: "var(--fs-11)", fontWeight: 500, color: "var(--seed-muted)" }}>
            选择要导入的内容（{importGroups.size}/{importDialogGroups.length}）
          </span>
          <div style={{ display: "flex", gap: 6 }}>
            <button
              onClick={() => setImportGroups(new Set(importDialogGroups))}
              style={{ padding: "3px 10px", borderRadius: 999, border: "1px solid var(--seed-border)", background: "transparent", color: "var(--seed-muted)", fontSize: "var(--fs-10)", cursor: "pointer" }}
            >
              全选
            </button>
            <button
              onClick={() => setImportGroups(new Set())}
              style={{ padding: "3px 10px", borderRadius: 999, border: "1px solid var(--seed-border)", background: "transparent", color: "var(--seed-muted)", fontSize: "var(--fs-10)", cursor: "pointer" }}
            >
              清空
            </button>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
          {importDialogGroups.map((key) => {
            const checked = importGroups.has(key);
            const count = summarizeGroups(importTarget.data, [key])[0] ?? BACKUP_GROUP_LABELS[key];
            return (
              <button
                key={key}
                onClick={() => setImportGroups((prev) => {
                  const next = new Set(prev);
                  if (next.has(key)) next.delete(key);
                  else next.add(key);
                  return next;
                })}
                style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "9px 12px", borderRadius: 12, cursor: "pointer",
                  textAlign: "left", fontSize: "var(--fs-11)", lineHeight: 1.35,
                  color: "var(--seed-fg)",
                  background: checked ? "var(--seed-accent-bg)" : "var(--seed-hover-bg)",
                  border: checked ? "1px solid var(--seed-accent-border)" : "1px solid var(--seed-border)",
                  transition: "all 0.12s",
                }}
              >
                <span style={{
                  width: 16, height: 16, borderRadius: 4, flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: checked ? "var(--seed-accent)" : "transparent",
                  border: "1px solid " + (checked ? "var(--seed-accent)" : "var(--seed-border)"),
                  transition: "all 0.12s",
                }}>
                  {checked && <Check size={11} style={{ color: "#fff" }} />}
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>{count}</span>
              </button>
            );
          })}
        </div>

        <div style={{ display: "flex", gap: 8, padding: "10px 12px", borderRadius: 12, background: "color-mix(in srgb, #f59e0b 7%, transparent)", border: "1px solid color-mix(in srgb, #f59e0b 28%, transparent)", marginBottom: 16 }}>
          <ShieldAlert size={13} style={{ color: "#f59e0b", flexShrink: 0, marginTop: 1 }} />
          <span style={{ fontSize: "var(--fs-10)", color: "var(--seed-muted)", lineHeight: 1.55 }}>
             设置类内容（模型服务 / 界面偏好 / 提示词等）将覆盖现有配置；规则书 / 角色卡 / 会话以合并方式导入，已存在的保留不覆盖
          </span>
        </div>

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button
            onClick={() => setImportTarget(null)}
            disabled={busy === "import"}
            style={{ padding: "9px 18px", borderRadius: 10, fontSize: "var(--fs-12)", border: "1px solid var(--seed-border)", background: "transparent", color: "var(--seed-muted)", cursor: "pointer", opacity: busy === "import" ? 0.5 : 1 }}
          >
            取消
          </button>
          <button
            onClick={() => void handleConfirmImport()}
            disabled={busy === "import" || importGroups.size === 0}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "9px 20px", borderRadius: 10, fontSize: "var(--fs-12)", fontWeight: 600, border: "none", background: "var(--seed-accent)", color: "#fff", cursor: importGroups.size === 0 ? "not-allowed" : "pointer", opacity: busy === "import" || importGroups.size === 0 ? 0.6 : 1 }}
          >
            {busy === "import" ? <Loader2 size={13} className="seed-spin" /> : <Upload size={13} />}
            导入所选（{importGroups.size} 项）
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ maxWidth: 640, width: "100%", display: "flex", flexDirection: "column", gap: 16, flex: 1, minHeight: 0, overflowY: "auto", margin: "0 auto" }}>
      {/* 导出 */}
      <div style={{ padding: 18, borderRadius: 18, background: "var(--seed-surface)", border: "1px solid var(--seed-border)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
          <div style={{ width: 40, height: 40, borderRadius: "50%", background: "var(--seed-accent-bg)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Download size={18} style={{ color: "var(--seed-accent)" }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: "var(--fs-14)", fontWeight: 600, color: "var(--seed-fg)" }}>导出数据</div>
            <div style={{ fontSize: "var(--fs-11)", color: "var(--seed-muted)", marginTop: 2 }}>
               勾选要导出的内容（设置、规则书、对话记录），保存为 JSON 文件，可用于全量备份或迁移到其他设备
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <span style={{ fontSize: "var(--fs-11)", fontWeight: 500, color: "var(--seed-muted)" }}>
            选择导出内容（{selectedGroups.size}/{ALL_BACKUP_GROUPS.length}）
          </span>
          <div style={{ display: "flex", gap: 6 }}>
            <button
              onClick={() => setSelectedGroups(new Set(ALL_BACKUP_GROUPS))}
              style={{ padding: "3px 10px", borderRadius: 999, border: "1px solid var(--seed-border)", background: "transparent", color: "var(--seed-muted)", fontSize: "var(--fs-11)", cursor: "pointer" }}
            >
              全选
            </button>
            <button
              onClick={() => setSelectedGroups(new Set())}
              style={{ padding: "3px 10px", borderRadius: 999, border: "1px solid var(--seed-border)", background: "transparent", color: "var(--seed-muted)", fontSize: "var(--fs-11)", cursor: "pointer" }}
            >
              清空
            </button>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 14 }}>
          {ALL_BACKUP_GROUPS.map((key) => {
            const checked = selectedGroups.has(key);
            return (
              <button
                key={key}
                onClick={() => toggleGroup(key)}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 8,
                  padding: "8px 10px", borderRadius: 12, cursor: "pointer",
                  textAlign: "left", fontSize: "var(--fs-11)", lineHeight: 1.35,
                  color: "var(--seed-fg)",
                  background: checked ? "var(--seed-accent-bg)" : "var(--seed-hover-bg)",
                  border: checked ? "1px solid var(--seed-accent-border)" : "1px solid var(--seed-border)",
                  transition: "all 0.12s",
                }}
              >
                <span style={{
                  width: 16, height: 16, borderRadius: 4, flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: checked ? "var(--seed-accent)" : "transparent",
                  border: "1px solid " + (checked ? "var(--seed-accent)" : "var(--seed-border)"),
                  transition: "all 0.12s",
                }}>
                  {checked && <Check size={11} style={{ color: "#fff" }} />}
                </span>
                {BACKUP_GROUP_LABELS[key]}
              </button>
            );
          })}
        </div>

        {selectedGroups.has("providers") && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderRadius: 12, background: "color-mix(in srgb, #f59e0b 8%, transparent)", border: "1px solid color-mix(in srgb, #f59e0b 30%, transparent)", marginBottom: 14 }}>
            <ShieldAlert size={14} style={{ color: "#f59e0b", flexShrink: 0 }} />
            <span style={{ fontSize: "var(--fs-11)", color: "var(--seed-muted)", lineHeight: 1.5 }}>
              导出文件包含 API 密钥等敏感信息，请妥善保管，切勿分享给他人
            </span>
          </div>
        )}

        <button
          onClick={handleExport}
          disabled={busy !== null || selectedGroups.size === 0}
          style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 18px", borderRadius: 999, border: "none", cursor: selectedGroups.size === 0 ? "not-allowed" : "pointer", background: "var(--seed-accent)", color: "#fff", fontSize: "var(--fs-12)", fontWeight: 600, opacity: busy || selectedGroups.size === 0 ? 0.55 : 1 }}
        >
          {busy === "export" ? <Loader2 size={14} className="seed-spin" /> : <Download size={14} />}
          导出所选数据（{selectedGroups.size} 项）
        </button>
        <button
          onClick={handleDebugExport}
          disabled={busy !== null}
          title="导出完整请求上下文与注入明细（不含密钥），供开发者定位回复异常"
          style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 18px", borderRadius: 999, border: "1px dashed var(--seed-accent-border)", cursor: "pointer", background: "transparent", color: "var(--seed-accent)", fontSize: "var(--fs-12)", fontWeight: 600, opacity: busy ? 0.55 : 1 }}
        >
          <Bug size={14} />
          导出诊断信息
        </button>
      </div>

      {/* 导入 */}
      <div style={{ padding: 18, borderRadius: 18, background: "var(--seed-surface)", border: "1px solid var(--seed-border)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: "50%", background: "var(--seed-accent-bg)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Upload size={18} style={{ color: "var(--seed-accent)" }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: "var(--fs-14)", fontWeight: 600, color: "var(--seed-fg)" }}>导入数据</div>
            <div style={{ fontSize: "var(--fs-11)", color: "var(--seed-muted)", marginTop: 2 }}>
               导入前可查看备份包含的内容并勾选；设置类内容覆盖现有配置，规则书 / 角色卡 / 会话以合并方式导入（已存在的保留，不覆盖）
            </div>
          </div>
        </div>

        {importError && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderRadius: 12, background: "color-mix(in srgb, #ef4444 8%, transparent)", border: "1px solid color-mix(in srgb, #ef4444 30%, transparent)", marginBottom: 14 }}>
            <ShieldAlert size={14} style={{ color: "#ef4444", flexShrink: 0 }} />
            <span style={{ fontSize: "var(--fs-11)", color: "var(--seed-muted)" }}>{importError}</span>
          </div>
        )}

        {importSummary && (
          <div style={{ display: "flex", gap: 10, padding: "12px 14px", borderRadius: 12, background: "color-mix(in srgb, #22c55e 8%, transparent)", border: "1px solid color-mix(in srgb, #22c55e 30%, transparent)", marginBottom: 14, alignItems: "flex-start" }}>
            <CheckCircle2 size={16} style={{ color: "#22c55e", flexShrink: 0, marginTop: 1 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: "var(--fs-12)", fontWeight: 600, color: "var(--seed-fg)", marginBottom: 8 }}>
                已导入 {importSummary.length} 项数据
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {importSummary.map((item) => (
                  <span key={item} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 999, background: "var(--seed-hover-bg)", border: "1px solid var(--seed-border)", fontSize: "var(--fs-11)", color: "var(--seed-muted)" }}>
                    <CheckCircle2 size={11} style={{ color: "#22c55e" }} />
                    {item}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        <button
          onClick={handlePickImport}
          disabled={busy !== null}
          style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 18px", borderRadius: 999, border: "1px solid var(--seed-accent-border)", cursor: "pointer", background: "var(--seed-accent-bg)", color: "var(--seed-accent)", fontSize: "var(--fs-12)", fontWeight: 600, opacity: busy ? 0.6 : 1 }}
        >
          {busy === "import" ? <Loader2 size={14} className="seed-spin" /> : <Upload size={14} />}
          选择备份文件并导入
        </button>
      </div>

      {/* 云端备份（WebDAV） */}
      <div style={{ padding: 18, borderRadius: 18, background: "var(--seed-surface)", border: "1px solid var(--seed-border)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
          <div style={{ width: 40, height: 40, borderRadius: "50%", background: "var(--seed-accent-bg)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <CloudUpload size={18} style={{ color: "var(--seed-accent)" }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: "var(--fs-14)", fontWeight: 600, color: "var(--seed-fg)" }}>云端备份（WebDAV）</div>
            <div style={{ fontSize: "var(--fs-11)", color: "var(--seed-muted)", marginTop: 2 }}>
              上传备份到云端（每次按时间保留，不覆盖旧备份）；导入时先查看每个备份包含的内容，再勾选导入
            </div>
          </div>
        </div>

        <div style={{ marginBottom: 12 }}>
          <ComplianceNotice>
             云端备份会把所选数据上传到你的 WebDAV 服务，其中可能包含对话、角色、规则书、模型配置或密钥。请确认云盘账号安全，并避免同步无权保存或传播的数据。
          </ComplianceNotice>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
          {syncInput("url", "WebDAV 地址（如 https://dav.jianguoyun.com/dav/）")}
          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ flex: 1 }}>{syncInput("username", "账号")}</div>
            <div style={{ flex: 1 }}>{syncInput("password", "应用密码", "password")}</div>
          </div>
        </div>

        {syncNotice && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderRadius: 12, marginBottom: 12, background: syncNotice.type === "ok" ? "color-mix(in srgb, #22c55e 8%, transparent)" : "color-mix(in srgb, #ef4444 8%, transparent)", border: syncNotice.type === "ok" ? "1px solid color-mix(in srgb, #22c55e 30%, transparent)" : "1px solid color-mix(in srgb, #ef4444 30%, transparent)" }}>
            {syncNotice.type === "ok" ? <CheckCircle2 size={14} style={{ color: "#22c55e", flexShrink: 0 }} /> : <ShieldAlert size={14} style={{ color: "#ef4444", flexShrink: 0 }} />}
            <span style={{ fontSize: "var(--fs-11)", color: "var(--seed-muted)" }}>{syncNotice.text}</span>
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          <button
            onClick={handleTest}
            disabled={syncBusy !== null}
            style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 14px", borderRadius: 999, border: "1px solid var(--seed-border)", cursor: "pointer", background: "transparent", color: "var(--seed-muted)", fontSize: "var(--fs-11)", opacity: syncBusy ? 0.6 : 1 }}
          >
            {syncBusy === "test" ? <Loader2 size={13} className="seed-spin" /> : <Globe size={13} />}
            测试连接
          </button>
          <button
            onClick={() => void refreshBackups()}
            disabled={syncBusy !== null}
            style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 14px", borderRadius: 999, border: "1px solid var(--seed-border)", cursor: "pointer", background: "transparent", color: "var(--seed-muted)", fontSize: "var(--fs-11)", opacity: syncBusy ? 0.6 : 1 }}
          >
            {backupLoading ? <Loader2 size={13} className="seed-spin" /> : <RefreshCw size={13} />}
            刷新备份列表
          </button>
          <div style={{ flex: 1 }} />
          <button
            onClick={() => void handleUploadBackup()}
            disabled={syncBusy !== null || busy !== null || selectedGroups.size === 0}
            title={selectedGroups.size === 0 ? "请先勾选要备份的内容" : "按上方勾选内容上传为一份新备份"}
            style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 16px", borderRadius: 999, border: "none", cursor: selectedGroups.size === 0 ? "not-allowed" : "pointer", background: "var(--seed-accent)", color: "#fff", fontSize: "var(--fs-12)", fontWeight: 600, opacity: syncBusy || busy || selectedGroups.size === 0 ? 0.6 : 1 }}
          >
            {syncBusy === "upload" ? <Loader2 size={14} className="seed-spin" /> : <CloudUpload size={14} />}
            上传当前数据为备份
          </button>
        </div>

        {/* 保留策略 */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 12, background: "var(--seed-hover-bg)", border: "1px solid var(--seed-border)", marginBottom: 12, flexWrap: "wrap" }}>
          <span style={{ fontSize: "var(--fs-11)", fontWeight: 600, color: "var(--seed-fg)" }}>云端保留策略</span>
          <button
            onClick={() => handleRetentionChange({ mode: "limit", count: retention.mode === "limit" ? retention.count : 30 })}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 12px", borderRadius: 999,
              border: "1px solid " + (retention.mode === "limit" ? "var(--seed-accent-border)" : "var(--seed-border)"),
              background: retention.mode === "limit" ? "var(--seed-accent-bg)" : "transparent",
              color: retention.mode === "limit" ? "var(--seed-accent)" : "var(--seed-muted)",
              fontSize: "var(--fs-11)", cursor: "pointer", fontFamily: "inherit",
            }}
          >
            仅保留最近
            <input
              type="number"
              min={1}
              max={999}
              value={retention.mode === "limit" ? retention.count : 30}
              onChange={(e) => handleRetentionChange({ mode: "limit", count: Number(e.target.value) || 30 })}
              onClick={(e) => e.stopPropagation()}
              style={{ width: 52, padding: "2px 6px", borderRadius: 6, border: "1px solid var(--seed-border)", background: "var(--seed-input-bg)", color: "var(--seed-fg)", fontSize: "var(--fs-11)", fontFamily: "inherit", outline: "none", textAlign: "center" }}
            />
            个备份
          </button>
          <button
            onClick={() => handleRetentionChange({ mode: "all", count: retention.count })}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 12px", borderRadius: 999,
              border: "1px solid " + (retention.mode === "all" ? "var(--seed-accent-border)" : "var(--seed-border)"),
              background: retention.mode === "all" ? "var(--seed-accent-bg)" : "transparent",
              color: retention.mode === "all" ? "var(--seed-accent)" : "var(--seed-muted)",
              fontSize: "var(--fs-11)", cursor: "pointer", fontFamily: "inherit",
            }}
          >
            全部保留
          </button>
          <span style={{ fontSize: "var(--fs-10)", color: "var(--seed-muted)" }}>
            {retention.mode === "limit" ? `超出 ${retention.count} 个时自动删除最旧备份` : "不会自动删除任何备份"}
          </span>
        </div>

        {/* 备份列表（按时间倒序 + 内容摘要） */}
        {backups !== null && (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <Clock size={13} style={{ color: "var(--seed-muted)" }} />
              <span style={{ fontSize: "var(--fs-11)", fontWeight: 600, color: "var(--seed-muted)" }}>
                云端备份（{backups.length}）
              </span>
              <div style={{ flex: 1 }} />
              {backups.length > 2 && (
                <button
                  onClick={() => setShowAll((v) => !v)}
                  style={{ padding: "3px 10px", borderRadius: 999, border: "1px solid var(--seed-border)", background: "transparent", color: "var(--seed-muted)", fontSize: "var(--fs-10)", cursor: "pointer" }}
                >
                  {showAll ? "收起" : `查看全部（${backups.length}）`}
                </button>
              )}
            </div>
            {backups.length === 0 ? (
              <div style={{ padding: "18px 12px", textAlign: "center", color: "var(--seed-muted)", fontSize: "var(--fs-11)", background: "var(--seed-hover-bg)", borderRadius: 12, border: "1px dashed var(--seed-border)" }}>
                云端暂无备份，点击「上传当前数据为备份」创建第一份备份
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {backups.slice(0, showAll ? undefined : 2).map((b) => (
                  <div key={b.name} style={{ padding: "12px 14px", borderRadius: 12, background: "var(--seed-hover-bg)", border: "1px solid var(--seed-border)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, flexWrap: "wrap" }}>
                      <span style={{ fontSize: "var(--fs-12)", fontWeight: 600, color: "var(--seed-fg)" }}>
                        {formatTime(b.time)}
                      </span>
                      {/* 来源设备标识 */}
                      <span style={{
                        display: "inline-flex", alignItems: "center", gap: 4,
                        padding: "2px 9px", borderRadius: 999, fontSize: "var(--fs-10)", fontWeight: 600,
                        background: b.device === "android"
                          ? "color-mix(in srgb, #22c55e 10%, transparent)"
                          : b.device === "desktop"
                            ? "color-mix(in srgb, var(--seed-accent) 10%, transparent)"
                            : "var(--seed-hover-bg)",
                        border: "1px solid " + (b.device === "android"
                          ? "color-mix(in srgb, #22c55e 35%, transparent)"
                          : b.device === "desktop"
                            ? "color-mix(in srgb, var(--seed-accent) 35%, transparent)"
                            : "var(--seed-border)"),
                        color: b.device === "android"
                          ? "#22c55e"
                          : b.device === "desktop"
                            ? "var(--seed-accent)"
                            : "var(--seed-muted)",
                      }}>
                        {b.device === "android" ? "📱 " : b.device === "desktop" ? "💻 " : ""}
                        {DEVICE_LABELS[b.device] ?? "未知设备"}
                      </span>
                      <div style={{ flex: 1 }} />
                      <button
                        onClick={() => void handleImportBackup(b.name)}
                        disabled={busy !== null}
                        style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "6px 14px", borderRadius: 999, border: "1px solid var(--seed-accent-border)", cursor: "pointer", background: "var(--seed-accent-bg)", color: "var(--seed-accent)", fontSize: "var(--fs-11)", fontWeight: 600, opacity: busy ? 0.6 : 1 }}
                      >
                        <CloudDownload size={12} /> 查看并导入
                      </button>
                    </div>
                    {b.summary.length > 0 ? (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                        {b.summary.slice(0, 6).map((s) => (
                          <span key={s} style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 9px", borderRadius: 999, background: "var(--seed-surface)", border: "1px solid var(--seed-border)", fontSize: "var(--fs-10)", color: "var(--seed-muted)" }}>
                            {s}
                          </span>
                        ))}
                        {b.summary.length > 6 && (
                          <span style={{ fontSize: "var(--fs-10)", color: "var(--seed-muted)", alignSelf: "center" }}>
                            +{b.summary.length - 6} 项
                          </span>
                        )}
                      </div>
                    ) : (
                      <span style={{ fontSize: "var(--fs-10)", color: "var(--seed-muted)" }}>内容摘要读取失败</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 导入确认弹窗：安卓端挂到 body 以覆盖全屏遮罩；桌面端内联渲染 */}
      {isAndroid && importDialog ? createPortal(
        <div className={`theme-${effectiveTheme()}`}>{importDialog}</div>,
        document.body
      ) : importDialog}
    </div>
  );
}
