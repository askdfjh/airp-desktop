# 灵叙 Narra · vdnight 提交报告

> 提交方向：`vdnight89:vdnight` → `askdfjh:master`  
> 对应 PR：https://github.com/askdfjh/airp-desktop/pull/2  
> 当前桌面版本：**0.3.2**  
> 相对上游 `master`：约 27 个提交，94 个文件，+6809 / −400 行

本文汇总本线相对上游做了哪些产品改动、动了哪些模块、加了什么、修了什么。原则没变：**不抄书源**；家是书架，书是故事，对话是书的内部，作品是导出层。

---

## 1. 这一条线在改什么

上游 `master` 仍是「会话 / 对话优先」：打开应用容易直接进当前聊天。  
`vdnight`（由已删除的 `APP` 并入）改成 **故事优先**：

| 之前 | 之后 |
|---|---|
| 冷启动进对话或自动建空白会话 | 冷启动进书架，不偷建会话 |
| 会话列表像聊天软件 | 一本书 = 一整条故事（含续卷） |
| 世界书是全局激活本 | 规则书按故事绑定，切书不串世界 |
| 导出像聊天记录 | 可导出干净正文 |

空白稿纸也是书，只是分组叫「稿纸」，避免两套首页。

仓库只保留 `master` 与 `vdnight`。安装包不入库，哈希写在 README。

---

## 2. 按模块：改了什么

### 2.1 领域与数据

| 文件 | 作用 |
|---|---|
| `src/types/index.ts` | 增加 `Story`：状态、规则书、文风、主角、题材、世界底座、字数、置顶、简介等 |
| `src/lib/db.ts` | `stories` 表、一次性迁移、软删 / 恢复 / 过期清理、会话挂 `storyId` |
| `src/lib/storyMigrate.ts` | 旧会话升到「一书一卷」 |
| `src/stores/storyStore.ts` | 故事的打开、新建、续写、取名、置顶、完结、删除、回书架 |
| `src/stores/sessionStore.ts` | 会话从属于故事；思考默认关；删除书时清掉该书会话 |
| `src/stores/uiStore.ts` | `appPhase`：`bookshelf` / `reading` / `onboarding` |
| `src/lib/settingsBackup.ts` | 备份分组加入故事 / 书架 |

### 2.2 导航与壳

| 文件 | 作用 |
|---|---|
| `src/components/Layout/AppShell.tsx` | 按 `appPhase` 切书架 / 阅读 / 开局；联网只在库里显式为开时才开 |
| `src/components/Layout/WelcomeScreen.tsx` | 欢迎文案改为创作工具，可跳过到书架，不再写「进入对话」 |
| `src/hooks/useDesktopHotkeys.ts` | 桌面：`Esc` 分层返回，`Ctrl+N` 新故事，`Ctrl+F` 搜书架，`Ctrl+,` 设置 |
| `src/components/Layout/TitleBar.tsx`（沿用） | 桌面自绘 40px 标题栏，内容区让开 |

### 2.3 书架

新建 `src/components/Bookshelf/`：

- **Bookshelf**：网格 / 列表，分组（全部 / 在写 / 完结 / 稿纸），搜索，排序，继续阅读条，FAB，回收站
- **BookCard / BookCover**：题材插画封面，毛玻璃竖排书名，长按 / 右键菜单
- **BookDetail**：改名、简介、完结、删除、导出、取书名、同世界再开一本、名册、卷次
- **VolumeSheet**：本书卷次

### 2.4 开局

| 文件 | 作用 |
|---|---|
| `src/components/Onboarding/OnboardingFlow.tsx` | 入口只从书架来；完成时创建故事 + 首卷并写入绑定；思考默认关 |
| `src/components/Onboarding/TopicSelect.tsx` | 题材卡铺插画；修高 DPI 下卡片被压成细条 |
| `src/components/Onboarding/WorldSelect.tsx` | 世界底座与开局场景衔接 |

