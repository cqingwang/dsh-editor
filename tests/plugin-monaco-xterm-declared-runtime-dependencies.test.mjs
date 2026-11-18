import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(root, path), 'utf8');
const host = read('lib/index.js');
const manifest = JSON.parse(read('package.json'));

/* ── The runtimes are dependencies, not copies ─────────────────────────── */

test('monaco and xterm are declared as runtime dependencies', () => {
  /* `node_modules` is the dependency manager; a vendored copy under `assets/`
     drifts from the version the manifest claims and doubles the package size. */
  assert.equal(manifest.dependencies['monaco-editor'], '0.52.2');
  assert.equal(manifest.dependencies['@xterm/xterm'], '6.0.0');
  assert.equal(manifest.dependencies['@xterm/addon-fit'], '0.11.0');
  /* Nothing still claims to ship them. */
  assert.ok(!manifest.files.some((pattern) => pattern.includes('assets/monaco')));
  assert.ok(!manifest.files.some((pattern) => pattern.includes('assets/xterm')));
  assert.equal(existsSync(join(root, 'assets/monaco')), false);
  assert.equal(existsSync(join(root, 'assets/xterm')), false);
});

test('the host resolves assets through the package, not a sibling path', () => {
  /* A profile installs the plugin into its own tree (pnpm even isolates it
     under `.pnpm/<pkg>@file+.../node_modules/`), so `../node_modules` is the
     wrong base. `import.meta.url` is the only location that travels with it. */
  assert.match(host, /import \{ createRequire \} from 'node:module';/);
  assert.match(host, /createRequire\(import\.meta\.url\)\.resolve\(specifier\)/);
  assert.doesNotMatch(host, /assets\/monaco/);
  assert.doesNotMatch(host, /assets\/xterm/);
});

test('packagePath returns the resolved FILE, not its directory', () => {
  /* The bug this guards: resolving `@xterm/xterm/lib/xterm.mjs` and taking
     `dirname` yields `.../lib`, so the three xterm routes answered 404 while
     Monaco (whose specifier IS a package.json) kept working. */
  const helper = host.slice(host.indexOf('function packagePath('), host.indexOf('/** Monaco'));
  assert.match(helper, /if \(suffix === ''\) return resolved;/);
  assert.match(helper, /return join\(dirname\(resolved\), \.\.\.suffix\.split\('\/'\)\);/);

  /* Executed, not just matched: every asset the bridge serves must exist. */
  const requireHere = createRequire(join(root, 'lib/index.js'));
  const resolveAsset = (specifier, suffix = '') => {
    const resolved = requireHere.resolve(specifier);
    return suffix === '' ? resolved : join(dirname(resolved), ...suffix.split('/'));
  };
  for (const [label, path] of [
    ['monaco loader', resolveAsset('monaco-editor/package.json', 'min/vs/loader.js')],
    ['monaco worker', resolveAsset('monaco-editor/package.json', 'min/vs/base/worker/workerMain.js')],
    ['xterm', resolveAsset('@xterm/xterm/lib/xterm.mjs')],
    ['addon-fit', resolveAsset('@xterm/addon-fit/lib/addon-fit.mjs')],
    ['xterm.css', resolveAsset('@xterm/xterm/css/xterm.css')],
  ]) {
    assert.ok(existsSync(path), `${label} is missing at ${path}`);
  }
});

