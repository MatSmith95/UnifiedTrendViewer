import './style.css';
import * as echarts from 'echarts/core';
import { LineChart } from 'echarts/charts';
import {
  DataZoomComponent,
  GridComponent,
  LegendComponent,
  TooltipComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import dayjs from 'dayjs';
import sampleCsvUrl from '../sample-data/example-trend-data.csv?url';
import { buildDefaultPresets } from './presets/defaultPresets';
import { createApiTrendDataSource } from './services/apiTrendDataSource';
import { createCsvTrendDataSource } from './services/csvTrendDataSource';
import { parseRuntimeConfig } from './services/runtimeConfig';
import type {
  TrendPoint,
  TrendDataSource,
  TrendQueryResult,
  TrendSeriesDefinition,
} from './types/trend';

echarts.use([
  LineChart,
  TooltipComponent,
  GridComponent,
  LegendComponent,
  DataZoomComponent,
  CanvasRenderer,
]);

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) {
  throw new Error('App root not found.');
}

app.innerHTML = `
  <div class="layout">
    <header class="toolbar">
      <div class="toolbar__brand">
        <div class="toolbar__logo">UT</div>
        <div>
          <h1>Unified Trend Viewer</h1>
          <p>CSV-driven historical trends for Siemens WinCC Unified screens</p>
        </div>
      </div>
      <div class="toolbar__controls">
        <label>
          <span>Preset</span>
          <select id="preset-select"></select>
        </label>
        <label>
          <span>Tag Search</span>
          <input id="tag-search" type="search" placeholder="Search tags" />
        </label>
        <label>
          <span>From</span>
          <input id="from-input" type="datetime-local" />
        </label>
        <label>
          <span>To</span>
          <input id="to-input" type="datetime-local" />
        </label>
        <div class="toolbar__buttons">
          <button id="load-button" class="button button--primary">Load</button>
          <button id="clear-button" class="button">Clear</button>
          <button id="export-button" class="button">Export CSV</button>
        </div>
      </div>
    </header>

    <section class="content-grid">
      <aside class="side-panel">
        <div class="panel">
          <div class="panel__header">
            <h2>Available Tags</h2>
            <span id="tag-count" class="badge">0</span>
          </div>
          <div class="panel__body panel__body--scroll">
            <div id="available-tags" class="tag-list"></div>
          </div>
        </div>

        <div class="panel">
          <div class="panel__header">
            <h2>Selected Pens</h2>
            <span id="selected-count" class="badge">0</span>
          </div>
          <div class="panel__body panel__body--scroll">
            <div id="selected-tags" class="pen-list"></div>
          </div>
        </div>

        <div class="panel">
          <div class="panel__header">
            <h2>Data Source</h2>
          </div>
          <div class="panel__body">
            <p id="data-source-mode" class="muted"></p>
            <label class="upload-label">
              <span>Load local CSV</span>
              <input id="csv-upload" type="file" accept=".csv" />
            </label>
          </div>
        </div>
      </aside>

      <main class="main-panel">
        <div class="panel panel--chart">
          <div class="panel__header">
            <h2>Trend Chart</h2>
            <div id="range-summary" class="muted"></div>
          </div>
          <div id="trend-chart" class="chart"></div>
        </div>

        <div class="panel">
          <div class="panel__header">
            <h2>Legend & Stats</h2>
          </div>
          <div class="panel__body">
            <table class="stats-table">
              <thead>
                <tr>
                  <th>Tag</th>
                  <th>Latest</th>
                  <th>Min</th>
                  <th>Max</th>
                  <th>Average</th>
                  <th>Quality</th>
                </tr>
              </thead>
              <tbody id="stats-body"></tbody>
            </table>
          </div>
        </div>
      </main>
    </section>

    <footer class="status-bar">
      <div id="status-file">No file loaded</div>
      <div id="status-points">0 points</div>
      <div id="status-mode">Mode: engineering</div>
      <div id="status-messages" class="status-bar__messages"></div>
    </footer>
  </div>
`;

