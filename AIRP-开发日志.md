# AIRP 开发日志

## 2026-07-29

### 新增：上下文用量圆环指示器

输入框模板库按钮右侧新增 SVG 圆环，实时显示当前上下文 token 用量（默认上限 128K）：
- **<70%**：accent 色，圈内显示百分比
- **70%-90%**：橙色警告，圈内显示百分比
- **≥90%**：红色 + 圈内百分比变红

token 估算方式：`Math.ceil(text.length / 2)`，覆盖消息内容 + thinking + systemPrompt。

**改动文件**：
- `src/components/Chat/MessageInput.tsx`：新增 `ContextRing` 组件，接收 `contextTokens` prop
- `src/components/Chat/ChatPane.tsx`：`useMemo` 计算上下文 token 总量并传递给 MessageInput

### 决策：推理模式参数错误暂不处理

当 `thinkingEnabled` 为 true 时，API 请求会附带 `thinking: { type: "enabled" }` 参数。大多数 OpenAI 兼容 API 会忽略不认识的参数，正常返回；少数严格 API 可能返回 400 错误。

**决策**：暂不添加自动重试逻辑（检测到 thinking 相关错误时关闭 thinking 重试）。等实际报错再处理。

### 优化：推理模式自动检测（全面覆盖）

根据 2024-2025 年主流推理模型全面扩展 `isThinkingModel` 模式匹配：

- **OpenAI**：o1/o3/o4 系列
- **Anthropic**：Claude 3.7/4/4.5 Sonnet/Opus
- **Google**：Gemini 2.5/3 系列
- **DeepSeek**：R1/V3.1/V3.2/V4 系列
- **阿里 Qwen**：QwQ/QVQ/Qwen3 全系列
- **Moonshot Kimi**：K2/K3 系列
- **智谱 GLM**：GLM-4.5/4.7/5 系列
- **MiniMax**：M2/M3 系列
- **xAI Grok**：Grok 3/4 系列
- **小米 MiMo**
- **字节豆包**：doubao-pro-thinking/doubao-1.5-pro

**改动文件**：
- `src/providers/openai.ts`：重写 `THINKING_MODEL_PATTERNS` 覆盖全部主流推理模型

### 新增：清空所有对话功能

侧边栏底部新增「清空所有对话」按钮（红色 `#ef4444`，与删除按钮颜色一致），点击弹出确认框，确认后删除所有对话和消息。仅在存在对话时显示。确认框在 AppShell 层渲染，避免侧边栏 backdrop-filter 导致的层级问题。

**改动文件**：
- `src/lib/db.ts`：新增 `deleteAllSessions()` 函数
- `src/stores/sessionStore.ts`：新增 `removeAll` 方法
- `src/components/Sidebar/SessionList.tsx`：新增清空按钮，接收 `onRemoveAllRequest` 回调
- `src/components/Layout/AppShell.tsx`：管理清空确认状态，渲染确认对话框

### 优化：推理模式自动检测（扩展）

扩展 `isThinkingModel` 模式匹配，新增 `deepseek`、`claude-3-7`、`claude-3.7`、`gemini-2.5`、`grok-3` 等关键词，覆盖主流推理模型。新建对话和切换模型时自动判断并默认开启。

**改动文件**：
- `src/providers/openai.ts`：扩展 `THINKING_MODEL_PATTERNS` 匹配列表

### 优化：推理模式自动检测

不再需要手动在设置中标记模型为「思考模型」，新建对话和切换模型时根据模型名称自动判断（匹配 `reasoner`/`thinking`/`qwq`/`o1`/`o3`/`o4` 等模式），支持推理则默认开启。

**改动文件**：
- `src/providers/openai.ts`：新增 `isThinkingModel()` 自动检测函数
- `src/components/Chat/ChatPane.tsx`：新建会话使用 `isThinkingModel` 判断
- `src/components/Chat/MessageInput.tsx`：切换模型使用 `isThinkingModel` 判断
- `src/components/Sidebar/SessionList.tsx`：新建会话使用 `isThinkingModel` 判断

