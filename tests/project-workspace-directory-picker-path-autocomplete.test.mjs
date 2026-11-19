import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const picker = await readFile(new URL('src/client/components/project/WorkspaceDirectoryPicker.tsx', root), 'utf8');
const locales = await readFile(new URL('src/client/locales.ts', root), 'utf8');

test('the path field exposes a keyboard-selectable directory autocomplete', () => {
  assert.match(picker, /role='combobox'/u);
  assert.match(picker, /aria-autocomplete='list'/u);
  assert.match(picker, /aria-controls='dsh-workspace-directory-suggestions'/u);
  assert.match(picker, /data-dsh-workspace-directory-suggestions=''/u);
  assert.match(picker, /workspaceDirectoryAutocompleteQuery\(pathDraft, homePathRef\.current\)/u);
  assert.match(picker, /workspaceDirectorySuggestions\(/u);
  assert.match(picker, /event\.key === 'ArrowDown' \|\| event\.key === 'ArrowUp'/u);
  assert.match(picker, /event\.key === 'Enter' && suggestionsOpen && suggestionIndex >= 0/u);
  assert.match(picker, /role='option'/u);
  assert.match(locales, /workspaceDirectorySuggestions:/u);
  assert.match(locales, /workspaceDirectoryNoSuggestions:/u);
});

test('the enter action resolves and reveals the typed path instead of tree selection only', () => {
  assert.match(picker, /const revealDirectoryPath = async \(pathValue: string\)/u);
  assert.match(picker, /directoryPathIsWithin\(rootPath, targetListing\.path\)/u);
  assert.match(picker, /const chain: string\[\] = \[\];/u);
  assert.match(picker, /setExpanded\(\(current\) => new Set\(\[\.\.\.current, rootPath, \.\.\.chain\]\)\)/u);
  assert.match(picker, /focusTreePath\(targetListing\.path\)/u);
  assert.match(picker, /return treeRef\.current;/u);
  assert.match(picker, /const enterPathDirectory = \(\): void =>/u);
  assert.match(picker, /void revealDirectoryPath\(pathDraft\.trim\(\)\)/u);
});

test('autocomplete options leave Tab order and the active option stays visible', () => {
  assert.match(picker, /const suggestionListRef = React\.useRef<HTMLDivElement \| null>\(null\)/u);
  assert.match(picker, /ref=\{suggestionListRef\}/u);
  assert.match(
    picker,
    /suggestionListRef\.current\?\.querySelector<HTMLElement>\(\s*'\[role="option"\]\[aria-selected="true"\]',?\s*\)/u,
  );
  assert.match(picker, /scrollIntoView\?\.\(\{ block: 'nearest' \}\)/u);
  assert.match(picker, /tabIndex=\{-1\}/u);
});

test('typing a new prefix clears stale suggestions before the next request settles', () => {
  assert.match(
    picker,
    /if \(composingRef\.current\) \{[\s\S]*?return;\s*\}[\s\S]*?setSuggestions\(\[\]\);\s*setSuggestionIndex\(-1\);\s*setSuggestionsLoading\(true\);\s*setSuggestionError\(null\);\s*setSuggestionsOpen\(true\);/u,
  );
});

test('a failed suggestion request is not presented as an empty directory match', () => {
  assert.match(picker, /const \[suggestionError, setSuggestionError\] = React\.useState<string \| null>\(null\)/u);
  assert.match(
    picker,
    /setSuggestionError\(\s*t\('editor\.workspaceDirectoryLoadFailed', \{ message: failureText\(reason, t\) \}\),?\s*\);/u,
  );
  assert.match(picker, /suggestionError !== null \? \(/u);
  assert.match(picker, /role='alert'[\s\S]*?\{suggestionError\}/u);
});

test('IME composition suspends suggestions until the path is committed', () => {
  assert.match(picker, /const composingRef = React\.useRef\(false\)/u);
  assert.match(
    picker,
    /onCompositionStart=\{\(\) => \{\s*composingRef\.current = true;[\s\S]*?setSuggestionsOpen\(false\);\s*\}\}/u,
  );
  assert.match(
    picker,
    /onCompositionEnd=\{\(event\) => \{\s*composingRef\.current = false;[\s\S]*?setSuggestionsOpen\(true\);\s*\}\}/u,
  );
  assert.match(
    picker,
    /onChange=\{\(event\) => \{[\s\S]*?if \(composingRef\.current\) \{[\s\S]*?return;\s*\}[\s\S]*?setSuggestionsLoading\(true\);/u,
  );
});

test('relative path text closes suggestions instead of browsing the filesystem root', () => {
  assert.match(
    picker,
    /if \(query === null\) \{[\s\S]*?setSuggestionsLoading\(false\);[\s\S]*?setSuggestionError\(null\);[\s\S]*?setSuggestionsOpen\(false\);[\s\S]*?return undefined;\s*\}/u,
  );
});
