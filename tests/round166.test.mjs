import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'lib/client.js'), 'utf8');

function diffPreview() {
  return source.slice(source.indexOf('function DiffPreview('), source.indexOf('* Commit tool window: grouped'));
}

test('the compact hunk capsule walks backward with Shift-click and right-click', () => {
  const body = diffPreview();
  const capsule = body.slice(
    body.indexOf("className: 'dsh-editor-hunk-nav dsh-editor-hunk-capsule'"),
    body.indexOf("React.createElement(ToolbarButton, { icon: 'hide'"),
  );
  assert.match(capsule, /onClick: \(event\) => walkHunk\(event\.shiftKey \? 'previous' : 'next'\)/);
  assert.match(capsule, /onContextMenu: \(event\) => \{/);
  assert.match(capsule, /event\.preventDefault\(\);/);
  assert.match(capsule, /walkHunk\('previous'\)/);
  assert.match(capsule, /role: 'button'/);
});

test('the full hunk arrows and keyboard remain the two-way navigation path', () => {
  const body = diffPreview();
  assert.match(body, /icon: 'chevronUp', label: t\('editor\.previousChange'\), onClick: \(\) => walkHunk\('previous'\)/);
  assert.match(body, /icon: 'chevronDown', label: t\('editor\.nextChange'\), onClick: \(\) => walkHunk\('next'\)/);
  assert.match(body, /walkHunk\(event\.shiftKey \? 'previous' : 'next'\)/);
});
