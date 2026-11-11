import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { parseTerminalLinks, resolveTerminalPath } from '../lib/link-parser.mjs';
import { workspaceFileOperations } from '../lib/index.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(root, path), 'utf8');

test('urls become links without swallowing trailing punctuation', () => {
  const links = parseTerminalLinks('see https://example.com/a?b=1, then continue');
  assert.equal(links.length, 1);
  assert.equal(links[0].kind, 'url');
  assert.equal(links[0].text, 'https://example.com/a?b=1');
  assert.equal(links[0].start, 4);
  assert.equal(links[0].end, 29);
});

test('paths keep their line and column, and version numbers are not paths', () => {
  const links = parseTerminalLinks('wrote src/app.ts:12:4 and released 1.2.3');
  assert.deepEqual(
    links.map((link) => [link.kind, link.path, link.line, link.column]),
    [['path', 'src/app.ts', 12, 4]],
  );
});

test('resolveTerminalPath folds relative segments against the shell cwd', () => {
  assert.equal(resolveTerminalPath('/tmp/work', './a/../b/c.txt'), '/tmp/work/b/c.txt');
  assert.equal(resolveTerminalPath('/tmp/work', '/abs/x'), '/abs/x');
  assert.equal(resolveTerminalPath('/tmp/work', '~/x'), '~/x');
});

test('host reports whether candidate paths exist and stays inside the workspace', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'dsh-editor-exists-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  await mkdir(join(dir, 'src'), { recursive: true });
  await writeFile(join(dir, 'src', 'app.ts'), 'export const x = 1;\n');

  const described = await workspaceFileOperations.describe(dir, [
    join(dir, 'src', 'app.ts'),
    join(dir, 'missing.ts'),
    '/etc/passwd',
  ]);
  assert.deepEqual(
    described.map((entry) => [entry.path, entry.exists, entry.kind]),
    [
      ['src/app.ts', true, 'file'],
      ['missing.ts', false, null],
      ['/etc/passwd', false, null],
    ],
  );
});

test('terminal exposes a link provider and a context menu over the PTY', () => {
  const client = read('lib/client.js');
  const host = read('lib/index.js');
  assert.match(client, /registerLinkProvider/);
  assert.match(client, /createTerminalLinkProvider/);
  assert.match(client, /dsh-editor-open-file/);
  assert.match(client, /function terminalMenuModel/);
  assert.match(client, /terminalCloseOthers/);
  assert.match(host, /\/api\/dsh-editor\/shared\/\$\{fileName\}/);
  assert.match(host, /case 'exists':/);
});

test('tool-window toolbars collapse actions instead of the title', () => {
  const client = read('lib/client.js');
  assert.match(client, /function PanelToolbar/);
  assert.match(client, /const fitGroup = \(group\) =>/);
  assert.match(client, /editor\.moreActions/);
});
