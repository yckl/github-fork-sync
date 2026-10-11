@echo off
chcp 65001 >nul
title GitHub Fork 自动同步管理器 (GitForkSync)

echo ======================================================================
echo           GitHub Fork 自动同步管理器 (Windows 本地版)
echo ======================================================================
echo.

:: 1. 检查 Node.js 环境
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [错误] 未检测到 Node.js 运行环境！
    echo 请先前往 https://nodejs.org/ 下载并安装 Node.js LTS (推荐 20.x 或以上版本)。
    echo 安装完成后，请重新双击运行本脚本。
    echo.
    pause
    exit /b 1
)

:: 2. 检查 Git 环境
where git >nul 2>nul
if %errorlevel% neq 0 (
    echo [错误] 未检测到 Git 命令行工具！
    echo 请先前往 https://git-scm.com/download/win 安装 Git for Windows。
    echo 安装时请确保将 Git 添加到系统 PATH 环境变量。
    echo.
    pause
    exit /b 1
)

:: 3. 检查依赖包是否已安装
if not exist "node_modules" (
    echo [提示] 首次运行，正在自动安装项目依赖，请稍候...
    call npm install
    if %errorlevel% neq 0 (
        echo [错误] 依赖安装失败，请检查网络连接后重试！
        pause
        exit /b 1
    )
)

:: 4. 检查是否已完成构建
if not exist "apps\server\dist" (
    echo [提示] 正在执行全量编译构建...
    call npm run build
    if %errorlevel% neq 0 (
        echo [错误] 编译构建失败，请检查控制台错误信息！
        pause
        exit /b 1
    )
)

if not exist "apps\web\dist" (
    echo [提示] 正在编译前端管理界面...
    call npm run build --workspace=@gitforksync/web
    if %errorlevel% neq 0 (
        echo [错误] 前端界面编译失败！
        pause
        exit /b 1
    )
)

echo.
echo [提示] 正在启动后台服务，稍后将自动在浏览器中打开管理后台...
echo [提示] 默认本地地址: http://127.0.0.1:3847
echo [提示] 关闭浏览器后后台服务将持续保持运行；关闭本窗口将停止后台检测。
echo.

:: 5. 启动正式服务
call npm start

pause
