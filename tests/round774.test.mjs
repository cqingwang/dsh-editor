import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const client = (await readFile(new URL('./fixtures/terminal-panel.legacy.js', import.meta.url), 'utf8') + '\n' + await readFile(new URL('../lib/client.js', import.meta.url), 'utf8'));

function extractFunction(name) {
  const start = client.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} is missing`);
  const bodyStart = client.indexOf('(', start);
  let parenDepth = 0;
  let body = -1;
  for (let index = bodyStart; index < client.length; index += 1) {
    if (client[index] === '(') parenDepth += 1;
    if (client[index] === ')') parenDepth -= 1;
    if (parenDepth === 0) {
      body = client.indexOf('{', index);
      break;
    }
  }
  assert.notEqual(body, -1);
  let depth = 0;
  for (let index = body; index < client.length; index += 1) {
    if (client[index] === '{') depth += 1;
    if (client[index] === '}') depth -= 1;
    if (depth === 0) return client.slice(start, index + 1);
  }
  assert.fail(`${name} has no closing brace`);
}

test('closing the active dock tab prefers a different visible split-safe terminal', () => {
  const pick = new Function(
    `${extractFunction('terminalActiveAfterClose')}\nreturn terminalActiveAfterClose;`,
  )();
  const remaining = [
    { id: 'split' },
    { id: 'other' },
    { id: 'editor' },
  ];
  assert.equal(pick(remaining, 'split', ['editor']), 'other');
  assert.equal(pick([{ id: 'split' }], 'split', []), 'split');
  assert.equal(pick([{ id: 'editor' }], 'split', ['editor']), null);
});

test('Terminal close uses the split-safe dock fallback', () => {
  const terminalStart = client.indexOf('function TerminalPanel(');
  const terminal = client.slice(terminalStart, client.indexOf('\n    function ', terminalStart + 10));
  const start = terminal.indexOf('const closeTerminal = React.useCallback(async (id) => {');
  const end = terminal.indexOf('      }, [rememberClosed]);', start);
  const block = terminal.slice(start, end);
  assert.match(block, /const nextActive = terminalActiveAfterClose\(remaining, splitIdRef\.current, editorIdsRef\.current\);/u);
  assert.match(block, /setActiveId\(\(active\) => \(active === id \? nextActive : active\)\);/u);
});
