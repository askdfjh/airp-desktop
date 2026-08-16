import { useUIStore } from "@/stores/uiStore";
import { useSessionStore } from "@/stores/sessionStore";
import { useProviderStore } from "@/stores/providerStore";
import { useOnboardingStore } from "@/stores/onboardingStore";
import { useWorldStore } from "@/stores/worldStore";
import { useCharacterStore } from "@/stores/characterStore";
import { useGenerationStore } from "@/stores/generationStore";
import { PRESET_WORLDS, WORLD_BOOK_MAP } from "./WorldSelect";
import { getWorldOpeningScenario } from "@/lib/worldOpeningScenarios";
import { buildHotTropeHint, buildTropeOpeningDirective, buildTropeSystemPrompt } from "@/lib/popularTropes";
import { getTopicOpeningScenario, getTopicOpeningScenarios } from "@/lib/topicOpenings";
import { getCustomBookOpeningScenario } from "@/lib/worldOpeningScenarios";
import { getTopicScheme, getTopicSchemesByAudience } from "@/lib/topicSchemes";
import { getWorldFoundation } from "@/lib/worldFoundations";
import { inferWorldBase } from "@/lib/worldBaseMatch";
import { TopicSelect } from "./TopicSelect";
import { StyleModeSelect } from "./StyleModeSelect";
import { ProtagonistSelect } from "./ProtagonistSelect";
import { pickMainEntries, worldviewIdForBase } from "./onboardingHelpers";
import {
  buildProtagonistPrompt,
  defaultPlayerNameForAudience,
  inferWorldBookAudience,
  type WorldAudience,
  type WorldAudienceFilter,
} from "@/lib/worldAudience";

