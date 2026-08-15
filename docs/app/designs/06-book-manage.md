# 06 book-manage — 管书与继续阅读

优先级：P0 收尾。依赖书架页。

## 长按 / 桌面右键菜单

- 继续
- 重命名（行内或小对话框，改 Story.title）
- 置顶 / 取消置顶
- 标为完结 / 继续写（status finished ↔ writing）
- 删除（Story 软删 + 其下 session 软删；收藏已 pin 的直接删，不再拦「请先取消收藏」——pin 是书属性）
- 导出：若 08 未落地则菜单项隐藏

## 继续阅读条

书架顶：最近 `lastOpenedAt` 的未删书。点条 = openStory。没有 lastOpened 则不渲染。

## 封面

无自定义 cover 时用 `theme:{worldBaseId}`。BookCover 按底座上色。本任务不接相册、不接 AI 出图。

## 删除与回收

设置里已有会话回收站的，可加「已删的书」或复用 trash tab。P0 最低：删到 trash，书架默认列表不可见；设置/书架一个入口恢复。30 天与 session 一致。

## 验收

- 改名后卡上立即变。
- 置顶卡在网格前部。
- 删除后卡消失，open 不到。
- 继续阅读条打开正确的 lastVolumeId。
- `tsc` 过。
