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

export interface GenerationPreset {
  id: string;
  name: string;
  description: string;
  temperature: number;
  topP: number;
  topK: number;
  minP: number;
  presencePenalty: number;
  frequencyPenalty: number;
  maxTokens: number;
  outputStyle: string;
  isBuiltin: boolean;
}

export interface PromptInjection {
  id: string;
  text: string;
  modelIds: string[];
  applied: boolean;
  createdAt: number;
}

export interface SessionEntry {
  id: string;
  title: string;
  key: string[];
  content: string;
  createdAt: number;
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
  deletedAt?: number;
  kind?: "adventure" | "blank";
  /** 空白会话独立格式开关：仅启用章节/场景/推荐格式分析，不注入世界书/角色卡/文风（内容保持空白） */
  formatEnabled?: boolean;
  // 长对话压缩：故事脉络摘要（增量追加）+ 压缩状态
  contextSummary?: string;
  summaryUpdatedAt?: number;
  summaryCount?: number;
  lastSummarizedMessageId?: string;
  // 故事链（压缩续集体系）：chainId 链标识（首卷=自身 id）、chainIndex 卷号、parentId 上一卷
  chainId?: string;
  chainIndex?: number;
  parentId?: string | null;
  // 压缩后原会话锁定只读（可创建分支）
  locked?: boolean;
  // 剧情档案（结构化：局势/角色现状/关键事件/伏笔）+ 关键词索引（JSON：关键词→消息 id）
  archive?: string;
  contextIndex?: string;
  /** 会话临时世界条目（压缩时从对话提取；仅本会话及续集生效，不写入规则书） */
  sessionEntries?: SessionEntry[];
}

export interface Message {
  id: string;
  sessionId: string;
  role: "user" | "assistant" | "system";
  content: string;
  thinking?: string;
  images?: string[];
  createdAt: number;
  // 开局消息标记：开局自动发送的指令消息，UI 不展示（已持久化）
  opening?: boolean;
  // 工具调用相关（运行时内存字段，不持久化到 DB）
  toolCalls?: ToolCall[];
  toolStatus?: "running" | "done" | "aborted";
  // 已调用的工具名（持久化到 DB，用于完成后/刷新后的轻量提示）
  tools?: string[];
  // 格式分析结果（独立 API 请求生成，JSON 文本：章节名/场景信息/对话推荐；持久化到 DB）
  sceneAnalysis?: string | null;
  // token 消耗估算（input=上传/正文+分析输入合计，output=下载/正文+分析输出合计；持久化到 DB）
  tokenUsage?: { input: number; output: number } | null;
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
  // 长对话压缩提取来源标记 + 出场触发词（角色名/别称）
  isExtracted?: boolean;
  triggerWords?: string[];
  // 回收站：软删除时间（仅回收站列表可见）
  deletedAt?: number;
  createdAt: number;
  updatedAt: number;
}

/** 提取角色卡与会话的绑定（压缩时生成，注入时按会话查） */
export interface SessionCharacterCard {
  id: string;
  sessionId: string;
  characterCardId: string;
  worldBookId?: string | null;
  createdAt: number;
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
  /** AI 创建时匹配的世界底座 id（modern/ancient/cultivation/future/otherworld/infinite/custom；兼容旧数据缺省） */
  worldBaseId?: string;
  /** AI 创建时生成的自定义开局种子（保存/读取兼容旧数据缺省） */
  customOpenings?: CustomOpeningSeed[];
  entries: WorldBookEntry[];
  createdAt: number;
  updatedAt: number;
}

export interface CustomOpeningSeed {
  name: string;
  focus: string;
  tags?: string[];
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