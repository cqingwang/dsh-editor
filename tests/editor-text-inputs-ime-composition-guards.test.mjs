import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('Commit message ignores submission and history while composing', async () => {
  const source = await read('src/client/components/commit/CommitPanel.tsx');

  assert.match(
    source,
    /ref=\{commitMessageRef\}[\s\S]*?onKeyDown=\{\(event\) => \{\s+if \(event\.nativeEvent\.isComposing === true\) return;/u,
  );
});

test('Project create and rename ignore keys while composing', async () => {
  const source = await read('src/client/components/project/ProjectPanel.tsx');

  assert.match(
    source,
    /ref=\{createInputRef\}[\s\S]*?onKeyDown=\{\(event\) => \{\s+if \(event\.nativeEvent\.isComposing === true\) return;/u,
  );
  assert.match(
    source,
    /data-dsh-project-rename=''[\s\S]*?onKeyDown=\{\(event\) => \{\s+if \(event\.nativeEvent\.isComposing === true\) return;/u,
  );
});

test('Terminal rename ignores keys while composing', async () => {
  const source = await read('src/client/components/terminal/TerminalPanel.tsx');

  assert.match(
    source,
    /renaming !== null && renaming\.id === terminal\.id[\s\S]*?onKeyDown=\{\(event\) => \{\s+if \(event\.nativeEvent\.isComposing === true\) return;/u,
  );
});

test('Commit palettes and prompts ignore keys while composing', async () => {
  const revision = await read('src/client/components/commit/RevisionPicker.tsx');
  const move = await read('src/client/components/commit/MoveToPicker.tsx');
  const name = await read('src/client/components/commit/NamePrompt.tsx');

  for (const source of [revision, move, name]) {
    assert.match(
      source,
      /autoFocus=\{true\}[\s\S]*?onKeyDown=\{\(event\) => \{\s+if \(event\.nativeEvent\.isComposing === true\) return;/u,
    );
  }
});

test('Find Scope and Go to Line ignore Escape while composing', async () => {
  const scopes = await read('src/client/components/search/FindScopeEditor.tsx');
  const goto = await read('src/client/components/editor/EditorGotoLinePopup.tsx');

  assert.match(
    scopes,
    /data-dsh-find-scope-editor=''[\s\S]*?onKeyDown=\{\(event\) => \{\s+if \(event\.nativeEvent\.isComposing === true\) return;/u,
  );
  assert.match(
    goto,
    /autoFocus=\{true\}[\s\S]*?onKeyDown=\{\(event\) => \{\s+if \(event\.nativeEvent\.isComposing === true\) return;/u,
  );
});
