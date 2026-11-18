import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');
const statusBlock = await readFile(
  new URL('../src/client/components/editor/EditorStatusBar.tsx', import.meta.url),
  'utf8',
);

test('The file path moves into the compact status bar after caret position', () => {
  assert.match(source, /const statusPath = statusFile === null[\s\S]*?\$\{root\}\/\$\{statusFile\.path\}/u);
  assert.match(source, /const statusFile = splitFocused \? splitFile : activeFile \?\? splitFile/u);
  assert.match(statusBlock, /data-dsh-editor-status-path/u);
  assert.match(statusBlock, /styles\.statusPath/u);
  assert.ok(
    statusBlock.indexOf('<EditorStatusFacts') < statusBlock.indexOf('data-dsh-editor-status-path'),
    'the status path must follow the line:column item',
  );
});

test('The path row is removed while Markdown modes remain available in the tab strip', () => {
  assert.doesNotMatch(source, /breadcrumbSegments/u);
  assert.doesNotMatch(source, /styles\.breadcrumbBar/u);
  assert.doesNotMatch(source, /t\('editor\.breadcrumb'\)/u);
  assert.doesNotMatch(statusBlock, /MarkdownModeSwitch/u);
  assert.match(source, /styles\.tabStripTrailing[\s\S]*?React\.createElement\(MarkdownModeSwitch/u);
  assert.match(source, /tabStripTrailing:\s*\{[\s\S]*?position: 'sticky',[\s\S]*?right: 0,/u);
});

test('The status bar omits indentation, EOL and saved-state labels', () => {
  assert.doesNotMatch(statusBlock, /fileMode\.insertSpaces/u);
  assert.doesNotMatch(statusBlock, /fileMode\.eol/u);
  assert.doesNotMatch(statusBlock, /editor\.unsaved/u);
  assert.doesNotMatch(statusBlock, /editor\.saved/u);
});

test('Caret position uses the compact localized line:column form', () => {
  assert.ok(source.includes("statusBarPosition: '{line}:{column}'"));
  assert.ok(source.includes("statusBarPosition: '{line}:{column}'"));
  assert.doesNotMatch(source, /statusBarPosition: '\{line\}(?:行|列)[^']*'/u);
});
