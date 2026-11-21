/* injected-css.ts: dsh-editor client styles and shared surface helpers. Generated into lib/client.js by scripts/build-client.mjs. */

import { basename } from './editor-core';
import {
  EDITOR_BASE_FONT_WEIGHT,
  EDITOR_FONT_SIZE_SCALE,
  EDITOR_GUTTER_LAYOUT,
  EDITOR_LANGUAGE_FONT_FALLBACKS,
  EDITOR_LATIN_FONT,
  EDITOR_SURFACE_BACKGROUNDS,
  EDITOR_TERMINAL_FONT_STACK,
} from './components/editor/editor-style-model';
import { ideaLightSemanticDecorationRules } from './components/editor/editor-theme-model';
interface TreeLoadingState {
  loading: boolean;
  rowCount: number;
}

interface ScrollRestoreState {
  remembered: number | null | undefined;
  max: number;
}

interface ScrollMetrics {
  scrollTop: number;
  max: number;
}

interface JumpBadgeState extends ScrollMetrics {
  hasNew: boolean;
}

interface WheelScrollState extends ScrollMetrics {
  deltaY: number;
}

interface ShiftWheelState {
  shiftKey?: boolean;
  deltaY?: number;
  scrollLeft?: number;
  scrollWidth?: number;
  clientWidth?: number;
}

interface ShiftWheelEvent {
  currentTarget?: HTMLElement | null;
  shiftKey?: boolean;
  deltaY?: number;
  preventDefault(): void;
}

interface TerminalShortcutState {
  open: boolean;
  restoreFocus: boolean;
  focus: boolean;
}

interface EditorCaret {
  lineNumber: number;
  column: number;
}

interface ReferenceEntry {
  path: string;
  isDirectory?: boolean;
}

interface ReferenceEditor {
  getPosition?: () => EditorCaret | null;
}

interface CopyReferenceMenuOptions {
  entries?: ReferenceEntry[] | null;
  root: string;
  t: (key: string, params?: Record<string, unknown>) => string;
  editor?: ReferenceEditor | null;
  editorPath?: string | null;
  writeText?: (value: string) => unknown;
}

interface ReferenceMenuItem {
  id: string;
  label: string;
  disabled: boolean;
  run: () => void;
}

type MenuArrowKey = 'ArrowDown' | 'ArrowUp';

