import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'lib/client.js'), 'utf8');

function diffPreview() {
  const start = source.indexOf('function DiffPreview(');
  const end = source.indexOf('\n    function ', start + 10);
  assert.notEqual(start, -1, 'DiffPreview is missing');
  assert.notEqual(end, -1, 'DiffPreview end marker is missing');
  return source.slice(start, end);
}

test('DiffPreview initializes diffLoadedRef before render reads it', () => {
  const diff = diffPreview();
  const declaration = diff.indexOf('const diffLoadedRef = React.useRef(null);');
  const firstRead = diff.indexOf('diffLoadedRef.current');
  assert.notEqual(declaration, -1, 'diffLoadedRef declaration is missing');
  assert.notEqual(firstRead, -1, 'diffLoadedRef is never read');
  assert.ok(
    declaration < firstRead,
    'diffLoadedRef must be initialized before diffUnavailable reads it; otherwise the first diff render throws a TDZ ReferenceError and unmounts the workspace',
  );
});

test('DiffPreview declares the binary host visibility before rendering it', () => {
  const diff = diffPreview();
  const declaration = diff.indexOf('const hidden = target === null || state.binary;');
  const firstRead = diff.indexOf('display: hidden ?');
  assert.notEqual(declaration, -1, 'binary diff host visibility is undeclared');
  assert.notEqual(firstRead, -1, 'binary diff host visibility is never used');
  assert.ok(
    declaration < firstRead,
    'hidden must be declared before the diff host renders; otherwise opening a binary change throws a ReferenceError and unmounts the workspace',
  );
});
