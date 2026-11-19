import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadTypeScriptModule } from './ts-source.mjs';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');
const viewModel = await read('src/client/components/commit/commit-log-view-model.ts');
const { commitLogDisplayTitle } = loadTypeScriptModule(viewModel, ['commitLogDisplayTitle']);

test('Commit Log title retains the base label for a blank query', () => {
  assert.equal(commitLogDisplayTitle('Commit', ''), 'Commit');
  assert.equal(commitLogDisplayTitle('Commit', '   '), 'Commit');
});

test('Commit Log title exposes the trimmed active query like IDEA', () => {
  assert.equal(commitLogDisplayTitle('Commit', ' no-such-commit-query '), "Commit: 'no-such-commit-query'");
});

test('CommitLogToolbar renders the filter-aware title with a full tooltip', async () => {
  const toolbar = await read('src/client/components/commit/CommitLogToolbar.tsx');

  assert.match(toolbar, /import \{ commitLogDisplayTitle \} from '\.\/commit-log-view-model'/u);
  assert.match(toolbar, /const hasActiveFilter = filter\.trim\(\) !== '';/u);
  assert.match(toolbar, /const displayTitle = commitLogDisplayTitle\(t\('editor\.tabLog'\), filter\);/u);
  assert.match(
    toolbar,
    /className='dsh-editor-log-title'[\s\S]*?data-dsh-log-filter-active=\{hasActiveFilter \? '' : undefined\}[\s\S]*?title=\{displayTitle\}[\s\S]*?\{displayTitle\}/u,
  );
  assert.doesNotMatch(toolbar, /className='dsh-editor-log-title'[\s\S]*?\{t\('editor\.tabLog'\)\}/u);
});

test('narrow Commit Log shows an active query title without squeezing actions', async () => {
  const injectedCss = await read('src/client/injected-css.ts');

  assert.match(
    injectedCss,
    /@container \(max-width: 520px\) \{[\s\S]*?\.dsh-editor-log-title \{ display: none !important; \}[\s\S]*?\.dsh-editor-log-title\[data-dsh-log-filter-active\] \{[\s\S]*?display: inline-flex !important;[\s\S]*?flex: 1 0 100% !important;/u,
  );
});
