import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'lib/client.js'), 'utf8');
const workspaceSource = readFileSync(join(root, 'src/client/editor-workspace.tsx'), 'utf8');
const foundationSource = readFileSync(join(root, 'src/client/foundation.ts'), 'utf8');

function commitDiffWiring() {
  const start = source.indexOf('onSelectDiff: (target) => {');
  const end = source.indexOf('onShowCombinedDiff:', start);
  assert.notEqual(start, -1, 'Commit diff wiring is missing');
  assert.notEqual(end, -1, 'Commit diff wiring end is missing');
  return source.slice(start, end);
}

test('Commit diff entry points keep the Commit tool window visible', () => {
  const wiring = commitDiffWiring();
  assert.match(wiring, /setActivity\('commit'\)/);
  assert.match(wiring, /setPanelVisible\(true\)/);
  assert.match(wiring, /setDiffActive\(true\)/);
  assert.match(wiring, /setDiffTarget\(same \? null : target\)/);
  assert.match(wiring, /setDiffTarget\(target\)/);
});

test('the activity guard belongs to both Commit diff entry points', () => {
  const wiring = commitDiffWiring();
  const select = wiring.slice(wiring.indexOf('onSelectDiff:'), wiring.indexOf('onShowDiff:'));
  const show = wiring.slice(wiring.indexOf('onShowDiff:'));
  for (const block of [select, show]) {
    assert.match(block, /setActivity\('commit'\)/);
    assert.match(block, /setPanelVisible\(true\)/);
  }
});

test('Enter in the Changes tree keeps the Commit tool window active', () => {
  const controllerStart = source.indexOf('const onChangesKeyDown = React.useCallback');
  const controllerEnd = source.indexOf('const onChangesKeyUp = React.useCallback', controllerStart);
  assert.notEqual(controllerStart, -1, 'Changes keyboard controller is missing');
  assert.notEqual(controllerEnd, -1, 'Changes keyboard controller end is missing');
  const controller = source.slice(controllerStart, controllerEnd);
  const start = controller.indexOf("if (event.key === 'Enter') {");
  const end = controller.indexOf("if (event.key === ' ') {", start);
  assert.notEqual(start, -1, 'Enter handler is missing');
  assert.notEqual(end, -1, 'Enter handler end is missing');
  const handler = controller.slice(start, end);
  assert.match(handler, /setActivity\('commit'\)/);
  assert.match(handler, /setPanelVisible\(true\)/);
  assert.match(handler, /setDiffTarget\(\{ path: current\.path, staged: current\.staged === true \}\)/);
});

test('a non-null diff target reasserts the Commit tool window', () => {
  const start = source.indexOf('if (diffTarget !== null) {');
  const end = source.indexOf('}, [diffTarget]);', start);
  assert.notEqual(start, -1, 'diffTarget effect is missing');
  assert.notEqual(end, -1, 'diffTarget effect end is missing');
  const effect = source.slice(start, end);
  assert.match(effect, /setDiffActive\(true\)/);
  assert.match(effect, /setActivity\('commit'\)/);
  assert.match(effect, /setPanelVisible\(true\)/);
});

test('the selected tool window survives an EditorWorkspace remount', () => {
  const declaration = foundationSource.indexOf("let lastEditorActivity = 'project';");
  const workspace = workspaceSource.indexOf('function EditorWorkspace(');
  assert.ok(declaration >= 0, 'activity persistence declaration is missing');
  assert.ok(
    foundationSource.indexOf('export function readLastEditorActivity()') > declaration,
    'activity persistence getter must live beside its module state',
  );
  assert.ok(workspace > 0, 'EditorWorkspace is missing');
  assert.match(foundationSource, /export function readLastEditorActivity\(\)(?::\s*[^{]+)? \{/);
  assert.match(foundationSource, /export function writeLastEditorActivity\(activity:[^)]+\)(?::\s*[^{]+)? \{/);
  assert.match(
    workspaceSource,
    /const \[activity, setActivity\] = React\.useState(?:<[^>]+>)?\(\s*\(\) =>\s*readLastEditorActivity\(\)[\s\S]{0,80}?\);/,
  );
  assert.match(workspaceSource, /writeLastEditorActivity\(activity\);/);
});
