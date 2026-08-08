/**
 * 独立运行日志（错误/警告）：
 * - 内存环形缓冲（最近 500 条），无 DB/文件环境也能展示；
 * - 节流批量追加写入独立 LOG 文件（AppData/narra-runtime.log），与备份/同步/导入零交叉；
 * - 绝不记录 API 密钥等敏感信息。
 */

export type LogLevel = "error" | "warn";

export interface RuntimeLogEntry {
  ts: number;
  level: LogLevel;
  tag: string;
  msg: string;
  meta?: unknown;
}

const MAX_MEM = 500;
const FLUSH_BATCH = 30;
const FLUSH_INTERVAL_MS = 30_000;
const MAX_FILE_LINES = 2000;

let memLogs: RuntimeLogEntry[] = [];
let pending: RuntimeLogEntry[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let logPathPromise: Promise<string> | null = null;

/** 惰性解析 LOG 文件绝对路径（AppData 下，落在 fs:scope $APPDATA/** 允许范围） */
async function resolveLogPath(): Promise<string> {
  if (logPathPromise) return logPathPromise;
  logPathPromise = (async () => {
    try {
      const { appDataDir } = await import("@tauri-apps/api/path");
      const dir = await appDataDir();
      return `${dir.replace(/[\\/]+$/, "")}/narra-runtime.log`;
    } catch {
      return "";
    }
  })();
  return logPathPromise;
}

function formatLine(e: RuntimeLogEntry): string {
  const d = new Date(e.ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  const time = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}.${String(d.getMilliseconds()).padStart(3, "0")}`;
  const meta = e.meta === undefined ? "" : ` | ${safeStringify(e.meta)}`;
  return `[${time}] [${e.level.toUpperCase()}] [${e.tag}] ${e.msg}${meta}`;
}

function safeStringify(v: unknown): string {
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

/** 把一批日志追加到 LOG 文件；文件行数超上限时重写为仅保留末尾（避免无限膨胀） */
async function flushBatch(lines: string[]): Promise<void> {
  if (lines.length === 0) return;
  try {
    const path = await resolveLogPath();
    if (!path) return;
    const { writeTextFile, readTextFile } = await import("@tauri-apps/plugin-fs");
    await writeTextFile(path, lines.join("\n") + "\n", { append: true });
    try {
      const raw = await readTextFile(path);
      const all = raw.split("\n");
      if (all.length > MAX_FILE_LINES + 500) {
        const tail = all.slice(-MAX_FILE_LINES);
        await writeTextFile(path, tail.join("\n") + (tail.length ? "\n" : ""));
      }
    } catch {
      /* 截断失败不影响主流程 */
    }
  } catch {
    /* LOG 写入失败不应影响应用 */
  }
}

function doFlush(): void {
  if (pending.length === 0) return;
  const batch = pending;
  pending = [];
  void flushBatch(batch.map(formatLine));
}

function scheduleFlush(): void {
  if (pending.length >= FLUSH_BATCH) {
    doFlush();
  }
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    doFlush();
  }, FLUSH_INTERVAL_MS);
}

function record(level: LogLevel, tag: string, msg: string, meta?: unknown): void {
  const entry: RuntimeLogEntry = { ts: Date.now(), level, tag, msg, meta };
  memLogs.push(entry);
  if (memLogs.length > MAX_MEM) memLogs = memLogs.slice(-MAX_MEM);
  pending.push(entry);
  scheduleFlush();
}

export function logError(tag: string, msg: string, meta?: unknown): void {
  record("error", tag, msg, meta);
}

export function logWarn(tag: string, msg: string, meta?: unknown): void {
  record("warn", tag, msg, meta);
}

/** 取最近 n 条日志（倒序：最新在前） */
export function getLogs(n = 200): RuntimeLogEntry[] {
  return memLogs.slice(-n).reverse();
}

/** 格式化日志文本（供导出/复制，不含任何密钥） */
export function logsToText(entries = memLogs): string {
  return entries.map(formatLine).join("\n") + (entries.length ? "\n" : "");
}

/** 立即落盘 + 清空内存（清空按钮 / 退出前调用） */
export function flushLogs(): void {
  doFlush();
  memLogs = [];
}

export function clearLogs(): void {
  memLogs = [];
  pending = [];
}

/** 挂全局错误捕获（StrictMode 防重）。DB 未就绪时日志先入内存，落盘自动延后无副作用。 */
export function initRuntimeLog(): void {
  if ((window as unknown as { __narraLogInit?: boolean }).__narraLogInit) return;
  (window as unknown as { __narraLogInit?: boolean }).__narraLogInit = true;

  window.addEventListener("error", (ev) => {
    const msg = ev.message || "脚本错误";
    const loc = ev.filename ? `${ev.filename}${ev.lineno ? `:${ev.lineno}` : ""}` : "";
    logError("global-error", loc ? `${msg} @ ${loc}` : msg);
  });

  window.addEventListener("unhandledrejection", (ev) => {
    const reason = ev.reason instanceof Error ? `${ev.reason.message}${ev.reason.stack ? `\n${ev.reason.stack}` : ""}` : String(ev.reason ?? "未捕获的 Promise 拒绝");
    logError("unhandled-rejection", reason);
  });
}