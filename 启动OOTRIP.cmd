@echo off
setlocal
set "PATH=C:\Users\86136\AppData\Local\OOTRIP-tools\node-v24.16.0-win-x64;%PATH%"
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-ootrip.ps1"
if errorlevel 1 pause
endlocal
