import type { ApiMessage } from "@/providers/openai";
import { useSessionStore } from "@/stores/sessionStore";
import { useProviderStore } from "@/stores/providerStore";
import { useWorldStore } from "@/stores/worldStore";
import { useGenerationStore } from "@/stores/generationStore";
import { useUIStore } from "@/stores/uiStore";
import { usePromptInjectionStore } from "@/stores/promptInjectionStore";
import { loadMessages, loadSessionCharacterCards } from "@/lib/db";
import { buildWorldContext } from "@/lib/worldBookEngine";
import { buildNarrativeGuard, buildProgressionGuard } from "@/lib/narrativeGuard";
import { parseSceneAnalysis, buildAnalyzePrompt } from "@/lib/sceneAnalyzer";
import { parseSceneReply } from "@/lib/sceneTemplate";
import { estimateTokens } from "@/lib/characterExtract";
import type { Message } from "@/types";

/** 检测文本中的重复模式（单字连续重复 / 短语高频重复） */
function detectRepetition(text: string): string[] {
  const hits: string[] = [];
  const m1 = text.match(/(.)\1{3,}/g);
  if (m1) hits.push(...m1.slice(0, 5).map((s) => `单字重复「${s.slice(0, 8)}」`));
  if (hits.length < 5) {
    for (let len = 8; len >= 3; len--) {
      const seen = new Map<string, number>();
      for (let i = 0; i + len <= text.length; i++) {
        const sub = text.slice(i, i + len);
        const n = (seen.get(sub) ?? 0) + 1;
        seen.set(sub, n);
        if (n >= 3) {
          hits.push(`短语重复 x${n}「${sub}」`);
          break;
        }
      }
      if (hits.length >= 6) break;
    }
  }
  return hits.slice(0, 8);
}

