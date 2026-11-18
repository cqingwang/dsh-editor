import React from 'react';
import { styles } from '../../ui/styles';

export interface PathLabelProps {
  path?: string;
  style?: React.CSSProperties;
}

export interface PathLabelParts {
  dir: string;
  name: string;
}

/**
 * The file name of a workspace-relative path, split for a two-tone label.
 *
 * IDEA's diff and editor headers print the path in grey and the NAME in the
 * emphasised colour, and they never ellipsize the name: the path gives way.
 */
export function splitPathLabel(path?: string): PathLabelParts {
  const text = typeof path === 'string' ? path : '';
  const index = text.lastIndexOf('/');
  // No trailing slash: `direction: rtl` would move a neutral slash to the front.
  return {
    dir: index < 0 ? '' : text.slice(0, index),
    name: index < 0 ? text : text.slice(index + 1),
  };
}

/** One header label for a file path: muted leading path, whole file name. */
export function PathLabel({ path, style }: PathLabelProps) {
  const parts = splitPathLabel(path);
  return (
    <span
      style={{
        ...styles.pathLabel,
        ...(style ?? {}),
      }}
      title={typeof path === 'string' ? path : ''}>
      <span style={styles.pathLabelName}>{parts.name}</span>
      {parts.dir === '' ? null : <span style={styles.pathLabelDir}>{parts.dir}</span>}
    </span>
  );
}
