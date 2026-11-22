import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadTypeScriptCallback } from './ts-source.mjs';

const workspaceSource = await readFile(new URL('../src/client/editor-workspace.tsx', import.meta.url), 'utf8');

class FakeHTMLElement {
  constructor(closestResult) {
    this.closestResult = closestResult;
    this.focused = false;
    this.isConnected = true;
  }

  closest() {
    return this.closestResult;
  }

  focus() {
    this.focused = true;
  }
}

function loadRemember({ activeElement, initialOrigin, terminalOpen }) {
  const terminalReturnFocusRef = { current: initialOrigin };
  const editorNode = new FakeHTMLElement(null);
  const remember = loadTypeScriptCallback(workspaceSource, 'rememberActivityToolWindowOrigin', {
    document: { activeElement },
    HTMLElement: FakeHTMLElement,
    terminalOpen,
    editorRef: { current: { getDomNode: () => editorNode } },
    terminalReturnFocusRef,
  });

  remember('terminal');
  return { editorNode, terminalReturnFocusRef };
}

test('an open Terminal records the external surface that closes it', () => {
  const previousEditor = new FakeHTMLElement(null);
  const projectRow = new FakeHTMLElement(null);
  const { terminalReturnFocusRef } = loadRemember({
    activeElement: projectRow,
    initialOrigin: previousEditor,
    terminalOpen: true,
  });

  assert.equal(terminalReturnFocusRef.current, projectRow);
});

test('an open Terminal never replaces its origin with the stripe or the terminal', () => {
  const previousEditor = new FakeHTMLElement(null);
  const projectRow = new FakeHTMLElement(null);

  const stripe = loadRemember({
    activeElement: new FakeHTMLElement({}),
    initialOrigin: projectRow,
    terminalOpen: true,
  });
  assert.equal(stripe.terminalReturnFocusRef.current, projectRow);

  const terminal = loadRemember({
    activeElement: new FakeHTMLElement({ terminal: true }),
    initialOrigin: projectRow,
    terminalOpen: true,
  });
  assert.equal(terminal.terminalReturnFocusRef.current, projectRow);
});

test('mouse close restores the recorded surface after the stripe click settles', () => {
  const projectRow = new FakeHTMLElement(null);
  const events = [];
  const timers = [];
  let terminalOpen = true;
  const selectActivity = loadTypeScriptCallback(workspaceSource, 'selectActivity', {
    activity: 'project',
    focusToolWindowContent: () => {},
    hideToolWindow: () => {},
    terminalOpen,
    terminalReturnFocusRef: { current: projectRow },
    setFindTool: () => events.push('clear-find'),
    setTerminalOpen: (value) => {
      terminalOpen = value;
      events.push(['open', value]);
    },
    setTerminalFocusGeneration: () => {},
    focusWorkspaceSurface: (surface) => events.push(['focus', surface]),
    restoreTerminalFocusTarget: (preferred, fallback) => {
      if (preferred !== null && preferred.isConnected !== false) preferred.focus({ preventScroll: true });
      else fallback();
    },
    window: { setTimeout: (callback, delay) => timers.push({ callback, delay }) },
    panelVisibleRef: { current: true },
    activityRef: { current: 'project' },
  });

  selectActivity('terminal');

  assert.equal(terminalOpen, false);
  assert.deepEqual(events, ['clear-find', ['open', false]]);
  assert.equal(timers.length, 1);
  assert.equal(timers[0].delay, 0);
  timers[0].callback();
  assert.equal(projectRow.focused, true);
  assert.deepEqual(events, ['clear-find', ['open', false]]);
});
