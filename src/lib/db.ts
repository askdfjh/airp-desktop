import Database from "@tauri-apps/plugin-sql";
import type { Session, Message, PromptTemplate, CharacterCard, Character, CharacterArc, SessionCharacter, McpServer, WorldRule, WorldBook, WorldBookEntry } from "@/types";
import { PRESET_WORLD_BOOKS } from "./preset_worldbooks";

let db: Database | null = null;

/** 初始化数据库连接并建表。应用启动时调用一次。 */
export async function initDb(): Promise<void> {
  if (db) {
    console.log("[db] already initialized");
    return;
  }
  console.log("[db] loading sqlite:airp.db...");
  db = await Database.load("sqlite:airp.db");
  console.log("[db] loaded", db.path);
  await db.execute(`PRAGMA foreign_keys = ON;`);
  await db.execute(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL DEFAULT '',
      systemPrompt TEXT NOT NULL DEFAULT '',
      providerId TEXT NOT NULL DEFAULT '',
      model TEXT NOT NULL DEFAULT '',
      thinkingEnabled INTEGER NOT NULL DEFAULT 0,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL
    );
  `);
  await db.execute(`
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      sessionId TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL DEFAULT '',
      thinking TEXT,
      images TEXT,
      opening INTEGER NOT NULL DEFAULT 0,
      tools TEXT,
      createdAt INTEGER NOT NULL,
      FOREIGN KEY (sessionId) REFERENCES sessions(id) ON DELETE CASCADE
    );
  `);
  await db.execute(
    `CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(sessionId, createdAt);`
  );
  // 迁移：旧表可能缺少新列
  await db.execute(`ALTER TABLE sessions ADD COLUMN thinkingEnabled INTEGER NOT NULL DEFAULT 0;`).catch(() => {});
  await db.execute(`ALTER TABLE messages ADD COLUMN thinking TEXT;`).catch(() => {});
  await db.execute(`ALTER TABLE messages ADD COLUMN opening INTEGER NOT NULL DEFAULT 0;`).catch(() => {});
  await db.execute(`ALTER TABLE messages ADD COLUMN tools TEXT;`).catch(() => {});
  // 回收站：软删除标记 + 删除时间
  await db.execute(`ALTER TABLE sessions ADD COLUMN deleted INTEGER NOT NULL DEFAULT 0;`).catch(() => {});
  await db.execute(`ALTER TABLE sessions ADD COLUMN deletedAt INTEGER;`).catch(() => {});
  // 会话类型：adventure（冒险）/ blank（空白会话）
  const kindCol = await db.select<{ c: number }[]>(
    "SELECT COUNT(*) AS c FROM pragma_table_info('sessions') WHERE name = 'kind';"
  );
  if (!(kindCol[0]?.c > 0)) {
    await db.execute(`ALTER TABLE sessions ADD COLUMN kind TEXT NOT NULL DEFAULT 'adventure';`);
    // 旧数据修正：标题为"空白会话"的归为 blank
    await db.execute(`UPDATE sessions SET kind = 'blank' WHERE title = '空白会话';`);
  }
  // 长对话压缩：故事脉络摘要（增量追加）+ 压缩状态
  await db.execute(`ALTER TABLE sessions ADD COLUMN contextSummary TEXT DEFAULT '';`).catch(() => {});
  await db.execute(`ALTER TABLE sessions ADD COLUMN summaryUpdatedAt INTEGER;`).catch(() => {});
  await db.execute(`ALTER TABLE sessions ADD COLUMN summaryCount INTEGER DEFAULT 0;`).catch(() => {});
  await db.execute(`ALTER TABLE sessions ADD COLUMN lastSummarizedMessageId TEXT;`).catch(() => {});
  await db.execute(`
    CREATE TABLE IF NOT EXISTS favorites (
      id TEXT PRIMARY KEY,
      sessionId TEXT NOT NULL,
      createdAt INTEGER NOT NULL,
      FOREIGN KEY (sessionId) REFERENCES sessions(id) ON DELETE SET NULL
    );
  `);
  await db.execute(`
    CREATE TABLE IF NOT EXISTS prompt_templates (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT '通用',
      isBuiltin INTEGER NOT NULL DEFAULT 0,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL
    );
  `);
  await db.execute(`
    CREATE TABLE IF NOT EXISTS character_cards (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      systemPrompt TEXT NOT NULL,
      emoji TEXT NOT NULL DEFAULT '🎭',
      tags TEXT NOT NULL DEFAULT '[]',
      isBuiltin INTEGER NOT NULL DEFAULT 0,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL
    );
  `);
  await db.execute(`
    CREATE TABLE IF NOT EXISTS characters (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      appearance TEXT NOT NULL DEFAULT '',
      personality TEXT NOT NULL DEFAULT '',
      background TEXT NOT NULL DEFAULT '',
      tags TEXT NOT NULL DEFAULT '[]',
      avatar TEXT,
      isBuiltin INTEGER NOT NULL DEFAULT 0,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL
    );`
  );
  await db.execute(`
    CREATE TABLE IF NOT EXISTS character_arcs (
      id TEXT PRIMARY KEY,
      characterId TEXT NOT NULL,
      sessionId TEXT NOT NULL,
      worldContext TEXT NOT NULL DEFAULT '',
      event TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      turnCount INTEGER NOT NULL DEFAULT 0,
      createdAt INTEGER NOT NULL,
      FOREIGN KEY (characterId) REFERENCES characters(id) ON DELETE CASCADE
    );`
  );
  await db.execute(`
    CREATE TABLE IF NOT EXISTS session_characters (
      id TEXT PRIMARY KEY,
      sessionId TEXT NOT NULL,
      characterId TEXT NOT NULL,
      worldContext TEXT NOT NULL DEFAULT '',
      arcClearedAt INTEGER,
      createdAt INTEGER NOT NULL,
      FOREIGN KEY (characterId) REFERENCES characters(id) ON DELETE CASCADE
    );`
  );
  await db.execute(`
    CREATE TABLE IF NOT EXISTS mcp_servers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      url TEXT NOT NULL,
      transportType TEXT NOT NULL DEFAULT 'http',
      config TEXT NOT NULL DEFAULT '{}',
      status TEXT NOT NULL DEFAULT 'disconnected',
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL
    );
  `);
  await db.execute(`
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
  await db.execute(`
    CREATE TABLE IF NOT EXISTS world_rules (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      rules TEXT NOT NULL DEFAULT '',
      isActive INTEGER NOT NULL DEFAULT 0,
      isBuiltin INTEGER NOT NULL DEFAULT 0,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL
    );
  `);
  await db.execute(`
    CREATE TABLE IF NOT EXISTS world_books (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      theme TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL DEFAULT '',
      tags TEXT NOT NULL DEFAULT '[]',
      isActive INTEGER NOT NULL DEFAULT 0,
      isBuiltin INTEGER NOT NULL DEFAULT 0,
      violationWords TEXT NOT NULL DEFAULT '[]',
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL
    );
  `);
  await db.execute(`
    CREATE TABLE IF NOT EXISTS world_book_entries (
      id TEXT PRIMARY KEY,
      bookId TEXT NOT NULL,
      uid INTEGER NOT NULL,
      category TEXT NOT NULL DEFAULT '其他',
      title TEXT NOT NULL,
      "key" TEXT NOT NULL DEFAULT '[]',
      keysecondary TEXT NOT NULL DEFAULT '[]',
      content TEXT NOT NULL,
      constant INTEGER NOT NULL DEFAULT 0,
      selective INTEGER NOT NULL DEFAULT 0,
      "order" INTEGER NOT NULL DEFAULT 100,
      position TEXT NOT NULL DEFAULT 'system',
      insertion_depth INTEGER NOT NULL DEFAULT 50,
      disable INTEGER NOT NULL DEFAULT 0,
      linkedCharacterIds TEXT NOT NULL DEFAULT '[]',
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL,
      FOREIGN KEY (bookId) REFERENCES world_books(id) ON DELETE CASCADE
    );
  `);
  await db.execute(`
    CREATE TABLE IF NOT EXISTS world_book_trash (
      id TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      deletedAt INTEGER NOT NULL,
      expiredAt INTEGER NOT NULL
    );
  `);
  await db.execute(`ALTER TABLE character_cards ADD COLUMN personality TEXT DEFAULT '';`).catch(() => {});
  await db.execute(`ALTER TABLE character_cards ADD COLUMN scenario TEXT DEFAULT '';`).catch(() => {});
  await db.execute(`ALTER TABLE character_cards ADD COLUMN firstMes TEXT DEFAULT '';`).catch(() => {});
  await db.execute(`ALTER TABLE character_cards ADD COLUMN mesExample TEXT DEFAULT '';`).catch(() => {});
  await db.execute(`ALTER TABLE character_cards ADD COLUMN worldBookId TEXT DEFAULT NULL;`).catch(() => {});
  await db.execute(`ALTER TABLE character_cards ADD COLUMN characterBookEntries TEXT DEFAULT '[]';`).catch(() => {});
  // 长对话压缩：提取来源标记 + 出场触发词
  await db.execute(`ALTER TABLE character_cards ADD COLUMN isExtracted INTEGER NOT NULL DEFAULT 0;`).catch(() => {});
  await db.execute(`ALTER TABLE character_cards ADD COLUMN triggerWords TEXT DEFAULT '[]';`).catch(() => {});
  // 角色卡回收站：软删除标记（保留行与绑定，恢复时 id 不变）
  await db.execute(`ALTER TABLE character_cards ADD COLUMN deleted INTEGER NOT NULL DEFAULT 0;`).catch(() => {});
  await db.execute(`ALTER TABLE character_cards ADD COLUMN deletedAt INTEGER;`).catch(() => {});
  await db.execute(`
    CREATE TABLE IF NOT EXISTS session_character_cards (
      id TEXT PRIMARY KEY,
      sessionId TEXT NOT NULL,
      characterCardId TEXT NOT NULL,
      worldBookId TEXT,
      createdAt INTEGER NOT NULL,
      FOREIGN KEY (characterCardId) REFERENCES character_cards(id) ON DELETE CASCADE
    );
  `);
}

function getDb(): Database {
  if (!db) throw new Error("Database not initialized. Call initDb() first.");
  return db;
}

/* ---------- 类型映射 ---------- */

interface SessionRow {
  id: string;
  title: string;
  systemPrompt: string;
  providerId: string;
  model: string;
  thinkingEnabled: number;
  createdAt: number;
  updatedAt: number;
  deleted?: number;
  deletedAt?: number | null;
  kind?: string | null;
  contextSummary?: string | null;
  summaryUpdatedAt?: number | null;
  summaryCount?: number | null;
  lastSummarizedMessageId?: string | null;
}

interface MessageRow {
  id: string;
  sessionId: string;
  role: string;
  content: string;
  thinking: string | null;
  images: string | null;
  opening: number | null;
  tools: string | null;
  createdAt: number;
}

