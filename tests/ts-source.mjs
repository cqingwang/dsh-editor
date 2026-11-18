import { transformSync } from '@babel/core';
import { parse } from '@babel/parser';

/** Extract one function declaration by brace balance. */
export function extractFunctionSource(source, name) {
  try {
    const ast = parse(source, {
      sourceType: 'module',
      plugins: ['typescript', 'jsx'],
    });
    const queue = [ast];
    while (queue.length > 0) {
      const node = queue.shift();
      if (node === null || typeof node !== 'object') continue;
      if (node.type === 'FunctionDeclaration' && node.id?.name === name && typeof node.start === 'number' && typeof node.end === 'number') {
        return source.slice(node.start, node.end).replace(/^export\s+/u, '').trim();
      }
      for (const [key, value] of Object.entries(node)) {
        if (key === 'loc' || key === 'start' || key === 'end' || key === 'extra') continue;
        if (Array.isArray(value)) queue.push(...value);
        else if (value !== null && typeof value === 'object') queue.push(value);
      }
    }
  } catch {
    /* Fall back to textual brace matching for non-standard fragments. */
  }
  const candidates = [
    `export async function ${name}(`,
    `export async function ${name}<`,
    `export function ${name}(`,
    `export function ${name}<`,
    `async function ${name}(`,
    `async function ${name}<`,
    `function ${name}(`,
    `function ${name}<`,
  ]
    .map((marker) => source.indexOf(marker))
    .filter((index) => index >= 0);
  const start = candidates.length === 0 ? -1 : Math.min(...candidates);
  if (start < 0) throw new Error(`${name} is missing`);
  const parameterStart = source.indexOf('(', start);
  let quote = '';
  let escaped = false;
  let parameterDepth = 0;
  let parameterEnd = -1;
  for (let index = parameterStart; index < source.length; index += 1) {
    const character = source[index];
    if (quote !== '') {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === quote) quote = '';
      continue;
    }
    if (character === "'" || character === '"' || character === '`') {
      quote = character;
      continue;
    }
    if (character === '(') parameterDepth += 1;
    if (character === ')') {
      parameterDepth -= 1;
      if (parameterDepth === 0) {
        parameterEnd = index;
        break;
      }
    }
  }
  if (parameterEnd < 0) throw new Error(`${name} has no balanced parameters`);
  let index = source.indexOf('{', parameterEnd);
  let depth = 0;
  for (; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    else if (source[index] === '}') {
      depth -= 1;
      if (depth === 0) {
        return source
          .slice(start, index + 1)
          .replace(/^export\s+/u, '')
          .trim();
      }
    }
  }
  throw new Error(`unbalanced braces in ${name}`);
}

/**
 * Extract one JavaScript function declaration from generated client output.
 *
 * Babel removes TypeScript annotations while retaining source line breaks, so a
 * typed signature can span several lines and contain default parameter braces
 * such as `options = {}` before the actual function body. Locate the parameter
 * list first, then use the following opening brace as the body.
 */
export function extractJavaScriptFunctionSource(source, name) {
  const plain = source.indexOf(`function ${name}(`);
  const asynchronous = source.indexOf(`async function ${name}(`);
  const start = plain >= 0 ? plain : asynchronous;
  if (start < 0) throw new Error(`${name} is missing`);
  const parameterStart = source.indexOf('(', start);
  if (parameterStart < 0) throw new Error(`${name} has no parameter list`);

  let quote = '';
  let escaped = false;
  let parameterDepth = 0;
  let parameterEnd = -1;
  for (let index = parameterStart; index < source.length; index += 1) {
    const character = source[index];
    if (quote !== '') {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === quote) quote = '';
      continue;
    }
    if (character === "'" || character === '"' || character === '`') {
      quote = character;
      continue;
    }
    if (character === '(') parameterDepth += 1;
    if (character === ')') {
      parameterDepth -= 1;
      if (parameterDepth === 0) {
        parameterEnd = index;
        break;
      }
    }
  }
  if (parameterEnd < 0) throw new Error(`${name} has an unbalanced parameter list`);

  const bodyStart = source.indexOf('{', parameterEnd);
  if (bodyStart < 0) throw new Error(`${name} has no function body`);
  let depth = 0;
  for (let index = bodyStart; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, index + 1);
    }
  }
  throw new Error(`unbalanced braces in ${name}`);
}

