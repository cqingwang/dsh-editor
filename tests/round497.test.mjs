import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');

function extractSource(name) {
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

function copyFactory(navigatorValue) {
  return new Function(
    'navigator',
    `${extractSource('copySearchResultText')}; return copySearchResultText;`,
  )(navigatorValue);
}

test('copy helper reports a missing Clipboard API', () => {
  const notices = [];
  const copy = copyFactory({});
  copy('src/app.js', (message) => notices.push(message), (key) => key);
  assert.deepEqual(notices, ['editor.clipboardWriteFailed']);
});

test('copy helper reports synchronous clipboard exceptions', () => {
  const notices = [];
  const copy = copyFactory({
    clipboard: {
      writeText: () => {
        throw new Error('NotAllowedError');
      },
    },
  });
  copy('src/app.js', (message) => notices.push(message), (key) => key);
  assert.deepEqual(notices, ['editor.clipboardWriteFailed']);
});

test('copy helper reports resolved and rejected clipboard writes', async () => {
  const success = [];
  copyFactory({
    clipboard: { writeText: async () => {} },
  })('README.md', (message) => success.push(message), (key) => key);
  await Promise.resolve();
  await Promise.resolve();
  assert.deepEqual(success, ['editor.copiedToClipboard']);

  const failure = [];
  copyFactory({
    clipboard: { writeText: async () => { throw new Error('Denied'); } },
  })('README.md', (message) => failure.push(message), (key) => key);
  await Promise.resolve();
  await Promise.resolve();
  assert.deepEqual(failure, ['editor.clipboardWriteFailed']);
});

test('query and focused result rows open the same menu with predictable focus owners', () => {
  const panel = source.slice(source.indexOf('function FindToolWindow('), source.indexOf('function QuickOpen('));
  assert.match(panel, /\(event\.key === 'ContextMenu' \|\| \(event\.shiftKey === true && event\.key === 'F10'\)\)[\s\S]{0,320}openFindResultMenuAt/);
  assert.match(panel, /onKeyDown: \(event\) => handleOccurrenceKeyDown\(event, rowKey, position\)/);
  assert.match(panel, /occurrenceRefs\.current\.get\(rowKey\)\?\.getBoundingClientRect/);
  assert.match(source, /returnFocusRef\.current = document\.activeElement instanceof HTMLElement \? document\.activeElement : null/);
});

test('Find result menu reuses the viewport-clamped ContextMenu', () => {
  const panel = source.slice(source.indexOf('function FindToolWindow('), source.indexOf('function QuickOpen('));
  const menu = source.slice(source.indexOf('function ContextMenu('), source.indexOf('function splitChanges('));
  assert.match(panel, /resultMenu === null[\s\S]{0,160}React\.createElement\(ContextMenu/);
  assert.match(menu, /Math\.min\(menu\.x, window\.innerWidth - rect\.width - 8\)/);
  assert.match(menu, /Math\.min\(menu\.y, window\.innerHeight - rect\.height - 8\)/);
});