### 修复：侧边栏新建会话未自动开启推理模式

侧边栏新建会话按钮 `thinkingEnabled` 硬编码为 `false`，与 ChatPane 欢迎页新建会话逻辑不一致。改为检查当前模型是否在 `thinkingModels` 列表中，支持则自动开启。

**改动文件**：
- `src/components/Sidebar/SessionList.tsx`：新建会话时根据模型能力自动判断是否开启推理模式

### 新增：消息删除确认对话框

对话中点击单条消息的删除按钮时弹出确认框，防止误删。

**改动文件**：
- `src/components/Chat/ChatPane.tsx`：引入 `ConfirmDialog`，消息删除前显示确认框，确认后执行删除

### 修复：删除对话确认框不显示

**问题**：在 SessionList 中渲染 ConfirmDialog，但侧边栏有 `backdrop-filter: blur(30px)` 创建了新的 CSS stacking context，导致 `position: fixed; z-index: 50` 的对话框被限制在侧边栏层级内无法显示。用户点击删除后，对话框不可见，但删除操作已执行，造成"连消息也一起删除了"的假象（实际是正常的删除行为，只是没有确认步骤）。

**修复**：
- 将删除确认逻辑移到 AppShell 层渲染（与退出确认一致）
- SessionList 通过 `onDeleteRequest` 回调通知父组件
- AppShell 管理 `deleteTarget` 状态并渲染 ConfirmDialog

**改动文件**：
- `src/components/Layout/AppShell.tsx`：新增 `deleteTarget` 状态，渲染删除确认对话框，传递 `onDeleteRequest` 给 SessionList
- `src/components/Sidebar/SessionList.tsx`：接收 `onDeleteRequest` prop，移除本地确认逻辑和 ConfirmDialog 渲染

### 清理：删除占位功能和死代码

**删除内容**：
- `MessageInput.tsx`：移除未使用的 `Mic`/`AtSign`/`Code` 导入，删除无功能的 `@提及` 和 `代码块` 按钮
- `ProviderConfig.tsx`：删除 15 个占位导航 tab（常规/显示/数据/技能/搜索/记忆/API/频道/定时/文档/短语/快捷键/助手/划词/关于）及 `PlaceholderSection` 组件
- `ChatPane.tsx`：删除「更多设置即将推出」占位文字
- `main.rs`：删除未使用的 `greet` 命令及 `invoke_handler`
- 删除 6 个一次性 Python 脚本（`_gen.py`、`_write_store.py`、`rewrite_chatpane.py`、`fix_db.py`、`fix_provider.py`、`make_shortcut.py`）
- 删除 `src/index.css.bak` 备份文件
- 删除约 40 个 `build*.log`/`b*.log`/`b*.err` 构建日志

**改动文件**：
- `src/components/Chat/MessageInput.tsx`：清理导入和死按钮
- `src/components/Chat/ChatPane.tsx`：删除占位文字
- `src/components/Settings/ProviderConfig.tsx`：精简导航仅保留模型服务/角色/MCP 三个 tab，删除 12 个未使用的图标导入
- `src-tauri/src/main.rs`：删除 greet 命令
- 根目录：删除 1 个 bak + 6 个 py 脚本 + ~40 个构建日志

### 修复：首次打开白天主题顶栏仍为黑色

**根因**：Zustand persist 异步恢复，store 初始默认值为 `"dark"`。首帧渲染时 `eff` 初始 `useState("dark")`，导致立即调用 `setTheme("dark")` 设置原生窗口标题栏为暗色。即使后续 rehydration 恢复为 `"light"` 后再次调用 `setTheme("light")`，Tauri 标题栏也不一定重绘（系统主题切换存在延迟/缓存），只有切到其他窗口再切回来才触发重绘。

**修复**：`AppShell.tsx` 中 `eff` 的初始值改为从 `localStorage` 同步读取持久化的主题配置，在 useState 初始化阶段就直接拿到正确的主题，保证首帧渲染和第一个 `useEffect` 中的 `setTheme()` 调用即使用正确的值，避免先暗后亮的跳变。

