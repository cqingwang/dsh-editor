import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'lib/client.js'), 'utf8');

test('Project Behavior does not expose automatic opened-file selection', () => {
  assert.match(source, /alwaysSelectOpenedFile: '始终选择打开的文件',/);
  assert.match(source, /alwaysSelectOpenedFile: 'Always select opened file',/);
  assert.doesNotMatch(source, /id: 'autoscroll'/);
});

test('the Behavior item no longer narrates its current on/off state in the label', () => {
  assert.doesNotMatch(source, /autoScrollOn:/);
  assert.doesNotMatch(source, /autoScrollOff:/);
  assert.doesNotMatch(source, /label: autoScroll === false \? t\('editor\.autoScrollOff'\)/);
});
