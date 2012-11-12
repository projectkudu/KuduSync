@echo off

call npm install

IF NOT EXIST %~dp0\bin mkdir %~dp0\bin
echo Building JavaScript from TypeScript files
call npm run-script build
