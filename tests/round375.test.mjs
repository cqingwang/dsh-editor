import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');

test('editor file tabs reuse the project file-type icon before the file name', () => {
  const start = source.indexOf('const tabs = openFiles.map((file) => {');
  const end = source.indexOf('The diff\'s own editor tab', start);
  assert.ok(start >= 0 && end > start, 'main editor tab block should exist');
  const block = source.slice(start, end);
  const icon = block.indexOf(
    "React.createElement(EntryIcon, { entry: { path: file.path, kind: 'file' }, expanded: false })",
  );
  const label = block.indexOf("React.createElement('span', null, basename(file.path))");
  assert.ok(icon >= 0, 'main file tab should render FileTypeIcon through EntryIcon');
  assert.ok(label >= 0 && icon < label, 'file-type icon must precede the file name');
});

test('split editor tabs use the same file-type icon instead of a generic dot glyph', () => {
  const start = source.indexOf('splitTabLayout.visible.map((splitTab) => {');
  const expectedIcon =
    "React.createElement(EntryIcon, { entry: { path: splitTab, kind: 'file' }, expanded: false })";
  const expectedLabel = "React.createElement('span', { style: styles.tabLabel }, basename(splitTab))";
  const icon = source.indexOf(expectedIcon, start);
  const label = source.indexOf(expectedLabel, start);
  const end = label < 0 ? -1 : source.indexOf('splitTabLayout.hidden.length === 0', label);
  assert.ok(start >= 0 && icon > start && label > icon && end > label, 'split editor tab block should exist');
  const block = source.slice(start, end);
  assert.ok(icon >= 0, 'split file tab should render FileTypeIcon through EntryIcon');
  assert.ok(label > icon, 'file-type icon must precede the split tab name');
  assert.doesNotMatch(block, /splitTabFile\?\.dirty === true[\s\S]*?Icon, \{ name: 'commit'/);
});
