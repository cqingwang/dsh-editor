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

test('preview windows keep one-line, 401-line and truncated boundaries stable', () => {
  const window = new Function(
    `${extractFunction('searchEverywherePreviewWindow')}; return searchEverywherePreviewWindow;`,
  )();
  assert.deepEqual(window('only', 1, 401), {
    start: 1,
    end: 1,
    truncatedBefore: false,
    truncatedAfter: false,
  });
  assert.deepEqual(window(lines(401), 200, 401), {
    start: 1,
    end: 401,
    truncatedBefore: false,
    truncatedAfter: false,
  });
  assert.deepEqual(window(lines(402), 200, 401), {
    start: 1,
    end: 401,
    truncatedBefore: false,
    truncatedAfter: true,
  });
});

test('long-file preview windows include first, middle and last matches', () => {
  const window = new Function(
    `${extractFunction('searchEverywherePreviewWindow')}; return searchEverywherePreviewWindow;`,
  )();
  const content = lines(1000);
  assert.deepEqual(window(content, 1, 401), {
    start: 1,
    end: 401,
    truncatedBefore: false,
    truncatedAfter: true,
  });
  assert.deepEqual(window(content, 500, 401), {
    start: 300,
    end: 700,
    truncatedBefore: true,
    truncatedAfter: true,
  });
  assert.deepEqual(window(content, 1000, 401), {
    start: 600,
    end: 1000,
    truncatedBefore: true,
    truncatedAfter: false,
  });
});

test('preview scroll clamps first and last lines without residual offsets', () => {
  const scrollTop = new Function(
    `${extractFunction('previewLineScrollTop')}; return previewLineScrollTop;`,
  )();
  const base = { containerTop: 100, containerHeight: 120, scrollHeight: 2000 };
  assert.equal(scrollTop({ ...base, scrollTop: 300, lineTop: 110, lineHeight: 17 }), 258.5);
  assert.equal(scrollTop({ ...base, scrollTop: 0, lineTop: 110, lineHeight: 17 }), 0);
  assert.equal(scrollTop({ ...base, scrollTop: 0, lineTop: 2100, lineHeight: 17 }), 1880);
});

test('Search Everywhere dirty search invalidates stale requests on file changes', () => {
  assert.match(source, /const requestId = \+\+searchTextRequestRef\.current/u);
  assert.match(source, /if \(searchTextRequestRef\.current !== requestId\) return;/gu);
  assert.match(
    source,
    /searchEverywhere\?\.fileMask,\s+openFiles,\s+t,/u,
  );
});

test('Dirty preview and save/reload paths keep current content authoritative', () => {
  const dialog = source.slice(source.indexOf('function SearchEverywhere('), source.lastIndexOf('function QuickOpen('));
  assert.match(dialog, /activeResult\.kind === 'text' && activeResult\.dirty === true/u);
  assert.match(dialog, /Array\.isArray\(openFiles\) \? openFiles : \[\]/u);
  assert.match(dialog, /activeResult\?\.dirty, openFiles\]/u);
  assert.match(source, /\.\.\.entry, content: model\.getValue\(\), dirty: false, mtime:/u);
  assert.match(source, /\.\.\.entry, content: value\.content, dirty: false, mtime:/u);
  assert.match(source, /textRevision: \(current\.textRevision \?\? 0\) \+ 1/u);
});

test('Every text result open action preserves path, line and column', () => {
  assert.match(source, /openFileAtLocation\(result\.path, result\.line, result\.column\)/u);
  assert.match(source, /openFileAtLocation\(match\.path, match\.line, match\.column\)/u);
  assert.match(source, /revealSplitLocation\(lastOpened, location\.line, location\.column\)/u);
});
