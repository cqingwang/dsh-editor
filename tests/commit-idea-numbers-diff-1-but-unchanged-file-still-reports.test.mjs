import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = (readFileSync(join(root, 'src/client/components/diff/DiffPreview.tsx'), 'utf8') + '\n' + readFileSync(join(root, 'lib/client.js'), 'utf8'));
const host = readFileSync(join(root, 'lib/index.js'), 'utf8');

/** Evaluate one shipping helper by brace balance, so the test runs the real code. */
function load(name) {
  const marker = `    function ${name}(`;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `${name} is missing from lib/client.js`);
  let index = source.indexOf('{', start);
  let depth = 0;
  for (; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    else if (source[index] === '}') {
      depth -= 1;
      if (depth === 0) return new Function(`${source.slice(start, index + 1)}; return ${name};`)();
    }
  }
  throw new Error(`unbalanced braces in ${name}`);
}

const hunkAt = load('hunkAt');

test('IDEA numbers a diff from 1, but an unchanged file still reports 0/0', () => {
  const changes = [
    { modifiedStartLineNumber: 30, modifiedEndLineNumber: 31 },
    { modifiedStartLineNumber: 60, modifiedEndLineNumber: 61 },
  ];
  assert.deepEqual(hunkAt(changes, 1), { index: 1, total: 2 });
  assert.deepEqual(hunkAt(changes, 30), { index: 1, total: 2 });
  assert.deepEqual(hunkAt(changes, 45), { index: 1, total: 2 });
  assert.deepEqual(hunkAt(changes, 60), { index: 2, total: 2 });
  assert.deepEqual(hunkAt([], 1), { index: 0, total: 0 });
  assert.deepEqual(hunkAt(null, 1), { index: 0, total: 0 });
});

