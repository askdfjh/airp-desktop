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
import { getTopicSchemesByAudience } from "@/lib/topicSchemes";
import { getWorldFoundation } from "@/lib/worldFoundations";
import { TopicSelect } from "./TopicSelect";
import { StyleModeSelect } from "./StyleModeSelect";
import { ProtagonistSelect } from "./ProtagonistSelect";
import { pickMainEntries } from "./onboardingHelpers";
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

  const handleComplete = () => {
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
    const selectedBook = worldState.activeBook || worldState.books.find((b) => b.id === selectedWorldId) || null;
    const selectedPresetWorld = PRESET_WORLDS.find((w) => w.id === selectedWorldId);
    const worldviewId = selectedPresetWorld?.id || selectedBook?.theme || selectedWorldId || "custom";
    const selectedAudience: WorldAudience | null =
      selectedPresetWorld?.gender ?? (selectedBook ? inferWorldBookAudience(selectedBook) : null);
    const selectedScenario = selectedScenarioId
      ? getTopicOpeningScenario(selectedTopicSchemeId, selectedScenarioId) ||
        useOnboardingStore.getState().getScenarioById(selectedScenarioId) ||
        getWorldOpeningScenario(selectedBook, selectedScenarioId)
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
      ? `【基础规则块】本次开局优先围绕「${selectedMainEntry.title}」展开。该条目只定义基础规则或舞台，不要把它误当成题材。条目内容：${selectedMainEntry.content}`
      : selectedMainEntryName
        ? `【基础规则块】本次开局优先围绕「${selectedMainEntryName}」展开。该条目只定义基础规则或舞台，不要把它误当成题材。`
        : "";
    const stylePrompt = selectedStylePresetName
      ? `【风格修饰】整体气质参考「${selectedStylePresetName}」，但不得覆盖世界观规则、基础规则块和题材引擎。`
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
    const session = {
      id: crypto.randomUUID(),
      title: playerName ? playerName + "的冒险" : "新冒险",
      systemPrompt,
      providerId: activeProviderId || "",
      model: activeModel || "",
      thinkingEnabled: true,
      kind: "adventure" as const,
      createdAt: now,
      updatedAt: now,
    };

    addSession(session);
    // 激活新创建的会话，让 DialogueNovel/useChat 能正确加载
    setActive(session.id);
    resetOnboarding();
    setAppPhase("dialogue");
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

    const foundation = getWorldFoundation(topic.worldBaseId);
    const bookId = foundation.builtinBookId || books.find((b) => b.id === topic.worldBaseId || b.theme === topic.worldBaseId)?.id;
    if (bookId) {
      await worldStore.setActiveBook(bookId);
    } else {
      await worldStore.deactivateAllBooks();
    }

    const ui = useUIStore.getState();
    ui.setSelectedTopicScheme(topic.id, topic.label);
    ui.setSelectedWorld(topic.worldBaseId, foundation.label);
    ui.setSelectedTrope(topic.tropeId, topic.label);

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

    const scenarios = getTopicOpeningScenarios(topic.id);
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
