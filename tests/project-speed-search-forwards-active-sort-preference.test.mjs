import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const client = (readFileSync(join(root, 'src/client/components/project/ProjectPanel.tsx'), 'utf8') + '\n' + readFileSync(join(root, 'lib/client.js'), 'utf8'));
const host = readFileSync(join(root, 'lib/index.js'), 'utf8');

test('Project speed search forwards the active sort preference', () => {
  const panel = client.slice(client.indexOf('function ProjectPanel('), client.indexOf('/**\n     * IDEA-style context menu'));
  assert.match(panel, /sort: sortMode/);
  assert.match(panel, /foldersFirst/);
});

test('the host recursive search reuses listDirectory ordering', () => {
  const start = host.indexOf('async function searchWorkspaceEntries(');
  const block = host.slice(start, host.indexOf('/**', start + 10));
  assert.match(block, /const sortMode = typeof options\.sort === 'string' \? options\.sort : 'name'/);
  assert.match(block, /sort: sortMode/);
  assert.match(block, /foldersFirst: options\.foldersFirst !== false/);
});
