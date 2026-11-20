import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const panel = await readFile(
  new URL('../src/client/components/commit/CommitPanel.tsx', import.meta.url),
  'utf8',
);
const locales = await readFile(new URL('../src/client/locales.ts', import.meta.url), 'utf8');

const textareaStart = panel.indexOf('ref={commitMessageRef}');
const textareaEnd = panel.indexOf('onKeyDown=', textareaStart);
const textarea = panel.slice(textareaStart, textareaEnd);

test('the commit message field has a stable localized accessible name', () => {
  assert.ok(textareaStart >= 0 && textareaEnd > textareaStart, 'commit message textarea must remain present');
  assert.match(textarea, /aria-label=\{t\('editor\.commitMessage'\)\}/u);
  assert.match(locales, /commitMessage: '提交信息',/u);
  assert.match(locales, /commitMessage: 'Commit Message',/u);
});

test('the placeholder remains guidance instead of the accessible name', () => {
  assert.match(textarea, /placeholder=\{t\('editor\.commitMessagePlaceholder'\)\}/u);
  assert.doesNotMatch(textarea, /aria-label=\{t\('editor\.commitMessagePlaceholder'\)\}/u);
});
