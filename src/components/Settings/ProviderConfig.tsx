import { useState, useRef, useEffect, useMemo } from "react";
import { useProviderStore } from "@/stores/providerStore";
import { useUIStore } from "@/stores/uiStore";
import { fetchAvailableModels } from "@/providers/openai";
import {
  Plus, Trash2, Eye, EyeOff, Sparkles, Download, Check, ChevronDown, ChevronLeft,
  Server, Brain, Users, Globe, Search, Bot, Settings2, Zap, Wrench, Shield, Cpu,
  Wifi, Loader2, Code2, Filter, Image, Cog, ChevronRight, Pencil, X,
} from "lucide-react";
import type { ProviderType } from "@/types";
import { McpPanel } from "./McpPanel";
import { CharacterPanel } from "./CharacterPanel";
import { WorldPanel } from "./WorldPanel";
import { ToolsPanel } from "./ToolsPanel";

type NavKey = "models" | "character" | "world" | "mcp" | "tools";
type ConnectionStatus = "unknown" | "checking" | "online" | "offline" | "invalid_key";

const NAV_ITEMS: { key: NavKey; icon: React.ComponentType<{ size?: number }>; label: string }[] = [
  { key: "models", icon: Sparkles, label: "模型服务" },
  { key: "character", icon: Users, label: "角色" },
  { key: "world", icon: Globe, label: "世界观" },
  { key: "tools", icon: Search, label: "工具" },
  { key: "mcp", icon: Server, label: "MCP 服务器" },
];

const NAV_LABELS: Record<NavKey, string> = {
  models: "模型服务", character: "角色", world: "世界观", mcp: "MCP 服务器", tools: "工具",
};

