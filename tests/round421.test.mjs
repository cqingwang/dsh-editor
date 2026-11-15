import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');

test('the Markdown preview is an inline-size container for narrow split layout', () => {
  const style = source.slice(
    source.indexOf('markdownPreviewPane: {'),
    source.indexOf('markdownPreviewFallback: {'),
  );
  assert.match(style, /containerType: 'inline-size'/);
});

test('preview padding yields to a narrow code/preview split without shrinking the alert', () => {
  assert.match(
    source,
    /markdownPreviewContent:\s*\{[\s\S]*?padding: '20px clamp\(8px, 12cqw, 24px\) 48px'/,
  );
  assert.doesNotMatch(
    source,
    /markdownPreviewContent:\s*\{[\s\S]*?padding: '20px 24px 48px'/,
  );
});
