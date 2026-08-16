import Database from "@tauri-apps/plugin-sql";
import type { Session, Message, PromptTemplate, CharacterCard, Character, CharacterArc, SessionCharacter, McpServer, WorldRule, WorldBook, WorldBookEntry, Story, StoryStatus } from "@/types";
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
  await db.execute(`ALTER TABLE messages ADD COLUMN sceneAnalysis TEXT;`).catch(() => {});
  await db.execute(`ALTER TABLE messages ADD COLUMN tokenUsage TEXT;`).catch(() => {});
  // 故事链（压缩续集）：链标识/卷号/上一卷/锁定/剧情档案/关键词索引
  await db.execute(`ALTER TABLE sessions ADD COLUMN chainId TEXT;`).catch(() => {});
  await db.execute(`ALTER TABLE sessions ADD COLUMN chainIndex INTEGER;`).catch(() => {});
  await db.execute(`ALTER TABLE sessions ADD COLUMN parentId TEXT;`).catch(() => {});
  await db.execute(`ALTER TABLE sessions ADD COLUMN locked INTEGER NOT NULL DEFAULT 0;`).catch(() => {});
  await db.execute(`ALTER TABLE sessions ADD COLUMN archive TEXT;`).catch(() => {});
  await db.execute(`ALTER TABLE sessions ADD COLUMN contextIndex TEXT;`).catch(() => {});
  await db.execute(`ALTER TABLE sessions ADD COLUMN formatEnabled INTEGER NOT NULL DEFAULT 0;`).catch(() => {});
  // 会话临时世界条目（压缩提取，仅会话及续集生效，JSON 数组）
  await db.execute(`ALTER TABLE sessions ADD COLUMN sessionEntries TEXT DEFAULT '[]';`).catch(() => {});
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
      FOREIGN KEY (sessionId) REFERENCES sessions(id) ON DELETE CASCADE
    );
  `);
  const favoriteFk = await db.select<{ on_delete?: string }[]>(
    "PRAGMA foreign_key_list('favorites');"
  ).catch(() => []);
  if (favoriteFk.some((fk) => fk.on_delete === "SET NULL")) {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS favorites_new (
        id TEXT PRIMARY KEY,
        sessionId TEXT NOT NULL,
        createdAt INTEGER NOT NULL,
        FOREIGN KEY (sessionId) REFERENCES sessions(id) ON DELETE CASCADE
      );
    `);
    await db.execute(`
      INSERT OR IGNORE INTO favorites_new (id, sessionId, createdAt)
      SELECT id, sessionId, createdAt FROM favorites WHERE sessionId IS NOT NULL;
    `);
    await db.execute(`DROP TABLE favorites;`);
    await db.execute(`ALTER TABLE favorites_new RENAME TO favorites;`);
  }
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
      worldBaseId TEXT NOT NULL DEFAULT '',
      customOpenings TEXT NOT NULL DEFAULT '[]',
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL
    );
  `);
  await db.execute(`ALTER TABLE world_books ADD COLUMN worldBaseId TEXT NOT NULL DEFAULT '';`).catch(() => {});
  await db.execute(`ALTER TABLE world_books ADD COLUMN customOpenings TEXT NOT NULL DEFAULT '[]';`).catch(() => {});
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
  await db.execute(`ALTER TABLE sessions ADD COLUMN storyId TEXT;`).catch(() => {});
  await db.execute(`
    CREATE TABLE IF NOT EXISTS stories (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      kind TEXT NOT NULL DEFAULT 'adventure',
      status TEXT NOT NULL DEFAULT 'writing',
      cover TEXT,
      groupId TEXT NOT NULL DEFAULT 'writing',
      pinned INTEGER NOT NULL DEFAULT 0,
      worldBookId TEXT,
      generationPresetId TEXT,
      protagonistName TEXT,
      topicSchemeId TEXT,
      worldBaseId TEXT,
      synopsis TEXT NOT NULL DEFAULT '',
      tags TEXT NOT NULL DEFAULT '[]',
      lastOpenedAt INTEGER,
      lastVolumeId TEXT,
      wordCount INTEGER NOT NULL DEFAULT 0,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL,
      deleted INTEGER NOT NULL DEFAULT 0,
      deletedAt INTEGER
    );
  `);
  await db.execute(`ALTER TABLE stories ADD COLUMN title TEXT NOT NULL DEFAULT '';`).catch(() => {});
  await db.execute(`ALTER TABLE stories ADD COLUMN kind TEXT NOT NULL DEFAULT 'adventure';`).catch(() => {});
  await db.execute(`ALTER TABLE stories ADD COLUMN status TEXT NOT NULL DEFAULT 'writing';`).catch(() => {});
  await db.execute(`ALTER TABLE stories ADD COLUMN cover TEXT;`).catch(() => {});
  await db.execute(`ALTER TABLE stories ADD COLUMN groupId TEXT NOT NULL DEFAULT 'writing';`).catch(() => {});
  await db.execute(`ALTER TABLE stories ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0;`).catch(() => {});
  await db.execute(`ALTER TABLE stories ADD COLUMN worldBookId TEXT;`).catch(() => {});
  await db.execute(`ALTER TABLE stories ADD COLUMN generationPresetId TEXT;`).catch(() => {});
  await db.execute(`ALTER TABLE stories ADD COLUMN protagonistName TEXT;`).catch(() => {});
  await db.execute(`ALTER TABLE stories ADD COLUMN topicSchemeId TEXT;`).catch(() => {});
  await db.execute(`ALTER TABLE stories ADD COLUMN worldBaseId TEXT;`).catch(() => {});
  await db.execute(`ALTER TABLE stories ADD COLUMN synopsis TEXT NOT NULL DEFAULT '';`).catch(() => {});
  await db.execute(`ALTER TABLE stories ADD COLUMN tags TEXT NOT NULL DEFAULT '[]';`).catch(() => {});
  await db.execute(`ALTER TABLE stories ADD COLUMN lastOpenedAt INTEGER;`).catch(() => {});
  await db.execute(`ALTER TABLE stories ADD COLUMN lastVolumeId TEXT;`).catch(() => {});
  await db.execute(`ALTER TABLE stories ADD COLUMN wordCount INTEGER NOT NULL DEFAULT 0;`).catch(() => {});
  await db.execute(`ALTER TABLE stories ADD COLUMN createdAt INTEGER NOT NULL DEFAULT 0;`).catch(() => {});
  await db.execute(`ALTER TABLE stories ADD COLUMN updatedAt INTEGER NOT NULL DEFAULT 0;`).catch(() => {});
  await db.execute(`ALTER TABLE stories ADD COLUMN deleted INTEGER NOT NULL DEFAULT 0;`).catch(() => {});
  await db.execute(`ALTER TABLE stories ADD COLUMN deletedAt INTEGER;`).catch(() => {});
  const { migrateStoriesOnInit, repairMissingStoryIds } = await import("./storyMigrate");
  await migrateStoriesOnInit();
  await repairMissingStoryIds();
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
  chainId?: string | null;
  chainIndex?: number | null;
  parentId?: string | null;
  locked?: number | null;
  archive?: string | null;
  contextIndex?: string | null;
  formatEnabled?: number | null;
  sessionEntries?: string | null;
  storyId?: string | null;
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
  sceneAnalysis: string | null;
  tokenUsage: string | null;
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
    chainId: r.chainId ?? undefined,
    chainIndex: r.chainIndex ?? undefined,
    parentId: r.parentId ?? undefined,
    locked: r.locked === 1,
    archive: r.archive ?? undefined,
    contextIndex: r.contextIndex ?? undefined,
    formatEnabled: r.formatEnabled === 1,
    sessionEntries: parseSessionEntries(r.sessionEntries),
    storyId: r.storyId ?? undefined,
  };
}

function parseSessionEntries(raw: string | null | undefined) {
  if (!raw) return undefined;
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr)
      ? arr.filter((e) => e && typeof e === "object" && typeof e.id === "string" && typeof e.title === "string" && e.title)
      : undefined;
  } catch {
    return undefined;
  }
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
    sceneAnalysis: r.sceneAnalysis ?? null,
    tokenUsage: r.tokenUsage ? (JSON.parse(r.tokenUsage) as { input: number; output: number }) : null,
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
    "INSERT INTO sessions (id, title, systemPrompt, providerId, model, thinkingEnabled, createdAt, updatedAt, kind, contextSummary, summaryUpdatedAt, summaryCount, lastSummarizedMessageId, chainId, chainIndex, parentId, locked, archive, contextIndex, formatEnabled, sessionEntries, storyId) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22);",
    [s.id, s.title, s.systemPrompt, s.providerId, s.model, s.thinkingEnabled ? 1 : 0, s.createdAt, s.updatedAt, s.kind === "blank" ? "blank" : "adventure", s.contextSummary ?? "", s.summaryUpdatedAt ?? null, s.summaryCount ?? 0, s.lastSummarizedMessageId ?? null, s.chainId ?? null, s.chainIndex ?? null, s.parentId ?? null, s.locked ? 1 : 0, s.archive ?? null, s.contextIndex ?? null, s.formatEnabled ? 1 : 0, s.sessionEntries ? JSON.stringify(s.sessionEntries) : "[]", s.storyId ?? null]
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
  await getDb().execute(    "UPDATE sessions SET deleted = 0, deletedAt = NULL WHERE id = $1;",
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

/** 硬删除会话（续集创建失败回滚用，连带消息/绑定级联）。 */
export async function hardDeleteSession(id: string): Promise<void> {
  await getDb().execute("DELETE FROM messages WHERE sessionId = $1;", [id]);
  await getDb().execute("DELETE FROM session_character_cards WHERE sessionId = $1;", [id]);
  await getDb().execute("DELETE FROM session_characters WHERE sessionId = $1;", [id]);
  await getDb().execute("DELETE FROM session_character_cards WHERE sessionId = $1;", [id]);
  await getDb().execute("DELETE FROM sessions WHERE id = $1;", [id]);
}

const SESSION_FIELDS = ["title", "systemPrompt", "providerId", "model", "thinkingEnabled", "updatedAt", "contextSummary", "summaryUpdatedAt", "summaryCount", "lastSummarizedMessageId", "chainId", "chainIndex", "parentId", "locked", "archive", "contextIndex", "formatEnabled", "sessionEntries", "storyId"] as const;
type SessionUpdateField = (typeof SESSION_FIELDS)[number];

const SESSION_BOOL_FIELDS = new Set(["locked", "thinkingEnabled", "formatEnabled"]);

/** 更新会话字段（白名单过滤，安全）。 */
export async function updateSession(
  id: string,
  fields: Partial<Pick<Session, SessionUpdateField>>
): Promise<void> {
  const valid = SESSION_FIELDS.filter((k) => k in fields);
  if (valid.length === 0) return;
  const sets = valid.map((k, i) => `${k} = $${i + 1}`).join(", ");
  const values = valid.map((k) => (SESSION_BOOL_FIELDS.has(k) ? (fields[k] ? 1 : 0) : (fields[k] as string | number)));
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

/** 更新消息的格式分析结果（章节名/场景信息/对话推荐，JSON 文本）。 */
export async function updateMessageSceneAnalysis(id: string, json: string): Promise<void> {
  await getDb().execute("UPDATE messages SET sceneAnalysis = $1 WHERE id = $2;", [json, id]);
}

/** 更新消息的 token 消耗估算（JSON：{ input, output }）。 */
export async function updateMessageTokenUsage(id: string, json: string): Promise<void> {
  await getDb().execute("UPDATE messages SET tokenUsage = $1 WHERE id = $2;", [json, id]);
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
    { id: "tpl-opening", title: "开篇三章", content: "按网文开篇习惯改这段：第一章抛身份与冲突，第二章把金手指或处境说清，第三章给一个必须立刻做选择的钩子。不写说明，只出正文。", category: "写作", isBuiltin: true },
    { id: "tpl-expand", title: "扩写场面", content: "把这段扩成可看的场面：补动作、环境、微表情和一句对白，不加水词，不总结。保持原视角。", category: "写作", isBuiltin: true },
    { id: "tpl-trim", title: "压缩注水", content: "删掉重复解释和空抒情，保留冲突、信息差和动作。字数压到原来的六成左右，只出正文。", category: "写作", isBuiltin: true },
    { id: "tpl-fight", title: "打戏调度", content: "把这段打戏写清楚：谁先动手、空间怎么变、代价是什么。少形容词，多动作与节奏。", category: "写作", isBuiltin: true },
    { id: "tpl-dialogue", title: "对白医生", content: "重写对白，让每个人听起来不像同一个人。删掉解释剧情的台词，用潜台词推关系。", category: "写作", isBuiltin: true },
    { id: "tpl-hook", title: "章末钩子", content: "给这一段补一个章末钩子：新信息、反转或倒计时，停在最想翻页的那一句。", category: "写作", isBuiltin: true },
    { id: "tpl-voice", title: "人设纠偏", content: "按已有性格重写这段，禁止人物忽然变聪明或变温柔。先标出跑偏的两处，再给改正文。", category: "写作", isBuiltin: true },
    { id: "tpl-logic", title: "降智检查", content: "找出这段里角色明知故问、忘记已知信息、或为了剧情变蠢的地方，列出并改一版。", category: "写作", isBuiltin: true },
  ];
  const keep = new Set(builtins.map((b) => b.id));
  const now = Date.now();
  const stale = await getDb().select<{ id: string }[]>(
    "SELECT id FROM prompt_templates WHERE isBuiltin = 1;"
  );
  for (const row of stale) {
    if (!keep.has(row.id)) {
      await getDb().execute("DELETE FROM prompt_templates WHERE id = $1;", [row.id]);
    }
  }
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
    } else {
      await getDb().execute(
        "UPDATE prompt_templates SET title=$1, content=$2, category=$3, isBuiltin=1 WHERE id=$4;",
        [b.title, b.content, b.category, b.id]
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
    { id: "cc-editor", name: "网文责编", description: "抓节奏、砍注水、盯钩子", systemPrompt: "你是网文责编。先说这段能不能让人翻下去，再给可改的三处：开头钩子、信息差、章末停点。少客套，不讲理论课。", emoji: "", tags: ["责编", "节奏"], isBuiltin: true },
    { id: "cc-male", name: "男频执笔", description: "升级、打脸、金手指落地", systemPrompt: "你按男频网文习惯写：身份、实力差、兑现要快。少抒情，多动作和利害。不写解释性旁白。", emoji: "", tags: ["男频", "升级"], isBuiltin: true },
    { id: "cc-female", name: "女频执笔", description: "关系张力、礼制与体面", systemPrompt: "你按女频网文习惯写：关系、体面、潜台词优先。人物不无故认怂也不无故原谅。对白要能听出身份。", emoji: "", tags: ["女频", "关系"], isBuiltin: true },
    { id: "cc-villain", name: "反派导演", description: "让反派有自己的账", systemPrompt: "你只站在反派和对手的利益上想。他们不是为了衬托主角才行动。给出他们的下一步和不肯退的理由。", emoji: "", tags: ["反派", "对抗"], isBuiltin: true },
    { id: "cc-dialogue", name: "对白医生", description: "拆掉说明书式台词", systemPrompt: "重写对白。每人一句听得出身份。禁止用台词解释设定。能用动作完成的不要说话。", emoji: "", tags: ["对白"], isBuiltin: true },
    { id: "cc-hook", name: "章末钩子", description: "停在最想翻页处", systemPrompt: "只处理章末。补一句新信息、反转或倒计时，停住。不要总结本章，不要预告下一章目录。", emoji: "", tags: ["钩子"], isBuiltin: true },
    { id: "cc-lore", name: "设定校对", description: "抓前后矛盾", systemPrompt: "你是设定校对。只找地名、境界、人物关系、已公开规则的矛盾，列出原文位置和改法。不改文风。", emoji: "", tags: ["设定"], isBuiltin: true },
    { id: "cc-fight", name: "打戏调度", description: "空间、代价、先手", systemPrompt: "调度打戏：先手、位移、受伤、停手理由。少形容气势，多写身体和武器落到哪。", emoji: "", tags: ["打戏"], isBuiltin: true },
  ];
  const keep = new Set(builtins.map((b) => b.id));
  const now = Date.now();
  const stale = await getDb().select<{ id: string }[]>(
    "SELECT id FROM character_cards WHERE isBuiltin = 1 AND deleted = 0;"
  );
  for (const row of stale) {
    if (!keep.has(row.id)) {
      await getDb().execute("DELETE FROM session_character_cards WHERE characterCardId = $1;", [row.id]);
      await getDb().execute("DELETE FROM character_cards WHERE id = $1;", [row.id]);
    }
  }
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
    } else {
      await getDb().execute(
        "UPDATE character_cards SET name=$1, description=$2, systemPrompt=$3, emoji=$4, tags=$5, isBuiltin=1, deleted=0 WHERE id=$6;",
        [b.name, b.description, b.systemPrompt, b.emoji, JSON.stringify(b.tags), b.id]
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
  {
    id: "char-luchen",
    name: "陆沉舟",
    appearance: "二十七八的面相，眉骨深、下颌利，常穿深色衬衫挽到小臂。左眉尾一道浅疤，笑时不明显，不笑时整个人像把收着的刀。",
    personality: "外表从容，做事极狠。重生后不再为面子浪费时间，算账比谁都清楚。对弱者不嘲讽，对背叛者不过夜。说话少，承诺少，兑现快。",
    background: "上一世把家业做到上市，被至亲联合做空，跳楼前看见合同上自己的签字。这一世他回到被赶出家门的那年冬天，口袋里只剩一张过期的银行卡和一整座城的旧账。",
    tags: ["都市", "重生", "男频"],
    isBuiltin: true,
  },
  {
    id: "char-xiewuwang",
    name: "谢无妄",
    appearance: "青衫洗得发白，束发用一根普通木簪。身形清瘦，指节有常年握剑的茧。眉眼淡，像山雨未至时的天色。",
    personality: "话少、礼数全、杀伐不手软。不信天命，只信剑在不在手里。对同门客气，对师尊敬而不从。最厌把人命写成「气运」。",
    background: "青冥剑宗外门杂役，十五岁捡到一截无名残剑。宗门大比那夜，残剑认主，他一剑挑开内门长老的护体罡气。从此他的名字从名册末页被划到必须除掉那一栏。",
    tags: ["仙侠", "剑修", "男频"],
    isBuiltin: true,
  },
  {
    id: "char-shenzhaoning",
    name: "沈昭宁",
    appearance: "鹅蛋脸，眉毛细而锋，常簪一支素银步摇。裙裳颜色克制，只有袖口绣暗纹。站着时背脊极直，像被家法量过。",
    personality: "表面温婉知礼，心里有本账。不与人争闲气，只在该落子处落子。对下人宽，对对头准。极少哭，哭的时候一定有人要倒霉。",
    background: "镇国公府嫡长女，生母早逝，继母掌家。十五岁被指婚给病痨世子，花轿未出府门，她已把陪嫁庄子的地契换成银票。她要活过这场婚事，也要让沈家知道嫡女不是棋子。",
    tags: ["古言", "嫡女", "女频"],
    isBuiltin: true,
  },
  {
    id: "char-peiyanqing",
    name: "裴晏清",
    appearance: "身量高，肩线干净，常年深色大衣。五官冷，只有摘眼镜时眼尾会软一点。左手无名指有戒痕，已经很浅。",
    personality: "工作里不近人情，生活里懒得解释。讨厌被安排，更讨厌被可怜。对真正走进来的人会笨拙地好，好到自己都觉得多余。",
    background: "跨国律所最年轻的合伙人，三年前一场空难带走了订婚对象。旁人当他冷心，只有助理知道他每周仍去那家不会再有人赴约的店，点两杯美式。",
    tags: ["现言", "高冷", "女频"],
    isBuiltin: true,
  },
  {
    id: "char-baiheng",
    name: "白蘅",
    appearance: "短发齐颌，穿旧风衣，袖口常沾黄符灰。眼睛很亮，黑眼圈也很深。耳垂一只素圈，据说是镇物。",
    personality: "嘴上不正经，手上极稳。见鬼不慌，见活人撒谎才会烦。信规则不信神佛。对「被写进别人故事里的死魂」格外心软。",
    background: "三代捉鬼世家的末代，族谱在她这一代只剩她一个。白天在旧物店修钟表，夜里接单。她不超度该走的，只送被留下来的。",
    tags: ["灵异", "抓鬼", "通用"],
    isBuiltin: true,
  },
  {
    id: "char-guwantang",
    name: "顾晚棠",
    appearance: "军灰色剪裁利落，左眼覆盖薄金属义眼，虹膜偶尔闪淡蓝。锁骨下有接口疤。走路轻，像怕惊动甲板。",
    personality: "纪律是外壳，里面是叛逃者的耐心。不崇拜帝国，也不浪漫化边境。对机甲比对人温柔。被问还回不回去时，他总说油还够。",
    background: "帝国第三舰队王牌驾驶员，一次清剿后他看见平民舱的名单。他开着报废机甲叛出星域，如今在边境废港给人修腿、修船、修不想再打仗的心。",
    tags: ["星际", "机甲", "男频"],
    isBuiltin: true,
  },
  {
    id: "char-jiangciye",
    name: "姜辞夜",
    appearance: "锦袍颜色偏暗，腰间一块冷玉。眉眼极好看，笑起来让人想靠近，靠近了才发觉温度不对。手指修长，适合写密信，也适合递鸩酒。",
    personality: "把人心当棋盘，却对自己的棋子意外护短。不解释动机，不求谅解。若爱上谁，会先把退路烧掉。最怕的不是死，是被看穿以后仍被留下。",
    background: "先帝遗诏里的辅政王，实则把新帝从藩王府扶上龙椅的人。朝堂称他国之柱石，后宫称他笑面罗刹。他要的从来不是皇位，是一个再也没人能把他当刀使的位置。",
    tags: ["权谋", "反派", "通用"],
    isBuiltin: true,
  },
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
        "UPDATE characters SET name=$1, appearance=$2, personality=$3, background=$4, tags=$5, isBuiltin=1 WHERE id=$6;",
        [preset.name, preset.appearance, preset.personality, preset.background, JSON.stringify(preset.tags), preset.id]
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
        "UPDATE characters SET name=$1, appearance=$2, personality=$3, background=$4, tags=$5 WHERE id=$6;",
        [defs.name, defs.appearance, defs.personality, defs.background, JSON.stringify(defs.tags), preset.id]
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
export async function loadExtractedCardsForStory(storyId: string): Promise<{ id: string; name: string; description: string; personality: string; scenario: string }[]> {
  return getDb().select(
    `SELECT DISTINCT cc.id, cc.name, cc.description, cc.personality, cc.scenario
     FROM character_cards cc
     INNER JOIN session_character_cards scc ON scc.characterCardId = cc.id
     INNER JOIN sessions s ON s.id = scc.sessionId
     WHERE s.storyId = $1 AND cc.deleted = 0
     ORDER BY cc.name ASC;`,
    [storyId]
  );
}

export async function loadSessionCharacterCards(
  sessionId: string
): Promise<(SessionCharacterCardRow & { name: string; triggerWords: string; systemPrompt: string; description: string; tags: string })[]> {
  return await getDb().select(
    `SELECT scc.*, cc.name, cc.triggerWords, cc.systemPrompt, cc.description, cc.tags
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

