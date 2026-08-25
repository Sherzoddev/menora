@echo off
title Menora - печать чеков
cd /d %~dp0
echo Menora print agent starting...
node agent.js
echo.
echo Агент остановился (см. ошибку выше, если есть). Окно можно закрыть.
pause
