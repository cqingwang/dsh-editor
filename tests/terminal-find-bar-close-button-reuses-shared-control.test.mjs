import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const panel = await readFile(new URL('src/client/components/terminal/TerminalPanel.tsx', root), 'utf8');
const locales = await readFile(new URL('src/client/locales.ts', root), 'utf8');
const findTool = await readFile(new URL('src/client/find-tool.ts', root), 'utf8');
const findBar = panel.slice(panel.indexOf("{find === null ? null : ("), panel.indexOf("{available ? ("));
const findCountEffect = panel.slice(
  panel.indexOf('/* Recompute the match count whenever the query or live terminal buffer changes. */'),
  panel.indexOf('/* ⌘/Ctrl+F inside either terminal pane opens the dock\'s own find bar. */'),
);

test('Terminal Find closes through the shared labelled toolbar control', () => {
  assert.match(
    findBar,
    /<ToolbarButton\s+icon='close'\s+label=\{t\('editor\.closeTerminalFind'\)\}/u,
  );
  assert.doesNotMatch(findBar, /style=\{styles\.conflictAction\}/u);
  assert.doesNotMatch(findBar, />\s*×\s*<\/button>/u);
});

test('Terminal Find close label exists in both dictionaries', () => {
  assert.match(locales, /closeTerminalFind: '关闭终端查找'/u);
  assert.match(locales, /closeTerminalFind: 'Close Terminal Find'/u);
});

test('Terminal Find disables navigation when there is no match', () => {
  assert.match(
    findBar,
    /icon='chevronDown'\s+label=\{t\('editor\.findNext'\)\}\s+disabled=\{find\.total === 0\}/u,
  );
  assert.match(
    findBar,
    /icon='chevronRight'\s+label=\{t\('editor\.findPrevious'\)\}\s+disabled=\{find\.total === 0\}/u,
  );
});

test('Terminal Find recomputes its count when live output extends the buffer', () => {
  assert.match(findTool, /onWriteParsed\?: \(handler: \(\) => void\) => \{ dispose: \(\) => void \};/u);
  assert.match(findCountEffect, /const writeParsed = emulator\.onWriteParsed\?\.\(syncTotal\);/u);
  assert.match(findCountEffect, /countTerminalMatches\(emulator, find\.query\)/u);
  assert.match(findCountEffect, /return \(\) => \{\s+writeParsed\?\.dispose\(\);/u);
  assert.match(findCountEffect, /window\.setTimeout\(\(\) => \{[\s\S]*?recomputeTotal\(\);[\s\S]*?\}, 50\);/u);
});
