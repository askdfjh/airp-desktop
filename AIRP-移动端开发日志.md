# AIRP / 灵叙 Narra — 安卓端（移动端）开发日志

## 项目概述
AIRP 安卓端是桌面版（Tauri 2 + React 19）的移动平台版本，与桌面端共用同一套前端源码。
- 构建方式：Tauri Android（Rust aarch64-linux-android + Gradle AGP）
- 安装方式：`adb install`（华为 PLJ110，arm64-v8a，Android 16）
- 包名：`com.airp.app`（与桌面端一致）
- 手机数据：app 私有目录 SQLite（卸载即清空）；跨设备数据互通走 WebDAV 云端同步（世界书/角色卡/会话三组）

## 安卓端功能基线（2026-08-02，对应桌面 commit b099188）
- [x] 灵叙 Narra 品牌（图标/名称）
- [x] WebDAV 云端同步（src/lib/webdavClient.ts + webdavSync.ts，设置 → 数据管理 → 云端同步）
- [x] Android 返回键适配（src/lib/androidBack.ts：分层消费 → 两次返回退出）
- [x] 响应式布局（index.css 移动端适配）
- [x] 自绘标题栏（桌面专用，安卓不渲染 TitleBar）

## 构建环境（Windows 本机）
| 组件 | 路径/版本 |
|---|---|
| Android SDK | `C:\Users\OOTD\AppData\Local\Android\Sdk`（platforms 34/36.1、build-tools、NDK 27.0.12077973） |
| Java | Android Studio 自带 JBR（`C:\Program Files\Android\Android Studio\jbr`，OpenJDK 21） |
| Rust 目标 | aarch64-linux-android（真机）/ armv7 / i686 / x86_64（模拟器） |
| Gradle | 8.13（本地缓存；模板默认 8.14.3 国内下载超时） |
| adb | `C:\Users\OOTD\Desktop\platform-tools\adb.exe` |
| Android 工程 | `src-tauri/gen/android/`（gitignored 产物） |

## 开发记录

### 2026-08-03（安卓 debug 版首次构建安装 + 图标修复）

**背景**
把仓库最新代码（含 AI 创建模式等）同步到手机，构建 debug 版 APK。手机原装 8/2 release 版（`run-as` 提示 not debuggable）。

**步骤与踩坑（按顺序）**

1. **环境检查**：Rust `aarch64-linux-android` 已装；缺 armv7/i686/x86_64
2. **rustup 下载卡死**：static.rust-lang.org 无响应 → 设 `RUSTUP_DIST_SERVER=https://rsproxy.cn` 镜像后秒下
3. **`npx tauri android init`** 重建 `src-tauri/gen/android` 工程（原工程 8/2 构建后已删）
4. **`tauri android build` 符号链接失败**：Windows 未开开发者模式，无法在 jniLibs 创建 symlink → 放弃 CLI，改手动流程（见下）
5. **手动构建 .so**：
   - `cargo build --target aarch64-linux-android` 需设置 NDK 工具链环境变量：
     ```
     CC/CXX/AR_aarch64_linux_android → $NDK\llvm\prebuilt\windows-x86_64\bin\aarch64-linux-android21-clang.cmd / llvm-ar.exe
     CARGO_TARGET_AARCH64_LINUX_ANDROID_LINKER → 同 clang.cmd
     ```
   - 否则报 `failed to find tool "clang.exe"` / `linker cc not found`
6. **复制 .so**：`libairp_desktop_lib.so` → `gen/android/app/src/main/jniLibs/arm64-v8a/`（219MB debug 版）
7. **Gradle 8.14.3 下载超时** → `gradle-wrapper.properties` 改指本地缓存的 8.13（AGP 8.11.0 要求 ≥8.13）
8. **Maven TLS 中断**（repo.maven.apache.org）→ 根 `build.gradle.kts` + `buildSrc/build.gradle.kts` 前置阿里云镜像（google/central/public/gradle-plugin），原源兜底
9. **rustBuild 任务 panic**：RustPlugin 每个 ABI 跑 `tauri android android-studio-script` 找 dev server addr 文件失败 → 因 .so 已手动就位，跳过：
   ```
   gradlew assembleDebug --no-daemon -x rustBuildArmDebug -x rustBuildArm64Debug -x rustBuildX86Debug -x rustBuildX86_64Debug -x rustBuildUniversalDebug
   ```
10. **产物**：`gen/android/app/build/outputs/apk/arm64/debug/app-arm64-debug.apk`
11. **安装**：旧版 release 签名 → `INSTALL_FAILED_UPDATE_INCOMPATIBLE`；`adb backup` 空备份（app 不可备份）→ 手机数据无法提取 → 卸载重装 debug 版 ✅
    - ⚠️ 卸载清空手机本地数据（后续跨端数据走 WebDAV 恢复）

**图标默认化问题与修复**
- 现象：`tauri android init` 生成的工程 mipmap 是 Tauri 默认图标（用户发现手机图标变了）
- 根因：icons 目录缺标准图标集，从未跑过 `tauri icon`
- 修复：`npx tauri icon src-tauri/icons/128x128@2x.png`（256x256 源图）→ 自动生成全平台图标并写入 `gen/android/app/src/main/res/mipmap-*/` → 重新构建 + `adb install -r` 覆盖安装 ✅
- 残留：源图 256px，xxxhdpi 放大略模糊，有高清原图可重跑

**验证**
- `npx tsc --noEmit` 零错误 ✅ / vite build 3.06s ✅ / cargo debug 编译 ✅（仅既有警告）
- Gradle BUILD SUCCESSFUL ✅ / 安装启动正常（PID 存活，无 FATAL）✅

**可复用安卓构建流程**
```powershell
$env:ANDROID_HOME="C:\Users\OOTD\AppData\Local\Android\Sdk"
$env:JAVA_HOME="C:\Program Files\Android\Android Studio\jbr"
$ndk="C:\Users\OOTD\AppData\Local\Android\Sdk\ndk\27.0.12077973\toolchains\llvm\prebuilt\windows-x86_64\bin"
$env:CC_aarch64_linux_android="$ndk\aarch64-linux-android21-clang.cmd"
$env:CXX_aarch64_linux_android="$ndk\aarch64-linux-android21-clang++.cmd"
$env:AR_aarch64_linux_android="$ndk\llvm-ar.exe"
$env:CARGO_TARGET_AARCH64_LINUX_ANDROID_LINKER="$ndk\aarch64-linux-android21-clang.cmd"
cargo build --target aarch64-linux-android        # 在 src-tauri 目录
# 复制 src-tauri\target\aarch64-linux-android\debug\libairp_desktop_lib.so
#   → src-tauri\gen\android\app\src\main\jniLibs\arm64-v8a\
cd src-tauri\gen\android
.\gradlew.bat assembleDebug --no-daemon -x rustBuildArmDebug -x rustBuildArm64Debug -x rustBuildX86Debug -x rustBuildX86_64Debug -x rustBuildUniversalDebug
adb install -r app\build\outputs\apk\arm64\debug\app-arm64-debug.apk
```

## 待办
- [ ] 手机端配置 WebDAV 同步并从云端恢复数据（桌面端数据 → 云端 → 手机）
- [ ] 高清 logo 源图（≥512px）重跑 `tauri icon`
- [ ] release 版签名方案（正式分发用）
- [ ] 手机端真机实测：返回键分层消费、响应式布局、WebDAV 下载合并
