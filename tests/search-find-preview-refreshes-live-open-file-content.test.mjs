import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadTypeScriptFunction } from './ts-source.mjs';

const findTool = await readFile(new URL('../src/client/find-tool.ts', import.meta.url), 'utf8');
const panel = await readFile(
  new URL('../src/client/components/search/FindToolWindow.tsx', import.meta.url),
  'utf8',
);
const workspace = await readFile(new URL('../src/client/editor-workspace.tsx', import.meta.url), 'utf8');

test('Find preview resolves the latest dirty open-file content', () => {
  const livePreviewContent = loadTypeScriptFunction(
    findTool.slice(findTool.indexOf('export function findToolLivePreviewContent(')),
    'findToolLivePreviewContent',
  );
  assert.equal(
    livePreviewContent('src/a.ts', [{ path: 'src/a.ts', dirty: true, content: 'first needle' }]),
    'first needle',
  );
  assert.equal(
    livePreviewContent('src/a.ts', [{ path: 'src/a.ts', dirty: true, content: 'updated needle' }]),
    'updated needle',
  );
  assert.equal(livePreviewContent('src/a.ts', [{ path: 'src/a.ts', dirty: false, content: 'saved' }]), null);
  assert.equal(livePreviewContent('src/a.ts', [{ path: 'src/b.ts', dirty: true, content: 'other' }]), null);
});

test('Find preview reacts to live open-file content and disk metadata changes', () => {
  assert.match(
    panel,
    /\[previewOpen, active\?\.rowKey, active\?\.mtime, activeLivePreviewContent, state\.loading, t\]/u,
  );
  assert.match(panel, /findToolLivePreviewContent\(active\?\.path, openFiles\)/u);
  assert.doesNotMatch(panel, /openFilesRef/u);
  assert.match(workspace, /openFiles=\{openFiles\}/u);
});
