import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { searchWorkspaceText, workspaceFileOperations } from '../lib/index.js';

test('file masks accept IDEA extension lists such as .ts, .md', async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-file-mask-extension-list-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await writeFile(join(root, 'application.ts'), 'EXTENSION_MASK_NEEDLE TypeScript\n', 'utf8');
  await writeFile(join(root, 'application.md'), 'EXTENSION_MASK_NEEDLE Markdown\n', 'utf8');
  await writeFile(join(root, 'application.java'), 'EXTENSION_MASK_NEEDLE Java\n', 'utf8');

  const text = await searchWorkspaceText(root, 'EXTENSION_MASK_NEEDLE', {
    fileMask: '.ts, .md',
    maxMatches: 20,
  });
  assert.deepEqual(
    text.matches.map((match) => match.path).sort(),
    ['application.md', 'application.ts'],
  );

  const files = await workspaceFileOperations.files(root, 100, {
    respectGitIgnore: true,
    fileMask: '.ts, .md',
  });
  assert.deepEqual(files.files.sort(), ['application.md', 'application.ts']);
});
