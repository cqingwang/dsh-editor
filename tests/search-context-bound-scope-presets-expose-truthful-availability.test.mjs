import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source =
  (await readFile(new URL('../lib/client.js', import.meta.url), 'utf8')) +
  '\n' +
  (await readFile(new URL('../src/client/components/search/FindToolWindow.tsx', import.meta.url), 'utf8'));

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
    source.lastIndexOf('function FindToolWindowView('),
    source.indexOf('const FindToolWindow = FindToolWindowView;', source.lastIndexOf('function FindToolWindowView(')),
  );
  assert.match(
    component,
    /const selectedScopePresetAvailable = findSearchScopePresetAvailable\(scopePreset, \{\s+gitAvailable,\s+recentFileCount: recentFilePaths\.length,\s+openFileCount: openFilePaths\.length,\s+currentFileAvailable: activeFilePath !== null,\s+changedFileCount: changedFilePaths\.length,\s+\}\);/u,
  );
  assert.match(
    component,
    /const effectiveScopePreset =\s+selectedCustomScopeMissing \|\| selectedScopePresetAvailable !== true \? 'projectFiles' : scopePreset;/u,
  );
});

test('Scope select disables every unavailable context-bound option', () => {
  for (const [value, condition] of [
    ['openFiles', 'openFilePaths.length === 0'],
    ['currentFile', 'activeFilePath === null'],
    ['changedFiles', 'changedFilePaths.length === 0'],
    ['recentlyViewedFiles', 'recentFilePaths.length === 0'],
    ['gitNonIgnoredFiles', 'gitAvailable !== true'],
    ['gitTrackedFiles', 'gitAvailable !== true'],
  ]) {
    assert.match(
      source,
      new RegExp(`value='${value}'\\s+disabled=\\{${condition.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\}`, 'u'),
    );
  }
});

test('Find popup geometry clamps when the viewport shrinks', () => {
  assert.match(
    source,
    /const handleViewportResize = \(\) => \{[\s\S]*?clampFloatingPopupGeometry\(current, window\.innerWidth, window\.innerHeight\);/u,
  );
  assert.match(source, /window\.addEventListener\('resize', handleViewportResize\)/u);
  assert.match(source, /window\.removeEventListener\('resize', handleViewportResize\)/u);
});
