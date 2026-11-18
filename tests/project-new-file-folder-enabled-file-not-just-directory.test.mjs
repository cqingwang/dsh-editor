import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { menuSource } from './ui-sources.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = [
  readFileSync(join(root, 'src/client/editor-workspace.tsx'), 'utf8'),
  readFileSync(join(root, 'src/client/injected-css.ts'), 'utf8'),
  readFileSync(join(root, 'src/client/ui/styles.ts'), 'utf8'),
  readFileSync(join(root, 'src/client/locales.ts'), 'utf8'),
  menuSource,
].join('\n');

/** The project-tree context menu body. */
function treeMenu() {
  return source.slice(source.indexOf('const buildTreeMenu = React.useCallback('));
}

/* ── New File / New Folder must work on files too ───────────────────────── */

test('new file and folder are enabled for a file, not just a directory', () => {
  /* The report: these two were greyed out on a file, so the only way to add a
     sibling was to right-click its folder first. `disabled: !isDirectory` also
     read as "broken", since nothing else in the menu was greyed. */
  const menu = treeMenu();
  const newFile = menu.slice(menu.indexOf("id: 'newFile'"), menu.indexOf("id: 'newFolder'"));
  const newFolder = menu.slice(menu.indexOf("id: 'newFolder'"), menu.indexOf("id: 'rename'"));
  for (const [label, block] of [['newFile', newFile], ['newFolder', newFolder]]) {
    assert.doesNotMatch(block, /disabled: !isDirectory/, `${label} must not be disabled for files`);
    /* A multi-row selection still has no single "sibling" to create beside. */
    assert.match(block, /disabled: batch\.length > 1/, `${label} must stay disabled for a batch`);
  }
});

test('a new entry lands beside the clicked entry', () => {
  /* Inside a directory, next to a file — the location the right-click pointed at. */
  const menu = treeMenu();
  assert.match(menu, /const createParent = isDirectory \? row\.path : dirname\(row\.path\);/);
  const newFile = menu.slice(menu.indexOf("id: 'newFile'"), menu.indexOf("id: 'newFolder'"));
  const newFolder = menu.slice(menu.indexOf("id: 'newFolder'"), menu.indexOf("id: 'rename'"));
  assert.match(newFile, /run: \(\) => startCreate\('file', createParent\),/);
  assert.match(newFolder, /run: \(\) => startCreate\('directory', createParent\),/);
  /* Not the row itself: for a file that would be a path inside a file. */
  assert.doesNotMatch(newFile, /startCreate\('file', row\.path\)/);
  assert.doesNotMatch(newFolder, /startCreate\('directory', row\.path\)/);
});

