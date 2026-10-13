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

@REM Auto-detect Windows system proxy from Registry if not already set
if "%HTTP_PROXY%"=="" (
    for /f "tokens=2*" %%a in ('reg query "HKCU\Software\Microsoft\Windows\CurrentVersion\Internet Settings" /v ProxyEnable 2^>nul') do set "PROXY_ENABLED=%%b"
    if "%PROXY_ENABLED%"=="0x1" (
        for /f "tokens=2*" %%a in ('reg query "HKCU\Software\Microsoft\Windows\CurrentVersion\Internet Settings" /v ProxyServer 2^>nul') do (
            set "HTTP_PROXY=http://%%b"
            set "HTTPS_PROXY=http://%%b"
            set "ALL_PROXY=http://%%b"
            echo [INFO] Auto-detected Windows system proxy: http://%%b
        )
    )
)

node apps\server\dist\index.js

if %errorlevel% neq 0 (
    echo.
    echo [INFO] Service has stopped.
    pause
)
