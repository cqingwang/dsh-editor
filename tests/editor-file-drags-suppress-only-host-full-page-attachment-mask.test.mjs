import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source =
  (await readFile(new URL('../src/client/components/project/ProjectPanel.tsx', import.meta.url), 'utf8')) +
  '\n' +
  (await readFile(new URL('../src/client/components/project/FileTreeView.tsx', import.meta.url), 'utf8')) +
  '\n' +
  (await readFile(new URL('../lib/client.js', import.meta.url), 'utf8'));
const workspaceShellSource = await readFile(
  new URL('../src/client/components/editor/EditorWorkspaceShell.tsx', import.meta.url),
  'utf8',
);

test('Editor file drags suppress only the host full-page attachment mask', () => {
  assert.match(
    source,
    /body\.dsh-editor-file-drag > \[role="status"\]\[class\*="_mask"\] \{ display: none !important; \}/u,
  );
  assert.match(source, /document\.body\.classList\.add\('dsh-editor-file-drag'\)/u);
  assert.match(source, /document\.body\.classList\.remove\('dsh-editor-file-drag'\)/u);
});

test('The workspace owns the drag class for its whole enter/leave/drop lifetime', () => {
  const rootStart = source.indexOf("'data-dsh-editor-workspace': ''");
  const rootEnd = rootStart + 800;
  const root = source.slice(rootStart, rootEnd);
  assert.ok(rootStart >= 0 && rootEnd > rootStart);
  assert.match(workspaceShellSource, /\.\.\.editorFileDragProps/u);
  assert.match(root, /editorFileDragProps/u);
  assert.match(
    source,
    /const editorFileDragProps = \{\s+onDragEnter: beginEditorFileDrag,\s+onDragLeave: endEditorFileDrag,\s+onDragOver: allowEditorFileDragOver,\s+onDrop: finishEditorFileDrag,?\s*\}/u,
  );
  assert.match(
    source,
    /if \(dataTransferIncludesFiles\(event\.dataTransfer\)\) \{\s+document\.body\.classList\.add\('dsh-editor-file-drag'\)/u,
  );
  assert.match(source, /window\.addEventListener\('dragend', clearFileDrag, true\)/u);
  assert.match(source, /window\.addEventListener\('drop', clearFileDrag, true\)/u);
});

test('The Project drop target is a thin accent line anchored to the destination row', () => {
  assert.match(source, /'data-dsh-project-file-drop-line': row\.path/u);
  assert.match(
    source,
    /position: 'absolute',\s+left: 8 \+ \(row\.depth \?\? 0\) \* 14 \+ 18,\s+right: 8,\s+bottom: 0,\s+height: 2,/u,
  );
  assert.match(source, /background: 'var\(--dsw-alias-state-business-primary\)'/u);
  assert.doesNotMatch(
    source,
    /externalDropPath === row\.path\s+\? \{\s+background: 'var\(--dsw-alias-interactive-bg-hover-solid\)'/u,
  );
});
