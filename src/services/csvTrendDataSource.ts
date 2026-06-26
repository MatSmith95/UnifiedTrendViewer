import { parseTrendCsv } from '../parsers/csvAdapter';
import type {
  CsvAdapterResult,
  TagCatalogResult,
  TrendDataSource,
  TrendPreset,
  TrendQuery,
  TrendQueryResult,
} from '../types/trend';
import { buildTrendResult, normalizePresetList } from './trendMath';

export function createCsvTrendDataSource(
  source: string | File,
  presets: TrendPreset[],
): TrendDataSource {
  let cache: Promise<CsvAdapterResult> | null = null;

  const loadCsv = async (): Promise<CsvAdapterResult> => {
    if (!cache) {
      cache = (async () => {
        if (typeof source === 'string') {
          const response = await fetch(source);
          const csvText = await response.text();
          return parseTrendCsv(csvText, 'example-trend-data.csv');
        }

        const csvText = await source.text();
        return parseTrendCsv(csvText, source.name);
      })();
    }

    return cache;
  };

  return {
    getPresets: () => normalizePresetList(presets),
    async loadAvailableTags(): Promise<TagCatalogResult> {
      const result = await loadCsv();
      return {
        tags: [...new Set(result.points.map((point) => point.tagName))].sort(),
        warnings: result.warnings,
      };
    },
    async loadTrendData(query: TrendQuery): Promise<TrendQueryResult> {
      const result = await loadCsv();
      return buildTrendResult(result.sourceName, result.points, query, result.warnings);
    },
  };
}
