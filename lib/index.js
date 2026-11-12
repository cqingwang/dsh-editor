import { execFile } from 'node:child_process';
import { createReadStream, readdirSync, watch } from 'node:fs';
import { lstat, mkdir, readdir, readFile, rename, rm, stat, unlink, writeFile } from 'node:fs/promises';
import { basename, dirname, extname, isAbsolute, join, resolve, sep } from 'node:path';
import { promisify } from 'node:util';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { TerminalHub, encodeSse } from './terminal.js';

/** Host half of dsh-editor: workspace file access, git operations, and the Monaco asset bridge. */
export const name = 'dsh-editor';
export const inject = ['connection', 'sessions', 'workingDirectory'];

/* Workspace and git primitives are exported for the regression suite; the plugin itself only needs `apply`. */
export { revealInFileManager, gitCommit, gitDiff, gitIgnore, gitInspect, gitLastCommit, gitLog, gitResolveConflict, gitRollback, gitShowCommit, gitStage, gitStatus, parseNumstat, gitCommitDiff, gitFileHistory, gitBranches, gitCheckout, gitCheckoutRevision, gitCreateBranch, gitCreateTag, gitCherryPick, gitRevert, gitRestoreFile, gitStash, gitShelve, fileCompareText, gitDiffWithRevision, gitPush, gitFetch, gitPull, gitGraph, gitBlame, parseBlamePorcelain, gitApplyChunk, gitWriteIndex };
export { describeGitError };
export { WorkspaceWatcher };
export const workspaceFileOperations = { remove: deleteEntry, rename: renameEntry, write: writeTextFileGuarded, describe: describePaths, sort: sortEntries, reveal: revealInFileManager };

/**
 * Locate one file inside an npm package this plugin depends on.
 *
 * The editor ships no vendored copies: `monaco-editor` and `@xterm/*` are
 * ordinary `dependencies`, and their paths are resolved from this module's own
 * location. That is the only correct base: a profile installs the plugin into
 * its own tree, so `../node_modules` would point at the wrong place.
 *
 * The specifier names the FILE, not the package root: resolving
 * `@xterm/xterm/lib/xterm.mjs` yields that file, so taking `dirname` of the
 * result (correct for a `package.json` specifier) would return the `lib`
 * directory and the asset bridge would 404.
 * @param {string} specifier - a file entry, e.g. `monaco-editor/package.json`.
 * @param {string} [suffix] - path below the resolved FILE's directory.
 * @returns {string|null} absolute path, or null when the package is absent.
 */
function packagePath(specifier, suffix = '') {
  let resolved;
  try {
    resolved = createRequire(import.meta.url).resolve(specifier);
  } catch {
    /* A missing runtime package must degrade, not blank the whole plugin: the
       editor reports "Monaco failed to load" instead of failing to import. */
    return null;
  }
  if (suffix === '') return resolved;
  return join(dirname(resolved), ...suffix.split('/'));
}

/** Monaco's browser build (`min/vs`), served by the asset bridge. */
const MONACO_ROOT = (() => {
  const root = packagePath('monaco-editor/package.json', 'min/vs');
  return root === null ? null : `${root}${sep}`;
})();

/**
 * Directories the Project tree never lists.
 *
 * Only git's own metadata is hidden: every other entry — dot-files, `.venv`,
 * `node_modules`, build output — is a real path the user may want to open, so
 * the tree shows it and leaves the hiding to the "Show hidden files" toggle.
 */
const IGNORED_DIRECTORIES = new Set(['.git']);

/**
 * Heavy directories skipped by workspace-wide walks and by the file watcher.
 *
 * The tree can still expand them on demand; these lists exist so a quick-open
 * scan or a `node_modules` install does not read and watch thousands of files.
 */
const WALK_IGNORED = new Set([
  '.git',
  '.hg',
  '.svn',
  'node_modules',
  'dist',
  'build',
  'out',
  'target',
  '.next',
  '.nuxt',
  '.turbo',
  '.cache',
  '__pycache__',
  '.venv',
  'venv',
]);

