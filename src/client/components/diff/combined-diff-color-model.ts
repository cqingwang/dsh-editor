import type * as Monaco from 'monaco-editor';
import { ideaLightSemanticTokenClass, ideLightTextStyleRanges } from '../editor/editor-theme-model';
import { safeLanguage } from '../../editor-core';

export interface CombinedDiffColorFile {
  path: string;
  line?: number;
  endLine?: number;
  originalLine?: number;
  originalEndLine?: number;
  binary?: boolean;
}

export interface CombinedDiffDecorationSpec {
  startLineNumber: number;
  startColumn: number;
  endLineNumber: number;
  endColumn: number;
  inlineClassName: string;
}

export const COMBINED_DIFF_COLOR_MAX_FILE_CHARS = 64 * 1024;
export const COMBINED_DIFF_COLOR_MAX_TOTAL_CHARS = 512 * 1024;

export interface CombinedDiffColorBudget {
  remaining: number;
}

/** Create a bounded character budget for one combined-diff decoration pass. */
export function createCombinedDiffColorBudget(maximum = COMBINED_DIFF_COLOR_MAX_TOTAL_CHARS): CombinedDiffColorBudget {
  return { remaining: Math.max(0, Math.floor(Number(maximum) || 0)) };
}

/** Consume budget only when one file body is colorizable within both bounds. */
export function takeCombinedDiffColorBudget(
  budget: CombinedDiffColorBudget,
  text: string,
  maximumPerFile = COMBINED_DIFF_COLOR_MAX_FILE_CHARS,
): boolean {
  const length = typeof text === 'string' ? text.length : 0;
  const perFile = Math.max(0, Math.floor(Number(maximumPerFile) || 0));
  if (length <= 0 || length > perFile || length > budget.remaining) return false;
  budget.remaining -= length;
  return true;
}

interface OffsetRange {
  start: number;
  end: number;
  inlineClassName: string;
}

function lineStartsFor(text: string): number[] {
  const starts = [0];
  for (let index = 0; index < text.length; index += 1) {
    if (text[index] === '\n') starts.push(index + 1);
  }
  return starts;
}

function positionAtOffset(starts: number[], offset: number): { lineNumber: number; column: number } {
  let low = 0;
  let high = starts.length - 1;
  while (low <= high) {
    const middle = (low + high) >> 1;
    if (starts[middle] <= offset) low = middle + 1;
    else high = middle - 1;
  }
  const line = Math.max(0, high);
  return { lineNumber: line + 1, column: offset - starts[line] + 1 };
}

function offsetRangeToSpec(
  starts: number[],
  lineOffset: number,
  range: OffsetRange,
): CombinedDiffDecorationSpec | null {
  if (range.end <= range.start || range.inlineClassName === '') return null;
  const start = positionAtOffset(starts, range.start);
  const end = positionAtOffset(starts, range.end);
  return {
    startLineNumber: start.lineNumber + lineOffset,
    startColumn: start.column,
    endLineNumber: end.lineNumber + lineOffset,
    endColumn: end.column,
    inlineClassName: range.inlineClassName,
  };
}

function mergeOffsetRanges(ranges: OffsetRange[]): OffsetRange[] {
  const sorted = [...ranges].sort((left, right) => left.start - right.start || right.end - left.end);
  const merged: OffsetRange[] = [];
  for (const range of sorted) {
    const previous = merged[merged.length - 1];
    if (previous !== undefined && previous.inlineClassName === range.inlineClassName && range.start <= previous.end) {
      previous.end = Math.max(previous.end, range.end);
      continue;
    }
    merged.push({ ...range });
  }
  return merged;
}

function colorizedHtmlRanges(html: string): OffsetRange[] {
  const root = document.createElement('div');
  root.innerHTML = html;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const ranges: OffsetRange[] = [];
  let offset = 0;
  for (let node = walker.nextNode(); node !== null; node = walker.nextNode()) {
    const text = node.nodeValue ?? '';
    let element = node.parentElement;
    let className = '';
    while (element !== null && element !== root) {
      className = [...element.classList].find((name) => /^mtk\d+$/u.test(name)) ?? '';
      if (className !== '') break;
      element = element.parentElement;
    }
    if (className !== '' && text !== '') {
      ranges.push({
        start: offset,
        end: offset + text.length,
        inlineClassName: className,
      });
    }
    offset += text.length;
  }
  return mergeOffsetRanges(ranges);
}

/** Convert semantic token ranges to Monaco inline decoration specs. */
export function combinedDiffSemanticDecorationSpecs(text: string): CombinedDiffDecorationSpec[] {
  const starts = lineStartsFor(text);
  return ideLightTextStyleRanges(text)
    .map((range) => {
      const className = ideaLightSemanticTokenClass(range.tokenType);
      if (className === null) return null;
      return offsetRangeToSpec(starts, 0, {
        start: range.start,
        end: range.end,
        inlineClassName: className,
      });
    })
    .filter((spec): spec is CombinedDiffDecorationSpec => spec !== null);
}

/** Turn one colorized file body into theme-class decoration specs. */
export function combinedDiffColorizedDecorationSpecs(text: string, html: string): CombinedDiffDecorationSpec[] {
  const starts = lineStartsFor(text);
  const fragments = String(html).split('<br/>');
  const specs: CombinedDiffDecorationSpec[] = [];
  for (let index = 0; index < fragments.length; index += 1) {
    const lineStart = starts[index];
    if (lineStart === undefined) break;
    for (const range of colorizedHtmlRanges(fragments[index])) {
      const spec = offsetRangeToSpec(starts, 0, {
        start: lineStart + range.start,
        end: lineStart + range.end,
        inlineClassName: range.inlineClassName,
      });
      if (spec !== null) specs.push(spec);
    }
  }
  return specs;
}

/** Decorate one combined-file body with IDEA lexical and semantic token colors. */
export async function combinedDiffDecorationSpecs(
  monaco: typeof Monaco,
  path: string,
  text: string,
): Promise<CombinedDiffDecorationSpec[]> {
  if (text === '') return [];
  const html = await monaco.editor.colorize(text, safeLanguage(monaco, path), { tabSize: 2 });
  return [...combinedDiffColorizedDecorationSpecs(text, html), ...combinedDiffSemanticDecorationSpecs(text)];
}

/** Read one file body from a combined-diff model without including its heading. */
export function combinedDiffBodyLines(
  lines: readonly string[],
  file: CombinedDiffColorFile,
  side: 'original' | 'modified',
): { lines: string[]; firstLineNumber: number } | null {
  const heading = Number(side === 'original' ? file.originalLine : file.line);
  const end = Number(side === 'original' ? file.originalEndLine : file.endLine);
  if (!Number.isFinite(heading) || !Number.isFinite(end) || end <= heading) return null;
  let startIndex = heading;
  let endIndex = end;
  const body = lines.slice(startIndex, endIndex);
  while (body.length > 0 && body[body.length - 1] === '') body.pop();
  if (body.length === 0) return null;
  return { lines: body, firstLineNumber: heading + 1 };
}
