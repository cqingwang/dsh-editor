/* ui-primitives.js: dsh-editor client module. Generated into lib/client.js by scripts/build-client.mjs. */
    function fileBadge(path) {
      const name = basename(path).toLowerCase();
      const dot = name.lastIndexOf('.');
      const extension = dot < 0 ? name : name.slice(dot + 1);
      switch (extension) {
        case 'json':
          return { label: '{}', color: '#2f65ca', background: '#e6efff' };
        case 'yaml':
        case 'yml':
          return { label: 'YML', color: '#b3261e', background: '#fde8e7' };
        case 'py':
        case 'pyw':
          return { label: 'Py', color: '#1f6fb2', background: '#e3f2fd' };
        case 'sh':
        case 'bash':
        case 'zsh':
          return { label: '>_', color: '#1b7f4b', background: '#e6f4ea' };
        case 'md':
        case 'markdown':
          return { label: 'MD', color: '#2f65ca', background: '#e6efff' };
        case 'ts':
        case 'tsx':
        case 'mts':
        case 'cts':
          return { label: 'TS', color: '#1d5fa8', background: '#e3efff' };
        case 'js':
        case 'jsx':
        case 'mjs':
        case 'cjs':
          return { label: 'JS', color: '#8a6d00', background: '#fff4c2' };
        case 'go':
          return { label: 'GO', color: '#00758f', background: '#dff6f9' };
        case 'rs':
          return { label: 'RS', color: '#9c4a1a', background: '#fbe9dd' };
        case 'java':
        case 'kt':
        case 'kts':
          return { label: 'J', color: '#a14a00', background: '#fbe9dd' };
        case 'c':
        case 'h':
        case 'cc':
        case 'cpp':
        case 'cxx':
        case 'hpp':
          return { label: 'C', color: '#3f51b5', background: '#e8eaf6' };
        case 'html':
        case 'htm':
        case 'vue':
        case 'svelte':
          return { label: '<>', color: '#b34a00', background: '#fbe9dd' };
        case 'css':
        case 'scss':
        case 'less':
          return { label: '#', color: '#1565c0', background: '#e3f2fd' };
        case 'toml':
        case 'ini':
        case 'conf':
          return { label: 'T', color: '#5f6368', background: '#eceff1' };
        case 'xml':
        case 'svg':
          return { label: '<>', color: '#b34a00', background: '#fbe9dd' };
        case 'sql':
          return { label: 'DB', color: '#00695c', background: '#e0f2f1' };
        case 'lock':
          return { label: 'L', color: '#5f6368', background: '#eceff1' };
        default:
          if (name === '.gitignore' || name === '.gitmodules') return { label: 'G', color: '#5f6368', background: '#eceff1' };
          if (name === '.think_plan.md') return { label: 'MD', color: '#2f65ca', background: '#e6efff' };
          return null;
      }
    }

    /** SVG icon set used by the panel chrome and file tree. */
    /**
     * One header label for a file path: muted leading path, whole file name.
     *
     * Kept as a component so the diff and annotate headers cannot drift: both
     * need `title` (the full path, for panes too narrow to hold it) and both
     * must let the name wrap out rather than truncate it.
     * @param {{path: string, style?: object}} props - the path and extra styling.
     * @returns {object} the label.
     */
    function PathLabel({ path, style }) {
      const parts = splitPathLabel(path);
      return React.createElement(
        'span',
        { style: { ...styles.pathLabel, ...style }, title: typeof path === 'string' ? path : '' },
        /* NAME FIRST, path after — the same order the change list uses, and the
           order IDEA's editor tab uses. It also spends the scarce width on the
           part that identifies the file: in a 400px diff pane the name gets all
           of it and only the trailing path is abbreviated. */
        React.createElement('span', { style: styles.pathLabelName }, parts.name),
        parts.dir === '' ? null : React.createElement('span', { style: styles.pathLabelDir }, parts.dir),
      );
    }

    /**
     * IDEA's two diff column captions.
     *
     * The left side is always the version the comparison starts from (HEAD,
     * the index, or an older revision), and the right side is the one on
     * screen (the index or the working tree). Naming both is what makes the
     * direction of a restore obvious in a narrow pane.
     * @param {boolean} staged - whether the diff compares HEAD with the index.
     * @returns {{left: string, right: string}} translated captions.
     */
    function diffSideLabels(staged) {
      return staged
        ? { left: 'HEAD', right: 'Index' }
        : { left: 'HEAD', right: 'Working tree' };
    }

    /**
     * Stable identity for one diff comparison and visual orientation.
     *
     * Monaco view states are only meaningful for the same document pair. A
     * staged and unstaged diff of one path are different comparisons, and the
     * swapped orientation has its own modified-side document.
     * @param {object|null} target - Commit/diff target.
     * @param {boolean} [swapped=false] - whether the revision is displayed on the right.
     * @returns {string} stable map key, or '' for an incomplete target.
     */
    function diffViewStateKey(target, swapped = false) {
      const path = typeof target?.path === 'string' ? target.path : '';
      if (path === '') return '';
      let comparison;
      if (target?.combined === true) {
        const entries = Array.isArray(target.entries) ? target.entries : [];
        comparison = `combined:${entries.map((entry) => `${entry?.path ?? ''}:${entry?.staged === true ? 'staged' : 'working'}`).join('|')}`;
      } else if (typeof target?.commit === 'string') {
        comparison = `commit:${target.commit}`;
      } else if (typeof target?.revision === 'string') {
        comparison = `revision:${target.revision}`;
      } else if (typeof target?.clipboardText === 'string') {
        comparison = `clipboard:${target.label ?? ''}`;
      } else {
        comparison = target?.staged === true ? 'staged' : 'working';
      }
      return `${comparison}:${path}:${swapped === true ? 'swapped' : 'original'}`;
    }

    /**
     * Transfer a line across Monaco's two diff sides.
     *
     * IDEA's Select Position in Opposite Diff Pane keeps the caret on the
     * corresponding change instead of the same screen row. Lines before a
     * change remain unchanged; lines inside a changed range are mapped
     * proportionally; later lines absorb the accumulated insertion/deletion.
     * @param {number} line - one-based source line.
     * @param {'original'|'modified'|string} side - source side.
     * @param {object[]|null} changes - Monaco line changes.
     * @returns {number} one-based destination line.
     */
    function transferDiffLine(line, side, changes) {
      const sourceLine = Math.max(1, Math.floor(Number(line)) || 1);
      if (side !== 'original' && side !== 'modified') return sourceLine;
      const list = (Array.isArray(changes) ? changes : [])
        .map((change) => side === 'original'
          ? {
              sourceStart: Math.max(1, Math.floor(Number(change?.originalStartLineNumber)) || 1),
              sourceEnd: Math.max(0, Math.floor(Number(change?.originalEndLineNumber)) || 0),
              targetStart: Math.max(1, Math.floor(Number(change?.modifiedStartLineNumber)) || 1),
              targetEnd: Math.max(0, Math.floor(Number(change?.modifiedEndLineNumber)) || 0),
            }
          : {
              sourceStart: Math.max(1, Math.floor(Number(change?.modifiedStartLineNumber)) || 1),
              sourceEnd: Math.max(0, Math.floor(Number(change?.modifiedEndLineNumber)) || 0),
              targetStart: Math.max(1, Math.floor(Number(change?.originalStartLineNumber)) || 1),
              targetEnd: Math.max(0, Math.floor(Number(change?.originalEndLineNumber)) || 0),
            })
        .sort((left, right) => left.sourceStart - right.sourceStart);
      let delta = 0;
      for (const change of list) {
        if (sourceLine < change.sourceStart) break;
        const sourceSpan = change.sourceEnd >= change.sourceStart ? change.sourceEnd - change.sourceStart + 1 : 0;
        const targetSpan = change.targetEnd >= change.targetStart ? change.targetEnd - change.targetStart + 1 : 0;
        if (sourceSpan > 0 && sourceLine <= change.sourceEnd) {
          if (targetSpan === 0) return change.targetStart;
          if (sourceSpan === 1 || targetSpan === 1) return change.targetStart;
          const progress = (sourceLine - change.sourceStart) / (sourceSpan - 1);
          return change.targetStart + Math.max(0, Math.min(targetSpan - 1, Math.round(progress * (targetSpan - 1))));
        }
        delta += targetSpan - sourceSpan;
      }
      return Math.max(1, sourceLine + delta);
    }

    function Icon({ name, size = 14 }) {
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
          return React.createElement('svg', common, React.createElement('path', { d: 'M1.8 4.2h4.1l1.1 1.2h7.2v7.1a1 1 0 0 1-1 1H2.8a1 1 0 0 1-1-1V4.2Z' }), React.createElement('path', { d: 'M1.8 5.4h12.4' }));
        case 'commit':
          return React.createElement('svg', common, React.createElement('path', { d: 'M8 1.5v3.3M8 11.2v3.3' }), React.createElement('circle', { cx: 8, cy: 8, r: 2.4 }));
        case 'diff':
          return React.createElement(
            'svg',
            common,
            React.createElement('rect', { x: 1.8, y: 2.4, width: 5.3, height: 11.2, rx: 0.8 }),
            React.createElement('rect', { x: 8.9, y: 2.4, width: 5.3, height: 11.2, rx: 0.8 }),
            React.createElement('path', { d: 'M3.4 6h2.2M10.4 6h2.2M4.5 4.9v2.2M10.4 10h2.2' }),
          );
        case 'code':
          return React.createElement(
            'svg',
            common,
            React.createElement('path', { d: 'm5.4 3.4-3.1 4.6 3.1 4.6M10.6 3.4l3.1 4.6-3.1 4.6M9.1 2.5 6.9 13.5' }),
          );
        case 'combinedDiff':
          return React.createElement(
            'svg',
            common,
            React.createElement('path', { d: 'M5.2 2.1h5l3 3v6.7H5.2V2.1Z' }),
            React.createElement('path', { d: 'M10.2 2.1v3h3M2.8 5.1v8.8h6.1' }),
            React.createElement('path', { d: 'M6.9 6.1h2.8M6.9 8.2h3.8M6.9 10.3h2.2M3.8 6.1h1M3.8 8.2h1M3.8 10.3h1' }),
          );
        case 'clipboard':
          return React.createElement(
            'svg',
            common,
            React.createElement('rect', { x: 3, y: 3, width: 10, height: 11, rx: 1.1 }),
            React.createElement('path', { d: 'M5.6 3V1.9h4.8V3M5.7 6.4h4.6M5.7 9h4.6M5.7 11.6h3' }),
          );
        case 'patchExport':
          return React.createElement(
            'svg',
            common,
            React.createElement('path', { d: 'M3 1.8h6.2l3.3 3.3v4.4M3 1.8v12.4h4.2' }),
            React.createElement('path', { d: 'M9.2 1.8v3.3h3.3M11.2 9v4.3M9.3 11.5l1.9 1.9 1.9-1.9M8.2 14.2h6' }),
          );
        case 'switchPane':
          return React.createElement(
            'svg',
            common,
            React.createElement('rect', { x: 1.8, y: 2.4, width: 5.1, height: 11.2, rx: 0.8 }),
            React.createElement('rect', { x: 9.1, y: 2.4, width: 5.1, height: 11.2, rx: 0.8 }),
            React.createElement('path', { d: 'M4.6 6.2h6.8M9.7 4.5l1.7 1.7-1.7 1.7M11.4 9.8H4.6M6.3 8.1 4.6 9.8l1.7 1.7' }),
          );
        case 'applyLeft':
          return React.createElement(
            'svg',
            common,
            React.createElement('path', { d: 'M2 8h11M9.5 4.5 13 8l-3.5 3.5' }),
            React.createElement('path', { d: 'M2 3.2v9.6' }),
          );
        case 'terminal':
          return React.createElement('svg', common, React.createElement('rect', { x: 1.5, y: 2.5, width: 13, height: 11, rx: 1 }), React.createElement('path', { d: 'm4 6 2 2-2 2M8.5 10h3' }));
        case 'harness':
          return React.createElement(
            'svg',
            common,
            React.createElement('path', { d: 'M2.2 3.2h9.2a2 2 0 0 1 2 2v4.3a2 2 0 0 1-2 2H7l-3.3 2.2v-2.2H4.2a2 2 0 0 1-2-2V3.2Z' }),
            React.createElement('path', { d: 'M5 6.2h.1M8 6.2h.1M11 6.2h.1' }),
          );
        case 'newFile':
          return React.createElement('svg', common, React.createElement('path', { d: 'M3 1.8h6.2l3.3 3.3v9.1H3V1.8Z' }), React.createElement('path', { d: 'M9.2 1.8v3.3h3.3M8 7.5v4M6 9.5h4' }));
        case 'newFolder':
          return React.createElement('svg', common, React.createElement('path', { d: 'M1.8 4.2h4.1l1.1 1.2h7.2v7.1a1 1 0 0 1-1 1H2.8a1 1 0 0 1-1-1V4.2Z' }), React.createElement('path', { d: 'M8 7.5v4M6 9.5h4' }));
        case 'target':
          return React.createElement('svg', common, React.createElement('circle', { cx: 8, cy: 8, r: 4.6 }), React.createElement('circle', { cx: 8, cy: 8, r: 1.2 }), React.createElement('path', { d: 'M8 1.2v2M8 12.8v2M1.2 8h2M12.8 8h2' }));
        case 'expand':
          return React.createElement('svg', common, React.createElement('path', { d: 'm4 6 4 4 4-4M4 2.5l4 4 4-4' }));
        case 'collapse':
          return React.createElement('svg', common, React.createElement('path', { d: 'm4 10 4-4 4 4M4 13.5l4-4 4 4' }));
        case 'refresh':
          return React.createElement('svg', common, React.createElement('path', { d: 'M13.2 8a5.2 5.2 0 1 1-1.6-3.7M13.2 2.4v4h-4' }));
        case 'groupBy':
          return React.createElement(
            'svg',
            common,
            React.createElement('path', { d: 'M2 3.2h12M2 8h8M2 12.8h10' }),
            React.createElement('path', { d: 'M12.2 6.2 14 8l-1.8 1.8' }),
          );
        case 'undo':
          return React.createElement('svg', common, React.createElement('path', { d: 'M5.2 4.2 2.4 7l2.8 2.8' }), React.createElement('path', { d: 'M2.8 7h6.4a3.7 3.7 0 0 1 0 7.4H6.4' }));
        case 'redo':
          return React.createElement('svg', common, React.createElement('path', { d: 'm10.8 4.2 2.8 2.8-2.8 2.8' }), React.createElement('path', { d: 'M13.2 7H6.8a3.7 3.7 0 0 0 0 7.4h2.8' }));
        case 'hide':
          return React.createElement('svg', common, React.createElement('path', { d: 'M3 8h10' }));
        case 'matchCase':
          return React.createElement(
            'svg',
            common,
            React.createElement('text', {
              x: 1.2,
              y: 11.8,
              fill: 'currentColor',
              stroke: 'none',
              fontSize: 10,
              fontWeight: 700,
              fontFamily: 'inherit',
            }, 'Aa'),
          );
        case 'wholeWords':
          return React.createElement(
            'svg',
            common,
            React.createElement('text', {
              x: 2.2,
              y: 11.8,
              fill: 'currentColor',
              stroke: 'none',
              fontSize: 10,
              fontWeight: 700,
              fontFamily: 'inherit',
            }, 'W'),
          );
        case 'regex':
          return React.createElement(
            'svg',
            common,
            React.createElement('text', {
              x: 1.5,
              y: 11.8,
              fill: 'currentColor',
              stroke: 'none',
              fontSize: 8.5,
              fontWeight: 700,
              fontFamily: 'monospace',
            }, '.*'),
          );
        case 'preserveCase':
          return React.createElement(
            'svg',
            common,
            React.createElement('text', {
              x: 1.4,
              y: 11.8,
              fill: 'currentColor',
              stroke: 'none',
              fontSize: 10,
              fontWeight: 700,
              fontFamily: 'inherit',
            }, 'AB'),
          );
        case 'replace':
          return React.createElement(
            'svg',
            common,
            React.createElement('path', { d: 'M2.2 5.1h8.4a2.1 2.1 0 0 1 0 4.2H8.1' }),
            React.createElement('path', { d: 'm4.3 3.2-2.1 1.9 2.1 1.9M5.8 7.2 8 9.3 5.8 11.4' }),
          );
        case 'close':
          return React.createElement('svg', common, React.createElement('path', { d: 'M4 4l8 8M12 4 4 12' }));
        case 'eye':
          return React.createElement(
            'svg',
            common,
            React.createElement('path', { d: 'M1.4 8S3.6 4 8 4s6.6 4 6.6 4-2.2 4-6.6 4S1.4 8 1.4 8Z' }),
            React.createElement('circle', { cx: 8, cy: 8, r: 1.9 }),
          );
        case 'settings':
          return React.createElement('svg', common, React.createElement('circle', { cx: 8, cy: 8, r: 2.2 }), React.createElement('path', { d: 'M8 1.4v1.8M8 12.8v1.8M1.4 8h1.8M12.8 8h1.8M3.3 3.3l1.3 1.3M11.4 11.4l1.3 1.3M3.3 12.7l1.3-1.3M11.4 4.6l1.3-1.3' }));
        case 'lock':
          return React.createElement('svg', common, React.createElement('rect', { x: 3.2, y: 7, width: 9.6, height: 6.8, rx: 1 }), React.createElement('path', { d: 'M5.2 7V5.2a2.8 2.8 0 0 1 5.6 0V7' }));
        case 'unlock':
          return React.createElement('svg', common, React.createElement('rect', { x: 3.2, y: 7, width: 9.6, height: 6.8, rx: 1 }), React.createElement('path', { d: 'M5.2 7V5.2a2.8 2.8 0 0 1 5.4-1' }));
        case 'chevronRight':
          return React.createElement('svg', common, React.createElement('path', { d: 'm6 3.5 5 4.5-5 4.5' }));
        case 'chevronLeft':
          return React.createElement('svg', common, React.createElement('path', { d: 'm10 3.5-5 4.5 5 4.5' }));
        case 'chevronDown':
          return React.createElement('svg', common, React.createElement('path', { d: 'm3.5 6 4.5 5 4.5-5' }));
        case 'chevronUp':
          return React.createElement('svg', common, React.createElement('path', { d: 'm3.5 10 4.5-5 4.5 5' }));
        case 'autoscroll':
          /* IDEA's "Autoscroll from Source": a target with a trailing arrow. */
          return React.createElement('svg', common, React.createElement('circle', { cx: 7, cy: 9, r: 3.4 }), React.createElement('circle', { cx: 7, cy: 9, r: 1, fill: 'currentColor', stroke: 'none' }), React.createElement('path', { d: 'M10.4 5.6 14 2M14 2h-3.2M14 2v3.2' }));
        case 'folder':
          /* `flex: none` is load-bearing: as a flex child with an aspect ratio the svg
             had its WIDTH squeezed (measured 10x16 instead of 16x16), which read as
             "the root folder icon shrank after render". */
          return React.createElement('svg', { width: size, height: size, viewBox: '0 0 16 16', 'aria-hidden': 'true', style: { flex: 'none', display: 'block' } }, React.createElement('path', { d: 'M1.5 4.1h4.2l1.1 1.2h7.7v6.9a1 1 0 0 1-1 1H2.5a1 1 0 0 1-1-1V4.1Z', fill: '#8ba4c7' }), React.createElement('path', { d: 'M1.5 4.1h4.2l1.1 1.2h7.7', stroke: '#6b86ad', strokeWidth: 0.8, fill: 'none' }));
        case 'folderOpen':
          return React.createElement('svg', { width: size, height: size, viewBox: '0 0 16 16', 'aria-hidden': 'true', style: { flex: 'none', display: 'block' } }, React.createElement('path', { d: 'M1.5 4.1h4.2l1.1 1.2h7.7v6.9a1 1 0 0 1-1 1H2.5a1 1 0 0 1-1-1V4.1Z', fill: '#8ba4c7' }), React.createElement('path', { d: 'M1.5 6.5h13M3.4 6.5 2 13.2M13.8 6.5l-1.2 6.7', stroke: '#6b86ad', strokeWidth: 0.7, fill: 'none' }));
        case 'file':
          return React.createElement('svg', common, React.createElement('path', { d: 'M3.2 1.8h6l3.2 3.2v9.2H3.2V1.8Z' }), React.createElement('path', { d: 'M9.2 1.8v3.2h3.2' }));
        case 'check':
          return React.createElement('svg', common, React.createElement('path', { d: 'm2.5 8.4 3.2 3.2 7.8-7.8' }));
        case 'remove':
          return React.createElement('svg', common, React.createElement('circle', { cx: 8, cy: 8, r: 5.6 }), React.createElement('path', { d: 'M4.8 8h6.4' }));
        case 'more':
          return React.createElement('svg', common, React.createElement('path', { d: 'M2.2 4h11.6M2.2 8h9M2.2 12h6.4' }), React.createElement('path', { d: 'm10.4 10.6 2.8 2.8m0-2.8-2.8 2.8' }));
        case 'unified':
          return React.createElement(
            'svg',
            common,
            React.createElement('rect', { x: 1.8, y: 2.6, width: 12.4, height: 10.8, rx: 1 }),
            React.createElement('path', { d: 'M3.7 5.5h3.1M8.4 5.5h3.9M3.7 8h1.1M6 8h6.3M3.7 10.5h4M9.3 10.5h3' }),
          );
        case 'split':
          return React.createElement('svg', common, React.createElement('rect', { x: 1.8, y: 2.6, width: 12.4, height: 10.8, rx: 1 }), React.createElement('path', { d: 'M8 2.6v10.8' }));
        case 'swap':
          return React.createElement('svg', common, React.createElement('path', { d: 'M3 5h9.5M9.7 2.2 12.5 5l-2.8 2.8M13 11H3.5M6.3 8.2 3.5 11l2.8 2.8' }));
        case 'annotate':
          return React.createElement('svg', common, React.createElement('path', { d: 'M2.4 3.2h11.2M2.4 8h6M2.4 12.8h4.4' }), React.createElement('path', { d: 'M11 6.6v3.2a2 2 0 0 1-2 2H6.4' }));
        case 'graph':
          return React.createElement('svg', common, React.createElement('circle', { cx: 4, cy: 3.4, r: 1.6 }), React.createElement('circle', { cx: 4, cy: 12.6, r: 1.6 }), React.createElement('circle', { cx: 11.5, cy: 8, r: 1.6 }), React.createElement('path', { d: 'M4 5v6M5.6 8h4.3' }));
        case 'graphNode':
          return React.createElement('svg', { ...common, viewBox: '0 0 12 12' }, React.createElement('circle', { cx: 6, cy: 6, r: 3.4, fill: 'currentColor', stroke: 'none' }));
        case 'graphMerge':
          return React.createElement('svg', { ...common, viewBox: '0 0 12 12' }, React.createElement('circle', { cx: 6, cy: 6, r: 3.4 }), React.createElement('circle', { cx: 6, cy: 6, r: 1.2, fill: 'currentColor', stroke: 'none' }));
        case 'stash':
          return React.createElement('svg', common, React.createElement('path', { d: 'M2.4 3.2h11.2v3.1a1 1 0 0 1-1 1H3.4a1 1 0 0 1-1-1V3.2Z' }), React.createElement('path', { d: 'M4.6 7.3v5.5h6.8V7.3' }), React.createElement('path', { d: 'M6.4 10h3.2' }));
        case 'push':
          return React.createElement('svg', common, React.createElement('path', { d: 'M8 12.4V3.2M4.2 6.9 8 3.1l3.8 3.8' }), React.createElement('path', { d: 'M3 13.2h10' }));
        case 'update':
          return React.createElement('svg', common, React.createElement('path', { d: 'M8 2.8v8.4M4.6 8 8 11.4 11.4 8' }), React.createElement('path', { d: 'M2.6 13.2h10.8' }));
        case 'fetch':
          return React.createElement('svg', common, React.createElement('path', { d: 'M8 2.2v6.2M5.2 6 8 8.8 10.8 6' }), React.createElement('path', { d: 'M2.6 10.4v2.4a1 1 0 0 0 1 1h8.8a1 1 0 0 0 1-1v-2.4' }));
        case 'sort':
          return React.createElement('svg', common, React.createElement('path', { d: 'M2.5 4h11M2.5 8h7.5M2.5 12h4' }));
        case 'ignore':
          return React.createElement('svg', common, React.createElement('circle', { cx: 8, cy: 8, r: 5.6 }), React.createElement('path', { d: 'm4 12 8-8' }));
        case 'lineNumbers':
          return React.createElement('svg', common, React.createElement('path', { d: 'M2.4 3.5h1.8M6.2 3.5h7.4M2.4 8h1.8M6.2 8h7.4M2.4 12.5h1.8M6.2 12.5h7.4' }));
        case 'wrap':
          return React.createElement('svg', common, React.createElement('path', { d: 'M2.5 3.5h11M2.5 7.5h8.2a2.3 2.3 0 0 1 0 4.6H7.8' }), React.createElement('path', { d: 'm9.8 10.2-2 1.9 2 1.9M2.5 13.5h2.8' }));
        case 'indentGuides':
          return React.createElement('svg', common, React.createElement('path', { d: 'M2.5 3v10M5.5 5v6M8.5 3v10M11.5 5v6' }), React.createElement('path', { d: 'M6.8 5h7M9.8 8h4M12.8 11h1' }));
        case 'whitespace':
          return React.createElement(
            'svg',
            common,
            React.createElement('circle', { cx: 3.2, cy: 8, r: 0.8, fill: 'currentColor', stroke: 'none' }),
            React.createElement('circle', { cx: 8, cy: 8, r: 0.8, fill: 'currentColor', stroke: 'none' }),
            React.createElement('circle', { cx: 12.8, cy: 8, r: 0.8, fill: 'currentColor', stroke: 'none' }),
            React.createElement('path', { d: 'M2.5 11.5h11' }),
          );
        case 'search':
          return React.createElement('svg', common, React.createElement('circle', { cx: 7, cy: 7, r: 4.2 }), React.createElement('path', { d: 'm10.2 10.2 3.6 3.6' }));
        case 'findWindow':
          return React.createElement(
            'svg',
            common,
            React.createElement('rect', { x: 1.8, y: 2.4, width: 12.4, height: 10.8, rx: 1 }),
            React.createElement('circle', { cx: 7, cy: 7.1, r: 2.5 }),
            React.createElement('path', { d: 'm8.9 9 2.2 2.2M4.3 11.2h3.1' }),
          );
        case 'filter':
          return React.createElement('svg', common, React.createElement('path', { d: 'M2.2 3h11.6l-4.4 5.1v4.2l-2.8 1.5V8.1L2.2 3Z' }));
        case 'preview':
          return React.createElement(
            'svg',
            common,
            React.createElement('rect', { x: 1.8, y: 2.5, width: 12.4, height: 9.3, rx: 0.9 }),
            React.createElement('path', { d: 'M8 11.8v2M5.2 13.8h5.6M4.2 5.4h7.6M4.2 7.6h5.2' }),
          );
        case 'history':
          return React.createElement('svg', common, React.createElement('circle', { cx: 8, cy: 8, r: 5.6 }), React.createElement('path', { d: 'M8 4.6V8l2.5 1.6' }));
        case 'pin':
          return React.createElement(
            'svg',
            common,
            React.createElement('path', { d: 'M5 1.8h6l-1.1 4 2 2.1v1H4.1v-1l2-2.1-1.1-4Z' }),
            React.createElement('path', { d: 'M8 8.9v5.3' }),
          );
        default:
          return null;
      }
    }

    /** A file/folder icon row cell. */
    function EntryIcon({ entry, expanded }) {
      if (entry.kind === 'directory') {
        return React.createElement(Icon, { name: entry.root ? 'folderOpen' : expanded ? 'folderOpen' : 'folder', size: 18 });
      }
      /* Prefer the host's file-type artwork, the same source DSH's explorer and
         the reference sidebar use. The old badge stays as a fallback so an
         older host without the frozen primitive module still renders a tree. */
      if (typeof primitives?.FileTypeIcon === 'function') {
        return React.createElement(primitives.FileTypeIcon, { path: entry.path, size: 16 });
      }
      const badge = fileBadge(entry.path);
      if (badge === null) return React.createElement(Icon, { name: 'file', size: 16 });
      return React.createElement(
        'span',
        {
          style: {
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
          },
        },
        badge.label,
      );
    }

    /** Status color and compact label for one git porcelain status. */
    function gitStatusInfo(status) {
      if (status === undefined) return null;
      if (status === '??') return { label: 'U', color: '#6e7781' };
      const index = status[0];
      const worktree = status[1];
      if (index === 'R' || index === 'C') return { label: index, color: '#8250df' };
      if (index === 'A') return { label: 'A', color: '#1a7f37' };
      if (index === 'D' || worktree === 'D') return { label: 'D', color: '#cf222e' };
      if (index === 'U' || worktree === 'U') return { label: '!', color: '#cf222e' };
      if (index === 'M') return { label: 'M', color: '#2f65ca' };
      if (worktree === 'M') return { label: 'M↓', color: '#2f65ca' };
      if (worktree === 'A') return { label: 'A', color: '#1a7f37' };
      return { label: '±', color: '#2f65ca' };
    }

    /**
     * Whether the current path can be compared with its content at HEAD.
     *
     * Added and renamed/copied index entries name a path that did not exist in
     * HEAD, and untracked files have no HEAD identity at all. The host's revision
     * diff intentionally reports that as an error, so do not offer an action that
     * is guaranteed to fail.
     * @param {object|null} change - porcelain change entry.
     * @returns {boolean} true when `HEAD:<path>` can be resolved.
     */
    function canCompareWithHead(change) {
      const status = typeof change?.status === 'string' ? change.status : '';
      if (status.length < 2 || status === '??') return false;
      return status[0] !== 'A' && status[0] !== 'R' && status[0] !== 'C';
    }

    /**
     * The status badge a palette row should show, or null when the file is clean.
     *
     * Go to File lists paths only; without the badge, two files with the same
     * basename are indistinguishable and the modified one (the one you were
     * probably looking for) does not stand out — IDEA's search popups mark them.
     * @param {string} path - workspace-relative file path.
     * @param {Map<string, string>} changes - porcelain status by path.
     * @returns {{label: string, color: string}|null} badge info.
     */
    function badgeFor(path, changes) {
      if (!(changes instanceof Map)) return null;
      const status = changes.get(path);
      return gitStatusInfo(status);
    }

    /**
     * Whether every selected change is Git-unversioned.
     *
     * Rollback deletes these paths instead of restoring an index version, so
     * callers must use explicit deletion wording and confirmation.
     * @param {{path: string}[]} selected - selected change identities.
     * @param {Map<string, {status?: string}>} changes - porcelain status by path.
     * @returns {boolean} true only for a non-empty all-`??` set.
     */
    function allPathsUnversioned(selected, changes) {
      const list = Array.isArray(selected) ? selected : [];
      if (list.length === 0 || !(changes instanceof Map)) return false;
      return list.every((entry) => entry?.path !== undefined && changes.get(entry.path)?.status === '??');
    }

    /**
     * Paths IDEA's Remove from VCS action may schedule for deletion.
     *
     * The action exists only for files missing from the working tree that are
     * not already deleted in the index. `DD` is therefore excluded: the index
     * already records that deletion, and scheduling it again would be a no-op.
     * Paths whose worktree side is still present never qualify, even when the
     * index side says `D`.
     * @param {{path: string, staged?: boolean}[]} selected - selected change identities.
     * @param {Map<string, {status?: string}>} changes - porcelain status by path.
     * @returns {string[]} unique unstaged paths still needing index removal.
     */
    function pathsScheduledForRemoval(selected, changes) {
      const list = Array.isArray(selected) ? selected : [];
      if (list.length === 0 || !(changes instanceof Map)) return [];
      const paths = [];
      for (const entry of list) {
        if (entry?.staged === true || typeof entry?.path !== 'string' || entry.path === '') continue;
        const status = changes.get(entry.path)?.status;
        if (typeof status !== 'string' || status.length < 2) continue;
        if (status[0] === 'D' || status[1] !== 'D') continue;
        if (!paths.includes(entry.path)) paths.push(entry.path);
      }
      return paths;
    }

    /**
     * Three-state selection for one directory or group (IDEA's tri-state checkbox).
     *
     * "some" is the state that matters: a directory holding two changed files
     * where only one is ticked must not render as an empty checkbox, or the user
     * cannot tell a partial selection from none at all.
     * @param {string[]} paths - every changed path below this node.
     * @param {Set<string>} selected - currently ticked paths.
     * @returns {'all'|'some'|'none'} the state to render.
     */
    function selectionStateOf(paths, selected) {
      const members = Array.isArray(paths) ? paths : [];
      if (members.length === 0) return 'none';
      const picked = members.filter((path) => selected?.has?.(path) === true).length;
      if (picked === 0) return 'none';
      return picked === members.length ? 'all' : 'some';
    }

    /**
     * Sum one band's line counts, IDEA's `+12 −3` on a directory or group header.
     *
     * Each band (staged vs working tree) reads its own side: the same file can
     * appear in both, and adding the two together would double-count it. Rows
     * with no reading (an untracked file) and binary rows contribute nothing,
     * and a band with no readings at all returns `undefined` so the header stays
     * blank instead of claiming `+0 −0`.
     * @param {object[]} changes - changes in this band or below one directory.
     * @param {'staged'|'unstaged'|'unversioned'} band - which side to read.
     * @returns {{additions: number, deletions: number}|undefined} summed counts.
     */
    function subtotalOf(changes, band) {
      if (!Array.isArray(changes) || changes.length === 0) return undefined;
      const readings = changes
        .map((change) => (band === 'staged' ? change?.stagedLines : band === 'unstaged' ? change?.unstagedLines : undefined))
        .filter((counts) => counts !== undefined && counts !== null && counts.binary !== true);
      if (readings.length === 0) return undefined;
      return {
        additions: readings.reduce((total, counts) => total + counts.additions, 0),
        deletions: readings.reduce((total, counts) => total + counts.deletions, 0),
      };
    }

    /**
     * The file name of a workspace-relative path, split for a two-tone label.
     *
     * IDEA's diff and editor headers print `r147nest/deep/inner/x.ts` with the
     * path in grey and the NAME in the emphasised colour, and they never
     * ellipsize the name: the path is the part that gives way. Splitting here
     * (rather than in each header) keeps the diff pane, the annotate pane and
     * the compare-with-revision pane on the same rule.
     * @param {string} path - workspace-relative path.
     * @returns {{dir: string, name: string}} the muted parent and the name.
     */
    function splitPathLabel(path) {
      const text = typeof path === 'string' ? path : '';
      const index = text.lastIndexOf('/');
      /* No trailing slash on purpose: the label is `direction: rtl` so an
         over-long path keeps its tail, and in that context a trailing `/` is a
         neutral character that bidi moves to the FRONT (`/r147nest`). */
      return { dir: index < 0 ? '' : text.slice(0, index), name: index < 0 ? text : text.slice(index + 1) };
    }

    /**
     * IDEA's per-row change size: `+N` in green and `−M` in red.
     *
     * A binary change has no counts at all, so it renders as `bin` instead of a
     * fabricated `+0 −0`; a path with no numstat row (an untracked file) renders
     * nothing at all, because the absence of the number IS the information.
     * @param {{counts: object|undefined}} props - numstat reading for this row.
     * @returns {object|null} the badge, or null when there is nothing honest to show.
     */
    function LineCounts({ counts }) {
      if (counts === undefined || counts === null) return null;
      if (counts.binary === true) {
        return React.createElement('span', { className: 'dsh-editor-line-counts dsh-editor-line-counts-binary', style: styles.lineCountBinary, title: 'binary' }, 'bin');
      }
      const className = counts.additions === 0 && counts.deletions > 0
        ? 'dsh-editor-line-counts dsh-editor-line-counts-deletions-only'
        : 'dsh-editor-line-counts';
      return React.createElement(
        'span',
        { className, style: styles.lineCounts, title: `+${counts.additions} −${counts.deletions}` },
        React.createElement('span', { className: 'dsh-editor-line-count-add', style: styles.lineCountAdd }, `+${counts.additions}`),
        React.createElement('span', { className: 'dsh-editor-line-count-del', style: styles.lineCountDel }, `−${counts.deletions}`),
      );
    }

    /**
     * Split a commit message into IDEA's subject line and its body.
     *
     * Git convention (and IDEA's own counters) treat the first line as the subject:
     * 50 characters is the soft limit, 72 the point where the log pane truncates.
     * @param {string} message - full commit message draft.
     * @returns {{subject: string, body: string, subjectLength: number, bodyLines: number}} decomposed message.
     */
    function commitMetrics(message) {
      const text = typeof message === 'string' ? message : '';
      const newline = text.indexOf('\n');
      const subject = newline === -1 ? text : text.slice(0, newline);
      const body = newline === -1 ? '' : text.slice(newline + 1);
      return {
        subject,
        body,
        subjectLength: subject.trimEnd().length,
        bodyLines: body === '' ? 0 : body.trimEnd().split('\n').length,
      };
    }

    /** Small left-hand git status decoration matching IDEA's M↓/A/D marks. */
    function GitStatusBadge({ status, selected, info: explicit = null }) {
      const info = explicit ?? gitStatusInfo(status);
      if (info === null) return null;
      return React.createElement(
        'span',
        { style: { ...styles.statusBadge, color: selected ? '#fff' : info.color }, title: typeof status === 'string' ? status : info.label },
        info.label,
      );
    }

    /** One vertical activity-stripe entry. */
    function StripeItem({ id, label, icon, active, onClick, title = label }) {
      return React.createElement(
        'button',
        {
          type: 'button',
          className: 'dsh-editor-stripe-item',
          style: { ...styles.stripeItem, ...(active ? styles.stripeItemActive : null) },
          title,
          'aria-label': label,
          'aria-pressed': active,
          onClick: () => onClick(id),
        },
        React.createElement(Icon, { name: icon, size: 16 }),
        React.createElement('span', { style: styles.stripeText }, label),
      );
    }

    /** Left activity stripe: IDEA tool windows plus the Harness chat toggle. */
    function ActivityStripe({ activity, panelVisible, terminalOpen, harnessCollapsed, onSelect, onToggleHarness, onCloseEditor, t }) {
      return React.createElement(
        'div',
        {
          style: styles.stripe,
          role: 'toolbar',
          'aria-label': t('editor.toolWindows'),
          'aria-orientation': 'vertical',
          'data-dsh-editor-activity-stripe': '',
        },
        React.createElement(StripeItem, {
          id: 'project',
          label: t('editor.project'),
          icon: 'project',
          active: activity === 'project' && panelVisible,
          onClick: onSelect,
        }),
        React.createElement(StripeItem, {
          id: 'commit',
          label: t('editor.commit'),
          icon: 'commit',
          active: activity === 'commit' && panelVisible,
          onClick: onSelect,
        }),
        React.createElement(StripeItem, {
          id: 'terminal',
          label: t('editor.terminal'),
          icon: 'terminal',
          active: terminalOpen,
          onClick: onSelect,
        }),
        React.createElement(StripeItem, {
          id: 'harness',
          label: t('editor.harness'),
          title: t(harnessCollapsed ? 'editor.showHarness' : 'editor.hideHarness'),
          icon: 'harness',
          active: harnessCollapsed !== true,
          onClick: onToggleHarness,
        }),
        harnessCollapsed
          ? React.createElement(
              'button',
              {
                type: 'button',
                className: 'dsh-editor-stripe-item dsh-editor-stripe-close',
                style: { ...styles.stripeItem, ...styles.stripeUtilityItem },
                title: t('editor.closeEditor'),
                'aria-label': t('editor.closeEditor'),
                onClick: onCloseEditor,
              },
              React.createElement(Icon, { name: 'close', size: 16 }),
            )
          : null,
      );
    }

    /**
     * Compute direct action counts for a tool-window toolbar.
     *
     * IDEA keeps the trailing actions stable and overflows the middle. Once
     * any action must overflow, reserve that button's slot before distributing
     * room to the trailing suffix.
     * @param {number} width - toolbar width.
     * @param {number} titleWidth - rendered title width.
     * @param {number} leftCount - leading action count.
     * @param {number} rightCount - trailing action count.
     * @param {number} badgeWidth - optional branch badge width.
     * @returns {{left: number, right: number}} direct action counts.
     */
    function panelToolbarFit(width, titleWidth, leftCount, rightCount, badgeWidth = 0) {
      const totalWidth = Math.max(0, Number(width) || 0);
      const totalActions = Math.max(0, Math.floor(Number(leftCount) || 0)) + Math.max(0, Math.floor(Number(rightCount) || 0));
      let room = totalWidth - 14 - Math.max(0, Number(titleWidth) || 0);
      let left = Math.max(0, Math.floor(Number(leftCount) || 0));
      let right = Math.max(0, Math.floor(Number(rightCount) || 0));
      const badge = Math.max(0, Number(badgeWidth) || 0);
      const badgeRoom = badge > 0 ? badge + 4 : 0;
      if (totalActions * 25 + badgeRoom <= room) return { left, right };
      /* One "»" button is required once the full set does not fit. */
      room -= 25;
      /* The branch chip is fixed information, not an action that may overflow.
         Reserve it before distributing slots or actions will push it past the
         toolbar edge after consuming the remaining width. */
      room -= badgeRoom;
      right = Math.min(right, Math.max(0, Math.floor(room / 25)));
      room -= right * 25;
      left = Math.min(left, Math.max(0, Math.floor(room / 25)));
      return { left, right };
    }

    /**
     * IDEA-style tool-window toolbar with overflow.
     *
     * IDEA never squeezes the tool-window title to make room for actions: once
     * the actions stop fitting they collapse into a "»" menu. The groups are
     * measured independently so left/right alignment survives a narrow panel.
     */
    function PanelToolbar({ icon, title, titleAction = null, titleActionStyle = null, left = [], right = [], badge = null, t, onBadge, badgeHasPopup = undefined, badgeExpanded = undefined, ariaLabel = null }) {
      const ref = React.useRef(null);
      const titleRef = React.useRef(null);
      const badgeRef = React.useRef(null);
      const [fits, setFits] = React.useState({ left: left.length, right: right.length });
      const [menu, setMenu] = React.useState(null);
      const leftKey = left.map((action) => action.id).join('|');
      const rightKey = right.map((action) => action.id).join('|');

      React.useLayoutEffect(() => {
        const node = ref.current;
        if (node === null) return;
        const measure = () => {
          const next = panelToolbarFit(
            node.clientWidth,
            titleRef.current?.offsetWidth ?? 0,
            left.length,
            right.length,
            badgeRef.current?.offsetWidth ?? 0,
          );
          const nextLeft = next.left;
          const nextRight = next.right;
          setFits((current) => (current.left === nextLeft && current.right === nextRight ? current : { left: nextLeft, right: nextRight }));
        };
        measure();
        const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
        observer?.observe(node);
        return () => observer?.disconnect();
      }, [leftKey, rightKey, badge]);

      /* A group's first N actions are the ones that fit. RIGHT is measured
         from its tail, so materialise the kept suffix after the head-kept
         left group. */
      const hidden = [...left.slice(fits.left), ...right.slice(0, right.length - fits.right)];
      const openOverflowMenu = (rect) => {
        setMenu({
          x: Math.max(4, rect.right - 188),
          y: rect.bottom + 4,
          items: groupCompactActions(hidden).map((action) => action === null ? null : ({
            id: action.id,
            label: action.label,
            shortcut: action.active === true ? '✓' : '',
            disabled: action.disabled === true,
            active: typeof action.active === 'boolean' ? action.active : undefined,
            run: () => action.onClick(),
            ariaKeyShortcuts: action.ariaKeyShortcuts,
          })),
        });
      };
      const renderAction = (action) =>
        React.createElement(ToolbarButton, {
          key: action.id,
          icon: action.icon,
          label: action.label,
          disabled: action.disabled === true,
          active: toolbarActionActive(action),
          onClick: action.onClick,
          ariaKeyShortcuts: action.ariaKeyShortcuts,
          ariaHasPopup: action.ariaHasPopup,
          ariaExpanded: action.ariaExpanded,
        });

      return React.createElement(
        'div',
        {
          ref,
          style: styles.panelToolbar,
          role: 'toolbar',
          'aria-label': ariaLabel,
          'aria-orientation': 'horizontal',
        },
        React.createElement(
          'span',
          {
            ref: titleRef,
            /* The Project selector needs room for "Project: <current view>".
               Actions that no longer fit move into the standard "»" menu. */
            style: titleAction === null
              ? styles.panelTitle
              : { ...styles.panelTitle, maxWidth: '45%', ...(titleActionStyle ?? null) },
          },
          icon === undefined ? null : React.createElement(Icon, { name: icon, size: 14 }),
          titleAction ?? title,
        ),
        left.slice(0, fits.left).map(renderAction),
        React.createElement('span', { style: styles.toolbarSpacer }),
        badge === null
          ? null
          : onBadge === undefined
            ? React.createElement('span', { ref: badgeRef, style: styles.branchChip }, badge)
            : React.createElement(
                'button',
                {
                  ref: badgeRef,
                  type: 'button',
                  className: 'dsh-editor-branch-button',
                  style: { ...styles.branchChip, border: 'none', cursor: 'pointer' },
                  title: t('editor.branchPopup'),
                  'aria-label': t('editor.branchPopup'),
                  'aria-haspopup': badgeHasPopup,
                  'aria-expanded': badgeHasPopup === undefined ? undefined : badgeExpanded === true,
                  onClick: (event) => {
                    const rect = event.currentTarget.getBoundingClientRect();
                    onBadge({ x: rect.left, y: rect.bottom + 4 });
                  },
                },
                badge,
              ),
        right.slice(right.length - fits.right).map(renderAction),
        hidden.length === 0
          ? null
          : React.createElement(ToolbarButton, {
              icon: 'more',
              label: t('editor.moreActions'),
              onClick: (event) => {
                openOverflowMenu(event.currentTarget.getBoundingClientRect());
              },
              onKeyDown: (event) => {
                if (event.key === 'ContextMenu' || (event.shiftKey === true && event.key === 'F10')) {
                  event.preventDefault();
                  event.stopPropagation();
                  openOverflowMenu(event.currentTarget.getBoundingClientRect());
                }
              },
              onContextMenu: (event) => {
                event.preventDefault();
                event.stopPropagation();
                openOverflowMenu(event.currentTarget.getBoundingClientRect());
              },
              ariaHasPopup: 'menu',
              ariaExpanded: menu !== null,
            }),
        menu === null ? null : React.createElement(ContextMenu, { menu, onClose: () => setMenu(null), t }),
      );
    }

    /**
     * Preserve the difference between an explicit toggle state and a command.
     *
     * IDEA actions are either toggles with a real on/off state or ordinary
     * commands. Feeding `undefined` into a boolean toggle would make screen
     * readers announce every command as an unpressed button.
     * @param {{active?: boolean}|null|undefined} action - toolbar action.
     * @returns {boolean|undefined} explicit pressed state, or undefined.
     */
    function toolbarActionActive(action) {
      return typeof action?.active === 'boolean' ? action.active : undefined;
    }

    /**
     * IDEA's Unified / Side-by-side segmented diff-mode control.
     *
     * At normal widths both modes stay visible, with the active mode pressed.
     * The narrow fallback retains one toggle so hunk navigation and Close keep
     * their reserved space.
     * @param {{t: Function, mode: 'paired'|'toggle', sideBySide: boolean, disabled: boolean, onChange: Function}} props - mode control state.
     * @returns {object} toolbar control.
     */
    function DiffViewModeControl({ t, mode, sideBySide, disabled, onChange }) {
      const unified = React.createElement(ToolbarButton, {
        icon: 'unified',
        label: t('editor.diffUnifiedMode'),
        active: sideBySide === false,
        disabled,
        onClick: () => onChange(false),
      });
      const sideBySideButton = React.createElement(ToolbarButton, {
        icon: 'split',
        label: t('editor.diffSideBySideMode'),
        active: sideBySide === true,
        disabled,
        onClick: () => onChange(true),
      });
      const toggle = React.createElement(ToolbarButton, {
        icon: sideBySide ? 'split' : 'unified',
        label: sideBySide ? t('editor.diffUnifiedMode') : t('editor.diffSideBySideMode'),
        disabled,
        onClick: () => onChange(sideBySide === false),
      });
      return React.createElement(
        'span',
        {
          style: styles.diffModeSwitch,
          className: 'dsh-editor-diff-mode-switch',
          'data-dsh-diff-fixed': '',
          role: 'group',
          'aria-label': t('editor.diffViewModeGroup'),
        },
        mode === 'paired' ? unified : toggle,
        mode === 'paired' ? sideBySideButton : null,
      );
    }

    /** One 24px panel toolbar button. */
    function ToolbarButton({
      icon,
      label,
      onClick,
      disabled = false,
      active = undefined,
      onKeyDown = null,
      onContextMenu = null,
      ariaHasPopup = undefined,
      ariaExpanded = undefined,
      ariaKeyShortcuts = undefined,
      style = null,
    }) {
      return React.createElement(
        'button',
        {
          type: 'button',
          className: active === true ? 'dsh-editor-toolbar-button dsh-editor-toolbar-button-active' : 'dsh-editor-toolbar-button',
          style: {
            ...styles.toolbarButton,
            ...(disabled ? styles.toolbarButtonDisabled : null),
            ...(active === true ? styles.toolbarButtonActive : null),
            ...(style ?? null),
          },
          title: label,
          'aria-label': label,
          /* Only real toggles expose pressed semantics. React omits the attribute
             for undefined, so ordinary commands remain ordinary buttons. */
          'aria-pressed': typeof active === 'boolean' ? active : undefined,
          'aria-haspopup': ariaHasPopup,
          'aria-expanded': ariaExpanded,
          'aria-keyshortcuts': ariaKeyShortcuts,
          disabled,
          onClick: onClick,
          onKeyDown,
          onContextMenu,
        },
        React.createElement(Icon, { name: icon, size: 14 }),
      );
    }

    /**
     * Choose the direct actions for a compact toolbar.
     *
     * IDEA keeps high-frequency toolbar actions available while secondary
     * actions move into the overflow menu. Pinned actions are reserved first;
     * the remaining slots follow the caller's original order so the wide
     * toolbar and overflow menu never invent a second action sequence.
     * @param {object[]} actions - toolbar actions in display order.
     * @param {number} directLimit - maximum number of direct action buttons.
     * @returns {object[]} actions that remain directly visible.
     */
    function selectCompactActions(actions, directLimit) {
      const limit = Math.max(0, Math.floor(Number(directLimit) || 0));
      if (actions.length <= limit) return actions;
      if (limit === 0) return [];
      const selected = new Set(
        actions
          .filter((action) => action.pinned === true)
          .slice(0, limit),
      );
      let remaining = limit - selected.size;
      for (const action of actions) {
        if (remaining === 0) break;
        if (action.pinned === true || selected.has(action)) continue;
        selected.add(action);
        remaining -= 1;
      }
      return actions.filter((action) => selected.has(action));
    }

    /**
     * Insert ContextMenu separators only where the action's IDEA group changes.
     * @param {object[]} actions - overflow actions in display order.
     * @returns {Array<object|null>} actions with null separator entries.
     */
    function groupCompactActions(actions) {
      const grouped = [];
      let group = null;
      for (const action of actions) {
        if (group !== null && action.group !== group) grouped.push(null);
        grouped.push(action);
        group = action.group;
      }
      return grouped;
    }

    /**
     * A compact tool-window action strip that keeps pinned/leading actions and
     * overflows the rest into IDEA's `»` menu.
     *
     * The Commit Changes pane is often only ~190px wide. Laying every action out
     * at a fixed width makes the last ones cross the pane edge, where overflow
     * hides them without any way to reach them. This measures in 26px slots and
     * reserves one slot for the overflow button.
     * @param {{actions: object[], t: Function, ariaLabel: string}} props - strip model.
     * @returns {object} the measured toolbar.
     */
    function CompactActionBar({ actions, t, ariaLabel, style = null, slotWidth = 26 }) {
      const ref = React.useRef(null);
      const [visibleCount, setVisibleCount] = React.useState(actions.length);
      const [menuPosition, setMenuPosition] = React.useState(null);
      const actionsKey = actions.map((action) => action.id).join('|');
      const actionSlotWidth = Math.max(26, Number(slotWidth) || 26);

      React.useLayoutEffect(() => {
        const node = ref.current;
        if (node === null) return;
        const measure = () => {
          const slots = Math.max(0, Math.floor((node.clientWidth - 8) / actionSlotWidth));
          const next = actions.length <= slots ? actions.length : Math.max(0, slots - 1);
          setVisibleCount((current) => (current === next ? current : next));
        };
        measure();
        const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
        observer?.observe(node);
        return () => observer?.disconnect();
      /* `visibleCount` is a dependency: the first measurement runs before the
         overflow button exists, so the available slot count must be measured
         again after that button changes the row's real width. */
      }, [actionSlotWidth, actionsKey, visibleCount]);

      const visibleActions = selectCompactActions(actions, visibleCount);
      const hidden = actions.filter((action) => visibleActions.includes(action) === false);
      const openOverflowMenu = (rect) => {
        setMenuPosition({
          x: Math.max(4, rect.right - 200),
          y: rect.bottom + 4,
        });
      };
      const overflowMenu = menuPosition === null
        ? null
        : {
            ...menuPosition,
            items: groupCompactActions(hidden).map((action) => action === null
            ? null
            : {
                id: action.id,
                label: action.label,
                shortcut: action.active === true ? '✓' : '',
                disabled: action.disabled === true,
                active: typeof action.active === 'boolean' ? action.active : undefined,
                run: () => action.onClick(),
                ariaKeyShortcuts: action.ariaKeyShortcuts,
              }),
          };
      return React.createElement(
        'div',
        { ref, style: { ...styles.commitActionBar, ...(style ?? {}) }, role: 'toolbar', 'aria-label': ariaLabel },
        visibleActions.map((action) =>
          React.createElement(ToolbarButton, {
            key: action.id,
            icon: action.icon,
            label: action.label,
            disabled: action.disabled === true,
            active: toolbarActionActive(action),
            onClick: action.onClick,
            ariaKeyShortcuts: action.ariaKeyShortcuts,
            ariaHasPopup: action.ariaHasPopup,
            ariaExpanded: action.ariaExpanded,
          }),
        ),
        hidden.length === 0
          ? null
          : React.createElement(ToolbarButton, {
              icon: 'more',
              label: t('editor.moreActions'),
              onClick: (event) => {
                openOverflowMenu(event.currentTarget.getBoundingClientRect());
              },
              onKeyDown: (event) => {
                if (event.key === 'ContextMenu' || (event.shiftKey === true && event.key === 'F10')) {
                  event.preventDefault();
                  event.stopPropagation();
                  openOverflowMenu(event.currentTarget.getBoundingClientRect());
                }
              },
              onContextMenu: (event) => {
                event.preventDefault();
                event.stopPropagation();
                openOverflowMenu(event.currentTarget.getBoundingClientRect());
              },
              ariaHasPopup: 'menu',
              ariaExpanded: menuPosition !== null,
            }),
        overflowMenu === null
          ? null
          : React.createElement(ContextMenu, { menu: overflowMenu, onClose: () => setMenuPosition(null), t }),
      );
    }

    /** Project tool window: toolbar, IDEA-style tree, inline create row. */
