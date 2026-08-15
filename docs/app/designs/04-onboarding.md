# 04 onboarding-bind — 开局写书与规则书绑定

优先级：P0 / 地基（串世界会毁掉多故事）。依赖 story-model、nav。

## 目标

开局只从书架进入；取消回书架；完成时诞生一本带绑定的书；切书换规则书。

## 开局入口 / 出口

- `OnboardingFlow` 的 onExit：有书或有 story → `appPhase=bookshelf`，**禁止**再 `dialogue`，**禁止**无书时乱 `exit_app`（无书取消仍回空书架）。
- 完成 `handleComplete`：
  1. `insertStory`（title 暂用「{主角}的冒险」或用户之后可改；kind=adventure；worldBookId=resolvedBookId；generationPresetId=当前文风；protagonistName；topicSchemeId；worldBaseId；groupId=writing；lastVolumeId=新 session）
  2. session 带 `storyId`、`chainId=story.id`
  3. `setActiveBook` 仅作为遗留同步；真相是 story.worldBookId
  4. `storyStore.activeStoryId = story.id`
  5. `appPhase=reading`

## 切书不串世界

`useChat` 构建世界上下文时：

```
const bookId = currentStory?.worldBookId
const book = books.find(b => b.id === bookId) ?? null
```

不要只用 `useWorldStore.activeBook`。`openStory` 仍可 setActiveBook 以兼容设置页高亮。

空白书：不注入规则书。

## 验收

- 开局取消：回到 Bookshelf，不进对话、不杀进程。
- 两本不同 worldBookId 的书来回 open：useChat 命中的书 id 等于当前 Story.worldBookId（用日志或代码审查确认数据流）。
- 中途退出开局不调用 setActiveBook（保持「最后一步才激活」的旧约定，且新书未创建）。

## 会动到的文件

`OnboardingFlow.tsx`，`AppShell.handleOnboardingExit`，`useChat.ts`，`storyStore.openStory`，`worldStore` 仅兼容。
