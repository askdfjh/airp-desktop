import { useEffect, useMemo, useState } from "react";
import { useStoryStore } from "@/stores/storyStore";
import { useUIStore } from "@/stores/uiStore";
import { useSessionStore } from "@/stores/sessionStore";
import { BookCover } from "./BookCover";
import { BookDetail } from "./BookDetail";
import {
  NarraPlus, NarraDraft, NarraSeek, NarraGrid, NarraRows,
  NarraSettings, NarraBookmark,
} from "@/components/icons/NarraIcon";
import { isPlaceholderTitle } from "@/lib/storyTitle";
import type { Story } from "@/types";

function relTime(ts?: number | null): string {
  if (!ts) return "";
  const d = Date.now() - ts;
  const m = Math.floor(d / 60000);
  if (m < 1) return "刚刚";
  if (m < 60) return `${m} 分钟前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} 小时前`;
  const day = Math.floor(h / 24);
  if (day < 30) return `${day} 天前`;
  return `${Math.floor(day / 30)} 月前`;
}

function volumeLabel(story: Story): string {
  const vols = useSessionStore.getState().sessions.filter((s) => s.storyId === story.id);
  const n = Math.max(1, ...vols.map((v) => v.chainIndex ?? 1), vols.length || 1);
  return `第 ${n} 卷`;
}

const GROUPS: { id: "all" | "writing" | "finished" | "draft"; label: string }[] = [
  { id: "all", label: "全部" },
  { id: "writing", label: "在写" },
  { id: "finished", label: "完结" },
  { id: "draft", label: "稿纸" },
];

