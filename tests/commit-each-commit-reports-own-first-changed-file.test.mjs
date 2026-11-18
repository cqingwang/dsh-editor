import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { gitShowCommit } from '../lib/index.js';
import { loadTypeScriptCallback, loadTypeScriptModule } from './ts-source.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(root, path), 'utf8');

/** Two commits on different files, so "first changed file" differs per commit. */
async function fixture() {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-editor-r36-'));
  execFileSync('git', ['-C', dir, 'init', '-q', '-b', 'main']);
  execFileSync('git', ['-C', dir, 'config', 'user.email', 'test@example.com']);
  execFileSync('git', ['-C', dir, 'config', 'user.name', 'Test']);
  await writeFile(join(dir, 'alpha.txt'), 'a\n');
  execFileSync('git', ['-C', dir, 'add', '.']);
  execFileSync('git', ['-C', dir, 'commit', '-qm', 'only alpha']);
  const first = execFileSync('git', ['-C', dir, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  await writeFile(join(dir, 'beta.txt'), 'b\n');
  execFileSync('git', ['-C', dir, 'add', '.']);
  execFileSync('git', ['-C', dir, 'commit', '-qm', 'only beta']);
  const second = execFileSync('git', ['-C', dir, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  return { dir, first, second, cleanup: () => rm(dir, { recursive: true, force: true }) };
}

test('each commit reports its own first changed file', async (t) => {
  const { dir, first, second, cleanup } = await fixture();
  t.after(cleanup);
  /* This is what the log menu must key off: the RIGHT-CLICKED commit, not the selected one. */
  assert.deepEqual((await gitShowCommit(dir, first)).files.map((file) => file.path), ['alpha.txt']);
  assert.deepEqual((await gitShowCommit(dir, second)).files.map((file) => file.path), ['beta.txt']);
});

test('the log menu resolves history from the right-clicked commit', async () => {
  const client = read('src/client/editor-workspace.tsx');
  const menu = read('src/client/components/commit/log-menu.ts');
  const requests = [];
  const histories = [];
  const notices = [];
  const showCommitHistory = loadTypeScriptCallback(client, 'showCommitHistory', {
    callGit: async (request) => {
      requests.push(request);
      return { files: [{ path: 'beta.txt' }] };
    },
    showFileHistory: async (path) => histories.push(path),
    t: (key) => key,
    setCommitNotice: (message) => notices.push(message),
    setCommitError: () => {},
  });
  await showCommitHistory('fedcba9876543210');
  assert.deepEqual(requests, [{ op: 'show', hash: 'fedcba9876543210' }]);
  assert.deepEqual(histories, ['beta.txt']);
  assert.deepEqual(notices, []);

  const { commitLogMenu } = loadTypeScriptModule(menu, ['commitLogMenu']);
  const selectedHashes = [];
  const value = commitLogMenu({
    t: (key) => key,
    position: { x: 1, y: 2 },
    commit: { hash: 'fedcba9876543210', subject: 'subject' },
    selectionHashes: [],
    parentTargets: [],
    childTargets: [],
    detached: false,
    onShowCommit: () => {},
    onShowCommitHistory: (hash) => selectedHashes.push(hash),
    onCompareRevisions: () => {},
    onCompareWithLocal: () => {},
    onRunHistoryAction: () => {},
    onCreateTag: () => {},
    onCreateCommitPatch: () => {},
    onCheckoutRevision: () => {},
    onCreateBranch: () => {},
    onResetBranchHere: () => {},
    onCopyText: () => {},
  });
  value.items.find((item) => item?.id === 'history').run();
  assert.deepEqual(selectedHashes, ['fedcba9876543210']);
});

test('the log row tooltip advertises the right-click actions', () => {
  const log = read('src/client/components/commit/CommitLogFlatRow.tsx');
  const locales = read('src/client/locales.ts');
  assert.match(log, /title=\{`\$\{commit\.hash\}\\n\$\{t\('editor\.logRowHint'\)\}`\}/);
  assert.match(locales, /logRowHint: '右键：拣选 \/ 还原 \/ 复制哈希'/);
  assert.match(locales, /logRowHint: 'Right-click: cherry-pick \/ revert \/ copy hash'/);
});
