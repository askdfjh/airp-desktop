const http = require("http");
const PORT = 3456;

/** DuckDuckGo search via scraping */
async function searchDuckDuckGo(query) {
  const url = "https://html.duckduckgo.com/html/?q=" + encodeURIComponent(query);
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
  });
  const html = await res.text();
  const results = [];
  const linkRe = /<a[^>]+class="result__a"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
  const snippetRe = /<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/gi;
  const links = [], titles = [], snippets = [];
  let m;
  while ((m = linkRe.exec(html)) !== null) { links.push(m[1]); titles.push(m[2].replace(/<[^>]*>/g, "").trim()); }
  while ((m = snippetRe.exec(html)) !== null) snippets.push(m[1].replace(/<[^>]*>/g, "").trim());
  for (let i = 0; i < Math.min(links.length, 5); i++) {
    results.push({ title: titles[i] || "", link: links[i] || "", snippet: snippets[i] || "" });
  }
  return results;
}

const TOOLS = [
  {
    name: "web_search",
    description: "搜索互联网获取最新信息，支持中文和英文搜索",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "搜索关键词" },
      },
      required: ["query"],
    },
  },
];

function json(data, status = 200) {
  return { status, headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }, body: JSON.stringify(data) };
}

const server = http.createServer(async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }

  const url = new URL(req.url, `http://localhost:${PORT}`);
  const path = url.pathname;

  try {
    if (path === "/health" && req.method === "GET") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok" }));
      return;
    }

    if (path === "/tools" && req.method === "GET") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ tools: TOOLS }));
      return;
    }

    if (path.startsWith("/tools/") && req.method === "POST") {
      const toolName = decodeURIComponent(path.slice(7));
      let body = "";
      req.on("data", (chunk) => body += chunk);
      req.on("end", async () => {
        try {
          const { arguments: args } = JSON.parse(body || "{}");
          if (toolName === "web_search") {
            const query = args?.query || "";
            if (!query.trim()) { res.writeHead(400); res.end(JSON.stringify({ error: "请提供搜索关键词" })); return; }
            const results = await searchDuckDuckGo(query);
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ result: results }));
            return;
          }
          res.writeHead(404); res.end(JSON.stringify({ error: "未知工具" }));
        } catch (e) {
          res.writeHead(500); res.end(JSON.stringify({ error: e.message }));
        }
      });
      return;
    }

    res.writeHead(404); res.end(JSON.stringify({ error: "Not found" }));
  } catch (e) {
    res.writeHead(500); res.end(JSON.stringify({ error: e.message }));
  }
});

server.listen(PORT, () => {
  console.log(`MCP 搜索服务器已启动 → http://localhost:${PORT}`);
  console.log(`在 AIRP 的 MCP 服务器面板中添加:`);
  console.log(`  名称: 网页搜索`);
  console.log(`  地址: http://localhost:${PORT}`);
  console.log(`  协议: HTTP`);
});
