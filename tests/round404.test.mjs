import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');
const preview = source.slice(source.indexOf('function MarkdownPreviewPane('), source.indexOf('/**\n     * One file tab'));

test('a new valid Markdown link attempt clears the previous inline error', () => {
  assert.match(preview, /const resolved = resolveMarkdownLink\(path, target\);/);
  assert.match(preview, /if \(resolved === null\) \{\s+setLinkError\(null\);\s+return;\s+\}/s);
  assert.match(preview, /setLinkError\(null\);\s+Promise\.resolve\(onOpenFile\?\.\(resolved\)\)/s);
});

test('successful opens do not restore the previous link error', () => {
  assert.match(preview, /if \(opened === false\) setLinkError\(/);
  assert.doesNotMatch(preview, /if \(opened === true\) setLinkError\(/);
});
