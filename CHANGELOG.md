# 更新日志

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