function rowToSession(r: SessionRow): Session {
  return {
    id: r.id,
    title: r.title,
    systemPrompt: r.systemPrompt,
    providerId: r.providerId,
    model: r.model,
    thinkingEnabled: r.thinkingEnabled === 1,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    deletedAt: r.deletedAt ?? undefined,
    kind: r.kind === "blank" ? "blank" : "adventure",
    contextSummary: r.contextSummary ?? undefined,
    summaryUpdatedAt: r.summaryUpdatedAt ?? undefined,
    summaryCount: r.summaryCount ?? undefined,
    lastSummarizedMessageId: r.lastSummarizedMessageId ?? undefined,
  };
}

function rowToMessage(r: MessageRow): Message {
  return {
    id: r.id,
    sessionId: r.sessionId,
    role: r.role as Message["role"],
    content: r.content,
    thinking: r.thinking ?? undefined,
    images: r.images ? (JSON.parse(r.images) as string[]) : undefined,
    opening: r.opening === 1 ? true : undefined,
    tools: r.tools ? (JSON.parse(r.tools) as string[]) : undefined,
    createdAt: r.createdAt,
  };
}

/* ---------- Session CRUD ---------- */

/** 加载全部会话（不含回收站），按 updatedAt 倒序。 */
export async function loadSessions(): Promise<Session[]> {
  console.log("[db] loadSessions...");
  const rows = await getDb().select<SessionRow[]>(
    "SELECT * FROM sessions WHERE deleted = 0 ORDER BY updatedAt DESC;"
  );
  console.log("[db] loadSessions returned", rows.length, "rows");
  return rows.map(rowToSession);
}

export async function insertSession(s: Session): Promise<void> {
  console.log("[db] insertSession", s.id, s.title);
  await getDb().execute(
    "INSERT INTO sessions (id, title, systemPrompt, providerId, model, thinkingEnabled, createdAt, updatedAt, kind, contextSummary, summaryUpdatedAt, summaryCount, lastSummarizedMessageId) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13);",
    [s.id, s.title, s.systemPrompt, s.providerId, s.model, s.thinkingEnabled ? 1 : 0, s.createdAt, s.updatedAt, s.kind === "blank" ? "blank" : "adventure", s.contextSummary ?? "", s.summaryUpdatedAt ?? null, s.summaryCount ?? 0, s.lastSummarizedMessageId ?? null]
  );
}

/** 回收站保留时长：30 天 */
export const TRASH_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

/** 删除会话（软删除，进入回收站，消息保留可恢复）。 */
export async function deleteSession(id: string): Promise<void> {
  await getDb().execute(
    "UPDATE sessions SET deleted = 1, deletedAt = $2 WHERE id = $1;",
    [id, Date.now()]
  );
}

/** 删除所有会话（软删除，进入回收站）。 */
export async function deleteAllSessions(): Promise<void> {
  await getDb().execute(
    "UPDATE sessions SET deleted = 1, deletedAt = $1 WHERE deleted = 0;",
    [Date.now()]
  );
}

/** 加载回收站中的会话，按删除时间倒序。 */
export async function loadTrashedSessions(): Promise<Session[]> {
  const rows = await getDb().select<SessionRow[]>(
    "SELECT * FROM sessions WHERE deleted = 1 ORDER BY deletedAt DESC;"
  );
  return rows.map(rowToSession);
}

/** 从回收站恢复会话。 */
export async function restoreSession(id: string): Promise<void> {
  await getDb().execute(
    "UPDATE sessions SET deleted = 0, deletedAt = NULL WHERE id = $1;",
    [id]
  );
}

/** 彻底删除会话及其全部消息（不可恢复）。 */
export async function purgeSession(id: string): Promise<void> {
  await getDb().execute("DELETE FROM messages WHERE sessionId = $1;", [id]);
  await getDb().execute("DELETE FROM favorites WHERE sessionId = $1;", [id]);
  await getDb().execute("DELETE FROM sessions WHERE id = $1;", [id]);
}

/** 清理过期回收站条目，返回清除数量。 */
export async function purgeExpiredTrash(): Promise<number> {
  const cutoff = Date.now() - TRASH_RETENTION_MS;
  const rows = await getDb().select<{ id: string }[]>(
    "SELECT id FROM sessions WHERE deleted = 1 AND deletedAt IS NOT NULL AND deletedAt < $1;",
    [cutoff]
  );
  for (const r of rows) await purgeSession(r.id);
  return rows.length;
}

const SESSION_FIELDS = ["title", "systemPrompt", "providerId", "model", "thinkingEnabled", "updatedAt", "contextSummary", "summaryUpdatedAt", "summaryCount", "lastSummarizedMessageId"] as const;
type SessionUpdateField = (typeof SESSION_FIELDS)[number];

/** 更新会话字段（白名单过滤，安全）。 */
export async function updateSession(
  id: string,
  fields: Partial<Pick<Session, SessionUpdateField>>
): Promise<void> {
  const valid = SESSION_FIELDS.filter((k) => k in fields);
  if (valid.length === 0) return;
  const sets = valid.map((k, i) => `${k} = $${i + 1}`).join(", ");
  const values = valid.map((k) => fields[k] as string | number);
  await getDb().execute(
    `UPDATE sessions SET ${sets} WHERE id = $${valid.length + 1};`,
    [...values, id]
  );
}

/* ---------- Message CRUD ---------- */

/** 加载某会话的全部消息，按 createdAt 正序。 */
export async function loadMessages(sessionId: string): Promise<Message[]> {
  console.log("[db] loadMessages for", sessionId);
  const rows = await getDb().select<MessageRow[]>(
    "SELECT * FROM messages WHERE sessionId = $1 ORDER BY createdAt ASC;",
    [sessionId]
  );
  console.log("[db] loadMessages returned", rows.length, "rows");
  return rows.map(rowToMessage);
}

export async function insertMessage(m: Message): Promise<void> {
  console.log("[db] insertMessage", m.id, m.role, "len=", m.content.length);
  await getDb().execute(
    "INSERT INTO messages (id, sessionId, role, content, thinking, images, opening, tools, createdAt) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9);",
    [m.id, m.sessionId, m.role, m.content, m.thinking ?? null, m.images ? JSON.stringify(m.images) : null, m.opening ? 1 : 0, m.tools ? JSON.stringify(m.tools) : null, m.createdAt]
  );
}

/** 更新消息内容（流式结束后写入最终文本）。 */
export async function updateMessageContent(id: string, content: string): Promise<void> {
  console.log("[db] updateMessageContent", id, "len=", content.length);
  await getDb().execute("UPDATE messages SET content = $1 WHERE id = $2;", [content, id]);
}

/** 更新消息思考内容。 */
export async function updateMessageThinking(id: string, thinking: string): Promise<void> {
  await getDb().execute("UPDATE messages SET thinking = $1 WHERE id = $2;", [thinking, id]);
}

/** 删除单条消息。 */
export async function deleteMessage(id: string): Promise<void> {
  await getDb().execute("DELETE FROM messages WHERE id = $1;", [id]);
}

/** 删除某会话的全部消息（清空对话）。 */
export async function deleteMessagesBySession(sessionId: string): Promise<void> {
  await getDb().execute("DELETE FROM messages WHERE sessionId = $1;", [sessionId]);
}


/* ---------- Search ---------- */

export interface SearchResult {
  messageId: string;
  sessionId: string;
  sessionTitle: string;
  role: string;
  content: string;
  createdAt: number;
  matchType: "message" | "title";
}

/** 搜索消息内容，返回匹配结果（含会话标题）。 */
export async function searchMessages(query: string): Promise<SearchResult[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const like = `%${trimmed}%`;

  const results: SearchResult[] = [];

  // 1. 搜索消息内容
  const msgRows = await getDb().select<{ messageId: string; sessionId: string; role: string; content: string; createdAt: number; sessionTitle: string }[]>(
    `SELECT m.id AS messageId, m.sessionId, m.role, m.content, m.createdAt, s.title AS sessionTitle
     FROM messages m
     JOIN sessions s ON m.sessionId = s.id
     WHERE m.content LIKE $1
     ORDER BY m.createdAt DESC
     LIMIT 50;`,
    [like]
  );
  for (const r of msgRows) {
    results.push({ ...r, matchType: "message" });
  }

  // 2. 搜索会话标题
  const titleRows = await getDb().select<{ sessionId: string; sessionTitle: string; updatedAt: number }[]>(
    `SELECT id AS sessionId, title AS sessionTitle, updatedAt
     FROM sessions
     WHERE title LIKE $1
     ORDER BY updatedAt DESC
     LIMIT 20;`,
    [like]
  );
  for (const r of titleRows) {
    // 去重：如果该 session 已因消息匹配出现过，跳过标题匹配
    if (!results.some((x) => x.sessionId === r.sessionId)) {
      results.push({
        messageId: "",
        sessionId: r.sessionId,
        sessionTitle: r.sessionTitle,
        role: "",
        content: r.sessionTitle,
        createdAt: r.updatedAt,
        matchType: "title",
      });
    }
  }

  return results;
}

/* ---------- Favorites ---------- */

export interface Favorite {
  id: string;
  sessionId: string;
  createdAt: number;
}

export async function loadFavorites(): Promise<Favorite[]> {
  const rows = await getDb().select<Favorite[]>(
    "SELECT * FROM favorites ORDER BY createdAt DESC;"
  );
  return rows;
}

export async function addFavorite(sessionId: string): Promise<Favorite> {
  const id = crypto.randomUUID();
  const createdAt = Date.now();
  await getDb().execute(
    "INSERT INTO favorites (id, sessionId, createdAt) VALUES ($1, $2, $3);",
    [id, sessionId, createdAt]
  );
  return { id, sessionId, createdAt };
}

export async function removeFavorite(id: string): Promise<void> {
  await getDb().execute("DELETE FROM favorites WHERE id = $1;", [id]);
}

export async function isFavorite(sessionId: string): Promise<boolean> {
  const rows = await getDb().select<Favorite[]>(
    "SELECT * FROM favorites WHERE sessionId = $1 LIMIT 1;",
    [sessionId]
  );
  return rows.length > 0;
}

/* ---------- Prompt Templates ---------- */

export interface PromptTemplateRow {
  id: string;
  title: string;
  content: string;
  category: string;
  isBuiltin: number;
  createdAt: number;
  updatedAt: number;
}

export async function loadPromptTemplates(): Promise<PromptTemplate[]> {
  const rows = await getDb().select<PromptTemplateRow[]>(
    "SELECT * FROM prompt_templates ORDER BY category ASC, updatedAt DESC;"
  );
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    content: r.content,
    category: r.category,
    isBuiltin: r.isBuiltin === 1,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }));
}

export async function insertPromptTemplate(t: PromptTemplate): Promise<void> {
  await getDb().execute(
    "INSERT INTO prompt_templates (id, title, content, category, isBuiltin, createdAt, updatedAt) VALUES ($1, $2, $3, $4, $5, $6, $7);",
    [t.id, t.title, t.content, t.category, t.isBuiltin ? 1 : 0, t.createdAt, t.updatedAt]
  );
}

