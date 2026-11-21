import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const editorFindBar = await readFile(
  new URL('../src/client/components/editor/EditorFindBar.tsx', import.meta.url),
  'utf8',
);
const terminalPanel = await readFile(new URL('../src/client/components/terminal/TerminalPanel.tsx', import.meta.url), 'utf8');

function navigationButtons(source) {
  const previous = source.indexOf("label={t('editor.findPrevious')}");
  const next = source.indexOf("label={t('editor.findNext')}");
  assert.ok(previous >= 0, 'previous navigation button is missing');
  assert.ok(next >= 0, 'next navigation button is missing');
  return { previous, next };
}

test('Editor Find follows IDEA previous-before-next navigation order', () => {
  const { previous, next } = navigationButtons(editorFindBar);
  assert.ok(previous < next, 'previous occurrence must precede next occurrence');
  assert.match(editorFindBar, /icon='chevronUp'\s+label=\{t\('editor\.findPrevious'\)\}/u);
  assert.match(editorFindBar, /icon='chevronDown'\s+label=\{t\('editor\.findNext'\)\}/u);
});

test('Terminal Find follows the same IDEA navigation order and direction icons', () => {
  const { previous, next } = navigationButtons(terminalPanel);
  assert.ok(previous < next, 'previous occurrence must precede next occurrence');
  assert.match(terminalPanel, /icon='chevronUp'\s+label=\{t\('editor\.findPrevious'\)\}/u);
  assert.match(terminalPanel, /icon='chevronDown'\s+label=\{t\('editor\.findNext'\)\}/u);
});