const PRESETS: Record<string, { name: string; baseUrl: string; models: string[]; supportsImages: boolean; thinkingModels: string[]; color: string }> = {
  openai: { name: "OpenAI", baseUrl: "https://api.openai.com/v1", models: ["gpt-4o", "gpt-4o-mini"], supportsImages: true, thinkingModels: [], color: "#10a37f" },
  deepseek: { name: "DeepSeek", baseUrl: "https://api.deepseek.com/v1", models: ["deepseek-chat", "deepseek-reasoner"], supportsImages: false, thinkingModels: ["deepseek-reasoner"], color: "#4f46e5" },
  anthropic: { name: "Anthropic", baseUrl: "https://api.anthropic.com/v1", models: ["claude-3-5-sonnet-latest", "claude-3-5-haiku-latest", "claude-3-opus-latest"], supportsImages: true, thinkingModels: [], color: "#e879f9" },
  google: { name: "Google", baseUrl: "https://generativelanguage.googleapis.com/v1beta", models: ["gemini-2.5-pro-exp", "gemini-2.0-flash-exp"], supportsImages: true, thinkingModels: [], color: "#ef4444" },
  moonshot: { name: "Moonshot", baseUrl: "https://api.moonshot.cn/v1", models: ["moonshot-v1-8k", "moonshot-v1-32k", "moonshot-v1-128k"], supportsImages: false, thinkingModels: [], color: "#f97316" },
  dashscope: { name: "DashScope", baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1", models: ["qwen-plus", "qwen-max", "qwen-turbo"], supportsImages: true, thinkingModels: [], color: "#0ea5e9" },
  zhipuai: { name: "ZhipuAI", baseUrl: "https://open.bigmodel.cn/api/paas/v4", models: ["glm-4", "glm-4-flash", "glm-3-turbo"], supportsImages: false, thinkingModels: [], color: "#8b5cf6" },
  openrouter: {
    name: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    models: [
      "openrouter/auto",
      "openai/gpt-4o",
      "openai/gpt-4o-mini",
      "anthropic/claude-3.5-sonnet",
      "deepseek/deepseek-chat",
      "google/gemini-2.5-flash",
      "meta-llama/llama-3.3-70b-instruct"
    ],
    supportsImages: true,
    thinkingModels: [],
    color: "#f59e0b"
  },
  opencode: {
    name: "OpenCode Zen",
    baseUrl: "https://opencode.ai/zen/v1",
    models: [
      "gpt-5.5",
      "gpt-5.4-pro",
      "gpt-5.3-codex",
      "claude-opus-5",
      "claude-sonnet-5",
      "claude-sonnet-4.6",
      "gemini-3.6-flash",
      "deepseek-v4-pro",
      "deepseek-v4-flash",
      "kimi-k3",
      "qwen3.7-max"
    ],
    supportsImages: true,
    thinkingModels: ["gpt-5.5", "gpt-5.4-pro", "claude-opus-5", "deepseek-v4-pro"],
    color: "#06b6d4"
  },
  custom: { name: "自定义", baseUrl: "", models: [], supportsImages: false, thinkingModels: [], color: "#6b7280" },
};

const PRESET_ORDER: ProviderType[] = ["openai", "deepseek", "anthropic", "google", "moonshot", "dashscope", "zhipuai", "openrouter", "opencode"];

const PRESET_ICONS: Record<string, React.ComponentType<{ size?: number; style?: React.CSSProperties }>> = {
  openai: Bot,
  deepseek: Brain,
  anthropic: Shield,
  google: Cpu,
  moonshot: Zap,
  dashscope: Settings2,
  zhipuai: Sparkles,
  openrouter: Globe,
  opencode: Code2,
  custom: Wrench,
};

function PresetIcon({ type, size = 28, selected = false }: { type: ProviderType; size?: number; selected?: boolean }) {
  const Icon = PRESET_ICONS[type] || Server;
  const bg = selected ? 'var(--accent-bg)' : 'var(--bg-elevated)';
  const color = selected ? 'var(--accent)' : 'var(--text-secondary)';
  const iconSize = Math.round(size * 0.55);
  return (
    <div style={{
      width: size, height: size, borderRadius: Math.round(size * 0.28),
      background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
    }}>
      <Icon size={iconSize} style={{ color }} />
    </div>
  );
}

function StatusDot({ status }: { status: ConnectionStatus }) {
  if (status === "checking") {
    return <Loader2 size={10} style={{ color: "#f59e0b", animation: "spin 1s linear infinite" }} />;
  }
  const colorMap: Record<string, string> = {
    unknown: "#9ca3af",
    online: "#22c55e",
    offline: "#ef4444",
    invalid_key: "#f59e0b",
  };
  const c = colorMap[status] || "#9ca3af";
  return (
    <div style={{
      width: 8, height: 8, borderRadius: "50%", background: c,
      boxShadow: status === "online" ? "0 0 8px #22c55e" : status === "offline" ? "0 0 8px #ef4444" : status === "invalid_key" ? "0 0 8px #f59e0b" : "none",
    }} />
  );
}

function CustomSelect<T extends string>({
  value, onChange, options, placeholder, disabled,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  placeholder?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (ref.current && !ref.current.contains(target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const current = options.find((o) => o.value === value);

  return (
    <div ref={ref} style={{ position: 'relative', flex: 1, minWidth: 0 }}>
      <button
        type='button' disabled={disabled} onClick={() => setOpen(!open)}
        className='w-full flex items-center justify-between'
        style={{
          appearance: 'none', WebkitAppearance: 'none', height: 32, padding: '0 12px',
          borderRadius: 10, background: 'var(--bg-input)', border: '1px solid var(--border-light)',
          color: current ? 'var(--text-primary)' : 'var(--text-muted)', fontSize: 'var(--fs-12)',
          opacity: disabled ? 0.4 : 1, cursor: disabled ? 'not-allowed' : 'pointer', transition: 'border-color 0.15s',
        }}
      >
        <span className='truncate'>{current?.label ?? placeholder ?? '选择...'}</span>
        <ChevronDown size={12} style={{ flexShrink: 0, opacity: 0.4, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
      </button>
      {open && !disabled && (
        <div style={{
          position: 'absolute', bottom: 'calc(100% + 6px)', left: 0, right: 0,
          background: 'var(--bg-dropdown)', border: 'none', borderRadius: 10,
          boxShadow: '0 4px 16px rgba(0,0,0,0.12)', zIndex: 999,
          maxHeight: 200, overflowY: 'auto', padding: 4,
        }}>
          {options.length === 0 && <div className='text-11 txt-muted text-center py-2'>无选项</div>}
          {options.map((o) => (
            <button key={o.value}
              onClick={() => { onChange(o.value); setOpen(false); }}
              className='w-full text-left flex items-center justify-between'
              style={{
                appearance: 'none', WebkitAppearance: 'none', border: 'none',
                background: o.value === value ? 'var(--accent-bg)' : 'transparent',
                color: o.value === value ? 'var(--accent)' : 'var(--text-primary)',
                padding: '6px 10px', fontSize: 'var(--fs-12)', borderRadius: 6,
                width: '100%', textAlign: 'left', cursor: 'pointer',
              }}
            >
              <span className='truncate'>{o.label}</span>
              {o.value === value && <Check size={12} style={{ flexShrink: 0, marginLeft: 6 }} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function Toggle({ checked, onChange, size = 'md' }: { checked: boolean; onChange: () => void; size?: 'sm' | 'md' }) {
  const w = size === 'sm' ? 36 : 44;
  const h = size === 'sm' ? 20 : 24;
  const d = size === 'sm' ? 16 : 20;
  const top = size === 'sm' ? 2 : 2;
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onChange(); }}
      className='cp tr-all'
      style={{
        width: w, height: h, borderRadius: h / 2, border: 'none', padding: 0,
        background: checked ? 'var(--accent)' : 'var(--border-medium)', position: 'relative',
        flexShrink: 0, transition: 'background 0.2s ease', cursor: 'pointer',
      }}
    >
      <div style={{
        position: 'absolute', top, left: checked ? `calc(100% - ${d + top}px)` : top,
        width: d, height: d, borderRadius: '50%', background: '#fff',
        boxShadow: '0 1px 3px rgba(0,0,0,0.2)', transition: 'left 0.2s ease',
      }} />
    </button>
  );
}

function ModelsSection() {
  const {
    providers, addProvider, removeProvider, updateProvider,
    activeProviderId, setActiveProvider, activeModel, setActiveModel,
    enabledProviders, setEnabledProvider, initEnabledProviders,
  } = useProviderStore();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showKey, setShowKey] = useState<Record<string, boolean>>({});
  const [fetching, setFetching] = useState<Record<string, boolean>>({});
  const [fetchError, setFetchError] = useState<Record<string, string>>({});
  const [fetchedModels, setFetchedModels] = useState<Record<string, string[]>>({});
  const [connectionStatus, setConnectionStatus] = useState<Record<string, ConnectionStatus>>({});
  const [connectionMsg, setConnectionMsg] = useState<Record<string, string>>({});
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!selectedId && providers.length > 0) {
      setSelectedId(providers[0].id);
    }
  }, [providers, selectedId]);

  useEffect(() => {
    initEnabledProviders(providers);
  }, [providers.length]);

  const addPreset = (type: ProviderType) => {
    const p = PRESETS[type];
    const newId = crypto.randomUUID();
    addProvider({
      id: newId, type, name: p.name,
      apiKey: '', baseUrl: p.baseUrl, models: [...p.models],
      supportsImages: p.supportsImages,
      thinkingModels: [...p.thinkingModels],
    });
    setSelectedId(newId);
    setActiveProvider(newId);
    setConnectionStatus((s) => ({ ...s, [newId]: 'unknown' }));
  };

  const testConnection = async (providerId: string) => {
    const p = providers.find((pp) => pp.id === providerId);
    if (!p) return;
    if (!p.baseUrl) {
      setConnectionStatus((s) => ({ ...s, [providerId]: 'offline' }));
      setConnectionMsg((s) => ({ ...s, [providerId]: '请先填写接口地址' }));
      return;
    }
    setConnectionStatus((s) => ({ ...s, [providerId]: 'checking' }));
    setConnectionMsg((s) => ({ ...s, [providerId]: '检测中...' }));
    try {
      const url = `${p.baseUrl.replace(/\/+$/, '')}/models`;
      let ok = false;
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        await invoke("http_fetch", {
          url,
          method: "GET",
          headers: p.apiKey ? { Authorization: `Bearer ${p.apiKey}` } : {},
        });
        ok = true;
      } catch {
        const res = await fetch(url, {
          method: "GET",
          headers: p.apiKey ? { Authorization: `Bearer ${p.apiKey}` } : {},
        });
        ok = res.ok;
      }
      if (ok) {
        setConnectionStatus((s) => ({ ...s, [providerId]: 'online' }));
        setConnectionMsg((s) => ({ ...s, [providerId]: '连接正常' }));
      } else {
        setConnectionStatus((s) => ({ ...s, [providerId]: 'offline' }));
        setConnectionMsg((s) => ({ ...s, [providerId]: '无法连接' }));
      }
    } catch {
      setConnectionStatus((s) => ({ ...s, [providerId]: 'offline' }));
      setConnectionMsg((s) => ({ ...s, [providerId]: '无法连接到服务器' }));
    }
  };

  const handleFetchModels = async (providerId: string) => {
    const p = providers.find((pp) => pp.id === providerId);
    if (!p) return;
    if (!p.baseUrl) { setFetchError((s) => ({ ...s, [providerId]: '请先填写接口地址' })); return; }
    if (!p.apiKey) { setFetchError((s) => ({ ...s, [providerId]: '请先填写 API Key' })); return; }
    setFetching((s) => ({ ...s, [providerId]: true }));
    setFetchError((s) => ({ ...s, [providerId]: '' }));
    try {
      const models = await fetchAvailableModels(p.baseUrl, p.apiKey);
      setFetchedModels((s) => ({ ...s, [providerId]: models }));
    } catch (err) {
      setFetchError((s) => ({ ...s, [providerId]: err instanceof Error ? err.message : String(err) }));
    } finally {
      setFetching((s) => ({ ...s, [providerId]: false }));
    }
  };

  const toggleModel = (providerId: string, model: string) => {
    const p = providers.find((pp) => pp.id === providerId);
    if (!p) return;
    const isSelected = p.models.includes(model);
    if (isSelected) {
      const filtered = p.models.filter((m) => m !== model);
      const filteredThinking = (p.thinkingModels || []).filter((m) => m !== model);
      updateProvider(providerId, { models: filtered, thinkingModels: filteredThinking });
      if (activeModel === model) setActiveModel(filtered[0] ?? '');
    } else {
      updateProvider(providerId, { models: [...p.models, model] });
    }
  };

  const removeModel = (providerId: string, model: string) => {
    const p = providers.find((pp) => pp.id === providerId);
    if (!p) return;
    const filtered = p.models.filter((m) => m !== model);
    const filteredThinking = (p.thinkingModels || []).filter((m) => m !== model);
    updateProvider(providerId, { models: filtered, thinkingModels: filteredThinking });
    if (activeModel === model) setActiveModel(filtered[0] ?? '');
  };

  const addModelManually = (providerId: string, value: string) => {
    const p = providers.find((pp) => pp.id === providerId);
    if (!p || !value.trim()) return;
    const v = value.trim();
    if (p.models.includes(v)) return;
    updateProvider(providerId, { models: [...p.models, v] });
    if (!activeModel) { setActiveProvider(providerId); setActiveModel(v); }
  };

  const toggleThinkingModel = (providerId: string, model: string) => {
    const p = providers.find((pp) => pp.id === providerId);
    if (!p) return;
    const isThinking = (p.thinkingModels || []).includes(model);
    if (isThinking) {
      updateProvider(providerId, { thinkingModels: (p.thinkingModels || []).filter((m) => m !== model) });
    } else {
      updateProvider(providerId, { thinkingModels: [...(p.thinkingModels || []), model] });
    }
  };

  const toggleGroup = (group: string) => {
    setCollapsedGroups((s) => ({ ...s, [group]: !s[group] }));
  };

  const selectedProvider = providers.find((p) => p.id === selectedId) || null;

  const renderItems = useMemo(() => {
    const items: Array<{
      key: string;
      type: ProviderType;
      displayName: string;
      provider: typeof providers[number] | null;
      isAdded: boolean;
    }> = [];

    for (const type of PRESET_ORDER) {
      const provider = providers.find((p) => p.type === type);
      items.push({
        key: `preset-${type}`,
        type,
        displayName: provider ? provider.name : PRESETS[type].name,
        provider: provider || null,
        isAdded: !!provider,
      });
    }

    const customProviders = providers.filter((p) => p.type === 'custom');
    for (const cp of customProviders) {
      items.push({
        key: `provider-${cp.id}`,
        type: 'custom',
        displayName: cp.name,
        provider: cp,
        isAdded: true,
      });
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return items.filter((item) => {
        const presetName = PRESETS[item.type]?.name.toLowerCase() || '';
        if (presetName.includes(q)) return true;
        if (item.displayName.toLowerCase().includes(q)) return true;
        return false;
      });
    }

    return items;
  }, [providers, searchQuery]);

  return (
    <div style={{ display: 'flex', gap: 16, height: '100%', minHeight: 400 }}>
      {/* Left Sidebar */}
      <div style={{
        width: 240, flexShrink: 0, display: 'flex', flexDirection: 'column',
        background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border-light)',
        overflow: 'hidden',
      }}>
        {/* Search */}
        <div style={{ padding: '10px', borderBottom: '1px solid var(--border-subtle)' }}>
          <div style={{ position: 'relative' }}>
            <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder='搜索模型平台...'
              className='w-full on'
              style={{
                padding: '7px 32px 7px 30px', borderRadius: 10,
                background: 'var(--bg-input)', border: '1px solid var(--border-light)',
                fontSize: 'var(--fs-11)', color: 'var(--text-primary)',
              }}
            />
            <Filter size={12} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          </div>
        </div>

        {/* Provider list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '6px 8px' }}>
          {renderItems.length === 0 && (
            <div style={{ padding: '24px 12px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 'var(--fs-12)' }}>
              <Server size={20} style={{ margin: '0 auto 6px', opacity: 0.3 }} />
              <p style={{ fontSize: 'var(--fs-11)' }}>未找到匹配的 Provider</p>
            </div>
          )}
          {renderItems.map((item) => {
            const isSelected = item.isAdded && item.provider ? selectedId === item.provider.id : false;
            const status = item.isAdded && item.provider ? (connectionStatus[item.provider.id] || 'unknown') : 'unknown';
            const enabled = item.isAdded && item.provider ? (enabledProviders[item.provider.id] ?? true) : true;
            const pName = item.isAdded && item.provider ? item.provider.name : item.displayName;

            return (
              <div
                key={item.key}
                onClick={() => {
                  if (item.isAdded && item.provider) {
                    setSelectedId(item.provider.id);
                    setActiveProvider(item.provider.id);
                  } else {
                    addPreset(item.type);
                  }
                }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 8px', borderRadius: 10,
                  background: isSelected ? 'var(--accent-bg)' : 'transparent',
                  border: isSelected ? '1px solid var(--accent-border)' : '1px solid transparent',
                  marginBottom: 2, cursor: 'pointer', transition: 'all 0.12s ease',
                }}
                onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = 'var(--bg-hover)'; }}
                onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
              >
                <PresetIcon type={item.type} size={28} selected={isSelected} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 'var(--fs-12)', fontWeight: 600,
                    color: isSelected ? 'var(--accent)' : 'var(--text-primary)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>{pName}</div>
                  {!item.isAdded && (
                    <div style={{
                      fontSize: 'var(--fs-10)', color: 'var(--text-muted)',
                      marginTop: 2,
                    }}>点击添加</div>
                  )}
                </div>
                {item.isAdded && item.provider ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                    <StatusDot status={status} />
                    <Toggle checked={enabled} onChange={() => {
                      const next = !enabled;
                      setEnabledProvider(item.provider!.id, next);
                      if (next) { setActiveProvider(item.provider!.id); if (item.provider!.models.length > 0) setActiveModel(item.provider!.models[0]); }
                    }} size='sm' />
                  </div>
                ) : (
                  <Plus size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                )}
              </div>
            );
          })}
        </div>

        {/* Bottom: Add custom provider */}
        <div style={{ padding: '8px', borderTop: '1px solid var(--border-subtle)' }}>
          <button
            onClick={() => {
              addPreset('custom');
            }}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              padding: '9px 12px', borderRadius: 10, border: '1px dashed var(--border-light)',
              background: 'var(--bg-elevated)', color: 'var(--text-secondary)',
              fontSize: 'var(--fs-11)', fontWeight: 500, cursor: 'pointer',
              transition: 'all 0.12s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'var(--accent-border)';
              e.currentTarget.style.color = 'var(--accent)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'var(--border-light)';
              e.currentTarget.style.color = 'var(--text-secondary)';
            }}
          >
            <Plus size={13} />
            添加自定义
          </button>
        </div>

      </div>

      {/* Right Detail Panel */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        {!selectedProvider ? (
          <div style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--text-muted)', fontSize: 'var(--fs-13)',
            background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border-light)',
          }}>
            <div style={{ textAlign: 'center' }}>
              <Server size={36} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
              <p>从左侧选择一个 Provider 查看详情</p>
              <p style={{ fontSize: 'var(--fs-11)', marginTop: 6, opacity: 0.6 }}>点击列表项即可添加或选择</p>
            </div>
          </div>
        ) : (
          <ProviderDetail
            key={selectedProvider.id}
            provider={selectedProvider}
            status={connectionStatus[selectedProvider.id] || 'unknown'}
            statusMsg={connectionMsg[selectedProvider.id] || ''}
            testConnection={testConnection}
            showKey={showKey}
            setShowKey={setShowKey}
            fetching={fetching}
            setFetching={setFetching}
            fetchError={fetchError}
            setFetchError={setFetchError}
            fetchedModels={fetchedModels}
            setFetchedModels={setFetchedModels}
            activeModel={activeModel}
            setActiveModel={setActiveModel}
            updateProvider={updateProvider}
            removeProvider={removeProvider}
            toggleModel={toggleModel}
            removeModel={removeModel}
            addModelManually={addModelManually}
            toggleThinkingModel={toggleThinkingModel}
            handleFetchModels={handleFetchModels}
            collapsedGroups={collapsedGroups}
            setCollapsedGroups={setCollapsedGroups}
            toggleGroup={toggleGroup}
            enabledProviders={enabledProviders}
            setEnabledProvider={setEnabledProvider}
            setActiveProvider={setActiveProvider}
            activeProviderId={activeProviderId}
          />
        )}
      </div>
    </div>
  );
}


