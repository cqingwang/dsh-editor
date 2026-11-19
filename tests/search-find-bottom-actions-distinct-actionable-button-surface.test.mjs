import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source =
  (await readFile(new URL('../lib/client.js', import.meta.url), 'utf8')) +
  '\n' +
  (await readFile(new URL('../src/client/components/search/FindToolWindow.tsx', import.meta.url), 'utf8'));
const findTool = source.slice(
  source.indexOf('function FindToolWindowView('),
  source.indexOf('const FindToolWindow = FindToolWindowView;'),
);

test('Find bottom actions use a distinct actionable button surface', () => {
  const start = source.indexOf('findToolBottomAction: {');
  const end = source.indexOf('\n      },', start);
  assert.ok(start >= 0 && end > start);
  const style = source.slice(start, end);
  assert.match(style, /height: 24/u);
  assert.match(style, /padding: '0 10px'/u);
  assert.match(style, /background: 'var\(--dsw-alias-bg-base\)'/u);
  assert.match(style, /\.\.\.EDITOR_TEXT_STYLE\.label/u);
  assert.equal((findTool.match(/\.\.\.styles\.findToolBottomAction/gu) ?? []).length, 3);
});

test('Find bottom actions expose stable identities and keyboard metadata', () => {
  for (const id of ['open-in-find-window', 'replace-all', 'replace']) {
    assert.match(findTool, new RegExp(`'data-dsh-find-bottom-action': '${id}'`, 'u'));
  }
  const replaceStart = findTool.indexOf("'data-dsh-find-bottom-action': 'replace'");
  const replaceEnd = findTool.indexOf('onClick:', replaceStart);
  const replace = findTool.slice(replaceStart, replaceEnd);
  assert.match(replace, /title: replaceCurrentDisabledReason \|\| `\$\{t\('editor\.replaceCurrent'\)\} \(Enter\)`/u);
  assert.match(replace, /'aria-keyshortcuts': 'Enter'/u);
});
