import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = (readFileSync(join(root, 'src/client/components/diff/DiffPreview.tsx'), 'utf8') + '\n' + readFileSync(join(root, 'lib/client.js'), 'utf8'));

test('DiffPreview only disposes real listeners and models', () => {
  const body = source.slice(source.indexOf('function DiffPreview('), source.indexOf('export { DiffPreview };'));
  assert.match(body, /__dshRestoreListener\.dispose\?\.\(\);/);
  assert.match(body, /__dshFallbackUndo\.dispose\?\.\(\);/);
  assert.match(body, /models\?\.original\?\.dispose\?\.\(\);/);
  assert.match(body, /models\?\.modified\?\.dispose\?\.\(\);/);
  assert.match(body, /previous\?\.original\?\.dispose\?\.\(\);/);
  assert.match(body, /previous\?\.modified\?\.dispose\?\.\(\);/);
});

test('a Commit diff target is reconciled after the watcher refreshes git status', () => {
  const body = source.slice(source.indexOf('const loadGit = React.useCallback'), source.indexOf('const COMMIT_TEMPLATES'));
  assert.match(body, /setDiffTarget\(\(current\) =>/);
  assert.match(body, /current\.path/);
  assert.match(body, /value\?\.changes/);
});

test('the target reconciliation keeps the group side, not only the path', () => {
  const body = source.slice(source.indexOf('const loadGit = React.useCallback'), source.indexOf('const COMMIT_TEMPLATES'));
  assert.match(body, /splitChanges\(value\?\.changes \?\? \[\]\)/);
  assert.match(body, /const group = current\.staged === true \? 'staged' : 'unstaged'/);
  assert.match(body, /listedInChangeBand\(bands, group, current\.path\)/);
});

test('the status signature changes when only the index changes', () => {
  const host = readFileSync(join(root, 'lib/index.js'), 'utf8');
  const signature = host.slice(host.indexOf('async function gitSignature('), host.indexOf('async function parseNumstat('));
  assert.match(signature, /\.git['"], 'index/);
  assert.match(signature, /indexInfo/);
  assert.match(signature, /indexInfo\.mtimeMs/);
  assert.match(signature, /indexInfo\.size/);
});

test('a .git/index watcher turns a stage/reset into a normal change frame', () => {
  const host = readFileSync(join(root, 'lib/index.js'), 'utf8');
  const watcher = host.slice(host.indexOf('class WorkspaceWatcher'), host.indexOf('function workspaceWatchResponse'));
  assert.match(watcher, /watchGitIndex\(\)/);
  assert.match(watcher, /rev-parse', '--git-path', 'index'/);
  assert.match(watcher, /this\.watchImpl\(absolute, \{ persistent: false \}, \(\) => this\.record\('', '\.git\/index'\)\)/);
  assert.match(watcher, /normalized === '\.git' \|\| normalized\.startsWith\('\.git\/'\)/);
  assert.match(watcher, /this\.gitIndexWatcher\?\.close\(\)/);
});
