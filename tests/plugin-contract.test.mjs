import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(root, path), 'utf8');
const readClient = () =>
  readFileSync(join(root, 'src/client/components/diff/DiffPreview.tsx'), 'utf8') + '\n' + read('lib/client.js');

test('package declares the bundle patch and the browser client', () => {
  const manifest = JSON.parse(read('package.json'));
  assert.equal(manifest.name, 'dsh-editor');
  assert.equal(manifest.dsh.bundle.patch, './cordis.patch.yml');
  assert.equal(manifest.dsh.client.platform, 'web');
  assert.equal(manifest.exports['./client'].default, './lib/client.js');
  /* Round 151: the runtime libraries are DEPENDENCIES, not vendored files.
     Round 157 moved the last shared module out of `assets/` into `lib/`, so the
     manifest ships code only — there is no `assets/` tree left. */
  assert.ok(manifest.files.includes('lib/link-parser.mjs'));
  assert.ok(manifest.files.includes('lib/client.js'));
  assert.ok(!manifest.files.some((pattern) => pattern.startsWith('assets/')));
  assert.equal(manifest.dependencies['monaco-editor'], '0.52.2');
  assert.equal(manifest.dependencies['@xterm/xterm'], '6.0.0');
  assert.equal(manifest.dependencies['@xterm/addon-fit'], '0.11.0');
});

test('bundle patch mounts exactly one dsh-editor entry', () => {
  const patch = read('cordis.patch.yml');
  assert.match(patch, /id:\s*dsh-editor/);
  assert.match(patch, /name:\s*'dsh-editor'/);
});

test('host half registers the file API and exact Monaco asset routes', () => {
  const host = read('lib/index.js');
  assert.match(host, /\/api\/dsh-editor\/fs/);
  assert.match(host, /\/api\/dsh-editor\/monaco\/vs\//);
  assert.match(host, /walkMonaco/);
  assert.match(host, /resolveInside/);
  assert.match(host, /workingDirectory/);
});

test('client half keeps the resizable editor/chat split contract', () => {
  const client = readClient();
  assert.match(client, /data-dsh-editor-active/);
  /* The Editor is opened from the hero / workspace menu, not injected as a fourth
     tab beside the host's Chat, Context and Trajectory tabs. */
  assert.doesNotMatch(client, /setAttribute\('data-dsh-editor-tab'/);
  assert.match(client, /var\(--dsh-editor-chat-width, 35%\)/);
  /* Round 140 replaced the percentage margin with an offset variable: a % margin
     makes the parent's width depend on this child's, and a shrink-to-fit parent
     then grows on every pass (the "tab row keeps widening" bug). */
  assert.match(client, /margin-left: var\(--dsh-editor-chat-offset, 65%\) !important;/);
  /* Round 461 moved the Editor root to a stable overlay surface whose geometry
     is measured from the live Chat body. */
  assert.match(client, /host\.style\.width = `\$\{width\}px`/);
  assert.match(client, /flex:\s*'0 0 25%'/);
  assert.match(client, /flex:\s*'1 1 0'/);
  assert.match(client, /pointer-events:\s*none/);
});

test('host half mounts the terminal hub and its two exact routes', () => {
  const host = read('lib/index.js');
  const hub = read('lib/terminal.js');
  assert.match(host, /\/api\/dsh-editor\/terminal/);
  assert.match(host, /\/api\/dsh-editor\/terminal\/stream/);
  assert.match(host, /new TerminalHub/);
  assert.match(host, /terminalStreamResponse/);
  assert.match(hub, /spawnTerminal/);
  assert.match(hub, /class TerminalHub/);
  assert.match(hub, /MAX_BUFFER_BYTES/);
});

test('client half opens the terminal as a bottom dock with an ESM xterm import', () => {
  const client = readClient();
  assert.match(client, /import\('\/api\/dsh-editor\/xterm\/xterm\.mjs'\)/);
  assert.match(client, /import\('\/api\/dsh-editor\/xterm\/addon-fit\.mjs'\)/);
  assert.match(client, /styles\.dock/);
  assert.match(client, /terminalGeneration/);
  assert.match(client, /writeChain/);
  assert.doesNotMatch(client, /terminalPlaceholder/);
});

test('commit tool window splits staged and unstaged changes with an IDEA diff', () => {
  const client = readClient();
  const host = read('lib/index.js');
  assert.match(client, /function splitChanges/);
  assert.match(client, /function changeTreeOf/);
  assert.match(client, /readStoredText\('dsh-editor\.diff\.sideBySide', '1'\) !== '0'/);
  assert.match(client, /renderSideBySideInlineBreakpoint: 0/);
  assert.match(client, /renderMarginRevertIcon: canEdit/);
  assert.match(client, /diff\.updateOptions\(\{\s+renderSideBySide: sideBySide,\s+\}\)/u);
  assert.match(client, /diffTarget/);
  assert.match(host, /case 'stage':/);
  assert.match(host, /case 'diff':/);
  assert.match(host, /gitBranchInfo/);
});

test('the xterm runtime is resolved from its packages', () => {
  /* No vendored copy: the host maps each served URL to a file inside the
     installed package, resolved from `import.meta.url`. */
  const host = read('lib/index.js');
  const require_ = createRequire(join(root, 'lib/index.js'));
  for (const [specifier, suffix] of [
    ['@xterm/xterm/package.json', 'lib/xterm.mjs'],
    ['@xterm/addon-fit/package.json', 'lib/addon-fit.mjs'],
    ['@xterm/xterm/package.json', 'css/xterm.css'],
  ]) {
    const manifest = require_.resolve(specifier);
    assert.ok(existsSync(join(dirname(manifest), ...suffix.split('/'))), `${specifier} -> ${suffix} is missing`);
  }
  assert.match(host, /packagePath\('@xterm\/xterm\/lib\/xterm\.mjs'\)/);
  assert.match(host, /packagePath\('@xterm\/addon-fit\/lib\/addon-fit\.mjs'\)/);
  assert.match(host, /packagePath\('@xterm\/xterm\/css\/xterm\.css'\)/);
  assert.doesNotMatch(host, /assets\/xterm/);
});

test('Monaco is served from the installed package', () => {
  const host = read('lib/index.js');
  const require_ = createRequire(join(root, 'lib/index.js'));
  const monaco = dirname(require_.resolve('monaco-editor/package.json'));
  for (const path of [
    'min/vs/loader.js',
    'min/vs/editor/editor.main.js',
    'min/vs/editor/editor.main.css',
    'min/vs/base/worker/workerMain.js',
  ]) {
    assert.ok(existsSync(join(monaco, ...path.split('/'))), `monaco-editor/${path} is missing`);
  }
  /* The host derives the root from the package and walks it for exact routes. */
  assert.match(host, /packagePath\('monaco-editor\/package\.json', 'min\/vs'\)/);
  assert.match(host, /MONACO_ROOT === null \? \[\] : walkMonaco\(MONACO_ROOT\)/);
  assert.doesNotMatch(host, /assets\/monaco/);
});
