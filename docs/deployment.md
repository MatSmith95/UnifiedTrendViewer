# Deployment

Recommended first deployment:

1. Publish the combined ASP.NET Core application on the WinCC Unified Runtime PC
2. Run the local executable so it serves both the UI and API
3. Point a Unified Web Control / browser object to the local URL
4. Feed the viewer with CSV files from a separate export/conversion process

Suggested local CSV folder:

```text
C:\UnifiedTrendExports
```

Do not query live WinCC Unified `.db3` files directly from the browser.

## Windows Publish Flow

From the repo root on the Runtime PC:

```powershell
.\scripts\publish-windows.bat
```

Published output:

```text
publish\win-x64\
```

Start the viewer/API host:

```powershell
.\publish\win-x64\server.exe
```

Open:

```text
http://127.0.0.1:5262/trends/
```

## API Checks Before WinCC Unified Testing

Verify these endpoints on the Runtime PC:

- `/api/health`
- `/api/config`
- `/api/tags`
- `/api/trend?tags=Vehicle_HP_Pressure&from=2026-06-26T08:00:00Z&to=2026-06-26T09:00:00Z`

This makes it easier to separate SCADA embedding issues from CSV/API issues.

## WinCC Unified URL

Recommended Web Control target:

```text
http://127.0.0.1:5262/trends/
```
