import { useMemo, useState } from "react";
import { useProviderStore } from "@/stores/providerStore";
import { usePromptInjectionStore } from "@/stores/promptInjectionStore";
import type { PromptInjection } from "@/types";

function InjectionCard({ item }: { item: PromptInjection }) {
  const { providers } = useProviderStore();
  const { updateItem, removeItem } = usePromptInjectionStore();
  const locked = item.applied;

  const allModels = useMemo(
    () => Array.from(new Set(providers.flatMap((p) => p.models))).filter(Boolean),
    [providers],
  );

  const toggleModel = (m: string) => {
    if (locked) return;
    const next = item.modelIds.includes(m)
      ? item.modelIds.filter((x) => x !== m)
      : [...item.modelIds, m];
    updateItem(item.id, { modelIds: next });
  };

  return (
    <div
      style={{
        padding: "16px 18px",
        borderRadius: 18,
        background: "var(--seed-surface)",
        border: "1px solid " + (locked ? "var(--seed-accent-border)" : "var(--seed-border)"),
        display: "flex",
        flexDirection: "column",
        gap: 12,
        opacity: locked ? 0.95 : 1,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {locked ? (
          <span className="seed-tag-pill" style={{ background: "var(--seed-accent-bg)", color: "var(--seed-accent)" }}>
            已应用
          </span>
        ) : (
          <span className="seed-tag-pill">编辑中</span>
        )}
        <span style={{ fontSize: 12, color: "var(--seed-muted)" }}>
          {item.modelIds.length === 0 ? "绑定：全部模型" : `绑定：${item.modelIds.length} 个模型`}
        </span>
      </div>

      <textarea
        value={item.text}
        onChange={(e) => updateItem(item.id, { text: e.target.value })}
        disabled={locked}
        rows={3}
        placeholder="输入要注入到提示词最开头的文本，例如：请始终用简洁中文回答，遇到不确定内容先说明不确定性。"
        style={{
          width: "100%",
          padding: "10px 14px",
          borderRadius: 12,
          fontSize: 13,
          lineHeight: 1.6,
          color: "var(--seed-fg)",
          background: locked ? "var(--seed-hover-bg)" : "var(--seed-input-bg)",
          border: "1px solid var(--seed-border)",
          outline: "none",
          resize: "vertical",
          cursor: locked ? "not-allowed" : "text",
          opacity: locked ? 0.75 : 1,
        }}
      />

      <div>
        <div style={{ fontSize: 12, color: "var(--seed-muted)", marginBottom: 8 }}>
          绑定模型（可多选，不选 = 全部模型）
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {allModels.map((m) => {
            const on = item.modelIds.includes(m);
            return (
              <button
                key={m}
                onClick={() => toggleModel(m)}
                disabled={locked}
                style={{
                  padding: "4px 12px",
                  borderRadius: 999,
                  fontSize: 12,
                  cursor: locked ? "not-allowed" : "pointer",
                  background: on ? "var(--seed-accent-bg)" : "var(--seed-hover-bg)",
                  border: "1px solid " + (on ? "var(--seed-accent-border)" : "var(--seed-border)"),
                  color: on ? "var(--seed-accent)" : "var(--seed-muted)",
                  fontWeight: on ? 600 : 400,
                }}
              >
                {m}
              </button>
            );
          })}
          {allModels.length === 0 && (
            <span style={{ fontSize: 12, color: "var(--seed-muted)" }}>暂无可绑定模型（未配置模型服务）</span>
          )}
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
        {locked ? (
          <button
            className="seed-btn-secondary"
            onClick={() => updateItem(item.id, { applied: false })}
            style={{ padding: "6px 14px", fontSize: 12 }}
          >
            解除锁定
          </button>
        ) : (
          <button
            className="seed-btn-primary"
            onClick={() => updateItem(item.id, { applied: true })}
            disabled={!item.text.trim()}
            style={{ padding: "6px 14px", fontSize: 12 }}
          >
            应用
          </button>
        )}
        <button
          className="seed-btn-secondary"
          onClick={() => removeItem(item.id)}
          style={{ padding: "6px 14px", fontSize: 12, color: "var(--danger, #ef4444)" }}
        >
          删除
        </button>
      </div>
    </div>
  );
}

export function PromptInjectionSection() {
  const { items, addItem } = usePromptInjectionStore();
  const { providers, activeModel } = useProviderStore();

  const allModels = useMemo(
    () => Array.from(new Set(providers.flatMap((p) => p.models))).filter(Boolean),
    [providers],
  );

  const handleAdd = () => {
    const presetModels = activeModel && allModels.includes(activeModel) ? [activeModel] : [];
    addItem("", presetModels);
  };

  return (
    <div style={{ marginTop: 20, paddingBottom: 8 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--seed-accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
        </svg>
        <span style={{ fontSize: 15, fontWeight: 600, color: "var(--seed-fg)" }}>模型提示词注入</span>
      </div>
      <div style={{ fontSize: 12, color: "var(--seed-muted)", lineHeight: 1.7, marginBottom: 14 }}>
        为指定的模型在每次请求的提示词最开头（角色设定之前）注入额外文本。可创建多条注入词，分别绑定不同的模型；点「应用」锁定后生效，解除锁定后重新编辑。
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {items.map((item) => (
          <InjectionCard key={item.id} item={item} />
        ))}
      </div>

      <button
        className="seed-btn-secondary"
        onClick={handleAdd}
        style={{ marginTop: 14, padding: "8px 18px", fontSize: 13, display: "inline-flex", alignItems: "center", gap: 6 }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        添加注入词
      </button>
    </div>
  );
}
