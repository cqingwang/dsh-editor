import React from 'react';
import { styles } from '../../ui/styles';
import { ToolbarButton } from '../ui/ToolbarButton';
import { commitLogDisplayTitle } from './commit-log-view-model';
import { commitLogScopeAnnouncement } from './commit-log-scope-announcement';
import { commitLogFilterToggle } from './commit-log-view-preferences';

type Translate = (key: string, params?: Record<string, unknown>) => string;

interface CommitLogGraph {
  branch?: string;
  branchList?: string[];
  at?: string;
}

interface CommitLogFilterInputRef {
  current: HTMLInputElement | null;
}

interface CommitLogToolbarProps {
  t: Translate;
  filter: string;
  filterVisible: boolean;
  filterInputRef: CommitLogFilterInputRef;
  author?: string;
  graphMode: boolean;
  graph?: CommitLogGraph | null;
  loading: boolean;
  searchMode?: boolean;
  disabled?: boolean;
  onFilterChange: (value: string) => void;
  onFilterVisibleChange: (visible: boolean) => void;
  onAuthorChange: (value: string) => void;
  onGraphBranch: (branch: string) => void;
  onToggleGraph: () => void;
  onRefresh: () => void;
}

function CommitLogToolbar({
  t,
  filter,
  filterVisible,
  filterInputRef,
  author,
  graphMode,
  graph,
  loading,
  searchMode = false,
  disabled = false,
  onFilterChange,
  onFilterVisibleChange,
  onAuthorChange,
  onGraphBranch,
  onToggleGraph,
  onRefresh,
}: CommitLogToolbarProps) {
  const [scopeAnnouncement, setScopeAnnouncement] = React.useState('');
  const previousScopeRef = React.useRef('');
  const scopeHash = typeof graph?.at === 'string' && graph.at !== '' ? graph.at.slice(0, 7) : '';
  const hasActiveFilter = filter.trim() !== '';
  const displayTitle = commitLogDisplayTitle(t('editor.tabLog'), filter);
  React.useEffect(() => {
    if (!graphMode) {
      previousScopeRef.current = '';
      setScopeAnnouncement('');
      return;
    }
    const previous = previousScopeRef.current;
    const announcement = commitLogScopeAnnouncement(t, scopeHash, previous);
    if (announcement === null) return;
    previousScopeRef.current = scopeHash;
    setScopeAnnouncement(announcement);
  }, [graphMode, scopeHash, t]);
  const toggleFilter = () => {
    const next = commitLogFilterToggle(filterVisible);
    onFilterVisibleChange(next.visible);
    if (next.focusInput) {
      window.setTimeout(() => {
        filterInputRef.current?.focus();
        filterInputRef.current?.select();
      }, 0);
    } else if (next.clearFilter) {
      /* Hiding the field must not leave an invisible filter active. */
      onFilterChange('');
    }
  };
  return (
    <div
      className='dsh-editor-log-toolbar'
      style={styles.logToolbar}>
      <span
        className='dsh-editor-log-title'
        style={styles.panelTitle}
        data-dsh-log-filter-active={hasActiveFilter ? '' : undefined}
        title={displayTitle}>
        {displayTitle}
      </span>
      {filterVisible ? (
        <input
          ref={filterInputRef}
          style={styles.findInput}
          autoFocus={true}
          aria-label={t('editor.logFilter')}
          title={t('editor.logFilterHint')}
          placeholder={t('editor.logFilterPlaceholder')}
          value={filter}
          onChange={(event) => onFilterChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.nativeEvent.isComposing === true) return;
            if (event.key === 'Escape') {
              event.preventDefault();
              onFilterChange('');
            }
          }}
        />
      ) : null}
      {graphMode ? (
        <select
          className='dsh-editor-log-branch'
          style={styles.graphBranchSelect}
          value={graph?.branch ?? ''}
          disabled={disabled}
          aria-label={t('editor.graphBranch')}
          title={t('editor.graphBranch')}
          onChange={(event) => onGraphBranch(event.target.value)}>
          <option value=''>{t('editor.graphAllBranches')}</option>
          {(graph?.branchList ?? []).map((name) => (
            <option
              key={name}
              value={name}>
              {name}
            </option>
          ))}
        </select>
      ) : null}
      {graphMode && typeof graph?.at === 'string' && graph.at !== '' ? (
        <span
          role='group'
          className='dsh-editor-log-scope'
          aria-label={t('editor.graphAtChip', {
            hash: graph.at.slice(0, 7),
          })}
          style={styles.graphScopeChip}
          title={graph.at}>
          <span
            className='dsh-editor-graph-scope-label'
            aria-hidden='true'>
            {t('editor.graphAtChip', {
              hash: graph.at.slice(0, 7),
            })}
          </span>
          <button
            type='button'
            className='dsh-editor-graph-scope-clear'
            style={styles.historyChipClear}
            aria-label={t('editor.graphClearScope')}
            title={t('editor.graphClearScope')}
            onClick={() => onGraphBranch('')}>
            ×
          </button>
        </span>
      ) : null}
      <span
        className='dsh-editor-visually-hidden'
        role='status'
        aria-live='polite'
        aria-atomic='true'>
        {scopeAnnouncement}
      </span>
      <span
        className='dsh-editor-log-spacer'
        style={styles.toolbarSpacer}
      />
      <input
        className='dsh-editor-log-author'
        style={{
          ...styles.findInput,
          width: 96,
        }}
        placeholder={t('editor.logAuthorPlaceholder')}
        value={author ?? ''}
        disabled={disabled}
        aria-label={t('editor.logAuthor')}
        onChange={(event) => onAuthorChange(event.target.value)}
      />
      <span className='dsh-editor-log-actions'>
        <ToolbarButton
          icon='search'
          label={t('editor.logFilter')}
          active={filterVisible}
          onClick={toggleFilter}
        />
        <ToolbarButton
          icon='graph'
          label={t('editor.logGraph')}
          active={graphMode}
          disabled={disabled || searchMode}
          onClick={onToggleGraph}
        />
        <ToolbarButton
          icon='refresh'
          label={t('editor.refresh')}
          disabled={disabled || loading}
          onClick={onRefresh}
        />
      </span>
    </div>
  );
}

export { CommitLogToolbar };
