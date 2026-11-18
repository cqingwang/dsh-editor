export interface ImportBinding {
  kind: 'named' | 'namespace' | 'default' | 'module';
  importedName: string;
}

export interface DefinitionImportTarget extends ImportBinding {
  specifier: string;
  relative?: boolean;
  language: 'javascript' | 'python';
}

export interface NavigationLocation {
  path: string;
  line: number;
  column: number;
}

export interface NavigationHistory {
  back: NavigationLocation[];
  forward: NavigationLocation[];
}

export interface DefinitionLocation extends NavigationLocation {
  endColumn: number;
}

export interface DefinitionSearchMatch {
  path?: string;
  [key: string]: unknown;
}

export interface DefinitionSearchInput {
  path: unknown;
  content: unknown;
  symbol: unknown;
  readFile: (path: string) => Promise<string | null | undefined>;
  searchText?: (query: string) => Promise<DefinitionSearchMatch[]>;
}

/** Escape one literal for use inside the host text-search regex. */
export function escapeDefinitionRegex(value: unknown): string {
  return String(value ?? '').replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

/** Normalize a workspace-relative path without consulting the filesystem. */
export function normalizeNavigationPath(value: unknown): string {
  const parts: string[] = [];
  for (const part of String(value ?? '')
    .replaceAll('\\', '/')
    .split('/')) {
    if (part === '' || part === '.') continue;
    if (part === '..') {
      if (parts.length > 0) parts.pop();
      continue;
    }
    parts.push(part);
  }
  return parts.join('/');
}

/** Return the directory portion of a normalized workspace path. */
export function navigationDirname(path: unknown): string {
  const normalized = normalizeNavigationPath(path);
  const slash = normalized.lastIndexOf('/');
  return slash < 0 ? '' : normalized.slice(0, slash);
}

/** Return the final path component. */
export function navigationBasename(path: unknown): string {
  const normalized = normalizeNavigationPath(path);
  const slash = normalized.lastIndexOf('/');
  return slash < 0 ? normalized : normalized.slice(slash + 1);
}

/** Return a lower-case extension without its leading dot. */
export function navigationExtension(path: unknown): string {
  const name = navigationBasename(path).toLowerCase();
  const dot = name.lastIndexOf('.');
  return dot < 0 ? '' : name.slice(dot + 1);
}

/** Convert a Monaco model URI back to a decoded workspace-relative path. */
export function navigationPathForModel(model: { uri?: { path?: unknown } } | null | undefined): string {
  const raw = typeof model?.uri?.path === 'string' ? model.uri.path : '';
  let decoded = raw;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    decoded = raw;
  }
  return normalizeNavigationPath(decoded);
}

/** 把一处编辑位置收敛为历史栈可保存的纯数据。 */
export function normalizeNavigationLocation(location: unknown): NavigationLocation | null {
  const candidate =
    location !== null && typeof location === 'object'
      ? (location as { path?: unknown; line?: unknown; column?: unknown })
      : {};
  const path = normalizeNavigationPath(candidate.path);
  if (path === '') return null;
  const line = Math.max(1, Math.floor(Number(candidate.line) || 1));
  const column = Math.max(1, Math.floor(Number(candidate.column) || 1));
  return { path, line, column };
}

/** 判断两处已归一化位置是否指向同一个光标点。 */
export function sameNavigationLocation(
  left: NavigationLocation | null | undefined,
  right: NavigationLocation | null | undefined,
): boolean {
  return left?.path === right?.path && left?.line === right?.line && left?.column === right?.column;
}

/** 归一化历史栈中的全部位置，过滤损坏或空路径。 */
export function normalizeNavigationStack(value: unknown): NavigationLocation[] {
  return (Array.isArray(value) ? value : []).map(normalizeNavigationLocation).filter((location) => location !== null);
}

/**
 * 记录新导航正在离开的位置。
 *
 * 新导航必须清空 forward，与浏览器和 IDEA 的 Back / Forward 语义一致；
 * 历史栈设置上限，避免长会话无限保留编辑位置。
 * @param {{back?: object[], forward?: object[]}} history - 当前历史。
 * @param {object} location - 导航来源位置。
 * @returns {{back: object[], forward: object[]}} 下一份历史。
 */
export function navigationHistoryRecord(
  history: Partial<NavigationHistory> | null | undefined,
  location: unknown,
): NavigationHistory {
  const next = normalizeNavigationLocation(location);
  if (next === null) {
    return {
      back: normalizeNavigationStack(history?.back),
      forward: normalizeNavigationStack(history?.forward),
    };
  }
  const back = normalizeNavigationStack(history?.back);
  if (sameNavigationLocation(back.at(-1), next)) return { back, forward: [] };
  return { back: [...back, next].slice(-200), forward: [] };
}

