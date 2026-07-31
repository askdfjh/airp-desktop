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

  return (
    <div className="seed-popup-overlay" ref={overlayRef} onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}>
      <div className="seed-popup">
        <div className="seed-popup-header">
          <span className="seed-popup-title">会话管理</span>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", color: "var(--seed-muted)", cursor: "pointer", padding: 4 }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <input
          className="seed-popup-search"
          placeholder="搜索会话..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoFocus
        />

        <div className="seed-popup-list">
          {groups.map((group) => (
            <div key={group.label}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--seed-muted)", letterSpacing: "0.06em", textTransform: "uppercase", padding: "8px 12px 4px" }}>
                {group.label}
              </div>
              {group.items.map((session) => (
                <div
                  key={session.id}
                  className={"seed-popup-item " + (session.id === activeId ? "seed-popup-item--active" : "")}
                  onClick={() => handleSelect(session.id)}
                >
                  <div className="seed-popup-item-title">{session.title || "未命名对话"}</div>
                  <span className="seed-popup-item-time">{formatTime(session.updatedAt)}</span>
                  <button
                    onClick={(e) => handleDelete(session.id, e)}
                    style={{ background: "none", border: "none", color: "var(--seed-muted)", cursor: "pointer", padding: 4, opacity: 0.5, transition: "opacity 0.15s" }}
                    onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
                    onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.5")}
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
            <div style={{ textAlign: "center", padding: "40px 0", color: "var(--seed-muted)", fontSize: 14 }}>
              {search ? "没有匹配的会话" : "暂无会话"}
            </div>
          )}
        </div>

        <div className="seed-popup-footer">
          <button className="seed-popup-new-btn" onClick={handleNewSession}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            新建冒险
          </button>
        </div>
      </div>
    </div>
  );
}
