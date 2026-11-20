import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const panel = await readFile(
  new URL('../src/client/components/commit/CommitPanel.tsx', import.meta.url),
  'utf8',
);
const locales = await readFile(new URL('../src/client/locales.ts', import.meta.url), 'utf8');

const templatesStart = panel.indexOf('{templates.length === 0 ? null : (');
const templatesEnd = panel.indexOf('{identityMissing ?', templatesStart);
const templates = panel.slice(templatesStart, templatesEnd);

test('commit template chips expose their full localized action as the accessible name', () => {
  assert.ok(templatesStart >= 0 && templatesEnd > templatesStart, 'template chips must remain present');
  assert.match(
    templates,
    /aria-label=\{t\('editor\.commitTemplateHint', \{\s+prefix,\s+\}\)\}/u,
  );
  assert.match(templates, /title=\{t\('editor\.commitTemplateHint', \{\s+prefix,\s+\}\)\}/u);
  assert.match(locales, /commitTemplateHint: '把主题前缀设为 \{prefix\}:'/u);
  assert.match(locales, /commitTemplateHint: 'Set the subject prefix to \{prefix\}:'/u);
});

test('commit actions keep native disabled semantics', () => {
  assert.match(
    panel,
    /disabled=\{busy \|\| gitNotManaged \|\| selectedPaths\.size === 0 \|\| message\.trim\(\) === ''\}\s+onClick=\{\(\) => onCommit\(false\)\}/u,
  );
  assert.match(
    panel,
    /disabled=\{busy \|\| gitNotManaged \|\| selectedPaths\.size === 0 \|\| message\.trim\(\) === ''\}\s+onClick=\{\(\) => onCommit\(true\)\}/u,
  );
});
