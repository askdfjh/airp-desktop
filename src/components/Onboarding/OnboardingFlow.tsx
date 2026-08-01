import { useUIStore } from "@/stores/uiStore";
import { useSessionStore } from "@/stores/sessionStore";
import { useProviderStore } from "@/stores/providerStore";
import { useOnboardingStore } from "@/stores/onboardingStore";
import { useWorldStore } from "@/stores/worldStore";
import { useCharacterStore } from "@/stores/characterStore";
import { useGenerationStore } from "@/stores/generationStore";
import { WorldSelect, PRESET_WORLDS, WORLD_BOOK_MAP } from "./WorldSelect";
import { ModeSelect } from "./ModeSelect";
import { CharacterOpeningSelect } from "./CharacterOpeningSelect";

export function OnboardingFlow() {
  const { onboardingStep, setAppPhase, resetOnboarding, setPendingOpeningMessage } = useUIStore();
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
    const selectedMode = ui.selectedMode;
    const selectedWorldName = ui.selectedWorldName;
    // 主角名：第 3 步输入 > 所选角色名 > 兜底「主角」
    const playerName = (ui.playerName || "").trim() || selectedCharacterName || "主角";
    // 允许无角色/无场景/无模式直接开始：未选时用空 systemPrompt
    const isAIOpening = selectedScenarioId === "ai-random";
    const hasFullSetup = selectedCharacterId && selectedScenarioId && selectedMode;
    // AI 随机开局：不注入预设场景模板，只带叙事规则，开局由 AI 即兴生成
    const systemPrompt = isAIOpening
      ? buildModePrompt(selectedMode || "novel")
      : hasFullSetup
        ? buildSystemPrompt(
            selectedScenarioId,
            playerName,
            selectedMode
          )
        : "";
    // 开局开场消息：选中开局场景时，按场景设定自动发送给 AI 作为第一条消息
    const openingMessage = isAIOpening
      ? buildAIOpeningMessage(selectedWorldName || "未知世界", playerName, selectedMode || "novel")
      : selectedScenarioId
        ? buildOpeningMessage(selectedScenarioId, playerName)
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

  const handleRandomStart = async () => {
    // 1. 随机世界：预设世界 + 用户世界书
    const worldStore = useWorldStore.getState();
    const books = worldStore.books;
    const pool = [
      ...PRESET_WORLDS.map((w) => ({ id: w.id, name: w.name })),
      ...books.map((b) => ({ id: b.theme || b.id, name: b.name })),
    ];
    const pick = pool[Math.floor(Math.random() * pool.length)];

    // 同步激活对应世界书（无对应书则不注入任何条目）
    const bookId = WORLD_BOOK_MAP[pick.id] || books.find((b) => b.id === pick.id || b.theme === pick.id)?.id;
    if (bookId) {
      await worldStore.setActiveBook(bookId);
    } else {
      await worldStore.deactivateAllBooks();
    }

    const ui = useUIStore.getState();
    ui.setSelectedWorld(pick.id, pick.name);

    // 2. 随机视角（novel / player / custom）
    const mode = (["novel", "player", "custom"] as const)[Math.floor(Math.random() * 3)];
    ui.setSelectedMode(mode);
    if (mode === "player") {
      useGenerationStore.getState().setActivePreset("player-control");
    }

    // 3. 随机角色（无角色库则用主角）
    const chars = useCharacterStore.getState().characters;
    if (chars.length > 0) {
      const ch = chars[Math.floor(Math.random() * chars.length)];
      ui.setSelectedCharacter(ch.id, ch.name);
    } else {
      ui.setSelectedCharacter(null, null);
    }

    // 4. 随机场景：该世界主题下随机；无匹配场景（如娱乐圈/末日等自定义主题书）则用 AI 随机开局兜底
    const resolvedTheme = useOnboardingStore.getState().resolveTheme(pick.id);
    const scenarios = useOnboardingStore.getState().getScenariosByTheme(resolvedTheme);
    if (scenarios.length > 0) {
      const sc = scenarios[Math.floor(Math.random() * scenarios.length)];
      ui.setSelectedScenario(sc.id, sc.name);
    } else {
      ui.setSelectedScenario("ai-random", "AI 随机开局");
    }

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
        <div className="seed-onboarding-step" key={onboardingStep}>
          {onboardingStep === 1 && <WorldSelect onRandomStart={handleRandomStart} />}
          {onboardingStep === 2 && <ModeSelect />}
          {onboardingStep === 3 && <CharacterOpeningSelect onComplete={handleComplete} />}
        </div>
      </div>
    </div>
  );
}
