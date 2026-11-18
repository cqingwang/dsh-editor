import React from 'react';
import { styles } from '../../ui/styles';
import { Icon } from '../ui/Icon';
import { ToolbarButton } from '../ui/ToolbarButton';
import {
  inspectIdeaScopeXml,
  normalizeCustomFindScopes,
  normalizeScopeXmlTransferPath,
  serializeIdeaScopeXml,
} from '../../commit';
import { callFs } from '../../editor-core';
import { newFindScopeId } from '../../find-tool';

type Translate = (key: string, params?: Record<string, unknown>) => string;

export interface FindScope {
  id: string;
  name: string;
  includePatterns: string[];
  excludePatterns: string[];
  shared: boolean;
}

export interface FindScopeEditorProps {
  t: Translate;
  scopes: unknown[];
  initialId?: string | null;
  onSave: (scopes: FindScope[], selectedId: string | null) => void;
  onClose: () => void;
}

function FindScopeEditor({ t, scopes, initialId, onSave, onClose }: FindScopeEditorProps) {
  const initialDrafts = React.useMemo(() => {
    const normalized = normalizeCustomFindScopes(scopes);
    return normalized.length === 0
      ? [
          {
            id: newFindScopeId(),
            name: t('editor.findScopeNewName'),
            includePatterns: [],
            excludePatterns: [],
            shared: false,
          },
        ]
      : normalized;
  }, [scopes, t]);
  const [drafts, setDrafts] = React.useState(initialDrafts);
  const [selectedId, setSelectedId] = React.useState(() =>
    initialDrafts.some((scope) => scope.id === initialId) ? initialId : (initialDrafts[0]?.id ?? null),
  );
  const [error, setError] = React.useState(null);
  const [transfer, setTransfer] = React.useState(null);
  const selectedIndex = drafts.findIndex((scope) => scope.id === selectedId);
  const selected = selectedIndex < 0 ? null : drafts[selectedIndex];
  const updateSelected = (patch) => {
    setDrafts((current) => current.map((scope) => (scope.id === selectedId ? { ...scope, ...patch } : scope)));
    setError(null);
  };
  const addScope = () => {
    const scope = {
      id: newFindScopeId(),
      name: t('editor.findScopeNewName'),
      includePatterns: [],
      excludePatterns: [],
      shared: false,
    };
    setDrafts((current) => [...current, scope]);
    setSelectedId(scope.id);
    setError(null);
  };
  const duplicateSelected = () => {
    if (selected === null) return;
    const copy = {
      ...selected,
      id: newFindScopeId(),
      name: t('editor.findScopeCopyName', { name: selected.name }),
      includePatterns: [...selected.includePatterns],
      excludePatterns: [...selected.excludePatterns],
    };
    setDrafts((current) => [...current, copy]);
    setSelectedId(copy.id);
  };
  const removeSelected = () => {
    if (selected === null) return;
    const next = drafts.filter((scope) => scope.id !== selected.id);
    setDrafts(next);
    setSelectedId(next[Math.max(0, selectedIndex - 1)]?.id ?? null);
  };
  const moveSelected = (delta) => {
    if (selected === null) return;
    const targetIndex = selectedIndex + delta;
    if (targetIndex < 0 || targetIndex >= drafts.length) return;
    const next = [...drafts];
    [next[selectedIndex], next[targetIndex]] = [next[targetIndex], next[selectedIndex]];
    setDrafts(next);
  };
  const commit = () => {
    const normalized = normalizeCustomFindScopes(drafts);
    if (normalized.some((scope) => scope.name.trim() === '')) {
      setError(t('editor.findScopeNameRequired'));
      return;
    }
    const names = normalized.map((scope) => scope.name.toLocaleLowerCase());
    if (new Set(names).size !== names.length) {
      setError(t('editor.findScopeDuplicateName'));
      return;
    }
    onSave(normalized, selectedId);
    onClose();
  };
  const openTransfer = (mode) => {
    setTransfer({
      mode,
      path: '.idea/scopes/dsh-editor.xml',
      loading: false,
      error: null,
      scopes: null,
      skipped: 0,
      conflicts: 0,
      xml: '',
    });
  };
  const previewTransfer = async () => {
    if (transfer === null || transfer.loading === true) return;
    const path = normalizeScopeXmlTransferPath(transfer.path);
    if (path === '') {
      setTransfer((current) =>
        current === null ? current : { ...current, error: t('editor.findScopeXmlInvalidPath') },
      );
      return;
    }
    setTransfer((current) => (current === null ? current : { ...current, loading: true, error: null }));
    if (transfer.mode === 'import') {
      try {
        const value = await callFs({ op: 'read', path });
        if (typeof value?.content !== 'string' || value.content.length > 256 * 1024) {
          throw new Error(t('editor.findScopeXmlTooLarge'));
        }
        const report = inspectIdeaScopeXml(value.content);
        const existingNames = new Set(drafts.map((scope) => scope.name.toLocaleLowerCase()));
        const conflicts = report.scopes.filter((scope) => existingNames.has(scope.name.toLocaleLowerCase())).length;
        setTransfer((current) =>
          current === null
            ? current
            : {
                ...current,
                path,
                loading: false,
                error: null,
                scopes: report.scopes,
                skipped: report.skipped,
                conflicts,
              },
        );
      } catch (failure) {
        setTransfer((current) =>
          current === null
            ? current
            : {
                ...current,
                loading: false,
                error: failure instanceof Error ? failure.message : String(failure),
              },
        );
      }
      return;
    }
    const sharedScopes = drafts.filter((scope) => scope.shared === true);
    if (sharedScopes.length === 0) {
      setTransfer((current) =>
        current === null
          ? current
          : {
              ...current,
              loading: false,
              error: t('editor.findScopeXmlNoShared'),
            },
      );
      return;
    }
    setTransfer((current) =>
      current === null
        ? current
        : {
            ...current,
            path,
            loading: false,
            error: null,
            scopes: sharedScopes,
            skipped: 0,
            conflicts: 0,
            xml: serializeIdeaScopeXml(sharedScopes),
          },
    );
  };
  const applyTransfer = async () => {
    if (transfer === null || Array.isArray(transfer.scopes) === false) return;
    if (transfer.mode === 'import') {
      const imported = transfer.scopes;
      const next = [...drafts];
      for (const scope of imported) {
        const index = next.findIndex((entry) => entry.name.toLocaleLowerCase() === scope.name.toLocaleLowerCase());
        if (index >= 0) next[index] = scope;
        else next.push(scope);
      }
      const normalized = normalizeCustomFindScopes(next);
      setDrafts(normalized);
      setSelectedId(imported[0]?.id ?? selectedId);
      setTransfer(null);
      setError(null);
      return;
    }
    const path = normalizeScopeXmlTransferPath(transfer.path);
    if (path === '') {
      setTransfer((current) =>
        current === null ? current : { ...current, error: t('editor.findScopeXmlInvalidPath') },
      );
      return;
    }
    setTransfer((current) => (current === null ? current : { ...current, loading: true, error: null }));
    try {
      await callFs({ op: 'write', path, content: transfer.xml, force: true, create: true });
      setTransfer(null);
    } catch (failure) {
      setTransfer((current) =>
        current === null
          ? current
          : {
              ...current,
              loading: false,
              error: failure instanceof Error ? failure.message : String(failure),
            },
      );
    }
  };
  const transferPanel =
    transfer === null ? null : (
      <div
        style={{ display: 'grid', gap: 10 }}
        data-dsh-find-scope-transfer={transfer.mode}>
        <div style={{ fontWeight: 600 }}>
          {t(transfer.mode === 'import' ? 'editor.findScopeImportTitle' : 'editor.findScopeExportTitle')}
        </div>
        <label style={{ display: 'grid', gap: 4 }}>
          <span>{t('editor.findScopeXmlPath')}</span>
          <input
            style={styles.findInput}
            value={transfer.path}
            placeholder='.idea/scopes/dsh-editor.xml'
            aria-label={t('editor.findScopeXmlPath')}
            onChange={(event) =>
              setTransfer((current) =>
                current === null
                  ? current
                  : {
                      ...current,
                      path: event.target.value,
                      scopes: null,
                      xml: '',
                      error: null,
                    },
              )
            }
          />
        </label>
        {transfer.scopes === null ? null : (
          <div style={{ color: 'var(--dsw-alias-label-secondary)' }}>
            {t('editor.findScopeXmlPreview', {
              count: transfer.scopes.length,
              skipped: transfer.skipped,
              conflicts: transfer.conflicts,
            })}
          </div>
        )}
        {transfer.mode === 'export' && transfer.xml !== '' ? (
          <pre
            style={{
              maxHeight: 150,
              overflow: 'auto',
              margin: 0,
              padding: 8,
              background: 'var(--dsw-alias-bg-l2)',
              borderRadius: 3,
              fontSize: 11,
            }}>
            {transfer.xml}
          </pre>
        ) : null}
        {transfer.error === null ? null : (
          <div
            role='alert'
            style={styles.searchEverywhereError}>
            {transfer.error}
          </div>
        )}
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type='button'
            style={styles.conflictAction}
            disabled={transfer.loading === true}
            onClick={() => void previewTransfer()}>
            {t('editor.findScopeXmlPreviewAction')}
          </button>
          {transfer.scopes === null ? null : (
            <button
              type='button'
              style={{ ...styles.conflictAction, fontWeight: 600 }}
              disabled={transfer.loading === true || transfer.scopes.length === 0}
              onClick={() => void applyTransfer()}>
              {t(transfer.mode === 'import' ? 'editor.findScopeImportAction' : 'editor.findScopeExportAction')}
            </button>
          )}
          <button
            type='button'
            style={styles.conflictAction}
            onClick={() => setTransfer(null)}>
            {t('editor.cancel')}
          </button>
        </div>
      </div>
    );

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 80,
        display: 'grid',
        placeItems: 'center',
        background: 'rgba(0,0,0,0.28)',
      }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      data-dsh-find-scope-editor=''>
      <div
        role='dialog'
        aria-modal='true'
        aria-label={t('editor.findEditScopes')}
        style={{
          width: 'min(720px, calc(100vw - 32px))',
          height: 'min(520px, calc(100vh - 32px))',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--dsw-alias-bg-l1)',
          color: 'var(--dsw-alias-label-primary)',
          border: '1px solid var(--dsw-alias-border-l2)',
          borderRadius: 6,
          boxShadow: '0 18px 50px rgba(0,0,0,0.28)',
          overflow: 'hidden',
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            onClose();
          }
        }}>
        <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--dsw-alias-border-l2)', fontWeight: 600 }}>
          {t('editor.findScopesTitle')}
        </div>
        <div style={{ display: 'flex', minHeight: 0, flex: '1 1 auto' }}>
          <div
            style={{
              width: 230,
              flex: '0 0 auto',
              borderRight: '1px solid var(--dsw-alias-border-l2)',
              display: 'flex',
              flexDirection: 'column',
              minHeight: 0,
            }}>
            <div style={{ display: 'flex', gap: 2, padding: 6, borderBottom: '1px solid var(--dsw-alias-border-l2)' }}>
              <ToolbarButton
                icon='newFolder'
                label={t('editor.findAddScope')}
                onClick={addScope}
              />
              <ToolbarButton
                icon='file'
                label={t('editor.findCopyScope')}
                disabled={selected === null}
                onClick={duplicateSelected}
              />
              <ToolbarButton
                icon='close'
                label={t('editor.findDeleteScope')}
                disabled={selected === null}
                onClick={removeSelected}
              />
              <ToolbarButton
                icon='chevronUp'
                label={t('editor.findScopeMoveUp')}
                disabled={selectedIndex <= 0}
                onClick={() => moveSelected(-1)}
              />
              <ToolbarButton
                icon='chevronDown'
                label={t('editor.findScopeMoveDown')}
                disabled={selectedIndex < 0 || selectedIndex >= drafts.length - 1}
                onClick={() => moveSelected(1)}
              />
            </div>
            <div
              style={{
                display: 'flex',
                gap: 2,
                padding: '2px 6px 6px',
                borderBottom: '1px solid var(--dsw-alias-border-l2)',
              }}>
              <ToolbarButton
                icon='file'
                label={t('editor.findScopeImport')}
                onClick={() => openTransfer('import')}
              />
              <ToolbarButton
                icon='patchExport'
                label={t('editor.findScopeExport')}
                onClick={() => openTransfer('export')}
              />
            </div>
            <div
              role='listbox'
              aria-label={t('editor.findScopesTitle')}
              style={{ overflow: 'auto', padding: 4 }}>
              {drafts.map((scope) => (
                <button
                  key={scope.id}
                  type='button'
                  role='option'
                  aria-selected={scope.id === selectedId}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '5px 7px',
                    border: 'none',
                    borderRadius: 3,
                    background: scope.id === selectedId ? 'var(--dsw-alias-state-business-primary)' : 'transparent',
                    color: scope.id === selectedId ? '#fff' : 'inherit',
                    textAlign: 'left',
                    cursor: 'pointer',
                  }}
                  onClick={() => setSelectedId(scope.id)}>
                  <Icon
                    name='folder'
                    size={13}
                  />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {scope.name}
                  </span>
                  {scope.shared === true ? (
                    <span style={{ marginLeft: 'auto', fontSize: 10, opacity: 0.8 }}>
                      {t('editor.findScopeSharedBadge')}
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
          </div>
          <div style={{ flex: '1 1 auto', minWidth: 0, overflow: 'auto', padding: 12 }}>
            {transfer !== null ? (
              transferPanel
            ) : selected === null ? (
              <div style={styles.treeMessage}>{t('editor.findScopeSelectPrompt')}</div>
            ) : (
              <React.Fragment>
                <label style={{ display: 'grid', gap: 4, marginBottom: 12 }}>
                  <span>{t('editor.findScopeName')}</span>
                  <input
                    style={styles.findInput}
                    value={selected.name}
                    maxLength={80}
                    autoFocus={true}
                    aria-label={t('editor.findScopeName')}
                    onChange={(event) => updateSelected({ name: event.target.value })}
                  />
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                  <input
                    type='checkbox'
                    checked={selected.shared === true}
                    onChange={(event) => updateSelected({ shared: event.target.checked })}
                  />
                  <span>{t('editor.findScopeShare')}</span>
                </label>
                <label style={{ display: 'grid', gap: 4, marginBottom: 12 }}>
                  <span>{t('editor.findScopeInclude')}</span>
                  <textarea
                    style={{ ...styles.findInput, minHeight: 96, resize: 'vertical', fontFamily: 'monospace' }}
                    value={selected.includePatterns.join('\n')}
                    placeholder={t('editor.findScopePatternPlaceholder')}
                    aria-label={t('editor.findScopeInclude')}
                    onChange={(event) => updateSelected({ includePatterns: event.target.value.split('\n') })}
                  />
                </label>
                <label style={{ display: 'grid', gap: 4, marginBottom: 8 }}>
                  <span>{t('editor.findScopeExclude')}</span>
                  <textarea
                    style={{ ...styles.findInput, minHeight: 96, resize: 'vertical', fontFamily: 'monospace' }}
                    value={selected.excludePatterns.join('\n')}
                    placeholder={t('editor.findScopePatternPlaceholder')}
                    aria-label={t('editor.findScopeExclude')}
                    onChange={(event) => updateSelected({ excludePatterns: event.target.value.split('\n') })}
                  />
                </label>
                <div style={{ color: 'var(--dsw-alias-label-tertiary)', fontSize: 11 }}>
                  {t('editor.findScopePatternsHelp')}
                </div>
              </React.Fragment>
            )}
            {error === null ? null : (
              <div
                role='alert'
                style={{ ...styles.searchEverywhereError, marginTop: 8 }}>
                {error}
              </div>
            )}
          </div>
        </div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 8,
            padding: '8px 12px',
            borderTop: '1px solid var(--dsw-alias-border-l2)',
          }}>
          <button
            type='button'
            style={styles.conflictAction}
            onClick={onClose}>
            {t('editor.cancel')}
          </button>
          <button
            type='button'
            style={{ ...styles.conflictAction, fontWeight: 600 }}
            onClick={commit}>
            {t('editor.ok')}
          </button>
        </div>
      </div>
    </div>
  );
}

export { FindScopeEditor };
