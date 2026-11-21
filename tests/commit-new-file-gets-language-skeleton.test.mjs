import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { loadTypeScriptFunction } from './ts-source.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source =
  readFileSync(join(root, 'src/client/editor-workspace.tsx'), 'utf8') +
  '\n' +
  readFileSync(join(root, 'src/client/components/search/FindToolWindow.tsx'), 'utf8') +
  '\n' +
  readFileSync(join(root, 'src/client/components/search/QuickOpen.tsx'), 'utf8');
const host = readFileSync(join(root, 'lib/index.js'), 'utf8');
const revisionPickerSource = readFileSync(join(root, 'src/client/components/commit/RevisionPicker.tsx'), 'utf8');
const moveToPickerSource = readFileSync(join(root, 'src/client/components/commit/MoveToPicker.tsx'), 'utf8');
const quickOpenSource = readFileSync(join(root, 'src/client/components/search/QuickOpen.tsx'), 'utf8');
const stylesSource = readFileSync(join(root, 'src/client/ui/styles.ts'), 'utf8');
const fileTemplateModel = readFileSync(
  join(root, 'src/client/components/editor/editor-file-template-model.ts'),
  'utf8',
);

const templateFor = loadTypeScriptFunction(fileTemplateModel, 'templateFor');

/* ── New from Template ──────────────────────────────────────────────────── */

