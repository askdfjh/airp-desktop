// 独立核对取书名解析与本地书名库，不依赖打包。
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../src/lib/storyTitle.ts"), "utf8");

const REASONING_MARK =
  /用户现在|需要起|首先看|素材里|根据素材|根据下面|书名必须|只输出|严禁|合格例|网文责编|分析一下|所以书名|可以叫作|起末世|起一个书名/;
const PROSE_MARK =
  /因为|所以|但是|然后|首先|如果|可以|应该|需要|我们|这个|那个|素材|模型|用户/;

function polishTitleLine(line) {
  let t = line.trim();
  t = t.replace(/^[\s"'「」『』【】《》〈〉*#\->]+|[\s"'「」『』【】《》〈〉]+$/g, "");
  t = t.replace(/^(?:书名|标题|书名是|推荐书名|输出|答案)[:：]\s*/, "");
  t = t.replace(/^(?:叫作|叫做|就叫|取名|命名为)\s*/, "");
  t = t.replace(/^\d+[\.、.)）]\s*/, "");
  t = t.replace(/\s+/g, "");
  if (/[。！？.!?…]$/.test(t)) t = t.slice(0, -1);
  return t;
}

function isPlaceholderTitle(title) {
  const t = (title || "").trim();
  if (!t) return true;
  if (/的冒险$/.test(t) || /^扮演[·•]/.test(t) || /^未命名/.test(t)) return true;
  if (REASONING_MARK.test(t) || /[。；]/.test(t)) return true;
  return false;
}

function isBadGeneratedTitle(title) {
  const t = (title || "").trim();
  if (!t || t.length < 4 || t.length > 16) return true;
  if (isPlaceholderTitle(t) || REASONING_MARK.test(t)) return true;
  if (/[。！？!?…，、；;：:]/.test(t)) return true;
  if (PROSE_MARK.test(t)) return true;
  if (/^(建议|如下|好的|当然|书名|标题|嗯|哦)/.test(t)) return true;
  if (/(的书名|这本书|起名|取名|命名)$/.test(t)) return true;
  if (!/[\u4e00-\u9fff]/.test(t)) return true;
  return false;
}

function parseGeneratedTitle(raw) {
  let t = String(raw || "")
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/<think>[\s\S]*$/gi, "")
    .trim();
  const fence = t.match(/```(?:\w+)?\s*([\s\S]*?)```/);
  if (fence) t = fence[1].trim();
  const jm = t.match(/"title"\s*:\s*"([^"]{2,24})"/);
  if (jm) {
    const one = polishTitleLine(jm[1]);
    if (one && !isBadGeneratedTitle(one)) return one;
  }
  const quoted = [...t.matchAll(/[《「『【]([^》」』】]{4,16})[》」』】]/g)];
  for (let i = quoted.length - 1; i >= 0; i--) {
    const one = polishTitleLine(quoted[i][1]);
    if (one && !isBadGeneratedTitle(one)) return one;
  }
  const cues = [...t.matchAll(/(?:书名|标题|叫作|叫做|就叫|取名|命名为|推荐)\s*[:：是为]?\s*[「『《"']?([\u4e00-\u9fffA-Za-z0-9]{4,16})/g)];
  for (let i = cues.length - 1; i >= 0; i--) {
    const one = polishTitleLine(cues[i][1]);
    if (one && !isBadGeneratedTitle(one)) return one;
  }
  const good = t.split(/\r?\n/).map(polishTitleLine).filter((c) => c && !isBadGeneratedTitle(c));
  return good.at(-1) || null;
}

const cases = [
  ["用户现在需要起末世网文的书名，首先看素材里的元素：主角有", null],
  ['{"title":"末世从停电那晚开始"}', "末世从停电那晚开始"],
  ["分析完毕。\n《灾变夜我先封了整栋楼》", "灾变夜我先封了整栋楼"],
  ["可以叫作末世我有无限仓库", "末世我有无限仓库"],
  ["书名：开局一座避难所", "开局一座避难所"],
  ["<think>先看素材</think>\n重生之开局改天命", "重生之开局改天命"],
  ["好的，我来起名", null],
];

let failed = 0;
for (const [input, want] of cases) {
  const got = parseGeneratedTitle(input);
  if (got !== want) {
    console.error("PARSE", JSON.stringify(input), "=>", got, "want", want);
    failed++;
  }
}

const bankBlock = src.slice(src.indexOf("const TITLE_BANK"), src.indexOf("const WORLD_BANK") < 0 ? src.length : src.indexOf("function hashPick"));
const titles = [...bankBlock.matchAll(/"([^"${]{4,16})"/g)].map((m) => m[1]);
for (const t of titles) {
  if (/[\u4e00-\u9fff]/.test(t) && isBadGeneratedTitle(t)) {
    console.error("BANK_BAD", t);
    failed++;
  }
}

if (failed) {
  console.error("failed", failed);
  process.exit(1);
}
console.log("ok", cases.length, "parse cases; scanned", titles.length, "string literals");
