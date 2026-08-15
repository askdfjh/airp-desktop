# 09 resume-context — 重开一本时的现场

优先级：P1。把「切书」从能打开做成能接着写。

## 打开时恢复

`openStory` 已有：lastVolumeId、worldBookId。本任务补齐：

1. **文风**：`generationStore.setActivePreset(story.generationPresetId || "none")`。书内改文风时回写 Story.generationPresetId。
2. **规则书**：useChat 直读 story.worldBookId（04 若已做则复查）。
3. **现场条**：进入 reading 后，若最新 assistant 有 chapterTitle 或 scene location，在列表顶或输入框上显示一次「上次写到：xxx」，点 × 或发送后消失。不入库。
4. **可选设置** persist：`openToLastBook` 默认 false。true 时冷启动 openStory(lastOpened) 但仍先经过书架一帧可省，直接 reading——若做，必须能从书内回书架。默认保持关。

## 字数缓存

open 或每次发送成功后粗算：该 story 下非 opening 消息 content 长度写入 wordCount。失败忽略。详情/卡片可显示。

## 验收

- 书 A 文风「长篇叙事」，书 B 「玩家视角」；A→书架→B→A，A 仍是长篇叙事。
- 现场条只出现一次，不挡输入。
- `tsc` 过。
