import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadTypeScriptModule } from './ts-source.mjs';

const languageModel = await readFile(
  new URL('../src/client/components/editor/editor-language-model.ts', import.meta.url),
  'utf8',
);

const { languageFor } = loadTypeScriptModule(languageModel, [
  'LANGUAGE_BY_FILENAME',
  'LANGUAGE_BY_EXTENSION',
  'languageFor',
]);

test('Known lockfiles and case-insensitive extensions map to Monaco languages', () => {
  assert.equal(languageFor('src/app.MJS'), 'javascript');
  assert.equal(languageFor('config.YML'), 'yaml');
  assert.equal(languageFor('Cargo.lock'), 'yaml');
  assert.equal(languageFor('CARGO.LOCK'), 'yaml');
  assert.equal(languageFor('deno.lock'), 'json');
  assert.equal(languageFor('DENO.LOCK'), 'json');
});

test('Common filenames and specialized formats resolve to supported language ids', () => {
  assert.equal(languageFor('Dockerfile.dev'), 'dockerfile');
  assert.equal(languageFor('Containerfile'), 'dockerfile');
  assert.equal(languageFor('Gemfile'), 'ruby');
  assert.equal(languageFor('go.mod'), 'go');
  assert.equal(languageFor('schema.graphql'), 'graphql');
  assert.equal(languageFor('service.proto'), 'protobuf');
  assert.equal(languageFor('main.tf'), 'hcl');
  assert.equal(languageFor('contract.sol'), 'solidity');
  assert.equal(languageFor('README.rst'), 'restructuredtext');
  assert.equal(languageFor('page.mdx'), 'mdx');
  assert.equal(languageFor('script.bat'), 'bat');
  assert.equal(languageFor('data.json5'), 'json');
  assert.equal(languageFor('.editorconfig'), 'ini');
  assert.equal(languageFor('.eslintrc'), 'json');
});

test('Unknown files still fall back to plaintext', () => {
  assert.equal(languageFor('README'), 'plaintext');
  assert.equal(languageFor('archive.unknown'), 'plaintext');
});
