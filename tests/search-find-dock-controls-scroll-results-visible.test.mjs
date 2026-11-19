import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const component = await readFile(
  new URL('../src/client/components/search/FindToolWindow.tsx', import.meta.url),
  'utf8',
);
const styles = await readFile(new URL('../src/client/ui/styles.ts', import.meta.url), 'utf8');
const inlineStyles = await readFile(new URL('../src/client/inline-styles.ts', import.meta.url), 'utf8');

test('Find dock controls scroll before they can collapse the result list', () => {
  assert.match(component, /data-dsh-find-controls=\{floating \? undefined : ''\}/u);
  assert.match(component, /style=\{floating \? styles\.findToolPopupControls : styles\.findToolDockControls\}/u);
  const controlsStart = component.indexOf("data-dsh-find-controls={floating ? undefined : ''}");
  const resultsStart = component.indexOf("data-dsh-find-results-layout={floating ? 'stack' : 'split'}");
  assert.ok(controlsStart >= 0 && resultsStart > controlsStart);
  const controls = component.slice(controlsStart, resultsStart);
  assert.match(controls, /data-dsh-find-popup-drag/u);
  assert.match(controls, /data-dsh-find-scope=''/u);
});

test('The dock reserves a visible result viewport while controls overflow vertically', () => {
  for (const source of [styles, inlineStyles]) {
    assert.match(
      source,
      /findToolDockControls: \{\s+display: 'flex',\s+flexDirection: 'column',\s+flex: '0 0 auto',\s+minWidth: 0,\s+minHeight: 0,\s+maxHeight: 'calc\(100% - 150px\)',\s+overflow: 'auto',/u,
    );
    assert.match(
      source,
      /findToolDockSplit: \{\s+display: 'flex',\s+flex: '1 1 auto',\s+minWidth: 0,\s+minHeight: 96,/u,
    );
  }
});
