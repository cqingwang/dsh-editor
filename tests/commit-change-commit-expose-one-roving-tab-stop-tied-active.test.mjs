import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = (await readFile(new URL('../src/client/components/commit/CommitPanel.tsx', import.meta.url), 'utf8') + '\n' + await readFile(new URL('../lib/client.js', import.meta.url), 'utf8'));

function commitPanel() {
  const start = source.indexOf('function CommitPanel(');
  const end = source.indexOf('function NamePrompt(', start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  return source.slice(start, end);
}

test('Change and Commit expose one roving tab stop tied to the active mode', () => {
  const panel = commitPanel();

  assert.match(panel, /ref: commitModeTabsRef/);
  assert.equal(panel.match(/className: 'dsh-editor-commit-mode-tab'/g)?.length, 2);
  assert.match(panel, /tabIndex: mode === 'changes' \? 0 : -1,[\s\S]*?'data-dsh-commit-mode': 'changes'/s);
  assert.match(panel, /tabIndex: mode === 'log' \? 0 : -1,[\s\S]*?'data-dsh-commit-mode': 'log'/s);
  assert.match(source, /\.dsh-editor-commit-mode-tab:focus-visible \{[\s\S]*?outline: 1px solid var\(--dsw-alias-state-business-primary\) !important;/);
});

test('Commit mode tabs support IDEA roving focus keyboard navigation', () => {
  const panel = commitPanel();

  assert.match(panel, /const focusCommitModeTab = \(nextMode\) => \{[\s\S]*?querySelector\(`\[data-dsh-commit-mode="\$\{nextMode\}"\]`\)[\s\S]*?onMode\(nextMode\)[\s\S]*?target\?\.focus\?\.\(\)/);
  assert.match(panel, /const moveCommitModeFocus = \(currentMode, delta\) => \{/);
  assert.match(panel, /const focusBoundaryCommitMode = \(edge\) => \{/);
  assert.match(panel, /event\.key === 'ArrowLeft' \|\| event\.key === 'ArrowRight'/);
  assert.match(panel, /event\.key === 'Home' \|\| event\.key === 'End'/);
  assert.match(panel, /event\.key === 'Enter' \|\| event\.key === ' '/);
  assert.match(panel, /event\.preventDefault\(\);\s+event\.stopPropagation\(\);/s);
});

test('pointer activation also keeps keyboard focus on the selected mode tab', () => {
  const panel = commitPanel();

  assert.match(panel, /onClick: \(event\) => \{\s+event\.currentTarget\.focus\?\.\(\);\s+onMode\('changes'\);/s);
  assert.match(panel, /onClick: \(event\) => \{\s+event\.currentTarget\.focus\?\.\(\);\s+onMode\('log'\);/s);
});
