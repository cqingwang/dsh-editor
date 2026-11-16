import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');

function extract(name) {
  const marker = `    function ${name}(`;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `${name} should exist`);
  let index = source.indexOf('{', start);
  let depth = 0;
  for (; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    else if (source[index] === '}') {
      depth -= 1;
      if (depth === 0) break;
    }
  }
  return source.slice(start, index + 1);
}

const viewHelpers = new Function(
  `${extract('normalizeProjectView')}\n${extract('projectViewIsTree')}\n${extract('projectViewRows')}\n`
  + 'return { normalizeProjectView, projectViewIsTree, projectViewRows };',
)();
const { normalizeProjectView, projectViewIsTree, projectViewRows } = viewHelpers;

const projectRows = [
  { name: 'demo', path: '', kind: 'directory', root: true, depth: 0 },
  { name: 'a.ts', path: 'src/a.ts', kind: 'file', depth: 1 },
  { name: 'b.md', path: 'README.md', kind: 'file', depth: 1 },
];
const openFiles = [
  { path: 'README.md' },
  { path: 'src/a.ts' },
];
const git = {
  changes: [
    { path: 'src/a.ts', status: 'MM' },
    { path: 'README.md', status: 'M' },
    { path: 'src/a.ts', status: 'M' },
  ],
};

test('Project Files reuses the real project row model', () => {
  assert.equal(normalizeProjectView('projectFiles'), 'projectFiles');
  assert.equal(projectViewIsTree('projectFiles'), true);
  assert.equal(projectViewIsTree('openFiles'), false);
  assert.equal(projectViewRows('projectFiles', projectRows, openFiles, git), projectRows);
});

test('Open Files is a filtered row model over the existing open tab list', () => {
  const rows = projectViewRows('openFiles', projectRows, openFiles, git);
  assert.deepEqual(rows.map((row) => row.path), ['README.md', 'src/a.ts']);
  assert.ok(rows.every((row) => row.kind === 'file' && row.depth === 0));
});

test('All Changed Files deduplicates git paths and sorts them stably', () => {
  const rows = projectViewRows('changedFiles', projectRows, openFiles, git);
  assert.deepEqual(rows.map((row) => row.path), ['README.md', 'src/a.ts']);
  assert.ok(rows.every((row) => row.kind === 'file' && row.depth === 0));
});

test('unsupported IDEA views cannot become the active filtered-row source', () => {
  for (const view of ['project', 'packages', 'production', 'tests', 'scratches', 'bogus']) {
    assert.equal(normalizeProjectView(view), 'projectFiles');
    assert.equal(projectViewRows(view, projectRows, openFiles, git), projectRows);
  }
});

test('the Project title exposes only the three backed IDEA views', () => {
  const start = source.indexOf('function ProjectPanel(');
  const end = source.indexOf('/** IDEA-style context menu', start);
  const panel = source.slice(start, end);
  assert.match(panel, /titleAction:/);
  assert.match(panel, /projectViewDefinitions\(t\)/);
  assert.match(panel, /editor\.projectViewProjectFiles/);
  assert.match(panel, /editor\.projectViewOpenFiles/);
  assert.match(panel, /editor\.projectViewChangedFiles/);
  assert.doesNotMatch(panel, /editor\.projectViewPackages/);
  assert.doesNotMatch(panel, /editor\.projectViewProduction/);
  assert.match(panel, /disabled: definition\.available !== true/);
});

test('filtered views do not run recursive project search or project tree actions', () => {
  const start = source.indexOf('function ProjectPanel(');
  const end = source.indexOf('/** IDEA-style context menu', start);
  const panel = source.slice(start, end);
  assert.match(panel, /filteredView === true/);
  assert.match(panel, /supportsExpansion !== true/);
  assert.match(panel, /projectRows/);
});
