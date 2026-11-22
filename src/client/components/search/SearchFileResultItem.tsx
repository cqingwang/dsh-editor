import React from 'react';
import { styles } from '../../ui/styles';
import { EDITOR_TEXT_STYLE } from '../editor/editor-style-model';
import { EntryIcon } from '../ui/EntryIcon';
import { GitStatusBadge } from '../ui/GitStatusBadge';
import type { GitStatusInfo } from '../ui/git-status-model';

export interface SearchFileResultItemProps {
  path: string;
  name: React.ReactNode;
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
      <span
        style={styles.searchFileResultIcon}
        data-dsh-search-file-result-icon=''>
        <EntryIcon
          entry={{
            path,
            kind: 'file',
          }}
          expanded={false}
        />
      </span>
      {statusInfo === null ? null : (
        <GitStatusBadge
          selected={selected}
          info={statusInfo}
        />
      )}
      <span
        className='dsh-editor-search-result-name'
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
          className='dsh-editor-search-result-detail dsh-editor-search-everywhere-meta'
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
