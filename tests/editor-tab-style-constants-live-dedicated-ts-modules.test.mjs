import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadTypeScriptModule } from './ts-source.mjs';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('editor tab and style constants live in dedicated TS modules', async () => {
  const tabModel = await read('src/client/components/editor/editor-tab-model.ts');
  const styleModel = await read('src/client/components/editor/editor-style-model.ts');
  const tabValues = loadTypeScriptModule(tabModel, ['DIFF_TAB_KEY']);
  const styleValues = loadTypeScriptModule(styleModel, [
    'EDITOR_UI_FONT',
    'EDITOR_CODE_FONT_SIZE',
    'EDITOR_CODE_LINE_HEIGHT',
  ]);

  assert.equal(tabValues.DIFF_TAB_KEY, '\u0000dsh-editor-diff');
  assert.match(styleValues.EDITOR_UI_FONT, /^var\(--dsh-editor-font-ui, "Trebuchet MS"/u);
  assert.equal(styleValues.EDITOR_CODE_FONT_SIZE, 13);
  assert.equal(styleValues.EDITOR_CODE_LINE_HEIGHT, 20);
});
