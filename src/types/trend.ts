export interface TrendPoint {
  timestampUtc: string;
  tagName: string;
  value: number | null;
  quality?: number | null;
  qualityText?: string;
}

export interface CsvAdapterResult {
  points: TrendPoint[];
  warnings: string[];
  sourceName: string;
}

export interface TagCatalogResult {
  tags: string[];
  warnings: string[];
}

export interface TrendQuery {
  tagNames: string[];
  fromUtc: string;
  toUtc: string;
}

export interface TrendSummary {
  tagName: string;
  latestValue: number | null;
  minValue: number | null;
  maxValue: number | null;
  averageValue: number | null;
  qualitySummary?: string;
}

export interface TrendSeriesDefinition {
  tagName: string;
  points: TrendPoint[];
}

export interface TrendQueryResult {
  fromUtc: string;
  toUtc: string;
  sourceName: string;
  totalPoints: number;
  warnings: string[];
  series: TrendSeriesDefinition[];
  summaries: TrendSummary[];
}

export interface TrendPreset {
  id: string;
  name: string;
  tagNames: string[];
  description: string;
}

export interface TrendDataSource {
  getPresets(): TrendPreset[];
  loadAvailableTags(): Promise<TagCatalogResult>;
  loadTrendData(query: TrendQuery): Promise<TrendQueryResult>;
}

export interface RuntimeConfig {
  apiBaseUrl: string | null;
  defaultPreset: string;
  defaultTimeRangeHours: number;
  readOnlyOperatorMode: boolean;
  engineeringMode: boolean;
}

export interface ApiTagResponse {
  tags: string[];
  warnings: string[];
}

export interface ApiTrendResponse extends TrendQueryResult {}
