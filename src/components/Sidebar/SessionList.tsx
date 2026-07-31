import { useState, useCallback } from "react";
import { useSessionStore } from "@/stores/sessionStore";
import { useProviderStore } from "@/stores/providerStore";
import { useUIStore } from "@/stores/uiStore";
import { useWorldStore } from "@/stores/worldStore";
import {
  Plus,
  Trash2,
  MessageSquare,
  Settings,
  Sparkles,
  Star,
  Pencil,
  ChevronDown,
  ChevronRight,
  Clock,
  X,
} from "lucide-react";

function formatRelativeTime(ts: number): string {
  const now = Date.now();
  const diff = now - ts;
  const sec = Math.floor(diff / 1000);
  const min = Math.floor(sec / 60);
  const hour = Math.floor(min / 60);
  const day = Math.floor(hour / 24);

  if (sec < 60) return "刚刚";
  if (min < 60) return `${min}分钟前`;
  if (hour < 24) return `${hour}小时前`;
  if (day < 7) return `${day}天前`;
  if (day < 30) return `${Math.floor(day / 7)}周前`;
  if (day < 365) return `${Math.floor(day / 30)}个月前`;
  return `${Math.floor(day / 365)}年前`;
}

function getDateGroup(ts: number): string {
  const now = new Date();
  const d = new Date(ts);
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterdayStart = todayStart - 86400000;
  const weekStart = todayStart - 6 * 86400000;
  const monthStart = todayStart - 29 * 86400000;

  if (ts >= todayStart) return "今天";
  if (ts >= yesterdayStart) return "昨天";
  if (ts >= weekStart) return "本周";
  if (ts >= monthStart) return "本月";
  return "更早";
}

function highlightQuery(text: string, query: string) {
  if (!query.trim()) return text;
  try {
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const parts = text.split(new RegExp(`(${escaped})`, "gi"));
    return parts.map((part, i) =>
      part.toLowerCase() === query.toLowerCase()
        ? <mark key={i} style={{ background: "var(--accent-bg)", color: "var(--accent)", borderRadius: 3, padding: "0 2px" }}>{part}</mark>
        : part
    );
  } catch {
    return text;
  }
}

