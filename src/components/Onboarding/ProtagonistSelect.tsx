import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useCharacterStore } from "@/stores/characterStore";
import { useGenerationStore } from "@/stores/generationStore";
import { useUIStore } from "@/stores/uiStore";
import { useWorldStore } from "@/stores/worldStore";
import { getTopicOpeningScenarios } from "@/lib/topicOpenings";
import { getCustomBookOpeningScenarios } from "@/lib/worldOpeningScenarios";

interface Props {
  onComplete: () => void;
}

export function ProtagonistSelect({ onComplete }: Props) {
  const {
    selectedWorldId,
    selectedWorldName,
    selectedTopicSchemeId,
    selectedTropeName,
    selectedStylePresetName,
    selectedMode,
    playerName,
    setPlayerName,
    setSelectedCharacter,
    setSelectedScenario,
    onboardingAudience,
  } = useUIStore();
  const effTheme = useUIStore((s) => s.effectiveTheme)();
  // 开局选主角：只显示自定义角色（内置功能性角色用于扮演/工具场景，不参与冒险主角）
  const characters = useCharacterStore((s) => s.characters).filter((c) => !c.isBuiltin);
  const addCharacter = useCharacterStore((s) => s.addCharacter);
  const { activePresetId, setActivePreset } = useGenerationStore();
  const worldBooks = useWorldStore((s) => s.books);

  const [selectedChar, setSelectedChar] = useState<string | null>(null);
  const [selectedScenario, setSelectedScenarioLocal] = useState<string | null>(null);
  const [randomPicked, setRandomPicked] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ name: "", appearance: "", personality: "", background: "", tags: "" });
  const [createBusy, setCreateBusy] = useState(false);
  const [createError, setCreateError] = useState("");

  // 自定义规则书：开局只用自己的定制开局池（AI 生成 + 条目兜底），不进男女频预设池
  const customBook = selectedWorldId ? worldBooks.find((b) => b.id === selectedWorldId && !b.isBuiltin) || null : null;
  const scenarios = customBook
    ? getCustomBookOpeningScenarios(customBook)
    : getTopicOpeningScenarios(selectedTopicSchemeId, selectedWorldId, onboardingAudience);
  const randomResult = scenarios.find((s) => s.id === selectedScenario) || null;

  useEffect(() => {
    if (selectedMode === "player" && activePresetId !== "player-control") {
      setActivePreset("player-control");
    }
  }, [selectedMode, activePresetId, setActivePreset]);

  const handleCharSelect = (id: string, name: string) => {
    setSelectedChar(id);
    setSelectedCharacter(id, name);
    setPlayerName(name);
  };

  const handleCreateSubmit = async () => {
    const name = createForm.name.trim();
    if (!name) {
      setCreateError("请输入角色名字");
      return;
    }
    setCreateBusy(true);
    setCreateError("");
    try {
      const id = crypto.randomUUID();
      await addCharacter({
        id,
        name,
        appearance: createForm.appearance.trim(),
        personality: createForm.personality.trim(),
        background: createForm.background.trim(),
        tags: createForm.tags.split(/[,，]/).map((t) => t.trim()).filter(Boolean),
        isBuiltin: false,
      });
      setShowCreate(false);
      setCreateForm({ name: "", appearance: "", personality: "", background: "", tags: "" });
      handleCharSelect(id, name);
    } catch {
      setCreateError("创建失败，请重试");
    } finally {
      setCreateBusy(false);
    }
  };

  const selectScenario = (id: string, name: string) => {
    setRandomPicked(false);
    setSelectedScenarioLocal(id);
    setSelectedScenario(id, name);
  };

  const randomScenario = () => {
    // 自定义规则书：只从自己的定制开局池随机（已展示的全部参与，池子小不排除），不进预设题材池
    if (customBook) {
      const pool = getCustomBookOpeningScenarios(customBook);
      if (pool.length > 0) {
        const scenario = pool[Math.floor(Math.random() * pool.length)];
        setRandomPicked(true);
        setSelectedScenarioLocal(scenario.id);
        setSelectedScenario(scenario.id, scenario.name);
        return;
      }
      setRandomPicked(true);
      setSelectedScenarioLocal("ai-random");
      setSelectedScenario("ai-random", "AI 随机开局");
      return;
    }
    // 固定展示的开局（当前频道/底座过滤后的预设）不参与随机：
    // 从同题材、同底座的「全部频道」池随机一个未被展示的开局；若预设开局已全部展示完，则用 AI 随机开局（即兴生成，不展示预设场景）
    const shownIds = new Set(scenarios.map((s) => s.id));
    const fullPool = getTopicOpeningScenarios(selectedTopicSchemeId, selectedWorldId, "all");
    const candidates = fullPool.filter((s) => !shownIds.has(s.id));
    if (candidates.length > 0) {
      const scenario = candidates[Math.floor(Math.random() * candidates.length)];
      setRandomPicked(true);
      setSelectedScenarioLocal(scenario.id);
      setSelectedScenario(scenario.id, scenario.name);
    } else {
      setRandomPicked(true);
      setSelectedScenarioLocal("ai-random");
      setSelectedScenario("ai-random", "AI 随机开局");
    }
  };

  const canStart = !!selectedScenario;

  return (
    <div>
      <nav className="seed-breadcrumb">
        <span className="seed-breadcrumb-pill">{selectedTropeName || "自动题材"}</span>
        {selectedStylePresetName && <span className="seed-breadcrumb-pill">{selectedStylePresetName}</span>}
        <span className="seed-breadcrumb-pill">{selectedMode === "player" ? "玩家视角" : selectedMode === "custom" ? "自定义模式" : "小说视角"}</span>
      </nav>

      <div style={{ textAlign: "center", marginBottom: 42 }}>
        <h1 style={{ fontSize: 34, fontWeight: 700, color: "var(--seed-fg)", marginBottom: 10 }}>
          设置主角与开局
        </h1>
        <p style={{ fontSize: 15, color: "var(--seed-muted)" }}>可以直接起名，也可以选已有角色卡；开局在这里一起定下。</p>
      </div>

      <div style={{ marginBottom: 38 }}>
        <div data-onboarding-name-row style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
          <input
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value.slice(0, 12))}
            placeholder="给你的主角起个名字"
            style={{
              flex: 1,
              maxWidth: 360,
              padding: "11px 16px",
              borderRadius: 12,
              background: "var(--seed-input-bg)",
              border: "1px solid " + (playerName.trim() ? "color-mix(in srgb, var(--seed-accent) 35%, transparent)" : "var(--seed-border)"),
              color: "var(--seed-fg)",
              fontSize: 14,
              fontFamily: "inherit",
              outline: "none",
            }}
          />
          <span style={{ fontSize: 12.5, color: "var(--seed-muted)", lineHeight: 1.5 }}>
            不填也行，系统会按题材自动兜底。
          </span>
        </div>

        <div data-onboarding-grid style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 16 }}>
          {characters.map((char) => (
            <div
              key={char.id}
              className={`seed-card ${selectedChar === char.id ? "seed-card--selected" : ""}`}
              onClick={() => handleCharSelect(char.id, char.name)}
              style={{ textAlign: "center", padding: "24px 16px 20px", cursor: "pointer" }}
            >
              <div style={{ width: 64, height: 64, margin: "0 auto 14px", borderRadius: "50%", background: "var(--seed-accent-bg)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {char.avatar ? <img src={char.avatar} alt={char.name} style={{ width: 64, height: 64, borderRadius: "50%", objectFit: "cover" }} /> : (
                  <svg width="36" height="36" viewBox="0 0 48 48" fill="none" stroke="var(--seed-primary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="24" cy="14" r="7" /><path d="M12 40v-4a8 8 0 018-8h8a8 8 0 018 8v4" /></svg>
                )}
              </div>
              <div style={{ fontSize: 15, fontWeight: 600, color: "var(--seed-fg)", marginBottom: 6 }}>{char.name}</div>
              <div style={{ fontSize: 12, lineHeight: 1.55, color: "var(--seed-muted)" }}>{char.personality ? char.personality.slice(0, 40) + (char.personality.length > 40 ? "..." : "") : "未设置人设"}</div>
            </div>
          ))}

          <div className="seed-card seed-card--custom" style={{ textAlign: "center", padding: "24px 16px 20px", cursor: "pointer" }} onClick={() => setShowCreate(true)}>
            <div style={{ width: 64, height: 64, margin: "0 auto 14px", borderRadius: "50%", border: "1.5px dashed color-mix(in srgb, var(--seed-fg) 12%, transparent)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--seed-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
            </div>
            <div style={{ fontSize: 14, fontWeight: 500, color: "var(--seed-muted)" }}>自定义角色</div>
          </div>
        </div>
      </div>

      <div style={{ marginBottom: 44 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--seed-muted)", marginBottom: 14 }}>开局场景</div>
        <div data-onboarding-grid style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
          <div
            className={`seed-card ${selectedScenario === "ai-random" || randomPicked ? "seed-card--selected" : ""}`}
            onClick={randomScenario}
            style={{
              padding: "28px 22px 24px",
              border: "1px dashed color-mix(in srgb, var(--seed-accent) 45%, transparent)",
              background: "color-mix(in srgb, var(--seed-accent) 6%, transparent)",
            cursor: "pointer",
            }}
          >
            <div className="seed-card-icon" style={{ marginBottom: 16, color: "var(--seed-accent)", background: "color-mix(in srgb, var(--seed-accent) 12%, transparent)" }}>
              <svg viewBox="0 0 24 24">
                <rect x="3" y="3" width="18" height="18" rx="4" />
                <circle cx="8.5" cy="8.5" r="1.2" />
                <circle cx="15.5" cy="8.5" r="1.2" />
                <circle cx="8.5" cy="15.5" r="1.2" />
                <circle cx="15.5" cy="15.5" r="1.2" />
                <circle cx="12" cy="12" r="1.2" />
              </svg>
            </div>
            <div className="seed-card-title" style={{ marginBottom: 8 }}>
              {randomPicked && randomResult ? `已随机：${randomResult.name}` : randomPicked ? "已随机：AI 随机开局" : "随机一个开局"}
            </div>
            <div className="seed-card-desc" style={{ marginBottom: 14 }}>
              {randomPicked && randomResult ? randomResult.description : randomPicked ? "由 AI 即兴生成全新开局，与预设不同。" : "在当前题材与背景的组合开局里随机。"}
            </div>
          </div>

          {scenarios.map((scenario) => (
            <div
              key={scenario.id}
              className={`seed-card ${selectedScenario === scenario.id && !randomPicked ? "seed-card--selected" : ""}`}
              onClick={() => selectScenario(scenario.id, scenario.name)}
              style={{ padding: "28px 22px 24px", cursor: "pointer" }}
            >
              <div className="seed-card-icon" style={{ marginBottom: 16 }}>
                <svg viewBox="0 0 24 24">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
              </div>
              <div className="seed-card-title" style={{ marginBottom: 8, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <span>{scenario.name}</span>
                {(scenario.audience || (onboardingAudience !== "all" ? onboardingAudience : null)) && (
                  <span style={{
                    fontSize: 10, fontWeight: 600, padding: "3px 8px", borderRadius: 999, flexShrink: 0,
                    background: scenario.audience === "female" || (!scenario.audience && onboardingAudience === "female")
                      ? "color-mix(in srgb, var(--seed-accent) 14%, transparent)"
                      : "color-mix(in srgb, #4fc3f7 14%, transparent)",
                    border: scenario.audience === "female" || (!scenario.audience && onboardingAudience === "female")
                      ? "1px solid color-mix(in srgb, var(--seed-accent) 35%, transparent)"
                      : "1px solid color-mix(in srgb, #4fc3f7 35%, transparent)",
                    color: scenario.audience === "female" || (!scenario.audience && onboardingAudience === "female")
                      ? "var(--seed-accent)"
                      : "#4fc3f7",
                  }}>
                    {scenario.audience === "female" || (!scenario.audience && onboardingAudience === "female") ? "女频" : "男频"}
                  </span>
                )}
              </div>
              <div className="seed-card-desc" style={{ marginBottom: 14 }}>{scenario.description}</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {scenario.keywords.map((kw) => (
                  <span key={kw} style={{ fontSize: 11, fontWeight: 500, padding: "3px 10px", borderRadius: 999, background: "var(--seed-hover-bg)", border: "1px solid var(--seed-border)", color: "var(--seed-muted)" }}>
                    {kw}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ textAlign: "center" }}>
        <button
          className="seed-cta"
          disabled={!canStart}
          title={!canStart ? "请先选择开局场景" : undefined}
          onClick={onComplete}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
          </svg>
          {selectedChar ? "开始冒险" : "直接开始"}
        </button>
      </div>

      <div style={{ textAlign: "center", marginTop: 24, fontSize: 13, color: "var(--seed-muted)", letterSpacing: "0.08em", fontWeight: 500 }}>
        3 <span style={{ opacity: 0.4 }}>/ 3</span>
      </div>

      {showCreate && createPortal(
        <div className={effTheme === "light" ? "theme-light" : "theme-dark"} style={{ position: "fixed", inset: 0, zIndex: 300, background: "var(--seed-overlay)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }} onClick={() => { if (!createBusy) setShowCreate(false); }}>
          <div className="glass-modal" style={{ width: "100%", maxWidth: 460, maxHeight: "86vh", overflowY: "auto", borderRadius: 20, padding: 26 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <div style={{ fontSize: 19, fontWeight: 700, color: "var(--seed-fg)" }}>创建自定义角色</div>
              <button onClick={() => setShowCreate(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--seed-muted)", fontSize: 20, lineHeight: 1, padding: 4 }} aria-label="关闭">×</button>
            </div>

            {([
              { key: "name", label: "名字", required: true, placeholder: "如：林晚秋", lines: 1 },
              { key: "appearance", label: "外观", required: false, placeholder: "外貌、衣着、气质（选填）", lines: 2 },
              { key: "personality", label: "人设", required: false, placeholder: "性格、行为习惯（选填）", lines: 2 },
              { key: "background", label: "背景", required: false, placeholder: "身世、经历（选填）", lines: 2 },
              { key: "tags", label: "标签", required: false, placeholder: "如：修士, 冷静（逗号分隔）", lines: 1 },
            ] as const).map((f) => (
              <div key={f.key} style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--seed-muted)", marginBottom: 6 }}>
                  {f.label}{f.required ? <span style={{ color: "var(--seed-accent)" }}> *</span> : null}
                </div>
                <textarea
                  rows={f.lines}
                  value={createForm[f.key]}
                  onChange={(e) => setCreateForm((p) => ({ ...p, [f.key]: e.target.value }))}
                  placeholder={f.placeholder}
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    padding: "9px 12px",
                    borderRadius: 10,
                    background: "var(--seed-input-bg)",
                    border: "1px solid var(--seed-border)",
                    color: "var(--seed-fg)",
                    fontSize: 13,
                    fontFamily: "inherit",
                    outline: "none",
                    resize: "vertical",
                  }}
                />
              </div>
            ))}

            {createError && <div style={{ fontSize: 12, color: "var(--seed-danger, #e5484d)", marginBottom: 10 }}>{createError}</div>}

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 6 }}>
              <button
                onClick={() => setShowCreate(false)}
                disabled={createBusy}
                style={{ padding: "9px 18px", borderRadius: 10, border: "1px solid var(--seed-border)", background: "var(--seed-input-bg)", color: "var(--seed-fg)", fontSize: 13, cursor: "pointer" }}
              >
                取消
              </button>
              <button
                className="seed-cta"
                onClick={handleCreateSubmit}
                disabled={createBusy}
                style={{ padding: "9px 22px", fontSize: 13 }}
              >
                {createBusy ? "创建中..." : "创建并选中"}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
