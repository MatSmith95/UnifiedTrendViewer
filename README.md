# UnifiedTrendViewer

UnifiedTrendViewer is a web-based historical trend viewer for Siemens WinCC Unified SCADA projects. It is designed to display CSV trend exports that were generated from WinCC Unified historical `.db3` segment files by a separate converter.

This repository is intentionally focused on the operator-facing trend display layer. It does not query live WinCC Unified `.db3` files directly.

## Related Project

The existing `.db3` to CSV conversion logic lives in a separate repository:

- `UnifiedDBtoCSV`: https://github.com/MatSmith95/UnifiedDBtoCSV

This repo assumes CSV files created by that converter can later be dropped into a watched export folder or served by a local API.

## What This Project Does

- Loads long-format CSV trend data
- Displays one or more selected tags as trend lines
- Filters by date/time range
- Searches and filters available tag names
- Enables and disables pens
- Provides preset trend groups
- Shows legend stats: latest, min, max, average, quality summary
- Supports zooming and panning with Apache ECharts
- Exports the currently filtered view to CSV
- Handles missing and malformed data with visible warnings

## CSV Format

Preferred long format:

```csv
TimestampUTC,TagName,Value,Quality
2026-06-26T08:00:01.120Z,Vehicle_HP_Pressure,143.2,192
2026-06-26T08:00:02.120Z,Vehicle_HP_Pressure,143.6,192
2026-06-26T08:00:01.120Z,Vehicle_LP_Flow,22.5,192
```

The parser adapter is isolated in `src/parsers/csvAdapter.ts` so alternate column layouts from `UnifiedDBtoCSV` can be adapted in one place.

## Running Locally

### Front-end only with bundled sample data

```powershell
npm install
npm run dev
```

### API mode during development

Terminal 1:

```powershell
dotnet run --project server
```

Terminal 2:

```powershell
npm run dev
```

Then browse to:

```text
http://localhost:5173/?apiBaseUrl=http://localhost:5262
```

## Windows Runtime PC Deployment

Recommended for a real test application or WinCC Unified screen embed:

1. Configure `server/appsettings.json` so `TrendData:CsvFolder` points at your exported CSV folder
2. Run `scripts\publish-windows.bat` on the Runtime PC
3. Start the published executable from `publish\win-x64`
4. Open `http://127.0.0.1:5262/trends/`
5. The viewer will default to the same local API automatically
6. Confirm `/api/health`, `/api/config`, tag discovery, and trend loading all work against real exports

The API reports:

- health state
- configured CSV folder
- file pattern
- file count
- warnings and parsing errors

This is the cleanest local setup because one ASP.NET Core process hosts:

- the trend viewer UI
- the `/api/*` endpoints
- a stable local URL for WinCC Unified Web Control embedding

## Windows Build / Publish

```powershell
npm run build
```

Hosted publish output:

```powershell
npm run publish:windows
```

## Test Ready Checklist

1. `npm run build` passes
2. `scripts\publish-windows.bat` completes on Windows
3. `/api/health` returns `ok` or `degraded` with a useful error
4. `/api/config` shows the expected CSV folder and file count
5. `http://127.0.0.1:5262/trends/` opens and loads the hosted viewer
6. Front end connects to the API and discovers real tags
7. WinCC Unified Web Control can point at `http://127.0.0.1:5262/trends/`
8. Date-range queries return filtered results
9. Exported filtered CSV matches the charted subset
10. Missing/malformed CSV files show warnings instead of a crash

## WinCC Unified Fit

- Intended for embedding in a WinCC Unified Web Control / browser object
- Safe separation from the `.db3` conversion process
- Structured so a Siemens Custom Web Control package can be added later

See:

- `docs/csv-format.md`
- `docs/deployment.md`
- `docs/siemens-unified-integration.md`
