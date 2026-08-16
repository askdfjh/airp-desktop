# 02 story-store-nav — 阶段机与冷启动

优先级：P0 / 地基。失败则整圈停止。依赖 `story-model`。

## 目标

打开 App 先到书架，而不是对话。空应用不再偷偷建「空白会话」。

## 阶段

```ts
type AppPhase = "welcome" | "bookshelf" | "onboarding" | "reading" | "create";
```

设置仍是 overlay。`create` 可继续用现有 `createMode` 覆盖层，不一定占 phase；若已有 createMode，保持覆盖层即可，不必强行改 phase。

冷启动（`AppShell` initDb 之后）：

1. 欢迎条件不变（未见欢迎且无 provider）。
2. 否则 `setAppPhase("bookshelf")`，**不要** `activeId ? dialogue : onboarding`。
3. 禁止 `sessions.length === 0` 时 `createBlankSession()`。
4. persist 仍不要存 appPhase（每次按上面判定）。

## storyStore

新建 `src/stores/storyStore.ts`：

- `stories: Story[]`，`trash: Story[]`，`activeStoryId`
- `loadFromDb` / `openStory(id)` / `createDraftStory()` / `startNewAdventure()`（只切 onboarding，不插书——书在开局完成时插）
- `openStory`：写 lastOpenedAt，激活 lastVolumeId（若该卷 locked 则最新未锁卷），`sessionStore.setActive`，按 worldBookId 切规则书（可先调用 setActiveBook，后续 resume-context 再改 useChat 直读）

`createDraftStory`：插 blank Story + 一个 blank Session（storyId 已填），然后 open。

## 验收

- 有历史会话（已迁移）启动 → 书架 phase，不自动进 DialogueNovel。
- 空库启动 → 书架空态，sessions 仍为 0。
- `tsc` 过。本任务可以只改 phase + store，书架页下一任务再挂。若还没有 Bookshelf 组件，AppShell 在 bookshelf phase 先渲染一个占位标题「书架」+ 按钮「新故事」「稿纸」，避免白屏。

## 会动到的文件

`src/stores/uiStore.ts`，`src/stores/storyStore.ts`（新），`src/components/Layout/AppShell.tsx`，`src/stores/sessionStore.ts`（createBlank 不再被启动调用）。
