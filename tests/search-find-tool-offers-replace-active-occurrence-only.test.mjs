import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readFile as readSource } from 'node:fs/promises';
import test from 'node:test';

const host = await import('../lib/index.js');
const source = (await readSource(new URL('../lib/client.js', import.meta.url), 'utf8')) + '\n' + (await readSource(new URL('../src/client/components/search/FindToolWindow.tsx', import.meta.url), 'utf8'));

test('Find tool offers Replace for the active occurrence only', () => {
  const findToolWindow = source.slice(
    source.indexOf('function FindToolWindowView('),
    source.indexOf('const FindToolWindow = FindToolWindowView;'),
  );
  assert.match(findToolWindow, /onReplaceOccurrence/);
  assert.match(findToolWindow, /activeKind: active\?\.kind/u);
  assert.match(findToolWindow, /t\('editor\.replaceCurrent'\)/);
  assert.match(findToolWindow, /onReplaceOccurrence\(active, activeIndex\)/);
});

test('single replacement sends one precise occurrence and refreshes results', () => {
  const replacement = source.slice(
    source.indexOf('const replaceFindToolOccurrence = React.useCallback'),
    source.indexOf('const dismissExternal = React.useCallback'),
  );
  assert.match(replacement, /op: 'replaceText'/);
  assert.match(replacement, /targets: \[\{ path: match\.path, mtime: match\.mtime \}\]/);
  assert.match(replacement, /occurrence: \{ line: match\.line, column: match\.column \}/);
  assert.match(replacement, /searchReplaceDirty/);
  assert.match(replacement, /searchGeneration: \(current\.searchGeneration \?\? 0\) \+ 1/);
  assert.match(replacement, /loadedGeneration: -1/);
});

test('host replaces exactly the requested occurrence', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-round480-occurrence-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const path = join(root, 'a.txt');
  await writeFile(path, 'one needle\ntwo needle needle\n', 'utf8');
  const info = await stat(path);

  const result = await host.replaceWorkspaceText(
    root,
    'needle',
    'omega',
    [{ path: 'a.txt', mtime: info.mtimeMs }],
    { occurrence: { line: 2, column: 5 } },
  );
  assert.equal(result.changedFiles, 1);
  assert.equal(result.replacements, 1);
  assert.equal(await readFile(path, 'utf8'), 'one needle\ntwo omega needle\n');
});

test('a stale occurrence fails instead of silently replacing nothing', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-round480-stale-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const path = join(root, 'a.txt');
  await writeFile(path, 'one needle\ntwo omega needle\n', 'utf8');
  const info = await stat(path);

  await assert.rejects(
    () => host.replaceWorkspaceText(
      root,
      'needle',
      'value',
      [{ path: 'a.txt', mtime: info.mtimeMs }],
      { occurrence: { line: 2, column: 5 } },
    ),
    /search result no longer matches/u,
  );
  assert.equal(await readFile(path, 'utf8'), 'one needle\ntwo omega needle\n');
});
