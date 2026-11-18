import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { extractFunctionSource } from './ts-source.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source =
  readFileSync(join(root, 'src/client/components/terminal/TerminalPanel.tsx'), 'utf8') +
  '\n' +
  readFileSync(join(root, 'src/client/components/commit/CommitPanel.tsx'), 'utf8') +
  '\n' +
  readFileSync(join(root, 'src/client/editor-workspace.tsx'), 'utf8') +
  '\n' +
  readFileSync(join(root, 'src/client/components/project/ProjectPanel.tsx'), 'utf8') +
  '\n' +
  readFileSync(join(root, 'src/client/components/commit/CommitLog.tsx'), 'utf8');

/**
 * Slice the source of one component: from its `    function Name(` line to the
 * next `    function ` at the same indentation. Line-based on purpose — brace
 * counting trips over braces inside template strings and regex literals.
 * @param {string} name - component name.
 * @returns {string} that component's source.
 */
function bodyOf(name) {
  return extractFunctionSource(source, name);
}

test('CommitPanel declares every identifier it renders', () => {
  const panel = readFileSync(join(root, 'src/client/components/commit/CommitPanel.tsx'), 'utf8');
  /* `highlightedCommit` is owned by EditorWorkspace; CommitPanel must receive it as a prop. */
  assert.match(panel, /highlightedCommit,/);
  assert.match(panel, /highlighted=\{highlightedCommit\}/);
});

test('EditorWorkspace passes the highlighted commit into CommitPanel', () => {
  const workspace = bodyOf('EditorWorkspace');
  assert.match(workspace, /const \[\s*highlightedCommit,\s*setHighlightedCommit,\s*\] = React\.useState\(null\);/);
  /* The value has to cross the component boundary, or the log tab throws on render. */
  const callStart = workspace.indexOf('<CommitPanel');
  assert.notEqual(callStart, -1, 'CommitPanel call is missing');
  const call = workspace.slice(callStart, workspace.indexOf('/>', callStart));
  assert.match(call, /highlightedCommit=\{highlightedCommit\}/);
});

test('every free identifier used by a component is declared or received', () => {
  /* A crude but effective guard for the class of bug that blanked the panel:
     a name used in JSX that neither appears as a parameter nor is declared inside. */
  const suspicious = [];
  for (const name of ['CommitPanel', 'CommitLogView', 'ProjectPanel', 'TerminalPanel']) {
    const text = bodyOf(name);
    const header = text.slice(0, text.indexOf(') {') + 2);
    const params = new Set((header.match(/[A-Za-z_$][\w$]*/gu) ?? []));
    for (const identifier of ['highlightedCommit', 'identityMissing', 'pushFailure', 'deletedPaths', 'newPaths']) {
      if (!new RegExp(`(?<![\\w$.])${identifier}(?![\\w$])`, 'u').test(text)) continue;
      const declaredInside = new RegExp(`(?:const|let)\\s+(?:\\[[^\\]]*\\b${identifier}\\b|${identifier}\\s*=)`, 'u').test(text);
      if (!declaredInside && !params.has(identifier)) suspicious.push(`${name}: ${identifier}`);
    }
  }
  assert.deepEqual(suspicious, []);
});
