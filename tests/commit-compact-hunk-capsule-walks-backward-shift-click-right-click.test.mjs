import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = (readFileSync(join(root, 'src/client/components/diff/DiffPreview.tsx'), 'utf8') + '\n' + readFileSync(join(root, 'lib/client.js'), 'utf8'));

function diffPreview() {
  return source.slice(source.indexOf('function DiffPreview('), source.indexOf('export { DiffPreview };'));
}

test('the compact hunk capsule walks backward with Shift-click and right-click', () => {
  const body = diffPreview();
  const capsule = body.slice(
    body.indexOf("className='dsh-editor-hunk-nav dsh-editor-hunk-capsule'"),
    body.indexOf("<ToolbarButton\n              icon='hide'"),
  );
  assert.match(capsule, /onClick=\{\(event\) => walkHunk\(event\.shiftKey \? 'previous' : 'next'\)\}/u);
  assert.match(capsule, /onContextMenu=\{\(event\) => \{/);
  assert.match(capsule, /event\.preventDefault\(\);/);
  assert.match(capsule, /walkHunk\('previous'\)/);
  assert.match(capsule, /role='button'/);
});

test('the full hunk arrows and keyboard remain the two-way navigation path', () => {
  const body = diffPreview();
  assert.match(body, /icon='chevronUp'\s+label=\{t\('editor\.previousChange'\)\}\s+onClick=\{\(\) => walkHunk\('previous'\)\}/u);
  assert.match(body, /icon='chevronDown'\s+label=\{t\('editor\.nextChange'\)\}\s+onClick=\{\(\) => walkHunk\('next'\)\}/u);
  assert.match(body, /walkHunk\(event\.shiftKey \? 'previous' : 'next'\)/);
});
