/* find-tool.js CommitGraph legacy oracle. */

    function CommitGraph({ t, graph, onShow, selected, selectionHashes = [], onRowClick, onSelect, folded, onToggleFolded, onPickRef, onContextMenu }) {
      const entries = graph?.entries ?? [];
      if (graph === null) return React.createElement('div', { style: styles.treeMessage }, t('editor.loading'));
      if (entries.length === 0) {
        /* An empty page means three different things: no commits at all, a branch
           filter that matched nothing, and a tag pointing outside the walk. */
        return React.createElement(
          'div',
          { style: styles.treeMessage },
          typeof graph?.branch === 'string' && graph.branch !== ''
            ? t('editor.graphNoCommitsOnBranch')
            : typeof graph?.at === 'string' && graph.at !== ''
              ? t('editor.graphNoCommitsOnRef')
              : t('editor.noCommits'),
        );
      }
      const lanes = assignGraphLanes(entries);
      const laneOf = lanes.laneOf;
      const head = typeof graph?.head === 'string' ? graph.head : null;
      /* Folding is opt-in: IDEA keeps the full graph by default too, and a folded
         row that hid a branch point would be worse than a long list. */
      const runs = linearRun(entries, laneOf);
      const rowsToDraw = folded ? runs : entries.map((entry) => ({ hashes: [entry.hash], lane: laneOf.get(entry.hash) ?? 0, merge: entry.parents.length > 1, first: entry }));
      return React.createElement(
        'div',
        {
          style: styles.commitGraph,
          role: 'listbox',
          'aria-label': t('editor.logGraph'),
          /* Leaving the list clears the hover, otherwise the last row the pointer
             crossed stays tinted while the keyboard cursor is somewhere else. */
          onMouseLeave: () => onSelect?.(null),
        },
        React.createElement(
          'div',
          { style: styles.graphFoldRow },
          React.createElement(
            'button',
            {
              type: 'button',
              style: { ...styles.graphFoldToggle, ...(folded ? styles.graphFoldToggleOn : null) },
              'aria-pressed': folded,
              title: t('editor.graphFoldChains'),
              onClick: onToggleFolded,
            },
            t('editor.graphFoldChains'),
          ),
          folded
            ? React.createElement('span', { style: styles.graphFoldCount }, t('editor.graphFoldedCount', { count: rowsToDraw.length }))
            : null,
        ),
        rowsToDraw.map((run) => {
          const entry = run.first;
          const collapsed = run.hashes.length > 1;
          const lane = laneOf.get(entry.hash) ?? 0;
          const isMerge = entry.parents.length > 1;
          const active = selected === entry.hash || selectionHashes.includes(entry.hash);
          /* IDEA marks the checked-out commit with a HEAD badge: without it a row
             with a branch badge looks identical to the row you are standing on. */
          const isHead = head !== null && head === entry.hash;
          return React.createElement(
            'div',
            {
              key: entry.hash,
              ref: active ? scrollGraphRowIntoView : null,
              className: 'dsh-editor-commit-row dsh-editor-graph-row',
              role: 'option',
              'data-dsh-graph-hash': entry.hash,
              'aria-haspopup': 'menu',
              'aria-selected': active,
              style: { ...styles.commitGraphRow, ...(active ? styles.commitGraphRowActive : null) },
              title: entry.hash,
              onClick: (event) => {
                if (onRowClick !== undefined) onRowClick(entry, event);
                else onShow?.(entry.hash);
              },
              onMouseEnter: () => onSelect?.(entry.hash),
              onContextMenu: (event) => {
                event.preventDefault();
                event.stopPropagation();
                const contextSelection = selectionHashes.includes(entry.hash) ? selectionHashes : [entry.hash];
                if (onRowClick !== undefined && !selectionHashes.includes(entry.hash)) {
                  onRowClick(entry, event, { contextMenu: true });
                } else {
                  onShow?.(entry.hash);
                }
                onContextMenu?.({ commit: entry, selectionHashes: contextSelection, x: event.clientX, y: event.clientY });
              },
            },
            React.createElement(
              'span',
              { style: { ...styles.commitGraphLane, width: Math.max(12, (lane + 1) * 10) } },
              /* Only the columns up to this commit's lane: the rest would be empty gutters
                 that push the subject off a narrow tool window. */
              Array.from({ length: lane + 1 }, (_, index) =>
                React.createElement('span', {
                  key: index,
                  style: index === lane ? styles.commitGraphTrackActive : styles.commitGraphTrack,
                }),
              ),
              React.createElement('span', { style: styles.commitGraphNode },
                React.createElement(Icon, { name: isMerge ? 'graphMerge' : 'graphNode', size: 11 }),
              ),
            ),
            React.createElement('span', { style: styles.logHash }, entry.hash.slice(0, 7)),
            React.createElement(
              'span',
              { style: { minWidth: 0, flex: '1 1 auto', display: 'flex', flexDirection: 'column', gap: 1 } },
              React.createElement('span', { style: styles.logSubject }, entry.subject),
              /* A folded row must say how many commits it stands for; otherwise the
                 list looks like it lost history. */
              collapsed
                ? React.createElement('span', { style: styles.graphFoldBadge }, t('editor.graphFoldedRun', { count: run.hashes.length - 1 }))
                : null,
              React.createElement(
                'span',
                { style: { display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' } },
                isHead ? React.createElement('span', { style: styles.commitGraphHead, key: 'HEAD' }, 'HEAD') : null,
                /* IDEA's graph filters by clicking a ref badge; the badge names the
                   scope it applies, so clicking `main` shows main's history. */
                entry.refs.map((ref) => React.createElement(
                  'button',
                  {
                    key: ref,
                    type: 'button',
                    style: styles.commitGraphRef,
                    className: 'dsh-editor-graph-ref',
                    title: t('editor.graphFilterByRef', { ref }),
                    onClick: (event) => {
                      /* The row underneath opens the commit; the badge must not. */
                      event.stopPropagation();
                      onPickRef?.(ref);
                    },
                  },
                  ref,
                )),
                React.createElement('span', { style: styles.logMeta }, `${entry.author} · ${formatCommitDate(entry.date)}`),
              ),
            ),
          );
        }),
      );
    }

/* COMMIT_GRAPH_BOUNDARY */