/** Compile one TypeScript function declaration to executable JavaScript. */
export function transpileTypeScriptFunction(source, name) {
  const functionSource = extractFunctionSource(source, name);
  const result = transformSync(functionSource, {
    filename: `${name}.ts`,
    plugins: [['@babel/plugin-transform-typescript', { isTSX: false, allExtensions: true }]],
    configFile: false,
    babelrc: false,
  });
  if (typeof result?.code !== 'string' || result.code.trim() === '') {
    throw new Error(`${name} transpiled to empty JavaScript`);
  }
  return result.code;
}

/** Load one exported TypeScript function for executable unit tests. */
export function loadTypeScriptFunction(source, name) {
  const code = transpileTypeScriptFunction(source, name);
  return new Function(`${code}\nreturn ${name};`)();
}

/** Extract the first argument of a variable initializer such as `const x = React.useCallback(expr, deps)`. */
export function extractInlineExpression(source, variableName) {
  const ast = parse(source, {
    sourceType: 'module',
    plugins: ['typescript', 'jsx'],
  });
  const queue = [ast];
  while (queue.length > 0) {
    const node = queue.shift();
    if (node === null || typeof node !== 'object') continue;
    if (
      node.type === 'VariableDeclarator' &&
      node.id?.type === 'Identifier' &&
      node.id.name === variableName &&
      node.init?.type === 'CallExpression' &&
      node.init.arguments.length > 0 &&
      typeof node.init.arguments[0].start === 'number' &&
      typeof node.init.arguments[0].end === 'number'
    ) {
      return source.slice(node.init.arguments[0].start, node.init.arguments[0].end);
    }
    for (const [key, value] of Object.entries(node)) {
      if (key === 'loc' || key === 'start' || key === 'end' || key === 'extra') continue;
      if (Array.isArray(value)) queue.push(...value);
      else if (value !== null && typeof value === 'object') queue.push(value);
    }
  }
  throw new Error(`${variableName} inline expression is missing`);
}

/** Extract a variable initializer expression whether or not it is a callback wrapper. */
export function extractVariableInitializerExpression(source, variableName) {
  const ast = parse(source, {
    sourceType: 'module',
    plugins: ['typescript', 'jsx'],
  });
  const queue = [ast];
  while (queue.length > 0) {
    const node = queue.shift();
    if (node === null || typeof node !== 'object') continue;
    if (
      node.type === 'VariableDeclarator' &&
      node.id?.type === 'Identifier' &&
      node.id.name === variableName &&
      typeof node.init?.start === 'number' &&
      typeof node.init.end === 'number'
    ) {
      return source.slice(node.init.start, node.init.end);
    }
    for (const [key, value] of Object.entries(node)) {
      if (key === 'loc' || key === 'start' || key === 'end' || key === 'extra') continue;
      if (Array.isArray(value)) queue.push(...value);
      else if (value !== null && typeof value === 'object') queue.push(value);
    }
  }
  throw new Error(`${variableName} initializer is missing`);
}

/** Compile and evaluate an expression against an explicit dependency scope. */
export function loadTypeScriptExpression(source, expression, scope) {
  const result = transformSync(expression, {
    filename: 'inline-expression.ts',
    plugins: [['@babel/plugin-transform-typescript', { isTSX: false, allExtensions: true }]],
    configFile: false,
    babelrc: false,
  });
  if (typeof result?.code !== 'string' || result.code.trim() === '') {
    throw new Error('inline expression transpiled to empty JavaScript');
  }
  const compiledExpression = result.code.trim().replace(/;$/u, '');
  return new Function('scope', `with (scope) { return (${compiledExpression}); }`)(scope);
}

/** Load one `const name = React.useCallback(expr, deps)` callback for direct execution. */
export function loadTypeScriptCallback(source, variableName, scope) {
  return loadTypeScriptExpression(source, extractInlineExpression(source, variableName), scope);
}

