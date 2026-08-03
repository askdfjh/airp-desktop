import { useState } from "react";
import { ArrowLeft, Check, Plus, Trash2, Save, User, Globe } from "lucide-react";
import { useUIStore } from "@/stores/uiStore";
import { useCreateStore, type CharacterDraft, type WorldDraft, type WorldEntryDraft, type EntryPosition } from "@/stores/createStore";
import { useCharacterStore } from "@/stores/characterStore";
import { useWorldStore } from "@/stores/worldStore";
import { GUIDE_LABEL } from "@/lib/createGuide";
import { AutoTextarea, AutoInput } from "@/lib/autoGrow";

function buildCardPrompt(d: CharacterDraft): string {
  const parts: string[] = [];
  const push = (label: string, v: string) => {
    if (v && v.trim()) parts.push(`${label}：${v.trim()}`);
  };
  push("定位", d.relationships);
  push("外貌", d.appearance);
  push("性格", d.personality);
  push("说话风格", d.speechStyle);
  push("背景", d.background);
  push("目标", d.goals);
  const body = parts.length > 0 ? parts.join("。") + "。" : "暂无详细信息。";
  return `【角色卡·${d.name}】${body}`;
}

const inputStyle: React.CSSProperties = {
  padding: "7px 10px", borderRadius: 8, background: "var(--seed-input-bg)",
  border: "1px solid var(--seed-border)", color: "var(--seed-fg)",
  fontSize: "var(--fs-12)", fontFamily: "inherit", outline: "none", boxSizing: "border-box", width: "100%",
};

const fieldStyle = (extra?: React.CSSProperties): React.CSSProperties => ({ ...inputStyle, ...extra });

