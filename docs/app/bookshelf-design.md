# 灵叙 APP：书架与故事空间

> 分支：`vdnight`（`APP` 已并入）  
> 日期：2026-08-15（概念稿；现行实现跟 `vdnight`）  
> 状态：概念稿（仍有效）  
> 扩展规格与优先级：[`product-spec.md`](./product-spec.md)  
> 分块设计：[`designs/`](./designs/)

本文是 APP 阶段的第一份产品与技术方案。实现以 **product-spec + designs** 为准；本文保留问题陈述与legado对照。目标不是给现有「会话列表」换皮，而是把应用从 **对话优先** 改成 **故事优先**：书架是家，故事是一本可进出、可切换、可再开、可整理成文字作品的书。

---

## 1. 问题

当前产品在第一次走完开局后，用户会被锁进「当前对话」。

证据：

| 现象 | 代码事实 |
|---|---|
| 启动后有会话就进对话 | `AppShell`：`setAppPhase(finalActiveId ? "dialogue" : "onboarding")` |
| 对话是唯一主界面 | `appPhase` 只有 `onboarding \| dialogue`，没有家 |
| 侧栏默认不显示 | 注释写明「传统 Sidebar 默认不显示」 |
| 「新故事」藏得很深 | `FunctionBar` → 会话管理弹窗 → 底部按钮 / adventure tab |
| 安卓返回 = 退出应用 | `androidBack` 消费完浮层后两次返回 `exit_app`，不会回到故事列表 |
| 开局退出有会话就回对话 | `handleOnboardingExit`：有 `activeId` 则 `setAppPhase("dialogue")` |
| 规则书是全局一份 | `world_books.isActive` + `useWorldStore.activeBook`；`useChat` 只读这份 |
| 故事链存在但不当「一本书」 | `chainId / chainIndex / parentId` 只在会话弹窗里分组 |

结果：用户体感是「装完选了一次流程，就没法再开新故事」。功能其实有，但不是第一公民，安卓上几乎等于没有。

空白会话也会在无会话时被自动创建（`createBlankSession`），进一步把「家」占成一个无名聊天。

---

## 2. 目标与非目标

### 2.1 必须做到（P0）

1. **书架是 APP 首页。** 冷启动默认到书架，而不是直接掉进上次对话。
2. **一本故事 = 一张书卡。** 点进去续写，返回键 / 明确「回书架」退出到书架，不退出应用。
3. **随时新建。** 书架上有固定入口：新故事（走开局）、空白稿。开局可取消，取消回书架。
4. **随时切换。** 在故事 A 里回书架，点故事 B，B 的规则书 / 文风 / 卷次正确恢复。
5. **旧数据不丢。** 现有会话按链聚合成书，空白会话变成「稿纸」。

### 2.2 第一期就要埋好、第二期做满（P1）

- 书的管理：重命名、置顶、分组、删除（进回收站）、封面。
- 故事详情：封面、简介、卷次、最近章节、字数。

### 2.3 明确延伸、不要和 P0 绑死（P2+）

- 把对话整理成可读的文字作品（TXT / 后续 EPUB）。
- AI 润色：去玩家指令痕迹、统一人称、补章节名、写简介。
- 完结标记、再开分支（已有 `branchFromMessage`）在详情页露出。

### 2.4 非目标

- 不抄阅读的书源 / 发现 / RSS / 网页抓取。灵叙写的是自己的故事，不是读别人的网文。
- 不把桌面改成另一套信息架构。桌面与 APP **共用同一套「书架 → 书内」**，桌面只是更宽。
- 不在 P0 做社交、云书架、多人共写。
- 不删 SQLite 会话模型。书是会话链的上层聚合，不是推倒重来。

---

## 3. 参考 legado-E，取什么、不取什么

