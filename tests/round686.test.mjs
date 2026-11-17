import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');
const statusStart = source.indexOf('statusFile === null || diffOpen');
const statusEnd = source.indexOf("findTool === null || findTool.surface === 'dock'", statusStart);
const statusBlock = source.slice(statusStart, statusEnd);

test('The status bar orders encoding and line count before the file path', () => {
  const position = statusBlock.indexOf('editor.statusBarPosition');
  const encoding = statusBlock.indexOf('fileMode.encoding');
  const lineCount = statusBlock.indexOf('editor.lineCount');
  const path = statusBlock.indexOf('data-dsh-editor-status-path');
  assert.ok(position >= 0, 'caret position is missing');
  assert.ok(encoding > position, 'encoding must follow the caret position');
  assert.ok(lineCount > encoding, 'line count must follow encoding');
  assert.ok(path > lineCount, 'file path must follow encoding and line count');
});

test('The status path is a keyboard-accessible copy button', () => {
  assert.match(statusBlock, /React\.createElement\(\s*'button',/u);
  assert.match(statusBlock, /className: 'dsh-editor-status-path'/u);
  assert.match(statusBlock, /onClick: \(\) => void copyStatusPath\(\)/u);
  assert.match(statusBlock, /'aria-label': t\('editor\.copyStatusPath', \{ path: statusPath \}\)/u);
  assert.match(source, /const copyStatusPath = React\.useCallback\(/u);
  assert.match(source, /navigator\.clipboard\.writeText\(statusPath\)/u);
  assert.match(source, /flashStatus\(t\('editor\.statusPathCopied'\)\)/u);
  assert.match(source, /flashStatus\(t\('editor\.clipboardWriteFailed'\)\)/u);
});

test('The copy feedback is the exact localized toast text', () => {
  assert.ok(source.includes("statusPathCopied: '已复制'"));
  assert.ok(source.includes("statusPathCopied: 'Copied'"));
  assert.ok(source.includes("copyStatusPath: '复制路径：{path}'"));
  assert.ok(source.includes("copyStatusPath: 'Copy path: {path}'"));
});

test('The path button has visible hover and focus states', () => {
  assert.match(source, /statusPathButton:\s*\{[\s\S]*?cursor: 'pointer',/u);
  assert.match(source, /\.dsh-editor-status-path:hover/u);
  assert.match(source, /\.dsh-editor-status-path:focus-visible/u);
});
