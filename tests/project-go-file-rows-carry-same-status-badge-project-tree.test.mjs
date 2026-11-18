import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { transpileTypeScriptFunction } from './ts-source.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = (readFileSync(join(root, 'lib/client.js'), 'utf8') + '\n' + readFileSync(join(root, 'tests/fixtures/find-tool.legacy.js'), 'utf8'));
const gitStatusModelSource = readFileSync(join(root, 'src/client/components/ui/git-status-model.ts'), 'utf8');
const gitChangeModelSource = readFileSync(join(root, 'src/client/components/ui/git-change-model.ts'), 'utf8');

/** Evaluate one shipping function by brace balance. */
function load(name) {
  const marker = `    function ${name}(`;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `${name} is missing from lib/client.js`);
  let index = source.indexOf('{', start);
  let depth = 0;
  for (; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    else if (source[index] === '}') {
      depth -= 1;
      if (depth === 0) return new Function(`${source.slice(start, index + 1)}; return ${name};`)();
    }
  }
  throw new Error(`unbalanced braces in ${name}`);
}

/**
 * `badgeFor` delegates to `gitStatusInfo`, so both are evaluated in one scope.
 * @returns {Function} the shipping `badgeFor`.
 */
function loadBadgeFor() {
  const gitStatusInfoSource = transpileTypeScriptFunction(gitStatusModelSource, 'gitStatusInfo');
  const badgeForSource = transpileTypeScriptFunction(gitChangeModelSource, 'badgeFor');
  return new Function(`${gitStatusInfoSource}\n${badgeForSource}; return badgeFor;`)();
}

const badgeFor = loadBadgeFor();

test('Go to File rows carry the same status badge as the Project tree', () => {
  /* IDEA marks modified files in its search popups too; a list of bare paths
   * makes it impossible to tell which of two same-named files is the changed one. */
  const changes = new Map([['src/app.ts', ' M'], ['src/new.ts', '??']]);
  assert.deepEqual(badgeFor('src/app.ts', changes), { label: 'M↓', color: '#2f65ca' });
  /* Untracked files use the tree's `U` badge, not a question mark. */
  assert.deepEqual(badgeFor('src/new.ts', changes), { label: 'U', color: '#6e7781' });
  assert.equal(badgeFor('src/clean.ts', changes), null);
  assert.equal(badgeFor('src/clean.ts', new Map()), null);
  /* An unrecognised code falls back to the tree's generic marker, never a crash. */
  assert.deepEqual(badgeFor('x', new Map([['x', 'ZZ']])), { label: '±', color: '#2f65ca' });
});

test('the palette receives a status map built from the loaded git status', () => {
  const start = source.indexOf('quickOpen === null');
  assert.notEqual(start, -1);
  const block = source.slice(start, start + 1200);
  assert.match(block, /changes: new Map\(\(git\?\.changes \?\? \[\]\)\.map\(\(change\) => \[change\.path, change\.status\]\)\)/);
  const component = source.slice(source.lastIndexOf('function QuickOpen('), source.lastIndexOf('function fuzzyScore('));
  assert.match(component, /React\.createElement\(GitStatusBadge, \{ selected: false, info: badge \}\)/);
});
