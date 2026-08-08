import { useState, useRef, useEffect, useMemo } from "react";
import { useProviderStore } from "@/stores/providerStore";
import { useUIStore } from "@/stores/uiStore";
import { fetchAvailableModels } from "@/providers/openai";
import {
  Plus, Trash2, Eye, EyeOff, Sparkles, Download, Check, ChevronDown, ChevronLeft,
  Server, Brain, Users, Globe, Search, Bot, Settings2, Zap, Wrench, Shield, Cpu,
  Wifi, Loader2, Code2, Filter, Image, Cog, ChevronRight, Pencil, X, SlidersHorizontal, RotateCcw, Database,
  Info,
} from "lucide-react";
import { NarraModel, NarraCharacter, NarraWorld, NarraAppearance, NarraTools, NarraMcp, NarraData } from "@/components/icons/NarraIcon";
import type { ProviderType } from "@/types";
import type { AnimPhase } from "@/hooks/useAnimatedVisibility";
import { DataPanel } from "./DataPanel";
import { CharacterPanel } from "./CharacterPanel";
import { WorldPanel } from "./WorldPanel";
import { ToolsPanel } from "./ToolsPanel";
import { PluginsPanel } from "./PluginsPanel";
import { GenerationPanel } from "./GenerationPanel";
import { PromptInjectionSection } from "./PromptInjectionSection";
import { ComplianceNotice } from "./ComplianceNotice";
import { AboutPanel } from "./AboutPanel";

type NavKey = "models" | "character" | "world" | "plugins" | "tools" | "generation" | "data" | "about";type ConnectionStatus = "unknown" | "checking" | "online" | "offline" | "invalid_key";

const NAV_ITEMS: { key: NavKey; icon: React.ComponentType<{ size?: number }>; label: string }[] = [
  { key: "models", icon: NarraModel, label: "模型服务" },
  { key: "character", icon: NarraCharacter, label: "角色" },
  { key: "world", icon: NarraWorld, label: "规则书" },
  { key: "generation", icon: NarraAppearance, label: "输出" },
  { key: "tools", icon: NarraTools, label: "外部工具" },
  { key: "plugins", icon: NarraMcp, label: "插件" },
  { key: "data", icon: NarraData, label: "数据" },
  { key: "about", icon: Info, label: "关于" },
];

const NAV_LABELS: Record<NavKey, string> = {
  models: "模型服务", character: "角色", world: "规则书", plugins: "插件", tools: "外部工具", generation: "输出预设", data: "数据管理", about: "关于",
};

const NAV_SUBTITLES: Record<NavKey, string> = {
  models: "管理 AI 模型接入与 API 密钥",
  character: "管理 AI 角色的设定与经历",
  world: "选择或创建故事发生的宇宙",
  tools: "联网搜索与 MCP 服务等外部能力",
  plugins: "叙事防护、剧情推进与场景格式设置",
  generation: "调节 AI 的创意与输出风格", data: "导出与导入全部设置", about: "免费说明与合规风险提醒",
};

