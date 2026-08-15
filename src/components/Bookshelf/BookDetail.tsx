import { useMemo, useState } from "react";
import { useStoryStore } from "@/stores/storyStore";
import { useSessionStore } from "@/stores/sessionStore";
import { useWorldStore } from "@/stores/worldStore";
import { useUIStore } from "@/stores/uiStore";
import { BookCover } from "./BookCover";
import { exportStoryTxt } from "@/lib/storyExport";
import { NarraBack, NarraExport } from "@/components/icons/NarraIcon";

export function BookDetail({ storyId, onClose }: { storyId: string; onClose: () => void }) {
  const story = useStoryStore((s) => s.stories.find((x) => x.id === storyId));
  const sessions = useSessionStore((s) => s.sessions);
  const books = useWorldStore((s) => s.books);
  const [busy, setBusy] = useState(false);
  const [titling, setTitling] = useState(false);
  const vols = useMemo(
    () => sessions.filter((s) => s.storyId === storyId).sort((a, b) => (a.chainIndex ?? 1) - (b.chainIndex ?? 1)),
    [sessions, storyId],
  );
  if (!story) return null;
  const bookName = books.find((b) => b.id === story.worldBookId)?.name;

  const doExport = async () => {
    setBusy(true);
    try {
      const text = await exportStoryTxt(story, false);
      const { save } = await import("@tauri-apps/plugin-dialog");
      const { writeTextFile } = await import("@tauri-apps/plugin-fs");
      const path = await save({ defaultPath: `${story.title}.txt`, filters: [{ name: "Text", extensions: ["txt"] }] });
      if (path) {
        await writeTextFile(path, text);
        useStoryStore.getState();
      }
    } catch (e) {
      try {
        await navigator.clipboard.writeText(await exportStoryTxt(story, false));
        alert("已复制到剪贴板");
      } catch {
        alert("导出失败：" + (e instanceof Error ? e.message : String(e)));
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="narra-detail">
      <header className="narra-detail-bar">
        <button className="narra-icon-btn" onClick={onClose} aria-label="返回"><NarraBack size={18} /></button>
        <span>书籍</span>
        <button className="narra-icon-btn" onClick={() => void doExport()} disabled={busy} aria-label="导出"><NarraExport size={18} /></button>
      </header>
      <div className="narra-detail-hero">
        <BookCover story={story} />
        <div>
          <h1>{story.title}</h1>
          <p className="narra-detail-sub">
            {[story.protagonistName, bookName, story.status === "finished" ? "完结" : "在写"].filter(Boolean).join(" · ")}
          </p>
          {story.synopsis && <p className="narra-detail-syn">{story.synopsis}</p>}
          <p className="narra-detail-wc">{story.wordCount > 0 ? `约 ${story.wordCount} 字` : "字数将在续写后累计"}</p>
          <div className="narra-detail-actions">
            <button className="narra-btn-primary" onClick={() => { void useStoryStore.getState().openStory(story.id); onClose(); }}>继续书写</button>
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
          </div>
        </div>
      </div>
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
  );
}