export function SessionList({ onDeleteRequest, onRemoveAllRequest }: { onDeleteRequest: (id: string, title: string) => void; onRemoveAllRequest: () => void }) {
  const {
    sessions,
    activeId,
    add,
    remove,
    setActive,
    rename,
    favorites,
    favorite,
    unfavorite,
    isFavorited,
    jumpToMessage,
  } = useSessionStore();
  const { providers, activeProviderId, activeModel } = useProviderStore();
  const { activeBook } = useWorldStore();
  const { setSettingsOpen } = useUIStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [showFavorites, setShowFavorites] = useState(true);
  const [toast, setToast] = useState<{ msg: string; type: "warn" | "ok" } | null>(null);
  // search state moved to ChatPane header

  const getDefaultProviderId = () => activeProviderId ?? providers[0]?.id ?? "";

  const showToast = useCallback((msg: string, type: "warn" | "ok" = "warn") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  }, []);



  const startRename = (id: string, currentTitle: string) => {
    setEditingId(id);
    setEditTitle(currentTitle);
  };

  const commitRename = () => {
    if (editingId && editTitle.trim()) {
      rename(editingId, editTitle.trim());
    }
    setEditingId(null);
  };

  const cancelRename = () => setEditingId(null);

  const handleDelete = (id: string, title: string) => {
    onDeleteRequest(id, title);
  };

  const favoriteSessions = favorites
    .map((f) => ({ fav: f, session: sessions.find((s) => s.id === f.sessionId) }))
    .filter((x) => x.session) as { fav: typeof favorites[number]; session: typeof sessions[number] }[];

  const nonFavoriteSessions = sessions.filter(
    (s) => !favorites.some((f) => f.sessionId === s.id),
  );

  const sortSessions = (list: typeof sessions) =>
    [...list].sort((a, b) => b.updatedAt - a.updatedAt);

  const groupByDate = (list: typeof sessions) => {
    const sorted = sortSessions(list);
    const groups: Record<string, typeof sessions> = {};
    for (const s of sorted) {
      const group = getDateGroup(s.updatedAt);
      if (!groups[group]) groups[group] = [];
      groups[group].push(s);
    }
    return groups;
  };

  const renderItem = (s: typeof sessions[number], isFav: boolean) => {
    const isActive = activeId === s.id;
    const isEditing = editingId === s.id;
    const faved = isFavorited(s.id);

    return (
      <div
        key={isFav ? `fav-${s.id}` : s.id}
        onClick={() => !isEditing && setActive(s.id)}
        onDoubleClick={() => !isEditing && startRename(s.id, s.title)}
        className={`group flex items-center gap-2 px-3 py-2 mb-0-5 rd-10 cp tr-all ${
          isActive ? "bg-accent" : "hover-bg-hover"
        }`}
        style={isActive ? { color: "var(--accent)" } : { color: "var(--text-tertiary)" }}
      >
        {isEditing ? (
          <>
            <MessageSquare size={14} className="shrink-0 op50" />
            <input
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitRename();
                if (e.key === "Escape") cancelRename();
              }}
              onBlur={commitRename}
              autoFocus
              className="flex-1 text-sm font-medium"
              style={{
                background: "transparent",
                border: "none",
                outline: "none",
                color: "var(--text-primary)",
                fontSize: "var(--fs-13)",
                fontFamily: "inherit",
              }}
            />
          </>
        ) : (
          <>
            <MessageSquare size={14} className="shrink-0 op50" strokeWidth={1.5} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1">
                <span
                  className="text-sm font-medium truncate"
                  style={{ color: isActive ? "var(--accent)" : "var(--text-secondary)" }}
                >
                  {s.title}
                </span>
              </div>
              <div
                className="flex items-center gap-0-5"
                style={{ color: "var(--text-muted)", fontSize: "var(--fs-10)", marginTop: 1 }}
              >
                <Clock size={9} />
                <span>{formatRelativeTime(s.updatedAt)}</span>
              </div>
            </div>
            <div className="flex items-center gap-0-5 opacity-0 group-hover:opacity-100 transition-opacity">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  startRename(s.id, s.title);
                }}
                className="btn-ghost"
                title="重命名"
                style={{ color: "var(--text-tertiary)", width: 22, height: 22 }}
              >
                <Pencil size={11} />
              </button>
              {faved ? (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const fav = favorites.find((f) => f.sessionId === s.id);
                    if (fav) unfavorite(fav.id);
                  }}
                  className="btn-ghost"
                  title="取消收藏"
                  style={{ color: "var(--accent)", width: 22, height: 22 }}
                >
                  <Star size={11} fill="currentColor" />
                </button>
              ) : (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    favorite(s.id);
                  }}
                  className="btn-ghost"
                  title="收藏"
                  style={{ color: "var(--text-tertiary)", width: 22, height: 22 }}
                >
                  <Star size={11} />
                </button>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(s.id, s.title);
                }}
                className={`btn-ghost ${sessions.length <= 1 ? "hidden" : ""}`}
                title="删除"
                style={{ color: "var(--text-tertiary)", width: 22, height: 22 }}
              >
                <Trash2 size={11} />
              </button>
            </div>
          </>
        )}
      </div>
    );
  };

  const renderGroupedSections = (list: typeof sessions, isFav: boolean) => {
    const groups = groupByDate(list);
    const groupOrder = ["今天", "昨天", "本周", "本月", "更早"];

    return groupOrder.map((groupName) => {
      const items = groups[groupName];
      if (!items || items.length === 0) return null;
      return (
        <div key={`${isFav ? "fav" : "all"}-${groupName}`} className="mb-2">
          <div
            className="flex items-center gap-1 w-full px-2 py-1"
            style={{ color: "var(--text-muted)", fontSize: "var(--fs-10)" }}
          >
            <span className="font-semibold uppercase tracking-wide">{groupName}</span>
            <span className="ml-auto opacity-50">{items.length}</span>
          </div>
          <div>
            {items.map((s) => renderItem(s, isFav))}
          </div>
        </div>
      );
    });
  };



  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3-5 flex items-center justify-between border-b border-light">
        <div className="flex items-center gap-2">
          <Sparkles size={14} style={{ color: "var(--accent)", opacity: 0.6 }} />
          <span className="text-xs font-semibold txt-muted uppercase tracking-wide">对话</span>
        </div>
        <div className="flex gap-0-5">
          <button
            onClick={() => setSettingsOpen(true)}
            className="btn-ghost"
            title="设置"
          >
            <Settings size={14} />
          </button>
          <button
            onClick={() => {
              const pid = getDefaultProviderId();
              add({
                id: crypto.randomUUID(),
                title: "新对话 " + (sessions.length + 1),
                systemPrompt: activeBook ? "【世界观：" + activeBook.name + "】\n" + activeBook.entries.map(e => e.content).join("\n") + "\n\n" : "",
                providerId: pid,
                model: activeModel,
                thinkingEnabled: true,
                createdAt: Date.now(),
                updatedAt: Date.now(),
              });
            }}
            className="btn-ghost"
            title="新建会话"
          >
            <Plus size={14} />
          </button>
        </div>
      </div>

      {/* Session list */}
      <div className="flex-1 overflow-y-auto py-1-5 px-2" style={{ minHeight: 0 }}>
        {(
          <>
            {sessions.length === 0 && (
              <div className="px-3 py-12 text-center">
                <MessageSquare
                  size={24}
                  strokeWidth={1}
                  className="mx-auto mb-2"
                  style={{ color: "var(--text-muted)" }}
                />
                <p className="txt-tertiary text-xs">暂无会话</p>
              </div>
            )}

            {/* Favorites section */}
            {favoriteSessions.length > 0 && (
              <div className="mb-2">
                <button
                  onClick={() => setShowFavorites(!showFavorites)}
                  className="flex items-center gap-1 w-full px-2 py-1 rd-6 hover-bg-hover tr-all"
                  style={{ color: "var(--text-muted)", fontSize: "var(--fs-11)" }}
                >
                  {showFavorites ? (
                    <ChevronDown size={11} />
                  ) : (
                    <ChevronRight size={11} />
                  )}
                  <Star size={10} fill="currentColor" style={{ color: "var(--accent)" }} />
                  <span className="font-semibold uppercase tracking-wide">收藏夹</span>
                  <span className="ml-auto opacity-50">{favoriteSessions.length}</span>
                </button>
                {showFavorites && (
                  <div className="mt-1">
                    {renderGroupedSections(
                      favoriteSessions.map((f) => f.session),
                      true,
                    )}
                  </div>
                )}
              </div>
            )}

            {/* All non-favorite sessions */}
            {nonFavoriteSessions.length > 0 && (
              <div>
                {favoriteSessions.length > 0 && (
                  <div
                    className="flex items-center gap-1 w-full px-2 py-1"
                    style={{ color: "var(--text-muted)", fontSize: "var(--fs-11)" }}
                  >
                    <span className="font-semibold uppercase tracking-wide">全部会话</span>
                    <span className="ml-auto opacity-50">{nonFavoriteSessions.length}</span>
                  </div>
                )}
                {renderGroupedSections(nonFavoriteSessions, false)}
              </div>
            )}
          </>
        )}
      </div>

      {/* Toast notification */}
      {toast && (
        <div
          style={{
            position: "fixed",
            bottom: 60,
            left: 16,
            right: 16,
            padding: "10px 14px",
            borderRadius: 10,
            background: toast.type === "warn" ? "var(--bg-overlay)" : "var(--accent-bg)",
            border: `1px solid ${toast.type === "warn" ? "var(--border-light)" : "var(--accent-border)"}`,
            color: "var(--text-primary)",
            fontSize: "var(--fs-12)",
            backdropFilter: "var(--blur-bubble)",
            boxShadow: "0 4px 16px rgba(0,0,0,0.2)",
            display: "flex",
            alignItems: "center",
            gap: 8,
            animation: "fadeInUp 0.2s ease",
          }}
        >
          <Sparkles size={12} style={{ color: "var(--accent)" }} />
          {toast.msg}
        </div>
      )}

      <div className="px-4 py-2-5 border-t border-light">
        {sessions.length > 0 && (
          <button
            onClick={onRemoveAllRequest}
            className="cp tr-all w-full flex items-center justify-center gap-1"
            style={{
              fontSize: "var(--fs-11)",
              color: "var(--danger)",
              background: "none",
              border: "none",
              padding: "4px 0 8px",
              opacity: 0.6,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.opacity = "1"; }}
            onMouseLeave={(e) => { e.currentTarget.style.opacity = "0.6"; }}
          >
            <Trash2 size={10} />
            <span>清空所有对话</span>
          </button>
        )}
        <div className="flex items-center gap-1-5 text-10 txt-muted">
          <span
            className="inline-b w-1-5 h-1-5 rd-full"
            style={{
              background: providers.length > 0 ? "var(--accent)" : "var(--text-tertiary)",
              opacity: 0.6,
            }}
          />
          {providers.length === 0
            ? "未配置 API"
            : (providers[0]?.name || "API") + " · " + (activeModel || "-")}
        </div>
      </div>
    </div>
  );
}
