import { useEffect, useState } from "react";
import { useGenerationStore } from "@/stores/generationStore";
import { useUIStore } from "@/stores/uiStore";

const STYLE_IDS = new Set(["balanced", "creative", "roleplay", "longform", "stable"]);

export function StyleModeSelect() {
  const {
    selectedWorldName,
    selectedTropeName,
    selectedStylePresetName,
    selectedMode,
    setSelectedMode,
    setSelectedStylePreset,
    setOnboardingStep,
  } = useUIStore();
  const { presets, activePresetId, setActivePreset } = useGenerationStore();
  const styles = presets.filter((p) => STYLE_IDS.has(p.id));
  const [selectedStyle, setSelectedStyle] = useState<string | null>(selectedStylePresetName ? activePresetId : null);
  const [selected, setSelected] = useState<string | null>(selectedMode);

  const selectedCardStyle = (active: boolean): React.CSSProperties => ({
    padding: "20px 18px",
    cursor: "pointer",
    borderStyle: active ? "solid" : "dashed",
    borderColor: active ? "var(--seed-accent)" : undefined,
    background: active ? "var(--seed-accent-bg)" : undefined,
    boxShadow: active ? "0 0 0 1px var(--seed-accent), 0 8px 24px -12px var(--seed-accent-glow)" : undefined,
  });

  const selectedModeCardStyle = (active: boolean): React.CSSProperties => ({
    padding: "22px 20px",
    cursor: "pointer",
    borderColor: active ? "var(--seed-accent)" : undefined,
    background: active ? "var(--seed-accent-bg)" : undefined,
    boxShadow: active ? "0 0 0 1px var(--seed-accent), 0 8px 24px -12px var(--seed-accent-glow)" : undefined,
  });

  useEffect(() => {
    if (selectedMode === "player" && activePresetId !== "player-control") {
      setActivePreset("player-control");
    }
  }, [selectedMode, activePresetId, setActivePreset]);

  const chooseStyle = (id: string | null, name: string | null) => {
    setSelectedStyle(id);
    setSelectedStylePreset(id, name);
    if (id) setActivePreset(id);
  };

  const chooseMode = (mode: "novel" | "player" | "custom") => {
    setSelected(mode);
    setSelectedMode(mode);
    if (mode === "player") setActivePreset("player-control");
  };

  return (
    <div>
      <nav className="seed-breadcrumb">
        <span className="seed-breadcrumb-pill">{selectedWorldName || "未知题材"}</span>
      </nav>

      <div style={{ textAlign: "center", marginBottom: 42 }}>
        <h1 style={{ fontSize: 34, fontWeight: 700, color: "var(--seed-fg)", marginBottom: 10 }}>
          风格与扮演模式
        </h1>
        <p style={{ fontSize: 15, color: "var(--seed-muted)" }}>
          风格可跳过，扮演模式必须选。当前题材：{selectedTropeName || "自动匹配"}。
        </p>
      </div>

      <div style={{ marginBottom: 38 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--seed-muted)", marginBottom: 14 }}>风格（可选）</div>
        <div data-onboarding-grid style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 14 }}>
          <div
            className={`seed-card ${!selectedStyle ? "seed-card--selected" : ""}`}
            onClick={() => chooseStyle(null, null)}
            style={selectedCardStyle(!selectedStyle)}
          >
            <div className="seed-card-title">跳过风格</div>
            <div className="seed-card-desc">保留默认输出预设。</div>
          </div>

          {styles.map((style) => (
            <div
              key={style.id}
              className={`seed-card ${selectedStyle === style.id ? "seed-card--selected" : ""}`}
              onClick={() => chooseStyle(style.id, style.name)}
              style={selectedCardStyle(selectedStyle === style.id)}
            >
              <div className="seed-card-title" style={{ marginBottom: 8 }}>{style.name}</div>
              <div className="seed-card-desc">{style.description}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginBottom: 44 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--seed-muted)", marginBottom: 14 }}>扮演模式</div>
        <div data-onboarding-grid style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
          {([
            { id: "novel", name: "小说视角", desc: "第三人称叙事" },
            { id: "player", name: "玩家视角", desc: "第一人称沉浸" },
            { id: "custom", name: "自定义模式", desc: "自由叙事规则" },
          ] as const).map((mode) => (
            <div
              key={mode.id}
              className={`seed-card ${selected === mode.id ? "seed-card--selected" : ""}`}
              onClick={() => chooseMode(mode.id)}
              style={selectedModeCardStyle(selected === mode.id)}
            >
              <div className="seed-card-title" style={{ marginBottom: 6 }}>{mode.name}</div>
              <div className="seed-card-desc">{mode.desc}</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ textAlign: "center" }}>
        <button className="seed-cta" disabled={!selected} onClick={() => setOnboardingStep(3)}>
          继续
        </button>
      </div>

      <div style={{ textAlign: "center", marginTop: 24, fontSize: 13, color: "var(--seed-muted)", letterSpacing: "0.08em", fontWeight: 500 }}>
        2 <span style={{ opacity: 0.4 }}>/ 3</span>
      </div>
    </div>
  );
}
