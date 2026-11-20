import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadTypeScriptModule } from './ts-source.mjs';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const styleModel = await read('src/client/components/editor/editor-style-model.ts');
const injectedCss = await read('src/client/injected-css.ts');
const terminalScreen = await read('src/client/components/terminal/TerminalScreen.tsx');
const measuringScreen = await read('src/client/components/terminal/MeasuringScreen.tsx');
const typography = loadTypeScriptModule(styleModel, [
  'EDITOR_BASE_FONT_WEIGHT',
  'EDITOR_TERMINAL_FONT',
  'EDITOR_TERMINAL_FONT_STACK',
]);

test('Terminal owns a dedicated monospace font instead of the shared code family', () => {
  assert.equal(
    typography.EDITOR_TERMINAL_FONT_STACK,
    'Menlo, Monaco, ui-monospace, SFMono-Regular, Consolas, monospace',
  );
  assert.equal(
    typography.EDITOR_TERMINAL_FONT,
    'var(--dsh-editor-font-terminal, Menlo, Monaco, ui-monospace, SFMono-Regular, Consolas, monospace)',
  );
  assert.equal(typography.EDITOR_BASE_FONT_WEIGHT, 500);
  assert.match(injectedCss, /--dsh-editor-font-terminal: \$\{EDITOR_TERMINAL_FONT_STACK\};/u);
  assert.match(
    terminalScreen,
    /import \{[^}]*EDITOR_BASE_FONT_WEIGHT[^}]*EDITOR_TERMINAL_FONT_STACK[^}]*\} from '\.\.\/editor\/editor-style-model';/u,
  );
  assert.match(terminalScreen, /fontFamily: EDITOR_TERMINAL_FONT_STACK/u);
  assert.match(terminalScreen, /fontWeight: EDITOR_BASE_FONT_WEIGHT/u);
  assert.doesNotMatch(terminalScreen, /fontFamily: (?:EDITOR_CODE_FONT|EDITOR_TERMINAL_FONT)\b/u);
  assert.match(
    measuringScreen,
    /import \{[^}]*EDITOR_BASE_FONT_WEIGHT[^}]*EDITOR_TERMINAL_FONT_STACK[^}]*\} from '\.\.\/editor\/editor-style-model';/u,
  );
  assert.match(measuringScreen, /fontFamily: EDITOR_TERMINAL_FONT_STACK/u);
  assert.match(measuringScreen, /fontWeight: EDITOR_BASE_FONT_WEIGHT/u);
  assert.doesNotMatch(measuringScreen, /fontFamily: (?:EDITOR_CODE_FONT|EDITOR_TERMINAL_FONT)\b/u);
  assert.match(
    injectedCss,
    /\[data-dsh-editor-workspace\] \.xterm,[\s\S]*?\[data-dsh-editor-workspace\] \.xterm \.xterm-helper-textarea[\s\S]*?font-family: var\(--dsh-editor-font-terminal/u,
  );

  for (const language of ['zh', 'ja', 'ko']) {
    const start = injectedCss.indexOf(`:root:lang(${language}) {`);
    const end = injectedCss.indexOf('}', start);
    assert.ok(start >= 0 && end > start, `${language} language block is missing`);
    assert.doesNotMatch(injectedCss.slice(start, end), /--dsh-editor-font-terminal/u);
  }
});
