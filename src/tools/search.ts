export type SearchProvider = "duckduckgo" | "serper" | "bing" | "brave" | "tavily";

interface ProviderConfig {
  name: string;
  url: string;
  keyHeader: string;
  keyLabel: string;
  keyPlaceholder: string;
  signupUrl: string;
  docs: string;
}

export const SEARCH_PROVIDERS: Record<SearchProvider, ProviderConfig> = {
  duckduckgo: {
    name: "DuckDuckGo",
    url: "",
    keyHeader: "",
    keyLabel: "无需 API Key",
    keyPlaceholder: "",
    signupUrl: "",
    docs: "免费，无需配置，结果较少",
  },
  serper: {
    name: "Serper.dev",
    url: "https://google.serper.dev/search",
    keyHeader: "X-API-KEY",
    keyLabel: "Serper.dev API Key",
    keyPlaceholder: "输入 Serper.dev API Key",
    signupUrl: "https://serper.dev",
    docs: "Google 搜索结果，免费 2500 次/月",
  },
  bing: {
    name: "Bing Search",
    url: "https://api.bing.microsoft.com/v7.0/search",
    keyHeader: "Ocp-Apim-Subscription-Key",
    keyLabel: "Bing Search API Key",
    keyPlaceholder: "输入 Azure Bing Search Key",
    signupUrl: "https://portal.azure.com/#create/microsoft.bingsearch",
    docs: "微软 Bing 搜索，免费层 1000 次/月",
  },
  brave: {
    name: "Brave Search",
    url: "https://api.search.brave.com/res/v1/web/search",
    keyHeader: "X-Subscription-Token",
    keyLabel: "Brave Search API Key",
    keyPlaceholder: "输入 Brave Search API Key",
    signupUrl: "https://brave.com/search/api/",
    docs: "Brave 独立搜索引擎，免费 2000 次/月",
  },
  tavily: {
    name: "Tavily",
    url: "https://api.tavily.com/search",
    keyHeader: "X-API-KEY",
    keyLabel: "Tavily API Key",
    keyPlaceholder: "输入 Tavily API Key",
    signupUrl: "https://tavily.com",
    docs: "AI 原生搜索引擎，免费 1000 次/月",
  },
};

export async function webSearch(query: string, provider: SearchProvider, apiKey: string): Promise<string> {
  if (provider === "duckduckgo" || !apiKey) {
    return searchDuckDuckGo(query);
  }
  if (provider === "serper") return searchSerper(query, apiKey);
  if (provider === "bing") return searchBing(query, apiKey);
  if (provider === "brave") return searchBrave(query, apiKey);
  if (provider === "tavily") return searchTavily(query, apiKey);
  return searchDuckDuckGo(query);
}

async function tauriHttpFetch(url: string, method: string = "GET", headers: Record<string, string> = {}, body?: string): Promise<string> {
  const { invoke } = await import("@tauri-apps/api/core");
  const args: Record<string, unknown> = { url, method, headers };
  if (body !== undefined) args.body = body;
  return await invoke<string>("http_fetch", args);
}

async function searchSerper(query: string, apiKey: string): Promise<string> {
  const url = "https://google.serper.dev/search";
  const headers: Record<string, string> = { "X-API-KEY": apiKey, "Content-Type": "application/json" };
  const body = JSON.stringify({ q: query, gl: "cn", hl: "zh-cn" });
  const jsonText = await tauriHttpFetch(url, "POST", headers, body);
  const data = JSON.parse(jsonText);
  const parts: string[] = [];
  if (data.answerBox?.answer) parts.push("【直接答案】" + data.answerBox.answer);
  if (data.answerBox?.snippet) parts.push("【摘要】" + data.answerBox.snippet);
  if (data.knowledgeGraph?.description) parts.push("【知识图谱】" + data.knowledgeGraph.description);
  const organic = (data.organic || []).slice(0, 8);
  if (organic.length > 0) {
    parts.push("【搜索结果】");
    organic.forEach((r: Record<string, unknown>, i: number) => {
      parts.push(`${i + 1}. ${r.title || ""}`);
      parts.push(`   ${r.snippet || ""}`);
      parts.push(`   ${r.link || ""}`);
    });
  }
  return parts.join("\n") || "未找到相关结果";
}

async function searchBing(query: string, apiKey: string): Promise<string> {
  const url = "https://api.bing.microsoft.com/v7.0/search?q=" + encodeURIComponent(query) + "&count=8&mkt=zh-CN";
  const headers: Record<string, string> = { "Ocp-Apim-Subscription-Key": apiKey };
  const jsonText = await tauriHttpFetch(url, "GET", headers);
  const data = JSON.parse(jsonText);
  const parts: string[] = [];
  if (data.webPages?.value?.length > 0) {
    parts.push("【搜索结果】");
    data.webPages.value.slice(0, 8).forEach((r: Record<string, unknown>, i: number) => {
      parts.push(`${i + 1}. ${r.name || ""}`);
      if (r.snippet) parts.push(`   ${r.snippet}`);
      if (r.url) parts.push(`   ${r.url}`);
    });
  }
  return parts.join("\n") || "未找到相关结果";
}

