import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');

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
  const control = source.slice(
    source.indexOf('function DiffViewModeControl('),
    source.indexOf('/** One 24px panel toolbar button. */'),
  );
  assert.match(control, /role: 'group'/);
  assert.match(control, /label: t\('editor\.diffUnifiedMode'\)/);
  assert.match(control, /label: t\('editor\.diffSideBySideMode'\)/);
  assert.match(control, /icon: 'unified'/);
  assert.match(control, /icon: 'split'/);
  assert.match(control, /active: sideBySide === false/);
  assert.match(control, /active: sideBySide === true/);
  assert.match(control, /'data-dsh-diff-fixed': ''/);
});

test('DiffPreview renders the fixed IDEA mode control instead of a generic toolbar action', () => {
  const diff = source.slice(source.indexOf('function DiffPreview('), source.indexOf('* Commit tool window: grouped'));
  assert.doesNotMatch(diff, /id: 'view'/);
  assert.match(diff, /const diffViewModeControl = diffViewModeControlForWidth\(diffToolbarWidth\)/);
  assert.match(diff, /React\.createElement\(DiffViewModeControl, \{/);
  assert.match(diff, /mode: diffViewModeControl/);
  assert.match(diff, /disabled: diffUnavailable/);
});
