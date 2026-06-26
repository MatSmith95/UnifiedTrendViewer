import type { RuntimeConfig } from '../types/trend';

const API_BASE_STORAGE_KEY = 'unified-trend-viewer-api-base-url';

export function parseRuntimeConfig(search: string): RuntimeConfig {
  const params = new URLSearchParams(search);
  const savedApiBaseUrl = window.localStorage.getItem(API_BASE_STORAGE_KEY);
  const inferredApiBaseUrl = window.location.pathname.startsWith('/trends')
    ? window.location.origin
    : null;
  return {
    apiBaseUrl: params.get('apiBaseUrl') ?? inferredApiBaseUrl ?? savedApiBaseUrl,
    defaultPreset: params.get('defaultPreset') ?? 'Hydraulics',
    defaultTimeRangeHours: Number(params.get('defaultHours') ?? '4'),
    readOnlyOperatorMode: params.get('mode') === 'operator',
    engineeringMode: params.get('engineeringMode') !== 'false',
  };
}

export function persistApiBaseUrl(apiBaseUrl: string | null): void {
  if (!apiBaseUrl) {
    window.localStorage.removeItem(API_BASE_STORAGE_KEY);
    return;
  }

  window.localStorage.setItem(API_BASE_STORAGE_KEY, apiBaseUrl);
}
