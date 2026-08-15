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
