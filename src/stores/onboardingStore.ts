import { create } from "zustand";
import type { WorldAudience } from "@/lib/worldAudience";
import { buildHotTropeHint } from "@/lib/popularTropes";

export interface OpeningScenario {
  id: string;
  name: string;
  description: string;
  keywords: string[];
  theme: string; // which world theme this belongs to
  /** 开局所属频道（男频/女频向开局标记；缺省 = 中性/按当前频道语境） */
  audience?: WorldAudience;
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
    systemPromptTemplate: "你正在写一部修仙小说。当前场景：宗门大比——一年一度的宗门比武大会正在进行。{characterName}是参赛弟子之一。请以沉浸式的小说笔法续写故事，描写战斗场面、人物心理和周围观众的反应。",
    openingMessage: "宗门大比，今日正式开赛。我是{characterName}，作为参赛弟子站在演武台上，台下人声鼎沸，各峰长老端坐高台，目光如炬。请开始吧。",
  },
  {
    id: "mijing-tanxian",
    name: "秘境探险",
    description: "远古秘境突然出现，修仙者们纷纷前往探索其中的机缘与危险",
    keywords: ["探索", "奇遇", "危机"],
    theme: "cultivation",
    systemPromptTemplate: "你正在写一部修仙小说。当前场景：秘境探险——{characterName}进入了一处远古秘境。请描写秘境的环境、遇到的机缘与危险、其他修仙者的互动。以沉浸式小说笔法续写。",
    openingMessage: "一处远古秘境在青州腹地凭空浮现，灵气冲天。{characterName}收拾行囊，踏上了前往秘境的征途。请开始吧。",
  },
  {
    id: "fangshi-fengbo",
    name: "坊市风波",
    description: "坊市拍卖会上出现了一件神秘宝物，引发各方势力争夺",
    keywords: ["谋略", "交易", "暗流"],
    theme: "cultivation",
    systemPromptTemplate: "你正在写一部修仙小说。当前场景：坊市风波——{characterName}在坊市拍卖会上目睹了一场争夺。请描写各方势力的博弈、宝物的来历、以及主角的抉择。以沉浸式小说笔法续写。",
    openingMessage: "今日坊市大集，天宝阁拍卖会压轴之物竟是一件来历不明的古宝，各派修士与散修的目光都盯在了台上。{characterName}也混在人群中。请开始吧。",
  },

  // ============ fantasy 东方玄幻（3 个） ============
  {
    id: "fantasy-clanwar",
    name: "万族之战",
    description: "各大种族之间的战争一触即发",
    keywords: ["战争", "种族", "英雄"],
    theme: "fantasy",
    systemPromptTemplate: "你正在写一部东方玄幻小说。当前场景：万族之战——{characterName}身处各大种族的战争漩涡中。请描写战争场面、种族纷争、主角的抉择。",
    openingMessage: "战鼓擂响，万族大军在荒原上列阵对峙，杀气冲天。{characterName}被卷入这场决定大陆命运的战争。请开始吧。",
  },
  {
    id: "fantasy-shanmai",
    name: "万妖山脉",
    description: "凶名赫赫的万妖山脉异动，传说有远古传承出世",
    keywords: ["探险", "妖兽", "传承"],
    theme: "fantasy",
    systemPromptTemplate: "你正在写一部东方玄幻小说。当前场景：万妖山脉——{characterName}深入凶险的万妖山脉寻找远古传承。请描写山脉的凶险环境、妖物的袭击、以及主角的机缘。以沉浸式小说笔法续写。",
    openingMessage: "万妖山脉近日妖气暴涨，传闻有远古传承即将出世。{characterName}背起行囊，决定独闯这片凶地。请开始吧。",
  },
  {
    id: "fantasy-juebai",
    name: "天才对决",
    description: "家族大典之上，宿敌当众挑战，战与不战皆是劫",
    keywords: ["对决", "荣誉", "恩怨"],
    theme: "fantasy",
    systemPromptTemplate: "你正在写一部东方玄幻小说。当前场景：家族大典——{characterName}在家族大典上被宿敌当众挑战。请描写对决前的紧张氛围、围观者的议论、主角的内心权衡。以沉浸式小说笔法续写。",
    openingMessage: "家族大典，祭祖台前，宿敌赵家嫡子竟当众出言挑衅：「{characterName}，可敢一战？」数千族人屏息凝望。请开始吧。",
  },

  // ============ urban 都市异能（3 个） ============
  {
    id: "urban-night",
    name: "午夜觉醒",
    description: "城市的霓虹灯下，异能者们在暗夜中觉醒",
    keywords: ["觉醒", "都市", "暗面"],
    theme: "urban",
    systemPromptTemplate: "你正在写一部都市异能小说。当前场景：{characterName}在午夜的城市中觉醒了异能。请描写觉醒的过程、都市暗面的世界、以及其他异能者的反应。",
    openingMessage: "深夜的末班地铁驶过隧道，灯光忽明忽暗。{characterName}突然感到一阵心悸——某种力量正从体内苏醒。请开始吧。",
  },
  {
    id: "urban-ditie",
    name: "地铁惊魂",
    description: "末班地铁之上，异能者之间的暗战一触即发",
    keywords: ["暗战", "悬疑", "危机"],
    theme: "urban",
    systemPromptTemplate: "你正在写一部都市异能小说。当前场景：末班地铁——{characterName}在末班地铁上察觉到异能者间的暗战即将爆发。请描写车厢内压抑的氛围、交错的视线、突如其来的冲突。以沉浸式小说笔法续写。",
    openingMessage: "末班地铁上只有零星乘客。{characterName}敏锐地嗅到了空气中异样的能量波动——车厢里藏着不止一个异能者。请开始吧。",
  },
  {
    id: "urban-zhaomu",
    name: "暗夜招募",
    description: "一封神秘来信，来自国家秘密组织「暗夜」",
    keywords: ["组织", "秘密", "抉择"],
    theme: "urban",
    systemPromptTemplate: "你正在写一部都市异能小说。当前场景：暗夜招募——{characterName}收到了国家秘密异能组织「暗夜」的招募信。请描写组织的神秘背景、试探性的接触、以及主角的犹豫与选择。以沉浸式小说笔法续写。",
    openingMessage: "清晨，{characterName}在门缝下发现一封黑色信封，信纸上一行烫金字：「暗夜」诚邀你加入。落款处是一枚不知名的徽记。请开始吧。",
  },

  // ============ infinite 无限流（3 个） ============
  {
    id: "infinite-first",
    name: "初入副本",
    description: "系统提示音响起，你被传送到了第一个副本世界",
    keywords: ["副本", "系统", "生存"],
    theme: "infinite",
    systemPromptTemplate: "你正在写一部无限流小说。当前场景：{characterName}被传送到了第一个副本世界。请描写副本规则、任务目标、其他玩家、以及生存挑战。",
    openingMessage: "「叮——欢迎进入无限空间，新手任务已发布：通关『迷雾小镇』副本。」冰冷的系统提示音在耳边响起，{characterName}眼前白光一闪。请开始吧。",
  },
  {
    id: "infinite-sangshi",
    name: "丧尸围城",
    description: "副本「末日之城」：刚落地就被丧尸潮包围",
    keywords: ["末日", "生存", "团队"],
    theme: "infinite",
    systemPromptTemplate: "你正在写一部无限流小说。当前场景：丧尸围城——{characterName}与队友被传送到末日副本，落地即遭丧尸潮包围。请描写丧尸潮的压迫感、队友的配合、以及主角的求生抉择。以沉浸式小说笔法续写。",
    openingMessage: "白光散去，{characterName}发现自己站在一座破败城市的废墟中央，四周传来低沉的嘶吼声——丧尸潮正在逼近，而系统提示：「副本『末日之城』开启」。请开始吧。",
  },
  {
    id: "infinite-xuanmen",
    name: "抉择之门",
    description: "主神空间传送门前，三扇门通向三种命运",
    keywords: ["抉择", "冒险", "轮回"],
    theme: "infinite",
    systemPromptTemplate: "你正在写一部无限流小说。当前场景：抉择之门——{characterName}站在主神空间的传送门前，面前有三扇门：武侠、恐怖、科幻。请描写三扇门后的诱惑与危险、以及主角的权衡与选择。以沉浸式小说笔法续写。",
    openingMessage: "主神空间的广场上，三扇传送门静静矗立：左门剑光凛冽，中门阴风阵阵，右门星光璀璨。系统提示：「轮回者{characterName}，请选择你的下一个世界。」请开始吧。",
  },

  // ============ apocalypse 末世求生（3 个） ============
  {
    id: "apocalypse-firstnight",
    name: "末夜降临",
    description: "灾变刚刚发生，城市正在失去秩序",
    keywords: ["末世", "生存", "危机"],
    theme: "apocalypse",
    systemPromptTemplate: "你正在写一部末世求生小说。当前场景：{characterName}所在的城市在夜里突然陷入灾变。请描写停电、混乱、第一批逃生者和主角的生存抉择。以沉浸式小说笔法续写。",
    openingMessage: "停电后，整座城市像被谁一把掐灭。{characterName}站在窗边，听见远处传来爆炸声和尖叫声，手机只剩最后一格信号。请开始吧。",
  },
  {
    id: "apocalypse-shelter",
    name: "避难所抉择",
    description: "资源有限，跟谁走、去哪躲，是第一道生死题",
    keywords: ["避难所", "选择", "团队"],
    theme: "apocalypse",
    systemPromptTemplate: "你正在写一部末世求生小说。当前场景：{characterName}面前有两个避难所，一个安全但封闭，一个危险却有更多资源。请写出环境压力、同伴意见和主角的权衡。以沉浸式小说笔法续写。",
    openingMessage: "{characterName}手里攥着两张地图，一张通向地下避难所，一张指向城外的物资点。天色彻底黑下去之前，必须做出决定。请开始吧。",
  },
  {
    id: "apocalypse-outpost",
    name: "废城据点",
    description: "建立据点，收拢幸存者，准备下一轮危机",
    keywords: ["据点", "幸存者", "建设"],
    theme: "apocalypse",
    systemPromptTemplate: "你正在写一部末世求生小说。当前场景：{characterName}刚在废城里找到一处勉强可用的据点。请描写据点条件、幸存者状态、物资短缺与下一步扩张计划。以沉浸式小说笔法续写。",
    openingMessage: "废弃商场里只亮着一盏应急灯。{characterName}把门栓插死，转身看见墙边蜷着的幸存者和只剩一半的物资箱。请开始吧。",
  },

  // ============ palace 宫廷古装（3 个） ============
  {
    id: "palace-intrigue",
    name: "后宫暗涌",
    description: "后宫之中看似平静，实则暗流涌动",
    keywords: ["宫斗", "权谋", "人心"],
    theme: "palace",
    systemPromptTemplate: "你正在写一部宫廷古装小说。当前场景：后宫暗涌——{characterName}卷入了一场后宫的权谋博弈。请描写宫廷的勾心斗角、人物关系、以及主角的应对之策。",
    openingMessage: "宫门深似海。{characterName}踏进这座金碧辉煌的后宫，廊下宫人垂首而立，远处传来隐约的丝竹之声——平静之下暗流涌动。请开始吧。",
  },
  {
    id: "palace-xuannv",
    name: "初入宫闱",
    description: "选秀入宫，从秀女到步步为营",
    keywords: ["选秀", "逆袭", "成长"],
    theme: "palace",
    systemPromptTemplate: "你正在写一部宫廷古装小说。当前场景：初入宫闱——{characterName}在选秀中被选入宫中，从秀女做起。请描写选秀的场面、入宫后的规矩与打量、以及主角的隐忍与筹谋。以沉浸式小说笔法续写。",
    openingMessage: "三年一度的选秀大典，{characterName}跪在青石板上，听着礼官报出自己的名字——自今日起，她便是这深宫里的秀女了。请开始吧。",
  },
  {
    id: "palace-chaotang",
    name: "朝堂风云",
    description: "文武争执不休，一场大朝会暗藏杀机",
    keywords: ["权谋", "博弈", "智斗"],
    theme: "palace",
    systemPromptTemplate: "你正在写一部宫廷古装小说。当前场景：朝堂风云——大朝会上，文臣武将争执不休，{characterName}身处其中。请描写朝堂的唇枪舌剑、各方派系的立场、以及主角的破局之策。以沉浸式小说笔法续写。",
    openingMessage: "金銮殿上，龙涎香袅袅。主战派与主和派争执不休，御座上的天子迟迟未发一言。{characterName}侍立阶下，心知今日这场大朝会暗藏杀机。请开始吧。",
  },

  // ============ scifi 科幻星际（3 个） ============
  {
    id: "scifi-firstjump",
    name: "首次跃迁",
    description: "星际飞船即将进行首次超光速跃迁",
    keywords: ["探索", "科技", "未知"],
    theme: "scifi",
    systemPromptTemplate: "你正在写一部科幻星际小说。当前场景：{characterName}所在的飞船即将进行首次超光速跃迁。请描写跃迁的体验、未知的星系、船员的反应。",
    openingMessage: "「跃迁倒计时：十、九、八……」舰桥上的机械女声平稳地报数。{characterName}握紧座椅扶手，人类史上第一次超光速跃迁即将开始。请开始吧。",
  },
  {
    id: "scifi-mihang",
    name: "异星迷航",
    description: "跃迁失误，飞船坠落在未知星球，求生之路开启",
    keywords: ["生存", "探索", "未知"],
    theme: "scifi",
    systemPromptTemplate: "你正在写一部科幻星际小说。当前场景：异星迷航——跃迁出现偏差，{characterName}所在的飞船坠落在未知星球。请描写异星的诡异环境、坠落后的混乱、以及主角带领船员求生的抉择。以沉浸式小说笔法续写。",
    openingMessage: "刺耳的警报声撕裂了舰桥。跃迁出了偏差——「星澜号」正朝着下方那颗苍绿色的未知星球坠落。{characterName}扯着安全带，目光死死盯着越来越近的地表。请开始吧。",
  },
  {
    id: "scifi-xinggang",
    name: "星港疑云",
    description: "边陲星港，一场针对舰队的阴谋正在发酵",
    keywords: ["悬疑", "星际", "阴谋"],
    theme: "scifi",
    systemPromptTemplate: "你正在写一部科幻星际小说。当前场景：星港疑云——{characterName}抵达边陲星港，发现整个星港弥漫着阴谋的气息。请描写星港的光怪陆离、可疑的人物与线索、以及主角的调查。以沉浸式小说笔法续写。",
    openingMessage: "星港「界碑」是全星域最混乱的边陲口岸。{characterName}刚走下舷梯，便注意到码头上几道鬼祟的目光——有人正盯上这艘船。请开始吧。",
  },

  // ============ folklore 民俗悬疑（3 个） ============
  {
    id: "folklore-laoshi",
    name: "继承衣钵",
    description: "师父走了，留下一门祖传的捞尸手艺",
    keywords: ["传承", "诡异", "民俗"],
    theme: "folklore",
    systemPromptTemplate: "你正在写一部民俗悬疑小说。当前场景：继承衣钵——{characterName}继承了师父的捞尸人身份，接到了出师后的第一单生意。请描写江边的氛围、行当的规矩、水下的诡异，以及主角的忐忑。以沉浸式小说笔法续写。",
    openingMessage: "师父咽气前留下三样东西：一本发黄的账册、一根红绳、一句话——「下水前，先给河神烧纸。」{characterName}站在渡口，望着雾气弥漫的江面，第一单生意已等在岸上。请开始吧。",
  },
  {
    id: "folklore-shancun",
    name: "山村怪谈",
    description: "进山办事，村中处处透着不对劲",
    keywords: ["山村", "禁忌", "怪谈"],
    theme: "folklore",
    systemPromptTemplate: "你正在写一部民俗悬疑小说。当前场景：山村怪谈——{characterName}因事进入一处山村，发现村民言行怪异、忌讳重重。请描写村落的氛围、村民的怪异反应、以及主角察觉到的异常。以沉浸式小说笔法续写。",
    openingMessage: "车在山路上抛了锚，{characterName}不得不借宿村中。进村时，一个老妇人拦住他：「后生，今晚子时过后，听见敲门声千万别应。」夜里，敲门声准时响起。请开始吧。",
  },
  {
    id: "folklore-yinyang",
    name: "阴阳先生",
    description: "镇上的先生接了桩「麻烦」的活儿",
    keywords: ["灵异", "先生", "做法"],
    theme: "folklore",
    systemPromptTemplate: "你正在写一部民俗悬疑小说。当前场景：阴阳先生——{characterName}跟着阴阳先生接了桩闹鬼的活儿。请描写先生的开坛准备、宅院的诡异之处、以及法事过程中的变故。以沉浸式小说笔法续写。",
    openingMessage: "镇东头王家请了阴阳先生镇宅，{characterName}被叫去帮忙打下手。先生进门先不进屋，绕宅走了三圈，脸色越来越沉：「这宅子，是有人故意布的局。」请开始吧。",
  },

  // ============ rulehorror 规则怪谈（3 个） ============
  {
    id: "rulehorror-apt",
    name: "诡异公寓",
    description: "搬进新公寓，墙上贴着一份奇怪的通知",
    keywords: ["规则", "公寓", "生存"],
    theme: "rulehorror",
    systemPromptTemplate: "你正在写一部规则怪谈小说。当前场景：诡异公寓——{characterName}搬进一栋公寓，门内贴着一份写着奇怪规则的通知。请描写公寓的异常氛围、规则的内容、以及主角的试探。以沉浸式小说笔法续写。",
    openingMessage: "公寓的钥匙是房东留下的，租金便宜得不像话。门后贴着一张泛黄的通知：「住户须知：1. 晚上十点后请勿开灯。2. 若听到敲门声，先数到十再开。3. 不要和穿红鞋的邻居说话。」{characterName}盯着第三条，走廊里传来脚步声。请开始吧。",
  },
  {
    id: "rulehorror-bus",
    name: "午夜公交",
    description: "末班车上的乘客，似乎都不太对劲",
    keywords: ["公交", "规则", "悬疑"],
    theme: "rulehorror",
    systemPromptTemplate: "你正在写一部规则怪谈小说。当前场景：午夜公交——{characterName}上了末班公交，车厢里弥漫着诡异的气息。请描写车厢内的细节、反常的乘客、以及潜藏的规则。以沉浸式小说笔法续写。",
    openingMessage: "加班到深夜，{characterName}赶上了末班公交。司机戴着白手套一言不发，车厢里零星坐着几个乘客——每个人都保持着奇怪的姿势。挡风玻璃上方贴着一行小字：「请勿在行驶中与司机交谈。」请开始吧。",
  },
  {
    id: "rulehorror-wakeup",
    name: "一纸规则",
    description: "醒来时手边压着一张纸，纸上写着活下去的规则",
    keywords: ["规则", "苏醒", "未知"],
    theme: "rulehorror",
    systemPromptTemplate: "你正在写一部规则怪谈小说。当前场景：一纸规则——{characterName}在陌生房间醒来，手边压着一张写满规则的纸。请描写房间的诡异环境、规则的细思极恐之处、以及主角的应对。以沉浸式小说笔法续写。",
    openingMessage: "{characterName}在一间陌生的房间里醒来，窗外漆黑一片，时钟停在三点。床头柜上压着一张纸条：「你所在的地方，规则如下：① 房间的门只能从外面打开；② 墙上的钟永远停在三点；③ 如果听到有人叫你的名字——那不是人。」请开始吧。",
  },

  // ============ zhaidou 古言宅斗（3 个） ============
  {
    id: "zhaidou-rufu",
    name: "初入府邸",
    description: "新妇进门第一天，内宅的水远比想象中深",
    keywords: ["宅斗", "新妇", "世家"],
    theme: "zhaidou",
    systemPromptTemplate: "你正在写一部古言宅斗小说。当前场景：初入府邸——{characterName}作为新妇（或新入府的姑娘）踏进世家大门。请描写府邸的气派、各房妯娌婆媳的初次交锋、以及内宅规矩的压迫感。以沉浸式小说笔法续写。",
    openingMessage: "花轿落定，红绸满地。{characterName}盖着红盖头，听见院子里有人小声议论：「听说这位新妇出身不高，也不知怎么攀上了这门亲。」隔着喜帕，一只绣着缠枝莲的绣鞋停在她面前——那是当家主母的鞋。请开始吧。",
  },
  {
    id: "zhaidou-zimei",
    name: "姐妹相争",
    description: "嫡姐庶妹，一墙之隔，两般境遇",
    keywords: ["宅斗", "嫡庶", "心机"],
    theme: "zhaidou",
    systemPromptTemplate: "你正在写一部古言宅斗小说。当前场景：姐妹相争——{characterName}是府中庶女（或嫡女），与姐妹之间的较量从晨起请安就开始了。请描写请安时的暗流、嫡庶之间的明枪暗箭、以及主角的应对。以沉浸式小说笔法续写。",
    openingMessage: "晨光熹微，{characterName}已梳洗停当，往正院去请安。半路被庶妹拦住，笑盈盈地递来一盏茶：「姐姐起得真早，莫不是又去求母亲赏赐？」茶盏里漂着几片浮沫，端茶的手却稳得很。请开始吧。",
  },
  {
    id: "zhaidou-zhongkui",
    name: "接管中馈",
    description: "主母病倒，掌家之权第一次落到你手里",
    keywords: ["中馈", "掌家", "博弈"],
    theme: "zhaidou",
    systemPromptTemplate: "你正在写一部古言宅斗小说。当前场景：接管中馈——主母病倒，{characterName}受命暂掌中馈。请描写账房盘账的刀光剑影、各房伸手要钱的人情、以及主角立威的抉择。以沉浸式小说笔法续写。",
    openingMessage: "主母咳疾加重，将一串铜钥匙交到{characterName}手里：「这几日，中馈你先管着。」钥匙入手冰凉，账房的先生却先递来一本「账本」——翻开来，第一页就有三处明显的亏空。请开始吧。",
  },

  // ============ retro 重生年代（3 个） ============
  {
    id: "retro-chongsheng",
    name: "重回一九八二",
    description: "一觉醒来，回到命运转折的那一年",
    keywords: ["重生", "年代", "改变"],
    theme: "retro",
    systemPromptTemplate: "你正在写一部重生年代小说。当前场景：重回一九八二——{characterName}带着前世记忆回到了决定命运的那一年。请描写家中的老物件、亲人的年轻面容、以及主角决定改变的瞬间。以沉浸式小说笔法续写。",
    openingMessage: "{characterName}是被缝纫机的嗒嗒声吵醒的。眼前是熟悉的土墙、糊着报纸的窗户、柜子上那台落灰的收音机——这是 1982 年，一切都还来得及。院子里，母亲的年轻声音传来：「起来吃饭了，今天还得去挣工分。」请开始吧。",
  },
  {
    id: "retro-xiangxia",
    name: "下乡插队",
    description: "绿皮火车载着一批知青驶向远方",
    keywords: ["知青", "下乡", "年代"],
    theme: "retro",
    systemPromptTemplate: "你正在写一部重生年代小说。当前场景：下乡插队——{characterName}作为知青来到生产队。请描写火车上的离愁、村庄的落后与朴实、以及主角融入集体的过程。以沉浸式小说笔法续写。",
    openingMessage: "绿皮火车哐当哐当驶过麦田，车窗外的风景从城市变成村庄。{characterName}抱着行李卷，听着同车知青议论即将到达的公社。广播里传来站长浑厚的声音：「下一站，柳河公社。」请开始吧。",
  },
  {
    id: "retro-baitan",
    name: "第一桶金",
    description: "政策放开，敢想敢干的人开始崭露头角",
    keywords: ["创业", "年代", "机遇"],
    theme: "retro",
    systemPromptTemplate: "你正在写一部重生年代小说。当前场景：第一桶金——{characterName}看准了时代机遇，准备大干一场。请描写街市的烟火气、摆摊/倒货的忐忑与兴奋、以及周围人的目光。以沉浸式小说笔法续写。",
    openingMessage: "天不亮，{characterName}就推着借来的板车出了门。政策放开了，集市上卖什么的都有，最抢手的是从南边倒来的的确良布。攥着口袋里仅剩的二十块钱，{characterName}在布摊前站定：「老板，这批布，怎么走？」请开始吧。",
  },

  // ============ romance 现代言情（3 个） ============
  {
    id: "romance-chongfeng",
    name: "破镜重圆",
    description: "多年后重逢，物是人非，心却还在原地",
    keywords: ["言情", "重逢", "都市"],
    theme: "romance",
    systemPromptTemplate: "你正在写一部现代言情小说。当前场景：破镜重圆——{characterName}与多年前分开的人重逢。请描写重逢的场景、复杂的情绪、以及旧日记忆的浮现。以沉浸式小说笔法续写。",
    openingMessage: "雨夜的咖啡馆，{characterName}推开玻璃门，风铃响动。靠窗的位置坐着一个人——五年前说「再也不见」的那个人，此刻正抬眼望过来，目光撞了个满怀。请开始吧。",
  },
  {
    id: "romance-qiyue",
    name: "契约婚姻",
    description: "一纸协议，各取所需的婚姻",
    keywords: ["言情", "契约", "都市"],
    theme: "romance",
    systemPromptTemplate: "你正在写一部现代言情小说。当前场景：契约婚姻——{characterName}与对方因利益结成了契约婚姻。请描写领证当天的疏离感、协议条款的冰冷、以及相处中的暗流涌动。以沉浸式小说笔法续写。",
    openingMessage: "民政局门口，{characterName}和「丈夫」各自攥着户口本，中间隔着半米距离。工作人员问：「二位是自愿的吗？」两人同时点头，又同时别开眼。协议第三条写着：互不干涉，一年后离婚。请开始吧。",
  },
  {
    id: "romance-zhichang",
    name: "职场重逢",
    description: "新上司居然是当年不告而别的前任",
    keywords: ["言情", "职场", "恩怨"],
    theme: "romance",
    systemPromptTemplate: "你正在写一部现代言情小说。当前场景：职场重逢——{characterName}入职新公司，发现顶头上司竟是当年不告而别的前任。请描写办公室里的尴尬氛围、对方的反应、以及主角的内心戏。以沉浸式小说笔法续写。",
    openingMessage: "入职第一天，{characterName}抱着一摞文件走进办公室，对上首那道熟悉的目光。那人西装笔挺坐在「总监」的铭牌后，语气公事公办：「新同事？先做自我介绍吧。」会议室里安静得能听见心跳。请开始吧。",
  },

  // ============ entertainment 娱乐圈（3 个） ============
  {
    id: "ent-zhupaichang",
    name: "初入片场",
    description: "跑龙套的第一场戏，就要演好",
    keywords: ["娱乐圈", "龙套", "片场"],
    theme: "entertainment",
    systemPromptTemplate: "你正在写一部娱乐圈小说。当前场景：初入片场——{characterName}作为新人第一次进剧组。请描写片场的忙碌、老演员的气场、新人被呼来喝去的处境，以及主角暗下的决心。以沉浸式小说笔法续写。",
    openingMessage: "凌晨四点，{characterName}裹着军大衣蹲在片场角落，手里攥着只有一句台词的剧本。副导演的喇叭喊过来：「那个新来的！道具组缺个人，去搬！」灯光下，影帝正被一群工作人员簇拥着补妆。请开始吧。",
  },
  {
    id: "ent-xuanxiu",
    name: "选秀出道",
    description: "站上舞台的那一刻，世界为你安静",
    keywords: ["选秀", "舞台", "出道"],
    theme: "entertainment",
    systemPromptTemplate: "你正在写一部娱乐圈小说。当前场景：选秀出道——{characterName}站上了选秀舞台。请描写后台的紧张、同台选手的明争暗斗、聚光灯下的瞬间，以及评审的目光。以沉浸式小说笔法续写。",
    openingMessage: "候场区里，{characterName}听见自己的名字从喇叭里传来。上一个选手哭着走下台，经纪人还在背后骂「废物」。深吸一口气，{characterName}推开门，追光打在身上，台下三百双眼睛齐刷刷看过来。请开始吧。",
  },
  {
    id: "ent-feiwen",
    name: "绯闻危机",
    description: "一张偷拍照，把两个人推上风口浪尖",
    keywords: ["绯闻", "危机", "公关"],
    theme: "entertainment",
    systemPromptTemplate: "你正在写一部娱乐圈小说。当前场景：绯闻危机——{characterName}被拍到与当红艺人同框，舆论炸了锅。请描写经纪人暴跳如雷、热搜的疯狂、公司的公关策略，以及主角的选择。以沉浸式小说笔法续写。",
    openingMessage: "手机在凌晨三点疯狂震动。{characterName}迷迷糊糊点开经纪人连发的三十条消息，最后一条是截图——热搜第一：「某某某夜会神秘对象」，配图正是昨晚咖啡店同框的照片。此刻，经纪人的电话又打了进来。请开始吧。",
  },
];

