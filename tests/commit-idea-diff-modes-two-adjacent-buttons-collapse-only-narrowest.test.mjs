import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { diffViewModeControlSource } from './ui-sources.mjs';

const source = (await readFile(new URL('../src/client/components/diff/DiffPreview.tsx', import.meta.url), 'utf8')) + '\n' + (await readFile(new URL('../lib/client.js', import.meta.url), 'utf8'));

function extract(name) {
  const marker = `    function ${name}(`;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `${name} should exist`);
  let index = source.indexOf('{', start);
  let depth = 0;
  for (; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    else if (source[index] === '}') {
      depth -= 1;
      if (depth === 0) return new Function(`${source.slice(start, index + 1)}; return ${name};`)();
    }
  }
  assert.fail(`unterminated ${name}`);
}

test('IDEA diff modes use two adjacent buttons and collapse only at the narrowest width', () => {
  const mode = extract('diffViewModeControlForWidth');
  assert.equal(mode(Number.POSITIVE_INFINITY), 'paired');
  assert.equal(mode(493), 'paired');
  assert.equal(mode(280), 'paired');
  assert.equal(mode(279), 'toggle');
  assert.equal(mode(193), 'toggle');
  assert.equal(mode(Number.NaN), 'paired');
});

test('the paired control exposes unified and side-by-side as independent toggles', () => {
  assert.match(diffViewModeControlSource, /role='group'/);
  assert.match(diffViewModeControlSource, /label=\{t\('editor\.diffUnifiedMode'\)\}/);
  assert.match(diffViewModeControlSource, /label=\{t\('editor\.diffSideBySideMode'\)\}/);
  assert.match(diffViewModeControlSource, /icon='unified'/);
  assert.match(diffViewModeControlSource, /icon='split'/);
  assert.match(diffViewModeControlSource, /active=\{sideBySide === false\}/);
  assert.match(diffViewModeControlSource, /active=\{sideBySide === true\}/);
  assert.match(diffViewModeControlSource, /data-dsh-diff-fixed=''/);
});

test('DiffPreview renders the fixed IDEA mode control instead of a generic toolbar action', () => {
  const diff = source.slice(source.indexOf('function DiffPreview('), source.indexOf('export { DiffPreview };'));
  assert.doesNotMatch(diff, /id: 'view'/);
  assert.match(diff, /const diffViewModeControl = diffViewModeControlForWidth\(diffToolbarWidth\)/);
  assert.match(diff, /<DiffViewModeControl/);
  assert.match(diff, /mode=\{diffViewModeControl\}/);
  assert.match(diff, /disabled: diffUnavailable/);
});
