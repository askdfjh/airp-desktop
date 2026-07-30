const fs = require('fs');
const filePath = 'C:\\Users\\OOTD\\airp-desktop\\src\\components\\Settings\\ProviderConfig.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// === 改动 1: Add Pencil to lucide-react imports ===
content = content.replace(
  /Wifi, Loader2, Code2, Filter, Image, Cog, ChevronRight,/m,
  'Wifi, Loader2, Code2, Filter, Image, Cog, ChevronRight, Pencil,'
);

// === 改动 2: Remove AddPresetButton bottom area (lines ~509-512) ===
content = content.replace(
  /\r?\n\s*\/\* Bottom: Add custom \*\/\r?\n\s*<div style=\{\{ padding: '8px', borderTop: '1px solid var\(--border-subtle\)' \}\}>\r?\n\s*<AddPresetButton onAdd=\{addPreset\} \/>\r?\n\s*<\/div>/,
  ''
);

// === 改动 3: Delete AddPresetButton function (lines ~567-584) ===
content = content.replace(
  /\r?\nfunction AddPresetButton\(\{ onAdd \}: \{ onAdd: \(type: ProviderType\) => void \}\) \{[\s\S]*?\n\}/,
  ''
);

// === 改动 5: Update empty state text ===
content = content.replace(
  /<p style=\{\{ fontSize: 'var\(--fs-11\)', marginTop: 6, opacity: 0\.6 \}\}>或点击左侧预设添加新 Provider<\/p>/,
  '<p style={{ fontSize: \'var(--fs-11)\', marginTop: 6, opacity: 0.6 }}>点击列表项即可添加或选择</p>'
);

// === 改动 4: ProviderDetail name editing ===

// 4a: Add editingName and nameDraft states after the existing hooks in ProviderDetail
// Find the line with "const enabled = enabledProviders[p.id] ?? true;" and add after it
content = content.replace(
  /(const enabled = enabledProviders\[p\.id\] \?\? true;)/,
  `$1

  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState('');`
);

// 4b: Replace the header name display with editable version
// The current name display in header:
//           <div>
//             <div style={{ fontSize: 'var(--fs-15)', fontWeight: 600, color: 'var(--text-primary)' }}>{p.name}</div>
//           </div>
content = content.replace(
  /<div style=\{\{ fontSize: 'var\(--fs-15\)', fontWeight: 600, color: 'var\(--text-primary\)' \}\}>\{p\.name\}<\/div>/,
  `{editingName ? (
            <input
              autoFocus
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const trimmed = nameDraft.trim();
                  updateProvider(p.id, { name: trimmed || p.name });
                  setEditingName(false);
                } else if (e.key === 'Escape') {
                  setEditingName(false);
                }
              }}
              style={{
                fontSize: 'var(--fs-15)', fontWeight: 600, color: 'var(--text-primary)',
                background: 'var(--bg-input)', border: '1px solid var(--border-light)',
                borderRadius: 10, padding: '4px 10px', width: 200, outline: 'none',
              }}
            />
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ fontSize: 'var(--fs-15)', fontWeight: 600, color: 'var(--text-primary)' }}>{p.name}</div>
              <button
                onClick={() => { setNameDraft(p.name); setEditingName(true); }}
                style={{
                  width: 20, height: 20, borderRadius: 4, border: 'none', cursor: 'pointer',
                  background: 'var(--bg-elevated)', color: 'var(--text-muted)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'color 0.15s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--accent)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; }}
                title="编辑名称"
              >
                <Pencil size={11} />
              </button>
            </div>
          )}`
);

// 4c: Add useEffect for mousedown listener in ProviderDetail
// We add it right before the "return" statement of ProviderDetail, after "const previewUrl = ..." line
content = content.replace(
  /(\s+const previewUrl = p\.baseUrl \? `\$\{p\.baseUrl\.replace\(\/\\\/\+\$\/, ''\)\}\/chat\/completions` : '';)/,
  `$1

  useEffect(() => {
    if (!editingName) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('input') || target.value !== undefined) {
        const trimmed = nameDraft.trim();
        updateProvider(p.id, { name: trimmed || p.name });
        setEditingName(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [editingName, nameDraft, p.id, updateProvider]);`
);

fs.writeFileSync(filePath, content, 'utf8');
console.log('All changes applied successfully.');