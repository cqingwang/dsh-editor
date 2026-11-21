import type { CSSProperties } from 'react';

/**
 * The host locale sets `lang` on the document root. The injected stylesheet
 * replaces these variables for CJK languages; all editor UI must reference
 * these variables instead of maintaining local font stacks. Latin glyphs use
 * Trebuchet MS in both UI chrome and code; CJK glyphs fall through to the
 * language-specific family without changing the Latin owner. Terminal keeps
 * its own monospace token because its glyph and grid metrics are a separate
 * interaction domain.
 */
export const EDITOR_LATIN_FONT = '"Trebuchet MS", "SF Pro Text", "Segoe UI", sans-serif';
export const EDITOR_LANGUAGE_FONT_FALLBACKS = {
  zh: '"Trebuchet MS", "PingFang SC", "Microsoft YaHei UI", sans-serif',
  ja: '"Trebuchet MS", "Hiragino Sans", "Yu Gothic UI", sans-serif',
  ko: '"Trebuchet MS", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif',
} as const;
export const EDITOR_UI_FONT = `var(--dsh-editor-font-ui, ${EDITOR_LATIN_FONT})`;
export const EDITOR_CODE_FONT = `var(--dsh-editor-font-code, ${EDITOR_LATIN_FONT})`;
export const EDITOR_BASE_FONT_WEIGHT = 500;
export const EDITOR_TERMINAL_FONT_STACK = 'Menlo, Monaco, ui-monospace, SFMono-Regular, Consolas, monospace';
/** CSS-only token. Canvas-backed xterm must receive EDITOR_TERMINAL_FONT_STACK. */
export const EDITOR_TERMINAL_FONT = `var(--dsh-editor-font-terminal, ${EDITOR_TERMINAL_FONT_STACK})`;

/** One shared typographic scale for every editor component. */
export const EDITOR_FONT_SIZE_SCALE = {
  micro: 9,
  symbol: 8.5,
  badge: 8,
  badgeCompact: 6,
  caption: 10,
  label: 11,
  labelDense: 11.5,
  body: 12,
  control: 13,
  emphasis: 14,
  display: 15,
} as const;

export const EDITOR_RESPONSIVE_FONT_SIZE = {
  commitChip: 'clamp(8px, 4.4cqw, 10px)',
} as const;

/** Shared compact geometry for Monaco's line-number and folding chrome. */
export const EDITOR_GUTTER_LAYOUT = {
  lineNumbersMinChars: 3,
  lineDecorationsWidth: 2,
  foldIconFontSize: 10,
  foldIconMarginLeft: 0,
} as const;

export type EditorColorScheme = 'light' | 'dark';
export type EditorSurfaceTone = 'toolWindow' | 'code';

/**
 * Keep Commit and other tool-window chrome on a separate low-glare tone while
 * the Project file tree shares the softer editor reading surface.
 */
export const EDITOR_SURFACE_BACKGROUNDS = {
  light: {
    toolWindow: '#eef1f4',
    code: '#f9fbf9',
  },
  dark: {
    toolWindow: '#181a1d',
    code: '#1e1e1e',
  },
} as const;

export function editorSurfaceBackground(scheme: EditorColorScheme, tone: EditorSurfaceTone): string {
  return EDITOR_SURFACE_BACKGROUNDS[scheme][tone];
}

/** The user prefers Project to share the editor background; Commit keeps tool-window chrome. */
export function editorToolWindowBackground(activity: unknown): string | undefined {
  if (activity === 'project') return 'var(--dsh-editor-code-background)';
  if (activity === 'commit') return 'var(--dsh-editor-tool-window-background)';
  return undefined;
}

export type EditorTextRole = 'title' | 'input' | 'control' | 'body' | 'label' | 'metadata' | 'code';

/** Semantic text roles used by dialogs, tool windows and shared controls. */
export const EDITOR_TEXT_STYLE: Record<
  EditorTextRole,
  Pick<CSSProperties, 'fontFamily' | 'fontSize' | 'fontWeight'>
> = {
  title: {
    fontFamily: EDITOR_UI_FONT,
    fontSize: EDITOR_FONT_SIZE_SCALE.control,
    fontWeight: EDITOR_BASE_FONT_WEIGHT,
  },
  input: {
    fontFamily: EDITOR_UI_FONT,
    fontSize: EDITOR_FONT_SIZE_SCALE.control,
    fontWeight: EDITOR_BASE_FONT_WEIGHT,
  },
  control: {
    fontFamily: EDITOR_UI_FONT,
    fontSize: EDITOR_FONT_SIZE_SCALE.control,
    fontWeight: EDITOR_BASE_FONT_WEIGHT,
  },
  body: {
    fontFamily: EDITOR_UI_FONT,
    fontSize: EDITOR_FONT_SIZE_SCALE.body,
    fontWeight: EDITOR_BASE_FONT_WEIGHT,
  },
  label: {
    fontFamily: EDITOR_UI_FONT,
    fontSize: EDITOR_FONT_SIZE_SCALE.label,
    fontWeight: EDITOR_BASE_FONT_WEIGHT,
  },
  metadata: {
    fontFamily: EDITOR_UI_FONT,
    fontSize: EDITOR_FONT_SIZE_SCALE.caption,
    fontWeight: EDITOR_BASE_FONT_WEIGHT,
  },
  code: {
    fontFamily: EDITOR_CODE_FONT,
    fontSize: EDITOR_FONT_SIZE_SCALE.control,
    fontWeight: EDITOR_BASE_FONT_WEIGHT,
  },
};

/** One code text size across every Monaco editing surface. */
export const EDITOR_CODE_FONT_SIZE = 13;

/** One line height across every Monaco editing surface. */
export const EDITOR_CODE_LINE_HEIGHT = 20;
