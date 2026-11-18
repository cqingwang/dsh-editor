import React from 'react';
import { styles } from '../../ui/styles';

type Translate = (key: string, params?: Record<string, unknown>) => string;

export interface EditorErrorBoundaryProps {
  t: Translate;
  workspaceId: string;
  children: React.ReactElement;
}

interface EditorErrorBoundaryState {
  error: unknown;
  generation: number;
}

/**
 * Keep a render-time exception inside the Editor split.
 *
 * Before this boundary existed, a ReferenceError anywhere below EditorWorkspace
 * unmounted the whole injected root and left the 65% editor column as an empty
 * host while the host-owned Chat column kept rendering. The boundary provides a
 * visible recovery path and never wraps Chat.
 */
class EditorErrorBoundaryView extends React.Component<EditorErrorBoundaryProps, EditorErrorBoundaryState> {
  constructor(props: EditorErrorBoundaryProps) {
    super(props);
    this.state = { error: null, generation: 0 };
    this.reload = this.reload.bind(this);
  }

  static getDerivedStateFromError(error: unknown): Partial<EditorErrorBoundaryState> {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('dsh-editor: workspace render failed', error, info?.componentStack ?? '');
    reportEditorDiagnostic(
      'react-render-error',
      {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? (error.stack ?? '') : '',
        componentStack: info?.componentStack ?? '',
      },
      'error',
    );
  }

  componentDidUpdate(previousProps: EditorErrorBoundaryProps) {
    if (previousProps.workspaceId !== this.props.workspaceId && this.state.error !== null) {
      this.reload();
    }
  }

  reload() {
    this.setState((current) => ({ error: null, generation: current.generation + 1 }));
  }

  render() {
    if (this.state.error !== null) {
      const message = this.state.error instanceof Error ? this.state.error.message : String(this.state.error);
      return (
        <div
          style={styles.editorLoadFailure}
          role='alert'>
          <div style={styles.editorLoadFailureTitle}>{this.props.t('editor.loadFailed')}</div>
          <div style={styles.editorLoadFailureHint}>{this.props.t('editor.loadFailedHint')}</div>
          {message === '' ? null : (
            <div
              style={styles.editorLoadFailureError}
              title={message}>
              {message}
            </div>
          )}
          <button
            type='button'
            style={styles.editorLoadFailureButton}
            onClick={this.reload}>
            {this.props.t('editor.reloadEditor')}
          </button>
        </div>
      );
    }
    return React.cloneElement(this.props.children, { key: this.state.generation });
  }
}

const EditorErrorBoundary = EditorErrorBoundaryView;

export { EditorErrorBoundary };
