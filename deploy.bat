@echo off
REM AI交易竞技场模拟平台 - Windows 启动入口
REM 双击运行或在命令行执行: deploy.bat [start|stop|restart|status|config|help]

setlocal

set "SCRIPT_DIR=%~dp0"
set "COMMAND=%~1"

if "%COMMAND%"=="" set "COMMAND=start"

REM 检查 PowerShell 执行策略并运行脚本
powershell -ExecutionPolicy Bypass -File "%SCRIPT_DIR%deploy.ps1" -Command %COMMAND%

if %ERRORLEVEL% neq 0 (
    echo.
    echo 如果遇到权限问题，请以管理员身份运行此脚本
    pause
)

endlocal
