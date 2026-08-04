import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Brain, ChevronDown, Check, Feather, Search, WrapText, Square } from "lucide-react";
import { useUIStore } from "@/stores/uiStore";
import { useProviderStore } from "@/stores/providerStore";
import { useSessionStore } from "@/stores/sessionStore";
import { useGenerationStore } from "@/stores/generationStore";
import { setToolsEnabled } from "@/hooks/useChat";
import { setAppSetting } from "@/lib/db";
import { runCompression, stopCompress } from "@/lib/contextCompress";
import { isThinkingModel } from "@/providers/openai";
import { SessionPopup } from "./SessionPopup";
import { SearchPanel } from "./SearchPanel";
import { WorldInfoPanel } from "./WorldInfoPanel";
import { registerBackHandler } from "@/lib/androidBack";

type OpenMenu = "provider" | "model" | "style" | null;

type FunctionBarMode = "adventure" | "blank";

export function FunctionBar({ mode = "adventure" }: { mode?: FunctionBarMode }) {
  const { theme, setTheme, messageFontSize, setMessageFontSize, settingsOpen, setSettingsOpen, webSearchOn, setWebSearchOn, effectiveTheme, toast, toastAction, notify } = useUIStore();
  const { providers, activeProviderId, activeModel, setActiveProvider, setActiveModel, enabledProviders } = useProviderStore();
  const { presets, activePresetId, setActivePreset } = useGenerationStore();
  const activePreset = presets.find((p) => p.id === activePresetId) || null;
  const { activeId, updateSessionModel, toggleThinking } = useSessionStore();
  const activeSession = useSessionStore((s) =>
    s.activeId ? s.sessions.find((ss) => ss.id === s.activeId) : null,
  );
  const [showSessionPopup, setShowSessionPopup] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showWorldInfo, setShowWorldInfo] = useState(false);
  const compressing = useUIStore((s) => s.compressing);
  const worldBtnRef = useRef<HTMLButtonElement>(null);
  const [openMenu, setOpenMenu] = useState<OpenMenu>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const chipRefs = {
    provider: useRef<HTMLDivElement>(null),
    model: useRef<HTMLDivElement>(null),
    style: useRef<HTMLDivElement>(null),
  };
  const menuPortalRef = useRef<HTMLDivElement>(null);
  const openChipEl = openMenu ? chipRefs[openMenu].current : null;
  const chipRect = openChipEl ? openChipEl.getBoundingClientRect() : null;
  const eff = effectiveTheme();

  const showToast = (msg: string) => notify(msg);

  const activeProvider = providers.find((p) => p.id === activeProviderId) || null;
  const availableProviders = providers.filter(
    (p) => enabledProviders[p.id] !== false || p.id === activeProviderId,
  );
  const models = activeProvider?.models || [];
  const thinkingEnabled = activeSession?.thinkingEnabled ?? false;
  const isBlank = mode === "blank" || (activeSession?.kind ?? "adventure") === "blank";

  // 点击外部 / Esc 关闭下拉
  useEffect(() => {
    if (!openMenu) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (menuPortalRef.current && menuPortalRef.current.contains(t)) return;
      if (barRef.current && !barRef.current.contains(t)) setOpenMenu(null);
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

      // Android back: close popups (session mgmt/search/world info/dropdown) first, then dismiss the keyboard
  useEffect(() => {
    const unregister = registerBackHandler(() => {
      if (showSessionPopup) {
        setShowSessionPopup(false);
        return true;
      }
      if (showSearch) {
        setShowSearch(false);
        return true;
      }
      if (showWorldInfo) {
        setShowWorldInfo(false);
        return true;
      }
      if (openMenu) {
        setOpenMenu(null);
        return true;
      }
      const ae = document.activeElement as HTMLElement | null;
      if (ae && (ae.tagName === "INPUT" || ae.tagName === "TEXTAREA")) {
        ae.blur();
        return true;
      }
      return false;
    });
    return unregister;
  }, [showSessionPopup, showSearch, showWorldInfo, openMenu]);

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

  // 文风预设切换（与设置面板同源，实时生效）
  const handleStyleSelect = (id: string) => {
    if (isBlank) return;
    setActivePreset(activePresetId === id ? "none" : id);
    const next = presets.find((p) => p.id === id);
    showToast(activePresetId === id ? "文风已关闭" : `已切换文风：${next?.name ?? ""}`);
    setOpenMenu(null);
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
        <div ref={chipRefs.provider} style={{ position: "relative" }}>
          <button
            className="seed-func-chip" disabled={compressing}
            data-tooltip={activeProvider ? activeProvider.name : "未配置服务"}
            onClick={() => setOpenMenu((m) => (m === "provider" ? null : "provider"))}
          >
            <span>{activeProvider ? activeProvider.name : "未配置服务"}</span>
            <ChevronDown size={12} style={{ flexShrink: 0 }} />
          </button>
        </div>

        {/* 模型切换 */}
        <div ref={chipRefs.model} style={{ position: "relative" }}>
          <button
            className="seed-func-chip" disabled={compressing}
            data-tooltip={activeModel || "选择模型"}
            onClick={handleModelChip}
          >
            <span>{activeModel || "选择模型"}</span>
            <ChevronDown size={12} style={{ flexShrink: 0 }} />
          </button>
        </div>

        {/* 文风切换：空白会话保持纯对话，不显示/注入文风预设 */}
        {!isBlank && (
          <div ref={chipRefs.style} style={{ position: "relative" }}>
            <button
              className={"seed-func-chip" + (activePreset ? "" : " seed-func-chip--muted")}
              disabled={compressing}
              data-tooltip="输出文风预设"
              onClick={() => setOpenMenu((m) => (m === "style" ? null : "style"))}
            >
              <Feather size={13} style={{ flexShrink: 0 }} />
              <span>{activePreset ? activePreset.name : "文风"}</span>
              <ChevronDown size={12} style={{ flexShrink: 0 }} />
            </button>
          </div>
        )}

        {/* 思考模式快捷开关 */}
        <button
          className={"seed-func-btn" + (thinkingEnabled ? " seed-func-btn--active" : "")}
          disabled={compressing}
          data-tooltip={thinkingEnabled ? "思考模式已开启" : "思考模式已关闭"}
          onClick={() => { if (activeId) toggleThinking(activeId); }}
        >
          <Brain size={16} />
        </button>

        {/* Web search toggle */}
        <button className={"seed-func-btn" + (webSearchOn ? " seed-func-btn--active" : "")} disabled={compressing} data-tooltip={webSearchOn ? "联网搜索已开启" : "联网搜索已关闭"} onClick={toggleWebSearch}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12.55a11 11 0 0 1 14.08 0" />
            <path d="M1.42 9a16 16 0 0 1 21.16 0" />
            <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
            <line x1="12" y1="20" x2="12.01" y2="20" />
          </svg>
        </button>

        <div style={{ width: 1, height: 20, background: "var(--seed-border)", margin: "0 6px" }} />

        {/* Settings */}
        <button className={"seed-func-btn" + (settingsOpen ? " seed-func-btn--active" : "")} disabled={compressing} data-tooltip="设置" onClick={() => { const s = useUIStore.getState(); s.setSettingsOpen(!s.settingsOpen); }}>
          <svg viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
          </svg>
        </button>

        {/* Theme */}
        <button className="seed-func-btn" disabled={compressing} data-tooltip="深/浅主题" onClick={cycleTheme}>
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
        <button className="seed-func-btn" disabled={compressing} data-tooltip="字体大小" onClick={cycleFontSize}>
          <svg viewBox="0 0 24 24">
            <polyline points="4 7 4 4 20 4 20 7" />
            <line x1="9" y1="20" x2="15" y2="20" />
            <line x1="12" y1="4" x2="12" y2="20" />
          </svg>
        </button>

        {/* Session management */}
        <button className="seed-func-btn" disabled={compressing} data-tooltip="会话管理" onClick={() => setShowSessionPopup(true)}>
          <svg viewBox="0 0 24 24">
            <polygon points="12 2 2 7 12 12 22 7 12 2" />
            <polyline points="2 17 12 22 22 17" />
            <polyline points="2 12 12 17 22 12" />
          </svg>
        </button>

        {/* Search messages */}
        <button className={"seed-func-btn" + (showSearch ? " seed-func-btn--active" : "")} disabled={compressing} data-tooltip="搜索消息" onClick={() => { setOpenMenu(null); setShowSearch((v) => !v); }}>
          <Search size={16} />
        </button>

        {/* Compress story: 仅冒险会话显示；空白会话不提取角色/故事脉络 */}
        {!isBlank && (
          <button
            className={"seed-func-btn" + (compressing ? " seed-compress-btn" : "")}
            data-tooltip={compressing ? "停止整理（不保存任何变更）" : "整理故事（压缩上下文，提取角色）"}
            onClick={compressing ? stopCompress : () => void runCompression()}
          >
            {compressing ? <Square size={16} fill="currentColor" /> : <WrapText size={16} />}
          </button>
        )}

        {/* World info：空白会话不显示世界规则入口 */}
        {!isBlank && (
          <button ref={worldBtnRef} className={"seed-func-btn" + (showWorldInfo ? " seed-func-btn--active" : "")} disabled={compressing} data-tooltip="世界信息" onClick={() => { setOpenMenu(null); setShowWorldInfo((v) => !v); }}>
            <svg viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="10" />
              <line x1="2" y1="12" x2="22" y2="12" />
              <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
            </svg>
          </button>
        )}
      </div>

      {/* 模型/服务/文风 下拉菜单：portal 到 body，fixed 定位，避免窄屏滚动栏裁剪 */}
      {openMenu && chipRect && createPortal(
        <div className={`theme-${eff}`} ref={menuPortalRef}>
          <div
            style={{
              ...menuStyle,
              position: "fixed",
              bottom: window.innerHeight - chipRect.top + 6,
              left: Math.max(8, Math.min(chipRect.left, window.innerWidth - (openMenu === "style" ? 260 : 240) - 8)),
              ...(openMenu === "style" ? { minWidth: 220, maxWidth: 260 } : {}),
            }}
          >
            {openMenu === "provider" && (
              <>
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
              </>
            )}
            {openMenu === "model" && activeProvider && (
              <>
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
              </>
            )}
            {openMenu === "style" && !isBlank && (
              <>
                {presets.map((p) => {
                  const act = p.id === activePresetId;
                  return (
                    <div
                      key={p.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "7px 10px",
                        borderRadius: 8,
                        fontSize: 12,
                        cursor: "pointer",
                        background: act ? "var(--seed-accent-bg)" : "transparent",
                        color: act ? "var(--seed-accent)" : "var(--seed-muted)",
                      }}
                      onClick={() => handleStyleSelect(p.id)}
                      onMouseEnter={(e) => { e.currentTarget.style.background = "var(--seed-hover-bg)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = act ? "var(--seed-accent-bg)" : "transparent"; }}
                    >
                      <span style={{ flexShrink: 0, fontWeight: 600, whiteSpace: "nowrap" }}>{p.name}</span>
                      <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", opacity: 0.7 }}>{p.description}</span>
                      {act && <Check size={12} style={{ flexShrink: 0 }} />}
                    </div>
                  );
                })}
                {activePresetId !== "none" && (
                  <div
                    style={{ ...itemStyle(false), borderTop: "1px solid var(--seed-border)", marginTop: 4, borderRadius: 0 }}
                    onClick={() => handleStyleSelect(activePresetId)}
                  >
                    <span>关闭文风预设</span>
                  </div>
                )}
              </>
            )}
          </div>
        </div>,
        document.body
      )}

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

      {/* Search panel */}
      {showSearch && createPortal(
        <div className={`theme-${eff}`}>
          <SearchPanel onClose={() => setShowSearch(false)} />
        </div>,
        document.body
      )}

      {/* World info panel (read-only) */}
      {showWorldInfo && !isBlank && createPortal(
        <div className={`theme-${eff}`}>
          <WorldInfoPanel anchorRef={worldBtnRef} onClose={() => setShowWorldInfo(false)} />
        </div>,
        document.body
      )}
    </>
  );
}
