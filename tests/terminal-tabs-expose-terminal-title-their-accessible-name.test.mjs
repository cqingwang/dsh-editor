import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const panel = await readFile(new URL('../src/client/components/terminal/TerminalPanel.tsx', import.meta.url), 'utf8');

test('terminal tabs expose the terminal title as their accessible name', () => {
  assert.match(
    panel,
    /role='tab'\s+aria-label=\{terminal\.title\}\s+aria-selected=\{terminal\.id === activeId\}/s,
  );
});

test('dragging a terminal tab keeps roving keyboard focus on that tab', () => {
  assert.match(
    panel,
    /onDragStart=\{\(event\) => \{\s+event\.currentTarget\.focus\?\.\(\);\s+setDragId\(terminal\.id\);/s,
  );
  assert.match(
    panel,
    /onDragEnd=\{\(event\) => \{\s+event\.currentTarget\.focus\?\.\(\);/s,
  );
});