/** Extensions served by the Monaco asset bridge. */
const ASSET_MEDIA_TYPES = new Map([
  ['.js', 'text/javascript; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.map', 'application/json; charset=utf-8'],
  ['.ttf', 'font/ttf'],
  ['.woff', 'font/woff'],
  ['.woff2', 'font/woff2'],
  ['.svg', 'image/svg+xml'],
  ['.png', 'image/png'],
  ['.webp', 'image/webp'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
]);

/**
 * Delete one file, directory, or symlink below the workspace root.
 * @param {string} root - workspace root.
 * @param {string} relativePath - path relative to the root.
 * @returns {Promise<{path: string, deleted: true}>} deletion acknowledgement.
 */
async function deleteEntry(root, relativePath) {
  if (relativePath === '') throw new Error('refusing to delete the workspace root');
  const target = resolveInside(root, relativePath);
  const info = await lstat(target).catch(() => null);
  if (info === null) throw new Error('path does not exist');
  if (info.isDirectory() && !info.isSymbolicLink()) {
    /* Recursive on purpose: IDEA's Delete removes a directory and its contents. */
    await rm(target, { recursive: true });
  } else await unlink(target);
  return { path: relativePath, deleted: true };
}

/**
 * Rename or move one workspace entry, refusing to overwrite an existing target.
 * @param {string} root - workspace root.
 * @param {string} relativePath - current path relative to the root.
 * @param {string} nextPath - new path relative to the root.
 * @returns {Promise<{path: string, from: string}>} moved entry identity.
 */
async function renameEntry(root, relativePath, nextPath) {
  if (relativePath === '' || nextPath === '') throw new Error('a source and target are required');
  const source = resolveInside(root, relativePath);
  const target = resolveInside(root, nextPath);
  if (source === target) return { path: nextPath, from: relativePath };
  const existing = await lstat(target).catch(() => null);
  if (existing !== null) {
    /* Name the conflicting entry: "the target already exists" leaves the user guessing which. */
    const error = new Error(`${nextPath} already exists`);
    error.code = 'dsh-editor/exists';
    throw error;
  }
  await mkdir(dirname(target), { recursive: true });
  await rename(source, target);
  return { path: nextPath, from: relativePath };
}

/** Maximum text file size accepted by the editor. */
const MAX_TEXT_BYTES = 4 * 1024 * 1024;

/** Git invocations share a bounded buffer and timeout. */
const execFileAsync = promisify(execFile);
const GIT_OPTIONS = { maxBuffer: 16 * 1024 * 1024, timeout: 20_000 };

/**
 * The one line worth showing a user when a git command fails.
 *
 * `execFile` throws `Command failed: git -C /path --no-pager …` plus the whole
 * argv, which is unreadable in a 400px tool window. git's own last stderr line
 * ("fatal: …") is the sentence that explains the failure, so that is what the
 * panel shows — IDEA does the same in its notification area.
 * @param {unknown} error - the rejection from `execFile` (or our own Error).
 * @returns {string} the message to surface.
 */
function describeGitError(error) {
  const stderr = typeof error?.stderr === 'string' ? error.stderr : '';
  const line = stderr.split('\n').map((entry) => entry.trim()).filter((entry) => entry !== '').pop();
  if (line !== undefined) return line;
  /* Fall back to the thrown object's own message (execFile's `Command failed:
     …` when stderr was empty), never to `String(object)` → "[object Object]". */
  if (typeof error?.message === 'string' && error.message !== '') return error.message;
  return String(error);
}

/**
 * Resolve one workspace-relative path without allowing it to escape the root.
 * @param {string} root - absolute workspace root.
 * @param {string} relativePath - path supplied by the browser.
 * @returns {string} absolute path inside the root.
 */
function resolveInside(root, relativePath) {
  const target = resolve(root, relativePath);
  const prefix = root.endsWith(sep) ? root : `${root}${sep}`;
  if (target !== root && !target.startsWith(prefix)) throw new Error('path escapes the workspace');
  return target;
}

/**
 * Resolve the live workspace root for one Session.
 * @param {object} sessions - Session registry service.
 * @param {object} workingDirectory - working-directory service.
 * @param {string} sessionId - Session id from the browser.
 * @returns {string} absolute workspace root.
 */
function workspaceRoot(sessions, workingDirectory, sessionId) {
  const session = sessions.get(sessionId);
  if (session === undefined) throw new Error(`session "${sessionId}" is not live`);
  const cwd = workingDirectory?.get(session) ?? session.header?.cwd;
  if (typeof cwd !== 'string' || cwd === '') throw new Error(`session "${sessionId}" has no workspace`);
  return resolve(cwd);
}

/**
 * Sort one directory listing the way IDEA's Project view does.
 *
 * Directories stay grouped ahead of files in every mode; only the ordering
 * inside each group changes. `modified` is newest-first, which is what the
 * "sort by modification time" action shows.
 * @param {object[]} entries - entries to sort in place.
 * @param {'name'|'type'|'modified'} mode - active sort mode.
 * @returns {object[]} the same array, sorted.
 */
function sortEntries(entries, mode) {
  const byName = (left, right) => left.name.localeCompare(right.name, undefined, { sensitivity: 'base' });
  const compare = mode === 'modified'
    ? (left, right) => right.mtime - left.mtime || byName(left, right)
    : mode === 'type'
      ? (left, right) => {
          const leftExtension = left.kind === 'file' ? left.name.slice(left.name.lastIndexOf('.') + 1).toLowerCase() : '';
          const rightExtension = right.kind === 'file' ? right.name.slice(right.name.lastIndexOf('.') + 1).toLowerCase() : '';
          return leftExtension.localeCompare(rightExtension) || byName(left, right);
        }
      : byName;
  entries.sort((left, right) => {
    if (left.kind !== right.kind) return left.kind === 'directory' ? -1 : 1;
    return compare(left, right);
  });
  return entries;
}

/**
 * List one directory, directories first and names case-insensitively.
 * @param {string} root - workspace root.
 * @param {string} relativePath - directory path relative to the root.
 * @param {{showHidden?: boolean}} options - IDEA's "Show hidden files" toggle.
 * @returns {Promise<{path: string, entries: object[]}>} directory listing.
 */
async function listDirectory(root, relativePath, options = {}) {
  const directory = resolveInside(root, relativePath);
  const info = await stat(directory);
  if (!info.isDirectory()) throw new Error('not a directory');
  const rows = await readdir(directory, { withFileTypes: true });
  const entries = [];
  const showHidden = options.showHidden === true;
  for (const row of rows) {
    if (IGNORED_DIRECTORIES.has(row.name)) continue;
    /* IDEA hides dot-entries unless the user turns on "Show hidden files".
       Only `.git` is unconditional (see IGNORED_DIRECTORIES). */
    if (!showHidden && row.name.startsWith('.')) continue;
    const childPath = relativePath === '' ? row.name : `${relativePath}/${row.name}`;
    let childInfo = null;
    try {
      childInfo = await stat(resolveInside(root, childPath));
    } catch {
      continue;
    }
    entries.push({
      name: row.name,
      path: childPath,
      kind: row.isDirectory() ? 'directory' : 'file',
      size: row.isDirectory() ? 0 : childInfo.size,
      mtime: childInfo.mtimeMs,
    });
  }
  sortEntries(entries, options.sort);
  return { path: relativePath, entries };
}

/**
 * Read one text file.
 * @param {string} root - workspace root.
 * @param {string} relativePath - file path relative to the root.
 * @returns {Promise<{path: string, content: string, size: number, mtime: number}>} file contents.
 */
async function readTextFile(root, relativePath) {
  const file = resolveInside(root, relativePath);
  const info = await stat(file);
  if (!info.isFile()) throw new Error('not a file');
  if (info.size > MAX_TEXT_BYTES) throw new Error('file is larger than the 4 MiB editor limit');
  const content = await readFile(file, 'utf8');
  if (content.includes('\u0000')) throw new Error('binary files are not editable');
  return { path: relativePath, content, size: info.size, mtime: info.mtimeMs };
}

/**
 * Write one text file.
 * @param {string} root - workspace root.
 * @param {string} relativePath - file path relative to the root.
 * @param {string} content - complete new contents.
 * @returns {Promise<{path: string, size: number, mtime: number}>} written file metadata.
 */
async function writeTextFile(root, relativePath, content) {
  const file = resolveInside(root, relativePath);
  const info = await stat(file);
  if (!info.isFile()) throw new Error('not a file');
  await writeFile(file, content, 'utf8');
  const next = await stat(file);
  return { path: relativePath, size: next.size, mtime: next.mtimeMs };
}

/**
 * Write one file only when the on-disk mtime still matches what the editor read.
 *
 * IDEA refuses a silent overwrite when someone else touched the file; the
 * caller gets a stable code it can turn into an "overwrite anyway" prompt.
 * @param {string} root - workspace root.
 * @param {string} relativePath - file path relative to the root.
 * @param {string} content - complete new contents.
 * @param {number|undefined} expectedMtime - mtime the editor loaded, when known.
 * @param {boolean} force - overwrite despite a changed mtime.
 * @returns {Promise<object>} written file metadata.
 */
async function writeTextFileGuarded(root, relativePath, content, expectedMtime, force, create) {
  const file = resolveInside(root, relativePath);
  const info = await stat(file).catch(() => null);
  if (info === null) {
    /* `create` is the explicit "bring it back" path used by the editor's
       recreate action; a normal save must still refuse to resurrect a file. */
    if (create !== true) throw new Error('the file no longer exists on disk');
    await mkdir(dirname(file), { recursive: true });
    await writeFile(file, content, 'utf8');
    const created = await stat(file);
    return { path: relativePath, size: created.size, mtime: created.mtimeMs, created: true };
  }
  if (!info.isFile()) throw new Error('not a file');
  if (force !== true && typeof expectedMtime === 'number' && Math.abs(info.mtimeMs - expectedMtime) > 1) {
    const error = new Error('the file changed on disk since it was opened');
    error.code = 'dsh-editor/conflict';
    error.currentMtime = info.mtimeMs;
    throw error;
  }
  await writeFile(file, content, 'utf8');
  const next = await stat(file);
  return { path: relativePath, size: next.size, mtime: next.mtimeMs };
}

/**
 * Walk the workspace once for the quick-open palette.
 *
 * Bounded on purpose: a quick-open list is a navigation aid, not a full index,
 * so heavy directories (see {@link WALK_IGNORED}) are skipped and the walk
 * stops at a fixed ceiling.
 * @param {string} root - workspace root.
 * @param {number} limit - maximum number of files.
 * @returns {Promise<{files: string[], truncated: boolean}>} workspace-relative files.
 */
async function listWorkspaceFiles(root, limit = 2000) {
  const files = [];
  const queue = [''];
  let truncated = false;
  while (queue.length > 0 && files.length < limit) {
    const directory = queue.shift();
    const entries = await listDirectory(root, directory, { showHidden: true }).catch(() => ({ entries: [] }));
    for (const entry of entries.entries) {
      if (WALK_IGNORED.has(basename(entry.path))) continue;
      if (entry.kind === 'directory') queue.push(entry.path);
      else {
        files.push(entry.path);
        if (files.length >= limit) {
          truncated = true;
          break;
        }
      }
    }
  }
  return { files, truncated };
}

/**
 * Every directory in the workspace, for the "Move to…" picker.
 *
 * The project tree only knows the directories it has expanded, so a picker built
 * from it would refuse to move a file into a folder the user has never opened.
 * The walk is breadth-first and bounded like {@link listWorkspaceFiles}, and the
 * root is always first so "move to the project root" needs no special case.
 * @param {string} root - workspace root.
 * @param {number} limit - maximum number of directories.
 * @returns {Promise<{directories: string[], truncated: boolean}>} workspace-relative directories.
 */
async function listWorkspaceDirectories(root, limit = 1000) {
  const directories = [''];
  const queue = [''];
  let truncated = false;
  while (queue.length > 0 && directories.length < limit) {
    const directory = queue.shift();
    const entries = await listDirectory(root, directory, { showHidden: true }).catch(() => ({ entries: [] }));
    for (const entry of entries.entries) {
      if (WALK_IGNORED.has(basename(entry.path))) continue;
      if (entry.kind !== 'directory') continue;
      if (directories.length >= limit) {
        truncated = true;
        break;
      }
      directories.push(entry.path);
      queue.push(entry.path);
    }
  }
  return { directories, truncated };
}

/**
 * Resolve which of the given paths exist, for terminal hyperlink detection.
 *
 * The terminal prints both workspace-relative and absolute paths, so this keeps
 * every path inside the workspace and reports the workspace-relative form the
 * editor can open. Paths outside the root are reported as missing rather than
 * leaked back to the browser.
 * @param {string} root - workspace root.
 * @param {unknown} value - candidate paths from the browser.
 * @returns {Promise<Array<{path: string, requested: string, exists: boolean, kind: string|null}>>} per-path结果.
 */
async function describePaths(root, value) {
  const candidates = Array.isArray(value) ? value.filter((item) => typeof item === 'string').slice(0, 64) : [];
  const described = [];
  for (const requested of candidates) {
    const target = resolve(root, requested);
    const prefix = root.endsWith(sep) ? root : `${root}${sep}`;
    if (target !== root && !target.startsWith(prefix)) {
      described.push({ requested, path: requested, exists: false, kind: null });
      continue;
    }
    const info = await stat(target).catch(() => null);
    const relativePath = target === root ? '' : target.slice(prefix.length).split(sep).join('/');
    described.push({
      requested,
      path: relativePath,
      exists: info !== null,
      kind: info === null ? null : info.isDirectory() ? 'directory' : 'file',
      /* mtime lets the editor tell "someone else wrote this" without re-reading it. */
      mtime: info === null ? null : info.mtimeMs,
      size: info === null || info.isDirectory() ? null : info.size,
    });
  }
  return described;
}

/**
 * Create one empty file or directory inside the workspace.
 * @param {string} root - workspace root.
 * @param {string} relativePath - path relative to the root.
 * @param {'file'|'directory'} kind - entry kind.
 * @returns {Promise<{path: string, kind: string}>} created entry identity.
 */
async function createEntry(root, relativePath, kind) {
  if (relativePath === '') throw new Error('a name is required');
  const target = resolveInside(root, relativePath);
  if (kind === 'directory') await mkdir(target);
  else await writeFile(target, '', { flag: 'wx' });
  return { path: relativePath, kind };
}

/**
 * Run one git command in the workspace root.
 * @param {string} root - workspace root.
 * @param {string[]} args - git arguments after `-C root`.
 * @returns {Promise<string>} stdout.
 */
async function runGit(root, args, options = undefined) {
  const { stdout } = await execFileAsync('git', ['-C', root, ...args], options === undefined ? GIT_OPTIONS : { ...GIT_OPTIONS, ...options });
  return stdout;
}

/**
 * Cheap change detector: repository HEAD plus the newest mtime of every
 * changed path. Polling this is far cheaper than re-reading porcelain status.
 * @param {string} root - workspace root.
 * @returns {Promise<{signature: string, isRepo: boolean}>} status fingerprint.
 */
async function gitSignature(root) {
  try {
    const head = (await runGit(root, ['rev-parse', 'HEAD'])).trim();
    const raw = await runGit(root, ['status', '--porcelain=v1', '-z', '--untracked-files=all']);
    const paths = raw
      .split('\0')
      .filter((record) => record.length > 3)
      .map((record) => record.slice(3));
    let newest = 0;
    for (const path of paths.slice(0, 400)) {
      const info = await stat(resolve(root, path)).catch(() => null);
      if (info !== null && info.mtimeMs > newest) newest = info.mtimeMs;
    }
    /* A `git add` / `git reset` only rewrites .git/index: the working files
       and their mtimes stay put, and the filesystem watcher ignores `.git`.
       Without the index's own mtime/size the Commit panel can keep showing the
       old staged group indefinitely after an external stage operation. */
    const indexInfo = await stat(join(root, '.git', 'index')).catch(() => null);
    const indexStamp = indexInfo === null ? 'none' : `${Math.round(indexInfo.mtimeMs)}:${indexInfo.size}`;
    return { signature: `${head}:${paths.length}:${Math.round(newest)}:${indexStamp}`, isRepo: true };
  } catch {
    return { signature: '', isRepo: false };
  }
}

/**
 * Parse `git diff --numstat -z` into a path → line-count map.
 *
 * Three record shapes exist, and all of them must stay distinguishable:
 * `2\t0\tpath` (ordinary change), `-\t-\tpath` (binary: no counts exist, so it
 * maps to the binary variant rather than a fabricated `+0 −0`), and renames,
 * where `-z` puts the origin and the new name in two NUL fields.
 * @param {string} output - raw numstat stdout.
 * @returns {Map<string, {additions: number, deletions: number}|{binary: true}>} counts by path.
 */
function parseNumstat(output) {
  const counts = new Map();
  if (typeof output !== 'string' || output === '') return counts;
  /* `-z` framing is NUL-separated; a plain line-framed answer is accepted too. */
  const framed = output.includes('\u0000');
  const records = output.split(framed ? '\u0000' : '\n');
  let index = 0;
  while (index < records.length) {
    const record = records[index];
    index += 1;
    if (record === '') continue;
    const addedEnd = record.indexOf('\t');
    const deletedEnd = addedEnd === -1 ? -1 : record.indexOf('\t', addedEnd + 1);
    if (deletedEnd === -1) continue;
    const added = record.slice(0, addedEnd);
    const deleted = record.slice(addedEnd + 1, deletedEnd);
    let path = record.slice(deletedEnd + 1);
    if (framed && path === '') {
      /* A rename: origin first, then the new name, both as NUL fields. */
      const renamed = records[index + 1];
      index += 2;
      if (renamed === undefined || renamed === '') continue;
      path = renamed;
    }
    if (path === '') continue;
    if (added === '-' || deleted === '-') {
      counts.set(path, { binary: true });
      continue;
    }
    const additions = Number(added);
    const deletions = Number(deleted);
    if (!Number.isFinite(additions) || !Number.isFinite(deletions)) continue;
    counts.set(path, { additions, deletions });
  }
  return counts;
}

/**
 * Attach IDEA's +N/−M line counts to each change.
 *
 * The index and worktree sides are counted separately and never summed: a path
 * can hold a change on each side ('MM'), and the panel renders it once per band
 * with that band's own reading.
 * @param {string} root - workspace root.
 * @param {object[]} changes - porcelain entries (workspace-relative paths).
 * @param {string} prefix - workspace prefix inside the repository.
 * @returns {Promise<object[]>} changes with optional `stagedLines`/`unstagedLines` counts.
 */
async function attachLineCounts(root, changes, prefix) {
  if (changes.length === 0) return changes;
  const literal = ['--literal-pathspecs'];
  /* Cap the pathspec list: a huge change set would blow the argv limit. */
  const paths = changes.length <= 200 ? ['--', ...changes.map((change) => `${prefix}${change.path}`)] : [];
  const [unstagedRaw, stagedRaw] = await Promise.all([
    runGit(root, [...literal, 'diff', '--numstat', '-z', ...paths]).catch(() => ''),
    runGit(root, [...literal, 'diff', '--cached', '--numstat', '-z', ...paths]).catch(() => ''),
  ]);
  const stagedCounts = parseNumstat(stagedRaw);
  const unstagedCounts = parseNumstat(unstagedRaw);
  return changes.map((change) => {
    const repositoryPath = `${prefix}${change.path}`;
    const stagedLines = stagedCounts.get(repositoryPath);
    const unstagedLines = unstagedCounts.get(repositoryPath);
    if (stagedLines === undefined && unstagedLines === undefined) return change;
    /* Named apart from the boolean `staged` flag: the two answer different questions. */
    return {
      ...change,
      ...(stagedLines === undefined ? {} : { stagedLines }),
      ...(unstagedLines === undefined ? {} : { unstagedLines }),
    };
  });
}

/**
 * Read porcelain v1 status and normalize paths to the workspace root.
 * @param {string} root - workspace root.
 * @returns {Promise<{root: string, branch: string, prefix: string, changes: object[]}>} status.
 */
async function gitStatus(root) {
  let branch = '';
  let prefix = '';
  try {
    branch = (await runGit(root, ['rev-parse', '--abbrev-ref', 'HEAD'])).trim();
  } catch {
    branch = '';
  }
  try {
    prefix = (await runGit(root, ['rev-parse', '--show-prefix'])).trim();
  } catch {
    prefix = '';
  }
  const branchInfo = await gitBranchInfo(root);
  const raw = await runGit(root, ['status', '--porcelain=v1', '-z', '--untracked-files=all']);
  const records = raw.split('\0');
  const changes = [];
  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];
    if (record.length < 4) continue;
    const status = record.slice(0, 2);
    let path = record.slice(3);
    if (status[0] === 'R' || status[0] === 'C') {
      const previous = records[index + 1];
      index += 1;
      if (previous === undefined) continue;
    }
    if (prefix !== '') {
      if (!path.startsWith(prefix)) continue;
      path = path.slice(prefix.length);
    }
    changes.push({
      path,
      status,
      staged: status[0] !== ' ' && status[0] !== '?',
    });
  }
  changes.sort((left, right) => left.path.localeCompare(right.path));
  const counted = await attachLineCounts(root, changes, prefix);
  return {
    root,
    branch,
    prefix,
    changes: counted,
    upstream: branchInfo.upstream,
    ahead: branchInfo.ahead,
    behind: branchInfo.behind,
    detached: branchInfo.detached,
    ...(await gitOperationState(root)),
    lastCommit: await gitLastCommit(root),
  };
}

/**
 * Normalize a browser-supplied path list, refusing anything outside the workspace.
 * @param {string} root - workspace root.
 * @param {unknown} value - raw `paths` field.
 * @returns {string[]} safe workspace-relative paths.
 */
function safePathList(root, value) {
  if (!Array.isArray(value) || value.length === 0) throw new Error('select at least one file');
  return value.map((path) => {
    if (typeof path !== 'string' || path === '') throw new Error('invalid path');
    resolveInside(root, path);
    return path;
  });
}

/**
 * Stage selected paths, commit them, and optionally push.
 * @param {string} root - workspace root.
 * @param {{message: string, paths: string[], amend?: boolean, push?: boolean}} input - commit request.
 * @returns {Promise<object>} refreshed git status.
 */
/**
 * Read the commit identity git would use here, including repository-local config.
 *
 * An unset identity is common on a fresh machine and git's own message is
 * buried in `commit`'s stderr, so the panel asks this first and reports the
 * exact variables to set.
 * @param {string} root - workspace root.
 * @returns {Promise<{name: string, email: string}>} trimmed identity fields ('' when unset).
 */
async function gitIdentity(root) {
  const [name, email] = await Promise.all([
    runGit(root, ['config', '--get', 'user.name']).catch(() => ''),
    runGit(root, ['config', '--get', 'user.email']).catch(() => ''),
  ]);
  return { name: name.trim(), email: email.trim() };
}

