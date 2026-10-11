# GitHub Fork 自动同步管理器 (Windows 本地版)
### GitForkSync v1.0.0

一套专为 Windows 本地环境打造的高性能、全自动、高安全性的 GitHub Fork 仓库同步管理系统。无需 Docker，不依赖云服务器，提供现代化的中文管理控制台。

---

## 🌟 核心特性

- **100% Windows 本地运行**：完全在本地机器执行，无任何云端外部中转依赖。
- **Git 拓扑级提交关系比较**：严格遵循 Git Commit 拓扑判定，准确区分**已是最新**、**安全落后**、**我方领先**、**分支分叉**与**历史不兼容**六种状态，绝不根据时间戳或伪数据草率更新。
- **零破坏性安全推送保障**：
  - **模式 A（默认推荐）**：自动同步到独立分支（如 `upstream-sync`），完全不触碰你的 `main` 分支，零风险保留上游更新快照。
  - **模式 B**：自动同步主分支（仅限严格 Fast-forward 快进，禁止 Force Push，禁止丢弃个人提交）。
  - **模式 C**：仅检测变动，不自动更新。
- **银行级凭据安全**：
  - GitHub Token 采用 **AES-256-GCM** 本地主密钥加密存储，数据库内无明文。
  - Web 前端仅展示脱敏掩码（如 `ghp_...4567`），绝不向浏览器回传明文 Token。
  - Git 操作通过受控的 **AskPass** 进程间管道认证，命令行与远程 URL 中绝无 Token 泄露隐患。
  - 运行日志与错误输出全面自动脱敏。
- **智能任务调度与并发管理**：
  - 单仓库互斥锁（防止同一仓库重复并发操作）。
  - API 与 Git 操作并发隔离（API 默认并发 2，Git 默认并发 1）。
  - GitHub 限流感知与自动重试机制（遵从 `x-ratelimit-reset` 头）。
  - 系统休眠与意外退出恢复机制。
- **现代桌面级 Web 控制台**：基于 React 18、Tailwind CSS 与 PanelUI 规范构建，支持深色/浅色模式、8 核心数据指标看板、仓库批量管理、提交差异预览与实时运行日志流。
- **双击即开与单实例守护**：双击 `start.bat` 自动校验环境并调起浏览器；内置 PID 文件锁，防止重复启动多个进程。

---

## 💻 环境要求

