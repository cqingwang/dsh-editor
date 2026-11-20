import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source =
  (await readFile(new URL('../lib/client.js', import.meta.url), 'utf8')) +
  '\n' +
  (await readFile(new URL('../src/client/components/search/FindToolWindow.tsx', import.meta.url), 'utf8')) +
  '\n' +
  (await readFile(new URL('../src/client/editor-workspace.tsx', import.meta.url), 'utf8'));
const findToolPopupSource = await readFile(
  new URL('../src/client/components/search/FindToolPopup.tsx', import.meta.url),
  'utf8',
);

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

function geometryFunctions() {
  return new Function(
    'const FIND_POPUP_DEFAULT_WIDTH = 510;' +
      'const FIND_POPUP_DEFAULT_HEIGHT = 440;' +
      `${extractFunction('clampFindPopupGeometry')};` +
      `${extractFunction('moveFindPopupGeometry')};` +
      `${extractFunction('resizeFindPopupGeometry')};` +
      'return { clampFindPopupGeometry, moveFindPopupGeometry, resizeFindPopupGeometry };',
  )();
}

function readGeometry(savedGeometry) {
  return new Function(
    'window',
    'const FIND_POPUP_GEOMETRY_STORAGE_KEY = "dsh-editor.find.popup.geometry.v1";' +
      'const FIND_POPUP_DEFAULT_WIDTH = 510;' +
      'const FIND_POPUP_DEFAULT_HEIGHT = 440;' +
      'const LEGACY_FIND_POPUP_DEFAULT_WIDTH = 580;' +
      'const LEGACY_FIND_POPUP_DEFAULT_HEIGHT = 536;' +
      `${extractFunction('clampFindPopupGeometry')};` +
      `${extractFunction('readFindPopupGeometry')};` +
      'return readFindPopupGeometry;',
  )({
    innerHeight: 900,
    innerWidth: 1200,
    localStorage: {
      getItem: () => JSON.stringify(savedGeometry),
    },
  })(1200, 900);
}

test('Find popup geometry defaults to centered and clamps into the viewport', () => {
  const { clampFindPopupGeometry } = geometryFunctions();
  assert.deepEqual(clampFindPopupGeometry({}, 1200, 900), {
    x: 345,
    y: 230,
    width: 510,
    height: 440,
  });
  assert.deepEqual(clampFindPopupGeometry({ x: -100, y: -50, width: 580, height: 536 }, 800, 600), {
    x: 8,
    y: 8,
    width: 580,
    height: 536,
  });
  const small = clampFindPopupGeometry({}, 320, 240);
  assert.equal(small.x, 8);
  assert.equal(small.y, 8);
  assert.equal(small.width, 304);
  assert.equal(small.height, 224);
});

test('Find popup move stays inside the viewport', () => {
  const { moveFindPopupGeometry } = geometryFunctions();
  assert.deepEqual(moveFindPopupGeometry({ x: 100, y: 80, width: 580, height: 536 }, 200, 100, 1000, 800), {
    x: 300,
    y: 180,
    width: 580,
    height: 536,
  });
  assert.deepEqual(moveFindPopupGeometry({ x: 100, y: 80, width: 580, height: 536 }, -500, -500, 1000, 800), {
    x: 8,
    y: 8,
    width: 580,
    height: 536,
  });
});

test('Find popup resize honors each edge and minimum readable size', () => {
  const { resizeFindPopupGeometry } = geometryFunctions();
  const start = { x: 100, y: 80, width: 580, height: 536 };
  assert.deepEqual(resizeFindPopupGeometry(start, 120, 40, 'se', 1200, 900), {
    x: 100,
    y: 80,
    width: 700,
    height: 576,
  });
  assert.deepEqual(resizeFindPopupGeometry(start, 80, 50, 'nw', 1200, 900), {
    x: 180,
    y: 130,
    width: 500,
    height: 486,
  });
  assert.deepEqual(resizeFindPopupGeometry(start, 1000, 1000, 'nw', 1200, 900), {
    x: 320,
    y: 356,
    width: 360,
    height: 260,
  });
});

test('Find popup remembers geometry in browser-local storage', () => {
  const popup = source.slice(source.indexOf('findToolPopup: {'), source.indexOf('findToolToolbar: {'));
  assert.doesNotMatch(popup, /position: 'fixed'/u);
  assert.doesNotMatch(popup, /width: 'min\(510px/u);
  assert.match(source, /dsh-editor\.find\.popup\.geometry\.v1/u);
  assert.match(source, /FIND_POPUP_DEFAULT_WIDTH = 510/u);
  assert.match(source, /FIND_POPUP_DEFAULT_HEIGHT = 440/u);
  assert.match(source, /LEGACY_FIND_POPUP_DEFAULT_WIDTH = 580/u);
  assert.match(source, /LEGACY_FIND_POPUP_DEFAULT_HEIGHT = 536/u);
  assert.match(source, /legacyDefault \? \{\} : saved/u);
  assert.match(source, /function readFindPopupGeometry\(/u);
  assert.match(source, /function writeFindPopupGeometry\(/u);
});

test('The floating wrapper uses persisted geometry and exposes move/resize handles', () => {
  assert.match(findToolPopupSource, /data-dsh-floating-tool-popup=''/u);
  assert.match(findToolPopupSource, /data-dsh-find-tool-popup=\{kind === 'find' \? '' : undefined\}/u);
  assert.match(findToolPopupSource, /left: geometry\.x/u);
  assert.match(findToolPopupSource, /top: geometry\.y/u);
  assert.match(findToolPopupSource, /width: geometry\.width/u);
  assert.match(findToolPopupSource, /height: geometry\.height/u);
  assert.match(source, /<FloatingToolPopup/u);
  assert.match(source, /geometry: findToolPopupGeometry/u);
  assert.match(source, /onGeometryChange=\{setFindToolPopupGeometry\}/u);
  assert.match(source, /onGeometryCommit=\{\(geometry\) => writeFindPopupGeometry\(geometry\)\}/u);
  assert.match(findToolPopupSource, /data-dsh-floating-popup-resize=\{direction\}/u);
  assert.match(source, /const FIND_POPUP_RESIZE_DIRECTIONS = \['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'\]/u);
  assert.match(findToolPopupSource, /onPointerDown=\{\(event\) => startInteraction\(event, direction\)\}/u);
  assert.match(findToolPopupSource, /target\.closest\(FLOATING_POPUP_MOVE_IGNORE_SELECTOR\)/u);
});

test('Legacy default geometry migrates while custom Find popup sizes survive', () => {
  assert.deepEqual(readGeometry({ x: 100, y: 80, width: 580, height: 536 }), {
    x: 345,
    y: 230,
    width: 510,
    height: 440,
  });
  assert.deepEqual(readGeometry({ x: 100, y: 80, width: 620, height: 500 }), {
    x: 100,
    y: 80,
    width: 620,
    height: 500,
  });
});
