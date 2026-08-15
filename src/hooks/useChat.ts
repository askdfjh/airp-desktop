import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { flushSync } from "react-dom";
import type { Message, AttachedFile, ToolDefinition, ToolCall } from "@/types";
import { chatStream } from "@/providers/openai";
import type { ApiMessage } from "@/providers/openai";
import { analyzeScene, parseSceneAnalysis, buildAnalyzePrompt } from "@/lib/sceneAnalyzer";
import { parseSceneReply } from "@/lib/sceneTemplate";
import { buildNarrativeGuard, buildProgressionGuard } from "@/lib/narrativeGuard";
import { estimateTokens } from "@/lib/characterExtract";
import { logError } from "@/lib/appLog";
import { useProviderStore } from "@/stores/providerStore";
import { useSessionStore } from "@/stores/sessionStore";
import { loadMessages, insertMessage, updateMessageContent, updateMessageThinking, updateMessageSceneAnalysis, updateMessageTokenUsage, deleteMessage as deleteMessageDb, getAppSetting } from "@/lib/db";
import { getBuiltinTools, executeBuiltinTool } from "@/tools/builtinTools";
import { useMcpStore } from "@/stores/mcpStore";
import { callTool as callMcpTool } from "@/lib/mcpClient";
import { useUIStore } from "@/stores/uiStore";
import { useWorldStore } from "@/stores/worldStore";
import { useStoryStore } from "@/stores/storyStore";
import { buildWorldContext, findMatchingEntries, pickRandomEventEntry } from "@/lib/worldBookEngine";
import { useGenerationStore } from "@/stores/generationStore";
import { usePromptInjectionStore } from "@/stores/promptInjectionStore";
import { loadSessionCharacterCards } from "@/lib/db";
import { buildCharacterContext, type LoadedExtractedCard } from "@/lib/characterExtract";

// 场景分析失败提示节流（模型服务不可用时避免每次回复都弹 toast）
let lastSceneFailNotifyAt = 0;
import { maybePromptCompress, isPostCompress } from "@/lib/contextCompress";

let _toolsEnabled = false;
const MAX_TOOL_ROUNDS = 3;

export function setToolsEnabled(v: boolean) {
  console.log("[tools] setToolsEnabled:", v, new Error().stack?.split("\n").slice(1, 4).join("\n"));
  _toolsEnabled = v;
}

// 检查当前是否配置了可用的模型服务；未配置时返回提示文案，配置正常返回 null
export function getSendBlocker(): string | null {
  const ps = useProviderStore.getState();
  // 压缩续集锁定：原会话只读，禁止继续写（分支不受限）
  const ss = useSessionStore.getState();
  const cur = ss.activeId ? ss.sessions.find((x) => x.id === ss.activeId) : null;
  if (cur?.locked) {
    return `该会话已整理锁定（第 ${cur.chainIndex ?? 1} 卷），请从续集会话继续，或创建分支独立发展`;
  }
  const provider = ps.providers.find((p) => p.id === ps.activeProviderId);
  if (!provider) return "未配置模型服务，请先在设置中配置";
  if (ps.enabledProviders[provider.id] === false) return "当前模型服务已停用，请在设置中启用";
  if (!provider.baseUrl) return "模型服务缺少 API 地址，请在设置中补充";
  if (!provider.apiKey || !provider.apiKey.trim()) return "模型服务缺少 API Key，请在设置中填写";
  if (!ps.activeModel) return "未选择模型，请在设置中选择";
  return null;
}

function blockSend(reason: string) {
  useUIStore.getState().notify(reason, "settings");
}

async function collectTools(): Promise<ToolDefinition[]> {
  const defs: ToolDefinition[] = [];
  console.log("[tools] collectTools called, _toolsEnabled =", _toolsEnabled);
  if (_toolsEnabled) {
    const builtin = getBuiltinTools(["web_search"]);
    console.log("[tools] builtin tools:", builtin.map(t => t.function?.name));
    defs.push(...builtin);
  }
  try {
    const state = useMcpStore.getState();
    for (const sid of state.activeServerIds) {
      const hasTools = state.tools.some(t => t.name.startsWith(sid + ":"));
      if (!hasTools) {
        await state.fetchTools(sid);
      }
    }
    defs.push(...state.getActiveToolDefs());
  } catch {}
  return defs;
}

async function executeTool(tc: ToolCall): Promise<string> {
  // Built-in tools
  if (tc.function.name === "web_search") {
    return executeBuiltinTool(tc.function.name, JSON.parse(tc.function.arguments));
  }
  // MCP tools
  const colonIdx = tc.function.name.indexOf(":");
  if (colonIdx > 0) {
    const serverId = tc.function.name.slice(0, colonIdx);
    const toolName = tc.function.name.slice(colonIdx + 1);
    try {
      const { servers } = useMcpStore.getState();
      const server = servers.find(s => s.id === serverId);
      if (!server) return "MCP 服务器未找到";
      const result = await callMcpTool(server.url, toolName, JSON.parse(tc.function.arguments));
      return typeof result === "string" ? result : JSON.stringify(result, null, 2);
    } catch (e) {
      return "MCP 调用失败: " + (e instanceof Error ? e.message : String(e));
    }
  }
  return "未知工具: " + tc.function.name;
}

