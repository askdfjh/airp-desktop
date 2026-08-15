import type { ReactNode } from "react";
import type { Story } from "@/types";
import { BookCover } from "./BookCover";

export function BookCard({
  story,
  compact,
  subtitle,
  renaming,
  renameVal,
  onOpen,
  onMenu,
  onRenameChange,
  onRenameCommit,
  menu,
}: {
  story: Story;
  compact?: boolean;
  subtitle: string;
  renaming?: boolean;
  renameVal?: string;
  onOpen: () => void;
  onMenu: () => void;
  onRenameChange?: (v: string) => void;
  onRenameCommit?: () => void;
  menu?: ReactNode;
}) {
  return (
    <article
      className={"narra-book" + (compact ? " is-list" : "")}
      onClick={onOpen}
      onContextMenu={(e) => { e.preventDefault(); onMenu(); }}
      onPointerDown={(e) => {
        if (e.pointerType === "touch") {
          const t = window.setTimeout(onMenu, 480);
          const clear = () => window.clearTimeout(t);
          e.currentTarget.addEventListener("pointerup", clear, { once: true });
          e.currentTarget.addEventListener("pointercancel", clear, { once: true });
        }
      }}
    >
      <div className="narra-book-stage">
        <BookCover story={story} compact={compact} />
        <span className="narra-book-ledge" aria-hidden />
      </div>
      <div className="narra-book-meta">
        {renaming ? (
          <input
            className="narra-rename"
            value={renameVal ?? story.title}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => onRenameChange?.(e.target.value)}
            onBlur={onRenameCommit}
            onKeyDown={(e) => { if (e.key === "Enter") onRenameCommit?.(); }}
            autoFocus
          />
        ) : (
          <h2>{story.title}</h2>
        )}
        <p>{subtitle}</p>
      </div>
      {menu}
    </article>
  );
}
