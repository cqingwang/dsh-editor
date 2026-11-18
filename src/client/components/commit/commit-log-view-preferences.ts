interface CommitLogGraphToggle {
  enabled: boolean;
  loadGraph: boolean;
  focusList: boolean;
}

interface CommitLogGraphFoldToggle {
  folded: boolean;
  clearHover: boolean;
}

interface CommitLogFilterToggle {
  visible: boolean;
  focusInput: boolean;
  clearFilter: boolean;
}

export function commitLogGraphToggle(graphMode: boolean): CommitLogGraphToggle {
  const enabled = !graphMode;
  return {
    enabled,
    loadGraph: enabled,
    focusList: enabled,
  };
}

export function commitLogGraphFoldToggle(folded: boolean): CommitLogGraphFoldToggle {
  return {
    folded: !folded,
    clearHover: true,
  };
}

export function commitLogFilterToggle(filterVisible: boolean): CommitLogFilterToggle {
  const visible = !filterVisible;
  return {
    visible,
    focusInput: visible,
    clearFilter: !visible,
  };
}