export const PRESETS: Record<string, { name: string; baseUrl: string; models: string[]; supportsImages: boolean; thinkingModels: string[]; color: string }> = {
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

export const PRESET_ORDER: ProviderType[] = ["openai", "deepseek", "anthropic", "google", "moonshot", "dashscope", "zhipuai", "openrouter", "opencode"];

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

export function PresetIcon({ type, size = 28, selected = false }: { type: ProviderType; size?: number; selected?: boolean }) {
  const Icon = PRESET_ICONS[type] || Server;
  const bg = selected ? 'var(--seed-accent-bg)' : 'var(--seed-surface)';
  const color = selected ? 'var(--seed-accent)' : 'var(--seed-muted)';
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
          borderRadius: 10, background: 'var(--seed-input-bg)', border: '1px solid var(--seed-border)',
          color: current ? 'var(--seed-fg)' : 'var(--seed-muted)', fontSize: 'var(--fs-12)',
          opacity: disabled ? 0.4 : 1, cursor: disabled ? 'not-allowed' : 'pointer', transition: 'border-color 0.15s',
        }}
      >
        <span className='truncate'>{current?.label ?? placeholder ?? '选择...'}</span>
        <ChevronDown size={12} style={{ flexShrink: 0, opacity: 0.4, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
      </button>
      {open && !disabled && (
        <div style={{
          position: 'absolute', bottom: 'calc(100% + 6px)', left: 0, right: 0,
          background: 'var(--seed-surface)', border: 'none', borderRadius: 10,
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
                background: o.value === value ? 'var(--seed-accent-bg)' : 'transparent',
                color: o.value === value ? 'var(--seed-accent)' : 'var(--seed-fg)',
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
        background: checked ? 'var(--seed-accent)' : 'var(--seed-border)', position: 'relative',
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
  // 窄屏（手机）：左右分栏改为上下堆叠
  const [isNarrow, setIsNarrow] = useState(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 820px)').matches);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 820px)');
    const handler = (e: MediaQueryListEvent) => setIsNarrow(e.matches);
    mq.addEventListener('change', handler);
    setIsNarrow(mq.matches);
    return () => mq.removeEventListener('change', handler);
  }, []);

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
    <div style={{ display: 'flex', gap: 16, flex: 1, minHeight: 0, flexDirection: isNarrow ? 'column' : 'row' }}>
      {/* Left Sidebar */}
      <div style={{
        width: isNarrow ? '100%' : 240, flexShrink: 0, display: 'flex', flexDirection: 'column',
        background: 'var(--seed-surface)', borderRadius: 16, border: '1px solid var(--seed-border)',
        overflow: 'hidden',
        maxHeight: isNarrow ? 220 : 'none',
      }}>
        {/* Search */}
        <div style={{ padding: '10px', borderBottom: '1px solid var(--seed-border)' }}>
          <div style={{ position: 'relative' }}>
            <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--seed-muted)' }} />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder='搜索模型平台...'
              className='w-full on'
              style={{
                padding: '7px 32px 7px 30px', borderRadius: 10,
                background: 'var(--seed-input-bg)', border: '1px solid var(--seed-border)',
                fontSize: 'var(--fs-11)', color: 'var(--seed-fg)',
              }}
            />
            <Filter size={12} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--seed-muted)' }} />
          </div>
        </div>

        {/* Provider list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '6px 8px' }}>
          {renderItems.length === 0 && (
            <div style={{ padding: '24px 12px', textAlign: 'center', color: 'var(--seed-muted)', fontSize: 'var(--fs-12)' }}>
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
                  padding: '8px 8px 8px 12px', borderRadius: 10,
                  background: isSelected ? 'var(--seed-accent-bg)' : 'transparent',
                  border: '1px solid transparent',
                  boxShadow: isSelected ? 'inset 3px 0 0 0 var(--seed-accent)' : 'none',
                  marginBottom: 2, cursor: 'pointer', transition: 'all 0.12s ease',
                }}
                onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = 'var(--seed-hover-bg)'; }}
                onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
              >
                <PresetIcon type={item.type} size={28} selected={isSelected} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 'var(--fs-12)', fontWeight: 600,
                    color: isSelected ? 'var(--seed-accent)' : 'var(--seed-fg)',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>{pName}</div>
                  {!item.isAdded && (
                    <div style={{
                      fontSize: 'var(--fs-10)', color: 'var(--seed-muted)',
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
                  <Plus size={14} style={{ color: 'var(--seed-muted)', flexShrink: 0 }} />
                )}
              </div>
            );
          })}
        </div>

        {/* Bottom: Add custom provider */}
        <div style={{ padding: '10px' }}>
          <button
            onClick={() => {
              addPreset('custom');
            }}
            className="seed-btn-secondary"
            style={{ width: '100%' }}
          >
            <Plus size={13} />
            添加自定义
          </button>
        </div>

      </div>

      {/* Right Detail Panel */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', minHeight: isNarrow ? 300 : 0 }}>
        {!selectedProvider ? (
          <div className="seed-empty-state" style={{
            flex: 1, background: 'var(--seed-surface)', borderRadius: 16, border: '1px solid var(--seed-border)',
          }}>
            <div className="seed-empty-icon">
              <Server size={28} style={{ color: 'var(--seed-accent)' }} />
            </div>
            <div className="seed-empty-title">选择一个 Provider</div>
            <div className="seed-empty-sub">点击左侧列表项即可添加或选择</div>
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
  toggleModel, removeModel, addModelManually, handleFetchModels,
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
  const statusColor = status === 'online' ? '#22c55e' : status === 'offline' ? '#ef4444' : status === 'invalid_key' ? '#f59e0b' : 'var(--seed-muted)';

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
      background: 'var(--seed-surface)', borderRadius: 16,
      border: '1px solid var(--seed-border)', padding: 0,
      overflow: 'hidden', display: 'flex', flexDirection: 'column',
      flex: 1,
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 20px', borderBottom: '1px solid var(--seed-border)',
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
                fontSize: 'var(--fs-15)', fontWeight: 600, color: 'var(--seed-fg)',
                background: 'var(--seed-input-bg)', border: '1px solid var(--seed-border)',
                borderRadius: 10, padding: '4px 10px', width: 200, outline: 'none',
              }}
            />
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ fontSize: 'var(--fs-15)', fontWeight: 600, color: 'var(--seed-fg)' }}>{p.name}</div>
              {p.type === 'custom' && (
              <button
                onClick={() => { setNameDraft(p.name); setEditingName(true); }}
                style={{
                  width: 20, height: 20, borderRadius: 4, border: 'none', cursor: 'pointer',
                  background: 'var(--seed-surface)', color: 'var(--seed-muted)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'color 0.15s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--seed-accent)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--seed-muted)'; }}
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
      <div style={{ padding: '20px 20px 12px', display: 'flex', flexDirection: 'column', gap: 20, flex: 1, minHeight: 0, overflowY: 'auto' }}>
        {/* API Key Section */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <label style={{ fontSize: 'var(--fs-12)', fontWeight: 600, color: 'var(--seed-fg)' }}>API 密钥</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button
                onClick={() => testConnection(p.id)}
                disabled={status === 'checking'}
                className="seed-btn-secondary"
                style={{ padding: '5px 14px', fontSize: 'var(--fs-11)' }}
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
                width: '100%', color: 'var(--seed-fg)', background: 'var(--seed-input-bg)',
                fontSize: 'var(--fs-12)', padding: '10px 38px 10px 12px)', borderRadius: 14,
                border: '1px solid var(--seed-border)', outline: 'none',
              }}
            />
            <button
              onClick={() => setShowKey((s) => ({ ...s, [p.id]: !s[p.id] }))}
              style={{
                position: 'absolute', right: 0, top: 0, height: '100%', width: 36,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'none', border: 'none', color: 'var(--seed-muted)', cursor: 'pointer',
              }}
            >
              {showKey[p.id] ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
          <div style={{
            fontSize: 'var(--fs-10)', color: 'var(--seed-muted)', marginTop: 6,
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
          <label style={{ fontSize: 'var(--fs-12)', fontWeight: 600, color: 'var(--seed-fg)', display: 'block', marginBottom: 8 }}>
            API 地址
          </label>
          <div style={{ position: 'relative' }}>
            <input
              value={p.baseUrl}
              onChange={(e) => updateProvider(p.id, { baseUrl: e.target.value })}
              placeholder='https://api.example.com/v1'
              style={{
                width: '100%', color: 'var(--seed-fg)', background: 'var(--seed-input-bg)',
                fontSize: 'var(--fs-12)', padding: '10px 38px 10px 12px)', borderRadius: 14,
                border: '1px solid var(--seed-border)', outline: 'none',
              }}
            />
            <button style={{
              position: 'absolute', right: 0, top: 0, height: '100%', width: 36,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'none', border: 'none', color: 'var(--seed-muted)', cursor: 'pointer',
            }}>
              <Cog size={13} />
            </button>
          </div>
          {previewUrl && (
            <div style={{ fontSize: 'var(--fs-10)', color: 'var(--seed-muted)', marginTop: 6 }}>
              预览: {previewUrl}
            </div>
          )}
        </div>

        {/* Models Section */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 'var(--fs-12)', fontWeight: 600, color: 'var(--seed-fg)' }}>模型</span>
              <span style={{
                fontSize: 'var(--fs-10)', color: 'var(--seed-muted)',
                background: 'var(--seed-hover-bg)', padding: '1px 7px', borderRadius: 10,
              }}>{p.models.length}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button
                onClick={() => updateProvider(p.id, { supportsImages: !p.supportsImages })}
                title='视觉支持'
                style={{
                  width: 24, height: 24, borderRadius: 6, border: 'none', cursor: 'pointer',
                  background: p.supportsImages ? 'var(--seed-accent-bg)' : 'var(--seed-surface)',
                  color: p.supportsImages ? 'var(--seed-accent)' : 'var(--seed-muted)',
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
                className="seed-btn-primary"
                style={{ padding: '5px 14px', fontSize: 'var(--fs-11)' }}
              >
                <Download size={11} />
                {fetchingNow ? '获取中' : '获取模型列表'}
              </button>
              <button
                onClick={() => addModelManually(p.id, '')}
                title='手动添加模型'
                style={{
                  width: 24, height: 24, borderRadius: 6, border: 'none', cursor: 'pointer',
                  background: 'var(--seed-accent-bg)', color: 'var(--seed-accent)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <Plus size={12} />
              </button>
            </div>
          </div>


          {modelGroups.length === 0 && !hasFetched && (
            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--seed-muted)', fontSize: 'var(--fs-11)' }}>
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
                    padding: '8px 10px', borderRadius: 8, border: '1px solid var(--seed-border)',
                    background: 'var(--seed-surface)', cursor: 'pointer',
                    fontSize: 'var(--fs-11)', fontWeight: 600, color: 'var(--seed-fg)',
                  }}
                >
                  {isCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
                  <span>{group}</span>
                  <span style={{ color: 'var(--seed-muted)', fontWeight: 400 }}>({items.length})</span>
                </button>
                {!isCollapsed && (
                  <div style={{ padding: '4px 0 4px 22px' }}>
                    {items.map((m) => {
                      const isEnabled = p.models.includes(m);
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
                            padding: '6px 8px 6px 10px', borderRadius: 6, marginBottom: 2,cursor: 'pointer',
                            background: isActive ? 'var(--seed-accent-bg)' : 'transparent',
                            boxShadow: isEnabled ? 'inset 2px 0 0 0 var(--seed-accent)' : 'none',
                            transition: 'background 0.12s',
                          }}
                          onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = 'var(--seed-hover-bg)'; }}
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
                              background: isActive ? 'var(--seed-accent)' : isEnabled ? 'var(--seed-accent-bg)' : 'var(--seed-surface)',
                              color: isActive || isEnabled ? 'var(--seed-accent)' : 'var(--seed-muted)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}
                          >
                            {isActive ? <Eye size={11} /> : isEnabled ? <Check size={10} /> : <EyeOff size={11} />}
                          </button>
                          <span style={{
                            flex: 1, minWidth: 0, fontSize: 'var(--fs-11)',
                            color: isActive ? 'var(--seed-accent)' : 'var(--seed-fg)',
                            fontWeight: isActive ? 600 : 400,
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}>{m}</span>
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
                              background: 'transparent', color: 'var(--seed-muted)',
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
            padding: '6px 8px', borderRadius: 6, border: '1px dashed var(--seed-border)',
            marginTop: 6,
          }}>
            <Plus size={11} style={{ color: 'var(--seed-muted)' }} />
            <input
              placeholder='添加自定义模型名...'
              style={{
                flex: 1, border: 'none', outline: 'none', background: 'transparent',
                fontSize: 'var(--fs-11)', color: 'var(--seed-fg)',
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
        <div style={{ paddingTop: 8, borderTop: '1px solid var(--seed-border)' }}>
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
            border: '1px solid var(--seed-border)',
            borderRadius: 14,
            boxShadow: '0 12px 40px rgba(0,0,0,0.35)',
            backdropFilter: 'blur(30px)',
            WebkitBackdropFilter: 'blur(30px)',
            display: 'flex', flexDirection: 'column', overflow: 'hidden',
          }} onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div style={{ padding: '12px 14px 8px', borderBottom: '1px solid var(--seed-border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Bot size={14} style={{ color: 'var(--seed-accent)' }} />
                <span style={{ fontSize: 'var(--fs-13)', fontWeight: 600, color: 'var(--seed-fg)' }}>
                {p.name} 模型
                </span>
                {fetched.length > 0 && (
                <span style={{ fontSize: 'var(--fs-11)', color: 'var(--seed-muted)' }}>
                ({fetched.length})
                </span>
                )}
                </div>
                <button onClick={() => setShowFetchModal(false)} className="btn-ghost" style={{ width: 24, height: 24, padding: 0 }}>
                <X size={12} />
                </button>
              </div>
              {/* Search */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 8, background: 'var(--seed-input-bg)', border: '1px solid var(--seed-border)' }}>
                <Search size={11} style={{ color: 'var(--seed-muted)', flexShrink: 0 }} />
                <input
                value={modalSearch}
                onChange={(e) => setModalSearch(e.target.value)}
                placeholder="搜索模型 ID 或名称..."
                style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: 'var(--seed-fg)', fontSize: 'var(--fs-12)', fontFamily: 'inherit', minWidth: 0 }}
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
                <div style={{ padding: '30px 12px', textAlign: 'center', color: 'var(--seed-muted)' }}>
                <Loader2 size={18} style={{ margin: '0 auto 6px', animation: 'spin 1s linear infinite' }} />
                <p style={{ fontSize: 'var(--fs-12)' }}>正在获取模型列表...</p>
                </div>
              )}
              {!fetchingNow && fetchErr && (
                <div style={{ padding: '20px 12px', textAlign: 'center' }}>
                <div style={{ padding: '10px 12px', color: '#ef4444', background: 'rgba(239, 68, 68, 0.1)', borderRadius: 8, fontSize: 'var(--fs-11)', marginBottom: 10 }}>{fetchErr}</div>
                <button onClick={() => handleFetchModels(p.id)} className="cp"
                style={{ padding: '5px 14px', borderRadius: 6, fontSize: 'var(--fs-11)', color: 'var(--seed-muted)', background: 'transparent', border: '1px solid var(--seed-border)' }}>
                重试
                </button>
                </div>
              )}
              {!fetchingNow && !fetchErr && filteredFetched.length === 0 && (
                <div style={{ padding: '30px 12px', textAlign: 'center', color: 'var(--seed-muted)', fontSize: 'var(--fs-12)' }}>
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
                <div key={groupName} style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid var(--seed-border)' }}>
                <button
                onClick={() => toggleGroup(`modal-${p.id}-${groupName}`)}
                className="cp"
                style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 6,
                padding: '7px 10px', background: 'var(--bg-surface)',
                border: 'none', cursor: 'pointer',
                fontSize: 'var(--fs-12)', fontWeight: 600, color: 'var(--seed-fg)',
                }}>
                {isGroupCollapsed ? <ChevronRight size={11} /> : <ChevronDown size={11} />}
                <span>{groupName}</span>
                <span style={{ color: 'var(--seed-muted)', fontWeight: 400, fontSize: 'var(--fs-11)' }}>({models.length})</span>
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
                background: allEnabled ? 'var(--seed-accent-bg)' : 'var(--seed-hover-bg)',
                color: allEnabled ? 'var(--seed-accent)' : someEnabled ? 'var(--seed-accent)' : 'var(--seed-muted)',
                border: allEnabled ? '1px solid var(--seed-accent-border)' : '1px solid var(--seed-border)',
                cursor: 'pointer',
                }}>
                {allEnabled ? '全部取消' : '全部启用'}
                </button>
                </button>
                {!isGroupCollapsed && (
                <div>
                {models.map((m) => {
                const isEnabled = p.models.includes(m);
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
                background: isEnabled ? 'var(--seed-accent-bg)' : 'transparent',
                borderTop: '1px solid var(--seed-border)',
                transition: 'background 0.12s',
                }}
                onMouseEnter={(e) => { if (!isEnabled) e.currentTarget.style.background = 'var(--seed-hover-bg)'; }}
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
                background: isEnabled ? 'var(--seed-accent)' : 'var(--seed-surface)',
                color: isEnabled ? '#fff' : 'var(--seed-muted)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
                >
                {isEnabled ? <Check size={10} /> : <EyeOff size={10} />}
                </button>
                <span style={{
                flex: 1, minWidth: 0, fontSize: 'var(--fs-12)',
                color: isEnabled ? 'var(--seed-accent)' : 'var(--seed-fg)',
                fontWeight: isEnabled ? 600 : 400,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}                >{m}</span>
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
                background: 'transparent', color: 'var(--seed-muted)',
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
  if (activeTab === "models") {
    return (
      <>
        <ModelsSection />
        <PromptInjectionSection />
      </>
    );
  }
  if (activeTab === "character") return <CharacterPanel />;
  if (activeTab === "world") return <WorldPanel />;
  if (activeTab === "generation") return <GenerationPanel />;
  if (activeTab === "tools") return <ToolsPanel />;
  if (activeTab === "plugins") return <PluginsPanel />;
  if (activeTab === "data") return <DataPanel />;
  if (activeTab === "about") return <AboutPanel />;
  return <ToolsPanel />;
}

export function ProviderConfigPanel({ phase = "in" }: { phase?: AnimPhase }) {
  // Android 无自绘标题栏（TitleBar 不渲染），设置面板需从顶部 0 开始
  const isAndroid = typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent);
  const { setSettingsOpen } = useUIStore();
  const { providers, activeProviderId, activeModel, setActiveProvider, setActiveModel } = useProviderStore();
  const [activeTab, setActiveTab] = useState<NavKey>("models");
  const rightContentRef = useRef<HTMLDivElement>(null);

  const activeProvider = providers.find((p) => p.id === activeProviderId);

  useEffect(() => {
    const el = rightContentRef.current;
    if (el) el.scrollTo({ top: 0, behavior: 'smooth' });
  }, [activeProviderId, activeTab]);

    return (
    <div
      className={"fixed " + (phase === "in" ? "anim-sheet-in" : phase === "out" ? "anim-sheet-out" : "anim-init")}
      style={{ top: isAndroid ? 0 : 40, left: 0, right: 0, bottom: 0, zIndex: 200, display: "flex", flexDirection: "column", background: "radial-gradient(ellipse 80% 60% at 50% 0%, var(--seed-accent-bg) 0%, transparent 60%), radial-gradient(ellipse 60% 50% at 20% 100%, color-mix(in srgb, var(--seed-accent) 3%, transparent) 0%, transparent 50%), var(--seed-bg)" }}>
      {/* 主内容区 */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
        <div className="seed-page-header">
          <div className="seed-page-title">{NAV_LABELS[activeTab]}</div>
          <div className="seed-page-subtitle">{NAV_SUBTITLES[activeTab]}</div>
        </div>

        <div
          ref={rightContentRef}
          style={{ padding: "16px 24px 24px", flex: 1, minHeight: 0, overflowY: "auto", overflowX: "hidden" }}
        >
          <div key={activeTab} className="anim-content-in" style={{ width: "100%", maxWidth: activeTab === "models" ? 1040 : 760, margin: "0 auto", display: "flex", flexDirection: "column", gap: 12 }}>
            <SectionContent activeTab={activeTab} />
            <ComplianceNotice>
              请仅在符合中国法律法规、平台规则且你有权使用的内容与数据上启用外联功能（第三方模型、网页搜索、MCP、云同步和文件导入）。
              不要用于违法、侵权、侵犯隐私或规避平台规则的用途。
            </ComplianceNotice>
          </div>
        </div>
      </div>

      {/* 底部导航栏 - 与 FunctionBar 高度完全一致 */}
      <div style={{
        background: "var(--seed-glass)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        flexShrink: 0,
      }}>
        <div style={{ maxWidth: 720, margin: "0 auto", padding: "0 24px 12px" }}>
          <nav className="seed-func-bar">
            {NAV_ITEMS.map((item) => {
              const isActive = activeTab === item.key;
              const Icon = item.icon;
              return (
                <button
                  key={item.key}
                  className={"seed-func-btn" + (isActive ? " seed-func-btn--active" : "")}
                  data-tooltip={item.label}
                  onClick={() => setActiveTab(item.key)}
                >
                  <Icon size={16} />
                </button>
              );
            })}
            <button
              className="seed-func-btn"
              data-tooltip="关闭"
              onClick={() => setSettingsOpen(false)}
            >
              <X size={16} />
            </button>
          </nav>
        </div>
      </div>
    </div>
  );
}
