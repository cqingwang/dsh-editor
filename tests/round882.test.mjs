import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('CommitLogDetailPane is a reusable TSX functional component', async () => {
  const component = await read('src/client/components/commit/CommitLogDetailPane.tsx');

  assert.match(component, /interface CommitLogDetailPaneProps/u);
  assert.match(component, /function CommitLogDetailPane\(/u);
  assert.match(component, /role='region'/u);
  assert.match(component, /aria-label=\{t\('editor\.commitDetails'\)\}/u);
  assert.match(component, /event\.key === 'F4'/u);
  assert.match(component, /event\.key !== 'ContextMenu'/u);
  assert.match(component, /onFileMenu\?\.\(\{/u);
  assert.match(component, /localFileAvailability\.get\(file\.path\) !== false/u);
  assert.doesNotMatch(component, /React\.createElement/u);
  assert.match(component, /export \{ CommitLogDetailPane \};/u);
});

test('CommitLog delegates detail rendering and file events to the detail pane', async () => {
  const log = await read('src/client/components/commit/CommitLog.tsx');
  const build = await read('scripts/build-client.mjs');
  const client = await read('lib/client.js');

  assert.match(log, /import \{ CommitLogDetailPane \} from '\.\/CommitLogDetailPane'/u);
  assert.match(log, /<CommitLogDetailPane[\s\S]*?detail=\{detail\}[\s\S]*?localFileAvailability=\{localFileAvailability\}/u);
  assert.doesNotMatch(log, /role='region'\s+aria-label=\{t\('editor\.commitDetails'\)\}/u);
  assert.doesNotMatch(log, /title=\{`\$\{file\.path\} — \$\{t\('editor\.openAtRevision'\)\}`\}/u);
  assert.match(build, /CommitLogDetailPane\.tsx/u);
  assert.match(client, /function CommitLogDetailPane\(/u);
});
