const fs = require("fs");
const path = "C:/Users/OOTD/airp-desktop/src/components/Settings/ProviderConfig.tsx";
let content = fs.readFileSync(path, "utf8");

const part1 = fs.readFileSync("C:/Users/OOTD/airp-desktop/temp_new_modal_part1.txt", "utf8");
const part2 = fs.readFileSync("C:/Users/OOTD/airp-desktop/temp_new_modal_part2.txt", "utf8");
const part3 = fs.readFileSync("C:/Users/OOTD/airp-desktop/temp_new_modal_part3.txt", "utf8");
const newModal = part1 + part2 + part3;

const startMarker = "      {/* Fetched Models Modal */}";
const startIdx = content.indexOf(startMarker);
if (startIdx === -1) { console.log("ERROR: start marker not found"); process.exit(1); }

const afterStart = content.substring(startIdx);
const endPattern = /\r\n      \)}\r\n    <\/div>/;
const endMatch = afterStart.match(endPattern);
if (!endMatch) { console.log("ERROR: end pattern not found"); process.exit(1); }
const endIdx = startIdx + endMatch.index;

console.log("Replacing from", startIdx, "to", endIdx);
console.log("Old section length:", endIdx - startIdx);
console.log("New modal length:", newModal.length);

const before = content.substring(0, startIdx);
const after = content.substring(endIdx);
const result = before + newModal + after;

fs.writeFileSync(path, result, "utf8");
console.log("Done! New file length:", result.length);

// Cleanup temp files
try { fs.unlinkSync("C:/Users/OOTD/airp-desktop/temp_new_modal_part1.txt"); } catch(e) {}
try { fs.unlinkSync("C:/Users/OOTD/airp-desktop/temp_new_modal_part2.txt"); } catch(e) {}
try { fs.unlinkSync("C:/Users/OOTD/airp-desktop/temp_new_modal_part3.txt"); } catch(e) {}
try { fs.unlinkSync("C:/Users/OOTD/airp-desktop/temp_script_part1.cjs"); } catch(e) {}
try { fs.unlinkSync("C:/Users/OOTD/airp-desktop/temp_script_part2.cjs"); } catch(e) {}
try { fs.unlinkSync("C:/Users/OOTD/airp-desktop/temp_script_part3.cjs"); } catch(e) {}
try { fs.unlinkSync("C:/Users/OOTD/airp-desktop/temp_script.js"); } catch(e) {}
console.log("Temp files cleaned up");