export function OnboardingFlow({ onExit }: { onExit?: () => void }) {
  const { onboardingStep, setAppPhase, resetOnboarding, setPendingOpeningMessage, setOnboardingStep } = useUIStore();
  const addSession = useSessionStore((s) => s.add);
  const setActive = useSessionStore((s) => s.setActive);
  const activeProviderId = useProviderStore((s) => s.activeProviderId);
  const activeModel = useProviderStore((s) => s.activeModel);
  const buildSystemPrompt = useOnboardingStore((s) => s.buildSystemPrompt);
  const buildOpeningMessage = useOnboardingStore((s) => s.buildOpeningMessage);
  const buildModePrompt = useOnboardingStore((s) => s.buildModePrompt);
  const buildAIOpeningMessage = useOnboardingStore((s) => s.buildAIOpeningMessage);

  const handleComplete = async () => {
    // 必须从 getState() 读最新值：handleRandomStart 直接写 store 后同步调用本函数，
    // 组件订阅的 hook 值仍是旧快照
    const ui = useUIStore.getState();
    const selectedCharacterId = ui.selectedCharacterId;
    const selectedCharacterName = ui.selectedCharacterName;
    const selectedScenarioId = ui.selectedScenarioId;
    const selectedTopicSchemeId = ui.selectedTopicSchemeId;
    const selectedMode = ui.selectedMode;
    const selectedTropeId = ui.selectedTropeId;
    const selectedMainEntryId = ui.selectedMainEntryId;
    const selectedMainEntryName = ui.selectedMainEntryName;
    const selectedStylePresetName = ui.selectedStylePresetName;
    const selectedWorldName = ui.selectedWorldName;
    const selectedWorldId = ui.selectedWorldId;
    const worldState = useWorldStore.getState();
    // 规则书激活推迟到这里（最后一步点"开始冒险"才执行）：中途退出开局流程不改变任何世界状态。
    // 规则书解析：默认底座用题材书（优先）→ 底座书兜底；切到扩展底座时用该底座书
    const foundation = getWorldFoundation(selectedWorldId);
    const topic = getTopicScheme(ui.selectedTopicSchemeId);
    const baseBookId = foundation.builtinBookId;
    const resolvedBookId =
      (selectedWorldId === topic?.worldBaseId ? topic?.worldBookId ?? baseBookId : baseBookId) ||
      worldState.books.find((b) => b.id === selectedWorldId || b.theme === selectedWorldId)?.id ||
      null;
    const selectedBook = resolvedBookId ? worldState.books.find((b) => b.id === resolvedBookId) || null : null;
    const selectedPresetWorld = PRESET_WORLDS.find((w) => w.id === selectedWorldId);
    const isCustomBook = !!selectedBook && !selectedBook.isBuiltin;
    // 世界观 id：优先从规则书 id 反查 WORLD_BOOK_MAP（题材书/底座书均命中真实世界观），再兜底底座；
    // 自定义规则书走 AI 匹配的底座 → 底座映射世界观
    const worldviewId =
      (resolvedBookId ? Object.entries(WORLD_BOOK_MAP).find(([, v]) => v === resolvedBookId)?.[0] : undefined) ||
      selectedPresetWorld?.id ||
      (isCustomBook ? worldviewIdForBase(inferWorldBase(selectedBook)) : undefined) ||
      selectedBook?.theme ||
      worldviewIdForBase(selectedWorldId) ||
      selectedWorldId ||
      "custom";
    const selectedAudience: WorldAudience | null =
      ui.onboardingAudience === "male" || ui.onboardingAudience === "female"
        ? ui.onboardingAudience
        : selectedPresetWorld?.gender ?? (selectedBook ? inferWorldBookAudience(selectedBook) : null);
    const selectedScenario = selectedScenarioId
      ? getTopicOpeningScenario(selectedTopicSchemeId, selectedScenarioId, selectedWorldId, ui.onboardingAudience) ||
        useOnboardingStore.getState().getScenarioById(selectedScenarioId) ||
        getWorldOpeningScenario(selectedBook, selectedScenarioId) ||
        getCustomBookOpeningScenario(selectedBook, selectedScenarioId)
      : undefined;
    const selectedMainEntry = selectedMainEntryId
      ? selectedBook?.entries.find((e) => e.id === selectedMainEntryId || e.title === selectedMainEntryName)
      : null;
    // 主角名：第 3 步输入 > 所选角色名 > 兜底「主角」
    const typedPlayerName = (ui.playerName || "").trim();
    const playerName = typedPlayerName || selectedCharacterName || defaultPlayerNameForAudience(selectedAudience);
    // 允许无角色/无场景/无模式直接开始：未选时用空 systemPrompt
    const isAIOpening = selectedScenarioId === "ai-random";
    const hasFullSetup = selectedCharacterId && selectedScenarioId && selectedMode;
    // AI 随机开局：不注入预设场景模板，只带叙事规则，开局由 AI 即兴生成
    const modePrompt = buildModePrompt(selectedMode || "novel");
    const protagonistPrompt = buildProtagonistPrompt({
      playerName,
      typedName: !!typedPlayerName || !!selectedCharacterName,
      audience: selectedAudience,
    });
    const tropePrompt = selectedTropeId
      ? buildTropeSystemPrompt({
          tropeId: selectedTropeId,
          worldviewId,
        })
      : isAIOpening
        ? buildHotTropeHint({
            audience: selectedAudience,
            worldName: selectedWorldName || "未知世界",
            worldviewId,
          })
        : "";
    const mainEntryPrompt = selectedMainEntry
      ? `【基础规则块·世界层】本次开局优先围绕「${selectedMainEntry.title}」展开。该条目仅定义世界基础规则与舞台，不要把它误当成题材；若与题材规则冲突，以题材规则为准。条目内容：${selectedMainEntry.content}`
      : selectedMainEntryName
        ? `【基础规则块·世界层】本次开局优先围绕「${selectedMainEntryName}」展开。该条目仅定义世界基础规则与舞台；若与题材规则冲突，以题材规则为准。`
        : "";
    const stylePrompt = selectedStylePresetName
      ? `【风格修饰】整体气质参考「${selectedStylePresetName}」，但不得覆盖世界规则、基础规则块和题材引擎。`
      : "";
    const systemPrompt = isAIOpening
      ? [mainEntryPrompt, modePrompt, protagonistPrompt, tropePrompt, stylePrompt].filter(Boolean).join("\n\n")
      : selectedScenario && selectedMode
        ? selectedScenario.systemPromptTemplate.replace("{characterName}", playerName) +
          (mainEntryPrompt ? "\n\n" + mainEntryPrompt : "") +
          (modePrompt ? "\n\n" + modePrompt : "") +
          "\n\n" + protagonistPrompt +
          (tropePrompt ? "\n\n" + tropePrompt : "") +
          (stylePrompt ? "\n\n" + stylePrompt : "")
      : hasFullSetup
        ? buildSystemPrompt(
            selectedScenarioId,
            playerName,
            selectedMode
          )
        : "";
    // 开局开场消息：选中开局场景时，按场景设定自动发送给 AI 作为第一条消息
    const mainEntryOpeningDirective = selectedMainEntryName
      ? `\n\n【基础规则块】第一幕优先从「${selectedMainEntryName}」切入。`
      : "";
    const styleOpeningDirective = selectedStylePresetName
      ? `\n\n【风格】以「${selectedStylePresetName}」作为气质修饰。`
      : "";
    const tropeOpeningDirective = buildTropeOpeningDirective({ tropeId: selectedTropeId, worldviewId });
    const openingMessage = isAIOpening
      ? buildAIOpeningMessage(selectedWorldName || "未知世界", playerName, selectedMode || "novel", selectedAudience, selectedTropeId, worldviewId)
        + mainEntryOpeningDirective + styleOpeningDirective
      : selectedScenario
        ? selectedScenario.openingMessage.replace("{characterName}", playerName) + mainEntryOpeningDirective + tropeOpeningDirective + styleOpeningDirective
      : selectedScenarioId
        ? buildOpeningMessage(selectedScenarioId, playerName) + mainEntryOpeningDirective + tropeOpeningDirective + styleOpeningDirective
        : "";

    const now = Date.now();
    const storyId = crypto.randomUUID();
    const session = {
      id: crypto.randomUUID(),
      title: playerName ? playerName + "的冒险" : "新冒险",
      systemPrompt,
      providerId: activeProviderId || "",
      model: activeModel || "",
      thinkingEnabled: false,
      kind: "adventure" as const,
      createdAt: now,
      updatedAt: now,
      storyId,
      chainId: storyId,
      chainIndex: 1,
    };

    const { insertStory } = await import("@/lib/db");
    const { useStoryStore } = await import("@/stores/storyStore");
    const { useGenerationStore } = await import("@/stores/generationStore");
    const story = {
      id: storyId,
      title: session.title,
      kind: "adventure" as const,
      status: "writing" as const,
      cover: null,
      groupId: "writing",
      pinned: false,
      worldBookId: resolvedBookId,
      generationPresetId: useGenerationStore.getState().activePresetId,
      protagonistName: playerName,
      topicSchemeId: selectedTopicSchemeId,
      worldBaseId: selectedWorldId,
      synopsis: "",
      tags: [],
      lastOpenedAt: now,
      lastVolumeId: session.id,
      wordCount: 0,
      createdAt: now,
      updatedAt: now,
    };
    await insertStory(story);
    useStoryStore.getState().addStory(story);

    if (resolvedBookId) {
      await worldState.setActiveBook(resolvedBookId);
    } else {
      await worldState.deactivateAllBooks();
    }

    addSession(session);
    setActive(session.id);
    resetOnboarding();
    setAppPhase("reading");
    if (openingMessage) {
      setPendingOpeningMessage(openingMessage);
    }
  };

  const handleExitOrBack = () => {
    if (onboardingStep > 1) {
      setOnboardingStep((onboardingStep - 1) as any);
      return;
    }
    onExit?.();
  };

  const handleRandomStart = async (filter: WorldAudienceFilter = "all") => {
    const worldStore = useWorldStore.getState();
    const books = worldStore.books;
    const topicPool = getTopicSchemesByAudience(filter);
    const topic = topicPool[Math.floor(Math.random() * topicPool.length)];
    if (!topic) return;

    const basePool = [topic.worldBaseId, ...topic.expandableWorldBaseIds];
    const worldBaseId = basePool[Math.floor(Math.random() * basePool.length)];
    const foundation = getWorldFoundation(worldBaseId);
    // 规则书激活统一在 handleComplete 内执行（此处只计算 bookId 供 mainEntry 等使用）；
    // 默认底座用题材书（优先）→ 底座书兜底；随机落到扩展底座时用该底座书
    const baseBookId = foundation.builtinBookId;
    const bookId =
      (worldBaseId === topic.worldBaseId ? topic.worldBookId ?? baseBookId : baseBookId) ||
      books.find((b) => b.id === worldBaseId || b.theme === worldBaseId)?.id;

    const ui = useUIStore.getState();
    ui.setSelectedTopicScheme(topic.id, topic.label);
    ui.setSelectedWorld(worldBaseId, foundation.label);
    ui.setSelectedTrope(topic.tropeId, topic.label);
    ui.setOnboardingAudience(filter);

    const mode = (["novel", "player", "custom"] as const)[Math.floor(Math.random() * 3)];
    ui.setSelectedMode(mode);
    if (mode === "player") {
      useGenerationStore.getState().setActivePreset("player-control");
    }

    const chars = useCharacterStore.getState().characters;
    if (chars.length > 0) {
      const ch = chars[Math.floor(Math.random() * chars.length)];
      ui.setSelectedCharacter(ch.id, ch.name);
    } else {
      ui.setSelectedCharacter(null, null);
    }

    const selectedWorldBook = bookId ? books.find((b) => b.id === bookId) || null : null;
    const mainEntries = pickMainEntries(selectedWorldBook);
    const pickedMainEntry = mainEntries.length > 0
      ? mainEntries[Math.floor(Math.random() * mainEntries.length)]
      : null;
    ui.setSelectedMainEntry(pickedMainEntry?.id ?? null, pickedMainEntry?.title ?? null);

    const stylePool = useGenerationStore.getState().presets.filter((p) => ["balanced", "creative", "roleplay", "longform", "stable"].includes(p.id));
    const pickedStyle = stylePool[Math.floor(Math.random() * stylePool.length)];
    if (pickedStyle) {
      useGenerationStore.getState().setActivePreset(pickedStyle.id);
      ui.setSelectedStylePreset(pickedStyle.id, pickedStyle.name);
    }

    const scenarios = getTopicOpeningScenarios(topic.id, worldBaseId, filter);
    const sc = scenarios[Math.floor(Math.random() * scenarios.length)];
    ui.setSelectedScenario(sc?.id ?? "ai-random", sc?.name ?? "AI 随机开局");

    handleComplete();
  };

  // Render floating particles
  const particles = Array.from({ length: 8 }, (_, i) => (
    <div
      key={i}
      className="seed-particle"
      style={{
        width: 2 + Math.random() * 3,
        height: 2 + Math.random() * 3,
        left: (8 + i * 12) + "%",
        animationDuration: (14 + i * 2) + "s",
        animationDelay: (i * 1.5) + "s",
        opacity: 0,
      }}
    />
  ));

  return (
    <div className="seed-onboarding">
      <div className="seed-particles">{particles}</div>
      <div className="seed-onboarding-content">
        {onExit && (
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 18 }}>
            <button
              className="seed-breadcrumb-link"
              onClick={handleExitOrBack}
              title={onboardingStep > 1 ? "返回上一步" : "退出开局流程"}
              style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              {onboardingStep > 1 ? (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              ) : (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              )}
              {onboardingStep > 1 ? "上一步" : "退出流程"}
            </button>
          </div>
        )}
        <div className="seed-onboarding-step" key={onboardingStep}>
          {onboardingStep === 1 && <TopicSelect />}
          {onboardingStep === 2 && <StyleModeSelect />}
          {onboardingStep === 3 && <ProtagonistSelect onComplete={handleComplete} />}
        </div>
      </div>
    </div>
  );
}