/**
 * 在编辑器导航历史中后退或前进一步。
 * @param {{back?: object[], forward?: object[]}} history - 当前历史。
 * @param {object} current - 执行前的光标位置。
 * @param {'back'|'forward'} direction - 请求的方向。
 * @returns {{history: {back: object[], forward: object[]}, target: object|null}} 下一状态。
 */
export function navigationHistoryStep(
  history: Partial<NavigationHistory> | null | undefined,
  current: unknown,
  direction: 'back' | 'forward',
): { history: NavigationHistory; target: NavigationLocation | null } {
  const location = normalizeNavigationLocation(current);
  const back = normalizeNavigationStack(history?.back);
  const forward = normalizeNavigationStack(history?.forward);
  if (location === null) return { history: { back, forward }, target: null };
  if (direction === 'back') {
    const target = back.at(-1) ?? null;
    if (target === null) return { history: { back, forward }, target: null };
    return {
      history: { back: back.slice(0, -1), forward: [...forward, location].slice(-200) },
      target,
    };
  }
  if (direction === 'forward') {
    const target = forward.at(-1) ?? null;
    if (target === null) return { history: { back, forward }, target: null };
    return {
      history: { back: [...back, location].slice(-200), forward: forward.slice(0, -1) },
      target,
    };
  }
  return { history: { back, forward }, target: null };
}

/** Parse one named import clause and map its local identifier. */
export function namedImportBinding(clause: unknown, symbol: unknown): ImportBinding | null {
  for (const rawEntry of String(clause ?? '').split(',')) {
    const entry = rawEntry.trim().replace(/^type\s+/u, '');
    const match = /^([A-Za-z_$][\w$]*)(?:\s+as\s+([A-Za-z_$][\w$]*))?$/u.exec(entry);
    if (match === null) continue;
    const importedName = match[1];
    const localName = match[2] ?? importedName;
    if (localName === symbol) return { kind: 'named', importedName };
  }
  return null;
}

/** Resolve one JavaScript/TypeScript import clause against a clicked symbol. */
export function javascriptImportBinding(clause: unknown, symbol: unknown): ImportBinding | null {
  const text = String(clause ?? '')
    .trim()
    .replace(/^type\s+/u, '');
  const namedStart = text.indexOf('{');
  const namedEnd = text.lastIndexOf('}');
  if (namedStart >= 0 && namedEnd > namedStart) {
    const named = namedImportBinding(text.slice(namedStart + 1, namedEnd), symbol);
    if (named !== null) return named;
  }
  const namespace = /\*\s+as\s+([A-Za-z_$][\w$]*)/u.exec(text);
  if (namespace !== null && namespace[1] === symbol) return { kind: 'namespace', importedName: '*' };
  const defaultPart = text.split(',', 1)[0].trim();
  if (/^[A-Za-z_$][\w$]*$/u.test(defaultPart) && defaultPart === symbol) {
    return { kind: 'default', importedName: 'default' };
  }
  return null;
}

/** Convert Python module punctuation to a workspace path candidate. */
export function pythonImportSpecifier(moduleName: unknown): { specifier: string; relative: boolean } {
  const raw = String(moduleName ?? '').trim();
  const dots = /^\.+/u.exec(raw)?.[0].length ?? 0;
  const rest = raw.slice(dots).replaceAll('.', '/');
  if (dots === 0) return { specifier: rest, relative: false };
  return {
    specifier: `./${'../'.repeat(Math.max(0, dots - 1))}${rest === '' ? '.' : rest}`,
    relative: true,
  };
}

/**
 * Locate the module and imported name referenced by one identifier.
 *
 * The parser is intentionally bounded to import/export/require statements.
 * It supplies the navigation shortcut without pretending to be a complete
 * language service; unresolved package imports fall through to the generic
 * workspace declaration search.
 */
