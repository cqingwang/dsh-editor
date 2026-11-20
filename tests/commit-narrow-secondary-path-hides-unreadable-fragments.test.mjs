import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const panel = await readFile(new URL('src/client/components/commit/CommitPanel.tsx', root), 'utf8');
const injectedCss = await readFile(new URL('src/client/injected-css.ts', root), 'utf8');
const styles = await readFile(new URL('src/client/ui/styles.ts', root), 'utf8');
const inlineStyles = await readFile(new URL('src/client/inline-styles.ts', root), 'utf8');

test('Commit parent paths hide unreadable fragments through one shared block', () => {
  assert.match(panel, /function CommitSecondaryPath\(/u);
  assert.equal((panel.match(/<CommitSecondaryPath\b/gu) ?? []).length, 2);
  assert.match(panel, /className='dsh-editor-commit-path-suffix'/u);
  assert.match(panel, /className='dsh-editor-commit-path-suffix-text'/u);
  assert.match(injectedCss, /\.dsh-editor-commit-path-suffix \{[\s\S]*?container-type: inline-size/u);
  assert.match(
    injectedCss,
    /@container \(max-width: 3ch\) \{[\s\S]*?\.dsh-editor-commit-path-suffix-text[\s\S]*?visibility: hidden/u,
  );
  assert.match(styles, /commitFileDir: \{[\s\S]*?boxSizing: 'border-box'/u);
  assert.match(inlineStyles, /commitFileDir: \{[\s\S]*?boxSizing: 'border-box'/u);
});

test('an empty directory parent path keeps the line-count grid column', () => {
  const helperStart = panel.indexOf('function CommitSecondaryPath(');
  const helperEnd = panel.indexOf('export interface CommitPanelProps', helperStart);
  const helper = panel.slice(helperStart, helperEnd);
  assert.doesNotMatch(helper, /return null/u);
  assert.match(helper, /title=\{value === '' \? undefined : value\}/u);
  const pathIndex = panel.indexOf('<CommitSecondaryPath text={row.parent} />');
  const lineCountIndex = panel.indexOf('<LineCounts', pathIndex);
  assert.ok(pathIndex >= 0 && lineCountIndex > pathIndex);
});