test('a served xterm URL maps to one package file', () => {
  /* Each URL keeps the name the browser asks for; the file comes from the
     package. Serving `basename(asset.file)` out of `dirname(asset.file)` is
     what lets three differently-rooted files share one route shape. */
  assert.match(host, /const XTERM_ASSETS = \[/);
  assert.match(host, /path: `\/api\/dsh-editor\/xterm\/\$\{asset\.name\}`,/);
  assert.match(host, /assetFileResponse\(dirname\(asset\.file\), basename\(asset\.file\), request\)/);
});

test('a missing runtime package degrades instead of breaking the import', () => {
  /* If the dependency is not installed the plugin must still load, so the
     editor can say "Monaco failed to load" rather than the profile failing. */
  assert.match(host, /try \{\n\s+resolved = createRequire\(import\.meta\.url\)\.resolve\(specifier\);/);
  assert.match(host, /return null;/);
  assert.match(host, /const MONACO_FILES = MONACO_ROOT === null \? \[\] : walkMonaco\(MONACO_ROOT\);/);
  /* The xterm list is filtered, so a missing package registers no route
     instead of one that would 404. */
  assert.match(host, /\]\.filter\(\(asset\) => asset\.file !== null\);/);
});

/* ── The package ships only what it owns ───────────────────────────────── */

test('npm pack carries code and the shared grammar, not the runtimes', async (t) => {
  const listing = execFileSync('npm', ['pack', '--dry-run', '--json'], {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const files = JSON.parse(listing)[0].files.map((entry) => entry.path);
  assert.ok(files.some((path) => path === 'lib/client.js'));
  /* Round 157: the shared grammar module moved into `lib/`, beside its users. */
  assert.ok(files.some((path) => path === 'lib/link-parser.mjs'));
  assert.ok(!files.some((path) => path.startsWith('assets/monaco')));
  assert.ok(!files.some((path) => path.startsWith('assets/xterm')));
  /* 100+ files of Monaco is the tell-tale of a vendored copy coming back.
     The migrated TSX component graph legitimately grows the owned source list,
     so keep this guard against the vendored-runtime explosion rather than the
     old component-count ceiling. */
  assert.ok(files.length < 140, `pack has ${files.length} files`);
});

test('the install shape pnpm produces still resolves every asset', async (t) => {
  /* The resolution rule is only true if it survives the layout pnpm actually
     builds. `file:` deps are isolated under `.pnpm/`, where the plugin's
     siblings live next to it rather than in the consumer's node_modules. */
  /* The desktop app bundles pnpm; plain `node --test` does not. Look in the
     documented location, then on PATH, and skip only when neither exists. */
  const candidates = [
    process.env.DSH_PNPM_PATH,
    '/Applications/Harness.app/Contents/Resources/runtime/primary-runtime/dependencies/pnpm/bin/pnpm.mjs',
  ]
    .filter((value) => typeof value === 'string' && value !== '')
    .concat(
      (process.env.PATH ?? '')
        .split(':')
        .filter(Boolean)
        .map((dir) => join(dir, 'pnpm')),
    );
  const pnpm = candidates.find((candidate) => existsSync(candidate));
  if (pnpm === undefined) {
    t.skip('pnpm is not installed here');
    return;
  }
  /** Run one pnpm command with this Node, as the desktop runtime does. */
  const runPnpm = (args) =>
    pnpm.endsWith('.mjs')
      ? execFileSync(process.execPath, [pnpm, ...args], {
          cwd: dir,
          encoding: 'utf8',
          stdio: ['ignore', 'pipe', 'pipe'],
          env: { ...process.env, DSH_DESKTOP_NODE_EXECUTABLE: process.execPath },
        })
      : execFileSync(pnpm, args, { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  const dir = await mkdtemp(join(tmpdir(), 'dsh-editor-r151-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, 'package.json'), JSON.stringify({ name: 'probe', private: true, dependencies: { 'dsh-editor': `file:${root}` } }));
  try {
    runPnpm(['install', '--no-frozen-lockfile']);
  } catch {
    t.skip('pnpm install unavailable here');
    return;
  }
  const installed = join(dir, 'node_modules', 'dsh-editor', 'lib', 'index.js');
  assert.ok(existsSync(installed), 'the plugin did not install');
  const requireInstalled = createRequire(realpathSync(installed));
  for (const specifier of ['monaco-editor/package.json', '@xterm/xterm/lib/xterm.mjs']) {
    assert.ok(existsSync(requireInstalled.resolve(specifier)), `${specifier} did not resolve from the installed copy`);
  }
});
