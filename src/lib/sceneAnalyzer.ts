import { chatStream, type ApiMessage } from "@/providers/openai";
import { isMetaSuggestion } from "@/lib/sceneTemplate";

/** 格式分析结果：章节名 + 场景信息 + 对话推荐 + 角色后台进展（独立 API 请求生成） */
export interface SceneAnalysis {
  chapterTitle?: string;
  location?: string;
  time?: string;
  characters?: string;
  cause?: string;
  suggestions: string[];
  /** 其他主要角色在幕后的进展（玩家不可见，注入下一轮正文生成上下文） */
  hiddenProgress?: string;
}

export function buildAnalyzePrompt(
  body: string,
  currentChapterTitle?: string,
  includeHiddenProgress = true,
): string {
  return `你是小说版面编辑。根据下方故事正文，提取版面信息并严格输出 JSON（不要 Markdown 代码块标记，不要任何解释文字，只输出 JSON 对象本身）：

{
  "chapterTitle": "章节名：仅当剧情推进到新阶段（场景切换/重大事件/时间跳跃）时才更新，4-10 字古典章回体风格（如：初入宗门、山门惊变）；否则原样返回当前章节名${currentChapterTitle ? `「${currentChapterTitle}」` : "（没有则返回空字符串）"}",
  "location": "当前具体地点，一句话",
  "time": "当前时间（如：辰时·上午、深夜）",
  "characters": "本段出场角色名，用顿号分隔",
  "cause": "本段剧情的起因，一句话",
  "suggestions": ["下一步可执行的剧情行动或对话", "第二条", "第三条"]${includeHiddenProgress ? `,
  "hiddenProgress": "一句话概括其他主要角色（不包含主角）在幕后的各自进展——他们的行动、计划、动向；这是玩家不可见的幕后信息，正文中不得出现"` : ""}
}

要求：
- suggestions 必须输出 3 条，是玩家可直接执行的剧情行动或对话（探索、交谈、战斗、观察、思考等）
- 严禁元操作类选项（查看世界设定/图鉴/背景资料/角色设定等），严禁把注入的设定条目原样抄入推荐
- 所有字段值为空时用空字符串

【故事正文】
${body}`;
}

/**
 * 独立执行格式分析：正文完成后调用（可绑定独立模型，建议用快速模型）。
 * 复用 chatStream（Rust 后端流式，无 CORS 问题），无思考、无工具，输出收集为完整 JSON。
 */
export async function analyzeScene(params: {
  baseUrl: string;
  apiKey: string;
  model: string;
  body: string;
  currentChapterTitle?: string;
  includeHiddenProgress?: boolean;
  signal?: AbortSignal;
}): Promise<SceneAnalysis | null> {
  const { baseUrl, apiKey, model, body, currentChapterTitle, includeHiddenProgress, signal } = params;
  const messages: ApiMessage[] = [
    { role: "system", content: buildAnalyzePrompt(body, currentChapterTitle, includeHiddenProgress ?? true) },
  ];
  let out = "";
  try {
    for await (const chunk of chatStream(
      messages,
      model,
      baseUrl,
      apiKey,
      false,
      undefined,
      signal,
      { temperature: 0.3, max_tokens: 1500 },
    )) {
      if (chunk.done) break;
      out += chunk.content;
    }
  } catch (e) {
    console.error("[sceneAnalyze] failed:", e instanceof Error ? e.message : String(e));
    return null;
  }
  if (out.trim()) console.log("[sceneAnalyze] output:", out.slice(0, 400));
  return parseSceneAnalysis(out);
}

/** 容错解析分析 JSON：先整体解析（纯 JSON 输出），再剥代码块、取首尾大括号；失败时打印原始输出便于诊断。 */
export function parseSceneAnalysis(text: string): SceneAnalysis | null {
  if (!text) return null;
  let t = text.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();

  let parsed: unknown = null;
  // 1. 整体解析（模型输出纯 JSON 时直接命中）
  try {
    parsed = JSON.parse(t);
  } catch {
    // 2. 剥除思考/前缀：思考型模型（如 deepseek-v4）会在 JSON 前输出 reasoning，
    //    从后往前找最后一个独立 JSON 对象：定位 "suggestions"/"hiddenProgress" 等关键字段
    const keyIdx = t.lastIndexOf('"suggestions"');
    const startGuess = keyIdx >= 0 ? t.lastIndexOf("{", keyIdx) : t.indexOf("{");
    const start = startGuess >= 0 ? startGuess : t.indexOf("{");
    const end = t.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        parsed = JSON.parse(t.slice(start, end + 1));
      } catch {
        parsed = null;
      }
    }
  }
  if (!parsed) {
    console.error("[sceneAnalyze] JSON 解析失败，原始输出:", text.slice(0, 600));
    return null;
  }
  if (typeof parsed !== "object") return null;
  const d = parsed as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const suggestions = Array.isArray(d.suggestions)
    ? d.suggestions
        .map((s) => (typeof s === "string" ? s.trim() : ""))
        .filter((s) => Boolean(s) && !isMetaSuggestion(s))
        .slice(0, 5)
    : [];
  return {
    chapterTitle: str(d.chapterTitle) || undefined,
    location: str(d.location) || undefined,
    time: str(d.time) || undefined,
    characters: str(d.characters) || undefined,
    cause: str(d.cause) || undefined,
    suggestions,
    hiddenProgress: str(d.hiddenProgress) || undefined,
  };
}
