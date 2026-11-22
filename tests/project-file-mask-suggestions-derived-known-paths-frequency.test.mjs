import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { menuSource } from './ui-sources.mjs';

const source =
  (await readFile(new URL('../src/client/components/project/ProjectPanel.tsx', import.meta.url), 'utf8')) +
  '\n' +
  (await readFile(new URL('../lib/client.js', import.meta.url), 'utf8')) +
  '\n' +
  (await readFile(new URL('../src/client/components/search/FindToolWindow.tsx', import.meta.url), 'utf8'));
const projectPanelSource = await readFile(
  new URL('../src/client/components/project/ProjectPanel.tsx', import.meta.url),
  'utf8',
);

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

test('File mask suggestions are derived from known paths by frequency', () => {
  const suggest = new Function(`${extractFunction('suggestFileMasks')}; return suggestFileMasks;`)();
  assert.deepEqual(
    suggest(
      [
        'src/app.ts',
        'src/main.ts',
        'README.md',
        'src/types.ts',
        'docs/guide.md',
        'scripts/build.mjs',
        'Makefile',
        '.env',
        'weird.this-extension-is-too-long',
        'bad.file name',
      ],
      [],
      10,
    ),
    ['*.ts', '*.md', '*.mjs'],
  );
});

test('File mask suggestions exclude masks already present in history', () => {
  const suggest = new Function(`${extractFunction('suggestFileMasks')}; return suggestFileMasks;`)();
  assert.deepEqual(suggest(['a.ts', 'b.ts', 'c.md'], ['*.TS'], 10), ['*.md']);
});

test('File mask menu places history before suggestions and Clear last', () => {
  const menu = source.slice(
    source.indexOf('const openFileMaskMenu = (event) =>'),
    source.indexOf('const openFilterMenu = (event) =>'),
  );
  assert.match(menu, /const historyItems =/);
  assert.match(menu, /const suggestionItems = fileMaskSuggestions\.map/);
  assert.match(menu, /\.\.\.historyItems/);
  assert.match(menu, /\.\.\.suggestionItems/);
  assert.match(menu, /id: 'clearFileMask'/);
  assert.ok(menu.indexOf('...historyItems') < menu.indexOf('...suggestionItems'));
  assert.ok(menu.indexOf('...suggestionItems') < menu.indexOf("id: 'clearFileMask'"));
});

