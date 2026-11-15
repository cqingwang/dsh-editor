import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8');

test('Markdown mode buttons keep all three IDEA actions at a fixed icon size', () => {
  assert.match(source, /markdownModeBar:\s*\{[\s\S]*?display: 'inline-flex',[\s\S]*?flex: 'none',/);
  assert.match(source, /markdownModeButton:\s*\{[\s\S]*?width: 24,[\s\S]*?height: 20,/);
  const modeSwitch = source.slice(source.indexOf('function MarkdownModeSwitch('), source.indexOf('/**\n     * Render Markdown'));
  for (const id of ['code', 'split', 'preview']) {
    assert.match(modeSwitch, new RegExp(`id: '${id}'`));
  }
  assert.match(modeSwitch, /'aria-pressed': mode === option\.id/);
  assert.match(modeSwitch, /'data-dsh-markdown-mode': mode/);
});

test('Markdown local links resolve through the document guard before opening', () => {
  const preview = source.slice(source.indexOf('function MarkdownPreviewPane('), source.indexOf('/**\n     * One file tab'));
  assert.match(preview, /const resolved = resolveMarkdownLink\(path, target\);/);
  assert.match(preview, /Promise\.resolve\(onOpenFile\?\.\(resolved\)\)/);
  assert.match(preview, /openFile: openLocal/);
});

test('Markdown external links stay in a safe new browsing context', () => {
  const preview = source.slice(source.indexOf('function MarkdownPreviewPane('), source.indexOf('/**\n     * One file tab'));
  assert.match(preview, /window\.open\(target, '_blank', 'noopener,noreferrer'\)/);
  assert.match(preview, /openExternalLink: openExternal/);
});
