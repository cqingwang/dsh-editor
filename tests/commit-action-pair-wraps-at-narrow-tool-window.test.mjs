import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('..', import.meta.url);
const styleSource = await readFile(new URL('src/client/ui/styles.ts', root), 'utf8');
const inlineStyleSource = await readFile(new URL('src/client/inline-styles.ts', root), 'utf8');

test('commit action pair wraps instead of clipping the push label', () => {
  assert.match(styleSource, /commitButtonRow: \{[\s\S]*?flexWrap: 'wrap'/u);
  assert.match(styleSource, /commitPrimary: \{[\s\S]*?flex: '1 1 96px'/u);
  assert.match(styleSource, /commitSecondary: \{[\s\S]*?flex: '1 1 150px',[\s\S]*?minWidth: 150,/u);
  assert.match(
    inlineStyleSource,
    /commitButtonRow: \{[\s\S]*?flexWrap: 'wrap'[\s\S]*?\n  \},\n  \/\* IDEA's two commit buttons/u,
  );
  assert.match(inlineStyleSource, /commitSecondary: \{[\s\S]*?flex: '1 1 150px',[\s\S]*?minWidth: 150,/u);
});
