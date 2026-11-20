import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const controller = await readFile(
  new URL('../src/client/controller.ts', import.meta.url),
  'utf8',
);

test('the locale service exposes the registration disposer contract', () => {
  assert.match(
    controller,
    /register:\s*\(\s*namespace: string,\s*dictionaries: \{ zh: Record<string, string>; en: Record<string, string> \},?\s*\) => \(\) => void;/u,
  );
});

test('the plugin effect returns the locale registration disposer', () => {
  assert.match(
    controller,
    /ctx\.effect\(\s*\(\) =>\s*ctx\.locale\.register\(NS, \{\s*zh: flattenDictionary\(zh\),\s*en: flattenDictionary\(en\),\s*\}\),\s*'dsh-editor: dictionaries',?\s*\);/su,
  );
  assert.doesNotMatch(
    controller,
    /ctx\.effect\(\(\) => \{\s*ctx\.locale\.register\(NS,[\s\S]*?return \(\) => \{\};\s*\}, 'dsh-editor: dictionaries'\)/su,
  );
});
