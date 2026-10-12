@echo off
setlocal EnableExtensions DisableDelayedExpansion
title G-WIZ Updater
rem ---------------------------------------------------------------------------
rem  G-WIZ Updater
rem  Installs a newer G-WIZ release into this folder.
rem   - Drag a G-WIZ zip onto this file, or
rem   - run it and it finds the newest G-WIZ-*-windows.zip in this folder,
rem     your Downloads folder or your Desktop, or
rem   - put a direct download address in update-url.txt (one line) and it
rem     downloads the zip from there.
rem  The current version is copied to backup\<version> before anything changes.
rem ---------------------------------------------------------------------------

set "APPDIR=%~dp0"
if "%APPDIR:~-1%"=="\" set "APPDIR=%APPDIR:~0,-1%"
cd /d "%APPDIR%"
set "CURVER=unknown"
if exist "%APPDIR%\version.txt" set /p CURVER=<"%APPDIR%\version.txt"
set "ZIP="
set "DOWNLOADED="
set "STAGE="

echo.
echo  G-WIZ Updater
echo  =============
echo  Installed version : %CURVER%
echo  Folder            : %APPDIR%
echo.

rem ---- 1. a zip dropped onto this file ----
if "%~1"=="" goto :tryurl
if /i not "%~x1"==".zip" goto :notzip
set "ZIP=%~f1"
goto :havezip

:notzip
echo  "%~nx1" is not a .zip file. Drag the G-WIZ zip you downloaded onto this file.
goto :fail

rem ---- 2. download address in update-url.txt ----
:tryurl
if not exist "%APPDIR%\update-url.txt" goto :search
set "URL="
set /p URL=<"%APPDIR%\update-url.txt"
if not defined URL goto :search
echo  Downloading the latest version from:
echo    "%URL%"
set "ZIP=%TEMP%\G-WIZ-update.zip"
set "DOWNLOADED=1"
if exist "%ZIP%" del /f /q "%ZIP%" >nul 2>&1
powershell -NoProfile -ExecutionPolicy Bypass -Command "$ProgressPreference='SilentlyContinue'; [Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -UseBasicParsing -Uri $env:URL -OutFile $env:ZIP"
if errorlevel 1 goto :dlfail
if not exist "%ZIP%" goto :dlfail
goto :havezip

:dlfail
echo  The download did not work. Check your connection and the address in update-url.txt.
goto :fail

rem ---- 3. look for the newest zip nearby ----
:search
for %%D in ("%APPDIR%" "%USERPROFILE%\Downloads" "%USERPROFILE%\Desktop") do (
  if not defined ZIP for /f "delims=" %%F in ('dir /b /a-d /o-d "%%~D\G-WIZ-*-windows.zip" 2^>nul') do if not defined ZIP set "ZIP=%%~D\%%F"
)
if defined ZIP goto :havezip
echo  No update file was found.
echo.
echo  Download the new G-WIZ zip, then either:
echo    - drag it onto "Update G-WIZ.bat", or
echo    - leave it in your Downloads folder and run this updater again.
goto :end

rem ---- unpack and check ----
:havezip
echo  Update file       : %ZIP%
set "STAGE=%TEMP%\G-WIZ-update-%RANDOM%%RANDOM%"
mkdir "%STAGE%" >nul 2>&1
powershell -NoProfile -ExecutionPolicy Bypass -Command "Expand-Archive -LiteralPath $env:ZIP -DestinationPath $env:STAGE -Force"
if errorlevel 1 goto :badzip
set "SRC=%STAGE%\G-WIZ"
if not exist "%SRC%\G-WIZ.exe" set "SRC=%STAGE%"
if not exist "%SRC%\G-WIZ.exe" goto :badzip
set "NEWVER=unknown"
if exist "%SRC%\version.txt" set /p NEWVER=<"%SRC%\version.txt"
echo  New version       : %NEWVER%
echo.
if /i "%NEWVER%"=="%CURVER%" echo  This is the same version you already have. Installing it again repairs the files.
choice /c YN /m " Install G-WIZ %NEWVER% now"
if errorlevel 2 goto :cancel
goto :checkrun

:badzip
echo  That file could not be unpacked, or it does not contain G-WIZ.exe.
goto :fail

rem ---- make sure G-WIZ is closed ----
:checkrun
tasklist /fi "imagename eq G-WIZ.exe" 2>nul | find /i "G-WIZ.exe" >nul
if errorlevel 1 goto :install
echo.
echo  G-WIZ is still running. Save your work and close its window first.
echo  It can take a few seconds to finish closing after the window is gone.
choice /c RFC /m " R = check again, F = close G-WIZ now, C = cancel"
if errorlevel 3 goto :cancel
if errorlevel 2 (
  taskkill /im G-WIZ.exe /f >nul 2>&1
  timeout /t 2 /nobreak >nul
  goto :checkrun
)
timeout /t 3 /nobreak >nul
goto :checkrun

rem ---- install ----
:install
set "BACKUP=%APPDIR%\backup\%CURVER%"
echo.
echo  Backing up version %CURVER% to backup\%CURVER% ...
if exist "%BACKUP%" rd /s /q "%BACKUP%"
mkdir "%BACKUP%" >nul 2>&1
for %%X in ("G-WIZ.exe" "README.txt" "version.txt" "G-WIZ browser edition.html") do if exist "%APPDIR%\%%~X" copy /y "%APPDIR%\%%~X" "%BACKUP%\" >nul

echo  Installing version %NEWVER% ...
robocopy "%SRC%" "%APPDIR%" /E /XF "Update G-WIZ.bat" /R:2 /W:1 /NFL /NDL /NJH /NJS /NP >nul
if errorlevel 8 goto :copyfail

rem the updater cannot overwrite itself while running; swap it in after this window closes
set "SELFNEW="
if exist "%SRC%\Update G-WIZ.bat" (
  fc /b "%SRC%\Update G-WIZ.bat" "%~f0" >nul 2>&1 || set "SELFNEW=1"
)
if defined SELFNEW copy /y "%SRC%\Update G-WIZ.bat" "%APPDIR%\Update G-WIZ.bat.new" >nul

if defined STAGE if exist "%STAGE%" rd /s /q "%STAGE%"
if defined DOWNLOADED if exist "%ZIP%" del /f /q "%ZIP%" >nul 2>&1
echo.
echo  Done. G-WIZ %NEWVER% is installed.
echo  The previous version is kept in "backup\%CURVER%".
echo.
choice /c YN /m " Start G-WIZ now"
if not errorlevel 2 start "" "%APPDIR%\G-WIZ.exe"
if defined SELFNEW start "" /min cmd /c "timeout /t 2 /nobreak >nul & move /y "%APPDIR%\Update G-WIZ.bat.new" "%~f0" >nul"
exit /b 0

:copyfail
echo  Copying the new files failed. Putting the previous version back ...
robocopy "%BACKUP%" "%APPDIR%" /E /R:2 /W:1 /NFL /NDL /NJH /NJS /NP >nul
goto :fail

:cancel
echo.
echo  Update cancelled. Nothing was changed.
goto :end

:fail
echo.
echo  The update stopped.
goto :end

:end
if defined STAGE if exist "%STAGE%" rd /s /q "%STAGE%"
if defined DOWNLOADED if exist "%ZIP%" del /f /q "%ZIP%" >nul 2>&1
echo.
pause
exit /b
