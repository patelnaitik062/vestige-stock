@echo off
setlocal
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0BUILD-APK.ps1"
if errorlevel 1 (
  echo.
  echo Build did not finish. Read the error above.
)
pause