test('suggestions reuse known workspace paths without another filesystem walk', () => {
  assert.match(source, /const fileMaskSuggestionPaths = \[/);
  assert.match(source, /openFilePaths/);
  assert.match(source, /recentFilePaths/);
  assert.match(source, /changedFilePaths/);
  assert.match(source, /state\.files/);
  assert.match(source, /state\.matches/);
  assert.match(source, /const fileMaskSuggestions = React\.useMemo\(\(\) => \{/);
  const suggestionStart = source.indexOf('const fileMaskSuggestions = React.useMemo(');
  const suggestionEnd = source.indexOf('const rovingGroupPath =', suggestionStart);
  assert.ok(suggestionStart >= 0 && suggestionEnd > suggestionStart);
  const suggestionBlock = source.slice(suggestionStart, suggestionEnd);
  assert.match(suggestionBlock, /return suggestFileMasks\(fileMaskSuggestionPaths, fileMaskHistory, 12\);/);
  assert.doesNotMatch(suggestionBlock, /callFs(?:<[^>]+>)?\(\{ op: 'files'/);
});

test('Git and Recently Viewed scopes expose truthful disabled states', () => {
  const available = new Function(
    `${extractFunction('findSearchScopePresetAvailable')}; return findSearchScopePresetAvailable;`,
  )();
  assert.equal(available('projectFiles'), true);
  assert.equal(available('gitTrackedFiles', { gitAvailable: false }), false);
  assert.equal(available('gitNonIgnoredFiles', { gitAvailable: true }), true);
  assert.equal(available('recentlyViewedFiles', { recentFileCount: 0 }), false);
  assert.equal(available('recentlyViewedFiles', { recentFileCount: 2 }), true);
  assert.match(source, /gitAvailable = false/);
  assert.match(source, /value='gitNonIgnoredFiles'\s+disabled=\{gitAvailable !== true\}>/u);
  assert.match(source, /value='gitTrackedFiles'\s+disabled=\{gitAvailable !== true\}>/u);
  assert.match(source, /value='recentlyViewedFiles'\s+disabled=\{recentFilePaths\.length === 0\}>/u);
  assert.match(
    source,
    /findSearchScopePresetAvailable\(scopePreset, \{[\s\S]*?gitAvailable,[\s\S]*?recentFileCount: recentFilePaths\.length/u,
  );
  assert.match(
    source,
    /const selectedScopePresetAvailable = findSearchScopePresetAvailable\(scopePreset, \{\s+gitAvailable,[\s\S]*?\}\);\s+const effectiveScopePreset =\s+selectedCustomScopeMissing \|\| selectedScopePresetAvailable !== true \? 'projectFiles' : scopePreset;/u,
  );
  assert.match(source, /gitAvailable: git !== null && typeof git\.branch === 'string' && git\.branch !== ''/u);
});

test('Project speed search never claims IDEA Shift+Cmd/Ctrl+F', () => {
  const marker = '/* ⌘/Ctrl+F inside the tool window filters the tree in place, like IDEA. */';
  const start = projectPanelSource.indexOf(marker);
  assert.notEqual(start, -1, 'Project speed search shortcut is missing');
  const handler = projectPanelSource.slice(
    start,
    projectPanelSource.indexOf('React.useEffect(() => {\n    const query = search.trim();', start),
  );
  assert.match(
    handler,
    /if \(!\(event\.metaKey \|\| event\.ctrlKey\) \|\| event\.altKey \|\| event\.shiftKey \|\| event\.key\.toLowerCase\(\) !== 'f'\)[\s\S]*?return;/u,
  );
  assert.doesNotMatch(handler, /openFindInFilesFromShortcut|data-dsh-find-tool-window/u);
});

test('Find menus are clamped inside the dialog hit-testing surface', () => {
  const clamp = new Function(
    `${extractFunction('findToolMenuLeft')}\n${extractFunction('findToolMenuTop')}\n${extractFunction('findToolMenuMaxHeight')}\n${extractFunction('findToolMenuMaxWidth')}; return { findToolMenuLeft, findToolMenuTop, findToolMenuMaxHeight, findToolMenuMaxWidth };`,
  )();
  assert.equal(clamp.findToolMenuLeft(754, 232, 812), 588);
  assert.equal(clamp.findToolMenuLeft(900, 232, 812), 588);
  assert.equal(clamp.findToolMenuLeft(250, 232, 812), 250);
  assert.equal(clamp.findToolMenuLeft(900, undefined, undefined), 900);
  assert.equal(clamp.findToolMenuTop(196, 60.5, 596.5), 196);
  assert.equal(clamp.findToolMenuTop(700, 60.5, 596.5), 432.5);
  assert.equal(clamp.findToolMenuMaxHeight(60.5, 596.5, 196), 380.5);
  assert.equal(clamp.findToolMenuMaxWidth(200, 708), 320);
  assert.equal(clamp.findToolMenuMaxWidth(0, 250), 242);
  /* The test source joins lib/client.js and the TSX source, so a synchronized
     build contains each of the six menu factories twice. */
  assert.equal((source.match(/maxWidth: menuMaxWidth/g) ?? []).length, 12);
  assert.match(source, /const surfaceRect = event\.currentTarget\.closest\('\[data-dsh-find-tool-window\]'\)/u);
  assert.match(
    source,
    /x: findToolMenuLeft\(\s*rect\.right - menuMaxWidth,[\s\S]*?menuMaxWidth,\s*\)/u,
  );
  assert.match(
    source,
    /x: findToolMenuLeft\(\s*rect\.left,[\s\S]*?menuMaxWidth,\s*\)/u,
  );
  assert.match(source, /maxHeight: findToolMenuMaxHeight\(/u);
  assert.match(menuSource, /maxWidth: menu\.maxWidth/u);
  assert.match(menuSource, /maxHeight: menuHeight/u);
  assert.match(menuSource, /overflowY: 'auto'/u);
});
