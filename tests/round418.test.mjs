import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');

test('ToolbarButton forwards menu keyboard and popup semantics', () => {
  const button = source.slice(
    source.indexOf('function ToolbarButton('),
    source.indexOf('function selectCompactActions(', source.indexOf('function ToolbarButton(')),
  );
  assert.match(button, /onKeyDown = null/);
  assert.match(button, /onContextMenu = null/);
  assert.match(button, /ariaHasPopup = undefined/);
  assert.match(button, /ariaExpanded = undefined/);
  assert.match(button, /'aria-haspopup': ariaHasPopup/);
  assert.match(button, /'aria-expanded': ariaExpanded/);
  assert.match(button, /onKeyDown,/);
  assert.match(button, /onContextMenu,/);
});

test('Project and Changes overflow buttons open their custom menu from the keyboard', () => {
  for (const name of ['PanelToolbar', 'CompactActionBar']) {
    const component = source.slice(
      source.indexOf(`function ${name}(`),
      source.indexOf('\n    /**', source.indexOf(`function ${name}(`)),
    );
    assert.match(component, /const openOverflowMenu = \(rect\) => \{/);
    assert.match(component, /event\.key === 'ContextMenu' \|\| \(event\.shiftKey === true && event\.key === 'F10'\)/);
    assert.match(component, /onContextMenu: \(event\) => \{/);
    assert.match(component, /ariaHasPopup: 'menu'/);
    assert.match(component, /ariaExpanded: (?:menu|menuPosition) !== null/);
  }
});

test('overflow opener clicks and menu keys all reuse the same builder', () => {
  const panel = source.slice(
    source.indexOf('function PanelToolbar('),
    source.indexOf('/** One 24px panel toolbar button. */'),
  );
  assert.match(panel, /onClick: \(event\) => \{\s+openOverflowMenu\(event\.currentTarget\.getBoundingClientRect\(\)\);/s);
  const builders = (panel.match(/openOverflowMenu\(event\.currentTarget\.getBoundingClientRect\(\)\)/g) ?? []).length;
  assert.ok(builders >= 3, `click, Shift+F10 and ContextMenu must reuse the builder; found ${builders}`);
});