- **操作系统**：Windows 10 / Windows 11 (64-bit)
- **Node.js**：Node.js LTS (20.x 或以上版本) -> [下载 Node.js](https://nodejs.org/)
- **Git**：Git for Windows (2.x 或以上版本，已配置环境变量 PATH) -> [下载 Git](https://git-scm.com/download/win)

---

## 🚀 快速启动指南

### 方式一：双击启动（最简便）

1. 在项目根目录下，直接双击运行 **`start.bat`**。
2. 脚本将自动检测环境依赖、自动安装依赖包、自动编译前后端，并在后台服务就绪后**自动调起系统默认浏览器**打开管理界面：
   ```
   http://127.0.0.1:3847
   ```
3. 浏览器关闭后，后台控制台程序将持续运行监控；关闭控制台黑窗口即可停止程序。

### 方式二：命令行启动

```bash
# 1. 安装项目依赖
npm install

# 2. 全量编译构建
npm run build

# 3. 启动正式服务
npm start
```

---

## 📖 首次使用与操作指引

### 1. 首次连接 GitHub
1. 打开系统后将展示步骤式引导向导。
2. 按照 [GitHub Token 创建指南](docs/TOKEN_SETUP.md) 生成您的 Personal Access Token（建议使用 Fine-grained PAT，授予目标仓库 Contents 读写权限与 Metadata 只读权限）。
3. 粘贴 Token 并点击“验证并连接”，系统将自动获取您的账号头像与权限核验结果。

### 2. 仓库发现与批量导入
1. 点击“扫描我的 Fork 仓库”，系统将自动调用 GitHub API 分页拉取您名下的所有仓库。
2. 系统会自动识别 Fork 来源、读取 Parent 仓库的上游地址与默认分支，并存入本地 SQLite。

### 3. 选择同步策略
在向导第 4 步或仓库详情中设置同步模式：
- **模式 A（自动同步到独立分支）**：目标分支填写 `upstream-sync`。同步时安全快进，不影响您的 `main` 开发分支。
- **模式 B（自动同步我的主分支）**：目标分支填写 `main`。仅当本地没有额外提交且能够纯快进时执行。
- **模式 C（仅检测，不自动更新）**：定时扫描有无新提交，并展示提交卡片，等待手动点击“同步”。

### 4. 开启定时检测与自动同步
- 在**仓库管理**表格中，打开对应仓库的**“自动检测”**开关。
- 若希望发现更新后由程序自动推送到 GitHub，同时打开**“自动同步”**开关。
- 也可以在**“系统设置”**中调整默认检测间隔（默认每 360 分钟检测一次）。

### 5. 如何判断同步是否成功？
1. **仪表盘**与**任务中心**：同步任务将显示当前进度（如拉取上游提交 -> 安全推送 -> 远程 API 二次查验）。
2. **状态变动**：成功后仓库状态会变为绿色的**“已是最新”**。
3. **真实 GitHub 验证**：打开 GitHub 网站进入您的 Fork 仓库，即可看到对应的目标分支已更新至上游最新提交。

---

## 📂 本地数据与配置文件说明

系统所有持久化数据统一存储在 Windows 专用的 Local AppData 目录下，绝不污染项目源码目录或桌面：

- **数据根目录**：`%LOCALAPPDATA%\GitForkSync\`（即 `C:\Users\<用户名>\AppData\Local\GitForkSync\`）
- **SQLite 数据库**：`%LOCALAPPDATA%\GitForkSync\data.db`（启用 WAL 事务模式）
- **主密钥文件**：`%LOCALAPPDATA%\GitForkSync\master.key`（加密 Token 的本地专属 256 位密钥）
- **运行日志文件**：`%LOCALAPPDATA%\GitForkSync\logs\app.log`
- **临时 Git 缓存**：`%LOCALAPPDATA%\GitForkSync\temp\`（仅在执行同步时创建临时工作区，完成后自动彻底清理）

### 配置备份与换机迁移
进入 Web 管理界面的**“系统设置”** -> **“配置备份与数据迁移”**：
- 点击**“导出配置 JSON”**：导出已监控的仓库、分支与同步规则（**导出的文件不包含任何敏感 Token**）。
- 在新电脑上部署后，点击**“导入配置 JSON”**并绑定新 Token 即可恢复全部监控。

---

## ⚙️ Windows 开机自启配置

双击运行 **`scripts\autostart.bat`**：
1. 输入 `1`：自动在 Windows 任务计划程序中创建开机登录自启任务（若权限受限会自动创建 Windows 启动文件夹快捷方式）。
2. 输入 `2`：一键取消自启任务。

---

## 🧪 自动化测试验证

本项目包含完整的单元测试与集成测试，覆盖分支提交拓扑计算、本地真实裸仓库拉取与快进推送、AES 密钥加密、SQLite DAO 数据层及防并发互斥锁：

```bash
# 运行全部 Vitest 测试套件
npm run test
```

测试覆盖清单：
- `tests/comparison.test.ts`：测试 6 种分支拓扑关系（Identical、Behind Safe、Ahead、Diverged、Incompatible、Force-Pushed Rewritten）。
- `tests/sync.test.ts`：测试安全 Git 执行器、仓库级互斥锁、以及本地真实裸 Git 仓库（Bare Repository）的提交生成与快进推送。
- `tests/security.test.ts`：测试 AES-256-GCM 加解密、Token 掩码脱敏、日志敏感词过滤。
- `tests/storage.test.ts`：测试 SQLite 数据迁移、WAL 模式、Account、Repository、SyncConfig 与 Settings DAO。

---

## ❓ 常见问题排查 (FAQ)

### Q1: 提示端口 3847 被占用？
系统内置端口冲突自适应机制。如果 3847 端口被其它软件占用，程序会自动尝试 3848、3849 并以正确的可用端口自动打开浏览器。

### Q2: 提示“已有程序在后台运行中，禁止重复启动多实例”？
系统内置单实例文件锁（`app.lock`）。请检查任务栏或后台进程是否已有 `GitForkSync` 正在运行。如为异常断电残留锁，程序会自动根据 PID 检查清理。

### Q3: 为什么某个仓库显示“分支已分叉，暂停自动同步”？
说明您的目标分支存在个人提交，同时上游也产生了新提交。为了保护您的个人修改不被覆盖，系统会自动暂停同步并展示比较链接，建议您进入 GitHub 手动处理合并。

### Q4: 提示 Git Push 失败：“[remote rejected] ... protected branch hook declined”？
这说明您的 GitHub 仓库对该分支设置了“分支保护规则”（Branch Protection Rules，如要求 PR 审查或禁止直接推送到 main）。建议将该仓库的同步目标分支修改为 `upstream-sync`（模式 A）。

---

## 📜 许可说明

本项目仅供个人开发者在 Windows 本地管理自己的 GitHub Fork 仓库。遵循 MIT 开源许可协议。
