import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const client = readFileSync(join(root, 'src/client/editor-workspace.tsx'), 'utf8');
const options = readFileSync(join(root, 'src/client/components/project/project-options-menu.ts'), 'utf8');
const host = readFileSync(join(root, 'lib/index.js'), 'utf8');

test('host defines excluded project directories and hides them unless requested', () => {
  assert.match(host, /const PROJECT_EXCLUDED_DIRECTORIES = new Set\(\[\.\.\.WALK_IGNORED\]\.filter\(\(name\) => name !== '\.git'\)\);/);
  assert.match(host, /if \(options\.showExcluded !== true && PROJECT_EXCLUDED_DIRECTORIES\.has\(row\.name\)\) continue;/);
  assert.match(host, /showExcluded: body\?\.showExcluded !== false/);
});

test('Project stores Show Excluded Files independently and exposes it under Appearance', () => {
  assert.match(
    client,
    /const \[\s*showExcludedFiles,\s*setShowExcludedFiles,?\s*\] = React\.useState\(\s*\(\) => readStoredText\('dsh-editor\.project\.showExcludedFiles', '1'\) !== '0',?\s*\)/,
  );
  assert.match(options, /id: 'showExcludedFiles',\s+label: t\('editor\.showExcludedFiles'\),\s+shortcut: showExcludedFiles \? '✓' : ''/);
  const appearance = options.slice(options.indexOf("id: 'appearance'"));
  assert.match(appearance, /id: 'showExcludedFiles'/);
});

test('every Project tree list request carries the Show Excluded Files preference', () => {
  const requests = client.match(/showExcluded: showExcludedFiles/g) ?? [];
  assert.ok(requests.length >= 7, `expected all Project list calls to carry showExcluded, found ${requests.length}`);
});