export async function updatePromptTemplate(id: string, fields: { title?: string; content?: string; category?: string; updatedAt?: number }): Promise<void> {
  const sets: string[] = [];
  const values: (string | number)[] = [];
  if (fields.title !== undefined) { sets.push("title = $" + (sets.length + 1)); values.push(fields.title); }
  if (fields.content !== undefined) { sets.push("content = $" + (sets.length + 1)); values.push(fields.content); }
  if (fields.category !== undefined) { sets.push("category = $" + (sets.length + 1)); values.push(fields.category); }
  const ts = fields.updatedAt ?? Date.now();
  sets.push("updatedAt = $" + (sets.length + 1));
  values.push(ts);
  values.push(id);
  await getDb().execute(
    `UPDATE prompt_templates SET ${sets.join(", ")} WHERE id = $${values.length};`,
    values
  );
}

export async function deletePromptTemplate(id: string): Promise<void> {
  await getDb().execute("DELETE FROM prompt_templates WHERE id = $1;", [id]);
}

export async function initBuiltinTemplates(): Promise<void> {
  const builtins: Omit<PromptTemplate, "createdAt" | "updatedAt">[] = [
    { id: "builtin-code-assistant", title: "程序员助手", content: "你是一位资深的程序员，擅长代码审查、Bug 排查、性能优化。请用简洁的方式回答，必要时给出代码示例。", category: "编程", isBuiltin: true },
    { id: "builtin-pm-assistant", title: "产品经理", content: "你是一位经验丰富的产品经理，擅长需求分析、用户故事编写、PRD 文档整理。请用结构化的方式思考问题。", category: "商务", isBuiltin: true },
    { id: "builtin-writer", title: "写作助手", content: "你是一位创意写作助手，擅长文章润色、文案创作、故事构思。请提供多种风格的写作建议。", category: "写作", isBuiltin: true },
    { id: "builtin-translator", title: "翻译官", content: "你是一位专业的中英双语翻译。请先直译，再提供意译版本，并解释关键翻译选择。", category: "翻译", isBuiltin: true },
    { id: "builtin-teacher", title: "老师", content: "你是一位耐心的老师，善于用通俗易懂的方式讲解复杂概念，鼓励式教学。", category: "教育", isBuiltin: true },
    { id: "builtin-analyst", title: "数据分析师", content: "你是一位数据分析师，擅长数据解读、趋势识别、商业洞察。请用数据驱动的方式回答问题。", category: "商务", isBuiltin: true },
    { id: "builtin-designer", title: "UI 设计师", content: "你是一位资深 UI 设计师，擅长交互设计、视觉规范、组件库搭建。请提供具体可落地的设计建议。", category: "设计", isBuiltin: true },
    { id: "builtin-learner", title: "学习教练", content: "你是一位学习教练，帮助用户制定学习计划、拆解知识体系、推荐学习路径。", category: "教育", isBuiltin: true },
    { id: "builtin-debate", title: "辩论对手", content: "你是一位思辨性的辩论对手，从反面角度挑战用户观点，帮助用户思考更全面。", category: "通用", isBuiltin: true },
    { id: "builtin-summarizer", title: "摘要助手", content: "你是一位摘要助手，请将用户提供的内容总结为要点列表，不超过 5 条。", category: "通用", isBuiltin: true },
    { id: "builtin-brainstorm", title: "头脑风暴", content: "你是一位头脑风暴引导者，请针对用户的主题给出 10 个创意点子，鼓励发散思维。", category: "通用", isBuiltin: true },
    { id: "builtin-roast", title: "幽默吐槽", content: "你是一位幽默的朋友，请用调侃的方式回应用户，适度吐槽但保持友善。", category: "娱乐", isBuiltin: true },
  ];

  const now = Date.now();
  for (const b of builtins) {
    const existing = await getDb().select<PromptTemplateRow[]>(
      "SELECT id FROM prompt_templates WHERE id = $1 LIMIT 1;",
      [b.id]
    );
    if (existing.length === 0) {
      await getDb().execute(
        "INSERT INTO prompt_templates (id, title, content, category, isBuiltin, createdAt, updatedAt) VALUES ($1, $2, $3, $4, 1, $5, $6);",
        [b.id, b.title, b.content, b.category, now, now]
      );
    }
  }
}

/* ---------- Character Cards ---------- */

export interface CharacterCardRow {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  emoji: string;
  tags: string;
  isBuiltin: number;
  createdAt: number;
  updatedAt: number;
  personality?: string | null;
  scenario?: string | null;
  firstMes?: string | null;
  mesExample?: string | null;
  worldBookId?: string | null;
  characterBookEntries?: string | null;
  isExtracted?: number | null;
  triggerWords?: string | null;
  deletedAt?: number | null;
}

export async function loadCharacterCards(): Promise<CharacterCard[]> {
  const rows = await getDb().select<CharacterCardRow[]>(
    "SELECT * FROM character_cards WHERE deleted = 0 ORDER BY isBuiltin DESC, name ASC;"
  );
  return rows.map(rowToCharacterCard);
}

function rowToCharacterCard(r: CharacterCardRow): CharacterCard {
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    systemPrompt: r.systemPrompt,
    emoji: r.emoji,
    tags: JSON.parse(r.tags || "[]"),
    isBuiltin: r.isBuiltin === 1,
    personality: r.personality ?? undefined,
    scenario: r.scenario ?? undefined,
    firstMes: r.firstMes ?? undefined,
    mesExample: r.mesExample ?? undefined,
    worldBookId: r.worldBookId ?? undefined,
    characterBookEntries: r.characterBookEntries ? (JSON.parse(r.characterBookEntries) as WorldBookEntry[]) : undefined,
    isExtracted: r.isExtracted === 1 ? true : undefined,
    triggerWords: r.triggerWords ? (JSON.parse(r.triggerWords) as string[]) : undefined,
    deletedAt: r.deletedAt ?? undefined,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

export async function insertCharacterCard(c: CharacterCard): Promise<void> {
  await getDb().execute(
    "INSERT INTO character_cards (id, name, description, systemPrompt, emoji, tags, isBuiltin, createdAt, updatedAt, personality, scenario, firstMes, mesExample, worldBookId, characterBookEntries, isExtracted, triggerWords) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17);",
    [
      c.id, c.name, c.description, c.systemPrompt, c.emoji, JSON.stringify(c.tags), c.isBuiltin ? 1 : 0,
      c.createdAt, c.updatedAt, c.personality ?? "", c.scenario ?? "", c.firstMes ?? "", c.mesExample ?? "",
      c.worldBookId ?? null, c.characterBookEntries ? JSON.stringify(c.characterBookEntries) : "[]",
      c.isExtracted ? 1 : 0, JSON.stringify(c.triggerWords ?? []),
    ]
  );
}

export async function updateCharacterCard(id: string, fields: { name?: string; description?: string; systemPrompt?: string; emoji?: string; tags?: string[]; updatedAt?: number; personality?: string; scenario?: string; worldBookId?: string | null; characterBookEntries?: WorldBookEntry[]; isExtracted?: boolean; triggerWords?: string[] }): Promise<void> {
  const sets: string[] = [];
  const values: (string | number | null)[] = [];
  if (fields.name !== undefined) { sets.push("name = $" + (sets.length + 1)); values.push(fields.name); }
  if (fields.description !== undefined) { sets.push("description = $" + (sets.length + 1)); values.push(fields.description); }
  if (fields.systemPrompt !== undefined) { sets.push("systemPrompt = $" + (sets.length + 1)); values.push(fields.systemPrompt); }
  if (fields.emoji !== undefined) { sets.push("emoji = $" + (sets.length + 1)); values.push(fields.emoji); }
  if (fields.tags !== undefined) { sets.push("tags = $" + (sets.length + 1)); values.push(JSON.stringify(fields.tags)); }
  if (fields.personality !== undefined) { sets.push("personality = $" + (sets.length + 1)); values.push(fields.personality); }
  if (fields.scenario !== undefined) { sets.push("scenario = $" + (sets.length + 1)); values.push(fields.scenario); }
  if (fields.worldBookId !== undefined) { sets.push("worldBookId = $" + (sets.length + 1)); values.push(fields.worldBookId ?? null); }
  if (fields.characterBookEntries !== undefined) { sets.push("characterBookEntries = $" + (sets.length + 1)); values.push(JSON.stringify(fields.characterBookEntries)); }
  if (fields.isExtracted !== undefined) { sets.push("isExtracted = $" + (sets.length + 1)); values.push(fields.isExtracted ? 1 : 0); }
  if (fields.triggerWords !== undefined) { sets.push("triggerWords = $" + (sets.length + 1)); values.push(JSON.stringify(fields.triggerWords)); }
  const ts = fields.updatedAt ?? Date.now();
  sets.push("updatedAt = $" + (sets.length + 1));
  values.push(ts);
  values.push(id);
  await getDb().execute(
    `UPDATE character_cards SET ${sets.join(", ")} WHERE id = $${values.length};`,
    values
  );
}

/** 查找同名提取角色卡（isExtracted = 1），用于压缩时幂等更新。 */
export async function findExtractedCharacterCardByName(name: string): Promise<CharacterCard | null> {
  const rows = await getDb().select<CharacterCardRow[]>(
    "SELECT * FROM character_cards WHERE isExtracted = 1 AND deleted = 0 AND name = $1 LIMIT 1;",
    [name]
  );
  return rows.length > 0 ? rowToCharacterCard(rows[0]) : null;
}

/** 删除角色卡（软删除进回收站，保留行与绑定，30 天后自动彻底清理）。 */
export async function deleteCharacterCard(id: string): Promise<void> {
  await getDb().execute(
    "UPDATE character_cards SET deleted = 1, deletedAt = $2 WHERE id = $1;",
    [id, Date.now()]
  );
}

/** 加载回收站中的角色卡（软删除），按删除时间倒序。 */
export async function loadTrashedCharacterCards(): Promise<CharacterCard[]> {
  const rows = await getDb().select<CharacterCardRow[]>(
    "SELECT * FROM character_cards WHERE deleted = 1 ORDER BY deletedAt DESC;"
  );
  return rows.map(rowToCharacterCard);
}

/** 从回收站恢复角色卡。 */
export async function restoreCharacterCard(id: string): Promise<void> {
  await getDb().execute(
    "UPDATE character_cards SET deleted = 0, deletedAt = NULL WHERE id = $1;",
    [id]
  );
}

/** 彻底删除角色卡（级联删除会话绑定）。 */
export async function purgeCharacterCard(id: string): Promise<void> {
  await getDb().execute("DELETE FROM session_character_cards WHERE characterCardId = $1;", [id]);
  await getDb().execute("DELETE FROM character_cards WHERE id = $1;", [id]);
}

/** 清理回收站中过期的角色卡，返回清除数量。 */
export async function purgeExpiredCharacterCards(): Promise<number> {
  const cutoff = Date.now() - TRASH_RETENTION_MS;
  const rows = await getDb().select<{ id: string }[]>(
    "SELECT id FROM character_cards WHERE deleted = 1 AND deletedAt IS NOT NULL AND deletedAt < $1;",
    [cutoff]
  );
  for (const r of rows) await purgeCharacterCard(r.id);
  return rows.length;
}

export async function initBuiltinCharacterCards(): Promise<void> {
  const builtins: Omit<CharacterCard, "createdAt" | "updatedAt">[] = [
    { id: "cc-programmer", name: "程序员", description: "代码审查、Bug 排查、性能优化", systemPrompt: "你是一位资深的程序员，擅长代码审查、Bug 排查、性能优化。请用简洁的方式回答，必要时给出代码示例。", emoji: "💻", tags: ["编程", "技术"], isBuiltin: true },
    { id: "cc-pm", name: "产品经理", description: "需求分析、用户故事、PRD 文档", systemPrompt: "你是一位经验丰富的产品经理，擅长需求分析、用户故事编写、PRD 文档整理。请用结构化的方式思考问题。", emoji: "📋", tags: ["商务", "管理"], isBuiltin: true },
    { id: "cc-writer", name: "写作助手", description: "文章润色、文案创作、故事构思", systemPrompt: "你是一位创意写作助手，擅长文章润色、文案创作、故事构思。请提供多种风格的写作建议。", emoji: "✍️", tags: ["写作"], isBuiltin: true },
    { id: "cc-translator", name: "翻译官", description: "中英双语翻译、本地化", systemPrompt: "你是一位专业的中英双语翻译。请先直译，再提供意译版本，并解释关键翻译选择。", emoji: "🌐", tags: ["翻译", "语言"], isBuiltin: true },
    { id: "cc-teacher", name: "老师", description: "耐心讲解、鼓励式教学", systemPrompt: "你是一位耐心的老师，善于用通俗易懂的方式讲解复杂概念，鼓励式教学。", emoji: "👩‍🏫", tags: ["教育"], isBuiltin: true },
    { id: "cc-designer", name: "UI 设计师", description: "交互设计、视觉规范、组件库", systemPrompt: "你是一位资深 UI 设计师，擅长交互设计、视觉规范、组件库搭建。请提供具体可落地的设计建议。", emoji: "🎨", tags: ["设计"], isBuiltin: true },
    { id: "cc-analyst", name: "数据分析师", description: "数据解读、趋势识别、商业洞察", systemPrompt: "你是一位数据分析师，擅长数据解读、趋势识别、商业洞察。请用数据驱动的方式回答问题。", emoji: "📊", tags: ["数据", "商务"], isBuiltin: true },
    { id: "cc-doctor", name: "健康顾问", description: "健康生活建议、运动营养", systemPrompt: "你是一位健康顾问，提供科学的运动、营养和生活方式建议。请给出实用、可操作的指导。", emoji: "🏥", tags: ["健康"], isBuiltin: true },
    { id: "cc-chef", name: "厨师", description: "菜谱推荐、烹饪技巧", systemPrompt: "你是一位专业厨师，擅长菜谱推荐、烹饪技巧指导、食材搭配建议。请提供详细的步骤说明。", emoji: "👨‍🍳", tags: ["生活"], isBuiltin: true },
    { id: "cc-lawyer", name: "法律顾问", description: "法律常识、合同审查", systemPrompt: "你是一位法律顾问，能解答常见法律问题、审查合同条款、提供维权建议。请给出专业、严谨的回答。", emoji: "⚖️", tags: ["法律"], isBuiltin: true },
  ];

  const now = Date.now();
  for (const b of builtins) {
    const existing = await getDb().select<CharacterCardRow[]>(
      "SELECT id FROM character_cards WHERE id = $1 LIMIT 1;",
      [b.id]
    );
    if (existing.length === 0) {
      await getDb().execute(
        "INSERT INTO character_cards (id, name, description, systemPrompt, emoji, tags, isBuiltin, createdAt, updatedAt) VALUES ($1, $2, $3, $4, $5, $6, 1, $7, $8);",
        [b.id, b.name, b.description, b.systemPrompt, b.emoji, JSON.stringify(b.tags), now, now]
      );
    }
  }
}


/* ---------- Characters ---------- */

interface CharacterRow {
  id: string;
  name: string;
  appearance: string;
  personality: string;
  background: string;
  tags: string;
  avatar: string | null;
  isBuiltin: number;
  createdAt: number;
  updatedAt: number;
}

export async function loadCharacters(): Promise<Character[]> {
  const rows = await getDb().select<CharacterRow[]>(
    "SELECT * FROM characters ORDER BY isBuiltin DESC, name ASC;"
  );
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    appearance: r.appearance,
    personality: r.personality,
    background: r.background,
    tags: JSON.parse(r.tags || "[]"),
    avatar: r.avatar ?? undefined,
    isBuiltin: r.isBuiltin === 1,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }));
}