**改动文件**：
- `src/components/Layout/AppShell.tsx`：`useState` 初始值改为惰性函数从 `localStorage` 读取 `airp-ui-v2` 持久化值

### 修复：退出确认无响应

**根因**：Tauri v2 中 `Window.destroy()` 需要独立权限 `core:window:allow-destroy`，与 `allow-close` 是两个不同的权限。之前只配了 `allow-close`，`destroy()` 调用被权限系统静默拒绝。

**修复**：capabilities 中追加 `core:window:allow-destroy`。

**改动文件**：
- `src-tauri/capabilities/default.json`：追加 `core:window:allow-destroy`

### 新增：角色系统（Character System）

**功能说明**：在设置中新增独立的「角色」入口，支持创建完整角色档案（外貌、性格、背景、标签），并在对话中直接调用。角色基础属性跨对话持久保存，经历时间线按世界/会话上下文独立管理。

**核心架构**：
- **Character（角色档案）**：角色的基础属性，永久保存
- **CharacterArc（经历时间线）**：角色在特定世界/会话中的动态经历，按 worldContext 分类
- **SessionCharacter（会话绑定）**：角色与会话的绑定关系

**实现方式**：
1. 新建三张 SQLite 表：characters、character_arcs、session_characters
2. 扩展 Zustand characterStore，支持新模型的 CRUD 和经历管理
3. 新增 CharacterPanel 组件（设置 → 角色），提供角色管理 UI
4. 重构 CharacterCardPicker，整合「角色」和「角色卡」双标签页
5. 应用角色到会话时，自动从角色档案+经历时间线构建 system prompt

**改动文件**：
- src/types/index.ts：新增 Character、CharacterArc、SessionCharacter 接口
- src/lib/db.ts：新增三张表的建表语句及 CRUD 函数
- src/stores/characterStore.ts：重构为双模型管理（旧 CharacterCard + 新 Character）
- src/components/Settings/CharacterPanel.tsx（新建）：角色管理 UI
- src/components/Settings/CharacterCardPicker.tsx：双标签整合
- src/components/Settings/ProviderConfig.tsx：左侧导航新增「角色」入口

### 新增：思考模式自动开启

**功能说明**：支持思考模式（thinking）的模型可被标记为「思考模型」，新建会话或切换到该模型时自动开启思考模式。

**实现方式**：
1. ProviderConfig 新增 	hinkingModels 字段，存储每个 provider 下支持思考的模型列表
2. 设置面板的模型列表中，每个模型旁新增 🧠 切换按钮
3. 预设中 deepseek-reasoner 自动标记为思考模型
4. 新建会话时检查当前模型是否在 	hinkingModels 中，是则自动开启
5. 切换模型时实时同步思考模式状态（支持 → 开，不支持 → 关）

**改动文件**：
- src/types/index.ts：ProviderConfig 新增 thinkingModels 字段
- src/components/Settings/ProviderConfig.tsx：PRESETS 配置思考模型 + 模型列表 UI 新增思考支持切换
- src/stores/sessionStore.ts：updateSessionModel 支持 thinkingSupported 参数，新增 setThinkingEnabled 方法
- src/components/Chat/ChatPane.tsx：新建会话时根据模型能力自动开启思考
- src/components/Chat/MessageInput.tsx：切换模型时自动同步思考模式

### 新增：世界观系统（World Rules）

参照角色系统模式，新增世界观（世界规则）功能，用于定义整个对话世界的底层规则（物理法则、社会背景、禁忌事项等）。

**实现内容**：
1. ✅ `types/index.ts`：新增 `WorldRule` 接口（id、name、description、rules、isActive、isBuiltin、createdAt、updatedAt）
2. ✅ `db.ts`：新增 `world_rules` 表、完整 CRUD 函数 + `deactivateAllWorldRules` + `initBuiltinWorldRules`（预置「现实世界」）
3. ✅ `worldStore.ts`（新建）：Zustand store，管理规则列表、活跃规则、CRUD、切换活跃状态
4. ✅ `WorldPanel.tsx`（新建）：设置面板 UI，左侧列表右侧详情，支持新建/编辑/删除/切换活跃
5. ✅ ProviderConfig 导航：新增「世界」tab（`Globe` 图标，排在「角色」之后）
6. ✅ 自动注入：ChatPane 欢迎页和 SessionList 新建会话时，将 `activeRule.rules` 注入 `systemPrompt`
7. ✅ AppShell 启动初始化：追加 `loadWorldRules` 到 init 链

