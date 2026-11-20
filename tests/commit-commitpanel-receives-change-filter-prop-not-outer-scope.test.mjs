import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { loadTypeScriptFunction, transpileTypeScriptFunction } from './ts-source.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source =
  readFileSync(join(root, 'src/client/components/commit/CommitPanel.tsx'), 'utf8') +
  '\n' +
  readFileSync(join(root, 'src/client/editor-workspace.tsx'), 'utf8') +
  '\n' +
  readFileSync(join(root, 'src/client/components/diff/DiffPreview.tsx'), 'utf8');
const stylesSource = readFileSync(join(root, 'src/client/ui/styles.ts'), 'utf8');
const editorCoreSource = readFileSync(join(root, 'src/client/editor-core.ts'), 'utf8');
const pathLabelSource = readFileSync(join(root, 'src/client/components/ui/PathLabel.tsx'), 'utf8');
const annotatePreviewSource = readFileSync(join(root, 'src/client/components/diff/AnnotatePreview.tsx'), 'utf8');

/** Slice one `styles.<name> = { … }` / `name: { … }` block by brace balance. */
function styleBlock(name) {
  const marker = `  ${name}: {`;
  const start = stylesSource.indexOf(marker);
  assert.notEqual(start, -1, `styles.${name} is missing from styles.ts`);
  let index = stylesSource.indexOf('{', start);
  let depth = 0;
  for (; index < stylesSource.length; index += 1) {
    if (stylesSource[index] === '{') depth += 1;
    else if (stylesSource[index] === '}') {
      depth -= 1;
      if (depth === 0) return stylesSource.slice(start, index + 1);
    }
  }
  throw new Error(`unbalanced braces in styles.${name}`);
}

/** The props destructured by CommitPanel, from its signature to the body. */
function commitPanelProps() {
  const start = source.indexOf('function CommitPanel({');
  const end = source.indexOf('}: CommitPanelProps) {', start);
  assert.notEqual(start, -1, 'CommitPanel is missing');
  assert.notEqual(end, -1, 'CommitPanel signature is missing');
  return source.slice(start, end);
}

/**
 * Read the `renderGroup` body, from its declaration to the next top-level
 * marker, so an unrelated function growing does not silently empty the slice.
 */
function renderGroupBody() {
  const start = source.indexOf('  const renderGroup = (group');
  const end = source.indexOf('  return (\n    <React.Fragment>', start);
  assert.notEqual(start, -1, 'renderGroup is missing');
  assert.notEqual(end, -1, 'renderGroup end marker moved');
  return source.slice(start, end);
}

/* ── the crash this round started from ───────────────────────────────── */

test('CommitPanel receives the change filter as a prop, not from an outer scope', () => {
  /* Measured before the fix: the Commit tab threw
     `ReferenceError: pathQuery is not defined` and rendered ZERO rows, because
     the state lives on the workspace component and was never passed down. The
     text-match tests all passed — they only looked for `filterChanges(...)` in
     the source. This test pins the wiring, not the spelling. */
  const props = commitPanelProps();
  assert.match(props, /^\s+pathQuery = ''/mu, 'pathQuery must be a CommitPanel prop');
  assert.match(props, /^\s+onPathQuery,/mu, 'the setter must be passed in too');
  /* Every use inside the panel must be the prop; a bare setter is the old bug. */
  assert.doesNotMatch(source, /setPathQuery\(event\.target\.value\)/, 'the filter must call onPathQuery');
  assert.match(source, /onChange=\{\(event\) => onPathQuery\?\.\(event\.target\.value\)\}/);
  assert.match(source, /placeholder=\{t\('editor\.changeFilterPlaceholder'\)\}/);
  /* And the call site must actually hand them over. */
  assert.match(source, /onPathQuery=\{setPathQuery\}/);
});

