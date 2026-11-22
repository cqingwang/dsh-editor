import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';
import { gunzip, gzip } from 'node:zlib';

const gunzipAsync = promisify(gunzip);
const gzipAsync = promisify(gzip);

test('project-open update repairs a stale path-sidecar header from the complete content index', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-path-header-repair-root-'));
  const searchIndexDirectory = await mkdtemp(join(tmpdir(), 'dsh-editor-path-header-repair-store-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  t.after(() => rm(searchIndexDirectory, { recursive: true, force: true }));
  await writeFile(join(root, 'source.ts'), 'export const pathHeaderRepair = true;\n', 'utf8');

  const buildHost = await import(
    new URL(`../lib/index.js?path-header-repair-build=${Date.now()}`, import.meta.url)
  );
  await buildHost.rebuildWorkspaceSearchIndex(root, { searchIndexDirectory });
  const identity = buildHost.searchIndexIdentity(root, { searchIndexDirectory });
  const pathPayload = await readFile(identity.pathFile);
  const pathText = (await gunzipAsync(pathPayload)).toString('utf8');
  const newline = pathText.indexOf('\n');
  assert.ok(newline > 0);
  const header = JSON.parse(pathText.slice(0, newline));
  header.complete = false;
  header.directoriesComplete = false;
  header.contentScanVerified = false;
  await writeFile(
    identity.pathFile,
    await gzipAsync(`${JSON.stringify(header)}\n${pathText.slice(newline + 1)}`),
  );

  const freshHost = await import(
    new URL(`../lib/index.js?path-header-repair-fresh=${Date.now()}`, import.meta.url)
  );
  const watcher = new freshHost.WorkspaceWatcher(root, () => {});
  t.after(() => watcher.close());
  watcher.start();

  const updated = await freshHost.updateWorkspaceSearchIndex(root, { searchIndexDirectory });
  assert.equal(updated.changedFiles, 0);

  const status = await freshHost.workspaceSearchIndexStatus(root, { searchIndexDirectory });
  assert.equal(status.pathScanComplete, true);
  assert.equal(status.directoryScanComplete, true);
  assert.equal(status.contentScanVerified, true);

  const repairedText = (await gunzipAsync(await readFile(identity.pathFile))).toString('utf8');
  const repairedHeader = JSON.parse(repairedText.slice(0, repairedText.indexOf('\n')));
  assert.equal(repairedHeader.complete, true);
  assert.equal(repairedHeader.directoriesComplete, true);
  assert.equal(repairedHeader.contentScanVerified, true);

  repairedHeader.complete = false;
  repairedHeader.directoriesComplete = false;
  repairedHeader.contentScanVerified = false;
  await writeFile(
    identity.pathFile,
    await gzipAsync(`${JSON.stringify(repairedHeader)}\n${repairedText.slice(repairedText.indexOf('\n') + 1)}`),
  );
  const reopened = await freshHost.updateWorkspaceSearchIndex(root, { searchIndexDirectory });
  assert.equal(reopened.unchanged, true);
  const reopenedStatus = await freshHost.workspaceSearchIndexStatus(root, { searchIndexDirectory });
  assert.equal(reopenedStatus.pathScanComplete, true);
  assert.equal(reopenedStatus.contentScanVerified, true);
});
