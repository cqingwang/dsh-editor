import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadTypeScriptModule } from './ts-source.mjs';

const root = new URL('../', import.meta.url);
const modelSource = await readFile(new URL('src/client/components/project/workspace-directory-model.ts', root), 'utf8');
const pickerSource = await readFile(
  new URL('src/client/components/project/WorkspaceDirectoryPicker.tsx', root),
  'utf8',
);
const helpers = loadTypeScriptModule(modelSource, ['displayWorkspaceDirectoryPath', 'resolveWorkspaceDirectoryPath']);

test('home is displayed as ~ while host requests keep the absolute path', () => {
  assert.equal(helpers.displayWorkspaceDirectoryPath('/Users/chan', '/Users/chan'), '~');
  assert.equal(helpers.displayWorkspaceDirectoryPath('/Users/chan/src', '/Users/chan'), '~/src');
  assert.equal(helpers.resolveWorkspaceDirectoryPath('~', '/Users/chan'), '/Users/chan');
  assert.equal(helpers.resolveWorkspaceDirectoryPath('~/src', '/Users/chan'), '/Users/chan/src');
  assert.equal(helpers.resolveWorkspaceDirectoryPath('/tmp/project', '/Users/chan'), '/tmp/project');
});

test('the picker opens at home and exposes an enter-selected-directory action', () => {
  assert.match(pickerSource, /void loadRootDirectory\(\);/u);
  assert.match(pickerSource, /setPathDraft\(displayWorkspaceDirectoryPath\(listing\.path, listing\.home\)\)/u);
  assert.match(pickerSource, /const homePathRef = React\.useRef\(''\)/u);
  assert.doesNotMatch(pickerSource, /setHomePath\(/u);
  assert.match(pickerSource, /const enterPathDirectory =/u);
  assert.match(pickerSource, /disabled=\{pathDraft\.trim\(\) === '' \|\| creating\}/u);
  assert.match(pickerSource, /aria-label=\{t\('editor\.workspaceDirectoryEnter'\)\}/u);
});

test('show-hidden lives at the far right of the directory row instead of its own row', () => {
  const formStart = pickerSource.indexOf('onSubmit={submitPath}');
  const formEnd = pickerSource.indexOf('</form>', formStart);
  assert.ok(formStart >= 0 && formEnd > formStart);
  const row = pickerSource.slice(formStart, formEnd);
  assert.match(row, /editor\.workspaceDirectoryEnter/u);
  assert.match(row, /editor\.workspaceDirectoryShowHidden/u);
  assert.match(row, /editor\.workspaceDirectoryShowHiddenShort/u);
  assert.match(row, /marginLeft: 'auto'/u);
});
