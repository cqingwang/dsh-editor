import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import test from 'node:test';

import { loadTypeScriptModule } from './ts-source.mjs';

const source = await readFile(
  new URL('../src/client/components/editor/editor-theme-model.ts', import.meta.url),
  'utf8',
);
const controllerSource = await readFile(new URL('../src/client/controller.ts', import.meta.url), 'utf8');
const { collectIdeaLightHeuristicSemanticTokens, mergeIdeaLightSemanticTokens } = loadTypeScriptModule(source, [
  'collectIdeaLightHeuristicSemanticTokens',
  'mergeIdeaLightSemanticTokens',
]);

test('controller.ts semantic collection stays within one frame-scale budget', () => {
  const started = performance.now();
  const tokens = collectIdeaLightHeuristicSemanticTokens(controllerSource, 'typescript');
  const elapsed = performance.now() - started;

  assert.ok(tokens.length > 100, 'the real controller.ts must still produce semantic tokens');
  assert.ok(
    elapsed < 500,
    `controller.ts semantic collection took ${elapsed.toFixed(1)}ms; scrolling calls this repeatedly`,
  );
});

test('class field semantic hints keep their IDEA property classification', () => {
  const tokens = collectIdeaLightHeuristicSemanticTokens(
    [
      'class Example {',
      '  readonly first: string;',
      '  private second?: number;',
      '  public static third: boolean;',
      '}',
    ].join('\n'),
    'typescript',
  );
  const properties = mergeIdeaLightSemanticTokens(tokens)
    .filter((token) => token.tokenType === 'ideaProperty')
    .map((token) => [token.line, token.startCharacter]);

  assert.deepEqual(
    properties,
    [
      [1, 11],
      [2, 10],
      [3, 16],
    ],
  );
});