async function gitCommit(root, input) {
  const message = typeof input.message === 'string' ? input.message.trim() : '';
  if (message === '') throw new Error('a commit message is required');
  const safePaths = safePathList(root, input.paths);
  await runGit(root, ['add', '-A', '--', ...safePaths]);
  /* git's own failure for a missing identity is a wall of text; name the fix instead. */
  const identity = await gitIdentity(root);
  if (identity.name === '' || identity.email === '') {
    throw new Error(
      `git user.name / user.email are not configured (run: git config user.name "Your Name" && git config user.email you@example.com)`,
    );
  }
  const commitArgs = ['commit', '-m', message];
  if (input.amend === true) commitArgs.splice(1, 0, '--amend');
  let pushError = null;
  const commitOutput = await runGit(root, commitArgs).catch((error) => {
    /* "nothing to commit" is a normal outcome, not a crash: report it in words. */
    const stdout = typeof error === 'object' && error !== null && 'stdout' in error ? String(error.stdout) : '';
    if (/nothing to commit|no changes added to commit/iu.test(stdout)) {
      throw new Error('nothing to commit: the selected files have no changes');
    }
    throw error;
  });
  if (input.push === true) {
    /* A rejected push must not hide the commit that already landed. */
    try {
      await runGit(root, ['push']);
    } catch (error) {
      pushError = gitFailureLine(error);
    }
  }
  const status = await gitStatus(root);
  return { ...status, commitOutput: commitOutput.trim(), pushError };
}

/**
 * Move paths between the index and the working tree.
 * @param {string} root - workspace root.
 * @param {{paths: string[], staged: boolean}} input - staging request.
 * @returns {Promise<object>} refreshed git status.
 */
async function gitStage(root, input) {
  const safePaths = safePathList(root, input.paths);
  if (input.staged === true) await runGit(root, ['reset', '--', ...safePaths]);
  else await runGit(root, ['add', '-A', '--', ...safePaths]);
  return gitStatus(root);
}

/**
 * Stash the working tree, or restore from the stash list (IDEA's Changes header).
 *
 * Three operations are exposed, matching IDEA's menu: `list` (read-only, also
 * returns the newest entry so the UI can label "pop"), `save` and `pop`.
 * `save` keeps untracked files in the stash — without `-u`, a brand-new file
 * silently survives a "stash everything" and the user's tree is not clean.
 * @param {string} root - workspace root.
 * @param {{op: 'list'|'save'|'pop', message?: string}} input - stash request.
 * @returns {Promise<object>} stash entries and refreshed git status.
 */
async function gitStash(root, input) {
  /* `op` is already taken by the route envelope, so the sub-action arrives as `action`. */
  const requested = input?.action;
  const operation = ['save', 'pop', 'apply', 'drop'].includes(requested) ? requested : 'list';
  if (operation === 'save') {
    const message = typeof input?.message === 'string' ? input.message.trim() : '';
    /* A message is optional; git supplies "WIP on <branch>" when omitted. */
    const args = ['stash', 'push', '--include-untracked'];
    if (message !== '') args.push('-m', message);
    await runGit(root, args);
  } else if (operation === 'pop' || operation === 'apply' || operation === 'drop') {
    /* An empty stash is a user mistake, not a crash: say so in words git does not. */
    const listed = (await runGit(root, ['stash', 'list']).catch(() => '')).trim();
    if (listed === '') throw new Error('the stash is empty');
    const refs = listed
      .split('\n')
      .map((line) => line.trim().split(':')[0])
      .filter((entry) => entry !== '');
    /* The ref arrives from the browser, so it is validated against the REAL stack
       instead of being pasted into argv: `--index` or `stash@{9}` would otherwise
       be obeyed by git (`--index` is a valid-looking option here). */
    const wanted = operation === 'pop' ? refs[0] : (typeof input?.ref === 'string' ? input.ref.trim() : '');
    if (wanted === '' || !refs.includes(wanted)) throw new Error(`no such stash: ${wanted === '' ? '(none)' : wanted}`);
    const verb = operation === 'drop' ? 'drop' : operation === 'apply' ? 'apply' : 'pop';
    await runGit(root, ['stash', verb, wanted]).catch((error) => {
      const stderr = typeof error === 'object' && error !== null && 'stderr' in error ? String(error.stderr) : String(error);
      throw new Error(`stash ${verb} stopped: ${stderr.trim().split('\n')[0]}`);
    });
  }
  const raw = await runGit(root, ['stash', 'list', '--pretty=format:%gd%x1f%gs%x1f%cr%x1e']).catch(() => '');
  const entries = raw
    .split('\u001e')
    .map((record) => record.trim())
    .filter((record) => record !== '')
    .map((record) => {
      const [ref = '', subject = '', when = ''] = record.split('\u001f');
      return { ref, subject, when };
    });
  return { entries, ...(await gitStatus(root)) };
}

/**
 * IDEA's Shelve Silently, backed by git's index-aware stash machinery.
 *
 * Shelve is not the same operation as "stash everything": it shelves only the
 * paths given by the caller, and restoring it must keep an `MM` file's staged
 * side and worktree side separate. `stash push -- paths` captures both sides;
 * the index side is restored by `stash apply --index` (a plain apply loses it).
 * The entries use a dedicated message prefix so they can be listed without
 * confusing ordinary stashes with IDE shelves.
 * @param {string} root - workspace root.
 * @param {{action: 'list'|'save'|'apply'|'drop', paths?: string[], ref?: string, message?: string}} input - shelf request.
 * @returns {Promise<object>} shelf entries and refreshed git status.
 */
async function gitShelve(root, input) {
  const requested = input?.action;
  const action = ['save', 'apply', 'drop'].includes(requested) ? requested : 'list';
  const prefix = 'dsh-editor-shelve:';

  const list = async () => {
    const raw = await runGit(root, ['stash', 'list', '--pretty=format:%gd%x1f%gs%x1f%cr%x1e']).catch(() => '');
    return raw
      .split('\u001e')
      .map((record) => record.trim())
      .filter((record) => record !== '')
      .map((record) => {
        const [ref = '', subject = '', when = ''] = record.split('\u001f');
        return { ref, subject, when };
      })
      .filter((entry) => entry.subject.includes(prefix));
  };

  if (action === 'save') {
    const paths = safePathList(root, input?.paths);
    if (paths.length === 0) throw new Error('select at least one change to shelve');
    const message = typeof input?.message === 'string' && input.message.trim() !== ''
      ? input.message.trim()
      : `${prefix} ${new Date().toISOString()}`;
    await runGit(root, ['stash', 'push', '--include-untracked', '-m', message, '--', ...paths]);
  } else if (action === 'apply' || action === 'drop') {
    const entries = await list();
    const wanted = typeof input?.ref === 'string' ? input.ref.trim() : '';
    if (wanted === '' || !entries.some((entry) => entry.ref === wanted)) {
      throw new Error(`no such shelf: ${wanted === '' ? '(none)' : wanted}`);
    }
    const verb = action === 'apply' ? 'apply' : 'drop';
    const args = verb === 'apply' ? ['stash', 'apply', '--index', wanted] : ['stash', 'drop', wanted];
    await runGit(root, args).catch((error) => {
      const stderr = typeof error === 'object' && error !== null && 'stderr' in error ? String(error.stderr) : String(error);
      throw new Error(`shelve ${verb} stopped: ${stderr.trim().split('\n')[0]}`);
    });
  }
  return { entries: await list(), ...(await gitStatus(root)) };
}

/**
 * Inspect the selected paths before a commit: unresolved conflicts and
 * whitespace errors are the two things IDEA warns about by default.
 * @param {string} root - workspace root.
 * @param {string[]} paths - workspace-relative paths about to be committed.
 * @returns {Promise<{conflicts: string[], whitespace: string[], ok: boolean}>} inspection result.
 */
async function gitInspect(root, paths) {
  const safePaths = safePathList(root, paths);
  const status = await gitStatus(root);
  const conflicts = status.changes
    .filter((change) => /^(DD|AU|UD|UA|DU|AA|UU)$/u.test(change.status))
    .map((change) => change.path)
    .filter((path) => safePaths.includes(path));
  let whitespace = [];
  try {
    const raw = await runGit(root, ['diff', '--check', '--', ...safePaths]);
    whitespace = raw
      .split('\n')
      .map((line) => /^(.+?):\d+:/u.exec(line)?.[1])
      .filter((value) => typeof value === 'string');
  } catch (error) {
    /* `git diff --check` exits 1 when it finds problems; its stdout still lists them. */
    const stdout = typeof error === 'object' && error !== null && 'stdout' in error ? String(error.stdout) : '';
    whitespace = stdout
      .split('\n')
      .map((line) => /^(.+?):\d+:/u.exec(line)?.[1])
      .filter((value) => typeof value === 'string');
  }
  return {
    conflicts: [...new Set(conflicts)],
    whitespace: [...new Set(whitespace)],
    identity: await gitIdentity(root),
    ok: conflicts.length === 0 && whitespace.length === 0,
  };
}

/**
 * Reveal one workspace entry in the platform file manager (IDEA's "Reveal in Finder").
 *
 * The spawn is fire-and-forget on purpose: the file manager detaches from the
 * host process, so we must not keep a child handle or wait for it.
 * @param {string} root - workspace root.
 * @param {string} relativePath - entry to reveal; the root itself when empty.
 * @returns {Promise<{path: string, revealed: true}>} acknowledgement.
 */
async function revealInFileManager(root, relativePath, options) {
  /* The terminal follows `cd`, so the shell can sit outside the workspace. With
     `absolute` the caller passes a real path and it is opened as-is; without it the
     value stays sandboxed through `resolveInside`. `launch: false` exists so tests can
     check resolution without starting Finder. */
  const absolute = options?.absolute === true;
  const target = absolute ? String(relativePath ?? '') : resolveInside(root, relativePath);
  if (absolute && !isAbsolute(target)) throw new Error('an absolute path is required');
  const info = await stat(target).catch(() => null);
  if (info === null) throw new Error('path does not exist');
  if (options?.launch !== false) {
    const command = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'explorer' : 'xdg-open';
    const args = process.platform === 'darwin' && info.isFile() ? ['-R', target] : [target];
    /* detached + ignored: the file manager owns its own lifetime. */
    const child = execFile(command, args, { detached: true });
    child.unref();
  }
  return { path: absolute ? target : relativePath, revealed: true };
}

/**
 * Resolve one conflicted file by taking the current ("ours") or incoming ("theirs") side.
 *
 * Mirrors IDEA's conflict dialog: `git checkout --ours/--theirs <path>` followed by
 * `git add <path>`, which is exactly what "Accept Yours/Their Changes" does.
 * @param {string} root - workspace root.
 * @param {{paths: string[], side: 'ours'|'theirs'}} input - resolution request.
 * @returns {Promise<object>} refreshed git status.
 */
async function gitResolveConflict(root, input) {
  const safePaths = safePathList(root, input.paths);
  const side = input.side === 'theirs' ? '--theirs' : '--ours';
  await runGit(root, ['checkout', side, '--', ...safePaths]);
  await runGit(root, ['add', '-A', '--', ...safePaths]);
  return gitStatus(root);
}

/**
 * Extract the first meaningful line from git's stderr/stdout.
 *
 * git prints hints, progress and a blank line before the actual reason; showing
 * the raw stderr in a one-line notification is unreadable.
 * @param {unknown} error - the rejected child-process error.
 * @returns {string} the most explanatory line, or the whole message.
 */
function gitFailureLine(error) {
  const record = typeof error === 'object' && error !== null ? error : {};
  const text = [record.stderr, record.stdout, record.message]
    .map((value) => (typeof value === 'string' ? value : ''))
    .find((value) => value.trim() !== '') ?? '';
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '')
    /* git's preamble: the remote URL line, its hints, and "use ..." advice. */
    /* The transfer preamble names the remote ("To …" when pushing, "From …" when
       fetching or pulling); it is context, not the reason anything failed. */
    .filter((line) => !/^hint:/iu.test(line) && !/^use /iu.test(line) && !/^(to|from) \S+$/iu.test(line))
    /* Ref-update summaries (`abc..def  main -> origin/main`) are transfer progress;
       the reason git aborted is on the `fatal:` line after them. */
    .filter((line) => !/^[0-9a-f]{4,}\.\.[0-9a-f]{4,}\s+\S+\s+->\s+/iu.test(line))
    /* Progress noise from a slow transfer. */
    .filter((line) => !/^(remote:|counting objects|compressing objects|writing objects|total \d)/iu.test(line));
  return lines[0] ?? text.trim();
}

/**
 * Push the current branch, with an explicit upstream when git has none.
 *
 * `git push` on a branch with no upstream fails with a paragraph of hints; IDEA
 * offers "Publish branch" instead. This does the same: when no upstream is set,
 * push with `--set-upstream origin <branch>`.
 * @param {string} root - workspace root.
 * @returns {Promise<object>} refreshed status plus what was pushed.
 */
async function gitPush(root) {
  const branchInfo = await gitBranchInfo(root);
  if (branchInfo.detached === true) throw new Error('HEAD is detached: check out a branch before pushing');
  /* `gitBranchInfo` reports upstream/ahead/behind/detached but not the branch name. */
  const branch = (await runGit(root, ['rev-parse', '--abbrev-ref', 'HEAD']).catch(() => '')).trim();
  if (branch === '' || branch === 'HEAD') throw new Error('cannot determine the current branch');
  const published = branchInfo.upstream !== '';
  try {
    await runGit(root, published ? ['push'] : ['push', '--set-upstream', 'origin', branch]);
  } catch (error) {
    throw new Error(`push failed: ${gitFailureLine(error)}`);
  }
  return { ...(await gitStatus(root)), published: !published, branch };
}

