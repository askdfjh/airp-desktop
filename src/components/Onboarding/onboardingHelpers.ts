import { inferWorldBookAudience, type WorldAudience } from "@/lib/worldAudience";
import type { WorldBook, WorldBookEntry } from "@/types";
import { PRESET_WORLDS, WORLD_BOOK_MAP } from "./WorldSelect";
import { getWorldFoundation } from "@/lib/worldFoundations";

// 世界底座 ID（modern/ancient/cultivation/...）→ 预设世界观 ID（urban/palace/cultivation/...）
// 通过底座对应的内置世界书 id 反查 WORLD_BOOK_MAP；匹配不到时原样返回
export function worldviewIdForBase(baseId: string | null | undefined) {
  if (!baseId) return "custom";
  const bookId = getWorldFoundation(baseId).builtinBookId;
  if (bookId) {
    const hit = Object.entries(WORLD_BOOK_MAP).find(([, v]) => v === bookId);
    if (hit) return hit[0];
  }
  return baseId;
}

export function resolveOnboardingContext(params: {
  selectedWorldId: string | null;
  selectedWorldName: string | null;
  books: WorldBook[];
  activeBook: WorldBook | null;
}) {
  const selectedPresetWorld = PRESET_WORLDS.find((w) => w.id === params.selectedWorldId);
  const selectedBook =
    params.books.find((b) => b.id === params.selectedWorldId) ||
    params.books.find((b) => b.theme === params.selectedWorldId) ||
    params.activeBook ||
    null;
  const worldviewId = selectedPresetWorld?.id || selectedBook?.theme || params.selectedWorldId || "custom";
  const audience: WorldAudience | null =
    selectedPresetWorld?.gender ?? (selectedBook ? inferWorldBookAudience(selectedBook) : null);
  const worldText = [
    params.selectedWorldName,
    selectedBook?.name,
    selectedBook?.theme,
    selectedBook?.description,
    ...(selectedBook?.tags || []),
  ]
    .filter(Boolean)
    .join(" ");

  return { selectedPresetWorld, selectedBook, worldviewId, audience, worldText };
}

export function getEnabledEntries(book: WorldBook | null | undefined) {
  return (book?.entries || []).filter((e) => !e.disable && e.title.trim() && e.content.trim());
}

export function pickMainEntries(book: WorldBook | null | undefined): WorldBookEntry[] {
  const entries = getEnabledEntries(book);
  const highPriority = entries.filter((e) =>
    /基础|规则|核心|世界|主线|势力|组织|地点|舞台|身份|体系|宫廷|娱乐圈|宗门|现代|古代|时代|生存|副本/.test(
      `${e.category} ${e.title} ${e.key.join(" ")} ${e.content}`,
    ),
  );
  const pool = highPriority.length > 0 ? highPriority : entries;
  return pool.slice(0, 8);
}

