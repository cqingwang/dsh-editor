import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const panelSource = readFileSync(join(root, 'src/client/components/terminal/TerminalPanel.tsx'), 'utf8');
const screenSource = readFileSync(join(root, 'src/client/components/terminal/TerminalScreen.tsx'), 'utf8');
const measuringSource = readFileSync(
  join(root, 'src/client/components/terminal/MeasuringScreen.tsx'),
  'utf8',
);
const source =
  panelSource +
  '\n' +
  screenSource +
  '\n' +
  readFileSync(join(root, 'lib/client.js'), 'utf8') +
  '\n' +
  measuringSource;

/**
 * Slice one callback/JSX block out of the client bundle.
 * @param {string} from - literal that starts the block.
 * @param {string} to - literal that ends it (first occurrence after `from`).
 * @returns {string} the slice.
 */
function slice(from, to) {
  const start = source.indexOf(from);
  assert.notEqual(start, -1, `${from} is missing from lib/client.js`);
  const end = source.indexOf(to, start);
  assert.notEqual(end, -1, `${to} is missing after ${from}`);
  return source.slice(start, end);
}

/* ── The stranded `%`: spawn the PTY at the width the screen fits ───────── */

test('a new shell is spawned at the measured grid, not a hard-coded 80×24', () => {
  /* zsh's PROMPT_SP pads its `%` marker to the PTY width and erases it with a
     backspacing space. A PTY at 80 columns displayed in a 77-column xterm wraps
     that padded line, leaving `%` alone on the first row and pushing the prompt
     to the second. */
  const create = slice('const createTerminal = React.useCallback(', 'const cycleTerminalColor');
  assert.match(create, /const grid = await awaitMeasured\(\);/);
  assert.match(create, /cols: grid\.cols,/);
  assert.match(create, /rows: grid\.rows,/);
  /* The old constant is gone from the spawn call. */
  assert.doesNotMatch(create, /sizeRef\.current/);

  /* A real emulator measures the box before any PTY exists. */
  assert.match(measuringSource, /function MeasuringScreenView\(\{ fontSize, onGrid \}: MeasuringScreenProps\)/);
  assert.match(create, /awaitMeasured/);
  assert.match(panelSource, /<MeasuringScreen[\s\S]*?onGrid=\{reportGrid\}/u);
});

test('the measurement is shared, awaited, and falls back safely', () => {
  const report = slice('const reportGrid = React.useCallback(', 'const awaitMeasured');
  assert.match(report, /measuredRef\.current = value;/);
  assert.match(report, /measureWaiters\.current = \[\];/);

  const wait = slice('const awaitMeasured = React.useCallback(', 'const \[shells, setShells\]');
  /* A click can arrive before the async xterm load settled: wait, but not forever. */
  assert.match(wait, /window\.setTimeout\(\(\) => finish\(measuredRef\.current\), timeout\);/);
  assert.match(wait, /value \?\?\s*\{\s*cols: 80,\s*rows: 24,?\s*\}/);

  /* Every screen reports through the same recorder, not its own assignment. */
  assert.equal((panelSource.match(/onGrid=\{reportGrid\}/g) ?? []).length, 3);
});

test('a screen without a PTY still reports its grid', () => {
  /* The measuring screen has no id, but skipping the report would leave the
     dock spawning at the fallback for ever. */
  /* The dock has several `measure` closures; this is TerminalScreen's, found by
     the grid-report line it owns. */
  const reportAt = screenSource.indexOf('handlersRef.current.onGrid?.(');
  assert.notEqual(reportAt, -1);
  const measure = screenSource.slice(
    screenSource.lastIndexOf('const measure = () => {', reportAt),
    screenSource.indexOf('observer?.observe(node);', reportAt),
  );
  assert.match(measure, /if \(cols === sizeRef\.current\.cols && rows === sizeRef\.current\.rows\) return;/);
  assert.match(measure, /handlersRef\.current\.onGrid\?\.\(\{[\s\S]*?cols,[\s\S]*?rows,/);
  /* Only the host resize is conditional on there being a PTY. */
  assert.match(measure, /if \(terminalId !== null\)[\s\S]*?op: 'resize'[\s\S]*?cols,[\s\S]*?rows,/);
});

/* ── `+` no longer spawns a shell per render ────────────────────────────── */

test('the one-shot new-terminal effect does not depend on an unstable callback', () => {
  /* `createTerminal`'s deps include props the workspace passes inline, so its
     identity changed on nearly every render. An effect depending on it re-fired
     on every render and started a shell each time — the dock froze on `+`. */
  const generation = slice('/* A "new terminal" request from the dock header or the shortcut. */', '/* The arrow beside "+"');
  assert.match(generation, /void createTerminalRef\.current\(\);/);
  assert.match(generation, /\}, \[generation\]\);/);
  assert.doesNotMatch(generation, /\}, \[generation, createTerminal\]\);/);
  assert.match(panelSource, /const createTerminalRef = React\.useRef\(createTerminal\);/);
  assert.match(panelSource, /createTerminalRef\.current = createTerminal;/);
});

test('the auto-open effect is idempotent instead of callback-dependent', () => {
  const autoOpen = slice('/* The first terminal starts automatically', '/* The arrow beside "+"');
  assert.match(autoOpen, /if \(openedRef\.current\) \{/);
  assert.match(autoOpen, /openedRef\.current = true;/);
  /* Still keyed on the state that must settle first. */
  assert.match(autoOpen, /if \(!loaded \|\| !available \|\| busy \|\| terminals\.length > 0 \|\| error !== null\) return;/);
  assert.match(autoOpen, /\}, \[available, busy, loaded, terminals\.length, error, onRequestClose\]\);/);
});
