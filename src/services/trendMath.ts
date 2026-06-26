import dayjs from 'dayjs';
import type {
  TrendPoint,
  TrendPreset,
  TrendQuery,
  TrendQueryResult,
  TrendSeriesDefinition,
  TrendSummary,
} from '../types/trend';

export function buildTrendResult(
  sourceName: string,
  points: TrendPoint[],
  query: TrendQuery,
  warnings: string[],
): TrendQueryResult {
  const from = dayjs(query.fromUtc);
  const to = dayjs(query.toUtc);
  const selectedTags = new Set(query.tagNames);
  const filtered = points.filter((point) => {
    const pointTime = dayjs(point.timestampUtc);
    return selectedTags.has(point.tagName) && !pointTime.isBefore(from) && !pointTime.isAfter(to);
  });

  const grouped = new Map<string, TrendPoint[]>();
  for (const point of filtered) {
    const list = grouped.get(point.tagName) ?? [];
    list.push(point);
    grouped.set(point.tagName, list);
  }

  const series: TrendSeriesDefinition[] = [];
  const summaries: TrendSummary[] = [];

  for (const tagName of query.tagNames) {
    const tagPoints = grouped.get(tagName) ?? [];
    if (tagPoints.length === 0) {
      continue;
    }

    const numericValues = tagPoints
      .map((point) => point.value)
      .filter((value): value is number => typeof value === 'number' && !Number.isNaN(value));

    const latestValue = numericValues.length > 0 ? numericValues[numericValues.length - 1] : null;
    const minValue = numericValues.length > 0 ? Math.min(...numericValues) : null;
    const maxValue = numericValues.length > 0 ? Math.max(...numericValues) : null;
    const averageValue =
      numericValues.length > 0
        ? numericValues.reduce((sum, value) => sum + value, 0) / numericValues.length
        : null;

    const badQualityCount = tagPoints.filter(
      (point) => point.quality !== null && point.quality !== undefined && point.quality < 192,
    ).length;

    series.push({ tagName, points: tagPoints });
    summaries.push({
      tagName,
      latestValue,
      minValue,
      maxValue,
      averageValue,
      qualitySummary:
        badQualityCount > 0
          ? `${badQualityCount} non-good samples`
          : tagPoints.some((point) => point.quality !== null && point.quality !== undefined)
            ? 'Good'
            : 'n/a',
    });
  }

  return {
    fromUtc: from.toISOString(),
    toUtc: to.toISOString(),
    sourceName,
    totalPoints: filtered.length,
    warnings,
    series,
    summaries,
  };
}

export function normalizePresetList(presets: TrendPreset[]): TrendPreset[] {
  return presets.map((preset) => ({
    ...preset,
    tagNames: [...preset.tagNames],
  }));
}
