import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const projectSource = await readFile(
  new URL('../src/client/components/project/ProjectPanel.tsx', import.meta.url),
  'utf8',
);

test('rename reclaims focus after the Project menu and suppresses the initial blur commit', () => {
  assert.match(projectSource, /const renameInputRef = React\.useRef<HTMLInputElement \| null>\(null\);/u);
  assert.match(projectSource, /const renameReadyRef = React\.useRef\(false\);/u);
  assert.match(
    projectSource,
    /renameReadyRef\.current = false;[\s\S]*?window\.setTimeout\(\(\) => \{[\s\S]*?renameInputRef\.current\?\.focus\(\);[\s\S]*?renameReadyRef\.current = true;[\s\S]*?\}, 40\);/u,
  );
  assert.match(projectSource, /ref=\{renameInputRef\}/u);
  assert.match(projectSource, /data-dsh-project-rename=''/u);
  assert.match(projectSource, /if \(!renameReadyRef\.current\) return;[\s\S]*?onRenameCommit\(\);/u);
});

test('Escape cancelling rename disables blur commit and returns focus to the Project tree', () => {
  assert.match(
    projectSource,
    /event\.key === 'Escape'[\s\S]*?renameReadyRef\.current = false;[\s\S]*?onRenameCancel\(\);[\s\S]*?window\.setTimeout\(\(\) => treeRef\.current\?\.focus\(\), 0\);/u,
  );
});