test('a new file gets its language skeleton', () => {
  /* IDEA's File Templates are per language; a blank `.ts` is not the same file
     as one with an export marker, and every toolchain treats them differently. */
  assert.equal(templateFor('a.ts'), 'export {};\n');
  assert.equal(templateFor('a.tsx'), 'export {};\n');
  assert.equal(templateFor('a.md'), '# a\n');
  assert.equal(templateFor('a.py'), '"""a."""\n');
  assert.equal(templateFor('a.json'), '{}\n');
  assert.equal(templateFor('a.go'), 'package main\n');
  assert.equal(templateFor('a.c'), '#include <stdio.h>\n\nint main(void) {\n  return 0;\n}\n');
  assert.equal(templateFor('a.cpp'), '#include <iostream>\n\nint main() {\n  return 0;\n}\n');
  assert.equal(templateFor('a.h'), '#pragma once\n\n');
  assert.equal(templateFor('a.hpp'), '#pragma once\n\n');
  assert.match(templateFor('a.sh'), /^#!\/usr\/bin\/env bash\nset -euo pipefail\n$/);
  assert.match(templateFor('index.html'), /^<!doctype html>/);
});

test('the extension decides, and an unknown one stays blank', () => {
  assert.equal(templateFor('README.MD'), '# README\n', 'the extension is case-insensitive');
  assert.equal(templateFor('notes.txt'), '', 'no opinion for an unknown extension');
  assert.equal(templateFor('Makefile'), '', 'a dotless name has no extension to read');
  assert.equal(templateFor(''), '');
  assert.equal(templateFor('.env'), '', 'a leading-dot name is not "extension env"');
  assert.equal(templateFor('trailing.'), '');
});

test('creating a file writes the skeleton, and the toggle can suppress it', () => {
  const create = source.slice(
    source.indexOf('const createEntry = React.useCallback('),
    source.indexOf('/* IDEA\'s "Reveal in Finder"'),
  );
  assert.match(create, /if \(\s+createState\.kind === 'file' &&\s+createState\.template !== false\s+\)/);
  assert.match(create, /const skeleton = templateFor\(name\);/);
  /* The file exists first: a template write failure must not mean "no file". */
  assert.match(create, /await callFs(?:<[^>]+>)?\(\{ op: 'create', path, kind: createState\.kind \}\);/);
  assert.match(create, /op: 'write',[\s\S]*?path,[\s\S]*?content: skeleton,[\s\S]*?force: true,[\s\S]*?create: true,/);
  /* Templates are ON by default, the way IDEA opens the dialog. */
  assert.match(source, /setCreateState\(\{\s+kind,\s+parent,\s+value: '',\s+template: true,\s+\}\);/);
});

/* ── Move to… (F6) ─────────────────────────────────────────────────────── */

test('the destination list comes from the host, not the expanded rows', () => {
  /* A move usually targets a folder the user has NOT opened; building the list
     from `rows` would silently omit exactly that folder. */
  const open = source.slice(
    source.indexOf('const openMoveTo = React.useCallback('),
    source.indexOf("/* IDEA's project-tree context menu"),
  );
  assert.match(
    open,
    /await callFs(?:<[^>]+>)?\(\s*\{ op: 'directories' \},\s*\{ signal: searchAbort\.signal \},?\s*\)/,
  );
  assert.doesNotMatch(open, /rows\.filter/);
  /* The current parent is carried so the picker can mark "already there". */
  assert.match(open, /parent,/);
});

test('the host walks directories breadth-first and always includes the root', () => {
  assert.match(host, /case 'directories':/);
  assert.match(host, /return ok\(await listWorkspaceDirectories\(root\)\);/);
  const walk = host.slice(
    host.indexOf('async function listWorkspaceDirectories('),
    host.indexOf('async function describePaths('),
  );
  assert.match(walk, /const directories = \[''\];/);
  assert.match(walk, /if \(entry\.kind !== 'directory'\) continue;/);
  /* Bounded, like the quick-open walk: a huge repo must not hang the picker. */
  assert.match(walk, /limit = 1000/);
  assert.match(walk, /truncated = true;/);
});

test('F6 moves, ⇧F6 renames, and both are in the row menu', () => {
  const handler = source.slice(
    source.indexOf('const onTreeKeyDown = React.useCallback('),
    source.indexOf('const toggleCommitPath = React.useCallback('),
  );
  assert.match(handler, /case 'F6':/);
  assert.match(handler, /if \(event\.shiftKey\) \{/);
  assert.match(handler, /if \(event\.shiftKey\) \{\n\s+setRenameState/);
  assert.match(handler, /void openMoveTo\(/);
  assert.match(source, /id: 'moveTo',\n\s+label: t\('editor\.moveTo'\),\n\s+shortcut: 'F6',/);
});

test('the picker reuses the shared palette chrome', () => {
  const picker = moveToPickerSource;
  assert.match(picker, /styles\.paletteBackdrop/);
  assert.match(picker, /styles\.paletteRow/);
  /* Marking the current parent makes Enter-on-it read as "already there". */
  assert.match(picker, /directory === \(state\.parent \?\? ''\)/);
  assert.match(picker, /t\('editor\.moveToCurrent'\)/);
});

/* ── the suite must fail on a file that does not parse ──────────────────── */

test('a syntax error is caught before it reaches the browser', () => {
  /* Every other test here asserts on source TEXT, so a file with a broken brace
     passed all 580 of them while the plugin refused to import — the browser said
     "Failed to load plugins / import failed". This reproduces that failure on a
     throwaway copy and proves `--check` rejects it. */
  const scratch = mkdtempSync(join(tmpdir(), 'dsh-editor-syntax-'));
  try {
    const broken = join(scratch, 'broken.js');
    writeFileSync(broken, 'function a() {\n  return 1;\n', 'utf8');
    assert.throws(() => execFileSync(process.execPath, ['--check', broken], { stdio: 'pipe' }), /Command failed/);
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
});

/* ── the palette list must not collapse inside an auto-height dialog ─────── */

test('the palette list contributes its content height', () => {
  /* Measured before the fix: Go to File had 17 rows and rendered a 45px dialog
     with an 8px list, `overflow: hidden` clipping every row — the picker looked
     like a bare input. Root cause: `flex: 1 1 0` (zero basis) inside a column
     whose height is `auto`, so the circular sizing resolved to "list is empty".
     `auto` contributes the rows; `minHeight: 0` still lets them scroll inside
     the dialog's 56vh cap. */
  const start = stylesSource.indexOf('  paletteList: {');
  assert.notEqual(start, -1, 'paletteList style is missing');
  const block = stylesSource.slice(start, stylesSource.indexOf('  },', start));
  assert.match(block, /flex: '1 1 auto'/, 'a zero flex-basis collapses an auto-height dialog');
  assert.doesNotMatch(block, /flex: '1 1 0'/);
  /* Keep the scroll contract the cap depends on. */
  assert.match(block, /minHeight: 0/);
  assert.match(block, /overflow: 'auto'/);
  /* The dialog itself must still cap its height, or a long list runs off-screen. */
  const dialog = stylesSource.slice(stylesSource.indexOf('  palette: {'), stylesSource.indexOf('  paletteInput: {'));
  assert.match(dialog, /maxHeight: '56vh'/);
});

test('every palette-based picker renders rows through the shared list style', () => {
  /* Go to File, Compare with Revision and Move to… all share `paletteList`;
     the collapse bug hit all three at once, so all three must stay on it. */
  const bodies = [
    ['QuickOpen', quickOpenSource],
    ['RevisionPicker', revisionPickerSource],
    ['MoveToPicker', moveToPickerSource],
  ];
  for (const [name, body] of bodies) {
    assert.match(body, /styles\.paletteList/, `${name} must use the shared list`);
    assert.match(body, /styles\.paletteRow/, `${name} must use the shared row`);
  }
});
