import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { extractJavaScriptFunctionSource } from './ts-source.mjs';

const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');

test('Unsaved open-file content replaces stale disk matches', () => {
  const helpers = new Function(
    `${extractFunction('editorFindResult')};` +
      `${extractFunction('textSearchFileMatches')};` +
      `${extractFunction('findToolPathMatchesScope')};` +
      `${extractFunction('mergeFindToolDirtyMatches')};` +
      'return { textSearchFileMatches, mergeFindToolDirtyMatches };',
  )();
  const unsaved = helpers.textSearchFileMatches(
    'README.md',
    'first line\nfreshNeedle only in buffer\n',
    'needle',
    { caseSensitive: false },
    123,
    200,
  );
  assert.equal(unsaved.matches.length, 1);
  assert.equal(unsaved.matches[0].line, 2);
  assert.equal(unsaved.matches[0].dirty, true);
  assert.match(unsaved.matches[0].preview, /freshNeedle/);

  const merged = helpers.mergeFindToolDirtyMatches(
    [{ path: 'README.md', line: 1, column: 1, preview: 'stale disk needle', mtime: 123 }],
    [{ path: 'README.md', content: 'freshNeedle only in buffer\n', mtime: 123 }],
    'needle',
    { caseSensitive: false },
    { directory: '', preset: 'changedFiles', allowedPaths: ['README.md'] },
    200,
  );
  assert.equal(merged.matches.length, 1);
  assert.equal(merged.matches[0].dirty, true);
  assert.equal(merged.matches[0].line, 1);
  assert.doesNotMatch(merged.matches[0].preview, /stale/);
});

test('Dirty-file merge respects scope, file masks and the shared match cap', () => {
  const helpers = new Function(
    `${extractFunction('editorFindResult')};` +
      `${extractFunction('textSearchFileMatches')};` +
      `${extractFunction('basename')};` +
      `${extractFunction('normalizeFileExtensionFilter')};` +
      `${extractFunction('fileExtensionFilterMatches')};` +
      `${extractFunction('findToolPathMatchesScope')};` +
      `${extractFunction('mergeFindToolDirtyMatches')};` +
      'return mergeFindToolDirtyMatches;',
  )();
  const merged = helpers(
    [{ path: 'src/clean.ts', line: 1, column: 1, preview: 'needle' }],
    [
      { path: 'src/dirty.ts', content: 'needle\nneedle\nneedle\n' },
      { path: 'docs/dirty.md', content: 'needle\n' },
    ],
    'needle',
    { caseSensitive: false, fileMask: '*.ts' },
    { directory: 'src', preset: 'projectFiles', allowedPaths: null },
    2,
  );
  assert.equal(merged.matches.length, 2);
  assert.ok(merged.matches.every((match) => match.path.startsWith('src/')));
  assert.equal(merged.matches.filter((match) => match.dirty === true).length, 2);
  assert.equal(merged.truncated, true);
});

test('Find merges dirty buffers after host search and previews their live content', () => {
  assert.match(source, /mergeFindToolDirtyMatches\(\s*hostMatches/);
  assert.match(source, /findToolLivePreviewContent\(\s*active\?\.path,\s*openFiles/);
  assert.match(source, /openFiles,\n\s+changedFilePaths:/);
});

function extractFunction(name) {
  return extractJavaScriptFunctionSource(source, name);
}
