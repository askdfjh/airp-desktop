import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Brain, ChevronDown, Check } from "lucide-react";
import { useUIStore } from "@/stores/uiStore";
import { useProviderStore } from "@/stores/providerStore";
import { useSessionStore } from "@/stores/sessionStore";
import { setToolsEnabled } from "@/hooks/useChat";
import { setAppSetting } from "@/lib/db";
import { isThinkingModel } from "@/providers/openai";
import { SessionPopup } from "./SessionPopup";

type OpenMenu = "provider" | "model" | null;

export function FunctionBar() {
  const { theme, setTheme, messageFontSize, setMessageFontSize, settingsOpen, setSettingsOpen, webSearchOn, setWebSearchOn, effectiveTheme, toast, toastAction, notify } = useUIStore();
  const { providers, activeProviderId, activeModel, setActiveProvider, setActiveModel, enabledProviders } = useProviderStore();
  const { activeId, updateSessionModel, toggleThinking } = useSessionStore();
  const activeSession = useSessionStore((s) =>
    s.activeId ? s.sessions.find((ss) => ss.id === s.activeId) : null,
  );
  const [showSessionPopup, setShowSessionPopup] = useState(false);
  const [openMenu, setOpenMenu] = useState<OpenMenu>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const eff = effectiveTheme();

  const showToast = (msg: string) => notify(msg);

  const activeProvider = providers.find((p) => p.id === activeProviderId) || null;
  const availableProviders = providers.filter(
    (p) => enabledProviders[p.id] !== false || p.id === activeProviderId,
  );
  const models = activeProvider?.models || [];
  const thinkingEnabled = activeSession?.thinkingEnabled ?? false;

  // 点击外部 / Esc 关闭下拉
  useEffect(() => {
    if (!openMenu) return;
    const onDown = (e: MouseEvent) => {
      if (barRef.current && !barRef.current.contains(e.target as Node)) setOpenMenu(null);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenMenu(null);
    };
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [openMenu]);

  // Cycle theme
  const cycleTheme = () => {
    const next = theme === "dark" ? "light" : theme === "light" ? "system" : "dark";
    setTheme(next);
    const labels = { dark: "深色", light: "浅色", system: "跟随系统" };
    showToast(`已切换至${labels[next]}主题`);
  };

  // Cycle font size
  const fontSizes = ["xs", "sm", "md", "lg", "xl"] as const;
  const fontLabels: Record<string, string> = { xs: "最小", sm: "小", md: "中", lg: "大", xl: "最大" };
  const cycleFontSize = () => {
    const currentIdx = fontSizes.indexOf(messageFontSize);
    const nextIdx = (currentIdx + 1) % fontSizes.length;
    setMessageFontSize(fontSizes[nextIdx]);
    showToast(`字体大小：${fontLabels[fontSizes[nextIdx]]}`);
  };

  // Toggle web search
  const toggleWebSearch = () => {
    const next = !webSearchOn;
    setWebSearchOn(next);
    setToolsEnabled(next);
    setAppSetting("web_search_enabled", next ? "1" : "0");
    showToast(next ? "联网搜索已开启" : "联网搜索已关闭");
  };

  // 模型/Provider 切换
  const applyModel = (pid: string, model: string) => {
    setActiveProvider(pid);
    setActiveModel(model);
    // 思考模式所有模型默认开启
    if (activeId) updateSessionModel(activeId, pid, model, true);
    setOpenMenu(null);
  };

  const switchProvider = (pid: string) => {
    const p = providers.find((pp) => pp.id === pid);
    if (!p) return;
    const model = p.models.includes(activeModel) ? activeModel : p.models[0] || "";
    applyModel(pid, model);
  };

  const handleModelChip = () => {
    if (!activeProvider) {
      notify("未配置模型服务，请先在设置中配置", "settings");
      return;
    }
    setOpenMenu((m) => (m === "model" ? null : "model"));
  };

  const menuStyle: React.CSSProperties = {
    position: "absolute",
    bottom: "calc(100% + 6px)",
    left: 0,
    minWidth: 180,
    maxWidth: 240,
    maxHeight: 280,
    overflowY: "auto",
    background: "var(--seed-surface)",
    border: "1px solid var(--seed-border)",
    borderRadius: 12,
    boxShadow: "0 8px 32px rgba(0,0,0,0.45)",
    padding: 4,
    zIndex: 300,
  };

  const itemStyle = (active: boolean): React.CSSProperties => ({
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "7px 10px",
    borderRadius: 8,
    fontSize: 12,
    cursor: "pointer",
    background: active ? "var(--seed-accent-bg)" : "transparent",
    color: active ? "var(--seed-accent)" : "var(--seed-muted)",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  });

  return (
    <>
      <div className="seed-func-bar" ref={barRef}>
        {/* Provider 切换 */}
        <div style={{ position: "relative" }}>
          <button
            className="seed-func-chip"
            data-tooltip={activeProvider ? activeProvider.name : "未配置服务"}
            onClick={() => setOpenMenu((m) => (m === "provider" ? null : "provider"))}
          >
            <span>{activeProvider ? activeProvider.name : "未配置服务"}</span>
            <ChevronDown size={12} style={{ flexShrink: 0 }} />
          </button>
          {openMenu === "provider" && (
            <div style={menuStyle}>
              {availableProviders.length === 0 && (
                <div style={{ padding: "8px 10px", fontSize: 12, color: "var(--seed-muted)" }}>
                  暂无 Provider，请在设置中添加
                </div>
              )}
              {availableProviders.map((p) => (
                <div
                  key={p.id}
                  style={itemStyle(p.id === activeProviderId)}
                  onClick={() => switchProvider(p.id)}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "var(--seed-hover-bg)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = p.id === activeProviderId ? "var(--seed-accent-bg)" : "transparent"; }}
                >
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{p.name}</span>
                  {p.id === activeProviderId && <Check size={12} style={{ flexShrink: 0 }} />}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 模型切换 */}
        <div style={{ position: "relative" }}>
          <button
            className="seed-func-chip"
            data-tooltip={activeModel || "选择模型"}
            onClick={handleModelChip}
          >
            <span>{activeModel || "选择模型"}</span>
            <ChevronDown size={12} style={{ flexShrink: 0 }} />
          </button>
          {openMenu === "model" && activeProvider && (
            <div style={menuStyle}>
              {models.length === 0 && (
                <div style={{ padding: "8px 10px", fontSize: 12, color: "var(--seed-muted)" }}>
                  该服务暂无模型，请在设置中添加
                </div>
              )}
              {models.map((m) => (
                <div
                  key={m}
                  style={itemStyle(m === activeModel)}
                  onClick={() => applyModel(activeProvider.id, m)}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "var(--seed-hover-bg)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = m === activeModel ? "var(--seed-accent-bg)" : "transparent"; }}
                >
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{m}</span>
                  {m === activeModel && <Check size={12} style={{ flexShrink: 0 }} />}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 思考模式快捷开关 */}
        <button
          className={"seed-func-btn" + (thinkingEnabled ? " seed-func-btn--active" : "")}
          data-tooltip={thinkingEnabled ? "思考模式已开启" : "思考模式已关闭"}
          onClick={() => { if (activeId) toggleThinking(activeId); }}
        >
          <Brain size={16} />
        </button>

        {/* Web search toggle */}
        <button className={"seed-func-btn" + (webSearchOn ? " seed-func-btn--active" : "")} data-tooltip={webSearchOn ? "联网搜索已开启" : "联网搜索已关闭"} onClick={toggleWebSearch}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12.55a11 11 0 0 1 14.08 0" />
            <path d="M1.42 9a16 16 0 0 1 21.16 0" />
            <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
            <line x1="12" y1="20" x2="12.01" y2="20" />
          </svg>
        </button>

        <div style={{ width: 1, height: 20, background: "var(--seed-border)", margin: "0 6px" }} />

        {/* Settings */}
        <button className={"seed-func-btn" + (settingsOpen ? " seed-func-btn--active" : "")} data-tooltip="设置" onClick={() => { const s = useUIStore.getState(); s.setSettingsOpen(!s.settingsOpen); }}>
          <svg viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
          </svg>
        </button>

        {/* Theme */}
        <button className="seed-func-btn" data-tooltip="深/浅主题" onClick={cycleTheme}>
          <svg viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="5" />
            <line x1="12" y1="1" x2="12" y2="3" />
            <line x1="12" y1="21" x2="12" y2="23" />
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
            <line x1="1" y1="12" x2="3" y2="12" />
            <line x1="21" y1="12" x2="23" y2="12" />
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
          </svg>
        </button>

        {/* Font size */}
        <button className="seed-func-btn" data-tooltip="字体大小" onClick={cycleFontSize}>
          <svg viewBox="0 0 24 24">
            <polyline points="4 7 4 4 20 4 20 7" />
            <line x1="9" y1="20" x2="15" y2="20" />
            <line x1="12" y1="4" x2="12" y2="20" />
          </svg>
        </button>

        {/* Session management */}
        <button className="seed-func-btn" data-tooltip="会话管理" onClick={() => setShowSessionPopup(true)}>
          <svg viewBox="0 0 24 24">
            <polygon points="12 2 2 7 12 12 22 7 12 2" />
            <polyline points="2 17 12 22 22 17" />
            <polyline points="2 12 12 17 22 12" />
          </svg>
        </button>

        {/* World info */}
        <button className="seed-func-btn" data-tooltip="世界信息" onClick={() => showToast("世界信息面板 — 开发中")}>
          <svg viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" />
            <line x1="2" y1="12" x2="22" y2="12" />
            <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
          </svg>
        </button>
      </div>

      {/* Toast */}
      {toast && createPortal(
        <div className={`theme-${eff}`}>
          <div
            className={`seed-toast ${toast ? "seed-toast--visible" : ""}${toastAction === "settings" ? " seed-toast--clickable" : ""}`}
            onClick={toastAction === "settings" ? () => setSettingsOpen(true) : undefined}
          >
            {toast}
            {toastAction === "settings" && (
              <span style={{ marginLeft: 8, color: "var(--seed-accent)", fontWeight: 600 }}>前往配置 ›</span>
            )}
          </div>
        </div>,
        document.body
      )}

      {/* Session popup */}
      {showSessionPopup && createPortal(
        <div className={`theme-${eff}`}>
          <SessionPopup onClose={() => setShowSessionPopup(false)} />
        </div>,
        document.body
      )}
    </>
  );
}
