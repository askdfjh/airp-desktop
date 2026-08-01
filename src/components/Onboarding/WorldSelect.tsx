import { useState } from "react";
import { useUIStore } from "@/stores/uiStore";
import { useWorldStore } from "@/stores/worldStore";

// 预设世界 → 内置世界书 id 映射（没有内置书的世界不注入任何条目）
export const WORLD_BOOK_MAP: Record<string, string> = {
  cultivation: "wb-builtin-xianxia",
  infinite: "wb-builtin-infinite",
  palace: "wb-builtin-palace",
};

export const PRESET_WORLDS = [
  {
    id: "cultivation",
    name: "修仙 / 仙侠",
    desc: "踏入仙途，问道长生",
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
    id: "palace",
    name: "宫廷古装",
    desc: "深宫如棋，步步为营",
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
    id: "scifi",
    name: "科幻星际",
    desc: "星辰大海，征途无垠",
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
];

export function WorldSelect({ onRandomStart }: { onRandomStart?: () => void }) {
  const { setSelectedWorld, setOnboardingStep } = useUIStore();
  const [selected, setSelected] = useState<string | null>(null);
  const books = useWorldStore((s) => s.books);
  const setActiveBook = useWorldStore((s) => s.setActiveBook);
  const deactivateAllBooks = useWorldStore((s) => s.deactivateAllBooks);

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
          AIRP
        </div>
        <h1 style={{ fontSize: 40, fontWeight: 700, letterSpacing: "-0.02em", color: "var(--seed-fg)", marginBottom: 12, lineHeight: 1.2 }}>
          选择你的世界
        </h1>
        <p style={{ fontSize: 16, color: "var(--seed-muted)", maxWidth: 400, margin: "0 auto" }}>
          每一个世界都有独特的规则与命运，选择你想要踏入的领域，开始你的角色扮演之旅
        </p>
      </div>

      {/* Preset world grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 280px)", gap: 20, justifyContent: "center", marginBottom: 20 }}>
        {PRESET_WORLDS.map((world) => (
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

      {/* 随机开局 + 自定义世界入口（贴合设计稿 bottom-row） */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 280px)", gap: 20, justifyContent: "center" }}>
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
          className="seed-card seed-card--custom"
          onClick={() => useUIStore.getState().setSettingsOpen(true)}
          style={{
            border: "1px dashed color-mix(in srgb, var(--seed-fg) 12%, transparent)",
            background: "transparent",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            minHeight: 164,
            textAlign: "center",
          }}
        >
          <div style={{
            width: 44, height: 44, borderRadius: "50%",
            border: "1px dashed color-mix(in srgb, var(--seed-fg) 15%, transparent)",
            display: "flex", alignItems: "center", justifyContent: "center",
            marginBottom: 12, color: "var(--seed-muted)",
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </div>
          <div style={{ fontSize: 14, fontWeight: 500, color: "var(--seed-muted)" }}>自定义世界</div>
          <div style={{ fontSize: 12, color: "var(--seed-muted)", opacity: 0.6, marginTop: 4 }}>创建属于你的独特世界</div>
        </div>
      </div>

      {books.length > 0 && (
        <div style={{ marginTop: 32 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--seed-muted)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
            </svg>
            我的世界书
            <div style={{ flex: 1, height: 1, background: "var(--seed-border)", marginLeft: 8 }} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 280px)", gap: 16, justifyContent: "center" }}>
            {books.map((book) => (
              <div
                key={book.id}
                className={`seed-card ${selected === book.id ? "seed-card--selected" : ""}`}
                onClick={() => handleSelect(book.theme || book.id, book.name)}
                style={{ padding: "20px 18px" }}
              >
                <div className="seed-card-check">
                  <svg viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12" /></svg>
                </div>
                <div className="seed-card-title" style={{ fontSize: 15 }}>{book.name}</div>
                {book.description && <div className="seed-card-desc" style={{ fontSize: 13 }}>{book.description}</div>}
                {book.tags.length > 0 && (
                  <div style={{ display: "flex", gap: 4, marginTop: 8, flexWrap: "wrap" }}>
                    {book.tags.slice(0, 3).map((tag) => (
                      <span key={tag} style={{ fontSize: 11, padding: "2px 8px", borderRadius: 999, background: "var(--seed-hover-bg)", color: "var(--seed-muted)" }}>{tag}</span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
