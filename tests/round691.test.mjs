import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source =
  (await readFile(new URL('../lib/client.js', import.meta.url), 'utf8')) +
  '\n' +
  (await readFile(new URL('./fixtures/find-tool.legacy.js', import.meta.url), 'utf8'));

function extractFunction(name) {
  const start = source.indexOf(`    function ${name}(`);
  assert.notEqual(start, -1, `${name} is missing`);
  const bodyStart = source.indexOf('{', start);
  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}') depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }
  assert.fail(`${name} has no closing brace`);
}

const normalizeFindSearchScope = new Function(
  `${extractFunction('normalizeFindSearchScope')}; return normalizeFindSearchScope;`,
)();

test('Find scope persists Current File as a real preset', () => {
  assert.deepEqual(
    normalizeFindSearchScope({ mode: 'scope', preset: 'currentFile' }),
    { mode: 'scope', preset: 'currentFile', directory: '' },
  );
  assert.deepEqual(
    normalizeFindSearchScope({ mode: 'scope', preset: 'unknown' }),
    { mode: 'scope', preset: 'projectFiles', directory: '' },
  );
});

test('Current File is exposed in the IDEA Scope selector', () => {
  assert.match(
    source,
    /state\.searchScopePreset === 'openFiles'[\s\S]*?state\.searchScopePreset === 'changedFiles'[\s\S]*?state\.searchScopePreset === 'currentFile'/u,
  );
  assert.match(source, /value: 'currentFile', disabled: activeFilePath === null \}, t\('editor\.findScopeCurrentFile'\)/u);
  assert.match(source, /findScopeCurrentFile: '当前文件'/u);
  assert.match(source, /findScopeCurrentFile: 'Current File'/u);
});

test('Current File supplies the active editor path to host search and replacement', () => {
  assert.match(
    source,
    /findToolSearchScopePreset === 'currentFile'[\s\S]*?currentCodePath\(\)[\s\S]*?findToolSearchScopePreset === 'openFiles'/u,
  );
  assert.match(
    source,
    /findTool\?\.searchScopePreset !== 'projectFiles'[\s\S]*?findToolAllowedScopePaths/u,
  );
});

test('Floating Find starts with the Replace row visible while the dock stays compact', () => {
  assert.match(
    source,
    /const \[replaceExpanded, setReplaceExpanded\] = React\.useState\(\(\) => floating \|\| state\.mode === 'replace'\)/u,
  );
});