/**
 * Read the configured remote names, so "Fetch" can say what it will contact.
 * @param {string} root - workspace root.
 * @returns {Promise<string[]>} remote names, usually just `origin`.
 */
async function gitRemoteNames(root) {
  const raw = await runGit(root, ['remote']).catch(() => '');
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '');
}

/**
 * Fetch every remote without touching the working tree (IDEA's "Fetch").
 *
 * Fetch only updates remote-tracking refs, so the editor's open buffers stay
 * valid; the value of running it is the refreshed `behind` count in the
 * toolbar. `--prune` drops refs for branches deleted upstream, which is what
 * IDEA's fetch does and what keeps the behind count honest.
 * @param {string} root - workspace root.
 * @returns {Promise<object>} refreshed status plus the remotes that were read.
 */
async function gitFetch(root) {
  const remotes = await gitRemoteNames(root);
  if (remotes.length === 0) throw new Error('this repository has no remote to fetch from');
  try {
    await runGit(root, ['fetch', '--all', '--prune']);
  } catch (error) {
    throw new Error(`fetch failed: ${gitFailureLine(error)}`);
  }
  return { ...(await gitStatus(root)), remotes };
}

/**
 * Update Project: fast-forward the current branch onto its upstream.
 *
 * `--ff-only` is deliberate (the same choice better-sidebar makes in
 * `src/git.ts`): a headless tool window must not open a merge or leave a
 * conflicted index behind, so a diverged branch fails with git's own sentence
 * and the user resolves it in the terminal.
 * @param {string} root - workspace root.
 * @returns {Promise<object>} refreshed status plus what was updated.
 */
async function gitPull(root) {
  const branchInfo = await gitBranchInfo(root);
  if (branchInfo.detached === true) throw new Error('HEAD is detached: check out a branch before updating');
  if (branchInfo.upstream === '') throw new Error('the current branch has no upstream to update from');
  const branch = (await runGit(root, ['rev-parse', '--abbrev-ref', 'HEAD']).catch(() => '')).trim();
  try {
    await runGit(root, ['pull', '--ff-only']);
  } catch (error) {
    throw new Error(`update failed: ${gitFailureLine(error)}`);
  }
  return { ...(await gitStatus(root)), branch };
}

/**
 * Validate a revision the log panel may act on.
 *
 * Only commit-ish forms the UI can produce are accepted: an unvalidated value
 * would reach `git`'s argv, where `--hard` or a pathspec would be obeyed.
 * @param {unknown} value - requested revision.
 * @returns {string} the validated revision expression.
 */
function requireRevision(value) {
  if (typeof value !== 'string' || !/^(?:HEAD~?\d*|[0-9a-f]{4,40})$/u.test(value)) throw new Error('invalid commit id');
  return value;
}

/**
 * Cherry-pick one commit onto the current branch (IDEA's Log context action).
 *
 * A conflicting pick leaves the repository mid-operation; that state is reported
 * back instead of being swallowed, because the user has to resolve it by hand.
 * @param {string} root - workspace root.
 * @param {string} hash - commit to apply.
 * @returns {Promise<object>} refreshed status plus any conflict report.
 */
async function gitCherryPick(root, hash) {
  const revision = requireRevision(hash);
  const output = await runGit(root, ['cherry-pick', revision]).catch((error) => {
    const stdout = typeof error === 'object' && error !== null && 'stdout' in error ? String(error.stdout) : '';
    const stderr = typeof error === 'object' && error !== null && 'stderr' in error ? String(error.stderr) : String(error);
    const status = new Error(`cherry-pick stopped: ${(stderr || stdout).trim().split('\n')[0]}`);
    status.code = 'dsh-editor/git-conflict';
    throw status;
  });
  return { ...(await gitStatus(root)), output: output.trim() };
}

/**
 * Revert one commit on the current branch, creating the inverse commit.
 * @param {string} root - workspace root.
 * @param {string} hash - commit to revert.
 * @returns {Promise<object>} refreshed status plus the revert output.
 */
async function gitRevert(root, hash) {
  const revision = requireRevision(hash);
  const output = await runGit(root, ['revert', '--no-edit', revision]).catch((error) => {
    const stderr = typeof error === 'object' && error !== null && 'stderr' in error ? String(error.stderr) : String(error);
    const failure = new Error(`revert stopped: ${stderr.trim().split('\n')[0]}`);
    failure.code = 'dsh-editor/git-conflict';
    throw failure;
  });
  return { ...(await gitStatus(root)), output: output.trim() };
}

/**
 * Restore one file to its content at a revision, without touching anything else.
 *
 * This is IDEA's "Revert Selected Changes" from the file history: unlike
 * `git checkout <rev> -- <path>` it refuses paths outside the workspace and
 * reports a file that did not exist at that revision instead of deleting it,
 * because a silent deletion is not what the user asked for.
 * @param {string} root - workspace root.
 * @param {{hash: string, path: string}} input - revision and workspace-relative path.
 * @returns {Promise<object>} refreshed status plus what was written.
 */
async function gitRestoreFile(root, input) {
  const revision = requireRevision(input?.hash);
  const relativePath = typeof input?.path === 'string' ? input.path : '';
  if (relativePath === '') throw new Error('a path is required');
  const target = resolveInside(root, relativePath);
  const prefix = (await runGit(root, ['rev-parse', '--show-prefix']).catch(() => '')).trim();
  const content = await gitBlobMaybe(root, revision, `${prefix}${relativePath}`);
  if (content === null) throw new Error('that revision does not contain this file');
  const info = await stat(target).catch(() => null);
  if (info !== null && !info.isFile()) throw new Error('not a file');
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, content, 'utf8');
  return { path: relativePath, hash: revision, ...(await gitStatus(root)) };
}

/**
 * Append the given paths to the repository's `.gitignore`, IDEA's "Add to .gitignore".
 *
 * Entries already present are skipped, so repeated invocations stay idempotent;
 * the file is created when the repository has none yet.
 * @param {string} root - workspace root.
 * @param {string[]} paths - workspace-relative paths to ignore.
 * @returns {Promise<{added: string[], ignored: string[]}>} what changed and what was already there.
 */
async function gitIgnore(root, paths) {
  const safePaths = safePathList(root, paths);
  const prefix = (await runGit(root, ['rev-parse', '--show-prefix']).catch(() => '')).trim();
  /* `.gitignore` always lives at the repository top level, not the workspace subdirectory. */
  const topLevel = (await runGit(root, ['rev-parse', '--show-toplevel']).catch(() => '')).trim();
  if (topLevel === '') throw new Error('not a git repository');
  const ignoreFile = join(topLevel, '.gitignore');
  const existing = await readFile(ignoreFile, 'utf8').catch(() => '');
  const known = new Set(
    existing
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line !== '' && !line.startsWith('#')),
  );
  const added = [];
  const ignored = [];
  for (const path of safePaths) {
    const entry = `${prefix}${path}`;
    if (known.has(entry) || known.has(`/${entry}`)) {
      ignored.push(path);
      continue;
    }
    known.add(entry);
    added.push(entry);
  }
  if (added.length > 0) {
    const separator = existing === '' || existing.endsWith('\n') ? '' : '\n';
    await writeFile(ignoreFile, `${existing}${separator}${added.join('\n')}\n`, 'utf8');
  }
  return { added, ignored };
}

/**
 * Discard working-tree edits for the given paths (IDEA's Rollback).
 *
 * Tracked files are restored from the index; untracked files are already absent
 * from it, so they are deleted from disk instead of being reported as an error.
 * @param {string} root - workspace root.
 * @param {string[]} paths - workspace-relative paths.
 * @returns {Promise<object>} refreshed git status.
 */
async function gitRollback(root, input) {
  /* Two different discards, IDEA keeps them apart:
       staged   -> unstage, keeping the edit in the working tree (`git restore --staged`)
       worktree -> drop the edit, restoring the index version (`git checkout --`) */
  const paths = Array.isArray(input) ? input : input?.paths;
  const stagedOnly = Array.isArray(input) ? false : input?.staged === true;
  const safePaths = safePathList(root, paths);
  if (stagedOnly) {
    await runGit(root, ['restore', '--staged', '--', ...safePaths]);
    return gitStatus(root);
  }
  const status = await gitStatus(root);
  const untracked = new Set(status.changes.filter((change) => change.status === '??').map((change) => change.path));
  const tracked = safePaths.filter((path) => !untracked.has(path));
  const fresh = safePaths.filter((path) => untracked.has(path));
  if (tracked.length > 0) await runGit(root, ['checkout', '--', ...tracked]);
  for (const path of fresh) await deleteEntry(root, path);
  return gitStatus(root);
}

/**
 * Read the recent commit log for the history view.
 * @param {string} root - workspace root.
 * @param {number} limit - maximum number of commits.
 * @returns {Promise<object[]>} commits, newest first.
 */
async function gitLog(root, limit = 60, skip = 0, author = '') {
  const count = Number.isSafeInteger(limit) ? Math.max(1, Math.min(200, limit)) : 60;
  const offset = Number.isSafeInteger(skip) ? Math.max(0, skip) : 0;
  /* `--author` is a regex in git, so the value is escaped to stay a literal substring. */
  const authorArgs = typeof author === 'string' && author.trim() !== '' ? [`--author=${author.trim().replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')}`] : [];
  /* A failure here is reported, not swallowed: an empty array would render as
     "this repository has no commits", which is a different (false) statement. */
  const raw = await runGit(root, ['log', `-n${count}`, `--skip=${offset}`, ...authorArgs, '--pretty=format:%H%x1f%an%x1f%aI%x1f%s%x1e']);
  return raw
    .split('\u001e')
    .map((record) => record.trim())
    .filter((record) => record !== '')
    .map((record) => {
      const [hash = '', author = '', date = '', subject = ''] = record.split('\u001f');
      return { hash, author, date, subject };
    });
}

/**
 * Read one commit's metadata and changed paths for the history view.
 * @param {string} root - workspace root.
 * @param {string} hash - commit identity.
 * @returns {Promise<object>} commit detail.
 */
async function gitShowCommit(root, hash) {
  /* `HEAD` and short hashes are both valid revision expressions for the history view. */
  if (typeof hash !== 'string' || !/^(?:HEAD~?\d*|[0-9a-f]{4,40})$/u.test(hash)) throw new Error('invalid commit id');
  const prefix = (await runGit(root, ['rev-parse', '--show-prefix']).catch(() => '')).trim();
  const raw = await runGit(root, ['show', '--no-color', '--format=%H%x1f%an%x1f%aI%x1f%s%x1f%b%x1f', '--name-status', hash]);
  const [fullHash = '', author = '', date = '', subject = '', body = ''] = raw.split('\u001f');
  const files = [];
  for (const line of raw.split('\n')) {
    const match = /^([AMDRC])\d*\t(.+)$/u.exec(line.trim());
    if (match === null) continue;
    const path = prefix !== '' && match[2].startsWith(prefix) ? match[2].slice(prefix.length) : match[2];
    files.push({ status: match[1], path });
  }
  return { hash: fullHash.trim(), author, date, subject: subject.trim(), body: body.trim(), files };
}

/**
 * Read one file's content at a revision, tolerating files that did not exist there.
 * @param {string} root - workspace root.
 * @param {string} repositoryPath - path relative to the repository root.
 * @param {'head'|'index'} side - which revision to read.
 * @returns {Promise<string>} blob text, or an empty string for a missing blob.
 */
async function gitBlob(root, repositoryPath, side) {
  const spec = side === 'index' ? `:${repositoryPath}` : `HEAD:${repositoryPath}`;
  try {
    return await runGit(root, ['show', spec]);
  } catch {
    return '';
  }
}

/**
 * Write one file's contents to the index without touching the working tree.
 *
 * IDEA's staged-side diff resolves one hunk by changing only the staged copy;
 * writing the working file would silently stage unrelated bytes. `hash-object`
 * avoids a temp file, and `update-index --cacheinfo` updates exactly one path.
 * @param {string} root - workspace root.
 * @param {string} prefix - repository prefix of the workspace root.
 * @param {{path: string, content: string}} input - workspace-relative path and the complete new index text.
 * @returns {Promise<object>} published workspace status.
 */
async function gitWriteIndex(root, prefix, input) {
  const relativePath = typeof input?.path === 'string' ? input.path : '';
  if (relativePath === '') throw new Error('a path is required');
  if (typeof input?.content !== 'string') throw new Error('missing content');
  resolveInside(root, relativePath);
  const repositoryPath = `${prefix}${relativePath}`;
  const mode = (await runGit(root, ['ls-files', '-s', '--', repositoryPath]))
    .trim()
    .split(/\s+/u)[0];
  if (!/^100(?:644|755)$/u.test(mode)) throw new Error('the index has no text version of this file');
  const temp = join(root, `.git`, `dsh-editor-index-${process.pid}-${Date.now()}.tmp`);
  try {
    await writeFile(temp, input.content, 'utf8');
    const hash = (await runGit(root, ['hash-object', '-w', temp])).trim();
    await runGit(root, ['update-index', '--cacheinfo', `${mode},${hash},${repositoryPath}`]);
  } finally {
    await unlink(temp).catch(() => {});
  }
  return { ...(await gitStatus(root)), path: relativePath };
}

