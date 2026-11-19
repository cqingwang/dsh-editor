import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const component = await readFile(
  new URL('../src/client/components/search/FindToolWindow.tsx', import.meta.url),
  'utf8',
);

test('Find popup keeps Tab and Shift+Tab inside its dialog controls', () => {
  assert.match(component, /import \{ trapDialogFocus \} from '\.\.\/ui\/focus-trap';/u);
  assert.match(
    component,
    /const trapFindToolPopupFocus = \(event: React\.KeyboardEvent<HTMLDivElement>\): boolean =>/u,
  );
  assert.match(component, /if \(floating !== true \|\| event\.key !== 'Tab'\) return false;/u);
  assert.match(component, /return trapDialogFocus\(event, root\);/u);
  assert.doesNotMatch(component, /querySelectorAll</u);
  assert.doesNotMatch(component, /searchEverywhereNextFocusIndex\(/u);
  assert.match(component, /if \(floating === true && trapFindToolPopupFocus\(event\)\) return;/u);
});

test('Find dock does not become a modal focus trap', () => {
  const trap = component.slice(
    component.indexOf('const trapFindToolPopupFocus ='),
    component.indexOf('const handleFindToolRootKeyDown ='),
  );
  assert.match(trap, /floating !== true/u);
  assert.doesNotMatch(trap, /data-dsh-find-tool-dock/u);
});
