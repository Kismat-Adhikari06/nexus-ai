@echo off
REM Nexu Installer — Auto-start with Windows + Desktop shortcut
title Nexu Installer

echo ============================================
echo  Installing Nexu — AI Desktop Assistant
echo ============================================
echo.

REM Check admin rights
net session >nul 2>&1
if %ERRORLEVEL% neq 0 (
    echo [INFO] Not running as admin. Some features may require admin.
    echo.
)

set "NEXU_DIR=%USERPROFILE%\.nexu"
set "STARTUP_DIR=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"

if not exist "%NEXU_DIR%" mkdir "%NEXU_DIR%"

REM Find Nexu.exe
set "EXE_PATH=%~dp0dist\Nexu.exe"
if not exist "%EXE_PATH%" (
    echo [ERROR] dist\Nexu.exe not found.
    echo   Run build.bat first to create the executable.
    pause
    exit /b 1
)

REM Copy to .nexu folder
echo [1/3] Copying Nexu to %NEXU_DIR%...
copy /Y "%EXE_PATH%" "%NEXU_DIR%\Nexu.exe"

REM Create desktop shortcut
echo [2/3] Creating desktop shortcut...
set "DESKTOP=%USERPROFILE%\Desktop"
if exist "%DESKTOP%" (
    set "SHORTCUT_PATH=%DESKTOP%\Nexu.lnk"
    powershell -Command "$WS = New-Object -ComObject WScript.Shell; $SC = $WS.CreateShortcut('%SHORTCUT_PATH%'); $SC.TargetPath = '%NEXU_DIR%\Nexu.exe'; $SC.WorkingDirectory = '%NEXU_DIR%'; $SC.Description = 'Nexu AI Desktop Assistant'; $SC.Save()"
    echo   Shortcut created on Desktop
) else (
    echo   [WARNING] Could not create desktop shortcut
)

REM Add to startup
echo [3/3] Adding to Windows startup...
if exist "%STARTUP_DIR%" (
    set "STARTUP_SHORTCUT=%STARTUP_DIR%\Nexu.lnk"
    powershell -Command "$WS = New-Object -ComObject WScript.Shell; $SC = $WS.CreateShortcut('%STARTUP_SHORTCUT%'); $SC.TargetPath = '%NEXU_DIR%\Nexu.exe'; $SC.WorkingDirectory = '%NEXU_DIR%'; $SC.Description = 'Nexu AI Desktop Assistant'; $SC.Save()"
    echo   Added to startup
) else (
    echo   [WARNING] Could not add to startup
)

echo.
echo ============================================
echo  Installation Complete!
echo ============================================
echo.
echo  Nexu will now:
echo    - Start automatically when you log in
echo    - Appear in your system tray
echo    - Listen for F4 (hold to talk) or F3 (text mode)
echo.
echo  To uninstall:
echo    - Delete %NEXU_DIR%\Nexu.exe
echo    - Remove from %STARTUP_DIR%
echo    - Delete desktop shortcut
echo.
pause
