import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = (readFileSync(join(root, 'tests/fixtures/project-panel.legacy.js'), 'utf8') + '\n' + readFileSync(join(root, 'lib/client.js'), 'utf8'));

function extractFunction(name) {
  const start = source.indexOf(`    function ${name}(`);
  assert.notEqual(start, -1, `${name} is missing`);
  let paramsIndex = source.indexOf('(', start);
  let paramsDepth = 0;
  for (; paramsIndex < source.length; paramsIndex += 1) {
    if (source[paramsIndex] === '(') paramsDepth += 1;
    else if (source[paramsIndex] === ')') {
      paramsDepth -= 1;
      if (paramsDepth === 0) break;
    }
  }
  let index = source.indexOf('{', paramsIndex);
  let depth = 0;
  for (; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    else if (source[index] === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  throw new Error(`unbalanced ${name}`);
}

const projectCanExpandAll = new Function(
  `${extractFunction('projectCanExpandAll')}; return projectCanExpandAll;`,
)();
const projectCanCollapseAll = new Function(
  `${extractFunction('projectCanCollapseAll')}; return projectCanCollapseAll;`,
)();

test('Expand All is disabled only when every known directory is already expanded', () => {
  const entries = [
    { path: 'src', kind: 'directory' },
    { path: 'README.md', kind: 'file' },
  ];
  const children = {
    src: [{ path: 'src/nested', kind: 'directory' }],
    'src/nested': [],
  };
  assert.equal(projectCanExpandAll(entries, children, new Set([''])), true);
  assert.equal(projectCanExpandAll(entries, children, new Set(['src'])), true);
  assert.equal(projectCanExpandAll(entries, children, new Set(['src', 'src/nested'])), false);
  assert.equal(projectCanExpandAll([{ path: 'README.md', kind: 'file' }], {}, new Set([''])), false);
});

test('Collapse All is disabled when the tree has no expanded directory', () => {
  assert.equal(projectCanCollapseAll(new Set()), false);
  assert.equal(projectCanCollapseAll(new Set([''])), true);
  assert.equal(projectCanCollapseAll(new Set(['src'])), true);
});

test('Project keeps IDEA expander states without duplicating Expand All in the toolbar', () => {
  assert.doesNotMatch(source, /id: 'expandAll', icon: 'expand', label: t\('editor\.expandAll'\)/);
  assert.match(source, /id: 'collapse', group: 'navigation', icon: 'collapse', label: t\('editor\.collapseAll'\), disabled: !canCollapseAll/);
  assert.match(source, /\{ id: 'expandAll', label: t\('editor\.expandAll'\), disabled: !projectExpandAllAvailable,/);
  assert.match(source, /const projectExpandAllAvailable = projectTreeActionsAvailable\s+&& projectCanExpandAll\(entries, children, expanded\)/);
  assert.match(source, /canCollapseAll: projectCanCollapseAll\(expanded\)/);
});
