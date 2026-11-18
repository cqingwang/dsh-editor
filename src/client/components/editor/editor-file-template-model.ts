export type EditorFileTemplateExtension =
  | 'ts'
  | 'tsx'
  | 'js'
  | 'jsx'
  | 'mjs'
  | 'cjs'
  | 'py'
  | 'md'
  | 'markdown'
  | 'go'
  | 'sh'
  | 'bash'
  | 'zsh'
  | 'json'
  | 'css'
  | 'html';

export function templateFor(name: unknown): string {
  const clean = typeof name === 'string' ? name.trim() : '';
  const dot = clean.lastIndexOf('.');
  if (dot <= 0 || dot === clean.length - 1) return '';
  const extension = clean.slice(dot + 1).toLowerCase() as EditorFileTemplateExtension;
  const base = clean.slice(0, dot);
  switch (extension) {
    case 'ts':
    case 'tsx':
      return 'export {};\n';
    case 'js':
    case 'jsx':
    case 'mjs':
    case 'cjs':
      return "'use strict';\n";
    case 'py':
      return `"""${base}."""\n`;
    case 'md':
    case 'markdown':
      return `# ${base}\n`;
    case 'go':
      return 'package main\n';
    case 'sh':
    case 'bash':
    case 'zsh':
      return '#!/usr/bin/env bash\nset -euo pipefail\n';
    case 'json':
      return '{}\n';
    case 'css':
      return '';
    case 'html':
      return `<!doctype html>\n<html lang="en">\n  <head>\n    <meta charset="utf-8" />\n    <title>${base}</title>\n  </head>\n  <body></body>\n</html>\n`;
    default:
      return '';
  }
}
