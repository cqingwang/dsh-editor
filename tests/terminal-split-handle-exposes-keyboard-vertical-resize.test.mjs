import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { transpileTypeScriptFunction } from './ts-source.mjs';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

const terminalSource = await read('src/client/terminal.ts');
const panelSource = await read('src/client/components/terminal/TerminalPanel.tsx');
const injectedCssSource = await read('src/client/injected-css.ts');
const splitKeyboardFunction = transpileTypeScriptFunction(terminalSource, 'terminalSplitKeyboardPercent');
const nextPercent = new Function(
  'TERMINAL_SPLIT_MIN_PERCENT',
  'TERMINAL_SPLIT_MAX_PERCENT',
  `${splitKeyboardFunction}\nreturn terminalSplitKeyboardPercent;`,
)(20, 80);

test('Terminal split keyboard movement is bounded and matches IDEA separator conventions', () => {
  assert.equal(nextPercent(50, 'ArrowLeft', false), 48);
  assert.equal(nextPercent(50, 'ArrowRight', false), 52);
  assert.equal(nextPercent(50, 'ArrowLeft', true), 40);
  assert.equal(nextPercent(50, 'ArrowRight', true), 60);
  assert.equal(nextPercent(20, 'ArrowLeft', false), 20);
  assert.equal(nextPercent(80, 'ArrowRight', true), 80);
  assert.equal(nextPercent(63, 'Home', false), 20);
  assert.equal(nextPercent(37, 'End', false), 80);
  assert.equal(nextPercent(63, 'Enter', false), 50);
  assert.equal(nextPercent('bad', 'ArrowLeft', false), 48);
  assert.equal(nextPercent(50, 'PageUp', false), null);
});

test('the Terminal splitter exposes one focusable vertical separator', () => {
  assert.match(panelSource, /role='separator'/u);
  assert.match(panelSource, /aria-orientation='vertical'/u);
  assert.match(panelSource, /aria-valuemin=\{TERMINAL_SPLIT_MIN_PERCENT\}/u);
  assert.match(panelSource, /aria-valuemax=\{TERMINAL_SPLIT_MAX_PERCENT\}/u);
  assert.match(panelSource, /aria-valuenow=\{Math\.round\(splitPercent\)\}/u);
  assert.match(panelSource, /aria-valuetext=\{`\$\{Math\.round\(splitPercent\)\}%`\}/u);
  assert.match(panelSource, /aria-label=\{t\('editor\.terminalSplitResize'\)\}/u);
  assert.match(panelSource, /tabIndex=\{0\}/u);
  assert.match(panelSource, /data-dsh-terminal-split-handle=''/u);
  assert.match(panelSource, /terminalSplitKeyboardPercent\(splitPercent, event\.key, event\.shiftKey\)/u);
  assert.match(panelSource, /commitSplitPercent\(next\)/u);
  assert.match(panelSource, /const splitHandleRef = React\.useRef<HTMLDivElement \| null>\(null\)/u);
  assert.match(panelSource, /id: 'resizeSplit'/u);
  assert.match(panelSource, /splitHandleRef\.current\?\.focus\(\{ preventScroll: true \}\)/u);
  assert.match(
    panelSource,
    /event\.currentTarget\.focus\(\{ preventScroll: true \}\);[\s\S]{0,80}event\.preventDefault\(\)/u,
  );
});

test('the Terminal split handle has an inset themed keyboard focus ring', () => {
  assert.match(injectedCssSource, /'\[data-dsh-terminal-split-handle\]:focus-visible \{'/u);
  assert.match(
    injectedCssSource,
    /data-dsh-terminal-split-handle\]:focus-visible \{[\s\S]*?outline: 1px solid var\(--dsw-alias-state-business-primary\) !important;[\s\S]*?outline-offset: -1px !important;/u,
  );
  assert.match(
    injectedCssSource,
    /@media \(forced-colors: active\)[\s\S]*?\[data-dsh-terminal-split-handle\]:focus-visible \{ outline-color: Highlight !important; \}/u,
  );
});
