# 01 story-model — 故事实体与迁移

优先级：P0 / 地基。失败则整圈停止。

## 目标

书架上的「一本」有稳定主键，能挂卷、封面、状态、规则书绑定。现有会话不丢。

## 不做什么

不改 UI。不改开局流程。不删 `chainId` 列（新数据让 `chainId = storyId`，压缩逻辑少动）。

## 数据

`stories` 表字段（实现按此建，缺列用 ALTER 补）：

| 列 | 说明 |
|---|---|
| id | 主键。迁移时用 `chainId \|\| 首卷 id` |
| title | 展示名 |
| kind | `adventure` \| `blank` |
| status | `writing` \| `paused` \| `finished` |
| cover | 空=主题封面 id（如 `theme:cultivation`）；或 dataURL/路径 |
| groupId | P0 用 `writing` / `finished` / `draft` |
| pinned | 0/1 |
| worldBookId | 可空 |
| generationPresetId | 可空 |
| protagonistName | 可空 |
| topicSchemeId / worldBaseId | 可空，开局写入 |
| synopsis | 默认 `''` |
| tags | JSON 数组文本 |
| lastOpenedAt | 可空 |
| lastVolumeId | 上次打开的 session id |
| wordCount | 缓存整数，默认 0 |
| createdAt / updatedAt | 必填 |
| deleted / deletedAt | 软删，与会话回收站一致 30 天 |

`sessions.storyId` TEXT 可空，迁移后回填。

`app_settings.story_migration = '1'` 防重跑。

## 类型

在 `src/types/index.ts` 增加 `Story`、`StoryKind`、`StoryStatus`。`Session` 增加可选 `storyId`。

## 迁移算法

1. 未删 Session 按 `chainId || id` 分组。
2. 每组一条 Story：title=组内 `updatedAt` 最大卷的 title；kind=组内若有 adventure 则 adventure 否则 blank；worldBookId=当时全局 activeBook（旧数据只能猜这一份）；lastVolumeId=最新卷；groupId=blank→draft 否则 writing。
3. 回写每条 session.storyId。
4. 收藏夹 session 对应的 Story `pinned=1`。

## db API（最小）

`loadStories` / `insertStory` / `updateStory` / `softDeleteStory`（同时软删其下 session）/ `restoreStory` / `purgeExpiredStories` 可复用会话回收站节奏，或第一期删除只走 session 软删 + story 软删。

`settingsBackup`：`BackupGroupKey` 增加 `stories`，快照 stories 表；导入后重跑 load。

## 验收

- 新库建表成功；旧库 ALTER 不炸。
- 手工或启动迁移后：两条同 chainId 的 session → 一条 story。
- `tsc --noEmit` 过。
- 无 UI 也能在 db 层 CRUD 一条 story。

## 会动到的文件

`src/types/index.ts`，`src/lib/db.ts`，建议 `src/lib/storyMigrate.ts`，`src/lib/settingsBackup.ts`。
