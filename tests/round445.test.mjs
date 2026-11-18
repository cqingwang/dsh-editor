import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = (await readFile(new URL('./fixtures/project-panel.legacy.js', import.meta.url), 'utf8') + '\n' + await readFile(new URL('../lib/client.js', import.meta.url), 'utf8'));

test('Project New action uses IDEA combined file-or-directory wording', () => {
  assert.match(source, /newFileOrDirectory: '新建文件或目录…',/);
  assert.match(source, /newFileOrDirectory: 'New File or Directory…',/);
  assert.match(source, /id: 'newEntry', group: 'create', icon: 'newFile', label: t\('editor\.newFileOrDirectory'\), onClick: onOpenCreateMenu/);
  assert.doesNotMatch(source, /label: `\$\{t\('editor\.newFile'\)\} \/ \$\{t\('editor\.newFolder'\)\}…`/);
});
