import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'lib/client.js'), 'utf8');

function projectPanel() {
  return source.slice(source.indexOf('function ProjectPanel('), source.indexOf('/**\n     * IDEA-style context menu'));
}

test('Select Opened File is disabled until an editor has an active file', () => {
  const panel = projectPanel();
  assert.match(panel, /hasActiveFile,/);
  assert.match(panel, /id: 'reveal',[\s\S]*?label: t\('editor\.reveal'\),[\s\S]*?disabled: hasActiveFile !== true,[\s\S]*?onClick: onReveal/);
});

test('EditorWorkspace wires the real active file state into ProjectPanel', () => {
  assert.match(source, /hasActiveFile: activePath !== null/);
});

test('Open in Right Split is backed by a real second editor group', () => {
  assert.match(source, /const editorRef = React\.useRef\(null\);/);
  assert.match(source, /const containerRef = React\.useRef\(null\);/);
  assert.match(source, /const modelsRef = React\.useRef\(new Map\(\)\);/);
  assert.match(source, /const splitEditorRef = React\.useRef\(null\);/);
  assert.match(source, /const splitContainerRef = React\.useRef\(null\);/);
  assert.match(source, /id: 'openRightSplit'/);
});
