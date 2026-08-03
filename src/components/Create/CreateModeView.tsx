import { useEffect, useRef, useState, useCallback } from "react";
import { ArrowLeft, Send, Wand2, User, Globe, History, Sparkles, Square, Loader2, Check, ChevronDown, Copy, Pencil, RotateCw, Trash2 } from "lucide-react";
import { useUIStore } from "@/stores/uiStore";
import { useProviderStore } from "@/stores/providerStore";
import { useSessionStore } from "@/stores/sessionStore";
import { usePromptInjectionStore } from "@/stores/promptInjectionStore";
import { useCreateStore, createMessage } from "@/stores/createStore";
import { buildCreateSystemPrompt, buildLocalOpening, buildGuideQuestions, GUIDE_LABEL, type GuideMode } from "@/lib/createGuide";
import { extractCharacterForCreate } from "@/lib/characterExtract";
import { extractWorld } from "@/lib/worldExtract";
import { chatStream } from "@/providers/openai";
import { getSendBlocker } from "@/hooks/useChat";
import { fitTextarea } from "@/lib/autoGrow";
import { ConfirmDialog } from "@/components/Layout/ConfirmDialog";
import type { Message } from "@/types";

const actionBtnIcon: React.CSSProperties = {
  width: 26, height: 26, borderRadius: 7, border: "none",
  background: "var(--seed-hover-bg)", color: "var(--seed-muted)",
  display: "flex", alignItems: "center", justifyContent: "center",
  cursor: "pointer", transition: "color 0.12s",
};
const actionBtnPrimary: React.CSSProperties = {
  padding: "5px 14px", borderRadius: 8, border: "none", cursor: "pointer",
  background: "var(--seed-accent)", color: "#fff", fontSize: "var(--fs-11)", fontWeight: 600,
  fontFamily: "inherit", display: "flex", alignItems: "center",
};
const actionBtnSecondary: React.CSSProperties = {
  padding: "5px 14px", borderRadius: 8, border: "1px solid var(--seed-border)", cursor: "pointer",
  background: "transparent", color: "var(--seed-muted)", fontSize: "var(--fs-11)", fontWeight: 500,
  fontFamily: "inherit", display: "flex", alignItems: "center",
};
import { StreamingText } from "@/components/Chat/StreamingText";
import { DraftPreview } from "./DraftPreview";
import { CreateHistory } from "./CreateHistory";

