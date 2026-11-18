import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source =
  (await readFile(new URL('./fixtures/project-panel.legacy.js', import.meta.url), 'utf8')) +
  '\n' +
  (await readFile(new URL('../lib/client.js', import.meta.url), 'utf8'));

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
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  assert.fail(`unterminated ${name}`);
}

function projectPanel() {
  const start = source.indexOf('function ProjectPanel(');
  const end = source.indexOf('IDEA-style context menu', start);
  assert.notEqual(start, -1);
  return source.slice(start, end < 0 ? source.length : end);
}

test('Project View exposes only the three backed views', () => {
  const helpers = new Function(
    `${extract('normalizeProjectView')}\n${extract('projectViewDefinitions')}\n` +
      'return { normalizeProjectView, projectViewDefinitions };',
  )();
  const t = (key) => key;
  assert.deepEqual(
    helpers.projectViewDefinitions(t).map((definition) => definition.id),
    ['projectFiles', 'openFiles', 'changedFiles'],
  );
  assert.equal(helpers.normalizeProjectView('projectFiles'), 'projectFiles');
  for (const removed of ['project', 'packages', 'production', 'tests', 'scratches', 'bogus']) {
    assert.equal(helpers.normalizeProjectView(removed), 'projectFiles');
  }
});

test('The Project title copies the real root path and reveals it on hover', () => {
  const panel = projectPanel();
  assert.match(panel, /className: 'dsh-editor-project-root-button'/);
  assert.match(panel, /title: root/);
  assert.match(panel, /copySearchResultText\(root, onNotify, t\)/);
  assert.match(panel, /projectName/);
  assert.doesNotMatch(panel, /`\$\{t\('editor\.project'\)\}:`/);
});

test('The Project view menu keeps its own disclosure target', () => {
  const panel = projectPanel();
  assert.match(panel, /className: 'dsh-editor-project-view-button'/);
  assert.match(panel, /projectViewDefinitions\(t\)/);
  assert.match(panel, /'aria-haspopup': 'menu'/);
});

test('The project tree no longer renders a synthetic root row', () => {
  assert.doesNotMatch(source, /name: projectName, path: '', kind: 'directory', root: true, depth: 0/);
  assert.match(
    source,
    /const stack = \[\s*\{[\s\S]*?list: Array\.isArray\(entries\) \? entries : \[\],[\s\S]*?depth: 0,/u,
  );
});
