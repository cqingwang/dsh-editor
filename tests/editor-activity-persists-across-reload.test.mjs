import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const foundationSource = await readFile(new URL('../src/client/foundation.ts', import.meta.url), 'utf8');
const workspaceSource = await readFile(new URL('../src/client/editor-workspace.tsx', import.meta.url), 'utf8');

test('Editor Project/Commit activity uses one validated persistent key', () => {
  assert.match(foundationSource, /const EDITOR_ACTIVITY_STORAGE_KEY = 'dsh-editor\.editor\.activity';/u);
  assert.match(
    foundationSource,
    /readLastEditorActivity\(\): string \{[\s\S]*?stored === 'project' \|\| stored === 'commit'[\s\S]*?writeLastEditorActivity\(activity: string\): void \{[\s\S]*?activity === 'commit' \? 'commit' : 'project'[\s\S]*?window\.localStorage\.setItem\(EDITOR_ACTIVITY_STORAGE_KEY, normalized\)/u,
  );
  assert.match(workspaceSource, /readLastEditorActivity\(\) === 'commit' \? 'commit' : 'project'/u);
  assert.match(workspaceSource, /writeLastEditorActivity\(activity\)/u);
});
