import React from 'react';
import { styles } from '../../ui/styles';
import { EDITOR_TEXT_STYLE } from '../editor/editor-style-model';
import { EntryIcon } from '../ui/EntryIcon';
import { GitStatusBadge } from '../ui/GitStatusBadge';
import type { GitStatusInfo } from '../ui/git-status-model';

export interface SearchFileResultItemProps {
  path: string;
  name: string;
  detail?: string;
  statusInfo?: GitStatusInfo | null;
  selected?: boolean;
  nameStyle?: React.CSSProperties;
  detailStyle?: React.CSSProperties;
}

/**
 * Shared file identity for Find and Search Everywhere results. Interaction,
 * ARIA roles and menus remain owned by the row that hosts this component.
 */
export function SearchFileResultItem({
  path,
  name,
  detail,
  statusInfo = null,
  selected = false,
  nameStyle,
  detailStyle,
}: SearchFileResultItemProps) {
  return (
    <span
      style={styles.searchFileResultItem}
      data-dsh-search-file-result-item=''>
      <EntryIcon
        entry={{
          path,
          kind: 'file',
        }}
        expanded={false}
      />
      {statusInfo === null ? null : (
        <GitStatusBadge
          selected={selected}
          info={statusInfo}
        />
      )}
      <span
        style={{
          ...EDITOR_TEXT_STYLE.body,
          ...styles.paletteName,
          flex: '1 1 auto',
          ...nameStyle,
        }}>
        {name}
      </span>
      {detail === undefined || detail === '' ? null : (
        <span
          style={{
            ...styles.searchEverywhereMeta,
            ...detailStyle,
          }}>
          {detail}
        </span>
      )}
    </span>
  );
}
