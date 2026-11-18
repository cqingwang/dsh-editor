import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = (await readFile(new URL('../src/client/components/search/SearchEverywhere.tsx', import.meta.url), 'utf8') + '\n' + (await readFile(new URL('../lib/client.js', import.meta.url), 'utf8')) + '\n' + (await readFile(new URL('../src/client/components/search/FindToolWindow.tsx', import.meta.url), 'utf8')));

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

function lines(count) {
  return Array.from({ length: count }, (_, index) => `line-${index + 1}`).join('\n');
}

test('saving a dirty model writes live content and clears dirty with the new mtime', () => {
  const savePath = source.slice(
    source.indexOf('const savePath = React.useCallback'),
    source.indexOf('/* Save the active model. */'),
  );
  assert.match(savePath, /content: model\.getValue\(\)/u);
  assert.match(savePath, /mtime: file\?\.mtime \?\? undefined, force/u);
  assert.match(
    savePath,
    /entry\.path === path \? \{ \.\.\.entry, content: model\.getValue\(\), dirty: false, mtime: value\.mtime \?\? entry\.mtime \}/u,
  );
});

test('Search Everywhere text requests invalidate stale responses after open-file changes', () => {
  const effect = source.slice(
    source.indexOf('const searchEverywhereRawQuery'),
    source.indexOf('/**\n       * Move a Search Everywhere result set into IDEA'),
  );
  assert.match(effect, /const requestId = \+\+searchTextRequestRef\.current/u);
  assert.match(effect, /if \(searchTextRequestRef\.current !== requestId\) return;/gu);
  assert.match(effect, /searchEverywhere\?\.fileMask,\s+openFiles,\s+t,/u);
});

test('Dirty buffers replace host rows instead of duplicating the same path', () => {
  const merge = extractFunction('mergeFindToolDirtyMatches');
  assert.match(merge, /const dirtyPaths = new Set\(\)/u);
  assert.match(merge, /dirtyPaths\.add\(file\.path\)/u);
  assert.match(merge, /\.filter\(\(match\) => !dirtyPaths\.has\(match\?\.path\)\)/u);
  assert.match(merge, /const matches = \[\.\.\.selectedDirty, \.\.\.selectedHost\]/u);
});

test('Dirty text preview reads the live buffer and the exact match line', () => {
  const dialog = source.slice(
    source.indexOf('function SearchEverywhere('),
    source.lastIndexOf('function QuickOpen('),
  );
  assert.match(dialog, /activeResult\.kind === 'text' && activeResult\.dirty === true/u);
  assert.match(
    dialog,
    /content: typeof liveFile\?\.content === 'string' \? liveFile\.content : '',\s+line: activeResult\.line \?\? 1/u,
  );
  assert.match(dialog, /previewState\.content,\s+previewState\.line/u);
});

test('402-line files retain the final match inside the bounded preview window', () => {
  const window = new Function(
    `${extractFunction('searchEverywherePreviewWindow')}; return searchEverywherePreviewWindow;`,
  )();
  const content = lines(402);
  assert.deepEqual(window(content, 402, 401), {
    start: 2,
    end: 402,
    truncatedBefore: true,
    truncatedAfter: false,
  });
  assert.deepEqual(window(content, 200, 401), {
    start: 1,
    end: 401,
    truncatedBefore: false,
    truncatedAfter: true,
  });
});

test('all text-result open paths retain line-centered navigation', () => {
  assert.match(source, /const openFileAtLocation = React\.useCallback\(\(path, line, column, options = \{\}\) =>/u);
  assert.match(source, /pendingReveal\.current = \{ path, line, column \}/u);
  assert.match(source, /revealLines\(path, line, column\)/u);
  assert.match(source, /editor\.revealLineInCenter\(safeLine\)/u);
  assert.match(
    source,
    /openFileAtLocation\(result\.path, result\.line, result\.column\)/u,
  );
  assert.match(
    source,
    /openFileAtLocation\(match\.path, match\.line, match\.column\)/u,
  );
});
