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
        gap: 10,
        alignItems: "flex-start",
        padding: "12px 14px",
        borderRadius: 14,
        background: "color-mix(in srgb, var(--warning-bg) 64%, transparent)",
        border: "1px solid color-mix(in srgb, var(--warning) 24%, var(--seed-border))",
        color: "var(--seed-muted)",
      }}
    >
      <div
        style={{
          width: 20,
          height: 20,
          borderRadius: 999,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          marginTop: 1,
          background: "color-mix(in srgb, var(--warning-bg) 40%, transparent)",
          color: "var(--warning)",
        }}
      >
        <ShieldAlert size={13} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--seed-fg)", marginBottom: 2 }}>{title}</div>
        <div style={{ fontSize: 12, lineHeight: 1.7 }}>{children}</div>
      </div>
    </div>
  );
}