const runtimeConfig = parseRuntimeConfig(window.location.search);
const presets = buildDefaultPresets();
let dataSource: TrendDataSource = runtimeConfig.apiBaseUrl
  ? createApiTrendDataSource(runtimeConfig.apiBaseUrl)
  : createCsvTrendDataSource(sampleCsvUrl, presets);

const state = {
  availableTags: [] as string[],
  selectedTags: [] as string[],
  tagSearch: '',
  activePreset: runtimeConfig.defaultPreset,
  latestResult: null as TrendQueryResult | null,
  warnings: [] as string[],
};

const presetSelect = document.querySelector<HTMLSelectElement>('#preset-select')!;
const tagSearchInput = document.querySelector<HTMLInputElement>('#tag-search')!;
const fromInput = document.querySelector<HTMLInputElement>('#from-input')!;
const toInput = document.querySelector<HTMLInputElement>('#to-input')!;
const loadButton = document.querySelector<HTMLButtonElement>('#load-button')!;
const clearButton = document.querySelector<HTMLButtonElement>('#clear-button')!;
const exportButton = document.querySelector<HTMLButtonElement>('#export-button')!;
const csvUpload = document.querySelector<HTMLInputElement>('#csv-upload')!;
const availableTagsContainer = document.querySelector<HTMLDivElement>('#available-tags')!;
const selectedTagsContainer = document.querySelector<HTMLDivElement>('#selected-tags')!;
const statsBody = document.querySelector<HTMLTableSectionElement>('#stats-body')!;
const tagCount = document.querySelector<HTMLSpanElement>('#tag-count')!;
const selectedCount = document.querySelector<HTMLSpanElement>('#selected-count')!;
const rangeSummary = document.querySelector<HTMLDivElement>('#range-summary')!;
const statusFile = document.querySelector<HTMLDivElement>('#status-file')!;
const statusPoints = document.querySelector<HTMLDivElement>('#status-points')!;
const statusMode = document.querySelector<HTMLDivElement>('#status-mode')!;
const statusMessages = document.querySelector<HTMLDivElement>('#status-messages')!;
const dataSourceMode = document.querySelector<HTMLParagraphElement>('#data-source-mode')!;
const chartContainer = document.querySelector<HTMLDivElement>('#trend-chart')!;
const chart = echarts.init(chartContainer);

function setDefaultRange(): void {
  const end = dayjs('2026-06-26T08:45:00Z');
  const start = end.subtract(runtimeConfig.defaultTimeRangeHours, 'hour');
  fromInput.value = start.format('YYYY-MM-DDTHH:mm');
  toInput.value = end.format('YYYY-MM-DDTHH:mm');
}

function syncPresetOptions(): void {
  presetSelect.innerHTML = '';
  for (const preset of dataSource.getPresets()) {
    const option = document.createElement('option');
    option.value = preset.id;
    option.textContent = preset.name;
    option.selected = preset.id === state.activePreset;
    presetSelect.append(option);
  }
}

function formatNumber(value: number | null): string {
  return value === null || Number.isNaN(value) ? 'n/a' : value.toFixed(2);
}

function setStatusMessages(messages: string[]): void {
  statusMessages.textContent = messages.join(' | ');
}

function renderAvailableTags(): void {
  const filtered = state.availableTags.filter((tag) =>
    tag.toLowerCase().includes(state.tagSearch.toLowerCase()),
  );

  tagCount.textContent = `${filtered.length}`;
  availableTagsContainer.innerHTML = '';

  for (const tag of filtered) {
    const item = document.createElement('label');
    item.className = 'tag-item';
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = state.selectedTags.includes(tag);
    checkbox.addEventListener('change', () => {
      if (checkbox.checked && !state.selectedTags.includes(tag)) {
        state.selectedTags.push(tag);
      } else if (!checkbox.checked) {
        state.selectedTags = state.selectedTags.filter((selected) => selected !== tag);
      }
      state.activePreset = 'Custom';
      syncPresetOptions();
      renderAvailableTags();
      renderSelectedTags();
    });

    const label = document.createElement('span');
    label.textContent = tag;
    item.append(checkbox, label);
    availableTagsContainer.append(item);
  }
}

