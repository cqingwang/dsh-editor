import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const panel = await readFile(
  new URL('../src/client/components/commit/CommitPanel.tsx', import.meta.url),
  'utf8',
);

function statusStripSource() {
  const start = panel.indexOf('styles.commitStatusStack');
  const end = panel.indexOf('<CommitLog', start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  return panel.slice(start, end);
}

test('Commit status strip separates polite notices from assertive failures', () => {
  const strip = statusStripSource();
  assert.equal((strip.match(/role='status'/gu) ?? []).length, 2);
  assert.equal((strip.match(/role='alert'/gu) ?? []).length, 2);
  assert.equal((strip.match(/aria-atomic='true'/gu) ?? []).length, 4);
});

test('Commit status strip keeps Retry controls out of duplicate announcement nodes', () => {
  const strip = statusStripSource();
  assert.doesNotMatch(strip, /role='alert'[^>]*aria-live='assertive'[^>]*role='alert'/u);
  assert.match(strip, /gitNotManaged \? \([\s\S]*?role='status'[\s\S]*?\{t\('editor\.gitNotManaged'\)\}/u);
  assert.match(strip, /error !== null \? \([\s\S]*?role='alert'/u);
  assert.match(strip, /pushFailure === null \|\| pushFailure === undefined \? null : \([\s\S]*?role='alert'/u);
});
