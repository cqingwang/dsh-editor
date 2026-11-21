import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const uiStyles = await readFile(new URL('../src/client/ui/styles.ts', import.meta.url), 'utf8');
const inlineStyles = await readFile(new URL('../src/client/inline-styles.ts', import.meta.url), 'utf8');
const component = await readFile(
  new URL('../src/client/components/search/FindToolWindow.tsx', import.meta.url),
  'utf8',
);

test('Find occurrence rows center their content and keep the location column compact', () => {
  for (const styles of [uiStyles, inlineStyles]) {
    assert.match(styles, /findToolOccurrence: \{[\s\S]*?alignItems: 'center'[\s\S]*?padding: '0 10px'/u);
    assert.match(styles, /findToolLocation: \{[\s\S]*?minWidth: 44,[\s\S]*?textAlign: 'left',[\s\S]*?fontSize: 8,/u);
  }
});

test('the location and highlighted preview remain the only occurrence content columns', () => {
  assert.match(
    component,
    /<span style=\{styles\.findToolLocation\}>\{`\$\{match\.line\}:\$\{match\.column\}`\}<\/span>\s+<span style=\{styles\.findToolPreview\}>/u,
  );
});
