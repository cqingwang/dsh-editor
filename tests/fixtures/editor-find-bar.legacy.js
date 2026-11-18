/* editor-workspace.js editor Find/Replace bar legacy oracle. */

              replaceState === null
                ? null
                : React.createElement(
                    'div',
                    { style: styles.findBar },
                    React.createElement('input', {
                      'data-dsh-editor-find-input': '',
                      style: styles.findInput,
                      autoFocus: true,
                      placeholder: t('editor.find'),
                      value: replaceState.find,
                      onChange: (event) => updateFind({ find: event.target.value }),
                      onKeyDown: (event) => {
                        if (event.altKey === true && event.key === 'ArrowDown') {
                          openEditorFindHistory(event, 'query');
                        } else if (event.key === 'Enter') {
                          event.preventDefault();
                          jumpToMatch(event.shiftKey ? -1 : 1);
                        } else if (event.key === 'Escape') {
                          event.preventDefault();
                          closeFind();
                        }
                      },
                    }),
                    React.createElement(ToolbarButton, {
                      icon: 'history',
                      label: t('editor.findSearchHistory'),
                      ariaHasPopup: 'menu',
                      ariaExpanded: editorFindHistoryMenu?.kind === 'query',
                      onClick: (event) => openEditorFindHistory(event, 'query'),
                    }),
                    React.createElement(
                      'span',
                      { style: styles.findCount },
                      replaceState.total === 0 ? t('editor.noMatches') : `${replaceState.index + 1}/${replaceState.total}`,
                    ),
                    React.createElement(ToolbarButton, {
                      icon: 'matchCase',
                      label: t('editor.searchMatchCase'),
                      active: replaceState.caseSensitive === true,
                      onClick: () => toggleFindOption('caseSensitive'),
                    }),
                    React.createElement(ToolbarButton, {
                      icon: 'wholeWords',
                      label: t('editor.searchWholeWords'),
                      active: replaceState.wholeWords === true,
                      disabled: replaceState.regex === true,
                      onClick: () => toggleFindOption('wholeWords'),
                    }),
                    React.createElement(ToolbarButton, {
                      icon: 'regex',
                      label: t('editor.searchRegex'),
                      active: replaceState.regex === true,
                      onClick: () => toggleFindOption('regex'),
                    }),
                    replaceState.withReplace === true
                      ? React.createElement(ToolbarButton, {
                          icon: 'preserveCase',
                          label: t('editor.searchPreserveCase'),
                          active: replaceState.preserveCase === true,
                          onClick: () => toggleFindOption('preserveCase'),
                        })
                      : null,
                    React.createElement(ToolbarButton, {
                      icon: 'target',
                      label: t('editor.searchInSelectionOnly'),
                      active: replaceState.scope !== null,
                      onClick: () => toggleFindSelectionScope(),
                    }),
                    replaceState.error === null
                      ? null
                      : React.createElement(
                          'span',
                          {
                            style: { ...styles.findCount, color: 'var(--dsw-alias-state-error-primary)' },
                            role: 'alert',
                            title: replaceState.error,
                          },
                          replaceState.error,
                        ),
                    React.createElement(ToolbarButton, { icon: 'chevronDown', label: t('editor.findNext'), onClick: () => jumpToMatch(1) }),
                    React.createElement(ToolbarButton, { icon: 'chevronRight', label: t('editor.findPrevious'), onClick: () => jumpToMatch(-1) }),
                    replaceState.withReplace === true
                      ? React.createElement(ToolbarButton, {
                          icon: 'check',
                          label: t('editor.replaceCurrent'),
                          disabled: replaceState.error !== null || replaceState.total === 0,
                          onClick: () => replaceCurrent(),
                        })
                      : null,
                    replaceState.withReplace === true
                      ? React.createElement('input', {
                          'data-dsh-editor-find-replace-input': '',
                          style: styles.findInput,
                          placeholder: t('editor.replace'),
                          value: replaceState.replace,
                          onChange: (event) => setReplaceState((current) => (current === null ? current : { ...current, replace: event.target.value })),
                          onKeyDown: (event) => {
                            if (event.isComposing === true) return;
                            if (event.altKey === true && event.key === 'ArrowDown') openEditorFindHistory(event, 'replace');
                            else if (event.key === 'Enter') {
                              event.preventDefault();
                              event.stopPropagation();
                              if (replaceState.error === null && replaceState.total > 0) replaceCurrent();
                            } else if (event.key === 'Escape') {
                              event.preventDefault();
                              closeFind();
                            }
                          },
                        })
                      : null,
                    replaceState.withReplace === true
                      ? React.createElement(ToolbarButton, {
                          icon: 'history',
                          label: t('editor.findReplaceHistory'),
                          ariaHasPopup: 'menu',
                          ariaExpanded: editorFindHistoryMenu?.kind === 'replace',
                          onClick: (event) => openEditorFindHistory(event, 'replace'),
                        })
                      : null,
                    replaceState.withReplace === true
                      ? React.createElement(
                          'button',
                          {
                            type: 'button',
                            style: {
                              ...styles.conflictAction,
                              opacity: replaceState.error === null && replaceState.total > 0 ? 1 : 0.45,
                            },
                            disabled: replaceState.error !== null || replaceState.total === 0,
                            onClick: () => replaceAll(),
                          },
                          t('editor.replaceAll'),
                        )
                      : null,
                    React.createElement(
                      'button',
                      { type: 'button', style: styles.conflictAction, onClick: () => closeFind() },
                      '×',
                    ),
                    editorFindHistoryMenu === null
                      ? null
                      : React.createElement(
                          'div',
                          { 'data-dsh-editor-find-history-menu': '' },
                          React.createElement(ContextMenu, {
                            t,
                            menu: {
                              x: editorFindHistoryMenu.x,
                              y: editorFindHistoryMenu.y,
                              title: editorFindHistoryMenu.kind === 'query'
                                ? t('editor.findSearchHistory')
                                : t('editor.findReplaceHistory'),
                              items: (() => {
                                const values = editorFindHistoryMenu.kind === 'query'
                                  ? readSearchHistory(rootRef.current)
                                  : readReplaceHistory(rootRef.current);
                                return values.length === 0
                                  ? [{ id: 'empty', label: t('editor.findHistoryEmpty'), disabled: true, run: () => {} }]
                                  : values.map((value, index) => ({
                                      id: `${editorFindHistoryMenu.kind}:${index}`,
                                      label: value,
                                      run: () => {
                                        if (editorFindHistoryMenu.kind === 'query') updateFind({ find: value });
                                        else setReplaceState((current) => (current === null ? current : { ...current, replace: value }));
                                        setEditorFindHistoryMenu(null);
                                        window.setTimeout(() => {
                                          const selector = editorFindHistoryMenu.kind === 'query'
                                            ? '[data-dsh-editor-find-input]'
                                            : '[data-dsh-editor-find-replace-input]';
                                          document.querySelector(selector)?.focus?.();
                                        }, 0);
                                      },
                                    }));
                              })(),
                            },
                            onClose: () => setEditorFindHistoryMenu(null),
                          }),
                        ),
                  ),

/* EDITOR_FIND_BAR_END */
