import React from 'react';
import { styles } from '../../ui/styles';
import { Icon } from './Icon';
interface StripeItemProps {
  id: string;
  label: string;
  icon: string;
  active: boolean;
  onClick: (id: string) => void;
  title?: string;
}
function StripeItem({ id, label, icon, active, onClick, title = label }: StripeItemProps) {
  return (
    <button
      type='button'
      className='dsh-editor-stripe-item'
      style={{
        ...styles.stripeItem,
        ...(active ? styles.stripeItemActive : null),
      }}
      title={title}
      aria-label={label}
      aria-pressed={active}
      onClick={() => onClick(id)}>
      <Icon
        name={icon}
        size={16}
      />
      <span style={styles.stripeText}>{label}</span>
    </button>
  );
}
export interface ActivityStripeProps {
  activity: 'project' | 'commit';
  panelVisible: boolean;
  terminalOpen: boolean;
  harnessCollapsed: boolean;
  onSelect: (id: string) => void;
  onToggleHarness: () => void;
  onCloseEditor: () => void;
  t: (key: string) => string;
}
function ActivityStripe({
  activity,
  panelVisible,
  terminalOpen,
  harnessCollapsed,
  onSelect,
  onToggleHarness,
  onCloseEditor,
  t,
}: ActivityStripeProps) {
  return (
    <div
      style={styles.stripe}
      role='toolbar'
      aria-label={t('editor.toolWindows')}
      aria-orientation='vertical'
      data-dsh-editor-activity-stripe=''>
      <StripeItem
        id='project'
        label={t('editor.project')}
        icon='project'
        active={activity === 'project' && panelVisible}
        onClick={onSelect}
      />
      <StripeItem
        id='commit'
        label={t('editor.commit')}
        icon='commit'
        active={activity === 'commit' && panelVisible}
        onClick={onSelect}
      />
      <StripeItem
        id='terminal'
        label={t('editor.terminal')}
        icon='terminal'
        active={terminalOpen}
        onClick={onSelect}
      />
      <StripeItem
        id='harness'
        label={t('editor.harness')}
        title={t(harnessCollapsed ? 'editor.showHarness' : 'editor.hideHarness')}
        icon='harness'
        active={harnessCollapsed !== true}
        onClick={onToggleHarness}
      />
      {harnessCollapsed ? (
        <button
          type='button'
          className='dsh-editor-stripe-item dsh-editor-stripe-close'
          style={{
            ...styles.stripeItem,
            ...styles.stripeUtilityItem,
          }}
          title={t('editor.closeEditor')}
          aria-label={t('editor.closeEditor')}
          onClick={onCloseEditor}>
          <Icon
            name='close'
            size={16}
          />
        </button>
      ) : null}
    </div>
  );
}
export { ActivityStripe };
