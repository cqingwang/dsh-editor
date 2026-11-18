import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = (await readFile(new URL('../src/client/components/search/SearchEverywhere.tsx', import.meta.url), 'utf8') + '\n' + await readFile(new URL('../src/client/components/ui/Menu.tsx', import.meta.url), 'utf8') + '\n' + await readFile(new URL('../lib/client.js', import.meta.url), 'utf8'));

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
      if (depth === 0) return new Function(`${source.slice(start, index + 1)}; return ${name};`)();
    }
  }
  assert.fail(`unterminated ${name}`);
}

test('action tooltip stays inside the viewport and flips above when needed', () => {
  const position = extract('searchEverywhereTooltipPosition');
  assert.deepEqual(position(20, 30, 1000, 700), { left: 20, top: 34 });
  assert.deepEqual(position(980, 30, 1000, 700), { left: 676, top: 34 });
  assert.deepEqual(position(20, 680, 1000, 700), { left: 20, top: 600 });
  assert.deepEqual(position(-50, -20, 400, 300), { left: 4, top: 4 });
});

test('Action tooltips appear after a hover delay instead of instantly', () => {
  const dialog = source.slice(source.indexOf('function SearchEverywhere('), source.indexOf('function FindToolWindowView('));
  assert.match(dialog, /const \[resultTooltip, setResultTooltip\] = React\.useState(?:<[^>]+>)?\(null\)/);
  assert.match(dialog, /const resultTooltipTimerRef = React\.useRef\(null\)/);
  assert.match(dialog, /window\.setTimeout\([\s\S]*?450\)/);
  assert.match(dialog, /searchEverywhereTooltipPosition\(/);
  assert.match(dialog, /onMouseEnter: \(event\) => \{/);
  assert.match(dialog, /setResultTooltip\(null\)/);
});

test('command history persistence remains browser-local and bounded', () => {
  assert.match(source, /const COMMAND_HISTORY_KEY = 'dsh-editor\.search\.commandHistory'/);
  assert.match(source, /window\.localStorage\.setItem\(COMMAND_HISTORY_KEY/);
  assert.match(source, /rememberCommandHistory\(history, '', 12\)/);
});

test('Filter menu continues to use ContextMenu keyboard and viewport behavior', () => {
  const menu = source.slice(source.indexOf('function ContextMenu('), source.indexOf('function MenuItems'));
  assert.match(menu, /Math\.min\(menu\.x, window\.innerWidth - rect\.width - 8\)/);
  assert.match(menu, /Math\.min\(menu\.y, window\.innerHeight - rect\.height - 8\)/);
  assert.match(menu, /event\.key === 'ArrowDown' \|\| event\.key === 'ArrowUp'/);
});
