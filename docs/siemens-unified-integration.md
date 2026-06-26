# Siemens Unified Integration

Near-term integration path:

1. Publish the combined local app on the Runtime PC
2. Expose it on a local URL such as `http://127.0.0.1:5262/trends/`
3. Display it in a WinCC Unified Web Control / browser object

Useful runtime query parameters:

- `apiBaseUrl`
- `defaultPreset`
- `defaultHours`
- `mode=operator`
- `engineeringMode=false`

Recommended first production-style test:

- run the published local executable
- verify `/api/health`
- open `http://127.0.0.1:5262/trends/?mode=operator`
- embed that same URL into a Unified Web Control
