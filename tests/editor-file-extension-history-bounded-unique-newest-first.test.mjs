import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = (await readFile(new URL('../lib/client.js', import.meta.url), 'utf8')) + '\n' + (await readFile(new URL('../src/client/components/search/FindToolWindow.tsx', import.meta.url), 'utf8'));

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

test('File extension history is bounded, unique and newest first', () => {
  const remember = new Function(
    `${extractFunction('rememberFileMaskHistory')}; return rememberFileMaskHistory;`,
  )();
  assert.deepEqual(remember(['.ts', '.md'], '.ts'), ['.ts', '.md']);
  assert.deepEqual(remember([], '  .ts, .md  '), ['.ts, .md']);
  assert.deepEqual(remember(['.ts'], ''), ['.ts']);
  const many = Array.from({ length: 14 }, (_, index) => `.x${index}`);
  assert.equal(remember(many, '.latest', 10).length, 10);
  assert.equal(remember(many, '.latest', 10)[0], '.latest');
});

test('Find in Files File extension control exposes recent masks and clear', () => {
  const findTool = source.slice(
    source.indexOf('function FindToolWindowView('),
    source.indexOf('const FindToolWindow = FindToolWindowView;'),
  );
  assert.match(findTool, /const \[fileMaskHistory, setFileMaskHistory\] = React\.useState\(readFileMaskHistory\)/);
  assert.match(findTool, /const \[fileMaskMenu, setFileMaskMenu\] = React\.useState(?:<[^>]+>)?\(null\)/);
  assert.match(findTool, /const acceptFileMask = \(value\) =>/);
  assert.match(findTool, /writeFileMaskHistory\(next\)/);
  assert.match(findTool, /id: 'clearFileMask'/);
  assert.match(findTool, /label: t\('editor\.findFileMaskHistory'\)/);
  assert.match(findTool, /ariaHasPopup: 'menu'/);
  assert.match(findTool, /fileMaskMenu === null/);
});

test('File extension history is written only on an explicit accept or blur', () => {
  const findTool = source.slice(
    source.indexOf('function FindToolWindowView('),
    source.indexOf('const FindToolWindow = FindToolWindowView;'),
  );
  const input = findTool.slice(
    findTool.indexOf('style: styles.findToolFileMaskInput'),
    findTool.indexOf('React.createElement(ToolbarButton', findTool.indexOf('style: styles.findToolFileMaskInput')),
  );
  assert.doesNotMatch(input, /writeFileMaskHistory\(value\)/);
  assert.match(input, /onBlur:[\s\S]*?writeFileMaskHistory\(fileMaskDraft\)/);
  assert.match(input, /event\.key !== 'Enter'[\s\S]*?acceptFileMask\(fileMaskDraft\)/);
});

test('Directory and Changed Files scopes stay constrained during Replace All', () => {
  const scope = new Function(
    `${extractFunction('findToolPathMatchesScope')}; return findToolPathMatchesScope;`,
  )();
  assert.equal(scope('src/nested/a.ts', 'directory', { directory: 'src' }), true);
  assert.equal(scope('docs/a.md', 'directory', { directory: 'src' }), false);
  assert.equal(scope('src/a.ts', 'scope', { allowedPaths: new Set(['src/a.ts']) }), true);
  assert.equal(scope('src/b.ts', 'scope', { allowedPaths: new Set(['src/a.ts']) }), false);
  assert.match(source, /const scopedReplacementPaths = new Set\(scopedMatches\.map/);
  assert.match(source, /onReplaceAll\(scopedReplacementPaths\)/);
});

test('Find in Files defaults to an IDEA-style popup and has an explicit persistent dock', () => {
  assert.match(source, /findToolPopup: \{[\s\S]*?position: 'fixed'[\s\S]*?zIndex: 4000/);
  assert.match(source, /'data-dsh-find-tool-popup': ''/);
  assert.match(source, /'data-dsh-find-tool-dock': ''/);
  assert.match(source, /findTool\?\.surface === 'dock'/);
  const dialog = source.slice(
    source.indexOf('function FindToolWindowView('),
    source.indexOf('const FindToolWindow = FindToolWindowView;'),
  );
  assert.match(dialog, /'data-dsh-find-tool-window': ''/);
  assert.match(dialog, /styles\.findToolToolbar/);
  assert.match(dialog, /styles\.findToolSearchRow/);
  assert.match(dialog, /styles\.findToolScopeRow/);
});
