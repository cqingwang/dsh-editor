/* controller.js: dsh-editor client module. Generated into lib/client.js by scripts/build-client.mjs. */
    /**
     * Render a workspace path in the DSH file-mention grammar.
     *
     * DSH resolves `@path` and `@"path with spaces"` references against the
     * active Session's working directory. Directory references keep their
     * trailing slash so Chat continues to expose the folder affordance.
     * @param {string} path - workspace-relative or absolute path.
     * @param {boolean} [isDirectory=false] - append the directory marker.
     * @returns {string} ready-to-insert mention, or an empty string when invalid.
     */
    function harnessPathMention(path, isDirectory = false) {
      let value = typeof path === 'string' ? path.replace(/\\/g, '/') : '';
      if (value === '') return '';
      if (isDirectory && !value.endsWith('/')) value += '/';
      if (/[\u0000-\u001f\u007f-\u009f"]/u.test(value)) return '';
      return /\s/u.test(value) ? `@"${value}"` : `@${value}`;
    }

    /**
     * Build the structured reference and visible position suffix for Harness.
     *
     * The Project root has no workspace-relative identity, so it is addressed by
     * its absolute path. Files and folders beneath it stay relative, matching
     * DSH's workspace-aware `@` mention resolution.
     * @param {{path?: string, root?: string, isDirectory?: boolean, line?: number|null, column?: number|null, endLine?: number|null, endColumn?: number|null}} request - menu selection.
     * @returns {{reference: object, positionText: string, plainText: string}|null} composer insertion data.
     */
    function harnessReferencePlan(request = {}) {
      const root = typeof request.root === 'string' ? request.root.replace(/\\/g, '/').replace(/\/+$/u, '') : '';
      const sourcePath = typeof request.path === 'string' ? request.path.replace(/\\/g, '/') : '';
      const path = sourcePath === '' ? root : sourcePath;
      const isDirectory = request.isDirectory === true;
      const mention = harnessPathMention(path, isDirectory);
      if (mention === '') return null;
      const line = Number(request.line);
      const column = Number(request.column);
      const endLine = Number(request.endLine);
      const endColumn = Number(request.endColumn);
      const hasPosition = isDirectory !== true
        && Number.isInteger(line) && line > 0
        && Number.isInteger(column) && column > 0;
      const hasRange = hasPosition
        && Number.isInteger(endLine) && endLine > 0
        && Number.isInteger(endColumn) && endColumn > 0
        && (endLine > line || (endLine === line && endColumn > column));
      const positionText = hasPosition
        ? hasRange
          ? `L${line}:${column}-L${endLine}:${endColumn}`
          : `L${line}:${column}`
        : '';
      const name = basename(path) || basename(root) || path || root;
      const label = `${name}${isDirectory ? '/' : ''}${positionText === '' ? '' : ` ${positionText}`}`;
      const plainText = `${mention}${positionText === '' ? '' : ` ${positionText}`}`;
      return {
        reference: {
          source: 'reference',
          ref: mention,
          label,
          appearance: isDirectory ? 'folder' : 'file',
          /* The chip text is the message projection. Keep the position in that
             projection while `ref` stays the valid DSH file mention used for
             resolution/open. */
          clipboardText: plainText,
        },
        positionText,
        plainText,
      };
    }

    /**
     * Put the caret at the end of the host's Lexical composer.
     * @param {Document|null} documentRef - current document.
     * @returns {HTMLElement|null} the editable composer node.
     */
    function focusHarnessComposer(documentRef) {
      const composer = documentRef?.querySelector?.(
        '[data-conversation-region="composer"] [data-composer-input], [data-conversation-region="composer"] [contenteditable="true"]',
      ) ?? null;
      if (composer === null || typeof composer.focus !== 'function') return null;
      composer.focus();
      const selection = documentRef.getSelection?.();
      if (selection !== null && selection !== undefined) {
        const range = documentRef.createRange();
        if (range !== null && range !== undefined) {
          range.selectNodeContents(composer);
          range.collapse(false);
          selection.removeAllRanges();
          selection.addRange(range);
        }
      }
      return composer;
    }

    /**
     * Fallback insertion for older hosts without the public conversation input
     * shell. It appends text through the browser editing command and never sends.
     * @param {Document|null} documentRef - current document.
     * @param {string} text - plain-text references to append.
     * @returns {boolean} whether the browser accepted the edit.
     */
    function insertHarnessTextFallback(documentRef, text) {
      if (typeof text !== 'string' || text === '') return false;
      const composer = focusHarnessComposer(documentRef);
      if (composer === null) return false;
      const existing = String(composer.textContent ?? '');
      const prefix = existing !== '' && !/\s$/u.test(existing) ? ' ' : '';
      try {
        return documentRef.execCommand('insertText', false, `${prefix}${text}`);
      } catch {
        return false;
      }
    }

    /**
     * Append file/folder references to the current Harness composer.
     *
     * Prefer the host's public `conversation.input.for(...)` shell so references
     * become real DSH chips and participate in draft persistence/undo. The
     * existing draft is never replaced, and no submit method is ever called.
     * @param {object} ctx - DSH client context.
     * @param {{entries?: object[], line?: number|null, column?: number|null, endLine?: number|null, endColumn?: number|null}} request - selected workspace entries.
     * @param {{document?: Document|null}} [runtime] - test seam.
     * @returns {Promise<boolean>} whether the composer accepted every reference.
     */
    async function insertHarnessReferencesIntoComposer(ctx, request = {}, runtime = {}) {
      const entries = Array.isArray(request.entries)
        ? request.entries.filter((entry) => entry !== null && typeof entry === 'object')
        : [];
      const plans = entries
        .map((entry) => harnessReferencePlan({
          path: entry.path,
          root: entry.root,
          isDirectory: entry.isDirectory === true,
          line: request.line,
          column: request.column,
          endLine: request.endLine,
          endColumn: request.endColumn,
        }))
        .filter((plan) => plan !== null);
      if (plans.length === 0) return false;
      const documentRef = runtime.document
        ?? (typeof document === 'undefined' ? null : document);
      const sessionElement = documentRef?.querySelector?.('[data-conversation-region="chat"]') ?? null;
      const sessionId = String(sessionElement?.getAttribute?.('data-conversation-session') ?? '');
      if (sessionId !== '') {
        try {
          const sessions = ctx.get('sessions');
          const conversation = ctx.get('conversation');
          const scoped = typeof sessions?.scope === 'function' ? sessions.scope(sessionId) : undefined;
          const input = scoped === undefined ? undefined : conversation?.input?.for?.(scoped);
          if (input !== undefined && typeof input?.state?.getSnapshot === 'function') {
            /* The public addFiles verb inserts references at the live composer
               position and preserves the existing draft. Prefer it over
               span-based insertReference, whose revision CAS can go stale as
               soon as an existing chip or Lexical decoration settles. */
            if (typeof input.addFiles === 'function') {
              if (input.addFiles(plans.map((plan) => plan.reference), []) !== true) return false;
              focusHarnessComposer(documentRef);
              if (typeof window !== 'undefined') {
                window.setTimeout(() => focusHarnessComposer(documentRef), 0);
                window.requestAnimationFrame?.(() => focusHarnessComposer(documentRef));
              }
              return true;
            }
            for (const plan of plans) {
              let snapshot = input.state.getSnapshot();
              let draft = String(snapshot?.draft ?? '');
              let offset = draft.length;
              if (draft !== '' && !/\s$/u.test(draft)) {
                if (typeof input.insertText !== 'function'
                  || input.insertText(' ', { start: offset, end: offset, draftRev: snapshot.draftRev }) !== true) {
                  return false;
                }
                snapshot = input.state.getSnapshot();
                draft = String(snapshot?.draft ?? '');
                offset = draft.length;
              }
              if (typeof input.insertReference === 'function') {
                if (input.insertReference(plan.reference, {
                  start: offset,
                  end: offset,
                  draftRev: snapshot.draftRev,
                }) !== true) return false;
                continue;
              }
              if (typeof input.insertText !== 'function'
                || input.insertText(plan.plainText, {
                  start: offset,
                  end: offset,
                  draftRev: snapshot.draftRev,
                }) !== true) return false;
            }
            focusHarnessComposer(documentRef);
            /* Lexical commits the inserted chip after the input command returns
               and may replace its contenteditable host. Re-focus after that
               commit so the menu cannot leave keyboard ownership on the tree. */
            if (typeof window !== 'undefined') {
              window.setTimeout(() => focusHarnessComposer(documentRef), 0);
              window.requestAnimationFrame?.(() => focusHarnessComposer(documentRef));
            }
            return true;
          }
        } catch {
          /* Older hosts fall through to the browser editing command below. */
        }
      }
      return insertHarnessTextFallback(documentRef, plans.map((plan) => plan.plainText).join(' '));
    }

    function createController(ctx) {
      const t = translate(ctx.locale.bind(NS), { zh, en });
      let active = false;
      let host = null;
      let root = null;
      /* The Editor host lives under a stable layout ancestor. This observer only
         follows the live Chat body's rectangle; it never owns the React root. */
      let hostPositionObserver = null;
      let hostPositionBody = null;
      /* The workspace chosen by the sidebar `... → Editor` entry. Empty means
         "follow the current conversation session" (hero/chat toggle entry). */
      let editorWorkspaceId = '';
      /* Last workspace row under the pointer, used because DSH's menu portal
         does not retain the row identity for cloned items. */
      let lastWorkspaceId = '';
      /* Re-entrancy guard for `sync`: it writes DOM that its own observer watches. */
      let syncing = false;
      /* The host streams many small mutations while a reply is rendering. Running the
         whole DOM reconciliation synchronously for every one of them can pin the
         renderer in a microtask storm. Coalesce to at most one maintenance pass per
         80ms. */
      let maintenanceTimer = 0;
      let lastMaintenanceAt = 0;
      /* The chat column's drag handle and the width it currently applies. */
      let chatHandle = null;
      let chatWidth = CHAT_WIDTH_DEFAULT;
      /* Harness minimize is a temporary layout state, not a persisted width. */
      let harnessCollapsed = false;
      /* The View-row button that opens/closes the Editor workbench. */
      let chatToggle = null;
      /* A blank conversation has no `[data-conversation-tabs]` yet. Its hero still
         exposes a stable host slot, so the Editor gets a real entry point before the
         first message instead of being reachable only from the workspace menu. */
      let heroLaunch = null;

      const findBody = () => document.querySelector('[data-conversation-region="chat"]');
      const findTablist = () => document.querySelector('[data-conversation-tabs]');
      const findHeroOptions = () => document.querySelector('[data-slot="conversation.hero.options"]');
      const findConversationSlot = () => document.querySelector('[data-slot="main.conversation"]');
      /**
       * Stable layout parent for the injected Editor.
       *
       * The conversation body is React-owned and is repeatedly replaced during
       * view/session updates. The main.conversation slot remains stable, but slot
       * wrappers are often `display: contents` and cannot anchor an absolutely
       * positioned child. Climb to the first ancestor with a real layout box.
       * @returns {HTMLElement|null} stable host parent, or the current body as fallback.
       */
      const findHostParent = () => {
        const slot = findConversationSlot();
        let candidate = slot?.parentElement ?? null;
        while (candidate !== null && candidate !== document.body) {
          const style = window.getComputedStyle(candidate);
          const rect = candidate.getBoundingClientRect();
          if (style.display !== 'contents' && rect.width > 0 && rect.height > 0) return candidate;
          candidate = candidate.parentElement;
        }
        return findBody();
      };

      /**
       * Collapse the left workspace/session sidebar when it is expanded.
       *
       * The workspace menu's Editor action is explicitly about opening the
       * editor, so reclaiming the 280px conversation-list column gives the
       * file tree and code surface their maximum usable width. The host owns
       * the collapse state; reuse its toggle instead of mutating grid styles.
       * @returns {boolean} true when this call collapsed the sidebar.
       */
      function collapseConversationSidebar() {
        const toggle = document.querySelector('[data-sidebar-toggle]');
        if (!(toggle instanceof HTMLElement)) return false;
        const slot = toggle.closest('[data-slot="sidebar"]');
        const sidebarColumn = slot?.parentElement ?? null;
        const width = sidebarColumn?.getBoundingClientRect().width ?? 0;
        if (!sidebarNeedsCollapse(width)) return false;
        toggle.click();
        return true;
      }

      /**
       * Activate the editor split.
       *
       * Shared by the blank-session hero action and the workspace menu item, so
       * both paths agree on what "open the editor" means: the right column is the
       * Chat view.
       * @returns {void}
       */
      function openEditorSplit(workspaceId = '') {
        const nextWorkspaceId = typeof workspaceId === 'string' ? workspaceId : '';
        if (nextWorkspaceId !== editorWorkspaceId) {
          editorWorkspaceId = nextWorkspaceId;
          /* A different workspace owns a different Project tree, open files and
             terminal placement. Rebuild instead of retaining the previous scope. */
          destroyHost();
        }
        setActive(true);
      }

      /**
       * Keep an Editor entry point visible on a blank conversation hero.
       *
       * The host renders the hero's options slot before it renders the View tab
       * strip. Waiting for `[data-conversation-tabs]` therefore made Project,
       * Commit and Terminal unavailable until the user had sent a message. The
       * button calls the same `openEditorSplit` as the tab and workspace menu item,
       * so there is only one layout path.
       * @returns {void}
       */
      function ensureHeroLaunch() {
        const slot = findHeroOptions();
        if (slot === null) {
          heroLaunch?.remove();
          heroLaunch = null;
          return;
        }
        if (heroLaunch !== null && heroLaunch.isConnected && heroLaunch.parentElement === slot) {
          applyHeroLaunchState();
          return;
        }
        heroLaunch?.remove();
        heroLaunch = document.createElement('button');
        heroLaunch.type = 'button';
        heroLaunch.setAttribute('data-dsh-editor-launch', '');
        heroLaunch.setAttribute('aria-pressed', 'false');
        heroLaunch.style.cssText = [
          'display:inline-flex',
          'align-items:center',
          'justify-content:center',
          'width:26px',
          'height:26px',
          'margin-left:2px',
          'padding:0',
          'border:0.5px solid var(--dsw-alias-border-l2, var(--dsw-alias-border-l3))',
          'border-radius:6px',
          'background:transparent',
          'color:var(--dsw-alias-label-secondary)',
          'font:inherit',
          'font-size:11.5px',
          'cursor:pointer',
          'white-space:nowrap',
        ].join(';');
        heroLaunch.addEventListener('click', (event) => {
          event.preventDefault();
          event.stopPropagation();
          if (active) setActive(false);
          else openEditorSplit();
        });
        slot.appendChild(heroLaunch);
        applyHeroLaunchState();
      }

      /**
       * Reflect the Editor's open state on the blank-session hero button.
       * @returns {void}
       */
      function applyHeroLaunchState() {
        if (heroLaunch === null || !heroLaunch.isConnected) return;
        const available = new Set([...document.querySelectorAll('symbol[id]')].map((symbol) => symbol.id));
        const chosen = pickMenuIcon(
          ['dsw-icon-panel-left-outline-regular', 'dsw-icon-code-outline-regular', 'dsw-icon-edit-outline-regular'],
          available,
        );
        const icon = chosen === null
          ? ''
          : `<svg width="14" height="14" aria-hidden="true"><use href="#${chosen}"></use></svg>`;
        const markup = icon === '' ? 'E' : icon;
        if (heroLaunch.innerHTML !== markup) heroLaunch.innerHTML = markup;
        heroLaunch.setAttribute('aria-pressed', active ? 'true' : 'false');
        heroLaunch.setAttribute('title', active ? t('editor.closeEditor') : t('editor.openEditor'));
        heroLaunch.setAttribute('aria-label', active ? t('editor.closeEditor') : t('editor.openEditor'));
        heroLaunch.style.background = active
          ? 'var(--dsw-alias-button-ghost-active-fill, var(--dsw-alias-interactive-bg-hover-solid))'
          : 'transparent';
        heroLaunch.style.color = active
          ? 'var(--dsw-alias-label-primary)'
          : 'var(--dsw-alias-label-secondary)';
      }

      /**
       * Push the current chat width into the CSS variable the layout reads.
       * @param {number} value - width in percent.
       * @returns {void}
       */
      function applyChatWidth(value) {
        chatWidth = clampChatPercent(value);
        applyChatLayout();
      }

      /**
       * Push the chat width and Editor-toggle state into the layout.
       * @returns {void}
       */
      function applyChatLayout() {
        const body = document.body;
        const layoutWidth = chatLayoutWidth(harnessCollapsed, chatWidth);
        body.style.setProperty('--dsh-editor-chat-width', `${layoutWidth}%`);
        /* The mirror of the width: `100% - width` computed in JS, so the layout never
           needs a percentage margin (see the rule's comment). */
        body.style.setProperty('--dsh-editor-chat-offset', `${Math.max(0, 100 - layoutWidth)}%`);
        if (harnessCollapsed) body.setAttribute('data-dsh-editor-harness-collapsed', '');
        else body.removeAttribute('data-dsh-editor-harness-collapsed');
        if (chatToggle !== null) {
          /* This is the Editor show/hide control beside the host's View tabs, not a
             fourth tab. Split-panel opens the workbench; panel-left closes it. */
          const preferred = active
            ? ['dsw-icon-panel-left-outline-regular', 'dsw-icon-panel-left-outline-medium']
            : ['dsw-icon-compare-split-outline-regular', 'dsw-icon-panel-left-outline-regular'];
          const available = new Set([...document.querySelectorAll('symbol[id]')].map((symbol) => symbol.id));
          const chosen = pickMenuIcon(preferred, available);
          const markup = chosen === null
            ? (active ? '«' : '»')
            : `<svg width="16" height="16" aria-hidden="true"><use href="#${chosen}"></use></svg>`;
          /* Re-read the tab metrics: a theme or density switch can change them, and
             the strip is re-rendered by the host on view switches. */
          matchTabMetrics(chatToggle, chatToggle.parentElement);
          if (chatToggle.innerHTML !== markup) chatToggle.innerHTML = markup;
          chatToggle.setAttribute('aria-expanded', active ? 'true' : 'false');
          chatToggle.setAttribute('title', t(active ? 'editor.closeEditor' : 'editor.openEditor'));
          chatToggle.setAttribute('aria-label', t(active ? 'editor.closeEditor' : 'editor.openEditor'));
          chatToggle.setAttribute('data-editor-open', active ? '1' : '0');
        }
        positionEditorHost(findBody());
      }

      /**
       * Align the stable Editor surface with the live Chat body.
       *
       * The Editor root is no longer a child of React's conversation body. It is
       * fixed-positioned beside that body and only its geometry follows body
       * replacements, which keeps Monaco, xterm and the file tree mounted.
       * @param {HTMLElement|null} body - current conversation body.
       * @returns {void}
       */
      function positionEditorHost(body) {
        if (host === null || body === null || !body.isConnected) return;
        const rect = body.getBoundingClientRect();
        const width = Math.max(0, rect.width * (1 - chatLayoutWidth(harnessCollapsed, chatWidth) / 100));
        host.style.position = 'fixed';
        host.style.left = `${rect.left}px`;
        host.style.top = `${rect.top}px`;
        host.style.width = `${width}px`;
        host.style.height = `${rect.height}px`;
        host.style.right = 'auto';
        host.style.bottom = 'auto';
      }

      /**
       * Follow the current Chat body without reinjecting into its React subtree.
       * @param {HTMLElement|null} body - current conversation body.
       * @returns {void}
       */
      function observeHostPosition(body) {
        positionEditorHost(body);
        if (body === hostPositionBody && hostPositionObserver !== null) return;
        hostPositionObserver?.disconnect();
        hostPositionObserver = null;
        hostPositionBody = body;
        if (body === null || typeof ResizeObserver === 'undefined') return;
        hostPositionObserver = new ResizeObserver(() => positionEditorHost(body));
        hostPositionObserver.observe(body);
        if (host?.parentElement !== null && host?.parentElement !== undefined) {
          hostPositionObserver.observe(host.parentElement);
        }
      }

      /**
       * Toggle the Harness chat column without changing the Editor workbench.
       * @returns {boolean} whether the chat is now collapsed.
       */
      function toggleHarnessLayout() {
        harnessCollapsed = !harnessCollapsed;
        applyChatLayout();
        return harnessCollapsed;
      }

      /**
       * Copy the vertical box of a real tab onto a strip button.
       *
       * The strip is a flex row whose tabs carry their own height and padding; a
       * bare 28px button therefore centred on the STRIP rather than on the labels
       * and its glyph sat ~4 CSS px too low (measured 39.5 vs 31.5 device px at 2x
       * DPR). Reading the sibling tab's computed box instead of hard-coding a
       * number keeps the button aligned when the host changes its tab metrics.
       * @param {HTMLElement} button - the button to align.
       * @param {HTMLElement} tablist - the strip that holds the real tabs.
       * @returns {void}
       */
      function matchTabMetrics(button, tablist) {
        if (tablist === null || tablist === undefined) return;
        const tab = tablist.querySelector('button[role="tab"]');
        if (tab === null) return;
        const style = window.getComputedStyle(tab);
        /* A tab's own box is 35px tall with `margin-top: -10px`: it overhangs the
           25px strip on purpose (that is what makes the whole tab a hit target).
           Adopting either the box or the margin would make our button overhang the
           same way, so the BUTTON copies the strip's own line box instead and only
           the icon inside it centres on the labels. */
        const row = tablist.parentElement;
        const rowStyle = row === null ? null : window.getComputedStyle(row);
        if (rowStyle !== null && rowStyle.alignItems !== '') button.style.alignSelf = rowStyle.alignItems;
        const painted = tab.querySelector('span');
        if (painted !== null) {
          const line = Number.parseFloat(window.getComputedStyle(painted).lineHeight);
          if (Number.isFinite(line) && line > 0) button.style.height = `${Math.round(line + 8)}px`;
        }
      }

      /**
       * Insert the Editor open/close button at the far right of the View tab strip.
       *
       * It is NOT a `role="tab"`: the strip's tab semantics belong to the View
       * switcher. The Editor itself has no injected tab here; it is opened from the
       * blank-session hero or the workspace menu.
       * @param {HTMLElement} tablist - the conversation tab strip.
       * @returns {void}
       */
      function ensureChatToggle(tablist) {
        const row = tablist.parentElement ?? tablist;
        if (chatToggle !== null && chatToggle.isConnected && chatToggle.parentElement === row) {
          applyChatLayout();
          return;
        }
        chatToggle?.remove();
        chatToggle = document.createElement('button');
        chatToggle.type = 'button';
        chatToggle.setAttribute('data-dsh-editor-chat-toggle', '');
        chatToggle.addEventListener('click', (event) => {
          event.preventDefault();
          event.stopPropagation();
          if (active) setActive(false);
          else openEditorSplit();
        });
        /* ABSOLUTE, pinned to the row's top-right — not `marginLeft: auto` inside the
           tablist. As an in-flow flex child of a `flex-wrap: wrap` strip, the button
           became the item that forced a new line: at ~380px the row doubled in height
           and the tabs re-flowed onto two lines (measured rowH 25 -> 60 -> 116).
           Out of flow it cannot affect the strip's wrapping at all.
           The row's own `padding-right` (see installStyles) reserves its space so the
           tabs never run underneath it — verified no tab/button overlap from 280px to
           1044px.
           28px wide is the hit target (the old `»` glyph at 11px was easy to miss);
           `matchTabMetrics` then adopts the strip's line box so the glyph centres on
           the labels instead of on the taller tab boxes. */
        chatToggle.style.cssText = 'position:absolute;right:6px;top:0;display:inline-flex;align-items:center;justify-content:center;width:28px;height:25px;border:none;border-radius:5px;background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer;padding:0;';
        chatToggle.setAttribute('data-dsh-editor-chat-toggle-icon', '');
        /* Parent = the tab ROW, which is `position: relative` and spans the full
           width; the tablist itself is only as wide as its tabs. */
        (tablist.parentElement ?? tablist).appendChild(chatToggle);
        /* Inherit the tab's vertical box so the glyph sits on the label band, not on
           the strip's box (see `matchTabMetrics`). */
        matchTabMetrics(chatToggle, tablist);
        applyChatLayout();
      }

      /**
       * Position the grab strip on the divider between the editor and the chat.
       *
       * The divider sits at `100% - width` of the conversation area; the strip is
       * 6px wide and centred on it, so the pointer does not need pixel accuracy.
       * @param {HTMLElement} container - the conversation body.
       * @returns {void}
       */
      function placeChatHandle(container) {
        if (chatHandle === null) return;
        const rect = container.getBoundingClientRect();
        const left = rect.width * (1 - chatLayoutWidth(harnessCollapsed, chatWidth) / 100);
        const next = `${Math.max(0, left - 4)}px`;
        /* Guarded: this runs from `sync`, which its own observer re-triggers. */
        if (chatHandle.style.left !== next) chatHandle.style.left = next;
      }

      /**
       * Build the drag handle once and attach it to the conversation body.
       * @param {HTMLElement} container - the conversation body.
       * @returns {void}
       */
      function ensureChatHandle(container) {
        if (chatHandle !== null && chatHandle.isConnected && chatHandle.parentElement === container) {
          placeChatHandle(container);
          return;
        }
        chatHandle?.remove();
        chatHandle = document.createElement('div');
        chatHandle.setAttribute('data-dsh-editor-chat-handle', '');
        chatHandle.setAttribute('title', t('editor.resizeChat'));
        chatHandle.addEventListener('mousedown', (event) => {
          event.preventDefault();
          const rect = container.getBoundingClientRect();
          const startX = event.clientX;
          const startWidth = chatWidth;
          chatHandle.setAttribute('data-dragging', '');
          /* IDEA shows the size it is dragging to; without it the only feedback is
             the layout reflowing, which is hard to judge at a glance. */
          const badge = document.createElement('div');
          badge.setAttribute('data-dsh-editor-chat-badge', '');
          badge.textContent = `${Math.round(chatWidth)}%`;
          container.appendChild(badge);
          const moveBadge = () => {
            badge.style.left = `${Math.max(0, rect.width * (1 - chatWidth / 100) - 22)}px`;
          };
          moveBadge();
          const onMove = (moveEvent) => {
            /* Dragging left widens the chat: the delta is measured from the right edge. */
            const delta = ((startX - moveEvent.clientX) / Math.max(1, rect.width)) * 100;
            applyChatWidth(startWidth + delta);
            placeChatHandle(container);
            moveBadge();
            /* Read the CLAMPED width back: `applyChatWidth` caps at 15%–45%. */
            badge.textContent = `${Math.round(chatWidth)}%`;
          };
          const onUp = () => {
            chatHandle?.removeAttribute('data-dragging');
            writeChatWidth(chatWidth);
            badge.remove();
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
          };
          window.addEventListener('mousemove', onMove);
          window.addEventListener('mouseup', onUp);
        });
        container.appendChild(chatHandle);
        placeChatHandle(container);
      }

      /**
       * Drive the chat scroller from wheel events the flow would otherwise swallow.
       *
       * The message nodes are interactive (buttons, code blocks) and take the wheel
       * before it bubbles to the scroll container, so the conversation cannot be
       * scrolled at all in the split. Listening in the WINDOW capture phase lets the
       * plugin move the scroller itself, then stop the event so nothing else reacts.
       * @param {HTMLElement} container - the conversation body.
       * @returns {void}
       */
      function ensureChatWheel(container) {
        /* Mark the CURRENT container so the handler can find it, but register the
           window listener only once (it is re-created with the controller). */
        container.setAttribute('data-dsh-chat-wheel', '');
        if (window.__dshEditorChatWheel === true) return;
        window.__dshEditorChatWheel = true;
        window.addEventListener('wheel', (event) => {
          /* Resolve the container at event time: the Session can remount it, and a
             captured node would stop matching after the first rebuild. */
          const container = document.querySelector('[data-dsh-chat-wheel]');
          if (container === null) return;
          if (event.ctrlKey || event.metaKey) return;
          if (!(event.target instanceof Element) || !container.contains(event.target)) return;
          /* Only the chat column may scroll, never the empty left area. */
          const seat = container.querySelector('[data-composer-seat]');
          const area = container.querySelector('.kiGsTW_viewArea');
          if (area === null) return;
          const rect = container.getBoundingClientRect();
          const columnLeft = rect.width * (1 - chatWidth / 100);
          const pointerX = event.clientX - rect.left;
          if (pointerX < columnLeft) return;
          if (seat !== null && seat.contains(event.target)) return;
          const max = area.scrollHeight - area.clientHeight;
          if (max <= 0) return;
          const next = wheelScrollTop({ scrollTop: area.scrollTop, deltaY: event.deltaY, max });
          if (next === null) return;
          event.preventDefault();
          event.stopPropagation();
          /* Apply on the NEXT frame as well: the host re-syncs the scroller to the
             bottom inside the same wheel turn, so a synchronous write is overwritten.
             Writing after that turn is what actually sticks. */
          area.scrollTop = next;
          window.requestAnimationFrame(() => {
            if (!area.isConnected) return;
            const live = area.scrollHeight - area.clientHeight;
            if (live <= 0) return;
            area.scrollTop = Math.max(0, Math.min(live, next));
          });
        }, { capture: true, passive: false });
      }

      /**
       * Keep the chat scrolled to its newest message while the user is following it.
       *
       * The conversation renders at offset 0 when the split opens, so a long history
       * starts at the TOP: the newest message (and the composer's context) is
       * off-screen and scrolling "up" looks like it does nothing. Pin after layout
       * settles, but only while the user is at the bottom — a deliberate scroll-up
       * must survive a new message.
       * @param {HTMLElement} container - the conversation body.
       * @returns {void}
       */
      function pinChatToBottom(container) {
        const area = container.querySelector('.kiGsTW_viewArea');
        if (area === null) return;
        const max = area.scrollHeight - area.clientHeight;
        if (max <= 0) return;
        /* The very first pin happens before the user could have scrolled, so skip the
           "is the user following?" test then; afterwards honour it. */
        const firstPin = container.getAttribute('data-dsh-chat-pinned') !== '1';
        if (!firstPin && !isNearBottom({ scrollTop: area.scrollTop, max })) return;
        area.scrollTop = max;
        if (firstPin) container.setAttribute('data-dsh-chat-pinned', '1');
      }

      /**
       * Show a "jump to newest" badge while the chat is scrolled away from the end.
       *
       * With the split open the chat column is narrow and often has no visible
       * scrollbar, so a user who scrolled up has no obvious way back. The badge
       * appears only when there is something to return to and is removed at the
       * bottom, keeping the column uncluttered.
       * @param {HTMLElement} container - the conversation body.
       * @returns {void}
       */
      function ensureChatJump(container) {
        const area = container.querySelector('.kiGsTW_viewArea');
        if (area === null) return;
        if (container.__dshEditorJump === true) {
          updateChatJump(container);
          return;
        }
        container.__dshEditorJump = true;
        /* Messages that appeared while the user was scrolled away. */
        container.__dshEditorJumpCount = 0;
        const badge = document.createElement('button');
        badge.type = 'button';
        badge.setAttribute('data-dsh-chat-jump', '');
        badge.style.cssText = 'position:absolute;right:14px;bottom:150px;z-index:5;display:none;align-items:center;gap:4px;height:26px;padding:0 10px;border:none;border-radius:13px;background:var(--dsw-alias-state-business-primary);color:#fff;font-size:11px;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,0.18);';
        badge.textContent = '↓';
        badge.addEventListener('click', (event) => {
          event.preventDefault();
          event.stopPropagation();
          const live = container.querySelector('.kiGsTW_viewArea');
          if (live !== null) live.scrollTop = live.scrollHeight - live.clientHeight;
          updateChatJump(container);
        });
        container.appendChild(badge);
        area.addEventListener('scroll', () => {
          /* Returning to the bottom clears the backlog: the badge's count is only
             meaningful while the newest message is out of view. */
          const liveMax = area.scrollHeight - area.clientHeight;
          if (isNearBottom({ scrollTop: area.scrollTop, max: liveMax })) container.__dshEditorJumpCount = 0;
          updateChatJump(container);
        }, { passive: true });
        /* A growing flow while scrolled away means messages arrived. */
        if (container.__dshEditorJumpObserver === undefined) {
          let lastHeight = area.scrollHeight;
          const observer = new MutationObserver(() => {
            const live = container.querySelector('.kiGsTW_viewArea');
            if (live === null) return;
            const height = live.scrollHeight;
            if (height > lastHeight) {
              const max = height - live.clientHeight;
              if (!isNearBottom({ scrollTop: live.scrollTop, max })) {
                container.__dshEditorJumpCount = (container.__dshEditorJumpCount ?? 0) + 1;
              }
            }
            lastHeight = height;
            updateChatJump(container);
          });
          observer.observe(area, { childList: true, subtree: true });
          container.__dshEditorJumpObserver = observer;
        }
        updateChatJump(container);
      }

      /**
       * Refresh the badge's visibility from the live scroll position.
       * @param {HTMLElement} container - the conversation body.
       * @returns {void}
       */
      function updateChatJump(container) {
        const badge = container.querySelector('[data-dsh-chat-jump]');
        const area = container.querySelector('.kiGsTW_viewArea');
        if (badge === null || area === null) return;
        const max = area.scrollHeight - area.clientHeight;
        /* `hasNew` is the scroll position itself here: any scrolled-away state means
           the newest message is out of view, which is exactly what the badge fixes. */
        const visible = jumpBadgeVisible({ scrollTop: area.scrollTop, max, hasNew: true });
        const display = visible ? 'inline-flex' : 'none';
        if (badge.style.display !== display) badge.style.display = display;
        /* Write only on a real change: this runs from a MutationObserver, and an
           unconditional `textContent` write is itself a mutation — it re-fires the
           observer forever and hangs the renderer. */
        const label = jumpBadgeLabel(container.__dshEditorJumpCount ?? 0);
        if (badge.textContent !== label) badge.textContent = label;
      }

      function ensureHost(body) {
        const hostParent = findHostParent();
        /* The host parent is React-owned and may be replaced while the session,
           view or conversation layout updates. Move the SAME host node back under
           the new parent so the React root, Monaco models and xterm instances stay
           mounted. Unmounting here made every parent reconciliation look like an
           Editor-wide blank/remount. */
        if (host !== null && root !== null) {
          if (hostParent !== null && host.parentElement !== hostParent) {
            hostParent.appendChild(host);
          }
          host.removeAttribute('data-dsh-editor-host-idle');
          observeHostPosition(body);
          return host;
        }
        for (const stale of document.querySelectorAll('[data-dsh-editor-host]')) {
          if (stale !== host) stale.remove();
        }
        destroyHost();
        if (hostParent === null) return null;
        host = document.createElement('div');
        host.setAttribute('data-dsh-editor-host', '');
        hostParent.appendChild(host);
        root = createRoot(host);
        root.render(React.createElement(EditorMount, {
          workspaceComponent: EditorWorkspace,
          t,
          workspaceId: editorWorkspaceId,
          initialHarnessCollapsed: harnessCollapsed,
          onToggleHarness: toggleHarnessLayout,
          onCloseEditor: () => setActive(false),
          onInsertHarnessReference: (request) => insertHarnessReferencesIntoComposer(ctx, request),
        }));
        observeHostPosition(body);
        return host;
      }

      /**
       * Hide the editor without unmounting it.
       *
       * Closing the split used to unmount the whole React root, so every re-open
       * re-ran `loadRoot` from an empty state: the tree rendered its placeholder,
       * then the listing, and the user saw the file list flash on each toggle.
       * Keeping the tree mounted (and only hidden) means re-opening shows exactly
       * the rows that were already there; the watcher keeps them current meanwhile.
       * @returns {void}
       */
      function idleHost() {
        if (host !== null) host.setAttribute('data-dsh-editor-host-idle', '');
      }

      /**
       * Remove the chat chrome the split injected into the conversation body.
       *
       * The wheel handler, the "jump to newest" badge and the drag strip all act on
       * the SPLIT's geometry (the configured chat column on the right). Leaving them attached
       * after the split closes would restrict wheel scrolling to that column and
       * float a badge over the full-width chat, so they go with the layout.
       * @param {HTMLElement} body - the conversation body.
       * @returns {void}
       */
      function detachChatChrome(body) {
        chatHandle?.remove();
        chatHandle = null;
        body.removeAttribute('data-dsh-chat-wheel');
        body.removeAttribute('data-dsh-chat-pinned');
        body.querySelector('[data-dsh-chat-jump]')?.remove();
        body.__dshEditorJumpObserver?.disconnect?.();
        body.__dshEditorJumpObserver = undefined;
        body.__dshEditorJump = false;
        body.__dshEditorJumpCount = 0;
      }

      function destroyHost() {
        chatHandle?.remove();
        chatHandle = null;
        hostPositionObserver?.disconnect();
        hostPositionObserver = null;
        hostPositionBody = null;
        if (root !== null) {
          try {
            root.unmount();
          } catch {
            /* a host removed by a Session switch can already be detached */
          }
          root = null;
        }
        if (host !== null) {
          host.remove();
          host = null;
        }
      }

      function setActive(next) {
        if (next) {
          /* The right column must always be the original Chat view, not Trajectory or another View. */
          const tablist = findTablist();
          if (tablist !== null) {
            const chatTab = [...tablist.querySelectorAll('button[role="tab"]')][0];
            if (chatTab !== undefined && chatTab.getAttribute('aria-selected') !== 'true') chatTab.click();
          }
        }
        active = next;
        const body = findBody();
        if (active) {
          applyChatWidth(readChatWidth());
          ensureHost(body);
          if (body !== null) {
            body.setAttribute('data-dsh-editor-active', '');
            ensureChatHandle(body);
            ensureChatWheel(body);
            ensureChatJump(body);
          }
          /* The flow mounts after the split's own first render, so keep trying for a
             short while (bounded) instead of pinning a scroller that is not there yet. */
          if (body !== null) {
            let pinTries = 0;
            const pinTick = () => {
              if (!body.isConnected) return;
              pinChatToBottom(body);
              pinTries += 1;
              if (pinTries < 40 && body.querySelector('.kiGsTW_viewArea') !== null
                && body.getAttribute('data-dsh-chat-pinned') !== '1') {
                window.requestAnimationFrame(pinTick);
              }
            };
            window.requestAnimationFrame(pinTick);
          }
        } else {
          body?.removeAttribute('data-dsh-editor-active');
          /* Hide, do not unmount: a remount re-runs the tree load from scratch and
             the list flashes on every toggle. The tree stays mounted and current. */
          idleHost();
          if (body !== null) detachChatChrome(body);
          /* Leaving the split restores the full-width chat layout. */
          document.body.style.removeProperty('--dsh-editor-chat-width');
          document.body.style.removeProperty('--dsh-editor-chat-offset');
          document.body.removeAttribute('data-dsh-editor-harness-collapsed');
        }
        applyHeroLaunchState();
      }

      /**
       * Reconcile the injected DOM with the host's current render.
       *
       * Driven by a MutationObserver on `document.body`, so everything it does must
       * be idempotent: any write that changes the DOM it just read re-fires the
       * observer, and an unconditional write loops forever (that hung the whole app
       * — the badge rewrote its label on every pass, each write scheduling the next).
       * A re-entrancy flag plus per-write "did it actually change" checks keep one
       * pass from scheduling itself.
       * @returns {void}
       */
      function sync() {
        if (syncing) return;
        syncing = true;
        try {
          syncInner();
        } finally {
          syncing = false;
        }
      }

      function syncInner() {
        const tablist = findTablist();
        if (tablist !== null) {
          ensureChatToggle(tablist);
        }
        /* Blank conversations have no View tab strip but still expose the hero
           options slot. Keep the Editor reachable before the first message. */
        ensureHeroLaunch();
        const body = findBody();
        if (active) {
          ensureHost(body);
          if (body !== null) {
            if (body.getAttribute('data-dsh-editor-active') === null) body.setAttribute('data-dsh-editor-active', '');
            ensureChatHandle(body);
            ensureChatJump(body);
          }
          return;
        }
        idleHost();
      }

      /**
       * Insert an "Editor" item at the top of the workspace menu.
       *
       * The workspace row's `...` menu is rendered by the host app, not by this
       * plugin, so the item is injected into the menu's DOM as it appears. Clicking
       * it opens the same split as the blank-session hero action (the implementation is reused,
       * not duplicated) and then closes the menu the way a real item would.
       * @param {HTMLElement} menu - the open `[role=menu]` element.
       * @returns {void}
       */
      function ensureWorkspaceEditorItem(menu) {
        const items = [...menu.querySelectorAll('button[role="menuitem"]')];
        if (items.length === 0) return;
        /* `textContent` of the whole item, not a `span:last-child` selector: the icon
           wrapper contains a nested span that also qualifies, and it is empty — the
           labels came back as ['', '', ''] and the menu was never recognised. */
        const labels = items.map((item) => (item.textContent ?? '').trim());
        if (!isWorkspaceMenu(labels)) return;
        if (menu.querySelector('[data-dsh-editor-menu-item]') !== null) return;
        const first = items[0];
        /* The host app owns this menu and re-renders it (a focus change is enough),
           which drops foreign children. Watch the menu and put the item back, using
           a flag so our own insertion does not trigger another round. */
        if (menu.__dshEditorWatch !== true) {
          menu.__dshEditorWatch = true;
          const watcher = new MutationObserver(() => {
            if (!menu.isConnected) {
              watcher.disconnect();
              return;
            }
            if (menu.querySelector('[data-dsh-editor-menu-item]') !== null) return;
            if (menu.__dshEditorBusy === true) return;
            menu.__dshEditorBusy = true;
            try {
              ensureWorkspaceEditorItem(menu);
            } finally {
              menu.__dshEditorBusy = false;
            }
          });
          watcher.observe(menu, { childList: true, subtree: true });
        }
        if (menu.__dshEditorBusy === true) return;
        /* Capture the row identity while the menu is being injected: the clone
           lives in a portal, so its own DOM ancestry no longer reaches the
           workspace tree row. */
        const workspaceId = lastWorkspaceId;
        /* Clone the first item so the injected row carries the host's own styling
           (surface colour, hover state, icon gutter) instead of looking foreign. */
        const clone = first.cloneNode(true);
        clone.setAttribute('data-dsh-editor-menu-item', '');
        clone.removeAttribute('data-dsh-automatic-focus');
        /* Replace the deepest text-bearing span (the label), leaving the icon alone. */
        const label = [...clone.querySelectorAll('span')].reverse().find((node) => node.children.length === 0);
        if (label !== undefined) label.textContent = VIEW_LABEL;
        const icon = clone.querySelector('svg');
        if (icon !== null) {
          /* A split-panel glyph matches "open the editor beside the chat". The sprite
             is checked first: retargeting to a missing symbol renders nothing. */
          const available = new Set([...document.querySelectorAll('symbol[id]')].map((symbol) => symbol.id));
          const chosen = pickMenuIcon(
            ['dsw-icon-panel-left-outline-regular', 'dsw-icon-code-outline-regular', 'dsw-icon-edit-outline-regular'],
            available,
          );
          if (chosen !== null && document.querySelector(`#${chosen}`) !== null) {
            icon.setAttribute('data-icon', chosen);
            const use = icon.querySelector('use');
            use?.setAttribute('href', `#${chosen}`);
          }
        }
        first.parentElement?.insertBefore(clone, first);
        clone.addEventListener('click', (event) => {
          event.preventDefault();
          event.stopPropagation();
          /* This entry point is for focused editor work: reclaim the host
             sidebar before the split measures its file tree and code surface. */
          collapseConversationSidebar();
          openEditorSplit(workspaceId);
          document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        });

        /* Keyboard: the host drives the menu with its own item array, which does not
           contain our row, so ↑/↓ step over it. Handle only the two boundary moves
           and leave everything else to the host. */
        if (menu.__dshEditorKeys !== true) {
          menu.__dshEditorKeys = true;
          /* `capture` alone was not enough: the host registers its handler on the
             menu too and React's delegated listener runs first. Listen on the window
             in the capture phase so this sees the key before anything else. */
          window.addEventListener('keydown', (event) => {
            if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp' && event.key !== 'Enter') return;
            const rows = [...menu.querySelectorAll('button[role="menuitem"]')];
            if (rows.length === 0) return;
            const selfIndex = rows.findIndex((row) => row.hasAttribute('data-dsh-editor-menu-item'));
            if (selfIndex < 0) return;
            const activeIndex = rows.findIndex((row) => row === document.activeElement);
            if (event.key === 'Enter') {
              if (activeIndex === selfIndex) {
                event.preventDefault();
                event.stopPropagation();
                clone.click();
              }
              return;
            }
            const target = menuArrowTarget(activeIndex, event.key, selfIndex);
            if (target === null) return;
            event.preventDefault();
            event.stopPropagation();
            const next = rows[target];
            if (next === undefined) return;
            next.focus();
            /* The host may still move focus after its own handler runs; re-assert on
               the next frame so a boundary step is not immediately undone. */
            window.requestAnimationFrame(() => {
              if (menu.isConnected && document.activeElement !== next) next.focus();
            });
          }, true);
        }
      }

      /* A click on any real View tab leaves the editor split and lets that View render normally. */
      function onTabClick(event) {
        const target = event.target;
        if (!(target instanceof Element)) return;
        /* Tool-window tabs inside our own host also carry role="tab"; they must not close the split. */
        if (target.closest('[data-dsh-editor-host]') !== null) return;
        const tab = target.closest('button[role="tab"]');
        if (tab === null) return;
        if (active) setActive(false);
      }

      /**
       * Remember which workspace row opened the host menu.
       *
       * DSH's menu is rendered in a portal and clones do not carry React props,
       * so the workspace id has to be captured from the originating tree row.
       * Pointer events cover the visible `...` button and row context menu;
       * keyboard activation is handled by reading the focused row.
       * @param {Event} event - pointer, click, or key event.
       * @returns {void}
       */
      function rememberWorkspaceRow(event) {
        const target = event.target instanceof Element ? event.target : document.activeElement;
        if (!(target instanceof Element)) return;
        const row = target.closest('[data-row-key^="workspace:"]');
        if (row === null) return;
        const key = row.getAttribute('data-row-key') ?? '';
        if (key.startsWith('workspace:')) lastWorkspaceId = key.slice('workspace:'.length);
      }

      /**
       * Apply the workspace-menu enhancement to any menu the host just opened.
       * @returns {void}
       */
      function enhanceMenus() {
        for (const menu of document.querySelectorAll('[role="menu"]')) {
          if (menu instanceof HTMLElement) ensureWorkspaceEditorItem(menu);
        }
      }

      /* The host renders the workspace menu asynchronously and re-mounts it (a new
         element, not just new children), so a single observer callback is not
         enough: keep rescanning for a short while after any mutation while a menu
         is on screen. Bounded, so an idle page costs nothing. */
      let menuRescan = 0;
      function scheduleMenuRescan() {
        if (menuRescan !== 0) return;
        let frames = 0;
        const tick = () => {
          menuRescan = 0;
          if (document.querySelector('[role="menu"]') === null) return;
          enhanceMenus();
          frames += 1;
          if (frames < 30) {
            menuRescan = window.requestAnimationFrame(tick);
          }
        };
        frames = 0;
        menuRescan = window.requestAnimationFrame(tick);
      }

      const observer = new MutationObserver(() => {
        if (maintenanceTimer !== 0) return;
        const wait = maintenanceDelay(lastMaintenanceAt, performance.now(), 80);
        maintenanceTimer = window.setTimeout(() => {
          maintenanceTimer = 0;
          lastMaintenanceAt = performance.now();
          sync();
          enhanceMenus();
          if (document.querySelector('[role="menu"]') !== null) scheduleMenuRescan();
        }, wait);
      });
      const onWindowError = (event) => {
        if (event.message === 'ResizeObserver loop completed with undelivered notifications.') return;
        if (!active && host === null) return;
        reportEditorDiagnostic('window-error', {
          message: event.message,
          filename: event.filename,
          line: event.lineno,
          column: event.colno,
          stack: event.error?.stack ?? '',
          active,
          hostChildCount: host?.childElementCount ?? 0,
          recentActions: editorActionRing.slice(-12),
        }, 'error');
      };
      const onUnhandledRejection = (event) => {
        if (!active && host === null) return;
        const reason = String(event.reason);
        const stack = event.reason?.stack ?? '';
        if (isMonacoCancellation(event.reason, stack)) {
          event.preventDefault();
          return;
        }
        reportEditorDiagnostic('unhandled-rejection', {
          reason,
          stack,
          active,
          hostChildCount: host?.childElementCount ?? 0,
          recentActions: editorActionRing.slice(-12),
        }, 'error');
      };
      observer.observe(document.body, { childList: true, subtree: true });
      window.addEventListener('error', onWindowError);
      window.addEventListener('unhandledrejection', onUnhandledRejection);
      document.addEventListener('click', recordDiagnosticAction, true);
      document.addEventListener('keydown', recordDiagnosticAction, true);
      document.addEventListener('pointerdown', rememberWorkspaceRow, true);
      document.addEventListener('click', rememberWorkspaceRow, true);
      document.addEventListener('keydown', rememberWorkspaceRow, true);
      document.addEventListener('click', onTabClick, true);
      sync();

      ctx.effect(
        () => () => {
          observer.disconnect();
          window.removeEventListener('error', onWindowError);
          window.removeEventListener('unhandledrejection', onUnhandledRejection);
          document.removeEventListener('click', recordDiagnosticAction, true);
          document.removeEventListener('keydown', recordDiagnosticAction, true);
          if (maintenanceTimer !== 0) {
            window.clearTimeout(maintenanceTimer);
            maintenanceTimer = 0;
          }
          document.removeEventListener('pointerdown', rememberWorkspaceRow, true);
          document.removeEventListener('click', rememberWorkspaceRow, true);
          document.removeEventListener('keydown', rememberWorkspaceRow, true);
          document.removeEventListener('click', onTabClick, true);
          const body = findBody();
          if (body !== null) detachChatChrome(body);
          destroyHost();
          chatToggle?.remove();
          chatToggle = null;
          heroLaunch?.remove();
          heroLaunch = null;
          document.body.style.removeProperty('--dsh-editor-chat-width');
          document.body.style.removeProperty('--dsh-editor-chat-offset');
          document.body.removeAttribute('data-dsh-editor-harness-collapsed');
        },
        'dsh-editor: split layout',
      );
    }

    /**
     * @param {import('@deepseek-ai/cordis').Context} ctx - client root context.
     */
    function apply(ctx) {
      try {
        installStyles();
        ctx.effect(
          () =>
            ctx.locale.register(NS, {
              zh: flattenDictionary(zh),
              en: flattenDictionary(en),
            }),
          'dsh-editor: dictionaries',
        );
        createController(ctx);
      } catch (error) {
        console.error('dsh-editor: apply failed', error);
        throw error;
      }
    }