/** 模拟 useChat.buildApiMessages 的当前注入逻辑，逐段标注来源（诊断用，不含密钥） */
export async function buildRequestPreview(): Promise<{
  systems: { source: string; chars: number; content: string }[];
  history: { role: string; cleaned: boolean; chars: number; content: string }[];
  params: Record<string, unknown>;
  totalChars: number;
  estimatedTokens: number;
}> {
  const ss = useSessionStore.getState();
  const ps = useProviderStore.getState();
  const ui = useUIStore.getState();
  const session = ss.activeId ? ss.sessions.find((s) => s.id === ss.activeId) : null;
  const provider = ps.providers.find((p) => p.id === ps.activeProviderId) ?? null;
  const systems: { source: string; chars: number; content: string }[] = [];
  const isBlank = (session?.kind ?? "adventure") === "blank";
  const hist: Message[] = session ? await loadMessages(session.id) : [];

  if (session) {
    // 提示词注入（模拟过滤：applied && 绑定当前模型）
    const injections = usePromptInjectionStore
      .getState()
      .items.filter((i) => i.applied && (!i.modelIds?.length || i.modelIds.includes(ps.activeModel || "")))
      .map((i) => i.text);
    if (!isBlank && injections.length > 0) {
      systems.push({ source: "提示词注入", chars: injections.join("\n\n").length, content: injections.join("\n\n") });
    }

    // basePrompt + 风格 + 正文约束 + 护栏
    let sceneTemplate = !isBlank
      ? `\n\n【输出要求】直接输出故事正文本身。不要输出章节名、场景信息、对话推荐等任何区块标签，不要添加任何格式说明或前后缀。`
      : "";
    if (!isBlank) {
      const guards: string[] = [];
      if (ui.narrativeGuardOn) guards.push(buildNarrativeGuard());
      if (ui.progressionGuardOn) guards.push(buildProgressionGuard());
      if (guards.length > 0) sceneTemplate += "\n\n" + guards.join("\n\n");
    }
    const gen = useGenerationStore.getState();
    const preset = gen.presets.find((p) => p.id === gen.activePresetId) || null;
    const styleInstr = !isBlank && preset?.outputStyle?.trim()
      ? `\n\n【输出风格】${preset.outputStyle.trim()}`
      : "";
    const basePrompt = session.systemPrompt || "";
    if (basePrompt || styleInstr || sceneTemplate) {
      systems.push({
        source: "基础提示词（basePrompt+风格+正文约束+护栏）",
        chars: (basePrompt + styleInstr + sceneTemplate).length,
        content: basePrompt + styleInstr + sceneTemplate,
      });
    }

    // 旧压缩摘要（兼容）
    if (!isBlank && session.contextSummary) {
      systems.push({
        source: "故事脉络摘要（旧压缩）",
        chars: session.contextSummary.length,
        content: `【故事脉络摘要】\n${session.contextSummary}`,
      });
    }

    // 续集档案 + 父卷 + 触发/兜底
    if (session.archive) {
      const parent = session.parentId ? ss.sessions.find((s) => s.id === session.parentId) : undefined;
      let joined = `【剧情档案】\n${session.archive}`;
      if (parent?.archive) joined += `\n\n【上卷档案】\n${parent.archive}`;
      const parentMsgs = parent ? await loadMessages(parent.id) : [];
      if (parent?.contextIndex && parentMsgs.length > 0) {
        let index: Record<string, string[]> = {};
        try {
          index = JSON.parse(parent.contextIndex);
        } catch {
          index = {};
        }
        const recentText = [...hist.slice(-2).map((m) => m.content), "(用户最新消息)"].join("\n");
        const seen = new Set<string>();
        const matched: Message[] = [];
        for (const kw of Object.keys(index)) {
          if (recentText.includes(kw)) {
            for (const mid of index[kw]) {
              if (!seen.has(mid)) {
                seen.add(mid);
                const msg = parentMsgs.find((m) => m.id === mid);
                if (msg && msg.role !== "system" && msg.content) matched.push(msg);
              }
            }
          }
        }
        for (let i = parentMsgs.length - 1; i >= 0 && matched.length < 6; i--) {
          const m = parentMsgs[i];
          if (m.role !== "system" && m.content && !seen.has(m.id)) {
            seen.add(m.id);
            matched.push(m);
          }
        }
        const clean = (m: Message, max: number) => (parseSceneReply(m.content).body || m.content).slice(0, max);
        const trigger = matched.slice(0, 3);
        if (trigger.length > 0) {
          joined += `\n\n【旧卷片段·相关回忆】\n` + trigger.map((m) => `${m.role === "user" ? "主角" : "AI"}：${clean(m, 600)}`).join("\n");
        }
        const fallback = matched.slice(3, 6);
        if (fallback.length > 0) {
          joined += `\n\n【旧卷片段·最近进展】\n` + fallback.map((m) => `${m.role === "user" ? "主角" : "AI"}：${clean(m, 400)}`).join("\n");
        }
        if (joined.length > 4500) joined = joined.slice(0, 4500);
      }
      systems.push({ source: "剧情档案（含父卷/触发/兜底）", chars: joined.length, content: joined });
    }

    // 规则书
    const book = useWorldStore.getState().activeBook;
    if (!isBlank && book) {
      const recentContext = [...hist.slice(-2).map((m) => m.content), "(用户最新消息)"].join("\n");
      const world = buildWorldContext(book, recentContext);
      if (world.text) {
        systems.push({ source: `规则书（${book.name}，命中 ${world.matchedEntryIds.length} 条 + 常驻 ${world.constantCount} 条）`, chars: world.text.length, content: world.text });
      }
    }

    // 角色卡注入（模拟触发）
    if (!isBlank) {
      const cards = await loadSessionCharacterCards(session.id);
      if (cards.length > 0) {
        const recentText = [...hist.slice(-2).map((m) => m.content), "(用户最新消息)"].join("\n");
        const lines: string[] = [];
        for (const c of cards) {
          const words = JSON.parse(c.triggerWords || "[]") as string[];
          if (words.some((w) => recentText.includes(w))) {
            lines.push(`【角色·${c.name}】\n${c.systemPrompt}`);
          }
        }
        if (lines.length > 0) {
          systems.push({ source: `角色卡注入（${lines.length} 张命中，共绑定 ${cards.length} 张）`, chars: lines.join("\n").length, content: lines.join("\n") });
        } else {
          systems.push({ source: "角色卡（无触发命中，未注入）", chars: 0, content: "" });
        }
      }
    }

    // 场景 + 后台进展
    let prevAnalysis: ReturnType<typeof parseSceneAnalysis> | null = null;
    for (let i = hist.length - 1; i >= 0; i--) {
      const sa = hist[i]?.sceneAnalysis;
      if (sa) {
        prevAnalysis = parseSceneAnalysis(sa);
        break;
      }
    }
    if (prevAnalysis) {
      const parts: string[] = [];
      const sceneBits = [prevAnalysis.location, prevAnalysis.time, prevAnalysis.characters].filter(Boolean);
      if (sceneBits.length > 0) {
        parts.push(`【当前场景】${sceneBits.join(" · ")}${prevAnalysis.cause ? `（起因：${prevAnalysis.cause}）` : ""}`);
      }
      if (ui.hiddenProgressOn && prevAnalysis.hiddenProgress) {
        parts.push(`【角色后台进展·玩家不可见】${prevAnalysis.hiddenProgress}`);
      }
      if (parts.length > 0) {
        systems.push({ source: "当前场景 + 角色后台进展", chars: parts.join("\n").length, content: parts.join("\n") });
      }
    }
  }

  // 历史消息（清洗标注）
  const history = hist.map((m) => {
    let cleaned = false;
    let content = m.content;
    if (m.role === "assistant" && !m.toolCalls && content.includes("【正文】")) {
      const body = parseSceneReply(content).body;
      if (body && body !== content.trim()) {
        cleaned = true;
        content = body;
      }
    }
    return { role: m.role, cleaned, chars: content.length, content };
  });

  // 采样参数（当前文风）
  const gen = useGenerationStore.getState();
  const preset = gen.presets.find((p) => p.id === gen.activePresetId) || null;
  const params: Record<string, unknown> = {
    model: ps.activeModel || "",
    provider: provider?.name || "",
    baseUrl: provider?.baseUrl || "",
    thinkingEnabled: session?.thinkingEnabled ?? true,
    temperature: preset?.temperature ?? undefined,
    top_p: preset?.topP ?? undefined,
    max_tokens: preset?.maxTokens ?? undefined,
  };

  const totalChars = systems.reduce((t, s) => t + s.chars, 0) + history.reduce((t, h) => t + h.chars, 0);
  return {
    systems,
    history,
    params,
    totalChars,
    estimatedTokens: estimateTokens(String(totalChars)),
  };
}

