import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'lib/client.js'), 'utf8');

/**
 * Find `React.createElement(...)` calls whose THIRD-or-later argument is a bare
 * object literal — the shape that throws React #31 ("objects are not valid as a
 * React child"). Written as a tiny scanner instead of a regex because the calls
 * span dozens of lines and nest.
 * @param {string} text - file contents.
 * @returns {string[]} offending argument snippets.
 */
function objectChildren(text) {
  const marker = 'React.createElement(';
  const found = [];
  for (let at = text.indexOf(marker); at !== -1; at = text.indexOf(marker, at + 1)) {
    let depth = 1;
    let index = at + marker.length;
    const args = [];
    let argStart = index;
    for (; index < text.length; index += 1) {
      const character = text[index];
      if (character === '\'' || character === '"' || character === '`') {
        /* Skip the string literal so brackets inside it do not count. */
        const quote = character;
        index += 1;
        while (index < text.length && text[index] !== quote) {
          if (text[index] === '\\') index += 1;
          index += 1;
        }
        continue;
      }
      if (character === '(' || character === '{' || character === '[') depth += 1;
      else if (character === ')' || character === '}' || character === ']') depth -= 1;
      else if (character === ',' && depth === 1) {
        args.push(text.slice(argStart, index).trim());
        argStart = index + 1;
      }
      if (depth === 0) {
        args.push(text.slice(argStart, index).trim());
        break;
      }
    }
    /* args[0] is the element type, args[1] the props; anything after is a child. */
    for (const child of args.slice(2)) {
      if (/^\{[\s\S]*\}$/u.test(child) && /\b(ref|style|key)\b/u.test(child)) {
        found.push(child.replace(/\s+/gu, ' ').slice(0, 90));
      }
    }
  }
  return found;
}

test('no createElement call passes a props object in a child slot', () => {
  assert.deepEqual(objectChildren(source), []);
});

test('the scanner does catch the shape that broke the terminal dock', () => {
  /* Positive control: the exact bug (a `{ ref, style }` object in the child list). */
  const buggy = [
    'React.createElement(',
    "  'span',",
    "  { style: styles.toolbar },",
    '  React.createElement(ToolbarButton, { icon: "newFile" }),',
    "  { ref: newButtonRef, style: { display: 'inline-flex' } },",
    "  React.createElement('b', null),",
    ');',
  ].join('\n');
  assert.equal(objectChildren(buggy).length, 1);
  /* A props object in the second slot is legal and must not be flagged. */
  assert.deepEqual(objectChildren("React.createElement('span', { ref: node, style: s });"), []);
});

test('the terminal toolbar puts the clipboard notice and new-tab button in one span', () => {
  assert.match(source, /React\.createElement\(\n\s+'span',\n\s+\{ ref: newButtonRef, style: \{ display: 'inline-flex', alignItems: 'center', gap: 6 \} \},\n\s+clipboardNotice === null/);
});
