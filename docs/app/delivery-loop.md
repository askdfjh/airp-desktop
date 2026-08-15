# APP 全自动交付回路

> 分支：`APP`  
> 工作流：`.grok/workflows/app-delivery-loop.rhai`  
> 产品规格：[`product-spec.md`](./product-spec.md)（总）· [`bookshelf-design.md`](./bookshelf-design.md)（缘起）· [`designs/`](./designs/)（分块）

本回路把「交付一个完整可用的 APP」拆成固定任务队列，每个任务走同一条无人值守流水线。设计意图写在这里；编排实现写在工作流里。人只看 `/workflows` 和最终报告。

---

## 1. 回路在解决什么

书架规格已经拍板。剩下的不是再开会，而是按任务把代码做完、审完、测完、修完、验完，再自动开下一个任务，直到 P0+薄 P1 可用。

不用人在每个阶段点下一步。失败有上限重试；基础任务失败则停，避免在错误模型上继续盖楼。

---

## 2. 单任务状态机

```
                ┌──────────┐
                │  Design  │  只读：把总规格裁成本任务切片
                └────┬─────┘
                     ▼
                ┌──────────┐
                │   Plan   │  只读：步骤 + 验收 + 改哪些文件
                └────┬─────┘
                     ▼
                ┌──────────┐
                │ Execute  │  读写：按计划改代码，跑 tsc
                └────┬─────┘
                     ▼
           ┌─────────┴─────────┐
           ▼                   ▼
     ┌──────────┐        ┌──────────┐
     │  Review  │        │   Test   │  并行：规范/规格审查 + tsc/build
     └────┬─────┘        └────┬─────┘
          └─────────┬─────────┘
                    ▼
              有 blocker？──是──► Fix（最多 2 轮）──► 再 Review+Test
                    │否
                    ▼
                ┌──────────┐
                │  Verify  │  失败闭合：无证据 = 不通过
                └────┬─────┘
                     ▼
              通过 → 下一任务
              基础任务失败 → 整圈停止
              非基础失败 → 记入报告，继续
```

审查与测试并行。修复串行写回同一工作区（不用 isolation worktree，否则改动回不来）。

---

## 3. 固定任务队列（确定性，不靠 agent 自己发现范围）

| # | id | 优先级 | 设计 | 验收一句话 |
|---|---|---|---|---|
| 0 | `story-model` | P0 地基 | [01](./designs/01-story-model.md) | Story 表 + 迁移 |
| 1 | `story-store-nav` | P0 地基 | [02](./designs/02-navigation.md) | 冷启动进书架，不自动建空白会话 |
| 2 | `bookshelf-ui` | P0 | [03](./designs/03-bookshelf.md) | 空态 + 新故事/稿纸 + 书卡 |
| 3 | `onboarding-bind` | P0 地基 | [04](./designs/04-onboarding.md) | 开局写书，取消回书架，切书不串世界 |
| 4 | `reading-exit` | P0 | [05](./designs/05-reading.md) | 返回书架，卷次仅本书 |
| 5 | `book-manage` | P0 | [06](./designs/06-book-manage.md) | 改名/置顶/删除/封面/继续条 |
| 6 | `shelf-views` | P1 | [07](./designs/07-shelf-views.md) | 分组/搜索/排序/网格列表 |
| 7 | `book-detail` | P1 | [03](./designs/03-bookshelf.md) | 详情与卷列表 |
| 8 | `export-txt` | P1 | [08](./designs/08-export.md) | 干净 TXT，不覆盖对话 |
| 9 | `resume-context` | P1 | [09](./designs/09-resume-context.md) | 切书恢复文风与现场 |

P2（AI 作品、自定义书架等）见 [10-later](./designs/10-later.md)，**本圈不排队**。

---

## 4. 角色与权限

| 阶段 | 能力 | 失败策略 |
|---|---|---|
| Design / Plan / Review | read-only | 缺输出当空，不编造 |
| Execute / Fix | all | 必须改磁盘上的真实文件 |
| Test | execute | 必须跑 `npx tsc --noEmit`，必要时 `npm run build` |
| Verify | execute | **失败闭合**：没读到代码或没跑命令 = `accepted=false` |

禁止给实现 agent 开 isolation worktree。并行只用于只读审查 + 测试。

---

## 5. 预算与停止条件

- 最坏约 12 次 agent / 任务 × 10 任务 ≈ 120，另加收尾。真跑预算 256。
- `story-model`、`story-store-nav`、`onboarding-bind` 验证失败 → 整圈停止。
- 单任务修复最多 2 轮。
- 不 `await_user`。本回路按已拍板规格自动跑。
- 实现可在 `APP` 分支提交原子 commit，不 push、不碰 `master`。

---

## 6. 怎么跑

```text
/workflow app-delivery-loop
```

或带参数：

```json
{ "max_tasks": 10, "start": 0 }
```

冒烟只走 `max_tasks=1` 的一条路径。真跑用满队列。进度在 `/workflows`。

---

## 7. 什么叫整圈成功

对照 `bookshelf-design.md` §15：

打开 App → 书架看到故事 → 再开一个新故事 → 回到书架 → 点回旧故事接着写。切书后注入的规则书是该书绑定的那本。压缩后续集不在书架上多出一本书。

技术门：`npx tsc --noEmit` 通过。
