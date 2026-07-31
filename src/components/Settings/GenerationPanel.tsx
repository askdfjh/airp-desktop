import { useState } from "react";
import { useGenerationStore } from "@/stores/generationStore";
import { useUIStore } from "@/stores/uiStore";
import { RotateCcw } from "lucide-react";
import type { GenerationPreset } from "@/types";

const BUILTIN_DEFAULTS: GenerationPreset[] = [
  {
    id: "balanced", name: "平衡叙事", description: "稳定与创意的均衡点，适合日常角色扮演与剧情推进",
    temperature: 0.9, topP: 0.95, topK: 40, minP: 0.05,
    presencePenalty: 0, frequencyPenalty: 0.3, maxTokens: 0,
    outputStyle: "每次回复约 100-200 字，以生动的场景描写与人物对话推进故事，保持角色设定一致。",
    isBuiltin: true,
  },
  {
    id: "stable", name: "稳定输出", description: "低随机性，回答精准一致，适合问答、设定解释与逻辑推理",
    temperature: 0.6, topP: 0.9, topK: 20, minP: 0.1,
    presencePenalty: 0, frequencyPenalty: 0.5, maxTokens: 0,
    outputStyle: "回答准确、结构清晰、直奔主题，避免冗余铺垫。",
    isBuiltin: true,
  },
  {
    id: "creative", name: "创意迸发", description: "高随机性，天马行空的展开，适合奇遇、脑洞与反套路剧情",
    temperature: 1.3, topP: 0.98, topK: 80, minP: 0.02,
    presencePenalty: 0.3, frequencyPenalty: 0.2, maxTokens: 0,
    outputStyle: "大胆发挥想象力，制造意外转折与新颖设定，文风自由奔放，每次回复约 150-300 字。",
    isBuiltin: true,
  },
  {
    id: "roleplay", name: "沉浸扮演", description: "以角色为本的输出，强化代入感与情绪张力",
    temperature: 1.0, topP: 0.95, topK: 50, minP: 0.05,
    presencePenalty: 0.1, frequencyPenalty: 0.25, maxTokens: 0,
    outputStyle: "始终以角色身份回应，用行动、神态与内心活动代替干瘪叙述，对话自然口语化，每次回复约 80-200 字。",
    isBuiltin: true,
  },
  {
    id: "longform", name: "长篇叙事", description: "低温度高连贯性，适合长篇小说式多段连载输出",
    temperature: 0.85, topP: 0.92, topK: 30, minP: 0.05,
    presencePenalty: 0, frequencyPenalty: 0.4, maxTokens: 0,
    outputStyle: "以小说笔法分段续写，场景、动作、对话、心理层层递进，结尾留出钩子便于继续，每次回复 200-400 字。",
    isBuiltin: true,
  },
  {
    id: "player-control", name: "玩家视角 · 行动对话自主", description: "第一人称沉浸：行动与对话完全由玩家掌控，AI 只反馈世界与 NPC",
    temperature: 0.9, topP: 0.95, topK: 40, minP: 0.05,
    presencePenalty: 0.1, frequencyPenalty: 0.3, maxTokens: 0,
    outputStyle: `玩家视角执行准则 (Player-Centric V1.0)

核心：你是这个世界的导演与NPC，不是玩家的代言人。玩家的行动与对话完全由玩家自己决定，你绝对禁止代写玩家的言行。

一、角色分工 (Division)
- 你负责：环境、场景、NPC的行为与回应、事件后果、世界的因果反馈。
- 玩家负责：玩家角色的行动、对话、心理与选择。你绝不替玩家做决定、说台词或描述玩家角色的内心。
- 玩家的输入即玩家角色的行动或话语，你只回应世界给出的反馈。

二、第一人称沉浸 (First-Person)
- 叙述用「你」称呼玩家角色，NPC 之间用名字互相称呼。
- 所见即所得：玩家只能通过感官获得信息（视觉、听觉、嗅觉、触觉），NPC 绝不读取玩家的心理活动或隐私。

三、回应原则 (Feedback)
- 每次回复聚焦玩家当前行动的直接后果：环境如何反应、NPC 如何回应、世界发生了什么变化。
- 行动有代价：合理的行动有合理的后果，危险的行为有明确的风险反馈。
- 玩家行动信息不足时，可提出询问补充，绝不替玩家补全行动。

四、叙事技法 (Narration)
- 客观白描：描述可观测的动作、神态、环境，禁止替玩家抒情或心理描写。
- 简练推进：每回合聚焦一个主要反馈点，避免长篇铺陈挤压玩家的行动空间。
- 保留选择权：NPC 可以提议、挑战、拒绝，但绝不代替玩家作选择。

五、底线 (Red Line)
- 绝对禁止控制玩家角色的言行与心理。
- 玩家说「我转身离开」，就描述他离开的场景，而不是替他回头。`,
    isBuiltin: true,
  },
];

