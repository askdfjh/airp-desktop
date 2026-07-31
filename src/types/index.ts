export type ProviderType = "openai" | "deepseek" | "anthropic" | "google" | "moonshot" | "dashscope" | "zhipuai" | "openrouter" | "opencode" | "custom";

export interface ProviderConfig {
  id: string;
  name: string;
  type: ProviderType;
  apiKey: string;
  baseUrl: string;
  models: string[];
  supportsImages?: boolean;
  thinkingModels?: string[];
}

export interface AttachedFile {
  name: string;
  content: string;
}

export interface Session {
  id: string;
  title: string;
  systemPrompt: string;
  providerId: string;
  model: string;
  thinkingEnabled: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface Message {
  id: string;
  sessionId: string;
  role: "user" | "assistant" | "system";
  content: string;
  thinking?: string;
  images?: string[];
  createdAt: number;
  // 工具调用相关（运行时内存字段，不持久化到 DB）
  toolCalls?: ToolCall[];
  toolStatus?: "running" | "done" | "aborted";
}

export interface ChatStreamChunk {
  content: string;
  thinking?: string;
  done: boolean;
  toolCalls?: ToolCall[];
}

export interface PromptTemplate {
  id: string;
  title: string;
  content: string;
  category: string;
  isBuiltin: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface CharacterCard {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  emoji: string;
  tags: string[];
  isBuiltin: boolean;
  personality?: string;
  scenario?: string;
  firstMes?: string;
  mesExample?: string;
  worldBookId?: string | null;
  characterBookEntries?: WorldBookEntry[];
  createdAt: number;
  updatedAt: number;
}


export interface WorldBookEntry {
  id: string;
  uid: number;
  category: string;
  title: string;
  key: string[];
  keysecondary?: string[];
  content: string;
  constant: boolean;
  selective: boolean;
  order: number;
  position: "system" | "situation" | "last";
  insertionDepth: number;
  disable: boolean;
  linkedCharacterIds?: string[];
  createdAt: number;
  updatedAt: number;
}

export interface WorldBook {
  id: string;
  name: string;
  theme: string;
  description: string;
  tags: string[];
  isActive: boolean;
  isBuiltin: boolean;
  violationWords: string[];
  entries: WorldBookEntry[];
  createdAt: number;
  updatedAt: number;
}


export interface Character {
  id: string;
  name: string;
  appearance: string;
  personality: string;
  background: string;
  tags: string[];
  avatar?: string;
  isBuiltin: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface CharacterArc {
  id: string;
  characterId: string;
  sessionId: string;
  worldContext: string;
  event: string;
  description: string;
  turnCount: number;
  createdAt: number;
}

export interface SessionCharacter {
  id: string;
  sessionId: string;
  characterId: string;
  worldContext: string;
  arcClearedAt: number | null;
  createdAt: number;
}

export interface McpServer {
  id: string;
  name: string;
  url: string;
  transportType: "http" | "sse" | "stdio";
  config: Record<string, unknown>;
  status: "connected" | "disconnected" | "error";
  createdAt: number;
  updatedAt: number;
}


export interface WorldRule {
  id: string;
  name: string;
  description: string;
  rules: string;
  isActive: boolean;
  isBuiltin: boolean;
  createdAt: number;
  updatedAt: number;
}

export type ToolDefinition = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

export interface ToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}
export interface McpTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}