interface OnboardingState {
  scenarios: OpeningScenario[];
  getScenariosByTheme: (theme: string) => OpeningScenario[];
  getScenarioById: (id: string) => OpeningScenario | undefined;
  resolveTheme: (theme: string) => string;
  buildModePrompt: (mode: string) => string;
  buildSystemPrompt: (scenarioId: string, characterName: string, mode: string) => string;
  buildOpeningMessage: (scenarioId: string, characterName: string) => string;
  buildAIOpeningMessage: (worldName: string, characterName: string, mode: string, audience?: WorldAudience | null, tropeId?: string | null, worldviewId?: string | null) => string;
}

export const useOnboardingStore = create<OnboardingState>((set, get) => ({
  scenarios: defaultScenarios,

  getScenariosByTheme: (theme: string) => {
    return get().scenarios.filter((s) => s.theme === theme);
  },

  getScenarioById: (id: string) => {
    return get().scenarios.find((s) => s.id === id);
  },

  // 规则书的中文主题（如「修仙/仙侠」）→ 预设场景的英文主题（cultivation），
  // 无映射时原样返回（如「现代都市·娱乐圈」等无预设场景的世界）
  resolveTheme: (theme: string) => {
    const alias: Record<string, string> = {
      "修仙/仙侠": "cultivation",
      仙侠: "cultivation",
      无限流: "infinite",
      "末日求生": "apocalypse",
      "末世求生": "apocalypse",
      apocalypse: "apocalypse",
      "古代·宫廷": "palace",
      宫廷: "palace",
      民俗悬疑: "folklore",
      "规则怪谈": "rulehorror",
      "古言宅斗": "zhaidou",
      "重生年代": "retro",
      "现代言情": "romance",
      "现代都市·甜宠": "romance",
      "现代都市·娱乐圈": "entertainment",
      娱乐圈: "entertainment",
    };
    return alias[theme] || theme;
  },

  buildModePrompt: (mode: string) => {
    if (mode === "novel") {
      return "【叙事规则】使用第三人称叙事，用「他/她」来描述角色。像写小说一样描写场景、动作、对话和心理活动。";
    }
    if (mode === "player") {
      return "【叙事规则】用户以第一人称「我」的视角参与故事。你用第二人称「你」来描述用户的角色，用其他角色的名字来描述NPC。描写环境和其他角色的行为，让用户做出选择和行动。";
    }
    return "";
  },

  buildSystemPrompt: (scenarioId: string, characterName: string, mode: string) => {
    const scenario = get().scenarios.find((s) => s.id === scenarioId);
    if (!scenario) return "";

    let prompt = scenario.systemPromptTemplate.replace("{characterName}", characterName);

    // Add mode-specific instructions
    const modePrompt = get().buildModePrompt(mode);
    if (modePrompt) {
      prompt += "\n\n" + modePrompt;
    }

    return prompt;
  },

  buildOpeningMessage: (scenarioId: string, characterName: string) => {
    const scenario = get().scenarios.find((s) => s.id === scenarioId);
    if (!scenario) return "";
    return scenario.openingMessage.replace("{characterName}", characterName);
  },

  // AI 随机开局：不选预设场景，由 AI 根据世界与角色即兴创作并立刻开篇
  buildAIOpeningMessage: (worldName: string, characterName: string, mode: string, audience: WorldAudience | null = null, tropeId: string | null = null, worldviewId: string | null = null) => {
    const perspective =
      mode === "novel" ? "第三人称旁观者" : mode === "player" ? "第二人称「你」" : "沉浸式小说";
    const tropeHint = buildHotTropeHint({ audience, worldName, tropeId, worldviewId });
    return (
      tropeHint + "\n" +
      "【AI 随机开局】请为【" + worldName + "】世界中的角色「" + characterName +
      "」随机设计一个开局，并立即开始故事：\n" +
      "1. 不要提问，不要列举选项，直接以" + perspective + "视角开篇；\n" +
      "2. 具体交代情境：时间、地点、氛围，一开篇就发生一件有张力的小事件；\n" +
      "3. 将「" + characterName + "」自然地带入这个事件；\n" +
      "4. 结尾留下一处可以继续行动或选择的空间。"
    );
  },
}));
