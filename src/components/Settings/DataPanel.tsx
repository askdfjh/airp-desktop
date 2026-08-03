import { useEffect, useRef, useState } from "react";
import { Download, Upload, ShieldAlert, CheckCircle2, Loader2, Check, Globe, CloudUpload, CloudDownload } from "lucide-react";
import { runSync, testConnection, groupLabel, type SyncOutcome, type ConflictChoice } from "@/lib/webdavClient";
import { loadSyncConfig, saveSyncConfig, type SyncConfig, type SyncGroup } from "@/lib/webdavSync";
import { save, open } from "@tauri-apps/plugin-dialog";
import { writeTextFile, readTextFile } from "@tauri-apps/plugin-fs";
import { useWorldStore } from "@/stores/worldStore";
import { useCharacterStore } from "@/stores/characterStore";
import { useSessionStore } from "@/stores/sessionStore";
import {
  exportAllData,
  importAllData,
  validateSettingsBackup,
  summarizeImportedGroups,
  ALL_BACKUP_GROUPS,
  BACKUP_GROUP_LABELS,
  type SettingsBackup,
  type BackupGroupKey,
} from "@/lib/settingsBackup";
import { useUIStore } from "@/stores/uiStore";
import { ConfirmDialog } from "@/components/Layout/ConfirmDialog";

