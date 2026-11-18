import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('MeasuringScreen is a reusable TSX terminal component', async () => {
  const component = await read('src/client/components/terminal/MeasuringScreen.tsx');

  assert.match(component, /export interface MeasuringScreenProps/u);
  assert.match(component, /function MeasuringScreenView\(/u);
  assert.match(component, /data-dsh-terminal-measure=''/u);
  assert.match(component, /style=\{styles\.terminalMeasure\}/u);
  assert.match(component, /const MeasuringScreen = MeasuringScreenView;/u);
  assert.match(component, /export \{ MeasuringScreen \};/u);
  assert.doesNotMatch(component, /React\.createElement/u);
  assert.match(component, /return \(\n    <div\n      ref=\{hostRef\}/u);
});

test('build embeds MeasuringScreen and removes the legacy definition', async () => {
  const build = await read('scripts/build-client.mjs');
  const helpers = await read('src/client/find-tool.ts');
  const fixture = await read('tests/fixtures/measuring-screen.legacy.js');
  const client = await read('lib/client.js');

  assert.match(build, /MeasuringScreen\.tsx/u);
  assert.match(build, /measuringScreenModule/u);
  assert.doesNotMatch(helpers, /function MeasuringScreen\(/u);
  assert.doesNotMatch(helpers, /React\.createElement/u);
  assert.match(fixture, /function MeasuringScreen\(/u);
  assert.match(client, /function MeasuringScreenView\(/u);
  assert.doesNotMatch(client, /function MeasuringScreen\(/u);
  assert.match(client, /const MeasuringScreen = MeasuringScreenView;/u);
});

test('MeasuringScreen fixture has a stable boundary', async () => {
  const fixture = await read('tests/fixtures/measuring-screen.legacy.js');
  const start = fixture.indexOf('function MeasuringScreen(');
  const boundary = fixture.indexOf('/* MEASURING_SCREEN_BOUNDARY */');

  assert.ok(start >= 0);
  assert.ok(boundary > start);
});
