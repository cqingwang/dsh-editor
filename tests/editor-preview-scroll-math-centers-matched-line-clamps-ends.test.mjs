import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = (await readFile(new URL('../src/client/components/search/SearchEverywhere.tsx', import.meta.url), 'utf8') + '\n' + (await readFile(new URL('../lib/client.js', import.meta.url), 'utf8')) + '\n' + (await readFile(new URL('../src/client/components/search/FindToolWindow.tsx', import.meta.url), 'utf8')));

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

test('preview scroll math centers the matched line and clamps at both ends', () => {
  const scrollTop = new Function(
    `${extractFunction('previewLineScrollTop')}; return previewLineScrollTop;`,
  )();
  assert.equal(scrollTop({
    containerTop: 430,
    containerHeight: 122,
    scrollTop: 0,
    scrollHeight: 5127,
    lineTop: 4498,
    lineHeight: 17,
  }), 4015.5);
  assert.equal(scrollTop({
    containerTop: 430,
    containerHeight: 122,
    scrollTop: 120,
    scrollHeight: 5127,
    lineTop: 350,
    lineHeight: 17,
  }), 0);
  assert.equal(scrollTop({
    containerTop: 430,
    containerHeight: 122,
    scrollTop: 0,
    scrollHeight: 5127,
    lineTop: 5600,
    lineHeight: 17,
  }), 5005);
});

test('Search Everywhere scrolls its preview body to the active text result', () => {
  const dialog = source.slice(source.indexOf('function SearchEverywhere('), source.indexOf('const FindToolWindow = FindToolWindowView;'));
  assert.match(dialog, /const previewBodyRef = React\.useRef\(null\)/);
  assert.match(dialog, /ref: previewBodyRef/u);
  assert.match(dialog, /'data-dsh-preview-line': previewFirstLine \+ index/u);
  assert.match(dialog, /centerPreviewLineInContainer\(/u);
  assert.match(dialog, /requestAnimationFrame\([\s\S]*?previewState\.line/u);
});

test('Find in Files scrolls its preview body to the active occurrence', () => {
  const component = source.slice(source.indexOf('function FindToolWindowView('), source.indexOf('const FindToolWindow = FindToolWindowView;'));
  assert.match(component, /const previewBodyRef = React\.useRef\(null\)/);
  assert.match(component, /ref: previewBodyRef/u);
  assert.match(component, /'data-dsh-preview-line': previewFirstLine \+ index/u);
  assert.match(component, /centerPreviewLineInContainer\(/u);
  assert.match(component, /previewState\.line/u);
});

test('All text search result open paths retain line-centered editor reveal', () => {
  assert.match(
    source,
    /onActivate: \(result\) => \{[\s\S]*?if \(result\.kind === 'text'\) \{\s+openFileAtLocation\(result\.path, result\.line, result\.column, \{[\s\S]*?endColumn:/u,
  );
  assert.match(
    source,
    /onOpen: \(result, openInNewTab = false\) => \{[\s\S]*?if \(result\.kind === 'text'\) \{\s+openFileAtLocation\(result\.path, result\.line, result\.column\);/u,
  );
  assert.match(source, /editor\.revealLineInCenter\(safeLine\)/u);
});
