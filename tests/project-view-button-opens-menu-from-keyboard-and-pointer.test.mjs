import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../src/client/components/project/ProjectPanel.tsx', import.meta.url), 'utf8');
const viewButton = source.slice(
  source.indexOf("className='dsh-editor-project-view-button'"),
  source.indexOf("icon='chevronDown'", source.indexOf("className='dsh-editor-project-view-button'")),
);

test('Project View reuses one menu builder for click and keyboard gestures', () => {
  assert.match(source, /const openProjectViewMenu = \(/u);
  assert.match(source, /const rect = button\.getBoundingClientRect\(\);/u);
  assert.match(viewButton, /onClick=\{\(event\) => openProjectViewMenu\(event\.currentTarget\)\}/u);
  assert.match(
    viewButton,
    /event\.key === 'ContextMenu' \|\| \(event\.shiftKey === true && event\.key === 'F10'\)/u,
  );
  assert.match(
    viewButton,
    /onContextMenu=\{\(event\) => \{\s+event\.preventDefault\(\);\s+event\.stopPropagation\(\);\s+openProjectViewMenu\(event\.currentTarget, true\);/s,
  );
});
