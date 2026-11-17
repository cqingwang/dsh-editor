import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');

function extractObject(name) {
  const marker = `    const ${name} = {`;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `${name} should exist`);
  let index = source.indexOf('{', start);
  let depth = 0;
  for (; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    else if (source[index] === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  assert.fail(`unterminated ${name}`);
}

function extractFunction(name) {
  const marker = `    function ${name}(`;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `${name} should exist`);
  let index = source.indexOf('{', start);
  let depth = 0;
  for (; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    else if (source[index] === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  assert.fail(`unterminated ${name}`);
}

const languageFor = new Function(
  `${extractObject('LANGUAGE_BY_FILENAME')}\n`
  + `${extractObject('LANGUAGE_BY_EXTENSION')}\n`
  + `${extractFunction('basename')}\n`
  + `${extractFunction('languageFor')}\n`
  + 'return languageFor;',
)();

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
