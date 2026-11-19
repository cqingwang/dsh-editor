import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const styleSources = await Promise.all(
  ['../src/client/ui/styles.ts', '../src/client/inline-styles.ts'].map(async (path) => ({
    path,
    source: await readFile(new URL(path, import.meta.url), 'utf8'),
  })),
);

function styleBlock(source, name, nextName) {
  const start = source.indexOf(`  ${name}: {`);
  const end = source.indexOf(`  ${nextName}: {`, start);
  assert.ok(start >= 0 && end > start, `${name} style block is missing`);
  return source.slice(start, end);
}

test('terminal tabs shrink within the measured strip instead of overflowing into toolbar actions', () => {
  for (const { path, source } of styleSources) {
    const tab = styleBlock(source, 'terminalTab', 'terminalTabDrop');
    assert.match(tab, /boxSizing: 'border-box'/u, path);
    assert.match(tab, /flex: '0 1 168px'/u, path);
    assert.match(tab, /minWidth: 0/u, path);
  }
});

test('the close control keeps its hit target and cannot shrink or be overlaid', () => {
  for (const { path, source } of styleSources) {
    const close = styleBlock(source, 'terminalTabClose', 'terminalExited');
    assert.match(close, /flex: 'none'/u, path);
    assert.match(close, /width: 16/u, path);
    assert.match(close, /height: 18/u, path);
    assert.match(close, /display: 'inline-flex'/u, path);
    assert.match(close, /padding: 0/u, path);
  }
});
