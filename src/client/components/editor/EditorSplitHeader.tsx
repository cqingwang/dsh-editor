import React from 'react';
import { styles } from '../../ui/styles';
import { Icon } from '../ui/Icon';

type Translate = (key: string, params?: Record<string, unknown>) => string;

export interface EditorSplitHeaderProps {
  t: Translate;
  tabStripRef: React.RefObject<HTMLDivElement | null>;
  hiddenCount: number;
  onOverflow: (event: React.MouseEvent<HTMLButtonElement>) => void;
  onCloseSplit: () => void;
  children: React.ReactNode;
}

function EditorSplitHeader({
  t,
  tabStripRef,
  hiddenCount,
  onOverflow,
  onCloseSplit,
  children,
}: EditorSplitHeaderProps) {
  return (
    <div style={styles.editorSplitHeader}>
      <Icon
        name='split'
        size={11}
      />
      <div
        ref={tabStripRef}
        style={{
          ...styles.editorSplitTabs,
          position: 'relative',
          boxSizing: 'border-box',
          paddingRight: hiddenCount === 0 ? 0 : 28,
        }}
        data-dsh-editor-split-tabs=''
        data-dsh-editor-split-hidden-tabs={String(hiddenCount)}>
        {children}
        {hiddenCount === 0 ? null : (
          <button
            type='button'
            style={{
              ...styles.tabOverflow,
              position: 'absolute',
              top: 0,
              right: 0,
              zIndex: 2,
              height: '100%',
              margin: 0,
              background: 'var(--dsw-alias-bg-layer-1)',
            }}
            title={t('editor.tabsOverflow', { count: hiddenCount })}
            aria-label={t('editor.tabsOverflow', { count: hiddenCount })}
            onClick={onOverflow}>
            »
          </button>
        )}
      </div>
      <button
        type='button'
        style={styles.tabClose}
        aria-label={t('editor.closeSplit')}
        title={t('editor.closeSplit')}
        onClick={onCloseSplit}>
        ▣
      </button>
    </div>
  );
}

export { EditorSplitHeader };
