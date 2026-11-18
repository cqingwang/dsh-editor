import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = (await readFile(new URL('../lib/client.js', import.meta.url), 'utf8')) + '\n' + (await readFile(new URL('../src/client/components/search/FindToolWindow.tsx', import.meta.url), 'utf8'));
const findTool = source.slice(
  source.lastIndexOf('function FindToolWindowView('),
  source.indexOf('const FindToolWindow = FindToolWindowView;', source.lastIndexOf('function FindToolWindowView(')),
);

test('Find in Files bottom bar owns result and replacement actions', () => {
  assert.match(findTool, /data-dsh-find-bottom-bar=''/);
  assert.match(findTool, /t\('editor\.findOpenResultsInNewTab'\)/);
  assert.match(findTool, /t\('editor\.findOpenInFindWindow'\)/);
  assert.match(findTool, /t\('editor\.searchReplaceAll'\)/);
  assert.match(findTool, /t\('editor\.replaceCurrent'\)/);
  const replaceRow = findTool.slice(
    findTool.indexOf('styles.findToolReplaceRow'),
    findTool.indexOf('styles.findToolScopeRow'),
  );
  assert.doesNotMatch(replaceRow, /t\('editor\.searchReplaceAll'\)/);
  assert.doesNotMatch(replaceRow, /t\('editor\.replaceCurrent'\)/);
});

test('Open results in new tab routes activations through the right split', () => {
  assert.match(findTool, /const \[openResultsInNewTab, setOpenResultsInNewTab\]/);
  assert.match(findTool, /onOpen\(result, openResultsInNewTab === true\)/);
  assert.match(source, /onOpen: \(result, openInNewTab = false\) =>/);
  assert.match(source, /if \(openInNewTab\)[\s\S]*?void openInRightSplit\(result\.path/);
});

test('Directory scope provides a workspace-relative path editor', () => {
  assert.match(findTool, /scopeDirectoryDraft/);
  assert.match(findTool, /findToolScopeDirectoryInput/);
  assert.match(findTool, /findScopeDirectoryPlaceholder/);
  assert.match(findTool, /findSelectDirectory/);
  assert.match(findTool, /callFs\(\{\s+op: 'directories',\s+\}\)/u);
  assert.match(findTool, /<MoveToPicker/);
  assert.match(source, /findScopeDirectoryPlaceholder: '工作区相对目录，例如 src'/);
  assert.match(source, /findScopeDirectoryPlaceholder: 'Workspace-relative directory, for example src'/);
  assert.match(source, /findSelectDirectory: '选择目录'/);
  assert.match(source, /findSelectDirectory: 'Select Directory'/);
});

test('Directory scope treats the workspace root as an open prefix', () => {
  const scope = new Function(
    `${extractFunction('findToolPathMatchesScope')}; return findToolPathMatchesScope;`,
  )();
  assert.equal(scope('src/app.ts', 'directory', { directory: '' }), true);
  assert.equal(scope('src/app.ts', 'directory', { directory: '.' }), true);
  assert.equal(scope('src/app.ts', 'directory', { directory: './src/' }), true);
  assert.equal(scope('docs/a.md', 'directory', { directory: './src/' }), false);
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
