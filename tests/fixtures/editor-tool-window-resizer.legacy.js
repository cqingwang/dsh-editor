/* editor-workspace.js tool-window resizer legacy oracle. */

          panelVisible
            ? React.createElement('div', {
                style: styles.sideResize,
                title: t('editor.resizeToolWindow'),
                onMouseDown: (event) => {
                  event.preventDefault();
                  const body = event.currentTarget.parentElement;
                  if (body === null) return;
                  const total = body.getBoundingClientRect().width - 42;
                  const startX = event.clientX;
                  const startWidth = toolWidths[activity] ?? 25;
                  setSideDragging(true);
                  const onMove = (moveEvent) => {
                    const delta = ((moveEvent.clientX - startX) / Math.max(1, total)) * 100;
                    const next = Math.max(14, Math.min(72, startWidth + delta));
                    setToolWidths((current) => ({ ...current, [activity]: next }));
                  };
                  const onUp = () => {
                    setSideDragging(false);
                    const final = toolWidthsRef.current[activity] ?? startWidth;
                    writeToolWidth(rootRef.current, activity, final);
                    window.removeEventListener('mousemove', onMove);
                    window.removeEventListener('mouseup', onUp);
                  };
                  window.addEventListener('mousemove', onMove);
                  window.addEventListener('mouseup', onUp);
                },
              })
            : null,

/* EDITOR_TOOL_WINDOW_RESIZER_END */
