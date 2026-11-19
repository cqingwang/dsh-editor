import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadTypeScriptCallback } from './ts-source.mjs';

const panelSource = await readFile(
  new URL('../src/client/components/project/ProjectPanel.tsx', import.meta.url),
  'utf8',
);

test('Project View changes keep an open speed search as the active keyboard surface', () => {
  assert.ok(
    panelSource.indexOf('const closeProjectViewMenu = React.useCallback') >
      panelSource.indexOf('const [searchOpen, setSearchOpen] = React.useState(false);'),
  );
  let closed = false;
  let searchFocused = false;
  let treeFocused = false;
  const closeProjectViewMenu = loadTypeScriptCallback(panelSource, 'closeProjectViewMenu', {
    setViewMenu: (value) => {
      closed = value === null;
    },
    searchOpen: true,
    searchRef: {
      current: {
        focus() {
          searchFocused = true;
        },
      },
    },
    treeRef: {
      current: {
        focus() {
          treeFocused = true;
        },
      },
    },
    window: {
      setTimeout(callback) {
        callback();
      },
    },
  });

  closeProjectViewMenu();
  assert.equal(closed, true);
  assert.equal(searchFocused, true);
  assert.equal(treeFocused, false);
});
