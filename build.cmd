@echo off

call npm install

echo Building JavaScript from TypeScript files
call npm run-script build
