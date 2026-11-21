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
  line?: number;
  column?: number;
}

export interface DefinitionSearchOptions {
  scopeIncludePatterns?: string[];
}

export interface DefinitionSearchMatch {
  path?: string;
  [key: string]: unknown;
}

export type DefinitionTargetKind = 'declaration' | 'implementation';

export interface DefinitionPathIdentity {
  path?: unknown;
  requested?: unknown;
  identity?: unknown;
}

export interface DefinitionSearchInput {
  path: unknown;
  content: unknown;
  symbol: unknown;
  receiverType?: unknown;
  callOffset?: unknown;
  targetKind?: DefinitionTargetKind;
  readFile: (path: string) => Promise<string | null | undefined>;
  pathIdentities?: (paths: string[]) => Promise<DefinitionPathIdentity[] | null | undefined>;
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
  const bases: string[] = [];
  if (raw.startsWith('.')) {
    bases.push(normalizeNavigationPath(`${navigationDirname(sourcePath)}/${raw}`));
  } else if (language === 'python' && raw !== '') {
    const modulePath = normalizeNavigationPath(raw.replaceAll('.', '/'));
    bases.push(modulePath);
    const sourceSegments = navigationDirname(sourcePath).split('/').filter(Boolean);
    const packageRoot = modulePath.split('/')[0] ?? '';
    const packageIndex = packageRoot === '' ? -1 : sourceSegments.indexOf(packageRoot);
    if (packageIndex > 0) {
      bases.push(normalizeNavigationPath(`${sourceSegments.slice(0, packageIndex).join('/')}/${modulePath}`));
    }
  } else if (raw.startsWith('/')) {
    bases.push(normalizeNavigationPath(raw));
  } else {
    return [];
  }
  const candidates: string[] = [];
  for (const base of bases) {
    const hasExtension = /\.[^/]+$/u.test(navigationBasename(base));
    if (hasExtension) {
      candidates.push(base);
      continue;
    }
    candidates.push(
      ...extensions.map((extension) => `${base}.${extension}`),
      ...extensions.map((extension) => `${base}/index.${extension}`),
      ...(language === 'python' ? [`${base}/__init__.py`] : []),
    );
  }
  return [...new Set(candidates)];
}

