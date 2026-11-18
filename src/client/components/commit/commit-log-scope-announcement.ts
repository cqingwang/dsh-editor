type Translate = (key: string, params?: Record<string, unknown>) => string;

export function commitLogScopeAnnouncement(t: Translate, scopeHash: string, previousHash: string): string | null {
  if (scopeHash === previousHash) return null;
  if (scopeHash !== '') {
    return t('editor.graphScopeAnnouncement', {
      hash: scopeHash,
    });
  }
  return t('editor.graphScopeClearedAnnouncement');
}
