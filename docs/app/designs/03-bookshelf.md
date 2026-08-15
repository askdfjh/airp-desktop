# 03 bookshelf-ui + 07 book-detail — 书架页与详情

优先级：UI 为 P0，详情为 P1。

## 书架页（任务 `bookshelf-ui`）

新目录 `src/components/Bookshelf/`：

- `Bookshelf.tsx` — 页
- `BookCard.tsx` — 卡
- `BookCover.tsx` — 主题封面

### 布局（手机）

```
顶栏：灵叙     [搜索可本任务占位] [设置]
若有 lastOpened：一条「继续 · 书名 · 相对时间」
内容：书卡网格 2 列，gap 12，安全区内
空：主按钮「写下第一个故事」次按钮「先写一页草稿」
有书：右下 FAB +
```

桌面：同结构，网格 minmax(160px, 1fr)，最多 6 列。

### 卡

- 封面 3:4
- 书名两行截断
- 副行：`第N卷 · 相对时间`（章节名有则优先）
- 点卡 = `storyStore.openStory` → phase reading
- FAB / 主按钮 = resetOnboarding + phase onboarding
- 次按钮 / 「稿纸」= createDraftStory

P0 不做长按菜单（下一任务 book-manage）。P0 不做分组 Tab（shelf-views）。

### 主题封面

`src/lib/storyCover.ts`：worldBaseId → 底色 + 点缀。无底座用 accent。书名竖排或居中横排，不要用外部图。

### 空态文案

标题「还没有故事」。副文「从一本新故事开始，或先写一页草稿。」不要再出现「空白会话」当首页。

## 详情（任务 `book-detail`）

从书卡长按「详情」或书内点书名进入（全屏 sheet 或独立 phase 覆盖）。

内容：封面、可编辑书名、简介（可空）、主角、题材、规则书名、文风、字数、卷列表（chainIndex、locked、更新时间）。主按钮「继续」。次：导出（若 export 未做则隐藏）、完结、删除。

不要做成第二个设置页。

## 验收 bookshelf-ui

- AppShell 在 bookshelf 渲染 Bookshelf，不再只有占位。
- 空态两个入口可用。
- 点卡能进 reading（即使 DialogueNovel 仍是旧的）。
- 仅安卓样式用现有 `isAndroid` / `data-platform`。

## 验收 book-detail

- 能从书架打开详情并继续。
- 卷列表只含该 storyId。
- 改书名写 Story.title，不改各卷 title。
