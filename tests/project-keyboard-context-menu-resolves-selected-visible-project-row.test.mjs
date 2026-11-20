import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadTypeScriptFunction } from './ts-source.mjs';

const model = await readFile(
  new URL('../src/client/components/project/project-selection-model.ts', import.meta.url),
  'utf8',
);
const panel = await readFile(
  new URL('../src/client/components/project/ProjectPanel.tsx', import.meta.url),
  'utf8',
);

test('keyboard context menu resolves the selected visible Project row', () => {
  const target = loadTypeScriptFunction(model, 'projectContextMenuRowAfterKeyboard');
  const rows = [
    { path: '', kind: 'directory', root: true },
    { path: 'src', kind: 'directory' },
    { path: 'src/app.ts', kind: 'file' },
    { path: 'src/::empty', kind: 'placeholder' },
  ];
  assert.deepEqual(target(rows, 'src'), { path: 'src', kind: 'directory' });
  assert.deepEqual(target(rows, 'src/app.ts'), { path: 'src/app.ts', kind: 'file' });
  assert.equal(target(rows, ''), null);
  assert.equal(target(rows, 'src/::empty'), null);
  assert.equal(target(rows, 'missing'), null);
});

test('Project tree owns Shift+F10 and ContextMenu on its focused container', () => {
  assert.match(
    panel,
    /import \{[^}]*projectContextMenuRowAfterKeyboard[^}]*\} from '\.\/project-selection-model';/u,
  );
  assert.match(panel, /const openSelectedContextMenuFromKeyboard = \(\) => \{/u);
  assert.match(
    panel,
    /const selected = projectContextMenuRowAfterKeyboard\(visibleRows, selectedPath\);/u,
  );
  assert.match(
    panel,
    /event\.key === 'ContextMenu' \|\| \(event\.shiftKey === true && event\.key === 'F10'\)/u,
  );
  assert.match(panel, /openSelectedContextMenuFromKeyboard\(\);/u);
  assert.match(panel, /selectVisibleRow\(selected, \{\}\);/u);
  assert.match(panel, /onContextMenu\(\{\s+row: selected,\s+x,\s+y,/u);
});
