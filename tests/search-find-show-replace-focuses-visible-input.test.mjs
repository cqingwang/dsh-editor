import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const component = await readFile(
  new URL('../src/client/components/search/FindToolWindow.tsx', import.meta.url),
  'utf8',
);

test('Show Replace in the dock reveals and focuses the replacement field', () => {
  const toggleStart = component.indexOf("id: 'replaceMode'");
  const toggle = component.slice(toggleStart, component.indexOf("id: 'newLine'", toggleStart));
  assert.ok(toggleStart >= 0);
  assert.match(
    toggle,
    /onClick: \(\) => \{\s+if \(replaceExpanded\) setReplaceExpanded\(false\);\s+else focusReplaceInput\(\);\s+\}/u,
  );
});
