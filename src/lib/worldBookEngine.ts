import type { WorldBook, WorldBookEntry } from "@/types";

export interface WorldContextOptions {
  maxChars?: number;
  maxMatchedEntries?: number;
  maxConstantEntries?: number;
}

export interface WorldContextResult {
  text: string;
  matchedEntryIds: string[];
  constantCount: number;
}

const DEFAULT_OPTIONS = {
  maxChars: 8000,
  maxMatchedEntries: 20,
  maxConstantEntries: 15,
};

function normalize(s: string): string {
  return s.toLowerCase().replace(/\s+/g, "");
}

export function findMatchingEntries(entries: WorldBookEntry[], contextText: string): WorldBookEntry[] {
  const haystack = normalize(contextText);
  if (!haystack) return [];
  const matched: WorldBookEntry[] = [];
  for (const e of entries) {
    if (e.disable || e.constant) continue;
    const keys = [...(e.key || []), ...(e.keysecondary || [])];
    for (const k of keys) {
      const kw = normalize(k);
      if (kw && kw.length >= 2 && haystack.includes(kw)) {
        matched.push(e);
        break;
      }
    }
  }
  return matched;
}

/** 随机世界事件抽卡：从非常驻、未命中、未抽过的启用条目中均匀随机抽 1 条；池空返回 null */
export function pickRandomEventEntry(
  entries: WorldBookEntry[],
  matchedIds: string[],
  excludeIds: string[] = [],
): WorldBookEntry | null {
  const pool = entries.filter(
    (e) => !e.disable && !e.constant && !matchedIds.includes(e.id) && !excludeIds.includes(e.id),
  );
  if (pool.length === 0) return null;
  return pool[Math.floor(Math.random() * pool.length)];
}

export function buildWorldContext(
  book: WorldBook | null,
  recentText: string,
  options?: WorldContextOptions,
): WorldContextResult {
  const empty: WorldContextResult = { text: "", matchedEntryIds: [], constantCount: 0 };
  if (!book || !book.entries || book.entries.length === 0) return empty;

  const opts = { ...DEFAULT_OPTIONS, ...options };
  const enabled = book.entries.filter((e) => !e.disable);
  const constants = enabled
    .filter((e) => e.constant)
    .sort((a, b) => b.insertionDepth - a.insertionDepth || a.order - b.order);
  const matched = findMatchingEntries(enabled, recentText).sort(
    (a, b) => b.insertionDepth - a.insertionDepth || a.order - b.order,
  );

  const header = `【世界规则·${book.name}】（世界基础规则：仅定义舞台与底层设定；若与题材规则冲突，以题材规则为准）`;
  const sections: string[] = [];
  let consumed = header.length;
  const matchedEntryIds: string[] = [];

  const pushEntry = (e: WorldBookEntry, label: string) => {
    const line = `【${e.category}·${e.title}】${e.content}`;
    sections.push(line);
  };

  for (const e of constants.slice(0, opts.maxConstantEntries)) {
    pushEntry(e, "constant");
  }

  for (const e of matched.slice(0, opts.maxMatchedEntries)) {
    pushEntry(e, "matched");
    matchedEntryIds.push(e.id);
  }

  let text = header;
  let included: string[] = [];
  for (const line of sections) {
    if (consumed + line.length + 1 > opts.maxChars) break;
    included.push(line);
    consumed += line.length + 1;
  }
  if (included.length === 0) return empty;
  text = header + "\n" + included.join("\n");

  return {
    text,
    matchedEntryIds,
    constantCount: constants.length,
  };
}
