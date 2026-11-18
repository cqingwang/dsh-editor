import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { en, localeSource, zh } from './locale-source.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'lib/client.js'), 'utf8');

/** Slice one source dictionary body up to its top-level closing brace. */
function sliceDictionary(start) {
  const end = localeSource.indexOf('\n};', start);
  assert.notEqual(end, -1, 'a dictionary must terminate at top level');
  return localeSource.slice(start, end);
}

const zhMessages = new Map(Object.entries(zh.editor));
const enMessages = new Map(Object.entries(en.editor));

test('both dictionaries define the same keys', () => {
  /* A key added to one side only falls back through `translate`, which is fine at
     runtime but hides the omission — and a key inserted at the WRONG side (an English
     string inside the zh block) silently shadows the real translation. */
  const onlyZh = [...zhMessages.keys()].filter((key) => !enMessages.has(key));
  const onlyEn = [...enMessages.keys()].filter((key) => !zhMessages.has(key));
  assert.deepEqual(onlyZh, [], `keys missing from en: ${onlyZh.join(', ')}`);
  assert.deepEqual(onlyEn, [], `keys missing from zh: ${onlyEn.join(', ')}`);
});

test('the zh dictionary holds no ASCII-English values', () => {
  /* Round 80/113 inserted English strings into the zh block; a duplicated key then
     won by order and the UI showed English (or the raw key) in a zh session. */
  const offenders = [...zhMessages.entries()]
    .filter(([, value]) => !/[\u4e00-\u9fff]/.test(value) && /[A-Za-z]{3}/.test(value))
    /* These are legitimately language-neutral: key names, units, symbols. */
    /* Product names IDEA also leaves untranslated, plus key names and symbols. */
    .filter(([key]) => ![
      'statusBarPosition',
      'terminalCopyShortcut', 'terminalPasteShortcut', 'gotoLineHint',
      'project', 'commit', 'terminal', 'harness',
      /* The Commit tool-window mode labels are deliberately English in both
         locales, matching the user's requested IDEA-style Change/Commit tabs. */
      'tabChanges', 'tabLog',
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
    for (const match of segment.matchAll(/^\s*(\w+):\s*(?:'|\n)/gm)) {
      if (seen.has(match[1])) dupes.add(match[1]);
      seen.add(match[1]);
    }
    return [...dupes];
  };
  const zhStart = localeSource.indexOf('export const zh: LocaleTree = {');
  const enStart = localeSource.indexOf('export const en: LocaleTree = {', zhStart);
  assert.deepEqual(duplicates(sliceDictionary(zhStart)), [], 'duplicate keys in zh');
  assert.deepEqual(duplicates(sliceDictionary(enStart)), [], 'duplicate keys in en');
});
