# APP 交付回路（优化后）

> 分支：原 `APP`（已并入 `vdnight` 后删除）  
> 现行桌面回路：[`desktop-dev-loop.md`](./desktop-dev-loop.md)  
> 旧工作流：`.grok/workflows/app-ship-loop.rhai` / `app-delivery-loop.rhai`（**已退役**，启动即退出，不再改代码）

人只看 `/workflows` 和最终报告。同一时刻只允许一圈。

---

## 1. 旧回路为什么废了

上一版按 10 个 P0/P1 任务从零走 Design→Plan→Execute→Review→Test→Fix→Verify。实际出了这些问题：

| 问题 | 后果 |
|---|---|
| 同时起了 `app-delivery-loop` 和 `app-delivery-loop-2` | 两个实现 agent 抢同一工作区，互相覆盖 |
| 不检查「这任务是不是已经做完」 | 书架做好后还在重做 `story-model` / `story-store-nav` / `bookshelf-ui` |
| 每个任务都先 Design+Plan | 已完成功能仍烧掉大量预算，一圈十几个小时 |
| Review 过严 → 必进 Fix | 已通过的代码被再改一轮，出现重复 commit |
| 实现切片比已落地功能更窄 | `bookshelf-ui` 执行器要把搜索/长按/详情拆掉 |
| 禁止 push、不打包 | 和「审完、测完、提交、打 APK、钉钉发给于翔」对不上 |

旧队列（story-model … resume-context）代码已经在 `APP` 上。不要再开那条 10 任务循环。

---

## 2. 新回路（`app-ship-loop`）

一次运行只做 **收口发版**，不再扫未完成任务清单。

```
Detect（只读：已完成则跳过实现；发现另一圈在写则立刻停）
    ▼
Review + Test 并行（tsc 必须实跑）
    ▼
最多 1 轮 Fix（只修 blocker / tsc，禁止重开 P0/P1）
    ▼
Commit + push APP
    ▼
Package（重编前端 → 嵌进 .so → assembleArm64Release）
    ▼
Send（dws 私聊发给于翔）
```

默认预算够 8 个 agent，不要 256。

参数：

```json
{ "package": true, "send": true }
```

冒烟：`{ "package": false, "send": false }`。

启动：

```text
/workflow app-ship-loop
```

**禁止**再跑 `/workflow app-delivery-loop`。若误启动，stub 会立即 `complete`，不改仓库。

**禁止**同时再开一圈 `app-ship-loop`。

---

## 3. 停旧圈

在 `/workflows` 里对仍显示 active 的 `app-delivery-loop` / `app-delivery-loop-2` 按 `x`，或：

```text
/workflow stop app-delivery-loop
/workflow stop app-delivery-loop-2
```

Agent 无法代发这条斜杠命令；子代理已被取消。宿主持有的 run 还要在面板上停掉，否则它可能再拉实现 agent。

---

## 4. 发版验收

- `npx tsc --noEmit` 退出码 0
- APK 存在且 `.so` 是这次 `npm run build` 之后编的
- 钉钉私聊于翔能下载该 APK