/**
 * Apply one resolved hunk to a repository side, IDEA's per-change `>>>`.
 *
 * The browser computes the complete replacement text from Monaco's diff model;
 * the host still re-reads the side it is about to overwrite and compares the
 * expected bytes, so a concurrent git/editor write cannot be silently clobbered.
 * @param {string} root - workspace root.
 * @param {string} prefix - repository prefix of the workspace root.
 * @param {{path: string, side: 'worktree'|'index', expected: string, content: string}} input - guarded write request.
 * @returns {Promise<object>} published status after the write.
 */
async function gitApplyChunk(root, prefix, input) {
  const relativePath = typeof input?.path === 'string' ? input.path : '';
  if (relativePath === '') throw new Error('a path is required');
  if (typeof input?.expected !== 'string' || typeof input?.content !== 'string') throw new Error('missing replacement text');
  const side = input.side === 'index' ? 'index' : input.side === 'worktree' ? 'worktree' : '';
  if (side === '') throw new Error('invalid diff side');
  const file = resolveInside(root, relativePath);
  const repositoryPath = `${prefix}${relativePath}`;
  const current = side === 'index' ? await gitBlob(root, repositoryPath, 'index') : await readFile(file, 'utf8').catch(() => '');
  if (current !== input.expected) {
    const error = new Error('the file changed since the diff was loaded');
    error.code = 'dsh-editor/conflict';
    throw error;
  }
  if (side === 'index') return gitWriteIndex(root, prefix, { path: relativePath, content: input.content });
  await writeFile(file, input.content, 'utf8');
  return { ...(await gitStatus(root)), path: relativePath };
}

/**
 * Build the two sides of one file's diff for the commit preview.
 * @param {string} root - workspace root.
 * @param {string} prefix - repository prefix of the workspace root.
 * @param {{path: string, staged?: boolean}} input - diff request.
 * @returns {Promise<object>} diff payload.
 */
async function gitDiff(root, prefix, input) {
  const relativePath = typeof input.path === 'string' ? input.path : '';
  if (relativePath === '') throw new Error('a path is required');
  const file = resolveInside(root, relativePath);
  const repositoryPath = `${prefix}${relativePath}`;
  const staged = input.staged === true;
  const original = await gitBlob(root, repositoryPath, staged ? 'head' : 'index');
  const info = await stat(file).catch(() => null);
  let modified = '';
  if (staged && info !== null && info.isFile() && info.size <= MAX_TEXT_BYTES) {
    /* The staged diff compares HEAD against the INDEX. Reading the working
       tree made a half-staged file show unstaged bytes on the right, and a
       per-hunk restore would then write them into the index. */
    modified = await gitBlob(root, repositoryPath, 'index');
  } else if (info !== null && info.isFile() && info.size <= MAX_TEXT_BYTES) {
    modified = await readFile(file, 'utf8').catch(() => '');
  }
  const binary = original.includes('\u0000') || modified.includes('\u0000');
  return {
    path: relativePath,
    staged,
    original,
    modified,
    binary,
    missing: info === null,
    headExists: original !== '' ,
  };
}

/**
 * Read one file's text at an arbitrary revision, tolerating a missing blob.
 *
 * `rev:path` is the only form that works for both `HEAD~1` and a commit hash,
 * and a file that did not exist yet at that revision simply yields ''.
 * @param {string} root - workspace root.
 * @param {string} revision - commit-ish (`HEAD`, `HEAD~2`, a hash).
 * @param {string} repositoryPath - path relative to the repository root.
 * @returns {Promise<string>} blob text, or '' when it did not exist.
 */
async function gitBlobAt(root, revision, repositoryPath) {
  try {
    return await runGit(root, ['show', `${revision}:${repositoryPath}`]);
  } catch {
    return '';
  }
}

/**
 * Read one file's text at a revision, distinguishing "empty" from "absent".
 *
 * `gitBlobAt` folds both into '', which is right for a diff (an empty side
 * renders the same either way) but wrong for a restore: writing '' over a file
 * the revision never contained would silently empty it.
 * @param {string} root - workspace root.
 * @param {string} revision - commit-ish.
 * @param {string} repositoryPath - path relative to the repository root.
 * @returns {Promise<string|null>} the text, or null when that revision has no such path.
 */
async function gitBlobMaybe(root, revision, repositoryPath) {
  try {
    return await runGit(root, ['show', `${revision}:${repositoryPath}`]);
  } catch {
    return null;
  }
}

/**
 * Both sides of one file inside one commit, for IDEA's commit diff preview.
 *
 * A root commit has no parent, so the "before" side is empty rather than an
 * error: `hash^` simply does not resolve there.
 * @param {string} root - workspace root.
 * @param {string} prefix - repository prefix of the workspace root.
 * @param {{hash: string, path: string}} input - commit and workspace-relative path.
 * @returns {Promise<object>} diff payload with `commit` metadata.
 */
/**
 * Diff one workspace file against its own content at a revision.
 *
 * Distinct from {@link gitCommitDiff}: that one shows a change *introduced* by a
 * commit (parent → commit), this one shows how the file differs from that
 * revision right now. IDEA's "Compare with Revision" is the latter.
 * @param {string} root - workspace root.
 * @param {string} prefix - repository prefix of the workspace root.
 * @param {{hash: string, path: string}} input - revision and workspace-relative path.
 * @returns {Promise<object>} diff payload.
 */
async function gitDiffWithRevision(root, prefix, input) {
  const hash = typeof input.hash === 'string' ? input.hash : '';
  const relativePath = typeof input.path === 'string' ? input.path : '';
  if (!/^(?:HEAD~?\d*|[0-9a-f]{4,40})$/u.test(hash)) throw new Error('invalid commit id');
  if (relativePath === '') throw new Error('a path is required');
  const file = resolveInside(root, relativePath);
  const original = await gitBlobMaybe(root, hash, `${prefix}${relativePath}`);
  if (original === null) throw new Error('that revision does not contain this file');
  const info = await stat(file).catch(() => null);
  const modified = info !== null && info.isFile() && info.size <= MAX_TEXT_BYTES
    ? await readFile(file, 'utf8').catch(() => '')
    : '';
  return {
    path: relativePath,
    commit: hash,
    staged: false,
    original,
    modified,
    binary: original.includes('\u0000') || modified.includes('\u0000'),
    missing: info === null,
    headExists: true,
  };
}

async function gitCommitDiff(root, prefix, input) {
  const hash = typeof input.hash === 'string' ? input.hash : '';
  const relativePath = typeof input.path === 'string' ? input.path : '';
  if (!/^(?:HEAD~?\d*|[0-9a-f]{4,40})$/u.test(hash)) throw new Error('invalid commit id');
  if (relativePath === '') throw new Error('a path is required');
  resolveInside(root, relativePath);
  const repositoryPath = `${prefix}${relativePath}`;
  const [original, modified] = await Promise.all([
    gitBlobAt(root, `${hash}^`, repositoryPath),
    gitBlobAt(root, hash, repositoryPath),
  ]);
  const binary = original.includes('\u0000') || modified.includes('\u0000');
  return {
    path: relativePath,
    commit: hash,
    staged: false,
    original,
    modified,
    binary,
    /* The file is gone when the commit deleted it; the editor must not claim otherwise. */
    missing: false,
    headExists: true,
  };
}

/**
 * Diff one workspace file against arbitrary text, for IDEA's "Compare with Clipboard".
 *
 * The clipboard never reaches the host: the browser sends the text it already
 * holds, and only the file's own bytes are read here. That keeps the endpoint
 * from becoming a way to read arbitrary paths the caller did not choose.
 * @param {string} root - workspace root.
 * @param {{path: string, text?: string, label?: string}} input - compare request.
 * @returns {Promise<object>} the two sides plus a label for the diff header.
 */
async function fileCompareText(root, input) {
  const relativePath = typeof input?.path === 'string' ? input.path : '';
  if (relativePath === '') throw new Error('a path is required');
  const file = resolveInside(root, relativePath);
  if (typeof input?.text !== 'string') throw new Error('missing comparison text');
  const info = await stat(file).catch(() => null);
  if (info !== null && !info.isFile()) throw new Error('not a file');
  const current = info === null || info.size > MAX_TEXT_BYTES ? '' : await readFile(file, 'utf8').catch(() => '');
  const text = input.text;
  const binary = current.includes('\u0000') || text.includes('\u0000');
  return {
    path: relativePath,
    label: typeof input?.label === 'string' && input.label !== '' ? input.label : 'clipboard',
    original: text,
    modified: current,
    binary,
    missing: info === null,
    headExists: true,
  };
}

/**
 * Parse `git blame --porcelain` into one row per blamed line.
 *
 * Porcelain repeats only the `<hash> <orig> <final>` header for the second and
 * later lines of the same commit; author/date/summary are emitted once per
 * commit, so metadata is carried forward per hash. Every record ends with a
 * tab-prefixed content line, which is where the walk resumes.
 * @param {string} output - raw blame stdout.
 * @returns {Array<{line: number, hash: string, author: string, date: string, summary: string}>} per-line blame.
 */
function parseBlamePorcelain(output) {
  const rows = [];
  const seen = new Map();
  const lines = typeof output === 'string' ? output.split('\n') : [];
  let index = 0;
  while (index < lines.length) {
    const header = /^([0-9a-f]{40,64}) \d+ (\d+)(?: \d+)?$/u.exec(lines[index]);
    if (header === null) {
      index += 1;
      continue;
    }
    const hash = header[1];
    const line = Number(header[2]);
    index += 1;
    let author;
    let date;
    let summary;
    while (index < lines.length && !lines[index].startsWith('\t')) {
      const text = lines[index];
      index += 1;
      if (text.startsWith('author ')) author = text.slice('author '.length);
      else if (text.startsWith('author-time ')) date = text.slice('author-time '.length);
      else if (text.startsWith('summary ')) summary = text.slice('summary '.length);
    }
    /* Skip the content line itself; it is the terminator, not data. */
    index += 1;
    const known = seen.get(hash);
    const meta = known ?? {
      author: author ?? '',
      date: date === undefined ? '' : new Date(Number(date) * 1000).toISOString(),
      summary: summary ?? '',
    };
    if (known === undefined) seen.set(hash, meta);
    rows.push({ line, hash, author: meta.author, date: meta.date, summary: meta.summary });
  }
  return rows;
}

/**
 * Read per-line attribution for one file, IDEA's Annotate view.
 *
 * Bounded to a window: a 50k-line file would otherwise produce megabytes of
 * porcelain for a tool window that can only show a few dozen rows.
 * @param {string} root - workspace root.
 * @param {{path: string, startLine?: number, endLine?: number}} input - annotate request.
 * @returns {Promise<{path: string, lines: object[], truncated: boolean}>} attribution rows.
 */
async function gitBlame(root, input) {
  const relativePath = typeof input?.path === 'string' ? input.path : '';
  if (relativePath === '') throw new Error('a path is required');
  resolveInside(root, relativePath);
  const start = Number.isSafeInteger(input?.startLine) && input.startLine > 0 ? input.startLine : 1;
  const requestedEnd = Number.isSafeInteger(input?.endLine) && input.endLine >= start ? input.endLine : start + 199;
  const end = Math.min(requestedEnd, start + 199);
  const raw = await runGit(root, ['blame', '--porcelain', '-L', `${start},${end}`, '--', relativePath]).catch(() => '');
  return { path: relativePath, lines: parseBlamePorcelain(raw), truncated: requestedEnd > end };
}

/**
 * Local branch names, as IDEA's graph branch filter lists them.
 *
 * Read separately from the graph walk: after filtering to one branch the
 * decorations no longer mention the others, so the dropdown would lose the
 * very choices the user needs to switch back.
 * @param {string} root - workspace root.
 * @returns {Promise<string[]>} short branch names, HEAD's first.
 */
/**
 * Annotated tag names, so a tag badge can point at its own history.
 *
 * Only annotated tags carry a tagger and thus an "Introduce tag" view; a
 * lightweight tag is just a pointer. The distinction is read from git rather
 * than guessed from the name.
 * The peeled object id (`%(*objectname)`) is the commit an annotated tag points
 * at; lightweight tags have no peel, so the tag object id is the commit.
 * @param {string} root - workspace root.
 * @returns {Promise<Array<{name: string, hash: string}>>} tags with their commits.
 */
async function localTagNames(root) {
  const raw = await runGit(root, [
    'for-each-ref',
    '--sort=refname',
    '--format=%(refname:short)%1f%(*objectname)%1f%(objectname)',
    'refs/tags',
  ]).catch(() => '');
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '')
    .map((line) => {
      const [name = '', peeled = '', direct = ''] = line.split('\u001f');
      return { name, hash: peeled !== '' ? peeled : direct };
    })
    .filter((tag) => tag.name !== '' && /^[0-9a-f]{40}(?:[0-9a-f]{24})?$/u.test(tag.hash));
}

async function localBranchNames(root) {
  const raw = await runGit(root, ['for-each-ref', '--sort=-committerdate', '--format=%(refname:short)', 'refs/heads']).catch(() => '');
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '');
}

