@echo off
chcp 65001 >nul
title MBTI 人格辩论平台

set "SERVER_DIR=D:\mbti-debate-platform\server"
set "NODE=C:\Program Files\nodejs\node.exe"
if not exist "%NODE%" set "NODE=C:\Users\老2\.workbuddy\binaries\node\versions\22.22.2\node.exe"

cd /d "%SERVER_DIR%"

:: Check if port 3001 is already in use
netstat -ano | findstr ":3001" | findstr "LISTENING" >nul
if %errorlevel% equ 0 (
    echo 服务已在运行，直接打开浏览器...
    goto OPEN_BROWSER
)

echo 正在启动 MBTI 人格辩论平台...
start "MBTI-Server" /MIN "%NODE%" index.js

:: Wait for server to start
:WAIT
timeout /t 1 /nobreak >nul
curl -s http://localhost:3001/api/health >nul 2>&1
if %errorlevel% neq 0 goto WAIT

:OPEN_BROWSER
echo 正在打开辩论平台...
start "" http://localhost:3001
echo 平台已启动！关闭此窗口即可停止服务。
pause >nul
