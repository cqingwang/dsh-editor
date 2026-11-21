import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadTypeScriptModule } from './ts-source.mjs';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

const styleModelSource = await read('src/client/components/editor/editor-style-model.ts');
const injectedCssSource = await read('src/client/injected-css.ts');
const editorCoreSource = await read('src/client/editor-core.ts');
const toolWindowPanelSource = await read('src/client/components/editor/EditorToolWindowPanel.tsx');
const inlineStylesSource = await read('src/client/inline-styles.ts');
const sharedStylesSource = await read('src/client/ui/styles.ts');

const palette = loadTypeScriptModule(styleModelSource, [
  'EDITOR_SURFACE_BACKGROUNDS',
  'editorSurfaceBackground',
  'editorToolWindowBackground',
]);

function rgb(hex) {
  return [1, 3, 5].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16));
}

function channelLuminance(value) {
  const normalized = value / 255;
  return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(hex) {
  const [red, green, blue] = rgb(hex).map(channelLuminance);
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrastAgainstBlack(hex) {
  return (relativeLuminance(hex) + 0.05) / 0.05;
}

function rgbDistance(left, right) {
  return Math.hypot(...rgb(left).map((value, index) => value - rgb(right)[index]));
}

test('tool-window and code surfaces retain distinct low-glare palette entries', () => {
  const lightProject = palette.editorSurfaceBackground('light', 'toolWindow');
  const lightCode = palette.editorSurfaceBackground('light', 'code');
  const darkProject = palette.editorSurfaceBackground('dark', 'toolWindow');
  const darkCode = palette.editorSurfaceBackground('dark', 'code');

  assert.equal(lightProject, palette.EDITOR_SURFACE_BACKGROUNDS.light.toolWindow);
  assert.equal(lightCode, palette.EDITOR_SURFACE_BACKGROUNDS.light.code);
  assert.notEqual(lightProject, lightCode);
  assert.notEqual(darkProject, darkCode);
  assert.ok(rgbDistance(lightProject, lightCode) >= 10);
  assert.ok(rgbDistance(darkProject, darkCode) >= 5);
  assert.notEqual(lightCode.toLowerCase(), '#ffffff');
  assert.ok(contrastAgainstBlack(lightProject) >= 7);
  assert.ok(contrastAgainstBlack(lightCode) >= 7);
});

test('the light reading surface is paler and less yellow than the previous warm tone', () => {
  const lightCode = palette.editorSurfaceBackground('light', 'code');
  const [red, green, blue] = rgb(lightCode);
  const channels = [red, green, blue];

  assert.ok(green >= red);
  assert.ok(blue >= red);
  assert.ok(Math.max(...channels) - Math.min(...channels) <= 6);
  assert.ok(relativeLuminance(lightCode) > relativeLuminance('#faf9f6'));
});

test('the shared surface owners consume the same background tokens', () => {
  assert.match(injectedCssSource, /--dsh-editor-project-background: \$\{EDITOR_SURFACE_BACKGROUNDS\.light\.code\}/u);
  assert.match(injectedCssSource, /--dsh-editor-code-background: \$\{EDITOR_SURFACE_BACKGROUNDS\.light\.code\}/u);
  assert.match(injectedCssSource, /prefers-color-scheme: dark[\s\S]*?EDITOR_SURFACE_BACKGROUNDS\.dark\.code/u);
  assert.match(injectedCssSource, /prefers-color-scheme: dark[\s\S]*?EDITOR_SURFACE_BACKGROUNDS\.dark\.code/u);
  assert.match(editorCoreSource, /'editor\.background': EDITOR_SURFACE_BACKGROUNDS\.light\.code/u);
  assert.match(toolWindowPanelSource, /background: editorToolWindowBackground\(activity\)/u);

  for (const stylesSource of [inlineStylesSource, sharedStylesSource]) {
    assert.match(stylesSource, /editorSurface: \{[\s\S]*?background: 'var\(--dsh-editor-code-background\)'/u);
    assert.match(stylesSource, /tabActive: \{[\s\S]*?background: 'var\(--dsh-editor-code-background\)'/u);
  }
});

test('Project uses the editor reading surface while Commit keeps the tool-window tone', () => {
  assert.equal(palette.editorToolWindowBackground('project'), 'var(--dsh-editor-code-background)');
  assert.equal(palette.editorToolWindowBackground('commit'), 'var(--dsh-editor-tool-window-background)');
  assert.equal(palette.editorToolWindowBackground('terminal'), undefined);
  assert.match(
    injectedCssSource,
    /--dsh-editor-tool-window-background: \$\{EDITOR_SURFACE_BACKGROUNDS\.light\.toolWindow\}/u,
  );
  assert.match(
    injectedCssSource,
    /prefers-color-scheme: dark[\s\S]*?--dsh-editor-tool-window-background: \$\{EDITOR_SURFACE_BACKGROUNDS\.dark\.toolWindow\}/u,
  );
});

test('Project shares the editor background without changing the line-number gutter', () => {
  assert.match(injectedCssSource, /--dsh-editor-gutter-fill: var\(--dsw-alias-interactive-bg-hover-solid\)/u);
  assert.match(injectedCssSource, /--dsh-editor-content-fill: var\(--dsh-editor-code-background\)/u);
  assert.equal(palette.editorToolWindowBackground('project'), 'var(--dsh-editor-code-background)');
});

test('Commit selected and active rows stay visible on the tool-window surface', () => {
  for (const stylesSource of [inlineStylesSource, sharedStylesSource]) {
    assert.match(
      stylesSource,
      /commitFileRowSelected: \{[\s\S]*?background:\s*'color-mix\(in srgb, var\(--dsw-alias-state-business-primary\) 24%, var\(--dsh-editor-tool-window-background\)\)'/u,
    );
    assert.match(
      stylesSource,
      /commitFileRowSelected: \{[\s\S]*?boxShadow:\s*'inset 2px 0 0 var\(--dsw-alias-state-business-primary\)'/u,
    );
    assert.match(
      stylesSource,
      /commitFileRowActive: \{[\s\S]*?background:\s*'color-mix\(in srgb, var\(--dsw-alias-state-business-primary\) 32%, var\(--dsh-editor-tool-window-background\)\)'/u,
    );
    assert.match(
      stylesSource,
      /commitFileRowActive: \{[\s\S]*?boxShadow:\s*'inset 2px 0 0 var\(--dsw-alias-state-business-primary\)'/u,
    );
  }
});
