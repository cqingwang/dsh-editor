interface CommitSelectionModifiers {
  meta?: boolean;
  shift?: boolean;
}

interface CommitSelectionResult {
  selected: string[];
  anchor: string;
}

interface CommitContextSelection {
  selectionHashes: string[];
  selectClicked: boolean;
  anchor: string;
}

export function commitSelectionAfterClick(
  order: string[],
  selected: string[],
  hash: string,
  modifiers?: CommitSelectionModifiers,
  anchorHash = '',
): CommitSelectionResult {
  const hashes = [
    ...new Set((Array.isArray(order) ? order : []).filter((value) => typeof value === 'string' && value !== '')),
  ];
  const flags = modifiers ?? {};
  if (!hashes.includes(hash)) {
    const valid = [...new Set((Array.isArray(selected) ? selected : []).filter((value) => hashes.includes(value)))];
    return {
      selected: valid,
      anchor: hashes.includes(anchorHash) ? anchorHash : (valid[0] ?? ''),
    };
  }
  const current = [...new Set((Array.isArray(selected) ? selected : []).filter((value) => hashes.includes(value)))];
  if (flags.shift === true) {
    const anchor = hashes.includes(anchorHash) ? anchorHash : hash;
    const from = hashes.indexOf(anchor);
    const to = hashes.indexOf(hash);
    const range = hashes.slice(Math.min(from, to), Math.max(from, to) + 1);
    return {
      selected: range.length === 0 ? [hash] : range,
      anchor,
    };
  }
  if (flags.meta === true) {
    const next = current.includes(hash) ? current.filter((value) => value !== hash) : [...current, hash];
    return {
      selected: next.length === 0 ? [hash] : next,
      anchor: hash,
    };
  }
  return {
    selected: [hash],
    anchor: hash,
  };
}

export function commitLogContextSelection(selected: string[], hash: string): CommitContextSelection {
  const values = Array.isArray(selected) ? selected : [];
  if (values.includes(hash)) {
    return {
      selectionHashes: values,
      selectClicked: false,
      anchor: hash,
    };
  }
  return {
    selectionHashes: [hash],
    selectClicked: true,
    anchor: hash,
  };
}