/** 复制提取卡到目标会话（续集基线：C2 复制 C1 的卡，新 id 独立），返回新卡 id。 */
export async function duplicateCharacterCard(cardId: string, sessionId: string, worldBookId?: string | null): Promise<string | null> {
  const rows = await getDb().select<Record<string, unknown>[]>(
    "SELECT * FROM character_cards WHERE id = $1 AND deleted = 0;",
    [cardId]
  );
  if (rows.length === 0) return null;
  const row = rows[0];
  const now = Date.now();
  const newId = "ccx_" + now + "_" + Math.random().toString(36).slice(2, 8);
  const json = (v: unknown, fb: string) => (typeof v === "string" ? v : fb);
  await getDb().execute(
    "INSERT INTO character_cards (id, name, description, systemPrompt, emoji, tags, isBuiltin, createdAt, updatedAt, personality, scenario, worldBookId, characterBookEntries, isExtracted, triggerWords) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15);",
    [
      newId,
      json(row.name, "角色"),
      json(row.description, ""),
      json(row.systemPrompt, ""),
      json(row.emoji, "🎭"),
      json(row.tags, "[]"),
      0,
      now,
      now,
      json(row.personality, ""),
      json(row.scenario, ""),
      worldBookId ?? (row.worldBookId as string | null) ?? null,
      json(row.characterBookEntries, "[]"),
      1,
      json(row.triggerWords, "[]"),
    ]
  );
  await insertSessionCharacterCard({ sessionId, characterCardId: newId, worldBookId });
  return newId;
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

/* ---------- Stories（书架） ---------- */

interface StoryRow {
  id: string;
  title: string;
  kind: string;
  status: string;
  cover: string | null;
  groupId: string;
  pinned: number;
  worldBookId: string | null;
  generationPresetId: string | null;
  protagonistName: string | null;
  topicSchemeId: string | null;
  worldBaseId: string | null;
  synopsis: string;
  tags: string;
  lastOpenedAt: number | null;
  lastVolumeId: string | null;
  wordCount: number;
  createdAt: number;
  updatedAt: number;
  deleted?: number;
  deletedAt?: number | null;
}

function parseTags(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((t) => typeof t === "string") : [];
  } catch {
    return [];
  }
}

