import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadTypeScriptFunction } from './ts-source.mjs';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');
const model = await read('src/client/components/editor/editor-navigation-model.ts');

test('Go to Line model parses safe line and optional column values', () => {
  const parse = loadTypeScriptFunction(model, 'parseGotoLinePosition');

  assert.deepEqual(parse('12'), { line: 12, column: 1 });
  assert.deepEqual(parse(' 12:7 '), { line: 12, column: 7 });
  assert.deepEqual(parse('12, 7'), { line: 12, column: 7 });
  assert.equal(parse(''), null);
  assert.equal(parse('0:1'), null);
  assert.equal(parse('12:0'), null);
  assert.equal(parse('line:7'), null);
  assert.equal(parse('12:7:2'), null);
});

test('Go to Line shortcut rejects modified and composing input', () => {
  const matches = loadTypeScriptFunction(model, 'gotoLineShortcutMatches');
  const event = (overrides = {}) => ({
    key: 'l',
    metaKey: false,
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
    isComposing: false,
    ...overrides,
  });

  assert.equal(matches(event({ metaKey: true })), true);
  assert.equal(matches(event({ ctrlKey: true })), true);
  assert.equal(matches(event()), false);
  assert.equal(matches(event({ metaKey: true, shiftKey: true })), false);
  assert.equal(matches(event({ metaKey: true, altKey: true })), false);
  assert.equal(matches(event({ metaKey: true, isComposing: true })), false);
});
