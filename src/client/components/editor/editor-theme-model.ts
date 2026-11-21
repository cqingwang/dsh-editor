import type * as Monaco from 'monaco-editor';

/** IntelliJ IDEA 2026.2 Light semantic palette, sourced from Default.icls + JS defaults. */
export const IDEA_LIGHT_THEME_ID = 'dsh-editor-idea-light';

export const IDEA_LIGHT_TOKEN_COLORS = {
  keyword: '000080',
  string: '008000',
  number: '0000ff',
  comment: '808080',
  localVariable: '458383',
  globalVariable: '660e7a',
  method: '914c07',
  function: '000000',
  property: '660e7a',
  constant: '660e7a',
  class: '660e7a',
  interface: '660e7a',
  enum: '660e7a',
  typeAlias: '660e7a',
  typeParameter: '20999d',
  parameter: '000000',
  annotation: '808000',
  jsxComponent: 'b21dbf',
  regexp: 'ff0000',
  escape: '000080',
} as const;

export const IDEA_LIGHT_SEMANTIC_TOKEN_TYPES = [
  'ideaClass',
  'ideaInterface',
  'ideaEnum',
  'ideaTypeAlias',
  'ideaModule',
  'ideaTypeParameter',
  'ideaParameter',
  'ideaFunction',
  'ideaMethod',
  'ideaProperty',
  'ideaVariable',
  'ideaGlobalVariable',
  'ideaConstant',
  'ideaJsxComponent',
  'ideaAnnotation',
] as const;

export const IDEA_LIGHT_SEMANTIC_TOKEN_CLASS = {
  ideaClass: 'dsh-idea-token-class',
  ideaInterface: 'dsh-idea-token-interface',
  ideaEnum: 'dsh-idea-token-enum',
  ideaTypeAlias: 'dsh-idea-token-type-alias',
  ideaModule: 'dsh-idea-token-module',
  ideaTypeParameter: 'dsh-idea-token-type-parameter',
  ideaParameter: 'dsh-idea-token-parameter',
  ideaFunction: 'dsh-idea-token-function',
  ideaMethod: 'dsh-idea-token-method',
  ideaProperty: 'dsh-idea-token-property',
  ideaVariable: 'dsh-idea-token-variable',
  ideaGlobalVariable: 'dsh-idea-token-global-variable',
  ideaConstant: 'dsh-idea-token-constant',
  ideaJsxComponent: 'dsh-idea-token-jsx-component',
  ideaAnnotation: 'dsh-idea-token-annotation',
} as const;

/** CSS rules shared by Monaco decorations and lightweight preview semantic spans. */
export function ideaLightSemanticDecorationRules(): string[] {
  const colors = IDEA_LIGHT_TOKEN_COLORS;
  return Object.entries({
    [IDEA_LIGHT_SEMANTIC_TOKEN_CLASS.ideaClass]: { color: colors.class },
    [IDEA_LIGHT_SEMANTIC_TOKEN_CLASS.ideaInterface]: { color: colors.interface },
    [IDEA_LIGHT_SEMANTIC_TOKEN_CLASS.ideaEnum]: { color: colors.enum },
    [IDEA_LIGHT_SEMANTIC_TOKEN_CLASS.ideaTypeAlias]: { color: colors.typeAlias },
    [IDEA_LIGHT_SEMANTIC_TOKEN_CLASS.ideaModule]: { color: colors.class },
    [IDEA_LIGHT_SEMANTIC_TOKEN_CLASS.ideaTypeParameter]: { color: colors.typeParameter },
    [IDEA_LIGHT_SEMANTIC_TOKEN_CLASS.ideaParameter]: { color: colors.parameter },
    [IDEA_LIGHT_SEMANTIC_TOKEN_CLASS.ideaFunction]: {
      color: colors.function,
      fontStyle: 'italic',
    },
    [IDEA_LIGHT_SEMANTIC_TOKEN_CLASS.ideaMethod]: { color: colors.method },
    [IDEA_LIGHT_SEMANTIC_TOKEN_CLASS.ideaProperty]: { color: colors.property },
    [IDEA_LIGHT_SEMANTIC_TOKEN_CLASS.ideaVariable]: { color: colors.localVariable },
    [IDEA_LIGHT_SEMANTIC_TOKEN_CLASS.ideaGlobalVariable]: {
      color: colors.globalVariable,
      fontStyle: 'italic',
    },
    [IDEA_LIGHT_SEMANTIC_TOKEN_CLASS.ideaConstant]: { color: colors.constant },
    [IDEA_LIGHT_SEMANTIC_TOKEN_CLASS.ideaJsxComponent]: { color: colors.jsxComponent },
    [IDEA_LIGHT_SEMANTIC_TOKEN_CLASS.ideaAnnotation]: { color: colors.annotation },
  }).map(
    ([className, style]) =>
      `.monaco-editor .${className} { color: #${style.color} !important; font-style: ${style.fontStyle ?? 'normal'}; }`,
  );
}

export const IDEA_LIGHT_SEMANTIC_TOKEN_LEGEND = {
  tokenTypes: [...IDEA_LIGHT_SEMANTIC_TOKEN_TYPES],
  tokenModifiers: [] as string[],
};

export interface IdeaLightSemanticToken {
  line: number;
  startCharacter: number;
  length: number;
  tokenType: number | string;
  tokenModifiers?: number;
  priority?: number;
}

/** One source palette shared by the editor, diff and repository preview themes. */
export function ideaLightTokenRules(): Monaco.editor.ITokenThemeRule[] {
  const colors = IDEA_LIGHT_TOKEN_COLORS;
  return [
    { token: 'keyword', foreground: colors.keyword },
    { token: 'keyword.control', foreground: colors.keyword },
    { token: 'string', foreground: colors.string },
    { token: 'string.escape', foreground: colors.escape },
    { token: 'number', foreground: colors.number },
    { token: 'comment', foreground: colors.comment, fontStyle: 'italic' },
    { token: 'comment.doc', foreground: colors.comment, fontStyle: 'italic' },
    { token: 'regexp', foreground: colors.regexp },
    { token: 'type.identifier', foreground: colors.class },
    { token: 'identifier', foreground: colors.parameter },
    { token: 'operator', foreground: colors.parameter },
    { token: 'delimiter', foreground: colors.parameter },
    { token: 'annotation', foreground: colors.annotation },
    { token: 'decorator', foreground: colors.annotation },
    { token: 'ideaClass', foreground: colors.class },
    { token: 'ideaInterface', foreground: colors.interface },
    { token: 'ideaEnum', foreground: colors.enum },
    { token: 'ideaTypeAlias', foreground: colors.typeAlias },
    { token: 'ideaModule', foreground: colors.class },
    { token: 'ideaTypeParameter', foreground: colors.typeParameter },
    { token: 'ideaParameter', foreground: colors.parameter },
    { token: 'ideaFunction', foreground: colors.function, fontStyle: 'italic' },
    { token: 'ideaMethod', foreground: colors.method },
    { token: 'ideaProperty', foreground: colors.property },
    { token: 'ideaVariable', foreground: colors.localVariable },
    { token: 'ideaGlobalVariable', foreground: colors.globalVariable, fontStyle: 'italic' },
    { token: 'ideaConstant', foreground: colors.constant },
    { token: 'ideaJsxComponent', foreground: colors.jsxComponent },
    { token: 'ideaAnnotation', foreground: colors.annotation },
  ];
}

const IDENTIFIER = /[A-Za-z_$][\w$]*/gu;
const RESERVED_WORDS = new Set([
  'as',
  'async',
  'await',
  'break',
  'case',
  'catch',
  'class',
  'const',
  'continue',
  'default',
  'delete',
  'do',
  'else',
  'enum',
  'export',
  'extends',
  'false',
  'finally',
  'for',
  'from',
  'function',
  'if',
  'implements',
  'import',
  'in',
  'instanceof',
  'interface',
  'let',
  'new',
  'null',
  'of',
  'return',
  'static',
  'super',
  'switch',
  'this',
  'throw',
  'true',
  'try',
  'type',
  'typeof',
  'undefined',
  'var',
  'void',
  'while',
  'with',
  'yield',
]);

const C_FAMILY_TYPE_KEYWORDS = new Set([
  'auto',
  'bool',
  'char',
  'char8_t',
  'char16_t',
  'char32_t',
  'double',
  'float',
  'int',
  'long',
  'short',
  'signed',
  'unsigned',
  'void',
  'wchar_t',
]);

