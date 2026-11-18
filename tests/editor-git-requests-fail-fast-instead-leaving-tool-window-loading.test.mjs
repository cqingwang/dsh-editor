import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'lib/client.js'), 'utf8');

test('Git requests fail fast instead of leaving the tool window loading forever', () => {
  const start = source.indexOf('async function callGit(');
  assert.notEqual(start, -1);
  const end = source.indexOf('/** Call the host terminal API.', start);
  assert.notEqual(end, -1);
  const callGit = source.slice(start, end);
  assert.match(callGit, /const controller = new AbortController\(\);/);
  assert.match(callGit, /let timedOut = false;/);
  assert.match(callGit, /timedOut = true;\s+controller\.abort\(\);/);
  assert.match(callGit, /signal: controller\.signal/);
  assert.match(callGit, /git request timed out after 20 seconds/);
  assert.match(callGit, /window\.clearTimeout\(timer\)/);
});
