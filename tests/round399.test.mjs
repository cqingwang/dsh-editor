import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');
const previewSource = await readFile(
  new URL('../src/client/components/editor/MarkdownPreviewPane.tsx', import.meta.url),
  'utf8',
);

test('Markdown missing link failures use a localized inline alert', () => {
  assert.match(source, /markdownLinkOpenFailed: 'Markdown 链接目标无法打开：\{path\}'/);
  assert.match(source, /markdownLinkOpenFailed: 'Could not open the Markdown link target: \{path\}'/);
  const preview = previewSource;
  assert.match(preview, /const \[linkError, setLinkError\] = React\.useState<string \| null>\(null\)/);
  assert.match(preview, /data-dsh-markdown-link-error/);
  assert.match(preview, /role='alert'/);
  assert.match(preview, /t\('editor\.markdownLinkOpenFailed', \{ path: resolved \}\)/);
});

test('Markdown local links consume the asynchronous open result without editorError', () => {
  const preview = previewSource;
  assert.match(preview, /Promise\.resolve\(onOpenFile\?\.\(resolved\)\)/);
  assert.match(preview, /opened === false/);
  assert.match(
    source,
    /if \(options\.silentError !== true\) setEditorError\(error instanceof Error \? error\.message : String\(error\)\)/,
  );
  assert.match(
    source,
    /onOpenFile: \(path\) => \(path === '' \? Promise\.resolve\(false\) : openFile\(path, \{ silentError: true \}\)\)/,
  );
});