export function installStyles(): void {
  const id = 'dsh-editor-styles';
  if (document.getElementById(id) !== null) return;
  const style = document.createElement('style');
  style.id = id;
  style.textContent = [
    ':root {',
    `  --dsh-editor-font-ui: ${EDITOR_LATIN_FONT};`,
    `  --dsh-editor-font-code: ${EDITOR_LATIN_FONT};`,
    `  --dsh-editor-font-terminal: ${EDITOR_TERMINAL_FONT_STACK};`,
    `  --dsh-editor-font-weight: ${EDITOR_BASE_FONT_WEIGHT};`,
    `  --dsh-editor-font-size-micro: ${EDITOR_FONT_SIZE_SCALE.micro}px;`,
    `  --dsh-editor-font-size-caption: ${EDITOR_FONT_SIZE_SCALE.caption}px;`,
    `  --dsh-editor-font-size-label: ${EDITOR_FONT_SIZE_SCALE.label}px;`,
    `  --dsh-editor-font-size-body: ${EDITOR_FONT_SIZE_SCALE.body}px;`,
    `  --dsh-editor-font-size-control: ${EDITOR_FONT_SIZE_SCALE.control}px;`,
    `  --dsh-editor-font-size-emphasis: ${EDITOR_FONT_SIZE_SCALE.emphasis}px;`,
    `  --dsh-editor-font-size-display: ${EDITOR_FONT_SIZE_SCALE.display}px;`,
    `  --dsh-editor-project-background: ${EDITOR_SURFACE_BACKGROUNDS.light.code};`,
    `  --dsh-editor-tool-window-background: ${EDITOR_SURFACE_BACKGROUNDS.light.toolWindow};`,
    `  --dsh-editor-code-background: ${EDITOR_SURFACE_BACKGROUNDS.light.code};`,
    '}',
    '@media (prefers-color-scheme: dark) {',
    '  :root {',
    `    --dsh-editor-project-background: ${EDITOR_SURFACE_BACKGROUNDS.dark.code};`,
    `    --dsh-editor-tool-window-background: ${EDITOR_SURFACE_BACKGROUNDS.dark.toolWindow};`,
    `    --dsh-editor-code-background: ${EDITOR_SURFACE_BACKGROUNDS.dark.code};`,
    '  }',
    '}',
    ':root:lang(zh) {',
    `  --dsh-editor-font-ui: ${EDITOR_LANGUAGE_FONT_FALLBACKS.zh};`,
    `  --dsh-editor-font-code: ${EDITOR_LANGUAGE_FONT_FALLBACKS.zh};`,
    '}',
    ':root:lang(ja) {',
    `  --dsh-editor-font-ui: ${EDITOR_LANGUAGE_FONT_FALLBACKS.ja};`,
    `  --dsh-editor-font-code: ${EDITOR_LANGUAGE_FONT_FALLBACKS.ja};`,
    '}',
    ':root:lang(ko) {',
    `  --dsh-editor-font-ui: ${EDITOR_LANGUAGE_FONT_FALLBACKS.ko};`,
    `  --dsh-editor-font-code: ${EDITOR_LANGUAGE_FONT_FALLBACKS.ko};`,
    '}',
    ...ideaLightSemanticDecorationRules(),
    /* DSH's chat attachment drag overlay blurs the whole page. While a file
           is over the Editor workspace, the Project tree owns that drop, so the
           unrelated attachment mask must not obscure the destination. */
    'body.dsh-editor-file-drag > [role="status"][class*="_mask"] { display: none !important; }',
    /* The Editor toggle is absolutely positioned in the tab ROW (see
           `ensureChatToggle`), so the row must reserve its 28px + margin here — a
           free-floating button would sit on top of the last tab when the strip wraps.
           `box-sizing: border-box` matters because the row is `width: 100%`. */
    '[data-conversation-tabs] { padding-right: 40px; box-sizing: border-box; }',
    /* The row is our button's containing block. It already carries
           `position: relative` in the host CSS; this makes that contract explicit so
           a host restyle cannot turn our absolute button loose on the page. */
    '[data-conversation-tabs] { position: relative; }',
    /* The chat column takes the configured right-hand width; the editor host
           fills the remaining majority.
           The slot wrapper is display:contents, so the width belongs to its two
           layout children: the View area and the composer seat. */
    '[data-dsh-editor-active] [data-slot="conversation.session"] > div {',
    '  width: var(--dsh-editor-chat-width, 35%) !important;',
    /* NOT `calc(100% - <the same %>)`: a percentage margin resolves against the
           containing block, so the column's own `width: 25%` and its `margin-left`
           percentage made the container's width depend on its child's — in a
           shrink-to-fit ancestor (a flex/grid item, which the session area is) the
           browser resolves that circular pair over several passes and the box GROWS
           a little on every re-render. That is the "tab row keeps getting wider"
           symptom: measured 9px of growth per pass at 25%. A second variable
           (`--dsh-editor-chat-offset`, set in JS from the same number) keeps the
           placement with no percentage margin at all. */
    '  margin-left: var(--dsh-editor-chat-offset, 65%) !important;',
    '  min-width: 0 !important;',
    '  box-sizing: border-box !important;',
    '}',
    /* The composer is anchored to the BOTTOM of the visible chat column. It used to
           inherit the `sticky; bottom: 0` the host gives it, which stuck the input box
           to the container's TOP (y=31, over the editor) as soon as the conversation
           ran past one screen. */
    '[data-dsh-editor-active] [data-composer-seat] {',
    '  position: absolute !important;',
    '  bottom: 0 !important;',
    '  right: 0 !important;',
    '  width: var(--dsh-editor-chat-width, 35%) !important;',
    '  margin-left: 0 !important;',
    '  z-index: 4 !important;',
    '}',
    '[data-dsh-editor-active] [data-conversation-scroll] {',
    '  overflow: hidden !important;',
    '  position: relative !important;',
    '  z-index: 1 !important;',
    '  pointer-events: none !important;',
    '}',
    /* The conversation slot used to measure 0px tall here (only its child View
           area had a height), so the message list overflowed visibly and the wheel
           found no scroller: the chat could not be scrolled at all. Give every
           wrapper in the chat column a full-height chain. */
    '[data-dsh-editor-active] [data-conversation-scroll] [data-slot="conversation.session"] {',
    '  height: 100% !important;',
    '}',
    '[data-dsh-editor-active] [data-conversation-scroll] [data-slot="conversation.session"] > div {',
    '  height: 100% !important;',
    '  min-height: 0 !important;',
    '}',
    /* The scroll body spans the WHOLE conversation area (1218px here), of which the
           editor owns the left majority. It must therefore stay transparent to the pointer,
           or it swallows every click meant for the editor; the chat column's own
           subtree re-enables events below. */
    /* The View area is the host's own viewport for the conversation: it is the
           element that actually has the height, so the scrolling belongs here. The
           outer body must NOT scroll — it is `position: relative`, and turning it into
           a scroll container also makes it the containing block for the composer's
           `sticky; bottom: 0`, which glued the input box to the container's TOP
           (y=31, over the editor) once a conversation ran past one screen. */
    /* The composer is a sticky overlay at the bottom of the column, so without this
           the last lines ("深度搜索中，用时 3 秒") hide BEHIND it. The padding matches the
           seat's measured height; content scrolls clear of the input box. */
    '[data-dsh-editor-active] [data-conversation-scroll] .tnXGgG_column {',
    '  padding-bottom: 132px !important;',
    '}',
    '[data-dsh-editor-active] [data-conversation-scroll] .kiGsTW_viewArea {',
    /* The shorthand too: the host sets `overflow: hidden` on this class, and a
           longhand-only override loses to it when both are !important. */
    '  overflow: auto !important;',
    '  overflow-y: auto !important;',
    '  overscroll-behavior: contain;',
    '}',
    /* The column opens events up so the wheel reaches it; the outer body stays
           transparent so editor and tree clicks pass through. */
    '[data-dsh-editor-active] [data-conversation-scroll] [data-slot="conversation.session"] > div {',
    '  pointer-events: auto !important;',
    '}',
    /* The Chat column and composer keep receiving input; the empty left area lets clicks reach the editor host. */
    '[data-dsh-editor-active] [data-conversation-scroll] [data-slot="conversation.session"] *',
    ',',
    '[data-dsh-editor-active] [data-conversation-scroll] [data-composer-seat],',
    '[data-dsh-editor-active] [data-conversation-scroll] [data-composer-seat] * {',
    '  pointer-events: auto !important;',
    '}',
    /* The placeholder is an absolutely positioned layer over the contenteditable
           input. It must come AFTER the `*` rule above: both are !important, so the
           later one wins, and with `auto` a click on the input hit the placeholder
           instead of placing the caret. */
    '[data-dsh-editor-active] [data-composer-seat] [data-composer-placeholder] {',
    '  pointer-events: none !important;',
    '}',
    /* The scroll body itself keeps a scrollbar, so the wheel works even when the
           pointer is over a gap between bubbles. */
    '[data-dsh-editor-active] [data-conversation-scroll] {',
    '  overscroll-behavior: contain;',
    '}',
    /* The composer seat must be pinned to the CONVERSATION AREA, not to the
           scroller: once the scroll body became `overflow-y: auto` it also became the
           containing block for the seat's `position: sticky; bottom: 0`, so any
           conversation longer than a screen stuck the input box to the container's TOP
           (measured at y=31, on top of the editor). Absolute positioning against the
           scroll region keeps it at the bottom in every case. */
    '[data-dsh-editor-active] [data-width-handle] { display: none !important; }',
    /* The chat column's drag handle: an 8px grab strip with a visible
           2px resting line, so the draggable edge is legible without hovering. */
    '[data-dsh-editor-chat-handle] {',
    '  position: absolute;',
    '  top: 0;',
    '  bottom: 0;',
    '  width: 8px;',
    '  z-index: 3;',
    '  cursor: col-resize;',
    '  background: linear-gradient(to right, transparent 2px, var(--dsw-alias-border-l3) 2px 4px, transparent 4px);',
    '}',
    '[data-dsh-editor-chat-badge] {',
    '  position: absolute;',
    '  top: 12px;',
    '  z-index: 4;',
    '  padding: 1px 6px;',
    '  border-radius: 4px;',
    '  background: var(--dsw-alias-state-business-primary);',
    '  color: #fff;',
    '  font: 600 var(--dsh-editor-font-size-label, 11px)/1.6 var(--dsh-editor-font-code, "Trebuchet MS", "SF Pro Text", "Segoe UI", sans-serif);',
    '  pointer-events: none;',
    '}',
    '[data-dsh-editor-chat-handle]:hover,',
    '[data-dsh-editor-chat-handle][data-dragging] {',
    '  background: color-mix(in srgb, var(--dsw-alias-state-business-primary) 55%, transparent);',
    '}',
    /* Harness minimize keeps the Editor mounted but gives the code surface the
           full conversation width. The saved chat width remains untouched for the
           restore click. */
    '[data-dsh-editor-harness-collapsed] [data-dsh-editor-active] [data-conversation-scroll] [data-slot="conversation.session"] > div {',
    '  display: none !important;',
    '}',
    '[data-dsh-editor-harness-collapsed] [data-dsh-editor-active] [data-composer-seat] {',
    '  display: none !important;',
    '}',
    '[data-dsh-editor-harness-collapsed] [data-dsh-editor-active] [data-dsh-editor-chat-handle] {',
    '  display: none !important;',
    '}',
    /* The root lives under the stable conversation layout parent instead of
           React's replaceable chat body. Its inline geometry follows the live body
           rectangle; fixed positioning keeps it independent of that subtree. */
    '[data-dsh-editor-host] {',
    '  position: fixed;',
    '  top: 0;',
    '  right: auto;',
    '  bottom: auto;',
    '  left: 0;',
    '  width: 100%;',
    '  height: 100%;',
    '  z-index: 1;',
    '  display: flex;',
    '  min-width: 0;',
    '  min-height: 0;',
    '  overflow: hidden;',
    '  background: var(--dsw-alias-bg-base);',
    '  border-right: 0.5px solid var(--dsw-alias-border-l3);',
    '}',
    /* Trebuchet MS is the requested editor default. Apply it at the workspace
           boundary, including native form controls that otherwise keep the host
           button/input font. Monaco is configured separately because it draws on
           canvas rather than inheriting CSS. */
    '[data-dsh-editor-workspace],',
    '[data-dsh-editor-workspace] button,',
    '[data-dsh-editor-workspace] input,',
    '[data-dsh-editor-workspace] textarea,',
    '[data-dsh-editor-workspace] select {',
    '  font-family: var(--dsh-editor-font-ui, "Trebuchet MS", "SF Pro Text", "Segoe UI", sans-serif) !important;',
    '}',
    '[data-dsh-editor-workspace] {',
    '  font-weight: var(--dsh-editor-font-weight, 500);',
    '}',
    '[data-dsh-editor-workspace] button,',
    '[data-dsh-editor-workspace] input,',
    '[data-dsh-editor-workspace] textarea,',
    '[data-dsh-editor-workspace] select {',
    '  font-weight: inherit;',
    '}',
    /* Code coloring must never rely on weight: IDEA Light parity is carried by
           color and italic only. This also blocks bold inherited from Monaco's
           built-in theme for token types not explicitly listed in our rules. */
    '[data-dsh-editor-workspace] .monaco-editor .view-lines,',
    '[data-dsh-editor-workspace] .monaco-editor .view-lines .view-line,',
    '[data-dsh-editor-workspace] .monaco-editor .view-lines .view-line *,',
    '[data-dsh-editor-workspace] .monaco-editor .margin-view-overlays,',
    '[data-dsh-editor-workspace] .monaco-editor .margin-view-overlays *,',
    '[data-dsh-editor-workspace] .dsh-editor-code-preview-line,',
    '[data-dsh-editor-workspace] .dsh-editor-code-preview-line *,',
    '[data-dsh-editor-workspace] .dsh-editor-annotate-code,',
    '[data-dsh-editor-workspace] .dsh-editor-annotate-code * {',
    `  font-weight: ${EDITOR_BASE_FONT_WEIGHT} !important;`,
    '}',
    /* xterm owns its hidden helper textarea for composition and caret
           placement. The workspace-wide input family must not bleed into that
           terminal-specific domain. */
    '[data-dsh-editor-workspace] .xterm,',
    '[data-dsh-editor-workspace] .xterm .xterm-helper-textarea {',
    `  font-family: var(--dsh-editor-font-terminal, ${EDITOR_TERMINAL_FONT_STACK}) !important;`,
    '}',
    /* Closing the split HIDES the mounted tree instead of unmounting it, so
           re-opening does not re-read the disk and flash the list.
           `visibility` (not `display`) keeps the box laid out, which matters for
           Monaco and xterm: both size themselves from their container, and a box
           that collapses to 0×0 has to be re-measured on the way back. Hidden boxes
           also stop hit-testing, so the restored full-width chat gets the clicks. */
    '[data-dsh-editor-host][data-dsh-editor-host-idle] {',
    '  visibility: hidden;',
    '  pointer-events: none;',
    '}',
    /* While the split is open the real Chat tab stays selected but must not look active. */
    '[data-dsh-editor-active] [data-conversation-tabs] button[role="tab"][aria-selected="true"] {',
    '  color: var(--dsw-alias-label-tertiary) !important;',
    '}',
    '[data-dsh-editor-active] [data-conversation-tabs] button[role="tab"][aria-selected="true"]::after {',
    '  background: transparent !important;',
    '}',
    /* Hover states live in CSS so inline layout styles stay small. */
    '.dsh-editor-toolbar-button:hover:enabled { background: var(--dsw-alias-interactive-bg-hover); }',
    '.dsh-editor-toolbar-button:focus-visible { outline: 1px solid var(--dsw-alias-state-business-primary); outline-offset: 1px; }',
    '.dsh-editor-branch-button:focus-visible {',
    '  outline: 1px solid var(--dsw-alias-state-business-primary) !important;',
    '  outline-offset: 1px !important;',
    '  border-radius: 9px;',
    '}',
    '.dsh-editor-terminal-tab:focus-visible,',
    '.dsh-editor-terminal-overflow:focus-visible,',
    '.dsh-editor-terminal-tab > button:focus-visible {',
    '  outline: 1px solid var(--dsw-alias-state-business-primary) !important;',
    '  outline-offset: -2px !important;',
    '  border-radius: 4px;',
    '}',
    '.dsh-editor-project-root-button:hover, .dsh-editor-project-view-button:hover { background: var(--dsw-alias-interactive-bg-hover); }',
    '.dsh-editor-project-root-button:focus-visible, .dsh-editor-project-view-button:focus-visible { outline: 1px solid var(--dsw-alias-state-business-primary); outline-offset: 1px; }',
    '[data-dsh-editor-tool-window-resizer]:focus-visible,',
    '[data-dsh-dock-resize-handle]:focus-visible {',
    '  outline: 1px solid var(--dsw-alias-state-business-primary) !important;',
    '  outline-offset: -1px !important;',
    '}',
    '[data-dsh-terminal-split-handle]:focus-visible {',
    '  outline: 1px solid var(--dsw-alias-state-business-primary) !important;',
    '  outline-offset: -1px !important;',
    '}',
    '.dsh-editor-stripe-item:hover { background: var(--dsw-alias-interactive-bg-hover); }',
    '.dsh-editor-stripe-close:focus-visible {',
    '  outline: 1px solid var(--dsw-alias-state-business-primary) !important;',
    '  outline-offset: -3px !important;',
    '  background: var(--dsw-alias-interactive-bg-hover) !important;',
    '}',
    '.dsh-editor-commit-mode-tab:focus-visible {',
    '  outline: 1px solid var(--dsw-alias-state-business-primary) !important;',
    '  outline-offset: -2px !important;',
    '}',
    '.dsh-editor-graph-fold-toggle:focus-visible { outline: 1px solid var(--dsw-alias-state-business-primary); outline-offset: 1px; }',
    '.dsh-editor-graph-ref { display: inline-block !important; min-width: 0 !important; max-width: 100% !important; overflow: hidden !important; text-overflow: ellipsis !important; }',
    '.dsh-editor-graph-ref:focus-visible { outline: 1px solid var(--dsw-alias-state-business-primary); outline-offset: 1px; }',
    '.dsh-editor-graph-scope-label { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }',
    '.dsh-editor-visually-hidden { position: absolute !important; width: 1px !important; height: 1px !important; padding: 0 !important; margin: -1px !important; overflow: hidden !important; clip: rect(0, 0, 0, 0) !important; white-space: nowrap !important; border: 0 !important; }',
    '.dsh-editor-graph-scope-clear { display: inline-flex; align-items: center; justify-content: center; min-width: 16px; min-height: 16px; padding: 0 !important; border-radius: 3px; }',
    '.dsh-editor-graph-scope-clear:hover { background: var(--dsw-alias-interactive-bg-hover); color: var(--dsw-alias-label-primary); }',
    '.dsh-editor-graph-scope-clear:active { background: var(--dsw-alias-button-ghost-active-fill); }',
    '.dsh-editor-graph-scope-clear:focus-visible { outline: 1px solid var(--dsw-alias-state-business-primary); outline-offset: 1px; border-radius: 3px; }',
    '.dsh-editor-log-actions { display: flex; align-items: center; gap: 4px; flex: none; }',
    '.dsh-editor-log-retry { display: inline-flex; align-items: center; justify-content: center; min-width: 64px; }',
    '.dsh-editor-log-retry[aria-disabled="true"] { opacity: 0.55; cursor: default; }',
    '[data-dsh-log-panel] { container-type: inline-size; }',
    '@container (max-width: 520px) {',
    '  .dsh-editor-log-toolbar { height: auto !important; min-height: 26px; flex-wrap: wrap !important; padding-top: 1px !important; padding-bottom: 1px !important; row-gap: 2px !important; }',
    '  .dsh-editor-log-title { display: none !important; }',
    '  .dsh-editor-log-title[data-dsh-log-filter-active] { display: inline-flex !important; order: 0; flex: 1 0 100% !important; max-width: none !important; height: 14px; margin-right: 0 !important; }',
    '  .dsh-editor-log-branch { order: 1; flex: 1 1 72px !important; max-width: none !important; }',
    '  .dsh-editor-log-actions { order: 2; }',
    '  .dsh-editor-log-scope { order: 3; flex: 1 1 80px !important; min-width: 0 !important; max-width: 160px !important; }',
    '  .dsh-editor-log-author { order: 4; flex: 1 1 80px !important; width: auto !important; min-width: 40px !important; }',
    '  .dsh-editor-log-spacer { display: none !important; }',
    '}',
    '@media (forced-colors: active) {',
    '  .dsh-editor-log-scope { color: CanvasText !important; background: Canvas !important; border-color: CanvasText !important; }',
    '  .dsh-editor-toolbar-button:focus-visible { outline-color: Highlight !important; }',
    '  .dsh-editor-branch-button:focus-visible { outline-color: Highlight !important; }',
    '  .dsh-editor-terminal-tab:focus-visible,',
    '  .dsh-editor-terminal-overflow:focus-visible,',
    '  .dsh-editor-terminal-tab > button:focus-visible { outline-color: Highlight !important; }',
    '  .dsh-editor-graph-scope-clear { color: CanvasText !important; }',
    '  .dsh-editor-graph-scope-clear:hover { background: ButtonFace !important; color: ButtonText !important; }',
    '  .dsh-editor-graph-scope-clear:active { background: Highlight !important; color: HighlightText !important; }',
    '  .dsh-editor-graph-scope-clear:focus-visible { outline-color: Highlight !important; }',
    '  [data-dsh-editor-tool-window-resizer]:focus-visible,',
    '  [data-dsh-dock-resize-handle]:focus-visible { outline-color: Highlight !important; }',
    '  [data-dsh-terminal-split-handle]:focus-visible { outline-color: Highlight !important; }',
    '}',
    '@media (prefers-reduced-motion: reduce) {',
    '  .dsh-editor-log-toolbar, .dsh-editor-log-scope, .dsh-editor-graph-scope-clear { transition: none !important; animation: none !important; }',
    '}',
    '[data-dsh-log-panel] > div:first-child { overflow: clip !important; }',
    '.dsh-editor-template-chip { background: transparent; appearance: none; -webkit-appearance: none; }',
    '.dsh-editor-template-chip:hover:enabled { background: var(--dsw-alias-interactive-bg-hover); border-color: var(--dsw-alias-state-business-primary) !important; }',
    '.dsh-editor-template-chip:focus-visible {',
    '  outline: 1px solid var(--dsw-alias-state-business-primary);',
    '  outline-offset: 1px;',
    '}',
    '[data-dsh-change-directory]:focus-visible {',
    '  outline: 1px solid var(--dsw-alias-state-business-primary) !important;',
    '  outline-offset: -1px !important;',
    '}',
    '.dsh-editor-tree-row:hover { background: var(--dsw-alias-interactive-bg-hover); }',
    '.dsh-editor-tree-icon-search-excluded { opacity: 0.55; filter: grayscale(1); }',
    '@media (prefers-color-scheme: dark) {',
    '  .dsh-editor-tree-icon-search-excluded { opacity: 0.72; }',
    '}',
    /* Menu rows are <button>s, so dropping the inline `background` (needed for
           the hover rule to win) left them painting the browser's default button
           face — a light grey that showed between the separator's margins and made
           the menu look like it was split into bands. Reset it here instead: a
           class still loses to `:enabled:hover`, which is what we want. */
    '.dsh-editor-menu-item { background: transparent; appearance: none; -webkit-appearance: none; }',
    /* A hovered menu row uses the SAME fill as the selected file in the tree
           (`state-business-primary`, white text), not the faint `bg-hover` wash:
           on a 24px row over a raised menu background the faint wash was nearly
           invisible. `:enabled` keeps a greyed entry flat. */
    '.dsh-editor-menu-item:enabled:hover { background: var(--dsw-alias-state-business-primary); color: #fff !important; }',
    '.dsh-editor-menu-item:enabled:active { background: var(--dsw-alias-state-business-primary); color: #fff !important; }',
    '.dsh-editor-menu-item:focus-visible { outline: none; background: var(--dsw-alias-state-business-primary); color: #fff !important; }',
    /* The shortcut column and danger colour must stay legible on that fill. */
    '.dsh-editor-menu-item:enabled:hover .dsh-editor-menu-shortcut { color: rgba(255, 255, 255, 0.82) !important; }',
    '.dsh-editor-menu-item:enabled:hover .dsh-editor-menu-danger { color: #fff !important; }',
    '.dsh-editor-tree-row-selected:hover { background: var(--dsw-alias-state-business-primary); }',
    '.dsh-editor-tree-row-extended:hover { background: color-mix(in srgb, var(--dsw-alias-state-business-primary) 32%, transparent) !important; color: var(--dsw-alias-label-primary) !important; }',
    /* The commit just created, tinted so the user sees it land in the log. */
    '[data-dsh-log-new] { background: color-mix(in srgb, var(--dsw-alias-state-business-primary) 14%, transparent); }',
    '[data-dsh-log-new]:hover { background: color-mix(in srgb, var(--dsw-alias-state-business-primary) 22%, transparent); }',
    '.dsh-editor-change-tree-row:hover { background: var(--dsw-alias-interactive-bg-hover); }',
    '.dsh-editor-commit-row:hover { background: var(--dsw-alias-interactive-bg-hover); }',
    '.dsh-editor-commit-row-active { background: var(--dsw-alias-interactive-bg-hover-solid); }',
    /* Conflict rows keep a red wash even while hovered or selected. */
    '.dsh-editor-commit-row-conflict { background: rgba(207, 34, 46, 0.08); }',
    '.dsh-editor-commit-row-conflict:hover { background: rgba(207, 34, 46, 0.14); }',
    /* A parent path is useful only while enough of it remains to read. Query
           the path cell itself so short paths such as `src/` stay visible while
           deep paths squeezed below three characters disappear instead of
           leaving a meaningless ellipsis. The row/title still carries the full
           path. */
    '.dsh-editor-commit-path-suffix { container-type: inline-size; }',
    '@container (max-width: 3ch) {',
    '  .dsh-editor-commit-path-suffix-text { visibility: hidden; }',
    '}',
    /* IDEA's tick boxes, drawn rather than inherited: a hairline rounded
           square at rest, a solid accent square with a white tick when checked,
           and a dash when a subtree is partly selected. The native control is
           appearance-reset so macOS does not substitute its own larger,
           differently-coloured square, which is what made the commit tree look
           foreign next to the rest of the tool window. `appearance: none` must
           be paired with an explicit box, or the control collapses. */
    '.dsh-editor-checkbox {',
    '  appearance: none;',
    '  -webkit-appearance: none;',
    '  box-sizing: border-box;',
    '  position: relative;',
    '  width: 16px;',
    '  height: 16px;',
    '  border: 1px solid var(--dsw-alias-border-l2, var(--dsw-alias-border-l3));',
    '  border-radius: 4px;',
    '  background: var(--dsw-alias-bg-base);',
    '  cursor: pointer;',
    '  transition: background-color 0.09s linear, border-color 0.09s linear;',
    '}',
    '.dsh-editor-checkbox:hover { border-color: var(--dsw-alias-state-business-primary); }',
    '.dsh-editor-checkbox:checked,',
    '.dsh-editor-checkbox:indeterminate {',
    '  border-color: var(--dsw-alias-state-business-primary);',
    '  background: var(--dsw-alias-state-business-primary);',
    '}',
    /* The tick is a rotated border pair: no asset, and it scales with the box. */
    '.dsh-editor-checkbox:checked::after {',
    '  content: "";',
    '  position: absolute;',
    '  left: 5px;',
    '  top: 1.5px;',
    '  width: 4px;',
    '  height: 8px;',
    '  border: solid #fff;',
    '  border-width: 0 1.6px 1.6px 0;',
    '  transform: rotate(45deg);',
    '}',
    /* Partial selection (a directory or group with only some files ticked). */
    '.dsh-editor-checkbox:indeterminate::after {',
    '  content: "";',
    '  position: absolute;',
    '  left: 3px;',
    '  right: 3px;',
    '  top: 6.5px;',
    '  height: 1.6px;',
    '  background: #fff;',
    '}',
    '.dsh-editor-checkbox:disabled { opacity: 0.45; cursor: default; }',
    /* A narrow Find dock keeps the result count in its status row and favors
           search controls over repeating the window title. Compact the mask and
           header actions so they stay on one row instead of consuming three. */
    '.dsh-editor-find-controls[data-dsh-find-controls] { container: dsh-find-dock / inline-size; }',
    '@container dsh-find-dock (max-width: 360px) {',
    '  .dsh-editor-find-tool-title, .dsh-editor-find-tool-count, .dsh-editor-find-tool-spacer, .dsh-editor-find-file-mask-label { display: none !important; }',
    '  .dsh-editor-find-file-mask-input { width: 56px !important; min-width: 56px !important; }',
    '  .dsh-editor-find-dock-header-actions { flex-basis: 88px !important; width: 88px !important; min-width: 88px !important; }',
    '}',
    /* Below this width the mask cannot share the title row with either menu
           or window controls. Keep the window actions pinned at the upper-right;
           all toolbar actions remain reachable through the overflow button. */
    '@container dsh-find-dock (max-width: 220px) {',
    '  .dsh-editor-find-file-mask-control { display: none !important; }',
    '  .dsh-editor-find-controls[data-dsh-find-controls] > div > svg:first-child { display: none !important; }',
    '  .dsh-editor-find-dock-header-actions { flex-basis: 52px !important; width: 52px !important; min-width: 52px !important; }',
    '  .dsh-editor-find-scope-mode-group { flex: 1 1 auto !important; min-width: 0 !important; flex-wrap: wrap !important; }',
    '}',
    /* A narrow tool window shows the change list only; the diff needs room to be useful. */
    '@container dsh-editor-side (max-width: 520px) { .dsh-editor-diff-pane { display: none !important; } }',
    /* IDEA keeps the row name and one changed-line reading when the Changes
           pane is narrow. Hiding the deletion half is preferable to clipping both
           halves; the tooltip still carries the exact `+N −M`. */
    '@container dsh-editor-side (max-width: 210px) {',
    '  .dsh-editor-line-counts { gap: 1px !important; font-size: var(--dsh-editor-font-size-micro, 9px) !important; }',
    '  .dsh-editor-line-counts:not(.dsh-editor-line-counts-deletions-only) .dsh-editor-line-count-del { display: none !important; }',
    '  .dsh-editor-line-counts-deletions-only .dsh-editor-line-count-add { display: none !important; }',
    '}',
    /* At the tool window's supported minimum the single remaining count can
           still collide with a long file name. IDEA drops the stats before it
           clips the row identity; the row title still carries the full path. */
    '@container dsh-editor-side (max-width: 205px) { .dsh-editor-line-counts { display: none !important; } }',
    /* The unversioned group has two actions. At narrow widths they pushed
           past the pane edge, so IDEA keeps one overflow button and drops the
           secondary file count before it clips an action. Wide windows retain
           both direct buttons. */
    '@container dsh-editor-side (max-width: 240px) {',
    '  .dsh-editor-commit-group-actions-wide { display: none !important; }',
    '  .dsh-editor-commit-group-actions-narrow { display: contents !important; }',
    '  .dsh-editor-commit-group-header-count { display: none !important; }',
    '}',
    /* At the default quarter width the diff header has more important
           controls than words: keep the mode icon, hide its label so the
           hunk counter and undo/redo/close buttons stay inside the pane. */
    /* The diff stays in the editor column, not inside the Commit tree's
           container; size the toggle text against the editor surface. */
    '@container dsh-editor-editor (max-width: 440px) { .dsh-editor-diff-view-label, .dsh-editor-diff-hint { display: none !important; } }',
    '@container dsh-editor-editor (max-width: 440px) { .dsh-editor-terminal-title { display: none !important; } }',
    '.dsh-editor-terminal-strip { container: dsh-terminal-strip / inline-size; }',
    '@container dsh-terminal-strip (max-width: 260px) { .dsh-editor-terminal-secondary-action { display: none !important; } }',
    /* Quarter width: the three-control hunk nav (↑ n/n ↓) does not fit
           next to undo/redo/close. Collapse it to the clickable counter chip. */
    '@container dsh-editor-editor (max-width: 440px) { .dsh-editor-hunk-nav { display: none !important; } }',
    '@container dsh-editor-editor (max-width: 440px) { .dsh-editor-hunk-capsule { display: inline-flex !important; } }',
    '.dsh-editor-hunk-counter:focus-visible { outline: 1px solid var(--dsw-alias-state-business-primary); outline-offset: 1px; }',
    '.dsh-editor-hunk-capsule:focus-visible { outline: 1px solid var(--dsw-alias-state-business-primary); outline-offset: 1px; }',
    /* Monaco creates the gutter arrow imperatively. Give it the same
           discoverable pointer/focus feedback as plugin-owned icon buttons
           without replacing its range-mapping click handler. */
    '.dsh-editor-diff-pane .revertButton {',
    '  cursor: pointer !important;',
    '  border-radius: 3px !important;',
    '  transition: background-color 0.09s linear, color 0.09s linear !important;',
    '}',
    '.dsh-editor-diff-pane .revertButton:hover {',
    '  background: var(--dsw-alias-state-business-primary) !important;',
    '  color: #fff !important;',
    '}',
    '.dsh-editor-diff-pane .revertButton:focus-visible {',
    '  outline: 1px solid var(--dsw-alias-state-business-primary) !important;',
    '  outline-offset: 1px !important;',
    '}',
    /* Monaco's unchanged-region fold row otherwise uses its own full-width gray
           bar and font metrics, which reads as foreign chrome inside the IDEA-style
           diff. Keep the same fold/count behaviour but use the host surface tokens
           and the tool window's compact density. */
    '.dsh-editor-diff-pane .diff-hidden-lines-widget {',
    '  background: var(--dsw-alias-bg-layer-1) !important;',
    '  color: var(--dsw-alias-label-tertiary) !important;',
    '  font-size: var(--dsh-editor-font-size-caption, 10px) !important;',
    '}',
    '.dsh-editor-diff-pane .diff-hidden-lines-widget .center {',
    '  border-color: var(--dsw-alias-border-l3) !important;',
    '  background: var(--dsw-alias-bg-layer-1) !important;',
    '  color: var(--dsw-alias-label-tertiary) !important;',
    '}',
    /* The narrow toolbar keeps the title shrinkable and pins the actions as
           one group. Without this, non-shrinkable controls lay out past the
           pane's right edge and `overflow: hidden` cuts off hunk/close. */
    '.dsh-editor-diff-toolbar { gap: 6px; }',
    '.dsh-editor-diff-toolbar > :first-child { flex: 1 1 auto; min-width: 0; }',
    '.dsh-editor-diff-toolbar-actions { flex: none; }',
    /* IDEA draws the line-number gutter on the same grey surface as the
           editor tab strip, with a fine boundary before the code area. This
           selector intentionally covers every Monaco instance in the Editor:
           source editors, the right split, revision previews and diff sides. */
    '[data-dsh-editor-gutter-surface="idea"] {',
    '  --dsh-editor-gutter-fill: var(--dsw-alias-interactive-bg-hover-solid);',
    '  --dsh-editor-gutter-divider: var(--dsw-alias-border-l3);',
    '  --dsh-editor-content-fill: var(--dsh-editor-code-background);',
    '  --dsh-editor-gutter-gap: 2px;',
    '}',
    '.monaco-editor .margin {',
    '  background:',
    '    linear-gradient(to right,',
    '      transparent calc(100% - 3px),',
    '      var(--dsh-editor-gutter-divider) calc(100% - 3px) calc(100% - 2px),',
    '      var(--dsh-editor-content-fill) calc(100% - 2px) 100%),',
    '    var(--dsh-editor-gutter-fill) !important;',
    '  border-right: none !important;',
    '  box-sizing: border-box !important;',
    '}',
    '.monaco-editor .margin-view-overlays .line-numbers {',
    '  font-size: var(--dsh-editor-font-size-caption, 10px) !important;',
    '}',
    '.monaco-editor .margin-view-overlays .codicon-folding-expanded,',
    '.monaco-editor .margin-view-overlays .codicon-folding-collapsed,',
    '.monaco-editor .margin-view-overlays .codicon-folding-manual-expanded,',
    '.monaco-editor .margin-view-overlays .codicon-folding-manual-collapsed {',
    `  font-size: ${EDITOR_GUTTER_LAYOUT.foldIconFontSize}px !important;`,
    `  margin-left: ${EDITOR_GUTTER_LAYOUT.foldIconMarginLeft}px !important;`,
    '}',
    /* Sticky scroll repeats the gutter in the overlay widget, outside
       `.margin-view-overlays`; it needs the same compact type and icon metrics. */
    '.monaco-editor .sticky-line-number,',
    '.monaco-editor .sticky-line-number-inner {',
    '  font-size: var(--dsh-editor-font-size-caption, 10px) !important;',
    '}',
    '.monaco-editor .sticky-line-number .codicon-folding-expanded,',
    '.monaco-editor .sticky-line-number .codicon-folding-collapsed,',
    '.monaco-editor .sticky-line-number .codicon-folding-manual-expanded,',
    '.monaco-editor .sticky-line-number .codicon-folding-manual-collapsed {',
    `  font-size: ${EDITOR_GUTTER_LAYOUT.foldIconFontSize}px !important;`,
    `  margin-left: ${EDITOR_GUTTER_LAYOUT.foldIconMarginLeft}px !important;`,
    '  cursor: pointer !important;',
    '}',
    /* ⌘/Ctrl hover over a navigable identifier mirrors the language-service
           link affordance: pointer cursor plus an accent underline. The class is
           applied by a Monaco decoration only while the modifier is held. */
    '.monaco-editor .view-lines .dsh-editor-definition-link {',
    '  cursor: pointer !important;',
    '  text-decoration: underline !important;',
    '  text-decoration-color: var(--dsw-alias-state-business-primary) !important;',
    '  text-decoration-thickness: 1px;',
    '  text-underline-offset: 2px;',
    '}',
    /* Search Everywhere and Find use lightweight custom previews instead
           of another Monaco instance. These classes give them the same gutter
           rail, divider, 2px content gap and editor background as Monaco. */
    '.dsh-editor-code-preview {',
    '  background: var(--dsh-editor-content-fill) !important;',
    '}',
    '.dsh-editor-code-preview-line {',
    '  display: flex;',
    '  align-items: stretch;',
    '  min-width: max-content;',
    '}',
    '.dsh-editor-code-preview-gutter {',
    '  box-sizing: border-box;',
    '  flex: 0 0 46px;',
    '  align-self: stretch;',
    '  padding-right: 8px;',
    '  color: var(--dsw-alias-label-tertiary);',
    '  text-align: right;',
    '  user-select: none;',
    '  background:',
    '    linear-gradient(to right,',
    '      transparent calc(100% - 3px),',
    '      var(--dsh-editor-gutter-divider) calc(100% - 3px) calc(100% - 2px),',
    '      var(--dsh-editor-content-fill) calc(100% - 2px) 100%),',
    '    var(--dsh-editor-gutter-fill);',
    '}',
    '.dsh-editor-code-preview-code {',
    '  flex: 1 1 auto;',
    '  min-width: 0;',
    '}',
    '.dsh-editor-code-preview-match {',
    '  border-radius: 2px;',
    '  background: color-mix(in srgb, var(--dsw-alias-state-warning-primary, #d4a72c) 34%, transparent);',
    '}',
    /* IDEA Default.icls DIFF_CONFLICT background. Only marker lines receive it;
       ordinary code lines retain their diff insert/delete treatment. */
    '.dsh-editor-conflict-marker-line {',
    '  background: #ffd5cc !important;',
    '}',
    '@media (prefers-color-scheme: dark) {',
    '  .dsh-editor-conflict-marker-line {',
    '    background: #45302b !important;',
    '  }',
    '}',
    '.dsh-editor-tab:hover { background: var(--dsw-alias-interactive-bg-hover); }',
    '.dsh-editor-tab-active:hover { background: var(--dsh-editor-code-background); }',
    '.dsh-editor-tab:focus-visible, .dsh-editor-split-tab:focus-visible { outline: 1px solid var(--dsw-alias-state-business-primary); outline-offset: -2px; }',
    '.dsh-editor-status-path:hover { color: var(--dsw-alias-label-primary) !important; text-decoration: underline; text-underline-offset: 2px; }',
    '.dsh-editor-status-path:focus-visible { outline: 1px solid var(--dsw-alias-state-business-primary); outline-offset: 1px; }',
    '.dsh-editor-image-preview:focus-visible { outline: 1px solid var(--dsw-alias-state-business-primary); outline-offset: -2px; }',
    '.dsh-editor-tab-close:hover { background: var(--dsw-alias-interactive-bg-hover) !important; color: var(--dsw-alias-label-primary) !important; border-color: var(--dsw-alias-border-l3) !important; border-radius: 5px; }',
    '.dsh-editor-tab-close:focus-visible { background: var(--dsw-alias-interactive-bg-hover-solid) !important; color: var(--dsw-alias-label-primary) !important; border-color: var(--dsw-alias-border-l3) !important; border-radius: 5px; outline: none; }',
    /* macOS hides native overlay scrollbars while idle. Project and Commit
           retain horizontal overflow for long paths, so give those tool windows
           a thin IDEA-style thumb that appears without changing the row layout.
           The transparent border keeps the painted thumb narrower than its hit
           target while `content-box` preserves the rounded track gutter. */
    '.dsh-editor-tool-scroll {',
    '  scrollbar-width: thin;',
    '  scrollbar-color: color-mix(in srgb, var(--dsw-alias-label-tertiary) 55%, transparent) transparent;',
    '}',
    '.dsh-editor-tool-scroll::-webkit-scrollbar { width: 8px; height: 8px; }',
    '.dsh-editor-tool-scroll::-webkit-scrollbar-track { background: transparent; }',
    '.dsh-editor-tool-scroll::-webkit-scrollbar-thumb {',
    '  min-width: 36px;',
    '  min-height: 36px;',
    '  border: 2px solid transparent;',
    '  border-radius: 999px;',
    '  background: color-mix(in srgb, var(--dsw-alias-label-tertiary) 48%, transparent);',
    '  background-clip: content-box;',
    '}',
    '.dsh-editor-tool-scroll:hover::-webkit-scrollbar-thumb {',
    '  background: color-mix(in srgb, var(--dsw-alias-label-secondary) 68%, transparent);',
    '  background-clip: content-box;',
    '}',
    '.dsh-editor-tool-scroll::-webkit-scrollbar-thumb:active {',
    '  background: var(--dsw-alias-state-business-primary);',
    '  background-clip: content-box;',
    '}',
    '.dsh-editor-tool-scroll::-webkit-scrollbar-corner { background: transparent; }',
    /* IDEA drops the Action category before it squeezes the name/description. */
    '.dsh-editor-search-everywhere-row { container-type: inline-size; }',
    '.dsh-editor-search-everywhere-tablist::-webkit-scrollbar { display: none; }',
    '@container (max-width: 460px) {',
    '  .dsh-editor-search-everywhere-category { display: none !important; }',
    '}',
    '@media (max-width: 640px) {',
    '  .dsh-editor-search-everywhere-category { display: none !important; }',
    '}',
    '@media (max-width: 520px) {',
    '  .dsh-editor-find-scope-body {',
    '    flex-direction: column !important;',
    '  }',
    '  .dsh-editor-find-scope-list {',
    '    width: auto !important;',
    '    max-height: 180px;',
    '    flex: 0 0 auto !important;',
    '    border-right: none !important;',
    '    border-bottom: 1px solid var(--dsw-alias-border-l3) !important;',
    '  }',
    '}',
  ].join('\n');
  document.head.appendChild(style);
}

