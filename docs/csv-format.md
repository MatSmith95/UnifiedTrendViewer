# CSV Format

Preferred long-format CSV:

```csv
TimestampUTC,TagName,Value,Quality
2026-06-26T08:00:01.120Z,Vehicle_HP_Pressure,143.2,192
```

Required columns:

- `TimestampUTC`
- `TagName`
- `Value`

Optional column:

- `Quality`

The parser adapter lives in `src/parsers/csvAdapter.ts` so future `UnifiedDBtoCSV` output differences can be isolated to one place.
