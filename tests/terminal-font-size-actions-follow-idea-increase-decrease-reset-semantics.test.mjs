import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { transpileTypeScriptFunction } from './ts-source.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = [
  readFileSync(join(root, 'src/client/terminal.ts'), 'utf8'),
  readFileSync(join(root, 'src/client/components/terminal/TerminalPanel.tsx'), 'utf8'),
  readFileSync(join(root, 'src/client/locales.ts'), 'utf8'),
].join('\n');

const terminalFontSize = new Function(
  `${transpileTypeScriptFunction(source, 'terminalFontSize')}; return terminalFontSize;`,
)();

test('terminal font size actions follow IDEA increase/decrease/reset semantics', () => {
  assert.equal(terminalFontSize(12, 'increase'), 13);
  assert.equal(terminalFontSize(24, 'increase'), 24);
  assert.equal(terminalFontSize(12, 'decrease'), 11);
  assert.equal(terminalFontSize(8, 'decrease'), 8);
  assert.equal(terminalFontSize(17, 'reset'), 12);
  assert.equal(terminalFontSize(Number.NaN, 'reset'), 12);
});

test('Terminal Options exposes explicit font-size actions instead of a cycle', () => {
  assert.match(
    source,
    /id: 'increaseFont',\s+label: t\('editor\.terminalIncreaseFontSize'\),\s+run: \(\) => setFontSize\(\(size\) => storeFontSize\(terminalFontSize\(size, 'increase'\)\)\)/s,
  );
  assert.match(
    source,
    /id: 'decreaseFont',\s+label: t\('editor\.terminalDecreaseFontSize'\),\s+run: \(\) => setFontSize\(\(size\) => storeFontSize\(terminalFontSize\(size, 'decrease'\)\)\)/s,
  );
  assert.match(
    source,
    /id: 'resetFont',\s+label: t\('editor\.terminalResetFontSize'\),\s+run: \(\) => setFontSize\(\(size\) => storeFontSize\(terminalFontSize\(size, 'reset'\)\)\)/s,
  );
  assert.doesNotMatch(source, /id: 'fontSize'/);
});

test('Terminal shell dropdown uses IDEA New Predefined Session wording', () => {
  assert.match(
    source,
    /label=\{t\('editor\.terminalNewPredefinedSession'\)\}\s+onClick=\{\(\) => void openShellMenu\(\)\}/s,
  );
  assert.ok(source.includes("terminalNewPredefinedSession: '新建预定义会话'"));
  assert.ok(source.includes("terminalNewPredefinedSession: 'New Predefined Session'"));
  assert.ok(source.includes("terminalIncreaseFontSize: '增大字号'"));
  assert.ok(source.includes("terminalDecreaseFontSize: '减小字号'"));
  assert.ok(source.includes("terminalResetFontSize: '重置字号'"));
});
