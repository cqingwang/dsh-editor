import React from 'react';
import { styles } from '../../ui/styles';
import { commitGraphPlaceholder } from './commit-graph-state-model';
import { CommitGraphFoldBar } from './CommitGraphFoldBar';
import { CommitGraphRow, type CommitGraphRun } from './CommitGraphRow';
import { assignGraphLanes, linearRun, scrollGraphRowIntoView } from '../../find-tool';

type Translate = (key: string, params?: Record<string, unknown>) => string;

export interface CommitGraphEntryData {
  hash: string;
  parents?: string[];
  refs?: string[];
  subject?: string;
  author?: string;
  date?: string;
  [key: string]: unknown;
}

export interface CommitGraphPayload {
  entries?: CommitGraphEntryData[];
  head?: string | null;
  branch?: string;
  at?: string;
  branchList?: string[];
  tagList?: Array<{ name?: unknown; hash?: unknown }>;
  [key: string]: unknown;
}

export interface CommitGraphMenuPayload {
  x: number;
  y: number;
  entry?: CommitGraphEntryData;
  commit: CommitGraphEntryData;
  selectionHashes?: string[];
}

export interface CommitGraphProps {
  t: Translate;
  graph: CommitGraphPayload | null;
  onShow?: (hash: string) => void;
  selected?: string | null;
  selectionHashes?: string[];
  onRowClick?: (
    entry: CommitGraphEntryData,
    event: React.MouseEvent<HTMLElement>,
    options?: Record<string, unknown>,
  ) => void;
  onSelect?: (hash: string | null) => void;
  folded: boolean;
  onToggleFolded: () => void;
  onPickRef?: (ref: string) => void;
  onContextMenu?: (payload: CommitGraphMenuPayload) => void;
  error?: string | null;
}

function CommitGraphView({
  t,
  graph,
  onShow,
  selected,
  selectionHashes = [],
  onRowClick,
  onSelect,
  folded,
  onToggleFolded,
  onPickRef,
  onContextMenu,
  error = null,
}: CommitGraphProps) {
  const placeholder = commitGraphPlaceholder(graph, error);
  if (placeholder !== null) {
    return (
      <div
        style={styles.treeMessage}
        role='status'
        aria-live='polite'
        aria-atomic='true'
        aria-busy={placeholder.kind === 'loading' ? true : undefined}
        data-dsh-graph-state={placeholder.kind}>
        {t(placeholder.messageKey)}
      </div>
    );
  }
  if (graph == null) return null;
  const entries = Array.isArray(graph.entries) ? graph.entries : [];
  if (error !== null && error !== '' && entries.length === 0) return null;
  const lanes = assignGraphLanes(entries);
  const laneOf = lanes.laneOf;
  const head = typeof graph?.head === 'string' ? graph.head : null;
  /* Folding is opt-in: IDEA keeps the full graph by default too, and a folded
     row that hid a branch point would be worse than a long list. */
  const runs = linearRun(entries, laneOf);
  const rowsToDraw = folded
    ? runs
    : entries.map((entry) => ({
        hashes: [entry.hash],
        lane: laneOf.get(entry.hash) ?? 0,
        merge: (entry.parents ?? []).length > 1,
        first: entry,
      }));
  return (
    <div
      style={styles.commitGraph}
      role='listbox'
      aria-label={t('editor.logGraph')}
      onMouseLeave={() => onSelect?.(null)}>
      <CommitGraphFoldBar
        t={t}
        folded={folded}
        rowCount={rowsToDraw.length}
        onToggleFolded={onToggleFolded}
      />
      {rowsToDraw.map((run) => {
        const entry = run.first;
        const lane = laneOf.get(entry.hash) ?? 0;
        const isMerge = entry.parents.length > 1;
        const active = selected === entry.hash || selectionHashes.includes(entry.hash);
        /* IDEA marks the checked-out commit with a HEAD badge: without it a row
         with a branch badge looks identical to the row you are standing on. */
        const isHead = head !== null && head === entry.hash;
        return (
          <CommitGraphRow
            key={entry.hash}
            t={t}
            entry={entry}
            run={run as CommitGraphRun}
            lane={lane}
            active={active}
            isMerge={isMerge}
            isHead={isHead}
            rowRef={active ? scrollGraphRowIntoView : undefined}
            selectionHashes={selectionHashes}
            onShow={onShow}
            onRowClick={onRowClick}
            onSelect={onSelect}
            onContextMenu={onContextMenu}
            onPickRef={onPickRef}
          />
        );
      })}
    </div>
  );
}

const CommitGraph = CommitGraphView;

export { CommitGraph };
