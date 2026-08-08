import { useState, useEffect, useRef } from "react";
import { useSessionStore } from "@/stores/sessionStore";
import { useKeyboardShift } from "@/hooks/useKeyboardShift";
import type { AnimPhase } from "@/hooks/useAnimatedVisibility";

interface Props {
  onClose: () => void;
  /** 进出场动画阶段：由父级 useAnimatedVisibility 控制 */
  phase?: AnimPhase;
}

/**
 * 全局消息搜索：按关键词搜索历史消息与会话标题，点击结果跳转到对应消息。
 * 样式与 SessionPopup 一致（seed-* 设计 token + 全屏遮罩 + 居中面板）。
 */
export function SearchPanel({ onClose, phase = "in" }: Props) {
  const kbdShift = useKeyboardShift();
  const results = useSessionStore((s) => s.searchResults);
  const searching = useSessionStore((s) => s.searching);
  const doSearch = useSessionStore((s) => s.doSearch);
  const clearSearch = useSessionStore((s) => s.clearSearch);
  const jumpToMessage = useSessionStore((s) => s.jumpToMessage);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  // 250ms 防抖搜索；输入清空时立即清除结果
  useEffect(() => {
    const q = query.trim();
    if (!q) {
      clearSearch();
      return;
    }
    const t = setTimeout(() => { void doSearch(q); }, 250);
    return () => clearTimeout(t);
  }, [query, doSearch, clearSearch]);

  // Esc 关闭 / 点击遮罩关闭
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  // 关闭时清理搜索状态
  useEffect(() => () => clearSearch(), [clearSearch]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handlePick = (r: (typeof results)[0]) => {
    jumpToMessage(r.sessionId, r.messageId || "", query.trim());
    onClose();
  };

  const seed = {
    bg: "var(--seed-surface, #14141a)",
    fg: "var(--seed-fg, #e8e6f0)",
    muted: "var(--seed-muted, #6b6880)",
    accent: "var(--seed-accent, #7c6aef)",
    border: "var(--seed-border, #252532)",
    hoverBg: "var(--seed-hover-bg, #1e1e2a)",
    accentBg: "var(--seed-accent-bg, rgba(124,106,239,0.12))",
    inputBg: "var(--seed-input-bg, #1a1a24)",
  };

  const tagFor = (r: (typeof results)[0]): { label: string; fg: string; bg: string } => {
    if (r.matchType === "title") return { label: "标题", fg: seed.accent, bg: seed.accentBg };
    if (r.role === "user") return { label: "用户", fg: seed.accent, bg: seed.accentBg };
    return { label: "助手", fg: seed.muted, bg: seed.hoverBg };
  };

  const relativeTime = (ts: number) => {
    const diff = Date.now() - ts;
    if (diff < 60_000) return "刚刚";
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`;
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`;
    if (diff < 86_400_000 * 7) return `${Math.floor(diff / 86_400_000)} 天前`;
    const d = new Date(ts);
    return `${d.getMonth() + 1}月${d.getDate()}日`;
  };

  const renderHighlight = (text: string) => {
    const q = query.trim();
    if (!q) return text;
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return text.split(new RegExp(`(${escaped})`, "ig")).map((part, i) =>
      part.toLowerCase() === q.toLowerCase() ? (
        <span
          key={i}
          style={{
            background: seed.accentBg,
            color: seed.accent,
            borderRadius: 3,
            padding: "0 2px",
            fontWeight: 600,
          }}
        >
          {part}
        </span>
      ) : (
        part
      ),
    );
  };

  return (
    <div
      ref={overlayRef}
      data-popover-overlay
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
      className={phase === "in" ? "anim-overlay-in" : phase === "out" ? "anim-overlay-out" : "anim-init"}
      style={{
        position: "fixed",
        inset: "0px",
        zIndex: 200,
        background: "rgba(0,0,0,0.45)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        paddingTop: 0,
        paddingBottom: kbdShift > 0 ? kbdShift + 16 : 0,
      }}
    >
      <div
        className={phase === "in" ? "anim-modal-in" : phase === "out" ? "anim-modal-out" : "anim-init"}
        style={{
          width: "min(560px, 94vw)",
          minWidth: 0,
          maxWidth: "94vw",
          minHeight: "280px",
          maxHeight: "70vh",
          background: seed.bg,
          border: "1px solid " + seed.border,
          borderRadius: "16px",
          boxShadow: "0 16px 64px rgba(0,0,0,0.5)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "16px 20px 10px",
            borderBottom: "1px solid " + seed.border,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flex: "0 0 auto",
          }}
        >
          <span style={{ fontSize: "15px", fontWeight: 600, color: seed.fg }}>搜索消息</span>
          <button
            onClick={onClose}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 28,
              height: 28,
              background: "none",
              border: "none",
              color: seed.muted,
              cursor: "pointer",
              padding: 0,
              borderRadius: "6px",
              transition: "background 0.15s, color 0.15s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = seed.hoverBg;
              e.currentTarget.style.color = seed.fg;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = seed.muted;
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Search input */}
        <div style={{ padding: "12px 20px 8px", flex: "0 0 auto", position: "relative" }}>
          <svg
            width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            style={{ position: "absolute", left: 30, top: 24, color: seed.muted, pointerEvents: "none" }}
          >
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            ref={inputRef}
            placeholder="搜索历史消息或会话标题..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{
              width: "100%",
              padding: "10px 14px 10px 34px",
              background: seed.inputBg,
              border: "1px solid " + seed.border,
              borderRadius: "10px",
              color: seed.fg,
              fontSize: "13px",
              fontFamily: "inherit",
              outline: "none",
              boxSizing: "border-box",
              transition: "border-color 0.2s",
            }}
            onFocus={(e) => { e.currentTarget.style.borderColor = "color-mix(in srgb, var(--seed-accent, #7c6aef) 30%, transparent)"; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = seed.border; }}
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              style={{
                position: "absolute",
                right: 28,
                top: 20,
                width: 20,
                height: 20,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "none",
                border: "none",
                color: seed.muted,
                cursor: "pointer",
                padding: 0,
                borderRadius: "6px",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = seed.fg; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = seed.muted; }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>

        {/* Results */}
        <div
          style={{
            flex: "1 1 auto",
            minHeight: "0px",
            overflowY: "auto",
            padding: "8px 12px",
          }}
        >
          {searching ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "40px 0", color: seed.muted, fontSize: "13px" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation: "seed-spin 0.8s linear infinite" }}>
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
              搜索中...
            </div>
          ) : !query.trim() ? (
            <div style={{ textAlign: "center", padding: "40px 0", color: seed.muted, fontSize: "13px" }}>
              输入关键词，搜索所有历史消息与对话标题
            </div>
          ) : results.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 0", color: seed.muted, fontSize: "13px" }}>
              没有找到相关消息
            </div>
          ) : (
            results.map((r) => {
              const tag = tagFor(r);
              return (
                <div
                  key={r.messageId || `title-${r.sessionId}`}
                  onClick={() => handlePick(r)}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 5,
                    padding: "10px 12px",
                    borderRadius: "10px",
                    cursor: "pointer",
                    marginBottom: "2px",
                    transition: "background 0.15s",
                    border: "1px solid transparent",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = seed.hoverBg; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                    <span style={{ fontSize: "11px", color: seed.muted, flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {r.sessionTitle || "未命名对话"}
                    </span>
                    <span style={{ fontSize: "11px", color: seed.muted, flexShrink: 0 }}>{relativeTime(r.createdAt)}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 8, minWidth: 0 }}>
                    <span
                      style={{
                        flexShrink: 0,
                        fontSize: "10.5px",
                        fontWeight: 600,
                        padding: "2px 8px",
                        borderRadius: 999,
                        color: tag.fg,
                        background: tag.bg,
                        marginTop: 1,
                      }}
                    >
                      {tag.label}
                    </span>
                    <span
                      style={{
                        flex: 1,
                        minWidth: 0,
                        fontSize: "13px",
                        lineHeight: 1.6,
                        color: seed.fg,
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                        wordBreak: "break-all",
                      }}
                    >
                      {renderHighlight(r.content)}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
