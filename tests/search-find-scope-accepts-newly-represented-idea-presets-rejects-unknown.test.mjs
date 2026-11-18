import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import test from 'node:test';

const execFileAsync = promisify(execFile);
const host = await import('../lib/index.js');
const source =
  (await readFile(new URL('../lib/client.js', import.meta.url), 'utf8')) +
  '\n' +
  (await readFile(new URL('./fixtures/find-tool.legacy.js', import.meta.url), 'utf8'));
const hostSource = await readFile(new URL('../lib/index.js', import.meta.url), 'utf8');

function extractFunction(name, text = source) {
  const start = text.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} is missing`);
  const bodyStart = text.indexOf('{', start);
  let depth = 0;
  for (let index = bodyStart; index < text.length; index += 1) {
    if (text[index] === '{') depth += 1;
    if (text[index] === '}') depth -= 1;
    if (depth === 0) return text.slice(start, index + 1);
  }
  assert.fail(`${name} has no closing brace`);
}

async function createGitFixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'dsh-editor-round702-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await execFileAsync('git', ['init', '-q', root]);
  await execFileAsync('git', ['-C', root, 'config', 'user.email', 'test@example.com']);
  await execFileAsync('git', ['-C', root, 'config', 'user.name', 'Test']);
  await mkdir(join(root, 'src'));
  await writeFile(join(root, 'tracked.txt'), 'ROUND702_NEEDLE tracked\n', 'utf8');
  await writeFile(join(root, 'src', 'tracked.ts'), 'ROUND702_NEEDLE tracked source\n', 'utf8');
  await writeFile(join(root, 'untracked.txt'), 'ROUND702_NEEDLE untracked\n', 'utf8');
  await writeFile(join(root, '.gitignore'), 'ignored.txt\n', 'utf8');
  await writeFile(join(root, 'ignored.txt'), 'ROUND702_NEEDLE ignored\n', 'utf8');
  await execFileAsync('git', ['-C', root, 'add', 'tracked.txt', 'src/tracked.ts', '.gitignore']);
  await execFileAsync('git', ['-C', root, 'commit', '-qm', 'baseline']);
  return root;
}

test('Find scope accepts the newly represented IDEA presets and rejects unknown values', () => {
  const normalize = new Function(
    `${extractFunction('normalizeFindSearchScope')}; return normalizeFindSearchScope;`,
  )();
  for (const preset of ['recentlyViewedFiles', 'gitTrackedFiles', 'gitNonIgnoredFiles']) {
    assert.deepEqual(normalize({ mode: 'scope', preset }), { mode: 'scope', preset, directory: '' });
  }
  assert.deepEqual(
    normalize({ mode: 'scope', preset: 'projectAndLibraries' }),
    { mode: 'scope', preset: 'projectFiles', directory: '' },
  );
});

test('Find exposes Recently Viewed and both Git-backed IDEA scope presets', () => {
  assert.match(source, /state\.searchScopePreset === 'recentlyViewedFiles'/u);
  assert.match(source, /state\.searchScopePreset === 'gitTrackedFiles'/u);
  assert.match(source, /state\.searchScopePreset === 'gitNonIgnoredFiles'/u);
  assert.match(source, /value: 'gitNonIgnoredFiles'[^\n]*findScopeGitNonIgnoredFiles/u);
  assert.match(source, /value: 'gitTrackedFiles'[^\n]*findScopeGitTrackedFiles/u);
  assert.match(source, /value: 'recentlyViewedFiles'[^\n]*findScopeRecentlyViewedFiles/u);
  assert.match(source, /findScopeRecentlyViewedFiles: '最近查看的文件'/u);
  assert.match(source, /findScopeGitTrackedFiles: 'Git 跟踪的项目文件'/u);
  assert.match(source, /findScopeGitNonIgnoredFiles: '排除 Git 忽略项的项目文件'/u);
});

test('host tracked scope searches only tracked files that belong to the workspace directory', async (t) => {
  const root = await createGitFixture(t);
  const tracked = await host.searchWorkspaceText(root, 'ROUND702_NEEDLE', { gitScope: 'tracked' });
  assert.deepEqual(
    [...new Set(tracked.matches.map((match) => match.path))].sort(),
    ['src/tracked.ts', 'tracked.txt'],
  );

  const directory = await host.searchWorkspaceText(root, 'ROUND702_NEEDLE', {
    gitScope: 'tracked',
    directory: 'src',
  });
  assert.deepEqual([...new Set(directory.matches.map((match) => match.path))], ['src/tracked.ts']);
});

test('host non-ignored scope includes untracked files but excludes gitignored files', async (t) => {
  const root = await createGitFixture(t);
  const result = await host.searchWorkspaceText(root, 'ROUND702_NEEDLE', { gitScope: 'nonIgnored' });
  assert.deepEqual(
    [...new Set(result.matches.map((match) => match.path))].sort(),
    ['src/tracked.ts', 'tracked.txt', 'untracked.txt'],
  );
});

test('host Git scope reports which dirty buffers belong before the client merges them', async (t) => {
  const root = await createGitFixture(t);
  const tracked = await host.searchWorkspaceText(root, 'ROUND702_NEEDLE', {
    gitScope: 'tracked',
    dirtyPaths: ['tracked.txt', 'untracked.txt', 'ignored.txt'],
  });
  assert.deepEqual(tracked.dirtyPaths, ['tracked.txt']);

  const nonIgnored = await host.searchWorkspaceText(root, 'ROUND702_NEEDLE', {
    gitScope: 'nonIgnored',
    dirtyPaths: ['tracked.txt', 'untracked.txt', 'ignored.txt'],
  });
  assert.deepEqual(nonIgnored.dirtyPaths, ['tracked.txt', 'untracked.txt']);
});

test('client filters Recently Viewed by MRU and lets the host enforce Git scopes', () => {
  assert.match(source, /effectiveScopePreset === 'recentlyViewedFiles'[\s\S]*?new Set\(recentFilePaths\)/u);
  assert.match(source, /effectiveScopePreset === 'gitTrackedFiles'[\s\S]*?effectiveScopePreset === 'gitNonIgnoredFiles'/u);
  assert.match(source, /const findToolGitScope = findToolSearchScopePreset === 'gitTrackedFiles'[\s\S]*?findToolSearchScopePreset === 'gitNonIgnoredFiles'/u);
  assert.match(source, /gitScope: findToolGitScope/u);
  assert.match(source, /dirtyPaths: dirtyFiles\.map\(\(file\) => file\.path\)/u);
  assert.match(source, /const eligibleDirtyPaths = Array\.isArray\(value\?\.dirtyPaths\)/u);
  assert.match(source, /findToolPathMatchesScope[\s\S]*?options\.preset === 'gitTrackedFiles'[\s\S]*?options\.preset === 'gitNonIgnoredFiles'/u);
});

test('host route forwards git scope and dirty membership inputs', () => {
  assert.match(hostSource, /gitScope: typeof body\?\.gitScope === 'string' \? body\.gitScope : ''/u);
  assert.match(hostSource, /dirtyPaths: Array\.isArray\(body\?\.dirtyPaths\) \? body\.dirtyPaths : undefined/u);
  assert.match(hostSource, /async function listGitSearchScopeFiles/u);
  assert.match(hostSource, /'ls-files', '-z', '--cached', '--others', '--exclude-standard'/u);
});
