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

export interface DefinitionLanguageCandidate {
  path: string;
  symbol?: string;
}

export interface DefinitionSearchOptions {
  scopeIncludePatterns?: string[];
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
  searchText?: (query: string, options?: DefinitionSearchOptions) => Promise<DefinitionSearchMatch[]>;
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

function uniqueDefinitionCandidates(candidates: DefinitionLanguageCandidate[]): DefinitionLanguageCandidate[] {
  const seen = new Set<string>();
  const result: DefinitionLanguageCandidate[] = [];
  for (const candidate of candidates) {
    const path = normalizeNavigationPath(candidate.path);
    if (path === '') continue;
    const symbol = typeof candidate.symbol === 'string' && candidate.symbol !== '' ? candidate.symbol : '';
    const key = `${path}\u0000${symbol}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(symbol === '' ? { path } : { path, symbol });
  }
  return result;
}

function javaSourceRoot(sourcePath: string, packageName: string): string {
  const sourceDirectory = navigationDirname(sourcePath);
  const packageDirectory = packageName.replaceAll('.', '/');
  if (packageDirectory === '') return sourceDirectory;
  if (sourceDirectory === packageDirectory) return '';
  if (!sourceDirectory.endsWith(`/${packageDirectory}`)) return sourceDirectory;
  return sourceDirectory.slice(0, -(packageDirectory.length + 1));
}

function javaImportPaths(content: string): Array<{ importedPath: string; staticImport: boolean; wildcard: boolean }> {
  const imports: Array<{ importedPath: string; staticImport: boolean; wildcard: boolean }> = [];
  const expression = /(?:^|\n)[ \t]*import\s+(static\s+)?([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*(?:\.\*)?)\s*;/gu;
  for (const match of content.matchAll(expression)) {
    const importedPath = match[2].replace(/\.\*$/u, '');
    if (importedPath === '') continue;
    imports.push({
      importedPath,
      staticImport: match[1] !== undefined,
      wildcard: match[2].endsWith('.*'),
    });
  }
  return imports;
}

function goImportPaths(content: string): string[] {
  const paths: string[] = [];
  const addPath = (value: unknown): void => {
    const path = String(value ?? '').trim();
    if (path !== '') paths.push(path);
  };
  const grouped = /(?:^|\n)[ \t]*import\s*\(([\s\S]*?)\)/gu;
  for (const block of content.matchAll(grouped)) {
    const entries = /(?:^|\n)[ \t]*(?:[._A-Za-z][\w.]*\s+)?(["`])([^"`\n]+)\1/gu;
    for (const entry of block[1].matchAll(entries)) addPath(entry[2]);
  }
  const single = /(?:^|\n)[ \t]*import\s+(?:[._A-Za-z][\w.]*\s+)?(["`])([^"`\n]+)\1/gu;
  for (const entry of content.matchAll(single)) addPath(entry[2]);
  return [...new Set(paths)];
}

function cIncludePaths(content: string): Array<{ path: string; quoted: boolean }> {
  const paths: Array<{ path: string; quoted: boolean }> = [];
  const expression = /(?:^|\n)[ \t]*#\s*include\s*([<"])([^>"\n]+)[>"]/gu;
  for (const match of content.matchAll(expression)) {
    const path = match[2].trim().replaceAll('\\', '/');
    if (path !== '') paths.push({ path, quoted: match[1] === '"' });
  }
  return paths;
}

/**
 * Resolve language-specific import/include candidates before global search.
 *
 * JavaScript and Python imports carry their binding directly. Java imports
 * identify a class that may contain the requested type or method; quoted C/C++
 * includes identify a header that may declare the requested symbol. Go modules
 * and standard-library imports do not expose a file name, so they are handled
 * as bounded search scopes instead.
 * @param {unknown} content - source text containing imports/includes.
 * @param {unknown} path - workspace-relative source path.
 * @param {unknown} symbol - identifier requested by the editor.
 * @returns {DefinitionLanguageCandidate[]} candidate files in priority order.
 */
export function definitionLanguageCandidates(
  content: unknown,
  path: unknown,
  symbol: unknown,
): DefinitionLanguageCandidate[] {
  const source = String(content ?? '');
  const sourcePath = normalizeNavigationPath(path);
  const name = String(symbol ?? '').trim();
  if (source === '' || sourcePath === '' || name === '') return [];
  const extension = navigationExtension(sourcePath);
  const candidates: DefinitionLanguageCandidate[] = [];

  if (extension === 'java') {
    const packageMatch = /(?:^|\n)[ \t]*package\s+([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)\s*;/u.exec(source);
    const sourceRoot = javaSourceRoot(sourcePath, packageMatch?.[1] ?? '');
    const javaTypePath = (dottedName: string): string => {
      const relative = `${dottedName.replaceAll('.', '/')}.java`;
      return normalizeNavigationPath(sourceRoot === '' ? relative : `${sourceRoot}/${relative}`);
    };
    if (/^[A-Z_$]/u.test(name)) {
      const packageRelative = packageMatch === null ? '' : packageMatch[1].replaceAll('.', '/');
      const samePackage = normalizeNavigationPath(
        sourceRoot === '' ? `${packageRelative}/${name}.java` : `${sourceRoot}/${packageRelative}/${name}.java`,
      );
      candidates.push({ path: samePackage });
    }
    for (const imported of javaImportPaths(source)) {
      if (!imported.staticImport && imported.wildcard) continue;
      if (imported.staticImport) {
        const segments = imported.importedPath.split('.');
        let classPath = imported.importedPath;
        if (!imported.wildcard && segments.at(-1) === name) classPath = segments.slice(0, -1).join('.');
        if (classPath !== '') candidates.push({ path: javaTypePath(classPath), symbol: name });
        continue;
      }
      const importedSimpleName = imported.importedPath.split('.').at(-1) ?? '';
      candidates.push({
        path: javaTypePath(imported.importedPath),
        ...(importedSimpleName === name ? {} : { symbol: name }),
      });
    }
  } else if (['c', 'h', 'cc', 'cpp', 'cxx', 'hpp'].includes(extension)) {
    const sourceDirectory = navigationDirname(sourcePath);
    for (const include of cIncludePaths(source)) {
      if (include.quoted) {
        candidates.push({
          path: normalizeNavigationPath(`${sourceDirectory}/${include.path}`),
          symbol: name,
        });
      }
      candidates.push({ path: include.path, symbol: name });
    }
  }

  return uniqueDefinitionCandidates(candidates)
    .filter((candidate) => candidate.path !== sourcePath)
    .slice(0, 160);
}

function goImportScopePatterns(importPath: string): string[] {
  const segments = normalizeNavigationPath(importPath).split('/').filter(Boolean);
  const patterns: string[] = [];
  for (let index = 0; index <= segments.length - 2; index += 1) {
    const suffix = segments.slice(index).join('/');
    patterns.push(`${suffix}/**`, `**/${suffix}/**`);
  }
  return patterns;
}

/**
 * Build host search scopes from language imports/includes.
 *
 * Go import paths may contain a module prefix that is absent from workspace
 * paths, so each path suffix is accepted. Java wildcard imports and C/C++
 * headers become exact or recursive path scopes. The unscoped declaration
 * search remains a fallback when these patterns are absent or miss.
 * @param {unknown} content - source text containing imports/includes.
 * @param {unknown} path - workspace-relative source path.
 * @returns {string[]} bounded include globs for the host text search.
 */
export function definitionSearchScopePatterns(content: unknown, path: unknown): string[] {
  const source = String(content ?? '');
  const sourcePath = normalizeNavigationPath(path);
  if (source === '' || sourcePath === '') return [];
  const extension = navigationExtension(sourcePath);
  const patterns: string[] = [];
  if (extension === 'go') {
    for (const imported of goImportPaths(source)) patterns.push(...goImportScopePatterns(imported));
  } else if (extension === 'java') {
    const packageMatch = /(?:^|\n)[ \t]*package\s+([A-Za-z_$][\w$]*(?:\.[A-Za-z_$][\w$]*)*)\s*;/u.exec(source);
    const sourceRoot = javaSourceRoot(sourcePath, packageMatch?.[1] ?? '');
    for (const imported of javaImportPaths(source)) {
      const relative = `${imported.importedPath.replaceAll('.', '/')}${imported.wildcard ? '/**' : '.java'}`;
      const target = normalizeNavigationPath(sourceRoot === '' ? relative : `${sourceRoot}/${relative}`);
      if (target === '') continue;
      patterns.push(target);
      if (imported.wildcard) patterns.push(`**/${imported.importedPath.replaceAll('.', '/')}/**`);
      else patterns.push(`**/${imported.importedPath.replaceAll('.', '/')}.java`);
    }
  } else if (['c', 'h', 'cc', 'cpp', 'cxx', 'hpp'].includes(extension)) {
    for (const include of cIncludePaths(source)) {
      const target = normalizeNavigationPath(include.path);
      if (target === '') continue;
      patterns.push(target, `**/${target}`);
    }
  }
  return [...new Set(patterns.filter((pattern) => pattern !== ''))].slice(0, 48);
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
    add(
      `(?:^|\\n)[ \\t]*(?!(?:return|if|while|for|switch|case|delete|new|throw|else|goto|sizeof)\\b)(?:[\\w:<>~*&]+[ \\t]+)+(?:[\\w$]+::)*(${escaped})\\s*\\([^;{}]*\\)\\s*(?:const\\s*)?(?:noexcept\\s*)?(?:\\{|;)`,
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
  let keywords = ['function', 'class', 'interface', 'type', 'enum', 'struct', 'trait', 'def', 'fn', 'fun', 'func'];
  if (extension === 'py') keywords = ['def', 'class'];
  else if (extension === 'go') keywords = ['func', 'type', 'var', 'const'];
  else if (extension === 'rs') keywords = ['fn', 'struct', 'enum', 'trait', 'type', 'const', 'static', 'mod'];
  else if (['java', 'kt', 'kts', 'scala', 'cs', 'dart'].includes(extension)) {
    keywords = ['class', 'interface', 'enum', 'record', 'struct', 'fun', 'object', 'trait'];
  } else if (['c', 'h', 'cc', 'cpp', 'cxx', 'hpp'].includes(extension)) {
    keywords = ['class', 'struct', 'enum', 'union', 'typedef'];
  } else if (extension === 'swift') {
    keywords = ['func', 'class', 'struct', 'enum', 'protocol', 'actor', 'typealias'];
  }
  const query = `(?:\\b(?:${keywords.join('|')})\\b[^\\n]{0,120}\\b${escaped}\\b|\\b${escaped}\\s*(?:<[^\\n(){}]*>)?\\s*\\()`;
  /* The host rejects regex patterns over 256 characters. A long identifier
     still gets a bounded literal search, then the resolver re-reads and
     confirms the declaration. */
  return query.length <= 240 ? query : `\\b${escaped}\\b`;
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
      const targetContent = await readFile(candidate).catch((): null => null);
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

  const languageCandidates = definitionLanguageCandidates(content, sourcePath, name);
  for (const candidate of languageCandidates) {
    const targetContent = await readFile(candidate.path).catch((): null => null);
    if (typeof targetContent !== 'string') continue;
    const found = findDefinitionInText(targetContent, candidate.symbol ?? name, candidate.path);
    if (found !== null) return found;
  }

  if (typeof searchText !== 'function') return null;
  const query = definitionSearchQuery(name, sourcePath);
  const scopePatterns = definitionSearchScopePatterns(content, sourcePath);
  const searchedPaths = new Set<string>();
  const searchOptions: Array<DefinitionSearchOptions | undefined> = [
    ...(scopePatterns.length === 0 ? [] : [{ scopeIncludePatterns: scopePatterns }]),
    undefined,
  ];
  for (const options of searchOptions) {
    const matches = await searchText(query, options).catch((): DefinitionSearchMatch[] => []);
    for (const match of rankDefinitionSearchMatches(matches, sourcePath)) {
      const candidate = normalizeNavigationPath(match?.path);
      if (candidate === '' || candidate === sourcePath || searchedPaths.has(candidate)) continue;
      searchedPaths.add(candidate);
      const targetContent = await readFile(candidate).catch((): null => null);
      if (typeof targetContent !== 'string') continue;
      const found = findDefinitionInText(targetContent, name, candidate);
      if (found !== null) return found;
    }
  }
  return null;
}
