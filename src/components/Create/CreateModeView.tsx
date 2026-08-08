import { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, Wand2, Loader2, Check, ChevronDown, Copy, Pencil, RotateCw, Trash2, History, Sparkles } from "lucide-react";
import { useUIStore } from "@/stores/uiStore";
import { useProviderStore } from "@/stores/providerStore";
import { useSessionStore } from "@/stores/sessionStore";
import { usePromptInjectionStore } from "@/stores/promptInjectionStore";
import { useCreateStore, createMessage } from "@/stores/createStore";
import { buildCreateSystemPrompt, buildLocalOpening, GUIDE_LABEL, type GuideMode } from "@/lib/createGuide";
import { extractCharacterForCreate } from "@/lib/characterExtract";
import { extractWorld } from "@/lib/worldExtract";
import { chatStream } from "@/providers/openai";
import { getSendBlocker } from "@/hooks/useChat";
import { fitTextarea } from "@/lib/autoGrow";
import { StreamingText } from "@/components/Chat/StreamingText";
import { MarkdownRender } from "@/components/Chat/MarkdownRender";
import { DraftPreview } from "./DraftPreview";
import { CreateHistory } from "./CreateHistory";
import { ConfirmDialog } from "@/components/Layout/ConfirmDialog";
import type { Message } from "@/types";
import type { AnimPhase } from "@/hooks/useAnimatedVisibility";

