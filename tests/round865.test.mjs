import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const commitPanel = await readFile(
  new URL('../src/client/components/commit/CommitPanel.tsx', import.meta.url),
  'utf8',
);
const terminalPanel = await readFile(
  new URL('../src/client/components/terminal/TerminalPanel.tsx', import.meta.url),
  'utf8',
);

test('Changes directory and file rows are the context-menu focus opener', () => {
  assert.match(
    commitPanel,
    /onContextMenu=\{\(event\) => \{\s+event\.preventDefault\(\);\s+event\.stopPropagation\(\);\s+event\.currentTarget\.focus\?\.\(\);[\s\S]*?onContextMenu\?\.\(\{\s+directory: row\.path,/u,
  );
  assert.match(
    commitPanel,
    /onContextMenu=\{\(event\) => \{\s+event\.preventDefault\(\);\s+event\.stopPropagation\(\);\s+event\.currentTarget\.focus\?\.\(\);\s+const insideSelection = selectedInRange;/u,
  );
});

test('Terminal tabs and overflow are the context-menu focus opener', () => {
  assert.match(
    terminalPanel,
    /event\.currentTarget\.focus\?\.\(\);\s+openTerminalTabMenu\(terminal, event\.clientX, event\.clientY\);/u,
  );
  assert.match(
    terminalPanel,
    /event\.currentTarget\.focus\?\.\(\);\s+openTerminalOverflowMenu\(event\.currentTarget\.getBoundingClientRect\(\)\);/u,
  );
});
