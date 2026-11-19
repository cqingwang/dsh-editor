import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createReadStream, readdirSync, watch } from 'node:fs';
import { appendFile, chmod, lstat, mkdir, mkdtemp, open, readdir, readFile, realpath, rename, rm, stat, unlink, writeFile } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { basename, dirname, extname, isAbsolute, join, resolve, sep } from 'node:path';
import { promisify } from 'node:util';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { TerminalHub, encodeSse } from './terminal.js';

/** Host half of dsh-editor: workspace file access, git operations, and the Monaco asset bridge. */
export const name = 'dsh-editor';
export const inject = ['connection', 'sessions', 'workingDirectory'];

/** Persistent, bounded diagnostics written only when Editor health anomalies occur. */
const EDITOR_DIAGNOSTICS_FILE = join(
  process.env.DSH_HOME ?? join(homedir(), '.dsh'),
  'logs',
  'dsh-editor-diagnostics.jsonl',
);
const MAX_EDITOR_DIAGNOSTICS_BYTES = 64 * 1024;

/* Workspace and git primitives are exported for the regression suite; the plugin itself only needs `apply`. */
export { revealInFileManager, gitCommit, gitDiff, gitCombinedDiff, gitSelectedPatch, gitCommitPatch, gitApplyPatch, gitIgnore, gitInspect, gitLastCommit, gitLog, gitResolveConflict, gitRollback, gitShowCommit, gitStage, gitStatus, parseNumstat, gitCommitDiff, gitFileHistory, gitBranches, gitCheckout, gitCheckoutRevision, gitCreateBranch, gitCreateTag, gitResetToRevision, gitCherryPick, gitRevert, gitRestoreFile, gitStash, gitShelve, fileCompareText, gitDiffWithRevision, gitRepositoryVersion, gitPush, gitFetch, gitPull, gitGraph, gitBlame, parseBlamePorcelain, gitApplyChunk, gitWriteIndex };
export { commitWorkspaceReplacements, describeGitError, searchWorkspaceText, replaceWorkspaceText, undoLastWorkspaceReplacement, redoLastWorkspaceReplacement };
export { WorkspaceWatcher };
export const workspaceFileOperations = { remove: deleteEntry, rename: renameEntry, write: writeTextFileGuarded, writeBinary: writeUploadedFile, startUpload: startWorkspaceUpload, writeUploadChunk: writeWorkspaceUploadChunk, finishUpload: finishWorkspaceUpload, abortUpload: abortWorkspaceUpload, imageInfo: imageFileInfo, describe: describePaths, sort: sortEntries, reveal: revealInFileManager, search: searchWorkspaceEntries, searchText: searchWorkspaceText, replaceText: replaceWorkspaceText, undoReplaceText: undoLastWorkspaceReplacement, redoReplaceText: redoLastWorkspaceReplacement };

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
const VCS_METADATA_DIRECTORIES = new Set(['.git', '.hg', '.svn']);

/**
 * Directories Project View treats as excluded when Show Excluded Files is off.
 * `.git` remains unconditional and is handled by IGNORED_DIRECTORIES.
 */
const PROJECT_EXCLUDED_DIRECTORIES = new Set([...WALK_IGNORED].filter((name) => name !== '.git'));

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

