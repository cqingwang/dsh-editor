import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path) => readFile(new URL(path, root), 'utf8');

test('EditorErrorBoundary is a reusable class TSX component', async () => {
  const component = await read('src/client/components/editor/EditorErrorBoundary.tsx');

  assert.match(component, /export interface EditorErrorBoundaryProps/u);
  assert.match(component, /class EditorErrorBoundaryView extends React\.Component/u);
  assert.match(component, /static getDerivedStateFromError\(/u);
  assert.match(component, /componentDidCatch\(/u);
  assert.match(component, /componentDidUpdate\(/u);
  assert.match(component, /role='alert'/u);
  assert.match(component, /const EditorErrorBoundary = EditorErrorBoundaryView;/u);
  assert.match(component, /export \{ EditorErrorBoundary \};/u);
  assert.doesNotMatch(component, /React\.createElement/u);
  assert.match(component, /return \(\n        <div\n          style=\{styles\.editorLoadFailure\}/u);
});