/** Owns the custom tab, the split state, and the editor React root. */
/**
 * Whether the tree should show its "loading" placeholder.
 *
 * The workspace poll re-runs the loader every few seconds. Showing the
 * placeholder then inserts a row ABOVE the list, pushing every entry down 22px
 * and snapping it back when the request finishes — the whole tree visibly jumps.
 * Once there are rows to show, a refresh is silent: the old list stays put until
 * the new one replaces it.
 * @param {{loading: boolean, rowCount: number}|null} state - current state.
 * @returns {boolean} true only for the very first load.
 */
export function shouldShowTreeLoading(state: TreeLoadingState | null | undefined): boolean {
  if (state === null || state === undefined) return false;
  return state.loading === true && Number(state.rowCount) === 0;
}

/**
 * Whether a menu's label set is the workspace "..." menu.
 *
 * Both the workspace menu and the session menu render as `[role=menu]`, so the
 * only reliable discriminator is what it offers: the workspace one renames,
 * reveals and deletes a WORKSPACE. Rename alone is not enough (the session menu
 * has it too), so the delete label is required as well.
 * @param {string[]|null} labels - the menu's item labels, trimmed.
 * @returns {boolean} true for the workspace menu.
 */
export function isWorkspaceMenu(labels: string[] | null | undefined): boolean {
  if (!Array.isArray(labels) || labels.length === 0) return false;
  const has = (pattern: RegExp): boolean => labels.some((label) => pattern.test(label));
  return has(/^重命名$|^Rename$/u) && has(/^删除工作区$|^Delete workspace$/u);
}

