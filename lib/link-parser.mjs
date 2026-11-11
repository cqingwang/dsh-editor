/**
 * Terminal hyperlink detection, shared by the browser half and the test suite.
 *
 * IDEA's terminal underlines two things: real URLs, and file paths that exist on
 * disk (optionally with `:line:column`). Existence is checked by the caller —
 * this module only answers "is this shape a link, and where does it start/end".
 */

/** Characters allowed inside a bare path segment. */
const PATH_SEGMENT = String.raw`[\w.@+\-]`;

/** `foo/bar/baz.ts`, `./x.py`, `/etc/hosts` — a path with at least one dot-extension or slash. */
const PATH_PATTERN = new RegExp(
  String.raw`(?:~\/|\.{1,2}\/|\/)?(?:${PATH_SEGMENT}+\/)*${PATH_SEGMENT}*\.[A-Za-z0-9]{1,8}(?::\d+(?::\d+)?)?` +
    String.raw`|(?:\.{1,2}\/|\/)(?:${PATH_SEGMENT}+\/)*${PATH_SEGMENT}+(?::\d+(?::\d+)?)?`,
  'gu',
);

/** URL pattern kept deliberately tight: terminals print them without punctuation noise. */
const URL_PATTERN = /https?:\/\/[^\s<>"'`]+/gu;

/** Trailing punctuation that belongs to the sentence, not to the link. */
const TRAILING_NOISE = /[.,;:!?)\]}>'"`]+$/u;

/**
 * Split one absolute path into directory, optional `:line` and optional `:column`.
 * @param {string} raw - matched text such as `src/app.ts:12:4`.
 * @returns {{path: string, line: number|null, column: number|null}} decomposed path.
 */
function splitLocationSuffix(raw) {
  const match = /^(.*?)(?::(\d+))?(?::(\d+))?$/u.exec(raw);
  if (match === null) return { path: raw, line: null, column: null };
  /* `foo.ts:12:4` yields path/line/column; a bare `foo.ts` keeps both null. */
  if (match[2] === undefined) return { path: match[1], line: null, column: null };
  return {
    path: match[1],
    line: Number(match[2]),
    column: match[3] === undefined ? null : Number(match[3]),
  };
}

/**
 * Whether a dotted token is really a version number (`1.2.3`) and not a file.
 * @param {string} value - candidate path without a location suffix.
 * @returns {boolean} true when every dotted segment is numeric.
 */
function looksLikeVersion(value) {
  const segments = value.split('/').pop()?.split('.') ?? [];
  return segments.length > 1 && segments.every((segment) => /^\d+$/u.test(segment));
}

/**
 * Find every link-shaped token in one terminal line.
 *
 * Offsets are 0-based and end-exclusive, so a caller can turn them directly into
 * an xterm buffer range (`start.x = start + 1`).
 * @param {string} lineText - one buffer line as plain text.
 * @returns {Array<{kind: 'url'|'path', text: string, start: number, end: number, path?: string, line?: number|null, column?: number|null}>} links, left to right.
 */
export function parseTerminalLinks(lineText) {
  if (typeof lineText !== 'string' || lineText === '') return [];
  const found = [];
  const occupied = [];
  const isFree = (start, end) => occupied.every((range) => end <= range.start || start >= range.end);

  for (const match of lineText.matchAll(URL_PATTERN)) {
    const raw = match[0].replace(TRAILING_NOISE, '');
    if (raw.length <= 'https://'.length) continue;
    const start = match.index ?? 0;
    const end = start + raw.length;
    occupied.push({ start, end });
    found.push({ kind: 'url', text: raw, start, end });
  }

  for (const match of lineText.matchAll(PATH_PATTERN)) {
    const start = match.index ?? 0;
    const raw = match[0];
    if (raw === '') continue;
    const end = start + raw.length;
    if (!isFree(start, end)) continue;
    /* A URL contains slashes and dots; never re-report a slice of one as a path. */
    if (lineText.slice(Math.max(0, start - 8), start).includes('://')) continue;
    const location = splitLocationSuffix(raw);
    if (location.path === '' || location.path === '/' || location.path === './' || location.path === '../') continue;
    if (looksLikeVersion(location.path)) continue;
    /* Bare file names (`README.md`) stay candidates; the caller checks existence. */
    occupied.push({ start, end });
    found.push({
      kind: 'path',
      text: raw,
      start,
      end,
      path: location.path,
      line: location.line,
      column: location.column,
    });
  }

  return found.sort((left, right) => left.start - right.start);
}

/**
 * Resolve one terminal path against the terminal's working directory.
 * @param {string} cwd - absolute directory the shell runs in.
 * @param {string} candidate - text captured from the terminal.
 * @returns {string} absolute path for the host file API.
 */
export function resolveTerminalPath(cwd, candidate) {
  const base = typeof cwd === 'string' && cwd !== '' ? cwd.replace(/\/+$/u, '') : '';
  if (candidate === '') return base;
  if (candidate.startsWith('/')) return candidate;
  if (candidate === '~' || candidate.startsWith('~/')) return candidate;
  if (base === '') return candidate;
  const parts = `${base}/${candidate}`.split('/');
  const stack = [];
  for (const part of parts) {
    if (part === '' || part === '.') continue;
    if (part === '..') stack.pop();
    else stack.push(part);
  }
  return `/${stack.join('/')}`;
}
