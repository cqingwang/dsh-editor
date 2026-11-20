import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = (readFileSync(join(root, 'src/client/components/project/ProjectPanel.tsx'), 'utf8') + '\n' + readFileSync(join(root, 'src/client/components/diff/DiffPreview.tsx'), 'utf8') + '\n' + readFileSync(join(root, 'lib/client.js'), 'utf8'));

test('Project toolbar follows IDEA action order in both groups', () => {
  const panel = source.slice(source.indexOf('function ProjectPanel('), source.indexOf('/**\n     * IDEA-style context menu'));
  const toolbar = panel.slice(panel.indexOf('right={['), panel.indexOf('dropActive={toolbarDropActive}'));
  const directRight = toolbar.slice(toolbar.indexOf('right={['), toolbar.indexOf('trailingRight={'));
  const directTrailing = toolbar.slice(toolbar.indexOf('trailingRight={'), toolbar.indexOf('overflowMenuItems={'));
  const right = [...directRight.matchAll(/id: '(reveal|collapse|hide)'/g)].map((match) => match[1]);
  const trailing = [...directTrailing.matchAll(/id: '(reveal|collapse|hide)'/g)].map((match) => match[1]);
  assert.deepEqual(right, ['reveal', 'collapse']);
  assert.deepEqual(trailing, ['hide']);
  assert.doesNotMatch(panel, /left=\{\[[\s\S]*?id: 'reveal'/);
  assert.doesNotMatch(directRight, /id: 'expandSelected'/);
  assert.doesNotMatch(toolbar, /overflowMenuItems=/);
  assert.doesNotMatch(toolbar, /id: 'newEntry'|id: 'options'/);
});

test('diff side headers have an explicit divider and retain both version labels', () => {
  assert.match(source, /diffSideHeaderDivider: \{[\s\S]*?borderLeft:/);
  assert.match(source, /\.\.\.styles\.diffSideHeader,\s+\.\.\.styles\.diffSideHeaderDivider,/u);
  assert.match(source, /displayedSideLabels\.left/);
  assert.match(source, /displayedSideLabels\.right/);
});

test('unchanged-region folds use the host surface tokens', () => {
  assert.match(source, /\.dsh-editor-diff-pane \.diff-hidden-lines-widget/);
  assert.match(source, /var\(--dsw-alias-bg-layer-1\) !important/);
  assert.match(source, /var\(--dsw-alias-label-tertiary\) !important/);
  assert.match(source, /font-size: var\(--dsh-editor-font-size-caption, 10px\) !important/);
});

test('legacy chat collapse state remains absent', () => {
  assert.doesNotMatch(source, /dsh-editor\.chatCollapsed/);
  assert.doesNotMatch(source, /data-dsh-editor-chat-collapsed/);
  assert.doesNotMatch(source, /function toggleChatCollapsed\(/);
});
