import { useUIStore } from "@/stores/uiStore";
import { useSessionStore } from "@/stores/sessionStore";
import { useTemplateStore } from "@/stores/templateStore";
import { useCharacterStore } from "@/stores/characterStore";
import { useMcpStore } from "@/stores/mcpStore";
import { useWorldStore } from "@/stores/worldStore";
import { useProviderStore } from "@/stores/providerStore";
import { initDb } from "@/lib/db";
import { DialogueNovel } from "@/components/Chat/DialogueNovel";
import { OnboardingFlow } from "@/components/Onboarding/OnboardingFlow";
import { ProviderConfigPanel } from "@/components/Settings/ProviderConfig";
import { SessionList } from "@/components/Sidebar/SessionList";
import { useEffect, useState, useRef } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { ConfirmDialog } from "@/components/Layout/ConfirmDialog";
import { isAndroid, registerBackHandler, dispatchBack } from "@/lib/androidBack";
import { useAnimatedVisibility } from "@/hooks/useAnimatedVisibility";
import { TitleBar } from "@/components/Layout/TitleBar";
import { WelcomeScreen } from "@/components/Layout/WelcomeScreen";
import { WelcomeApiSetup } from "@/components/Layout/WelcomeApiSetup";
import { CreateModeView } from "@/components/Create/CreateModeView";
import { useCreateStore } from "@/stores/createStore";

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
    createMode,
  } = useUIStore();
  const loadFromDb = useSessionStore((s) => s.loadFromDb);
  const removeSession = useSessionStore((s) => s.remove);
  const removeAllSessions = useSessionStore((s) => s.removeAll);
  const loadTemplates = useTemplateStore((s) => s.loadFromDb);
  const loadCharacters = useCharacterStore((s) => s.loadFromDb);
  const loadMcps = useMcpStore((s) => s.loadFromDb);
  const loadWorldRules = useWorldStore((s) => s.loadFromDb);
  const loadTrashFromDb = useSessionStore((s) => s.loadTrashFromDb);
  const clearExpiredTrash = useSessionStore((s) => s.clearExpiredTrash);
  const loadCardTrash = useCharacterStore((s) => s.loadTrashFromDb);
  const clearCardTrash = useCharacterStore((s) => s.clearExpiredTrash);
  const loadWorldTrash = useWorldStore((s) => s.loadTrashFromDb);
  const clearWorldTrash = useWorldStore((s) => s.clearExpiredTrash);
  const [eff, setEff] = useState<"dark" | "light">(() => {
    try {
      const raw = localStorage.getItem("airp-ui-v3") || localStorage.getItem("airp-ui-v2");
      if (raw) {
        const s = JSON.parse(raw)?.state;
        if (s?.theme === "dark") return "dark";
        if (s?.theme === "light") return "light";
        if (s?.theme === "system") return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
      }
    } catch {}
    // 默认跟随系统主题
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });
  const [welcomeSeen, setWelcomeSeen] = useState<boolean>(() => {
    try {
      return localStorage.getItem("airp-welcome-v1") === "1";
    } catch {
      return true;
    }
  });
  const providerCount = useProviderStore((s) => s.providers.length);
  const setSettingsOpen = useUIStore((s) => s.setSettingsOpen);
  // 设置面板进出场动画：300ms 与 .anim-sheet-in/out 时长一致（全屏面板档）
  const settingsAnim = useAnimatedVisibility(settingsOpen, 300);
  const [welcomeView, setWelcomeView] = useState<"home" | "setup">("home");
  const [dbReady, setDbReady] = useState<boolean | null>(null);
  const showWelcome = dbReady === true && !welcomeSeen && providerCount === 0 && !settingsOpen;
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const exitConfirmRef = useRef(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);
  const [showRemoveAllConfirm, setShowRemoveAllConfirm] = useState(false);
  const phaseInitializedRef = useRef(false);
  const lastBackRef = useRef(0);

  // 其余浮层的进出场动画（时长与对应 CSS 动画一致）
  const exitConfirmAnim = useAnimatedVisibility(showExitConfirm, 220);
  const deleteAnim = useAnimatedVisibility(!!deleteTarget, 220);
  const removeAllAnim = useAnimatedVisibility(showRemoveAllConfirm, 220);
  const createAnim = useAnimatedVisibility(!!createMode, 300);
  const sidebarAnim = useAnimatedVisibility(sidebarOpen && !settingsOpen, 240);

  // 应用启动：初始化 SQLite 并加载历史会话
  useEffect(() => {
    initDb()
      .then(() => loadFromDb())
      .then(() => loadTemplates())
      .then(() => loadCharacters())
      .then(() => loadMcps())
      .then(() => loadWorldRules())
      .then(() => clearExpiredTrash())
      .then(() => loadTrashFromDb())
      .then(() => clearCardTrash())
      .then(() => loadCardTrash())
      .then(() => clearWorldTrash())
      .then(() => loadWorldTrash())
      .then(async () => {
        // Initialize tools enabled flag from DB
        try {
          const { getAppSetting, setAppSetting } = await import("@/lib/db");
          const { setToolsEnabled } = await import("@/hooks/useChat");
          const webSearchOn = await getAppSetting("web_search_enabled");
          // 未设置过时默认开启联网搜索（并写库，避免空数据目录下功能静默失效）
          const isOn = webSearchOn === null ? true : webSearchOn === "1";
          if (webSearchOn === null) {
            setAppSetting("web_search_enabled", "1").catch(() => {});
          }
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
  }, [loadFromDb, loadTemplates, loadCharacters, loadMcps, loadWorldRules, loadTrashFromDb, clearExpiredTrash, loadCardTrash, clearCardTrash, loadWorldTrash, clearWorldTrash]);

  useEffect(() => {
    const currentTheme = effectiveTheme();
    setEff(currentTheme);
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => { if (theme === "system") setEff(mq.matches ? "dark" : "light"); };
    mq.addEventListener("change", handler);
    // Android WebView 不派发 uiMode 媒体查询变化（matchMedia change 不触发），轮询兜底实现实时跟随
    const isAndroid = typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent);
    let poll: ReturnType<typeof setInterval> | null = null;
    if (isAndroid) {
      poll = setInterval(() => {
        if (theme === "system") setEff(mq.matches ? "dark" : "light");
      }, 1500);
    }
    return () => {
      mq.removeEventListener("change", handler);
      if (poll) clearInterval(poll);
    };
  }, [theme, effectiveTheme]);

  // 同步原生窗口标题栏主题
  useEffect(() => {
    getCurrentWindow().setTheme(eff).catch(() => {});
  }, [eff]);

  // Android 返回手势：分层消费（创建模式 → 确认对话框 → 设置面板 → 开局步骤回退），未消费则交给根级「两次返回退出」
  useEffect(() => {
    const unregister = registerBackHandler(() => {
      const s = useUIStore.getState();
      if (s.createMode) {
        useCreateStore.getState().close();
        s.setCreateMode(null);
        return true;
      }
      if (showExitConfirm) {
        setShowExitConfirm(false);
        return true;
      }
      if (deleteTarget) {
        setDeleteTarget(null);
        return true;
      }
      if (showRemoveAllConfirm) {
        setShowRemoveAllConfirm(false);
        return true;
      }
      if (s.settingsOpen) {
        s.setSettingsOpen(false);
        return true;
      }
      if (s.appPhase === "onboarding" && s.onboardingStep > 1) {
        s.setOnboardingStep((s.onboardingStep - 1) as any);
        return true;
      }
      return false;
    });
    return unregister;
  }, [showExitConfirm, deleteTarget, showRemoveAllConfirm]);

  useEffect(() => {
    if (!isAndroid) return;
    let disposed = false;
    let unlisten: (() => void) | undefined;
    import("@tauri-apps/api/app").then(({ onBackButtonPress }) => {
      if (disposed) return;
      onBackButtonPress(async () => {
        const consumed = await dispatchBack();
        if (consumed) return;
        const now = Date.now();
        if (now - lastBackRef.current < 2000) {
          const { invoke } = await import("@tauri-apps/api/core");
          invoke("exit_app").catch(() => {});
        } else {
          lastBackRef.current = now;
          useUIStore.getState().notify("再按一次返回退出");
        }
      }).then((listener) => {
          if (disposed) listener.unregister().catch(() => {});
        else
          unlisten = () => {
            listener.unregister().catch(() => {});
          };
      });
    });
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, []);

  // 窗口关闭确认
  useEffect(() => {
    let disposed = false;
    let unlisten: (() => void) | undefined;
    getCurrentWindow().onCloseRequested(async (event) => {
      event.preventDefault();
      if (disposed) return;
      if (!exitConfirmRef.current) {
        exitConfirmRef.current = true;
        setShowExitConfirm(true);
      }
    }).then((fn) => {
      if (disposed) fn();
      else unlisten = fn;
    }).catch(() => {});
    return () => {
      disposed = true;
      unlisten?.();
    };
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

  // 开局流程退出：有活跃会话 → 回到对话模式；无会话（首次进入）→ 退出应用确认
  const handleOnboardingExit = () => {
    const ui = useUIStore.getState();
    const { activeId, sessions } = useSessionStore.getState();
    const hasActive = activeId && sessions.some((s) => s.id === activeId);
    if (hasActive) {
      ui.resetOnboarding();
      ui.setAppPhase("dialogue");
    } else {
      setShowExitConfirm(true);
    }
  };

  // 欢迎页：跳过 → 直接进入对话；配置完成（关闭设置面板且已配置 provider）→ 进入正常流程
  const handleWelcomeSkip = () => {
    try {
      localStorage.setItem("airp-welcome-v1", "1");
    } catch {}
    setWelcomeSeen(true);
    setAppPhase("dialogue");
  };

  const handleWelcomeConfigure = () => {
    setWelcomeView("setup");
  };

  // 独立 API 配置页保存完成：标记已见 → 进入世界选择页（开局流程）
  const handleWelcomeApiSaved = () => {
    try {
      localStorage.setItem("airp-welcome-v1", "1");
    } catch {}
    setWelcomeSeen(true);
    setAppPhase("onboarding");
  };

  useEffect(() => {
    if (settingsOpen || welcomeSeen || providerCount === 0) return;
    try {
      localStorage.setItem("airp-welcome-v1", "1");
    } catch {}
    setWelcomeSeen(true);
    setAppPhase(useSessionStore.getState().activeId ? "dialogue" : "onboarding");
  }, [settingsOpen, welcomeSeen, providerCount, setAppPhase]);

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
        <TitleBar />
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

  // 欢迎页：首次启动且未配置模型服务时展示（配置或跳过后不再出现）
  if (showWelcome) {
    return (
      <div data-platform={isAndroid ? "android" : "desktop"} className={`theme-${eff}`} style={{ height: "100vh", width: "100vw", overflow: "hidden", background: "var(--seed-bg)" }}>
        <TitleBar />
        {welcomeView === "home" ? (
          <WelcomeScreen onSkip={handleWelcomeSkip} onConfigure={handleWelcomeConfigure} />
        ) : (
          <WelcomeApiSetup onBack={() => setWelcomeView("home")} onSaved={handleWelcomeApiSaved} />
        )}
        {settingsAnim.mounted && <ProviderConfigPanel phase={settingsAnim.phase} />}
        {exitConfirmAnim.mounted && (
          <ConfirmDialog
            phase={exitConfirmAnim.phase}
            title="退出应用"
            message="确定要退出吗？"
            confirmLabel="退出"
            cancelLabel="取消"
            onConfirm={handleExitConfirm}
            onCancel={handleExitCancel}
          />
        )}
        {createAnim.mounted && <CreateModeView phase={createAnim.phase} />}
      </div>
    );
  }

  // 开局流程：全屏覆盖，无 sidebar/header
  if (appPhase === "onboarding") {
    return (
      <div data-platform={isAndroid ? "android" : "desktop"} className={`theme-${eff}`} style={{ height: "100vh", width: "100vw", overflow: "hidden", background: "var(--seed-bg)" }}>
        <TitleBar />
        <OnboardingFlow onExit={handleOnboardingExit} />
        {settingsAnim.mounted && <ProviderConfigPanel phase={settingsAnim.phase} />}
        {exitConfirmAnim.mounted && (
          <ConfirmDialog
            phase={exitConfirmAnim.phase}
            title="退出应用"
            message="确定要退出吗？"
            confirmLabel="退出"
            cancelLabel="取消"
            onConfirm={handleExitConfirm}
            onCancel={handleExitCancel}
          />
        )}
        {createAnim.mounted && <CreateModeView phase={createAnim.phase} />}
      </div>
    );
  }

  // 对话模式：全屏沉浸式小说对话（DialogueNovel 内置 FunctionBar 与会话管理）
  // 设计稿 dialogue 页面无顶部 header，仅靠右上角 info-badge 与底部 FunctionBar
  return (
    <div data-platform={isAndroid ? "android" : "desktop"} className={`theme-${eff}`} style={{ height: "100vh", width: "100vw", position: "relative", overflow: "hidden", background: "var(--seed-bg)" }}>
      {/* 自绘标题栏：无边框窗口的拖拽区 + 窗口控制按钮 */}
      <TitleBar />


      <DialogueNovel />

      {/* 传统 Sidebar：默认不显示，仅当用户从 FunctionBar 外的途径打开时渲染 */}
      {sidebarAnim.mounted && (
        <div
          className={sidebarAnim.phase === "in" ? "anim-drawer-in" : sidebarAnim.phase === "out" ? "anim-drawer-out" : "anim-init"}
          style={{
            position: "absolute", top: 0, left: 0, bottom: 0, zIndex: 150,
            display: "flex", flexDirection: "column",
            width: 240, minWidth: 240,
            background: "var(--seed-glass)", backdropFilter: "blur(20px)",
            borderRight: "1px solid var(--seed-border)",
            boxShadow: "4px 0 24px rgba(0,0,0,0.3)",
          }}
        >
          <div className="glass-sidebar" style={{ flex: 1 }}>
            <SessionList onDeleteRequest={(id, title) => setDeleteTarget({ id, title })} onRemoveAllRequest={() => setShowRemoveAllConfirm(true)} />
          </div>
        </div>
      )}

      {settingsAnim.mounted && <ProviderConfigPanel phase={settingsAnim.phase} />}

      {exitConfirmAnim.mounted && (
        <ConfirmDialog
          phase={exitConfirmAnim.phase}
          title="退出应用"
          message="确定要退出吗？"
          confirmLabel="退出"
          cancelLabel="取消"
          onConfirm={handleExitConfirm}
          onCancel={handleExitCancel}
        />
      )}

      {deleteAnim.mounted && (
        <ConfirmDialog
          phase={deleteAnim.phase}
          title="删除对话"
          message={`确定要删除「${deleteTarget?.title}」吗？删除后可在回收站中恢复。`}
          confirmLabel="删除"
          cancelLabel="取消"
          onConfirm={handleDeleteConfirm}
          onCancel={handleDeleteCancel}
        />
      )}

      {removeAllAnim.mounted && (
        <ConfirmDialog
          phase={removeAllAnim.phase}
          title="清空所有对话"
          message="确定要删除所有对话吗？删除后可在回收站中恢复。"
          confirmLabel="清空"
          cancelLabel="取消"
          onConfirm={() => { removeAllSessions(); setShowRemoveAllConfirm(false); }}
          onCancel={() => setShowRemoveAllConfirm(false)}
        />
      )}

      {createAnim.mounted && <CreateModeView phase={createAnim.phase} />}
    </div>
  );
}
