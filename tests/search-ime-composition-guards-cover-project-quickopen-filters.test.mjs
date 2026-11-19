import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('QuickOpen ignores keyboard actions during IME composition', async () => {
  const source = await read('src/client/components/search/QuickOpen.tsx');

  assert.match(
    source,
    /autoFocus=\{true\}[\s\S]*?onKeyDown=\{\(event\) => \{\s+if \(event\.nativeEvent\.isComposing === true\) return;/u,
  );
});

test('Project speed search ignores keyboard actions during IME composition', async () => {
  const source = await read('src/client/components/project/ProjectPanel.tsx');

  assert.match(
    source,
    /ref=\{searchRef\}[\s\S]*?onKeyDown=\{\(event\) => \{\s+if \(event\.nativeEvent\.isComposing === true\) return;/u,
  );
});

test('Changes path filter ignores keyboard actions during IME composition', async () => {
  const source = await read('src/client/components/commit/CommitPanel.tsx');

  assert.match(
    source,
    /ref=\{changeFilterRef\}[\s\S]*?onKeyDown=\{\(event\) => \{\s+if \(event\.nativeEvent\.isComposing === true\) return;/u,
  );
});

test('Find file mask ignores Enter during IME composition', async () => {
  const source = await read('src/client/components/search/FindToolWindow.tsx');

  assert.match(
    source,
    /value=\{fileMaskDraft\}[\s\S]*?onKeyDown=\{\(event\) => \{\s+if \(event\.nativeEvent\.isComposing === true\) return;/u,
  );
});
