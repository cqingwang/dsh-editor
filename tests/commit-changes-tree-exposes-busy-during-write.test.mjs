import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const component = await readFile(new URL('../src/client/components/commit/CommitPanel.tsx', import.meta.url), 'utf8');

test('Changes tree exposes commit/write busy state without hiding rows', () => {
  assert.match(component, /aria-busy=\{busy \? 'true' : undefined\}/u);
  assert.match(component, /role='tree'[\s\S]*?aria-busy=\{busy \? 'true' : undefined\}[\s\S]*?data-dsh-changes-list=/u);
  assert.doesNotMatch(component, /busy \? \[\] : visibleGroups/u);
});
