import { useState } from "react";
import { Server, Plus, Trash2, Play, Square, RefreshCw, ExternalLink, ChevronDown, ChevronRight } from "lucide-react";
import { useMcpStore } from "@/stores/mcpStore";
import { useUIStore } from "@/stores/uiStore";
import { healthCheck, listTools } from "@/lib/mcpClient";
import type { McpTool } from "@/types";

interface McpPanelProps {
  onClose?: () => void;
}

export function McpPanel({ onClose }: McpPanelProps) {
  const { servers, activeServerIds, addServer, updateServer, removeServer, setServerStatus, setActiveServers } = useMcpStore();
  const { setMcpActive } = useUIStore();
  const [showForm, setShowForm] = useState(false);
  const [expandedServer, setExpandedServer] = useState<string | null>(null);
  const [serverTools, setServerTools] = useState<Record<string, McpTool[]>>({});
  const [testing, setTesting] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, boolean>>({});

  const [formName, setFormName] = useState("");
  const [formUrl, setFormUrl] = useState("");
  const [formTransport, setFormTransport] = useState<"http" | "sse" | "stdio">("http");
  const [formHeaders, setFormHeaders] = useState("");

  const handleAdd = async () => {
    if (!formName.trim() || !formUrl.trim()) return;
    let parsedConfig: Record<string, unknown> = {};
    if (formHeaders.trim()) {
      try {
        parsedConfig = JSON.parse(formHeaders.trim());
      } catch {
        parsedConfig = { headers: formHeaders.trim() };
      }
    }
    await addServer({
      id: crypto.randomUUID(),
      name: formName.trim(),
      url: formUrl.trim(),
      transportType: formTransport,
      config: parsedConfig,
    });
    setFormName("");
    setFormUrl("");
    setFormTransport("http");
    setFormHeaders("");
    setShowForm(false);
  };

  const handleTest = async (id: string) => {
    const server = servers.find((s) => s.id === id);
    if (!server) return;
    setTesting(id);
    setTestResults((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    let ok = false;
    try {
      // Primary: listTools endpoint
      await listTools(server.url);
      ok = true;
    } catch {
      // Fallback: server health check
      ok = await healthCheck(server.url).catch(() => false);
    }
    setTestResults((prev) => ({ ...prev, [id]: ok }));
    if (activeServerIds.includes(id)) {
      setServerStatus(id, ok ? "connected" : "error");
    }
    setTimeout(() => setTestResults((prev) => {
      const n = { ...prev };
      delete n[id];
      return n;
    }), 5000);
    setTesting(null);
  };

  const handleFetchTools = async (id: string) => {
    const server = servers.find((s) => s.id === id);
    if (!server) return;
    try {
      const tools = await listTools(server.url);
      setServerTools((prev) => ({ ...prev, [id]: tools }));
      setExpandedServer(id);
    } catch {
      setServerTools((prev) => ({ ...prev, [id]: [] }));
    }
  };

  const toggleActive = async (id: string) => {
    const server = servers.find((s) => s.id === id);
    if (!server) return;
    const isActive = activeServerIds.includes(id);
    let nextIds: string[];
    if (isActive) {
      nextIds = activeServerIds.filter((x) => x !== id);
      setActiveServers(nextIds);
      setServerStatus(id, "disconnected");
    } else {
      nextIds = [...activeServerIds, id];
      setActiveServers(nextIds);
      // Primary check: listTools - if it returns tools, server is fully working
      let ok = false;
      try {
        const tools = await listTools(server.url);
        ok = true;
        setServerTools((prev) => ({ ...prev, [id]: tools }));
      } catch {
        // Fallback: healthCheck (server reachable but may use different endpoints)
        ok = await healthCheck(server.url).catch(() => false);
      }
      setServerStatus(id, ok ? "connected" : "error");
    }
    setMcpActive(nextIds.length > 0);
    const { setAppSetting } = await import("@/lib/db");
    await setAppSetting("mcp_active_server_ids", JSON.stringify(nextIds));
  };

  const toggleServerExpand = (id: string) => {
    if (expandedServer === id) {
      setExpandedServer(null);
    } else {
      setExpandedServer(id);
      if (!serverTools[id]) {
        handleFetchTools(id);
      }
    }
  };

  return (
    <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: 12, flex: 1, minHeight: 0 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Server size={16} style={{ color: "var(--seed-accent)" }} />
          <span style={{ fontSize: "var(--fs-15)", fontWeight: 600, color: "var(--seed-fg)" }}>MCP 服务器</span>
          <span className="seed-tag-pill" style={{ fontSize: "var(--fs-10)", padding: "1px 7px" }}>{servers.length}</span>
        </div>
        {servers.length > 0 && (
          <button onClick={() => setShowForm(!showForm)} className="seed-btn-secondary" style={{ padding: "6px 14px", fontSize: "var(--fs-11)" }}>
            <Plus size={12} /> 添加服务器
          </button>
        )}
      </div>

      <div style={{ fontSize: "var(--fs-11)", color: "var(--seed-muted)", lineHeight: 1.5, maxWidth: 560 }}>
        添加 MCP 服务器后，AI 可在对话中调用外部工具与数据服务。
      </div>

      {showForm && (
        <div style={{ padding: 14, background: "var(--seed-surface)", borderRadius: 16, border: "1px solid var(--seed-border)", display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="服务器名称（如：文件管理）"
              style={{ flex: 1, padding: "9px 12px", borderRadius: 12, background: "var(--seed-input-bg)", border: "1px solid var(--seed-border)", color: "var(--seed-fg)", fontSize: "var(--fs-12)", fontFamily: "inherit", outline: "none" }}
            />
            <select
              value={formTransport}
              onChange={(e) => setFormTransport(e.target.value as "http" | "sse" | "stdio")}
              style={{ padding: "9px 10px", borderRadius: 12, background: "var(--seed-input-bg)", border: "1px solid var(--seed-border)", color: "var(--seed-fg)", fontSize: "var(--fs-12)", fontFamily: "inherit", outline: "none" }}
            >
              <option value="http">HTTP</option>
              <option value="sse">SSE</option>
              <option value="stdio">Stdio</option>
            </select>
          </div>
          <input
            value={formUrl}
            onChange={(e) => setFormUrl(e.target.value)}
            placeholder="服务器地址（如：http://localhost:3000）"
            style={{ width: "100%", padding: "9px 12px", borderRadius: 12, background: "var(--seed-input-bg)", border: "1px solid var(--seed-border)", color: "var(--seed-fg)", fontSize: "var(--fs-12)", fontFamily: "inherit", outline: "none" }}
          />
          <textarea
            value={formHeaders}
            onChange={(e) => setFormHeaders(e.target.value)}
            placeholder="Headers（JSON 格式，可选）"
            style={{ width: "100%", padding: "9px 12px", borderRadius: 12, background: "var(--seed-input-bg)", border: "1px solid var(--seed-border)", color: "var(--seed-fg)", fontSize: "var(--fs-11)", minHeight: 50, resize: "vertical", outline: "none", fontFamily: "ui-monospace, monospace" }}
          />
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button onClick={() => { setShowForm(false); setFormName(""); setFormUrl(""); setFormHeaders(""); }} className="seed-btn-secondary" style={{ padding: "6px 14px", fontSize: "var(--fs-12)" }}>
              取消
            </button>
            <button onClick={handleAdd} disabled={!formName.trim() || !formUrl.trim()} className="seed-btn-primary" style={{ padding: "6px 16px", fontSize: "var(--fs-12)" }}>
              添加
            </button>
          </div>
        </div>
      )}

      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
        {servers.length === 0 && (
          <div className="seed-empty-state" style={{ flex: 1, background: "var(--seed-surface)", borderRadius: 18, border: "1px solid var(--seed-border)" }}>
            <div className="seed-empty-icon">
              <Server size={28} style={{ color: "var(--seed-accent)" }} />
            </div>
            <div className="seed-empty-title">还没有 MCP 服务器</div>
            <div className="seed-empty-sub">连接外部工具服务，扩展 AI 的能力边界</div>
            <button className="seed-btn-primary" onClick={() => setShowForm(true)}>
              <Plus size={13} /> 添加 MCP 服务器
            </button>
          </div>
        )}

        {servers.map((server) => {
          const isActive = activeServerIds.includes(server.id);
          const isExpanded = expandedServer === server.id;
          const tools = serverTools[server.id] || [];
          const testingThis = testing === server.id;
          const testOk = testResults[server.id];

          return (
            <div key={server.id} style={{ padding: 14, background: "var(--seed-surface)", borderRadius: 16, border: isActive ? "1px solid var(--seed-accent-border)" : "1px solid var(--seed-border)", transition: "border-color 0.15s ease" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                  <button onClick={() => toggleServerExpand(server.id)} className="cp"
                    style={{ width: 18, height: 18, padding: 0, borderRadius: 4, background: "transparent", border: "none", color: "var(--seed-muted)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                  </button>
                  <span style={{ fontSize: "var(--fs-13)", fontWeight: 600, color: "var(--seed-fg)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {server.name}
                  </span>
                  <span style={{ fontSize: "var(--fs-10)", padding: "1px 5px", borderRadius: 3, background: "var(--seed-hover-bg)", color: "var(--seed-muted)" }}>
                    {server.transportType.toUpperCase()}
                  </span>
                  {server.status === "connected" && <span style={{ fontSize: "var(--fs-10)", color: "var(--success)" }}>●</span>}
                  {server.status === "error" && <span style={{ fontSize: "var(--fs-10)", color: "var(--danger)" }}>●</span>}
                  {server.status === "disconnected" && <span style={{ fontSize: "var(--fs-10)", color: "var(--seed-muted)" }}>○</span>}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <button
                    onClick={() => toggleActive(server.id)}
                    className="cp"
                    style={{
                      display: "flex", alignItems: "center", gap: 3,
                      padding: "3px 10px", borderRadius: 5,
                      fontSize: "var(--fs-10)", fontWeight: 500,
                      background: isActive ? "var(--seed-accent-bg)" : "transparent",
                      color: isActive ? "var(--seed-accent)" : "var(--seed-muted)",
                      border: isActive ? "1px solid var(--seed-accent-border)" : "1px solid var(--seed-border)",
                      transition: "all 0.15s ease",
                    }}
                  >
                    {isActive ? <Square size={9} /> : <Play size={9} />}
                    {isActive ? "已启用" : "启用"}
                  </button>
                  <button
                    onClick={() => handleTest(server.id)}
                    className="cp"
                    title="测试连接"
                    style={{ width: 24, height: 24, borderRadius: 5, background: "transparent", color: "var(--seed-muted)", border: "1px solid var(--seed-border)", display: "flex", alignItems: "center", justifyContent: "center" }}
                  >
                    <RefreshCw size={11} style={{ animation: testingThis ? "spin 1s linear infinite" : "none" }} />
                  </button>
                  <button
                    onClick={() => removeServer(server.id)}
                    className="cp"
                    title="删除"
                    style={{ width: 24, height: 24, borderRadius: 5, background: "transparent", color: "var(--seed-muted)", border: "1px solid var(--seed-border)", display: "flex", alignItems: "center", justifyContent: "center" }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = "var(--danger)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = "var(--seed-muted)"; }}
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              </div>

              <div style={{ fontSize: "var(--fs-11)", color: "var(--seed-muted)", display: "flex", alignItems: "center", gap: 4, marginBottom: 6, overflow: "hidden", textOverflow: "ellipsis" }}>
                <ExternalLink size={9} />
                <span style={{ fontFamily: "ui-monospace, monospace" }}>{server.url}</span>
              </div>

              {testResults[server.id] !== undefined && (
                <div style={{ fontSize: "var(--fs-10)", color: testOk ? "var(--success)" : "var(--danger)", marginBottom: 6 }}>
                  {testOk ? "✓ 连接成功" : "✗ 连接失败"}
                </div>
              )}

              {isExpanded && (
                <div style={{ padding: "8px", background: "var(--seed-hover-bg)", borderRadius: 6, marginTop: 4 }}>
                  <div style={{ fontSize: "var(--fs-11)", fontWeight: 600, color: "var(--seed-muted)", marginBottom: 6 }}>
                    可用工具 ({tools.length})
                  </div>
                  {tools.length === 0 ? (
                    <div style={{ fontSize: "var(--fs-11)", color: "var(--seed-muted)" }}>
                      {testingThis ? "加载中..." : "暂无可用工具"}
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      {tools.map((tool) => (
                        <div key={tool.name} style={{ padding: "6px 8px", background: "var(--seed-surface)", borderRadius: 5, border: "1px solid var(--seed-border)" }}>
                          <div style={{ fontSize: "var(--fs-11)", fontWeight: 600, color: "var(--seed-fg)", fontFamily: "ui-monospace, monospace", marginBottom: 2 }}>
                            {tool.name}
                          </div>
                          {tool.description && (
                            <div style={{ fontSize: "var(--fs-10)", color: "var(--seed-muted)", lineHeight: 1.3 }}>
                              {tool.description}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ fontSize: "var(--fs-10)", color: "var(--seed-muted)", opacity: 0.8, lineHeight: 1.5, textAlign: "center" }}>
        提示：启用后 AI 可在对话中自动调用可用工具，需要模型支持 Function Calling
      </div>
    </div>
  );
}