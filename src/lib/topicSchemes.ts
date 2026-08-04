import type { HotTropeId } from "@/lib/popularTropes";
import type { WorldBaseId } from "@/lib/worldFoundations";
import type { WorldAudienceFilter } from "@/lib/worldAudience";

export type TopicAudience = "all" | "male" | "female";

export interface TopicScheme {
  id: string;
  audience: TopicAudience;
  label: string;
  worldBaseId: Exclude<WorldBaseId, "custom">;
  expandableWorldBaseIds: Exclude<WorldBaseId, "custom">[];
  tropeId: Exclude<HotTropeId, "none">;
  description: string;
  entryHints: string[];
  openingSeeds: Array<{
    id: string;
    name: string;
    focus: string;
    tags: string[];
  }>;
}

export const TOPIC_SCHEMES: TopicScheme[] = [
  {
    id: "all-rebirth",
    audience: "all",
    label: "重生",
    worldBaseId: "modern",
    expandableWorldBaseIds: ["ancient", "cultivation"],
    tropeId: "reincarnation",
    description: "回到过去，带着记忆差改写命运。",
    entryHints: ["前世记忆", "关键节点", "资源先机", "避坑改命"],
    openingSeeds: [
      { id: "node", name: "回到关键节点", focus: "主角醒来发现自己回到命运转折发生前，必须马上做出和上一世不同的选择。", tags: ["记忆", "选择"] },
      { id: "mistake", name: "错误即将重演", focus: "上一世导致长期失败的错误正在眼前重演，主角知道后果，却还没有足够筹码说服别人。", tags: ["避坑", "压力"] },
      { id: "chance", name: "先机窗口打开", focus: "一个上一世后来才被证明极重要的机会提前出现，主角必须决定是否押上现有资源。", tags: ["资源", "先机"] },
    ],
  },
  {
    id: "all-transmigration",
    audience: "all",
    label: "穿越 / 穿书",
    worldBaseId: "ancient",
    expandableWorldBaseIds: ["cultivation", "otherworld", "modern"],
    tropeId: "transmigration",
    description: "身份错位，进入陌生处境或既定剧情。",
    entryHints: ["身份错位", "原剧情", "配角自救", "新环境适应"],
    openingSeeds: [
      { id: "wake", name: "醒来换了身份", focus: "主角醒来发现自己有了新的身份，周围人都默认他/她知道这里的规矩。", tags: ["身份", "适应"] },
      { id: "plot", name: "剧情节点逼近", focus: "主角刚弄清处境，就发现原本会让自己倒霉的剧情节点已经开始。", tags: ["剧情", "自救"] },
      { id: "public", name: "众目睽睽露馅", focus: "主角在公开场合被迫应对陌生身份，稍有差错就会引来怀疑。", tags: ["危机", "伪装"] },
    ],
  },
  {
    id: "all-system",
    audience: "all",
    label: "系统流",
    worldBaseId: "cultivation",
    expandableWorldBaseIds: ["modern", "ancient", "otherworld"],
    tropeId: "system",
    description: "系统任务、奖励、约束和代价推动故事。",
    entryHints: ["任务", "奖励", "面板", "限制", "代价"],
    openingSeeds: [
      { id: "panel", name: "系统面板弹出", focus: "系统第一次出现，给出奖励诱人的任务，同时标明失败代价。", tags: ["任务", "代价"] },
      { id: "choice", name: "新手任务二选一", focus: "系统同时给出稳妥和冒险两条路线，主角必须选择第一步。", tags: ["选择", "奖励"] },
      { id: "penalty", name: "违规惩罚触发", focus: "主角还没摸清系统规则，就因为一次小动作触发了惩罚提示。", tags: ["规则", "危机"] },
    ],
  },
  {
    id: "all-apocalypse",
    audience: "all",
    label: "末世",
    worldBaseId: "modern",
    expandableWorldBaseIds: ["future", "cultivation"],
    tropeId: "apocalypse",
    description: "灾变、生存、秩序崩塌和资源压力。",
    entryHints: ["灾变", "断电", "物资", "避难所", "队伍信任"],
    openingSeeds: [
      { id: "blackout", name: "停电第一夜", focus: "城市突然停电，通讯开始中断，主角听见楼道里传来第一声异常动静。", tags: ["断电", "异常"] },
      { id: "market", name: "超市物资争夺", focus: "主角赶到超市时，货架前已经聚起人群，恐慌和争抢马上失控。", tags: ["物资", "冲突"] },
      { id: "shelter", name: "避难所门口", focus: "避难所只剩最后名额，主角带着有限物资站在门口，必须决定带谁进去。", tags: ["避难所", "选择"] },
    ],
  },
  {
    id: "all-infinite",
    audience: "all",
    label: "无限流",
    worldBaseId: "infinite",
    expandableWorldBaseIds: [],
    tropeId: "infinite",
    description: "副本、轮回、倒计时、任务和通关奖励。",
    entryHints: ["副本", "轮回", "倒计时", "任务", "通关奖励"],
    openingSeeds: [
      { id: "countdown", name: "倒计时开始", focus: "陌生空间亮起倒计时，任务目标出现，周围玩家还没意识到规则的危险。", tags: ["倒计时", "任务"] },
      { id: "team", name: "临时队伍成形", focus: "副本刚开场，幸存者被迫组队，但每个人都隐瞒着自己的身份和能力。", tags: ["队伍", "信任"] },
      { id: "reward", name: "首个奖励诱饵", focus: "副本展示第一件奖励，所有人都知道它重要，却没人知道拿到它要付出什么。", tags: ["奖励", "争夺"] },
    ],
  },
  {
    id: "all-rules",
    audience: "all",
    label: "规则怪谈",
    worldBaseId: "modern",
    expandableWorldBaseIds: ["infinite"],
    tropeId: "rules",
    description: "规则、禁忌、纸条、异常空间和生存解谜。",
    entryHints: ["规则", "禁忌", "纸条", "异常空间", "生存解谜"],
    openingSeeds: [
      { id: "note", name: "墙上的纸条", focus: "主角在陌生空间醒来，墙上贴着几条互相矛盾的规则。", tags: ["纸条", "规则"] },
      { id: "neighbor", name: "邻居违反禁忌", focus: "主角还在读规则，隔壁已经有人违反禁忌，异常反应立刻发生。", tags: ["禁忌", "目击"] },
      { id: "hour", name: "午夜规则变更", focus: "午夜一到，原本安全的规则突然改写，主角必须重新判断什么还能相信。", tags: ["午夜", "变更"] },
    ],
  },
  {
    id: "all-business",
    audience: "all",
    label: "经营 / 种田",
    worldBaseId: "ancient",
    expandableWorldBaseIds: ["modern", "cultivation", "otherworld"],
    tropeId: "business",
    description: "经营生活、产业、领地、宗门或资源循环。",
    entryHints: ["店铺", "田产", "家业", "领地", "宗门", "资源循环"],
    openingSeeds: [
      { id: "shop", name: "第一间铺子", focus: "主角接手一间快倒闭的小铺，账本亏空，第一位客人却带来转机。", tags: ["店铺", "账本"] },
      { id: "land", name: "荒地到手", focus: "主角拿到一块没人看好的荒地，所有人都觉得这是赔本买卖。", tags: ["田产", "资源"] },
      { id: "order", name: "第一笔订单", focus: "主角刚开始经营，就接到一笔能力之外的大订单，成败会决定第一批口碑。", tags: ["订单", "机会"] },
    ],
  },
  {
    id: "all-folklore",
    audience: "all",
    label: "民俗悬疑",
    worldBaseId: "modern",
    expandableWorldBaseIds: ["ancient"],
    tropeId: "rules",
    description: "民俗、禁忌、乡土怪事、仪式和真相。",
    entryHints: ["民俗", "禁忌", "乡土怪事", "仪式", "真相"],
    openingSeeds: [
      { id: "village", name: "进村第一晚", focus: "主角因事进村借宿，村民反复提醒夜里听见敲门不要答应。", tags: ["乡村", "禁忌"] },
      { id: "ritual", name: "仪式被打断", focus: "一场地方仪式突然中断，所有人都看向主角，仿佛他/她不该出现在这里。", tags: ["仪式", "异常"] },
      { id: "inherit", name: "接下旧行当", focus: "主角继承一门民间行当，第一单生意就牵出多年旧事。", tags: ["传承", "旧事"] },
    ],
  },
  {
    id: "male-upgrade",
    audience: "male",
    label: "升级逆袭",
    worldBaseId: "cultivation",
    expandableWorldBaseIds: ["modern", "ancient"],
    tropeId: "upgrade",
    description: "变强、翻身、资源争夺和打脸。",
    entryHints: ["废柴", "退婚", "资源争夺", "战力成长", "打脸"],
    openingSeeds: [
      { id: "test", name: "资质测试被低看", focus: "测试结果让众人嘲笑，主角却发现自己真正的力量不在常规体系里。", tags: ["测试", "逆袭"] },
      { id: "resource", name: "资源名额被抢", focus: "原本属于主角的资源名额被人强行夺走，第一场反击必须当场开始。", tags: ["资源", "反击"] },
      { id: "challenge", name: "越级挑战上门", focus: "比主角高一阶的人当众逼战，所有人都等着看他出丑。", tags: ["挑战", "战力"] },
    ],
  },
  {
    id: "male-invincible",
    audience: "male",
    label: "无敌流",
    worldBaseId: "cultivation",
    expandableWorldBaseIds: ["otherworld", "modern"],
    tropeId: "upgrade",
    description: "隐藏实力、强者归来、碾压和低调装弱。",
    entryHints: ["隐藏实力", "强者归来", "碾压", "低调装弱"],
    openingSeeds: [
      { id: "weak", name: "被当成弱者", focus: "主角被安排到最弱位置，旁人不知他早已看穿全局。", tags: ["装弱", "碾压"] },
      { id: "return", name: "故地重回", focus: "主角回到曾经离开的地方，旧人仍以旧眼光看他。", tags: ["归来", "旧人"] },
      { id: "casual", name: "随手解决危机", focus: "众人束手无策的危机，主角只是随手处理，却引来新的怀疑。", tags: ["隐藏", "危机"] },
    ],
  },
  {
    id: "male-cautious",
    audience: "male",
    label: "苟道流",
    worldBaseId: "cultivation",
    expandableWorldBaseIds: ["modern", "infinite"],
    tropeId: "apocalypse",
    description: "藏实力、避风险、囤资源和稳健成长。",
    entryHints: ["藏实力", "避风险", "囤资源", "稳健成长"],
    openingSeeds: [
      { id: "hide", name: "测灵现场藏拙", focus: "主角明明能拿高评价，却故意压低表现，只求不被盯上。", tags: ["藏拙", "低调"] },
      { id: "list", name: "秘境名单被点名", focus: "主角最想避开的危险名单上突然出现自己的名字。", tags: ["避险", "秘境"] },
      { id: "stock", name: "大劫前夜囤丹药", focus: "主角知道灾劫将至，悄悄囤资源时被熟人撞见。", tags: ["囤资源", "大劫"] },
    ],
  },
  {
    id: "male-behind",
    audience: "male",
    label: "幕后流",
    worldBaseId: "modern",
    expandableWorldBaseIds: ["ancient", "cultivation"],
    tropeId: "business",
    description: "操盘、布局、代理人和信息差。",
    entryHints: ["操盘", "布局", "代理人", "信息差"],
    openingSeeds: [
      { id: "proxy", name: "代理人第一次出手", focus: "主角不露面，只让代理人执行第一步布局。", tags: ["代理", "布局"] },
      { id: "rumor", name: "一条消息引爆局势", focus: "主角放出一条看似普通的信息，暗中推动多方反应。", tags: ["信息差", "操盘"] },
      { id: "board", name: "棋盘刚刚摆开", focus: "各方都以为自己在主动，只有主角知道第一枚棋子已经落位。", tags: ["幕后", "棋局"] },
    ],
  },
  {
    id: "male-power",
    audience: "male",
    label: "争霸 / 权谋",
    worldBaseId: "ancient",
    expandableWorldBaseIds: ["cultivation", "otherworld"],
    tropeId: "business",
    description: "势力、兵权、地盘、朝局和门派格局。",
    entryHints: ["势力", "兵权", "地盘", "朝局", "门派格局"],
    openingSeeds: [
      { id: "order", name: "兵权被夺前夜", focus: "主角收到调令，知道一旦交出兵权就再无翻身机会。", tags: ["兵权", "朝局"] },
      { id: "court", name: "朝堂逼问", focus: "朝堂上多方围攻，主角必须在一句话里保住第一块筹码。", tags: ["朝堂", "博弈"] },
      { id: "border", name: "边关急报", focus: "边关突发急报，朝廷想把危局变成主角的罪名。", tags: ["边关", "危局"] },
    ],
  },
  {
    id: "male-career",
    audience: "male",
    label: "都市事业",
    worldBaseId: "modern",
    expandableWorldBaseIds: [],
    tropeId: "business",
    description: "创业、商业、职场、资源判断和人脉。",
    entryHints: ["创业", "商业", "职场", "资源判断", "人脉"],
    openingSeeds: [
      { id: "deal", name: "关键合同前夜", focus: "主角面对一份看似优厚的合同，却知道里面藏着未来的陷阱。", tags: ["合同", "判断"] },
      { id: "pitch", name: "融资路演", focus: "主角站上路演台，投资人只给三分钟证明价值。", tags: ["创业", "资源"] },
      { id: "office", name: "职场背锅现场", focus: "项目事故爆发，所有证据都指向主角。", tags: ["职场", "反击"] },
    ],
  },
  {
    id: "female-entertainment",
    audience: "female",
    label: "娱乐圈",
    worldBaseId: "modern",
    expandableWorldBaseIds: [],
    tropeId: "entertainment",
    description: "热搜、人设、片场、选秀、经纪人和公关危机。",
    entryHints: ["热搜", "人设", "片场", "选秀", "经纪人", "公关危机"],
    openingSeeds: [
      { id: "hotsearch", name: "热搜爆发", focus: "女主醒来发现自己被推上热搜第一，词条内容足以毁掉刚起步的事业。", tags: ["热搜", "人设"] },
      { id: "role", name: "片场临时换角", focus: "开拍前女主被通知换角，片场所有人都在等她失态。", tags: ["片场", "事业"] },
      { id: "contract", name: "解约通知递来", focus: "经纪人把解约通知推到女主面前，同时给出一条风险极高的翻盘路。", tags: ["经纪人", "公关"] },
    ],
  },
  {
    id: "female-palace",
    audience: "female",
    label: "宅斗 / 宫廷",
    worldBaseId: "ancient",
    expandableWorldBaseIds: [],
    tropeId: "palace",
    description: "家族、婚姻、礼制、主母、位分和权力。",
    entryHints: ["家族", "婚姻", "礼制", "主母", "位分", "权力"],
    openingSeeds: [
      { id: "tea", name: "请安茶盏", focus: "第一次请安时，茶盏、座次和称呼都暗藏陷阱。", tags: ["礼制", "陷阱"] },
      { id: "marriage", name: "婚事被议", focus: "长辈当众议定女主婚事，却没有问她一句。", tags: ["婚姻", "家族"] },
      { id: "ledger", name: "账本缺口", focus: "主母让女主查账，第一本账册就有明显缺口。", tags: ["掌家", "账本"] },
    ],
  },
  {
    id: "female-romance",
    audience: "female",
    label: "情感 / 婚恋",
    worldBaseId: "modern",
    expandableWorldBaseIds: ["ancient"],
    tropeId: "marriage",
    description: "甜宠、先婚后爱、破镜重圆、救赎和契约关系。",
    entryHints: ["甜宠", "先婚后爱", "破镜重圆", "救赎", "契约关系"],
    openingSeeds: [
      { id: "contract", name: "协议关系开始", focus: "双方签下协议，各有目的，却都没想到关系会从第一天失控。", tags: ["契约", "关系"] },
      { id: "reunion", name: "多年后重逢", focus: "女主在最不适合的场合遇见旧人，彼此都带着没说完的话。", tags: ["破镜", "重逢"] },
      { id: "help", name: "一次意外援手", focus: "女主陷入尴尬处境，对方出手相助，却让两人的关系变得更复杂。", tags: ["救赎", "暧昧"] },
    ],
  },
  {
    id: "female-era",
    audience: "female",
    label: "年代生活",
    worldBaseId: "modern",
    expandableWorldBaseIds: [],
    tropeId: "era",
    description: "七八十年代、家庭、物资、下乡和工厂。",
    entryHints: ["七八十年代", "家庭", "物资", "下乡", "工厂"],
    openingSeeds: [
      { id: "grain", name: "分粮当天", focus: "生产队分粮当天，女主发现家里的口粮被人动了手脚。", tags: ["物资", "家庭"] },
      { id: "train", name: "下乡名单公布", focus: "下乡名单贴出来，女主知道这份名单会改变一家人的命运。", tags: ["下乡", "选择"] },
      { id: "factory", name: "工厂名额之争", focus: "一个进厂名额突然空出来，亲戚邻里都盯上了它。", tags: ["工厂", "机会"] },
    ],
  },
  {
    id: "female-career",
    audience: "female",
    label: "事业成长",
    worldBaseId: "modern",
    expandableWorldBaseIds: ["ancient"],
    tropeId: "business",
    description: "职场、专业能力、行业翻盘和身份证明。",
    entryHints: ["职场", "专业能力", "行业翻盘", "身份证明"],
    openingSeeds: [
      { id: "meeting", name: "会议室被抢功", focus: "女主准备的方案被同事抢先汇报，所有人都等她沉默。", tags: ["职场", "能力"] },
      { id: "deadline", name: "最后期限", focus: "一个几乎不可能完成的项目落到女主手里。", tags: ["项目", "翻盘"] },
      { id: "interview", name: "关键面试", focus: "女主走进面试现场，发现主考官正是曾否定过她的人。", tags: ["证明", "机会"] },
    ],
  },
  {
    id: "female-daily",
    audience: "female",
    label: "轻松日常",
    worldBaseId: "modern",
    expandableWorldBaseIds: ["ancient"],
    tropeId: "sweet",
    description: "治愈、生活、关系修复、小院和开店。",
    entryHints: ["治愈", "生活", "关系修复", "小院", "开店"],
    openingSeeds: [
      { id: "yard", name: "小院第一天", focus: "女主搬进旧小院，修第一扇门时遇见第一个会改变生活的人。", tags: ["小院", "治愈"] },
      { id: "breakfast", name: "早餐摊开张", focus: "早餐摊第一天开张，第一位客人的反应决定她能不能继续做下去。", tags: ["开店", "生活"] },
      { id: "neighbor", name: "邻里误会", focus: "一场小误会让女主和邻里关系紧张，也给了修复关系的机会。", tags: ["关系", "日常"] },
    ],
  },
  {
    id: "female-change",
    audience: "female",
    label: "反内耗 / 改命",
    worldBaseId: "modern",
    expandableWorldBaseIds: ["ancient"],
    tropeId: "reincarnation",
    description: "摆脱错关系、家庭期待、自我选择和人生重启。",
    entryHints: ["错关系", "家庭期待", "自我选择", "人生重启"],
    openingSeeds: [
      { id: "refuse", name: "第一次拒绝", focus: "女主面对熟悉的要求，第一次没有顺从。", tags: ["拒绝", "自我"] },
      { id: "family", name: "家庭期待压来", focus: "家人把原本不属于她的责任推过来，女主必须重新划清边界。", tags: ["家庭", "边界"] },
      { id: "choice", name: "重新选择人生", focus: "一个看似稳定的机会摆在面前，女主决定不再走别人安排好的路。", tags: ["改命", "选择"] },
    ],
  },
];

const TOPIC_SCHEME_MAP = new Map(TOPIC_SCHEMES.map((topic) => [topic.id, topic]));

export function getTopicScheme(id: string | null | undefined) {
  return (id ? TOPIC_SCHEME_MAP.get(id) : undefined) || undefined;
}

export function getTopicSchemesByAudience(filter: WorldAudienceFilter) {
  return TOPIC_SCHEMES.filter((topic) => filter === "all" || topic.audience === "all" || topic.audience === filter);
}

