import { useState, useRef, useEffect } from "react";
import { ArrowUp, Square, ChevronDown, Sparkles, Image as ImageIcon, Paperclip, Hash, Brain, Wifi, Server, X, AlertTriangle, Upload } from "lucide-react";
import { TemplatePicker } from "@/components/Settings/TemplatePicker";
import { useProviderStore } from "@/stores/providerStore";
import { useSessionStore } from "@/stores/sessionStore";
import { useMcpStore } from "@/stores/mcpStore";
import { useUIStore } from "@/stores/uiStore";
import type { AttachedFile } from "@/types";
import { IMAGE_SIZE_LIMIT, FILE_SIZE_LIMIT, MAX_IMAGES, MAX_FILES, IMAGE_ACCEPT, FILE_ACCEPT, isThinkingModel } from "@/providers/openai";

const IMAGE_MIME_SET = new Set(IMAGE_ACCEPT.split(","));
const FILE_EXT_SET = new Set(FILE_ACCEPT.split(",").map((s) => s.trim().toLowerCase()));

function getExtension(name: string): string {
  const idx = name.lastIndexOf(".");
  return idx < 0 ? "" : name.slice(idx).toLowerCase();
}

function MiniSelect({
  value, onChange, options, placeholder, disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const current = options.find((o) => o.value === value);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 rd-5 cp tr-all"
        style={{
          height: 24,
          padding: "0 8px",
          background: "var(--bg-card)",
          color: current ? "var(--text-secondary)" : "var(--text-muted)",
          border: "1px solid var(--border-light)",
          fontSize: "var(--fs-12)",
          cursor: disabled ? "not-allowed" : "pointer",
          maxWidth: 200,
          whiteSpace: "nowrap",
          transition: "all 0.15s ease",
        }}
        onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.background = "var(--bg-hover)"; }}
        onMouseLeave={(e) => { if (!disabled) e.currentTarget.style.background = "var(--bg-card)"; }}
      >
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", maxWidth: 170, lineHeight: 1, display: "block" }}>
          {current?.label ?? placeholder ?? "选择"}
        </span>
        <ChevronDown size={10} style={{ flexShrink: 0, opacity: 0.5, lineHeight: 1 }} />
      </button>
      {open && !disabled && (
        <div
          className="rd-6 ov-ya sh-md"
          style={{
            position: "absolute",
            bottom: "calc(100% + 4px)",
            left: 0,
            minWidth: 200,
            background: "var(--bg-overlay)",
            border: "1px solid var(--border-medium)",
            backdropFilter: "var(--blur-md)",
            WebkitBackdropFilter: "var(--blur-md)",
            zIndex: "var(--z-dropdown)",
            maxHeight: 200,
            overflowY: "auto",
            padding: "3px",
          }}
        >
          {options.length === 0 && (
            <div style={{ fontSize: "var(--fs-11)", color: "var(--text-muted)", textAlign: "center", padding: "8px 4px" }}>无选项</div>
          )}
          {options.map((o) => (
            <button
              key={o.value}
              onClick={() => { onChange(o.value); setOpen(false); }}
              className="rd-4 cp tr-all"
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                padding: "5px 8px",
                fontSize: "var(--fs-12)",
                lineHeight: 1.3,
                background: o.value === value ? "var(--accent-bg)" : "transparent",
                color: o.value === value ? "var(--accent)" : "var(--text-primary)",
                border: "none",
                cursor: "pointer",
              }}
              onMouseEnter={(e) => { if (o.value !== value) (e.currentTarget.style.background = "var(--bg-hover)"); }}
              onMouseLeave={(e) => { if (o.value !== value) (e.currentTarget.style.background = "transparent"); }}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const DEFAULT_CONTEXT_LIMIT = 128000;

function ContextRing({ tokens, limit = DEFAULT_CONTEXT_LIMIT }: { tokens: number; limit?: number }) {
  const pct = Math.min(tokens / limit, 1);
  const warn = pct >= 0.9;
  const r = 9;
  const c = 2 * Math.PI * r;
  const offset = c * (1 - pct);
  const color = warn ? "var(--danger)" : pct >= 0.7 ? "var(--warning)" : "var(--accent)";
  const label = tokens >= 1000 ? `${(tokens / 1000).toFixed(1)}K` : `${tokens}`;
  const pctText = `${Math.round(pct * 100)}%`;

  return (
    <div
      title={`上下文: ${label} / ${(limit / 1000).toFixed(0)}K tokens${warn ? " (接近上限)" : ""}`}
      style={{ position: "relative", width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
    >
      <svg width={24} height={24} style={{ transform: "rotate(-90deg)", position: "absolute" }}>
        <circle cx={12} cy={12} r={r} fill="none" stroke="var(--border-light)" strokeWidth={2} />
        <circle
          cx={12} cy={12} r={r} fill="none"
          stroke={color} strokeWidth={2}
          strokeDasharray={c} strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.3s ease, stroke 0.3s ease" }}
        />
      </svg>
      <span style={{
        fontSize: 7, fontWeight: 600, lineHeight: 1,
        color: warn ? "var(--danger)" : "var(--text-tertiary)",
      }}>{pctText}</span>
    </div>
  );
}

export function MessageInput({ onSend, onStop, streaming, contextTokens = 0 }: {
  onSend: (text: string, images?: string[], files?: AttachedFile[]) => void;
  onStop: () => void;
  streaming: boolean;
  contextTokens?: number;
}) {
  const [text, setText] = useState("");
  const [selectedImages, setSelectedImages] = useState<{ name: string; dataUrl: string }[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<AttachedFile[]>([]);
  const [warning, setWarning] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);
  const dragTargetRef = useRef<EventTarget | null>(null);
  const dragOverZoneRef = useRef(false);
  const [templatePickerOpen, setTemplatePickerOpen] = useState(false);
  const templateBtnRef = useRef<HTMLButtonElement>(null);

  const { providers, activeProviderId, setActiveProvider, activeModel, setActiveModel } = useProviderStore();
  const { activeId, updateSessionModel, toggleThinking } = useSessionStore();
  const activeProvider = providers.find((p) => p.id === activeProviderId);
  const activeSession = useSessionStore((s) => s.activeId ? s.sessions.find((ss) => ss.id === s.activeId) : null);
  const thinkingEnabled = activeSession?.thinkingEnabled ?? false;
  const supportsImages = activeProvider?.supportsImages ?? false;
  const { webSearchOn, setWebSearchOn, mcpActive: mcpActiveUI, setMcpActive } = useUIStore();
  const servers = useMcpStore(s => s.servers);
  const activeServerIds = useMcpStore(s => s.activeServerIds);
  const setActiveServers = useMcpStore(s => s.setActiveServers);
  const mcpActive = activeServerIds.length > 0;

  useEffect(() => {
    import("@/lib/db").then(m => m.getAppSetting("web_search_enabled")).then(v => {
      const on = v === "1";
      setWebSearchOn(on);
      if (on) {
        import("@/hooks/useChat").then(m => m.setToolsEnabled(true));
      }
    });
    import("@/lib/db").then(m => m.getAppSetting("mcp_active_server_ids")).then(v => {
      if (v) {
        try {
          const ids: string[] = JSON.parse(v);
          if (ids.length > 0) {
            setActiveServers(ids);
            setMcpActive(true);
          }
        } catch {}
      }
    });
  }, []);

  const toggleWebSearch = async () => {
    const next = !webSearchOn;
    console.log("[tools] toggleWebSearch: webSearchOn =", webSearchOn, "→ next =", next);
    setWebSearchOn(next);
    const { setToolsEnabled } = await import("@/hooks/useChat");
    console.log("[tools] toggleWebSearch: calling setToolsEnabled(", next, ")");
    setToolsEnabled(next);
    const { setAppSetting } = await import("@/lib/db");
    await setAppSetting("web_search_enabled", next ? "1" : "0");
    console.log("[tools] toggleWebSearch: done, saved to DB");
  };

  const syncSessionModel = (providerId: string, model: string) => {
    if (activeId) {
      updateSessionModel(activeId, providerId, model, isThinkingModel(model));
    }
  };

  const insertTemplateContent = (content: string) => {
    setText((prev) => {
      if (!prev) return content;
      if (prev.endsWith(" ") || prev.endsWith("\n")) return prev + content;
      return prev + "\n" + content;
    });
  };

  useEffect(() => {
    const el = ref.current;
    if (el) { el.style.height = "auto"; el.style.height = Math.min(el.scrollHeight, 160) + "px"; }
  }, [text]);

  useEffect(() => {
    if (warning) {
      const t = setTimeout(() => setWarning(""), 4000);
      return () => clearTimeout(t);
    }
  }, [warning]);

  useEffect(() => {
    if (!supportsImages && selectedImages.length > 0) {
      setSelectedImages([]);
    }
  }, [supportsImages]);

  // Global drag-and-drop listeners for reliable WebView2 support
  useEffect(() => {
    const el = dropZoneRef.current;
    if (!el) return;

    const processDroppedFiles = (files: FileList) => {
      const fileArr = Array.from(files);
      const imageFiles: File[] = [];
      const textFiles: File[] = [];
      const unsupported: string[] = [];

      for (const f of fileArr) {
        const ext = getExtension(f.name);
        const isImage = f.type && IMAGE_MIME_SET.has(f.type);
        const isText = FILE_EXT_SET.has(ext);

        if (isImage) {
          imageFiles.push(f);
        } else if (isText) {
          textFiles.push(f);
        } else {
          unsupported.push(f.name);
        }
      }

      if (unsupported.length > 0) {
        const names = unsupported.length <= 3 ? unsupported.join("、") : `${unsupported.slice(0, 3).join("、")} 等 ${unsupported.length} 个文件`;
        setWarning(`不支持的文件类型: ${names}`);
      }

      if (imageFiles.length > 0 && !supportsImages) {
        setWarning("当前模型不支持图片，请在设置中开启视觉支持");
      } else if (imageFiles.length > 0) {
        if (selectedImages.length + imageFiles.length > MAX_IMAGES) {
          setWarning(`最多上传 ${MAX_IMAGES} 张图片`);
          imageFiles.length = MAX_IMAGES - selectedImages.length;
        }
        for (const f of imageFiles.slice(0, MAX_IMAGES - selectedImages.length)) {
          if (f.size > IMAGE_SIZE_LIMIT) {
            setWarning(`图片 "${f.name}" 超过 10MB 限制`);
            continue;
          }
          const reader = new FileReader();
          reader.onload = () => {
            setSelectedImages((prev) => {
              if (prev.length >= MAX_IMAGES) return prev;
              return [...prev, { name: f.name, dataUrl: reader.result as string }];
            });
          };
          reader.readAsDataURL(f);
        }
      }

      if (textFiles.length > 0) {
        if (selectedFiles.length + textFiles.length > MAX_FILES) {
          setWarning(`最多上传 ${MAX_FILES} 个文件`);
          textFiles.length = MAX_FILES - selectedFiles.length;
        }
        for (const f of textFiles.slice(0, MAX_FILES - selectedFiles.length)) {
          if (f.size > FILE_SIZE_LIMIT) {
            setWarning(`文件 "${f.name}" 超过 5MB 限制`);
            continue;
          }
          const reader = new FileReader();
          reader.onload = () => {
            const content = reader.result as string;
            setSelectedFiles((prev) => {
              if (prev.length >= MAX_FILES) return prev;
              if (prev.some((x) => x.name === f.name)) return prev;
              return [...prev, { name: f.name, content }];
            });
          };
          reader.onerror = () => {
            setWarning(`无法读取 "${f.name}"，可能是二进制文件`);
          };
          reader.readAsText(f);
        }
      }
    };

    const onDragEnterDoc = (e: DragEvent) => {
      e.preventDefault();
      if (!e.dataTransfer?.types.includes("Files")) return;
      dragTargetRef.current = e.target;
      if (el.contains(e.target as Node)) {
        dragOverZoneRef.current = true;
        setIsDragging(true);
      }
    };

    const onDragOverDoc = (e: DragEvent) => {
      e.preventDefault();
      if (!e.dataTransfer?.types.includes("Files")) return;
      e.dataTransfer.dropEffect = "copy";
      const inZone = el.contains(e.target as Node);
      if (inZone !== dragOverZoneRef.current) {
        dragOverZoneRef.current = inZone;
        setIsDragging(inZone);
      }
    };

    const onDragLeaveDoc = (e: DragEvent) => {
      e.preventDefault();
      if (dragTargetRef.current === e.target) {
        dragOverZoneRef.current = false;
        setIsDragging(false);
      }
    };

    const onDropDoc = (e: DragEvent) => {
      e.preventDefault();
      dragOverZoneRef.current = false;
      setIsDragging(false);
      if (!e.dataTransfer?.files.length) return;
      if (!el.contains(e.target as Node)) return;
      processDroppedFiles(e.dataTransfer.files);
    };

    document.addEventListener("dragenter", onDragEnterDoc, true);
    document.addEventListener("dragover", onDragOverDoc, true);
    document.addEventListener("dragleave", onDragLeaveDoc, true);
    document.addEventListener("drop", onDropDoc, true);

    return () => {
      document.removeEventListener("dragenter", onDragEnterDoc, true);
      document.removeEventListener("dragover", onDragOverDoc, true);
      document.removeEventListener("dragleave", onDragLeaveDoc, true);
      document.removeEventListener("drop", onDropDoc, true);
    };
  }, [supportsImages, selectedImages.length, selectedFiles.length]);

  const handleSend = () => {
    const t = text.trim();
    if (!t || streaming) return;
    if (selectedImages.length > 0 && !supportsImages) {
      setWarning("当前模型不支持图片，请在设置中开启视觉支持");
      setSelectedImages([]);
      return;
    }
    onSend(
      t,
      selectedImages.length > 0 ? selectedImages.map((i) => i.dataUrl) : undefined,
      selectedFiles.length > 0 ? selectedFiles : undefined,
    );
    setText("");
    setSelectedImages([]);
    setSelectedFiles([]);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!supportsImages) {
      setWarning("当前模型不支持图片，请在设置中开启视觉支持");
      return;
    }
    if (selectedImages.length + files.length > MAX_IMAGES) {
      setWarning(`最多上传 ${MAX_IMAGES} 张图片`);
      return;
    }
    for (const file of files) {
      if (file.size > IMAGE_SIZE_LIMIT) {
        setWarning(`图片 "${file.name}" 超过 10MB 限制`);
        continue;
      }
      const reader = new FileReader();
      reader.onload = () => {
        setSelectedImages((prev) => {
          if (prev.length >= MAX_IMAGES) return prev;
          return [...prev, { name: file.name, dataUrl: reader.result as string }];
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (selectedFiles.length + files.length > MAX_FILES) {
      setWarning(`最多上传 ${MAX_FILES} 个文件`);
      return;
    }
    for (const file of files) {
      if (file.size > FILE_SIZE_LIMIT) {
        setWarning(`文件 "${file.name}" 超过 5MB 限制`);
        continue;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const content = reader.result as string;
        setSelectedFiles((prev) => {
          if (prev.length >= MAX_FILES) return prev;
          if (prev.some((f) => f.name === file.name)) return prev;
          return [...prev, { name: file.name, content }];
        });
      };
      reader.onerror = () => {
        setWarning(`无法读取 "${file.name}"，可能是二进制文件`);
      };
      reader.readAsText(file);
    }
  };

  const removeImage = (name: string) => {
    setSelectedImages((prev) => prev.filter((i) => i.name !== name));
  };

  const removeFile = (name: string) => {
    setSelectedFiles((prev) => prev.filter((f) => f.name !== name));
  };

  const hasAttachments = selectedImages.length > 0 || selectedFiles.length > 0;

  return (
    <div style={{ padding: "4px 16px 12px" }}>
      <div className="mw-5xl mx-auto">
        <div
          ref={dropZoneRef}
          className="glass-input rd-16 tr-all"
          style={{
            display: "flex",
            flexDirection: "column",
            padding: "12px 14px 8px",
            position: "relative",
            borderColor: isDragging ? "var(--accent)" : undefined,
            boxShadow: isDragging ? "0 0 24px var(--accent-glow)" : undefined,
          }}
        >
          {/* Drop zone overlay */}
          {isDragging && (
            <div
              className="rd-16 flex flex-col items-center justify-center gap-2"
              style={{
                position: "absolute", inset: 0, zIndex: "var(--z-inner)",
                background: "var(--accent-bg)",
                border: "2px dashed var(--accent)",
                borderRadius: 16,
                pointerEvents: "none",
              }}
            >
              <Upload size={28} style={{ color: "var(--accent)", opacity: 0.8 }} />
              <span style={{ fontSize: "var(--fs-13)", color: "var(--accent)", fontWeight: 500 }}>
                释放以添加文件
              </span>
              <span style={{ fontSize: "var(--fs-11)", color: "var(--text-tertiary)" }}>
                支持图片和文本文件
              </span>
            </div>
          )}
          {/* Attachment preview area */}
          {hasAttachments && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
              {selectedImages.map((img) => (
                <div
                  key={img.name}
                  className="rd-8"
                  style={{
                    position: "relative", width: 64, height: 64,
                    flexShrink: 0, overflow: "hidden",
                    border: "1px solid var(--border-light)",
                  }}
                >
                  <img
                    src={img.dataUrl}
                    alt={img.name}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                  <button
                    onClick={() => removeImage(img.name)}
                    className="cp"
                    style={{
                      position: "absolute", top: 2, right: 2,
                      width: 18, height: 18, borderRadius: "50%",
                      background: "rgba(0,0,0,0.6)", border: "none",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      color: "#fff", padding: 0,
                    }}
                  >
                    <X size={10} />
                  </button>
                </div>
              ))}
              {selectedFiles.map((f) => (
                <div
                  key={f.name}
                  className="flex items-center gap-1-5 rd-8"
                  style={{
                    padding: "5px 10px", height: 32,
                    background: "var(--bg-hover)",
                    border: "1px solid var(--border-light)",
                    fontSize: "var(--fs-11)", color: "var(--text-secondary)",
                    maxWidth: 200, flexShrink: 0,
                  }}
                >
                  <Paperclip size={10} style={{ flexShrink: 0, opacity: 0.5 }} />
                  <span className="truncate" style={{ maxWidth: 120 }}>{f.name}</span>
                  <button
                    onClick={() => removeFile(f.name)}
                    className="cp txt-muted"
                    style={{ background: "none", border: "none", padding: "0 2px" }}
                  >
                    <X size={10} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Warning message */}
          {warning && (
            <div
              className="flex items-center gap-1-5 rd-6 txt-tertiary"
              style={{
                padding: "4px 10px", marginBottom: 8,
                background: "var(--danger-bg)", color: "var(--danger)",
                fontSize: "var(--fs-11)",
              }}
            >
              <AlertTriangle size={11} style={{ flexShrink: 0 }} />
              <span>{warning}</span>
            </div>
          )}

          {/* Textarea */}
          <textarea
            ref={ref}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onKey}
            style={{
              width: "100%",
              background: "transparent",
              border: "none",
              outline: "none",
              resize: "none",
              fontSize: "var(--fs-14)",
              lineHeight: 1.5,
              color: "var(--text-primary)",
              minHeight: 26,
              maxHeight: 160,
              padding: "2px 0",
              fontFamily: "inherit",
            }}
            placeholder="输入消息..."
          />

          {/* Hidden file inputs */}
          <input
            ref={imageInputRef}
            type="file"
            accept={IMAGE_ACCEPT}
            multiple
            style={{ display: "none" }}
            onChange={handleImageSelect}
          />
          <input
            ref={fileInputRef}
            type="file"
            accept={FILE_ACCEPT}
            multiple
            style={{ display: "none" }}
            onChange={handleFileSelect}
          />

          {/* Bottom toolbar */}
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: 6,
            paddingTop: 7,
            borderTop: "1px solid var(--border-light)",
          }}>
            {/* Left: selectors + quick tools */}
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <button
                onClick={() => imageInputRef.current?.click()}
                className={`btn-ghost cp ${!supportsImages ? "op40" : ""}`}
                title={supportsImages ? "上传图片" : "当前模型不支持图片，请在设置中开启视觉支持"}
                style={{
                  width: 24, height: 24, padding: 0,
                  cursor: supportsImages ? "pointer" : "not-allowed",
                }}
                disabled={!supportsImages}
              >
                <ImageIcon size={12} />
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="btn-ghost cp"
                title="上传文件 (txt, md, json, csv, 代码文件等)"
                style={{ width: 24, height: 24, padding: 0 }}
              >
                <Paperclip size={12} />
              </button>
              <div style={{ width: 1, height: 14, background: "var(--border-light)", margin: "0 2px" }} />
              <Sparkles size={12} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
              <MiniSelect
                value={activeProviderId ?? ""}
                onChange={(pid) => {
                  setActiveProvider(pid);
                  const prov = providers.find((pr) => pr.id === pid);
                  const firstModel = prov?.models[0] ?? "";
                  setActiveModel(firstModel);
                  syncSessionModel(pid, firstModel);
                }}
                options={providers.map((pr) => ({ value: pr.id, label: pr.name }))}
                placeholder="Provider"
                disabled={providers.length === 0}
              />
              <span style={{ color: "var(--text-muted)", fontSize: "var(--fs-12)", lineHeight: 1 }}>·</span>
              <MiniSelect
                value={activeModel ?? ""}
                onChange={(m) => {
                  setActiveModel(m);
                  syncSessionModel(activeProviderId ?? "", m);
                }}
                options={(activeProvider?.models ?? []).map((m) => ({ value: m, label: m }))}
                placeholder="模型"
                disabled={!activeProvider || activeProvider.models.length === 0}
              />
              <div style={{ width: 1, height: 14, background: "var(--border-light)", margin: "0 2px" }} />
              <button
                onClick={() => { if (activeId) toggleThinking(activeId); }}
                className="cp tr-all"
                title={thinkingEnabled ? "思考模式已开启" : "思考模式已关闭"}
                style={{
                  height: 24, padding: "0 6px", borderRadius: 6,
                  display: "flex", alignItems: "center", gap: 4,
                  background: thinkingEnabled ? "var(--accent-bg)" : "transparent",
                  border: thinkingEnabled ? "1px solid var(--accent-border)" : "1px solid transparent",
                  color: thinkingEnabled ? "var(--accent)" : "var(--text-muted)",
                  fontSize: "var(--fs-12)", cursor: "pointer",
                  transition: "all 0.15s ease",
                  whiteSpace: "nowrap",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.gap = "4px";
                  const s = e.currentTarget.querySelector("span");
                  if (s) s.style.display = "inline";
                  if (!thinkingEnabled) e.currentTarget.style.color = "var(--text-secondary)";
                }}
                onMouseLeave={(e) => {
                  const s = e.currentTarget.querySelector("span");
                  if (s) s.style.display = "none";
                  if (!thinkingEnabled) e.currentTarget.style.color = "var(--text-muted)";
                }}
              >
                <Brain size={12} style={{ flexShrink: 0 }} />
                <span style={{ lineHeight: 1, display: "none" }}>思考</span>
              </button>
              <button
                onClick={toggleWebSearch}
                className="cp tr-all"
                title={webSearchOn ? "联网搜索已开启" : "联网搜索已关闭"}
                style={{
                  height: 24, padding: "0 6px", borderRadius: 6,
                  display: "flex", alignItems: "center", gap: 4,
                  background: webSearchOn ? "var(--accent-bg)" : "transparent",
                  border: webSearchOn ? "1px solid var(--accent-border)" : "1px solid transparent",
                  color: webSearchOn ? "var(--accent)" : "var(--text-muted)",
                  fontSize: "var(--fs-12)", cursor: "pointer",
                  transition: "all 0.15s ease",
                  whiteSpace: "nowrap",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.gap = "4px";
                  const s = e.currentTarget.querySelector("span");
                  if (s) s.style.display = "inline";
                  if (!webSearchOn) e.currentTarget.style.color = "var(--text-secondary)";
                }}
                onMouseLeave={(e) => {
                  const s = e.currentTarget.querySelector("span");
                  if (s) s.style.display = "none";
                  if (!webSearchOn) e.currentTarget.style.color = "var(--text-muted)";
                }}
              >
                <Wifi size={12} style={{ flexShrink: 0 }} />
                <span style={{ lineHeight: 1, display: "none" }}>联网</span>
              </button>
              <button
                onClick={async () => {
                  const nextIds = mcpActive ? [] : servers.filter(s => s.status !== "error").map(s => s.id);
                  setActiveServers(nextIds);
                  setMcpActive(nextIds.length > 0);
                  const { setAppSetting } = await import("@/lib/db");
                  await setAppSetting("mcp_active_server_ids", JSON.stringify(nextIds));
                }}
                className="cp tr-all"
                title={mcpActive ? `MCP 工具已开启 (${activeServerIds.length})` : "MCP 工具已关闭"}
                style={{
                  height: 24, padding: "0 6px", borderRadius: 6,
                  display: "flex", alignItems: "center", gap: 4,
                  background: mcpActive ? "var(--accent-bg)" : "transparent",
                  border: mcpActive ? "1px solid var(--accent-border)" : "1px solid transparent",
                  color: mcpActive ? "var(--accent)" : "var(--text-muted)",
                  fontSize: "var(--fs-12)", cursor: "pointer",
                  transition: "all 0.15s ease",
                  whiteSpace: "nowrap",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.gap = "4px";
                  const s = e.currentTarget.querySelector("span");
                  if (s) s.style.display = "inline";
                  if (!mcpActive) e.currentTarget.style.color = "var(--text-secondary)";
                }}
                onMouseLeave={(e) => {
                  const s = e.currentTarget.querySelector("span");
                  if (s) s.style.display = "none";
                  if (!mcpActive) e.currentTarget.style.color = "var(--text-muted)";
                }}
              >
                <Server size={12} style={{ flexShrink: 0 }} />
                <span style={{ lineHeight: 1, display: "none" }}>MCP</span>
              </button>
            </div>

            {/* Right: quick actions + send/stop */}
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <button
                ref={templateBtnRef}
                onClick={() => setTemplatePickerOpen(!templatePickerOpen)}
                className="btn-ghost cp"
                title="Prompt 模板库"
                style={{
                  width: 24, height: 24, padding: 0,
                  color: templatePickerOpen ? "var(--accent)" : undefined,
                }}
              >
                <Hash size={12} />
              </button>
              <TemplatePicker
                open={templatePickerOpen}
                onClose={() => setTemplatePickerOpen(false)}
                onInsert={insertTemplateContent}
                anchorRef={templateBtnRef}
              />
              <ContextRing tokens={contextTokens} />
              <div style={{ width: 1, height: 14, background: "var(--border-light)", margin: "0 2px" }} />
              {streaming ? (
                <button
                  onClick={onStop}
                  className="cp tr-all"
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 10,
                    background: "var(--danger-bg)",
                    color: "var(--danger)",
                    border: "none",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                    flexShrink: 0,
                  }}
                  title="停止生成"
                >
                  <Square size={14} fill="currentColor" />
                </button>
              ) : (
                <button
                  onClick={handleSend}
                  disabled={!text.trim()}
                  className="cp tr-all"
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 10,
                    background: text.trim() ? "var(--accent)" : "var(--bg-hover)",
                    color: text.trim() ? "#fff" : "var(--text-muted)",
                    border: "none",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: text.trim() ? "pointer" : "not-allowed",
                    boxShadow: text.trim() ? "0 2px 10px var(--accent-glow)" : "none",
                    transition: "all 0.15s ease",
                    flexShrink: 0,
                  }}
                  title="发送"
                >
                  <ArrowUp size={16} strokeWidth={2.5} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Hint below */}
        <div style={{
          textAlign: "center",
          fontSize: "var(--fs-10)",
          marginTop: 4,
          lineHeight: 1,
        }}>
          Enter 发送 · Shift+Enter 换行
        </div>
      </div>
    </div>
  );
}