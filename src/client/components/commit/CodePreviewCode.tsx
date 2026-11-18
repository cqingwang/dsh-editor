import React from 'react';
import { styles } from '../../ui/styles';

export interface CodePreviewSegment {
  text: string;
  match?: boolean;
}

export interface CodePreviewCodeProps {
  text: string;
  html?: string | null;
  segments?: CodePreviewSegment[] | null;
  style?: React.CSSProperties;
}

declare function codePreviewMatchRanges(segments?: CodePreviewSegment[] | null): Array<{ start: number; end: number }>;
declare function markCodePreviewMatches(root: HTMLElement, ranges: Array<{ start: number; end: number }>): void;

/** One syntax-colorized Search/Find preview line with match highlighting. */
function CodePreviewCode({ text, html, segments, style }: CodePreviewCodeProps) {
  const ref = React.useRef<HTMLSpanElement | null>(null);
  const segmentKey = Array.isArray(segments)
    ? segments.map((part) => `${part.match === true ? '1' : '0'}:${part.text}`).join('\u0000')
    : '';

  React.useEffect(() => {
    const node = ref.current;
    if (node === null || typeof html !== 'string') return;
    node.innerHTML = html;
    const ranges = codePreviewMatchRanges(segments);
    if (ranges.length > 0) markCodePreviewMatches(node, ranges);
  }, [html, segmentKey, text]);

  if (typeof html === 'string') {
    return (
      <span
        ref={ref}
        className='dsh-editor-code-preview-code'
        style={style}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }
  return (
    <span
      ref={ref}
      className='dsh-editor-code-preview-code'
      style={style}>
      {Array.isArray(segments) && segments.length > 0
        ? segments.map((part, index) => (
            <span
              key={index}
              style={part.match ? styles.findToolHighlight : null}
              data-dsh-find-preview-match={part.match ? '1' : undefined}>
              {part.text}
            </span>
          ))
        : text}
    </span>
  );
}

export { CodePreviewCode };
