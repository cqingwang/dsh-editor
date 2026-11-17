import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const client = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');
const host = await readFile(new URL('../lib/index.js', import.meta.url), 'utf8');

function extractFunction(name) {
  const start = client.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} is missing`);
  const bodyStart = client.indexOf(') {', start) + 2;
  let depth = 0;
  for (let index = bodyStart; index < client.length; index += 1) {
    if (client[index] === '{') depth += 1;
    if (client[index] === '}') depth -= 1;
    if (depth === 0) return client.slice(start, index + 1);
  }
  assert.fail(`${name} has no closing brace`);
}

test('host upload lifecycle failures resolve to localized Project copy', () => {
  const messageFor = new Function(
    `${extractFunction('uploadDropFailureMessage')}; return uploadDropFailureMessage;`,
  )();
  const t = (key, params) => `${key}:${JSON.stringify(params)}`;
  assert.equal(
    messageFor({ code: 'dsh-editor/upload-not-found' }, t),
    'editor.uploadTargetUnavailable:{}',
  );
  assert.equal(
    messageFor({ code: 'dsh-editor/upload-offset' }, t),
    'editor.uploadOffsetChanged:{}',
  );
  assert.equal(
    messageFor({ code: 'dsh-editor/upload-incomplete' }, t),
    'editor.uploadIncomplete:{}',
  );
  assert.equal(
    messageFor({ code: 'dsh-editor/upload-length' }, t),
    'editor.uploadIncomplete:{}',
  );
  assert.equal(
    messageFor({ code: 'dsh-editor/exists', path: 'docs/a.bin' }, t),
    'editor.uploadConflicts:{"path":"docs/a.bin"}',
  );
});

test('the host returns the conflicting path with upload failures', () => {
  assert.match(host, /\.\.\.\(typeof failure\?\.path === 'string' \? \{ path: failure\.path \} : null\)/u);
  assert.match(client, /uploadTargetUnavailable: '上传目标已不可用，请重新拖入'/u);
  assert.match(client, /uploadOffsetChanged: '上传位置已变化，请重新开始上传'/u);
  assert.match(client, /uploadIncomplete: '上传未完整完成，请重试'/u);
});

test('permanent 4xx upload failures are not retried', () => {
  const retryable = new Function(
    `${extractFunction('uploadFailureIsRetryable')}; return uploadFailureIsRetryable;`,
  )();
  assert.equal(retryable({ status: 404 }), false);
  assert.equal(retryable({ status: 409 }), false);
  assert.equal(retryable({ status: 413 }), false);
  assert.equal(retryable({ status: 500 }), true);
  assert.equal(retryable(new TypeError('network failed')), true);
  assert.match(client, /retries >= WORKSPACE_UPLOAD_RETRY_DELAYS\.length \|\| !uploadFailureIsRetryable\(failure\)/u);
});