const SLIDER_STYLE: React.CSSProperties = {
  flex: 1,
  height: 20,
  cursor: "pointer",
};

function ParamSlider({
  label, value, min, max, step, onChange, format,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
}) {
  const fillPct = max > min ? ((value - min) / (max - min)) * 100 : 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <span style={{ width: 96, flexShrink: 0, fontSize: 12, color: "var(--seed-muted)" }}>{label}</span>
      <input
        type="range"
        className="seed-slider"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ ...SLIDER_STYLE, ["--fill" as string]: `${fillPct}%` } as React.CSSProperties}
      />
      <span style={{ width: 52, flexShrink: 0, textAlign: "right", fontSize: 12, fontWeight: 600, color: "var(--seed-fg)", fontVariantNumeric: "tabular-nums" }}>
        {format ? format(value) : value}
      </span>
    </div>
  );
}

export function GenerationPanel() {
  const { presets, activePresetId, setActivePreset, upsertPreset, removePreset } = useGenerationStore();
  const notify = useUIStore((s) => s.notify);
  const active = presets.find((p) => p.id === activePresetId) || presets[0];
  const [draft, setDraft] = useState<GenerationPreset | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const editing = draft ?? active;

  const patch = (fields: Partial<GenerationPreset>) => {
    const next = { ...editing, ...fields };
    setDraft(next);
    upsertPreset(next);
  };

  const handleSelect = (id: string) => {
    setDraft(null);
    if (activePresetId === id) {
      setActivePreset("none");
    } else {
      setActivePreset(id);
    }
  };

  const handleResetBuiltin = (p: GenerationPreset) => {
    const def = BUILTIN_DEFAULTS.find((d) => d.id === p.id);
    if (!def) return;
    upsertPreset(def);
    setDraft(null);
    notify("已恢复默认参数");
  };

  const handleCreate = () => {
    const name = newName.trim();
    if (!name) return;
    const preset: GenerationPreset = {
      ...editing,
      id: "custom-" + Date.now(),
      name,
      isBuiltin: false,
    };
    upsertPreset(preset);
    setActivePreset(preset.id);
    setDraft(null);
    setShowNew(false);
    setNewName("");
    notify("自定义预设已创建");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, paddingBottom: 32 }}>
      {/* 预设卡片列表 */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))", gap: 12 }}>
        {presets.map((p) => (
          <div
            key={p.id}
            onClick={() => handleSelect(p.id)}
            style={{
              position: "relative",
              padding: "14px 16px",
              borderRadius: 16,
              cursor: "pointer",
              background: p.id === activePresetId ? "var(--seed-accent-bg)" : "var(--seed-surface)",
              border: "1px solid " + (p.id === activePresetId ? "var(--seed-accent-border)" : "var(--seed-border)"),
              boxShadow: p.id === activePresetId ? "inset 3px 0 0 0 var(--seed-accent)" : "none",
              transition: "all 0.12s ease",
              display: "flex",
              flexDirection: "column",
              gap: 4,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: "var(--seed-fg)" }}>{p.name}</span>
              {p.isBuiltin && (
                <span className="seed-tag-pill" style={{ fontSize: 10, padding: "1px 7px", background: "var(--seed-accent-bg)", color: "var(--seed-accent)" }}>内置</span>
              )}
              {p.id === activePresetId && (
                <svg style={{ marginLeft: "auto" }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--seed-accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </div>
            <div style={{ fontSize: 12, lineHeight: 1.5, color: "var(--seed-muted)" }}>{p.description}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
              <span className="seed-tag-pill">温度 {p.temperature}</span>
              <span className="seed-tag-pill">Top P {p.topP}</span>
              <span className="seed-tag-pill">重复惩罚 {p.frequencyPenalty}</span>
            </div>
          </div>
        ))}

        {/* 新建自定义预设 */}
        <div
          onClick={() => { setShowNew(!showNew); }}
          style={{
            padding: "14px 16px",
            borderRadius: 16,
            cursor: "pointer",
            border: "1px dashed color-mix(in srgb, var(--seed-fg) 15%, transparent)",
            background: "transparent",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            color: "var(--seed-muted)",
            fontSize: 13,
          }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          从当前参数创建预设
        </div>
      </div>

      {showNew && (
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="预设名称，如：我的小说流"
            autoFocus
            style={{
              flex: 1,
              padding: "8px 14px",
              borderRadius: 12,
              fontSize: 13,
              color: "var(--seed-fg)",
              background: "var(--seed-input-bg)",
              border: "1px solid var(--seed-border)",
              outline: "none",
            }}
            onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }}
          />
          <button className="seed-btn-primary" onClick={handleCreate} disabled={!newName.trim()} style={{ padding: "8px 18px", fontSize: 13 }}>
            创建
          </button>
        </div>
      )}

      {/* 参数编辑区 */}
      {editing && (
        <div className="seed-settings-card" style={{ padding: "20px 22px", display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 15, fontWeight: 600, color: "var(--seed-fg)" }}>{editing.name}</span>
            {editing.isBuiltin && (
              <span className="seed-tag-pill" style={{ fontSize: 10, padding: "1px 7px", background: "var(--seed-accent-bg)", color: "var(--seed-accent)" }}>内置</span>
            )}
            {!editing.isBuiltin && (
              <button
                className="seed-btn-secondary"
                onClick={() => { removePreset(editing.id); setDraft(null); }}
                style={{ marginLeft: "auto", padding: "4px 10px", fontSize: 11, color: "var(--danger, #ef4444)" }}
              >
                删除
              </button>
            )}
            {editing.isBuiltin && (
              <button
                className="seed-btn-secondary"
                onClick={() => handleResetBuiltin(editing)}
                style={{ marginLeft: "auto", padding: "4px 10px", fontSize: 11, display: "inline-flex", alignItems: "center", gap: 4 }}
              >
                <RotateCcw size={11} /> 恢复默认
              </button>
            )}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <ParamSlider label="温度 Temperature" value={editing.temperature} min={0} max={2} step={0.05} onChange={(v) => patch({ temperature: v })} format={(v) => v.toFixed(2)} />
            <ParamSlider label="核采样 Top P" value={editing.topP} min={0} max={1} step={0.01} onChange={(v) => patch({ topP: v })} format={(v) => v.toFixed(2)} />
            <ParamSlider label="Top K" value={editing.topK} min={0} max={200} step={1} onChange={(v) => patch({ topK: v })} format={(v) => (v === 0 ? "关" : String(v))} />
            <ParamSlider label="最小概率 Min P" value={editing.minP} min={0} max={1} step={0.01} onChange={(v) => patch({ minP: v })} format={(v) => v.toFixed(2)} />
            <ParamSlider label="存在惩罚" value={editing.presencePenalty} min={-2} max={2} step={0.1} onChange={(v) => patch({ presencePenalty: v })} format={(v) => (v === 0 ? "0" : v.toFixed(1))} />
            <ParamSlider label="频率惩罚" value={editing.frequencyPenalty} min={-2} max={2} step={0.1} onChange={(v) => patch({ frequencyPenalty: v })} format={(v) => (v === 0 ? "0" : v.toFixed(1))} />
            <ParamSlider label="最大输出" value={editing.maxTokens} min={0} max={8000} step={100} onChange={(v) => patch({ maxTokens: v })} format={(v) => (v === 0 ? "自动" : String(v))} />
          </div>

          <div>
            <div style={{ fontSize: 12, color: "var(--seed-muted)", marginBottom: 6 }}>输出风格指令（注入 system prompt，指导 AI 的输出格式）</div>
            <textarea
              value={editing.outputStyle}
              onChange={(e) => patch({ outputStyle: e.target.value })}
              rows={3}
              placeholder="如：每次回复约 100-200 字，以小说笔法分段续写..."
              style={{
                width: "100%",
                padding: "10px 14px",
                borderRadius: 12,
                fontSize: 13,
                lineHeight: 1.6,
                color: "var(--seed-fg)",
                background: "var(--seed-input-bg)",
                border: "1px solid var(--seed-border)",
                outline: "none",
                resize: "vertical",
              }}
            />
          </div>

          <div style={{ fontSize: 12, color: "var(--seed-muted)" }}>
            修改即时保存并应用于当前对话，无需额外确认。
          </div>
        </div>
      )}

      {/* 说明 */}
      <div style={{ fontSize: 12, color: "var(--seed-muted)", lineHeight: 1.7, textAlign: "center" }}>
        采样参数仅对支持的模型生效；输出风格指令对所有模型生效。部分服务商（如 DeepSeek Reasoner）会忽略部分采样参数。
      </div>
    </div>
  );
}
