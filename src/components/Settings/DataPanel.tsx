import { useState } from "react";
import { Download, Upload, ShieldAlert, CheckCircle2, Loader2, Check } from "lucide-react";
import { save, open } from "@tauri-apps/plugin-dialog";
import { writeTextFile, readTextFile } from "@tauri-apps/plugin-fs";
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
      notify("导出失败，请重试");
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
    </div>
  );
}
