$ErrorActionPreference = 'Stop'

Write-Host 'Building hosted web frontend...'
npm install
npm run build:web

Write-Host 'Publishing Windows single-file application...'
dotnet publish server -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -o publish/win-x64

Write-Host "Done. Output: $PWD/publish/win-x64"