export function DraftPreview() {
  const ui = useUIStore();
  // 桌面端避开 40px 自绘标题栏（TitleBar z-index 5000 恒在最上层）
  const isAndroid = typeof navigator !== "undefined" && /Android/i.test(navigator.userAgent);
  const { type, preview, savedDraft, setPreview, setSavedDraft, commitHistory } = useCreateStore();
  const addCard = useCharacterStore((s) => s.addCard);
  const addBook = useWorldStore((s) => s.addBook);
  const addEntry = useWorldStore((s) => s.addEntry);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<CharacterDraft | WorldDraft>(() => {
    if (!preview) {
      return type === "character"
        ? { name: "", emoji: "🎭", tags: [], description: "", appearance: "", personality: "", speechStyle: "", background: "", relationships: "", goals: "", triggerWords: [] }
        : { name: "", theme: "", description: "", tags: [], entries: [] };
    }
    return { ...preview, entries: "entries" in preview ? [...preview.entries] : undefined } as CharacterDraft | WorldDraft;
  });

  const label = GUIDE_LABEL[type];
  const isChar = type === "character";
  const cd = draft as CharacterDraft;
  const wd = draft as WorldDraft;

  const setCD = (patch: Partial<CharacterDraft>) => setDraft({ ...draft, ...patch });
  const setWD = (patch: Partial<WorldDraft>) => setDraft({ ...draft, ...patch });
  const setEntry = (i: number, patch: Partial<WorldEntryDraft>) => {
    const entries = [...wd.entries];
    entries[i] = { ...entries[i], ...patch };
    setWD({ entries });
  };

  const handleSave = async () => {
    if (saving) return;
    if (isChar && !cd.name.trim()) {
      ui.notify("角色名不能为空");
      return;
    }
    if (!isChar && !wd.name.trim()) {
      ui.notify("世界名不能为空");
      return;
    }
    setSaving(true);
    try {
      if (isChar) {
        const name = cd.name.trim();
        const triggerWords = cd.triggerWords.length > 0 ? cd.triggerWords : [name];
        await addCard({
          id: "cc_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8),
          name,
          description: cd.description.trim(),
          systemPrompt: buildCardPrompt(cd),
          emoji: cd.emoji || "🎭",
          tags: cd.tags,
          isBuiltin: false,
          personality: cd.personality,
          scenario: cd.goals,
          worldBookId: null,
          isExtracted: false,
          triggerWords,
        });
        setSavedDraft({ ...cd, name, triggerWords });
        commitHistory("角色：" + name);
        ui.notify(`角色「${name}」已保存到角色卡`);
      } else {
        const name = wd.name.trim();
        const bookId = await addBook({
          name,
          theme: wd.theme.trim(),
          description: wd.description.trim(),
          tags: wd.tags,
          isActive: false,
          isBuiltin: false,
          violationWords: [],
        });
        const entries = wd.entries.filter((e) => e.title.trim() && e.content.trim());
        for (const e of entries) {
          await addEntry(bookId, {
            id: crypto.randomUUID(),
            category: e.category.trim() || "其他",
            title: e.title.trim(),
            key: e.key.length > 0 ? e.key.map((k) => k.trim()).filter(Boolean) : [e.title.trim()],
            content: e.content.trim(),
            constant: false,
            selective: false,
            order: 100,
            position: e.position,
            insertionDepth: 50,
            disable: false,
          });
        }
        setSavedDraft({ ...wd, name, entries });
        commitHistory("世界：" + name);
        ui.notify(`世界「${name}」已保存（${entries.length} 条条目）`);
        // 保存成功 → 自动进入开局流程：选中新世界，跳到视角选择（世界已定），
        // 随后选角色 + 开局场景（自定义世界无预设场景时可选 AI 随机开局）即可开始冒险
        const uiStore = useUIStore.getState();
        uiStore.setCreateMode(null);
        uiStore.setSelectedWorld(bookId, name);
        uiStore.setSelectedMode(null);
        uiStore.setSelectedCharacter(null, null);
        uiStore.setSelectedScenario(null, null);
        uiStore.setPlayerName("");
        uiStore.setAppPhase("onboarding");
        uiStore.setOnboardingStep(2);
        await useWorldStore.getState().setActiveBook(bookId);
      }
      setPreview(null);
    } catch (e) {
      console.error("[create] save failed:", e);
      ui.notify("保存失败，请重试");
    } finally {
      setSaving(false);
    }
  };

  const tagText = (tags: string[]) => tags.join(", ");
  const parseTags = (s: string) => s.split(",").map((t) => t.trim()).filter(Boolean);
  const keysText = (keys: string[]) => keys.join(", ");
  const parseKeys = (s: string) => s.split(",").map((t) => t.trim()).filter(Boolean);

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 210, display: "flex", background: "color-mix(in srgb, var(--seed-bg) 55%, transparent)", backdropFilter: "blur(6px)" }}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", maxWidth: 760, margin: "0 auto", height: isAndroid ? "100%" : "calc(100% - 40px)", marginTop: isAndroid ? 0 : 40, background: "var(--seed-bg)" }}>
        {/* 预览头部 */}
        <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--seed-border)", display: "flex", alignItems: "center", gap: 10 }}>
          <button
            onClick={() => setPreview(null)}
            title="返回继续对话"
            style={{ width: 32, height: 32, borderRadius: 9, border: "none", background: "transparent", color: "var(--seed-muted)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}
          >
            <ArrowLeft size={17} />
          </button>
          <div style={{ width: 30, height: 30, borderRadius: 9, background: "var(--seed-accent)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            {isChar ? <User size={15} style={{ color: "#fff" }} /> : <Globe size={15} style={{ color: "#fff" }} />}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: "var(--fs-13)", fontWeight: 600, color: "var(--seed-fg)" }}>{label}设定预览</div>
            <div style={{ fontSize: "var(--fs-10)", color: "var(--seed-muted)" }}>AI 提炼结果，可编辑后保存</div>
          </div>
          <button
            onClick={() => void handleSave()}
            disabled={saving}
            style={{
              display: "flex", alignItems: "center", gap: 6, padding: "8px 18px", borderRadius: 999,
              border: "none", cursor: saving ? "not-allowed" : "pointer",
              background: "var(--seed-accent)", color: "#fff", fontSize: "var(--fs-12)", fontWeight: 600, fontFamily: "inherit",
              opacity: saving ? 0.6 : 1,
            }}
          >
            <Save size={14} /> {saving ? "保存中..." : "保存"}
          </button>
        </div>

        {/* 预览内容 */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 18px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
          {isChar ? (
            <>
              <div style={{ display: "flex", gap: 8 }}>
                <input value={cd.name} onChange={(e) => setCD({ name: e.target.value })} placeholder="角色名称 *" style={fieldStyle({ flex: 1, fontWeight: 600 })} />
                <AutoInput value={cd.emoji} onChange={(e) => setCD({ emoji: e.target.value })} placeholder="emoji" min={70} max={140} style={fieldStyle({ textAlign: "center" })} />
              </div>
              <AutoInput value={tagText(cd.tags)} onChange={(e) => setCD({ tags: parseTags(e.target.value) })} placeholder="标签（逗号分隔）" min={200} max={520} style={fieldStyle()} />
              <AutoInput value={cd.triggerWords.join(", ")} onChange={(e) => setCD({ triggerWords: parseKeys(e.target.value) })} placeholder="出场触发词（逗号分隔，默认=角色名）" min={200} max={520} style={fieldStyle()} />
              <AutoTextarea value={cd.appearance} onChange={(e) => setCD({ appearance: e.target.value })} placeholder="外貌特征" style={fieldStyle({ minHeight: 44 })} maxHeight={200} />
              <AutoTextarea value={cd.personality} onChange={(e) => setCD({ personality: e.target.value })} placeholder="性格特点" style={fieldStyle({ minHeight: 44 })} maxHeight={200} />
              <AutoTextarea value={cd.speechStyle} onChange={(e) => setCD({ speechStyle: e.target.value })} placeholder="说话风格" style={fieldStyle({ minHeight: 44 })} maxHeight={200} />
              <AutoTextarea value={cd.background} onChange={(e) => setCD({ background: e.target.value })} placeholder="背景来历" style={fieldStyle({ minHeight: 44 })} maxHeight={200} />
              <AutoTextarea value={cd.relationships} onChange={(e) => setCD({ relationships: e.target.value })} placeholder="与主角/其他人的关系" style={fieldStyle({ minHeight: 44 })} maxHeight={200} />
              <AutoTextarea value={cd.goals} onChange={(e) => setCD({ goals: e.target.value })} placeholder="目标与欲望" style={fieldStyle({ minHeight: 44 })} maxHeight={200} />
            </>
          ) : (
            <>
              <div style={{ display: "flex", gap: 8 }}>
                <input value={wd.name} onChange={(e) => setWD({ name: e.target.value })} placeholder="世界名称 *" style={fieldStyle({ flex: 1, fontWeight: 600 })} />
                <AutoInput value={wd.theme} onChange={(e) => setWD({ theme: e.target.value })} placeholder="题材基调" min={90} max={200} style={fieldStyle()} />
              </div>
              <AutoInput value={tagText(wd.tags)} onChange={(e) => setWD({ tags: parseTags(e.target.value) })} placeholder="标签（逗号分隔）" min={200} max={520} style={fieldStyle()} />
              <AutoTextarea value={wd.description} onChange={(e) => setWD({ description: e.target.value })} placeholder="一句话简介" style={fieldStyle({ minHeight: 44 })} maxHeight={200} />

              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
                <span style={{ fontSize: "var(--fs-12)", fontWeight: 600, color: "var(--seed-fg)" }}>世界条目（{wd.entries.length}）</span>
                <div style={{ flex: 1 }} />
                <button
                  onClick={() => setWD({ entries: [...wd.entries, { category: "其他", title: "", key: [], content: "", position: "system", status: "new" }] })}
                  style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 12px", borderRadius: 999, border: "1px solid color-mix(in srgb, var(--seed-accent) 40%, transparent)", background: "var(--seed-accent-bg)", color: "var(--seed-accent)", fontSize: "var(--fs-10)", fontFamily: "inherit", cursor: "pointer" }}
                >
                  <Plus size={11} /> 添加条目
                </button>
              </div>

              {wd.entries.map((e, i) => (
                <div key={i} style={{
                  padding: 12, borderRadius: 12, display: "flex", flexDirection: "column", gap: 8,
                  background: "var(--seed-surface)",
                  border: "1px solid " + (e.status === "new" ? "var(--success)" : e.status === "changed" ? "var(--warning)" : "var(--seed-border)"),
                }}>
                  {(e.status === "new" || e.status === "changed") && (
                    <div style={{ display: "flex", gap: 6 }}>
                      <span style={{ fontSize: "var(--fs-9)", padding: "1px 7px", borderRadius: 999, background: e.status === "new" ? "var(--success-bg)" : "var(--warning-bg)", color: e.status === "new" ? "var(--success)" : "var(--warning)" }}>
                        {e.status === "new" ? "新增" : "修改"}
                      </span>
                    </div>
                  )}
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <input value={e.title} onChange={(ev) => setEntry(i, { title: ev.target.value })} placeholder="条目标题 *" style={fieldStyle({ flex: 1, minWidth: 140 })} />
                    <AutoInput value={e.category} onChange={(ev) => setEntry(i, { category: ev.target.value })} placeholder="分类" min={70} max={150} style={fieldStyle()} />
                    <select value={e.position} onChange={(ev) => setEntry(i, { position: ev.target.value as EntryPosition })}
                      style={{ ...fieldStyle({ width: 110 }), cursor: "pointer" }}>
                      <option value="system">System</option>
                      <option value="situation">Situation</option>
                      <option value="last">Last</option>
                    </select>
                    <button onClick={() => setWD({ entries: wd.entries.filter((_, j) => j !== i) })} title="删除条目"
                      style={{ width: 30, height: 30, borderRadius: 8, border: "none", background: "transparent", color: "var(--danger)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0 }}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                  <AutoInput value={keysText(e.key)} onChange={(ev) => setEntry(i, { key: parseKeys(ev.target.value) })} placeholder="触发关键词（逗号分隔，默认=标题）" min={200} max={520} style={fieldStyle({ fontSize: "var(--fs-11)" })} />
                  <AutoTextarea value={e.content} onChange={(ev) => setEntry(i, { content: ev.target.value })} placeholder="条目内容（对话中出现关键词时注入）" style={fieldStyle({ minHeight: 60, fontSize: "var(--fs-11)" })} maxHeight={240} />
                </div>
              ))}
              {wd.entries.length === 0 && (
                <div style={{ padding: "20px 12px", textAlign: "center", color: "var(--seed-muted)", fontSize: "var(--fs-11)", background: "var(--seed-surface)", borderRadius: 12, border: "1px dashed var(--seed-border)" }}>
                  没有提取到条目。可以返回对话补充规则描述后重新生成，或手动添加条目。
                </div>
              )}
            </>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 4 }}>
            <button onClick={() => setPreview(null)} style={{ padding: "8px 16px", borderRadius: 999, border: "1px solid var(--seed-border)", background: "transparent", color: "var(--seed-muted)", fontSize: "var(--fs-11)", fontFamily: "inherit", cursor: "pointer" }}>
              返回继续对话
            </button>
            <button onClick={() => void handleSave()} disabled={saving}
              style={{ display: "flex", alignItems: "center", gap: 5, padding: "8px 20px", borderRadius: 999, border: "none", cursor: saving ? "not-allowed" : "pointer", background: "var(--seed-accent)", color: "#fff", fontSize: "var(--fs-11)", fontWeight: 600, fontFamily: "inherit", opacity: saving ? 0.6 : 1 }}>
              <Check size={13} /> {saving ? "保存中..." : `保存${label}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
