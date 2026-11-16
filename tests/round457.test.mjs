import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const client = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');
const host = await readFile(new URL('../lib/index.js', import.meta.url), 'utf8');

test('the browser keeps bounded diagnostics for real Editor runtime failures', () => {
  assert.match(client, /function reportEditorDiagnostic\(/);
  assert.match(client, /reportEditorDiagnostic\('react-render-error'/);
  assert.match(client, /reportEditorDiagnostic\('window-error'/);
  assert.match(client, /reportEditorDiagnostic\('unhandled-rejection'/);
  assert.doesNotMatch(client, /reportEditorDiagnostic\('host-unhealthy'/);
  assert.doesNotMatch(client, /reportEditorDiagnostic\('host-rebuild'/);
  assert.match(client, /api\/dsh-editor\/diagnostics/);
  assert.match(client, /editorDiagnosticRing\.splice\(0, editorDiagnosticRing\.length - 50\)/);
});

test('diagnostics avoid sending conversation and file content', () => {
  const block = client.slice(
    client.indexOf('function reportEditorDiagnostic('),
    client.indexOf('/** xterm constructors, loaded at most once. */'),
  );
  assert.doesNotMatch(block, /innerHTML/);
  assert.doesNotMatch(block, /file\.content/);
  assert.match(block, /JSON\.stringify\(\{ records: \[record\] \}\)/);
});

test('the host appends bounded JSONL diagnostics under DSH_HOME logs', () => {
  assert.match(host, /appendFile/);
  assert.match(host, /homedir/);
  assert.match(host, /dsh-editor-diagnostics\.jsonl/);
  assert.match(host, /path: '\/api\/dsh-editor\/diagnostics'/);
  assert.match(host, /methods: \['POST'\]/);
  assert.match(host, /\.slice\(-20\)/);
  assert.match(host, /64 \* 1024/);
  assert.match(host, /appendFile\(EDITOR_DIAGNOSTICS_FILE, lines\.join\('\\n'\) \+ '\\n', 'utf8'\)/);
});
