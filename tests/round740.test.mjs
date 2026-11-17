import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');

function extractFunction(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} is missing`);
  const bodyStart = source.indexOf(') {', start) + 2;
  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}') depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }
  assert.fail(`${name} has no closing brace`);
}

test('Project toolbar falls back to the selected directory or workspace root', () => {
  const targetFor = new Function(
    `${extractFunction('dirname')}; ${extractFunction('projectExternalDropDirectory')}; ${extractFunction('projectToolbarDropDirectory')}; return projectToolbarDropDirectory;`,
  )();
  const rows = [
    { path: '', kind: 'directory', root: true },
    { path: 'docs', kind: 'directory' },
    { path: 'docs/notes.md', kind: 'file' },
  ];
  assert.equal(targetFor(rows, null), '');
  assert.equal(targetFor(rows, 'docs'), 'docs');
  assert.equal(targetFor(rows, 'docs/notes.md'), 'docs');
});

test('PanelToolbar exposes a scoped Files drop underline', () => {
  assert.match(source, /function PanelToolbar\(\{[\s\S]*?dropActive = false,[\s\S]*?onDragEnter,[\s\S]*?onDragLeave,[\s\S]*?onDragOver,[\s\S]*?onDrop,/u);
  assert.match(source, /\.\.\.\(dropActive \? \{ boxShadow: 'inset 0 -2px 0 var\(--dsw-alias-state-business-primary\)' \} : null\)/u);
});

test('Project toolbar reuses the existing OS upload path', () => {
  assert.match(source, /const toolbarDropDirectory = projectToolbarDropDirectory\(projectRows, selectedPath\);/u);
  assert.match(source, /if \(typeof onUpload === 'function'\) \{\s+onUpload\(captureDroppedWorkspaceHandles\(event\.dataTransfer\), toolbarDropDirectory\);/u);
  assert.match(source, /dropActive: toolbarDropActive,/u);
});
