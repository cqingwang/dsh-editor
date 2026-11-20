import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const panel = await readFile(new URL('src/client/components/project/ProjectPanel.tsx', root), 'utf8');
const locales = await readFile(new URL('src/client/locales.ts', root), 'utf8');

test('Project speed search uses a named reusable close action', () => {
  assert.match(panel, /import \{ Icon, POPUP_ICON_SIZE \} from '\.\.\/ui\/Icon'/u);
  assert.match(panel, /import \{ ToolbarButton \} from '\.\.\/ui\/ToolbarButton'/u);
  assert.match(
    panel,
    /<ToolbarButton\s+icon='close'\s+label=\{t\('editor\.treeSearchClose'\)\}\s+onClick=\{closeTreeSearch\}\s+\/>/u,
  );
  assert.doesNotMatch(panel, /onClick=\{closeTreeSearch\}>\s*×\s*<\/button>/u);
  assert.match(locales, /treeSearchClose: '关闭搜索'/u);
  assert.match(locales, /treeSearchClose: 'Close search'/u);
});

test('Project speed search row reuses the shared icon size', () => {
  const rowStart = panel.indexOf('{searchOpen ? (');
  const rowEnd = panel.indexOf('{createState !== null ? (', rowStart);
  assert.ok(rowStart >= 0 && rowEnd > rowStart);
  const row = panel.slice(rowStart, rowEnd);
  assert.match(row, /<Icon\s+name='search'\s+size=\{POPUP_ICON_SIZE\}\s+\/>/u);
  assert.doesNotMatch(row, /size=\{12\}/u);
});

test('closing Project speed search returns focus to the tree', () => {
  assert.match(
    panel,
    /const closeTreeSearch = React\.useCallback\(\(\) => \{[\s\S]*?clearTreeSearchState\(\);[\s\S]*?setSearchOpen\(false\);[\s\S]*?onApplySelection\(previous\.selection, previous\.primary, previous\.primary\);[\s\S]*?window\.setTimeout\(\(\) => treeRef\.current\?\.focus\(\), 0\);[\s\S]*?\}, \[clearTreeSearchState, onApplySelection, treeRef\]\);/u,
  );
});
