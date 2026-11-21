import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const workspace = await readFile(new URL('../src/client/editor-workspace.tsx', import.meta.url), 'utf8');
const locales = await readFile(new URL('../src/client/locales.ts', import.meta.url), 'utf8');
const findTool = await readFile(new URL('../src/client/components/search/FindToolWindow.tsx', import.meta.url), 'utf8');
const confirmation = await readFile(
  new URL('../src/client/components/search/search-replace-confirmation.ts', import.meta.url),
  'utf8',
);

test('Replace confirmation exposes query, replacement and an initially focused Cancel action', () => {
  assert.match(confirmation, /setAttribute\('role', 'alertdialog'\)/u);
  assert.match(confirmation, /setAttribute\('aria-modal', 'true'\)/u);
  assert.match(confirmation, /window\.setTimeout\(\(\) => cancelButton\.focus\(\), 0\)/u);
  assert.match(confirmation, /cancelButton\.dataset\.dshSearchReplaceConfirmCancel = ''/u);
  assert.match(confirmation, /event\.key === 'Escape'/u);
  assert.match(confirmation, /event\.key === 'Enter'/u);
  assert.match(confirmation, /finish\(false\)/u);
});

test('Replace confirmation names the exact query and replacement like IDEA', () => {
  assert.match(
    locales,
    /searchReplaceConfirm:\s*'将 \{files\} 个文件中的 \{matches\} 处“\{query\}”替换为“\{replacement\}”，仍要继续吗？'/u,
  );
  assert.match(
    locales,
    /searchReplaceConfirm:\s*'Replace \{matches\} \{matchUnit\} of "\{query\}" across \{files\} \{fileUnit\} with "\{replacement\}"\?'/u,
  );
});

test('both workspace Replace All paths await the in-app replacement confirmation', () => {
  assert.match(
    workspace,
    /\(\) => confirmSearchReplace\(t, query, replacement, matches\.length, operationFileCount\)/u,
  );
  assert.match(
    workspace,
    /\(\) => confirmSearchReplace\(t, query, findTool\.replace, matches\.length, operationFileCount\)/u,
  );
});

test('the floating Find window stays open while its replacement confirmation owns pointer input', () => {
  assert.match(findTool, /\[data-dsh-find-tool-window\], \[role="menu"\], \[data-dsh-search-replace-confirm\]/u);
});
