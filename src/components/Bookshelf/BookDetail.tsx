import { useEffect, useMemo, useState } from "react";
import { useStoryStore } from "@/stores/storyStore";
import { useSessionStore } from "@/stores/sessionStore";
import { useWorldStore } from "@/stores/worldStore";
import { useUIStore } from "@/stores/uiStore";
import { BookCover } from "./BookCover";
import { saveStoryTxt } from "@/lib/storyExport";
import { loadExtractedCardsForStory } from "@/lib/db";
import { refreshStoryRoster } from "@/lib/characterExtract";
import { NarraBack, NarraExport } from "@/components/icons/NarraIcon";

export function BookDetail({ storyId, onClose }: { storyId: string; onClose: () => void }) {
  const story = useStoryStore((s) => s.stories.find((x) => x.id === storyId));
  const sessions = useSessionStore((s) => s.sessions);
  const books = useWorldStore((s) => s.books);
  const [busy, setBusy] = useState(false);
  const [titling, setTitling] = useState(false);
  const [includePlayer, setIncludePlayer] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [synDraft, setSynDraft] = useState<string | null>(null);
  const [roster, setRoster] = useState<{ id: string; name: string; description: string; personality: string; scenario: string }[]>([]);
  const [rosterBusy, setRosterBusy] = useState(false);
  const vols = useMemo(
    () => sessions.filter((s) => s.storyId === storyId).sort((a, b) => (a.chainIndex ?? 1) - (b.chainIndex ?? 1)),
    [sessions, storyId],
  );
  useEffect(() => {
    let cancelled = false;
    loadExtractedCardsForStory(storyId)
      .then((rows) => { if (!cancelled) setRoster(rows); })
      .catch(() => { if (!cancelled) setRoster([]); });
    return () => { cancelled = true; };
  }, [storyId]);

  if (!story) return null;
  const bookName = books.find((b) => b.id === story.worldBookId)?.name;

  const doExport = async () => {
    setBusy(true);
    try {
      const how = await saveStoryTxt(story, includePlayer);
      useUIStore.getState().notify(how === "copied" ? "已复制到剪贴板" : "已导出文稿");
    } catch (e) {
      useUIStore.getState().notify("导出失败：" + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(false);
    }
  };

  const commitTitle = () => {
    const t = titleDraft.trim();
    if (t && t !== story.title) useStoryStore.getState().rename(story.id, t);
    setEditingTitle(false);
  };
  const commitSyn = () => {
    if (synDraft === null) return;
    useStoryStore.getState().patch(story.id, { synopsis: synDraft.trim(), updatedAt: Date.now() });
    setSynDraft(null);
  };

  const reloadRoster = async () => {
    try {
      setRoster(await loadExtractedCardsForStory(storyId));
    } catch {
      setRoster([]);
    }
  };

  const doRoster = async () => {
    if (!story || rosterBusy) return;
    setRosterBusy(true);
    try {
      const { saved, error } = await refreshStoryRoster(story);
      await reloadRoster();
      useUIStore.getState().notify(error ? error : saved > 0 ? `名册已记下 ${saved} 人` : "名册没有新角色");
    } catch (e) {
      useUIStore.getState().notify("整理名册失败：" + (e instanceof Error ? e.message : String(e)));
    } finally {
      setRosterBusy(false);
    }
  };

  return (
    <div className="narra-detail">
      <header className="narra-detail-bar">
        <button className="narra-icon-btn" onClick={onClose} aria-label="返回"><NarraBack size={18} /></button>
        <span>书籍</span>
        <button className="narra-icon-btn" onClick={() => void doExport()} disabled={busy} aria-label="导出"><NarraExport size={18} /></button>
      </header>
      <div className="narra-detail-grid">
      <div className="narra-detail-main">
      <div className="narra-detail-hero">
        <BookCover story={story} />
        <div>
          {editingTitle ? (
            <input
              className="narra-rename"
              value={titleDraft}
              autoFocus
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={commitTitle}
              onKeyDown={(e) => { if (e.key === "Enter") commitTitle(); if (e.key === "Escape") setEditingTitle(false); }}
            />
          ) : (
            <h1 onClick={() => { setTitleDraft(story.title); setEditingTitle(true); }} style={{ cursor: "text" }}>{story.title}</h1>
          )}
          <p className="narra-detail-sub">
            {[story.protagonistName, bookName, story.status === "finished" ? "完结" : "在写"].filter(Boolean).join(" · ")}
          </p>
          {synDraft !== null ? (
            <textarea
              className="narra-syn-edit"
              value={synDraft}
              rows={3}
              autoFocus
              onChange={(e) => setSynDraft(e.target.value)}
              onBlur={commitSyn}
            />
          ) : (
            <p className="narra-detail-syn" onClick={() => setSynDraft(story.synopsis || "")} style={{ cursor: "text" }}>
              {story.synopsis || "点此写一句简介"}
            </p>
          )}
          <p className="narra-detail-wc">{story.wordCount > 0 ? `约 ${story.wordCount} 字` : "字数将在续写后累计"}</p>
          <label className="narra-export-opt">
            <input type="checkbox" checked={includePlayer} onChange={(e) => setIncludePlayer(e.target.checked)} />
            导出时保留玩家行动
          </label>
          <div className="narra-detail-actions">
            <button className="narra-btn-primary" onClick={() => { void useStoryStore.getState().openStory(story.id); onClose(); }}>继续书写</button>
            {story.kind !== "blank" && (
              <button
                className="narra-btn-ghost"
                onClick={() => {
                  useStoryStore.getState().startSameWorld(story.id);
                  onClose();
                }}
              >
                同世界再开一本
              </button>
            )}
            <button
              className="narra-btn-ghost"
              disabled={titling}
              onClick={async () => {
                setTitling(true);
                try {
                  await useStoryStore.getState().autoTitle(story.id, { force: true });
                } finally {
                  setTitling(false);
                }
              }}
            >
              {titling ? "取名中…" : "取书名"}
            </button>
            <button
              className="narra-btn-ghost"
              onClick={() => useStoryStore.getState().setStatus(story.id, story.status === "finished" ? "writing" : "finished")}
            >
              {story.status === "finished" ? "标为在写" : "标为完结"}
            </button>
            <button
              className="narra-btn-ghost"
              onClick={() => {
                if (!confirm(`删除「${story.title}」？可在书架回收站恢复。`)) return;
                useStoryStore.getState().remove(story.id);
                onClose();
              }}
            >
              删除
            </button>
          </div>
        </div>
      </div>
      </div>
      <div className="narra-detail-side">
      <div className="narra-detail-h-row">
        <h2 className="narra-detail-h">角色名册</h2>
        <button className="narra-btn-ghost narra-roster-btn" disabled={rosterBusy} onClick={() => void doRoster()}>
          {rosterBusy ? "整理中…" : "从正文整理"}
        </button>
      </div>
      <ul className="narra-roster">
        {story.protagonistName && (
          <li>
            <strong>{story.protagonistName}</strong>
            <span>本书主角</span>
          </li>
        )}
        {roster.filter((c) => c.name !== story.protagonistName).map((c) => (
          <li key={c.id}>
            <strong>{c.name}</strong>
            <span>{c.personality || c.description || c.scenario || "尚无摘录"}</span>
          </li>
        ))}
        {!story.protagonistName && roster.length === 0 && (
          <li className="narra-muted">写过几段后点「从正文整理」，出场角色会记在这里</li>
        )}
      </ul>
      <h2 className="narra-detail-h">卷次</h2>
      <ul className="narra-vol-list">
        {vols.map((v) => (
          <li key={v.id}>
            <button
              onClick={() => {
                useSessionStore.getState().setActive(v.id);
                useStoryStore.getState().patch(story.id, { lastVolumeId: v.id, lastOpenedAt: Date.now() });
                useStoryStore.setState({ activeStoryId: story.id });
                useUIStore.getState().setAppPhase("reading");
                onClose();
              }}
            >
              <span>第 {v.chainIndex ?? 1} 卷</span>
              <span>{v.locked ? "已锁定" : v.title}</span>
            </button>
          </li>
        ))}
        {vols.length === 0 && <li className="narra-muted">尚无卷次</li>}
      </ul>
      </div>
      </div>
    </div>
  );
}
