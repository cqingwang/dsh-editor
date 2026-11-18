/* foundation.js: dsh-editor client module. Generated into lib/client.js by scripts/build-client.mjs. */
    const React = require('react');
    const { createRoot } = require('react-dom/client');
    /* The host's own file artwork; unavailable on an older host, in which case
       the existing file-extension badges remain the fallback. */
    const primitives = (() => {
      try { return require('@deepseek-ai/dsh-client-ui-primitives'); } catch { return null; }
    })();

    /** Locale namespace owned by this plugin. */
    const NS = 'dsh-editor';
    /** Last operational Editor events, kept in memory for the current page. */
    const editorDiagnosticRing = [];
    /** Recent user interactions used only as context for Editor runtime errors. */
    const editorActionRing = [];
    let editorDiagnosticSequence = 0;

    /**
     * Monaco rejects internal cancellation promises when a diff/editor is
     * disposed or restores view state. Those promises have no owner left to
     * observe them, so the browser otherwise prints a misleading
     * "Uncaught (in promise) Canceled" even though disposal succeeded.
     * @param {unknown} reason - unhandled rejection reason.
     * @param {string} stack - captured reason stack.
     * @returns {boolean} true only for Monaco's own cancellation rejection.
     */
    function isMonacoCancellation(reason, stack) {
      const message = typeof reason === 'string'
        ? reason
        : reason?.message ?? String(reason ?? '');
      const normalizedMessage = message.trim();
      const rejectionStack = typeof stack === 'string'
        ? stack
        : reason?.stack ?? '';
      if (!rejectionStack.includes('monaco/vs/editor/editor.main.js')) return false;
      const name = typeof reason === 'object' && reason !== null ? reason.name ?? '' : '';
      if (name !== '' && name !== 'Error' && name !== 'Canceled' && name !== 'CanceledError') return false;
      return normalizedMessage === 'Canceled'
        || normalizedMessage === 'Canceled: Canceled'
        || reason?.name === 'Canceled'
        || reason?.name === 'CanceledError';
    }

    /**
     * Detect a bare double-Shift gesture. The gesture no longer carries its own
     * search mode; callers route it to the same Find in Files handler as
     * Cmd/Ctrl+Shift+F.
     * @param {number} previousAt - previous Shift timestamp, or zero.
     * @param {KeyboardEvent|object} event - current keydown.
     * @param {number} now - monotonic timestamp.
     * @param {number} [windowMs=400] - maximum tap gap.
     * @returns {{lastAt: number, open: boolean}} next detector state.
     */
    function doubleShiftAction(previousAt, event, now, windowMs = 400) {
      const bareShift = event?.key === 'Shift'
        && event?.repeat !== true
        && event?.metaKey !== true
        && event?.ctrlKey !== true
        && event?.altKey !== true;
      if (!bareShift) return { lastAt: 0, open: false };
      const previous = Number(previousAt);
      const current = Number(now);
      if (!Number.isFinite(current)) return { lastAt: 0, open: false };
      if (Number.isFinite(previous) && previous > 0 && current >= previous && current - previous <= windowMs) {
        return { lastAt: 0, open: true };
      }
      return { lastAt: current, open: false };
    }

    /**
     * Return the visible Editor workspace that owns Editor-wide search
     * shortcuts. Focus may be in the chat, a toolbar, or the document body;
     * the Editor being visible is the only interaction boundary.
     * @param {Document} documentRef - current document.
     * @returns {Element|null} active, laid-out Editor workspace.
     */
    function visibleEditorWorkspace(documentRef) {
      const host = documentRef?.querySelector?.(
        '[data-dsh-editor-host]:not([data-dsh-editor-host-idle]) [data-dsh-editor-workspace]',
      ) ?? null;
      if (host === null || host.isConnected === false) return null;
      return (host.getClientRects?.().length ?? 0) > 0 ? host : null;
    }

    /**
     * Detect the macOS keymap family without depending on user-agent wording.
     * @param {unknown} platform - `navigator.platform`-like value.
     * @returns {boolean} whether IDEA's macOS Control-based occurrences keys apply.
     */
    function isMacPlatform(platform) {
      return /mac|iphone|ipad|ipod/iu.test(String(platform ?? ''));
    }

    /**
     * Map IDEA's Control modifier onto Monaco without turning it into Cmd on macOS.
     * @param {object} monaco - Monaco global namespace.
     * @param {string} platform - browser platform string.
     * @returns {number} platform-correct Control modifier bit.
     */
    function ideaControlKeyModifier(monaco, platform) {
      return isMacPlatform(platform) ? monaco.KeyMod.WinCtrl : monaco.KeyMod.CtrlCmd;
    }

    /**
     * Return the IDEA-primary visible shortcut for the usage family.
     * @param {'findUsages'|'showUsages'|'findUsagesSettings'} actionId - action.
     * @param {boolean} macPlatform - whether the macOS keymap applies.
     * @returns {string} visible shortcut glyphs.
     */
    function ideaUsageFamilyShortcut(actionId, macPlatform) {
      if (macPlatform) {
        if (actionId === 'findUsages') return '⌃U';
        if (actionId === 'showUsages') return '⌃⌥U';
        if (actionId === 'findUsagesSettings') return '⌃⇧⌥U';
      }
      if (actionId === 'findUsages') return '⌥F7';
      if (actionId === 'showUsages') return '⌃⌥F7';
      if (actionId === 'findUsagesSettings') return '⌃⇧⌥F7';
      return '';
    }

    /**
     * Match the executable primary and alternate chords of IDEA's usage family.
     * @param {KeyboardEvent|object} event - current keyboard event.
     * @param {boolean} macPlatform - whether the macOS keymap applies.
     * @returns {'findUsages'|'showUsages'|'findUsagesSettings'|null} matched action.
     */
    function ideaUsageFamilyShortcutAction(event, macPlatform) {
      if (event === null || typeof event !== 'object') return null;
      if (event.isComposing === true) return null;
      const key = String(event.key ?? '').toLowerCase();
      if (macPlatform && key === 'u') {
        if (event.ctrlKey !== true || event.metaKey === true) return null;
        if (event.altKey !== true) return event.shiftKey === true ? null : 'findUsages';
        return event.shiftKey === true ? 'findUsagesSettings' : 'showUsages';
      }
      if (key !== 'f7' || event.altKey !== true) return null;
      if (macPlatform) {
        if (event.metaKey === true) {
          if (event.ctrlKey === true) return null;
          return event.shiftKey === true ? 'findUsagesSettings' : 'showUsages';
        }
        if (event.ctrlKey === true || event.shiftKey === true) return null;
        return 'findUsages';
      }
      if (event.metaKey === true) return null;
      if (event.ctrlKey !== true) {
        return event.shiftKey === true ? null : 'findUsages';
      }
      return event.shiftKey === true ? 'findUsagesSettings' : 'showUsages';
    }

    /**
     * Match IDEA's Find Next / Previous primary and macOS alternate chords.
     * @param {KeyboardEvent|object} event - current keyboard event.
     * @param {boolean} macPlatform - whether the macOS keymap applies.
     * @returns {-1|0|1} previous, no match, or next.
     */
    function ideaFindStepShortcutAction(event, macPlatform) {
      if (event === null || typeof event !== 'object') return 0;
      if (event.isComposing === true || event.metaKey === true || event.altKey === true) return 0;
      const key = String(event.key ?? '').toLowerCase();
      const step = event.shiftKey === true ? -1 : 1;
      if (key === 'f3' && event.ctrlKey !== true) return step;
      if (macPlatform && key === 'l' && event.ctrlKey === true) return step;
      return 0;
    }

    /**
     * Match IDEA's Show Search History chord.
     * @param {KeyboardEvent|object} event - current keyboard event.
     * @returns {boolean} whether the event opens query history.
     */
    function searchHistoryShortcutMatches(event) {
      if (event === null || typeof event !== 'object' || event.isComposing === true) return false;
      return event.altKey === true
        && event.metaKey !== true
        && event.ctrlKey !== true
        && event.shiftKey !== true
        && event.key === 'ArrowDown';
    }

    /**
     * Cycle a modular focus index for the Search Everywhere dialog.
     * @param {number} length - focusable element count.
     * @param {number} index - current element index.
     * @param {boolean} backward - whether Shift+Tab applies.
     * @returns {number|null} next index, or null for an empty list.
     */
    function searchEverywhereNextFocusIndex(length, index, backward) {
      const count = Math.max(0, Math.floor(Number(length) || 0));
      if (count === 0) return null;
      const valid = Number.isInteger(index) && index >= 0 && index < count;
      if (!valid) return backward === true ? count - 1 : 0;
      return backward === true ? (index - 1 + count) % count : (index + 1) % count;
    }

    /**
     * Match IDEA's Find Action chord from the default and macOS keymaps.
     * @param {KeyboardEvent|object} event - current keyboard event.
     * @param {boolean} macPlatform - whether the macOS keymap applies.
     * @returns {boolean} whether this event opens Find Action.
     */
    function findActionShortcutMatches(event, macPlatform) {
      if (event === null || typeof event !== 'object') return false;
      if (event.isComposing === true || event.altKey === true || event.shiftKey !== true) return false;
      const key = String(event.key ?? '').toLowerCase();
      if (macPlatform) {
        return event.metaKey === true
          && event.ctrlKey !== true
          && (key === 'a' || key === 'p');
      }
      return event.ctrlKey === true && event.metaKey !== true && key === 'a';
    }

    /**
     * Leave Find Action chords to controls that already own the same context.
     * @param {EventTarget|null} target - event target.
     * @param {Element|null} active - current focused element.
     * @returns {boolean} whether a child context should receive the chord.
     */
    function findActionShortcutBlockedByChildContext(target, active) {
      const selector = 'input, textarea, [contenteditable="true"], .monaco-editor, '
        + '[data-dsh-editor-terminal], [data-dsh-changes-panel], [data-dsh-log-panel], [role="tree"]';
      return target?.closest?.(selector) != null || active?.closest?.(selector) != null;
    }

    /**
     * Remember a small, content-safe description of the latest interaction.
     *
     * This ring is persisted only when the Editor reports a runtime error. It deliberately ignores
     * editable content and single printable keystrokes.
     * @param {Event} event - captured click or keydown event.
     * @returns {void}
     */
    function recordDiagnosticAction(event) {
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest('input, textarea, [contenteditable="true"]') !== null) return;
      const actionTarget = target?.closest('button, [role="tab"], [role="menuitem"], [data-row-key]') ?? null;
      const key = event.type === 'keydown' ? event.key : '';
      const keyboardShortcut = event.type === 'keydown'
        && (event.metaKey || event.ctrlKey || event.altKey || event.key.length > 1);
      if (actionTarget === null && !keyboardShortcut) return;
      const visible = (actionTarget?.getAttribute('aria-label') ?? actionTarget?.textContent ?? '').trim().replace(/\s+/gu, ' ');
      const modifiers = [
        event.metaKey ? 'Meta' : '',
        event.ctrlKey ? 'Control' : '',
        event.altKey ? 'Alt' : '',
        event.shiftKey ? 'Shift' : '',
      ].filter(Boolean);
      editorActionRing.push({
        at: new Date().toISOString(),
        type: event.type,
        key: key === '' ? '' : `${modifiers.join('+')}${modifiers.length > 0 ? '+' : ''}${key}`,
        role: actionTarget?.getAttribute('role') ?? actionTarget?.tagName?.toLowerCase() ?? '',
        label: visible.slice(0, 80),
        rowKey: actionTarget?.getAttribute?.('data-row-key')?.slice(0, 100) ?? '',
      });
      if (editorActionRing.length > 12) {
        editorActionRing.splice(0, editorActionRing.length - 12);
      }
    }

    /**
     * Persist a small operational diagnostic without chat or file content.
     * Reporting is deliberately best-effort: a failed log request must never
     * affect the Editor or recursively create another diagnostic.
     * @param {string} event - stable event name.
     * @param {object} [details] - measured host/layout state.
     * @param {'info'|'warn'|'error'} [level] - console severity.
     * @returns {void}
     */
    function reportEditorDiagnostic(event, details = {}, level = 'warn') {
      const record = {
        at: new Date().toISOString(),
        sequence: ++editorDiagnosticSequence,
        page: window.location?.pathname ?? '',
        event: typeof event === 'string' ? event : 'unknown',
        details: details !== null && typeof details === 'object' ? details : {},
      };
      editorDiagnosticRing.push(record);
      if (editorDiagnosticRing.length > 50) {
        editorDiagnosticRing.splice(0, editorDiagnosticRing.length - 50);
      }
      const label = `[dsh-editor:diag] ${record.event}`;
      if (level === 'error') console.error(label, record);
      else if (level === 'warn') console.warn(label, record);
      else console.info(label, record);
      try {
        void fetch('api/dsh-editor/diagnostics', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ records: [record] }),
        }).catch(() => {});
      } catch {
        /* diagnostics are strictly best-effort */
      }
    }

    /** xterm constructors, loaded at most once. */
    let xtermPromise = null;
    /* The host can remount the workspace during layout updates; the selected
       IDEA tool window is user context and must not silently fall back to Project. */
    let lastEditorActivity = 'project';
    /** Tab label is intentionally identical in both languages. */
    const VIEW_LABEL = 'Editor';
