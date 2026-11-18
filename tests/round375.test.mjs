import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');
const editorFileTabSource = await readFile(
  new URL('../src/client/components/editor/EditorFileTab.tsx', import.meta.url),
  'utf8',
);

test('editor file tabs reuse the project file-type icon before the file name', () => {
  assert.match(source, /return React\.createElement\(EditorFileTab, \{/);
  const icon = editorFileTabSource.indexOf('<EntryIcon');
  const label = editorFileTabSource.indexOf('<span style={styles.tabLabel}>{label}</span>');
  assert.ok(icon >= 0, 'main file tab should render FileTypeIcon through EntryIcon');
  assert.ok(label >= 0 && icon < label, 'file-type icon must precede the file name');
});

test('split editor tabs use the same file-type icon instead of a generic dot glyph', () => {
  assert.match(source, /return React\.createElement\(EditorFileTab, \{/);
  assert.match(source, /dataAttributeName: 'data-dsh-editor-split-path'/);
  const icon = editorFileTabSource.indexOf('<EntryIcon');
  const label = editorFileTabSource.indexOf('<span style={styles.tabLabel}>{label}</span>');
  assert.ok(icon >= 0, 'split file tab should render FileTypeIcon through EntryIcon');
  assert.ok(label > icon, 'file-type icon must precede the split tab name');
  assert.doesNotMatch(editorFileTabSource, /Icon, \{[\s\S]*?name='commit'/);
});
