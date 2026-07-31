const fs = require("fs");
const path = "C:/Users/OOTD/airp-desktop/src/components/Settings/ProviderConfig.tsx";
let content = fs.readFileSync(path, "utf8");

const lines = content.split("\r\n");

// First, revert line 940 (now might be at different position)
for (let i = 0; i < lines.length; i++) {
  if (lines[i].trim() === "})()}" && lines[i].startsWith("                ")) {
    console.log("Reverting line", i+1, ":", JSON.stringify(lines[i]));
    lines[i] = "                })}";
  }
}

// Then fix the IIFE closing (12-space indent)
for (let i = 0; i < lines.length; i++) {
  if (lines[i].trim() === "})}" && lines[i].startsWith("            ") &&
      lines[i+1] && lines[i+1].trim() === "</div>" && lines[i+1].startsWith("            ")) {
    console.log("Fixing line", i+1, ":", JSON.stringify(lines[i]));
    lines[i] = "            })()}";
  }
}

content = lines.join("\r\n");
fs.writeFileSync(path, content, "utf8");
console.log("Done");
