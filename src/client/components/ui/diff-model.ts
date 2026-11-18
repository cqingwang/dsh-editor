export interface DiffSideLabels {
  left: string;
  right: string;
}

export interface DiffTargetEntry {
  path?: string;
  staged?: boolean;
}

export interface DiffTarget {
  path?: string;
  staged?: boolean;
  combined?: boolean;
  entries?: DiffTargetEntry[];
  commit?: string;
  revision?: string;
  clipboardText?: string;
  label?: string;
}

export interface DiffLineChange {
  originalStartLineNumber?: number;
  originalEndLineNumber?: number;
  modifiedStartLineNumber?: number;
  modifiedEndLineNumber?: number;
}

/** IDEA's two diff column captions. */
export function diffSideLabels(staged: boolean): DiffSideLabels {
  return staged ? { left: 'HEAD', right: 'Index' } : { left: 'HEAD', right: 'Working tree' };
}

/** Stable identity for one diff comparison and visual orientation. */
export function diffViewStateKey(target?: DiffTarget | null, swapped = false): string {
  const path = typeof target?.path === 'string' ? target.path : '';
  if (path === '') return '';
  let comparison: string;
  if (target?.combined === true) {
    const entries = Array.isArray(target.entries) ? target.entries : [];
    comparison = `combined:${entries
      .map((entry) => `${entry?.path ?? ''}:${entry?.staged === true ? 'staged' : 'working'}`)
      .join('|')}`;
  } else if (typeof target?.commit === 'string') {
    comparison = `commit:${target.commit}`;
  } else if (typeof target?.revision === 'string') {
    comparison = `revision:${target.revision}`;
  } else if (typeof target?.clipboardText === 'string') {
    comparison = `clipboard:${target.label ?? ''}`;
  } else {
    comparison = target?.staged === true ? 'staged' : 'working';
  }
  return `${comparison}:${path}:${swapped === true ? 'swapped' : 'original'}`;
}

/** Transfer a line across Monaco's two diff sides. */
export function transferDiffLine(line: number, side: string, changes?: DiffLineChange[] | null): number {
  const sourceLine = Math.max(1, Math.floor(Number(line)) || 1);
  if (side !== 'original' && side !== 'modified') return sourceLine;
  const list = (Array.isArray(changes) ? changes : [])
    .map((change) =>
      side === 'original'
        ? {
            sourceStart: Math.max(1, Math.floor(Number(change?.originalStartLineNumber)) || 1),
            sourceEnd: Math.max(0, Math.floor(Number(change?.originalEndLineNumber)) || 0),
            targetStart: Math.max(1, Math.floor(Number(change?.modifiedStartLineNumber)) || 1),
            targetEnd: Math.max(0, Math.floor(Number(change?.modifiedEndLineNumber)) || 0),
          }
        : {
            sourceStart: Math.max(1, Math.floor(Number(change?.modifiedStartLineNumber)) || 1),
            sourceEnd: Math.max(0, Math.floor(Number(change?.modifiedEndLineNumber)) || 0),
            targetStart: Math.max(1, Math.floor(Number(change?.originalStartLineNumber)) || 1),
            targetEnd: Math.max(0, Math.floor(Number(change?.originalEndLineNumber)) || 0),
          },
    )
    .sort((left, right) => left.sourceStart - right.sourceStart);
  let delta = 0;
  for (const change of list) {
    if (sourceLine < change.sourceStart) break;
    const sourceSpan = change.sourceEnd >= change.sourceStart ? change.sourceEnd - change.sourceStart + 1 : 0;
    const targetSpan = change.targetEnd >= change.targetStart ? change.targetEnd - change.targetStart + 1 : 0;
    if (sourceSpan > 0 && sourceLine <= change.sourceEnd) {
      if (targetSpan === 0) return change.targetStart;
      if (sourceSpan === 1 || targetSpan === 1) return change.targetStart;
      const progress = (sourceLine - change.sourceStart) / (sourceSpan - 1);
      return change.targetStart + Math.max(0, Math.min(targetSpan - 1, Math.round(progress * (targetSpan - 1))));
    }
    delta += targetSpan - sourceSpan;
  }
  return Math.max(1, sourceLine + delta);
}
