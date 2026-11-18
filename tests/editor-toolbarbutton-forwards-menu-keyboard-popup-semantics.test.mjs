import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { compactActionBarSource, panelToolbarSource } from './ui-sources.mjs';

const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');
const buttonSource = await readFile(new URL('../src/client/components/ui/ToolbarButton.tsx', import.meta.url), 'utf8');

test('ToolbarButton forwards menu keyboard and popup semantics', () => {
  assert.match(buttonSource, /onKeyDown = null/);
  assert.match(buttonSource, /onContextMenu = null/);
  assert.match(buttonSource, /ariaHasPopup = undefined/);
  assert.match(buttonSource, /ariaExpanded = undefined/);
  assert.match(buttonSource, /aria-haspopup=\{ariaHasPopup\}/);
  assert.match(buttonSource, /aria-expanded=\{ariaExpanded\}/);
  assert.match(buttonSource, /onKeyDown=\{onKeyDown\}/);
  assert.match(buttonSource, /onContextMenu=\{onContextMenu\}/);
});

test('Project and Changes overflow buttons open their custom menu from the keyboard', () => {
  for (const component of [panelToolbarSource, compactActionBarSource]) {
    assert.match(component, /const openOverflowMenu = \(rect(?:\s*:\s*[^)]+)?\) => \{/);
    assert.match(component, /event\.key === 'ContextMenu' \|\| \(event\.shiftKey === true && event\.key === 'F10'\)/);
    assert.match(component, /onContextMenu=\{\(event\) => \{/);
    assert.match(component, /ariaHasPopup='menu'/);
    assert.match(component, /ariaExpanded=\{(?:menu|menuPosition) !== null\}/);
  }
});

test('overflow opener clicks and menu keys all reuse the same builder', () => {
  const panel = panelToolbarSource;
  assert.match(panel, /onClick=\{\(event\) => \{\s+openOverflowMenu\(event\.currentTarget\.getBoundingClientRect\(\)\);/s);
  const builders = (panel.match(/openOverflowMenu\(event\.currentTarget\.getBoundingClientRect\(\)\)/g) ?? []).length;
  assert.ok(builders >= 3, `click, Shift+F10 and ContextMenu must reuse the builder; found ${builders}`);
});
