import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('Search Everywhere ignores Escape while the IME is composing', async () => {
  const source = await read('src/client/components/search/SearchEverywhere.tsx');

  assert.match(
    source,
    /data-dsh-search-query=''[\s\S]*?onKeyDown=\{\(event\) => \{\s+if \(event\.nativeEvent\.isComposing === true\) return;/u,
  );
  assert.match(
    source,
    /data-dsh-search-replace-input=''[\s\S]*?onKeyDown=\{\(event\) => \{\s+if \(event\.nativeEvent\.isComposing === true\) return;/u,
  );
});

test('Find tool query, replacement and root Escape ignore IME composition', async () => {
  const source = await read('src/client/components/search/FindToolWindow.tsx');
  assert.match(
    source,
    /data-dsh-find-tool-window=''[\s\S]*?onKeyDown=\{\(event\) => \{\s+if \(event\.nativeEvent\.isComposing === true\) return;/u,
  );
  assert.match(
    source,
    /<QueryField[\s\S]*?onKeyDown=\{\(event\) => \{\s+if \(event\.nativeEvent\.isComposing === true\) return;/u,
  );
  assert.match(
    source,
    /data-dsh-find-replace-input[\s\S]*?onKeyDown=\{\(event\) => \{\s+if \(event\.nativeEvent\.isComposing === true\) return;/u,
  );
});

test('editor Find query and Commit Log filter ignore IME-composed Escape', async () => {
  const editor = await read('src/client/components/editor/EditorFindBar.tsx');
  const commit = await read('src/client/components/commit/CommitLogToolbar.tsx');

  assert.match(
    editor,
    /data-dsh-editor-find-input[\s\S]*?onKeyDown=\{\(event\) => \{\s+if \(event\.nativeEvent\.isComposing === true\) return;/u,
  );
  assert.match(
    commit,
    /onKeyDown=\{\(event\) => \{\s+if \(event\.nativeEvent\.isComposing === true\) return;\s+if \(event\.key === 'Escape'\)/u,
  );
});
