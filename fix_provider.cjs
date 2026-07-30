const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'components', 'Settings', 'ProviderConfig.tsx');
let content = fs.readFileSync(filePath, 'utf-8');

const lines = content.split(/\r?\n/);

// Find the line index of "for (const type of PRESET_ORDER) {"
let presetLoopStart = -1;
let presetLoopEnd = -1;
let searchQueryLine = -1;

for (let i = 0; i < lines.length; i++) {
  const trimmed = lines[i].trim();
  if (presetLoopStart === -1 && trimmed === 'for (const type of PRESET_ORDER) {') {
    presetLoopStart = i;
  }
  if (presetLoopStart !== -1 && presetLoopEnd === -1 && trimmed === '}' && i > presetLoopStart) {
    // Check if this closes the for loop (next non-empty line is blank then if (searchQuery))
    // Actually we need to find the matching closing brace. Let's use a simpler approach:
    // The loop ends with a '}' at an indentation level of 4 spaces
    if (lines[i] === '    }' && i > presetLoopStart + 5) {
      presetLoopEnd = i;
      break;
    }
  }
}

// Find "if (searchQuery) {" after presetLoopEnd
for (let i = presetLoopEnd + 1; i < lines.length; i++) {
  if (lines[i].trim().startsWith('if (searchQuery)')) {
    searchQueryLine = i;
    break;
  }
}

console.log('presetLoopStart:', presetLoopStart, 'presetLoopEnd:', presetLoopEnd, 'searchQueryLine:', searchQueryLine);

// Insert custom provider code between presetLoopEnd and searchQueryLine
const customCode = [
  '',
  '    const customProviders = providers.filter((p) => p.type === \'custom\');',
  '    for (const cp of customProviders) {',
  '      items.push({',
  '        key: `provider-${cp.id}`,',
  '        type: \'custom\',',
  '        displayName: cp.name,',
  '        provider: cp,',
  '        isAdded: true,',
  '      });',
  '    }',
  '',
];

const newLines = [
  ...lines.slice(0, presetLoopEnd + 1),
  ...customCode,
  ...lines.slice(searchQueryLine),
];

const newContent = newLines.join('\r\n');
fs.writeFileSync(filePath, newContent, 'utf-8');
console.log('File updated successfully.');