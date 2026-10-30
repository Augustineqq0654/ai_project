@echo off
setlocal
cd /d "%~dp0"

rem Local preview launcher.
rem Browsers refuse to read excluded.json / data/calendar.json over file:// (CORS),
rem so the page must be served over http://. This script picks Node.js (preferred)
rem or Python to start a static server and opens the browser.
rem Usage: double-click, or "start.bat 8080", or "start.bat --no-open".
rem NOTE: this file is saved as GBK/ANSI on purpose (cmd.exe parses it natively).

where node >nul 2>nul
if %errorlevel%==0 goto :node

where py >nul 2>nul
if %errorlevel%==0 goto :usepy

where python >nul 2>nul
if %errorlevel%==0 goto :usepython

echo.
echo [错误] 未找到 Node.js 或 Python，请先安装其中之一：
echo        Node.js: https://nodejs.org/
echo        Python:  https://www.python.org/
echo.
pause
exit /b 1

:node
echo.
echo 正在用 Node.js 启动本地预览服务（浏览器会自动打开）
echo 页面必须经 http:// 访问，直接双击 index.html 会因 CORS 读不到数据快照
echo 停止服务：按 Ctrl+C 或直接关闭本窗口
echo.
node "scripts\serve.js" %*
goto :end

:usepy
set "PY=py"
goto :python

:usepython
set "PY=python"

:python
set "PORT=8000"
if not "%~1"=="" set "PORT=%~1"
echo.
echo 未检测到 Node.js，改用 Python 启动本地预览服务
echo 访问地址：http://localhost:%PORT%/
echo 停止服务：按 Ctrl+C 或直接关闭本窗口
echo.
start "" "http://localhost:%PORT%/"
%PY% -m http.server %PORT%
goto :end

:end
echo.
echo 服务已停止。按任意键关闭窗口...
pause >nul
