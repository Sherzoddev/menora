@echo off
REM Кладёт ярлык на Menora.vbs в папку автозагрузки Windows, чтобы программа
REM запускалась сама при включении компьютера. Запустить один раз двойным
REM кликом. При автозапуске окно настройки не появится — если конфиг уже
REM сохранён, программа сразу свернётся в трей и начнёт ждать заказы.
setlocal
set "SCRIPT_DIR=%~dp0"
set "STARTUP_DIR=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"

powershell -NoProfile -Command ^
  "$s = (New-Object -ComObject WScript.Shell).CreateShortcut('%STARTUP_DIR%\MenoraPrintAgent.lnk');" ^
  "$s.TargetPath = '%SCRIPT_DIR%Menora.vbs';" ^
  "$s.WorkingDirectory = '%SCRIPT_DIR%';" ^
  "$s.WindowStyle = 7;" ^
  "$s.Save()"

echo Готово! Menora будет запускаться сама при включении компьютера.
pause
