import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { compactActionBarSource, panelToolbarSource } from './ui-sources.mjs';

const source = (await readFile(new URL('./fixtures/diff-preview.legacy.js', import.meta.url), 'utf8')) + '\n' + (await readFile(new URL('../lib/client.js', import.meta.url), 'utf8'));
const buttonSource = await readFile(new URL('../src/client/components/ui/ToolbarButton.tsx', import.meta.url), 'utf8');

function extract(name, endMarker) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} should exist`);
  const end = source.indexOf(endMarker, start);
  assert.notEqual(end, -1, `${name} should end before ${endMarker}`);
  return source.slice(start, end);
}

test('ToolbarButton only exposes pressed semantics for real toggle actions', () => {
  assert.match(buttonSource, /active = undefined/);
  assert.match(buttonSource, /className=\{/);
  assert.match(buttonSource, /styles\.toolbarButtonActive/);
  assert.match(buttonSource, /aria-pressed=\{typeof active === 'boolean' \? active : undefined\}/);
});

test('toolbar action state preserves the difference between false and unspecified', () => {
  const start = source.indexOf('function toolbarActionActive(');
  assert.notEqual(start, -1, 'toolbarActionActive should exist');
  let index = source.indexOf('{', start);
  let depth = 0;
  for (; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    else if (source[index] === '}') {
      depth -= 1;
      if (depth === 0) break;
    }
  }
  const toolbarActionActive = new Function(`${source.slice(start, index + 1)}; return toolbarActionActive;`)();
  assert.equal(toolbarActionActive({ active: true }), true);
  assert.equal(toolbarActionActive({ active: false }), false);
  assert.equal(toolbarActionActive({}), undefined);
  assert.equal(toolbarActionActive({ active: 'yes' }), undefined);
});

test('direct toolbar actions do not turn non-toggle commands into unpressed toggles', () => {
  const panel = panelToolbarSource;
  const compact = compactActionBarSource;
  const diff = extract('DiffPreview', '* Commit tool window: grouped');
  for (const component of [panel, compact]) {
    assert.match(component, /active=\{toolbarActionActive\(action\)\}/);
    assert.doesNotMatch(component, /active: action\.active === true/);
  }
  assert.match(diff, /active: toolbarActionActive\(action\)/);
  assert.doesNotMatch(diff, /active: action\.active === true/);
});
