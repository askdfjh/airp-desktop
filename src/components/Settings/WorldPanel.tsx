import { useState, useEffect } from "react";
import { Globe, Plus, Trash2, Edit3, FileText, X, Check } from "lucide-react";
import { useWorldStore } from "@/stores/worldStore";
import type { WorldBook, WorldBookEntry } from "@/types";

export function WorldPanel() {
  const { 
    books, loaded, loadFromDb, 
    selectedBookId, selectBook, 
    activeBook, setActiveBook, deactivateAllBooks,
    addBook, updateBook, removeBook,
    trashBooks, loadTrashFromDb, restoreBookFromTrash, purgeBookFromTrash,
    addEntry, updateEntry, removeEntry
  } = useWorldStore();
  
  const [showBookForm, setShowBookForm] = useState(false);
  const [editingBook, setEditingBook] = useState<WorldBook | null>(null);
  const [editingEntry, setEditingEntry] = useState<WorldBookEntry | null>(null);
  const [showEntryForm, setShowEntryForm] = useState(false);

  // Book form state
  const [newBookName, setNewBookName] = useState("");
  const [newBookTheme, setNewBookTheme] = useState("");
  const [newBookDesc, setNewBookDesc] = useState("");
  const [newBookTags, setNewBookTags] = useState("");

  // Entry form state
  const [newEntryCategory, setNewEntryCategory] = useState("");
  const [newEntryTitle, setNewEntryTitle] = useState("");
  const [newEntryKeys, setNewEntryKeys] = useState("");
  const [newEntryContent, setNewEntryContent] = useState("");
  const [newEntryPosition, setNewEntryPosition] = useState<"system" | "situation" | "last">("situation");

  useEffect(() => { if (!loaded) loadFromDb(); }, []);
  useEffect(() => { loadTrashFromDb(); }, []);

  const formatTime = (ts: number): string => {
    const d = new Date(ts);
    const now = new Date();
    const diff = now.getTime() - ts;
    if (diff < 60000) return "刚刚";
    if (diff < 3600000) return Math.floor(diff / 60000) + " 分钟前";
    if (diff < 86400000) return Math.floor(diff / 3600000) + " 小时前";
    if (diff < 604800000) return Math.floor(diff / 86400000) + " 天前";
    return d.getMonth() + 1 + "月" + d.getDate() + "日";
  };

  const resetBookForm = () => {
    setNewBookName(""); setNewBookTheme(""); setNewBookDesc(""); setNewBookTags("");
  };

  const resetEntryForm = () => {
    setNewEntryCategory(""); setNewEntryTitle(""); setNewEntryKeys(""); setNewEntryContent(""); setNewEntryPosition("situation");
  };

  const handleCreateBook = async () => {
    if (!newBookName.trim()) return;
    await addBook({
      name: newBookName.trim(),
      theme: newBookTheme.trim(),
      description: newBookDesc.trim(),
      tags: newBookTags.split(",").map(t => t.trim()).filter(Boolean),
      isActive: false,
      isBuiltin: false,
      violationWords: [],
      entries: [],
    } as Omit<WorldBook, "id" | "entries" | "createdAt" | "updatedAt">);
    resetBookForm();
    setShowBookForm(false);
  };

  const handleUpdateBook = async () => {
    if (!editingBook) return;
    await updateBook(editingBook.id, {
      name: editingBook.name,
      theme: editingBook.theme,
      description: editingBook.description,
      tags: editingBook.tags,
    });
    setEditingBook(null);
  };

  const handleCreateEntry = async () => {
    if (!selectedBookId || !newEntryTitle.trim()) return;
    const keys = newEntryKeys.split(",").map(k => k.trim()).filter(Boolean);
    await addEntry(selectedBookId, {
      category: newEntryCategory.trim() || "其他",
      title: newEntryTitle.trim(),
      key: keys.length > 0 ? keys : [newEntryTitle.trim()],
      content: newEntryContent.trim(),
      constant: false,
      selective: false,
      order: 100,
      position: newEntryPosition,
      insertionDepth: 50,
      disable: false,
    } as Omit<WorldBookEntry, "uid" | "createdAt" | "updatedAt">);
    resetEntryForm();
    setShowEntryForm(false);
  };

  const handleUpdateEntry = async () => {
    if (!editingEntry || !selectedBookId) return;
    await updateEntry(selectedBookId, editingEntry.id, {
      category: editingEntry.category,
      title: editingEntry.title,
      key: editingEntry.key,
      content: editingEntry.content,
      position: editingEntry.position,
    });
    setEditingEntry(null);
  };

  const selectedBook = books.find(b => b.id === selectedBookId);

  return (
    <div style={{ display: "flex", gap: 20, flex: 1, minHeight: 0 }}>
      {/* Left: World list */}
      <div style={{ width: 280, display: "flex", flexDirection: "column", gap: 12, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Globe size={16} style={{ color: "var(--seed-accent)" }} />
            <span style={{ fontSize: "var(--fs-13)", fontWeight: 600, color: "var(--seed-fg)" }}>世界</span>
            <span style={{ fontSize: "var(--fs-11)", color: "var(--seed-muted)" }}>({books.length})</span>
          </div>
          <button onClick={() => { setShowBookForm(!showBookForm); setEditingBook(null); }}
            style={{ display: "flex", alignItems: "center", gap: 4, padding: "5px 10px", borderRadius: 8, fontSize: "var(--fs-11)", fontWeight: 500, background: showBookForm && !editingBook ? "var(--seed-accent-bg)" : "transparent", color: "var(--seed-muted)", border: "1px solid var(--seed-border)", cursor: "pointer" }}>
            <Plus size={11} /> 新建世界
          </button>
        </div>

        {(showBookForm && !editingBook) && (
          <div style={{ padding: 12, borderRadius: 10, background: "var(--seed-surface)", border: "1px solid var(--seed-border)", display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ fontSize: "var(--fs-12)", fontWeight: 600, color: "var(--seed-fg)", marginBottom: 4 }}>创建新世界</div>
            <input value={newBookName} onChange={(e) => setNewBookName(e.target.value)} placeholder="世界名称 *"
              style={{ padding: "7px 10px", borderRadius: 8, background: "var(--seed-input-bg)", border: "1px solid var(--seed-border)", color: "var(--seed-fg)", fontSize: "var(--fs-12)", fontFamily: "inherit", outline: "none" }} />
            <input value={newBookTheme} onChange={(e) => setNewBookTheme(e.target.value)} placeholder="主题 (如: 修仙、都市)"
              style={{ padding: "6px 10px", borderRadius: 8, background: "var(--seed-input-bg)", border: "1px solid var(--seed-border)", color: "var(--seed-fg)", fontSize: "var(--fs-11)", fontFamily: "inherit", outline: "none" }} />
            <textarea value={newBookDesc} onChange={(e) => setNewBookDesc(e.target.value)} placeholder="简短描述"
              style={{ padding: "6px 10px", borderRadius: 8, background: "var(--seed-input-bg)", border: "1px solid var(--seed-border)", color: "var(--seed-fg)", fontSize: "var(--fs-11)", fontFamily: "inherit", minHeight: 50, resize: "vertical", outline: "none" }} />
            <input value={newBookTags} onChange={(e) => setNewBookTags(e.target.value)} placeholder="标签 (逗号分隔)"
              style={{ padding: "6px 10px", borderRadius: 8, background: "var(--seed-input-bg)", border: "1px solid var(--seed-border)", color: "var(--seed-fg)", fontSize: "var(--fs-11)", fontFamily: "inherit", outline: "none" }} />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 6, marginTop: 4 }}>
              <button onClick={() => { setShowBookForm(false); resetBookForm(); }}
                style={{ padding: "5px 12px", borderRadius: 6, fontSize: "var(--fs-11)", color: "var(--seed-muted)", background: "transparent", border: "1px solid var(--seed-border)", cursor: "pointer" }}>取消</button>
              <button onClick={handleCreateBook} disabled={!newBookName.trim()}
                style={{ padding: "5px 14px", borderRadius: 6, fontSize: "var(--fs-11)", fontWeight: 500, background: "var(--seed-accent)", color: "#fff", border: "none", opacity: !newBookName.trim() ? 0.5 : 1, cursor: !newBookName.trim() ? "not-allowed" : "pointer" }}>创建</button>
            </div>
          </div>
        )}

        {/* Book list */}
        <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 12 }}>
          {books.length === 0 && !showBookForm && (
            <div style={{ padding: "30px 12px", textAlign: "center", color: "var(--seed-muted)", fontSize: "var(--fs-12)" }}>
              暂无世界，点击新建
            </div>
          )}
          {books.map((book) => (
            <div key={book.id}
              onClick={() => selectBook(book.id)}
              style={{ position: "relative", padding: 12, borderRadius: 16, cursor: "pointer", background: selectedBookId === book.id ? "var(--seed-accent-bg)" : "var(--seed-surface)", border: "1px solid " + (selectedBookId === book.id ? "var(--seed-accent-border)" : "var(--seed-border)"), boxShadow: selectedBookId === book.id ? "inset 3px 0 0 0 var(--seed-accent)" : "none", transition: "all 0.12s ease", display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: "var(--seed-surface)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Globe size={13} style={{ color: "var(--seed-accent)" }} />
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
                    <span style={{ fontSize: "var(--fs-12)", fontWeight: 600, color: "var(--seed-fg)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{book.name}</span>
                    <span style={{ fontSize: "var(--fs-10)", color: "var(--seed-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {book.theme || "未分类"} · {book.entries.length} 条目
                    </span>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 2, flexShrink: 0 }}>
                  {book.isBuiltin ? (
                    <span className="seed-tag-pill" style={{ fontSize: "var(--fs-9)", padding: "1px 7px" }}>内置</span>
                  ) : (
                    <>
                      <button onClick={(e) => { e.stopPropagation(); setEditingBook(book); setShowBookForm(false); }} title="编辑"
                        style={{ width: 20, height: 20, borderRadius: 4, background: "transparent", color: "var(--seed-muted)", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                        <Edit3 size={9} />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); removeBook(book.id); }} title="删除"
                        style={{ width: 20, height: 20, borderRadius: 4, background: "transparent", color: "var(--seed-muted)", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                        <Trash2 size={9} />
                      </button>
                    </>
                  )}
                </div>
              </div>
              {book.tags && book.tags.length > 0 && (
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginTop: 2 }}>
                  {book.tags.slice(0, 3).map((tag, i) => (
                    <span key={i} className="seed-tag-pill" style={{ fontSize: "var(--fs-9)", padding: "1px 7px" }}>{tag}</span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Right: Detail & Entries */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16, minWidth: 0, minHeight: 0, overflowY: "auto" }}>
        {!selectedBook ? (
          <div className="seed-empty-state" style={{ flex: 1, background: "var(--seed-surface)", borderRadius: 18, border: "1px solid var(--seed-border)" }}>
            <div className="seed-empty-icon">
              <Globe size={28} style={{ color: "var(--seed-accent)" }} />
            </div>
            <div className="seed-empty-title">还没有世界</div>
            <div className="seed-empty-sub">创建一个专属的故事宇宙，让 AI 沉浸其中</div>
            <button className="seed-btn-primary" onClick={() => { setShowBookForm(true); setEditingBook(null); }}>
              <Plus size={13} /> 创建世界
            </button>
          </div>
        ) : (
          <>
            {/* Book Info Section */}
            <div style={{ padding: 18, borderRadius: 18, background: "var(--seed-surface)", border: "1px solid var(--seed-border)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: "var(--seed-accent-bg)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Globe size={20} style={{ color: "var(--seed-accent)" }} />
                  </div>
                  <div>
                    <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: "var(--fs-15)", fontWeight: 600, color: "var(--seed-fg)" }}>{selectedBook.name}</span>
                      {selectedBook.isBuiltin && (
                        <span className="seed-tag-pill" style={{ fontSize: "var(--fs-9)", padding: "1px 7px" }}>内置</span>
                      )}
                    </span>
                    {selectedBook.description && (
                      <div style={{ fontSize: "var(--fs-11)", color: "var(--seed-muted)", marginTop: 2 }}>{selectedBook.description}</div>
                    )}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  {selectedBook.isActive ? (
                    <button onClick={() => deactivateAllBooks()}
                      style={{ padding: "5px 12px", borderRadius: 6, fontSize: "var(--fs-11)", fontWeight: 500, background: "var(--success-bg)", color: "var(--success)", border: "1px solid var(--success-border)", cursor: "pointer" }}>
                      激活中
                    </button>
                  ) : (
                    <button onClick={() => setActiveBook(selectedBook.id)}
                      style={{ padding: "5px 12px", borderRadius: 6, fontSize: "var(--fs-11)", fontWeight: 500, background: "var(--seed-accent)", color: "#fff", border: "none", cursor: "pointer" }}>
                      启用此世界
                    </button>
                  )}
                </div>
              </div>
              
              {editingBook && (
                <div style={{ padding: 12, borderRadius: 8, background: "var(--seed-hover-bg)", border: "1px solid var(--seed-border)", display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ fontSize: "var(--fs-12)", fontWeight: 600, marginBottom: 4 }}>编辑世界信息</div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input value={editingBook.name} onChange={(e) => setEditingBook({...editingBook, name: e.target.value})} placeholder="名称"
                      style={{ flex: 1, padding: "6px 10px", borderRadius: 6, background: "var(--seed-input-bg)", border: "1px solid var(--seed-border)", color: "var(--seed-fg)", fontSize: "var(--fs-11)", fontFamily: "inherit", outline: "none" }} />
                    <input value={editingBook.theme} onChange={(e) => setEditingBook({...editingBook, theme: e.target.value})} placeholder="主题"
                      style={{ width: 120, padding: "6px 10px", borderRadius: 6, background: "var(--seed-input-bg)", border: "1px solid var(--seed-border)", color: "var(--seed-fg)", fontSize: "var(--fs-11)", fontFamily: "inherit", outline: "none" }} />
                  </div>
                  <textarea value={editingBook.description} onChange={(e) => setEditingBook({...editingBook, description: e.target.value})} placeholder="描述"
                    style={{ padding: "6px 10px", borderRadius: 6, background: "var(--seed-input-bg)", border: "1px solid var(--seed-border)", color: "var(--seed-fg)", fontSize: "var(--fs-11)", fontFamily: "inherit", minHeight: 40, resize: "vertical", outline: "none" }} />
                  <div style={{ display: "flex", justifyContent: "flex-end", gap: 6 }}>
                    <button onClick={() => setEditingBook(null)}
                      style={{ padding: "4px 10px", borderRadius: 4, fontSize: "var(--fs-11)", color: "var(--seed-muted)", background: "transparent", border: "1px solid var(--seed-border)", cursor: "pointer" }}>取消</button>
                    <button onClick={handleUpdateBook}
                      style={{ padding: "4px 12px", borderRadius: 4, fontSize: "var(--fs-11)", fontWeight: 500, background: "var(--seed-accent)", color: "#fff", border: "none", cursor: "pointer" }}>保存</button>
                  </div>
                </div>
              )}
            </div>

            {/* Entries Section */}
            <div style={{ padding: 18, borderRadius: 18, background: "var(--seed-surface)", border: "1px solid var(--seed-border)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <FileText size={16} style={{ color: "var(--seed-accent)" }} />
                  <span style={{ fontSize: "var(--fs-13)", fontWeight: 600, color: "var(--seed-fg)" }}>世界条目</span>
                  <span style={{ fontSize: "var(--fs-11)", color: "var(--seed-muted)" }}>({selectedBook.entries.length})</span>
                </div>
                <button onClick={() => { setShowEntryForm(!showEntryForm); setEditingEntry(null); resetEntryForm(); }}
                  style={{ display: "flex", alignItems: "center", gap: 4, padding: "5px 10px", borderRadius: 8, fontSize: "var(--fs-11)", fontWeight: 500, background: showEntryForm && !editingEntry ? "var(--seed-accent-bg)" : "transparent", color: "var(--seed-muted)", border: "1px solid var(--seed-border)", cursor: "pointer" }}>
                  <Plus size={11} /> 新建条目
                </button>
              </div>

              {(showEntryForm && !editingEntry) && (
                <div style={{ padding: 12, borderRadius: 10, background: "var(--seed-hover-bg)", border: "1px solid var(--seed-border)", display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
                  <div style={{ fontSize: "var(--fs-12)", fontWeight: 600, color: "var(--seed-fg)", marginBottom: 4 }}>添加世界规则条目</div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input value={newEntryTitle} onChange={(e) => setNewEntryTitle(e.target.value)} placeholder="条目标题 *"
                      style={{ flex: 1, padding: "6px 10px", borderRadius: 6, background: "var(--seed-input-bg)", border: "1px solid var(--seed-border)", color: "var(--seed-fg)", fontSize: "var(--fs-11)", fontFamily: "inherit", outline: "none" }} />
                    <input value={newEntryCategory} onChange={(e) => setNewEntryCategory(e.target.value)} placeholder="分类"
                      style={{ width: 100, padding: "6px 10px", borderRadius: 6, background: "var(--seed-input-bg)", border: "1px solid var(--seed-border)", color: "var(--seed-fg)", fontSize: "var(--fs-11)", fontFamily: "inherit", outline: "none" }} />
                  </div>
                  <input value={newEntryKeys} onChange={(e) => setNewEntryKeys(e.target.value)} placeholder="触发关键词 (逗号分隔, 如: 筑基, 金丹)"
                    style={{ padding: "6px 10px", borderRadius: 6, background: "var(--seed-input-bg)", border: "1px solid var(--seed-border)", color: "var(--seed-fg)", fontSize: "var(--fs-11)", fontFamily: "inherit", outline: "none" }} />
                  <textarea value={newEntryContent} onChange={(e) => setNewEntryContent(e.target.value)} placeholder="当对话中出现关键词时，注入的详细内容..."
                    style={{ padding: "7px 10px", borderRadius: 6, background: "var(--seed-input-bg)", border: "1px solid var(--seed-border)", color: "var(--seed-fg)", fontSize: "var(--fs-11)", fontFamily: "inherit", minHeight: 80, resize: "vertical", outline: "none" }} />
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <select value={newEntryPosition} onChange={(e) => setNewEntryPosition(e.target.value as any)}
                      style={{ padding: "5px 8px", borderRadius: 6, background: "var(--seed-input-bg)", border: "1px solid var(--seed-border)", color: "var(--seed-fg)", fontSize: "var(--fs-11)", outline: "none" }}>
                      <option value="system">系统提示 (System)</option>
                      <option value="situation">情境提示 (Situation)</option>
                      <option value="last">最新提示 (Last)</option>
                    </select>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => { setShowEntryForm(false); resetEntryForm(); }}
                        style={{ padding: "4px 10px", borderRadius: 4, fontSize: "var(--fs-11)", color: "var(--seed-muted)", background: "transparent", border: "1px solid var(--seed-border)", cursor: "pointer" }}>取消</button>
                      <button onClick={handleCreateEntry} disabled={!newEntryTitle.trim()}
                        style={{ padding: "4px 12px", borderRadius: 4, fontSize: "var(--fs-11)", fontWeight: 500, background: "var(--seed-accent)", color: "#fff", border: "none", opacity: !newEntryTitle.trim() ? 0.5 : 1, cursor: !newEntryTitle.trim() ? "not-allowed" : "pointer" }}>保存条目</button>
                    </div>
                  </div>
                </div>
              )}

              {/* Entry List */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {selectedBook.entries.length === 0 && !showEntryForm && (
                  <div style={{ padding: "24px", textAlign: "center", color: "var(--seed-muted)", fontSize: "var(--fs-12)", background: "var(--seed-hover-bg)", borderRadius: 8 }}>
                    暂无条目。点击"新建条目"添加世界规则
                  </div>
                )}
                {selectedBook.entries.map((entry) => (
                  <div key={entry.id} style={{ padding: 12, borderRadius: 10, background: "var(--seed-hover-bg)", border: "1px solid var(--seed-border)", display: "flex", flexDirection: "column", gap: 6 }}>
                    {editingEntry?.id === entry.id ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        <input value={editingEntry.title} onChange={(e) => setEditingEntry({...editingEntry, title: e.target.value})} placeholder="标题"
                          style={{ padding: "6px 10px", borderRadius: 6, background: "var(--seed-input-bg)", border: "1px solid var(--seed-border)", color: "var(--seed-fg)", fontSize: "var(--fs-11)", fontFamily: "inherit", outline: "none" }} />
                        <div style={{ display: "flex", gap: 8 }}>
                          <input value={editingEntry.key.join(", ")} onChange={(e) => setEditingEntry({...editingEntry, key: e.target.value.split(",").map(k => k.trim()).filter(Boolean)})} placeholder="关键词"
                            style={{ flex: 1, padding: "6px 10px", borderRadius: 6, background: "var(--seed-input-bg)", border: "1px solid var(--seed-border)", color: "var(--seed-fg)", fontSize: "var(--fs-11)", fontFamily: "inherit", outline: "none" }} />
                          <select value={editingEntry.position} onChange={(e) => setEditingEntry({...editingEntry, position: e.target.value as any})}
                            style={{ padding: "5px 8px", borderRadius: 6, background: "var(--seed-input-bg)", border: "1px solid var(--seed-border)", color: "var(--seed-fg)", fontSize: "var(--fs-11)", outline: "none" }}>
                            <option value="system">System</option>
                            <option value="situation">Situation</option>
                            <option value="last">Last</option>
                          </select>
                        </div>
                        <textarea value={editingEntry.content} onChange={(e) => setEditingEntry({...editingEntry, content: e.target.value})} placeholder="内容"
                          style={{ padding: "7px 10px", borderRadius: 6, background: "var(--seed-input-bg)", border: "1px solid var(--seed-border)", color: "var(--seed-fg)", fontSize: "var(--fs-11)", fontFamily: "inherit", minHeight: 60, resize: "vertical", outline: "none" }} />
                        <div style={{ display: "flex", justifyContent: "flex-end", gap: 6 }}>
                          <button onClick={() => setEditingEntry(null)}
                            style={{ padding: "4px 10px", borderRadius: 4, fontSize: "var(--fs-11)", color: "var(--seed-muted)", background: "transparent", border: "1px solid var(--seed-border)", cursor: "pointer" }}>取消</button>
                          <button onClick={handleUpdateEntry}
                            style={{ padding: "4px 12px", borderRadius: 4, fontSize: "var(--fs-11)", fontWeight: 500, background: "var(--seed-accent)", color: "#fff", border: "none", cursor: "pointer" }}>保存</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontSize: "var(--fs-12)", fontWeight: 600, color: "var(--seed-fg)" }}>{entry.title}</span>
                            <span style={{ fontSize: "var(--fs-9)", padding: "1px 5px", borderRadius: 3, background: "var(--seed-surface)", color: "var(--seed-muted)" }}>{entry.category}</span>
                            <span style={{ fontSize: "var(--fs-8)", padding: "0 4px", borderRadius: 2, background: "var(--seed-accent-bg)", color: "var(--seed-accent)" }}>{entry.position}</span>
                          </div>
                          <div style={{ display: "flex", gap: 4 }}>
                            <button onClick={() => setEditingEntry(entry)} title="编辑"
                              style={{ width: 22, height: 22, borderRadius: 4, background: "transparent", color: "var(--seed-muted)", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                              <Edit3 size={10} />
                            </button>
                            <button onClick={() => removeEntry(selectedBook.id, entry.id)} title="删除"
                              style={{ width: 22, height: 22, borderRadius: 4, background: "transparent", color: "var(--seed-muted)", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                              <Trash2 size={10} />
                            </button>
                          </div>
                        </div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                          {entry.key.map((k, i) => (
                            <span key={i} style={{ fontSize: "var(--fs-10)", padding: "1px 6px", borderRadius: 4, background: "var(--seed-accent-bg)", color: "var(--seed-accent)", fontWeight: 500 }}>
                              #{k}
                            </span>
                          ))}
                        </div>
                        <div style={{ fontSize: "var(--fs-11)", color: "var(--seed-muted)", lineHeight: 1.4, whiteSpace: "pre-wrap", maxHeight: 100, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical" }}>
                          {entry.content}
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* 世界回收站：删除的世界书保留 30 天，可恢复 */}
      <div style={{ marginTop: 20, padding: 18, borderRadius: 18, background: "var(--seed-surface)", border: "1px solid var(--seed-border)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <Trash2 size={14} style={{ color: "var(--seed-accent)" }} />
          <span style={{ fontSize: "var(--fs-13)", fontWeight: 600, color: "var(--seed-fg)" }}>世界回收站</span>
          <span style={{ fontSize: "var(--fs-11)", color: "var(--seed-muted)" }}>({trashBooks.length})</span>
          <span style={{ fontSize: "var(--fs-10)", color: "var(--seed-muted)", marginLeft: 4 }}>删除的世界书保留 30 天，到期自动清理</span>
        </div>

        {trashBooks.length === 0 ? (
          <div style={{ padding: "24px 12px", textAlign: "center", color: "var(--seed-muted)", fontSize: "var(--fs-12)" }}>
            回收站为空。删除世界书后将在这里保留 30 天。
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {trashBooks.map((t) => {
              let name = "已删除世界";
              try {
                const parsed = JSON.parse(t.data);
                name = parsed.book?.name || name;
              } catch { /* ignore */ }
              const daysLeft = Math.max(0, Math.ceil((t.expiredAt - Date.now()) / 86400000));
              return (
                <div key={t.id} style={{ padding: 12, borderRadius: 10, background: "var(--seed-hover-bg)", border: "1px solid var(--seed-border)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                    <Globe size={12} style={{ color: "var(--seed-muted)", flexShrink: 0 }} />
                    <span style={{ fontSize: "var(--fs-12)", fontWeight: 600, color: "var(--seed-fg)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
                    <span style={{ fontSize: "var(--fs-10)", color: "var(--seed-muted)", flexShrink: 0 }}>
                      {formatTime(t.deletedAt)} · 剩余 {daysLeft} 天
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                    <button
                      onClick={() => restoreBookFromTrash(t.id)}
                      style={{ padding: "5px 10px", borderRadius: 8, fontSize: "var(--fs-11)", color: "var(--seed-accent)", background: "var(--seed-accent-bg)", border: "1px solid color-mix(in srgb, var(--seed-accent) 40%, transparent)", cursor: "pointer" }}
                    >
                      恢复
                    </button>
                    <button
                      onClick={() => { if (confirm(`彻底删除「${name}」？此操作不可恢复。`)) purgeBookFromTrash(t.id); }}
                      style={{ padding: "5px 10px", borderRadius: 8, fontSize: "var(--fs-11)", color: "var(--danger)", background: "transparent", border: "1px solid var(--seed-border)", cursor: "pointer" }}
                    >
                      彻底删除
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}