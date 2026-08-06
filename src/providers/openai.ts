import type { ChatStreamChunk, ToolDefinition, ToolCall } from "@/types";

export async function fetchAvailableModels(
  baseUrl: string,
  apiKey: string,
): Promise<string[]> {
  const url = `${baseUrl.replace(/\/+$/, "")}/models`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };

  let jsonText: string;

  try {
    const { invoke } = await import("@tauri-apps/api/core");
    const args: Record<string, unknown> = { url, method: "GET", headers };
    jsonText = await invoke<string>("http_fetch", args);
  } catch {
    const res = await fetch(url, {
      method: "GET",
      headers,
    });
    if (!res.ok) {
      const err = await res.text().catch(() => "Unknown error");
      throw new Error(`获取模型列表失败 ${res.status}: ${err}`);
    }
    jsonText = await res.text();
  }

  const data = JSON.parse(jsonText);
  const models: string[] = [];
  const seen = new Set<string>();

  const addModel = (id: string) => {
    if (id && !seen.has(id)) {
      seen.add(id);
      models.push(id);
    }
  };

  // Format 1: OpenAI standard { data: [{ id: "..." }] }
  if (Array.isArray(data?.data)) {
    for (const item of data.data) {
      if (item?.id) addModel(item.id);
    }
  }
  // Format 2: Array of strings ["model1", "model2"]
  else if (Array.isArray(data)) {
    for (const item of data) {
      if (typeof item === "string") addModel(item);
      else if (item?.id) addModel(item.id);
    }
  }
  // Format 3: { models: [...] }
  else if (Array.isArray(data?.models)) {
    for (const item of data.models) {
      if (typeof item === "string") addModel(item);
      else if (item?.id) addModel(item.id);
    }
  }
  // Format 4: { data: "..." } or single model
  else if (typeof data?.data === "string") {
    addModel(data.data);
  }

  return models.sort();
}

export type ApiMessage = {
  role: string;
  content: string | null | ({ type: string; text?: string; image_url?: { url: string } })[];
  tool_calls?: Array<{
    id: string;
    type: string;
    function: { name: string; arguments: string };
  }>;
  tool_call_id?: string;
};

export const IMAGE_SIZE_LIMIT = 10 * 1024 * 1024;
export const FILE_SIZE_LIMIT = 5 * 1024 * 1024;
export const MAX_IMAGES = 5;
export const MAX_FILES = 3;
export const IMAGE_ACCEPT = "image/png,image/jpeg,image/gif,image/webp,image/bmp";
export const FILE_ACCEPT = ".txt,.md,.json,.csv,.py,.ts,.js,.html,.css,.xml,.yml,.yaml,.log";

interface PartialToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

/** 从 API 读取流式响应的统一抽象：返回 { done, value } */
type NextChunk = () => Promise<{ done: boolean; value: Uint8Array | null }>;

