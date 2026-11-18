/* ui-primitives.js: dsh-editor client module. Generated into lib/client.js by scripts/build-client.mjs. */
    /** SVG icon set used by the panel chrome and file tree. */
    /** One vertical activity-stripe entry. */


    /** Left activity stripe: IDEA tool windows plus the Harness chat toggle. */


    /**
     * Compute direct action counts for a tool-window toolbar.
     *
     * IDEA keeps the trailing actions stable and overflows the middle. Once
     * any action must overflow, reserve that button's slot before distributing
     * room to the trailing suffix.
     * @param {number} width - toolbar width.
     * @param {number} titleWidth - rendered title width.
     * @param {number} leftCount - leading action count.
     * @param {number} rightCount - trailing action count.
     * @param {number} badgeWidth - optional branch badge width.
     * @param {number} pinnedLeftCount - leading actions that must stay direct.
     * @returns {{left: number, right: number}} direct action counts.
     */


    /**
     * IDEA-style tool-window toolbar with overflow.
     *
     * IDEA never squeezes the tool-window title to make room for actions: once
     * the actions stop fitting they collapse into a "»" menu. The groups are
     * measured independently so left/right alignment survives a narrow panel.
     */


    /**
     * Preserve the difference between an explicit toggle state and a command.
     *
     * IDEA actions are either toggles with a real on/off state or ordinary
     * commands. Feeding `undefined` into a boolean toggle would make screen
     * readers announce every command as an unpressed button.
     * @param {{active?: boolean}|null|undefined} action - toolbar action.
     * @returns {boolean|undefined} explicit pressed state, or undefined.
     */


    /**
     * IDEA's Unified / Side-by-side segmented diff-mode control.
     *
     * At normal widths both modes stay visible, with the active mode pressed.
     * The narrow fallback retains one toggle so hunk navigation and Close keep
     * their reserved space.
     * @param {{t: Function, mode: 'paired'|'toggle', sideBySide: boolean, disabled: boolean, onChange: Function}} props - mode control state.
     * @returns {object} toolbar control.
     */


    /** One 24px panel toolbar button. */


    /**
     * Choose the direct actions for a compact toolbar.
     *
     * IDEA keeps high-frequency toolbar actions available while secondary
     * actions move into the overflow menu. Pinned actions are reserved first;
     * the remaining slots follow the caller's original order so the wide
     * toolbar and overflow menu never invent a second action sequence.
     * @param {object[]} actions - toolbar actions in display order.
     * @param {number} directLimit - maximum number of direct action buttons.
     * @returns {object[]} actions that remain directly visible.
     */


    /**
     * Insert ContextMenu separators only where the action's IDEA group changes.
     * @param {object[]} actions - overflow actions in display order.
     * @returns {Array<object|null>} actions with null separator entries.
     */


    /**
     * A compact tool-window action strip that keeps pinned/leading actions and
     * overflows the rest into IDEA's `»` menu.
     *
     * The Commit Changes pane is often only ~190px wide. Laying every action out
     * at a fixed width makes the last ones cross the pane edge, where overflow
     * hides them without any way to reach them. This measures in 26px slots and
     * reserves one slot for the overflow button.
     * @param {{actions: object[], t: Function, ariaLabel: string}} props - strip model.
     * @returns {object} the measured toolbar.
     */


    /** Project tool window: toolbar, IDEA-style tree, inline create row. */
