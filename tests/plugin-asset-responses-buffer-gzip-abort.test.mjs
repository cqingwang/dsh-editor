import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { extractJavaScriptFunctionSource } from './ts-source.mjs';

const host = await readFile(new URL('../lib/index.js', import.meta.url), 'utf8');
const functionSource = extractJavaScriptFunctionSource(host, 'assetFileResponse');
const asyncFunctionSource = functionSource.startsWith('async ') ? functionSource : `async ${functionSource}`;

function createAssetResponder(fileContent) {
  let streamCalls = 0;
  const responder = new Function(
    'resolve',
    'sep',
    'stat',
    'extname',
    'ASSET_MEDIA_TYPES',
    'fullPathEscapes',
    'createReadStream',
    'readFile',
    `${asyncFunctionSource}
     return assetFileResponse;`,
  )(
    (root, relativePath) => `${root}${relativePath}`,
    '/',
    async () => ({ isFile: () => true, size: fileContent.byteLength }),
    () => '.js',
    new Map([['.js', 'text/javascript']]),
    () => false,
    () => {
      streamCalls += 1;
      return new ReadableStream({
        start(controller) {
          controller.enqueue(fileContent);
          controller.close();
        },
      });
    },
    async () => fileContent,
  );
  return {
    responder,
    streamCalls: () => streamCalls,
  };
}

test('static asset responses are buffered instead of exposing an fs stream', async () => {
  const content = Buffer.from('export const hostAsset = true;');
  const { responder, streamCalls } = createAssetResponder(content);
  const response = await responder('/assets/', 'asset.js', new Request('http://localhost/assets/asset.js'));

  assert.equal(streamCalls(), 0);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-type'), 'text/javascript');
  assert.equal(response.headers.get('content-length'), String(content.byteLength));
  assert.equal(await response.text(), content.toString());
});

test('HEAD asset responses retain length without reading or streaming the body', async () => {
  const content = Buffer.from('console.log("head");');
  const { responder, streamCalls } = createAssetResponder(content);
  const response = await responder(
    '/assets/',
    'asset.js',
    new Request('http://localhost/assets/asset.js', { method: 'HEAD' }),
  );

  assert.equal(streamCalls(), 0);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('content-length'), String(content.byteLength));
  assert.equal(await response.text(), '');
});
