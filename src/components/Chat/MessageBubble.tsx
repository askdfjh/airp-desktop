import { useState, useRef, useEffect, useCallback } from "react";
import type { Message } from "@/types";
import { MarkdownRender } from "./MarkdownRender";
import { StreamingText } from "./StreamingText";
import { Bot, User, Copy, RotateCw, Pencil, Trash2, Check, Send, Brain, ChevronDown, Wrench } from "lucide-react";
import { fitTextarea } from "@/lib/autoGrow";

interface Props {
  message: Message;
  streaming: boolean;
  onDelete: (id: string) => void;
  onEdit: (id: string, content: string) => void;
  onRegenerate: (id: string) => void;
  onEditAndSend: (id: string, content: string) => void;
}

export function MessageBubble({ message, streaming, onDelete, onEdit, onRegenerate, onEditAndSend }: Props) {
  const isUser = message.role === "user";
  const toolCall = message.toolCalls && message.toolCalls.length > 0 ? message.toolCalls[0] : null;
  const hasToolCalls = message.role === "assistant" && !!(message.toolCalls && message.toolCalls.length > 0);
  const isToolCall = hasToolCalls || message.content.startsWith("工具调用:");
  const isToolResult = message.role === "system" && message.content.startsWith("[工具");
  const [hovered, setHovered] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(message.content);
  const [copied, setCopied] = useState(false);
  const [thinkingOpen, setThinkingOpen] = useState(false);
  const userToggledRef = useRef(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const thinkingRef = useRef<HTMLDivElement>(null);
  const isThinkingStreaming = streaming && !isUser && !!message.thinking;

  useEffect(() => {
    if (editing && textareaRef.current) {
      const el = textareaRef.current;
      el.style.height = "auto";
      el.style.height = Math.min(el.scrollHeight, 200) + "px";
    }
  }, [editing, editText]);

  useEffect(() => {
    if (!isThinkingStreaming) return;
    let rafId: number;
    const tick = () => {
      if (thinkingRef.current) {
        thinkingRef.current.scrollTop = thinkingRef.current.scrollHeight;
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [isThinkingStreaming]);

  useEffect(() => {
    if (isThinkingStreaming) {
      setThinkingOpen(true);
      return;
    }
    if (!streaming && message.thinking && thinkingOpen && !userToggledRef.current) {
      const t = setTimeout(() => setThinkingOpen(false), 600);
      return () => clearTimeout(t);
    }
  }, [isThinkingStreaming, streaming, message.thinking, thinkingOpen]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  const startEdit = () => {
    setEditText(message.content);
    setEditing(true);
  };

  const handleSaveEdit = () => {
    const trimmed = editText.trim();
    if (trimmed && trimmed !== message.content) {
      onEdit(message.id, trimmed);
    } else {
      setEditText(message.content);
    }
    setEditing(false);
  };

  const handleSaveAndSend = () => {
    const trimmed = editText.trim();
    if (!trimmed) {
      handleCancelEdit();
      return;
    }
    setEditing(false);
    onEditAndSend(message.id, trimmed);
  };

  const handleCancelEdit = () => {
    setEditText(message.content);
    setEditing(false);
  };

  const renderActionBar = () => {
    if (editing) return null;
    return (
      <div
        className={`flex items-center gap-1 ${isUser ? "justify-end" : "justify-start"}`}
        style={{
          height: 26,
          opacity: hovered ? 1 : 0,
          transform: `translateY(${hovered ? "0" : "-2"}px)`,
          transition: "opacity 0.15s ease, transform 0.15s ease",
          pointerEvents: hovered ? "auto" : "none",
          paddingLeft: isUser ? 0 : 2,
          paddingRight: isUser ? 2 : 0,
        }}
      >
        <ActionBtn
          title={copied ? "已复制" : "复制"}
          onClick={handleCopy}
          active={copied}
        >
          {copied ? <Check size={13} /> : <Copy size={13} />}
        </ActionBtn>
        {!isUser && (
          <ActionBtn title="重新生成" onClick={() => onRegenerate(message.id)}>
            <RotateCw size={13} />
          </ActionBtn>
        )}
        <ActionBtn title="编辑" onClick={startEdit}>
          <Pencil size={13} />
        </ActionBtn>
        <ActionBtn title="删除" danger onClick={() => onDelete(message.id)}>
          <Trash2 size={13} />
        </ActionBtn>
      </div>
    );
  };

  const formatToolArgs = () => {
    if (!toolCall) return "";
    try {
      const a = JSON.parse(toolCall.function.arguments);
      const q = a.query || a.input || a.topic || a.content || Object.values(a)[0];
      const s = typeof q === "string" ? q : JSON.stringify(a);
      return s.slice(0, 300);
    } catch {
      return toolCall.function.arguments.slice(0, 300);
    }
  };

  const toolResultContent = () => {
    return message.content.replace(/^\[工具 .*? 返回\]\n?/, "");
  };

  return (
    <>
    {isToolCall || isToolResult ? (
      <div className="flex gap-2 mb-4" style={{ alignItems: "flex-start" }}>
        <div className="rd-full flex items-center justify-center shrink-0"
          style={{ width: 26, height: 26, flex: "0 0 26px", background: "var(--accent-bg)", alignSelf: "flex-start", marginTop: 2 }}>
          <Wrench size={13} style={{ color: "var(--accent)" }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: "var(--fs-11)", color: "var(--accent)", marginBottom: 6, fontWeight: 500 }}>
            {isToolCall
              ? (toolCall ? `调用工具：\${toolCall.function.name}` : "工具调用")
              : (toolCall ? `工具返回：\${toolCall.function.name}` : "工具返回")}
          </div>
          {isToolCall && toolCall ? (
            <div className="rd-10"
              style={{
                padding: "8px 12px",
                background: "var(--bg-hover)",
                border: "1px solid var(--border-subtle)",
                fontSize: "var(--fs-12)",
                lineHeight: 1.55,
                color: "var(--text-secondary)",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}>
              {formatToolArgs()}
            </div>
          ) : isToolResult ? (
            <div className="rd-10"
              style={{
                padding: "10px 14px",
                background: "var(--bg-hover)",
                border: "1px solid var(--border-subtle)",
                fontSize: "var(--fs-12)",
                lineHeight: 1.6,
                color: "var(--text-secondary)",
                maxHeight: 400,
                overflowY: "auto",
              }}>
              <MarkdownRender content={toolResultContent()} />
            </div>
          ) : null}
        </div>
      </div>
    ) : (
    <div
      className={`flex gap-2 mb-4 ${isUser ? "flex-row-reverse" : "flex-row"}`}
      style={{ alignItems: "flex-start" }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        className={`flex rd-16 ${isUser ? "flex-row-reverse" : "flex-row"}`}
        style={{
          gap: 8,
          padding: "8px 10px",
          background: isUser ? "var(--bubble-user-bg)" : "var(--bubble-ai-bg)",
          border: `1px solid ${isUser ? "var(--bubble-user-border)" : "var(--bubble-ai-border)"}`,
          backdropFilter: "var(--blur-bubble)",
          WebkitBackdropFilter: "var(--blur-bubble)",
          willChange: "backdrop-filter",
          maxWidth: "78%",
          minWidth: 0,
        }}
      >
        <div
          className="rd-full flex items-center justify-center shrink-0"
          style={{
            width: 26,
            height: 26,
            flex: "0 0 26px",
            background: isUser ? "var(--accent-bg)" : "var(--bg-card)",
            opacity: isUser ? 0.75 : 0.6,
            alignSelf: "flex-start",
            marginTop: 1,
          }}
        >
          {isUser ? (
            <User size={13} style={{ color: "var(--accent)" }} />
          ) : (
            <Bot size={13} style={{ color: "var(--text-tertiary)" }} />
          )}
        </div>

         <div style={{ flex: 1, minWidth: 0 }}>
          {editing ? null : (
            <>
              {isUser && message.images && message.images.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 8 }}>
                  {message.images.map((url, i) => (
                    <img
                      key={i}
                      src={url}
                      className="rd-8"
                      alt={`attachment-${i}`}
                      style={{
                        width: 72, height: 72, objectFit: "cover",
                        border: "1px solid var(--border-light)",
                        cursor: "pointer",
                      }}
                      onClick={() => {
                        const w = window.open("", "_blank");
                        if (w) {
                          w.document.write(`<img src="${url}" style="max-width:100%;max-height:100vh;object-fit:contain" />`);
                          w.document.title = "图片预览";
                        }
                      }}
                    />
                  ))}
                </div>
              )}
              {message.role === "assistant" && message.thinking && (
                <div style={{ marginBottom: 10 }}>
                  <button
                    onClick={() => { userToggledRef.current = true; setThinkingOpen(!thinkingOpen); }}
                    className="flex items-center gap-1-5 cp txt-tertiary tr-all"
                    style={{
                      background: "none", border: "none", padding: "0 0 6px 0",
                      fontSize: "var(--fs-12)", cursor: "pointer",
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = "var(--accent)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-tertiary)"; }}
                  >
                    <Brain size={12} />
                    <span>思考过程</span>
                    {isThinkingStreaming && (
                      <span className="flex items-center gap-1" style={{ marginLeft: 2 }}>
                        <span className="typing-dot inline-b" style={{ width: 4, height: 4, borderRadius: "50%" }} />
                      </span>
                    )}
                    <ChevronDown size={10} style={{
                      transform: thinkingOpen ? "rotate(180deg)" : "none",
                      transition: "transform 0.15s",
                    }} />
                  </button>
                  {thinkingOpen && (
                    <div
                      ref={thinkingRef}
                      className="rd-8 ov-ya"
                      style={{
                        padding: "10px 12px",
                        background: "var(--bg-hover)",
                        border: "1px solid var(--border-subtle)",
                        fontSize: "var(--fs-12)",
                        lineHeight: 1.6,
                        color: "var(--text-tertiary)",
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-word",
                        userSelect: "text",
                        WebkitUserSelect: "text",
                        cursor: "text",
                        maxHeight: 240,
                        overflowY: "auto",
                      }}
                    >
                      <StreamingText
                        content={message.thinking!}
                        active={streaming}
                        style={{
                          fontSize: "var(--fs-12)",
                          lineHeight: 1.6,
                          color: "var(--text-tertiary)",
                        }}
                      />
                    </div>
                  )}
                </div>
              )}
              <div
                className="text-sm leading-relaxed txt-primary"
                style={{
                  userSelect: "text",
                  WebkitUserSelect: "text",
                  cursor: "text",
                }}
              >
                {message.role === "assistant" ? (
                  streaming && message.content ? (
                    <StreamingText
                      content={message.content}
                      active={streaming}
                      style={{
                        fontSize: "var(--fs-14)",
                        lineHeight: 1.625,
                        color: "var(--text-primary)",
                        userSelect: "text",
                        WebkitUserSelect: "text",
                        cursor: "text",
                      }}
                    />
                  ) : (
                    <MarkdownRender content={message.content} />
                  )
                ) : (
                  <p
                    className="text-sm leading-relaxed txt-primary whitespace-pre-wrap break-words"
                    style={{ margin: 0 }}
                  >
                    {message.content}
                  </p>
                )}
              </div>
              {renderActionBar()}
            </>
          )}
        </div>
      </div>
    </div>
    )}

    {editing && (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center"
        style={{
          background: "rgba(0,0,0,0.35)",
          backdropFilter: "var(--blur-xs)",
          WebkitBackdropFilter: "var(--blur-xs)",
          animation: "fadeInMsg .15s ease-out",
        }}
        onClick={handleCancelEdit}
      >
        <div
          className="glass-modal rd-16 sh-lg"
          style={{
            width: 560,
            maxWidth: "calc(100vw - 32px)",
            padding: "24px 24px 20px",
            animation: "fadeInUp .2s ease-out",
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div style={{
                width: 32, height: 32, borderRadius: 8,
                background: "var(--accent-bg)", display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <Pencil size={14} style={{ color: "var(--accent)" }} />
              </div>
              <span className="text-sm font-semibold txt-primary">
                {isUser ? "编辑并重新发送" : "编辑回复"}
              </span>
            </div>
          </div>

          <textarea
            ref={textareaRef}
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            className="w-full"
            style={{
              minHeight: 120, maxHeight: 360,
              background: "var(--bg-input)", border: "1px solid var(--border-light)",
              borderRadius: 10, padding: 12,
              color: "var(--text-primary)", fontFamily: "inherit",
              fontSize: "var(--fs-14)", lineHeight: 1.6,
              outline: "none",
            }}
            onInput={(e) => fitTextarea(e.currentTarget, 360)}
            autoFocus
            onFocus={(e) => (e.target.style.borderColor = "var(--accent)")}
            onBlur={(e) => (e.target.style.borderColor = "var(--border-light)")}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (isUser) handleSaveAndSend();
                else handleSaveEdit();
              } else if (e.key === "Escape") {
                handleCancelEdit();
              }
            }}
          />

          <div className="flex items-center justify-between mt-3">
            <span className="text-11 txt-muted">{editText.length} 字符</span>
            <div className="flex items-center gap-2">
              <button
                onClick={handleCancelEdit}
                style={{
                  padding: "8px 20px", fontSize: "var(--fs-13)", borderRadius: 8,
                  background: "transparent", border: "1px solid var(--border-medium)",
                  color: "var(--text-secondary)", cursor: "pointer",
                }}
              >
                取消
              </button>
              {isUser ? (
                <button
                  onClick={handleSaveAndSend}
                  style={{
                    padding: "8px 20px", fontSize: "var(--fs-13)", fontWeight: 500,
                    borderRadius: 8, border: "none", cursor: "pointer",
                    background: "var(--accent)", color: "#fff",
                    boxShadow: "0 0 16px var(--accent-glow)",
                    display: "flex", alignItems: "center", gap: 6,
                  }}
                >
                  <Send size={14} /> 保存并发送
                </button>
              ) : (
                <button
                  onClick={handleSaveEdit}
                  style={{
                    padding: "8px 20px", fontSize: "var(--fs-13)", fontWeight: 500,
                    borderRadius: 8, border: "none", cursor: "pointer",
                    background: "var(--accent)", color: "#fff",
                    boxShadow: "0 0 16px var(--accent-glow)",
                  }}
                >
                  保存
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    )}
    </>
  );
}

function ActionBtn({
  title,
  onClick,
  children,
  danger,
  active,
}: {
  title: string;
  onClick: () => void;
  children: React.ReactNode;
  danger?: boolean;
  active?: boolean;
}) {
  const [showTip, setShowTip] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <button
        onClick={onClick}
        title={title}
        onMouseEnter={() => setShowTip(true)}
        onMouseLeave={() => setShowTip(false)}
        style={{
          width: 24,
          height: 24,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 6,
          background: active ? "var(--accent-bg)" : "transparent",
          color: danger ? "var(--danger)" : active ? "var(--accent)" : "var(--text-muted)",
          border: "none",
          cursor: "pointer",
          padding: 0,
          transition: "all 0.12s ease",
        }}
        onMouseOver={(e) => {
          if (!active) e.currentTarget.style.background = "var(--bg-hover)";
          if (!active && !danger) e.currentTarget.style.color = "var(--text-secondary)";
        }}
        onMouseOut={(e) => {
          if (!active) e.currentTarget.style.background = "transparent";
          if (!active && !danger) e.currentTarget.style.color = "var(--text-muted)";
        }}
      >
        {children}
      </button>
      {showTip && (
        <div
          style={{
            position: "absolute",
            bottom: "calc(100% + 4px)",
            left: "50%",
            transform: "translateX(-50%)",
            background: "var(--bg-overlay)",
            color: "var(--text-primary)",
            fontSize: "var(--fs-11)",
            borderRadius: 6,
            whiteSpace: "nowrap",
            border: "1px solid var(--border-light)",
            pointerEvents: "none",
            zIndex: "var(--z-picker)",
            boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
          }}
        >
          {title}
        </div>
      )}
    </div>
  );
}
