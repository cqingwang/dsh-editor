/* editor-workspace.js editor conflict bars legacy oracle. */

              activePath !== null && externalChanges[activePath] !== undefined && conflict === null
                ? React.createElement(
                    'div',
                    { style: styles.conflictBar },
                    React.createElement(
                      'span',
                      { style: { minWidth: 0, flex: '1 1 auto' } },
                      /* A deleted file cannot be "reloaded": say what happened, offer recreation. */
                      externalChanges[activePath].missing === true ? t('editor.externalDeleted') : t('editor.externalChanged'),
                    ),
                    externalChanges[activePath].missing === true
                      ? React.createElement(
                          'button',
                          { type: 'button', style: styles.conflictAction, onClick: () => void recreateActive() },
                          t('editor.recreateFile'),
                        )
                      : React.createElement(
                          'button',
                          { type: 'button', style: styles.conflictAction, onClick: () => void reloadActiveFromDisk() },
                          t('editor.reload'),
                        ),
                    React.createElement(
                      'button',
                      { type: 'button', style: styles.conflictAction, onClick: () => dismissExternal(activePath) },
                      t('editor.keepLocal'),
                    ),
                  )
                : null,
              conflict === null
                ? null
                : React.createElement(
                    'div',
                    { style: styles.conflictBar },
                    React.createElement('span', { style: { minWidth: 0, flex: '1 1 auto' } }, t('editor.saveConflict', { path: conflict.path })),
                    React.createElement(
                      'button',
                      { type: 'button', style: styles.conflictAction, onClick: () => void saveActive(true) },
                      t('editor.overwrite'),
                    ),
                    React.createElement(
                      'button',
                      { type: 'button', style: styles.conflictAction, onClick: () => reloadActiveFromDisk() },
                      t('editor.reloadFromDisk'),
                    ),
                    React.createElement(
                      'button',
                      { type: 'button', style: styles.conflictAction, onClick: () => setConflict(null) },
                      t('editor.dismiss'),
                    ),
                  ),

/* EDITOR_CONFLICT_BARS_END */
