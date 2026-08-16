import { useRef, useEffect, useState, useCallback, useMemo, type CSSProperties } from "react";
import { useChat, getSendBlocker } from "@/hooks/useChat";
import { useSessionStore } from "@/stores/sessionStore";
import { useUIStore } from "@/stores/uiStore";
import { useStoryStore } from "@/stores/storyStore";
import { NarraBack, NarraAppearance } from "@/components/icons/NarraIcon";
import { StreamingText } from "./StreamingText";
import { FunctionBar } from "./FunctionBar";
import { ReaderSettings } from "./ReaderSettings";
import { ChapterSheet } from "./ChapterSheet";
import { BookDetail } from "@/components/Bookshelf/BookDetail";
import { readerBgAttr } from "@/lib/readerPrefs";
import { ConfirmDialog } from "@/components/Layout/ConfirmDialog";
import { MarkdownRender } from "./MarkdownRender";
import { parseSceneAnalysis, type SceneAnalysis } from "@/lib/sceneAnalyzer";
import { parseSceneReply, type SceneInfo } from "@/lib/sceneTemplate";
import { stopCompress, estimateHistoryTokens } from "@/lib/contextCompress";
import { registerBackHandler } from "@/lib/androidBack";
import { fitTextarea } from "@/lib/autoGrow";
import { ART } from "@/assets/art";