/**
 * The scroll offset to apply when returning to a tab.
 *
 * Switching between the Changes and Log tabs remounts the list, which drops the
 * scroll position. IDEA keeps each tab where you left it, so the offset is
 * remembered per tab and re-applied — clamped, because the content may have
 * changed length while the tab was hidden.
 * @param {{remembered: number|null, max: number}|null} state - saved offset and the new maximum.
 * @returns {number|null} the offset to apply, or null to leave the scroller alone.
 */
export function restoreScrollTop(state: ScrollRestoreState | null | undefined): number | null {
  if (state === null || state === undefined) return null;
  const remembered = state.remembered;
  const max = Number(state.max);
  if (remembered === null || remembered === undefined) return null;
  const value = Number(remembered);
  if (!Number.isFinite(value) || !Number.isFinite(max)) return null;
  return Math.max(0, Math.min(Math.max(0, max), value));
}

/**
 * The label of the "jump to newest" badge.
 *
 * A plain arrow says "go down"; a count tells the user how much they are
 * missing, which is what makes the badge worth the space. The count is capped so
 * a long run of messages cannot stretch the pill across the column.
 * @param {number} count - messages that arrived while scrolled away.
 * @returns {string} the badge text.
 */
export function jumpBadgeLabel(count: number): string {
  const value = Number(count);
  if (!Number.isFinite(value) || value <= 0) return '↓';
  if (value > 99) return '↓ 99+';
  return `↓ ${Math.floor(value)}`;
}

