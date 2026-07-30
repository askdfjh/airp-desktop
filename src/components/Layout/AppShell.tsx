import { useUIStore } from "@/stores/uiStore";
import { useSessionStore } from "@/stores/sessionStore";
import { useTemplateStore } from "@/stores/templateStore";
import { useCharacterStore } from "@/stores/characterStore";
import { useMcpStore } from "@/stores/mcpStore";
import { useWorldStore } from "@/stores/worldStore";
import { initDb } from "@/lib/db";
import { SessionList } from "@/components/Sidebar/SessionList";
import { ChatPane } from "@/components/Chat/ChatPane";
import { ProviderConfigPanel } from "@/components/Settings/ProviderConfig";
import { PanelLeftClose, PanelLeft, Sparkles, Sun, Moon, Monitor } from "lucide-react";
import { useEffect, useState, useRef } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { ConfirmDialog } from "@/components/Layout/ConfirmDialog";

function ThemeIcon({ theme }: { theme: string }) {
  if (theme === "light") return <Sun size={13} />;
  if (theme === "dark") return <Moon size={13} />;
  return <Monitor size={13} />;
}

export function AppShell() {
  const { sidebarOpen, toggleSidebar, settingsOpen, theme, setTheme, effectiveTheme, setWebSearchOn, setMcpActive } = useUIStore();
  const loadFromDb = useSessionStore((s) => s.loadFromDb);
  const removeSession = useSessionStore((s) => s.remove);
  const removeAllSessions = useSessionStore((s) => s.removeAll);
  const loadTemplates = useTemplateStore((s) => s.loadFromDb);
  const loadCharacters = useCharacterStore((s) => s.loadFromDb);
  const loadMcps = useMcpStore((s) => s.loadFromDb);
  const loadWorldRules = useWorldStore((s) => s.loadFromDb);
  const [eff, setEff] = useState<"dark" | "light">(() => {
    try {
      const raw = localStorage.getItem("airp-ui-v2");
      if (raw) {
        const s = JSON.parse(raw)?.state;
        if (s?.theme === "light") return "light";
        if (s?.theme === "system") return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
      }
    } catch {}
    return "dark";
  });
  const [dbReady, setDbReady] = useState<boolean | null>(null);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const exitConfirmRef = useRef(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);
  const [showRemoveAllConfirm, setShowRemoveAllConfirm] = useState(false);

  // 应用启动：初始化 SQLite 并加载历史会话
  useEffect(() => {
    initDb()
      .then(() => loadFromDb())
      .then(() => loadTemplates())
      .then(() => loadCharacters())
      .then(() => loadMcps())
      .then(() => loadWorldRules())
      .then(async () => {
        // Initialize tools enabled flag from DB
        try {
          const { getAppSetting } = await import("@/lib/db");
          const { setToolsEnabled } = await import("@/hooks/useChat");
          const webSearchOn = await getAppSetting("web_search_enabled");
          const isOn = webSearchOn === "1";
          setWebSearchOn(isOn);
          setToolsEnabled(isOn);
          const mcpIdsRaw = await getAppSetting("mcp_active_server_ids");
          if (mcpIdsRaw) {
            try {
              const ids: string[] = JSON.parse(mcpIdsRaw);
              if (ids.length > 0) setMcpActive(true);
            } catch {}
          }
        } catch {}
        setDbReady(true);
      })
      .catch((e) => {
        console.error("[db] init failed:", e);
        setDbReady(false);
      });
  }, [loadFromDb, loadTemplates, loadCharacters, loadMcps, loadWorldRules]);

  useEffect(() => {
    const currentTheme = effectiveTheme();
    setEff(currentTheme);
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => { if (theme === "system") setEff(mq.matches ? "dark" : "light"); };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [theme, effectiveTheme]);

  // 同步原生窗口标题栏主题
  useEffect(() => {
    getCurrentWindow().setTheme(eff).catch(() => {});
  }, [eff]);

  // 窗口关闭确认
  useEffect(() => {
    let cancelled = false;
    getCurrentWindow().onCloseRequested(async (event) => {
      event.preventDefault();
      if (cancelled) return;
      if (!exitConfirmRef.current) {
        exitConfirmRef.current = true;
        setShowExitConfirm(true);
      }
    });
    return () => { cancelled = true; };
  }, []);

  const handleExitConfirm = () => {
    exitConfirmRef.current = false;
    setShowExitConfirm(false);
    getCurrentWindow().destroy();
  };

  const handleExitCancel = () => {
    exitConfirmRef.current = false;
    setShowExitConfirm(false);
  };

  const handleDeleteConfirm = () => {
    if (!deleteTarget) return;
    const result = removeSession(deleteTarget.id);
    if (!result.ok && result.reason) {
      alert(result.reason);
    }
    setDeleteTarget(null);
  };

  const handleDeleteCancel = () => setDeleteTarget(null);

  const cycleTheme = () => {
    const next = theme === "dark" ? "light" : theme === "light" ? "system" : "dark";
    setTheme(next);
  };

  return (
    
    <div className={`theme-${eff}`} style={{ height: "100vh", width: "100vw", display: "flex", overflow: "hidden", background: "var(--bg-app)" }}>
      {/* Sidebar */}
      <div style={{
        display: "flex", flexDirection: "column",
        transition: "all 0.25s ease-out", overflow: "hidden",
        width: sidebarOpen ? 240 : 0, minWidth: sidebarOpen ? 240 : 0,
        opacity: sidebarOpen ? 1 : 0,
      }}>
        <div className="glass-sidebar">
          {sidebarOpen && <SessionList onDeleteRequest={(id, title) => setDeleteTarget({ id, title })} onRemoveAllRequest={() => setShowRemoveAllConfirm(true)} />}
        </div>
      </div>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div data-tauri-drag-region className={eff === "dark" ? "header-dark" : "header-light"} style={{ height:40, display:"flex", alignItems:"center", justifyContent:"space-between", padding:"0 12px", flexShrink:0 }}>
          <button onClick={toggleSidebar}
            className="btn-ghost" style={{ display:"flex" }}
            title={sidebarOpen ? "收起侧边栏" : "展开侧边栏"}>
            {sidebarOpen ? <PanelLeftClose size={15} /> : <PanelLeft size={15} />}
          </button>

          <div className="flex items-center gap-2">
            <Sparkles size={12} style={{ color: "var(--accent)", opacity: 0.6 }} />
            <span className="text-11 txt-muted uppercase tracking-wider font-medium">AIRP</span>
          </div>

          {/* Theme toggle */}
          <button onClick={cycleTheme}
            className="btn-ghost" style={{ display:"flex", alignItems:"center", gap:4 }}
            title={`当前: ${theme === "system" ? "跟随系统" : theme === "dark" ? "深色" : "浅色"} (点击切换)`}>
            <ThemeIcon theme={theme} />
          </button>

          {/* DB status */}
          <div
            title={dbReady === true ? "SQLite 已连接" : dbReady === false ? "SQLite 连接失败" : "SQLite 连接中..."}
            style={{
              width: 7, height: 7, borderRadius: "50%",
              background: dbReady === true ? "var(--success)" : dbReady === false ? "var(--danger)" : "var(--warning)",
              boxShadow: `0 0 6px ${dbReady === true ? "var(--success)" : dbReady === false ? "var(--danger)" : "var(--warning)"}`,
              marginLeft: 6,
            }}
          />
        </div>

        <ChatPane />
      </div>

      {settingsOpen && <ProviderConfigPanel />}

      {showExitConfirm && (
        <ConfirmDialog
          title="退出 AIRP"
          message="确定要退出吗？"
          confirmLabel="退出"
          cancelLabel="取消"
          onConfirm={handleExitConfirm}
          onCancel={handleExitCancel}
        />
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="删除对话"
          message={`确定要删除「${deleteTarget.title}」吗？删除后对话记录和消息将一并清除，无法恢复。`}
          confirmLabel="删除"
          cancelLabel="取消"
          onConfirm={handleDeleteConfirm}
          onCancel={handleDeleteCancel}
        />
      )}

      {showRemoveAllConfirm && (
        <ConfirmDialog
          title="清空所有对话"
          message="确定要删除所有对话吗？所有对话记录和消息将一并清除，无法恢复。"
          confirmLabel="清空"
          cancelLabel="取消"
          onConfirm={() => { removeAllSessions(); setShowRemoveAllConfirm(false); }}
          onCancel={() => setShowRemoveAllConfirm(false)}
        />
      )}
    </div>
  );
}