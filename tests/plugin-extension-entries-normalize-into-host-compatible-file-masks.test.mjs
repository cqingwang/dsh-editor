import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = (await readFile(new URL('./fixtures/search-everywhere.legacy.js', import.meta.url), 'utf8') + '\n' + (await readFile(new URL('../lib/client.js', import.meta.url), 'utf8')) + '\n' + (await readFile(new URL('./fixtures/find-tool.legacy.js', import.meta.url), 'utf8')));

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

function loadHelpers() {
  return new Function(
    'basename',
    `${extractFunction('wholeWordIndex')};`
      + `${extractFunction('normalizeFileExtensionFilter')};`
      + `${extractFunction('fileExtensionFilterMatches')};`
      + `${extractFunction('fuzzyScore')};`
      + 'return { wholeWordIndex, normalizeFileExtensionFilter, fileExtensionFilterMatches, fuzzyScore };',
  )((path) => path.split('/').at(-1));
}

test('extension entries normalize into host-compatible file masks', () => {
  const { normalizeFileExtensionFilter } = loadHelpers();
  assert.equal(normalizeFileExtensionFilter('.ts, md'), '*.ts,*.md');
  assert.equal(normalizeFileExtensionFilter('*.json, src/**'), '*.json,src/**');
  assert.equal(normalizeFileExtensionFilter(''), '');
});

test('file extension filtering applies to the Files provider as well as Text', () => {
  const { fileExtensionFilterMatches } = loadHelpers();
  assert.equal(fileExtensionFilterMatches('README.md', '.md'), true);
  assert.equal(fileExtensionFilterMatches('src/app.js', '.md'), false);
  assert.equal(fileExtensionFilterMatches('src/app.ts', '.ts, .md'), true);
  assert.equal(fileExtensionFilterMatches('src/app.test.ts', '.ts, !*.test.ts'), false);
  assert.equal(fileExtensionFilterMatches('src/**/app.ts', 'src/**'), true);
});

test('case and whole-word filters are shared by path and Action matching', () => {
  const { fuzzyScore, wholeWordIndex } = loadHelpers();
  assert.ok(fuzzyScore('README.md', 'read', { caseSensitive: true }) < 0);
  assert.ok(fuzzyScore('README.md', 'read', { caseSensitive: false }) >= 0);
  assert.ok(fuzzyScore('README.md', 'README', { wholeWords: true }) >= 0);
  assert.ok(fuzzyScore('README.md', 'READ', { wholeWords: true }) < 0);
  assert.ok(fuzzyScore('README.md', 'EAD', { wholeWords: true }) < 0);
  assert.equal(wholeWordIndex('Find Usages', 'Find', true), 0);
  assert.equal(wholeWordIndex('Find Usages', 'ind', true), -1);
});

