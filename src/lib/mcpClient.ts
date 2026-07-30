import type { McpTool } from "@/types";

async function tauriHttpFetch(url: string, method: string = "GET", headers: Record<string, string> = {}, body?: string): Promise<string> {
  const { invoke } = await import("@tauri-apps/api/core");
  const args: Record<string, unknown> = { url, method, headers };
  if (body !== undefined) args.body = body;
  return await invoke<string>("http_fetch", args);
}

async function tauriHttpFetchOk(url: string, method: string = "GET", headers: Record<string, string> = {}): Promise<boolean> {
  try {
    await tauriHttpFetch(url, method, headers);
    return true;
  } catch {
    return false;
  }
}

export async function listTools(baseUrl: string): Promise<McpTool[]> {
  try {
    const jsonText = await tauriHttpFetch(`${baseUrl}/tools`, "GET", { "Content-Type": "application/json" });
    const data = JSON.parse(jsonText);
    return data.tools || [];
  } catch (e) {
    console.error(`[mcp] listTools(${baseUrl}) failed:`, e);
    throw e;
  }
}

export async function callTool(
  baseUrl: string,
  toolName: string,
  args: Record<string, unknown>
): Promise<unknown> {
  try {
    const url = `${baseUrl}/tools/${encodeURIComponent(toolName)}`;
    const jsonText = await tauriHttpFetch(url, "POST", { "Content-Type": "application/json" }, JSON.stringify({ arguments: args }));
    const data = JSON.parse(jsonText);
    return data.result ?? data;
  } catch (e) {
    console.error(`[mcp] callTool(${toolName}) failed:`, e);
    throw e;
  }
}

export async function healthCheck(baseUrl: string): Promise<boolean> {
  // Try /health endpoint first
  const ok1 = await tauriHttpFetchOk(`${baseUrl}/health`);
  if (ok1) return true;

  // Fallback 1: try /tools endpoint (if it returns 200, server is up)
  const ok2 = await tauriHttpFetchOk(`${baseUrl}/tools`);
  if (ok2) return true;

  // Fallback 2: try root GET - if HTTP 200 the server is reachable
  const ok3 = await tauriHttpFetchOk(`${baseUrl}/`);
  return ok3;
}
