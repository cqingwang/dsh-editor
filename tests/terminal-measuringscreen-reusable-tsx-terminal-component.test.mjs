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
