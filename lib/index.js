import { execFile, spawn } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import { createReadStream, createWriteStream, readdirSync, watch } from 'node:fs';
import { appendFile, chmod, lstat, mkdir, mkdtemp, open, readdir, readFile, realpath, rename, rm, stat, unlink, writeFile } from 'node:fs/promises';
import { homedir, tmpdir } from 'node:os';
import { basename, dirname, extname, isAbsolute, join, parse, relative, resolve, sep } from 'node:path';
import { createInterface } from 'node:readline';
import { StringDecoder } from 'node:string_decoder';
import { Readable, Writable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { promisify } from 'node:util';
import { deserialize as deserializeV8, serialize as serializeV8 } from 'node:v8';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { createGunzip, createGzip } from 'node:zlib';
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
export { commitWorkspaceReplacements, describeGitError, searchWorkspaceText, replaceWorkspaceText, undoLastWorkspaceReplacement, redoLastWorkspaceReplacement, workspaceSearchIndexStatus, updateWorkspaceSearchIndex, rebuildWorkspaceSearchIndex, clearWorkspaceSearchIndex, writeWorkspaceSearchIndex, searchIndexIdentity };
export { WorkspaceWatcher };
export const workspaceFileOperations = { remove: deleteEntry, rename: renameEntry, write: writeTextFileGuarded, writeBinary: writeUploadedFile, startUpload: startWorkspaceUpload, writeUploadChunk: writeWorkspaceUploadChunk, finishUpload: finishWorkspaceUpload, abortUpload: abortWorkspaceUpload, imageInfo: imageFileInfo, describe: describePaths, sort: sortEntries, reveal: revealInFileManager, files: workspaceFilesForRequest, directories: listWorkspaceDirectories, search: searchWorkspaceEntries, searchText: searchWorkspaceText, searchIndexStatus: workspaceSearchIndexStatus, updateSearchIndex: updateWorkspaceSearchIndex, rebuildSearchIndex: rebuildWorkspaceSearchIndex, clearSearchIndex: clearWorkspaceSearchIndex, replaceText: replaceWorkspaceText, undoReplaceText: undoLastWorkspaceReplacement, redoReplaceText: redoLastWorkspaceReplacement, typeLibraries: workspaceTypeLibraries };

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
const SEARCH_ENTRY_NAME_COLLATOR = new Intl.Collator(undefined, { sensitivity: 'base' });
const SEARCH_ENTRY_NUMERIC_COLLATOR = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: 'base',
});
const SEARCH_ENTRY_DEFAULT_COLLATOR = new Intl.Collator();

/**
 * Git/VCS metadata, generated build artifacts and operating-system metadata
 * that must never enter the project search index or a search result.
 *
 * These files are not source, are frequently rewritten by Finder/Explorer,
 * and are not guaranteed to appear in `.gitignore`. Project View can still
 * display and open them; this set only narrows workspace search.
 */
const SYSTEM_GENERATED_SEARCH_FILE_NAMES = new Set([
  '.gitattributes',
  '.git-blame-ignore-revs',
  '.gitignore',
  '.gitkeep',
  '.gitmodules',
  '.hgignore',
  '.svnignore',
  '.ds_store',
  'desktop.ini',
  'ehthumbs.db',
  'ehthumbs_vista.db',
  'thumbs.db',
]);
const SYSTEM_GENERATED_SEARCH_FILE_EXTENSIONS = new Set(['.class', '.o', '.obj']);

/** Return true for Finder/Explorer metadata and compiled intermediate files. */
function searchPathIsSystemGenerated(path) {
  const name = basename(path).toLowerCase();
  if (SYSTEM_GENERATED_SEARCH_FILE_NAMES.has(name)) return true;
  const dot = name.lastIndexOf('.');
  return dot >= 0 && SYSTEM_GENERATED_SEARCH_FILE_EXTENSIONS.has(name.slice(dot));
}

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
  const isDirectory = info.isDirectory() && !info.isSymbolicLink();
  if (info.isDirectory() && !info.isSymbolicLink()) {
    /* Recursive on purpose: IDEA's Delete removes a directory and its contents. */
    await rm(target, { recursive: true });
  } else await unlink(target);
  removeWorkspaceSearchIndexPath(root, relativePath, isDirectory);
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
  const sourceInfo = await lstat(source).catch(() => null);
  const isDirectory = sourceInfo?.isDirectory() === true && sourceInfo.isSymbolicLink() !== true;
  await mkdir(dirname(target), { recursive: true });
  await rename(source, target);
  moveWorkspaceSearchIndexPath(root, relativePath, nextPath, isDirectory);
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
 * Resolve one directory's real identity for bounded recursive traversal.
 *
 * Directory listings expose symlinks under their workspace names, while
 * traversal must remember the target directory so a link back to an ancestor
 * cannot re-enter the same subtree forever.
 * @param {string} directory - absolute logical directory path.
 * @returns {Promise<string|null>} canonical directory identity, or null when
 * the entry is missing, broken, or not a directory.
 */
async function directoryTraversalIdentity(directory) {
  return await realpath(directory).catch(() => null);
}

/** Bounded in-memory aliases learned from Project/Search directory listings. */
const WORKSPACE_DIRECTORY_ALIAS_ROOTS = new Map();
const MAX_WORKSPACE_ALIAS_ROOTS = 32;
const MAX_WORKSPACE_DIRECTORY_ALIASES = 4096;

function workspaceAliasRegistry(root) {
  const key = resolve(root);
  let registry = WORKSPACE_DIRECTORY_ALIAS_ROOTS.get(key);
  if (registry !== undefined) return registry;
  while (WORKSPACE_DIRECTORY_ALIAS_ROOTS.size >= MAX_WORKSPACE_ALIAS_ROOTS) {
    const oldest = WORKSPACE_DIRECTORY_ALIAS_ROOTS.keys().next().value;
    if (oldest === undefined) break;
    WORKSPACE_DIRECTORY_ALIAS_ROOTS.delete(oldest);
  }
  registry = new Map();
  WORKSPACE_DIRECTORY_ALIAS_ROOTS.set(key, registry);
  return registry;
}

/**
 * Remember a logical workspace directory that resolves to another real path.
 * The mapping never leaves Host memory and watcher frames continue to use the
 * workspace-relative alias rather than exposing the target's absolute path.
 */
function registerWorkspaceDirectoryAlias(root, logicalDirectory, realDirectory) {
  if (typeof logicalDirectory !== 'string' || typeof realDirectory !== 'string') return;
  const logical = resolve(logicalDirectory);
  const real = resolve(realDirectory);
  if (logical === real) return;
  const registry = workspaceAliasRegistry(root);
  let aliases = registry.get(real) ?? registry.get(logical);
  if (aliases === undefined) {
    while (registry.size >= MAX_WORKSPACE_DIRECTORY_ALIASES) {
      const oldest = registry.keys().next().value;
      if (oldest === undefined) break;
      registry.delete(oldest);
    }
    aliases = new Set();
  }
  /* Keep both the canonical target and the observed logical spelling on the
     same identity set. macOS `realpath` can turn `/var` into `/private/var`,
     while recursive events may report either spelling. */
  registry.set(real, aliases);
  registry.set(logical, aliases);
  aliases.add(logical);
}

