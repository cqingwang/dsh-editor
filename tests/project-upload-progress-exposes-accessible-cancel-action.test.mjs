import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = (await readFile(new URL('../src/client/components/project/ProjectPanel.tsx', import.meta.url), 'utf8') + '\n' + await readFile(new URL('../lib/client.js', import.meta.url), 'utf8'));

test('Project upload progress exposes an accessible cancel action', () => {
  assert.match(source, /onCancelUpload/u);
  assert.match(source, /t\('editor\.uploadCancel'\)/u);
  assert.match(source, /'data-dsh-upload-cancel': ''/u);
  assert.match(source, /uploadCancel: '取消上传'/u);
  assert.match(source, /uploadCancel: 'Cancel upload'/u);
});

test('cancellation stops future chunks and cleans the current part through abort', () => {
  assert.match(source, /uploadBusyRef\.cancelRequested = false/u);
  assert.match(source, /uploadBusyRef\.cancelRequested === true/u);
  assert.match(source, /dsh-editor\/upload-cancelled/u);
  assert.match(source, /flashStatus\(t\('editor\.uploadCancelled'\)\)/u);
  assert.match(source, /requestWorkspaceUpload\('abort'/u);
  assert.match(source, /uploadCancelled: '上传已取消'/u);
  assert.match(source, /uploadCancelled: 'Upload cancelled'/u);
});