三步仍是：题材 → 世界 / 文风 → 主角与开局场景。另有「同世界再开一本」「随机开局」。

### 2.5 书内阅读

| 文件 | 作用 |
|---|---|
| `src/components/Chat/DialogueNovel.tsx` | 回书架、点书名进详情、章节目录、场景条、「上次写到」、空态文案、删除后不留空阅读页 |
| `src/components/Chat/ChapterSheet.tsx` | 章节目录，点击滚到对应段 |
| `src/components/Chat/ReaderSettings.tsx` | 纸色、夜间、字体、字号行距等，按书记住 |
| `src/components/Chat/FunctionBar.tsx` | 思考默认关；启用模型即切当前；冒险不再露出「文字排版」开关 |
| `src/lib/readerPrefs.ts` | 阅读偏好读写 |

### 2.6 生成、场景、书名

| 文件 | 作用 |
|---|---|
| `src/hooks/useChat.ts` | 正文单独输出；生成后场景分析；剥作者备忘再入库；先计字再取名 |
| `src/lib/sceneAnalyzer.ts` | 独立请求出章节名 / 场景 / 推荐；思考通道也能收结果 |
| `src/lib/sceneTemplate.ts` | 解析旧模板标签；`stripDraftNotes` 去掉伏笔 / 新钩子 / 等下要加 |
| `src/lib/storyTitle.ts` | 占位名自动取网文风书名；抠书名号与 JSON；空白稿无正文不取名 |
| `src/lib/characterExtract.ts` | 书详情「从正文整理」名册 |
| `src/components/Settings/ProviderConfig.tsx` | 启用模型后 `setActiveProvider` + `setActiveModel` |

### 2.7 导出与作品层

| 文件 | 作用 |
|---|---|
| `src/lib/storyExport.ts` | 干净 TXT：去开局指令、去模板标签、按章节 / 卷；默认可不含玩家行动 |

### 2.8 视觉与资源

- `src/assets/art/`：欢迎、空书架、稿纸、十余种世界 / 题材插画
- `src/lib/worldArt.ts`、`src/lib/storyCover.ts`：封面与底座配色
- `src/components/icons/NarraIcon.tsx`：书架用线标
- `src-tauri/icons/`：启动器图标换成墨色标识
- `src/index.css`：书架、封面、桌面宽屏、阅读纸面、详情分栏

### 2.9 桌面壳与开发回路

| 文件 | 作用 |
|---|---|
| `src-tauri/tauri.conf.json` | 无边框窗口默认 1320×860 |
| `scripts/dev-desktop.ps1` | 带 Cargo/Rustup 路径启动 `tauri:dev` |
| `.grok/workflows/desktop-dev-loop.rhai` | 桌面 Detect → Static → Live → Fix → Ship |
| `docs/app/desktop-dev-loop.md` | Live 必须用真窗口，禁止 `Start-Process` 启动 |

旧 APP 双回路已退役，只留桌面回路。

### 2.10 文档与校验

- `docs/app/product-spec.md`、`bookshelf-design.md`、`designs/01–12`
- `README.md`、`CHANGELOG.md`、`AGENTS.md` 主线改为 `vdnight`
- `scripts/test-core.mjs`、`scripts/test-story-title.mjs`：书名、场景推荐、导出、作者备忘剥离

---

## 3. 新增能力（相对上游用户能看见的）

