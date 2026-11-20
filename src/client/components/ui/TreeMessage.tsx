import React from 'react';
import { styles } from '../../ui/styles';

export interface TreeMessageProps {
  children: React.ReactNode;
  state: 'loading' | 'empty' | 'error' | 'search-error' | 'search-results' | 'no-matches' | 'truncated';
  role?: 'status' | 'alert';
  live?: 'polite' | 'assertive';
  busy?: boolean;
  visuallyHidden?: boolean;
}

function TreeMessage({
  children,
  state,
  role = 'status',
  live = 'polite',
  busy = false,
  visuallyHidden = false,
}: TreeMessageProps) {
  return (
    <div
      className={visuallyHidden ? 'dsh-editor-visually-hidden' : undefined}
      style={styles.treeMessage}
      role={role}
      aria-live={live}
      aria-atomic='true'
      aria-busy={busy ? true : undefined}
      data-dsh-tree-message={state}>
      {children}
    </div>
  );
}

export { TreeMessage };
