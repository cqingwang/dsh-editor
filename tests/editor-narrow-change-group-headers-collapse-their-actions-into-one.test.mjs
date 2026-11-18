import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = ((readFileSync(join(root, 'src/client/components/commit/CommitPanel.tsx'), 'utf8') + '\n' + readFileSync(join(root, 'lib/client.js'), 'utf8'))) + '\n' + readFileSync(join(root, 'src/client/components/commit/CommitLog.tsx'), 'utf8');

test('narrow Change group headers collapse their actions into one overflow button', () => {
  const panel = source.slice(source.indexOf('function CommitPanel('), source.indexOf('function CommitLogView('));
  assert.match(panel, /const groupActions = \[/);
  assert.match(panel, /dsh-editor-commit-group-actions-wide/);
  assert.match(panel, /dsh-editor-commit-group-actions-narrow/);
  assert.match(panel, /dsh-editor-commit-group-header-count/);
  assert.match(panel, /setGroupActionMenu\(\{/);
});

test('the narrow rule keeps the complete label and count visible policy intact', () => {
  const css = source.slice(source.indexOf('@container dsh-editor-side (max-width: 205px)'), source.indexOf('/* At the default quarter width'));
  assert.match(css, /@container dsh-editor-side \(max-width: 240px\)/);
  assert.match(css, /\.dsh-editor-commit-group-actions-wide \{ display: none !important; \}/);
  assert.match(css, /\.dsh-editor-commit-group-actions-narrow \{ display: contents !important; \}/);
  assert.match(css, /\.dsh-editor-commit-group-header-count \{ display: none !important; \}/);
});

test('the group overflow menu reuses ContextMenu and the same staging actions', () => {
  const panel = source.slice(source.indexOf('function CommitPanel('), source.indexOf('function CommitLogView('));
  const menu = panel.slice(panel.indexOf('groupActionMenu === null'), panel.indexOf('historyMenu === null', panel.indexOf('groupActionMenu === null')));
  assert.match(menu, /<ContextMenu/);
  assert.match(menu, /menu=\{groupActionMenu\}/);
  const actionModel = panel.slice(panel.indexOf('const groupActions = ['), panel.indexOf('<LineCounts', panel.indexOf('const groupActions = [')));
  assert.match(actionModel, /onUnstage\(selectedInGroup\)/);
  assert.match(actionModel, /onStage\(selectedInGroup\)/);
  assert.match(actionModel, /onGitignore\(selectedInGroup\)/);
});
