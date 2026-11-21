import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadTypeScriptModule } from './ts-source.mjs';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');
const model = await read('src/client/components/editor/editor-language-model.ts');

function loadLanguageFor() {
  return loadTypeScriptModule(model, ['LANGUAGE_BY_FILENAME', 'LANGUAGE_BY_EXTENSION', 'languageFor']).languageFor;
}

test('editor language model resolves case-insensitive names and extensions', () => {
  const languageFor = loadLanguageFor();

  assert.equal(languageFor('src/app.MJS'), 'javascript');
  assert.equal(languageFor('config.YML'), 'yaml');
  assert.equal(languageFor('Cargo.lock'), 'yaml');
  assert.equal(languageFor('DENO.LOCK'), 'json');
  assert.equal(languageFor('Dockerfile.dev'), 'dockerfile');
  assert.equal(languageFor('Containerfile'), 'dockerfile');
  assert.equal(languageFor('.env.local'), 'ini');
  assert.equal(languageFor('.editorconfig'), 'ini');
  assert.equal(languageFor('page.mdx'), 'mdx');
  assert.equal(languageFor('main.c'), 'c');
  assert.equal(languageFor('MAIN.H'), 'cpp');
  assert.equal(languageFor('app.cpp'), 'cpp');
  assert.equal(languageFor('widget.HPP'), 'cpp');
});

test('editor language model keeps plaintext fallbacks', () => {
  const languageFor = loadLanguageFor();

  assert.equal(languageFor('README'), 'plaintext');
  assert.equal(languageFor('archive.unknown'), 'plaintext');
  assert.equal(languageFor(null), 'plaintext');
});