interface ProviderDetailProps {
  provider: ReturnType<typeof useProviderStore.getState>['providers'][number];
  status: ConnectionStatus;
  statusMsg: string;
  testConnection: (id: string) => Promise<void>;
  showKey: Record<string, boolean>;
  setShowKey: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  fetching: Record<string, boolean>;
  setFetching: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  fetchError: Record<string, string>;
  setFetchError: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  fetchedModels: Record<string, string[]>;
  setFetchedModels: React.Dispatch<React.SetStateAction<Record<string, string[]>>>;
  activeModel: string;
  setActiveModel: (m: string) => void;
  updateProvider: (id: string, p: Partial<{
    id: string; name: string; type: ProviderType; apiKey: string; baseUrl: string;
    models: string[]; supportsImages: boolean; thinkingModels: string[];
  }>) => void;
  removeProvider: (id: string) => void;
  toggleModel: (providerId: string, model: string) => void;
  removeModel: (providerId: string, model: string) => void;
  addModelManually: (providerId: string, value: string) => void;
  toggleThinkingModel: (providerId: string, model: string) => void;
  handleFetchModels: (providerId: string) => Promise<void>;
  collapsedGroups: Record<string, boolean>;
  setCollapsedGroups: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  toggleGroup: (group: string) => void;
  enabledProviders: Record<string, boolean>;
  setEnabledProvider: (id: string, enabled: boolean) => void;
  setActiveProvider: (id: string) => void;
  activeProviderId: string | null;
}

