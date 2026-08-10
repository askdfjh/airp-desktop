import { useUIStore } from "@/stores/uiStore";
import { useProviderStore } from "@/stores/providerStore";
import { Shield, TrendingUp, Sparkles, Eye, Shuffle } from "lucide-react";

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!on)}
      style={{
        width: 44, height: 24, borderRadius: 12, border: "none", padding: 0, cursor: "pointer",
        flexShrink: 0, background: on ? "var(--seed-accent)" : "var(--seed-border)",
        position: "relative", transition: "background 0.2s ease",
      }}
      aria-pressed={on}
    >
      <div style={{ position: "absolute", top: 2, left: on ? "calc(100% - 22px)" : "2px", width: 20, height: 20, borderRadius: "50%", background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.2)", transition: "left 0.2s ease" }} />
    </button>
  );
}

export function PluginsPanel() {
  const formatModel = useUIStore((s) => s.formatModel);
  const setFormatModel = useUIStore((s) => s.setFormatModel);
  const narrativeGuardOn = useUIStore((s) => s.narrativeGuardOn);
  const setNarrativeGuardOn = useUIStore((s) => s.setNarrativeGuardOn);
  const progressionGuardOn = useUIStore((s) => s.progressionGuardOn);
  const setProgressionGuardOn = useUIStore((s) => s.setProgressionGuardOn);
  const hiddenProgressOn = useUIStore((s) => s.hiddenProgressOn);
  const setHiddenProgressOn = useUIStore((s) => s.setHiddenProgressOn);
  const randomWorldEventOn = useUIStore((s) => s.randomWorldEventOn);
  const setRandomWorldEventOn = useUIStore((s) => s.setRandomWorldEventOn);
  const providers = useProviderStore((s) => s.providers);
  const enabledProviders = useProviderStore((s) => s.enabledProviders);

  const card: React.CSSProperties = { padding: 18, borderRadius: 18, background: "var(--seed-surface)", border: "1px solid var(--seed-border)" };
  const headRow: React.CSSProperties = { display: "flex", alignItems: "center", gap: 12, marginBottom: 8 };

  return (
    <div style={{ maxWidth: 640, width: "100%", display: "flex", flexDirection: "column", gap: 16, flex: 1, minHeight: 0, overflowY: "auto", margin: "0 auto" }}>
      {/* 叙事防护 */}
      <div style={card}>
        <div style={headRow}>
          <div style={{ width: 40, height: 40, borderRadius: "50%", background: "var(--seed-accent-bg)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Shield size={18} style={{ color: "var(--seed-accent)" }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: "var(--fs-14)", fontWeight: 600, color: "var(--seed-fg)" }}>叙事防护</div>
            <div style={{ fontSize: "var(--fs-11)", color: "var(--seed-muted)", marginTop: 2 }}>防止剧情只剩男女主二人互动、角色接连登场让玩家疲于辨认</div>
          </div>
          <Toggle on={narrativeGuardOn} onChange={setNarrativeGuardOn} />
        </div>
        {narrativeGuardOn && (
          <div style={{ fontSize: "var(--fs-11)", color: "var(--seed-muted)", lineHeight: 1.6, padding: "10px 12px", borderRadius: 12, background: "var(--seed-hover-bg)", border: "1px solid var(--seed-border)" }}>
            开启后注入以下约束：① 剧情必须有外部世界参与（其他 NPC、势力、环境事件），严禁全篇只有男女主角两人互动；② 角色入场节制——每段最多引入 1 个新角色、同时活跃主要角色不超过 3-4 个，优先深化已出场角色，龙套用完即退场；③ 主角（用户角色）是叙事中心与视角锚点。
          </div>
        )}
      </div>

      {/* 剧情推进 */}
      <div style={card}>
        <div style={headRow}>
          <div style={{ width: 40, height: 40, borderRadius: "50%", background: "var(--seed-accent-bg)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <TrendingUp size={18} style={{ color: "var(--seed-accent)" }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: "var(--fs-14)", fontWeight: 600, color: "var(--seed-fg)" }}>剧情推进</div>
            <div style={{ fontSize: "var(--fs-11)", color: "var(--seed-muted)", marginTop: 2 }}>防止剧情原地打转、两人循环拉扯、空泛收尾</div>
          </div>
          <Toggle on={progressionGuardOn} onChange={setProgressionGuardOn} />
        </div>
        {progressionGuardOn && (
          <div style={{ fontSize: "var(--fs-11)", color: "var(--seed-muted)", lineHeight: 1.6, padding: "10px 12px", borderRadius: 12, background: "var(--seed-hover-bg)", border: "1px solid var(--seed-border)" }}>
            开启后注入以下约束：① 每段回复必须推进至少一个剧情要素（新事件/新信息/冲突升级/关系变化/场景转移/情感转折）；② 严禁重复已写过的场景、对话与心理描写，不得用"接下来怎么办"式空泛收尾；③ 结尾留下具体可继续的行动、选择或悬念。
          </div>
        )}
      </div>

      {/* 角色后台进展 */}
      <div style={card}>
        <div style={headRow}>
          <div style={{ width: 40, height: 40, borderRadius: "50%", background: "var(--seed-accent-bg)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Eye size={18} style={{ color: "var(--seed-accent)" }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: "var(--fs-14)", fontWeight: 600, color: "var(--seed-fg)" }}>角色后台进展</div>
            <div style={{ fontSize: "var(--fs-11)", color: "var(--seed-muted)", marginTop: 2 }}>其他主要角色的幕后动向（玩家不可见），防止角色原地待机</div>
          </div>
          <Toggle on={hiddenProgressOn} onChange={setHiddenProgressOn} />
        </div>
        {hiddenProgressOn && (
          <div style={{ fontSize: "var(--fs-11)", color: "var(--seed-muted)", lineHeight: 1.6, padding: "10px 12px", borderRadius: 12, background: "var(--seed-hover-bg)", border: "1px solid var(--seed-border)" }}>
            AI 每次为其他主要角色生成一句话幕后进展（如：二皇子暗中拉拢朝臣、林夫人在查账房旧账），正文中不显示，但会注入下一轮生成上下文——角色下次出场带着新状态，不会"原地待机"等主角。依赖「场景与推荐执行模型」开启（关闭格式分析时本项失效）。
          </div>
        )}
      </div>

      {/* 随机世界事件 */}
      <div style={card}>
        <div style={headRow}>
          <div style={{ width: 40, height: 40, borderRadius: "50%", background: "var(--seed-accent-bg)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Shuffle size={18} style={{ color: "var(--seed-accent)" }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: "var(--fs-14)", fontWeight: 600, color: "var(--seed-fg)" }}>随机世界事件</div>
            <div style={{ fontSize: "var(--fs-11)", color: "var(--seed-muted)", marginTop: 2 }}>规则书中的设定（灵物、遗迹等）按节奏随机进入剧情，制造意外与惊喜（默认关闭）</div>
          </div>
          <Toggle on={randomWorldEventOn} onChange={setRandomWorldEventOn} />
        </div>
        {randomWorldEventOn && (
          <div style={{ fontSize: "var(--fs-11)", color: "var(--seed-muted)", lineHeight: 1.6, padding: "10px 12px", borderRadius: 12, background: "var(--seed-hover-bg)", border: "1px solid var(--seed-border)" }}>
            开启后：每经过 4 条用户消息尝试一次，从规则书中随机抽取一条设定注入剧情（自然引出作为新进展、转折或悬念，不强行出现）；抽中后冷却 4 轮，未抽中则 4 轮后重新尝试；同一会话内不重复抽取同一设定。已常驻与关键词命中的条目不受影响。
          </div>
        )}
      </div>

      {/* 场景与推荐执行模型 */}
      <div style={card}>
        <div style={headRow}>
          <div style={{ width: 40, height: 40, borderRadius: "50%", background: "var(--seed-accent-bg)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Sparkles size={18} style={{ color: "var(--seed-accent)" }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: "var(--fs-14)", fontWeight: 600, color: "var(--seed-fg)" }}>场景与推荐执行模型</div>
            <div style={{ fontSize: "var(--fs-11)", color: "var(--seed-muted)", marginTop: 2 }}>章节名、场景信息与对话推荐由独立请求生成，建议用快速模型（如 Flash 系列）</div>
          </div>
        </div>
        <div style={{ fontSize: "var(--fs-11)", color: "var(--seed-muted)", lineHeight: 1.6, marginBottom: 12 }}>
          正文由对话所用模型单独输出；此处的模型负责生成章节名、场景信息与对话推荐。关闭后场景条与推荐条隐藏，章节名固定为第一章。
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: formatModel.mode === "custom" ? 12 : 0 }}>
          {([
            { key: "follow" as const, label: "跟随当前模型" },
            { key: "custom" as const, label: "指定模型" },
            { key: "off" as const, label: "关闭" },
          ]).map((opt) => (
            <button
              key={opt.key}
              onClick={() => {
                if (opt.key === "custom" && !formatModel.providerId) {
                  const first = providers.find((p) => enabledProviders[p.id] !== false);
                  setFormatModel({ mode: "custom", providerId: first?.id ?? providers[0]?.id, model: first?.models?.[0] ?? "" });
                } else {
                  setFormatModel({ ...formatModel, mode: opt.key });
                }
              }}
              style={{
                padding: "7px 14px", borderRadius: 999, fontSize: 12, fontWeight: 500, cursor: "pointer", fontFamily: "inherit",
                background: formatModel.mode === opt.key ? "var(--seed-accent-bg)" : "var(--seed-input-bg)",
                color: formatModel.mode === opt.key ? "var(--seed-accent)" : "var(--seed-muted)",
                border: "1px solid " + (formatModel.mode === opt.key ? "var(--seed-accent-border)" : "var(--seed-border)"),
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
        {formatModel.mode === "custom" && (
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <select
              value={formatModel.providerId ?? ""}
              onChange={(e) => {
                const p = providers.find((pp) => pp.id === e.target.value);
                setFormatModel({ mode: "custom", providerId: p?.id, model: p?.models?.[0] ?? "" });
              }}
              style={{ padding: "7px 10px", borderRadius: 10, fontSize: 12, fontFamily: "inherit", color: "var(--seed-fg)", background: "var(--seed-input-bg)", border: "1px solid var(--seed-border)", outline: "none" }}
            >
              <option value="" disabled>选择模型服务</option>
              {providers.filter((p) => enabledProviders[p.id] !== false || p.id === formatModel.providerId).map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <select
              value={formatModel.model ?? ""}
              onChange={(e) => setFormatModel({ mode: "custom", providerId: formatModel.providerId, model: e.target.value })}
              style={{ padding: "7px 10px", borderRadius: 10, fontSize: 12, fontFamily: "inherit", color: "var(--seed-fg)", background: "var(--seed-input-bg)", border: "1px solid var(--seed-border)", outline: "none" }}
            >
              <option value="" disabled>选择模型</option>
              {providers.find((p) => p.id === formatModel.providerId)?.models.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
        )}
      </div>
    </div>
  );
}