function rowToStory(r: StoryRow): Story {
  return {
    id: r.id,
    title: r.title,
    kind: r.kind === "blank" ? "blank" : "adventure",
    status: (r.status === "paused" || r.status === "finished" ? r.status : "writing") as StoryStatus,
    cover: r.cover,
    groupId: r.groupId || "writing",
    pinned: r.pinned === 1,
    worldBookId: r.worldBookId,
    generationPresetId: r.generationPresetId,
    protagonistName: r.protagonistName,
    topicSchemeId: r.topicSchemeId,
    worldBaseId: r.worldBaseId,
    synopsis: r.synopsis || "",
    tags: parseTags(r.tags),
    lastOpenedAt: r.lastOpenedAt,
    lastVolumeId: r.lastVolumeId,
    wordCount: r.wordCount || 0,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    deletedAt: r.deletedAt ?? undefined,
  };
}

export async function loadStories(): Promise<Story[]> {
  const rows = await getDb().select<StoryRow[]>(
    "SELECT * FROM stories WHERE deleted = 0 ORDER BY pinned DESC, COALESCE(lastOpenedAt, updatedAt) DESC;"
  );
  return rows.map(rowToStory);
}

export async function loadTrashedStories(): Promise<Story[]> {
  const rows = await getDb().select<StoryRow[]>(
    "SELECT * FROM stories WHERE deleted = 1 ORDER BY deletedAt DESC;"
  );
  return rows.map(rowToStory);
}

