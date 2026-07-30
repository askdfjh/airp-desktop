const fs = require("fs");
const path = "C:/Users/OOTD/airp-desktop/src/components/Settings/ProviderConfig.tsx";
let content = fs.readFileSync(path, "utf8");

// Fix: line 1238 should be })} not )}
// The IIFE closing needs } to close the body, ) to close the call, } to close the JSX expression
// Current pattern: </div>\r\n            )}\r\n            </div>
// Should be: </div>\r\n            })}\r\n            </div>
const old = "</div>\r\n            )}\r\n            </div>\r\n          </div>\r\n        </div>\r\n      )\r\n      )}";
const newCode = "</div>\r\n            })}\r\n            </div>\r\n          </div>\r\n        </div>\r\n      )\r\n      )}";

if (content.includes(old)) {
  content = content.replace(old, newCode);
  fs.writeFileSync(path, content, "utf8");
  console.log("Fix applied: changed )} to })} for IIFE closing");
} else {
  console.log("Exact pattern not found, trying line-based fix...");
  const lines = content.split("\r\n");
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === "</div>" && lines[i].startsWith("              ") &&
        lines[i+1] === "            )}" &&
        lines[i+2].trim() === "</div>" && lines[i+2].startsWith("            ")) {
      console.log("Found at line", i+1);
      lines[i+1] = "            })}";
      content = lines.join("\r\n");
      fs.writeFileSync(path, content, "utf8");
      console.log("Fix applied: changed )} to })} at line", i+2);
      break;
    }
  }
}
