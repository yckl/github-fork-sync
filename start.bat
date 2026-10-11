@echo off
setlocal
cd /d "%~dp0"
title GitForkSync - GitHub Fork Auto-Sync Manager

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not found. Please install Node.js LTS from https://nodejs.org/
    pause
    exit /b 1
)

where git >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Git is not found. Please install Git for Windows from https://git-scm.com/
    pause
    exit /b 1
)

if not exist "node_modules" (
    echo [INFO] Installing dependencies, please wait...
    call npm install
)

if not exist "apps\server\dist\index.js" (
    echo [INFO] Building server components...
    call npm run build --workspace=@gitforksync/shared
    call npm run build --workspace=@gitforksync/server
)

if not exist "apps\web\dist\index.html" (
    echo [INFO] Building web management console...
    call npm run build --workspace=@gitforksync/web
)

node apps\server\dist\index.js

if %errorlevel% neq 0 (
    echo.
    echo [INFO] Service has stopped.
    pause
)
