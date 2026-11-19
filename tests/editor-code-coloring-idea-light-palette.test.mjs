import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { loadTypeScriptModule } from './ts-source.mjs';

const root = new URL('../', import.meta.url);
const modelSource = await readFile(new URL('src/client/components/editor/editor-theme-model.ts', root), 'utf8');
const injectedCss = await readFile(new URL('src/client/injected-css.ts', root), 'utf8');
const helpers = loadTypeScriptModule(modelSource, [
  'IDEA_LIGHT_THEME_ID',
  'IDEA_LIGHT_TOKEN_COLORS',
  'ideaLightTokenRules',
]);

test('IDEA Light palette keeps the observed semantic colors', () => {
  assert.equal(helpers.IDEA_LIGHT_THEME_ID, 'dsh-editor-idea-light');
  assert.deepEqual(
    {
      keyword: helpers.IDEA_LIGHT_TOKEN_COLORS.keyword,
      string: helpers.IDEA_LIGHT_TOKEN_COLORS.string,
      number: helpers.IDEA_LIGHT_TOKEN_COLORS.number,
      comment: helpers.IDEA_LIGHT_TOKEN_COLORS.comment,
      localVariable: helpers.IDEA_LIGHT_TOKEN_COLORS.localVariable,
      globalVariable: helpers.IDEA_LIGHT_TOKEN_COLORS.globalVariable,
      method: helpers.IDEA_LIGHT_TOKEN_COLORS.method,
      property: helpers.IDEA_LIGHT_TOKEN_COLORS.property,
      typeParameter: helpers.IDEA_LIGHT_TOKEN_COLORS.typeParameter,
      annotation: helpers.IDEA_LIGHT_TOKEN_COLORS.annotation,
    },
    {
      keyword: '000080',
      string: '008000',
      number: '0000ff',
      comment: '808080',
      localVariable: '458383',
      globalVariable: '660e7a',
      method: '914c07',
      property: '660e7a',
      typeParameter: '20999d',
      annotation: '808000',
    },
  );
});

test('the grammar rules carry the IDEA font styles with the palette', () => {
  const rules = helpers.ideaLightTokenRules();
  const byToken = new Map(rules.map((rule) => [rule.token, rule]));
  assert.deepEqual(byToken.get('keyword'), {
    token: 'keyword',
    foreground: '000080',
  });
  assert.deepEqual(byToken.get('comment'), {
    token: 'comment',
    foreground: '808080',
    fontStyle: 'italic',
  });
  assert.deepEqual(byToken.get('ideaGlobalVariable'), {
    token: 'ideaGlobalVariable',
    foreground: '660e7a',
    fontStyle: 'italic',
  });
  assert.equal(byToken.get('ideaMethod').foreground, '914c07');
  assert.equal(byToken.get('ideaParameter').foreground, '000000');
  assert.equal(byToken.get('ideaClass').fontStyle, undefined);
});

test('IDEA Light code coloring never uses bold text', () => {
  const boldTokens = helpers.ideaLightTokenRules().filter((rule) => /bold/u.test(rule.fontStyle ?? ''));
  assert.deepEqual(boldTokens, []);
});

test('shared code surfaces force normal weight even for unlisted Monaco tokens', () => {
  assert.match(
    injectedCss,
    /\[data-dsh-editor-workspace\] \.monaco-editor \.view-lines span,[\s\S]*?\[data-dsh-editor-workspace\] \.dsh-editor-code-preview-line[\s\S]*?font-weight: 400 !important;/u,
  );
});

test('editor surfaces consume the shared IDEA Light theme instead of raw vs', async () => {
  const core = await readFile(new URL('src/client/editor-core.ts', root), 'utf8');
  const repositoryVersion = await readFile(
    new URL('src/client/components/diff/RepositoryVersionPreview.tsx', root),
    'utf8',
  );
  const diff = await readFile(new URL('src/client/components/diff/DiffPreview.tsx', root), 'utf8');

  assert.match(core, /ensureEditorTheme\(monaco\)/u);
  assert.match(core, /ensureIdeaLightSemanticTokens\(monaco\)/u);
  assert.match(core, /'semanticHighlighting\.enabled': true/u);
  assert.match(core, /rules:\s*base === 'vs' \? ideaLightTokenRules\(\) : \[\]/u);
  assert.match(repositoryVersion, /theme:\s*ensureEditorTheme\(monaco\)/u);
  assert.match(repositoryVersion, /'semanticHighlighting\.enabled': true/u);
  assert.match(diff, /theme:\s*ensureDiffTheme\(monaco\)/u);
  assert.match(diff, /'semanticHighlighting\.enabled': true/u);
});
