import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'lib/client.js'), 'utf8');

test('the composer placeholder lets clicks through to the input', () => {
  /* The placeholder is an absolutely positioned layer sitting on top of the
     contenteditable input. It shipped with `pointer-events: auto`, so in the split
     view clicking the input hit the placeholder and the caret never appeared. */
  assert.match(source, /\[data-dsh-editor-active\] \[data-composer-seat\] \[data-composer-placeholder\] \{\',\n\s+'  pointer-events: none !important;/);
});

test('the rule only applies inside the editor split', () => {
  const start = source.indexOf("'[data-dsh-editor-active] [data-composer-seat] [data-composer-placeholder] {',");
  assert.notEqual(start, -1);
  const block = source.slice(start, start + 200);
  assert.match(block, /pointer-events: none !important;/);
});

test('the placeholder rule outranks the broad pointer-events rule', () => {
  /* Two `!important` rules matched; the plain form lost on specificity to
     `[data-slot="conversation.session"] *`. The seat-qualified selector wins. */
  const broad = source.indexOf("[data-slot=\"conversation.session\"] *'");
  const placeholder = source.indexOf("'[data-dsh-editor-active] [data-composer-seat] [data-composer-placeholder] {',");
  assert.ok(broad !== -1 && placeholder !== -1);
  assert.ok(placeholder > broad, 'the placeholder rule must come after the broad one');
});