test('creating from a file uses that file"s directory', async () => {
  /* Executed, not just matched: `startCreate(kind, parent)` addresses the host
     with `parent + '/' + name`, so the parent must be the file's directory. */
  const { workspaceFileOperations } = await import('../lib/index.js');
  const { mkdtemp, mkdir, writeFile, rm, stat } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const dir = await mkdtemp(join(tmpdir(), 'dsh-editor-r154-'));
  try {
    await mkdir(join(dir, 'src', 'deep'), { recursive: true });
    await writeFile(join(dir, 'src', 'deep', 'a.ts'), 'x\n');
    /* Sibling of `src/deep/a.ts` is `src/deep/<name>` — what dirname() yields. */
    const parent = dirname('src/deep/a.ts');
    assert.equal(parent, 'src/deep');
    /* `create` is the explicit "make a new file" path; a plain write refuses to
       resurrect a path that does not exist yet. */
    const created = await workspaceFileOperations.write(dir, `${parent}/created.ts`, 'y\n', undefined, true, true);
    assert.equal(created.path, 'src/deep/created.ts');
    assert.equal((await stat(join(dir, 'src', 'deep', 'created.ts'))).isFile(), true);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

/* ── Menu rows need the same hover affordance as every other row ────────── */

test('a hovered menu row uses the selected-row fill, not the faint wash', () => {
  /* The faint `bg-hover` wash was almost invisible on a 24px row over a raised
     menu, so this now matches the tree's selected file exactly: the same
     `state-business-primary` token with white text. */
  assert.match(source, /'\.dsh-editor-menu-item:enabled:hover \{ background: var\(--dsw-alias-state-business-primary\); color: #fff !important; \}',/);
  /* The tree's selected row uses the same token, which is what makes them match. */
  const selected = source.slice(source.indexOf('treeRowSelected: {'), source.indexOf('treeRowSelectedSoft: {'));
  assert.match(selected, /background: 'var\(--dsw-alias-state-business-primary\)',/);
  assert.match(selected, /color: '#fff',?/);
  /* The old wash must be gone, or the two would disagree. */
  const hoverRule = source.slice(source.indexOf("'.dsh-editor-menu-item:enabled:hover"), source.indexOf("'.dsh-editor-tree-row-selected:hover"));
  assert.doesNotMatch(hoverRule, /interactive-bg-hover\)/);
});

test('menu rows paint no background of their own', () => {
  /* Dropping the inline `background` (needed for the hover rule to win) let the
     rows fall back to the browser's default button face — a light grey that
     showed between the separator's margins and made the menu look banded. The
     reset has to be a CLASS, not inline, or `:enabled:hover` would lose again. */
  assert.match(source, /'\.dsh-editor-menu-item \{ background: transparent; appearance: none; -webkit-appearance: none; \}',/);
  const style = source.slice(source.indexOf('menuItem: {'), source.indexOf('menuItemDanger: {'));
  assert.doesNotMatch(style, /background:/, 'an inline background would defeat the reset and the hover rule');
});

test('the separator is a hairline border, not a filled block', () => {
  /* A 1px-tall div with its own `background` painted a solid band; the row's
     margins meant the band did not even reach the edges, so it read as the menu
     breaking apart. A top border of the same colour draws the same line. */
  const separator = source.slice(source.indexOf('menuSeparator: {'), source.indexOf('workArea: {'));
  assert.match(separator, /borderTop: '1px solid var\(--dsw-alias-border-l3\)',?/);
  assert.doesNotMatch(separator, /background:/);
  assert.match(separator, /height: 0,/);
});

test('a danger row and the shortcut column stay legible on that fill', () => {
  /* Both set their colour inline, which outranks a plain class rule; hence the
     dedicated classes and `!important`. Without this a red "Delete" stayed red
     on blue, and the shortcut column stayed grey. */
  assert.match(menuSource, /className=\{item\.danger \? 'dsh-editor-menu-item dsh-editor-menu-danger' : 'dsh-editor-menu-item'\}/);
  assert.match(menuSource, /className=\{child\.danger \? 'dsh-editor-menu-item dsh-editor-menu-danger' : 'dsh-editor-menu-item'\}/);
  assert.match(source, /'\.dsh-editor-menu-item:enabled:hover \.dsh-editor-menu-shortcut \{ color: rgba\(255, 255, 255, 0\.82\) !important; \}',/);
  assert.match(source, /'\.dsh-editor-menu-item:enabled:hover \.dsh-editor-menu-danger \{ color: #fff !important; \}',/);
  /* Every shortcut span is tagged so that rule can reach it. */
  const spans = menuSource.split("className='dsh-editor-menu-shortcut'").length - 1;
  assert.ok(spans >= 3, `expected the shortcut class on all three spans, found ${spans}`);
});

test('menu items highlight under the pointer', () => {
  /* The report: sliding onto an item gave no feedback, so it was unclear which
     action a click would run. Hover lives in the injected CSS next to the tree
     row's, not in the inline styles, so the layout objects stay small. */
  assert.match(source, /'\.dsh-editor-menu-item:enabled:hover \{ background: var\(--dsw-alias-state-business-primary\); color: #fff !important; \}',/);
  /* A greyed entry must stay flat: `:enabled` excludes it. */
  assert.doesNotMatch(source, /'\.dsh-editor-menu-item:hover \{/);
  /* Pressing keeps the selected fill rather than dimming it. */
  assert.match(source, /'\.dsh-editor-menu-item:enabled:active \{ background: var\(--dsw-alias-state-business-primary\); color: #fff !important; \}',/);
  /* Keyboard focus is visible too, since the menu is driven by hover AND keys. */
  assert.match(source, /'\.dsh-editor-menu-item:focus-visible \{/);
});

test('the menu item carries no inline background that would outrank :hover', () => {
  /* The first attempt added the CSS rule and nothing happened: `styles.menuItem`
     set `background: 'transparent'` inline, and an inline declaration beats a
     class selector regardless of `:hover`. The tree row never had this problem
     because its background lives entirely in CSS. */
  const style = source.slice(source.indexOf('menuItem: {'), source.indexOf('menuItemDanger: {'));
  assert.doesNotMatch(style, /background:/, 'an inline background would defeat the hover rule');
  /* The selected/active states still paint, via the CSS class rather than inline. */
  assert.match(source, /'\.dsh-editor-menu-item:enabled:hover \{ background:/);
});

test('both the top-level menu and its submenus carry the hovered class', () => {
  /* One selector covers both because the child rows reuse the class; a submenu
     row that dropped it would look dead. Danger rows get the extra class. */
  const count = menuSource.split(/className=\{(?:item|child)\.danger \? 'dsh-editor-menu-item dsh-editor-menu-danger' : 'dsh-editor-menu-item'\}/).length - 1;
  assert.equal(count, 2, `expected the class on the top-level and child rows, found ${count}`);
});

test('the hover rule is injected with the other hover states', () => {
  /* Keeping it in the same CSS block as the tree row and toolbar button means
     one place to look, and it cannot drift from the variables in use. */
  const css = source.slice(source.indexOf("'.dsh-editor-tree-row:hover"));
  const menuRule = css.indexOf("'.dsh-editor-menu-item:enabled:hover");
  assert.ok(menuRule >= 0 && menuRule < 1200, 'the menu rule belongs with the other hover states');
});
