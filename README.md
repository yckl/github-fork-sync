# 🚀 GitHub Fork 自动同步管理器 (GitForkSync)

<div align="center">

![GitHub License](https://img.shields.io/badge/license-MIT-blue.svg?style=flat-square)
![Node Version](https://img.shields.io/badge/Node.js-%3E%3D20.0.0-339933?style=flat-square&logo=node.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=flat-square&logo=typescript)
![Fastify](https://img.shields.io/badge/Fastify-4.x-000000?style=flat-square&logo=fastify)
![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react)
![Tailwind CSS](https://img.shields.io/badge/TailwindCSS-3.x-06B6D4?style=flat-square&logo=tailwindcss)
![SQLite](https://img.shields.io/badge/SQLite-WAL%20Mode-003B57?style=flat-square&logo=sqlite)
![Platform](https://img.shields.io/badge/Platform-Windows%2010%2F11-0078D6?style=flat-square&logo=windows)

**专为开发者打造的 Windows 本地自动化 GitHub Fork 同步管理系统**  
零云端依赖 · 100% 本地运行 · 拓扑级提交校验 · 绝对安全的零破坏性快进推送 · 桌面与移动双端触感控制台

[功能特性](#-核心功能亮点) • [快速启动](#-快速启动指南) • [同步策略](#-三种核心同步策略) • [技术架构](#-系统技术架构) • [手机端适配](#-移动端触感体验) • [常见问题](#-常见问题解答-faq)

</div>

---

## 📖 项目简介 (Overview)

你在 GitHub 上是否也 Fork 了大量优秀的开源项目？随着时间推移，上游作者频繁提交更新，而你的 Fork 仓库却停留在旧版本。如果逐个进入仓库点击 **Sync fork**，不仅费时费力，还容易在存在个人提交时误操作导致代码冲突。

**GitForkSync** 彻底解决了这一痛点！它是一套完全运行在 **Windows 本地** 的全自动管理程序：
1. **自动发现**：连接 GitHub Token 后，一键自动扫描并识别你账号下的所有 Fork 仓库与其上游母仓库。
2. **拓扑比对**：严格分析 Git Commit 拓扑关系，准确区分**已是最新**、**安全落后**、**分支分叉**等 6 种状态，自建原生项目智能标记跳过。
3. **零风险同步**：提供模式 A（独立分支快照）、模式 B（严格快进主分支）、模式 C（仅检测），绝不强制覆盖任何个人代码。
4. **实时看板与调度**：自带现代化 Web 控制台、批量任务实时进度条、任务调度队列与脱敏日志系统。
5. **多端完美适配**：PC 端支持信息密集的专业宽屏管理，手机端深度融合 WorkBuddy 触感悬浮 Dock 与底部抽屉卡片。

---

## 🌟 核心功能亮点

### 1. 🛡️ 银行级安全保障机制
- **本地主密钥加密**：GitHub Token 采用 **AES-256-GCM** 加密持久化存储于 `%LOCALAPPDATA%\GitForkSync\master.key`，数据库内绝无明文凭据。
- **UI 全程脱敏**：前端界面与错误弹窗仅展示掩码（如 `github_pat_...xxxx`），接口绝不向浏览器回传明文 Token。
- **AskPass 管道认证**：底层 Git CLI 操作通过私有 AskPass 管道流式输入认证凭据，进程命令行参数与 Remote URL 中无任何泄露风险。
- **零破坏性推送承诺**：严禁 `git push --force`，严禁在分叉状态下强行覆盖个人修改。

### 2. 🔀 拓扑级提交关系比较引擎
拒绝粗暴比对时间戳！系统通过 GitHub Compare API 与本地 Git 深度解析提交拓扑图：
- 🟢 **已是最新 (Identical)**：本地分支 SHA 与上游完全一致。
- 🔵 **安全落后 (Behind Safe)**：上游新增提交，本地没有分叉改动，支持 100% 纯快进合并（Fast-forward）。
- 🟡 **分支分叉 (Diverged)**：本地有个人提交，上游也有新提交。系统自动阻断推送并提醒手动处理，保护代码安全。
- ⚪ **我方领先 (Ahead)**：本地有自主提交但上游暂无变动。
- 🟣 **自建项目 (Self-Owned)**：原生非 Fork 项目自动归类，支持设置独立跟踪或跳过，杜绝误报。
- 🔴 **历史不兼容 / 变基改写 (Incompatible)**：上游出现 Force-push 或历史改写，主动告警。

### 3. 🎯 批量操作与实时进度反馈
- 支持多选/全选批量启用监控、批量调整同步模式、批量移除与批量一键发起同步。
- 顶置 **实时批量任务进度条 (`TaskProgressBanner`)**，步骤进度（拉取上游 -> 本地快进 -> 远程推送 -> 验证一致性）与成功/失败计数动态呈现。

### 4. 📱 移动端与 PC 双端深度体验
- **PC 桌面端**：信息密集型数据表格、8 维核心指标看板、全能配置抽屉、单双栏随心切换。
- **手机移动端**：
  - 底部微拟物触感悬浮胶囊 Dock (`MobileTabBar`)。
  - 触控优化的仓库卡片视图（支持快速点按检测、同步、配置与删除）。
  - 横向触摸滑动的状态过滤标签栏。
  - 92vh 底部滑出抽屉与顶部拖拽手势小把手（Drag Handle）。

---

## 🎛️ 三种核心同步策略

系统内置自定义高拟物 **同步模式选择器 (`SyncModeSelector`)**，清晰直观地指引同步行为：

| 模式 | 适用场景 | 目标分支 | 同步行为 | 安全级别 |
|:---|:---|:---|:---|:---:|
| **模式 A (默认推荐)**<br>⚡ 自动同步到独立分支 | 既想紧跟上游最新代码，又要在 `main` 分支自由修改个人业务 | `upstream-sync` | 纯 Fast-forward 推送到独立分支，完全不修改你的 `main` 分支 | ⭐️⭐️⭐️⭐️⭐️<br>(最高安全) |
| **模式 B**<br>🔄 自动同步我的主分支 | 纯粹克隆 Fork 镜像，自身不需要在默认分支做改动 | `main` / 默认主分支 | 严格快进推送；若检测到本地有额外提交，立即自动中止并报警 | ⭐️⭐️⭐️⭐️<br>(保护优先) |
| **模式 C**<br>👁️ 仅检测变动，不自动更新 | 对上游代码稳定性要求极高，需人工复核后再决定是否合并 | - | 仅定时检测提交差异并生成对比报告，需手动点击“同步”按钮 | ⭐️⭐️⭐️⭐️⭐️<br>(人工介入) |

---

## 🏗️ 系统技术架构

本项目采用 Monorepo 现代化工程架构，前后端独立解耦、单服务同构部署：

```
github-fork-sync/
├── apps/
│   ├── server/               # 后端服务 (@gitforksync/server)
│   │   ├── src/
│   │   │   ├── modules/
│   │   │   │   ├── auth/     # GitHub PAT 认证与凭据脱敏
│   │   │   │   ├── git/      # 本地 Git CLI 执行引擎与 AskPass 管道
│   │   │   │   ├── github/   # Octokit 客户端与限流退避感知
│   │   │   │   ├── logging/  # 结构化日志与敏感数据自动掩码
│   │   │   │   ├── scheduler/# 定时检测与任务互斥队列中心
│   │   │   │   ├── security/ # AES-256-GCM 加密与单实例文件锁
│   │   │   │   └── storage/  # SQLite 数据库与 WAL 模式 DAO
│   │   │   └── routes/       # Fastify RESTful API 路由模块
│   │   └── dist/             # 后端编译输出
│   │
│   ├── web/                  # 前端控制台 (@gitforksync/web)
│   │   ├── src/
│   │   │   ├── components/   # UI 组件 (SyncModeSelector, MobileTabBar, TaskProgressBanner)
│   │   │   ├── pages/        # 页面 (DashboardPage, RepositoriesPage, TasksPage, LogsPage, SettingsPage)
│   │   │   └── api/          # 前端统一 API 客户端
│   │   └── dist/             # 前端 Vite 静态产物 (由 Fastify 静态托管)
│   │
│   └── shared/               # 跨端共享代码 (@gitforksync/shared)
│       └── src/              # TypeScript 类型定义、Zod 校验模型、常量
│
├── scripts/                  # 辅助运维脚本 (autostart.bat 等)
├── tests/                    # Vitest 单元与集成测试套件 (18 项测试)
├── start.bat                 # Windows 一键极速双击启动入口
└── package.json              # 顶层工作区配置
```

---

## 💻 环境要求

- **操作系统**：Windows 10 / Windows 11 (64 位)
- **Node.js**：Node.js LTS (20.x 或更高版本) [👉 下载 Node.js](https://nodejs.org/)
- **Git**：Git for Windows (2.x 或更高版本，已加入系统环境变量 PATH) [👉 下载 Git](https://git-scm.com/)

---

## 🚀 快速启动指南

### 方式一：双击启动（最简便，推荐）

1. 在项目根目录直接双击运行 **`start.bat`**。
2. 批处理脚本将自动完成：
   - 依赖项完整性检查（未安装时自动执行 `npm install`）。
   - 前后端自动编译构建（自动运行 `npm run build`）。
   - 单实例文件锁检测（防止重复多开进程冲突）。
   - 端口占用探测与自动切换（默认 `3847`，被占用自动递增）。
   - **自动调起系统默认浏览器** 打开控制台：
     ```
     http://127.0.0.1:3847
     ```
3. 即使关闭浏览器网页，后台控制台服务也会持续稳定运行监控；关闭控制台黑窗口即可停止程序。

### 方式二：命令行启动

```bash
# 1. 安装项目所有工作区依赖
npm install

# 2. 全量编译前端与后端
npm run build

# 3. 运行正式生产服务
npm start
```

---

## 📖 首次使用指南 (Step-by-Step)

### 步骤 1：连接 GitHub 账号
1. 打开网页控制台，进入首次欢迎配置页面。
2. 前往 GitHub Settings -> Developer settings -> Personal access tokens 生成令牌：
   - 推荐创建 **Fine-grained PAT**（细粒度令牌）。
   - 权限设置：
     - **Repository permissions** -> **Contents**: `Read and write`（用于快进推送代码）。
     - **Repository permissions** -> **Metadata**: `Read-only`（默认必备基础权限）。
3. 粘贴 Token 点击“验证并连接”，系统将即时核验权限并展示你的 GitHub 头像与账号信息。

### 步骤 2：扫描与发现 Fork 仓库
- 点击右上角或向导中的 **“扫描新仓库”**。
- 系统自动抓取所有名下仓库，精确识别出哪些是 Fork 仓库、其上游原始母仓库地址以及默认分支。

### 步骤 3：选择策略并开启自动同步
- 在 **“仓库管理”** 页面：
  - 点击开关开启对应仓库的 **“自动检测”**。
  - 打开 **“自动同步”** 开关，当上游有新提交且满足安全快进条件时，后台将自动推送。
- 在 **“系统设置”** 中可统一配置默认检测周期（如每 360 分钟检测一次）、API 最大并发数与 Git 推送并发限制。

---

## 📂 本地数据存储与备份

程序遵循 Windows 原生规范，所有持久化配置与运行数据统一存储在用户专用的 `LOCALAPPDATA` 目录下，绝不污染代码工作目录：

- **数据根路径**：`C:\Users\<用户名>\AppData\Local\GitForkSync\`
- **SQLite 数据库**：`...\GitForkSync\data.db`（配置 WAL 模式，高并发读写无冲突）
- **加密主密钥**：`...\GitForkSync\master.key`（256 位随机机密，单机唯一绑合）
- **日志文件**：`...\GitForkSync\logs\app.log`（按天归档轮转，敏感词自动打码）

### 🔄 一键换机迁移与备份
在控制台 **“系统设置”** -> **“配置备份与数据迁移”**：
- **导出配置 JSON**：一键导出所有已监控仓库、分支与同步规则映射（导出的 JSON 文件**绝不包含任何敏感 Token**）。
- **导入配置 JSON**：在任意新电脑上重新部署后，一键导入并重新绑定 Token 即可秒级恢复所有监控任务。

---

## ⚙️ Windows 开机自动启动配置

在项目根目录运行 **`scripts\autostart.bat`**：
- 输入 `1`：自动在 Windows 任务计划程序（Task Scheduler）中注册开机静默启动任务。
- 输入 `2`：一键清理并取消开机自启。

---

## 🧪 单元测试与代码质量

本项目配备完善的 Vitest 自动化测试套件，涵盖核心比较拓扑、本地真实 Git 裸仓库快进推送、AES 加密与 SQLite 数据持久化：

```bash
npm test
```

### 测试矩阵覆盖：
- `tests/comparison.test.ts`：全面测试 Identical、Behind Safe、Ahead、Diverged、Incompatible 等拓扑计算。
- `tests/sync.test.ts`：测试安全 Git 执行器、仓库互斥锁、以及本地真实裸仓库（Bare Repositories）之间的快进推送与二次查验。
- `tests/security.test.ts`：测试 AES-256-GCM 加解密流程、掩码安全脱敏、日志敏感字符串过滤。
- `tests/storage.test.ts`：测试 SQLite 自动迁移、WAL 事务模式、账号与同步设置 DAO 读写完整性。

---

## ❓ 常见问题解答 (FAQ)

<details>
<summary><b>Q1: 为什么有些仓库显示“自建项目（已跳过）”？</b></summary>
这些仓库是你在 GitHub 上自行创建的原生原创项目，而非 Fork 自其他开发者的项目。因为它们不存在上游母仓库，系统会自动将它们归类为自建项目，并在批量检测与同步时自动跳过，无需担心报错。
</details>

<details>
<summary><b>Q2: 为什么提示“分支已分叉，暂停自动同步”？</b></summary>
说明你的目标分支上存在个人提交，同时上游母仓库也新增了提交。为了防止个人代码被覆盖或冲掉，系统执行了**安全熔断保护**。建议你手动进入 GitHub 界面创建 Pull Request 进行代码审查与合并。
</details>

<details>
<summary><b>Q3: 推送时提示 GitHub 报错：“[remote rejected] protected branch hook declined”？</b></summary>
说明你的 GitHub 仓库对该分支配置了 Branch Protection Rules（例如要求必须走 PR 流程或禁止直接 Push）。建议将该仓库切换为**模式 A**，将同步目标分支指定为 `upstream-sync`。
</details>

<details>
<summary><b>Q4: 端口 3847 被占用怎么办？</b></summary>
程序内置端口冲突探测与自适应递增机制。若 3847 端口被占用，程序会自动顺延尝试 3848、3849，并使用最终成功监听的地址自动唤起浏览器。
</details>

---

## 📄 开源许可协议 (License)

本项目采用 [MIT License](LICENSE) 开源协议。代码完全开源，欢迎提 Issue 与 Pull Request！

---

<div align="center">
Made with ❤️ for GitHub Developers. Enjoy effortless fork syncing!
</div>
