import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const projectSource = await readFile(
  new URL('../src/client/components/project/ProjectPanel.tsx', import.meta.url),
  'utf8',
);

test('inline create reclaims its input after the Project menu restores focus', () => {
  assert.match(projectSource, /const createInputRef = React\.useRef<HTMLInputElement \| null>\(null\);/u);
  assert.match(
    projectSource,
    /if \(createState === null\) return undefined;[\s\S]*?window\.setTimeout\(\(\) => createInputRef\.current\?\.focus\(\), 40\)/u,
  );
  assert.match(projectSource, /ref=\{createInputRef\}/u);
  assert.match(projectSource, /window\.clearTimeout\(timer\)/u);
});

test('Escape cancelling inline create returns keyboard ownership to the Project tree', () => {
  assert.match(
    projectSource,
    /event\.key === 'Escape'[\s\S]*?onCreateCancel\(\);[\s\S]*?window\.setTimeout\(\(\) => treeRef\.current\?\.focus\(\), 0\);/u,
  );
});
