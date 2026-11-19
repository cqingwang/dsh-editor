import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('commit name prompt reclaims focus after its opener menu unmounts', async () => {
  const prompt = await read('src/client/components/commit/NamePrompt.tsx');

  assert.match(prompt, /const inputRef = React\.useRef<HTMLInputElement \| null>\(null\);/u);
  assert.match(prompt, /data-dsh-name-prompt=''/u);
  assert.match(
    prompt,
    /const timer = window\.setTimeout\(\(\) => inputRef\.current\?\.focus\(\), 40\);\s+return \(\) => window\.clearTimeout\(timer\);/u,
  );
});

test('commit name prompt cancellation restores the actionable opener and success releases it', async () => {
  const workspace = await read('src/client/editor-workspace.tsx');

  assert.match(workspace, /const namePromptReturnFocusRef = React\.useRef<HTMLElement \| null>\(null\);/u);
  assert.match(workspace, /const branchPromptOriginRef = React\.useRef<HTMLElement \| null>\(null\);/u);
  assert.match(workspace, /const logPromptOriginRef = React\.useRef<HTMLElement \| null>\(null\);/u);
  assert.match(workspace, /const openNamePrompt = React\.useCallback\(/u);
  assert.match(workspace, /const dismissNamePrompt = React\.useCallback\(/u);
  assert.match(workspace, /previous !== null && previous\.isConnected/u);
  assert.match(workspace, /openNamePrompt\(\s*\{\s*kind: 'branch'/u);
  assert.match(workspace, /openNamePrompt\(\s*\{\s*kind: 'tag'/u);
  assert.match(workspace, /onClose=\{dismissNamePrompt\}/u);
});
