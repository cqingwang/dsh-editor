import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const [fileTreeSource, projectPanelSource, localesSource, injectedCssSource] = await Promise.all([
  readFile(new URL('../src/client/components/project/FileTreeView.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/client/components/project/ProjectPanel.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/client/locales.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/client/injected-css.ts', import.meta.url), 'utf8'),
]);

test('Project rows expose the search exclusion state to accessibility and tooltips', () => {
  assert.match(fileTreeSource, /iconClassName\?: string/u);
  assert.match(fileTreeSource, /data-dsh-tree-icon-decoration=''/u);
  assert.match(fileTreeSource, /ariaDescription\?: string/u);
  assert.match(fileTreeSource, /aria-description=\{decoration\?\.ariaDescription\}/u);
  assert.match(projectPanelSource, /searchDirectoryEffectiveState\(row\.path, searchDirectoryRules\) === 'excluded'/u);
  assert.match(
    projectPanelSource,
    /searchDirectoryExcludedWithIncludedDescendant\(row\.path, searchDirectoryRules\)/u,
  );
  assert.match(
    projectPanelSource,
    /iconClassName: searchExcluded \? 'dsh-editor-tree-icon-search-excluded' : undefined/u,
  );
  assert.match(projectPanelSource, /ariaDescription: searchExcludedDescription/u);
  assert.match(projectPanelSource, /`\$\{row\.path\}\\n\$\{searchExcludedDescription\}`/u);
  assert.match(
    projectPanelSource,
    /searchDirectoryEffectiveState\(row\.path, searchDirectoryRules\) === 'excluded'[\s\S]*?color: 'var\(--dsw-alias-label-tertiary\)'/u,
  );
  assert.match(projectPanelSource, /opacity: 0\.68/u);
});

test('the excluded icon is muted in light themes and keeps contrast in dark themes', () => {
  assert.match(
    injectedCssSource,
    /\.dsh-editor-tree-icon-search-excluded \{ opacity: 0\.55; filter: grayscale\(1\); \}/u,
  );
  assert.ok(injectedCssSource.includes("'@media (prefers-color-scheme: dark) {',"));
  assert.ok(injectedCssSource.includes("'  .dsh-editor-tree-icon-search-excluded { opacity: 0.72; }',"));
});

test('the search exclusion description is localized in both dictionaries', () => {
  assert.match(localesSource, /directoryExcludedFromSearch: '已从搜索范围排除'/u);
  assert.match(localesSource, /directoryExcludedFromSearch: 'Excluded from search scope'/u);
  assert.match(
    localesSource,
    /directoryExcludedFromSearchWithIncludedChildren: '已从搜索范围排除，部分子目录仍包含'/u,
  );
  assert.match(
    localesSource,
    /directoryExcludedFromSearchWithIncludedChildren: 'Excluded from search scope; some child folders remain included'/u,
  );
});
