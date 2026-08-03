import { useState } from "react";
import { useUIStore } from "@/stores/uiStore";
import { useWorldStore } from "@/stores/worldStore";

// 预设世界 → 内置世界书 id 映射（没有内置书的世界不注入任何条目）
export const WORLD_BOOK_MAP: Record<string, string> = {
  cultivation: "wb-builtin-xianxia",
  infinite: "wb-builtin-infinite",
  palace: "wb-builtin-palace",
  folklore: "wb-builtin-folklore",
  rulehorror: "wb-builtin-rulehorror",
  zhaidou: "wb-builtin-zhaidou",
  retro: "wb-builtin-retro",
  romance: "wb-builtin-romance",
  entertainment: "wb-builtin-entertainment",
};

export const PRESET_WORLDS = [
  {
    id: "cultivation",
    name: "修仙 / 仙侠",
    desc: "踏入仙途，问道长生",
    gender: "male" as const,
    color: "#d4af55",
    glow: "rgba(212,175,85,0.15)",
    icon: (
      <svg viewBox="0 0 24 24">
        <path d="M14.5 2l-5 9h3l-2 7 7-10h-3.5L17 2z" />
        <path d="M3 21l5-8 3 4 4-6 5 10" />
      </svg>
    ),
  },
  {
    id: "fantasy",
    name: "东方玄幻",
    desc: "万族林立，强者为尊",
    gender: "male" as const,
    color: "#a064e6",
    glow: "rgba(160,100,230,0.15)",
    icon: (
      <svg viewBox="0 0 24 24">
        <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="12" cy="12" r="1.5" />
      </svg>
    ),
  },
  {
    id: "urban",
    name: "都市异能",
    desc: "霓虹之下，暗流涌动",
    gender: "male" as const,
    color: "#e69632",
    glow: "rgba(230,150,50,0.15)",
    icon: (
      <svg viewBox="0 0 24 24">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
      </svg>
    ),
  },
  {
    id: "infinite",
    name: "无限流",
    desc: "副本轮回，生死博弈",
    gender: "male" as const,
    color: "#3cc878",
    glow: "rgba(60,200,120,0.15)",
    icon: (
      <svg viewBox="0 0 24 24">
        <path d="M18.178 8c5.096 0 5.096 8 0 8-3.742 0-5.907-4-9.315-4-3.328 0-3.328 4 0 4 2.424 0 4.089-2.2 5.5-3.7" />
        <path d="M5.822 16c-5.096 0-5.096-8 0-8 3.742 0 5.907 4 9.315 4 3.328 0 3.328-4 0-4-2.424 0-4.089 2.2-5.5 3.7" />
      </svg>
    ),
  },
  {
    id: "scifi",
    name: "科幻星际",
    desc: "星辰大海，征途无垠",
    gender: "male" as const,
    color: "#32bee6",
    glow: "rgba(50,190,230,0.15)",
    icon: (
      <svg viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="5" />
        <path d="M3 12c2-4 7-6 12-4" />
        <path d="M21 12c-2 4-7 6-12 4" />
        <ellipse cx="12" cy="12" rx="10" ry="3.5" transform="rotate(-20 12 12)" />
      </svg>
    ),
  },
  {
    id: "folklore",
    name: "民俗悬疑",
    desc: "江河湖海，诡事频生",
    gender: "male" as const,
    color: "#8b5a2b",
    glow: "rgba(139,90,43,0.15)",
    icon: (
      <svg viewBox="0 0 24 24">
        <path d="M12 3a9 9 0 109 9" />
        <path d="M12 8a4 4 0 100 8" />
        <path d="M2 12h4M18 12h4" />
        <path d="M3 6c3-1 6-1 9 0M21 6c-3-1-6-1-9 0" />
      </svg>
    ),
  },
  {
    id: "rulehorror",
    name: "规则怪谈",
    desc: "遵守规则，才能活下去",
    gender: "male" as const,
    color: "#c0392b",
    glow: "rgba(192,57,43,0.15)",
    icon: (
      <svg viewBox="0 0 24 24">
        <polygon points="12 2 22 21 2 21 12 2" />
        <line x1="12" y1="9" x2="12" y2="14" />
        <circle cx="12" cy="17.5" r="0.5" />
      </svg>
    ),
  },
  {
    id: "palace",
    name: "宫廷古装",
    desc: "深宫如棋，步步为营",
    gender: "female" as const,
    color: "#c83c46",
    glow: "rgba(200,60,70,0.15)",
    icon: (
      <svg viewBox="0 0 24 24">
        <path d="M2 17h20l-2-10-4 4-4-7-4 7-4-4z" />
        <path d="M4 17v2a1 1 0 001 1h14a1 1 0 001-1v-2" />
        <circle cx="12" cy="4" r="1" />
      </svg>
    ),
  },
  {
    id: "zhaidou",
    name: "古言宅斗",
    desc: "宅门深深，步步惊心",
    gender: "female" as const,
    color: "#7d8ba6",
    glow: "rgba(125,139,166,0.15)",
    icon: (
      <svg viewBox="0 0 24 24">
        <path d="M3 21h18" />
        <path d="M5 21V8l7-5 7 5v13" />
        <path d="M9 21v-6h6v6" />
        <path d="M9 12h6" />
      </svg>
    ),
  },
  {
    id: "retro",
    name: "重生年代",
    desc: "重回往昔，改写命运",
    gender: "female" as const,
    color: "#b8860b",
    glow: "rgba(184,134,11,0.15)",
    icon: (
      <svg viewBox="0 0 24 24">
        <path d="M3 12a9 9 0 109-9 9.75 9.75 0 00-6.74 2.74L3 8" />
        <path d="M3 3v5h5" />
        <path d="M12 7v5l3 2" />
      </svg>
    ),
  },
  {
    id: "romance",
    name: "现代言情",
    desc: "都市烟火，心动时刻",
    gender: "female" as const,
    color: "#ec6ba8",
    glow: "rgba(236,107,168,0.15)",
    icon: (
      <svg viewBox="0 0 24 24">
        <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
      </svg>
    ),
  },
  {
    id: "entertainment",
    name: "娱乐圈",
    desc: "聚光灯下，星光璀璨",
    gender: "female" as const,
    color: "#d4a017",
    glow: "rgba(212,160,23,0.15)",
    icon: (
      <svg viewBox="0 0 24 24">
        <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" />
        <path d="M19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9z" />
      </svg>
    ),
  },
];

