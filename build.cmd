@echo off

echo Installing typescript
call npm install -g typescript

echo Building JavaScript from TypeScript files
npm run-script build
