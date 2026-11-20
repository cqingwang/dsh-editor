import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('Project and the external directory picker share one controlled file-tree surface', async () => {
  const tree = await read('src/client/components/project/FileTreeView.tsx');
  const projectPanel = await read('src/client/components/project/ProjectPanel.tsx');
  const directoryPicker = await read('src/client/components/project/WorkspaceDirectoryPicker.tsx');

  assert.match(tree, /export interface FileTreeViewRow/u);
  assert.match(tree, /export interface FileTreeViewProps/u);
  assert.match(tree, /function FileTreeView<Row extends FileTreeViewRow>\(/u);
  assert.match(tree, /role='tree'/u);
  assert.match(tree, /role='treeitem'/u);
  assert.match(tree, /<EntryIcon/u);

  assert.match(projectPanel, /FileTreeView,[\s\S]*?from '\.\/FileTreeView'/u);
  assert.match(projectPanel, /<FileTreeView[\s\S]*?rows=\{visibleRows\}/u);
  assert.match(directoryPicker, /FileTreeView,[\s\S]*?from '\.\/FileTreeView'/u);
  assert.match(directoryPicker, /<FileTreeView[\s\S]*?rows=\{treeRows\}/u);
});

test('the directory picker reuses the shared floating surface instead of a local overlay', async () => {
  const picker = await read('src/client/components/project/WorkspaceDirectoryPicker.tsx');

  assert.match(picker, /import \{ FloatingToolPopup(?:,[\s\S]*?)? \} from '\.\.\/search\/FindToolPopup'/u);
  assert.match(picker, /<FloatingToolPopup[\s\S]*?kind='workspaceDirectory'/u);
  assert.match(picker, /backdrop=\{true\}/u);
  const surfaceStyleStart = picker.indexOf('surfaceStyle={{');
  const surfaceStyleEnd = picker.indexOf('...EDITOR_TEXT_STYLE.body', surfaceStyleStart);
  assert.ok(surfaceStyleStart >= 0 && surfaceStyleEnd > surfaceStyleStart);
  const surfaceStyle = picker.slice(surfaceStyleStart, surfaceStyleEnd);
  assert.doesNotMatch(surfaceStyle, /border:|boxShadow:/u);
  assert.doesNotMatch(picker, /styles\.paletteBackdrop/u);
  assert.doesNotMatch(picker, /data-dsh-floating-popup-resize/u);
  assert.doesNotMatch(picker, /pointermove/u);
});

test('only the workspace directory title bar owns popup dragging', async () => {
  const picker = await read('src/client/components/project/WorkspaceDirectoryPicker.tsx');
  const surfaceStart = picker.indexOf('function PickerSurface(');
  const surfaceEnd = picker.indexOf('function failureText(', surfaceStart);
  assert.ok(surfaceStart >= 0 && surfaceEnd > surfaceStart);
  const surface = picker.slice(surfaceStart, surfaceEnd);
  assert.match(
    surface,
    /const handlePointerDown = \(event: React\.PointerEvent<HTMLElement>\): void => \{[\s\S]*?event\.target instanceof Element[\s\S]*?closest\('\[data-dsh-workspace-directory-drag\]'\)[\s\S]*?onPopupDragStart\?\.\(event\);/u,
  );
  assert.match(surface, /onPointerDown=\{handlePointerDown\}/u);
  assert.match(picker, /data-dsh-workspace-directory-drag=''/u);
});
