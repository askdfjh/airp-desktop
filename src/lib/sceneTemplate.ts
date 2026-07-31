// 固定回复模板：AI 每次回复按【场景信息】【正文】【对话推荐】三区块输出，
// 前端解析后在版面上渲染：左侧场景信息栏、右侧对话推荐栏。

export const SCENE_TEMPLATE_PROMPT = `【回复模板·必须严格遵守】
每次回复都按以下固定模板输出（用于版面渲染）：
【场景信息】
地点：<当前具体地点>
时间：<当前时间，如：辰时·上午，或具体时刻>
出场角色：<本段出场角色名，用顿号分隔>
起因：<本段剧情的起因，一句话>
【正文】
<正文内容，这是唯一展示给用户的故事正文>
【对话推荐】
1. <下一步可选的行动或对话>
2. <下一步可选的行动或对话>
3. <下一步可选的行动或对话>
注意：若本条回复是纯工具调用、简短回应或无叙事推进，可省略【场景信息】与【对话推荐】区块，直接输出正文。`;

export interface SceneInfo {
  location: string;
  time: string;
  characters: string;
  cause: string;
}

export interface ParsedReply {
  scene: SceneInfo | null;
  body: string;
  suggestions: string[];
}

const SECTION_RE = /【场景信息】([\s\S]*?)【正文】([\s\S]*?)(?:【对话推荐】([\s\S]*?))?\s*$/;

export function parseSceneReply(content: string): ParsedReply {
  const m = content.match(SECTION_RE);
  if (!m) {
    return { scene: null, body: content.trim(), suggestions: [] };
  }
  const sceneText = m[1].trim();
  const body = (m[2] || "").trim();
  const sugText = (m[3] || "").trim();

  const field = (label: string) => {
    const fm = sceneText.match(new RegExp(label + "[:：]\\s*([^\\n]+)"));
    return fm ? fm[1].trim() : "";
  };

  const location = field("地点");
  const time = field("时间");
  const characters = field("出场角色");
  const cause = field("起因");
  const scene: SceneInfo | null =
    location || time || characters || cause
      ? { location, time, characters, cause }
      : null;

  const suggestions = sugText
    .split("\n")
    .map((l) => l.replace(/^\s*(?:\d+[.、．)）]\s*|[-*•·]\s*)/, "").trim())
    .filter(Boolean);

  return { scene, body: body || content.trim(), suggestions };
}
