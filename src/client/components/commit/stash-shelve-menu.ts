type ShelveMenuTranslate = (key: string, params?: Record<string, unknown>) => string;

interface ShelfMenuPosition {
  x: number;
  y: number;
}

export interface ShelfEntry {
  ref: string;
  subject: string;
}

interface ShelfMenuItem {
  id: string;
  label: string;
  disabled?: boolean;
  danger?: boolean;
  run: () => void;
}

interface ShelfMenu {
  x: number;
  y: number;
  items: Array<ShelfMenuItem | null>;
}

interface StashMenuOptions {
  t: ShelveMenuTranslate;
  position: ShelfMenuPosition;
  entries: ShelfEntry[];
  hasChanges: boolean;
  onRunStash: (operation: 'save' | 'pop' | 'apply' | 'drop', ref?: string) => void;
}

interface ShelveMenuOptions {
  t: ShelveMenuTranslate;
  position: ShelfMenuPosition;
  entries: ShelfEntry[];
  selectedPaths: string[];
  onRunShelve: (operation: 'save' | 'apply' | 'drop', ref?: string, paths?: string[]) => void;
}

export function stashMenu({ t, position, entries, hasChanges, onRunStash }: StashMenuOptions): ShelfMenu {
  const newest = entries[0];
  return {
    x: position.x,
    y: position.y,
    items: [
      {
        id: 'save',
        label: t('editor.stashSave'),
        disabled: !hasChanges,
        run: () => onRunStash('save'),
      },
      {
        id: 'pop',
        label: newest === undefined ? t('editor.stashEmpty') : t('editor.stashPop', { subject: newest.subject }),
        disabled: newest === undefined,
        run: () => onRunStash('pop'),
      },
      ...(entries.length === 0
        ? []
        : [
            null,
            ...entries.flatMap((entry) => [
              {
                id: `apply:${entry.ref}`,
                label: t('editor.stashApply', {
                  ref: entry.ref,
                  subject: entry.subject,
                }),
                run: () => onRunStash('apply', entry.ref),
              },
              {
                id: `drop:${entry.ref}`,
                label: t('editor.stashDrop', { ref: entry.ref }),
                danger: true,
                run: () => onRunStash('drop', entry.ref),
              },
            ]),
          ]),
    ],
  };
}

export function shelveMenu({ t, position, entries, selectedPaths, onRunShelve }: ShelveMenuOptions): ShelfMenu {
  return {
    x: position.x,
    y: position.y,
    items: [
      {
        id: 'shelveSave',
        label: t('editor.shelveSave'),
        disabled: selectedPaths.length === 0,
        run: () => onRunShelve('save', undefined, selectedPaths),
      },
      ...(entries.length === 0
        ? [
            {
              id: 'empty',
              label: t('editor.shelveEmpty'),
              disabled: true,
              run: () => {},
            },
          ]
        : [
            null,
            ...entries.flatMap((entry) => [
              {
                id: `shelveApply:${entry.ref}`,
                label: t('editor.stashApply', {
                  ref: entry.ref,
                  subject: entry.subject,
                }),
                run: () => onRunShelve('apply', entry.ref),
              },
              {
                id: `shelveDrop:${entry.ref}`,
                label: t('editor.stashDrop', { ref: entry.ref }),
                danger: true,
                run: () => onRunShelve('drop', entry.ref),
              },
            ]),
          ]),
    ],
  };
}
