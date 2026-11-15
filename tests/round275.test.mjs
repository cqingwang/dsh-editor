import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'lib/client.js'), 'utf8');

test('an open Project search reclaims focus after appearance settings change', () => {
  const panel = source.slice(source.indexOf('function ProjectPanel('), source.indexOf('/**\n     * IDEA-style context menu'));
  assert.match(panel, /if \(!searchOpen\) return undefined;/);
  assert.match(panel, /window\.setTimeout\(\(\) => searchRef\.current\?\.focus\(\), 160\)/);
  assert.match(panel, /\}, \[compactDirectories, searchOpen, showExcludedFiles, showHidden, sortMode\]\);/);
});
