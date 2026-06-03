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

REM Find Nexu (exe or dev script)
set "EXE_PATH=%~dp0dist\Nexu.exe"
if exist "%EXE_PATH%" (
    set "TARGET=%EXE_PATH%"
    set "ARGUMENTS="
) else (
    echo [INFO] No dist\Nexu.exe found — using dev script instead.
    set "TARGET=python"
    set "ARGUMENTS=%~dp0main.py --install"
)

REM Install auto-start
echo [1/3] Installing auto-start...
if not "%ARGUMENTS%"=="" (
    %TARGET% %ARGUMENTS%
) else (
    copy /Y "%EXE_PATH%" "%NEXU_DIR%\Nexu.exe"
    set "TARGET=%NEXU_DIR%\Nexu.exe"
    set "ARGUMENTS="
)

REM Create desktop shortcut
echo [2/3] Creating desktop shortcut...
set "DESKTOP=%USERPROFILE%\Desktop"
if exist "%DESKTOP%" (
    powershell -Command "$WS = New-Object -ComObject WScript.Shell; $SC = $WS.CreateShortcut('%DESKTOP%\Nexu.lnk'); $SC.TargetPath = '%TARGET%'; $SC.Arguments = '%ARGUMENTS%'; $SC.WorkingDirectory = '%NEXU_DIR%'; $SC.Description = 'Nexu AI Desktop Assistant'; $SC.Save()"
    echo   Shortcut created on Desktop
) else (
    echo   [WARNING] Could not create desktop shortcut
)

REM Also add to startup
echo [3/3] Adding to Windows startup...
if exist "%STARTUP_DIR%" (
    if not "%ARGUMENTS%"=="" (
        %TARGET% %ARGUMENTS%
    ) else (
        powershell -Command "$WS = New-Object -ComObject WScript.Shell; $SC = $WS.CreateShortcut('%STARTUP_DIR%\Nexu.lnk'); $SC.TargetPath = '%TARGET%'; $SC.WorkingDirectory = '%NEXU_DIR%'; $SC.Description = 'Nexu AI Desktop Assistant'; $SC.Save()"
        echo   Added to startup
    )
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
