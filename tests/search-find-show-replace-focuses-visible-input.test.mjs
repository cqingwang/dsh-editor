import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const component = await readFile(
  new URL('../src/client/components/search/FindToolWindow.tsx', import.meta.url),
  'utf8',
);

test('Show Replace in the dock reveals and focuses the replacement field', () => {
  const toggle = component.slice(
    component.indexOf("label={replaceExpanded ? t('editor.findToolHideReplace') : t('editor.findToolShowReplace')}"),
    component.indexOf(
      '</ToolbarButton>',
      component.indexOf("label={replaceExpanded ? t('editor.findToolHideReplace')"),
    ),
  );
  assert.match(
    toggle,
    /onClick=\{\(\) => \{\s+if \(replaceExpanded\) \{\s+setReplaceExpanded\(false\);\s+return;\s+\}\s+focusReplaceInput\(\);/u,
  );
  assert.doesNotMatch(toggle, /setReplaceExpanded\(\(current\) => !current\)/u);
});
