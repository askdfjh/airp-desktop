import { useEffect, useRef, useState } from "react";
import { Copy, Download, RefreshCw, Trash2, FileText, ShieldAlert } from "lucide-react";
import { getLogs, logsToText, clearLogs, type RuntimeLogEntry, type LogLevel } from "@/lib/appLog";
import { useUIStore } from "@/stores/uiStore";
import { ComplianceNotice } from "./ComplianceNotice";

function formatTime(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

const LEVEL_COLORS: Record<LogLevel, string> = {
  error: "var(--danger, #e5484d)",
  warn: "var(--warning, #f5a623)",
};

const LEVEL_LABELS: Record<LogLevel, string> = {
  error: "错误",
  warn: "警告",
};

export function RuntimeLogPanel() {
  const notify = useUIStore((s) => s.notify);
  const [logs, setLogs] = useState<RuntimeLogEntry[]>(() => getLogs(300));
  const [filter, setFilter] = useState<LogLevel | "all">("all");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [copied, setCopied] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!autoRefresh) return;
    const timer = setInterval(() => setLogs(getLogs(300)), 2000);
    return () => clearInterval(timer);
  }, [autoRefresh]);

  useEffect(() => {
    // 新日志到达时若用户已滚到底部则保持贴底
    const el = listRef.current;
    if (!el) return;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    if (nearBottom) el.scrollTop = el.scrollHeight;
  }, [logs]);

  const visible = filter === "all" ? logs : logs.filter((l) => l.level === filter);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(logsToText(visible));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      notify("复制失败");
    }
  };

  const handleExport = async () => {
    try {
      const { save } = await import("@tauri-apps/plugin-dialog");
      const path = await save({
        defaultPath: "narra-runtime.log",
        filters: [{ name: "日志文件", extensions: ["log", "txt"] }],
      });
      if (!path) return;
      const { writeTextFile } = await import("@tauri-apps/plugin-fs");
      await writeTextFile(path, logsToText(visible));
      notify("日志已导出");
    } catch {
      notify("导出失败");
    }
  };

  const handleClear = () => {
    clearLogs();
    setLogs(getLogs(300));
    notify("已清空运行日志");
  };

  const btn: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "5px 10px",
    borderRadius: 10,
    border: "1px solid var(--seed-border)",
    background: "transparent",
    color: "var(--seed-muted)",
    fontSize: 12,
    cursor: "pointer",
  };

  return (
    <div style={{ maxWidth: 760, width: "100%", margin: "0 auto", display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ padding: 18, borderRadius: 20, background: "var(--seed-surface)", border: "1px solid var(--seed-border)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
          <div style={{ width: 38, height: 38, borderRadius: 14, background: "var(--seed-accent-bg)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--seed-accent)", flexShrink: 0 }}>
            <FileText size={18} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 650, color: "var(--seed-fg)" }}>运行日志</div>
            <div style={{ fontSize: 12, color: "var(--seed-muted)", lineHeight: 1.6 }}>
              记录错误与警告（场景生成失败、模型请求异常、未捕获错误等），仅保留最近 500 条
            </div>
          </div>
          <button style={btn} onClick={() => setAutoRefresh((v) => !v)}>
            <RefreshCw size={12} />
            {autoRefresh ? "自动刷新" : "已暂停"}
          </button>
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
          {(["all", "error", "warn"] as const).map((lv) => (
            <button
              key={lv}
              onClick={() => setFilter(lv)}
              style={{
                ...btn,
                background: filter === lv ? "var(--seed-accent-bg)" : "transparent",
                color: filter === lv ? "var(--seed-accent)" : "var(--seed-muted)",
                borderColor: filter === lv ? "transparent" : "var(--seed-border)",
              }}
            >
              {lv === "all" ? "全部" : LEVEL_LABELS[lv]}
              {lv !== "all" && (
                <span style={{ width: 6, height: 6, borderRadius: 99, background: LEVEL_COLORS[lv], display: "inline-block" }} />
              )}
            </button>
          ))}
          <div style={{ flex: 1 }} />
          <button style={btn} onClick={handleCopy}>{copied ? "已复制" : "复制"}</button>
          <button style={btn} onClick={handleExport}>导出</button>
          <button style={btn} onClick={handleClear}>
            <Trash2 size={12} />
            清空
          </button>
        </div>

        <div
          ref={listRef}
          style={{
            maxHeight: 320,
            overflowY: "auto",
            borderRadius: 12,
            border: "1px solid var(--seed-border)",
            background: "rgba(0,0,0,0.03)",
            padding: 8,
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
            fontSize: 11.5,
            lineHeight: 1.7,
          }}
        >
          {visible.length === 0 ? (
            <div style={{ color: "var(--seed-muted)", textAlign: "center", padding: 20 }}>
              暂无日志。运行过程出错（如场景生成失败）后会显示在这里。
            </div>
          ) : (
            visible.map((l, i) => (
              <div key={l.ts + "-" + i} style={{ display: "flex", gap: 8, alignItems: "baseline" }}>
                <span style={{ color: "var(--seed-muted)", flexShrink: 0 }}>{formatTime(l.ts)}</span>
                <span style={{ color: LEVEL_COLORS[l.level], flexShrink: 0, fontWeight: 600 }}>
                  [{LEVEL_LABELS[l.level]}]
                </span>
                <span style={{ color: "var(--seed-fg)" }}>
                  [{l.tag}] {l.msg}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      <ComplianceNotice title="隐私与安全说明">
        运行日志只在本机记录错误与警告，不包含你的 API 密钥等敏感信息；不会随备份、导入或同步离开本机。
      </ComplianceNotice>
    </div>
  );
}
