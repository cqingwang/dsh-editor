import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = (await readFile(new URL('../lib/client.js', import.meta.url), 'utf8')) + '\n' + (await readFile(new URL('./fixtures/find-tool.legacy.js', import.meta.url), 'utf8'));

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

test('context-bound Scope presets expose truthful availability', () => {
  const available = new Function(
    `${extractFunction('findSearchScopePresetAvailable')}; return findSearchScopePresetAvailable;`,
  )();
  const empty = {
    gitAvailable: false,
    recentFileCount: 0,
    openFileCount: 0,
    currentFileAvailable: false,
    changedFileCount: 0,
  };
  for (const preset of [
    'gitTrackedFiles',
    'gitNonIgnoredFiles',
    'recentlyViewedFiles',
    'openFiles',
    'currentFile',
    'changedFiles',
  ]) {
    assert.equal(available(preset, empty), false, preset);
  }
  const populated = {
    gitAvailable: true,
    recentFileCount: 1,
    openFileCount: 1,
    currentFileAvailable: true,
    changedFileCount: 1,
  };
  for (const preset of [
    'gitTrackedFiles',
    'gitNonIgnoredFiles',
    'recentlyViewedFiles',
    'openFiles',
    'currentFile',
    'changedFiles',
  ]) {
    assert.equal(available(preset, populated), true, preset);
  }
  assert.equal(available('projectFiles', empty), true);
});

test('unavailable persisted Scope presets fall back to Project Files', () => {
  const component = source.slice(
    source.indexOf('function FindToolWindow('),
    source.indexOf('/* QUICK_OPEN_BOUNDARY */'),
  );
  assert.match(
    component,
    /const selectedScopePresetAvailable = findSearchScopePresetAvailable\(scopePreset, \{[\s\S]*?openFileCount: openFilePaths\.length,[\s\S]*?currentFileAvailable: activeFilePath !== null,[\s\S]*?changedFileCount: changedFilePaths\.length,/u,
  );
  assert.match(
    component,
    /const effectiveScopePreset = selectedCustomScopeMissing \|\| selectedScopePresetAvailable !== true\s+\? 'projectFiles'\s+: scopePreset;/u,
  );
});

test('Scope select disables every unavailable context-bound option', () => {
  assert.match(source, /value: 'openFiles', disabled: openFilePaths\.length === 0/u);
  assert.match(source, /value: 'currentFile', disabled: activeFilePath === null/u);
  assert.match(source, /value: 'changedFiles', disabled: changedFilePaths\.length === 0/u);
  assert.match(source, /value: 'recentlyViewedFiles', disabled: recentFilePaths\.length === 0/u);
  assert.match(source, /value: 'gitNonIgnoredFiles', disabled: gitAvailable !== true/u);
  assert.match(source, /value: 'gitTrackedFiles', disabled: gitAvailable !== true/u);
});

test('Find popup geometry clamps when the viewport shrinks', () => {
  assert.match(
    source,
    /const onViewportResize = \(\) => \{\s+setFindToolPopupGeometry\(\(current\) => clampFindPopupGeometry\([\s\S]*?window\.innerWidth,[\s\S]*?window\.innerHeight,/u,
  );
  assert.match(source, /window\.addEventListener\('resize', onViewportResize\)/u);
  assert.match(source, /window\.removeEventListener\('resize', onViewportResize\)/u);
});
