import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'lib/client.js'), 'utf8');

/** Evaluate one shipping helper by brace balance. */
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

const branchLabel = load('branchLabel');

test('a detached HEAD is named, not shown as an empty branch', () => {
  /* `git rev-parse --abbrev-ref HEAD` answers the literal "HEAD" when detached; the
     branch chip then read "HEAD", which looks like a branch called HEAD. */
  assert.equal(branchLabel({ branch: 'HEAD', detached: true, hash: 'aada221' }), 'detached at aada221');
  assert.equal(branchLabel({ branch: 'HEAD', detached: true }), 'detached HEAD');
});

test('a normal branch keeps its name', () => {
  assert.equal(branchLabel({ branch: 'main', detached: false }), 'main');
  assert.equal(branchLabel({ branch: 'feature/x', detached: false }), 'feature/x');
  /* No branch at all (fresh repo) is not "detached". */
  assert.equal(branchLabel({ branch: '', detached: false }), '');
  assert.equal(branchLabel(null), '');
});

test('the tree and the commit toolbar both use that label', () => {
  /* One source of truth: the root row and the toolbar must not disagree. */
  const uses = [...source.matchAll(/branchLabel\(/g)].length;
  assert.ok(uses >= 3, `branchLabel should be used by both surfaces, found ${uses}`);
  assert.match(source, /editor\.detachedHeadHint/);
});
