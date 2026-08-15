import { coverThemeFor, verticalTitle } from "@/lib/storyCover";
import type { Story } from "@/types";

export function BookCover({ story, compact }: { story: Story; compact?: boolean }) {
  const theme = coverThemeFor(story.worldBaseId, story.kind);
  const title = verticalTitle(story.title, compact ? 5 : 8);
  return (
    <div
      className={"narra-cover" + (compact ? " narra-cover--compact" : "")}
      style={{
        "--cover-ink": theme.ink,
        "--cover-wash": theme.wash,
        "--cover-rule": theme.rule,
        "--cover-seal": theme.seal,
      } as React.CSSProperties}
      aria-hidden
    >
      <div className="narra-cover-grain" />
      <div className="narra-cover-rules" />
      <div className="narra-cover-corners">
        <i /><i /><i /><i />
      </div>
      <div className="narra-cover-spine" />
      <div className="narra-cover-title">{title.split("").map((ch, i) => <span key={i}>{ch}</span>)}</div>
      <svg className="narra-cover-seal" viewBox="0 0 48 48" fill="none">
        <circle cx="24" cy="24" r="13" stroke="currentColor" strokeWidth="1.2" />
        <path d="M24 14 L28 24 L24 34 L20 24 Z" stroke="currentColor" strokeWidth="1.2" />
      </svg>
      {story.pinned && <span className="narra-cover-pin" />}
      {story.status === "finished" && <span className="narra-cover-mark">结</span>}
    </div>
  );
}
