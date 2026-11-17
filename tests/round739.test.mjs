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

test('External file drops on file rows resolve to their parent directory', () => {
  const dropDirectory = new Function(
    `${extractFunction('dirname')}; ${extractFunction('projectExternalDropDirectory')}; return projectExternalDropDirectory;`,
  )();
  assert.equal(dropDirectory({ path: 'docs', kind: 'directory' }), 'docs');
  assert.equal(dropDirectory({ path: 'docs/notes.md', kind: 'file' }), 'docs');
  assert.equal(dropDirectory({ path: 'README.md', kind: 'file' }), '');
  assert.equal(dropDirectory({ path: '', kind: 'directory', root: true }), '');
});

test('The Files drop handler uses the resolved directory for both line and upload', () => {
  assert.match(source, /const targetDirectory = projectExternalDropDirectory\(row\);/u);
  assert.match(source, /setExternalDropPath\(targetDirectory\);/u);
  assert.match(source, /onUpload\(handles, targetDirectory\);/u);
  assert.match(source, /if \(externalDropPath !== null\) setExternalDropPath\(null\);/u);
});

test('An unreadable OS drop reports that no files could be read', () => {
  assert.match(source, /if \(collected\.entries\.length === 0\) \{\s+setTreeError\(t\('editor\.uploadNothingReadable'\)\);\s+return;\s+\}/u);
  assert.match(source, /uploadNothingReadable: '未读取到可上传文件，请重新拖入'/u);
  assert.match(source, /uploadNothingReadable: 'No readable files were found in the drop'/u);
});