**设计要点**：
- 与角色系统架构一致：独立的数据库表 + Zustand store + 设置面板
- 预置默认世界「现实世界」：`isBuiltin = true, isActive = true`，不可编辑/删除
- 同一时间只有一个活跃世界（`isActive = true`），切换时自动将原活跃世界设为 false
- 新建会话时自动读取活跃世界的 `rules` 字段，拼接至系统提示词末尾

**改动文件**：
- `src/types/index.ts`：新增 WorldRule 接口
- `src/lib/db.ts`：world_rules 表建表 + CRUD 函数
- `src/stores/worldStore.ts`：新建，Zustand store
- `src/components/Settings/WorldPanel.tsx`：新建，设置面板
- `src/components/Settings/ProviderConfig.tsx`：导航新增「世界」tab
- `src/components/Chat/ChatPane.tsx`：新会话注入世界规则
- `src/components/Sidebar/SessionList.tsx`：新会话注入世界规则
- `src/components/Layout/AppShell.tsx`：启动时加载世界规则

### 重构：世界/角色编辑改为二级 UI（弹窗）

世界观和角色的编辑从行内编辑改为 `EditDialog` 模态弹窗，与对话消息编辑方式保持一致。

**改动文件**：
- `src/components/Layout/EditDialog.tsx`：新建，通用编辑弹出层组件
- `src/components/Settings/WorldPanel.tsx`：使用 EditDialog 替代行内编辑
- `src/components/Settings/CharacterPanel.tsx`：使用 EditDialog 替代行内编辑

### 新增：内置联网搜索功能

不依赖 MCP，客户端内置多搜索引擎支持：
- DuckDuckGo 免费搜索（默认，无需 API Key）
- Serper / Bing / Brave / Tavily 四种付费 API 可选
- 设置面板「工具」tab 配置搜索引擎和 API Key
- `web_search` 工具注册到 AI 工具调用管道，支持流式 tool_calls

**改动文件**：
- `src/tools/search.ts`：新建，多搜索引擎实现
- `src/tools/builtinTools.ts`：注册 `web_search` 工具定义
- `src/components/Settings/ToolsPanel.tsx`：新建，搜索设置面板
- `src/providers/openai.ts`：`chatStream` 支持 `tools` 参数和 tool_calls 解析
- `src/hooks/useChat.ts`：工具调用循环（检测 tool_calls → 执行 → 回传 → 二次请求）
- `src/lib/db.ts`：`app_settings` 键值表持久化搜索偏好

### 新增：MCP 工具集成

MCP 服务器暴露的工具已接入 AI 工具调用管道，与内置搜索并行执行：
- `mcpStore.getActiveToolDefs()` 暴露启用的 MCP 服务器工具
- `useChat.collectTools()` 合并内置 + MCP 工具
- `executeTool()` 路由 `web_search` → 内置，`serverId:toolName` → MCP
- `mcp-search-server.cjs`：本地 MCP 搜索 HTTP 服务（Node.js，端口 3456）

**改动文件**：
- `src/stores/mcpStore.ts`：新增 `getActiveToolDefs()`，`fetchTools` 自动拉取工具列表
- `src/hooks/useChat.ts`：`collectTools()` 合并内置 + MCP
- `mcp-search-server.cjs`：新建，本地 MCP 搜索服务器

### 优化：对话底栏按钮 UI 统一

思考/联网/MCP 三个开关按钮统一样式：
- 默认仅显示图标，hover 时显示文字
- 启用时 accent 色高亮 + 描边
- MCP 开关新增 `mcpStore.mcpEnabled` 全局状态
- MCP 不启用时不注入工具定义
- 对话顶栏不再显示 MCP 信息

