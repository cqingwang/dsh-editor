import React from 'react';
import { styles } from '../../ui/styles';
import { gitStatusInfo, type GitStatusInfo } from './git-status-model';

export interface GitStatusBadgeProps {
  status?: string;
  selected?: boolean;
  info?: GitStatusInfo | null;
}

/** Small left-hand git status decoration matching IDEA's M↓/A/D marks. */
export function GitStatusBadge({ status, selected = false, info: explicit = null }: GitStatusBadgeProps) {
  const info = explicit ?? gitStatusInfo(status);
  if (info === null) return null;
  return (
    <span
      style={{
        ...styles.statusBadge,
        color: selected ? '#fff' : info.color,
      }}
      title={typeof status === 'string' ? status : info.label}>
      {info.label}
    </span>
  );
}