/** 生成完整诊断数据（不含任何密钥） */
export async function buildDebugExport(): Promise<Record<string, unknown>> {
  const ss = useSessionStore.getState();
  const ps = useProviderStore.getState();
  const ui = useUIStore.getState();
  const session = ss.activeId ? ss.sessions.find((s) => s.id === ss.activeId) : null;
  const hist: Message[] = session ? await loadMessages(session.id) : [];

  // 历史统计 + 重复检测
  const stats = {
    messageCount: hist.length,
    assistantCount: hist.filter((m) => m.role === "assistant").length,
    userCount: hist.filter((m) => m.role === "user").length,
    totalChars: hist.reduce((t, m) => t + m.content.length, 0),
    estimatedTokens: estimateTokens(String(hist.reduce((t, m) => t + m.content.length, 0))),
    duplicateMessages: [] as string[],
    repetitionFindings: [] as { messageId: string; hits: string[] }[],
  };
  // 相邻消息重复检测（前 40 字相同）
  for (let i = 1; i < hist.length; i++) {
    const a = hist[i - 1].content.trim().slice(0, 40);
    const b = hist[i].content.trim().slice(0, 40);
    if (a && a === b) {
      stats.duplicateMessages.push(`消息 ${i - 1} 与 ${i} 开头相同：「${a}」`);
    }
  }
  // 每条 assistant 消息的重复模式检测
  for (const m of hist.slice(-15)) {
    if (m.role !== "assistant" || !m.content) continue;
    const hits = detectRepetition(m.content);
    if (hits.length > 0) {
      stats.repetitionFindings.push({ messageId: m.id.slice(0, 8), hits });
    }
  }

  const preview = await buildRequestPreview();

  return {
    meta: {
      app: "Narra",
      device: /Android/i.test(navigator.userAgent) ? "android" : "desktop",
      exportedAt: new Date().toISOString(),
      sessionId: session?.id ?? null,
      sessionTitle: session?.title ?? null,
      kind: session?.kind ?? null,
      chainIndex: session?.chainIndex ?? null,
      locked: session?.locked ?? false,
      providerId: ps.activeProviderId,
      model: ps.activeModel,
    },
    config: {
      narrativeGuardOn: ui.narrativeGuardOn,
      progressionGuardOn: ui.progressionGuardOn,
      hiddenProgressOn: ui.hiddenProgressOn,
      webSearchOn: ui.webSearchOn,
      formatModel: ui.formatModel,
      formatAnalyzePromptPreview: buildAnalyzePrompt("（正文占位）", undefined, ui.hiddenProgressOn).slice(0, 500),
    },
    historyStats: stats,
    requestPreview: preview,
  };
}
