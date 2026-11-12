import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'lib/client.js'), 'utf8');

function commitPanel() {
  return source.slice(source.indexOf('function CommitPanel('), source.indexOf('function NamePrompt('));
}

test('Commit folders and files share IDEA-style aligned columns', () => {
  assert.match(source, /commitTreeNode: \{[\s\S]*?display: 'grid'/);
  assert.match(source, /gridTemplateColumns: '12px 16px 16px 16px max-content minmax\(0, 1fr\) max-content'/);
  const panel = commitPanel();
  assert.match(panel, /style: \{ \.\.\.styles\.commitTreeNode, paddingLeft: 22 \}/);
  assert.match(panel, /style: \{\s*\.\.\.styles\.commitTreeNode,[\s\S]*?\.\.\.styles\.commitFileRow,[\s\S]*?paddingLeft: 22,/);
});

test('the file name and its parent path keep stable, separate grid cells', () => {
  const panel = commitPanel();
  assert.match(panel, /styles\.commitNodeName/);
  assert.match(panel, /styles\.commitFileName/);
  assert.match(panel, /styles\.commitFileDir/);
  assert.match(source, /commitNodeName: \{[\s\S]*?minWidth: 0/);
  assert.match(source, /commitFileName: \{[\s\S]*?minWidth: 'max-content'/);
  assert.match(source, /commitFileDir: \{[\s\S]*?textOverflow: 'ellipsis'/);
});

test('file rows reserve the disclosure column so checkboxes align with folders', () => {
  const panel = commitPanel();
  const fileBody = panel.slice(panel.indexOf("const change = row.change;"));
  assert.match(fileBody, /React\.createElement\('span', \{ style: styles\.commitChevron \}\)/);
  assert.match(fileBody, /React\.createElement\('input', \{[\s\S]*?type: 'checkbox'/);
  assert.match(fileBody, /React\.createElement\('span', \{ style: \{ \.\.\.styles\.statusBadge/);
  assert.match(fileBody, /React\.createElement\(EntryIcon/);
});
