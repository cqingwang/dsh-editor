import { searchReplaceCountParams } from '../../locales';
import { styles } from '../../ui/styles';

type Translate = (key: string, params?: Record<string, unknown>) => string;

/**
 * Show IDEA's destructive Replace All confirmation with Cancel as the safe
 * initial action.
 *
 * Chromium's native confirm focuses the accepting action, while IDEA focuses
 * Cancel. This small host-level dialog keeps Enter on the initial focus safe,
 * exposes the exact query/replacement, and returns focus to the opener before
 * the Find surface reclaims the replacement field.
 * @param t - locale translator.
 * @param query - exact search text.
 * @param replacement - exact replacement text.
 * @param matches - occurrence count.
 * @param files - affected file count.
 * @returns whether the user explicitly confirmed the write.
 */
export function confirmSearchReplace(
  t: Translate,
  query: string,
  replacement: string,
  matches: number,
  files: number,
): Promise<boolean> {
  if (typeof document === 'undefined' || document.body === null) return Promise.resolve(false);
  return new Promise<boolean>((resolve) => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const backdrop = document.createElement('div');
    backdrop.dataset.dshSearchReplaceConfirm = '';
    Object.assign(backdrop.style, styles.paletteBackdrop);
    backdrop.style.alignItems = 'center';
    backdrop.style.paddingTop = '0';

    const dialog = document.createElement('div');
    dialog.setAttribute('role', 'alertdialog');
    dialog.setAttribute('aria-modal', 'true');
    const titleId = 'dsh-search-replace-confirm-title';
    const messageId = 'dsh-search-replace-confirm-message';
    dialog.setAttribute('aria-labelledby', titleId);
    dialog.setAttribute('aria-describedby', messageId);
    Object.assign(dialog.style, styles.namePrompt);
    dialog.style.width = 'min(520px, calc(100vw - 32px))';
    dialog.style.boxSizing = 'border-box';
    dialog.style.maxHeight = 'min(72vh, 640px)';
    dialog.style.overflow = 'hidden';

    const title = document.createElement('div');
    title.id = titleId;
    title.textContent = t('editor.searchReplaceAll');
    Object.assign(title.style, styles.namePromptTitle);
    title.style.flex = 'none';

    const message = document.createElement('div');
    message.tabIndex = 0;
    message.setAttribute('role', 'region');
    message.setAttribute('aria-label', t('editor.searchReplaceConfirmDetails'));
    message.dataset.dshSearchReplaceConfirmDetails = '';
    const messageText = document.createElement('div');
    messageText.id = messageId;
    messageText.textContent = t('editor.searchReplaceConfirm', {
      ...searchReplaceCountParams(t, matches, files),
      query,
      replacement,
    });
    Object.assign(message.style, styles.searchEverywhereMessage);
    message.style.flex = '1 1 auto';
    message.style.minHeight = '0';
    message.style.overflowY = 'auto';
    messageText.style.textAlign = 'left';
    messageText.style.whiteSpace = 'pre-wrap';
    messageText.style.overflowWrap = 'anywhere';
    message.append(messageText);

    const buttons = document.createElement('div');
    Object.assign(buttons.style, styles.namePromptButtons);
    buttons.style.flex = 'none';
    const cancelButton = document.createElement('button');
    cancelButton.type = 'button';
    cancelButton.dataset.dshSearchReplaceConfirmCancel = '';
    cancelButton.textContent = t('editor.cancel');
    Object.assign(cancelButton.style, styles.commitSecondary);
    cancelButton.style.minWidth = '84px';
    const replaceButton = document.createElement('button');
    replaceButton.type = 'button';
    replaceButton.dataset.dshSearchReplaceConfirmAccept = '';
    replaceButton.textContent = t('editor.searchReplaceConfirmAction');
    Object.assign(replaceButton.style, styles.commitPrimary);
    buttons.append(cancelButton, replaceButton);
    const tabStops = [cancelButton, replaceButton, message] as HTMLElement[];
    dialog.append(title, message, buttons);
    backdrop.append(dialog);

    let settled = false;
    const finish = (confirmed: boolean): void => {
      if (settled) return;
      settled = true;
      backdrop.removeEventListener('keydown', onKeyDown, true);
      backdrop.remove();
      if (previousFocus !== null && previousFocus.isConnected) previousFocus.focus({ preventScroll: true });
      resolve(confirmed);
    };
    const onKeyDown = (event: KeyboardEvent): void => {
      event.stopPropagation();
      if (event.key === 'Escape') {
        event.preventDefault();
        finish(false);
        return;
      }
      if (event.key === 'Enter' && event.target === cancelButton) {
        event.preventDefault();
        finish(false);
        return;
      }
      if (event.key !== 'Tab') return;
      const currentIndex = tabStops.indexOf(document.activeElement as HTMLElement);
      if (currentIndex < 0) return;
      event.preventDefault();
      const direction = event.shiftKey === true ? -1 : 1;
      tabStops[(currentIndex + direction + tabStops.length) % tabStops.length]?.focus();
    };
    backdrop.addEventListener('keydown', onKeyDown, true);
    backdrop.addEventListener('mousedown', (event) => {
      if (event.target === backdrop) finish(false);
    });
    cancelButton.addEventListener('click', () => finish(false));
    replaceButton.addEventListener('click', () => finish(true));
    document.body.append(backdrop);
    window.setTimeout(() => cancelButton.focus(), 0);
  });
}
