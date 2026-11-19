import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadTypeScriptModule } from './ts-source.mjs';

const root = new URL('../', import.meta.url);
const modelSource = await readFile(
  new URL('src/client/components/project/workspace-directory-model.ts', root),
  'utf8',
);
const pickerSource = await readFile(
  new URL('src/client/components/project/WorkspaceDirectoryPicker.tsx', root),
  'utf8',
);
const helpers = loadTypeScriptModule(modelSource, ['directoryPathHasHiddenSegment']);

test('hidden path segments are detected without treating dot path names as hidden', () => {
  assert.equal(helpers.directoryPathHasHiddenSegment('/Users/test/.codex'), true);
  assert.equal(helpers.directoryPathHasHiddenSegment('/Users/test/project/.git/config'), true);
  assert.equal(helpers.directoryPathHasHiddenSegment('/Users/test/Documents'), false);
  assert.equal(helpers.directoryPathHasHiddenSegment('/Users/test/../Documents'), false);
  assert.equal(helpers.directoryPathHasHiddenSegment('/'), false);
  assert.equal(helpers.directoryPathHasHiddenSegment(''), false);
});

test('revealing an explicit hidden directory enables its visibility filter', () => {
  assert.match(pickerSource, /directoryPathHasHiddenSegment/u);
  assert.match(
    pickerSource,
    /if \(directoryPathHasHiddenSegment\(targetListing\.path\)\) setShowHidden\(true\);/u,
  );
});