/**
 * Delay before the next coalesced DOM-maintenance pass.
 *
 * Mutations arrive in bursts while chat/terminal output streams. A zero-delay
 * pass for every mutation repeatedly tears through the whole document and can
 * starve the renderer; this caps reconciliation at roughly 12.5 passes/second.
 * @param {number} lastAt - performance.now() of the previous pass.
 * @param {number} now - performance.now() of the incoming mutation.
 * @param {number} [minimum=80] - minimum spacing in milliseconds.
 * @returns {number} non-negative timeout delay.
 */
export function maintenanceDelay(lastAt: number, now: number, minimum = 80): number {
  const previous = Number(lastAt);
  const current = Number(now);
  const spacing = Number(minimum);
  if (!Number.isFinite(previous) || !Number.isFinite(current) || !Number.isFinite(spacing)) return 0;
  return Math.max(0, spacing - Math.max(0, current - previous));
}

/**
 * IDEA activates a visible but inactive tool window before hiding it.
 *
 * The first shortcut press raises/focuses the requested tool window; only a
 * press made while that tool window already owns focus hides it.
 * @param currentActivity - currently selected side tool window, if any.
 * @param targetActivity - tool window requested by the shortcut.
 * @param visible - whether the requested tool window is visible.
 * @param focusInside - whether keyboard focus is inside that tool window.
 * @returns {'show' | 'focus' | 'hide'} the requested activation transition.
 */
