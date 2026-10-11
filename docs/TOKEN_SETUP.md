# GitHub Token 创建与权限配置指南

本项目支持使用 GitHub **Fine-grained Personal Access Token**（细粒度访问令牌，强烈推荐）或传统的 **Classic Token**。

出于安全考虑，系统严格遵循**“最小权限原则”**，不会索取额外的敏感权限。

---

## 一、推荐方案：Fine-grained Personal Access Token（细粒度令牌）

### 步骤 1：进入 GitHub 令牌生成页面
1. 登录您的 GitHub 账号。
2. 点击右上角个人头像，选择 **Settings**（设置）。
3. 在左侧菜单滚动到底部，点击 **Developer settings**（开发者设置）。
4. 点击 **Personal access tokens** -> **Fine-grained tokens**。
5. 点击右上角 **Generate new token**。

### 步骤 2：基本信息填写
- **Token name**：建议填写 `GitForkSync-Local`（或自定义名称）。
- **Expiration**：选择过期时间（如 90 天或自定义）。过期后可在本系统界面中一键“更换 Token”。
- **Description**：`Local Windows fork auto sync manager`。

### 步骤 3：仓库访问范围（Repository access）
- **Only select repositories**（仅选定仓库）：选择您希望本工具管理和同步的 Fork 仓库（安全性最高）。
- 或选择 **All repositories**（所有仓库，若希望自动管理账号下的所有仓库）。

### 步骤 4：设置必要权限（Repository permissions）
在 **Repository permissions** 折叠栏中，找到并设置以下两项：

| 权限项 | 权限级别 | 作用说明 |
|---|---|---|
| **Contents** | **Read and write** (读与写) | 用于拉取分支信息并向您的 Fork 目标分支推送上游新提交 |
| **Metadata** | **Read-only** (只读) | 用于读取仓库基础信息、默认分支与 Fork 来源（GitHub 默认强制开启） |

> **提示（关于 GitHub Actions 工作流文件）：**  
> 如果您要同步的上游仓库在更新中修改了 `.github/workflows/` 下的 CI/CD 文件，GitHub 要求 Token 具备 **Workflows: Read and write** 权限。若您遇到此类上游更新，可按需为 Token 开启此权限。

### 步骤 5：生成并保存
1. 点击底部的 **Generate token** 绿色按钮。
2. 复制生成的令牌（以 `github_pat_` 开头）。
3. 粘贴到 GitForkSync 网页向导或设置界面的输入框中。

---

## 二、备用方案：Classic Personal Access Token（经典令牌）

若您的项目组织不支持细粒度令牌，可创建经典令牌：
1. 进入 **Personal access tokens** -> **Tokens (classic)**。
2. 点击 **Generate new token (classic)**。
3. 勾选权限：
   - `repo`（完整仓库控制权限：Contents、Commit、Branch 读写）。
4. 生成并复制以 `ghp_` 开头的令牌。

---

## 三、安全承诺与保障机制

1. **本地专属保护**：Token 仅在 Windows 本地使用，绝对不上传任何第三方云服务器。
2. **AES-256-GCM 高强度加密**：Token 存入 SQLite 数据库前经过本地专属主密钥加密，数据库中绝不存在明文 Token。
3. **前端防泄露**：API 接口只返回掩码格式（如 `github_...4567`），绝不向前端传输明文密钥。
4. **Git AskPass 协议**：调用 Git 命令行时，使用受控的进程间 AskPass 管道应答，Token 不会暴露在任何命令行参数、系统进程列表或远程 Git URL 中。
5. **日志自动脱敏**：系统内置敏感词过滤机制，任何日志打印都会将令牌自动替换为 `[REDACTED]`。