export function DialogueNovel() {
  const { messages, sendMessage, streaming, stopStreaming, regenerate, editAndSend, editMessage, deleteMessage, analysingScene, sceneError, retrySceneAnalysis } = useChat();
  const activeSession = useSessionStore((s) =>
    s.activeId ? s.sessions.find((ss) => ss.id === s.activeId) : null
  );
  const branchFromMessage = useSessionStore((s) => s.branchFromMessage);
  const targetMessageId = useSessionStore((s) => s.targetMessageId);
  const targetKeyword = useSessionStore((s) => s.targetKeyword);
  const clearTargetMessage = useSessionStore((s) => s.clearTargetMessage);
  const { selectedWorldName, selectedCharacterName, selectedMode, notify, setAppPhase } = useUIStore();
  const reader = useUIStore((s) => s.reader);
  const setReaderSettingsOpen = useUIStore((s) => s.setReaderSettingsOpen);
  const readerSettingsOpen = useUIStore((s) => s.readerSettingsOpen);
  const activeStory = useStoryStore((s) => s.stories.find((x) => x.id === (s.activeStoryId || activeSession?.storyId)));
  const [resumeChip, setResumeChip] = useState(false);
  const resumeInitRef = useRef<string | null>(null);
  const compressing = useUIStore((s) => s.compressing);
  const compressStage = useUIStore((s) => s.compressStage);
  const compressPrompt = useUIStore((s) => s.compressPrompt);
  const compressPromptCallbacks = useUIStore((s) => s.compressPromptCallbacks);
  const [inputValue, setInputValue] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [branchTarget, setBranchTarget] = useState<typeof messages[0] | null>(null);
  const [sceneBarOpen, setSceneBarOpen] = useState(true);
  const [suggestBarOpen, setSuggestBarOpen] = useState(false);
  const [sceneOverflow, setSceneOverflow] = useState(false);
  const sceneMeasureRef = useRef<HTMLDivElement>(null);
  const sceneUserToggledRef = useRef(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  // 动态章节名：从 AI 回复【章节名】字段解析，变化时章节号 +1
  const [chapterName, setChapterName] = useState<string | null>(null);
  const [chapterNo, setChapterNo] = useState(1);
  const chapterInitRef = useRef(false);
  // 重新生成锁定：regenerate 重写当前段，新回复的章节名变化只更新名称，不推进章节号
  const regenerateLockRef = useRef(false);
  // 流式完成过渡动画：正文从模板全文切换到解析 body 时淡入，避免「突然截断」的突兀感
  const [settlingId, setSettlingId] = useState<string | null>(null);
  const lastStreamingRef = useRef(false);

  // 空白会话（kind=blank，无角色设定）使用普通对话排版，冒险会话使用小说排版
  const isBlank = (activeSession?.kind ?? "adventure") === "blank";
  // 格式可用：冒险会话，或空白会话开启了「冒险格式」开关（formatEnabled：仅格式排版，不注入世界书/角色卡/文风）
  const hasFormat = !isBlank || !!activeSession?.formatEnabled;

  // Auto-scroll when at bottom
  const [inputHidden, setInputHidden] = useState(false);
  const [chromeTapHidden, setChromeTapHidden] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [tocOpen, setTocOpen] = useState(false);
  const openingError = useUIStore((s) => s.openingError);
  const lastOpeningMessage = useUIStore((s) => s.lastOpeningMessage);
  const setPendingOpeningMessage = useUIStore((s) => s.setPendingOpeningMessage);
  const setOpeningError = useUIStore((s) => s.setOpeningError);
  const chromeHidden = inputHidden || chromeTapHidden;

  useEffect(() => {
    const unregister = registerBackHandler(() => {
      const prompt = useUIStore.getState().compressPrompt;
      const callbacks = useUIStore.getState().compressPromptCallbacks;
      if (prompt && callbacks) {
        callbacks.onCancel();
        return true;
      }
      if (useUIStore.getState().readerSettingsOpen) {
        useUIStore.getState().setReaderSettingsOpen(false);
        return true;
      }
      if (detailOpen) {
        setDetailOpen(false);
        return true;
      }
      if (tocOpen) {
        setTocOpen(false);
        return true;
      }
      return false;
    });
    return unregister;
  }, [detailOpen, tocOpen]);
  const lastScrollTopRef = useRef(0);
  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const el = scrollRef.current;
    const threshold = 100;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
    setIsAtBottom(atBottom);
    // 输入框自动隐藏：下滑看历史 → 隐藏；上滑回底 / 滚到底 / 正在输入或流式 → 显示
    const dir = el.scrollTop - lastScrollTopRef.current;
    lastScrollTopRef.current = el.scrollTop;
    const ae = document.activeElement;
    const typing = !!ae && (ae.tagName === "TEXTAREA" || ae.tagName === "INPUT");
    if (atBottom || typing || streaming) {
      setInputHidden(false);
      return;
    }
    if (dir > 10) setInputHidden(true);
    else if (dir < -10) setInputHidden(false);
  }, [streaming]);

  // 切换会话时重置隐藏状态与滚动记录
  useEffect(() => {
    setInputHidden(false);
    lastScrollTopRef.current = 0;
  }, [activeSession?.id]);

  useEffect(() => {
    if (isAtBottom && scrollRef.current) {
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
      });
    }
  }, [messages, isAtBottom]);

  // 搜索结果跳转：切换到目标会话后，等消息加载完成再滚动到目标消息并高亮
  useEffect(() => {
    if (!targetMessageId) return;
    const el = document.querySelector(`[data-msg-id="${targetMessageId}"]`) as HTMLElement | null;
    const content = document.querySelector(".seed-dialogue-content") as HTMLElement | null;
    const done = () => {
      if (el) {
        setIsAtBottom(false);
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        setHighlightId(targetMessageId);
      } else if (content) {
        setIsAtBottom(false);
        content.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    };
    // 双 rAF：等待消息渲染与布局稳定后再滚动，避免与自动滚底冲突
    const raf = requestAnimationFrame(() => requestAnimationFrame(done));
    const timer = setTimeout(() => clearTargetMessage(), 2500);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetMessageId, messages]);

  // 高亮 2.2s 后自动清除
  useEffect(() => {
    if (!highlightId) return;
    const t = setTimeout(() => setHighlightId(null), 2200);
    return () => clearTimeout(t);
  }, [highlightId]);

  // 现场条：只在重开已有正文的书时出现一次；新开局生成过程中不提示「上次写到」
  useEffect(() => {
    const sid = activeSession?.id;
    if (!sid) {
      resumeInitRef.current = null;
      setResumeChip(false);
      return;
    }
    if (resumeInitRef.current === sid) return;
    if (streaming) return;
    const hasExisting = messages.some((m) => m.role === "assistant" && !!m.content);
    if (!hasExisting && messages.length === 0) return;
    resumeInitRef.current = sid;
    setResumeChip(hasExisting);
  }, [activeSession?.id, messages, streaming]);
  useEffect(() => {
    if (!resumeChip) return;
    const t = setTimeout(() => setResumeChip(false), 8000);
    return () => clearTimeout(t);
  }, [resumeChip]);

  const emitUserTurn = (text: string) => {
    const next = text.trim();
    if (!next || streaming) return;
    const blocker = getSendBlocker();
    if (blocker) {
      notify(blocker, "settings");
      return;
    }
    regenerateLockRef.current = false;
    setResumeChip(false);
    setInputValue("");
    sendMessage(next);
  };

  const handleSend = () => emitUserTurn(inputValue);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    requestAnimationFrame(() => fitTextarea(el, 160));
  }, [inputValue, activeSession?.id]);

  // Copy message content
  const handleCopy = (msg: typeof messages[0]) => {
    const text = msg.role === "assistant" ? (parseSceneReply(msg.content).body || msg.content) : msg.content;
    navigator.clipboard.writeText(text);
    setCopiedId(msg.id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  // Start editing a user message
  const handleStartEdit = (msg: typeof messages[0]) => {
    setEditingId(msg.id);
    setEditValue(msg.content);
  };

  // 保存编辑内容（原地保存，不重新触发 AI 回复）
  const handleSaveEdit = () => {
    if (!editingId || !editValue.trim()) return;
    editMessage(editingId, editValue.trim());
    setEditingId(null);
    setEditValue("");
  };

  // 编辑并发送（保存修改后重新生成 AI 回复）
  const handleEditAndSend = () => {
    if (!editingId || !editValue.trim()) return;
    editAndSend(editingId, editValue.trim());
    setEditingId(null);
    setEditValue("");
  };

  // 创建分支话题：以当前消息为分叉点另建新会话
  const handleBranchConfirm = async () => {
    if (!branchTarget || !activeSession) return;
    const ok = await branchFromMessage(activeSession.id, branchTarget.id);
    notify(ok ? "已创建分支话题，已切换到新话题" : "创建分支失败，请重试");
    setBranchTarget(null);
  };

  // Cancel edit
  const handleCancelEdit = () => {
    setEditingId(null);
    setEditValue("");
  };

  // Regenerate assistant message
  const handleRegenerate = (msgId: string) => {
    if (!streaming) {
      regenerateLockRef.current = true;
      regenerate(msgId);
    }
  };

  // Info badge text
  const infoParts: string[] = [];
  if (selectedWorldName) infoParts.push(selectedWorldName);
  if (selectedCharacterName) infoParts.push(selectedCharacterName);
  if (selectedMode) {
    infoParts.push(selectedMode === "novel" ? "小说视角" : selectedMode === "player" ? "玩家视角" : "自定义");
  }

  const msgFontSize = reader.fontSize;

  // Filter visible messages (user + assistant only)
  const allVisible = messages.filter((m) => m.role !== "system");
  // 开局消息（自动发送的指令）不展示在对话流中
  const openingMsg = allVisible.find((m) => m.opening);
  const visibleMessages = allVisible.filter((m) => !m.opening);
  const lastMsg = visibleMessages[visibleMessages.length - 1];
  const chapterItems = useMemo(() => {
    const seen = new Set<string>();
    const items: { id: string; title: string }[] = [];
    for (const m of visibleMessages) {
      if (m.role !== "assistant" || !m.content) continue;
      const title =
        parseSceneAnalysis(m.sceneAnalysis || "")?.chapterTitle ||
        parseSceneReply(m.content).chapterTitle ||
        "";
      if (!title || seen.has(title)) continue;
      seen.add(title);
      items.push({ id: m.id, title });
    }
    return items;
  }, [visibleMessages]);

  // 版面数据（章节/场景/推荐）：读最新一条 assistant 消息的 sceneAnalysis（独立格式分析请求结果）
  const lastAssistantMsg = (() => {
    for (let i = visibleMessages.length - 1; i >= 0; i--) {
      const m = visibleMessages[i];
      if (m.role === "assistant" && m.content) return m;
    }
    return null;
  })();
  const isParsingLive = streaming && lastMsg === lastAssistantMsg;
  // 分析进行中（正文已完成、格式请求未返回）：正文流式期 + 分析期都视为"推荐生成中"
  const analysisPending = (isParsingLive || analysingScene) && lastMsg === lastAssistantMsg;
  const sceneAnalysisData = useMemo<SceneAnalysis | null>(() => {
    if (!lastAssistantMsg?.sceneAnalysis) return null;
    return parseSceneAnalysis(lastAssistantMsg.sceneAnalysis);
  }, [lastAssistantMsg?.sceneAnalysis]);
  const sceneInfo = sceneAnalysisData
    ? { location: sceneAnalysisData.location ?? "", time: sceneAnalysisData.time ?? "", characters: sceneAnalysisData.characters ?? "", cause: sceneAnalysisData.cause ?? "" }
    : null;
  const templateSuggestions = lastAssistantMsg ? parseSceneReply(lastAssistantMsg.content).suggestions : [];
  const suggestions = (sceneAnalysisData?.suggestions?.length ? sceneAnalysisData.suggestions : templateSuggestions);
  const hasSceneAnalysis = !!sceneAnalysisData;

  // 开局生成状态：已有开局消息且第一条 AI 回复尚未完成 → 显示「规则书生成中...」/「完成规划」
  // 用 ref 记忆「开局已完成」，避免每次发送消息时（全局 streaming 变化）状态条反复出现
  const [openingDone, setOpeningDone] = useState(false);
  const openingDoneRef = useRef(false);
  useEffect(() => {
    if (openingDoneRef.current) return;
    if (allVisible.some((m) => m.role === "assistant" && m.content) && !streaming) {
      openingDoneRef.current = true;
      setOpeningDone(true);
    }
  }, [allVisible, streaming]);
  const hasAssistantBody = allVisible.some((m) => m.role === "assistant" && !!m.content);
  const openingActive = !isBlank && !!openingMsg && !openingDone && (streaming || !hasAssistantBody);
  const assistantStarted = openingActive && !!lastAssistantMsg?.content;

  // 回复等待计时：流式且尚无正文时点点点旁显示读秒（思考模式显示「规划中」）；完成/中断即停止
  const typingActive = streaming && lastMsg?.role === "assistant" && !lastMsg.content && !openingActive;
  const [typingSec, setTypingSec] = useState(0);
  const typingStartRef = useRef(0);
  const thinkingMiniRef = useRef<HTMLDivElement>(null);
  // 思考阶段主滚动即时跟随：规划中迷你窗口在消息流末尾持续增长，
  // smooth 滚动会被高频更新反复打断追不上，改用逐帧即时滚底（与迷你窗口同步）
  useEffect(() => {
    if (!typingActive) return;
    const el = scrollRef.current;
    if (!el) return;
    let raf: number;
    const tick = () => {
      el.scrollTop = el.scrollHeight;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [typingActive]);
  // 迷你思考窗口持续滚动到底部：打字机逐帧推进内容，滚动也必须逐帧跟随；
  // 每次 thinking 更新重启循环，思考结束后循环继续空转（内容不再增长即稳定在底部）
  useEffect(() => {
    const el = thinkingMiniRef.current;
    if (!el) return;
    let raf: number;
    const tick = () => {
      el.scrollTop = el.scrollHeight;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [lastMsg?.thinking]);
  useEffect(() => {
    if (!typingActive) {
      setTypingSec(0);
      return;
    }
    typingStartRef.current = Date.now();
    setTypingSec(0);
    const t = setInterval(() => {
      setTypingSec(Math.floor((Date.now() - typingStartRef.current) / 1000));
    }, 200);
    return () => clearInterval(t);
  }, [typingActive]);

  // 停止生成时若开局流尚未产出任何内容 → 删除开局消息，避免状态条永久卡在「规则书生成中...」（表现为界面挂起）
  useEffect(() => {
    if (streaming) return;
    if (openingMsg && !allVisible.some((m) => m.role === "assistant" && m.content)) {
      const msg = openingMsg;
      deleteMessage(msg.id).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [streaming, openingMsg?.id]);

  // 场景条一行自适应：用隐藏测量行检测单行是否放得下（测量与显示解耦，避免结构切换震荡）；
  // 依赖 sceneAnalysis——场景数据由格式分析异步到达，到达后需重新测量（正文流式期 scene 为空）
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
  }, [lastAssistantMsg?.content, lastAssistantMsg?.sceneAnalysis, isBlank]);

  // 新场景内容到来时，重新允许自动折叠判断
  useEffect(() => {
    sceneUserToggledRef.current = false;
  }, [lastAssistantMsg?.content, lastAssistantMsg?.sceneAnalysis]);

  // 动态章节名：读格式分析结果中的章节名；首次设置不跳号，之后变化章节号 +1；
  // 重新生成（regenerate）时锁定：新回复章节名只更新名称，不推进章节号（重写当前段不应开新章）；
  // 无分析结果（未绑定/失败/旧消息）→ 保持「第一章」兜底
  useEffect(() => {
    if (!hasFormat) return;
    const title = sceneAnalysisData?.chapterTitle?.trim();
    if (!title) return;
    if (regenerateLockRef.current) {
      regenerateLockRef.current = false;
      setChapterName(title);
      return;
    }
    if (!chapterInitRef.current) {
      chapterInitRef.current = true;
      setChapterName(title);
      return;
    }
    setChapterName((prev) => {
      if (prev !== title) {
        setChapterNo((n) => n + 1);
        return title;
      }
      return prev;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastAssistantMsg?.sceneAnalysis, isBlank]);

  // 流式完成过渡：streaming 由 true → false 时，对刚完成的 assistant 消息做淡入（掩盖模板区块被裁剪的突兀）
  useEffect(() => {
    if (lastStreamingRef.current && !streaming && lastAssistantMsg?.content) {
      setSettlingId(lastAssistantMsg.id);
    }
    lastStreamingRef.current = streaming;
  }, [streaming, lastAssistantMsg?.id, lastAssistantMsg?.content]);

  const handleSuggest = (text: string) => {
    setSuggestBarOpen(false);
    emitUserTurn(text);
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

  // 会话历史估算 token（整理按钮百分比显示）
  const historyTokens = useMemo(() => estimateHistoryTokens(messages), [messages]);

  return (
    <div
      className="seed-dialogue"
      data-reader-bg={readerBgAttr(reader)}
      data-reader-font={reader.font}
      data-reader-bold={reader.bold ? "1" : "0"}
      style={{
        ["--reader-size" as string]: `${reader.fontSize}px`,
        ["--reader-lh" as string]: String(reader.lineHeight),
        ["--reader-gap" as string]: `${reader.paragraphGap}px`,
        ["--reader-ls" as string]: `${reader.letterSpacing}em`,
        ["--reader-pad" as string]: `${reader.pagePadding}px`,
        ["--reader-weight" as string]: reader.bold ? 600 : 400,
      } as CSSProperties}
    >
      <img className="seed-dialogue-paper" src={ART.paper} alt="" />
      <div className="narra-read-bar">
        <button className="narra-icon-btn" aria-label="回书架" onClick={() => setAppPhase("bookshelf")}>
          <NarraBack size={18} />
        </button>
        <button
          type="button"
          className="narra-read-title narra-read-title-btn"
          onClick={() => activeStory && setDetailOpen(true)}
        >
          {activeStory?.title || activeSession?.title || "书写"}
        </button>
        <div className="narra-read-actions">
          <button
            className={"narra-icon-btn" + (tocOpen ? " is-on" : "")}
            aria-label="章节目录"
            onClick={() => setTocOpen((v) => !v)}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M5 7 H19 M5 12 H15 M5 17 H19" />
            </svg>
          </button>
          <button
            className={"narra-icon-btn" + (readerSettingsOpen ? " is-on" : "")}
            aria-label="阅读设置"
            onClick={() => setReaderSettingsOpen(!readerSettingsOpen)}
          >
            <NarraAppearance size={18} />
          </button>
        </div>
      </div>
      <ReaderSettings />
      <ChapterSheet
        open={tocOpen}
        onClose={() => setTocOpen(false)}
        items={chapterItems}
        onJump={(id) => {
          setTocOpen(false);
          setHighlightId(id);
          const el = document.querySelector(`[data-msg-id="${id}"]`) as HTMLElement | null;
          el?.scrollIntoView({ behavior: "smooth", block: "center" });
        }}
      />
      {detailOpen && activeStory && (
        <div className="narra-read-detail">
          <BookDetail storyId={activeStory.id} onClose={() => setDetailOpen(false)} />
        </div>
      )}
      {/* Atmospheric background particles */}
      <div className="seed-particles" style={{ position: "absolute" }}>
        {particles}
      </div>
      {openingError && (
        <div className="narra-opening-fail">
          <span>{openingError}</span>
          <button type="button" onClick={() => { setOpeningError(null); useUIStore.getState().setSettingsOpen(true); }}>去设置</button>
          {lastOpeningMessage && (
            <button type="button" onClick={() => { setOpeningError(null); setPendingOpeningMessage(lastOpeningMessage); }}>再试一次</button>
          )}
        </div>
      )}
      {sceneError && !analysingScene && (
        <div className="narra-scene-fail">
          <span>场景没分析出来：{sceneError}</span>
          <button type="button" onClick={() => retrySceneAnalysis()}>重试</button>
        </div>
      )}
      {/* Info badge：[紫色圆点] 世界 · 角色 · 模式（贴合设计稿） */}
      {infoParts.length > 0 && (
        <div className="seed-info-badge">
          <span className="seed-info-dot" />
          <span>{infoParts.join(" · ")}</span>
        </div>
      )}

      {/* 开局生成状态：世界生成中 → 完成规划（流内占位在顶部，不随正文滚动，不与场景栏重叠） */}
      {openingActive && (
        <div className="seed-opening">
          {assistantStarted ? (
            <>
              <span className="seed-opening-check">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </span>
              完成规划
            </>
          ) : (
            <>
              <span className="seed-opening-spinner" />
              规则书生成中...
            </>
          )}
        </div>
      )}

      {/* 长对话压缩状态条：保存记忆中（记录角色 → 生成摘要），可停止 */}
      {compressing && (
        <div className="seed-compress-bar">
          <span className="seed-opening-spinner" />
          <span>
            正在保存记忆…
            {compressStage === "extracting" ? "（记录角色中）" : compressStage === "summarizing" ? "（生成摘要中）" : ""}
          </span>
          <button className="seed-compress-stop" onClick={stopCompress} data-tooltip="停止整理（不保存任何变更）">停止</button>
        </div>
      )}

      {/* 场景信息条（顶部，一行自适应：放得下直接显示，放不下折叠；仅格式分析可用时显示） */}
      {/* 场景信息条（顶部，一行自适应：放得下直接显示，放不下折叠；仅冒险会话显示，空白格式会话不启用场景条） */}
      {!isBlank && visibleMessages.length > 0 && (hasSceneAnalysis || analysisPending) && (
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
                <SceneInfoBar scene={sceneInfo} streaming={analysisPending} wrap />
              )}
            </>
          ) : (
            <SceneInfoBar scene={sceneInfo} streaming={analysisPending} />
          )}
        </div>
      )}
      {resumeChip && sceneAnalysisData?.chapterTitle && (
        <div className="narra-resume-chip">
          <span>上次写到：{sceneAnalysisData.chapterTitle}</span>
          <button className="narra-icon-btn" aria-label="关闭" onClick={() => setResumeChip(false)}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 6 L18 18 M18 6 L6 18" /></svg>
          </button>
        </div>
      )}

      {/* Scrollable content */}
      <div
        className="seed-dialogue-scroll"
        ref={scrollRef}
        onScroll={handleScroll}
        onClick={(e) => {
          const t = e.target as HTMLElement;
          if (t.closest("button, a, textarea, input, .seed-msg-actions, .narra-reader-sheet, .narra-read-bar, .narra-opening-fail, .narra-scene-fail")) return;
          if (window.getSelection()?.toString()) return;
          setChromeTapHidden((v) => !v);
        }}
        style={{ paddingBottom: chromeHidden ? 8 : 152 }}
      >
        <div className="seed-dialogue-content">
          {/* Chapter divider：第 N 章 · 章节名（格式分析动态更新，仅冒险会话；无分析数据固定第一章） */}
          {visibleMessages.length > 0 && hasFormat && (
            <div key={chapterNo + ":" + (chapterName || "")} className="seed-chapter-divider seed-chapter-divider--transition">
              <span>{chapterName ? `第 ${chapterNo} 章 · ${chapterName}` : "第一章"}</span>
              <span className="seed-chapter-line" />
            </div>
          )}

          {/* Messages as paragraphs */}
          {(() => {
            // 找到第一个 assistant 消息的 id，用于首字下沉
            const firstAssistantId = visibleMessages.find((m) => m.role === "assistant")?.id;
            return visibleMessages.map((msg, idx) => {
              // 搜索结果跳转：目标消息正文内高亮匹配关键词
              const hl = highlightId === msg.id && targetKeyword ? targetKeyword : "";
              // 空内容的 assistant 消息（未完成的流式占位）不渲染，避免空白条；工具调用消息除外
              if (msg.role === "assistant" && !msg.content && !(msg.tools && msg.tools.length > 0)) return null;
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
                        <button className="seed-edit-btn" onClick={handleEditAndSend} disabled={!editValue.trim()}>发送</button>
                        <button className="seed-edit-btn seed-edit-btn--save" onClick={handleSaveEdit} disabled={!editValue.trim()}>保存</button>
                      </div>
                    </div>
                  );
                }
                return (
                  <div key={msg.id} data-msg-id={msg.id} className={"seed-msg-wrapper" + (highlightId === msg.id ? " seed-msg-highlight" : "")} style={{ animationDelay: `${Math.min(idx * 0.05, 0.5)}s` }}>
                    <p className="seed-user-input" style={{ fontSize: msgFontSize - 1 }}>
                      {hl ? <HighlightText text={msg.content} keyword={hl} /> : msg.content}
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
                      {!streaming && <button className="seed-msg-action-btn" data-tooltip="创建分支" onClick={() => setBranchTarget(msg)}>
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="6" y1="3" x2="6" y2="15" />
                          <circle cx="18" cy="6" r="3" />
                          <circle cx="6" cy="18" r="3" />
                          <path d="M18 9a9 9 0 0 1-9 9" />
                        </svg>
                      </button>}
                    </div>
                    {copiedId === msg.id && <span className="seed-copied-toast">已复制</span>}
                  </div>
                );
              }
              // 工具调用消息：running/aborted 显示徽章；完成后显示轻量提示（tools 已持久化，刷新后仍可见）
              if (msg.tools && msg.tools.length > 0) {
                if (msg.toolStatus === "running" || msg.toolStatus === "aborted") {
                  return (
                    <ToolCallBadge
                      key={msg.id}
                      status={msg.toolStatus || "done"}
                      startTime={msg.createdAt}
                      toolNames={msg.toolCalls ? msg.toolCalls.map((tc) => tc.function.name) : msg.tools}
                    />
                  );
                }
                return (
                  <div key={msg.id} className="seed-tool-done">
                    <svg className="seed-tool-done-icon" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="11" cy="11" r="8" />
                      <path d="m21 21-4.3-4.3" />
                    </svg>
                    <span>{toolDoneLabel(msg.tools)}</span>
                  </div>
                );
              }
              // Assistant message：首段加 drop-cap class
              const isStreaming = streaming && msg === lastMsg && msg.role === "assistant";
              const isDropCap = !isBlank && msg.id === firstAssistantId;
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
                      <button className="seed-edit-btn seed-edit-btn--save" onClick={handleSaveEdit} disabled={!editValue.trim()}>保存</button>
                    </div>
                  </div>
                );
              }
              return (
                <div key={msg.id} data-msg-id={msg.id} className={"seed-msg-wrapper" + (highlightId === msg.id ? " seed-msg-highlight" : "")} style={{ animationDelay: `${Math.min(idx * 0.05, 0.5)}s` }}>
                  <div
                    className={
                      (hasFormat
                        ? `seed-narration${isDropCap ? " seed-narration--drop-cap" : ""}`
                        : "seed-chat-assistant") +
                      (settlingId === msg.id ? " seed-narration--settle" : "")
                    }
                    style={{ fontSize: msgFontSize }}
                    onAnimationEnd={(e) => {
                      if (e.animationName === "seed-settle-in" && settlingId === msg.id) setSettlingId(null);
                    }}
                  >
                    {isStreaming ? (
                      <StreamingText content={msg.content} active={isStreaming} />
                    ) : hasFormat ? (
                      hl ? <HighlightText text={parseSceneReply(msg.content).body || msg.content} keyword={hl} /> : (parseSceneReply(msg.content).body || msg.content)
                    ) : (
                      <MarkdownRender content={msg.content} highlight={hl || undefined} />
                    )}
                  </div>
                  {/* AI 生成合规标识 + token 消耗（低调展示；↑上传/输入 ↓下载/输出） */}
                  {!isStreaming && msg.role === "assistant" && msg.tokenUsage && (
                    <div className="seed-ai-meta">
                      <div>本回答由 AI 生成，内容仅供参考，请仔细甄别</div>
                      <div style={{ fontVariantNumeric: "tabular-nums" }}>
                        ↑{fmtTokens(msg.tokenUsage.input)}&nbsp;&nbsp;↓{fmtTokens(msg.tokenUsage.output)}
                      </div>
                    </div>
                  )}
                  {!isStreaming && msg.content && (
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
                      {!streaming && <button className="seed-msg-action-btn" data-tooltip="重新回答" onClick={() => handleRegenerate(msg.id)}>
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M3 12a9 9 0 1 0 9-9" />
                          <path d="M3 4v5h5" />
                        </svg>
                      </button>}
                      {!streaming && <button className="seed-msg-action-btn" data-tooltip="创建分支" onClick={() => setBranchTarget(msg)}>
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="6" y1="3" x2="6" y2="15" />
                          <circle cx="18" cy="6" r="3" />
                          <circle cx="6" cy="18" r="3" />
                          <path d="M18 9a9 9 0 0 1-9 9" />
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
          {typingActive && (
            <div className="seed-typing">
              <span /><span /><span />
              <span className="seed-typing-label">
                {typingSec >= 60
                  ? `${Math.floor(typingSec / 60)}m ${typingSec % 60}s`
                  : `${typingSec}s`}
                {activeSession?.thinkingEnabled ? " · 规划中" : ""}
              </span>
              {/* 规划中迷你思考窗口：小字低对比，实时显示思考过程（防误以为卡住）；思考完成后随指示器隐藏 */}
              {activeSession?.thinkingEnabled && lastMsg?.thinking ? (
                <div ref={thinkingMiniRef} className="seed-thinking-mini">
                  <StreamingText content={lastMsg.thinking} active={streaming} live />
                </div>
              ) : null}
            </div>
          )}

          {/* Empty state */}
          {!openingActive && visibleMessages.length === 0 && (
            <div style={{ textAlign: "center", padding: "80px 0", color: "var(--seed-muted)" }}>
              <p style={{ fontSize: 16, marginBottom: 8 }}>{isBlank ? "空白稿纸" : "故事即将开始"}</p>
              <p style={{ fontSize: 14, opacity: 0.7 }}>
                {isBlank ? "写一段、改一页，或先排个版。" : "输入你的第一句话，开启冒险之旅"}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Bottom input area：下滑看历史时自动隐藏（含推荐条），上滑/滚到底/输入中自动显示 */}
      <div
        className="seed-input-area"
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          transform: chromeHidden ? "translateY(calc(100% + 2px))" : "none",
        }}
      >
        {/* 对话推荐条（输入框上方，可折叠）：与输入区同属底部浮层，一起隐藏/显示；
            仅格式分析可用时显示（无分析数据直接隐藏，不做兜底） */}
        {!isBlank && (suggestions.length > 0 || analysisPending) && (
          <div className="seed-suggest-bar">
            <div className="seed-suggest-head" onClick={() => setSuggestBarOpen((v) => !v)}>
              <span className="seed-suggest-head-title">
                {suggestions.length > 0 ? `对话推荐 (${suggestions.length})` : "正在生成场景与推荐…"}
              </span>
              <svg
                className={`seed-scene-chevron${suggestBarOpen ? " is-open" : ""}`}
                width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              >
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </div>
            {suggestBarOpen && (
              <SuggestBar suggestions={suggestions} streaming={streaming || analysisPending} onPick={handleSuggest} />
            )}
          </div>
        )}
        <div className="seed-input-inner">
          <div className="seed-input-row">
            <textarea
              ref={inputRef}
              className="seed-text-input"
              placeholder={streaming ? "AI 正在回复..." : isBlank ? "输入消息..." : "继续书写故事..."}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              onInput={(e) => fitTextarea(e.currentTarget, 160)}
              onFocus={() => { setInputHidden(false); setChromeTapHidden(false); }}
              rows={1}
              disabled={streaming}
              style={{ resize: "none" }}
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
          <FunctionBar mode={isBlank ? "blank" : "adventure"} historyTokens={historyTokens} />
        </div>
      </div>

      {branchTarget && activeSession && (
        <ConfirmDialog
          title="创建分支话题"
          message="将以本条消息为分叉点，把本条及以上所有内容复制到一个新话题并切换过去，两个话题之后各自独立。确定创建分支？"
          confirmLabel="创建分支"
          cancelLabel="取消"
          onConfirm={handleBranchConfirm}
          onCancel={() => setBranchTarget(null)}
        />
      )}

      {/* 自动压缩确认：对话过长时提示（含 token 估算与保留说明） */}
      {compressPrompt && compressPromptCallbacks && (
        <ConfirmDialog
          title="对话较长，建议保存记忆"
          message={`当前会话已有 ${compressPrompt.count} 条消息。整理将新建一个续集会话（第 ${(() => {
            const cur = useSessionStore.getState().sessions.find((s) => s.id === compressPrompt.sessionId);
            return (cur?.chainIndex ?? 1) + 1;
          })()} 卷）：继承本会话的设定与角色卡，自动生成剧情档案带入续集，相关旧消息在后续对话中按需触发注入；原会话将锁定只读（仍可创建分支）。预计消耗约 ${compressPrompt.estimatedTokens} token，整理期间无法操作。是否整理？`}
          confirmLabel="整理"
          cancelLabel="暂不"
          onConfirm={compressPromptCallbacks.onConfirm}
          onCancel={compressPromptCallbacks.onCancel}
        />
      )}
    </div>
  );
}

// === token 数字格式化：<1000 原数，≥1000 X.Xk，≥10000 整数 k ===
function fmtTokens(n: number): string {
  if (n >= 10000) return `${Math.round(n / 1000)}k`;
  if (n >= 1000) return `${(n / 1000).toFixed(1).replace(/\.0$/, "")}k`;
  return String(n);
}

// === 文本关键词高亮（搜索结果跳转后，正文内匹配词以紫色标记） ===
function HighlightText({ text, keyword }: { text: string; keyword: string }) {  if (!keyword) return <>{text}</>;
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const lower = keyword.toLowerCase();
  const parts = text.split(new RegExp(`(${escaped})`, "ig"));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === lower ? (
          <span key={i} className="seed-hl">{part}</span>
        ) : (
          part
        ),
      )}
    </>
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
      {scene &&
        fields.map((f) => (
          <span key={f.label} className="seed-scene-field">
            <svg className="seed-scene-field-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">{f.icon}</svg>
            <span className="seed-scene-field-label">{f.label}</span>
            <span className="seed-scene-field-value">{f.value || "——"}</span>
          </span>
        ))}
      {streaming && (
        <span className="seed-scene-live">{scene ? "更新中…" : "场景信息生成中…"}</span>
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

// === 工具完成后轻量提示文案 ===
function toolDoneLabel(tools: string[]) {
  if (tools.includes("web_search")) return "已联网搜索";
  const others = tools.filter((t) => t !== "web_search");
  if (others.length === 0) return "已联网搜索";
  if (others.length === 1) {
    const name = others[0].split(":").pop() || others[0];
    return `已调用工具：${name}`;
  }
  return `已调用 ${others.length} 个工具`;
}

// === 工具调用标识组件 ===
// 不显示调用内容/参数，只显示轻量提示（running 小转圈 + 计时，aborted 停止态）
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

  const label = (() => {
    if (toolNames.includes("web_search")) return "正在联网搜索";
    const others = toolNames.filter((t) => t !== "web_search");
    if (others.length === 0) return "正在联网搜索";
    if (others.length === 1) {
      const name = others[0].split(":").pop() || others[0];
      return `正在调用工具：${name}`;
    }
    return `正在调用 ${toolNames.length} 个工具`;
  })();

  return (
    <div className={`seed-tool-badge seed-tool-badge--${status}`}>
      <div className="seed-tool-badge-inner">
        {status === "running" ? (
          <svg className="seed-tool-spinner" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
          </svg>
        ) : (
          <svg className="seed-tool-icon" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
          </svg>
        )}
        <span className="seed-tool-label">{label}</span>
        {status === "running" && (
          <span className="seed-tool-timer">{formatTime(elapsed)}</span>
        )}
        {status === "aborted" && (
          <span className="seed-tool-aborted-text">已停止</span>
        )}
      </div>
    </div>
  );
}
