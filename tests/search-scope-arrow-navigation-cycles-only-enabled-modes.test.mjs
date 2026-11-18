import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = (await readFile(new URL('../lib/client.js', import.meta.url), 'utf8')) + '\n' + (await readFile(new URL('./fixtures/find-tool.legacy.js', import.meta.url), 'utf8'));
const findTool = source.slice(
  source.indexOf('function FindToolWindow('),
  source.indexOf('/* QUICK_OPEN_BOUNDARY */'),
);

test('Scope arrow navigation cycles only enabled modes', () => {
  const target = new Function(
    `${extractFunction('findToolScopeModeTarget')}; return findToolScopeModeTarget;`,
  )();
  assert.equal(target('project', 'ArrowRight'), 'directory');
  assert.equal(target('directory', 'ArrowRight'), 'scope');
  assert.equal(target('scope', 'ArrowRight'), 'project');
  assert.equal(target('project', 'ArrowLeft'), 'scope');
  assert.equal(target('scope', 'ArrowLeft'), 'directory');
  assert.equal(target('directory', 'Home'), 'project');
  assert.equal(target('project', 'End'), 'scope');
  assert.equal(target('module', 'ArrowRight'), 'project');
  assert.equal(target('project', 'Enter'), null);
});

test('Find exposes the scope modes as one named keyboard group', () => {
  assert.match(findTool, /role: 'group'/);
  assert.match(findTool, /'aria-label': t\('editor\.findScopeModeGroup'\)/);
  assert.match(findTool, /tabIndex: scopeMode === scope\.id \? 0 : -1/);
  assert.match(findTool, /handleFindScopeModeKeyDown\(event, scope\.id\)/);
  assert.match(findTool, /scopeModeButtonRefs\.current\.get\(mode\)\?\.focus\?\.\(\)/);
  assert.match(findTool, /selectFindScopeMode\(mode\)/);
});

test('Scope group copy is localized and Module remains unavailable', () => {
  assert.match(source, /findScopeModeGroup: '搜索范围'/);
  assert.match(source, /findScopeModeGroup: 'Search scope'/);
  assert.match(findTool, /id: 'module'[\s\S]*?disabled: true/);
  assert.doesNotMatch(
    source.slice(source.indexOf('function findToolScopeModeTarget('), source.indexOf('function claimReplaceAttempt(')),
    /'module'/,
  );
});

function extractFunction(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} is missing`);
  const bodyStart = source.indexOf(') {', start) + 2;
  assert.ok(bodyStart > 1, `${name} has no function body`);
  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}') depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }
  assert.fail(`${name} has no closing brace`);
}
