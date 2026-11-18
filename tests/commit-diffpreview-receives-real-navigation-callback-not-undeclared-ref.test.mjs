import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const diffPreviewSource = readFileSync(join(root, 'src/client/components/diff/DiffPreview.tsx'), 'utf8');
const workspaceSource = readFileSync(join(root, 'src/client/editor-workspace.tsx'), 'utf8');
const source = `${diffPreviewSource}\n${workspaceSource}`;

test('DiffPreview receives a real navigation callback, not an undeclared ref', () => {
  const body = diffPreviewSource;
  assert.match(body, /onNavigate/);
  assert.match(body, /const onNavigateRef = React\.useRef\(onNavigate\);/);
  assert.match(body, /onNavigateRef\.current = onNavigate;/);
  assert.match(workspaceSource, /onNavigate=\{\(entry\) => \{/);
});

test('cross-file undo switches the visible diff back to the restored file', () => {
  const body = diffPreviewSource;
  const history = body.slice(body.indexOf('const applyHistoryEntry'), body.indexOf('const undoRestore'));
  assert.match(history, /active\.path !== entry\.path \|\| active\.side !== entry\.side/);
  assert.match(history, /onNavigateRef\.current\?\.\(entry\);/);
  assert.match(history, /side: entry\.side,/);
  assert.match(history, /staged: entry\.staged === true,/);
});

test('the workspace supplies the navigation target with the original side', () => {
  const call = workspaceSource.slice(workspaceSource.indexOf('onNavigate={(entry) => {'), workspaceSource.indexOf('undoRef: diffUndoRef'));
  assert.match(call, /path: entry\.path,/);
  assert.match(call, /staged: entry\.staged === true,/);
  assert.match(call, /setDiffTarget\(/);
  assert.match(call, /setDiffActive\(true\)/);
});
