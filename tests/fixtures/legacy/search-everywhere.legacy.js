/* search-everywhere.js: dsh-editor client module. Generated into lib/client.js by scripts/build-client.mjs. */

    function ShowUsagesPopup({
      t,
      state,
      onFilterChange,
      onMove,
      onOpen,
      onPin,
      onOpenInRightSplit,
      onRevealResult,
      onNotify,
      onClose,
    }) {
      const inputRef = React.useRef(null);
      const listRef = React.useRef(null);
      const [resultMenu, setResultMenu] = React.useState(null);
      const LISTBOX_ID = 'dsh-editor-show-usages-listbox';
      const matches = filterUsageMatches(state.matches, state.filter);
      const activeIndex = normalizeUsageMatchIndex(matches, state.index);
      const active = matches[activeIndex] ?? null;
      const status = state.loading === true
        ? t('editor.loading')
        : state.error !== null
          ? state.error
          : matches.length === 0
            ? t('editor.showUsagesEmpty')
            : t('editor.searchResultCount', { count: matches.length });
      React.useEffect(() => {
        inputRef.current?.focus?.();
      }, []);
      React.useEffect(() => {
        listRef.current
          ?.querySelector?.('[data-show-usages-active="1"]')
          ?.scrollIntoView?.({ block: 'nearest' });
      }, [activeIndex, state.filter, state.matches]);
      const move = (direction) => {
        if (matches.length === 0) return;
        onMove((activeIndex + direction + matches.length) % matches.length);
      };
      const openUsageMenuAt = (x, y, match) => {
        if (match === null || match === undefined) return;
        setResultMenu({
          x,
          y,
          title: basename(match.path),
          items: searchResultContextItems({
            t,
            result: { ...match, kind: 'text' },
            onCloseMenu: () => setResultMenu(null),
            onOpenEditor: () => onOpen(match),
            onOpenInRightSplit: () => {
              onClose();
              onOpenInRightSplit(match.path, {
                path: match.path,
                line: match.line,
                column: match.column,
              });
            },
            onRevealResult: () => {
              onClose();
              onRevealResult(match.path);
            },
            onNotify,
          }),
        });
      };
      const openUsageMenu = (event, match) => {
        event.preventDefault();
        event.stopPropagation();
        event.currentTarget?.focus?.();
        onMove(matches.indexOf(match));
        openUsageMenuAt(event.clientX, event.clientY, match);
      };
      const openActiveUsageMenu = () => {
        if (active === null) return;
        const rect = listRef.current
          ?.querySelector?.('[data-show-usages-active="1"]')
          ?.getBoundingClientRect?.();
        openUsageMenuAt(rect?.left ?? 20, rect?.bottom ?? 20, active);
      };
      const handleUsageKeyDown = (event) => {
        if (event.key === 'ContextMenu' || (event.shiftKey === true && event.key === 'F10')) {
          event.preventDefault();
          event.stopPropagation();
          openActiveUsageMenu();
          return;
        }
        if (event.key === 'ArrowDown') {
          event.preventDefault();
          move(1);
        } else if (event.key === 'ArrowUp') {
          event.preventDefault();
          move(-1);
        } else if (event.key === 'Enter') {
          event.preventDefault();
          if (active !== null) onOpen(active);
        } else if (event.key === 'Escape') {
          event.preventDefault();
          onClose();
        }
      };
      return React.createElement(
        'div',
        {
          style: { ...styles.paletteBackdrop, paddingTop: '8vh' },
          onMouseDown: onClose,
          'data-dsh-show-usages': '',
        },
        React.createElement(
          'div',
          {
            style: { ...styles.palette, ...styles.searchEverywhere },
            role: 'dialog',
            'aria-modal': 'true',
            'aria-label': t('editor.showUsagesTitle', { query: state.query }),
            onMouseDown: (event) => event.stopPropagation(),
          },
          React.createElement(
            'div',
            { style: styles.searchEverywhereSearchRow },
            React.createElement(Icon, { name: 'search', size: 13 }),
            React.createElement('input', {
              ref: inputRef,
              style: styles.searchEverywhereInput,
              value: state.filter,
              placeholder: t('editor.showUsagesFilterPlaceholder'),
              'aria-label': t('editor.showUsagesFilterPlaceholder'),
              role: 'combobox',
              'aria-autocomplete': 'list',
              'aria-controls': LISTBOX_ID,
              'aria-activedescendant': active === null ? undefined : searchEverywhereOptionId(usageMatchRowKey(active)),
              onChange: (event) => onFilterChange(event.target.value),
              onKeyDown: handleUsageKeyDown,
            }),
            React.createElement(ToolbarButton, {
              icon: 'findWindow',
              label: t('editor.openInFindToolWindow'),
              disabled: state.loading === true || state.matches.length === 0,
              onClick: onPin,
            }),
          ),
          React.createElement(
            'div',
            {
              role: 'status',
              'aria-live': 'polite',
              'aria-atomic': 'true',
              style: styles.screenReaderOnly,
            },
            status,
          ),
          state.loading === true
            ? React.createElement('div', { style: styles.findToolMessage }, t('editor.loading'))
            : state.error !== null
              ? React.createElement('div', { style: styles.searchEverywhereError, role: 'alert' }, state.error)
              : matches.length === 0
                ? React.createElement('div', { style: styles.findToolMessage }, t('editor.showUsagesEmpty'))
                : null,
          React.createElement(
            'div',
            {
              ref: listRef,
              id: LISTBOX_ID,
              role: 'listbox',
              'aria-label': t('editor.showUsagesTitle', { query: state.query }),
              'aria-activedescendant': active === null ? undefined : searchEverywhereOptionId(usageMatchRowKey(active)),
              style: styles.searchEverywhereList,
              tabIndex: 0,
              onKeyDown: handleUsageKeyDown,
            },
            matches.map((match, position) => React.createElement(
              'div',
              {
                key: usageMatchRowKey(match),
                id: searchEverywhereOptionId(usageMatchRowKey(match)),
                role: 'option',
                'aria-selected': position === activeIndex,
                'data-dsh-show-usages-option': '',
                'data-show-usages-active': position === activeIndex ? '1' : '0',
                style: {
                  ...styles.searchEverywhereRow,
                  background: position === activeIndex ? 'var(--dsw-alias-state-business-primary)' : 'transparent',
                  cursor: 'pointer',
                },
                tabIndex: position === activeIndex ? 0 : -1,
                onMouseEnter: () => onMove(position),
                onContextMenu: (event) => openUsageMenu(event, match),
                onClick: () => onOpen(match),
              },
              React.createElement(Icon, { name: 'file', size: 12 }),
              React.createElement(
                'span',
                {
                  style: {
                    flexShrink: 0,
                    maxWidth: '45%',
                    overflow: 'hidden',
                    color: 'var(--dsw-alias-label-primary)',
                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                    fontSize: 11,
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  },
                },
                `${match.path}:${match.line}:${match.column}`,
              ),
              React.createElement(
                'span',
                {
                  style: {
                    minWidth: 0,
                    overflow: 'hidden',
                    color: 'var(--dsw-alias-label-secondary)',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  },
                },
                match.preview ?? '',
              ),
            )),
          ),
          resultMenu === null
            ? null
            : React.createElement(ContextMenu, {
                t,
                menu: resultMenu,
                onClose: () => setResultMenu(null),
              }),
        ),
      );
    }

    /**
     * IDEA's persistent Find tool window.
     *
     * Search Everywhere is a transient chooser. Once the user asks to keep the
     * result set, IDEA moves it into a tool window where occurrences can be
     * walked and opened without reopening the modal. This component follows the
     * same model using the host's existing bounded text-search results.
     * @param {object} props - query state, results and callbacks.
     * @returns {object} persistent bottom tool window.
     */
