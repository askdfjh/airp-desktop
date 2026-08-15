# AGENTS.md

## 项目概述

灵叙 Narra：本地文字创作与排版工具。桌面端（Tauri Windows）+ 安卓端（Tauri Android，`src-tauri/gen/android`，gitignore 不入库）。

## APP 分支

当前若在 `APP` 分支：本阶段主线是 **书架作为 APP 首页**，让用户随时进出、切换、新建故事。设计与分期见 [`docs/app/bookshelf-design.md`](docs/app/bookshelf-design.md)。未读该文档不要改导航或会话模型。

产品规格：[`docs/app/product-spec.md`](docs/app/product-spec.md)。分块设计：`docs/app/designs/`。  
全自动交付回路见 [`docs/app/delivery-loop.md`](docs/app/delivery-loop.md)，编排脚本 `.grok/workflows/app-delivery-loop.rhai`。

## 关键命令

- 前端构建：`npm run build`（tsc + vite，产物在 `dist/`）
- 桌面打包：`npm run tauri:build`
- 安卓打包：手动多步流程，见下

## 安卓打包流程（重要）

**前端资源不是从 APK assets 加载的！** Tauri Android 的资源由 `generate_context!` 在**编译期嵌入 `.so`**（lib.rs 有注释），WebView 走 `Rust.handleRequest`（RustWebViewClient.kt 中 `withAssetLoader=false` 分支）。**改前端后必须重新编译 `.so`，光复制 assets 不生效**（这是"安卓端和桌面端不同步"的根因）。

完整流程（在 src-tauri 目录）：

```powershell
# 1. NDK 工具链环境变量（NDK 27 位于 %LOCALAPPDATA%\Android\Sdk\ndk\27.0.12077973）
$ndk = "C:\Users\OOTD\AppData\Local\Android\Sdk\ndk\27.0.12077973\toolchains\llvm\prebuilt\windows-x86_64\bin"
$env:CC_aarch64_linux_android = "$ndk\aarch64-linux-android24-clang.cmd"
$env:AR_aarch64_linux_android = "$ndk\llvm-ar.exe"
$env:CARGO_TARGET_AARCH64_LINUX_ANDROID_LINKER = "$ndk\aarch64-linux-android24-clang.cmd"
$env:RANLIB_aarch64_linux_android = "$ndk\llvm-ranlib.exe"

# 2. 先构建最新前端（.so 编译时嵌入 dist）
npm run build

# 3. 编译 Rust（嵌入最新前端）
cargo build --release --target aarch64-linux-android

# 4. 复制 .so 到 jniLibs（目录为空会导致 APK 缺原生库 → 打开即闪退 UnsatisfiedLinkError）
Copy-Item target\aarch64-linux-android\release\libairp_desktop_lib.so gen\android\app\src\main\jniLibs\arm64-v8a\ -Force

# 5. 更新 assets（虽然不参与资源加载，保持与工程一致）
Remove-Item gen\android\app\src\main\assets\assets -Recurse -Force -ErrorAction SilentlyContinue
Copy-Item dist\index.html gen\android\app\src\main\assets\
Copy-Item dist\assets gen\android\app\src\main\assets\ -Recurse -Force

# 6. 打包（在 gen\android 目录）
# 必须跳过 rust 任务（本机无 npm.bat，Tauri gradle 插件启动 npm 失败；.so 已手动就位）
# jniLibs 变化后 gradle 增量会漏 → 用 clean 或 --rerun-tasks
gradlew.bat clean assembleArm64Release -Pairp.android.allowDebugReleaseSigning=true -x rustBuildArm64Release -x rustBuildUniversalRelease

# 7. 安装
adb install -r app\build\outputs\apk\arm64\release\app-arm64-release.apk
```

## 签名

- 正式 keystore：`gen\android\app\airp-release.keystore`（不入库），密码走环境变量 `AIRP_KEYSTORE_PASS` / `AIRP_KEYSTORE_ALIAS_PASS`，配置在 `gen\android\gradle.properties`
- 环境变量未设置时自动回落：`-Pairp.android.allowDebugReleaseSigning=true` 用 debug keystore 签名
- **debug 签名与正式签名不兼容**：覆盖安装需先卸载（清数据）；debug 签名包可互相覆盖（-r 保留数据）
- 8-8 的提交曾误删 build.gradle.kts 的签名配置，已恢复；重新 `tauri android init` 后需重新补回

## 安卓调试

- debug 包 WebView 可调试（release 包不可）：`adb forward tcp:9222 localabstract:webview_devtools_remote_<pid>`，然后 CDP（PowerShell ClientWebSocket 或 chrome devtools）
- 验证实际加载的前端版本：CDP `Runtime.evaluate` 查 `document.querySelectorAll('script')[0].src` 的 hash 文件名，与 `dist/assets/` 对比
- 手机上 app 数据：debug 包可 `adb shell run-as com.airp.app` 查看
- 闪退日志：`adb logcat -d | grep -E "FATAL|UnsatisfiedLinkError"`

## 已知坑

1. **jniLibs/arm64-v8a/ 为空 → APK 缺 .so → 打开即崩**（UnsatisfiedLinkError: libairp_desktop_lib.so not found）
2. **前端更新 ≠ 换 assets**：必须重编 .so（generate_context! 嵌入 dist）
3. **gradle 增量缓存会漏 jniLibs**：改 .so 后 clean 或 --rerun-tasks
4. **本机只有 npm.cmd 无 npm.bat**：Tauri gradle rust 任务（BuildTask.kt）启动 npm 失败，一律 `-x rustBuild*` 跳过
5. 改 tauri.conf.json（CSP 等）后必须重编 Rust 才生效（配置也由 generate_context! 嵌入）
