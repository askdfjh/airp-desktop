/** 正文阅读排版偏好（仅作用于书写页，不改书架/设置的应用主题）。 */

export type ReaderBgId = "follow" | "paper" | "parchment" | "green" | "ink";
export type ReaderFontId = "system" | "song" | "kai" | "hei" | "yuan";

export interface ReaderPrefs {
  bg: ReaderBgId;
  night: boolean;
  font: ReaderFontId;
  fontSize: number;
  lineHeight: number;
  paragraphGap: number;
  letterSpacing: number;
  pagePadding: number;
  bold: boolean;
}

export const READER_BG_IDS: ReaderBgId[] = ["follow", "paper", "parchment", "green", "ink"];
export const READER_FONT_IDS: ReaderFontId[] = ["system", "song", "kai", "hei", "yuan"];

export const DEFAULT_READER_PREFS: ReaderPrefs = {
  bg: "paper",
  night: false,
  font: "song",
  fontSize: 17,
  lineHeight: 1.85,
  paragraphGap: 14,
  letterSpacing: 0.02,
  pagePadding: 24,
  bold: false,
};

export const READER_BG_PRESETS: { id: ReaderBgId; label: string; swatch: string }[] = [
  { id: "paper", label: "素纸", swatch: "#f3ead8" },
  { id: "parchment", label: "羊皮", swatch: "#efd39a" },
  { id: "green", label: "护眼", swatch: "#c7edcc" },
  { id: "ink", label: "青灰", swatch: "#d4ddd8" },
  { id: "follow", label: "跟随", swatch: "var(--seed-bg)" },
];

export const READER_FONT_PRESETS: { id: ReaderFontId; label: string; sample: string }[] = [
  { id: "song", label: "宋体", sample: "宋" },
  { id: "kai", label: "楷体", sample: "楷" },
  { id: "hei", label: "黑体", sample: "黑" },
  { id: "yuan", label: "圆体", sample: "圆" },
  { id: "system", label: "系统", sample: "系" },
];

const FONT_SIZE_FROM_MSG: Record<string, number> = {
  xs: 13,
  sm: 15,
  md: 17,
  lg: 19,
  xl: 21,
};

export function readerFontSizeFromMessage(size?: string): number | undefined {
  if (!size) return undefined;
  return FONT_SIZE_FROM_MSG[size];
}

export function clampReaderPrefs(partial: Partial<ReaderPrefs> | null | undefined): ReaderPrefs {
  const src = partial && typeof partial === "object" ? partial : {};
  const next: ReaderPrefs = { ...DEFAULT_READER_PREFS, ...src };
  if (!READER_BG_IDS.includes(next.bg)) next.bg = DEFAULT_READER_PREFS.bg;
  if (!READER_FONT_IDS.includes(next.font)) next.font = DEFAULT_READER_PREFS.font;
  next.night = !!next.night;
  next.bold = !!next.bold;
  next.fontSize = Math.min(32, Math.max(13, Math.round(Number(next.fontSize) || DEFAULT_READER_PREFS.fontSize)));
  const lh = Number(next.lineHeight);
  next.lineHeight = Math.min(2.8, Math.max(1.3, Number.isFinite(lh) ? Math.round(lh * 100) / 100 : DEFAULT_READER_PREFS.lineHeight));
  next.paragraphGap = Math.min(36, Math.max(0, Math.round(Number(next.paragraphGap) || 0)));
  const ls = Number(next.letterSpacing);
  next.letterSpacing = Math.min(0.16, Math.max(0, Number.isFinite(ls) ? Math.round(ls * 1000) / 1000 : DEFAULT_READER_PREFS.letterSpacing));
  next.pagePadding = Math.min(48, Math.max(12, Math.round(Number(next.pagePadding) || DEFAULT_READER_PREFS.pagePadding)));
  return next;
}

export function readerBgAttr(prefs: ReaderPrefs): string {
  return prefs.night ? "night" : prefs.bg;
}
