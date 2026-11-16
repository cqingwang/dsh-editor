import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');
const findTool = source.slice(
  source.indexOf('function FindToolWindow('),
  source.indexOf('function QuickOpen('),
);

test('Preview line starts preserve CRLF and LF offsets', () => {
  const starts = new Function(
    `${extractFunction('findToolTextLineStarts')}; return findToolTextLineStarts;`,
  )();
  assert.deepEqual(starts('alpha\nbeta\ngamma'), [0, 6, 11]);
  assert.deepEqual(starts('alpha\r\nbeta\r\ngamma'), [0, 7, 13]);
  assert.deepEqual(starts(''), [0]);
});

test('Cross-line matches are clipped into each visible preview line', () => {
  const parts = new Function(
    `${extractFunction('findToolPreviewLineParts')}; return findToolPreviewLineParts;`,
  )();
  const matches = [{ offset: 0, length: 10 }];
  assert.deepEqual(parts('alpha', 0, matches), [
    { text: 'alpha', match: true },
  ]);
  assert.deepEqual(parts('beta', 6, matches), [
    { text: 'beta', match: true },
  ]);
  assert.deepEqual(parts('gamma', 11, matches), [
    { text: 'gamma', match: false },
  ]);
  assert.deepEqual(parts('tail', 0, [{ offset: 1, length: 2 }, { offset: 2, length: 2 }]), [
    { text: 't', match: false },
    { text: 'ail', match: true },
  ]);
  assert.deepEqual(parts('zero', 0, [{ offset: 1, length: 0 }]), [
    { text: 'zero', match: false },
  ]);
});

test('Find Preview computes and renders the active match ranges once', () => {
  assert.match(findTool, /const previewLineStarts = findToolTextLineStarts\(previewState\.content\)/);
  assert.match(findTool, /editorFindResult\(previewState\.content, query, \{/);
  assert.match(findTool, /scope: \{[\s\S]*?start: previewScopeStart[\s\S]*?end: previewScopeEnd/);
  assert.match(findTool, /findToolPreviewLineParts\(code, previewLineStart, previewMatches\)/);
  assert.match(findTool, /segments: previewSegments/);
  assert.match(source, /className = 'dsh-editor-code-preview-match'/);
  assert.match(source, /setAttribute\('data-dsh-find-preview-match', '1'\)/);
});

function extractFunction(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} is missing`);
  const bodyStart = source.indexOf(') {', start) + 2;
  assert.ok(bodyStart > 1, `${name} has no function body`);
  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}') depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }
  assert.fail(`${name} has no closing brace`);
}
