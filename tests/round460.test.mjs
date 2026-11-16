import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');

function block(startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  assert.notEqual(start, -1, `${startMarker} should exist`);
  assert.notEqual(end, -1, `${endMarker} should exist`);
  return source.slice(start, end);
}

test('diagnostics retain a bounded ring of recent user actions', () => {
  assert.match(source, /const editorActionRing = \[\]/);
  assert.match(source, /editorActionRing\.splice\(0, editorActionRing\.length - 12\)/);
  const action = block('function recordDiagnosticAction(', 'function reportEditorDiagnostic(');
  assert.match(action, /event\.target/);
  assert.match(action, /aria-label/);
  assert.match(action, /contenteditable/);
  assert.match(action, /event\.key/);
});

test('runtime failure records include the action sequence', () => {
  assert.match(source, /recentActions: editorActionRing\.slice\(-12\)/);
  assert.match(source, /reportEditorDiagnostic\('window-error', \{[\s\S]*?recentActions:/);
  assert.match(source, /reportEditorDiagnostic\('unhandled-rejection', \{[\s\S]*?recentActions:/);
});

test('action listeners are installed in capture phase and removed on dispose', () => {
  assert.match(source, /document\.addEventListener\('click', recordDiagnosticAction, true\)/);
  assert.match(source, /document\.addEventListener\('keydown', recordDiagnosticAction, true\)/);
  assert.match(source, /document\.removeEventListener\('click', recordDiagnosticAction, true\)/);
  assert.match(source, /document\.removeEventListener\('keydown', recordDiagnosticAction, true\)/);
});

test('known Monaco cancellation is consumed instead of logged', () => {
  const rejection = block('const onUnhandledRejection =', 'observer.observe(document.body');
  assert.match(rejection, /isMonacoCancellation\(event\.reason, stack\)/);
  assert.match(rejection, /event\.preventDefault\(\)/);
  assert.doesNotMatch(rejection, /reportEditorDiagnostic\('unhandled-rejection', \{[\s\S]*?Canceled/);
});
