import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const client = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');

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

test('a missing upload route tells the user to restart Harness', () => {
  const messageFor = new Function(
    `${extractFunction('uploadDropFailureMessage')}; return uploadDropFailureMessage;`,
  )();
  const t = (key, params) => `${key}:${JSON.stringify(params)}`;

  assert.equal(
    messageFor({ code: 'dsh-editor/upload-http', status: 404, message: 'upload API HTTP 404' }, t),
    'editor.uploadServiceUnavailable:{}',
  );
  assert.equal(
    messageFor({ code: 'dsh-editor/upload-not-found', status: 404 }, t),
    'editor.uploadTargetUnavailable:{}',
  );
});

test('restart guidance is localised without exposing the HTTP fallback', () => {
  assert.match(client, /uploadServiceUnavailable: '编辑器上传服务未加载，请完全退出并重新启动 Harness 后再试'/u);
  assert.match(client, /uploadServiceUnavailable: 'The editor upload service is not loaded; quit and restart Harness, then try again'/u);
  assert.match(client, /failure\?\.status === 404/u);
  assert.doesNotMatch(client, /editor\.uploadServiceUnavailable[^\n]*HTTP 404/u);
});
