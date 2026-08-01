import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useWorldStore } from "@/stores/worldStore";
import { useUIStore } from "@/stores/uiStore";

interface WorldInfoPanelProps {
  /** 触发按钮，浮层锚定在其上方 */
  anchorRef: RefObject<HTMLElement | null>;
  onClose: () => void;
}

/**
 * 世界信息浮层：紧凑展示当前世界，设定条目默认收起，点击展开/收起。
 * 点击触发按钮或外部 / Esc 关闭。
 */
export function WorldInfoPanel({ anchorRef, onClose }: WorldInfoPanelProps) {
  const activeBook = useWorldStore((s) => s.activeBook);
  const selectedWorldName = useUIStore((s) => s.selectedWorldName);
  const [entriesOpen, setEntriesOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ bottom: number; right: number; maxHeight: number } | null>(null);

  const visibleEntries = activeBook?.entries.filter((e) => !e.disable) ?? [];

  // 点击面板外部 / Esc 关闭（触发按钮除外，由按钮 toggle 控制）
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (anchorRef.current && anchorRef.current.contains(t)) return;
      if (panelRef.current && panelRef.current.contains(t)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [anchorRef, onClose]);

  // 定位：底部锚定在按钮上方，右缘与按钮对齐
  useLayoutEffect(() => {
    const btn = anchorRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const gap = 10;
    setPos({
      bottom: window.innerHeight - rect.top + gap,
      right: window.innerWidth - rect.right,
      maxHeight: Math.max(160, rect.top - gap - 8),
    });
  }, [anchorRef]);

  const worldName = selectedWorldName || activeBook?.name || "";

  return (
    <div
      ref={panelRef}
      className="seed-card"
      style={{
        position: "fixed",
        zIndex: 6000,
        width: 320,
        maxWidth: "calc(100vw - 24px)",
        maxHeight: pos?.maxHeight ?? 480,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        ...(pos ? { bottom: pos.bottom, right: pos.right } : {}),
        animation: "seed-fade-in-up 0.18s ease-out",
      }}
    >
      {/* Header：纯文字居中展示当前世界（无需图标与关闭按钮，点击外部/再点按钮即可关闭） */}
      <div style={{ padding: "16px 14px 10px", flexShrink: 0, textAlign: "center" }}>
        <div
          style={{
            fontSize: 15,
            fontWeight: 700,
            color: "var(--seed-fg)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {activeBook ? worldName : "未选择世界"}
        </div>
        {activeBook && (
          <div style={{ fontSize: 11, color: "var(--seed-accent)", marginTop: 2 }}>
            主题：{activeBook.theme || "未设置"}
          </div>
        )}
      </div>
      {/* Content */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          padding: "4px 14px 12px",
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        {!activeBook ? (
          <p style={{ fontSize: 12, color: "var(--seed-muted)", textAlign: "center", padding: "16px 0", margin: 0, lineHeight: 1.6 }}>
            当前对话未关联世界
            <br />
            可在「设置 → 世界」中选择
          </p>
        ) : (
          <>
            {activeBook.description && (
              <p
                style={{
                  fontSize: 12,
                  color: "var(--seed-muted)",
                  lineHeight: 1.6,
                  margin: 0,
                  display: "-webkit-box",
                  WebkitLineClamp: 3,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}
              >
                {activeBook.description}
              </p>
            )}

            {/* 设定条目：默认收起 */}
            <button
              onClick={() => setEntriesOpen((v) => !v)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 10px",
                borderRadius: 10,
                background: "var(--seed-hover-bg)",
                border: "1px solid var(--seed-border)",
                cursor: "pointer",
                fontSize: 12,
                fontWeight: 600,
                color: "var(--seed-fg)",
                width: "100%",
                flexShrink: 0,
              }}
            >
              <span style={{ flex: 1, textAlign: "left" }}>世界设定条目（{visibleEntries.length}）</span>
              {entriesOpen ? (
                <ChevronUp size={14} style={{ color: "var(--seed-muted)" }} />
              ) : (
                <ChevronDown size={14} style={{ color: "var(--seed-muted)" }} />
              )}
            </button>

            {entriesOpen && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {visibleEntries.length === 0 ? (
                  <p style={{ fontSize: 12, color: "var(--seed-muted)", margin: 0, padding: "4px 0" }}>
                    暂无启用的设定条目
                  </p>
                ) : (
                  visibleEntries.map((e) => (
                    <div
                      key={e.id}
                      style={{
                        background: "var(--seed-hover-bg)",
                        borderRadius: 10,
                        padding: "8px 10px",
                        display: "flex",
                        flexDirection: "column",
                        gap: 3,
                      }}
                    >
                      <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--seed-fg)" }}>
                        【{e.category}·{e.title}】
                        {e.constant && (
                          <span
                            style={{
                              marginLeft: 6,
                              fontSize: 10,
                              padding: "1px 6px",
                              borderRadius: 999,
                              background: "var(--seed-accent-bg)",
                              color: "var(--seed-accent)",
                            }}
                          >
                            常驻
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 11.5, color: "var(--seed-muted)", lineHeight: 1.6 }}>
                        {e.content}
                      </div>
                      {e.key && e.key.length > 0 && (
                        <div style={{ fontSize: 10.5, color: "var(--seed-muted)", opacity: 0.7 }}>
                          触发：{e.key.join("、")}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
