import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const readme = await readFile(new URL('../README.md', import.meta.url), 'utf8');
const actionSection = readme.slice(
  readme.indexOf('Search Everywhere 的 Actions 提供'),
  readme.indexOf('\n- `Find in Files` 与 `Replace in Files`', readme.indexOf('Search Everywhere 的 Actions 提供')),
);

test('README search action inventory matches the implemented 33-entry surface', () => {
  assert.match(actionSection, /33 个搜索\/替换入口/);
  for (const label of [
    'Search Everywhere',
    'Go to File',
    'Recent Files',
    'Text…',
    'Find Action…',
    'Show Search History',
    'Recent Find Usages',
    'Find…',
    'Find',
    'Replace…',
    'Search Structurally…',
    'Replace Structurally…',
    'Incremental Search',
    'Search in Selection Only',
    'Replace in Selection Only',
    'Find Usages…',
    'Show Usages',
    'Find Usages Settings…',
    'Find Usages in File',
    'Highlight Usages in File',
    'Search with Google',
    'Next Occurrence of the Word at Caret',
    'Previous Occurrence of the Word at Caret',
    'Select All Occurrences',
    'Add Selection for Next Occurrence',
    'Unselect Occurrence',
    'Find Next / Move to Next Occurrence',
    'Find Previous / Move to Previous Occurrence',
    'Search In Changes',
    'Find in Files',
    'Replace Selection in Files',
    'Find in Files…',
    'Replace in Files…',
  ]) {
    assert.ok(actionSection.includes(label), `README is missing action ${label}`);
  }
});

test('README keeps IDEA identities and legacy search aliases', () => {
  for (const alias of ['Structural Search', 'Structural Replace', 'Search Web', 'Find Word at Caret', 'Select Next Occurrence', 'Unselect Previous Occurrence']) {
    assert.ok(actionSection.includes(alias), `README is missing legacy alias ${alias}`);
  }
  assert.doesNotMatch(actionSection, /链。，/);
});
