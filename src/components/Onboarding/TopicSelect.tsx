import { useEffect, useRef, useState } from "react";
import { getTropeById } from "@/lib/popularTropes";
import { getTopicSchemesByAudience, type TopicScheme } from "@/lib/topicSchemes";
import { getWorldFoundation, worldFoundationLabel } from "@/lib/worldFoundations";
import { useUIStore } from "@/stores/uiStore";
import { useWorldStore } from "@/stores/worldStore";
import { pickMainEntries } from "./onboardingHelpers";
import type { WorldAudienceFilter } from "@/lib/worldAudience";

export function TopicSelect() {
  const {
    setOnboardingStep,
    setSelectedWorld,
    setSelectedTopicScheme,
    setSelectedTrope,
    setSelectedMainEntry,
    setSelectedScenario,
    setSelectedStylePreset,
    setSelectedMode,
    setSelectedCharacter,
    setPlayerName,
    setOnboardingAudience,
  } = useUIStore();
  const books = useWorldStore((s) => s.books);
  const setActiveBook = useWorldStore((s) => s.setActiveBook);
  const deactivateAllBooks = useWorldStore((s) => s.deactivateAllBooks);
  const [selected, setSelected] = useState<string | null>(null);
  const [selectedBase, setSelectedBase] = useState<string | null>(null);
  const [labelLock, setLabelLock] = useState(false);
  const [contracted, setContracted] = useState(false);
  const [gridMaxH, setGridMaxH] = useState<string>("6000px");
  const [gridOverflow, setGridOverflow] = useState<"visible" | "hidden">("visible");
  const selectedCardRef = useRef<HTMLDivElement | null>(null);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const contractTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [audienceFilter, setAudienceFilter] = useState<WorldAudienceFilter>("all");
  const topics = getTopicSchemesByAudience(audienceFilter);

  // 选中卡片直接排序到网格第一位（点击即排位，取消时保持不弹回）
  const sortedTopics = selected ? [topics.find((t) => t.id === selected)!, ...topics.filter((t) => t.id !== selected)] : topics;

  // 标签锁定：其他卡片淡出（collapsed），淡出完成后网格收缩（contracted），选中卡始终在第一位
  const prevLockRef = useRef(false);
  useEffect(() => {
    const ob = document.querySelector(".seed-onboarding");
    const wasLocked = prevLockRef.current;
    prevLockRef.current = !!labelLock;
    if (labelLock && contracted && selectedCardRef.current) {
      setGridOverflow("hidden");
      // 布局高 + 顶部 padding 8 + 底部 26px 阴影余量
      const h = selectedCardRef.current.offsetHeight + 34;
      requestAnimationFrame(() => setGridMaxH(`${h}px`));
      ob?.scrollTo({ top: 0, behavior: "smooth" });
    } else if (labelLock && !contracted) {
      setGridOverflow("hidden");
    } else if (gridRef.current) {
      setGridOverflow("visible");
      const h = gridRef.current.scrollHeight;
      requestAnimationFrame(() => setGridMaxH(`${h}px`));
      // 仅从锁定状态恢复时才滚回顶部；点卡片主体（未锁定）不改变滚动位置
      if (wasLocked) ob?.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, [labelLock, contracted, selected]);

  const chooseTopic = async (topic: TopicScheme, baseId?: string) => {
    const worldBaseId = baseId && (topic.expandableWorldBaseIds as string[]).includes(baseId) ? baseId : topic.worldBaseId;
    setSelected(topic.id);
    setSelectedBase(worldBaseId);
    setOnboardingAudience(audienceFilter);
    const foundation = getWorldFoundation(worldBaseId);
    const bookId = foundation.builtinBookId || books.find((b) => b.id === worldBaseId || b.theme === worldBaseId)?.id;
    const selectedBook = bookId ? books.find((b) => b.id === bookId) || null : null;
    const mainEntry = pickMainEntries(selectedBook)[0] || null;

    setSelectedTopicScheme(topic.id, topic.label);
    setSelectedTrope(topic.tropeId, topic.label);
    setSelectedWorld(worldBaseId, foundation.label);
    setSelectedMainEntry(mainEntry?.id ?? null, mainEntry?.title ?? null);
    setSelectedScenario(null, null);
    setSelectedStylePreset(null, null);
    setSelectedMode(null);
    setSelectedCharacter(null, null);
    setPlayerName("");

    if (bookId) {
      await setActiveBook(bookId);
    } else {
      await deactivateAllBooks();
    }
  };

  const pickBase = (topic: TopicScheme, baseId: string) => {
    // 再点同一标签 → 取消锁定：展开全部卡片，选中卡保持在第一位（不弹回）
    if (selected === topic.id && labelLock && selectedBase === baseId) {
      if (contractTimerRef.current) clearTimeout(contractTimerRef.current);
      setContracted(false);
      setLabelLock(false);
      return;
    }
    if (contractTimerRef.current) clearTimeout(contractTimerRef.current);
    if (selected === topic.id && labelLock) {
      // 锁定中切换底座：保持锁定，仅更新底座
      void chooseTopic(topic, baseId);
      return;
    }
    // 锁定：选中卡排序到第一位（立即），其他卡片淡出，淡出完成后（460ms）网格收缩
    setContracted(false);
    setLabelLock(true);
    void chooseTopic(topic, baseId);
    contractTimerRef.current = setTimeout(() => setContracted(true), 460);
  };

  const randomTopic = () => {
    const pool = topics.length > 0 ? topics : getTopicSchemesByAudience("all");
    const topic = pool[Math.floor(Math.random() * pool.length)];
    if (contractTimerRef.current) clearTimeout(contractTimerRef.current);
    setContracted(false);
    setLabelLock(false);
    if (topic) void chooseTopic(topic);
  };

  const confirmTopic = () => {
    if (selected) setOnboardingStep(2);
  };

  const selectedTopic = selected ? topics.find((t) => t.id === selected) || null : null;

  return (
    <div>
      <div style={{ textAlign: "center", marginBottom: 42 }}>
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
          灵叙 Narra
        </div>
        <h1 style={{ fontSize: 40, fontWeight: 700, letterSpacing: "-0.02em", color: "var(--seed-fg)", marginBottom: 12, lineHeight: 1.2 }}>
          选择你想玩的题材
        </h1>
        <p style={{ fontSize: 16, color: "var(--seed-muted)", maxWidth: 520, margin: "0 auto" }}>
          先选题材，系统会自动匹配世界与基础规则。
        </p>
      </div>

      <div style={{ display: "flex", justifyContent: "center", gap: 10, marginBottom: 26 }}>
        {([
          { key: "all", label: "全部" },
          { key: "male", label: "男频" },
          { key: "female", label: "女频" },
        ] as const).map((tab) => {
          const active = audienceFilter === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setAudienceFilter(tab.key)}
              style={{
                padding: "9px 24px",
                borderRadius: 999,
                fontSize: 13.5,
                fontWeight: 500,
                fontFamily: "inherit",
                cursor: "pointer",
                background: active ? "var(--seed-accent-bg)" : "transparent",
                color: active ? "var(--seed-accent)" : "var(--seed-muted)",
                border: active ? "1px solid color-mix(in srgb, var(--seed-accent) 40%, transparent)" : "1px solid var(--seed-border)",
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div ref={gridRef} data-onboarding-grid style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 16, maxHeight: gridMaxH, overflow: gridOverflow, transition: "max-height 0.5s ease", paddingTop: labelLock ? 8 : 0, paddingBottom: labelLock ? 26 : 0, paddingLeft: labelLock ? 4 : 0, paddingRight: labelLock ? 4 : 0, marginTop: labelLock ? -8 : 0, marginLeft: labelLock ? -4 : 0, marginRight: labelLock ? -4 : 0 }}>
        {!selected && (
          <div
            className={`seed-card seed-card--custom ${labelLock ? "seed-card--collapsed" : ""}`}
            onClick={randomTopic}
            style={{
              padding: "22px 20px",
              cursor: "pointer",
              border: "1px dashed color-mix(in srgb, var(--seed-accent) 45%, transparent)",
              background: "color-mix(in srgb, var(--seed-accent) 6%, transparent)",
            }}
          >
            <div className="seed-card-title" style={{ marginBottom: 8 }}>随机题材</div>
            <div className="seed-card-desc">
              {audienceFilter === "all" ? "从全部题材里随机" : audienceFilter === "male" ? "只从男频题材里随机" : "只从女频题材里随机"}
            </div>
          </div>
        )}

        {sortedTopics.map((topic) => {
          const trope = getTropeById(topic.tropeId);
          const baseOptions = [topic.worldBaseId, ...topic.expandableWorldBaseIds];
          const isSelectedCard = selected === topic.id;
          const hidden = labelLock && !isSelectedCard;
          return (
            <div
              key={topic.id}
              ref={isSelectedCard ? selectedCardRef : undefined}
              className={`seed-card ${isSelectedCard ? "seed-card--selected" : ""} ${hidden ? "seed-card--collapsed" : ""} ${labelLock && isSelectedCard ? "seed-card--locked" : ""}`}
              onClick={() => {
                if (contractTimerRef.current) clearTimeout(contractTimerRef.current);
                setContracted(false);
                setLabelLock(false);
                void chooseTopic(topic);
              }}
              style={{ padding: "22px 20px", cursor: "pointer" }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
                <div className="seed-card-title">{topic.label}</div>
                <span style={{ fontSize: 11, color: "var(--seed-muted)" }}>
                  {audienceFilter === "all" ? trope?.category : audienceFilter === "male" ? "男频" : "女频"}
                </span>
              </div>
              <div className="seed-card-desc" style={{ marginBottom: 12 }}>{topic.description}</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {baseOptions.map((baseId) => {
                  const isSelected = isSelectedCard && selectedBase === baseId;
                  return (
                    <button
                      key={baseId}
                      onClick={(e) => {
                        e.stopPropagation();
                        pickBase(topic, baseId);
                      }}
                      style={{
                        fontSize: 12,
                        padding: "8px 14px",
                        borderRadius: 999,
                        cursor: "pointer",
                        fontFamily: "inherit",
                        lineHeight: 1.2,
                        minHeight: 32,
                        background: isSelected ? "var(--seed-accent-bg)" : "var(--seed-hover-bg)",
                        border: isSelected
                          ? "1px solid color-mix(in srgb, var(--seed-accent) 55%, transparent)"
                          : "1px solid var(--seed-border)",
                        color: isSelected ? "var(--seed-accent)" : "var(--seed-muted)",
                        fontWeight: isSelected ? 600 : 400,
                        transition: "all 0.2s",
                      }}
                    >
                      {worldFoundationLabel(baseId)}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}

        {selected && (
          <div
            className={`seed-card seed-card--custom ${labelLock ? "seed-card--collapsed" : ""}`}
            onClick={randomTopic}
            style={{
              padding: "22px 20px",
              cursor: "pointer",
              border: "1px dashed color-mix(in srgb, var(--seed-accent) 45%, transparent)",
              background: "color-mix(in srgb, var(--seed-accent) 6%, transparent)",
            }}
          >
            <div className="seed-card-title" style={{ marginBottom: 8 }}>随机题材</div>
            <div className="seed-card-desc">
              {audienceFilter === "all" ? "从全部题材里随机" : audienceFilter === "male" ? "只从男频题材里随机" : "只从女频题材里随机"}
            </div>
          </div>
        )}
      </div>

      <div style={{ textAlign: "center", marginTop: 28 }}>
        {selectedTopic ? (
          <button
            className="seed-cta"
            onClick={confirmTopic}
            style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ width: 15, height: 15 }}>
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
            </svg>
            开始 · {selectedTopic.label}（{worldFoundationLabel(selectedBase)}）
          </button>
        ) : (
          <div style={{ fontSize: 13, color: "var(--seed-muted)", letterSpacing: "0.08em", fontWeight: 500 }}>
            1 <span style={{ opacity: 0.4 }}>/ 3</span>
          </div>
        )}
      </div>
    </div>
  );
}
