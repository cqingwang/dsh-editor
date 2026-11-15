import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');

function activityStripe() {
  const start = source.indexOf('function ActivityStripe(');
  const end = source.indexOf('/**\n     * IDEA-style tool-window toolbar', start);
  assert.notEqual(start, -1, 'ActivityStripe should exist');
  assert.notEqual(end, -1, 'ActivityStripe should end before PanelToolbar');
  return source.slice(start, end);
}

test('the activity stripe uses toolbar semantics instead of a tablist without tabs', () => {
  const stripe = activityStripe();
  assert.match(stripe, /role: 'toolbar'/);
  assert.match(stripe, /'aria-orientation': 'vertical'/);
  assert.doesNotMatch(stripe, /role: 'tablist'/);
});

test('the activity stripe accessible name is localized', () => {
  const stripe = activityStripe();
  assert.match(stripe, /'aria-label': t\('editor\.toolWindows'\)/);
  assert.doesNotMatch(stripe, /'aria-label': 'Editor tool windows'/);
  assert.equal(source.split("toolWindows: '工具窗口'").length - 1, 1);
  assert.equal(source.split("toolWindows: 'Tool windows'").length - 1, 1);
});

test('stripe entries remain native pressed buttons after the role correction', () => {
  const item = source.slice(
    source.indexOf('function StripeItem('),
    source.indexOf('/** Left activity stripe:', source.indexOf('function StripeItem(')),
  );
  assert.match(item, /type: 'button'/);
  assert.match(item, /'aria-pressed': active/);
});

test('Project and Commit panel toolbars expose a named toolbar role', () => {
  const toolbar = source.slice(
    source.indexOf('function PanelToolbar('),
    source.indexOf('/** One 24px panel toolbar button. */'),
  );
  assert.match(toolbar, /ariaLabel = null/);
  assert.match(toolbar, /role: 'toolbar'/);
  assert.match(toolbar, /'aria-label': ariaLabel/);
  assert.match(source, /React\.createElement\(PanelToolbar, \{[\s\S]*?ariaLabel: t\('editor\.project'\)/);
  assert.match(source, /React\.createElement\(PanelToolbar, \{[\s\S]*?ariaLabel: t\('editor\.commit'\)/);
});