export function DataPanel() {
  const notify = useUIStore((s) => s.notify);
  const [busy, setBusy] = useState<"export" | "import" | null>(null);
  const [pendingImport, setPendingImport] = useState<SettingsBackup | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSummary, setImportSummary] = useState<string[] | null>(null);
  const [selectedGroups, setSelectedGroups] = useState<Set<BackupGroupKey>>(
    () => new Set(ALL_BACKUP_GROUPS)
  );

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
      const defaultName = `airp-backup-${new Date().toISOString().slice(0, 10)}.json`;
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
        setImportError("不是有效的 AIRP 备份文件");
        return;
      }
      setPendingImport(parsed);
    } catch (e) {
      console.error("[settings] import failed:", e);
      setImportError("读取文件失败，请确认文件格式正确");
    }
  };

  const handleConfirmImport = async () => {
    if (!pendingImport) return;
    const data = pendingImport;
    setBusy("import");
    setImportError(null);
    try {
      await importAllData(data);
      const summary = summarizeImportedGroups(data);
      setImportSummary(summary);
      notify(`已导入 ${summary.length} 项数据`);
    } catch (e) {
      console.error("[settings] import failed:", e);
      setImportError("导入失败，请重试");
    } finally {
      setBusy(null);
      setPendingImport(null);
    }
  };

  /* ---------- 云端同步（WebDAV） ---------- */
  const [syncCfg, setSyncCfg] = useState<SyncConfig>({ url: "", username: "", password: "" });
  const [syncBusy, setSyncBusy] = useState<"test" | "upload" | "download" | null>(null);
  const [syncNotice, setSyncNotice] = useState<{ type: "ok" | "error"; text: string } | null>(null);
  const [syncOutcomes, setSyncOutcomes] = useState<SyncOutcome[] | null>(null);
  const [pendingConflict, setPendingConflict] = useState<{ group: SyncGroup; local: number; remote: number } | null>(null);
  const conflictResolveRef = useRef<((c: ConflictChoice) => void) | null>(null);

  useEffect(() => {
    loadSyncConfig().then((c) => setSyncCfg(c)).catch(() => {});
  }, []);

  const handleTest = async () => {
    if (syncBusy) return;
    if (!syncCfg.url.trim() || !syncCfg.username.trim() || !syncCfg.password) {
      setSyncNotice({ type: "error", text: "请先填写 WebDAV 地址、账号与应用密码" });
      return;
    }
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

  const handleSync = async (mode: "upload" | "download") => {
    if (syncBusy) return;
    if (!syncCfg.url.trim() || !syncCfg.username.trim() || !syncCfg.password) {
      setSyncNotice({ type: "error", text: "请先填写 WebDAV 地址、账号与应用密码" });
      return;
    }
    setSyncBusy(mode);
    setSyncNotice(null);
    setSyncOutcomes(null);
    try {
      await saveSyncConfig(syncCfg);
      const outcomes = await runSync(syncCfg, mode, (group, local, remote) => {
        setPendingConflict({ group, local, remote });
        return new Promise<ConflictChoice>((resolve) => {
          conflictResolveRef.current = resolve;
        });
      });
      setSyncOutcomes(outcomes);
      const failed = outcomes.filter((o) => o.status === "error").length;
      if (failed > 0) setSyncNotice({ type: "error", text: `${failed} 组同步失败，请查看明细` });
      else setSyncNotice({ type: "ok", text: "同步完成" });
      await Promise.allSettled([
        useWorldStore.getState().loadFromDb(),
        useCharacterStore.getState().loadFromDb(),
        useCharacterStore.getState().loadCharactersFromDb(),
        useSessionStore.getState().loadFromDb(),
      ]);
    } catch (e) {
      setSyncNotice({ type: "error", text: e instanceof Error ? e.message : String(e) });
    } finally {
      setSyncBusy(null);
    }
  };

  const resolveConflict = (choice: ConflictChoice) => {
    const r = conflictResolveRef.current;
    conflictResolveRef.current = null;
    setPendingConflict(null);
    r?.(choice);
  };

  const outcomeStyle: Record<SyncOutcome["status"], { bg: string; border: string; color: string }> = {
    uploaded: { bg: "color-mix(in srgb, var(--seed-accent) 10%, transparent)", border: "color-mix(in srgb, var(--seed-accent) 35%, transparent)", color: "var(--seed-accent)" },
    merged: { bg: "color-mix(in srgb, #22c55e 10%, transparent)", border: "color-mix(in srgb, #22c55e 35%, transparent)", color: "#22c55e" },
    uptodate: { bg: "var(--seed-hover-bg)", border: "var(--seed-border)", color: "var(--seed-muted)" },
    skipped_local_only: { bg: "color-mix(in srgb, #f59e0b 10%, transparent)", border: "color-mix(in srgb, #f59e0b 35%, transparent)", color: "#f59e0b" },
    conflict_cancelled: { bg: "var(--seed-hover-bg)", border: "var(--seed-border)", color: "var(--seed-muted)" },
    error: { bg: "color-mix(in srgb, #ef4444 10%, transparent)", border: "color-mix(in srgb, #ef4444 35%, transparent)", color: "#ef4444" },
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
              勾选要导出的内容（设置、世界书、对话记录），保存为 JSON 文件，可用于全量备份或迁移到其他设备
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
              从导出的 JSON 文件恢复数据：设置项覆盖备份中包含的内容，会话记录以合并方式导入
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

      {/* 云端同步（WebDAV） */}
      <div style={{ padding: 18, borderRadius: 18, background: "var(--seed-surface)", border: "1px solid var(--seed-border)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
          <div style={{ width: 40, height: 40, borderRadius: "50%", background: "var(--seed-accent-bg)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <CloudUpload size={18} style={{ color: "var(--seed-accent)" }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: "var(--fs-14)", fontWeight: 600, color: "var(--seed-fg)" }}>云端同步（WebDAV）</div>
            <div style={{ fontSize: "var(--fs-11)", color: "var(--seed-muted)", marginTop: 2 }}>
              通过 WebDAV（如坚果云）在设备间同步创作数据：世界书、角色卡、会话记录。仅同步创作内容，设置与 API 密钥各端独立
            </div>
          </div>
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

        {syncOutcomes && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
            {syncOutcomes.map((o) => {
              const s = outcomeStyle[o.status];
              return (
                <span key={o.group} title={o.detail} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 999, background: s.bg, border: `1px solid ${s.border}`, fontSize: "var(--fs-11)", color: s.color }}>
                  {o.status === "error" ? <ShieldAlert size={11} /> : <CheckCircle2 size={11} />}
                  {groupLabel(o.group)}：{o.detail}
                </span>
              );
            })}
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <button
            onClick={handleTest}
            disabled={syncBusy !== null}
            style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 14px", borderRadius: 999, border: "1px solid var(--seed-border)", cursor: "pointer", background: "transparent", color: "var(--seed-muted)", fontSize: "var(--fs-11)", opacity: syncBusy ? 0.6 : 1 }}
          >
            {syncBusy === "test" ? <Loader2 size={13} className="seed-spin" /> : <Globe size={13} />}
            测试连接
          </button>
          <div style={{ flex: 1 }} />
          <button
            onClick={() => handleSync("download")}
            disabled={syncBusy !== null}
            style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 16px", borderRadius: 999, border: "1px solid var(--seed-accent-border)", cursor: "pointer", background: "var(--seed-accent-bg)", color: "var(--seed-accent)", fontSize: "var(--fs-12)", fontWeight: 600, opacity: syncBusy ? 0.6 : 1 }}
          >
            {syncBusy === "download" ? <Loader2 size={14} className="seed-spin" /> : <CloudDownload size={14} />}
            从云端下载
          </button>
          <button
            onClick={() => handleSync("upload")}
            disabled={syncBusy !== null}
            style={{ display: "inline-flex", alignItems: "center", gap: 7, padding: "9px 16px", borderRadius: 999, border: "none", cursor: "pointer", background: "var(--seed-accent)", color: "#fff", fontSize: "var(--fs-12)", fontWeight: 600, opacity: syncBusy ? 0.6 : 1 }}
          >
            {syncBusy === "upload" ? <Loader2 size={14} className="seed-spin" /> : <CloudUpload size={14} />}
            上传到云端
          </button>
        </div>
      </div>

      {pendingImport && (
        <ConfirmDialog
          title="导入数据"
          message="设置项将覆盖备份中包含的配置（未包含的保持现状），会话与消息以合并方式导入（已存在的对话保留原样）。此操作不可撤销。确定继续？"
          confirmLabel="确认导入"
          cancelLabel="取消"
          onConfirm={handleConfirmImport}
          onCancel={() => setPendingImport(null)}
        />
      )}

      {pendingConflict && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{
            background: "rgba(0,0,0,0.45)",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
            animation: "seed-fade-in-up 0.18s ease-out",
            zIndex: 2000,
          }}
          onClick={() => resolveConflict("cancel")}
        >
          <div
            style={{
              width: 380,
              maxWidth: "calc(100vw - 32px)",
              padding: "28px 28px 24px",
              background: "var(--seed-surface)",
              border: "1px solid var(--seed-border)",
              borderRadius: 16,
              boxShadow: "0 16px 64px rgba(0,0,0,0.5)",
              animation: "seed-fade-in-up 0.22s ease-out",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 12,
                background: "color-mix(in srgb, #f59e0b 12%, transparent)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 16px",
              }}
            >
              <ShieldAlert size={20} style={{ color: "#f59e0b" }} />
            </div>

            <span style={{ display: "block", marginBottom: 8, fontSize: 16, fontWeight: 600, color: "var(--seed-fg)", textAlign: "center" }}>
              同步冲突
            </span>

            <p style={{ marginBottom: 8, fontSize: 14, color: "var(--seed-fg)", lineHeight: 1.55, textAlign: "center" }}>
              「{groupLabel(pendingConflict.group)}」本地与云端都已修改
            </p>
            <p style={{ marginBottom: 24, fontSize: 12, color: "var(--seed-muted)", lineHeight: 1.6, textAlign: "center" }}>
              本地修改：{new Date(pendingConflict.local).toLocaleString()}　云端修改：{new Date(pendingConflict.remote).toLocaleString()}
              <br />
              请选择处理方式
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <button
                onClick={() => resolveConflict("upload")}
                style={{ padding: "9px 0", borderRadius: 10, fontSize: "var(--fs-13)", fontWeight: 500, border: "none", background: "var(--seed-accent)", color: "#fff", cursor: "pointer" }}
              >
                上传覆盖（云端替换为本地版本）
              </button>
              <button
                onClick={() => resolveConflict("download")}
                style={{ padding: "9px 0", borderRadius: 10, fontSize: "var(--fs-13)", fontWeight: 500, border: "1px solid var(--seed-accent-border)", background: "var(--seed-accent-bg)", color: "var(--seed-accent)", cursor: "pointer" }}
              >
                下载合并（合并云端内容，不覆盖现有）
              </button>
              <button
                onClick={() => resolveConflict("cancel")}
                style={{ padding: "9px 0", borderRadius: 10, fontSize: "var(--fs-13)", border: "1px solid var(--seed-border)", background: "transparent", color: "var(--seed-muted)", cursor: "pointer" }}
              >
                取消（本次不同步）
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
