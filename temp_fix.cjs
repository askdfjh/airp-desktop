const fs = require("fs");
const path = "C:/Users/OOTD/airp-desktop/src/components/Settings/ProviderConfig.tsx";
let content = fs.readFileSync(path, "utf8");

// Add modalSearch state
content = content.replace(
  /const \[showFetchModal, setShowFetchModal\] = useState\(false\);/,
  'const [showFetchModal, setShowFetchModal] = useState(false);\r\n  const [modalSearch, setModalSearch] = useState("");'
);

// Add filteredFetched useMemo
content = content.replace(
  /const modelGroups = useMemo\(\(\) => groupModels\(p\.models\), \[p\.models\]\);/,
  'const modelGroups = useMemo(() => groupModels(p.models), [p.models]);\r\n\r\n  const filteredFetched = useMemo(() => {\r\n    if (!modalSearch) return fetched;\r\n    const q = modalSearch.toLowerCase();\r\n    return fetched.filter((m) => m.toLowerCase().includes(q));\r\n  }, [fetched, modalSearch]);'
);

fs.writeFileSync(path, content, "utf8");

// Verify
const verify = fs.readFileSync(path, "utf8");
const hasModalSearch = verify.includes("const [modalSearch, setModalSearch]");
const hasFilteredFetched = verify.includes("const filteredFetched = useMemo");
console.log("modalSearch added:", hasModalSearch);
console.log("filteredFetched added:", hasFilteredFetched);
console.log("Done!");
