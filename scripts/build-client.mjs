#!/usr/bin/env node
/**
 * Build the single DSH browser client artifact from business modules.
 *
 * DSH's lazy-CJS browser contract requires one `lib/client.js` file. Source is
 * kept in `src/client/*.js`; every part executes inside the same factory scope,
 * so shared closures and React hooks remain intact without a runtime loader.
 * The explicit manifest below is the execution order; filenames stay semantic
 * instead of carrying numeric ordering prefixes.
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const partsDir = join(root, 'src', 'client');
const outputPath = join(root, 'lib', 'client.js');
const files = [
  'foundation.js',
  'locales.js',
  'domain-core.js',
  'inline-styles.js',
  'editor-core.js',
  'ui-primitives.js',
  'project.js',
  'menu.js',
  'diff.js',
  'commit.js',
  'search-everywhere.js',
  'find-tool.js',
  'terminal.js',
  'editor-workspace.js',
  'injected-css.js',
  'controller.js',
];
const availableFiles = readdirSync(partsDir)
  .filter((name) => name.endsWith('.js'))
  .sort((left, right) => left.localeCompare(right, 'en'));
const missingFiles = files.filter((name) => !availableFiles.includes(name));
const unlistedFiles = availableFiles.filter((name) => !files.includes(name));

if (missingFiles.length > 0) {
  console.error(`build-client: manifest references missing modules: ${missingFiles.join(', ')}`);
  process.exit(1);
}

if (unlistedFiles.length > 0) {
  console.error(`build-client: unlisted modules in src/client: ${unlistedFiles.join(', ')}`);
  process.exit(1);
}

const header = `window.__ModuleLoader__.load({
  id: 'dsh-editor',
  factory: (require) => {
`;

const body = files
  .map((name) => `\n    /* ─────────────────────── ${name} ─────────────────────── */\n${readFileSync(join(partsDir, name), 'utf8').trimEnd()}\n`)
  .join('');

const footer = `
    return {
      apply,
      inject,
    };
  },
});
`;

const output = `${header}${body}${footer}`;
const check = process.argv.includes('--check');

if (check) {
  const current = readFileSync(outputPath, 'utf8');
  if (current !== output) {
    console.error('build-client: lib/client.js is stale; run npm run build:client');
    process.exit(1);
  }
  console.log(`build-client: ${files.length} modules verified against lib/client.js`);
} else {
  writeFileSync(outputPath, output, 'utf8');
  console.log(`build-client: ${files.length} modules -> lib/client.js (${(Buffer.byteLength(output) / 1024).toFixed(1)} KB)`);
}

if (process.argv.includes('--list')) console.log(files.join('\n'));