[阅读 Sigma / legado-E](https://github.com/Luoyacheng/legado-E) 继承自 gedoor/legado。它的家是书架，不是阅读器。

### 3.1 要学的交互骨架

| 阅读 | 灵叙对应 |
|---|---|
| 打开 App = 书架 | 打开 App = 故事书架 |
| 网格 / 列表切换 | 同样提供，默认网格（手机），桌面可默认列表 |
| 封面 + 书名 + 作者/进度 | 封面 + 书名 + 最近章节 / 卷次 / 更新时间 |
| 分组（全部 / 自定义） | 全部 · 在写 · 完结 · 稿纸 · 稍后可自定义 |
| 长按管理：置顶、移动分组、删除、详情 | 同样：置顶、分组、删除、详情、导出 |
| 点封面进阅读，返回回书架 | 点封面进续写，返回回书架 |
| 继续阅读入口 | 书架顶或底有「继续上次」 |
| 排序：最近阅读 / 更新 / 书名 | 最近打开 / 最近更新 / 书名 / 创建时间 |
| 搜索书架 | 搜书名、主角、题材 |
| 空书架有「添加」主按钮 | 空书架主按钮「写下第一个故事」 |

### 3.2 不要学的

- 书源、搜索源、发现页、订阅源。
- 在线目录抓取、缓存章节、换源。
- 本地扫描 TXT/EPUB 当书库（导出是我们向外，不是向内当阅读器）。
- 复杂阅读主题引擎（字体/背景/翻页仿真）。灵叙书内仍是现有小说对话排版。

原则：**书架交互学阅读，书的内容模型仍是灵叙的故事链。**

---

## 4. 核心概念

用户语言里「故事」必须是稳定名词。开发语言里对齐如下。

```
Story（书 / 故事）
  └── Volume（卷）= 现有 Session
        普通一卷，或压缩后续集（chainIndex > 1）
        └── Message（回合 / 章节素材）
```

| 用户看到的 | 系统对象 | 说明 |
|---|---|---|
| 一本故事 | `Story` | 书架上一张卡。跨卷稳定。 |
| 第 N 卷 | `Session`（`kind=adventure`，同 `storyId`） | 压缩续集是同一本书的下一卷，不是新书 |
| 稿纸 | `Story`（`kind=blank`）+ 一个空白 Session | 日常文字 / 排版，也占一张卡 |
| 分支 | 新 `Story` 或同书的旁支卷 | P0：分支仍用现有 `branchFromMessage`，详情里标「分支」；P1 再决定是否独立成书 |
| 规则书 | `WorldBook` | **按故事绑定**，不再是 App 全局一份 |
| 作品 | 导出产物 | 从各卷消息洗净后的可读文本，不是第三种运行时实体 |

一本书的身份是 `Story.id`。现有 `chainId` 迁移后等于这本书的 id（或指向它）。

**严禁**：每条 Session 一张书卡。否则「保存记忆」会在书架上炸出一堆同名书。

---

## 5. 推荐信息架构

### 5.1 阶段机（替换现在的二态）

```
welcome ──► bookshelf ──► reading
                ▲            │
                │            │ 返回 / 回书架
                └────────────┘
                │
                ├──► onboarding（新故事，完成→reading，取消→bookshelf）
                ├──► create（创建角色/规则书，完成→回发起页）
                └──► settings
```

`appPhase` 扩展为：

```ts
type AppPhase = "welcome" | "bookshelf" | "onboarding" | "reading" | "create";
```

设置仍是覆盖层，不占 phase。

冷启动：

1. 未看过欢迎且无模型服务 → 欢迎（保持现状）。
2. 否则 → **书架**（即使只有一本书）。
3. 可选设置「打开时继续上次」：默认关。阅读类 App 的家是书架，继续阅读用一颗按钮。

禁止再：无会话就偷偷 `createBlankSession`。空书架就是空书架。

### 5.2 安卓返回栈

从上到下消费（扩展 `androidBack`）：

1. 确认框 / 菜单 / 搜索 / 设置 / 创建模式
2. 开局步骤回退；第 1 步 → 书架（有书）或欢迎/退出（无书）
3. **阅读中 → 书架**（这是本次体验的关键一层）
4. 书架再按 → 两次确认退出应用

不再出现「在故事里按返回直接杀进程」。

### 5.3 主导航（APP）

书架页底部或顶栏：

| 入口 | 作用 |
|---|---|
| 书架 | 家 |
| 发现/题材（可选，P1） | 复用现有开局题材，不当阅读「发现」 |
| 我的 / 设置 | 模型、规则书库、角色库、数据 |

P0 可以没有底栏，只做「书架 + 设置齿轮 + 新建」。底栏放到 P1，避免一上来三套导航。

书内界面 = 现有 `DialogueNovel`，顶部增加：

- 返回书架
- 书名（点开详情）
- 现有 FunctionBar 保留，但「会话管理」降级为「本书卷次 / 稿纸列表」，不再承担「全库切换」

---

## 6. 方案对比

### 方案 A — 只把 SessionPopup 做成全屏页

改动小：全屏会话列表 + 大按钮「新故事」。

- 优点：一天能做完。
- 缺点：仍是聊天记录列表；卷会变成多条；规则书全局问题不解决；用户仍不觉得自己在「管书」。

**否决作为终态。** 最多当过渡原型，不在 `APP` 分支当目标。

### 方案 B — 纯前端聚合，不建 Story 表

用 `chainId` 在内存里聚合成书卡。

- 优点：无迁移。
- 缺点：封面、分组、完结、简介、规则书绑定无处存放；空白会话没有 chain；一切元数据只能塞进某一卷 Session，卷一切就丢。

**否决。** 书架元数据必须有稳定主键。

### 方案 C — 新增 Story，Session 归属故事（推荐）

新增 `stories` 表。每条 Session 带 `storyId`。注入上下文时按当前故事恢复规则书。书架只渲染 Story。

- 优点：概念对齐用户；卷/压缩/分支仍用现有 Session 机器；导出、封面、分组都有地方放。
- 缺点：一次迁移 + 开局/压缩/切书要改绑定。

**采用方案 C。**

---

## 7. 数据模型

### 7.1 `stories`

```sql
CREATE TABLE IF NOT EXISTS stories (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'adventure',          -- adventure | blank
  status TEXT NOT NULL DEFAULT 'writing',          -- writing | paused | finished
  cover TEXT,                                      -- 本地路径 / dataURL / 主题封面 id
  groupId TEXT NOT NULL DEFAULT 'all',
  pinned INTEGER NOT NULL DEFAULT 0,
  worldBookId TEXT,                                -- 本故事绑定的规则书
  generationPresetId TEXT,                         -- 开局选的文风
  protagonistName TEXT,
  topicSchemeId TEXT,
  worldBaseId TEXT,
  synopsis TEXT NOT NULL DEFAULT '',               -- 可手改，也可之后 AI 生成
  tags TEXT NOT NULL DEFAULT '[]',
  lastOpenedAt INTEGER,
  lastVolumeId TEXT,                               -- 上次读到的 session id
  wordCount INTEGER NOT NULL DEFAULT 0,            -- 缓存，导出/卡片用
  createdAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL,
  deleted INTEGER NOT NULL DEFAULT 0,
  deletedAt INTEGER
);
```

### 7.2 Session 增量

```sql
ALTER TABLE sessions ADD COLUMN storyId TEXT;
```

- 同一 `storyId` 下多卷 = 一本书。
- 现有 `chainId`：迁移后写成 `storyId`；新数据仍可写 `chainId = storyId` 以免压缩逻辑大改。
- `locked` 卷仍只读，从书架点进去应落到 **未锁定的最新卷**（`lastVolumeId` 若已锁则改最新未锁卷）。

### 7.3 分组（P1，P0 用内置枚举即可）

P0 用 `groupId` 字符串：`writing` / `finished` / `draft` / `all`。  
P1 再做用户自定义分组表。稿纸默认 `draft`，冒险默认 `writing`。

### 7.4 规则书绑定（P0 必做，否则切书是错的）

现状：`world_books.isActive` 全局唯一，开局 `setActiveBook`，`useChat` 读 `activeBook`。

两本不同世界的书来回切，后打开的会污染先打开的。

约定：

1. `Story.worldBookId` 是真相。
2. 进入阅读时：按 `story.worldBookId` 调用 `setActiveBook`（或更好：`useChat` **不要读全局 active**，改为 `loadBook(story.worldBookId)`）。
3. 开局结束：写入 `story.worldBookId`，不要只改全局 isActive。
4. 设置页「当前激活规则书」改成「默认规则书 / 书库」，避免用户以为改设置会改所有已有故事。

推荐中期：`useChat` 直接按当前 Story 取书，全局 `isActive` 只当遗留兼容。

### 7.5 迁移

启动 `initDb` 后跑一次：

1. 所有未删 Session 按 `chainId || id` 分组。
2. 每组建一个 Story：
   - `id = chainId || 首卷 id`
   - `title` = 组内最新未锁卷标题（去掉「的冒险」可留到用户手改）
   - `kind` = 组内 kind（混合则 adventure 优先，或拆开——现网几乎不会混）
   - `worldBookId` = 当前全局 activeBook（旧数据只能猜这一份；写进每本书，之后各改各的）
   - `lastVolumeId` = `updatedAt` 最大的那卷
   - `lastOpenedAt` = 该卷 `updatedAt`
3. 回写 `sessions.storyId`。
4. 写 `app_settings.story_migration = 1` 防重跑。

空白会话：一书一卷，标题若仍是「空白会话」则显示「未命名稿纸」。

---

## 8. 界面规格

### 8.1 书架页（新组件 `Bookshelf`）

布局（手机）：

```
[灵叙]                    [搜索] [视图] [设置]
继续阅读 · 《书名》 第3卷 · 3分钟前          ← 有 lastOpened 才显示

[全部] [在写] [完结] [稿纸]

┌────┐ ┌────┐
│封面│ │封面│     网格 2 列（窄屏），桌面 4–6 列
│    │ │    │
│书名│ │书名│
│更新│ │更新│
└────┘ └────┘

              [ + 新故事 ]
```

书卡内容：

- 封面：主题色块 + 书名竖排/横排（legado 无封面时的生成封面）。题材/底座映射色（修仙、古代、现代…）。P1 允许用户换图或 AI 出图。
- 标题：最多两行。
- 副行：`第N卷 · 最近章节名 · 相对时间`。章节名取该卷最新一条 `sceneAnalysis.chapterTitle`。
- 角标：置顶针、完结、锁定卷、未配置模型（可选）。
- 长按 / 桌面右键：继续、详情、重命名、置顶、标为完结、导出 TXT、删除。

空态：

- 插画或字标 + 「还没有故事」
- 主按钮「写下第一个故事」
- 次按钮「先写一页草稿」（空白会话）

「+ 新故事」在空态和有书时都在。有书时用 FAB 或顶栏加号，不要再藏进对话功能栏。

视图：网格默认；列表行显示封面缩略图 + 标题 + 章节 + 时间。选择记在 `uiStore`（persist）。

### 8.2 书内（现 `DialogueNovel`）

改动克制：

- 顶栏或安全区下：`←` 回书架，中间书名。
- FunctionBar「会话管理」改为「本书卷次」：只列出 `storyId` 相同的卷，可进旧卷只读，可进最新卷续写。
- 全库切换删除，避免用户从书内跳到无关故事而不经书架。
- 安卓返回 = 回书架（见 5.2）。

### 8.3 开局（现 `OnboardingFlow`）

- 入口改为书架「新故事」，不再是启动默认页。
- 取消 / 第一步再返回 → 书架，不 `exit_app`，也不强行进对话。
- 完成：建 `Story` + 首卷 Session，写 `worldBookId` 等元数据，`appPhase = reading`。
- 标题：P0 仍可用「{主角}的冒险」，详情/长按可改；P1 开局最后一步可让用户起书名。

### 8.4 故事详情（P1，P0 可先做薄页）

- 封面、书名、简介、主角、题材、规则书、文风
- 卷列表（第1卷…，锁定标记，字数）
- 操作：继续、导出、完结、删除、更换封面

P0 最低：点书名弹出重命名 + 导出入口即可。

---

## 9. 故事管理细则

| 操作 | 行为 |
|---|---|
| 打开 | `lastOpenedAt=now`，激活 `lastVolumeId`（若锁则最新未锁卷），恢复规则书，进 reading |
| 新建故事 | resetOnboarding，phase=onboarding |
| 新建稿纸 | 建 blank Story + Session，进 reading |
| 重命名 | 改 Story.title，不改各卷 title（卷 title 可继续当内部名） |
| 置顶 | `pinned`，书架置顶区分隔 |
| 完结 | `status=finished`；书内仍可进只读，或二次确认后允许续写并改回 writing |
| 删除 | Story 软删 + 其下 Session 软删（复用 30 天回收站） |
| 恢复 | 书架回收站分组或沿用设置里的回收站 |
| 导出 | 见第 10 节 |

收藏（`favorites`）：P0 不在书架重复做「星标」，用置顶代替。旧收藏迁移为 `pinned=1`。

搜索：书架页搜 `title / protagonistName / tags / synopsis`。全文搜消息仍用现有 `SearchPanel`，放在书内。

---

## 10. 作品化（延伸，分三层）

用户说「每个故事的管理，甚至让他总结输出成文本的文字性作品」。这是书架之后的第二曲线，但数据要从 P0 就按「能导出」来存。

### 10.1 L1 干净导出（P1，无额外模型调用）

从一本书的所有未删卷、按 `chainIndex` 再按 `createdAt`：

1. 丢掉 `opening === true` 的用户指令。
2. Assistant：`parseSceneReply` 只留正文；去掉 `【章节名】【场景信息】【正文】【对话推荐】`。
3. User：默认导出为「（你）…」或按模式省略（玩家视角可保留行动）。设置里给「仅导出叙述 / 导出对话全记录」。
4. 章节：优先 `sceneAnalysis.chapterTitle` 变化处分节；否则按卷分「第 N 卷」。
5. 文首 YAML/纯文本头：书名、主角、导出时间。
6. 输出 UTF-8 `.txt`。桌面用 dialog 选路径；安卓用系统分享 / 下载目录（Tauri fs + share，具体跟现有 DataPanel 导出走同一套权限）。

### 10.2 L2 作品整理（P2，一次模型调用）

用户在详情点「整理成作品」：

- 输入：L1 文本 + 剧情档案 `archive` + 书名/简介。
- 输出：统一人称、删元对话（「请开始吧」）、补全缺失章节名、200 字简介写回 `synopsis`。
- 结果另存为「作品稿」，不覆盖原始会话。原始永远可续写。
- 要花 token，必须显式按钮 + 进度，禁止静默。

### 10.3 L3 出版形态（更后）

EPUB、封面图、目录跳转、多格式。等 L1/L2 有人用再做。

P0 书架卡上预留「导出」菜单项可以先灰，或直接做 L1（L1 不依赖新模型能力，建议 P1 紧跟着做，工作量小、仪式感强）。

---

## 11. 与现有子系统怎么接

| 子系统 | 接法 |
|---|---|
| `sessionStore` | 增加 `stories` / `activeStoryId`；`setActive` 必须同时设定故事；压缩续集写入同一 `storyId` |
| `createContinuationSession` | 复制 `storyId`，更新 Story.`lastVolumeId` / `updatedAt` / `wordCount` |
| `OnboardingFlow.handleComplete` | 先 insertStory，Session 带 `storyId` 与 `chainId=storyId` |
| `useChat` | 注入世界书改为当前 Story.worldBookId；空白书仍不注入 |
| `contextCompress` | 阈值、锁旧卷、开新卷不变；新卷同一本书 |
| `worldStore` | 进入阅读时按故事切书；设置页不再暗示「全局唯一正在用的世界」 |
| `generationStore` | 进入阅读时恢复 `story.generationPresetId` |
| `SessionPopup` | 改成「本书卷次」或删除，全库入口只留书架 |
| `SessionList` | 桌面侧栏可改成迷你书架，或阅读时收起 |
| `settingsBackup` | 备份组增加 `stories`；会话快照带 `storyId` |
| 欢迎页 | 配置完 API → 书架，空则 CTA 开第一本书 |

---

## 12. 建议的模块边界

新增（P0）：

- `src/types`：`Story`, `StoryStatus`, `StoryKind`
- `src/lib/db.ts`：stories CRUD + 迁移
- `src/stores/storyStore.ts`：列表、当前书、分组、打开/新建/删
- `src/components/Bookshelf/Bookshelf.tsx`：页
- `src/components/Bookshelf/BookCard.tsx`
- `src/components/Bookshelf/BookCover.tsx`：主题封面
- `src/lib/storyCover.ts`：封面色与标题排版
- `src/lib/storyMigrate.ts`：一次性迁移（也可放 db.ts）

修改：

- `AppShell`：phase、冷启动、返回、渲染 Bookshelf
- `OnboardingFlow`：创建 Story
- `DialogueNovel` / `FunctionBar`：回书架、卷次
- `androidBack`：阅读 → 书架
- `useChat`：按书取规则书
- `uiStore`：phase 类型、书架视图偏好
- `sessionStore.createContinuationSession` / `createBlankSession`

不要把书架 UI 塞进 `SessionPopup.tsx`（已 700+ 行）。

---

## 13. 分阶段

### PR1 / P0 — 能进出、能新建、能切换（本阶段主目标）

- `stories` 表 + 迁移
- `appPhase` 含 `bookshelf` / `reading`
- 书架网格 + 空态 + 新故事 + 稿纸
- 点书进入现有对话
- 返回回书架
- 开局取消回书架
- 切书恢复 `worldBookId`
- 不再自动创建空白会话
- 冷启动进书架

验收：新装机 → 配 API → 看见空书架 → 开第一个故事 → 返回书架 → 再开第二个不同题材 → 来回切，注入的规则书不串。

### PR2 / P1 — 像在管书

- 重命名、置顶、完结、删除/回收
- 列表视图、分组 tab、搜索、继续阅读条
- 薄详情页
- L1 TXT 导出
- 封面主题色

### PR3 / P2 — 作品

- L2 整理成作品
- 简介回写
- 自定义分组
- 可选 AI 封面

---

## 14. 关键决策（已拍板，实现按此，不要再争论）

1. **家是书架，不是对话。** 对话是书的内部。
2. **一本书聚合整条故事链。** 压缩续集不是新书。
3. **新建 Story 表。** 不用纯前端聚合。
4. **规则书按故事绑定。** 全局 `isActive` 降为兼容。
5. **学阅读的书架交互，不学书源。**
6. **空白会话是「稿纸」分组，仍占书卡。** 避免两套家。
7. **导出是作品层，不覆盖原始对话。**
8. **P0 不做底栏五 Tab、不做 EPUB、不做发现页。**
9. **桌面与 APP 同一套 IA。** 只调密度。
10. **开局流程保留，只改入口和退出。** 不重做七步向导。

---

## 15. 成功标准

用户能在一分钟内完成：打开 App → 在书架看到自己的故事 → 再开一个新故事 → 从新故事回到书架 → 点回旧故事接着写。

技术上：

- 切书后 `useChat` 使用的 `WorldBook.id === story.worldBookId`
- 压缩后书架书卡数量不变，副行卷号 +1
- 卸载前导出的 TXT 能用系统文本工具打开，且不含 `【对话推荐】`

---

## 16. 实现时不要踩的坑

1. 只改 UI、不绑 `worldBookId` → 多故事串世界。
2. 每卷一张卡 → 压缩一次书架多一本书。
3. 开局取消又 `setAppPhase("dialogue")` → 用户觉得逃不出去。
4. 冷启动继续自动建空白会话 → 空书架永远空不了。
5. FunctionBar 仍做全库会话管理 → 两套家，安卓更乱。
6. 迁移重复跑 → 用 `app_settings` 标记。
7. 安卓改完前端不重编 `.so` → 真机看不到（见根目录 `AGENTS.md`）。

---

## 17. 给下一个 agent 的开工顺序

1. 读本文 + `src/types/index.ts` + `src/lib/db.ts` + `AppShell.tsx` + `OnboardingFlow.handleComplete` + `useChat` 里 `activeWorldBook`。
2. 落地 `Story` 类型与表、迁移。
3. `storyStore` + 冷启动改书架。
4. 最小 `Bookshelf` 页（可先列表，后封面）。
5. 开局写 Story；返回栈；切书恢复规则书。
6. 再补封面网格与管理菜单。

未征得用户同意前不要做 P2 作品润色，也不要引入阅读式书源。