test('the change filter narrows what is shown and never the selection', () => {
  assert.match(source, /changes: filterChanges\(group\.changes, pathQuery\)/);
  assert.match(source, /\.filter\(\(group\) => group\.changes\.length > 0 \|\| pathQuery === ''\)/);
  /* The hint shown when nothing matches is the "no matches" one, not "no changes". */
  assert.match(
    source,
    /visibleGroups\.length === 0 \? \(\s*<div style=\{styles\.treeMessage\}>\{t\('editor\.noMatches'\)\}<\/div>\s*\) : \(/u,
  );
});

/* ── IDEA's rule: the NAME keeps its width, the path gives way ───────── */

test('a changed file name is never ellipsized', () => {
  /* The reported symptom: `engineering-m…` next to a short grey path in a
     tool window that still had free space. The name had `minWidth: 0` +
     `textOverflow: ellipsis` like every other label, so flex was free to
     shrink it first (flex-shrink applies to the widest item with the most
     surplus). */
  const block = styleBlock('commitFileName');
  assert.doesNotMatch(block, /textOverflow: 'ellipsis'/, 'the name must not ellipsize');
  assert.doesNotMatch(block, /overflow: 'hidden'/, 'a clipped flex item still clips');
  assert.match(block, /flex: '0 0 auto'/, 'the name must not shrink');
  assert.match(block, /minWidth: 'max-content'/, 'the name keeps its intrinsic width');
  assert.match(block, /whiteSpace: 'nowrap'/, 'a name never wraps onto a second line');
  assert.match(block, /label-primary/, 'IDEA paints the name in the emphasised colour');
});

test('the muted parent path is the part that shrinks', () => {
  const block = styleBlock('commitFileDir');
  assert.match(block, /minWidth: 0/);
  assert.match(block, /overflow: 'hidden'/);
  assert.match(block, /textOverflow: 'ellipsis'/);
  /* Directory and file rows share one grid node; the wrapping/nowrap rule
     moved there when the columns were unified. */
  const row = styleBlock('commitTreeNode');
  assert.match(row, /whiteSpace: 'nowrap'/);
  /* The row itself must be allowed to shrink inside the scrolling column. */
  assert.match(row, /minWidth: 0/);
});

test('the same rule holds for a directory row and its name', () => {
  /* The directory row was the same bug one indent up: `r147ne…` while the
     "N files" chip and the parent path kept their width. */
  const name = styleBlock('commitDirName');
  assert.doesNotMatch(name, /textOverflow: 'ellipsis'/);
  assert.match(name, /flex: '0 0 auto'/);
  assert.match(name, /minWidth: 'max-content'/);
  const row = styleBlock('commitDirRow');
  assert.match(row, /minWidth: 0/);
});

test('the file name is rendered as its own unclipped span, with a full-path tooltip', () => {
  const body = renderGroupBody();
  /* `row.name` is the basename — the same value IDEA prints first. */
  assert.match(body, /<span style=\{styles\.commitFileName\}>\{row\.name\}<\/span>/u);
  /* A pathologically long name in a 180px tool window can exceed the pane;
     IDEA scrolls there too, so the tooltip has to spell the path out. */
  assert.match(body, /<CommitSecondaryPath/);
  assert.match(body, /title=\{change\.path\}/);
});

test('no change-row label keeps both a clamp and an ellipsis', () => {
  /* Guard the class of bug rather than the two instances: inside the change
     list, an ellipsized NAME is what made the row unreadable. The group label
     and the path may ellipsize — they are not names. */
  for (const name of ['commitFileDir']) {
    assert.match(styleBlock(name), /textOverflow: 'ellipsis'/, `${name} should still ellipsize`);
  }
  for (const name of ['commitGroupLabel', 'commitFileName', 'commitDirName']) {
    assert.doesNotMatch(styleBlock(name), /textOverflow: 'ellipsis'/, `${name} must stay whole`);
  }
});

/* ── the layout must not regress into a horizontal scroll ─────────────── */

test('the group header still hides a long branch chip instead of pushing the row', () => {
  /* The group header carries the branch badge; it is the one row that must
     keep a hard width so the change count and the action buttons stay put. */
  const header = stylesSource.slice(
    stylesSource.indexOf('  commitGroupHeader: {'),
    stylesSource.indexOf('  commitGroupLabel: {'),
  );
  assert.match(header, /height: 24/);
  assert.match(header, /whiteSpace: 'nowrap'/);
});

/* ── the diff header's path, the same rule one pane over ──────────────── */

/** Load `splitPathLabel` — a pure function, so it can be executed for real. */
function loadSplitPathLabel() {
  return loadTypeScriptFunction(pathLabelSource, 'splitPathLabel');
}

test('splitPathLabel keeps the name whole and the parent as its prefix', () => {
  const split = loadSplitPathLabel();
  assert.deepEqual(split('a/b/c.ts'), { dir: 'a/b', name: 'c.ts' });
  assert.deepEqual(split('c.ts'), { dir: '', name: 'c.ts' });
  /* No trailing slash: the label is direction:rtl, where a neutral `/` before
     the first strong character is reordered to the front (`/a/b`). */
  assert.doesNotMatch(split('a/b/c.ts').dir, /\/$/);
  assert.deepEqual(split(''), { dir: '', name: '' });
  assert.deepEqual(split(undefined), { dir: '', name: '' });
});

test('one PathLabel serves both diff and annotate headers', () => {
  /* Both headers used to inline `target?.path` into a shrinkable ellipsis box,
     so the NAME was what got cut (`r147nest/engineering-memory-and-d…`). */
  assert.equal((source.match(/<PathLabel\s+path=\{target\?\.path \?\? ''\}/gu) ?? []).length, 1);
  assert.match(annotatePreviewSource, /<PathLabel\s+path=\{target\?\.path \?\? ''\}/u);
  assert.doesNotMatch(source, /style=\{styles\.diffTitle\}>target\?\.path/u);
  /* The name is rendered first so a squeezed header spends its width on it. */
  const body = pathLabelSource.slice(pathLabelSource.indexOf('export function PathLabel('));
  assert.match(body, /parts\.name/);
  assert.ok(body.indexOf('parts.name') < body.indexOf('parts.dir'), 'the name must come before the path');
  assert.match(body, /title=\{typeof path === 'string' \? path : ''\}/, 'the full path stays reachable');
});

test('the label styles let the path give way and the name survive', () => {
  const name = styleBlock('pathLabelName');
  assert.match(name, /flex: '0 0 auto'/);
  assert.doesNotMatch(name, /textOverflow: 'ellipsis'/);
  const dir = styleBlock('pathLabelDir');
  assert.match(dir, /flex: '0 1 auto'/);
  assert.match(dir, /direction: 'rtl'/);
  assert.match(styleBlock('pathLabel'), /overflow: 'hidden'/);
});

/* ── the path suffix says "directory", not "second file" ─────────────── */

test('the parent path is printed with a trailing slash, root falls back to the project', () => {
  /* `note.md  spark` read as two files on one row; IDEA prints `spark/`. */
  const parentDirLabel = new Function(
    'dirname',
    `${transpileTypeScriptFunction(editorCoreSource, 'parentDirLabel')}\nreturn parentDirLabel;`,
  )((p) => {
    const cut = p.lastIndexOf('/');
    return cut < 0 ? '' : p.slice(0, cut);
  });
  const fn = (path) => parentDirLabel(path);
  assert.equal(fn('spark/note.md'), 'spark/');
  assert.equal(fn('r147nest/deep/inner/x.ts'), 'r147nest/deep/inner/');
  assert.equal(fn('README.md'), '');
  /* The row falls back to the project name for a root-level file. */
  assert.match(renderGroupBody(), /parentDirLabel\(change\.path\) \|\| projectName/);
});
