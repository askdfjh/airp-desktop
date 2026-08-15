import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Brain, ChevronDown, Check, Feather, Search, WrapText, Square, Wifi, Settings, Sparkles } from "lucide-react";
import { NarraTheme, NarraFont, NarraSession, NarraWorldInfo } from "@/components/icons/NarraIcon";
import { useUIStore } from "@/stores/uiStore";
import { useProviderStore } from "@/stores/providerStore";
import { useSessionStore } from "@/stores/sessionStore";
import { useGenerationStore } from "@/stores/generationStore";
import { setToolsEnabled } from "@/hooks/useChat";
import { setAppSetting } from "@/lib/db";
import { runCompression, stopCompress, CONTEXT_WINDOW_TOKENS, COMPRESS_ALLOW_PCT } from "@/lib/contextCompress";
import { isThinkingModel } from "@/providers/openai";
import { VolumeSheet } from "@/components/Bookshelf/VolumeSheet";
import { SearchPanel } from "./SearchPanel";
import { WorldInfoPanel } from "./WorldInfoPanel";
import { registerBackHandler } from "@/lib/androidBack";
import { useAnimatedVisibility } from "@/hooks/useAnimatedVisibility";

type OpenMenu = "provider" | "model" | "style" | null;

type FunctionBarMode = "adventure" | "blank";

