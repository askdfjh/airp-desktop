import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useUIStore } from "@/stores/uiStore";
import { useCharacterStore } from "@/stores/characterStore";
import { useOnboardingStore } from "@/stores/onboardingStore";
import { useGenerationStore } from "@/stores/generationStore";
interface Props {
  onComplete: () => void;
}

export function CharacterOpeningSelect({ onComplete }: Props) {
  const {
    selectedWorldName, selectedMode, selectedWorldId,
    setSelectedCharacter, setSelectedScenario: setStoreScenario, setOnboardingStep,
    playerName, setPlayerName,
  } = useUIStore();
  const effTheme = useUIStore((s) => s.effectiveTheme)();
  const characters = useCharacterStore((s) => s.characters);
  const addCharacter = useCharacterStore((s) => s.addCharacter);
  const getScenariosByTheme = useOnboardingStore((s) => s.getScenariosByTheme);
  const resolveTheme = useOnboardingStore((s) => s.resolveTheme);
  const { presets, activePresetId, setActivePreset } = useGenerationStore();

  const [selectedChar, setSelectedChar] = useState<string | null>(null);
  const [selectedScenario, setSelectedScenario] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ name: "", appearance: "", personality: "", background: "", tags: "" });
  const [createBusy, setCreateBusy] = useState(false);
  const [createError, setCreateError] = useState("");

  const scenarios = getScenariosByTheme(resolveTheme(selectedWorldId || "cultivation"));

  const modeLabel = selectedMode === "novel" ? "小说视角" : selectedMode === "player" ? "玩家视角" : "自定义模式";

  // 玩家视角：自动启用「玩家视角 · 行动对话自主」预设（行动与对话完全由玩家控制）
  useEffect(() => {
    if (selectedMode === "player" && activePresetId !== "player-control") {
      setActivePreset("player-control");
    }
  }, [selectedMode, activePresetId, setActivePreset]);

  const handlePresetSelect = (id: string) => {
    if (activePresetId === id) {
      setActivePreset("none");
    } else {
      setActivePreset(id);
    }
  };

  const handleCharSelect = (id: string, name: string) => {
    setSelectedChar(id);
    setSelectedCharacter(id, name);
    // 选角色卡时自动带入主角名（用户可再改）
    setPlayerName(name);
  };

  const handleScenarioSelect = (id: string, name: string) => {
    setSelectedScenario(id);
    setStoreScenario(id, name);
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
      handleCharSelect(id, name);    } catch (e) {
      setCreateError("创建失败，请重试");
    } finally {
      setCreateBusy(false);
    }
  };

  // 允许无角色无场景直接开始：用户可以选择角色+场景，也可以跳过直接进入对话
  const canStart = true;

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
        <span className="seed-breadcrumb-sep">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
        </span>
        <span className="seed-breadcrumb-pill">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
          </svg>
          {modeLabel}
        </span>
        <button className="seed-breadcrumb-link" onClick={() => setOnboardingStep(2)} style={{ marginLeft: "auto" }}>
          更换
        </button>
      </nav>

      {/* Title */}
      <div style={{ textAlign: "center", marginBottom: 48 }}>
        <h1 style={{ fontSize: 34, fontWeight: 700, letterSpacing: "-0.02em", color: "var(--seed-fg)", marginBottom: 8 }}>
          选择角色与开局
        </h1>
        <p style={{ fontSize: 15, color: "var(--seed-muted)" }}>决定你的主角和故事的起点</p>
      </div>

      {/* Character section */}
      <div style={{ marginBottom: 48 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20, fontSize: 14, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--seed-muted)" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--seed-accent)" }}>
            <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
          角色
          <div style={{ flex: 1, height: 1, background: "var(--seed-border)", marginLeft: 8 }} />
        </div>

        {/* 主角名：玩家扮演的角色，至少起个名字 */}
        <div style={{ marginBottom: 22, display: "flex", alignItems: "center", gap: 12 }}>
          <input
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value.slice(0, 12))}
            placeholder="给你的主角起个名字（如：林晚秋）"
            style={{
              flex: 1,
              maxWidth: 320,
              padding: "11px 16px",
              borderRadius: 12,
              background: "var(--seed-input-bg)",
              border: "1px solid " + (playerName.trim() ? "color-mix(in srgb, var(--seed-accent) 35%, transparent)" : "var(--seed-border)"),
              color: "var(--seed-fg)",
              fontSize: 14,
              fontFamily: "inherit",
              outline: "none",
              transition: "border-color 0.2s",
            }}
          />
          <span style={{ fontSize: 12.5, color: "var(--seed-muted)", lineHeight: 1.5 }}>
            这是你扮演的主角，AI 将以这个名字称呼你
            <br />
            {playerName.trim() ? (
              <span style={{ color: "var(--seed-accent)" }}>✓ 名字已就绪</span>
            ) : (
              <span>未填写时将使用「主角」</span>
            )}
          </span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 16 }}>
          {characters.map((char) => (
            <div
              key={char.id}
              className={`seed-card ${selectedChar === char.id ? "seed-card--selected" : ""}`}
              onClick={() => handleCharSelect(char.id, char.name)}
              style={{ textAlign: "center", padding: "24px 16px 20px" }}
            >
              <div className="seed-card-check">
                <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12" /></svg>
              </div>
              <div style={{
                width: 64, height: 64, margin: "0 auto 14px", borderRadius: "50%",
                background: "var(--seed-accent-bg)", display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                {char.avatar ? (
                  <img src={char.avatar} alt={char.name} style={{ width: 64, height: 64, borderRadius: "50%", objectFit: "cover" }} />
                ) : (
                  <svg width="36" height="36" viewBox="0 0 48 48" fill="none" stroke="var(--seed-primary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="24" cy="14" r="7" />
                    <path d="M12 40v-4a8 8 0 018-8h8a8 8 0 018 8v4" />
                  </svg>
                )}
              </div>
              <div style={{ fontSize: 15, fontWeight: 600, color: "var(--seed-fg)", marginBottom: 6 }}>{char.name}</div>
              {char.tags.length > 0 && (
                <span style={{
                  display: "inline-block", padding: "2px 10px", fontSize: 11, fontWeight: 600,
                  borderRadius: 999, background: "var(--seed-accent-bg)", color: "var(--seed-accent)", marginBottom: 10,
                }}>
                  {char.tags[0]}
                </span>
              )}
              <div style={{ fontSize: 12, lineHeight: 1.55, color: "var(--seed-muted)" }}>
                {char.personality ? char.personality.slice(0, 40) + (char.personality.length > 40 ? "..." : "") : "未设置人设"}
              </div>
            </div>
          ))}

          {/* Custom character */}
          <div
            className="seed-card seed-card--custom"
            style={{ textAlign: "center", padding: "24px 16px 20px", cursor: "pointer" }}
            onClick={() => setShowCreate(true)}
          >
            <div style={{
              width: 64, height: 64, margin: "0 auto 14px", borderRadius: "50%",
              border: "1.5px dashed color-mix(in srgb, var(--seed-fg) 12%, transparent)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--seed-muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </div>
            <div style={{ fontSize: 14, fontWeight: 500, color: "var(--seed-muted)" }}>自定义角色</div>
            <div style={{ fontSize: 12, color: "var(--seed-muted)", opacity: 0.6, marginTop: 4 }}>创建你自己的角色</div>
          </div>

          {characters.length === 0 && (
            <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: 32, color: "var(--seed-muted)", fontSize: 14 }}>
              暂无角色，请在设置面板中创建角色后返回
            </div>
          )}
        </div>
      </div>

      {/* Scenario section */}
      <div style={{ marginBottom: 52 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20, fontSize: 14, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--seed-muted)" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--seed-accent)" }}>
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
          开局场景
          <div style={{ flex: 1, height: 1, background: "var(--seed-border)", marginLeft: 8 }} />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
          {/* AI 随机开局：不选预设场景，由 AI 即兴创作开局 */}
          <div
            className={`seed-card ${selectedScenario === "ai-random" ? "seed-card--selected" : ""}`}
            onClick={() => handleScenarioSelect("ai-random", "AI 随机开局")}
            style={{
              padding: "28px 22px 24px",
              border: "1px dashed color-mix(in srgb, var(--seed-accent) 45%, transparent)",
              background: "color-mix(in srgb, var(--seed-accent) 6%, transparent)",
            }}
          >
            <div className="seed-card-check">
              <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12" /></svg>
            </div>
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
            <div className="seed-card-title" style={{ marginBottom: 8 }}>AI 随机开局</div>
            <div className="seed-card-desc" style={{ marginBottom: 14 }}>由 AI 根据世界与角色即兴创作的开局</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {["惊喜", "未知", "即兴"].map((kw) => (
                <span key={kw} style={{
                  fontSize: 11, fontWeight: 500, padding: "3px 10px", borderRadius: 999,
                  background: "var(--seed-hover-bg)", border: "1px solid var(--seed-border)", color: "var(--seed-muted)",
                }}>
                  {kw}
                </span>
              ))}
            </div>
          </div>

          {scenarios.map((scenario) => (
            <div
              key={scenario.id}
              className={`seed-card ${selectedScenario === scenario.id ? "seed-card--selected" : ""}`}
              onClick={() => handleScenarioSelect(scenario.id, scenario.name)}
              style={{ padding: "28px 22px 24px" }}
            >
              <div className="seed-card-check">
                <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12" /></svg>
              </div>
              <div className="seed-card-icon" style={{ marginBottom: 16 }}>
                <svg viewBox="0 0 24 24">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                </svg>
              </div>
              <div className="seed-card-title" style={{ marginBottom: 8 }}>{scenario.name}</div>
              <div className="seed-card-desc" style={{ marginBottom: 14 }}>{scenario.description}</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {scenario.keywords.map((kw) => (
                  <span key={kw} style={{
                    fontSize: 11, fontWeight: 500, padding: "3px 10px", borderRadius: 999,
                    background: "var(--seed-hover-bg)", border: "1px solid var(--seed-border)", color: "var(--seed-muted)",
                  }}>
                    {kw}
                  </span>
                ))}
              </div>
            </div>
          ))}

          {scenarios.length === 0 && (
            <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: 32, color: "var(--seed-muted)", fontSize: 14 }}>
              当前世界暂无预设开局场景，可直接开始对话
            </div>
          )}
        </div>
      </div>

      {/* 预设文风格（按视角） */}
      <div style={{ marginBottom: 52 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20, fontSize: 14, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--seed-muted)" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--seed-accent)" }}>
            <path d="M4 7V4h16v3" />
            <path d="M9 20h6" />
            <path d="M12 4v16" />
          </svg>
          {selectedMode === "player" ? "已启用 · 玩家视角执行准则" : "预设文风格"}
          <div style={{ flex: 1, height: 1, background: "var(--seed-border)", marginLeft: 8 }} />
        </div>

        {selectedMode === "player" ? (
          <div
            className="seed-card seed-card--selected"
            style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 6 }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="var(--seed-accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span style={{ fontSize: 15, fontWeight: 600, color: "var(--seed-fg)" }}>玩家视角 · 行动对话自主</span>
              <span className="seed-tag-pill" style={{ fontSize: 10, padding: "1px 7px", background: "var(--seed-accent-bg)", color: "var(--seed-accent)" }}>已启用</span>
            </div>
            <div style={{ fontSize: 12, lineHeight: 1.7, color: "var(--seed-muted)" }}>
              行动与对话完全由你控制：AI 只描述世界、反馈环境与 NPC 的回应，绝不代写你的言行。可在 设置 → 输出 中调整。
            </div>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))", gap: 12 }}>
            {presets.map((p) => (
              <div
                key={p.id}
                onClick={() => handlePresetSelect(p.id)}
                style={{
                  position: "relative",
                  padding: "14px 16px",
                  borderRadius: 16,
                  cursor: "pointer",
                  background: p.id === activePresetId ? "var(--seed-accent-bg)" : "var(--seed-surface)",
                  border: "1px solid " + (p.id === activePresetId ? "var(--seed-accent-border)" : "var(--seed-border)"),
                  boxShadow: p.id === activePresetId ? "inset 3px 0 0 0 var(--seed-accent)" : "none",
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: "var(--seed-fg)" }}>{p.name}</span>
                  {p.id === activePresetId && (
                    <svg style={{ marginLeft: "auto" }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--seed-accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </div>
                <div style={{ fontSize: 12, lineHeight: 1.5, color: "var(--seed-muted)" }}>{p.description}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* CTA */}
      <div style={{ textAlign: "center" }}>
        <button
          className="seed-cta"
          disabled={!canStart}
          onClick={onComplete}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
          </svg>
          {selectedChar && selectedScenario ? "开始冒险" : selectedChar ? "以此角色开始" : "直接开始"}
        </button>
      </div>

      {/* Step indicator */}
      <div style={{ textAlign: "center", marginTop: 24, fontSize: 13, color: "var(--seed-muted)", letterSpacing: "0.08em", fontWeight: 500 }}>
        3 <span style={{ opacity: 0.4 }}>/ 3</span>
      </div>

      {/* 创建自定义角色弹窗（portal 到 body，避免 onboarding-step 动画 transform 使 fixed 定位失效；补主题类防止 CSS 变量回落暗色默认值） */}
      {showCreate &&
        createPortal(
          <div
            className={effTheme === "light" ? "theme-light" : "theme-dark"}
            style={{
              position: "fixed", inset: 0, zIndex: 300, background: "var(--seed-overlay)",
              display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
            }}
            onClick={() => { if (!createBusy) setShowCreate(false); }}
          >
            <div
              className="glass-modal"
              style={{ width: "100%", maxWidth: 460, maxHeight: "86vh", overflowY: "auto", borderRadius: 20, padding: 26 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
                <div style={{ fontSize: 19, fontWeight: 700, color: "var(--seed-fg)" }}>创建自定义角色</div>
                <button
                  onClick={() => setShowCreate(false)}
                  style={{ background: "none", border: "none", cursor: "pointer", color: "var(--seed-muted)", fontSize: 20, lineHeight: 1, padding: 4 }}
                  aria-label="关闭"
                >✕</button>
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
                      width: "100%", boxSizing: "border-box", padding: "9px 12px", borderRadius: 10,
                      background: "var(--seed-input-bg)", border: "1px solid var(--seed-border)",
                      color: "var(--seed-fg)", fontSize: 13, fontFamily: "inherit", outline: "none", resize: "vertical",
                    }}
                  />
                </div>
              ))}

              {createError && (
                <div style={{ fontSize: 12, color: "var(--seed-danger, #e5484d)", marginBottom: 10 }}>{createError}</div>
              )}

              <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 6 }}>
                <button
                  className="seed-btn-ghost"
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
