import { useUIStore } from "@/stores/uiStore";
import { useSessionStore } from "@/stores/sessionStore";
import { useTemplateStore } from "@/stores/templateStore";
import { useCharacterStore } from "@/stores/characterStore";
import { useMcpStore } from "@/stores/mcpStore";
import { useWorldStore } from "@/stores/worldStore";
import { initDb } from "@/lib/db";
import { DialogueNovel } from "@/components/Chat/DialogueNovel";
import { OnboardingFlow } from "@/components/Onboarding/OnboardingFlow";
import { ProviderConfigPanel } from "@/components/Settings/ProviderConfig";
import { SessionList } from "@/components/Sidebar/SessionList";
import { useEffect, useState, useRef } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { ConfirmDialog } from "@/components/Layout/ConfirmDialog";

export function AppShell() {
  const {
    sidebarOpen,
    settingsOpen,
    theme,
    setTheme,
    effectiveTheme,
    setWebSearchOn,
    setMcpActive,
    appPhase,
    setAppPhase,
  } = useUIStore();
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
  const phaseInitializedRef = useRef(false);

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

        // 启动阶段判定：有活跃会话则进入对话模式，否则进入开局流程
        // 仅首次启动时判定一次，避免后续切换会话被覆盖
        if (!phaseInitializedRef.current) {
          phaseInitializedRef.current = true;
          const { sessions, activeId, createBlankSession } = useSessionStore.getState();
          // 若无任何会话，自动创建一个空白会话
          if (sessions.length === 0) {
            createBlankSession();
          }
          const hasActive = activeId && sessions.some((s) => s.id === activeId);
          // 若无活跃会话且有历史会话，激活最近一条
          if (!hasActive && sessions.length > 0) {
            const latest = [...sessions].sort((a, b) => b.updatedAt - a.updatedAt)[0];
            if (latest) useSessionStore.getState().setActive(latest.id);
          }
          const finalActiveId = useSessionStore.getState().activeId;
          setAppPhase(finalActiveId ? "dialogue" : "onboarding");
        }

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

  // DB 初始化完成前显示加载态,避免 persist 的旧状态闪烁
  // uiStore 已用 partialize 排除 appPhase/onboardingStep,但保险起见在 DB ready 前统一不渲染
  if (dbReady === null) {
    return (
      <div className={`theme-${eff}`} style={{ height: "100vh", width: "100vw", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--seed-bg, #0c0c10)" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16 }}>
          <div style={{
            width: 32, height: 32, borderRadius: "50%",
            border: "2px solid var(--seed-accent, #7c6aef)",
            borderTopColor: "transparent",
            animation: "spin 0.8s linear infinite",
          }} />
          <span style={{ fontSize: 13, color: "var(--seed-muted, #6b6880)", letterSpacing: "0.05em" }}>正在加载...</span>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  // 开局流程：全屏覆盖，无 sidebar/header
  if (appPhase === "onboarding") {
    return (
      <div className={`theme-${eff}`} style={{ height: "100vh", width: "100vw", overflow: "hidden", background: "var(--seed-bg)" }}>
        <OnboardingFlow />
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
      </div>
    );
  }

  // 对话模式：全屏沉浸式小说对话（DialogueNovel 内置 FunctionBar 与会话管理）
  // 设计稿 dialogue 页面无顶部 header，仅靠右上角 info-badge 与底部 FunctionBar
  return (
    <div className={`theme-${eff}`} style={{ height: "100vh", width: "100vw", position: "relative", overflow: "hidden", background: "var(--seed-bg)" }}>
      {/* 透明窗口拖拽层：不占布局空间，仅用于 Tauri 窗口拖拽 */}
      <div data-tauri-drag-region style={{ position: "absolute", top: 0, left: 0, right: 0, height: 32, zIndex: 50 }} />

      {/* DB 状态指示灯：右上角 info-badge 下方，低调显示 */}
      <div
        title={dbReady === true ? "SQLite 已连接" : dbReady === false ? "SQLite 连接失败" : "SQLite 连接中..."}
        style={{
          position: "fixed", bottom: 14, right: 18, zIndex: 200,
          width: 6, height: 6, borderRadius: "50%",
          background: dbReady === true ? "var(--success)" : dbReady === false ? "var(--danger)" : "var(--warning)",
          boxShadow: `0 0 6px ${dbReady === true ? "var(--success)" : dbReady === false ? "var(--danger)" : "var(--warning)"}`,
          opacity: 0.6,
        }}
      />

      <DialogueNovel />

      {/* 传统 Sidebar：默认不显示，仅当用户从 FunctionBar 外的途径打开时渲染 */}
      {sidebarOpen && !settingsOpen && (
        <div style={{
          position: "absolute", top: 0, left: 0, bottom: 0, zIndex: 150,
          display: "flex", flexDirection: "column",
          width: 240, minWidth: 240,
          background: "var(--seed-glass)", backdropFilter: "blur(20px)",
          borderRight: "1px solid var(--seed-border)",
          boxShadow: "4px 0 24px rgba(0,0,0,0.3)",
        }}>
          <div className="glass-sidebar" style={{ flex: 1 }}>
            <SessionList onDeleteRequest={(id, title) => setDeleteTarget({ id, title })} onRemoveAllRequest={() => setShowRemoveAllConfirm(true)} />
          </div>
        </div>
      )}

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
