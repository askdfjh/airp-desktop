import { useState } from "react";
import { useUIStore } from "@/stores/uiStore";
import { setToolsEnabled } from "@/hooks/useChat";
import { setAppSetting } from "@/lib/db";
import { SessionPopup } from "./SessionPopup";

export function FunctionBar() {
  const { theme, setTheme, messageFontSize, setMessageFontSize, settingsOpen, webSearchOn, setWebSearchOn } = useUIStore();
  const [showSessionPopup, setShowSessionPopup] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 1800);
  };

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

  return (
    <>
      <div className="seed-func-bar">
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

        {/* Web search toggle */}
        <button className={"seed-func-btn" + (webSearchOn ? " seed-func-btn--active" : "")} data-tooltip={webSearchOn ? "联网搜索已开启" : "联网搜索已关闭"} onClick={toggleWebSearch}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12.55a11 11 0 0 1 14.08 0" />
            <path d="M1.42 9a16 16 0 0 1 21.16 0" />
            <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
            <line x1="12" y1="20" x2="12.01" y2="20" />
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
      {toast && <div className={`seed-toast ${toast ? "seed-toast--visible" : ""}`}>{toast}</div>}

      {/* Session popup */}
      {showSessionPopup && <SessionPopup onClose={() => setShowSessionPopup(false)} />}
    </>
  );
}
