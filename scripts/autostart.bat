@echo off
chcp 65001 >nul
title GitForkSync 开机自启配置向导

echo ======================================================================
echo           GitForkSync Windows 开机自启配置向导
echo ======================================================================
echo.
echo 1. 开启开机自启 (创建当前用户登录后自启任务)
echo 2. 关闭开机自启 (移除自启任务)
echo 3. 退出
echo.
set /p choice=请输入选项编号 [1-3]: 

if "%choice%"=="1" (
    echo.
    echo 正在配置 Windows 开机自启任务...
    schtasks /create /tn "GitForkSync_AutoStart" /tr "\"%~dp0..\start.bat\"" /sc onlogon /f
    if %errorlevel% equ 0 (
        echo [成功] 开机自启配置成功！每次登录 Windows 后将自动启动同步管理器。
    ) else (
        echo [提示] 任务计划创建失败，正在为您创建启动快捷方式...
        powershell -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut([Environment]::GetFolderPath('Startup') + '\GitForkSync.lnk'); $s.TargetPath = '%~dp0..\start.bat'; $s.WorkingDirectory = '%~dp0..'; $s.Save()"
        echo [成功] 已在 Windows 启动目录创建快捷方式！
    )
) else if "%choice%"=="2" (
    echo.
    echo 正在移除自启配置...
    schtasks /delete /tn "GitForkSync_AutoStart" /f >nul 2>nul
    del "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\GitForkSync.lnk" >nul 2>nul
    echo [成功] 已取消开机自启配置。
) else (
    echo 已退出。
)

echo.
pause
