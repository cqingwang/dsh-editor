/**
 * Identity of the pinned Commit-diff tab.
 *
 * A NUL prefix cannot collide with a workspace path, so the strip can treat
 * this key and a file path in the same overflow list without a type check.
 */
export const DIFF_TAB_KEY = '\u0000dsh-editor-diff';
