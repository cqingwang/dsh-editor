import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { loadTypeScriptFunction } from './ts-source.mjs';

const terminalSource = await readFile(new URL('../src/client/terminal.ts', import.meta.url), 'utf8');
const panel =
  (await readFile(new URL('../src/client/components/project/ProjectPanel.tsx', import.meta.url), 'utf8')) +
  '\n' +
  (await readFile(new URL('../src/client/components/project/FileTreeView.tsx', import.meta.url), 'utf8'));

const indexChangesByDirectory = loadTypeScriptFunction(terminalSource, 'indexChangesByDirectory');

test('changes are indexed once for every ancestor directory', () => {
  const changes = [
    { path: 'src/a.ts', status: ' M' },
    { path: 'src/deep/b.ts', status: 'UU' },
    { path: 'docs/readme.md', status: '??' },
    { path: 'root.ts', status: 'A ' },
  ];
  const index = indexChangesByDirectory(changes);
  assert.deepEqual(
    index.get('src').map((change) => change.path),
    ['src/a.ts', 'src/deep/b.ts'],
  );
  assert.deepEqual(
    index.get('src/deep').map((change) => change.path),
    ['src/deep/b.ts'],
  );
  assert.deepEqual(
    index.get('docs').map((change) => change.path),
    ['docs/readme.md'],
  );
  assert.equal(index.has(''), false);
});

test('Project reuses memoized change maps and queries each row tint once', () => {
  assert.match(panel, /const gitChanges = React\.useMemo\(/u);
  assert.match(panel, /const changesByDirectory = React\.useMemo\(/u);
  assert.match(panel, /indexChangesByDirectory\(git\?\.changes\)/u);
  assert.match(panel, /const projectRowPresentationByPath = React\.useMemo\(/u);

  const presentationAt = panel.indexOf('const projectRowPresentationByPath = React.useMemo');
  const presentationEnd = panel.indexOf('const createParent =', presentationAt);
  assert.ok(presentationAt > 0 && presentationEnd > presentationAt);
  const presentation = panel.slice(presentationAt, presentationEnd);
  assert.match(presentation, /directoryTint\(changesByDirectory\.get\(row\.path\)\)/u);
  assert.equal(presentation.match(/changesByDirectory\.get\(row\.path\)/gu)?.length, 1);

  const rowRenderAt = panel.indexOf('const renderProjectRowName =');
  assert.ok(rowRenderAt > 0);
  const rowRender = panel.slice(rowRenderAt);
  assert.match(rowRender, /!selected && directoryTintState !== null/u);
  assert.doesNotMatch(rowRender, /directoryTint\(|directoryStatus\(/u);
  assert.doesNotMatch(panel, /\(git\?\.changes \?\? \[\]\)\.filter\(/u);
});
