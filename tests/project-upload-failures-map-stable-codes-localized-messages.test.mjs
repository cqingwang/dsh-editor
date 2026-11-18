import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { en, zh } from './locale-source.mjs';

const source = (await readFile(new URL('../src/client/components/project/ProjectPanel.tsx', import.meta.url), 'utf8') + '\n' + await readFile(new URL('../lib/client.js', import.meta.url), 'utf8'));

/**
 * Extract one top-level client function by its brace-balanced body.
 * @param {string} name - function name.
 * @returns {string} source text.
 */
function extractFunction(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} is missing`);
  const bodyStart = source.indexOf(') {', start) + 2;
  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}') depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }
  assert.fail(`${name} has no closing brace`);
}

test('Project upload failures map stable codes to localized messages', () => {
  const messageFor = new Function(
    `${extractFunction('uploadDropFailureMessage')}; return uploadDropFailureMessage;`,
  )();
  const t = (key, params) => `${key}:${JSON.stringify(params)}`;
  assert.equal(
    messageFor({ code: 'dsh-editor/upload-too-many-items', limit: 1000 }, t),
    'editor.uploadTooManyItems:{"limit":1000}',
  );
  assert.equal(
    messageFor({ code: 'dsh-editor/upload-too-deep', limit: 32 }, t),
    'editor.uploadTooDeep:{"limit":32}',
  );
  assert.equal(
    messageFor({ code: 'dsh-editor/upload-invalid-name', name: 'bad/name' }, t),
    'editor.uploadInvalidName:{"name":"bad/name"}',
  );
  assert.equal(
    messageFor({ code: 'dsh-editor/upload-unreadable', path: 'docs/a.bin' }, t),
    'editor.uploadUnreadable:{"path":"docs/a.bin"}',
  );
});

test('A drop rejected while another upload is busy is surfaced instead of silently ignored', () => {
  const start = source.indexOf('async function uploadWorkspaceDropToProject');
  const end = source.indexOf('function ProjectPanel', start);
  const upload = source.slice(start, end);
  assert.ok(start >= 0 && end > start);
  assert.match(upload, /uploadBusyRef\.ignoredDrops/u);
  assert.match(upload, /setTreeError\(t\('editor\.uploadBusy'\)\)/u);
  assert.match(upload, /setUploadBusy\(true\)/u);
  assert.match(upload, /setUploadBusy\(false\)/u);
  assert.match(upload, /uploadDropFailureMessage\(failure, t\)/u);
  assert.match(upload, /editor\.uploadCompleteIgnored/u);
});

test('The Project tree announces upload activity with aria-busy', () => {
  const panel = source.slice(source.indexOf('function ProjectPanel('), source.indexOf('function ContextMenu('));
  assert.match(panel, /uploadBusy,/u);
  assert.match(panel, /'aria-busy': uploadBusy \? 'true' : undefined/u);
  assert.match(source, /uploadBusy: '已有上传正在进行，请等待完成后再拖入'/u);
  assert.match(source, /uploadBusy: 'An upload is already in progress; wait for it to finish before dropping again'/u);
  assert.equal(
    zh.editor.uploadCompleteIgnored,
    '已上传 {count} 项到 {target}；上传期间另有 {ignored} 次拖入被忽略',
  );
  assert.equal(
    en.editor.uploadCompleteIgnored,
    'Uploaded {count} item(s) to {target}; {ignored} drop(s) were ignored while the upload was in progress',
  );
});
