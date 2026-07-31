import { create } from "zustand";

export interface OpeningScenario {
  id: string;
  name: string;
  description: string;
  keywords: string[];
  theme: string; // which world theme this belongs to
  systemPromptTemplate: string; // template with {characterName} placeholder
  openingMessage: string; // 开局开场消息，模板含 {characterName} 占位符
}

const defaultScenarios: OpeningScenario[] = [
  // ============ cultivation 修仙/仙侠（3 个） ============
  {
    id: "zongmen-dabi",
    name: "宗门大比",
    description: "一年一度的宗门比武大会即将开始，各方弟子摩拳擦掌",
    keywords: ["竞技", "热血", "成长"],
    theme: "cultivation",
    systemPromptTemplate: "你正在写一部修仙小说。当前场景：宗门大比——一年一度的宗门比武大会正在进行。{characterName}是参赛弟子之一。请以沉浸式的小说笔法续写故事，描写战斗场面、人物心理和周围观众的反应。每次回复约100-200字。",
    openingMessage: "宗门大比，今日正式开赛。我是{characterName}，作为参赛弟子站在演武台上，台下人声鼎沸，各峰长老端坐高台，目光如炬。请开始吧。",
  },
  {
    id: "mijing-tanxian",
    name: "秘境探险",
    description: "远古秘境突然出现，修仙者们纷纷前往探索其中的机缘与危险",
    keywords: ["探索", "奇遇", "危机"],
    theme: "cultivation",
    systemPromptTemplate: "你正在写一部修仙小说。当前场景：秘境探险——{characterName}进入了一处远古秘境。请描写秘境的环境、遇到的机缘与危险、其他修仙者的互动。以沉浸式小说笔法续写，每次回复约100-200字。",
    openingMessage: "一处远古秘境在青州腹地凭空浮现，灵气冲天。{characterName}收拾行囊，踏上了前往秘境的征途。请开始吧。",
  },
  {
    id: "fangshi-fengbo",
    name: "坊市风波",
    description: "坊市拍卖会上出现了一件神秘宝物，引发各方势力争夺",
    keywords: ["谋略", "交易", "暗流"],
    theme: "cultivation",
    systemPromptTemplate: "你正在写一部修仙小说。当前场景：坊市风波——{characterName}在坊市拍卖会上目睹了一场争夺。请描写各方势力的博弈、宝物的来历、以及主角的抉择。以沉浸式小说笔法续写，每次回复约100-200字。",
    openingMessage: "今日坊市大集，天宝阁拍卖会压轴之物竟是一件来历不明的古宝，各派修士与散修的目光都盯在了台上。{characterName}也混在人群中。请开始吧。",
  },

  // ============ fantasy 东方玄幻（3 个） ============
  {
    id: "fantasy-clanwar",
    name: "万族之战",
    description: "各大种族之间的战争一触即发",
    keywords: ["战争", "种族", "英雄"],
    theme: "fantasy",
    systemPromptTemplate: "你正在写一部东方玄幻小说。当前场景：万族之战——{characterName}身处各大种族的战争漩涡中。请描写战争场面、种族纷争、主角的抉择。每次回复约100-200字。",
    openingMessage: "战鼓擂响，万族大军在荒原上列阵对峙，杀气冲天。{characterName}被卷入这场决定大陆命运的战争。请开始吧。",
  },
  {
    id: "fantasy-shanmai",
    name: "万妖山脉",
    description: "凶名赫赫的万妖山脉异动，传说有远古传承出世",
    keywords: ["探险", "妖兽", "传承"],
    theme: "fantasy",
    systemPromptTemplate: "你正在写一部东方玄幻小说。当前场景：万妖山脉——{characterName}深入凶险的万妖山脉寻找远古传承。请描写山脉的凶险环境、妖物的袭击、以及主角的机缘。以沉浸式小说笔法续写，每次回复约100-200字。",
    openingMessage: "万妖山脉近日妖气暴涨，传闻有远古传承即将出世。{characterName}背起行囊，决定独闯这片凶地。请开始吧。",
  },
  {
    id: "fantasy-juebai",
    name: "天才对决",
    description: "家族大典之上，宿敌当众挑战，战与不战皆是劫",
    keywords: ["对决", "荣誉", "恩怨"],
    theme: "fantasy",
    systemPromptTemplate: "你正在写一部东方玄幻小说。当前场景：家族大典——{characterName}在家族大典上被宿敌当众挑战。请描写对决前的紧张氛围、围观者的议论、主角的内心权衡。以沉浸式小说笔法续写，每次回复约100-200字。",
    openingMessage: "家族大典，祭祖台前，宿敌赵家嫡子竟当众出言挑衅：「{characterName}，可敢一战？」数千族人屏息凝望。请开始吧。",
  },

  // ============ urban 都市异能（3 个） ============
  {
    id: "urban-night",
    name: "午夜觉醒",
    description: "城市的霓虹灯下，异能者们在暗夜中觉醒",
    keywords: ["觉醒", "都市", "暗面"],
    theme: "urban",
    systemPromptTemplate: "你正在写一部都市异能小说。当前场景：{characterName}在午夜的城市中觉醒了异能。请描写觉醒的过程、都市暗面的世界、以及其他异能者的反应。每次回复约100-200字。",
    openingMessage: "深夜的末班地铁驶过隧道，灯光忽明忽暗。{characterName}突然感到一阵心悸——某种力量正从体内苏醒。请开始吧。",
  },
  {
    id: "urban-ditie",
    name: "地铁惊魂",
    description: "末班地铁之上，异能者之间的暗战一触即发",
    keywords: ["暗战", "悬疑", "危机"],
    theme: "urban",
    systemPromptTemplate: "你正在写一部都市异能小说。当前场景：末班地铁——{characterName}在末班地铁上察觉到异能者间的暗战即将爆发。请描写车厢内压抑的氛围、交错的视线、突如其来的冲突。以沉浸式小说笔法续写，每次回复约100-200字。",
    openingMessage: "末班地铁上只有零星乘客。{characterName}敏锐地嗅到了空气中异样的能量波动——车厢里藏着不止一个异能者。请开始吧。",
  },
  {
    id: "urban-zhaomu",
    name: "暗夜招募",
    description: "一封神秘来信，来自国家秘密组织「暗夜」",
    keywords: ["组织", "秘密", "抉择"],
    theme: "urban",
    systemPromptTemplate: "你正在写一部都市异能小说。当前场景：暗夜招募——{characterName}收到了国家秘密异能组织「暗夜」的招募信。请描写组织的神秘背景、试探性的接触、以及主角的犹豫与选择。以沉浸式小说笔法续写，每次回复约100-200字。",
    openingMessage: "清晨，{characterName}在门缝下发现一封黑色信封，信纸上一行烫金字：「暗夜」诚邀你加入。落款处是一枚不知名的徽记。请开始吧。",
  },

  // ============ infinite 无限流（3 个） ============
  {
    id: "infinite-first",
    name: "初入副本",
    description: "系统提示音响起，你被传送到了第一个副本世界",
    keywords: ["副本", "系统", "生存"],
    theme: "infinite",
    systemPromptTemplate: "你正在写一部无限流小说。当前场景：{characterName}被传送到了第一个副本世界。请描写副本规则、任务目标、其他玩家、以及生存挑战。每次回复约100-200字。",
    openingMessage: "「叮——欢迎进入无限空间，新手任务已发布：通关『迷雾小镇』副本。」冰冷的系统提示音在耳边响起，{characterName}眼前白光一闪。请开始吧。",
  },
  {
    id: "infinite-sangshi",
    name: "丧尸围城",
    description: "副本「末日之城」：刚落地就被丧尸潮包围",
    keywords: ["末日", "生存", "团队"],
    theme: "infinite",
    systemPromptTemplate: "你正在写一部无限流小说。当前场景：丧尸围城——{characterName}与队友被传送到末日副本，落地即遭丧尸潮包围。请描写丧尸潮的压迫感、队友的配合、以及主角的求生抉择。以沉浸式小说笔法续写，每次回复约100-200字。",
    openingMessage: "白光散去，{characterName}发现自己站在一座破败城市的废墟中央，四周传来低沉的嘶吼声——丧尸潮正在逼近，而系统提示：「副本『末日之城』开启」。请开始吧。",
  },
  {
    id: "infinite-xuanmen",
    name: "抉择之门",
    description: "主神空间传送门前，三扇门通向三种命运",
    keywords: ["抉择", "冒险", "轮回"],
    theme: "infinite",
    systemPromptTemplate: "你正在写一部无限流小说。当前场景：抉择之门——{characterName}站在主神空间的传送门前，面前有三扇门：武侠、恐怖、科幻。请描写三扇门后的诱惑与危险、以及主角的权衡与选择。以沉浸式小说笔法续写，每次回复约100-200字。",
    openingMessage: "主神空间的广场上，三扇传送门静静矗立：左门剑光凛冽，中门阴风阵阵，右门星光璀璨。系统提示：「轮回者{characterName}，请选择你的下一个世界。」请开始吧。",
  },

  // ============ palace 宫廷古装（3 个） ============
  {
    id: "palace-intrigue",
    name: "后宫暗涌",
    description: "后宫之中看似平静，实则暗流涌动",
    keywords: ["宫斗", "权谋", "人心"],
    theme: "palace",
    systemPromptTemplate: "你正在写一部宫廷古装小说。当前场景：后宫暗涌——{characterName}卷入了一场后宫的权谋博弈。请描写宫廷的勾心斗角、人物关系、以及主角的应对之策。每次回复约100-200字。",
    openingMessage: "宫门深似海。{characterName}踏进这座金碧辉煌的后宫，廊下宫人垂首而立，远处传来隐约的丝竹之声——平静之下暗流涌动。请开始吧。",
  },
  {
    id: "palace-xuannv",
    name: "初入宫闱",
    description: "选秀入宫，从秀女到步步为营",
    keywords: ["选秀", "逆袭", "成长"],
    theme: "palace",
    systemPromptTemplate: "你正在写一部宫廷古装小说。当前场景：初入宫闱——{characterName}在选秀中被选入宫中，从秀女做起。请描写选秀的场面、入宫后的规矩与打量、以及主角的隐忍与筹谋。以沉浸式小说笔法续写，每次回复约100-200字。",
    openingMessage: "三年一度的选秀大典，{characterName}跪在青石板上，听着礼官报出自己的名字——自今日起，她便是这深宫里的秀女了。请开始吧。",
  },
  {
    id: "palace-chaotang",
    name: "朝堂风云",
    description: "文武争执不休，一场大朝会暗藏杀机",
    keywords: ["权谋", "博弈", "智斗"],
    theme: "palace",
    systemPromptTemplate: "你正在写一部宫廷古装小说。当前场景：朝堂风云——大朝会上，文臣武将争执不休，{characterName}身处其中。请描写朝堂的唇枪舌剑、各方派系的立场、以及主角的破局之策。以沉浸式小说笔法续写，每次回复约100-200字。",
    openingMessage: "金銮殿上，龙涎香袅袅。主战派与主和派争执不休，御座上的天子迟迟未发一言。{characterName}侍立阶下，心知今日这场大朝会暗藏杀机。请开始吧。",
  },

  // ============ scifi 科幻星际（3 个） ============
  {
    id: "scifi-firstjump",
    name: "首次跃迁",
    description: "星际飞船即将进行首次超光速跃迁",
    keywords: ["探索", "科技", "未知"],
    theme: "scifi",
    systemPromptTemplate: "你正在写一部科幻星际小说。当前场景：{characterName}所在的飞船即将进行首次超光速跃迁。请描写跃迁的体验、未知的星系、船员的反应。每次回复约100-200字。",
    openingMessage: "「跃迁倒计时：十、九、八……」舰桥上的机械女声平稳地报数。{characterName}握紧座椅扶手，人类史上第一次超光速跃迁即将开始。请开始吧。",
  },
  {
    id: "scifi-mihang",
    name: "异星迷航",
    description: "跃迁失误，飞船坠落在未知星球，求生之路开启",
    keywords: ["生存", "探索", "未知"],
    theme: "scifi",
    systemPromptTemplate: "你正在写一部科幻星际小说。当前场景：异星迷航——跃迁出现偏差，{characterName}所在的飞船坠落在未知星球。请描写异星的诡异环境、坠落后的混乱、以及主角带领船员求生的抉择。以沉浸式小说笔法续写，每次回复约100-200字。",
    openingMessage: "刺耳的警报声撕裂了舰桥。跃迁出了偏差——「星澜号」正朝着下方那颗苍绿色的未知星球坠落。{characterName}扯着安全带，目光死死盯着越来越近的地表。请开始吧。",
  },
  {
    id: "scifi-xinggang",
    name: "星港疑云",
    description: "边陲星港，一场针对舰队的阴谋正在发酵",
    keywords: ["悬疑", "星际", "阴谋"],
    theme: "scifi",
    systemPromptTemplate: "你正在写一部科幻星际小说。当前场景：星港疑云——{characterName}抵达边陲星港，发现整个星港弥漫着阴谋的气息。请描写星港的光怪陆离、可疑的人物与线索、以及主角的调查。以沉浸式小说笔法续写，每次回复约100-200字。",
    openingMessage: "星港「界碑」是全星域最混乱的边陲口岸。{characterName}刚走下舷梯，便注意到码头上几道鬼祟的目光——有人正盯上这艘船。请开始吧。",
  },
];

