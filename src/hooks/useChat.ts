import { useState, useRef, useEffect, useCallback } from "react";
import { flushSync } from "react-dom";
import type { Message, AttachedFile, ToolDefinition, ToolCall } from "@/types";
import { chatStream } from "@/providers/openai";
import type { ApiMessage } from "@/providers/openai";
import { useProviderStore } from "@/stores/providerStore";
import { useSessionStore } from "@/stores/sessionStore";
import { loadMessages, insertMessage, updateMessageContent, updateMessageThinking, deleteMessage as deleteMessageDb, getAppSetting } from "@/lib/db";
import { getBuiltinTools, executeBuiltinTool } from "@/tools/builtinTools";
import { useMcpStore } from "@/stores/mcpStore";
import { callTool as callMcpTool } from "@/lib/mcpClient";

let _toolsEnabled = false;
export function setToolsEnabled(v: boolean) {
  console.log("[tools] setToolsEnabled:", v, new Error().stack?.split("\n").slice(1, 4).join("\n"));
  _toolsEnabled = v;
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
  const abortRef = useRef<AbortController | null>(null);
  const activeSessionIdRef = useRef<string | null>(null);
  const messagesRef = useRef<Message[]>([]);
  const everLoadedRef = useRef(false);

  const { providers, activeProviderId, activeModel } = useProviderStore();
  const activeSession = useSessionStore((s) =>
    s.activeId ? s.sessions.find((ss) => ss.id === s.activeId) : null,
  );
  const activeProvider = providers.find((p) => p.id === activeProviderId);

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
    return () => { cancelled = true; };
  }, [activeSession?.id]);

  const buildApiMessages = useCallback(
    (history: Message[], lastUserContent: string, images?: string[], toolHint?: boolean): ApiMessage[] => {
      const result: ApiMessage[] = [];
      const basePrompt = activeSession?.systemPrompt || "";
      if (toolHint) {
        const now = new Date();
        const dateStr = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日`;
        const weekday = ["周日","周一","周二","周三","周四","周五","周六"][now.getDay()];
        const timeStr = `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`;
        const dateContext = `今天是 ${dateStr} ${weekday}，当前时间 ${timeStr}。`;
        const toolSystemPrompt = basePrompt
          ? basePrompt + `\n\n【重要】${dateContext} 你有可用的工具。当用户询问需要实时信息、新闻、数据时，必须使用 web_search 工具搜索，而不是凭知识回答。搜索时请使用当前日期。`
          : `${dateContext}你是一个智能助手。你拥有 web_search 工具可以搜索互联网。当用户询问需要实时信息、新闻、当前事件、具体数据或事实核查时，你必须调用 web_search 工具来获取准确答案，而不是凭你的知识直接回答。`;
        result.push({ role: "system", content: toolSystemPrompt });
      } else if (basePrompt) {
        result.push({ role: "system", content: basePrompt });
      }
      for (const m of history) {
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
    [activeSession],
  );

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
        const thinkingEnabled = activeSession?.thinkingEnabled ?? false;
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
            for await (const chunk of chatStream(
              apiMessages,
              activeModel,
              activeProvider.baseUrl,
              activeProvider.apiKey,
              thinkingEnabled,
              tools,
              abortController.signal,
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
            resolve({ content: finalContent, thinking: finalThinking });
          } catch (err: unknown) {
            if (err instanceof Error && err.name === "AbortError") {
              updateMessageContent(placeholderMsg.id, finalContent).catch(() => {});
              if (finalThinking) updateMessageThinking(placeholderMsg.id, finalThinking).catch(() => {});
              return;
            }
            const errMsg = "请求失败: " + (err instanceof Error ? err.message : String(err));
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
    [activeModel, activeProvider, activeSession],
  );

  const sendMessage = useCallback(
    async (content: string, images?: string[], files?: AttachedFile[]) => {
      if (!activeProvider || !activeModel || !activeSession || streaming) return;
      const sessionId = activeSession.id;
      activeSessionIdRef.current = sessionId;

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
        createdAt: Date.now(),
      };
      const newMessages = [...messagesRef.current, userMsg];
      setMessages(newMessages);
      messagesRef.current = newMessages;
      insertMessage(userMsg).catch((e) => console.error("[db] insertMessage(user) failed:", e));

      const apiMessages = buildApiMessages(messagesRef.current.slice(0, -1), finalContent, images, _toolsEnabled);
      console.log("[tools] sendMessage: _toolsEnabled =", _toolsEnabled);
      const tools = _toolsEnabled ? await collectTools() : [];
      console.log("[tools] sendMessage: tools.length =", tools.length);
      let result = await startStream(sessionId, apiMessages, tools.length > 0 ? tools : undefined);
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
      while (result?.toolCalls && result.toolCalls.length > 0) {
        setToolRunning(true);
        // Add assistant tool_call message
        const asstMsg: Message = {
          id: crypto.randomUUID(),
          sessionId,
          role: "assistant",
          content: "",
          createdAt: Date.now(),
          toolCalls: result.toolCalls,
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
            if (!m.toolCalls) {
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

    while (result?.toolCalls && result.toolCalls.length > 0) {
      setToolRunning(true);
      const asstMsg: Message = {
        id: crypto.randomUUID(), sessionId, role: "assistant", content: "", createdAt: Date.now(),
        toolCalls: result.toolCalls, toolStatus: "running",
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
        } else if (m.role === "assistant" && !m.toolCalls) {
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

    while (result?.toolCalls && result.toolCalls.length > 0) {
      setToolRunning(true);
      const asstMsg: Message = {
        id: crypto.randomUUID(), sessionId, role: "assistant", content: "", createdAt: Date.now(),
        toolCalls: result.toolCalls, toolStatus: "running",
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
        } else if (m.role === "assistant" && !m.toolCalls) {
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
    sendMessage,
    stopStreaming,
    clearMessages,
    deleteMessage,
    editMessage,
    regenerate,
    editAndSend,
  };
}
