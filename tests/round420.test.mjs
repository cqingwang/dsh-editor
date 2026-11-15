import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');

function extract(name, endMarker) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} should exist`);
  const end = source.indexOf(endMarker, start);
  assert.notEqual(end, -1, `${name} should end before ${endMarker}`);
  return source.slice(start, end);
}

test('ToolbarButton only exposes pressed semantics for real toggle actions', () => {
  const button = extract('ToolbarButton', 'function selectCompactActions(');
  assert.match(button, /active = undefined/);
  assert.match(button, /className: active === true \? 'dsh-editor-toolbar-button dsh-editor-toolbar-button-active' : 'dsh-editor-toolbar-button'/);
  assert.match(button, /\.\.\.\(active === true \? styles\.toolbarButtonActive : null\)/);
  assert.match(button, /'aria-pressed': typeof active === 'boolean' \? active : undefined/);
});

test('toolbar action state preserves the difference between false and unspecified', () => {
  const helper = extract('toolbarActionActive', '/** One 24px panel toolbar button. */');
  const toolbarActionActive = new Function(`${helper}; return toolbarActionActive;`)();
  assert.equal(toolbarActionActive({ active: true }), true);
  assert.equal(toolbarActionActive({ active: false }), false);
  assert.equal(toolbarActionActive({}), undefined);
  assert.equal(toolbarActionActive({ active: 'yes' }), undefined);
});

test('direct toolbar actions do not turn non-toggle commands into unpressed toggles', () => {
  const panel = extract('PanelToolbar', '/** One 24px panel toolbar button. */');
  const compact = extract('CompactActionBar', '/** Project tool window: toolbar');
  const diff = extract('DiffPreview', '* Commit tool window: grouped');
  for (const component of [panel, compact, diff]) {
    assert.match(component, /active: toolbarActionActive\(action\)/);
    assert.doesNotMatch(component, /active: action\.active === true/);
  }
});
