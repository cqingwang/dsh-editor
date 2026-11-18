import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const panel = await readFile(new URL('../src/client/components/project/ProjectPanel.tsx', import.meta.url), 'utf8');
const workspace = await readFile(new URL('../src/client/editor-workspace.tsx', import.meta.url), 'utf8');
const client = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');

function extractFunction(name) {
  const marker = `function ${name}(`;
  const start = client.indexOf(marker);
  assert.notEqual(start, -1, `${name} should exist`);
  let index = client.indexOf('{', start);
  let depth = 0;
  for (; index < client.length; index += 1) {
    if (client[index] === '{') depth += 1;
    else if (client[index] === '}') {
      depth -= 1;
      if (depth === 0) {
        return new Function(`${client.slice(start, index + 1)}; return ${name};`)();
      }
    }
  }
  assert.fail(`${name} has no closing brace`);
}

test('double-clicking a Project file opens EditSource and focuses the editor', () => {
  const rowStart = panel.indexOf("const isDirectory = row.kind === 'directory';");
  assert.notEqual(rowStart, -1);
  const row = panel.slice(rowStart, panel.indexOf('onContextMenu:', rowStart));
  assert.match(panel, /\n  onOpenEditSource,/);
  assert.match(row, /else if \(!isDirectory && singleClickOpen !== true\) onOpenEditSource\(row\.path\);/);
  assert.doesNotMatch(row, /else if \(!isDirectory && singleClickOpen !== true\) onOpen\(row\.path\);/);
  assert.match(workspace, /onOpenEditSource=\{editLocalVersion\}/u);
});

test('single-click selection and speed-search keep their existing focus boundaries', () => {
  assert.match(panel, /else if \(singleClickOpen === true\) onOpenPreview\(row\.path\);/);
  assert.match(panel, /if \(action === 'expand'\) onToggle\(hit\.path\);/);
  assert.match(panel, /else if \(action === 'open'\) onOpen\(hit\.path\);/);
  assert.match(panel, /window\.setTimeout\(\(\) => treeRef\.current\?\.focus\(\), 0\);/);
  assert.match(workspace, /onOpen=\{openFile\}/u);
});

test('EditSource waits for Monaco to mount before taking keyboard focus', () => {
  const focusOnNextFrame = extractFunction('focusEditorOnNextFrame');
  const frames = [];
  const editorRef = { current: null };
  const focused = [];
  focusOnNextFrame(editorRef, (callback) => frames.push(callback), 4);
  assert.equal(frames.length, 1);
  frames.shift()();
  assert.equal(frames.length, 1);
  frames.shift()();
  assert.equal(frames.length, 1);
  editorRef.current = { focus: () => focused.push('editor') };
  frames.shift()();
  assert.deepEqual(focused, ['editor']);
  assert.match(workspace, /if \(opened\) focusEditorOnNextFrame\(editorRef\);/);
  assert.doesNotMatch(
    workspace,
    /openFile\(path\)\.then\(\(\) => window\.setTimeout\(\(\) => editorRef\.current\?\.focus\(\), 0\)\)/,
  );
});