export function definitionImportTarget(content: unknown, symbol: unknown): DefinitionImportTarget | null {
  const name = String(symbol ?? '').trim();
  const source = String(content ?? '');
  if (name === '' || source === '') return null;

  const javascriptImport = /(?:^|\n)[ \t]*import\s+([\s\S]*?)\s+from\s+(['"])([^'"\n]+)\2[ \t]*;?/gu;
  for (const match of source.matchAll(javascriptImport)) {
    const binding = javascriptImportBinding(match[1], name);
    if (binding !== null) return { ...binding, specifier: match[3], language: 'javascript' };
  }

  const javascriptExport = /(?:^|\n)[ \t]*export\s*\{([\s\S]*?)\}\s*from\s+(['"])([^'"\n]+)\2[ \t]*;?/gu;
  for (const match of source.matchAll(javascriptExport)) {
    const binding = namedImportBinding(match[1], name);
    if (binding !== null) return { ...binding, specifier: match[3], language: 'javascript' };
  }

  const commonJs = /(?:const|let|var)\s*\{([\s\S]*?)\}\s*=\s*require\(\s*(['"])([^'"]+)\2\s*\)/gu;
  for (const match of source.matchAll(commonJs)) {
    const binding = namedImportBinding(match[1], name);
    if (binding !== null) return { ...binding, specifier: match[3], language: 'javascript' };
  }

  const pythonFrom = /(?:^|\n)[ \t]*from\s+([.\w]+)\s+import\s+([^\n#]+)/gu;
  for (const match of source.matchAll(pythonFrom)) {
    const binding = namedImportBinding(match[2], name);
    if (binding === null) continue;
    const target = pythonImportSpecifier(match[1]);
    return { ...binding, specifier: target.specifier, relative: target.relative, language: 'python' };
  }

  const pythonModule = /(?:^|\n)[ \t]*import\s+([.\w]+)(?:\s+as\s+([A-Za-z_]\w*))?/gu;
  for (const match of source.matchAll(pythonModule)) {
    const importedPath = match[1];
    const localName = match[2] ?? importedPath.split('.').at(-1);
    if (localName !== name) continue;
    const target = pythonImportSpecifier(importedPath);
    return {
      kind: 'module',
      importedName: '*',
      specifier: target.specifier,
      relative: target.relative,
      language: 'python',
    };
  }
  return null;
}

/** Extensions worth trying for an extensionless relative import. */
export function definitionCandidateExtensions(sourcePath: unknown): string[] {
  const extension = navigationExtension(sourcePath);
  if (['ts', 'tsx', 'mts', 'cts', 'js', 'jsx', 'mjs', 'cjs'].includes(extension)) {
    return ['ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs', 'json'];
  }
  if (extension === 'py') return ['py'];
  if (extension === 'go') return ['go'];
  if (extension === 'rs') return ['rs'];
  if (extension === 'java') return ['java'];
  if (extension === 'kt' || extension === 'kts') return ['kt', 'kts'];
  if (extension === 'rb') return ['rb'];
  if (extension === 'php') return ['php'];
  if (extension === 'cs') return ['cs'];
  if (['c', 'h', 'cc', 'cpp', 'cxx', 'hpp'].includes(extension)) return ['h', 'hpp', 'c', 'cc', 'cpp', 'cxx'];
  if (['sh', 'bash', 'zsh'].includes(extension)) return ['sh', 'bash', 'zsh'];
  return ['js', 'ts', 'py', 'go', 'rs', 'java', 'kt', 'rb', 'php', 'cs', 'h', 'hpp', 'c', 'cpp'];
}

/** Expand one import specifier into workspace-relative file candidates. */
export function definitionModuleCandidates(sourcePath: unknown, specifier: unknown, language = ''): string[] {
  const raw = String(specifier ?? '')
    .trim()
    .split(/[?#]/u, 1)[0];
  if (raw === '') return [];
  const extensions = definitionCandidateExtensions(sourcePath);
  let base = '';
  if (raw.startsWith('.')) {
    base = normalizeNavigationPath(`${navigationDirname(sourcePath)}/${raw}`);
  } else if (language === 'python' && raw !== '') {
    base = normalizeNavigationPath(raw.replaceAll('.', '/'));
  } else if (raw.startsWith('/')) {
    base = normalizeNavigationPath(raw);
  } else {
    return [];
  }
  const hasExtension = /\.[^/]+$/u.test(navigationBasename(base));
  if (hasExtension) return [base];
  return [
    ...extensions.map((extension) => `${base}.${extension}`),
    ...extensions.map((extension) => `${base}/index.${extension}`),
    ...(language === 'python' ? [`${base}/__init__.py`] : []),
  ];
}

/** One-based editor position for a zero-based string offset. */
export function definitionPositionAtOffset(content: unknown, offset: unknown): { line: number; column: number } {
  const safeOffset = Math.max(0, Math.min(String(content ?? '').length, Number(offset) || 0));
  const before = String(content ?? '').slice(0, safeOffset);
  const line = before.split('\n').length;
  const lastBreak = before.lastIndexOf('\n');
  return { line, column: safeOffset - lastBreak };
}

/** Declaration regexes for the languages the editor can reasonably infer. */
export function definitionRegexes(path: unknown, symbol: unknown): RegExp[] {
  const escaped = escapeDefinitionRegex(symbol);
  const extension = navigationExtension(path);
  const patterns: RegExp[] = [];
  const add = (source: string) => patterns.push(new RegExp(source, 'gu'));

  if (['ts', 'tsx', 'mts', 'cts', 'js', 'jsx', 'mjs', 'cjs'].includes(extension)) {
    add(
      `\\b(?:export\\s+)?(?:default\\s+)?(?:async\\s+)?(?:function|class|interface|type|enum|const|let|var)\\s+(${escaped})\\b`,
    );
    add(`\\b(${escaped})\\s*=\\s*(?:async\\s*)?(?:function\\b|\\([^)]*\\)\\s*=>)`);
    add(`\\b(?:async\\s+)?(?:get\\s+|set\\s+)?(${escaped})\\s*(?:<[^>{}]*>)?\\s*\\([^)]*\\)\\s*(?::\\s*[^={\\n]+)?\\{`);
  } else if (extension === 'py') {
    add(`\\b(?:async\\s+)?(?:def|class)\\s+(${escaped})\\b`);
  } else if (extension === 'go') {
    add(`\\b(?:func|type|var|const)\\s+(?:\\([^)]*\\)\\s*)?(${escaped})\\b`);
  } else if (extension === 'rs') {
    add(
      `\\b(?:pub(?:\\([^)]*\\))?\\s+)?(?:async\\s+)?(?:fn|struct|enum|trait|type|const|static|mod)\\s+(${escaped})\\b`,
    );
  } else if (['java', 'kt', 'kts', 'scala', 'cs', 'dart'].includes(extension)) {
    add(`\\b(?:class|interface|enum|record|object|trait|typealias|struct|delegate|mixin|extension)\\s+(${escaped})\\b`);
    add(
      `\\b(?:public|private|protected|internal|static|final|abstract|synchronized|native|default|strictfp|async|virtual|override|sealed|partial|extern|unsafe|open|suspend|inline|operator|infix|tailrec|const|fun|def)\\b[^\\n{;=]*?\\b(${escaped})\\s*\\(`,
    );
    add(`\\b[\\w$<>\\[\\],.?*&:]+\\s+(${escaped})\\s*\\([^;{}]*\\)\\s*(?:throws\\s+[^\\n{]+)?(?:\\{|;)`);
  } else if (extension === 'swift') {
    add(`\\b(?:func|class|struct|enum|protocol|extension|typealias|actor)\\s+(${escaped})\\b`);
    add(`\\bfunc\\s+(${escaped})\\s*(?:<[^>{}]*>)?\\s*\\(`);
  } else if (['c', 'h', 'cc', 'cpp', 'cxx', 'hpp'].includes(extension)) {
    add(`\\b(?:struct|class|enum|union|typedef)\\s+(${escaped})\\b`);
    add(
      `\\b(?:(?:static|inline|extern|const|volatile|unsigned|signed|long|short|virtual|explicit)\\s+)*[\\w:<>~*&]+(?:\\s+[*&]+)?\\s+(${escaped})\\s*\\([^;{}]*\\)\\s*(?:const\\s*)?(?:noexcept\\s*)?\\{`,
    );
  } else if (extension === 'php') {
    add(`\\b(?:function|class|interface|trait|enum)\\s+(${escaped})\\b`);
  } else if (extension === 'rb') {
    add(`\\b(?:def|class|module)\\s+(${escaped})\\b`);
  } else if (['sh', 'bash', 'zsh'].includes(extension)) {
    add(`\\b(?:function\\s+)?(${escaped})\\s*\\(\\s*\\)`);
  }

  add(
    `\\b(?:function|class|interface|type|enum|struct|trait|def|fn|fun|func|const|let|var|module|record|protocol|actor|mixin|delegate|typedef)\\s+(?:\\([^)]*\\)\\s*)?(${escaped})\\b`,
  );
  return patterns;
}

/** Find the first declaration-like identifier occurrence in one document. */
export function findDefinitionInText(content: unknown, symbol: unknown, path: string): DefinitionLocation | null {
  const source = String(content ?? '');
  const name = String(symbol ?? '');
  if (source === '' || name === '') return null;
  for (const regex of definitionRegexes(path, name)) {
    regex.lastIndex = 0;
    for (const match of source.matchAll(regex)) {
      const text = match[0];
      const localOffset = text.lastIndexOf(name);
      if (localOffset < 0) continue;
      const offset = match.index + localOffset;
      const lineStart = source.lastIndexOf('\n', offset) + 1;
      const prefix = source.slice(lineStart, offset).trimStart();
      if (/^(?:\/\/|#|\*|--)/u.test(prefix)) continue;
      const position = definitionPositionAtOffset(source, offset);
      return {
        path,
        line: position.line,
        column: position.column,
        endColumn: position.column + name.length,
      };
    }
  }
  return null;
}

/** Build a bounded workspace text-search regex for a declaration fallback. */
export function definitionSearchQuery(symbol: unknown, path: unknown): string {
  const escaped = escapeDefinitionRegex(symbol);
  const extension = navigationExtension(path);
  const keywords = [
    'function',
    'class',
    'interface',
    'type',
    'enum',
    'struct',
    'trait',
    'record',
    'protocol',
    'actor',
    'mixin',
    'delegate',
    'typedef',
    'public',
    'private',
    'protected',
    'internal',
    'static',
    'final',
    'abstract',
    'async',
    'virtual',
    'override',
    'sealed',
    'partial',
    'extern',
    'unsafe',
    'open',
    'suspend',
    'inline',
    'operator',
  ];
  if (extension === 'py') keywords.push('def');
  if (extension === 'go') keywords.push('func');
  if (extension === 'rs') keywords.push('fn');
  if (['kt', 'kts', 'scala'].includes(extension)) keywords.push('fun');
  if (extension === 'swift') keywords.push('func');
  keywords.push('const', 'let', 'var', 'module');
  return `(?:\\b(?:${keywords.join('|')})\\b[^\\n]{0,120}\\b${escaped}\\b|\\b${escaped}\\s*(?:<[^\\n(){}]*>)?\\s*\\()`;
}

/** Prefer declarations in nearby files while preserving deterministic order. */
export function rankDefinitionSearchMatches<T extends DefinitionSearchMatch>(
  matches: unknown,
  sourcePath: unknown,
): T[] {
  const sourceDirectory = navigationDirname(sourcePath);
  const sourceExtension = navigationExtension(sourcePath);
  return [...(Array.isArray(matches) ? matches : [])]
    .map((match: T, index: number) => {
      const path = typeof match?.path === 'string' ? match.path : '';
      const sameDirectory = navigationDirname(path) === sourceDirectory;
      const sameExtension = navigationExtension(path) === sourceExtension;
      return {
        match,
        index,
        score: (sameDirectory ? 4 : 0) + (sameExtension ? 2 : 0),
      };
    })
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .map((entry) => entry.match);
}

/**
 * Resolve one clicked identifier to a workspace declaration.
 *
 * Import targets are read directly first. Other languages fall back to the
 * host's bounded text search, then re-read the candidate file so Monaco gets
 * the exact declaration line instead of the search-match preview column.
 */
export async function resolveWorkspaceDefinition({
  path,
  content,
  symbol,
  readFile,
  searchText,
}: DefinitionSearchInput): Promise<DefinitionLocation | null> {
  const name = String(symbol ?? '').trim();
  const sourcePath = normalizeNavigationPath(path);
  if (name === '' || sourcePath === '' || typeof readFile !== 'function') return null;

  const local = findDefinitionInText(content, name, sourcePath);
  if (local !== null) return local;

  const imported = definitionImportTarget(content, name);
  if (imported !== null) {
    for (const candidate of definitionModuleCandidates(sourcePath, imported.specifier, imported.language)) {
      const targetContent = await readFile(candidate).catch(() => null);
      if (typeof targetContent !== 'string') continue;
      const importedName = imported.importedName === '*' ? '' : imported.importedName;
      const found =
        importedName === 'default' ? null : findDefinitionInText(targetContent, importedName || name, candidate);
      if (found !== null) return found;
      if (imported.kind === 'module' || imported.kind === 'namespace' || imported.kind === 'default') {
        return { path: candidate, line: 1, column: 1, endColumn: 1 };
      }
    }
  }

  if (typeof searchText !== 'function') return null;
  const matches = await searchText(definitionSearchQuery(name, sourcePath)).catch(() => []);
  for (const match of rankDefinitionSearchMatches(matches, sourcePath)) {
    const candidate = normalizeNavigationPath(match?.path);
    if (candidate === '' || candidate === sourcePath) continue;
    const targetContent = await readFile(candidate).catch(() => null);
    if (typeof targetContent !== 'string') continue;
    const found = findDefinitionInText(targetContent, name, candidate);
    if (found !== null) return found;
  }
  return null;
}