/**
 * Read a bounded commit graph: topology plus branch/tag decorations.
 *
 * Modelled on the same `log --format` idea better-sidebar uses: separate fields
 * with NUL so subjects containing tabs or pipes survive, ask git for both the
 * parent pointers (needed to draw lanes) and the refs (needed for badges).
 * The walk is bounded so a huge repository cannot block the tool window.
 *
 * `branch` narrows the walk to one local branch (IDEA's graph branch picker).
 * `at` is the commit a ref badge points at: a tag's "Introduce tag" view in
 * IDEA is simply that commit and its ancestors, so the same bounded walk is
 * reused instead of a second command.
 * Names are checked against the repository's own branch/tag lists before they
 * reach the command line, so they can never be read as git options.
 * @param {string} root - workspace root.
 * @param {number|{limit?: number, branch?: string, at?: string}} input - limit, or options.
 * @returns {Promise<{entries: object[], branches: string[], tags: string[], branchList: string[], tagList: Array<{name: string, hash: string}>, head: string|null, branch: string|null, at: string|null}>} graph payload.
 */
async function gitGraph(root, input = 60) {
  const options = typeof input === 'number' ? { limit: input } : (input ?? {});
  const count = Number.isSafeInteger(options.limit) ? Math.max(1, Math.min(200, options.limit)) : 60;
  const branchList = await localBranchNames(root);
  const tagList = await localTagNames(root);
  const wanted = typeof options.branch === 'string' ? options.branch.trim() : '';
  if (wanted !== '' && !branchList.includes(wanted)) throw new Error(`unknown branch: ${wanted}`);
  const branch = wanted === '' ? null : wanted;
  /* A revision must be a full 40/64-hex object id: anything else (a ref name,
     a range, `--upload-pack=…`) stays out of the argument list. */
  const wantedAt = typeof options.at === 'string' ? options.at.trim() : '';
  if (wantedAt !== '' && !/^[0-9a-f]{40}(?:[0-9a-f]{24})?$/u.test(wantedAt)) throw new Error(`bad revision: ${wantedAt}`);
  const at = wantedAt === '' ? null : wantedAt;
  const head = (await runGit(root, ['rev-parse', '--verify', '--quiet', 'HEAD']).catch(() => '')).trim();
  const format = '%H%x1f%P%x1f%an%x1f%aI%x1f%s%x1f%D%x1e';
  const raw = await runGit(root, [
    'log',
    ...(at !== null ? [at] : branch === null ? ['--all'] : [branch]),
    '--topo-order',
    '--decorate=full',
    `--max-count=${count}`,
    `--pretty=format:${format}`,
  ]).catch(() => '');
  const entries = raw
    .split('\u001e')
    .map((record) => record.replace(/^\n/u, ''))
    .filter((record) => record.trim() !== '')
    .map((record) => {
      const [hash = '', parents = '', author = '', date = '', subject = '', refs = ''] = record.split('\u001f');
      return {
        hash,
        parents: parents === '' ? [] : parents.split(' ').filter((parent) => parent !== ''),
        author,
        date,
        subject,
        refs: refs
          .split(',')
          .map((ref) => ref.trim())
          .filter((ref) => ref !== '')
          /* `--decorate=full` prefixes refs; strip the plumbing so rows read like IDEA. */
          .map((ref) => ref
            .replace(/^HEAD -> /u, '')
            /* Tags keep their `tag:` prefix but lose the plumbing path. */
            .replace(/^tag: refs\/tags\//u, 'tag: ')
            .replace(/^refs\/tags\//u, 'tag: ')
            .replace(/^refs\/heads\//u, '')
            .replace(/^refs\/remotes\//u, '')),
      };
    });
  const branches = [...new Set(entries.flatMap((entry) => entry.refs).filter((ref) => !ref.startsWith('tag: ')))].sort();
  const tags = [...new Set(entries.flatMap((entry) => entry.refs).filter((ref) => ref.startsWith('tag: ')))].sort();
  return { entries, branches, tags, branchList, tagList, head: head === '' ? null : head, branch, at };
}

/**
 * Commits that touched one path, newest first — IDEA's "Show History" for a file.
 *
 * `--follow` is what makes a renamed file keep its history; without it the log
 * stops at the rename and the panel looks like the file appeared from nowhere.
 * @param {string} root - workspace root.
 * @param {string} relativePath - workspace-relative path.
 * @param {number} limit - maximum number of commits.
 * @returns {Promise<{path: string, commits: object[]}>} history entries.
 */
async function gitFileHistory(root, relativePath, limit = 60) {
  if (typeof relativePath !== 'string' || relativePath === '') throw new Error('a path is required');
  resolveInside(root, relativePath);
  const prefix = (await runGit(root, ['rev-parse', '--show-prefix']).catch(() => '')).trim();
  const count = Number.isSafeInteger(limit) ? Math.max(1, Math.min(200, limit)) : 60;
  const raw = await runGit(root, [
    'log',
    '--follow',
    `-n${count}`,
    '--pretty=format:%H%x1f%an%x1f%aI%x1f%s%x1e',
    '--',
    `${prefix}${relativePath}`,
  ]).catch(() => '');
  const commits = raw
    .split('\u001e')
    .map((record) => record.trim())
    .filter((record) => record !== '')
    .map((record) => {
      const [hash = '', author = '', date = '', subject = ''] = record.split('\u001f');
      return { hash, author, date, subject };
    });
  return { path: relativePath, commits };
}

/**
 * Read branch identity plus upstream divergence for the status bar.
/**
 * Read branch identity plus upstream divergence for the status bar.
 * @param {string} root - workspace root.
 * @returns {Promise<{branch: string, upstream: string, ahead: number, behind: number, detached: boolean}>} branch facts.
 */
async function gitBranchInfo(root) {
  let upstream = '';
  let ahead = 0;
  let behind = 0;
  let detached = false;
  try {
    upstream = (await runGit(root, ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}'])).trim();
  } catch {
    upstream = '';
  }
  if (upstream !== '') {
    try {
      const counts = (await runGit(root, ['rev-list', '--left-right', '--count', `${upstream}...HEAD`])).trim();
      const [behindText, aheadText] = counts.split(/\s+/);
      behind = Number(behindText) || 0;
      ahead = Number(aheadText) || 0;
    } catch {
      ahead = 0;
      behind = 0;
    }
  }
  const branch = (await runGit(root, ['rev-parse', '--abbrev-ref', 'HEAD']).catch(() => '')).trim();
  detached = branch === 'HEAD';
  return { upstream, ahead, behind, detached };
}

/**
 * List local branches plus the current one, newest-first by commit date.
 *
 * Only local branches are listed: a checkout of a remote-tracking name is
 * ambiguous (detached HEAD vs new local branch), so IDEA's branch popup shows
 * local refs and lets tracking be set up separately.
 * @param {string} root - workspace root.
 * @returns {Promise<{branch: string, branches: string[]}>} current branch and the local list.
 */
/**
 * Detect a repository that is mid-operation (merge, rebase, cherry-pick, revert).
 *
 * Committing during one of these is legal but changes what the commit means, so
 * the panel needs to know before it offers "Commit". The marker files live in
 * the git dir; `rev-parse --git-path` resolves them for worktrees too.
 * @param {string} root - workspace root.
 * @returns {Promise<{operation: string|null}>} the in-progress operation, if any.
 */
async function gitOperationState(root) {
  const markers = [
    ['MERGE_HEAD', 'merge'],
    ['rebase-merge', 'rebase'],
    ['rebase-apply', 'rebase'],
    ['CHERRY_PICK_HEAD', 'cherry-pick'],
    ['REVERT_HEAD', 'revert'],
  ];
  for (const [marker, operation] of markers) {
    const path = (await runGit(root, ['rev-parse', '--git-path', marker]).catch(() => '')).trim();
    if (path === '') continue;
    const absolute = resolve(root, path);
    const info = await stat(absolute).catch(() => null);
    if (info !== null) return { operation };
  }
  return { operation: null };
}

async function gitBranches(root) {
  const raw = await runGit(root, ['for-each-ref', '--sort=-committerdate', '--format=%(refname:short)', 'refs/heads']).catch(() => '');
  const branches = raw
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line !== '');
  const current = (await runGit(root, ['rev-parse', '--abbrev-ref', 'HEAD']).catch(() => '')).trim();
  return { branch: current, branches };
}

/**
 * Switch to an existing local branch (IDEA's branch popup "Checkout").
 *
 * The name is validated against the repository's own branch list rather than
 * merely sanitized: git arguments reach the command line, so an unverified
 * value could be read as an option.
 * @param {string} root - workspace root.
 * @param {string} name - local branch to check out.
 * @returns {Promise<object>} refreshed git status.
 */
async function gitCheckout(root, name) {
  const wanted = typeof name === 'string' ? name.trim() : '';
  if (wanted === '') throw new Error('a branch name is required');
  const { branches } = await gitBranches(root);
  if (!branches.includes(wanted)) throw new Error(`unknown branch: ${wanted}`);
  await runGit(root, ['checkout', wanted]);
  return gitStatus(root);
}

/**
 * Check out one commit (IDEA's "Checkout Revision").
 *
 * `gitCheckout` only accepts a local branch name, so walking the log and landing on
 * a commit had no entry point. The hash is validated against `git rev-parse` — a
 * bare `--orphan` would otherwise be read as an option — and the result is detached
 * HEAD, which is what IDEA shows after checking out a revision.
 * @param {string} root - workspace root.
 * @param {string} hash - commit to check out.
 * @returns {Promise<object>} refreshed git status plus the detached flag.
 */
async function gitCheckoutRevision(root, hash) {
  const wanted = typeof hash === 'string' ? hash.trim() : '';
  if (wanted === '' || wanted.startsWith('-')) throw new Error('a commit hash is required');
  let resolved;
  try {
    resolved = (await runGit(root, ['rev-parse', '--verify', `${wanted}^{commit}`])).trim();
  } catch {
    throw new Error(`no such commit: ${wanted}`);
  }
  if (resolved === '') throw new Error(`no such commit: ${wanted}`);
  await runGit(root, ['checkout', '--detach', resolved]);
  const status = await gitStatus(root);
  return { ...status, detached: true, hash: resolved };
}

/**
 * Create a local branch and optionally check it out (IDEA's "New Branch").
 *
 * The name is validated here, not by git: git's own error for a bad ref is a
 * paragraph, and a leading `-` would otherwise be read as an option. Space is
 * rejected because a branch name reaches `git checkout <name>` unquoted in the
 * argv array, where it is legal but reads as two words in every UI that shows it.
 * @param {string} root - workspace root.
 * @param {{name: string, checkout?: boolean}} input - branch request.
 * @returns {Promise<object>} refreshed status plus the branch list.
 */
async function gitCreateBranch(root, input) {
  const wanted = typeof input?.name === 'string' ? input.name.trim() : '';
  if (wanted === '') throw new Error('a branch name is required');
  if (wanted.startsWith('-')) throw new Error('a branch name may not start with "-"');
  if (/\s/u.test(wanted)) throw new Error('a branch name may not contain spaces');
  const existing = await gitBranches(root);
  if (existing.branches.includes(wanted)) throw new Error(`branch ${wanted} already exists`);
  /* `checkout -b` forks at HEAD, which is what IDEA's New Branch does. */
  await runGit(root, input?.checkout === false ? ['branch', wanted] : ['checkout', '-b', wanted]);
  /* A status alone carries no branch list, and the popup must show the new name. */
  return { ...(await gitStatus(root)), ...(await gitBranches(root)), created: wanted, checkedOut: input?.checkout !== false };
}

/**
 * Tag one commit (IDEA's "New Tag" on a log row).
 *
 * A tag name is validated here for the same reason a branch name is: it reaches
 * git's argv, and git's own complaint about a bad ref is several lines long. The
 * revision comes from the log row, so a full OID is expected; `requireRevision`
 * already accepts the short and `HEAD~n` forms the UI can produce.
 * @param {string} root - workspace root.
 * @param {{name: string, hash?: string}} input - tag request.
 * @returns {Promise<object>} refreshed status plus the tag list.
 */
async function gitCreateTag(root, input) {
  const wanted = typeof input?.name === 'string' ? input.name.trim() : '';
  if (wanted === '') throw new Error('a tag name is required');
  if (wanted.startsWith('-')) throw new Error('a tag name may not start with "-"');
  if (/\s/u.test(wanted)) throw new Error('a tag name may not contain spaces');
  const revision = typeof input?.hash === 'string' && input.hash.trim() !== '' ? requireRevision(input.hash.trim()) : 'HEAD';
  const existing = (await localTagNames(root).catch(() => [])).map((entry) => entry.name);
  if (existing.includes(wanted)) throw new Error(`tag ${wanted} already exists`);
  /* A lightweight tag: IDEA's New Tag defaults to one and offers no annotation UI. */
  await runGit(root, ['tag', wanted, revision]);
  /* The graph's badge list carries the peeled commit, so reuse it rather than a
     bare name list — the caller repaints the graph from this same response. */
  const tagList = await localTagNames(root).catch(() => []);
  return { ...(await gitStatus(root)), tag: wanted, tagList };
}

/**
 * Read the last commit so `Amend` can prefill IDEA's message box.
 * @param {string} root - workspace root.
 * @returns {Promise<{subject: string, body: string, hash: string}|null>} last commit, or null for an unborn HEAD.
 */
async function gitLastCommit(root) {
  try {
    const raw = await runGit(root, ['log', '-1', '--pretty=format:%H%x1f%s%x1f%b']);
    if (raw.trim() === '') return null;
    const [hash = '', subject = '', body = ''] = raw.split('\u001f');
    return { hash, subject, body: body.trim() };
  } catch {
    return null;
  }
}

/**
 * Build one JSON response with the plugin's envelope.
 * @param {object} value - success value.
 * @returns {Response} JSON response.
 */
function ok(value) {
  return Response.json({ ok: true, value }, { headers: { 'cache-control': 'no-store' } });
}

/**
 * Build one JSON error response.
 * @param {string} code - stable error code.
 * @param {string} message - human-readable message.
 * @returns {Response} JSON response.
 */
function fail(code, message) {
  return Response.json({ ok: false, error: { code, message } }, { headers: { 'cache-control': 'no-store' } });
}

/**
 * Walk the shipped Monaco tree once so each file can own one exact Fetch route.
 * @param {string} directory - absolute directory to walk.
 * @param {string} prefix - relative path accumulated so far.
 * @returns {string[]} relative file paths.
 */
function walkMonaco(directory, prefix = '') {
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const relativePath = prefix === '' ? entry.name : `${prefix}/${entry.name}`;
    if (entry.isDirectory()) files.push(...walkMonaco(join(directory, entry.name), relativePath));
    else if (entry.isFile()) files.push(relativePath);
  }
  return files;
}

/** Every Monaco file exposed by the exact Fetch routes; empty when not installed. */
const MONACO_FILES = MONACO_ROOT === null ? [] : walkMonaco(MONACO_ROOT);

/**
 * Serve one shipped asset below a fixed root, refusing any path that escapes it.
 * @param {string} root - absolute asset root ending with a separator.
 * @param {string} relativePath - path below the root.
 * @param {Request} request - incoming asset request.
 * @returns {Promise<Response>} asset response.
 */
async function assetFileResponse(root, relativePath, request) {
  const file = resolve(root, relativePath);
  const prefix = root.endsWith(sep) ? root : `${root}${sep}`;
  if (fullPathEscapes(file, root, prefix)) return new Response('forbidden', { status: 403 });
  const info = await stat(file).catch(() => null);
  if (info === null || !info.isFile()) return new Response('not found', { status: 404 });
  const mediaType = ASSET_MEDIA_TYPES.get(extname(file).toLowerCase()) ?? 'application/octet-stream';
  const headers = {
    'content-type': mediaType,
    'cache-control': 'public, max-age=3600',
    'x-content-type-options': 'nosniff',
  };
  if (request.method === 'HEAD') return new Response(null, { status: 200, headers });
  return new Response(createReadStream(file), { status: 200, headers });
}

/**
 * Whether a resolved asset path leaves its root.
 * @param {string} file - resolved absolute path.
 * @param {string} root - root directory without a trailing separator.
 * @param {string} prefix - root directory guaranteed to end with a separator.
 * @returns {boolean} true when the path must be refused.
 */
function fullPathEscapes(file, root, prefix) {
  return file !== root && !file.startsWith(prefix);
}

/**
 * Source modules that BOTH halves import (terminal link grammar), served as ESM.
 *
 * They live in `lib/`, beside the code that uses them, rather than in a vendored
 * `assets/` tree: this is project source, not a third-party artifact. The URL
 * stays `/api/dsh-editor/shared/*` so the browser half keeps one stable address.
 */
const SHARED_ROOT = fileURLToPath(new URL('./', import.meta.url));
/** Exact files under `lib` exposed by the shared-module bridge. */
const SHARED_FILES = ['link-parser.mjs'];

/**
 * The xterm.js runtime, read from the installed packages.
 *
 * The browser imports these by URL, so each one keeps the name the client
 * already asks for while its source is the package's own ESM build:
 * `xterm.mjs` -> `@xterm/xterm/lib/xterm.mjs`, `addon-fit.mjs` ->
 * `@xterm/addon-fit/lib/addon-fit.mjs`, `xterm.css` -> `.../css/xterm.css`.
 */
const XTERM_ASSETS = [
  { name: 'xterm.mjs', file: packagePath('@xterm/xterm/lib/xterm.mjs') },
  { name: 'addon-fit.mjs', file: packagePath('@xterm/addon-fit/lib/addon-fit.mjs') },
  { name: 'xterm.css', file: packagePath('@xterm/xterm/css/xterm.css') },
].filter((asset) => asset.file !== null);

/**
 * Directories the watcher skips.
 *
 * Only git's metadata: the Project tree hides exactly that one (see
 * `IGNORED_DIRECTORIES`), and nothing can be expanded under it. This list used
 * to be `WALK_IGNORED`, which is a bound for whole-workspace scans — but the
 * tree SHOWS and expands `node_modules` / `dist`, so skipping them here meant
 * their contents could never follow the disk: a `pnpm install` left
 * `node_modules` showing packages that no longer existed until some unrelated
 * change in a watched directory happened to refresh it.
 */
const WATCH_IGNORED = IGNORED_DIRECTORIES;

/**
 * Above this many watched directories, watching stops being worth it.
 *
 * One `fs.watch` per directory is cheap on macOS but not free, and a monorepo
 * can carry tens of thousands. The root listing is polled anyway, so a huge
 * tree still notices structural changes; it just loses per-directory fidelity.
 */
const MAX_WATCHED_DIRECTORIES = 2000;

/**
 * Report real filesystem changes for one workspace over Server-Sent Events.
 *
 * The tree used to follow the disk by polling a git signature every 4 seconds and
 * then re-reading the root plus every expanded directory. That is both slow to
 * notice a change (up to 4s) and coarse (one change re-reads everything), and the
 * poll does not fire at all outside a git repository. A watcher reports the
 * directories that actually changed, so the client re-reads just those.
 *
 * Events are debounced and coalesced per directory: a `git checkout` touching
 * hundreds of files yields one `{type: 'change', dirs: [...]}` frame.
 */
class WorkspaceWatcher {
  /**
   * @param {string} root - absolute workspace root.
   * @param {(event: object) => void} emit - sink for coalesced change frames.
   */
  constructor(root, emit) {
    this.root = root;
    this.emit = emit;
    /** Watchers keyed by absolute directory path. */
    this.watchers = new Map();
    /** Workspace-relative directories with pending changes. */
    this.pending = new Set();
    this.timer = null;
    this.closed = false;
  }

  /**
   * Absolute path for one workspace-relative directory.
   * @param {string} relativePath - workspace-relative directory ('' for the root).
   * @returns {string} absolute path.
   */
  absolute(relativePath) {
    return relativePath === '' ? this.root : join(this.root, ...relativePath.split('/'));
  }

  /** Start watching the root; failures are reported instead of thrown. */
  start() {
    try {
      this.watchDirectory('');
    } catch (error) {
      this.emit({ type: 'error', message: error instanceof Error ? error.message : String(error) });
      return;
    }
    /* Walk the existing tree NOW rather than waiting for an event: otherwise the
       first change in an untouched subdirectory has no watcher to report it. */
    void this.syncDirectory('').catch(() => {
      /* a workspace that vanished mid-walk simply has nothing left to watch */
    });
    void this.watchGitIndex();
    this.emit({ type: 'ready', root: this.root });
  }

  /**
   * Watch `.git/index` because it is normally the ONLY change from staging.
   *
   * `git add` / `git reset` rewrite the index while every working file keeps
   * its mtime, and the tree walk deliberately skips `.git`. Watching the index
   * file turns those IDE/external stage actions into the same debounced frame a
   * working-tree edit produces, instead of waiting for the slow signature poll.
   * @returns {Promise<void>} resolves once the index watcher is attached.
   */
  async watchGitIndex() {
    if (this.closed) return;
    const relativePath = (await runGit(this.root, ['rev-parse', '--git-path', 'index']).catch(() => '')).trim();
    if (relativePath === '') return;
    const absolute = resolve(this.root, relativePath);
    if (this.gitIndexWatcher !== undefined) this.gitIndexWatcher.close();
    let watcher;
    try {
      watcher = watch(absolute, { persistent: false }, () => this.record(''));
    } catch {
      return;
    }
    this.gitIndexWatcher = watcher;
    watcher.on('error', () => {
      if (this.gitIndexWatcher === watcher) {
        watcher.close();
        this.gitIndexWatcher = undefined;
      }
    });
  }

  /**
   * Watch one directory and, recursively, its subdirectories.
   *
   * macOS reports a plain file OVERWRITE as `rename` (the writer replaces the
   * inode), so the event type cannot decide whether the listing changed: the
   * client re-reads the reported directories either way, and a no-op re-read
   * costs one readdir.
   * @param {string} relativePath - workspace-relative directory path.
   * @returns {void}
   */
  watchDirectory(relativePath) {
    if (this.closed) return;
    const absolute = this.absolute(relativePath);
    if (this.watchers.has(absolute)) return;
    let watcher;
    try {
      watcher = watch(absolute, { persistent: false }, () => this.record(relativePath));
    } catch {
      /* a directory that vanished between listing and watching has no entries */
      return;
    }
    watcher.on('error', () => {
      if (this.watchers.get(absolute) === watcher) {
        watcher.close();
        this.watchers.delete(absolute);
      }
    });
    this.watchers.set(absolute, watcher);
    /* Descendants are the CALLER's job: `syncDirectory` walks the subtree after
       creating each watcher, so a background rescan here would double the walk
       (and could interleave with the caller's). */
  }

  /**
   * Start watchers for subdirectories that appeared, drop watchers that vanished.
   *
   * A watcher per directory cannot see a NEW subdirectory by itself, so each
   * directory that reported a change is re-listed once. The scan is bounded to
   * the directories in `dirs`, so a large repository costs one readdir per
   * directory that actually changed.
   * @param {string[]} dirs - workspace-relative directories that changed.
   * @returns {Promise<void>} resolves once the watcher set is up to date.
   */
  async syncWatches(dirs) {
    for (const dir of dirs) {
      if (this.closed) return;
      await this.syncDirectory(dir);
    }
  }

  /**
   * Watch one directory and EVERY descendant, awaiting the whole walk.
   *
   * This used to add the direct children and let each `watchDirectory` scan its
   * own subtree in the background (`void this.syncWatches`). A directory created
   * and immediately removed — `rm -rf node_modules/pkg`, a build directory
   * recreated by a script — could disappear between the two passes, so nothing
   * ever watched it and the deletion produced no frame. Awaiting the walk makes
   * the watcher set complete by the time the caller resumes.
   * @param {string} dir - workspace-relative directory to (re)scan.
   * @returns {Promise<void>} resolves once this subtree is up to date.
   */
  async syncDirectory(dir) {
    if (this.closed) return;
    const absolute = this.absolute(dir);
    const rows = await readdir(absolute, { withFileTypes: true }).catch(() => null);
    if (rows === null) {
      const stale = this.watchers.get(absolute);
      stale?.close();
      this.watchers.delete(absolute);
      return;
    }
    const live = new Set(rows.filter((row) => row.isDirectory() && !WATCH_IGNORED.has(row.name)).map((row) => row.name));
    /* `dirname`/`basename` of a POSIX-style relative path are plain string ops. */
    for (const known of [...this.watchers.keys()]) {
      if (dirname(known) !== absolute) continue;
      if (live.has(basename(known))) continue;
      const stale = this.watchers.get(known);
      stale?.close();
      this.watchers.delete(known);
    }
    for (const name of live) {
      if (this.closed) return;
      if (this.watchers.size >= MAX_WATCHED_DIRECTORIES) return;
      const child = dir === '' ? name : `${dir}/${name}`;
      this.watchDirectory(child);
      /* Recurse AFTER the watcher exists, so a change inside cannot be missed
         while the deeper scan runs. */
      await this.syncDirectory(child);
    }
  }

  /**
   * Record one filesystem event and schedule the coalesced emit.
   * @param {string} directory - workspace-relative directory that changed.
   * @returns {void}
   */
  record(directory) {
    if (this.closed) return;
    this.pending.add(directory);
    if (this.timer !== null) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      if (this.closed) return;
      const dirs = [...this.pending];
      this.pending.clear();
      /* Emit first: the browser can start re-reading while the walk runs, and a
         slowly-added watcher must not delay a frame the tree is waiting for. */
      void this.syncWatches(dirs);
      this.emit({ type: 'change', dirs });
    }, 120);
    /* Do not keep the host process alive only for this timer. */
    this.timer.unref?.();
  }

  /** Stop every watcher and drop pending work. */
  close() {
    this.closed = true;
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    for (const watcher of this.watchers.values()) watcher.close();
    this.watchers.clear();
    this.gitIndexWatcher?.close();
    this.gitIndexWatcher = undefined;
    this.pending.clear();
  }
}

/**
 * Follow one workspace's filesystem changes as Server-Sent Events.
 * @param {string} root - absolute workspace root.
 * @param {AbortSignal} signal - request lifetime.
 * @returns {Response} event stream response.
 */
function workspaceWatchResponse(root, signal) {
  let watcher = null;
  const body = new ReadableStream({
    start(controller) {
      const send = (event) => {
        try {
          controller.enqueue(encodeSse(event));
        } catch {
          watcher?.close();
        }
      };
      watcher = new WorkspaceWatcher(root, send);
      watcher.start();
      signal.addEventListener(
        'abort',
        () => {
          watcher?.close();
          try {
            controller.close();
          } catch {
            /* already closed */
          }
        },
        { once: true },
      );
    },
    cancel() {
      watcher?.close();
    },
  });
  return new Response(body, {
    status: 200,
    headers: {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-store',
      'x-accel-buffering': 'no',
    },
  });
}

/**
 * @param {import('@deepseek-ai/cordis').Context} ctx - owning plugin context.
 */
export function apply(ctx) {
  ctx.inject(['connection', 'sessions', 'workingDirectory'], (scope) => {
    const connection = scope.get('connection');
    const sessions = scope.get('sessions');
    const workingDirectory = scope.get('workingDirectory');
    const register = connection.fetch.register.bind(connection.fetch);

    ctx.effect(() => {
      const disposers = MONACO_FILES.map((relativePath) =>
        register({
          path: `/api/dsh-editor/monaco/vs/${relativePath}`,
          methods: ['GET', 'HEAD'],
          requestBody: 'buffered',
          fetch: (request) => assetFileResponse(MONACO_ROOT, relativePath, request),
        }),
      );
      return () => {
        for (const dispose of disposers) dispose();
      };
    }, 'dsh-editor: Monaco asset bridge');

    ctx.effect(() => {
      const disposers = XTERM_ASSETS.map((asset) =>
        register({
          path: `/api/dsh-editor/xterm/${asset.name}`,
          methods: ['GET', 'HEAD'],
          requestBody: 'buffered',
          /* Each URL maps to one package file, which is what makes a single
             `fetch` route possible for three differently-rooted assets. */
          fetch: (request) => assetFileResponse(dirname(asset.file), basename(asset.file), request),
        }),
      );
      return () => {
        for (const dispose of disposers) dispose();
      };
    }, 'dsh-editor: xterm asset bridge');

    ctx.effect(() => {
      const disposers = SHARED_FILES.map((fileName) =>
        register({
          path: `/api/dsh-editor/shared/${fileName}`,
          methods: ['GET', 'HEAD'],
          requestBody: 'buffered',
          fetch: (request) => assetFileResponse(SHARED_ROOT, fileName, request),
        }),
      );
      return () => {
        for (const dispose of disposers) dispose();
      };
    }, 'dsh-editor: shared module bridge');

    ctx.effect(
      () =>
        register({
          path: '/api/dsh-editor/fs',
          methods: ['POST'],
          requestBody: 'buffered',
          fetch: async (request) => {
            let body;
            try {
              body = await request.json();
            } catch {
              return fail('dsh-editor/bad-request', 'body is not JSON');
            }
            const sessionId = typeof body?.sessionId === 'string' ? body.sessionId : '';
            const operation = typeof body?.op === 'string' ? body.op : '';
            const relativePath = typeof body?.path === 'string' ? body.path : '';
            if (sessionId === '') return fail('dsh-editor/bad-request', 'missing sessionId');
            let root;
            try {
              root = workspaceRoot(sessions, workingDirectory, sessionId);
            } catch (error) {
              return fail('dsh-editor/no-workspace', error instanceof Error ? error.message : String(error));
            }
            try {
              switch (operation) {
                case 'list':
                  return ok({
                    ...(await listDirectory(root, relativePath, {
                      showHidden: body?.showHidden === true,
                      sort: typeof body?.sort === 'string' ? body.sort : 'name',
                    })),
                    root,
                    home: process.env.HOME ?? '',
                  });
                case 'read':
                  return ok(await readTextFile(root, relativePath));
                case 'files':
                  return ok(await listWorkspaceFiles(root));
                case 'directories':
                  /* IDEA's Move-to dialog lists every directory so a file can be
                     moved without dragging it through a collapsed tree. */
                  return ok(await listWorkspaceDirectories(root));
                case 'exists':
                  return ok(await describePaths(root, body?.paths));
                case 'write': {
                  if (typeof body?.content !== 'string') return fail('dsh-editor/bad-request', 'missing content');
                  return ok(
                    await writeTextFileGuarded(root, relativePath, body.content, body?.mtime, body?.force === true, body?.create === true),
                  );
                }
                case 'create': {
                  const kind = body?.kind === 'directory' ? 'directory' : 'file';
                  return ok(await createEntry(root, relativePath, kind));
                }
                case 'rename':
                  return ok(await renameEntry(root, relativePath, typeof body?.to === 'string' ? body.to : ''));
                case 'delete':
                  return ok(await deleteEntry(root, relativePath));
                case 'reveal':
                  return ok(await revealInFileManager(root, relativePath, { absolute: body?.absolute === true }));
                default:
                  return fail('dsh-editor/bad-request', `unknown operation "${operation}"`);
              }
            } catch (error) {
              if (error?.code === 'dsh-editor/conflict') {
                return Response.json(
                  { ok: false, error: { code: 'dsh-editor/conflict', message: error.message, mtime: error.currentMtime } },
                  { headers: { 'cache-control': 'no-store' } },
                );
              }
              return fail('dsh-editor/fs', error instanceof Error ? error.message : String(error));
            }
          },
        }),
      'dsh-editor: workspace file API',
    );

    ctx.effect(
      () =>
        register({
          path: '/api/dsh-editor/git',
          methods: ['POST'],
          requestBody: 'buffered',
          fetch: async (request) => {
            let body;
            try {
              body = await request.json();
            } catch {
              return fail('dsh-editor/bad-request', 'body is not JSON');
            }
            const sessionId = typeof body?.sessionId === 'string' ? body.sessionId : '';
            const operation = typeof body?.op === 'string' ? body.op : '';
            if (sessionId === '') return fail('dsh-editor/bad-request', 'missing sessionId');
            let root;
            try {
              root = workspaceRoot(sessions, workingDirectory, sessionId);
            } catch (error) {
              return fail('dsh-editor/no-workspace', error instanceof Error ? error.message : String(error));
            }
            try {
              switch (operation) {
                case 'status':
                  return ok(await gitStatus(root));
                case 'stage':
                  return ok(await gitStage(root, body));
                case 'diff': {
                  const current = await gitStatus(root);
                  return ok(await gitDiff(root, current.prefix, body));
                }
                case 'commitDiff': {
                  const current = await gitStatus(root);
                  return ok(await gitCommitDiff(root, current.prefix, body));
                }
                case 'diffWithRevision': {
                  const current = await gitStatus(root);
                  return ok(await gitDiffWithRevision(root, current.prefix, body));
                }
                case 'applyChunk': {
                  const current = await gitStatus(root);
                  return ok(await gitApplyChunk(root, current.prefix, body));
                }
                case 'fileHistory':
                  return ok(await gitFileHistory(root, String(body?.path ?? ''), body?.limit));
                case 'branches':
                  return ok(await gitBranches(root));
                case 'checkout':
                  return ok(await gitCheckout(root, String(body?.branch ?? '')));
                case 'checkoutRevision':
                  /* IDEA's "Checkout Revision": lands on the commit, detached. */
                  return ok(await gitCheckoutRevision(root, String(body?.hash ?? '')));
                case 'createBranch':
                  return ok(await gitCreateBranch(root, body));
                case 'createTag':
                  return ok(await gitCreateTag(root, body));
                case 'cherryPick':
                  return ok(await gitCherryPick(root, String(body?.hash ?? '')));
                case 'revert':
                  return ok(await gitRevert(root, String(body?.hash ?? '')));
                case 'restoreFile':
                  return ok(await gitRestoreFile(root, body));
                case 'stash':
                  return ok(await gitStash(root, body));
                case 'shelve':
                  return ok(await gitShelve(root, body));
                case 'push':
                  return ok(await gitPush(root));
                case 'fetch':
                  return ok(await gitFetch(root));
                case 'pull':
                  return ok(await gitPull(root));
                case 'compareText':
                  return ok(await fileCompareText(root, body));
                case 'inspect':
                  return ok(await gitInspect(root, body?.paths));
                case 'rollback':
                  /* `staged` picks which discard: index-only vs working tree. */
                  return ok(await gitRollback(root, body));
                case 'ignore':
                  return ok(await gitIgnore(root, body?.paths));
                case 'resolve':
                  return ok(await gitResolveConflict(root, body));
                case 'show':
                  return ok(await gitShowCommit(root, String(body?.hash ?? '')));
                case 'log':
                  return ok({ commits: await gitLog(root, body?.limit, body?.skip, body?.author) });
                case 'graph':
                  /* One object: the graph takes a limit and an optional branch. */
                  return ok(await gitGraph(root, { limit: body?.limit, branch: body?.branch, at: body?.at }));
                case 'blame':
                  return ok(await gitBlame(root, body));
                case 'signature':
                  return ok(await gitSignature(root));
                case 'commit':
                  return ok(await gitCommit(root, body));
                default:
                  return fail('dsh-editor/bad-request', `unknown git operation "${operation}"`);
              }
            } catch (error) {
              return fail('dsh-editor/git', describeGitError(error));
            }
          },
        }),
      'dsh-editor: git API',
    );

    const terminals = new TerminalHub({ ctx: scope, subprocess: scope.get('subprocess') });

    ctx.effect(
      () =>
        register({
          path: '/api/dsh-editor/terminal',
          methods: ['POST'],
          requestBody: 'buffered',
          fetch: async (request) => {
            let body;
            try {
              body = await request.json();
            } catch {
              return fail('dsh-editor/bad-request', 'body is not JSON');
            }
            const sessionId = typeof body?.sessionId === 'string' ? body.sessionId : '';
            const operation = typeof body?.op === 'string' ? body.op : '';
            if (sessionId === '') return fail('dsh-editor/bad-request', 'missing sessionId');
            let root;
            try {
              root = workspaceRoot(sessions, workingDirectory, sessionId);
            } catch (error) {
              return fail('dsh-editor/no-workspace', error instanceof Error ? error.message : String(error));
            }
            try {
              switch (operation) {
                case 'list':
                  return ok({ available: terminals.available(), terminals: terminals.list(sessionId) });
                case 'shells':
                  return ok({ shells: await terminals.shells() });
                case 'create': {
                  /* "Open in Terminal" starts the shell inside a subdirectory of the workspace. */
                  const startPath = typeof body?.startPath === 'string' ? body.startPath : '';
                  let cwd = root;
                  if (startPath !== '') {
                    cwd = resolveInside(root, startPath);
                    const info = await stat(cwd).catch(() => null);
                    if (info === null || !info.isDirectory()) cwd = root;
                  }
                  return ok({
                    available: terminals.available(),
                    terminal: await terminals.create({
                      sessionId,
                      cwd,
                      cols: body?.cols,
                      rows: body?.rows,
                      shellPath: typeof body?.shellPath === 'string' ? body.shellPath : undefined,
                    }),
                  });
                }
                case 'write':
                  await terminals.write(sessionId, String(body?.id ?? ''), body?.data);
                  return ok({ written: true });
                case 'resize':
                  await terminals.resize(sessionId, String(body?.id ?? ''), body?.cols, body?.rows);
                  return ok({ resized: true });
                case 'rename':
                  return ok({ terminal: terminals.rename(sessionId, String(body?.id ?? ''), body?.title, body?.auto === true) });
                case 'reorder':
                  return ok({ terminals: terminals.reorder(sessionId, body?.ids) });
                case 'close':
                  return ok(await terminals.close(sessionId, String(body?.id ?? '')));
                default:
                  return fail('dsh-editor/bad-request', `unknown terminal operation "${operation}"`);
              }
            } catch (error) {
              return fail('dsh-editor/terminal', error instanceof Error ? error.message : String(error));
            }
          },
        }),
      'dsh-editor: terminal API',
    );

    ctx.effect(
      () =>
        register({
          path: '/api/dsh-editor/terminal/stream',
          methods: ['GET'],
          requestBody: 'buffered',
          fetch: (request) => {
            const url = new URL(request.url);
            const sessionId = url.searchParams.get('sessionId') ?? '';
            const id = url.searchParams.get('id') ?? '';
            if (sessionId === '' || id === '') return Promise.resolve(fail('dsh-editor/bad-request', 'missing sessionId or id'));
            return Promise.resolve(terminalStreamResponse(terminals, sessionId, id, request.signal));
          },
        }),
      'dsh-editor: terminal output stream',
    );

    ctx.effect(
      () =>
        register({
          path: '/api/dsh-editor/watch',
          methods: ['GET'],
          requestBody: 'buffered',
          fetch: (request) => {
            const url = new URL(request.url);
            const sessionId = url.searchParams.get('sessionId') ?? '';
            if (sessionId === '') return Promise.resolve(fail('dsh-editor/bad-request', 'missing sessionId'));
            let root;
            try {
              root = workspaceRoot(sessions, workingDirectory, sessionId);
            } catch (error) {
              return Promise.resolve(fail('dsh-editor/no-workspace', error instanceof Error ? error.message : String(error)));
            }
            return Promise.resolve(workspaceWatchResponse(root, request.signal));
          },
        }),
      'dsh-editor: workspace file watch',
    );
  });
}

/**
 * Follow one terminal as Server-Sent Events, replaying the retained screen first.
 * @param {TerminalHub} terminals - owning registry.
 * @param {string} sessionId - Session identity.
 * @param {string} id - terminal identity.
 * @param {AbortSignal} signal - request lifetime.
 * @returns {Response} event stream response.
 */
function terminalStreamResponse(terminals, sessionId, id, signal) {
  let detach = () => {};
  const body = new ReadableStream({
    start(controller) {
      try {
        detach = terminals.attach(sessionId, id, (event) => {
          try {
            controller.enqueue(encodeSse(event));
          } catch {
            detach();
          }
        });
      } catch (error) {
        controller.enqueue(encodeSse({ type: 'error', message: error instanceof Error ? error.message : String(error) }));
        controller.close();
      }
      signal.addEventListener(
        'abort',
        () => {
          detach();
          try {
            controller.close();
          } catch {
            /* already closed */
          }
        },
        { once: true },
      );
    },
    cancel() {
      detach();
    },
  });
  return new Response(body, {
    status: 200,
    headers: {
      'content-type': 'text/event-stream; charset=utf-8',
      'cache-control': 'no-store',
      'x-accel-buffering': 'no',
    },
  });
}
