import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('..', import.meta.url);
const componentSource = await readFile(new URL('src/client/components/commit/CommitPanel.tsx', root), 'utf8');
const styleSource = await readFile(new URL('src/client/ui/styles.ts', root), 'utf8');
const inlineStyleSource = await readFile(new URL('src/client/inline-styles.ts', root), 'utf8');

test('the amend action label stays single-line while its subject can shrink', () => {
  assert.match(
    componentSource,
    /<span style=\{styles\.amendLabel\}>\{t\('editor\.amend'\)\}<\/span>/u,
  );
  assert.match(styleSource, /amendLabel: \{[\s\S]*?flex: '0 0 auto',[\s\S]*?whiteSpace: 'nowrap'/u);
  assert.match(styleSource, /amendSubject: \{[\s\S]*?flex: '1 1 auto',[\s\S]*?minWidth: 0,/u);
  assert.match(
    inlineStyleSource,
    /amendLabel: \{[\s\S]*?flex: '0 0 auto',[\s\S]*?whiteSpace: 'nowrap'/u,
  );
});
