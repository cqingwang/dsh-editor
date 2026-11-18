import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const workspaceSource = readFileSync(join(root, 'src/client/editor-workspace.tsx'), 'utf8');
const projectPanelSource = readFileSync(join(root, 'src/client/components/project/ProjectPanel.tsx'), 'utf8');
const optionsSource = readFileSync(join(root, 'src/client/components/project/project-options-menu.ts'), 'utf8');
const localesSource = readFileSync(join(root, 'src/client/locales.ts'), 'utf8');
const source = [workspaceSource, projectPanelSource, optionsSource, localesSource].join('\n');

test('Project Options exposes IDEA Enable Preview Tab', () => {
  assert.ok(source.includes("projectPreviewTab: '启用预览标签页'"));
  assert.ok(source.includes("projectPreviewTab: 'Enable Preview Tab'"));
  assert.match(
    workspaceSource,
    /const \[\s*previewTabEnabled,\s*setPreviewTabEnabled,\s*\] = React\.useState\(\(\) => readStoredText\('dsh-editor\.project\.previewTab', '0'\) === '1'\)/,
  );
  assert.match(optionsSource, /id: 'previewTab'[\s\S]*?label: t\('editor\.projectPreviewTab'\)[\s\S]*?onTogglePreviewTab/);
});

test('Project single click can open a replaceable preview tab', () => {
  const panel = projectPanelSource;
  assert.match(panel, /onOpenPreview,/);
  assert.match(panel, /else if \(singleClickOpen === true\) onOpenPreview\(row\.path\);/);

  const workspace = workspaceSource;
  assert.match(workspace, /const openFile = React\.useCallback\([\s\S]*?\(path(?::\s*[^,]+)?, options(?::\s*[^=]+)? = \{\}\)/);
  assert.match(workspace, /const wantsPreview = options\.preview === true && previewTabEnabled;/);
  assert.match(workspace, /onOpenPreview=\{\(path\) => void openFile\(path, \{ preview: true \}\)\}/);
});

test('preview tabs replace clean files, pin on edit, and are visibly marked', () => {
  const workspace = workspaceSource;
  assert.match(workspace, /if \(wantsPreview\) \{[\s\S]*?previewPathRef\.current = path;[\s\S]*?setPreviewPath\(path\);/);
  assert.match(workspace, /entry\.path === activePath \? \{ \.\.\.entry, content: value, dirty: true \} : entry/);
  assert.match(workspace, /previewPathRef\.current = null;\n\s+setPreviewPath\(null\);/);
  assert.match(workspace, /file\.path === previewPath \? ' dsh-editor-tab-preview' : ''/);
  assert.match(workspace, /fontStyle: 'italic'/);
});
