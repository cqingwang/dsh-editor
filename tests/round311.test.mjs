import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = readFileSync(join(root, 'lib/client.js'), 'utf8');

test('Project Options exposes IDEA Enable Preview Tab', () => {
  assert.ok(source.includes("projectPreviewTab: '启用预览标签页'"));
  assert.ok(source.includes("projectPreviewTab: 'Enable Preview Tab'"));
  assert.match(source, /const \[previewTabEnabled, setPreviewTabEnabled\] = React\.useState\(\(\) => readStoredText\('dsh-editor\.project\.previewTab', '0'\) === '1'\)/);
  assert.match(source, /id: 'previewTab'[\s\S]*?label: t\('editor\.projectPreviewTab'\)[\s\S]*?togglePreviewTab\(\)/);
});

test('Project single click can open a replaceable preview tab', () => {
  const panel = source.slice(source.indexOf('function ProjectPanel({'), source.indexOf('function flattenRows('));
  assert.match(panel, /onOpenPreview,/);
  assert.match(panel, /else if \(singleClickOpen === true\) onOpenPreview\(row\.path\);/);

  const workspace = source.slice(source.indexOf('function EditorWorkspace('), source.indexOf('function clampChatPercent('));
  assert.match(workspace, /const openFile = React\.useCallback\(async \(path, options = \{\}\) => \{/);
  assert.match(workspace, /const wantsPreview = options\.preview === true && previewTabEnabled;/);
  assert.match(workspace, /onOpenPreview: \(path\) => void openFile\(path, \{ preview: true \}\)/);
});

test('preview tabs replace clean files, pin on edit, and are visibly marked', () => {
  const workspace = source.slice(source.indexOf('function EditorWorkspace('), source.indexOf('function clampChatPercent('));
  assert.match(workspace, /if \(wantsPreview\) \{[\s\S]*?previewPathRef\.current = path;[\s\S]*?setPreviewPath\(path\);/);
  assert.match(workspace, /entry\.path === activePath \? \{ \.\.\.entry, content: value, dirty: true \} : entry/);
  assert.match(workspace, /previewPathRef\.current = null;\n\s+setPreviewPath\(null\);/);
  assert.match(workspace, /file\.path === previewPath \? ' dsh-editor-tab-preview' : ''/);
  assert.match(workspace, /fontStyle: 'italic'/);
});
