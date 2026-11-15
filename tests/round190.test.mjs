import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'lib/client.js'), 'utf8');

test('Project toolbar follows IDEA action order in both groups', () => {
  const panel = source.slice(source.indexOf('function ProjectPanel('), source.indexOf('/**\n     * IDEA-style context menu'));
  const toolbar = panel.slice(panel.indexOf("title: t('editor.project'),"), panel.indexOf('searchOpen\n'));
  const left = [...toolbar.matchAll(/id: '(newEntry|reveal)'/g)].map((match) => match[1]);
  const right = [...toolbar.matchAll(/id: '(expandSelected|collapse|options|hide)'/g)].map((match) => match[1]);
  assert.deepEqual(left, ['newEntry', 'reveal']);
  assert.deepEqual(right, ['expandSelected', 'collapse', 'options', 'hide']);
});

test('diff side headers have an explicit divider and retain both version labels', () => {
  assert.match(source, /diffSideHeaderDivider: \{[\s\S]*?borderLeft:/);
  assert.match(source, /\.\.\.styles\.diffSideHeader, \.\.\.styles\.diffSideHeaderDivider/);
  assert.match(source, /sideLabels\.left/);
  assert.match(source, /sideLabels\.right/);
});

test('unchanged-region folds use the host surface tokens', () => {
  assert.match(source, /\.dsh-editor-diff-pane \.diff-hidden-lines-widget/);
  assert.match(source, /var\(--dsw-alias-bg-layer-1\) !important/);
  assert.match(source, /var\(--dsw-alias-label-tertiary\) !important/);
  assert.match(source, /font-size: 10px !important/);
});

test('legacy chat collapse state remains absent', () => {
  assert.doesNotMatch(source, /dsh-editor\.chatCollapsed/);
  assert.doesNotMatch(source, /data-dsh-editor-chat-collapsed/);
  assert.doesNotMatch(source, /function toggleChatCollapsed\(/);
});