test('Search Everywhere applies the shared filters to Actions and Files', () => {
  assert.match(source, /rankSearchActions\(actions, effectiveQuery, recentCommands, \{[\s\S]*?caseSensitive: state\.caseSensitive === true,[\s\S]*?wholeWords: state\.wholeWords === true,/);
  assert.match(source, /\.filter\(\(path\) => fileExtensionFilterMatches\(path, state\.fileMask\)\)/);
  assert.match(source, /fuzzyScore\(path, effectiveQuery, \{[\s\S]*?caseSensitive: state\.caseSensitive === true,[\s\S]*?wholeWords: state\.wholeWords === true,/);
});

test('the three common filters live in a right-aligned toolbar group', () => {
  const dialog = source.slice(
    source.indexOf('function SearchEverywhere('),
    source.indexOf('function FindToolWindow('),
  );
  const caseAt = dialog.indexOf("id: 'case'");
  const wordsAt = dialog.indexOf("id: 'words'");
  const extensionAt = dialog.indexOf("id: 'extension'");
  const openFindAt = dialog.indexOf("id: 'openFind'");
  assert.ok(openFindAt >= 0 && caseAt > openFindAt && wordsAt > caseAt && extensionAt > wordsAt);
  assert.match(dialog, /active: state\.caseSensitive === true/);
  assert.match(dialog, /disabled: state\.regex === true/);
  assert.match(dialog, /t\('editor\.searchFileSuffixFilter'\)/);
  assert.match(source, /searchEverywhereActionBar: \{[\s\S]*?justifyContent: 'flex-end'/);
  assert.match(dialog, /style: styles\.searchEverywhereActionBar/);
});

test('extension input is opened from the toolbar and hidden when unused', () => {
  const dialog = source.slice(
    source.indexOf('function SearchEverywhere('),
    source.indexOf('function FindToolWindow('),
  );
  assert.match(dialog, /const \[fileMaskOpen, setFileMaskOpen\] = React\.useState\(false\)/);
  assert.match(dialog, /fileMaskOpen \|\| String\(state\.fileMask \?\? ''\)\.trim\(\) !== ''/);
  assert.match(dialog, /ref: fileMaskInputRef/);
  assert.match(dialog, /setFileMaskOpen\(\(open\) => !open\)/);
  assert.match(dialog, /fileMaskInputRef\.current\?\.focus\?\.\(\)/);
});

test('all text-search and replace handoffs use normalized extension masks', () => {
  assert.ok((source.match(/fileMask: normalizeFileExtensionFilter\(/g) ?? []).length >= 7);
  assert.match(source, /searchFileMaskLabel: '文件掩码'/);
  assert.match(source, /searchFileMaskLabel: 'File mask'/);
  assert.match(source, /searchFileMask: '文件掩码（例如 \.ts, \.md；也支持 \*\.ts, src\/\*\*）'/);
  assert.match(source, /searchFileSuffixFilter: '文件掩码筛选'/);
  assert.match(source, /searchFileSuffixFilter: 'File mask filter'/);
});

test('double Shift and Cmd/Ctrl+Shift+F call one Find in Files shortcut body', () => {
  const shortcut = source.slice(
    source.indexOf('const openFindInFilesFromShortcut = React.useCallback'),
    source.indexOf('const closeFindToolWindow', source.indexOf('const openFindInFilesFromShortcut = React.useCallback')),
  );
  assert.match(shortcut, /if \(findTool !== null\)/);
  assert.match(shortcut, /selectedEditorFindQuery\(currentCodeEditor\(\)\)/);
  assert.match(shortcut, /openFindTool\(selectedQuery, 'find'\)/);
  const doubleShiftEffect = source.slice(
    source.indexOf('/* Double Shift remains a registered alias'),
    source.indexOf('React.useEffect(() => {\n        searchEverywhereFilesRequestRef', source.indexOf('/* Double Shift remains a registered alias')),
  );
  assert.match(doubleShiftEffect, /doubleShiftAction\(/);
  assert.match(doubleShiftEffect, /openFindInFilesFromShortcut\(\)/);
  assert.doesNotMatch(doubleShiftEffect, /openSearchEverywhere/);
  const cmdShift = source.slice(
    source.indexOf("if (key === 'f' && event.shiftKey)"),
    source.indexOf("const host = document.querySelector('[data-dsh-editor-workspace]');", source.indexOf("if (key === 'f' && event.shiftKey)")),
  );
  assert.match(cmdShift, /openFindInFilesFromShortcut\(\)/);
});

test('Find in Files keeps File mask top-right and query filters at the right edge', () => {
  const findTool = source.slice(
    source.indexOf('function FindToolWindow('),
    source.indexOf('/* QUICK_OPEN_BOUNDARY */'),
  );
  assert.match(findTool, /styles\.findToolFileMaskControl/);
  assert.match(findTool, /type: 'checkbox'/);
  assert.match(findTool, /styles\.findToolFileMaskInput/);
  assert.match(findTool, /style: styles\.findToolFilterGroup/);
  assert.match(findTool, /icon: 'matchCase'/);
  assert.match(findTool, /icon: 'wholeWords'/);
  assert.match(findTool, /icon: 'regex'/);
  const toolbarActions = findTool.slice(findTool.indexOf('const toolbarActions = ['), findTool.indexOf('React.useEffect(() => {\n        if (handoffRevision'));
  assert.doesNotMatch(toolbarActions, /id: 'case'/);
  assert.doesNotMatch(toolbarActions, /id: 'words'/);
  assert.doesNotMatch(toolbarActions, /id: 'regex'/);
  assert.match(source, /findToolFileMaskControl: \{[\s\S]*?justify-content|findToolFileMaskControl: \{[\s\S]*?display: 'inline-flex'/);
  assert.match(source, /findToolFilterGroup: \{[\s\S]*?marginLeft: 'auto'/);
});

test('Find in Files scope row maps Project, Directory and truthful presets', () => {
  const scope = new Function(
    `${extractFunction('findToolPathMatchesScope')}; return findToolPathMatchesScope;`,
  )();
  assert.equal(scope('src/app.ts', 'project', {}), true);
  assert.equal(scope('src/app.ts', 'directory', { directory: 'src' }), true);
  assert.equal(scope('docs/readme.md', 'directory', { directory: 'src' }), false);
  assert.equal(scope('src/app.ts', 'scope', { allowedPaths: ['src/app.ts'] }), true);
  assert.equal(scope('src/other.ts', 'scope', { allowedPaths: ['src/app.ts'] }), false);
  assert.equal(scope('src/app.ts', 'scope', { preset: 'projectFiles' }), true);

  const findTool = source.slice(
    source.indexOf('function FindToolWindow('),
    source.indexOf('/* QUICK_OPEN_BOUNDARY */'),
  );
  assert.match(findTool, /'data-dsh-find-scope': ''/);
  assert.match(findTool, /id: 'project'/);
  assert.match(findTool, /id: 'module'[\s\S]*?disabled: true/);
  assert.match(findTool, /id: 'directory'/);
  assert.match(findTool, /id: 'scope'/);
  assert.match(findTool, /findScopeProjectFiles/);
  assert.match(findTool, /findScopeOpenFiles/);
  assert.match(findTool, /findScopeChangedFiles/);
  assert.match(source, /React\.createElement\(FindToolWindow, \{[\s\S]*?activeFilePath: activePath/);
  assert.doesNotMatch(source, /React\.createElement\(FindToolWindow, \{[\s\S]*?\n\s+activeFilePath,\n/);
});

test('scope filtering also limits Replace All targets', () => {
  assert.match(source, /const scopedReplacementPaths = new Set\(scopedMatches\.map\(\(match\) => match\.path\)\)/);
  assert.match(source, /onReplaceAll\(scopedReplacementPaths\)/);
  assert.match(source, /const replaceInFindTool = React\.useCallback\(async \(allowedPaths = null\)/);
  assert.match(source, /\.filter\(\(match\) => allowed === null \|\| allowed\.has\(match\.path\)\)/);
});

test('repeating the shortcut focuses an open Find without resetting it', () => {
  const shortcut = source.slice(
    source.indexOf('const openFindInFilesFromShortcut = React.useCallback'),
    source.indexOf('openFindTool(textQuery, \'find\')', source.indexOf('const openFindInFilesFromShortcut = React.useCallback')),
  );
  assert.match(shortcut, /if \(findTool !== null\)/);
  assert.match(shortcut, /mode: 'find'/);
  assert.match(shortcut, /input\[role="combobox"\]/);
});
