import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const source = (readFileSync(join(root, 'tests/fixtures/project-panel.legacy.js'), 'utf8') + '\n' + readFileSync(join(root, 'lib/client.js'), 'utf8'));

function projectPanel() {
  return source.slice(source.indexOf('function ProjectPanel('), source.indexOf('/**\n     * IDEA-style context menu'));
}

function treeMenu() {
  return source.slice(source.indexOf('const buildTreeMenu = React.useCallback('), source.indexOf('/* Move one entry into a directory by drag-and-drop'));
}

test('Project toolbar follows the IDEA Select / Expand Selected / Collapse order', () => {
  const panel = projectPanel();
  const reveal = panel.indexOf("id: 'reveal'");
  const expandSelected = panel.indexOf("id: 'expandSelected'");
  const collapse = panel.indexOf("id: 'collapse'");
  assert.ok(reveal >= 0 && expandSelected > reveal && collapse > expandSelected);
  assert.doesNotMatch(panel, /id: 'expandAll', icon: 'expand'/);
});

test('Project context menu groups Copy Path actions under IDEA Copy Path/Reference', () => {
  const menu = treeMenu();
  assert.match(menu, /id: 'copyReference'/);
  assert.match(menu, /label: t\('editor\.copyPathReference'\)/);
  assert.match(menu, /id: 'copyReference'[\s\S]*?items: copyReferenceMenuItems\(\{/);
  const helper = source.slice(
    source.indexOf('function copyReferenceMenuItems('),
    source.indexOf('/**\n     * Choose an icon', source.indexOf('function copyReferenceMenuItems(')),
  );
  const absolute = helper.indexOf("id: 'copyPath'");
  const fileName = helper.indexOf("id: 'copyFileName'");
  const withLine = helper.indexOf("id: 'copyPosition'");
  const contentRoot = helper.indexOf("id: 'copyRelative'");
  const shellAbsolute = helper.indexOf("id: 'copyAbsolute'");
  assert.ok(absolute >= 0 && fileName > absolute && withLine > fileName && contentRoot > withLine && shellAbsolute > contentRoot);
  assert.match(helper, /t\('editor\.copyAbsolutePathIdea'\)/);
  assert.match(helper, /label: t\('editor\.copyFileName'\)/);
  assert.match(helper, /label: t\('editor\.copyPathWithLineIdea'\)/);
  assert.match(helper, /label: t\('editor\.copyContentRootPath'\)/);
  assert.match(helper, /label: t\('editor\.copyAbsolutePath'\)/);
});

test('Copy Path/Reference keeps existing path semantics alongside Open in Right Split', () => {
  const menu = treeMenu();
  assert.match(menu, /editor: currentCodeEditor\(\)/);
  assert.match(menu, /editorPath: currentCodePath\(\)/);
  const helper = source.slice(
    source.indexOf('function copyReferenceMenuItems('),
    source.indexOf('/**\n     * Choose an icon', source.indexOf('function copyReferenceMenuItems(')),
  );
  assert.match(helper, /pathWithLine\([\s\S]*?editorPath === firstPath/);
  assert.match(helper, /write\(firstPath\)/);
  assert.match(helper, /write\(shellQuote\(absolutePath\(firstPath\)\)\)/);
  assert.match(menu, /id: 'openRightSplit'/);
  assert.match(menu, /openInRightSplit\(splitCandidates\)/);
});

test('IDEA Copy Path/Reference labels exist in both dictionaries', () => {
  for (const value of [
    "copyPathReference: '复制路径/引用…'",
    "copyAbsolutePathIdea: '绝对路径'",
    "copyFileName: '文件名'",
    "copyPathWithLineIdea: '带行号的路径'",
    "copyContentRootPath: '来自内容根的路径'",
    "copyPathReference: 'Copy Path/Reference…'",
    "copyAbsolutePathIdea: 'Absolute Path'",
    "copyFileName: 'File Name'",
    "copyPathWithLineIdea: 'Path with Line Number'",
    "copyContentRootPath: 'Path from Content Root'",
  ]) {
    assert.ok(source.includes(value), `missing ${value}`);
  }
});
