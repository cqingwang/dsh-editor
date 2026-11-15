import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const host = readFileSync(join(root, 'lib/index.js'), 'utf8');
const client = readFileSync(join(root, 'lib/client.js'), 'utf8');

function apiBody(path) {
  const start = host.indexOf(`path: '${path}'`);
  assert.notEqual(start, -1, `missing route ${path}`);
  const end = host.indexOf('ctx.effect(', start + 1);
  return host.slice(start, end < 0 ? host.length : end);
}

test('workspace services are resolved after startup, not cached as null', () => {
  assert.doesNotMatch(host, /const workspaceRegistry = serviceOf\('workspaceRegistry'\)/);
  assert.match(host, /(?:function workspaceRegistryNow\(\)|const workspaceRegistryNow = \(\) =>)/);
  assert.match(host, /for \(const owner of \[scope, ctx\]\)/);
});

test('FS, Git and watch resolve the workspace registry for every request', () => {
  for (const path of ['/api/dsh-editor/fs', '/api/dsh-editor/git', '/api/dsh-editor/watch']) {
    const body = apiBody(path);
    assert.match(body, /workspaceRegistry: workspaceRegistryNow\(\)/, `${path} must resolve the registry lazily`);
  }
});

test('the diff toolbar overflows secondary actions before file navigation is clipped', () => {
  const diff = client.slice(client.indexOf('function DiffPreview('), client.indexOf('* Commit tool window: grouped'));
  assert.match(diff, /diffDirectActionCountForWidth\(width, fixedWidth, diffToolbarActions\)/);
  assert.match(diff, /data-dsh-diff-fixed/);
  assert.match(diff, /diffActionsCompact\s*\?\s*React\.createElement\(ToolbarButton, \{[\s\S]*?label: t\('editor\.moreActions'\)/);
  assert.match(diff, /filePosition === null && navigationPosition === null\s*\?\s*null\s*:\s*fileNavMode === 'hidden'/);
  assert.match(diff, /className: 'dsh-editor-file-nav'/);
});
