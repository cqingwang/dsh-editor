import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');

test('toolbar overflow items retain their keyboard shortcut metadata', () => {
  const panel = source.slice(source.indexOf('function PanelToolbar('), source.indexOf('/** One 24px panel toolbar button. */'));
  assert.match(panel, /run: \(\) => action\.onClick\(\),\s+ariaKeyShortcuts: action\.ariaKeyShortcuts,/);

  const compact = source.slice(source.indexOf('function CompactActionBar('), source.indexOf('/** Project tool window:'));
  assert.match(compact, /run: \(\) => action\.onClick\(\),\s+ariaKeyShortcuts: action\.ariaKeyShortcuts,/);
  assert.match(compact, /onClick: action\.onClick,\s+ariaKeyShortcuts: action\.ariaKeyShortcuts,/);
});

test('ContextMenu exposes aria-keyshortcuts on top-level and submenu actions', () => {
  const menu = source.slice(
    source.indexOf('function ContextMenu({ menu, onClose, t })'),
    source.indexOf('function groupDiffToolbarActions('),
  );
  assert.equal(menu.match(/'aria-keyshortcuts': item\.ariaKeyShortcuts,/g)?.length, 1);
  assert.equal(menu.match(/'aria-keyshortcuts': child\.ariaKeyShortcuts,/g)?.length, 1);
});
