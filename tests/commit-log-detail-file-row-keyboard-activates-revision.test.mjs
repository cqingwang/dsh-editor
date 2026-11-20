import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const detail = await readFile(
  new URL('../src/client/components/commit/CommitLogDetailPane.tsx', import.meta.url),
  'utf8',
);

test('commit detail file rows expose button semantics and a full accessible name', () => {
  assert.match(detail, /role='button'/u);
  assert.match(
    detail,
    /aria-label=\{`\$\{file\.path\} — \$\{t\('editor\.openAtRevision'\)\}`\}/u,
  );
});

test('Enter and Space open the selected revision like a click', () => {
  assert.match(
    detail,
    /const showRevision = \(\): void =>\s+onShowCommitDiff\?\.\(\{\s+hash: detail\.hash,\s+path: file\.path,\s+\}\);/u,
  );
  assert.match(
    detail,
    /if \(\s+!event\.metaKey &&\s+!event\.ctrlKey &&\s+!event\.altKey &&\s+!event\.shiftKey &&\s+\(event\.key === 'Enter' \|\| event\.key === ' '\)\s+\) \{\s+event\.preventDefault\(\);\s+event\.stopPropagation\(\);\s+showRevision\(\);\s+return;\s+\}/su,
  );
});
