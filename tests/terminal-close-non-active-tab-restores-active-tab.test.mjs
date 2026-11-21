import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadTypeScriptCallback, loadTypeScriptFunction } from './ts-source.mjs';

const source = await readFile(
  new URL('../src/client/components/terminal/TerminalPanel.tsx', import.meta.url),
  'utf8',
);

class FakeHTMLElement {
  constructor(tabId = null) {
    this.tabId = tabId;
    this.focused = false;
    this.isConnected = true;
  }

  closest(selector) {
    return selector === '[data-dsh-terminal-tab-id]' && this.tabId !== null ? this : null;
  }

  getAttribute(name) {
    return name === 'data-dsh-terminal-tab-id' ? this.tabId : null;
  }

  focus() {
    this.focused = true;
  }
}

function closeTerminalHarness({ activeElement, tabs }) {
  const activeTab = tabs.find((tab) => tab.tabId === 'a');
  const focusTerminalTabById = loadTypeScriptFunction(source, 'focusTerminalTabById');
  const pruneTerminalCwdMetadata = loadTypeScriptFunction(source, 'pruneTerminalCwdMetadata');
  const terminalLiveCwds = loadTypeScriptFunction(source, 'terminalLiveCwds');
  const pruneTerminalReadmeMetadata = loadTypeScriptFunction(source, 'pruneTerminalReadmeMetadata');
  const document = {
    get activeElement() {
      return activeElement;
    },
  };
  const closeTerminal = loadTypeScriptCallback(source, 'closeTerminal', {
    closingTerminalIdsRef: { current: new Set() },
    terminalsRef: { current: [{ id: 'a' }, { id: 'b' }] },
    focusedPaneRef: { current: 'left' },
    splitIdRef: { current: null },
    activeRef: { current: 'a' },
    editorIdsRef: { current: [] },
    terminalCwdRef: { current: new Map() },
    pruneTerminalCwdMetadata,
    terminalLiveCwds,
    pruneTerminalReadmeMetadata,
    setReadmePaths: () => {},
    rememberClosed: () => {},
    forgetTerminalLiveBuffer: () => {},
    setColors: (updater) => updater({}),
    writeTerminalColors: () => {},
    setTerminals: () => {},
    setActiveId: () => {},
    setError: () => {},
    terminalErrorAfterTabClosed: () => null,
    window: {
      setTimeout(callback) {
        callback();
      },
    },
    emulatorRef: { current: { focus: () => {} } },
    tabStripRef: {
      current: {
        querySelectorAll: () => tabs,
      },
    },
    focusTerminalTabById,
    callTerminal: async () => ({}),
    writeTerminalRestoreSnapshots: () => {},
    terminalActiveAfterClose: () => 'a',
    document,
    HTMLElement: FakeHTMLElement,
  });

  return { closeTerminal, activeTab };
}

test('closing a non-active tab returns focus to the active terminal tab', async () => {
  const activeTab = new FakeHTMLElement('a');
  const closedTab = new FakeHTMLElement('b');
  activeTab.focus = () => {
    activeTab.focused = true;
  };
  const closeButton = new FakeHTMLElement(null);
  closeButton.closest = (selector) => (selector === '[data-dsh-terminal-tab-id]' ? closedTab : null);
  const { closeTerminal, activeTab: harnessActiveTab } = closeTerminalHarness({
    activeElement: closeButton,
    tabs: [activeTab, closedTab],
  });

  await closeTerminal('b');

  assert.equal(harnessActiveTab.focused, true);
});

test('closing a non-active tab does not steal focus from another terminal surface', async () => {
  const activeTab = new FakeHTMLElement('a');
  const closedTab = new FakeHTMLElement('b');
  const terminalScreen = new FakeHTMLElement(null);
  const { closeTerminal, activeTab: harnessActiveTab } = closeTerminalHarness({
    activeElement: terminalScreen,
    tabs: [activeTab, closedTab],
  });

  await closeTerminal('b');

  assert.equal(harnessActiveTab.focused, false);
});
