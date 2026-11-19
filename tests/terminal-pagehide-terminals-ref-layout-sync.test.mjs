import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const panel = await readFile(new URL('../src/client/components/terminal/TerminalPanel.tsx', import.meta.url), 'utf8');

test('Terminal syncs the latest terminal list before pagehide can observe it', () => {
  assert.match(
    panel,
    /React\.useLayoutEffect\(\(\) => \{\s+terminalsRef\.current = terminals;\s+\}, \[terminals\]\);/u,
  );
  assert.doesNotMatch(panel, /React\.useEffect\(\(\) => \{\s+terminalsRef\.current = terminals;/u);
});

test('passive profile persistence no longer owns the pagehide ref', () => {
  const profileAt = panel.indexOf('shouldPersistTerminalProfile(');
  const autoOpenAt = panel.indexOf('/* The first terminal starts automatically', profileAt);
  assert.ok(profileAt > 0 && autoOpenAt > profileAt);
  const profileEffect = panel.slice(profileAt, autoOpenAt);
  assert.doesNotMatch(profileEffect, /terminalsRef\.current = terminals;/u);
  assert.match(profileEffect, /rememberTerminalsRef\.current\?\.\(terminals\);/u);
  assert.match(panel, /window\.addEventListener\('pagehide', persist\)/u);
  assert.match(panel, /persistTerminalRestoreSnapshots\(terminalsRef\.current\)/u);
});
