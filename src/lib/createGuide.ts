/**
 * 创建模式引导大纲与系统提示词模板。
 * 创建模式上下文隔离：只注入 ① 破限词(用户启用) ② 引导大纲 ③ 引导规则。
 * 不注入规则书 / 文风预设 / 角色卡 / 场景模板。
 */

export type CreateType = "character" | "world";
export type GuideMode = "ask" | "free";

export interface GuideQuestion {
  key: string;
  question: string;
}

export const GUIDE_LABEL: Record<CreateType, string> = {
  character: "角色",
  world: "规则书",
};

export const CHARACTER_GUIDE: GuideQuestion[] = [
  { key: "name", question: "这个角色的名字是什么？（也可以先用代称，后面再定）" },
  { key: "aliases", question: "ta 有什么别名、绰号或昵称吗？" },
  { key: "appearance", question: "ta 的外貌是怎样的？（年龄、体型、发型、衣着、标志性特征）" },
  { key: "personality", question: "ta 的性格特点是什么？（性格基调、主要优缺点）" },
  { key: "speechStyle", question: "ta 说话有什么风格？（语气、口头禅、习惯用词）" },
  { key: "background", question: "ta 的背景来历是什么？（出身、经历、当前处境）" },
  { key: "goals", question: "ta 的目标或欲望是什么？有什么执念或追求？" },
  { key: "flaws", question: "ta 有什么缺点或弱点？（性格上、能力上的都可以）" },
  { key: "relationships", question: "ta 与主角/玩家是什么关系？与哪些关键人物有联系？" },
  { key: "abilities", question: "ta 有什么特殊能力、技能或标志性习惯吗？" },
];

export const WORLD_GUIDE: GuideQuestion[] = [
  { key: "name", question: "这本规则书（世界设定）叫什么名字？" },
  { key: "tone", question: "规则书的题材和基调是什么？（如：修仙、科幻末世、都市异能、西幻史诗）" },
  { key: "rules", question: "规则书的核心规则或超自然法则是什么？（如：灵根体系、基因锁、魔法回路）" },
  { key: "geography", question: "世界的地理环境大致是怎样的？（区域、标志地点、地貌特点）" },
  { key: "factions", question: "世界有哪些主要势力、组织或派系？" },
  { key: "history", question: "世界有什么重要的历史事件或背景故事？" },
  { key: "society", question: "世界的社会结构如何？（权力体系、阶层、生活方式、文明水平）" },
  { key: "conflicts", question: "世界的禁忌、冲突或主线矛盾是什么？" },
];

export function buildGuideQuestions(type: CreateType): GuideQuestion[] {
  return type === "character" ? CHARACTER_GUIDE : WORLD_GUIDE;
}

function buildGuideList(type: CreateType): string {
  return buildGuideQuestions(type)
    .map((q, i) => `${i + 1}. ${q.question}`)
    .join("\n");
}

/**
 * 组装创建模式系统提示词：破限词(开头) → 引导大纲 → 引导规则。
 */
export function buildCreateSystemPrompt(type: CreateType, mode: GuideMode, injections: string[]): string {
  const label = GUIDE_LABEL[type];
  const parts: string[] = [];
  if (injections.length > 0) parts.push(injections.join("\n\n"));

  parts.push(
    `你是一位资深的${label}设定师。用户正在「创建模式」中设计一个${label}设定，你的任务是帮助 ta 把想法打磨成完整、具体、可用的设定，供角色扮演应用使用。`,
  );

  if (mode === "ask") {
    parts.push(
      "【引导方式：逐题提问】\n" +
      "1. 一次只问一个问题，严格按照下面的引导清单顺序提问，绝对不要一次问多个问题；\n" +
      "2. 用户回答后，用一句话简要确认或补充要点，然后立刻问下一题；\n" +
      "3. 用户说跳过时直接进入下一题；\n" +
      "4. 全部问完后，明确告诉用户：设定信息已收集完毕，请点击「生成」按钮完成创建；\n" +
      "5. 全程保持设定师口吻，简洁专业，不要输出与提问无关的内容，不要替用户编造设定。\n" +
      `【引导清单】\n${buildGuideList(type)}`,
    );
  } else {
    parts.push(
      "【引导方式：自由描述】\n" +
      "1. 用户会自行描述想要的设定，请仔细倾听、记住要点；\n" +
      "2. 用户描述过程中不要打断；描述完后可追问 1-2 个关键缺失细节（如外貌/目标/核心规则）；\n" +
      "3. 信息足够后，明确告诉用户：设定信息已收集完毕，请点击「生成」按钮完成创建；\n" +
      "4. 全程保持设定师口吻，简洁专业，不要替用户编造设定。",
    );
  }

  parts.push(
    "【硬性要求】\n" +
    "你是在帮助用户设计设定，不是在写小说。不要使用小说叙述腔调，不要代替用户做决定，不要输出额外设定内容。",
  );

  return parts.join("\n\n");
}

/** 创建模式本地开场白（不消耗 API） */
export function buildLocalOpening(type: CreateType, mode: GuideMode): string {
  const label = GUIDE_LABEL[type];
  if (mode === "ask") {
    const first = buildGuideQuestions(type)[0];
    return `好的，我们开始设计这个${label}。\n\n${first.question}`;
  }
  return `请自由描述你想要的${label}设定，越详细越好。\n\n我会在结束后帮你整理成完整的设定卡（${label === "角色" ? "姓名 / 外貌 / 性格 / 说话风格 / 背景 / 目标 / 关系 / 能力" : "名称 / 基调 / 规则 / 地理 / 势力 / 历史 / 社会 / 冲突"}）。`;
}
