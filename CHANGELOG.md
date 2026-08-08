# 更新日志

## 2026-08-08

### 界面动画体系

- 七大界面接入统一动画体系（纯 CSS + useAnimatedVisibility，只动 transform/opacity）：会话管理弹窗、搜索弹窗、世界信息浮层、确认框、新建故事、二级菜单、侧边栏；设置页 tab 切换增加过渡动画。
- 浮层动画 `transform-origin: bottom center`，从按钮方向展开而非中心缩放。
- 清理 FunctionBar 废弃的 `chipRect` 状态。

### 文字排版（原「文本格式切换」）

- 空白会话新增独立「文字排版」开关（`formatEnabled`）：仅启用格式分析（章节分隔线），**不注入世界书/角色卡/文风、不触发上下文压缩**；可双向切换。
- 「新建冒险/冒险会话」统一改名「新故事」。
- 空白会话开启文字排版后，正文改用叙述排版（无气泡框、pre-wrap 分段、行高 1.75、段间距更大），与冒险会话一致；重新生成/编辑发送的正文同样生效。
- 场景信息条、对话推荐条仅冒险会话显示；空白文字排版会话只保留章节分隔线。
- 修复：空白会话开启文字排版后章节名不更新（isBlank 拦截）的问题。

### 思考过程展示（规划中）

- 「规划中」指示器下方新增迷你思考窗口：小字低对比、不显眼，实时显示思考过程，防止误以为卡住。
- 思考过程使用与正文一致的打字机动效（StreamingText 固定快速步长：每帧 2 字，积压大时 3/6 字），既平滑又跟得上上游按句到达的数据。
- 迷你窗口与主对话滚动容器在思考阶段逐帧即时滚底，始终显示最新内容。
- 思考完成后思考区自动收起，消息卡显示「规划完成」按钮，点击可展开回看完整思考过程（流式中显示「规划中」）。

### Markdown 增强

- 重新启用 raw HTML 渲染（rehype-raw），支持模型输出 `<details>/<summary>` 折叠块（带样式：圆角卡片 + ▸ 箭头旋转）。
- 注意：2026-08-03 曾为降低外部内容污染风险关闭 raw HTML；本轮按需求恢复以支持折叠块，请留意粘贴外部内容时的渲染行为。

### 场景分析修复

- 修复思考型模型（如 deepseek-v4-flash 经中转）场景分析返回空的问题：输出走 reasoning_content 通道时，content 为空则收集 thinking 作为分析结果。
- 场景分析失败（模型未返回内容）已可在日志中定位（useChat.runSceneAnalysis / sceneAnalyze）。

### 安卓

- 安卓工程重新生成（gen/android 被 .gitignore 忽略，不入库）；APK 构建只含 arm64 架构（812MB → 216MB），避免超大安装包在 OPPO/ColorOS 上安装失败（-99）。
- 图标：用项目图标重新生成全套安卓 mipmap（tauri icon）。
- 签名提示：debug 签名使用本机 `~/.android/debug.keystore`；换机/重装后签名会变，覆盖安装需先卸载旧版（旧版数据会清空）。正式发布需自备 keystore，且 keystore 不入库（fork 可伪造签名）。

## 2026-08-03

### 修复与安全收紧

- 修复 `package.json` UTF-8 BOM 导致 Vite 构建失败。
- 修复 `generationStore` persist 迁移的 TypeScript 阻断错误。
- 为 web_search / MCP 工具调用增加最多 3 轮的循环保护，避免无限调用和持续扣费。
- 关闭 Markdown raw HTML 渲染，降低外部内容污染风险。
- 启用 Tauri CSP，收紧 WebView 内容加载边界。
- 收窄 Tauri 文件系统权限范围。
- 移除 HTTP Cookie 片段和完整 URL 的敏感日志输出。
- 修复 CSS 乱码导致的未闭合字符串 warning。
- 修复窗口关闭监听未释放问题。
- 修复 favorites 外键 `NOT NULL` 与 `ON DELETE SET NULL` 的冲突。
- Android release 默认不再误用 debug keystore；本地临时测试需显式开启。

### 设置与合规提示

- 新增设置页「关于」入口。
- 增加软件本体免费说明、第三方服务可能收费说明和中国法律风险提示。
- 为联网搜索、MCP、WebDAV 云备份增加轻量合规提醒。

### 验证

- `tsc --noEmit` ✅
- `vite build` ✅
- `cargo check` ✅
- Android `assembleDebug` ✅

> Android 正式发布仍需配置正式 release keystore。当前生成的 Android 工程位于 `src-tauri/gen/android`，重新初始化 Android 工程后需要重新应用签名配置。
