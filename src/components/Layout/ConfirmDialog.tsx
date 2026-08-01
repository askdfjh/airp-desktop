import { LogOut } from "lucide-react";
import { useEffect } from "react";

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel = "确认",
  cancelLabel = "取消",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
      if (e.key === "Enter") onConfirm();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onConfirm, onCancel]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{
        background: "rgba(0,0,0,0.45)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        animation: "seed-fade-in-up 0.18s ease-out",
        zIndex: 2000,
      }}
      onClick={onCancel}
    >
      <div
        style={{
          width: 360,
          maxWidth: "calc(100vw - 32px)",
          padding: "28px 28px 24px",
          textAlign: "center",
          background: "var(--seed-surface)",
          border: "1px solid var(--seed-border)",
          borderRadius: 16,
          boxShadow: "0 16px 64px rgba(0,0,0,0.5)",
          animation: "seed-fade-in-up 0.22s ease-out",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background: "var(--seed-accent-bg)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 16px",
          }}
        >
          <LogOut size={20} style={{ color: "var(--seed-accent)" }} />
        </div>

        <span style={{ display: "block", marginBottom: 8, fontSize: 16, fontWeight: 600, color: "var(--seed-fg)" }}>
          {title}
        </span>

        <p style={{ marginBottom: 24, fontSize: 14, color: "var(--seed-muted)", lineHeight: 1.55 }}>
          {message}
        </p>

        <div className="flex justify-center gap-3">
          <button
            onClick={onCancel}
            style={{
              padding: "8px 24px",
              borderRadius: 10,
              fontSize: "var(--fs-13)",
              color: "var(--seed-muted)",
              background: "transparent",
              border: "1px solid var(--seed-border)",
              cursor: "pointer",
              transition: "all 0.15s",
              minWidth: 100,
            }}
            onMouseEnter={(e) => {
              (e.target as HTMLElement).style.background = "var(--seed-hover-bg)";
              (e.target as HTMLElement).style.color = "var(--seed-fg)";
            }}
            onMouseLeave={(e) => {
              (e.target as HTMLElement).style.background = "transparent";
              (e.target as HTMLElement).style.color = "var(--seed-muted)";
            }}
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            style={{
              padding: "8px 24px",
              borderRadius: 10,
              fontSize: "var(--fs-13)",
              fontWeight: 500,
              border: "none",
              background: "var(--seed-accent)",
              color: "#fff",
              cursor: "pointer",
              transition: "all 0.15s",
              boxShadow: "0 0 16px var(--seed-accent-glow)",
              minWidth: 100,
            }}
            onMouseEnter={(e) => {
              (e.target as HTMLElement).style.background = "color-mix(in srgb, var(--seed-accent) 85%, white)";
            }}
            onMouseLeave={(e) => {
              (e.target as HTMLElement).style.background = "var(--seed-accent)";
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
