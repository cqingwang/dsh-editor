import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadTypeScriptFunction } from './ts-source.mjs';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');
const model = await read('src/client/components/editor/editor-file-template-model.ts');

test('editor file template model keeps language-specific skeletons', () => {
  const templateFor = loadTypeScriptFunction(model, 'templateFor');

  assert.equal(templateFor('a.ts'), 'export {};\n');
  assert.equal(templateFor('a.tsx'), 'export {};\n');
  assert.equal(templateFor('a.js'), "'use strict';\n");
  assert.equal(templateFor('a.py'), '"""a."""\n');
  assert.equal(templateFor('a.md'), '# a\n');
  assert.equal(templateFor('a.json'), '{}\n');
  assert.equal(templateFor('a.go'), 'package main\n');
  assert.equal(templateFor('a.sh'), '#!/usr/bin/env bash\nset -euo pipefail\n');
  assert.match(templateFor('index.html'), /^<!doctype html>/);
});

test('editor file template model keeps unknown and dotless names blank', () => {
  const templateFor = loadTypeScriptFunction(model, 'templateFor');

  assert.equal(templateFor('README.MD'), '# README\n');
  assert.equal(templateFor('notes.txt'), '');
  assert.equal(templateFor('Makefile'), '');
  assert.equal(templateFor(''), '');
  assert.equal(templateFor('.env'), '');
  assert.equal(templateFor('trailing.'), '');
});
