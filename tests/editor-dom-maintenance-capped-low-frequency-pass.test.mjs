import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'lib/client.js'), 'utf8');

function load(name) {
  const marker = `    function ${name}(`;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `${name} is missing`);
  const end = source.indexOf('\n    }', start) + '\n    }'.length;
  return new Function(`${source.slice(start, end)}; return ${name};`)();
}

const delay = load('maintenanceDelay');

test('DOM maintenance is capped to a low-frequency pass', () => {
  assert.equal(delay(0, 0, 80), 80);
  assert.equal(delay(1000, 1010, 80), 70);
  assert.equal(delay(1000, 1080, 80), 0);
  assert.equal(delay(1000, 2000, 80), 0);
  assert.equal(delay(Number.NaN, 1000, 80), 0);
});

test('MutationObserver coalesces bursts instead of synchronously calling sync', () => {
  const from = source.indexOf('function enhanceMenus()');
  const observer = source.slice(
    source.indexOf('const observer = new MutationObserver(', from),
    source.indexOf('observer.observe(document.body', from),
  );
  assert.match(observer, /if \(maintenanceTimer !== 0\) return;/);
  assert.match(observer, /maintenanceDelay\(lastMaintenanceAt, performance\.now\(\), 80\)/);
  assert.match(observer, /maintenanceTimer = window\.setTimeout\(\(\) => \{/);
  assert.match(observer, /sync\(\);/);
  assert.doesNotMatch(observer, /new MutationObserver\(\(\) => \{\s*sync\(\)/);
});

test('unmount cancels a queued maintenance pass', () => {
  const cleanup = source.slice(
    source.indexOf('() => () => {', source.indexOf('ctx.effect(')),
    source.indexOf("'dsh-editor: split layout'"),
  );
  assert.match(cleanup, /window\.clearTimeout\(maintenanceTimer\)/);
  assert.match(cleanup, /maintenanceTimer = 0/);
});

test('the View row still has no Editor tab and the toggle opens or closes it', () => {
  assert.doesNotMatch(source, /setAttribute\('data-dsh-editor-tab'/);
  const toggle = source.slice(
    source.indexOf('function ensureChatToggle('),
    source.indexOf('function placeChatHandle('),
  );
  assert.match(toggle, /if \(active\) setActive\(false\);\s*else\s+openEditorSplit\(\);/u);
});
