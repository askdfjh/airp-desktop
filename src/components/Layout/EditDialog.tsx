import { useEffect } from "react";

interface Field {
  key: string;
  label: string;
  type: "text" | "textarea";
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}

interface Props {
  title: string;
  fields: Field[];
  onSave: () => void;
  onCancel: () => void;
  saveLabel?: string;
}

export function EditDialog({ title, fields, onSave, onCancel, saveLabel = "保存" }: Props) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.35)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)", animation: "fadeInMsg .15s ease-out" }}
      onClick={onCancel}>
      <div className="glass-modal rd-16 sh-lg"
        style={{ width: 420, maxWidth: "calc(100vw - 32px)", maxHeight: "calc(100vh - 40px)", overflowY: "auto", padding: 24, animation: "fadeInUp .2s ease-out" }}
        onClick={(e) => e.stopPropagation()}>
        <div style={{ fontSize: "var(--fs-15)", fontWeight: 600, color: "var(--seed-fg)", marginBottom: 20 }}>{title}</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {fields.map((f) => (
            <div key={f.key}>
              <div style={{ fontSize: "var(--fs-11)", color: "var(--seed-muted)", marginBottom: 4 }}>{f.label}</div>
              {f.type === "textarea" ? (
                <textarea value={f.value} onChange={(e) => f.onChange(e.target.value)} placeholder={f.placeholder}
                  rows={f.rows ?? 4}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 8, background: "var(--seed-input-bg)", border: "1px solid var(--seed-border)", color: "var(--seed-fg)", fontSize: "var(--fs-12)", fontFamily: "inherit", resize: "vertical", outline: "none", boxSizing: "border-box" }} />
              ) : (
                <input value={f.value} onChange={(e) => f.onChange(e.target.value)} placeholder={f.placeholder}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 8, background: "var(--seed-input-bg)", border: "1px solid var(--seed-border)", color: "var(--seed-fg)", fontSize: "var(--fs-12)", fontFamily: "inherit", outline: "none", boxSizing: "border-box" }} />
              )}
            </div>
          ))}
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 20 }}>
          <button onClick={onCancel}
            style={{ padding: "8px 20px", borderRadius: 8, fontSize: "var(--fs-12)", color: "var(--seed-muted)", background: "transparent", border: "1px solid var(--seed-border)", cursor: "pointer" }}>取消</button>
          <button onClick={onSave}
            style={{ padding: "8px 20px", borderRadius: 8, fontSize: "var(--fs-12)", fontWeight: 500, background: "var(--seed-accent)", color: "#fff", border: "none", cursor: "pointer" }}>{saveLabel}</button>
        </div>
      </div>
    </div>
  );
}
