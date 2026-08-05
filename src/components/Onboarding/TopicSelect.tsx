import { useEffect, useLayoutEffect, useRef, useState } from "react";
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
  const [sorted, setSorted] = useState(false);
  const [sortedTopicId, setSortedTopicId] = useState<string | null>(null);
  const [contracted, setContracted] = useState(false);
  const [hideOthers, setHideOthers] = useState(false);
  const [gridMaxH, setGridMaxH] = useState<string>("6000px");
  const [gridOverflow, setGridOverflow] = useState<"visible" | "hidden">("visible");
  const selectedCardRef = useRef<HTMLDivElement | null>(null);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const contractTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flipPosRef = useRef<{ x: number; y: number } | null>(null);
  const [audienceFilter, setAudienceFilter] = useState<WorldAudienceFilter>("all");
  const topics = getTopicSchemesByAudience(audienceFilter);

  // 仅在点标签（锁定）后排序：排序列表跟随 sortedTopicId（点卡片主体只改高亮，不改排序，避免跳回原位）
  // 随机题材卡始终固定渲染在网格第一位
  const sortedTopics = sorted && sortedTopicId
    ? (() => {
        const sel = topics.find((t) => t.id === sortedTopicId);
        return sel ? [sel, ...topics.filter((t) => t.id !== sortedTopicId)] : topics;
      })()
    : topics;

  // FLIP：DOM 排序重排后，先把选中卡瞬间位移回旧位置（无过渡），
  // 淡出完成后（contracted）再平滑滑动到新位置（第一行第二列，随机卡旁）
  useLayoutEffect(() => {
    if (sorted && labelLock && selectedCardRef.current && flipPosRef.current) {
      const card = selectedCardRef.current;
      const r = card.getBoundingClientRect();
      // 防御：布局未就绪（rect 为 0/异常，如安卓 WebView 初始视口）或位移异常时跳过 FLIP，
      // 卡片直接定位，避免被推离可视区导致"缩小成圆角矩形"
      if (r.width <= 0 || r.height <= 0 || !Number.isFinite(r.left) || !Number.isFinite(r.top)) {
        flipPosRef.current = null;
        return;
      }
      const dx = flipPosRef.current.x - r.left;
      const dy = flipPosRef.current.y - r.top;
      if (!Number.isFinite(dx) || !Number.isFinite(dy) || Math.abs(dx) > 5000 || Math.abs(dy) > 5000) {
        flipPosRef.current = null;
        return;
      }
      card.style.transition = "none";
      card.style.transform = `translate(${dx}px, ${dy}px)`;
      flipPosRef.current = null;
      void card.offsetWidth; // 强制回流，确保初始位移立即生效
    }
  }, [sorted, labelLock, sortedTopicId]);

  // 收缩时：选中卡平滑滑到新位置（与网格收缩同步）
  useEffect(() => {
    if (contracted && selectedCardRef.current) {
      const card = selectedCardRef.current;
      card.style.transition = "transform 0.5s cubic-bezier(0.22, 1, 0.36, 1)";
      card.style.transform = "translate(0px, 0px)";
    }
  }, [contracted]);

  // 清理所有卡片的 transform/transition/opacity inline 残留（防重叠与空白残留）
  const clearCardTransforms = () => {
    gridRef.current?.querySelectorAll(".seed-card").forEach((c) => {
      const el = c as HTMLElement;
      el.style.transform = "";
      el.style.transition = "";
      el.style.opacity = "";
    });
  };

  // 标签锁定：其他卡片淡出（collapsed），淡出完成后网格收缩（contracted），选中卡滑动归位
  const prevLockRef = useRef(false);
  useEffect(() => {
    const ob = document.querySelector(".seed-onboarding");
    const wasLocked = prevLockRef.current;
    prevLockRef.current = !!labelLock;
    if (labelLock && contracted && selectedCardRef.current && gridRef.current) {
      setGridOverflow("hidden");
      // 高度 = 实际行数 × 卡高（随机卡+选中卡：多列同行 1 行；单列上下 2 行）+ gap + 上下余量。
      // 避免单列布局下 grid 行被 maxHeight 压缩成细条
      const cardH = selectedCardRef.current.offsetHeight;
      const gridW = gridRef.current.clientWidth;
      const cols = Math.max(1, Math.floor((gridW + 16) / 236));
      const rows = cols > 1 ? 1 : 2;
      const h = Math.max(Number.isFinite(cardH) ? cardH : 120, 120) * rows + (rows > 1 ? 16 : 0) + 34;
      setGridMaxH(`${h}px`);
      // 瞬间滚回顶部（与收缩动画同步执行，避免 smooth 滚动与 maxHeight 过渡竞争导致底部截断）
      ob?.scrollTo({ top: 0 });
    } else if (labelLock && !contracted) {
      setGridOverflow("hidden");
    } else if (gridRef.current) {
      setGridOverflow("visible");
      // 展开：直接移除 max-height 限制（瞬时，避免 max-height 过渡中间值小于内容高度导致 grid 行被压缩成细条）
      setGridMaxH("none");
      // 展开时清理所有 inline 残留（切换标签时旧卡被手动置 0 的 opacity 需恢复，避免空白格）
      clearCardTransforms();
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
    // 再点同一标签 → 取消锁定：展开全部卡片，选中卡保持排序位置（不弹回）
    if (selected === topic.id && labelLock && selectedBase === baseId) {
      if (contractTimerRef.current) clearTimeout(contractTimerRef.current);
      setContracted(false);
      setHideOthers(false);
      setLabelLock(false);
      // 若滑动动画未完成（transform 位移残留），平滑归零到 DOM 位置
      if (selectedCardRef.current) {
        const card = selectedCardRef.current;
        card.style.transition = "transform 0.5s cubic-bezier(0.22, 1, 0.36, 1)";
        card.style.transform = "translate(0px, 0px)";
      }
      return;
    }
    if (contractTimerRef.current) clearTimeout(contractTimerRef.current);
    if (selected === topic.id && labelLock) {
      // 锁定中切换底座：保持锁定，仅更新底座
      void chooseTopic(topic, baseId);
      return;
    }
    // 锁定/切换卡片：清理旧卡 transform 残留 → 记录被点卡片旧位置 → 排序到随机题材卡之后的第一位（DOM 重排）→ FLIP 平滑滑动归位
    const wasLocked = labelLock;
    clearCardTransforms();
    if (wasLocked && selected) {
      // 锁定中切到其他卡：旧选中卡立即隐藏（避免与滑动中的新卡重叠）
      const oldCard = gridRef.current?.querySelector(`[data-topic="${selected}"]`) as HTMLElement | null;
      if (oldCard) {
        oldCard.style.transition = "none";
        oldCard.style.opacity = "0";
      }
    }
    const cardEl = gridRef.current?.querySelector(`[data-topic="${topic.id}"]`) as HTMLElement | null;
    if (cardEl) {
      const r = cardEl.getBoundingClientRect();
      flipPosRef.current = { x: r.left, y: r.top };
    }
    setContracted(false);
    setHideOthers(false);
    setSorted(true);
    setSortedTopicId(topic.id);
    setLabelLock(true);
    void chooseTopic(topic, baseId);
    if (wasLocked) {
      // 切换卡片：下一帧直接收缩 + 移除其他卡 + 新卡滑动（旧卡已瞬隐，无需等待淡出）
      requestAnimationFrame(() => {
        setContracted(true);
        setHideOthers(true);
      });
    } else {
      // 锁定：先淡出其他卡（0.45s），完成后移除其他卡并收缩（避免单列布局下 grid 行被 maxHeight 压缩）
      contractTimerRef.current = setTimeout(() => {
        setContracted(true);
        setHideOthers(true);
      }, 460);
    }
  };

  const randomTopic = () => {
    const pool = topics.length > 0 ? topics : getTopicSchemesByAudience("all");
    const topic = pool[Math.floor(Math.random() * pool.length)];
    if (contractTimerRef.current) clearTimeout(contractTimerRef.current);
    setContracted(false);
    setHideOthers(false);
    setSorted(false);
    setSortedTopicId(null);
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
              onClick={() => {
                // 切换频道 tab：重置锁定/排序/选中/隐藏状态（不同频道的题材列表不同，避免排序引用失效与卡片被过滤）
                if (contractTimerRef.current) clearTimeout(contractTimerRef.current);
                setContracted(false);
                setHideOthers(false);
                setSorted(false);
                setSortedTopicId(null);
                setLabelLock(false);
                setSelected(null);
                setSelectedBase(null);
                clearCardTransforms();
                setGridMaxH("6000px");
                setAudienceFilter(tab.key);
              }}
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

      <div ref={gridRef} data-onboarding-grid style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 16, maxHeight: gridMaxH, overflow: gridOverflow, transition: "max-height 0.5s ease", alignContent: labelLock ? "start" : undefined, paddingTop: labelLock ? 8 : 0, paddingBottom: labelLock ? 26 : 0, paddingLeft: labelLock ? 4 : 0, paddingRight: labelLock ? 4 : 0, marginTop: labelLock ? -8 : 0, marginLeft: labelLock ? -4 : 0, marginRight: labelLock ? -4 : 0 }}>
        {/* 随机题材卡固定第一位，锁定收缩时保持可见（与选中卡同行） */}
        <div
          className="seed-card seed-card--custom"
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

        {sortedTopics.map((topic) => {
          // 淡出完成后移除其他卡（网格只剩随机卡+选中卡一行，避免单列布局下 grid 行被 maxHeight 压缩）
          if (hideOthers && selected !== topic.id) return null;
          const trope = getTropeById(topic.tropeId);
          const baseOptions = [topic.worldBaseId, ...topic.expandableWorldBaseIds];
          const isSelectedCard = selected === topic.id;
          const hidden = labelLock && !isSelectedCard;
          return (
            <div
              key={topic.id}
              data-topic={topic.id}
              ref={isSelectedCard ? selectedCardRef : undefined}
              className={`seed-card ${isSelectedCard ? "seed-card--selected" : ""} ${hidden ? "seed-card--collapsed" : ""} ${labelLock && isSelectedCard ? "seed-card--locked" : ""}`}
              onClick={() => {
                if (contractTimerRef.current) clearTimeout(contractTimerRef.current);
                setContracted(false);
                setHideOthers(false);
                // 单底座题材（无其他标签）：点击主体即选择（走锁定流程）
                if (topic.expandableWorldBaseIds.length === 0) {
                  pickBase(topic, topic.worldBaseId);
                  return;
                }
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
