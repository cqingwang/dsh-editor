import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');

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

test('upload progress clamps byte counts into a stable percentage', () => {
  const percent = new Function(`${extractFunction('uploadProgressPercent')}; return uploadProgressPercent;`)();
  assert.equal(percent(0, 0), 0);
  assert.equal(percent(0, 100), 0);
  assert.equal(percent(1, 3), 33);
  assert.equal(percent(100, 100), 100);
  assert.equal(percent(200, 100), 100);
});

test('Project tree renders cumulative progress with progressbar semantics', () => {
  assert.match(source, /function uploadProgressPercent\(loaded, total\)/u);
  assert.match(source, /onProgress\?\.\(\{ loaded: offset, total: file\.size \}\)/u);
  assert.match(source, /setUploadProgress\(\{/u);
  assert.match(source, /role: 'progressbar'/u);
  assert.match(source, /'aria-valuenow': progressPercent/u);
  assert.match(source, /uploadProgressCurrent: '正在上传 \{name\}（\{index\}\/\{count\}）：\{loaded\} \/ \{total\}'/u);
  assert.match(source, /uploadProgressCurrent: 'Uploading \{name\} \(\{index\}\/\{count\}\): \{loaded\} \/ \{total\}'/u);
});