export function toolWindowShortcutAction(
  currentActivity: string | null,
  targetActivity: string,
  visible: boolean,
  focusInside: boolean,
): 'show' | 'focus' | 'hide' {
  if (!visible || currentActivity !== targetActivity) return 'show';
  return focusInside ? 'hide' : 'focus';
}

/**
 * IDEA's terminal shortcut is an activation sequence, never a shell-creation request.
 *
 * A closed dock opens and receives focus. A visible dock that does not own focus
 * is focused without closing. Only a shortcut pressed inside the terminal hides
 * it, returning focus to the surface that opened it.
 * @param {boolean} open - whether the terminal dock is currently visible.
 * @param {boolean} focusInsideTerminal - whether the active element is inside the terminal.
 * @returns {{open: boolean, restoreFocus: boolean, focus: boolean}} the requested dock transition.
 */
export function terminalShortcutAction(open: boolean, focusInsideTerminal: boolean): TerminalShortcutState {
  const action = toolWindowShortcutAction(open ? 'terminal' : null, 'terminal', open, focusInsideTerminal === true);
  if (action === 'hide') return { open: false, restoreFocus: true, focus: false };
  return { open: true, restoreFocus: false, focus: action === 'focus' };
}

/**
 * Snap a dragged split position to the middle, IDEA's splitter behaviour.
 *
 * Without a snap the panes are always a few pixels off even split, and no amount
 * of dragging fixes it; the 3-point window is wide enough to catch a deliberate
 * centring attempt but narrow enough not to fight a user who wants 45/55.
 * @param {number} value - the dragged percentage.
 * @returns {number} the snapped, clamped percentage.
 */
