# NOTICE — 第三方依赖致谢

本项目（灵叙 Narra / AIRP）使用了以下开源软件与库，在此致谢。各依赖的完整许可证文本以各项目发布版本为准。

## 前端依赖

| 依赖 | 用途 | 许可证 |
|---|---|---|
| React / React DOM | UI 框架 | MIT |
| TypeScript | 类型系统 | Apache-2.0 |
| Vite | 构建工具 | MIT |
| Zustand | 状态管理 | MIT |
| react-markdown / remark-gfm / rehype-raw / rehype-highlight | Markdown 渲染 | MIT |
| Lucide React | 图标库 | ISC |
| @tauri-apps/api | Tauri 前端 API | MIT / Apache-2.0 |
| @tauri-apps/plugin-dialog / fs / shell / sql | Tauri 插件 | MIT / Apache-2.0 |

## 后端依赖（Rust）

| 依赖 | 用途 | 许可证 |
|---|---|---|
| Tauri 2 / tauri-build | 应用框架 | MIT / Apache-2.0 |
| tauri-plugin-dialog / fs / shell / sql | Tauri 插件 | MIT / Apache-2.0 |
| serde / serde_json | 序列化 | MIT / Apache-2.0 |
| reqwest | HTTP 客户端 | MIT / Apache-2.0 |
| url | URL 解析 | MIT / Apache-2.0 |

## 其他

- SQLite（通过 tauri-plugin-sql 集成）：Public Domain
- 系统字体引用（如 PingFang / Microsoft YaHei / JetBrains Mono）：仅在 CSS 中按名称引用，不随项目分发字体文件

若您认为本项目遗漏了对某依赖的署名要求，请联系作者更正。
