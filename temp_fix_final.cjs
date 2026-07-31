const fs = require("fs");
const path = "C:/Users/OOTD/airp-desktop/src/components/Settings/ProviderConfig.tsx";
let content = fs.readFileSync(path, "utf8");
const lines = content.split("\r\n");

// Find the line with "                );"" that is the return closing inside models.map
// This should be followed by })} (models.map closing), then </div>, )}, </div>, );, })}, etc.
// We need to find the correct starting point and replace everything from there

// Let's find the last few lines before the damage
// Line with Trash2's parent </div>
let startLine = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes("<Trash2 size={10} />") && 
      lines[i+1] && lines[i+1].trim() === "</button>" &&
      lines[i+2] && lines[i+2].trim() === "</div>") {
    // The </div> at i+2 is the end of the model item div
    // The next line should be ); to close the return
    startLine = i + 3; // Start from the ); line
    console.log("Found start at line", startLine + 1);
    break;
  }
}

if (startLine === -1) { console.log("ERROR: cannot find start"); process.exit(1); }

// The correct replacement from startLine should be:
const correct = [
  "                );",
  "                })}",
  "                </div>",
  "                )}",
  "                </div>",
  "                );",
  "                })}",
  "              </div>",
  "            );",
  "            })()}",
  "            </div>",
  "          </div>",
  "        </div>",
  "      )}",
  "    </div>",
  "  );",
  "}"
];

// Find the end: look for the closing of ProviderDetail function
let endLine = -1;
for (let i = startLine; i < lines.length; i++) {
  if (lines[i].trim() === "}" && lines[i+1] && lines[i+1].trim().startsWith("function ")) {
    endLine = i;
    console.log("Found end at line", endLine + 1);
    break;
  }
}

if (endLine === -1) { console.log("ERROR: cannot find end"); process.exit(1); }

console.log("Replacing lines", startLine + 1, "to", endLine + 1);
console.log("Current lines:");
for (let i = startLine; i <= endLine; i++) {
  console.log("  " + (i+1) + ": " + JSON.stringify(lines[i]));
}

// Replace
const before = lines.slice(0, startLine);
const after = lines.slice(endLine + 1);
const result = [...before, ...correct, ...after];

const newContent = result.join("\r\n");
fs.writeFileSync(path, newContent, "utf8");
console.log("Fix applied. New file length:", newContent.length);