async function searchBrave(query: string, apiKey: string): Promise<string> {
  const url = "https://api.search.brave.com/res/v1/web/search?q=" + encodeURIComponent(query) + "&count=8";
  const headers: Record<string, string> = { "X-Subscription-Token": apiKey, "Accept": "application/json" };
  const jsonText = await tauriHttpFetch(url, "GET", headers);
  const data = JSON.parse(jsonText);
  const parts: string[] = [];
  const web = data.web?.results || [];
  if (web.length > 0) {
    parts.push("【搜索结果】");
    web.slice(0, 8).forEach((r: Record<string, unknown>, i: number) => {
      parts.push(`${i + 1}. ${r.title || ""}`);
      if (r.description) parts.push(`   ${r.description}`);
      if (r.url) parts.push(`   ${r.url}`);
    });
  }
  return parts.join("\n") || "未找到相关结果";
}

async function searchTavily(query: string, apiKey: string): Promise<string> {
  const url = "https://api.tavily.com/search";
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const body = JSON.stringify({ api_key: apiKey, query, search_depth: "basic", max_results: 8 });
  const jsonText = await tauriHttpFetch(url, "POST", headers, body);
  const data = JSON.parse(jsonText);
  const parts: string[] = [];
  if (data.answer) parts.push("【AI 摘要】" + data.answer);
  const results = data.results || [];
  if (results.length > 0) {
    parts.push("【搜索结果】");
    results.forEach((r: Record<string, unknown>, i: number) => {
      parts.push(`${i + 1}. ${r.title || ""}`);
      if (r.content) parts.push(`   ${r.content}`);
      if (r.url) parts.push(`   ${r.url}`);
    });
  }
  return parts.join("\n") || "未找到相关结果";
}

