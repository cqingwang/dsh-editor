import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'src/client/components/commit/CommitLogDetailPane.tsx'), 'utf8');

test('Commit Log double-click uses the same EditSource semantics as F4', () => {
  assert.match(source, /onDoubleClick=\{\(\) => \{\s+if \(localExists\) onEditSource\?\.\(file\.path\);\s+\}\}/s);
});