**改动文件**：
- `src/components/Chat/MessageInput.tsx`：新增 MCP 开关，三个按钮统一样式
- `src/stores/mcpStore.ts`：新增 `mcpEnabled` + `setMcpEnabled`
- `src/hooks/useChat.ts`：`collectTools()` 检查 `mcpEnabled`
- `src/components/Chat/ChatPane.tsx`：移除顶栏 MCP 显示

### 修复：MCP 开关状态不同步 + 按钮样式不一致

**问题**：
1. MCP 设置中点关闭（禁用），但状态灯仍是绿色「已连接」，刷新后又跳回绿色
2. MCP 按钮（Server 图标）多了一个 `opacity` 样式，与思考/联网按钮不一致
3. 对话框 MCP 开关和设置面板状态不同步（`mcpEnabled` 与 `activeServerIds` 两个独立概念）

**修复**：
- `toggleActive(false)` 同时设置 `server.status = "disconnected"`（灰色灯）
- `toggleActive(true)` 自动 health check 设状态为 green/red
- 刷新（`handleTest`）只在服务器已启用时更新状态，已禁用时仅显示临时结果（3 秒消失）
- 去掉 `mcpEnabled`，对话框 MCP 开关直接读写 `activeServerIds`，天然同步
- 移除 MCP 按钮多余 `opacity`，三个开关样式完全一致

**改动文件**：
- `src/stores/mcpStore.ts`：移除 `mcpEnabled` + `setMcpEnabled`
- `src/components/Settings/McpPanel.tsx`：toggleActive 控制状态，handleTest 不改状态
- `src/components/Chat/MessageInput.tsx`：MCP 开关使用 `activeServerIds` 状态
- `src/hooks/useChat.ts`：`collectTools()` 直接检查 `activeServerIds`

### 新增：Rust HTTP 代理命令（修复搜索 CORS）

**问题**：DuckDuckGo 的 HTML 搜索端点不返回 CORS 头，Tauri WebView 阻止了 `fetch()` 请求，报 "Failed to fetch"。

**修复**：在 Rust 端添加 `http_fetch` Tauri 命令，使用 `reqwest` 发起 HTTP 请求，绕过 WebView CORS 限制。

**改动文件**：
- `src-tauri/Cargo.toml`：新增 `reqwest` 依赖
- `src-tauri/src/main.rs`：新增 `http_fetch` 异步命令 + `invoke_handler` 注册
- `src/tools/search.ts`：DuckDuckGo 搜索优先走 Tauri invoke，回退到 fetch

### 优化：工具调用消息 UI 区分

工具调用和工具返回消息不再混在对话气泡中，改为独立代码块风格：
- 🔧 Wrench 图标 + 标签（"工具调用"/"工具返回"）
- 灰底 + 等宽字体 + 小字号
- 与用户/AI 正文气泡视觉区隔

**改动文件**：
- `src/components/Chat/MessageBubble.tsx`：检测 `isToolCall`/`isToolResult` 独立渲染

### 修复：DuckDuckGo 搜索未解析到结果

**问题**：全部搜索返回「未找到相关结果」，HTML 正则未能匹配 DuckDuckGo 返回的页面结构。

**修复**：改为以 `lite.duckduckgo.com/lite/` 为主搜索端点（极简表格 HTML，结构十年未变），`html.duckduckgo.com/html/` 为回退。

**改动文件**：
- `src/tools/search.ts`：重写 `searchDuckDuckGo`，优先 Lite 版解析

### 修复：编辑并发送后未清空后续消息

**问题**：编辑用户消息点击「保存并发送」后，只删除了下一条 assistant 消息，工具调用/工具返回/后续对话仍保留。

**修复**：编辑时删除该用户消息之后的所有消息（含工具调用、工具返回、后续回答），并同步从 DB 删除。

**改动文件**：
- `src/hooks/useChat.ts`：`editAndSend` 改为 `prev.slice(0, idx + 1)` + 遍历删除 DB 记录
