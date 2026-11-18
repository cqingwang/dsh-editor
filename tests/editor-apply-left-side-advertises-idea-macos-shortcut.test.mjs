import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = (await readFile(new URL('../src/client/components/diff/DiffPreview.tsx', import.meta.url), 'utf8')) + '\n' + (await readFile(new URL('../lib/client.js', import.meta.url), 'utf8'));
const diff = source.slice(source.indexOf('function DiffPreview('), source.indexOf('export { DiffPreview };'));

test('Apply Left Side advertises the IDEA macOS shortcut', () => {
  assert.match(diff, /id: 'applyLeftSide'[\s\S]*?shortcut: '⌃⌘→'/);
  assert.doesNotMatch(diff, /shortcut: '⌃⌥R'/);
});

test('Apply Left Side consumes control-meta-right without alt or shift', () => {
  assert.match(
    diff,
    /event\.ctrlKey &&\s+event\.metaKey &&\s+!event\.altKey &&\s+!event\.shiftKey &&\s+event\.key === 'ArrowRight'/u,
  );
  assert.doesNotMatch(
    diff,
    /event\.ctrlKey &&\s+event\.altKey &&\s+!event\.metaKey &&\s+!event\.shiftKey &&\s+event\.key\.toLowerCase\(\) === 'r'/u,
  );
});
