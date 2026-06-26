import { buildDefaultPresets } from '../presets/defaultPresets';
import type {
  ApiConfigResponse,
  ApiHealthResponse,
  ApiTagResponse,
  ApiTrendResponse,
  TagCatalogResult,
  TrendDataSource,
  TrendQuery,
  TrendQueryResult,
} from '../types/trend';

export function createApiTrendDataSource(apiBaseUrl: string): TrendDataSource {
  const normalizedBaseUrl = apiBaseUrl.replace(/\/$/, '');

  return {
    getPresets: () => buildDefaultPresets(),
    async loadAvailableTags(): Promise<TagCatalogResult> {
      const response = await fetch(`${normalizedBaseUrl}/api/tags`);
      if (!response.ok) {
        throw new Error(`Failed to load tags from API (${response.status}).`);
      }

      return (await response.json()) as ApiTagResponse;
    },
    async loadTrendData(query: TrendQuery): Promise<TrendQueryResult> {
      const url = new URL(`${normalizedBaseUrl}/api/trend`);
      url.searchParams.set('tags', query.tagNames.join(','));
      url.searchParams.set('from', query.fromUtc);
      url.searchParams.set('to', query.toUtc);

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to load trend data from API (${response.status}).`);
      }

      return (await response.json()) as ApiTrendResponse;
    },
  };
}

export async function fetchApiHealth(apiBaseUrl: string): Promise<ApiHealthResponse> {
  const response = await fetch(`${apiBaseUrl.replace(/\/$/, '')}/api/health`);
  if (!response.ok) {
    throw new Error(`Failed to load API health (${response.status}).`);
  }

  return (await response.json()) as ApiHealthResponse;
}

export async function fetchApiConfig(apiBaseUrl: string): Promise<ApiConfigResponse> {
  const response = await fetch(`${apiBaseUrl.replace(/\/$/, '')}/api/config`);
  if (!response.ok) {
    throw new Error(`Failed to load API config (${response.status}).`);
  }

  return (await response.json()) as ApiConfigResponse;
}
