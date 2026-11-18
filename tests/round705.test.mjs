import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = (await readFile(new URL('./fixtures/search-everywhere.legacy.js', import.meta.url), 'utf8') + '\n' + (await readFile(new URL('../lib/client.js', import.meta.url), 'utf8')) + '\n' + (await readFile(new URL('./fixtures/find-tool.legacy.js', import.meta.url), 'utf8')));

function extractFunction(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} is missing`);
  const bodyStart = source.indexOf(') {', start) + 2;
  assert.ok(bodyStart > 1, `${name} has no function body`);
  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}') depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }
  assert.fail(`${name} has no closing brace`);
}

test('preview boundary lines clamp instead of inventing negative or excess scroll', () => {
  const scrollTop = new Function(
    `${extractFunction('previewLineScrollTop')}; return previewLineScrollTop;`,
  )();
  assert.equal(scrollTop({
    containerTop: 100,
    containerHeight: 120,
    scrollTop: 0,
    scrollHeight: 2000,
    lineTop: 104,
    lineHeight: 17,
  }), 0);
  assert.equal(scrollTop({
    containerTop: 100,
    containerHeight: 120,
    scrollTop: 0,
    scrollHeight: 2000,
    lineTop: 2080,
    lineHeight: 17,
  }), 1880);
  assert.equal(scrollTop({
    containerTop: 100,
    containerHeight: 120,
    scrollTop: 500,
    scrollHeight: 120,
    lineTop: 160,
    lineHeight: 17,
  }), 0);
});

test('Search Everywhere recenters after preview resize and soft-wrap changes', () => {
  const dialog = source.slice(source.indexOf('function SearchEverywhere('), source.indexOf('/* QUICK_OPEN_BOUNDARY */'));
  assert.match(dialog, /new ResizeObserver\(recenter\)/u);
  assert.match(dialog, /observer\?\.observe\(body\)/u);
  assert.match(dialog, /observer\?\.disconnect\(\)/u);
  assert.match(dialog, /previewState\.content,\s+previewSoftWrap,/u);
});

test('Find in Files recenters after preview resize and soft-wrap changes', () => {
  const component = source.slice(source.indexOf('function FindToolWindow('), source.indexOf('/* QUICK_OPEN_BOUNDARY */'));
  assert.match(component, /new ResizeObserver\(recenter\)/u);
  assert.match(component, /observer\?\.observe\(body\)/u);
  assert.match(component, /observer\?\.disconnect\(\)/u);
  assert.match(component, /previewState\.content,\s+previewSoftWrap,/u);
});

test('the observer remains optional for browsers without ResizeObserver', () => {
  assert.match(
    source,
    /typeof ResizeObserver === 'undefined' \|\| body === null\s+\? null\s+: new ResizeObserver\(recenter\)/u,
  );
});
