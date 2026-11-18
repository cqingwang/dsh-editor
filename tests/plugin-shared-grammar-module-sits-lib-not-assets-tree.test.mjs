import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path) => readFileSync(join(root, path), 'utf8');
const host = read('lib/index.js');
const manifest = JSON.parse(read('package.json'));

/* ── The shared module is project source, so it lives in lib/ ──────────── */

test('the shared grammar module sits in lib, not in an assets tree', () => {
  /* `assets/` was a vendored-artifacts folder: monaco and xterm left it in round
     151, which left this single source file alone in it — a directory whose name
     said "third-party copy" about our own code. */
  assert.equal(existsSync(join(root, 'lib', 'link-parser.mjs')), true);
  assert.equal(existsSync(join(root, 'assets')), false, 'the assets tree should be gone');
  assert.equal(existsSync(join(root, 'assets', 'shared', 'link-parser.mjs')), false);
});

test('the host serves it from lib without widening what is exposed', () => {
  /* `SHARED_ROOT` is now `lib/`, which also holds index.js and client.js. The
     bridge must still be an explicit allow-list, or those become downloadable. */
  assert.match(host, /const SHARED_ROOT = fileURLToPath\(new URL\('\.\/', import\.meta\.url\)\);/);
  assert.match(host, /const SHARED_FILES = \['link-parser\.mjs'\];/);
  /* The browser keeps one stable URL whatever the file moves to. */
  assert.ok(read('src/client/find-tool.ts').includes("importRuntimeModule('/api/dsh-editor/shared/link-parser.mjs')"));
  /* The bridge resolves the name under the root and refuses escapes. */
  assert.match(host, /assetFileResponse\(SHARED_ROOT, fileName, request\)/);
});

test('the package ships it as code', () => {
  assert.ok(manifest.files.includes('lib/link-parser.mjs'));
  assert.ok(!manifest.files.some((pattern) => pattern.startsWith('assets/')));
  const listing = execFileSync('npm', ['pack', '--dry-run', '--json'], {
    cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
  });
  const files = JSON.parse(listing)[0].files.map((entry) => entry.path);
  assert.ok(files.includes('lib/link-parser.mjs'));
  assert.ok(!files.some((path) => path.startsWith('assets/')));
});

test('the tests import it from its new home', () => {
  /* A stale `../assets/shared/` import would be the one thing that silently kept
     working in a checkout but broke in a published tarball. */
  const test = read('tests/terminal-links.test.mjs');
  assert.match(test, /from '\.\.\/lib\/link-parser\.mjs';/);
  assert.doesNotMatch(test, /assets\/shared/);
  /* And the module really is what it claims: a working parser. */
  const parsed = execFileSync(process.execPath, ['--input-type=module', '-e', `
    import { parseTerminalLinks } from ${JSON.stringify(join(root, 'lib', 'link-parser.mjs'))};
    const links = parseTerminalLinks('see src/a.ts:12 and https://example.com');
    console.log(JSON.stringify(links.map((l) => l.text)));
  `], { encoding: 'utf8' });
  assert.match(parsed, /src\/a\.ts:12/);
  assert.match(parsed, /https:\/\/example\.com/);
});
