import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = (await readFile(new URL('../src/client/components/search/SearchEverywhere.tsx', import.meta.url), 'utf8') + '\n' + (await readFile(new URL('../lib/client.js', import.meta.url), 'utf8')) + '\n' + (await readFile(new URL('../src/client/components/search/FindToolWindow.tsx', import.meta.url), 'utf8')));

function extract(name) {
  const marker = `    function ${name}(`;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `${name} should exist`);
  let index = source.indexOf('{', start);
  let depth = 0;
  for (; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    else if (source[index] === '}') {
      depth -= 1;
      if (depth === 0) return new Function(`${source.slice(start, index + 1)}; return ${name};`)();
    }
  }
  assert.fail(`unterminated ${name}`);
}

test('preview windows stay bounded but retain context around the selected line', () => {
  const preview = extract('searchEverywherePreviewWindow');
  assert.deepEqual(preview('a\nb\nc', 2, 10), {
    start: 1,
    end: 3,
    truncatedBefore: false,
    truncatedAfter: false,
  });
  const middle = preview(Array.from({ length: 100 }, (_, index) => `line ${index + 1}`).join('\n'), 50, 11);
  assert.equal(middle.start, 45);
  assert.equal(middle.end, 55);
  assert.equal(middle.truncatedBefore, true);
  assert.equal(middle.truncatedAfter, true);
});

test('Search Everywhere Preview reads the selected file and renders a highlighted line', () => {
  const dialog = source.slice(source.indexOf('function SearchEverywhere('), source.lastIndexOf('function QuickOpen('));
  assert.match(dialog, /const \[previewOpen, setPreviewOpen\] = React\.useState\(false\)/);
  assert.match(dialog, /t\('editor\.searchPreview'\)/);
  assert.match(
    dialog,
    /callFs(?:<[^>]+>)?\(\s+\{\s+op: 'read',\s+path: activeResult\.path,\s+\},\s+\{\s+signal: previewAbort\.signal,\s+\},\s+\)/u,
  );
  assert.match(dialog, /searchEverywherePreviewWindow\(/);
  assert.match(dialog, /'data-dsh-search-preview': ''/);
  assert.match(dialog, /t\('editor\.searchPreviewSoftWrap'\)/);
});

test('All-page filters can toggle files, text and actions without closing the menu', () => {
  const dialog = source.slice(source.indexOf('function SearchEverywhere('), source.lastIndexOf('function QuickOpen('));
  assert.match(dialog, /const \[searchFilters, setSearchFilters\] = React\.useState/);
  assert.match(dialog, /const \[filterMenu, setFilterMenu\] = React\.useState(?:<[^>]+>)?\(null\)/);
  assert.match(dialog, /t\('editor\.searchFilter'\)/);
  assert.match(dialog, /searchFilters\.files/);
  assert.match(dialog, /searchFilters\.text/);
  assert.match(dialog, /searchFilters\.actions/);
  assert.match(dialog, /keepOpen: true/);
  assert.match(source, /item\.keepOpen !== true\) onClose\(\)/);
});
