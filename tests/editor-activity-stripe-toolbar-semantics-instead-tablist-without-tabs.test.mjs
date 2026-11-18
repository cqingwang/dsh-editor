import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { panelToolbarSource } from './ui-sources.mjs';

const source = (await readFile(new URL('./fixtures/project-panel.legacy.js', import.meta.url), 'utf8') + '\n' + await readFile(new URL('../lib/client.js', import.meta.url), 'utf8'));
const stripeSource = await readFile(new URL('../src/client/components/ui/ActivityStripe.tsx', import.meta.url), 'utf8');

test('the activity stripe uses toolbar semantics instead of a tablist without tabs', () => {
  assert.match(stripeSource, /role='toolbar'/);
  assert.match(stripeSource, /aria-orientation='vertical'/);
  assert.doesNotMatch(stripeSource, /role='tablist'/);
});

test('the activity stripe accessible name is localized', () => {
  assert.match(stripeSource, /aria-label=\{t\('editor\.toolWindows'\)\}/);
  assert.doesNotMatch(stripeSource, /aria-label='Editor tool windows'/);
  assert.equal(source.split("toolWindows: '工具窗口'").length - 1, 1);
  assert.equal(source.split("toolWindows: 'Tool windows'").length - 1, 1);
});

test('stripe entries remain native pressed buttons after the role correction', () => {
  assert.match(stripeSource, /type='button'/);
  assert.match(stripeSource, /aria-pressed=\{active\}/);
});

test('Project and Commit panel toolbars expose a named toolbar role', () => {
  const toolbar = panelToolbarSource;
  assert.match(toolbar, /ariaLabel = null/);
  assert.match(toolbar, /role='toolbar'/);
  assert.match(toolbar, /aria-label=\{ariaLabel\}/);
  assert.match(source, /React\.createElement\(PanelToolbar, \{[\s\S]*?ariaLabel: t\('editor\.project'\)/);
  assert.match(source, /React\.createElement\(PanelToolbar, \{[\s\S]*?ariaLabel: t\('editor\.commit'\)/);
});