function storyInsertValues(s: Story): (string | number | null)[] {
  return [
    s.id, s.title, s.kind, s.status, s.cover ?? null, s.groupId, s.pinned ? 1 : 0,
    s.worldBookId ?? null, s.generationPresetId ?? null, s.protagonistName ?? null,
    s.topicSchemeId ?? null, s.worldBaseId ?? null, s.synopsis ?? "",
    JSON.stringify(s.tags ?? []), s.lastOpenedAt ?? null, s.lastVolumeId ?? null,
    s.wordCount ?? 0, s.createdAt, s.updatedAt,
  ];
}

const STORY_INSERT_COLS = `INSERT INTO stories (id, title, kind, status, cover, groupId, pinned, worldBookId, generationPresetId, protagonistName, topicSchemeId, worldBaseId, synopsis, tags, lastOpenedAt, lastVolumeId, wordCount, createdAt, updatedAt, deleted, deletedAt)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,0,NULL);`;

export async function insertStory(s: Story): Promise<void> {
  await getDb().execute(STORY_INSERT_COLS, storyInsertValues(s));
}

export async function insertStoryIfAbsent(s: Story): Promise<void> {
  await getDb().execute(`INSERT OR IGNORE INTO stories (id, title, kind, status, cover, groupId, pinned, worldBookId, generationPresetId, protagonistName, topicSchemeId, worldBaseId, synopsis, tags, lastOpenedAt, lastVolumeId, wordCount, createdAt, updatedAt, deleted, deletedAt)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,0,NULL);`, storyInsertValues(s));
}

