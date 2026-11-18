import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source =
  (await readFile(new URL('../src/client/components/search/SearchEverywhere.tsx', import.meta.url), 'utf8')) +
  '\n' +
  (await readFile(new URL('../lib/client.js', import.meta.url), 'utf8')) +
  '\n' +
  (await readFile(new URL('../src/client/components/search/FindToolWindow.tsx', import.meta.url), 'utf8'));

test('right split opening accepts an optional text location', () => {
  assert.match(source, /const openInRightSplit = React\.useCallback\(async \(target, location = null\) =>/);
  assert.match(source, /if \(location !== null && lastOpened === location\.path\)/);
  assert.match(source, /revealSplitLocation\(lastOpened, location\.line, location\.column\)/);
});

test('split location reveal waits for the split model and clamps to it', () => {
  const start = source.indexOf('const revealSplitLocation = React.useCallback');
  const end = source.indexOf('const openInRightSplit = React.useCallback', start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const reveal = source.slice(start, end);
  assert.match(reveal, /splitEditorRef\.current/);
  assert.match(reveal, /getLineCount\(\)/);
  assert.match(reveal, /getLineMaxColumn\(safeLine\)/);
  assert.match(reveal, /revealLineInCenter\(safeLine\)/);
  assert.match(reveal, /setSelection\(new window\.monaco\.Range/);
  assert.match(reveal, /editor\.focus\(\)/);
  assert.match(reveal, /requestAnimationFrame\(reveal\)/);
});

test('Search Everywhere and Find pass location only for text results', () => {
  assert.match(
    source,
    /onOpenInRightSplit: \(\) => \{[\s\S]{0,100}onClose\(\);[\s\S]{0,220}onOpenInRightSplit\([\s\S]{0,100}result\.path,[\s\S]{0,160}result\.kind === 'text'/,
  );
  assert.match(
    source,
    /onOpenInRightSplit: \(\) =>\s+onOpenInRightSplit\(\s+result\.path,[\s\S]{0,180}result\.kind === 'text'/u,
  );
});

test('Editor forwards the split location without changing file-result behavior', () => {
  assert.match(source, /onOpenInRightSplit: \(path, location\) => void openInRightSplit\(path, location\)/g);
});

test('right-clicking a Search Everywhere result does not activate and close the dialog', () => {
  const dialog = source.slice(source.indexOf('function SearchEverywhere('), source.indexOf('function FindToolWindowView('));
  assert.match(dialog, /onMouseDown: \(event\) => \{\s+if \(event\.button !== 0\) return;\s+event\.preventDefault\(\);/);
});
