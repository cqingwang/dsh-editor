import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../src/client/components/project/ProjectPanel.tsx', import.meta.url), 'utf8');

test('the Project root copy action names both action and project', () => {
  assert.match(
    source,
    /title=\{`\$\{t\('editor\.copyProjectPath'\)\}: \$\{root\}`\}/u,
  );
  assert.match(
    source,
    /aria-label=\{`\$\{t\('editor\.copyProjectPath'\)\}: \$\{projectName\}`\}/u,
  );
});
