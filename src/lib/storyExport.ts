import type { Message, Story } from "@/types";
import { loadMessages } from "./db";
import { parseSceneReply } from "./sceneTemplate";
import { parseSceneAnalysis } from "./sceneAnalyzer";
import { useSessionStore } from "@/stores/sessionStore";

export function buildStoryText(story: Story, volumes: { id: string; chainIndex?: number }[], messagesByVolume: Message[][], includePlayer: boolean): string {
  const lines: string[] = [];
  lines.push(story.title);
  if (story.protagonistName) lines.push(`主角：${story.protagonistName}`);
  lines.push(`导出时间：${new Date().toLocaleString("zh-CN")}`);
  lines.push("");
  let lastChapter = "";
  volumes.forEach((vol, i) => {
    const msgs = messagesByVolume[i] || [];
    const volNo = vol.chainIndex ?? i + 1;
    let wroteVol = false;
    for (const m of msgs) {
      if (m.opening) continue;
      if (m.role === "user" && !includePlayer) continue;
      if (m.role !== "user" && m.role !== "assistant") continue;
      let body = m.content || "";
      if (m.role === "assistant") {
        body = parseSceneReply(body).body || body;
        body = body.replace(/【(?:章节名|场景信息|正文|对话推荐)】[^\n]*/g, "").trim();
        const sa = m.sceneAnalysis ? parseSceneAnalysis(m.sceneAnalysis) : null;
        const ch = sa?.chapterTitle?.trim();
        if (ch && ch !== lastChapter) {
          lastChapter = ch;
          lines.push("");
          lines.push(`## ${ch}`);
          lines.push("");
          wroteVol = true;
        }
      }
      if (!body) continue;
      if (!wroteVol) {
        lines.push("");
        lines.push(`## 第 ${volNo} 卷`);
        lines.push("");
        wroteVol = true;
      }
      if (m.role === "user") lines.push(`（你）${body}`);
      else lines.push(body);
      lines.push("");
    }
  });
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
}

export async function exportStoryTxt(story: Story, includePlayer = false): Promise<string> {
  const volumes = useSessionStore.getState().sessions
    .filter((s) => s.storyId === story.id)
    .sort((a, b) => (a.chainIndex ?? 1) - (b.chainIndex ?? 1));
  const bags: Message[][] = [];
  for (const v of volumes) bags.push(await loadMessages(v.id));
  return buildStoryText(story, volumes, bags, includePlayer);
}

export function countStoryChars(messagesByVolume: Message[][]): number {
  let n = 0;
  for (const msgs of messagesByVolume) {
    for (const m of msgs) {
      if (m.opening || (m.role !== "user" && m.role !== "assistant")) continue;
      const body = m.role === "assistant" ? (parseSceneReply(m.content || "").body || m.content || "") : (m.content || "");
      n += body.replace(/\s+/g, "").length;
    }
  }
  return n;
}

export async function saveStoryTxt(story: Story, includePlayer = false): Promise<"saved" | "copied"> {
  const text = await exportStoryTxt(story, includePlayer);
  const name = `${(story.title || "未命名").replace(/[\\/:*?"<>|]/g, "_").slice(0, 40)}.txt`;
  try {
    const { save } = await import("@tauri-apps/plugin-dialog");
    const { writeTextFile } = await import("@tauri-apps/plugin-fs");
    const path = await save({ defaultPath: name, filters: [{ name: "Text", extensions: ["txt"] }] });
    if (path) {
      await writeTextFile(path, text);
      return "saved";
    }
  } catch {
    /* 安卓选路径经常不可用 */
  }
  try {
    const { writeTextFile, BaseDirectory } = await import("@tauri-apps/plugin-fs");
    await writeTextFile(name, text, { baseDir: BaseDirectory.Download });
    return "saved";
  } catch {
    /* 下载目录不可写时走剪贴板 */
  }
  if (typeof navigator.share === "function") {
    try {
      await navigator.share({ title: story.title, text });
      return "saved";
    } catch {
      /* 用户取消分享 */
    }
  }
  await navigator.clipboard.writeText(text);
  return "copied";
}