test('the diff settles the hunk counter after Monaco has computed changes', () => {
  const body = source.slice(source.indexOf('function DiffPreview('), source.indexOf('export { DiffPreview };'));
  assert.match(body, /diff\.revealFirstDiff\(\);/);
  assert.match(body, /diff\.waitForDiff\(\)\.then\(\(\) => \{[\s\S]*?focusFirstHunkRef\.current\?\.\(\);[\s\S]*?syncHunksRef\.current\?\.\(\);/);
});

test('the first hunk owns the caret, so the counter reads 1/N like IDEA', () => {
  const body = source.slice(source.indexOf('function DiffPreview('), source.indexOf('export { DiffPreview };'));
  assert.match(body, /const focusFirstHunkRef = React\.useRef\(null\);/);
  assert.match(body, /focusFirstHunkRef\.current = \(\) => \{/);
  assert.match(body, /const first = changes\[0\];/);
  assert.match(
    body,
    /editor\.setPosition\(\{\s+lineNumber: Math\.max\(1, Number\(first\.modifiedStartLineNumber\) \|\| 1\),\s+column: 1,\s+\}\);/u,
  );
});

test('diff headers name both sides the way IDEA does', () => {
  const body = source.slice(source.indexOf('function DiffPreview('), source.indexOf('export { DiffPreview };'));
  assert.match(body, /const sideLabels =\s+target\?\.combined === true[\s\S]*?typeof target\?\.commit === 'string'/u);
  assert.match(body, /left: target\.commit\.slice\(0, 7\),\s+right: t\('editor\.commitVersion'\)/u);
  assert.match(body, /typeof target\?\.revision === 'string'/);
  assert.match(body, /t\('editor\.clipboardVersion'\)/);
  assert.match(body, /: target\?\.staged === true/);
  assert.match(body, /className='dsh-editor-diff-side-headers'/);
  assert.match(body, /displayedSideLabels\.left/);
  assert.match(body, /displayedSideLabels\.right/);
  assert.match(body, /t\('editor\.currentVersion'\)/);
  assert.match(body, /sideBySide \? \(\s*<div/u);
  assert.match(source, /indexVersion: '索引'/);
  assert.match(source, /currentVersion: '当前版本'/);
});

test('the side captions disappear in unified mode', () => {
  const body = source.slice(source.indexOf('function DiffPreview('), source.indexOf('export { DiffPreview };'));
  const headers = body.slice(body.indexOf("className='dsh-editor-diff-side-headers'"), body.indexOf('state.error !== null'));
  assert.match(headers, /displayedSideLabels\.left/);
  assert.match(headers, /displayedSideLabels\.right/);
  assert.match(headers, /\) : null\}/u);
  assert.match(body, /sideBySide \? \(\s*<div\s+style=\{styles\.diffSideHeaders\}/u);
});

test('the compact diff keeps the path hint out of the title when it would starve it', () => {
  const css = source.slice(source.indexOf('function installStyles('));
  assert.match(css, /@container dsh-editor-editor \(max-width: 440px\)/);
  assert.match(css, /\.dsh-editor-diff-hint \{ display: none !important; \}/);
  assert.match(source, /className: 'dsh-editor-diff-hint'/);
});

test('the narrow toolbar keeps its hunk count and close action on screen', () => {
  const body = source.slice(source.indexOf('function DiffPreview('), source.indexOf('export { DiffPreview };'));
  const toolbar = body.slice(body.indexOf("className: 'dsh-editor-diff-toolbar'"), body.indexOf("className: 'dsh-editor-diff-side-headers'"));
  assert.match(body, /style=\{styles\.diffToolbarActions\}/);
  assert.match(body, /className='dsh-editor-diff-toolbar-actions'/);
  assert.match(source, /diffToolbar:\s*\{/);
  assert.match(source, /diffToolbarActions:\s*\{/);
  assert.match(source, /\.dsh-editor-diff-toolbar-actions/);
});

test('a compact hunk capsule leaves the close action visible at quarter width', () => {
  const body = source.slice(source.indexOf('function DiffPreview('), source.indexOf('export { DiffPreview };'));
  assert.match(body, /className='dsh-editor-hunk-nav dsh-editor-hunk-capsule'/);
  assert.match(source, /@container dsh-editor-editor \(max-width: 440px\)[^{]*\{[\s\S]*?\.dsh-editor-hunk-nav \{ display: none !important; \}/);
  assert.match(source, /@container dsh-editor-editor \(max-width: 440px\)[^{]*\{[\s\S]*?\.dsh-editor-hunk-capsule \{ display: inline-flex !important; \}/);
});

test('the compact capsule advances on click while F7 keeps the keyboard path', () => {
  const body = source.slice(source.indexOf('function DiffPreview('), source.indexOf('export { DiffPreview };'));
  const capsule = body.slice(
    body.indexOf("className='dsh-editor-hunk-nav dsh-editor-hunk-capsule'"),
    body.indexOf("<ToolbarButton\n              icon='hide'"),
  );
  assert.match(capsule, /onClick=\{\(event\) => walkHunk\(event\.shiftKey \? 'previous' : 'next'\)\}/u);
  assert.match(capsule, /t\('editor\.hunkCapsuleHint', \{\s+index: hunks\.index,\s+total: hunks\.total,\s+\}\)/u);
  assert.match(body, /event\.key !== 'F7'/);
  assert.match(body, /walkHunk\(event\.shiftKey \? 'previous' : 'next'\)/);
});

test('the restore hint is one compact line, matching IDEA density', () => {
  const hint = source.slice(source.indexOf('diffRestoreHint: {'), source.indexOf('diffSideHeaders: {'));
  assert.match(hint, /height: 18,/);
  assert.match(hint, /lineHeight: '18px',/);
  assert.match(hint, /padding: '0 10px',/);
});

test('the restore history names the index side for staged diffs', () => {
  const body = source.slice(source.indexOf('function DiffPreview('), source.indexOf('export { DiffPreview };'));
  assert.match(body, /side: loaded\.side,/);
  assert.match(body, /side: entry\.side,/);
  assert.match(host, /async function gitApplyChunk/);
  assert.match(host, /const side = input\.side === 'index' \? 'index' : input\.side === 'worktree'/);
  assert.match(host, /if \(side === 'index'\) return gitWriteIndex/);
});
