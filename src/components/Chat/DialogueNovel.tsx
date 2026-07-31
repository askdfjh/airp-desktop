import { useRef, useEffect, useState, useCallback } from "react";
import { useChat, getSendBlocker } from "@/hooks/useChat";
import { useSessionStore } from "@/stores/sessionStore";
import { useUIStore } from "@/stores/uiStore";
import { StreamingText } from "./StreamingText";
import { FunctionBar } from "./FunctionBar";
import { MarkdownRender } from "./MarkdownRender";
import { parseSceneReply, type SceneInfo } from "@/lib/sceneTemplate";

export function DialogueNovel() {
  const { messages, sendMessage, streaming, stopStreaming, regenerate, editAndSend } = useChat();
  const activeSession = useSessionStore((s) =>
    s.activeId ? s.sessions.find((ss) => ss.id === s.activeId) : null
  );
  const { selectedWorldName, selectedCharacterName, selectedMode, messageFontSize, notify } = useUIStore();
  const [inputValue, setInputValue] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [sceneBarOpen, setSceneBarOpen] = useState(true);
  const [suggestBarOpen, setSuggestBarOpen] = useState(true);
  const [sceneOverflow, setSceneOverflow] = useState(false);
  const sceneMeasureRef = useRef<HTMLDivElement>(null);
  const sceneUserToggledRef = useRef(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // 空白会话（kind=blank，无角色设定）使用普通对话排版，冒险会话使用小说排版
  const isBlank = (activeSession?.kind ?? "adventure") === "blank";

  // Auto-scroll when at bottom
  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const el = scrollRef.current;
    const threshold = 100;
    setIsAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < threshold);
  }, []);

  useEffect(() => {
    if (isAtBottom && scrollRef.current) {
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
      });
    }
  }, [messages, isAtBottom]);

  const handleSend = () => {
    const text = inputValue.trim();
    if (!text || streaming) return;
    const blocker = getSendBlocker();
    if (blocker) {
      notify(blocker, "settings");
      return;
    }
    setInputValue("");
    sendMessage(text);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Copy message content
  const handleCopy = (msg: typeof messages[0]) => {
    const parsed = parseSceneReply(msg.content);
    navigator.clipboard.writeText(parsed.body);
    setCopiedId(msg.id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  // Start editing a user message
  const handleStartEdit = (msg: typeof messages[0]) => {
    setEditingId(msg.id);
    setEditValue(msg.content);
  };

  // Save edit and resend
  const handleSaveEdit = () => {
    if (!editingId || !editValue.trim()) return;
    editAndSend(editingId, editValue.trim());
    setEditingId(null);
    setEditValue("");
  };

  // Cancel edit
  const handleCancelEdit = () => {
    setEditingId(null);
    setEditValue("");
  };

  // Regenerate assistant message
  const handleRegenerate = (msgId: string) => {
    if (!streaming) regenerate(msgId);
  };

  // Info badge text
  const infoParts: string[] = [];
  if (selectedWorldName) infoParts.push(selectedWorldName);
  if (selectedCharacterName) infoParts.push(selectedCharacterName);
  if (selectedMode) {
    infoParts.push(selectedMode === "novel" ? "小说视角" : selectedMode === "player" ? "玩家视角" : "自定义");
  }

  // Font size mapping
  const fontSizeMap: Record<string, number> = { xs: 13, sm: 15, md: 17, lg: 19, xl: 21 };
  const msgFontSize = fontSizeMap[messageFontSize] || 15;

  // Filter visible messages (user + assistant only)
  const visibleMessages = messages.filter((m) => m.role !== "system");
  const lastMsg = visibleMessages[visibleMessages.length - 1];

  // 固定模板解析：取最新一条非空 assistant 回复（含流式中），实时解析版面数据
  const lastAssistantMsg = (() => {
    for (let i = visibleMessages.length - 1; i >= 0; i--) {
      const m = visibleMessages[i];
      if (m.role === "assistant" && m.content) return m;
    }
    return null;
  })();
  const parsedReply = lastAssistantMsg ? parseSceneReply(lastAssistantMsg.content) : null;
  const isParsingLive = streaming && lastMsg === lastAssistantMsg;
  const sceneInfo = parsedReply?.scene ?? null;
  const suggestions = parsedReply?.suggestions ?? [];

  // 场景条一行自适应：用隐藏测量行检测单行是否放得下（测量与显示解耦，避免结构切换震荡）
  useEffect(() => {
    const el = sceneMeasureRef.current;
    if (!el) return;
    const check = () => {
      const over = el.scrollWidth > el.clientWidth + 8;
      setSceneOverflow(over);
      if (over && !sceneUserToggledRef.current) setSceneBarOpen(false);
    };
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    window.addEventListener("resize", check);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", check);
    };
  }, [lastAssistantMsg?.content, isBlank]);

  // 新场景内容到来时，重新允许自动折叠判断
  useEffect(() => {
    sceneUserToggledRef.current = false;
  }, [lastAssistantMsg?.content]);

  const handleSuggest = (text: string) => {
    if (!text.trim() || streaming) return;
    const blocker = getSendBlocker();
    if (blocker) {
      notify(blocker, "settings");
      return;
    }
    setInputValue(text.trim());
    if (inputRef.current) {
      inputRef.current.focus();
      inputRef.current.scrollIntoView({ block: "nearest" });
    }
  };

  // Floating particles
  const particles = Array.from({ length: 5 }, (_, i) => (
    <div
      key={i}
      className="seed-particle"
      style={{
        width: 2 + Math.random() * 2,
        height: 2 + Math.random() * 2,
        left: `${15 + i * 16}%`,
        animationDuration: `${14 + i * 3}s`,
        animationDelay: `${i * 2}s`,
      }}
    />
  ));

  return (
    <div className="seed-dialogue">
      {/* Atmospheric background particles */}
      <div className="seed-particles" style={{ position: "absolute" }}>
        {particles}
      </div>

      {/* Info badge：[紫色圆点] 世界 · 角色 · 模式（贴合设计稿） */}
      {infoParts.length > 0 && (
        <div className="seed-info-badge">
          <span className="seed-info-dot" />
          <span>{infoParts.join(" · ")}</span>
        </div>
      )}

      {/* 场景信息条（顶部，一行自适应：放得下直接显示，放不下折叠） */}
      {!isBlank && visibleMessages.length > 0 && (
        <div className="seed-scene-bar">
          <div className="seed-scene-measure" aria-hidden="true">
            <SceneInfoBar innerRef={sceneMeasureRef} scene={sceneInfo} streaming={false} />
          </div>
          {sceneOverflow ? (
            <>
              <div className="seed-scene-bar-head" onClick={() => { sceneUserToggledRef.current = true; setSceneBarOpen((v) => !v); }}>
                <span className="seed-scene-bar-title">场景</span>
                {!sceneBarOpen && sceneInfo && (
                  <span className="seed-scene-bar-summary">
                    {[sceneInfo.location, sceneInfo.time, sceneInfo.characters].filter(Boolean).join(" · ") || "暂无信息"}
                  </span>
                )}
                <svg
                  className={`seed-scene-chevron${sceneBarOpen ? " is-open" : ""}`}
                  width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </div>
              {sceneBarOpen && (
                <SceneInfoBar scene={sceneInfo} streaming={isParsingLive} wrap />
              )}
            </>
          ) : (
            <SceneInfoBar scene={sceneInfo} streaming={isParsingLive} />
          )}
        </div>
      )}

      {/* Scrollable content */}
      <div className="seed-dialogue-scroll" ref={scrollRef} onScroll={handleScroll}>
        <div className="seed-dialogue-content">
          {/* Chapter divider：第一章 · 会话标题（仅冒险会话） */}
          {visibleMessages.length > 0 && !isBlank && (
            <div className="seed-chapter-divider">
              <span>第一章 · {activeSession?.title || "冒险开始"}</span>
              <span className="seed-chapter-line" />
            </div>
          )}

          {/* Messages as paragraphs */}
          {(() => {
            // 找到第一个 assistant 消息的 id，用于首字下沉
            const firstAssistantId = visibleMessages.find((m) => m.role === "assistant")?.id;
            return visibleMessages.map((msg, idx) => {
              // 空内容的 assistant 消息（工具调用占位/未完成的流式占位）不渲染，避免空白条
              if (msg.role === "assistant" && !msg.content) return null;
              if (msg.role === "user") {
                if (editingId === msg.id) {
                  return (
                    <div key={msg.id} className="seed-edit-block" style={{ animationDelay: `${Math.min(idx * 0.05, 0.5)}s` }}>
                      <textarea
                        className="seed-edit-textarea"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        autoFocus
                        rows={Math.max(2, editValue.split("\n").length)}
                        style={{ fontSize: msgFontSize - 1 }}
                      />
                      <div className="seed-edit-actions">
                        <button className="seed-edit-btn seed-edit-btn--cancel" onClick={handleCancelEdit}>取消</button>
                        <button className="seed-edit-btn seed-edit-btn--save" onClick={handleSaveEdit} disabled={!editValue.trim()}>发送</button>
                      </div>
                    </div>
                  );
                }
                return (
                  <div key={msg.id} className="seed-msg-wrapper" style={{ animationDelay: `${Math.min(idx * 0.05, 0.5)}s` }}>
                    <p className="seed-user-input" style={{ fontSize: msgFontSize - 1 }}>
                      {msg.content}
                    </p>
                    <div className="seed-msg-actions">
                      <button className="seed-msg-action-btn" data-tooltip="复制" onClick={() => handleCopy(msg)}>
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                        </svg>
                      </button>
                      {!streaming && <button className="seed-msg-action-btn" data-tooltip="编辑" onClick={() => handleStartEdit(msg)}>
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 20h9" />
                          <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
                        </svg>
                      </button>}
                    </div>
                    {copiedId === msg.id && <span className="seed-copied-toast">已复制</span>}
                  </div>
                );
              }
              // 工具调用消息：仅 running/aborted 时显示徽章，完成后直接隐藏（未持久化的状态视为已完成）
              if (msg.toolCalls && msg.toolCalls.length > 0 && (msg.toolStatus === "running" || msg.toolStatus === "aborted")) {
                return (
                  <ToolCallBadge
                    key={msg.id}
                    status={msg.toolStatus || "done"}
                    startTime={msg.createdAt}
                    toolNames={msg.toolCalls.map((tc) => tc.function.name)}
                  />
                );
              }
              // Assistant message：首段加 drop-cap class
              const isStreaming = streaming && msg === lastMsg && msg.role === "assistant";
              const isDropCap = !isBlank && msg.id === firstAssistantId;
              const parsed = isBlank ? null : parseSceneReply(msg.content);
              return (
                <div key={msg.id} className="seed-msg-wrapper" style={{ animationDelay: `${Math.min(idx * 0.05, 0.5)}s` }}>
                  <div
                    className={isBlank
                      ? "seed-chat-assistant"
                      : `seed-narration${isDropCap ? " seed-narration--drop-cap" : ""}`}
                    style={{ fontSize: msgFontSize }}
                  >
                    {isStreaming ? (
                      <StreamingText content={msg.content} active={isStreaming} />
                    ) : isBlank ? (
                      <MarkdownRender content={msg.content} />
                    ) : parsed && parsed.body !== msg.content.trim() ? (
                      parsed.body
                    ) : (
                      msg.content
                    )}
                  </div>
                  {!isStreaming && msg.content && (
                    <div className="seed-msg-actions">
                      <button className="seed-msg-action-btn" data-tooltip="复制" onClick={() => handleCopy(msg)}>
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                        </svg>
                      </button>
                      {!streaming && <button className="seed-msg-action-btn" data-tooltip="重新回答" onClick={() => handleRegenerate(msg.id)}>
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M3 12a9 9 0 1 0 9-9" />
                          <path d="M3 4v5h5" />
                        </svg>
                      </button>}
                    </div>
                  )}
                  {copiedId === msg.id && <span className="seed-copied-toast">已复制</span>}
                </div>
              );
            });
          })()}

          {/* Typing indicator when streaming but no content yet */}
          {streaming && lastMsg?.role === "assistant" && !lastMsg.content && (
            <div className="seed-typing">
              <span /><span /><span />
            </div>
          )}

          {/* Empty state */}
          {visibleMessages.length === 0 && (
            <div style={{ textAlign: "center", padding: "80px 0", color: "var(--seed-muted)" }}>
              <p style={{ fontSize: 16, marginBottom: 8 }}>{isBlank ? "开始对话" : "故事即将开始"}</p>
              <p style={{ fontSize: 14, opacity: 0.7 }}>
                {isBlank ? "输入你的问题，开始交流" : "输入你的第一句话，开启冒险之旅"}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* 对话推荐条（输入框上方，可折叠） */}
      {!isBlank && (suggestions.length > 0 || isParsingLive) && (
        <div className="seed-suggest-bar">
          <div className="seed-suggest-head" onClick={() => setSuggestBarOpen((v) => !v)}>
            <span className="seed-suggest-head-title">
              对话推荐{suggestions.length > 0 ? ` (${suggestions.length})` : ""}
            </span>
            <svg
              className={`seed-scene-chevron${suggestBarOpen ? " is-open" : ""}`}
              width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>
          {suggestBarOpen && (
            <SuggestBar suggestions={suggestions} streaming={isParsingLive} onPick={handleSuggest} />
          )}
        </div>
      )}

      {/* Bottom input area */}
      <div className="seed-input-area">
        <div className="seed-input-inner">
          <div className="seed-input-row">
            <textarea
              ref={inputRef}
              className="seed-text-input"
              placeholder={streaming ? "AI 正在回复..." : isBlank ? "输入消息..." : "继续书写故事..."}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
              disabled={streaming}
              style={{ overflow: "hidden", resize: "none" }}
            />
            {streaming ? (
              <button className="seed-send-btn" onClick={stopStreaming} style={{ background: "var(--danger, #ef4444)" }}>
                <svg viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
              </button>
            ) : (
              <button className="seed-send-btn" onClick={handleSend} disabled={!inputValue.trim()}>
                <svg viewBox="0 0 24 24">
                  <line x1="12" y1="19" x2="12" y2="5" />
                  <polyline points="5 12 12 5 19 12" />
                </svg>
              </button>
            )}
          </div>
          <FunctionBar />
        </div>
      </div>
    </div>
  );
}

// === 场景信息条：顶部横条，地点 · 时间 · 出场角色 · 起因 ===
function SceneInfoBar({
  scene,
  streaming,
  wrap,
  innerRef,
}: {
  scene: SceneInfo | null;
  streaming: boolean;
  wrap?: boolean;
  innerRef?: React.Ref<HTMLDivElement>;
}) {
  const fields = [
    { icon: <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />, label: "地点", value: scene?.location ?? "" },
    { icon: <><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></>, label: "时间", value: scene?.time ?? "" },
    { icon: <><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></>, label: "出场角色", value: scene?.characters ?? "" },
    { icon: <><circle cx="12" cy="12" r="10" /><path d="M2 12h20" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></>, label: "起因", value: scene?.cause ?? "" },
  ];
  return (
    <div ref={innerRef} className={`seed-scene-bar-inner${wrap ? " is-wrap" : ""}`}>
      {fields.map((f) => (
        <span key={f.label} className="seed-scene-field">
          <svg className="seed-scene-field-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">{f.icon}</svg>
          <span className="seed-scene-field-label">{f.label}</span>
          <span className="seed-scene-field-value">{f.value || "——"}</span>
        </span>
      ))}
      {streaming && (
        <span className="seed-scene-live">更新中…</span>
      )}
    </div>
  );
}

// === 对话推荐条：输入框上方横向按钮 ===
function SuggestBar({
  suggestions,
  streaming,
  onPick,
}: {
  suggestions: string[];
  streaming: boolean;
  onPick: (text: string) => void;
}) {
  return (
    <div className="seed-suggest-inner">
      {suggestions.map((s, i) => (
        <button key={i} className="seed-suggest-chip" onClick={() => onPick(s)} disabled={streaming}>
          <span className="seed-suggest-num">{i + 1}</span>
          {s}
        </button>
      ))}
      {streaming && suggestions.length === 0 && (
        <span className="seed-suggest-live">AI 正在推荐下一步…</span>
      )}
    </div>
  );
}

// === 工具调用标识组件 ===
// 不显示调用内容/参数，只显示"工具调用"+ 呼吸动画（running）+ 计时 + 停止红色底（aborted）
function ToolCallBadge({
  status,
  startTime,
  toolNames,
}: {
  status: "running" | "done" | "aborted";
  startTime: number;
  toolNames: string[];
}) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (status !== "running") return;
    const tick = () => setElapsed(Date.now() - startTime);
    tick();
    const timer = setInterval(tick, 100);
    return () => clearInterval(timer);
  }, [status, startTime]);

  const formatTime = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return m > 0 ? `${m}m ${sec.toString().padStart(2, "0")}s` : `${sec}.${Math.floor((ms % 1000) / 100)}s`;
  };

  const label = toolNames.length > 1
    ? `工具调用 (${toolNames.length})`
    : `工具调用`;

  return (
    <div className={`seed-tool-badge seed-tool-badge--${status}`}>
      <div className="seed-tool-badge-inner">
        <svg
          className="seed-tool-icon"
          width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
        >
          <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
        </svg>
        <span className="seed-tool-label">{label}</span>
        {status === "running" && (
          <span className="seed-tool-timer">{formatTime(elapsed)}</span>
        )}
        {status === "aborted" && (
          <span className="seed-tool-aborted-text">已停止</span>
        )}
      </div>
      {status === "running" && <div className="seed-tool-progress" />}
    </div>
  );
}
