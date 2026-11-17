import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');

test('Find scope modes use IDEA-like underline for the active mode', () => {
  const idleStart = source.indexOf('findToolScopeButton: {');
  const activeStart = source.indexOf('findToolScopeButtonActive: {', idleStart);
  const activeEnd = source.indexOf('\n      },', activeStart);
  assert.ok(idleStart >= 0 && activeStart > idleStart && activeEnd > activeStart);
  const idle = source.slice(idleStart, activeStart);
  const active = source.slice(activeStart, activeEnd);

  assert.match(idle, /borderBottom: '2px solid transparent'/u);
  assert.match(active, /background: 'transparent'/u);
  assert.match(active, /fontWeight: 600/u);
  assert.match(active, /borderBottomColor: 'var\(--dsw-alias-state-business-primary\)'/u);
});

test('Find scope modes keep pressed semantics independent of visual styling', () => {
  assert.match(source, /'data-dsh-find-scope-mode': scope\.id/u);
  assert.match(source, /'aria-pressed': scopeMode === scope\.id/u);
  assert.match(source, /scopeMode === scope\.id \? styles\.findToolScopeButtonActive : null/u);
});
