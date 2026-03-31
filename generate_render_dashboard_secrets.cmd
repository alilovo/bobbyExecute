@echo off
setlocal EnableExtensions DisableDelayedExpansion

REM BobbyExecute dashboard secret generator
REM Requirements: Node.js and PowerShell available in PATH

where node >nul 2>nul
if errorlevel 1 (
  echo [ERROR] Node.js was not found in PATH.
  echo Install Node.js, then run this script again.
  exit /b 1
)

where powershell >nul 2>nul
if errorlevel 1 (
  echo [ERROR] PowerShell was not found in PATH.
  echo This script uses PowerShell only for hidden password input.
  exit /b 1
)

set "ITERATIONS=120000"

echo.
echo === BobbyExecute Render Dashboard Secret Generator ===
echo.
echo This script generates:
echo   1. DASHBOARD_SESSION_SECRET
echo   2. DASHBOARD_OPERATOR_DIRECTORY_JSON

echo.
:ask_session
set "MAKE_SESSION=Y"
set /p "MAKE_SESSION=Generate a fresh DASHBOARD_SESSION_SECRET? [Y/n]: "
if /I "%MAKE_SESSION%"=="" set "MAKE_SESSION=Y"
if /I "%MAKE_SESSION%"=="Y" goto session_ok
if /I "%MAKE_SESSION%"=="YES" goto session_ok
if /I "%MAKE_SESSION%"=="N" goto session_skip
if /I "%MAKE_SESSION%"=="NO" goto session_skip
echo Please answer Y or N.
goto ask_session

:session_ok
for /f "usebackq delims=" %%S in (`node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`) do set "SESSION_SECRET=%%S"
goto collect_user

:session_skip
set "SESSION_SECRET="
goto collect_user

:collect_user
echo.
set /p "USERNAME=Username: "
if "%USERNAME%"=="" (
  echo Username cannot be empty.
  goto collect_user
)

echo.
set /p "DISPLAY_NAME=Display name: "
if "%DISPLAY_NAME%"=="" (
  echo Display name cannot be empty.
  goto collect_user
)

echo.
:ask_role
set /p "ROLE=Role [viewer/operator/admin]: "
if /I "%ROLE%"=="viewer" goto role_ok
if /I "%ROLE%"=="operator" goto role_ok
if /I "%ROLE%"=="admin" goto role_ok
echo Role must be one of: viewer, operator, admin.
goto ask_role

:role_ok
echo.
:ask_active
set "ACTIVE=true"
set /p "ACTIVE=Active user? [Y/n]: "
if /I "%ACTIVE%"=="" set "ACTIVE=true"
if /I "%ACTIVE%"=="Y" set "ACTIVE=true"
if /I "%ACTIVE%"=="YES" set "ACTIVE=true"
if /I "%ACTIVE%"=="N" set "ACTIVE=false"
if /I "%ACTIVE%"=="NO" set "ACTIVE=false"
if /I not "%ACTIVE%"=="true" if /I not "%ACTIVE%"=="false" (
  echo Please answer Y or N.
  goto ask_active
)

echo.
echo Enter operator password in the hidden prompt window.
:ask_password
for /f "usebackq delims=" %%P in (`powershell -NoProfile -Command "$p = Read-Host 'Password' -AsSecureString; $b = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($p); try { [Runtime.InteropServices.Marshal]::PtrToStringAuto($b) } finally { if ($b -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($b) } }"`) do set "PASS=%%P"
if "%PASS%"=="" (
  echo Password cannot be empty.
  goto ask_password
)

echo.
set "USER=%USERNAME%"
set "DISPLAY=%DISPLAY_NAME%"
set "ROLE=%ROLE%"
set "ACTIVE_BOOL=%ACTIVE%"

for /f "usebackq delims=" %%J in (`node -e "const {randomBytes,pbkdf2Sync}=require('node:crypto'); const iterations=Number(process.env.ITERATIONS||120000); const salt=randomBytes(16).toString('hex'); const hash=pbkdf2Sync(process.env.PASS,salt,iterations,64,'sha512').toString('base64url'); process.stdout.write(JSON.stringify([{username:process.env.USER,displayName:process.env.DISPLAY,role:process.env.ROLE,active:String(process.env.ACTIVE_BOOL).toLowerCase()==='true',passwordSalt:salt,passwordHash:hash,passwordIterations:iterations}]));"`) do set "OPERATOR_JSON=%%J"

set "PASS="

echo.
echo === OUTPUT ===
echo.
if defined SESSION_SECRET (
  echo DASHBOARD_SESSION_SECRET=%SESSION_SECRET%
  echo.
)
echo DASHBOARD_OPERATOR_DIRECTORY_JSON=%OPERATOR_JSON%
echo.

echo === Render block ===
echo.
if defined SESSION_SECRET echo DASHBOARD_SESSION_SECRET=%SESSION_SECRET%
echo DASHBOARD_OPERATOR_DIRECTORY_JSON=%OPERATOR_JSON%
echo.

set "OUTPUT_FILE=render_dashboard_secrets.txt"
(
  if defined SESSION_SECRET echo DASHBOARD_SESSION_SECRET=%SESSION_SECRET%
  echo DASHBOARD_OPERATOR_DIRECTORY_JSON=%OPERATOR_JSON%
) > "%OUTPUT_FILE%"

echo Saved to %CD%\%OUTPUT_FILE%
echo.
echo Done.
exit /b 0