/** Extract the callback argument of the first React effect after a source marker. */
export function extractUseEffectExpressionAfter(source, marker) {
  const markerIndex = source.indexOf(marker);
  if (markerIndex < 0) throw new Error(`effect marker is missing: ${marker}`);
  const ast = parse(source, {
    sourceType: 'module',
    plugins: ['typescript', 'jsx'],
  });
  const queue = [ast];
  const matches = [];
  while (queue.length > 0) {
    const node = queue.shift();
    if (node === null || typeof node !== 'object') continue;
    if (
      node.type === 'CallExpression' &&
      node.start >= markerIndex &&
      node.callee?.type === 'MemberExpression' &&
      node.callee.property?.name === 'useEffect' &&
      node.arguments.length > 0 &&
      typeof node.arguments[0].start === 'number' &&
      typeof node.arguments[0].end === 'number'
    ) {
      matches.push(node);
    }
    for (const [key, value] of Object.entries(node)) {
      if (key === 'loc' || key === 'start' || key === 'end' || key === 'extra') continue;
      if (Array.isArray(value)) queue.push(...value);
      else if (value !== null && typeof value === 'object') queue.push(value);
    }
  }
  matches.sort((left, right) => left.start - right.start);
  if (matches.length === 0) throw new Error(`React.useEffect is missing after ${marker}`);
  const argument = matches[0].arguments[0];
  return source.slice(argument.start, argument.end);
}

/** Extract the callback of the first React effect whose source contains a marker. */
export function extractUseEffectExpressionContaining(source, marker) {
  const ast = parse(source, {
    sourceType: 'module',
    plugins: ['typescript', 'jsx'],
  });
  const queue = [ast];
  while (queue.length > 0) {
    const node = queue.shift();
    if (node === null || typeof node !== 'object') continue;
    if (
      node.type === 'CallExpression' &&
      node.callee?.type === 'MemberExpression' &&
      node.callee.property?.name === 'useEffect' &&
      node.arguments.length > 0 &&
      typeof node.arguments[0].start === 'number' &&
      typeof node.arguments[0].end === 'number' &&
      source.slice(node.arguments[0].start, node.arguments[0].end).includes(marker)
    ) {
      return source.slice(node.arguments[0].start, node.arguments[0].end);
    }
    for (const [key, value] of Object.entries(node)) {
      if (key === 'loc' || key === 'start' || key === 'end' || key === 'extra') continue;
      if (Array.isArray(value)) queue.push(...value);
      else if (value !== null && typeof value === 'object') queue.push(value);
    }
  }
  throw new Error(`React.useEffect containing ${marker} is missing`);
}

/** Remove statement-level module syntax before executing source in test scope. */
function stripModuleSyntax(source) {
  try {
    const ast = parse(source, {
      sourceType: 'module',
      plugins: ['typescript', 'jsx'],
    });
    let localSource = source;
    const ranges = [];
    for (const statement of ast.program.body) {
      if (statement.type === 'ImportDeclaration' || statement.type === 'ExportAllDeclaration') {
        ranges.push([statement.start, statement.end]);
        continue;
      }
      if (statement.type === 'ExportNamedDeclaration') {
        if (statement.declaration === null) {
          ranges.push([statement.start, statement.end]);
        } else {
          ranges.push([statement.start, statement.declaration.start]);
        }
        continue;
      }
      if (statement.type === 'ExportDefaultDeclaration') {
        ranges.push([statement.start, statement.declaration.start]);
      }
    }
    for (const [start, end] of ranges.sort((left, right) => right[0] - left[0])) {
      localSource = `${localSource.slice(0, start)}${localSource.slice(end)}`;
    }
    return localSource;
  } catch {
    return source.replace(/^import[\s\S]*?;\n/gm, '');
  }
}

/**
 * Behavior-test execution helper for merged-scope source modules.
 *
 * Import correctness is not inferred from this execution: it is checked
 * directly against the TS/TSX source AST by
 * scripts/check-client-source-imports.mjs.
 */
export function transpileTypeScriptSource(source) {
  const localSource = stripModuleSyntax(source)
    .replace(/^export\s+(?=(?:(?:async\s+)?function|const|let|var|class)\b)/gm, '')
    .replace(/^export\s*\{[^}]*\};\s*$/gm, '');
  const result = transformSync(localSource, {
    filename: 'module.ts',
    plugins: [['@babel/plugin-transform-typescript', { isTSX: false, allExtensions: true }]],
    configFile: false,
    babelrc: false,
  });
  if (typeof result?.code !== 'string' || result.code.trim() === '') {
    throw new Error('TypeScript module transpiled to empty JavaScript');
  }
  return result.code.replace(/^export\s*\{\s*\};\s*$/gm, '');
}

/** Load named values from a local TypeScript module for executable tests. */
export function loadTypeScriptModule(source, names) {
  const code = transpileTypeScriptSource(source);
  return new Function(`${code}\nreturn { ${names.join(', ')} };`)();
}
