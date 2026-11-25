import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { loadTypeScriptFunction } from './ts-source.mjs';

const diffSource = await readFile(new URL('../src/client/diff.ts', import.meta.url), 'utf8');
const previewSource = await readFile(new URL('../src/client/components/diff/DiffPreview.tsx', import.meta.url), 'utf8');
const builtClient = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');
const source = `${diffSource}\n${previewSource}\n${builtClient}`;

test('the rollback inclusion label collapses before it can push close and hunk controls out', () => {
  const visible = loadTypeScriptFunction(diffSource, 'diffRollbackIncludeLabelVisibleForWidth');
  assert.equal(visible(Number.POSITIVE_INFINITY), true);
  assert.equal(visible(420), true);
  assert.equal(visible(419), false);
  assert.equal(visible(311), false);
  assert.equal(visible(Number.NaN), true);
});

test('DiffPreview keeps the rollback checkbox named while hiding only its text at narrow widths', () => {
  const diffStart = previewSource.indexOf('function DiffPreview(');
  const diffEnd = previewSource.indexOf('export { DiffPreview };', diffStart);
  assert.notEqual(diffStart, -1, 'DiffPreview is missing');
  assert.notEqual(diffEnd, -1, 'DiffPreview end marker is missing');
  const diff = previewSource.slice(diffStart, diffEnd);
  assert.match(diff, /diffRollbackIncludeLabelVisibleForWidth/u);
  assert.match(
    diff,
    /const rollbackIncludeLabelVisible = diffRollbackIncludeLabelVisibleForWidth\(diffToolbarWidth\)/u,
  );
  assert.match(diff, /aria-label=\{t\('editor\.diffIncludeInRollback'\)\}/u);
  assert.match(diff, /rollbackIncludeLabelVisible \? <span>\{t\('editor\.diffIncludeInRollback'\)\}<\/span> : null/u);
});

test('toolbar measurement reruns when rollback inclusion or its label visibility changes', () => {
  const diffStart = previewSource.indexOf('function DiffPreview(');
  const diffEnd = previewSource.indexOf('export { DiffPreview };', diffStart);
  const diff = previewSource.slice(diffStart, diffEnd);
  assert.match(diff, /rollbackInclusion === undefined \? '0' : '1'/u);
  assert.match(diff, /rollbackIncludeLabelVisible === true \? '1' : '0'/u);
});
