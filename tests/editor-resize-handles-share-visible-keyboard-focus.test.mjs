import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../src/client/injected-css.ts', import.meta.url), 'utf8');

test('side and bottom dock resizers share a visible keyboard focus ring', () => {
  assert.match(
    source,
    /'\[data-dsh-editor-tool-window-resizer\]:focus-visible,',\s+'\[data-dsh-dock-resize-handle\]:focus-visible \{'/u,
  );
  assert.match(
    source,
    /data-dsh-dock-resize-handle\]:focus-visible \{'[\s\S]*?outline: 1px solid var\(--dsw-alias-state-business-primary\) !important;/u,
  );
  assert.match(source, /outline-offset: -1px !important;/u);
  assert.match(
    source,
    /@media \(forced-colors: active\) \{[\s\S]*?'  \[data-dsh-editor-tool-window-resizer\]:focus-visible,'[\s\S]*?'  \[data-dsh-dock-resize-handle\]:focus-visible \{ outline-color: Highlight !important; \}'/u,
  );
});