function groupModels(models: string[]): { group: string; items: string[] }[] {
  const groups: Record<string, string[]> = {};
  for (const m of models) {
    const parts = m.split(/[/.]/);
    let group = parts[0];
    if (m.includes('/')) {
      group = parts[1]?.split('-')[0] || parts[0];
    } else if (m.includes('-')) {
      group = m.split('-').slice(0, 2).join('-');
    }
    if (!groups[group]) groups[group] = [];
    groups[group].push(m);
  }
  return Object.entries(groups).map(([group, items]) => ({ group, items: items.sort() }));
}

function ProviderDetail({
  provider: p, status, statusMsg, testConnection,
  showKey, setShowKey, fetching, fetchError, fetchedModels,
  activeModel, setActiveModel, updateProvider, removeProvider,
  toggleModel, removeModel, addModelManually, toggleThinkingModel, handleFetchModels,
  collapsedGroups, toggleGroup, enabledProviders, setEnabledProvider, setActiveProvider, activeProviderId,
}: ProviderDetailProps) {
  const fetched = fetchedModels[p.id] || [];
  const hasFetched = fetched.length > 0;
  const fetchingNow = !!fetching[p.id];
  const fetchErr = fetchError[p.id] || '';
  const Icon = PRESET_ICONS[p.type] || Server;
  const autoImages = PRESETS[p.type]?.supportsImages ?? false;
  const enabled = enabledProviders[p.id] ?? true;

  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [showFetchModal, setShowFetchModal] = useState(false);
  const [modalSearch, setModalSearch] = useState("");

  const statusLabelMap: Record<ConnectionStatus, string> = {
    unknown: '未检测', checking: '检测中...', online: '连接正常',
    offline: '连接失败', invalid_key: 'API Key 无效',
  };
  const statusColor = status === 'online' ? '#22c55e' : status === 'offline' ? '#ef4444' : status === 'invalid_key' ? '#f59e0b' : 'var(--text-muted)';

  const modelGroups = useMemo<{ group: string; items: string[] }[]>(() => groupModels(p.models), [p.models]);

  const presetDefaultModels = useMemo(() => {
    const preset = PRESETS[p.type];
    return preset ? preset.models : [];
  }, [p.type]);

  const filteredFetched = useMemo(() => {
    if (!modalSearch) return fetched;
    const q = modalSearch.toLowerCase();
    return fetched.filter((m) => m.toLowerCase().includes(q));
  }, [fetched, modalSearch]);

  const previewUrl = p.baseUrl ? `${p.baseUrl.replace(/\/+$/, '')}/chat/completions` : '';

  useEffect(() => {
    if (!editingName) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('input')) {
        const trimmed = nameDraft.trim();
        updateProvider(p.id, { name: trimmed || p.name });
        setEditingName(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [editingName, nameDraft, p.id, updateProvider]);

  return (
    <div style={{
      background: 'var(--bg-card)', borderRadius: 12,
      border: '1px solid var(--border-light)', padding: 0,
      overflow: 'hidden', display: 'flex', flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <PresetIcon type={p.type} size={40} />
          <div>
            {editingName ? (
            <input
              autoFocus
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const trimmed = nameDraft.trim();
                  updateProvider(p.id, { name: trimmed || p.name });
                  setEditingName(false);
                } else if (e.key === 'Escape') {
                  setEditingName(false);
                }
              }}
              style={{
                fontSize: 'var(--fs-15)', fontWeight: 600, color: 'var(--text-primary)',
                background: 'var(--bg-input)', border: '1px solid var(--border-light)',
                borderRadius: 10, padding: '4px 10px', width: 200, outline: 'none',
              }}
            />
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ fontSize: 'var(--fs-15)', fontWeight: 600, color: 'var(--text-primary)' }}>{p.name}</div>
              {p.type === 'custom' && (
              <button
                onClick={() => { setNameDraft(p.name); setEditingName(true); }}
                style={{
                  width: 20, height: 20, borderRadius: 4, border: 'none', cursor: 'pointer',
                  background: 'var(--bg-elevated)', color: 'var(--text-muted)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'color 0.15s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--accent)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; }}
                title="编辑名称"
              >
                <Pencil size={11} />
              </button>
            )}
            </div>
          )}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Toggle checked={enabled} onChange={() => {
            const next = !enabled;
            setEnabledProvider(p.id, next);
            if (next) setActiveProvider(p.id);
          }} size='md' />
        </div>
      </div>

      {/* Scrollable content */}
      <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* API Key Section */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <label style={{ fontSize: 'var(--fs-12)', fontWeight: 600, color: 'var(--text-primary)' }}>API 密钥</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                onClick={() => testConnection(p.id)}
                disabled={status === 'checking'}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  padding: '5px 12px', fontSize: 'var(--fs-11)', borderRadius: 8, fontWeight: 500,
                  background: status === 'checking' ? 'var(--bg-hover)' : 'var(--bg-elevated)',
                  color: status === 'checking' ? 'var(--text-muted)' : 'var(--text-secondary)',
                  border: '1px solid var(--border-light)', cursor: status === 'checking' ? 'not-allowed' : 'pointer',
                }}
              >
                {status === 'checking' ? <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} /> : <Wifi size={11} />}
                检测
              </button>
              <StatusDot status={status} />
            </div>
          </div>
          <div style={{ position: 'relative' }}>
            <input
              type={showKey[p.id] ? 'text' : 'password'}
              value={p.apiKey}
              onChange={(e) => updateProvider(p.id, { apiKey: e.target.value })}
              placeholder='输入 API Key，多个密钥使用逗号分隔'
              style={{
                width: '100%', color: 'var(--text-primary)', background: 'var(--bg-input)',
                fontSize: 'var(--fs-12)', padding: '10px 38px 10px 12px)', borderRadius: 10,
                border: '1px solid var(--border-light)', outline: 'none',
              }}
            />
            <button
              onClick={() => setShowKey((s) => ({ ...s, [p.id]: !s[p.id] }))}
              style={{
                position: 'absolute', right: 0, top: 0, height: '100%', width: 36,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer',
              }}
            >
              {showKey[p.id] ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
          <div style={{
            fontSize: 'var(--fs-10)', color: 'var(--text-muted)', marginTop: 6,
            display: 'flex', justifyContent: 'space-between',
          }}>
            <span>多个密钥使用逗号分隔</span>
            {statusMsg && status !== 'checking' && (
              <span style={{ color: statusColor }}>{statusMsg}</span>
            )}
          </div>
        </div>

        {/* API URL Section */}
        <div>
          <label style={{ fontSize: 'var(--fs-12)', fontWeight: 600, color: 'var(--text-primary)', display: 'block', marginBottom: 8 }}>
            API 地址
          </label>
          <div style={{ position: 'relative' }}>
            <input
              value={p.baseUrl}
              onChange={(e) => updateProvider(p.id, { baseUrl: e.target.value })}
              placeholder='https://api.example.com/v1'
              style={{
                width: '100%', color: 'var(--text-primary)', background: 'var(--bg-input)',
                fontSize: 'var(--fs-12)', padding: '10px 38px 10px 12px)', borderRadius: 10,
                border: '1px solid var(--border-light)', outline: 'none',
              }}
            />
            <button style={{
              position: 'absolute', right: 0, top: 0, height: '100%', width: 36,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer',
            }}>
              <Cog size={13} />
            </button>
          </div>
          {previewUrl && (
            <div style={{ fontSize: 'var(--fs-10)', color: 'var(--text-muted)', marginTop: 6 }}>
              预览: {previewUrl}
            </div>
          )}
        </div>

        {/* Models Section */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 'var(--fs-12)', fontWeight: 600, color: 'var(--text-primary)' }}>模型</span>
              <span style={{
                fontSize: 'var(--fs-10)', color: 'var(--text-muted)',
                background: 'var(--bg-hover)', padding: '1px 7px', borderRadius: 10,
              }}>{p.models.length}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button
                onClick={() => updateProvider(p.id, { supportsImages: !p.supportsImages })}
                title='视觉支持'
                style={{
                  width: 24, height: 24, borderRadius: 6, border: 'none', cursor: 'pointer',
                  background: p.supportsImages ? 'var(--accent-bg)' : 'var(--bg-elevated)',
                  color: p.supportsImages ? 'var(--accent)' : 'var(--text-muted)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Image size={12} />
              </button>
              <button
                onClick={async () => {
                  setShowFetchModal(true);
                  await handleFetchModels(p.id);
                }}
                disabled={fetchingNow}
                title='获取模型列表'
                style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  padding: '5px 12px', fontSize: 'var(--fs-11)', borderRadius: 8, fontWeight: 500,
                  background: fetchingNow ? 'var(--bg-hover)' : 'var(--bg-elevated)',
                  color: fetchingNow ? 'var(--text-muted)' : 'var(--text-secondary)',
                  border: '1px solid var(--border-light)', cursor: fetchingNow ? 'not-allowed' : 'pointer',
                }}
              >
                <Download size={11} />
                {fetchingNow ? '获取中' : '获取模型列表'}
              </button>
              <button
                onClick={() => addModelManually(p.id, '')}
                title='手动添加模型'
                style={{
                  width: 24, height: 24, borderRadius: 6, border: 'none', cursor: 'pointer',
                  background: 'var(--accent-bg)', color: 'var(--accent)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Plus size={12} />
              </button>
            </div>
          </div>


          {modelGroups.length === 0 && !hasFetched && (
            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 'var(--fs-11)' }}>
              暂无模型，点击上方「获取模型列表」或手动添加
            </div>
          )}

          {modelGroups.map(({ group, items }) => {
            const isCollapsed = collapsedGroups[group] ?? false;
            return (
              <div key={group} style={{ marginBottom: 8 }}>
                <button
                  onClick={() => toggleGroup(group)}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 6,
                    padding: '8px 10px', borderRadius: 8, border: '1px solid var(--border-subtle)',
                    background: 'var(--bg-surface)', cursor: 'pointer',
                    fontSize: 'var(--fs-11)', fontWeight: 600, color: 'var(--text-primary)',
                  }}
                >
                  {isCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                  <span>{group}</span>
                  <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>({items.length})</span>
                </button>
                {!isCollapsed && (
                  <div style={{ padding: '4px 0 4px 22px' }}>
                    {items.map((m) => {
                      const isEnabled = p.models.includes(m);
                      const isThinking = (p.thinkingModels || []).includes(m);
                      const isActive = activeModel === m && activeProviderId === p.id;
                      return (
                        <div
                          key={m}
                          onClick={() => {
                            setActiveProvider(p.id);
                            if (!isEnabled) toggleModel(p.id, m);
                            setActiveModel(m);
                          }}
                          style={{
                            display: 'flex', alignItems: 'center', gap: 6,
                            padding: '6px 8px', borderRadius: 6, marginBottom: 2,cursor: 'pointer',
                            background: isActive ? 'var(--accent-bg)' : 'transparent',
                            transition: 'background 0.12s',
                          }}
                          onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = 'var(--bg-hover)'; }}
                          onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
                        >
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveProvider(p.id);
                              if (!isEnabled) toggleModel(p.id, m);
                              setActiveModel(m);
                            }}
                            title={isActive ? '使用中' : '启用'}
                            style={{
                              width: 22, height: 22, borderRadius: 6, border: 'none', cursor: 'pointer',
                              background: isActive ? 'var(--accent)' : isEnabled ? 'var(--accent-bg)' : 'var(--bg-elevated)',
                              color: isActive || isEnabled ? 'var(--accent)' : 'var(--text-muted)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}
                          >
                            {isActive ? <Eye size={11} /> : isEnabled ? <Check size={10} /> : <EyeOff size={11} />}
                          </button>
                          <span style={{
                            flex: 1, minWidth: 0, fontSize: 'var(--fs-11)',
                            color: isActive ? 'var(--accent)' : 'var(--text-primary)',
                            fontWeight: isActive ? 600 : 400,
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}>{m}</span>
                          {isThinking && (
                            <span title='思考模型'><Brain size={11} style={{ color: '#f59e0b' }} /></span>
                          )}
                          <button
                            onClick={(e) => { e.stopPropagation(); toggleThinkingModel(p.id, m); }}
                            title='标记为思考模型'
                            style={{
                              width: 20, height: 20, borderRadius: 4, border: 'none', cursor: 'pointer',
                              background: isThinking ? 'rgba(245, 158, 11, 0.15)' : 'transparent',
                              color: isThinking ? '#f59e0b' : 'var(--text-muted)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}
                          >
                            <Brain size={10} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              if (presetDefaultModels.includes(m)) {
                                toggleModel(p.id, m);
                              } else {
                                removeModel(p.id, m);
                              }
                            }}
                            title={presetDefaultModels.includes(m) ? '禁用预设模型' : '移除'}
                            style={{
                              width: 20, height: 20, borderRadius: 4, border: 'none', cursor: 'pointer',
                              background: 'transparent', color: 'var(--text-muted)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}
                          >
                            <Trash2 size={10} />
                          </button>
                        </div>
                      );
            })}
                  </div>
                )}
              </div>
            );
          })}

          {/* Manual add */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '6px 8px', borderRadius: 6, border: '1px dashed var(--border-light)',
            marginTop: 6,
          }}>
            <Plus size={11} style={{ color: 'var(--text-muted)' }} />
            <input
              placeholder='添加自定义模型名...'
              style={{
                flex: 1, border: 'none', outline: 'none', background: 'transparent',
                fontSize: 'var(--fs-11)', color: 'var(--text-primary)',
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const v = (e.target as HTMLInputElement).value.trim();
                  if (v) { addModelManually(p.id, v); (e.target as HTMLInputElement).value = ''; }
                }
              }}
            />
          </div>
        </div>

        {/* Delete button */}
        <div style={{ paddingTop: 8, borderTop: '1px solid var(--border-subtle)' }}>
          <button
            onClick={() => removeProvider(p.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 14px', borderRadius: 8, border: '1px solid rgba(239, 68, 68, 0.3)',
              background: 'rgba(239, 68, 68, 0.08)', color: '#ef4444',
              fontSize: 'var(--fs-11)', fontWeight: 500, cursor: 'pointer',
            }}
          >
            <Trash2 size={12} />
            删除此 Provider
          </button>
        </div>
      </div>

      {/* Fetched Models Modal */}
      {showFetchModal && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.45)',
        }} onClick={() => setShowFetchModal(false)}>
          <div style={{
            width: 520, maxHeight: '75vh',
            background: 'var(--bg-overlay)',
            border: '1px solid var(--border-medium)',
            borderRadius: 14,
            boxShadow: '0 12px 40px rgba(0,0,0,0.35)',
            backdropFilter: 'var(--blur-lg)',
            WebkitBackdropFilter: 'var(--blur-lg)',
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
          }} onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div style={{ padding: '12px 14px 8px', borderBottom: '1px solid var(--border-light)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Bot size={14} style={{ color: 'var(--accent)' }} />
                <span style={{ fontSize: 'var(--fs-13)', fontWeight: 600, color: 'var(--text-primary)' }}>
                {p.name} 模型
                </span>
                {fetched.length > 0 && (
                <span style={{ fontSize: 'var(--fs-11)', color: 'var(--text-muted)' }}>
                ({fetched.length})
                </span>
                )}
                </div>
                <button onClick={() => setShowFetchModal(false)} className="btn-ghost" style={{ width: 24, height: 24, padding: 0 }}>
                <X size={12} />
                </button>
              </div>
              {/* Search */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 8, background: 'var(--bg-input)', border: '1px solid var(--border-light)' }}>
                <Search size={11} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                <input
                value={modalSearch}
                onChange={(e) => setModalSearch(e.target.value)}
                placeholder="搜索模型 ID 或名称..."
                style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: 'var(--text-primary)', fontSize: 'var(--fs-12)', fontFamily: 'inherit', minWidth: 0 }}
                />
                {modalSearch && (
                <button onClick={() => setModalSearch('')} className="btn-ghost" style={{ width: 16, height: 16, padding: 0 }}>
                <X size={9} />
                </button>
                )}
              </div>
            </div>
            {/* Body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
              {fetchingNow && (
                <div style={{ padding: '30px 12px', textAlign: 'center', color: 'var(--text-muted)' }}>
                <Loader2 size={18} style={{ margin: '0 auto 6px', animation: 'spin 1s linear infinite' }} />
                <p style={{ fontSize: 'var(--fs-12)' }}>正在获取模型列表...</p>
                </div>
              )}
              {!fetchingNow && fetchErr && (
                <div style={{ padding: '20px 12px', textAlign: 'center' }}>
                <div style={{ padding: '10px 12px', color: '#ef4444', background: 'rgba(239, 68, 68, 0.1)', borderRadius: 8, fontSize: 'var(--fs-11)', marginBottom: 10 }}>{fetchErr}</div>
                <button onClick={() => handleFetchModels(p.id)} className="cp"
                style={{ padding: '5px 14px', borderRadius: 6, fontSize: 'var(--fs-11)', color: 'var(--text-tertiary)', background: 'transparent', border: '1px solid var(--border-light)' }}>
                重试
                </button>
                </div>
              )}
              {!fetchingNow && !fetchErr && filteredFetched.length === 0 && (
                <div style={{ padding: '30px 12px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 'var(--fs-12)' }}>
                {modalSearch ? '未找到匹配的模型' : '暂无模型，请手动添加'}
                </div>
              )}
              {!fetchingNow && filteredFetched.length > 0 && (() => {
                const groups: Record<string, string[]> = {};
                for (const m of filteredFetched) {
                const parts = m.split(/[-_/]/);
                const groupName = parts.length > 0 ? parts[0] : '其他';
                if (!groups[groupName]) groups[groupName] = [];
                groups[groupName].push(m);
                }
                const groupEntries: [string, string[]][] = Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));

                return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {groupEntries.map(([groupName, models]) => {
                const isGroupCollapsed = collapsedGroups[`modal-${p.id}-${groupName}`] ?? false;
                const allEnabled = models.every((m) => p.models.includes(m));
                const someEnabled = models.some((m) => p.models.includes(m));
                return (
                <div key={groupName} style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid var(--border-subtle)' }}>
                <button
                onClick={() => toggleGroup(`modal-${p.id}-${groupName}`)}
                className="cp"
                style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 6,
                padding: '7px 10px', background: 'var(--bg-surface)',
                border: 'none', cursor: 'pointer',
                fontSize: 'var(--fs-12)', fontWeight: 600, color: 'var(--text-primary)',
                }}>
                {isGroupCollapsed ? <ChevronRight size={11} /> : <ChevronDown size={11} />}
                <span>{groupName}</span>
                <span style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: 'var(--fs-11)' }}>({models.length})</span>
                <span style={{ flex: 1 }} />
                <button
                onClick={(e) => {
                e.stopPropagation();
                if (allEnabled) {
                const newModels = p.models.filter((m) => !models.includes(m));
                const newThinking = (p.thinkingModels || []).filter((m) => !models.includes(m));
                updateProvider(p.id, { models: newModels, thinkingModels: newThinking });
                } else {
                updateProvider(p.id, { models: [...new Set([...p.models, ...models])] });
                }
                }}
                className="cp"
                style={{
                padding: '3px 10px', borderRadius: 6, fontSize: 'var(--fs-11)',
                fontWeight: 500,
                background: allEnabled ? 'var(--accent-bg)' : 'var(--bg-hover)',
                color: allEnabled ? 'var(--accent)' : someEnabled ? 'var(--accent)' : 'var(--text-muted)',
                border: allEnabled ? '1px solid var(--accent-border)' : '1px solid var(--border-light)',
                cursor: 'pointer',
                }}>
                {allEnabled ? '全部取消' : '全部启用'}
                </button>
                </button>
                {!isGroupCollapsed && (
                <div>
                {models.map((m) => {
                const isEnabled = p.models.includes(m);
                const isThinking = (p.thinkingModels || []).includes(m);
                return (
                <div key={m}
                className="cp"
                onClick={() => {
                if (isEnabled) {
                const filtered = p.models.filter((x) => x !== m);
                const filteredThinking = (p.thinkingModels || []).filter((x) => x !== m);
                updateProvider(p.id, { models: filtered, thinkingModels: filteredThinking });
                if (activeModel === m) setActiveModel(filtered[0] ?? '');
                } else {
                updateProvider(p.id, { models: [...p.models, m] });
                }
                }}
                style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '5px 10px',cursor: 'pointer',
                background: isEnabled ? 'var(--accent-bg)' : 'transparent',
                borderTop: '1px solid var(--border-subtle)',
                transition: 'background 0.12s',
                }}
                onMouseEnter={(e) => { if (!isEnabled) e.currentTarget.style.background = 'var(--bg-hover)'; }}
                onMouseLeave={(e) => { if (!isEnabled) e.currentTarget.style.background = 'transparent'; }}
                >
                <button
                onClick={(e) => {
                e.stopPropagation();
                if (isEnabled) {
                const filtered = p.models.filter((x) => x !== m);
                const filteredThinking = (p.thinkingModels || []).filter((x) => x !== m);
                updateProvider(p.id, { models: filtered, thinkingModels: filteredThinking });
                if (activeModel === m) setActiveModel(filtered[0] ?? '');
                } else {
                updateProvider(p.id, { models: [...p.models, m] });
                }
                }}
                title={isEnabled ? '已启用' : '启用'}
                className="cp"
                style={{
                width: 22, height: 22, borderRadius: 6, border: 'none', cursor: 'pointer',
                background: isEnabled ? 'var(--accent)' : 'var(--bg-elevated)',
                color: isEnabled ? '#fff' : 'var(--text-muted)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
                >
                {isEnabled ? <Check size={10} /> : <EyeOff size={10} />}
                </button>
                <span style={{
                flex: 1, minWidth: 0, fontSize: 'var(--fs-12)',
                color: isEnabled ? 'var(--accent)' : 'var(--text-primary)',
                fontWeight: isEnabled ? 600 : 400,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>{m}</span>
                <button
                onClick={(e) => { e.stopPropagation(); toggleThinkingModel(p.id, m); }}
                title={isThinking ? '取消思考模型' : '标记为思考模型'}
                className="cp"
                style={{
                width: 22, height: 22, borderRadius: 6, border: 'none', cursor: 'pointer',
                background: isThinking ? 'rgba(245, 158, 11, 0.15)' : 'transparent',
                color: isThinking ? '#f59e0b' : 'var(--text-muted)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
                >
                <Brain size={10} />
                </button>
                <button
                onClick={(e) => {
                e.stopPropagation();
                if (presetDefaultModels.includes(m)) {
                toggleModel(p.id, m);
                } else {
                removeModel(p.id, m);
                }
                }}
                title={presetDefaultModels.includes(m) ? '禁用预设模型' : '移除'}
                className="cp"
                style={{
                width: 22, height: 22, borderRadius: 6, border: 'none', cursor: 'pointer',
                background: 'transparent', color: 'var(--text-muted)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
                >
                <Trash2 size={10} />
                </button>
                </div>
                );
            })}
                </div>
                )}
                </div>
                );
            })}
              </div>
            );
            })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}



function SectionContent({ activeTab }: { activeTab: NavKey }) {
  if (activeTab === "models") return <ModelsSection />;
  if (activeTab === "character") return <CharacterPanel />;
  if (activeTab === "world") return <WorldPanel />;
  if (activeTab === "tools") return <ToolsPanel />;
  return <McpPanel />;
}

export function ProviderConfigPanel() {
  const { setSettingsOpen } = useUIStore();
  const { providers, activeProviderId, activeModel, setActiveProvider, setActiveModel } = useProviderStore();
  const [activeTab, setActiveTab] = useState<NavKey>("models");
  const rightContentRef = useRef<HTMLDivElement>(null);

  const activeProvider = providers.find((p) => p.id === activeProviderId);

  useEffect(() => {
    const el = rightContentRef.current;
    if (el) el.scrollTo({ top: 0, behavior: 'smooth' });
  }, [activeProviderId]);

  return (
    <div className="fixed inset-0 z-50" style={{ display: "flex", flexDirection: "column", background: "var(--bg-app)" }}>
      <div data-tauri-drag-region style={{
        height: 40, display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 12px", flexShrink: 0, borderBottom: "1px solid var(--border-light)",
        background: "var(--header-bg)", backdropFilter: "var(--blur-lg)", WebkitBackdropFilter: "var(--blur-lg)",
      }}>
        <div style={{ width: 80, display: "flex", alignItems: "center" }}>
          <button
            onClick={() => setSettingsOpen(false)}
            className="btn-ghost flex items-center gap-1"
            style={{ padding: "2px 4px" }}
          >
            <ChevronLeft size={14} />
            <span className="text-11 txt-tertiary">返回</span>
          </button>
        </div>
        <span className="text-sm font-medium txt-secondary">设置</span>
        <div style={{ width: 80, display: "flex", justifyContent: "flex-end" }} />
      </div>

      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        <nav style={{
          width: 200, flexShrink: 0, overflowY: "auto",
          borderRight: "1px solid var(--border-light)",
          background: "var(--sidebar-bg)", backdropFilter: "var(--blur-lg)", WebkitBackdropFilter: "var(--blur-lg)",
        }}>
          <div style={{ padding: "8px 6px" }}>
            {NAV_ITEMS.map((item) => {
              const isActive = activeTab === item.key;
              const Icon = item.icon;
              return (
                <button
                  key={item.key}
                  onClick={() => setActiveTab(item.key)}
                  style={{
                    display: "flex", alignItems: "center", gap: 10,
                    width: "100%", padding: "8px 12px",
                    borderRadius: 10,
                    fontSize: "var(--fs-13)",
                    fontWeight: isActive ? 500 : 400,
                    color: isActive ? "var(--accent)" : "var(--text-secondary)",
                    background: isActive ? "var(--accent-bg)" : "transparent",
                    border: "none", cursor: "pointer",
                    transition: "all 0.12s ease",
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) e.currentTarget.style.background = "var(--bg-hover)";
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) e.currentTarget.style.background = "transparent";
                  }}
                >
                  <Icon size={15} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </nav>

        <div ref={rightContentRef} style={{
          flex: 1, overflowY: "auto",
          background: "var(--bg-surface)",
        }}>
          <div style={{
            padding: "20px 24px 0",
            display: "flex", alignItems: "center", gap: 8,
          }}>
            <h2 className="text-base font-semibold txt-primary">{NAV_LABELS[activeTab]}</h2>
          </div>

          <div style={{ padding: "20px 24px 40px" }}>
            <SectionContent activeTab={activeTab} />
          </div>
        </div>
      </div>

      {activeTab === "models" && providers.length > 0 && (
        <div style={{
          flexShrink: 0, borderTop: "1px solid var(--border-light)",
          background: "var(--bg-surface)",
          padding: "12px 24px",
        }}>
          <div className="flex items-center gap-3">
            <span className="text-11 txt-muted shrink-0">当前使用</span>
            <CustomSelect
              value={activeProviderId ?? ""}
              onChange={(pid) => {
                setActiveProvider(pid);
                const prov = providers.find((pr) => pr.id === pid);
                if (prov) setActiveModel(prov.models[0] ?? "");
              }}
              options={providers.map((pr) => ({ value: pr.id, label: pr.name }))}
              placeholder="选择 Provider"
            />
            <CustomSelect
              value={activeModel ?? ""}
              onChange={(m) => setActiveModel(m)}
              options={(activeProvider?.models ?? []).map((m) => ({ value: m, label: m }))}
              placeholder="选择模型"
              disabled={!activeProvider || activeProvider.models.length === 0}
            />
          </div>
          {activeProvider && activeProvider.models.length === 0 && (
            <p className="text-11 txt-muted text-center mt-2">暂无可用模型，请在上方获取或手动添加</p>
          )}
        </div>
      )}
    </div>
  );
}
