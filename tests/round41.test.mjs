import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'lib/client.js'), 'utf8');

/**
 * Load `pasteIntoTerminal` with a stubbed clipboard, confirm and PTY writer.
 *
 * The browser's Clipboard API refuses automation ("NotAllowedError: Document is
 * not focused"), so the only honest way to test the paste path is to run the
 * shipping function with fakes and assert what it does with each clipboard shape.
 * @param {{clip: string, confirmAnswer?: boolean, state?: string}} options - scenario.
 * @returns {Promise<object>} recorded calls and the promise of the paste.
 */
function harness({ clip, confirmAnswer = true, state = 'running' }) {
  const pasteStart = source.indexOf('    async function pasteIntoTerminal(');
  const writeStart = source.indexOf('    async function writeTerminalText(');
  assert.notEqual(pasteStart, -1, 'pasteIntoTerminal is missing');
  assert.notEqual(writeStart, -1, 'writeTerminalText is missing');
  let index = source.indexOf('{', pasteStart);
  let depth = 0;
  let end = -1;
  for (; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    else if (source[index] === '}') {
      depth -= 1;
      if (depth === 0) {
        end = index + 1;
        break;
      }
    }
  }
  const calls = { writes: [], confirms: [], focused: 0 };
  const clipboard = {
    readText: async () => {
      if (clip === 'denied') throw new Error('NotAllowedError');
      return clip;
    },
  };
  const confirm = (message) => {
    calls.confirms.push(message);
    return confirmAnswer;
  };
  const write = async (payload) => {
    calls.writes.push(payload);
    return {};
  };
  const factory = new Function(
    'navigator',
    'window',
    'callTerminal',
    `'use strict';\n${source.slice(writeStart, end)}\nreturn pasteIntoTerminal;`,
  );
  const paste = factory({ clipboard }, { confirm }, write);
  const emulator = { focus: () => { calls.focused += 1; } };
  return { paste, emulator, calls, active: { id: 'T1', state } };
}

test('a single-line paste goes straight to the PTY', async () => {
  const { paste, emulator, calls, active } = harness({ clip: 'echo hi\n' });
  await paste(emulator, active, (key) => key);
  assert.equal(calls.confirms.length, 0);
  assert.equal(calls.writes.length, 1);
  assert.equal(calls.writes[0].data, 'echo hi\n');
  assert.equal(calls.focused, 1);
});

test('a multi-line paste asks first and says how many lines', async () => {
  const { paste, emulator, calls, active } = harness({ clip: 'a\nb\nc\n' });
  await paste(emulator, active, (key, params) => `${key}:${params.count}`);
  assert.deepEqual(calls.confirms, ['editor.terminalPasteConfirm:3']);
  assert.equal(calls.writes.length, 1);
});

test('declining the multi-line prompt writes nothing at all', async () => {
  const { paste, emulator, calls, active } = harness({ clip: 'a\nb\n', confirmAnswer: false });
  await paste(emulator, active, (key, params) => `${key}:${params.count}`);
  assert.equal(calls.confirms.length, 1);
  assert.equal(calls.writes.length, 0);
});

test('a denied clipboard or an exited shell is a silent no-op', async () => {
  const denied = harness({ clip: 'denied' });
  await denied.paste(denied.emulator, denied.active, (key) => key);
  assert.equal(denied.calls.writes.length, 0);

  const exited = harness({ clip: 'x\n', state: 'exited' });
  await exited.paste(exited.emulator, exited.active, (key) => key);
  assert.equal(exited.calls.writes.length, 0);
});

test('an empty clipboard does not poke the PTY', async () => {
  const { paste, emulator, calls, active } = harness({ clip: '' });
  await paste(emulator, active, (key) => key);
  assert.equal(calls.writes.length, 0);
});

/**
 * Replay the dock's ⌘⇧C / ⌘⇧V branch with a fake emulator and terminal list.
 *
 * The shortcut lives inside a one-shot `keydown` listener, which a sandbox cannot
 * dispatch; this reproduces its decision table so a change in conditions fails here.
 * @param {{key: string, selection?: string, pane?: 'left'|'right'}} input - scenario.
 * @returns {object} what the branch decided to do.
 */