async function searchDuckDuckGo(query: string): Promise<string> {
  const { invoke } = await import("@tauri-apps/api/core");
  // Reset cookies and seed DDG-friendly cookies before searching
  try {
    await invoke("http_clear_cookies", {});
    await invoke("http_set_cookie", {
      url: "https://duckduckgo.com/",
      name: "accept",
      value: "auto",
      domain: "duckduckgo.com",
      path: "/",
    });
    await invoke("http_set_cookie", {
      url: "https://duckduckgo.com/",
      name: "duckduckgo-accept",
      value: "true",
      domain: "duckduckgo.com",
      path: "/",
    });
    const cookies = await invoke<string>("http_list_cookies", { url: "https://duckduckgo.com/" });
    console.log("[search] DuckDuckGo cookies ready:", cookies.trim().split("\n")[0]);
  } catch (e) {
    console.warn("[search] Cookie init failed:", e);
  }

  const fetchUrlWithTimeout = async (url: string, timeoutMs = 4500): Promise<string> => {
    const { invoke } = await import("@tauri-apps/api/core");
    return await Promise.race([
      invoke<string>("http_fetch", { url, method: "GET", headers: {} }),
      new Promise<string>((_, reject) =>
        setTimeout(() => reject(new Error(`请求超时 (${timeoutMs}ms)`)), timeoutMs)
      ),
    ]);
  };

  const fetchUrl = async (url: string): Promise<string> => {
    try {
      const result = await fetchUrlWithTimeout(url);
      console.log("[search] http_fetch ok:", url.slice(0, 70), "len:", result.length);
      return result;
    } catch (e) {
      console.log("[search] http_fetch failed:", url.slice(0, 70), e);
      throw e;
    }
  };

  // Strategy 1: Try Bing HTML search (most reliable for free)
  {
    const bingUrl = "https://www.bing.com/search?q=" + encodeURIComponent(query) + "&setlang=zh-cn";
    console.log("[search] Trying Bing:", bingUrl);
    try {
      const html = await fetchUrl(bingUrl);
      const results: string[] = [];
      // Bing results: <li class="b_algo">...</li>
      const liRe = /<li[^>]*class="[^"]*b_algo[^"]*"[^>]*>([\s\S]*?)<\/li>/gi;
      let m: RegExpExecArray | null;
      let idx = 0;
      while ((m = liRe.exec(html)) !== null && idx < 8) {
        const block = m[1];
        const titleM = /<h2[^>]*>[\s\S]*?<a[^>]+href="([^"]*)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<\/h2>/i.exec(block);
        const snippetM = /<p[^>]*>([\s\S]*?)<\/p>/i.exec(block) ||
                          /<div[^>]*class="[^"]*b_caption[^"]*"[^>]*>[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>/i.exec(block);
        if (titleM) {
          idx++;
          const title = titleM[2].replace(/<[^>]*>/g, "").trim();
          const link = titleM[1];
          results.push(`${idx}. ${title}`);
          if (snippetM) {
            const snippet = snippetM[1].replace(/<[^>]*>/g, "").trim();
            if (snippet) results.push(`   ${snippet}`);
          }
          results.push(`   ${link}`);
        }
      }
      console.log("[search] Bing results:", results.length, "items");
      if (results.length > 0) return results.join("\n");
    } catch (e) {
      console.log("[search] Bing failed:", e);
    }
  }

  // Strategy 2: DuckDuckGo HTML（cookie 已预置，直接搜索）
  {
    console.log("[search] Trying DuckDuckGo with cookie...");
    try {
      // cookie 已在上方预置，直接搜索
      const searchUrl = "https://duckduckgo.com/html/?q=" + encodeURIComponent(query);
      const html = await fetchUrl(searchUrl);
      // Quick check: does it look like a results page?
      const hasResults = /result__a/i.test(html) || /result--url/i.test(html) || /class="result/i.test(html);
      if (hasResults) {
        const results: string[] = [];
        const linkRe = /<a[^>]+class="[^"]*result__a[^"]*"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
        const snippetRe = /<a[^>]+class="[^"]*result__snippet[^"]*"[^>]*>([\s\S]*?)<\/a>/gi;
        const links: string[] = [], titles: string[] = [];
        let m: RegExpExecArray | null;
        while ((m = linkRe.exec(html)) !== null) {
          // DuckDuckGo uses redirect URLs, extract the real URL
          let url = m[1];
          const uRe = /uddg=([^&]+)/.exec(url);
          if (uRe) url = decodeURIComponent(uRe[1]);
          links.push(url);
          titles.push(m[2].replace(/<[^>]*>/g, "").trim());
        }
        const snippets: string[] = [];
        while ((m = snippetRe.exec(html)) !== null) snippets.push(m[1].replace(/<[^>]*>/g, "").trim());

        console.log("[search] DuckDuckGo HTML found links:", links.length);
        if (links.length > 0) {
          for (let i = 0; i < Math.min(links.length, 5); i++) {
            results.push(`${i + 1}. ${titles[i] || ""}`);
            if (snippets[i]) results.push(`   ${snippets[i]}`);
            results.push(`   ${links[i] || ""}`);
          }
          return results.join("\n");
        }
      } else {
        console.log("[search] DuckDuckGo HTML doesn't look like results page");
      }
    } catch (e) {
      console.log("[search] DuckDuckGo HTML failed:", e);
    }
  }

  // Strategy 3: DuckDuckGo Instant Answer API (JSON, no auth needed)
  {
    const apiUrl = "https://api.duckduckgo.com/?q=" + encodeURIComponent(query) + "&format=json&no_html=1&skip_disambig=1&no_redirect=1";
    console.log("[search] Trying DuckDuckGo API:", apiUrl);
    try {
      const jsonText = await fetchUrl(apiUrl);
      const data = JSON.parse(jsonText);
      const parts: string[] = [];
      if (data.AbstractText) parts.push("【摘要】" + data.AbstractText);
      if (data.Answer) parts.push("【答案】" + data.Answer);
      if (data.Definition) parts.push("【定义】" + data.Definition);
      const related = (data.RelatedTopics || []).slice(0, 5);
      for (const r of related) {
        if (r.Text) parts.push("- " + r.Text);
      }
      const topics = (data.Topics || []).slice(0, 5);
      for (const t of topics) {
        if (t.Text) parts.push("- " + t.Text);
      }
      if (parts.length > 0) return parts.join("\n");
      console.log("[search] DuckDuckGo API returned no useful data");
    } catch (e) {
      console.log("[search] DuckDuckGo API failed:", e);
    }
  }

  // Strategy 4: Google News RSS (for news queries)
  {
    const rssUrl = "https://news.google.com/rss/search?q=" + encodeURIComponent(query) + "&hl=zh-CN&gl=CN&ceid=CN:zh-Hans";
    console.log("[search] Trying Google News RSS:", rssUrl);
    try {
      const xml = await fetchUrl(rssUrl);
      const results: string[] = [];
      const itemRe = /<item>([\s\S]*?)<\/item>/gi;
      let m: RegExpExecArray | null;
      let idx = 0;
      while ((m = itemRe.exec(xml)) !== null && idx < 8) {
        const block = m[1];
        const titleM = /<title>([\s\S]*?)<\/title>/.exec(block);
        const linkM = /<link>([\s\S]*?)<\/link>/.exec(block);
        const pubM = /<pubDate>([\s\S]*?)<\/pubDate>/.exec(block);
        const descM = /<description>([\s\S]*?)<\/description>/.exec(block);
        if (titleM) {
          idx++;
          results.push(`${idx}. ${titleM[1].replace(/<!\[CDATA\[/g, "").replace(/\]\]>/g, "").trim()}`);
          if (descM) {
            const desc = descM[1].replace(/<[^>]*>/g, "").replace(/<!\[CDATA\[/g, "").replace(/\]\]>/g, "").trim();
            if (desc) results.push(`   ${desc}`);
          }
          if (pubM) results.push(`   时间: ${pubM[1]}`);
          if (linkM) results.push(`   ${linkM[1]}`);
        }
      }
      console.log("[search] Google News RSS results:", results.length, "items");
      if (results.length > 0) return results.join("\n");
    } catch (e) {
      console.log("[search] Google News RSS failed:", e);
    }
  }

  return "搜索未返回结果。请尝试在设置(Settings)中配置其他搜索服务（Serper.dev、Bing、Brave、Tavily）的 API Key 以获得更可靠的搜索体验。";
}