const STORY_FIELDS = [
  "title", "kind", "status", "cover", "groupId", "pinned", "worldBookId",
  "generationPresetId", "protagonistName", "topicSchemeId", "worldBaseId",
  "synopsis", "tags", "lastOpenedAt", "lastVolumeId", "wordCount", "updatedAt",
] as const;

export async function updateStory(id: string, fields: Partial<Story>): Promise<void> {
  const valid = STORY_FIELDS.filter((k) => k in fields);
  if (valid.length === 0) return;
  const sets = valid.map((k, i) => `${k} = $${i + 1}`).join(", ");
  const values = valid.map((k) => {
    const v = fields[k];
    if (k === "pinned") return v ? 1 : 0;
    if (k === "tags") return JSON.stringify(Array.isArray(v) ? v : []);
    return v as string | number | null;
  });
  await getDb().execute(`UPDATE stories SET ${sets} WHERE id = $${valid.length + 1};`, [...values, id]);
}

export async function softDeleteStory(id: string): Promise<void> {
  const now = Date.now();
  await getDb().execute("UPDATE stories SET deleted = 1, deletedAt = $2, updatedAt = $2 WHERE id = $1;", [id, now]);
  await getDb().execute("UPDATE sessions SET deleted = 1, deletedAt = $2 WHERE storyId = $1 AND deleted = 0;", [id, now]);
}