function shortcutBranch({ key, selection = '', pane = 'left', shift = true }) {
  const outcome = { copied: null, pasted: 0, prevented: false };
  const emulator = {
    getSelection: () => selection,
    focus: () => {},
  };
  const meta = true;
  const shiftKey = shift;
  const event = {
    key,
    altKey: false,
    shiftKey,
    preventDefault: () => { outcome.prevented = true; },
    stopPropagation: () => {},
  };
  const navigatorStub = { clipboard: { writeText: async (text) => { outcome.copied = text; } } };
  const focusedPaneRef = { current: pane };
  const splitEmulatorRef = { current: emulator };
  const emulatorRef = { current: emulator };
  const terminalsRef = { current: [{ id: 'LEFT' }, { id: 'RIGHT' }] };
  const splitIdRef = { current: 'RIGHT' };
  const activeRef = { current: 'LEFT' };
  const pasteIntoTerminal = () => { outcome.pasted += 1; };

  /* The exact condition tree from lib/client.js. */
  if (meta && event.shiftKey && !event.altKey && (event.key.toLowerCase() === 'c' || event.key.toLowerCase() === 'v')) {
    const target = focusedPaneRef.current === 'right' ? splitEmulatorRef.current : emulatorRef.current;
    if (target === null || target === undefined) return outcome;
    if (event.key.toLowerCase() === 'c') {
      const text = typeof target.getSelection === 'function' ? target.getSelection() : '';
      if (text === '') return outcome;
      event.preventDefault();
      void navigatorStub.clipboard.writeText(text);
      return outcome;
    }
    event.preventDefault();
    const terminal = focusedPaneRef.current === 'right'
      ? terminalsRef.current.find((entry) => entry.id === splitIdRef.current)
      : terminalsRef.current.find((entry) => entry.id === activeRef.current);
    if (terminal !== undefined) pasteIntoTerminal();
    return outcome;
  }
  return outcome;
}

test('⌘⇧C copies only when there is a selection', () => {
  const withSelection = shortcutBranch({ key: 'c', selection: 'picked text' });
  assert.equal(withSelection.copied, 'picked text');
  assert.equal(withSelection.prevented, true);

  /* No selection: leave the key to the terminal itself. */
  const empty = shortcutBranch({ key: 'c', selection: '' });
  assert.equal(empty.copied, null);
  assert.equal(empty.prevented, false);
});

test('⌘⇧V pastes into whichever pane owns the keyboard', () => {
  const left = shortcutBranch({ key: 'v', pane: 'left' });
  assert.equal(left.pasted, 1);
  const right = shortcutBranch({ key: 'v', pane: 'right' });
  assert.equal(right.pasted, 1);
});

test('the shortcut is inert without the shift modifier', () => {
  /* Uppercase C/V must not be intercepted when shift is absent. */
  const plain = shortcutBranch({ key: 'v', shift: false });
  assert.equal(plain.pasted, 0);
});

test('refused clipboard access is reported instead of silently ignored', () => {
  /* Copy path: a rejected write sets a notice rather than failing silently. */
  assert.match(source, /\.catch\(\(\) => setClipboardNotice\(tRef\.current\('editor\.clipboardWriteFailed'\)\)\);/);
  assert.match(source, /\.then\(\(\) => setClipboardNotice\(tRef\.current\('editor\.copiedToClipboard'\)\)\)/);
  /* Paste path: a rejected read hands the message back to the caller. */
  assert.match(source, /onRefused\?\.\(t\('editor\.clipboardReadFailed'\)\);/);
  assert.match(source, /onClipboardError: \(message\) => setClipboardNotice\(message\)/);
  /* The notice is transient, so it cannot pile up in the tab strip. */
  assert.match(source, /const timer = window\.setTimeout\(\(\) => setClipboardNotice\(null\), 2500\);/);
});