function uniqueDefinitionCandidates(candidates: DefinitionLanguageCandidate[]): DefinitionLanguageCandidate[] {
  const seen = new Set<string>();
  const result: DefinitionLanguageCandidate[] = [];
  for (const candidate of candidates) {
    const path = normalizeNavigationPath(candidate.path);
    if (path === '') continue;
    const symbol = typeof candidate.symbol === 'string' && candidate.symbol !== '' ? candidate.symbol : '';
    const line = Math.max(0, Math.floor(Number(candidate.line) || 0));
    const column = Math.max(0, Math.floor(Number(candidate.column) || 0));
    const key = `${path}\u0000${symbol}\u0000${line}\u0000${column}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push({
      path,
      ...(symbol === '' ? {} : { symbol }),
      ...(line === 0 ? {} : { line }),
      ...(column === 0 ? {} : { column }),
    });
  }
  return result;
}

async function definitionCandidateIdentityKeys(
  paths: string[],
  resolvePathIdentities?: DefinitionSearchInput['pathIdentities'],
): Promise<Map<string, string>> {
  const normalizedPaths = [...new Set(paths.map(normalizeNavigationPath).filter((path) => path !== ''))];
  const identities = new Map(normalizedPaths.map((path) => [path, path]));
  if (typeof resolvePathIdentities !== 'function') return identities;
  for (let offset = 0; offset < normalizedPaths.length; offset += 64) {
    const batch = normalizedPaths.slice(offset, offset + 64);
    const described = await resolvePathIdentities(batch).catch((): DefinitionPathIdentity[] => []);
    for (const entry of Array.isArray(described) ? described : []) {
      const requested = normalizeNavigationPath(entry?.requested ?? entry?.path);
      const identity = typeof entry?.identity === 'string' ? entry.identity.trim() : '';
      if (requested !== '' && identity !== '') identities.set(requested, `filesystem:${identity}`);
    }
  }
  return identities;
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

function cIncludePaths(content: string): Array<{ path: string; quoted: boolean; offset: number }> {
  const paths: Array<{ path: string; quoted: boolean; offset: number }> = [];
  const expression = /(?:^|\n)[ \t]*#\s*include\s*([<"])([^>"\n]+)[>"]/gu;
  for (const match of content.matchAll(expression)) {
    const path = match[2].trim().replaceAll('\\', '/');
    if (path !== '') {
      paths.push({
        path,
        quoted: match[1] === '"',
        offset: match.index + Math.max(0, match[0].indexOf('#')),
      });
    }
  }
  return paths;
}

function cIncludeCandidateGroups(
  sourcePath: string,
  content: string,
  callPreprocessorContext?: DefinitionPreprocessorContext,
): Array<{ quoted: boolean; paths: string[]; score: number; order: number }> {
  const sourceDirectory = navigationDirname(sourcePath);
  const ancestorRoots: string[] = [];
  let ancestor = sourceDirectory;
  while (ancestor !== '') {
    ancestorRoots.push(ancestor);
    ancestor = navigationDirname(ancestor);
  }
  return definitionActiveCIncludePaths(content, callPreprocessorContext)
    .map((include) => {
      const candidates: string[] = [];
      if (include.quoted) candidates.push(`${sourceDirectory}/${include.path}`);
      candidates.push(include.path);
      for (const root of ancestorRoots) {
        for (const includeRoot of ['', 'src', 'include']) {
          candidates.push([root, includeRoot, include.path].filter((part) => part !== '').join('/'));
        }
      }
      return {
        quoted: include.quoted,
        paths: [...new Set(candidates.map(normalizeNavigationPath).filter((candidate) => candidate !== sourcePath))],
        score: include.score,
        order: include.order,
      };
    })
    .sort(
      (left, right) =>
        right.score - left.score || Number(right.quoted) - Number(left.quoted) || left.order - right.order,
    );
}

function cImplementationSiblingPaths(path: string): string[] {
  const extension = navigationExtension(path);
  if (!['h', 'hh', 'hpp', 'hxx', 'inl'].includes(extension)) return [];
  const directory = navigationDirname(path);
  const basename = navigationBasename(path);
  const stem = basename.slice(0, Math.max(0, basename.length - extension.length - 1));
  return ['cpp', 'cc', 'cxx', 'c'].map((sourceExtension) =>
    normalizeNavigationPath([directory, `${stem}.${sourceExtension}`].filter((part) => part !== '').join('/')),
  );
}

function definitionImplementationReceiverCompatible(content: string, name: string, receiverTypes: string[]): boolean {
  if (receiverTypes.length === 0) return true;
  const escapedName = escapeDefinitionRegex(name);
  const masked = maskDefinitionCommentsAndStrings(content);
  const anyQualifiedDefinition = new RegExp(String.raw`\b(?:[A-Za-z_$][\w$]*::)+${escapedName}\s*\(`, 'u').test(masked);
  if (!anyQualifiedDefinition) return true;
  return receiverTypes.some((receiverType) => {
    const leafType = receiverType.split('::').at(-1) ?? receiverType;
    return new RegExp(String.raw`\b${escapeDefinitionRegex(leafType)}\s*::\s*${escapedName}\s*\(`, 'u').test(masked);
  });
}

async function definitionImplementationSiblingCandidates(
  candidates: Array<{ candidate: DefinitionLanguageCandidate; targetContent: string }>,
  symbol: string,
  readFile: DefinitionSearchInput['readFile'],
  resolvePathIdentities?: DefinitionSearchInput['pathIdentities'],
): Promise<Array<{ candidate: DefinitionLanguageCandidate; targetContent: string }>> {
  const headerCandidates = candidates.filter((entry) => cImplementationSiblingPaths(entry.candidate.path).length > 0);
  if (headerCandidates.length === 0) return candidates;
  const siblingPaths = [
    ...new Set(headerCandidates.slice(0, 24).flatMap((entry) => cImplementationSiblingPaths(entry.candidate.path))),
  ];
  const identities = await definitionCandidateIdentityKeys(
    [...candidates.map((entry) => entry.candidate.path), ...siblingPaths],
    resolvePathIdentities,
  );
  const seen = new Set(candidates.map((entry) => identities.get(entry.candidate.path) ?? entry.candidate.path));
  const added: typeof candidates = [];
  let readAttempts = 0;
  for (const path of siblingPaths) {
    if (readAttempts >= 48) break;
    const key = identities.get(path) ?? path;
    if (seen.has(key)) continue;
    seen.add(key);
    readAttempts += 1;
    const targetContent = await readFile(path).catch((): null => null);
    if (typeof targetContent === 'string') {
      added.push({ candidate: { path, symbol }, targetContent });
    }
  }
  return [...candidates, ...added];
}

function shellSourcePaths(content: string): string[] {
  const paths: string[] = [];
  const expression = /(?:^|\n)[ \t]*(?:source|\.)[ \t]+(?:"([^"\n]+)"|'([^'\n]+)'|([^\s;#]+))/gu;
  for (const match of content.matchAll(expression)) {
    const path = (match[1] ?? match[2] ?? match[3] ?? '').trim();
    if (path !== '') paths.push(path);
  }
  return [...new Set(paths)];
}

function shellSourceCandidates(sourcePath: string, specifier: string): string[] {
  const raw = String(specifier ?? '').trim();
  if (raw === '') return [];
  const sourceDirectory = navigationDirname(sourcePath);
  const hasVariable = /\$/u.test(raw);
  const cleaned = raw.replaceAll('\\', '/').replace(/\$\{?[A-Za-z_]\w*\}?/gu, '');
  const basename = cleaned.split('/').filter(Boolean).at(-1) ?? '';
  const candidates: string[] = [];
  if (!hasVariable && !cleaned.startsWith('/') && cleaned !== '') {
    candidates.push(normalizeNavigationPath(`${sourceDirectory}/${cleaned}`));
  }
  if (basename !== '') candidates.push(normalizeNavigationPath(`${sourceDirectory}/${basename}`));
  return [...new Set(candidates.filter((candidate) => candidate !== ''))];
}

function rustSourceRoot(sourcePath: string): string {
  const segments = normalizeNavigationPath(sourcePath).split('/').filter(Boolean);
  const sourceIndex = segments.lastIndexOf('src');
  return sourceIndex < 0 ? '' : segments.slice(0, sourceIndex + 1).join('/');
}

function splitRustUseItems(value: string): string[] {
  const items: string[] = [];
  let depth = 0;
  let start = 0;
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (character === '{') depth += 1;
    else if (character === '}') depth -= 1;
    else if (character === ',' && depth === 0) {
      items.push(value.slice(start, index).trim());
      start = index + 1;
    }
  }
  const tail = value.slice(start).trim();
  if (tail !== '') items.push(tail);
  return items;
}

function expandRustUseItem(value: string, prefix = ''): Array<{ importedPath: string; localName: string }> {
  let text = value.trim().replace(/^::/u, '');
  if (text === '') return [];
  const aliasMatch = /\s+as\s+([A-Za-z_]\w*)$/u.exec(text);
  const alias = aliasMatch?.[1] ?? '';
  if (aliasMatch !== null) text = text.slice(0, aliasMatch.index).trim();
  const braceStart = text.indexOf('{');
  if (braceStart >= 0) {
    const braceEnd = text.lastIndexOf('}');
    if (braceEnd <= braceStart) return [];
    const groupPrefix = text.slice(0, braceStart).trim().replace(/::$/u, '');
    const nextPrefix = [prefix, groupPrefix].filter((part) => part !== '').join('::');
    return splitRustUseItems(text.slice(braceStart + 1, braceEnd)).flatMap((item) =>
      expandRustUseItem(item, nextPrefix),
    );
  }
  const importedPath = [prefix, text.replace(/\*$/u, '').replace(/:+$/u, '')].filter((part) => part !== '').join('::');
  if (importedPath === '') return [];
  const localName = alias !== '' ? alias : (importedPath.split('::').at(-1) ?? '');
  return [{ importedPath, localName }];
}

function rustUseImports(content: string): Array<{ importedPath: string; localName: string }> {
  const imports: Array<{ importedPath: string; localName: string }> = [];
  const expression = /(?:^|\n)[ \t]*(?:pub(?:\([^)]*\))?\s+)?use\s+([^;]+);/gu;
  for (const match of content.matchAll(expression)) {
    imports.push(...expandRustUseItem(match[1]));
  }
  return imports;
}

function rustModulePath(sourcePath: string, importedPath: string): { base: string; parts: string[] } | null {
  const parts = importedPath.split('::').filter(Boolean);
  if (parts.length === 0) return null;
  const sourceDirectory = navigationDirname(sourcePath);
  let base = '';
  let index = 0;
  if (parts[0] === 'crate') {
    base = rustSourceRoot(sourcePath);
    index = 1;
  } else if (parts[0] === 'self') {
    base = sourceDirectory;
    index = 1;
  } else if (parts[0] === 'super') {
    base = sourceDirectory;
    while (parts[index] === 'super') {
      base = navigationDirname(base);
      index += 1;
    }
  } else {
    base = rustSourceRoot(sourcePath);
  }
  return { base, parts: parts.slice(index) };
}

function rustModuleFileCandidates(base: string, parts: string[]): string[] {
  if (parts.length === 0) return [];
  const modulePath = parts.join('/');
  return uniqueDefinitionCandidates([
    { path: normalizeNavigationPath(base === '' ? `${modulePath}.rs` : `${base}/${modulePath}.rs`) },
    { path: normalizeNavigationPath(base === '' ? `${modulePath}/mod.rs` : `${base}/${modulePath}/mod.rs`) },
  ]).map((candidate) => candidate.path);
}

async function rustReexportModuleCandidates(
  sourcePath: string,
  content: string,
  name: string,
  readFile: DefinitionSearchInput['readFile'],
): Promise<string[]> {
  const imported = rustUseImports(content).find((entry) => entry.localName === name);
  if (imported === undefined) return [];
  const resolved = rustModulePath(sourcePath, imported.importedPath);
  if (resolved === null || resolved.parts.length !== 1) return [];
  const sourceRoot = rustSourceRoot(sourcePath);
  if (sourceRoot === '') return [];
  const candidates: string[] = [];
  for (const rootFile of [`${sourceRoot}/lib.rs`, `${sourceRoot}/main.rs`]) {
    const rootContent = await readFile(rootFile).catch((): null => null);
    if (typeof rootContent !== 'string' || rootContent === '') continue;
    for (const match of rootContent.matchAll(/(?:^|\n)[ \t]*pub(?:\([^)]*\))?\s+use\s+([^;]+);/gu)) {
      const raw = match[1] ?? '';
      const wildcard = raw.includes('*');
      for (const reexport of expandRustUseItem(raw)) {
        if (!wildcard && reexport.localName !== name) continue;
        const modulePath = rustModulePath(rootFile, reexport.importedPath);
        if (modulePath === null || modulePath.parts.length === 0) continue;
        candidates.push(...rustModuleFileCandidates(modulePath.base, modulePath.parts));
      }
    }
  }
  return [...new Set(candidates)];
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
  } else if (extension === 'rs') {
    const sourceDirectory = navigationDirname(sourcePath);
    const moduleDeclarations = /(?:^|\n)[ \t]*(?:pub(?:\([^)]*\))?\s+)?mod\s+([A-Za-z_]\w*)\s*;/gu;
    for (const match of source.matchAll(moduleDeclarations)) {
      const moduleName = match[1];
      if (moduleName !== name) continue;
      candidates.push(
        { path: normalizeNavigationPath(`${sourceDirectory}/${moduleName}.rs`), line: 1, column: 1 },
        { path: normalizeNavigationPath(`${sourceDirectory}/${moduleName}/mod.rs`), line: 1, column: 1 },
      );
    }
    for (const imported of rustUseImports(source)) {
      if (imported.localName !== name) continue;
      const resolved = rustModulePath(sourcePath, imported.importedPath);
      if (resolved === null || resolved.parts.length === 0) continue;
      const targetSymbol = resolved.parts.at(-1) ?? name;
      const moduleParts = resolved.parts.slice(0, -1);
      if (moduleParts.length === 0) {
        /* A one-segment crate import may be a re-exported symbol rather than
           a module file. Never guess `Symbol.rs`; the bounded crate search
           below resolves the actual declaration and preserves path casing. */
        continue;
      } else {
        for (const path of rustModuleFileCandidates(resolved.base, moduleParts)) {
          candidates.push({ path, symbol: targetSymbol });
        }
      }
    }
  } else if (['sh', 'bash', 'zsh'].includes(extension)) {
    for (const sourced of shellSourcePaths(source)) {
      for (const candidate of shellSourceCandidates(sourcePath, sourced)) {
        candidates.push({ path: candidate, symbol: name });
      }
    }
  } else if (['c', 'h', 'cc', 'cpp', 'cxx', 'hpp'].includes(extension)) {
    const sourceDirectory = navigationDirname(sourcePath);
    const ancestorRoots: string[] = [];
    let ancestor = sourceDirectory;
    while (ancestor !== '') {
      ancestorRoots.push(ancestor);
      ancestor = navigationDirname(ancestor);
    }
    for (const include of definitionActiveCIncludePaths(source)) {
      if (include.quoted) {
        candidates.push({
          path: normalizeNavigationPath(`${sourceDirectory}/${include.path}`),
          symbol: name,
        });
      }
      candidates.push({ path: include.path, symbol: name });
      for (const root of ancestorRoots) {
        for (const includeRoot of ['', 'src', 'include']) {
          candidates.push({
            path: normalizeNavigationPath([root, includeRoot, include.path].filter((part) => part !== '').join('/')),
            symbol: name,
          });
        }
      }
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
  } else if (extension === 'rs') {
    const sourceDirectory = navigationDirname(sourcePath);
    const sourceRoot = rustSourceRoot(sourcePath);
    if (sourceRoot !== '') patterns.push(`${sourceRoot}/**`);
    const moduleDeclarations = /(?:^|\n)[ \t]*(?:pub(?:\([^)]*\))?\s+)?mod\s+([A-Za-z_]\w*)\s*;/gu;
    for (const match of source.matchAll(moduleDeclarations)) {
      const target = normalizeNavigationPath(`${sourceDirectory}/${match[1]}`);
      patterns.push(`${target}.rs`, `${target}/mod.rs`, `${target}/**`);
    }
    for (const imported of rustUseImports(source)) {
      const resolved = rustModulePath(sourcePath, imported.importedPath);
      if (resolved === null || resolved.parts.length === 0) continue;
      const moduleParts = resolved.parts.length === 1 ? resolved.parts : resolved.parts.slice(0, -1);
      const moduleFiles = rustModuleFileCandidates(resolved.base, moduleParts);
      const moduleDirectory = normalizeNavigationPath(
        [resolved.base, moduleParts.join('/')].filter((part) => part !== '').join('/'),
      );
      patterns.push(...moduleFiles);
      if (moduleDirectory !== '') patterns.push(`${moduleDirectory}/**`, `**/${moduleParts.join('/')}/**`);
    }
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
    for (const include of definitionActiveCIncludePaths(source)) {
      const target = normalizeNavigationPath(include.path);
      if (target === '') continue;
      patterns.push(target, `**/${target}`);
    }
  } else if (['sh', 'bash', 'zsh'].includes(extension)) {
    for (const sourced of shellSourcePaths(source)) {
      patterns.push(...shellSourceCandidates(sourcePath, sourced));
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

function splitTopLevelDefinitionItems(value: string): string[] {
  const items: string[] = [];
  let depth = 0;
  let quote = '';
  let itemStart = 0;
  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    if (quote !== '') {
      if (character === '\\') index += 1;
      else if (character === quote) quote = '';
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
      continue;
    }
    if (character === '(' || character === '[' || character === '{' || character === '<') depth += 1;
    else if (character === ')' || character === ']' || character === '}' || character === '>')
      depth = Math.max(0, depth - 1);
    else if (character === ',' && depth === 0) {
      items.push(value.slice(itemStart, index).trim());
      itemStart = index + 1;
    }
  }
  const tail = value.slice(itemStart).trim();
  if (tail !== '') items.push(tail);
  return items;
}

function matchingDefinitionBrace(source: string, open: number, opening: string, closing: string): number {
  let depth = 0;
  let quote = '';
  for (let index = open; index < source.length; index += 1) {
    const character = source[index];
    if (quote !== '') {
      if (character === '\\') index += 1;
      else if (character === quote) quote = '';
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
      continue;
    }
    if (character === opening) depth += 1;
    else if (character === closing) {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return -1;
}

function definitionCallArgumentsAt(content: unknown, offset: unknown, symbol: unknown): string[] {
  const source = String(content ?? '');
  const safeOffset = Math.max(0, Math.min(source.length, Number(offset) || 0));
  const name = String(symbol ?? '').trim();
  if (name === '') return [];
  const symbolStart = source.lastIndexOf(name, safeOffset);
  if (symbolStart < 0) return [];
  const open = source.indexOf('(', symbolStart + name.length);
  if (open < 0 || source.slice(symbolStart + name.length, open).trim() !== '') return [];
  const close = matchingDefinitionBrace(source, open, '(', ')');
  if (close < 0) return [];
  return splitTopLevelDefinitionItems(source.slice(open + 1, close));
}

const INVALID_RECEIVER_TYPES = new Set([
  'auto',
  'bool',
  'char',
  'char8_t',
  'char16_t',
  'char32_t',
  'delete',
  'double',
  'else',
  'enum',
  'float',
  'for',
  'goto',
  'if',
  'int',
  'long',
  'new',
  'return',
  'short',
  'signed',
  'sizeof',
  'struct',
  'switch',
  'throw',
  'union',
  'unsigned',
  'void',
  'volatile',
  'wchar_t',
  'while',
]);

function stripDefinitionTemplateArguments(typePath: string): string {
  let result = '';
  let depth = 0;
  for (const character of typePath) {
    if (character === '<') {
      depth += 1;
      continue;
    }
    if (character === '>' && depth > 0) {
      depth -= 1;
      continue;
    }
    if (depth === 0) result += character;
  }
  return result;
}

function definitionQualifiedReceiverBefore(value: string): string {
  const expression = /((?:::)?[A-Za-z_$][\w$]*(?:(?:::[A-Za-z_$][\w$]*)|(?:\s*<[^;\n{}()]*>))*)\s*::\s*$/u;
  return expression.exec(value)?.[1] ?? '';
}

function definitionReceiverTemplateArguments(receiver: string): string[] {
  const argumentsList: string[] = [];
  let depth = 0;
  let start = -1;
  for (let index = 0; index < receiver.length; index += 1) {
    const character = receiver[index];
    if (character === '<') {
      if (depth === 0) start = index + 1;
      depth += 1;
    } else if (character === '>' && depth > 0) {
      depth -= 1;
      if (depth === 0 && start >= 0) {
        argumentsList.push(...splitTopLevelDefinitionItems(receiver.slice(start, index)));
        start = -1;
      }
    }
  }
  return argumentsList.map((argument) => argument.trim()).filter((argument) => argument !== '');
}

function definitionTemplateParameterNamesAt(source: string, offset: number): { declared: boolean; names: Set<string> } {
  const windowStart = Math.max(0, offset - 4096);
  const masked = maskDefinitionCommentsAndStrings(source.slice(windowStart, offset));
  const declarations: Array<{ start: number; end: number; body: string }> = [];
  const templateExpression = /\btemplate\s*</gu;
  let match: RegExpExecArray | null;
  while ((match = templateExpression.exec(masked)) !== null) {
    const open = match.index + Math.max(0, match[0].lastIndexOf('<'));
    const close = matchingDefinitionBrace(masked, open, '<', '>');
    if (close < 0) continue;
    declarations.push({
      start: match.index,
      end: close + 1,
      body: masked.slice(open + 1, close),
    });
    templateExpression.lastIndex = close + 1;
  }
  if (declarations.length === 0) return { declared: false, names: new Set() };
  let firstDeclaration = declarations.length - 1;
  while (firstDeclaration > 0) {
    const previous = declarations[firstDeclaration - 1];
    const current = declarations[firstDeclaration];
    if (masked.slice(previous.end, current.start).trim() !== '') break;
    firstDeclaration -= 1;
  }
  const parameterBody = declarations
    .slice(firstDeclaration)
    .map((declaration) => declaration.body)
    .join(', ');
  const names = new Set<string>();
  for (const parameter of splitTopLevelDefinitionItems(parameterBody)) {
    const withoutDefault = parameter.replace(/\s*=\s*[\s\S]*$/u, '').trim();
    const name = /([A-Za-z_$][\w$]*)\s*$/u.exec(withoutDefault)?.[1] ?? '';
    if (name !== '') names.add(name);
  }
  return { declared: true, names };
}

function definitionTemplateArgumentReferences(argument: string, templateParameters: Set<string>): boolean {
  for (const match of argument.matchAll(/[A-Za-z_$][\w$]*/gu)) {
    if (templateParameters.has(match[0])) return true;
  }
  return false;
}

interface DefinitionClassRange {
  name: string;
  start: number;
  end: number;
}

function definitionClassRanges(masked: string): DefinitionClassRange[] {
  const ranges: DefinitionClassRange[] = [];
  const expression =
    /\b(?:class|struct)\s+(?:(?!final\b)[A-Za-z_$][\w$]*(?:\([^;{}]*\))?\s+)*(?!final\b)([A-Za-z_$][\w$]*)(?:\s+final)?\s*(?::[^{;]+)?\{/gu;
  for (const match of masked.matchAll(expression)) {
    const start = match.index + Math.max(0, match[0].lastIndexOf('{'));
    const end = matchingDefinitionBrace(masked, start, '{', '}');
    if (end >= 0) ranges.push({ name: match[1], start, end });
  }
  return ranges;
}

function definitionEnclosingClassName(ranges: DefinitionClassRange[], offset: number): string {
  let name = '';
  let start = -1;
  for (const range of ranges) {
    if (range.start >= offset || range.end <= offset || range.start <= start) continue;
    name = range.name;
    start = range.start;
  }
  return name;
}

function normalizeReceiverType(rawType: string, preserveQualifier: boolean, safeTemplate = false): string {
  const trimmed = rawType
    .trim()
    .replace(/^(?:(?:const|volatile)\s+)+/u, '')
    .replace(/^[*&\s]+|[*&\s]+$/gu, '');
  const generic = /^((?:::)?[A-Za-z_$][\w$]*(?:::[A-Za-z_$][\w$]*)*)\s*<([\s\S]+)>\s*$/u.exec(trimmed);
  if (generic !== null) {
    const baseType = generic[1] ?? '';
    const baseLeaf = normalizeReceiverType(baseType, false);
    if (['unique_ptr', 'shared_ptr', 'weak_ptr'].includes(baseLeaf)) {
      const elementType = splitTopLevelDefinitionItems(generic[2] ?? '')[0] ?? '';
      return normalizeReceiverType(elementType, preserveQualifier, safeTemplate);
    }
    if (safeTemplate) {
      const qualifiedBaseType = normalizeReceiverType(baseType, true);
      const firstSegment = qualifiedBaseType.replace(/^::/u, '').split('::')[0] ?? '';
      return qualifiedBaseType.includes('::') && firstSegment !== 'std' ? qualifiedBaseType : '';
    }
    return normalizeReceiverType(baseType, preserveQualifier);
  }
  const normalized = stripDefinitionTemplateArguments(trimmed);
  return preserveQualifier ? normalized : (normalized.split('::').at(-1) ?? '');
}

function qualifyRelativeAliasTarget(target: string, scope: string): string {
  if (scope === '') return target;
  const relative = /^((?:(?:const|volatile)\s+)*)([*&]*)\s*([A-Za-z_$][\w$]*(?:::[A-Za-z_$][\w$]*)*)\s*([*&]*)$/u.exec(
    target,
  );
  if (relative === null) return target;
  const typePath = relative[3];
  const leafType = typePath.split('::').at(-1) ?? '';
  if (INVALID_RECEIVER_TYPES.has(leafType)) return target;
  if (typePath === scope || typePath.startsWith(`${scope}::`)) return target;
  if ((typePath.split('::')[0] ?? '') === 'std') return target;
  return `${relative[1]}${relative[2]}${scope}::${typePath}${relative[4]}`;
}

interface DefinitionReceiverAliasResolution {
  matched: boolean;
  typeName: string;
}

function definitionTypeAliasTargets(source: string, aliasName: string, maxOffset = source.length): string[] {
  const requested = normalizeReceiverType(aliasName, true);
  if (source === '' || requested === '') return [];
  const requestedGlobal = requested.startsWith('::');
  const qualifierEnd = requested.lastIndexOf('::');
  const requestedQualifier = qualifierEnd < 0 ? '' : requested.slice(0, qualifierEnd);
  const requestedLeaf = qualifierEnd < 0 ? requested : requested.slice(qualifierEnd + 2);
  const masked = maskDefinitionCommentsAndStrings(source);
  const preprocessorContextAt = definitionPreprocessorContextLookup(source);
  const declarations: Array<{ name: string; target: string; offset: number }> = [];
  const addDeclaration = (name: string, target: string, offset: number): void => {
    if (name !== requestedLeaf || offset >= maxOffset) return;
    if (preprocessorContextAt(offset).active === false) return;
    const rawTarget = target.trim();
    if (/^typename\b/u.test(rawTarget)) return;
    const normalizedTarget = rawTarget
      .replace(/\s+/gu, ' ')
      .replace(/^(?:struct|class|union|enum)\s+(?=[A-Za-z_$])/u, '');
    if (
      normalizedTarget === '' ||
      /[;{}()[\],=]/u.test(normalizedTarget) ||
      /^(?:auto|decltype)\b/u.test(normalizedTarget)
    ) {
      return;
    }
    declarations.push({ name, target: normalizedTarget, offset });
  };

  for (const match of masked.matchAll(/\busing\s+([A-Za-z_$][\w$]*)\s*=\s*([^;]+);/gu)) {
    addDeclaration(match[1], match[2], match.index);
  }
  for (const match of masked.matchAll(/\btypedef\s+([^;]+?)\s+([A-Za-z_$][\w$]*)\s*;/gu)) {
    addDeclaration(match[2], match[1], match.index);
  }
  if (declarations.length === 0) return [];

  const namespaces = definitionNamespaceScopesAtOffsets(
    masked,
    declarations.map((declaration) => declaration.offset),
  );
  const visibleNamespaces = definitionVisibleNamespaceScopesAtOffsets(
    masked,
    declarations.map((declaration) => declaration.offset),
  );
  const targets: string[] = [];
  for (const declaration of declarations) {
    const scope = (namespaces.get(declaration.offset) ?? []).join('::');
    const visibleScope = (visibleNamespaces.get(declaration.offset) ?? []).join('::');
    if (requestedGlobal && visibleScope !== '') continue;
    if (
      !requestedGlobal &&
      requestedQualifier !== '' &&
      scope !== requestedQualifier &&
      !scope.endsWith(`::${requestedQualifier}`) &&
      visibleScope !== requestedQualifier &&
      !visibleScope.endsWith(`::${requestedQualifier}`)
    ) {
      continue;
    }
    targets.push(qualifyRelativeAliasTarget(declaration.target, scope));
  }
  return [...new Set(targets)];
}

function definitionReceiverAliasResolution(
  sources: Array<{ content: string; maxOffset?: number }>,
  rawType: string,
  preserveQualifier: boolean,
): DefinitionReceiverAliasResolution {
  let typeName = normalizeReceiverType(rawType, preserveQualifier, preserveQualifier);
  if (typeName === '') return { matched: false, typeName: '' };
  const visited = new Set<string>();
  let matched = false;
  let fullyResolved = false;
  for (let depth = 0; depth < 6; depth += 1) {
    if (visited.has(typeName)) return { matched: true, typeName: '' };
    visited.add(typeName);
    const targets = [
      ...new Set(
        sources.flatMap((source) =>
          definitionTypeAliasTargets(source.content, typeName, source.maxOffset ?? source.content.length),
        ),
      ),
    ];
    if (targets.length === 0) {
      fullyResolved = matched;
      break;
    }
    matched = true;
    if (targets.length > 1) return { matched: true, typeName: '' };
    const nextTypeName = normalizeReceiverType(targets[0], preserveQualifier, preserveQualifier);
    if (nextTypeName === '' || INVALID_RECEIVER_TYPES.has(nextTypeName)) {
      return { matched: true, typeName: '' };
    }
    typeName = nextTypeName;
  }
  return { matched, typeName: fullyResolved ? typeName : '' };
}

function receiverTypeFromDeclaration(
  line: string,
  receiver: string,
  preserveQualifier = false,
  includeTypeArguments = false,
): string {
  const typeExpression = String.raw`((?:::)?[A-Za-z_$][\w$]*(?:(?:::[A-Za-z_$][\w$]*)|(?:\s*<[^;\n{}()]*>))*)`;
  const declaration = new RegExp(
    String.raw`(?:^|[;{}(,])\s*(?:(?:static|constexpr|mutable|volatile|const|thread_local|extern|register)\s+)*${typeExpression}\s*(?:[*&]+\s*|\s+)${escapeDefinitionRegex(receiver)}\b(?=\s*(?:\[[^\]]*\])?\s*(?:=|;|,|\{|\(|\)|$))`,
    'u',
  );
  const match = declaration.exec(line);
  let rawType = match?.[1] ?? '';
  if (rawType === '') {
    const declaratorList = new RegExp(
      String.raw`(?:^|[;{}(,])\s*(?:(?:static|constexpr|mutable|volatile|const|thread_local|extern|register)\s+)*${typeExpression}\s+([^;{}]+)`,
      'gu',
    );
    for (const listMatch of line.matchAll(declaratorList)) {
      const segments: string[] = [];
      let depth = 0;
      let segmentStart = 0;
      const rest = listMatch[2] ?? '';
      for (let index = 0; index <= rest.length; index += 1) {
        const character = rest[index] ?? ',';
        if (character === '(' || character === '[' || character === '{') depth += 1;
        else if (character === ')' || character === ']' || character === '}') depth = Math.max(0, depth - 1);
        if (character !== ',' || depth > 0) continue;
        segments.push(rest.slice(segmentStart, index));
        segmentStart = index + 1;
      }
      for (const segment of segments.slice(1)) {
        const name = /^\s*(?:[*&]+\s*)*([A-Za-z_$][\w$]*)\b/u.exec(segment)?.[1] ?? '';
        if (name === receiver) {
          rawType = listMatch[1] ?? '';
          break;
        }
      }
      if (rawType !== '') break;
    }
  }
  if (rawType !== '' && INVALID_RECEIVER_TYPES.has(normalizeReceiverType(rawType, false))) rawType = '';
  if (rawType === '') return '';
  if (includeTypeArguments) return rawType.replace(/\s+/gu, '');
  const typeName = normalizeReceiverType(rawType, preserveQualifier, preserveQualifier);
  return INVALID_RECEIVER_TYPES.has(typeName) ? '' : typeName;
}

function definitionKnownFunctionReturnType(content: string, functionName: string): string {
  const name = functionName.trim();
  if (name === '') return '';
  const masked = maskDefinitionCommentsAndStrings(content);
  const escaped = escapeDefinitionRegex(name);
  const typeExpression = String.raw`((?:::)?[A-Za-z_$][\w$]*(?:::[A-Za-z_$][\w$]*)*(?:\s*<[^;{}()\n]*>)?)`;
  const declaration = new RegExp(
    String.raw`(?:^|[;}\n])\s*(?:(?:static|inline|constexpr|extern|const|volatile|virtual|friend|explicit)\s+)*${typeExpression}\s*(?:[*&]+\s*|\s+)(?:[A-Za-z_$][\w$]*::)*${escaped}\s*\(`,
    'gu',
  );
  let returnType = '';
  for (const match of masked.matchAll(declaration)) {
    const rawType = match[1] ?? '';
    const normalized = normalizeReceiverType(rawType, false);
    if (normalized !== '' && /^[A-Z_]/u.test(normalized) && !INVALID_RECEIVER_TYPES.has(normalized)) {
      returnType = rawType;
    }
  }
  return returnType;
}

function definitionAutoReceiverTypeAt(
  content: string,
  receiver: string,
  preserveQualifier: boolean,
): { typeName: string; offset: number } | null {
  const source = String(content ?? '');
  if (source === '' || receiver === '') return null;
  const masked = maskDefinitionCommentsAndStrings(source);
  const expression = new RegExp(
    String.raw`\bauto\s*(?:[*&]+\s*)?${escapeDefinitionRegex(receiver)}\s*=\s*([^;]+)`,
    'gu',
  );
  let latest: RegExpExecArray | null = null;
  for (const match of masked.matchAll(expression)) latest = match;
  if (latest === null) return null;
  const initializer = (latest[1] ?? '').replace(/\s+/gu, ' ').trim();
  if (initializer === '') return null;
  const typeExpression = String.raw`((?:::)?[A-Za-z_$][\w$]*(?:::[A-Za-z_$][\w$]*)*(?:\s*<[^;(){}]*>)?)`;
  const factoryCall = new RegExp(String.raw`^((?:::)?[A-Za-z_$][\w$]*(?:::[A-Za-z_$][\w$]*)*)\s*\(`, 'u').exec(
    initializer,
  )?.[1];
  const factoryType =
    factoryCall === undefined
      ? ''
      : definitionKnownFunctionReturnType(masked.slice(0, latest.index), factoryCall.split('::').at(-1) ?? '');
  let rawType =
    new RegExp(String.raw`^static_cast\s*<\s*([^>]+)\s*>`, 'u').exec(initializer)?.[1] ??
    new RegExp(String.raw`^std::make_(?:unique|shared)\s*<\s*([^>]+)\s*>`, 'u').exec(initializer)?.[1] ??
    new RegExp(String.raw`^new\s+${typeExpression}\s*[({]`, 'u').exec(initializer)?.[1] ??
    factoryType;
  if (rawType === '') {
    const direct = new RegExp(String.raw`^${typeExpression}\s*[({]`, 'u').exec(initializer)?.[1] ?? '';
    if (/^[A-Z_]/u.test(normalizeReceiverType(direct, false))) rawType = direct;
  }
  const typeName = normalizeReceiverType(rawType, preserveQualifier, preserveQualifier);
  if (typeName === '' || INVALID_RECEIVER_TYPES.has(typeName)) return null;
  return { typeName, offset: latest.index };
}

/** Infer the declared type of `receiver.method` or `receiver->method` at a caret offset. */
export function definitionReceiverTypeAt(
  content: unknown,
  offset: unknown,
  symbol: unknown = '',
  preserveQualifier = false,
): string {
  const source = String(content ?? '');
  const safeOffset = Math.max(0, Math.min(source.length, Number(offset) || 0));
  const lineStart = source.lastIndexOf('\n', Math.max(0, safeOffset - 1)) + 1;
  const name = String(symbol ?? '').trim();
  const symbolStart = name === '' ? safeOffset : Math.max(lineStart, source.lastIndexOf(name, safeOffset));
  const before = source.slice(lineStart, symbolStart);
  const member = /([A-Za-z_$][\w$]*)\s*(?:\.|->)\s*$/u.exec(before);
  const receiver = member?.[1] ?? '';
  if (receiver === '') return '';
  let typeName = '';
  let typeOffset = -1;
  let lineOffset = 0;
  for (const line of source.slice(0, symbolStart).split('\n')) {
    const trimmed = line.trimStart();
    if (/^(?:\/\/|\/\*|\*|#)/u.test(trimmed)) {
      lineOffset += line.length + 1;
      continue;
    }
    const inferred = receiverTypeFromDeclaration(line, receiver, preserveQualifier);
    if (inferred !== '') {
      typeName = inferred;
      typeOffset = lineOffset;
    }
    lineOffset += line.length + 1;
  }
  const autoInferred = definitionAutoReceiverTypeAt(source.slice(0, symbolStart), receiver, preserveQualifier);
  if (autoInferred !== null && autoInferred.offset >= typeOffset) typeName = autoInferred.typeName;
  if (typeName !== '') {
    const aliasResolution = definitionReceiverAliasResolution(
      [{ content: source, maxOffset: symbolStart }],
      typeName,
      preserveQualifier,
    );
    if (aliasResolution.matched) typeName = aliasResolution.typeName;
  }
  return typeName;
}

function definitionReceiverSignatureAt(content: unknown, offset: unknown, symbol: unknown): string {
  const source = String(content ?? '');
  const safeOffset = Math.max(0, Math.min(source.length, Number(offset) || 0));
  const lineStart = source.lastIndexOf('\n', Math.max(0, safeOffset - 1)) + 1;
  const name = String(symbol ?? '').trim();
  if (name === '') return '';
  const symbolStart = Math.max(lineStart, source.lastIndexOf(name, safeOffset));
  const before = source.slice(lineStart, symbolStart);
  const receiver = /([A-Za-z_$][\w$]*)\s*(?:\.|->)\s*$/u.exec(before)?.[1] ?? '';
  if (receiver === '') return '';
  let signature = '';
  for (const line of source.slice(0, symbolStart).split('\n')) {
    const trimmed = line.trimStart();
    if (/^(?:\/\/|\/\*|\*|#)/u.test(trimmed)) continue;
    const rawType = receiverTypeFromDeclaration(line, receiver, true, true);
    if (rawType !== '') signature = rawType.replace(/^::/u, '');
  }
  return signature;
}

function definitionIdentifierTypeAt(content: unknown, offset: unknown, argument: unknown): string {
  const value = String(argument ?? '').trim();
  if (!/^[A-Za-z_$][\w$]*$/u.test(value)) return '';
  const source = String(content ?? '');
  const safeOffset = Math.max(0, Math.min(source.length, Number(offset) || 0));
  let typeName = '';
  let typeOffset = -1;
  let lineOffset = 0;
  for (const line of source.slice(0, safeOffset).split('\n')) {
    const trimmed = line.trimStart();
    if (/^(?:\/\/|\/\*|\*|#)/u.test(trimmed)) {
      lineOffset += line.length + 1;
      continue;
    }
    const inferred = receiverTypeFromDeclaration(line, value, true);
    if (inferred !== '') {
      typeName = inferred;
      typeOffset = lineOffset;
    }
    lineOffset += line.length + 1;
  }
  const autoInferred = definitionAutoReceiverTypeAt(source.slice(0, safeOffset), value, true);
  if (autoInferred !== null && autoInferred.offset >= typeOffset) typeName = autoInferred.typeName;
  if (typeName !== '') {
    const aliasResolution = definitionReceiverAliasResolution(
      [{ content: source, maxOffset: safeOffset }],
      typeName,
      true,
    );
    if (aliasResolution.matched) typeName = aliasResolution.typeName;
  }
  return typeName;
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
    add(`\\bmacro_rules!\\s+(${escaped})\\b`);
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
      `(?:^|\\n)[ \\t]*(?!(?:return|if|while|for|switch|case|delete|new|throw|else|goto|sizeof)\\b)(?:[\\w:<>~*&]+[ \\t]+)+(?:[A-Za-z_$][\\w$]*(?:\\s*<[^;{}()\\n]*>)?\\s*::)*(${escaped})\\s*\\([^;{}]*\\)\\s*(?:const\\s*)?(?:noexcept\\s*)?(?:\\{|;)`,
    );
    add(
      `(?:^|\\n)[ \\t]*(?!(?:return|if|while|for|switch|case|delete|new|throw|else|goto|sizeof)\\b)(?:(?:const|volatile|unsigned|signed|long|short|static|mutable|constexpr)\\s+)*[\\w:]+(?:\\s*<[^;{}]*>)?\\s*(?:[*&]+\\s*|\\s+)(${escaped})\\b(?:\\s*\\[[^\\]]*\\])?\\s*(?:=[^;\\n]*)?;`,
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

function maskDefinitionCommentsAndStrings(text: string): string {
  const masked = text.split('');
  let state: 'code' | 'line' | 'block' | 'single' | 'double' = 'code';
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const next = text[index + 1] ?? '';
    if (state === 'line') {
      if (character === '\n') state = 'code';
      else masked[index] = ' ';
      continue;
    }
    if (state === 'block') {
      if (character === '*' && next === '/') {
        masked[index] = ' ';
        masked[index + 1] = ' ';
        index += 1;
        state = 'code';
      } else if (character !== '\n') masked[index] = ' ';
      continue;
    }
    if (state === 'single' || state === 'double') {
      if (character === '\\') {
        masked[index] = ' ';
        if (index + 1 < text.length && text[index + 1] !== '\n') {
          masked[index + 1] = ' ';
          index += 1;
        }
      } else if ((state === 'single' && character === "'") || (state === 'double' && character === '"')) {
        masked[index] = ' ';
        state = 'code';
      } else if (character !== '\n') masked[index] = ' ';
      continue;
    }
    if (character === '/' && next === '/') {
      masked[index] = ' ';
      masked[index + 1] = ' ';
      index += 1;
      state = 'line';
    } else if (character === '/' && next === '*') {
      masked[index] = ' ';
      masked[index + 1] = ' ';
      index += 1;
      state = 'block';
    } else if (character === "'") {
      masked[index] = ' ';
      state = 'single';
    } else if (character === '"') {
      masked[index] = ' ';
      state = 'double';
    }
  }
  return masked.join('');
}

interface DefinitionPreprocessorContext {
  active: boolean | undefined;
  branches: Array<{ key: string; branch: string }>;
}

interface DefinitionPreprocessorFrame {
  key: string;
  branch: string;
  active: boolean | undefined;
  taken: boolean | undefined;
}

function definitionPreprocessorExpression(expression: string): string {
  return expression.trim().replace(/\s+/gu, ' ');
}

function definitionPreprocessorFramesActive(frames: DefinitionPreprocessorFrame[]): boolean | undefined {
  if (frames.some((frame) => frame.active === false)) return false;
  return frames.some((frame) => frame.active === undefined) ? undefined : true;
}

function definitionPreprocessorConditionValue(
  expression: string,
  macroDefined: Map<string, boolean>,
  macroValues: Map<string, boolean>,
): boolean | undefined {
  const normalized = definitionPreprocessorExpression(expression);
  if (/^[+-]?\d+$/u.test(normalized)) return Number(normalized) !== 0;
  const negated = /^!(?!=)\s*(.+)$/u.exec(normalized);
  if (negated !== null) {
    const value = definitionPreprocessorConditionValue(negated[1] ?? '', macroDefined, macroValues);
    return value === undefined ? undefined : !value;
  }
  const defined = /^defined\s*(?:\(\s*([A-Za-z_$][\w$]*)\s*\)|([A-Za-z_$][\w$]*))$/u.exec(normalized);
  if (defined !== null) {
    const name = defined[1] ?? defined[2] ?? '';
    return macroDefined.get(name);
  }
  if (/^[A-Za-z_$][\w$]*$/u.test(normalized)) {
    if (macroDefined.get(normalized) === false) return false;
    return macroValues.get(normalized);
  }
  return undefined;
}

function definitionPreprocessorContextLookup(source: string): (offset: number) => DefinitionPreprocessorContext {
  const masked = maskDefinitionCommentsAndStrings(source);
  const snapshots: Array<{ offset: number; context: DefinitionPreprocessorContext }> = [
    { offset: 0, context: { active: true, branches: [] } },
  ];
  const frames: DefinitionPreprocessorFrame[] = [];
  const macroDefined = new Map<string, boolean>();
  const macroValues = new Map<string, boolean>();
  const context = (): DefinitionPreprocessorContext => ({
    active: definitionPreprocessorFramesActive(frames),
    branches: frames.map((frame) => ({ key: frame.key, branch: frame.branch })),
  });
  const record = (offset: number): void => {
    snapshots.push({ offset, context: context() });
  };
  let lineStart = 0;
  while (lineStart <= masked.length) {
    const lineEnd = masked.indexOf('\n', lineStart);
    const end = lineEnd < 0 ? masked.length : lineEnd;
    const line = masked.slice(lineStart, end);
    const directive = /^\s*#\s*(if|ifdef|ifndef|elif|else|endif|define|undef)\b(.*)$/u.exec(line);
    if (directive !== null) {
      const kind = directive[1] ?? '';
      const rest = directive[2] ?? '';
      if (kind === 'if' || kind === 'ifdef' || kind === 'ifndef') {
        const name = rest.trim();
        const expression =
          kind === 'if' ? definitionPreprocessorExpression(rest) : `${kind === 'ifndef' ? '!' : ''}defined(${name})`;
        const parentActive = definitionPreprocessorFramesActive(frames);
        const active =
          parentActive === false ? false : definitionPreprocessorConditionValue(expression, macroDefined, macroValues);
        frames.push({
          key: expression,
          branch: 'if',
          active,
          taken: active === true ? true : active === undefined ? undefined : false,
        });
      } else if (kind === 'elif' && frames.length > 0) {
        const frame = frames[frames.length - 1];
        const expression = definitionPreprocessorExpression(rest);
        const parentActive = definitionPreprocessorFramesActive(frames.slice(0, -1));
        if (parentActive === false || frame.taken === true) {
          frame.active = false;
        } else {
          frame.active = definitionPreprocessorConditionValue(expression, macroDefined, macroValues);
          if (frame.active === true) frame.taken = true;
          else if (frame.active === undefined) frame.taken = undefined;
        }
        frame.branch = `elif:${expression}`;
      } else if (kind === 'else' && frames.length > 0) {
        const frame = frames[frames.length - 1];
        frame.active = frame.taken === true ? false : frame.taken === false ? true : undefined;
        frame.branch = 'else';
      } else if (kind === 'endif' && frames.length > 0) {
        frames.pop();
      } else if (kind === 'define' && definitionPreprocessorFramesActive(frames) === true) {
        const definition = /^\s*([A-Za-z_$][\w$]*)(?:\s+(.*))?\s*$/u.exec(rest);
        const name = definition?.[1] ?? '';
        if (name !== '') {
          macroDefined.set(name, true);
          const rawValue = definitionPreprocessorExpression(definition?.[2] ?? '');
          if (/^[+-]?\d+$/u.test(rawValue)) macroValues.set(name, Number(rawValue) !== 0);
          else macroValues.delete(name);
        }
      } else if (kind === 'undef' && definitionPreprocessorFramesActive(frames) === true) {
        const name = rest.trim().split(/\s+/u, 1)[0] ?? '';
        if (name !== '') {
          macroDefined.set(name, false);
          macroValues.delete(name);
        }
      }
      record(end + 1);
    }
    if (lineEnd < 0) break;
    lineStart = end + 1;
  }
  return (offset: number): DefinitionPreprocessorContext => {
    let low = 0;
    let high = snapshots.length - 1;
    let found = snapshots[0];
    while (low <= high) {
      const middle = Math.floor((low + high) / 2);
      const snapshot = snapshots[middle];
      if (snapshot.offset <= offset) {
        found = snapshot;
        low = middle + 1;
      } else {
        high = middle - 1;
      }
    }
    return found.context;
  };
}

function definitionPreprocessorBranchScore(
  definitionContext: DefinitionPreprocessorContext,
  callContext: DefinitionPreprocessorContext | undefined,
): number {
  if (callContext === undefined || callContext.active === false) return 0;
  const callBranches = new Map(callContext.branches.map((branch) => [branch.key, branch.branch]));
  let score = 0;
  for (const branch of definitionContext.branches) {
    const callBranch = callBranches.get(branch.key);
    if (callBranch === undefined) continue;
    score += callBranch === branch.branch ? 80 : -80;
  }
  return score;
}

function definitionActiveCIncludePaths(
  content: string,
  callPreprocessorContext?: DefinitionPreprocessorContext,
): Array<{ path: string; quoted: boolean; score: number; order: number }> {
  const preprocessorContextAt = definitionPreprocessorContextLookup(content);
  return cIncludePaths(content)
    .map((include, order) => {
      const context = preprocessorContextAt(include.offset);
      return {
        path: include.path,
        quoted: include.quoted,
        score: definitionPreprocessorBranchScore(context, callPreprocessorContext),
        order,
        active: context.active,
      };
    })
    .filter((include) => include.active !== false)
    .sort((left, right) => right.score - left.score || left.order - right.order)
    .map((include) => ({
      path: include.path,
      quoted: include.quoted,
      score: include.score,
      order: include.order,
    }));
}

interface DefinitionNamespaceScopeFrame {
  name: string;
  inline: boolean;
}

function definitionNamespaceFramesAtOffsets(
  masked: string,
  offsets: number[],
): Map<number, DefinitionNamespaceScopeFrame[]> {
  const scopes = new Map<number, DefinitionNamespaceScopeFrame[]>();
  const pending = [...new Set(offsets)].sort((left, right) => left - right);
  const frames: DefinitionNamespaceScopeFrame[] = [];
  let boundary = 0;
  let pendingIndex = 0;
  const recordPending = (through: number): void => {
    while (pendingIndex < pending.length && pending[pendingIndex] <= through) {
      scopes.set(
        pending[pendingIndex],
        frames.filter((frame) => frame.name !== ''),
      );
      pendingIndex += 1;
    }
  };
  for (let index = 0; index <= masked.length; index += 1) {
    recordPending(index);
    if (index === masked.length) break;
    const character = masked[index];
    if (character === '{') {
      const header = masked.slice(boundary, index);
      const match = /(?:^|[\s;{}])(?:(inline)\s+)?namespace(?:\s+([A-Za-z_$][\w$]*(?:::[A-Za-z_$][\w$]*)*))?\s*$/u.exec(
        header,
      );
      frames.push({ name: match?.[2] ?? '', inline: match?.[1] !== undefined });
      boundary = index + 1;
    } else if (character === '}') {
      frames.pop();
      boundary = index + 1;
    } else if (character === ';') {
      boundary = index + 1;
    }
  }
  return scopes;
}

function definitionNamespaceScopesAtOffsets(masked: string, offsets: number[]): Map<number, string[]> {
  return new Map(
    [...definitionNamespaceFramesAtOffsets(masked, offsets)].map(([offset, frames]) => [
      offset,
      frames.map((frame) => frame.name),
    ]),
  );
}

function definitionVisibleNamespaceScopesAtOffsets(masked: string, offsets: number[]): Map<number, string[]> {
  return new Map(
    [...definitionNamespaceFramesAtOffsets(masked, offsets)].map(([offset, frames]) => [
      offset,
      frames.filter((frame) => !frame.inline).map((frame) => frame.name),
    ]),
  );
}

function definitionTypeHierarchy(
  contents: string[],
  callPreprocessorContext?: DefinitionPreprocessorContext,
): Map<string, string[]> {
  const selected = new Map<string, { score: number; bases: string[]; owner: string; ambiguous: boolean }>();
  const registerDeclaration = (key: string, owner: string, score: number, bases: string[]): void => {
    const current = selected.get(key);
    if (current === undefined || score > current.score) {
      selected.set(key, { score, bases: [...new Set(bases)], owner, ambiguous: false });
      return;
    }
    if (score !== current.score) return;
    if (current.owner !== owner) {
      current.ambiguous = true;
      return;
    }
    current.bases = [...new Set([...current.bases, ...bases])];
  };
  for (const content of contents) {
    const masked = maskDefinitionCommentsAndStrings(content);
    const matches = [
      ...masked.matchAll(
        /(?:^|\n)[ \t]*(?:class|struct)\s+(?:[A-Za-z_$][\w$]*\s+)*([A-Za-z_$][\w$]*)(?:\s+final)?\s*:\s*([^{\n]+)\{/gu,
      ),
    ];
    const declarations = matches.map((match) => ({
      match,
      offset: match.index + Math.max(0, match[0].search(/\b(?:class|struct)\b/u)),
    }));
    const namespaceScopes = definitionNamespaceScopesAtOffsets(
      masked,
      declarations.map((declaration) => declaration.offset),
    );
    const visibleNamespaceScopes = definitionVisibleNamespaceScopesAtOffsets(
      masked,
      declarations.map((declaration) => declaration.offset),
    );
    const preprocessorContextAt = definitionPreprocessorContextLookup(content);
    for (const { match, offset } of declarations) {
      const preprocessorContext = preprocessorContextAt(offset);
      if (preprocessorContext.active === false) continue;
      const derivedType = match[1] ?? '';
      if (derivedType === '') continue;
      const namespaces = namespaceScopes.get(offset) ?? [];
      const visibleNamespaces = visibleNamespaceScopes.get(offset) ?? [];
      const derivedKey = [...namespaces, derivedType].join('::');
      const bases = splitTopLevelDefinitionItems(match[2] ?? '')
        .map((base) => {
          const unqualified = base.replace(/\b(?:public|protected|private|virtual)\b/gu, '').trim();
          const globalQualified = unqualified.startsWith('::');
          const normalized = unqualified.replace(/<[\s\S]*$/u, '').trim();
          if (normalized === '') return '';
          if (globalQualified) return normalized.replace(/^::/u, '');
          if (namespaces.length === 0) return normalized;
          return qualifyRelativeAliasTarget(normalized, namespaces.join('::'));
        })
        .filter((base) => base !== '' && base !== derivedKey && (base.split('::').at(-1) ?? '') !== derivedType);
      if (bases.length === 0) continue;
      const score = definitionPreprocessorBranchScore(preprocessorContext, callPreprocessorContext);
      registerDeclaration(derivedKey, derivedKey, score, bases);
      const visibleKey = [...visibleNamespaces, derivedType].join('::');
      if (visibleKey !== derivedKey) registerDeclaration(visibleKey, derivedKey, score, bases);
    }
  }
  return new Map(
    [...selected].filter(([, entry]) => !entry.ambiguous).map(([derivedType, entry]) => [derivedType, entry.bases]),
  );
}

function definitionBaseTypes(typeName: string, hierarchy: Map<string, string[]>): string[] {
  /* 真实继承链可能超过 4 层；同时限制深度和节点数，避免宽继承图失控。 */
  const maxDepth = 16;
  const maxTypes = 64;
  const bases: string[] = [];
  const canonicalTypeName = typeName.replace(/^::/u, '');
  const seen = new Set([canonicalTypeName]);
  let frontier = [canonicalTypeName];
  for (let depth = 0; depth < maxDepth && frontier.length > 0 && bases.length < maxTypes; depth += 1) {
    const next: string[] = [];
    for (const type of frontier) {
      const direct = hierarchy.get(type);
      const unambiguousQualified =
        direct === undefined && !type.includes('::')
          ? [...hierarchy.keys()].filter((key) => key.endsWith(`::${type}`))
          : [];
      const entries =
        direct ?? (unambiguousQualified.length === 1 ? hierarchy.get(unambiguousQualified[0]) : undefined) ?? [];
      for (const base of entries) {
        if (seen.has(base) || bases.length >= maxTypes) continue;
        seen.add(base);
        bases.push(base);
        next.push(base);
      }
    }
    frontier = next;
  }
  return bases;
}

function definitionArgumentScore(
  parameter: string,
  argument: string,
  argumentType: string,
  argumentBaseTypes: string[],
): number {
  const value = argument.trim();
  if (/^(?:u8|L|u|U)?"(?:\\.|[^"\\])*"$/u.test(value)) {
    if (/\b(?:const\s+)?(?:char|wchar_t)\s*\*/u.test(parameter)) return 50;
    if (/\b(?:std::)?string\b/u.test(parameter)) return 40;
    if (/\bFILE\s*\*/u.test(parameter)) return 10;
    if (/\bDataReader\b/u.test(parameter)) return -20;
    if (/\bunsigned\s+char\s*\*/u.test(parameter)) return -30;
  }
  if (/^[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][-+]?\d+)?[fFlLuU]*$/u.test(value)) {
    if (/\b(?:int|long|short|size_t|float|double)\b/u.test(parameter)) return 30;
  }
  if (value === 'true' || value === 'false') {
    if (/\bbool\b/u.test(parameter)) return 30;
  }
  if (value === 'nullptr' || value === 'NULL') {
    if (/\*/u.test(parameter)) return /\bvoid\s*\*/u.test(parameter) ? 8 : 20;
  }
  if (argumentType !== '') {
    const argumentLeafType = argumentType.split('::').at(-1) ?? argumentType;
    const escaped = escapeDefinitionRegex(argumentLeafType);
    if (new RegExp(String.raw`\b${escaped}\b`, 'u').test(parameter)) return 45;
    if (
      argumentBaseTypes.some((baseType) => {
        const escapedBase = escapeDefinitionRegex(baseType.split('::').at(-1) ?? baseType);
        return new RegExp(String.raw`\b${escapedBase}\b`, 'u').test(parameter);
      })
    ) {
      return 40;
    }
    const baseType = [...parameter.matchAll(/\b[A-Z_][A-Za-z0-9_$]{3,}\b/gu)].some((match) =>
      argumentLeafType.startsWith(match[0]),
    );
    if (baseType) return 35;
    if (parameter.includes(argumentLeafType)) return 25;
  }
  return 0;
}

function definitionParameterHasDefault(parameter: string): boolean {
  let depth = 0;
  let quote = '';
  for (let index = 0; index < parameter.length; index += 1) {
    const character = parameter[index];
    if (quote !== '') {
      if (character === '\\') index += 1;
      else if (character === quote) quote = '';
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
      continue;
    }
    if (character === '(' || character === '[' || character === '{' || character === '<') depth += 1;
    else if (character === ')' || character === ']' || character === '}' || character === '>')
      depth = Math.max(0, depth - 1);
    else if (character === '=' && depth === 0) return true;
  }
  return false;
}

function definitionParameterIsVariadic(parameter: string): boolean {
  return /^\s*\.\.\.\s*$/u.test(parameter);
}

function findCFamilyOverloadInText(
  source: string,
  name: string,
  path: string,
  callArguments: string[],
  callArgumentTypes: string[],
  callArgumentBaseTypes: string[][],
  callPreprocessorContext?: DefinitionPreprocessorContext,
  targetKind: DefinitionTargetKind = 'declaration',
  receiverTypes: string[] = [],
  receiverSignature = '',
): DefinitionLocation | null {
  const candidates: Array<{
    location: DefinitionLocation;
    score: number;
    index: number;
    declarationOnly: boolean;
    receiverQualified: boolean;
  }> = [];
  const seen = new Set<number>();
  const preprocessorContextAt = definitionPreprocessorContextLookup(source);
  const classRanges =
    receiverTypes.length > 0 && targetKind === 'implementation'
      ? definitionClassRanges(maskDefinitionCommentsAndStrings(source))
      : [];
  for (const regex of definitionRegexes(path, name)) {
    regex.lastIndex = 0;
    for (const match of source.matchAll(regex)) {
      const text = match[0];
      const localOffset = text.lastIndexOf(name);
      if (localOffset < 0) continue;
      const offset = match.index + localOffset;
      const qualifiedReceiver = definitionQualifiedReceiverBefore(text.slice(0, localOffset));
      const receiverQualified = receiverTypes.length > 0 && qualifiedReceiver !== '';
      const canonicalQualifiedReceiver = stripDefinitionTemplateArguments(qualifiedReceiver).replace(/^::/u, '');
      const canonicalQualifiedReceiverWithArguments = qualifiedReceiver.replace(/\s+/gu, '').replace(/^::/u, '');
      if (receiverTypes.length > 0) {
        const receiverMatches = receiverTypes.some((receiverType) => {
          const canonicalReceiver = receiverType.replace(/^::/u, '');
          if (!canonicalQualifiedReceiver.includes('::')) {
            return (canonicalReceiver.split('::').at(-1) ?? canonicalReceiver) === canonicalQualifiedReceiver;
          }
          return canonicalReceiver === canonicalQualifiedReceiver || !canonicalReceiver.includes('::');
        });
        if (qualifiedReceiver !== '') {
          if (!receiverMatches) continue;
        } else if (targetKind === 'implementation') {
          const enclosingClass = definitionEnclosingClassName(classRanges, offset);
          if (
            enclosingClass === '' ||
            !receiverTypes.some((receiverType) => (receiverType.split('::').at(-1) ?? receiverType) === enclosingClass)
          ) {
            continue;
          }
        }
      }
      let specializationScore = 0;
      if (receiverSignature.includes('<') && canonicalQualifiedReceiverWithArguments.includes('<')) {
        if (canonicalQualifiedReceiverWithArguments === receiverSignature.replace(/^::/u, '')) {
          specializationScore = 40;
        } else {
          const templateArguments = definitionReceiverTemplateArguments(canonicalQualifiedReceiverWithArguments);
          const templateParameters = definitionTemplateParameterNamesAt(source, offset);
          const generic =
            templateArguments.some((argument) =>
              definitionTemplateArgumentReferences(argument, templateParameters.names),
            ) ||
            (!templateParameters.declared &&
              templateArguments.some((argument) => /^(?:typename\s+)?[A-Z]$/u.test(argument)));
          if (templateParameters.declared && !generic) continue;
          specializationScore = generic ? -5 : -20;
        }
      }
      if (seen.has(offset)) continue;
      const definitionPreprocessorContext = preprocessorContextAt(offset);
      if (definitionPreprocessorContext.active === false) continue;
      const open = text.indexOf('(', localOffset + name.length);
      if (open < 0 || text.slice(localOffset + name.length, open).trim() !== '') continue;
      const close = matchingDefinitionBrace(text, open, '(', ')');
      if (close < 0) continue;
      const parameters = splitTopLevelDefinitionItems(text.slice(open + 1, close));
      const variadic = parameters.some((parameter) => definitionParameterIsVariadic(parameter));
      const declarationOnly = !text.slice(close + 1).includes('{');
      const requiredParameterCount = parameters.filter(
        (parameter) => !definitionParameterHasDefault(parameter) && !definitionParameterIsVariadic(parameter),
      ).length;
      const arityCompatible =
        callArguments.length >= requiredParameterCount && (variadic || callArguments.length <= parameters.length);
      let score = arityCompatible
        ? 1000 + (variadic ? 0 : 10) + (!variadic && callArguments.length === parameters.length ? 20 : 0)
        : -Math.abs(parameters.length - callArguments.length) * 100;
      if (targetKind === 'implementation') score += declarationOnly ? -5 : 5;
      else if (declarationOnly) score += 5;
      score += specializationScore;
      const declaredArgumentCount = variadic ? Math.max(0, parameters.length - 1) : parameters.length;
      for (let index = 0; index < Math.min(declaredArgumentCount, callArguments.length); index += 1) {
        score += definitionArgumentScore(
          parameters[index] ?? '',
          callArguments[index] ?? '',
          callArgumentTypes[index] ?? '',
          callArgumentBaseTypes[index] ?? [],
        );
      }
      const lineStart = source.lastIndexOf('\n', offset) + 1;
      const prefix = source.slice(lineStart, offset).trimStart();
      if (/^(?:\/\/|#|\*|--)/u.test(prefix)) continue;
      score += definitionPreprocessorBranchScore(definitionPreprocessorContext, callPreprocessorContext);
      const position = definitionPositionAtOffset(source, offset);
      seen.add(offset);
      candidates.push({
        location: {
          path,
          line: position.line,
          column: position.column,
          endColumn: position.column + name.length,
        },
        score,
        index: offset,
        declarationOnly,
        receiverQualified,
      });
    }
  }
  const selectable =
    targetKind === 'implementation' ? candidates.filter((candidate) => !candidate.declarationOnly) : candidates;
  selectable.sort(
    (left, right) =>
      (targetKind === 'implementation' ? Number(right.receiverQualified) - Number(left.receiverQualified) : 0) ||
      right.score - left.score ||
      left.index - right.index,
  );
  return selectable[0]?.location ?? null;
}

function definitionTargetKindScore(text: string, name: string, targetKind: DefinitionTargetKind): number {
  if (targetKind === 'declaration') return 0;
  const localOffset = text.lastIndexOf(name);
  if (localOffset < 0) return 0;
  const open = text.indexOf('(', localOffset + name.length);
  if (open < 0) return 0;
  const close = matchingDefinitionBrace(text, open, '(', ')');
  if (close < 0) return 0;
  return text.slice(close + 1).includes('{') ? 10 : -10;
}

/** Find the first declaration-like identifier occurrence in one document. */
export function findDefinitionInText(
  content: unknown,
  symbol: unknown,
  path: string,
  callArguments?: unknown,
  callArgumentTypes?: unknown,
  callArgumentBaseTypes?: unknown,
  callPreprocessorContext?: DefinitionPreprocessorContext,
  targetKind: DefinitionTargetKind = 'declaration',
  receiverTypes?: unknown,
  receiverSignature?: unknown,
): DefinitionLocation | null {
  const source = String(content ?? '');
  const name = String(symbol ?? '');
  if (source === '' || name === '') return null;
  if (Array.isArray(callArguments) && ['c', 'h', 'cc', 'cpp', 'cxx', 'hpp'].includes(navigationExtension(path))) {
    const overload = findCFamilyOverloadInText(
      source,
      name,
      path,
      callArguments.map((argument) => String(argument)),
      Array.isArray(callArgumentTypes) ? callArgumentTypes.map((argumentType) => String(argumentType)) : [],
      Array.isArray(callArgumentBaseTypes)
        ? callArgumentBaseTypes.map((baseTypes) =>
            Array.isArray(baseTypes) ? baseTypes.map((baseType) => String(baseType)) : [],
          )
        : [],
      callPreprocessorContext,
      targetKind,
      Array.isArray(receiverTypes) ? receiverTypes.map((receiverType) => String(receiverType)) : [],
      String(receiverSignature ?? ''),
    );
    if (overload !== null) return overload;
  }
  const isCFamily = ['c', 'h', 'cc', 'cpp', 'cxx', 'hpp'].includes(navigationExtension(path));
  const preprocessorContextAt = isCFamily ? definitionPreprocessorContextLookup(source) : null;
  const conditionalCandidates: Array<{ location: DefinitionLocation; score: number; index: number }> = [];
  const seen = new Set<number>();
  for (const regex of definitionRegexes(path, name)) {
    regex.lastIndex = 0;
    for (const match of source.matchAll(regex)) {
      const text = match[0];
      const localOffset = text.lastIndexOf(name);
      if (localOffset < 0) continue;
      const offset = match.index + localOffset;
      if (seen.has(offset)) continue;
      const lineStart = source.lastIndexOf('\n', offset) + 1;
      const prefix = source.slice(lineStart, offset).trimStart();
      if (/^(?:\/\/|#|\*|--)/u.test(prefix)) continue;
      const position = definitionPositionAtOffset(source, offset);
      const location = {
        path,
        line: position.line,
        column: position.column,
        endColumn: position.column + name.length,
      };
      if (preprocessorContextAt === null) return location;
      const definitionPreprocessorContext = preprocessorContextAt(offset);
      if (definitionPreprocessorContext.active === false) continue;
      seen.add(offset);
      const kindScore = definitionTargetKindScore(text, name, targetKind);
      if (kindScore < 0) continue;
      conditionalCandidates.push({
        location,
        score: definitionPreprocessorBranchScore(definitionPreprocessorContext, callPreprocessorContext) + kindScore,
        index: offset,
      });
    }
  }
  conditionalCandidates.sort((left, right) => right.score - left.score || left.index - right.index);
  if (conditionalCandidates.length > 0) return conditionalCandidates[0].location;
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
  targetKind: DefinitionTargetKind = 'declaration',
): T[] {
  const sourceDirectory = navigationDirname(sourcePath);
  const sourceExtension = navigationExtension(sourcePath);
  const cFamilySource = ['c', 'h', 'cc', 'cpp', 'cxx', 'hpp'].includes(sourceExtension);
  const cHeaderExtensions = new Set(['h', 'hh', 'hpp', 'hxx', 'inl']);
  return [...(Array.isArray(matches) ? matches : [])]
    .map((match: T, index: number) => {
      const path = typeof match?.path === 'string' ? match.path : '';
      const sameDirectory = navigationDirname(path) === sourceDirectory;
      const sameExtension = navigationExtension(path) === sourceExtension;
      const cHeader = cFamilySource && cHeaderExtensions.has(navigationExtension(path));
      const cImplementation = cFamilySource && !cHeaderExtensions.has(navigationExtension(path));
      return {
        match,
        index,
        score:
          (sameDirectory ? 4 : 0) +
          (sameExtension ? 2 : 0) +
          (targetKind === 'implementation' ? (cImplementation ? 12 : 0) : cHeader ? 8 : 0),
      };
    })
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .map((entry) => entry.match);
}

function definitionTypeCandidateScore(
  content: string,
  typeName: string,
  callPreprocessorContext?: DefinitionPreprocessorContext,
): number | null {
  if (typeName === '') return null;
  const globalQualified = typeName.startsWith('::');
  const normalizedType = typeName.replace(/^::/u, '');
  const qualifierEnd = normalizedType.lastIndexOf('::');
  const qualifier = qualifierEnd < 0 ? '' : normalizedType.slice(0, qualifierEnd);
  const leafType = qualifierEnd < 0 ? normalizedType : normalizedType.slice(qualifierEnd + 2);
  const escaped = escapeDefinitionRegex(leafType);
  const bodyDeclaration = new RegExp(
    String.raw`\b(?:class|struct|union|enum|interface|trait|protocol|record)(?:\s+[A-Za-z_$][\w$]*)*\s+${escaped}(?:\s+final)?(?:\s*:[^{;\n]+)?\s*\{`,
    'gu',
  );
  const masked = maskDefinitionCommentsAndStrings(content);
  const matches = [...masked.matchAll(bodyDeclaration)];
  const namespaces = definitionNamespaceScopesAtOffsets(
    masked,
    matches.map((match) => match.index),
  );
  const visibleNamespaces = definitionVisibleNamespaceScopesAtOffsets(
    masked,
    matches.map((match) => match.index),
  );
  const preprocessorContextAt = definitionPreprocessorContextLookup(content);
  let bestScore: number | null = null;
  for (const match of matches) {
    const preprocessorContext = preprocessorContextAt(match.index);
    if (preprocessorContext.active === false) continue;
    if (qualifier !== '' || globalQualified) {
      const scope = (namespaces.get(match.index) ?? []).join('::');
      const visibleScope = (visibleNamespaces.get(match.index) ?? []).join('::');
      const scopeMatches = [scope, visibleScope].some((candidateScope) =>
        globalQualified
          ? candidateScope === qualifier
          : candidateScope === qualifier || candidateScope.endsWith(`::${qualifier}`),
      );
      if (!scopeMatches) {
        continue;
      }
    }
    const score = definitionPreprocessorBranchScore(preprocessorContext, callPreprocessorContext);
    bestScore = bestScore === null ? score : Math.max(bestScore, score);
  }
  if (bestScore !== null) return bestScore;
  if (qualifier === '' && !globalQualified) {
    return new RegExp(String.raw`\btype\s+${escaped}\b`, 'u').test(content) ? 0 : null;
  }
  return null;
}

async function definitionExpandedIncludeCandidates(
  initial: Array<{
    candidate: DefinitionLanguageCandidate;
    targetContent: string;
  }>,
  symbol: string,
  readFile: DefinitionSearchInput['readFile'],
  resolvePathIdentities?: DefinitionSearchInput['pathIdentities'],
  callPreprocessorContext?: DefinitionPreprocessorContext,
): Promise<
  Array<{
    candidate: DefinitionLanguageCandidate;
    targetContent: string;
  }>
> {
  const expanded: Array<{
    candidate: DefinitionLanguageCandidate;
    targetContent: string;
  }> = [];
  const initialIdentities = await definitionCandidateIdentityKeys(
    initial.map((entry) => entry.candidate.path),
    resolvePathIdentities,
  );
  const seen = new Set(initialIdentities.values());
  let frontier = initial.slice(0, 16);
  let readAttempts = 0;
  for (let depth = 0; depth < 2 && frontier.length > 0 && expanded.length < 24 && readAttempts < 48; depth += 1) {
    const next: typeof frontier = [];
    const groups = frontier.flatMap((entry) =>
      ['c', 'h', 'cc', 'cpp', 'cxx', 'hpp'].includes(navigationExtension(entry.candidate.path))
        ? cIncludeCandidateGroups(entry.candidate.path, entry.targetContent, callPreprocessorContext).map((group) => ({
            entry,
            group,
          }))
        : [],
    );
    const identities = await definitionCandidateIdentityKeys(
      groups.flatMap(({ group }) => group.paths),
      resolvePathIdentities,
    );
    for (const { group } of groups) {
      for (const path of group.paths) {
        if (expanded.length >= 24 || readAttempts >= 48) break;
        const key = identities.get(path) ?? path;
        if (path === '' || seen.has(key)) continue;
        seen.add(key);
        readAttempts += 1;
        const targetContent = await readFile(path).catch((): null => null);
        if (typeof targetContent !== 'string') continue;
        const prepared = { candidate: { path, symbol }, targetContent };
        expanded.push(prepared);
        next.push(prepared);
        break;
      }
      if (expanded.length >= 24 || readAttempts >= 48) break;
    }
    frontier = next.slice(0, 32);
  }
  return expanded;
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
  receiverType,
  callOffset,
  targetKind = 'declaration',
  readFile,
  pathIdentities,
  searchText,
}: DefinitionSearchInput): Promise<DefinitionLocation | null> {
  const name = String(symbol ?? '').trim();
  const sourcePath = normalizeNavigationPath(path);
  if (name === '' || sourcePath === '' || typeof readFile !== 'function') return null;
  const callArguments = callOffset === undefined ? undefined : definitionCallArgumentsAt(content, callOffset, name);
  const receiverSignature = callOffset === undefined ? '' : definitionReceiverSignatureAt(content, callOffset, name);
  const callPreprocessorContext =
    callOffset === undefined
      ? undefined
      : definitionPreprocessorContextLookup(String(content ?? ''))(
          Math.max(0, Math.min(String(content ?? '').length, Number(callOffset) || 0)),
        );
  const callArgumentTypes =
    callArguments === undefined
      ? undefined
      : callArguments.map((argument) => definitionIdentifierTypeAt(content, callOffset, argument));
  const initialHierarchy = definitionTypeHierarchy([String(content ?? '')], callPreprocessorContext);
  const initialCallArgumentBaseTypes =
    callArgumentTypes?.map((argumentType) => definitionBaseTypes(argumentType, initialHierarchy)) ?? undefined;

  const local = findDefinitionInText(
    content,
    name,
    sourcePath,
    callArguments,
    callArgumentTypes,
    initialCallArgumentBaseTypes,
    callPreprocessorContext,
    targetKind,
  );
  if (local !== null) return local;

  const imported = definitionImportTarget(content, name);
  if (imported !== null) {
    const importedCandidates = definitionModuleCandidates(sourcePath, imported.specifier, imported.language);
    const importedIdentities = await definitionCandidateIdentityKeys(importedCandidates, pathIdentities);
    const attemptedImportedCandidates = new Set<string>();
    for (const candidate of importedCandidates) {
      const candidateKey = importedIdentities.get(candidate) ?? candidate;
      if (attemptedImportedCandidates.has(candidateKey)) continue;
      attemptedImportedCandidates.add(candidateKey);
      const targetContent = await readFile(candidate).catch((): null => null);
      if (typeof targetContent !== 'string') continue;
      const importedName = imported.importedName === '*' ? '' : imported.importedName;
      const found =
        importedName === 'default'
          ? null
          : findDefinitionInText(
              targetContent,
              importedName || name,
              candidate,
              callArguments,
              callArgumentTypes,
              initialCallArgumentBaseTypes,
              callPreprocessorContext,
              targetKind,
            );
      if (found !== null) return found;
      if (imported.kind === 'module' || imported.kind === 'namespace' || imported.kind === 'default') {
        return { path: candidate, line: 1, column: 1, endColumn: 1 };
      }
    }
  }

  const preferredType = String(receiverType ?? '').trim();
  const languageCandidates = definitionLanguageCandidates(content, sourcePath, name);
  const preparedCandidates: Array<{
    candidate: DefinitionLanguageCandidate;
    targetContent: string;
  }> = [];
  const extension = navigationExtension(sourcePath);
  if (['c', 'h', 'cc', 'cpp', 'cxx', 'hpp'].includes(extension)) {
    let readAttempts = 0;
    const groups = cIncludeCandidateGroups(sourcePath, String(content ?? ''), callPreprocessorContext);
    const initialGroups =
      preferredType !== '' && groups.some((group) => group.quoted) ? groups.filter((group) => group.quoted) : groups;
    const candidateIdentities = await definitionCandidateIdentityKeys(
      [sourcePath, ...initialGroups.flatMap((group) => group.paths).slice(0, 96)],
      pathIdentities,
    );
    const attemptedPaths = new Set([candidateIdentities.get(sourcePath) ?? sourcePath]);
    for (const group of initialGroups) {
      for (const path of group.paths) {
        if (readAttempts >= 96) break;
        const normalizedPath = normalizeNavigationPath(path);
        const candidateKey = candidateIdentities.get(normalizedPath) ?? normalizedPath;
        if (normalizedPath === '' || attemptedPaths.has(candidateKey)) continue;
        attemptedPaths.add(candidateKey);
        readAttempts += 1;
        const targetContent = await readFile(normalizedPath).catch((): null => null);
        if (typeof targetContent !== 'string') continue;
        preparedCandidates.push({ candidate: { path: normalizedPath, symbol: name }, targetContent });
        break;
      }
      if (readAttempts >= 96) break;
    }
  } else {
    const languageCandidateIdentities = await definitionCandidateIdentityKeys(
      languageCandidates.map((candidate) => candidate.path),
      pathIdentities,
    );
    const attemptedLanguageCandidates = new Set<string>();
    for (const candidate of languageCandidates) {
      const candidateKey = languageCandidateIdentities.get(candidate.path) ?? candidate.path;
      if (attemptedLanguageCandidates.has(candidateKey)) continue;
      attemptedLanguageCandidates.add(candidateKey);
      const targetContent = await readFile(candidate.path).catch((): null => null);
      if (typeof targetContent !== 'string') continue;
      preparedCandidates.push({ candidate, targetContent });
    }
  }
  const preparedHierarchy = definitionTypeHierarchy(
    [String(content ?? ''), ...preparedCandidates.map((entry) => entry.targetContent)],
    callPreprocessorContext,
  );
  let callArgumentBaseTypes =
    callArgumentTypes?.map((argumentType) => definitionBaseTypes(argumentType, preparedHierarchy)) ?? undefined;
  const preferredTypeSources = [
    {
      content: String(content ?? ''),
      maxOffset:
        callOffset === undefined
          ? undefined
          : Math.max(0, Math.min(String(content ?? '').length, Number(callOffset) || 0)),
    },
    ...preparedCandidates.map((entry) => ({ content: entry.targetContent })),
  ];
  const resolvePreferredTypeNames = (): string[] => {
    if (preferredType === '') return [];
    const aliasResolution = definitionReceiverAliasResolution(preferredTypeSources, preferredType, true);
    if (!aliasResolution.matched) return [preferredType];
    return aliasResolution.typeName === '' ? [] : [aliasResolution.typeName];
  };
  let preferredTypeNames = resolvePreferredTypeNames();
  const rankPreferredCandidates = (entries: typeof preparedCandidates) =>
    entries
      .map((entry, index) => {
        const typeScores = preferredTypeNames
          .map((typeName) => definitionTypeCandidateScore(entry.targetContent, typeName, callPreprocessorContext))
          .filter((score) => score !== null);
        return {
          entry,
          index,
          typeScore: typeScores.length === 0 ? null : Math.max(...typeScores),
        };
      })
      .filter(
        (candidate) =>
          candidate.typeScore !== null &&
          findDefinitionInText(
            candidate.entry.targetContent,
            name,
            candidate.entry.candidate.path,
            callArguments,
            callArgumentTypes,
            callArgumentBaseTypes,
            callPreprocessorContext,
            targetKind,
            preferredTypeNames,
            receiverSignature,
          ) !== null,
      )
      .sort((left, right) => Number(right.typeScore) - Number(left.typeScore) || left.index - right.index)
      .map((candidate) => candidate.entry);
  let preferredCandidates = rankPreferredCandidates(preparedCandidates);
  let expandedCandidates: typeof preparedCandidates = [];
  if (preferredTypeNames.length > 0 && preferredCandidates.length === 0) {
    expandedCandidates = await definitionExpandedIncludeCandidates(
      preparedCandidates,
      name,
      readFile,
      pathIdentities,
      callPreprocessorContext,
    );
    const expandedHierarchy = definitionTypeHierarchy(
      [
        String(content ?? ''),
        ...preparedCandidates.map((entry) => entry.targetContent),
        ...expandedCandidates.map((entry) => entry.targetContent),
      ],
      callPreprocessorContext,
    );
    callArgumentBaseTypes =
      callArgumentTypes?.map((argumentType) => definitionBaseTypes(argumentType, expandedHierarchy)) ?? undefined;
    preferredTypeSources.push(...expandedCandidates.map((entry) => ({ content: entry.targetContent })));
    preferredTypeNames = resolvePreferredTypeNames();
    preferredCandidates = rankPreferredCandidates(expandedCandidates);
  }
  let navigableCandidates = [...preparedCandidates, ...expandedCandidates];
  if (targetKind === 'implementation' && ['c', 'h', 'cc', 'cpp', 'cxx', 'hpp'].includes(extension)) {
    navigableCandidates = await definitionImplementationSiblingCandidates(
      navigableCandidates,
      name,
      readFile,
      pathIdentities,
    );
  }
  const compatibleCandidates =
    targetKind === 'implementation' && preferredTypeNames.length > 0
      ? navigableCandidates.filter((entry) =>
          definitionImplementationReceiverCompatible(entry.targetContent, name, preferredTypeNames),
        )
      : navigableCandidates;
  const fallbackCandidates =
    preferredCandidates.length === 0
      ? compatibleCandidates
      : compatibleCandidates.filter((entry) => !preferredCandidates.includes(entry));
  for (const { candidate, targetContent } of [...preferredCandidates, ...fallbackCandidates]) {
    if (candidate.line !== undefined) {
      const line = Math.max(1, Math.floor(Number(candidate.line) || 1));
      const column = Math.max(1, Math.floor(Number(candidate.column) || 1));
      return { path: candidate.path, line, column, endColumn: column };
    }
    const found = findDefinitionInText(
      targetContent,
      candidate.symbol ?? name,
      candidate.path,
      callArguments,
      callArgumentTypes,
      callArgumentBaseTypes,
      callPreprocessorContext,
      targetKind,
      preferredTypeNames,
      receiverSignature,
    );
    if (found !== null) return found;
  }

  if (navigationExtension(sourcePath) === 'rs') {
    const rustCandidates = await rustReexportModuleCandidates(sourcePath, String(content ?? ''), name, readFile);
    const rustIdentities = await definitionCandidateIdentityKeys(rustCandidates, pathIdentities);
    const attemptedRustCandidates = new Set<string>();
    for (const candidate of rustCandidates) {
      const candidateKey = rustIdentities.get(candidate) ?? candidate;
      if (attemptedRustCandidates.has(candidateKey)) continue;
      attemptedRustCandidates.add(candidateKey);
      const targetContent = await readFile(candidate).catch((): null => null);
      if (typeof targetContent !== 'string') continue;
      const found = findDefinitionInText(
        targetContent,
        name,
        candidate,
        callArguments,
        callArgumentTypes,
        callArgumentBaseTypes,
        callPreprocessorContext,
        targetKind,
        preferredTypeNames,
        receiverSignature,
      );
      if (found !== null) return found;
    }
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
    const rankedMatches = rankDefinitionSearchMatches(matches, sourcePath, targetKind);
    const searchedIdentities = await definitionCandidateIdentityKeys(
      rankedMatches.map((match) => normalizeNavigationPath(match?.path)),
      pathIdentities,
    );
    for (const match of rankedMatches) {
      const candidate = normalizeNavigationPath(match?.path);
      const candidateKey = searchedIdentities.get(candidate) ?? candidate;
      if (candidate === '' || candidate === sourcePath || searchedPaths.has(candidateKey)) continue;
      searchedPaths.add(candidateKey);
      const targetContent = await readFile(candidate).catch((): null => null);
      if (typeof targetContent !== 'string') continue;
      if (
        targetKind === 'implementation' &&
        ['c', 'h', 'cc', 'cpp', 'cxx', 'hpp'].includes(navigationExtension(candidate)) &&
        !definitionImplementationReceiverCompatible(targetContent, name, preferredTypeNames)
      ) {
        continue;
      }
      const found = findDefinitionInText(
        targetContent,
        name,
        candidate,
        callArguments,
        callArgumentTypes,
        callArgumentBaseTypes,
        callPreprocessorContext,
        targetKind,
        preferredTypeNames,
        receiverSignature,
      );
      if (found !== null) return found;
    }
  }
  return null;
}
