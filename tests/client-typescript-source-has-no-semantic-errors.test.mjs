import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const typescriptCompiler = join(root, 'node_modules', 'typescript', 'bin', 'tsc');

test('the TypeScript client source passes semantic type checking', () => {
  const output = execFileSync(process.execPath, [typescriptCompiler, '-p', 'tsconfig.json'], {
    cwd: root,
    encoding: 'utf8',
  });
  assert.equal(output.trim(), '');
});

test('cleaned client modules stay free of implicit any compiler errors', () => {
  const protectedFiles = [
    'src/client/code-navigation.ts',
    'src/client/commit.ts',
    'src/client/controller.ts',
    'src/client/diff.ts',
    'src/client/editor-core.ts',
    'src/client/find-tool.ts',
    'src/client/project.ts',
    'src/client/terminal.ts',
  ];
  const result = spawnSync(
    process.execPath,
    [typescriptCompiler, '-p', 'tsconfig.json', '--noImplicitAny', '--pretty', 'false'],
    { cwd: root, encoding: 'utf8' },
  );
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`;
  const offenders = output
    .split('\n')
    .filter((line) => protectedFiles.some((file) => line.startsWith(`${file}(`)));
  assert.deepEqual(offenders, []);
});

test('the shared TypeScript config declares JSX for command-line and editor services', async () => {
  const clientConfig = JSON.parse(await readFile(join(root, 'tsconfig.client.json'), 'utf8'));
  assert.equal(clientConfig.compilerOptions.jsx, 'react-jsx');
  assert.equal(clientConfig.compilerOptions.jsxImportSource, 'react');
});

test('downlevelIteration keeps DOM collection iteration valid under an ES5 target', async () => {
  const clientConfig = JSON.parse(await readFile(join(root, 'tsconfig.client.json'), 'utf8'));
  assert.equal(clientConfig.compilerOptions.downlevelIteration, true);
  const fixture = await mkdtemp(join(tmpdir(), 'dsh-editor-es5-iteration-'));
  try {
    await writeFile(
      join(fixture, 'tsconfig.json'),
      JSON.stringify(
        {
          compilerOptions: {
            downlevelIteration: clientConfig.compilerOptions.downlevelIteration,
            lib: ['ES2022', 'DOM', 'DOM.Iterable'],
            noEmit: true,
            target: 'ES5',
          },
          files: ['iteration.ts'],
        },
        null,
        2,
      ),
    );
    await writeFile(
      join(fixture, 'iteration.ts'),
      [
        'export function focusTabs(root: ParentNode): void {',
        '  for (const tab of root.querySelectorAll<HTMLElement>(\'button[role="tab"]\')) tab.focus();',
        "  const spans = [...root.querySelectorAll<HTMLSpanElement>('span')];",
        '  void spans;',
        '}',
        '',
      ].join('\n'),
    );
    const output = execFileSync(process.execPath, [typescriptCompiler, '-p', join(fixture, 'tsconfig.json')], {
      cwd: root,
      encoding: 'utf8',
    });
    assert.equal(output.trim(), '');
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
});
