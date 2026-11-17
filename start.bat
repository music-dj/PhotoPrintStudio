@echo off
chcp 65001 > nul
title استوديو دمج وطباعة الصور A4 / A5 / A6
echo ========================================================
echo   جاري تشغيل استوديو دمج وطباعة الصور A4 / A5 / A6...
echo ========================================================

where python >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    python server.py
) else (
    echo فتح البرنامج مباشرة في المتصفح...
    start "" "%~dp0index.html"
)
