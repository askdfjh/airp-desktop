import { useEffect } from "react";
import { dispatchBack, isAndroid } from "@/lib/androidBack";
import { useUIStore } from "@/stores/uiStore";
import { useStoryStore } from "@/stores/storyStore";

/** 桌面快捷键：Esc 分层返回，Ctrl+N 新故事，Ctrl+, 设置，Ctrl+F 书架搜索。 */
export function useDesktopHotkeys() {
  useEffect(() => {
    if (isAndroid) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const typing = !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
      const mod = e.ctrlKey || e.metaKey;

      if (e.key === "Escape") {
        if (typing) return;
        void dispatchBack().then((consumed) => {
          if (consumed) e.preventDefault();
        });
        return;
      }
      if (mod && e.key.toLowerCase() === "n" && !typing) {
        e.preventDefault();
        const ui = useUIStore.getState();
        if (ui.settingsOpen) ui.setSettingsOpen(false);
        if (ui.appPhase !== "bookshelf") ui.setAppPhase("bookshelf");
        useStoryStore.getState().startNewAdventure();
        return;
      }
      if (mod && e.key === ",") {
        e.preventDefault();
        useUIStore.getState().setSettingsOpen(true);
        return;
      }
      if (mod && e.key.toLowerCase() === "f" && !typing) {
        e.preventDefault();
        window.dispatchEvent(new Event("narra-focus-search"));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
