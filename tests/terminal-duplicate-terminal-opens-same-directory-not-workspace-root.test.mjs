import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'src/client/components/terminal/TerminalPanel.tsx'), 'utf8');

test('"Duplicate Terminal" opens in the SAME directory, not the workspace root', () => {
  /* `duplicate` used to call `createTerminal(terminal.shell)`; `startPath` was only
     sent when the shell was undefined, so the copy always landed at the workspace
     root — a duplicate that is not a duplicate. */
  const start = source.indexOf('duplicate: () =>');
  assert.notEqual(start, -1);
  const line = source.slice(start, source.indexOf('\n', start));
  assert.match(line, /createTerminal\(/);
  /* The call must carry the directory as well as the shell. */
  assert.match(line, /createTerminal\(terminal\.shell, cwd\)/);
  assert.match(source, /await refreshTerminalCwd\(terminal\.id,/);
});

test('createTerminal accepts an explicit start directory', () => {
  const start = source.indexOf('const createTerminal = React.useCallback(');
  assert.notEqual(start, -1);
  const block = source.slice(start, source.indexOf('\n  );', start) + 5);
  assert.match(
    block,
    /const createTerminal = React\.useCallback\(\s+async \([\s\S]*?shellPath[^,]*,[\s\S]*?directory[^,]*,[\s\S]*?restoreSnapshot = '',[\s\S]*?\) => \{/,
  );
  /* An explicit directory wins over the ambient "open in terminal" one. */
  assert.match(block, /startPath:\s*typeof directory === 'string' && directory !== ''/u);
});

test('a plain new terminal still starts at the workspace root', () => {
  const start = source.indexOf('const createTerminal = React.useCallback(');
  const block = source.slice(start, source.indexOf('\n  );', start) + 5);
  /* No shell and no directory: fall back to the ambient start directory. */
  assert.match(block, /startDirectory/);
});
