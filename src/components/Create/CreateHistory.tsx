import { useState } from "react";
import { X, RotateCcw, Trash2, User, Globe, Check } from "lucide-react";
import { useCreateStore, createMessage, type CreateHistoryItem } from "@/stores/createStore";
import { buildLocalOpening, GUIDE_LABEL } from "@/lib/createGuide";

function formatTime(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60000) return "刚刚";
  if (diff < 3600000) return Math.floor(diff / 60000) + " 分钟前";
  if (diff < 86400000) return Math.floor(diff / 3600000) + " 小时前";
  if (diff < 604800000) return Math.floor(diff / 86400000) + " 天前";
  const d = new Date(ts);
  return d.getMonth() + 1 + "月" + d.getDate() + "日";
}

interface Props {
  onClose: () => void;
}

export function CreateHistory({ onClose }: Props) {
  // 桌面端避开 40px 自绘标题栏（TitleBar z-index 5000 恒在最上层）
  const isAndroid = typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent);
  const { history, loadFromHistory, removeHistory, clearHistory } = useCreateStore();
  const [confirmClear, setConfirmClear] = useState(false);

  const handleLoad = (item: CreateHistoryItem) => {
    loadFromHistory(item);
    // 历史消息为空（极端情况）时补开场白
    const s = useCreateStore.getState();
    if (s.messages.length === 0) {
      const opening = createMessage("assistant", buildLocalOpening(s.type, s.guideMode));
      useCreateStore.setState({ messages: [{ ...opening, opening: true }] });
    }
    onClose();
  };

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 220, background: "rgba(0,0,0,0.3)" }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "absolute", top: isAndroid ? 0 : 40, right: 0, bottom: 0, width: 280,
          background: "var(--seed-glass)", backdropFilter: "blur(20px)",
          borderLeft: "1px solid var(--seed-border)",
          boxShadow: "-4px 0 24px rgba(0,0,0,0.3)",
          display: "flex", flexDirection: "column",
        }}
      >
        <div style={{ padding: "14px 16px", borderBottom: "1px solid var(--seed-border)", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: "var(--fs-13)", fontWeight: 600, color: "var(--seed-fg)", flex: 1 }}>创建历史</span>
          {history.length > 0 && (
            <button
              onClick={() => {
                if (confirmClear) {
                  clearHistory();
                  setConfirmClear(false);
                } else {
                  setConfirmClear(true);
                  setTimeout(() => setConfirmClear(false), 2500);
                }
              }}
              title="清空全部"
              style={{ padding: "4px 10px", borderRadius: 999, border: "1px solid " + (confirmClear ? "var(--danger)" : "var(--seed-border)"), background: "transparent", color: confirmClear ? "var(--danger)" : "var(--seed-muted)", fontSize: "var(--fs-10)", fontFamily: "inherit", cursor: "pointer" }}
            >
              {confirmClear ? "确认清空" : "清空"}
            </button>
          )}
          <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 8, border: "none", background: "transparent", color: "var(--seed-muted)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
            <X size={15} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
          {history.length === 0 && (
            <div style={{ padding: "40px 12px", textAlign: "center", color: "var(--seed-muted)", fontSize: "var(--fs-11)", lineHeight: 1.6 }}>
              暂无创建历史。
              <br />
              创建并保存角色/规则书后，
              <br />
              可在这里重新载入继续修改。
            </div>
          )}
          {history.map((item) => (
            <div key={item.id} style={{ padding: 12, borderRadius: 14, background: "var(--seed-surface)", border: "1px solid var(--seed-border)", display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 26, height: 26, borderRadius: 8, background: "var(--seed-accent-bg)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  {item.type === "character" ? <User size={12} style={{ color: "var(--seed-accent)" }} /> : <Globe size={12} style={{ color: "var(--seed-accent)" }} />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: "var(--fs-12)", fontWeight: 600, color: "var(--seed-fg)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.title}</div>
                  <div style={{ fontSize: "var(--fs-10)", color: "var(--seed-muted)", marginTop: 1 }}>
                    {GUIDE_LABEL[item.type]} · {item.messages.length} 条 · {formatTime(item.updatedAt)}
                  </div>
                </div>
                {item.savedResult && (
                  <span title="已保存" style={{ color: "var(--success)", flexShrink: 0, display: "flex" }}>
                    <Check size={13} />
                  </span>
                )}
              </div>
              <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                <button
                  onClick={() => handleLoad(item)}
                  style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 8, fontSize: "var(--fs-10)", fontFamily: "inherit", color: "var(--seed-accent)", background: "var(--seed-accent-bg)", border: "1px solid color-mix(in srgb, var(--seed-accent) 40%, transparent)", cursor: "pointer" }}
                >
                  <RotateCcw size={10} /> 重新载入
                </button>
                <button
                  onClick={() => removeHistory(item.id)}
                  style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 10px", borderRadius: 8, fontSize: "var(--fs-10)", fontFamily: "inherit", color: "var(--danger)", background: "transparent", border: "1px solid var(--seed-border)", cursor: "pointer" }}
                >
                  <Trash2 size={10} /> 删除
                </button>
              </div>
            </div>
          ))}
        </div>

        {history.length > 0 && (
          <div style={{ padding: "10px 16px", borderTop: "1px solid var(--seed-border)", fontSize: "var(--fs-10)", color: "var(--seed-muted)" }}>
            共 {history.length} 条历史 · 最多保留 20 条
          </div>
        )}
      </div>
    </div>
  );
}