/** Rust uses single quotes for both chars and lifetimes; only chars have a closing quote. */
function startsRustLifetime(text: string, index: number): boolean {
  if (text[index] !== "'" || !/[A-Za-z_]/.test(text[index + 1] ?? '')) return false;
  let end = index + 2;
  while (/[\w]/.test(text[end] ?? '')) end += 1;
  return text[end] !== "'";
}

function shellVariableExpressionLength(text: string, index: number): number {
  if (text[index] !== '$') return 0;
  const rest = text.slice(index);
  const braced = /^\$\{[A-Za-z_][A-Za-z0-9_]*(?:[^}\n]*)\}/u.exec(rest);
  if (braced !== null) return braced[0].length;
  const plain = /^\$[A-Za-z_][A-Za-z0-9_]*/u.exec(rest);
  return plain?.[0].length ?? 0;
}

/** Mask comments and string bodies while preserving offsets and line breaks. */
function maskCommentsAndStrings(text: string, languageId = ''): string {
  const masked = text.split('');
  let state: 'code' | 'lineComment' | 'blockComment' | 'single' | 'double' | 'template' = 'code';
  let escaped = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const next = text[index + 1] ?? '';
    if (state === 'lineComment') {
      if (character === '\n') state = 'code';
      else masked[index] = ' ';
      continue;
    }
    if (state === 'blockComment') {
      masked[index] = character === '\n' ? '\n' : ' ';
      if (character === '*' && next === '/') {
        masked[index + 1] = ' ';
        index += 1;
        state = 'code';
      }
      continue;
    }
    if (state === 'single' || state === 'double' || state === 'template') {
      const quote = state === 'single' ? "'" : state === 'double' ? '"' : '`';
      masked[index] = character === '\n' ? '\n' : ' ';
      if (escaped) {
        escaped = false;
        continue;
      }
      if (languageId === 'shell' && state === 'double') {
        const variableLength = shellVariableExpressionLength(text, index);
        if (variableLength > 0) {
          masked[index] = '$';
          for (let offset = 1; offset < variableLength; offset += 1) {
            masked[index + offset] = text[index + offset];
          }
          index += variableLength - 1;
          continue;
        }
      }
      if (character === '\\') {
        escaped = true;
        continue;
      }
      if (character === quote) state = 'code';
      continue;
    }
    if (character === '/' && next === '/') {
      masked[index] = ' ';
      masked[index + 1] = ' ';
      index += 1;
      state = 'lineComment';
      continue;
    }
    if (character === '/' && next === '*') {
      masked[index] = ' ';
      masked[index + 1] = ' ';
      index += 1;
      state = 'blockComment';
      continue;
    }
    if (character === "'") {
      if (languageId === 'rust' && startsRustLifetime(text, index)) continue;
      masked[index] = ' ';
      state = 'single';
      continue;
    }
    if (character === '"') {
      masked[index] = ' ';
      state = 'double';
      continue;
    }
    if (character === '`') {
      masked[index] = ' ';
      state = 'template';
    }
  }
  return masked.join('');
}

function lineStartOffsets(text: string): number[] {
  const starts = [0];
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] === '\n') starts.push(index + 1);
  }
  return starts;
}

function semanticTokenAt(
  text: string,
  lineStarts: number[],
  offset: number,
  length: number,
  tokenType: string,
  priority: number,
): IdeaLightSemanticToken | null {
  if (offset < 0 || length <= 0) return null;
  let low = 0;
  let high = lineStarts.length - 1;
  while (low <= high) {
    const middle = (low + high) >> 1;
    if (lineStarts[middle] <= offset) low = middle + 1;
    else high = middle - 1;
  }
  const line = Math.max(0, high);
  return {
    line,
    startCharacter: offset - lineStarts[line],
    length,
    tokenType,
    priority,
  };
}

function addMatches(
  target: IdeaLightSemanticToken[],
  text: string,
  lineStarts: number[],
  pattern: RegExp,
  group: number,
  tokenType: string,
  priority: number,
): void {
  pattern.lastIndex = 0;
  for (const match of text.matchAll(pattern)) {
    const value = match[group];
    const offset = match.index === undefined ? -1 : match.index + match[0].lastIndexOf(value);
    if (typeof value === 'string' && value !== '') {
      const token = semanticTokenAt(text, lineStarts, offset, value.length, tokenType, priority);
      if (token !== null) target.push(token);
    }
  }
}

