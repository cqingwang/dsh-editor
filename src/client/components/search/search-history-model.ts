type Translate = (key: string, params?: Record<string, unknown>) => string;

/**
 * Give an empty history entry a visible, accessible label.
 *
 * Empty query/replacement values are real history entries because they replay
 * a deletion or clear action. Rendering the raw value would create a blank menu
 * row with an empty accessible name, so the owning field kind supplies the
 * localized label instead.
 */
export function searchHistoryMenuLabel(value: string, kind: 'query' | 'replace', t: Translate): string {
  if (value === '') return t(kind === 'query' ? 'editor.findHistoryEmptyQuery' : 'editor.findHistoryEmptyReplacement');
  if (value.trim() === '') return t('editor.findHistoryWhitespaceValue');
  return value;
}
