const fs = require("fs");
const path = "C:/Users/OOTD/airp-desktop/src/components/Settings/ProviderConfig.tsx";
let content = fs.readFileSync(path, "utf8");

// The issue: newModal ends with "      )" and after content starts with "      )}"
// This creates: ) followed by )} which is redundant
// Fix: Change the newModal last line from ")" to ")}" and adjust end pattern
// We need to change: "      )\r\n      )}" -> "      )}\r\n    </div>"

// Let's find the exact pattern and fix it
// Pattern: overlay </div>, then ) from newModal, then )} from after
const oldPattern = /<\/div>\r\n      \)\r\n      \)}\r\n    <\/div>/;
const newPattern = "<\/div>\r\n      )}\r\n    <\/div>";

if (oldPattern.test(content)) {
  content = content.replace(oldPattern, newPattern);
  fs.writeFileSync(path, content, "utf8");
  console.log("Fix applied: merged ) and )} into )}");
} else {
  console.log("Pattern not found, let me check the actual ending...");
  // Find the ending around line 1243-1245
  const lines = content.split("\r\n");
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === "</div>" && lines[i].startsWith("        ") &&
        lines[i+1] === "      )" && lines[i+2] === "      )}" && lines[i+3] === "    </div>") {
      console.log("Found at line", i+1);
      lines.splice(i+1, 1, "      )}");
      content = lines.join("\r\n");
      fs.writeFileSync(path, content, "utf8");
      console.log("Fix applied: removed extra )");
      break;
    }
  }
}
