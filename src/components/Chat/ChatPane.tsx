import { useRef, useEffect, useState, useCallback, useMemo } from "react";
import { useChat } from "@/hooks/useChat";
import { useSessionStore } from "@/stores/sessionStore";
import { useProviderStore } from "@/stores/providerStore";
import { useUIStore } from "@/stores/uiStore";
import { useWorldStore } from "@/stores/worldStore";
import { isThinkingModel } from "@/providers/openai";
import { MessageBubble } from "./MessageBubble";
import { MessageInput } from "./MessageInput";

import { ConfirmDialog } from "@/components/Layout/ConfirmDialog";
import { Plus, MessageSquare, Sparkles, Bot, Settings2, X, ChevronDown, Search, Type, Check, Globe, Wifi } from "lucide-react";

export function ChatPane() {
  const { messages, streaming, toolRunning, loadingMessages, sendMessage, stopStreaming, deleteMessage, editMessage, regenerate, editAndSend } = useChat();
  const { sessions, activeId, add, updateSystemPrompt, searchResults, searching, doSearch, clearSearch, jumpToMessage, targetMessageId, clearTargetMessage } = useSessionStore();
  const { providers, activeProviderId, activeModel } = useProviderStore();
  const { activeBook } = useWorldStore();
  const { messageFontSize, setMessageFontSize, webSearchOn } = useUIStore();
  const scrollRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);
  const activeSession = sessions.find((s) => s.id === activeId);
  const [animating, setAnimating] = useState(false);
  const prevSessionIdRef = useRef<string | null | undefined>(undefined);
  const messageRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // System prompt editor state
  const [promptEditorOpen, setPromptEditorOpen] = useState(false);
  const [promptText, setPromptText] = useState("");
  const promptEditorRef = useRef<HTMLDivElement>(null);

  // Search state
  const [searchInput, setSearchInput] = useState("");
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [searchFocused, setSearchFocused] = useState(false);

  // Settings menu state
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);

  // Message delete confirmation state
  const [deleteMsgTarget, setDeleteMsgTarget] = useState<string | null>(null);

  const openPromptEditor = useCallback(() => {
    setPromptText(activeSession?.systemPrompt ?? "");
    setPromptEditorOpen(true);
  }, [activeSession]);

  const contextTokens = useMemo(() => {
    let total = 0;
    if (activeSession?.systemPrompt) total += Math.ceil(activeSession.systemPrompt.length / 2);
    for (const m of messages) {
      total += Math.ceil((m.content.length + (m.thinking?.length ?? 0)) / 2);
    }
    return total;
  }, [messages, activeSession?.systemPrompt]);

  const savePrompt = useCallback(() => {
    if (activeSession?.id) {
      updateSystemPrompt(activeSession.id, promptText);
      setPromptEditorOpen(false);
    }
  }, [activeSession, promptText, updateSystemPrompt]);

  const clearPrompt = useCallback(() => {
    setPromptText("");
    if (activeSession?.id) {
      updateSystemPrompt(activeSession.id, "");
    }
  }, [activeSession, updateSystemPrompt]);

  // Search handlers
  const handleSearchInput = useCallback((value: string) => {
    setSearchInput(value);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (!value.trim()) {
      clearSearch();
      return;
    }
    searchTimerRef.current = setTimeout(() => {
      doSearch(value);
    }, 250);
  }, [doSearch, clearSearch]);

  const clearSearchInput = useCallback(() => {
    setSearchInput("");
    clearSearch();
    searchInputRef.current?.focus();
  }, [clearSearch]);

  // Close on outside click
  useEffect(() => {
    if (!promptEditorOpen && !settingsOpen) return;
    const handler = (e: MouseEvent) => {
      if (promptEditorOpen && promptEditorRef.current && !promptEditorRef.current.contains(e.target as Node)) {
        setPromptEditorOpen(false);
      }
      if (settingsOpen && settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setSettingsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [promptEditorOpen, settingsOpen]);

  // 智能滚动：仅在用户位于底部时跟随流式输出
  // 流式输出时每帧检查是否跟随滚动（StreamingText 内部状态变化不触发本组件 re-render）
  useEffect(() => {
    if (!streaming) return;
    let rafId: number;
    const tick = () => {
      const el = scrollRef.current;
      if (el && isAtBottomRef.current) {
        el.scrollTop = el.scrollHeight;
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [streaming]);

  // 非流式时：消息变化或流式结束时，若在底部则跳到底
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (isAtBottomRef.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages, streaming]);

  // 跟踪用户是否在底部
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const handleScroll = () => {
      const threshold = 80;
      isAtBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
    };
    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (prevSessionIdRef.current !== activeId) {
      setAnimating(false);
      prevSessionIdRef.current = activeId;
      isAtBottomRef.current = true;
    }
  }, [activeId]);

  useEffect(() => {
    if (!loadingMessages) {
      requestAnimationFrame(() => setAnimating(true));
    } else {
      setAnimating(false);
    }
  }, [loadingMessages, messages]);

  // Jump to search match
  useEffect(() => {
    if (targetMessageId && messages.length > 0 && !loadingMessages) {
      requestAnimationFrame(() => {
        const el = messageRefs.current.get(targetMessageId);
        if (el) {
          el.scrollIntoView({ behavior: "smooth", block: "center" });
          el.style.transition = "background 0.3s ease";
          el.style.background = "var(--accent-bg)";
          setTimeout(() => { el.style.background = ""; }, 1500);
        }
        clearTargetMessage();
      });
    }
  }, [targetMessageId, messages, loadingMessages, clearTargetMessage]);

  if (!activeId) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-5 txt-tertiary">
        <div className="relative">
          <div className="w-16 h-16 rd-16 grad-sb flex items-center justify-center bg-card">
            <Bot size={28} className="txt-muted" strokeWidth={1.5} />
          </div>
          <div className="absolute" style={{ bottom: -4, right: -4, width: 20, height: 20, borderRadius: "50%", background: "var(--accent-bg)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Sparkles size={10} style={{ color: "var(--accent)" }} />
          </div>
        </div>
        <div className="text-center">
          <p className="text-sm font-medium mb-1 txt-secondary">欢迎使用 AIRP</p>
          <p className="text-xs txt-tertiary">选择一个会话或新建一个开始聊天</p>
        </div>
        <button onClick={() => { const pid = activeProviderId ?? providers[0]?.id ?? ""; const wr = activeBook ? "【世界观：" + activeBook.name + "】\n" + activeBook.entries.map(e => e.content).join("\n") + "\n\n" : ""; add({ id: crypto.randomUUID(), title: "新对话 " + (sessions.length + 1), systemPrompt: wr, providerId: pid, model: activeModel, thinkingEnabled: isThinkingModel(activeModel ?? ""), createdAt: Date.now(), updatedAt: Date.now() }); }}
          className="btn-ghost-accent flex items-center gap-2" style={{padding:"10px 16px"}}>
          <Plus size={14} /> 新建会话
        </button>
      </div>
    );
  }

  const hasSystemPrompt = !!(activeSession?.systemPrompt && activeSession.systemPrompt.trim());
  const showSearchResults = searchInput.trim().length > 0;

  const fontOptions: { key: string; label: string }[] = [
    { key: "xs", label: "小" },
    { key: "sm", label: "默认" },
    { key: "md", label: "中" },
    { key: "lg", label: "大" },
    { key: "xl", label: "超大" },
  ];

  return (
    <div className="flex-1 flex flex-col min-w-0" style={{ overflow: "hidden" }}>
      {/* Compact header with search + settings */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-light">
        <div className="flex items-center gap-2 min-w-0">
          {/* Breadcrumb */}
          <div
            onClick={openPromptEditor}
            className="flex items-center gap-1-5 min-w-0 cp"
            title="点击设置提示词"
            style={{ padding: "3px 6px", margin: "-3px -6px", borderRadius: 6, transition: "background 0.15s ease" }}
          >
            <div className="w-5 h-5 rd-6 bg-accent flex items-center justify-center shrink-0">
              <MessageSquare size={10} style={{ color: "var(--accent)", opacity: 0.6 }} strokeWidth={1.5} />
            </div>
            <span className="text-sm font-medium txt-secondary truncate max-w-32">{activeSession?.title ?? "对话"}</span>
            {hasSystemPrompt && (
              <span style={{ fontSize: "var(--fs-8)", padding: "0 4px", borderRadius: 3, background: "var(--accent-bg)", color: "var(--accent)", fontWeight: 600, letterSpacing: 0.3, lineHeight: 1.4 }}>
                PROMPT
              </span>
            )}
            <ChevronDown size={10} style={{ color: "var(--text-muted)", opacity: 0.4 }} />
          </div>

          <span style={{ color: "var(--text-muted)", opacity: 0.3, fontSize: "var(--fs-12)" }}>/</span>

          <div className="flex items-center gap-1 text-11 txt-tertiary">
            {activeBook && (
              <>
                <Globe size={10} style={{ color: "var(--text-muted)" }} />
                <span className="truncate max-w-20">{activeBook.name}</span>
              </>
            )}
            {webSearchOn && (
              <span style={{ display: "flex", alignItems: "center", gap: 3, fontSize: "var(--fs-10)", color: toolRunning ? "var(--warning)" : "var(--accent)", padding: "1px 5px", borderRadius: 3, background: toolRunning ? "var(--warning-bg)" : "var(--accent-bg)", transition: "all 0.2s" }}>
                <Wifi size={9} /> {toolRunning ? "搜索中..." : "联网搜索"}
              </span>
            )}
          </div>
        </div>

        {/* Right: Search + Settings */}
        <div className="flex items-center gap-1">
          {/* Search input */}
          <div
            className="flex items-center gap-1-5 px-2 rd-6"
            style={{
              background: searchFocused ? "var(--bg-input)" : "transparent",
              border: `1px solid ${searchFocused ? "var(--accent-border)" : "transparent"}`,
              width: showSearchResults ? 220 : 160,
              transition: "all 0.2s ease",
              height: 24,
            }}
          >
            <Search size={11} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
            <input
              ref={searchInputRef}
              value={searchInput}
              onChange={(e) => handleSearchInput(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              onKeyDown={(e) => {
                if (e.key === "Escape") clearSearchInput();
              }}
              placeholder="搜索对话..."
              className="flex-1"
              style={{
                background: "transparent",
                border: "none",
                outline: "none",
                color: "var(--text-primary)",
                fontSize: "var(--fs-12)",
                fontFamily: "inherit",
                minWidth: 0,
              }}
            />
            {searchInput && (
              <button onClick={clearSearchInput} className="btn-ghost" style={{ width: 16, height: 16, padding: 0 }}>
                <X size={9} />
              </button>
            )}
          </div>

          {/* Settings dropdown */}
          <div ref={settingsRef} style={{ position: "relative" }}>
            <button
              onClick={() => setSettingsOpen(!settingsOpen)}
              className="btn-ghost"
              title="设置"
              style={{ width: 26, height: 26 }}
            >
              <Settings2 size={13} />
            </button>
            {settingsOpen && (
              <div
                style={{
                  position: "absolute",
                  top: "calc(100% + 6px)",
                  right: 0,
                  width: 220,
                  background: "var(--bg-overlay)",
                  border: "1px solid var(--border-medium)",
                  borderRadius: 12,
                  boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
                  backdropFilter: "var(--blur-md)",
                  WebkitBackdropFilter: "var(--blur-md)",
                  zIndex: "var(--z-picker)",
                  padding: "6px",
                  overflow: "hidden",
                }}
              >
                {/* 外观 category */}
                <div style={{ padding: "4px 6px 8px" }}>
                  <div style={{
                    fontSize: "var(--fs-10)",
                    color: "var(--text-muted)",
                    textTransform: "uppercase",
                    letterSpacing: 1.2,
                    marginBottom: 8,
                    fontWeight: 600,
                  }}>外观</div>

                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                    <Type size={12} style={{ color: "var(--text-muted)", opacity: 0.7, flexShrink: 0 }} />
                    <span style={{ fontSize: "var(--fs-12)", color: "var(--text-secondary)", fontWeight: 500 }}>消息字体</span>
                  </div>

                  <div style={{ display: "flex", gap: 4, paddingLeft: 18 }}>
                    {fontOptions.map((opt) => (
                      <button
                        key={opt.key}
                        onClick={() => { setMessageFontSize(opt.key as any); }}
                        className="cp"
                        style={{
                          flex: 1,
                          padding: "5px 2px",
                          fontSize: "var(--fs-11)",
                          borderRadius: 6,
                          border: `1px solid ${messageFontSize === opt.key ? "var(--accent-border)" : "var(--border-light)"}`,
                          background: messageFontSize === opt.key ? "var(--accent-bg)" : "transparent",
                          color: messageFontSize === opt.key ? "var(--accent)" : "var(--text-tertiary)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 3,
                          transition: "all 0.15s ease",
                          whiteSpace: "nowrap",
                          fontWeight: messageFontSize === opt.key ? 600 : 400,
                        }}
                        onMouseEnter={(e) => { if (messageFontSize !== opt.key) e.currentTarget.style.background = "var(--bg-hover)"; }}
                        onMouseLeave={(e) => { if (messageFontSize !== opt.key) e.currentTarget.style.background = "transparent"; }}
                      >
                        {messageFontSize === opt.key && <Check size={9} strokeWidth={2.5} />}
                        <span>{opt.label}</span>
                      </button>
                    ))}
                  </div>
                </div>


              </div>
            )}
          </div>
        </div>
      </div>

      {/* Search results dropdown */}
      {showSearchResults && (
        <div
          style={{
            margin: "0 16px",
            background: "var(--bg-card)",
            border: "1px solid var(--border-light)",
            borderRadius: 10,
            boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
            position: "relative",
            zIndex: "var(--z-popover)",
            maxHeight: 280,
            overflowY: "auto",
          }}
        >
          {searching && (
            <div className="px-3 py-3 text-center">
              <div className="typing-dot inline-b w-1-5 h-1-5 rd-full" />
              <span className="txt-tertiary text-xs ml-2">搜索中...</span>
            </div>
          )}
          {!searching && searchResults.length === 0 && (
            <div className="px-3 py-6 text-center">
              <Search size={16} style={{ color: "var(--text-muted)" }} className="mx-auto mb-2" />
              <p className="txt-tertiary text-xs">未找到匹配 "{searchInput}" 的对话</p>
            </div>
          )}
          {!searching && searchResults.length > 0 && (
            <div className="py-1">
              <div style={{ padding: "4px 10px", fontSize: "var(--fs-10)", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5 }}>
                搜索结果 ({searchResults.length})
              </div>
              {searchResults.slice(0, 20).map((r, i) => (
                <div
                  key={i}
                  onClick={() => {
                    jumpToMessage(r.sessionId, r.messageId);
                    setSearchInput("");
                    clearSearch();
                  }}
                  className="cp"
                  style={{
                    padding: "6px 10px",
                    cursor: "pointer",
                    transition: "background 0.12s ease",
                    borderBottom: i < Math.min(searchResults.length, 20) - 1 ? "1px solid var(--border-light)" : "none",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bg-hover)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <MessageSquare size={11} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                    <span style={{ fontSize: "var(--fs-12)", color: "var(--text-secondary)", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {r.sessionTitle}
                    </span>
                    {r.matchType === "title" && (
                      <span style={{ fontSize: "var(--fs-8)", padding: "0 3px", borderRadius: 2, background: "var(--accent-bg)", color: "var(--accent)" }}>标题</span>
                    )}
                  </div>
                  {r.matchType === "message" && (
                    <div style={{ fontSize: "var(--fs-11)", color: "var(--text-muted)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", paddingLeft: 17 }}>
                      {r.content.length > 80 ? r.content.slice(0, 80) + "..." : r.content}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* System prompt editor popover */}
      {promptEditorOpen && (
        <div
          ref={promptEditorRef}
          style={{
            margin: "0 16px",
            padding: 14,
            background: "var(--bg-card)",
            border: "1px solid var(--border-light)",
            borderRadius: 12,
            boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
            position: "relative",
            zIndex: "var(--z-dropdown)",
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Settings2 size={14} style={{ color: "var(--accent)" }} />
              <span className="text-sm font-medium txt-secondary">系统提示词</span>
              <span className="text-xs txt-tertiary">（注入到每条对话开头）</span>
            </div>
            <button onClick={() => setPromptEditorOpen(false)} className="btn-ghost" style={{ width: 24, height: 24 }}>
              <X size={12} />
            </button>
          </div>

          <textarea
            value={promptText}
            onChange={(e) => setPromptText(e.target.value)}
            placeholder="设定 AI 的角色、人设、专业领域、回答风格等..."
            className="w-full text-sm"
            style={{
              background: "var(--bg-input)",
              border: "1px solid var(--border-light)",
              borderRadius: 8,
              padding: 12,
              minHeight: 120,
              resize: "vertical",
              color: "var(--text-primary)",
              fontFamily: "inherit",
              fontSize: "var(--fs-13)",
              lineHeight: 1.6,
              outline: "none",
              transition: "border-color 0.15s ease",
            }}
            onFocus={(e) => (e.target.style.borderColor = "var(--accent)")}
            onBlur={(e) => (e.target.style.borderColor = "var(--border-light)")}
          />

          <div className="flex items-center justify-between mt-3">
            <span className="text-xs txt-tertiary">{promptText.length} 字符</span>
            <div className="flex items-center gap-2">
              <button onClick={clearPrompt} className="btn-ghost" style={{ fontSize: "var(--fs-12)", padding: "6px 12px" }}>
                清空
              </button>
              <button onClick={savePrompt} className="btn-ghost-accent" style={{ fontSize: "var(--fs-12)", padding: "6px 16px" }}>
                保存
              </button>
            </div>
          </div>

          <div className="mt-3 pt-3" style={{ borderTop: "1px solid var(--border-light)" }}>
            <span className="text-xs txt-muted">快速模板：</span>
            <div className="flex flex-wrap gap-1-5 mt-2">
              {["你是一个专业的程序员助手", "你是一位资深的产品经理", "你是一位耐心的老师", "你是一位创意写作助手"].map((tpl) => (
                <button key={tpl} onClick={() => setPromptText(tpl)} className="btn-ghost" style={{ fontSize: "var(--fs-11)", padding: "4px 10px", borderRadius: 6, color: "var(--text-tertiary)" }}>
                  {tpl}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div ref={scrollRef} className="flex-1 ov-ya px-4 py-3" data-msg-font={messageFontSize} style={{ minHeight: 0, overflowY: "auto", position: "relative" }}>
        <div
          className="mw-5xl mx-auto"
          style={{
            transition: "opacity 0.2s ease",
            opacity: loadingMessages ? 0 : 1,
          }}
        >
          {messages.map((msg, index) => {
            if (streaming && msg.role === "assistant" && msg.content === "" && !msg.thinking && index === messages.length - 1) {
              return null;
            }
            return (
              <div
                key={msg.id}
                ref={(el) => { if (el) messageRefs.current.set(msg.id, el); else messageRefs.current.delete(msg.id); }}
                className={animating ? "message-enter" : ""}
              >
                <MessageBubble message={msg} streaming={streaming && index === messages.length - 1} onDelete={(id) => setDeleteMsgTarget(id)} onEdit={editMessage} onRegenerate={regenerate} onEditAndSend={editAndSend} />
              </div>
            );
          })}
          {streaming && messages[messages.length - 1]?.role === "assistant" && messages[messages.length - 1]?.content === "" && !messages[messages.length - 1]?.thinking && (
            <div className="flex gap-2 mb-4 flex-row" style={{ alignItems: "flex-start" }}>
              <div className="flex rd-16 flex-row" style={{ gap: 8, padding: "8px 10px", background: "var(--bubble-ai-bg)", border: "1px solid var(--bubble-ai-border)", maxWidth: "78%" }}>
                <div className="rd-full flex items-center justify-center shrink-0" style={{ width: 26, height: 26, flex: "0 0 26px", background: "var(--bg-card)", opacity: 0.6, alignSelf: "flex-start" }}>
                  <Bot size={13} style={{ color: "var(--text-tertiary)" }} />
                </div>
                <div className="flex items-center" style={{ minHeight: 26 }}>
                  <div className="flex gap-1-5 items-center" style={{ height: 20 }}>
                    <span className="typing-dot inline-b w-1-5 h-1-5 rd-full" />
                    <span className="typing-dot inline-b w-1-5 h-1-5 rd-full" />
                    <span className="typing-dot inline-b w-1-5 h-1-5 rd-full" />
                  </div>
                </div>
              </div>
            </div>
          )}
          {!streaming && messages.length === 0 && (
            <div className="flex items-center justify-center h-full" style={{ minHeight: 200 }}>
              <div className="text-center">
                <Sparkles size={20} strokeWidth={1} className="mx-auto mb-2" style={{ color: "var(--text-muted)" }} />
                <p className="txt-tertiary text-xs">开始一段新的对话</p>
              </div>
            </div>
          )}
        </div>

        {loadingMessages && (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-app)", transition: "opacity 0.15s ease", opacity: loadingMessages ? 1 : 0, pointerEvents: loadingMessages ? "auto" : "none" }}>
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <div className="typing-dot inline-b w-1-5 h-1-5 rd-full" />
                <div className="typing-dot inline-b w-1-5 h-1-5 rd-full" />
                <div className="typing-dot inline-b w-1-5 h-1-5 rd-full" />
              </div>
              <p className="txt-tertiary text-xs">加载中...</p>
            </div>
          </div>
        )}
      </div>

      <MessageInput onSend={sendMessage} onStop={stopStreaming} streaming={streaming} contextTokens={contextTokens} />

      {deleteMsgTarget && (
        <ConfirmDialog
          title="删除消息"
          message="确定要删除这条消息吗？删除后无法恢复。"
          confirmLabel="删除"
          cancelLabel="取消"
          onConfirm={() => { deleteMessage(deleteMsgTarget); setDeleteMsgTarget(null); }}
          onCancel={() => setDeleteMsgTarget(null)}
        />
      )}
    </div>
  );
}