export function snapSplitPercent(value: number): number {
  const percent = Number(value);
  if (!Number.isFinite(percent)) return 50;
  const clamped = Math.max(20, Math.min(80, percent));
  return Math.abs(clamped - 50) <= 3 ? 50 : clamped;
}

/**
 * Whether the "jump to newest" badge should be visible.
 *
 * A chat that scrolled away from the newest message needs a way back that does
 * not require hunting for the scrollbar; at the bottom (or in a conversation
 * that does not scroll) the badge is pure noise.
 * @param {{scrollTop: number, max: number, hasNew: boolean}|null} state - scroll position and whether anything new arrived.
 * @returns {boolean} true when the badge belongs on screen.
 */
export function jumpBadgeVisible(state: JumpBadgeState | null | undefined): boolean {
  if (state === null || state === undefined) return false;
  const top = Number(state.scrollTop);
  const max = Number(state.max);
  if (!Number.isFinite(top) || !Number.isFinite(max)) return false;
  if (max <= 24) return false;
  if (state.hasNew !== true) return false;
  /* The 24px slack matches `isNearBottom`: inside it the user IS at the bottom. */
  return max - top > 24;
}

/**
 * Whether a scroller is close enough to its bottom to count as "following".
 *
 * A chat that the user has scrolled up must stay put when a new message lands;
 * one that sits at the bottom should keep following the newest line. The slack
 * absorbs sub-pixel layout rounding.
 * @param {{scrollTop: number, max: number}|null} state - offset and maximum offset.
 * @returns {boolean} true when the view is at (or within a few px of) the bottom.
 */
export function isNearBottom(state: ScrollMetrics | null | undefined): boolean {
  if (state === null || state === undefined) return true;
  const top = Number(state.scrollTop);
  const max = Number(state.max);
  if (!Number.isFinite(top) || !Number.isFinite(max)) return true;
  if (max <= 0) return true;
  return max - top <= 24;
}

/**
 * The next scroll offset for a chat wheel step.
 *
 * The conversation flow's message nodes swallow the wheel before it reaches the
 * scroll container (the event's target is a button inside a bubble), so the split
 * drives the scroll itself instead of relying on the browser's chain.
 * @param {{scrollTop: number, deltaY: number, max: number}|null} state - current offset, wheel delta, maximum offset.
 * @returns {number|null} the clamped offset, or null when nothing is known.
 */
export function wheelScrollTop(state: WheelScrollState | null | undefined): number | null {
  if (state === null || state === undefined) return null;
  const current = Number(state.scrollTop);
  const delta = Number(state.deltaY);
  const max = Number(state.max);
  if (!Number.isFinite(current) || !Number.isFinite(delta) || !Number.isFinite(max))
    return Number.isFinite(current) ? current : null;
  /* A wheel event is in CSS pixels; scrollTop is too, so a plain sum is right. */
  return Math.max(0, Math.min(max, current + delta));
}

/**
 * Map Shift+Wheel to horizontal scrolling on an overflowing tool surface.
 *
 * Trackpads emit deltaX directly, but an ordinary mouse wheel only emits
 * deltaY. IDEA-style trees/tables use Shift+Wheel for the same horizontal
 * traversal as the scrollbar. Returning null means the surface has no room
 * or the gesture is not Shift+Wheel, so callers leave the event untouched.
 * @param {{shiftKey?: boolean, deltaY?: number, scrollLeft?: number, scrollWidth?: number, clientWidth?: number}|null} state - wheel and surface metrics.
 * @returns {number|null} the clamped scrollLeft, or null when no movement is needed.
 */
function shiftWheelScrollLeft(state: ShiftWheelState | null | undefined): number | null {
  if (state === null || state === undefined || state.shiftKey !== true) return null;
  const current = Number(state.scrollLeft);
  const delta = Number(state.deltaY);
  const scrollWidth = Number(state.scrollWidth);
  const clientWidth = Number(state.clientWidth);
  if (![current, delta, scrollWidth, clientWidth].every((value) => Number.isFinite(value))) return null;
  const max = Math.max(0, scrollWidth - clientWidth);
  if (max <= 0 || delta === 0) return null;
  const next = Math.max(0, Math.min(max, current + delta));
  return next === current ? null : next;
}

/**
 * Apply the shared Shift+Wheel bridge to one horizontal tool surface.
 * @param {WheelEvent} event - native or React wheel event.
 * @returns {void}
 */
