import { useState, useEffect, useRef } from "react";
import type { Session } from "@/types";
import { useSessionStore } from "@/stores/sessionStore";
import { useUIStore } from "@/stores/uiStore";
import { TRASH_RETENTION_MS } from "@/lib/db";
import { useKeyboardShift } from "@/hooks/useKeyboardShift";
import type { AnimPhase } from "@/hooks/useAnimatedVisibility";

interface Props {
  onClose: () => void;
  /** 进出场动画阶段：由父级 useAnimatedVisibility 控制 */
  phase?: AnimPhase;
}

export function SessionPopup({ onClose, phase = "in" }: Props) {
  const kbdShift = useKeyboardShift();
  const sessions = useSessionStore((s) => s.sessions);
  const trash = useSessionStore((s) => s.trash);
  const activeId = useSessionStore((s) => s.activeId);
  const setActiveSession = useSessionStore((s) => s.setActive);
  const removeSession = useSessionStore((s) => s.remove);
  const restoreFromTrash = useSessionStore((s) => s.restoreFromTrash);
  const purgeFromTrash = useSessionStore((s) => s.purgeFromTrash);
  const renameSession = useSessionStore((s) => s.rename);
  const createBlankSession = useSessionStore((s) => s.createBlankSession);
  const [tab, setTab] = useState<"blank" | "adventure" | "trash">("blank");
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  // 所有会话按时间排序（updatedAt 倒序，最新在前），并分为冒险会话/空白会话两类
  const filtered = sessions.filter(
    (s) => !search || s.title.toLowerCase().includes(search.toLowerCase())
  );
  const adventureSessions = filtered.filter((s) => (s.kind ?? "adventure") === "adventure").sort((a, b) => b.updatedAt - a.updatedAt);
  const blankSessions = filtered.filter((s) => s.kind === "blank").sort((a, b) => b.updatedAt - a.updatedAt);
  // 冒险会话按链分组（chainId），组内按卷号排序；独链=单会话组；组按最新更新排序
  const adventureGroups = (() => {
    const groups = new Map<string, Session[]>();
    for (const s of adventureSessions) {
      const cid = s.chainId || s.id;
      if (!groups.has(cid)) groups.set(cid, []);
      groups.get(cid)!.push(s);
    }
    return Array.from(groups.entries())
      .map(([cid, list]) => ({
        cid,
        sessions: list.sort((a, b) => (a.chainIndex ?? 1) - (b.chainIndex ?? 1)),
      }))
      .sort(
        (a, b) =>
          Math.max(...b.sessions.map((s) => s.updatedAt)) -
          Math.max(...a.sessions.map((s) => s.updatedAt))
      );
  })();
  // 折叠的链（默认全展开）
  const [collapsedChains, setCollapsedChains] = useState<string[]>([]);
  const toggleChain = (cid: string) =>
    setCollapsedChains((prev) => (prev.includes(cid) ? prev.filter((c) => c !== cid) : [...prev, cid]));

  const trashed = [...trash].sort((a, b) => (b.deletedAt ?? 0) - (a.deletedAt ?? 0));

  const handleSelect = (id: string) => {
    setActiveSession(id);
    onClose();
  };

  const startRename = (id: string, title: string) => {
    setEditingId(id);
    setEditValue(title);
  };

  const saveRename = () => {
    if (editingId && editValue.trim()) {
      renameSession(editingId, editValue.trim());
    }
    setEditingId(null);
    setEditValue("");
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
    if (confirm("删除后可在回收站中恢复，确定删除这个对话吗？")) {
      removeSession(id);
    }
  };

  const handlePurge = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm("彻底删除后无法恢复，确定永久删除吗？")) {
      purgeFromTrash(id);
    }
  };

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.getHours().toString().padStart(2, "0") + ":" + d.getMinutes().toString().padStart(2, "0");
  };

  const formatDate = (ts: number) => {
    const d = new Date(ts);
    return `${d.getMonth() + 1}月${d.getDate()}日`;
  };

  const remainingDays = (deletedAt: number | undefined) => {
    if (!deletedAt) return 0;
    return Math.max(0, Math.ceil((deletedAt + TRASH_RETENTION_MS - Date.now()) / 86400000));
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
    danger: "var(--danger, #ef4444)",
  };

  const tabBtn = (active: boolean): React.CSSProperties => ({
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    padding: "7px 0",
    fontSize: 13,
    fontFamily: "inherit",
    fontWeight: active ? 600 : 400,
    color: active ? seed.accent : seed.muted,
    background: active ? seed.accentBg : "transparent",
    border: "1px solid " + (active ? "color-mix(in srgb, " + seed.accent + " 25%, transparent)" : "transparent"),
    borderRadius: 8,
    cursor: "pointer",
    transition: "background 0.15s, color 0.15s",
  });

  const renderSessionRow = (session: Session) => {
    const isEditing = editingId === session.id;
    return (
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
        {isEditing ? (
          <input
            autoFocus
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") saveRename();
              if (e.key === "Escape") { setEditingId(null); setEditValue(""); }
            }}
            onBlur={saveRename}
            onClick={(e) => e.stopPropagation()}
            style={{
              flex: 1,
              minWidth: 0,
              padding: "5px 10px",
              background: seed.inputBg,
              border: "1px solid color-mix(in srgb, " + seed.accent + " 30%, transparent)",
              borderRadius: "8px",
              color: seed.fg,
              fontSize: "14px",
              fontFamily: "inherit",
              outline: "none",
            }}
          />
        ) : (
          <span style={{
            flex: 1,
            fontSize: "14px",
            color: seed.fg,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            display: "flex",
            alignItems: "center",
            gap: 5,
            minWidth: 0,
          }}>
            {session.locked && (
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={seed.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            )}
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {session.title || "未命名对话"}
            </span>
          </span>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); startRename(session.id, session.title); }}
          data-tooltip="重命名"
          className="seed-tip seed-tip--down"
          style={{
            background: "none",
            border: "none",
            color: seed.muted,
            cursor: "pointer",
            padding: "4px",
            opacity: isEditing ? 0 : 0.5,
            transition: "opacity 0.15s, color 0.15s",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.opacity = "1";
            e.currentTarget.style.color = seed.accent;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.opacity = "0.5";
            e.currentTarget.style.color = seed.muted;
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
          </svg>
        </button>
        <span style={{ fontSize: "11px", color: seed.muted, flexShrink: 0 }}>
          {formatTime(session.updatedAt)}
        </span>
        <button
          onClick={(e) => handleDelete(session.id, e)}
          data-tooltip="删除"
          className="seed-tip seed-tip--down"
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
            e.currentTarget.style.color = seed.danger;
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
          width: "min(480px, 94vw)",
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
          <span style={{ fontSize: "15px", fontWeight: 600, color: seed.fg }}>会话管理</span>
          <div style={{ display: "flex", gap: 6 }}>
            <button
              onClick={() => setTab("blank")}
              data-tooltip="会话"
              className="seed-tip seed-tip--down"
              style={{ ...tabBtn(tab === "blank"), width: 36, flex: "0 0 36px" }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14.5 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V7.5L14.5 2z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
            </button>
            <button
              onClick={() => setTab("adventure")}
              data-tooltip="新故事"
              className="seed-tip seed-tip--down"
              style={{ ...tabBtn(tab === "adventure"), width: 36, flex: "0 0 36px" }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="12 2 2 7 12 12 22 7 12 2" />
                <polyline points="2 17 12 22 22 17" />
                <polyline points="2 12 12 17 22 12" />
              </svg>
            </button>
            <button
              onClick={() => setTab("trash")}
              data-tooltip="回收站"
              className="seed-tip seed-tip--down"
              style={{ ...tabBtn(tab === "trash"), width: 36, flex: "0 0 36px" }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
              </svg>
            </button>
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
        </div>

        {/* Search（会话/冒险 tab 共用） */}
        {tab !== "trash" && (
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
        )}

        {/* List */}
        <div
          style={{
            flex: "1 1 auto",
            minHeight: "0px",
            overflowY: "auto",
            padding: "8px 12px",
          }}
        >
          {tab === "blank" ? (
            blankSessions.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 0", color: seed.muted, fontSize: "14px" }}>
                {search ? "没有匹配的会话" : "暂无会话"}
              </div>
            ) : (
              blankSessions.map((session) => renderSessionRow(session))
            )
          ) : tab === "adventure" ? (
            adventureGroups.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 0", color: seed.muted, fontSize: "14px" }}>
                {search ? "没有匹配的新故事" : "暂无新故事"}
              </div>
            ) : (
              adventureGroups.map((group) => {
                const isChain = group.sessions.length > 1;
                const collapsed = collapsedChains.includes(group.cid);
                const last = group.sessions[group.sessions.length - 1];
                return (
                  <div key={group.cid} style={{ marginBottom: 4 }}>
                    {isChain && (
                      <div
                        onClick={() => toggleChain(group.cid)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          padding: "7px 10px",
                          borderRadius: 8,
                          cursor: "pointer",
                          marginBottom: 2,
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = seed.hoverBg; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={seed.muted} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                          {collapsed ? <polyline points="6 9 12 15 18 9" /> : <polyline points="6 15 12 9 18 15" />}
                        </svg>
                        <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: seed.fg, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {last.title || "未命名对话"}
                        </span>
                        <span style={{ fontSize: 10, color: seed.muted, flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>
                          {group.sessions.map((s) => `#${s.chainIndex ?? 1}`).join(" → ")}
                        </span>
                      </div>
                    )}
                    {!collapsed && (
                      <div>
                        {group.sessions.map((session, idx) => {
                          const isLast = idx === group.sessions.length - 1;
                          return isChain ? (
                            <div key={session.id} style={{ display: "flex", gap: 8, alignItems: "stretch" }}>
                              {/* 链连接线 + 卷号圆点 */}
                              <div style={{ width: 18, display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
                                <div style={{
                                  width: 14, height: 14, borderRadius: "50%", flexShrink: 0,
                                  background: session.id === activeId ? seed.accent : seed.hoverBg,
                                  color: session.id === activeId ? "#fff" : seed.muted,
                                  fontSize: 9, fontWeight: 700,
                                  display: "flex", alignItems: "center", justifyContent: "center",
                                  fontVariantNumeric: "tabular-nums",
                                }}>
                                  {session.chainIndex ?? 1}
                                </div>
                                {!isLast && <div style={{ flex: 1, width: 2, background: seed.border, minHeight: 6 }} />}
                              </div>
                              <div style={{ flex: 1, minWidth: 0, paddingBottom: isLast ? 0 : 2 }}>
                                {renderSessionRow(session)}
                              </div>
                            </div>
                          ) : (
                            renderSessionRow(session)
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })
            )
          ) : trashed.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px 0", color: seed.muted, fontSize: "14px" }}>
              回收站是空的
            </div>
          ) : (
            trashed.map((session) => {
              const days = remainingDays(session.deletedAt);
              return (
                <div
                  key={session.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    padding: "10px 12px",
                    borderRadius: "10px",
                    marginBottom: "2px",
                    background: "transparent",
                    border: "1px solid transparent",
                  }}
                >
                  <span style={{
                    flex: 1,
                    minWidth: 0,
                    display: "flex",
                    flexDirection: "column",
                    gap: 2,
                  }}>
                    <span style={{
                      fontSize: "14px",
                      color: seed.fg,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}>
                      {session.title || "未命名对话"}
                    </span>
                    <span style={{ fontSize: "11px", color: seed.muted }}>
                      删除于 {session.deletedAt ? formatDate(session.deletedAt) + " " + formatTime(session.deletedAt) : "未知"} · 剩余 {days} 天自动清除
                    </span>
                  </span>
                  <button
                    onClick={() => restoreFromTrash(session.id)}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      padding: "6px 12px",
                      fontSize: "12px",
                      fontFamily: "inherit",
                      color: seed.accent,
                      background: seed.accentBg,
                      border: "1px solid color-mix(in srgb, " + seed.accent + " 25%, transparent)",
                      borderRadius: "8px",
                      cursor: "pointer",
                      flexShrink: 0,
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = "color-mix(in srgb, " + seed.accent + " 20%, transparent)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = seed.accentBg; }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 12a9 9 0 1 0 9-9" /><path d="M3 4v5h5" />
                    </svg>
                    恢复
                  </button>
                  <button
                    onClick={(e) => handlePurge(session.id, e)}
                    data-tooltip="彻底删除"
                    className="seed-tip seed-tip--down"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      padding: "6px",
                      fontSize: "12px",
                      fontFamily: "inherit",
                      color: seed.muted,
                      background: "transparent",
                      border: "none",
                      borderRadius: "8px",
                      cursor: "pointer",
                      flexShrink: 0,
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = seed.danger; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = seed.muted; }}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                    </svg>
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Footer actions（会话/冒险 tab 显示） */}
        {tab !== "trash" && (
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
              新故事
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
