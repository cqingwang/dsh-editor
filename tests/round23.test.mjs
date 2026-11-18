import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

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
  const client = read('lib/client.js');
  assert.match(client, /id: 'compareClipboard',/);
  assert.match(client, /run: \(\) => void compareWithClipboard\(row\.path\)/);
  assert.match(client, /id: 'stageHere',/);
  assert.match(client, /id: 'unstageHere',/);
  /* Directory staging must scope to the directory, not the whole repo. */
  assert.match(client, /change\.path === row\.path \|\| change\.path\.startsWith\(`\$\{row\.path\}\/`\)/);
  /* Directory actions are not rendered for files, batch rows or the root. */
  assert.match(client, /showDirectoryActions/);
  assert.match(client, /disabled: batch\.length > 1 \|\| \(git\?\.changes \?\? \[\]\)\.length === 0/);
});

test('clipboard reading failures are reported rather than opening an empty diff', () => {
  const client = read('lib/client.js');
  assert.match(client, /const compareWithClipboard = React\.useCallback\(async \(path\) => \{/);
  assert.match(client, /setEditorError\(t\('editor\.clipboardUnavailable'\)\)/);
  assert.match(client, /setEditorError\(t\('editor\.clipboardEmpty'\)\)/);
  assert.match(client, /setDiffTarget\(\{ path, clipboardText: text, label: 'clipboard', staged: false \}\)/);
});

test('a compare target is not mistaken for a commit or a staged diff', () => {
  const client = read('lib/client.js');
  /* Order matters: clipboard first, otherwise `undefined === 'string'` checks fall through. */
  const clipboardAt = client.indexOf("typeof target.clipboardText === 'string'");
  const commitAt = client.indexOf("typeof target.commit === 'string'", clipboardAt);
  assert.ok(clipboardAt > 0 && commitAt > clipboardAt);
  assert.match(client, /t\('editor\.compareClipboardMode'\)/);
});
