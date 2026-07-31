import { useState, useEffect, useRef } from "react";
import { useSessionStore } from "@/stores/sessionStore";
import { useUIStore } from "@/stores/uiStore";

interface Props {
  onClose: () => void;
}

export function SessionPopup({ onClose }: Props) {
  const sessions = useSessionStore((s) => s.sessions);
  const activeId = useSessionStore((s) => s.activeId);
  const setActiveSession = useSessionStore((s) => s.setActive);
  const removeSession = useSessionStore((s) => s.remove);
  const createBlankSession = useSessionStore((s) => s.createBlankSession);
  const [search, setSearch] = useState("");
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const filtered = sessions.filter((s) =>
    !search || s.title.toLowerCase().includes(search.toLowerCase())
  );
  const sorted = [...filtered].sort((a, b) => b.updatedAt - a.updatedAt);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const groups: { label: string; items: typeof sorted }[] = [];
  const todayItems = sorted.filter((s) => s.updatedAt >= today.getTime());
  const yesterdayItems = sorted.filter((s) => s.updatedAt >= yesterday.getTime() && s.updatedAt < today.getTime());
  const olderItems = sorted.filter((s) => s.updatedAt < yesterday.getTime());

  if (todayItems.length) groups.push({ label: "今天", items: todayItems });
  if (yesterdayItems.length) groups.push({ label: "昨天", items: yesterdayItems });
  if (olderItems.length) groups.push({ label: "更早", items: olderItems });

  const handleSelect = (id: string) => {
    setActiveSession(id);
    onClose();
  };

  const handleNewSession = () => {
    useUIStore.getState().resetOnboarding();
    useUIStore.getState().setAppPhase("onboarding");
    onClose();
  };

  const handleBlankSession = () => {
    createBlankSession();
    onClose();
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("确定要删除这个对话吗？")) {
      removeSession(id);
    }
  };

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.getHours().toString().padStart(2, "0") + ":" + d.getMinutes().toString().padStart(2, "0");
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

  return (
    <div
      ref={overlayRef}
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
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
        animation: "seed-fade-in-up 0.2s ease-out",
      }}
    >
      <div
        style={{
          width: "480px",
          minWidth: "480px",
          maxWidth: "90vw",
          minHeight: "280px",
          maxHeight: "70vh",
          background: seed.bg,
          border: "1px solid " + seed.border,
          borderRadius: "16px",
          boxShadow: "0 16px 64px rgba(0,0,0,0.5)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          animation: "seed-fade-in-up 0.25s ease-out",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "16px 20px 12px",
            borderBottom: "1px solid " + seed.border,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flex: "0 0 auto",
          }}
        >
          <span style={{ fontSize: "15px", fontWeight: 600, color: seed.fg }}>会话管理</span>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: seed.muted,
              cursor: "pointer",
              padding: "4px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
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
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Search */}
        <div style={{ padding: "12px 20px 8px", flex: "0 0 auto" }}>
          <input
            placeholder="搜索会话..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
            style={{
              width: "100%",
              padding: "10px 14px",
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
        </div>

        {/* Session list */}
        <div
          style={{
            flex: "1 1 auto",
            minHeight: "0px",
            overflowY: "auto",
            padding: "8px 12px",
          }}
        >
          {groups.map((group) => (
            <div key={group.label}>
              <div style={{
                fontSize: "11px",
                fontWeight: 600,
                color: seed.muted,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                padding: "8px 12px 4px",
              }}>
                {group.label}
              </div>
              {group.items.map((session) => (
                <div
                  key={session.id}
                  onClick={() => handleSelect(session.id)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    padding: "10px 12px",
                    borderRadius: "10px",
                    cursor: "pointer",
                    transition: "background 0.15s",
                    marginBottom: "2px",
                    background: session.id === activeId ? seed.accentBg : "transparent",
                    border: session.id === activeId ? "1px solid color-mix(in srgb, " + seed.accent + " 15%, transparent)" : "1px solid transparent",
                  }}
                  onMouseEnter={(e) => {
                    if (session.id !== activeId) e.currentTarget.style.background = seed.hoverBg;
                  }}
                  onMouseLeave={(e) => {
                    if (session.id !== activeId) e.currentTarget.style.background = "transparent";
                  }}
                >
                  <span style={{
                    flex: 1,
                    fontSize: "14px",
                    color: seed.fg,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}>
                    {session.title || "未命名对话"}
                  </span>
                  <span style={{ fontSize: "11px", color: seed.muted, flexShrink: 0 }}>
                    {formatTime(session.updatedAt)}
                  </span>
                  <button
                    onClick={(e) => handleDelete(session.id, e)}
                    style={{
                      background: "none",
                      border: "none",
                      color: seed.muted,
                      cursor: "pointer",
                      padding: "4px",
                      opacity: 0.5,
                      transition: "opacity 0.15s, color 0.15s",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.opacity = "1";
                      e.currentTarget.style.color = "var(--danger, #ef4444)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.opacity = "0.5";
                      e.currentTarget.style.color = seed.muted;
                    }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          ))}

          {sorted.length === 0 && (
            <div style={{ textAlign: "center", padding: "40px 0", color: seed.muted, fontSize: "14px" }}>
              {search ? "没有匹配的会话" : "暂无会话"}
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div
          style={{
            padding: "12px 20px",
            borderTop: "1px solid " + seed.border,
            display: "flex",
            gap: "8px",
            flex: "0 0 auto",
          }}
        >
          <button
            onClick={handleBlankSession}
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
              padding: "8px 16px",
              background: seed.inputBg,
              color: seed.fg,
              fontFamily: "inherit",
              fontSize: "13px",
              fontWeight: 600,
              border: "1px solid " + seed.border,
              borderRadius: "10px",
              cursor: "pointer",
              transition: "background 0.2s, border-color 0.2s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = seed.hoverBg;
              e.currentTarget.style.borderColor = seed.accent;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = seed.inputBg;
              e.currentTarget.style.borderColor = seed.border;
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14.5 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V7.5L14.5 2z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
            空白会话
          </button>
          <button
            onClick={handleNewSession}
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
              padding: "8px 16px",
              background: seed.accent,
              color: "#fff",
              fontFamily: "inherit",
              fontSize: "13px",
              fontWeight: 600,
              border: "none",
              borderRadius: "10px",
              cursor: "pointer",
              transition: "background 0.2s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "color-mix(in srgb, var(--seed-accent, #7c6aef) 85%, white)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = seed.accent;
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 2 7 12 12 22 7 12 2" />
              <polyline points="2 17 12 22 22 17" />
              <polyline points="2 12 12 17 22 12" />
            </svg>
            新建冒险
          </button>
        </div>
      </div>
    </div>
  );
}
