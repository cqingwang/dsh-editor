import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadTypeScriptModule } from './ts-source.mjs';

const source = await readFile(new URL('../src/client/terminal.ts', import.meta.url), 'utf8');
const helpers = loadTypeScriptModule(source, ['projectSpeedSearchKeyAction']);

test('Enter closes Project speed search when no row can be opened', () => {
  assert.equal(helpers.projectSpeedSearchKeyAction({ key: 'Enter' }, 0), 'close');
});

test('Escape always closes and directional keys only move between real hits', () => {
  assert.equal(helpers.projectSpeedSearchKeyAction({ key: 'Escape' }, 0), 'close');
  assert.equal(helpers.projectSpeedSearchKeyAction({ key: 'Escape' }, 2), 'close');
  assert.equal(helpers.projectSpeedSearchKeyAction({ key: 'ArrowDown' }, 0), null);
  assert.equal(helpers.projectSpeedSearchKeyAction({ key: 'ArrowUp' }, 0), null);
  assert.equal(helpers.projectSpeedSearchKeyAction({ key: 'ArrowDown' }, 2), 'next');
  assert.equal(helpers.projectSpeedSearchKeyAction({ key: 'ArrowUp' }, 2), 'previous');
});

test('Enter opens only a real speed-search hit', () => {
  assert.equal(helpers.projectSpeedSearchKeyAction({ key: 'Enter' }, 1), 'open');
  assert.equal(helpers.projectSpeedSearchKeyAction({ key: 'a' }, 1), null);
});
