export type CoverThemeId = "modern" | "ancient" | "cultivation" | "future" | "otherworld" | "infinite" | "custom" | "draft";

export interface CoverTheme {
  id: CoverThemeId;
  ink: string;
  wash: string;
  rule: string;
  seal: string;
}

export const COVER_THEMES: Record<CoverThemeId, CoverTheme> = {
  modern: { id: "modern", ink: "#1c2430", wash: "#c5cdd6", rule: "rgba(28,36,48,0.18)", seal: "#3d4f66" },
  ancient: { id: "ancient", ink: "#3a2416", wash: "#d9c4a0", rule: "rgba(58,36,22,0.2)", seal: "#8a3b2a" },
  cultivation: { id: "cultivation", ink: "#1e2a24", wash: "#b7c4b4", rule: "rgba(30,42,36,0.2)", seal: "#2f6b55" },
  future: { id: "future", ink: "#141824", wash: "#a8b4c8", rule: "rgba(20,24,36,0.22)", seal: "#3a5a8c" },
  otherworld: { id: "otherworld", ink: "#241828", wash: "#c8b8c4", rule: "rgba(36,24,40,0.2)", seal: "#6b3d72" },
  infinite: { id: "infinite", ink: "#1a1c28", wash: "#b8bcc8", rule: "rgba(26,28,40,0.2)", seal: "#4a4e72" },
  custom: { id: "custom", ink: "#2a2438", wash: "#c4bdd4", rule: "rgba(42,36,56,0.2)", seal: "#5b4acf" },
  draft: { id: "draft", ink: "#2c2a26", wash: "#e4dfd4", rule: "rgba(44,42,38,0.16)", seal: "#6b6560" },
};

export function coverThemeFor(worldBaseId?: string | null, kind?: string): CoverTheme {
  if (kind === "blank") return COVER_THEMES.draft;
  const id = (worldBaseId || "custom") as CoverThemeId;
  return COVER_THEMES[id] || COVER_THEMES.custom;
}

export function verticalTitle(title: string, max = 16): string {
  const t = (title || "").replace(/\s+/g, "");
  return t.slice(0, max);
}