export function Bookshelf() {
  const stories = useStoryStore((s) => s.stories);
  const openStory = useStoryStore((s) => s.openStory);
  const startNew = useStoryStore((s) => s.startNewAdventure);
  const createDraft = useStoryStore((s) => s.createDraftStory);
  const { shelfView, setShelfView, shelfSort, setShelfSort, shelfGroup, setShelfGroup, setSettingsOpen } = useUIStore();
  const [q, setQ] = useState("");
  const [searchOn, setSearchOn] = useState(false);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameVal, setRenameVal] = useState("");

  const placeholderIds = stories.filter((s) => isPlaceholderTitle(s.title)).map((s) => s.id).join(",");
  useEffect(() => {
    if (!placeholderIds) return;
    let cancelled = false;
    const ids = placeholderIds.split(",");
    (async () => {
      for (const id of ids) {
        if (cancelled) break;
        await useStoryStore.getState().autoTitle(id, { silent: true });
      }
    })();
    return () => { cancelled = true; };
  }, [placeholderIds]);

  const last = useMemo(() => {
    return [...stories].filter((s) => s.lastOpenedAt).sort((a, b) => (b.lastOpenedAt ?? 0) - (a.lastOpenedAt ?? 0))[0] ?? null;
  }, [stories]);

  const filtered = useMemo(() => {
    let list = stories.slice();
    if (shelfGroup === "writing") list = list.filter((s) => s.kind !== "blank" && s.status !== "finished");
    if (shelfGroup === "finished") list = list.filter((s) => s.status === "finished");
    if (shelfGroup === "draft") list = list.filter((s) => s.kind === "blank");
    const qq = q.trim().toLowerCase();
    if (qq) {
      list = list.filter((s) =>
        [s.title, s.protagonistName, s.synopsis, ...(s.tags || [])].some((x) => (x || "").toLowerCase().includes(qq))
      );
    }
    list.sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      if (shelfSort === "title") return a.title.localeCompare(b.title, "zh");
      if (shelfSort === "created") return b.createdAt - a.createdAt;
      if (shelfSort === "updated") return b.updatedAt - a.updatedAt;
      return (b.lastOpenedAt ?? 0) - (a.lastOpenedAt ?? 0);
    });
    return list;
  }, [stories, shelfGroup, shelfSort, q]);

  const startRename = (s: Story) => {
    setRenameId(s.id);
    setRenameVal(s.title);
    setMenuId(null);
  };
  const commitRename = () => {
    if (renameId && renameVal.trim()) useStoryStore.getState().rename(renameId, renameVal.trim());
    setRenameId(null);
  };

  return (
    <div className="narra-shelf">
      <div className="narra-shelf-wash" />
      <header className="narra-shelf-bar">
        <div className="narra-shelf-brand">
          <svg className="narra-shelf-sigil" viewBox="0 0 32 32" fill="none" aria-hidden>
            <path d="M16 3 L19 13 L29 16 L19 19 L16 29 L13 19 L3 16 L13 13 Z" stroke="currentColor" strokeWidth="1.4" />
          </svg>
          <span>灵叙</span>
        </div>
        <div className="narra-shelf-actions">
          <button className="narra-icon-btn" aria-label="搜索" onClick={() => setSearchOn((v) => !v)}><NarraSeek size={18} /></button>
          <button className="narra-icon-btn" aria-label={shelfView === "grid" ? "列表" : "网格"} onClick={() => setShelfView(shelfView === "grid" ? "list" : "grid")}>
            {shelfView === "grid" ? <NarraRows size={18} /> : <NarraGrid size={18} />}
          </button>
          <button className="narra-icon-btn" aria-label="设置" onClick={() => setSettingsOpen(true)}><NarraSettings size={18} /></button>
        </div>
      </header>

      {searchOn && (
        <div className="narra-shelf-search">
          <NarraSeek size={16} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜书名、主角、标签" autoFocus />
        </div>
      )}

      {last && (
        <button className="narra-continue" onClick={() => openStory(last.id)}>
          <NarraBookmark size={16} />
          <span className="narra-continue-k">继续</span>
          <span className="narra-continue-t">{last.title}</span>
          <span className="narra-continue-m">{relTime(last.lastOpenedAt)}</span>
        </button>
      )}

      <nav className="narra-shelf-tabs" aria-label="分组">
        {GROUPS.map((g) => (
          <button key={g.id} className={shelfGroup === g.id ? "is-on" : ""} onClick={() => setShelfGroup(g.id)}>{g.label}</button>
        ))}
        <select className="narra-shelf-sort" value={shelfSort} onChange={(e) => setShelfSort(e.target.value as typeof shelfSort)} aria-label="排序">
          <option value="opened">最近打开</option>
          <option value="updated">最近更新</option>
          <option value="title">书名</option>
          <option value="created">创建时间</option>
        </select>
      </nav>

      {filtered.length === 0 ? (
        <div className="narra-shelf-empty">
          <svg className="narra-empty-mark" viewBox="0 0 120 120" fill="none" aria-hidden>
            <rect x="28" y="18" width="64" height="84" rx="2" stroke="currentColor" strokeWidth="1.4" />
            <path d="M40 36 H80 M40 48 H72 M40 60 H80 M40 72 H64" stroke="currentColor" strokeWidth="1.2" />
            <path d="M28 18 H44 L48 24 H92" stroke="currentColor" strokeWidth="1.4" />
          </svg>
          <h1>还没有故事</h1>
          <p>从一本新故事开始，或先写一页草稿。</p>
          <div className="narra-empty-actions">
            <button className="narra-btn-primary" onClick={startNew}><NarraPlus size={16} /> 写下第一个故事</button>
            <button className="narra-btn-ghost" onClick={() => void createDraft()}><NarraDraft size={16} /> 先写一页草稿</button>
          </div>
        </div>
      ) : (
        <div className={shelfView === "grid" ? "narra-shelf-grid" : "narra-shelf-list"}>
          {filtered.map((s) => (
            <article
              key={s.id}
              className="narra-book"
              onClick={() => openStory(s.id)}
              onContextMenu={(e) => { e.preventDefault(); setMenuId(s.id); }}
              onPointerDown={(e) => {
                if (e.pointerType === "touch") {
                  const t = window.setTimeout(() => setMenuId(s.id), 480);
                  const clear = () => window.clearTimeout(t);
                  e.currentTarget.addEventListener("pointerup", clear, { once: true });
                  e.currentTarget.addEventListener("pointercancel", clear, { once: true });
                }
              }}
            >
              <BookCover story={s} compact={shelfView === "list"} />
              <div className="narra-book-meta">
                {renameId === s.id ? (
                  <input
                    className="narra-rename"
                    value={renameVal}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => setRenameVal(e.target.value)}
                    onBlur={commitRename}
                    onKeyDown={(e) => { if (e.key === "Enter") commitRename(); }}
                    autoFocus
                  />
                ) : (
                  <h2>{s.title}</h2>
                )}
                <p>{volumeLabel(s)} · {relTime(s.updatedAt)}</p>
              </div>
              {menuId === s.id && (
                <BookMenu
                  story={s}
                  onClose={() => setMenuId(null)}
                  onRename={() => startRename(s)}
                  onDetail={() => { setDetailId(s.id); setMenuId(null); }}
                />
              )}
            </article>
          ))}
        </div>
      )}

      {filtered.length > 0 && (
        <button className="narra-fab" onClick={startNew} aria-label="新故事">
          <NarraPlus size={22} />
        </button>
      )}

      {detailId && <BookDetail storyId={detailId} onClose={() => setDetailId(null)} />}
    </div>
  );
}

function BookMenu({ story, onClose, onRename, onDetail }: { story: Story; onClose: () => void; onRename: () => void; onDetail: () => void }) {
  const st = useStoryStore.getState();
  return (
    <div className="narra-book-menu" onClick={(e) => e.stopPropagation()}>
      <button onClick={() => { void st.openStory(story.id); onClose(); }}>继续</button>
      <button onClick={onDetail}>详情</button>
      <button onClick={onRename}>重命名</button>
      <button onClick={() => { void st.autoTitle(story.id, { force: true }); onClose(); }}>取书名</button>
      <button onClick={() => { st.setPinned(story.id, !story.pinned); onClose(); }}>{story.pinned ? "取消置顶" : "置顶"}</button>
      <button onClick={() => { st.setStatus(story.id, story.status === "finished" ? "writing" : "finished"); onClose(); }}>
        {story.status === "finished" ? "继续写" : "标为完结"}
      </button>
      <button className="is-danger" onClick={() => { if (confirm(`删除「${story.title}」？可在回收站恢复。`)) st.remove(story.id); onClose(); }}>删除</button>
      <button onClick={onClose}>取消</button>
    </div>
  );
}
