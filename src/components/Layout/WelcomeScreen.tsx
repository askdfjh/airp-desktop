import { ART } from "@/assets/art";

export function WelcomeScreen({
  onSkip,
  onConfigure,
}: {
  onSkip: () => void;
  onConfigure: () => void;
}) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 300,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
        background:
          "radial-gradient(ellipse 70% 55% at 50% 28%, var(--seed-accent-bg) 0%, transparent 65%), radial-gradient(ellipse 55% 45% at 75% 75%, color-mix(in srgb, var(--seed-accent) 4%, transparent) 0%, transparent 55%), var(--seed-bg)",
      }}
    >
      <img className="seed-welcome-art" src={ART.welcome} alt="" />
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", opacity: 0.5 }}>
        {Array.from({ length: 8 }, (_, i) => (
          <div
            key={i}
            className="seed-particle"
            style={{
              width: 2 + Math.random() * 2,
              height: 2 + Math.random() * 2,
              left: `${8 + i * 12}%`,
              animationDuration: `${13 + i * 3}s`,
              animationDelay: `${i * 1.7}s`,
            }}
          />
        ))}
      </div>

      <div
        style={{
          position: "relative",
          zIndex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 10,
          textAlign: "center",
          maxWidth: 520,
          padding: "0 32px",
        }}
      >
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: 22,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "var(--seed-accent-bg)",
            border: "1px solid var(--seed-accent-border)",
            boxShadow: "0 0 40px color-mix(in srgb, var(--seed-accent) 25%, transparent)",
            marginBottom: 8,
          }}
        >
          <img src={ART.appIcon} alt="" style={{ width: 56, height: 56, borderRadius: 16 }} />
        </div>

        <h1 style={{ margin: 0, fontSize: 34, fontWeight: 700, letterSpacing: "0.06em", color: "var(--seed-fg)" }}>
          灵叙 Narra
        </h1>
        <p style={{ margin: 0, fontSize: 14, color: "var(--seed-muted)", letterSpacing: "0.2em" }}>
          本地文字创作与排版
        </p>

        <p style={{ margin: "18px 0 4px", fontSize: 14, lineHeight: 1.8, color: "var(--seed-muted)" }}>
          打开就是书架。第一次先接上模型服务，
          <br />
          然后就能开一本自己的故事。
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 22, width: "100%", maxWidth: 320 }}>
          <button
            className="seed-btn-primary"
            onClick={onConfigure}
            style={{ padding: "12px 24px", fontSize: 14, borderRadius: 12 }}
          >
            开始配置 API
          </button>
          <button
            onClick={onSkip}
            style={{
              padding: "10px 24px",
              fontSize: 13,
              borderRadius: 12,
              background: "transparent",
              border: "1px solid var(--seed-border)",
              color: "var(--seed-muted)",
              cursor: "pointer",
              transition: "color 0.15s, border-color 0.15s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "var(--seed-fg)"; e.currentTarget.style.borderColor = "var(--seed-accent-border)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "var(--seed-muted)"; e.currentTarget.style.borderColor = "var(--seed-border)"; }}
          >
            跳过，先去书架
          </button>
        </div>

        <p style={{ margin: "16px 0 0", fontSize: 12, color: "var(--seed-muted)", opacity: 0.7 }}>
          跳过之后仍可随时在设置中配置模型服务
        </p>
      </div>
    </div>
  );
}
