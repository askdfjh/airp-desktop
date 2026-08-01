import { useWorldStore } from "@/stores/worldStore";
import { useUIStore } from "@/stores/uiStore";

export function WorldInfoPanel({ onClose }: { onClose: () => void }) {
  const activeBook = useWorldStore((s) => s.activeBook);
  const selectedWorldName = useUIStore((s) => s.selectedWorldName);

  const visibleEntries = activeBook?.entries.filter((e) => !e.disable) ?? [];

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 6000,
        background: "rgba(0, 0, 0, 0.4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      onClick={onClose}
    >
      <div
        className="seed-card"
        style={{
          width: "calc(100% - 48px)",
          maxWidth: 480,
          maxHeight: "75vh",
          display: "flex",
          flexDirection: "column",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px 20px 10px",
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--seed-fg)" }}>
            世界信息
          </div>
          <button
            onClick={onClose}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 28,
              height: 28,
              borderRadius: 999,
              background: "transparent",
              border: "none",
              color: "var(--seed-muted)",
              cursor: "pointer",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "4px 20px 16px" }}>
          {!activeBook ? (
            <p style={{ fontSize: 12.5, color: "var(--seed-muted)", textAlign: "center", padding: "24px 0" }}>
              当前世界暂无世界书内容
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {/* 世界概要 */}
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, color: "var(--seed-fg)", marginBottom: 4 }}>
                  {selectedWorldName || activeBook.name}
                </div>
                <div style={{ fontSize: 11, color: "var(--seed-accent)", marginBottom: 8 }}>
                  主题：{activeBook.theme || "未设置"}
                </div>
                {activeBook.description && (
                  <p style={{ fontSize: 12.5, color: "var(--seed-muted)", lineHeight: 1.6, margin: 0 }}>
                    {activeBook.description}
                  </p>
                )}
              </div>

              {/* 条目列表（只读） */}
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--seed-muted)" }}>
                世界设定条目（{visibleEntries.length}）
              </div>
              {visibleEntries.length === 0 ? (
                <p style={{ fontSize: 12.5, color: "var(--seed-muted)", margin: 0 }}>
                  暂无启用的设定条目
                </p>
              ) : (
                visibleEntries.map((e) => (
                  <div
                    key={e.id}
                    style={{
                      background: "var(--seed-hover-bg)",
                      borderRadius: 10,
                      padding: "10px 12px",
                      display: "flex",
                      flexDirection: "column",
                      gap: 4,
                    }}
                  >
                    <div style={{ fontSize: 12, fontWeight: 600, color: "var(--seed-fg)" }}>
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
                    <div style={{ fontSize: 12, color: "var(--seed-muted)", lineHeight: 1.6 }}>
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
        </div>
      </div>
    </div>
  );
}
