import { useState, useEffect } from "react";
import { Users, Trash2, Edit3, Sparkles, User, RefreshCw, Search, Send, Wand2 } from "lucide-react";
import { useCharacterStore } from "@/stores/characterStore";
import { useSessionStore } from "@/stores/sessionStore";
import { useUIStore } from "@/stores/uiStore";
import { useCreateStore } from "@/stores/createStore";
import { AutoInput } from "@/lib/autoGrow";
import type { Character, CharacterArc, CharacterCard } from "@/types";
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

function buildCharacterPrompt(c: Character, arcs: CharacterArc[]): string {
  let p = `角色：${c.name}\n外貌：${c.appearance || "未知"}\n性格：${c.personality || "未知"}`;
  if (c.background) p += `\n背景：${c.background}`;
  if (arcs.length > 0) {
    p += "\n经历：" + arcs.map(a => `${a.event}${a.description ? "（" + a.description + "）" : ""}`).join("，");
  }
  return p;
}

export function CharacterPanel() {
  const { characters, loadCharactersFromDb, updateCharacter, removeCharacter, loadArcs, arcs, clearWorldArcs, restoreDefaultCharacters, cards, loadFromDb, updateCard, removeCard, trashCards, loadTrashFromDb, restoreCardFromTrash, purgeCardFromTrash, clearExpiredTrash } = useCharacterStore();
  const [viewTab, setViewTab] = useState<"char" | "extracted" | "trash">("char");
  // 窄屏（手机）：左右分栏改为上下堆叠
  const [isNarrow, setIsNarrow] = useState(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 820px)').matches);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 820px)');
    const handler = (e: MediaQueryListEvent) => setIsNarrow(e.matches);
    mq.addEventListener('change', handler);
    setIsNarrow(mq.matches);
    return () => mq.removeEventListener('change', handler);
  }, []);
  const [selectedChars, setSelectedChars] = useState<Set<string>>(new Set());
  const [detailId, setDetailId] = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<Character | null>(null);
  const [worldContext, setWorldContext] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const setCreateMode = useUIStore((s) => s.setCreateMode);
  const notify = useUIStore((s) => s.notify);
  const openCreateMode = () => {
    useCreateStore.getState().open("character");
    setCreateMode("character");
  };

  const [editName, setEditName] = useState("");
  const [editAppearance, setEditAppearance] = useState("");
  const [editPersonality, setEditPersonality] = useState("");
  const [editBackground, setEditBackground] = useState("");
  const [editTags, setEditTags] = useState("");

  useEffect(() => { loadCharactersFromDb(); }, []);
  useEffect(() => { loadFromDb(); }, []);
  useEffect(() => { loadTrashFromDb(); }, []);

  const extractedCards = cards.filter((c) => c.isExtracted);
  const selected = detailId ? characters.find(c => c.id === detailId) ?? null : null;

  useEffect(() => {
    if (selected) {
      loadArcs(selected.id, worldContext || undefined);
    }
  }, [selected, worldContext]);

  const q = searchQuery.trim().toLowerCase();
  const filtered = q
    ? characters.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.appearance.toLowerCase().includes(q) ||
        c.personality.toLowerCase().includes(q) ||
        c.tags.some(t => t.toLowerCase().includes(q))
      )
    : characters;
  const builtinChars = filtered.filter(c => c.isBuiltin);
  const myChars = filtered.filter(c => !c.isBuiltin);

  const resetForm = () => {};

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
    if (!confirm(`确定删除角色「${c.name}」？`)) return;
    await removeCharacter(id);
    if (detailId === id) setDetailId(null);
    setSelectedChars(prev => {
      const n = new Set(prev);
      n.delete(id);
      return n;
    });
  };

  const toggleChar = (id: string) => {
    setSelectedChars(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
    setDetailId(id);
  };

  // 多选角色 → 新建扮演会话：AI 同时扮演所选角色（按语境切换身份）
  const applySelectedToSession = () => {
    if (selectedChars.size === 0) return;
    const picked = characters.filter((c) => selectedChars.has(c.id));
    if (picked.length === 0) return;
    const parts: string[] = [`你现在扮演以下 ${picked.length} 个角色，在对话中根据语境切换身份，保持各自性格与设定一致，不要跳出角色：`];
    picked.forEach((c) => {
      parts.push(`【${c.name}】` + buildCharacterPrompt(c, []).replace(/^角色：.+?\n/, ""));
    });
    useSessionStore.getState().createRoleplaySession({
      name: picked.length <= 2 ? picked.map((c) => c.name).join("、") : `${picked[0].name} 等 ${picked.length} 人`,
      systemPrompt: parts.join("\n"),
      intro: picked.map((c) => c.personality || c.tags.join("、")).filter(Boolean).join("；") || undefined,
    });
    useUIStore.getState().setSettingsOpen(false);
  };

  // 新建扮演会话：AI 完全以该角色身份对话（空白会话 + 自动开场自我介绍）
  const roleplayFromCharacter = (c: Character) => {
    const parts: string[] = [`你现在扮演「${c.name}」。`];
    if (c.appearance) parts.push("外貌：" + c.appearance);
    if (c.personality) parts.push("性格：" + c.personality);
    if (c.background) parts.push("背景：" + c.background);
    if (c.tags.length > 0) parts.push("标签：" + c.tags.join("、"));
    parts.push("请完全以该角色身份与用户对话，保持性格与设定一致，不要跳出角色。");
    useSessionStore.getState().createRoleplaySession({
      name: c.name,
      systemPrompt: parts.join("\n"),
      intro: c.personality || c.tags.join("、"),
    });
    useUIStore.getState().setSettingsOpen(false);
  };

  const roleplayFromCard = (c: CharacterCard) => {
    useSessionStore.getState().createRoleplaySession({
      name: c.name,
      systemPrompt: `你现在扮演「${c.name}」。\n${c.systemPrompt}\n请完全以该角色身份与用户对话，保持角色一致，不要跳出角色。`,
      intro: c.description,
    });
    useUIStore.getState().setSettingsOpen(false);
  };

  const promoteExtractedCard = async (id: string) => {
    await updateCard(id, { isExtracted: false });
  };

  const removeExtractedCard = async (id: string) => {
    if (!confirm("删除该提取角色卡？将移入回收站（保留30天），其绑定的会话将不再自动注入此角色，可随时恢复。")) return;
    await removeCard(id);
  };

  const tabStyle = (active: boolean): React.CSSProperties => ({
    display: "flex", alignItems: "center", gap: 6, flex: 1, justifyContent: "center",
    padding: "8px 0", borderRadius: 8, fontSize: 12.5, fontWeight: 500, fontFamily: "inherit",
    cursor: "pointer", border: "none",
    background: active ? "var(--seed-accent)" : "transparent",
    color: active ? "#fff" : "var(--seed-muted)",
    transition: "all 0.15s",
  });

  return (
    <div style={{ display: "flex", gap: 20, flex: 1, minHeight: 0, flexDirection: isNarrow ? "column" : "row" }}>
      {/* Left column */}
      <div style={{ width: isNarrow ? "100%" : 290, display: "flex", flexDirection: "column", gap: 12, flexShrink: 0, minHeight: 0, maxHeight: isNarrow ? 260 : "none", overflow: "hidden" }}>
        {/* View tabs */}
        <div style={{ display: "flex", gap: 4, padding: 4, background: "var(--seed-input-bg)", borderRadius: 12, border: "1px solid var(--seed-border)" }}>
          <button style={tabStyle(viewTab === "char")} onClick={() => setViewTab("char")}>
            <Users size={13} /> 角色
            <span style={{ opacity: 0.7, fontSize: 11 }}>{characters.length}</span>
          </button>
          <button style={tabStyle(viewTab === "extracted")} onClick={() => setViewTab("extracted")}>
            <Sparkles size={13} /> 提取卡
            <span style={{ opacity: 0.7, fontSize: 11 }}>{extractedCards.length}</span>
          </button>
          <button style={tabStyle(viewTab === "trash")} onClick={() => setViewTab("trash")}>
            <Trash2 size={13} /> 回收站
            <span style={{ opacity: 0.7, fontSize: 11 }}>{trashCards.length}</span>
          </button>
        </div>

        {viewTab === "char" && (
          <>
            {/* Search + create */}
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 6, padding: "7px 10px", borderRadius: 10, background: "var(--seed-input-bg)", border: "1px solid var(--seed-border)" }}>
                <Search size={12} style={{ color: "var(--seed-muted)", flexShrink: 0 }} />
                <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="搜索角色..."
                  style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "var(--seed-fg)", fontSize: "var(--fs-12)", fontFamily: "inherit", minWidth: 0 }}
                />
              </div>
              <button
                onClick={openCreateMode}
                title="与 AI 对话式创建角色，完成后自动写入角色卡"
                style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "8px 16px", borderRadius: 999, border: "none", background: "var(--seed-accent)", color: "#fff", fontSize: "var(--fs-11)", fontWeight: 500, fontFamily: "inherit", cursor: "pointer", transition: "filter 0.15s", flexShrink: 0 }}
              >
                <Wand2 size={12} /> AI 创建
              </button>
            </div>

            {/* Grouped list */}
            <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 10 }}>
              {builtinChars.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "var(--seed-muted)", textTransform: "uppercase", letterSpacing: "0.06em", padding: "2px 2px 0" }}>
                    预设角色 · {builtinChars.length}
                  </div>
                  {builtinChars.map((c) => {
                    const isSelected = selectedChars.has(c.id);
                    return (
                      <div key={c.id}
                        onClick={() => { toggleChar(c.id); }}
                        style={{ padding: 12, borderRadius: 16, cursor: "pointer", background: isSelected ? "var(--seed-accent-bg)" : "var(--seed-surface)", border: "1px solid " + (isSelected ? "var(--seed-accent-border)" : "var(--seed-border)"), boxShadow: isSelected ? "inset 3px 0 0 0 var(--seed-accent)" : "none", transition: "all 0.12s ease", display: "flex", flexDirection: "column", gap: 6 }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                            <div style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--seed-surface)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                              <User size={13} style={{ color: "var(--seed-accent)" }} />
                            </div>
                            <span style={{ fontSize: "var(--fs-12)", fontWeight: 600, color: "var(--seed-fg)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</span>
                          </div>
                        </div>
                        {c.personality && (
                          <div style={{ fontSize: "var(--fs-11)", color: "var(--seed-muted)", lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 1, WebkitBoxOrient: "vertical" }}>{c.personality}</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {myChars.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "var(--seed-muted)", textTransform: "uppercase", letterSpacing: "0.06em", padding: "2px 2px 0" }}>
                    我的角色 · {myChars.length}
                  </div>
                  {myChars.map((c) => {
                    const isSelected = selectedChars.has(c.id);
                    return (
                      <div key={c.id}
                        onClick={() => { toggleChar(c.id); }}
                        style={{ padding: 12, borderRadius: 16, cursor: "pointer", background: isSelected ? "var(--seed-accent-bg)" : "var(--seed-surface)", border: "1px solid " + (isSelected ? "var(--seed-accent-border)" : "var(--seed-border)"), boxShadow: isSelected ? "inset 3px 0 0 0 var(--seed-accent)" : "none", transition: "all 0.12s ease", display: "flex", flexDirection: "column", gap: 6 }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                            <div style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--seed-surface)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                              <User size={13} style={{ color: "var(--seed-accent)" }} />
                            </div>
                            <span style={{ fontSize: "var(--fs-12)", fontWeight: 600, color: "var(--seed-fg)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</span>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: 2, flexShrink: 0 }}>
                            <button onClick={(e) => { e.stopPropagation(); startEdit(c); }} title="编辑"
                              style={{ width: 22, height: 22, borderRadius: 5, background: "transparent", color: "var(--seed-muted)", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                              <Edit3 size={10} />
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); handleDelete(c.id); }} title="删除"
                              style={{ width: 22, height: 22, borderRadius: 5, background: "transparent", color: "var(--seed-muted)", border: "none", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                              <Trash2 size={10} />
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
              )}

              {filtered.length === 0 && (
                <div style={{ padding: "30px 12px", textAlign: "center", color: "var(--seed-muted)", fontSize: "var(--fs-12)" }}>
                  {searchQuery ? "未找到匹配的角色" : "暂无角色，点击右上角「AI 创建」，与 AI 对话生成角色"}
                </div>
              )}
            </div>
          </>
        )}

        {viewTab === "extracted" && (
          <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
            {extractedCards.length === 0 && (
              <div style={{ padding: "30px 12px", textAlign: "center", color: "var(--seed-muted)", fontSize: "var(--fs-12)" }}>
                暂无提取角色卡。对话足够长时点击底栏「整理故事」，将自动提取出场的重要角色。
              </div>
            )}
            {extractedCards.map((c) => (
              <div key={c.id} style={{ padding: 12, borderRadius: 14, background: "var(--seed-surface)", border: "1px solid var(--seed-border)", display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                  <span style={{ fontSize: 13, flexShrink: 0 }}>{c.emoji || "🎭"}</span>
                  <span style={{ fontSize: "var(--fs-12)", fontWeight: 600, color: "var(--seed-fg)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{c.name}</span>
                  <span style={{ fontSize: "var(--fs-9)", padding: "1px 7px", borderRadius: 999, background: "var(--seed-accent-bg)", color: "var(--seed-accent)", flexShrink: 0 }}>提取</span>
                </div>
                {(c.triggerWords ?? []).length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                    {(c.triggerWords ?? []).slice(0, 5).map((w) => (
                      <span key={w} style={{ fontSize: "var(--fs-10)", padding: "1px 6px", borderRadius: 4, background: "var(--seed-accent-bg)", color: "var(--seed-accent)" }}>#{w}</span>
                    ))}
                  </div>
                )}
                <div style={{ fontSize: "var(--fs-11)", color: "var(--seed-muted)", lineHeight: 1.5, whiteSpace: "pre-line", maxHeight: 60, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{c.systemPrompt}</div>
                <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                  <button
                    onClick={() => roleplayFromCard(c)}
                    style={{ padding: "5px 12px", borderRadius: 8, fontSize: "var(--fs-11)", fontFamily: "inherit", color: "var(--seed-accent)", background: "transparent", border: "1px dashed var(--seed-accent-border)", cursor: "pointer" }}
                  >
                    新建扮演会话
                  </button>
                  <button
                    onClick={() => promoteExtractedCard(c.id)}
                    style={{ padding: "5px 12px", borderRadius: 8, fontSize: "var(--fs-11)", fontFamily: "inherit", color: "var(--seed-accent)", background: "var(--seed-accent-bg)", border: "1px solid color-mix(in srgb, var(--seed-accent) 40%, transparent)", cursor: "pointer" }}
                  >
                    转为普通卡
                  </button>
                  <button
                    onClick={() => removeExtractedCard(c.id)}
                    style={{ padding: "5px 12px", borderRadius: 8, fontSize: "var(--fs-11)", fontFamily: "inherit", color: "var(--danger)", background: "transparent", border: "1px solid var(--seed-border)", cursor: "pointer" }}
                  >
                    删除
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {viewTab === "trash" && (
          <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
            {trashCards.length === 0 && (
              <div style={{ padding: "30px 12px", textAlign: "center", color: "var(--seed-muted)", fontSize: "var(--fs-12)" }}>
                回收站为空。删除角色卡后将在这里保留 30 天。
              </div>
            )}
            {trashCards.map((c) => (
              <div key={c.id} style={{ padding: 12, borderRadius: 14, background: "var(--seed-surface)", border: "1px solid var(--seed-border)", display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                  <span style={{ fontSize: 14, flexShrink: 0 }}>{c.emoji || "🎭"}</span>
                  <span style={{ fontSize: "var(--fs-12)", fontWeight: 600, color: "var(--seed-fg)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{c.name}</span>
                  {c.isExtracted && (
                    <span style={{ fontSize: "var(--fs-9)", padding: "1px 7px", borderRadius: 999, background: "var(--seed-accent-bg)", color: "var(--seed-accent)", flexShrink: 0 }}>提取</span>
                  )}
                  <span style={{ fontSize: "var(--fs-10)", color: "var(--seed-muted)", flexShrink: 0 }}>
                    {formatTime(c.deletedAt || Date.now())} 前
                  </span>
                </div>
                <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                  <button
                    onClick={() => restoreCardFromTrash(c.id)}
                    style={{ padding: "5px 12px", borderRadius: 8, fontSize: "var(--fs-11)", fontFamily: "inherit", color: "var(--seed-accent)", background: "var(--seed-accent-bg)", border: "1px solid color-mix(in srgb, var(--seed-accent) 40%, transparent)", cursor: "pointer" }}
                  >
                    恢复
                  </button>
                  <button
                    onClick={() => { if (confirm(`彻底删除角色卡「${c.name}」？此操作不可恢复，其会话绑定将一并清除。`)) purgeCardFromTrash(c.id); }}
                    style={{ padding: "5px 12px", borderRadius: 8, fontSize: "var(--fs-11)", fontFamily: "inherit", color: "var(--danger)", background: "transparent", border: "1px solid var(--seed-border)", cursor: "pointer" }}
                  >
                    彻底删除
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Right: Character detail */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 16, minWidth: 0, minHeight: isNarrow ? 300 : 0, overflowY: "auto" }}>
        {viewTab === "extracted" ? (
          <div className="seed-empty-state" style={{ flex: 1, background: "var(--seed-surface)", borderRadius: 18, border: "1px solid var(--seed-border)" }}>
            <div className="seed-empty-icon">
              <Sparkles size={28} style={{ color: "var(--seed-accent)" }} />
            </div>
            <div className="seed-empty-title">会话提取角色卡</div>
            <div className="seed-empty-sub">长对话整理时自动提取的 NPC 角色，出场时自动注入；「转为普通卡」移入角色库</div>
          </div>
        ) : viewTab === "trash" ? (
          <div className="seed-empty-state" style={{ flex: 1, background: "var(--seed-surface)", borderRadius: 18, border: "1px solid var(--seed-border)" }}>
            <div className="seed-empty-icon">
              <Trash2 size={28} style={{ color: "var(--seed-accent)" }} />
            </div>
            <div className="seed-empty-title">角色卡回收站</div>
            <div className="seed-empty-sub">从左侧选择已删除的角色卡进行恢复，或彻底删除（30 天后自动清理）</div>
          </div>
        ) : !selected ? (
          <div className="seed-empty-state" style={{ flex: 1, background: "var(--seed-surface)", borderRadius: 18, border: "1px solid var(--seed-border)" }}>
            <div className="seed-empty-icon">
              <Users size={28} style={{ color: "var(--seed-accent)" }} />
            </div>
            <div className="seed-empty-title">选择一个角色</div>
            <div className="seed-empty-sub">从左侧选择角色查看设定与经历，勾选多个可一并应用到当前会话</div>
          </div>
        ) : (
          <>
            {/* Character info */}
            <div style={{ padding: 18, borderRadius: 18, background: "var(--seed-surface)", border: "1px solid var(--seed-border)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 44, height: 44, borderRadius: "50%", background: "var(--seed-accent-bg)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <User size={20} style={{ color: "var(--seed-accent)" }} />
                  </div>
                  <div>
                    <div style={{ fontSize: "var(--fs-15)", fontWeight: 600, color: "var(--seed-fg)", display: "flex", alignItems: "center", gap: 6 }}>
                      {selected.name}
                      {selected.isBuiltin && <span className="seed-tag-pill" style={{ fontSize: "var(--fs-9)", padding: "1px 7px" }}>预设</span>}
                    </div>
                    {selected.tags.length > 0 && (
                      <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
                        {selected.tags.slice(0, 4).map((tag) => (
                          <span key={tag} style={{ fontSize: "var(--fs-10)", padding: "2px 8px", borderRadius: 999, background: "var(--seed-accent-bg)", color: "var(--seed-accent)", fontWeight: 500 }}>{tag}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <button onClick={() => roleplayFromCharacter(selected)}
                    style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 16px", borderRadius: 10, fontSize: "var(--fs-12)", fontWeight: 500, fontFamily: "inherit", background: "transparent", color: "var(--seed-accent)", border: "1px dashed var(--seed-accent-border)", cursor: "pointer" }}>
                    <Send size={12} /> 新建扮演会话
                  </button>
                  <button onClick={applySelectedToSession} disabled={selectedChars.size === 0}
                    style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 16px", borderRadius: 10, fontSize: "var(--fs-12)", fontWeight: 500, fontFamily: "inherit", background: selectedChars.size > 0 ? "var(--seed-accent)" : "var(--seed-hover-bg)", color: selectedChars.size > 0 ? "#fff" : "var(--seed-muted)", border: "none", cursor: selectedChars.size > 0 ? "pointer" : "not-allowed" }}>
                    <Send size={12} /> 新建扮演会话（{selectedChars.size}）
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
              {!selected.appearance && !selected.personality && !selected.background && (
                <div style={{ fontSize: "var(--fs-11)", color: "var(--seed-muted)" }}>该角色暂无详细设定</div>
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
                  <AutoInput value={worldContext} onChange={(e) => setWorldContext(e.target.value)} placeholder="世界/会话上下文" min={140} max={360}
                    style={{ padding: "6px 10px", borderRadius: 8, background: "var(--seed-input-bg)", border: "1px solid var(--seed-border)", color: "var(--seed-fg)", fontSize: "var(--fs-11)", fontFamily: "inherit", outline: "none" }}
                  />
                  {arcs.length > 0 && (
                    <button onClick={() => { if (confirm("确定清空该世界上下文的所有经历？")) clearWorldArcs(selected.id, worldContext); }}
                      style={{ padding: "6px 10px", borderRadius: 8, fontSize: "var(--fs-11)", fontFamily: "inherit", color: "var(--danger)", background: "transparent", border: "1px solid var(--seed-border)", cursor: "pointer" }}>
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
                    style={{ padding: 10, borderRadius: 10, background: "var(--seed-hover-bg)", border: "1px solid var(--seed-border)" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontSize: "var(--fs-12)", fontWeight: 600, color: "var(--seed-fg)" }}>{arc.event}</span>
                      <span style={{ fontSize: "var(--fs-10)", color: "var(--seed-muted)" }}>{formatTime(arc.createdAt)}</span>
                    </div>
                    {arc.description && (
                      <div style={{ fontSize: "var(--fs-11)", color: "var(--seed-muted)", lineHeight: 1.4 }}>{arc.description}</div>
                    )}
                    <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
                      <span style={{ fontSize: "var(--fs-9)", padding: "1px 5px", borderRadius: 4, background: "var(--seed-accent-bg)", color: "var(--seed-accent)" }}>{arc.worldContext || "默认"}</span>
                      <span style={{ fontSize: "var(--fs-9)", padding: "1px 5px", borderRadius: 4, background: "var(--seed-surface)", color: "var(--seed-muted)" }}>{arc.turnCount} 回合</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
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
