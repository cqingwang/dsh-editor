#!/usr/bin/env node
/**
 * Verify source-level imports for exported symbols shared by client modules.
 *
 * The browser artifact is assembled into one DSH factory scope, but source
 * modules must still state where exported helpers come from. Reading the
 * generated lib/client.js cannot prove that: the builder strips imports before
 * assembly and would hide an omitted dependency. This check only inspects the
 * TypeScript source AST.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const clientDir = process.argv[2] === undefined ? join(root, 'src', 'client') : resolve(process.argv[2]);
const allSourceFiles = readdirSync(clientDir, { recursive: true })
  .filter((name) => typeof name === 'string' && (name.endsWith('.ts') || name.endsWith('.tsx')))
  .sort((left, right) => left.localeCompare(right, 'en'));

function sourceFileFor(fileName) {
  const text = readFileSync(join(clientDir, fileName), 'utf8');
  return {
    fileName,
    sourceFile: ts.createSourceFile(
      fileName,
      text,
      ts.ScriptTarget.Latest,
      true,
      fileName.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    ),
  };
}

function hasModifier(node, kind) {
  return ts.canHaveModifiers(node) && ts.getModifiers(node)?.some((modifier) => modifier.kind === kind) === true;
}

function declarationIdentifierNames(node) {
  if (
    (ts.isFunctionDeclaration(node) ||
      ts.isClassDeclaration(node) ||
      ts.isInterfaceDeclaration(node) ||
      ts.isTypeAliasDeclaration(node) ||
      ts.isEnumDeclaration(node)) &&
    node.name !== undefined &&
    ts.isIdentifier(node.name)
  ) {
    return [node.name.text];
  }
  if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) return [node.name.text];
  return [];
}

function exportedNames(sourceFile) {
  const names = new Set();
  for (const statement of sourceFile.statements) {
    if (!hasModifier(statement, ts.SyntaxKind.ExportKeyword)) continue;
    for (const name of declarationIdentifierNames(statement)) names.add(name);
    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name)) names.add(declaration.name.text);
      }
    }
  }
  return names;
}

function importedNames(sourceFile) {
  const names = new Set();
  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement) || statement.importClause === undefined) continue;
    if (statement.importClause.name !== undefined) names.add(statement.importClause.name.text);
    const bindings = statement.importClause.namedBindings;
    if (bindings === undefined) continue;
    if (ts.isNamespaceImport(bindings)) names.add(bindings.name.text);
    if (ts.isNamedImports(bindings)) {
      for (const element of bindings.elements) names.add(element.name.text);
    }
  }
  return names;
}

function locallyDeclaredNames(sourceFile) {
  const names = new Set();
  const addBindingName = (name) => {
    if (ts.isIdentifier(name)) {
      names.add(name.text);
      return;
    }
    if (!ts.isObjectBindingPattern(name) && !ts.isArrayBindingPattern(name)) return;
    for (const element of name.elements) {
      if (ts.isBindingElement(element)) addBindingName(element.name);
    }
  };
  const visit = (node) => {
    if (ts.isVariableDeclaration(node) || ts.isParameter(node) || ts.isBindingElement(node)) addBindingName(node.name);
    if (
      (ts.isFunctionDeclaration(node) ||
        ts.isFunctionExpression(node) ||
        ts.isClassDeclaration(node) ||
        ts.isClassExpression(node) ||
        ts.isInterfaceDeclaration(node) ||
        ts.isTypeAliasDeclaration(node) ||
        ts.isEnumDeclaration(node)) &&
      node.name !== undefined
    ) {
      names.add(node.name.text);
    }
    if (ts.isTypeParameterDeclaration(node)) names.add(node.name.text);
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return names;
}

function isReferenceIdentifier(node) {
  const parent = node.parent;
  if (
    ts.isImportClause(parent) ||
    ts.isImportSpecifier(parent) ||
    ts.isNamespaceImport(parent) ||
    ts.isExportSpecifier(parent)
  ) {
    return false;
  }
  if (ts.isPropertyAccessExpression(parent) && parent.name === node) return false;
  if (ts.isQualifiedName(parent) && parent.right === node) return false;
  if (ts.isPropertyAssignment(parent) && parent.name === node) return false;
  if (
    (ts.isMethodDeclaration(parent) ||
      ts.isMethodSignature(parent) ||
      ts.isPropertyDeclaration(parent) ||
      ts.isPropertySignature(parent)) &&
    parent.name === node
  ) {
    return false;
  }
  if (ts.isBindingElement(parent) && parent.propertyName === node) return false;
  return true;
}

function referencedNames(sourceFile) {
  const names = new Map();
  const visit = (node) => {
    if (ts.isIdentifier(node) && isReferenceIdentifier(node)) {
      if (!names.has(node.text)) {
        const position = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
        names.set(node.text, { line: position.line + 1, column: position.character + 1 });
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return names;
}

const parsedSourceFiles = allSourceFiles.map((fileName) => {
  const { sourceFile } = sourceFileFor(fileName);
  return {
    fileName,
    sourceFile,
    exported: exportedNames(sourceFile),
    imported: importedNames(sourceFile),
    local: locallyDeclaredNames(sourceFile),
  };
});

const exportOwners = new Map();
for (const module of parsedSourceFiles) {
  for (const name of module.exported) {
    if (!exportOwners.has(name)) exportOwners.set(name, []);
    exportOwners.get(name).push(module.fileName);
  }
}

const violations = [];
for (const module of parsedSourceFiles) {
  for (const [name, position] of referencedNames(module.sourceFile)) {
    if (module.imported.has(name) || module.local.has(name)) continue;
    const owners = exportOwners.get(name)?.filter((owner) => owner !== module.fileName) ?? [];
    if (owners.length === 0) continue;
    violations.push({
      fileName: module.fileName,
      line: position.line,
      column: position.column,
      name,
      owners,
    });
  }
}

violations.sort(
  (left, right) =>
    left.fileName.localeCompare(right.fileName, 'en') ||
    left.line - right.line ||
    left.column - right.column ||
    left.name.localeCompare(right.name, 'en'),
);

if (violations.length > 0) {
  console.error(`client-source-imports: ${violations.length} missing source import(s)`);
  for (const violation of violations) {
    console.error(
      `  src/client/${violation.fileName}:${violation.line}:${violation.column} ${violation.name} <- ${violation.owners
        .map((owner) => `src/client/${owner}`)
        .join(', ')}`,
    );
  }
  process.exit(1);
}

console.log(`client-source-imports: ${allSourceFiles.length} source modules verified`);