export function CreateModeView() {
  const ui = useUIStore();
  // Android 无自绘标题栏（TitleBar 不渲染），创建模式从顶部 0 开始；桌面端避开 40px 标题栏
  const isAndroid = typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent);
  const {
    type, guideMode, messages, streaming, generating, preview, savedDraft,
    setGuideMode, pushMessage, updateLastAssistant, updateMessage, removeMessage, setStreaming, setGenerating, setPreview, setSavedDraft,
  } = useCreateStore();
  const providers = useProviderStore((s) => s.providers);
  const activeProviderId = useProviderStore((s) => s.activeProviderId);
  const activeModel = useProviderStore((s) => s.activeModel);
  const enabledProviders = useProviderStore((s) => s.enabledProviders);
  const setActiveProvider = useProviderStore((s) => s.setActiveProvider);
  const setActiveModel = useProviderStore((s) => s.setActiveModel);
  const { activeId: sessionActiveId, updateSessionModel } = useSessionStore();
  const injectionItems = usePromptInjectionStore((s) => s.items);

  // 仅显示已启用且已配置的模型（与 FunctionBar availableProviders 同逻辑）
  const usableProviders = providers.filter(
    (p) => enabledProviders[p.id] !== false || p.id === activeProviderId,
  );

  const [inputValue, setInputValue] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const [pendingGuide, setPendingGuide] = useState<GuideMode | null>(null);
  const [editingMsg, setEditingMsg] = useState<{ id: string; role: Message["role"]; content: string } | null>(null);
  const [editText, setEditText] = useState("");
  const modelBtnRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const activeProvider = providers.find((p) => p.id === activeProviderId);
  const guideQuestions = buildGuideQuestions(type);
  const label = GUIDE_LABEL[type];

  // 打开创建模式：注入本地开场白（第一问 / 自由描述引导）
  // 注意：不能用闭包里的 messages 判断（StrictMode 下 effect 双跑两次，闭包值过期会重复推送），必须读 store 最新状态
  useEffect(() => {
    const s = useCreateStore.getState();
    if (s.messages.length === 0) {
      s.pushMessage({ ...createMessage("assistant", buildLocalOpening(s.type, s.guideMode)), opening: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 切换引导方式：仅剩开场白时同步替换开场文案；已聊过则确认后重置对话（两种引导混用会乱）
  const handleGuideModeChange = (m: GuideMode) => {
    if (m === guideMode) return;
    if (messages.length <= 1) {
      setGuideMode(m);
      const msgs = useCreateStore.getState().messages;
      if (msgs.length === 1 && msgs[0].opening) {
        useCreateStore.setState({
          messages: [{ ...msgs[0], content: buildLocalOpening(type, m) }],
        });
      }
    } else {
      setPendingGuide(m);
    }
  };

  const confirmGuideChange = () => {
    if (!pendingGuide) return;
    const m = pendingGuide;
    setGuideMode(m);
    useCreateStore.setState({
      messages: [{ ...createMessage("assistant", buildLocalOpening(type, m)), opening: true }],
      savedDraft: null,
      preview: null,
    });
    setPendingGuide(null);
  };

  // 收集已启用的破限词（与 useChat 逻辑一致：applied && (未绑定模型或含当前模型)）
  const collectInjections = useCallback(() => {
    return injectionItems
      .filter((i) => i.applied && (i.modelIds.length === 0 || i.modelIds.includes(activeModel)))
      .map((i) => i.text.trim())
      .filter(Boolean);
  }, [injectionItems, activeModel]);

  // Esc：先关模型菜单/历史抽屉，再关创建模式
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (modelMenuOpen) { setModelMenuOpen(false); return; }
      if (historyOpen) { setHistoryOpen(false); return; }
      abortRef.current?.abort();
      setStreaming(false);
      setGenerating(false);
      ui.setCreateMode(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [historyOpen, modelMenuOpen, ui, setStreaming, setGenerating]);

  // 点击模型菜单外部关闭
  useEffect(() => {
    if (!modelMenuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (modelBtnRef.current && !modelBtnRef.current.contains(e.target as Node)) setModelMenuOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [modelMenuOpen]);

  // 切换模型：与会话底栏同源（全局 activeProvider/activeModel + 同步当前会话），选择后保持一致性
  const applyCreateModel = (pid: string, model: string) => {
    setActiveProvider(pid);
    setActiveModel(model);
    if (sessionActiveId) updateSessionModel(sessionActiveId, pid, model, true);
    setModelMenuOpen(false);
  };

  // 流式自动滚底
  useEffect(() => {
    if (isAtBottomRef.current && scrollRef.current) {
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
      });
    }
  }, [messages]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    isAtBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
  };

  // 发送：chatStream 裸调用，零会话上下文注入（仅破限词 + 引导大纲）
  // appendUser=false 用于「编辑后重发 / 重新生成」：不新增用户消息，直接请求回复
  const doStream = async (text: string, appendUser: boolean) => {
    if (streaming || generating) return;
    const blocker = getSendBlocker();
    if (blocker) {
      ui.notify(blocker, "settings");
      return;
    }
    const provider = activeProvider!;
    if (appendUser) {
      pushMessage(createMessage("user", text));
      setInputValue("");
    }
    const assistantMsg = createMessage("assistant", "");
    pushMessage(assistantMsg);
    setStreaming(true);
    const ac = new AbortController();
    abortRef.current = ac;
    let acc = "";
    try {
      const injections = collectInjections();
      const sys = buildCreateSystemPrompt(type, guideMode, injections);
      const apiMessages = [
        { role: "system" as const, content: sys },
        ...useCreateStore.getState().messages.map((m) => ({ role: m.role as "user" | "assistant" | "system", content: m.content })),
      ];
      for await (const chunk of chatStream(
        apiMessages,
        activeModel,
        provider.baseUrl,
        provider.apiKey,
        false,
        undefined,
        ac.signal,
      )) {
        acc += chunk.content;
        updateLastAssistant(acc);
      }
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError")) {
        console.warn("[create] send failed:", e);
        if (acc) updateLastAssistant(acc);
        else {
          updateLastAssistant("（回复失败，请重试）");
        }
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  };

  const handleSend = () => {
    const text = inputValue.trim();
    if (!text) return;
    void doStream(text, true);
  };

  // 复制消息
  const copyMessage = (content: string) => {
    if (!content) return;
    navigator.clipboard?.writeText(content).then(
      () => ui.notify("已复制"),
      () => ui.notify("复制失败"),
    );
  };

  // 开始编辑消息
  const startEdit = (id: string, role: Message["role"], content: string) => {
    setEditingMsg({ id, role, content });
    setEditText(content);
  };

  // 保存编辑：用户消息=编辑并重新发送；AI 消息=直接改内容
  const saveEdit = () => {
    if (!editingMsg) return;
    const content = editText.trim();
    if (!content) return;
    const role = editingMsg.role;
    const id = editingMsg.id;
    updateMessage(id, { content });
    setEditingMsg(null);
    setEditText("");
    if (role === "user") void doStream(content, false);
  };

  // 重新生成最后一条 AI 回复
  const handleRegenerate = async () => {
    if (streaming || generating) return;
    const msgs = useCreateStore.getState().messages;
    const last = msgs[msgs.length - 1];
    if (!last || last.role !== "assistant") return;
    const lastUser = [...msgs.slice(0, -1)].reverse().find((m) => m.role === "user");
    if (!lastUser) return;
    removeMessage(last.id);
    await doStream(lastUser.content, false);
  };

  // 生成：LLM 提炼结构化设定 → 打开预览
  const handleGenerate = async () => {
    if (streaming || generating) return;
    if (messages.length < 2) {
      ui.notify("先和设定师聊几句，再生成" + label + "设定");
      return;
    }
    const blocker = getSendBlocker();
    if (blocker) {
      ui.notify(blocker, "settings");
      return;
    }
    const provider = activeProvider!;
    setGenerating(true);
    const ac = new AbortController();
    abortRef.current = ac;
    try {
      const draft =
        type === "character"
          ? await extractCharacterForCreate({
              messages: useCreateStore.getState().messages,
              existing: savedDraft && "appearance" in savedDraft ? (savedDraft as Parameters<typeof extractCharacterForCreate>[0]["existing"]) : null,
              provider: { model: activeModel, baseUrl: provider.baseUrl, apiKey: provider.apiKey },
              signal: ac.signal,
            })
          : await extractWorld({
              messages: useCreateStore.getState().messages,
              existing: savedDraft && "entries" in savedDraft ? (savedDraft as Parameters<typeof extractWorld>[0]["existing"]) : null,
              provider: { model: activeModel, baseUrl: provider.baseUrl, apiKey: provider.apiKey },
              signal: ac.signal,
            });
      if (!draft) {
        ui.notify("生成结果解析失败，请补充描述后重试");
        return;
      }
      setPreview(draft);
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError")) {
        console.warn("[create] generate failed:", e);
        ui.notify("生成失败，请重试");
      }
    } finally {
      setGenerating(false);
      abortRef.current = null;
    }
  };

  const isLastStreaming = (index: number) => streaming && index === messages.length - 1 && messages[index].role === "assistant";

  return (
    <div
      className={`theme-${ui.effectiveTheme()}`}
      style={{
        position: "fixed",
        top: isAndroid ? 0 : 40,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 200,
        display: "flex", flexDirection: "column",
        background: "var(--seed-bg)",
      }}
    >
      {/* 顶部引导横幅：创建模式专属，与普通会话明显区分 */}
      <div style={{ padding: "14px 18px 12px", borderBottom: "1px solid var(--seed-border)", background: "linear-gradient(180deg, var(--seed-accent-bg), transparent)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", rowGap: 8, maxWidth: 860, margin: "0 auto" }}>
          <button
            onClick={() => { abortRef.current?.abort(); ui.setCreateMode(null); }}
            title="返回"
            style={{ width: 32, height: 32, borderRadius: 9, border: "none", background: "transparent", color: "var(--seed-muted)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}
          >
            <ArrowLeft size={17} />
          </button>

            <div style={{ display: "flex", alignItems: "center", gap: 7, flexShrink: 0, minWidth: 0 }}>
              <div style={{ width: 30, height: 30, borderRadius: 9, background: "var(--seed-accent)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                {type === "character" ? <User size={15} style={{ color: "#fff" }} /> : <Globe size={15} style={{ color: "#fff" }} />}
              </div>
              <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                <span style={{ fontSize: "var(--fs-13)", fontWeight: 600, color: "var(--seed-fg)", lineHeight: 1.2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  创建模式 · {label}
                </span>
                <span style={{ fontSize: "var(--fs-10)", color: "var(--seed-accent)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>与设定师对话，完成后自动生成</span>
              </div>
            </div>

          {/* 引导方式切换 */}
          <div style={{ display: "flex", gap: 3, padding: 3, background: "var(--seed-input-bg)", borderRadius: 999, border: "1px solid var(--seed-border)", marginLeft: 6 }}>
            {(["ask", "free"] as GuideMode[]).map((m) => (
              <button
                key={m}
                onClick={() => handleGuideModeChange(m)}
                style={{
                  padding: "4px 12px", borderRadius: 999, border: "none", cursor: "pointer",
                  fontSize: "var(--fs-10)", fontWeight: 500, fontFamily: "inherit",
                  background: guideMode === m ? "var(--seed-accent)" : "transparent",
                  color: guideMode === m ? "#fff" : "var(--seed-muted)",
                  transition: "all 0.15s",
                }}
              >
                {m === "ask" ? "AI 提问" : "自由描述"}
              </button>
            ))}
          </div>

          <div style={{ flex: 1 }} />

          {/* 模型切换（与会话同源：providerStore.activeModel，选择后同步当前会话） */}
          <div ref={modelBtnRef} style={{ position: "relative", flexShrink: 0 }}>
            <button
              onClick={() => setModelMenuOpen((v) => !v)}
              title="切换模型"
              style={{ display: "flex", alignItems: "center", gap: 4, padding: "5px 10px", borderRadius: 999, border: "1px solid var(--seed-border)", background: "var(--seed-surface)", color: "var(--seed-muted)", fontSize: "var(--fs-10)", fontFamily: "inherit", cursor: "pointer", maxWidth: 180, overflow: "hidden" }}
            >
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{activeModel || "选择模型"}</span>
              <ChevronDown size={11} style={{ flexShrink: 0, transform: modelMenuOpen ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} />
            </button>
            {modelMenuOpen && (
              <div style={{
                position: "absolute", top: "calc(100% + 6px)", right: 0, minWidth: 200, maxWidth: 260, maxHeight: 280, overflowY: "auto",
                background: "var(--seed-surface)", border: "1px solid var(--seed-border)", borderRadius: 12,
                boxShadow: "0 8px 30px rgba(0,0,0,0.25)", padding: 4, zIndex: 30,
              }}>
                {usableProviders.map((p) => (
                  <div key={p.id}>
                    <div style={{ padding: "6px 10px 2px", fontSize: "var(--fs-9)", color: "var(--seed-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      {p.name}
                    </div>
                    {p.models.map((m) => {
                      const isActive = p.id === activeProviderId && m === activeModel;
                      return (
                        <div
                          key={m}
                          onClick={() => applyCreateModel(p.id, m)}
                          style={{
                            display: "flex", alignItems: "center", gap: 8, padding: "7px 10px", borderRadius: 8,
                            fontSize: "var(--fs-12)", cursor: "pointer", color: isActive ? "var(--seed-accent)" : "var(--seed-fg)",
                            background: isActive ? "var(--seed-accent-bg)" : "transparent",
                          }}
                        >
                          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{m}</span>
                          {isActive && <Check size={12} style={{ flexShrink: 0 }} />}
                        </div>
                      );
                    })}
                  </div>
                ))}
                {usableProviders.length === 0 && (
                  <div style={{ padding: "10px", fontSize: "var(--fs-11)", color: "var(--seed-muted)" }}>未配置可用的模型服务，请先在设置中启用并配置 API Key</div>
                )}
              </div>
            )}
          </div>

          {/* 历史记录 */}
          <button
            onClick={() => setHistoryOpen(true)}
            title="历史记录"
            style={{ width: 32, height: 32, borderRadius: 9, border: "1px solid var(--seed-border)", background: "var(--seed-surface)", color: "var(--seed-muted)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}
          >
            <History size={15} />
          </button>
        </div>

        {/* 生成中状态条 */}
        {generating && (
          <div style={{ maxWidth: 860, margin: "10px auto 0", display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", borderRadius: 10, background: "var(--seed-accent-bg)", border: "1px solid var(--seed-accent-border)", color: "var(--seed-accent)", fontSize: "var(--fs-11)" }}>
            <Loader2 size={13} style={{ animation: "spin 0.9s linear infinite" }} />
            正在把对话提炼成{label}设定...
            <button
              onClick={() => abortRef.current?.abort()}
              style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 4, border: "none", background: "transparent", color: "var(--seed-accent)", fontSize: "var(--fs-10)", cursor: "pointer", fontFamily: "inherit" }}
            >
              <Square size={10} fill="currentColor" /> 停止
            </button>
          </div>
        )}
      </div>

      {/* 消息区 */}
      <div ref={scrollRef} onScroll={handleScroll} style={{ flex: 1, overflowY: "auto", padding: "18px 20px 8px", background: "color-mix(in srgb, var(--seed-accent-bg) 12%, var(--seed-bg))" }}>
        <div style={{ maxWidth: 860, margin: "0 auto", display: "flex", flexDirection: "column", gap: 14 }}>
          {messages.map((m, i) => {
            const streamingThis = isLastStreaming(i);
            const isUser = m.role === "user";
            const isEditing = editingMsg?.id === m.id;
            return (
              <div key={m.id} className="cr-msg" style={{ display: "flex", flexDirection: isUser ? "row-reverse" : "row", gap: 10, alignItems: "flex-start" }}>
                <div
                  style={{
                    width: 30, height: 30, borderRadius: "50%", flexShrink: 0,
                    background: isUser ? "var(--seed-accent)" : "var(--seed-surface)",
                    border: isUser ? "none" : "1px solid var(--seed-border)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}
                >
                  {isUser ? <User size={14} style={{ color: "#fff" }} /> : <Sparkles size={14} style={{ color: "var(--seed-accent)" }} />}
                </div>
                <div style={{ maxWidth: "78%", display: "flex", flexDirection: "column", gap: 4, alignItems: isUser ? "flex-end" : "flex-start" }}>
                  {!isUser && (
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: "var(--fs-9)", padding: "1px 7px", borderRadius: 999, background: "var(--seed-accent-bg)", color: "var(--seed-accent)" }}>
                        {m.opening ? `问 1/${guideQuestions.length}` : "设定师"}
                      </span>
                      {m.opening && (
                        <span style={{ fontSize: "var(--fs-9)", color: "var(--seed-muted)" }}>AI 引导</span>
                      )}
                    </div>
                  )}
                  {isEditing ? (
                    <div style={{ width: "100%", padding: 10, borderRadius: 14, background: "var(--seed-surface)", border: "1px solid var(--seed-accent-border)", display: "flex", flexDirection: "column", gap: 8 }}>
                      <textarea
                        autoFocus
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        onInput={(e) => fitTextarea(e.currentTarget, 240)}
                        rows={3}
                        style={{
                          width: "100%", boxSizing: "border-box", padding: "8px 10px", borderRadius: 8,
                          background: "var(--seed-input-bg)", border: "1px solid var(--seed-border)",
                          color: "var(--seed-fg)", fontSize: "var(--fs-13)", fontFamily: "inherit",
                          outline: "none", resize: "none", lineHeight: 1.6,
                        }}
                      />
                      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                        <button onClick={() => setEditingMsg(null)} style={actionBtnSecondary}>取消</button>
                        <button onClick={saveEdit} disabled={!editText.trim()} style={actionBtnPrimary}>{isUser ? "保存并重新发送" : "保存"}</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div
                        style={{
                          padding: "10px 14px", borderRadius: 14,
                          background: isUser ? "var(--seed-accent)" : "var(--seed-surface)",
                          border: isUser ? "none" : "1px solid var(--seed-border)",
                          color: isUser ? "#fff" : "var(--seed-fg)",
                          fontSize: "var(--fs-13)", lineHeight: 1.65, whiteSpace: "pre-wrap", wordBreak: "break-word",
                        }}
                      >
                        {streamingThis ? (
                          <StreamingText content={m.content} active />
                        ) : (
                          m.content || ""
                        )}
                      </div>
                      {!streamingThis && (
                        <div className="cr-msg-actions" style={{ display: "flex", gap: 2, opacity: 0, transition: "opacity 0.12s" }}>
                          <button onClick={() => copyMessage(m.content)} title="复制" style={actionBtnIcon}>
                            <Copy size={12} />
                          </button>
                          {!m.opening && (
                            <button onClick={() => startEdit(m.id, m.role, m.content)} title={isUser ? "编辑并重新发送" : "编辑回复"} style={actionBtnIcon}>
                              <Pencil size={12} />
                            </button>
                          )}
                          {!isUser && !m.opening && i === messages.length - 1 && (
                            <button onClick={() => void handleRegenerate()} title="重新生成" style={actionBtnIcon}>
                              <RotateCw size={12} />
                            </button>
                          )}
                          {!m.opening && (
                            <button onClick={() => removeMessage(m.id)} title="删除" style={actionBtnIcon}>
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
          {messages.length === 0 && (
            <div style={{ padding: "60px 0", textAlign: "center", color: "var(--seed-muted)", fontSize: "var(--fs-12)" }}>加载中...</div>
          )}
        </div>
      </div>

      {/* 输入区 */}
      <div style={{ padding: "12px 20px 16px", borderTop: "1px solid var(--seed-border)", background: "var(--seed-bg)" }}>
        <div style={{ maxWidth: 860, margin: "0 auto", display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
            <textarea
              ref={inputRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onInput={(e) => fitTextarea(e.currentTarget, 140)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void handleSend();
                }
              }}
              placeholder={type === "character" ? "回答设定师的问题，或直接描述你想要的角色..." : "回答设定师的问题，或直接描述你想要的的世界..."}
              rows={2}
              style={{
                flex: 1, resize: "none", padding: "10px 14px", borderRadius: 14,
                background: "var(--seed-input-bg)", border: "1px solid var(--seed-border)",
                color: "var(--seed-fg)", fontSize: "var(--fs-13)", fontFamily: "inherit",
                outline: "none", minHeight: 44, maxHeight: 140, lineHeight: 1.5,
              }}
            />
            <button
              onClick={() => {
                if (streaming) { abortRef.current?.abort(); return; }
                void handleSend();
              }}
              disabled={!inputValue.trim() || generating}
              title={streaming ? "停止生成" : "发送"}
              style={{
                width: 38, height: 38, borderRadius: 12, border: "none", flexShrink: 0,
                background: inputValue.trim() && !streaming && !generating ? "var(--seed-accent)" : "var(--seed-hover-bg)",
                color: inputValue.trim() && !streaming && !generating ? "#fff" : "var(--seed-muted)",                display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
              }}
            >
              {streaming ? <Square size={14} fill="currentColor" /> : <Send size={15} />}
            </button>
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
            <span style={{ fontSize: "var(--fs-10)", color: "var(--seed-muted)" }}>Enter 发送 · Shift+Enter 换行 · Esc 退出</span>
            <button
              onClick={() => void handleGenerate()}
              disabled={streaming || generating || messages.length < 2}
              title="把对话提炼成完整设定"
              style={{
                display: "flex", alignItems: "center", gap: 6, padding: "8px 20px", borderRadius: 999,
                border: "none", cursor: generating || streaming || messages.length < 2 ? "not-allowed" : "pointer",
                background: generating || streaming || messages.length < 2 ? "var(--seed-hover-bg)" : "var(--seed-accent)",
                color: generating || streaming || messages.length < 2 ? "var(--seed-muted)" : "#fff",
                fontSize: "var(--fs-12)", fontWeight: 600, fontFamily: "inherit",
                opacity: generating || streaming || messages.length < 2 ? 0.6 : 1,
              }}
            >
              {generating ? <Loader2 size={14} style={{ animation: "spin 0.9s linear infinite" }} /> : <Wand2 size={14} />}
              {generating ? "生成中..." : `生成${label}设定`}
            </button>
          </div>
        </div>
      </div>

      {/* 预览层 */}
      {preview && <DraftPreview />}

      {/* 历史抽屉 */}
      {historyOpen && <CreateHistory onClose={() => setHistoryOpen(false)} />}

      {/* 切换引导方式：已聊过时确认重置 */}
      {pendingGuide && (
        <ConfirmDialog
          title="切换引导方式"
          message={`将清空当前对话并重新开始（${pendingGuide === "free" ? "自由描述" : "AI 提问"}模式）。确定切换？`}
          confirmLabel="清空并切换"
          onConfirm={confirmGuideChange}
          onCancel={() => setPendingGuide(null)}
        />
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .cr-msg:hover .cr-msg-actions { opacity: 1 !important; }
        .cr-msg-actions button:hover { color: var(--seed-accent) !important; }
      `}</style>
    </div>
  );
}
