import { useState, useEffect, useRef } from "react";
import { X, Plus, Trash2, Edit3, Check, Hash, ChevronRight } from "lucide-react";
import { useTemplateStore } from "@/stores/templateStore";

interface TemplatePickerProps {
  open: boolean;
  onClose: () => void;
  onInsert: (content: string) => void;
  anchorRef?: React.RefObject<HTMLElement | null>;
}

export function TemplatePicker({ open, onClose, onInsert, anchorRef }: TemplatePickerProps) {
  const { templates, getAllCategories, getByCategory, add, update, remove } = useTemplateStore();
  const [activeCategory, setActiveCategory] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [newCategory, setNewCategory] = useState("通用");

  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editCategory, setEditCategory] = useState("");

  const categories = getAllCategories();

  useEffect(() => {
    if (open && categories.length > 0 && !activeCategory) {
      setActiveCategory(categories[0]);
    }
  }, [open, categories, activeCategory]);

  useEffect(() => {
    if (!open) {
      setEditingId(null);
      setShowNewForm(false);
      setSearchQuery("");
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        if (anchorRef?.current && anchorRef.current.contains(e.target as Node)) return;
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, onClose, anchorRef]);

  if (!open) return null;

  const filteredTemplates = searchQuery.trim()
    ? templates.filter(
        (t) =>
          t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          t.content.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : activeCategory
    ? getByCategory(activeCategory)
    : templates;

  const handleInsert = (content: string) => {
    onInsert(content);
    onClose();
  };

  const startEdit = (id: string) => {
    const t = templates.find((x) => x.id === id);
    if (!t) return;
    setEditingId(id);
    setEditTitle(t.title);
    setEditContent(t.content);
    setEditCategory(t.category);
  };

  const saveEdit = async () => {
    if (!editingId) return;
    if (!editTitle.trim() || !editContent.trim()) return;
    await update(editingId, {
      title: editTitle.trim(),
      content: editContent.trim(),
      category: editCategory.trim() || "通用",
    });
    setEditingId(null);
  };

  const handleDelete = async (id: string) => {
    const t = templates.find((x) => x.id === id);
    if (!t || t.isBuiltin) return;
    await remove(id);
    if (editingId === id) setEditingId(null);
  };

  const handleCreate = async () => {
    if (!newTitle.trim() || !newContent.trim()) return;
    await add({
      id: crypto.randomUUID(),
      title: newTitle.trim(),
      content: newContent.trim(),
      category: newCategory.trim() || "通用",
      isBuiltin: false,
    });
    setNewTitle("");
    setNewContent("");
    setNewCategory("通用");
    setShowNewForm(false);
  };

  const isSearching = searchQuery.trim().length > 0;
  const displayCategories = isSearching ? [] : categories;

  return (
    <div
      ref={panelRef}
      style={{
        position: "absolute",
        bottom: "calc(100% + 8px)",
        right: 0,
        width: 420,
        maxHeight: 480,
        background: "var(--bg-overlay)",
        border: "1px solid var(--border-medium)",
        borderRadius: 14,
        boxShadow: "0 12px 40px rgba(0,0,0,0.35)",
        backdropFilter: "var(--blur-lg)",
        WebkitBackdropFilter: "var(--blur-lg)",
        zIndex: "var(--z-picker)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div style={{ padding: "12px 14px 8px", borderBottom: "1px solid var(--border-light)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Hash size={14} style={{ color: "var(--accent)" }} />
            <span style={{ fontSize: "var(--fs-13)", fontWeight: 600, color: "var(--text-primary)" }}>
              Prompt 模板库
            </span>
            <span style={{ fontSize: "var(--fs-11)", color: "var(--text-muted)" }}>
              ({templates.length})
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <button
              onClick={() => setShowNewForm(!showNewForm)}
              className="cp"
              style={{
                display: "flex", alignItems: "center", gap: 3,
                padding: "4px 10px", borderRadius: 6,
                fontSize: "var(--fs-11)", fontWeight: 500,
                background: showNewForm ? "var(--accent-bg)" : "transparent",
                color: showNewForm ? "var(--accent)" : "var(--text-tertiary)",
                border: showNewForm ? "1px solid var(--accent-border)" : "1px solid var(--border-light)",
                transition: "all 0.15s ease",
              }}
            >
              <Plus size={11} /> 新建
            </button>
            <button onClick={onClose} className="btn-ghost" style={{ width: 24, height: 24, padding: 0 }}>
              <X size={12} />
            </button>
          </div>
        </div>

        {/* Search */}
        <div
          style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "5px 10px", borderRadius: 8,
            background: "var(--bg-input)", border: "1px solid var(--border-light)",
          }}
        >
          <Hash size={11} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索模板..."
            style={{
              flex: 1, background: "transparent", border: "none", outline: "none",
              color: "var(--text-primary)", fontSize: "var(--fs-12)",
              fontFamily: "inherit", minWidth: 0,
            }}
            onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} className="btn-ghost" style={{ width: 16, height: 16, padding: 0 }}>
              <X size={9} />
            </button>
          )}
        </div>
      </div>

      {/* New template form */}
      {showNewForm && (
        <div style={{ padding: 10, borderBottom: "1px solid var(--border-light)", background: "var(--bg-card)" }}>
          <input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="模板标题"
            style={{
              width: "100%", padding: "6px 10px", borderRadius: 6,
              background: "var(--bg-input)", border: "1px solid var(--border-light)",
              color: "var(--text-primary)", fontSize: "var(--fs-12)",
              fontFamily: "inherit", marginBottom: 6, outline: "none",
            }}
          />
          <textarea
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            placeholder="模板内容（插入到对话框的文本）"
            style={{
              width: "100%", padding: "8px 10px", borderRadius: 6,
              background: "var(--bg-input)", border: "1px solid var(--border-light)",
              color: "var(--text-primary)", fontSize: "var(--fs-12)",
              fontFamily: "inherit", minHeight: 60, resize: "vertical",
              marginBottom: 6, outline: "none", lineHeight: 1.5,
            }}
          />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <input
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              placeholder="分类"
              style={{
                width: 100, padding: "4px 8px", borderRadius: 6,
                background: "var(--bg-input)", border: "1px solid var(--border-light)",
                color: "var(--text-primary)", fontSize: "var(--fs-11)",
                fontFamily: "inherit", outline: "none",
              }}
            />
            <div style={{ display: "flex", gap: 6 }}>
              <button
                onClick={() => { setShowNewForm(false); setNewTitle(""); setNewContent(""); }}
                className="cp"
                style={{ padding: "5px 12px", borderRadius: 6, fontSize: "var(--fs-11)", color: "var(--text-tertiary)", background: "transparent", border: "1px solid var(--border-light)" }}
              >
                取消
              </button>
              <button
                onClick={handleCreate}
                disabled={!newTitle.trim() || !newContent.trim()}
                className="cp"
                style={{
                  padding: "5px 14px", borderRadius: 6, fontSize: "var(--fs-11)", fontWeight: 500,
                  background: "var(--accent)", color: "#fff", border: "none",
                  opacity: !newTitle.trim() || !newContent.trim() ? 0.5 : 1,
                  cursor: !newTitle.trim() || !newContent.trim() ? "not-allowed" : "pointer",
                }}
              >
                创建
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Category tabs */}
      {displayCategories.length > 0 && (
        <div
          style={{
            display: "flex", gap: 4, padding: "8px 12px",
            borderBottom: "1px solid var(--border-light)",
            overflowX: "auto", flexShrink: 0,
          }}
        >
          {displayCategories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className="cp"
              style={{
                padding: "3px 10px", borderRadius: 6, fontSize: "var(--fs-11)",
                background: activeCategory === cat ? "var(--accent-bg)" : "transparent",
                color: activeCategory === cat ? "var(--accent)" : "var(--text-tertiary)",
                border: activeCategory === cat ? "1px solid var(--accent-border)" : "1px solid var(--border-light)",
                whiteSpace: "nowrap", transition: "all 0.15s ease", fontWeight: activeCategory === cat ? 600 : 400,
              }}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* Template list */}
      <div style={{ flex: 1, overflowY: "auto", padding: 6 }}>
        {filteredTemplates.length === 0 && (
          <div style={{ padding: "30px 12px", textAlign: "center", color: "var(--text-muted)", fontSize: "var(--fs-12)" }}>
            {searchQuery ? "未找到匹配的模板" : "该分类下暂无模板"}
          </div>
        )}
        {filteredTemplates.map((t) => (
          <div
            key={t.id}
            className="cp"
            style={{
              padding: "8px 10px", borderRadius: 8, marginBottom: 4,
              background: "transparent", transition: "background 0.12s ease",
              display: "flex", flexDirection: "column", gap: 4,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-hover)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
          >
            {editingId === t.id ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder="标题"
                  style={{
                    width: "100%", padding: "5px 8px", borderRadius: 6,
                    background: "var(--bg-input)", border: "1px solid var(--accent-border)",
                    color: "var(--text-primary)", fontSize: "var(--fs-12)",
                    fontFamily: "inherit", outline: "none",
                  }}
                />
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  placeholder="内容"
                  style={{
                    width: "100%", padding: "6px 8px", borderRadius: 6,
                    background: "var(--bg-input)", border: "1px solid var(--accent-border)",
                    color: "var(--text-primary)", fontSize: "var(--fs-12)",
                    fontFamily: "inherit", minHeight: 50, resize: "vertical",
                    outline: "none", lineHeight: 1.5,
                  }}
                />
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <input
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value)}
                    placeholder="分类"
                    style={{
                      width: 80, padding: "3px 6px", borderRadius: 5,
                      background: "var(--bg-input)", border: "1px solid var(--border-light)",
                      color: "var(--text-primary)", fontSize: "var(--fs-11)",
                      fontFamily: "inherit", outline: "none",
                    }}
                  />
                  <div style={{ display: "flex", gap: 4 }}>
                    <button onClick={() => setEditingId(null)} className="cp" style={{ padding: "3px 10px", borderRadius: 5, fontSize: "var(--fs-11)", color: "var(--text-tertiary)", background: "transparent", border: "1px solid var(--border-light)" }}>
                      取消
                    </button>
                    <button onClick={saveEdit} className="cp" style={{ padding: "3px 10px", borderRadius: 5, fontSize: "var(--fs-11)", fontWeight: 500, background: "var(--accent)", color: "#fff", border: "none", display: "flex", alignItems: "center", gap: 2 }}>
                      <Check size={10} /> 保存
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                    <span style={{ fontSize: "var(--fs-12)", fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {t.title}
                    </span>
                    {t.isBuiltin && (
                      <span style={{ fontSize: "var(--fs-9)", padding: "0 4px", borderRadius: 2, background: "var(--bg-hover)", color: "var(--text-muted)", fontWeight: 500 }}>
                        内置
                      </span>
                    )}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 2, flexShrink: 0 }}>
                    <button
                      onClick={() => handleInsert(t.content)}
                      className="cp"
                      title="插入到对话框"
                      style={{
                        width: 22, height: 22, borderRadius: 5,
                        background: "var(--accent-bg)", color: "var(--accent)",
                        border: "none", display: "flex", alignItems: "center", justifyContent: "center",
                      }}
                    >
                      <ChevronRight size={11} />
                    </button>
                    {!t.isBuiltin && (
                      <>
                        <button
                          onClick={() => startEdit(t.id)}
                          className="cp"
                          title="编辑"
                          style={{
                            width: 22, height: 22, borderRadius: 5,
                            background: "transparent", color: "var(--text-muted)",
                            border: "none", display: "flex", alignItems: "center", justifyContent: "center",
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.color = "var(--accent)"; }}
                          onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-muted)"; }}
                        >
                          <Edit3 size={10} />
                        </button>
                        <button
                          onClick={() => handleDelete(t.id)}
                          className="cp"
                          title="删除"
                          style={{
                            width: 22, height: 22, borderRadius: 5,
                            background: "transparent", color: "var(--text-muted)",
                            border: "none", display: "flex", alignItems: "center", justifyContent: "center",
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.color = "var(--danger);" }}
                          onMouseLeave={(e) => { e.currentTarget.style.color = "var(--text-muted)"; }}
                        >
                          <Trash2 size={10} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
                <div
                  style={{
                    fontSize: "var(--fs-11)", color: "var(--text-muted)",
                    overflow: "hidden", textOverflow: "ellipsis",
                    display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
                    lineHeight: 1.4,
                  }}
                >
                  {t.content.length > 100 ? t.content.slice(0, 100) + "..." : t.content}
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      <div style={{ padding: "6px 14px", borderTop: "1px solid var(--border-light)", fontSize: "var(--fs-10)", color: "var(--text-muted)", textAlign: "center" }}>
        点击 <span style={{ color: "var(--accent)" }}>›</span> 插入模板到对话
      </div>
    </div>
  );
}