export function WorldSelect({ onRandomStart }: { onRandomStart?: () => void }) {
  const { setSelectedWorld, setOnboardingStep } = useUIStore();
  const [selected, setSelected] = useState<string | null>(null);
  const [gender, setGender] = useState<"male" | "female">("male");
  const [showCustom, setShowCustom] = useState(false);
  const books = useWorldStore((s) => s.books);
  const setActiveBook = useWorldStore((s) => s.setActiveBook);
  const deactivateAllBooks = useWorldStore((s) => s.deactivateAllBooks);

  const customBooks = books.filter((b) => !b.isBuiltin);
  const filteredWorlds = PRESET_WORLDS.filter((w) => w.gender === gender);

  const handleSelect = async (id: string, name: string) => {
    setSelected(id);
    setSelectedWorld(id, name);
    // 同步激活对应的世界书：仅激活当前选中的世界，避免上一本书的条目继续注入
    const bookId = WORLD_BOOK_MAP[id] || books.find((b) => b.id === id || b.theme === id)?.id;
    if (bookId) {
      await setActiveBook(bookId);
    } else {
      await deactivateAllBooks();
    }
    setTimeout(() => {
      setOnboardingStep(2);
    }, 800);
  };

  return (
    <div>
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 52 }}>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "6px 16px",
            background: "var(--seed-accent-bg)",
            border: "1px solid color-mix(in srgb, var(--seed-accent) 15%, transparent)",
            borderRadius: 999,
            fontSize: 12,
            fontWeight: 500,
            color: "var(--seed-accent)",
            letterSpacing: "0.05em",
            textTransform: "uppercase",
            marginBottom: 24,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" />
          </svg>
          灵叙 Narra
        </div>
        <h1 style={{ fontSize: 40, fontWeight: 700, letterSpacing: "-0.02em", color: "var(--seed-fg)", marginBottom: 12, lineHeight: 1.2 }}>
          选择你的世界
        </h1>
        <p style={{ fontSize: 16, color: "var(--seed-muted)", maxWidth: 400, margin: "0 auto" }}>
          每一个世界都有独特的规则与命运，选择你想要踏入的领域，开始你的角色扮演之旅
        </p>
      </div>

      {/* 男频 / 女频 分组 tab */}
      <div style={{ display: "flex", justifyContent: "center", gap: 10, marginBottom: 28 }}>
        {([
          { key: "male", label: "男频", icon: <path d="M14.5 2l-5 9h3l-2 7 7-10h-3.5L17 2z" /> },
          { key: "female", label: "女频", icon: <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" /> },
        ] as const).map((t) => {
          const active = gender === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setGender(t.key)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "9px 26px",
                borderRadius: 999,
                fontSize: 13.5,
                fontWeight: 500,
                fontFamily: "inherit",
                cursor: "pointer",
                background: active ? "var(--seed-accent-bg)" : "transparent",
                color: active ? "var(--seed-accent)" : "var(--seed-muted)",
                border: active ? "1px solid color-mix(in srgb, var(--seed-accent) 40%, transparent)" : "1px solid var(--seed-border)",
                transition: "all 0.15s",
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{t.icon}</svg>
              {t.label}
              <span style={{ fontSize: 11, opacity: 0.75 }}>{PRESET_WORLDS.filter((w) => w.gender === t.key).length}</span>
            </button>
          );
        })}
      </div>

      {/* Preset world grid */}
      <div data-onboarding-grid style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 20, justifyContent: "center", marginBottom: 20, maxWidth: 900, marginLeft: "auto", marginRight: "auto", width: "100%" }}>
        {filteredWorlds.map((world) => (
          <div
            key={world.id}
            className={`seed-card ${selected === world.id ? "seed-card--selected" : ""}`}
            onClick={() => handleSelect(world.id, world.name)}
            style={{
              "--card-glow": world.glow,
              boxShadow: selected === world.id
                ? `0 0 0 1px var(--seed-accent), 0 8px 32px -8px var(--seed-accent-glow)`
                : undefined,
            } as React.CSSProperties}
          >
            <div className="seed-card-check">
              <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12" /></svg>
            </div>
            <div className="seed-card-icon" style={{ color: world.color, background: `color-mix(in srgb, ${world.color} 10%, transparent)` }}>
              {world.icon}
            </div>
            <div className="seed-card-title">{world.name}</div>
            <div className="seed-card-desc">{world.desc}</div>
          </div>
        ))}
      </div>

      {/* 我的世界：自定义世界书列表 */}
      {showCustom && (
        <div style={{ margin: "8px 0 24px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginBottom: 18 }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: "var(--seed-fg)" }}>我的世界</span>
            <button
              onClick={() => useUIStore.getState().setCreateMode("world")}
              style={{
                display: "flex", alignItems: "center", gap: 5, padding: "6px 14px", borderRadius: 999,
                border: "1px solid color-mix(in srgb, var(--seed-accent) 40%, transparent)",
                background: "var(--seed-accent-bg)", color: "var(--seed-accent)",
                fontSize: 12, fontWeight: 500, fontFamily: "inherit", cursor: "pointer",
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              AI 创建世界
            </button>
            <button
              onClick={() => setShowCustom(false)}
              style={{
                display: "flex", alignItems: "center", gap: 5, padding: "6px 14px", borderRadius: 999,
                border: "1px solid var(--seed-border)", background: "transparent", color: "var(--seed-muted)",
                fontSize: 12, fontWeight: 500, fontFamily: "inherit", cursor: "pointer",
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
              退出
            </button>
          </div>
          {customBooks.length === 0 ? (
            <div style={{
              textAlign: "center", padding: "30px 0", borderRadius: 14,
              border: "1px dashed var(--seed-border)", color: "var(--seed-muted)", fontSize: 13,
            }}>
              还没有自定义世界，点击「AI 创建世界」生成一个
            </div>
          ) : (
            <div data-onboarding-grid style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 20, justifyContent: "center", maxWidth: 900, margin: "0 auto", width: "100%" }}>
              {customBooks.map((b) => (
                <div
                  key={b.id}
                  className={`seed-card ${selected === b.id ? "seed-card--selected" : ""}`}
                  onClick={() => handleSelect(b.id, b.name)}
                  style={{ cursor: "pointer" }}
                >
                  <div className="seed-card-check">
                    <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12" /></svg>
                  </div>
                  <div className="seed-card-icon" style={{ color: "var(--seed-accent)", background: "color-mix(in srgb, var(--seed-accent) 10%, transparent)" }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
                      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
                    </svg>
                  </div>
                  <div className="seed-card-title">{b.name}</div>
                  <div className="seed-card-desc">{b.description || b.theme || "暂无描述"}</div>
                  <div style={{ marginTop: 10, fontSize: 11, color: "var(--seed-muted)" }}>
                    {b.entries.length} 条条目 · {b.theme || "自定义主题"}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 随机开局 + 自定义世界入口（贴合设计稿 bottom-row） */}
      <div data-onboarding-grid style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 20, justifyContent: "center", maxWidth: 900, marginLeft: "auto", marginRight: "auto", width: "100%" }}>
        <div
          className="seed-card seed-card--custom"
          onClick={onRandomStart}
          style={{
            border: "1px solid color-mix(in srgb, var(--seed-accent) 30%, transparent)",
            background: "color-mix(in srgb, var(--seed-accent) 8%, transparent)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            minHeight: 164,
            textAlign: "center",
            cursor: "pointer",
          }}
        >
          <div style={{
            width: 44, height: 44, borderRadius: "50%",
            background: "color-mix(in srgb, var(--seed-accent) 15%, transparent)",
            border: "1px solid color-mix(in srgb, var(--seed-accent) 25%, transparent)",
            display: "flex", alignItems: "center", justifyContent: "center",
            marginBottom: 12, color: "var(--seed-accent)",
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="4" />
              <path d="M8 12l2 2 6-6" />
            </svg>
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--seed-fg)" }}>随机开局</div>
          <div style={{ fontSize: 12, color: "var(--seed-muted)", marginTop: 4 }}>世界 / 视角 / 角色 / 场景全部随机</div>
        </div>
        <div
          className={`seed-card seed-card--custom ${showCustom ? "seed-card--selected" : ""}`}
          onClick={() => setShowCustom((v) => !v)}
          style={{
            border: showCustom
              ? "1px solid color-mix(in srgb, var(--seed-accent) 40%, transparent)"
              : "1px dashed color-mix(in srgb, var(--seed-fg) 12%, transparent)",
            background: showCustom ? "color-mix(in srgb, var(--seed-accent) 6%, transparent)" : "transparent",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            minHeight: 164,
            textAlign: "center",
            cursor: "pointer",
          }}
        >
          <div style={{
            width: 44, height: 44, borderRadius: "50%",
            border: "1px dashed color-mix(in srgb, var(--seed-fg) 15%, transparent)",
            display: "flex", alignItems: "center", justifyContent: "center",
            marginBottom: 12, color: showCustom ? "var(--seed-accent)" : "var(--seed-muted)",
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </div>
          <div style={{ fontSize: 14, fontWeight: 500, color: showCustom ? "var(--seed-accent)" : "var(--seed-muted)" }}>自定义世界</div>
          <div style={{ fontSize: 12, color: "var(--seed-muted)", opacity: 0.7, marginTop: 4 }}>
            {customBooks.length > 0 ? `${customBooks.length} 个已创建的世界` : "创建属于你的独特世界"}
          </div>
        </div>
      </div>
    </div>
  );
}
