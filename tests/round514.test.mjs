import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');
const panel = source.slice(source.indexOf('React.createElement(FindToolWindow, {'), source.indexOf('onClose: () => setFindTool(null),', source.indexOf('React.createElement(FindToolWindow, {')));
const queryTransition = source.slice(
  source.indexOf('function findToolQueryTransition('),
  source.indexOf('function findToolResultSummary('),
);

test('changing the Find query clears a previous replacement error immediately', () => {
  const queryHandler = panel.slice(panel.indexOf('onQuery: (query) =>'), panel.indexOf('onReplace:'));
  assert.match(queryHandler, /findToolQueryTransition\(current, query\)/);
  assert.match(queryTransition, /error: null/);
});

test('changing search options also clears stale replacement errors', () => {
  for (const marker of ['onToggleCaseSensitive:', 'onToggleWholeWords:', 'onToggleRegex:', 'onFileMaskChange:']) {
    const start = panel.indexOf(marker);
    const next = panel.indexOf('onMove:', start);
    const block = panel.slice(start, next < 0 ? panel.length : next);
    assert.match(block, /error: null/, `${marker} should clear the error`);
  }
});
