import React from 'react';
import { styles } from '../../ui/styles';
export interface IconProps {
  name: string;
  size?: number;
}
function Icon({ name, size = 14 }: IconProps) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 16 16',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.2,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': 'true',
  };
  switch (name) {
    case 'project':
      return (
        <svg {...common}>
          <path d='M1.8 4.2h4.1l1.1 1.2h7.2v7.1a1 1 0 0 1-1 1H2.8a1 1 0 0 1-1-1V4.2Z' />
          <path d='M1.8 5.4h12.4' />
        </svg>
      );
    case 'commit':
      return (
        <svg {...common}>
          <path d='M8 1.5v3.3M8 11.2v3.3' />
          <circle
            cx={8}
            cy={8}
            r={2.4}
          />
        </svg>
      );
    case 'diff':
      return (
        <svg {...common}>
          <rect
            x={1.8}
            y={2.4}
            width={5.3}
            height={11.2}
            rx={0.8}
          />
          <rect
            x={8.9}
            y={2.4}
            width={5.3}
            height={11.2}
            rx={0.8}
          />
          <path d='M3.4 6h2.2M10.4 6h2.2M4.5 4.9v2.2M10.4 10h2.2' />
        </svg>
      );
    case 'code':
      return (
        <svg {...common}>
          <path d='m5.4 3.4-3.1 4.6 3.1 4.6M10.6 3.4l3.1 4.6-3.1 4.6M9.1 2.5 6.9 13.5' />
        </svg>
      );
    case 'combinedDiff':
      return (
        <svg {...common}>
          <path d='M5.2 2.1h5l3 3v6.7H5.2V2.1Z' />
          <path d='M10.2 2.1v3h3M2.8 5.1v8.8h6.1' />
          <path d='M6.9 6.1h2.8M6.9 8.2h3.8M6.9 10.3h2.2M3.8 6.1h1M3.8 8.2h1M3.8 10.3h1' />
        </svg>
      );
    case 'clipboard':
      return (
        <svg {...common}>
          <rect
            x={3}
            y={3}
            width={10}
            height={11}
            rx={1.1}
          />
          <path d='M5.6 3V1.9h4.8V3M5.7 6.4h4.6M5.7 9h4.6M5.7 11.6h3' />
        </svg>
      );
    case 'patchExport':
      return (
        <svg {...common}>
          <path d='M3 1.8h6.2l3.3 3.3v4.4M3 1.8v12.4h4.2' />
          <path d='M9.2 1.8v3.3h3.3M11.2 9v4.3M9.3 11.5l1.9 1.9 1.9-1.9M8.2 14.2h6' />
        </svg>
      );
    case 'switchPane':
      return (
        <svg {...common}>
          <rect
            x={1.8}
            y={2.4}
            width={5.1}
            height={11.2}
            rx={0.8}
          />
          <rect
            x={9.1}
            y={2.4}
            width={5.1}
            height={11.2}
            rx={0.8}
          />
          <path d='M4.6 6.2h6.8M9.7 4.5l1.7 1.7-1.7 1.7M11.4 9.8H4.6M6.3 8.1 4.6 9.8l1.7 1.7' />
        </svg>
      );
    case 'applyLeft':
      return (
        <svg {...common}>
          <path d='M2 8h11M9.5 4.5 13 8l-3.5 3.5' />
          <path d='M2 3.2v9.6' />
        </svg>
      );
    case 'terminal':
      return (
        <svg {...common}>
          <rect
            x={1.5}
            y={2.5}
            width={13}
            height={11}
            rx={1}
          />
          <path d='m4 6 2 2-2 2M8.5 10h3' />
        </svg>
      );
    case 'harness':
      return (
        <svg {...common}>
          <path d='M2.2 3.2h9.2a2 2 0 0 1 2 2v4.3a2 2 0 0 1-2 2H7l-3.3 2.2v-2.2H4.2a2 2 0 0 1-2-2V3.2Z' />
          <path d='M5 6.2h.1M8 6.2h.1M11 6.2h.1' />
        </svg>
      );
    case 'newFile':
      return (
        <svg {...common}>
          <path d='M3 1.8h6.2l3.3 3.3v9.1H3V1.8Z' />
          <path d='M9.2 1.8v3.3h3.3M8 7.5v4M6 9.5h4' />
        </svg>
      );
    case 'newFolder':
      return (
        <svg {...common}>
          <path d='M1.8 4.2h4.1l1.1 1.2h7.2v7.1a1 1 0 0 1-1 1H2.8a1 1 0 0 1-1-1V4.2Z' />
          <path d='M8 7.5v4M6 9.5h4' />
        </svg>
      );
    case 'target':
      return (
        <svg {...common}>
          <circle
            cx={8}
            cy={8}
            r={4.6}
          />
          <circle
            cx={8}
            cy={8}
            r={1.2}
          />
          <path d='M8 1.2v2M8 12.8v2M1.2 8h2M12.8 8h2' />
        </svg>
      );
    case 'expand':
      return (
        <svg {...common}>
          <path d='m4 6 4 4 4-4M4 2.5l4 4 4-4' />
        </svg>
      );
    case 'collapse':
      return (
        <svg {...common}>
          <path d='m4 10 4-4 4 4M4 13.5l4-4 4 4' />
        </svg>
      );
    case 'refresh':
      return (
        <svg {...common}>
          <path d='M13.2 8a5.2 5.2 0 1 1-1.6-3.7M13.2 2.4v4h-4' />
        </svg>
      );
    case 'groupBy':
      return (
        <svg {...common}>
          <path d='M2 3.2h12M2 8h8M2 12.8h10' />
          <path d='M12.2 6.2 14 8l-1.8 1.8' />
        </svg>
      );
    case 'undo':
      return (
        <svg {...common}>
          <path d='M5.2 4.2 2.4 7l2.8 2.8' />
          <path d='M2.8 7h6.4a3.7 3.7 0 0 1 0 7.4H6.4' />
        </svg>
      );
    case 'redo':
      return (
        <svg {...common}>
          <path d='m10.8 4.2 2.8 2.8-2.8 2.8' />
          <path d='M13.2 7H6.8a3.7 3.7 0 0 0 0 7.4h2.8' />
        </svg>
      );
    case 'hide':
      return (
        <svg {...common}>
          <path d='M3 8h10' />
        </svg>
      );
    case 'matchCase':
      return (
        <svg {...common}>
          <text
            x={1.2}
            y={11.8}
            fill='currentColor'
            stroke='none'
            fontSize={10}
            fontWeight={700}
            fontFamily='inherit'>
            Aa
          </text>
        </svg>
      );
    case 'wholeWords':
      return (
        <svg {...common}>
          <text
            x={2.2}
            y={11.8}
            fill='currentColor'
            stroke='none'
            fontSize={10}
            fontWeight={700}
            fontFamily='inherit'>
            W
          </text>
        </svg>
      );
    case 'regex':
      return (
        <svg {...common}>
          <text
            x={1.5}
            y={11.8}
            fill='currentColor'
            stroke='none'
            fontSize={8.5}
            fontWeight={700}
            fontFamily='monospace'>
            .*
          </text>
        </svg>
      );
    case 'preserveCase':
      return (
        <svg {...common}>
          <text
            x={1.4}
            y={11.8}
            fill='currentColor'
            stroke='none'
            fontSize={10}
            fontWeight={700}
            fontFamily='inherit'>
            AB
          </text>
        </svg>
      );
    case 'replace':
      return (
        <svg {...common}>
          <path d='M2.2 5.1h8.4a2.1 2.1 0 0 1 0 4.2H8.1' />
          <path d='m4.3 3.2-2.1 1.9 2.1 1.9M5.8 7.2 8 9.3 5.8 11.4' />
        </svg>
      );
    case 'close':
      return (
        <svg {...common}>
          <path d='M4 4l8 8M12 4 4 12' />
        </svg>
      );
    case 'eye':
      return (
        <svg {...common}>
          <path d='M1.4 8S3.6 4 8 4s6.6 4 6.6 4-2.2 4-6.6 4S1.4 8 1.4 8Z' />
          <circle
            cx={8}
            cy={8}
            r={1.9}
          />
        </svg>
      );
    case 'settings':
      return (
        <svg {...common}>
          <circle
            cx={8}
            cy={8}
            r={2.2}
          />
          <path d='M8 1.4v1.8M8 12.8v1.8M1.4 8h1.8M12.8 8h1.8M3.3 3.3l1.3 1.3M11.4 11.4l1.3 1.3M3.3 12.7l1.3-1.3M11.4 4.6l1.3-1.3' />
        </svg>
      );
    case 'lock':
      return (
        <svg {...common}>
          <rect
            x={3.2}
            y={7}
            width={9.6}
            height={6.8}
            rx={1}
          />
          <path d='M5.2 7V5.2a2.8 2.8 0 0 1 5.6 0V7' />
        </svg>
      );
    case 'unlock':
      return (
        <svg {...common}>
          <rect
            x={3.2}
            y={7}
            width={9.6}
            height={6.8}
            rx={1}
          />
          <path d='M5.2 7V5.2a2.8 2.8 0 0 1 5.4-1' />
        </svg>
      );
    case 'chevronRight':
      return (
        <svg {...common}>
          <path d='m6 3.5 5 4.5-5 4.5' />
        </svg>
      );
    case 'chevronLeft':
      return (
        <svg {...common}>
          <path d='m10 3.5-5 4.5 5 4.5' />
        </svg>
      );
    case 'chevronDown':
      return (
        <svg {...common}>
          <path d='m3.5 6 4.5 5 4.5-5' />
        </svg>
      );
    case 'chevronUp':
      return (
        <svg {...common}>
          <path d='m3.5 10 4.5-5 4.5 5' />
        </svg>
      );
    case 'autoscroll':
      /* IDEA's "Autoscroll from Source": a target with a trailing arrow. */
      return (
        <svg {...common}>
          <circle
            cx={7}
            cy={9}
            r={3.4}
          />
          <circle
            cx={7}
            cy={9}
            r={1}
            fill='currentColor'
            stroke='none'
          />
          <path d='M10.4 5.6 14 2M14 2h-3.2M14 2v3.2' />
        </svg>
      );
    case 'folder':
      /* `flex: none` is load-bearing: as a flex child with an aspect ratio the svg
         had its WIDTH squeezed (measured 10x16 instead of 16x16), which read as
         "the root folder icon shrank after render". */
      return (
        <svg
          width={size}
          height={size}
          viewBox='0 0 16 16'
          aria-hidden='true'
          style={{
            flex: 'none',
            display: 'block',
          }}>
          <path
            d='M1.5 4.1h4.2l1.1 1.2h7.7v6.9a1 1 0 0 1-1 1H2.5a1 1 0 0 1-1-1V4.1Z'
            fill='#8ba4c7'
          />
          <path
            d='M1.5 4.1h4.2l1.1 1.2h7.7'
            stroke='#6b86ad'
            strokeWidth={0.8}
            fill='none'
          />
        </svg>
      );
    case 'folderOpen':
      return (
        <svg
          width={size}
          height={size}
          viewBox='0 0 16 16'
          aria-hidden='true'
          style={{
            flex: 'none',
            display: 'block',
          }}>
          <path
            d='M1.5 4.1h4.2l1.1 1.2h7.7v6.9a1 1 0 0 1-1 1H2.5a1 1 0 0 1-1-1V4.1Z'
            fill='#8ba4c7'
          />
          <path
            d='M1.5 6.5h13M3.4 6.5 2 13.2M13.8 6.5l-1.2 6.7'
            stroke='#6b86ad'
            strokeWidth={0.7}
            fill='none'
          />
        </svg>
      );
    case 'file':
      return (
        <svg {...common}>
          <path d='M3.2 1.8h6l3.2 3.2v9.2H3.2V1.8Z' />
          <path d='M9.2 1.8v3.2h3.2' />
        </svg>
      );
    case 'check':
      return (
        <svg {...common}>
          <path d='m2.5 8.4 3.2 3.2 7.8-7.8' />
        </svg>
      );
    case 'remove':
      return (
        <svg {...common}>
          <circle
            cx={8}
            cy={8}
            r={5.6}
          />
          <path d='M4.8 8h6.4' />
        </svg>
      );
    case 'more':
      return (
        <svg {...common}>
          <path d='M2.2 4h11.6M2.2 8h9M2.2 12h6.4' />
          <path d='m10.4 10.6 2.8 2.8m0-2.8-2.8 2.8' />
        </svg>
      );
    case 'unified':
      return (
        <svg {...common}>
          <rect
            x={1.8}
            y={2.6}
            width={12.4}
            height={10.8}
            rx={1}
          />
          <path d='M3.7 5.5h3.1M8.4 5.5h3.9M3.7 8h1.1M6 8h6.3M3.7 10.5h4M9.3 10.5h3' />
        </svg>
      );
    case 'split':
      return (
        <svg {...common}>
          <rect
            x={1.8}
            y={2.6}
            width={12.4}
            height={10.8}
            rx={1}
          />
          <path d='M8 2.6v10.8' />
        </svg>
      );
    case 'swap':
      return (
        <svg {...common}>
          <path d='M3 5h9.5M9.7 2.2 12.5 5l-2.8 2.8M13 11H3.5M6.3 8.2 3.5 11l2.8 2.8' />
        </svg>
      );
    case 'annotate':
      return (
        <svg {...common}>
          <path d='M2.4 3.2h11.2M2.4 8h6M2.4 12.8h4.4' />
          <path d='M11 6.6v3.2a2 2 0 0 1-2 2H6.4' />
        </svg>
      );
    case 'graph':
      return (
        <svg {...common}>
          <circle
            cx={4}
            cy={3.4}
            r={1.6}
          />
          <circle
            cx={4}
            cy={12.6}
            r={1.6}
          />
          <circle
            cx={11.5}
            cy={8}
            r={1.6}
          />
          <path d='M4 5v6M5.6 8h4.3' />
        </svg>
      );
    case 'graphNode':
      return (
        <svg
          {...common}
          viewBox='0 0 12 12'>
          <circle
            cx={6}
            cy={6}
            r={3.4}
            fill='currentColor'
            stroke='none'
          />
        </svg>
      );
    case 'graphMerge':
      return (
        <svg
          {...common}
          viewBox='0 0 12 12'>
          <circle
            cx={6}
            cy={6}
            r={3.4}
          />
          <circle
            cx={6}
            cy={6}
            r={1.2}
            fill='currentColor'
            stroke='none'
          />
        </svg>
      );
    case 'stash':
      return (
        <svg {...common}>
          <path d='M2.4 3.2h11.2v3.1a1 1 0 0 1-1 1H3.4a1 1 0 0 1-1-1V3.2Z' />
          <path d='M4.6 7.3v5.5h6.8V7.3' />
          <path d='M6.4 10h3.2' />
        </svg>
      );
    case 'push':
      return (
        <svg {...common}>
          <path d='M8 12.4V3.2M4.2 6.9 8 3.1l3.8 3.8' />
          <path d='M3 13.2h10' />
        </svg>
      );
    case 'update':
      return (
        <svg {...common}>
          <path d='M8 2.8v8.4M4.6 8 8 11.4 11.4 8' />
          <path d='M2.6 13.2h10.8' />
        </svg>
      );
    case 'fetch':
      return (
        <svg {...common}>
          <path d='M8 2.2v6.2M5.2 6 8 8.8 10.8 6' />
          <path d='M2.6 10.4v2.4a1 1 0 0 0 1 1h8.8a1 1 0 0 0 1-1v-2.4' />
        </svg>
      );
    case 'sort':
      return (
        <svg {...common}>
          <path d='M2.5 4h11M2.5 8h7.5M2.5 12h4' />
        </svg>
      );
    case 'ignore':
      return (
        <svg {...common}>
          <circle
            cx={8}
            cy={8}
            r={5.6}
          />
          <path d='m4 12 8-8' />
        </svg>
      );
    case 'lineNumbers':
      return (
        <svg {...common}>
          <path d='M2.4 3.5h1.8M6.2 3.5h7.4M2.4 8h1.8M6.2 8h7.4M2.4 12.5h1.8M6.2 12.5h7.4' />
        </svg>
      );
    case 'wrap':
      return (
        <svg {...common}>
          <path d='M2.5 3.5h11M2.5 7.5h8.2a2.3 2.3 0 0 1 0 4.6H7.8' />
          <path d='m9.8 10.2-2 1.9 2 1.9M2.5 13.5h2.8' />
        </svg>
      );
    case 'indentGuides':
      return (
        <svg {...common}>
          <path d='M2.5 3v10M5.5 5v6M8.5 3v10M11.5 5v6' />
          <path d='M6.8 5h7M9.8 8h4M12.8 11h1' />
        </svg>
      );
    case 'whitespace':
      return (
        <svg {...common}>
          <circle
            cx={3.2}
            cy={8}
            r={0.8}
            fill='currentColor'
            stroke='none'
          />
          <circle
            cx={8}
            cy={8}
            r={0.8}
            fill='currentColor'
            stroke='none'
          />
          <circle
            cx={12.8}
            cy={8}
            r={0.8}
            fill='currentColor'
            stroke='none'
          />
          <path d='M2.5 11.5h11' />
        </svg>
      );
    case 'search':
      return (
        <svg {...common}>
          <circle
            cx={7}
            cy={7}
            r={4.2}
          />
          <path d='m10.2 10.2 3.6 3.6' />
        </svg>
      );
    case 'findWindow':
      return (
        <svg {...common}>
          <rect
            x={1.8}
            y={2.4}
            width={12.4}
            height={10.8}
            rx={1}
          />
          <circle
            cx={7}
            cy={7.1}
            r={2.5}
          />
          <path d='m8.9 9 2.2 2.2M4.3 11.2h3.1' />
        </svg>
      );
    case 'filter':
      return (
        <svg {...common}>
          <path d='M2.2 3h11.6l-4.4 5.1v4.2l-2.8 1.5V8.1L2.2 3Z' />
        </svg>
      );
    case 'preview':
      return (
        <svg {...common}>
          <rect
            x={1.8}
            y={2.5}
            width={12.4}
            height={9.3}
            rx={0.9}
          />
          <path d='M8 11.8v2M5.2 13.8h5.6M4.2 5.4h7.6M4.2 7.6h5.2' />
        </svg>
      );
    case 'history':
      return (
        <svg {...common}>
          <circle
            cx={8}
            cy={8}
            r={5.6}
          />
          <path d='M8 4.6V8l2.5 1.6' />
        </svg>
      );
    case 'pin':
      return (
        <svg {...common}>
          <path d='M5 1.8h6l-1.1 4 2 2.1v1H4.1v-1l2-2.1-1.1-4Z' />
          <path d='M8 8.9v5.3' />
        </svg>
      );
    default:
      return null;
  }
}
export { Icon };
