@echo off
setlocal

echo Building hosted web frontend...
call npm install
if errorlevel 1 exit /b %errorlevel%

call npm run build:web
if errorlevel 1 exit /b %errorlevel%

echo Publishing Windows single-file application...
dotnet publish server -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -o publish\win-x64
if errorlevel 1 exit /b %errorlevel%

echo Done. Output:
echo %cd%\publish\win-x64
