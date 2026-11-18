/* terminal.js EditorErrorBoundary legacy oracle. */

    class EditorErrorBoundary extends React.Component {
      constructor(props) {
        super(props);
        this.state = { error: null, generation: 0 };
        this.reload = this.reload.bind(this);
      }

      static getDerivedStateFromError(error) {
        return { error };
      }

      componentDidCatch(error, info) {
        console.error('dsh-editor: workspace render failed', error, info?.componentStack ?? '');
        reportEditorDiagnostic('react-render-error', {
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack ?? '' : '',
          componentStack: info?.componentStack ?? '',
        }, 'error');
      }

      componentDidUpdate(previousProps) {
        if (previousProps.workspaceId !== this.props.workspaceId && this.state.error !== null) {
          this.reload();
        }
      }

      reload() {
        this.setState((current) => ({ error: null, generation: current.generation + 1 }));
      }

      render() {
        if (this.state.error !== null) {
          const message = this.state.error instanceof Error
            ? this.state.error.message
            : String(this.state.error);
          return React.createElement(
            'div',
            { style: styles.editorLoadFailure, role: 'alert' },
            React.createElement('div', { style: styles.editorLoadFailureTitle }, this.props.t('editor.loadFailed')),
            React.createElement('div', { style: styles.editorLoadFailureHint }, this.props.t('editor.loadFailedHint')),
            message === ''
              ? null
              : React.createElement('div', { style: styles.editorLoadFailureError, title: message }, message),
            React.createElement(
              'button',
              {
                type: 'button',
                style: styles.editorLoadFailureButton,
                onClick: this.reload,
              },
              this.props.t('editor.reloadEditor'),
            ),
          );
        }
        return React.cloneElement(this.props.children, { key: this.state.generation });
      }
    }

/* EDITOR_ERROR_BOUNDARY_END */
