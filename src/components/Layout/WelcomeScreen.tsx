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
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--seed-accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
          </svg>
        </div>

        <h1 style={{ margin: 0, fontSize: 34, fontWeight: 700, letterSpacing: "0.06em", color: "var(--seed-fg)" }}>
          AIRP
        </h1>
        <p style={{ margin: 0, fontSize: 14, color: "var(--seed-muted)", letterSpacing: "0.2em" }}>
          沉浸式 AI 互动小说
        </p>

        <p style={{ margin: "18px 0 4px", fontSize: 14, lineHeight: 1.8, color: "var(--seed-muted)" }}>
          欢迎开启你的冒险之旅。首次使用需要配置模型服务（API），
          <br />
          配置完成后即可开始创作你的故事。
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
            跳过，直接进入对话
          </button>
        </div>

        <p style={{ margin: "16px 0 0", fontSize: 12, color: "var(--seed-muted)", opacity: 0.7 }}>
          跳过之后仍可随时在设置中配置模型服务
        </p>
      </div>
    </div>
  );
}