export async function insertCharacter(c: Character): Promise<void> {
  await getDb().execute(
    "INSERT INTO characters (id, name, appearance, personality, background, tags, avatar, isBuiltin, createdAt, updatedAt) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10);",
    [c.id, c.name, c.appearance, c.personality, c.background, JSON.stringify(c.tags), c.avatar ?? null, c.isBuiltin ? 1 : 0, c.createdAt, c.updatedAt]
  );
}

export async function updateCharacter(id: string, fields: Partial<Omit<Character, "id" | "createdAt" | "updatedAt">> & { updatedAt?: number }): Promise<void> {
  const sets: string[] = [];
  const values: (string | number | null)[] = [];
  if (fields.name !== undefined) { sets.push("name = $" + (sets.length + 1)); values.push(fields.name); }
  if (fields.appearance !== undefined) { sets.push("appearance = $" + (sets.length + 1)); values.push(fields.appearance); }
  if (fields.personality !== undefined) { sets.push("personality = $" + (sets.length + 1)); values.push(fields.personality); }
  if (fields.background !== undefined) { sets.push("background = $" + (sets.length + 1)); values.push(fields.background); }
  if (fields.tags !== undefined) { sets.push("tags = $" + (sets.length + 1)); values.push(JSON.stringify(fields.tags)); }
  if (fields.avatar !== undefined) { sets.push("avatar = $" + (sets.length + 1)); values.push(fields.avatar); }
  const ts = fields.updatedAt ?? Date.now();
  sets.push("updatedAt = $" + (sets.length + 1));
  values.push(ts);
  values.push(id);
  await getDb().execute(
    `UPDATE characters SET ${sets.join(", ")} WHERE id = $${values.length};`,
    values
  );
}

export async function deleteCharacter(id: string): Promise<void> {
  await getDb().execute("DELETE FROM character_arcs WHERE characterId = $1;", [id]);
  await getDb().execute("DELETE FROM session_characters WHERE characterId = $1;", [id]);
  await getDb().execute("DELETE FROM characters WHERE id = $1;", [id]);
}

export const DEFAULT_CHARACTER_PRESETS: Omit<Character, "createdAt" | "updatedAt">[] = [
  { id: "char-linwan", name: "林晚", appearance: "长发及肩，常穿素色长裙，举止轻柔，说话声音不大", personality: "温柔内敛，善解人意，喜欢安静的环境，对周围人的情绪变化很敏感", background: "", tags: ["温柔", "细腻"], isBuiltin: true },
  { id: "char-zhaoyuan", name: "赵远", appearance: "身材高挑，穿着随意但干净利落，笑容爽朗", personality: "直爽大方，待人热情，说话很有感染力，在人群中总是活跃气氛的那个", background: "", tags: ["直爽", "健谈"], isBuiltin: true },
  { id: "char-suqing", name: "苏晴", appearance: "短发干练，眼神坚定，穿着偏中性化，周身透着一股利落劲儿", personality: "独立自主，做事认真负责，有自己的原则和底线，不轻易妥协但讲道理", background: "", tags: ["独立", "原则"], isBuiltin: true },
  { id: "char-zhouming", name: "周明", appearance: "戴着黑框眼镜，常穿格子衬衫，看着像个程序员但气质更沉稳", personality: "沉稳可靠，观察力敏锐，话不多但每句都说到点子上，习惯先想清楚再开口", background: "", tags: ["沉稳", "观察"], isBuiltin: true },
  { id: "char-chenxi", name: "陈溪", appearance: "扎着马尾辫，眼睛明亮有神，总是一副跃跃欲试的样子", personality: "开朗活泼，充满好奇心，什么话题都能聊几句，对新鲜事物永远保持着热情", background: "", tags: ["开朗", "好奇"], isBuiltin: true },
];

const PRESET_IDS = new Set(DEFAULT_CHARACTER_PRESETS.map(p => p.id));

export async function initBuiltinCharacters(): Promise<void> {
  const now = Date.now();
  // Clean up stale builtins no longer in presets
  await getDb().execute(
    "DELETE FROM characters WHERE isBuiltin = 1 AND id NOT IN (" + DEFAULT_CHARACTER_PRESETS.map((_, i) => "$" + (i + 1)).join(",") + ");",
    [...PRESET_IDS]
  );
  // Upsert presets: update existing builtins with latest preset values
  for (const preset of DEFAULT_CHARACTER_PRESETS) {
    const existing = await getDb().select<CharacterRow[]>(
      "SELECT id FROM characters WHERE id = $1 LIMIT 1;",
      [preset.id]
    );
    if (existing.length === 0) {
      await getDb().execute(
        "INSERT INTO characters (id, name, appearance, personality, background, tags, isBuiltin, createdAt, updatedAt) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9);",
        [preset.id, preset.name, preset.appearance, preset.personality, preset.background, JSON.stringify(preset.tags), 1, now, now]
      );
    } else {
      await getDb().execute(
        "UPDATE characters SET name=$1, appearance=$2, personality=$3, background=$4, tags=$5, isBuiltin=1, updatedAt=$6 WHERE id=$7;",
        [preset.name, preset.appearance, preset.personality, preset.background, JSON.stringify(preset.tags), now, preset.id]
      );
    }
  }
}

export async function restoreDefaultCharacters(): Promise<void> {
  const now = Date.now();
  const existing = await getDb().select<CharacterRow[]>("SELECT id FROM characters;");
  const existingIds = new Set(existing.map(r => r.id as string));
  // Delete stale builtins
  for (const id of existingIds) {
    if (!PRESET_IDS.has(id)) {
      const row = existing.find(r => r.id === id);
      if (row && row.isBuiltin === 1) {
        await getDb().execute("DELETE FROM characters WHERE id = $1;", [id]);
      }
    }
  }
  // Upsert presets
  for (const preset of DEFAULT_CHARACTER_PRESETS) {
    const defs = { name: preset.name, appearance: preset.appearance, personality: preset.personality, background: preset.background, tags: preset.tags };
    if (existingIds.has(preset.id)) {
      await getDb().execute(
        "UPDATE characters SET name=$1, appearance=$2, personality=$3, background=$4, tags=$5, updatedAt=$6 WHERE id=$7;",
        [defs.name, defs.appearance, defs.personality, defs.background, JSON.stringify(defs.tags), now, preset.id]
      );
    } else {
      await getDb().execute(
        "INSERT INTO characters (id, name, appearance, personality, background, tags, isBuiltin, createdAt, updatedAt) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9);",
        [preset.id, defs.name, defs.appearance, defs.personality, defs.background, JSON.stringify(defs.tags), 1, now, now]
      );
    }
  }
}