1. **书架首页**：冷启动进书架；空态「写下第一个故事」；有书后右下角加号。
2. **书即故事**：一本书带规则书、文风、主角、题材、世界；续卷仍是同一本。
3. **书架管理**：分组、搜索、排序、置顶、完结、回收站恢复 / 清除。
4. **继续阅读条**：封面小图 + 书名 + 卷次。
5. **开局只从书架进**：取消回书架；写完创建故事 + 首卷。
6. **同世界再开一本**：预填规则书与题材，不冲旧书。
7. **书内现场**：场景条、点选对话推荐即发送、章节目录、再入提示「上次写到」。
8. **阅读排版**：纸色 / 夜间 / 字体 / 字号行距，按书记住。
9. **自动取书名**：占位名用模型或本地书名库；空白空稿保持「未命名稿纸」。
10. **书详情 + 名册**：点书名进入；「从正文整理」抽出场角色。
11. **导出 TXT**：干净叙述；可选保留玩家行动。
12. **桌面宽屏**：标题栏不压内容；书架多列；正文居中；详情左右栏；快捷键。
13. **水墨插画与新图标**：开局、封面、欢迎、空态。

---

## 4. 优化与修复

### 交互与默认

- 思考、联网默认关，避免一上来就开推理 / 外联。
- 设置里点启用模型，底栏马上变成该模型，不再第一次发送报「未选择模型」。
- 欢迎页可跳过到书架，文案不再像聊天软件。
- 推荐条可直接点发出，不必再按发送。
- 「上次写到」只在重开已有正文时出现，排在场景条下，约 8 秒或发送后消失。
- 重开已写过开局的书，不再闪「规则书生成中 / 完成规划」。
- 删掉正在读的书，回到书架，不留空白阅读页。
- 桌面书详情不再多让 40px，阅读顶栏不会露出来。

### 生成质量

- 书名只抠真正书名，思考模型的推理句不当书名。
- 模型失败或超时：按题材 + 主角从本地库取封面式书名，不再报取名失败。
- 正文剥掉「伏笔」「新钩子」「等下要加」「加个细节」和收尾 markdown 标题。
- 场景分析走独立请求；思考通道空 `content` 时也能解析。
- 切书只用本书绑定的规则书，不回落到上一本。

### 版面与性能观感

- 高 DPI 下开局题材卡不再被压成细条。
- 封面毛玻璃上竖排书名，长名折列，不另铺笺纸。
- 流式正文与迷你思考窗逐帧滚底，减少「卡住」感。

---

## 5. 版本与交付

| 版本 | 内容 |
|---|---|
| 0.2.x（APP） | 故事模型、书架、封面、取名、导出、阅读设置、插画 |
| 0.3.0 | 桌面宽屏壳、vdnight 铺开 |
| 0.3.1 | 欢迎文案、开发回路、安装包哈希 |
| **0.3.2** | 真窗口全功能复测后的默认值、现场条、备忘剥离、删除回书架 |

桌面安装包（不入库，哈希见 README）：

| 文件 | SHA-256 |
|---|---|
| `Narra_0.3.2_x64-setup.exe` | `B41035C00DE70AB293DA9F207744585DF9CF202280C4A678C775A2CB2DC775C0` |
| `Narra_0.3.2_x64_zh-CN.msi` | `E8422501623C9148ACB9FB4F55A8BBC8BCD1ED4057A7A7A4E92DE4940213A062` |

本轮未打安卓 APK。安卓资源仍须重编 `.so`（`generate_context!` 嵌入），只换 assets 无效。

校验：`npx tsc --noEmit`、`node scripts/test-core.mjs`、桌面真窗口走通开局 / 书内 / 详情 / 书架 / 设置。

---

## 6. 明确没做、也不进本 PR

- 书源、发现页、换源、读别人的网文
- EPUB / AI 长文整理导出
- 自定义书架分组（仍是四个固定 Tab）
- 冷启动「直接打开上次那本书」（规格里默认关）
- 改上游 GitHub Releases / 网盘渠道
- 密钥、`releases/` 安装包本体、安卓 `gen/` 工程

---

## 7. 给审查的读法

若只看产品：先 README「这一版（0.3.2）你能做什么」，再本报告第 3、4 节。  
若只看代码：`storyStore` + `Bookshelf/` + `DialogueNovel` + `storyTitle` + `storyExport`。  
若只看 0.3.2 修补：`CHANGELOG` 2026-08-17 一节。
