import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = (await readFile(new URL('../lib/client.js', import.meta.url), 'utf8')) + '\n' + (await readFile(new URL('../src/client/components/search/FindToolWindow.tsx', import.meta.url), 'utf8'));
const findTool = source.slice(
  source.lastIndexOf('function FindToolWindowView('),
  source.indexOf('const FindToolWindow = FindToolWindowView;', source.lastIndexOf('function FindToolWindowView(')),
);

test('Find in Files matches IDEA keyboard intents', () => {
  const action = new Function(
    `${extractFunction('replaceInputAction')}; return replaceInputAction;`,
  )();
  assert.equal(action({ key: 'Enter', altKey: true, shiftKey: true }, 'single'), 'all');
  assert.equal(action({ key: 'Enter', metaKey: true }, 'single'), 'all');
  assert.equal(action({ key: 'Enter', ctrlKey: true }, 'single'), 'all');
  assert.equal(action({ key: 'Enter' }, 'single'), 'single');
  assert.equal(action({ key: 'Enter', altKey: true }, 'single'), null);
  assert.equal(action({ key: 'Enter', shiftKey: true }, 'single'), null);
  assert.match(findTool, /event\.metaKey === true \|\| event\.ctrlKey === true[\s\S]*?requestOpenInFindWindow\(\)/);
});

test('Find bottom actions advertise IDEA shortcuts', () => {
  assert.match(findTool, /aria-keyshortcuts='Alt\+Shift\+Enter'/);
  assert.match(findTool, /aria-keyshortcuts='Meta\+Enter Control\+Enter'/);
  assert.match(findTool, /styles\.findToolShortcut[^\n]*⌘⏎/);
  assert.match(findTool, /t\('editor\.searchReplaceAll'\)[\s\S]*?⌥⇧⏎/);
});

test('Persistent Find exposes Rerun without a second search model', () => {
  assert.match(findTool, /id: 'rerun'/);
  assert.match(findTool, /icon: 'refresh'/);
  assert.match(findTool, /label: t\('editor\.findRerun'\)/);
  assert.match(findTool, /onClick: rerunFindSearch/);
  assert.match(findTool, /\.\.\.\(floating\s+\? \[\]\s+: \[/u);
});

test('Directory scope uses the complete workspace directory picker', () => {
  assert.match(findTool, /const \[directoryPicker, setDirectoryPicker\] = React\.useState(?:<[^>]+>)?\(null\)/);
  assert.match(findTool, /callFs(?:<[^>]+>)?\(\{\s+op: 'directories',\s+\}\)/u);
  assert.match(findTool, /<MoveToPicker/);
  assert.match(findTool, /title=\{t\('editor\.findSelectDirectory'\)\}/u);
  assert.match(findTool, /placeholder=\{t\('editor\.findSelectDirectoryPlaceholder'\)\}/u);
  assert.match(findTool, /directoryPicker === null\s*\? null/);
});

test('Directory input opens the picker with the IDEA Shift+Enter gesture', () => {
  const input = findTool.slice(
    findTool.indexOf('value={scopeDirectoryDraft}'),
    findTool.indexOf('<button', findTool.indexOf('value={scopeDirectoryDraft}')),
  );
  assert.match(input, /event\.shiftKey === true[\s\S]*?event\.key === 'Enter'[\s\S]*?openFindDirectoryPicker\(\)/);
  assert.match(findTool, /onClick=\{openFindDirectoryPicker\}/);
  assert.match(findTool, /t\('editor\.findSelectDirectory'\)[\s\S]*?⇧⏎/);
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
