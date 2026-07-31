import { useState, useEffect, useRef } from "react";
import { X, Plus, Trash2, Edit3, Check, Users, User, Sparkles } from "lucide-react";
import { useCharacterStore } from "@/stores/characterStore";
import { useSessionStore } from "@/stores/sessionStore";
import type { CharacterCard, Character } from "@/types";

interface CharacterCardPickerProps {
  open: boolean;
  onClose: () => void;
  anchorRef?: React.RefObject<HTMLElement | null>;
}

type TabType = "characters" | "cards";

export function CharacterCardPicker({ open, onClose, anchorRef }: CharacterCardPickerProps) {
  const { cards, characters, arcs, loadCharactersFromDb, loadArcs } = useCharacterStore();
  const { activeId, updateSystemPrompt } = useSessionStore();
  const [activeTab, setActiveTab] = useState<TabType>("characters");
  const [searchQuery, setSearchQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newPrompt, setNewPrompt] = useState("");
  const [newEmoji, setNewEmoji] = useState("🎭");
  const [newTags, setNewTags] = useState("");

  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editPrompt, setEditPrompt] = useState("");
  const [editEmoji, setEditEmoji] = useState("");
  const [editTags, setEditTags] = useState("");

  const [newCharName, setNewCharName] = useState("");
  const [newCharAppearance, setNewCharAppearance] = useState("");
  const [newCharPersonality, setNewCharPersonality] = useState("");
  const [newCharBackground, setNewCharBackground] = useState("");
  const [newCharTags, setNewCharTags] = useState("");

  const [editCharName, setEditCharName] = useState("");
  const [editCharAppearance, setEditCharAppearance] = useState("");
  const [editCharPersonality, setEditCharPersonality] = useState("");
  const [editCharBackground, setEditCharBackground] = useState("");
  const [editCharTags, setEditCharTags] = useState("");

  useEffect(() => {
    if (!open) {
      setEditingId(null);
      setShowNewForm(false);
      setSearchQuery("");
      setNewCharName("");
      setNewCharAppearance("");
      setNewCharPersonality("");
      setNewCharBackground("");
      setNewCharTags("");
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    loadCharactersFromDb();
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

  const filteredCards = searchQuery.trim()
    ? cards.filter(
        (c) =>
          c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          c.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
          c.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : cards;

  const filteredCharacters = searchQuery.trim()
    ? characters.filter(
        (c) =>
          c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          c.appearance.toLowerCase().includes(searchQuery.toLowerCase()) ||
          c.personality.toLowerCase().includes(searchQuery.toLowerCase()) ||
          c.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : characters;

  const applyCard = (card: CharacterCard) => {
    if (!activeId) return;
    updateSystemPrompt(activeId, card.systemPrompt);
    onClose();
  };

  const applyCharacter = async (c: Character) => {
    if (!activeId) return;
    await loadArcs(c.id);
    const { arcs: freshArcs } = useCharacterStore.getState();
    const parts: string[] = [];
    parts.push("【角色：" + c.name + "】");
    if (c.appearance) parts.push("外貌：" + c.appearance);
    if (c.personality) parts.push("性格：" + c.personality);
    if (c.background) parts.push("背景：" + c.background);
    if (c.tags.length > 0) parts.push("标签：" + c.tags.join("、"));
    const relevantArcs = freshArcs.filter((a) => a.characterId === c.id);
    if (relevantArcs.length > 0) {
      parts.push("【经历时间线】");
      relevantArcs.forEach((a) => {
        parts.push("- " + a.event + "：" + a.description);
      });
    }
    parts.push("请以上述角色身份进行对话，保持性格一致性。");
    updateSystemPrompt(activeId, parts.join("\n"));
    onClose();
  };

  const startEditCard = (id: string) => {
    const c = cards.find((x) => x.id === id);
    if (!c) return;
    setEditingId(id);
    setEditName(c.name);
    setEditDesc(c.description);
    setEditPrompt(c.systemPrompt);
    setEditEmoji(c.emoji);
    setEditTags(c.tags.join(", "));
  };

  const saveEditCard = async () => {
    if (!editingId) return;
    if (!editName.trim() || !editPrompt.trim()) return;
    const { updateCard } = useCharacterStore.getState();
    await updateCard(editingId, {
      name: editName.trim(),
      description: editDesc.trim(),
      systemPrompt: editPrompt.trim(),
      emoji: editEmoji.trim() || "🎭",
      tags: editTags.split(",").map((t) => t.trim()).filter(Boolean),
    });
    setEditingId(null);
  };

  const handleDeleteCard = async (id: string) => {
    const c = cards.find((x) => x.id === id);
    if (!c || c.isBuiltin) return;
    const { removeCard } = useCharacterStore.getState();
    await removeCard(id);
    if (editingId === id) setEditingId(null);
  };

  const handleCreateCard = async () => {
    if (!newName.trim() || !newPrompt.trim()) return;
    const { addCard } = useCharacterStore.getState();
    await addCard({
      id: crypto.randomUUID(),
      name: newName.trim(),
      description: newDesc.trim(),
      systemPrompt: newPrompt.trim(),
      emoji: newEmoji.trim() || "🎭",
      tags: newTags.split(",").map((t) => t.trim()).filter(Boolean),
      isBuiltin: false,
    });
    setNewName("");
    setNewDesc("");
    setNewPrompt("");
    setNewEmoji("🎭");
    setNewTags("");
    setShowNewForm(false);
  };

  const handleCreateCharacter = async () => {
    if (!newCharName.trim()) return;
    const { addCharacter } = useCharacterStore.getState();
    await addCharacter({
      id: crypto.randomUUID(),
      name: newCharName.trim(),
      appearance: newCharAppearance.trim(),
      personality: newCharPersonality.trim(),
      background: newCharBackground.trim(),
      tags: newCharTags.split(",").map((t) => t.trim()).filter(Boolean),
      isBuiltin: false,
    });
    setNewCharName("");
    setNewCharAppearance("");
    setNewCharPersonality("");
    setNewCharBackground("");
    setNewCharTags("");
    setShowNewForm(false);
  };

  return (
    <div
      ref={panelRef}
      style={{
        position: "absolute",
        bottom: "calc(100% + 8px)",
        left: 0,
        width: 440,
        maxHeight: 560,
        background: "var(--bg-overlay)",
        border: "1px solid var(--seed-border)",
        borderRadius: 14,
        boxShadow: "0 12px 40px rgba(0,0,0,0.35)",
        backdropFilter: "blur(30px)",
        WebkitBackdropFilter: "blur(30px)",
        zIndex: "var(--z-picker)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div style={{ padding: "12px 14px 8px", borderBottom: "1px solid var(--seed-border)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Users size={14} style={{ color: "var(--seed-accent)" }} />
            <span style={{ fontSize: "var(--fs-13)", fontWeight: 600, color: "var(--seed-fg)" }}>
              角色设定
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
                background: showNewForm ? "var(--seed-accent-bg)" : "transparent",
                color: showNewForm ? "var(--seed-accent)" : "var(--seed-muted)",
                border: showNewForm ? "1px solid var(--seed-accent-border)" : "1px solid var(--seed-border)",
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

        {/* Tabs */}
        <div style={{ display: "flex", gap: 2, marginBottom: 8, background: "var(--seed-input-bg)", borderRadius: 8, padding: 3 }}>
          <button
            onClick={() => { setActiveTab("characters"); setShowNewForm(false); setEditingId(null); }}
            className="cp"
            style={{
              flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
              padding: "5px 10px", borderRadius: 6,
              fontSize: "var(--fs-11)", fontWeight: 500,
              background: activeTab === "characters" ? "var(--seed-accent)" : "transparent",
              color: activeTab === "characters" ? "#fff" : "var(--seed-muted)",
              border: "none", transition: "all 0.15s ease",
            }}
          >
            <User size={12} /> 角色 ({characters.length})
          </button>
          <button
            onClick={() => { setActiveTab("cards"); setShowNewForm(false); setEditingId(null); }}
            className="cp"
            style={{
              flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 4,
              padding: "5px 10px", borderRadius: 6,
              fontSize: "var(--fs-11)", fontWeight: 500,
              background: activeTab === "cards" ? "var(--seed-accent)" : "transparent",
              color: activeTab === "cards" ? "#fff" : "var(--seed-muted)",
              border: "none", transition: "all 0.15s ease",
            }}
          >
            <Sparkles size={12} /> 角色卡 ({cards.length})
          </button>
        </div>

        {/* Search */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 10px", borderRadius: 8, background: "var(--seed-input-bg)", border: "1px solid var(--seed-border)" }}>
          <Users size={11} style={{ color: "var(--seed-muted)", flexShrink: 0 }} />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={activeTab === "characters" ? "搜索角色..." : "搜索角色卡..."}
            style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "var(--seed-fg)", fontSize: "var(--fs-12)", fontFamily: "inherit", minWidth: 0 }}
            onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} className="btn-ghost" style={{ width: 16, height: 16, padding: 0 }}>
              <X size={9} />
            </button>
          )}
        </div>
      </div>

      {/* New form - Characters tab */}
      {showNewForm && activeTab === "characters" && (
        <div style={{ padding: 10, borderBottom: "1px solid var(--seed-border)", background: "var(--seed-surface)", maxHeight: 260, overflowY: "auto" }}>
          <input value={newCharName} onChange={(e) => setNewCharName(e.target.value)} placeholder="角色名称 *"
            style={{ width: "100%", padding: "6px 10px", borderRadius: 6, background: "var(--seed-input-bg)", border: "1px solid var(--seed-border)", color: "var(--seed-fg)", fontSize: "var(--fs-12)", fontFamily: "inherit", marginBottom: 6, outline: "none" }}
          />
          <input value={newCharAppearance} onChange={(e) => setNewCharAppearance(e.target.value)} placeholder="外貌描述"
            style={{ width: "100%", padding: "6px 10px", borderRadius: 6, background: "var(--seed-input-bg)", border: "1px solid var(--seed-border)", color: "var(--seed-fg)", fontSize: "var(--fs-11)", fontFamily: "inherit", marginBottom: 6, outline: "none" }}
          />
          <input value={newCharPersonality} onChange={(e) => setNewCharPersonality(e.target.value)} placeholder="性格特征"
            style={{ width: "100%", padding: "6px 10px", borderRadius: 6, background: "var(--seed-input-bg)", border: "1px solid var(--seed-border)", color: "var(--seed-fg)", fontSize: "var(--fs-11)", fontFamily: "inherit", marginBottom: 6, outline: "none" }}
          />
          <textarea value={newCharBackground} onChange={(e) => setNewCharBackground(e.target.value)} placeholder="背景故事"
            style={{ width: "100%", padding: "8px 10px", borderRadius: 6, background: "var(--seed-input-bg)", border: "1px solid var(--seed-border)", color: "var(--seed-fg)", fontSize: "var(--fs-11)", fontFamily: "inherit", minHeight: 50, resize: "vertical", marginBottom: 6, outline: "none", lineHeight: 1.4 }}
          />
          <input value={newCharTags} onChange={(e) => setNewCharTags(e.target.value)} placeholder="标签（用逗号分隔）"
            style={{ width: "100%", padding: "4px 8px", borderRadius: 6, background: "var(--seed-input-bg)", border: "1px solid var(--seed-border)", color: "var(--seed-fg)", fontSize: "var(--fs-11)", fontFamily: "inherit", marginBottom: 6, outline: "none" }}
          />
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 6 }}>
            <button onClick={() => { setShowNewForm(false); setNewCharName(""); setNewCharAppearance(""); setNewCharPersonality(""); setNewCharBackground(""); setNewCharTags(""); }} className="cp"
              style={{ padding: "5px 12px", borderRadius: 6, fontSize: "var(--fs-11)", color: "var(--seed-muted)", background: "transparent", border: "1px solid var(--seed-border)" }}>
              取消
            </button>
            <button onClick={handleCreateCharacter} disabled={!newCharName.trim()} className="cp"
              style={{ padding: "5px 14px", borderRadius: 6, fontSize: "var(--fs-11)", fontWeight: 500, background: "var(--seed-accent)", color: "#fff", border: "none", opacity: !newCharName.trim() ? 0.5 : 1, cursor: !newCharName.trim() ? "not-allowed" : "pointer" }}>
              创建角色
            </button>
          </div>
        </div>
      )}

      {/* New form - Cards tab */}
      {showNewForm && activeTab === "cards" && (
        <div style={{ padding: 10, borderBottom: "1px solid var(--seed-border)", background: "var(--seed-surface)", maxHeight: 220, overflowY: "auto" }}>
          <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
            <input value={newEmoji} onChange={(e) => setNewEmoji(e.target.value)} placeholder="🎭" maxLength={4}
              style={{ width: 50, padding: "6px 8px", borderRadius: 6, background: "var(--seed-input-bg)", border: "1px solid var(--seed-border)", color: "var(--seed-fg)", fontSize: 18, textAlign: "center", outline: "none" }}
            />
            <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="角色卡名称"
              style={{ flex: 1, padding: "6px 10px", borderRadius: 6, background: "var(--seed-input-bg)", border: "1px solid var(--seed-border)", color: "var(--seed-fg)", fontSize: "var(--fs-12)", fontFamily: "inherit", outline: "none" }}
            />
          </div>
          <input value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="简短描述"
            style={{ width: "100%", padding: "6px 10px", borderRadius: 6, background: "var(--seed-input-bg)", border: "1px solid var(--seed-border)", color: "var(--seed-fg)", fontSize: "var(--fs-11)", fontFamily: "inherit", marginBottom: 6, outline: "none" }}
          />
          <textarea value={newPrompt} onChange={(e) => setNewPrompt(e.target.value)} placeholder="系统提示词（将注入到每条对话开头）"
            style={{ width: "100%", padding: "8px 10px", borderRadius: 6, background: "var(--seed-input-bg)", border: "1px solid var(--seed-border)", color: "var(--seed-fg)", fontSize: "var(--fs-11)", fontFamily: "inherit", minHeight: 50, resize: "vertical", marginBottom: 6, outline: "none", lineHeight: 1.4 }}
          />
          <input value={newTags} onChange={(e) => setNewTags(e.target.value)} placeholder="标签（用逗号分隔）"
            style={{ width: "100%", padding: "4px 8px", borderRadius: 6, background: "var(--seed-input-bg)", border: "1px solid var(--seed-border)", color: "var(--seed-fg)", fontSize: "var(--fs-11)", fontFamily: "inherit", marginBottom: 6, outline: "none" }}
          />
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 6 }}>
            <button onClick={() => { setShowNewForm(false); setNewName(""); setNewDesc(""); setNewPrompt(""); setNewEmoji("🎭"); setNewTags(""); }} className="cp"
              style={{ padding: "5px 12px", borderRadius: 6, fontSize: "var(--fs-11)", color: "var(--seed-muted)", background: "transparent", border: "1px solid var(--seed-border)" }}>
              取消
            </button>
            <button onClick={handleCreateCard} disabled={!newName.trim() || !newPrompt.trim()} className="cp"
              style={{ padding: "5px 14px", borderRadius: 6, fontSize: "var(--fs-11)", fontWeight: 500, background: "var(--seed-accent)", color: "#fff", border: "none", opacity: !newName.trim() || !newPrompt.trim() ? 0.5 : 1, cursor: !newName.trim() || !newPrompt.trim() ? "not-allowed" : "pointer" }}>
              创建
            </button>
          </div>
        </div>
      )}

      {/* Characters grid */}
      {activeTab === "characters" && (
        <div style={{ flex: 1, overflowY: "auto", padding: 8 }}>
          {filteredCharacters.length === 0 && (
            <div style={{ padding: "30px 12px", textAlign: "center", color: "var(--seed-muted)", fontSize: "var(--fs-12)" }}>
              {searchQuery ? "未找到匹配的角色" : "暂无角色，点击右上角新建"}
            </div>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 6 }}>
            {filteredCharacters.map((c) => (
              <div
                key={c.id}
                className="cp"
                style={{
                  padding: 10, borderRadius: 10,
                  background: "transparent", border: "1px solid var(--seed-border)",
                  transition: "all 0.12s ease", cursor: "pointer",
                  display: "flex", flexDirection: "column", gap: 4,
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "var(--seed-hover-bg)"; e.currentTarget.style.borderColor = "var(--seed-accent-border)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = "var(--seed-border)"; }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                    <div style={{ width: 26, height: 26, borderRadius: "50%", background: "var(--seed-accent-bg)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <User size={14} style={{ color: "var(--seed-accent)" }} />
                    </div>
                    <span style={{ fontSize: "var(--fs-12)", fontWeight: 600, color: "var(--seed-fg)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {c.name}
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 2, flexShrink: 0 }}>
                    {c.isBuiltin && (
                      <span style={{ fontSize: "var(--fs-8)", padding: "0 3px", borderRadius: 2, background: "var(--seed-hover-bg)", color: "var(--seed-muted)", fontWeight: 500 }}>
                        内置
                      </span>
                    )}
                  </div>
                </div>
                {c.appearance && (
                  <div style={{ fontSize: "var(--fs-10)", color: "var(--seed-muted)", lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                    <span style={{ color: "var(--seed-muted)", fontWeight: 500 }}>外貌：</span>{c.appearance}
                  </div>
                )}
                {c.personality && (
                  <div style={{ fontSize: "var(--fs-10)", color: "var(--seed-muted)", lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                    <span style={{ color: "var(--seed-muted)", fontWeight: 500 }}>性格：</span>{c.personality}
                  </div>
                )}
                {c.tags.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginTop: 2 }}>
                    {c.tags.slice(0, 3).map((tag) => (
                      <span key={tag} style={{ fontSize: "var(--fs-9)", padding: "1px 5px", borderRadius: 3, background: "var(--seed-accent-bg)", color: "var(--seed-accent)", fontWeight: 500 }}>
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); applyCharacter(c); }}
                  className="cp"
                  style={{
                    marginTop: 4, padding: "4px 8px", borderRadius: 6,
                    fontSize: "var(--fs-10)", fontWeight: 500,
                    background: "var(--seed-accent-bg)", color: "var(--seed-accent)",
                    border: "1px solid var(--seed-accent-border)",
                    width: "100%", textAlign: "center",
                  }}
                >
                  应用到当前会话
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Cards grid */}
      {activeTab === "cards" && (
        <div style={{ flex: 1, overflowY: "auto", padding: 8 }}>
          {filteredCards.length === 0 && (
            <div style={{ padding: "30px 12px", textAlign: "center", color: "var(--seed-muted)", fontSize: "var(--fs-12)" }}>
              {searchQuery ? "未找到匹配的角色卡" : "暂无角色卡"}
            </div>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 6 }}>
            {filteredCards.map((c) => (
              <div
                key={c.id}
                className="cp"
                style={{
                  padding: 10, borderRadius: 10,
                  background: "transparent", border: "1px solid var(--seed-border)",
                  transition: "all 0.12s ease", cursor: "pointer",
                  display: "flex", flexDirection: "column", gap: 4,
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "var(--seed-hover-bg)"; e.currentTarget.style.borderColor = "var(--seed-accent-border)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.borderColor = "var(--seed-border)"; }}
              >
                {editingId === c.id ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <div style={{ display: "flex", gap: 4 }}>
                      <input value={editEmoji} onChange={(e) => setEditEmoji(e.target.value)} maxLength={4}
                        style={{ width: 40, padding: "4px 6px", borderRadius: 5, background: "var(--seed-input-bg)", border: "1px solid var(--seed-accent-border)", color: "var(--seed-fg)", fontSize: 16, textAlign: "center", outline: "none" }}
                      />
                      <input value={editName} onChange={(e) => setEditName(e.target.value)}
                        style={{ flex: 1, padding: "4px 8px", borderRadius: 5, background: "var(--seed-input-bg)", border: "1px solid var(--seed-accent-border)", color: "var(--seed-fg)", fontSize: "var(--fs-12)", fontFamily: "inherit", outline: "none" }}
                      />
                    </div>
                    <input value={editDesc} onChange={(e) => setEditDesc(e.target.value)}
                      style={{ width: "100%", padding: "4px 8px", borderRadius: 5, background: "var(--seed-input-bg)", border: "1px solid var(--seed-accent-border)", color: "var(--seed-fg)", fontSize: "var(--fs-11)", fontFamily: "inherit", outline: "none" }}
                    />
                    <textarea value={editPrompt} onChange={(e) => setEditPrompt(e.target.value)}
                      style={{ width: "100%", padding: "5px 8px", borderRadius: 5, background: "var(--seed-input-bg)", border: "1px solid var(--seed-accent-border)", color: "var(--seed-fg)", fontSize: "var(--fs-11)", fontFamily: "inherit", minHeight: 50, resize: "vertical", outline: "none", lineHeight: 1.4 }}
                    />
                    <input value={editTags} onChange={(e) => setEditTags(e.target.value)}
                      placeholder="标签(逗号分隔)"
                      style={{ width: "100%", padding: "3px 6px", borderRadius: 5, background: "var(--seed-input-bg)", border: "1px solid var(--seed-accent-border)", color: "var(--seed-fg)", fontSize: "var(--fs-10)", fontFamily: "inherit", outline: "none" }}
                    />
                    <div style={{ display: "flex", justifyContent: "flex-end", gap: 4 }}>
                      <button onClick={() => setEditingId(null)} className="cp"
                        style={{ padding: "3px 10px", borderRadius: 5, fontSize: "var(--fs-11)", color: "var(--seed-muted)", background: "transparent", border: "1px solid var(--seed-border)" }}>
                        取消
                      </button>
                      <button onClick={saveEditCard} className="cp"
                        style={{ padding: "3px 10px", borderRadius: 5, fontSize: "var(--fs-11)", fontWeight: 500, background: "var(--seed-accent)", color: "#fff", border: "none", display: "flex", alignItems: "center", gap: 2 }}>
                        <Check size={10} /> 保存
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                        <span style={{ fontSize: 18 }}>{c.emoji}</span>
                        <span style={{ fontSize: "var(--fs-12)", fontWeight: 600, color: "var(--seed-fg)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {c.name}
                        </span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 2, flexShrink: 0 }}>
                        {!c.isBuiltin && (
                          <>
                            <button onClick={(e) => { e.stopPropagation(); startEditCard(c.id); }} className="cp" title="编辑"
                              style={{ width: 20, height: 20, borderRadius: 4, background: "transparent", color: "var(--seed-muted)", border: "none", display: "flex", alignItems: "center", justifyContent: "center" }}
                              onMouseEnter={(e) => { e.currentTarget.style.color = "var(--seed-accent)"; }}
                              onMouseLeave={(e) => { e.currentTarget.style.color = "var(--seed-muted)"; }}>
                              <Edit3 size={9} />
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); handleDeleteCard(c.id); }} className="cp" title="删除"
                              style={{ width: 20, height: 20, borderRadius: 4, background: "transparent", color: "var(--seed-muted)", border: "none", display: "flex", alignItems: "center", justifyContent: "center" }}
                              onMouseEnter={(e) => { e.currentTarget.style.color = "var(--danger);" }}
                              onMouseLeave={(e) => { e.currentTarget.style.color = "var(--seed-muted)"; }}>
                              <Trash2 size={9} />
                            </button>
                          </>
                        )}
                        {c.isBuiltin && (
                          <span style={{ fontSize: "var(--fs-8)", padding: "0 3px", borderRadius: 2, background: "var(--seed-hover-bg)", color: "var(--seed-muted)", fontWeight: 500 }}>
                            内置
                          </span>
                        )}
                      </div>
                    </div>
                    {c.description && (
                      <div style={{ fontSize: "var(--fs-11)", color: "var(--seed-muted)", lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                        {c.description}
                      </div>
                    )}
                    {c.tags.length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 3, marginTop: 2 }}>
                        {c.tags.slice(0, 3).map((tag) => (
                          <span key={tag} style={{ fontSize: "var(--fs-9)", padding: "1px 5px", borderRadius: 3, background: "var(--seed-accent-bg)", color: "var(--seed-accent)", fontWeight: 500 }}>
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); applyCard(c); }}
                      className="cp"
                      style={{
                        marginTop: 4, padding: "4px 8px", borderRadius: 6,
                        fontSize: "var(--fs-10)", fontWeight: 500,
                        background: "var(--seed-accent-bg)", color: "var(--seed-accent)",
                        border: "1px solid var(--seed-accent-border)",
                        width: "100%", textAlign: "center",
                      }}
                    >
                      应用到当前会话
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ padding: "6px 14px", borderTop: "1px solid var(--seed-border)", fontSize: "var(--fs-10)", color: "var(--seed-muted)", textAlign: "center" }}>
        {activeTab === "characters"
          ? "选择角色以注入身份设定到当前会话"
          : "点击角色卡应用到当前会话的系统提示词"}
      </div>
    </div>
  );
}