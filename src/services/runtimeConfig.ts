import type { RuntimeConfig } from '../types/trend';

export function parseRuntimeConfig(search: string): RuntimeConfig {
  const params = new URLSearchParams(search);
  return {
    apiBaseUrl: params.get('apiBaseUrl'),
    defaultPreset: params.get('defaultPreset') ?? 'Hydraulics',
    defaultTimeRangeHours: Number(params.get('defaultHours') ?? '4'),
    readOnlyOperatorMode: params.get('mode') === 'operator',
    engineeringMode: params.get('engineeringMode') !== 'false',
  };
}