/* ---------- Character Arcs ---------- */

interface CharacterArcRow {
  id: string;
  characterId: string;
  sessionId: string;
  worldContext: string;
  event: string;
  description: string;
  turnCount: number;
  createdAt: number;
}

export async function loadCharacterArcs(characterId: string, worldContext?: string): Promise<CharacterArc[]> {
  let rows: CharacterArcRow[];
  if (worldContext) {
    rows = await getDb().select<CharacterArcRow[]>(
      "SELECT * FROM character_arcs WHERE characterId = $1 AND worldContext = $2 ORDER BY createdAt ASC;",
      [characterId, worldContext]
    );
  } else {
    rows = await getDb().select<CharacterArcRow[]>(
      "SELECT * FROM character_arcs WHERE characterId = $1 ORDER BY createdAt ASC;",
      [characterId]
    );
  }
  return rows.map((r) => ({
    id: r.id,
    characterId: r.characterId,
    sessionId: r.sessionId,
    worldContext: r.worldContext,
    event: r.event,
    description: r.description,
    turnCount: r.turnCount,
    createdAt: r.createdAt,
  }));
}

export async function insertCharacterArc(a: CharacterArc): Promise<void> {
  await getDb().execute(
    "INSERT INTO character_arcs (id, characterId, sessionId, worldContext, event, description, turnCount, createdAt) VALUES ($1, $2, $3, $4, $5, $6, $7, $8);",
    [a.id, a.characterId, a.sessionId, a.worldContext, a.event, a.description, a.turnCount, a.createdAt]
  );
}

export async function clearCharacterArcs(characterId: string, worldContext: string): Promise<void> {
  await getDb().execute(
    "DELETE FROM character_arcs WHERE characterId = $1 AND worldContext = $2;",
    [characterId, worldContext]
  );
}

export async function getArcTurnCount(characterId: string, worldContext: string): Promise<number> {
  const rows = await getDb().select<{ count: number }[]>(
    "SELECT COUNT(*) as count FROM character_arcs WHERE characterId = $1 AND worldContext = $2;",
    [characterId, worldContext]
  );
  return rows[0]?.count ?? 0;
}

/* ---------- Session Characters ---------- */

interface SessionCharacterRow {
  id: string;
  sessionId: string;
  characterId: string;
  worldContext: string;
  arcClearedAt: number | null;
  createdAt: number;
}

export async function loadSessionCharacters(sessionId: string): Promise<SessionCharacter[]> {
  const rows = await getDb().select<SessionCharacterRow[]>(
    "SELECT * FROM session_characters WHERE sessionId = $1 ORDER BY createdAt ASC;",
    [sessionId]
  );
  return rows.map((r) => ({
    id: r.id,
    sessionId: r.sessionId,
    characterId: r.characterId,
    worldContext: r.worldContext,
    arcClearedAt: r.arcClearedAt ?? null,
    createdAt: r.createdAt,
  }));
}

export async function insertSessionCharacter(sc: SessionCharacter): Promise<void> {
  await getDb().execute(
    "INSERT INTO session_characters (id, sessionId, characterId, worldContext, arcClearedAt, createdAt) VALUES ($1, $2, $3, $4, $5, $6);",
    [sc.id, sc.sessionId, sc.characterId, sc.worldContext, sc.arcClearedAt, sc.createdAt]
  );
}

export async function deleteSessionCharacter(id: string): Promise<void> {
  await getDb().execute("DELETE FROM session_characters WHERE id = $1;", [id]);
}

export async function clearSessionCharacterArcs(sessionId: string, characterId: string, worldContext: string): Promise<void> {
  await getDb().execute(
    "DELETE FROM character_arcs WHERE characterId = $1 AND worldContext = $2 AND sessionId = $3;",
    [characterId, worldContext, sessionId]
  );
  await getDb().execute(
    "UPDATE session_characters SET arcClearedAt = $1 WHERE sessionId = $2 AND characterId = $3;",
    [Date.now(), sessionId, characterId]
  );
}

/* ---------- 提取角色卡绑定（长对话压缩生成） ---------- */

export interface SessionCharacterCardRow {
  id: string;
  sessionId: string;
  characterCardId: string;
  worldBookId: string | null;
  createdAt: number;
}

/** 加载某会话绑定的全部提取角色卡绑定（含角色卡信息，供注入用）。 */
export async function loadSessionCharacterCards(
  sessionId: string
): Promise<(SessionCharacterCardRow & { name: string; triggerWords: string; systemPrompt: string; description: string })[]> {
  return await getDb().select(
    `SELECT scc.*, cc.name, cc.triggerWords, cc.systemPrompt, cc.description
     FROM session_character_cards scc
     JOIN character_cards cc ON cc.id = scc.characterCardId
     WHERE scc.sessionId = $1 AND cc.deleted = 0
     ORDER BY scc.createdAt ASC;`,
    [sessionId]
  );
}

export async function insertSessionCharacterCard(b: {
  sessionId: string;
  characterCardId: string;
  worldBookId?: string | null;
}): Promise<void> {
  await getDb().execute(
    "INSERT INTO session_character_cards (id, sessionId, characterCardId, worldBookId, createdAt) VALUES ($1, $2, $3, $4, $5);",
    [crypto.randomUUID(), b.sessionId, b.characterCardId, b.worldBookId ?? null, Date.now()]
  );
}

export async function deleteSessionCharacterCardByCard(sessionId: string, characterCardId: string): Promise<void> {
  await getDb().execute(
    "DELETE FROM session_character_cards WHERE sessionId = $1 AND characterCardId = $2;",
    [sessionId, characterCardId]
  );
}

/* ---------- MCP Servers ---------- */

export interface McpServerRow {
  id: string;
  name: string;
  url: string;
  transportType: string;
  config: string;
  status: string;
  createdAt: number;
  updatedAt: number;
}

export async function loadMcpServers(): Promise<McpServer[]> {
  const rows = await getDb().select<McpServerRow[]>(
    "SELECT * FROM mcp_servers ORDER BY createdAt DESC;"
  );
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    url: r.url,
    transportType: r.transportType as McpServer["transportType"],
    config: JSON.parse(r.config || "{}"),
    status: r.status as McpServer["status"],
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  }));
}

export async function insertMcpServer(s: McpServer): Promise<void> {
  await getDb().execute(
    "INSERT INTO mcp_servers (id, name, url, transportType, config, status, createdAt, updatedAt) VALUES ($1, $2, $3, $4, $5, $6, $7, $8);",
    [s.id, s.name, s.url, s.transportType, JSON.stringify(s.config), s.status, s.createdAt, s.updatedAt]
  );
}

export async function updateMcpServer(id: string, fields: { name?: string; url?: string; transportType?: string; config?: Record<string, unknown>; status?: string; updatedAt?: number }): Promise<void> {
  const sets: string[] = [];
  const values: (string | number | Record<string, unknown>)[] = [];
  if (fields.name !== undefined) { sets.push("name = $" + (sets.length + 1)); values.push(fields.name); }
  if (fields.url !== undefined) { sets.push("url = $" + (sets.length + 1)); values.push(fields.url); }
  if (fields.transportType !== undefined) { sets.push("transportType = $" + (sets.length + 1)); values.push(fields.transportType); }
  if (fields.config !== undefined) { sets.push("config = $" + (sets.length + 1)); values.push(JSON.stringify(fields.config)); }
  if (fields.status !== undefined) { sets.push("status = $" + (sets.length + 1)); values.push(fields.status); }
  const ts = fields.updatedAt ?? Date.now();
  sets.push("updatedAt = $" + (sets.length + 1));
  values.push(ts);
  values.push(id);
  await getDb().execute(
    `UPDATE mcp_servers SET ${sets.join(", ")} WHERE id = $${values.length};`,
    values
  );
}

export async function deleteMcpServer(id: string): Promise<void> {
  await getDb().execute("DELETE FROM mcp_servers WHERE id = $1;", [id]);
}

// ─── World Rules ──────────────────────────────────────────────

export async function loadWorldRules(): Promise<WorldRule[]> {
  const rows = await getDb().select<Record<string, unknown>[]>("SELECT * FROM world_rules ORDER BY createdAt ASC;");
  return rows.map(r => ({
    id: r.id as string,
    name: r.name as string,
    description: r.description as string,
    rules: r.rules as string,
    isActive: (r.isActive as number) === 1,
    isBuiltin: (r.isBuiltin as number) === 1,
    createdAt: r.createdAt as number,
    updatedAt: r.updatedAt as number,
  }));
}

export async function insertWorldRule(w: WorldRule): Promise<void> {
  await getDb().execute(
    `INSERT INTO world_rules (id, name, description, rules, isActive, isBuiltin, createdAt, updatedAt)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8);`,
    [w.id, w.name, w.description, w.rules, w.isActive ? 1 : 0, w.isBuiltin ? 1 : 0, w.createdAt, w.updatedAt]
  );
}

export async function updateWorldRule(id: string, fields: { name?: string; description?: string; rules?: string; isActive?: boolean; updatedAt?: number }): Promise<void> {
  const sets: string[] = [];
  const values: (string | number)[] = [];
  if (fields.name !== undefined) { sets.push("name = $" + (values.length + 1)); values.push(fields.name); }
  if (fields.description !== undefined) { sets.push("description = $" + (values.length + 1)); values.push(fields.description); }
  if (fields.rules !== undefined) { sets.push("rules = $" + (values.length + 1)); values.push(fields.rules); }
  if (fields.isActive !== undefined) { sets.push("isActive = $" + (values.length + 1)); values.push(fields.isActive ? 1 : 0); }
  const ts = fields.updatedAt ?? Date.now();
  sets.push("updatedAt = $" + (values.length + 1));
  values.push(ts);
  values.push(id);
  await getDb().execute(
    `UPDATE world_rules SET ${sets.join(", ")} WHERE id = $${values.length};`,
    values
  );
}

export async function deleteWorldRule(id: string): Promise<void> {
  await getDb().execute("DELETE FROM world_rules WHERE id = $1;", [id]);
}

export async function deactivateAllWorldRules(): Promise<void> {
  await getDb().execute("UPDATE world_rules SET isActive = 0;");
}

