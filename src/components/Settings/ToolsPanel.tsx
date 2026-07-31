import { useState, useEffect } from "react";
import { Search, Wifi, Globe, ExternalLink } from "lucide-react";
import { getAppSetting, setAppSetting } from "@/lib/db";
import { setToolsEnabled } from "@/hooks/useChat";
import { useUIStore } from "@/stores/uiStore";
import { SEARCH_PROVIDERS, type SearchProvider } from "@/tools/search";

const PROVIDER_KEYS: SearchProvider[] = ["duckduckgo", "serper", "bing", "brave", "tavily"];

export function ToolsPanel() {
  const [provider, setProvider] = useState<SearchProvider>("duckduckgo");
  const [apiKey, setApiKey] = useState("");
  const { webSearchOn: enabled, setWebSearchOn: setEnabled } = useUIStore();

  useEffect(() => {
    (async () => {
      const e = await getAppSetting("web_search_enabled");
      const p = await getAppSetting("search_provider");
      const k = await getAppSetting("search_api_key");
      const isOn = e === "1";
      setEnabled(isOn);
      setToolsEnabled(isOn);
      if (p && PROVIDER_KEYS.includes(p as SearchProvider)) setProvider(p as SearchProvider);
      setApiKey(k || "");
    })();
  }, []);

  const toggleEnabled = async () => {
    const next = !enabled;
    setEnabled(next);
    setToolsEnabled(next);
    await setAppSetting("web_search_enabled", next ? "1" : "0");
  };

  const changeProvider = async (p: SearchProvider) => {
    setProvider(p);
    await setAppSetting("search_provider", p);
  };

  const changeApiKey = async (v: string) => {
    setApiKey(v);
    await setAppSetting("search_api_key", v);
  };

  const cfg = SEARCH_PROVIDERS[provider];

  return (
    <div style={{ maxWidth: 520, width: "100%", display: "flex", flexDirection: "column", gap: 20, flex: 1, minHeight: 0, overflowY: "auto", margin: "0 auto" }}>
      <div style={{ padding: 16, borderRadius: 12, background: "var(--seed-surface)", border: "1px solid var(--seed-border)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: "var(--seed-accent-bg)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Search size={18} style={{ color: "var(--seed-accent)" }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: "var(--fs-14)", fontWeight: 600, color: "var(--seed-fg)" }}>联网搜索</div>
            <div style={{ fontSize: "var(--fs-11)", color: "var(--seed-muted)", marginTop: 2 }}>让 AI 可以在对话中搜索互联网获取最新信息</div>
          </div>
          <button onClick={toggleEnabled}
            style={{ width: 44, height: 24, borderRadius: 12, border: "none", padding: 0, cursor: "pointer", flexShrink: 0, background: enabled ? "var(--seed-accent)" : "var(--seed-border)", position: "relative", transition: "background 0.2s ease" }}>
            <div style={{ position: "absolute", top: 2, left: enabled ? "calc(100% - 22px)" : "2px", width: 20, height: 20, borderRadius: "50%", background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.2)", transition: "left 0.2s ease" }} />
          </button>
        </div>

        {enabled && (
          <>
            <div style={{ fontSize: "var(--fs-11)", color: "var(--seed-muted)", lineHeight: 1.5, marginBottom: 16, padding: "8px 12px", background: "var(--seed-hover-bg)", borderRadius: 8 }}>
              启用后 AI 在需要时会自动调用联网搜索获取最新信息。选择下方的搜索服务并配置 API Key（DuckDuckGo 免费免配置）。
            </div>

            {/* Provider selector */}
            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: "var(--fs-11)", fontWeight: 500, color: "var(--seed-muted)", display: "block", marginBottom: 6 }}>搜索服务</label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr", gap: 6 }}>
                {PROVIDER_KEYS.map((k) => {
                  const p = SEARCH_PROVIDERS[k];
                  const isActive = provider === k;
                  return (
                    <button key={k} onClick={() => changeProvider(k)}
                      style={{ padding: "8px 4px", borderRadius: 8, cursor: "pointer", fontSize: "var(--fs-11)", fontWeight: 500, textAlign: "center", background: isActive ? "var(--seed-accent-bg)" : "var(--seed-hover-bg)", border: isActive ? "1px solid var(--seed-accent-border)" : "1px solid var(--seed-border)", color: isActive ? "var(--seed-accent)" : "var(--seed-muted)", transition: "all 0.12s" }}>
                      <Wifi size={12} style={{ display: "block", margin: "0 auto 3px", color: isActive ? "var(--seed-accent)" : "var(--seed-muted)" }} />
                      {p.name}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* API Key */}
            {provider !== "duckduckgo" && (
              <div>
                <label style={{ fontSize: "var(--fs-11)", fontWeight: 500, color: "var(--seed-muted)", display: "block", marginBottom: 6 }}>
                  {cfg.keyLabel}
                </label>
                <div style={{ display: "flex", gap: 6 }}>
                  <input value={apiKey} onChange={(e) => changeApiKey(e.target.value)}
                    placeholder={cfg.keyPlaceholder}
                    style={{ flex: 1, padding: "8px 12px", borderRadius: 8, background: "var(--seed-input-bg)", border: "1px solid var(--seed-border)", color: "var(--seed-fg)", fontSize: "var(--fs-12)", fontFamily: "inherit", outline: "none" }} />
                  <a href={cfg.signupUrl} target="_blank" rel="noreferrer"
                    style={{ display: "flex", alignItems: "center", gap: 4, padding: "0 10px", borderRadius: 8, fontSize: "var(--fs-11)", color: "var(--seed-accent)", textDecoration: "none", border: "1px solid var(--seed-accent-border)", background: "var(--seed-accent-bg)", whiteSpace: "nowrap" }}>
                    <ExternalLink size={11} /> 注册
                  </a>
                </div>
                <div style={{ fontSize: "var(--fs-10)", color: "var(--seed-muted)", marginTop: 4 }}>{cfg.docs}</div>
              </div>
            )}

            {provider === "duckduckgo" && (
              <div style={{ padding: "8px 12px", borderRadius: 8, background: "var(--seed-hover-bg)", border: "1px solid var(--seed-border)", fontSize: "var(--fs-11)", color: "var(--seed-muted)" }}>
                DuckDuckGo 无需 API Key，直接可用。结果质量和数量有限，建议使用专用搜索 API 以获得更好的搜索结果。
              </div>
            )}
          </>
        )}
      </div>

      <div style={{ padding: "10px 14px", borderRadius: 8, background: "var(--seed-hover-bg)", border: "1px solid var(--seed-border)", fontSize: "var(--fs-11)", color: "var(--seed-muted)", lineHeight: 1.5 }}>
        <strong style={{ color: "var(--seed-muted)" }}>工作原理：</strong>AI 判断需要搜索时自动调用 web_search 工具，将搜索结果整合到回复中。支持 5 种搜索引擎，可在上方切换。
      </div>
    </div>
  );
}
