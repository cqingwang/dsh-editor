import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const workspaceSource = readFileSync(join(root, 'src/client/editor-workspace.tsx'), 'utf8');
const controllerSource = readFileSync(join(root, 'src/client/controller.ts'), 'utf8');
const injectedCssSource = readFileSync(join(root, 'src/client/injected-css.ts'), 'utf8');
const source = [workspaceSource, controllerSource, injectedCssSource].join('\n');

/** Evaluate one shipping helper by brace balance, with the width constants. */
function load(name) {
  const marker = `function ${name}(`;
  const start = workspaceSource.indexOf(marker);
  assert.notEqual(start, -1, `${name} is missing from editor-workspace.tsx`);
  let index = source.indexOf('{', start);
  let depth = 0;
  for (; index < workspaceSource.length; index += 1) {
    if (workspaceSource[index] === '{') depth += 1;
    else if (workspaceSource[index] === '}') {
      depth -= 1;
      if (depth === 0) {
        const constants = [
          'const CHAT_WIDTH_MIN = 28;',
          'const CHAT_WIDTH_MAX = 44;',
          'const CHAT_WIDTH_DEFAULT = 35;',
        ].join('\n');
        return new Function(`${constants}\n${workspaceSource.slice(start, index + 1)}; return ${name};`)();
      }
    }
  }
  throw new Error(`unbalanced braces in ${name}`);
}

const clampChatPercent = load('clampChatPercent');

test('the chat column can be dragged within a sane range', () => {
  /* Below 28% the chat is unusable; past 44% the editor stops being an editor. */
  assert.equal(clampChatPercent(35), 35);
  assert.equal(clampChatPercent(5), 28);
  assert.equal(clampChatPercent(80), 44);
  assert.equal(clampChatPercent(Number.NaN), 35);
});

test('the Chat width remains live while the Editor uses measured geometry', () => {
  /* Round 82 replaced the hard-coded width with one variable read by all three
     Chat layout rules. Round 461 moved the Editor surface out of the replaceable
     Chat body, so its width is measured and written by `positionEditorHost`. */
  assert.match(source, /--dsh-editor-chat-width/);
  assert.match(source, /width: var\(--dsh-editor-chat-width, 35%\) !important;/);
  assert.match(source, /margin-left: var\(--dsh-editor-chat-offset, 65%\) !important;/);
  assert.match(source, /host\.style\.width = `\$\{width\}px`/);
});

test('a drag handle is injected and the width is remembered', () => {
  assert.match(source, /data-dsh-editor-chat-handle/);
  assert.match(source, /dsh-editor\.chatWidth/);
  assert.match(source, /function readChatWidth\(\)/);
  assert.match(source, /function writeChatWidth\(/);
  /* The handle must be removed together with the host. */
  const start = source.search(/function destroyHost\(\)(?::\s*void)? \{/u);
  assert.notEqual(start, -1);
  const block = source.slice(start, start + 900);
  assert.match(block, /chatHandle\?\.remove\(\)|chatHandle\.remove\(\)/);
});
