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
<正文内容，这是唯一展示给用户的故事正文。正文要有充足篇幅（通常500-1000字），以小说家笔法充分展开：场景描写、动作、对话、心理活动、感官细节都要到位，让读者身临其境；严禁简略概括或草草收尾，每段回复都要完整推进剧情并留下回味>
【对话推荐】
1. <下一步可选的行动或对话>
2. <下一步可选的行动或对话>
3. <下一步可选的行动或对话>
注意：对话推荐必须是玩家可直接执行的剧情行动或对话（如探索、交谈、战斗、观察、思考），严禁推荐"查看世界设定/图鉴/背景资料/角色设定"等元操作类选项，也严禁把注入的世界设定内容（如【XX设定·XX】条目）原样抄入推荐列表。
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

// 元操作类推荐（查看设定/图鉴/背景资料等）不属于剧情行动，一律过滤
const META_DIRECT_RE = /(世界设定|世界观|背景设定|剧情背景|故事背景|图鉴|角色设定|人物设定|设定(?:介绍|详情|说明|列表|页面|面板|文档))/;
const META_VERB_RE = /(查看|阅读|浏览|打开|翻开|了解|看看|进入|点开|观阅|详看|翻看)[^，。；、]{0,8}(设定|图鉴|资料|背景|世界|介绍|界面)/;
// 世界书条目格式【分类·标题】及其派生（模型常把注入的世界书内容抄进推荐）
const WORLD_BOOK_ENTRY_RE = /^【[^】]+(?:设定|资料|背景|图鉴)[^】]*】/;
const WORLD_BOOK_TWO_SEG_RE = /^【[^】]+·[^】]+】/;

export function isMetaSuggestion(s: string): boolean {
  const t = s.trim();
  if (META_DIRECT_RE.test(t) || META_VERB_RE.test(t)) return true;
  if (WORLD_BOOK_ENTRY_RE.test(t)) return true;
  // 以【分类·标题】开头且长度超过一般推荐项，判定为世界书条目被误抄
  return WORLD_BOOK_TWO_SEG_RE.test(t) && t.length > 24;
}

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
    .filter((l) => Boolean(l) && !isMetaSuggestion(l));

  return { scene, body: body || content.trim(), suggestions };
}
