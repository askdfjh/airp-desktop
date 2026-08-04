import type { ReactNode } from "react";
import { ShieldAlert } from "lucide-react";

interface ComplianceNoticeProps {
  children: ReactNode;
  title?: string;
  className?: string;
}

export function ComplianceNotice({ children, title = "合规提醒", className }: ComplianceNoticeProps) {
  return (
    <div
      role="note"
      className={className}
      style={{
        display: "flex",
        gap: 8,
        alignItems: "flex-start",
        padding: "9px 12px",
        borderRadius: 12,
        background: "color-mix(in srgb, var(--seed-surface) 55%, transparent)",
        border: "1px solid color-mix(in srgb, var(--seed-border) 62%, transparent)",
        color: "color-mix(in srgb, var(--seed-muted) 78%, transparent)",
        opacity: 0.82,
      }}
    >
      <div
        style={{
          width: 16,
          height: 16,
          borderRadius: 999,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          marginTop: 3,
          background: "transparent",
          color: "color-mix(in srgb, var(--seed-muted) 70%, transparent)",
        }}
      >
        <ShieldAlert size={11} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: "var(--fs-10)", fontWeight: 500, color: "color-mix(in srgb, var(--seed-muted) 82%, transparent)", marginBottom: 1 }}>{title}</div>
        <div style={{ fontSize: "var(--fs-10)", lineHeight: 1.65 }}>{children}</div>
      </div>
    </div>
  );
}
