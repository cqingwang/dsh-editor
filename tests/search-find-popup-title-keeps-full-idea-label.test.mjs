import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('..', import.meta.url);
const componentSource = await readFile(new URL('src/client/components/search/FindToolWindow.tsx', root), 'utf8');
const styleSource = await readFile(new URL('src/client/ui/styles.ts', root), 'utf8');
const inlineStyleSource = await readFile(new URL('src/client/inline-styles.ts', root), 'utf8');

test('the floating Find title does not shrink below its Idea label', () => {
  assert.match(componentSource, /\.\.\.styles\.findToolTitle,/u);
  assert.match(componentSource, /\.\.\.styles\.findToolPopupTitle,/u);
  assert.match(styleSource, /findToolPopupTitle: \{[\s\S]*?flex: '0 0 auto'/u);
  assert.match(inlineStyleSource, /findToolPopupTitle: \{[\s\S]*?flex: '0 0 auto'/u);
});
