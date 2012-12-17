@echo off

setlocal

set GIT_STATUS_RETURN_VALUE=

echo Make sure no outstanding files to commit
FOR /F "tokens=*" %%i IN ('git status -z') DO (
  set GIT_STATUS_RETURN_VALUE=%%i
)

if NOT "%GIT_STATUS_RETURN_VALUE%" == "" (
  git status
  goto error
)

echo Building KuduSync
call build.cmd

echo Testing KuduSync
call npm test
IF %ERRORLEVEL% NEQ 0 goto error

echo Fixing bin\kudusync.js line endings
git commit bin/kudusync.js -m "Auto-generated file"

del bin\kudusync.js
IF %ERRORLEVEL% NEQ 0 goto error

git checkout bin/kudusync.js
IF %ERRORLEVEL% NEQ 0 goto error

echo Testing KuduSync again
call npm test
IF %ERRORLEVEL% NEQ 0 goto error

echo Incrementing KuduSync version
call npm version patch
IF %ERRORLEVEL% NEQ 0 goto error

echo Trying to install KuduSync
call npm install . -g
IF %ERRORLEVEL% NEQ 0 goto error

echo Publishing KuduSync
call npm publish
IF %ERRORLEVEL% NEQ 0 goto error

echo Trying to install KuduSync from npm registry
call npm install kudusync -g
IF %ERRORLEVEL% NEQ 0 goto error

goto end

:error
echo Publishing KuduSync failed
exit /b 1

:end
echo Published successfully