/** Logical workspace directories that were loaded through one real directory. */
function workspaceDirectoryAliases(root, realDirectory) {
  const aliases = workspaceAliasRegistry(root).get(resolve(realDirectory));
  return aliases === undefined ? [] : [...aliases];
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
function entrySortComparator(mode, foldersFirst = true) {
  const byName = (left, right) => SEARCH_ENTRY_NAME_COLLATOR.compare(left.name, right.name);
  const compare = mode === 'modified' || mode === 'modified-asc'
    ? (left, right) => (mode === 'modified-asc' ? left.mtime - right.mtime : right.mtime - left.mtime) || byName(left, right)
    : mode === 'type'
      ? (left, right) => {
          const leftExtension = left.kind === 'file' ? left.name.slice(left.name.lastIndexOf('.') + 1).toLowerCase() : '';
          const rightExtension = right.kind === 'file' ? right.name.slice(right.name.lastIndexOf('.') + 1).toLowerCase() : '';
          return SEARCH_ENTRY_NAME_COLLATOR.compare(leftExtension, rightExtension) || byName(left, right);
        }
      : byName;
  return (left, right) => {
    if (foldersFirst && left.kind !== right.kind) return left.kind === 'directory' ? -1 : 1;
    return compare(left, right);
  };
}

function sortEntries(entries, mode, foldersFirst = true) {
  entries.sort(entrySortComparator(mode, foldersFirst));
  return entries;
}

/**
 * List one directory with IDEA's active sort and Folders Always on Top option.
 * @param {string} root - workspace root.
 * @param {string} relativePath - directory path relative to the root.
 * @param {{showHidden?: boolean, showExcluded?: boolean, sort?: string, foldersFirst?: boolean, metadata?: boolean, knownDirectory?: boolean, realDirectory?: string|null}} options - Project View options; traversal callers can reuse an already resolved directory identity.
 * @returns {Promise<{path: string, entries: object[]}>} directory listing.
 */
async function listDirectory(root, relativePath, options = {}) {
  const directory = resolveInside(root, relativePath);
  if (options.knownDirectory !== true) {
    const info = await stat(directory);
    if (!info.isDirectory()) throw new Error('not a directory');
  }
  const realDirectory =
    options.realDirectory !== undefined
      ? options.realDirectory
      : await directoryTraversalIdentity(directory);
  if (realDirectory !== null) registerWorkspaceDirectoryAlias(root, directory, realDirectory);
  const rows = await readdir(directory, { withFileTypes: true });
  const entries = [];
  const showHidden = options.showHidden === true;
  const includeMetadata = options.metadata !== false;
  for (const row of rows) {
    if (IGNORED_DIRECTORIES.has(row.name)) continue;
    if (isUploadTempName(row.name)) continue;
    /* IDEA hides dot-entries unless the user turns on "Show hidden files".
       Only `.git` is unconditional (see IGNORED_DIRECTORIES). */
    if (!showHidden && row.name.startsWith('.')) continue;
    if (options.showExcluded !== true && PROJECT_EXCLUDED_DIRECTORIES.has(row.name)) continue;
    const childPath = relativePath === '' ? row.name : `${relativePath}/${row.name}`;
    let childInfo = null;
    let isDirectory = false;
    if (row.isSymbolicLink() || includeMetadata) {
      childInfo = await stat(resolveInside(root, childPath)).catch(() => null);
      if (childInfo === null) continue;
      isDirectory = childInfo.isDirectory();
    } else {
      if (!row.isFile() && !row.isDirectory()) continue;
      isDirectory = row.isDirectory();
    }
    if (isDirectory) {
      const childAbsolute = resolveInside(root, childPath);
      const childRealDirectory = row.isSymbolicLink()
        ? await directoryTraversalIdentity(childAbsolute)
        : realDirectory === null
          ? null
          : join(realDirectory, row.name);
      if (childRealDirectory !== null) {
        registerWorkspaceDirectoryAlias(root, childAbsolute, childRealDirectory);
      }
    }
    entries.push({
      name: row.name,
      path: childPath,
      kind: isDirectory ? 'directory' : 'file',
      size: isDirectory ? 0 : (childInfo?.size ?? 0),
      mtime: childInfo?.mtimeMs ?? 0,
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
export async function canonicalizeDirectoryCase(directory, platform = process.platform) {
  if (platform !== 'darwin' && platform !== 'win32') return directory;
  const volumeRoot = parse(directory).root;
  const segments = relative(volumeRoot, directory).split(sep).filter((segment) => segment !== '');
  let cursor = volumeRoot;
  for (const segment of segments) {
    let rows;
    try {
      rows = await readdir(cursor, { withFileTypes: true });
    } catch {
      return directory;
    }
    const folded = segment.toLowerCase();
    const matches = rows.filter((row) => row.name.toLowerCase() === folded);
    if (matches.length !== 1) return directory;
    cursor = join(cursor, matches[0].name);
  }
  return cursor;
}

export async function listWorkspaceDirectoryForPicker(requestedPath) {
  if (requestedPath !== undefined && typeof requestedPath !== 'string') {
    throw new Error('directory path must be a string');
  }
  const requested = typeof requestedPath === 'string' ? requestedPath.trim() : '';
  if (requested.includes('\0')) throw new Error('directory path contains a null byte');
  if (requested !== '' && !isAbsolute(requested)) throw new Error('directory path must be absolute');
  const home = homedir();
  const directory = await canonicalizeDirectoryCase(requested === '' ? home : resolve(requested));
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
    .sort((left, right) => SEARCH_ENTRY_NUMERIC_COLLATOR.compare(left.name, right.name));
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
 * Read only the requested line window for Search/Find preview.
 *
 * Search previews are read-only and must remain useful for files that are far
 * larger than Monaco's editable 4 MiB limit. Streaming stops after the focus
 * window, so a 100+ MiB generated file costs bounded memory and I/O.
 * @param {string} root - workspace root.
 * @param {string} relativePath - workspace-relative file.
 * @param {unknown} requestedLine - one-based focus line.
 * @param {unknown} requestedRadius - lines of context on each side.
 * @param {{signal?: AbortSignal}} [options] - request cancellation.
 * @returns {Promise<object>} bounded preview window.
 */
export async function readTextFilePreview(root, relativePath, requestedLine, requestedRadius, options = {}) {
  const file = resolveInside(root, relativePath);
  const info = await stat(file);
  if (!info.isFile()) throw new Error('not a file');
  const line = Math.max(1, Math.floor(Number(requestedLine) || 1));
  const radius = Math.max(1, Math.min(400, Math.floor(Number(requestedRadius) || 200)));
  const firstRequestedLine = Math.max(1, line - radius);
  const lastRequestedLine = line + radius;
  const lines = [];
  let firstLine = 0;
  let lineNumber = 0;
  let truncatedAfter = false;
  const stream = createReadStream(file, {
    encoding: 'utf8',
    signal: options?.signal,
  });
  const reader = createInterface({
    input: stream,
    crlfDelay: Infinity,
  });
  try {
    for await (const text of reader) {
      lineNumber += 1;
      if (text.includes('\0')) throw new Error('binary files cannot be previewed');
      if (lineNumber < firstRequestedLine) continue;
      if (lineNumber > lastRequestedLine) {
        truncatedAfter = true;
        break;
      }
      if (lines.length === 0) firstLine = lineNumber;
      lines.push(text);
    }
  } finally {
    reader.close();
    stream.destroy();
  }
  const startLine = lines.length === 0 ? firstRequestedLine : firstLine;
  const endLine = lines.length === 0 ? firstRequestedLine - 1 : firstLine + lines.length - 1;
  return {
    path: relativePath,
    content: lines.join('\n'),
    line,
    startLine,
    endLine,
    truncatedBefore: startLine > 1,
    truncatedAfter,
    size: info.size,
    mtime: info.mtimeMs,
  };
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
    invalidateWorkspaceSearchIndexPath(root, relativePath);
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
  invalidateWorkspaceSearchIndexPath(root, relativePath);
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
  invalidateWorkspaceSearchIndexPath(root, relativePath);
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
  invalidateWorkspaceSearchIndexPath(root, upload.relativePath);
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

const TYPE_LIBRARY_MAX_FILES = 1200;
const TYPE_LIBRARY_MAX_BYTES = 12 * 1024 * 1024;
const TYPE_LIBRARY_MAX_FILE_BYTES = 2 * 1024 * 1024;
const TYPE_LIBRARY_MAX_PACKAGES = 100;
const TYPE_LIBRARY_MAX_DIRECTORIES = 2000;
const DENO_RUNTIME_TYPES_PATH = fileURLToPath(new URL('./deno-types/deno.ns.d.ts', import.meta.url));
const JSR_TYPE_BUNDLE_PATH = fileURLToPath(new URL('./jsr-runtime-types.json', import.meta.url));
let jsrTypeCatalogPromise = null;

/** Parse a small JSONC config without treating comments inside strings as syntax. */
function parseTypeConfigJson(text) {
  let output = '';
  let quote = '';
  let escaped = false;
  let lineComment = false;
  let blockComment = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const next = text[index + 1] ?? '';
    if (lineComment) {
      if (character === '\n') {
        lineComment = false;
        output += character;
      }
      continue;
    }
    if (blockComment) {
      if (character === '*' && next === '/') {
        blockComment = false;
        index += 1;
      } else if (character === '\n') {
        output += character;
      }
      continue;
    }
    if (quote !== '') {
      output += character;
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === quote) quote = '';
      continue;
    }
    if (character === '/' && next === '/') {
      lineComment = true;
      index += 1;
      continue;
    }
    if (character === '/' && next === '*') {
      blockComment = true;
      index += 1;
      continue;
    }
    if (character === '"' || character === "'") quote = character;
    output += character;
  }
  try {
    return JSON.parse(output.replace(/,\s*([}\]])/gu, '$1'));
  } catch {
    return null;
  }
}

/** Extract one package name from npm source or type specifier syntax. */
function typeLibraryPackageName(value) {
  let specifier = typeof value === 'string' ? value.trim() : '';
  if (specifier === '') return '';
  if (specifier.startsWith('jsr:') || specifier.startsWith('http:')) return '';
  if (specifier.startsWith('npm:')) specifier = specifier.slice(4);
  if (specifier.startsWith('.') || specifier.startsWith('/') || specifier.startsWith('file:')) return '';
  let packageName;
  if (specifier.startsWith('@')) {
    const parts = specifier.split('/');
    if (parts.length < 2) return '';
    const name = parts[1].split('@')[0];
    packageName = name === '' ? '' : `${parts[0]}/${name}`;
  } else {
    packageName = specifier.split('/')[0].split('@')[0];
  }
  return /[a-z0-9]/iu.test(packageName) && /^(?:@[a-z0-9._-]+\/)?[a-z0-9._-]+$/iu.test(packageName)
    ? packageName
    : '';
}

function typeLibraryTypeName(packageName) {
  return packageName.startsWith('@types/') ? packageName.slice('@types/'.length) : packageName;
}

function isTypeLibraryDeclarationFile(name) {
  return name.endsWith('.d.ts') || name.endsWith('.d.mts') || name.endsWith('.d.cts');
}

function typeLibraryBaseUrl(value) {
  const candidate = typeof value === 'string' ? value.replaceAll('\\', '/').replace(/^\.\/+/u, '').replace(/^\/+/u, '') : '';
  if (candidate === '' || candidate === '.' || candidate.split('/').some((segment) => segment === '..')) return '';
  return candidate;
}

function typeLibraryCompilerPaths(value) {
  const source = value !== null && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const paths = {};
  for (const [alias, targets] of Object.entries(source).slice(0, 100)) {
    if (alias === '' || !Array.isArray(targets)) continue;
    const normalized = targets.filter((target) => typeof target === 'string' && target !== '').slice(0, 20);
    if (normalized.length > 0) paths[alias] = normalized;
  }
  return paths;
}

function denoLocalImportMapPaths(imports, baseUrl) {
  const entries = imports !== null && typeof imports === 'object' && !Array.isArray(imports) ? Object.entries(imports) : [];
  const paths = {};
  for (const [alias, target] of entries.slice(0, TYPE_LIBRARY_MAX_PACKAGES)) {
    if (
      alias === '' ||
      alias.includes('*') ||
      alias.includes('?') ||
      typeof target !== 'string' ||
      !target.startsWith('./')
    ) {
      continue;
    }
    const normalizedTarget = target.replaceAll('\\', '/').replace(/[?#].*$/u, '');
    const targetPath = normalizedTarget.replace(/^\.\/+/u, '').replace(/\/+$/u, '');
    if (targetPath === '' || targetPath.split('/').some((segment) => segment === '' || segment === '..')) continue;
    let mappedTarget = targetPath;
    if (baseUrl !== '') {
      const relativeTarget = relative(baseUrl, targetPath).replaceAll('\\', '/');
      mappedTarget = relativeTarget === '' ? '.' : relativeTarget;
    }
    const prefixAlias = alias.endsWith('/');
    const aliasKey = prefixAlias ? `${alias.slice(0, -1)}/*` : alias;
    paths[aliasKey] = [prefixAlias ? `${mappedTarget}/*` : mappedTarget];
  }
  return paths;
}

function typeLibraryConditionTarget(value, depth = 0) {
  if (depth > 6) return '';
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    for (const entry of value) {
      const target = typeLibraryConditionTarget(entry, depth + 1);
      if (target !== '') return target;
    }
    return '';
  }
  if (value === null || typeof value !== 'object') return '';
  for (const condition of ['types', 'import', 'require', 'default', 'node', 'browser']) {
    if (!Object.hasOwn(value, condition)) continue;
    const target = typeLibraryConditionTarget(value[condition], depth + 1);
    if (target !== '') return target;
  }
  return '';
}

function typeLibraryExportsTarget(value, subpath) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string' || Array.isArray(value)) {
    return subpath === '.' ? typeLibraryConditionTarget(value) : '';
  }
  if (typeof value !== 'object') return '';
  const keys = Object.keys(value);
  if (keys.some((key) => key.startsWith('.'))) {
    if (Object.hasOwn(value, subpath)) return typeLibraryConditionTarget(value[subpath]);
    let bestKey = '';
    let bestTarget = '';
    for (const key of keys) {
      const star = key.indexOf('*');
      if (!key.startsWith('.') || star < 0) continue;
      const prefix = key.slice(0, star);
      const suffix = key.slice(star + 1);
      if (!subpath.startsWith(prefix) || !subpath.endsWith(suffix) || subpath.length < prefix.length + suffix.length) continue;
      if (key.length <= bestKey.length) continue;
      const inserted = subpath.slice(prefix.length, subpath.length - suffix.length);
      const target = typeLibraryConditionTarget(value[key]).replaceAll('*', inserted);
      if (target !== '') {
        bestKey = key;
        bestTarget = target;
      }
    }
    return bestTarget;
  }
  return subpath === '.' ? typeLibraryConditionTarget(value) : '';
}

function typeLibraryImportSubpath(value) {
  let specifier = typeof value === 'string' ? value.trim() : '';
  if (!specifier.startsWith('npm:')) return '.';
  specifier = specifier.slice(4).replace(/[?#].*$/u, '');
  const parts = specifier.split('/');
  const remainder = specifier.startsWith('@') ? parts.slice(2) : parts.slice(1);
  return remainder.length === 0 ? '.' : `./${remainder.join('/')}`;
}

function typeLibraryAliasProxyEntry(specifier) {
  const raw = typeof specifier === 'string' ? specifier.trim().replaceAll('\\', '/').replace(/[?#].*$/u, '') : '';
  if (raw === '' || raw.startsWith('.') || isAbsolute(raw) || /^(?:node|jsr|https?):/u.test(raw)) return null;
  if (raw.startsWith('npm:')) {
    const readable =
      raw
        .slice('npm:'.length)
        .replace(/[^a-z0-9._@-]+/giu, '_')
        .replace(/^_+|_+$/gu, '')
        .slice(0, 120) || 'package';
    const digest =
      readable.length < raw.slice('npm:'.length).length
        ? `-${createHash('sha256').update(raw).digest('hex').slice(0, 10)}`
        : '';
    return { virtualPath: `node_modules/.dsh-editor/npm/${readable}${digest}/index.d.ts` };
  }
  const clean = raw;
  const parts = clean.split('/');
  if (parts.some((segment) => segment === '' || segment === '..')) return null;
  if (clean.startsWith('@') && parts.length < 2) return null;
  const packageParts = clean.startsWith('@') ? parts.slice(0, 2) : parts.slice(0, 1);
  const subpath = (clean.startsWith('@') ? parts.slice(2) : parts.slice(1)).join('/');
  const declarationName =
    subpath === ''
      ? 'index.d.ts'
      : subpath.endsWith('.d.ts')
        ? subpath
        : subpath.endsWith('.d.mts')
          ? subpath
          : subpath.endsWith('.d.cts')
            ? subpath
            : subpath.endsWith('.mjs')
              ? `${subpath.slice(0, -'.mjs'.length)}.d.mts`
              : subpath.endsWith('.cjs')
                ? `${subpath.slice(0, -'.cjs'.length)}.d.cts`
                : subpath.endsWith('.js')
                  ? `${subpath.slice(0, -'.js'.length)}.d.ts`
                  : `${subpath}.d.ts`;
  return {
    virtualPath: `node_modules/${packageParts.join('/')}/${declarationName}`,
  };
}

function typeLibraryTargetDeclaration(relativePackage, target) {
  if (typeof target !== 'string' || !target.startsWith('./')) return '';
  const clean = target.replace(/[?#].*$/u, '').replace(/^\.\/+/u, '');
  if (clean.split('/').some((segment) => segment === '..' || segment === '')) return '';
  if (clean.endsWith('.d.ts') || clean.endsWith('.d.mts') || clean.endsWith('.d.cts')) {
    return `${relativePackage}/${clean}`;
  }
  if (clean.endsWith('.mjs')) return `${relativePackage}/${clean.slice(0, -4)}.d.mts`;
  if (clean.endsWith('.cjs')) return `${relativePackage}/${clean.slice(0, -4)}.d.cts`;
  if (clean.endsWith('.js')) return `${relativePackage}/${clean.slice(0, -3)}.d.ts`;
  const extension = extname(clean);
  return `${relativePackage}/${extension === '' ? clean : clean.slice(0, -extension.length)}.d.ts`;
}

function typeLibraryProxySpecifier(proxyPath, targetPath) {
  const relativeTarget = relative(dirname(proxyPath), targetPath).replaceAll('\\', '/');
  const specifier = relativeTarget.endsWith('.d.ts')
    ? `${relativeTarget.slice(0, -'.d.ts'.length)}.js`
    : relativeTarget.endsWith('.d.mts')
      ? `${relativeTarget.slice(0, -'.d.mts'.length)}.mjs`
      : relativeTarget.endsWith('.d.cts')
        ? `${relativeTarget.slice(0, -'.d.cts'.length)}.cjs`
        : relativeTarget;
  return specifier.startsWith('.') ? specifier : `./${specifier}`;
}

function collectTypeExportProxies(relativePackage, packageName, packageConfig, importSpecifiers, state, aliasPaths) {
  const specifiers = new Map([[packageName, '.']]);
  const exportsValue = packageConfig?.exports;
  if (exportsValue !== null && typeof exportsValue === 'object' && !Array.isArray(exportsValue)) {
    for (const key of Object.keys(exportsValue).slice(0, TYPE_LIBRARY_MAX_PACKAGES)) {
      if (!key.startsWith('./') || key.includes('*') || key.includes('?')) continue;
      const subpath = key.slice(2);
      if (subpath === '' || subpath.split('/').some((segment) => segment === '' || segment === '..')) continue;
      specifiers.set(`${packageName}/${subpath}`, key);
    }
    for (const key of Object.keys(exportsValue).slice(0, TYPE_LIBRARY_MAX_PACKAGES)) {
      const starIndex = key.indexOf('*');
      if (starIndex < 0 || key.indexOf('*', starIndex + 1) >= 0 || !key.startsWith('./')) continue;
      const targetPattern = typeLibraryTargetDeclaration(
        relativePackage,
        typeLibraryConditionTarget(exportsValue[key]),
      );
      const targetStar = targetPattern.indexOf('*');
      if (targetStar < 0) continue;
      const targetPrefix = targetPattern.slice(0, targetStar);
      const targetSuffix = targetPattern.slice(targetStar + 1);
      let wildcardCount = 0;
      for (const file of [...state.files]) {
        if (wildcardCount >= TYPE_LIBRARY_MAX_PACKAGES) break;
        if (!file.path.startsWith(targetPrefix) || !file.path.endsWith(targetSuffix)) continue;
        const inserted = file.path.slice(targetPrefix.length, file.path.length - targetSuffix.length);
        if (inserted === '' || inserted.split('/').some((segment) => segment === '' || segment === '..')) continue;
        const exportSubpath = key.replace('*', inserted);
        const subpath = exportSubpath.slice(2);
        if (subpath === '' || subpath.split('/').some((segment) => segment === '' || segment === '..')) continue;
        specifiers.set(`${packageName}/${subpath}`, exportSubpath);
        wildcardCount += 1;
      }
    }
  }
  for (const entry of importSpecifiers.get(packageName) ?? []) specifiers.set(entry.alias, entry.subpath);
  for (const [alias, subpath] of specifiers) {
    if (state.files.length >= TYPE_LIBRARY_MAX_FILES || state.bytes >= TYPE_LIBRARY_MAX_BYTES) {
      state.truncated = true;
      return;
    }
    const entry = typeLibraryAliasProxyEntry(alias);
    if (entry === null || state.files.some((file) => file.path === entry.virtualPath)) continue;
    let target = typeLibraryExportsTarget(packageConfig?.exports, subpath);
    if (target === '' && alias.startsWith('npm:') && subpath === '.') {
      const declaredTypes = packageConfig?.types ?? packageConfig?.typings;
      if (typeof declaredTypes === 'string' && declaredTypes !== '') {
        target = declaredTypes.startsWith('.') ? declaredTypes : `./${declaredTypes}`;
      }
    }
    const targetPath = typeLibraryTargetDeclaration(relativePackage, target);
    if (targetPath === '') continue;
    const targetFile = state.files.find((file) => file.path === targetPath);
    if (targetFile === undefined) continue;
    const targetSpecifier = typeLibraryProxySpecifier(entry.virtualPath, targetPath);
    let content = `export * from ${JSON.stringify(targetSpecifier)};\n`;
    if (/(?:^|\n)\s*export\s+default\b|(?:^|\n)\s*export\s*\{[^}]*\bdefault\b/u.test(targetFile.content)) {
      content += `export { default } from ${JSON.stringify(targetSpecifier)};\n`;
    }
    const bytes = Buffer.byteLength(content);
    if (state.bytes + bytes > TYPE_LIBRARY_MAX_BYTES) {
      state.truncated = true;
      return;
    }
    state.files.push({ path: entry.virtualPath, content });
    state.bytes += bytes;
    if (alias.startsWith('npm:')) aliasPaths[alias] = [entry.virtualPath];
  }
}

function workspacePackagePatterns(packageConfig) {
  const value = packageConfig?.workspaces;
  const entries = Array.isArray(value) ? value : Array.isArray(value?.packages) ? value.packages : [];
  return entries
    .filter((entry) => typeof entry === 'string' && entry !== '' && !entry.startsWith('!'))
    .map((entry) => entry.replaceAll('\\', '/').replace(/^\.\/+/u, '').replace(/\/+$/u, ''))
    .filter((entry) => !entry.split('/').some((segment) => segment === '..'))
    .slice(0, 50);
}

function workspacePackagePatternMatches(pattern, path) {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/gu, '\\$&')
    .replace(/\*\*/gu, '\u0000')
    .replace(/\*/gu, '[^/]+')
    .replace(/\u0000/gu, '.*');
  return new RegExp(`^${escaped}$`, 'u').test(path);
}

async function readTypeConfig(root, name) {
  const text = await readFile(join(root, name), 'utf8').catch(() => '');
  return text === '' ? null : parseTypeConfigJson(text);
}

async function readFirstTypeConfig(root, names) {
  for (const name of names) {
    const config = await readTypeConfig(root, name);
    if (config !== null) return config;
  }
  return null;
}

function sanitizeDenoRuntimeTypes(value) {
  return String(value ?? '')
    .replace(/^\/\/\/\s*<reference[^>]*>\s*$/gmu, '')
    .trim();
}

function readJsrTypeCatalog() {
  jsrTypeCatalogPromise ??= readFile(JSR_TYPE_BUNDLE_PATH, 'utf8')
    .then((text) => parseTypeConfigJson(text))
    .catch(() => null);
  return jsrTypeCatalogPromise;
}

async function collectWorkspaceJsrTypeLibraries(root, denoConfig, denoLock, state) {
  const catalog = await readJsrTypeCatalog();
  const packages = catalog?.packages !== null && typeof catalog?.packages === 'object' ? catalog.packages : {};
  const requested = new Set();
  for (const specifier of Object.keys(denoLock?.specifiers ?? {})) {
    if (specifier.startsWith('jsr:')) requested.add(specifier);
  }
  const aliases = new Map();
  for (const [alias, imported] of Object.entries(denoConfig?.imports ?? {})) {
    if (typeof imported !== 'string' || !imported.startsWith('jsr:')) continue;
    requested.add(imported);
    const entries = aliases.get(imported) ?? [];
    entries.push(alias);
    aliases.set(imported, entries);
  }
  const paths = {};
  const catalogSpecifiers = Object.keys(packages).sort((left, right) => right.length - left.length);
  for (const specifier of [...requested].slice(0, TYPE_LIBRARY_MAX_PACKAGES)) {
    let catalogSpecifier = '';
    for (const candidate of catalogSpecifiers) {
      if (specifier === candidate || specifier.startsWith(`${candidate}/`)) {
        catalogSpecifier = candidate;
        break;
      }
    }
    if (catalogSpecifier === '') continue;
    const entry = packages[catalogSpecifier];
    if (entry === null || typeof entry !== 'object' || entry.files === null || typeof entry.files !== 'object') continue;
    const packageRoot = typeof entry.root === 'string' ? entry.root.replaceAll('\\', '/').replace(/^\/+/u, '').replace(/\/+$/u, '') : '';
    const subpath = specifier.slice(catalogSpecifier.length);
    const exportKey = subpath === '' ? '.' : `.${subpath}`;
    const exportTarget = typeLibraryExportsTarget(entry.exports, exportKey);
    const entryName = (exportTarget || (subpath === '' ? entry.entry : ''))
      .replaceAll('\\', '/')
      .replace(/^\.\/+/u, '');
    if (
      packageRoot === '' ||
      entryName === '' ||
      packageRoot.split('/').some((segment) => segment === '' || segment === '..') ||
      entryName.split('/').some((segment) => segment === '' || segment === '..')
    ) {
      continue;
    }
    const virtualRoot = `node_modules/.dsh-editor/jsr/${packageRoot}`;
    const virtualEntry = `${virtualRoot}/${entryName}`;
    let packageInstalled = false;
    for (const [relativePath, content] of Object.entries(entry.files).slice(0, TYPE_LIBRARY_MAX_FILES)) {
      if (state.files.length >= TYPE_LIBRARY_MAX_FILES || state.bytes >= TYPE_LIBRARY_MAX_BYTES) {
        state.truncated = true;
        break;
      }
      if (
        typeof relativePath !== 'string' ||
        typeof content !== 'string' ||
        relativePath === '' ||
        relativePath.split('/').some((segment) => segment === '' || segment === '..')
      ) {
        continue;
      }
      const virtualPath = `${virtualRoot}/${relativePath}`;
      if (state.files.some((file) => file.path === virtualPath)) {
        packageInstalled = true;
        continue;
      }
      const bytes = Buffer.byteLength(content);
      if (bytes > TYPE_LIBRARY_MAX_FILE_BYTES) continue;
      if (state.bytes + bytes > TYPE_LIBRARY_MAX_BYTES) {
        state.truncated = true;
        break;
      }
      state.files.push({ path: virtualPath, content });
      state.bytes += bytes;
      packageInstalled = true;
    }
    if (!packageInstalled || !state.files.some((file) => file.path === virtualEntry)) continue;
    paths[specifier] = [virtualEntry];
    for (const alias of aliases.get(specifier) ?? []) {
      if (typeof alias === 'string' && alias !== '') paths[alias] = [virtualEntry];
    }
  }
  return paths;
}

async function collectTypePackageMetadata(root, directory, virtualDirectory, state) {
  if (state.files.length >= TYPE_LIBRARY_MAX_FILES || state.bytes >= TYPE_LIBRARY_MAX_BYTES) return;
  const metadataPath = join(directory, 'package.json');
  const info = await stat(metadataPath).catch(() => null);
  if (info === null || !info.isFile() || info.size > TYPE_LIBRARY_MAX_FILE_BYTES) return;
  if (state.bytes + info.size > TYPE_LIBRARY_MAX_BYTES) {
    state.truncated = true;
    return;
  }
  const content = await readFile(metadataPath, 'utf8').catch(() => '');
  if (content === '') return;
  const virtualPath = `${virtualDirectory}/package.json`;
  if (state.files.some((file) => file.path === virtualPath)) return;
  state.files.push({ path: virtualPath, content });
  state.bytes += Buffer.byteLength(content);
  return parseTypeConfigJson(content);
}

async function collectTypeDeclarationFiles(root, directory, virtualDirectory, state, visited) {
  if (state.files.length >= TYPE_LIBRARY_MAX_FILES || state.bytes >= TYPE_LIBRARY_MAX_BYTES) return;
  if (visited.size >= TYPE_LIBRARY_MAX_DIRECTORIES) {
    state.truncated = true;
    return;
  }
  const realDirectory = await realpath(directory).catch(() => null);
  if (realDirectory === null || !workspacePathIsInside(root, realDirectory) || visited.has(realDirectory)) return;
  visited.add(realDirectory);
  const entries = await readdir(directory, { withFileTypes: true }).catch(() => []);
  entries.sort((left, right) => SEARCH_ENTRY_DEFAULT_COLLATOR.compare(left.name, right.name));
  for (const entry of entries) {
    if (state.files.length >= TYPE_LIBRARY_MAX_FILES || state.bytes >= TYPE_LIBRARY_MAX_BYTES) {
      state.truncated = true;
      return;
    }
    if (entry.name === 'node_modules' || entry.name === '.git') continue;
    /* Monaco already owns the default lib.* declarations. Injecting the
       TypeScript compiler package's copies as extra roots duplicates every
       standard global and inflates the payload for no type information. */
    if (
      virtualDirectory === 'node_modules/typescript/lib' &&
      /^lib(?:\.[a-z0-9.-]+)?\.d\.ts$/iu.test(entry.name)
    ) {
      continue;
    }
    const absolutePath = join(directory, entry.name);
    const virtualPath = `${virtualDirectory}/${entry.name}`;
    const info = entry.isSymbolicLink() ? await stat(absolutePath).catch(() => null) : entry;
    if (info === null) continue;
    if (info.isDirectory()) {
      await collectTypeDeclarationFiles(root, absolutePath, virtualPath, state, visited);
      continue;
    }
    if (!info.isFile() || !isTypeLibraryDeclarationFile(entry.name) || info.size > TYPE_LIBRARY_MAX_FILE_BYTES) {
      continue;
    }
    if (state.bytes + info.size > TYPE_LIBRARY_MAX_BYTES) {
      state.truncated = true;
      return;
    }
    const content = await readFile(absolutePath, 'utf8').catch(() => '');
    if (content === '') continue;
    state.files.push({ path: virtualPath, content });
    state.bytes += Buffer.byteLength(content);
  }
}

async function workspaceTypeLibraries(root) {
  const realRoot = await realpath(root);
  const packageCandidates = new Map();
  const importSpecifiers = new Map();
  const aliasPaths = {};
  const typeNames = new Set();
  const addCandidate = (packageName, typeName = '') => {
    if (packageName === '' || packageCandidates.size >= TYPE_LIBRARY_MAX_PACKAGES) return;
    if (!packageCandidates.has(packageName)) packageCandidates.set(packageName, typeName);
    if (typeName !== '') typeNames.add(typeName);
  };

  const packageConfig = await readTypeConfig(root, 'package.json');
  for (const dependency of Object.keys({
    ...(packageConfig?.dependencies ?? {}),
    ...(packageConfig?.devDependencies ?? {}),
  })) {
    addCandidate(dependency);
  }

  const tsconfig = await readFirstTypeConfig(root, ['tsconfig.json', 'jsconfig.json']);
  const denoConfig = await readFirstTypeConfig(root, ['deno.json', 'deno.jsonc']);
  const denoLock = await readTypeConfig(root, 'deno.lock');
  const compilerConfig = {
    ...(denoConfig?.compilerOptions ?? {}),
    ...(tsconfig?.compilerOptions ?? {}),
  };
  const baseUrl = typeLibraryBaseUrl(compilerConfig.baseUrl);
  for (const config of [tsconfig, denoConfig]) {
    for (const type of Array.isArray(config?.compilerOptions?.types) ? config.compilerOptions.types : []) {
      const packageName = typeLibraryPackageName(type);
      if (packageName === '') continue;
      const normalized = packageName.startsWith('@types/') ? packageName : `@types/${packageName}`;
      addCandidate(normalized, typeLibraryTypeName(normalized));
    }
  }
  for (const [specifier, imported] of Object.entries(denoConfig?.imports ?? {}).slice(0, TYPE_LIBRARY_MAX_PACKAGES)) {
    const packageName = typeLibraryPackageName(imported);
    if (packageName === '') continue;
    addCandidate(packageName);
    const entries = importSpecifiers.get(packageName) ?? [];
    entries.push({ alias: specifier, subpath: typeLibraryImportSubpath(imported) });
    importSpecifiers.set(packageName, entries);
  }
  for (const specifier of Object.keys(denoLock?.specifiers ?? {}).slice(0, TYPE_LIBRARY_MAX_PACKAGES)) {
    if (!specifier.startsWith('npm:')) continue;
    const packageName = typeLibraryPackageName(specifier);
    if (packageName === '') continue;
    addCandidate(packageName);
    const entries = importSpecifiers.get(packageName) ?? [];
    entries.push({ alias: specifier, subpath: typeLibraryImportSubpath(specifier) });
    importSpecifiers.set(packageName, entries);
  }

  const typesDirectory = join(root, 'node_modules', '@types');
  for (const entry of await readdir(typesDirectory, { withFileTypes: true }).catch(() => [])) {
    if (entry.name.startsWith('.')) continue;
    addCandidate(`@types/${entry.name}`, entry.name);
  }

  const state = { files: [], bytes: 0, truncated: false };
  const visited = new Set();
  const workspacePackageDirectories = [];
  for (const [packageName, typeName] of packageCandidates) {
    const relativePackage = packageName.startsWith('@types/')
      ? `node_modules/@types/${packageName.slice('@types/'.length)}`
      : `node_modules/${packageName}`;
    const packageDirectory = join(root, ...relativePackage.split('/'));
    const info = await stat(packageDirectory).catch(() => null);
    if (info === null || !info.isDirectory()) {
      if (typeName !== '') typeNames.delete(typeName);
      continue;
    }
    const candidateConfig = await collectTypePackageMetadata(root, packageDirectory, relativePackage, state);
    await collectTypeDeclarationFiles(realRoot, packageDirectory, relativePackage, state, visited);
    collectTypeExportProxies(relativePackage, packageName, candidateConfig, importSpecifiers, state, aliasPaths);
  }

  const workspacePatterns = workspacePackagePatterns(packageConfig);
  if (workspacePatterns.length > 0) {
    const workspaceDirectories = (await listWorkspaceDirectories(root, 1000)).directories.filter((directory) =>
      workspacePatterns.some((pattern) => workspacePackagePatternMatches(pattern, directory)),
    );
    for (const directory of workspaceDirectories.slice(0, TYPE_LIBRARY_MAX_PACKAGES)) {
      const workspacePackageConfig = await readTypeConfig(root, `${directory}/package.json`);
      const packageName = workspacePackageConfig?.name;
      if (typeof packageName !== 'string' || typeLibraryPackageName(packageName) !== packageName) continue;
      workspacePackageDirectories.push(directory);
      const virtualDirectory = `node_modules/${packageName}`;
      await collectTypePackageMetadata(root, join(root, ...directory.split('/')), virtualDirectory, state);
      await collectTypeDeclarationFiles(
        realRoot,
        join(root, ...directory.split('/')),
        virtualDirectory,
        state,
        visited,
      );
      collectTypeExportProxies(
        virtualDirectory,
        packageName,
        workspacePackageConfig,
        importSpecifiers,
        state,
        aliasPaths,
      );
    }
  }

  const localDeclarations = await listWorkspaceFiles(
    root,
    Math.max(0, Math.min(400, TYPE_LIBRARY_MAX_FILES - state.files.length)),
    { includeExcluded: false, respectGitIgnore: false, fileMask: '*.d.ts,*.d.mts,*.d.cts' },
  );
  for (const relativePath of localDeclarations.files) {
    if (state.files.length >= TYPE_LIBRARY_MAX_FILES || state.bytes >= TYPE_LIBRARY_MAX_BYTES) {
      state.truncated = true;
      break;
    }
    if (workspacePackageDirectories.some((directory) => relativePath.startsWith(`${directory}/`))) continue;
    const info = await stat(join(root, ...relativePath.split('/'))).catch(() => null);
    if (info === null || !info.isFile() || info.size > TYPE_LIBRARY_MAX_FILE_BYTES) continue;
    if (state.bytes + info.size > TYPE_LIBRARY_MAX_BYTES) {
      state.truncated = true;
      break;
    }
    const content = await readFile(join(root, ...relativePath.split('/')), 'utf8').catch(() => '');
    if (content === '') continue;
    state.files.push({ path: relativePath, content });
    state.bytes += Buffer.byteLength(content);
  }

  const jsrPaths = await collectWorkspaceJsrTypeLibraries(root, denoConfig, denoLock, state);

  if (denoConfig !== null) {
    let content = '';
    try {
      const { stdout } = await execFileAsync('deno', ['types'], {
        cwd: root,
        timeout: 3000,
        maxBuffer: TYPE_LIBRARY_MAX_FILE_BYTES,
      });
      content = sanitizeDenoRuntimeTypes(stdout);
    } catch {
      /* The checked-in snapshot is used when the Deno CLI is unavailable. */
    }
    if (content === '') {
      content = sanitizeDenoRuntimeTypes(await readFile(DENO_RUNTIME_TYPES_PATH, 'utf8').catch(() => ''));
    }
    if (content !== '' && state.bytes + Buffer.byteLength(content) <= TYPE_LIBRARY_MAX_BYTES) {
      state.files.push({ path: 'node_modules/.dsh-editor/deno.ns.d.ts', content });
      state.bytes += Buffer.byteLength(content);
    }
  }

  return {
    files: state.files,
    types: [...typeNames].sort(),
    typeRoots: state.files.some((file) => file.path.startsWith('node_modules/@types/'))
      ? ['node_modules/@types']
      : [],
    baseUrl,
    paths: {
      ...typeLibraryCompilerPaths(compilerConfig.paths),
      ...denoLocalImportMapPaths(denoConfig?.imports, baseUrl),
      ...aliasPaths,
      ...jsrPaths,
    },
    truncated: state.truncated,
    totalBytes: state.bytes,
  };
}

function workspacePathIsInside(root, candidate) {
  const relativePath = relative(root, candidate);
  return relativePath === '' || (!relativePath.startsWith('..') && !isAbsolute(relativePath));
}

/**
 * Walk the workspace once for the quick-open palette.
 *
 * Bounded on purpose: a quick-open list is a navigation aid, not a full index,
 * so heavy directories (see {@link WALK_IGNORED}) are skipped and the walk
 * stops at a fixed ceiling.
 * @param {string} root - workspace root.
 * @param {number} limit - maximum number of files.
 * @param {{includeExcluded?: boolean, includeDirectories?: boolean, directoryLimit?: number, directory?: string, respectGitIgnore?: boolean, searchDirectoryRules?: object, searchSessionId?: string, searchRevision?: number, fileMask?: string, includeFile?: (path: string) => boolean, signal?: AbortSignal}} [options] - include heavy workspace directories except VCS metadata, collect directories with an optional independent bound, start below one directory, apply search exclusions, filter files before the result budget and stop when the request is cancelled.
 * @returns {Promise<{files: string[], directories?: string[], directoriesTruncated?: boolean, truncated: boolean}>} workspace-relative files and optional directories.
 */
async function listWorkspaceFiles(root, limit = 2000, options = {}) {
  if (options?.signal?.aborted === true) return { files: [], truncated: false };
  const includeExcluded = options?.includeExcluded === true;
  const recursive = options?.recursive !== false;
  const scopeDirectory = normalizeWorkspaceScopePath(options?.directory);
  if (scopeDirectory === null) return { files: [], truncated: false };
  const searchDirectoryRules = normalizeSearchDirectoryRules(options?.searchDirectoryRules);
  const fileMask = compileWorkspaceFileMask(options?.fileMask);
  const includeFile = typeof options?.includeFile === 'function' ? options.includeFile : null;
  const includeDirectories = options?.includeDirectories === true;
  const requestedDirectoryLimit = Math.floor(Number(options?.directoryLimit));
  const separateDirectoryLimit =
    Number.isFinite(requestedDirectoryLimit) && requestedDirectoryLimit > 0;
  const directoryLimit = separateDirectoryLimit ? Math.min(50_000, requestedDirectoryLimit) : limit;
  const gitIgnoredPrefixes = options?.gitIgnoredPrefixes instanceof Set
    ? options.gitIgnoredPrefixes
    : Array.isArray(options?.gitIgnoredPrefixes)
      ? new Set(normalizeSearchDirectoryPaths(options.gitIgnoredPrefixes))
    : options?.respectGitIgnore === true
      ? await listGitIgnoredSearchPrefixes(root, options)
      : new Set();
  if (options?.signal?.aborted === true) return { files: [], truncated: false };
  const searchPathAllowed = (path) => searchPathAllowedByDirectoryRules(path, searchDirectoryRules);
  if (
    scopeDirectory !== ''
    && !searchDirectoryNeedsTraversal(scopeDirectory, searchDirectoryRules)
  ) {
    return { files: [], truncated: false };
  }
  const files = [];
  const directories = [];
  let directoriesTruncated = false;
  const queue = [scopeDirectory];
  const visitedDirectories = new Set();
  let truncated = false;
  search: while (queue.length > 0) {
    if (options?.signal?.aborted === true) return { files: [], truncated: false };
    const directory = queue.shift();
    const identity = await directoryTraversalIdentity(resolveInside(root, directory));
    if (identity === null || visitedDirectories.has(identity)) continue;
    visitedDirectories.add(identity);
    const entries = await listDirectory(root, directory, {
      showHidden: true,
      showExcluded: includeExcluded,
      metadata: false,
      knownDirectory: true,
      realDirectory: identity,
    }).catch(() => ({ entries: [] }));
    if (options?.signal?.aborted === true) return { files: [], truncated: false };
    for (const entry of entries.entries) {
      if (options?.signal?.aborted === true) return { files: [], truncated: false };
      if (searchPathIsSystemGenerated(entry.path)) continue;
      if (WALK_IGNORED.has(basename(entry.path))) {
        if (!includeExcluded || VCS_METADATA_DIRECTORIES.has(basename(entry.path))) continue;
      }
      if (searchPathIsGitIgnored(entry.path, gitIgnoredPrefixes)) continue;
      const allowed = searchPathAllowed(entry.path);
      if (entry.kind === 'directory') {
        if (!allowed && !searchDirectoryNeedsTraversal(entry.path, searchDirectoryRules)) continue;
        if (allowed && includeDirectories) {
          if (directories.length >= directoryLimit) {
            if (separateDirectoryLimit) {
              directoriesTruncated = true;
            } else {
              truncated = true;
              break search;
            }
          } else directories.push(entry.path);
        }
        if (recursive !== false) queue.push(entry.path);
      } else {
        if (!allowed) continue;
        if (fileMask !== null && !fileMask.matches(entry.path)) continue;
        if (includeFile !== null && !includeFile(entry.path)) continue;
        if (files.length >= limit) {
          truncated = true;
          break search;
        }
        files.push(entry.path);
      }
    }
  }
  return includeDirectories ? { files, directories, directoriesTruncated, truncated } : { files, truncated };
}

/**
 * Project the persisted, watcher-fresh path snapshot into the bounded file-list
 * contract used by Search Everywhere.
 * @param {string} root - workspace root.
 * @param {number} limit - maximum returned files.
 * @param {{respectGitIgnore?: boolean, searchDirectoryRules?: object, fileMask?: string, searchIndex?: boolean, searchIndexDirectory?: string, signal?: AbortSignal}} [options] - same scope controls as the live file list.
 * @returns {Promise<{files: string[], truncated: boolean, indexFastPath: true}|null>} indexed files or null when live traversal must own the request.
 */
async function listWorkspaceIndexedFiles(root, limit, options = {}) {
  if (options?.searchIndex !== true || options?.signal?.aborted === true) return null;
  const identity = searchIndexIdentity(root, options);
  const scopeSignature = searchIndexScopeSignature(options);
  const queryView = await readWorkspaceSearchPathQueryView(root, options);
  /* This provider only returns file paths, so a complete directory stream is
     not required. An incomplete file snapshot is still a useful bounded
     candidate set and is reported as truncated below. */
  if (
    searchIndexPathQueryViewCanServe(
      root,
      identity,
      queryView,
      { ...options, filesOnly: true },
      scopeSignature,
    )
  ) {
    const searchDirectoryRules = normalizeSearchDirectoryRules(options?.searchDirectoryRules);
    const fileMask = compileWorkspaceFileMask(options?.fileMask);
    const files = [];
    let truncated =
      queryView.header.complete !== true || queryView.header.pathTruncated === true;
    let offset = 0;
    while (offset < queryView.text.length) {
      if (options?.signal?.aborted === true) return null;
      const recordEnd = queryView.text.indexOf('\0', offset + 1);
      if (recordEnd < 0) break;
      if (queryView.text[offset] === 'F') {
        const path = queryView.text.slice(offset + 1, recordEnd);
        if (
          path !== ''
          && searchPathAllowedByDirectoryRules(path, searchDirectoryRules)
          && !searchPathIsSystemGenerated(path)
          && (fileMask === null || fileMask.matches(path))
        ) {
          if (files.length >= limit) {
            truncated = true;
            break;
          }
          files.push(path);
        }
      }
      offset = recordEnd + 1;
    }
    return {
      files,
      truncated,
      indexFastPath: true,
      scopeComplete: queryView.header.complete === true && queryView.header.pathTruncated !== true,
    };
  }
  const index = await readWorkspaceSearchPathIndex(root, options);
  if (!searchIndexCanProvidePathListing(root, identity, index, options, scopeSignature)) return null;
  const searchDirectoryRules = normalizeSearchDirectoryRules(options?.searchDirectoryRules);
  const fileMask = compileWorkspaceFileMask(options?.fileMask);
  const files = [];
  let truncated = index.pathTruncated === true;
  for (const path of Object.keys(index.files)) {
    if (options?.signal?.aborted === true) return null;
    if (!searchPathAllowedByDirectoryRules(path, searchDirectoryRules)) continue;
    if (searchPathIsSystemGenerated(path)) continue;
    if (fileMask !== null && !fileMask.matches(path)) continue;
    if (files.length >= limit) {
      truncated = true;
      break;
    }
    files.push(path);
  }
  return {
    files,
    truncated,
    indexFastPath: true,
    scopeComplete: index.pathScanComplete === true && index.pathTruncated !== true,
  };
}

/** Prefer a fresh persisted path projection and fall back to the live workspace walk. */
async function workspaceFilesForRequest(root, limit, options = {}) {
  const indexedFiles = await listWorkspaceIndexedFiles(root, limit, options);
  return indexedFiles ?? listWorkspaceFiles(root, limit, options);
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
 * @param {((path: string) => boolean)|null} [includeFile] - apply the text-search scope before the file budget.
 * @param {AbortSignal|null} [signal] - request cancellation.
 * @returns {Promise<{files: string[], truncated: boolean}|null>} bounded file list.
 */
async function listGitSearchScopeFiles(root, value, includeFile = null, signal = null) {
  if (signal?.aborted === true) return { files: [], truncated: false };
  const scope = normalizeGitSearchScope(value);
  if (scope === null) return null;
  const prefix = (await runGit(root, ['rev-parse', '--show-prefix']).catch(() => '')).trim();
  const args = scope === 'tracked'
    ? ['ls-files', '-z', '--cached']
    : ['ls-files', '-z', '--cached', '--others', '--exclude-standard'];
  const raw = await runGit(root, args);
  if (signal?.aborted === true) return { files: [], truncated: false };
  const files = [];
  let truncated = false;
  for (const record of raw.split('\0')) {
    if (signal?.aborted === true) return { files: [], truncated: false };
    if (record === '') continue;
    const normalized = record.replaceAll('\\', '/').replace(/^\.\/+/u, '');
    let relativePath = normalized;
    if (prefix !== '' && normalized.startsWith(prefix)) relativePath = normalized.slice(prefix.length);
    if (relativePath === '' || relativePath.startsWith('/') || relativePath.split('/').some((segment) => segment === '..')) continue;
    if (searchPathIsSystemGenerated(relativePath)) continue;
    if (includeFile !== null && !includeFile(relativePath)) continue;
    if (files.length >= GIT_SEARCH_SCOPE_MAX_FILES) {
      truncated = true;
      break;
    }
    files.push(relativePath);
  }
  return { files, truncated };
}

function normalizeSearchDirectoryPath(value) {
  if (typeof value !== 'string') return '';
  const normalized = value.trim().replaceAll('\\', '/').replace(/^\.\/+/u, '').replace(/\/+$/u, '');
  if (
    normalized === ''
    || normalized.startsWith('/')
    || normalized.split('/').some((segment) => segment === '' || segment === '.' || segment === '..')
  ) {
    return '';
  }
  return normalized;
}

function normalizeSearchDirectoryPaths(value) {
  const entries = Array.isArray(value) ? value : [];
  return [...new Set(entries.map(normalizeSearchDirectoryPath).filter((path) => path !== ''))].slice(0, 200);
}

function normalizeSearchDirectoryRules(value) {
  const source = value !== null && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const excludedDirectories = normalizeSearchDirectoryPaths(
    source.excludedDirectories ?? source.excludeDirectories ?? source.excluded,
  );
  const requestedIncludedDirectories = normalizeSearchDirectoryPaths(
    source.includedDirectories ?? source.includeDirectories ?? source.included,
  );
  return {
    excludedDirectories,
    includedDirectories: requestedIncludedDirectories.filter((included) =>
      excludedDirectories.some((excluded) => included.startsWith(`${excluded}/`)),
    ),
  };
}

/** Stable identity for the directory rules that shaped a persisted path list. */
function searchIndexScopeSignature(options = {}) {
  const rules = normalizeSearchDirectoryRules(options?.searchDirectoryRules);
  return JSON.stringify({
    excluded: [...rules.excludedDirectories].sort(),
    included: [...rules.includedDirectories].sort(),
  });
}

/** Whether a complete, fresh path cache may supply a search candidate list. */
function searchIndexCanProvidePathListing(root, identity, index, options, scopeSignature) {
  const progress = SEARCH_INDEX_REBUILD_PROGRESS.get(identity?.key);
  return (
    index !== null
    && identity !== null
    && options?.searchIndex === true
    && (index.pathScanComplete === true || index.pathTruncated === true)
    && index.pathScanStale !== true
    && index.scopeSignature === scopeSignature
    && options?.includeExcluded !== true
    && (progress?.building !== true || progress.kind === 'update')
    && workspaceSearchIndexWatcherActive(root)
  );
}

function searchDirectoryRuleMatches(path, rule) {
  return path === rule || path.startsWith(`${rule}/`);
}

function searchPathAllowedByDirectoryRules(path, rules) {
  let excludedDepth = -1;
  let includedDepth = -1;
  for (const rule of rules.excludedDirectories) {
    if (searchDirectoryRuleMatches(path, rule)) excludedDepth = Math.max(excludedDepth, rule.split('/').length);
  }
  for (const rule of rules.includedDirectories) {
    if (searchDirectoryRuleMatches(path, rule)) includedDepth = Math.max(includedDepth, rule.split('/').length);
  }
  return excludedDepth <= includedDepth;
}

function searchDirectoryNeedsTraversal(path, rules) {
  return searchPathAllowedByDirectoryRules(path, rules)
    || rules.includedDirectories.some((rule) => rule.startsWith(`${path}/`));
}

/** Page/revision-scoped Git ignore cache; direct Host calls omit both keys. */
const GIT_IGNORED_SEARCH_CACHE_MAX = 32;
const GIT_IGNORED_SEARCH_CACHE = new Map();
const GIT_IGNORED_SEARCH_SESSION_KEYS = new Map();
const GIT_GLOBAL_EXCLUDES_PATH_CACHE_MAX = 32;
const GIT_GLOBAL_EXCLUDES_PATH_CACHE_TTL = 2000;
const GIT_GLOBAL_EXCLUDES_PATH_CACHE = new Map();

/** Read the configured global excludes path once per recent search revision. */
async function gitGlobalExcludesRequestedPath(root, cacheKey) {
  const now = Date.now();
  const cached = cacheKey === '' ? undefined : GIT_GLOBAL_EXCLUDES_PATH_CACHE.get(cacheKey);
  if (cached !== undefined && now - cached.createdAt < GIT_GLOBAL_EXCLUDES_PATH_CACHE_TTL) {
    return cached.promise;
  }
  const pending = runGit(root, ['config', '--path', '--get', 'core.excludesFile'])
    .catch(() => '')
    .then((configured) => {
      const requested = configured.trim();
      const fallback = join(process.env.XDG_CONFIG_HOME ?? join(process.env.HOME ?? homedir(), '.config'), 'git', 'ignore');
      return requested === '' ? fallback : requested;
    });
  if (cacheKey !== '') {
    GIT_GLOBAL_EXCLUDES_PATH_CACHE.delete(cacheKey);
    GIT_GLOBAL_EXCLUDES_PATH_CACHE.set(cacheKey, { promise: pending, createdAt: now });
    while (GIT_GLOBAL_EXCLUDES_PATH_CACHE.size > GIT_GLOBAL_EXCLUDES_PATH_CACHE_MAX) {
      const oldest = GIT_GLOBAL_EXCLUDES_PATH_CACHE.keys().next().value;
      if (oldest === undefined) break;
      GIT_GLOBAL_EXCLUDES_PATH_CACHE.delete(oldest);
    }
  }
  return pending;
}

/** Fingerprint the configured global excludes file so external edits invalidate cache entries. */
async function gitGlobalExcludesFingerprint(root, cacheKey) {
  const requested = await gitGlobalExcludesRequestedPath(root, cacheKey);
  const path = isAbsolute(requested) ? requested : resolve(root, requested);
  const content = await readFile(path).catch(() => null);
  return content === null
    ? `${path}\u0000missing`
    : `${path}\u0000${createHash('sha256').update(content).digest('hex')}`;
}

/**
 * List Git-ignored files/directories under the workspace without crossing into
 * heavy dependency trees. Search surfaces use these prefixes as hard excludes.
 * @param {string} root - workspace root.
 * @param {{searchSessionId?: string, searchRevision?: number}} [cacheContext] - page-scoped cache identity.
 * @returns {Promise<Set<string>>} workspace-relative ignored path/prefix set.
 */
async function listGitIgnoredSearchPrefixes(root, cacheContext = {}) {
  const sessionId = typeof cacheContext?.searchSessionId === 'string' ? cacheContext.searchSessionId.trim() : '';
  const revision = Number.isInteger(cacheContext?.searchRevision) && cacheContext.searchRevision >= 0
    ? cacheContext.searchRevision
    : null;
  const sessionKey = sessionId === '' || revision === null ? '' : `${root}\u0000${sessionId}`;
  const revisionKey = sessionKey === '' ? '' : `${sessionKey}\u0000${revision}`;
  const globalExcludes = revisionKey === '' ? '' : await gitGlobalExcludesFingerprint(root, revisionKey);
  const cacheKey = revisionKey === '' ? '' : `${revisionKey}\u0000${globalExcludes}`;
  if (cacheKey !== '' && GIT_IGNORED_SEARCH_CACHE.has(cacheKey)) return GIT_IGNORED_SEARCH_CACHE.get(cacheKey);
  const pending = readGitIgnoredSearchPrefixes(root);
  if (cacheKey !== '') {
    GIT_IGNORED_SEARCH_SESSION_KEYS.delete(sessionKey);
    GIT_IGNORED_SEARCH_SESSION_KEYS.set(sessionKey, cacheKey);
    for (const key of [...GIT_IGNORED_SEARCH_CACHE.keys()]) {
      if (key !== cacheKey && key.startsWith(`${sessionKey}\u0000`)) GIT_IGNORED_SEARCH_CACHE.delete(key);
    }
    while (GIT_IGNORED_SEARCH_SESSION_KEYS.size > GIT_IGNORED_SEARCH_CACHE_MAX) {
      const oldestSession = GIT_IGNORED_SEARCH_SESSION_KEYS.keys().next().value;
      if (oldestSession === undefined) break;
      GIT_IGNORED_SEARCH_SESSION_KEYS.delete(oldestSession);
      for (const key of [...GIT_IGNORED_SEARCH_CACHE.keys()]) {
        if (key.startsWith(`${oldestSession}\u0000`)) GIT_IGNORED_SEARCH_CACHE.delete(key);
      }
    }
    while (GIT_IGNORED_SEARCH_CACHE.size >= GIT_IGNORED_SEARCH_CACHE_MAX) {
      const oldest = GIT_IGNORED_SEARCH_CACHE.keys().next().value;
      if (oldest === undefined) break;
      GIT_IGNORED_SEARCH_CACHE.delete(oldest);
    }
    GIT_IGNORED_SEARCH_CACHE.set(cacheKey, pending);
  }
  try {
    const ignored = await pending;
    if (cacheKey !== '' && GIT_IGNORED_SEARCH_SESSION_KEYS.get(sessionKey) === cacheKey) {
      while (GIT_IGNORED_SEARCH_CACHE.size >= GIT_IGNORED_SEARCH_CACHE_MAX && !GIT_IGNORED_SEARCH_CACHE.has(cacheKey)) {
        const oldest = GIT_IGNORED_SEARCH_CACHE.keys().next().value;
        if (oldest === undefined) break;
        GIT_IGNORED_SEARCH_CACHE.delete(oldest);
      }
      GIT_IGNORED_SEARCH_CACHE.set(cacheKey, ignored);
    }
    return ignored;
  } catch (failure) {
    if (cacheKey !== '') GIT_IGNORED_SEARCH_CACHE.delete(cacheKey);
    throw failure;
  }
}

/** Read the current Git-ignored path/prefix set without caching. */
async function readGitIgnoredPrefixesForRepository(gitRoot, workspacePrefix = '') {
  const prefix = (await runGit(gitRoot, ['rev-parse', '--show-prefix']).catch(() => '')).trim();
  if (prefix === '') {
    const inside = await runGit(gitRoot, ['rev-parse', '--is-inside-work-tree']).catch(() => '');
    if (inside.trim() !== 'true') return [];
  }
  const raw = await runGit(gitRoot, [
    'ls-files',
    '-z',
    '--cached',
    '--others',
    '--ignored',
    '--exclude-standard',
    '--directory',
  ]);
  const ignored = [];
  for (const record of raw.split('\0')) {
    if (record === '') continue;
    const normalized = record.replaceAll('\\', '/').replace(/^\.\/+/u, '').replace(/\/+$/u, '');
    let relativePath = normalized;
    if (prefix !== '' && normalized.startsWith(prefix)) relativePath = normalized.slice(prefix.length);
    if (
      relativePath === ''
      || relativePath.startsWith('/')
      || relativePath.split('/').some((segment) => segment === '..')
    ) {
      continue;
    }
    ignored.push(workspacePrefix === '' ? relativePath : `${workspacePrefix}/${relativePath}`);
  }
  return ignored;
}

async function listNestedGitWorkspaceRoots(root) {
  const maximumRepositories = 32;
  const maximumDirectories = 2000;
  const roots = [];
  const queue = [''];
  const visitedDirectories = new Set();
  let visited = 0;
  while (queue.length > 0 && roots.length < maximumRepositories && visited < maximumDirectories) {
    const directory = queue.shift();
    const absoluteDirectory = join(root, ...directory.split('/').filter(Boolean));
    const identity = await directoryTraversalIdentity(absoluteDirectory);
    if (identity === null || visitedDirectories.has(identity)) continue;
    visitedDirectories.add(identity);
    const entries = await readdir(absoluteDirectory, { withFileTypes: true }).catch(() => []);
    entries.sort((left, right) => SEARCH_ENTRY_DEFAULT_COLLATOR.compare(left.name, right.name));
    for (const entry of entries) {
      if (entry.name === '.git') continue;
      if (WALK_IGNORED.has(entry.name) || VCS_METADATA_DIRECTORIES.has(entry.name)) continue;
      const relativePath = directory === '' ? entry.name : `${directory}/${entry.name}`;
      const absolutePath = join(root, ...relativePath.split('/'));
      const entryInfo = entry.isSymbolicLink() ? await stat(absolutePath).catch(() => null) : entry;
      if (entryInfo === null || !entryInfo.isDirectory()) continue;
      const gitEntry = await lstat(join(absolutePath, '.git')).catch(() => null);
      visited += 1;
      if (gitEntry !== null) {
        roots.push(relativePath);
        if (roots.length >= maximumRepositories) break;
        continue;
      }
      if (visited < maximumDirectories) queue.push(relativePath);
    }
  }
  return roots;
}

/** Read the current Git-ignored path/prefix set without caching. */
async function readGitIgnoredSearchPrefixes(root) {
  const ignored = new Set();
  for (const relativePath of await readGitIgnoredPrefixesForRepository(root)) ignored.add(relativePath);
  for (const nestedRoot of await listNestedGitWorkspaceRoots(root)) {
    const absoluteRoot = join(root, ...nestedRoot.split('/'));
    for (const relativePath of await readGitIgnoredPrefixesForRepository(absoluteRoot, nestedRoot)) {
      ignored.add(relativePath);
    }
  }
  return ignored;
}

const GIT_IGNORED_PATH_RESULTS = new WeakMap();

function searchPathIsGitIgnored(path, ignoredPrefixes) {
  if (ignoredPrefixes.size === 0) return false;
  let cache = GIT_IGNORED_PATH_RESULTS.get(ignoredPrefixes);
  if (cache === undefined) {
    cache = new Map();
    GIT_IGNORED_PATH_RESULTS.set(ignoredPrefixes, cache);
  }
  const known = cache.get(path);
  if (known !== undefined) return known;
  const separator = path.lastIndexOf('/');
  const ignored =
    ignoredPrefixes.has(path)
    || (separator >= 0 && searchPathIsGitIgnored(path.slice(0, separator), ignoredPrefixes));
  cache.set(path, ignored);
  return ignored;
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
  const visitedDirectories = new Set();
  let truncated = false;
  search: while (queue.length > 0) {
    const directory = queue.shift();
    const identity = await directoryTraversalIdentity(resolveInside(root, directory));
    if (identity === null || visitedDirectories.has(identity)) continue;
    visitedDirectories.add(identity);
    const entries = await listDirectory(root, directory, {
      showHidden: true,
      metadata: false,
      knownDirectory: true,
      realDirectory: identity,
    }).catch(() => ({
      entries: [],
    }));
    for (const entry of entries.entries) {
      if (WALK_IGNORED.has(basename(entry.path))) continue;
      if (entry.kind !== 'directory') continue;
      if (directories.length >= limit) {
        truncated = true;
        break search;
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
 * @param {{showHidden?: boolean, showExcluded?: boolean, includeExcluded?: boolean, sort?: string, foldersFirst?: boolean, respectGitIgnore?: boolean, searchDirectoryRules?: object, fileMask?: string, searchIndex?: boolean, searchIndexDirectory?: string, filesOnly?: boolean, matchPath?: boolean, signal?: AbortSignal, maxVisited?: number}} [options] - Project View preferences, search exclusions, file mask, persisted path cache, file-only provider query, path matching, request cancellation and an internal bounded traversal override.
 * @returns {Promise<{entries: Array<{path: string, name: string, kind: string}>, truncated: boolean}>} matches.
 */
async function searchWorkspaceEntries(root, query, options = {}) {
  const needle = typeof query === 'string' ? query.trim().toLowerCase() : '';
  if (needle === '') return { entries: [], truncated: false };
  if (options.signal?.aborted === true) return { entries: [], truncated: false };
  const maxMatches = 200;
  const maxVisited = Math.max(1, Math.min(50_000, Math.floor(Number(options.maxVisited) || 50_000)));
  const entries = [];
  const liveIndexPaths = new Set();
  const liveIndexDirectories = new Set();
  const queue = [''];
  const visitedDirectories = new Set();
  const searchDirectoryRules = normalizeSearchDirectoryRules(options?.searchDirectoryRules);
  const fileMask = compileWorkspaceFileMask(options?.fileMask);
  const sortMode = typeof options.sort === 'string' ? options.sort : 'name';
  let gitIgnoredPrefixes = null;
  const indexIdentity = options?.searchIndex === true ? searchIndexIdentity(root, options) : null;
  const indexGeneration = indexIdentity === null ? 0 : (SEARCH_INDEX_GENERATIONS.get(indexIdentity.key) ?? 0);
  const scanInvalidationRevision =
    indexIdentity === null ? 0 : SEARCH_INDEX_SCAN_INVALIDATION_REVISIONS.get(indexIdentity.key) ?? 0;
  const indexRebuildingNow =
    indexIdentity !== null && SEARCH_INDEX_REBUILD_PROGRESS.get(indexIdentity.key)?.building === true;
  const scopeSignature = searchIndexScopeSignature(options);
  if (
    indexIdentity !== null
    && sortMode !== 'modified'
    && sortMode !== 'modified-asc'
    && options.includeExcluded !== true
  ) {
    const queryView = await readWorkspaceSearchPathQueryView(root, options);
    if (searchIndexPathQueryViewCanServe(root, indexIdentity, queryView, options, scopeSignature)) {
      const pathQueryCacheKey = searchWorkspacePathQueryCacheKey(
        indexIdentity,
        queryView,
        scanInvalidationRevision,
        indexGeneration,
        needle,
        options,
        scopeSignature,
      );
      const cachedPathQuery = SEARCH_PATH_QUERY_CACHE.get(pathQueryCacheKey);
      if (cachedPathQuery !== undefined && options.signal?.aborted !== true) {
        SEARCH_PATH_QUERY_CACHE.delete(pathQueryCacheKey);
        SEARCH_PATH_QUERY_CACHE.set(pathQueryCacheKey, cachedPathQuery);
        return {
          entries: cachedPathQuery.entries.map((entry) => ({ ...entry })),
          truncated: cachedPathQuery.truncated,
          indexFastPath: true,
          pathQueryCacheHit: true,
        };
      }
      const candidateLimit = maxMatches + SEARCH_INDEX_STAT_CONCURRENCY * 2;
      const collector = searchIndexBoundedCollector(
        entrySortComparator(sortMode, options?.foldersFirst !== false),
        candidateLimit,
      );
      const seen = new Set();
      let candidateCount = 0;
      searchWorkspacePathQueryView(queryView, needle, options, (recordPath, recordKind) => {
        if (options.signal?.aborted === true) return false;
        if (options.filesOnly === true && recordKind !== 'file') return true;
        if (options.showHidden !== true && recordPath.split('/').some((segment) => segment.startsWith('.')))
          return true;
        if (searchPathIsSystemGenerated(recordPath)) return true;
        if (!searchPathAllowedByDirectoryRules(recordPath, searchDirectoryRules)) return true;
        if (recordKind === 'file' && fileMask !== null && !fileMask.matches(recordPath)) return true;
        const key = `${recordKind}:${recordPath}`;
        if (seen.has(key)) return true;
        seen.add(key);
        candidateCount += 1;
        collector.push({
          path: recordPath,
          name: recordPath.slice(recordPath.lastIndexOf('/') + 1),
          kind: recordKind,
          mtime: 0,
        });
        return true;
      });
      if (options.signal?.aborted !== true) {
        const sorted = collector.sorted();
        const verified = [];
        let cursor = 0;
        let queryTruncated =
          queryView.header.complete !== true
          || queryView.header.pathTruncated === true
          || candidateCount > candidateLimit;
        while (cursor < sorted.length && verified.length < maxMatches) {
          if (options.signal?.aborted === true) return { entries: [], truncated: false };
          const batch = sorted.slice(cursor, cursor + SEARCH_INDEX_STAT_CONCURRENCY);
          const states = await Promise.all(
            batch.map(async (entry) => {
              let absolutePath = null;
              try {
                absolutePath = resolveInside(root, entry.path);
              } catch {
                return null;
              }
              const info = await stat(absolutePath).catch(() => null);
              const exists =
                info !== null && (entry.kind === 'directory' ? info.isDirectory() : info.isFile());
              return exists ? entry : null;
            }),
          );
          if (options.signal?.aborted === true) return { entries: [], truncated: false };
          for (const entry of states) {
            if (entry === null) continue;
            if (verified.length >= maxMatches) {
              queryTruncated = true;
              break;
            }
            verified.push(entry);
          }
          cursor += batch.length;
        }
        if (verified.length >= maxMatches && cursor < sorted.length) queryTruncated = true;
        const pathQueryResult = {
          entries: verified,
          truncated: queryTruncated,
          indexFastPath: true,
        };
        if (verified.length > 0 && options.signal?.aborted !== true) {
          rememberWorkspaceSearchPathQueryResult(pathQueryCacheKey, verified, queryTruncated);
        }
        return pathQueryResult;
      }
    }
  }
  gitIgnoredPrefixes ??=
    options?.respectGitIgnore === true ? await listGitIgnoredSearchPrefixes(root, options) : new Set();
  if (options.signal?.aborted === true) return { entries: [], truncated: false };
  const storedIndex =
    indexIdentity === null || indexRebuildingNow ? null : await readWorkspaceSearchPathIndex(root, options);
  const indexFastPath =
    storedIndex !== null
    && (storedIndex.pathScanComplete === true || storedIndex.pathTruncated === true)
    && (options?.filesOnly === true || storedIndex.directoryScanComplete === true || storedIndex.pathTruncated === true)
    && storedIndex.pathScanStale !== true
    && storedIndex.scopeSignature === scopeSignature
    && options?.includeExcluded !== true
    && options?.respectGitIgnore === true
    && workspaceSearchIndexWatcherActive(root);
  if (options.signal?.aborted === true) return { entries: [], truncated: false };
  let visited = 0;
  let truncated = indexFastPath && storedIndex?.pathTruncated === true;
  const entryMatchesNeedle = (entry) =>
    (options.matchPath === true ? entry.path : entry.name).toLowerCase().includes(needle);
  if (!indexFastPath) {
    search: while (queue.length > 0) {
      if (options.signal?.aborted === true) return { entries: [], truncated: false };
      const directory = queue.shift();
      const identity = await directoryTraversalIdentity(resolveInside(root, directory));
      if (identity === null || visitedDirectories.has(identity)) continue;
      visitedDirectories.add(identity);
      const listing = await listDirectory(root, directory, {
        showHidden: options.showHidden === true,
        sort: sortMode,
        foldersFirst: options.foldersFirst !== false,
        showExcluded: options.showExcluded === true,
        metadata: sortMode === 'modified' || sortMode === 'modified-asc',
        knownDirectory: true,
        realDirectory: identity,
      }).catch(() => ({ entries: [] }));
      for (const entry of listing.entries) {
        if (options.signal?.aborted === true) return { entries: [], truncated: false };
        if (searchPathIsSystemGenerated(entry.path)) continue;
        if (WALK_IGNORED.has(entry.name)) continue;
        if (searchPathIsGitIgnored(entry.path, gitIgnoredPrefixes)) continue;
        const allowed = searchPathAllowedByDirectoryRules(entry.path, searchDirectoryRules);
        if (entry.kind === 'directory') {
          if (!allowed && !searchDirectoryNeedsTraversal(entry.path, searchDirectoryRules)) continue;
          if (options.searchIndex === true && allowed) liveIndexDirectories.add(entry.path);
          visited += 1;
          if (visited > maxVisited) {
            truncated = true;
            break search;
          }
          if (allowed && entryMatchesNeedle(entry)) {
            if (entries.length >= maxMatches) {
              truncated = true;
              break search;
            }
            entries.push({ path: entry.path, name: entry.name, kind: entry.kind });
          }
          queue.push(entry.path);
          continue;
        }
        if (!allowed) continue;
        if (
          options.searchIndex === true
          && sortMode !== 'modified'
          && sortMode !== 'modified-asc'
        ) {
          liveIndexPaths.add(entry.path);
        }
        if (fileMask !== null && !fileMask.matches(entry.path)) continue;
        visited += 1;
        if (visited > maxVisited) {
          truncated = true;
          break search;
        }
        if (entryMatchesNeedle(entry)) {
          if (entries.length >= maxMatches) {
            truncated = true;
            break search;
          }
          entries.push({ path: entry.path, name: entry.name, kind: entry.kind });
        }
      }
    }
  }
  if (indexIdentity !== null) {
    const index = storedIndex ?? {
      version: SEARCH_INDEX_VERSION,
      root: indexIdentity.root,
      updatedAt: 0,
      contentBytes: 0,
      files: Object.create(null),
      directories: new Set(),
      pathScanComplete: false,
      directoryScanComplete: false,
      pathScanStale: false,
      contentScanVerified: false,
      scopeSignature,
      pathTruncated: false,
      contentTruncated: false,
      truncated: false,
    };
    let indexDirty = storedIndex?.dirty === true;
    const capturesLivePaths = sortMode !== 'modified' && sortMode !== 'modified-asc';
    const traversalComplete =
      truncated !== true
      && scanInvalidationRevision === (SEARCH_INDEX_SCAN_INVALIDATION_REVISIONS.get(indexIdentity.key) ?? 0);
    if (!indexFastPath && traversalComplete && index.scopeSignature !== scopeSignature) {
      index.scopeSignature = scopeSignature;
      indexDirty = true;
    }
    if (!indexFastPath && capturesLivePaths) {
      if (index.pathScanComplete !== traversalComplete) {
        index.pathScanComplete = traversalComplete;
        indexDirty = true;
      }
      index.pathScanStale = traversalComplete !== true;
      let capturedPath = false;
      for (const path of liveIndexPaths) {
        if (index.files[path] !== undefined && index.files[path]?.kind !== 'stale') continue;
        index.files[path] = { kind: 'path' };
        capturedPath = true;
      }
      if (capturedPath) {
        searchIndexMarkDirty(index);
        indexDirty = true;
      }
    }
    if (!indexFastPath) {
      if (index.directoryScanComplete !== traversalComplete) {
        index.directoryScanComplete = traversalComplete;
        indexDirty = true;
      }
      if (searchIndexApplyDirectorySnapshot(index, liveIndexDirectories, traversalComplete)) {
        indexDirty = true;
      }
    }
    if (capturesLivePaths && traversalComplete) SEARCH_INDEX_SCAN_STALE.delete(indexIdentity.key);
    if (entries.length < maxMatches) {
      const seen = new Set(entries.map((entry) => `${entry.kind}:${entry.path}`));
      const candidates = new Map();
      const addCandidate = (path, kind, mtime) => {
        if (typeof path !== 'string' || path === '') return;
        if (options.filesOnly === true && kind !== 'file') return;
        const name = path.slice(path.lastIndexOf('/') + 1);
        const searchablePath = options.matchPath === true ? path : name;
        if (!searchablePath.toLowerCase().includes(needle)) return;
        const candidateKey = `${kind}:${path}`;
        if (seen.has(candidateKey) || candidates.has(candidateKey)) return;
        if (
          options.showHidden !== true
          && path.split('/').some((segment) => segment.startsWith('.'))
        ) {
          return;
        }
        if (searchPathIsSystemGenerated(path)) return;
        if (searchPathIsGitIgnored(path, gitIgnoredPrefixes)) return;
        if (!searchPathAllowedByDirectoryRules(path, searchDirectoryRules)) return;
        if (kind === 'file' && fileMask !== null && !fileMask.matches(path)) return;
        candidates.set(candidateKey, {
          path,
          name,
          kind,
          mtime: Number(mtime) || 0,
        });
      };
      for (const [path, entry] of Object.entries(index.files)) {
        addCandidate(path, 'file', entry?.mtimeMs);
      }
      for (const directory of index.directories instanceof Set ? index.directories : []) {
        addCandidate(directory, 'directory', 0);
      }
      if (sortMode === 'modified' || sortMode === 'modified-asc') {
        const metadataCandidates = [...candidates.values()].filter((entry) => !(Number(entry.mtime) > 0));
        for (let cursor = 0; cursor < metadataCandidates.length; cursor += SEARCH_INDEX_STAT_CONCURRENCY) {
          if (options.signal?.aborted === true) return { entries: [], truncated: false };
          const batch = metadataCandidates.slice(cursor, cursor + SEARCH_INDEX_STAT_CONCURRENCY);
          await Promise.all(
            batch.map(async (entry) => {
              let absolutePath = null;
              try {
                absolutePath = resolveInside(root, entry.path);
              } catch {
                return;
              }
              const info = await stat(absolutePath).catch(() => null);
              entry.mtime = info?.mtimeMs ?? 0;
            }),
          );
          if (options.signal?.aborted === true) return { entries: [], truncated: false };
        }
      }
      const sorted = sortEntries([...candidates.values()], sortMode, options?.foldersFirst !== false);
      let examined = 0;
      searchIndexCandidates: for (
        let cursor = 0;
        cursor < sorted.length && entries.length < maxMatches;
        cursor += SEARCH_INDEX_STAT_CONCURRENCY
      ) {
        if (options.signal?.aborted === true) return { entries: [], truncated: false };
        const batch = sorted.slice(cursor, cursor + SEARCH_INDEX_STAT_CONCURRENCY);
        const verified = await Promise.all(
          batch.map(async (entry) => {
            let absolutePath = null;
            try {
              absolutePath = resolveInside(root, entry.path);
            } catch {
              return { entry, exists: false };
            }
            const info = await stat(absolutePath).catch(() => null);
            return {
              entry,
              exists: info !== null && (entry.kind === 'directory' ? info.isDirectory() : info.isFile()),
            };
          }),
        );
        if (options.signal?.aborted === true) return { entries: [], truncated: false };
        for (const state of verified) {
          examined += 1;
          if (!state.exists) {
            if (
              index.files[state.entry.path] !== undefined
              && searchIndexDropEntry(index, state.entry.path)
            ) {
              indexDirty = true;
            }
            if (state.entry.kind === 'directory' && searchIndexDropDirectoryTree(index, state.entry.path)) {
              indexDirty = true;
            }
            continue;
          }
          if (entries.length >= maxMatches) {
            truncated = true;
            break searchIndexCandidates;
          }
          entries.push(state.entry);
        }
      }
      if (entries.length >= maxMatches && examined < sorted.length) {
        truncated = true;
      }
    }
    if (
      (storedIndex !== null || Object.keys(index.files).length > 0)
      && indexDirty
      && options.signal?.aborted !== true
      && SEARCH_INDEX_REBUILD_PROGRESS.get(indexIdentity.key)?.building !== true
      && indexGeneration === (SEARCH_INDEX_GENERATIONS.get(indexIdentity.key) ?? 0)
    ) {
      await queueWorkspaceSearchPathIndexWrite(indexIdentity, index, indexGeneration, options.signal ?? null);
    }
  }
  return indexFastPath ? { entries, truncated, indexFastPath: true } : { entries, truncated };
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
/** All-tab text rows are intentionally a quick preview, never an exhaustive scan. */
const SEARCH_TEXT_PARTIAL_RESULT_LIMIT = 40;
/** Bound one request's aggregate disk reads independently of the file-count cap. */
const TEXT_SEARCH_MAX_TOTAL_BYTES = 64 * 1024 * 1024;
/** Bound cold-cache metadata reads without starving other filesystem work. */
const TEXT_SEARCH_STAT_CONCURRENCY = 64;
/** Spawn external candidate discovery only when its process overhead is amortized. */
const TEXT_SEARCH_EXTERNAL_CANDIDATE_THRESHOLD = 256;
/** Keep each grep invocation below common ARG_MAX limits. */
const TEXT_SEARCH_EXTERNAL_BATCH_BYTES = 512 * 1024;
const TEXT_SEARCH_EXTERNAL_BATCH_FILES = 4096;
const TEXT_SEARCH_EXTERNAL_CONCURRENCY = 12;
/** Bound scope-change directory prefetch so empty-directory forests cannot pin hundreds of MiB. */
const TEXT_SEARCH_DIRECTORY_SNAPSHOT_LIMIT = 10_000;
/** Binary formats that cannot be searched as source text without decoding. */
const TEXT_SEARCH_NON_TEXT_EXTENSIONS = new Set([
  '.7z',
  '.a',
  '.aar',
  '.apk',
  '.avi',
  '.bmp',
  '.bz2',
  '.class',
  '.db',
  '.dex',
  '.dll',
  '.dylib',
  '.elf',
  '.exe',
  '.flac',
  '.gif',
  '.gz',
  '.ico',
  '.jar',
  '.jpeg',
  '.jpg',
  '.m4a',
  '.mkv',
  '.mov',
  '.mp3',
  '.mp4',
  '.o',
  '.obj',
  '.ogg',
  '.otf',
  '.pdf',
  '.png',
  '.rar',
  '.so',
  '.sqlite',
  '.tar',
  '.tgz',
  '.ttf',
  '.wav',
  '.webm',
  '.webp',
  '.woff',
  '.woff2',
  '.xz',
  '.zip',
]);

/** Return true when a path has a known binary extension. */
function searchPathIsKnownNonText(path) {
  const name = basename(path).toLowerCase();
  const dot = name.lastIndexOf('.');
  return dot >= 0 && TEXT_SEARCH_NON_TEXT_EXTENSIONS.has(name.slice(dot));
}

/** Persistent project content cache used by browser workspace searches. */
const SEARCH_INDEX_VERSION = 3;
const SEARCH_INDEX_STREAM_FORMAT = 'dsh-editor-search-index-ndjson';
const SEARCH_INDEX_PATH_VERSION = 2;
const SEARCH_INDEX_PATH_STREAM_FORMAT = 'dsh-editor-search-index-paths-ndjson';
const SEARCH_INDEX_CONTENT_VERSION = 1;
const SEARCH_INDEX_CONTENT_FORMAT = 'dsh-editor-search-index-content-v8';
const SEARCH_INDEX_DIRECTORY = join(
  process.env.DSH_HOME ?? join(homedir(), '.dsh'),
  'indexes',
  'dsh-editor',
);
const SEARCH_INDEX_MAX_CONTENT_BYTES = 128 * 1024 * 1024;
const SEARCH_INDEX_MEMORY_LIMIT = 2;
const SEARCH_INDEX_PATH_MEMORY_LIMIT = 2;
const SEARCH_INDEX_PATH_QUERY_MEMORY_LIMIT = 2;
const SEARCH_PATH_QUERY_CACHE_LIMIT = 64;
const SEARCH_INDEX_STAT_CONCURRENCY = 32;
const SEARCH_INDEX_PATH_YIELD_INTERVAL = 512;
const SEARCH_INDEX_MEMORY = new Map();
const SEARCH_INDEX_PATH_MEMORY = new Map();
const SEARCH_INDEX_READS = new Map();
const SEARCH_INDEX_PATH_READS = new Map();
const SEARCH_INDEX_PATH_QUERY_MEMORY = new Map();
const SEARCH_INDEX_PATH_QUERY_READS = new Map();
const SEARCH_INDEX_PATH_QUERY_EPOCHS = new Map();
const SEARCH_PATH_QUERY_CACHE = new Map();
const SEARCH_INDEX_STATUS_COUNTS = new WeakMap();
const SEARCH_TEXT_QUERY_CACHE_LIMIT = 32;
const SEARCH_TEXT_QUERY_CACHE = new Map();
const SEARCH_PARTIAL_TEXT_QUERY_CACHE_LIMIT = 64;
const SEARCH_PARTIAL_TEXT_QUERY_CACHE = new Map();
const SEARCH_TEXT_QUERY_CACHE_FILE_FORMAT = 'dsh-editor-text-query-cache-v8';
const SEARCH_TEXT_QUERY_CACHE_FILE_VERSION = 2;
const SEARCH_TEXT_QUERY_CACHE_FILE_MEMORY = new Map();
const SEARCH_TEXT_QUERY_CACHE_FILE_READS = new Map();
const SEARCH_TEXT_QUERY_CACHE_FILE_WRITES = new Map();
const SEARCH_TEXT_QUERY_CACHE_FILE_EPOCHS = new Map();
const SEARCH_TEXT_QUERY_CACHE_FILE_FAST_MEMORY = new Map();
const SEARCH_TEXT_QUERY_CACHE_FILE_FAST_READS = new Map();
const SEARCH_INDEX_QUERY_SNAPSHOTS = new Map();
const SEARCH_TEXT_SKETCH_FORMAT = 'dsh-editor-search-text-sketches-v1';
const SEARCH_TEXT_SKETCH_VERSION = 1;
const SEARCH_TEXT_SKETCH_BITS = 2048;
const SEARCH_TEXT_SKETCH_BYTES = SEARCH_TEXT_SKETCH_BITS / 8;
const SEARCH_TEXT_SKETCH_WRITE_DELAY = 750;
const SEARCH_TEXT_SKETCH_MEMORY = new Map();
const SEARCH_TEXT_SKETCH_READS = new Map();
const SEARCH_TEXT_SKETCH_WRITES = new Map();
const SEARCH_TEXT_SKETCH_TIMERS = new Map();
const SEARCH_INDEX_ACTIVE_IDENTITY = new Map();
const SEARCH_INDEX_GENERATIONS = new Map();
const SEARCH_INDEX_REBUILD_PROGRESS = new Map();
const SEARCH_INDEX_REBUILDS = new Map();
const SEARCH_INDEX_WRITES = new Map();
const SEARCH_INDEX_PATH_WRITES = new Map();
const SEARCH_INDEX_SUSPENDED = new Set();
const SEARCH_INDEX_ACTIVE_WATCHERS = new Map();
const SEARCH_INDEX_INVALIDATION_REVISIONS = new Map();
const SEARCH_INDEX_SCAN_INVALIDATION_REVISIONS = new Map();
const SEARCH_INDEX_SCAN_INVALIDATION_DETAILS = new Map();
const SEARCH_INDEX_SCAN_STALE = new Set();
const SEARCH_INDEX_STARTUP_VERIFICATION = new Set();
/** Keep a detached workspace watcher warm across Editor re-entry. */
const WORKSPACE_WATCHER_IDLE_CLOSE_MS = 30 * 60 * 1000;

/** Track live workspace watchers so a stale cache is never authoritative without one. */
function registerWorkspaceSearchIndexWatcher(root) {
  const key = resolve(root);
  SEARCH_INDEX_ACTIVE_WATCHERS.set(key, (SEARCH_INDEX_ACTIVE_WATCHERS.get(key) ?? 0) + 1);
  const identity = activeSearchIndexIdentity(root);
  if (SEARCH_INDEX_MEMORY.get(identity.key)?.contentScanVerified === true) {
    SEARCH_INDEX_STARTUP_VERIFICATION.delete(identity.key);
  }
  let released = false;
  return () => {
    if (released) return;
    released = true;
    const remaining = Math.max(0, (SEARCH_INDEX_ACTIVE_WATCHERS.get(key) ?? 1) - 1);
    if (remaining === 0) {
      SEARCH_INDEX_ACTIVE_WATCHERS.delete(key);
      const identity = activeSearchIndexIdentity(root);
      SEARCH_INDEX_INVALIDATION_REVISIONS.set(
        identity.key,
        (SEARCH_INDEX_INVALIDATION_REVISIONS.get(identity.key) ?? 0) + 1,
      );
      SEARCH_INDEX_SCAN_INVALIDATION_REVISIONS.set(
        identity.key,
        (SEARCH_INDEX_SCAN_INVALIDATION_REVISIONS.get(identity.key) ?? 0) + 1,
      );
      SEARCH_INDEX_SCAN_INVALIDATION_DETAILS.set(identity.key, {
        at: Date.now(),
        path: 'watcher-released',
      });
      const contentIndex = SEARCH_INDEX_MEMORY.get(identity.key);
      if (contentIndex !== undefined) contentIndex.contentScanVerified = false;
      const pathIndex = SEARCH_INDEX_PATH_MEMORY.get(identity.key);
      if (pathIndex !== undefined) pathIndex.contentScanVerified = false;
    } else {
      SEARCH_INDEX_ACTIVE_WATCHERS.set(key, remaining);
    }
  };
}

function workspaceSearchIndexWatcherActive(root) {
  return (SEARCH_INDEX_ACTIVE_WATCHERS.get(resolve(root)) ?? 0) > 0;
}

/** Match AbortController's cancellation error without requiring DOMException. */
function createAbortError() {
  const error = new Error('The operation was aborted');
  error.name = 'AbortError';
  return error;
}

function searchIndexIdentity(root, options = {}) {
  const directory = resolve(
    typeof options?.searchIndexDirectory === 'string' && options.searchIndexDirectory.trim() !== ''
      ? options.searchIndexDirectory
      : SEARCH_INDEX_DIRECTORY,
  );
  const workspaceRoot = resolve(root);
  const key = `${directory}\u0000${workspaceRoot}`;
  const digest = createHash('sha256').update(workspaceRoot).digest('hex');
  return {
    key,
    directory,
    root: workspaceRoot,
    file: join(directory, `${digest}.json.gz`),
    pathFile: join(directory, `${digest}.paths.json.gz`),
    contentFile: join(directory, `${digest}.content.v8.gz`),
    queryCacheFile: join(directory, `${digest}.queries.v8.gz`),
    sketchFile: join(directory, `${digest}.sketches.v1.gz`),
  };
}

/** Stable filesystem identity fields when the platform exposes them. */
function searchIndexFileIdentity(info) {
  const dev = Math.trunc(Number(info?.dev));
  const ino = Math.trunc(Number(info?.ino));
  return Number.isFinite(dev) && dev > 0 && Number.isFinite(ino) && ino > 0 ? { dev, ino } : {};
}

/** Reject cached content when the current file/symlink target is another inode. */
function searchIndexIdentityMatches(cached, info) {
  const current = searchIndexFileIdentity(info);
  if (current.dev === undefined || current.ino === undefined) return true;
  return Number(cached?.dev) === current.dev && Number(cached?.ino) === current.ino;
}

/** Mark one memory index as needing persistence. */
function searchIndexMarkDirty(index) {
  index.dirty = true;
  index.dirtyRevision = (Number(index.dirtyRevision) || 0) + 1;
}

function searchIndexRemember(identity, index) {
  SEARCH_INDEX_ACTIVE_IDENTITY.set(identity.root, identity);
  SEARCH_INDEX_MEMORY.delete(identity.key);
  SEARCH_INDEX_MEMORY.set(identity.key, index);
  while (SEARCH_INDEX_MEMORY.size > SEARCH_INDEX_MEMORY_LIMIT) {
    const oldest = SEARCH_INDEX_MEMORY.keys().next().value;
    if (oldest === undefined) break;
    SEARCH_INDEX_MEMORY.delete(oldest);
  }
}

/** Cache the path projection independently from the much larger content cache. */
function searchIndexRememberPaths(identity, index) {
  SEARCH_INDEX_ACTIVE_IDENTITY.set(identity.root, identity);
  SEARCH_INDEX_PATH_MEMORY.delete(identity.key);
  SEARCH_INDEX_PATH_MEMORY.set(identity.key, index);
  while (SEARCH_INDEX_PATH_MEMORY.size > SEARCH_INDEX_PATH_MEMORY_LIMIT) {
    const oldest = SEARCH_INDEX_PATH_MEMORY.keys().next().value;
    if (oldest === undefined) break;
    SEARCH_INDEX_PATH_MEMORY.delete(oldest);
  }
}

/** Count path entries once per in-memory index revision for status polling. */
function searchIndexStatusCounts(index) {
  const revision = Number(index?.dirtyRevision) || 0;
  const cached = SEARCH_INDEX_STATUS_COUNTS.get(index);
  if (cached?.revision === revision) return cached;
  const counts = {
    revision,
    files: Object.keys(index.files).length,
    directories: index.directories.size,
  };
  SEARCH_INDEX_STATUS_COUNTS.set(index, counts);
  return counts;
}

function activeSearchIndexIdentity(root) {
  return SEARCH_INDEX_ACTIVE_IDENTITY.get(resolve(root)) ?? searchIndexIdentity(root);
}

function searchIndexDropEntry(index, path) {
  const entry = index.files[path];
  if (entry === undefined) return false;
  if (typeof entry.content === 'string') {
    index.contentBytes = Math.max(0, index.contentBytes - Buffer.byteLength(entry.content));
  }
  delete index.files[path];
  searchIndexMarkDirty(index);
  return true;
}

/** Remove one persisted directory and its indexed descendants. */
function searchIndexDropDirectoryTree(index, path) {
  let removed = false;
  for (const directory of [...index.directories]) {
    if (directory !== path && !directory.startsWith(`${path}/`)) continue;
    index.directories.delete(directory);
    removed = true;
  }
  if (removed) searchIndexMarkDirty(index);
  return removed;
}

/** Replace one complete live path snapshot while emitting one dirty revision. */
function searchIndexApplyPathSnapshot(index, paths) {
  const livePaths = new Set(paths);
  let changed = false;
  for (const path of Object.keys(index.files)) {
    if (livePaths.has(path)) continue;
    const entry = index.files[path];
    if (typeof entry?.content === 'string') {
      index.contentBytes = Math.max(0, index.contentBytes - Buffer.byteLength(entry.content));
    }
    delete index.files[path];
    changed = true;
  }
  for (const path of livePaths) {
    if (index.files[path] !== undefined) continue;
    index.files[path] = { kind: 'path' };
    changed = true;
  }
  if (changed) searchIndexMarkDirty(index);
  return changed;
}

/** Merge or replace a directory snapshot without repeated whole-set scans. */
function searchIndexApplyDirectorySnapshot(index, directories, replace) {
  let changed = false;
  if (replace === true) {
    for (const directory of [...index.directories]) {
      if (directories.has(directory)) continue;
      index.directories.delete(directory);
      changed = true;
    }
  }
  for (const directory of directories) {
    if (index.directories.has(directory)) continue;
    index.directories.add(directory);
    changed = true;
  }
  if (changed) searchIndexMarkDirty(index);
  return changed;
}

function searchIndexMarkStale(index, path) {
  searchIndexDropEntry(index, path);
  index.files[path] = { mtimeMs: -1, size: -1, kind: 'stale' };
  index.contentScanVerified = false;
  searchIndexMarkDirty(index);
}

/** Revoke watcher-backed content trust even before an index has been recreated. */
function invalidateWorkspaceSearchIndexContent(identity) {
  SEARCH_INDEX_INVALIDATION_REVISIONS.set(
    identity.key,
    (SEARCH_INDEX_INVALIDATION_REVISIONS.get(identity.key) ?? 0) + 1,
  );
  invalidateWorkspaceSearchTextQueryCache(identity);
  const index = SEARCH_INDEX_MEMORY.get(identity.key);
  if (index !== undefined) index.contentScanVerified = false;
}

/** Invalidate one known write without forcing an immediate index rewrite. */
function invalidateWorkspaceSearchIndexPath(root, relativePath) {
  const identity = activeSearchIndexIdentity(root);
  if (typeof relativePath !== 'string' || relativePath === '') return;
  invalidateWorkspaceSearchIndexContent(identity);
  invalidateWorkspaceSearchTextSketchPath(identity, relativePath);
  const contentIndex = SEARCH_INDEX_MEMORY.get(identity.key);
  if (contentIndex !== undefined) {
    contentIndex.directoryScanComplete = false;
    searchIndexMarkStale(contentIndex, relativePath);
  }
  const pathIndex = SEARCH_INDEX_PATH_MEMORY.get(identity.key);
  if (pathIndex !== undefined) {
    pathIndex.directoryScanComplete = false;
    searchIndexMarkStale(pathIndex, relativePath);
  }
}

/** Invalidate a directory creation or rename without inventing a file entry. */
function invalidateWorkspaceSearchIndexDirectory(root, relativePath) {
  const identity = activeSearchIndexIdentity(root);
  if (typeof relativePath !== 'string' || relativePath === '') return;
  invalidateWorkspaceSearchIndexContent(identity);
  const contentIndex = SEARCH_INDEX_MEMORY.get(identity.key);
  if (contentIndex !== undefined) {
    contentIndex.directoryScanComplete = false;
    searchIndexDropDirectoryTree(contentIndex, relativePath);
    searchIndexMarkDirty(contentIndex);
  }
  const pathIndex = SEARCH_INDEX_PATH_MEMORY.get(identity.key);
  if (pathIndex !== undefined) {
    pathIndex.directoryScanComplete = false;
    searchIndexDropDirectoryTree(pathIndex, relativePath);
    searchIndexMarkDirty(pathIndex);
  }
}

/** Force the next filename query to reconcile the index with the live tree. */
function invalidateWorkspaceSearchIndexScan(root, changedPath = null) {
  const identity = activeSearchIndexIdentity(root);
  SEARCH_INDEX_SCAN_STALE.add(identity.key);
  SEARCH_INDEX_SCAN_INVALIDATION_REVISIONS.set(
    identity.key,
    (SEARCH_INDEX_SCAN_INVALIDATION_REVISIONS.get(identity.key) ?? 0) + 1,
  );
  SEARCH_INDEX_SCAN_INVALIDATION_DETAILS.set(identity.key, {
    at: Date.now(),
    path: typeof changedPath === 'string' && changedPath !== ''
      ? changedPath
      : 'unspecified',
  });
  invalidateWorkspaceSearchIndexContent(identity);
  const contentIndex = SEARCH_INDEX_MEMORY.get(identity.key);
  if (contentIndex !== undefined) {
    contentIndex.pathScanComplete = false;
    contentIndex.directoryScanComplete = false;
    contentIndex.pathScanStale = true;
  }
  const pathIndex = SEARCH_INDEX_PATH_MEMORY.get(identity.key);
  if (pathIndex !== undefined) {
    pathIndex.pathScanComplete = false;
    pathIndex.directoryScanComplete = false;
    pathIndex.pathScanStale = true;
  }
}

/** Remove a deleted path, including descendants for a directory. */
function removeWorkspaceSearchIndexPath(root, relativePath, includeDescendants) {
  const identity = activeSearchIndexIdentity(root);
  if (typeof relativePath !== 'string' || relativePath === '') return;
  invalidateWorkspaceSearchIndexContent(identity);
  for (const index of [
    SEARCH_INDEX_MEMORY.get(identity.key),
    SEARCH_INDEX_PATH_MEMORY.get(identity.key),
  ]) {
    if (index === undefined) continue;
    index.directoryScanComplete = false;
    searchIndexDropDirectoryTree(index, relativePath);
    for (const path of Object.keys(index.files)) {
      if (path === relativePath || (includeDescendants && path.startsWith(`${relativePath}/`))) {
        searchIndexDropEntry(index, path);
      }
    }
  }
}

/** Move cached path identities without retaining content under the old name. */
function moveWorkspaceSearchIndexPath(root, fromPath, toPath, isDirectory) {
  const identity = activeSearchIndexIdentity(root);
  if (typeof fromPath !== 'string' || typeof toPath !== 'string') return;
  invalidateWorkspaceSearchIndexContent(identity);
  for (const index of [
    SEARCH_INDEX_MEMORY.get(identity.key),
    SEARCH_INDEX_PATH_MEMORY.get(identity.key),
  ]) {
    if (index === undefined) continue;
    index.directoryScanComplete = false;
    if (isDirectory) searchIndexDropDirectoryTree(index, fromPath);
    const moves = [];
    for (const path of Object.keys(index.files)) {
      if (path !== fromPath && (!isDirectory || !path.startsWith(`${fromPath}/`))) continue;
      moves.push([path, isDirectory ? `${toPath}${path.slice(fromPath.length)}` : toPath]);
    }
    for (const [from] of moves) searchIndexDropEntry(index, from);
    for (const [, to] of moves) searchIndexMarkStale(index, to);
    if (moves.length === 0) searchIndexMarkStale(index, toPath);
  }
}

/**
 * Read one persisted workspace content index. A missing or corrupt cache is
 * treated as a cache miss; search itself must remain available.
 * @param {string} root - workspace root.
 * @param {{searchIndexDirectory?: string}} [options] - storage override.
 * @returns {Promise<object|null>} validated content index.
 */
async function readWorkspaceSearchIndexUncached(root, options = {}) {
  const identity = searchIndexIdentity(root, options);
  const memory = SEARCH_INDEX_MEMORY.get(identity.key);
  if (memory !== undefined) {
    searchIndexRemember(identity, memory);
    return memory;
  }
  const binaryIndex = await readWorkspaceSearchContentSidecar(identity);
  if (binaryIndex !== null) {
    searchIndexRemember(identity, binaryIndex);
    return binaryIndex;
  }
  let header = null;
  let legacy = null;
  let invalid = false;
  const files = Object.create(null);
  const directories = new Set();
  const decoder = new StringDecoder('utf8');
  let pending = '';
  const acceptLine = (line) => {
    if (line === '') return;
    const record = JSON.parse(line);
    if (header === null) {
      if (record?.format === SEARCH_INDEX_STREAM_FORMAT) {
        header = record;
        return;
      }
      if (
        record?.version === 1
        && record?.root === identity.root
        && record?.files !== null
        && typeof record?.files === 'object'
        && !Array.isArray(record.files)
      ) {
        legacy = record;
        return;
      }
      invalid = true;
      return;
    }
    if (
      typeof record?.path === 'string'
      && record.path !== ''
      && record?.entry !== null
      && typeof record?.entry === 'object'
      && !Array.isArray(record.entry)
    ) {
      files[record.path] = record.entry;
      return;
    }
    if (typeof record?.directory === 'string' && record.directory !== '') {
      directories.add(record.directory);
    }
  };
  const sink = new Writable({
    write(chunk, _encoding, callback) {
      try {
        pending += decoder.write(chunk);
        let newline = pending.indexOf('\n');
        while (newline >= 0) {
          const line = pending.slice(0, newline);
          pending = pending.slice(newline + 1);
          acceptLine(line);
          newline = pending.indexOf('\n');
        }
        callback();
      } catch (error) {
        callback(error);
      }
    },
    final(callback) {
      try {
        pending += decoder.end();
        if (pending !== '') acceptLine(pending);
        callback();
      } catch (error) {
        callback(error);
      }
    },
  });
  try {
    await pipeline(createReadStream(identity.file), createGunzip(), sink);
    if (legacy !== null) {
      const legacyFiles = Object.create(null);
      for (const [path, entry] of Object.entries(legacy.files)) {
        if (
          typeof path === 'string'
          && path !== ''
          && entry !== null
          && typeof entry === 'object'
          && !Array.isArray(entry)
        ) {
          legacyFiles[path] = entry;
        }
      }
      const index = {
        version: SEARCH_INDEX_VERSION,
        root: identity.root,
        updatedAt: Number(legacy.updatedAt) || 0,
        contentBytes: Math.max(0, Number(legacy.contentBytes) || 0),
        files: legacyFiles,
        directories: new Set(),
        pathScanComplete: false,
        directoryScanComplete: false,
        pathScanStale: SEARCH_INDEX_SCAN_STALE.has(identity.key),
        contentScanVerified: false,
        scopeSignature: '',
        pathTruncated: false,
        contentTruncated: false,
        truncated: false,
      };
      searchIndexRemember(identity, index);
      return index;
    }
    if (
      invalid
      || (header?.version !== 2 && header?.version !== SEARCH_INDEX_VERSION)
      || header?.root !== identity.root
    ) {
      return null;
    }
    const pathScanStale = SEARCH_INDEX_SCAN_STALE.has(identity.key);
    const legacyTruncated = header?.version === 2 && header?.truncated === true;
    const index = {
      version: SEARCH_INDEX_VERSION,
      root: identity.root,
      updatedAt: Number(header.updatedAt) || 0,
      contentBytes: Math.max(0, Number(header.contentBytes) || 0),
      files,
      directories,
      pathScanComplete: header?.complete === true && pathScanStale !== true,
      directoryScanComplete: header?.directoriesComplete === true && pathScanStale !== true,
      pathScanStale,
      contentScanVerified: false,
      scopeSignature: typeof header?.scopeSignature === 'string' ? header.scopeSignature : '',
      pathTruncated: legacyTruncated || header?.pathTruncated === true,
      contentTruncated: legacyTruncated || header?.contentTruncated === true,
      truncated: header?.truncated === true,
    };
    searchIndexRemember(identity, index);
    return index;
  } catch {
    return null;
  }
}

/**
 * Coalesce concurrent readers so filename and text searches sharing one cold
 * index decode it once instead of competing for the same CPU and allocations.
 * @param {string} root - workspace root.
 * @param {{searchIndexDirectory?: string}} [options] - storage override.
 * @returns {Promise<object|null>} validated content index.
 */
function readWorkspaceSearchIndex(root, options = {}) {
  const identity = searchIndexIdentity(root, options);
  const memory = SEARCH_INDEX_MEMORY.get(identity.key);
  if (memory !== undefined) {
    searchIndexRemember(identity, memory);
    return Promise.resolve(memory);
  }
  const pending = SEARCH_INDEX_READS.get(identity.key);
  if (pending !== undefined) return pending;
  const request = readWorkspaceSearchIndexUncached(root, options).finally(() => {
    if (SEARCH_INDEX_READS.get(identity.key) === request) SEARCH_INDEX_READS.delete(identity.key);
  });
  SEARCH_INDEX_READS.set(identity.key, request);
  return request;
}

/** Strip cached body text before projecting one lookup entry into the path index. */
function searchIndexPathOnlyEntry(entry) {
  const projected = {
    kind: typeof entry?.kind === 'string' ? entry.kind : 'path',
  };
  if (Number.isFinite(Number(entry?.mtimeMs))) projected.mtimeMs = Number(entry.mtimeMs);
  if (Number.isFinite(Number(entry?.size))) projected.size = Number(entry.size);
  if (Number.isFinite(Number(entry?.dev))) projected.dev = Number(entry.dev);
  if (Number.isFinite(Number(entry?.ino))) projected.ino = Number(entry.ino);
  return projected;
}

/** Build an in-memory path projection without retaining any cached file body. */
function searchIndexProjectPaths(index) {
  const files = Object.create(null);
  for (const [path, entry] of Object.entries(index.files)) {
    files[path] = searchIndexPathOnlyEntry(entry);
  }
  return {
    version: SEARCH_INDEX_VERSION,
    root: index.root,
    updatedAt: Number(index.updatedAt) || 0,
    contentBytes: Math.max(0, Number(index.contentBytes) || 0),
    files,
    directories: new Set(index.directories instanceof Set ? index.directories : []),
    pathScanComplete: index.pathScanComplete === true,
    directoryScanComplete: index.directoryScanComplete === true,
    pathScanStale: index.pathScanStale === true,
    contentScanVerified: index.contentScanVerified === true,
    scopeSignature: typeof index.scopeSignature === 'string' ? index.scopeSignature : '',
    pathTruncated: index.pathTruncated === true,
    contentTruncated: index.contentTruncated === true,
    truncated: index.truncated === true,
    contentOmitted: true,
  };
}

/**
 * Read only the persisted path projection. Filename search must not decode the
 * full content cache, whose size is dominated by source text.
 * @param {string} root - workspace root.
 * @param {{searchIndexDirectory?: string}} [options] - storage override.
 * @returns {Promise<object|null>} path index, or null when it must be rebuilt.
 */
function readWorkspaceSearchPathIndex(root, options = {}) {
  const identity = searchIndexIdentity(root, options);
  const memory = SEARCH_INDEX_PATH_MEMORY.get(identity.key);
  if (memory !== undefined) {
    searchIndexRememberPaths(identity, memory);
    return Promise.resolve(memory);
  }
  const pending = SEARCH_INDEX_PATH_READS.get(identity.key);
  if (pending !== undefined) return pending;
  const request = readWorkspaceSearchPathIndexUncached(identity).finally(() => {
    if (SEARCH_INDEX_PATH_READS.get(identity.key) === request) SEARCH_INDEX_PATH_READS.delete(identity.key);
  });
  SEARCH_INDEX_PATH_READS.set(identity.key, request);
  return request;
}

/**
 * Validate one path-only snapshot and fall back to the legacy combined file
 * once, then create the sidecar for subsequent process lifetimes.
 * @param {object} identity - storage identity.
 * @returns {Promise<object|null>} path index or null.
 */
async function readWorkspaceSearchPathIndexUncached(identity) {
  const existing = await stat(identity.pathFile).catch(() => null);
  if (existing !== null) {
    const files = Object.create(null);
    const directories = new Set();
    try {
      const chunks = [];
      for await (const chunk of createReadStream(identity.pathFile).pipe(createGunzip())) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      const payload = Buffer.concat(chunks);
      const headerEnd = payload.indexOf(0x0a);
      if (headerEnd <= 0) throw new Error('invalid search path index header');
      const header = JSON.parse(payload.subarray(0, headerEnd).toString('utf8'));
      if (header?.format !== SEARCH_INDEX_PATH_STREAM_FORMAT || header?.version !== SEARCH_INDEX_PATH_VERSION || header?.root !== identity.root) {
        throw new Error('invalid search path index');
      }
      let offset = headerEnd + 1;
      while (offset < payload.length) {
        const kind = payload[offset];
        offset += 1;
        const recordEnd = payload.indexOf(0, offset);
        if (recordEnd < 0) throw new Error('truncated search path index');
        const path = payload.subarray(offset, recordEnd).toString('utf8');
        offset = recordEnd + 1;
        if (path === '') continue;
        if (kind === 0x46) files[path] = { kind: 'file' };
        else if (kind === 0x44) directories.add(path);
        else throw new Error('invalid search path index record');
      }
      const pathScanStale = SEARCH_INDEX_SCAN_STALE.has(identity.key);
      const index = {
        version: SEARCH_INDEX_VERSION,
        root: identity.root,
        updatedAt: Number(header.updatedAt) || 0,
        contentBytes: Math.max(0, Number(header.contentBytes) || 0),
        files,
        directories,
        pathScanComplete: header?.complete === true && pathScanStale !== true,
        directoryScanComplete: header?.directoriesComplete === true && pathScanStale !== true,
        pathScanStale,
        // This process has not validated the persisted body snapshot yet.
        contentScanVerified: false,
        scopeSignature: typeof header?.scopeSignature === 'string' ? header.scopeSignature : '',
        pathTruncated: header?.pathTruncated === true,
        contentTruncated: header?.contentTruncated === true,
        truncated: header?.truncated === true,
        contentOmitted: true,
      };
      searchIndexRememberPaths(identity, index);
      return index;
    } catch {
      // Fall through to the combined cache so a corrupt sidecar stays recoverable.
    }
  }
  const full = await readWorkspaceSearchIndex(identity.root, {
    searchIndexDirectory: identity.directory,
  });
  if (full === null) return null;
  const projected = searchIndexProjectPaths(full);
  searchIndexRememberPaths(identity, projected);
  void writeWorkspaceSearchPathIndex(identity, projected).catch(() => {});
  return projected;
}

/** Keep one compact decoded path stream for interactive queries. */
function searchIndexRememberPathQueryView(identity, view) {
  SEARCH_INDEX_ACTIVE_IDENTITY.set(identity.root, identity);
  SEARCH_INDEX_PATH_QUERY_MEMORY.delete(identity.key);
  SEARCH_INDEX_PATH_QUERY_MEMORY.set(identity.key, view);
  while (SEARCH_INDEX_PATH_QUERY_MEMORY.size > SEARCH_INDEX_PATH_QUERY_MEMORY_LIMIT) {
    const oldest = SEARCH_INDEX_PATH_QUERY_MEMORY.keys().next().value;
    if (oldest === undefined) break;
    SEARCH_INDEX_PATH_QUERY_MEMORY.delete(oldest);
  }
}

/**
 * Decode the persisted path stream without constructing one object per path.
 *
 * Interactive search only needs path substrings. Keeping the NUL-delimited
 * stream as one string lets regular-expression search run in native code and
 * avoids the hundreds of thousands of short-lived objects and maps that made
 * the first query on a large monorepo wait for the full projection.
 * @param {object} identity - storage identity.
 * @returns {Promise<object|null>} validated query view.
 */
async function readWorkspaceSearchPathQueryViewUncached(identity) {
  const info = await stat(identity.pathFile).catch(() => null);
  if (info === null) return null;
  try {
    const chunks = [];
    for await (const chunk of createReadStream(identity.pathFile).pipe(createGunzip())) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const payload = Buffer.concat(chunks);
    const headerEnd = payload.indexOf(0x0a);
    if (headerEnd <= 0) return null;
    const header = JSON.parse(payload.subarray(0, headerEnd).toString('utf8'));
    if (
      header?.format !== SEARCH_INDEX_PATH_STREAM_FORMAT
      || header?.version !== SEARCH_INDEX_PATH_VERSION
      || header?.root !== identity.root
    ) {
      return null;
    }
    return {
      header,
      text: payload.toString('utf8', headerEnd + 1),
      mtimeMs: info.mtimeMs,
      size: info.size,
      dev: Number(info.dev) || 0,
      ino: Number(info.ino) || 0,
      epoch: SEARCH_INDEX_PATH_QUERY_EPOCHS.get(identity.key) ?? 0,
    };
  } catch {
    return null;
  }
}

/**
 * Read the compact path query view, reusing it until the path file is replaced.
 * @param {string} root - workspace root.
 * @param {{searchIndexDirectory?: string}} [options] - storage override.
 * @returns {Promise<object|null>} query view or null.
 */
function readWorkspaceSearchPathQueryView(root, options = {}) {
  const identity = searchIndexIdentity(root, options);
  const cached = SEARCH_INDEX_PATH_QUERY_MEMORY.get(identity.key);
  const pending = SEARCH_INDEX_PATH_QUERY_READS.get(identity.key);
  if (pending !== undefined) return pending;
  const request = stat(identity.pathFile)
    .then((info) => {
      if (
        cached !== undefined
        && cached.mtimeMs === info.mtimeMs
        && cached.size === info.size
        && cached.dev === (Number(info.dev) || 0)
        && cached.ino === (Number(info.ino) || 0)
      ) {
        searchIndexRememberPathQueryView(identity, cached);
        return cached;
      }
      return readWorkspaceSearchPathQueryViewUncached(identity).then((view) => {
        if (view !== null) searchIndexRememberPathQueryView(identity, view);
        return view;
      });
    })
    .catch(() => null)
    .finally(() => {
      if (SEARCH_INDEX_PATH_QUERY_READS.get(identity.key) === request) {
        SEARCH_INDEX_PATH_QUERY_READS.delete(identity.key);
      }
    });
  SEARCH_INDEX_PATH_QUERY_READS.set(identity.key, request);
  return request;
}

/** Whether one compact path stream can answer this search without live traversal. */
function searchIndexPathQueryViewCanServe(root, identity, view, options, scopeSignature) {
  if (view === null || identity === null) return false;
  const progress = SEARCH_INDEX_REBUILD_PROGRESS.get(identity.key);
  const updateSnapshot = progress?.building === true && progress.kind === 'update';
  return (
    options?.searchIndex === true
    && options?.includeExcluded !== true
    && options?.respectGitIgnore === true
    && (
      options?.filesOnly === true
      || view.header.complete === true
      || view.header.pathTruncated === true
      || updateSnapshot
      || view.header.directoriesComplete === true
    )
    && view.header.scopeSignature === scopeSignature
    && view.epoch === (SEARCH_INDEX_PATH_QUERY_EPOCHS.get(identity.key) ?? 0)
    && workspaceSearchIndexWatcherActive(root)
    && (progress?.building !== true || updateSnapshot)
    && (updateSnapshot || SEARCH_INDEX_SCAN_STALE.has(identity.key) !== true)
  );
}

/** Escape one literal query before running it over the compact path stream. */
function escapeSearchIndexPathQuery(query) {
  return query.replace(/[\\^$.*+?()[\]{}|]/gu, '\\$&');
}

/**
 * Return matching path records from the compact query view.
 *
 * Native regex scan avoids decoding every path or building the full path map.
 * @param {object} view - decoded path query view.
 * @param {string} needle - trimmed lowercase query.
 * @param {object} options - search options.
 * @param {((path: string, kind: string) => boolean|void)|null} [visit=null] - streaming consumer.
 * @returns {Array<{path: string, kind: string}>|null} records when not streaming.
 */
function searchWorkspacePathQueryView(view, needle, options, visit = null) {
  if (needle === '') return [];
  const matcher = new RegExp(escapeSearchIndexPathQuery(needle), 'giu');
  const records = visit === null ? [] : null;
  let match;
  while ((match = matcher.exec(view.text)) !== null) {
    const segmentStart = view.text.lastIndexOf('\0', match.index - 1) + 1;
    const marker = view.text[segmentStart];
    const recordEnd = view.text.indexOf('\0', segmentStart + 1);
    if (recordEnd < 0) break;
    if (marker === 'F' || marker === 'D') {
      const path = view.text.slice(segmentStart + 1, recordEnd);
      const searchable = options.matchPath === true ? path : path.slice(path.lastIndexOf('/') + 1);
      if (searchable.toLowerCase().includes(needle)) {
        const kind = marker === 'F' ? 'file' : 'directory';
        if (visit !== null) {
          if (visit(path, kind) === false) break;
        } else {
          records.push({ path, kind });
        }
      }
    }
    matcher.lastIndex = recordEnd + 1;
  }
  return records;
}

/** Materialize only file paths when a newer path sidecar must be merged. */
function searchWorkspacePathQueryViewFilePaths(view) {
  const paths = [];
  let offset = 0;
  while (offset < view.text.length) {
    const recordEnd = view.text.indexOf('\0', offset + 1);
    if (recordEnd < 0) break;
    if (view.text[offset] === 'F') {
      const path = view.text.slice(offset + 1, recordEnd);
      if (path !== '') paths.push(path);
    }
    offset = recordEnd + 1;
  }
  return paths;
}

/** Bind one positive path-query result to the exact path snapshot and scope. */
function searchWorkspacePathQueryCacheKey(
  identity,
  view,
  scanInvalidationRevision,
  indexGeneration,
  needle,
  options,
  scopeSignature,
) {
  const pathIndex = SEARCH_INDEX_PATH_MEMORY.get(identity.key);
  return JSON.stringify([
    identity.key,
    view.epoch,
    view.mtimeMs,
    view.size,
    view.dev,
    view.ino,
    scanInvalidationRevision,
    indexGeneration,
    Number(pathIndex?.dirtyRevision) || 0,
    scopeSignature,
    needle,
    options?.showHidden === true,
    options?.matchPath === true,
    options?.filesOnly === true,
    typeof options?.sort === 'string' ? options.sort : 'name',
    options?.foldersFirst !== false,
    typeof options?.fileMask === 'string' ? options.fileMask.trim() : '',
  ]);
}

/** Retain a bounded copy of positive path-query results. */
function rememberWorkspaceSearchPathQueryResult(key, entries, truncated) {
  SEARCH_PATH_QUERY_CACHE.delete(key);
  SEARCH_PATH_QUERY_CACHE.set(key, {
    entries: entries.map((entry) => ({ ...entry })),
    truncated,
  });
  while (SEARCH_PATH_QUERY_CACHE.size > SEARCH_PATH_QUERY_CACHE_LIMIT) {
    const oldest = SEARCH_PATH_QUERY_CACHE.keys().next().value;
    if (oldest === undefined) break;
    SEARCH_PATH_QUERY_CACHE.delete(oldest);
  }
}

/** Fingerprint the immutable content and path snapshots a persisted query belongs to. */
function searchTextQueryCacheFileFingerprint(index, pathView) {
  return JSON.stringify([
    Number(index?.updatedAt) || 0,
    Object.keys(index?.files ?? {}).length,
    Number(index?.contentBytes) || 0,
    typeof index?.scopeSignature === 'string' ? index.scopeSignature : '',
    Number(pathView?.header?.updatedAt) || 0,
    pathView?.header?.complete === true,
  ]);
}

/** Stable metadata for one atomically replaced index sidecar. */
function searchIndexSidecarSnapshot(info) {
  if (info === null || !info.isFile()) return null;
  return [
    Number(info.mtimeMs) || 0,
    Number(info.size) || 0,
    Number(info.dev) || 0,
    Number(info.ino) || 0,
  ];
}

/** Stat both sidecars without decoding either one. */
async function readWorkspaceSearchQuerySnapshot(identity) {
  const [contentInfo, pathInfo] = await Promise.all([
    stat(identity.contentFile).catch(() => null),
    stat(identity.pathFile).catch(() => null),
  ]);
  const content = searchIndexSidecarSnapshot(contentInfo);
  const paths = searchIndexSidecarSnapshot(pathInfo);
  if (content === null || paths === null) return null;
  return {
    content,
    paths,
    key: JSON.stringify([content, paths]),
  };
}

/**
 * Arm the stat-only query fast path only after this process has verified the
 * snapshot against the live watcher. A missing sidecar or stale scan disarms it.
 */
async function armWorkspaceSearchQuerySnapshot(identity, index) {
  if (
    index?.contentScanVerified !== true
    || index?.pathScanStale === true
    || !workspaceSearchIndexWatcherActive(identity.root)
  ) {
    SEARCH_INDEX_QUERY_SNAPSHOTS.delete(identity.key);
    return null;
  }
  const snapshot = await readWorkspaceSearchQuerySnapshot(identity);
  if (snapshot === null) {
    SEARCH_INDEX_QUERY_SNAPSHOTS.delete(identity.key);
    return null;
  }
  SEARCH_INDEX_QUERY_SNAPSHOTS.set(identity.key, snapshot);
  return snapshot;
}

/** Normalize ASCII bytes for case-insensitive sketch membership. */
function searchTextSketchByte(value) {
  return value >= 65 && value <= 90 ? value + 32 : value;
}

/** Derive three bounded Bloom positions from one trigram. */
function searchTextSketchPositions(first, second, third) {
  let primary = 2166136261;
  let secondary = 2246822519;
  for (const value of [first, second, third]) {
    const byte = searchTextSketchByte(value);
    primary = Math.imul(primary ^ byte, 16777619) >>> 0;
    secondary = Math.imul(secondary ^ byte, 3266489917) >>> 0;
  }
  secondary ^= secondary >>> 16;
  const mask = SEARCH_TEXT_SKETCH_BITS - 1;
  return [
    primary & mask,
    ((primary >>> 11) ^ Math.imul(secondary, 2654435761)) & mask,
    (Math.imul(primary, 2246822507) ^ secondary) & mask,
  ];
}

/** Build one file's bounded negative-filter sketch from complete bytes. */
function searchTextSketchFromBuffer(buffer) {
  const sketch = Buffer.alloc(SEARCH_TEXT_SKETCH_BYTES);
  for (let index = 0; index + 2 < buffer.length; index += 1) {
    for (const bit of searchTextSketchPositions(buffer[index], buffer[index + 1], buffer[index + 2])) {
      sketch[bit >>> 3] |= 1 << (bit & 7);
    }
  }
  return sketch;
}

/** Query-side positions, or null when the safe ASCII trigram boundary does not apply. */
function searchTextSketchQuery(needle) {
  if (typeof needle !== 'string' || needle.length < 3) return null;
  const buffer = Buffer.from(needle, 'utf8');
  if (buffer.length < 3 || buffer.some((value) => value > 0x7f)) return null;
  const positions = new Set();
  for (let index = 0; index + 2 < buffer.length; index += 1) {
    for (const bit of searchTextSketchPositions(buffer[index], buffer[index + 1], buffer[index + 2])) {
      positions.add(bit);
    }
  }
  return positions.size === 0 ? null : [...positions];
}

/** Bloom false positives are allowed; missing bits prove the substring cannot be present. */
function searchTextSketchMayContain(sketch, positions) {
  if (!(sketch instanceof Uint8Array) || sketch.length !== SEARCH_TEXT_SKETCH_BYTES) return true;
  for (const bit of positions) {
    if ((sketch[bit >>> 3] & (1 << (bit & 7))) === 0) return false;
  }
  return true;
}

/** Split absolute paths into grep-sized argument batches without dropping order. */
function searchTextExternalCandidateBatches(root, relativePaths) {
  const batches = [];
  let batch = [];
  let batchBytes = 0;
  for (const relativePath of relativePaths) {
    const absolutePath = resolveInside(root, relativePath);
    const argumentBytes = Buffer.byteLength(absolutePath, 'utf8') + 1;
    if (
      batch.length > 0
      && (
        batch.length >= TEXT_SEARCH_EXTERNAL_BATCH_FILES
        || batchBytes + argumentBytes > TEXT_SEARCH_EXTERNAL_BATCH_BYTES
      )
    ) {
      batches.push(batch);
      batch = [];
      batchBytes = 0;
    }
    batch.push({ absolutePath, relativePath });
    batchBytes += argumentBytes;
  }
  if (batch.length > 0) batches.push(batch);
  return batches;
}

/**
 * Ask the system literal matcher for matching lines among an already-filtered
 * index candidate set. GNU grep streams filename, line number and text; this
 * function converts those lines through the same preview/column matcher as the
 * in-process path and terminates every worker as soon as the result budget is
 * full. Any non-negative grep failure returns null and forces the caller's
 * complete in-process scan.
 */
async function discoverWorkspaceTextCandidatesByGrep(
  root,
  relativePaths,
  needle,
  { caseSensitive = false, maxMatches = 200, signal = null } = {},
) {
  if (
    relativePaths.length < TEXT_SEARCH_EXTERNAL_CANDIDATE_THRESHOLD
    || needle.length < 2
    || /[^\x00-\x7f]/u.test(needle)
    || /[\r\n\0]/u.test(needle)
  ) {
    return null;
  }
  const batches = searchTextExternalCandidateBatches(root, relativePaths);
  if (batches.length === 0) return null;
  const literalRegex = new RegExp(
    escapeSearchIndexPathQuery(needle),
    caseSensitive ? 'gu' : 'giu',
  );
  const matches = [];
  const visitedPaths = new Set();
  let scannedBytes = 0;
  let scannedBatches = 0;
  let scannedCandidates = 0;
  let stoppedAtLimit = false;
  let failed = false;
  let aborted = false;
  const activeChildren = new Set();
  const terminateChildren = () => {
    for (const child of activeChildren) child.kill('SIGTERM');
  };
  const consumeGrepRecord = (absolutePath, line, contentBuffer) => {
    if (matches.length >= maxMatches) return;
    let relativePath;
    try {
      relativePath = relative(root, absolutePath);
    } catch {
      return;
    }
    if (relativePath === '' || relativePath === '..' || relativePath.startsWith(`..${sep}`)) return;
    const content = contentBuffer.toString('utf8').replace(/\r$/u, '');
    const records = textSearchMatchRecords(content, needle, {
      regex: null,
      literalRegex,
      caseSensitive,
      wholeWords: false,
      maximum: maxMatches - matches.length,
      path: relativePath,
      contextFilter: 'anywhere',
    });
    if (records.length === 0) return;
    visitedPaths.add(relativePath);
    scannedBytes += contentBuffer.length;
    const preview = content.length > 220 ? `${content.slice(0, 217)}…` : content;
    for (const record of records) {
      matches.push({
        path: relativePath,
        line,
        column: record.offset + 1,
        matchLength: record.length,
        preview,
        mtime: 0,
      });
      if (matches.length >= maxMatches) break;
    }
  };
  const runBatch = async (batch) => {
    if (signal?.aborted === true || aborted || failed) return;
    await new Promise((resolve) => {
      let settled = false;
      let pending = Buffer.alloc(0);
      let child;
      const settle = () => {
        if (settled) return;
        settled = true;
        signal?.removeEventListener?.('abort', onAbort);
        if (child !== undefined) activeChildren.delete(child);
        resolve();
      };
      const onAbort = () => {
        aborted = true;
        child?.kill('SIGTERM');
        settle();
      };
      try {
        child = spawn(
          'grep',
          [
            '-H',
            '-I',
            '-n',
            '-Z',
            '-F',
            ...(caseSensitive ? [] : ['-i']),
            '--',
            needle,
            ...batch.map((entry) => entry.absolutePath),
          ],
          {
            env: { ...process.env, LC_ALL: 'C' },
            stdio: ['ignore', 'pipe', 'ignore'],
            windowsHide: true,
          },
        );
      } catch {
        failed = true;
        settle();
        return;
      }
      activeChildren.add(child);
      signal?.addEventListener?.('abort', onAbort, { once: true });
      child.stdout.on('data', (chunk) => {
        if (settled || aborted || failed) return;
        const data = pending.length === 0
          ? chunk
          : Buffer.concat([pending, Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)]);
        let start = 0;
        while (matches.length < maxMatches) {
          const nul = data.indexOf(0, start);
          if (nul < 0) break;
          const newline = data.indexOf(10, nul + 1);
          if (newline < 0) break;
          const absolutePath = data.subarray(start, nul).toString('utf8');
          const payload = data.subarray(nul + 1, newline);
          const colon = payload.indexOf(58);
          if (colon > 0) {
            const line = Number(payload.subarray(0, colon).toString('ascii'));
            if (Number.isSafeInteger(line) && line > 0) {
              consumeGrepRecord(absolutePath, line, payload.subarray(colon + 1));
            }
          }
          start = newline + 1;
        }
        pending = data.subarray(start);
        if (matches.length >= maxMatches) {
          stoppedAtLimit = true;
          terminateChildren();
        }
      });
      child.on('error', () => {
        if (stoppedAtLimit || aborted) return;
        failed = true;
        terminateChildren();
        settle();
      });
      child.on('close', (code) => {
        if (aborted || failed) {
          settle();
          return;
        }
        if (stoppedAtLimit || code === 0 || code === 1) {
          settle();
          return;
        }
        failed = true;
        terminateChildren();
        settle();
      });
    });
  };
  for (let start = 0; start < batches.length; start += TEXT_SEARCH_EXTERNAL_CONCURRENCY) {
    if (signal?.aborted === true || aborted || failed) return null;
    const wave = batches.slice(start, start + TEXT_SEARCH_EXTERNAL_CONCURRENCY);
    scannedBatches += wave.length;
    scannedCandidates += wave.reduce((total, batch) => total + batch.length, 0);
    await Promise.all(wave.map(runBatch));
    if (aborted || failed) return null;
    if (stoppedAtLimit) break;
  }
  return {
    matches,
    visitedFiles: visitedPaths.size,
    scannedBytes,
    complete: stoppedAtLimit !== true,
    stoppedAtLimit,
    scannedBatches,
    scannedCandidates,
  };
}

/** Drop persisted query results for one workspace. */
function invalidateWorkspaceSearchTextQueryCache(identity) {
  SEARCH_TEXT_QUERY_CACHE_FILE_EPOCHS.set(
    identity.key,
    (SEARCH_TEXT_QUERY_CACHE_FILE_EPOCHS.get(identity.key) ?? 0) + 1,
  );
  SEARCH_TEXT_QUERY_CACHE_FILE_MEMORY.delete(identity.key);
  SEARCH_TEXT_QUERY_CACHE_FILE_READS.delete(identity.key);
  SEARCH_TEXT_QUERY_CACHE_FILE_FAST_MEMORY.delete(identity.key);
  SEARCH_TEXT_QUERY_CACHE_FILE_FAST_READS.delete(identity.key);
  SEARCH_INDEX_QUERY_SNAPSHOTS.delete(identity.key);
  void rm(identity.queryCacheFile, { force: true }).catch(() => {});
}

/** Rebuild the bounded query map from one decoded cache payload. */
function searchTextQueryCacheEntries(payload) {
  if (!Array.isArray(payload?.entries)) return null;
  const entries = new Map();
  for (const entry of payload.entries) {
    if (
      Array.isArray(entry)
      && typeof entry[0] === 'string'
      && entry[0] !== ''
      && entry[1] !== null
      && typeof entry[1] === 'object'
      && Array.isArray(entry[1].matches)
    ) {
      entries.set(entry[0], entry[1]);
    }
  }
  return entries;
}

/**
 * Load one validated persisted query cache.
 * @param {object} identity - storage identity.
 * @param {object} index - current content index.
 * @param {object|null} pathView - current compact path projection.
 * @returns {Promise<{fingerprint: string, entries: Map<string, object>}|null>} cache state.
 */
function readWorkspaceSearchTextQueryCache(identity, index, pathView) {
  const fingerprint = searchTextQueryCacheFileFingerprint(index, pathView);
  const memory = SEARCH_TEXT_QUERY_CACHE_FILE_MEMORY.get(identity.key);
  if (memory?.fingerprint === fingerprint) return Promise.resolve(memory);
  const pending = SEARCH_TEXT_QUERY_CACHE_FILE_READS.get(identity.key);
  if (pending !== undefined) return pending;
  const request = (async () => {
    try {
      const cacheFile = await stat(identity.queryCacheFile).catch(() => null);
      if (cacheFile === null || !cacheFile.isFile()) return null;
      const chunks = [];
      for await (const chunk of createReadStream(identity.queryCacheFile).pipe(createGunzip())) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      const payload = deserializeV8(Buffer.concat(chunks));
      if (
        payload?.format !== SEARCH_TEXT_QUERY_CACHE_FILE_FORMAT
        || payload?.version !== SEARCH_TEXT_QUERY_CACHE_FILE_VERSION
        || payload?.root !== identity.root
        || payload?.fingerprint !== fingerprint
        || !Array.isArray(payload?.entries)
      ) {
        return null;
      }
      const entries = searchTextQueryCacheEntries(payload);
      if (entries === null) return null;
      const state = { fingerprint, entries };
      SEARCH_TEXT_QUERY_CACHE_FILE_MEMORY.set(identity.key, state);
      return state;
    } catch {
      return null;
    }
  })().finally(() => {
    if (SEARCH_TEXT_QUERY_CACHE_FILE_READS.get(identity.key) === request) {
      SEARCH_TEXT_QUERY_CACHE_FILE_READS.delete(identity.key);
    }
  });
  SEARCH_TEXT_QUERY_CACHE_FILE_READS.set(identity.key, request);
  return request;
}

/**
 * Read the query cache using only sidecar stats once the current process has
 * verified that exact snapshot. This deliberately avoids decoding the large
 * content sidecar and the compact path stream on a cross-restart cache hit.
 */
function readWorkspaceSearchTextQueryCacheFast(identity, snapshot) {
  const pending = SEARCH_TEXT_QUERY_CACHE_FILE_FAST_READS.get(identity.key);
  if (pending !== undefined) return pending;
  const request = (async () => {
    try {
      const cacheInfo = await stat(identity.queryCacheFile).catch(() => null);
      const cacheFileKey = searchIndexSidecarSnapshot(cacheInfo);
      if (cacheFileKey === null) return null;
      const memory = SEARCH_TEXT_QUERY_CACHE_FILE_FAST_MEMORY.get(identity.key);
      if (
        memory?.snapshotKey === snapshot.key
        && JSON.stringify(memory.cacheFileKey) === JSON.stringify(cacheFileKey)
      ) {
        return memory;
      }
      const chunks = [];
      for await (const chunk of createReadStream(identity.queryCacheFile).pipe(createGunzip())) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      const payload = deserializeV8(Buffer.concat(chunks));
      if (
        payload?.format !== SEARCH_TEXT_QUERY_CACHE_FILE_FORMAT
        || payload?.version !== SEARCH_TEXT_QUERY_CACHE_FILE_VERSION
        || payload?.root !== identity.root
        || payload?.snapshotKey !== snapshot.key
      ) {
        return null;
      }
      const entries = searchTextQueryCacheEntries(payload);
      if (entries === null) return null;
      const state = {
        snapshotKey: snapshot.key,
        cacheFileKey,
        entries,
      };
      SEARCH_TEXT_QUERY_CACHE_FILE_FAST_MEMORY.set(identity.key, state);
      return state;
    } catch {
      return null;
    }
  })().finally(() => {
    if (SEARCH_TEXT_QUERY_CACHE_FILE_FAST_READS.get(identity.key) === request) {
      SEARCH_TEXT_QUERY_CACHE_FILE_FAST_READS.delete(identity.key);
    }
  });
  SEARCH_TEXT_QUERY_CACHE_FILE_FAST_READS.set(identity.key, request);
  return request;
}

/**
 * Persist one validated positive query result behind a serialized atomic writer.
 * @param {object} snapshot - verified sidecar identity for the result.
 * @returns {Promise<void>} completion after the atomic rename or invalidation.
 */
function persistWorkspaceSearchTextQueryCache(identity, index, pathView, key, result, snapshot) {
  const fingerprint = searchTextQueryCacheFileFingerprint(index, pathView);
  const epoch = SEARCH_TEXT_QUERY_CACHE_FILE_EPOCHS.get(identity.key) ?? 0;
  const previousState = SEARCH_TEXT_QUERY_CACHE_FILE_MEMORY.get(identity.key);
  const entries =
    previousState?.fingerprint === fingerprint
      ? new Map(previousState.entries)
      : new Map();
  entries.delete(key);
  entries.set(key, result);
  while (entries.size > SEARCH_TEXT_QUERY_CACHE_LIMIT) {
    const oldest = entries.keys().next().value;
    if (oldest === undefined) break;
    entries.delete(oldest);
  }
  SEARCH_TEXT_QUERY_CACHE_FILE_MEMORY.set(identity.key, { fingerprint, entries });
  const previousWrite = SEARCH_TEXT_QUERY_CACHE_FILE_WRITES.get(identity.key) ?? Promise.resolve();
  const request = previousWrite
    .catch(() => {})
    .then(async () => {
      if (epoch !== (SEARCH_TEXT_QUERY_CACHE_FILE_EPOCHS.get(identity.key) ?? 0)) return;
      const payload = serializeV8({
        format: SEARCH_TEXT_QUERY_CACHE_FILE_FORMAT,
        version: SEARCH_TEXT_QUERY_CACHE_FILE_VERSION,
        root: identity.root,
        fingerprint,
        snapshotKey: snapshot.key,
        entries: [...entries],
      });
      const temporary = join(
        identity.directory,
        `.${basename(identity.queryCacheFile)}.${process.pid}-${randomUUID()}.tmp`,
      );
      try {
        await pipeline(Readable.from([payload]), createGzip(), createWriteStream(temporary, { flags: 'wx', mode: 0o600 }));
        if (epoch !== (SEARCH_TEXT_QUERY_CACHE_FILE_EPOCHS.get(identity.key) ?? 0)) {
          await unlink(temporary).catch(() => {});
          return;
        }
        await rename(temporary, identity.queryCacheFile);
        SEARCH_TEXT_QUERY_CACHE_FILE_FAST_MEMORY.delete(identity.key);
      } catch {
        await unlink(temporary).catch(() => {});
      }
    });
  SEARCH_TEXT_QUERY_CACHE_FILE_WRITES.set(identity.key, request);
  void request.finally(() => {
    if (SEARCH_TEXT_QUERY_CACHE_FILE_WRITES.get(identity.key) === request) {
      SEARCH_TEXT_QUERY_CACHE_FILE_WRITES.delete(identity.key);
    }
  });
  return request;
}

/** Read one workspace's persisted per-file negative-filter sketches. */
function readWorkspaceSearchTextSketches(identity) {
  const memory = SEARCH_TEXT_SKETCH_MEMORY.get(identity.key);
  if (memory !== undefined) return Promise.resolve(memory);
  const pending = SEARCH_TEXT_SKETCH_READS.get(identity.key);
  if (pending !== undefined) return pending;
  const request = (async () => {
    const state = { entries: new Map(), revision: 0 };
    const info = await stat(identity.sketchFile).catch(() => null);
    if (info === null) {
      SEARCH_TEXT_SKETCH_MEMORY.set(identity.key, state);
      return state;
    }
    try {
      const lines = createInterface({
        input: createReadStream(identity.sketchFile).pipe(createGunzip()),
        crlfDelay: Infinity,
      });
      let header = null;
      for await (const line of lines) {
        if (line === '') continue;
        const payload = JSON.parse(line);
        if (header === null) {
          if (
            payload?.format !== SEARCH_TEXT_SKETCH_FORMAT
            || payload?.version !== SEARCH_TEXT_SKETCH_VERSION
            || payload?.root !== identity.root
            || payload?.bits !== SEARCH_TEXT_SKETCH_BITS
          ) {
            return state;
          }
          header = payload;
          continue;
        }
        if (
          typeof payload?.path !== 'string'
          || payload.path === ''
          || typeof payload?.sketch !== 'string'
        ) {
          continue;
        }
        const sketch = Buffer.from(payload.sketch, 'base64');
        if (sketch.length !== SEARCH_TEXT_SKETCH_BYTES) continue;
        state.entries.set(payload.path, {
          mtimeMs: Number(payload.mtimeMs) || 0,
          size: Number(payload.size) || 0,
          dev: Number(payload.dev) || 0,
          ino: Number(payload.ino) || 0,
          sketch,
        });
      }
    } catch {
      state.entries.clear();
    }
    SEARCH_TEXT_SKETCH_MEMORY.set(identity.key, state);
    return state;
  })().finally(() => {
    if (SEARCH_TEXT_SKETCH_READS.get(identity.key) === request) {
      SEARCH_TEXT_SKETCH_READS.delete(identity.key);
    }
  });
  SEARCH_TEXT_SKETCH_READS.set(identity.key, request);
  return request;
}

/** Serialize the adaptive sketch state atomically after search activity settles. */
function writeWorkspaceSearchTextSketches(identity) {
  const state = SEARCH_TEXT_SKETCH_MEMORY.get(identity.key);
  if (state === undefined) return Promise.resolve(false);
  const revision = state.revision;
  const previous = SEARCH_TEXT_SKETCH_WRITES.get(identity.key) ?? Promise.resolve();
  const request = previous
    .catch(() => {})
    .then(async () => {
      if (state.entries.size === 0) {
        await rm(identity.sketchFile, { force: true }).catch(() => {});
        return false;
      }
      const temporary = join(
        identity.directory,
        `.${basename(identity.sketchFile)}.${process.pid}-${randomUUID()}.tmp`,
      );
      const records = (async function* serializedSketches() {
        yield `${JSON.stringify({
          format: SEARCH_TEXT_SKETCH_FORMAT,
          version: SEARCH_TEXT_SKETCH_VERSION,
          root: identity.root,
          bits: SEARCH_TEXT_SKETCH_BITS,
        })}\n`;
        for (const [path, entry] of state.entries) {
          yield `${JSON.stringify({
            path,
            mtimeMs: entry.mtimeMs,
            size: entry.size,
            dev: entry.dev,
            ino: entry.ino,
            sketch: entry.sketch.toString('base64'),
          })}\n`;
        }
      })();
      try {
        await pipeline(
          Readable.from(records),
          createGzip(),
          createWriteStream(temporary, { flags: 'wx', mode: 0o600 }),
        );
        await rename(temporary, identity.sketchFile);
        return true;
      } catch {
        await unlink(temporary).catch(() => {});
        return false;
      } finally {
        if (state.revision !== revision) scheduleWorkspaceSearchTextSketchWrite(identity);
      }
    })
    .finally(() => {
      if (SEARCH_TEXT_SKETCH_WRITES.get(identity.key) === request) {
        SEARCH_TEXT_SKETCH_WRITES.delete(identity.key);
      }
    });
  SEARCH_TEXT_SKETCH_WRITES.set(identity.key, request);
  return request;
}

/** Coalesce sketch writes so one search cannot trigger a write per file. */
function scheduleWorkspaceSearchTextSketchWrite(identity) {
  if (SEARCH_TEXT_SKETCH_TIMERS.has(identity.key)) return;
  const timer = setTimeout(() => {
    SEARCH_TEXT_SKETCH_TIMERS.delete(identity.key);
    void writeWorkspaceSearchTextSketches(identity);
  }, SEARCH_TEXT_SKETCH_WRITE_DELAY);
  timer.unref?.();
  SEARCH_TEXT_SKETCH_TIMERS.set(identity.key, timer);
}

/** Drop one path after a Host write; identity validation already covers external churn. */
function invalidateWorkspaceSearchTextSketchPath(identity, relativePath) {
  const state = SEARCH_TEXT_SKETCH_MEMORY.get(identity.key);
  if (state === undefined || !state.entries.delete(relativePath)) return;
  state.revision += 1;
  scheduleWorkspaceSearchTextSketchWrite(identity);
}

/** Clear all adaptive sketches for a workspace. */
function invalidateWorkspaceSearchTextSketches(identity) {
  const timer = SEARCH_TEXT_SKETCH_TIMERS.get(identity.key);
  if (timer !== undefined) clearTimeout(timer);
  SEARCH_TEXT_SKETCH_TIMERS.delete(identity.key);
  SEARCH_TEXT_SKETCH_MEMORY.delete(identity.key);
  SEARCH_TEXT_SKETCH_READS.delete(identity.key);
  void rm(identity.sketchFile, { force: true }).catch(() => {});
}

/** Store a newly scanned file without replacing a still-current sketch. */
function rememberWorkspaceSearchTextSketch(state, relativePath, buffer, info) {
  if (state === undefined || info === null || !Number.isFinite(Number(info.size))) return false;
  const fileIdentity = searchIndexFileIdentity(info);
  const previous = state.entries.get(relativePath);
  if (
    previous !== undefined
    && previous.size === Number(info.size)
    && Math.abs(previous.mtimeMs - Number(info.mtimeMs)) <= 1
    && searchIndexIdentityMatches(previous, info)
  ) {
    return false;
  }
  state.entries.set(relativePath, {
    ...fileIdentity,
    mtimeMs: Number(info.mtimeMs) || 0,
    size: Number(info.size) || 0,
    sketch: searchTextSketchFromBuffer(buffer),
  });
  state.revision += 1;
  return true;
}

/** Whether a stored sketch describes the exact file identity in the current index. */
function workspaceSearchTextSketchIsCurrent(sketchEntry, indexEntry) {
  if (sketchEntry === undefined || indexEntry === undefined) return false;
  return (
    sketchEntry.size === Number(indexEntry.size)
    && Math.abs(sketchEntry.mtimeMs - Number(indexEntry.mtimeMs)) <= 1
    && searchIndexIdentityMatches(sketchEntry, indexEntry)
  );
}

/** Build a bounded max-heap collector for streamed path candidates. */
function searchIndexBoundedCollector(compare, limit) {
  const heap = [];
  const siftUp = (start) => {
    let index = start;
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (compare(heap[index], heap[parent]) <= 0) break;
      [heap[index], heap[parent]] = [heap[parent], heap[index]];
      index = parent;
    }
  };
  const siftDown = () => {
    let index = 0;
    for (;;) {
      const left = index * 2 + 1;
      const right = left + 1;
      let largest = index;
      if (left < heap.length && compare(heap[left], heap[largest]) > 0) largest = left;
      if (right < heap.length && compare(heap[right], heap[largest]) > 0) largest = right;
      if (largest === index) return;
      [heap[index], heap[largest]] = [heap[largest], heap[index]];
      index = largest;
    }
  };
  return {
    push(entry) {
      if (heap.length < limit) {
        heap.push(entry);
        siftUp(heap.length - 1);
        return;
      }
      if (limit > 0 && compare(entry, heap[0]) < 0) {
        heap[0] = entry;
        siftDown();
      }
    },
    sorted() {
      heap.sort(compare);
      return heap;
    },
  };
}

/**
 * Retain the best N entries in a max-heap, then sort only those survivors.
 * This avoids sorting hundreds of thousands of one-character path matches.
 */
function searchIndexBoundedSortedEntries(entries, compare, limit) {
  const collector = searchIndexBoundedCollector(compare, limit);
  for (const entry of entries) collector.push(entry);
  return collector.sorted();
}

/**
 * Read the gzip-compressed V8 content snapshot when it is newer than the
 * portable NDJSON index. This avoids reparsing hundreds of thousands of JSON
 * objects on every process start while retaining NDJSON as the fallback.
 * @param {object} identity - storage identity.
 * @returns {Promise<object|null>} validated content index or null.
 */
async function readWorkspaceSearchContentSidecar(identity) {
  const [contentInfo, indexInfo] = await Promise.all([
    stat(identity.contentFile).catch(() => null),
    stat(identity.file).catch(() => null),
  ]);
  if (
    contentInfo === null
    || indexInfo === null
    || contentInfo.mtimeMs + 1 < indexInfo.mtimeMs
  ) {
    return null;
  }
  try {
    const chunks = [];
    for await (const chunk of createReadStream(identity.contentFile).pipe(createGunzip())) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const payload = deserializeV8(Buffer.concat(chunks));
    if (
      payload?.format !== SEARCH_INDEX_CONTENT_FORMAT
      || payload?.version !== SEARCH_INDEX_CONTENT_VERSION
      || payload?.root !== identity.root
      || payload?.files === null
      || typeof payload?.files !== 'object'
      || Array.isArray(payload.files)
    ) {
      return null;
    }
    const pathScanStale = SEARCH_INDEX_SCAN_STALE.has(identity.key);
    return {
      version: SEARCH_INDEX_VERSION,
      root: identity.root,
      updatedAt: Number(payload.updatedAt) || 0,
      contentBytes: Math.max(0, Number(payload.contentBytes) || 0),
      files: payload.files,
      directories: new Set(Array.isArray(payload.directories) ? payload.directories : []),
      pathScanComplete: payload.pathScanComplete === true && pathScanStale !== true,
      directoryScanComplete: payload.directoryScanComplete === true && pathScanStale !== true,
      pathScanStale,
      contentScanVerified: false,
      scopeSignature: typeof payload.scopeSignature === 'string' ? payload.scopeSignature : '',
      pathTruncated: payload.pathTruncated === true,
      contentTruncated: payload.contentTruncated === true,
      truncated: payload.truncated === true,
    };
  } catch {
    return null;
  }
}

/**
 * Atomically persist one workspace index.
 * @param {object} identity - storage identity.
 * @param {object} index - content index.
 * @param {AbortSignal|null} [signal=null] - request cancellation.
 * @returns {Promise<void>}
 */
async function writeWorkspaceSearchIndex(identity, index, signal = null) {
  if (signal?.aborted === true) throw createAbortError();
  const updatedAt = Date.now();
  const payload = {
    format: SEARCH_INDEX_STREAM_FORMAT,
    version: SEARCH_INDEX_VERSION,
    root: identity.root,
    updatedAt,
    contentBytes: index.contentBytes,
    complete: index.pathScanComplete === true,
    directoriesComplete: index.directoryScanComplete === true,
    scopeSignature: typeof index.scopeSignature === 'string' ? index.scopeSignature : '',
    pathTruncated: index.pathTruncated === true,
    contentTruncated: index.contentTruncated === true,
    truncated: index.truncated === true,
  };
  await mkdir(identity.directory, { recursive: true });
  const temporary = join(
    identity.directory,
    `.${basename(identity.file)}.${process.pid}-${randomUUID()}.tmp`,
  );
  try {
    const output = createWriteStream(temporary, { flags: 'wx', mode: 0o600 });
    const streams = [
      Readable.from(
        (async function* searchIndexLines() {
          yield `${JSON.stringify(payload)}\n`;
          for (const [path, entry] of Object.entries(index.files)) {
            yield `${JSON.stringify({ path, entry })}\n`;
          }
          for (const directory of index.directories ?? []) {
            if (typeof directory === 'string' && directory !== '') {
              yield `${JSON.stringify({ directory })}\n`;
            }
          }
        })(),
      ),
      createGzip(),
      output,
    ];
    await (signal === null ? pipeline(...streams) : pipeline(...streams, { signal }));
    if (signal?.aborted === true) throw createAbortError();
    await rename(temporary, identity.file);
  } catch (error) {
    await unlink(temporary).catch(() => {});
    throw error;
  }
  index.updatedAt = updatedAt;
  searchIndexRemember(identity, index);
  await writeWorkspaceSearchPathIndex(identity, index, signal);
  await writeWorkspaceSearchContentSidecar(identity, index, signal);
}

/**
 * Atomically persist the path-only projection used by filename search.
 * @param {object} identity - storage identity.
 * @param {object} index - content or path index.
 * @param {AbortSignal|null} [signal=null] - request cancellation.
 * @returns {Promise<void>}
 */
async function writeWorkspaceSearchPathIndex(identity, index, signal = null) {
  if (signal?.aborted === true) throw createAbortError();
  const pathIndex = index.contentOmitted === true ? index : searchIndexProjectPaths(index);
  const payload = {
    format: SEARCH_INDEX_PATH_STREAM_FORMAT,
    version: SEARCH_INDEX_PATH_VERSION,
    root: identity.root,
    updatedAt: Number(pathIndex.updatedAt) || Date.now(),
    contentBytes: Math.max(0, Number(pathIndex.contentBytes) || 0),
    complete: pathIndex.pathScanComplete === true,
    directoriesComplete: pathIndex.directoryScanComplete === true,
    contentScanVerified: pathIndex.contentScanVerified === true,
    scopeSignature: typeof pathIndex.scopeSignature === 'string' ? pathIndex.scopeSignature : '',
    pathTruncated: pathIndex.pathTruncated === true,
    contentTruncated: pathIndex.contentTruncated === true,
    truncated: pathIndex.truncated === true,
  };
  await mkdir(identity.directory, { recursive: true });
  const temporary = join(
    identity.directory,
    `.${basename(identity.pathFile)}.${process.pid}-${randomUUID()}.tmp`,
  );
  try {
    const output = createWriteStream(temporary, { flags: 'wx', mode: 0o600 });
    const streams = [
      Readable.from(
        (async function* searchIndexPathLines() {
          yield `${JSON.stringify(payload)}\n`;
          for (const path of Object.keys(pathIndex.files)) {
            if (path !== '') yield `F${path}\0`;
          }
          for (const directory of pathIndex.directories ?? []) {
            if (typeof directory === 'string' && directory !== '') {
              yield `D${directory}\0`;
            }
          }
        })(),
      ),
      createGzip(),
      output,
    ];
    await (signal === null ? pipeline(...streams) : pipeline(...streams, { signal }));
    if (signal?.aborted === true) throw createAbortError();
    await rename(temporary, identity.pathFile);
  } catch (error) {
    await unlink(temporary).catch(() => {});
    throw error;
  }
  searchIndexRememberPaths(identity, pathIndex);
}

/** Read only the small JSON header at the start of the compressed path sidecar. */
async function readWorkspaceSearchPathIndexHeader(identity) {
  const source = createReadStream(identity.pathFile);
  const decompressed = createGunzip();
  source.pipe(decompressed);
  const decoder = new StringDecoder('utf8');
  let headerText = '';
  try {
    for await (const chunk of decompressed) {
      headerText += decoder.write(chunk);
      const newline = headerText.indexOf('\n');
      if (newline >= 0) return JSON.parse(headerText.slice(0, newline));
      if (headerText.length > 64 * 1024) return null;
    }
    headerText += decoder.end();
    const newline = headerText.indexOf('\n');
    return newline >= 0 ? JSON.parse(headerText.slice(0, newline)) : null;
  } catch {
    return null;
  } finally {
    source.destroy();
    decompressed.destroy();
  }
}

/** Whether the path projection describes the same complete snapshot as content. */
function searchIndexPathHeaderMatches(header, index) {
  return (
    header?.format === SEARCH_INDEX_PATH_STREAM_FORMAT
    && header?.version === SEARCH_INDEX_PATH_VERSION
    && header?.root === index.root
    && Number(header?.updatedAt) === Number(index.updatedAt)
    && Number(header?.contentBytes) === Number(index.contentBytes)
    && header?.complete === (index.pathScanComplete === true)
    && header?.directoriesComplete === (index.directoryScanComplete === true)
    && header?.contentScanVerified === (index.contentScanVerified === true)
    && header?.scopeSignature === (typeof index.scopeSignature === 'string' ? index.scopeSignature : '')
    && header?.pathTruncated === (index.pathTruncated === true)
    && header?.contentTruncated === (index.contentTruncated === true)
    && header?.truncated === (index.truncated === true)
  );
}

/** Repair metadata-only divergence without rereading any workspace file body. */
async function ensureWorkspaceSearchPathIndexSidecar(identity, index, signal = null) {
  const header = await readWorkspaceSearchPathIndexHeader(identity);
  if (searchIndexPathHeaderMatches(header, index)) return false;
  await writeWorkspaceSearchPathIndex(identity, index, signal);
  return true;
}

/**
 * Persist the fast V8 content snapshot used by subsequent processes.
 * @param {object} identity - storage identity.
 * @param {object} index - content index.
 * @param {AbortSignal|null} [signal=null] - request cancellation.
 * @returns {Promise<void>}
 */
async function writeWorkspaceSearchContentSidecar(identity, index, signal = null) {
  if (signal?.aborted === true) throw createAbortError();
  const serialized = serializeV8({
    format: SEARCH_INDEX_CONTENT_FORMAT,
    version: SEARCH_INDEX_CONTENT_VERSION,
    root: identity.root,
    updatedAt: Number(index.updatedAt) || Date.now(),
    contentBytes: Math.max(0, Number(index.contentBytes) || 0),
    files: index.files,
    directories: index.directories instanceof Set ? [...index.directories] : [],
    pathScanComplete: index.pathScanComplete === true,
    directoryScanComplete: index.directoryScanComplete === true,
    scopeSignature: typeof index.scopeSignature === 'string' ? index.scopeSignature : '',
    pathTruncated: index.pathTruncated === true,
    contentTruncated: index.contentTruncated === true,
    truncated: index.truncated === true,
  });
  await mkdir(identity.directory, { recursive: true });
  const temporary = join(
    identity.directory,
    `.${basename(identity.contentFile)}.${process.pid}-${randomUUID()}.tmp`,
  );
  try {
    const output = createWriteStream(temporary, { flags: 'wx', mode: 0o600 });
    const streams = [Readable.from([serialized]), createGzip(), output];
    await (signal === null ? pipeline(...streams) : pipeline(...streams, { signal }));
    if (signal?.aborted === true) throw createAbortError();
    await rename(temporary, identity.contentFile);
  } catch (error) {
    await unlink(temporary).catch(() => {});
    throw error;
  }
}

/**
 * Serialize one index write behind any earlier write for the same workspace.
 * The generation and dirty revision prevent a queued write from resurrecting
 * a cleared index or clearing a newer mutation that arrived during the write.
 * @param {object} identity - storage identity.
 * @param {object} index - content index.
 * @param {number} generation - search generation captured by the caller.
 * @param {AbortSignal|null} [signal=null] - request cancellation.
 * @returns {Promise<boolean>} whether this request wrote the index.
 */
function queueWorkspaceSearchIndexWrite(identity, index, generation, signal = null) {
  if (index.dirty !== true) return Promise.resolve(false);
  const previous = SEARCH_INDEX_WRITES.get(identity.key) ?? Promise.resolve();
  const dirtyRevision = Number(index.dirtyRevision) || 0;
  const request = previous
    .catch(() => {})
    .then(async () => {
      if (index.dirty !== true) return false;
      if (signal?.aborted === true) return false;
      if (SEARCH_INDEX_SUSPENDED.has(identity.key)) return false;
      if (SEARCH_INDEX_REBUILD_PROGRESS.get(identity.key)?.building === true) return false;
      if (generation !== (SEARCH_INDEX_GENERATIONS.get(identity.key) ?? 0)) return false;
      try {
        await writeWorkspaceSearchIndex(identity, index, signal);
        if ((Number(index.dirtyRevision) || 0) === dirtyRevision) index.dirty = false;
        return true;
      } catch {
        return false;
      }
    });
  SEARCH_INDEX_WRITES.set(identity.key, request);
  return request.finally(() => {
    if (SEARCH_INDEX_WRITES.get(identity.key) === request) SEARCH_INDEX_WRITES.delete(identity.key);
  });
}

/** Serialize path-only mutations without ever overwriting the content cache. */
function queueWorkspaceSearchPathIndexWrite(identity, index, generation, signal = null) {
  if (index.dirty !== true) return Promise.resolve(false);
  const previous = SEARCH_INDEX_PATH_WRITES.get(identity.key) ?? Promise.resolve();
  const dirtyRevision = Number(index.dirtyRevision) || 0;
  const request = previous
    .catch(() => {})
    .then(async () => {
      if (index.dirty !== true) return false;
      if (signal?.aborted === true) return false;
      if (SEARCH_INDEX_SUSPENDED.has(identity.key)) return false;
      if (SEARCH_INDEX_REBUILD_PROGRESS.get(identity.key)?.building === true) return false;
      if (generation !== (SEARCH_INDEX_GENERATIONS.get(identity.key) ?? 0)) return false;
      try {
        const contentIndexExists = (await stat(identity.file).catch(() => null)) !== null;
        if (contentIndexExists) {
          await writeWorkspaceSearchPathIndex(identity, index, signal);
        } else {
          await writeWorkspaceSearchIndex(identity, index, signal);
        }
        if ((Number(index.dirtyRevision) || 0) === dirtyRevision) index.dirty = false;
        return true;
      } catch {
        return false;
      }
    });
  SEARCH_INDEX_PATH_WRITES.set(identity.key, request);
  return request.finally(() => {
    if (SEARCH_INDEX_PATH_WRITES.get(identity.key) === request) {
      SEARCH_INDEX_PATH_WRITES.delete(identity.key);
    }
  });
}

/** Wait for the currently queued write, if any, for one workspace. */
async function waitForWorkspaceSearchIndexWrites(identity) {
  const pendingContent = SEARCH_INDEX_WRITES.get(identity.key);
  const pendingPaths = SEARCH_INDEX_PATH_WRITES.get(identity.key);
  await Promise.all([
    pendingContent?.catch(() => {}) ?? Promise.resolve(),
    pendingPaths?.catch(() => {}) ?? Promise.resolve(),
  ]);
}

/** Remove crash-left temporary index files without touching the live snapshot. */
async function removeWorkspaceSearchIndexTemporaryFiles(identity) {
  const entries = await readdir(identity.directory).catch(() => []);
  await Promise.all(
    entries
      .filter(
        (name) =>
          name.endsWith('.tmp')
          && (
            name.startsWith(`.${basename(identity.file)}.`)
            || name.startsWith(`.${basename(identity.pathFile)}.`)
            || name.startsWith(`.${basename(identity.contentFile)}.`)
            || name.startsWith(`.${basename(identity.queryCacheFile)}.`)
          ),
      )
      .map((name) => unlink(join(identity.directory, name)).catch(() => {})),
  );
}

/**
 * Return the persisted index metadata without exposing cached file contents.
 * @param {string} root - workspace root.
 * @param {{searchIndexDirectory?: string}} [options] - storage override.
 * @returns {Promise<object>} index status.
 */
async function workspaceSearchIndexStatus(root, options = {}) {
  const identity = searchIndexIdentity(root, options);
  const progress = SEARCH_INDEX_REBUILD_PROGRESS.get(identity.key);
  const building = progress?.building === true;
  const progressFields = {
    rebuilding: building,
    processedFiles: Math.max(0, Number(progress?.processedFiles) || 0),
    totalFiles: Math.max(0, Number(progress?.totalFiles) || 0),
    rebuiltContentBytes: Math.max(0, Number(progress?.contentBytes) || 0),
    watcherActive: workspaceSearchIndexWatcherActive(root),
    generation: SEARCH_INDEX_GENERATIONS.get(identity.key) ?? 0,
  };
  if (building) {
    const existing = await stat(identity.file).catch(() => null);
    return {
      exists: existing !== null,
      files: 0,
      directories: 0,
      contentBytes: 0,
      updatedAt: existing?.mtimeMs ?? 0,
      pathScanComplete: false,
      directoryScanComplete: false,
      contentScanVerified: false,
      scopeSignature: '',
      pathTruncated: false,
      contentTruncated: false,
      truncated: false,
      ...progressFields,
    };
  }
  const contentIndex = SEARCH_INDEX_MEMORY.get(identity.key);
  const index =
    SEARCH_INDEX_PATH_MEMORY.get(identity.key)
    ?? await readWorkspaceSearchPathIndex(root, options);
  const contentScanVerified = contentIndex?.contentScanVerified === true;
  if (index === null) {
    return {
      exists: false,
      files: 0,
      directories: 0,
      contentBytes: 0,
      updatedAt: 0,
      pathScanComplete: false,
      directoryScanComplete: false,
      contentScanVerified: false,
      scopeSignature: '',
      pathTruncated: false,
      contentTruncated: false,
      truncated: false,
      ...progressFields,
    };
  }
  if (
    contentScanVerified !== true
    && index.pathScanComplete === true
    && index.pathScanStale !== true
    && workspaceSearchIndexWatcherActive(root)
  ) {
    SEARCH_INDEX_STARTUP_VERIFICATION.add(identity.key);
  }
  const counts = searchIndexStatusCounts(index);
  return {
    exists: true,
    files: counts.files,
    directories: counts.directories,
    contentBytes: index.contentBytes,
    updatedAt: index.updatedAt,
    pathScanComplete: index.pathScanComplete === true,
    directoryScanComplete: index.directoryScanComplete === true,
    contentScanVerified,
    scopeSignature: typeof index.scopeSignature === 'string' ? index.scopeSignature : '',
    pathTruncated: index.pathTruncated === true,
    contentTruncated: index.contentTruncated === true,
    truncated: index.truncated === true,
    ...progressFields,
  };
}

/**
 * Serialize rebuild requests per workspace, then rebuild the bounded content cache.
 * @param {string} root - workspace root.
 * @param {{searchDirectoryRules?: object, signal?: AbortSignal, searchIndexDirectory?: string, maxContentBytes?: number}} [options] - rebuild controls.
 * @returns {Promise<object>} rebuild summary.
 */
function rebuildWorkspaceSearchIndex(root, options = {}) {
  const identity = searchIndexIdentity(root, options);
  if (options?.signal?.aborted === true) {
    return Promise.resolve({ aborted: true, files: 0, contentBytes: 0, truncated: false });
  }
  const previous = SEARCH_INDEX_REBUILDS.get(identity.key);
  const request =
    previous !== undefined && SEARCH_INDEX_REBUILD_PROGRESS.get(identity.key)?.building === true
      ? previous
          .catch(() => {})
          .then(() => {
            if (options?.signal?.aborted === true) {
              return { aborted: true, files: 0, contentBytes: 0, truncated: false };
            }
            return runWorkspaceSearchIndexRebuild(identity, options);
          })
      : runWorkspaceSearchIndexRebuild(identity, options);
  SEARCH_INDEX_REBUILDS.set(identity.key, request);
  return request.finally(() => {
    if (SEARCH_INDEX_REBUILDS.get(identity.key) === request) SEARCH_INDEX_REBUILDS.delete(identity.key);
  });
}

/**
 * Run one already-serialized rebuild against a stable workspace identity.
 * @param {object} identity - storage identity.
 * @param {{searchDirectoryRules?: object, signal?: AbortSignal, maxContentBytes?: number}} [options] - rebuild controls.
 * @returns {Promise<object>} rebuild summary.
 */
async function runWorkspaceSearchIndexRebuild(identity, options = {}) {
  const generation = (SEARCH_INDEX_GENERATIONS.get(identity.key) ?? 0) + 1;
  const invalidationRevision = SEARCH_INDEX_INVALIDATION_REVISIONS.get(identity.key) ?? 0;
  const scanInvalidationRevision = SEARCH_INDEX_SCAN_INVALIDATION_REVISIONS.get(identity.key) ?? 0;
  const maxContentBytes = Math.max(
    1,
    Math.min(
      SEARCH_INDEX_MAX_CONTENT_BYTES,
      Number(options?.maxContentBytes) || SEARCH_INDEX_MAX_CONTENT_BYTES,
    ),
  );
  SEARCH_INDEX_GENERATIONS.set(identity.key, generation);
  SEARCH_INDEX_SUSPENDED.add(identity.key);
  SEARCH_INDEX_QUERY_SNAPSHOTS.delete(identity.key);
  const progress = {
    building: true,
    kind: 'rebuild',
    processedFiles: 0,
    totalFiles: 0,
    contentBytes: 0,
    startedAt: Date.now(),
  };
  SEARCH_INDEX_REBUILD_PROGRESS.set(identity.key, progress);
  try {
    await waitForWorkspaceSearchIndexWrites(identity);
    SEARCH_INDEX_MEMORY.delete(identity.key);
    SEARCH_INDEX_PATH_MEMORY.delete(identity.key);
    const listing = await listWorkspaceFiles(identity.root, Number.POSITIVE_INFINITY, {
      includeDirectories: true,
      respectGitIgnore: true,
      searchDirectoryRules: options?.searchDirectoryRules,
      signal: options?.signal,
    });
    if (options?.signal?.aborted === true) {
      return { aborted: true, files: 0, contentBytes: 0, truncated: false };
    }
    progress.totalFiles = listing.files.length;
    const files = Object.create(null);
    let contentBytes = 0;
    const pathTruncated = listing.truncated === true;
    let contentTruncated = false;
    let skippedFiles = 0;
    let contentBudgetExhausted = false;
    for (const relativePath of listing.files) {
      if (options?.signal?.aborted === true) {
        return { aborted: true, files: 0, contentBytes: 0, truncated: false };
      }
      progress.processedFiles += 1;
      if (contentBudgetExhausted) {
        files[relativePath] = { kind: 'path' };
        skippedFiles += 1;
        if (progress.processedFiles % SEARCH_INDEX_PATH_YIELD_INTERVAL === 0) {
          await new Promise((resolve) => setImmediate(resolve));
        }
        continue;
      }
      const file = resolveInside(identity.root, relativePath);
      const info = await stat(file).catch(() => null);
      if (info === null || !info.isFile()) continue;
      const fileIdentity = searchIndexFileIdentity(info);
      if (searchPathIsKnownNonText(relativePath)) {
        files[relativePath] = {
          ...fileIdentity,
          mtimeMs: info.mtimeMs,
          size: info.size,
          kind: 'binary',
        };
        continue;
      }
      if (info.size > TEXT_SEARCH_MAX_FILE_BYTES) {
        files[relativePath] = { ...fileIdentity, mtimeMs: info.mtimeMs, size: info.size, kind: 'large' };
        skippedFiles += 1;
        contentTruncated = true;
        continue;
      }
      if (contentBytes + info.size > maxContentBytes) {
        contentTruncated = true;
        contentBudgetExhausted = true;
        files[relativePath] = { ...fileIdentity, mtimeMs: info.mtimeMs, size: info.size, kind: 'path' };
        skippedFiles += 1;
        continue;
      }
      const buffer = await readFile(file).catch(() => null);
      if (buffer === null) continue;
      if (buffer.includes(0)) {
        files[relativePath] = { ...fileIdentity, mtimeMs: info.mtimeMs, size: info.size, kind: 'binary' };
        continue;
      }
      const content = buffer.toString('utf8');
      files[relativePath] = { ...fileIdentity, mtimeMs: info.mtimeMs, size: info.size, content };
      contentBytes += buffer.length;
      progress.contentBytes = contentBytes;
    }
    if (options?.signal?.aborted === true) {
      return { aborted: true, files: 0, contentBytes: 0, truncated: false };
    }
    const scanStable =
      scanInvalidationRevision === (SEARCH_INDEX_SCAN_INVALIDATION_REVISIONS.get(identity.key) ?? 0);
    const scanComplete = listing.truncated !== true && scanStable;
    const index = {
      version: SEARCH_INDEX_VERSION,
      root: identity.root,
      updatedAt: Date.now(),
      contentBytes,
      files,
      directories: new Set(listing.directories ?? []),
      pathScanComplete: scanComplete,
      directoryScanComplete: scanComplete,
      pathScanStale: scanStable !== true,
      pathTruncated,
      contentTruncated,
      truncated: pathTruncated || contentTruncated,
      contentScanVerified:
        workspaceSearchIndexWatcherActive(identity.root)
        && invalidationRevision === (SEARCH_INDEX_INVALIDATION_REVISIONS.get(identity.key) ?? 0)
        && scanStable,
      scopeSignature: searchIndexScopeSignature(options),
    };
    if (scanComplete) SEARCH_INDEX_SCAN_STALE.delete(identity.key);
    if (generation === (SEARCH_INDEX_GENERATIONS.get(identity.key) ?? 0)) {
      await writeWorkspaceSearchIndex(identity, index, options?.signal ?? null);
      await armWorkspaceSearchQuerySnapshot(identity, index);
    }
    return {
      files: Object.keys(files).length,
      contentBytes,
      skippedFiles,
      truncated: pathTruncated || contentTruncated,
      pathTruncated,
      contentTruncated,
      updatedAt: index.updatedAt,
    };
  } finally {
    const current = SEARCH_INDEX_REBUILD_PROGRESS.get(identity.key);
    if (current === progress) {
      current.building = false;
      current.finishedAt = Date.now();
    }
    SEARCH_INDEX_SUSPENDED.delete(identity.key);
    SEARCH_INDEX_GENERATIONS.set(identity.key, (SEARCH_INDEX_GENERATIONS.get(identity.key) ?? generation) + 1);
  }
}

/**
 * Refresh an existing workspace index in place.
 *
 * The path directory still has to be enumerated so removals are authoritative,
 * but unchanged files retain their cached content and only changed files are
 * read again. The same progress map is used by the Project progress strip.
 * @param {object} identity - storage identity.
 * @param {object} existing - previously validated index.
 * @param {{searchDirectoryRules?: object, signal?: AbortSignal, maxContentBytes?: number}} [options] - update controls.
 * @returns {Promise<object>} update summary.
 */
async function runWorkspaceSearchIndexUpdate(identity, existing, options = {}) {
  const requestedScopeSignature = searchIndexScopeSignature(options);
  if (
    existing.contentScanVerified === true
    && existing.pathScanComplete === true
    && existing.directoryScanComplete === true
    && existing.pathScanStale !== true
    && existing.scopeSignature === requestedScopeSignature
    && workspaceSearchIndexWatcherActive(identity.root)
  ) {
    searchIndexRemember(identity, existing);
    await ensureWorkspaceSearchPathIndexSidecar(identity, existing, options?.signal ?? null);
    await armWorkspaceSearchQuerySnapshot(identity, existing);
    const fileCount = Object.keys(existing.files).length;
    return {
      files: fileCount,
      contentBytes: existing.contentBytes,
      skippedFiles: 0,
      truncated: existing.truncated === true,
      pathTruncated: existing.pathTruncated === true,
      contentTruncated: existing.contentTruncated === true,
      updatedAt: existing.updatedAt,
      changedFiles: 0,
      reusedFiles: fileCount,
      removedFiles: 0,
      unchanged: true,
    };
  }
  const generation = (SEARCH_INDEX_GENERATIONS.get(identity.key) ?? 0) + 1;
  const invalidationRevision = SEARCH_INDEX_INVALIDATION_REVISIONS.get(identity.key) ?? 0;
  const scanInvalidationRevision = SEARCH_INDEX_SCAN_INVALIDATION_REVISIONS.get(identity.key) ?? 0;
  const maxContentBytes = Math.max(
    1,
    Math.min(
      SEARCH_INDEX_MAX_CONTENT_BYTES,
      Number(options?.maxContentBytes) || SEARCH_INDEX_MAX_CONTENT_BYTES,
    ),
  );
  SEARCH_INDEX_GENERATIONS.set(identity.key, generation);
  SEARCH_INDEX_SUSPENDED.add(identity.key);
  SEARCH_INDEX_QUERY_SNAPSHOTS.delete(identity.key);
  const progress = {
    building: true,
    kind: 'update',
    processedFiles: 0,
    totalFiles: 0,
    contentBytes: 0,
    startedAt: Date.now(),
  };
  SEARCH_INDEX_REBUILD_PROGRESS.set(identity.key, progress);
  try {
    await waitForWorkspaceSearchIndexWrites(identity);
    SEARCH_INDEX_PATH_MEMORY.delete(identity.key);
    const listing = await listWorkspaceFiles(identity.root, Number.POSITIVE_INFINITY, {
      includeDirectories: true,
      respectGitIgnore: true,
      searchDirectoryRules: options?.searchDirectoryRules,
      signal: options?.signal,
    });
    if (options?.signal?.aborted === true) {
      return { aborted: true, files: 0, contentBytes: 0, truncated: false };
    }
    progress.totalFiles = listing.files.length;
    const files = Object.create(null);
    let contentBytes = 0;
    let changedFiles = 0;
    let reusedFiles = 0;
    let skippedFiles = 0;
    let contentBudgetExhausted = false;
    const pathTruncated = listing.truncated === true;
    let contentTruncated = false;
    const prefetchedInfo = new Map();
    for (let fileIndex = 0; fileIndex < listing.files.length; fileIndex += 1) {
      const relativePath = listing.files[fileIndex];
      if (options?.signal?.aborted === true) {
        return { aborted: true, files: 0, contentBytes: 0, truncated: false };
      }
      if (fileIndex % SEARCH_INDEX_STAT_CONCURRENCY === 0) {
        const batch = listing.files.slice(
          fileIndex,
          Math.min(listing.files.length, fileIndex + SEARCH_INDEX_STAT_CONCURRENCY),
        );
        await Promise.all(
          batch.map(async (path) => {
            const absolutePath = resolveInside(identity.root, path);
            prefetchedInfo.set(path, await stat(absolutePath).catch(() => null));
          }),
        );
        if (options?.signal?.aborted === true) {
          return { aborted: true, files: 0, contentBytes: 0, truncated: false };
        }
      }
      progress.processedFiles += 1;
      const file = resolveInside(identity.root, relativePath);
      const info = prefetchedInfo.get(relativePath) ?? null;
      prefetchedInfo.delete(relativePath);
      if (info === null || !info.isFile()) {
        if (progress.processedFiles % SEARCH_INDEX_PATH_YIELD_INTERVAL === 0) {
          await new Promise((resolve) => setImmediate(resolve));
        }
        continue;
      }
      const cached = existing.files[relativePath];
      const cachedContentBytes = typeof cached?.content === 'string' ? Buffer.byteLength(cached.content) : 0;
      const unchanged =
        cached !== undefined
        && cached !== null
        && cached.kind !== 'stale'
        && cached.size === info.size
        && Math.abs(Number(cached.mtimeMs) - info.mtimeMs) <= 1
        && searchIndexIdentityMatches(cached, info);
      if (searchPathIsKnownNonText(relativePath)) {
        if (unchanged && cached.kind === 'binary') {
          files[relativePath] = cached;
          reusedFiles += 1;
        } else {
          files[relativePath] = {
            ...searchIndexFileIdentity(info),
            mtimeMs: info.mtimeMs,
            size: info.size,
            kind: 'binary',
          };
          changedFiles += 1;
        }
        if (progress.processedFiles % SEARCH_INDEX_PATH_YIELD_INTERVAL === 0) {
          await new Promise((resolve) => setImmediate(resolve));
        }
        continue;
      }
      const pathOnlyStillWithinBudget =
        cached?.kind === 'path'
        && contentBytes + info.size > maxContentBytes;
      if (
        (unchanged && contentBytes + cachedContentBytes <= maxContentBytes)
        || pathOnlyStillWithinBudget
      ) {
        files[relativePath] = cached;
        if (cached.kind === 'path' || cached.kind === 'large') contentTruncated = true;
        contentBytes += cachedContentBytes;
        reusedFiles += 1;
        progress.contentBytes = contentBytes;
        if (progress.processedFiles % SEARCH_INDEX_PATH_YIELD_INTERVAL === 0) {
          await new Promise((resolve) => setImmediate(resolve));
        }
        continue;
      }
      changedFiles += 1;
      if (contentBudgetExhausted) {
        contentTruncated = true;
        files[relativePath] = {
          ...searchIndexFileIdentity(info),
          mtimeMs: info.mtimeMs,
          size: info.size,
          kind: 'path',
        };
        skippedFiles += 1;
        if (progress.processedFiles % SEARCH_INDEX_PATH_YIELD_INTERVAL === 0) {
          await new Promise((resolve) => setImmediate(resolve));
        }
        continue;
      }
      if (info.size > TEXT_SEARCH_MAX_FILE_BYTES) {
        files[relativePath] = {
          ...searchIndexFileIdentity(info),
          mtimeMs: info.mtimeMs,
          size: info.size,
          kind: 'large',
        };
        skippedFiles += 1;
        contentTruncated = true;
        continue;
      }
      if (contentBytes + info.size > maxContentBytes) {
        contentTruncated = true;
        contentBudgetExhausted = true;
        files[relativePath] = {
          ...searchIndexFileIdentity(info),
          mtimeMs: info.mtimeMs,
          size: info.size,
          kind: 'path',
        };
        skippedFiles += 1;
        continue;
      }
      const buffer = await readFile(file).catch(() => null);
      if (options?.signal?.aborted === true) {
        return { aborted: true, files: 0, contentBytes: 0, truncated: false };
      }
      if (buffer === null) {
        files[relativePath] = {
          ...searchIndexFileIdentity(info),
          mtimeMs: info.mtimeMs,
          size: info.size,
          kind: 'path',
        };
        skippedFiles += 1;
        continue;
      }
      if (buffer.includes(0)) {
        files[relativePath] = {
          ...searchIndexFileIdentity(info),
          mtimeMs: info.mtimeMs,
          size: info.size,
          kind: 'binary',
        };
        continue;
      }
      files[relativePath] = {
        ...searchIndexFileIdentity(info),
        mtimeMs: info.mtimeMs,
        size: info.size,
        content: buffer.toString('utf8'),
      };
      contentBytes += buffer.length;
      progress.contentBytes = contentBytes;
      if (progress.processedFiles % SEARCH_INDEX_PATH_YIELD_INTERVAL === 0) {
        await new Promise((resolve) => setImmediate(resolve));
      }
    }
    if (options?.signal?.aborted === true) {
      return { aborted: true, files: 0, contentBytes: 0, truncated: false };
    }
    const scanStable = scanInvalidationRevision === (SEARCH_INDEX_SCAN_INVALIDATION_REVISIONS.get(identity.key) ?? 0);
    const scanComplete = listing.truncated !== true && scanStable;
    const directoryComplete =
      listing.truncated !== true
      && listing.directoriesTruncated !== true
      && scanStable;
    const removedFiles =
      listing.truncated === true
        ? 0
        : Object.keys(existing.files).filter((relativePath) => files[relativePath] === undefined).length;
    const directories = new Set(listing.directories ?? []);
    const directoriesChanged =
      directories.size !== existing.directories.size
      || [...directories].some((directory) => !existing.directories.has(directory));
    const indexUnchanged =
      changedFiles === 0
      && removedFiles === 0
      && !directoriesChanged
      && existing.pathTruncated === pathTruncated
      && existing.contentTruncated === contentTruncated
      && existing.pathScanComplete === scanComplete
      && existing.directoryScanComplete === directoryComplete
      && existing.pathScanStale === (scanStable !== true)
      && existing.scopeSignature === searchIndexScopeSignature(options)
      && existing.contentBytes === contentBytes;
    if (indexUnchanged) {
      existing.contentScanVerified =
        workspaceSearchIndexWatcherActive(identity.root)
        && invalidationRevision === (SEARCH_INDEX_INVALIDATION_REVISIONS.get(identity.key) ?? 0)
        && scanStable;
      searchIndexRemember(identity, existing);
      await ensureWorkspaceSearchPathIndexSidecar(identity, existing, options?.signal ?? null);
      const contentSidecarExists = await stat(identity.contentFile).catch(() => null);
      if (contentSidecarExists === null) {
        await writeWorkspaceSearchContentSidecar(identity, existing, options?.signal ?? null);
      }
      await armWorkspaceSearchQuerySnapshot(identity, existing);
      return {
        files: Object.keys(existing.files).length,
        contentBytes,
        skippedFiles,
        truncated: pathTruncated || contentTruncated,
        pathTruncated,
        contentTruncated,
        updatedAt: existing.updatedAt,
        changedFiles,
        reusedFiles,
        removedFiles,
        scanStable,
        scanInvalidation: scanStable
          ? null
          : SEARCH_INDEX_SCAN_INVALIDATION_DETAILS.get(identity.key) ?? null,
      };
    }
    const index = {
      version: SEARCH_INDEX_VERSION,
      root: identity.root,
      updatedAt: Date.now(),
      contentBytes,
      files,
      directories,
      pathScanComplete: scanComplete,
      directoryScanComplete: directoryComplete,
      pathScanStale: scanStable !== true,
      pathTruncated,
      contentTruncated,
      truncated: pathTruncated || contentTruncated,
      contentScanVerified:
        workspaceSearchIndexWatcherActive(identity.root)
        && invalidationRevision === (SEARCH_INDEX_INVALIDATION_REVISIONS.get(identity.key) ?? 0)
        && scanStable,
      scopeSignature: searchIndexScopeSignature(options),
    };
    if (scanStable) SEARCH_INDEX_SCAN_STALE.delete(identity.key);
    if (generation === (SEARCH_INDEX_GENERATIONS.get(identity.key) ?? 0)) {
      await writeWorkspaceSearchIndex(identity, index, options?.signal ?? null);
      await armWorkspaceSearchQuerySnapshot(identity, index);
    }
    return {
      files: Object.keys(files).length,
      contentBytes,
      skippedFiles,
      truncated: pathTruncated || contentTruncated,
      pathTruncated,
      contentTruncated,
      updatedAt: index.updatedAt,
      changedFiles,
      reusedFiles,
      removedFiles,
      scanStable,
      scanInvalidation: scanStable
        ? null
        : SEARCH_INDEX_SCAN_INVALIDATION_DETAILS.get(identity.key) ?? null,
    };
  } finally {
    const current = SEARCH_INDEX_REBUILD_PROGRESS.get(identity.key);
    if (current === progress) {
      current.building = false;
      current.finishedAt = Date.now();
    }
    SEARCH_INDEX_SUSPENDED.delete(identity.key);
    SEARCH_INDEX_GENERATIONS.set(identity.key, (SEARCH_INDEX_GENERATIONS.get(identity.key) ?? generation) + 1);
  }
}

/**
 * Apply one project-open index update. A missing or corrupt snapshot falls back
 * to a full rebuild; an existing snapshot only rereads changed files.
 * @param {string} root - workspace root.
 * @param {{searchDirectoryRules?: object, signal?: AbortSignal, searchIndexDirectory?: string, maxContentBytes?: number}} [options] - update controls.
 * @returns {Promise<object>} update or rebuild summary.
 */
function updateWorkspaceSearchIndex(root, options = {}) {
  const identity = searchIndexIdentity(root, options);
  if (options?.signal?.aborted === true) {
    return Promise.resolve({ aborted: true, files: 0, contentBytes: 0, truncated: false });
  }
  const previous = SEARCH_INDEX_REBUILDS.get(identity.key);
  const queuedProgress = {
    building: true,
    kind: 'update',
    processedFiles: 0,
    totalFiles: 0,
    contentBytes: 0,
    startedAt: Date.now(),
  };
  if (SEARCH_INDEX_REBUILD_PROGRESS.get(identity.key)?.building !== true) {
    SEARCH_INDEX_REBUILD_PROGRESS.set(identity.key, queuedProgress);
  }
  const request = (previous ?? Promise.resolve())
    .catch(() => {})
    .then(async () => {
      if (options?.signal?.aborted === true) {
        return { aborted: true, files: 0, contentBytes: 0, truncated: false };
      }
      const existing = await readWorkspaceSearchIndex(root, options);
      if (existing === null) return runWorkspaceSearchIndexRebuild(identity, options);
      return runWorkspaceSearchIndexUpdate(identity, existing, options);
    })
    .then((result) => {
      if (result?.aborted !== true) SEARCH_INDEX_STARTUP_VERIFICATION.delete(identity.key);
      return result;
    });
  SEARCH_INDEX_REBUILDS.set(identity.key, request);
  return request.finally(() => {
    if (SEARCH_INDEX_REBUILDS.get(identity.key) === request) SEARCH_INDEX_REBUILDS.delete(identity.key);
    const current = SEARCH_INDEX_REBUILD_PROGRESS.get(identity.key);
    if (current === queuedProgress) {
      queuedProgress.building = false;
      queuedProgress.finishedAt = Date.now();
    }
  });
}

/**
 * Remove one workspace's persisted project index.
 * @param {string} root - workspace root.
 * @param {{searchIndexDirectory?: string}} [options] - storage override.
 * @returns {Promise<{cleared: boolean}>} clear result.
 */
async function clearWorkspaceSearchIndex(root, options = {}) {
  const identity = searchIndexIdentity(root, options);
  if (options?.signal?.aborted === true) return { cleared: false, aborted: true };
  SEARCH_INDEX_GENERATIONS.set(identity.key, (SEARCH_INDEX_GENERATIONS.get(identity.key) ?? 0) + 1);
  SEARCH_INDEX_SUSPENDED.add(identity.key);
  try {
    await waitForWorkspaceSearchIndexWrites(identity);
    if (options?.signal?.aborted === true) return { cleared: false, aborted: true };
    const existing = await stat(identity.file).catch(() => null);
    const existingPaths = await stat(identity.pathFile).catch(() => null);
    const existingContent = await stat(identity.contentFile).catch(() => null);
    if (options?.signal?.aborted === true) return { cleared: false, aborted: true };
    SEARCH_INDEX_MEMORY.delete(identity.key);
    SEARCH_INDEX_PATH_MEMORY.delete(identity.key);
    SEARCH_INDEX_PATH_QUERY_MEMORY.delete(identity.key);
    SEARCH_TEXT_QUERY_CACHE.clear();
    invalidateWorkspaceSearchTextQueryCache(identity);
    invalidateWorkspaceSearchTextSketches(identity);
    SEARCH_INDEX_PATH_QUERY_EPOCHS.set(
      identity.key,
      (SEARCH_INDEX_PATH_QUERY_EPOCHS.get(identity.key) ?? 0) + 1,
    );
    await rm(identity.file, { force: true });
    await rm(identity.pathFile, { force: true });
    await rm(identity.contentFile, { force: true });
    await rm(identity.queryCacheFile, { force: true });
    await removeWorkspaceSearchIndexTemporaryFiles(identity);
    return { cleared: existing !== null || existingPaths !== null || existingContent !== null };
  } finally {
    SEARCH_INDEX_SUSPENDED.delete(identity.key);
  }
}

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
  if (options?.literalRegex instanceof RegExp) {
    const literalRegex = options.literalRegex;
    literalRegex.lastIndex = 0;
    while (records.length < maximum) {
      const match = literalRegex.exec(source);
      if (match === null) break;
      const offset = match.index;
      const length = match[0].length;
      if (
        (!options?.wholeWords || isWholeWordMatch(source, query, offset))
        && (mask === null || textSearchContextAllows(mask, offset, length, contextFilter))
      ) {
        records.push({ offset, length });
      }
    }
    return records;
  }
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

/** Detect binary content without loading an arbitrarily large file into memory. */
async function filePrefixContainsBinaryData(file, maximumBytes = 64 * 1024) {
  const handle = await open(file, 'r').catch(() => null);
  if (handle === null) return false;
  try {
    const buffer = Buffer.alloc(maximumBytes);
    const { bytesRead } = await handle.read(buffer, 0, maximumBytes, 0);
    return buffer.subarray(0, bytesRead).includes(0);
  } catch {
    return false;
  } finally {
    await handle.close().catch(() => {});
  }
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
    const rawPattern = (excluded ? token.slice(1) : token).trim().replace(/\\/gu, '/').replace(/^\.\//u, '');
    /* IDEA's mask field accepts extension lists such as `.ts, .md`. A bare
       dot-extension is a suffix filter, not a file literally named `.ts`. */
    const pattern =
      rawPattern.startsWith('.') && !rawPattern.includes('/') && !/[?*]/u.test(rawPattern)
        ? `*${rawPattern}`
        : rawPattern;
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
 * @param {{caseSensitive?: boolean, wholeWords?: boolean, regex?: boolean, fileMask?: string, maxMatches?: number, maxBytes?: number, includeExcluded?: boolean, directory?: string, allowedPaths?: string[], gitScope?: string, dirtyPaths?: string[], contextFilter?: string, scopeIncludePatterns?: string[], scopeExcludePatterns?: string[], searchIndex?: boolean, searchIndexDirectory?: string, fastPartialTextSearch?: boolean, signal?: AbortSignal}} [options] - search controls, aggregate byte ceiling, project content cache, lexical filter, scope and request cancellation.
 * @returns {Promise<{matches: object[], truncated: boolean, visitedFiles: number, scannedBytes: number, dirtyPaths?: string[], indexCache?: object, indexFastPath?: boolean}>} text hits, actual read volume and cache activity.
 */
async function searchWorkspaceText(root, query, options = {}) {
  const needle = typeof query === 'string' ? query : '';
  if (needle === '') return { matches: [], truncated: false, visitedFiles: 0, scannedBytes: 0 };
  if (options?.signal?.aborted === true) return { matches: [], truncated: false, visitedFiles: 0, scannedBytes: 0 };
  const maxMatches = Math.max(1, Math.min(500, Number(options?.maxMatches) || 200));
  const requestedMaxBytes = Number(options?.maxBytes);
  const maxBytes =
    Number.isFinite(requestedMaxBytes) && requestedMaxBytes > 0
      ? Math.max(1, Math.min(TEXT_SEARCH_MAX_TOTAL_BYTES, requestedMaxBytes))
      : Number.POSITIVE_INFINITY;
  const caseSensitive = smartCaseSensitive(needle, options);
  const wholeWords = options?.wholeWords === true;
  const useRegex = options?.regex === true;
  const regex = useRegex ? compileWorkspaceRegex(needle, caseSensitive) : null;
  const literalRegex =
    !useRegex && needle.length <= REGEX_MAX_PATTERN_LENGTH
      ? new RegExp(escapeSearchIndexPathQuery(needle), caseSensitive ? 'gu' : 'giu')
      : null;
  const fileMask = compileWorkspaceFileMask(options?.fileMask);
  const includeExcluded = options?.includeExcluded === true;
  const contextFilter = normalizeTextSearchContextFilter(options?.contextFilter);
  const scope = workspaceSearchScope(options);
  if (scope.directory === null) {
    const requestedDirectory = typeof options?.directory === 'string' ? options.directory.trim() : '';
    if (requestedDirectory !== '') throw new Error(`invalid search directory scope: ${requestedDirectory}`);
    return { matches: [], truncated: false, visitedFiles: 0, scannedBytes: 0 };
  }
  if (scope.directory !== '') {
    const info = await stat(resolveInside(root, scope.directory)).catch(() => null);
    if (info === null || !info.isDirectory()) {
      throw new Error(`search directory does not exist: ${scope.directory}`);
    }
  }
  const searchDirectoryRules = normalizeSearchDirectoryRules(options?.searchDirectoryRules);
  const indexIdentity = options?.searchIndex === true ? searchIndexIdentity(root, options) : null;
  const queryCacheSessionId =
    typeof options?.searchSessionId === 'string' ? options.searchSessionId.trim() : '';
  const queryCacheRevision =
    Number.isInteger(options?.searchRevision) && options.searchRevision >= 0
      ? options.searchRevision
      : null;
  const queryCacheInputs = [
    needle,
    maxMatches,
    Number.isFinite(maxBytes) ? maxBytes : null,
    caseSensitive,
    wholeWords,
    useRegex,
    includeExcluded,
    typeof options?.fileMask === 'string' ? options.fileMask.trim() : '',
    scope.directory,
    scope.recursive,
    scope.allowedPaths === null ? null : [...scope.allowedPaths].sort(),
    typeof options?.gitScope === 'string' ? options.gitScope : '',
    contextFilter,
    normalizeWorkspaceScopePatterns(options?.scopeIncludePatterns),
    normalizeWorkspaceScopePatterns(options?.scopeExcludePatterns),
    searchDirectoryRules.excludedDirectories,
    searchDirectoryRules.includedDirectories,
  ];
  const queryCacheIndexGeneration =
    indexIdentity === null ? 0 : SEARCH_INDEX_GENERATIONS.get(indexIdentity.key) ?? 0;
  const queryCacheContentRevision =
    indexIdentity === null ? 0 : SEARCH_INDEX_INVALIDATION_REVISIONS.get(indexIdentity.key) ?? 0;
  const queryCacheScanRevision =
    indexIdentity === null ? 0 : SEARCH_INDEX_SCAN_INVALIDATION_REVISIONS.get(indexIdentity.key) ?? 0;
  const queryCacheEnabled =
    indexIdentity !== null
    && workspaceSearchIndexWatcherActive(root)
    && !(Array.isArray(options?.dirtyPaths) && options.dirtyPaths.length > 0);
  const queryCacheBase =
    !queryCacheEnabled || queryCacheSessionId === '' || queryCacheRevision === null
      ? null
      : [indexIdentity.key, ...queryCacheInputs];
  const queryCacheKey = queryCacheBase === null
    ? null
    : JSON.stringify([
          ...queryCacheBase,
          queryCacheSessionId,
          queryCacheRevision,
          queryCacheContentRevision,
          queryCacheScanRevision,
          queryCacheIndexGeneration,
        ]);
  const persistentQueryCacheKey =
    queryCacheEnabled ? JSON.stringify(queryCacheInputs) : null;
  const partialQueryCacheKey =
    queryCacheEnabled
      ? JSON.stringify([
          indexIdentity.key,
          ...queryCacheInputs,
          queryCacheContentRevision,
          queryCacheScanRevision,
          queryCacheIndexGeneration,
        ])
      : null;
  const cachedQuery = queryCacheKey === null ? undefined : SEARCH_TEXT_QUERY_CACHE.get(queryCacheKey);
  if (cachedQuery !== undefined) {
    SEARCH_TEXT_QUERY_CACHE.delete(queryCacheKey);
    SEARCH_TEXT_QUERY_CACHE.set(queryCacheKey, cachedQuery);
    return {
      ...cachedQuery,
      matches: cachedQuery.matches.map((match) => ({ ...match })),
      dirtyPaths: [...(cachedQuery.dirtyPaths ?? [])],
      indexCache: {
        ...cachedQuery.indexCache,
        queryCacheHit: true,
      },
    };
  }
  const armedQuerySnapshot =
    indexIdentity === null ? null : SEARCH_INDEX_QUERY_SNAPSHOTS.get(indexIdentity.key) ?? null;
  if (
    persistentQueryCacheKey !== null
    && armedQuerySnapshot !== null
    && SEARCH_INDEX_REBUILD_PROGRESS.get(indexIdentity.key)?.building !== true
    && SEARCH_INDEX_SCAN_STALE.has(indexIdentity.key) !== true
  ) {
    const currentSnapshot = await readWorkspaceSearchQuerySnapshot(indexIdentity);
    if (
      currentSnapshot?.key === armedQuerySnapshot.key
      && workspaceSearchIndexWatcherActive(root)
      && SEARCH_INDEX_REBUILD_PROGRESS.get(indexIdentity.key)?.building !== true
      && queryCacheIndexGeneration === (SEARCH_INDEX_GENERATIONS.get(indexIdentity.key) ?? 0)
      && queryCacheContentRevision
        === (SEARCH_INDEX_INVALIDATION_REVISIONS.get(indexIdentity.key) ?? 0)
      && queryCacheScanRevision
        === (SEARCH_INDEX_SCAN_INVALIDATION_REVISIONS.get(indexIdentity.key) ?? 0)
    ) {
      const queryCacheState = await readWorkspaceSearchTextQueryCacheFast(
        indexIdentity,
        currentSnapshot,
      );
      const fastResult = queryCacheState?.entries.get(persistentQueryCacheKey) ?? null;
      if (
        fastResult !== null
        && typeof fastResult === 'object'
        && Array.isArray(fastResult.matches)
        && fastResult.matches.length > 0
        && queryCacheIndexGeneration === (SEARCH_INDEX_GENERATIONS.get(indexIdentity.key) ?? 0)
        && queryCacheContentRevision
          === (SEARCH_INDEX_INVALIDATION_REVISIONS.get(indexIdentity.key) ?? 0)
        && queryCacheScanRevision
          === (SEARCH_INDEX_SCAN_INVALIDATION_REVISIONS.get(indexIdentity.key) ?? 0)
      ) {
        const cachedResult = {
          ...fastResult,
          dirtyPaths: [],
          indexCache: {
            ...(fastResult.indexCache ?? {}),
            fastPersistentQueryCacheHit: true,
          },
          indexFastPath: true,
        };
        if (queryCacheKey !== null) {
          SEARCH_TEXT_QUERY_CACHE.delete(queryCacheKey);
          SEARCH_TEXT_QUERY_CACHE.set(queryCacheKey, cachedResult);
        }
        return cachedResult;
      }
    }
  }
  const cachedPartialQuery =
    options?.fastPartialTextSearch === true && partialQueryCacheKey !== null
      ? SEARCH_PARTIAL_TEXT_QUERY_CACHE.get(partialQueryCacheKey)
      : undefined;
  if (cachedPartialQuery !== undefined && options?.signal?.aborted !== true) {
    SEARCH_PARTIAL_TEXT_QUERY_CACHE.delete(partialQueryCacheKey);
    SEARCH_PARTIAL_TEXT_QUERY_CACHE.set(partialQueryCacheKey, cachedPartialQuery);
    return {
      ...cachedPartialQuery,
      matches: cachedPartialQuery.matches.map((match) => ({ ...match })),
      dirtyPaths: [...(cachedPartialQuery.dirtyPaths ?? [])],
      indexCache: {
        ...cachedPartialQuery.indexCache,
        fastPartialQueryCacheHit: true,
      },
      fastPartialQueryCacheHit: true,
    };
  }
  if (
    options?.fastPartialTextSearch === true
    && maxMatches <= SEARCH_TEXT_PARTIAL_RESULT_LIMIT
    && !useRegex
    && !wholeWords
    && contextFilter === 'anywhere'
    && !Number.isFinite(requestedMaxBytes)
    && scope.directory === ''
    && scope.recursive === true
    && scope.allowedPaths === null
    && includeExcluded !== true
    && (typeof options?.gitScope !== 'string' || options.gitScope === '')
    && normalizeWorkspaceScopePatterns(options?.scopeIncludePatterns).length === 0
    && normalizeWorkspaceScopePatterns(options?.scopeExcludePatterns).length === 0
    && !(Array.isArray(options?.dirtyPaths) && options.dirtyPaths.length > 0)
    && !needle.includes('\0')
  ) {
    let rawCandidates = null;
    try {
      rawCandidates = await runGit(root, [
        'grep',
        '-l',
        '-z',
        '-I',
        '-F',
        ...(caseSensitive ? [] : ['-i']),
        '--untracked',
        '--exclude-standard',
        '--',
        needle,
      ], { timeout: 5000, signal: options?.signal ?? undefined });
    } catch (error) {
      /* git grep uses exit 1 for "no matches"; that is a valid bounded negative,
         not a command failure. Other exit codes still fall back to full scan. */
      rawCandidates =
        Number(error?.code) === 1 && typeof error?.stdout === 'string'
          ? error.stdout
          : null;
    }
    if (options?.signal?.aborted === true) {
      return { matches: [], truncated: false, visitedFiles: 0, scannedBytes: 0 };
    }
    if (rawCandidates !== null) {
      const fastMatches = [];
      let fastVisitedFiles = 0;
      let fastScannedBytes = 0;
      for (const relativePath of rawCandidates.split('\0')) {
        if (options?.signal?.aborted === true) break;
        if (relativePath === '') continue;
        if (fastMatches.length >= maxMatches) break;
        if (!searchPathAllowedByDirectoryRules(relativePath, searchDirectoryRules)) continue;
        if (searchPathIsSystemGenerated(relativePath)) continue;
        if (fileMask !== null && !fileMask.matches(relativePath)) continue;
        let absolutePath = null;
        try {
          absolutePath = resolveInside(root, relativePath);
        } catch {
          continue;
        }
        const buffer = await readFile(absolutePath).catch(() => null);
        if (buffer === null || buffer.includes(0)) continue;
        fastVisitedFiles += 1;
        fastScannedBytes += buffer.length;
        const content = buffer.toString('utf8');
        const records = textSearchMatchRecords(content, needle, {
          regex: null,
          literalRegex,
          caseSensitive,
          wholeWords: false,
          maximum: maxMatches - fastMatches.length,
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
          if (fastMatches.length >= maxMatches) break;
          const matchOffset = record.offset;
          while (lineIndex + 1 < lineStarts.length && lineStarts[lineIndex + 1] <= matchOffset) lineIndex += 1;
          const lineStart = lineStarts[lineIndex];
          const lineEnd = lineStarts[lineIndex + 1] === undefined ? content.length : lineStarts[lineIndex + 1] - 1;
          const preview = content.slice(lineStart, lineEnd).replace(/\r$/u, '');
          fastMatches.push({
            path: relativePath,
            line: lineIndex + 1,
            column: matchOffset - lineStart + 1,
            matchLength: record.length,
            preview: preview.length > 220 ? `${preview.slice(0, 217)}…` : preview,
            mtime: 0,
          });
        }
      }
      if (fastMatches.length > 0 && options?.signal?.aborted !== true) {
        const fastResult = {
          matches: fastMatches,
          truncated: true,
          visitedFiles: fastVisitedFiles,
          scannedBytes: fastScannedBytes,
          dirtyPaths: [],
          indexCache: {
            enabled: false,
            hits: 0,
            misses: fastVisitedFiles,
            skippedStats: 0,
            prefetchedStats: 0,
            saved: false,
          },
          fastPartialTextSearch: true,
        };
        if (partialQueryCacheKey !== null) {
          SEARCH_PARTIAL_TEXT_QUERY_CACHE.delete(partialQueryCacheKey);
          SEARCH_PARTIAL_TEXT_QUERY_CACHE.set(partialQueryCacheKey, fastResult);
          while (SEARCH_PARTIAL_TEXT_QUERY_CACHE.size > SEARCH_PARTIAL_TEXT_QUERY_CACHE_LIMIT) {
            const oldest = SEARCH_PARTIAL_TEXT_QUERY_CACHE.keys().next().value;
            if (oldest === undefined) break;
            SEARCH_PARTIAL_TEXT_QUERY_CACHE.delete(oldest);
          }
        }
        return fastResult;
      }
    }
  }
  const gitIgnoredPrefixes = await listGitIgnoredSearchPrefixes(root, options);
  if (options?.signal?.aborted === true)
    return { matches: [], truncated: false, visitedFiles: 0, scannedBytes: 0 };
  const searchPathAllowed = (path) =>
    searchPathAllowedByDirectoryRules(path, searchDirectoryRules)
    && !searchPathIsGitIgnored(path, gitIgnoredPrefixes)
    && !searchPathIsSystemGenerated(path);
  const searchPathMatchesTextScope = (path) =>
    searchPathAllowed(path)
    && workspaceSearchPathMatchesScope(path, scope)
    && workspaceScopePatternsMatch(path, options?.scopeIncludePatterns, options?.scopeExcludePatterns)
    && (fileMask === null || fileMask.matches(path));
  const gitListing = await listGitSearchScopeFiles(
    root,
    options?.gitScope,
    searchPathMatchesTextScope,
    options?.signal ?? null,
  );
  if (options?.signal?.aborted === true)
    return { matches: [], truncated: false, visitedFiles: 0, scannedBytes: 0 };
  const indexGeneration = indexIdentity === null ? 0 : (SEARCH_INDEX_GENERATIONS.get(indexIdentity.key) ?? 0);
  const scanInvalidationRevision =
    indexIdentity === null ? 0 : SEARCH_INDEX_SCAN_INVALIDATION_REVISIONS.get(indexIdentity.key) ?? 0;
  const storedIndex = indexIdentity === null ? null : await readWorkspaceSearchIndex(root, options);
  const storedPathQueryView =
    indexIdentity === null ? null : await readWorkspaceSearchPathQueryView(root, options);
  const extraPathFiles =
    storedPathQueryView !== null
    && (
      storedIndex === null
      || Number(storedPathQueryView.header.updatedAt) > Number(storedIndex.updatedAt) + 1
    )
      ? searchWorkspacePathQueryViewFilePaths(storedPathQueryView)
      : [];
  const indexScopeSignature = searchIndexScopeSignature(options);
  const indexFastPath =
    gitListing === null
    && scope.allowedPaths === null
    && searchIndexCanProvidePathListing(root, indexIdentity, storedIndex, options, indexScopeSignature);
  const indexProgress = indexIdentity === null ? undefined : SEARCH_INDEX_REBUILD_PROGRESS.get(indexIdentity.key);
  const trustCachedContentBeforeVerification =
    indexFastPath
    && workspaceSearchIndexWatcherActive(root)
    && (
      SEARCH_INDEX_STARTUP_VERIFICATION.has(indexIdentity.key)
      || (indexProgress?.building === true && indexProgress.kind === 'update')
    );
  const contentVerificationRevision =
    indexIdentity === null ? 0 : SEARCH_INDEX_INVALIDATION_REVISIONS.get(indexIdentity.key) ?? 0;
  const persistentQueryCacheReadable =
    persistentQueryCacheKey !== null
    && indexFastPath
    && storedIndex?.contentScanVerified === true
    && trustCachedContentBeforeVerification !== true
    && indexProgress?.building !== true
    && scanInvalidationRevision === (SEARCH_INDEX_SCAN_INVALIDATION_REVISIONS.get(indexIdentity.key) ?? 0);
  if (persistentQueryCacheReadable) {
    const queryCacheState = await readWorkspaceSearchTextQueryCache(indexIdentity, storedIndex, storedPathQueryView);
    const persistentResult = queryCacheState?.entries.get(persistentQueryCacheKey) ?? null;
    if (
      persistentResult !== null
      && typeof persistentResult === 'object'
      && Array.isArray(persistentResult.matches)
      && persistentResult.matches.length > 0
      && SEARCH_INDEX_REBUILD_PROGRESS.get(indexIdentity.key)?.building !== true
      && indexGeneration === (SEARCH_INDEX_GENERATIONS.get(indexIdentity.key) ?? 0)
      && contentVerificationRevision
        === (SEARCH_INDEX_INVALIDATION_REVISIONS.get(indexIdentity.key) ?? 0)
      && scanInvalidationRevision
        === (SEARCH_INDEX_SCAN_INVALIDATION_REVISIONS.get(indexIdentity.key) ?? 0)
    ) {
      const cachedResult = {
        ...persistentResult,
        dirtyPaths: [],
        indexCache: {
          ...(persistentResult.indexCache ?? {}),
          persistentQueryCacheHit: true,
        },
        indexFastPath: true,
      };
      if (queryCacheKey !== null) {
        SEARCH_TEXT_QUERY_CACHE.delete(queryCacheKey);
        SEARCH_TEXT_QUERY_CACHE.set(queryCacheKey, cachedResult);
      }
      return cachedResult;
    }
  }
  const refreshScopedDirectorySnapshot =
    storedIndex !== null
    && storedIndex.scopeSignature !== indexScopeSignature
    && gitListing === null
    && scope.allowedPaths === null;
  const listing = gitListing !== null
    ? gitListing
    : scope.allowedPaths === null
      ? indexFastPath
        ? {
            files: [...new Set([
              ...Object.keys(storedIndex.files),
              ...extraPathFiles,
            ])].filter(searchPathMatchesTextScope),
            truncated: storedIndex.pathTruncated === true,
          }
        : await listWorkspaceFiles(root, Number.POSITIVE_INFINITY, {
            includeExcluded,
            includeDirectories: refreshScopedDirectorySnapshot,
            directoryLimit: TEXT_SEARCH_DIRECTORY_SNAPSHOT_LIMIT,
            directory: scope.directory,
            recursive: scope.recursive,
            gitIgnoredPrefixes,
            searchDirectoryRules,
            includeFile: searchPathMatchesTextScope,
            signal: options?.signal,
          })
      : { files: [...scope.allowedPaths].filter(searchPathMatchesTextScope), truncated: false };
  if (options?.signal?.aborted === true)
    return { matches: [], truncated: false, visitedFiles: 0, scannedBytes: 0 };
  const candidateSetIsCompleteWorkspace =
    gitListing === null
    && scope.allowedPaths === null
    && scope.directory === ''
    && scope.recursive !== false
    && includeExcluded !== true
    && fileMask === null
    && normalizeWorkspaceScopePatterns(options?.scopeIncludePatterns).length === 0
    && normalizeWorkspaceScopePatterns(options?.scopeExcludePatterns).length === 0
    && listing.truncated !== true;
  const liveListingIsCompleteWorkspace = !indexFastPath && candidateSetIsCompleteWorkspace;
  const liveListingIsScanFresh =
    indexIdentity !== null
    && liveListingIsCompleteWorkspace
    && scanInvalidationRevision === (SEARCH_INDEX_SCAN_INVALIDATION_REVISIONS.get(indexIdentity.key) ?? 0);
  const index = indexIdentity === null
    ? null
    : storedIndex ?? {
        version: SEARCH_INDEX_VERSION,
        root: indexIdentity.root,
        updatedAt: 0,
        contentBytes: 0,
        files: Object.create(null),
        directories: new Set(),
        pathScanComplete: false,
        directoryScanComplete: false,
        pathScanStale: false,
        contentScanVerified: false,
        scopeSignature: '',
        pathTruncated: false,
        contentTruncated: false,
        truncated: false,
      };
  if (index !== null && liveListingIsCompleteWorkspace) {
    searchIndexApplyPathSnapshot(index, listing.files);
    if (liveListingIsScanFresh && index.scopeSignature !== indexScopeSignature) {
      if (Array.isArray(listing.directories) && listing.directoriesTruncated !== true) {
        searchIndexApplyDirectorySnapshot(index, new Set(listing.directories), true);
        index.directoryScanComplete = true;
      } else {
        for (const directory of [...index.directories]) {
          if (!searchPathAllowedByDirectoryRules(directory, searchDirectoryRules)) {
            index.directories.delete(directory);
          }
        }
        index.directoryScanComplete = false;
      }
      index.scopeSignature = indexScopeSignature;
      searchIndexMarkDirty(index);
    }
    if (
      index.pathScanComplete !== liveListingIsScanFresh
      || index.pathScanStale === liveListingIsScanFresh
      || (liveListingIsScanFresh !== true && index.directoryScanComplete === true)
    ) {
      index.pathScanComplete = liveListingIsScanFresh;
      index.pathScanStale = liveListingIsScanFresh !== true;
      if (liveListingIsScanFresh !== true) index.directoryScanComplete = false;
      searchIndexMarkDirty(index);
    }
    if (liveListingIsScanFresh) SEARCH_INDEX_SCAN_STALE.delete(indexIdentity.key);
  }
  let searchableFiles = [];
  const searchablePaths = new Set();
  for (const path of listing.files) {
    if (searchablePaths.has(path)) continue;
    searchablePaths.add(path);
    searchableFiles.push(path);
  }
  if (index !== null && gitListing === null && scope.allowedPaths === null) {
    for (const path of [
      ...Object.keys(index.files),
      ...extraPathFiles,
    ]) {
      if (searchablePaths.has(path) || !searchPathMatchesTextScope(path)) continue;
      searchablePaths.add(path);
      searchableFiles.push(path);
    }
  }
  searchableFiles = searchableFiles.filter((path) => !searchPathIsKnownNonText(path));
  /*
   * On a large workspace, scanning paths in storage order can spend seconds
   * reading unrelated files before reaching the files whose names already
   * match the query. Reordering the candidate traversal is a search-ranking
   * change, not a result filter: every non-binary text candidate remains
   * eligible, but likely hits and files already held in memory are examined
   * first.
   */
  if (searchableFiles.length >= 10_000 && needle.length >= 2) {
    const pathMatches = [];
    const cachedText = [];
    const remaining = [];
    for (const path of searchableFiles) {
      const name = path.slice(path.lastIndexOf('/') + 1).toLowerCase();
      if (name.includes(needle)) pathMatches.push(path);
      else if (typeof index?.files[path]?.content === 'string') cachedText.push(path);
      else remaining.push(path);
    }
    searchableFiles = pathMatches.concat(cachedText, remaining);
  }
  const requestedDirtyPaths = [...new Set((Array.isArray(options?.dirtyPaths) ? options.dirtyPaths : [])
    .filter((path) => typeof path === 'string' && path !== ''))];
  const eligibleDirtyPaths = requestedDirtyPaths
    .filter(searchPathMatchesTextScope)
    .slice(0, 5000);
  const gitListedPaths = gitListing === null ? null : new Set(gitListing.files);
  const dirtyPaths = gitListing === null
    ? eligibleDirtyPaths
    : eligibleDirtyPaths.filter((path) => gitListedPaths.has(path));
  let externalCandidateScan = null;
  if (
    indexFastPath
    && storedIndex?.contentScanVerified === true
    && SEARCH_INDEX_REBUILD_PROGRESS.get(indexIdentity.key)?.building !== true
    && workspaceSearchIndexWatcherActive(root)
    && !useRegex
    && !wholeWords
    && contextFilter === 'anywhere'
    && !Number.isFinite(requestedMaxBytes)
    && dirtyPaths.length === 0
    && searchableFiles.length >= TEXT_SEARCH_EXTERNAL_CANDIDATE_THRESHOLD
  ) {
    externalCandidateScan = await discoverWorkspaceTextCandidatesByGrep(
      root,
      searchableFiles,
      needle,
      {
        caseSensitive,
        maxMatches,
        signal: options?.signal ?? null,
      },
    );
    if (options?.signal?.aborted === true)
      return { matches: [], truncated: false, visitedFiles: 0, scannedBytes: 0 };
    if (externalCandidateScan !== null) {
      searchableFiles = [];
    }
  }
  const sketchQueryPositions = searchTextSketchQuery(needle);
  let sketchState = null;
  let skippedStats = 0;
  let sketchesSkipped = 0;
  let sketchesBuilt = 0;
  if (
    !useRegex
    && sketchQueryPositions !== null
    && indexIdentity !== null
    && index !== null
    && indexFastPath
    && externalCandidateScan === null
    && storedIndex?.contentScanVerified === true
    && SEARCH_INDEX_REBUILD_PROGRESS.get(indexIdentity.key)?.building !== true
    && SEARCH_INDEX_SCAN_STALE.has(indexIdentity.key) !== true
  ) {
    sketchState = await readWorkspaceSearchTextSketches(indexIdentity);
    if (options?.signal?.aborted === true)
      return { matches: [], truncated: false, visitedFiles: 0, scannedBytes: 0 };
    const dirtyPathSet = new Set(dirtyPaths);
    searchableFiles = searchableFiles.filter((path) => {
      if (dirtyPathSet.has(path)) return true;
      const storedSketch = sketchState.entries.get(path);
      const indexedFile = index.files[path];
      if (
        !workspaceSearchTextSketchIsCurrent(storedSketch, indexedFile)
        || searchTextSketchMayContain(storedSketch.sketch, sketchQueryPositions)
      ) {
        return true;
      }
      skippedStats += 1;
      sketchesSkipped += 1;
      return false;
    });
  }
  const matches = externalCandidateScan === null ? [] : [...externalCandidateScan.matches];
  let truncated = listing.truncated || externalCandidateScan?.stoppedAtLimit === true;
  let visitedFiles = externalCandidateScan?.visitedFiles ?? 0;
  let scannedBytes = externalCandidateScan?.scannedBytes ?? 0;
  let cacheHits = 0;
  let cacheMisses = 0;
  let searchedAllCandidates = true;
  let pathSetChangedDuringSearch = false;
  let contentVerificationIncomplete = false;
  let prefetchedStats = 0;
  let indexDirty = index?.dirty === true;
  const prefetchedInfo = new Map();
  const prefetchedContent = new Map();
  const prefetchMetadata = async (startIndex) => {
    const paths = searchableFiles.slice(
      startIndex,
      Math.min(searchableFiles.length, startIndex + TEXT_SEARCH_STAT_CONCURRENCY),
    );
    const metadata = await Promise.all(
      paths.map(async (relativePath) => {
        try {
          return [relativePath, await stat(resolveInside(root, relativePath)).catch(() => null)];
        } catch {
          return [relativePath, null];
        }
      }),
    );
    prefetchedStats += metadata.length;
    for (const [path, info] of metadata) prefetchedInfo.set(path, info);
    const contentBatch = [];
    let prefetchedBytes = 0;
    for (const [path, info] of metadata) {
      if (info === null || !info.isFile() || info.size > 2 * 1024 * 1024) continue;
      if (typeof index?.files[path]?.content === 'string') continue;
      if (prefetchedBytes + info.size > 12 * 1024 * 1024) continue;
      prefetchedBytes += info.size;
      contentBatch.push(path);
    }
    for (let cursor = 0; cursor < contentBatch.length; cursor += 8) {
      await Promise.all(
        contentBatch.slice(cursor, cursor + 8).map(async (path) => {
          const buffer = await readFile(resolveInside(root, path)).catch(() => null);
          if (buffer !== null) prefetchedContent.set(path, buffer);
        }),
      );
    }
  };
  for (let fileIndex = 0; fileIndex < searchableFiles.length; fileIndex += 1) {
    if (options?.signal?.aborted === true)
      return { matches: [], truncated: false, visitedFiles, scannedBytes };
    const relativePath = searchableFiles[fileIndex];
    const file = resolveInside(root, relativePath);
    const cached = index?.files[relativePath];
    const cachedContentBytes = typeof cached?.content === 'string' ? Buffer.byteLength(cached.content) : 0;
    const dropCachedEntry = () => {
      if (index === null || cached === undefined) return;
      delete index.files[relativePath];
      index.contentBytes = Math.max(0, index.contentBytes - cachedContentBytes);
      indexDirty = true;
    };
    let info = null;
    let content = null;
    let prefetchedBuffer = null;
    let trustedCachedContent = false;
    if (
      indexFastPath
      && workspaceSearchIndexWatcherActive(root)
      && (index?.contentScanVerified === true || trustCachedContentBeforeVerification)
      && cached !== undefined
      && cached.kind !== 'stale'
    ) {
      if (cached.kind === 'binary') {
        skippedStats += 1;
        continue;
      }
      if (typeof cached.content === 'string') {
        content = cached.content;
        cacheHits += 1;
        skippedStats += 1;
        info = { mtimeMs: Number(cached.mtimeMs) || 0 };
        trustedCachedContent = true;
      }
    }
    if (content === null) {
      if (!prefetchedInfo.has(relativePath)) {
        await prefetchMetadata(fileIndex);
        if (options?.signal?.aborted === true)
          return { matches: [], truncated: false, visitedFiles, scannedBytes };
      }
      info = prefetchedInfo.get(relativePath) ?? null;
      prefetchedInfo.delete(relativePath);
      prefetchedBuffer = prefetchedContent.get(relativePath) ?? null;
      prefetchedContent.delete(relativePath);
      if (options?.signal?.aborted === true)
        return { matches: [], truncated: false, visitedFiles, scannedBytes };
    }
    if (!trustedCachedContent && (info === null || !info.isFile())) {
      dropCachedEntry();
      pathSetChangedDuringSearch = true;
      continue;
    }
    const cacheCurrent =
      cached !== undefined
      && cached !== null
      && cached.kind !== 'stale'
      && cached.size === info.size
      && Math.abs(Number(cached.mtimeMs) - info.mtimeMs) <= 1
      && searchIndexIdentityMatches(cached, info);
    if (content === null && cacheCurrent) {
      if (cached.kind === 'binary') continue;
      if (typeof cached.content === 'string') {
        content = cached.content;
        cacheHits += 1;
      }
    }
    if (content === null) {
      cacheMisses += 1;
      if (info.size > TEXT_SEARCH_MAX_FILE_BYTES && (await filePrefixContainsBinaryData(file))) {
        if (index !== null && !cacheCurrent) {
          index.files[relativePath] = {
            ...searchIndexFileIdentity(info),
            mtimeMs: info.mtimeMs,
            size: info.size,
            kind: 'binary',
          };
          index.contentBytes = Math.max(0, index.contentBytes - cachedContentBytes);
          indexDirty = true;
        }
        continue;
      }
      if (info.size > maxBytes - scannedBytes) {
        truncated = true;
        contentVerificationIncomplete = true;
        continue;
      }
      const buffer = prefetchedBuffer ?? await readFile(file).catch(() => null);
      if (options?.signal?.aborted === true)
        return { matches: [], truncated: false, visitedFiles, scannedBytes };
      if (buffer === null) {
        contentVerificationIncomplete = true;
        continue;
      }
      scannedBytes += buffer.length;
      if (index !== null) {
        if (buffer.includes(0)) {
          index.files[relativePath] = {
            ...searchIndexFileIdentity(info),
            mtimeMs: info.mtimeMs,
            size: info.size,
            kind: 'binary',
          };
          index.contentBytes = Math.max(0, index.contentBytes - cachedContentBytes);
          indexDirty = true;
          continue;
        }
        if (index.contentBytes - cachedContentBytes + buffer.length <= SEARCH_INDEX_MAX_CONTENT_BYTES) {
          index.files[relativePath] = {
            ...searchIndexFileIdentity(info),
            mtimeMs: info.mtimeMs,
            size: info.size,
            content: buffer.toString('utf8'),
          };
          index.contentBytes = index.contentBytes - cachedContentBytes + buffer.length;
          indexDirty = true;
        }
      }
      if (buffer.includes(0)) continue;
      content = buffer.toString('utf8');
    }
    if (sketchState !== null && typeof content === 'string') {
      const sketchInfo = Number.isFinite(Number(info?.size)) ? info : cached;
      if (rememberWorkspaceSearchTextSketch(
        sketchState,
        relativePath,
        Buffer.from(content, 'utf8'),
        sketchInfo,
      )) {
        sketchesBuilt += 1;
      }
    }
    visitedFiles += 1;
    const remaining = Math.max(0, maxMatches - matches.length);
    const records = textSearchMatchRecords(content, needle, {
      regex,
      literalRegex,
      caseSensitive,
      wholeWords,
      maximum: remaining + 1,
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
      if (matches.length >= maxMatches) {
        truncated = true;
        break;
      }
      const matchOffset = record.offset;
      while (lineIndex + 1 < lineStarts.length && lineStarts[lineIndex + 1] <= matchOffset) lineIndex += 1;
      const lineStart = lineStarts[lineIndex];
      const lineEnd = lineStarts[lineIndex + 1] === undefined ? content.length : lineStarts[lineIndex + 1] - 1;
      const preview = content.slice(lineStart, lineEnd).replace(/\r$/u, '');
      matches.push({
        path: relativePath,
        line: lineIndex + 1,
        column: matchOffset - lineStart + 1,
        matchLength: record.length,
        preview: preview.length > 220 ? `${preview.slice(0, 217)}…` : preview,
        mtime: info.mtimeMs,
      });
    }
    if (matches.length >= maxMatches && fileIndex < searchableFiles.length - 1) {
      truncated = true;
      searchedAllCandidates = false;
      break;
    }
  }
  if (
    index !== null
    && searchedAllCandidates
    && pathSetChangedDuringSearch !== true
    && contentVerificationIncomplete !== true
    && candidateSetIsCompleteWorkspace
    && index.pathScanComplete === true
    && index.pathScanStale !== true
    && index.scopeSignature === indexScopeSignature
    && workspaceSearchIndexWatcherActive(root)
    && SEARCH_INDEX_REBUILD_PROGRESS.get(indexIdentity.key)?.building !== true
    && indexGeneration === (SEARCH_INDEX_GENERATIONS.get(indexIdentity.key) ?? 0)
    && contentVerificationRevision === (SEARCH_INDEX_INVALIDATION_REVISIONS.get(indexIdentity.key) ?? 0)
  ) {
    index.contentScanVerified = true;
    SEARCH_INDEX_STARTUP_VERIFICATION.delete(indexIdentity.key);
    await armWorkspaceSearchQuerySnapshot(indexIdentity, index);
  }
  if (trustCachedContentBeforeVerification) {
    truncated = true;
    contentVerificationIncomplete = true;
  }
  let indexSaved = false;
  if (
    index !== null
    && indexDirty
    && options?.signal?.aborted !== true
    && SEARCH_INDEX_REBUILD_PROGRESS.get(indexIdentity.key)?.building !== true
    && indexGeneration === (SEARCH_INDEX_GENERATIONS.get(indexIdentity.key) ?? 0)
  ) {
    searchIndexMarkDirty(index);
    indexSaved = await queueWorkspaceSearchIndexWrite(
      indexIdentity,
      index,
      indexGeneration,
      options?.signal ?? null,
    );
  }
  if (sketchState !== null && sketchesBuilt > 0) {
    scheduleWorkspaceSearchTextSketchWrite(indexIdentity);
  }
  const result = {
    matches,
    truncated,
    visitedFiles,
    scannedBytes,
    dirtyPaths,
    indexCache: {
      enabled: index !== null,
      hits: cacheHits,
      misses: cacheMisses,
      skippedStats,
      prefetchedStats,
      saved: indexSaved,
      sketchesSkipped,
      sketchesBuilt,
      externalCandidateScan: externalCandidateScan !== null,
      externalCandidateFiles: externalCandidateScan?.visitedFiles ?? 0,
      externalCandidateScanned: externalCandidateScan?.scannedCandidates ?? 0,
      externalCandidateComplete: externalCandidateScan?.complete === true,
    },
    ...(indexFastPath ? { indexFastPath: true } : {}),
  };
  const queryCacheResultIsStable =
    indexIdentity !== null
    && options?.signal?.aborted !== true
    && matches.length > 0
    && trustCachedContentBeforeVerification !== true
    && contentVerificationIncomplete !== true
    && pathSetChangedDuringSearch !== true
    && SEARCH_INDEX_REBUILD_PROGRESS.get(indexIdentity.key)?.building !== true
    && indexGeneration === (SEARCH_INDEX_GENERATIONS.get(indexIdentity.key) ?? 0)
    && contentVerificationRevision
      === (SEARCH_INDEX_INVALIDATION_REVISIONS.get(indexIdentity.key) ?? 0)
    && scanInvalidationRevision
      === (SEARCH_INDEX_SCAN_INVALIDATION_REVISIONS.get(indexIdentity.key) ?? 0);
  if (queryCacheKey !== null && queryCacheResultIsStable) {
    SEARCH_TEXT_QUERY_CACHE.delete(queryCacheKey);
    SEARCH_TEXT_QUERY_CACHE.set(queryCacheKey, result);
    while (SEARCH_TEXT_QUERY_CACHE.size > SEARCH_TEXT_QUERY_CACHE_LIMIT) {
      const oldest = SEARCH_TEXT_QUERY_CACHE.keys().next().value;
      if (oldest === undefined) break;
      SEARCH_TEXT_QUERY_CACHE.delete(oldest);
    }
  }
  const persistentQuerySnapshot =
    persistentQueryCacheKey !== null
    && queryCacheResultIsStable
    && indexFastPath
    && index?.contentScanVerified === true
      ? await armWorkspaceSearchQuerySnapshot(indexIdentity, index)
      : null;
  if (persistentQuerySnapshot !== null) {
    await persistWorkspaceSearchTextQueryCache(
      indexIdentity,
      index,
      storedPathQueryView,
      persistentQueryCacheKey,
      result,
      persistentQuerySnapshot,
    );
  }
  return result;
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

/** Maximum files one Replace All request may modify. */
const REPLACE_TEXT_MAX_TARGETS = 500;

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
  if (targets.length > REPLACE_TEXT_MAX_TARGETS) {
    throw new Error(`Replace All supports at most ${REPLACE_TEXT_MAX_TARGETS} files`);
  }
  const caseSensitive = smartCaseSensitive(needle, options);
  const wholeWords = options?.wholeWords === true;
  const useRegex = options?.regex === true;
  const preserveCase = options?.preserveCase === true;
  const regex = useRegex ? compileWorkspaceRegex(needle, caseSensitive) : null;
  const fileMask = compileWorkspaceFileMask(options?.fileMask);
  const contextFilter = normalizeTextSearchContextFilter(options?.contextFilter);
  const searchDirectoryRules = normalizeSearchDirectoryRules(options?.searchDirectoryRules);
  const gitIgnoredPrefixes = await listGitIgnoredSearchPrefixes(root, options);
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
  for (const target of targets) {
    const relativePath = typeof target?.path === 'string' ? target.path : '';
    if (relativePath === '') throw new Error('invalid search target');
    resolveInside(root, relativePath);
    if (
      !searchPathAllowedByDirectoryRules(relativePath, searchDirectoryRules)
      || searchPathIsGitIgnored(relativePath, gitIgnoredPrefixes)
      || searchPathIsSystemGenerated(relativePath)
    ) {
      throw new Error(`target is outside search scope: ${relativePath}`);
    }
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
      /* dev:ino 会跟随 symlink，可在不向浏览器暴露真实绝对路径的前提下识别大小写别名。 */
      identity: info === null ? null : `${info.dev}:${info.ino}`,
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
  if (kind === 'directory') invalidateWorkspaceSearchIndexDirectory(root, relativePath);
  else invalidateWorkspaceSearchIndexPath(root, relativePath);
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
  const insideWorkTree = await runGit(root, ['rev-parse', '--is-inside-work-tree']).catch(() => '');
  if (insideWorkTree.trim() !== 'true') {
    return {
      root,
      isRepo: false,
      branch: '',
      prefix: '',
      changes: [],
      upstream: '',
      ahead: 0,
      behind: 0,
      detached: false,
      operation: null,
      lastCommit: null,
    };
  }
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
  changes.sort((left, right) => SEARCH_ENTRY_DEFAULT_COLLATOR.compare(left.path, right.path));
  const counted = await attachLineCounts(root, changes, prefix);
  return {
    root,
    isRepo: true,
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
 * @returns {Array<{line: number, hash: string, author: string, date: string, summary: string, content: string}>} per-line blame.
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
    const contentLine = lines[index] ?? '';
    const content = contentLine.startsWith('\t') ? contentLine.slice(1) : '';
    index += 1;
    const known = seen.get(hash);
    const meta = known ?? {
      author: author ?? '',
      date: date === undefined ? '' : new Date(Number(date) * 1000).toISOString(),
      summary: summary ?? '',
    };
    if (known === undefined) seen.set(hash, meta);
    rows.push({ line, hash, author: meta.author, date: meta.date, summary: meta.summary, content });
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
    /** Workspace-relative changed paths when the platform reports them. */
    this.pendingPaths = new Set();
    /** A basename-only event may identify a new directory that contains .gitignore. */
    this.pendingSearchScopeMayHaveChanged = false;
    this.timer = null;
    this.closed = false;
    this.releaseSearchIndexWatcher = registerWorkspaceSearchIndexWatcher(root);
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
      this.releaseSearchIndexWatcherRegistration();
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
        /* Submodules and nested repositories have their own `.git` directories.
           Their locks are not tree content and must not invalidate the search
           index, even though the root-level `.git` check cannot see them. */
        if (normalized.split('/').includes('.git')) {
          if (basename(normalized).endsWith('.lock')) return;
          const directory = dirname(normalized);
          this.record(directory === '.' || directory === '.git' ? null : directory, normalized, false, false);
          return;
        }
        /* macOS FSEvents may report only a basename for nested events. Without
           a relative directory we cannot safely guess which expanded listing
           changed, so null tells the browser to refresh all expanded dirs.
           The same ambiguity means the path may be a directory that just gained
           a nested .gitignore, so search scope must not reuse its ignore cache. */
        if (!normalized.includes('/')) {
          void lstat(resolve(this.root, normalized)).then(
            (info) => this.record(null, normalized, info.isDirectory()),
            /* A vanished path cannot be identified from the event alone; removing
               a directory may also remove its .gitignore, so fail open. */
            () => this.record(null, normalized, true),
          );
          return;
        }
        const directory = dirname(normalized);
        this.record(directory === '.' ? null : directory, normalized);
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
      this.releaseSearchIndexWatcherRegistration();
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
      watcher = this.watchImpl(absolute, { persistent: false }, () =>
        this.record('', '.git/index', false, false),
      );
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
        const normalized = name.replaceAll('\\', '/').replace(/^\.\/+/, '').replace(/^\/+/, '');
        this.record(relativePath, relativePath === '' ? normalized : `${relativePath}/${normalized}`);
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
  async syncDirectory(dir, visited = new Set()) {
    if (this.closed) return;
    const absolute = this.absolute(dir);
    const identity = await directoryTraversalIdentity(absolute);
    const rows = await readdir(absolute, { withFileTypes: true }).catch(() => null);
    if (rows === null || identity === null) {
      const stale = this.watchers.get(absolute);
      stale?.close();
      this.watchers.delete(absolute);
      return;
    }
    if (visited.has(identity)) return;
    visited.add(identity);
    const live = new Set();
    for (const row of rows) {
      if (WATCH_IGNORED.has(row.name)) continue;
      const childAbsolute = join(absolute, row.name);
      const info = row.isSymbolicLink() ? await stat(childAbsolute).catch(() => null) : row;
      if (info !== null && info.isDirectory()) live.add(row.name);
    }
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
      await this.syncDirectory(child, visited);
    }
  }

  /**
   * Record one filesystem event and schedule the coalesced emit.
   * @param {string|null} directory - changed directory, or null when the
   * platform did not expose a usable relative path.
   * @param {boolean} [searchIndexRelevant] - false for Git metadata that search never indexes.
   * @returns {void}
   */
  record(directory, changedPath = null, searchScopeMayHaveChanged = false, searchIndexRelevant = true) {
    if (this.closed) return;
    if (searchIndexRelevant) {
      invalidateWorkspaceSearchIndexScan(
        this.root,
        typeof changedPath === 'string' && changedPath !== ''
          ? changedPath
          : directory,
      );
    }
    this.pending.add(directory);
    const aliases = directory === null ? [] : workspaceDirectoryAliases(this.root, this.absolute(directory));
    for (const alias of aliases) {
      const relativeAlias = relative(this.root, alias).replaceAll('\\', '/');
      if (relativeAlias !== '' && !relativeAlias.startsWith('..') && !isAbsolute(relativeAlias)) {
        this.pending.add(relativeAlias);
      }
    }
    if (typeof changedPath === 'string' && changedPath !== '') {
      this.pendingPaths.add(changedPath);
      if (directory !== null) {
        const changedAbsolute = resolve(this.root, changedPath);
        const changedDirectoryAbsolute = this.absolute(directory);
        const suffix = relative(changedDirectoryAbsolute, changedAbsolute);
        if (suffix !== '' && !suffix.startsWith('..') && !isAbsolute(suffix)) {
          for (const alias of aliases) {
            const relativeAlias = relative(this.root, alias).replaceAll('\\', '/');
            if (relativeAlias === '' || relativeAlias.startsWith('..') || isAbsolute(relativeAlias)) continue;
            this.pendingPaths.add(`${relativeAlias}/${suffix.replaceAll('\\', '/')}`);
          }
        }
      }
    }
    if (searchScopeMayHaveChanged === true) this.pendingSearchScopeMayHaveChanged = true;
    if (this.timer !== null) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      if (this.closed) return;
      const dirs = this.pending.has(null) ? null : [...this.pending];
      const paths = [...this.pendingPaths];
      const searchScopeMayHaveChanged = this.pendingSearchScopeMayHaveChanged;
      this.pending.clear();
      this.pendingPaths.clear();
      this.pendingSearchScopeMayHaveChanged = false;
      /* Emit first: the browser can start re-reading while the walk runs, and a
         slowly-added watcher must not delay a frame the tree is waiting for. */
      if (this.recursiveWatcher === null) void this.syncWatches(dirs ?? []);
      this.emit({ type: 'change', dirs, paths, searchScopeMayHaveChanged });
    }, 120);
    /* Do not keep the host process alive only for this timer. */
    this.timer.unref?.();
  }

  /** Stop every watcher and drop pending work. */
  close() {
    this.closed = true;
    this.releaseSearchIndexWatcherRegistration();
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
    this.pendingPaths.clear();
  }

  /** Remove the fast-path freshness claim exactly once. */
  releaseSearchIndexWatcherRegistration() {
    this.releaseSearchIndexWatcher?.();
    this.releaseSearchIndexWatcher = null;
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
  let detached = false;
  const body = new ReadableStream({
    start(controller) {
      const send = (event) => {
        if (detached) return;
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
          detached = true;
          try {
            controller.close();
          } catch {
            /* already closed */
          }
          const timer = setTimeout(() => {
            watcher?.close();
          }, WORKSPACE_WATCHER_IDLE_CLOSE_MS);
          timer.unref?.();
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
            const searchSessionId = typeof body?.searchSessionId === 'string' ? body.searchSessionId : '';
            const searchRevision = Number.isInteger(body?.searchRevision) && body.searchRevision >= 0
              ? body.searchRevision
              : undefined;
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
                case 'readPreview':
                  return ok(
                    await readTextFilePreview(root, relativePath, body?.line, body?.radius, {
                      signal: request.signal,
                    }),
                  );
                case 'image':
                  return ok(await imageFileInfo(root, relativePath));
                case 'files': {
                  const fileLimit = body?.includeExcluded === true ? 5000 : 2000;
                  const fileOptions = {
                    includeExcluded: body?.includeExcluded === true,
                    respectGitIgnore: body?.respectGitIgnore === true,
                    searchDirectoryRules: body?.searchDirectoryRules,
                    fileMask: typeof body?.fileMask === 'string' ? body.fileMask : '',
                    searchIndex: body?.searchIndex === true,
                    searchSessionId,
                    searchRevision,
                    signal: request.signal,
                  };
                  return ok(await workspaceFilesForRequest(root, fileLimit, fileOptions));
                }
                case 'typeLibraries':
                  return ok(await workspaceTypeLibraries(root));
                case 'search':
                  return ok(await searchWorkspaceEntries(root, body?.query, {
                    showHidden: body?.showHidden === true,
                    showExcluded: body?.showExcluded === true,
                    sort: typeof body?.sort === 'string' ? body.sort : 'name',
                    foldersFirst: body?.foldersFirst !== false,
                    respectGitIgnore: body?.respectGitIgnore === true,
                    searchDirectoryRules: body?.searchDirectoryRules,
                    fileMask: typeof body?.fileMask === 'string' ? body.fileMask : '',
                    searchSessionId,
                    searchRevision,
                    searchIndex: true,
                    matchPath: body?.matchPath === true,
                    filesOnly: body?.filesOnly === true,
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
                    searchDirectoryRules: body?.searchDirectoryRules,
                    searchSessionId,
                    searchRevision,
                    searchIndex: true,
                    fastPartialTextSearch: body?.fastPartialTextSearch === true,
                    signal: request.signal,
                  }));
                case 'searchIndexStatus':
                  return ok(await workspaceSearchIndexStatus(root));
                case 'updateSearchIndex':
                  return ok(await updateWorkspaceSearchIndex(root, {
                    searchDirectoryRules: body?.searchDirectoryRules,
                    signal: request.signal,
                  }));
                case 'rebuildSearchIndex':
                  return ok(await rebuildWorkspaceSearchIndex(root, {
                    searchDirectoryRules: body?.searchDirectoryRules,
                    signal: request.signal,
                  }));
                case 'clearSearchIndex':
                  return ok(await clearWorkspaceSearchIndex(root, { signal: request.signal }));
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
                    searchDirectoryRules: body?.searchDirectoryRules,
                    searchSessionId,
                    searchRevision,
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
