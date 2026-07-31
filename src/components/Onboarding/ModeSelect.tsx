import { useState } from "react";
import { useUIStore } from "@/stores/uiStore";

const MODES = [
  {
    id: "novel" as const,
    name: "小说视角",
    subtitle: "第三人称旁观叙事",
    desc: "如同阅读一部小说，你以旁观者的视角见证故事中的一切。叙述者会用「他」「她」来描述角色的行动与内心。",
    example: "「青云子缓缓拔出长剑，目光如炬。他知道，这一战关乎宗门存亡……」",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
        <path d="M8 7h8" />
        <path d="M8 11h5" />
      </svg>
    ),
  },
  {
    id: "player" as const,
    name: "玩家视角",
    subtitle: "第一人称沉浸参与",
    desc: "你就是故事中的角色之一。AI 会描述其他角色和环境，你用「我」来回应和行动，完全沉浸在角色中。",
    example: "「我握紧剑柄，深吸一口气。『来吧，让我看看你的实力。』」",
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    ),
  },
  {
    id: "custom" as const,
    name: "自定义模式",
    subtitle: "自由定义叙事规则",
    desc: "完全自由——你可以混合视角、设定特殊的叙事规则、或创建全新的扮演方式。",
    example: null,
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
      </svg>
    ),
  },
];

export function ModeSelect() {
  const { selectedWorldName, setSelectedMode, setOnboardingStep } = useUIStore();
  const [selected, setSelected] = useState<string | null>(null);

  const handleSelect = (id: "novel" | "player" | "custom") => {
    setSelected(id);
    setSelectedMode(id);
    setTimeout(() => {
      setOnboardingStep(3);
    }, 800);
  };

  return (
    <div>
      {/* Breadcrumb */}
      <nav className="seed-breadcrumb">
        <span className="seed-breadcrumb-pill">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <path d="M2 12h20" />
            <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
          </svg>
          {selectedWorldName || "未知世界"}
        </span>
        <button className="seed-breadcrumb-link" onClick={() => setOnboardingStep(1)}>
          更换世界
        </button>
      </nav>

      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 48 }}>
        <h1 style={{ fontSize: 34, fontWeight: 700, letterSpacing: "-0.02em", color: "var(--seed-fg)", marginBottom: 10, lineHeight: 1.2 }}>
          选择扮演模式
        </h1>
        <p style={{ fontSize: 15, color: "var(--seed-muted)" }}>决定你在这个世界中的视角</p>
      </div>

      {/* Mode cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: 24, marginBottom: 48 }}>
        {MODES.map((mode) => (
          <div
            key={mode.id}
            className={`seed-card ${selected === mode.id ? "seed-card--selected" : ""}`}
            onClick={() => handleSelect(mode.id)}
            style={{ display: "flex", alignItems: "flex-start", gap: 20, padding: 28 }}
          >
            <div className="seed-card-check">
              <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12" /></svg>
            </div>
            <div className="seed-card-icon" style={{ flexShrink: 0, marginBottom: 0 }}>
              {mode.icon}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="seed-card-title" style={{ marginBottom: 2 }}>{mode.name}</div>
              <div className="seed-card-subtitle">{mode.subtitle}</div>
              <div className="seed-card-desc" style={{ marginBottom: mode.example ? 14 : 0 }}>
                {mode.desc}
              </div>
              {mode.example && (
                <div style={{
                  fontSize: 13,
                  lineHeight: 1.65,
                  color: "var(--seed-muted)",
                  fontStyle: "italic",
                  paddingLeft: 14,
                  borderLeft: "2px solid color-mix(in srgb, var(--seed-accent) 20%, transparent)",
                }}>
                  {mode.example}
                </div>
              )}
            </div>
          </div>
        ))}

        {/* RPG mode - disabled */}
        <div
          className="seed-card seed-card--disabled"
          style={{ display: "flex", alignItems: "flex-start", gap: 20, padding: 28 }}
        >
          <div className="seed-card-icon" style={{ flexShrink: 0, marginBottom: 0, opacity: 0.5 }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
              <line x1="8" y1="21" x2="16" y2="21" />
              <line x1="12" y1="17" x2="12" y2="21" />
            </svg>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="seed-card-title" style={{ marginBottom: 2, opacity: 0.6 }}>RPG 对话框模式</div>
            <div className="seed-card-subtitle" style={{ opacity: 0.5 }}>视觉化角色扮演体验</div>
            <div className="seed-card-desc" style={{ opacity: 0.5, fontSize: 13 }}>
              带有场景画面和角色立绘的 RPG 风格对话框，等接入文生图功能后启用。
            </div>
          </div>
        </div>
      </div>

      {/* Step indicator */}
      <div style={{ textAlign: "center", fontSize: 13, color: "var(--seed-muted)", letterSpacing: "0.08em", fontWeight: 500 }}>
        2 <span style={{ opacity: 0.4 }}>/ 3</span>
      </div>
    </div>
  );
}
