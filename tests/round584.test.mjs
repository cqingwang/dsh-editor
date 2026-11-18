import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readFile as readSource } from 'node:fs/promises';
import test from 'node:test';

const host = await import('../lib/index.js');
const source = (await readSource(new URL('./fixtures/search-everywhere.legacy.js', import.meta.url), 'utf8') + '\n' + await readSource(new URL('../lib/client.js', import.meta.url), 'utf8') + '\n' + await readSource(new URL('./fixtures/find-tool.legacy.js', import.meta.url), 'utf8'));
const hostSource = await readSource(new URL('../lib/index.js', import.meta.url), 'utf8');

function extractFunction(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} is missing`);
  const bodyStart = source.indexOf(') {', start) + 2;
  assert.ok(bodyStart > 1, `${name} has no function body`);
  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}') depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }
  assert.fail(`${name} has no closing brace`);
}

test('search options persist Preserve case as a single normalized boolean', () => {
  const normalize = new Function(
    `${extractFunction('normalizeSearchOptions')}; return normalizeSearchOptions;`,
  )();
  assert.equal(normalize(null).preserveCase, false);
  assert.equal(normalize({ preserveCase: 'yes' }).preserveCase, false);
  assert.equal(normalize({ preserveCase: true }).preserveCase, true);
});

test('Search Everywhere handoff and every workspace replace request carry Preserve case', () => {
  const handoff = new Function(
    `${extractFunction('searchEverywhereRequiresResultConfirmation')}; ${extractFunction('searchFindHandoff')}; return searchFindHandoff;`,
  )();
  const request = handoff({
    query: 'foo',
    files: [],
    matches: [{ path: 'a.txt', line: 1, column: 1 }],
    preserveCase: true,
  });
  assert.equal(request.request.preserveCase, true);
  assert.equal((source.match(/preserveCase: searchEverywhere\.preserveCase === true/gu) ?? []).length, 2);
  assert.equal((source.match(/preserveCase: findTool\.preserveCase === true/gu) ?? []).length, 4);
  assert.match(hostSource, /preserveCase: body\?\.preserveCase === true/);
});

test('the persistent Find replace bar exposes an IDEA Preserve case toggle', () => {
  const searchEverywhere = source.slice(
    source.indexOf('function SearchEverywhere('),
    source.indexOf('function FindToolWindow('),
  );
  const findWindow = source.slice(
    source.indexOf('function FindToolWindow('),
    source.indexOf('/* QUICK_OPEN_BOUNDARY */'),
  );
  assert.match(searchEverywhere, /id: 'preserveCase'/);
  assert.match(searchEverywhere, /\.\.\.\(state\.withReplace === true\s*\? \[/);
  assert.match(findWindow, /id: 'preserveCase'/);
  assert.match(findWindow, /label: t\('editor\.searchPreserveCase'\)/);
  assert.match(findWindow, /active: state\.preserveCase === true/);
  assert.match(findWindow, /onClick: onTogglePreserveCase/);
  assert.doesNotMatch(findWindow, /\.\.\.\(replaceMode\s*\? \[/);
  assert.match(source, /onTogglePreserveCase: \(\) => setFindTool/);
  assert.match(source, /onTogglePreserveCase: \(\) => setSearchEverywhere/);
  assert.match(source, /searchPreserveCase: '保留大小写'/);
  assert.match(source, /searchPreserveCase: 'Preserve case'/);
});

test('literal Replace All follows all-upper, all-lower and title case matches', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-round584-literal-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const path = join(root, 'a.txt');
  await writeFile(path, 'foo FOO Foo fOo\n', 'utf8');
  const info = await stat(path);

  const result = await host.replaceWorkspaceText(
    root,
    'foo',
    'bar',
    [{ path: 'a.txt', mtime: info.mtimeMs }],
    { caseSensitive: false, preserveCase: true },
  );
  assert.equal(result.replacements, 4);
  assert.equal(await readFile(path, 'utf8'), 'bar BAR Bar bar\n');
});

test('a single literal occurrence preserves the case of the matched text', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-round584-single-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const path = join(root, 'a.txt');
  await writeFile(path, 'foo FOO Foo\n', 'utf8');
  const info = await stat(path);

  const result = await host.replaceWorkspaceText(
    root,
    'foo',
    'name',
    [{ path: 'a.txt', mtime: info.mtimeMs }],
    { caseSensitive: false, preserveCase: true, occurrence: { line: 1, column: 5 } },
  );
  assert.equal(result.replacements, 1);
  assert.equal(await readFile(path, 'utf8'), 'foo NAME Foo\n');
});

test('Regex replacement expands captures before applying the matched case', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-round584-regex-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const path = join(root, 'a.txt');
  await writeFile(path, 'foo-12 FOO-34 Foo-56 fOo-78\n', 'utf8');
  const info = await stat(path);

  const result = await host.replaceWorkspaceText(
    root,
    '(foo)-(\\d+)',
    'id-$2',
    [{ path: 'a.txt', mtime: info.mtimeMs }],
    { regex: true, caseSensitive: false, preserveCase: true },
  );
  assert.equal(result.replacements, 4);
  assert.equal(await readFile(path, 'utf8'), 'id-12 ID-34 Id-56 id-78\n');
});
