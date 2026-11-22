import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const component = await readFile(new URL('src/client/components/search/FindToolWindow.tsx', root), 'utf8');

test('Find preview content-derived values are cached by their real inputs', () => {
  assert.match(
    component,
    /const previewWindow = React\.useMemo\(\s*\(\) => \(previewOpen \? searchEverywherePreviewWindow\(previewState\.content, previewLocalLine\) : null\),\s*\[previewOpen, previewLocalLine, previewState\.content\],\s*\);/u,
  );
  assert.match(
    component,
    /const previewLines = React\.useMemo\([\s\S]*?previewState\.content\.split\(\/\\r\?\\n\/u\)[\s\S]*?\[previewState\.content, previewWindow\],\s*\);/u,
  );
  assert.match(
    component,
    /const previewLineStarts = React\.useMemo\(\s*\(\) => findToolTextLineStarts\(previewState\.content\),\s*\[previewState\.content\]\s*\);/u,
  );
  assert.match(component, /const previewMatches = React\.useMemo\(/u);
  assert.match(component, /const previewLineParts = React\.useMemo\(/u);
  assert.match(component, /const previewSegments = previewLineParts\[index\] \?\? \[\]/u);
});
