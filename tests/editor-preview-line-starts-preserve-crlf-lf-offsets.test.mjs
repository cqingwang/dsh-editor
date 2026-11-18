import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadTypeScriptFunction } from './ts-source.mjs';

const commitSource = await readFile(new URL('../src/client/commit.ts', import.meta.url), 'utf8');
const source = `${commitSource}\n${await readFile(new URL('../src/client/components/search/FindToolWindow.tsx', import.meta.url), 'utf8')}`;
const findTool = source.slice(
  source.indexOf('function FindToolWindowView('),
  source.indexOf('const FindToolWindow = FindToolWindowView;'),
);
const findToolTextLineStarts = loadTypeScriptFunction(commitSource, 'findToolTextLineStarts');
const findToolPreviewLineParts = loadTypeScriptFunction(commitSource, 'findToolPreviewLineParts');

test('Preview line starts preserve CRLF and LF offsets', () => {
  assert.deepEqual(findToolTextLineStarts('alpha\nbeta\ngamma'), [0, 6, 11]);
  assert.deepEqual(findToolTextLineStarts('alpha\r\nbeta\r\ngamma'), [0, 7, 13]);
  assert.deepEqual(findToolTextLineStarts(''), [0]);
});

test('Cross-line matches are clipped into each visible preview line', () => {
  const matches = [{ offset: 0, length: 10 }];
  assert.deepEqual(findToolPreviewLineParts('alpha', 0, matches), [
    { text: 'alpha', match: true },
  ]);
  assert.deepEqual(findToolPreviewLineParts('beta', 6, matches), [
    { text: 'beta', match: true },
  ]);
  assert.deepEqual(findToolPreviewLineParts('gamma', 11, matches), [
    { text: 'gamma', match: false },
  ]);
  assert.deepEqual(findToolPreviewLineParts('tail', 0, [{ offset: 1, length: 2 }, { offset: 2, length: 2 }]), [
    { text: 't', match: false },
    { text: 'ail', match: true },
  ]);
  assert.deepEqual(findToolPreviewLineParts('zero', 0, [{ offset: 1, length: 0 }]), [
    { text: 'zero', match: false },
  ]);
});

test('Find Preview computes and renders the active match ranges once', () => {
  assert.match(findTool, /const previewLineStarts = findToolTextLineStarts\(previewState\.content\)/);
  assert.match(findTool, /editorFindResult\(previewState\.content, query, \{/);
  assert.match(findTool, /scope: \{[\s\S]*?start: previewScopeStart[\s\S]*?end: previewScopeEnd/);
  assert.match(findTool, /findToolPreviewLineParts\(code, previewLineStart, previewMatches\)/);
  assert.match(findTool, /segments=\{previewSegments\}/);
  assert.match(source, /className = 'dsh-editor-code-preview-match'/);
  assert.match(source, /setAttribute\('data-dsh-find-preview-match', '1'\)/);
});
