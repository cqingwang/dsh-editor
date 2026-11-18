import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'src/client/editor-workspace.tsx'), 'utf8');

test('Project tree uses IDEA EditSource F4 and ⌘↓ for the selected file', () => {
  assert.match(
    source,
    /const editSource =\s+\(event\.key === 'F4'[\s\S]*?current\.kind !== 'directory'\) \{[\s\S]*?event\.preventDefault\(\);[\s\S]*?void openFile\(current\.path\)\.then\(\s+\(\) => window\.setTimeout\(\(\) => editorRef\.current\?\.focus\(\), 0\),\s+\);/,
  );
  assert.match(
    source,
    /const editSource =\s+\(event\.key === 'F4'[\s\S]*?\(event\.metaKey \|\| event\.ctrlKey\)[\s\S]*?event\.key === 'ArrowDown'/,
  );
});

test('Project file row menu omits EditSource while keyboard EditSource remains', () => {
  const menuStart = source.indexOf('const buildTreeMenu = React.useCallback');
  const menuEnd = source.indexOf('const buildCommitFileMenu', menuStart);
  assert.notEqual(menuStart, -1);
  assert.notEqual(menuEnd, -1);
  const menu = source.slice(menuStart, menuEnd);
  assert.doesNotMatch(menu, /t\('editor\.openInEditor'\)/);
  assert.doesNotMatch(menu, /ariaKeyShortcuts: isDirectory \? undefined : 'F4'/);
});
