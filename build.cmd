@echo off

echo Installing typescript
call npm install -g typescript

echo Building JavaScript from TypeScript files
tsc --module node --out bin\smartCopy.js lib\main.ts
