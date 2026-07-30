const fs = require('fs');
const path = 'C:/Users/OOTD/airp-desktop/src/components/Settings/ProviderConfig.tsx';
let content = fs.readFileSync(path, 'utf8');

const startMarker = '      {/* Fetched Models Modal */}';
const startIdx = content.indexOf(startMarker);
if (startIdx === -1) { console.log('ERROR: start marker not found'); process.exit(1); }

const afterStart = content.substring(startIdx);
const endPattern = /\r\n      \)}\r\n    <\/div>/;
const endMatch = afterStart.match(endPattern);
if (!endMatch) { console.log('ERROR: end pattern not found'); process.exit(1); }
const endIdx = startIdx + endMatch.index;

const newModal = fs.readFileSync('C:/Users/OOTD/airp-desktop/temp_new_modal.txt', 'utf8');

const before = content.substring(0, startIdx);
const after = content.substring(endIdx);
const result = before + newModal + after;

fs.writeFileSync(path, result, 'utf8');
console.log('Done! New length:', result.length);
