# 07 shelf-views — 找书

优先级：P1。失败不停止整圈。

## 分组 Tab

`全部 | 在写 | 完结 | 稿纸`

过滤：全部=未删；在写=kind adventure 且 status≠finished；完结=finished；稿纸=kind blank。

## 视图

网格（默认手机）/ 列表。选择 persist 在 `airp-ui-v3`：`shelfView: "grid" | "list"`。

列表行：封面 40×56、书名、副行章节/时间。

## 搜索

顶栏放大镜展开输入。匹配 title、protagonistName、tags、synopsis。本地过滤，不搜全文消息（全文仍在书内 SearchPanel）。

## 排序

菜单：最近打开、最近更新、书名、创建时间。置顶始终先于排序。persist `shelfSort`。

## 不做

自定义分组拖拽、多选管理模式（P2）。

## 验收

- 稿纸只在稿纸 Tab 与全部里出现。
- 搜索无结果有空文案。
- 刷新后视图与排序还在。
