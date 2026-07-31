import type { ToolDefinition } from "@/types";
import { webSearch, type SearchProvider } from "./search";

export interface BuiltinTool {
  definition: ToolDefinition;
  execute: (args: Record<string, unknown>) => Promise<string>;
}

async function getSearchConfig(): Promise<{ provider: SearchProvider; apiKey: string }> {
  let provider: SearchProvider = "duckduckgo";
  let apiKey = "";
  try {
    const m = await import("@/lib/db");
    const p = await m.getAppSetting("search_provider");
    if (p && ["serper", "bing", "brave", "tavily", "duckduckgo"].includes(p)) provider = p as SearchProvider;
    const k = await m.getAppSetting("search_api_key");
    if (k) apiKey = k;
  } catch {}
  return { provider, apiKey };
}

const toolRegistry: Record<string, BuiltinTool> = {
  web_search: {
    definition: {
      type: "function",
      function: {
        name: "web_search",
        description: "搜索互联网获取实时信息。当用户询问最新新闻、当前事件、实时数据、具体事实核查、最新动态、需要引用来源或任何需要联网查询的信息时，必须调用此工具。工具会自动使用当前日期搜索，你不需要在 query 中包含日期。",
        parameters: {
          type: "object",
          properties: {
            query: {
              type: "string",
              description: "搜索关键词。用简洁的中文短语描述要查找的内容和实体名称即可，不需要包含日期（工具会自动注入当前日期）。",
            },
          },
          required: ["query"],
        },
      },
    },
    execute: async (args) => {
      let query = String(args.query ?? "");
      if (!query.trim()) return "请提供搜索关键词";

      const now = new Date();
      const y = now.getFullYear();
      const m = now.getMonth() + 1;
      const d = now.getDate();
      const dateStr = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

      // Strip hallucinated old years but KEEP current year (model may now know the date from system prompt)
      query = query
        .replace(/\b(19|20)\d{2}\b/g, (match) => {
          const yr = parseInt(match);
          // Keep current year and previous year (model might correctly use these)
          if (yr >= y - 1 && yr <= y + 1) return match;
          return "";
        })
        .replace(/\s+/g, " ")
        .trim();

      // Append current date so search engines return fresh, relevant results
      query = `${query} ${dateStr}`.trim();

      console.log("[web_search] final query:", query);

      try {
        const { provider, apiKey } = await getSearchConfig();
        const result = await webSearch(query, provider, apiKey);
        return result;
      } catch (e) {
        return "搜索失败: " + (e instanceof Error ? e.message : String(e));
      }
    },
  },
};

export function getBuiltinTools(enabledTools: string[]): ToolDefinition[] {
  return enabledTools
    .filter((name) => toolRegistry[name])
    .map((name) => toolRegistry[name].definition);
}

export async function executeBuiltinTool(name: string, args: Record<string, unknown>): Promise<string> {
  const tool = toolRegistry[name];
  if (!tool) throw new Error(`未知内置工具: ${name}`);
  return tool.execute(args);
}