export function FunctionBar({ mode = "adventure", historyTokens = 0 }: { mode?: FunctionBarMode; historyTokens?: number }) {
  const { theme, setTheme, settingsOpen, setSettingsOpen, webSearchOn, setWebSearchOn, effectiveTheme, toast, toastAction, notify, readerSettingsOpen, setReaderSettingsOpen } = useUIStore();
  const { providers, activeProviderId, activeModel, setActiveProvider, setActiveModel, enabledProviders } = useProviderStore();
  const { presets, activePresetId, setActivePreset } = useGenerationStore();
  const activePreset = presets.find((p) => p.id === activePresetId) || null;
  const { activeId, updateSessionModel, toggleThinking, setFormatEnabled, setSessionKind } = useSessionStore();
  const activeSession = useSessionStore((s) =>
    s.activeId ? s.sessions.find((ss) => ss.id === s.activeId) : null,
  );
  const [showSessionPopup, setShowSessionPopup] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showWorldInfo, setShowWorldInfo] = useState(false);
  // 会话弹窗进出场动画：220ms 与 .anim-overlay-in/out、.anim-modal-in/out 时长一致
  const sessionAnim = useAnimatedVisibility(showSessionPopup, 220);
  // 搜索面板：Modal 档（220ms）
  const searchAnim = useAnimatedVisibility(showSearch, 220);
  // 世界信息浮层：Popover 档（140ms）
  const worldInfoAnim = useAnimatedVisibility(showWorldInfo, 140);
  const compressing = useUIStore((s) => s.compressing);
  const worldBtnRef = useRef<HTMLButtonElement>(null);
  const [openMenu, setOpenMenu] = useState<OpenMenu>(null);
  const [showMore, setShowMore] = useState(false);
  const [narrow, setNarrow] = useState(
    () => typeof window !== "undefined" && (window.matchMedia("(max-width: 720px)").matches || /Android/i.test(navigator.userAgent)),
  );
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 720px)");
    const on = (e: MediaQueryListEvent) => setNarrow(e.matches || /Android/i.test(navigator.userAgent));
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  const barRef = useRef<HTMLDivElement>(null);
  const chipRefs = {
    provider: useRef<HTMLDivElement>(null),
    model: useRef<HTMLDivElement>(null),
    style: useRef<HTMLDivElement>(null),
  };
  const menuPortalRef = useRef<HTMLDivElement>(null);
  const openChipEl = openMenu ? chipRefs[openMenu].current : null;
  // 二级菜单：Popover 档（140ms）；退出动画期间保留最后的菜单类型与锚点位置（openMenu 已置 null 时内容仍可渲染）
  const menuAnim = useAnimatedVisibility(openMenu !== null, 140);
  const lastMenuRef = useRef<OpenMenu>(null);
  if (openMenu) lastMenuRef.current = openMenu;
  const chipRectRef = useRef<DOMRect | null>(null);
  if (openChipEl) chipRectRef.current = openChipEl.getBoundingClientRect();
  const renderMenuType = menuAnim.mounted ? (openMenu ?? lastMenuRef.current) : null;
  const renderRect = menuAnim.mounted ? chipRectRef.current : null;
  const eff = effectiveTheme();

  const showToast = (msg: string) => notify(msg);

  // 章节排版切换：开启 = 冒险会话 或 空白会话开启章节排版；关闭 = 回到空白纯对话
  const toggleTextFormat = () => {
    if (!activeId) return;
    setOpenMenu(null);
    const s = activeSession;
    if (!s) return;
    if (s.kind !== "blank" || s.formatEnabled) {
      // 当前开启 → 关闭
      if (s.kind !== "blank") {
        setSessionKind(activeId, "blank");
        notify("已切换为空白对话（关闭文字排版）");
      } else {
        setFormatEnabled(activeId, false);
        notify("已关闭文字排版");
      }
    } else {
      // 当前关闭 → 开启：空白会话启用章节排版（格式分析，不注入世界书/角色卡/文风）
      setFormatEnabled(activeId, true);
      notify("已开启文字排版，重新输入后生效");
    }
  };

  const activeProvider = providers.find((p) => p.id === activeProviderId) || null;
  const availableProviders = providers.filter(
    (p) => enabledProviders[p.id] !== false || p.id === activeProviderId,
  );
  const models = activeProvider?.models || [];
  // 思考模式默认开启：仅当会话明确关闭（DB 存 0）时才关闭
  const thinkingEnabled = activeSession?.thinkingEnabled ?? true;
  const isBlank = mode === "blank" || (activeSession?.kind ?? "adventure") === "blank";
  // 文本格式开启：冒险会话，或空白会话开启了格式开关（formatEnabled）
  const hasFormat = !isBlank || !!activeSession?.formatEnabled;
  // 上下文占用百分比（基于 128K 上下文窗口；达到 90% 才允许保存记忆）
  const pct = Math.min(100, Math.round((historyTokens || 0) / CONTEXT_WINDOW_TOKENS * 100));

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
      if (showMore) {
        setShowMore(false);
        return true;
      }
      if (useUIStore.getState().readerSettingsOpen) {
        useUIStore.getState().setReaderSettingsOpen(false);
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
  }, [showSessionPopup, showSearch, showWorldInfo, openMenu, showMore]);

  // Cycle theme
  const cycleTheme = () => {
    const next = theme === "dark" ? "light" : theme === "light" ? "system" : "dark";
    setTheme(next);
    const labels = { dark: "深色", light: "浅色", system: "跟随系统" };
    showToast(`已切换至${labels[next]}主题`);
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
        {/* 上下文占用百分比（保存记忆入口）：放最前，达到 90% 才可点击保存记忆（冒险/空白会话均可用） */}
        <button
          className={"seed-func-btn seed-func-pct" + (compressing ? " seed-compress-btn" : "")}
          disabled={false}
          data-tooltip={compressing ? "停止保存记忆（不保存任何变更）" : `上下文占用 ${pct}% · 保存记忆（达到 ${COMPRESS_ALLOW_PCT}% 后可压缩并保存剧情记忆）`}
          onClick={compressing
            ? stopCompress
            : () => {
                if (pct < COMPRESS_ALLOW_PCT) {
                  notify(`上下文占用 ${pct}%，达到 ${COMPRESS_ALLOW_PCT}% 后即可保存记忆`);
                  return;
                }
                void runCompression();
              }}
        >
          {compressing ? <Square size={14} fill="currentColor" /> : (
            <>
              <WrapText size={13} style={{ flexShrink: 0 }} />
              <span style={{ fontSize: 11, fontWeight: 600, fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>{pct}%</span>
            </>
          )}
        </button>

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

        {(!narrow) && (
          <>
            <button
              className={"seed-func-btn" + (thinkingEnabled ? " seed-func-btn--active" : "")}
              disabled={compressing}
              data-tooltip={thinkingEnabled ? "思考模式已开启" : "思考模式已关闭"}
              onClick={() => { if (activeId) toggleThinking(activeId); }}
            >
              <Brain size={16} />
            </button>
            <button className={"seed-func-btn" + (webSearchOn ? " seed-func-btn--active" : "")} disabled={compressing} data-tooltip={webSearchOn ? "联网搜索已开启" : "联网搜索已关闭"} onClick={toggleWebSearch}>
              <Wifi size={16} />
            </button>
            <div style={{ width: 1, height: 20, background: "var(--seed-border)", margin: "0 6px" }} />
            <button className={"seed-func-btn" + (settingsOpen ? " seed-func-btn--active" : "")} disabled={compressing} data-tooltip="设置" onClick={() => { const s = useUIStore.getState(); s.setSettingsOpen(!s.settingsOpen); }}>
              <Settings size={16} />
            </button>
            <button className="seed-func-btn" disabled={compressing} data-tooltip="深/浅主题" onClick={cycleTheme}>
              <NarraTheme size={16} />
            </button>
            <button
              className={"seed-func-btn" + (readerSettingsOpen ? " seed-func-btn--active" : "")}
              disabled={compressing}
              data-tooltip="阅读排版"
              onClick={() => setReaderSettingsOpen(!readerSettingsOpen)}
            >
              <NarraFont size={16} />
            </button>
            <button className="seed-func-btn" disabled={compressing} data-tooltip="本书卷次" onClick={() => setShowSessionPopup(true)}>
              <NarraSession size={16} />
            </button>
            <button className={"seed-func-btn" + (showSearch ? " seed-func-btn--active" : "")} disabled={compressing} data-tooltip="搜索消息" onClick={() => { setOpenMenu(null); setShowSearch((v) => !v); }}>
              <Search size={16} />
            </button>
            {isBlank && (
              <button
                className={"seed-func-btn" + (hasFormat ? " seed-func-btn--active" : "")}
                disabled={compressing}
                data-tooltip={hasFormat ? "文字排版已开启（重新输入后生效），点击关闭" : "文字排版，打开重新输入有效"}
                onClick={toggleTextFormat}
              >
                <Sparkles size={16} />
              </button>
            )}
            {!isBlank && (
              <button ref={worldBtnRef} className={"seed-func-btn" + (showWorldInfo ? " seed-func-btn--active" : "")} disabled={compressing} data-tooltip="世界信息" onClick={() => { setOpenMenu(null); setShowWorldInfo((v) => !v); }}>
                <NarraWorldInfo size={16} />
              </button>
            )}
          </>
        )}
        {narrow && <button ref={worldBtnRef} type="button" aria-hidden style={{ display: "none" }} />}
        {narrow && (
          <button
            className={"seed-func-btn" + (showMore ? " seed-func-btn--active" : "")}
            disabled={compressing}
            data-tooltip="更多"
            onClick={() => { setOpenMenu(null); setShowMore((v) => !v); }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="6" r="1.6" />
              <circle cx="12" cy="12" r="1.6" />
              <circle cx="12" cy="18" r="1.6" />
            </svg>
          </button>
        )}
      </div>
      {showMore && createPortal(
        <div className={`theme-${eff}`}>
          <button type="button" className="narra-more-mask" aria-label="关闭更多" onClick={() => setShowMore(false)} />
          <div className="narra-more-sheet">
            <button type="button" onClick={() => { if (activeId) toggleThinking(activeId); }}>{thinkingEnabled ? "思考：开" : "思考：关"}</button>
            <button type="button" onClick={() => { toggleWebSearch(); }}>{webSearchOn ? "联网：开" : "联网：关"}</button>
            <button type="button" onClick={() => { setShowMore(false); useUIStore.getState().setSettingsOpen(true); }}>设置</button>
            <button type="button" onClick={() => { cycleTheme(); }}>深浅主题</button>
            <button type="button" onClick={() => { setShowMore(false); setReaderSettingsOpen(true); }}>阅读排版</button>
            <button type="button" onClick={() => { setShowMore(false); setShowSessionPopup(true); }}>本书卷次</button>
            <button type="button" onClick={() => { setShowMore(false); setShowSearch(true); }}>搜索</button>
            {isBlank && <button type="button" onClick={() => { toggleTextFormat(); }}>文字排版</button>}
            {!isBlank && <button type="button" onClick={() => { setShowMore(false); setShowWorldInfo(true); }}>世界信息</button>}
          </div>
        </div>,
        document.body,
      )}

      {/* 模型/服务/文风 下拉菜单：portal 到 body，fixed 定位，避免窄屏滚动栏裁剪 */}
      {renderMenuType && renderRect && createPortal(
        <div className={`theme-${eff}`} ref={menuPortalRef}>
          <div
            className={menuAnim.phase === "in" ? "anim-pop-in" : menuAnim.phase === "out" ? "anim-pop-out" : "anim-init"}
            style={{
              ...menuStyle,
              position: "fixed",
              bottom: window.innerHeight - renderRect.top + 6,
              left: Math.max(8, Math.min(renderRect.left, window.innerWidth - (renderMenuType === "style" ? 260 : 240) - 8)),
              ...(renderMenuType === "style" ? { minWidth: 220, maxWidth: 260 } : {}),
            }}
          >
            {renderMenuType === "provider" && (
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
            {renderMenuType === "model" && activeProvider && (
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
            {renderMenuType === "style" && !isBlank && (
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
      {sessionAnim.mounted && createPortal(
        <div className={`theme-${eff}`}>
          <VolumeSheet phase={sessionAnim.phase} onClose={() => setShowSessionPopup(false)} />
        </div>,
        document.body
      )}

      {/* Search panel */}
      {searchAnim.mounted && createPortal(
        <div className={`theme-${eff}`}>
          <SearchPanel phase={searchAnim.phase} onClose={() => setShowSearch(false)} />
        </div>,
        document.body
      )}

      {/* World info panel (read-only) */}
      {worldInfoAnim.mounted && !isBlank && createPortal(
        <div className={`theme-${eff}`}>
          <WorldInfoPanel phase={worldInfoAnim.phase} anchorRef={worldBtnRef} onClose={() => setShowWorldInfo(false)} />
        </div>,
        document.body
      )}
    </>
  );
}