export function useChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [toolRunning, setToolRunning] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  // 格式分析（章节/场景/对话推荐独立请求）进行中
  const [analysingScene, setAnalysingScene] = useState(false);
  const [sceneError, setSceneError] = useState<string | null>(null);
  const lastSceneTargetRef = useRef<{ msgId: string; body: string } | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const activeSessionIdRef = useRef<string | null>(null);
  const messagesRef = useRef<Message[]>([]);
  const everLoadedRef = useRef(false);
  // 随机世界事件：每会话节奏状态（上次触发时的轮次 + 已抽过的条目 id）
  const randomEventStateRef = useRef<Map<string, { lastTurn: number; pickedIds: string[] }>>(new Map());
  // 本次请求待注入的随机事件行（sendMessage 抽卡一次，buildApiMessages 消费；重试复用同一条）
  const pendingRandomEventRef = useRef<{ sessionId: string; line: string } | null>(null);

  const { providers, activeProviderId, activeModel } = useProviderStore();
  const activeSession = useSessionStore((s) =>
    s.activeId ? s.sessions.find((ss) => ss.id === s.activeId) : null,
  );
  const activeProvider = providers.find((p) => p.id === activeProviderId);
  const activeWorldBook = useWorldStore((s) => s.activeBook);
  const storyBoundBook = useStoryStore((s) => {
    const sid = s.activeStoryId;
    const story = sid ? s.stories.find((x) => x.id === sid) : null;
    if (!story?.worldBookId) return null;
    return useWorldStore.getState().books.find((b) => b.id === story.worldBookId) || null;
  });
  const activeStoryId = useStoryStore((s) => s.activeStoryId);
  // 有当前书时只信 Story.worldBookId，禁止回落到上一本的 activeBook（切书串世界）
  const worldBookForChat = activeStoryId ? storyBoundBook : activeWorldBook;
  const [sessionCards, setSessionCards] = useState<LoadedExtractedCard[]>([]);
  // 父卷消息缓存（续集触发式注入用：切换会话时预加载）
  const parentMessagesRef = useRef<Message[]>([]);
  const activeGenPreset = useGenerationStore((s) =>
    s.activePresetId === "none" ? undefined : s.presets.find((p) => p.id === s.activePresetId) || s.presets[0],
  );
  const allInjections = usePromptInjectionStore((s) => s.items);
  const activeInjections = useMemo(
    () =>
      allInjections
        .filter((i) => i.applied && (i.modelIds.length === 0 || i.modelIds.includes(activeModel ?? "")))
        .map((i) => i.text.trim())
        .filter(Boolean),
    [allInjections, activeModel],
  );
  const isBlankSession = (activeSession?.kind ?? "adventure") === "blank";

  useEffect(() => { messagesRef.current = messages; }, [messages]);

  useEffect(() => {
    const sid = activeSession?.id ?? null;
    activeSessionIdRef.current = sid;
    if (!sid) {
      setMessages([]);
      setLoadingMessages(false);
      everLoadedRef.current = false;
      return;
    }
    let cancelled = false;
    const isFirstLoad = !everLoadedRef.current;
    if (isFirstLoad) setLoadingMessages(true);
    loadMessages(sid)
      .then((msgs) => {
        if (!cancelled) {
          setMessages(msgs);
          setLoadingMessages(false);
          everLoadedRef.current = true;
        }
      })
      .catch((e) => {
        console.error("[db] loadMessages failed:", e);
        if (!cancelled) {
          setMessages([]);
          setLoadingMessages(false);
          everLoadedRef.current = true;
        }
      });
    // 加载当前会话绑定的提取角色卡（供关键词注入）
    loadSessionCharacterCards(sid)
      .then((rows) => {
        if (!cancelled) {
          setSessionCards(rows.map((r) => ({
            characterCardId: r.characterCardId,
            name: r.name,
            triggerWords: r.triggerWords ?? "[]",
            systemPrompt: r.systemPrompt,
            description: r.description,
          })));
        }
      })
      .catch((e) => console.error("[db] loadSessionCharacterCards failed:", e));
    // 预加载父卷消息（续集触发式注入用）
    const pid = activeSession?.parentId ?? null;
    parentMessagesRef.current = [];
    if (pid) {
      loadMessages(pid)
        .then((msgs) => {
          if (!cancelled) parentMessagesRef.current = msgs;
        })
        .catch(() => {});
    }
    return () => { cancelled = true; };
  }, [activeSession?.id]);

  const buildApiMessages = useCallback(
    (history: Message[], lastUserContent: string, images?: string[], toolHint?: boolean, forceCharacterCards?: boolean): ApiMessage[] => {
      const result: ApiMessage[] = [];
      let hist = history;
      const basePrompt = activeSession?.systemPrompt || "";
      // 正文单独输出：不注入【场景信息】【对话推荐】模板（章节/场景/推荐由独立格式分析请求生成）
      let sceneTemplate = (activeSession?.kind !== "blank" || activeSession?.formatEnabled)
        ? `\n\n【输出要求】直接输出故事正文本身。不要输出章节名、场景信息、对话推荐等任何区块标签，不要添加任何格式说明或前后缀。`
        : "";
      // 叙事约束（插件设置页开关，默认关闭）：叙事防护 + 剧情推进，可独立开启
      if (activeSession?.kind !== "blank") {
        const ui = useUIStore.getState();
        const guards: string[] = [];
        if (ui.narrativeGuardOn) guards.push(buildNarrativeGuard());
        if (ui.progressionGuardOn) guards.push(buildProgressionGuard());
        if (guards.length > 0) sceneTemplate += "\n\n" + guards.join("\n\n");
      }
      // 模型提示词注入：已应用且绑定当前模型的注入词，合并注入到 system prompt 最开头
      if (!isBlankSession && activeInjections.length > 0) {
        result.push({ role: "system", content: activeInjections.join("\n\n") });
      }
        const styleInstr = !isBlankSession && activeGenPreset?.outputStyle?.trim()
          ? `\n\n【输出风格】${activeGenPreset.outputStyle.trim()}`
          : "";
        if (toolHint) {
          const now = new Date();
          const dateStr = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日`;
          const weekday = ["周日","周一","周二","周三","周四","周五","周六"][now.getDay()];
          const timeStr = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;
          const dateContext = `今天是 ${dateStr} ${weekday}，当前时间 ${timeStr}。`;
          const toolSystemPrompt = basePrompt
            ? basePrompt + `\n\n【重要】${dateContext} 你有可用的工具。当用户询问需要实时信息、新闻、数据时，必须使用 web_search 工具搜索，而不是凭知识回答。搜索时请使用当前日期。`
            : `${dateContext}你是一个智能助手。你拥有 web_search 工具可以搜索互联网。当用户询问需要实时信息、新闻、当前事件、具体数据或事实核查时，你必须调用 web_search 工具来获取准确答案，而不是凭你的知识直接回答。`;
          result.push({ role: "system", content: toolSystemPrompt + styleInstr + sceneTemplate });
        } else if (basePrompt) {
          result.push({ role: "system", content: basePrompt + styleInstr + sceneTemplate });
        } else if (styleInstr) {
          result.push({ role: "system", content: styleInstr.trim() + sceneTemplate });
        }
      // 长对话压缩：故事脉络摘要注入 + 历史截断（旧压缩会话兼容；摘要点之后的消息才进入上下文）
      if (!isBlankSession && activeSession?.contextSummary) {
        result.push({
          role: "system",
          content: `【故事脉络摘要】以下为早前对话的自动摘要（摘要之前的细节已省略，角色设定以角色卡为准，剧情以摘要为最新依据）：\n${activeSession.contextSummary}`,
        });
        const lastSummarizedId = activeSession.lastSummarizedMessageId;
        if (lastSummarizedId) {
          const cutIdx = hist.findIndex((m) => m.id === lastSummarizedId);
          if (cutIdx >= 0) hist = hist.slice(cutIdx + 1);
        }
      }
      // 续集会话：剧情档案（当前卷 + 父卷）注入 + 旧卷触发片段 + 兜底（总量上限降级；冒险/空白会话均生效）
      if (activeSession?.archive) {
        const ss = useSessionStore.getState();
        const parent = activeSession.parentId
          ? ss.sessions.find((s) => s.id === activeSession.parentId)
          : undefined;
        const parts: string[] = [
          `【剧情档案】以下为整理后的剧情档案，是续集剧情一致性的依据（正文中不要复述档案条目）：\n${activeSession.archive}`,
        ];
        if (parent?.archive) {
          parts.push(`【上卷档案】\n${parent.archive}`);
        }
        let addedTrigger = false;
        let addedFallback = false;
        // 触发片段：当前对话文本关键词匹配父卷索引 → 注入相关旧消息（清洗标签）
        const parentMsgs = parentMessagesRef.current;
        if (parent?.contextIndex && parentMsgs.length > 0) {
          let index: Record<string, string[]> = {};
          try {
            index = JSON.parse(parent.contextIndex);
          } catch {
            index = {};
          }
          const recentText = [...hist.slice(-2).map((m) => m.content), lastUserContent].join("\n");
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
          // 兜底：父卷最后 3 条（防关键词漏检导致细节断层；预算控制，手机弱网友好）
          for (let i = parentMsgs.length - 1; i >= 0 && matched.length < 6; i--) {
            const m = parentMsgs[i];
            if (m.role !== "system" && m.content && !seen.has(m.id)) {
              seen.add(m.id);
              matched.push(m);
            }
          }
          const clean = (m: Message, max: number) =>
            (parseSceneReply(m.content).body || m.content).slice(0, max);
          const triggerMsgs = matched.slice(0, 3);
          if (triggerMsgs.length > 0) {
            addedTrigger = true;
            parts.push(
              `【旧卷片段·相关回忆】以下为旧卷中与当前对话相关的片段：\n` +
                triggerMsgs.map((m) => `${m.role === "user" ? "主角" : "AI"}：${clean(m, 600)}`).join("\n"),
            );
          }
          const fallbackMsgs = matched.slice(3, 6);
          if (fallbackMsgs.length > 0) {
            addedFallback = true;
            parts.push(
              `【旧卷片段·最近进展】\n` +
                fallbackMsgs.map((m) => `${m.role === "user" ? "主角" : "AI"}：${clean(m, 400)}`).join("\n"),
            );
          }
        }
        // 总量上限降级：超预算先丢兜底，再丢触发，保留档案（预算对手机弱网友好）
        let joined = parts.join("\n\n");
        const ARCHIVE_BUDGET = 4500;
        if (joined.length > ARCHIVE_BUDGET && addedFallback) {
          joined = parts.filter((p) => !p.startsWith("【旧卷片段·最近进展】")).join("\n\n");
        }
        if (joined.length > ARCHIVE_BUDGET && addedTrigger) {
          joined = parts.filter((p) => !p.startsWith("【旧卷片段·相关回忆】")).join("\n\n");
        }
        if (joined.length > ARCHIVE_BUDGET) {
          joined = joined.slice(0, ARCHIVE_BUDGET);
        }
        result.push({ role: "system", content: joined });
      }
      if (!isBlankSession && worldBookForChat) {
        const recentContext = [
          ...hist.slice(-2).map((m) => m.content),
          lastUserContent,
        ].join("\n");
        const world = buildWorldContext(worldBookForChat, recentContext);
        if (world.text) {
          result.push({ role: "system", content: world.text });
        }
      }
      // 会话临时世界条目（压缩提取，仅本会话及续集生效）：≤3 条全量注入；超过按触发词匹配最近文本
      if (!isBlankSession && activeSession?.sessionEntries && activeSession.sessionEntries.length > 0) {
        const entries = activeSession.sessionEntries;
        const recentText = [
          ...hist.slice(-2).map((m) => m.content),
          lastUserContent,
        ].join("\n");
        const hit = entries.length <= 3
          ? entries
          : entries.filter((e) => (e.key || []).some((k) => {
              const kw = (k || "").toLowerCase().replace(/\s+/g, "");
              return kw.length >= 2 && recentText.toLowerCase().replace(/\s+/g, "").includes(kw);
            }));
        if (hit.length > 0) {
          const lines: string[] = [];
          let used = 0;
          for (const e of hit) {
            const line = `【会话临时设定·${e.title}】${e.content}`;
            if (used + line.length + 1 > 1200) break;
            lines.push(line);
            used += line.length + 1;
          }
          if (lines.length > 0) {
            result.push({
              role: "system",
              content:
                "【会话临时设定】以下设定仅在本次故事会话及续集中生效（不写入规则书），用于保持本卷新增设定的连贯；可继续发展，但不得与规则书基础设定冲突：\n" +
                lines.join("\n"),
            });
          }
        }
      }
      // 随机世界事件：本轮 sendMessage 已抽卡（pendingRandomEventRef），注入独立 block（与规则书/临时条目互不干扰）
      if (!isBlankSession && pendingRandomEventRef.current && pendingRandomEventRef.current.sessionId === activeSession?.id) {
        const line = pendingRandomEventRef.current.line;
        pendingRandomEventRef.current = null;
        result.push({
          role: "system",
          content:
            `【随机世界事件】以下设定来自当前世界规则书，可作为本段剧情的新进展、转折或悬念自然引出（不必强行出现，未引出也不算失败）：\n${line}`,
        });
      }
      // 提取角色卡注入（规则书同机制）：角色出场触发词命中 → 注入；压缩后首条 forceAll 全量
      if (!isBlankSession && sessionCards.length > 0) {
        const charRecent = [
          ...hist.slice(-2).map((m) => m.content),
          lastUserContent,
        ].join("\n");
        const charCtx = buildCharacterContext(sessionCards, charRecent, { forceAll: forceCharacterCards });
        if (charCtx) {
          result.push({ role: "system", content: charCtx });
        }
      }
      // 当前场景 + 角色后台进展：取最近一条带 sceneAnalysis 的消息注入正文模型
      // （场景信息无条件注入保持连贯；后台进展玩家不可见，随 hiddenProgressOn 开关）
      if (!isBlankSession || activeSession?.formatEnabled) {
        const ui = useUIStore.getState();
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
          if (parts.length > 0) result.push({ role: "system", content: parts.join("\n") });
        }
      }
      for (const m of hist) {
        // 工具占位消息（空内容）不进入历史上下文
        if (m.role === "assistant" && m.tools && !m.content.trim()) continue;
        // 历史 assistant 消息剥离旧模板标签（【章节名】【场景信息】【正文】【对话推荐】），
        // 只保留正文——防止模型 few-shot 模仿历史格式继续输出标签；纯正文消息原样透传
        if (m.role === "assistant" && !m.toolCalls && m.content.includes("【正文】")) {
          const cleaned = parseSceneReply(m.content).body;
          result.push({ role: "assistant", content: cleaned || m.content });
          continue;
        }
        result.push({ role: m.role, content: m.content });
      }
      if (images && images.length > 0) {
        result.push({
          role: "user",
          content: [
            { type: "text", text: lastUserContent },
            ...images.map((url) => ({ type: "image_url", image_url: { url } })),
          ],
        });
      } else {
        result.push({ role: "user", content: lastUserContent });
      }
      return result;
    },
    [activeSession, worldBookForChat, activeGenPreset, activeInjections, sessionCards, isBlankSession],
  );

  // 格式分析（独立请求）：按设置解析执行模型 → analyzeScene → 更新消息内存 + 入库。
  // 关闭/未配置/失败时静默（前端隐藏场景与推荐，章节名回落第一章）
  const runSceneAnalysis = useCallback(async (msgId: string, body: string) => {
    const fm = useUIStore.getState().formatModel;
    if (!fm || fm.mode === "off") return;
    const ps = useProviderStore.getState();
    let provider = ps.providers.find((p) => p.id === ps.activeProviderId);
    let model = ps.activeModel;
    if (fm.mode === "custom") {
      const cp = ps.providers.find((p) => p.id === fm.providerId);
      if (!cp || !fm.model) return;
      provider = cp;
      model = fm.model;
    }
    if (!provider || !model) return;

    // 当前章节名：最近一条带 sceneAnalysis 的消息
    let prevChapter: string | undefined;
    for (let i = messagesRef.current.length - 1; i >= 0; i--) {
      const sa = messagesRef.current[i]?.sceneAnalysis;
      if (sa) {
        const parsed = parseSceneAnalysis(sa);
        if (parsed?.chapterTitle) {
          prevChapter = parsed.chapterTitle;
          break;
        }
      }
    }

    lastSceneTargetRef.current = { msgId, body };
    setSceneError(null);
    setAnalysingScene(true);
    try {
      const includeHidden = useUIStore.getState().hiddenProgressOn;
      const { analysis: result, error: analyzeError } = await analyzeScene({
        baseUrl: provider.baseUrl,
        apiKey: provider.apiKey,
        model,
        body,
        currentChapterTitle: prevChapter,
        includeHiddenProgress: includeHidden,
      });
      if (result && (result.suggestions.length > 0 || result.chapterTitle || result.location || result.characters)) {
        const json = JSON.stringify(result);
        // 分析请求消耗并入该消息 tokenUsage（↑ 分析 prompt，↓ 分析输出）
        const prevUsage = messagesRef.current.find((m) => m.id === msgId)?.tokenUsage;
        const usage = {
          input: (prevUsage?.input ?? 0) + estimateTokens(buildAnalyzePrompt(body, prevChapter, includeHidden)),
          output: (prevUsage?.output ?? 0) + estimateTokens(json),
        };
        setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, sceneAnalysis: json, tokenUsage: usage } : m)));
        messagesRef.current = messagesRef.current.map((m) =>
          m.id === msgId ? { ...m, sceneAnalysis: json, tokenUsage: usage } : m,
        );
        updateMessageSceneAnalysis(msgId, json).catch((e) =>
          console.error("[db] updateMessageSceneAnalysis failed:", e),
        );
        updateMessageTokenUsage(msgId, JSON.stringify(usage)).catch((e) =>
          console.error("[db] updateMessageTokenUsage failed:", e),
        );
      } else if (!result) {
        const reason = analyzeError ?? "模型未返回有效内容";
        setSceneError(reason);
        const now = Date.now();
        logError("useChat.runSceneAnalysis", "场景分析未产出结果", {
          model,
          provider: provider.baseUrl,
          reason,
        });
        if (now - lastSceneFailNotifyAt > 60_000) {
          lastSceneFailNotifyAt = now;
          useUIStore.getState().notify(`场景生成失败：${reason}`);
        }
      }
    } finally {
      setAnalysingScene(false);
    }
  }, []);

  const retrySceneAnalysis = useCallback(() => {
    const t = lastSceneTargetRef.current;
    if (!t || analysingScene) return;
    void runSceneAnalysis(t.msgId, t.body);
  }, [analysingScene, runSceneAnalysis]);

  const startStream = useCallback(
    (sessionId: string, apiMessages: ApiMessage[], tools?: ToolDefinition[]): Promise<{ toolCalls?: ToolCall[]; content: string; thinking: string }> => {
      return new Promise((resolve, reject) => {
        if (!activeProvider || !activeModel) return reject("No active provider");
        setStreaming(true);
        const abortController = new AbortController();
        abortRef.current = abortController;

        const placeholderMsg: Message = {
          id: crypto.randomUUID(),
          sessionId,
          role: "assistant",
          content: "",
          createdAt: Date.now(),
        };

        setMessages((prev) => [...prev, placeholderMsg]);
        insertMessage(placeholderMsg).catch(() => {});

        let finalContent = "";
        let finalThinking = "";
        let resolvedToolCalls: ToolCall[] | undefined;
        // 思考模式默认开启：仅当会话明确关闭（DB 存 0）时才关闭
        const thinkingEnabled = activeSession?.thinkingEnabled ?? true;
        let pendingContent = "";
        let pendingThinking = "";
        let flushRafId: number | null = null;
        let lastFlush = 0;

        const flush = (done: boolean) => {
          if (flushRafId) { cancelAnimationFrame(flushRafId); flushRafId = null; }
          if (!pendingContent && !pendingThinking && !done) return;
          const c = pendingContent;
          pendingContent = "";
          pendingThinking = "";
          const currentThinking = finalThinking;
          setMessages((prev2) => {
            const last = prev2[prev2.length - 1];
            if (last?.id === placeholderMsg.id) {
              const updated = [...prev2];
              updated[updated.length - 1] = {
                ...last,
                content: last.content + c,
                thinking: currentThinking || undefined,
              };
              return updated;
            }
            return prev2;
          });
        };

        (async () => {
          try {
            const genParams: Record<string, unknown> = {};
            if (!isBlankSession && activeGenPreset) {
              const p = activeGenPreset;
              genParams.temperature = p.temperature;
              if (p.topP > 0) genParams.top_p = p.topP;
              if (p.topK > 0) genParams.top_k = p.topK;
              if (p.minP > 0) genParams.min_p = p.minP;
              if (p.presencePenalty !== 0) genParams.presence_penalty = p.presencePenalty;
              if (p.frequencyPenalty !== 0) genParams.frequency_penalty = p.frequencyPenalty;
              if (p.maxTokens > 0) genParams.max_tokens = p.maxTokens;
            }
            for await (const chunk of chatStream(
              apiMessages,
              activeModel,
              activeProvider.baseUrl,
              activeProvider.apiKey,
              thinkingEnabled,
              tools,
              abortController.signal,
              genParams,
            )) {
              if (abortController.signal.aborted) break;
              if (chunk.toolCalls && chunk.toolCalls.length > 0) {
                resolvedToolCalls = chunk.toolCalls;
                break;
              }
              if (chunk.done) break;
              finalContent += chunk.content;
              if (chunk.thinking) finalThinking += chunk.thinking;
              pendingContent += chunk.content;
              if (chunk.thinking) pendingThinking += chunk.thinking;
              const now = performance.now();
              if (now - lastFlush > 20) {
                flush(false);
                lastFlush = now;
              } else if (!flushRafId) {
                flushRafId = requestAnimationFrame(() => {
                  flush(false);
                  lastFlush = performance.now();
                });
              }
            }
            flush(true);

            if (resolvedToolCalls) {
              // Remove the empty placeholder
              setMessages((prev) => prev.filter((m) => m.id !== placeholderMsg.id));
              deleteMessageDb(placeholderMsg.id).catch(() => {});
              resolve({ toolCalls: resolvedToolCalls, content: "", thinking: "" });
              return;
            }

            updateMessageContent(placeholderMsg.id, finalContent).catch(() => {});
            if (finalThinking) updateMessageThinking(placeholderMsg.id, finalThinking).catch(() => {});
            // token 消耗估算（估算制：↑输入=apiMessages 文本，↓输出=正文+思考）
            const inputTokens = apiMessages.reduce(
              (t, m) => t + estimateTokens(typeof m.content === "string" ? m.content : JSON.stringify(m.content ?? "")),
              0,
            );
            const outputTokens = estimateTokens(finalContent + (finalThinking || ""));
            {
              const usage = { input: inputTokens, output: outputTokens };
              updateMessageTokenUsage(placeholderMsg.id, JSON.stringify(usage)).catch(() => {});
              setMessages((prev) => prev.map((m) => (m.id === placeholderMsg.id ? { ...m, tokenUsage: usage } : m)));
              messagesRef.current = messagesRef.current.map((m) =>
                m.id === placeholderMsg.id ? { ...m, tokenUsage: usage } : m,
              );
            }
            // 格式分析（独立请求）：正文完成后生成章节名/场景信息/对话推荐（冒险会话或空白格式会话、未中断）
            if ((activeSession?.kind !== "blank" || activeSession?.formatEnabled) && !abortController.signal.aborted && finalContent.trim()) {
              void runSceneAnalysis(placeholderMsg.id, finalContent);
            }
            if (!abortController.signal.aborted && finalContent.trim()) {
              const storyId = useStoryStore.getState().activeStoryId || activeSession?.storyId;
              if (storyId) {
                void useStoryStore.getState().autoTitle(storyId);
                void useStoryStore.getState().recountWords(storyId);
              }
            }
            resolve({ content: finalContent, thinking: finalThinking });
          } catch (err: unknown) {
            if (err instanceof Error && err.name === "AbortError") {
              updateMessageContent(placeholderMsg.id, finalContent).catch(() => {});
              if (finalThinking) updateMessageThinking(placeholderMsg.id, finalThinking).catch(() => {});
              return;
            }
            const errMsg = "请求失败: " + (err instanceof Error ? err.message : String(err));
            logError("useChat.startStream", "正文流请求失败", {
              model: activeModel,
              provider: activeProvider.baseUrl,
              reason: err instanceof Error ? err.message : String(err),
            });
            setMessages((prev2) => {
              const last = prev2[prev2.length - 1];
              if (last?.id === placeholderMsg.id) {
                const updated = [...prev2];
                updated[updated.length - 1] = { ...last, content: errMsg };
                return updated;
              }
              return prev2;
            });
            updateMessageContent(placeholderMsg.id, errMsg).catch(() => {});
          } finally {
            setStreaming(false);
            abortRef.current = null;
          }
        })();
      });
    },
    [activeModel, activeProvider, activeSession, worldBookForChat, activeGenPreset, isBlankSession, runSceneAnalysis],
  );

  const sendMessage = useCallback(
    async (content: string, images?: string[], files?: AttachedFile[], opts?: { opening?: boolean }) => {
      if (streaming) return;
      const blocker = getSendBlocker();
      if (blocker) {
        if (opts?.opening) useUIStore.getState().setOpeningError(blocker);
        blockSend(blocker);
        return;
      }
      if (!activeProvider || !activeModel || !activeSession) {
        if (opts?.opening) useUIStore.getState().setOpeningError("还没准备好模型，开篇发不出去");
        return;
      }
      if (opts?.opening) useUIStore.getState().setOpeningError(null);
      const sessionId = activeSession.id;
      activeSessionIdRef.current = sessionId;

      // 自动压缩触发检查：历史超阈值时弹确认框并拦截本次发送（确认后压缩，用户可再发送）
      if (!isBlankSession && maybePromptCompress(sessionId, messagesRef.current)) return;
      if (useUIStore.getState().compressing) return;

      // 随机世界事件（插件开关，默认关闭）：每经过 4 条 user 消息尝试一次。
      // 尝试后无论是否抽中，间隔都重置（抽中→冷却 4 轮；未抽中→4 轮后重新尝试新事件）。
      // 每轮只抽一次（存 ref），buildApiMessages 消费注入；重试复用同一条
      pendingRandomEventRef.current = null;
      const uiState = useUIStore.getState();
      if (uiState.randomWorldEventOn && !isBlankSession && worldBookForChat && worldBookForChat.entries.length > 0) {
        // user 消息计数（含本次正要发送的一条）：4 条 user 消息为一个节奏周期
        const userCount = messagesRef.current.filter((m) => m.role === "user").length + 1;
        const state = randomEventStateRef.current.get(sessionId) || { lastTurn: 0, pickedIds: [] };
        if (userCount - state.lastTurn >= 4) {
          const recentText = [...messagesRef.current.slice(-2).map((m) => m.content), content].join("\n");
          const matchedIds = findMatchingEntries(worldBookForChat.entries, recentText).map((e) => e.id);
          const entry = pickRandomEventEntry(worldBookForChat.entries, matchedIds, state.pickedIds);
          const next = { lastTurn: userCount, pickedIds: state.pickedIds };
          if (entry) {
            const line = `【世界事件·${entry.title}】${entry.content}（可将此设定自然引入本段剧情，作为新进展、转折或悬念；不必强行出现）`;
            pendingRandomEventRef.current = { sessionId, line };
            next.pickedIds = [...state.pickedIds, entry.id].slice(-32);
          }
          randomEventStateRef.current.set(sessionId, next);
        }
      }

      let finalContent = content;
      if (files && files.length > 0) {
        const fileBlocks = files.map((f) => `[文件: ${f.name}]\n\`\`\`\n${f.content}\n\`\`\``).join("\n\n");
        finalContent = `${fileBlocks}\n\n${content}`;
      }

      const userMsg: Message = {
        id: crypto.randomUUID(),
        sessionId,
        role: "user",
        content: finalContent,
        images: images && images.length > 0 ? images : undefined,
        opening: opts?.opening ? true : undefined,
        createdAt: Date.now(),
      };
      const newMessages = [...messagesRef.current, userMsg];
      setMessages(newMessages);
      messagesRef.current = newMessages;
      insertMessage(userMsg).catch((e) => console.error("[db] insertMessage(user) failed:", e));

      // 发送前与界面开关同步，避免模块状态丢失后工具静默失效
      _toolsEnabled = useUIStore.getState().webSearchOn;
      const apiMessages = buildApiMessages(messagesRef.current.slice(0, -1), finalContent, images, _toolsEnabled, isPostCompress(sessionId));
      console.log("[tools] sendMessage: _toolsEnabled =", _toolsEnabled);
      const tools = _toolsEnabled ? await collectTools() : [];
      console.log("[tools] sendMessage: tools.length =", tools.length);
      let result;
      try {
        result = await startStream(sessionId, apiMessages, tools.length > 0 ? tools : undefined);
      } catch (e) {
        if (opts?.opening) {
          const msg = e instanceof Error ? e.message : String(e);
          useUIStore.getState().setOpeningError(msg || "开篇没有写出来");
        }
        throw e;
      }
      console.log("[tools] first stream done, toolCalls:", result?.toolCalls?.length || 0, "contentLen:", result?.content?.length || 0);

      // Fallback: retry only if user query clearly needs real-time info but model didn't call tools
      if (tools.length > 0 && (!result?.toolCalls || result.toolCalls.length === 0)) {
        const realtimeKeywords = /今天|昨日|最新|最近|实时|新闻|天气|股价|汇率|当前|现在|热点|头条|进展|突发|刚刚/;
        const lastMsg = messagesRef.current[messagesRef.current.length - 1];
        if (lastMsg && lastMsg.role === "user" && realtimeKeywords.test(finalContent)) {
          console.log("[tools] Real-time query detected but no tool calls, retrying...");
          const retryMessages = buildApiMessages(messagesRef.current.slice(0, -1), finalContent + "\n\n(请务必使用 web_search 工具搜索当前真实数据)", images, true);
          result = await startStream(sessionId, retryMessages, tools);
          console.log("[tools] retry done, toolCalls:", result?.toolCalls?.length || 0);
        }
      }

      // Tool call loop
      let toolRound = 0;
      while (result?.toolCalls && result.toolCalls.length > 0) {
        if (toolRound >= MAX_TOOL_ROUNDS) {
          const limitMsg: Message = {
            id: crypto.randomUUID(),
            sessionId,
            role: "assistant",
            content: `工具调用已达到 ${MAX_TOOL_ROUNDS} 轮上限，已停止继续调用工具。请收窄问题或手动重试。`,
            createdAt: Date.now(),
          };
          setMessages((prev) => [...prev, limitMsg]);
          messagesRef.current = [...messagesRef.current, limitMsg];
          insertMessage(limitMsg).catch(() => {});
          break;
        }
        toolRound += 1;
        setToolRunning(true);
        // Add assistant tool_call message
        const asstMsg: Message = {
          id: crypto.randomUUID(),
          sessionId,
          role: "assistant",
          content: "",
          createdAt: Date.now(),
          toolCalls: result.toolCalls,
          tools: result.toolCalls.map((tc) => tc.function.name),
          toolStatus: "running",
        };
        flushSync(() => { setMessages((prev) => [...prev, asstMsg]); });
        messagesRef.current = [...messagesRef.current, asstMsg];
        insertMessage(asstMsg).catch(() => {});

        // Execute each tool call
        const toolResults: { role: string; tool_call_id: string; content: string }[] = [];
        for (const tc of result.toolCalls) {
          const toolResult = await executeTool(tc);
          toolResults.push({
            role: "tool",
            tool_call_id: tc.id,
            content: toolResult,
          });
          // Add tool result as a message
          const toolMsg: Message = {
            id: crypto.randomUUID(),
            sessionId,
            role: "system",
            content: `[工具 ${tc.function.name} 返回]\n${toolResult}`,
            createdAt: Date.now(),
          };
          setMessages((prev) => [...prev, toolMsg]);
          messagesRef.current = [...messagesRef.current, toolMsg];
          insertMessage(toolMsg).catch(() => {});
        }
        // 工具调用正常完成,标记为 done
        setMessages((prev) => prev.map((m) => m.toolStatus === "running" ? { ...m, toolStatus: "done" } : m));
        messagesRef.current = messagesRef.current.map((m) => m.toolStatus === "running" ? { ...m, toolStatus: "done" } : m);
        setToolRunning(false);

        // Build new apiMessages including tool results
        const newApiMessages: ApiMessage[] = [];
        const basePrompt = activeSession?.systemPrompt || "";
        const now = new Date();
        const dateStr = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日`;
        const weekday = ["周日","周一","周二","周三","周四","周五","周六"][now.getDay()];
        const timeStr = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;
        const dateContext = `今天是 ${dateStr} ${weekday}，当前时间 ${timeStr}。`;
        const toolSystemPrompt = _toolsEnabled
          ? (basePrompt
              ? basePrompt + `\n\n【关键】${dateContext} 你刚才通过工具获取了实时搜索结果。你必须基于下方提供的搜索结果来回答用户的问题，引用其中的具体信息和数据，不要凭自身知识编造答案。如果搜索结果不足以回答问题，请说明。`
              : `${dateContext}你是一个智能助手。你刚才通过 web_search 工具获取了实时搜索结果。你必须基于下方提供的搜索结果来回答用户的问题，引用其中的具体信息、数据和来源，不要凭自身知识编造答案。如果搜索结果不足以回答问题，请直接说明。`)
          : basePrompt;
        if (toolSystemPrompt) {
          newApiMessages.push({ role: "system", content: toolSystemPrompt });
        }
        for (const m of messagesRef.current) {
          if (m.role === "user") {
            newApiMessages.push({ role: "user", content: m.content });
          } else if (m.role === "assistant") {
            // Skip display-only tool call messages (content starts with "工具调用:")
            if (!m.toolCalls && !(m.tools && !m.content.trim())) {
              newApiMessages.push({ role: "assistant", content: m.content });
            }
          }
        }
        // Add the assistant's tool_calls (proper API format)
        if (result.toolCalls) {
          newApiMessages.push({
            role: "assistant",
            content: null as unknown as string,
            tool_calls: result.toolCalls.map(tc => ({
              id: tc.id,
              type: "function",
              function: { name: tc.function.name, arguments: tc.function.arguments },
            })),
          });
        }
        // Add tool results
        for (const tr of toolResults) {
          console.log("[tools] toolResult:", tr.content.slice(0, 300), "...(len:", tr.content.length, ")");
          newApiMessages.push({
            role: "tool",
            content: tr.content,
            tool_call_id: tr.tool_call_id,
          });
        }

        result = await startStream(sessionId, newApiMessages, tools.length > 0 ? tools : undefined);
      }
    },
    [activeProvider, activeModel, activeSession, streaming, buildApiMessages, startStream],
  );

  // 开局自动发送：OnboardingFlow 设置 pendingOpeningMessage 后，等消息加载完成再发
  // 必须等 everLoadedRef 置位（loadMessages 完成）——否则 loadMessages 的 setMessages([])
  // 会清掉 streaming 的 placeholder，导致首条 AI 回复静默丢失（表现为"开始冒险后没反应"）
  const pendingOpeningMessage = useUIStore((s) => s.pendingOpeningMessage);
  useEffect(() => {
    if (!pendingOpeningMessage || !activeSession || loadingMessages) return;
    if (!everLoadedRef.current) return;
    useUIStore.getState().setPendingOpeningMessage(null);
    void sendMessage(pendingOpeningMessage, undefined, undefined, { opening: true });
  }, [pendingOpeningMessage, activeSession?.id, loadingMessages, sendMessage]);

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort();
    // 标记正在运行的工具调用为 aborted（红色底）
    setMessages((prev) => prev.map((m) => m.toolStatus === "running" ? { ...m, toolStatus: "aborted" } : m));
    messagesRef.current = messagesRef.current.map((m) => m.toolStatus === "running" ? { ...m, toolStatus: "aborted" } : m);
    setToolRunning(false);
  }, []);

  const deleteMessage = useCallback(async (id: string) => {
    const prev = messagesRef.current;
    const msg = prev.find((m) => m.id === id);
    if (!msg) return;

    let newList = prev.filter((m) => m.id !== id);

    if (msg.role === "assistant") {
      const idx = prev.findIndex((m) => m.id === id);
      if (idx > 0 && prev[idx - 1].role === "user") {
        const prevUser = prev[idx - 1];
        newList = newList.filter((m) => m.id !== prevUser.id);
        deleteMessageDb(prevUser.id).catch(() => {});
      }
    } else if (msg.role === "user") {
      const idx = prev.findIndex((m) => m.id === id);
      if (idx < prev.length - 1 && prev[idx + 1].role === "assistant") {
        const nextAssistant = prev[idx + 1];
        newList = newList.filter((m) => m.id !== nextAssistant.id);
        deleteMessageDb(nextAssistant.id).catch(() => {});
      }
    }
    deleteMessageDb(id).catch(() => {});
    setMessages(newList);
    messagesRef.current = newList;
  }, []);

  const editMessage = useCallback(async (id: string, content: string) => {
    setMessages((prev) => {
      const next = prev.map((m) => (m.id === id ? { ...m, content } : m));
      messagesRef.current = next;
      return next;
    });
    updateMessageContent(id, content).catch((e) =>
      console.error("[db] editMessage failed:", e),
    );
  }, []);

  const regenerate = useCallback(async (assistantId: string) => {
    if (streaming) return;
    const blocker = getSendBlocker();
    if (blocker) {
      blockSend(blocker);
      return;
    }
    const prev = messagesRef.current;
    const idx = prev.findIndex((m) => m.id === assistantId);
    if (idx < 0) return;

    const assistantMsg = prev[idx];
    const sessionId = assistantMsg.sessionId;
    deleteMessageDb(assistantId).catch(() => {});

    const userMsg = [...prev].reverse().find((m, i) => {
      const origIdx = prev.length - 1 - i;
      return origIdx < idx && m.role === "user";
    });
    if (!userMsg) return;

    const cutoffIdx = prev.findIndex((m) => m.id === userMsg.id);
    const newList = prev.slice(0, cutoffIdx + 1);
    setMessages(newList);
    messagesRef.current = newList;

      // 发送前与界面开关同步，避免模块状态丢失后工具静默失效
      _toolsEnabled = useUIStore.getState().webSearchOn;
    const apiMessages = buildApiMessages(
      newList.slice(0, -1),
      userMsg.content,
      userMsg.images,
      _toolsEnabled,
    );
    const tools = _toolsEnabled ? await collectTools() : [];
    let result = await startStream(sessionId, apiMessages, tools.length > 0 ? tools : undefined);

    if (tools.length > 0 && (!result?.toolCalls || result.toolCalls.length === 0)) {
      const lastMsg = messagesRef.current[messagesRef.current.length - 1];
      if (lastMsg && lastMsg.role === "user") {
        console.log("[tools] fallback: retrying with forced instruction...");
        const retryMsgs = buildApiMessages(messagesRef.current.slice(0, -1), lastMsg.content + "\n\n(请务必调用 web_search 工具来回答此问题)", lastMsg.images, true);
        result = await startStream(sessionId, retryMsgs, tools);
      }
    }

    let toolRound = 0;
    while (result?.toolCalls && result.toolCalls.length > 0) {
      if (toolRound >= MAX_TOOL_ROUNDS) {
        const limitMsg: Message = {
          id: crypto.randomUUID(),
          sessionId,
          role: "assistant",
          content: `工具调用已达到 ${MAX_TOOL_ROUNDS} 轮上限，已停止继续调用工具。请收窄问题或手动重试。`,
          createdAt: Date.now(),
        };
        setMessages((prev) => [...prev, limitMsg]);
        messagesRef.current = [...messagesRef.current, limitMsg];
        insertMessage(limitMsg).catch(() => {});
        break;
      }
      toolRound += 1;
      setToolRunning(true);
      const asstMsg: Message = {
        id: crypto.randomUUID(), sessionId, role: "assistant", content: "", createdAt: Date.now(),
        toolCalls: result.toolCalls, toolStatus: "running",
        tools: result.toolCalls.map((tc) => tc.function.name),
      };
      flushSync(() => { setMessages((prev) => [...prev, asstMsg]); });
      messagesRef.current = [...messagesRef.current, asstMsg];
      insertMessage(asstMsg).catch(() => {});

      const toolResults: { role: string; tool_call_id: string; content: string }[] = [];
      for (const tc of result.toolCalls) {
        const toolResult = await executeTool(tc);
        toolResults.push({ role: "tool", tool_call_id: tc.id, content: toolResult });
        const toolMsg: Message = {
          id: crypto.randomUUID(), sessionId, role: "system",
          content: `[工具 ${tc.function.name} 返回]\n${toolResult}`, createdAt: Date.now(),
        };
        setMessages((prev) => [...prev, toolMsg]);
        messagesRef.current = [...messagesRef.current, toolMsg];
        insertMessage(toolMsg).catch(() => {});
      }
      setMessages((prev) => prev.map((m) => m.toolStatus === "running" ? { ...m, toolStatus: "done" } : m));
      messagesRef.current = messagesRef.current.map((m) => m.toolStatus === "running" ? { ...m, toolStatus: "done" } : m);
      setToolRunning(false);

      const newApiMessages: ApiMessage[] = [];
      {
        const bp = activeSession?.systemPrompt || "";
        const now2 = new Date();
        const ds = `${now2.getFullYear()}年${now2.getMonth() + 1}月${now2.getDate()}日`;
        const wk = ["周日","周一","周二","周三","周四","周五","周六"][now2.getDay()];
        const ts = `${now2.getHours().toString().padStart(2, "0")}:${now2.getMinutes().toString().padStart(2, "0")}`;
        const dc = `今天是 ${ds} ${wk}，当前时间 ${ts}。`;
        const tsp = _toolsEnabled
          ? (bp ? bp + `\n\n【关键】${dc} 你刚才通过工具获取了实时搜索结果。你必须基于下方提供的搜索结果来回答用户的问题，引用其中的具体信息和数据，不要凭自身知识编造答案。如果搜索结果不足以回答问题，请说明。`
                : `${dc}你是一个智能助手。你刚才通过 web_search 工具获取了实时搜索结果。你必须基于下方提供的搜索结果来回答用户的问题，引用其中的具体信息、数据和来源，不要凭自身知识编造答案。如果搜索结果不足以回答问题，请直接说明。`)
          : bp;
        if (tsp) newApiMessages.push({ role: "system", content: tsp });
      }
      for (const m of messagesRef.current) {
        if (m.role === "user") {
          newApiMessages.push({ role: "user", content: m.content });
        } else if (m.role === "assistant" && !m.toolCalls && !(m.tools && !m.content.trim())) {
          newApiMessages.push({ role: "assistant", content: m.content });
        }
      }
      if (result.toolCalls) {
        newApiMessages.push({
          role: "assistant", content: null as unknown as string,
          tool_calls: result.toolCalls.map(tc => ({
            id: tc.id, type: "function", function: { name: tc.function.name, arguments: tc.function.arguments },
          })),
        });
      }
      for (const tr of toolResults) {
        console.log("[tools] toolResult:", tr.content.slice(0, 300), "...(len:", tr.content.length, ")");
        newApiMessages.push({ role: "tool", content: tr.content, tool_call_id: tr.tool_call_id });
      }

      result = await startStream(sessionId, newApiMessages, tools.length > 0 ? tools : undefined);
    }
  }, [streaming, buildApiMessages, startStream, activeSession]);

  const editAndSend = useCallback(async (userId: string, newContent: string) => {
    if (streaming) return;
    const blocker = getSendBlocker();
    if (blocker) {
      blockSend(blocker);
      return;
    }
    const prev = messagesRef.current;
    const idx = prev.findIndex((m) => m.id === userId);
    if (idx < 0) return;

    const userMsg = prev[idx];
    const sessionId = userMsg.sessionId;

    updateMessageContent(userId, newContent).catch(() => {});

    // Delete all messages after the edited user message
    for (let i = idx + 1; i < prev.length; i++) {
      deleteMessageDb(prev[i].id).catch(() => {});
    }
    let newList = prev.slice(0, idx + 1).map((m) =>
      m.id === userId ? { ...m, content: newContent } : m,
    );

    setMessages(newList);
    messagesRef.current = newList;

      // 发送前与界面开关同步，避免模块状态丢失后工具静默失效
      _toolsEnabled = useUIStore.getState().webSearchOn;
    const apiMessages = buildApiMessages(
      newList.filter((m) => m.id !== userId),
      newContent,
      userMsg.images,
      _toolsEnabled,
    );
    const tools = _toolsEnabled ? await collectTools() : [];
    let result = await startStream(sessionId, apiMessages, tools.length > 0 ? tools : undefined);

    if (tools.length > 0 && (!result?.toolCalls || result.toolCalls.length === 0)) {
      const lastMsg = messagesRef.current[messagesRef.current.length - 1];
      if (lastMsg && lastMsg.role === "user") {
        console.log("[tools] fallback: retrying with forced instruction...");
        const retryMsgs = buildApiMessages(messagesRef.current.slice(0, -1), lastMsg.content + "\n\n(请务必调用 web_search 工具来回答此问题)", lastMsg.images, true);
        result = await startStream(sessionId, retryMsgs, tools);
      }
    }

    let toolRound = 0;
    while (result?.toolCalls && result.toolCalls.length > 0) {
      if (toolRound >= MAX_TOOL_ROUNDS) {
        const limitMsg: Message = {
          id: crypto.randomUUID(),
          sessionId,
          role: "assistant",
          content: `工具调用已达到 ${MAX_TOOL_ROUNDS} 轮上限，已停止继续调用工具。请收窄问题或手动重试。`,
          createdAt: Date.now(),
        };
        setMessages((prev) => [...prev, limitMsg]);
        messagesRef.current = [...messagesRef.current, limitMsg];
        insertMessage(limitMsg).catch(() => {});
        break;
      }
      toolRound += 1;
      setToolRunning(true);
      const asstMsg: Message = {
        id: crypto.randomUUID(), sessionId, role: "assistant", content: "", createdAt: Date.now(),
        toolCalls: result.toolCalls, toolStatus: "running",
        tools: result.toolCalls.map((tc) => tc.function.name),
      };
      flushSync(() => { setMessages((prev) => [...prev, asstMsg]); });
      messagesRef.current = [...messagesRef.current, asstMsg];
      insertMessage(asstMsg).catch(() => {});

      const toolResults: { role: string; tool_call_id: string; content: string }[] = [];
      for (const tc of result.toolCalls) {
        const toolResult = await executeTool(tc);
        toolResults.push({ role: "tool", tool_call_id: tc.id, content: toolResult });
        const toolMsg: Message = {
          id: crypto.randomUUID(), sessionId, role: "system",
          content: `[工具 ${tc.function.name} 返回]\n${toolResult}`, createdAt: Date.now(),
        };
        setMessages((prev) => [...prev, toolMsg]);
        messagesRef.current = [...messagesRef.current, toolMsg];
        insertMessage(toolMsg).catch(() => {});
      }
      setMessages((prev) => prev.map((m) => m.toolStatus === "running" ? { ...m, toolStatus: "done" } : m));
      messagesRef.current = messagesRef.current.map((m) => m.toolStatus === "running" ? { ...m, toolStatus: "done" } : m);
      setToolRunning(false);

      const newApiMessages: ApiMessage[] = [];
      {
        const bp = activeSession?.systemPrompt || "";
        const now2 = new Date();
        const ds = `${now2.getFullYear()}年${now2.getMonth() + 1}月${now2.getDate()}日`;
        const wk = ["周日","周一","周二","周三","周四","周五","周六"][now2.getDay()];
        const ts = `${now2.getHours().toString().padStart(2, "0")}:${now2.getMinutes().toString().padStart(2, "0")}`;
        const dc = `今天是 ${ds} ${wk}，当前时间 ${ts}。`;
        const tsp = _toolsEnabled
          ? (bp ? bp + `\n\n【关键】${dc} 你刚才通过工具获取了实时搜索结果。你必须基于下方提供的搜索结果来回答用户的问题，引用其中的具体信息和数据，不要凭自身知识编造答案。如果搜索结果不足以回答问题，请说明。`
                : `${dc}你是一个智能助手。你刚才通过 web_search 工具获取了实时搜索结果。你必须基于下方提供的搜索结果来回答用户的问题，引用其中的具体信息、数据和来源，不要凭自身知识编造答案。如果搜索结果不足以回答问题，请直接说明。`)
          : bp;
        if (tsp) newApiMessages.push({ role: "system", content: tsp });
      }
      for (const m of messagesRef.current) {
        if (m.role === "user") {
          newApiMessages.push({ role: "user", content: m.content });
        } else if (m.role === "assistant" && !m.toolCalls && !(m.tools && !m.content.trim())) {
          newApiMessages.push({ role: "assistant", content: m.content });
        }
      }
      if (result.toolCalls) {
        newApiMessages.push({
          role: "assistant", content: null as unknown as string,
          tool_calls: result.toolCalls.map(tc => ({
            id: tc.id, type: "function", function: { name: tc.function.name, arguments: tc.function.arguments },
          })),
        });
      }
      for (const tr of toolResults) {
        console.log("[tools] toolResult:", tr.content.slice(0, 300), "...(len:", tr.content.length, ")");
        newApiMessages.push({ role: "tool", content: tr.content, tool_call_id: tr.tool_call_id });
      }

      result = await startStream(sessionId, newApiMessages, tools.length > 0 ? tools : undefined);
    }
  }, [streaming, buildApiMessages, startStream, activeSession]);

  const clearMessages = useCallback(() => {
    setMessages([]);
    messagesRef.current = [];
  }, []);

  return {
    messages,
    streaming,
    toolRunning,
    loadingMessages,
    analysingScene,
    sceneError,
    retrySceneAnalysis,
    sendMessage,
    stopStreaming,
    clearMessages,
    deleteMessage,
    editMessage,
    regenerate,
    editAndSend,
  };
}