export async function* chatStream(
  messages: ApiMessage[],
  model: string,
  baseUrl: string,
  apiKey: string,
  thinkingEnabled: boolean,
  tools?: ToolDefinition[],
  signal?: AbortSignal,
  params?: Record<string, unknown>,
): AsyncGenerator<ChatStreamChunk> {
  const url = `${baseUrl.replace(/\/+$/, "")}/chat/completions`;

  const body: Record<string, unknown> = { model, messages, stream: true, ...params };
  const hasTools = tools && tools.length > 0;
  if (thinkingEnabled && !hasTools) {
    body.thinking = { type: "enabled" };
  }
  if (hasTools) {
    body.tools = tools;
    body.tool_choice = "auto";
    if (thinkingEnabled) {
      console.log("[chatStream] thinking mode disabled because tools are active (API incompatibility)");
    }
  }

  console.log("[chatStream] body:", JSON.stringify({ ...body, messages: undefined }, null, 2).slice(0, 500));
  if (tools && tools.length > 0) {
    console.log("[chatStream] tools sent:", tools.map(t => t.function?.name));
  }

  const requestId = crypto.randomUUID();
  let cleanup: (() => void) | undefined;

  // 统一走 Rust 后端流式转发（chat_completions_stream）：绕过 WebView2 CORS，
  // 所有 Provider 行为一致，错误信息明确（不再出现模糊的 Failed to fetch）
  const { invoke, Channel } = await import("@tauri-apps/api/core");
  const channel = new Channel<number[]>();
  const queue: Uint8Array[] = [];
  let waiter: ((v: { done: boolean; value: Uint8Array | null }) => void) | null = null;
  let streamDone = false;
  let streamError: Error | null = null;

  channel.onmessage = (chunk: number[]) => {
    const u8 = Uint8Array.from(chunk);
    if (waiter) {
      const w = waiter;
      waiter = null;
      w({ done: false, value: u8 });
    } else {
      queue.push(u8);
    }
  };

  const onAbort = () => {
    void invoke("chat_stream_abort", { requestId });
  };
  signal?.addEventListener("abort", onAbort);
  cleanup = () => signal?.removeEventListener("abort", onAbort);

  void invoke("chat_completions_stream", {
    requestId,
    url,
    apiKey,
    body: JSON.stringify(body),
    onChunk: channel,
  })
    .then(() => { streamDone = true; })
    .catch((err: unknown) => {
      streamError = err instanceof Error ? err : new Error(String(err));
      streamDone = true;
    });

  const next: NextChunk = async () => {
    while (!streamDone && queue.length === 0 && !streamError) {
      if (signal?.aborted) return { done: true, value: null };
      await new Promise<void>((resolve) => setTimeout(resolve, 15));
    }
    if (streamError) throw streamError;
    if (queue.length > 0) return { done: false, value: queue.shift()! };
    return { done: true, value: null };
  };

  const decoder = new TextDecoder();
  let buffer = "";
  const toolCallsMap = new Map<number, PartialToolCall>();

  try {
    while (true) {
      const { done, value } = await next();
      if (done) break;

      buffer += decoder.decode(value ?? new Uint8Array(), { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith("data: ")) continue;
        const data = trimmed.slice(6);
        if (data === "[DONE]") {
          yield { content: "", done: true };
          return;
        }
        try {
          const parsed = JSON.parse(data);
          const choice = parsed.choices?.[0];
          const delta = choice?.delta;
          if (!delta) continue;

          const content = delta?.content ?? "";
          const thinking = delta?.reasoning_content ?? "";

          if (delta?.tool_calls) {
            for (const tc of delta.tool_calls) {
              const idx = tc.index ?? 0;
              if (!toolCallsMap.has(idx)) {
                toolCallsMap.set(idx, { id: "", type: "function", function: { name: "", arguments: "" } });
              }
              const existing = toolCallsMap.get(idx)!;
              if (tc.id) existing.id = tc.id;
              if (tc.function?.name) existing.function.name += tc.function.name;
              if (tc.function?.arguments) existing.function.arguments += tc.function.arguments;
            }
          }

          if (content || thinking) {
            yield { content, thinking: thinking || undefined, done: false };
          }

          if (choice?.finish_reason === "tool_calls" && toolCallsMap.size > 0) {
            const toolCalls: ToolCall[] = [];
            for (const [, tc] of toolCallsMap) {
              toolCalls.push({
                id: tc.id || "",
                type: "function",
                function: {
                  name: tc.function?.name || "",
                  arguments: tc.function?.arguments || "{}",
                },
              });
            }
            console.log("[chatStream] tool_calls received:", toolCalls.map(t => t.function?.name));
            toolCallsMap.clear();
            yield { content: "", done: true, toolCalls };
            return;
          }
        } catch { /* skip */ }
      }

      if (toolCallsMap.size > 0) {
        const toolCalls: ToolCall[] = [];
        for (const [, tc] of toolCallsMap) {
          toolCalls.push({
            id: tc.id || "",
            type: "function",
            function: {
              name: tc.function?.name || "",
              arguments: tc.function?.arguments || "{}",
            },
          });
        }
        console.log("[chatStream] tool_calls recovered (no finish_reason):", toolCalls.map(t => t.function?.name));
        toolCallsMap.clear();
        yield { content: "", done: true, toolCalls };
        return;
      }
    }
  } finally {
    cleanup?.();
  }
  yield { content: "", done: true };
}

const THINKING_MODEL_PATTERNS = [
  /^o[134]\b/i,
  "reasoner", "thinking",
  "deepseek-r1", "deepseek-v3.1", "deepseek-v3.2", "deepseek-v4",
  "claude-3-7", "claude-3.7", "claude-sonnet-4", "claude-opus-4",
  "gemini-2.0-flash-thinking", "gemini-2.5", "gemini-3",
  "qwq", "qvq", "qwen3",
  "kimi-k2", "kimi-k3",
  "glm-4.5", "glm-4.7", "glm-5",
  "minimax-m2", "minimax-m3",
  "grok-3", "grok-4",
  "mimo",
  "doubao-pro-thinking", "doubao-1.5-pro",
];

export function isThinkingModel(model: string): boolean {
  const m = model.toLowerCase();
  return THINKING_MODEL_PATTERNS.some((p) =>
    typeof p === "string" ? m.includes(p) : p.test(model),
  );
}