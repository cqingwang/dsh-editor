import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { loadTypeScriptModule } from './ts-source.mjs';

const findToolSource = await readFile(new URL('../src/client/find-tool.ts', import.meta.url), 'utf8');
const componentSource = await readFile(
  new URL('../src/client/components/search/FindToolWindow.tsx', import.meta.url),
  'utf8',
);
const locales = await readFile(new URL('../src/client/locales.ts', import.meta.url), 'utf8');

test('the Find preview split is bounded and preserves the IDEA default', () => {
  const { clampFindPreviewPercent: clamp } = loadTypeScriptModule(findToolSource, ['clampFindPreviewPercent']);
  assert.equal(clamp(5), 20);
  assert.equal(clamp(46), 46);
  assert.equal(clamp(95), 80);
  assert.equal(clamp(Number.NaN), 46);
  assert.equal(Math.round(clamp(10, 400)), 30);
  assert.equal(Math.round(clamp(90, 400)), 70);
  assert.equal(Math.round(clamp(10, 200)), 50);
  assert.equal(Math.round(clamp(90, 200)), 50);
  assert.equal(Math.round(clamp(10, 240)), 50);
  assert.equal(Math.round(clamp(90, 240)), 50);
  assert.equal(Math.round(clamp(10, 267)), 45);
  assert.equal(Math.round(clamp(90, 267)), 55);
  assert.equal(clamp(10, 600), 20);
  assert.equal(clamp(90, 600), 80);
});

test('Find results and preview share one persisted resizable split', () => {
  assert.match(componentSource, /const FIND_PREVIEW_PERCENT_STORAGE_KEY = 'dsh-editor\.find\.previewPercent'/u);
  assert.match(
    componentSource,
    /readStoredNumber\(FIND_PREVIEW_PERCENT_STORAGE_KEY, FIND_TOOL_PREVIEW_DEFAULT_PERCENT\)/u,
  );
  assert.match(componentSource, /<EditorSplitDivider/u);
  assert.match(
    componentSource,
    /clampPercent=\{\(value, extent\) =>\s+floating \? clampFindFloatingPreviewPercent\(value, extent\) : clampFindPreviewPercent\(value, extent\)\s+\}/u,
  );
  assert.match(componentSource, /flex: previewOpen \? `\$\{100 - dockPreviewPercent\} 1 0`/u);
  assert.match(componentSource, /flex: `\$\{dockPreviewPercent\} 1 0`/u);
  assert.match(
    componentSource,
    /writeStoredNumber\(FIND_PREVIEW_PERCENT_STORAGE_KEY, Math\.round\(100 - final\)\)/u,
  );
  assert.match(locales, /findPreviewSplitter: '拖动调整搜索结果与预览比例'/u);
  assert.match(locales, /findPreviewSplitter: 'Drag to resize results and preview'/u);
});