export async function initBuiltinWorldRules(): Promise<void> {
  const rows = await getDb().select<Record<string, unknown>[]>("SELECT COUNT(*) as cnt FROM world_rules WHERE isBuiltin = 1;");
  if ((rows[0].cnt as number) > 0) return;
  const now = Date.now();
  await insertWorldRule({
    id: "world-real",
    name: "现实世界",
    description: "遵循现实世界的物理规律与社会常识",
    rules: "这是现实世界，遵循我们已经了解的物理规则、社会规律和常识。\n不要擅自引入奇幻、科幻或超自然设定，除非用户明确要求。",
    isActive: true,
    isBuiltin: true,
    createdAt: now,
    updatedAt: now,
  });
}

/* ---------- App Settings ---------- */

export async function getAppSetting(key: string): Promise<string | null> {
  const rows = await getDb().select<{ value: string }[]>(
    "SELECT value FROM app_settings WHERE key = $1 LIMIT 1;",
    [key]
  );
  return rows.length > 0 ? rows[0].value : null;
}

export async function setAppSetting(key: string, value: string): Promise<void> {
  await getDb().execute(
    "INSERT INTO app_settings (key, value) VALUES ($1, $2) ON CONFLICT(key) DO UPDATE SET value = $2;",
    [key, value]
  );
}

/* ---------- World Books ---------- */

interface WorldBookRow {
  id: string;
  name: string;
  theme: string;
  description: string;
  tags: string;
  isActive: number;
  isBuiltin: number;
  violationWords: string;
  createdAt: number;
  updatedAt: number;
}

interface WorldBookEntryRow {
  id: string;
  bookId: string;
  uid: number;
  category: string;
  title: string;
  "key": string;
  keysecondary: string;
  content: string;
  constant: number;
  selective: number;
  "order": number;
  position: string;
  insertion_depth: number;
  disable: number;
  linkedCharacterIds: string;
  createdAt: number;
  updatedAt: number;
}

interface TrashRow {
  id: string;
  data: string;
  deletedAt: number;
  expiredAt: number;
}

