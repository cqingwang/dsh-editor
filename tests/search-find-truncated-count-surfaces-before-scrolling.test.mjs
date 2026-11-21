import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { loadTypeScriptFunction } from './ts-source.mjs';

const commitSource = await readFile(new URL('../src/client/commit.ts', import.meta.url), 'utf8');
const findWindowSource = await readFile(
  new URL('../src/client/components/search/FindToolWindow.tsx', import.meta.url),
  'utf8',
);
const localesSource = await readFile(new URL('../src/client/locales.ts', import.meta.url), 'utf8');

test('truncated Find summaries use an at-least count instead of claiming an exact total', () => {
  const findToolResultSummary = loadTypeScriptFunction(commitSource, 'findToolResultSummary');
  const t = (key, params = {}) => `${key}:${JSON.stringify(params)}`;

  assert.equal(
    findToolResultSummary(t, 200, 1, true),
    'editor.findToolSummaryOneFileTruncated:{"matches":200}',
  );
  assert.equal(
    findToolResultSummary(t, 200, 2, true),
    'editor.findToolSummaryTruncated:{"matches":200,"files":2}',
  );
  assert.match(findToolResultSummary(t, 200, 1, false), /^editor\.findToolSummaryOneFile/u);
});

test('Find renders truncation in both the visible count and live status', () => {
  assert.match(findWindowSource, /findToolResultSummary\(t, resultMatches, resultFiles, state\.truncated === true\)/u);
  assert.match(
    findWindowSource,
    /t\(state\.truncated === true \? 'editor\.searchResultCountTruncated'/u,
  );
  assert.match(localesSource, /findToolSummaryTruncated: '至少 \{matches\} 处匹配/u);
  assert.match(localesSource, /findToolSummaryTruncated: 'At least \{matches\} matches/u);
  assert.match(localesSource, /searchResultCountTruncated: '至少 \{count\} 个结果/u);
  assert.match(localesSource, /searchResultCountTruncated: 'At least \{count\} results/u);
});
