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

test('build embeds EditorErrorBoundary and removes the legacy class', async () => {
  const build = await read('scripts/build-client.mjs');
  const legacy = await read('src/client/terminal.ts');
  const fixture = await read('tests/fixtures/editor-error-boundary.legacy.js');
  const client = await read('lib/client.js');

  assert.match(build, /EditorErrorBoundary\.tsx/u);
  assert.match(build, /editorErrorBoundaryModule/u);
  assert.doesNotMatch(legacy, /class EditorErrorBoundary extends React\.Component/u);
  assert.match(fixture, /class EditorErrorBoundary extends React\.Component/u);
  assert.match(client, /class EditorErrorBoundaryView extends React\.Component/u);
  assert.doesNotMatch(client, /class EditorErrorBoundary extends React\.Component/u);
  assert.match(client, /React\.createElement\(EditorErrorBoundary/);
});

test('EditorErrorBoundary fixture has a stable boundary', async () => {
  const fixture = await read('tests/fixtures/editor-error-boundary.legacy.js');
  const start = fixture.indexOf('class EditorErrorBoundary extends React.Component');
  const boundary = fixture.indexOf('/* EDITOR_ERROR_BOUNDARY_END */');

  assert.ok(start >= 0);
  assert.ok(boundary > start);
});
