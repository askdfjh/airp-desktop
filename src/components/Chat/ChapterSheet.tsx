import { useEffect } from "react";
import { registerBackHandler } from "@/lib/androidBack";
import { useAnimatedVisibility } from "@/hooks/useAnimatedVisibility";

export function ChapterSheet({
  open,
  onClose,
  items,
  onJump,
}: {
  open: boolean;
  onClose: () => void;
  items: { id: string; title: string }[];
  onJump: (id: string) => void;
}) {
  const { mounted, phase } = useAnimatedVisibility(open, 220);
  useEffect(() => {
    if (!open) return;
    return registerBackHandler(() => {
      onClose();
      return true;
    });
  }, [open, onClose]);
  if (!mounted) return null;
  const sheetClass = phase === "in" ? "anim-sheet-in" : phase === "out" ? "anim-sheet-out" : "anim-init";
  const maskClass = phase === "in" ? "anim-overlay-in" : phase === "out" ? "anim-overlay-out" : "anim-init";
  return (
    <>
      <button type="button" className={`narra-reader-mask ${maskClass}`} aria-label="关闭目录" onClick={onClose} />
      <div className={`narra-reader-sheet ${sheetClass}`} role="dialog" aria-label="章节目录">
        <div className="narra-reader-handle" />
        <div className="narra-reader-head">
          <span>目录</span>
          <button type="button" className="narra-reader-reset" onClick={onClose}>关闭</button>
        </div>
        {items.length === 0 ? (
          <p className="narra-toc-empty">还没有分出章节。写过一段并完成场景分析后会出现在这里。</p>
        ) : (
          <ol className="narra-toc-list">
            {items.map((it, i) => (
              <li key={it.id}>
                <button type="button" onClick={() => onJump(it.id)}>
                  <em>{i + 1}</em>
                  <span>{it.title}</span>
                </button>
              </li>
            ))}
          </ol>
        )}
      </div>
    </>
  );
}
