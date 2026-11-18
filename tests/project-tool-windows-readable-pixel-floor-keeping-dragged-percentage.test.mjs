import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'lib/client.js'), 'utf8');
const lineCountsSource = readFileSync(join(root, 'src/client/components/ui/LineCounts.tsx'), 'utf8');

function toolPanelFlex() {
  const marker = '    function toolPanelFlex(';
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, 'toolPanelFlex is missing');
  const end = source.indexOf('\n    }', start) + '\n    }'.length;
  return new Function(`const TOOL_PANEL_MIN_PX = 200; ${source.slice(start, end)}; return toolPanelFlex;`)();
}

const flexFor = toolPanelFlex();

test('tool windows use a readable pixel floor while keeping the dragged percentage', () => {
  assert.equal(flexFor('project', 28), '0 0 clamp(200px, 28%, 420px)');
  assert.equal(flexFor('commit', 25), '0 0 clamp(200px, 25%, 480px)');
  assert.equal(flexFor('project', Number.NaN), '0 0 clamp(200px, 28%, 420px)');
  assert.equal(flexFor('project', 5), '0 0 clamp(200px, 14%, 420px)');
  assert.equal(flexFor('commit', 90), '0 0 clamp(200px, 72%, 480px)');
});

test('Project opens with the Gufa-like fallback rather than the old 26 percent', () => {
  assert.match(source, /React\.useState\(\{ project: 28, commit: 25 \}\)/);
  assert.match(source, /project: readToolWidth\(value\.root \?\? '', 'project', 28\)/);
  assert.match(source, /flex: toolPanelFlex\(activity,/);
  assert.match(source, /minWidth: 200,/);
});

test('narrow Changes rows keep one exact line-count reading and a full tooltip', () => {
  assert.match(lineCountsSource, /dsh-editor-line-counts/);
  assert.match(lineCountsSource, /dsh-editor-line-counts-deletions-only/);
  assert.match(lineCountsSource, /title=\{`\+\$\{counts\.additions\} −\$\{counts\.deletions\}`\}/);
  assert.match(source, /@container dsh-editor-side \(max-width: 210px\)/);
  assert.match(source, /\.dsh-editor-line-count-del \{ display: none !important; \}/);
  assert.match(source, /\.dsh-editor-line-count-add \{ display: none !important; \}/);
});
