import Papa from 'papaparse';
import type { CsvAdapterResult, TrendPoint } from '../types/trend';

type CsvRecord = Record<string, string>;

const headerAliases = {
  timestamp: ['TimestampUTC', 'Timestamp', 'TimeStampUtc', 'UtcTimestamp'],
  tagName: ['TagName', 'Tag', 'Name'],
  value: ['Value', 'TagValue', 'NumericValue'],
  quality: ['Quality', 'TagQuality'],
};

export function parseTrendCsv(csvText: string, sourceName: string): CsvAdapterResult {
  const parseResult = Papa.parse<CsvRecord>(csvText, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (value) => value.trim(),
  });

  const warnings: string[] = [];
  const fields = parseResult.meta.fields ?? [];
  const timestampField = findField(fields, headerAliases.timestamp);
  const tagField = findField(fields, headerAliases.tagName);
  const valueField = findField(fields, headerAliases.value);
  const qualityField = findField(fields, headerAliases.quality);

  if (!timestampField || !tagField || !valueField) {
    throw new Error(
      'CSV is missing one or more required columns. Expected at least TimestampUTC, TagName, Value.',
    );
  }

  const points: TrendPoint[] = [];

  parseResult.data.forEach((row, index) => {
    const timestamp = row[timestampField]?.trim();
    const tagName = row[tagField]?.trim();
    const valueText = row[valueField]?.trim();
    const qualityText = qualityField ? row[qualityField]?.trim() : undefined;

    if (!timestamp || !tagName) {
      warnings.push(`Row ${index + 2} is missing TimestampUTC or TagName and was skipped.`);
      return;
    }

    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) {
      warnings.push(`Row ${index + 2} has invalid timestamp "${timestamp}" and was skipped.`);
      return;
    }

    let numericValue: number | null = null;
    if (valueText !== undefined && valueText !== '') {
      numericValue = Number(valueText);
      if (Number.isNaN(numericValue)) {
        numericValue = null;
        warnings.push(`Row ${index + 2} has non-numeric value "${valueText}".`);
      }
    }

    let quality: number | null = null;
    if (qualityText !== undefined && qualityText !== '') {
      quality = Number(qualityText);
      if (Number.isNaN(quality)) {
        quality = null;
        warnings.push(`Row ${index + 2} has non-numeric quality "${qualityText}".`);
      }
    }

    points.push({
      timestampUtc: date.toISOString(),
      tagName,
      value: numericValue,
      quality,
      qualityText: describeQuality(quality),
    });
  });

  points.sort((left, right) => left.timestampUtc.localeCompare(right.timestampUtc));
  return { points, warnings: dedupe(warnings), sourceName };
}

function findField(fields: string[], aliases: string[]): string | undefined {
  return fields.find((field) => aliases.includes(field));
}

function describeQuality(quality: number | null): string | undefined {
  if (quality === null || quality === undefined) {
    return undefined;
  }

  if (quality === 192) {
    return 'Good';
  }

  if (quality >= 128) {
    return 'Uncertain';
  }

  return 'Bad';
}

function dedupe(values: string[]): string[] {
  return [...new Set(values)];
}
