import { useStoryStore } from "@/stores/storyStore";
import { useSessionStore } from "@/stores/sessionStore";
import { useUIStore } from "@/stores/uiStore";
import type { AnimPhase } from "@/hooks/useAnimatedVisibility";

export function VolumeSheet({ onClose, phase = "in" }: { onClose: () => void; phase?: AnimPhase }) {
  const storyId = useStoryStore((s) => s.activeStoryId);
  const sessions = useSessionStore((s) => s.sessions);
  const activeId = useSessionStore((s) => s.activeId);
  const vols = sessions
    .filter((s) => s.storyId === storyId)
    .sort((a, b) => (a.chainIndex ?? 1) - (b.chainIndex ?? 1));

  return (
    <div className={"narra-vol-sheet " + (phase === "out" ? "is-out" : "")} onClick={onClose}>
      <div className="narra-vol-panel" onClick={(e) => e.stopPropagation()}>
        <div className="narra-vol-handle" />
        <h3>本书卷次</h3>
        {vols.length === 0 && <p className="narra-muted">尚无分卷</p>}
        {vols.map((v) => (
          <button
            key={v.id}
            className={"narra-vol-row" + (v.id === activeId ? " is-on" : "")}
            onClick={() => {
              useSessionStore.getState().setActive(v.id);
              if (storyId) useStoryStore.getState().patch(storyId, { lastVolumeId: v.id, lastOpenedAt: Date.now() });
              useUIStore.getState().setAppPhase("reading");
              onClose();
            }}
          >
            <span>第 {v.chainIndex ?? 1} 卷</span>
            <em>{v.locked ? "只读" : "续写"}</em>
          </button>
        ))}
      </div>
    </div>
  );
}
