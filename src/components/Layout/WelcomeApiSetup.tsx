import { useState } from "react";
import { useProviderStore } from "@/stores/providerStore";
import { PRESETS, PRESET_ORDER, PresetIcon } from "@/components/Settings/ProviderConfig";
import type { ProviderType } from "@/types";

const INPUT_STYLE: React.CSSProperties = {
  width: "100%",
  padding: "9px 14px",
  borderRadius: 12,
  fontSize: 13,
  color: "var(--seed-fg)",
  background: "var(--seed-input-bg)",
  border: "1px solid var(--seed-border)",
  outline: "none",
  transition: "border-color 0.15s",
  boxSizing: "border-box",
};

export function WelcomeApiSetup({
  onBack,
  onSaved,
}: {
  onBack: () => void;
  onSaved: () => void;
}) {
  const { addProvider, setActiveProvider, setActiveModel } = useProviderStore();
  const [name, setName] = useState("");
  const [baseUrl, setBaseUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [modelsText, setModelsText] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testStatus, setTestStatus] = useState<"idle" | "ok" | "fail">("idle");
  const [testMsg, setTestMsg] = useState("");
  const [err, setErr] = useState("");
  const [fetchedModels, setFetchedModels] = useState<string[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [showPicker, setShowPicker] = useState(false);
  const [fetchingModels, setFetchingModels] = useState(false);

  const applyPreset = (type: ProviderType) => {
    if (type === "custom") {
      setName("");
      setBaseUrl("");
      setModelsText("");
      setErr("");
      return;
    }
    const p = PRESETS[type];
    if (!p) return;
    setName(p.name);
    setBaseUrl(p.baseUrl);
    setModelsText(p.models.join("\n"));
    setErr("");
  };

  const parseModels = () =>
    modelsText
      .split(/[\n,，]/)
      .map((m) => m.trim())
      .filter(Boolean);

  const extractModels = (body: string): string[] => {
    try {
      const json = JSON.parse(body);
      if (Array.isArray(json?.data)) {
        return json.data
          .map((m: unknown) => (typeof m === "string" ? m : (m as { id?: unknown })?.id))
          .filter((m: unknown): m is string => typeof m === "string" && m.trim() !== "");
      }
    } catch {
      /* not json */
    }
    return [];
  };

  const requestModels = async (): Promise<{ ok: boolean; body: string }> => {
    const url = `${baseUrl.trim().replace(/\/+$/, "")}/models`;
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const body = await invoke<string>("http_fetch", {
        url,
        method: "GET",
        headers: apiKey.trim() ? { Authorization: `Bearer ${apiKey.trim()}` } : {},
      });
      return { ok: true, body };
    } catch {
      try {
        const res = await fetch(url, {
          method: "GET",
          headers: apiKey.trim() ? { Authorization: `Bearer ${apiKey.trim()}` } : {},
        });
        return { ok: res.ok, body: res.ok ? await res.text() : "" };
      } catch {
        return { ok: false, body: "" };
      }
    }
  };

  const handleTest = async () => {
    setErr("");
    if (!baseUrl.trim()) {
      setTestStatus("fail");
      setTestMsg("请先填写接口地址");
      return;
    }
    setTesting(true);
    setTestStatus("idle");
    try {
      const { ok } = await requestModels();
      setTestStatus(ok ? "ok" : "fail");
      setTestMsg(ok ? "连接成功" : "连接失败，请检查接口地址与密钥");
    } catch {
      setTestStatus("fail");
      setTestMsg("连接失败，请检查接口地址与密钥");
    } finally {
      setTesting(false);
    }
  };

  const handleFetchModels = async () => {
    setErr("");
    if (!baseUrl.trim()) {
      setTestStatus("fail");
      setTestMsg("请先填写接口地址");
      return;
    }
    setFetchingModels(true);
    setTestStatus("idle");
    try {
      const { ok, body } = await requestModels();
      if (!ok) {
        setTestStatus("fail");
        setTestMsg("获取失败，请检查接口地址与密钥");
        return;
      }
      const models = extractModels(body);
      if (!models.length) {
        setTestStatus("fail");
        setTestMsg("未能解析模型列表，请检查接口返回格式");
        return;
      }
      setFetchedModels(models);
      setPicked(new Set(models));
      setShowPicker(true);
    } catch {
      setTestStatus("fail");
      setTestMsg("获取失败，请检查接口地址与密钥");
    } finally {
      setFetchingModels(false);
    }
  };

  const togglePicked = (m: string) => {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(m)) next.delete(m);
      else next.add(m);
      return next;
    });
  };

  const confirmPicked = () => {
    setModelsText([...picked].join("\n"));
    setShowPicker(false);
  };

  const handleSave = () => {
    const n = name.trim();
    const url = baseUrl.trim().replace(/\/+$/, "");
    const key = apiKey.trim();
    const models = parseModels();
    if (!n) return setErr("请填写服务名称");
    if (!url) return setErr("请填写接口地址");
    if (!models.length) return setErr("请至少填写一个模型");
    const newId = crypto.randomUUID();
    addProvider({
      id: newId,
      name: n,
      type: "custom",
      apiKey: key,
      baseUrl: url,
      models,
      supportsImages: false,
      thinkingModels: [],
    });
    setActiveProvider(newId);
    setActiveModel(models[0]);
    onSaved();
  };

  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "0 24px",
      }}
    >
      {/* 固定顶部：返回 + 标题 */}
      <div
        style={{
          position: "relative",
          width: "100%",
          maxWidth: 560,
          flex: "none",
          textAlign: "center",
          paddingTop: 44,
          marginBottom: 8,
        }}
      >
        <button
          onClick={onBack}
          style={{
            position: "absolute",
            left: 0,
            top: 48,
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            padding: "4px 10px",
            fontSize: 12.5,
            background: "transparent",
            border: "none",
            color: "var(--seed-muted)",
            cursor: "pointer",
          }}
        >
          ← 返回
        </button>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "5px 14px",
            background: "var(--seed-accent-bg)",
            border: "1px solid color-mix(in srgb, var(--seed-accent) 15%, transparent)",
            borderRadius: 999,
            fontSize: 11,
            fontWeight: 500,
            color: "var(--seed-accent)",
            letterSpacing: "0.05em",
            textTransform: "uppercase",
            marginBottom: 8,
          }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" />
          </svg>
          AIRP
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-0.02em", color: "var(--seed-fg)", marginBottom: 4, lineHeight: 1.2 }}>
          配置模型服务
        </h1>
        <p style={{ fontSize: 12.5, color: "var(--seed-muted)", maxWidth: 420, margin: "0 auto" }}>
          接入你的 AI 模型服务，测试连接可自动获取模型列表
        </p>
      </div>

      {/* 可滚动内容区 */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          overflowY: "auto",
          padding: "4px 0 0",
        }}
      >
        {/* 快捷预设 */}
        <div style={{ width: "100%", maxWidth: 560, marginBottom: 10 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {PRESET_ORDER.map((type) => (
              <button
                key={type}
                onClick={() => applyPreset(type)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "6px 12px",
                  borderRadius: 999,
                  background: "var(--seed-surface)",
                  border: "1px solid var(--seed-border)",
                  color: "var(--seed-muted)",
                  fontSize: 12,
                  cursor: "pointer",
                  transition: "color 0.15s, border-color 0.15s, background 0.15s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = "var(--seed-fg)";
                  e.currentTarget.style.borderColor = "color-mix(in srgb, var(--seed-accent) 40%, transparent)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = "var(--seed-muted)";
                  e.currentTarget.style.borderColor = "var(--seed-border)";
                }}
              >
                <PresetIcon type={type} size={18} />
                <span>{PRESETS[type].name}</span>
              </button>
            ))}
            <button
              onClick={() => applyPreset("custom")}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "6px 12px",
                borderRadius: 999,
                background: "transparent",
                border: "1px dashed color-mix(in srgb, var(--seed-fg) 15%, transparent)",
                color: "var(--seed-muted)",
                fontSize: 12,
                cursor: "pointer",
                transition: "color 0.15s, border-color 0.15s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = "var(--seed-fg)";
                e.currentTarget.style.borderColor = "color-mix(in srgb, var(--seed-accent) 40%, transparent)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = "var(--seed-muted)";
                e.currentTarget.style.borderColor = "color-mix(in srgb, var(--seed-fg) 15%, transparent)";
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              <span>自定义</span>
            </button>
          </div>
        </div>

        {/* 表单卡片 */}
        <div
          className="seed-card"
          style={{
            width: "100%",
            maxWidth: 560,
            padding: "16px 20px",
            display: "flex",
            flexDirection: "column",
            gap: 10,
            marginBottom: 12,
          }}
        >
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={{ fontSize: 11, color: "var(--seed-muted)" }}>服务名称</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="如：OpenAI、我的中转站"
            style={INPUT_STYLE}
          />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={{ fontSize: 11, color: "var(--seed-muted)" }}>接口地址（Base URL）</label>
          <input
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="https://api.example.com/v1"
            style={INPUT_STYLE}
          />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <label style={{ fontSize: 11, color: "var(--seed-muted)" }}>API Key</label>
          <div style={{ position: "relative" }}>
            <input
              type={showKey ? "text" : "password"}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-..."
              style={{ ...INPUT_STYLE, paddingRight: 44 }}
            />
            <button
              onClick={() => setShowKey((v) => !v)}
              style={{
                position: "absolute",
                right: 8,
                top: "50%",
                transform: "translateY(-50%)",
                width: 30,
                height: 30,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "transparent",
                border: "none",
                color: "var(--seed-muted)",
                cursor: "pointer",
              }}
              data-tooltip={showKey ? "隐藏" : "显示"}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                {showKey ? (
                  <>
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </>
                ) : (
                  <>
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </>
                )}
              </svg>
            </button>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <label style={{ fontSize: 11, color: "var(--seed-muted)" }}>模型列表（每行一个）</label>
            <button
              onClick={handleFetchModels}
              disabled={fetchingModels}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                padding: "2px 10px",
                borderRadius: 999,
                background: "var(--seed-accent-bg)",
                border: "1px solid color-mix(in srgb, var(--seed-accent) 15%, transparent)",
                color: "var(--seed-accent)",
                fontSize: 11,
                cursor: fetchingModels ? "default" : "pointer",
                opacity: fetchingModels ? 0.6 : 1,
              }}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12a9 9 0 1 1-2.64-6.36" />
                <polyline points="21 3 21 9 15 9" />
              </svg>
              {fetchingModels ? "获取中..." : "获取模型"}
            </button>
          </div>
          <textarea
            value={modelsText}
            onChange={(e) => setModelsText(e.target.value)}
            placeholder={"gpt-4o\ngpt-4o-mini"}
            rows={3}
            style={{ ...INPUT_STYLE, resize: "none", lineHeight: 1.5 }}
          />
        </div>

        {err && (
          <div style={{ fontSize: 12, color: "var(--danger, #ef4444)" }}>{err}</div>
        )}
      </div>

        {/* 固定底部操作栏：任意窗口高度下都可见 */}
        <div
          style={{
            position: "sticky",
            bottom: 0,
            width: "100%",
            maxWidth: 560,
            padding: "10px 0 16px",
            background: "var(--seed-bg)",
          }}
        >
          {testStatus !== "idle" && (
            <span
              style={{
                display: "block",
                fontSize: 12,
                marginBottom: 8,
                color: testStatus === "ok" ? "var(--success, #22c55e)" : "var(--danger, #ef4444)",
              }}
            >
              {testStatus === "ok" ? "✓ " : "✗ "}
              {testMsg}
            </span>
          )}
          <div style={{ display: "flex", gap: 10 }}>
            <button
              className="seed-btn-secondary"
              onClick={handleTest}
              disabled={testing}
              style={{ padding: "9px 20px", fontSize: 13, flex: 1 }}
            >
              {testing ? "测试中..." : "测试连接"}
            </button>
          <button
            className="seed-btn-primary"
            onClick={handleSave}
            style={{ padding: "9px 20px", fontSize: 13.5, flex: 1.6 }}
          >
            保存并继续
          </button>
          </div>
        </div>
      </div>

      {showPicker && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 6000,
            background: "rgba(0, 0, 0, 0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          onClick={() => setShowPicker(false)}
        >
          <div
            className="seed-card"
            style={{
              width: "calc(100% - 48px)",
              maxWidth: 440,
              maxHeight: "70vh",
              display: "flex",
              flexDirection: "column",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "16px 20px 10px",
              }}
            >
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--seed-fg)" }}>
                选择模型
              </div>
              <span style={{ fontSize: 11, color: "var(--seed-muted)" }}>
                已选 {picked.size}/{fetchedModels.length}
              </span>
            </div>
            <div
              style={{
                flex: 1,
                minHeight: 0,
                overflowY: "auto",
                padding: "4px 12px",
                display: "flex",
                flexDirection: "column",
                gap: 2,
              }}
            >
              {fetchedModels.map((m) => (
                <label
                  key={m}
                  onClick={() => togglePicked(m)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "6px 8px",
                    borderRadius: 8,
                    fontSize: 12.5,
                    color: "var(--seed-fg)",
                    cursor: "pointer",
                    background: picked.has(m) ? "var(--seed-accent-bg)" : "transparent",
                    border: picked.has(m)
                      ? "1px solid color-mix(in srgb, var(--seed-accent) 30%, transparent)"
                      : "1px solid transparent",
                    transition: "background 0.12s, border-color 0.12s",
                  }}
                  onMouseEnter={(e) => {
                    if (!picked.has(m)) e.currentTarget.style.background = "var(--seed-hover-bg)";
                  }}
                  onMouseLeave={(e) => {
                    if (!picked.has(m)) e.currentTarget.style.background = "transparent";
                  }}
                >
                  <span
                    style={{
                      width: 16,
                      height: 16,
                      borderRadius: 4,
                      flex: "none",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: picked.has(m) ? "var(--seed-accent)" : "transparent",
                      border: picked.has(m) ? "none" : "1.5px solid var(--seed-border)",
                      color: "#fff",
                      transition: "background 0.12s, border-color 0.12s",
                    }}
                  >
                    {picked.has(m) && (
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </span>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {m}
                  </span>
                </label>
              ))}
            </div>
            <div style={{ display: "flex", gap: 10, padding: "12px 20px 16px" }}>
              <button
                className="seed-btn-secondary"
                onClick={() => {
                  const all = picked.size === fetchedModels.length;
                  setPicked(all ? new Set() : new Set(fetchedModels));
                }}
                style={{ padding: "8px 16px", fontSize: 12.5, flex: 1 }}
              >
                {picked.size === fetchedModels.length ? "全不选" : "全选"}
              </button>
              <button
                className="seed-btn-secondary"
                onClick={() => setShowPicker(false)}
                style={{ padding: "8px 16px", fontSize: 12.5, flex: 1 }}
              >
                取消
              </button>
              <button
                className="seed-btn-primary"
                onClick={confirmPicked}
                style={{ padding: "8px 16px", fontSize: 12.5, flex: 1.5 }}
              >
                确定（{picked.size}）
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
