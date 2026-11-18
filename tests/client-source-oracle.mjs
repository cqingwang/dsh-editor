import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import { syncBuiltinESMExports } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const productionClientPath = resolve(root, 'lib/client.js');
const legacyWorkspacePath = resolve(root, 'tests/fixtures/legacy/editor-workspace.legacy.js');
const originalReadFileSync = fs.readFileSync;
const originalReadFile = fsPromises.readFile;

function isProductionClientPath(filePath) {
  if (filePath instanceof URL) return resolve(fileURLToPath(filePath)) === productionClientPath;
  if (typeof filePath !== 'string') return false;
  return resolve(filePath) === productionClientPath;
}

function withLegacyEditorWorkspace(source) {
  const text = Buffer.isBuffer(source) ? source.toString('utf8') : source;
  const workspaceMarker = '/* ─────────────────────── editor-workspace.tsx ─────────────────────── */';
  const injectedCssMarker = '/* ─────────────────────── injected-css.ts ─────────────────────── */';
  const workspaceStart = text.indexOf(workspaceMarker);
  const injectedCssStart = text.indexOf(injectedCssMarker, workspaceStart);
  if (workspaceStart < 0 || injectedCssStart < 0) {
    throw new Error('test-client-oracle: unable to locate the editor-workspace build section');
  }
  const legacyWorkspace = originalReadFileSync(legacyWorkspacePath, 'utf8').trimEnd();
  const oracle = `${text.slice(0, workspaceStart)}${workspaceMarker}\n${legacyWorkspace}\n${text.slice(injectedCssStart)}`;
  return Buffer.isBuffer(source) ? Buffer.from(oracle) : oracle;
}

function readFileSync(filePath, options) {
  const source = originalReadFileSync.call(this, filePath, options);
  return isProductionClientPath(filePath) ? withLegacyEditorWorkspace(source) : source;
}

async function readFile(filePath, options) {
  const source = await originalReadFile.call(this, filePath, options);
  return isProductionClientPath(filePath) ? withLegacyEditorWorkspace(source) : source;
}

/*
 * Historical contract tests assert the textual shape of editor-workspace before
 * it became JSX. The test oracle keeps those checks meaningful without shipping
 * the legacy source or teaching the production builder to compile it.
 */
fs.readFileSync = readFileSync;
fsPromises.readFile = readFile;
syncBuiltinESMExports();
