import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const findWindow = await readFile(
  new URL('../src/client/components/search/FindToolWindow.tsx', import.meta.url),
  'utf8',
);
const fileResultItem = await readFile(
  new URL('../src/client/components/search/SearchFileResultItem.tsx', import.meta.url),
  'utf8',
);

test('Find file rows use the shared filename-first and directory-detail presentation', () => {
  assert.match(findWindow, /import \{ SearchFileResultItem \} from '\.\/SearchFileResultItem'/u);
  assert.match(
    findWindow,
    /<SearchFileResultItem[\s\S]*?name=\{basename\(file\.path\)\}[\s\S]*?detail=\{dirname\(file\.path\)\}/u,
  );
  assert.match(
    findWindow,
    /<SearchFileResultItem[\s\S]*?name=\{basename\(group\.path\)\}[\s\S]*?detail=\{dirname\(group\.path\)\}/u,
  );
  assert.match(
    findWindow,
    /name=\{isText \? previewParts\(result\) : basename\(result\.path\)\}[\s\S]*?detail=\{[\s\S]*?\$\{result\.path\}:\$\{result\.line\}:\$\{result\.column\}/u,
  );
});

test('the shared file row renders the primary name before its secondary path', () => {
  const nameIndex = fileResultItem.indexOf('{name}');
  const detailIndex = fileResultItem.indexOf('{detail}');
  assert.ok(nameIndex >= 0);
  assert.ok(detailIndex > nameIndex);
  assert.match(fileResultItem, /className='dsh-editor-search-result-detail dsh-editor-search-everywhere-meta'/u);
});
