import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { extractVariableInitializerExpression, loadTypeScriptExpression } from './ts-source.mjs';

const workspaceSource = await readFile(new URL('../src/client/editor-workspace.tsx', import.meta.url), 'utf8');
const source =
  (await readFile(new URL('../src/client/components/search/SearchEverywhere.tsx', import.meta.url), 'utf8')) +
  '\n' +
  (await readFile(new URL('../lib/client.js', import.meta.url), 'utf8'));

test('Editor opens Search Everywhere Actions from the global IDEA chord in every tool window', () => {
  class FakeElement {
    closest(selector) {
      return selector.includes('[role="tree"]') || selector.includes('[data-dsh-editor-terminal]') ? this : null;
    }
  }
  const activeElement = new FakeElement();
  const target = activeElement;
  const calls = [];
  let focused = null;
  const handler = loadTypeScriptExpression(
    workspaceSource,
    extractVariableInitializerExpression(workspaceSource, 'findActionGlobalShortcut'),
    {
      navigator: { platform: 'Linux', userAgentData: null },
      isMacPlatform: () => false,
      findActionShortcutMatches: () => true,
      searchEverywhereOpen: false,
      document: {
        activeElement,
        querySelector: (selector) => ({
          contains: () => true,
          focus: () => {
            focused = selector;
          },
        }),
      },
      Element: FakeElement,
      openSearchEverywhere: (tab) => calls.push(['open', tab]),
      window: { setTimeout: (callback) => callback() },
    },
  );
  const event = {
    target,
    preventDefault: () => calls.push(['prevent']),
    stopPropagation: () => calls.push(['stop']),
  };
  handler(event);
  assert.deepEqual(calls, [['prevent'], ['stop'], ['open', 'actions']]);
  assert.equal(focused, '[data-dsh-search-query]');
});

test('the global handler is host-scoped and consumes the chord', () => {
  const start = workspaceSource.indexOf('const findActionGlobalShortcut =');
  assert.notEqual(start, -1, 'global Find Action handler is missing');
  const end = workspaceSource.indexOf("window.addEventListener('keydown', onKeyDown, true)", start);
  const handler = workspaceSource.slice(start, end);
  assert.match(handler, /data-dsh-editor-workspace/);
  assert.match(handler, /host\.contains\(document\.activeElement\)/);
  assert.match(handler, /event\.preventDefault\(\)/);
  assert.match(handler, /event\.stopPropagation\(\)/);
  assert.doesNotMatch(handler, /findActionShortcutBlockedByChildContext/);
  assert.doesNotMatch(handler, /onClose|setSearchEverywhere\(null\)/);
});