function applyShiftWheelScroll(event: ShiftWheelEvent): void {
  const node = event?.currentTarget;
  if (node === null || node === undefined) return;
  const next = shiftWheelScrollLeft({
    shiftKey: event.shiftKey === true,
    deltaY: event.deltaY,
    scrollLeft: node.scrollLeft,
    scrollWidth: node.scrollWidth,
    clientWidth: node.clientWidth,
  });
  if (next === null) return;
  event.preventDefault();
  node.scrollLeft = next;
}

/**
 * Install the non-passive Shift+Wheel bridge on one scroll surface.
 *
 * React's delegated wheel listener cannot reliably cancel the browser's
 * vertical default, so tool surfaces bind the native event explicitly.
 * @param {HTMLElement|null|undefined} node - horizontal scroll surface.
 * @returns {Function} cleanup callback.
 */
export function bindShiftWheelScroll(node: HTMLElement | null | undefined): () => void {
  if (!(node instanceof HTMLElement)) return () => {};
  const listener = applyShiftWheelScroll as unknown as EventListener;
  node.addEventListener('wheel', listener, { passive: false });
  return () => node.removeEventListener('wheel', listener);
}

/**
 * The `path:line:column` form IDEA's "Copy Reference" produces.
 *
 * The caret belongs to the file that is actually open in the editor. Using it for
 * any other row produced `notes.md:1:1`, a position the user never chose — so a
 * row that is not the active file copies its plain path.
 * @param {string} path - workspace-relative path.
 * @param {{lineNumber: number, column: number}|null} caret - editor caret, if any.
 * @param {boolean} isActive - whether this path is the file open in the editor.
 * @returns {string} the copied text.
 */
function pathWithLine(path: string, caret: EditorCaret | null | undefined, isActive: boolean): string {
  const base = typeof path === 'string' ? path : '';
  if (base === '' || isActive !== true || caret === null || caret === undefined) return base;
  const line = Number(caret.lineNumber);
  const column = Number(caret.column);
  if (!Number.isFinite(line) || !Number.isFinite(column)) return base;
  return `${base}:${line}:${column}`;
}

/**
 * Quote a path for pasting into a shell.
 *
 * IDEA's "Copy Path" produces something you can drop straight after `cd` or
 * `cat`; an absolute path with spaces or a quote would otherwise split into
 * several arguments. Single quotes with the `'\''` escape are POSIX-safe.
 * @param {string} value - the raw path.
 * @returns {string} the same path, quoted only when needed.
 */
export function shellQuote(value: string): string {
  const path = typeof value === 'string' ? value : '';
  if (path === '') return "''";
  if (!/[\s'"$`\\!*?()\[\]{}<>|&;]/.test(path)) return path;
  return `'${path.split("'").join("'\\''")}'`;
}

/**
 * Build IDEA's Copy Path/Reference submenu for Project and Changes.
 *
 * Both tool windows copy paths from the same workspace root and the active
 * editor owns the only truthful caret. Keeping the action list here prevents
 * the two menus from drifting on labels, batch rules or shell quoting.
 * @param {{entries: object[], root: string, t: Function, editor: object|null, editorPath: string|null, writeText: Function}} options - copy context.
 * @returns {Array<object|null>} ContextMenu-compatible submenu items.
 */
export function copyReferenceMenuItems({
  entries,
  root,
  t,
  editor,
  editorPath,
  writeText,
}: CopyReferenceMenuOptions): Array<ReferenceMenuItem | null> {
  const items = Array.isArray(entries) ? entries.filter((entry) => typeof entry?.path === 'string') : [];
  const multiple = items.length > 1;
  const first = items[0] ?? null;
  const firstPath = first?.path ?? '';
  const firstIsRoot = first !== null && firstPath === '';
  const onlyFile = first !== null && !firstIsRoot && first.isDirectory !== true && multiple === false;
  const absolutePath = (path: string): string => {
    if (path === '') return root;
    if (root === '') return path;
    return `${root}/${path}`.replace(/\/+/gu, '/');
  };
  const write = (value: string): void => {
    Promise.resolve(writeText?.(value)).catch(() => {});
  };
  return [
    {
      id: 'copyPath',
      label: multiple ? t('editor.copySelectedPaths', { count: items.length }) : t('editor.copyAbsolutePathIdea'),
      disabled: items.length === 0,
      run: () => write(multiple ? items.map((entry) => absolutePath(entry.path)).join('\n') : absolutePath(firstPath)),
    },
    {
      id: 'copyFileName',
      label: t('editor.copyFileName'),
      disabled: items.length === 0 || firstIsRoot,
      run: () => write(multiple ? items.map((entry) => basename(entry.path)).join('\n') : basename(firstPath)),
    },
    null,
    {
      id: 'copyPosition',
      label: t('editor.copyPathWithLineIdea'),
      disabled: onlyFile === false,
      run: () => write(pathWithLine(firstPath, editor?.getPosition?.() ?? null, editorPath === firstPath)),
    },
    {
      id: 'copyRelative',
      label: t('editor.copyContentRootPath'),
      disabled: items.length === 0 || firstIsRoot || multiple,
      run: () => write(firstPath),
    },
    null,
    {
      /* The absolute form is what you paste into a shell; quoting it keeps a
             path with spaces one argument. This DSH convenience stays separate
             from IDEA's raw Absolute Path action. */
      id: 'copyAbsolute',
      label: t('editor.copyAbsolutePath'),
      disabled: items.length === 0 || multiple,
      run: () => write(shellQuote(absolutePath(firstPath))),
    },
  ];
}

/**
 * Choose an icon that the host's sprite actually defines.
 *
 * An `<use href="#missing">` renders nothing, so a guessed icon id leaves a
 * blank 16px gutter in the menu row — worse than keeping the original glyph.
 * @param {string[]} preferred - icon ids to try, best first.
 * @param {Set<string>} available - ids present in the document's sprite.
 * @returns {string|null} the first available id, or null to keep the original.
 */
/**
 * Where an arrow key should move focus inside a menu that contains our injected row.
 *
 * The host's menu keeps its own index array and drives focus from it; a row we
 * inserted is not in that array, so the host steps straight over it. Only the
 * two boundary steps need help — everything else is the host's job.
 * @param {number} activeIndex - index of the focused item in DOM order.
 * @param {'ArrowDown'|'ArrowUp'} key - the pressed arrow key.
 * @param {number} selfIndex - index of the injected row in DOM order.
 * @returns {number|null} index to focus, or null to leave the key to the host.
 */
export function menuArrowTarget(activeIndex: number, key: MenuArrowKey, selfIndex: number): number | null {
  const active = Number(activeIndex);
  const self = Number(selfIndex);
  if (!Number.isFinite(active) || !Number.isFinite(self) || self < 0) return null;
  const step = key === 'ArrowDown' ? 1 : key === 'ArrowUp' ? -1 : 0;
  if (step === 0) return null;
  /* Index -1 means "nothing focused yet": the host focuses its own first row. */
  if (active < 0) return null;
  const next = active + step;
  /* ↑ from the top of the host's list wraps to our row (dom index 0); the host
         itself would stop there because its array has no index 0. */
  if (next < 0) return self === 0 ? 0 : null;
  /* Moving OUT of our row, or INTO it. */
  if (active === self || next === self) return next;
  return null;
}

/**
 * Whether the host's left sidebar is currently taking conversation width.
 *
 * The host collapses it to a narrow icon rail. Opening the editor from the
 * workspace menu should reclaim the full conversation-list width, but an
 * already-collapsed rail must not be clicked back open.
 * @param {number} width - measured sidebar column width.
 * @returns {boolean} true only for a finite, expanded width.
 */
export function sidebarNeedsCollapse(width: number): boolean {
  const measured = Number(width);
  return Number.isFinite(measured) && measured > 96;
}

export function pickMenuIcon(
  preferred: string[] | null | undefined,
  available: Set<string> | null | undefined,
): string | null {
  if (!Array.isArray(preferred) || !(available instanceof Set)) return null;
  for (const id of preferred) {
    if (typeof id === 'string' && available.has(id)) return id;
  }
  return null;
}
