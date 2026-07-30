import { create } from "zustand";
import type { McpServer, McpTool, ToolDefinition } from "@/types";
import {
  loadMcpServers,
  insertMcpServer,
  updateMcpServer,
  deleteMcpServer,
} from "@/lib/db";

interface McpState {
  servers: McpServer[];
  tools: McpTool[];
  loaded: boolean;
  activeServerIds: string[];
  loadFromDb: () => Promise<void>;
  addServer: (s: Omit<McpServer, "createdAt" | "updatedAt" | "status">) => Promise<void>;
  updateServer: (id: string, fields: Partial<Pick<McpServer, "name" | "url" | "transportType" | "config">>) => Promise<void>;
  removeServer: (id: string) => Promise<void>;
  setServerStatus: (id: string, status: McpServer["status"]) => Promise<void>;
  setActiveServers: (ids: string[]) => void;
  fetchTools: (serverId: string) => Promise<McpTool[]>;
  getActiveToolDefs: () => ToolDefinition[];
}

async function fetchToolsFromServer(url: string): Promise<McpTool[]> {
  try {
    const resp = await fetch(`${url}/tools`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const data = await resp.json();
    return data.tools || [];
  } catch (e) {
    console.error("[mcp] fetchTools failed:", e);
    return [];
  }
}

export const useMcpStore = create<McpState>((set, get) => ({
  servers: [],
  tools: [],
  loaded: false,
  activeServerIds: [],

  loadFromDb: async () => {
    try {
      const servers = await loadMcpServers();
      set({ servers, loaded: true });
    } catch (e) {
      console.error("[db] loadMcpServers failed:", e);
      set({ loaded: true });
    }
  },

  addServer: async (s) => {
    const now = Date.now();
    const newS: McpServer = { ...s, status: "disconnected", createdAt: now, updatedAt: now };
    await insertMcpServer(newS);
    set((st) => ({ servers: [newS, ...st.servers] }));
  },

  updateServer: async (id, fields) => {
    const now = Date.now();
    await updateMcpServer(id, { ...fields, updatedAt: now });
    set((st) => ({
      servers: st.servers.map((s) =>
        s.id === id ? { ...s, ...fields, updatedAt: now } : s
      ),
    }));
  },

  removeServer: async (id) => {
    await deleteMcpServer(id);
    set((st) => ({
      servers: st.servers.filter((s) => s.id !== id),
      activeServerIds: st.activeServerIds.filter((sid) => sid !== id),
    }));
  },

  setServerStatus: async (id, status) => {
    const now = Date.now();
    await updateMcpServer(id, { status, updatedAt: now });
    set((st) => ({
      servers: st.servers.map((s) =>
        s.id === id ? { ...s, status, updatedAt: now } : s
      ),
    }));
  },

  setActiveServers: (ids) => {
    set({ activeServerIds: ids });
  },

  fetchTools: async (serverId) => {
    const server = get().servers.find((s) => s.id === serverId);
    if (!server) return [];
    const tools = await fetchToolsFromServer(server.url);
    set((st) => {
      const existing = st.tools.filter((t) => !st.activeServerIds.some((sid) => {
        const s = st.servers.find((x) => x.id === sid);
        return s ? t.name.startsWith(s.id) : false;
      }));
      const prefixed = tools.map((t) => ({
        ...t,
        name: `${server.id}:${t.name}`,
      }));
      return { tools: [...existing, ...prefixed] };
    });
    return tools;
  },

  getActiveToolDefs: () => {
    const { servers, activeServerIds, tools } = get();
    const defs: ToolDefinition[] = [];
    for (const sid of activeServerIds) {
      const serverTools = tools.filter(t => t.name.startsWith(sid + ":"));
      for (const t of serverTools) {
        defs.push({
          type: "function",
          function: {
            name: t.name,
            description: t.description,
            parameters: t.inputSchema as Record<string, unknown>,
          },
        });
      }
    }
    return defs;
  },
}));