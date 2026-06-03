@echo off
REM Nexu Build Script — PyInstaller single .exe

echo ============================================
echo  Building Nexu — AI Desktop Assistant
echo ============================================
echo.

REM Check for PyInstaller
where pyinstaller >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo [ERROR] PyInstaller not found. Install with:
    echo   pip install pyinstaller
    pause
    exit /b 1
)

REM Install requirements
echo [1/4] Installing dependencies...
pip install -r requirements.txt
if %ERRORLEVEL% neq 0 (
    echo [WARNING] Some deps may have failed, continuing...
)

REM Install PyInstaller-specific deps
pip install pyinstaller pyperclip PyPDF2 pyautogui

REM Build
echo [2/4] Running PyInstaller...
pyinstaller --noconfirm --onefile --windowed --name "Nexu" ^
    --add-data ".env;." ^
    --hidden-import pyaudio ^
    --hidden-import pynput ^
    --hidden-import groq ^
    --hidden-import edge_tts ^
    --hidden-import pygame ^
    --hidden-import psutil ^
    --hidden-import plyer ^
    --hidden-import playwright ^
    --hidden-import comtypes ^
    --hidden-import pycaw ^
    --hidden-import pyperclip ^
    --hidden-import PyPDF2 ^
    --hidden-import google.generativeai ^
    --hidden-import memory.store ^
    --hidden-import memory.vector ^
    --hidden-import tools.executor ^
    --hidden-import tools.files ^
    --hidden-import tools.system ^
    --hidden-import tools.browser ^
    --hidden-import tools.browser_automation ^
    --hidden-import tools.whatsapp ^
    --hidden-import tools.memory ^
    --hidden-import tools.extra ^
    main.py

if %ERRORLEVEL% neq 0 (
    echo [ERROR] Build failed!
    pause
    exit /b 1
)

echo [3/4] Build complete! Checking output...
if exist "dist\Nexu.exe" (
    echo   Output: dist\Nexu.exe
) else (
    echo   [WARNING] Output not found in dist\
)

echo [4/4] Done!
echo.
echo To run: dist\Nexu.exe
echo To install: double-click install.bat
pause
