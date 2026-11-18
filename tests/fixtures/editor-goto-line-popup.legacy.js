/* editor-workspace.js goto-line popup legacy oracle. */

              gotoState === null
                ? null
                : React.createElement(
                    'div',
                    {
                      role: 'dialog',
                      'aria-label': t('editor.gotoLine'),
                      'aria-modal': false,
                      style: styles.gotoLinePopup,
                      'data-dsh-editor-goto-dialog': '',
                    },
                    React.createElement(
                      'div',
                      { style: styles.gotoLineRow },
                      React.createElement(
                        'span',
                        { style: { ...styles.findCount, minWidth: 60 } },
                        t('editor.gotoLine'),
                      ),
                      React.createElement('input', {
                        ref: gotoInputRef,
                        className: 'dsh-editor-goto-input',
                        'data-dsh-editor-goto-input': '',
                        style: styles.findInput,
                        autoFocus: true,
                        placeholder: t('editor.gotoLinePlaceholder'),
                        value: gotoState.value,
                        'aria-label': t('editor.gotoLine'),
                        'aria-invalid': gotoState.error !== null,
                        'aria-describedby': gotoState.error === null ? undefined : 'dsh-editor-goto-error',
                        onChange: (event) => setGotoState((current) => current === null
                          ? null
                          : { ...current, value: event.target.value, error: null }),
                        onKeyDown: (event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault();
                            commitGotoLine();
                          } else if (event.key === 'Escape') {
                            event.preventDefault();
                            closeGotoLine();
                          }
                        },
                      }),
                      React.createElement(
                        'button',
                        { type: 'button', style: styles.conflictAction, onClick: () => commitGotoLine() },
                        t('editor.gotoLine'),
                      ),
                      React.createElement(
                        'button',
                        {
                          type: 'button',
                          style: styles.conflictAction,
                          'aria-label': t('editor.closeGotoLine'),
                          onClick: () => closeGotoLine(),
                        },
                        '×',
                      ),
                    ),
                    gotoState.error === null
                      ? null
                      : React.createElement(
                          'div',
                          { id: 'dsh-editor-goto-error', role: 'alert', style: styles.gotoLineError },
                          gotoState.error,
                        ),
                  ),

/* EDITOR_GOTO_LINE_POPUP_END */
