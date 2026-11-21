import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('Prettier requires hierarchical, multiline JSX attributes', async () => {
  const config = JSON.parse(await read('.prettierrc.json'));
  assert.equal(config.singleAttributePerLine, true);
  assert.equal(config.jsxSingleQuote, true);
  assert.equal(config.singleQuote, true);
  assert.equal(config.printWidth, 120);
  const packageJson = JSON.parse(await read('package.json'));
  assert.match(packageJson.scripts['format:client-components'], /prettier --write/u);
  assert.match(packageJson.scripts['check:format:client-components'], /prettier --check/u);
});

test('reusable UI components are imported TSX modules', async () => {
  const files = [
    'src/client/components/ui/ActivityStripe.tsx',
    'src/client/components/ui/CompactActionBar.tsx',
    'src/client/components/ui/DiffViewModeControl.tsx',
    'src/client/components/ui/Icon.tsx',
    'src/client/components/ui/PanelToolbar.tsx',
    'src/client/components/ui/ToolbarButton.tsx',
  ];
  for (const file of files) {
    const source = await read(file);
    assert.doesNotMatch(source, /React\.createElement/u, `${file} should use JSX`);
    assert.match(source, /import React from 'react'/u, `${file} should import React`);
  }
  const panelToolbar = await read('src/client/components/ui/PanelToolbar.tsx');
  assert.match(panelToolbar, /<ToolbarButton\s+key=\{action\.id\}/u);
  assert.match(panelToolbar, /<ContextMenu\s+menu=\{menu\}/u);
  assert.match(
    await read('src/client/components/ui/index.tsx'),
    /export \{ PanelToolbar \} from '\.\/PanelToolbar\.tsx'/u,
  );
});

test('esbuild compiles the TSX module graph into the deployed client', async () => {
  const build = await read('scripts/build-client.mjs');
  assert.match(build, /import \{ build \} from 'esbuild'/u);
  assert.match(build, /const separateBundleEntryModule = 'components\/ui\/index\.tsx'/u);
  assert.match(build, /entryPoints: \[separateBundleEntryPath\]/u);
  assert.match(build, /format: 'cjs'/u);
  assert.match(build, /external: \['react'/u);
  assert.match(build, /const __dshUiModule = \(\(\) => \{/u);
});
