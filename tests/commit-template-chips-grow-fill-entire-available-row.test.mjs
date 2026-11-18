import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');

test('commit template chips grow to fill the entire available row', () => {
  const start = source.indexOf('commitTemplateChip: {');
  const end = source.indexOf('\n      },', start);
  const chip = source.slice(start, end);

  assert.match(chip, /flex: '1 1 auto'/);
  assert.match(chip, /justifyContent: 'center'/);
  assert.match(chip, /textAlign: 'center'/);
});
