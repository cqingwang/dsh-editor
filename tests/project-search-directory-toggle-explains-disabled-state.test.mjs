import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadTypeScriptModule } from './ts-source.mjs';

const commitSource = await readFile(new URL('../src/client/commit.ts', import.meta.url), 'utf8');
const menuSource = await readFile(new URL('../src/client/components/ui/Menu.tsx', import.meta.url), 'utf8');
const editorSource = await readFile(new URL('../src/client/editor-workspace.tsx', import.meta.url), 'utf8');
const helpers = loadTypeScriptModule(commitSource, ['searchDirectoryToggleDisabledReason']);
const t = (key) => key;

test('search-scope toggle explains why a batch target cannot be changed', () => {
  assert.equal(
    helpers.searchDirectoryToggleDisabledReason(2, t),
    'editor.searchDirectoryToggleBatchDisabled',
  );
  assert.equal(helpers.searchDirectoryToggleDisabledReason(1, t), null);
});

test('the shared menu exposes disabled reasons to tooltip and assistive technology', () => {
  assert.match(menuSource, /disabledReason\?: string/u);
  assert.match(menuSource, /aria-description=\{item\.disabledReason\}/u);
  assert.match(menuSource, /title=\{item\.disabled === true \? item\.disabledReason : undefined\}/u);
  assert.match(editorSource, /disabledReason:\s+searchDirectoryToggleDisabledReason\(/u);
});
