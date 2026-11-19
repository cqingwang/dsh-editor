import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const panel = await readFile(new URL('../src/client/components/terminal/TerminalPanel.tsx', import.meta.url), 'utf8');
const timerBlock = panel.slice(
  panel.indexOf('const persist = () => persistTerminalRestoreSnapshots(terminalsRef.current);'),
  panel.indexOf('/* Ask the host which terminals this Session still retains. */'),
);

test('Terminal restore persistence stops scheduling work while the page is hidden', () => {
  assert.doesNotMatch(timerBlock, /window\.setInterval\(/u);
  assert.match(timerBlock, /let persistTimer: number \| null = null/u);
  assert.match(timerBlock, /const cancelPersistTimer = \(\): void =>/u);
  assert.match(timerBlock, /const schedulePersist = \(\): void =>/u);
  assert.match(timerBlock, /if \(document\.visibilityState === 'hidden'\) return/u);
  assert.match(timerBlock, /persistTimer = window\.setTimeout\(persistAndReschedule, 1000\)/u);
  assert.match(timerBlock, /const onVisibility = \(\): void => \{\s+persist\(\);\s+schedulePersist\(\);/u);
});

test('Visibility, pagehide and unmount retain the final authoritative snapshot', () => {
  assert.match(timerBlock, /window\.addEventListener\('pagehide', persist\)/u);
  assert.match(timerBlock, /document\.addEventListener\('visibilitychange', onVisibility\)/u);
  assert.match(timerBlock, /persist\(\);\s+cancelPersistTimer\(\);/u);
  assert.match(timerBlock, /window\.removeEventListener\('pagehide', persist\)/u);
  assert.match(timerBlock, /document\.removeEventListener\('visibilitychange', onVisibility\)/u);
});