export function CreateModeView({ phase = "in" }: { phase?: AnimPhase }) {
  const ui = useUIStore();
  // Android 无自绘标题栏（TitleBar 不渲染），创建模式从顶部 0 开始；桌面端避开 40px 标题栏
  const isAndroid = typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent);
  const { type, guideMode, messages, streaming, generating, preview, savedDraft } = useCreateStore();
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
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const [guideMenuOpen, setGuideMenuOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [pendingGuide, setPendingGuide] = useState<GuideMode | null>(null);
  const [editingMsg, setEditingMsg] = useState<{ id: string; role: Message["role"]; content: string } | null>(null);
  const [editText, setEditText] = useState("");
  const modelBtnRef = useRef<HTMLDivElement>(null);
  const guideBtnRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);
  // 窄屏（手机）：底栏两行布局，生成按钮独立一行不被挤到滚动区外
  const [isNarrow, setIsNarrow] = useState(() => typeof window !== "undefined" && window.matchMedia("(max-width: 720px)").matches);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 720px)");
    const handler = (e: MediaQueryListEvent) => setIsNarrow(e.matches);
    mq.addEventListener("change", handler);
    setIsNarrow(mq.matches);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const activeProvider = providers.find((p) => p.id === activeProviderId);
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
    if (m === guideMode) { setGuideMenuOpen(false); return; }
    const msgs = useCreateStore.getState().messages;
    if (msgs.length <= 1) {
      useCreateStore.getState().setGuideMode(m);
      const cur = useCreateStore.getState().messages;
      if (cur.length === 1 && cur[0].opening) {
        useCreateStore.setState({
          messages: [{ ...cur[0], content: buildLocalOpening(type, m) }],
        });
      }
      setGuideMenuOpen(false);
    } else {
      setPendingGuide(m);
    }
  };

  const confirmGuideChange = () => {
    if (!pendingGuide) return;
    const m = pendingGuide;
    useCreateStore.getState().setGuideMode(m);
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

  // Esc：先关模型菜单/引导菜单/历史抽屉，再关创建模式
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (modelMenuOpen) { setModelMenuOpen(false); return; }
      if (guideMenuOpen) { setGuideMenuOpen(false); return; }
      if (historyOpen) { setHistoryOpen(false); return; }
      abortRef.current?.abort();
      useCreateStore.getState().close();
      ui.setCreateMode(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [modelMenuOpen, guideMenuOpen, historyOpen, ui]);

  // 点击菜单外部关闭（portal 内点击不关闭）
  useEffect(() => {
    if (!modelMenuOpen && !guideMenuOpen) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      const inPortal = menuPortalRef.current ? menuPortalRef.current.contains(t) : false;
      if (modelMenuOpen && modelBtnRef.current && !modelBtnRef.current.contains(t) && !inPortal) setModelMenuOpen(false);
      if (guideMenuOpen && guideBtnRef.current && !guideBtnRef.current.contains(t) && !inPortal) setGuideMenuOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [modelMenuOpen, guideMenuOpen]);

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
    const st = useCreateStore.getState();
    if (st.streaming || st.generating) return;
    const blocker = getSendBlocker();
    if (blocker) {
      ui.notify(blocker, "settings");
      return;
    }
    const provider = activeProvider!;
    if (appendUser) {
      useCreateStore.getState().pushMessage(createMessage("user", text));
      setInputValue("");
    }
    const assistantMsg = createMessage("assistant", "");
    useCreateStore.getState().pushMessage(assistantMsg);
    useCreateStore.getState().setStreaming(true);
    const ac = new AbortController();
    abortRef.current = ac;
    let acc = "";
    try {
      const injections = collectInjections();
      const sys = buildCreateSystemPrompt(type, useCreateStore.getState().guideMode, injections);
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
        useCreateStore.getState().updateLastAssistant(acc);
      }
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError")) {
        console.warn("[create] send failed:", e);
        if (acc) useCreateStore.getState().updateLastAssistant(acc);
        else useCreateStore.getState().updateLastAssistant("（回复失败，请重试）");
      }
    } finally {
      useCreateStore.getState().setStreaming(false);
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
    useCreateStore.getState().updateMessage(id, { content });
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
    useCreateStore.getState().removeMessage(last.id);
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
    useCreateStore.getState().setGenerating(true);
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
      useCreateStore.getState().setPreview(draft);
    } catch (e) {
      if (!(e instanceof DOMException && e.name === "AbortError")) {
        console.warn("[create] generate failed:", e);
        ui.notify("生成失败，请重试");
      }
    } finally {
      useCreateStore.getState().setGenerating(false);
      abortRef.current = null;
    }
  };

  const isLastStreaming = (index: number) => streaming && index === messages.length - 1 && messages[index].role === "assistant";
  const canGenerate = messages.length >= 2;
  // 菜单基础样式：实体背景（无 backdrop-filter，避免 Tauri WebView 渲染伪影），定位由 portal fixed 覆盖
  const menuStyle: React.CSSProperties = {
    position: "fixed",
    minWidth: 200,
    maxWidth: 260,
    maxHeight: 280,
    overflowY: "auto",
    background: "var(--seed-surface)",
    border: "1px solid var(--seed-border)",
    borderRadius: 12,
    boxShadow: "0 8px 30px rgba(0,0,0,0.25)",
    padding: 4,
    zIndex: 300,
  };
  const itemStyle = (active: boolean): React.CSSProperties => ({
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "7px 10px",
    borderRadius: 8,
    fontSize: 12,
    cursor: "pointer",
    background: active ? "var(--seed-accent-bg)" : "transparent",
    color: active ? "var(--seed-accent)" : "var(--seed-fg)",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  });

  // 菜单定位：向上弹出（bottom = chip 顶部 + 6px），left 防溢出视口
  const menuPortalRef = useRef<HTMLDivElement>(null);
  const guideRect = guideMenuOpen && guideBtnRef.current ? guideBtnRef.current.getBoundingClientRect() : null;
  const modelRect = modelMenuOpen && modelBtnRef.current ? modelBtnRef.current.getBoundingClientRect() : null;
  const menuPos = (rect: DOMRect, w = 240) => ({
    bottom: window.innerHeight - rect.top + 6,
    left: Math.max(8, Math.min(rect.left, window.innerWidth - w - 8)),
  });

  return (
    <div
      className={`theme-${ui.effectiveTheme()} ` + (phase === "in" ? "anim-sheet-in" : phase === "out" ? "anim-sheet-out" : "anim-init")}
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
      {/* 消息区：与空白会话一致的排版（安卓避开系统状态栏） */}
      <div ref={scrollRef} onScroll={handleScroll} style={{ flex: 1, overflowY: "auto", paddingTop: isAndroid ? "calc(env(safe-area-inset-top, 0px) + 16px)" : undefined }}>
        <div style={{ maxWidth: 720, margin: "0 auto", padding: "24px 24px 8px" }}>
          {messages.map((m, i) => {
            // 未完成的流式占位（空内容）不渲染，由 typing 指示器代替
            if (m.role === "assistant" && !m.content) return null;
            const streamingThis = isLastStreaming(i);
            const isUser = m.role === "user";
            const isEditing = editingMsg?.id === m.id;
            const isLastAssistant = !isUser && i === messages.length - 1;

            if (isEditing) {
              return (
                <div key={m.id} className="seed-edit-block">
                  <textarea
                    className="seed-edit-textarea"
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    onInput={(e) => fitTextarea(e.currentTarget, 260)}
                    autoFocus
                    rows={3}
                  />
                  <div className="seed-edit-actions">
                    <button className="seed-edit-btn seed-edit-btn--cancel" onClick={() => setEditingMsg(null)}>取消</button>
                    <button className="seed-edit-btn seed-edit-btn--save" onClick={saveEdit} disabled={!editText.trim()}>
                      {isUser ? "保存并发送" : "保存"}
                    </button>
                  </div>
                </div>
              );
            }

            return (
              <div key={m.id} className="seed-msg-wrapper" style={{ marginBottom: 20 }}>
                {isUser ? (
                  <p className="seed-user-input">{m.content}</p>
                ) : (
                  <div className="seed-chat-assistant">
                    {streamingThis ? (
                      <StreamingText content={m.content} active />
                    ) : (
                      <MarkdownRender content={m.content} />
                    )}
                  </div>
                )}
                {!streamingThis && (
                  <div className="seed-msg-actions">
                    <button className="seed-msg-action-btn" data-tooltip="复制" onClick={() => copyMessage(m.content)}>
                      <Copy size={13} />
                    </button>
                    {!m.opening && (
                      <button className="seed-msg-action-btn" data-tooltip={isUser ? "编辑并发送" : "编辑回复"} onClick={() => startEdit(m.id, m.role, m.content)}>
                        <Pencil size={13} />
                      </button>
                    )}
                    {!isUser && !m.opening && isLastAssistant && (
                      <button className="seed-msg-action-btn" data-tooltip="重新生成" onClick={() => void handleRegenerate()}>
                        <RotateCw size={13} />
                      </button>
                    )}
                    {!m.opening && (
                      <button className="seed-msg-action-btn" data-tooltip="删除" onClick={() => useCreateStore.getState().removeMessage(m.id)}>
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* 流式中打字机指示器 */}
          {streaming && messages.length > 0 && !messages[messages.length - 1].content && (
            <div className="seed-typing"><span /><span /><span /></div>
          )}

          {messages.length === 0 && (
            <div style={{ textAlign: "center", padding: "80px 0", color: "var(--seed-muted)" }}>
              <p style={{ fontSize: 16, marginBottom: 8 }}>加载中...</p>
            </div>
          )}
        </div>
      </div>

      {/* 底部输入区：与空白会话一致 */}
      <div className="seed-input-area">
        <div className="seed-input-inner" style={isAndroid ? { paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)" } : undefined}>
          <div className="seed-input-row">
            <textarea
              className="seed-text-input"
              placeholder={type === "character" ? "描述你想创建的角色" : "描述你想创建的规则书"}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              onInput={(e) => fitTextarea(e.currentTarget, 160)}
              rows={1}
              disabled={streaming || generating}
              style={{ resize: "none" }}
            />
            {streaming ? (
              <button className="seed-send-btn" data-tooltip="停止生成" onClick={() => abortRef.current?.abort()} style={{ background: "var(--danger, #ef4444)" }}>
                <svg viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
              </button>
            ) : (
              <button className="seed-send-btn" data-tooltip="发送" onClick={handleSend} disabled={!inputValue.trim() || generating}>
                <svg viewBox="0 0 24 24">
                  <line x1="12" y1="19" x2="12" y2="5" />
                  <polyline points="5 12 12 5 19 12" />
                </svg>
              </button>
            )}
          </div>

          {/* 底栏：返回/引导/模型 靠左，历史/生成 靠右；窄屏两行（生成独立全宽） */}
          <div style={{ display: "flex", flexDirection: "column", gap: isNarrow ? 10 : 0 }}>
            <div className="seed-func-bar">
              <button
                className="seed-func-btn"
                data-tooltip="返回"
                onClick={() => { abortRef.current?.abort(); useCreateStore.getState().close(); ui.setCreateMode(null); }}
              >
                <ArrowLeft size={16} />
              </button>

              {/* 引导方式切换 */}
              <div ref={guideBtnRef}>
                <button
                  className="seed-func-chip"
                  disabled={generating}
                  data-tooltip="对话引导方式"
                  onClick={() => setGuideMenuOpen((v) => !v)}
                >
                  <Sparkles size={13} style={{ flexShrink: 0 }} />
                  <span>{guideMode === "ask" ? "AI 提问" : "自由描述"}</span>
                  <ChevronDown size={12} style={{ flexShrink: 0, transform: guideMenuOpen ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} />
                </button>
              </div>

              {/* 模型切换 */}
              <div ref={modelBtnRef}>
                <button
                  className="seed-func-chip"
                  disabled={generating}
                  data-tooltip={activeModel || "选择模型"}
                  onClick={() => setModelMenuOpen((v) => !v)}
                >
                  <span style={{ maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {activeModel || "选择模型"}
                  </span>
                  <ChevronDown size={12} style={{ flexShrink: 0, transform: modelMenuOpen ? "rotate(180deg)" : "none", transition: "transform 0.15s" }} />
                </button>
              </div>

              <div style={{ flex: 1 }} />

              {/* 历史记录 */}
              <button
                className="seed-func-btn"
                data-tooltip="创建历史"
                onClick={() => setHistoryOpen(true)}
              >
                <History size={16} />
              </button>

              {/* 生成设定（桌面：行内右对齐） */}
              {!isNarrow && (
                <button
                  onClick={() => { if (generating) { abortRef.current?.abort(); return; } void handleGenerate(); }}
                  disabled={streaming || !canGenerate}
                  title={!canGenerate ? "先和设定师聊几句，再生成" + label + "设定" : "把对话提炼成完整设定"}
                  style={{
                    display: "flex", alignItems: "center", gap: 6, padding: "8px 18px", borderRadius: 999,
                    border: "none", cursor: streaming || !canGenerate ? "not-allowed" : "pointer",
                    background: generating || (streaming || !canGenerate) ? "var(--seed-hover-bg)" : "var(--seed-accent)",
                    color: generating || (streaming || !canGenerate) ? "var(--seed-muted)" : "#fff",
                    fontSize: 13, fontWeight: 600, fontFamily: "inherit",
                    opacity: generating || (streaming || !canGenerate) ? 0.6 : 1,
                  }}
                >
                  {generating ? (
                    <><Loader2 size={14} style={{ animation: "spin 0.9s linear infinite" }} />停止</>
                  ) : (
                    <><Wand2 size={14} />生成{label}设定</>
                  )}
                </button>
              )}
            </div>

            {/* 窄屏：生成按钮独立一行，全宽主操作 */}
            {isNarrow && (
              <button
                onClick={() => { if (generating) { abortRef.current?.abort(); return; } void handleGenerate(); }}
                disabled={streaming || !canGenerate}
                title={!canGenerate ? "先和设定师聊几句，再生成" + label + "设定" : "把对话提炼成完整设定"}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  padding: "11px 0", borderRadius: 999, width: "100%",
                  border: "none", cursor: streaming || !canGenerate ? "not-allowed" : "pointer",
                  background: generating || (streaming || !canGenerate) ? "var(--seed-hover-bg)" : "var(--seed-accent)",
                  color: generating || (streaming || !canGenerate) ? "var(--seed-muted)" : "#fff",
                  fontSize: 13, fontWeight: 600, fontFamily: "inherit",
                  opacity: generating || (streaming || !canGenerate) ? 0.6 : 1,
                }}
              >
                {generating ? (
                  <><Loader2 size={14} style={{ animation: "spin 0.9s linear infinite" }} />停止</>
                ) : (
                  <><Wand2 size={14} />生成{label}设定</>
                )}
              </button>
            )}
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

      {/* 引导/模型菜单：portal 到 body（fixed 定位 + 实体背景，避免底栏 backdrop-filter 祖先导致安卓 WebView 弹出异常） */}
      {(guideMenuOpen || modelMenuOpen) && createPortal(
        <div className={`theme-${ui.effectiveTheme()}`} ref={menuPortalRef}>
          {guideMenuOpen && guideRect && (
            <div style={{ ...menuStyle, bottom: menuPos(guideRect, 240).bottom, left: menuPos(guideRect, 240).left, width: 240 }}>
              <div
                style={{ ...itemStyle(guideMode === "ask"), flexDirection: "column", alignItems: "stretch", gap: 2 }}
                onClick={() => handleGuideModeChange("ask")}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, width: "100%" }}>
                  <span style={{ flex: 1 }}>AI 提问</span>
                  {guideMode === "ask" && <Check size={12} style={{ flexShrink: 0 }} />}
                </div>
                <span style={{ fontSize: 11, color: "var(--seed-muted)", whiteSpace: "normal", lineHeight: 1.4 }}>设定师逐题提问，引导你完善设定</span>
              </div>
              <div
                style={{ ...itemStyle(guideMode === "free"), flexDirection: "column", alignItems: "stretch", gap: 2 }}
                onClick={() => handleGuideModeChange("free")}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, width: "100%" }}>
                  <span style={{ flex: 1 }}>自由描述</span>
                  {guideMode === "free" && <Check size={12} style={{ flexShrink: 0 }} />}
                </div>
                <span style={{ fontSize: 11, color: "var(--seed-muted)", whiteSpace: "normal", lineHeight: 1.4 }}>直接描述你的想法，结束后帮你整理</span>
              </div>
            </div>
          )}
          {modelMenuOpen && modelRect && (
            <div style={{ ...menuStyle, bottom: menuPos(modelRect, 260).bottom, left: menuPos(modelRect, 260).left, width: 260 }}>
              {usableProviders.map((p) => (
                <div key={p.id}>
                  <div style={{ padding: "6px 10px 2px", fontSize: 10, color: "var(--seed-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                    {p.name}
                  </div>
                  {p.models.map((m) => (
                    <div
                      key={m}
                      style={itemStyle(p.id === activeProviderId && m === activeModel)}
                      onClick={() => applyCreateModel(p.id, m)}
                    >
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{m}</span>
                      {p.id === activeProviderId && m === activeModel && <Check size={12} style={{ flexShrink: 0 }} />}
                    </div>
                  ))}
                </div>
              ))}
              {usableProviders.length === 0 && (
                <div style={{ padding: "10px", fontSize: 12, color: "var(--seed-muted)" }}>未配置可用的模型服务，请先在设置中启用并配置 API Key</div>
              )}
            </div>
          )}
        </div>,
        document.body
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
