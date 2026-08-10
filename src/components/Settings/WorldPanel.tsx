import { useState, useEffect } from "react";
import { Globe, Trash2, Edit3, FileText, Copy, Search, Wand2 } from "lucide-react";
import { useWorldStore } from "@/stores/worldStore";
import { useUIStore } from "@/stores/uiStore";
import { useCreateStore } from "@/stores/createStore";
import { AutoTextarea, AutoInput } from "@/lib/autoGrow";
import type { WorldBook, WorldBookEntry } from "@/types";

export function WorldPanel() {
  const {
    books, loaded, loadFromDb,
    selectedBookId, selectBook,
    activeBook, setActiveBook, deactivateAllBooks,
    updateBook, removeBook, duplicateBook,
    trashBooks, loadTrashFromDb, restoreBookFromTrash, purgeBookFromTrash,
    updateEntry, removeEntry
  } = useWorldStore();

  const [viewTab, setViewTab] = useState<"world" | "trash">("world");
  const isAndroid = typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent);
  // 窄屏（手机）：左右分栏改为上下堆叠
  const [isNarrow, setIsNarrow] = useState(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 820px)').matches);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 820px)');
    const handler = (e: MediaQueryListEvent) => setIsNarrow(e.matches);
    mq.addEventListener('change', handler);
    setIsNarrow(mq.matches);
    return () => mq.removeEventListener('change', handler);
  }, []);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingBook, setEditingBook] = useState<WorldBook | null>(null);
  const [editingEntry, setEditingEntry] = useState<WorldBookEntry | null>(null);

  const setCreateMode = useUIStore((s) => s.setCreateMode);
  const openCreateMode = () => {
    useCreateStore.getState().open("world");
    setCreateMode("world");
  };

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

  const q = searchQuery.trim().toLowerCase();
  const filtered = q
    ? books.filter(b =>
        b.name.toLowerCase().includes(q) ||
        (b.theme || "").toLowerCase().includes(q) ||
        (b.description || "").toLowerCase().includes(q)
      )
    : books;
  const builtinBooks = filtered.filter(b => b.isBuiltin);
  const myBooks = filtered.filter(b => !b.isBuiltin);

  const tabStyle = (active: boolean): React.CSSProperties => ({
    display: "flex", alignItems: "center", gap: 6, flex: 1, justifyContent: "center",
    padding: "8px 0", borderRadius: 8, fontSize: "var(--fs-12)", fontWeight: 500, fontFamily: "inherit",
    cursor: "pointer", border: "none",
    background: active ? "var(--seed-accent)" : "transparent",
    color: active ? "#fff" : "var(--seed-muted)",
    transition: "all 0.15s",
  });

  // 统一按钮体系：主操作（紫色胶囊）/ 次操作（透明胶囊）/ 强调（紫色细边）/ 危险（红色细边）
  const btnPrimary: React.CSSProperties = {
    display: "inline-flex", alignItems: "center", gap: 5, padding: "7px 16px", borderRadius: 999,
    border: "none", background: "var(--seed-accent)", color: "#fff", fontSize: "var(--fs-11)",
    fontWeight: 500, fontFamily: "inherit", cursor: "pointer", transition: "filter 0.15s",
    flexShrink: 0,
  };
  const btnSecondary: React.CSSProperties = {
    display: "inline-flex", alignItems: "center", gap: 5, padding: "7px 16px", borderRadius: 999,
    border: "1px solid var(--seed-border)", background: "transparent", color: "var(--seed-muted)",
    fontSize: "var(--fs-11)", fontFamily: "inherit", cursor: "pointer", transition: "all 0.15s",
    flexShrink: 0,
  };
  const btnAccent: React.CSSProperties = {
    display: "inline-flex", alignItems: "center", gap: 5, padding: "6px 14px", borderRadius: 999,
    border: "1px solid color-mix(in srgb, var(--seed-accent) 40%, transparent)",
    background: "var(--seed-accent-bg)", color: "var(--seed-accent)", fontSize: "var(--fs-11)",
    fontWeight: 500, fontFamily: "inherit", cursor: "pointer", transition: "all 0.15s",
    flexShrink: 0,
  };
  const btnDanger: React.CSSProperties = {
    display: "inline-flex", alignItems: "center", gap: 5, padding: "6px 14px", borderRadius: 999,
    border: "1px solid color-mix(in srgb, var(--danger) 35%, transparent)",
    background: "transparent", color: "var(--danger)", fontSize: "var(--fs-11)",
    fontFamily: "inherit", cursor: "pointer", transition: "all 0.15s",
    flexShrink: 0,
  };
  const iconBtn: React.CSSProperties = {
    width: 26, height: 26, borderRadius: 7, display: "flex", alignItems: "center",
    justifyContent: "center", border: "none", background: "transparent",
    color: "var(--seed-muted)", cursor: "pointer", flexShrink: 0,
  };

  const inputStyle: React.CSSProperties = {
    padding: "8px 12px", borderRadius: 10, background: "var(--seed-input-bg)",
    border: "1px solid var(--seed-border)", color: "var(--seed-fg)",
    fontSize: "var(--fs-12)", fontFamily: "inherit", outline: "none", boxSizing: "border-box", width: "100%",
  };

  return (
    <div style={{ display: "flex", gap: 20, flex: 1, minHeight: 0, flexDirection: isNarrow ? "column" : "row" }}>
      {/* Left column */}
      <div style={{ width: isNarrow ? "100%" : 290, display: "flex", flexDirection: "column", gap: 12, flexShrink: 0, minHeight: 0, maxHeight: isNarrow ? 400 : "none", overflow: "hidden" }}>
        {/* View tabs */}
        <div style={{ display: "flex", gap: 4, padding: 4, background: "var(--seed-input-bg)", borderRadius: 12, border: "1px solid var(--seed-border)" }}>
          <button style={tabStyle(viewTab === "world")} onClick={() => setViewTab("world")}>
            <Globe size={13} /> 规则书
            <span style={{ opacity: 0.7, fontSize: 11 }}>{books.length}</span>
          </button>
          <button style={tabStyle(viewTab === "trash")} onClick={() => setViewTab("trash")}>
            <Trash2 size={13} /> 回收站
            <span style={{ opacity: 0.7, fontSize: 11 }}>{trashBooks.length}</span>
          </button>
        </div>

        {viewTab === "world" ? (
          <>
            {/* Search + create */}
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 6, padding: "7px 10px", borderRadius: 10, background: "var(--seed-input-bg)", border: "1px solid var(--seed-border)" }}>
                <Search size={12} style={{ color: "var(--seed-muted)", flexShrink: 0 }} />
                <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="搜索规则书..."
                  style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "var(--seed-fg)", fontSize: "var(--fs-12)", fontFamily: "inherit", minWidth: 0 }}
                />
              </div>
              <button
                onClick={openCreateMode}
                title="与 AI 对话式创建规则书，完成后自动写入规则书条目"
                style={{ ...btnPrimary, padding: "8px 14px" }}
              >
                <Wand2 size={12} /> AI 创建
              </button>
            </div>

            {/* Grouped list：安卓下固定高度恰好 2 张卡片，超出滚动 */}
            <div style={{ flex: isAndroid ? "0 0 auto" : 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 10, height: isAndroid ? 260 : undefined }}>
              {builtinBooks.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ fontSize: "var(--fs-11)", fontWeight: 600, color: "var(--seed-muted)", textTransform: "uppercase", letterSpacing: "0.06em", padding: "2px 2px 0" }}>
                    内置规则书 · {builtinBooks.length}
                  </div>
                  <div style={{ fontSize: "var(--fs-9)", color: "var(--seed-muted)", opacity: 0.7, padding: "0 2px", lineHeight: 1.5 }}>
                    内置预设内容仅供演示与功能参考
                  </div>
                  {builtinBooks.map((book) => {
                    const isActive = activeBook?.id === book.id;
                    const isSelected = selectedBookId === book.id;
                    return (
                      <div key={book.id}
                        onClick={() => selectBook(book.id)}
                        style={{ position: "relative", padding: 12, borderRadius: 16, cursor: "pointer", background: isSelected ? "var(--seed-accent-bg)" : "var(--seed-surface)", border: "1px solid " + (isSelected ? "var(--seed-accent-border)" : "var(--seed-border)"), boxShadow: isSelected ? "inset 3px 0 0 0 var(--seed-accent)" : "none", transition: "all 0.12s ease", display: "flex", flexDirection: "column", gap: 6 }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                            <div style={{ width: 28, height: 28, borderRadius: 8, background: "var(--seed-surface)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                              <Globe size={13} style={{ color: "var(--seed-accent)" }} />
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
                              <span style={{ fontSize: "var(--fs-12)", fontWeight: 600, color: "var(--seed-fg)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 6 }}>
                                {book.name}
                                {isActive && <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--success)", flexShrink: 0 }} />}
                              </span>
                              <span style={{ fontSize: "var(--fs-10)", color: "var(--seed-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {book.theme || "未分类"} · {book.entries.length} 条目
                              </span>
                            </div>
                          </div>
                          <button
                            onClick={(e) => { e.stopPropagation(); duplicateBook(book.id); }}
                            title="复制副本（可编辑）"
                            style={iconBtn}
                          >
                            <Copy size={11} />
                          </button>
                        </div>
                        {book.tags && book.tags.length > 0 && (
                          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                            {book.tags.slice(0, 3).map((tag, i) => (
                              <span key={i} className="seed-tag-pill" style={{ fontSize: "var(--fs-9)", padding: "1px 7px" }}>{tag}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {myBooks.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ fontSize: "var(--fs-11)", fontWeight: 600, color: "var(--seed-muted)", textTransform: "uppercase", letterSpacing: "0.06em", padding: "2px 2px 0" }}>
                    我的规则书 · {myBooks.length}
                  </div>
                  {myBooks.map((book) => {
                    const isActive = activeBook?.id === book.id;
                    const isSelected = selectedBookId === book.id;
                    return (
                      <div key={book.id}
                        onClick={() => selectBook(book.id)}
                        style={{ position: "relative", padding: 12, borderRadius: 16, cursor: "pointer", background: isSelected ? "var(--seed-accent-bg)" : "var(--seed-surface)", border: "1px solid " + (isSelected ? "var(--seed-accent-border)" : "var(--seed-border)"), boxShadow: isSelected ? "inset 3px 0 0 0 var(--seed-accent)" : "none", transition: "all 0.12s ease", display: "flex", flexDirection: "column", gap: 6 }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                            <div style={{ width: 28, height: 28, borderRadius: 8, background: "var(--seed-surface)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                              <Globe size={13} style={{ color: "var(--seed-accent)" }} />
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
                              <span style={{ fontSize: "var(--fs-12)", fontWeight: 600, color: "var(--seed-fg)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: 6 }}>
                                {book.name}
                                {isActive && <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--success)", flexShrink: 0 }} />}
                              </span>
                              <span style={{ fontSize: "var(--fs-10)", color: "var(--seed-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {book.theme || "未分类"} · {book.entries.length} 条目
                              </span>
                            </div>
                          </div>
                          <div style={{ display: "flex", gap: 2, flexShrink: 0 }}>
                            <button onClick={(e) => { e.stopPropagation(); setEditingBook(book); }} title="编辑" style={iconBtn}>
                              <Edit3 size={11} />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                void removeBook(book.id).then(() => loadTrashFromDb());
                              }}
                              title="删除（进回收站）"
                              style={iconBtn}
                            >
                              <Trash2 size={11} />
                            </button>
                          </div>
                        </div>
                        {book.tags && book.tags.length > 0 && (
                          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                            {book.tags.slice(0, 3).map((tag, i) => (
                              <span key={i} className="seed-tag-pill" style={{ fontSize: "var(--fs-9)", padding: "1px 7px" }}>{tag}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {filtered.length === 0 && (
                <div style={{ padding: "30px 12px", textAlign: "center", color: "var(--seed-muted)", fontSize: "var(--fs-12)" }}>
                  {searchQuery ? "未找到匹配的规则书" : "暂无规则书，点击右上角「AI 创建」，与 AI 对话生成规则书"}
                </div>
              )}
            </div>
            {isAndroid && isNarrow && filtered.length > 2 && (
              <div style={{ flexShrink: 0, textAlign: "center", padding: "4px 0 2px", fontSize: "var(--fs-11)", color: "var(--seed-muted)", opacity: 0.7, letterSpacing: "0.02em" }}>
                上滑查看更多
              </div>
            )}
          </>
        ) : (
          /* Trash list */
          <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
            {trashBooks.length === 0 && (
              <div style={{ padding: "30px 12px", textAlign: "center", color: "var(--seed-muted)", fontSize: "var(--fs-12)" }}>
                回收站为空。删除规则书后将在这里保留 30 天。
              </div>
            )}
            {trashBooks.map((t) => {
              let name = "已删除规则书";
              try {
                const parsed = JSON.parse(t.data);
                name = parsed.book?.name || name;
              } catch { /* ignore */ }
              const daysLeft = Math.max(0, Math.ceil((t.expiredAt - Date.now()) / 86400000));
              return (
                <div key={t.id} style={{ padding: 12, borderRadius: 14, background: "var(--seed-surface)", border: "1px solid var(--seed-border)", display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                    <Globe size={12} style={{ color: "var(--seed-muted)", flexShrink: 0 }} />
                    <span style={{ fontSize: "var(--fs-12)", fontWeight: 600, color: "var(--seed-fg)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{name}</span>
                    <span style={{ fontSize: "var(--fs-10)", color: "var(--seed-muted)", flexShrink: 0 }}>剩余 {daysLeft} 天</span>
                  </div>
                  <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                    <button onClick={() => restoreBookFromTrash(t.id)} style={btnAccent}>恢复</button>
                    <button onClick={() => { if (confirm(`彻底删除「${name}」？此操作不可恢复。`)) purgeBookFromTrash(t.id); }} style={btnDanger}>彻底删除</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Right: Detail & Entries */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16, minWidth: 0, minHeight: isNarrow ? 300 : 0, overflowY: "auto" }}>
        {viewTab === "trash" ? (
          <div className="seed-empty-state" style={{ flex: 1, background: "var(--seed-surface)", borderRadius: 18, border: "1px solid var(--seed-border)" }}>
            <div className="seed-empty-icon">
              <Trash2 size={28} style={{ color: "var(--seed-accent)" }} />
            </div>
            <div className="seed-empty-title">规则书回收站</div>
            <div className="seed-empty-sub">从左侧选择已删除的规则书进行恢复，或彻底删除（30 天后自动清理）</div>
          </div>
        ) : !selectedBook ? (
          <div className="seed-empty-state" style={{ flex: 1, background: "var(--seed-surface)", borderRadius: 18, border: "1px solid var(--seed-border)" }}>
            <div className="seed-empty-icon">
              <Globe size={28} style={{ color: "var(--seed-accent)" }} />
            </div>
            <div className="seed-empty-title">还没有规则书</div>
            <div className="seed-empty-sub">点击上方「AI 创建」，与 AI 对话创建专属的故事宇宙，自动生成规则书条目</div>
          </div>
        ) : (
          <>
            {/* Book Info Section */}
            <div style={{ padding: 18, borderRadius: 18, background: "var(--seed-surface)", border: "1px solid var(--seed-border)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 0 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: "var(--seed-accent-bg)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <Globe size={20} style={{ color: "var(--seed-accent)" }} />
                  </div>
                  <div style={{ minWidth: 0, overflow: "hidden" }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                      <span style={{ fontSize: "var(--fs-15)", fontWeight: 600, color: "var(--seed-fg)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{selectedBook.name}</span>
                      {selectedBook.isBuiltin && (
                        <span className="seed-tag-pill" style={{ fontSize: "var(--fs-9)", padding: "1px 7px", flexShrink: 0 }}>内置</span>
                      )}
                    </span>
                    {selectedBook.description && (
                      <div style={{ fontSize: "var(--fs-11)", color: "var(--seed-muted)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{selectedBook.description}</div>
                    )}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  {selectedBook.isBuiltin ? (
                    <button onClick={() => duplicateBook(selectedBook.id)} style={btnAccent}>
                      <Copy size={12} /> 复制副本
                    </button>
                  ) : selectedBook.isActive ? (
                    <button onClick={() => deactivateAllBooks()} style={{ ...btnAccent, color: "var(--success)", borderColor: "var(--success-border)", background: "var(--success-bg)" }}>
                      激活中
                    </button>
                  ) : (
                    <button onClick={() => setActiveBook(selectedBook.id)} style={btnPrimary}>启用此规则书</button>
                  )}
                </div>
              </div>

              {editingBook && (
                <div style={{ padding: 12, borderRadius: 10, background: "var(--seed-hover-bg)", border: "1px solid var(--seed-border)", display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ fontSize: "var(--fs-12)", fontWeight: 600, marginBottom: 2 }}>编辑规则书信息</div>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <input value={editingBook.name} onChange={(e) => setEditingBook({...editingBook, name: e.target.value})} placeholder="名称"
                      style={{ flex: 1, minWidth: 140, ...inputStyle, fontSize: "var(--fs-11)" }} />
                    <AutoInput value={editingBook.theme} onChange={(e) => setEditingBook({...editingBook, theme: e.target.value})} placeholder="主题" min={90} max={200}
                      style={{ ...inputStyle, fontSize: "var(--fs-11)" }} />
                  </div>
                  <AutoTextarea value={editingBook.description} onChange={(e) => setEditingBook({...editingBook, description: e.target.value})} placeholder="描述"
                    style={{ ...inputStyle, fontSize: "var(--fs-11)", minHeight: 40 }} maxHeight={200} />
                  <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                    <button onClick={() => setEditingBook(null)} style={btnSecondary}>取消</button>
                    <button onClick={handleUpdateBook} style={btnPrimary}>保存</button>
                  </div>
                </div>
              )}
            </div>

            {/* Entries Section */}
            <div style={{ padding: 18, borderRadius: 18, background: "var(--seed-surface)", border: "1px solid var(--seed-border)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <FileText size={16} style={{ color: "var(--seed-accent)" }} />
                  <span style={{ fontSize: "var(--fs-13)", fontWeight: 600, color: "var(--seed-fg)" }}>规则书条目</span>
                  <span style={{ fontSize: "var(--fs-11)", color: "var(--seed-muted)" }}>({selectedBook.entries.length})</span>
                </div>
              </div>

              {/* Entry List */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {selectedBook.entries.length === 0 && (
                  <div style={{ padding: "24px", textAlign: "center", color: "var(--seed-muted)", fontSize: "var(--fs-12)", background: "var(--seed-hover-bg)", borderRadius: 8 }}>
                    暂无条目。可用「AI 创建」对话生成规则书条目，或编辑规则书后自动补充
                  </div>
                )}
                {selectedBook.entries.map((entry) => (
                  <div key={entry.id} style={{ padding: 12, borderRadius: 12, background: "var(--seed-hover-bg)", border: "1px solid var(--seed-border)", display: "flex", flexDirection: "column", gap: 6 }}>
                    {editingEntry?.id === entry.id ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        <input value={editingEntry.title} onChange={(e) => setEditingEntry({...editingEntry, title: e.target.value})} placeholder="标题" style={{ ...inputStyle, fontSize: "var(--fs-11)" }} />
                        <div style={{ display: "flex", gap: 8 }}>
                        <AutoInput value={editingEntry.key.join(", ")} onChange={(e) => setEditingEntry({...editingEntry, key: e.target.value.split(",").map(k => k.trim()).filter(Boolean)})} placeholder="关键词" min={200} max={520} style={{ flex: 1, ...inputStyle, fontSize: "var(--fs-11)" }} />
                        <select value={editingEntry.position} onChange={(e) => setEditingEntry({...editingEntry, position: e.target.value as any})}
                          style={{ padding: "6px 10px", borderRadius: 8, background: "var(--seed-input-bg)", border: "1px solid var(--seed-border)", color: "var(--seed-fg)", fontSize: "var(--fs-11)", outline: "none" }}>
                          <option value="system">System</option>
                          <option value="situation">Situation</option>
                          <option value="last">Last</option>
                        </select>
                        </div>
                        <AutoTextarea value={editingEntry.content} onChange={(e) => setEditingEntry({...editingEntry, content: e.target.value})} placeholder="内容" style={{ ...inputStyle, fontSize: "var(--fs-11)", minHeight: 60 }} maxHeight={240} />
                        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                          <button onClick={() => setEditingEntry(null)} style={btnSecondary}>取消</button>
                          <button onClick={handleUpdateEntry} style={btnPrimary}>保存</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontSize: "var(--fs-12)", fontWeight: 600, color: "var(--seed-fg)" }}>{entry.title}</span>
                            <span style={{ fontSize: "var(--fs-9)", padding: "1px 6px", borderRadius: 4, background: "var(--seed-surface)", color: "var(--seed-muted)" }}>{entry.category}</span>
                            {entry.constant && (
                              <span style={{ fontSize: "var(--fs-9)", padding: "1px 6px", borderRadius: 4, background: "var(--seed-accent-bg)", color: "var(--seed-accent)" }}>常驻</span>
                            )}
                            <span style={{ fontSize: "var(--fs-8)", padding: "0 4px", borderRadius: 2, background: "var(--seed-surface)", color: "var(--seed-muted)" }}>{entry.position}</span>
                          </div>
                          <div style={{ display: "flex", gap: 2 }}>
                            <button onClick={() => setEditingEntry(entry)} title="编辑" style={{ ...iconBtn, visibility: selectedBook.isBuiltin ? "hidden" : "visible" }}>
                              <Edit3 size={11} />
                            </button>
                            <button onClick={() => removeEntry(selectedBook.id, entry.id)} title="删除" style={{ ...iconBtn, visibility: selectedBook.isBuiltin ? "hidden" : "visible" }}>
                              <Trash2 size={11} />
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
    </div>
  );
}
