import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'lib/client.js'), 'utf8');

/**
 * Split the two dictionaries out of the shipping source.
 *
 * `const zh = {` … `};` then `const en = {` … `};`. Both are flat two-level
 * objects, so a line scan is enough and stays independent of formatting.
 * @returns {{zh: Map<string,string>, en: Map<string,string>}} key → value for each.
 */
/** Slice one dictionary body: from its `{` to the matching `\n    };`. */
function sliceDictionary(start) {
  const end = source.indexOf('\n    };', start);
  assert.notEqual(end, -1, 'a dictionary must terminate at column 4');
  return source.slice(start, end);
}

function readDictionaries() {
  const zhStart = source.indexOf('    const zh = {');
  const enStart = source.indexOf('    const en = {', zhStart);
  assert.ok(zhStart !== -1 && enStart !== -1, 'both dictionaries must exist');
  const parse = (segment) => {
    const out = new Map();
    for (const line of segment.split('\n')) {
      const match = /^        (\w+): '(.*)',$/.exec(line);
      if (match !== null) out.set(match[1], match[2]);
    }
    return out;
  };
  return { zh: parse(sliceDictionary(zhStart)), en: parse(sliceDictionary(enStart)) };
}

const { zh, en } = readDictionaries();

test('both dictionaries define the same keys', () => {
  /* A key added to one side only falls back through `translate`, which is fine at
     runtime but hides the omission — and a key inserted at the WRONG side (an English
     string inside the zh block) silently shadows the real translation. */
  const onlyZh = [...zh.keys()].filter((key) => !en.has(key));
  const onlyEn = [...en.keys()].filter((key) => !zh.has(key));
  assert.deepEqual(onlyZh, [], `keys missing from en: ${onlyZh.join(', ')}`);
  assert.deepEqual(onlyEn, [], `keys missing from zh: ${onlyEn.join(', ')}`);
});

test('the zh dictionary holds no ASCII-English values', () => {
  /* Round 80/113 inserted English strings into the zh block; a duplicated key then
     won by order and the UI showed English (or the raw key) in a zh session. */
  const offenders = [...zh.entries()]
    .filter(([, value]) => !/[\u4e00-\u9fff]/.test(value) && /[A-Za-z]{3}/.test(value))
    /* These are legitimately language-neutral: key names, units, symbols. */
    /* Product names IDEA also leaves untranslated, plus key names and symbols. */
    .filter(([key]) => ![
      'terminalCopyShortcut', 'terminalPasteShortcut', 'gotoLineHint',
      'project', 'commit', 'terminal',
      /* git's own term of art, spelled the same in every language IDEA ships. */
      'detachedHead',
    ].includes(key))
    .map(([key, value]) => `${key} = ${JSON.stringify(value)}`);
  assert.deepEqual(offenders, [], `zh entries that are English: ${offenders.join('; ')}`);
});

test('no dictionary repeats a key', () => {
  /* A duplicate silently shadows the earlier one: exactly how `copySubject` ended up
     resolving to "Copy Commit Message" in a zh session. */
  const duplicates = (segment) => {
    const seen = new Set();
    const dupes = new Set();
    for (const line of segment.split('\n')) {
      const match = /^        (\w+): '/.exec(line);
      if (match === null) continue;
      if (seen.has(match[1])) dupes.add(match[1]);
      seen.add(match[1]);
    }
    return [...dupes];
  };
  const zhStart = source.indexOf('    const zh = {');
  const enStart = source.indexOf('    const en = {', zhStart);
  assert.deepEqual(duplicates(sliceDictionary(zhStart)), [], 'duplicate keys in zh');
  assert.deepEqual(duplicates(sliceDictionary(enStart)), [], 'duplicate keys in en');
});
