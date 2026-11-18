import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const checker = join(root, 'scripts', 'check-client-source-imports.mjs');

test('The source import checker rejects an exported symbol used without an import', async () => {
  const fixture = await mkdtemp(join(tmpdir(), 'dsh-client-source-imports-'));
  try {
    await writeFile(join(fixture, 'shared.ts'), 'export function sharedHelper(): string { return "shared"; }\n');
    await writeFile(
      join(fixture, 'consumer.ts'),
      'export function useSharedHelper(): string { return sharedHelper(); }\n',
    );

    assert.throws(
      () => execFileSync(process.execPath, [checker, fixture], { encoding: 'utf8', stdio: 'pipe' }),
      (error) => {
        assert.equal(error.status, 1);
        assert.match(error.stderr, /consumer\.ts:1:\d+ sharedHelper <-/u);
        return true;
      },
    );

    await writeFile(
      join(fixture, 'consumer.ts'),
      "import { sharedHelper } from './shared';\n\nexport function useSharedHelper(): string { return sharedHelper(); }\n",
    );
    const output = execFileSync(process.execPath, [checker, fixture], { encoding: 'utf8' });
    assert.match(output, /client-source-imports: 2 source modules verified/u);
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
});
