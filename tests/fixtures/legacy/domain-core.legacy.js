/* domain-core.js: dsh-editor client module. Generated into lib/client.js by scripts/build-client.mjs. */
    /**
     * Identity of the pinned Commit-diff tab inside the editor's strip.
     *
     * A NUL prefix cannot collide with a workspace path, so the strip can treat
     * this key and a file path in the same overflow list without a type check.
     */
    const DIFF_TAB_KEY = '\u0000dsh-editor-diff';

    /** Trebuchet MS is the requested default for editor chrome and code text. */
    const EDITOR_UI_FONT = '"Trebuchet MS", "PingFang SC", "Microsoft YaHei UI", sans-serif';
    /** One code text size across every Monaco editing surface. */
    const EDITOR_CODE_FONT_SIZE = 13;
    /** One line height across every Monaco editing surface. */
    const EDITOR_CODE_LINE_HEIGHT = 20;
