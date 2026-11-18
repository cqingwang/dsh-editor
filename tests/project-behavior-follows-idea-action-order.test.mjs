import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = (readFileSync(join(root, 'tests/fixtures/context-menu.legacy.js'), 'utf8') + '\n' + readFileSync(join(root, 'lib/client.js'), 'utf8'));

function projectOptions() {
  const start = source.indexOf("title: t('editor.options'),");
  assert.notEqual(start, -1);
  const end = source.indexOf('onCreateChange:', start);
  assert.notEqual(end, -1);
  return source.slice(start, end);
}

test('Project Behavior follows IDEA action order', () => {
  const options = projectOptions();
  const behavior = options.slice(options.indexOf("id: 'behavior'"), options.indexOf("id: 'appearance'"));
  const ids = ['previewTab', 'singleClickOpen', 'openDirectoriesSingleClick'];
  const positions = ids.map((id) => behavior.indexOf(`id: '${id}'`));
  assert.ok(positions.every((position) => position >= 0));
  assert.deepEqual(positions, [...positions].sort((left, right) => left - right));
});

test('Project Appearance uses IDEA Show and Sort By sections', () => {
  const options = projectOptions();
  const appearance = options.slice(options.indexOf("id: 'appearance'"));
  const showHeader = appearance.indexOf("id: 'showSection'");
  const sortHeader = appearance.indexOf("id: 'sortSection'");
  assert.ok(showHeader >= 0 && sortHeader > showHeader);
  assert.match(appearance, /kind: 'section'[\s\S]*?label: t\('editor\.projectOptionsShow'\)/);
  assert.match(appearance, /kind: 'section'[\s\S]*?label: t\('editor\.projectOptionsSortBy'\)/);

  for (const id of ['showExcludedFiles', 'compactDirectories', 'hidden']) {
    const position = appearance.indexOf(`id: '${id}'`);
    assert.ok(position > showHeader && position < sortHeader, `${id} belongs to Show`);
  }
  for (const marker of ["id: `sort:${mode}`", "id: 'foldersFirst'"]) {
    const position = appearance.indexOf(marker);
    assert.ok(position > sortHeader, `${marker} belongs to Sort By`);
  }
});

test('menu section labels are non-interactive', () => {
  const start = source.indexOf('function ContextMenu(');
  const menu = source.slice(start, source.indexOf('/**\n     * A tool-window splitter', start));
  assert.match(menu, /item\.kind === 'section'/);
  assert.match(menu, /child\.kind === 'section'/);
  assert.match(menu, /role: 'presentation'/);
  assert.match(menu, /styles\.menuSectionLabel/);
});

test('Project Options section labels are localized', () => {
  assert.ok(source.includes("projectOptionsShow: '显示'"));
  assert.ok(source.includes("projectOptionsSortBy: '排序方式'"));
  assert.ok(source.includes("projectOptionsShow: 'Show'"));
  assert.ok(source.includes("projectOptionsSortBy: 'Sort By'"));
});
