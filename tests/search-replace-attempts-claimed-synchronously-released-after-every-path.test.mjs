import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = (await readFile(new URL('../src/client/components/search/SearchEverywhere.tsx', import.meta.url), 'utf8') + '\n' + await readFile(new URL('../lib/client.js', import.meta.url), 'utf8'));

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

const replaceInFiles = source.slice(
  source.indexOf('const replaceInFiles = React.useCallback'),
  source.indexOf('const replaceInFindTool = React.useCallback'),
);
const replaceInFindTool = source.slice(
  source.indexOf('const replaceInFindTool = React.useCallback'),
  source.indexOf('const replaceFindToolOccurrence = React.useCallback'),
);
const replaceOccurrence = source.slice(
  source.indexOf('const replaceFindToolOccurrence = React.useCallback'),
  source.indexOf('const undoFindReplace = React.useCallback'),
);

test('replace attempts are claimed synchronously and released after every path', () => {
  const claim = new Function(
    `${extractFunction('claimReplaceAttempt')}; ${extractFunction('releaseReplaceAttempt')}; return { claimReplaceAttempt, releaseReplaceAttempt };`,
  )();
  const guard = { current: false };
  assert.equal(claim.claimReplaceAttempt(guard, false), true);
  assert.equal(guard.current, true);
  assert.equal(claim.claimReplaceAttempt(guard, false), false);
  claim.releaseReplaceAttempt(guard);
  assert.equal(guard.current, false);
  assert.equal(claim.claimReplaceAttempt(guard, true), false);
  assert.equal(claim.claimReplaceAttempt(null, false), false);
});

test('Search Everywhere and both Find replace paths share one immediate write guard', () => {
  assert.match(source, /const replaceWriteBusyRef = React\.useRef\(false\)/u);
  assert.match(replaceInFiles, /claimReplaceAttempt\(replaceWriteBusyRef, searchEverywhere\?\.replaceBusy === true\)/);
  assert.match(replaceInFindTool, /claimReplaceAttempt\(replaceWriteBusyRef, findTool\?\.replaceBusy === true\)/);
  assert.match(replaceOccurrence, /claimReplaceAttempt\(replaceWriteBusyRef, findTool\?\.replaceBusy === true\)/);
  assert.equal((replaceInFiles.match(/releaseReplaceAttempt\(replaceWriteBusyRef\)/gu) ?? []).length, 2);
  assert.equal((replaceInFindTool.match(/releaseReplaceAttempt\(replaceWriteBusyRef\)/gu) ?? []).length, 2);
  assert.equal((replaceOccurrence.match(/releaseReplaceAttempt\(replaceWriteBusyRef\)/gu) ?? []).length, 1);
});

test('confirmation cancel and host failures explicitly release the write guard', () => {
  for (const block of [replaceInFiles, replaceInFindTool]) {
    const claimAt = block.indexOf('claimReplaceAttempt(replaceWriteBusyRef');
    const confirmAt = block.indexOf('window.confirm');
    const callAt = block.indexOf('await callFs({');
    const writeTryAt = block.indexOf('try {', confirmAt);
    const finallyAt = block.indexOf('finally {');
    const cancelBranch = block.slice(confirmAt, callAt);
    assert.ok(claimAt >= 0 && confirmAt > claimAt, 'claim must precede confirmation');
    assert.match(cancelBranch, /releaseReplaceAttempt\(replaceWriteBusyRef\)[\s\S]*?return;/);
    assert.ok(writeTryAt > confirmAt && writeTryAt < callAt, 'the write must stay inside a try block');
    assert.ok(finallyAt > callAt, 'write failures must release the guard in finally');
    assert.match(block.slice(finallyAt), /releaseReplaceAttempt\(replaceWriteBusyRef\)/);
  }
  assert.match(replaceOccurrence, /finally \{[\s\S]*?releaseReplaceAttempt\(replaceWriteBusyRef\)/);
});

test('Monaco search callbacks avoid the openSearchEverywhere TDZ', () => {
  const workspaceStart = source.indexOf('function EditorWorkspace(');
  const declaration = source.indexOf('const openSearchEverywhere = React.useCallback', workspaceStart);
  const beforeDeclaration = source.slice(workspaceStart, declaration);
  assert.doesNotMatch(beforeDeclaration, /openSearchEverywhere(?!Ref)/u);
  assert.equal((beforeDeclaration.match(/openSearchEverywhereRef\.current\?\.\('text'\)/gu) ?? []).length, 2);
  assert.match(
    source.slice(declaration),
    /openSearchEverywhereRef\.current = openSearchEverywhere;[\s\S]*?\[openSearchEverywhere\]/,
  );
});
