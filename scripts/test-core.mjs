// 闭环核对：书名解析、场景/推荐解析、导出去标签。不依赖打包。
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
let failed = 0;
function check(name, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) {
    console.error("FAIL", name, "\n  got ", got, "\n  want", want);
    failed++;
  }
}

const title = spawnSync(process.execPath, [join(root, "scripts/test-story-title.mjs")], { encoding: "utf8" });
if (title.status !== 0) {
  console.error(title.stdout, title.stderr);
  failed++;
} else {
  console.log("title:", title.stdout.trim());
}

const META_DIRECT_RE = /(世界设定|世界观|背景设定|剧情背景|故事背景|图鉴|角色设定|人物设定|设定(?:介绍|详情|说明|列表|页面|面板|文档))/;
const META_VERB_RE = /(查看|阅读|浏览|打开|翻开|了解|看看|进入|点开|观阅|详看|翻看)[^，。；、]{0,8}(设定|图鉴|资料|背景|世界|介绍|界面)/;
const WORLD_BOOK_ENTRY_RE = /^【[^】]+(?:设定|资料|背景|图鉴)[^】]*】/;
const WORLD_BOOK_TWO_SEG_RE = /^【[^】]+·[^】]+】/;

function isMetaSuggestion(s) {
  const t = s.trim();
  if (META_DIRECT_RE.test(t) || META_VERB_RE.test(t)) return true;
  if (WORLD_BOOK_ENTRY_RE.test(t)) return true;
  return WORLD_BOOK_TWO_SEG_RE.test(t) && t.length > 24;
}

function parseSuggestions(sugText) {
  return sugText
    .split("\n")
    .map((l) => l.replace(/^\s*(?:\d+[.、．)）]\s*|[-*•·]\s*)/, "").trim())
    .filter((l) => Boolean(l) && !isMetaSuggestion(l));
}

check("keep action", isMetaSuggestion("推开超市玻璃门抢物资"), false);
check("drop meta", isMetaSuggestion("查看世界设定"), true);
check("drop book dump", isMetaSuggestion("【境界体系设定·修仙境界】炼气筑基金丹元婴化神"), true);

const sug = parseSuggestions("1. 封住楼道防火门\n2. 查看角色设定\n3. 把邻居拦在门外\n");
check("filter suggestions", sug, ["封住楼道防火门", "把邻居拦在门外"]);

function parseSceneAnalysis(text) {
  let t = text.replace(/<think>[\s\S]*?<\/think>/gi, "").replace(/<\/?think>/gi, "").trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  let parsed = null;
  try {
    parsed = JSON.parse(t);
  } catch {
    const keyIdx = t.lastIndexOf('"suggestions"');
    const startGuess = keyIdx >= 0 ? t.lastIndexOf("{", keyIdx) : t.indexOf("{");
    const start = startGuess >= 0 ? startGuess : t.indexOf("{");
    const end = t.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try { parsed = JSON.parse(t.slice(start, end + 1)); } catch { parsed = null; }
    }
  }
  if (!parsed || typeof parsed !== "object") return null;
  const d = parsed;
  const raw = Array.isArray(d.suggestions) ? d.suggestions.map((s) => String(s).trim()).filter(Boolean) : [];
  return { chapterTitle: d.chapterTitle, suggestions: raw.filter((s) => !isMetaSuggestion(s)) };
}

const sa = parseSceneAnalysis('先分析一下。{"chapterTitle":"停电第一夜","suggestions":["封住楼道防火门","查看世界设定","清点冰箱存货"]}');
check("analysis title", sa?.chapterTitle, "停电第一夜");
check("analysis drop meta", sa?.suggestions, ["封住楼道防火门", "清点冰箱存货"]);

function buildStoryText(title, msgs, includePlayer) {
  const lines = [title, ""];
  for (const m of msgs) {
    if (m.opening) continue;
    if (m.role === "user" && !includePlayer) continue;
    let body = m.content || "";
    if (m.role === "assistant") {
      body = body.replace(/【(?:章节名|场景信息|正文|对话推荐)】[^\n]*/g, "").trim();
    }
    if (!body) continue;
    if (m.role === "user") lines.push(`（你）${body}`);
    else lines.push(body);
    lines.push("");
  }
  return lines.join("\n");
}

const exported = buildStoryText("末世从停电那晚开始", [
  { role: "user", content: "封住楼道防火门" },
  { role: "assistant", content: "楼道里只剩应急灯。\n【对话推荐】\n1. 去天台" },
], false);
check("export hide player", exported.includes("封住楼道"), false);
check("export hide suggest tag", exported.includes("对话推荐"), false);
check("export keep body", exported.includes("应急灯"), true);

const NOTE_TAG_RE = /[（(]\s*(?:伏笔|新钩子|旧钩子|钩子|待补|待续|补细节|加细节|作者注|备注|TODO|todo)\s*[）)]/g;
const NOTE_PAREN_RE = /[（(](?:等下要加|还要加|待补|待加|补充一下|作者注|注[：:]|TODO|todo)[^）)]*[）)]/g;
const AUTHOR_PREFIX_RE = /^(?:哦对还要加个细节[：:]?|哦对还要|还要加个细节[：:]?|加个细节[：:]|等下要加[：:]?|补充一下[：:]?|作者注[：:]|注[：:]|TODO[：:]|todo[：:])\s*/;
const MD_HEADING_RE = /^\s{0,3}#{1,6}\s+\S/;
function stripDraftNotes(text) {
  const kept = [];
  for (const raw of text.split(/\n{2,}/)) {
    const cleaned = raw.replace(NOTE_TAG_RE, "").replace(NOTE_PAREN_RE, "").split("\n")
      .map((l) => l.replace(AUTHOR_PREFIX_RE, "").replace(/[ \t]+$/g, ""))
      .filter((l) => {
        const t = l.trim();
        return t && !(MD_HEADING_RE.test(t) && t.length < 40);
      }).join("\n").trim();
    if (cleaned) kept.push(cleaned);
  }
  return kept.join("\n\n").trim();
}
const dirty = "酉时还有不到六个小时。（等下要加细节比如阿婆给的地址有问题？）\n\n哦对还要加个细节：门槛下闻见槐花香。（伏笔）\n\n门外阿婆喊他快走。（新钩子）\n\n### 【错?】";
const clean = stripDraftNotes(dirty);
check("strip keep hour", clean.includes("酉时还有不到六个小时"), true);
check("strip keep locust", clean.includes("门槛下闻见槐花香"), true);
check("strip keep auntie", clean.includes("门外阿婆喊他快走"), true);
check("strip drop plan", clean.includes("等下要加"), false);
check("strip drop hook tag", /伏笔|新钩子/.test(clean), false);
check("strip drop md", clean.includes("【错?】"), false);
check("strip drop leftover prefix", clean.includes("加个细节"), false);

if (failed) {
  console.error("failed", failed);
  process.exit(1);
}
console.log("core ok");
