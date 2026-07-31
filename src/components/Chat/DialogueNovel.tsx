import { useRef, useEffect, useState, useCallback } from "react";
import { useChat } from "@/hooks/useChat";
import { useSessionStore } from "@/stores/sessionStore";
import { useUIStore } from "@/stores/uiStore";
import { StreamingText } from "./StreamingText";
import { FunctionBar } from "./FunctionBar";

export function DialogueNovel() {
  const { messages, sendMessage, streaming, stopStreaming } = useChat();
  const activeSession = useSessionStore((s) =>
    s.activeId ? s.sessions.find((ss) => ss.id === s.activeId) : null
  );
  const { selectedWorldName, selectedCharacterName, selectedMode } = useUIStore();
  const [inputValue, setInputValue] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);

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
    setInputValue("");
    sendMessage(text);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Info badge text
  const infoParts: string[] = [];
  if (selectedWorldName) infoParts.push(selectedWorldName);
  if (selectedCharacterName) infoParts.push(selectedCharacterName);
  if (selectedMode) {
    infoParts.push(selectedMode === "novel" ? "小说视角" : selectedMode === "player" ? "玩家视角" : "自定义");
  }

  // Filter visible messages (user + assistant only)
  const visibleMessages = messages.filter((m) => m.role !== "system");
  const lastMsg = visibleMessages[visibleMessages.length - 1];

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

      {/* Scrollable content */}
      <div className="seed-dialogue-scroll" ref={scrollRef} onScroll={handleScroll}>
        <div className="seed-dialogue-content">
          {/* Chapter divider：第一章 · 会话标题 */}
          {visibleMessages.length > 0 && (
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
              if (msg.role === "user") {
                return (
                  <p key={msg.id} className="seed-user-input" style={{ animationDelay: `${Math.min(idx * 0.05, 0.5)}s` }}>
                    {msg.content}
                  </p>
                );
              }
              // 工具调用消息：渲染为工具调用卡片（不显示内容/参数）
              if (msg.toolCalls && msg.toolCalls.length > 0) {
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
              const isDropCap = msg.id === firstAssistantId;
              return (
                <div
                  key={msg.id}
                  className={`seed-narration${isDropCap ? " seed-narration--drop-cap" : ""}`}
                  style={{ animationDelay: `${Math.min(idx * 0.05, 0.5)}s` }}
                >
                  {isStreaming ? (
                    <StreamingText content={msg.content} active={isStreaming} />
                  ) : (
                    msg.content
                  )}
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
              <p style={{ fontSize: 16, marginBottom: 8 }}>故事即将开始</p>
              <p style={{ fontSize: 14, opacity: 0.7 }}>输入你的第一句话，开启冒险之旅</p>
            </div>
          )}
        </div>
      </div>

      {/* Bottom input area */}
      <div className="seed-input-area">
        <div className="seed-input-inner">
          <div className="seed-input-row">
            <textarea
              className="seed-text-input"
              placeholder={streaming ? "AI 正在书写..." : "继续书写故事..."}
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