/** Browser-renderable workspace image types accepted by the preview route. */
const IMAGE_MEDIA_TYPES = new Map([
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.jfif', 'image/jpeg'],
  ['.gif', 'image/gif'],
  ['.webp', 'image/webp'],
  ['.avif', 'image/avif'],
  ['.bmp', 'image/bmp'],
  ['.ico', 'image/x-icon'],
  ['.svg', 'image/svg+xml'],
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

/** Legacy one-request base64 API bound; chunked Project uploads bypass it. */
const MAX_LEGACY_UPLOAD_FILE_BYTES = 32 * 1024 * 1024;

/** Maximum chunk admitted by the resumable upload endpoint. */
const MAX_UPLOAD_CHUNK_BYTES = 16 * 1024 * 1024;

/** Lifetime of completed upload identities so a retried finish stays idempotent. */
const COMPLETED_UPLOAD_TTL_MS = 10 * 60 * 1000;

/** Active chunked uploads keyed by an unguessable upload id. */
const activeWorkspaceUploads = new Map();

/** Internal partial-file prefix/suffix, never shown as a user workspace entry. */
const UPLOAD_TEMP_PREFIX = '.dsh-editor-upload-';
const UPLOAD_TEMP_SUFFIX = '.part';
const UPLOAD_TEMP_TTL_MS = 60 * 60 * 1000;

/**
 * Whether one directory entry is an internal upload temporary.
 * @param {unknown} name - basename.
 * @returns {boolean} true for hidden upload parts.
 */
function isUploadTempName(name) {
  const value = String(name ?? '');
  return value.startsWith(UPLOAD_TEMP_PREFIX) && value.endsWith(UPLOAD_TEMP_SUFFIX);
}

/**
 * Validate canonical base64 without a repeated-group regex.
 *
 * V8 executes `/^(?:[A-Za-z0-9+/]{4})*...$/` recursively. Encoded files near
 * 4 MiB already overflow the regexp stack, which made otherwise valid Project
 * drops fail before the file could be written. A single linear scan has no
 * input-size-dependent recursion.
 * @param {unknown} value - browser-supplied base64 text.
 * @returns {boolean} whether the value contains canonical base64 padding.
 */
function isCanonicalBase64(value) {
  if (typeof value !== 'string' || value.length % 4 !== 0) return false;
  const padding = value.endsWith('==') ? 2 : value.endsWith('=') ? 1 : 0;
  const dataLength = value.length - padding;
  for (let index = 0; index < dataLength; index += 1) {
    const code = value.charCodeAt(index);
    const alphabet = (code >= 65 && code <= 90)
      || (code >= 97 && code <= 122)
      || (code >= 48 && code <= 57)
      || code === 43
      || code === 47;
    if (!alphabet) return false;
  }
  for (let index = dataLength; index < value.length; index += 1) {
    if (value.charCodeAt(index) !== 61) return false;
  }
  return true;
}

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
 * Convert one browser diagnostic into a small JSONL-safe record.
 *
 * Diagnostics are operational telemetry only. They intentionally exclude chat,
 * file contents, DOM markup and request bodies; large nested values are bounded
 * so a malformed client cannot grow the host log without limit.
 * @param {unknown} value - browser-supplied record.
 * @returns {object} sanitized record with bounded fields.
 */
function editorDiagnosticRecord(value) {
  const source = value !== null && typeof value === 'object' ? value : {};
  let details = {};
  try {
    const serialized = JSON.stringify(source.details ?? {});
    details = serialized.length <= 8_192
      ? JSON.parse(serialized)
      : { truncated: true, preview: serialized.slice(0, 8_192) };
  } catch {
    details = { unreadable: true };
  }
  return {
    receivedAt: new Date().toISOString(),
    source: 'dsh-editor-client',
    event: typeof source.event === 'string' ? source.event.slice(0, 80) : 'unknown',
    at: typeof source.at === 'string' ? source.at.slice(0, 80) : '',
    sequence: Number.isFinite(Number(source.sequence)) ? Number(source.sequence) : 0,
    page: typeof source.page === 'string' ? source.page.slice(0, 256) : '',
    details,
  };
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
 * Resolve the workspace scope carried by one browser request.
 *
 * A conversation session is the historical source of the Editor root, but the
 * workspace `... → Editor` entry must also work when that workspace has no live
 * session yet. In that case the browser sends the workspace id from the clicked
 * sidebar row and the host resolves its path through the workspace registry.
 * The registry lookup is the allow-list: a caller cannot turn the API into an
 * arbitrary filesystem reader by inventing a path.
 *
 * @param {object} input - request scope and host services.
 * @param {object} input.sessions - Session registry service.
 * @param {object|null} input.workingDirectory - working-directory service.
 * @param {object|null} input.workspaceRegistry - workspace registry service.
 * @param {string} input.sessionId - live conversation session id, if any.
 * @param {string} input.workspaceId - clicked workspace id, if any.
 * @returns {string} absolute workspace root.
 */
export function workspaceRootForRequest({ sessions, workingDirectory, workspaceRegistry, sessionId, workspaceId }) {
  const requestedWorkspaceId = typeof workspaceId === 'string' ? workspaceId : '';
  if (requestedWorkspaceId !== '') {
    let workspaces = [];
    try {
      workspaces = workspaceRegistry?.list?.() ?? [];
    } catch {
      workspaces = [];
    }
    const matched = Array.isArray(workspaces)
      ? workspaces.find((workspace) => workspace !== null && typeof workspace === 'object' && workspace.id === requestedWorkspaceId)
      : undefined;
    if (matched === undefined || typeof matched.path !== 'string' || matched.path === '') {
      throw new Error(`workspace "${requestedWorkspaceId}" is not registered`);
    }
    return resolve(matched.path);
  }
  const requestedSessionId = typeof sessionId === 'string' ? sessionId : '';
  if (requestedSessionId === '') throw new Error('missing sessionId or workspaceId');
  return workspaceRoot(sessions, workingDirectory, requestedSessionId);
}

/**
 * Derive the retained-terminal namespace for one browser request.
 *
 * A workspace-menu Editor is independent of the currently visible conversation,
 * so its PTYs must not be stored under that conversation's session id. An
 * explicit workspace id therefore wins; the historical session scope remains
 * for hero/chat entries that do not select a workspace.
 * @param {{sessionId?: string, workspaceId?: string}} input - browser scope.
 * @returns {string} terminal registry key.
 */
export function terminalScopeForRequest({ sessionId, workspaceId }) {
  const requestedWorkspaceId = typeof workspaceId === 'string' ? workspaceId : '';
  if (requestedWorkspaceId !== '') return `workspace:${requestedWorkspaceId}`;
  const requestedSessionId = typeof sessionId === 'string' ? sessionId : '';
  if (requestedSessionId === '') throw new Error('missing sessionId or workspaceId');
  return requestedSessionId;
}

/**
 * Sort one directory listing the way IDEA's Project view does.
 *
 * `foldersFirst` reproduces IDEA's Folders Always on Top. When it is off, the
 * chosen comparator applies across both kinds; when on, directories stay in
 * their own leading group. `modified` is IDEA's newest-first action and
 * `modified-asc` is its oldest-first counterpart.
 * @param {object[]} entries - entries to sort in place.
 * @param {'name'|'type'|'modified'|'modified-asc'} mode - active sort mode.
 * @param {boolean} [foldersFirst=true] - keep directories ahead of files.
 * @returns {object[]} the same array, sorted.
 */
function sortEntries(entries, mode, foldersFirst = true) {
  const byName = (left, right) => left.name.localeCompare(right.name, undefined, { sensitivity: 'base' });
  const compare = mode === 'modified' || mode === 'modified-asc'
    ? (left, right) => (mode === 'modified-asc' ? left.mtime - right.mtime : right.mtime - left.mtime) || byName(left, right)
    : mode === 'type'
      ? (left, right) => {
          const leftExtension = left.kind === 'file' ? left.name.slice(left.name.lastIndexOf('.') + 1).toLowerCase() : '';
          const rightExtension = right.kind === 'file' ? right.name.slice(right.name.lastIndexOf('.') + 1).toLowerCase() : '';
          return leftExtension.localeCompare(rightExtension) || byName(left, right);
        }
      : byName;
  entries.sort((left, right) => {
    if (foldersFirst && left.kind !== right.kind) return left.kind === 'directory' ? -1 : 1;
    return compare(left, right);
  });
  return entries;
}

/**
 * List one directory with IDEA's active sort and Folders Always on Top option.
 * @param {string} root - workspace root.
 * @param {string} relativePath - directory path relative to the root.
 * @param {{showHidden?: boolean, sort?: string, foldersFirst?: boolean}} options - Project View options.
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
    if (isUploadTempName(row.name)) continue;
    /* IDEA hides dot-entries unless the user turns on "Show hidden files".
       Only `.git` is unconditional (see IGNORED_DIRECTORIES). */
    if (!showHidden && row.name.startsWith('.')) continue;
    if (options.showExcluded !== true && PROJECT_EXCLUDED_DIRECTORIES.has(row.name)) continue;
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
  sortEntries(entries, options.sort, options.foldersFirst !== false);
  return { path: relativePath, entries };
}

/**
 * List child directories for the Web workspace chooser.
 *
 * This is intentionally narrower than the workspace file API: it accepts only
 * an absolute directory path, returns directory entries only, and never reads
 * file contents. The desktop App keeps its native host picker; this route is
 * only used when that picker has no Web browse capability.
 * @param {unknown} requestedPath - absolute directory path, or empty for home.
 * @returns {Promise<{path: string, home: string, entries: Array<{name: string, path: string, hidden: boolean}>}>} directory listing.
 */
export async function listWorkspaceDirectoryForPicker(requestedPath) {
  if (requestedPath !== undefined && typeof requestedPath !== 'string') {
    throw new Error('directory path must be a string');
  }
  const requested = typeof requestedPath === 'string' ? requestedPath.trim() : '';
  if (requested.includes('\0')) throw new Error('directory path contains a null byte');
  if (requested !== '' && !isAbsolute(requested)) throw new Error('directory path must be absolute');
  const home = homedir();
  const directory = requested === '' ? home : resolve(requested);
  const info = await stat(directory);
  if (!info.isDirectory()) throw new Error('path is not a directory');
  const rows = await readdir(directory, { withFileTypes: true });
  const entries = rows
    .filter((row) => row.isDirectory())
    .map((row) => ({
      name: row.name,
      path: join(directory, row.name),
      hidden: row.name.startsWith('.'),
    }))
    .sort((left, right) => left.name.localeCompare(right.name, undefined, { numeric: true, sensitivity: 'base' }));
  return { path: directory, home, entries };
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
 * Resolve one browser-renderable image without reading its bytes as text.
 * @param {string} root - workspace root.
 * @param {string} relativePath - image path relative to the root.
 * @returns {Promise<{path: string, size: number, mtime: number, mediaType: string}>} image metadata.
 */
async function imageFileInfo(root, relativePath) {
  const file = resolveInside(root, relativePath);
  const mediaType = IMAGE_MEDIA_TYPES.get(extname(file).toLowerCase());
  if (mediaType === undefined) throw new Error('not a supported image');
  const info = await stat(file);
  if (!info.isFile()) throw new Error('not a file');
  return { path: relativePath, size: info.size, mtime: info.mtimeMs, mediaType };
}

/**
 * Stream one workspace image to the browser's native image decoder.
 * @param {string} root - workspace root.
 * @param {string} relativePath - image path relative to the root.
 * @param {Request} request - incoming GET or HEAD request.
 * @returns {Promise<Response>} image response.
 */
async function imageFileResponse(root, relativePath, request) {
  let file;
  try {
    file = resolveInside(root, relativePath);
  } catch {
    return new Response('forbidden', { status: 403 });
  }
  const mediaType = IMAGE_MEDIA_TYPES.get(extname(file).toLowerCase());
  if (mediaType === undefined) return new Response('unsupported image', { status: 415 });
  const info = await stat(file).catch(() => null);
  if (info === null || !info.isFile()) return new Response('not found', { status: 404 });
  const headers = {
    'content-type': mediaType,
    'content-length': String(info.size),
    'cache-control': 'no-store',
    'content-disposition': 'inline',
    'x-content-type-options': 'nosniff',
  };
  if (request.method === 'HEAD') return new Response(null, { status: 200, headers });
  return new Response(createReadStream(file), { status: 200, headers });
}

/**
 * Replace a text file by writing a sibling and atomically renaming it.
 *
 * Keeping the temporary file in the destination directory guarantees that
 * rename stays on one filesystem. Symlink targets are resolved first so saving
 * through a link updates its target without replacing the link itself.
 * @param {string} file - absolute destination path.
 * @param {string} content - complete new contents.
 * @param {number|undefined} mode - existing permission bits to preserve.
 * @returns {Promise<void>} resolves after the destination is replaced.
 */
async function atomicWriteTextFile(file, content, mode) {
  const target = (await lstat(file).catch(() => null))?.isSymbolicLink() === true
    ? await realpath(file)
    : file;
  const directory = dirname(target);
  const temporary = join(directory, `.${basename(target)}.dsh-editor-${process.pid}-${randomUUID()}.tmp`);
  let handle = null;
  try {
    handle = await open(temporary, 'wx', mode === undefined ? 0o666 : mode & 0o777);
    await handle.writeFile(content, 'utf8');
    await handle.sync();
    await handle.close();
    handle = null;
    if (mode !== undefined) await chmod(temporary, mode & 0o777);
    await rename(temporary, target);
  } catch (error) {
    await handle?.close().catch(() => {});
    await unlink(temporary).catch(() => {});
    throw error;
  }
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
  await atomicWriteTextFile(file, content, info.mode);
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
    await atomicWriteTextFile(file, content);
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
  await atomicWriteTextFile(file, content, info.mode);
  const next = await stat(file);
  return { path: relativePath, size: next.size, mtime: next.mtimeMs };
}

/**
 * Create one binary file from an operating-system drag and drop.
 *
 * Uploads are exclusive: the Project tree never silently overwrites a file
 * that already exists. The client preflights a whole drop, while this second
 * check protects direct API callers and races with another writer.
 * @param {string} root - workspace root.
 * @param {string} relativePath - destination relative to the root.
 * @param {string} contentBase64 - canonical base64 file bytes.
 * @returns {Promise<{path: string, size: number, mtime: number}>} created file metadata.
 */
async function writeUploadedFile(root, relativePath, contentBase64) {
  if (typeof relativePath !== 'string' || relativePath === '') throw new Error('a destination path is required');
  if (!isCanonicalBase64(contentBase64)) throw new Error('invalid base64 file content');
  const content = Buffer.from(contentBase64, 'base64');
  if (content.length > MAX_LEGACY_UPLOAD_FILE_BYTES) throw new Error('file is larger than the 32 MiB upload limit');
  const target = resolveInside(root, relativePath);
  await mkdir(dirname(target), { recursive: true });
  let handle = null;
  try {
    handle = await open(target, 'wx', 0o666);
    await handle.writeFile(content);
    await handle.sync();
    await handle.close();
    handle = null;
  } catch (error) {
    await handle?.close().catch(() => {});
    if (error?.code === 'EEXIST') {
      const conflict = new Error(`${relativePath} already exists`);
      conflict.code = 'dsh-editor/exists';
      throw conflict;
    }
    throw error;
  }
  const info = await stat(target);
  return { path: relativePath, size: info.size, mtime: info.mtimeMs };
}

/**
 * Build one typed chunked-upload failure for the HTTP layer and tests.
 * @param {string} code - stable upload error code.
 * @param {string} message - diagnostic message.
 * @param {object} [details] - additional structured fields.
 * @returns {Error} typed error.
 */
function workspaceUploadFailure(code, message, details = {}) {
  const failure = new Error(message);
  failure.code = code;
  Object.assign(failure, details);
  return failure;
}

/**
 * Locate one live chunked upload for the current workspace.
 * @param {string} root - workspace root.
 * @param {string} uploadId - opaque upload identity.
 * @returns {object} active upload record.
 */
function requireWorkspaceUpload(root, uploadId) {
  const upload = activeWorkspaceUploads.get(typeof uploadId === 'string' ? uploadId : '');
  if (upload === undefined || upload.root !== root) {
    throw workspaceUploadFailure('dsh-editor/upload-not-found', 'upload session was not found');
  }
  return upload;
}

/**
 * Remove abandoned hidden upload parts once they exceed the retention window.
 * @param {string} directory - absolute destination directory.
 * @returns {Promise<void>} resolves after best-effort cleanup.
 */
async function cleanupStaleUploadTemps(directory) {
  const rows = await readdir(directory).catch(() => []);
  const activeParts = new Set([...activeWorkspaceUploads.values()].map((upload) => upload.partial));
  const cutoff = Date.now() - UPLOAD_TEMP_TTL_MS;
  for (const name of rows) {
    if (!isUploadTempName(name)) continue;
    const partial = join(directory, name);
    if (activeParts.has(partial)) continue;
    const info = await stat(partial).catch(() => null);
    if (info === null || info.mtimeMs >= cutoff) continue;
    await unlink(partial).catch(() => {});
  }
}

/**
 * Refresh an upload's idle expiry timer.
 *
 * A page reload cannot call abort, so abandoned parts need a host-owned
 * backstop rather than relying on the user to retry or stop the process.
 * @param {object} upload - active upload record.
 * @returns {void}
 */
function scheduleUploadIdleCleanup(upload) {
  if (upload.idleTimer !== undefined) clearTimeout(upload.idleTimer);
  upload.updatedAt = Date.now();
  const timer = setTimeout(() => {
    const current = activeWorkspaceUploads.get(upload.uploadId);
    if (current !== upload || upload.completed) return;
    activeWorkspaceUploads.delete(upload.uploadId);
    void unlink(upload.partial).catch(() => {});
  }, UPLOAD_TEMP_TTL_MS);
  timer.unref?.();
  upload.idleTimer = timer;
}

/**
 * Start a resumable upload by exclusively reserving its destination file.
 *
 * File Browser's tus implementation declares the final length before chunks
 * arrive. Keeping that contract lets the host reject over-length chunks and
 * lets a retry compare the durable file offset instead of guessing.
 * @param {string} root - workspace root.
 * @param {string} relativePath - destination relative to the workspace.
 * @param {number} size - declared final byte length.
 * @returns {Promise<{uploadId: string, offset: number, size: number}>} upload identity.
 */
async function startWorkspaceUpload(root, relativePath, size) {
  if (typeof relativePath !== 'string' || relativePath === '') throw new Error('a destination path is required');
  if (!Number.isSafeInteger(size) || size < 0) throw new Error('upload length must be a non-negative safe integer');
  const target = resolveInside(root, relativePath);
  const directory = dirname(target);
  await mkdir(directory, { recursive: true });
  await cleanupStaleUploadTemps(directory);
  const uploadId = randomUUID();
  const partial = join(directory, `${UPLOAD_TEMP_PREFIX}${uploadId}${UPLOAD_TEMP_SUFFIX}`);
  let handle = null;
  try {
    handle = await open(partial, 'wx', 0o666);
    await handle.sync();
  } catch (error) {
    await handle?.close().catch(() => {});
    throw error;
  }
  await handle.close();
  activeWorkspaceUploads.set(uploadId, {
    uploadId,
    root,
    target,
    partial,
    relativePath,
    size,
    offset: 0,
    completed: false,
  });
  scheduleUploadIdleCleanup(activeWorkspaceUploads.get(uploadId));
  return { uploadId, offset: 0, size };
}

/**
 * Append one chunk at the exact durable offset.
 * @param {string} root - workspace root.
 * @param {string} uploadId - opaque upload identity.
 * @param {number} offset - client's expected current byte offset.
 * @param {Uint8Array|Buffer} bytes - raw chunk bytes.
 * @returns {Promise<{offset: number}>} durable offset after the chunk.
 */
async function writeWorkspaceUploadChunk(root, uploadId, offset, bytes) {
  const upload = requireWorkspaceUpload(root, uploadId);
  const content = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes ?? []);
  if (!Number.isSafeInteger(offset) || offset < 0) throw new Error('invalid upload offset');
  if (content.length > MAX_UPLOAD_CHUNK_BYTES) {
    throw workspaceUploadFailure('dsh-editor/upload-chunk-too-large', 'upload chunk is too large');
  }
  const info = await stat(upload.partial).catch(() => null);
  if (info === null || !info.isFile()) {
    throw workspaceUploadFailure('dsh-editor/upload-not-found', 'upload temporary file no longer exists');
  }
  if (info.size !== upload.offset || offset !== upload.offset) {
    throw workspaceUploadFailure(
      'dsh-editor/upload-offset',
      `upload offset ${offset} does not match durable offset ${info.size}`,
      { currentOffset: info.size },
    );
  }
  if (offset + content.length > upload.size) {
    throw workspaceUploadFailure(
      'dsh-editor/upload-length',
      `upload exceeds declared length of ${upload.size} bytes`,
      { currentOffset: upload.offset },
    );
  }
  const handle = await open(upload.partial, 'r+');
  let written = 0;
  try {
    while (written < content.length) {
      const result = await handle.write(content, written, content.length - written, offset + written);
      if (!Number.isInteger(result.bytesWritten) || result.bytesWritten <= 0) {
        throw new Error('could not make progress writing upload chunk');
      }
      written += result.bytesWritten;
    }
    await handle.sync();
  } finally {
    await handle.close();
  }
  upload.offset = offset + content.length;
  scheduleUploadIdleCleanup(upload);
  return { offset: upload.offset };
}

/**
 * Complete one upload after verifying the declared and durable lengths agree.
 * @param {string} root - workspace root.
 * @param {string} uploadId - opaque upload identity.
 * @returns {Promise<{path: string, size: number, mtime: number}>} uploaded file metadata.
 */
async function finishWorkspaceUpload(root, uploadId) {
  const upload = requireWorkspaceUpload(root, uploadId);
  const info = await stat(upload.partial).catch(() => null);
  if (info === null || !info.isFile() || info.size !== upload.size || upload.offset !== upload.size) {
    throw workspaceUploadFailure(
      'dsh-editor/upload-incomplete',
      `upload is incomplete: durable ${info?.size ?? 0}, expected ${upload.size}`,
      { currentOffset: info?.size ?? 0 },
    );
  }
  const existing = await lstat(upload.target).catch(() => null);
  if (existing !== null) {
    throw workspaceUploadFailure('dsh-editor/exists', `${upload.relativePath} already exists`, { path: upload.relativePath });
  }
  await rename(upload.partial, upload.target);
  const finalInfo = await stat(upload.target);
  upload.completed = true;
  if (upload.idleTimer !== undefined) clearTimeout(upload.idleTimer);
  upload.idleTimer = undefined;
  const result = { path: upload.relativePath, size: finalInfo.size, mtime: finalInfo.mtimeMs };
  const timer = setTimeout(() => {
    const current = activeWorkspaceUploads.get(uploadId);
    if (current === upload) activeWorkspaceUploads.delete(uploadId);
  }, COMPLETED_UPLOAD_TTL_MS);
  timer.unref?.();
  return result;
}

/**
 * Abort one upload and remove its reserved destination.
 * @param {string} root - workspace root.
 * @param {string} uploadId - opaque upload identity.
 * @returns {Promise<{aborted: boolean}>} abort acknowledgement.
 */
async function abortWorkspaceUpload(root, uploadId) {
  const upload = requireWorkspaceUpload(root, uploadId);
  activeWorkspaceUploads.delete(uploadId);
  if (upload.idleTimer !== undefined) clearTimeout(upload.idleTimer);
  upload.idleTimer = undefined;
  if (!upload.completed) await unlink(upload.partial).catch(() => {});
  return { aborted: true };
}

/**
 * Convert one upload failure into an HTTP response without hiding its offset.
 * @param {unknown} failure - upload failure.
 * @returns {Response} JSON response with a useful status code.
 */
function uploadFailureResponse(failure) {
  const code = typeof failure?.code === 'string' ? failure.code : 'dsh-editor/upload';
  const status = code === 'dsh-editor/upload-offset'
    ? 409
    : code === 'dsh-editor/upload-not-found'
      ? 404
      : code === 'dsh-editor/upload-chunk-too-large' || code === 'dsh-editor/upload-length'
        ? 413
        : code === 'dsh-editor/exists'
          ? 409
          : 500;
  return Response.json(
    {
      ok: false,
      error: {
        code,
        message: failure instanceof Error ? failure.message : String(failure),
        ...(typeof failure?.path === 'string' ? { path: failure.path } : null),
        ...(Number.isSafeInteger(failure?.currentOffset) ? { currentOffset: failure.currentOffset } : null),
      },
    },
    { status, headers: { 'cache-control': 'no-store' } },
  );
}

/**
 * Walk the workspace once for the quick-open palette.
 *
 * Bounded on purpose: a quick-open list is a navigation aid, not a full index,
 * so heavy directories (see {@link WALK_IGNORED}) are skipped and the walk
 * stops at a fixed ceiling.
 * @param {string} root - workspace root.
 * @param {number} limit - maximum number of files.
 * @param {{includeExcluded?: boolean, directory?: string}} [options] - include heavy workspace directories except VCS metadata, or start below one directory.
 * @returns {Promise<{files: string[], truncated: boolean}>} workspace-relative files.
 */
async function listWorkspaceFiles(root, limit = 2000, options = {}) {
  const includeExcluded = options?.includeExcluded === true;
  const recursive = options?.recursive !== false;
  const scopeDirectory = normalizeWorkspaceScopePath(options?.directory);
  if (scopeDirectory === null) return { files: [], truncated: false };
  const files = [];
  const queue = [scopeDirectory];
  let truncated = false;
  while (queue.length > 0 && files.length < limit) {
    const directory = queue.shift();
    const entries = await listDirectory(root, directory, { showHidden: true, showExcluded: includeExcluded }).catch(() => ({ entries: [] }));
    for (const entry of entries.entries) {
      if (WALK_IGNORED.has(basename(entry.path))) {
        if (!includeExcluded || VCS_METADATA_DIRECTORIES.has(basename(entry.path))) continue;
      }
      if (entry.kind === 'directory') {
        if (recursive !== false) queue.push(entry.path);
      } else {
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

/** Maximum files admitted by one Git-backed Find scope. */
const GIT_SEARCH_SCOPE_MAX_FILES = 5000;

/**
 * Normalize IDEA's two Git-backed Project Files scopes.
 * @param {unknown} value - browser-supplied scope id.
 * @returns {'tracked'|'nonIgnored'|null} supported Git scope or null.
 */
function normalizeGitSearchScope(value) {
  if (value === 'tracked' || value === 'nonIgnored') return value;
  return null;
}

/**
 * List workspace files from Git without leaving the workspace boundary.
 *
 * `tracked` is IDEA's Project Files Tracked by Git. `nonIgnored` additionally
 * adds untracked files that Git does not exclude, which is IDEA's Project Files
 * Excluding Git-ignored. The workspace may be a subdirectory of the repository,
 * so repository-relative names are normalized back to the workspace root.
 * @param {string} root - workspace root.
 * @param {unknown} value - requested Git scope.
 * @returns {Promise<{files: string[], truncated: boolean}|null>} bounded file list.
 */
async function listGitSearchScopeFiles(root, value) {
  const scope = normalizeGitSearchScope(value);
  if (scope === null) return null;
  const prefix = (await runGit(root, ['rev-parse', '--show-prefix']).catch(() => '')).trim();
  const args = scope === 'tracked'
    ? ['ls-files', '-z', '--cached']
    : ['ls-files', '-z', '--cached', '--others', '--exclude-standard'];
  const raw = await runGit(root, args);
  const files = [];
  let truncated = false;
  for (const record of raw.split('\0')) {
    if (record === '') continue;
    const normalized = record.replaceAll('\\', '/').replace(/^\.\/+/u, '');
    let relativePath = normalized;
    if (prefix !== '' && normalized.startsWith(prefix)) relativePath = normalized.slice(prefix.length);
    if (relativePath === '' || relativePath.startsWith('/') || relativePath.split('/').some((segment) => segment === '..')) continue;
    files.push(relativePath);
    if (files.length >= GIT_SEARCH_SCOPE_MAX_FILES) {
      truncated = true;
      break;
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
 * Search workspace entry names recursively for Project speed search.
 *
 * The Project tree only has listings for directories the user has already
 * expanded, so filtering its rendered rows cannot find a file in a collapsed
 * folder. This walk uses the same `listDirectory()` rules as the tree for hidden
 * and excluded entries, skips heavy dependency/build forests like quick open,
 * and stops on a fixed budget so a single keystroke cannot stall the host.
 *
 * @param {string} root - workspace root.
 * @param {unknown} query - case-insensitive entry-name fragment.
 * @param {{showHidden?: boolean, showExcluded?: boolean, sort?: string, foldersFirst?: boolean, signal?: AbortSignal}} [options] - Project View preferences and request cancellation.
 * @returns {Promise<{entries: Array<{path: string, name: string, kind: string}>, truncated: boolean}>} matches.
 */
async function searchWorkspaceEntries(root, query, options = {}) {
  const needle = typeof query === 'string' ? query.trim().toLowerCase() : '';
  if (needle === '') return { entries: [], truncated: false };
  if (options.signal?.aborted === true) return { entries: [], truncated: false };
  const maxMatches = 200;
  const maxVisited = 50_000;
  const entries = [];
  const queue = [''];
  let visited = 0;
  let truncated = false;
  search: while (queue.length > 0) {
    if (options.signal?.aborted === true) return { entries: [], truncated: false };
    const directory = queue.shift();
    const listing = await listDirectory(root, directory, {
      showHidden: options.showHidden === true,
      sort: typeof options.sort === 'string' ? options.sort : 'name',
      foldersFirst: options.foldersFirst !== false,
      showExcluded: options.showExcluded === true,
    }).catch(() => ({ entries: [] }));
    for (const entry of listing.entries) {
      visited += 1;
      if (visited > maxVisited) {
        truncated = true;
        break search;
      }
      if (WALK_IGNORED.has(entry.name)) continue;
      if (entry.name.toLowerCase().includes(needle)) {
        entries.push({ path: entry.path, name: entry.name, kind: entry.kind });
        if (entries.length >= maxMatches) {
          truncated = true;
          break search;
        }
      }
      if (entry.kind === 'directory') queue.push(entry.path);
    }
  }
  return { entries, truncated };
}

/** Normalize one custom Scope's include/exclude glob list. */
function normalizeWorkspaceScopePatterns(value) {
  const entries = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(/[\n,]/u)
      : [];
  return [...new Set(entries
    .filter((entry) => typeof entry === 'string')
    .map((entry) => entry.trim().replaceAll('\\', '/'))
    .filter((entry) => entry !== '' && entry.length <= 512))]
    .slice(0, 40);
}

/** Match one workspace-relative path against a bounded Scope glob. */
function workspaceScopeGlobMatches(path, rawPattern) {
  let pattern = typeof rawPattern === 'string' ? rawPattern.trim().replaceAll('\\', '/') : '';
  if (pattern === '') return false;
  pattern = pattern.replace(/^file:/u, '').replace(/^\.\/+/u, '').replace(/\/+$/u, '');
  pattern = pattern.replace(/\/\/\*$/u, '/**');
  if (pattern === '') return true;
  const hasGlob = pattern.includes('*') || pattern.includes('?');
  if (!hasGlob && !pattern.includes('/')) {
    return path === pattern || path.startsWith(`${pattern}/`) || basename(path) === pattern;
  }
  const target = pattern.includes('/') ? path : basename(path);
  let source = '';
  for (let index = 0; index < pattern.length; index += 1) {
    const character = pattern[index];
    if (character === '*') {
      if (pattern[index + 1] === '*') {
        source += '.*';
        index += 1;
      } else {
        source += '[^/]*';
      }
    } else if (character === '?') {
      source += '[^/]';
    } else {
      source += character.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
    }
  }
  return new RegExp(`^${source}$`, 'iu').test(target);
}

/** Custom Scope include patterns are ORed; any exclude match wins. */
function workspaceScopePatternsMatch(path, includePatterns, excludePatterns) {
  if (typeof path !== 'string' || path === '') return false;
  const includes = normalizeWorkspaceScopePatterns(includePatterns);
  const excludes = normalizeWorkspaceScopePatterns(excludePatterns);
  if (includes.length > 0 && !includes.some((pattern) => workspaceScopeGlobMatches(path, pattern))) return false;
  return !excludes.some((pattern) => workspaceScopeGlobMatches(path, pattern));
}

/** Largest file accepted by Search Everywhere's bounded text search. */
const TEXT_SEARCH_MAX_FILE_BYTES = 1024 * 1024;

/**
 * IDEA uses smart case: all-lowercase queries are case-insensitive, while a
 * query containing uppercase letters is case-sensitive.
 * @param {string} query - user query.
 * @param {object} options - search options.
 * @returns {boolean} whether matching must preserve case.
 */
function smartCaseSensitive(query, options) {
  if (typeof options?.caseSensitive === 'boolean') return options.caseSensitive;
  return query !== query.toLowerCase();
}

/**
 * All literal occurrences of a query inside one text.
 * @param {string} text - file content.
 * @param {string} query - non-empty literal query.
 * @param {boolean} caseSensitive - smart-case decision.
 * @param {boolean} [wholeWords=false] - require Unicode word boundaries.
 * @returns {number[]} zero-based character offsets.
 */
function literalMatchOffsets(text, query, caseSensitive, wholeWords = false) {
  if (typeof text !== 'string' || typeof query !== 'string' || query === '') return [];
  const haystack = caseSensitive ? text : text.toLowerCase();
  const needle = caseSensitive ? query : query.toLowerCase();
  const offsets = [];
  let cursor = 0;
  while (cursor <= haystack.length) {
    const found = haystack.indexOf(needle, cursor);
    if (found < 0) break;
    if (!wholeWords || isWholeWordMatch(text, query, found)) offsets.push(found);
    cursor = found + Math.max(1, needle.length);
  }
  return offsets;
}

/** Unicode word characters used by IDEA's Whole Words option. */
const WORD_CHARACTER_PATTERN = /^[\p{L}\p{N}\p{M}_]$/u;

/**
 * Read the character immediately before one UTF-16 offset.
 * @param {string} text - source text.
 * @param {number} index - boundary offset.
 * @returns {string} one Unicode code point or an empty string.
 */
function characterBefore(text, index) {
  if (index <= 0) return '';
  const trailing = text.charCodeAt(index - 1);
  if (trailing >= 0xDC00 && trailing <= 0xDFFF && index >= 2) {
    const leading = text.charCodeAt(index - 2);
    if (leading >= 0xD800 && leading <= 0xDBFF) return text.slice(index - 2, index);
  }
  return text[index - 1];
}

/**
 * Read the Unicode code point at one UTF-16 offset.
 * @param {string} text - source text.
 * @param {number} index - zero-based offset.
 * @returns {string} one Unicode code point or an empty string.
 */
function characterAt(text, index) {
  if (index < 0 || index >= text.length) return '';
  return String.fromCodePoint(text.codePointAt(index));
}

/**
 * Whether a literal occurrence is bounded as a whole word.
 *
 * CJK letters count as word characters, so a single Han glyph inside a longer
 * unseparated run is not a whole-word hit, matching IDEA's language-neutral
 * search option.
 * @param {string} text - source text.
 * @param {string} query - non-empty literal query.
 * @param {number} offset - occurrence offset.
 * @returns {boolean} true when both applicable sides are boundaries.
 */
function isWholeWordMatch(text, query, offset) {
  const characters = Array.from(query);
  const first = characters[0] ?? '';
  const last = characters[characters.length - 1] ?? '';
  const leftIsWord = WORD_CHARACTER_PATTERN.test(first);
  const rightIsWord = WORD_CHARACTER_PATTERN.test(last);
  const leftBoundary = !leftIsWord || !WORD_CHARACTER_PATTERN.test(characterBefore(text, offset));
  const rightBoundary = !rightIsWord || !WORD_CHARACTER_PATTERN.test(characterAt(text, offset + query.length));
  return leftBoundary && rightBoundary;
}

/** Maximum accepted user regex length. */
const REGEX_MAX_PATTERN_LENGTH = 256;

/** Common nested-repeat shapes that can make JavaScript backtracking explode. */
const REGEX_UNSAFE_REPEAT_PATTERN = /\((?:\\.|[^()])*(?:[+*]|\{\d+(?:,\d*)?\})(?:\\.|[^()])*\)\s*(?:[+*]|\{\d+(?:,\d*)?\})/u;

/**
 * Compile one user pattern once, with IDEA-compatible smart-case behavior.
 * @param {string} query - user regular expression.
 * @param {boolean} caseSensitive - smart-case decision.
 * @param {'global'|'sticky'} mode - loop over all matches or bind one offset.
 * @returns {RegExp} Unicode regex with matching flags.
 */
function compileWorkspaceRegex(query, caseSensitive, mode = 'global') {
  if (query.length > REGEX_MAX_PATTERN_LENGTH) {
    throw new Error(`regular expression is too long (maximum ${REGEX_MAX_PATTERN_LENGTH} characters)`);
  }
  if (REGEX_UNSAFE_REPEAT_PATTERN.test(query)) {
    throw new Error('regular expression is too complex: rewrite repeated groups without nested quantifiers');
  }
  const flags = `u${caseSensitive ? '' : 'i'}${mode === 'sticky' ? 'y' : 'g'}`;
  try {
    return new RegExp(query, flags);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`invalid regular expression: ${reason}`);
  }
}

/**
 * Enumerate bounded regex hits, forcing zero-length matches forward.
 * @param {string} text - file content.
 * @param {RegExp} regex - global Unicode regex.
 * @param {number} [maximum=Infinity] - maximum records to collect.
 * @returns {Array<{offset: number, length: number}>} match locations.
 */
function regexMatchRecords(text, regex, maximum = Infinity) {
  const records = [];
  regex.lastIndex = 0;
  while (records.length < maximum) {
    const match = regex.exec(text);
    if (match === null) break;
    records.push({ offset: match.index, length: match[0].length });
    if (match[0] === '') {
      const codePoint = text.codePointAt(regex.lastIndex);
      regex.lastIndex += codePoint !== undefined && codePoint > 0xFFFF ? 2 : 1;
    }
  }
  return records;
}

/** IDEA Find in Files 的文本上下文过滤模式。 */
const TEXT_SEARCH_CONTEXT_FILTERS = new Set([
  'anywhere',
  'comments',
  'strings',
  'exceptComments',
  'exceptStrings',
  'exceptBoth',
]);

/** 把持久化或请求中的过滤值收敛为 UI 可表达的六种模式。 */
function normalizeTextSearchContextFilter(value) {
  return typeof value === 'string' && TEXT_SEARCH_CONTEXT_FILTERS.has(value) ? value : 'anywhere';
}

const C_LIKE_TEXT_CONTEXT_RULES = {
  lineComments: ['//'],
  blockComments: [['/*', '*/']],
  strings: [
    { open: '`', close: '`', multiline: true },
    { open: '"', close: '"', multiline: false },
    { open: "'", close: "'", multiline: false },
  ],
};
const HASH_TEXT_CONTEXT_RULES = {
  lineComments: ['#'],
  blockComments: [],
  strings: [
    { open: '"', close: '"', multiline: false },
    { open: "'", close: "'", multiline: false },
  ],
};
const PYTHON_TEXT_CONTEXT_RULES = {
  lineComments: ['#'],
  blockComments: [],
  strings: [
    { open: '"""', close: '"""', multiline: true },
    { open: "'''", close: "'''", multiline: true },
    { open: '"', close: '"', multiline: false },
    { open: "'", close: "'", multiline: false },
  ],
};
const CSS_TEXT_CONTEXT_RULES = {
  lineComments: [],
  blockComments: [['/*', '*/']],
  strings: [
    { open: '"', close: '"', multiline: false },
    { open: "'", close: "'", multiline: false },
  ],
};
const HTML_TEXT_CONTEXT_RULES = {
  lineComments: [],
  blockComments: [['<!--', '-->']],
  strings: [
    { open: '"', close: '"', multiline: false },
    { open: "'", close: "'", multiline: false },
    { open: '`', close: '`', multiline: true },
  ],
};
const SQL_TEXT_CONTEXT_RULES = {
  lineComments: ['--'],
  blockComments: [['/*', '*/']],
  strings: [
    { open: '"', close: '"', multiline: false },
    { open: "'", close: "'", multiline: true, doubledClose: true },
  ],
};
const PHP_TEXT_CONTEXT_RULES = {
  lineComments: ['//', '#'],
  blockComments: [['/*', '*/']],
  strings: C_LIKE_TEXT_CONTEXT_RULES.strings,
};
const RUST_TEXT_CONTEXT_RULES = {
  ...C_LIKE_TEXT_CONTEXT_RULES,
  nestedBlockComments: true,
};
const MARKDOWN_TEXT_CONTEXT_RULES = {
  lineComments: [],
  blockComments: [['<!--', '-->']],
  strings: [],
};

const TEXT_CONTEXT_RULES_BY_EXTENSION = new Map([
  ...['js', 'jsx', 'mjs', 'cjs', 'ts', 'tsx', 'mts', 'cts', 'java', 'kt', 'kts', 'scala', 'cs', 'c', 'h', 'cc', 'cpp', 'cxx', 'hpp', 'hh', 'swift', 'dart', 'go', 'proto', 'groovy', 'gradle'].map((extension) => [extension, C_LIKE_TEXT_CONTEXT_RULES]),
  ...['py', 'pyw'].map((extension) => [extension, PYTHON_TEXT_CONTEXT_RULES]),
  ...['rb', 'sh', 'bash', 'zsh', 'fish', 'yml', 'yaml', 'toml', 'ini', 'cfg', 'conf', 'properties'].map((extension) => [extension, HASH_TEXT_CONTEXT_RULES]),
  ...['css', 'scss', 'sass', 'less', 'styl'].map((extension) => [extension, CSS_TEXT_CONTEXT_RULES]),
  ...['html', 'htm', 'xhtml', 'xml', 'svg', 'vue', 'svelte', 'astro'].map((extension) => [extension, HTML_TEXT_CONTEXT_RULES]),
  ...['sql', 'lua'].map((extension) => [extension, SQL_TEXT_CONTEXT_RULES]),
  ['php', PHP_TEXT_CONTEXT_RULES],
  ['rs', RUST_TEXT_CONTEXT_RULES],
  ...['md', 'markdown'].map((extension) => [extension, MARKDOWN_TEXT_CONTEXT_RULES]),
]);

/** 按文件名选择保守的词法规则；未知类型不猜测注释或字符串。 */
function textSearchContextRules(path) {
  const name = basename(String(path ?? '')).toLowerCase();
  if (name === 'dockerfile' || name.startsWith('dockerfile.') || name === 'makefile') {
    return HASH_TEXT_CONTEXT_RULES;
  }
  const extension = extname(name).slice(1);
  return TEXT_CONTEXT_RULES_BY_EXTENSION.get(extension) ?? null;
}

/**
 * 标记每个 UTF-16 位置的词法上下文。
 *
 * 0 = 普通代码，1 = 注释，2 = 字符串。扫描只识别确定性的行/块注释和
 * 常见引号，不声称是完整 AST；未知语言返回全代码掩码。
 */
function textSearchContextMask(text, path) {
  const source = typeof text === 'string' ? text : '';
  const mask = new Uint8Array(source.length);
  const rules = textSearchContextRules(path);
  if (rules === null) return mask;
  const lineComments = [...(rules.lineComments ?? [])].sort((left, right) => right.length - left.length);
  const blockComments = [...(rules.blockComments ?? [])].sort((left, right) => right[0].length - left[0].length);
  const strings = [...(rules.strings ?? [])].sort((left, right) => right.open.length - left.open.length);
  let index = 0;
  while (index < source.length) {
    const block = blockComments.find(([open]) => source.startsWith(open, index));
    if (block !== undefined) {
      const [open, close] = block;
      let cursor = index + open.length;
      let depth = 1;
      while (cursor < source.length && depth > 0) {
        if (rules.nestedBlockComments === true && source.startsWith(open, cursor)) {
          depth += 1;
          cursor += open.length;
          continue;
        }
        if (source.startsWith(close, cursor)) {
          depth -= 1;
          cursor += close.length;
          continue;
        }
        cursor += 1;
      }
      mask.fill(1, index, cursor);
      index = cursor;
      continue;
    }
    const lineComment = lineComments.find((marker) => source.startsWith(marker, index));
    if (lineComment !== undefined) {
      const newline = source.indexOf('\n', index);
      const end = newline < 0 ? source.length : newline;
      mask.fill(1, index, end);
      index = end;
      continue;
    }
    const stringRule = strings.find((rule) => source.startsWith(rule.open, index));
    if (stringRule !== undefined) {
      let cursor = index + stringRule.open.length;
      while (cursor < source.length) {
        if (source[cursor] === '\\') {
          cursor = Math.min(source.length, cursor + 2);
          continue;
        }
        if (
          stringRule.doubledClose === true
          && source.startsWith(stringRule.close, cursor)
          && source.startsWith(stringRule.close, cursor + stringRule.close.length)
        ) {
          cursor += stringRule.close.length * 2;
          continue;
        }
        if (source.startsWith(stringRule.close, cursor)) {
          cursor += stringRule.close.length;
          break;
        }
        if (stringRule.multiline !== true && source[cursor] === '\n') break;
        cursor += 1;
      }
      mask.fill(2, index, cursor);
      index = Math.max(cursor, index + 1);
      continue;
    }
    index += 1;
  }
  return mask;
}

/** 判断一处命中是否属于当前 IDEA 文本上下文过滤模式。 */
function textSearchContextAllows(mask, offset, length, filter) {
  const mode = normalizeTextSearchContextFilter(filter);
  if (mode === 'anywhere') return true;
  const start = Math.max(0, Math.min(mask.length, Math.floor(Number(offset) || 0)));
  const width = Math.max(1, Math.floor(Number(length) || 0));
  const end = Math.min(mask.length, start + width);
  let hasComment = false;
  let hasString = false;
  let onlyComment = start < end;
  let onlyString = start < end;
  for (let index = start; index < end; index += 1) {
    const value = mask[index];
    if (value === 1) hasComment = true;
    else onlyComment = false;
    if (value === 2) hasString = true;
    else onlyString = false;
  }
  if (mode === 'comments') return onlyComment;
  if (mode === 'strings') return onlyString;
  if (mode === 'exceptComments') return hasComment === false;
  if (mode === 'exceptStrings') return hasString === false;
  return hasComment === false && hasString === false;
}

/**
 * 枚举命中并应用上下文过滤；过滤发生在结果数量上限之前，避免前若干个
 * 注释命中占满预算后，后面的字符串/代码命中完全不可见。
 */
function textSearchMatchRecords(text, query, options = {}) {
  const source = typeof text === 'string' ? text : '';
  const maximum = Number.isFinite(options?.maximum) ? Math.max(0, Math.floor(options.maximum)) : Infinity;
  if (maximum === 0) return [];
  const contextFilter = normalizeTextSearchContextFilter(options?.contextFilter);
  const mask = contextFilter === 'anywhere' ? null : textSearchContextMask(source, options?.path);
  const records = [];
  if (options?.regex instanceof RegExp) {
    const regex = options.regex;
    regex.lastIndex = 0;
    while (records.length < maximum) {
      const match = regex.exec(source);
      if (match === null) break;
      if (mask === null || textSearchContextAllows(mask, match.index, match[0].length, contextFilter)) {
        records.push({ offset: match.index, length: match[0].length });
      }
      if (match[0] === '') {
        const codePoint = source.codePointAt(regex.lastIndex);
        regex.lastIndex += codePoint !== undefined && codePoint > 0xFFFF ? 2 : 1;
      }
    }
    return records;
  }
  for (const offset of literalMatchOffsets(source, query, options?.caseSensitive === true, options?.wholeWords === true)) {
    if (mask === null || textSearchContextAllows(mask, offset, query.length, contextFilter)) {
      records.push({ offset, length: query.length });
      if (records.length >= maximum) break;
    }
  }
  return records;
}

/** 仅替换指定匹配记录的普通文本。 */
function replaceLiteralMatchRecords(text, query, replacement, records, preserveCase) {
  let output = '';
  let cursor = 0;
  for (const record of records) {
    output += text.slice(cursor, record.offset);
    const matched = text.slice(record.offset, record.offset + record.length);
    output += preserveCase === true ? applyPreserveCase(matched, replacement) : replacement;
    cursor = record.offset + record.length;
  }
  output += text.slice(cursor);
  return output;
}

/** 仅替换指定匹配记录的正则文本，保留捕获组与 Preserve case 语义。 */
function replaceRegexMatchRecords(text, regex, replacement, preserveCase, records) {
  const sticky = new RegExp(regex.source, `${regex.flags.replace(/[gy]/gu, '')}y`);
  const single = new RegExp(regex.source, regex.flags.replace(/[gy]/gu, ''));
  let output = text;
  for (let index = records.length - 1; index >= 0; index -= 1) {
    const record = records[index];
    sticky.lastIndex = record.offset;
    const match = sticky.exec(text);
    if (match === null || match.index !== record.offset) continue;
    const expanded = match[0] === '' ? replacement : match[0].replace(single, replacement);
    const replacementText = preserveCase === true ? applyPreserveCase(match[0], expanded) : expanded;
    output = `${output.slice(0, record.offset)}${replacementText}${output.slice(record.offset + match[0].length)}`;
  }
  return output;
}

/**
 * Normalize one browser-supplied workspace-relative scope path.
 *
 * Scope values only filter paths already returned by the workspace walk, but
 * rejecting absolute and parent-traversing forms keeps the request contract
 * explicit and prevents invalid paths from silently behaving like the root.
 * @param {unknown} value - directory or file path.
 * @returns {string|null} normalized path, or null when invalid.
 */
function normalizeWorkspaceScopePath(value) {
  if (value === undefined || value === null) return '';
  if (typeof value !== 'string') return null;
  let path = value.trim().replaceAll('\\', '/');
  if (path === '' || path === '.' || path === '/') return '';
  path = path.replace(/^\.\/+/u, '').replace(/\/+$/u, '');
  if (path.startsWith('/') || path.split('/').some((segment) => segment === '' || segment === '..')) return null;
  return path;
}

/**
 * Materialize optional directory and explicit-path filters for text search.
 * @param {object} options - search options.
 * @returns {{directory: string|null, recursive: boolean, allowedPaths: Set<string>|null}} scope predicate data.
 */
function workspaceSearchScope(options = {}) {
  const directory = normalizeWorkspaceScopePath(options?.directory);
  const recursive = options?.recursive !== false;
  const allowedPaths = Array.isArray(options?.allowedPaths)
    ? new Set(options.allowedPaths
        .slice(0, 5000)
        .map(normalizeWorkspaceScopePath)
        .filter((path) => typeof path === 'string' && path !== ''))
    : null;
  return { directory, recursive, allowedPaths };
}

/**
 * Whether one workspace-relative path participates in a scoped text search.
 * @param {string} path - workspace-relative file path.
 * @param {{directory: string|null, recursive: boolean, allowedPaths: Set<string>|null}} scope - scope data.
 * @returns {boolean} true when the path may be searched.
 */
function workspaceSearchPathMatchesScope(path, scope) {
  if (scope.directory === null) return false;
  if (scope.directory !== '' && path !== scope.directory && !path.startsWith(`${scope.directory}/`)) return false;
  if (scope.recursive === false) {
    const parent = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';
    if (parent !== scope.directory) return false;
  }
  return scope.allowedPaths === null || scope.allowedPaths.has(path);
}

/** Maximum accepted file-mask text and pattern count. */
const FILE_MASK_MAX_LENGTH = 512;
const FILE_MASK_MAX_PATTERNS = 16;

/**
 * Compile one supported IDEA glob into an anchored regular expression.
 * @param {string} pattern - normalized mask without a leading `!`.
 * @returns {RegExp} anchored Unicode matcher.
 */
function compileFileMaskPattern(pattern) {
  if (/[\[\]{}]/u.test(pattern)) {
    throw new Error(`unsupported file mask syntax: ${pattern}`);
  }
  let source = '^';
  for (let index = 0; index < pattern.length; index += 1) {
    const character = pattern[index];
    if (character === '*' && pattern[index + 1] === '*') {
      source += '.*';
      index += 1;
    } else if (character === '*') {
      source += '[^/]*';
    } else if (character === '?') {
      source += '[^/]';
    } else {
      source += character.replace(/[\\^$.*+?()[\]{}|]/gu, '\\$&');
    }
  }
  source += '$';
  return new RegExp(source, 'u');
}

/**
 * Compile comma-separated IDEA file masks, including `!` exclusions.
 *
 * Masks operate only on the workspace-relative path string. They never become
 * filesystem paths or escape the workspace.
 * @param {unknown} value - user mask text.
 * @returns {{matches: (path: string) => boolean}|null} matcher or null when empty.
 */
function compileWorkspaceFileMask(value) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (text === '') return null;
  if (text.length > FILE_MASK_MAX_LENGTH) {
    throw new Error(`file mask is too long (maximum ${FILE_MASK_MAX_LENGTH} characters)`);
  }
  const tokens = text.split(',').map((token) => token.trim()).filter(Boolean);
  if (tokens.length > FILE_MASK_MAX_PATTERNS) {
    throw new Error(`too many file masks (maximum ${FILE_MASK_MAX_PATTERNS})`);
  }
  const rules = tokens.map((token) => {
    const excluded = token.startsWith('!');
    const pattern = (excluded ? token.slice(1) : token).trim().replace(/\\/gu, '/').replace(/^\.\//u, '');
    if (pattern === '') throw new Error(`invalid file mask: ${token}`);
    return {
      excluded,
      basenameOnly: !pattern.includes('/'),
      regex: compileFileMaskPattern(pattern),
    };
  });
  const inclusions = rules.filter((rule) => !rule.excluded);
  const exclusions = rules.filter((rule) => rule.excluded);
  return {
    matches(relativePath) {
      const path = String(relativePath).replace(/\\/gu, '/').replace(/^\.\//u, '');
      const name = path.slice(path.lastIndexOf('/') + 1);
      const applies = (rule) => rule.regex.test(rule.basenameOnly ? name : path);
      if (inclusions.length > 0 && !inclusions.some(applies)) return false;
      return !exclusions.some(applies);
    },
  };
}

/**
 * Convert IDEA's one-based line/column into one JavaScript string offset.
 * @param {string} text - file content.
 * @param {unknown} line - one-based line number.
 * @param {unknown} column - one-based character column.
 * @returns {number|null} zero-based offset, or null when outside the file.
 */
function lineColumnOffset(text, line, column) {
  const targetLine = Number(line);
  const targetColumn = Number(column);
  if (
    !Number.isInteger(targetLine)
    || targetLine < 1
    || !Number.isInteger(targetColumn)
    || targetColumn < 1
  ) return null;
  let lineStart = 0;
  for (let currentLine = 1; currentLine < targetLine; currentLine += 1) {
    const newline = text.indexOf('\n', lineStart);
    if (newline < 0) return null;
    lineStart = newline + 1;
  }
  const newline = text.indexOf('\n', lineStart);
  const lineEnd = newline < 0 ? text.length : newline;
  const offset = lineStart + targetColumn - 1;
  return offset <= lineEnd ? offset : null;
}

/**
 * Adapt one replacement to the casing of the text it replaces.
 *
 * IDEA exposes this as "Preserve case": all-uppercase and all-lowercase matches
 * force the replacement's casing, a capitalized match capitalizes the first
 * replacement character, and mixed casing keeps the user's replacement as typed.
 * @param {string} matched - source text being replaced.
 * @param {string} replacement - expanded replacement for this match.
 * @returns {string} replacement with the matched casing applied.
 */
function applyPreserveCase(matched, replacement) {
  const text = String(matched ?? '');
  const output = String(replacement ?? '');
  if (text === '' || output === '') return output;
  const upper = text === text.toUpperCase() && text !== text.toLowerCase();
  const lower = text === text.toLowerCase() && text !== text.toUpperCase();
  if (upper) return output.toUpperCase();
  if (lower) return output.toLowerCase();
  if (/^[A-Z]/u.test(text)) return output.charAt(0).toUpperCase() + output.slice(1);
  return output;
}

/**
 * Replace every literal occurrence while preserving surrounding text.
 * @param {string} text - source text.
 * @param {string} query - non-empty query.
 * @param {string} replacement - replacement text.
 * @param {boolean} caseSensitive - smart-case decision.
 * @param {boolean} [wholeWords=false] - require Unicode word boundaries.
 * @param {boolean} [preserveCase=false] - follow each matched occurrence's casing.
 * @returns {{text: string, count: number}} rewritten text and replacement count.
 */
function replaceLiteralOccurrences(text, query, replacement, caseSensitive, wholeWords = false, preserveCase = false) {
  const offsets = literalMatchOffsets(text, query, caseSensitive, wholeWords);
  if (offsets.length === 0) return { text, count: 0 };
  let output = '';
  let cursor = 0;
  for (const offset of offsets) {
    output += text.slice(cursor, offset);
    const matched = text.slice(offset, offset + query.length);
    output += preserveCase ? applyPreserveCase(matched, replacement) : replacement;
    cursor = offset + query.length;
  }
  output += text.slice(cursor);
  return { text: output, count: offsets.length };
}

/**
 * Expand native JavaScript replacement tokens per match, then optionally adapt
 * the expanded text to the match's casing. Expansion happens before casing so
 * capture groups are treated as part of the user's replacement, matching IDEA.
 * @param {string} text - complete source text.
 * @param {RegExp} regex - global Unicode matcher.
 * @param {string} replacement - replacement template.
 * @param {boolean} preserveCase - whether to follow the matched casing.
 * @returns {string} rewritten text.
 */
function replaceRegexMatches(text, regex, replacement, preserveCase) {
  if (preserveCase !== true) return text.replace(regex, replacement);
  const single = new RegExp(regex.source, regex.flags.replace(/[gy]/gu, ''));
  return text.replace(regex, (matched) => {
    const expanded = matched === '' ? replacement : matched.replace(single, replacement);
    return applyPreserveCase(matched, expanded);
  });
}

/**
 * Search file contents without walking heavy dependency/build trees twice.
 *
 * Search Everywhere's Text tab is a navigation surface, not a full index: the
 * existing quick-open walk supplies candidates, individual files are capped at
 * 1 MiB, NUL-containing files are skipped, and matches stop at a fixed ceiling.
 * @param {string} root - workspace root.
 * @param {unknown} query - literal user query.
 * @param {{caseSensitive?: boolean, wholeWords?: boolean, regex?: boolean, fileMask?: string, maxMatches?: number, includeExcluded?: boolean, directory?: string, allowedPaths?: string[], gitScope?: string, dirtyPaths?: string[], contextFilter?: string, scopeIncludePatterns?: string[], scopeExcludePatterns?: string[]}} [options] - search controls, lexical filter and scope.
 * @returns {Promise<{matches: object[], truncated: boolean, visitedFiles: number, dirtyPaths?: string[]}>} text hits.
 */
async function searchWorkspaceText(root, query, options = {}) {
  const needle = typeof query === 'string' ? query : '';
  if (needle === '') return { matches: [], truncated: false, visitedFiles: 0 };
  const maxMatches = Math.max(1, Math.min(500, Number(options?.maxMatches) || 200));
  const caseSensitive = smartCaseSensitive(needle, options);
  const wholeWords = options?.wholeWords === true;
  const useRegex = options?.regex === true;
  const regex = useRegex ? compileWorkspaceRegex(needle, caseSensitive) : null;
  const fileMask = compileWorkspaceFileMask(options?.fileMask);
  const includeExcluded = options?.includeExcluded === true;
  const contextFilter = normalizeTextSearchContextFilter(options?.contextFilter);
  const scope = workspaceSearchScope(options);
  if (scope.directory === null) return { matches: [], truncated: false, visitedFiles: 0 };
  const gitListing = await listGitSearchScopeFiles(root, options?.gitScope);
  const listing = gitListing !== null
    ? gitListing
    : scope.allowedPaths === null
      ? await listWorkspaceFiles(root, includeExcluded ? 5000 : 2000, {
          includeExcluded,
          directory: scope.directory,
          recursive: scope.recursive,
        })
      : { files: [...scope.allowedPaths], truncated: false };
  const dirtyPaths = gitListing === null
    ? undefined
    : [...new Set((Array.isArray(options?.dirtyPaths) ? options.dirtyPaths : [])
        .filter((path) => typeof path === 'string' && path !== ''))]
        .filter((path) => gitListing.files.includes(path) && workspaceSearchPathMatchesScope(path, scope))
        .slice(0, 5000);
  const matches = [];
  let truncated = listing.truncated;
  let visitedFiles = 0;
  for (const relativePath of listing.files) {
    if (matches.length >= maxMatches) {
      truncated = true;
      break;
    }
    if (!workspaceSearchPathMatchesScope(relativePath, scope)) continue;
    if (!workspaceScopePatternsMatch(relativePath, options?.scopeIncludePatterns, options?.scopeExcludePatterns)) continue;
    if (fileMask !== null && !fileMask.matches(relativePath)) continue;
    const file = resolveInside(root, relativePath);
    const info = await stat(file).catch(() => null);
    if (info === null || !info.isFile() || info.size > TEXT_SEARCH_MAX_FILE_BYTES) continue;
    const buffer = await readFile(file).catch(() => null);
    if (buffer === null || buffer.includes(0)) continue;
    visitedFiles += 1;
    const content = buffer.toString('utf8');
    const remaining = Math.max(0, maxMatches - matches.length);
    const records = textSearchMatchRecords(content, needle, {
      regex,
      caseSensitive,
      wholeWords,
      maximum: remaining,
      path: relativePath,
      contextFilter,
    });
    if (records.length === 0) continue;
    const lineStarts = [0];
    for (let index = 0; index < content.length; index += 1) {
      if (content[index] === '\n') lineStarts.push(index + 1);
    }
    let lineIndex = 0;
    for (const record of records) {
      const matchOffset = record.offset;
      while (lineIndex + 1 < lineStarts.length && lineStarts[lineIndex + 1] <= matchOffset) lineIndex += 1;
      const lineStart = lineStarts[lineIndex];
      const lineEnd = lineStarts[lineIndex + 1] === undefined ? content.length : lineStarts[lineIndex + 1] - 1;
      const preview = content.slice(lineStart, lineEnd).replace(/\r$/u, '');
      matches.push({
        path: relativePath,
        line: lineIndex + 1,
        column: matchOffset - lineStart + 1,
        preview: preview.length > 220 ? `${preview.slice(0, 217)}…` : preview,
        mtime: info.mtimeMs,
      });
      if (matches.length >= maxMatches) {
        truncated = true;
        break;
      }
    }
  }
  return {
    matches,
    truncated,
    visitedFiles,
    ...(dirtyPaths === undefined ? {} : { dirtyPaths }),
  };
}

/**
 * Commit preflighted text replacements as one rollback-capable transaction.
 *
 * Multiple files cannot be renamed atomically on a general filesystem. The
 * next best guarantee is to restore every attempted file to its original
 * content if any write fails, so a failed Replace All does not leave a partial
 * clean-file rewrite behind. Dirty Monaco models are still applied by the
 * client only after this function succeeds.
 * @param {string} root - workspace root.
 * @param {Array<{relativePath: string, content: string, originalContent: string, count: number, expectedMtime?: number}>} staged - preflighted writes.
 * @param {Function} [writer=writeTextFileGuarded] - write boundary, injectable for tests.
 * @returns {Promise<{changedFiles: number, replacements: number, files: string[]}>} transaction summary.
 */
async function commitWorkspaceReplacements(root, staged, writer = writeTextFileGuarded) {
  const entries = Array.isArray(staged) ? staged : [];
  const attempted = [];
  try {
    for (const entry of entries) {
      attempted.push(entry);
      await writer(root, entry.relativePath, entry.content, entry.expectedMtime, false);
    }
  } catch (failure) {
    const primary = failure instanceof Error ? failure : new Error(String(failure));
    const rollbackFailures = [];
    for (const entry of [...attempted].reverse()) {
      try {
        await writer(root, entry.relativePath, entry.originalContent, undefined, true);
      } catch (rollbackFailure) {
        rollbackFailures.push({
          path: entry.relativePath,
          message: rollbackFailure instanceof Error ? rollbackFailure.message : String(rollbackFailure),
        });
      }
    }
    if (rollbackFailures.length > 0) {
      primary.message += `; rollback failed for ${rollbackFailures.map((item) => item.path).join(', ')}`;
      primary.rollbackFailures = rollbackFailures;
    }
    throw primary;
  }
  return {
    changedFiles: entries.length,
    replacements: entries.reduce((total, entry) => total + Math.max(0, Number(entry.count) || 0), 0),
    files: entries.map((entry) => entry.relativePath),
  };
}

/** Replace history: 20 operations and 16 MiB per workspace, LRU by age. */
const REPLACE_HISTORY_MAX_OPERATIONS = 20;
const REPLACE_HISTORY_MAX_BYTES = 16 * 1024 * 1024;
const REPLACE_HISTORY_MAX_WORKSPACES = 64;
const workspaceReplaceHistories = new Map();

/** Read one workspace's undo/redo operation stacks. */
function replaceHistoryFor(root) {
  const existing = workspaceReplaceHistories.get(root);
  if (existing !== undefined) return existing;
  if (workspaceReplaceHistories.size >= REPLACE_HISTORY_MAX_WORKSPACES) {
    workspaceReplaceHistories.delete(workspaceReplaceHistories.keys().next().value);
  }
  const history = { undo: [], redo: [], bytes: 0 };
  workspaceReplaceHistories.set(root, history);
  return history;
}

/** Clear redo without leaving its evicted byte cost in the workspace budget. */
function clearReplaceHistoryRedo(history) {
  for (const operation of history.redo) history.bytes = Math.max(0, history.bytes - operation.bytes);
  history.redo = [];
}

/** Trim the oldest operations until count and byte budgets are satisfied. */
function trimReplaceHistory(history) {
  while (
    history.undo.length + history.redo.length > REPLACE_HISTORY_MAX_OPERATIONS
    || history.bytes > REPLACE_HISTORY_MAX_BYTES
  ) {
    const removed = history.undo.length > 0 ? history.undo.shift() : history.redo.shift();
    if (removed === undefined) break;
    history.bytes = Math.max(0, history.bytes - removed.bytes);
  }
}

/** 在成功 Replace 后追加 bounded clean undo operation。 */
async function rememberWorkspaceReplaceUndo(root, staged) {
  const entries = Array.isArray(staged) ? staged : [];
  if (entries.length === 0) return null;
  let operationBytes = 0;
  const files = [];
  for (const entry of entries) {
    const file = resolveInside(root, entry.relativePath);
    const info = await stat(file).catch(() => null);
    if (info === null || !info.isFile()) return null;
    const originalContent = String(entry.originalContent ?? '');
    const afterContent = String(entry.content ?? '');
    operationBytes += Buffer.byteLength(originalContent, 'utf8') + Buffer.byteLength(afterContent, 'utf8');
    files.push({
      relativePath: entry.relativePath,
      originalContent,
      afterContent,
      expectedMtime: info.mtimeMs,
      count: Math.max(0, Number(entry.count) || 0),
    });
  }
  if (operationBytes > REPLACE_HISTORY_MAX_BYTES) return null;
  const history = replaceHistoryFor(root);
  const operation = {
    id: randomUUID(),
    files,
    bytes: operationBytes,
    createdAt: Date.now(),
  };
  clearReplaceHistoryRedo(history);
  history.undo.push(operation);
  history.bytes += operation.bytes;
  trimReplaceHistory(history);
  return history.undo.some((entry) => entry.id === operation.id) ? operation.id : null;
}

/**
 * Undo the latest clean-file replacement for one workspace.
 *
 * The undo snapshot never leaves the host. Before any write, every current
 * file must still equal the exact post-replace content; an external edit turns
 * the request into a conflict rather than being overwritten.
 */
async function undoLastWorkspaceReplacement(root, operationId = '') {
  const history = replaceHistoryFor(root);
  const operation = history.undo.at(-1);
  if (operation === undefined) {
    const error = new Error('there is no recent replacement to undo');
    error.code = 'dsh-editor/no-undo';
    throw error;
  }
  if (typeof operationId === 'string' && operationId !== '' && operation.id !== operationId) {
    const error = new Error('replacement history changed before undo');
    error.code = 'dsh-editor/conflict';
    throw error;
  }
  const staged = [];
  for (const entry of operation.files) {
    const file = resolveInside(root, entry.relativePath);
    const info = await stat(file).catch(() => null);
    if (info === null || !info.isFile()) {
      const error = new Error(`cannot undo because the file no longer exists: ${entry.relativePath}`);
      error.code = 'dsh-editor/conflict';
      throw error;
    }
    const buffer = await readFile(file).catch(() => null);
    if (buffer === null || buffer.includes(0) || buffer.toString('utf8') !== entry.afterContent) {
      const error = new Error(`cannot undo because the file changed after replacement: ${entry.relativePath}`);
      error.code = 'dsh-editor/conflict';
      throw error;
    }
    staged.push({
      relativePath: entry.relativePath,
      content: entry.originalContent,
      originalContent: entry.afterContent,
      count: entry.count,
      expectedMtime: info.mtimeMs,
    });
  }
  const summary = await commitWorkspaceReplacements(root, staged);
  history.undo.pop();
  history.redo.push(operation);
  return summary;
}

/** Redo the latest Undo Last Replace operation for one workspace. */
async function redoLastWorkspaceReplacement(root, operationId = '') {
  const history = replaceHistoryFor(root);
  const operation = history.redo.at(-1);
  if (operation === undefined) {
    const error = new Error('there is no recent replacement to redo');
    error.code = 'dsh-editor/no-redo';
    throw error;
  }
  if (typeof operationId === 'string' && operationId !== '' && operation.id !== operationId) {
    const error = new Error('replacement history changed before redo');
    error.code = 'dsh-editor/conflict';
    throw error;
  }
  const staged = [];
  for (const entry of operation.files) {
    const file = resolveInside(root, entry.relativePath);
    const info = await stat(file).catch(() => null);
    if (info === null || !info.isFile()) {
      const error = new Error(`cannot redo because the file no longer exists: ${entry.relativePath}`);
      error.code = 'dsh-editor/conflict';
      throw error;
    }
    const buffer = await readFile(file).catch(() => null);
    if (buffer === null || buffer.includes(0) || buffer.toString('utf8') !== entry.originalContent) {
      const error = new Error(`cannot redo because the file changed after undo: ${entry.relativePath}`);
      error.code = 'dsh-editor/conflict';
      throw error;
    }
    staged.push({
      relativePath: entry.relativePath,
      content: entry.afterContent,
      originalContent: entry.originalContent,
      count: entry.count,
      expectedMtime: info.mtimeMs,
    });
  }
  const summary = await commitWorkspaceReplacements(root, staged);
  history.redo.pop();
  history.undo.push(operation);
  return summary;
}

/**
 * Replace one literal query across explicitly selected search-result files.
 *
 * The file list comes from a prior search, never from the browser's whole disk.
 * Every target is preflighted against its searched mtime before the first write,
 * so an external edit cannot be silently clobbered. This is intentionally not a
 * source-control rewrite: it edits working-tree text only.
 * @param {string} root - workspace root.
 * @param {unknown} query - literal query.
 * @param {unknown} replacement - replacement text.
 * @param {unknown} targets - [{path, mtime}] from search results.
 * @param {{caseSensitive?: boolean, wholeWords?: boolean, regex?: boolean, preserveCase?: boolean, fileMask?: string, occurrence?: {line?: number, column?: number}, contextFilter?: string, scopeIncludePatterns?: string[], scopeExcludePatterns?: string[]}} [options] - matching, lexical filter and optional exact occurrence.
 * @returns {Promise<{changedFiles: number, replacements: number, files: string[], operationId?: string}>} write summary.
 */
async function replaceWorkspaceText(root, query, replacement, targets, options = {}) {
  const needle = typeof query === 'string' ? query : '';
  const next = typeof replacement === 'string' ? replacement : '';
  if (needle === '') throw new Error('enter text to replace');
  if (!Array.isArray(targets) || targets.length === 0) throw new Error('select at least one search result');
  const caseSensitive = smartCaseSensitive(needle, options);
  const wholeWords = options?.wholeWords === true;
  const useRegex = options?.regex === true;
  const preserveCase = options?.preserveCase === true;
  const regex = useRegex ? compileWorkspaceRegex(needle, caseSensitive) : null;
  const fileMask = compileWorkspaceFileMask(options?.fileMask);
  const contextFilter = normalizeTextSearchContextFilter(options?.contextFilter);
  const occurrence = options?.occurrence === undefined || options?.occurrence === null
    ? null
    : {
        line: Number(options.occurrence.line),
        column: Number(options.occurrence.column),
      };
  if (
    occurrence !== null
    && (!Number.isInteger(occurrence.line) || occurrence.line < 1 || !Number.isInteger(occurrence.column) || occurrence.column < 1)
  ) {
    throw new Error('invalid search occurrence');
  }
  const unique = new Map();
  for (const target of targets.slice(0, 200)) {
    const relativePath = typeof target?.path === 'string' ? target.path : '';
    if (relativePath === '') throw new Error('invalid search target');
    resolveInside(root, relativePath);
    if (!workspaceScopePatternsMatch(relativePath, options?.scopeIncludePatterns, options?.scopeExcludePatterns)) {
      throw new Error(`target is outside custom scope: ${relativePath}`);
    }
    if (fileMask !== null && !fileMask.matches(relativePath)) {
      throw new Error(`target does not match file mask: ${relativePath}`);
    }
    unique.set(relativePath, Number(target?.mtime));
  }
  if (occurrence !== null && unique.size !== 1) {
    throw new Error('single replacement requires one search target');
  }
  const staged = [];
  for (const [relativePath, expectedMtime] of unique) {
    const file = resolveInside(root, relativePath);
    const info = await stat(file).catch(() => null);
    if (info === null || !info.isFile()) throw new Error(`file does not exist: ${relativePath}`);
    if (info.size > TEXT_SEARCH_MAX_FILE_BYTES) throw new Error(`file is too large to replace: ${relativePath}`);
    if (Number.isFinite(expectedMtime) && Math.abs(info.mtimeMs - expectedMtime) > 1) {
      const error = new Error(`the file changed on disk since it was searched: ${relativePath}`);
      error.code = 'dsh-editor/conflict';
      throw error;
    }
    const buffer = await readFile(file).catch(() => null);
    if (buffer === null || buffer.includes(0)) throw new Error(`file is not searchable text: ${relativePath}`);
    const content = buffer.toString('utf8');
    let rewritten;
    if (regex !== null && occurrence === null) {
      const records = textSearchMatchRecords(content, needle, {
        regex,
        caseSensitive,
        wholeWords,
        maximum: Infinity,
        path: relativePath,
        contextFilter,
      });
      rewritten = records.length === 0
        ? { text: content, count: 0 }
        : {
            text: contextFilter === 'anywhere'
              ? replaceRegexMatches(content, regex, next, preserveCase)
              : replaceRegexMatchRecords(content, regex, next, preserveCase, records),
            count: records.length,
          };
    } else if (regex !== null) {
      const offset = lineColumnOffset(content, occurrence.line, occurrence.column);
      const sticky = compileWorkspaceRegex(needle, caseSensitive, 'sticky');
      sticky.lastIndex = offset ?? 0;
      const match = offset === null ? null : sticky.exec(content);
      if (
        match === null
        || match.index !== offset
        || !textSearchContextAllows(textSearchContextMask(content, relativePath), offset, match[0].length, contextFilter)
      ) {
        const error = new Error(`search result no longer matches: ${relativePath}:${occurrence.line}:${occurrence.column}`);
        error.code = 'dsh-editor/conflict';
        throw error;
      }
      sticky.lastIndex = offset;
      const single = new RegExp(sticky.source, sticky.flags.replace(/[gy]/gu, ''));
      const expanded = match[0] === '' ? next : match[0].replace(single, next);
      const replacementText = preserveCase ? applyPreserveCase(match[0], expanded) : expanded;
      rewritten = {
        text: `${content.slice(0, offset)}${replacementText}${content.slice(offset + match[0].length)}`,
        count: 1,
      };
    } else if (occurrence === null) {
      const records = textSearchMatchRecords(content, needle, {
        regex: null,
        caseSensitive,
        wholeWords,
        maximum: Infinity,
        path: relativePath,
        contextFilter,
      });
      rewritten = records.length === 0
        ? { text: content, count: 0 }
        : {
            text: contextFilter === 'anywhere'
              ? replaceLiteralOccurrences(content, needle, next, caseSensitive, wholeWords, preserveCase).text
              : replaceLiteralMatchRecords(content, needle, next, records, preserveCase),
            count: records.length,
          };
    } else {
      const offset = lineColumnOffset(content, occurrence.line, occurrence.column);
      const actual = offset === null ? null : content.slice(offset, offset + needle.length);
      const matches = actual !== null
        && (caseSensitive ? actual === needle : actual.toLowerCase() === needle.toLowerCase())
        && (!wholeWords || isWholeWordMatch(content, needle, offset))
        && textSearchContextAllows(textSearchContextMask(content, relativePath), offset, needle.length, contextFilter);
      if (!matches) {
        const error = new Error(`search result no longer matches: ${relativePath}:${occurrence.line}:${occurrence.column}`);
        error.code = 'dsh-editor/conflict';
        throw error;
      }
      rewritten = {
        text: `${content.slice(0, offset)}${preserveCase ? applyPreserveCase(actual, next) : next}${content.slice(offset + needle.length)}`,
        count: 1,
      };
    }
    if (rewritten.count > 0) staged.push({
      relativePath,
      content: rewritten.text,
      originalContent: content,
      count: rewritten.count,
      expectedMtime: Number.isFinite(expectedMtime) ? expectedMtime : undefined,
    });
  }
  const summary = await commitWorkspaceReplacements(root, staged);
  const operationId = await rememberWorkspaceReplaceUndo(root, staged);
  return operationId === null ? summary : { ...summary, operationId };
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
  const raw = await runGit(root, ['log', `-n${count}`, `--skip=${offset}`, ...authorArgs, '--pretty=format:%H%x1f%an%x1f%aI%x1f%s%x1f%P%x1e']);
  return raw
    .split('\u001e')
    .map((record) => record.trim())
    .filter((record) => record !== '')
    .map((record) => {
      const [hash = '', author = '', date = '', subject = '', parents = ''] = record.split('\u001f');
      return {
        hash,
        author,
        date,
        subject,
        parents: parents === '' ? [] : parents.split(' ').filter((parent) => parent !== ''),
      };
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
 * Build one read-only comparison containing several selected working changes.
 *
 * IDEA's combined diff keeps every file in one place. This implementation reuses
 * the single-file comparison as the only source of each side, then inserts an
 * identical heading into both documents so Monaco never mistakes the separator
 * for a content change. Binary files use an identical placeholder because their
 * bytes cannot be rendered as text.
 *
 * @param {string} root - workspace root.
 * @param {string} prefix - repository prefix of the workspace root.
 * @param {{entries?: Array<{path: string, staged?: boolean, heading?: string}>}} input - selected changes.
 * @returns {Promise<object>} aggregate diff payload.
 */
async function gitCombinedDiff(root, prefix, input) {
  const entries = (Array.isArray(input?.entries) ? input.entries : [])
    .filter((entry) => entry !== null && typeof entry?.path === 'string' && entry.path !== '');
  if (entries.length === 0) throw new Error('at least one path is required');
  if (entries.length > 100) throw new Error('combined diff supports at most 100 files');
  const original = [];
  const modified = [];
  const files = [];
  let originalLine = 1;
  let modifiedLine = 1;
  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index];
    const originalRevision = typeof entry.originalRevision === 'string' && entry.originalRevision.trim() !== ''
      ? entry.originalRevision.trim()
      : '';
    const modifiedRevision = typeof entry.modifiedRevision === 'string' && entry.modifiedRevision.trim() !== ''
      ? entry.modifiedRevision.trim()
      : '';
    const revision = typeof entry.revision === 'string' && entry.revision.trim() !== ''
      ? entry.revision.trim()
      : '';
    const value = originalRevision !== '' && modifiedRevision !== ''
      ? await gitDiffBetweenRevisions(root, prefix, originalRevision, modifiedRevision, entry.path)
      : revision !== ''
        ? await gitDiffAtRevisionAgainstWorkingCopy(root, prefix, revision, entry.path, true)
        : await gitDiff(root, prefix, entry);
    const side = originalRevision !== '' && modifiedRevision !== ''
      ? `commit ${originalRevision.slice(0, 7)} -> ${modifiedRevision.slice(0, 7)}`
      : revision !== ''
        ? `commit ${revision.slice(0, 7)} -> local`
        : value.staged ? 'staged' : 'working tree';
    const heading = typeof entry.heading === 'string' && entry.heading !== ''
      ? entry.heading
      : `${value.path} (${side})`;
    const separator = `===== ${index + 1}/${entries.length} ${heading} =====\n`;
    const binaryPlaceholder = '[binary file: content omitted]\n';
    const originalBody = value.binary ? binaryPlaceholder : value.original;
    const modifiedBody = value.binary ? binaryPlaceholder : value.modified;
    const originalChunk = `${separator}${originalBody}${originalBody.endsWith('\n') ? '\n' : '\n\n'}`;
    const modifiedChunk = `${separator}${modifiedBody}${modifiedBody.endsWith('\n') ? '\n' : '\n\n'}`;
    original.push(originalChunk);
    modified.push(modifiedChunk);
    files.push({
      path: value.path,
      staged: value.staged,
      binary: value.binary,
      missing: value.missing,
      headExists: value.headExists,
      originalLine,
      originalEndLine: originalLine + (originalChunk.match(/\n/gu) ?? []).length - 1,
      line: modifiedLine,
      endLine: modifiedLine + (modifiedChunk.match(/\n/gu) ?? []).length - 1,
    });
    originalLine += (originalChunk.match(/\n/gu) ?? []).length;
    modifiedLine += (modifiedChunk.match(/\n/gu) ?? []).length;
  }
  return {
    combined: true,
    files,
    original: original.join(''),
    modified: modified.join(''),
    binary: false,
    missing: false,
  };
}

/**
 * Create a clipboard-ready patch for selected changes without modifying the index.
 *
 * Tracked staged and working-tree changes use git's native diff formats.
 * Untracked files use `--no-index /dev/null <path>` so no intent-to-add entry is
 * written. `git diff --no-index` exits with 1 when differences exist; that exit
 * is valid here because stdout already contains the patch.
 *
 * @param {string} root - workspace root.
 * @param {string} prefix - repository prefix of the workspace root.
 * @param {{entries?: Array<{path: string, staged?: boolean}>}} input - selected changes.
 * @returns {Promise<{patch: string, files: object[]}>} patch text and included identities.
 */
async function gitSelectedPatch(root, prefix, input) {
  const entries = (Array.isArray(input?.entries) ? input.entries : [])
    .filter((entry) => entry !== null && typeof entry?.path === 'string' && entry.path !== '');
  if (entries.length === 0) throw new Error('at least one path is required');
  if (entries.length > 100) throw new Error('patch supports at most 100 files');
  const status = await gitStatus(root);
  const statusByPath = new Map((status?.changes ?? []).map((change) => [change.path, change]));
  const seen = new Set();
  const parts = [];
  const files = [];
  for (const entry of entries) {
    const relativePath = entry.path;
    const staged = entry.staged === true;
    const identity = `${staged ? 'staged' : 'unstaged'}:${relativePath}`;
    if (seen.has(identity)) continue;
    seen.add(identity);
    resolveInside(root, relativePath);
    const repositoryPath = `${prefix}${relativePath}`;
    const args = staged
      ? ['diff', '--cached', '--no-color', '--no-ext-diff', '--binary', '--', repositoryPath]
      : statusByPath.get(relativePath)?.status === '??'
        ? ['diff', '--no-index', '--no-color', '--no-ext-diff', '--binary', '--', '/dev/null', relativePath]
        : ['diff', '--no-color', '--no-ext-diff', '--binary', '--', repositoryPath];
    let output = '';
    try {
      output = await runGit(root, args);
    } catch (error) {
      if (error?.code === 1 && typeof error.stdout === 'string' && error.stdout !== '') output = error.stdout;
      else throw error;
    }
    if (output.trim() === '') continue;
    parts.push(output.endsWith('\n') ? output : `${output}\n`);
    files.push({ path: relativePath, staged });
  }
  if (parts.length === 0) throw new Error('the selected changes produced an empty patch');
  return { patch: parts.join('\n'), files };
}

/**
 * Create an IDEA-style patch file for one commit without touching repository state.
 *
 * `git format-patch` is the canonical producer for a portable, mail-formatted
 * commit patch. It preserves commit metadata and binary changes, while
 * `--stdout` keeps the operation read-only. The UI only needs the patch text
 * plus the resolved hash and subject for a stable download name.
 *
 * @param {string} root - workspace root.
 * @param {string} hash - commit revision from the log.
 * @returns {Promise<{patch: string, hash: string, subject: string}>} commit patch and identity.
 */
async function gitCommitPatch(root, hash) {
  const requested = typeof hash === 'string' ? hash.trim() : '';
  const revision = requireRevision(requested);
  let resolved;
  try {
    resolved = (await runGit(root, ['rev-parse', '--verify', `${revision}^{commit}`])).trim();
  } catch {
    throw new Error(`no such commit: ${requested}`);
  }
  if (resolved === '') throw new Error(`no such commit: ${requested}`);
  const output = await runGit(root, [
    'format-patch',
    '-1',
    '--stdout',
    '--binary',
    '--no-signature',
    '--no-color',
    resolved,
  ]);
  if (output.trim() === '') throw new Error('the commit produced an empty patch');
  const subject = (await runGit(root, ['log', '-1', '--pretty=format:%s', resolved])).trim();
  return {
    patch: output.endsWith('\n') ? output : `${output}\n`,
    hash: resolved,
    subject,
  };
}

/**
 * Apply one unified patch to the workspace without staging it.
 *
 * IDEA's Apply Patch command saves documents, validates the patch and applies it
 * atomically. Git already provides that transaction boundary: `--numstat` keeps
 * the patch read-only and scopes it to paths under the workspace, `--check`
 * validates every hunk, and plain `git apply` is atomic without `--reject` or
 * `--3way`. The patch is written to a private temporary file because Node's
 * promisified `execFile` has no stdin option.
 * @param {string} root - workspace root.
 * @param {string} prefix - repository prefix of the workspace root.
 * @param {{patch?: string}} input - unified diff text.
 * @returns {Promise<object>} applied workspace paths and refreshed git status.
 */
async function gitApplyPatch(root, prefix, input) {
  const rawPatch = typeof input?.patch === 'string' ? input.patch : '';
  if (rawPatch.trim() === '') throw new Error('patch is empty');
  if (rawPatch.includes('\0')) throw new Error('patch contains NUL bytes');
  /* Clipboard/file sources commonly drop the final newline; unified diffs still
     need it for Git to read the last hunk terminator. */
  const patch = rawPatch.endsWith('\n') ? rawPatch : `${rawPatch}\n`;
  if (Buffer.byteLength(patch, 'utf8') > MAX_TEXT_BYTES) throw new Error('patch is too large (maximum 4 MiB)');
  const tempDirectory = await mkdtemp(join(tmpdir(), 'dsh-editor-apply-patch-'));
  const patchPath = join(tempDirectory, 'change.patch');
  try {
    await writeFile(patchPath, patch, 'utf8');
    const stats = parseNumstat(
      await runGit(root, ['apply', '--numstat', '-z', '--whitespace=nowarn', patchPath]).catch((error) => {
        throw new Error(`patch preflight failed: ${describeGitError(error)}`);
      }),
    );
    if (stats.size === 0) throw new Error('the patch does not touch files in this workspace');
    if (stats.size > 200) throw new Error('applyPatch supports at most 200 files');
    await runGit(root, ['apply', '--check', '--whitespace=nowarn', patchPath]).catch((error) => {
      throw new Error(`patch preflight failed: ${describeGitError(error)}`);
    });
    await runGit(root, ['apply', '--whitespace=nowarn', patchPath]).catch((error) => {
      throw new Error(`patch apply failed: ${describeGitError(error)}`);
    });
    const appliedFiles = [...stats.keys()].map((path) => (
      prefix !== '' && path.startsWith(prefix) ? path.slice(prefix.length) : path
    ));
    return { appliedFiles, ...(await gitStatus(root)) };
  } finally {
    await rm(tempDirectory, { recursive: true, force: true });
  }
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
  return gitDiffAtRevisionAgainstWorkingCopy(root, prefix, hash, relativePath, false);
}

/**
 * Read one file as it existed at a commit for IDEA's repository-version tab.
 *
 * Unlike Compare with Revision, this returns only the selected revision's
 * content and never reads the working copy. A path absent at that revision is
 * an error, because opening an empty tab would falsely claim the file existed.
 *
 * @param {string} root - workspace root.
 * @param {string} prefix - repository prefix of the workspace root.
 * @param {{hash: string, path: string}} input - revision and workspace-relative file.
 * @returns {Promise<{path: string, hash: string, content: string, binary: boolean}>} read-only content.
 */
async function gitRepositoryVersion(root, prefix, input) {
  const hash = typeof input?.hash === 'string' ? input.hash.trim() : '';
  const relativePath = typeof input?.path === 'string' ? input.path : '';
  const revision = requireRevision(hash);
  if (relativePath === '') throw new Error('a path is required');
  resolveInside(root, relativePath);
  const content = await gitBlobMaybe(root, revision, `${prefix}${relativePath}`);
  if (content === null) throw new Error('that revision does not contain this file');
  if (Buffer.byteLength(content, 'utf8') > MAX_TEXT_BYTES) throw new Error('file is larger than the 4 MiB editor limit');
  return {
    path: relativePath,
    hash: revision,
    content,
    binary: content.includes('\u0000'),
  };
}

/**
 * Read one revision side and the current working-copy side.
 *
 * A commit aggregate may contain a path that is absent at that revision, for
 * example a deletion commit. That case must remain an empty side instead of
 * aborting the whole comparison; the single-file Compare with Revision action
 * keeps its stricter behavior.
 *
 * @param {string} root - workspace root.
 * @param {string} prefix - repository prefix of the workspace root.
 * @param {string} hash - commit-ish to read.
 * @param {string} relativePath - workspace-relative path.
 * @param {boolean} allowMissingRevision - use '' when absent at the revision.
 * @returns {Promise<object>} diff payload.
 */
async function gitDiffAtRevisionAgainstWorkingCopy(root, prefix, hash, relativePath, allowMissingRevision) {
  const revision = requireRevision(hash);
  const file = resolveInside(root, relativePath);
  const originalValue = await gitBlobMaybe(root, revision, `${prefix}${relativePath}`);
  if (originalValue === null && allowMissingRevision !== true) throw new Error('that revision does not contain this file');
  const original = originalValue ?? '';
  const info = await stat(file).catch(() => null);
  const modified = info !== null && info.isFile() && info.size <= MAX_TEXT_BYTES
    ? await readFile(file, 'utf8').catch(() => '')
    : '';
  return {
    path: relativePath,
    commit: revision,
    staged: false,
    original,
    modified,
    binary: original.includes('\u0000') || modified.includes('\u0000'),
    missing: info === null,
    headExists: originalValue !== null,
  };
}

/**
 * Read both sides of one path at two revisions.
 *
 * A path may exist on only one side (a commit adding or deleting it). Those
 * sides intentionally become empty text so the aggregate comparison remains
 * usable instead of failing on the first non-overlapping path.
 *
 * @param {string} root - workspace root.
 * @param {string} prefix - repository prefix of the workspace root.
 * @param {string} originalHash - left-side commit-ish.
 * @param {string} modifiedHash - right-side commit-ish.
 * @param {string} relativePath - workspace-relative path.
 * @returns {Promise<object>} diff payload.
 */
async function gitDiffBetweenRevisions(root, prefix, originalHash, modifiedHash, relativePath) {
  const originalRevision = requireRevision(originalHash);
  const modifiedRevision = requireRevision(modifiedHash);
  resolveInside(root, relativePath);
  const repositoryPath = `${prefix}${relativePath}`;
  const [originalValue, modifiedValue] = await Promise.all([
    gitBlobMaybe(root, originalRevision, repositoryPath),
    gitBlobMaybe(root, modifiedRevision, repositoryPath),
  ]);
  const original = originalValue ?? '';
  const modified = modifiedValue ?? '';
  return {
    path: relativePath,
    commit: modifiedRevision,
    originalRevision,
    modifiedRevision,
    staged: false,
    original,
    modified,
    binary: original.includes('\u0000') || modified.includes('\u0000'),
    missing: modifiedValue === null,
    headExists: originalValue !== null,
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
 * @param {{name: string, checkout?: boolean, startPoint?: string}} input - branch request.
 * @returns {Promise<object>} refreshed status plus the branch list.
 */
async function gitCreateBranch(root, input) {
  const wanted = typeof input?.name === 'string' ? input.name.trim() : '';
  if (wanted === '') throw new Error('a branch name is required');
  if (wanted.startsWith('-')) throw new Error('a branch name may not start with "-"');
  if (/\s/u.test(wanted)) throw new Error('a branch name may not contain spaces');
  const existing = await gitBranches(root);
  if (existing.branches.includes(wanted)) throw new Error(`branch ${wanted} already exists`);
  const requestedStart = typeof input?.startPoint === 'string' ? input.startPoint.trim() : '';
  let startPoint = 'HEAD';
  if (requestedStart !== '') {
    const revision = requireRevision(requestedStart);
    try {
      startPoint = (await runGit(root, ['rev-parse', '--verify', `${revision}^{commit}`])).trim();
    } catch {
      throw new Error(`no such commit: ${requestedStart}`);
    }
    if (startPoint === '') throw new Error(`no such commit: ${requestedStart}`);
  }
  const args = input?.checkout === false ? ['branch', wanted] : ['checkout', '-b', wanted];
  if (startPoint !== 'HEAD') args.push(startPoint);
  await runGit(root, args);
  /* A status alone carries no branch list, and the popup must show the new name. */
  return {
    ...(await gitStatus(root)),
    ...(await gitBranches(root)),
    created: wanted,
    checkedOut: input?.checkout !== false,
    startPoint,
  };
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
 * Move the current branch to another commit, retaining or discarding changes
 * according to Git's soft/mixed/hard semantics.
 * @param {string} root - workspace root.
 * @param {{hash: string, mode: 'soft'|'mixed'|'hard'}} input - reset request.
 * @returns {Promise<object>} refreshed status plus reset metadata.
 */
async function gitResetToRevision(root, input) {
  const mode = typeof input?.mode === 'string' ? input.mode : '';
  if (!['soft', 'mixed', 'hard'].includes(mode)) throw new Error('reset mode must be soft, mixed or hard');
  const requestedHash = typeof input?.hash === 'string' ? input.hash.trim() : '';
  if (requestedHash === '') throw new Error('a commit hash is required');
  let resolved;
  try {
    resolved = (await runGit(root, ['rev-parse', '--verify', `${requireRevision(requestedHash)}^{commit}`])).trim();
  } catch {
    throw new Error(`no such commit: ${requestedHash}`);
  }
  if (resolved === '') throw new Error(`no such commit: ${requestedHash}`);
  await runGit(root, ['reset', `--${mode}`, resolved]);
  return {
    ...(await gitStatus(root)),
    resetMode: mode,
    resetTo: resolved,
  };
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
  if (request.method === 'HEAD') {
    return new Response(null, {
      status: 200,
      headers: {
        ...headers,
        'content-length': String(info.size),
      },
    });
  }
  const body = await readFile(file);
  return new Response(body, {
    status: 200,
    headers: {
      ...headers,
      'content-length': String(body.byteLength),
    },
  });
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
 * Bound for the LEGACY per-directory fallback only.
 *
 * Production prefers one recursive platform watcher. If that is unavailable,
 * opening hundreds of individual handles is worse than the signature poll: the
 * synchronous close path can stall the host for seconds. Keep the fallback
 * deliberately small and let the existing 8-second signature poll cover the
 * remainder of a very large tree.
 */
const MAX_WATCHED_DIRECTORIES = 256;

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
  constructor(root, emit, options = {}) {
    this.root = root;
    this.emit = emit;
    this.watchImpl = typeof options.watchImpl === 'function' ? options.watchImpl : watch;
    this.recursiveEnabled = options.recursive !== false;
    this.recursiveWatcher = null;
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
    if (this.watchRecursive()) {
      this.emit({ type: 'ready', root: this.root });
      return;
    }
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
   * Prefer one platform recursive watcher.
   *
   * macOS exposes recursive directory watching through a single FSEvents
   * stream. The previous implementation opened one `fs.watch` per directory;
   * on a real monorepo that reached the 2000-directory cap, and closing those
   * handles synchronously blocked the host event loop for roughly 19 seconds.
   * One recursive handle keeps the same change fidelity without that teardown
   * storm. Older platforms that cannot open a recursive watch fall back to the
   * bounded per-directory implementation below.
   * @returns {boolean} true when the recursive watcher is active.
   */
  watchRecursive() {
    if (!this.recursiveEnabled || this.closed) return false;
    let watcher;
    try {
      watcher = this.watchImpl(this.root, { recursive: true, persistent: false }, (_event, filename) => {
        const path = Buffer.isBuffer(filename) ? filename.toString('utf8') : String(filename ?? '');
        const normalized = path.replaceAll('\\', '/').replace(/^\.\/+/, '').replace(/^\/+/, '');
        if (isUploadTempName(basename(normalized))) return;
        if (normalized === '') {
          this.record(null);
          return;
        }
        if (normalized === '.git' || normalized.startsWith('.git/')) {
          /* git status refreshes the index lock even when no worktree or index
             content changed. Re-emitting that transient lock makes the client
             call git status again, which creates another lock indefinitely.
             Real Git changes still rename into their final path and are
             reported below. */
          if (basename(normalized).endsWith('.lock')) return;
          this.record(null);
          return;
        }
        /* macOS FSEvents may report only a basename for nested events. Without
           a relative directory we cannot safely guess which expanded listing
           changed, so null tells the browser to refresh all expanded dirs. */
        if (!normalized.includes('/')) {
          this.record(null);
          return;
        }
        const directory = dirname(normalized);
        this.record(directory === '.' ? null : directory);
      });
    } catch {
      return false;
    }
    this.recursiveWatcher = watcher;
    /* Keep the historical map surface observable while owning only one handle. */
    this.watchers.set(this.root, watcher);
    watcher.on('error', () => {
      if (this.recursiveWatcher !== watcher) return;
      this.recursiveWatcher = null;
      this.watchers.delete(this.root);
      watcher.close();
      this.emit({ type: 'error', message: 'recursive workspace watcher stopped' });
    });
    /* Recursive FSEvents already covers .git/index, so no second index watcher. */
    return true;
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
      watcher = this.watchImpl(absolute, { persistent: false }, () => this.record(''));
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
      watcher = this.watchImpl(absolute, { persistent: false }, (_event, filename) => {
        const name = Buffer.isBuffer(filename) ? filename.toString('utf8') : String(filename ?? '');
        if (isUploadTempName(basename(name))) return;
        this.record(relativePath);
      });
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
   * @param {string|null} directory - changed directory, or null when the
   * platform did not expose a usable relative path.
   * @returns {void}
   */
  record(directory) {
    if (this.closed) return;
    this.pending.add(directory);
    if (this.timer !== null) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      if (this.closed) return;
      const dirs = this.pending.has(null) ? null : [...this.pending];
      this.pending.clear();
      /* Emit first: the browser can start re-reading while the walk runs, and a
         slowly-added watcher must not delay a frame the tree is waiting for. */
      if (this.recursiveWatcher === null) void this.syncWatches(dirs ?? []);
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
    const recursive = this.recursiveWatcher;
    const watchers = [...this.watchers.values()];
    this.recursiveWatcher = null;
    this.watchers.clear();
    if (recursive !== null) recursive.close();
    else {
      for (const watcher of watchers) watcher.close();
    }
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
    const serviceOf = (serviceName) => {
      /* Services can activate after this plugin's inject callback has mounted.
         Resolve from both the injected child scope and the plugin context so a
         registry that was absent at startup is still found on the next request. */
      for (const owner of [scope, ctx]) {
        try {
          const value = owner.get?.(serviceName);
          if (value !== undefined && value !== null) return value;
        } catch {
          /* A missing service is normal: try the next owner/name. */
        }
      }
      return undefined;
    };
    /* The host has used both names across DSH releases. Keep the registry
       optional so older profiles still work for ordinary session requests.
       Crucially this is called per request, not cached: DSH starts plugins and
       workspace services asynchronously, and a startup-time null used to make a
       visible workspace permanently "not registered" until the whole host was
       restarted again. */
    const workspaceRegistryNow = () => serviceOf('workspaceRegistry') ?? serviceOf('workspaces') ?? null;
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
          path: '/api/dsh-editor/workspace-directory',
          methods: ['POST'],
          requestBody: 'buffered',
          fetch: async (request) => {
            let body;
            try {
              body = await request.json();
            } catch {
              return fail('dsh-editor/bad-request', 'body is not JSON');
            }
            try {
              return ok(await listWorkspaceDirectoryForPicker(body?.path));
            } catch (error) {
              return fail(
                'dsh-editor/workspace-directory',
                error instanceof Error ? error.message : String(error),
              );
            }
          },
        }),
      'dsh-editor: workspace directory picker API',
    );

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
            const workspaceId = typeof body?.workspaceId === 'string' ? body.workspaceId : '';
            const rawOperation = typeof body?.op === 'string' ? body.op.trim() : '';
            /* Older clients briefly used these spellings; callFs itself retries
               the canonical searchText operation, and this keeps mixed
               browser/host revisions usable during a hot reload. */
            const operation = rawOperation === 'textSearch' || rawOperation === 'search-text'
              ? 'searchText'
              : rawOperation;
            const relativePath = typeof body?.path === 'string' ? body.path : '';
            if (sessionId === '' && workspaceId === '') return fail('dsh-editor/bad-request', 'missing sessionId or workspaceId');
            let root;
            try {
              root = workspaceRootForRequest({ sessions, workingDirectory, workspaceRegistry: workspaceRegistryNow(), sessionId, workspaceId });
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
                      foldersFirst: body?.foldersFirst !== false,
                      showExcluded: body?.showExcluded !== false,
                    })),
                    root,
                    home: process.env.HOME ?? '',
                  });
                case 'read':
                  return ok(await readTextFile(root, relativePath));
                case 'image':
                  return ok(await imageFileInfo(root, relativePath));
                case 'files':
                  return ok(await listWorkspaceFiles(
                    root,
                    body?.includeExcluded === true ? 5000 : 2000,
                    { includeExcluded: body?.includeExcluded === true },
                  ));
                case 'search':
                  return ok(await searchWorkspaceEntries(root, body?.query, {
                    showHidden: body?.showHidden === true,
                    showExcluded: body?.showExcluded === true,
                    sort: typeof body?.sort === 'string' ? body.sort : 'name',
                    foldersFirst: body?.foldersFirst !== false,
                    signal: request.signal,
                  }));
                case 'searchText':
                  return ok(await searchWorkspaceText(root, body?.query, {
                    caseSensitive: typeof body?.caseSensitive === 'boolean' ? body.caseSensitive : undefined,
                    wholeWords: body?.wholeWords === true,
                    regex: body?.regex === true,
                    fileMask: typeof body?.fileMask === 'string' ? body.fileMask : '',
                    maxMatches: body?.maxMatches,
                    includeExcluded: body?.includeExcluded === true,
                    directory: typeof body?.directory === 'string' ? body.directory : '',
                    recursive: body?.recursive !== false,
                    allowedPaths: Array.isArray(body?.allowedPaths) ? body.allowedPaths : undefined,
                    gitScope: typeof body?.gitScope === 'string' ? body.gitScope : '',
                    dirtyPaths: Array.isArray(body?.dirtyPaths) ? body.dirtyPaths : undefined,
                    contextFilter: typeof body?.contextFilter === 'string' ? body.contextFilter : 'anywhere',
                    scopeIncludePatterns: Array.isArray(body?.scopeIncludePatterns) ? body.scopeIncludePatterns : undefined,
                    scopeExcludePatterns: Array.isArray(body?.scopeExcludePatterns) ? body.scopeExcludePatterns : undefined,
                  }));
                case 'replaceText':
                  return ok(await replaceWorkspaceText(root, body?.query, body?.replacement, body?.targets, {
                    caseSensitive: typeof body?.caseSensitive === 'boolean' ? body.caseSensitive : undefined,
                    wholeWords: body?.wholeWords === true,
                    regex: body?.regex === true,
                    preserveCase: body?.preserveCase === true,
                    fileMask: typeof body?.fileMask === 'string' ? body.fileMask : '',
                    occurrence: body?.occurrence && typeof body.occurrence === 'object'
                      ? { line: body.occurrence.line, column: body.occurrence.column }
                      : undefined,
                    contextFilter: typeof body?.contextFilter === 'string' ? body.contextFilter : 'anywhere',
                    scopeIncludePatterns: Array.isArray(body?.scopeIncludePatterns) ? body.scopeIncludePatterns : undefined,
                    scopeExcludePatterns: Array.isArray(body?.scopeExcludePatterns) ? body.scopeExcludePatterns : undefined,
                  }));
                case 'undoReplaceText':
                  return ok(await undoLastWorkspaceReplacement(root, body?.operationId));
                case 'redoReplaceText':
                  return ok(await redoLastWorkspaceReplacement(root, body?.operationId));
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
                case 'writeBinary':
                  return ok(await writeUploadedFile(root, relativePath, body?.contentBase64));
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
          path: '/api/dsh-editor/image',
          methods: ['GET', 'HEAD'],
          requestBody: 'buffered',
          fetch: async (request) => {
            const url = new URL(request.url);
            const sessionId = url.searchParams.get('sessionId') ?? '';
            const workspaceId = url.searchParams.get('workspaceId') ?? '';
            const relativePath = url.searchParams.get('path') ?? '';
            if (sessionId === '' && workspaceId === '') return fail('dsh-editor/bad-request', 'missing sessionId or workspaceId');
            if (relativePath === '') return fail('dsh-editor/bad-request', 'missing image path');
            try {
              const root = workspaceRootForRequest({
                sessions,
                workingDirectory,
                workspaceRegistry: workspaceRegistryNow(),
                sessionId,
                workspaceId,
              });
              return imageFileResponse(root, relativePath, request);
            } catch (error) {
              return fail('dsh-editor/image', error instanceof Error ? error.message : String(error));
            }
          },
        }),
      'dsh-editor: workspace image preview',
    );

    ctx.effect(() => {
      const rootFor = (sessionId, workspaceId) => workspaceRootForRequest({
        sessions,
        workingDirectory,
        workspaceRegistry: workspaceRegistryNow(),
        sessionId,
        workspaceId,
      });
      const disposers = [
        register({
          path: '/api/dsh-editor/upload/start',
          methods: ['POST'],
          requestBody: 'buffered',
          fetch: async (request) => {
            const body = await request.json().catch(() => null);
            const url = new URL(request.url);
            const sessionId = url.searchParams.get('sessionId') || (typeof body?.sessionId === 'string' ? body.sessionId : '');
            const workspaceId = url.searchParams.get('workspaceId') || (typeof body?.workspaceId === 'string' ? body.workspaceId : '');
            const relativePath = typeof body?.path === 'string' ? body.path : '';
            if (sessionId === '' && workspaceId === '') return fail('dsh-editor/bad-request', 'missing sessionId or workspaceId');
            try {
              const root = rootFor(sessionId, workspaceId);
              return ok(await startWorkspaceUpload(root, relativePath, body?.size));
            } catch (error) {
              return uploadFailureResponse(error);
            }
          },
        }),
        register({
          path: '/api/dsh-editor/upload/chunk',
          methods: ['PATCH'],
          requestBody: 'buffered',
          fetch: async (request) => {
            const url = new URL(request.url);
            const sessionId = url.searchParams.get('sessionId') ?? '';
            const workspaceId = url.searchParams.get('workspaceId') ?? '';
            const uploadId = url.searchParams.get('uploadId') ?? '';
            const offset = Number(url.searchParams.get('offset'));
            if (sessionId === '' && workspaceId === '') return fail('dsh-editor/bad-request', 'missing sessionId or workspaceId');
            if (!request.headers.get('content-type')?.startsWith('application/octet-stream')) {
              return Response.json(
                { ok: false, error: { code: 'dsh-editor/upload-content-type', message: 'upload chunks must be application/octet-stream' } },
                { status: 415, headers: { 'cache-control': 'no-store' } },
              );
            }
            try {
              const root = rootFor(sessionId, workspaceId);
              const bytes = Buffer.from(await request.arrayBuffer());
              return ok(await writeWorkspaceUploadChunk(root, uploadId, offset, bytes));
            } catch (error) {
              return uploadFailureResponse(error);
            }
          },
        }),
        register({
          path: '/api/dsh-editor/upload/finish',
          methods: ['POST'],
          requestBody: 'buffered',
          fetch: async (request) => {
            const body = await request.json().catch(() => null);
            const url = new URL(request.url);
            const sessionId = url.searchParams.get('sessionId') || (typeof body?.sessionId === 'string' ? body.sessionId : '');
            const workspaceId = url.searchParams.get('workspaceId') || (typeof body?.workspaceId === 'string' ? body.workspaceId : '');
            if (sessionId === '' && workspaceId === '') return fail('dsh-editor/bad-request', 'missing sessionId or workspaceId');
            try {
              return ok(await finishWorkspaceUpload(rootFor(sessionId, workspaceId), body?.uploadId));
            } catch (error) {
              return uploadFailureResponse(error);
            }
          },
        }),
        register({
          path: '/api/dsh-editor/upload/abort',
          methods: ['POST'],
          requestBody: 'buffered',
          fetch: async (request) => {
            const body = await request.json().catch(() => null);
            const url = new URL(request.url);
            const sessionId = url.searchParams.get('sessionId') || (typeof body?.sessionId === 'string' ? body.sessionId : '');
            const workspaceId = url.searchParams.get('workspaceId') || (typeof body?.workspaceId === 'string' ? body.workspaceId : '');
            if (sessionId === '' && workspaceId === '') return fail('dsh-editor/bad-request', 'missing sessionId or workspaceId');
            try {
              return ok(await abortWorkspaceUpload(rootFor(sessionId, workspaceId), body?.uploadId));
            } catch (error) {
              return uploadFailureResponse(error);
            }
          },
        }),
      ];
      return () => {
        for (const dispose of disposers) dispose();
      };
    }, 'dsh-editor: resumable workspace upload');

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
            const workspaceId = typeof body?.workspaceId === 'string' ? body.workspaceId : '';
            const operation = typeof body?.op === 'string' ? body.op : '';
            if (sessionId === '' && workspaceId === '') return fail('dsh-editor/bad-request', 'missing sessionId or workspaceId');
            let root;
            try {
              root = workspaceRootForRequest({ sessions, workingDirectory, workspaceRegistry: workspaceRegistryNow(), sessionId, workspaceId });
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
                case 'combinedDiff': {
                  const current = await gitStatus(root);
                  return ok(await gitCombinedDiff(root, current.prefix, body));
                }
                case 'patch': {
                  const current = await gitStatus(root);
                  return ok(await gitSelectedPatch(root, current.prefix, body));
                }
                case 'commitPatch':
                  return ok(await gitCommitPatch(root, String(body?.hash ?? '')));
                case 'applyPatch': {
                  const current = await gitStatus(root);
                  return ok(await gitApplyPatch(root, current.prefix, body));
                }
                case 'commitDiff': {
                  const current = await gitStatus(root);
                  return ok(await gitCommitDiff(root, current.prefix, body));
                }
                case 'diffWithRevision': {
                  const current = await gitStatus(root);
                  return ok(await gitDiffWithRevision(root, current.prefix, body));
                }
                case 'repositoryVersion': {
                  const current = await gitStatus(root);
                  return ok(await gitRepositoryVersion(root, current.prefix, body));
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
                case 'resetBranch':
                  return ok(await gitResetToRevision(root, body));
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
            const workspaceId = typeof body?.workspaceId === 'string' ? body.workspaceId : '';
            const operation = typeof body?.op === 'string' ? body.op : '';
            if (sessionId === '' && workspaceId === '') return fail('dsh-editor/bad-request', 'missing sessionId or workspaceId');
            let root;
            try {
              root = workspaceRootForRequest({ sessions, workingDirectory, workspaceRegistry: workspaceRegistryNow(), sessionId, workspaceId });
            } catch (error) {
              return fail('dsh-editor/no-workspace', error instanceof Error ? error.message : String(error));
            }
            const terminalScopeId = terminalScopeForRequest({ sessionId, workspaceId });
            try {
              switch (operation) {
                case 'list':
                  return ok({ available: terminals.available(), terminals: terminals.list(terminalScopeId) });
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
                      sessionId: terminalScopeId,
                      cwd,
                      cols: body?.cols,
                      rows: body?.rows,
                      shellPath: typeof body?.shellPath === 'string' ? body.shellPath : undefined,
                    }),
                  });
                }
                case 'write':
                  await terminals.write(terminalScopeId, String(body?.id ?? ''), body?.data);
                  return ok({ written: true });
                case 'resize':
                  await terminals.resize(terminalScopeId, String(body?.id ?? ''), body?.cols, body?.rows);
                  return ok({ resized: true });
                case 'rename':
                  return ok({ terminal: terminals.rename(terminalScopeId, String(body?.id ?? ''), body?.title, body?.auto === true) });
                case 'reorder':
                  return ok({ terminals: terminals.reorder(terminalScopeId, body?.ids) });
                case 'close':
                  return ok(await terminals.close(terminalScopeId, String(body?.id ?? '')));
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
            const workspaceId = url.searchParams.get('workspaceId') ?? '';
            const id = url.searchParams.get('id') ?? '';
            let terminalScopeId;
            try {
              terminalScopeId = terminalScopeForRequest({ sessionId, workspaceId });
            } catch (error) {
              return Promise.resolve(fail('dsh-editor/bad-request', error instanceof Error ? error.message : String(error)));
            }
            if (id === '') return Promise.resolve(fail('dsh-editor/bad-request', 'missing terminal id'));
            return Promise.resolve(terminalStreamResponse(terminals, terminalScopeId, id, request.signal));
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
            const workspaceId = url.searchParams.get('workspaceId') ?? '';
            if (sessionId === '' && workspaceId === '') return Promise.resolve(fail('dsh-editor/bad-request', 'missing sessionId or workspaceId'));
            let root;
            try {
              root = workspaceRootForRequest({ sessions, workingDirectory, workspaceRegistry: workspaceRegistryNow(), sessionId, workspaceId });
            } catch (error) {
              return Promise.resolve(fail('dsh-editor/no-workspace', error instanceof Error ? error.message : String(error)));
            }
            return Promise.resolve(workspaceWatchResponse(root, request.signal));
          },
        }),
      'dsh-editor: workspace file watch',
    );

    ctx.effect(
      () =>
        register({
          path: '/api/dsh-editor/diagnostics',
          methods: ['POST'],
          requestBody: 'buffered',
          fetch: async (request) => {
            let raw;
            try {
              raw = await request.text();
            } catch {
              return fail('dsh-editor/bad-request', 'diagnostics body is unreadable');
            }
            if (raw.length > MAX_EDITOR_DIAGNOSTICS_BYTES) {
              return fail('dsh-editor/bad-request', 'diagnostics body is too large');
            }
            let body;
            try {
              body = JSON.parse(raw);
            } catch {
              return fail('dsh-editor/bad-request', 'diagnostics body is not JSON');
            }
            const records = (Array.isArray(body?.records) ? body.records : [body]).slice(-20);
            const lines = records
              .filter((record) => record !== null && typeof record === 'object')
              .map((record) => JSON.stringify(editorDiagnosticRecord(record)));
            if (lines.length === 0) return ok({ written: 0 });
            try {
              await mkdir(dirname(EDITOR_DIAGNOSTICS_FILE), { recursive: true });
              await appendFile(EDITOR_DIAGNOSTICS_FILE, lines.join('\n') + '\n', 'utf8');
              return ok({ written: lines.length, file: EDITOR_DIAGNOSTICS_FILE });
            } catch (error) {
              return fail('dsh-editor/diagnostics', error instanceof Error ? error.message : String(error));
            }
          },
        }),
      'dsh-editor: diagnostics API',
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
