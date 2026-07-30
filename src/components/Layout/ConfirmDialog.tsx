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
        background: "rgba(0,0,0,0.35)",
        backdropFilter: "var(--blur-xs)",
        WebkitBackdropFilter: "var(--blur-xs)",
        animation: "fadeInMsg .15s ease-out",
      }}
      onClick={onCancel}
    >
      <div
        className="glass-modal rd-16 sh-lg"
        style={{
          width: 360,
          maxWidth: "calc(100vw - 32px)",
          padding: "28px 28px 24px",
          textAlign: "center",
          animation: "fadeInUp .2s ease-out",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            background: "var(--accent-bg)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 16px",
          }}
        >
          <LogOut size={20} style={{ color: "var(--accent)" }} />
        </div>

        <span className="text-base font-semibold txt-primary" style={{ display: "block", marginBottom: 8 }}>
          {title}
        </span>

        <p className="text-sm txt-secondary" style={{ marginBottom: 24 }}>
          {message}
        </p>

        <div className="flex justify-center gap-3">
          <button
            onClick={onCancel}
            className="btn-ghost"
            style={{
              padding: "8px 24px",
              borderRadius: 8,
              fontSize: "var(--fs-13)",
              color: "var(--text-secondary)",
              border: "1px solid var(--border-medium)",
              minWidth: 100,
            }}
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            style={{
              padding: "8px 24px",
              borderRadius: 8,
              fontSize: "var(--fs-13)",
              fontWeight: 500,
              border: "none",
              background: "var(--accent)",
              color: "#fff",
              cursor: "pointer",
              transition: "all .15s",
              boxShadow: "0 0 16px var(--accent-glow)",
              minWidth: 100,
            }}
            onMouseEnter={(e) => {
              (e.target as HTMLElement).style.opacity = "0.85";
            }}
            onMouseLeave={(e) => {
              (e.target as HTMLElement).style.opacity = "1";
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