function mapWorldBook(r: WorldBookRow, entries?: WorldBookEntry[]): WorldBook {
  return {
    id: r.id,
    name: r.name,
    theme: r.theme || "",
    description: r.description || "",
    tags: JSON.parse(r.tags || "[]"),
    isActive: r.isActive === 1,
    isBuiltin: r.isBuiltin === 1,
    violationWords: JSON.parse(r.violationWords || "[]"),
    entries: entries || [],
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

function mapWorldBookEntry(r: WorldBookEntryRow): WorldBookEntry {
  return {
    id: r.id,
    uid: r.uid,
    category: r.category || "",
    title: r.title,
    key: JSON.parse(r["key"] || "[]"),
    keysecondary: JSON.parse(r.keysecondary || "[]"),
    content: r.content,
    constant: r.constant === 1,
    selective: r.selective === 1,
    order: r.order,
    position: r.position as WorldBookEntry["position"],
    insertionDepth: r.insertion_depth,
    disable: r.disable === 1,
    linkedCharacterIds: JSON.parse(r.linkedCharacterIds || "[]"),
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

export async function loadWorldBooks(includeEntries = true): Promise<WorldBook[]> {
  const rows = await getDb().select<WorldBookRow[]>(
    "SELECT * FROM world_books ORDER BY isBuiltin DESC, name ASC;"
  );
  const books = rows.map((r) => mapWorldBook(r));
  if (!includeEntries) return books;
  for (const book of books) {
    const entries = await getDb().select<WorldBookEntryRow[]>(
      'SELECT * FROM world_book_entries WHERE bookId = $1 ORDER BY "order" ASC, uid ASC;',
      [book.id]
    );
    book.entries = entries.map(mapWorldBookEntry);
  }
  return books;
}

export async function insertWorldBook(book: WorldBook): Promise<void> {
  const now = Date.now();
  await getDb().execute(
    "INSERT INTO world_books (id, name, theme, description, tags, isActive, isBuiltin, violationWords, createdAt, updatedAt) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10);",
    [book.id, book.name, book.theme || "", book.description || "", JSON.stringify(book.tags), book.isActive ? 1 : 0, book.isBuiltin ? 1 : 0, JSON.stringify(book.violationWords || []), book.createdAt || now, book.updatedAt || now]
  );
  if (book.entries && book.entries.length > 0) {
    await batchInsertWorldBookEntries(book.id, book.entries);
  }
}

export async function updateWorldBook(id: string, fields: Partial<Pick<WorldBook, "name" | "theme" | "description" | "tags" | "isActive" | "isBuiltin" | "violationWords" | "updatedAt">>): Promise<void> {
  const sets: string[] = [];
  const values: (string | number)[] = [];
  if (fields.name !== undefined) { sets.push("name = $" + (sets.length + 1)); values.push(fields.name); }
  if (fields.theme !== undefined) { sets.push("theme = $" + (sets.length + 1)); values.push(fields.theme); }
  if (fields.description !== undefined) { sets.push("description = $" + (sets.length + 1)); values.push(fields.description); }
  if (fields.tags !== undefined) { sets.push("tags = $" + (sets.length + 1)); values.push(JSON.stringify(fields.tags)); }
  if (fields.isActive !== undefined) { sets.push("isActive = $" + (sets.length + 1)); values.push(fields.isActive ? 1 : 0); }
  if (fields.isBuiltin !== undefined) { sets.push("isBuiltin = $" + (sets.length + 1)); values.push(fields.isBuiltin ? 1 : 0); }
  if (fields.violationWords !== undefined) { sets.push("violationWords = $" + (sets.length + 1)); values.push(JSON.stringify(fields.violationWords)); }
  const ts = fields.updatedAt ?? Date.now();
  sets.push("updatedAt = $" + (sets.length + 1));
  values.push(ts);
  values.push(id);
  await getDb().execute(
    `UPDATE world_books SET ${sets.join(", ")} WHERE id = $${values.length};`,
    values
  );
}

/** 复制世界书为可编辑副本（含全部条目，isBuiltin=false），返回新 id。 */
export async function duplicateWorldBook(sourceId: string): Promise<string | null> {
  const books = await loadWorldBooks(true);
  const source = books.find((b) => b.id === sourceId);
  if (!source) return null;
  const now = Date.now();
  const newId = "wb_copy_" + now + "_" + Math.random().toString(36).slice(2, 8);
  await insertWorldBook({
    ...source,
    id: newId,
    name: source.name + "（副本）",
    isActive: false,
    isBuiltin: false,
    createdAt: now,
    updatedAt: now,
  });
  return newId;
}

export async function deleteWorldBook(id: string): Promise<void> {
  const rows = await getDb().select<WorldBookRow[]>(
    "SELECT * FROM world_books WHERE id = $1 LIMIT 1;",
    [id]
  );
  if (rows.length === 0) return;
  const row = rows[0];
  const entries = await getDb().select<WorldBookEntryRow[]>(
    "SELECT * FROM world_book_entries WHERE bookId = $1;",
    [id]
  );
  const data = {
    book: mapWorldBook(row),
    entries: entries.map(mapWorldBookEntry),
  };
  const now = Date.now();
  const expiredAt = now + 30 * 24 * 60 * 60 * 1000;
  await getDb().execute(
    "INSERT INTO world_book_trash (id, data, deletedAt, expiredAt) VALUES ($1, $2, $3, $4);",
    [id, JSON.stringify(data), now, expiredAt]
  );
  await getDb().execute("DELETE FROM world_book_entries WHERE bookId = $1;", [id]);
  await getDb().execute("DELETE FROM world_books WHERE id = $1;", [id]);
}

export async function loadActiveWorldBook(): Promise<WorldBook | null> {
  const rows = await getDb().select<WorldBookRow[]>(
    "SELECT * FROM world_books WHERE isActive = 1 LIMIT 1;"
  );
  if (rows.length === 0) return null;
  const entries = await getDb().select<WorldBookEntryRow[]>(
    'SELECT * FROM world_book_entries WHERE bookId = $1 ORDER BY "order" ASC, uid ASC;',
    [rows[0].id]
  );
  return mapWorldBook(rows[0], entries.map(mapWorldBookEntry));
}

export async function deactivateAllWorldBooks(): Promise<void> {
  await getDb().execute("UPDATE world_books SET isActive = 0;");
}

/* ---------- World Book Entries ---------- */

export async function loadEntriesByBook(bookId: string): Promise<WorldBookEntry[]> {
  const rows = await getDb().select<WorldBookEntryRow[]>(
    'SELECT * FROM world_book_entries WHERE bookId = $1 ORDER BY "order" ASC, uid ASC;',
    [bookId]
  );
  return rows.map(mapWorldBookEntry);
}

export async function insertWorldBookEntry(bookId: string, entry: WorldBookEntry): Promise<void> {
  await getDb().execute(
    'INSERT INTO world_book_entries (id, bookId, uid, category, title, "key", keysecondary, content, constant, selective, "order", position, insertion_depth, disable, linkedCharacterIds, createdAt, updatedAt) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17);',
    [crypto.randomUUID(), bookId, entry.uid, entry.category || "", entry.title, JSON.stringify(entry.key), JSON.stringify(entry.keysecondary || []), entry.content, entry.constant ? 1 : 0, entry.selective ? 1 : 0, entry.order, entry.position, entry.insertionDepth || 50, entry.disable ? 1 : 0, JSON.stringify(entry.linkedCharacterIds || []), entry.createdAt || Date.now(), entry.updatedAt || Date.now()]
  );
}

export async function batchInsertWorldBookEntries(bookId: string, entries: WorldBookEntry[]): Promise<void> {
  const now = Date.now();
  for (const entry of entries) {
    await getDb().execute(
      'INSERT INTO world_book_entries (id, bookId, uid, category, title, "key", keysecondary, content, constant, selective, "order", position, insertion_depth, disable, linkedCharacterIds, createdAt, updatedAt) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17);',
      [crypto.randomUUID(), bookId, entry.uid, entry.category || "", entry.title, JSON.stringify(entry.key), JSON.stringify(entry.keysecondary || []), entry.content, entry.constant ? 1 : 0, entry.selective ? 1 : 0, entry.order, entry.position, entry.insertionDepth || 50, entry.disable ? 1 : 0, JSON.stringify(entry.linkedCharacterIds || []), entry.createdAt || now, entry.updatedAt || now]
    );
  }
}

export async function updateWorldBookEntry(id: string, fields: Partial<Omit<WorldBookEntry, "uid" | "createdAt" | "updatedAt">>): Promise<void> {
  const sets: string[] = [];
  const values: (string | number)[] = [];
  if (fields.category !== undefined) { sets.push("category = $" + (sets.length + 1)); values.push(fields.category); }
  if (fields.title !== undefined) { sets.push("title = $" + (sets.length + 1)); values.push(fields.title); }
  if (fields.key !== undefined) { sets.push('"key" = $' + (sets.length + 1)); values.push(JSON.stringify(fields.key)); }
  if (fields.keysecondary !== undefined) { sets.push("keysecondary = $" + (sets.length + 1)); values.push(JSON.stringify(fields.keysecondary)); }
  if (fields.content !== undefined) { sets.push("content = $" + (sets.length + 1)); values.push(fields.content); }
  if (fields.constant !== undefined) { sets.push("constant = $" + (sets.length + 1)); values.push(fields.constant ? 1 : 0); }
  if (fields.selective !== undefined) { sets.push("selective = $" + (sets.length + 1)); values.push(fields.selective ? 1 : 0); }
  if (fields.order !== undefined) { sets.push('"order" = $' + (sets.length + 1)); values.push(fields.order); }
  if (fields.position !== undefined) { sets.push("position = $" + (sets.length + 1)); values.push(fields.position); }
  if (fields.insertionDepth !== undefined) { sets.push("insertion_depth = $" + (sets.length + 1)); values.push(fields.insertionDepth); }
  if (fields.disable !== undefined) { sets.push("disable = $" + (sets.length + 1)); values.push(fields.disable ? 1 : 0); }
  if (fields.linkedCharacterIds !== undefined) { sets.push("linkedCharacterIds = $" + (sets.length + 1)); values.push(JSON.stringify(fields.linkedCharacterIds)); }
  const ts = Date.now();
  sets.push("updatedAt = $" + (sets.length + 1));
  values.push(ts);
  values.push(id);
  await getDb().execute(
    `UPDATE world_book_entries SET ${sets.join(", ")} WHERE id = $${values.length};`,
    values
  );
}

export async function deleteWorldBookEntry(id: string): Promise<void> {
  await getDb().execute("DELETE FROM world_book_entries WHERE id = $1;", [id]);
}

/* ---------- World Book Trash ---------- */

export async function loadWorldBookTrash(): Promise<TrashRow[]> {
  const rows = await getDb().select<TrashRow[]>(
    "SELECT * FROM world_book_trash ORDER BY deletedAt DESC;"
  );
  return rows;
}

export async function restoreFromTrash(id: string): Promise<void> {
  const rows = await getDb().select<TrashRow[]>(
    "SELECT * FROM world_book_trash WHERE id = $1 LIMIT 1;",
    [id]
  );
  if (rows.length === 0) return;
  const trash = rows[0];
  const parsed = JSON.parse(trash.data);
  if (parsed.book) {
    await insertWorldBook(parsed.book);
  }
  await getDb().execute("DELETE FROM world_book_trash WHERE id = $1;", [id]);
}

export async function deleteFromTrash(id: string): Promise<void> {
  await getDb().execute("DELETE FROM world_book_trash WHERE id = $1;", [id]);
}

export async function cleanExpiredTrash(): Promise<void> {
  const now = Date.now();
  await getDb().execute("DELETE FROM world_book_trash WHERE expiredAt < $1;", [now]);
}

export async function initBuiltinWorldBooks(): Promise<void> {
  const now = Date.now();
  for (const preset of PRESET_WORLD_BOOKS) {
    const existing = await getDb().select<{ id: string }[]>(
      "SELECT id FROM world_books WHERE id = $1 LIMIT 1;",
      [preset.id]
    );
    if (existing.length > 0) continue;

    await getDb().execute(
      "INSERT INTO world_books (id, name, theme, description, tags, isActive, isBuiltin, violationWords, createdAt, updatedAt) VALUES ($1, $2, $3, $4, $5, 0, 1, $6, $7, $8);",
      [preset.id, preset.name, preset.theme, preset.description, JSON.stringify(preset.tags), JSON.stringify(preset.violationWords), now, now]
    );

    let uid = 1;
    for (const entry of preset.entries) {
      await getDb().execute(
        'INSERT INTO world_book_entries (id, bookId, uid, category, title, "key", keysecondary, content, constant, selective, "order", position, insertion_depth, disable, linkedCharacterIds, createdAt, updatedAt) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17);',
        [crypto.randomUUID(), preset.id, uid++, entry.category || "", entry.title, JSON.stringify(entry.key), JSON.stringify(entry.keysecondary || []), entry.content, entry.constant ? 1 : 0, entry.selective ? 1 : 0, entry.order, entry.position, entry.insertionDepth || 50, entry.disable ? 1 : 0, JSON.stringify(entry.linkedCharacterIds || []), now, now]
      );
    }
  }
}

/* ---------- 设置备份（导出/导入） ---------- */

export interface SettingsDbSnapshot {
  appSettings: Record<string, unknown>[];
  mcpServers: Record<string, unknown>[];
  promptTemplates: Record<string, unknown>[];
  characterCards: Record<string, unknown>[];
  characters: Record<string, unknown>[];
  worldRules: Record<string, unknown>[];
  worldBooks: Record<string, unknown>[];
  worldBookEntries: Record<string, unknown>[];
}

export const SETTINGS_SNAPSHOT_TABLES: (keyof SettingsDbSnapshot)[] = [
  "appSettings",
  "mcpServers",
  "promptTemplates",
  "characterCards",
  "characters",
  "worldRules",
  "worldBooks",
  "worldBookEntries",
];

const SETTINGS_TABLE_SELECTS: Record<keyof SettingsDbSnapshot, string> = {
  appSettings: "SELECT * FROM app_settings ORDER BY key;",
  mcpServers: "SELECT * FROM mcp_servers ORDER BY createdAt ASC;",
  promptTemplates: "SELECT * FROM prompt_templates ORDER BY updatedAt DESC;",
  characterCards: "SELECT * FROM character_cards ORDER BY isBuiltin DESC, name ASC;",
  characters: "SELECT * FROM characters ORDER BY isBuiltin DESC, name ASC;",
  worldRules: "SELECT * FROM world_rules ORDER BY createdAt ASC;",
  worldBooks: "SELECT * FROM world_books ORDER BY isBuiltin DESC, name ASC;",
  worldBookEntries: 'SELECT * FROM world_book_entries ORDER BY bookId ASC, "order" ASC, uid ASC;',
};

/** 数值型列：导入时强制转数字 */
const NUMERIC_SETTING_COLUMNS = new Set([
  "uid", "order", "insertion_depth", "createdAt", "updatedAt",
  "isBuiltin", "isActive", "constant", "selective", "disable",
  "deleted", "thinkingEnabled", "opening", "turnCount", "arcClearedAt",
  "isExtracted", "summaryUpdatedAt", "summaryCount",
]);

function normalizeSettingValue(col: string, v: unknown): string | number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "boolean") return v ? 1 : 0;
  if (NUMERIC_SETTING_COLUMNS.has(col)) {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

/** 导出所选设置表（原始行，含 isBuiltin 等标记，保证导入后可完整还原；不传则导出全部设置表） */
export async function snapshotSettingsTables(
  tables: (keyof SettingsDbSnapshot)[] = SETTINGS_SNAPSHOT_TABLES
): Promise<Partial<SettingsDbSnapshot>> {
  const q = (sql: string) => getDb().select<Record<string, unknown>[]>(sql);
  const out: Partial<SettingsDbSnapshot> = {};
  for (const t of tables) {
    out[t] = await q(SETTINGS_TABLE_SELECTS[t]);
  }
  return out;
}

/** 用备份数据替换「备份中包含」的设置表；未包含的表保持原样（先清空子表再清空父表，再按 FK 顺序写回） */
export async function restoreSettingsTables(snap: Partial<SettingsDbSnapshot>): Promise<void> {
  const db = getDb();
  if (snap.worldBookEntries !== undefined) await db.execute("DELETE FROM world_book_entries;");
  if (snap.worldBooks !== undefined) await db.execute("DELETE FROM world_books;");
  if (snap.worldRules !== undefined) await db.execute("DELETE FROM world_rules;");
  if (snap.characterCards !== undefined) await db.execute("DELETE FROM character_cards;");
  if (snap.characters !== undefined) await db.execute("DELETE FROM characters;");
  if (snap.promptTemplates !== undefined) await db.execute("DELETE FROM prompt_templates;");
  if (snap.mcpServers !== undefined) await db.execute("DELETE FROM mcp_servers;");
  if (snap.appSettings !== undefined) await db.execute("DELETE FROM app_settings;");

  if (snap.appSettings !== undefined) {
    for (const row of snap.appSettings) {
      await db.execute("INSERT INTO app_settings (key, value) VALUES ($1, $2);", [
        normalizeSettingValue("key", row.key), normalizeSettingValue("value", row.value),
      ]);
    }
  }
  if (snap.mcpServers !== undefined) {
    for (const row of snap.mcpServers) {
      await db.execute(
        "INSERT INTO mcp_servers (id, name, url, transportType, config, status, createdAt, updatedAt) VALUES ($1, $2, $3, $4, $5, $6, $7, $8);",
        ["id", "name", "url", "transportType", "config", "status", "createdAt", "updatedAt"].map((c) => normalizeSettingValue(c, row[c]))
      );
    }
  }
  if (snap.promptTemplates !== undefined) {
    for (const row of snap.promptTemplates) {
      await db.execute(
        "INSERT INTO prompt_templates (id, title, content, category, isBuiltin, createdAt, updatedAt) VALUES ($1, $2, $3, $4, $5, $6, $7);",
        ["id", "title", "content", "category", "isBuiltin", "createdAt", "updatedAt"].map((c) => normalizeSettingValue(c, row[c]))
      );
    }
  }
  if (snap.characterCards !== undefined) {
    for (const row of snap.characterCards) {
      // 旧备份可能缺 isExtracted / triggerWords 列：缺失时给默认值
      const ccVal = (c: string, fallback: string | number | null) =>
        row[c] === undefined || row[c] === null ? fallback : normalizeSettingValue(c, row[c]);
      await db.execute(
        'INSERT INTO character_cards (id, name, description, systemPrompt, emoji, tags, isBuiltin, createdAt, updatedAt, personality, scenario, firstMes, mesExample, worldBookId, characterBookEntries, isExtracted, triggerWords, deleted, deletedAt) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19);',
        [
          ccVal("id", ""), ccVal("name", ""), ccVal("description", ""), ccVal("systemPrompt", ""),
          ccVal("emoji", "🎭"), ccVal("tags", "[]"), ccVal("isBuiltin", 0), ccVal("createdAt", 0),
          ccVal("updatedAt", 0), ccVal("personality", ""), ccVal("scenario", ""), ccVal("firstMes", ""),
          ccVal("mesExample", ""), ccVal("worldBookId", null), ccVal("characterBookEntries", "[]"),
          ccVal("isExtracted", 0), ccVal("triggerWords", "[]"),
          ccVal("deleted", 0), ccVal("deletedAt", null),
        ]
      );
    }
  }
  if (snap.characters !== undefined) {
    for (const row of snap.characters) {
      await db.execute(
        "INSERT INTO characters (id, name, appearance, personality, background, tags, avatar, isBuiltin, createdAt, updatedAt) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10);",
        ["id", "name", "appearance", "personality", "background", "tags", "avatar", "isBuiltin", "createdAt", "updatedAt"].map((c) => normalizeSettingValue(c, row[c]))
      );
    }
  }
  if (snap.worldRules !== undefined) {
    for (const row of snap.worldRules) {
      await db.execute(
        "INSERT INTO world_rules (id, name, description, rules, isActive, isBuiltin, createdAt, updatedAt) VALUES ($1, $2, $3, $4, $5, $6, $7, $8);",
        ["id", "name", "description", "rules", "isActive", "isBuiltin", "createdAt", "updatedAt"].map((c) => normalizeSettingValue(c, row[c]))
      );
    }
  }
  if (snap.worldBooks !== undefined) {
    for (const row of snap.worldBooks) {
      await db.execute(
        "INSERT INTO world_books (id, name, theme, description, tags, isActive, isBuiltin, violationWords, createdAt, updatedAt) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10);",
        ["id", "name", "theme", "description", "tags", "isActive", "isBuiltin", "violationWords", "createdAt", "updatedAt"].map((c) => normalizeSettingValue(c, row[c]))
      );
    }
  }
  if (snap.worldBookEntries !== undefined) {
    for (const row of snap.worldBookEntries) {
      await db.execute(
        'INSERT INTO world_book_entries (id, bookId, uid, category, title, "key", keysecondary, content, constant, selective, "order", position, insertion_depth, disable, linkedCharacterIds, createdAt, updatedAt) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17);',
        ["id", "bookId", "uid", "category", "title", "key", "keysecondary", "content", "constant", "selective", "order", "position", "insertion_depth", "disable", "linkedCharacterIds", "createdAt", "updatedAt"].map((c) => normalizeSettingValue(c, row[c]))
      );
    }
  }
}

/* ---------- 对话数据快照（全量备份用） ---------- */

export interface ConversationsSnapshot {
  sessions: Record<string, unknown>[];
  messages: Record<string, unknown>[];
  favorites: Record<string, unknown>[];
  sessionCharacters: Record<string, unknown>[];
  sessionCharacterCards: Record<string, unknown>[];
  characterArcs: Record<string, unknown>[];
}

/** 导出会话与消息等对话数据（原始行，含回收站状态与角色弧光）。 */
export async function snapshotConversations(): Promise<ConversationsSnapshot> {
  const q = (sql: string) => getDb().select<Record<string, unknown>[]>(sql);
  return {
    sessions: await q("SELECT * FROM sessions;"),
    messages: await q("SELECT * FROM messages ORDER BY sessionId ASC, createdAt ASC;"),
    favorites: await q("SELECT * FROM favorites;"),
    sessionCharacters: await q("SELECT * FROM session_characters;"),
    sessionCharacterCards: await q("SELECT * FROM session_character_cards;"),
    characterArcs: await q("SELECT * FROM character_arcs;"),
  };
}

/** 用备份数据合并恢复对话数据：同 ID 的会话/消息跳过（不覆盖现有），缺失的插入；回收站状态按备份还原。 */
export async function restoreConversations(snap: ConversationsSnapshot): Promise<void> {
  const db = getDb();
  for (const row of snap.sessions) {
    await db.execute(
      "INSERT OR IGNORE INTO sessions (id, title, systemPrompt, providerId, model, thinkingEnabled, createdAt, updatedAt, deleted, deletedAt, kind, contextSummary, summaryUpdatedAt, summaryCount, lastSummarizedMessageId) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15);",
      ["id", "title", "systemPrompt", "providerId", "model", "thinkingEnabled", "createdAt", "updatedAt", "deleted", "deletedAt", "kind", "contextSummary", "summaryUpdatedAt", "summaryCount", "lastSummarizedMessageId"].map((c) => normalizeSettingValue(c, row[c]))
    );
  }
  for (const row of snap.messages) {
    await db.execute(
      "INSERT OR IGNORE INTO messages (id, sessionId, role, content, thinking, images, opening, tools, createdAt) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9);",
      ["id", "sessionId", "role", "content", "thinking", "images", "opening", "tools", "createdAt"].map((c) => normalizeSettingValue(c, row[c]))
    );
  }
  for (const row of snap.favorites) {
    await db.execute(
      "INSERT OR IGNORE INTO favorites (id, sessionId, createdAt) VALUES ($1, $2, $3);",
      ["id", "sessionId", "createdAt"].map((c) => normalizeSettingValue(c, row[c]))
    );
  }
  for (const row of snap.sessionCharacters) {
    await db.execute(
      "INSERT OR IGNORE INTO session_characters (id, sessionId, characterId, worldContext, arcClearedAt, createdAt) VALUES ($1, $2, $3, $4, $5, $6);",
      ["id", "sessionId", "characterId", "worldContext", "arcClearedAt", "createdAt"].map((c) => normalizeSettingValue(c, row[c]))
    );
  }
  for (const row of snap.sessionCharacterCards ?? []) {
    await db.execute(
      "INSERT OR IGNORE INTO session_character_cards (id, sessionId, characterCardId, worldBookId, createdAt) VALUES ($1, $2, $3, $4, $5);",
      ["id", "sessionId", "characterCardId", "worldBookId", "createdAt"].map((c) => normalizeSettingValue(c, row[c]))
    );
  }
  for (const row of snap.characterArcs) {
    await db.execute(
      "INSERT OR IGNORE INTO character_arcs (id, characterId, sessionId, worldContext, event, description, turnCount, createdAt) VALUES ($1, $2, $3, $4, $5, $6, $7, $8);",
      ["id", "characterId", "sessionId", "worldContext", "event", "description", "turnCount", "createdAt"].map((c) => normalizeSettingValue(c, row[c]))
    );
  }
}

/* ---------- 同步合并导入（WebDAV 云端下载用，INSERT OR IGNORE 不覆盖现有） ---------- */

/** 合并导入世界书 + 词条；返回 (新世界书数, 新词条数) */
export async function mergeWorldBooks(snap: {
  worldBooks?: Record<string, unknown>[];
  worldBookEntries?: Record<string, unknown>[];
}): Promise<{ books: number; entries: number }> {
  const db = getDb();
  let books = 0;
  let entries = 0;
  for (const row of snap.worldBooks ?? []) {
    const r = await db.execute(
      "INSERT OR IGNORE INTO world_books (id, name, theme, description, tags, isActive, isBuiltin, violationWords, createdAt, updatedAt) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10);",
      ["id", "name", "theme", "description", "tags", "isActive", "isBuiltin", "violationWords", "createdAt", "updatedAt"].map((c) => normalizeSettingValue(c, row[c]))
    );
    books += r.rowsAffected;
  }
  for (const row of snap.worldBookEntries ?? []) {
    const r = await db.execute(
      'INSERT OR IGNORE INTO world_book_entries (id, bookId, uid, category, title, "key", keysecondary, content, constant, selective, "order", position, insertion_depth, disable, linkedCharacterIds, createdAt, updatedAt) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17);',
      ["id", "bookId", "uid", "category", "title", "key", "keysecondary", "content", "constant", "selective", "order", "position", "insertion_depth", "disable", "linkedCharacterIds", "createdAt", "updatedAt"].map((c) => normalizeSettingValue(c, row[c]))
    );
    entries += r.rowsAffected;
  }
  return { books, entries };
}

/** 合并导入角色卡（含提取卡）；返回新角色卡数 */
export async function mergeCharacterCards(rows: Record<string, unknown>[]): Promise<number> {
  const db = getDb();
  let count = 0;
  for (const row of rows) {
    const ccVal = (c: string, fallback: string | number | null) =>
      row[c] === undefined || row[c] === null ? fallback : normalizeSettingValue(c, row[c]);
    const r = await db.execute(
      'INSERT OR IGNORE INTO character_cards (id, name, description, systemPrompt, emoji, tags, isBuiltin, createdAt, updatedAt, personality, scenario, firstMes, mesExample, worldBookId, characterBookEntries, isExtracted, triggerWords, deleted, deletedAt) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19);',
      [
        ccVal("id", ""), ccVal("name", ""), ccVal("description", ""), ccVal("systemPrompt", ""),
        ccVal("emoji", "🎭"), ccVal("tags", "[]"), ccVal("isBuiltin", 0), ccVal("createdAt", 0),
        ccVal("updatedAt", 0), ccVal("personality", ""), ccVal("scenario", ""), ccVal("firstMes", ""),
        ccVal("mesExample", ""), ccVal("worldBookId", null), ccVal("characterBookEntries", "[]"),
        ccVal("isExtracted", 0), ccVal("triggerWords", "[]"),
        ccVal("deleted", 0), ccVal("deletedAt", null),
      ]
    );
    count += r.rowsAffected;
  }
  return count;
}

/** 创建分支会话：把 sourceId 会话中 upToMessageId（含）及之前的所有消息复制到新会话（消息重新生成 id），并复制会话角色绑定；返回新会话 id。 */
export async function createBranchSession(
  sourceId: string,
  upToMessageId: string,
  newSession: Session
): Promise<string> {
  await insertSession(newSession);
  const rows = await getDb().select<MessageRow[]>(
    "SELECT * FROM messages WHERE sessionId = $1 ORDER BY createdAt ASC, rowid ASC;",
    [sourceId]
  );
  const idx = rows.findIndex((r) => r.id === upToMessageId);
  const copy = idx < 0 ? rows : rows.slice(0, idx + 1);
  for (const r of copy) {
    await getDb().execute(
      "INSERT INTO messages (id, sessionId, role, content, thinking, images, opening, tools, createdAt) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9);",
      [crypto.randomUUID(), newSession.id, r.role, r.content, r.thinking, r.images, r.opening ?? 0, r.tools ? JSON.stringify(r.tools) : null, r.createdAt]
    );
  }
  const binds = await getDb().select<{ characterId: string; worldContext: string; arcClearedAt: number | null; createdAt: number }[]>(
    "SELECT characterId, worldContext, arcClearedAt, createdAt FROM session_characters WHERE sessionId = $1;",
    [sourceId]
  );
  for (const b of binds) {
    await getDb().execute(
      "INSERT OR IGNORE INTO session_characters (id, sessionId, characterId, worldContext, arcClearedAt, createdAt) VALUES ($1, $2, $3, $4, $5, $6);",
      [crypto.randomUUID(), newSession.id, b.characterId, b.worldContext, b.arcClearedAt, b.createdAt]
    );
  }
  // 复制提取角色卡绑定
  const cardBinds = await getDb().select<{ characterCardId: string; worldBookId: string | null; createdAt: number }[]>(
    "SELECT characterCardId, worldBookId, createdAt FROM session_character_cards WHERE sessionId = $1;",
    [sourceId]
  );
  for (const b of cardBinds) {
    await getDb().execute(
      "INSERT OR IGNORE INTO session_character_cards (id, sessionId, characterCardId, worldBookId, createdAt) VALUES ($1, $2, $3, $4, $5);",
      [crypto.randomUUID(), newSession.id, b.characterCardId, b.worldBookId, b.createdAt]
    );
  }
  return newSession.id;
}
