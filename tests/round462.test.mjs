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

test('Monaco cancellation is recognised from its message and stack', () => {
  const helper = block('function isMonacoCancellation(', '/**\n     * Remember a small');
  const isMonacoCancellation = new Function(`${helper}\nreturn isMonacoCancellation;`)();
  const canceled = new Error('Canceled: Canceled');
  canceled.stack = [
    'Canceled: Canceled',
    '    at i.cancel (http://127.0.0.1:3081/api/dsh-editor/monaco/vs/editor/editor.main.js:122:13889)',
    '    at i.dispose (http://127.0.0.1:3081/api/dsh-editor/monaco/vs/editor/editor.main.js:122:14018)',
  ].join('\n');

  assert.equal(isMonacoCancellation(canceled, canceled.stack), true);
  assert.equal(isMonacoCancellation('Canceled: Canceled', canceled.stack), true);
  assert.equal(isMonacoCancellation(new Error('Canceled'), `${canceled.stack}\n    at editor.main.js:1:1`), true);
  assert.equal(isMonacoCancellation(new TypeError('Canceled: Canceled'), canceled.stack), false);
  assert.equal(isMonacoCancellation(canceled, 'Error: Canceled: Canceled\n    at app.js:10:2'), false);
});

test('the rejection handler consumes only the known Monaco cancellation', () => {
  const rejection = block('const onUnhandledRejection =', 'observer.observe(document.body');
  assert.match(rejection, /isMonacoCancellation\(event\.reason, stack\)/);
  assert.match(rejection, /event\.preventDefault\(\)/);
  assert.match(rejection, /reportEditorDiagnostic\(\s*'unhandled-rejection'/u);
  assert.match(
    rejection,
    /event\.preventDefault\(\);[\s\S]*?return;[\s\S]*?reportEditorDiagnostic\(\s*'unhandled-rejection'/u,
  );
});
