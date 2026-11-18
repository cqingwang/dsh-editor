import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const client = readFileSync(join(root, 'lib/client.js'), 'utf8');
const host = readFileSync(join(root, 'lib/index.js'), 'utf8');

test('host defines excluded project directories and hides them unless requested', () => {
  assert.match(host, /const PROJECT_EXCLUDED_DIRECTORIES = new Set\(\[\.\.\.WALK_IGNORED\]\.filter\(\(name\) => name !== '\.git'\)\);/);
  assert.match(host, /if \(options\.showExcluded !== true && PROJECT_EXCLUDED_DIRECTORIES\.has\(row\.name\)\) continue;/);
  assert.match(host, /showExcluded: body\?\.showExcluded !== false/);
});

test('Project stores Show Excluded Files independently and exposes it under Appearance', () => {
  assert.match(
    client,
    /const \[showExcludedFiles, setShowExcludedFiles\] = React\.useState\(\(\) => readStoredText\('dsh-editor\.project\.showExcludedFiles', '1'\) !== '0'\);/,
  );
  assert.match(client, /\{ id: 'showExcludedFiles', label: t\('editor\.showExcludedFiles'\), shortcut: showExcludedFiles \? '✓' : ''/);
  const appearance = client.slice(client.indexOf("id: 'appearance'"), client.indexOf('onCreateChange:', client.indexOf("id: 'appearance'")));
  assert.match(appearance, /id: 'showExcludedFiles'/);
});

test('every Project tree list request carries the Show Excluded Files preference', () => {
  const requests = client.match(/callFs\(\{ op: 'list', path[^\n]*showHidden, sort: sortMode, foldersFirst, showExcluded: showExcludedFiles \}\)/g) ?? [];
  assert.ok(requests.length >= 7, `expected all Project list calls to carry showExcluded, found ${requests.length}`);
});
