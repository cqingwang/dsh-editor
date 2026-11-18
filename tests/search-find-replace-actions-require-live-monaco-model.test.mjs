import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = (await readFile(new URL('../src/client/components/search/SearchEverywhere.tsx', import.meta.url), 'utf8') + '\n' + await readFile(new URL('../lib/client.js', import.meta.url), 'utf8'));
const actionsStart = source.indexOf('const activeSourceEditor =');
const actionsEnd = source.indexOf('/* Recompute match count', actionsStart);
const actions = source.slice(actionsStart, actionsEnd);

test('Find and Replace actions require a live Monaco model', () => {
  assert.match(actions, /const activeSourceEditor = currentCodeEditor\(\);/);
  assert.match(actions, /const editorModel = activeSourceEditor\?\.getModel\?\.\(\) \?\? null/);
  assert.match(actions, /const hasEditorModel = editorModel !== null/);
  const find = actions.slice(actions.indexOf("id: 'find'"), actions.indexOf("id: 'replace'"));
  const replace = actions.slice(actions.indexOf("id: 'replace'"), actions.indexOf("id: 'findUsages'"));
  assert.match(find, /disabled: !hasEditorModel/);
  assert.match(find, /disabledReason: t\('editor\.findEditorRequired'\)/);
  assert.match(replace, /disabled: !hasEditorModel/);
  assert.match(replace, /disabledReason: t\('editor\.findEditorRequired'\)/);
});

test('Find in Files remains available without an editor model', () => {
  const findInFiles = actions.slice(actions.indexOf("id: 'findInFiles'"), actions.indexOf("id: 'replaceInFiles'"));
  assert.doesNotMatch(findInFiles, /hasEditorModel/);
});

test('the action memo refreshes when editor availability changes', () => {
  assert.match(actions, /hasEditorModel,\n\s+closeSearchEverywhere/);
});
