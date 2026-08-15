import { coverThemeFor, verticalTitle } from "@/lib/storyCover";
import type { Story } from "@/types";

function Motif({ id }: { id: string }) {
  if (id === "ancient") {
    return <path d="M8 30 C14 18 20 18 24 26 C28 18 34 18 40 30" />;
  }
  if (id === "cultivation") {
    return <path d="M8 34 L18 20 L24 28 L32 14 L40 34 M24 10 A2 2 0 1 0 24.01 10" />;
  }
  if (id === "future") {
    return <><circle cx="24" cy="24" r="8" /><path d="M8 24 H40 M24 8 V40" /><circle cx="24" cy="24" r="14" /></>;
  }
  if (id === "otherworld") {
    return <><circle cx="18" cy="22" r="8" /><circle cx="30" cy="26" r="6" /></>;
  }
  if (id === "infinite") {
    return <path d="M16 24 C16 18 22 18 24 24 C26 30 32 30 32 24 C32 18 26 18 24 24 C22 30 16 30 16 24 Z" />;
  }
  if (id === "modern") {
    return <path d="M10 34 V22 H16 V34 M18 34 V16 H26 V34 M28 34 V24 H38 V34" />;
  }
  if (id === "draft") {
    return <path d="M14 16 H34 M14 24 H30 M14 32 H26" />;
  }
  return <path d="M24 12 L30 24 L24 36 L18 24 Z" />;
}

export function BookCover({ story, compact }: { story: Story; compact?: boolean }) {
  const theme = coverThemeFor(story.worldBaseId, story.kind);
  const title = verticalTitle(story.title, compact ? 5 : 8);
  return (
    <div
      className={"narra-cover narra-cover--" + theme.id + (compact ? " narra-cover--compact" : "")}
      style={{
        "--cover-ink": theme.ink,
        "--cover-wash": theme.wash,
        "--cover-rule": theme.rule,
        "--cover-seal": theme.seal,
      } as React.CSSProperties}
      aria-hidden
    >
      <div className="narra-cover-wash" />
      <div className="narra-cover-grain" />
      <div className="narra-cover-headband" />
      <div className="narra-cover-pages" />
      <div className="narra-cover-rules" />
      <div className="narra-cover-corners"><i /><i /><i /><i /></div>
      <div className="narra-cover-spine">
        <i /><i /><i />
      </div>
      <div className="narra-cover-ribbon" />
      <div className="narra-cover-title">{title.split("").map((ch, i) => <span key={i}>{ch}</span>)}</div>
      <svg className="narra-cover-seal" viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.3">
        <circle cx="24" cy="24" r="16" />
        <Motif id={theme.id} />
      </svg>
      {story.pinned && <span className="narra-cover-pin" />}
      {story.status === "finished" && <span className="narra-cover-mark">结</span>}
    </div>
  );
}