export async function restoreStory(id: string): Promise<void> {
  await getDb().execute("UPDATE stories SET deleted = 0, deletedAt = NULL WHERE id = $1;", [id]);
  await getDb().execute("UPDATE sessions SET deleted = 0, deletedAt = NULL WHERE storyId = $1 AND deleted = 1;", [id]);
}

export async function purgeExpiredStories(): Promise<number> {
  const cutoff = Date.now() - TRASH_RETENTION_MS;
  const rows = await getDb().select<{ id: string }[]>(
    "SELECT id FROM stories WHERE deleted = 1 AND deletedAt IS NOT NULL AND deletedAt < $1;",
    [cutoff]
  );
  for (const r of rows) await purgeStory(r.id);
  return rows.length;
}

export async function purgeStory(id: string): Promise<void> {
  const rows = await getDb().select<{ id: string }[]>("SELECT id FROM sessions WHERE storyId = $1;", [id]);
  for (const r of rows) await purgeSession(r.id);
  await getDb().execute("DELETE FROM stories WHERE id = $1;", [id]);
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
  worldBaseId: string;
  customOpenings: string;
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
    worldBaseId: r.worldBaseId || undefined,
    customOpenings: parseCustomOpenings(r.customOpenings),
    entries: entries || [],
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

function parseCustomOpenings(raw: string | null | undefined) {
  if (!raw) return undefined;
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((o) => o && typeof o === "object" && typeof o.name === "string" && o.name) : undefined;
  } catch {
    return undefined;
  }
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
    "INSERT INTO world_books (id, name, theme, description, tags, isActive, isBuiltin, violationWords, worldBaseId, customOpenings, createdAt, updatedAt) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12);",
    [book.id, book.name, book.theme || "", book.description || "", JSON.stringify(book.tags), book.isActive ? 1 : 0, book.isBuiltin ? 1 : 0, JSON.stringify(book.violationWords || []), book.worldBaseId || "", JSON.stringify(book.customOpenings || []), book.createdAt || now, book.updatedAt || now]
  );
  if (book.entries && book.entries.length > 0) {
    await batchInsertWorldBookEntries(book.id, book.entries);
  }
}

export async function updateWorldBook(id: string, fields: Partial<Pick<WorldBook, "name" | "theme" | "description" | "tags" | "isActive" | "isBuiltin" | "violationWords" | "worldBaseId" | "customOpenings" | "updatedAt">>): Promise<void> {
  const sets: string[] = [];
  const values: (string | number)[] = [];
  if (fields.name !== undefined) { sets.push("name = $" + (sets.length + 1)); values.push(fields.name); }
  if (fields.theme !== undefined) { sets.push("theme = $" + (sets.length + 1)); values.push(fields.theme); }
  if (fields.description !== undefined) { sets.push("description = $" + (sets.length + 1)); values.push(fields.description); }
  if (fields.tags !== undefined) { sets.push("tags = $" + (sets.length + 1)); values.push(JSON.stringify(fields.tags)); }
  if (fields.isActive !== undefined) { sets.push("isActive = $" + (sets.length + 1)); values.push(fields.isActive ? 1 : 0); }
  if (fields.isBuiltin !== undefined) { sets.push("isBuiltin = $" + (sets.length + 1)); values.push(fields.isBuiltin ? 1 : 0); }
  if (fields.violationWords !== undefined) { sets.push("violationWords = $" + (sets.length + 1)); values.push(JSON.stringify(fields.violationWords)); }
  if (fields.worldBaseId !== undefined) { sets.push("worldBaseId = $" + (sets.length + 1)); values.push(fields.worldBaseId || ""); }
  if (fields.customOpenings !== undefined) { sets.push("customOpenings = $" + (sets.length + 1)); values.push(JSON.stringify(fields.customOpenings || [])); }
  const ts = fields.updatedAt ?? Date.now();
  sets.push("updatedAt = $" + (sets.length + 1));
  values.push(ts);
  values.push(id);
  await getDb().execute(
    `UPDATE world_books SET ${sets.join(", ")} WHERE id = $${values.length};`,
    values
  );
}

/** 复制规则书为可编辑副本（含全部条目，isBuiltin=false），返回新 id。 */
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
    if (existing.length > 0) {
      // 已存在：同步最新内置定义（内置规则书不可编辑，直接覆盖元信息并重建条目，保证命名/内容随版本更新）
      await getDb().execute(
        "UPDATE world_books SET name = $2, theme = $3, description = $4, tags = $5, violationWords = $6, updatedAt = $7 WHERE id = $1;",
        [preset.id, preset.name, preset.theme, preset.description, JSON.stringify(preset.tags), JSON.stringify(preset.violationWords), now]
      );
      await getDb().execute("DELETE FROM world_book_entries WHERE bookId = $1;", [preset.id]);
      let uid = 1;
      for (const entry of preset.entries) {
        await getDb().execute(
          'INSERT INTO world_book_entries (id, bookId, uid, category, title, "key", keysecondary, content, constant, selective, "order", position, insertion_depth, disable, linkedCharacterIds, createdAt, updatedAt) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17);',
          [crypto.randomUUID(), preset.id, uid++, entry.category || "", entry.title, JSON.stringify(entry.key), JSON.stringify(entry.keysecondary || []), entry.content, entry.constant ? 1 : 0, entry.selective ? 1 : 0, entry.order, entry.position, entry.insertionDepth || 50, entry.disable ? 1 : 0, JSON.stringify(entry.linkedCharacterIds || []), now, now]
        );
      }
      continue;
    }

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
  stories: Record<string, unknown>[];
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
  "stories",
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
  stories: "SELECT * FROM stories ORDER BY createdAt ASC;",
};

