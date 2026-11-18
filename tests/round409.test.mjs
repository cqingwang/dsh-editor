import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');
const preview = await readFile(
  new URL('../src/client/components/editor/MarkdownPreviewPane.tsx', import.meta.url),
  'utf8',
);

test('the Markdown link error stays inside a narrow preview pane', () => {
  const style = source.slice(source.indexOf('markdownLinkError: {'), source.indexOf('markdownPreviewFallback: {'));
  assert.match(style, /boxSizing: 'border-box'/);
  assert.match(style, /maxWidth: '100%'/);
  assert.match(style, /overflowWrap: 'anywhere'/);
  assert.match(style, /wordBreak: 'break-word'/);
});

test('the alert keeps its localized full-path message and live-region semantics', () => {
  assert.match(preview, /t\('editor\.markdownLinkOpenFailed', \{ path: resolved \}\)/);
  assert.match(preview, /data-dsh-markdown-link-error=''/);
  assert.match(preview, /role='alert'/);
});
