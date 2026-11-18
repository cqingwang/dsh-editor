import React from 'react';
import { fileBadge } from './file-badge';
import { Icon } from './Icon';
import { primitives } from '../../foundation';

export interface EntryIconEntry {
  path: string;
  kind?: string;
  root?: boolean;
}

export interface EntryIconProps {
  entry: EntryIconEntry;
  expanded?: boolean;
}

/** A file/folder icon row cell shared by Project, Commit, tabs and search. */
export function EntryIcon({ entry, expanded = false }: EntryIconProps) {
  if (entry.kind === 'directory') {
    return (
      <Icon
        name={entry.root ? 'folderOpen' : expanded ? 'folderOpen' : 'folder'}
        size={18}
      />
    );
  }
  const HostFileTypeIcon = primitives?.FileTypeIcon;
  if (typeof HostFileTypeIcon === 'function') {
    return (
      <HostFileTypeIcon
        path={entry.path}
        size={16}
      />
    );
  }
  const badge = fileBadge(entry.path);
  if (badge === null) {
    return (
      <Icon
        name='file'
        size={16}
      />
    );
  }
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 16,
        height: 16,
        borderRadius: 3,
        background: badge.background,
        color: badge.color,
        fontSize: badge.label.length > 2 ? 6 : 8,
        fontWeight: 700,
        lineHeight: 1,
        letterSpacing: -0.2,
      }}>
      {badge.label}
    </span>
  );
}