interface OnboardingState {
  scenarios: OpeningScenario[];
  getScenariosByTheme: (theme: string) => OpeningScenario[];
  getScenarioById: (id: string) => OpeningScenario | undefined;
  buildSystemPrompt: (scenarioId: string, characterName: string, mode: string) => string;
  buildOpeningMessage: (scenarioId: string, characterName: string) => string;
}

export const useOnboardingStore = create<OnboardingState>((set, get) => ({
  scenarios: defaultScenarios,

  getScenariosByTheme: (theme: string) => {
    return get().scenarios.filter((s) => s.theme === theme);
  },

  getScenarioById: (id: string) => {
    return get().scenarios.find((s) => s.id === id);
  },

  buildSystemPrompt: (scenarioId: string, characterName: string, mode: string) => {
    const scenario = get().scenarios.find((s) => s.id === scenarioId);
    if (!scenario) return "";

    let prompt = scenario.systemPromptTemplate.replace("{characterName}", characterName);

    // Add mode-specific instructions
    if (mode === "novel") {
      prompt += "\n\n【叙事规则】使用第三人称叙事，用「他/她」来描述角色。像写小说一样描写场景、动作、对话和心理活动。";
    } else if (mode === "player") {
      prompt += "\n\n【叙事规则】用户以第一人称「我」的视角参与故事。你用第二人称「你」来描述用户的角色，用其他角色的名字来描述NPC。描写环境和其他角色的行为，让用户做出选择和行动。";
    }

    return prompt;
  },

  buildOpeningMessage: (scenarioId: string, characterName: string) => {
    const scenario = get().scenarios.find((s) => s.id === scenarioId);
    if (!scenario) return "";
    return scenario.openingMessage.replace("{characterName}", characterName);
  },
}));
