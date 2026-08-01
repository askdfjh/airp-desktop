import { useState, useEffect } from "react";
import { Users, Plus, Trash2, Edit3, Sparkles, User, RefreshCw } from "lucide-react";
import { useCharacterStore } from "@/stores/characterStore";
import { useSessionStore } from "@/stores/sessionStore";
import type { Character, CharacterArc } from "@/types";
import { EditDialog } from "@/components/Layout/EditDialog";

function formatTime(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const diff = now.getTime() - ts;
  if (diff < 60000) return "刚刚";
  if (diff < 3600000) return Math.floor(diff / 60000) + " 分钟前";
  if (diff < 86400000) return Math.floor(diff / 3600000) + " 小时前";
  if (diff < 604800000) return Math.floor(diff / 86400000) + " 天前";
  return d.getMonth() + 1 + "/" + d.getDate();
}

export function CharacterPanel() {
  const { characters, loadCharactersFromDb, addCharacter, updateCharacter, removeCharacter, loadArcs, arcs, clearWorldArcs, restoreDefaultCharacters, cards, loadFromDb, updateCard, removeCard, trashCards, loadTrashFromDb, restoreCardFromTrash, purgeCardFromTrash, clearExpiredTrash } = useCharacterStore();
  const { sessions, activeId, updateSystemPrompt } = useSessionStore();
  const [selectedChars, setSelectedChars] = useState<Set<string>>(new Set());
  const [detailId, setDetailId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<Character | null>(null);
  const [worldContext, setWorldContext] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const [newName, setNewName] = useState("");
  const [newAppearance, setNewAppearance] = useState("");
  const [newPersonality, setNewPersonality] = useState("");
  const [newBackground, setNewBackground] = useState("");
  const [newTags, setNewTags] = useState("");

  const [editName, setEditName] = useState("");
  const [editAppearance, setEditAppearance] = useState("");
  const [editPersonality, setEditPersonality] = useState("");
  const [editBackground, setEditBackground] = useState("");
  const [editTags, setEditTags] = useState("");

  useEffect(() => { loadCharactersFromDb(); }, []);
  useEffect(() => { loadFromDb(); }, []);
  useEffect(() => { loadTrashFromDb(); }, []);

  const extractedCards = cards.filter((c) => c.isExtracted);

  const promoteExtractedCard = async (id: string) => {
    await updateCard(id, { isExtracted: false });
  };

  const removeExtractedCard = async (id: string) => {
    if (!confirm("删除该提取角色卡？将移入回收站（保留30天），其绑定的会话将不再自动注入此角色，可随时恢复。")) return;
    await removeCard(id);
  };

  const selected = detailId ? characters.find(c => c.id === detailId) ?? null : null;

  useEffect(() => {
    if (selected) {
      loadArcs(selected.id, worldContext || undefined);
    }
  }, [selected, worldContext]);

  const filtered = searchQuery.trim()
    ? characters.filter(c =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.appearance.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.personality.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : characters;

  const resetForm = () => {
    setNewName(""); setNewAppearance(""); setNewPersonality("");
    setNewBackground(""); setNewTags("");
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    await addCharacter({
      id: crypto.randomUUID(),
      name: newName.trim(),
      appearance: newAppearance.trim(),
      personality: newPersonality.trim(),
      background: newBackground.trim(),
      tags: newTags.split(",").map(t => t.trim()).filter(Boolean),
      isBuiltin: false,
    });
    resetForm();
    setShowForm(false);
  };

  const startEdit = (c: Character) => {
    setEditName(c.name); setEditAppearance(c.appearance);
    setEditPersonality(c.personality); setEditBackground(c.background);
    setEditTags(c.tags.join(", "));
    setEditTarget(c);
  };

  const saveEdit = async () => {
    if (!editTarget) return;
    await updateCharacter(editTarget.id, {
      name: editName.trim(), appearance: editAppearance.trim(),
      personality: editPersonality.trim(), background: editBackground.trim(),
      tags: editTags.split(",").map(t => t.trim()).filter(Boolean),
    });
    setEditTarget(null);
  };

  const handleDelete = async (id: string) => {
    const c = characters.find(x => x.id === id);
    if (!c) return;
    await removeCharacter(id);
    setSelectedChars(prev => { const n = new Set(prev); n.delete(id); return n; });
    if (detailId === id) setDetailId(null);
  };

  const buildCharacterPrompt = (c: Character, charArcs: CharacterArc[]): string => {
    const parts: string[] = [];
    parts.push("【角色：" + c.name + "】");
    if (c.appearance) parts.push("外貌：" + c.appearance);
    if (c.personality) parts.push("性格：" + c.personality);
    if (c.background) parts.push("背景：" + c.background);
    if (c.tags.length > 0) parts.push("标签：" + c.tags.join("、"));
    if (charArcs.length > 0) {
      parts.push("【经历时间线】");
      charArcs.forEach(a => { parts.push("- " + a.event + "：" + a.description); });
    }
    return parts.join("\\n");
  };

  const applySelectedToSession = async () => {
    if (!activeId || selectedChars.size === 0) return;
    const parts: string[] = [];
    for (const id of selectedChars) {
      const c = characters.find(x => x.id === id);
      if (c) parts.push(buildCharacterPrompt(c, []));
    }
    parts.push("请以上述角色身份进行对话，保持性格一致性。");
    updateSystemPrompt(activeId, parts.join("\\n\\n"));
  };

  const toggleChar = (id: string) => {
    setSelectedChars(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
    setDetailId(id);
  };

  return (
    <div style={{ display: "flex", gap: 20, flex: 1, minHeight: 0 }}>
      {/* Left: Character list */}
      <div style={{ width: 300, display: "flex", flexDirection: "column", gap: 12, flexShrink: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Users size={16} style={{ color: "var(--seed-accent)" }} />
              <span style={{ fontSize: "var(--fs-13)", fontWeight: 600, color: "var(--seed-fg)" }}>角色列表</span>
              <span style={{ fontSize: "var(--fs-11)", color: "var(--seed-muted)" }}>({characters.length})</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <button onClick={() => restoreDefaultCharacters()}
                style={{ display: "flex", alignItems: "center", gap: 4, padding: "5px 10px", borderRadius: 8, fontSize: "var(--fs-11)", color: "var(--seed-muted)", background: "transparent", border: "1px solid var(--seed-border)", cursor: "pointer" }}>
                <RefreshCw size={11} /> 还原默认
              </button>
              <button onClick={() => { setShowForm(!showForm); }}
                style={{ display: "flex", alignItems: "center", gap: 4, padding: "5px 10px", borderRadius: 8, fontSize: "var(--fs-11)", fontWeight: 500, background: showForm ? "var(--seed-accent-bg)" : "transparent", color: showForm ? "var(--seed-accent)" : "var(--seed-muted)", border: showForm ? "1px solid var(--seed-accent-border)" : "1px solid var(--seed-border)", cursor: "pointer" }}>
                <Plus size={11} /> 新建
              </button>
            </div>
          </div>

        <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 10px", borderRadius: 8, background: "var(--seed-input-bg)", border: "1px solid var(--seed-border)" }}>
          <User size={12} style={{ color: "var(--seed-muted)", flexShrink: 0 }} />
          <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="搜索角色..."
            style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "var(--seed-fg)", fontSize: "var(--fs-12)", fontFamily: "inherit", minWidth: 0 }}
          />
        </div>

        {showForm && (
          <div style={{ padding: 12, borderRadius: 10, background: "var(--seed-surface)", border: "1px solid var(--seed-border)", display: "flex", flexDirection: "column", gap: 8 }}>
            <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="角色名称 *"
              style={{ padding: "7px 10px", borderRadius: 8, background: "var(--seed-input-bg)", border: "1px solid var(--seed-border)", color: "var(--seed-fg)", fontSize: "var(--fs-12)", fontFamily: "inherit", outline: "none" }}
            />
            <textarea value={newAppearance} onChange={(e) => setNewAppearance(e.target.value)} placeholder="外貌描述"
              style={{ padding: "7px 10px", borderRadius: 8, background: "var(--seed-input-bg)", border: "1px solid var(--seed-border)", color: "var(--seed-fg)", fontSize: "var(--fs-11)", fontFamily: "inherit", minHeight: 35, resize: "vertical", outline: "none" }}
            />
            <textarea value={newPersonality} onChange={(e) => setNewPersonality(e.target.value)} placeholder="性格特征"
              style={{ padding: "7px 10px", borderRadius: 8, background: "var(--seed-input-bg)", border: "1px solid var(--seed-border)", color: "var(--seed-fg)", fontSize: "var(--fs-11)", fontFamily: "inherit", minHeight: 35, resize: "vertical", outline: "none" }}
            />
            <textarea value={newBackground} onChange={(e) => setNewBackground(e.target.value)} placeholder="背景故事"
              style={{ padding: "7px 10px", borderRadius: 8, background: "var(--seed-input-bg)", border: "1px solid var(--seed-border)", color: "var(--seed-fg)", fontSize: "var(--fs-11)", fontFamily: "inherit", minHeight: 45, resize: "vertical", outline: "none" }}
            />
            <input value={newTags} onChange={(e) => setNewTags(e.target.value)} placeholder="标签（逗号分隔）"
              style={{ padding: "6px 10px", borderRadius: 8, background: "var(--seed-input-bg)", border: "1px solid var(--seed-border)", color: "var(--seed-fg)", fontSize: "var(--fs-11)", fontFamily: "inherit", outline: "none" }}
            />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 6 }}>
              <button onClick={() => { setShowForm(false); resetForm(); }}
                style={{ padding: "5px 12px", borderRadius: 6, fontSize: "var(--fs-11)", color: "var(--seed-muted)", background: "transparent", border: "1px solid var(--seed-border)", cursor: "pointer" }}>取消</button>
              <button onClick={handleCreate} disabled={!newName.trim()}
                style={{ padding: "5px 14px", borderRadius: 6, fontSize: "var(--fs-11)", fontWeight: 500, background: "var(--seed-accent)", color: "#fff", border: "none", opacity: !newName.trim() ? 0.5 : 1, cursor: !newName.trim() ? "not-allowed" : "pointer" }}>创建</button>
            </div>
          </div>
        )}

        {/* Character list */}
        <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 12 }}>
          {filtered.length === 0 && (
            <div style={{ padding: "30px 12px", textAlign: "center", color: "var(--seed-muted)", fontSize: "var(--fs-12)" }}>
              {searchQuery ? "未找到匹配的角色" : "暂无角色，点击右上角新建"}
            </div>
          )}
          {filtered.map((c) => {
            const isSelected = selectedChars.has(c.id);
            return (
            <div key={c.id}
              onClick={() => { toggleChar(c.id); }}
              style={{ padding: 12, borderRadius: 16, cursor: "pointer", background: isSelected ? "var(--seed-accent-bg)" : "var(--seed-surface)", border: "1px solid " + (isSelected ? "var(--seed-accent-border)" : "var(--seed-border)"), boxShadow: isSelected ? "inset 3px 0 0 0 var(--seed-accent)" : "none", transition: "all 0.12s ease", display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: "var(--seed-surface)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <User size={13} style={{ color: "var(--seed-accent)" }} />
                  </div>
                  <span style={{ fontSize: "var(--fs-12)", fontWeight: 600, color: "var(--seed-fg)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 2, flexShrink: 0 }}>
                  <button onClick={(e) => { e.stopPropagation(); startEdit(c); }} title="编辑"
                    style={{ width: 20, height: 20, borderRadius: 4, background: "transparent", color: "var(--seed-muted)", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                    <Edit3 size={9} />
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); handleDelete(c.id); }} title="删除"
                    style={{ width: 20, height: 20, borderRadius: 4, background: "transparent", color: "var(--seed-muted)", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                    <Trash2 size={9} />
                  </button>
                </div>
              </div>
              {c.personality && (
                <div style={{ fontSize: "var(--fs-11)", color: "var(--seed-muted)", lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 1, WebkitBoxOrient: "vertical" }}>{c.personality}</div>
              )}
              {c.tags.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                  {c.tags.slice(0, 3).map((tag) => (
                    <span key={tag} className="seed-tag-pill" style={{ fontSize: "var(--fs-9)", padding: "1px 7px", background: "var(--seed-accent-bg)", color: "var(--seed-accent)", fontWeight: 500 }}>{tag}</span>
                  ))}
                </div>
              )}
            </div>
            );
          })}
        </div>
      </div>

      {/* Right: Character detail */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16, minWidth: 0, minHeight: 0, overflowY: "auto" }}>
        {!selected ? (
          <div className="seed-empty-state" style={{ flex: 1, background: "var(--seed-surface)", borderRadius: 18, border: "1px solid var(--seed-border)" }}>
            <div className="seed-empty-icon">
              <Users size={28} style={{ color: "var(--seed-accent)" }} />
            </div>
            <div className="seed-empty-title">选择一个角色</div>
            <div className="seed-empty-sub">从左侧选择角色查看设定与经历，或点击右上角新建</div>
          </div>
        ) : (
          <>
            {/* Character info */}
            <div style={{ padding: 18, borderRadius: 18, background: "var(--seed-surface)", border: "1px solid var(--seed-border)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: "var(--seed-accent-bg)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <User size={20} style={{ color: "var(--seed-accent)" }} />
                  </div>
                  <div>
                    <div style={{ fontSize: "var(--fs-15)", fontWeight: 600, color: "var(--seed-fg)" }}>{selected.name}</div>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <button onClick={() => applySelectedToSession()} disabled={selectedChars.size === 0}
                    style={{ padding: "7px 16px", borderRadius: 8, fontSize: "var(--fs-12)", fontWeight: 500, background: selectedChars.size > 0 ? "var(--seed-accent)" : "var(--seed-hover-bg)", color: selectedChars.size > 0 ? "#fff" : "var(--seed-muted)", border: "none", cursor: selectedChars.size > 0 ? "pointer" : "not-allowed" }}>
                    应用选中角色（{selectedChars.size}）
                  </button>
                </div>
              </div>

              {selected.appearance && (
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: "var(--fs-10)", color: "var(--seed-muted)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>外貌</div>
                  <div style={{ fontSize: "var(--fs-12)", color: "var(--seed-muted)", lineHeight: 1.5 }}>{selected.appearance}</div>
                </div>
              )}
              {selected.personality && (
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: "var(--fs-10)", color: "var(--seed-muted)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>性格</div>
                  <div style={{ fontSize: "var(--fs-12)", color: "var(--seed-muted)", lineHeight: 1.5 }}>{selected.personality}</div>
                </div>
              )}
              {selected.background && (
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: "var(--fs-10)", color: "var(--seed-muted)", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4 }}>背景</div>
                  <div style={{ fontSize: "var(--fs-12)", color: "var(--seed-muted)", lineHeight: 1.5 }}>{selected.background}</div>
                </div>
              )}
              {selected.tags.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 8 }}>
                  {selected.tags.map((tag) => (
                    <span key={tag} style={{ fontSize: "var(--fs-10)", padding: "2px 8px", borderRadius: 4, background: "var(--seed-accent-bg)", color: "var(--seed-accent)", fontWeight: 500 }}>{tag}</span>
                  ))}
                </div>
              )}
            </div>

            {/* World context + arcs */}
            <div style={{ padding: 18, borderRadius: 18, background: "var(--seed-surface)", border: "1px solid var(--seed-border)", flex: 1, display: "flex", flexDirection: "column", minHeight: 200 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Sparkles size={14} style={{ color: "var(--seed-accent)" }} />
                  <span style={{ fontSize: "var(--fs-13)", fontWeight: 600, color: "var(--seed-fg)" }}>经历时间线</span>
                  <span style={{ fontSize: "var(--fs-11)", color: "var(--seed-muted)" }}>({arcs.length})</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <input value={worldContext} onChange={(e) => setWorldContext(e.target.value)} placeholder="世界/会话上下文"
                    style={{ padding: "5px 10px", borderRadius: 8, background: "var(--seed-input-bg)", border: "1px solid var(--seed-border)", color: "var(--seed-fg)", fontSize: "var(--fs-11)", fontFamily: "inherit", outline: "none", width: 140 }}
                  />
                  {arcs.length > 0 && (
                    <button onClick={() => { if (confirm("确定清空该世界上下文的所有经历？")) clearWorldArcs(selected.id, worldContext); }}
                      style={{ padding: "5px 10px", borderRadius: 8, fontSize: "var(--fs-11)", color: "var(--danger)", background: "transparent", border: "1px solid var(--seed-border)", cursor: "pointer" }}>
                      清空
                    </button>
                  )}
                </div>
              </div>

              <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
                {arcs.length === 0 && (
                  <div style={{ padding: "30px 12px", textAlign: "center", color: "var(--seed-muted)", fontSize: "var(--fs-12)" }}>
                    设置世界上下文后，AI 对话中将自动提取角色经历
                  </div>
                )}
                {arcs.map((arc) => (
                  <div key={arc.id}
                    style={{ padding: 10, borderRadius: 8, background: "var(--seed-hover-bg)", border: "1px solid var(--seed-border)" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontSize: "var(--fs-12)", fontWeight: 600, color: "var(--seed-fg)" }}>{arc.event}</span>
                      <span style={{ fontSize: "var(--fs-10)", color: "var(--seed-muted)" }}>{formatTime(arc.createdAt)}</span>
                    </div>
                    {arc.description && (
                      <div style={{ fontSize: "var(--fs-11)", color: "var(--seed-muted)", lineHeight: 1.4 }}>{arc.description}</div>
                    )}
                    <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                      <span style={{ fontSize: "var(--fs-9)", padding: "1px 5px", borderRadius: 3, background: "var(--seed-accent-bg)", color: "var(--seed-accent)" }}>{arc.worldContext || "默认"}</span>
                      <span style={{ fontSize: "var(--fs-9)", padding: "1px 5px", borderRadius: 3, background: "var(--seed-surface)", color: "var(--seed-muted)" }}>{arc.turnCount} 回合</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* 会话提取角色卡：长对话压缩时自动提取，角色出场时自动注入 */}
      <div style={{ marginTop: 20, padding: 18, borderRadius: 18, background: "var(--seed-surface)", border: "1px solid var(--seed-border)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <Sparkles size={14} style={{ color: "var(--seed-accent)" }} />
          <span style={{ fontSize: "var(--fs-13)", fontWeight: 600, color: "var(--seed-fg)" }}>会话提取角色卡</span>
          <span style={{ fontSize: "var(--fs-11)", color: "var(--seed-muted)" }}>({extractedCards.length})</span>
          <span style={{ fontSize: "var(--fs-10)", color: "var(--seed-muted)", marginLeft: 4 }}>
            长对话整理时自动提取，角色出场时自动注入；「转为普通卡」可移入角色卡库
          </span>
        </div>

        {extractedCards.length === 0 ? (
          <div style={{ padding: "24px 12px", textAlign: "center", color: "var(--seed-muted)", fontSize: "var(--fs-12)" }}>
            暂无提取角色卡。对话足够长时点击底栏「整理故事」，将自动提取出场的重要角色。
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {extractedCards.map((c) => (
              <div key={c.id} style={{ padding: 12, borderRadius: 10, background: "var(--seed-hover-bg)", border: "1px solid var(--seed-border)" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                    <span style={{ fontSize: "var(--fs-12)", fontWeight: 600, color: "var(--seed-fg)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.name}</span>
                    {(c.triggerWords ?? []).slice(0, 4).map((w) => (
                      <span key={w} style={{ fontSize: "var(--fs-10)", padding: "2px 8px", borderRadius: 999, background: "var(--seed-accent-bg)", color: "var(--seed-accent)" }}>{w}</span>
                    ))}
                  </div>
                  <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                    <button
                      onClick={() => promoteExtractedCard(c.id)}
                      style={{ padding: "5px 10px", borderRadius: 8, fontSize: "var(--fs-11)", color: "var(--seed-accent)", background: "var(--seed-accent-bg)", border: "1px solid color-mix(in srgb, var(--seed-accent) 40%, transparent)", cursor: "pointer" }}
                    >
                      转为普通卡
                    </button>
                    <button
                      onClick={() => removeExtractedCard(c.id)}
                      style={{ padding: "5px 10px", borderRadius: 8, fontSize: "var(--fs-11)", color: "var(--danger)", background: "transparent", border: "1px solid var(--seed-border)", cursor: "pointer" }}
                    >
                      删除
                    </button>
                  </div>
                </div>
                <div style={{ fontSize: "var(--fs-11)", color: "var(--seed-muted)", lineHeight: 1.5, marginTop: 6, whiteSpace: "pre-line" }}>{c.systemPrompt}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 角色卡回收站：删除的角色卡保留 30 天，可恢复 */}
      <div style={{ marginTop: 20, padding: 18, borderRadius: 18, background: "var(--seed-surface)", border: "1px solid var(--seed-border)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <Trash2 size={14} style={{ color: "var(--seed-accent)" }} />
          <span style={{ fontSize: "var(--fs-13)", fontWeight: 600, color: "var(--seed-fg)" }}>角色卡回收站</span>
          <span style={{ fontSize: "var(--fs-11)", color: "var(--seed-muted)" }}>({trashCards.length})</span>
          <span style={{ fontSize: "var(--fs-10)", color: "var(--seed-muted)", marginLeft: 4 }}>删除的角色卡（含提取卡）保留 30 天，到期自动清理</span>
        </div>

        {trashCards.length === 0 ? (
          <div style={{ padding: "24px 12px", textAlign: "center", color: "var(--seed-muted)", fontSize: "var(--fs-12)" }}>
            回收站为空。删除角色卡后将在这里保留 30 天。
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {trashCards.map((c) => (
              <div key={c.id} style={{ padding: 12, borderRadius: 10, background: "var(--seed-hover-bg)", border: "1px solid var(--seed-border)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                  <span style={{ fontSize: 14, flexShrink: 0 }}>{c.emoji || "🎭"}</span>
                  <span style={{ fontSize: "var(--fs-12)", fontWeight: 600, color: "var(--seed-fg)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</span>
                  {c.isExtracted && (
                    <span style={{ fontSize: "var(--fs-9)", padding: "1px 7px", borderRadius: 999, background: "var(--seed-accent-bg)", color: "var(--seed-accent)", flexShrink: 0 }}>提取</span>
                  )}
                  <span style={{ fontSize: "var(--fs-10)", color: "var(--seed-muted)", flexShrink: 0 }}>
                    {formatTime(c.deletedAt || Date.now())} 前删除
                  </span>
                </div>
                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  <button
                    onClick={() => restoreCardFromTrash(c.id)}
                    style={{ padding: "5px 10px", borderRadius: 8, fontSize: "var(--fs-11)", color: "var(--seed-accent)", background: "var(--seed-accent-bg)", border: "1px solid color-mix(in srgb, var(--seed-accent) 40%, transparent)", cursor: "pointer" }}
                  >
                    恢复
                  </button>
                  <button
                    onClick={() => { if (confirm(`彻底删除角色卡「${c.name}」？此操作不可恢复，其会话绑定将一并清除。`)) purgeCardFromTrash(c.id); }}
                    style={{ padding: "5px 10px", borderRadius: 8, fontSize: "var(--fs-11)", color: "var(--danger)", background: "transparent", border: "1px solid var(--seed-border)", cursor: "pointer" }}
                  >
                    彻底删除
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {editTarget && (
        <EditDialog
          title={"编辑角色 - " + editTarget.name}
          fields={[
            { key: "name", label: "名称", type: "text", value: editName, onChange: setEditName, placeholder: "角色名称" },
            { key: "appearance", label: "外貌描述", type: "textarea", value: editAppearance, onChange: setEditAppearance, placeholder: "外貌描述", rows: 3 },
            { key: "personality", label: "性格特征", type: "textarea", value: editPersonality, onChange: setEditPersonality, placeholder: "性格特征", rows: 3 },
            { key: "background", label: "背景故事", type: "textarea", value: editBackground, onChange: setEditBackground, placeholder: "背景故事", rows: 4 },
            { key: "tags", label: "标签（逗号分隔）", type: "text", value: editTags, onChange: setEditTags, placeholder: "标签1, 标签2, 标签3" },
          ]}
          onSave={saveEdit}
          onCancel={() => setEditTarget(null)}
        />
      )}
    </div>
  );
}
