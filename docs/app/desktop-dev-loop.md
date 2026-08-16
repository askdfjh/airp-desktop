# 桌面端开发回路（vdnight）

> 分支：`vdnight`（从 `APP` 复制）  
> 工作流：`.grok/workflows/desktop-dev-loop.rhai`  
> 启动：`/workflow desktop-dev-loop`

同一时刻只跑一圈。不要再开 `app-delivery-loop`。

## 为什么桌面可以全自动测

桌面是本机窗口，可用 `orca computer` 点真窗口：list-apps → get-app-state → click / press-key。安卓包必须装到手机，这边点不到，所以桌面回路把 **Live** 写成硬门槛。

## 流程

```
Detect（vdnight，发现另一圈在写则停）
    ▼
Static（node scripts/test-core.mjs + npx tsc --noEmit）
    ▼
Live（启动 airp-desktop.exe，走欢迎 / 书架 / 开局 / 设置 / Esc）
    ▼
最多 1 轮 Fix（只修 Live 或 tsc 的 blocker）
    ▼
Commit + push vdnight
    ▼
Package（npm run tauri:build，拷到 releases/）
    ▼
Send（DWS 把 setup.exe 发给于翔）
```

参数：

```json
{ "skip_package": false, "skip_send": false }
```

冒烟：`skip_package` / `skip_send` 为 true。

## Live 必过

- 用 `orca terminal create --worktree path:F:/DocProject/airp-desktop --title narra-live --command <release exe>` 启动，再 `list-apps`。`Start-Process` 经常让 Orca 看不见窗口。
- 标题栏不压住书架顶栏、开局标题、设置页
- 空书架能进开局，Esc 回书架
- 设置能打开，底栏分项齐全（模型 / 角色 / 规则书 / 输出 / 外部工具 / 插件 / 数据 / 关于）
- 若冷启动还在欢迎页：文案必须是「本地文字创作与排版」和「跳过，先去书架」，不能是「进入对话」
- `releases/` 不入库，只把 SHA-256 写进 README

## 禁止

- 同时再开一圈 desktop-dev-loop
- 在 master 上改
- 为过 Live 去改安卓窄屏样式
