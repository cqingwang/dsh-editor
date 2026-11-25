import React from 'react';
import { readStoredText, writeStoredText } from '../../terminal';

export interface CommitSelectionPreferenceOptions {
  root: string;
  changes: Array<{ path: string }>;
  setCommitSelection: React.Dispatch<React.SetStateAction<Set<string>>>;
}

export interface CommitSelectionPreferenceState {
  selectAllByDefault: boolean;
  selectAllByDefaultRef: React.MutableRefObject<boolean>;
  toggleSelectAllByDefault: () => void;
}

/**
 * Persist IDEA's "select all changes by default" behavior per workspace.
 *
 * The default is off so a fresh workspace starts with no commit selection,
 * matching IDEA. Turning the preference on immediately selects the current
 * changes; turning it off clears the selection.
 */
export function useCommitSelectionPreference({
  root,
  changes,
  setCommitSelection,
}: CommitSelectionPreferenceOptions): CommitSelectionPreferenceState {
  const [selectAllByDefault, setSelectAllByDefault] = React.useState(false);
  const selectAllByDefaultRef = React.useRef(false);

  React.useEffect(() => {
    if (root === '') return;
    const next = readStoredText(`dsh-editor.commit.selectAllByDefault:${root}`, '0') === '1';
    selectAllByDefaultRef.current = next;
    setSelectAllByDefault(next);
  }, [root]);

  const toggleSelectAllByDefault = React.useCallback((): void => {
    const next = !selectAllByDefaultRef.current;
    selectAllByDefaultRef.current = next;
    setSelectAllByDefault(next);
    if (root !== '') {
      writeStoredText(`dsh-editor.commit.selectAllByDefault:${root}`, next ? '1' : '0');
    }
    setCommitSelection(next ? new Set(changes.map((change) => change.path)) : new Set());
  }, [changes, root, setCommitSelection]);

  return { selectAllByDefault, selectAllByDefaultRef, toggleSelectAllByDefault };
}
