import React from 'react';
import { styles } from '../../ui/styles';
import { MarkdownModeSwitch } from './MarkdownModeSwitch';
import type { MarkdownMode } from './editor-document-model';

type Translate = (key: string, params?: Record<string, unknown>) => string;

export interface EditorTabStripProps {
  t: Translate;
  stripRef: React.RefObject<HTMLDivElement | null>;
  openCount: number;
  openList: string;
  hiddenCount: number;
  markdownAvailable: boolean;
  markdownMode: MarkdownMode;
  onMarkdownMode: (mode: MarkdownMode) => void;
  onOverflow: (event: React.MouseEvent<HTMLButtonElement>) => void;
  children: React.ReactNode;
}

function EditorTabStrip({
  t,
  stripRef,
  openCount,
  openList,
  hiddenCount,
  markdownAvailable,
  markdownMode,
  onMarkdownMode,
  onOverflow,
  children,
}: EditorTabStripProps) {
  return (
    <div
      ref={stripRef}
      style={styles.tabStrip}
      data-dsh-open-tabs={String(openCount)}
      data-dsh-open-list={openList}
      data-dsh-hidden-tabs={String(hiddenCount)}
      data-dsh-editor-tabstrip=''>
      {children}
      <div
        style={styles.tabStripTrailing}
        data-dsh-editor-tabstrip-trailing=''>
        {markdownAvailable ? (
          <MarkdownModeSwitch
            mode={markdownMode}
            onMode={onMarkdownMode}
            t={t}
          />
        ) : null}
        {hiddenCount === 0 ? null : (
          <button
            type='button'
            className='dsh-editor-tab-overflow'
            style={styles.tabOverflow}
            title={t('editor.tabsOverflow', { count: hiddenCount })}
            aria-label={t('editor.tabsOverflow', { count: hiddenCount })}
            onClick={onOverflow}>
            »
          </button>
        )}
      </div>
    </div>
  );
}

export { EditorTabStrip };
