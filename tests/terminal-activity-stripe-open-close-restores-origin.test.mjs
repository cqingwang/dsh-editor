import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadTypeScriptCallback } from './ts-source.mjs';

const workspaceSource = await readFile(new URL('../src/client/editor-workspace.tsx', import.meta.url), 'utf8');
const stripeSource = await readFile(new URL('../src/client/components/ui/ActivityStripe.tsx', import.meta.url), 'utf8');

test('Activity Stripe captures pointerdown before the terminal steals focus', () => {
  assert.match(stripeSource, /onPointerDown\?: \(id: string\) => void;/u);
  assert.match(stripeSource, /onPointerDown=\{\(\) => onPointerDown\?\.\(id\)\}/u);
  assert.match(stripeSource, /onItemPointerDown\?: \(id: string\) => void;/u);
  assert.match(workspaceSource, /onItemPointerDown=\{rememberActivityToolWindowOrigin\}/u);
});

test('terminal origin capture ignores open-terminal clicks and records Project rows', () => {
  class FakeHTMLElement {
    constructor(closestResult) {
      this.isConnected = true;
      this.closestResult = closestResult;
    }
    closest() {
      return this.closestResult;
    }
    focus() {}
  }
  const terminalReturnFocusRef = { current: null };
  const editorNode = new FakeHTMLElement(null);
  const projectRow = new FakeHTMLElement(null);
  const stripeButton = new FakeHTMLElement({});
  let activeElement = projectRow;
  const remember = loadTypeScriptCallback(workspaceSource, 'rememberActivityToolWindowOrigin', {
    document: {
      get activeElement() {
        return activeElement;
      },
    },
    HTMLElement: FakeHTMLElement,
    terminalOpen: false,
    editorRef: { current: { getDomNode: () => editorNode } },
    terminalReturnFocusRef,
  });

  remember('project');
  assert.equal(terminalReturnFocusRef.current, null);
  remember('terminal');
  assert.equal(terminalReturnFocusRef.current, projectRow);

  const rememberWhileOpen = loadTypeScriptCallback(workspaceSource, 'rememberActivityToolWindowOrigin', {
    document: { activeElement: stripeButton },
    HTMLElement: FakeHTMLElement,
    terminalOpen: true,
    editorRef: { current: { getDomNode: () => editorNode } },
    terminalReturnFocusRef,
  });
  rememberWhileOpen('terminal');
  assert.equal(terminalReturnFocusRef.current, projectRow);

  const rememberStripe = loadTypeScriptCallback(workspaceSource, 'rememberActivityToolWindowOrigin', {
    document: { activeElement: stripeButton },
    HTMLElement: FakeHTMLElement,
    terminalOpen: false,
    editorRef: { current: { getDomNode: () => editorNode } },
    terminalReturnFocusRef,
  });
  terminalReturnFocusRef.current = projectRow;
  rememberStripe('terminal');
  assert.equal(terminalReturnFocusRef.current, editorNode);
});

test('Activity Stripe close restores the captured origin instead of dropping to body', () => {
  assert.match(
    workspaceSource,
    /if \(terminalOpen\) \{[\s\S]*?const previous = terminalReturnFocusRef\.current;[\s\S]*?setTerminalOpen\(false\);[\s\S]*?focusWorkspaceSurface\(previous\);/u,
  );
  assert.match(
    workspaceSource,
    /if \(terminalReturnFocusRef\.current === null\) \{[\s\S]*?current\.closest\('\[data-dsh-editor-terminal\], \[data-dsh-editor-activity-stripe\]'\)/u,
  );
  assert.match(workspaceSource, /setTerminalFocusGeneration\(\(value\) => value \+ 1\);/u);
});
