import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadTypeScriptModule } from './ts-source.mjs';

const helperSource = await readFile(new URL('../src/client/find-tool.ts', import.meta.url), 'utf8');
const panel = await readFile(
  new URL('../src/client/components/terminal/TerminalPanel.tsx', import.meta.url),
  'utf8',
);
const locales = await readFile(new URL('../src/client/locales.ts', import.meta.url), 'utf8');

test('duplicate hidden terminal titles receive unique stable names', () => {
  const { terminalOverflowItemLabel } = loadTypeScriptModule(helperSource, [
    'terminalOverflowItemLabel',
  ]);
  const translate = (key, params = {}) =>
    key === 'editor.terminalOverflowItem' ? `${params.index}. ${params.title}` : key;
  const terminals = [
    { id: 'a', title: 'zsh' },
    { id: 'b', title: 'zsh' },
    { id: 'c', title: 'zsh' },
  ];
  assert.deepEqual(
    terminals.map((terminal) => terminalOverflowItemLabel(translate, terminals, terminal)),
    ['1. zsh', '2. zsh', '3. zsh'],
  );
});

test('the overflow menu uses the shared label helper and localized template', () => {
  assert.match(panel, /terminalOverflowItemLabel\(t, terminals, terminal\)/u);
  assert.match(locales, /terminalOverflowItem: '终端 \{index\}：\{title\}',/u);
  assert.match(locales, /terminalOverflowItem: 'Terminal \{index\}: \{title\}',/u);
  assert.equal((locales.match(/terminalOverflowItem:/gu) ?? []).length, 2);
});