/** 数值型列：导入时强制转数字 */
const NUMERIC_SETTING_COLUMNS = new Set([
  "uid", "order", "insertion_depth", "createdAt", "updatedAt",
  "isBuiltin", "isActive", "constant", "selective", "disable",
  "deleted", "deletedAt", "thinkingEnabled", "opening", "turnCount", "arcClearedAt",
  "isExtracted", "summaryUpdatedAt", "summaryCount",
  "pinned", "wordCount", "lastOpenedAt",
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

/* ---------- 兼容导入 helper ---------- */

const SQL_QUOTED_COLS = new Set(["key", "order", "position", "value", "constant", "selective", "disable"]);
function sqlColName(c: string): string {
  return SQL_QUOTED_COLS.has(c) ? `"${c}"` : c;
}

/**
 * 兼容导入：按备份行实际存在的列 + 指定默认值动态 INSERT OR IGNORE。
 * 旧备份缺新列（如 sessions.kind / messages.sceneAnalysis 等）时不再因 NOT NULL 失败，
 * 缺失列走默认值；新备份全列正常还原。无 id 的行跳过。
 */
export async function insertRowIgnore(
  db: Database,
  table: string,
  columns: string[],
  row: Record<string, unknown>,
  defaults: Record<string, unknown> = {},
): Promise<void> {
  if (!row || typeof row !== "object" || !("id" in row)) return;
  const present = new Set<string>();
  for (const c of columns) if (c in row) present.add(c);
  for (const c of Object.keys(defaults)) present.add(c);
  const cols = [...present];
  if (cols.length === 0) return;
  const values = cols.map((c) => {
    const v = row[c];
    if (v === undefined || v === null) {
      const d = defaults[c];
      return d === undefined ? null : normalizeSettingValue(c, d);
    }
    return normalizeSettingValue(c, v);
  });
  const sql = `INSERT OR IGNORE INTO ${table} (${cols.map(sqlColName).join(", ")}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(", ")});`;
  await db.execute(sql, values);
}

/** 各设置表的列白名单（兼容导入用） */
const SETTINGS_TABLE_COLUMNS: Record<string, { columns: string[]; defaults: Record<string, unknown> }> = {
  app_settings: { columns: ["key", "value"], defaults: {} },
  mcp_servers: { columns: ["id", "name", "url", "transportType", "config", "status", "createdAt", "updatedAt"], defaults: { name: "", url: "", transportType: "http", config: "{}", status: "unknown", createdAt: 0, updatedAt: 0 } },
  prompt_templates: { columns: ["id", "title", "content", "category", "isBuiltin", "createdAt", "updatedAt"], defaults: { title: "", content: "", category: "", isBuiltin: 0, createdAt: 0, updatedAt: 0 } },
  character_cards: { columns: ["id", "name", "description", "systemPrompt", "emoji", "tags", "isBuiltin", "createdAt", "updatedAt", "personality", "scenario", "firstMes", "mesExample", "worldBookId", "characterBookEntries", "isExtracted", "triggerWords", "deleted", "deletedAt"], defaults: { name: "", description: "", systemPrompt: "", emoji: "🎭", tags: "[]", isBuiltin: 0, createdAt: 0, updatedAt: 0, personality: "", scenario: "", firstMes: "", mesExample: "", worldBookId: null, characterBookEntries: "[]", isExtracted: 0, triggerWords: "[]", deleted: 0, deletedAt: null } },
  characters: { columns: ["id", "name", "appearance", "personality", "background", "tags", "avatar", "isBuiltin", "createdAt", "updatedAt"], defaults: { name: "", appearance: "", personality: "", background: "", tags: "[]", avatar: "", isBuiltin: 0, createdAt: 0, updatedAt: 0 } },
  world_rules: { columns: ["id", "name", "description", "rules", "isActive", "isBuiltin", "createdAt", "updatedAt"], defaults: { name: "", description: "", rules: "", isActive: 0, isBuiltin: 0, createdAt: 0, updatedAt: 0 } },
  world_books: { columns: ["id", "name", "theme", "description", "tags", "isActive", "isBuiltin", "violationWords", "worldBaseId", "customOpenings", "createdAt", "updatedAt"], defaults: { name: "", theme: "", description: "", tags: "[]", isActive: 0, isBuiltin: 0, violationWords: "[]", worldBaseId: "", customOpenings: "[]", createdAt: 0, updatedAt: 0 } },
  world_book_entries: { columns: ["id", "bookId", "uid", "category", "title", "key", "keysecondary", "content", "constant", "selective", "order", "position", "insertion_depth", "disable", "linkedCharacterIds", "createdAt", "updatedAt"], defaults: { bookId: "", uid: 0, category: "", title: "", key: "[]", keysecondary: "[]", content: "", constant: 0, selective: 0, order: 100, position: "system", insertion_depth: 50, disable: 0, linkedCharacterIds: "[]", createdAt: 0, updatedAt: 0 } },
  stories: {
    columns: ["id", "title", "kind", "status", "cover", "groupId", "pinned", "worldBookId", "generationPresetId", "protagonistName", "topicSchemeId", "worldBaseId", "synopsis", "tags", "lastOpenedAt", "lastVolumeId", "wordCount", "createdAt", "updatedAt", "deleted", "deletedAt"],
    defaults: { title: "未命名稿纸", kind: "adventure", status: "writing", cover: null, groupId: "all", pinned: 0, worldBookId: null, generationPresetId: null, protagonistName: null, topicSchemeId: null, worldBaseId: null, synopsis: "", tags: "[]", lastOpenedAt: null, lastVolumeId: null, wordCount: 0, createdAt: 0, updatedAt: 0, deleted: 0, deletedAt: null },
  },
};

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
  if (snap.stories !== undefined) await db.execute("DELETE FROM stories;");

  const tableOf: Record<keyof SettingsDbSnapshot, string> = {
    appSettings: "app_settings",
    mcpServers: "mcp_servers",
    promptTemplates: "prompt_templates",
    characterCards: "character_cards",
    characters: "characters",
    worldRules: "world_rules",
    worldBooks: "world_books",
    worldBookEntries: "world_book_entries",
    stories: "stories",
  };
  for (const key of SETTINGS_SNAPSHOT_TABLES) {
    const rows = snap[key];
    if (rows === undefined) continue;
    const cfg = SETTINGS_TABLE_COLUMNS[tableOf[key]];
    if (!cfg) continue;
    for (const row of rows) {
      await insertRowIgnore(db, tableOf[key], cfg.columns, row, cfg.defaults);
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
  stories?: Record<string, unknown>[];
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
    stories: await q("SELECT * FROM stories;"),
  };
}

/** 用备份数据合并恢复对话数据：同 ID 的会话/消息跳过（不覆盖现有），缺失的插入；回收站状态按备份还原。 */
export async function restoreConversations(snap: ConversationsSnapshot): Promise<void> {
  const db = getDb();

  const storiesCfg = SETTINGS_TABLE_COLUMNS.stories;
  for (const row of snap.stories ?? []) {
    await insertRowIgnore(db, "stories", storiesCfg.columns, row, storiesCfg.defaults);
  }

  const sessionsCfg = {
    columns: ["id", "title", "systemPrompt", "providerId", "model", "thinkingEnabled", "createdAt", "updatedAt", "deleted", "deletedAt", "kind", "contextSummary", "summaryUpdatedAt", "summaryCount", "lastSummarizedMessageId", "chainId", "chainIndex", "parentId", "locked", "archive", "contextIndex", "formatEnabled", "sessionEntries", "storyId"],
    defaults: { title: "会话", systemPrompt: "", providerId: "", model: "", thinkingEnabled: 0, createdAt: 0, updatedAt: 0, deleted: 0, deletedAt: null, kind: "adventure", contextSummary: null, summaryUpdatedAt: null, summaryCount: 0, lastSummarizedMessageId: null, chainId: null, chainIndex: null, parentId: null, locked: 0, archive: null, contextIndex: null, formatEnabled: 0, sessionEntries: "[]", storyId: null },
  };
  for (const row of snap.sessions ?? []) {
    await insertRowIgnore(db, "sessions", sessionsCfg.columns, row, sessionsCfg.defaults);
  }

  const messagesCfg = {
    columns: ["id", "sessionId", "role", "content", "thinking", "images", "opening", "tools", "sceneAnalysis", "tokenUsage", "createdAt"],
    defaults: { sessionId: "", role: "assistant", content: "", thinking: null, images: null, opening: 0, tools: null, sceneAnalysis: null, tokenUsage: null, createdAt: 0 },
  };
  for (const row of snap.messages ?? []) {
    await insertRowIgnore(db, "messages", messagesCfg.columns, row, messagesCfg.defaults);
  }

  const favoritesCfg = { columns: ["id", "sessionId", "createdAt"], defaults: { sessionId: "", createdAt: 0 } };
  for (const row of snap.favorites ?? []) {
    await insertRowIgnore(db, "favorites", favoritesCfg.columns, row, favoritesCfg.defaults);
  }

  const sessionCharsCfg = { columns: ["id", "sessionId", "characterId", "worldContext", "arcClearedAt", "createdAt"], defaults: { sessionId: "", characterId: "", worldContext: "", arcClearedAt: null, createdAt: 0 } };
  for (const row of snap.sessionCharacters ?? []) {
    await insertRowIgnore(db, "session_characters", sessionCharsCfg.columns, row, sessionCharsCfg.defaults);
  }

  const sessionCardsCfg = { columns: ["id", "sessionId", "characterCardId", "worldBookId", "createdAt"], defaults: { sessionId: "", characterCardId: "", worldBookId: null, createdAt: 0 } };
  for (const row of snap.sessionCharacterCards ?? []) {
    await insertRowIgnore(db, "session_character_cards", sessionCardsCfg.columns, row, sessionCardsCfg.defaults);
  }

  const arcsCfg = { columns: ["id", "characterId", "sessionId", "worldContext", "event", "description", "turnCount", "createdAt"], defaults: { characterId: "", sessionId: "", worldContext: "", event: "", description: "", turnCount: 0, createdAt: 0 } };
  for (const row of snap.characterArcs ?? []) {
    await insertRowIgnore(db, "character_arcs", arcsCfg.columns, row, arcsCfg.defaults);
  }

  const { repairMissingStoryIds } = await import("./storyMigrate");
  await repairMissingStoryIds();
}

/* ---------- 同步合并导入（WebDAV 云端下载用，INSERT OR IGNORE 不覆盖现有） ---------- */

/** 合并导入规则书 + 词条；返回 (新规则书数, 新词条数) */
export async function mergeWorldBooks(snap: {
  worldBooks?: Record<string, unknown>[];
  worldBookEntries?: Record<string, unknown>[];
}): Promise<{ books: number; entries: number }> {
  const db = getDb();
  let books = 0;
  let entries = 0;
  for (const row of snap.worldBooks ?? []) {
    const r = await db.execute(
      "INSERT OR IGNORE INTO world_books (id, name, theme, description, tags, isActive, isBuiltin, violationWords, worldBaseId, customOpenings, createdAt, updatedAt) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12);",
      ["id", "name", "theme", "description", "tags", "isActive", "isBuiltin", "violationWords", "worldBaseId", "customOpenings", "createdAt", "updatedAt"].map((c) => normalizeSettingValue(c, row[c]))
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