function renderSelectedTags(): void {
  selectedCount.textContent = `${state.selectedTags.length}`;
  selectedTagsContainer.innerHTML = '';

  if (state.selectedTags.length === 0) {
    selectedTagsContainer.innerHTML = '<p class="muted">No pens selected.</p>';
    return;
  }

  for (const tag of state.selectedTags) {
    const row = document.createElement('div');
    row.className = 'pen-item';

    const name = document.createElement('span');
    name.textContent = tag;

    const remove = document.createElement('button');
    remove.className = 'button button--compact';
    remove.textContent = 'Remove';
    remove.addEventListener('click', () => {
      state.selectedTags = state.selectedTags.filter((selected) => selected !== tag);
      state.activePreset = 'Custom';
      syncPresetOptions();
      renderAvailableTags();
      renderSelectedTags();
    });

    row.append(name, remove);
    selectedTagsContainer.append(row);
  }
}

function renderStats(result: TrendQueryResult | null): void {
  statsBody.innerHTML = '';

  if (!result || result.summaries.length === 0) {
    statsBody.innerHTML = '<tr><td colspan="6" class="muted">No trend data loaded.</td></tr>';
    return;
  }

  for (const summary of result.summaries) {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${summary.tagName}</td>
      <td>${formatNumber(summary.latestValue)}</td>
      <td>${formatNumber(summary.minValue)}</td>
      <td>${formatNumber(summary.maxValue)}</td>
      <td>${formatNumber(summary.averageValue)}</td>
      <td>${summary.qualitySummary ?? 'n/a'}</td>
    `;
    statsBody.append(row);
  }
}

function renderChart(result: TrendQueryResult | null): void {
  if (!result || result.series.length === 0) {
    chart.clear();
    chart.setOption({
      title: {
        text: 'No trend data loaded',
        left: 'center',
        top: 'middle',
        textStyle: { color: '#98a4b5', fontSize: 16 },
      },
    });
    return;
  }

  chart.setOption({
    animation: false,
    backgroundColor: 'transparent',
    legend: {
      top: 0,
      textStyle: { color: '#dde5ef' },
    },
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#12202d',
      borderColor: '#355066',
      textStyle: { color: '#edf5ff' },
    },
    grid: {
      top: 44,
      left: 52,
      right: 18,
      bottom: 56,
    },
    xAxis: {
      type: 'time',
      axisLabel: { color: '#c4d0dd' },
      axisLine: { lineStyle: { color: '#3d556a' } },
      splitLine: { lineStyle: { color: '#203241' } },
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: '#c4d0dd' },
      axisLine: { lineStyle: { color: '#3d556a' } },
      splitLine: { lineStyle: { color: '#203241' } },
      scale: true,
    },
    dataZoom: [{ type: 'inside' }, { type: 'slider', height: 22, bottom: 12 }],
    series: result.series.map((series: TrendSeriesDefinition) => ({
      name: series.tagName,
      type: 'line',
      smooth: false,
      showSymbol: false,
      connectNulls: false,
      data: series.points.map((point: TrendPoint) => [point.timestampUtc, point.value]),
    })),
  });
}

function updateStatus(result: TrendQueryResult | null): void {
  if (!result) {
    statusFile.textContent = 'No file loaded';
    statusPoints.textContent = '0 points';
    rangeSummary.textContent = 'No range selected';
    setStatusMessages(state.warnings);
    return;
  }

  statusFile.textContent = `Source: ${result.sourceName}`;
  statusPoints.textContent = `${result.totalPoints.toLocaleString()} points`;
  rangeSummary.textContent = `${dayjs(result.fromUtc).format('YYYY-MM-DD HH:mm')} to ${dayjs(result.toUtc).format('YYYY-MM-DD HH:mm')}`;
  setStatusMessages([...state.warnings, ...result.warnings]);
}

async function loadTags(): Promise<void> {
  const catalog = await dataSource.loadAvailableTags();
  state.availableTags = catalog.tags;
  state.warnings = catalog.warnings;

  if (state.selectedTags.length === 0) {
    const preset = dataSource.getPresets().find((entry) => entry.id === state.activePreset);
    if (preset) {
      state.selectedTags = preset.tagNames.filter((tag) => state.availableTags.includes(tag));
    }
  }

  renderAvailableTags();
  renderSelectedTags();
}

async function loadTrendData(): Promise<void> {
  const result = await dataSource.loadTrendData({
    tagNames: state.selectedTags,
    fromUtc: dayjs(fromInput.value).toISOString(),
    toUtc: dayjs(toInput.value).toISOString(),
  });

  state.latestResult = result;
  renderChart(result);
  renderStats(result);
  updateStatus(result);
}

async function exportFilteredData(): Promise<void> {
  if (!state.latestResult) {
    setStatusMessages(['Nothing loaded to export.']);
    return;
  }

  const rows = state.latestResult.series.flatMap((series) =>
    series.points.map((point) =>
      [point.timestampUtc, series.tagName, point.value ?? '', point.quality ?? ''].join(','),
    ),
  );

  const csv = ['TimestampUTC,TagName,Value,Quality', ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const href = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = href;
  link.download = `trend-export-${dayjs().format('YYYYMMDD-HHmmss')}.csv`;
  link.click();
  URL.revokeObjectURL(href);
}

function applyPreset(presetId: string): void {
  state.activePreset = presetId;
  const preset = dataSource.getPresets().find((entry) => entry.id === presetId);
  if (preset && preset.id !== 'Custom') {
    state.selectedTags = preset.tagNames.filter((tag) => state.availableTags.includes(tag));
  }
  renderAvailableTags();
  renderSelectedTags();
}

async function bootstrap(): Promise<void> {
  statusMode.textContent = `Mode: ${runtimeConfig.readOnlyOperatorMode ? 'operator' : 'engineering'}`;
  dataSourceMode.textContent = runtimeConfig.apiBaseUrl
    ? `API mode: ${runtimeConfig.apiBaseUrl}`
    : 'Front-end CSV mode: bundled sample data';

  setDefaultRange();
  syncPresetOptions();

  presetSelect.addEventListener('change', async () => {
    applyPreset(presetSelect.value);
    await loadTrendData();
  });

  tagSearchInput.addEventListener('input', () => {
    state.tagSearch = tagSearchInput.value;
    renderAvailableTags();
  });

  loadButton.addEventListener('click', async () => {
    await loadTrendData();
  });

  clearButton.addEventListener('click', () => {
    state.selectedTags = [];
    state.activePreset = 'Custom';
    syncPresetOptions();
    renderAvailableTags();
    renderSelectedTags();
    state.latestResult = null;
    renderChart(null);
    renderStats(null);
    updateStatus(null);
  });

  exportButton.addEventListener('click', async () => {
    await exportFilteredData();
  });

  csvUpload.addEventListener('change', async () => {
    const file = csvUpload.files?.[0];
    if (!file) {
      return;
    }

    dataSource = createCsvTrendDataSource(file, presets);
    state.latestResult = null;
    dataSourceMode.textContent = `Front-end CSV mode: ${file.name}`;
    syncPresetOptions();
    await loadTags();
    await loadTrendData();
  });

  window.addEventListener('resize', () => {
    chart.resize();
  });

  await loadTags();
  await loadTrendData();
}

bootstrap().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unexpected startup error';
  renderChart(null);
  renderStats(null);
  setStatusMessages([message]);
});