function matchingBrace(masked: string, start: number, open: string, close: string): number {
  let depth = 0;
  for (let index = start; index < masked.length; index += 1) {
    if (masked[index] === open) depth += 1;
    else if (masked[index] === close) {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  return -1;
}

function addParameterGroup(
  target: IdeaLightSemanticToken[],
  masked: string,
  lineStarts: number[],
  groupOffset: number,
  group: string,
): void {
  let segmentStart = 0;
  let depth = 0;
  const segments: Array<{ offset: number; text: string }> = [];
  for (let index = 0; index <= group.length; index += 1) {
    const character = group[index] ?? ',';
    if (character === '(' || character === '[' || character === '{' || character === '<') depth += 1;
    else if (character === ')' || character === ']' || character === '}' || character === '>')
      depth = Math.max(0, depth - 1);
    if (character !== ',' || depth > 0) continue;
    segments.push({ offset: segmentStart, text: group.slice(segmentStart, index) });
    segmentStart = index + 1;
  }
  for (const segment of segments) {
    const lead = segment.text.search(/\S/u);
    if (lead < 0) continue;
    const segmentOffset = groupOffset + segment.offset + lead;
    const open = segment.text[lead];
    if (open === '{' || open === '[') {
      const close = open === '{' ? '}' : ']';
      const end = matchingBrace(masked, segmentOffset, open, close);
      if (end < 0) continue;
      for (const identifier of masked.slice(segmentOffset + 1, end).matchAll(IDENTIFIER)) {
        const value = identifier[0];
        if (RESERVED_WORDS.has(value)) continue;
        const token = semanticTokenAt(
          masked,
          lineStarts,
          segmentOffset + 1 + (identifier.index ?? 0),
          value.length,
          'ideaParameter',
          94,
        );
        if (token !== null) target.push(token);
      }
      continue;
    }
    const declaration = segment.text.slice(lead).split(/[:=]/u, 1)[0] ?? '';
    const identifiers = [...declaration.matchAll(IDENTIFIER)];
    const value = identifiers.at(-1)?.[0] ?? '';
    if (value === '' || RESERVED_WORDS.has(value)) continue;
    const valueOffset = segmentOffset + declaration.lastIndexOf(value);
    const token = semanticTokenAt(masked, lineStarts, valueOffset, value.length, 'ideaParameter', 94);
    if (token !== null) target.push(token);
  }
}

function addCFamilyParameterGroup(
  target: IdeaLightSemanticToken[],
  masked: string,
  lineStarts: number[],
  groupOffset: number,
  group: string,
): void {
  let segmentStart = 0;
  let depth = 0;
  const segments: Array<{ offset: number; text: string }> = [];
  for (let index = 0; index <= group.length; index += 1) {
    const character = group[index] ?? ',';
    if (character === '(' || character === '[' || character === '{' || character === '<') depth += 1;
    else if (character === ')' || character === ']' || character === '}' || character === '>')
      depth = Math.max(0, depth - 1);
    if (character !== ',' || depth > 0) continue;
    segments.push({ offset: segmentStart, text: group.slice(segmentStart, index) });
    segmentStart = index + 1;
  }
  for (const segment of segments) {
    const lead = segment.text.search(/\S/u);
    if (lead < 0) continue;
    let declarationDepth = 0;
    let declarationEnd = segment.text.length;
    for (let index = lead; index < segment.text.length; index += 1) {
      const character = segment.text[index];
      if (character === '(' || character === '[' || character === '{' || character === '<') declarationDepth += 1;
      else if (character === ')' || character === ']' || character === '}' || character === '>')
        declarationDepth = Math.max(0, declarationDepth - 1);
      else if (character === '=' && declarationDepth === 0) {
        declarationEnd = index;
        break;
      }
    }
    const declaration = segment.text.slice(lead, declarationEnd);
    const pointerDeclarator = /\(\s*(?:[A-Za-z_$][\w$]*::)*[*&]+\s*([A-Za-z_$][\w$]*)?\s*\)\s*\(/u.exec(declaration);
    if (pointerDeclarator !== null) {
      const value = pointerDeclarator[1] ?? '';
      if (value === '' || RESERVED_WORDS.has(value) || C_FAMILY_TYPE_KEYWORDS.has(value)) continue;
      const valueOffset =
        groupOffset + segment.offset + lead + (pointerDeclarator.index ?? 0) + pointerDeclarator[0].indexOf(value);
      const token = semanticTokenAt(masked, lineStarts, valueOffset, value.length, 'ideaParameter', 94);
      if (token !== null) target.push(token);
      continue;
    }
    const identifiers = [...declaration.matchAll(IDENTIFIER)];
    const value = identifiers.at(-1)?.[0] ?? '';
    if (value === '' || RESERVED_WORDS.has(value) || C_FAMILY_TYPE_KEYWORDS.has(value)) continue;
    const valueOffset = groupOffset + segment.offset + lead + declaration.lastIndexOf(value);
    const token = semanticTokenAt(masked, lineStarts, valueOffset, value.length, 'ideaParameter', 94);
    if (token !== null) target.push(token);
  }
}

function addCFamilyInitializerMembers(
  target: IdeaLightSemanticToken[],
  masked: string,
  lineStarts: number[],
  groupOffset: number,
  group: string,
  typeName: string,
): void {
  let segmentStart = 0;
  let depth = 0;
  for (let index = 0; index <= group.length; index += 1) {
    const character = group[index] ?? ',';
    if (character === '(' || character === '[' || character === '{' || character === '<') depth += 1;
    else if (character === ')' || character === ']' || character === '}' || character === '>')
      depth = Math.max(0, depth - 1);
    if (character !== ',' || depth > 0) continue;
    const segment = group.slice(segmentStart, index);
    const initializer = /^\s*(?:this\s*->\s*)?([A-Za-z_$][\w$]*)\s*[({]/u.exec(segment);
    if (initializer !== null) {
      const value = initializer[1] ?? '';
      if (value !== '' && value !== typeName && !/^[A-Z]/u.test(value)) {
        const offset = groupOffset + segmentStart + initializer[0].lastIndexOf(value);
        const token = semanticTokenAt(masked, lineStarts, offset, value.length, 'ideaProperty', 82);
        if (token !== null) target.push(token);
      }
    }
    segmentStart = index + 1;
  }
}

function addTypeParameterGroup(
  target: IdeaLightSemanticToken[],
  masked: string,
  lineStarts: number[],
  groupOffset: number,
  group: string,
): void {
  let segmentStart = 0;
  let depth = 0;
  const segments: Array<{ offset: number; text: string }> = [];
  for (let index = 0; index <= group.length; index += 1) {
    const character = group[index] ?? ',';
    if (character === '(' || character === '[' || character === '{' || character === '<') depth += 1;
    else if (character === ')' || character === ']' || character === '}' || character === '>')
      depth = Math.max(0, depth - 1);
    if (character !== ',' || depth > 0) continue;
    segments.push({ offset: segmentStart, text: group.slice(segmentStart, index) });
    segmentStart = index + 1;
  }
  for (const segment of segments) {
    const lead = segment.text.search(/\S/u);
    if (lead < 0) continue;
    const identifiers = [...segment.text.matchAll(IDENTIFIER)];
    const declaration = identifiers.find((identifier) => {
      const value = identifier[0];
      return (
        segment.text[(identifier.index ?? 0) - 1] !== "'" &&
        value !== 'const' &&
        value !== 'in' &&
        value !== 'out' &&
        !RESERVED_WORDS.has(value)
      );
    });
    if (declaration === undefined) continue;
    const value = declaration[0];
    const offset = groupOffset + segment.offset + (declaration.index ?? 0);
    const token = semanticTokenAt(masked, lineStarts, offset, value.length, 'ideaTypeParameter', 92);
    if (token !== null) target.push(token);
  }
}

function addRustGenericTypeParameters(target: IdeaLightSemanticToken[], masked: string, lineStarts: number[]): void {
  for (const match of masked.matchAll(
    /\b(?:struct|trait|enum|union|type|fn|impl)\s*(?:[A-Za-z_$][\w$]*)?\s*<([^<>]+)>/gu,
  )) {
    const group = match[1] ?? '';
    const groupOffset = (match.index ?? 0) + match[0].indexOf(group);
    addTypeParameterGroup(target, masked, lineStarts, groupOffset, group);
  }
  for (const match of masked.matchAll(/\bwhere\b([^;{]*)(?=[;{])/gu)) {
    const group = match[1] ?? '';
    const groupOffset = (match.index ?? 0) + match[0].indexOf(group);
    for (const constraint of group.matchAll(/(?<!')\b([A-Za-z_$][\w$]*)\s*:/gu)) {
      const value = constraint[1] ?? '';
      if (value === '' || RESERVED_WORDS.has(value)) continue;
      const offset = groupOffset + (constraint.index ?? 0) + constraint[0].indexOf(value);
      const token = semanticTokenAt(masked, lineStarts, offset, value.length, 'ideaTypeParameter', 92);
      if (token !== null) target.push(token);
    }
  }
}

function addRustImplTargets(target: IdeaLightSemanticToken[], masked: string, lineStarts: number[]): void {
  const typePath = String.raw`[A-Za-z_$][\w$]*(?:::[A-Za-z_$][\w$]*)*`;
  for (const match of masked.matchAll(
    new RegExp(String.raw`\bimpl\s*(?:<[^>]*>)?\s+(${typePath})(?:\s+for\s+(${typePath}))?`, 'gu'),
  )) {
    const traitPath = match[1] ?? '';
    const implementationPath = match[2] ?? '';
    const traitIndex = match[0].indexOf(traitPath);
    for (const [path, tokenType, priority, pathIndex] of implementationPath === ''
      ? [[traitPath, 'ideaClass', 87, traitIndex] as const]
      : [
          [traitPath, 'ideaInterface', 87, traitIndex] as const,
          [implementationPath, 'ideaClass', 87, match[0].lastIndexOf(implementationPath)] as const,
        ]) {
      const value = path.split('::').at(-1) ?? '';
      if (value === '') continue;
      const offset = (match.index ?? 0) + pathIndex + path.lastIndexOf(value);
      const token = semanticTokenAt(masked, lineStarts, offset, value.length, tokenType, priority);
      if (token !== null) target.push(token);
    }
  }
}

function addCFamilyNamespaceTokens(target: IdeaLightSemanticToken[], masked: string, lineStarts: number[]): void {
  addMatches(target, masked, lineStarts, /\bnamespace\s+([A-Za-z_$][\w$]*)/gu, 1, 'ideaModule', 89);
}

function preprocessorContinuationEnd(text: string, start: number): number {
  let cursor = start;
  while (cursor < text.length) {
    const lineEnd = text.indexOf('\n', cursor);
    if (lineEnd < 0) return text.length;
    if (!/\\[ \t]*$/u.test(text.slice(cursor, lineEnd))) return lineEnd;
    cursor = lineEnd + 1;
  }
  return text.length;
}

function addCFamilyPreprocessorTokens(target: IdeaLightSemanticToken[], masked: string, lineStarts: number[]): void {
  for (const match of masked.matchAll(/(?:^|\n)[ \t]*#[ \t]*define[ \t]+([A-Za-z_$][\w$]*)(?:\(([^)\n]*)\))?/gu)) {
    const name = match[1] ?? '';
    const parameters = match[2];
    if (name === '') continue;
    const nameOffset = (match.index ?? 0) + match[0].indexOf(name);
    const token = semanticTokenAt(
      masked,
      lineStarts,
      nameOffset,
      name.length,
      parameters === undefined ? 'ideaConstant' : 'ideaMethod',
      86,
    );
    if (token !== null) target.push(token);
    if (parameters !== undefined) {
      const parameterNames = new Set([...parameters.matchAll(IDENTIFIER)].map((parameter) => parameter[0]));
      addCFamilyParameterGroup(
        target,
        masked,
        lineStarts,
        (match.index ?? 0) + match[0].indexOf(parameters),
        parameters,
      );
      const bodyStart = (match.index ?? 0) + match[0].length;
      const body = masked.slice(bodyStart, preprocessorContinuationEnd(masked, bodyStart));
      for (const identifier of body.matchAll(IDENTIFIER)) {
        const value = identifier[0];
        if (!parameterNames.has(value)) continue;
        const parameter = semanticTokenAt(
          masked,
          lineStarts,
          bodyStart + (identifier.index ?? 0),
          value.length,
          'ideaParameter',
          95,
        );
        if (parameter !== null) target.push(parameter);
      }
    }
  }
  for (const match of masked.matchAll(/(?:^|\n)[ \t]*#[ \t]*(?:ifdef|ifndef|undef|if|elif)\b([^\n]*)/gu)) {
    const expression = match[1] ?? '';
    const expressionOffset = (match.index ?? 0) + match[0].indexOf(expression);
    for (const identifier of expression.matchAll(IDENTIFIER)) {
      const value = identifier[0];
      if (
        value === 'defined' ||
        value === 'true' ||
        value === 'false' ||
        RESERVED_WORDS.has(value) ||
        C_FAMILY_TYPE_KEYWORDS.has(value)
      ) {
        continue;
      }
      const token = semanticTokenAt(
        masked,
        lineStarts,
        expressionOffset + (identifier.index ?? 0),
        value.length,
        'ideaConstant',
        83,
      );
      if (token !== null) target.push(token);
    }
  }
}

function addCFamilyTemplateParameters(target: IdeaLightSemanticToken[], masked: string, lineStarts: number[]): void {
  for (const match of masked.matchAll(/\btemplate\s*<([^>\n]*)>/gu)) {
    const group = match[1] ?? '';
    const groupOffset = (match.index ?? 0) + match[0].indexOf(group);
    for (const parameter of group.matchAll(/\b(?:typename|class)\s+([A-Za-z_$][\w$]*)/gu)) {
      const value = parameter[1] ?? '';
      if (value === '') continue;
      const offset = groupOffset + (parameter.index ?? 0) + parameter[0].lastIndexOf(value);
      const token = semanticTokenAt(masked, lineStarts, offset, value.length, 'ideaTypeParameter', 92);
      if (token !== null) target.push(token);
    }
  }
}

function addCFamilyInheritanceTargets(target: IdeaLightSemanticToken[], masked: string, lineStarts: number[]): void {
  for (const match of masked.matchAll(/\b(?:class|struct)\s+[A-Za-z_$][\w$]*(?:\s+final)?\s*:\s*([^{\n]+)\{/gu)) {
    const bases = match[1] ?? '';
    const basesOffset = (match.index ?? 0) + match[0].indexOf(bases);
    for (const base of bases.matchAll(
      /(?:^|,)\s*(?:(?:public|protected|private|virtual)\s+)*((?:[A-Za-z_$][\w$]*::)*[A-Za-z_$][\w$]*)/gu,
    )) {
      const path = base[1] ?? '';
      const value = path.split('::').at(-1) ?? '';
      if (value === '') continue;
      const offset = basesOffset + (base.index ?? 0) + base[0].lastIndexOf(value);
      const token = semanticTokenAt(masked, lineStarts, offset, value.length, 'ideaClass', 88);
      if (token !== null) target.push(token);
    }
  }
}

function addCFamilyOperatorTokens(target: IdeaLightSemanticToken[], masked: string, lineStarts: number[]): void {
  const operatorPattern =
    /\boperator\s*(\(\)|\[\]|->\*?|new(?:\s*\[\])?|delete(?:\s*\[\])?|co_await|[=!<>+\-*/%&|^~]+|(?:[A-Za-z_$][\w$]*::)*[A-Za-z_$][\w$]*)/gu;
  for (const match of masked.matchAll(operatorPattern)) {
    const operatorValue = match[0].trimEnd();
    const operatorOffset = match.index ?? 0;
    const method = semanticTokenAt(masked, lineStarts, operatorOffset, operatorValue.length, 'ideaMethod', 87);
    if (method !== null) target.push(method);
    const searchStart = operatorOffset + operatorValue.length;
    const open = masked.indexOf('(', searchStart);
    if (open < 0 || /[\n;{}]/u.test(masked.slice(searchStart, open))) continue;
    const close = matchingBrace(masked, open, '(', ')');
    if (close < 0) continue;
    addCFamilyParameterGroup(target, masked, lineStarts, open + 1, masked.slice(open + 1, close));
    const lineStart = masked.lastIndexOf('\n', operatorOffset) + 1;
    const qualifier = /([A-Za-z_$][\w$]*(?:::[A-Za-z_$][\w$]*)*)::\s*$/u.exec(masked.slice(lineStart, operatorOffset));
    if (qualifier !== null) {
      const path = qualifier[1] ?? '';
      const value = path.split('::').at(-1) ?? '';
      if (value !== '') {
        const token = semanticTokenAt(
          masked,
          lineStarts,
          lineStart + (qualifier.index ?? 0) + qualifier[0].lastIndexOf(value),
          value.length,
          'ideaClass',
          87,
        );
        if (token !== null) target.push(token);
      }
    }
  }
}

function addCFamilyFunctionTokens(target: IdeaLightSemanticToken[], masked: string, lineStarts: number[]): void {
  const typeName = String.raw`[A-Za-z_$][\w$]*(?:::[A-Za-z_$][\w$]*)*(?:\s*<[^;\n{}()]*>)?`;
  const parameterGroup = String.raw`((?:[^()]|\([^()]*\))*)`;
  const pattern = new RegExp(
    String.raw`(?:^|\n)[ \t]*(?:(?:static|inline|virtual|constexpr|consteval|friend|extern|explicit)\s+)*(?:(?:const|volatile|unsigned|signed|long|short|struct|class|enum|typename)\s+)*(${typeName})(?:\s*[*&]+\s*|\s+)([A-Za-z_$][\w$]*(?:::[~A-Za-z_$][\w$]*)?)\s*\(${parameterGroup}\)\s*(?:const\s*)?(?:noexcept\s*)?(?:override\s*)?(?:final\s*)?(?:->\s*[^;{\n]+)?\s*(?=[{;])`,
    'gu',
  );
  for (const match of masked.matchAll(pattern)) {
    const functionPath = match[2] ?? '';
    const parameters = match[3] ?? '';
    const name = functionPath.split('::').at(-1)?.replace(/^~/u, '') ?? '';
    if (name === '' || RESERVED_WORDS.has(name)) continue;
    const functionOffset = (match.index ?? 0) + match[0].indexOf(functionPath);
    const nameOffset = functionOffset + functionPath.lastIndexOf(name);
    const token = semanticTokenAt(masked, lineStarts, nameOffset, name.length, 'ideaMethod', 78);
    if (token !== null) target.push(token);
    const qualifierEnd = functionPath.lastIndexOf('::');
    if (qualifierEnd >= 0) {
      const qualifierPath = functionPath.slice(0, qualifierEnd);
      const qualifierName = qualifierPath.split('::').at(-1) ?? '';
      if (qualifierName !== '') {
        const qualifier = semanticTokenAt(
          masked,
          lineStarts,
          functionOffset + qualifierPath.lastIndexOf(qualifierName),
          qualifierName.length,
          'ideaClass',
          78,
        );
        if (qualifier !== null) target.push(qualifier);
      }
    }
    addCFamilyParameterGroup(target, masked, lineStarts, (match.index ?? 0) + match[0].indexOf(parameters), parameters);
  }
  for (const match of masked.matchAll(
    /(?:^|\n)[ \t]*(?:(?:explicit|constexpr|inline)\s+)*([A-Za-z_$][\w$]*(?:::[A-Za-z_$][\w$]*)*)\s*::\s*(~?[A-Za-z_$][\w$]*)\s*\(((?:[^()]|\([^()]*\))*)\)\s*(?::\s*([^{;\n]*))?\s*\{/gu,
  )) {
    const qualifierPath = match[1] ?? '';
    const methodName = match[2] ?? '';
    const parameters = match[3] ?? '';
    const initializers = match[4] ?? '';
    const qualifierName = qualifierPath.split('::').at(-1) ?? '';
    if (qualifierName === '' || methodName === '') continue;
    const qualifier = semanticTokenAt(
      masked,
      lineStarts,
      (match.index ?? 0) + match[0].indexOf(qualifierPath) + qualifierPath.lastIndexOf(qualifierName),
      qualifierName.length,
      'ideaClass',
      78,
    );
    if (qualifier !== null) target.push(qualifier);
    const token = semanticTokenAt(
      masked,
      lineStarts,
      (match.index ?? 0) + match[0].lastIndexOf(methodName),
      methodName.replace(/^~/u, '').length,
      'ideaMethod',
      79,
    );
    if (token !== null) target.push(token);
    addCFamilyParameterGroup(target, masked, lineStarts, (match.index ?? 0) + match[0].indexOf(parameters), parameters);
    if (initializers !== '') {
      addCFamilyInitializerMembers(
        target,
        masked,
        lineStarts,
        (match.index ?? 0) + match[0].indexOf(initializers),
        initializers,
        qualifierName,
      );
    }
  }
}

function addCFamilyTypeMembers(target: IdeaLightSemanticToken[], masked: string, lineStarts: number[]): void {
  for (const typeMatch of masked.matchAll(
    /\b(?:class|struct|union)\s+([A-Za-z_$][\w$]*)(?:\s+final)?(?:\s*:\s*[^{]*)?\s*\{/gu,
  )) {
    const typeName = typeMatch[1] ?? '';
    const open = (typeMatch.index ?? 0) + typeMatch[0].lastIndexOf('{');
    const close = matchingBrace(masked, open, '{', '}');
    if (typeName === '' || close < 0) continue;
    const body = masked.slice(open + 1, close);
    const constructorPattern = new RegExp(
      String.raw`^\s*(?:(?:explicit|constexpr|inline|virtual|friend)\s+)*(?:~${typeName.replaceAll('$', String.raw`\$`)}|${typeName.replaceAll('$', String.raw`\$`)})\s*\(((?:[^()]|\([^()]*\))*)\)`,
      'u',
    );
    let segmentStart = 0;
    let depth = 0;
    for (let index = 0; index <= body.length; index += 1) {
      const character = body[index];
      if (character === '(' || character === '[' || character === '{') depth += 1;
      else if (character === ')' || character === ']' || character === '}') depth = Math.max(0, depth - 1);
      if (character !== undefined && character !== ';' && !(character === '\n' && depth === 0)) {
        continue;
      }
      const segment = body.slice(segmentStart, index);
      const stripped = segment.trim();
      if (/^(?:public|private|protected)\s*:$/u.test(stripped) || stripped === '') {
        if (character === undefined) break;
        segmentStart = index + 1;
        continue;
      }
      const constructor = constructorPattern.exec(segment);
      if (constructor !== null) {
        const parameters = constructor[1] ?? '';
        const constructorName = typeName;
        const nameOffset =
          open +
          1 +
          segmentStart +
          (constructor[0].lastIndexOf(constructorName) >= 0
            ? constructor[0].lastIndexOf(constructorName)
            : constructor[0].indexOf(constructorName));
        const token = semanticTokenAt(masked, lineStarts, nameOffset, constructorName.length, 'ideaMethod', 79);
        if (token !== null) target.push(token);
        addCFamilyParameterGroup(
          target,
          masked,
          lineStarts,
          open + 1 + segmentStart + constructor[0].indexOf(parameters),
          parameters,
        );
      } else if (!segment.includes('(')) {
        const declaration = stripped.split('=', 1)[0]?.split(/(?<!:):(?!:)/u, 1)[0] ?? '';
        const commaParts = declaration.split(',');
        const hasTypePrefix = commaParts[0] !== undefined && [...commaParts[0].matchAll(IDENTIFIER)].length > 1;
        commaParts.forEach((part, partIndex) => {
          if (!hasTypePrefix && partIndex === 0) return;
          const identifiers = [...part.matchAll(IDENTIFIER)];
          const value = identifiers.at(-1)?.[0] ?? '';
          if (value === '' || RESERVED_WORDS.has(value)) return;
          const valueOffset = open + 1 + segmentStart + segment.indexOf(part) + part.lastIndexOf(value);
          const token = semanticTokenAt(masked, lineStarts, valueOffset, value.length, 'ideaProperty', 77);
          if (token !== null) target.push(token);
        });
      }
      if (character === undefined) break;
      segmentStart = index + 1;
    }
  }
}

function addJsxComponentTags(target: IdeaLightSemanticToken[], masked: string, lineStarts: number[]): void {
  for (const match of masked.matchAll(/<([A-Z][\w$]*)(?:\s[^<>]*)?>[\s\S]*?<\/\1\s*>/gu)) {
    const name = match[1] ?? '';
    const opening = semanticTokenAt(masked, lineStarts, (match.index ?? 0) + 1, name.length, 'ideaJsxComponent', 88);
    if (opening !== null) target.push(opening);
    const closingOffset = (match.index ?? 0) + match[0].lastIndexOf(`</${name}`) + 2;
    const closing = semanticTokenAt(masked, lineStarts, closingOffset, name.length, 'ideaJsxComponent', 88);
    if (closing !== null) target.push(closing);
  }
  for (const match of masked.matchAll(/<([A-Z][\w$]*)(?:\s[^<>]*)?\/>/gu)) {
    const name = match[1] ?? '';
    const token = semanticTokenAt(masked, lineStarts, (match.index ?? 0) + 1, name.length, 'ideaJsxComponent', 88);
    if (token !== null) target.push(token);
  }
}

function addDecoratorNames(target: IdeaLightSemanticToken[], masked: string, lineStarts: number[]): void {
  for (const match of masked.matchAll(/@\s*([A-Za-z_$][\w$]*)/gu)) {
    const value = match[1] ?? '';
    if (value === '') continue;
    const offset = (match.index ?? 0) + match[0].lastIndexOf(value);
    const token = semanticTokenAt(masked, lineStarts, offset, value.length, 'ideaAnnotation', 96);
    if (token !== null) target.push(token);
  }
}

function addEnumMemberTokens(target: IdeaLightSemanticToken[], masked: string, lineStarts: number[]): void {
  for (const match of masked.matchAll(/\benum\s+[A-Za-z_$][\w$]*(?:\s+[^{]*)?\{/gu)) {
    const open = (match.index ?? 0) + match[0].lastIndexOf('{');
    const close = matchingBrace(masked, open, '{', '}');
    if (close < 0) continue;
    const body = masked.slice(open + 1, close);
    let segmentStart = 0;
    let depth = 0;
    for (let index = 0; index <= body.length; index += 1) {
      const character = body[index];
      if (character === '(' || character === '[' || character === '{' || character === '<') depth += 1;
      else if (character === ')' || character === ']' || character === '}' || character === '>')
        depth = Math.max(0, depth - 1);
      if (character !== undefined && (character !== ',' || depth > 0) && character !== ';') continue;
      const segment = body.slice(segmentStart, index);
      const cleaned = segment.replace(/^(?:\s*@[\w$.]+(?:\([^)]*\))?)+\s*/u, '').trim();
      const value = /^(?:case\s+)?([A-Za-z_$][\w$]*)/u.exec(cleaned)?.[1] ?? '';
      if (value !== '' && !RESERVED_WORDS.has(value)) {
        const valueOffset = open + 1 + segmentStart + segment.indexOf(value);
        const token = semanticTokenAt(masked, lineStarts, valueOffset, value.length, 'ideaConstant', 82);
        if (token !== null) target.push(token);
      }
      if (character === ';' || character === undefined) break;
      segmentStart = index + 1;
    }
  }
}

function addClassFieldTokens(target: IdeaLightSemanticToken[], masked: string, lineStarts: number[]): void {
  const fieldDeclaration =
    /^\s*(?:@[\w$.]+(?:\([^)]*\))?\s*)*(?:(?:public|private|protected|static|readonly|declare|override|abstract|accessor)\s+)*(?:#\s*)?([A-Za-z_$][\w$]*)\s*(?=[:=]|$)/u;
  for (const classMatch of masked.matchAll(/\bclass\s+[A-Za-z_$][\w$]*(?:\s+[^{]*)?\{/gu)) {
    const open = (classMatch.index ?? 0) + classMatch[0].lastIndexOf('{');
    const close = matchingBrace(masked, open, '{', '}');
    if (close < 0) continue;
    const body = masked.slice(open + 1, close);
    let segmentStart = 0;
    let depth = 0;
    for (let index = 0; index <= body.length; index += 1) {
      const character = body[index];
      if (character === '(' || character === '[' || character === '{') depth += 1;
      else if (character === ')' || character === ']' || character === '}') depth = Math.max(0, depth - 1);
      if (character !== undefined && character !== ';' && !(character === '\n' && depth === 0)) continue;
      const segment = body.slice(segmentStart, index);
      const declaration = fieldDeclaration.exec(segment);
      const value = declaration?.[1] ?? '';
      if (
        value !== '' &&
        !RESERVED_WORDS.has(value) &&
        value !== 'public' &&
        value !== 'private' &&
        value !== 'protected'
      ) {
        const valueOffset = open + 1 + segmentStart + (declaration?.[0].lastIndexOf(value) ?? 0);
        const token = semanticTokenAt(masked, lineStarts, valueOffset, value.length, 'ideaProperty', 77);
        if (token !== null) target.push(token);
      }
      if (character === undefined) break;
      segmentStart = index + 1;
    }
  }
}

function addReturnTypeQualifiedMembers(target: IdeaLightSemanticToken[], masked: string, lineStarts: number[]): void {
  for (const match of masked.matchAll(/\)\s*:\s*([^=;{]+?)(?=\s*(?:=>|\{|;|$))/gu)) {
    const group = match[1] ?? '';
    const groupOffset = (match.index ?? 0) + match[0].indexOf(group);
    for (const member of group.matchAll(/\.\s*([A-Za-z_$][\w$]*)/gu)) {
      const value = member[1] ?? '';
      if (value === '') continue;
      const offset = groupOffset + (member.index ?? 0) + member[0].lastIndexOf(value);
      const token = semanticTokenAt(masked, lineStarts, offset, value.length, 'ideaClass', 75);
      if (token !== null) target.push(token);
    }
  }
}

function addTypedLanguageMemberTokens(target: IdeaLightSemanticToken[], masked: string, lineStarts: number[]): void {
  const modifier = String.raw`(?:public|private|protected|internal|pub(?:\([^)]*\))?|static|final|abstract|synchronized|native|default|virtual|override|async|readonly|unsafe|extern|suspend|inline|tailrec|operator|mutating|const)`;
  for (const match of masked.matchAll(
    new RegExp(
      String.raw`(?:^|\n|[{};])[ \t]*(?:${modifier}\s+)+(?:<[^>\n]+>\s*)?(?:[A-Za-z_$][\w$]*(?:\s*<[^>\n]+>)?(?:\[\])?\s+)+([A-Za-z_$][\w$]*)\s*\(([^()]*)\)`,
      'gu',
    ),
  )) {
    const name = match[1] ?? '';
    const parameters = match[2] ?? '';
    if (name === '' || RESERVED_WORDS.has(name)) continue;
    const nameOffset = (match.index ?? 0) + match[0].lastIndexOf(name);
    const token = semanticTokenAt(masked, lineStarts, nameOffset, name.length, 'ideaMethod', 68);
    if (token !== null) target.push(token);
    addParameterGroup(target, masked, lineStarts, (match.index ?? 0) + match[0].indexOf(parameters), parameters);
  }

  for (const match of masked.matchAll(
    new RegExp(
      String.raw`(?:^|\n|[{};])[ \t]*(?:${modifier}\s+)*(?:fun|func|fn|def)\s+([A-Za-z_$][\w$]*)\s*\(([^()]*)\)`,
      'gu',
    ),
  )) {
    const name = match[1] ?? '';
    const parameters = match[2] ?? '';
    if (name === '' || RESERVED_WORDS.has(name)) continue;
    const nameOffset = (match.index ?? 0) + match[0].lastIndexOf(name);
    const token = semanticTokenAt(masked, lineStarts, nameOffset, name.length, 'ideaMethod', 68);
    if (token !== null) target.push(token);
    addParameterGroup(target, masked, lineStarts, (match.index ?? 0) + match[0].indexOf(parameters), parameters);
  }

  for (const match of masked.matchAll(
    new RegExp(
      String.raw`(?:^|\n|[{};])[ \t]*(?:${modifier}\s+)+(?:(?:static|final|volatile|transient|readonly|required|const|lateinit|open|override)\s+)*(?!(?:class|interface|enum|struct|record|trait|protocol)\b)(?:[A-Za-z_$][\w$]*(?:\s*<[^>\n]+>)?(?:\[\])?\s+)+([A-Za-z_$][\w$]*)\s*(?=[:=;{])`,
      'gu',
    ),
  )) {
    const name = match[1] ?? '';
    if (name === '' || RESERVED_WORDS.has(name)) continue;
    const nameOffset = (match.index ?? 0) + match[0].lastIndexOf(name);
    const token = semanticTokenAt(masked, lineStarts, nameOffset, name.length, 'ideaProperty', 78);
    if (token !== null) target.push(token);
  }

  for (const match of masked.matchAll(
    /(?:^|\n|[{};])[ \t]*(?:(?:public|private|protected|internal|static|final|readonly|lateinit|open|override)\s+)*(?:val|var|let)\s+([A-Za-z_$][\w$]*)\s*:\s*[^=\n]+(?=\n|$)/gu,
  )) {
    const name = match[1] ?? '';
    if (name === '') continue;
    const nameOffset = (match.index ?? 0) + match[0].lastIndexOf(name);
    const token = semanticTokenAt(masked, lineStarts, nameOffset, name.length, 'ideaProperty', 76);
    if (token !== null) target.push(token);
  }

  for (const match of masked.matchAll(/\b(?:class|record)\s+[A-Za-z_$][\w$]*\s*\(([^)]*)\)/gu)) {
    const members = match[1] ?? '';
    const membersOffset = (match.index ?? 0) + match[0].indexOf(members);
    for (const member of members.matchAll(/\b(?:val|var)\s+([A-Za-z_$][\w$]*)\s*:/gu)) {
      const name = member[1] ?? '';
      const nameOffset = membersOffset + (member.index ?? 0) + member[0].lastIndexOf(name);
      const token = semanticTokenAt(masked, lineStarts, nameOffset, name.length, 'ideaProperty', 76);
      if (token !== null) target.push(token);
    }
  }

  for (const match of masked.matchAll(
    /(?:^|\n|[{};])[ \t]*(?:(?:final|const)\s+)?([A-Za-z_$][\w$]*(?:\s*<[^>\n]+>)?(?:\[\])?)\s+([a-z_$][\w$]*)\s*=/gu,
  )) {
    const name = match[2] ?? '';
    if (name === '' || RESERVED_WORDS.has(name)) continue;
    const nameOffset = (match.index ?? 0) + match[0].lastIndexOf(name);
    const token = semanticTokenAt(masked, lineStarts, nameOffset, name.length, 'ideaVariable', 72);
    if (token !== null) target.push(token);
  }

  for (const match of masked.matchAll(
    /(?:^|[\n{;,])[ \t]*(?:(?:readonly|public|private|protected|static|abstract|declare|override)[ \t]+)*([A-Za-z_$][\w$]*)[ \t]*\??[ \t]*:(?!:)/gu,
  )) {
    const name = match[1] ?? '';
    if (name === '' || RESERVED_WORDS.has(name) || name === 'public' || name === 'private' || name === 'protected') {
      continue;
    }
    const nameOffset = (match.index ?? 0) + match[0].lastIndexOf(name);
    const token = semanticTokenAt(masked, lineStarts, nameOffset, name.length, 'ideaProperty', 73);
    if (token !== null) target.push(token);
  }
}

function addShellSemanticTokens(target: IdeaLightSemanticToken[], masked: string, lineStarts: number[]): void {
  const functionNames = new Set<string>();
  for (const match of masked.matchAll(/(?:^|\n)\s*([A-Za-z_][\w]*)\s*\(\)\s*\{/gu)) {
    const value = match[1] ?? '';
    if (value === '' || RESERVED_WORDS.has(value)) continue;
    functionNames.add(value);
    const offset = (match.index ?? 0) + match[0].lastIndexOf(value);
    const token = semanticTokenAt(masked, lineStarts, offset, value.length, 'ideaFunction', 91);
    if (token !== null) target.push(token);
  }
  for (const match of masked.matchAll(/(?:^|\n)\s*(?:export\s+|local\s+|readonly\s+)?([A-Za-z_][\w]*)=/gu)) {
    const value = match[1] ?? '';
    if (value === '' || RESERVED_WORDS.has(value)) continue;
    const offset = (match.index ?? 0) + match[0].lastIndexOf(value);
    const token = semanticTokenAt(masked, lineStarts, offset, value.length, 'ideaVariable', 78);
    if (token !== null) target.push(token);
  }
  for (const match of masked.matchAll(/\$\{?([A-Za-z_][\w]*)\}?/gu)) {
    const value = match[1] ?? '';
    if (value === '') continue;
    const offset = (match.index ?? 0) + match[0].lastIndexOf(value);
    // Shell parameter expansion uses `:` inside `${name:-default}` and `${name[0]}`.
    // Keep the expansion name above the generic typed-member property rule.
    const token = semanticTokenAt(masked, lineStarts, offset, value.length, 'ideaVariable', 82);
    if (token !== null) target.push(token);
  }
  if (functionNames.size === 0) return;
  const invocation = new RegExp(
    `(?:^|\\n)\\s*(${[...functionNames].map((name) => name.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')).join('|')})\\b`,
    'gu',
  );
  for (const match of masked.matchAll(invocation)) {
    const value = match[1] ?? '';
    const offset = (match.index ?? 0) + match[0].lastIndexOf(value);
    const token = semanticTokenAt(masked, lineStarts, offset, value.length, 'ideaFunction', 70);
    if (token !== null) target.push(token);
  }
}

/**
 * Lightweight semantic hints for constructs TypeScript's public classification
 * API does not expose: imports, locals, method calls, properties and returns.
 */
export function collectIdeaLightHeuristicSemanticTokens(text: string, languageId = ''): IdeaLightSemanticToken[] {
  if (typeof text !== 'string' || text === '') return [];
  const masked = maskCommentsAndStrings(text, languageId.toLowerCase());
  const lineStarts = lineStartOffsets(text);
  const tokens: IdeaLightSemanticToken[] = [];

  addMatches(
    tokens,
    masked,
    lineStarts,
    /\b(?:class|struct|record|union|object)\s+([A-Za-z_$][\w$]*)/gu,
    1,
    'ideaClass',
    91,
  );
  addMatches(
    tokens,
    masked,
    lineStarts,
    /\b(?:interface|trait|protocol|mixin)\s+([A-Za-z_$][\w$]*)/gu,
    1,
    'ideaInterface',
    91,
  );
  addMatches(tokens, masked, lineStarts, /\benum\s+([A-Za-z_$][\w$]*)/gu, 1, 'ideaEnum', 91);
  addEnumMemberTokens(tokens, masked, lineStarts);
  addMatches(tokens, masked, lineStarts, /\btype\s+([A-Za-z_$][\w$]*)\s+struct\b/gu, 1, 'ideaClass', 91);
  addMatches(tokens, masked, lineStarts, /\btype\s+([A-Za-z_$][\w$]*)\s+interface\b/gu, 1, 'ideaInterface', 91);
  addMatches(
    tokens,
    masked,
    lineStarts,
    /\b(?:type|typealias|typedef|using)\s+([A-Za-z_$][\w$]*)/gu,
    1,
    'ideaTypeAlias',
    90,
  );
  addMatches(tokens, masked, lineStarts, /\bmodule\s+([A-Za-z_$][\w$]*)/gu, 1, 'ideaModule', 89);
  addMatches(tokens, masked, lineStarts, /\bfunction\s+([A-Za-z_$][\w$]*)/gu, 1, 'ideaFunction', 90);
  addMatches(
    tokens,
    masked,
    lineStarts,
    /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*(?::[^=]+)?=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*(?::[^=]+)?=>/gu,
    1,
    'ideaFunction',
    85,
  );
  for (const match of masked.matchAll(/\b(?:class|interface|type|function)\s+[A-Za-z_$][\w$]*\s*<([^<>]+)>/gu)) {
    const group = match[1] ?? '';
    const offset = (match.index ?? 0) + match[0].indexOf(group);
    addTypeParameterGroup(tokens, masked, lineStarts, offset, group);
  }
  if (languageId === 'rust') {
    addRustGenericTypeParameters(tokens, masked, lineStarts);
    addRustImplTargets(tokens, masked, lineStarts);
  } else if (languageId === 'c' || languageId === 'cpp') {
    addCFamilyPreprocessorTokens(tokens, masked, lineStarts);
    addCFamilyNamespaceTokens(tokens, masked, lineStarts);
    addCFamilyTemplateParameters(tokens, masked, lineStarts);
    addCFamilyInheritanceTargets(tokens, masked, lineStarts);
    addCFamilyOperatorTokens(tokens, masked, lineStarts);
    addCFamilyFunctionTokens(tokens, masked, lineStarts);
    addCFamilyTypeMembers(tokens, masked, lineStarts);
  } else if (languageId === 'shell' || languageId === 'bash' || languageId === 'sh') {
    addShellSemanticTokens(tokens, masked, lineStarts);
  }
  addJsxComponentTags(tokens, masked, lineStarts);
  addDecoratorNames(tokens, masked, lineStarts);
  addReturnTypeQualifiedMembers(tokens, masked, lineStarts);
  addTypedLanguageMemberTokens(tokens, masked, lineStarts);
  addClassFieldTokens(tokens, masked, lineStarts);

  for (const match of masked.matchAll(/\bfunction(?:\s+[A-Za-z_$][\w$]*)?\s*\(([^()]*)\)/gu)) {
    const group = match[1] ?? '';
    addParameterGroup(tokens, masked, lineStarts, (match.index ?? 0) + match[0].indexOf(group), group);
  }
  for (const match of masked.matchAll(/\(([^()]*)\)\s*(?::[^=;{]+)?=>/gu)) {
    const group = match[1] ?? '';
    addParameterGroup(tokens, masked, lineStarts, (match.index ?? 0) + match[0].indexOf(group), group);
  }
  for (const match of masked.matchAll(
    /(?:^|\n)\s*(?:(?:public|private|protected|static|async|override|get|set)\s+)*[A-Za-z_$][\w$]*\s*\(([^()]*)\)\s*(?::[^{]+)?\{/gu,
  )) {
    const group = match[1] ?? '';
    addParameterGroup(tokens, masked, lineStarts, (match.index ?? 0) + match[0].indexOf(group), group);
  }
  for (const match of masked.matchAll(/\b([A-Za-z_$][\w$]*)\s*=>/gu)) {
    const value = match[1] ?? '';
    if (value === '' || RESERVED_WORDS.has(value)) continue;
    const token = semanticTokenAt(
      masked,
      lineStarts,
      (match.index ?? 0) + match[0].indexOf(value),
      value.length,
      'ideaParameter',
      94,
    );
    if (token !== null) tokens.push(token);
  }

  for (const match of masked.matchAll(/\bimport\s+([^;]+?)\s+from\b/gu)) {
    const clause = match[1] ?? '';
    const clauseOffset = (match.index ?? 0) + match[0].indexOf(clause);
    for (const identifier of clause.matchAll(IDENTIFIER)) {
      const value = identifier[0];
      if (RESERVED_WORDS.has(value)) continue;
      const offset = clauseOffset + (identifier.index ?? 0);
      const token = semanticTokenAt(masked, lineStarts, offset, value.length, 'ideaGlobalVariable', 80);
      if (token !== null) tokens.push(token);
    }
  }

  if (languageId !== 'c' && languageId !== 'cpp') {
    for (const match of masked.matchAll(/(?<![*\w$])(?:const|let|var)\s+([A-Za-z_$][\w$]*)/gu)) {
      const value = match[1] ?? '';
      const offset = (match.index ?? 0) + match[0].lastIndexOf(value);
      const token = semanticTokenAt(masked, lineStarts, offset, value.length, 'ideaVariable', 70);
      if (token !== null) tokens.push(token);
    }
  }
  for (const match of masked.matchAll(/\b(?:const|let|var)\s*([\[{])/gu)) {
    const open = match[1] ?? '';
    const start = (match.index ?? 0) + match[0].lastIndexOf(open);
    const close = open === '[' ? ']' : '}';
    const end = matchingBrace(masked, start, open, close);
    if (end < 0) continue;
    for (const identifier of masked.slice(start + 1, end).matchAll(IDENTIFIER)) {
      const value = identifier[0];
      const offset = start + 1 + (identifier.index ?? 0);
      const token = semanticTokenAt(masked, lineStarts, offset, value.length, 'ideaVariable', 68);
      if (token !== null) tokens.push(token);
    }
  }

  for (const match of masked.matchAll(/\.\s*([A-Za-z_$][\w$]*)\s*(\()?/gu)) {
    const value = match[1] ?? '';
    if (value === '') continue;
    const memberOffset = (match.index ?? 0) + match[0].indexOf(value);
    const next = masked.slice(memberOffset + value.length).trimStart()[0] ?? '';
    const token = semanticTokenAt(
      masked,
      lineStarts,
      memberOffset,
      value.length,
      next === '(' ? 'ideaMethod' : 'ideaProperty',
      55,
    );
    if (token !== null) tokens.push(token);
  }

  for (const match of masked.matchAll(/\b([A-Za-z_$][\w$]*)\s*\(/gu)) {
    const value = match[1] ?? '';
    if (value === '' || RESERVED_WORDS.has(value)) continue;
    const offset = (match.index ?? 0) + match[0].indexOf(value);
    const before = masked.slice(Math.max(0, offset - 16), offset).trimEnd();
    if (before.endsWith('.') || before.endsWith('function') || before.endsWith('new')) continue;
    if ((languageId === 'c' || languageId === 'cpp') && C_FAMILY_TYPE_KEYWORDS.has(value)) continue;
    if (
      (languageId === 'c' || languageId === 'cpp') &&
      (before.endsWith('(') || before.endsWith('*') || before.endsWith('&'))
    ) {
      continue;
    }
    const token = semanticTokenAt(masked, lineStarts, offset, value.length, 'ideaMethod', 45);
    if (token !== null) tokens.push(token);
  }

  for (const match of masked.matchAll(/\breturn\s+([A-Za-z_$][\w$]*)/gu)) {
    const value = match[1] ?? '';
    if (value === '' || RESERVED_WORDS.has(value)) continue;
    const offset = (match.index ?? 0) + match[0].lastIndexOf(value);
    const token = semanticTokenAt(masked, lineStarts, offset, value.length, 'ideaVariable', 35);
    if (token !== null) tokens.push(token);
  }
  return tokens;
}

/** Prevent overlapping semantic spans; Monaco rejects overlapping tokens. */
export function mergeIdeaLightSemanticTokens(tokens: readonly IdeaLightSemanticToken[]): IdeaLightSemanticToken[] {
  const sorted = [...tokens]
    .filter(
      (token) =>
        Number.isInteger(token.line) &&
        token.line >= 0 &&
        Number.isInteger(token.startCharacter) &&
        token.startCharacter >= 0 &&
        Number.isInteger(token.length) &&
        token.length > 0,
    )
    .sort(
      (left, right) =>
        left.line - right.line ||
        left.startCharacter - right.startCharacter ||
        (right.priority ?? 0) - (left.priority ?? 0) ||
        right.length - left.length,
    );
  const accepted: IdeaLightSemanticToken[] = [];
  let currentLine = -1;
  let currentEnd = -1;
  for (const token of sorted) {
    const start = token.startCharacter;
    const end = start + token.length;
    if (token.line !== currentLine) {
      currentLine = token.line;
      currentEnd = end;
      accepted.push(token);
      continue;
    }
    if (start < currentEnd) continue;
    currentEnd = end;
    accepted.push(token);
  }
  return accepted;
}

export interface IdeaLightSemanticRange {
  startLine: number;
  startCharacter: number;
  endLine: number;
  endCharacter: number;
}

/** Clip relative semantic tokens into a requested zero-based document range. */
export function clipIdeaLightSemanticTokensToRange(
  tokens: readonly IdeaLightSemanticToken[],
  range: IdeaLightSemanticRange,
  lineOffset = 0,
): IdeaLightSemanticToken[] {
  const startLine = Math.max(0, Math.floor(range.startLine));
  const endLine = Math.max(startLine, Math.floor(range.endLine));
  const startCharacter = Math.max(0, Math.floor(range.startCharacter));
  const endCharacter = Math.max(0, Math.floor(range.endCharacter));
  const clipped: IdeaLightSemanticToken[] = [];
  for (const token of tokens) {
    const line = token.line + Math.max(0, Math.floor(lineOffset));
    if (line < startLine || line > endLine) continue;
    const originalStart = token.startCharacter;
    const originalEnd = originalStart + token.length;
    const minimum = line === startLine ? startCharacter : 0;
    const maximum = line === endLine ? endCharacter : Number.MAX_SAFE_INTEGER;
    const start = Math.max(originalStart, minimum);
    const end = Math.min(originalEnd, maximum);
    if (end <= start) continue;
    clipped.push({ ...token, line, startCharacter: start, length: end - start });
  }
  return clipped;
}

export interface IdeaLightTextStyleRange {
  start: number;
  end: number;
  tokenType: string;
  foreground: string;
  fontStyle?: 'italic';
}

/** Resolve one semantic token type to its shared Monaco decoration class. */
export function ideaLightSemanticTokenClass(tokenType: string): string | null {
  return IDEA_LIGHT_SEMANTIC_TOKEN_CLASS[tokenType as keyof typeof IDEA_LIGHT_SEMANTIC_TOKEN_CLASS] ?? null;
}

/** Resolve one semantic token type to the IDEA Light foreground and italic flag. */
export function ideaLightSemanticTokenStyle(
  tokenType: string,
): Pick<IdeaLightTextStyleRange, 'foreground' | 'fontStyle'> | null {
  const colors = IDEA_LIGHT_TOKEN_COLORS;
  switch (tokenType) {
    case 'ideaClass':
    case 'ideaInterface':
    case 'ideaEnum':
    case 'ideaTypeAlias':
    case 'ideaModule':
    case 'ideaParameter':
      return { foreground: `#${colors.class}` };
    case 'ideaTypeParameter':
      return { foreground: `#${colors.typeParameter}` };
    case 'ideaFunction':
      return { foreground: `#${colors.function}`, fontStyle: 'italic' };
    case 'ideaMethod':
      return { foreground: `#${colors.method}` };
    case 'ideaProperty':
      return { foreground: `#${colors.property}` };
    case 'ideaVariable':
      return { foreground: `#${colors.localVariable}` };
    case 'ideaGlobalVariable':
      return { foreground: `#${colors.globalVariable}`, fontStyle: 'italic' };
    case 'ideaConstant':
      return { foreground: `#${colors.constant}` };
    case 'ideaJsxComponent':
      return { foreground: `#${colors.jsxComponent}` };
    case 'ideaAnnotation':
      return { foreground: `#${colors.annotation}` };
    default:
      return null;
  }
}

/** Convert heuristic semantic tokens into absolute character ranges for preview HTML. */
export function ideLightTextStyleRanges(text: string): IdeaLightTextStyleRange[] {
  const source = typeof text === 'string' ? text : '';
  const starts = lineStartOffsets(source);
  return mergeIdeaLightSemanticTokens(collectIdeaLightHeuristicSemanticTokens(source))
    .map((token) => {
      const style = ideaLightSemanticTokenStyle(String(token.tokenType));
      if (style === null) return null;
      const start = (starts[token.line] ?? 0) + token.startCharacter;
      return {
        start,
        end: start + token.length,
        tokenType: String(token.tokenType),
        ...style,
      };
    })
    .filter((range): range is IdeaLightTextStyleRange => range !== null);
}

/** Encode semantic tokens in Monaco's sorted, delta-based wire format. */
export function encodeIdeaLightSemanticTokens(tokens: readonly IdeaLightSemanticToken[]): Uint32Array {
  const merged = mergeIdeaLightSemanticTokens(tokens);
  const typeIndex = new Map<string, number>(
    IDEA_LIGHT_SEMANTIC_TOKEN_TYPES.map((tokenType, index) => [tokenType, index]),
  );
  const data: number[] = [];
  let previousLine = 0;
  let previousStart = 0;
  for (const token of merged) {
    const tokenType = typeof token.tokenType === 'number' ? token.tokenType : (typeIndex.get(token.tokenType) ?? 0);
    const deltaLine = token.line - previousLine;
    const deltaStart = deltaLine === 0 ? token.startCharacter - previousStart : token.startCharacter;
    data.push(deltaLine, deltaStart, token.length, tokenType, token.tokenModifiers ?? 0);
    previousLine = token.line;
    previousStart = token.startCharacter;
  }
  return Uint32Array.from(data);
}
