import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { loadTypeScriptCallback, loadTypeScriptModule } from './ts-source.mjs';

import { fileCompareText } from '../lib/index.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(root, path), 'utf8');

/** One workspace file to compare against supplied text. */
async function fixture() {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-editor-r23-'));
  await writeFile(join(dir, 'a.txt'), 'file content\n');
  return { dir, cleanup: () => rm(dir, { recursive: true, force: true }) };
}

test('compareText puts the clipboard on the left and the file on the right', async (t) => {
  const { dir, cleanup } = await fixture();
  t.after(cleanup);
  const value = await fileCompareText(dir, { path: 'a.txt', text: 'clipboard content\n' });
  /* IDEA shows "clipboard → file", so the clipboard must be the original side. */
  assert.equal(value.original, 'clipboard content\n');
  assert.equal(value.modified, 'file content\n');
  assert.equal(value.label, 'clipboard');
  assert.equal(value.binary, false);
  assert.equal(value.missing, false);
});

test('compareText refuses to run without text or outside the workspace', async (t) => {
  const { dir, cleanup } = await fixture();
  t.after(cleanup);
  await assert.rejects(() => fileCompareText(dir, { path: 'a.txt' }), /missing comparison text/);
  await assert.rejects(() => fileCompareText(dir, { path: '../etc/passwd', text: 'x' }), /escapes the workspace/);
  await assert.rejects(() => fileCompareText(dir, { path: '', text: 'x' }), /a path is required/);
});

test('compareText reports a missing file instead of inventing content', async (t) => {
  const { dir, cleanup } = await fixture();
  t.after(cleanup);
  const value = await fileCompareText(dir, { path: 'nope.txt', text: 'x\n' });
  assert.equal(value.missing, true);
  assert.equal(value.modified, '');
});

test('compareText flags a binary clipboard as binary', async (t) => {
  const { dir, cleanup } = await fixture();
  t.after(cleanup);
  const value = await fileCompareText(dir, { path: 'a.txt', text: 'x\u0000y' });
  assert.equal(value.binary, true);
});

test('the tree offers clipboard compare and directory staging', () => {
  const client = read('src/client/editor-workspace.tsx');
  const { searchDirectoryToggleDisabledReason } = loadTypeScriptModule(
    read('src/client/commit.ts'),
    ['searchDirectoryToggleDisabledReason'],
  );
  const { projectFileComparisonActions } = loadTypeScriptModule(
    read('src/client/components/project/project-selection-model.ts'),
    ['projectFileComparisonActions'],
  );
  const compared = [];
  const staged = [];
  const buildTreeMenu = loadTypeScriptCallback(client, 'buildTreeMenu', {
    projectFileComparisonActions,
    filteredView: false,
    projectRowMenuCapabilities: () => ({
      isDirectory: true,
      isRoot: false,
      showDirectoryActions: true,
      showFileActions: true,
      showReveal: true,
    }),
    selection: new Set(),
    rows: [],
    projectRightSplitPaths: () => [],
    t: (key) => key,
    git: { changes: [{ path: 'dir/a.ts', status: ' M' }] },
    restage: (paths, stagedValue) => staged.push({ paths, staged: stagedValue }),
    compareWithClipboard: (path) => compared.push(path),
    compareWithRevision: () => {},
    showFileHistory: () => {},
    revealInFinder: () => {},
    refreshTree: async () => {},
    startCreate: () => {},
    copyReferenceMenuItems: () => [],
    currentCodeEditor: () => null,
    currentCodePath: () => null,
    root: '/repo',
    dirname,
    basename,
    openFile: () => {},
    openInRightSplit: () => {},
    openInTerminal: () => {},
    openMoveTo: () => {},
    removeEntries: () => {},
    removeEntry: () => {},
    revealPath: () => {},
    toggleDirectory: () => {},
    searchDirectoryRules: { excludedDirectories: [], includedDirectories: [] },
    searchDirectoryEffectiveState: () => 'included',
    searchDirectoryToggleDisabledReason,
    toggleSearchDirectory: () => {},
    buildHarnessPathAction: () => null,
    rowRefs: { current: new Map() },
  });
  const menu = buildTreeMenu({ row: { path: 'dir', kind: 'directory' }, x: 1, y: 2 });
  const findItem = (items, id) => {
    for (const item of items) {
      if (item?.id === id) return item;
      const nested = item?.items === undefined ? null : findItem(item.items, id);
      if (nested !== null) return nested;
    }
    return null;
  };
  findItem(menu.items, 'compareClipboard').run();
  assert.deepEqual(compared, ['dir']);
  findItem(menu.items, 'stageHere').run();
  assert.deepEqual(staged, [{ paths: ['dir/a.ts'], staged: false }]);
});

test('clipboard reading failures are reported rather than opening an empty diff', () => {
  const client = read('src/client/editor-workspace.tsx');
  const errors = [];
  const targets = [];
  let clipboardText = '';
  const compareWithClipboard = loadTypeScriptCallback(client, 'compareWithClipboard', {
    t: (key) => key,
    navigator: {
      clipboard: {
        readText: async () => clipboardText,
      },
    },
    setEditorError: (message) => errors.push(message),
    setDiffTarget: (target) => targets.push(target),
  });
  return compareWithClipboard('a.txt')
    .then(() => {
      assert.deepEqual(errors, ['editor.clipboardEmpty']);
      assert.deepEqual(targets, []);
      clipboardText = 'clipboard content\n';
      return compareWithClipboard('a.txt');
    })
    .then(() => {
      assert.deepEqual(targets, [
        {
          path: 'a.txt',
          clipboardText: 'clipboard content\n',
          label: 'clipboard',
          staged: false,
        },
      ]);
    });
});

test('a compare target is not mistaken for a commit or a staged diff', () => {
  const client = read('src/client/editor-workspace.tsx') + read('src/client/locales.ts');
  /* Order matters: clipboard first, otherwise `undefined === 'string'` checks fall through. */
  const clipboardAt = client.indexOf("typeof current.clipboardText === 'string'");
  const commitAt = client.indexOf("typeof current.commit === 'string'", clipboardAt);
  assert.ok(clipboardAt > 0 && commitAt > clipboardAt);
  assert.match(read('src/client/components/diff/DiffPreview.tsx'), /t\('editor\.compareClipboardMode'\)/);
});
