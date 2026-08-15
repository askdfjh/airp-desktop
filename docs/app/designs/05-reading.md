# 05 reading-exit — 书内进出

优先级：P0。依赖 nav + bookshelf。

## 目标

写是沉浸的，离开是明确的。安卓返回不再退出应用。

## 书内顶栏

`DialogueNovel` 顶部安全区下一条细栏：

- 左：← 回书架（`setAppPhase("bookshelf")`，不要清 messages 以外的持久数据）
- 中：当前 Story.title（无 story 则 session.title）
- 右：可空，或「详情」（详情未做时可 no-op / 不画）

不要用桌面 TitleBar 替代这条（安卓无窗口按钮）。

## 返回栈（androidBack）

在现有分层之上插入：

1. 浮层 / 设置 / 创建 / 开局步骤（已有）
2. **reading → bookshelf**
3. 书架上两次返回才 exit_app

`handleOnboardingExit` 已在 04 改为回书架。

## 会话管理降级

`FunctionBar` 的「会话管理」改为「本书卷次」：

- 只列出 `session.storyId === activeStoryId` 的卷，按 chainIndex
- 点旧锁卷：只读进入（现 locked 逻辑已禁发送）
- 点最新未锁卷：续写
- 去掉「新故事」「空白会话」全库入口（全库只留书架）

可新组件 `VolumeSheet.tsx`，不要继续堆 `SessionPopup.tsx`。旧 SessionPopup 可留作死代码一版，或改造成 VolumeSheet。

## 验收

- 书内点 ← 回到书架，书卡还在。
- 安卓：reading 时 dispatchBack 被阅读层消费。
- 卷表不含其他书的 session。
- 压缩后续集出现在同一本书的卷表，书架卡数量不变（审查 createContinuationSession 是否抄 storyId）。

## 会动到的文件

`DialogueNovel.tsx`，`FunctionBar.tsx`，`androidBack` 注册处，`sessionStore.createContinuationSession`（补 storyId），`AppShell`。
