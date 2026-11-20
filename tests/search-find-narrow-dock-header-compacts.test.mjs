import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const component = await readFile(
  new URL('../src/client/components/search/FindToolWindow.tsx', import.meta.url),
  'utf8',
);
const injectedCss = await readFile(new URL('../src/client/injected-css.ts', import.meta.url), 'utf8');
const actionBar = await readFile(new URL('../src/client/components/ui/CompactActionBar.tsx', import.meta.url), 'utf8');

test('narrow Find dock compacts duplicate title, mask and header actions', () => {
  assert.match(component, /className='dsh-editor-find-controls'/u);
  assert.match(component, /className='dsh-editor-find-tool-title'/u);
  assert.match(component, /className='dsh-editor-find-tool-count'/u);
  assert.match(component, /className='dsh-editor-find-tool-spacer'/u);
  assert.match(component, /className='dsh-editor-find-file-mask-control'/u);
  assert.match(component, /className='dsh-editor-find-file-mask-label'/u);
  assert.match(component, /className='dsh-editor-find-file-mask-input'/u);
  assert.match(component, /className='dsh-editor-find-scope-mode-group'/u);
  assert.match(
    component,
    /type='checkbox'\s+checked=\{fileMaskEnabled\}\s+aria-label=\{t\('editor\.searchFileMaskLabel'\)\}\s+title=\{t\('editor\.searchFileMaskLabel'\)\}/u,
  );
  assert.match(component, /className=\{floating \? undefined : 'dsh-editor-find-dock-header-actions'\}/u);
  assert.match(actionBar, /className\?: string;/u);
  assert.match(actionBar, /className=\{className \?\? undefined\}/u);
});

test('the compact rules are container-scoped to the narrow dock', () => {
  assert.match(
    injectedCss,
    /\.dsh-editor-find-controls\[data-dsh-find-controls\] \{ container: dsh-find-dock \/ inline-size; \}/u,
  );
  assert.match(injectedCss, /@container dsh-find-dock \(max-width: 360px\)/u);
  assert.match(
    injectedCss,
    /\.dsh-editor-find-tool-title,\s+\.dsh-editor-find-tool-count,\s+\.dsh-editor-find-tool-spacer,\s+\.dsh-editor-find-file-mask-label \{ display: none !important; \}/u,
  );
  assert.match(
    injectedCss,
    /\.dsh-editor-find-file-mask-input \{ width: 56px !important; min-width: 56px !important; \}/u,
  );
  assert.match(
    injectedCss,
    /\.dsh-editor-find-dock-header-actions \{ flex-basis: 88px !important; width: 88px !important; min-width: 88px !important; \}/u,
  );
  assert.match(injectedCss, /@container dsh-find-dock \(max-width: 220px\)/u);
  assert.match(injectedCss, /\.dsh-editor-find-file-mask-control \{ display: none !important; \}/u);
  assert.match(
    injectedCss,
    /\.dsh-editor-find-controls\[data-dsh-find-controls\] > div > svg:first-child \{ display: none !important; \}/u,
  );
  assert.match(
    injectedCss,
    /\.dsh-editor-find-dock-header-actions \{ flex-basis: 52px !important; width: 52px !important; min-width: 52px !important; \}/u,
  );
  assert.match(
    injectedCss,
    /\.dsh-editor-find-scope-mode-group \{[\s\S]*?flex: 1 1 auto !important;[\s\S]*?min-width: 0 !important;[\s\S]*?flex-wrap: wrap !important;/u,
  );
});
