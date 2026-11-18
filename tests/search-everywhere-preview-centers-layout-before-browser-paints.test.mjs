import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = (await readFile(new URL('../src/client/components/search/SearchEverywhere.tsx', import.meta.url), 'utf8') + '\n' + (await readFile(new URL('../lib/client.js', import.meta.url), 'utf8')) + '\n' + (await readFile(new URL('../src/client/components/search/FindToolWindow.tsx', import.meta.url), 'utf8')));

function previewCenteringBlock(componentStart, componentEnd) {
  const componentStartIndex = source.indexOf(componentStart);
  const component = source.slice(componentStartIndex, source.indexOf(componentEnd, componentStartIndex));
  const start = component.indexOf('React.useLayoutEffect(() => {');
  assert.notEqual(start, -1, 'preview centering layout effect is missing');
  const end = component.indexOf(']);', start);
  assert.notEqual(end, -1, 'preview centering dependencies are missing');
  return component.slice(start, end + 3);
}

function assertCentersBeforePaint(block) {
  const centerNow = block.indexOf('const centerNow = () => {');
  const recenter = block.indexOf('const recenter = () => {');
  const syncCall = block.indexOf('centerNow();', recenter);
  const animationFrame = block.indexOf('frame = window.requestAnimationFrame(centerNow);', syncCall);
  const initialCall = block.indexOf('recenter();', animationFrame + 1);
  assert.ok(centerNow >= 0);
  assert.ok(recenter > centerNow);
  assert.ok(syncCall > recenter);
  assert.ok(animationFrame > syncCall);
  assert.ok(initialCall > animationFrame);
}

test('Search Everywhere preview centers in layout before the browser paints', () => {
  const block = previewCenteringBlock(
    'function SearchEverywhere(',
    'function QuickOpen(',
  );
  assertCentersBeforePaint(block);
  assert.match(block, /centerPreviewLineInContainer\(body, lineNode\)/u);
});

test('persistent Find preview centers in layout before the browser paints', () => {
  const block = previewCenteringBlock(
    'function FindToolWindowView(',
    'const FindToolWindow = FindToolWindowView;',
  );
  assertCentersBeforePaint(block);
  assert.match(block, /centerPreviewLineInContainer\(body, lineNode\)/u);
});

test('layout centering remains tied to resize, content and soft-wrap changes', () => {
  const searchEverywhere = previewCenteringBlock(
    'function SearchEverywhere(',
    'function QuickOpen(',
  );
  const findTool = previewCenteringBlock(
    'function FindToolWindowView(',
    'const FindToolWindow = FindToolWindowView;',
  );
  for (const block of [searchEverywhere, findTool]) {
    assert.match(block, /new ResizeObserver\(recenter\)/u);
    assert.match(block, /observer\?\.disconnect\(\)/u);
    assert.match(block, /previewState\.content,/u);
    assert.match(block, /previewSoftWrap,/u);
  }
});
