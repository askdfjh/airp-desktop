import { useUIStore } from "@/stores/uiStore";
import { useSessionStore } from "@/stores/sessionStore";
import { useProviderStore } from "@/stores/providerStore";
import { useOnboardingStore } from "@/stores/onboardingStore";
import { WorldSelect } from "./WorldSelect";
import { ModeSelect } from "./ModeSelect";
import { CharacterOpeningSelect } from "./CharacterOpeningSelect";

export function OnboardingFlow() {
  const { onboardingStep, setAppPhase, resetOnboarding, setPendingOpeningMessage, selectedWorldId, selectedCharacterId, selectedScenarioId, selectedCharacterName, selectedMode } = useUIStore();
  const addSession = useSessionStore((s) => s.add);
  const setActive = useSessionStore((s) => s.setActive);
  const activeProviderId = useProviderStore((s) => s.activeProviderId);
  const activeModel = useProviderStore((s) => s.activeModel);
  const buildSystemPrompt = useOnboardingStore((s) => s.buildSystemPrompt);
  const buildOpeningMessage = useOnboardingStore((s) => s.buildOpeningMessage);

  const handleComplete = () => {
    // 允许无角色/无场景/无模式直接开始：未选时用空 systemPrompt
    const hasFullSetup = selectedCharacterId && selectedScenarioId && selectedMode;
    const systemPrompt = hasFullSetup
      ? buildSystemPrompt(
          selectedScenarioId,
          selectedCharacterName || "主角",
          selectedMode
        )
      : "";
    // 开局开场消息：选中开局场景时，按场景设定自动发送给 AI 作为第一条消息
    const openingMessage = selectedScenarioId
      ? buildOpeningMessage(selectedScenarioId, selectedCharacterName || "主角")
      : "";

    const now = Date.now();
    const session = {
      id: crypto.randomUUID(),
      title: selectedCharacterName
        ? selectedCharacterName + "的冒险"
        : "新冒险",
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
          {onboardingStep === 1 && <WorldSelect />}
          {onboardingStep === 2 && <ModeSelect />}
          {onboardingStep === 3 && <CharacterOpeningSelect onComplete={handleComplete} />}
        </div>
      </div>
    </div>
  );
}
