# Deployment

Recommended first deployment:

1. Run the viewer locally on the WinCC Unified Runtime PC
2. Point a Unified Web Control / browser object to the local URL
3. Feed the viewer with CSV files from a separate export/conversion process

Suggested local CSV folder:

```text
C:\UnifiedTrendExports
```

Do not query live WinCC Unified `.db3` files directly from the browser.

## API Checks Before WinCC Unified Testing

Verify these endpoints on the Runtime PC:

- `/api/health`
- `/api/config`
- `/api/tags`
- `/api/trend?tags=Vehicle_HP_Pressure&from=2026-06-26T08:00:00Z&to=2026-06-26T09:00:00Z`

This makes it easier to separate SCADA embedding issues from CSV/API issues.
