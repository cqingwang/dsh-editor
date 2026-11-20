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
const terminalDefaultFontSize = Number(
  source.match(/export const TERMINAL_DEFAULT_FONT_SIZE = (\d+);/u)?.[1],
);
const terminalFontSizeMigrationKey = source.match(
  /const TERMINAL_FONT_SIZE_MIGRATION_KEY = '([^']+)';/u,
)?.[1];

const terminalFontSize = new Function(
  'TERMINAL_DEFAULT_FONT_SIZE',
  `${transpileTypeScriptFunction(source, 'terminalFontSize')}; return terminalFontSize;`,
)(terminalDefaultFontSize);

test('terminal font size actions follow IDEA increase/decrease/reset semantics', () => {
  assert.equal(terminalDefaultFontSize, 9);
  assert.equal(terminalFontSize(12, 'increase'), 13);
  assert.equal(terminalFontSize(24, 'increase'), 24);
  assert.equal(terminalFontSize(12, 'decrease'), 11);
  assert.equal(terminalFontSize(8, 'decrease'), 8);
  assert.equal(terminalFontSize(17, 'reset'), 9);
  assert.equal(terminalFontSize(Number.NaN, 'reset'), 9);
});

test('Terminal decrements the persisted pre-request font by one only once', () => {
  assert.equal(terminalFontSizeMigrationKey, 'dsh-editor.terminal.fontSize.decrementToNineMigrated');
  const values = new Map([['dsh-editor.terminal.fontSize', '10']]);
  const storage = {
    getItem: (key) => (values.has(key) ? values.get(key) : null),
    setItem: (key, value) => values.set(key, value),
  };
  const factory = new Function(
    'window',
    'TERMINAL_DEFAULT_FONT_SIZE',
    'TERMINAL_FONT_SIZE_STORAGE_KEY',
    'TERMINAL_FONT_SIZE_MIGRATION_KEY',
    `${transpileTypeScriptFunction(source, 'terminalFontSize')}
${transpileTypeScriptFunction(source, 'storeFontSize')}
${transpileTypeScriptFunction(source, 'readTerminalFontSize')}
return { terminalFontSize, storeFontSize, readTerminalFontSize };`,
  );
  const helpers = factory(
    { localStorage: storage },
    terminalDefaultFontSize,
    'dsh-editor.terminal.fontSize',
    terminalFontSizeMigrationKey,
  );

  assert.equal(helpers.readTerminalFontSize(), 9);
  assert.equal(values.get('dsh-editor.terminal.fontSize'), '9');
  assert.equal(values.get(terminalFontSizeMigrationKey), '1');
  assert.equal(helpers.readTerminalFontSize(), 9);
  helpers.storeFontSize(13);
  assert.equal(helpers.readTerminalFontSize(), 13);
});

test('Terminal Options exposes explicit font-size actions instead of a cycle', () => {
  assert.match(
    source,
    /id: 'increaseFont',\s+label: t\('editor\.terminalIncreaseFontSize'\),\s+run: \(\) => updateTerminalFontSize\('increase'\)/s,
  );
  assert.match(
    source,
    /id: 'decreaseFont',\s+label: t\('editor\.terminalDecreaseFontSize'\),\s+run: \(\) => updateTerminalFontSize\('decrease'\)/s,
  );
  assert.match(
    source,
    /id: 'resetFont',\s+label: t\('editor\.terminalResetFontSize'\),\s+run: \(\) => updateTerminalFontSize\('reset'\)/s,
  );
  assert.doesNotMatch(source, /id: 'fontSize'/);
  assert.match(source, /const \[fontSize, setFontSize\] =\s+React\.useState\(readTerminalFontSize\)/u);
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
