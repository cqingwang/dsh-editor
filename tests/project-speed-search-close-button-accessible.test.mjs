import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const panel = await readFile(new URL('src/client/components/project/ProjectPanel.tsx', root), 'utf8');
const locales = await readFile(new URL('src/client/locales.ts', root), 'utf8');

test('Project speed search uses a named reusable close action', () => {
  assert.match(panel, /import \{ ToolbarButton \} from '\.\.\/ui\/ToolbarButton'/u);
  assert.match(
    panel,
    /<ToolbarButton\s+icon='close'\s+label=\{t\('editor\.treeSearchClose'\)\}\s+onClick=\{closeTreeSearch\}\s+\/>/u,
  );
  assert.doesNotMatch(panel, /onClick=\{closeTreeSearch\}>\s*×\s*<\/button>/u);
  assert.match(locales, /treeSearchClose: '关闭搜索'/u);
  assert.match(locales, /treeSearchClose: 'Close search'/u);
});

test('closing Project speed search returns focus to the tree', () => {
  assert.match(
    panel,
    /const closeTreeSearch = \(\) => \{\s*directSpeedSearchRef\.current = '';\s*clearTreeSearchState\(\);\s*setSearchOpen\(false\);\s*window\.setTimeout\(\(\) => treeRef\.current\?\.focus\(\), 0\);/u,
  );
});
