const fs = require("fs");
const path = "C:/Users/OOTD/airp-desktop/src/components/Settings/ProviderConfig.tsx";
let content = fs.readFileSync(path, "utf8");

// Fix: missing )} closing the IIFE before the body div closes
// The pattern is: groups div closing (14 spaces) followed by body div closing (12 spaces)
// We need to insert )} at 14 spaces between them
const fixPattern = /(\r\n              <\/div>\r\n)(            <\/div>\r\n          <\/div>\r\n        <\/div>\r\n      )/;
const fixMatch = content.match(fixPattern);
if (fixMatch) {
  content = content.replace(fixPattern, "$1            )}" + "\r\n" + "$2");
  fs.writeFileSync(path, content, "utf8");
  console.log("Fix applied: inserted missing )} line");
} else {
  console.log("Pattern not found, trying alternative...");
  // Try finding the exact location
  const lines = content.split("\r\n");
  for (let i = 0; i < lines.length - 2; i++) {
    if (lines[i].trim() === "</div>" && lines[i].startsWith("              ") &&
        lines[i+1].trim() === "</div>" && lines[i+1].startsWith("            ") &&
        lines[i+2].trim() === "</div>" && lines[i+2].startsWith("          ")) {
      console.log("Found at line", i+1, ":", JSON.stringify(lines[i]), JSON.stringify(lines[i+1]));
      lines.splice(i+1, 0, "            )}");
      content = lines.join("\r\n");
      fs.writeFileSync(path, content, "utf8");
      console.log("Fix applied: inserted missing )} at line", i+2);
      break;
    }
  }
}
