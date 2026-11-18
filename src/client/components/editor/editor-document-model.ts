export type MarkdownMode = 'code' | 'split' | 'preview';

export function normalizeMarkdownMode(value: unknown): MarkdownMode {
  return value === 'code' || value === 'split' || value === 'preview' ? value : 'code';
}

export function isMarkdownPath(path: unknown): boolean {
  return typeof path === 'string' && /\.(?:md|markdown|mdx)$/iu.test(path);
}
