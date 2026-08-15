# 08 export-txt — 干净文稿

优先级：P1。不覆盖原始对话。

## 流水线

输入：一本 Story 下未删卷，按 chainIndex 再 createdAt。

1. 丢 `opening===true` 的 user。
2. assistant：`parseSceneReply` 只留 body；去掉 `【章节名】【场景信息】【正文】【对话推荐】`。
3. user：设置 `exportIncludePlayer` 默认 false（仅叙述，跳过 user）；true 时标「（你）」。
4. 分节：sceneAnalysis.chapterTitle 变化 → `## 章名`；否则 `## 第 N 卷`。
5. 文首：书名、主角、导出时间，纯文本，不要 YAML 也可。
6. UTF-8 `.txt`。桌面 `plugin-dialog` 选路径；安卓写 `$DOWNLOAD` 或系统分享（能用哪个用哪个，失败 toast）。

实现放 `src/lib/storyExport.ts`，详情/长按调用。

## 验收

- 导出文件不含「请开始吧」开局句（若被标 opening）。
- 不含 `【对话推荐】`。
- 原始 messages 表不被改写。
- 锁卷内容仍导出（只读卷也是作品的一部分）。

## 不做

EPUB、DOCX、AI 润色（见 10-later）。
