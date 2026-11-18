import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'lib/client.js'), 'utf8');

function objectAfter(anchor) {
  const start = source.indexOf(anchor);
  assert.notEqual(start, -1, `missing anchor ${anchor}`);
  const open = source.indexOf('{', start);
  let depth = 0;
  let quote = '';
  let escaped = false;
  for (let index = open; index < source.length; index += 1) {
    const char = source[index];
    if (quote !== '') {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === quote) quote = '';
      continue;
    }
    if (char === "'" || char === '"' || char === '`') {
      quote = char;
      continue;
    }
    if (char === '{') depth += 1;
    if (char === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(open, index + 1);
    }
  }
  assert.fail(`unterminated object after ${anchor}`);
}

test('every statically referenced editor locale key exists in both dictionaries', () => {
  const zh = objectAfter('const zh = {');
  const en = objectAfter('const en = {');
  const used = [...new Set([...source.matchAll(/t\('editor\.([A-Za-z0-9_]+)'/g)].map((match) => match[1]))].sort();
  const missingZh = used.filter((key) => !new RegExp(`(?:^|\\n)\\s*${key}:`).test(zh));
  const missingEn = used.filter((key) => !new RegExp(`(?:^|\\n)\\s*${key}:`).test(en));
  assert.deepEqual(missingZh, []);
  assert.deepEqual(missingEn, []);
});

test('Copy Path has a visible localised label instead of a raw key', () => {
  assert.match(source, /copyPath: '复制路径',/);
  assert.match(source, /copyPath: 'Copy path',/);
});
