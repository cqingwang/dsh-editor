import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');

test('all Monaco editing surfaces share the global 13px code font', () => {
  assert.match(source, /const EDITOR_CODE_FONT_SIZE = 13;/u);
  assert.equal((source.match(/fontSize: EDITOR_CODE_FONT_SIZE/gu) ?? []).length, 3);
  for (const marker of ['editor-core.js', 'diff.js']) {
    const start = source.indexOf(`/* ─────────────────────── ${marker} ─────────────────────── */`);
    const end = source.indexOf('/* ─────────────────────── ', start + 1);
    assert.ok(start >= 0 && end > start, `${marker} module is missing`);
    assert.doesNotMatch(source.slice(start, end), /fontSize: 12,/u);
  }
});
