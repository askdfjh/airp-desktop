const fs = require("fs");
const path = "C:/Users/OOTD/airp-desktop/src/components/Settings/ProviderConfig.tsx";
let content = fs.readFileSync(path, "utf8");

// Fix: insert ); between groups div closing and IIFE closing
// Pattern: </div>\r\n            })}\r\n            </div>
// Should be: </div>\r\n            );\r\n            })}\r\n            </div>
const lines = content.split("\r\n");
for (let i = 0; i < lines.length - 2; i++) {
  if (lines[i].trim() === "</div>" && lines[i].startsWith("              ") &&
      lines[i+1] === "            })}\r" || lines[i+1] === "            })}") {
    // Check if the next line after i+1 is the body div closing
    if (lines[i+2] && lines[i+2].trim() === "</div>" && lines[i+2].startsWith("            ")) {
      console.log("Found at line", i+1, ":", JSON.stringify(lines[i]), JSON.stringify(lines[i+1]));
      // Insert ); after line i (which is the groups div closing)
      lines.splice(i+1, 0, "            );");
      content = lines.join("\r\n");
      fs.writeFileSync(path, content, "utf8");
      console.log("Fix applied: inserted ); at line", i+2);
      break;
    }
  }
}
