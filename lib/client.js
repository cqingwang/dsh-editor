window.__ModuleLoader__.load({
  id: 'dsh-editor',
  factory: (require) => {
    const React = require('react');
    const { createRoot } = require('react-dom/client');

    /** Locale namespace owned by this plugin. */
    const NS = 'dsh-editor';
    /** xterm constructors, loaded at most once. */
    let xtermPromise = null;
    /** Tab label is intentionally identical in both languages. */
    const VIEW_LABEL = 'Editor';

    const zh = {
      view: { editor: VIEW_LABEL },
      editor: {
        files: '文件',
        project: 'Project',
        resizeChat: '拖动调整聊天窗口宽度',
        hideChat: '收起聊天窗口',
        showChat: '展开聊天窗口',
        commit: 'Commit',
        terminal: 'Terminal',
        loading: '加载中…',
        noFiles: '没有可显示的文件',
        emptyDirectory: '（空目录）',
        createIn: '创建位置',
        noFile: '未打开文件',
        save: '保存',
        saving: '保存中…',
        saved: '已保存',
        unsaved: '未保存',
        refresh: '刷新',
        monacoError: 'Monaco 加载失败',
        fileError: '文件操作失败',
        newFile: '新建文件',
        newFolder: '新建目录',
        reveal: '定位当前文件',
        expandAll: '全部展开',
        collapseAll: '全部收起',
        hide: '隐藏',
        hideTerminal: '隐藏终端面板',
        settings: '设置',
        options: '选项',
        commitMessage: '提交信息',
        commitMessagePlaceholder: '输入提交信息…',
        amend: '修正上一次提交',
        commitAction: '提交',
        commitAndPush: '提交并推送…',
        changes: '更改',
        noChanges: '没有未提交的更改',
        selectAll: '全选',
        committing: '提交中…',
        committed: '提交完成',
        commitFailed: '提交失败',
        terminalNew: '新建终端',
        terminalClose: '关闭终端',
        terminalStarting: '正在启动 shell…',
        terminalEmpty: '没有打开的终端',
        terminalUnavailable: '当前运行环境未提供终端支持。',
        terminalShells: '选择 shell',
        terminalNoShell: '没有找到可用的 shell',
        terminalLimit: '终端标签已达上限（6 个），请先关闭一个再新建',
        terminalClear: '清屏（保留滚动缓冲）',
        copiedToClipboard: '已复制到剪贴板',
        clipboardWriteFailed: '浏览器拒绝了剪贴板写入',
        clipboardReadFailed: '浏览器拒绝了剪贴板读取',
        terminalClearBuffer: '清屏并清除滚动缓冲（历史一并丢弃）',
        terminalFontSize: '切换字号',
        resizeTerminal: '拖动调整终端高度',
        resizeToolWindow: '拖动调整工具窗口宽度',
        rename: '重命名',
        delete: '删除',
        deleteConfirm: '删除 {path}？此操作不可撤销。',
        deleteDirty: '其中 {count} 个文件还有未保存的编辑，删除后编辑器里的内容会一并丢失：{files}\n仍要删除吗？',
        showDiff: '显示差异',
        rollback: '回滚更改',
        rollbackStaged: '丢弃暂存版本（保留工作区改动）',
        rollbackWorking: '还原工作区（回到索引版本）',
        rollbackStagedConfirm: '把 {count} 个文件从暂存区撤出？工作区里的改动会保留。',
        tabChanges: '更改',
        tabLog: '日志',
        noCommits: '没有提交记录',
        commitDetails: '提交详情',
        selectCommit: '选择一条提交查看详情',
        rollbackConfirm: '回滚 {count} 个文件的未提交修改？此操作不可撤销。',
        invalidName: '请输入不含斜杠的名称',
        invalidNameNoSlashes: '请输入不含斜杠的名称',
        moveTo: '移动到…',
        moveToPlaceholder: '选择目标目录…',
        moveToCurrent: '当前位置',
        templateOn: '按文件类型生成骨架（IDEA 的 File Template）',
        templateOff: '创建空文件',
        openInEditor: '在编辑器中打开',
        expandFolder: '展开目录',
        copyDirectoryPath: '复制目录路径',
        openReadme: '打开此目录的 README',
        showHidden: '显示隐藏文件',
        moveIntoSelf: '不能把目录移动到自身内部',
        moveConflict: '{path} 已存在，未移动',
        movedCount: '已移动 {count} 项到 {target}',
        projectRoot: '项目根目录',
        movePartial: '已移动 {moved}；{path} 已存在，未移动',
        hideHidden: '隐藏隐藏文件',
        copyRelativePath: '复制相对路径',
        copyAbsolutePath: '复制绝对路径（可直接粘进终端）',
        copyPathWithLine: '复制为路径:行号',
        selectionCount: '已选 {count} 项',
        stagedGroup: '已暂存',
        unstagedGroup: '未暂存',
        emptyGroup: '无更改',
        stageAction: '暂存所选',
        unstageAction: '取消暂存所选',
        noDiff: '选择文件的变更查看差异',
        closeDiff: '关闭差异',
        previousChange: '上一个更改',
        nextChange: '下一个更改',
        hunkCounterHint: '差异位置（F7 / ⇧F7 跳转）',
        autoScrollOn: '自动跟随编辑器中的文件（Autoscroll from Source）已开启',
        autoScrollOff: '自动跟随编辑器中的文件已关闭',
        find: '查找',
        replace: '替换为',
        findNext: '下一个匹配',
        findPrevious: '上一个匹配',
        replaceAll: '全部替换',
        noMatches: '无匹配',
        saveConflict: '{path} 已在磁盘上被修改',
        commitConflicts: '有 {count} 个文件存在未解决的冲突，请先处理',
        commitWhitespace: '{count} 个文件存在行尾空白等问题，仍要提交吗？',
        compareWithRevision: '与修订比较…',
        compareRevisionMode: '与修订 {hash} 比较',
        compareRevisionPlaceholder: '按哈希、标题或作者搜索提交…',
        compareWithClipboard: '与剪贴板比较',
        compareClipboardMode: '与剪贴板内容比较',
        clipboardEmpty: '剪贴板是空的，没有可比较的内容',
        clipboardUnavailable: '无法读取剪贴板（浏览器未授权）',
        stageThisDirectory: '暂存此目录',
        rollbackDirectory: '回滚此目录的更改',
        unstageThisDirectory: '取消暂存此目录',
        commitSubjectTruncated: '主题超过 {limit} 列，日志与托管平台会截断',
        commitTemplates: '提交信息模板',
        identityMissing: '尚未配置 git 作者信息：请先执行 git config user.name / user.email',
        operationInProgress: '正在进行 {operation}：提交会记录为这次操作的一部分',
        groupByMode: '分组依据：{mode}',
        groupBy_flat: '不分组',
        groupBy_module: '按模块',
        groupBy_directory: '按目录',
        groupByMenu: '更改列表的分组方式',
        changeFilter: '按路径过滤更改',
        changeFilterPlaceholder: '按路径过滤…',
        commitTemplateHint: '把主题前缀设为 {prefix}:',
        stash: '暂存工作区（Stash）',
        stashSave: '暂存所有更改（含未跟踪文件）',
        stashEmpty: '没有可恢复的暂存',
        stashPop: '恢复最近的暂存：{subject}',
        stashPopConfirm: '把最近的暂存恢复到工作区？如果与当前改动冲突，会保留在栈中。',
        stashed: '已暂存工作区',
        stashPopped: '已恢复最近的暂存',
        stashApply: '应用 {ref}：{subject}',
        stashDrop: '丢弃 {ref}',
        stashDropConfirm: '丢弃 {ref}？这会永久删除这条暂存记录。',
        stashApplied: '已应用 {ref}（仍保留在栈中）',
        stashDropped: '已丢弃 {ref}',
        cherryPick: '拣选提交（Cherry-Pick）',
        revertCommit: '还原此提交（Revert）',
        historyActionConfirm: '对 {hash} 执行「{action}」？这会修改当前分支的历史。',
        historyActionDone: '{action} 已完成',
        openCommitDetails: '显示提交详情',
        fileHistoryOfCommit: '查看首个变更文件的历史',
        copyHash: '复制完整哈希',
        copySubject: '复制提交信息',
        checkoutRevision: '检出此提交',
        detachedHead: 'detached HEAD',
        detachedHeadHint: '想推送或更新请先检出分支',
        checkoutRevisionConfirm: '检出到 {hash}？会进入 detached HEAD 状态，工作区内容将切换到该提交。',
        checkoutRevisionDone: '已检出到 {hash}',
        restoreFileConfirm: '把 {path} 恢复到 {hash} 时的内容？当前未提交的修改会丢失。',
        restoreFileDone: '已把 {path} 恢复到该提交',
        branchPopup: '切换分支',
        noBranches: '没有本地分支',
        checkoutDirty: '有未保存的编辑，切换分支后这些改动可能被覆盖。仍要切换吗？',
        checkoutDone: '已切换到 {name}',
        newBranchAction: '新建分支…',
        newBranchPlaceholder: '新分支名，例如 feature/login',
        branchCreated: '已创建并切换到 {name}',
        createTagAction: '新建标签…',
        createTagPlaceholder: '标签名，例如 v1.2.0',
        tagCreated: '已创建标签 {name}',
        cancel: '取消',
        ok: '确定',
        commitSubjectCount: '主题 {count}/{limit}',
        commitSubjectHint: '首行是提交主题，建议控制在 50 个字符以内',
        commitBodyLines: '正文 {count} 行',
        commitSubjectShort: '主题过短',
        commitUntracked: '还有 {count} 个未纳入版本控制的文件没有选中，提交后它们会留在工作区。仍要提交吗？',
        undoClearedMessage: '撤销清空',
        pushing: '推送中…',
        retryPush: '重试推送',
        pushed: '已推送',
        pushedPublished: '已发布分支 {branch}',
        pushedFailed: '提交已完成，但推送失败：{message}',
        updateProject: '更新项目（拉取上游）',
        fetchRemote: '获取远端（Fetch）',
        updateDirty: '有未保存的编辑，更新后磁盘上的改动会被覆盖。仍要更新吗？',
        updateDone: '已更新 {branch}',
        fetchDone: '已获取 {count} 个远端',
        updateBusy: '更新中…',
        fetchBusy: '获取中…',
        overwrite: '覆盖保存',
        reloadFromDisk: '从磁盘重新加载',
        dismiss: '忽略',
        gotoFile: '转到文件',
        gotoFilePlaceholder: '输入文件名或路径…',
        recentFiles: '最近打开的文件',
        recentFilesPlaceholder: '筛选最近打开的文件…',
        recentEmpty: '这个工作区还没有打开过文件',
        gotoFileHint: '转到文件（⌘⇧O）',
        recentFilesHint: '最近打开的文件（⌘E）',
        terminalMoveToEditor: '移动到编辑器（Move to Editor）',
        terminalReturnToDock: '移回终端 Dock',
        stagedMode: '暂存区改动',
        unstagedMode: '工作区改动',
        /* The one editor tab a diff owns; it is replaced, never duplicated. */
        commitTab: '提交: {name}',
        compareTab: '比较: {name}',
        binaryDiff: '二进制文件不显示差异',
        allSelected: '已选择全部更改',
        partialSelected: '已选择 {count} 个文件',
        /* IDEA prints "5 files" after the group title; the directory rows reuse it. */
        filesCount: '{count} 个文件',
        moreActions: '更多操作',
        deleteSelected: '删除 {count} 个项目',
        unversionedGroup: '未纳入版本控制',
        logFilter: '过滤提交',
        sort_name: '按名称排序',
        conflictBadge: '冲突',
        conflictHint: '该文件存在未解决的冲突',
        acceptOurs: '接受当前更改',
        acceptTheirs: '接受传入更改',
        commitDiffMode: '提交 {hash} 中的改动',
        showHistory: '显示历史',
        fileHistory: '文件历史',
        noChangedFiles: '该提交没有变更文件',
        logRowHint: '右键：拣选 / 还原 / 复制哈希',
        logGraph: '提交图',
        graphBranch: '按分支过滤提交图',
        graphAllBranches: '全部分支',
        graphNoCommitsOnBranch: '该分支没有提交',
        graphNoCommitsOnRef: '该标签指向的提交不在当前范围里',
        graphFilterByRef: '只看 {ref} 的历史',
        graphAtChip: '标签 {hash} 的历史',
        graphClearScope: '清除标签过滤',
        graphFoldChains: '折叠单线提交',
        graphFoldedCount: '显示 {count} 行',
        graphFoldedRun: '省略 {count} 个单线提交',
        logFailed: '读取提交历史失败：{message}',
        logRetry: '重试',
        annotate: '注释（逐行作者）',
        annotateMode: '逐行作者',
        annotateTruncated: '仅显示前 200 行',
        closeAnnotate: '关闭注释',
        annotateOpenCommit: '单击在 Commit 的日志中打开这次提交',
        historyEmpty: '该文件没有提交历史',
        openAtRevision: '打开该提交中的版本',
        externalChanged: '磁盘上的文件已被外部修改',
        externalDeleted: '磁盘上的文件已被删除',
        recreateFile: '用编辑器内容重新创建',
        reload: '重新加载',
        keepLocal: '保留编辑器内容',
        externalBadge: '外部修改',
        clearHistory: '清除历史过滤',
        historyShowAll: '显示全部日志',
        logAuthor: '按作者过滤',
        logAuthorPlaceholder: '作者…',
        logEnd: '已显示全部提交',
        terminalPasteConfirm: '要粘贴 {count} 行到终端吗？',
        terminalCopyShortcut: '复制（⌘⇧C）',
        terminalPasteShortcut: '粘贴（⌘⇧V）',
        treeSearch: '在 Project 中搜索',
        treeSearchPlaceholder: '搜索文件名…',
        statusBarPosition: '第 {line} 行，第 {column} 列',
        terminalSplit: '拆分终端',
        terminalUnsplit: '取消拆分',
        terminalSplitResize: '拖动调整分屏宽度',
        terminalSplitReset: '拖动调整分屏宽度，双击恢复 50/50',
        terminalSplitPane: '右侧终端',
        terminalSplitRight: '在右侧分屏中打开',
        terminalOverflow: '还有 {count} 个终端标签',
        terminalOverflowTitle: '其他终端',
        tabsOverflow: '还有 {count} 个已打开的文件',
        tabsOverflowTitle: '其他文件',
        sort_type: '按类型排序',
        sort_modified: '按修改时间排序',
        openInTerminal: '在终端中打开',
        revealInFinder: '在访达中显示',
        logFilterPlaceholder: '按标题、作者或哈希过滤…',
        addToGitignore: '添加到 .gitignore',
        addedToGitignore: '已把 {count} 项写入 .gitignore',
        alreadyIgnored: '所选文件已在 .gitignore 中',
        deleteSelectedConfirm: '删除选中的 {count} 个项目？此操作不可撤销。',
        copySelectedPaths: '复制 {count} 个绝对路径',
        terminalCopy: '复制',
        terminalPaste: '粘贴',
        terminalSelectAll: '全选',
        terminalCloseOthers: '关闭其他终端',
        terminalOpenLink: '打开链接',
        terminalOpenFile: '在编辑器中打开 {path}',
        terminalMenu: '终端操作',
        terminalRename: '重命名标签',
        terminalColor: '切换标签颜色',
        terminalDuplicate: '复制终端',
        terminalReopen: '重新打开已关闭的终端',
        terminalReopenShortcut: '重新打开最近关闭的终端（⌘⇧T）',
        terminalLinkFailed: '无法打开 {path}',
        pathMissing: '目录已不存在：{path}',
        pathOutsideWorkspace: '该路径在工作区之外',
        saveAll: '保存全部',
        closeTab: '关闭 {name}',
        closeOtherTabs: '关闭其他标签页',
        closeAllTabs: '关闭全部标签页',
        closeTabMenu: '标签页操作',
        unsavedTitle: '有未保存的更改',
        unsavedTabsConfirm: '有 {count} 个文件尚未保存，仍要关闭吗？',
        gotoLine: '转到行',
        gotoLinePlaceholder: '行号或 行:列',
        gotoLineHint: '⌘/Ctrl+L',
        breadcrumb: '导航路径',
        revealInProject: '在 Project 中定位',
        copyTabPath: '复制文件路径',
        statusBarEol: '换行符',
        toggleEol: '切换换行符（LF / CRLF）',
        indentToggle: '切换缩进（空格 / Tab）',
        noActiveTab: '没有打开的标签页',
        lineCount: '{count} 行',
        selectionInfo: '已选 {count} 字符',
        savedAll: '已保存 {count} 个文件',
      },
    };
    const en = {
      view: { editor: VIEW_LABEL },
      editor: {
        files: 'Files',
        project: 'Project',
        resizeChat: 'Drag to resize the chat column',
        hideChat: 'Hide the chat column',
        showChat: 'Show the chat column',
        commit: 'Commit',
        terminal: 'Terminal',
        loading: 'Loading…',
        noFiles: 'No files to show',
        emptyDirectory: '(empty)',
        createIn: 'Create in',
        noFile: 'No file open',
        save: 'Save',
        saving: 'Saving…',
        saved: 'Saved',
        unsaved: 'Unsaved',
        refresh: 'Refresh',
        monacoError: 'Monaco failed to load',
        fileError: 'File operation failed',
        newFile: 'New File',
        newFolder: 'New Directory',
        reveal: 'Select Opened File',
        expandAll: 'Expand All',
        collapseAll: 'Collapse All',
        hide: 'Hide',
        hideTerminal: 'Hide terminal',
        settings: 'Settings',
        options: 'Options',
        commitMessage: 'Commit Message',
        commitMessagePlaceholder: 'Enter a commit message…',
        amend: 'Amend last commit',
        commitAction: 'Commit',
        commitAndPush: 'Commit and Push…',
        changes: 'Changes',
        noChanges: 'No uncommitted changes',
        selectAll: 'Select all',
        committing: 'Committing…',
        committed: 'Committed',
        commitFailed: 'Commit failed',
        terminalNew: 'New Terminal',
        terminalClose: 'Close Terminal',
        terminalStarting: 'Starting shell…',
        terminalEmpty: 'No terminal open',
        terminalUnavailable: 'This runtime provides no terminal support.',
        terminalShells: 'Choose shell',
        terminalNoShell: 'No shell found',
        terminalLimit: 'The dock holds at most 6 shells; close one tab first',
        terminalClear: 'Clear screen (keeps scrollback)',
        copiedToClipboard: 'Copied to clipboard',
        clipboardWriteFailed: 'The browser refused the clipboard write',
        clipboardReadFailed: 'The browser refused the clipboard read',
        terminalClearBuffer: 'Clear screen and scrollback (drops history)',
        terminalFontSize: 'Cycle font size',
        resizeTerminal: 'Drag to resize the terminal',
        resizeToolWindow: 'Drag to resize the tool window',
        rename: 'Rename',
        delete: 'Delete',
        deleteConfirm: 'Delete {path}? This cannot be undone.',
        deleteDirty: '{count} file(s) below still have unsaved edits; deleting removes the editor copy too: {files}\nDelete anyway?',
        showDiff: 'Show diff',
        rollback: 'Rollback changes',
        rollbackStaged: 'Discard Staged Version (keep working copy)',
        rollbackWorking: 'Revert Working Copy (back to the index)',
        rollbackStagedConfirm: 'Unstage {count} file(s)? The edits in the working tree stay.',
        tabChanges: 'Changes',
        tabLog: 'Log',
        noCommits: 'No commits yet',
        commitDetails: 'Commit details',
        selectCommit: 'Select a commit to see details',
        rollbackConfirm: 'Discard uncommitted changes in {count} file(s)? This cannot be undone.',
        invalidName: 'Enter a name without slashes',
        invalidNameNoSlashes: 'Enter a name without slashes',
        moveTo: 'Move to…',
        moveToPlaceholder: 'Choose the destination directory…',
        moveToCurrent: 'current location',
        templateOn: 'Add the file-type skeleton (IDEA File Template)',
        templateOff: 'Create an empty file',
        openInEditor: 'Open in editor',
        expandFolder: 'Expand folder',
        copyDirectoryPath: 'Copy directory path',
        openReadme: 'Open the directory README',
        showHidden: 'Show hidden files',
        moveIntoSelf: 'A directory cannot move inside itself',
        moveConflict: '{path} already exists; nothing was moved',
        movePartial: 'Moved {moved}; {path} already exists and was left alone',
        movedCount: 'Moved {count} item(s) to {target}',
        projectRoot: 'the project root',
        hideHidden: 'Hide hidden files',
        copyRelativePath: 'Copy relative path',
        copyAbsolutePath: 'Copy absolute path (shell-ready)',
        copyPathWithLine: 'Copy as Path:Line',
        selectionCount: '{count} selected',
        stagedGroup: 'Staged',
        unstagedGroup: 'Unstaged',
        emptyGroup: 'No changes',
        stageAction: 'Stage selected',
        unstageAction: 'Unstage selected',
        noDiff: 'Select a change to see its diff',
        closeDiff: 'Close diff',
        previousChange: 'Previous change',
        nextChange: 'Next change',
        hunkCounterHint: 'Diff position (F7 / Shift+F7 to jump)',
        autoScrollOn: 'Autoscroll from Source is on',
        autoScrollOff: 'Autoscroll from Source is off',
        find: 'Find',
        replace: 'Replace with',
        findNext: 'Next match',
        findPrevious: 'Previous match',
        replaceAll: 'Replace all',
        noMatches: 'No matches',
        saveConflict: '{path} changed on disk',
        commitConflicts: '{count} file(s) have unresolved conflicts; resolve them first',
        commitWhitespace: '{count} file(s) have whitespace problems. Commit anyway?',
        compareWithRevision: 'Compare with Revision…',
        compareRevisionMode: 'Compared with revision {hash}',
        compareRevisionPlaceholder: 'Search commits by hash, subject or author…',
        compareWithClipboard: 'Compare with Clipboard',
        compareClipboardMode: 'Compared with clipboard',
        clipboardEmpty: 'The clipboard is empty; nothing to compare',
        clipboardUnavailable: 'Cannot read the clipboard (permission denied)',
        stageThisDirectory: 'Stage This Directory',
        rollbackDirectory: 'Roll Back This Directory',
        unstageThisDirectory: 'Unstage This Directory',
        commitSubjectTruncated: 'Subject exceeds {limit} columns; git log and forges truncate it',
        commitTemplates: 'Commit templates',
        identityMissing: 'git author identity is not configured: run git config user.name / user.email',
        operationInProgress: 'A {operation} is in progress: this commit becomes part of it',
        groupByMode: 'Group by: {mode}',
        groupBy_flat: 'Nothing',
        groupBy_module: 'Module',
        groupBy_directory: 'Directory',
        groupByMenu: 'How the change list groups files',
        changeFilter: 'Filter changes by path',
        changeFilterPlaceholder: 'Filter by path…',
        commitTemplateHint: 'Set the subject prefix to {prefix}:',
        stash: 'Stash Changes',
        stashSave: 'Stash all changes (including untracked)',
        stashEmpty: 'Nothing to restore',
        stashPop: 'Restore latest stash: {subject}',
        stashPopConfirm: 'Restore the latest stash into the working tree? A conflicting pop stays on the stack.',
        stashed: 'Working tree stashed',
        stashPopped: 'Latest stash restored',
        stashApply: 'Apply {ref}: {subject}',
        stashDrop: 'Drop {ref}',
        stashDropConfirm: 'Drop {ref}? The entry is deleted for good.',
        stashApplied: 'Applied {ref} (still on the stack)',
        stashDropped: 'Dropped {ref}',
        cherryPick: 'Cherry-Pick Commit',
        revertCommit: 'Revert Commit',
        historyActionConfirm: 'Run "{action}" on {hash}? This rewrites the current branch history.',
        historyActionDone: '{action} finished',
        openCommitDetails: 'Show commit details',
        fileHistoryOfCommit: 'Show history of the first changed file',
        copyHash: 'Copy full hash',
        copySubject: 'Copy Commit Message',
        checkoutRevision: 'Checkout Revision',
        detachedHead: 'detached HEAD',
        detachedHeadHint: 'check out a branch to push or update',
        checkoutRevisionConfirm: 'Check out {hash}? HEAD becomes detached and the working tree switches to that commit.',
        checkoutRevisionDone: 'Checked out {hash}',
        restoreFileConfirm: 'Restore {path} to its content at {hash}? Uncommitted changes to it are lost.',
        restoreFileDone: 'Restored {path} to that commit',
        branchPopup: 'Checkout branch',
        noBranches: 'No local branches',
        checkoutDirty: 'Some files have unsaved edits that the checkout may discard. Switch anyway?',
        checkoutDone: 'Checked out {name}',
        newBranchAction: 'New Branch…',
        newBranchPlaceholder: 'New branch name, e.g. feature/login',
        branchCreated: 'Created and checked out {name}',
        createTagAction: 'New Tag…',
        createTagPlaceholder: 'Tag name, e.g. v1.2.0',
        tagCreated: 'Created tag {name}',
        cancel: 'Cancel',
        ok: 'OK',
        commitSubjectCount: 'Subject {count}/{limit}',
        commitSubjectHint: 'The first line is the subject; keep it within 50 characters',
        commitBodyLines: 'Body: {count} line(s)',
        commitSubjectShort: 'Subject is very short',
        commitUntracked: '{count} unversioned file(s) are not selected and will stay in the working tree. Commit anyway?',
        undoClearedMessage: 'Undo',
        pushing: 'Pushing…',
        retryPush: 'Retry Push',
        pushed: 'Pushed',
        pushedPublished: 'Published branch {branch}',
        pushedFailed: 'Committed, but the push failed: {message}',
        updateProject: 'Update Project',
        fetchRemote: 'Fetch Remotes',
        updateDirty: 'Some files have unsaved edits that the update may discard. Update anyway?',
        updateDone: 'Updated {branch}',
        fetchDone: 'Fetched {count} remote(s)',
        updateBusy: 'Updating…',
        fetchBusy: 'Fetching…',
        overwrite: 'Overwrite',
        reloadFromDisk: 'Reload from disk',
        dismiss: 'Dismiss',
        gotoFile: 'Go to File',
        gotoFilePlaceholder: 'Type a file name or path…',
        recentFiles: 'Recent Files',
        recentFilesPlaceholder: 'Filter recent files…',
        recentEmpty: 'No file has been opened in this workspace yet',
        gotoFileHint: 'Go to File (⌘⇧O)',
        recentFilesHint: 'Recent Files (⌘E)',
        terminalMoveToEditor: 'Move to Editor',
        terminalReturnToDock: 'Move back to the terminal dock',
        stagedMode: 'Staged changes',
        unstagedMode: 'Working tree changes',
        commitTab: 'Commit: {name}',
        compareTab: 'Compare: {name}',
        binaryDiff: 'Binary files have no text diff',
        allSelected: 'All changes selected',
        partialSelected: '{count} files selected',
        filesCount: '{count} files',
        moreActions: 'More actions',
        deleteSelected: 'Delete {count} Items',
        unversionedGroup: 'Unversioned Files',
        logFilter: 'Filter commits',
        sort_name: 'Sort by name',
        conflictBadge: 'CONFLICT',
        conflictHint: 'This file has unresolved conflicts',
        acceptOurs: 'Accept Yours',
        acceptTheirs: 'Accept Theirs',
        commitDiffMode: 'Changes in commit {hash}',
        showHistory: 'Show History',
        fileHistory: 'File History',
        noChangedFiles: 'This commit changed no files',
        logRowHint: 'Right-click: cherry-pick / revert / copy hash',
        logGraph: 'Commit Graph',
        graphBranch: 'Filter the graph by branch',
        graphAllBranches: 'All branches',
        graphNoCommitsOnBranch: 'No commits on this branch',
        graphNoCommitsOnRef: 'The tagged commit is outside this range',
        graphFilterByRef: 'Show only the history of {ref}',
        graphAtChip: 'History of tag at {hash}',
        graphClearScope: 'Clear the tag filter',
        graphFoldChains: 'Fold linear runs',
        graphFoldedCount: '{count} rows',
        graphFoldedRun: '{count} linear commit(s) folded',
        logFailed: 'Could not read the commit history: {message}',
        logRetry: 'Retry',
        annotate: 'Annotate',
        annotateMode: 'Per-line attribution',
        annotateTruncated: 'First 200 lines only',
        closeAnnotate: 'Close annotate',
        annotateOpenCommit: 'Click to open this commit in the Commit log',
        historyEmpty: 'No commits touched this file',
        openAtRevision: 'Open this revision',
        externalChanged: 'This file changed on disk',
        externalDeleted: 'This file was deleted on disk',
        recreateFile: 'Recreate from editor',
        reload: 'Reload from disk',
        keepLocal: 'Keep editor contents',
        externalBadge: 'External change',
        clearHistory: 'Clear history filter',
        historyShowAll: 'Show all commits',
        logAuthor: 'Filter by author',
        logAuthorPlaceholder: 'Author…',
        logEnd: 'End of history',
        terminalPasteConfirm: 'Paste {count} lines into the terminal?',
        terminalCopyShortcut: 'Copy (⌘⇧C)',
        terminalPasteShortcut: 'Paste (⌘⇧V)',
        treeSearch: 'Search in Project',
        treeSearchPlaceholder: 'Search file names…',
        statusBarPosition: 'Ln {line}, Col {column}',
        terminalSplit: 'Split Terminal',
        terminalUnsplit: 'Unsplit Terminal',
        terminalSplitResize: 'Drag to resize the split',
        terminalSplitReset: 'Drag to resize the split; double-click to reset 50/50',
        terminalSplitPane: 'Right pane terminal',
        terminalSplitRight: 'Open in Right Split',
        terminalOverflow: '{count} more terminal tab(s)',
        terminalOverflowTitle: 'Other terminals',
        tabsOverflow: '{count} more open file(s)',
        tabsOverflowTitle: 'Other files',
        sort_type: 'Sort by type',
        sort_modified: 'Sort by modification time',
        openInTerminal: 'Open in Terminal',
        revealInFinder: 'Reveal in Finder',
        logFilterPlaceholder: 'Filter by subject, author or hash…',
        addToGitignore: 'Add to .gitignore',
        addedToGitignore: 'Added {count} entr(ies) to .gitignore',
        alreadyIgnored: 'The selected files are already ignored',
        deleteSelectedConfirm: 'Delete the {count} selected items? This cannot be undone.',
        copySelectedPaths: 'Copy {count} Absolute Paths',
        terminalCopy: 'Copy',
        terminalPaste: 'Paste',
        terminalSelectAll: 'Select All',
        terminalCloseOthers: 'Close Other Terminals',
        terminalOpenLink: 'Open Link',
        terminalOpenFile: 'Open {path} in editor',
        terminalMenu: 'Terminal actions',
        terminalRename: 'Rename Tab',
        terminalColor: 'Cycle Tab Color',
        terminalDuplicate: 'Duplicate Terminal',
        terminalReopen: 'Reopen Closed Terminal',
        terminalReopenShortcut: 'Reopen last closed terminal (⌘⇧T)',
        terminalLinkFailed: 'Cannot open {path}',
        pathMissing: 'This directory no longer exists: {path}',
        pathOutsideWorkspace: 'That path is outside the workspace',
        saveAll: 'Save All',
        closeTab: 'Close {name}',
        closeOtherTabs: 'Close Other Tabs',
        closeAllTabs: 'Close All Tabs',
        closeTabMenu: 'Tab actions',
        unsavedTitle: 'Has unsaved changes',
        unsavedTabsConfirm: '{count} file(s) have unsaved changes. Close anyway?',
        gotoLine: 'Go to Line',
        gotoLinePlaceholder: 'Line or line:column',
        gotoLineHint: '⌘/Ctrl+L',
        breadcrumb: 'Navigation path',
        revealInProject: 'Select in Project View',
        copyTabPath: 'Copy file path',
        statusBarEol: 'Line separator',
        toggleEol: 'Toggle line separator (LF / CRLF)',
        indentToggle: 'Toggle indentation (spaces / tabs)',
        noActiveTab: 'No tab open',
        lineCount: '{count} lines',
        selectionInfo: '{count} characters selected',
        savedAll: 'Saved {count} file(s)',
      },
    };

    /**
     * Flatten a nested dictionary into the locale service's dotted-key form.
     * @param {object} source - nested dictionary.
     * @param {string} prefix - accumulated key prefix.
     * @param {object} target - flat output.
     * @returns {object} flat dictionary.
     */
    function flattenDictionary(source, prefix = '', target = {}) {
      for (const [key, value] of Object.entries(source)) {
        const fullKey = prefix === '' ? key : `${prefix}.${key}`;
        if (value !== null && typeof value === 'object' && !Array.isArray(value)) flattenDictionary(value, fullKey, target);
        else target[fullKey] = value;
      }
      return target;
    }

    /** Services the browser half needs. */
    const inject = ['locale'];

    /** File extensions mapped to Monaco language ids. */
    const LANGUAGE_BY_EXTENSION = {
      ts: 'typescript',
      tsx: 'typescript',
      mts: 'typescript',
      cts: 'typescript',
      js: 'javascript',
      jsx: 'javascript',
      mjs: 'javascript',
      cjs: 'javascript',
      json: 'json',
      jsonc: 'json',
      md: 'markdown',
      markdown: 'markdown',
      mdx: 'markdown',
      css: 'css',
      scss: 'scss',
      less: 'less',
      html: 'html',
      htm: 'html',
      vue: 'html',
      svelte: 'html',
      py: 'python',
      pyw: 'python',
      go: 'go',
      rs: 'rust',
      java: 'java',
      c: 'c',
      h: 'c',
      cc: 'cpp',
      cpp: 'cpp',
      cxx: 'cpp',
      hpp: 'cpp',
      cs: 'csharp',
      php: 'php',
      rb: 'ruby',
      sh: 'shell',
      bash: 'shell',
      zsh: 'shell',
      ps1: 'powershell',
      yaml: 'yaml',
      yml: 'yaml',
      toml: 'ini',
      ini: 'ini',
      xml: 'xml',
      svg: 'xml',
      sql: 'sql',
      kt: 'kotlin',
      kts: 'kotlin',
      swift: 'swift',
      dart: 'dart',
      lua: 'lua',
      r: 'r',
      dockerfile: 'dockerfile',
      makefile: 'makefile',
    };

    /**
     * The skeleton IDEA's "New from Template" writes for a file name.
     *
     * IDEA's File Templates are per-language, not one blank file: a `.ts` file
     * arrives with an export marker, a `.md` with a title, a test with a `describe`
     * skeleton. Only the common cases are covered here — an unknown extension must
     * stay a genuinely empty file rather than gain boilerplate nobody asked for.
     * @param {string} name - the file name being created (its extension decides).
     * @returns {string} starter content, possibly empty.
     */
    function templateFor(name) {
      const clean = typeof name === 'string' ? name.trim() : '';
      const dot = clean.lastIndexOf('.');
      if (dot <= 0 || dot === clean.length - 1) return '';
      const extension = clean.slice(dot + 1).toLowerCase();
      const base = clean.slice(0, dot);
      switch (extension) {
        case 'ts':
        case 'tsx':
          return 'export {};\n';
        case 'js':
        case 'jsx':
        case 'mjs':
        case 'cjs':
          return "'use strict';\n";
        case 'py':
          return `"""${base}."""\n`;
        case 'md':
        case 'markdown':
          return `# ${base}\n`;
        case 'go':
          return 'package main\n';
        case 'sh':
        case 'bash':
        case 'zsh':
          return '#!/usr/bin/env bash\nset -euo pipefail\n';
        case 'json':
          return '{}\n';
        case 'css':
          return '';
        case 'html':
          return `<!doctype html>\n<html lang="en">\n  <head>\n    <meta charset="utf-8" />\n    <title>${base}</title>\n  </head>\n  <body></body>\n</html>\n`;
        default:
          /* No opinion: an unknown extension keeps the blank file. */
          return '';
      }
    }

    /**
     * Identity of the pinned Commit-diff tab inside the editor's strip.
     *
     * A NUL prefix cannot collide with a workspace path, so the strip can treat
     * this key and a file path in the same overflow list without a type check.
     */
    const DIFF_TAB_KEY = '\u0000dsh-editor-diff';

    const styles = {
      root: {
        display: 'flex',
        flexDirection: 'column',
        flex: '1 1 0',
        minWidth: 0,
        minHeight: 0,
        height: '100%',
        overflow: 'hidden',
        background: 'var(--dsw-alias-bg-base)',
      },
      /* The `branchChip` was originally the header's branch button; the Commit
         toolbar still uses it for the same chip, so it lives on. */
      branchChip: {
        display: 'inline-flex',
        alignItems: 'center',
        flex: 'none',
        height: 18,
        padding: '0 6px',
        borderRadius: 9,
        background: 'var(--dsw-alias-interactive-bg-hover-solid)',
        color: 'var(--dsw-alias-label-secondary)',
        fontSize: 10,
        fontWeight: 500,
        whiteSpace: 'nowrap',
      },
      body: {
        display: 'flex',
        flex: '1 1 0',
        minHeight: 0,
        minWidth: 0,
      },
      stripe: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        /* IDEA's stripe is a thin rail; 42px wasted a readable column of tree width. */
        flex: '0 0 36px',
        width: 36,
        minHeight: 0,
        paddingTop: 6,
        gap: 2,
        background: 'var(--dsw-alias-bg-layer-1)',
        borderRight: '0.5px solid var(--dsw-alias-border-l3)',
      },
      stripeItem: {
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 3,
        width: '100%',
        minHeight: 54,
        padding: '5px 0',
        border: 'none',
        borderLeft: '2px solid transparent',
        background: 'transparent',
        color: 'var(--dsw-alias-label-tertiary)',
        cursor: 'pointer',
        font: 'inherit',
      },
      stripeItemActive: {
        borderLeftColor: 'var(--dsw-alias-state-business-primary)',
        background: 'var(--dsw-alias-bg-base)',
        color: 'var(--dsw-alias-label-primary)',
      },
      stripeText: {
        writingMode: 'vertical-rl',
        transform: 'rotate(180deg)',
        /* The rail is 36px: an 11px vertical label with letter-spacing clips the
           last glyph of "Terminal". 10px with no tracking still reads. */
        fontSize: 10,
        lineHeight: 1.1,
        letterSpacing: 0,
        whiteSpace: 'nowrap',
      },
      sideResize: {
        flex: 'none',
        width: 4,
        cursor: 'col-resize',
        background: 'transparent',
      },
      renameInput: {
        flex: '1 1 0',
        minWidth: 0,
        height: 18,
        padding: '0 3px',
        border: '1px solid var(--dsw-alias-state-business-primary)',
        borderRadius: 3,
        outline: 'none',
        background: 'var(--dsw-alias-bg-base)',
        color: 'var(--dsw-alias-label-primary)',
        fontSize: 12,
        fontFamily: 'inherit',
      },
      paletteBackdrop: {
        position: 'fixed',
        inset: 0,
        zIndex: 2500,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-start',
        paddingTop: '12vh',
        background: 'rgba(0, 0, 0, 0.28)',
      },
      palette: {
        display: 'flex',
        flexDirection: 'column',
        width: 'min(560px, 88vw)',
        maxHeight: '56vh',
        border: '0.5px solid var(--dsw-alias-border-l3)',
        borderRadius: 8,
        background: 'var(--dsw-alias-bg-base)',
        boxShadow: '0 16px 48px rgba(0, 0, 0, 0.32)',
        overflow: 'hidden',
      },
      paletteInput: {
        height: 34,
        padding: '0 12px',
        border: 'none',
        borderBottom: '0.5px solid var(--dsw-alias-border-l3)',
        outline: 'none',
        background: 'var(--dsw-alias-bg-base)',
        color: 'var(--dsw-alias-label-primary)',
        fontSize: 13,
        fontFamily: 'inherit',
      },
      /* IDEA's in-tool-window name prompt (New Branch / New Tag). */
      namePrompt: {
        width: 320,
        padding: '12px 14px 10px',
        borderRadius: 8,
        background: 'var(--dsw-alias-bg-base)',
        boxShadow: '0 12px 32px rgba(0, 0, 0, 0.28)',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      },
      namePromptTitle: {
        color: 'var(--dsw-alias-label-primary)',
        fontSize: 12,
        fontWeight: 600,
      },
      namePromptInput: {
        height: 28,
        padding: '0 8px',
        border: '1px solid var(--dsw-alias-border-l3)',
        borderRadius: 4,
        outline: 'none',
        background: 'var(--dsw-alias-bg-base)',
        color: 'var(--dsw-alias-label-primary)',
        fontSize: 12,
        fontFamily: 'inherit',
      },
      namePromptError: {
        color: 'var(--dsw-alias-state-error-primary)',
        fontSize: 11,
        lineHeight: '15px',
      },
      namePromptButtons: {
        display: 'flex',
        justifyContent: 'flex-end',
        gap: 6,
      },
      paletteList: {
        /* `1 1 0` collapsed to zero: the dialog is an AUTO-HEIGHT column, so a
           zero flex-basis contributes no height and the circular sizing resolves
           to "list is empty". Measured before the fix: 17 rows existed, the list
           box was 8px and `overflow: hidden` on the dialog clipped every one of
           them — Go to File looked like an input with nothing under it.
           `auto` lets the list contribute its content height, and `minHeight: 0`
           still lets it shrink inside the dialog's 56vh cap so it scrolls. */
        flex: '1 1 auto',
        minHeight: 0,
        overflow: 'auto',
        padding: '4px 0',
      },
      paletteRow: {
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        height: 24,
        padding: '0 10px',
        color: 'var(--dsw-alias-label-secondary)',
        fontSize: 12,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
      },
      paletteRowActive: {
        background: 'var(--dsw-alias-state-business-primary)',
        color: '#fff',
      },
      paletteName: {
        minWidth: 0,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      },
      paletteDir: {
        marginLeft: 'auto',
        paddingLeft: 8,
        color: 'var(--dsw-alias-label-tertiary)',
        fontSize: 10,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      },
      menu: {
        position: 'fixed',
        zIndex: 2600,
        minWidth: 188,
        padding: '4px 0',
        border: '0.5px solid var(--dsw-alias-border-l3)',
        borderRadius: 6,
        background: 'var(--dsw-alias-bg-base)',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.28)',
        fontSize: 12,
        userSelect: 'none',
      },
      menuItem: {
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        width: '100%',
        height: 24,
        padding: '0 8px 0 10px',
        border: 'none',
        /* No inline `background`: an inline declaration outranks the injected
           `:hover` rule, which is why hovering a menu row showed nothing. The
           menu's own background already shows through, so "unset" is correct. */
        color: 'var(--dsw-alias-label-primary)',
        font: 'inherit',
        textAlign: 'left',
        cursor: 'pointer',
      },
      menuItemDanger: {
        color: 'var(--dsw-alias-state-error-primary)',
      },
      menuItemDisabled: {
        opacity: 0.4,
        cursor: 'default',
      },
      menuShortcut: {
        flex: 'none',
        marginLeft: 'auto',
        paddingLeft: 16,
        color: 'var(--dsw-alias-label-tertiary)',
        fontSize: 10,
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
      },
      /* 3px colour stripe matching the tab's own stripe. */
      menuSwatch: {
        flex: 'none',
        width: 3,
        height: 12,
        marginRight: 6,
        borderRadius: 2,
      },
      /* Child menu, anchored to the parent item it belongs to. */
      /* Flips to the parent's left edge when there is no room on the right. */
      submenuLeft: {
        left: 'auto',
        right: '100%',
      },
      submenu: {
        position: 'absolute',
        left: '100%',
        top: -4,
        /* A 220px minimum overflows a narrow aside; the cap keeps the child inside
           the window when the parent already sits near an edge. */
        minWidth: 180,
        maxWidth: 'min(260px, 60vw)',
        padding: '4px 0',
        borderRadius: 6,
        background: 'var(--dsw-alias-bg-base)',
        boxShadow: '0 10px 28px rgba(0, 0, 0, 0.28)',
        zIndex: 1,
      },
      menuLabel: {
        flex: '1 1 auto',
        minWidth: 0,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      },
      menuTitle: {
        padding: '3px 10px 4px',
        color: 'var(--dsw-alias-label-tertiary)',
        fontSize: 10,
        whiteSpace: 'nowrap',
        pointerEvents: 'none',
      },
      menuSeparator: {
        /* A 1px line inset from both edges, without a background of its own: the
           row is 1px tall, so a `background` here painted a solid block that read
           as a break in the menu rather than a separator. */
        height: 0,
        margin: '4px 8px',
        borderTop: '1px solid var(--dsw-alias-border-l3)',
      },
      workArea: {
        display: 'flex',
        flex: '1 1 0',
        minWidth: 0,
        minHeight: 0,
      },
      sidePanel: {
        display: 'flex',
        flexDirection: 'column',
        containerType: 'inline-size',
        containerName: 'dsh-editor-side',
        flex: '0 0 25%',
        minWidth: 180,
        maxWidth: '72%',
        minHeight: 0,
        overflow: 'hidden',
        background: 'var(--dsw-alias-bg-base)',
        borderRight: '0.5px solid var(--dsw-alias-border-l3)',
      },
      panelToolbar: {
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        flex: 'none',
        height: 32,
        padding: '0 5px',
        borderBottom: '0.5px solid var(--dsw-alias-border-l3)',
        color: 'var(--dsw-alias-label-secondary)',
      },
      panelTitle: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        /* The title keeps its words; actions are what collapse into "»". */
        flex: '0 0 auto',
        minWidth: 0,
        maxWidth: '52%',
        overflow: 'hidden',
        marginRight: 4,
        color: 'var(--dsw-alias-label-secondary)',
        fontSize: 11,
        fontWeight: 600,
        whiteSpace: 'nowrap',
        textOverflow: 'ellipsis',
      },
      toolbarButton: {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flex: 'none',
        width: 24,
        height: 24,
        padding: 0,
        border: 'none',
        borderRadius: 4,
        background: 'transparent',
        color: 'var(--dsw-alias-label-secondary)',
        cursor: 'pointer',
      },
      toolbarButtonDisabled: {
        opacity: 0.4,
        cursor: 'default',
      },
      /* IDEA's pressed toggle: a tinted plate, not just a darker glyph. The token is
         the host's ghost-button active fill — `interactive-bg-select` does not exist
         in the theme and resolves to nothing, which renders as "toggle did nothing". */
      toolbarButtonActive: {
        background: 'var(--dsw-alias-button-ghost-active-fill)',
        color: 'var(--dsw-alias-label-primary)',
      },
      toolbarSpacer: {
        flex: '1 1 auto',
        minWidth: 4,
      },
      /* The tree lights up while a row is dragged over its empty area. */
      treeRootDrop: {
        boxShadow: 'inset 0 0 0 1px var(--dsw-alias-state-business-primary)',
      },
      treeScroll: {
        flex: '1 1 0',
        minHeight: 0,
        overflow: 'auto',
        padding: '4px 0 8px',
        outline: 'none',
      },
      treeSearchRow: {
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        flex: 'none',
        height: 26,
        padding: '0 6px',
        borderBottom: '0.5px solid var(--dsw-alias-border-l3)',
        background: 'var(--dsw-alias-bg-layer-1)',
      },
      treeRow: {
        display: 'flex',
        alignItems: 'center',
        gap: 3,
        /* One step up from 22/12: IDEA's project tree reads larger than a dense list. */
        height: 24,
        paddingRight: 8,
        color: 'var(--dsw-alias-label-secondary)',
        fontSize: 13,
        lineHeight: '24px',
        whiteSpace: 'nowrap',
        cursor: 'pointer',
        userSelect: 'none',
      },
      treeRowSelected: {
        background: 'var(--dsw-alias-state-business-primary)',
        color: '#fff',
      },
      /* Extended (⌘/Shift) selection: IDEA fills it lighter than the primary row. */
      treeRowSelectedSoft: {
        background: 'var(--dsw-alias-interactive-bg-hover-solid)',
        color: 'var(--dsw-alias-label-primary)',
      },
      chevron: {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flex: 'none',
        width: 12,
        height: 12,
        color: 'var(--dsw-alias-label-tertiary)',
      },
      treeIcon: {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flex: 'none',
        width: 18,
        height: 18,
      },
      /* IDEA's speed-search hit: the matched run is boxed, not the whole label. */
      treeNameMatch: {
        borderRadius: 2,
        background: 'rgba(255, 196, 0, 0.38)',
        boxShadow: '0 0 0 1px rgba(255, 196, 0, 0.55)',
      },
      treeName: {
        minWidth: 0,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      },
      treeRootName: {
        fontWeight: 600,
        color: 'var(--dsw-alias-label-primary)',
      },
      treeRootLabel: {
        flex: 'none',
        maxWidth: '62%',
      },
      /* The path yields first: it is capped and ellipsized before the name is. */
      treeRootPath: {
        minWidth: 0,
        flex: '1 1 auto',
        marginLeft: 'auto',
        paddingLeft: 6,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        color: 'var(--dsw-alias-label-tertiary)',
        fontSize: 10,
        textAlign: 'right',
        whiteSpace: 'nowrap',
      },
      treePath: {
        minWidth: 0,
        marginLeft: 'auto',
        paddingLeft: 8,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        color: 'var(--dsw-alias-label-tertiary)',
        fontSize: 11,
      },
      /* Same column, no line: the subtree below ended. */
      /* IDEA's elbow under a subtree's last child: the vertical line runs from the
         row's top to its middle, then turns right as a short arm (└). Built from two
         borders on a half-height, half-width box so it scales with the row. */
      indentGuideCorner: {
        flex: 'none',
        /* Exactly the same horizontal footprint as the line/stop guides. The old
           `marginRight: 6` made every LAST child sit 6px right of its siblings
           (measured: a last file's badge started 13 device px — 6 CSS px at 2x —
           right of the row above it), which read as a broken indent. */
        width: 14,
        height: '50%',
        borderLeft: '1px solid var(--dsw-alias-border-l3)',
        borderBottom: '1px solid var(--dsw-alias-border-l3)',
        borderBottomLeftRadius: 3,
        opacity: 0.7,
        /* The arm ends at the column edge; the row's own 3px gap is the breathing room. */
        marginRight: 0,
        boxSizing: 'border-box',
      },
      /* `boxSizing: border-box` on ALL THREE is load-bearing: with the default
         content-box a 14px guide that also draws a 1px left border occupies 15px,
         so a row whose column continues was 1px further right than one whose
         column had ended — the same depth, two different indents. */
      indentGuideStop: {
        flex: 'none',
        width: 14,
        height: '100%',
        boxSizing: 'border-box',
      },
      indentGuide: {
        flex: 'none',
        width: 14,
        height: '100%',
        borderLeft: '1px solid var(--dsw-alias-border-l3)',
        opacity: 0.55,
        boxSizing: 'border-box',
      },
      treeMessage: {
        padding: '4px 12px',
        color: 'var(--dsw-alias-label-tertiary)',
        fontSize: 11,
        lineHeight: '18px',
        whiteSpace: 'pre-wrap',
      },
      statusBadge: {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flex: 'none',
        width: 16,
        fontSize: 10,
        fontWeight: 700,
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
      },
      createParentSelect: {
        flex: 'none',
        maxWidth: 120,
        height: 18,
        border: '0.5px solid var(--dsw-alias-border-l3)',
        borderRadius: 3,
        background: 'var(--dsw-alias-bg-base)',
        color: 'var(--dsw-alias-label-secondary)',
        fontSize: 10,
        fontFamily: 'inherit',
      },
      /* The file-template switch in the create row: a monospace `{ }` that lights
         up when the skeleton is on, matching the other 18px controls beside it. */
      createTemplateToggle: {
        flex: 'none',
        width: 26,
        height: 18,
        padding: 0,
        border: '0.5px solid var(--dsw-alias-border-l3)',
        borderRadius: 3,
        background: 'var(--dsw-alias-bg-base)',
        color: 'var(--dsw-alias-label-tertiary)',
        fontSize: 9,
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        lineHeight: '16px',
        cursor: 'pointer',
      },
      createTemplateToggleOn: {
        borderColor: 'var(--dsw-alias-state-business-primary)',
        color: 'var(--dsw-alias-state-business-primary)',
      },
      createRow: {
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        flex: 'none',
        height: 28,
        padding: '0 8px',
        borderBottom: '0.5px solid var(--dsw-alias-border-l3)',
        background: 'var(--dsw-alias-bg-layer-1)',
      },
      createInput: {
        flex: '1 1 0',
        minWidth: 0,
        height: 21,
        padding: '0 5px',
        border: '1px solid var(--dsw-alias-state-business-primary)',
        borderRadius: 3,
        outline: 'none',
        background: 'var(--dsw-alias-bg-base)',
        color: 'var(--dsw-alias-label-primary)',
        fontSize: 12,
        fontFamily: 'inherit',
      },
      createHint: {
        flex: 'none',
        maxWidth: '45%',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        color: 'var(--dsw-alias-label-tertiary)',
        fontSize: 10,
        whiteSpace: 'nowrap',
      },
      commitTabs: {
        display: 'flex',
        alignItems: 'stretch',
        flex: 'none',
        height: 26,
        borderBottom: '0.5px solid var(--dsw-alias-border-l3)',
        background: 'var(--dsw-alias-bg-layer-1)',
      },
      commitTab: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        padding: '0 10px',
        border: 'none',
        borderBottom: '2px solid transparent',
        background: 'transparent',
        color: 'var(--dsw-alias-label-secondary)',
        fontSize: 11,
        cursor: 'pointer',
        font: 'inherit',
      },
      commitTabActive: {
        color: 'var(--dsw-alias-label-primary)',
        borderBottomColor: 'var(--dsw-alias-state-business-primary)',
        background: 'var(--dsw-alias-bg-base)',
      },
      logToolbar: {
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        flex: 'none',
        height: 26,
        padding: '0 4px 0 10px',
        borderBottom: '0.5px solid var(--dsw-alias-border-l3)',
      },
      logHash: {
        flex: 'none',
        width: 52,
        color: 'var(--dsw-alias-label-tertiary)',
        fontSize: 10,
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
      },
      logSubject: {
        minWidth: 0,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        color: 'var(--dsw-alias-label-primary)',
        fontSize: 11,
        whiteSpace: 'nowrap',
      },
      logMeta: {
        color: 'var(--dsw-alias-label-tertiary)',
        fontSize: 10,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      },
      logDetail: {
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        padding: '8px 10px',
      },
      logBody: {
        margin: 0,
        padding: 6,
        border: '0.5px solid var(--dsw-alias-border-l3)',
        borderRadius: 4,
        background: 'var(--dsw-alias-bg-layer-1)',
        color: 'var(--dsw-alias-label-secondary)',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
        fontSize: 10,
        whiteSpace: 'pre-wrap',
      },
      historyChip: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        flex: '0 1 auto',
        minWidth: 0,
        height: 17,
        padding: '0 4px 0 6px',
        borderRadius: 9,
        background: 'var(--dsw-alias-interactive-bg-hover-solid)',
        color: 'var(--dsw-alias-label-secondary)',
        fontSize: 10,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      },
      historyChipShowAll: {
        marginLeft: 4,
        padding: '0 5px',
        border: 'none',
        borderRadius: 3,
        background: 'transparent',
        color: 'var(--dsw-alias-state-business-primary)',
        fontSize: 10,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
      },
      historyChipClear: {
        border: 'none',
        background: 'transparent',
        color: 'inherit',
        cursor: 'pointer',
        fontSize: 11,
        lineHeight: '11px',
        padding: '0 1px',
      },
      logFiles: {
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
      },
      logFileRow: {
        display: 'flex',
        alignItems: 'center',
        gap: 5,
        height: 20,
        color: 'var(--dsw-alias-label-secondary)',
        fontSize: 11,
      },
      logFilePath: {
        minWidth: 0,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      },
      commitBody: {
        display: 'flex',
        flex: '1 1 0',
        minHeight: 0,
        minWidth: 0,
      },
      commitChangesPane: {
        display: 'flex',
        flexDirection: 'column',
        flex: '1 1 0',
        minWidth: 0,
        minHeight: 0,
      },
      /* Log tab: commit table on top, details below, split by a single divider. */
      annotateScroll: {
        flex: '1 1 0',
        minHeight: 0,
        overflow: 'auto',
        padding: '2px 0 8px',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
        fontSize: 11,
      },
      annotateRow: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        height: 20,
        padding: '0 10px 0 8px',
        whiteSpace: 'nowrap',
      },
      annotateMeta: {
        flex: '0 1 auto',
        minWidth: 0,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        color: 'var(--dsw-alias-label-tertiary)',
      },
      annotateHash: {
        flex: 'none',
        color: 'var(--dsw-alias-label-secondary)',
      },
      annotateLineNo: {
        flex: 'none',
        marginLeft: 'auto',
        minWidth: 30,
        textAlign: 'right',
        color: 'var(--dsw-alias-label-tertiary)',
      },
      commitGraph: {
        display: 'flex',
        flexDirection: 'column',
        flex: '1 1 0',
        minHeight: 0,
        overflow: 'auto',
        padding: '2px 0 8px',
      },
      /* Round 69: IDEA's "fold linear runs" control above the graph. */
      graphFoldRow: {
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '2px 8px 4px',
        borderBottom: '0.5px solid var(--dsw-alias-border-l3)',
      },
      graphFoldToggle: {
        height: 20,
        padding: '0 6px',
        border: '0.5px solid var(--dsw-alias-border-l3)',
        borderRadius: 4,
        background: 'transparent',
        color: 'var(--dsw-alias-label-secondary)',
        fontSize: 10,
        cursor: 'pointer',
      },
      graphFoldToggleOn: {
        background: 'var(--dsw-alias-state-business-primary)',
        color: '#fff',
        borderColor: 'transparent',
      },
      graphFoldCount: {
        color: 'var(--dsw-alias-label-tertiary)',
        fontSize: 10,
      },
      graphFoldBadge: {
        alignSelf: 'flex-start',
        padding: '0 4px',
        borderRadius: 3,
        background: 'var(--dsw-alias-interactive-bg-hover)',
        color: 'var(--dsw-alias-label-tertiary)',
        fontSize: 10,
      },
      commitGraphRow: {
        display: 'flex',
        alignItems: 'flex-start',
        gap: 5,
        minHeight: 24,
        padding: '4px 8px 4px 6px',
        color: 'var(--dsw-alias-label-secondary)',
        fontSize: 12,
        cursor: 'pointer',
      },
      commitGraphLane: {
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'stretch',
        flex: 'none',
        gap: 2,
        height: 22,
        color: 'var(--dsw-alias-state-business-primary)',
      },
      commitGraphTrack: {
        width: 2,
        height: 22,
        background: 'var(--dsw-alias-border-l3)',
      },
      /* The active lane's line is the accent colour, so the eye can follow one branch. */
      commitGraphTrackActive: {
        width: 2,
        height: 22,
        background: 'var(--dsw-alias-state-business-primary)',
      },
      /* A lane the commit is not on: keep the column but leave it empty. */
      commitGraphTrackVoid: {
        width: 2,
        height: 22,
        background: 'transparent',
      },
      commitGraphNode: {
        position: 'absolute',
        left: 0,
        top: 5,
        display: 'inline-flex',
        color: 'var(--dsw-alias-state-business-primary)',
      },
      commitGraphRowActive: {
        background: 'color-mix(in srgb, var(--dsw-alias-state-business-primary) 10%, transparent)',
      },
      commitGraphRef: {
        flex: 'none',
        padding: '0 4px',
        border: '0.5px solid var(--dsw-alias-border-l3)',
        borderRadius: 7,
        color: 'var(--dsw-alias-label-secondary)',
        fontSize: 9,
        lineHeight: '13px',
        whiteSpace: 'nowrap',
      },
      /* The checked-out commit: filled, so HEAD never reads as "just another tag". */
      commitGraphHead: {
        flex: 'none',
        padding: '0 5px',
        borderRadius: 7,
        background: 'var(--dsw-alias-state-business-primary)',
        color: 'var(--dsw-alias-bg-base)',
        fontSize: 9,
        fontWeight: 600,
        lineHeight: '13px',
        whiteSpace: 'nowrap',
      },
      /* Failure banner inside the log list: same slot the empty state uses, but
         it carries the reason and a way out instead of a dead end. */
      logErrorRow: {
        display: 'flex',
        alignItems: 'flex-start',
        gap: 6,
        margin: '6px 8px',
        padding: '6px 8px',
        borderRadius: 4,
        background: 'color-mix(in srgb, var(--dsw-alias-state-error-primary, #cf222e) 10%, transparent)',
        color: 'var(--dsw-alias-state-error-primary, #cf222e)',
        fontSize: 11,
        lineHeight: '15px',
      },
      logErrorText: {
        flex: '1 1 auto',
        minWidth: 0,
        wordBreak: 'break-word',
      },
      graphScopeChip: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        flex: 'none',
        maxWidth: 140,
        height: 19,
        padding: '0 2px 0 6px',
        border: '0.5px solid var(--dsw-alias-border-l3)',
        borderRadius: 9,
        color: 'var(--dsw-alias-label-secondary)',
        background: 'var(--dsw-alias-bg-layer-1)',
        fontSize: 10,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
      },
      graphBranchSelect: {
        flex: 'none',
        maxWidth: 116,
        height: 19,
        border: '0.5px solid var(--dsw-alias-border-l3)',
        borderRadius: 3,
        background: 'var(--dsw-alias-bg-base)',
        color: 'var(--dsw-alias-label-secondary)',
        fontSize: 10,
        fontFamily: 'inherit',
      },
      commitLogBody: {
        display: 'flex',
        flexDirection: 'column',
        flex: '1 1 0',
        minHeight: 0,
        minWidth: 0,
      },
      commitLogList: {
        display: 'flex',
        flexDirection: 'column',
        flex: '0 0 46%',
        minHeight: 96,
        minWidth: 0,
        overflow: 'hidden',
      },
      commitLogDetail: {
        display: 'flex',
        flexDirection: 'column',
        flex: '1 1 0',
        minHeight: 0,
        minWidth: 0,
        borderTop: '0.5px solid var(--dsw-alias-border-l3)',
      },
      commitGroupHeader: {
        display: 'flex',
        alignItems: 'center',
        gap: 5,
        height: 24,
        padding: '0 8px',
        color: 'var(--dsw-alias-label-primary)',
        fontSize: 12,
        fontWeight: 600,
        whiteSpace: 'nowrap',
        borderTop: '0.5px solid var(--dsw-alias-border-l3)',
        userSelect: 'none',
      },
      commitGroupLabel: {
        minWidth: 0,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      },
      commitGroupCount: {
        flex: 'none',
        color: 'var(--dsw-alias-label-tertiary)',
        fontSize: 10,
        fontWeight: 400,
      },
      /* IDEA's muted "5 files" beside the bold group/directory name. */
      commitGroupFiles: {
        flex: 'none',
        color: 'var(--dsw-alias-label-tertiary)',
        fontSize: 11,
        fontWeight: 400,
      },
      commitGroupEmpty: {
        padding: '2px 12px 4px 26px',
        color: 'var(--dsw-alias-label-tertiary)',
        fontSize: 11,
      },
      /* IDEA's change tree keeps one row rhythm: a directory is the same height as
         a file (24px) and its NAME is the emphasised part (IDEA paints it in the
         link colour, with the parent path in grey). The old 22px/11px/tertiary
         version read as a disabled row rather than a navigable folder. */
      commitDirRow: {
        display: 'flex',
        alignItems: 'center',
        gap: 5,
        height: 24,
        color: 'var(--dsw-alias-label-secondary)',
        fontSize: 12,
        whiteSpace: 'nowrap',
        cursor: 'pointer',
        userSelect: 'none',
        /* Like the file rows: a directory's own row may be narrower than its
           contents, and the name must not be the part that gives way. */
        minWidth: 0,
      },
      commitChevron: {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flex: 'none',
        width: 12,
        height: 12,
        color: 'var(--dsw-alias-label-tertiary)',
      },
      /* IDEA's folder name is the part that identifies the row; the path after
         it is the muted part. Same rule as [commitFileName]: the NAME keeps its
         width, the parent path gives way, so a long folder is never reduced to
         `r147ne…` while the row still has free space. */
      commitDirName: {
        flex: '0 0 auto',
        minWidth: 'max-content',
        whiteSpace: 'nowrap',
        color: 'var(--dsw-alias-state-business-primary)',
        fontWeight: 600,
      },
      /* IDEA'S CHANGE LIST NEVER ELLIPSIZES THE NAME. The file name is the part
         the eye scans; the muted parent path after it is the part that gives way
         when the tool window is narrow (`engineering-memory.md  doc/spark`).
         `flex: 0 0 auto` hands the name its full intrinsic width and lets only
         `commitFileDir` shrink, which is what the flex default did NOT do: the
         name had `minWidth: 0` + `ellipsis` like every other label, so a long
         name collapsed to `engineering-m…` while the row still had room to the
         right of the shorter path. `overflow: visible` is the second half of the
         fix — in a `nowrap` flex line a clipped box still clips. */
      commitFileName: {
        flex: '0 0 auto',
        minWidth: 'max-content',
        whiteSpace: 'nowrap',
        color: 'var(--dsw-alias-label-primary)',
      },
      editorStatus: {
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        flex: 'none',
        height: 20,
        padding: '0 10px',
        borderTop: '0.5px solid var(--dsw-alias-border-l3)',
        background: 'var(--dsw-alias-bg-layer-1)',
        color: 'var(--dsw-alias-label-tertiary)',
        fontSize: 10,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
      },
      statusItem: {
        flex: 'none',
      },
      commitFileRowConflict: {
        background: 'rgba(207, 34, 46, 0.08)',
      },
      conflictChip: {
        flex: 'none',
        marginLeft: 4,
        padding: '0 4px',
        borderRadius: 3,
        background: 'rgba(207, 34, 46, 0.16)',
        color: 'var(--dsw-alias-state-error-primary)',
        fontSize: 9,
        fontWeight: 700,
        letterSpacing: 0.2,
      },
      commitFileRowActive: {
        background: 'var(--dsw-alias-interactive-bg-hover-solid)',
      },
      amendSubject: {
        minWidth: 0,
        marginLeft: 6,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        color: 'var(--dsw-alias-label-tertiary)',
        fontSize: 10,
        whiteSpace: 'nowrap',
      },
      diffPane: {
        display: 'flex',
        flexDirection: 'column',
        flex: '1 1 0',
        minWidth: 0,
        minHeight: 0,
        overflow: 'hidden',
        background: 'var(--dsw-alias-bg-base)',
      },
      /* IDEA's diff header prints the whole workspace-relative path and does not
         shorten the NAME: `r147nest/engineering-memory-and-decision-log-notes.md`
         used to render as `r147nest/engineering-memory-and-d…` in a 700px pane
         with room to spare, because the title was a shrinkable ellipsis box.
         The header may scroll sideways in a very narrow pane (IDEA does), and the
         hint/counter/close button stay pinned because they never shrink. */
      diffTitle: {
        /* The wrapper is the shrinkable half; [pathLabelName] inside it never is. */
        marginRight: 6,
      },
      /* The two-tone path label shared by the diff and annotate headers. */
      pathLabel: {
        display: 'inline-flex',
        alignItems: 'baseline',
        flex: '1 1 auto',
        minWidth: 0,
        /* The wrapper clips, so a squeezed header loses the trailing path and
           still shows the name in full — the name is first in the DOM. */
        overflow: 'hidden',
        whiteSpace: 'nowrap',
      },
      /* The leading path yields FIRST and keeps its tail (the half nearest the
         name) via `direction: rtl`; the name only ever clips when it alone is
         wider than the header, which is the one case where something must. */
      pathLabelDir: {
        /* Shrinks to nothing rather than to a 6px smudge: when the header has no
           room left the path disappears and the `title` on the wrapper still
           carries it. `direction: rtl` keeps the tail of the path (the folder
           nearest the file) instead of its meaningless root. */
        flex: '0 1 auto',
        minWidth: 0,
        paddingLeft: 6,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        direction: 'rtl',
        color: 'var(--dsw-alias-label-tertiary)',
      },
      pathLabelName: {
        flex: '0 0 auto',
        color: 'var(--dsw-alias-label-primary)',
      },
      diffHint: {
        marginLeft: 'auto',
        flex: 'none',
        color: 'var(--dsw-alias-label-tertiary)',
        fontSize: 10,
      },
      diffHeader: {
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        flex: 'none',
        height: 28,
        padding: '0 4px 0 10px',
        borderBottom: '0.5px solid var(--dsw-alias-border-l3)',
        color: 'var(--dsw-alias-label-secondary)',
        fontSize: 11,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
      },
      diffHost: {
        flex: '1 1 0',
        minWidth: 0,
        minHeight: 0,
        overflow: 'hidden',
      },
      /* IDEA's diff toolbar sits right of the file name, left of the close button. */
      hunkNav: {
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        flex: 'none',
        marginLeft: 4,
      },
      hunkCounter: {
        minWidth: 30,
        textAlign: 'center',
        color: 'var(--dsw-alias-label-secondary)',
        fontSize: 10,
        fontVariantNumeric: 'tabular-nums',
      },
      commitScroll: {
        flex: '1 1 0',
        minHeight: 0,
        overflow: 'auto',
      },
      commitGroupRow: {
        display: 'flex',
        alignItems: 'center',
        gap: 5,
        height: 24,
        padding: '0 8px',
        color: 'var(--dsw-alias-label-primary)',
        fontSize: 12,
        fontWeight: 600,
        whiteSpace: 'nowrap',
        cursor: 'pointer',
        userSelect: 'none',
      },
      commitTemplateRow: {
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 4,
        flex: 'none',
        padding: '4px 2px 0',
      },
      commitTemplateChip: {
        height: 18,
        padding: '0 6px',
        border: '0.5px solid var(--dsw-alias-border-l3)',
        borderRadius: 9,
        background: 'transparent',
        color: 'var(--dsw-alias-label-secondary)',
        fontSize: 10,
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
        cursor: 'pointer',
      },
      commitCounterRow: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        flex: 'none',
        padding: '2px 2px 0',
      },
      commitCounter: {
        color: 'var(--dsw-alias-label-tertiary)',
        fontSize: 10,
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
      },
      commitCounterWarn: {
        color: '#bf8700',
        fontSize: 10,
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
      },
      commitFileRow: {
        display: 'flex',
        alignItems: 'center',
        gap: 5,
        height: 24,
        padding: '0 8px 0 22px',
        color: 'var(--dsw-alias-label-secondary)',
        fontSize: 12,
        whiteSpace: 'nowrap',
        cursor: 'pointer',
        userSelect: 'none',
        /* The row may be narrower than its content (a 30%-wide tool window next to
           a deep path); the name is protected by [commitFileName] and the path
           gives way, so the row must be allowed to shrink rather than push the
           whole list into a horizontal scroll. */
        minWidth: 0,
      },
      lineCounts: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        flex: 'none',
        marginLeft: 'auto',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
        fontSize: 10,
      },
      lineCountAdd: {
        color: '#1a7f37',
      },
      lineCountDel: {
        color: '#cf222e',
      },
      lineCountBinary: {
        flex: 'none',
        marginLeft: 'auto',
        color: 'var(--dsw-alias-label-tertiary)',
        fontSize: 10,
      },
      /* The parent path sits immediately after the file name, the way IDEA
         prints `program.py  doc/spark`: it is part of the row's identity, not a
         right-hand column. It used to carry `marginLeft: auto`, which competed
         with the line-count block's own auto margin — the two split the free
         space, so the numbers drifted into the middle of the row and the path
         was pushed to the far edge. Only the counts own the right edge now. */
      commitFileDir: {
        minWidth: 0,
        paddingLeft: 2,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        color: 'var(--dsw-alias-label-tertiary)',
        fontSize: 10,
      },
      /* IDEA's tree checkboxes: a 16px rounded square with a hairline outline,
         filled blue with a white tick only while checked. The native control
         cannot be sized or outlined this way on every platform (macOS draws a
         large accent-filled square), so the appearance is reset here and the
         marks are drawn by `.dsh-editor-checkbox` in `installStyles` — the
         element stays a real checkbox, which keeps keyboard and
         `indeterminate` semantics intact. */
      checkbox: {
        flex: 'none',
        width: 16,
        height: 16,
        margin: 0,
        accentColor: 'var(--dsw-alias-state-business-primary)',
        cursor: 'pointer',
      },
      commitMessageArea: {
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        flex: 'none',
        padding: 8,
        borderTop: '0.5px solid var(--dsw-alias-border-l3)',
        background: 'var(--dsw-alias-bg-base)',
      },
      amendRow: {
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        color: 'var(--dsw-alias-label-secondary)',
        fontSize: 11,
        userSelect: 'none',
      },
      commitTextarea: {
        boxSizing: 'border-box',
        width: '100%',
        minHeight: 76,
        maxHeight: 160,
        padding: 6,
        border: '0.5px solid var(--dsw-alias-border-l3)',
        borderRadius: 4,
        outline: 'none',
        background: 'var(--dsw-alias-bg-base)',
        color: 'var(--dsw-alias-label-primary)',
        fontSize: 12,
        lineHeight: '18px',
        fontFamily: 'inherit',
        resize: 'vertical',
      },
      commitButtonRow: {
        display: 'flex',
        alignItems: 'center',
        gap: 6,
      },
      /* IDEA's two commit buttons are a matched pair of outlined buttons ("Commit",
         "Commit and Push…") — not one filled primary plus a bare icon. Equal weight
         is deliberate: pushing is a separate, remote-visible decision. */
      commitPrimary: {
        flex: '0 1 auto',
        minWidth: 96,
        height: 27,
        padding: '0 14px',
        border: '0.5px solid var(--dsw-alias-border-l3)',
        borderRadius: 4,
        background: 'var(--dsw-alias-interactive-bg-hover-solid)',
        color: 'var(--dsw-alias-label-primary)',
        fontSize: 12,
        fontWeight: 600,
        cursor: 'pointer',
      },
      commitSecondary: {
        flex: '1 1 auto',
        minWidth: 0,
        height: 27,
        padding: '0 14px',
        border: '0.5px solid var(--dsw-alias-border-l3)',
        borderRadius: 4,
        background: 'var(--dsw-alias-bg-base)',
        color: 'var(--dsw-alias-label-primary)',
        fontSize: 12,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      },
      commitStatusStack: {
        display: 'flex',
        flexDirection: 'column',
        gap: 3,
        flex: 'none',
        padding: '4px 6px 0',
      },
      commitNotice: {
        color: 'var(--dsw-alias-label-tertiary)',
        fontSize: 10,
        lineHeight: '14px',
        whiteSpace: 'pre-wrap',
      },
      commitError: {
        color: 'var(--dsw-alias-state-error-primary)',
        fontSize: 10,
        lineHeight: '14px',
        whiteSpace: 'pre-wrap',
      },
      empty: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flex: '1 1 0',
        color: 'var(--dsw-alias-label-tertiary)',
        fontSize: 12,
      },
      /* A terminal moved into the editor area (IDEA's Move to Editor): it fills the
         code surface, with a thin toolbar so the way back is always visible. */
      editorTerminalPane: {
        display: 'flex',
        flexDirection: 'column',
        flex: '1 1 0',
        minWidth: 0,
        minHeight: 0,
        overflow: 'hidden',
        background: 'var(--dsw-alias-bg-base)',
      },
      editorTerminalToolbar: {
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        flex: 'none',
        height: 26,
        padding: '0 4px 0 8px',
        borderBottom: '0.5px solid var(--dsw-alias-border-l3)',
        color: 'var(--dsw-alias-label-secondary)',
        fontSize: 11,
      },
      editorTerminalTitle: {
        minWidth: 0,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      },
      editorTerminalScreen: {
        flex: '1 1 0',
        minHeight: 0,
        minWidth: 0,
        overflow: 'hidden',
      },
      terminalPanel: {
        display: 'flex',
        flexDirection: 'column',
        flex: '1 1 0',
        minHeight: 0,
        minWidth: 0,
        overflow: 'hidden',
        background: 'var(--dsw-alias-bg-base)',
      },
      terminalTabStrip: {
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        flex: 'none',
        height: 28,
        padding: '0 4px',
        borderBottom: '0.5px solid var(--dsw-alias-border-l3)',
        background: 'var(--dsw-alias-bg-layer-1)',
      },
      terminalTabs: {
        display: 'flex',
        alignItems: 'stretch',
        /* Grow into the strip so its measured width is the ROOM available, not the
           width of the tabs currently rendered — measuring content width made the
           strip collapse to one tab and never grow back. */
        flex: '1 1 auto',
        minWidth: 0,
        overflow: 'hidden',
      },
      /* IDEA's `»` chevron for tabs that do not fit the strip. */
      terminalOverflow: {
        flex: 'none',
        /* The tab container grows, so `marginLeft: auto` would push the chevron to
           the far right of the strip; IDEA keeps it right after the last tab. */
        marginLeft: 2,
        alignSelf: 'center',
        width: 22,
        height: 22,
        border: 'none',
        borderRadius: 4,
        background: 'transparent',
        color: 'var(--dsw-alias-label-secondary)',
        fontSize: 13,
        lineHeight: '1',
        cursor: 'pointer',
      },
      terminalTab: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        flex: 'none',
        maxWidth: 168,
        height: 22,
        margin: '3px 0',
        padding: '0 4px 0 8px',
        borderRadius: 4,
        color: 'var(--dsw-alias-label-secondary)',
        fontSize: 11,
        whiteSpace: 'nowrap',
        cursor: 'pointer',
        userSelect: 'none',
      },
      terminalTabDrop: {
        boxShadow: 'inset 2px 0 0 var(--dsw-alias-state-business-primary)',
      },
      terminalTabDragging: {
        opacity: 0.55,
      },
      terminalTabActive: {
        background: 'var(--dsw-alias-bg-base)',
        color: 'var(--dsw-alias-label-primary)',
        boxShadow: 'inset 0 -2px 0 var(--dsw-alias-state-business-primary)',
      },
      /* IDEA's coloured tab groups: a 3px stripe on the tab's leading edge. */
      terminalTabStripe: {
        flex: 'none',
        width: 3,
        height: 14,
        borderRadius: 2,
      },
      terminalRenameInput: {
        width: 90,
        height: 17,
        padding: '0 3px',
        border: '1px solid var(--dsw-alias-state-business-primary)',
        borderRadius: 3,
        outline: 'none',
        background: 'var(--dsw-alias-bg-base)',
        color: 'var(--dsw-alias-label-primary)',
        fontSize: 11,
        fontFamily: 'inherit',
      },
      terminalTabClose: {
        border: 'none',
        background: 'transparent',
        color: 'inherit',
        cursor: 'pointer',
        fontSize: 12,
        lineHeight: '12px',
        padding: '0 2px',
        opacity: 0.65,
      },
      terminalExited: {
        color: 'var(--dsw-alias-label-tertiary)',
        fontSize: 10,
      },
      /* Laid out for real (so FitAddon can measure) but invisible and inert. */
      terminalMeasure: {
        position: 'absolute',
        inset: 0,
        opacity: 0,
        pointerEvents: 'none',
        overflow: 'hidden',
      },
      terminalScreenArea: {
        position: 'relative',
        display: 'flex',
        flex: '1 1 0',
        minHeight: 0,
        minWidth: 0,
        overflow: 'hidden',
        padding: '4px 0 0 6px',
        background: 'var(--dsw-alias-bg-base)',
      },
      /* Each pane owns its own xterm; the split only decides how much room it gets. */
      terminalPaneInner: {
        flex: '1 1 0',
        minWidth: 0,
        minHeight: 0,
        overflow: 'hidden',
        display: 'flex',
      },
      terminalScreenSplit: {
        gap: 0,
      },
      terminalPane: {
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0,
        minHeight: 0,
        overflow: 'hidden',
      },
      terminalClipboardNotice: {
        flex: 'none',
        maxWidth: 180,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
        color: 'var(--dsw-alias-label-tertiary)',
        fontSize: 10,
        padding: '0 6px',
      },
      terminalSplitHandle: {
        flex: 'none',
        width: 4,
        background: 'transparent',
        borderLeft: '0.5px solid var(--dsw-alias-border-l3)',
      },
      /* IDEA marks the focused split pane with a thin accent border. */
      terminalPaneFocused: {
        boxShadow: 'inset 0 0 0 1px var(--dsw-alias-state-business-primary)',
      },
      terminalPaneBar: {
        display: 'flex',
        alignItems: 'center',
        flex: 'none',
        height: 20,
        padding: '0 4px',
        borderBottom: '0.5px solid var(--dsw-alias-border-l3)',
        background: 'var(--dsw-alias-bg-layer-1)',
      },
      terminalPaneSelect: {
        maxWidth: 160,
        height: 17,
        border: '1px solid var(--dsw-alias-border-l3)',
        borderRadius: 3,
        outline: 'none',
        background: 'var(--dsw-alias-bg-base)',
        color: 'var(--dsw-alias-label-secondary)',
        fontSize: 10,
        fontFamily: 'inherit',
      },
      xtermHost: {
        flex: '1 1 0',
        minWidth: 0,
        minHeight: 0,
        overflow: 'hidden',
      },
      terminalNotice: {
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        color: 'var(--dsw-alias-label-tertiary)',
        fontSize: 12,
        background: 'var(--dsw-alias-bg-base)',
      },
      terminalAction: {
        height: 24,
        padding: '0 12px',
        border: '0.5px solid var(--dsw-alias-border-l3)',
        borderRadius: 4,
        background: 'var(--dsw-alias-interactive-bg-hover-solid)',
        color: 'var(--dsw-alias-label-primary)',
        fontSize: 11,
        cursor: 'pointer',
      },
      /* Only the failure strip is left at the foot of the dock: an empty row of
         cwd / `90×10` readouts was pure chrome. */
      terminalStatusBar: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        flex: 'none',
        height: 20,
        padding: '0 8px',
        borderTop: '0.5px solid var(--dsw-alias-border-l3)',
        color: 'var(--dsw-alias-label-tertiary)',
        fontSize: 10,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
      },
      mainColumn: {
        display: 'flex',
        flexDirection: 'column',
        flex: '1 1 0',
        minWidth: 0,
        minHeight: 0,
        overflow: 'hidden',
      },
      dock: {
        display: 'flex',
        flexDirection: 'column',
        flex: 'none',
        minWidth: 0,
        minHeight: 0,
        borderTop: '0.5px solid var(--dsw-alias-border-l3)',
        background: 'var(--dsw-alias-bg-base)',
        overflow: 'hidden',
      },
      dockResize: {
        flex: 'none',
        height: 5,
        cursor: 'row-resize',
        background: 'transparent',
      },
      conflictBar: {
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        flex: 'none',
        padding: '5px 10px',
        borderBottom: '0.5px solid var(--dsw-alias-border-l3)',
        background: 'var(--dsw-alias-bg-layer-1)',
        color: 'var(--dsw-alias-state-warning-primary, #b26a00)',
        fontSize: 11,
      },
      conflictAction: {
        flex: 'none',
        height: 20,
        padding: '0 8px',
        border: '0.5px solid var(--dsw-alias-border-l3)',
        borderRadius: 4,
        background: 'var(--dsw-alias-interactive-bg-hover-solid)',
        color: 'var(--dsw-alias-label-primary)',
        fontSize: 10,
        cursor: 'pointer',
      },
      findBar: {
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        flex: 'none',
        height: 30,
        padding: '0 6px',
        borderBottom: '0.5px solid var(--dsw-alias-border-l3)',
        background: 'var(--dsw-alias-bg-layer-1)',
      },
      findInput: {
        width: 150,
        height: 21,
        padding: '0 5px',
        border: '1px solid var(--dsw-alias-border-l3)',
        borderRadius: 3,
        outline: 'none',
        background: 'var(--dsw-alias-bg-base)',
        color: 'var(--dsw-alias-label-primary)',
        fontSize: 11,
        fontFamily: 'inherit',
      },
      findCount: {
        flex: 'none',
        minWidth: 46,
        color: 'var(--dsw-alias-label-tertiary)',
        fontSize: 10,
        textAlign: 'center',
      },
      editorSurface: {
        display: 'flex',
        flexDirection: 'column',
        flex: '1 1 0',
        minWidth: 0,
        minHeight: 0,
        overflow: 'hidden',
      },
      tabStrip: {
        display: 'flex',
        alignItems: 'stretch',
        flex: 'none',
        height: 34,
        borderBottom: '0.5px solid var(--dsw-alias-border-l3)',
        background: 'var(--dsw-alias-bg-base)',
        overflowX: 'auto',
        overflowY: 'hidden',
      },
      tab: {
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        flex: 'none',
        height: '100%',
        padding: '0 10px 0 14px',
        borderRight: '0.5px solid var(--dsw-alias-border-l3)',
        color: 'var(--dsw-alias-label-secondary)',
        fontSize: 12,
        background: 'var(--dsw-alias-bg-layer-1)',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
      },
      /* IDEA's `»` for file tabs that do not fit. */
      tabOverflow: {
        flex: 'none',
        alignSelf: 'center',
        width: 24,
        height: 24,
        /* Shorthand FIRST: a later `margin` would reset `marginLeft: 'auto'` and
           the chevron snapped back beside the last tab (seen at runtime). */
        margin: '0 4px',
        /* Pinned to the strip's right edge: IDEA's chevron never wanders with the
           number of open tabs, so the eye always knows where to find it. */
        marginLeft: 'auto',
        border: 'none',
        borderRadius: 4,
        background: 'transparent',
        color: 'var(--dsw-alias-label-secondary)',
        fontSize: 13,
        lineHeight: '1',
        cursor: 'pointer',
      },
      tabActive: {
        color: 'var(--dsw-alias-label-primary)',
        background: 'var(--dsw-alias-bg-base)',
      },
      /* The diff tab carries a long generated name; clip it so the "Commit: "
         prefix — the part that says what the tab IS — never scrolls out. */
      tabLabel: {
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        maxWidth: 220,
      },
      tabClose: {
        border: 'none',
        background: 'transparent',
        color: 'var(--dsw-alias-label-tertiary)',
        cursor: 'pointer',
        fontSize: 13,
        lineHeight: '13px',
        padding: '0 2px',
      },
      /* IDEA's breadcrumbs: one clickable segment per path component. */
      breadcrumbBar: {
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        flex: 'none',
        height: 24,
        padding: '0 8px',
        borderBottom: '0.5px solid var(--dsw-alias-border-l3)',
        background: 'var(--dsw-alias-bg-base)',
        overflow: 'hidden',
        whiteSpace: 'nowrap',
      },
      breadcrumbItem: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 3,
        flex: 'none',
        height: 18,
        padding: '0 4px',
        border: 'none',
        borderRadius: 3,
        background: 'transparent',
        color: 'var(--dsw-alias-label-secondary)',
        fontSize: 11,
        cursor: 'pointer',
        fontFamily: 'inherit',
      },
      breadcrumbItemActive: {
        color: 'var(--dsw-alias-label-primary)',
      },
      breadcrumbSeparator: {
        flex: 'none',
        color: 'var(--dsw-alias-label-tertiary)',
        fontSize: 10,
        padding: '0 1px',
      },
      statusButton: {
        border: 'none',
        background: 'transparent',
        color: 'inherit',
        font: 'inherit',
        padding: '0 3px',
        borderRadius: 3,
        cursor: 'pointer',
      },
      gotoLineBar: {
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        flex: 'none',
        height: 30,
        padding: '0 8px',
        borderBottom: '0.5px solid var(--dsw-alias-border-l3)',
        background: 'var(--dsw-alias-bg-layer-1)',
      },
      editorContainer: {
        flex: '1 1 0',
        minWidth: 0,
        minHeight: 0,
        overflow: 'hidden',
      },
      error: {
        padding: '8px 12px',
        color: 'var(--dsw-alias-state-error-primary)',
        fontSize: 11,
        lineHeight: '18px',
        whiteSpace: 'pre-wrap',
      },
    };

    /**
     * Bind one translation with `{name}` placeholder interpolation.
     * @param {(key: string) => string} bind - locale lookup from the plugin context.
     * @param {object} dictionaries - the plugin's own `zh`/`en` tables.
     * @returns {(key: string, params?: object) => string} translating helper.
     */
    function translate(bind, dictionaries) {
      const zhFlat = flattenDictionary(dictionaries.zh);
      const enFlat = flattenDictionary(dictionaries.en);
      return (key, params) => {
        let text = bind(key);
        if (text === key) {
          const preferred = (navigator.language ?? '').toLowerCase().startsWith('zh') ? zhFlat : enFlat;
          text = preferred[key] ?? zhFlat[key] ?? enFlat[key] ?? key;
        }
        if (params !== undefined) {
          for (const [name, value] of Object.entries(params)) text = text.split(`{${name}}`).join(String(value));
        }
        return text;
      };
    }

    /** Read the current Session id from the conversation body. */
    function currentSessionId() {
      const body = document.querySelector('[data-conversation-region="chat"]');
      return body?.getAttribute('data-conversation-session') ?? '';
    }

    /** Call the host workspace file API. */
    async function callFs(payload) {
      const sessionId = currentSessionId();
      if (sessionId === '') throw new Error('no active Session');
      const response = await fetch('api/dsh-editor/fs', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sessionId, ...payload }),
      });
      if (!response.ok) throw new Error(`file API HTTP ${response.status}`);
      const data = await response.json();
      if (data?.ok !== true) throw new Error(data?.error?.message ?? 'file API failed');
      return data.value;
    }

    /** Call the host git API. */
    async function callGit(payload) {
      const sessionId = currentSessionId();
      if (sessionId === '') throw new Error('no active Session');
      const response = await fetch('api/dsh-editor/git', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sessionId, ...payload }),
      });
      if (!response.ok) throw new Error(`git API HTTP ${response.status}`);
      const data = await response.json();
      if (data?.ok !== true) throw new Error(data?.error?.message ?? 'git API failed');
      return data.value;
    }

    /** Pick a Monaco theme from the page's color scheme. */
    function detectTheme() {
      const root = document.documentElement;
      const explicit = root.dataset.theme ?? root.dataset.colorScheme ?? '';
      if (/dark/i.test(explicit)) return 'vs-dark';
      if (/light/i.test(explicit)) return 'vs';
      return window.matchMedia?.('(prefers-color-scheme: dark)')?.matches === true ? 'vs-dark' : 'vs';
    }

    /**
     * The parent directory of a change, printed the way IDEA prints it.
     *
     * A trailing `/` is what tells the row `r147nest/deep/inner/` is a DIRECTORY
     * and not a second file name; without it `note.md  spark` reads like two
     * files on one row. Root-level files return `''` and the caller substitutes
     * the project name (IDEA shows the module there).
     * @param {string} path - workspace-relative path.
     * @returns {string} the parent path with a trailing slash, or ''.
     */
    function parentDirLabel(path) {
      const parent = dirname(path);
      return parent === '' ? '' : `${parent}/`;
    }

    /** Basename of a workspace-relative path. */
    function basename(path) {
      const index = path.lastIndexOf('/');
      return index < 0 ? path : path.slice(index + 1);
    }

    /** Parent directory of a workspace-relative path. */
    /**
     * Every ancestor directory of one relative path, outermost first.
     * @param {string} path - workspace-relative path.
     * @returns {string[]} ancestor directories, excluding the path itself.
     */
    function ancestorsOf(path) {
      if (typeof path !== 'string' || path === '') return [];
      const parts = path.split('/');
      const ancestors = [];
      for (let index = 1; index < parts.length; index += 1) ancestors.push(parts.slice(0, index).join('/'));
      return ancestors;
    }

    function dirname(path) {
      const index = path.lastIndexOf('/');
      return index < 0 ? '' : path.slice(0, index);
    }

    /** Abbreviate a home-prefixed absolute path. */
    /**
     * Split the project root row into the folder NAME and the path beside it.
     *
     * A narrow tool window cannot show both: the path (`~/Documents/project/doc`)
     * used to win and the folder name — the only part that identifies the project
     * — collapsed to an ellipsis. IDEA keeps the name and shortens the path.
     * @param {string} root - absolute workspace root.
     * @param {string} home - the user's home directory, for the `~` form.
     * @returns {{name: string, path: string}} the label parts.
     */
    function splitRootLabel(root, home) {
      const absolute = typeof root === 'string' ? root : '';
      const trimmed = absolute.length > 1 && absolute.endsWith('/') ? absolute.slice(0, -1) : absolute;
      const name = trimmed === '' ? '' : trimmed.slice(trimmed.lastIndexOf('/') + 1);
      return { name, path: abbreviatePath(absolute, home) };
    }

    function abbreviatePath(path, home) {
      if (!path) return '';
      if (home && path === home) return '~';
      if (home && path.startsWith(`${home}/`)) return `~${path.slice(home.length)}`;
      return path;
    }

    /** Monaco language id for a workspace-relative path. */
    function languageFor(path) {
      const name = basename(path).toLowerCase();
      if (name === 'dockerfile') return 'dockerfile';
      if (name === 'makefile') return 'makefile';
      const dot = name.lastIndexOf('.');
      if (dot < 0) return 'plaintext';
      return LANGUAGE_BY_EXTENSION[name.slice(dot + 1)] ?? 'plaintext';
    }

    /** Return a language id only when Monaco knows it. */
    function safeLanguage(monaco, path) {
      const language = languageFor(path);
      return monaco.languages.getLanguages().some((entry) => entry.id === language) ? language : 'plaintext';
    }

    let monacoPromise = null;

    /** Load Monaco's AMD build through the host asset bridge. */
    function loadMonaco() {
      if (window.monaco?.editor !== undefined) return Promise.resolve(window.monaco);
      if (monacoPromise !== null) return monacoPromise;
      monacoPromise = new Promise((resolve, reject) => {
        const start = () => {
          const amdRequire = window.require;
          if (typeof amdRequire !== 'function') {
            reject(new Error('Monaco AMD loader did not expose require'));
            return;
          }
          try {
            amdRequire.config({
              paths: { vs: '/api/dsh-editor/monaco/vs' },
              'vs/nls': { availableLanguages: { '*': 'zh-cn' } },
            });
            self.MonacoEnvironment = {
              getWorkerUrl: () => '/api/dsh-editor/monaco/vs/base/worker/workerMain.js',
            };
            amdRequire(['vs/editor/editor.main'], () => resolve(window.monaco), reject);
          } catch (error) {
            reject(error);
          }
        };
        const existing = document.querySelector('script[data-dsh-editor-monaco-loader]');
        if (existing !== null) {
          start();
          return;
        }
        const script = document.createElement('script');
        script.src = '/api/dsh-editor/monaco/vs/loader.js';
        script.async = true;
        script.dataset.dshEditorMonacoLoader = '';
        script.onload = start;
        script.onerror = () => reject(new Error('failed to load Monaco loader'));
        document.head.appendChild(script);
      });
      return monacoPromise;
    }

    /** The label and color used by one file-type badge. */
    function fileBadge(path) {
      const name = basename(path).toLowerCase();
      const dot = name.lastIndexOf('.');
      const extension = dot < 0 ? name : name.slice(dot + 1);
      switch (extension) {
        case 'json':
          return { label: '{}', color: '#2f65ca', background: '#e6efff' };
        case 'yaml':
        case 'yml':
          return { label: 'YML', color: '#b3261e', background: '#fde8e7' };
        case 'py':
        case 'pyw':
          return { label: 'Py', color: '#1f6fb2', background: '#e3f2fd' };
        case 'sh':
        case 'bash':
        case 'zsh':
          return { label: '>_', color: '#1b7f4b', background: '#e6f4ea' };
        case 'md':
        case 'markdown':
          return { label: 'MD', color: '#2f65ca', background: '#e6efff' };
        case 'ts':
        case 'tsx':
        case 'mts':
        case 'cts':
          return { label: 'TS', color: '#1d5fa8', background: '#e3efff' };
        case 'js':
        case 'jsx':
        case 'mjs':
        case 'cjs':
          return { label: 'JS', color: '#8a6d00', background: '#fff4c2' };
        case 'go':
          return { label: 'GO', color: '#00758f', background: '#dff6f9' };
        case 'rs':
          return { label: 'RS', color: '#9c4a1a', background: '#fbe9dd' };
        case 'java':
        case 'kt':
        case 'kts':
          return { label: 'J', color: '#a14a00', background: '#fbe9dd' };
        case 'c':
        case 'h':
        case 'cc':
        case 'cpp':
        case 'cxx':
        case 'hpp':
          return { label: 'C', color: '#3f51b5', background: '#e8eaf6' };
        case 'html':
        case 'htm':
        case 'vue':
        case 'svelte':
          return { label: '<>', color: '#b34a00', background: '#fbe9dd' };
        case 'css':
        case 'scss':
        case 'less':
          return { label: '#', color: '#1565c0', background: '#e3f2fd' };
        case 'toml':
        case 'ini':
        case 'conf':
          return { label: 'T', color: '#5f6368', background: '#eceff1' };
        case 'xml':
        case 'svg':
          return { label: '<>', color: '#b34a00', background: '#fbe9dd' };
        case 'sql':
          return { label: 'DB', color: '#00695c', background: '#e0f2f1' };
        case 'lock':
          return { label: 'L', color: '#5f6368', background: '#eceff1' };
        default:
          if (name === '.gitignore' || name === '.gitmodules') return { label: 'G', color: '#5f6368', background: '#eceff1' };
          if (name === '.think_plan.md') return { label: 'MD', color: '#2f65ca', background: '#e6efff' };
          return null;
      }
    }

    /** SVG icon set used by the panel chrome and file tree. */
    /**
     * One header label for a file path: muted leading path, whole file name.
     *
     * Kept as a component so the diff and annotate headers cannot drift: both
     * need `title` (the full path, for panes too narrow to hold it) and both
     * must let the name wrap out rather than truncate it.
     * @param {{path: string, style?: object}} props - the path and extra styling.
     * @returns {object} the label.
     */
    function PathLabel({ path, style }) {
      const parts = splitPathLabel(path);
      return React.createElement(
        'span',
        { style: { ...styles.pathLabel, ...style }, title: typeof path === 'string' ? path : '' },
        /* NAME FIRST, path after — the same order the change list uses, and the
           order IDEA's editor tab uses. It also spends the scarce width on the
           part that identifies the file: in a 400px diff pane the name gets all
           of it and only the trailing path is abbreviated. */
        React.createElement('span', { style: styles.pathLabelName }, parts.name),
        parts.dir === '' ? null : React.createElement('span', { style: styles.pathLabelDir }, parts.dir),
      );
    }

    function Icon({ name, size = 14 }) {
      const common = {
        width: size,
        height: size,
        viewBox: '0 0 16 16',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 1.2,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        'aria-hidden': 'true',
      };
      switch (name) {
        case 'project':
          return React.createElement('svg', common, React.createElement('path', { d: 'M1.8 4.2h4.1l1.1 1.2h7.2v7.1a1 1 0 0 1-1 1H2.8a1 1 0 0 1-1-1V4.2Z' }), React.createElement('path', { d: 'M1.8 5.4h12.4' }));
        case 'commit':
          return React.createElement('svg', common, React.createElement('path', { d: 'M8 1.5v3.3M8 11.2v3.3' }), React.createElement('circle', { cx: 8, cy: 8, r: 2.4 }));
        case 'terminal':
          return React.createElement('svg', common, React.createElement('rect', { x: 1.5, y: 2.5, width: 13, height: 11, rx: 1 }), React.createElement('path', { d: 'm4 6 2 2-2 2M8.5 10h3' }));
        case 'newFile':
          return React.createElement('svg', common, React.createElement('path', { d: 'M3 1.8h6.2l3.3 3.3v9.1H3V1.8Z' }), React.createElement('path', { d: 'M9.2 1.8v3.3h3.3M8 7.5v4M6 9.5h4' }));
        case 'newFolder':
          return React.createElement('svg', common, React.createElement('path', { d: 'M1.8 4.2h4.1l1.1 1.2h7.2v7.1a1 1 0 0 1-1 1H2.8a1 1 0 0 1-1-1V4.2Z' }), React.createElement('path', { d: 'M8 7.5v4M6 9.5h4' }));
        case 'target':
          return React.createElement('svg', common, React.createElement('circle', { cx: 8, cy: 8, r: 4.6 }), React.createElement('circle', { cx: 8, cy: 8, r: 1.2 }), React.createElement('path', { d: 'M8 1.2v2M8 12.8v2M1.2 8h2M12.8 8h2' }));
        case 'expand':
          return React.createElement('svg', common, React.createElement('path', { d: 'm4 6 4 4 4-4M4 2.5l4 4 4-4' }));
        case 'collapse':
          return React.createElement('svg', common, React.createElement('path', { d: 'm4 10 4-4 4 4M4 13.5l4-4 4 4' }));
        case 'refresh':
          return React.createElement('svg', common, React.createElement('path', { d: 'M13.2 8a5.2 5.2 0 1 1-1.6-3.7M13.2 2.4v4h-4' }));
        case 'hide':
          return React.createElement('svg', common, React.createElement('path', { d: 'M3 8h10' }));
        case 'eye':
          return React.createElement(
            'svg',
            common,
            React.createElement('path', { d: 'M1.4 8S3.6 4 8 4s6.6 4 6.6 4-2.2 4-6.6 4S1.4 8 1.4 8Z' }),
            React.createElement('circle', { cx: 8, cy: 8, r: 1.9 }),
          );
        case 'settings':
          return React.createElement('svg', common, React.createElement('circle', { cx: 8, cy: 8, r: 2.2 }), React.createElement('path', { d: 'M8 1.4v1.8M8 12.8v1.8M1.4 8h1.8M12.8 8h1.8M3.3 3.3l1.3 1.3M11.4 11.4l1.3 1.3M3.3 12.7l1.3-1.3M11.4 4.6l1.3-1.3' }));
        case 'chevronRight':
          return React.createElement('svg', common, React.createElement('path', { d: 'm6 3.5 5 4.5-5 4.5' }));
        case 'chevronDown':
          return React.createElement('svg', common, React.createElement('path', { d: 'm3.5 6 4.5 5 4.5-5' }));
        case 'chevronUp':
          return React.createElement('svg', common, React.createElement('path', { d: 'm3.5 10 4.5-5 4.5 5' }));
        case 'autoscroll':
          /* IDEA's "Autoscroll from Source": a target with a trailing arrow. */
          return React.createElement('svg', common, React.createElement('circle', { cx: 7, cy: 9, r: 3.4 }), React.createElement('circle', { cx: 7, cy: 9, r: 1, fill: 'currentColor', stroke: 'none' }), React.createElement('path', { d: 'M10.4 5.6 14 2M14 2h-3.2M14 2v3.2' }));
        case 'folder':
          /* `flex: none` is load-bearing: as a flex child with an aspect ratio the svg
             had its WIDTH squeezed (measured 10x16 instead of 16x16), which read as
             "the root folder icon shrank after render". */
          return React.createElement('svg', { width: size, height: size, viewBox: '0 0 16 16', 'aria-hidden': 'true', style: { flex: 'none', display: 'block' } }, React.createElement('path', { d: 'M1.5 4.1h4.2l1.1 1.2h7.7v6.9a1 1 0 0 1-1 1H2.5a1 1 0 0 1-1-1V4.1Z', fill: '#8ba4c7' }), React.createElement('path', { d: 'M1.5 4.1h4.2l1.1 1.2h7.7', stroke: '#6b86ad', strokeWidth: 0.8, fill: 'none' }));
        case 'folderOpen':
          return React.createElement('svg', { width: size, height: size, viewBox: '0 0 16 16', 'aria-hidden': 'true', style: { flex: 'none', display: 'block' } }, React.createElement('path', { d: 'M1.5 4.1h4.2l1.1 1.2h7.7v6.9a1 1 0 0 1-1 1H2.5a1 1 0 0 1-1-1V4.1Z', fill: '#8ba4c7' }), React.createElement('path', { d: 'M1.5 6.5h13M3.4 6.5 2 13.2M13.8 6.5l-1.2 6.7', stroke: '#6b86ad', strokeWidth: 0.7, fill: 'none' }));
        case 'file':
          return React.createElement('svg', common, React.createElement('path', { d: 'M3.2 1.8h6l3.2 3.2v9.2H3.2V1.8Z' }), React.createElement('path', { d: 'M9.2 1.8v3.2h3.2' }));
        case 'check':
          return React.createElement('svg', common, React.createElement('path', { d: 'm2.5 8.4 3.2 3.2 7.8-7.8' }));
        case 'more':
          return React.createElement('svg', common, React.createElement('path', { d: 'M2.2 4h11.6M2.2 8h9M2.2 12h6.4' }), React.createElement('path', { d: 'm10.4 10.6 2.8 2.8m0-2.8-2.8 2.8' }));
        case 'split':
          return React.createElement('svg', common, React.createElement('rect', { x: 1.8, y: 2.6, width: 12.4, height: 10.8, rx: 1 }), React.createElement('path', { d: 'M8 2.6v10.8' }));
        case 'annotate':
          return React.createElement('svg', common, React.createElement('path', { d: 'M2.4 3.2h11.2M2.4 8h6M2.4 12.8h4.4' }), React.createElement('path', { d: 'M11 6.6v3.2a2 2 0 0 1-2 2H6.4' }));
        case 'graph':
          return React.createElement('svg', common, React.createElement('circle', { cx: 4, cy: 3.4, r: 1.6 }), React.createElement('circle', { cx: 4, cy: 12.6, r: 1.6 }), React.createElement('circle', { cx: 11.5, cy: 8, r: 1.6 }), React.createElement('path', { d: 'M4 5v6M5.6 8h4.3' }));
        case 'graphNode':
          return React.createElement('svg', { ...common, viewBox: '0 0 12 12' }, React.createElement('circle', { cx: 6, cy: 6, r: 3.4, fill: 'currentColor', stroke: 'none' }));
        case 'graphMerge':
          return React.createElement('svg', { ...common, viewBox: '0 0 12 12' }, React.createElement('circle', { cx: 6, cy: 6, r: 3.4 }), React.createElement('circle', { cx: 6, cy: 6, r: 1.2, fill: 'currentColor', stroke: 'none' }));
        case 'stash':
          return React.createElement('svg', common, React.createElement('path', { d: 'M2.4 3.2h11.2v3.1a1 1 0 0 1-1 1H3.4a1 1 0 0 1-1-1V3.2Z' }), React.createElement('path', { d: 'M4.6 7.3v5.5h6.8V7.3' }), React.createElement('path', { d: 'M6.4 10h3.2' }));
        case 'push':
          return React.createElement('svg', common, React.createElement('path', { d: 'M8 12.4V3.2M4.2 6.9 8 3.1l3.8 3.8' }), React.createElement('path', { d: 'M3 13.2h10' }));
        case 'update':
          return React.createElement('svg', common, React.createElement('path', { d: 'M8 2.8v8.4M4.6 8 8 11.4 11.4 8' }), React.createElement('path', { d: 'M2.6 13.2h10.8' }));
        case 'fetch':
          return React.createElement('svg', common, React.createElement('path', { d: 'M8 2.2v6.2M5.2 6 8 8.8 10.8 6' }), React.createElement('path', { d: 'M2.6 10.4v2.4a1 1 0 0 0 1 1h8.8a1 1 0 0 0 1-1v-2.4' }));
        case 'sort':
          return React.createElement('svg', common, React.createElement('path', { d: 'M2.5 4h11M2.5 8h7.5M2.5 12h4' }));
        case 'ignore':
          return React.createElement('svg', common, React.createElement('circle', { cx: 8, cy: 8, r: 5.6 }), React.createElement('path', { d: 'm4 12 8-8' }));
        case 'search':
          return React.createElement('svg', common, React.createElement('circle', { cx: 7, cy: 7, r: 4.2 }), React.createElement('path', { d: 'm10.2 10.2 3.6 3.6' }));
        default:
          return null;
      }
    }

    /** A file/folder icon row cell. */
    function EntryIcon({ entry, expanded }) {
      if (entry.kind === 'directory') {
        return React.createElement(Icon, { name: entry.root ? 'folderOpen' : expanded ? 'folderOpen' : 'folder', size: 18 });
      }
      const badge = fileBadge(entry.path);
      if (badge === null) return React.createElement(Icon, { name: 'file', size: 16 });
      return React.createElement(
        'span',
        {
          style: {
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 16,
            height: 16,
            borderRadius: 3,
            background: badge.background,
            color: badge.color,
            fontSize: badge.label.length > 2 ? 6 : 8,
            fontWeight: 700,
            lineHeight: 1,
            letterSpacing: -0.2,
          },
        },
        badge.label,
      );
    }

    /** Status color and compact label for one git porcelain status. */
    function gitStatusInfo(status) {
      if (status === undefined) return null;
      if (status === '??') return { label: 'U', color: '#6e7781' };
      const index = status[0];
      const worktree = status[1];
      if (index === 'R' || index === 'C') return { label: index, color: '#8250df' };
      if (index === 'A') return { label: 'A', color: '#1a7f37' };
      if (index === 'D' || worktree === 'D') return { label: 'D', color: '#cf222e' };
      if (index === 'U' || worktree === 'U') return { label: '!', color: '#cf222e' };
      if (index === 'M') return { label: 'M', color: '#2f65ca' };
      if (worktree === 'M') return { label: 'M↓', color: '#2f65ca' };
      if (worktree === 'A') return { label: 'A', color: '#1a7f37' };
      return { label: '±', color: '#2f65ca' };
    }

    /**
     * The status badge a palette row should show, or null when the file is clean.
     *
     * Go to File lists paths only; without the badge, two files with the same
     * basename are indistinguishable and the modified one (the one you were
     * probably looking for) does not stand out — IDEA's search popups mark them.
     * @param {string} path - workspace-relative file path.
     * @param {Map<string, string>} changes - porcelain status by path.
     * @returns {{label: string, color: string}|null} badge info.
     */
    function badgeFor(path, changes) {
      if (!(changes instanceof Map)) return null;
      const status = changes.get(path);
      return gitStatusInfo(status);
    }

    /**
     * Three-state selection for one directory or group (IDEA's tri-state checkbox).
     *
     * "some" is the state that matters: a directory holding two changed files
     * where only one is ticked must not render as an empty checkbox, or the user
     * cannot tell a partial selection from none at all.
     * @param {string[]} paths - every changed path below this node.
     * @param {Set<string>} selected - currently ticked paths.
     * @returns {'all'|'some'|'none'} the state to render.
     */
    function selectionStateOf(paths, selected) {
      const members = Array.isArray(paths) ? paths : [];
      if (members.length === 0) return 'none';
      const picked = members.filter((path) => selected?.has?.(path) === true).length;
      if (picked === 0) return 'none';
      return picked === members.length ? 'all' : 'some';
    }

    /**
     * Sum one band's line counts, IDEA's `+12 −3` on a directory or group header.
     *
     * Each band (staged vs working tree) reads its own side: the same file can
     * appear in both, and adding the two together would double-count it. Rows
     * with no reading (an untracked file) and binary rows contribute nothing,
     * and a band with no readings at all returns `undefined` so the header stays
     * blank instead of claiming `+0 −0`.
     * @param {object[]} changes - changes in this band or below one directory.
     * @param {'staged'|'unstaged'|'unversioned'} band - which side to read.
     * @returns {{additions: number, deletions: number}|undefined} summed counts.
     */
    function subtotalOf(changes, band) {
      if (!Array.isArray(changes) || changes.length === 0) return undefined;
      const readings = changes
        .map((change) => (band === 'staged' ? change?.stagedLines : band === 'unstaged' ? change?.unstagedLines : undefined))
        .filter((counts) => counts !== undefined && counts !== null && counts.binary !== true);
      if (readings.length === 0) return undefined;
      return {
        additions: readings.reduce((total, counts) => total + counts.additions, 0),
        deletions: readings.reduce((total, counts) => total + counts.deletions, 0),
      };
    }

    /**
     * The file name of a workspace-relative path, split for a two-tone label.
     *
     * IDEA's diff and editor headers print `r147nest/deep/inner/x.ts` with the
     * path in grey and the NAME in the emphasised colour, and they never
     * ellipsize the name: the path is the part that gives way. Splitting here
     * (rather than in each header) keeps the diff pane, the annotate pane and
     * the compare-with-revision pane on the same rule.
     * @param {string} path - workspace-relative path.
     * @returns {{dir: string, name: string}} the muted parent and the name.
     */
    function splitPathLabel(path) {
      const text = typeof path === 'string' ? path : '';
      const index = text.lastIndexOf('/');
      /* No trailing slash on purpose: the label is `direction: rtl` so an
         over-long path keeps its tail, and in that context a trailing `/` is a
         neutral character that bidi moves to the FRONT (`/r147nest`). */
      return { dir: index < 0 ? '' : text.slice(0, index), name: index < 0 ? text : text.slice(index + 1) };
    }

    /**
     * IDEA's per-row change size: `+N` in green and `−M` in red.
     *
     * A binary change has no counts at all, so it renders as `bin` instead of a
     * fabricated `+0 −0`; a path with no numstat row (an untracked file) renders
     * nothing at all, because the absence of the number IS the information.
     * @param {{counts: object|undefined}} props - numstat reading for this row.
     * @returns {object|null} the badge, or null when there is nothing honest to show.
     */
    function LineCounts({ counts }) {
      if (counts === undefined || counts === null) return null;
      if (counts.binary === true) {
        return React.createElement('span', { style: styles.lineCountBinary, title: 'binary' }, 'bin');
      }
      return React.createElement(
        'span',
        { style: styles.lineCounts, title: `+${counts.additions} −${counts.deletions}` },
        React.createElement('span', { style: styles.lineCountAdd }, `+${counts.additions}`),
        React.createElement('span', { style: styles.lineCountDel }, `−${counts.deletions}`),
      );
    }

    /**
     * Split a commit message into IDEA's subject line and its body.
     *
     * Git convention (and IDEA's own counters) treat the first line as the subject:
     * 50 characters is the soft limit, 72 the point where the log pane truncates.
     * @param {string} message - full commit message draft.
     * @returns {{subject: string, body: string, subjectLength: number, bodyLines: number}} decomposed message.
     */
    function commitMetrics(message) {
      const text = typeof message === 'string' ? message : '';
      const newline = text.indexOf('\n');
      const subject = newline === -1 ? text : text.slice(0, newline);
      const body = newline === -1 ? '' : text.slice(newline + 1);
      return {
        subject,
        body,
        subjectLength: subject.trimEnd().length,
        bodyLines: body === '' ? 0 : body.trimEnd().split('\n').length,
      };
    }

    /** Small left-hand git status decoration matching IDEA's M↓/A/D marks. */
    function GitStatusBadge({ status, selected, info: explicit = null }) {
      const info = explicit ?? gitStatusInfo(status);
      if (info === null) return null;
      return React.createElement(
        'span',
        { style: { ...styles.statusBadge, color: selected ? '#fff' : info.color }, title: typeof status === 'string' ? status : info.label },
        info.label,
      );
    }

    /** One vertical activity-stripe entry. */
    function StripeItem({ id, label, icon, active, onClick }) {
      return React.createElement(
        'button',
        {
          type: 'button',
          className: 'dsh-editor-stripe-item',
          style: { ...styles.stripeItem, ...(active ? styles.stripeItemActive : null) },
          title: label,
          'aria-pressed': active,
          onClick: () => onClick(id),
        },
        React.createElement(Icon, { name: icon, size: 16 }),
        React.createElement('span', { style: styles.stripeText }, label),
      );
    }

    /** Left activity stripe: Project and Commit tool windows plus the terminal dock toggle. */
    function ActivityStripe({ activity, panelVisible, terminalOpen, onSelect, t }) {
      return React.createElement(
        'div',
        { style: styles.stripe, role: 'tablist', 'aria-label': 'Editor tool windows' },
        React.createElement(StripeItem, {
          id: 'project',
          label: t('editor.project'),
          icon: 'project',
          active: activity === 'project' && panelVisible,
          onClick: onSelect,
        }),
        React.createElement(StripeItem, {
          id: 'commit',
          label: t('editor.commit'),
          icon: 'commit',
          active: activity === 'commit' && panelVisible,
          onClick: onSelect,
        }),
        React.createElement(StripeItem, {
          id: 'terminal',
          label: t('editor.terminal'),
          icon: 'terminal',
          active: terminalOpen,
          onClick: onSelect,
        }),
      );
    }

    /**
     * IDEA-style tool-window toolbar with overflow.
     *
     * IDEA never squeezes the tool-window title to make room for actions: once
     * the actions stop fitting they collapse into a "»" menu. The groups are
     * measured independently so left/right alignment survives a narrow panel.
     */
    function PanelToolbar({ icon, title, left = [], right = [], badge = null, t, onBadge }) {
      const ref = React.useRef(null);
      const titleRef = React.useRef(null);
      const badgeRef = React.useRef(null);
      const [fits, setFits] = React.useState({ left: left.length, right: right.length });
      const [menu, setMenu] = React.useState(null);
      const leftKey = left.map((action) => action.id).join('|');
      const rightKey = right.map((action) => action.id).join('|');

      React.useLayoutEffect(() => {
        const node = ref.current;
        if (node === null) return;
        const measure = () => {
          /* 10px horizontal padding, plus a 4px gap after the title. */
          let room = node.clientWidth - 14 - (titleRef.current?.offsetWidth ?? 0);
          const fitGroup = (group) => {
            if (group.length * 25 <= room) {
              room -= group.length * 25;
              return group.length;
            }
            /* The "»" button costs one slot of its own. */
            const fit = Math.max(0, Math.min(group.length, Math.floor((room - 25) / 25)));
            room -= (fit + 1) * 25;
            return fit;
          };
          const nextLeft = fitGroup(left);
          /* A badge is decoration, not an action: it survives only while it fits. */
          const badgeWidth = badgeRef.current?.offsetWidth ?? 0;
          if (badgeWidth > 0 && badgeWidth <= room) room -= badgeWidth + 4;
          const nextRight = fitGroup(right);
          setFits((current) => (current.left === nextLeft && current.right === nextRight ? current : { left: nextLeft, right: nextRight }));
        };
        measure();
        const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
        observer?.observe(node);
        return () => observer?.disconnect();
      }, [leftKey, rightKey, badge]);

      const hidden = [...left.slice(fits.left), ...right.slice(fits.right)];
      const renderAction = (action) =>
        React.createElement(ToolbarButton, {
          key: action.id,
          icon: action.icon,
          label: action.label,
          disabled: action.disabled === true,
          active: action.active === true,
          onClick: action.onClick,
        });

      return React.createElement(
        'div',
        { ref, style: styles.panelToolbar },
        React.createElement(
          'span',
          { ref: titleRef, style: styles.panelTitle },
          icon === undefined ? null : React.createElement(Icon, { name: icon, size: 14 }),
          title,
        ),
        left.slice(0, fits.left).map(renderAction),
        React.createElement('span', { style: styles.toolbarSpacer }),
        badge === null
          ? null
          : onBadge === undefined
            ? React.createElement('span', { ref: badgeRef, style: styles.branchChip }, badge)
            : React.createElement(
                'button',
                {
                  ref: badgeRef,
                  type: 'button',
                  className: 'dsh-editor-branch-button',
                  style: { ...styles.branchChip, border: 'none', cursor: 'pointer' },
                  title: t('editor.branchPopup'),
                  'aria-label': t('editor.branchPopup'),
                  onClick: (event) => {
                    const rect = event.currentTarget.getBoundingClientRect();
                    onBadge({ x: rect.left, y: rect.bottom + 4 });
                  },
                },
                badge,
              ),
        right.slice(0, fits.right).map(renderAction),
        hidden.length === 0
          ? null
          : React.createElement(ToolbarButton, {
              icon: 'more',
              label: t('editor.moreActions'),
              onClick: (event) => {
                const rect = event.currentTarget.getBoundingClientRect();
                setMenu({
                  x: Math.max(4, rect.right - 188),
                  y: rect.bottom + 4,
                  items: hidden.map((action) => ({
                    id: action.id,
                    label: action.label,
                    disabled: action.disabled === true,
                    run: () => action.onClick(),
                  })),
                });
              },
            }),
        menu === null ? null : React.createElement(ContextMenu, { menu, onClose: () => setMenu(null), t }),
      );
    }

    /** One 24px panel toolbar button. */
    function ToolbarButton({ icon, label, onClick, disabled = false, active = false }) {
      return React.createElement(
        'button',
        {
          type: 'button',
          className: active ? 'dsh-editor-toolbar-button dsh-editor-toolbar-button-active' : 'dsh-editor-toolbar-button',
          style: {
            ...styles.toolbarButton,
            ...(disabled ? styles.toolbarButtonDisabled : null),
            ...(active ? styles.toolbarButtonActive : null),
          },
          title: label,
          'aria-label': label,
          /* IDEA renders a toggle as a pressed button, and screen readers need the
             same fact: `aria-pressed` is what "toggle" means here. */
          'aria-pressed': active,
          disabled,
          onClick: onClick,
        },
        React.createElement(Icon, { name: icon, size: 14 }),
      );
    }

    /** Project tool window: toolbar, IDEA-style tree, inline create row. */
    function ProjectPanel({
      t,
      root,
      home,
      entries,
      children,
      expanded,
      rows,
      selectedPath,
      selection,
      git,
      loading,
      error,
      createState,
      onToggle,
      onOpen,
      onSelect,
      onNewFile,
      onNewFolder,
      onGotoFile,
      onRecent,
      onCreateChange,
      onCreateCommit,
      onCreateCancel,
      onReveal,
      onExpandAll,
      onCollapseAll,
      onRefresh,
      onHide,
      rowRefs,
      treeRef,
      onTreeKeyDown,
      onContextMenu,
      onDrop,
      onClearSelection,
      showHidden,
      sortMode,
      onCycleSort,
      onToggleHidden,
      autoScroll,
      onToggleAutoScroll,
      onCreateParent,
      onCreateTemplate,
      renameState,
      onRenameChange,
      onRenameCommit,
      onRenameCancel,
      deletedPaths,
      newPaths,
    }) {
      const projectName = basename(root) || 'Workspace';
      const [search, setSearch] = React.useState('');
      /* IDEA highlights the tree when a dragged row would land on the root. */
      const [rootDropActive, setRootDropActive] = React.useState(false);
      const [searchOpen, setSearchOpen] = React.useState(false);
      const searchRef = React.useRef(null);
      /* ⌘/Ctrl+F inside the tool window filters the tree in place, like IDEA. */
      React.useEffect(() => {
        const onKeyDown = (event) => {
          if (!(event.metaKey || event.ctrlKey) || event.altKey || event.key.toLowerCase() !== 'f') return;
          const host = event.target instanceof Element ? event.target.closest('[data-dsh-editor-workspace]') : null;
          if (host === null) return;
          /* The editor owns ⌘F when its textarea has focus. */
          if (document.activeElement?.closest('.monaco-editor') != null) return;
          event.preventDefault();
          event.stopPropagation();
          setSearchOpen(true);
          window.setTimeout(() => searchRef.current?.focus(), 0);
        };
        window.addEventListener('keydown', onKeyDown, true);
        return () => window.removeEventListener('keydown', onKeyDown, true);
      }, []);
      const visibleRows = React.useMemo(() => filterTreeRows(rows, search), [rows, search]);
      const gitChanges = new Map((git?.changes ?? []).map((change) => [change.path, change.status]));
      /* A directory inherits the strongest status among its descendants (IDEA aggregates colours). */
      const directoryChanged = (path) => (git?.changes ?? []).some((change) => change.path.startsWith(`${path}/`));
      /**
       * Aggregate one directory's git state from everything below it.
       *
       * The order is IDEA's precedence: a conflict outranks a deletion, which
       * outranks an addition, which outranks a rename, which outranks a plain
       * modification. The row shows a badge even while the directory is
       * collapsed — that is the only place the state is visible then.
       * @param {string} path - workspace-relative directory path.
       * @returns {{label: string, color: string}|null} badge, or null when clean.
       */
      const directoryStatus = (path) => directoryTint((git?.changes ?? []).filter((change) => change.path.startsWith(`${path}/`)));
      const createParent = createState === null ? '' : createState.parent;
      /* Every directory the tree currently knows about, root first. */
      const directoryChoices = React.useMemo(() => {
        const seen = new Set(['']);
        const choices = [{ path: '', name: projectName }];
        for (const row of rows) {
          if (row.kind !== 'directory' || seen.has(row.path)) continue;
          seen.add(row.path);
          choices.push({ path: row.path, name: row.path });
        }
        return choices;
      }, [projectName, rows]);
      return React.createElement(
        React.Fragment,
        null,
        React.createElement(PanelToolbar, {
          t,
          icon: 'project',
          title: t('editor.project'),
          left: [
            { id: 'newFile', icon: 'newFile', label: t('editor.newFile'), onClick: onNewFile },
            { id: 'newFolder', icon: 'newFolder', label: t('editor.newFolder'), onClick: onNewFolder },
            /* IDEA puts both navigation popups in the Project toolbar; without a
               button the only way to find ⌘E / ⌘⇧O is to already know the key. */
            { id: 'gotoFile', icon: 'file', label: t('editor.gotoFileHint'), onClick: onGotoFile ?? (() => {}) },
            { id: 'recent', icon: 'refresh', label: t('editor.recentFilesHint'), onClick: onRecent ?? (() => {}) },
          ],
          right: [
            { id: 'reveal', icon: 'target', label: t('editor.reveal'), onClick: onReveal },
            { id: 'expand', icon: 'expand', label: t('editor.expandAll'), onClick: onExpandAll },
            { id: 'collapse', icon: 'collapse', label: t('editor.collapseAll'), onClick: onCollapseAll },
            { id: 'refresh', icon: 'refresh', label: t('editor.refresh'), onClick: onRefresh },
            {
              id: 'sort',
              icon: 'sort',
              label: t(`editor.sort_${sortMode ?? 'name'}`),
              onClick: onCycleSort,
            },
            {
              id: 'hidden',
              icon: onToggleHidden === undefined ? 'settings' : 'eye',
              label: showHidden ? t('editor.hideHidden') : t('editor.showHidden'),
              onClick: onToggleHidden ?? (() => {}),
            },
            /* IDEA keeps this toggle in the Project toolbar, right before the
               "collapse all / options" group. */
            {
              id: 'autoscroll',
              icon: 'autoscroll',
              label: autoScroll === false ? t('editor.autoScrollOff') : t('editor.autoScrollOn'),
              active: autoScroll !== false,
              onClick: onToggleAutoScroll ?? (() => {}),
            },
            { id: 'hide', icon: 'hide', label: t('editor.hide'), onClick: onHide },
          ],
        }),
        searchOpen
          ? React.createElement(
              'div',
              { style: styles.treeSearchRow },
              React.createElement(Icon, { name: 'search', size: 12 }),
              React.createElement('input', {
                ref: searchRef,
                style: { ...styles.findInput, flex: '1 1 auto', width: 'auto' },
                placeholder: t('editor.treeSearchPlaceholder'),
                value: search,
                'aria-label': t('editor.treeSearch'),
                onChange: (event) => setSearch(event.target.value),
                onKeyDown: (event) => {
                  if (event.key === 'Escape') {
                    event.preventDefault();
                    setSearch('');
                    setSearchOpen(false);
                    treeRef.current?.focus();
                  } else if (event.key === 'Enter') {
                    /* Enter jumps to the first hit, IDEA's speed-search behaviour —
                       and "jumps" means opens it: selecting a row leaves the
                       editor showing the previous file. */
                    event.preventDefault();
                    const hit = visibleRows.find((row) => row.path !== '' && row.name.toLowerCase().includes(search.trim().toLowerCase()));
                    if (hit === undefined) return;
                    onSelect(hit, {});
                    /* Close the box so the opened file (or folder) owns the keyboard. */
                    setSearch('');
                    setSearchOpen(false);
                    /* Expand a CLOSED folder; an open one stays open (toggling would
                       close it, the opposite of "jump to this directory"). */
                    const action = revealInTree({ ...hit, open: expanded.has(hit.path) });
                    if (action === 'expand') onToggle(hit.path);
                    else if (action === 'open') onOpen(hit.path);
                    /* Hand the keyboard back to the tree: the search box is gone, and
                       leaving focus on a detached input strands the arrow keys. */
                    window.setTimeout(() => treeRef.current?.focus(), 0);
                  }
                },
              }),
              React.createElement(
                'button',
                { type: 'button', style: styles.conflictAction, onClick: () => { setSearch(''); setSearchOpen(false); } },
                '×',
              ),
            )
          : null,
        createState !== null
          ? React.createElement(
              'div',
              { style: styles.createRow },
              React.createElement(Icon, { name: createState.kind === 'directory' ? 'newFolder' : 'newFile', size: 14 }),
              React.createElement('input', {
                style: styles.createInput,
                value: createState.value,
                placeholder: createState.kind === 'directory' ? t('editor.newFolder') : t('editor.newFile'),
                autoFocus: true,
                onChange: (event) => onCreateChange(event.target.value),
                onKeyDown: (event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    onCreateCommit();
                  } else if (event.key === 'Escape') {
                    event.preventDefault();
                    onCreateCancel();
                  }
                },
              }),
              /* The parent is selectable here: the row that was selected when the box
                 opened is only a guess, and a wrong guess creates the file elsewhere. */
              React.createElement(
                'select',
                {
                  style: styles.createParentSelect,
                  value: createParent,
                  'aria-label': t('editor.createIn'),
                  title: t('editor.createIn'),
                  onChange: (event) => onCreateParent(event.target.value),
                },
                directoryChoices.map((directory) =>
                  React.createElement(
                    'option',
                    { key: directory.path === '' ? 'root' : directory.path, value: directory.path },
                    directory.path === '' ? projectName : directory.path,
                  ),
                ),
              ),
              /* IDEA asks WHICH template before it creates a file; a checkbox is
                 the cheapest honest version of that choice: on = the extension's
                 skeleton, off = an empty file. Hidden for directories, which have
                 no content to template. */
              createState.kind === 'file' && onCreateTemplate !== undefined
                ? React.createElement(
                    'button',
                    {
                      type: 'button',
                      style: { ...styles.createTemplateToggle, ...(createState.template === false ? null : styles.createTemplateToggleOn) },
                      title: createState.template === false ? t('editor.templateOn') : t('editor.templateOff'),
                      'aria-pressed': createState.template !== false,
                      onClick: () => onCreateTemplate(createState.template === false),
                    },
                    '{ }',
                  )
                : null,
            )
          : null,
        React.createElement(
          'div',
          {
            ref: treeRef,
            tabIndex: 0,
            style: { ...styles.treeScroll, ...(rootDropActive ? styles.treeRootDrop : null) },
            onKeyDown: onTreeKeyDown,
            role: 'tree',
            'aria-label': t('editor.project'),
            /* A click that misses every row clears the selection, IDEA's background
               click. Rows stop at their own handler, so checking the target is
               enough — no `stopPropagation` needed on the row. */
            onClick: (event) => {
              const target = event.target instanceof Element ? event.target.closest('.dsh-editor-tree-row') : null;
              if (target !== null) return;
              onClearSelection?.();
            },
            /* Dropping on the empty area below the rows means the workspace root.
               Rows handle their own drops; this only fires for the background. */
            onDragOver: (event) => {
              if (!event.dataTransfer?.types?.includes('text/plain')) return;
              event.preventDefault();
              event.dataTransfer.dropEffect = 'move';
              setRootDropActive(true);
            },
            onDragLeave: (event) => {
              /* Leaving into a child row must not clear the child's own highlight. */
              if (event.currentTarget.contains(event.relatedTarget)) return;
              setRootDropActive(false);
            },
            onDrop: (event) => {
              /* Only a tree drag carries newline-separated paths; a text drag from
                 the terminal or the chat must not move files. */
              const raw = event.dataTransfer?.getData('text/plain') ?? '';
              const sources = raw.split('\n').filter((entry) => entry !== '');
              setRootDropActive(false);
              if (sources.length === 0) return;
              /* A row's own drop stops propagation, so reaching here means the
                 pointer was over the background. */
              const overRow = event.target instanceof Element ? event.target.closest('.dsh-editor-tree-row') !== null : false;
              if (overRow) return;
              event.preventDefault();
              onDrop(sources, '');
            },
          },
          shouldShowTreeLoading({ loading, rowCount: visibleRows.length })
            ? React.createElement('div', { style: styles.treeMessage }, t('editor.loading'))
            : null,
          error !== null ? React.createElement('div', { style: styles.treeMessage }, error) : null,
          treeSearchMiss({ query: search, rows: visibleRows })
            ? React.createElement('div', { style: styles.treeMessage }, t('editor.noMatches'))
            : null,
          visibleRows.map((row) => {
            if (row.kind === 'placeholder') {
              return React.createElement(
                'div',
                {
                  key: row.path,
                  className: 'dsh-editor-tree-row dsh-editor-tree-row-placeholder',
                  'data-dsh-placeholder': row.path,
                  style: { ...styles.treeRow, paddingLeft: 8 + row.depth * 14, color: 'var(--dsw-alias-label-tertiary)', fontStyle: 'italic', cursor: 'default' },
                },
                t('editor.emptyDirectory'),
              );
            }
            const selected = selection.has(row.path);
            const primary = row.path === selectedPath;
            const status = gitChanges.get(row.path);
            const isDirectory = row.kind === 'directory';
            const open = expanded.has(row.path);
            return React.createElement(
              'div',
              {
                key: row.path === '' ? '__root__' : row.path,
                ref: (element) => {
                  if (element !== null) rowRefs.current.set(row.path, element);
                  else rowRefs.current.delete(row.path);
                },
                className: selected
                  ? primary
                    ? 'dsh-editor-tree-row dsh-editor-tree-row-selected'
                    : 'dsh-editor-tree-row dsh-editor-tree-row-selected dsh-editor-tree-row-extended'
                  : 'dsh-editor-tree-row',
                style: { ...styles.treeRow, ...(selected ? (primary ? styles.treeRowSelected : styles.treeRowSelectedSoft) : null) },
                title: row.path === '' ? root : row.path,
                role: 'treeitem',
                'aria-expanded': isDirectory ? open : undefined,
                'aria-selected': selected,
                onClick: (event) => {
                  onSelect(row, event);
                  if (event.metaKey || event.ctrlKey || event.shiftKey) return;
                  if (isDirectory) onToggle(row.path);
                  else onOpen(row.path);
                },
                /* IDEA keeps the keyboard in the TREE after a row click: the arrow
                   keys, the typeahead and ⇧F6/⌫ all belong to the selected row.
                   Opening the file used to move focus into Monaco, so the tree's
                   advertised keys (F2, Delete, ⌘F, typeahead) never reached it. */
                onMouseDown: (event) => {
                  if (event.button !== 0) return;
                  if (event.metaKey || event.ctrlKey || event.shiftKey) return;
                  if (event.target instanceof Element && event.target.closest('input') !== null) return;
                  treeRef.current?.focus();
                },
                /* A double-click OPENS (that click already toggled/opened), and
                   must not start a rename: IDEA's slow double-click does, but here
                   the edit field also commits on blur, so merely clicking a few
                   rows renamed whichever one was double-clicked last. It looked
                   like an unprompted rename and, for a directory, produced
                   `EINVAL … rename 'assets' -> 'assets/assets'`. Rename is now
                   only reached from the context menu (or F2). */
                onDoubleClick: (event) => {
                  if (row.root) return;
                  /* Keep the second click from toggling the directory back. */
                  event.stopPropagation();
                },
                onContextMenu: (event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  /* Right-clicking outside the selection moves it; inside it acts on all rows. */
                  if (!selection.has(row.path)) onSelect(row, {});
                  onContextMenu({ row, x: event.clientX, y: event.clientY });
                },
                draggable: !row.root,
                onDragStart: (event) => {
                  /* Dragging a row inside a multi-row selection moves the whole selection. */
                  const payload = selection.has(row.path) && selection.size > 1
                    ? rows.filter((entry) => selection.has(entry.path) && entry.path !== '').map((entry) => entry.path)
                    : [row.path];
                  event.dataTransfer?.setData('text/plain', payload.join('\n'));
                  event.dataTransfer.effectAllowed = 'move';
                },
                onDragOver: (event) => {
                  if (!isDirectory || !event.dataTransfer?.types?.includes('text/plain')) return;
                  event.preventDefault();
                  event.dataTransfer.dropEffect = 'move';
                },
                onDrop: (event) => {
                  if (!isDirectory) return;
                  event.preventDefault();
                  /* One path per line: the drop handler moves each of them. */
                  const sources = (event.dataTransfer?.getData('text/plain') ?? '').split('\n').filter((entry) => entry !== '');
                  if (sources.length === 0 || sources.includes(row.path)) return;
                  onDrop(sources, row.path);
                },
              },
              /* Indentation FIRST, then the chevron: with the guides after it every
                 row's arrow sat at the same left edge, so a nested folder looked like a
                 sibling and the hierarchy only showed as trailing whitespace. */
              row.depth > 0
                ? Array.from({ length: row.depth }, (_, index) => {
                    const kind = guideKind({ continues: row.continues, index, depth: row.depth });
                    return React.createElement('span', {
                      key: index,
                      /* The last child elbows into its row (└), IDEA's tree. */
                      style: kind === 'corner' ? styles.indentGuideCorner : kind === 'line' ? styles.indentGuide : styles.indentGuideStop,
                    });
                  })
                : null,
              isDirectory
                ? React.createElement(
                    'span',
                    { style: { ...styles.chevron, color: selected ? '#fff' : 'var(--dsw-alias-label-tertiary)' } },
                    React.createElement(Icon, { name: open ? 'chevronDown' : 'chevronRight', size: 10 }),
                  )
                /* Files keep the column so their icon lines up with sibling folders. */
                : React.createElement('span', { style: { ...styles.chevron, opacity: 0 } }),
              React.createElement(EntryIcon, { entry: row, expanded: open }),
              renameState !== null && renameState.path === row.path
                ? React.createElement('input', {
                    style: styles.renameInput,
                    value: renameState.value,
                    autoFocus: true,
                    onClick: (event) => event.stopPropagation(),
                    onChange: (event) => onRenameChange(event.target.value),
                    onBlur: () => onRenameCommit(),
                    onKeyDown: (event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        onRenameCommit();
                      } else if (event.key === 'Escape') {
                        event.preventDefault();
                        onRenameCancel();
                      }
                    },
                  })
                : React.createElement(
                    'span',
                    {
                      style: {
                        ...styles.treeName,
                        ...(row.root ? styles.treeRootName : null),
                        /* The root's folder name is the part that identifies the
                           project; only the path beside it may be truncated. */
                        ...(row.root ? styles.treeRootLabel : null),
                        ...(selected ? { color: '#fff' } : null),
                        /* Files and folders alike: a change tints the name, never a letter. */
                        ...(treeNameColor({ status, selected }) === null ? null : { color: treeNameColor({ status, selected }) }),
                        ...(isDirectory && !selected && status === undefined && directoryStatus(row.path) !== null
                          ? { color: directoryStatus(row.path).color }
                          : null),
                        /* IDEA strikes through a file that vanished from disk. */
                        ...(deletedPaths?.has?.(row.path) ? { textDecoration: 'line-through', opacity: 0.6 } : null),
                        /* A file created outside the editor is tinted once, like IDEA's "new" hint. */
                        ...(newPaths?.has?.(row.path) ? { color: '#1a7f37' } : null),
                      },
                    },
                    /* Speed search underlines what matched; the rest keeps its colour. */
                    search.trim() === ''
                      ? row.name
                      : highlightParts(row.name, search).map((part, index) =>
                          part.match
                            ? React.createElement('span', { key: index, style: styles.treeNameMatch }, part.text)
                            : React.createElement('span', { key: index }, part.text),
                        ),
                  ),
              row.root
                ? React.createElement(
                    React.Fragment,
                    null,
                    branchLabel(git) !== '' ? React.createElement('span', { style: { ...styles.branchChip, marginLeft: 6 } }, branchLabel(git)) : null,
                    React.createElement(
                      'span',
                      { style: { ...styles.treeRootPath, color: selected ? 'rgba(255,255,255,0.72)' : undefined }, title: root },
                      splitRootLabel(root, home).path,
                    ),
                  )
                : null,
            );
          }),
        ),
      );
    }

    /**
     * IDEA-style context menu: one flat list of items with separators, icons and
     * disabled states, positioned at the pointer and dismissed on outside click.
     */
    /**
     * What a key press means for the currently focused menu level.
     *
     * IDEA's menus are navigable without the mouse: → opens a submenu (or steps into
     * its first item), ← returns to the parent level, and Esc closes ONE level so a
     * nested choice can be abandoned without losing the whole menu.
     * @param {string} key - the pressed key.
     * @param {{hasChildren: boolean, open: boolean}} state - the focused item.
     * @returns {'open'|'close'|'back'|'dismiss'|'first-child'|null} the action.
     */
    function submenuKeyAction(key, state) {
      const hasChildren = state?.hasChildren === true;
      const open = state?.open === true;
      if (key === 'ArrowRight') {
        if (!hasChildren) return null;
        return open ? 'first-child' : 'open';
      }
      if (key === 'ArrowLeft') return hasChildren && open ? 'close' : 'back';
      if (key === 'Escape') return open ? 'close' : 'dismiss';
      return null;
    }

    /**
     * Decide where a submenu opens and how wide it may get.
     *
     * Anchoring the child at the parent's edge is not enough: a tool window inside a
     * 560px viewport can leave less room than the child's own minimum. The side is
     * the one with more space, and the width is capped to that space so the menu
     * never spills off-screen.
     * @param {{parentLeft?: number, parentRight?: number, viewportWidth?: number, preferredWidth?: number}|null} geometry - measurements.
     * @returns {{side: 'right'|'left', maxWidth: number}} placement decision.
     */
    function submenuGeometry(geometry) {
      const fallback = { side: 'right', maxWidth: 260 };
      if (geometry === null || geometry === undefined) return fallback;
      const left = Number(geometry.parentLeft);
      const right = Number(geometry.parentRight);
      const viewport = Number(geometry.viewportWidth);
      const preferred = Number(geometry.preferredWidth ?? 260);
      if (![left, right, viewport, preferred].every((value) => Number.isFinite(value))) return fallback;
      if (viewport <= 0) return fallback;
      const roomRight = viewport - right - 8;
      const roomLeft = left - 8;
      /* Prefer the right when the child fits there; otherwise take whichever side
         has more room, so a narrow aside still shows a usable menu. */
      const side = roomRight >= preferred ? 'right' : roomLeft > roomRight ? 'left' : 'right';
      const room = side === 'right' ? roomRight : roomLeft;
      return { side, maxWidth: Math.max(140, Math.min(preferred, Math.max(room, 140))) };
    }

    /**
     * Which side a submenu opens on, given only the room to the parent's right.
     *
     * A thin wrapper over {@link submenuGeometry}: the child opens on the right when
     * its preferred width fits there, otherwise on the left (where the parent menu
     * itself proves there is room, since the menu was positioned on-screen first).
     * @param {{parentRight: number, viewportWidth: number, submenuWidth: number}|null} geometry - measurements.
     * @returns {'right'|'left'} the side to open on.
     */
    function submenuSide(geometry) {
      if (geometry === null || geometry === undefined) return 'right';
      const right = Number(geometry.parentRight);
      const viewport = Number(geometry.viewportWidth);
      const preferred = Number(geometry.submenuWidth);
      if (!Number.isFinite(right) || !Number.isFinite(viewport) || !Number.isFinite(preferred)) return 'right';
      if (viewport <= 0) return 'right';
      /* 8px keeps a small gutter against the window edge. */
      return viewport - right - 8 >= preferred ? 'right' : 'left';
    }

    function ContextMenu({ menu, onClose, t }) {
      const ref = React.useRef(null);
      const [position, setPosition] = React.useState({ left: menu.x, top: menu.y });
      /* IDEA nests destructive variants (Rollback) under one entry; the open child
         is tracked by the parent item's id so only one can be open at a time. */
      const [submenu, setSubmenu] = React.useState(null);
      /* The hovered parent item's box, used to decide which side the child opens. */
      const [itemRect, setItemRect] = React.useState(null);

      React.useLayoutEffect(() => {
        const node = ref.current;
        if (node === null) return;
        const rect = node.getBoundingClientRect();
        const left = Math.min(menu.x, window.innerWidth - rect.width - 8);
        const top = Math.min(menu.y, window.innerHeight - rect.height - 8);
        setPosition({ left: Math.max(4, left), top: Math.max(4, top) });
      }, [menu]);

      React.useEffect(() => {
        const onPointerDown = (event) => {
          if (ref.current?.contains(event.target)) return;
          onClose();
        };
        const onKeyDown = (event) => {
          /* Only Escape used to work, so a nested choice could not be abandoned
             without losing the parent menu too. */
          if (!['Escape', 'ArrowLeft', 'ArrowRight'].includes(event.key)) return;
          event.preventDefault();
          event.stopPropagation();
          if (submenu === null) {
            if (event.key === 'Escape') onClose();
            return;
          }
          const parent = (menu.items ?? []).find((item) => item !== null && item.id === submenu);
          const action = submenuKeyAction(event.key, { hasChildren: true, open: true });
          if (action === 'close') {
            setSubmenu(null);
            return;
          }
          if (action === 'first-child') {
            const first = parent?.items?.find((child) => child !== null);
            if (first !== undefined) {
              onClose();
              first.run();
            }
          }
        };
        document.addEventListener('mousedown', onPointerDown, true);
        document.addEventListener('keydown', onKeyDown, true);
        return () => {
          document.removeEventListener('mousedown', onPointerDown, true);
          document.removeEventListener('keydown', onKeyDown, true);
        };
      }, [menu.items, onClose, submenu]);

      return React.createElement(
        'div',
        {
          ref,
          className: 'dsh-editor-menu',
          style: { ...styles.menu, left: position.left, top: position.top },
          role: 'menu',
          onContextMenu: (event) => event.preventDefault(),
        },
        /* An optional disabled header, used to say how many rows an action affects. */
        menu.title
          ? React.createElement('div', { style: styles.menuTitle, role: 'presentation' }, menu.title)
          : null,
        menu.items.map((item, index) =>
          item === null
            ? React.createElement('div', { key: `sep-${index}`, style: styles.menuSeparator })
            : React.createElement(
                'button',
                {
                  key: item.id,
                  type: 'button',
                  role: 'menuitem',
                  className: item.danger ? 'dsh-editor-menu-item dsh-editor-menu-danger' : 'dsh-editor-menu-item',
                  style: { ...styles.menuItem, ...(item.danger ? styles.menuItemDanger : null), ...(item.disabled ? styles.menuItemDisabled : null) },
                  disabled: item.disabled === true,
                  onMouseEnter: (event) => {
                    /* Remember where the parent sits: the child flips left when the
                       right edge has no room. */
                    setItemRect(event.currentTarget.getBoundingClientRect());
                    setSubmenu(Array.isArray(item.items) && item.items.length > 0 ? item.id : null);
                  },
                  onClick: () => {
                    /* A parent with children only opens them; running it would fire
                       whatever its first child means. */
                    if (Array.isArray(item.items) && item.items.length > 0) {
                      setSubmenu(item.id);
                      return;
                    }
                    onClose();
                    item.run();
                  },
                },
                /* IDEA's terminal lists show the tab's colour next to its name;
                   a menu without swatches must not gain an empty gutter. */
                item.swatch === undefined || item.swatch === null
                  ? null
                  : React.createElement('span', { style: { ...styles.menuSwatch, background: item.swatch } }),
                React.createElement('span', { style: styles.menuLabel }, item.label),
                item.shortcut === undefined || item.shortcut === ''
                  ? null
                  : React.createElement('span', { className: 'dsh-editor-menu-shortcut', style: styles.menuShortcut }, item.shortcut),
                Array.isArray(item.items) && item.items.length > 0
                  ? React.createElement('span', { className: 'dsh-editor-menu-shortcut', style: styles.menuShortcut }, '›')
                  : null,
                Array.isArray(item.items) && item.items.length > 0 && submenu === item.id
                  ? React.createElement(
                      'div',
                      {
                        style: (() => {
                          const placement = submenuGeometry({
                            parentLeft: itemRect?.left ?? 0,
                            parentRight: itemRect?.right ?? 0,
                            viewportWidth: window.innerWidth,
                            preferredWidth: 260,
                          });
                          return {
                            ...styles.submenu,
                            ...(placement.side === 'left' ? styles.submenuLeft : null),
                            maxWidth: `${Math.round(placement.maxWidth)}px`,
                          };
                        })(),
                        role: 'menu',
                      },
                      item.items.map((child) =>
                        child === null
                          ? null
                          : React.createElement(
                              'button',
                              {
                                key: child.id,
                                type: 'button',
                                role: 'menuitem',
                                className: child.danger ? 'dsh-editor-menu-item dsh-editor-menu-danger' : 'dsh-editor-menu-item',
                                style: { ...styles.menuItem, ...(child.danger ? styles.menuItemDanger : null) },
                                onClick: (event) => {
                                  event.stopPropagation();
                                  onClose();
                                  child.run();
                                },
                              },
                              React.createElement('span', { style: styles.menuLabel }, child.label),
                              child.shortcut === undefined || child.shortcut === ''
                                ? null
                                : React.createElement(
                                    'span',
                                    { className: 'dsh-editor-menu-shortcut', style: styles.menuShortcut },
                                    child.shortcut,
                                  ),
                            ),
                      ),
                    )
                  : null,
              ),
        ),
      );
    }

    /**
     * Split porcelain changes into IDEA's staged and working-tree groups.
     * @param {object[]} changes - porcelain changes from the host.
     * @returns {{staged: object[], unstaged: object[]}} grouped changes.
     */
    function splitChanges(changes) {
      const staged = [];
      const unstaged = [];
      /* IDEA keeps brand-new files in their own "Unversioned Files" node. */
      const unversioned = [];
      for (const change of changes) {
        const index = change.status[0];
        const worktree = change.status[1];
        if (change.status === '??') {
          unversioned.push(change);
          continue;
        }
        if (index !== ' ' && index !== '?') staged.push(change);
        if (worktree !== ' ') unstaged.push(change);
      }
      return { staged, unstaged, unversioned };
    }

    /**
     * Filter a change list by what the user typed (IDEA's change-list search).
     *
     * Matching is on the path, case-insensitively and as a plain substring: a
     * change list is a list of paths, so `docs/` or `.ts` are the useful queries.
     * The selection is deliberately NOT filtered — a ticked file that does not
     * match stays ticked, or typing in the box would silently change what the
     * next commit contains.
     * @param {object[]} changes - the group's changes.
     * @param {string} query - typed text; empty means "everything".
     * @returns {object[]} matching changes, original order.
     */
    function filterChanges(changes, query) {
      const needle = typeof query === 'string' ? query.trim().toLowerCase() : '';
      if (needle === '') return Array.isArray(changes) ? changes : [];
      return (Array.isArray(changes) ? changes : []).filter((change) => typeof change?.path === 'string' && change.path.toLowerCase().includes(needle));
    }

    /** IDEA's soft limit for a commit subject line. */
    const COMMIT_SUBJECT_LIMIT = 50;
    /** The width git log and forges truncate at: past this the tail is invisible. */
    const COMMIT_SUBJECT_HARD_LIMIT = 72;

    /** Porcelain codes that mean an unresolved merge conflict. */
    const CONFLICT_STATUS = /^(DD|AU|UD|UA|DU|AA|UU)$/u;

    /**
     * How long a typeahead prefix survives without another key.
     *
     * One second is IDEA's own feel: fast enough that `g` `r` reads as one
     * prefix, slow enough that a deliberate second search starts clean.
     */
    const TYPEAHEAD_RESET_MS = 1000;

    /**
     * Whether one porcelain change is an unresolved conflict.
     * @param {object} change - change entry from the host.
     * @returns {boolean} true when the file needs a resolution.
     */
    function isConflict(change) {
      return typeof change?.status === 'string' && CONFLICT_STATUS.test(change.status);
    }

    /** Directory tree for one change group, sorted directories-first. */
    function changeTreeOf(changes, depthLimit = Infinity) {
      const root = { name: '', path: '', directories: new Map(), files: [] };
      /* `depthLimit` is IDEA's "Group by" choice: 0 is a single flat list, 1
         groups by module (the first path segment), Infinity by the whole path. */
      const limit = Number.isFinite(depthLimit) ? Math.max(0, depthLimit) : Infinity;
      for (const change of changes) {
        const segments = change.path.split('/');
        let node = root;
        for (let index = 0; index < segments.length - 1 && index < limit; index += 1) {
          const segment = segments[index];
          const child = node.directories.get(segment) ?? {
            name: segment,
            path: segments.slice(0, index + 1).join('/'),
            directories: new Map(),
            files: [],
          };
          node.directories.set(segment, child);
          node = child;
        }
        node.files.push(change);
      }
      return sortChangeTree(root);
    }

    /**
     * How deep the change tree nests for one "Group by" mode.
     *
     * IDEA's dropdown offers three answers, and the difference is only the
     * nesting depth: a flat list (0), modules (1 — the top-level segment), or
     * the full directory tree. Keeping it as a number means the renderer and the
     * collapse keys stay identical for all three.
     * @param {string} mode - 'flat' | 'module' | 'directory'.
     * @returns {number} depth limit for {@link changeTreeOf}.
     */
    function groupingDepth(mode) {
      if (mode === 'flat') return 0;
      if (mode === 'module') return 1;
      return Infinity;
    }

    /** Sort one change tree in place and return it. */
    function sortChangeTree(node) {
      node.directories = new Map([...node.directories.entries()].sort(([left], [right]) => left.localeCompare(right, undefined, { sensitivity: 'base' })));
      node.files.sort((left, right) => left.path.localeCompare(right.path, undefined, { sensitivity: 'base' }));
      for (const child of node.directories.values()) sortChangeTree(child);
      return node;
    }

    /**
     * Flatten one change tree into the visible, collapsible row list.
     *
     * This is NOT the Project tree, and it is deliberately NOT nested. IDEA's
     * Commit panel lists the changed FILES flat — one row per file, whatever its
     * depth — and puts the parent path in a muted trailing label
     * (`engineering-memory.md   doc/spark`). A directory only appears as a
     * collapsible group row, and a chain of single-child directories collapses
     * into ONE row (`doc/spark/deep` shows as `deep   doc/spark`) instead of one
     * row per level. Nesting each level pushed names ever further right and made
     * two same-named files indistinguishable at a glance; flat rows also keep
     * every checkbox in one column.
     * @param {object} tree - sorted tree root.
     * @param {Set<string>} collapsed - collapsed directory paths prefixed by the group id.
     * @param {string} group - group identity used in collapse keys.
     * @param {number} depth - indentation depth (kept for the row shape; rows are flat).
     * @param {object[]} rows - accumulator.
     * @returns {object[]} visible rows.
     */
    function flattenChangeTree(tree, collapsed, group, depth = 0, rows = []) {
      for (const directory of tree.directories.values()) {
        /* Compact a chain of single-child directories: `a/b/c` is one row, so a
           file under it is told apart by the grey path, not by extra indents. */
        let leaf = directory;
        let path = directory.path;
        while (leaf.files.length === 0 && leaf.directories.size === 1) {
          const only = [...leaf.directories.values()][0];
          leaf = only;
          path = only.path;
        }
        const key = `${group}:${path}`;
        const open = !collapsed.has(key);
        /* The directory row stages/unstages everything below it, so it carries its own leaves. */
        const inside = collectChanges(leaf, []);
        rows.push({ kind: 'directory', path, name: basename(path), parent: dirname(path), depth: 0, open, collapseKey: key, changes: inside });
        if (open) flattenChangeTree(leaf, collapsed, group, depth + 1, rows);
      }
      /* Files are flat leaves: one fixed indent, never the depth of their path. */
      for (const change of tree.files) rows.push({ kind: 'file', path: change.path, name: basename(change.path), depth, change });
      return rows;
    }

    /**
     * Every collapse key below (and including) one directory, group-prefixed.
     *
     * IDEA's ⌥-click on a tree node toggles the whole subtree in one gesture;
     * a plain click still toggles just that level. Returning keys (not a new
     * tree) keeps the caller's `Set` update trivial and side-effect free.
     * @param {object} tree - the group's sorted change tree.
     * @param {string} group - group identity used in collapse keys.
     * @param {string} path - directory path the click landed on.
     * @returns {string[]} keys to flip, outermost first.
     */
    function collapseKeysOf(tree, group, path) {
      const keys = [];
      if (tree === null || typeof tree !== 'object') return keys;
      const walk = (node) => {
        for (const directory of node.directories?.values?.() ?? []) {
          if (directory.path === path) {
            const collect = (current) => {
              keys.push(`${group}:${current.path}`);
              for (const child of current.directories?.values?.() ?? []) collect(child);
            };
            collect(directory);
            return true;
          }
          if (walk(directory)) return true;
        }
        return false;
      };
      walk(tree);
      return keys;
    }

    /** Every change below one tree node. */
    function collectChanges(node, out = []) {
      for (const child of node.directories.values()) collectChanges(child, out);
      out.push(...node.files);
      return out;
    }

    /**
     * One side-by-side diff surface for the selected change.
     *
     * Monaco's diff editor is created once and re-bound to fresh models per
     * path, so moving between changed files keeps scroll position and theme.
     */
    /**
     * IDEA's Annotate view: per-line author/commit gutter for the open file.
     *
     * Read-only by design — IDEA's annotate is a reading mode, and making it
     * editable would mean keeping two line-number spaces in sync.
     * Clicking a line's commit opens it in the Log, which is IDEA's jump from
     * annotate to the change that produced the line.
     * @param {{t: Function, target: object, lines: object[], loading: boolean, truncated: boolean, onClose: Function, onOpenCommit: Function, selected: string|null}} props - annotate payload.
     * @returns {object} the annotate panel.
     */
    function AnnotatePreview({ t, target, lines, loading, truncated, onClose, onOpenCommit, selected }) {
      return React.createElement(
        'div',
        { style: styles.diffPane, className: 'dsh-editor-annotate-pane' },
        React.createElement(
          'div',
          { style: styles.diffHeader },
          React.createElement(PathLabel, { path: target?.path ?? '', style: styles.diffTitle }),
          React.createElement('span', { style: styles.diffHint }, t('editor.annotateMode')),
          truncated ? React.createElement('span', { style: styles.diffHint }, t('editor.annotateTruncated')) : null,
          React.createElement(ToolbarButton, { icon: 'hide', label: t('editor.closeAnnotate'), onClick: onClose }),
        ),
        loading
          ? React.createElement('div', { style: styles.empty }, t('editor.loading'))
          : React.createElement(
              'div',
              { style: styles.annotateScroll },
              lines.map((row) =>
                React.createElement(
                  'div',
                  {
                    key: row.line,
                    style: { ...styles.annotateRow, ...(selected === row.hash ? styles.commitGraphRowActive : null) },
                    className: 'dsh-editor-annotate-row',
                    title: `${row.hash} · ${row.summary}\n${t('editor.annotateOpenCommit')}`,
                    onClick: () => onOpenCommit?.(row.hash),
                  },
                  React.createElement('span', { style: styles.annotateMeta }, `${row.author} · ${formatCommitDate(row.date)}`),
                  React.createElement('span', { style: styles.annotateHash }, row.hash.slice(0, 7)),
                  React.createElement('span', { style: styles.annotateLineNo }, String(row.line)),
                ),
              ),
            ),
      );
    }

    function DiffPreview({ t, target, monacoReady, onClose }) {
      const hostRef = React.useRef(null);
      const diffRef = React.useRef(null);
      const [state, setState] = React.useState({ binary: false, error: null, missing: false });
      /* IDEA's diff toolbar walks hunks and shows which one you are on. */
      const [hunks, setHunks] = React.useState({ index: 0, total: 0 });
      /* Declared before the model effect uses it: the sync runs from async
         callbacks, and a `const` declared later would still be in its TDZ then. */
      const syncHunksRef = React.useRef(null);

      React.useEffect(() => {
        const node = hostRef.current;
        const monaco = window.monaco;
        if (!monacoReady || node === null || monaco?.editor === undefined) return;
        const diff = monaco.editor.createDiffEditor(node, {
          theme: detectTheme(),
          automaticLayout: true,
          readOnly: true,
          /* Inline rendering matches IDEA's unified diff and survives a narrow editor pane. */
          renderSideBySide: false,
          originalEditable: false,
          fontSize: 12,
          lineHeight: 19,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          renderOverviewRuler: false,
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
        });
        diffRef.current = diff;
        return () => {
          const models = diff.getModel();
          /* Same ordering rule as the swap below: the widget must let go of the
             models before they are disposed, or Monaco logs a warning per model. */
          diff.setModel(null);
          models?.original?.dispose();
          models?.modified?.dispose();
          diff.dispose();
          diffRef.current = null;
        };
      }, [monacoReady]);

      React.useEffect(() => {
        const diff = diffRef.current;
        const monaco = window.monaco;
        if (target === null || diff === null || monaco?.editor === undefined) return;
        let cancelled = false;
        /* A clipboard target sends its text; commit and change targets read from git. */
        const request = typeof target.clipboardText === 'string'
          ? { op: 'compareText', path: target.path, text: target.clipboardText, label: target.label }
          : typeof target.revision === 'string'
            /* Compare the file NOW against how it looked at that revision. */
            ? { op: 'diffWithRevision', hash: target.revision, path: target.path }
            : typeof target.commit === 'string'
              ? { op: 'commitDiff', hash: target.commit, path: target.path }
              : { op: 'diff', path: target.path, staged: target.staged };
        callGit(request)
          .then((value) => {
            if (cancelled || diffRef.current !== diff) return;
            if (value.binary) {
              diff.setModel(null);
              setState({ binary: true, error: null, missing: value.missing });
              return;
            }
            const tag = typeof target.clipboardText === 'string'
              ? 'clipboard'
              : typeof target.commit === 'string'
                ? `commit=${target.commit}`
                : `staged=${target.staged}`;
            const base = `file:///${target.path.split('/').map(encodeURIComponent).join('/')}`;
            const original = monaco.editor.createModel(value.original, safeLanguage(monaco, target.path), monaco.Uri.parse(`${base}?side=original&${tag}`));
            const modified = monaco.editor.createModel(value.modified, safeLanguage(monaco, target.path), monaco.Uri.parse(`${base}?side=modified&${tag}`));
            const previous = diff.getModel();
            /* Detach BEFORE disposing: a model the widget still holds logs
               "TextModel got disposed before DiffEditorWidget model got reset". */
            diff.setModel(null);
            previous?.original?.dispose();
            previous?.modified?.dispose();
            diff.setModel({ original, modified });
            setState({ binary: false, error: null, missing: value.missing });
            /* The widget computes the hunks asynchronously; `revealFirstDiff` waits
               for that pass, so reading `getLineChanges()` after it is safe. */
            diff.revealFirstDiff();
            syncHunksRef.current?.();
          })
          .catch((failure) => {
            if (!cancelled) setState({ binary: false, error: failure instanceof Error ? failure.message : String(failure), missing: false });
          });
        return () => {
          cancelled = true;
        };
      }, [target]);

      /* Track which hunk the modified pane's caret sits in, for the `n/total` label. */
      syncHunksRef.current = () => {
        const diff = diffRef.current;
        if (diff === null) return;
        const changes = diff.getLineChanges();
        const line = diff.getModifiedEditor()?.getPosition()?.lineNumber ?? 1;
        const next = hunkAt(changes, line);
        setHunks((current) => (current.index === next.index && current.total === next.total ? current : next));
      };

      React.useEffect(() => {
        const diff = diffRef.current;
        if (diff === null) return;
        const subscription = diff.onDidUpdateDiff(() => syncHunksRef.current?.());
        return () => subscription.dispose();
      }, [monacoReady]);

      /** Walk to the next or previous hunk, IDEA's diff toolbar arrows. */
      const walkHunk = React.useCallback((direction) => {
        const diff = diffRef.current;
        if (diff === null) return;
        diff.goToDiff(direction === 'previous' ? 'previous' : 'next');
        /* `goToDiff` moves the modified pane's selection, so the caret is current. */
        window.setTimeout(() => syncHunksRef.current?.(), 0);
      }, []);

      /* F7 / ⇧F7 are IDEA's "next / previous difference". They only act while a
         diff is open, so they cannot collide with the editor's own bindings. */
      React.useEffect(() => {
        const onKeyDown = (event) => {
          if (event.key !== 'F7') return;
          if (event.metaKey || event.ctrlKey || event.altKey) return;
          event.preventDefault();
          walkHunk(event.shiftKey ? 'previous' : 'next');
        };
        window.addEventListener('keydown', onKeyDown, true);
        return () => window.removeEventListener('keydown', onKeyDown, true);
      }, [walkHunk]);

      const hidden = target === null || state.binary;
      return React.createElement(
        'div',
        { style: styles.diffPane, className: 'dsh-editor-diff-pane' },
        React.createElement(
          'div',
          { style: styles.diffHeader },
          React.createElement(PathLabel, { path: target?.path ?? '', style: styles.diffTitle }),
          React.createElement(
            'span',
            { style: styles.diffHint },
            typeof target?.clipboardText === 'string'
              ? t('editor.compareClipboardMode')
              : typeof target?.revision === 'string'
                ? t('editor.compareRevisionMode', { hash: target.revision.slice(0, 7) })
              : typeof target?.commit === 'string'
                ? t('editor.commitDiffMode', { hash: target.commit.slice(0, 7) })
                : target?.staged === true
                  ? t('editor.stagedMode')
                  : t('editor.unstagedMode'),
          ),
          /* IDEA's diff toolbar: walk hunks, and say which one you are on. Hidden for
             an unchanged file — `0/0` next to two arrows that do nothing is noise. */
          hunks.total === 0
            ? null
            : React.createElement(
                'span',
                { style: styles.hunkNav, className: 'dsh-editor-hunk-nav' },
                React.createElement(ToolbarButton, { icon: 'chevronUp', label: t('editor.previousChange'), onClick: () => walkHunk('previous') }),
                React.createElement('span', { style: styles.hunkCounter, title: t('editor.hunkCounterHint') }, `${hunks.index}/${hunks.total}`),
                React.createElement(ToolbarButton, { icon: 'chevronDown', label: t('editor.nextChange'), onClick: () => walkHunk('next') }),
              ),
          React.createElement(ToolbarButton, { icon: 'hide', label: t('editor.closeDiff'), onClick: onClose }),
        ),
        state.error !== null ? React.createElement('div', { style: styles.error }, state.error) : null,
        state.binary ? React.createElement('div', { style: styles.empty }, t('editor.binaryDiff')) : null,
        React.createElement('div', { ref: hostRef, style: { ...styles.diffHost, display: hidden ? 'none' : 'block' } }),
      );
    }

    /**
     * Commit tool window: grouped changes tree, diff preview, message box and actions.
     *
     * Staged and working-tree groups are separate, like IDEA's commit panel, and
     * a file's checkbox decides what the commit contains.
     */
    function CommitPanel({
      t,
      git,
      selectedPaths,
      message,
      amend,
      busy,
      error,
      notice,
      diffTarget,
      collapsedGroups,
      monacoReady,
      onTogglePath,
      onToggleGroup,
      onToggleDirectory,
      onSelectDiff,
      onStage,
      onUnstage,
      onGitignore,
      onContextMenu,
      mode,
      onMode,
      scrollRefs,
      onRestoreScroll,
      commits,
      logLoading,
      logDetail,
      onLoadLog,
      onSelectCommit,
      onOpenFile,
      historyPath,
      onShowCommitDiff,
      onClearHistory,
      logAuthor,
      onLogAuthor,
      onLoadMoreLog,
      logExhausted,
      onLogContextMenu,
      onDirectoryMenu,
      highlightedCommit,
      graph,
      onLoadGraph,
      onGraphBranch,
      onGraphRef,
      selected,
      logFailure,
      onRetry,
      onFileMenu,
      onMessage,
      history,
      onRecall,
      onAmend,
      onCommit,
      onRefresh,
      onHide,
      projectName,
      onBranchMenu,
      onStashMenu,
      templates = [],
      onTemplate,
      identityMissing = false,
      pushFailure = null,
      onPush,
      undoMessage = '',
      onUndoMessage,
      pushing = false,
      updating = false,
      fetching = false,
      onFetch,
      onUpdate,
      groupBy = 'directory',
      onGroupBy,
      onGroupByMenu,
      pathQuery = '',
      onPathQuery,
    }) {
      const changes = git?.changes ?? [];
      const { staged, unstaged, unversioned } = splitChanges(changes);
      const groups = [
        { id: 'staged', label: t('editor.stagedGroup'), changes: staged },
        { id: 'unstaged', label: t('editor.unstagedGroup'), changes: unstaged },
        { id: 'unversioned', label: t('editor.unversionedGroup'), changes: unversioned },
      ].filter((group) => group.changes.length > 0 || group.id !== 'unversioned');
      /* IDEA's change-list search narrows what is SHOWN, never what is ticked:
         filtering the selection too would quietly change what gets committed. */
      const visibleGroups = groups
        .map((group) => ({ ...group, changes: filterChanges(group.changes, pathQuery) }))
        .filter((group) => group.changes.length > 0 || pathQuery === '');
      const allSelected = changes.length > 0 && changes.every((change) => selectedPaths.has(change.path));
      const metrics = commitMetrics(message);
      const branchText = branchLabel(git);
      /* A detached HEAD cannot be pushed or updated; say why in the toolbar too. */
      const detached = git?.detached === true;
      const ahead = git?.ahead ?? 0;
      const behind = git?.behind ?? 0;

      /**
       * Sum one band's line counts for the group header, IDEA's `+12 −3`.
       *
       * Binary rows contribute nothing (they have no numbers), and a band with
       * no readings at all stays blank rather than claiming zero changes.
       * @param {{id: string, changes: object[]}} group - band being rendered.
       * @returns {object|undefined} summed counts, or undefined when unknown.
       */
      const groupTotals = (group) => subtotalOf(group.changes, group.id);

      const renderGroup = (group) => {
        const tree = changeTreeOf(group.changes, groupingDepth(groupBy));
        /* A group folds as a whole, keyed by the bare group id: IDEA's root row
           ("Changes 5 files") is a tree node with its own chevron, and folding it
           leaves just that row. Directory keys stay `<group>:<path>`, so a group
           key can never collide with one of its own children. */
        const groupKey = `${group.id}:`;
        const groupOpen = !collapsedGroups.has(groupKey);
        const rows = groupOpen ? flattenChangeTree(tree, collapsedGroups, group.id) : [];
        const selectedInGroup = group.changes.filter((change) => selectedPaths.has(change.path)).map((change) => change.path);
        const groupState = selectionStateOf(group.changes.map((change) => change.path), selectedPaths);
        return React.createElement(
          React.Fragment,
          { key: group.id },
          React.createElement(
            'div',
            { style: styles.commitGroupHeader },
            /* IDEA's chevron sits BEFORE the checkbox on every tree node; the
               header is a node, not a caption. Clicking the chevron folds the
               group, clicking anywhere else on the row selects the group. */
            React.createElement(
              'span',
              {
                style: styles.commitChevron,
                role: 'button',
                tabIndex: -1,
                'aria-label': group.label,
                'aria-expanded': groupOpen,
                onClick: (event) => {
                  event.stopPropagation();
                  onToggleDirectory(groupKey);
                },
              },
              React.createElement(Icon, { name: groupOpen ? 'chevronDown' : 'chevronRight', size: 10 }),
            ),
            React.createElement('input', {
              type: 'checkbox',
              className: 'dsh-editor-checkbox',
              style: styles.checkbox,
              checked: groupState === 'all',
              ref: (element) => {
                if (element !== null) element.indeterminate = groupState === 'some';
              },
              disabled: group.changes.length === 0,
              onChange: () => onToggleGroup(group.id),
              'aria-label': group.label,
            }),
            React.createElement('span', { style: styles.commitGroupLabel }, group.label),
            /* IDEA words the count ("5 files"), not a bare `5`: a digit alone next
               to a bold title reads as part of the title. */
            React.createElement(
              'span',
              { style: styles.commitGroupFiles },
              t('editor.filesCount', { count: group.changes.length }),
            ),
            React.createElement(LineCounts, { counts: groupTotals(group) }),
            React.createElement('span', { style: styles.toolbarSpacer }),
            React.createElement(ToolbarButton, {
              icon: group.id === 'staged' ? 'collapse' : 'check',
              label: group.id === 'staged' ? t('editor.unstageAction') : t('editor.stageAction'),
              disabled: group.changes.length === 0,
              onClick: () => (group.id === 'staged' ? onUnstage(selectedInGroup) : onStage(selectedInGroup)),
            }),
            group.id === 'unversioned'
              ? React.createElement(ToolbarButton, {
                  icon: 'ignore',
                  label: t('editor.addToGitignore'),
                  disabled: selectedInGroup.length === 0,
                  onClick: () => onGitignore(selectedInGroup),
                })
              : null,
          ),
          rows.length === 0
            ? (groupOpen ? React.createElement('div', { style: styles.commitGroupEmpty }, t('editor.emptyGroup')) : null)
            : rows.map((row) => {
                if (row.kind === 'directory') {
                  const inside = (row.changes ?? []).map((change) => change.path);
                  const state = selectionStateOf(inside, selectedPaths);
                  return React.createElement(
                    'div',
                    {
                      key: `${group.id}:${row.path}`,
                      /* Every directory row sits at ONE indent: the list is flat,
                         so a folder's checkbox lines up with the files' boxes and
                         the nesting is told by the grey parent path instead. */
                      style: { ...styles.commitDirRow, paddingLeft: 22 },
                      /* ⌥-click flips the whole subtree, IDEA's tree gesture; a plain
                         click keeps toggling just this level. */
                      onClick: (event) => {
                        if (event.altKey === true) onToggleDirectory(collapseKeysOf(tree, group.id, row.path));
                        else onToggleDirectory(row.collapseKey);
                      },
                      /* IDEA acts on a directory's whole subtree from its context menu. */
                      onContextMenu: (event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        /* `row.changes` holds the change OBJECTS; `inside` is only their
                           paths, and the menu needs the objects to collect paths itself. */
                        onContextMenu?.({ directory: row.path, changes: row.changes ?? [], group: group.id, x: event.clientX, y: event.clientY });
                      },
                    },
                    /* Chevron FIRST, then checkbox: IDEA indents its tree with the
                       disclosure arrow in the leading gutter, so a directory's box
                       lines up with the boxes of the files below it only when the
                       arrow owns the left edge. */
                    React.createElement(
                      'span',
                      { style: styles.commitChevron },
                      React.createElement(Icon, { name: row.open ? 'chevronDown' : 'chevronRight', size: 10 }),
                    ),
                    React.createElement('input', {
                      type: 'checkbox',
                      className: 'dsh-editor-checkbox',
                  style: styles.checkbox,
                      checked: state === 'all',
                      /* Only a partially ticked directory gets the dash; `indeterminate`
                         is a DOM property, so it has to be set through a ref. */
                      ref: (element) => {
                        if (element !== null) element.indeterminate = state === 'some';
                      },
                      'aria-label': row.name,
                      onClick: (event) => event.stopPropagation(),
                      onChange: () => {
                        /* A full (or partial) directory clears; an empty one fills — IDEA's
                           checkbox toggles the whole subtree, never a single file. */
                        if (group.id === 'staged') onUnstage(inside);
                        else onStage(inside);
                      },
                    }),
                    React.createElement(Icon, { name: row.open ? 'folderOpen' : 'folder', size: 14 }),
                    React.createElement('span', { style: styles.commitDirName }, row.name),
                    React.createElement(
                      'span',
                      { style: styles.commitGroupFiles },
                      t('editor.filesCount', { count: inside.length }),
                    ),
                    /* IDEA puts the parent path after the name ("spark  doc"),
                       which is how two same-named folders are told apart. */
                    row.parent === ''
                      ? null
                      : React.createElement('span', { style: styles.commitFileDir }, row.parent),
                    React.createElement('span', { style: styles.toolbarSpacer }),
                    /* IDEA's directory node carries the same +N −M subtotal as the group header. */
                    React.createElement(LineCounts, { counts: subtotalOf(row.changes, group.id) }),
                  );
                }
                const change = row.change;
                const checked = selectedPaths.has(change.path);
                const info = gitStatusInfo(change.status);
                const conflict = isConflict(change);
                const selectedForDiff = diffTarget !== null && diffTarget.path === change.path && diffTarget.staged === (group.id === 'staged');
                return React.createElement(
                  'div',
                  {
                    key: `${group.id}:${change.path}`,
                    className: [
                      'dsh-editor-commit-row',
                      conflict ? 'dsh-editor-commit-row-conflict' : '',
                      selectedForDiff ? 'dsh-editor-commit-row-active' : '',
                    ].filter(Boolean).join(' '),
                    style: {
                      ...styles.commitFileRow,
                      /* Files are FLAT: one gutter in from the group row, never one
                         per path segment. The nesting lived in the muted path label
                         (IDEA's `program.py  doc/spark`), which keeps a deep file's
                         name at the same x as its siblings in other folders.
                         The extra chevron cell is reserved so a file's checkbox
                         lines up with the checkbox of the folder row above it:
                         a folder row is `chevron(12) + gap(5) + checkbox`, and a
                         file has no chevron of its own. */
                      paddingLeft: 22 + 12 + 5,
                      ...(conflict ? styles.commitFileRowConflict : null),
                      ...(selectedForDiff ? styles.commitFileRowActive : null),
                    },
                    /* The name is never ellipsized, so a pathologically long name in
                       a very narrow tool window is the one case where the row can be
                       wider than the pane; the tooltip still spells the full path
                       out. */
                    title: change.path,
                    onClick: () => onSelectDiff({ path: change.path, staged: group.id === 'staged' }),
                    onContextMenu: (event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      onContextMenu({ change, staged: group.id === 'staged', x: event.clientX, y: event.clientY });
                    },
                  },
                  React.createElement('input', {
                    type: 'checkbox',
                    className: 'dsh-editor-checkbox',
                  style: styles.checkbox,
                    checked,
                    onChange: () => onTogglePath(change.path),
                    onClick: (event) => event.stopPropagation(),
                  }),
                  React.createElement('span', { style: { ...styles.statusBadge, color: info?.color ?? 'inherit' } }, info?.label ?? '·'),
                  React.createElement(EntryIcon, { entry: { path: change.path, kind: 'file' }, expanded: false }),
                  React.createElement('span', { style: styles.commitFileName }, row.name),
                  conflict
                    ? React.createElement(
                        'span',
                        { style: styles.conflictChip, title: t('editor.conflictHint') },
                        t('editor.conflictBadge'),
                      )
                    : null,
                  /* The parent path sits right after the name, the way IDEA prints
                     `engineering-memory.md  doc/spark`: it identifies the row, so it
                     belongs next to the name rather than across a gap. `01` is the
                     *dir* form, not `dirname()`: a row that already shows `r147nest`
                     under `deep/inner` looked like it lived in the parent of its
                     own folder. `/` is what IDEA prints for a root-level file. */
                  React.createElement('span', { style: styles.commitFileDir }, parentDirLabel(change.path) || projectName),
                  React.createElement('span', { style: styles.toolbarSpacer }),
                  /* The band decides which side of the numstat reading this row shows. */
                  React.createElement(LineCounts, {
                    counts: group.id === 'staged' ? change.stagedLines : group.id === 'unstaged' ? change.unstagedLines : undefined,
                  }),
                );
              }),
        );
      };

      return React.createElement(
        React.Fragment,
        null,
        React.createElement(PanelToolbar, {
          t,
          icon: 'commit',
          title: t('editor.commit'),
          /* IDEA shows the current branch in the commit toolbar; ahead/behind ride along. */
          /* Detached HEAD cannot be pushed or updated; the badge says so rather than
             showing a branch name that would make the buttons look usable. */
          badge: branchText.length === 0
            ? null
            /* The chip already says "detached HEAD"; the badge adds only the hint. */
            : `${branchText}${detached ? ` · ${t('editor.detachedHeadHint')}` : ''}${ahead > 0 || behind > 0 ? ` ↑${ahead} ↓${behind}` : ''}`,
          /* The branch chip doubles as IDEA's branch popup trigger. */
          onBadge: onBranchMenu,
          right: [
            {
              id: 'fetch',
              icon: 'fetch',
              label: fetching ? t('editor.fetchBusy') : t('editor.fetchRemote'),
              disabled: fetching,
              onClick: () => onFetch?.(),
            },
            {
              id: 'update',
              icon: 'update',
              label: updating ? t('editor.updateBusy') : t('editor.updateProject'),
              disabled: updating,
              onClick: () => onUpdate?.(),
            },
            {
              id: 'stash',
              icon: 'stash',
              label: t('editor.stash'),
              onClick: (event) => {
                const rect = event?.currentTarget?.getBoundingClientRect?.();
                onStashMenu?.(rect === undefined ? { x: 240, y: 120 } : { x: rect.left, y: rect.bottom + 4 });
              },
            },
            {
              id: 'groupBy',
              icon: 'sort',
              label: t('editor.groupByMode', { mode: t(`editor.groupBy_${groupBy}`) }),
              onClick: (event) => {
                const rect = event?.currentTarget?.getBoundingClientRect?.();
                onGroupByMenu?.(rect === undefined ? { x: 240, y: 120 } : { x: rect.left, y: rect.bottom + 4 });
              },
            },
            { id: 'refresh', icon: 'refresh', label: t('editor.refresh'), onClick: onRefresh },
            { id: 'hide', icon: 'hide', label: t('editor.hide'), onClick: onHide },
          ],
        }),
        React.createElement(
          'div',
          { style: styles.commitTabs, role: 'tablist' },
          React.createElement(
            'button',
            {
              type: 'button',
              role: 'tab',
              'aria-selected': mode === 'changes',
              style: { ...styles.commitTab, ...(mode === 'changes' ? styles.commitTabActive : null) },
              onClick: () => onMode('changes'),
            },
            t('editor.tabChanges'),
            React.createElement('span', { style: styles.commitGroupCount }, String(changes.length)),
          ),
          React.createElement(
            'button',
            {
              type: 'button',
              role: 'tab',
              'aria-selected': mode === 'log',
              style: { ...styles.commitTab, ...(mode === 'log' ? styles.commitTabActive : null) },
              onClick: () => onMode('log'),
            },
            t('editor.tabLog'),
          ),
        ),
        /* Errors and notices belong to the tool window, not to one of its tabs: a failed
           cherry-pick from the Log tab used to produce no feedback at all. */
        error !== null || notice !== null || (pushFailure !== null && pushFailure !== undefined)
          ? React.createElement(
              'div',
              { style: styles.commitStatusStack },
              error !== null ? React.createElement('div', { style: styles.commitError }, error) : null,
              notice !== null
                ? React.createElement(
                    'div',
                    { style: styles.commitNotice },
                    notice,
                    undoMessage === ''
                      ? null
                      : React.createElement(
                          'button',
                          { type: 'button', style: { ...styles.conflictAction, marginLeft: 6 }, onClick: () => onUndoMessage?.() },
                          t('editor.undoClearedMessage'),
                        ),
                  )
                : null,
              pushFailure === null || pushFailure === undefined
                ? null
                : React.createElement(
                    'div',
                    { style: styles.commitError },
                    React.createElement('span', { style: { flex: '1 1 auto', minWidth: 0 } }, t('editor.pushedFailed', { message: pushFailure })),
                    React.createElement(
                      'button',
                      { type: 'button', style: styles.conflictAction, onClick: () => onPush?.(), disabled: busy || pushing },
                      pushing ? t('editor.pushing') : t('editor.retryPush'),
                    ),
                  ),
            )
          : null,
        mode === 'log'
          ? React.createElement(CommitLog, {
              t,
              scrollRefs,
              commits,
              loading: logLoading,
              detail: logDetail,
              onRefresh: onLoadLog,
              onShow: onSelectCommit,
              onOpenFile: onOpenFile,
              onShowCommitDiff: onShowCommitDiff,
              historyPath: historyPath ?? null,
              onClearHistory: onClearHistory,
              author: logAuthor,
              onAuthor: onLogAuthor,
              onLoadMore: onLoadMoreLog,
              exhausted: logExhausted === true,
              onContextMenu: onLogContextMenu,
              onDirectoryMenu,
              highlighted: highlightedCommit,
              graph,
              onLoadGraph,
              onGraphBranch,
              onGraphRef,
              selected,
              logFailure,
              onRetry,
              onFileMenu,
            })
          : React.createElement(
          'div',
          { style: styles.commitBody },
          React.createElement(
            'div',
            { style: styles.commitChangesPane },
            /* IDEA's change list has its own filter box; the Log tab's filter does
               not cover it, and a 300-file change set is unreadable without one.
               Escape clears it, like the tree's speed search. */
            React.createElement(
              'div',
              { style: styles.treeSearchRow },
              React.createElement(Icon, { name: 'search', size: 12 }),
              React.createElement('input', {
                style: { ...styles.findInput, flex: '1 1 auto', width: 'auto' },
                placeholder: t('editor.changeFilterPlaceholder'),
                value: pathQuery,
                'aria-label': t('editor.changeFilter'),
                onChange: (event) => onPathQuery?.(event.target.value),
                onKeyDown: (event) => {
                  if (event.key === 'Escape') {
                    event.preventDefault();
                    onPathQuery?.('');
                  }
                },
              }),
              pathQuery === ''
                ? null
                : React.createElement(
                    'button',
                    { type: 'button', style: styles.conflictAction, onClick: () => onPathQuery?.('') },
                    '×',
                  ),
            ),
            React.createElement(
              'div',
              {
                style: styles.commitScroll,
                ref: scrollRefs?.changes ?? null,
                /* Restore on mount: switching tabs remounts this list. */
              },
              changes.length === 0
                ? React.createElement('div', { style: styles.treeMessage }, t('editor.noChanges'))
                : visibleGroups.length === 0
                  ? React.createElement('div', { style: styles.treeMessage }, t('editor.noMatches'))
                  : visibleGroups.map(renderGroup),
            ),
            React.createElement(
              'div',
              { style: styles.commitMessageArea },
              React.createElement(
                'label',
                { style: styles.amendRow },
                React.createElement('input', {
                  type: 'checkbox',
                  className: 'dsh-editor-checkbox',
                  style: styles.checkbox,
                  checked: amend,
                  onChange: (event) => onAmend(event.target.checked),
                }),
                t('editor.amend'),
                git?.lastCommit?.subject
                  ? React.createElement('span', { style: styles.amendSubject, title: git.lastCommit.subject }, git.lastCommit.subject)
                  : null,
              ),
              React.createElement('textarea', {
                style: styles.commitTextarea,
                value: message,
                placeholder: t('editor.commitMessagePlaceholder'),
                spellCheck: false,
                onChange: (event) => onMessage(event.target.value),
                onKeyDown: (event) => {
                  /* ⌘/Ctrl+Enter commits without reaching for the mouse. */
                  if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
                    event.preventDefault();
                    if (!busy && selectedPaths.size > 0 && message.trim() !== '') onCommit(false);
                    return;
                  }
                  /* ↑/↓ walk the message history only when the caret sits on the first/last line. */
                  if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
                  if (history.length === 0) return;
                  const caret = event.currentTarget.selectionStart;
                  const value = event.currentTarget.value;
                  const atStart = value.lastIndexOf('\n', caret - 1) < 0;
                  const atEnd = value.indexOf('\n', caret) < 0;
                  if (event.key === 'ArrowUp' && !atStart) return;
                  if (event.key === 'ArrowDown' && !atEnd) return;
                  event.preventDefault();
                  onRecall(event.key === 'ArrowUp' ? 1 : -1);
                },
              }),
              /* IDEA's counters: subject length (soft 50) and body line count. */
              React.createElement(
                'div',
                { style: styles.commitCounterRow },
                React.createElement(
                  'span',
                  {
                    style: {
                      ...styles.commitCounter,
                      ...(metrics.subjectLength > COMMIT_SUBJECT_LIMIT ? styles.commitCounterWarn : null),
                    },
                    title: t('editor.commitSubjectHint'),
                  },
                  t('editor.commitSubjectCount', { count: metrics.subjectLength, limit: COMMIT_SUBJECT_LIMIT }),
                ),
                metrics.bodyLines > 0
                  ? React.createElement('span', { style: styles.commitCounter }, t('editor.commitBodyLines', { count: metrics.bodyLines }))
                  : null,
                metrics.subjectLength > 0 && metrics.subjectLength < 8
                  ? React.createElement('span', { style: styles.commitCounterWarn }, t('editor.commitSubjectShort'))
                  : null,
                /* 72 is where git log and every forge truncate: past that the tail is lost. */
                metrics.subjectLength > COMMIT_SUBJECT_HARD_LIMIT
                  ? React.createElement('span', { style: styles.commitCounterWarn }, t('editor.commitSubjectTruncated', { limit: COMMIT_SUBJECT_HARD_LIMIT }))
                  : null,
              ),
              templates.length === 0
                ? null
                : React.createElement(
                    'div',
                    { style: styles.commitTemplateRow },
                    templates.map((prefix) =>
                      React.createElement(
                        'button',
                        {
                          key: prefix,
                          type: 'button',
                          className: 'dsh-editor-template-chip',
                          style: styles.commitTemplateChip,
                          title: t('editor.commitTemplateHint', { prefix }),
                          onClick: () => onTemplate?.(prefix),
                        },
                        prefix,
                      ),
                    ),
                  ),
              identityMissing
                ? React.createElement('div', { style: styles.commitError }, t('editor.identityMissing'))
                : null,
              typeof git?.operation === 'string' && git.operation !== ''
                ? React.createElement('div', { style: styles.commitNotice }, t('editor.operationInProgress', { operation: git.operation }))
                : null,
              React.createElement(
                'div',
                { style: styles.commitButtonRow },
                React.createElement(
                  'button',
                  {
                    type: 'button',
                    style: styles.commitPrimary,
                    disabled: busy || selectedPaths.size === 0 || message.trim() === '',
                    onClick: () => onCommit(false),
                  },
                  busy ? t('editor.committing') : selectedPaths.size === 0 ? t('editor.commitAction') : `${t('editor.commitAction')} ${selectedPaths.size}`,
                ),
                React.createElement(
                  'button',
                  {
                    type: 'button',
                    className: 'dsh-editor-commit-secondary',
                    style: styles.commitSecondary,
                    disabled: busy || selectedPaths.size === 0 || message.trim() === '',
                    onClick: () => onCommit(true),
                    title: t('editor.commitAndPush'),
                    'aria-label': t('editor.commitAndPush'),
                  },
                  /* IDEA labels BOTH buttons ("Commit" / "Commit and Push…"): an
                     icon-only second button does not say what it will do, and the
                     two actions differ irreversibly (push is remote). */
                  t('editor.commitAndPush'),
                ),
              ),
              React.createElement('div', { style: styles.commitNotice }, allSelected ? t('editor.allSelected') : t('editor.partialSelected', { count: selectedPaths.size })),
            ),
          ),
        ),
      );
    }

    /**
     * IDEA's one-line name prompt (New Branch, New Tag).
     *
     * A `window.prompt` cannot show a live validation message and renders as a
     * browser chrome dialog; IDEA keeps it inside the tool window, with the error
     * under the field and Enter/Esc as the only exits.
     * @param {object} props - prompt state and callbacks.
     * @returns {object} React element tree.
     */
    function NamePrompt({ t, state, onSubmit, onChange, onClose }) {
      const error = typeof state.error === 'string' && state.error !== '' ? state.error : null;
      return React.createElement(
        'div',
        { style: styles.paletteBackdrop, onMouseDown: onClose },
        React.createElement(
          'div',
          {
            style: styles.namePrompt,
            role: 'dialog',
            'aria-label': state.title,
            onMouseDown: (event) => event.stopPropagation(),
          },
          React.createElement('div', { style: styles.namePromptTitle }, state.title),
          React.createElement('input', {
            style: styles.namePromptInput,
            autoFocus: true,
            value: state.value,
            placeholder: state.placeholder,
            'aria-label': state.title,
            onChange: (event) => onChange(event.target.value),
            onKeyDown: (event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                onSubmit();
              } else if (event.key === 'Escape') {
                event.preventDefault();
                onClose();
              }
            },
          }),
          error === null ? null : React.createElement('div', { style: styles.namePromptError, role: 'alert' }, error),
          React.createElement(
            'div',
            { style: styles.namePromptButtons },
            React.createElement('button', { type: 'button', style: styles.commitSecondary, onClick: onClose }, t('editor.cancel')),
            React.createElement(
              'button',
              { type: 'button', style: styles.commitPrimary, onClick: () => onSubmit(), disabled: state.value.trim() === '' },
              t('editor.ok'),
            ),
          ),
        ),
      );
    }

    /**
     * Score one commit against a typed query (IDEA's revision picker search).
     *
     * The three things a user knows about a commit are its hash, its subject and
     * its author, so all three are searched; a hash PREFIX ranks first because
     * it identifies exactly one commit. `-1` means "no match", the same
     * convention as {@link fuzzyScore}.
     * @param {object} commit - log entry.
     * @param {string} query - typed text, any case.
     * @returns {number} score, higher is better; -1 when nothing matched.
     */
    function commitSearchScore(commit, query) {
      const needle = typeof query === 'string' ? query.trim().toLowerCase() : '';
      if (needle === '') return 0;
      const hash = typeof commit?.hash === 'string' ? commit.hash.toLowerCase() : '';
      if (hash.startsWith(needle)) return 1000;
      const subject = typeof commit?.subject === 'string' ? commit.subject.toLowerCase() : '';
      const author = typeof commit?.author === 'string' ? commit.author.toLowerCase() : '';
      let score = 0;
      if (subject.includes(needle)) score += 100;
      if (author.includes(needle)) score += 50;
      return score === 0 ? -1 : score;
    }

    /**
     * IDEA's revision picker: a searchable list of commits for "Compare with Revision".
     *
     * The old implementation reused the context menu, which put a hard 20-row cap
     * on the choice and gave no way to reach an older commit. This is a real
     * dialog with a filter box and ↑/↓/Enter, matching Go to File's keyboard model.
     * @param {object} props - picker state and callbacks.
     * @returns {object} React element tree.
     */
    function RevisionPicker({ t, state, onQuery, onMove, onPick, onClose }) {
      const commits = state.commits ?? [];
      const query = state.query ?? '';
      const needle = query.trim().toLowerCase();
      const visible = needle === '' ? commits : commits.filter((commit) => commitSearchScore(commit, needle) >= 0);
      const index = Math.max(0, Math.min(state.index ?? 0, Math.max(0, visible.length - 1)));
      const listRef = React.useRef(null);
      React.useEffect(() => {
        const node = listRef.current;
        const active = node?.querySelector?.('[data-dsh-active="true"]');
        active?.scrollIntoView?.({ block: 'nearest' });
        /* A new query replaces the row set, which starts at the top. */
      }, [index, needle, visible.length]);
      return React.createElement(
        'div',
        { style: styles.paletteBackdrop, onMouseDown: onClose },
        React.createElement(
          'div',
          {
            style: styles.palette,
            role: 'dialog',
            'aria-label': t('editor.compareWithRevision'),
            onMouseDown: (event) => event.stopPropagation(),
          },
          React.createElement('input', {
            style: styles.paletteInput,
            autoFocus: true,
            placeholder: t('editor.compareRevisionPlaceholder'),
            value: query,
            onChange: (event) => onQuery(event.target.value),
            onKeyDown: (event) => {
              if (event.key === 'ArrowDown') {
                event.preventDefault();
                onMove(1, visible.length);
              } else if (event.key === 'ArrowUp') {
                event.preventDefault();
                onMove(-1, visible.length);
              } else if (event.key === 'Enter') {
                event.preventDefault();
                if (visible[index] !== undefined) onPick(visible[index].hash);
              } else if (event.key === 'Escape') {
                event.preventDefault();
                onClose();
              }
            },
          }),
          React.createElement(
            'div',
            { ref: listRef, style: styles.paletteList },
            state.loading === true && commits.length === 0
              ? React.createElement('div', { style: styles.treeMessage }, t('editor.loading'))
              : null,
            state.loading !== true && visible.length === 0
              ? React.createElement('div', { style: styles.treeMessage }, t('editor.noMatches'))
              : null,
            visible.map((commit, position) =>
              React.createElement(
                'div',
                {
                  key: commit.hash,
                  'data-dsh-active': position === index ? 'true' : 'false',
                  className: 'dsh-editor-palette-row',
                  style: { ...styles.paletteRow, ...(position === index ? styles.paletteRowActive : null) },
                  onMouseDown: (event) => {
                    event.preventDefault();
                    onPick(commit.hash);
                  },
                },
                React.createElement('span', { style: styles.logHash }, commit.hash.slice(0, 7)),
                React.createElement('span', { style: styles.paletteName }, commit.subject),
                React.createElement('span', { style: styles.paletteDir }, commit.author),
              ),
            ),
          ),
        ),
      );
    }

    /**
     * IDEA's "Move to…" dialog: pick a destination directory for the selection.
     *
     * Dragging a file into a collapsed folder means expanding it first, and a
     * destination outside the visible tree means scrolling to it. IDEA offers F6
     * instead: a searchable list of every directory, with the current parent
     * marked so "move it where it already is" is obvious before pressing Enter.
     * @param {object} props - picker state and callbacks.
     * @returns {object} React element tree.
     */
    function MoveToPicker({ t, state, onQuery, onMove, onPick, onClose }) {
      const directories = state.directories ?? [];
      const query = state.query ?? '';
      const needle = query.trim().toLowerCase();
      const visible = needle === '' ? directories : directories.filter((entry) => entry.toLowerCase().includes(needle));
      const index = Math.max(0, Math.min(state.index ?? 0, Math.max(0, visible.length - 1)));
      const listRef = React.useRef(null);
      React.useEffect(() => {
        const node = listRef.current;
        node?.querySelector?.('[data-dsh-active="true"]')?.scrollIntoView?.({ block: 'nearest' });
      }, [index, needle, visible.length]);
      return React.createElement(
        'div',
        { style: styles.paletteBackdrop, onMouseDown: onClose },
        React.createElement(
          'div',
          { style: styles.palette, role: 'dialog', 'aria-label': t('editor.moveTo'), onMouseDown: (event) => event.stopPropagation() },
          React.createElement('input', {
            style: styles.paletteInput,
            autoFocus: true,
            placeholder: t('editor.moveToPlaceholder'),
            value: query,
            onChange: (event) => onQuery(event.target.value),
            onKeyDown: (event) => {
              if (event.key === 'ArrowDown') {
                event.preventDefault();
                onMove(1, visible.length);
              } else if (event.key === 'ArrowUp') {
                event.preventDefault();
                onMove(-1, visible.length);
              } else if (event.key === 'Enter') {
                event.preventDefault();
                if (visible[index] !== undefined) onPick(visible[index]);
              } else if (event.key === 'Escape') {
                event.preventDefault();
                onClose();
              }
            },
          }),
          React.createElement(
            'div',
            { ref: listRef, style: styles.paletteList },
            state.loading === true && directories.length === 0
              ? React.createElement('div', { style: styles.treeMessage }, t('editor.loading'))
              : null,
            state.loading !== true && visible.length === 0
              ? React.createElement('div', { style: styles.treeMessage }, t('editor.noMatches'))
              : null,
            visible.map((directory, position) =>
              React.createElement(
                'div',
                {
                  key: directory === '' ? '__root__' : directory,
                  'data-dsh-active': position === index ? 'true' : 'false',
                  className: 'dsh-editor-palette-row',
                  style: { ...styles.paletteRow, ...(position === index ? styles.paletteRowActive : null) },
                  onMouseDown: (event) => {
                    event.preventDefault();
                    onPick(directory);
                  },
                },
                React.createElement(Icon, { name: 'folder', size: 14 }),
                React.createElement('span', { style: styles.paletteName }, directory === '' ? state.rootName ?? '/' : directory),
                /* The current parent is marked, so Enter on it reads as "already there". */
                directory === (state.parent ?? '')
                  ? React.createElement('span', { style: styles.paletteDir }, t('editor.moveToCurrent'))
                  : null,
              ),
            ),
          ),
        ),
      );
    }

    /**
     * IDEA's "Go to File": a fuzzy list of workspace files, opened with ⌘⇧O.
     *
     * The palette lists what the tree has already loaded first and asks the host
     * for a recursive walk (bounded) so deeply nested files are reachable too.
     */
    function QuickOpen({ t, files, changes, query, loading, index, mode = 'files', onQuery, onMove, onOpen, onClose }) {
      const listRef = React.useRef(null);
      React.useEffect(() => {
        listRef.current?.scrollIntoView({ block: 'nearest' });
      }, [index]);
      const recent = mode === 'recent';
      const matches = (recent
        /* Recent Files keeps the order it is given: the list IS "most recent
           first", so sorting by score would destroy the only thing it says.
           A query still filters, but never reorders. */
        ? files.map((path) => ({ path, score: query === '' ? 0 : fuzzyScore(path, query) })).filter((entry) => entry.score >= 0)
        : files
          .map((path) => ({ path, score: fuzzyScore(path, query) }))
          .filter((entry) => entry.score >= 0)
          .sort((left, right) => right.score - left.score || left.path.length - right.path.length)
      ).slice(0, 60);
      return React.createElement(
        'div',
        { style: styles.paletteBackdrop, onMouseDown: onClose },
        React.createElement(
          'div',
          {
            style: styles.palette,
            role: 'dialog',
            'aria-label': recent ? t('editor.recentFiles') : t('editor.gotoFile'),
            onMouseDown: (event) => event.stopPropagation(),
          },
          React.createElement('input', {
            style: styles.paletteInput,
            autoFocus: true,
            placeholder: recent ? t('editor.recentFilesPlaceholder') : t('editor.gotoFilePlaceholder'),
            value: query,
            onChange: (event) => onQuery(event.target.value),
            onKeyDown: (event) => {
              if (event.key === 'ArrowDown') {
                event.preventDefault();
                onMove(1, matches.length);
              } else if (event.key === 'ArrowUp') {
                event.preventDefault();
                onMove(-1, matches.length);
              } else if (event.key === 'Enter') {
                event.preventDefault();
                if (matches[index] !== undefined) onOpen(matches[index].path);
              } else if (event.key === 'Escape') {
                event.preventDefault();
                onClose();
              }
            },
          }),
          React.createElement(
            'div',
            { style: styles.paletteList },
            loading && files.length === 0 ? React.createElement('div', { style: styles.treeMessage }, t('editor.loading')) : null,
            /* Recent Files with nothing in it is not "no matches": the list is
               simply empty because nothing has been opened in this workspace. */
            matches.length === 0 && !loading
              ? React.createElement('div', { style: styles.treeMessage }, recent && query === '' ? t('editor.recentEmpty') : t('editor.noMatches'))
              : null,
            matches.map((entry, position) => {
              /* Declared per row so the badge reads from the live status map. */
              const badge = badgeFor(entry.path, changes);
              return React.createElement(
                'div',
                {
                  key: entry.path,
                  ref: position === index ? listRef : null,
                  className: 'dsh-editor-palette-row',
                  style: { ...styles.paletteRow, ...(position === index ? styles.paletteRowActive : null) },
                  onMouseDown: (event) => {
                    event.preventDefault();
                    onOpen(entry.path);
                  },
                },
                React.createElement(EntryIcon, { entry: { path: entry.path, kind: 'file' }, expanded: false }),
                /* IDEA marks changed files in its search popups too: without this the
                   modified file you were looking for looks like the clean one. */
                React.createElement(GitStatusBadge, { selected: false, info: badge }),
                React.createElement('span', { style: styles.paletteName }, basename(entry.path)),
                React.createElement('span', { style: styles.paletteDir }, dirname(entry.path)),
              );
            }),
          ),
        ),
      );
    }

    /**
     * Subsequence match score, higher is better; -1 means no match.
     * @param {string} path - candidate path.
     * @param {string} query - typed query.
     * @returns {number} score.
     */
    function fuzzyScore(path, query) {
      if (query === '') return 0;
      const haystack = path.toLowerCase();
      const needle = query.toLowerCase();
      const direct = haystack.lastIndexOf(needle);
      if (direct >= 0) return 1000 + direct - haystack.length;
      let position = -1;
      let score = 0;
      for (const character of needle) {
        const found = haystack.indexOf(character, position + 1);
        if (found < 0) return -1;
        score += found === position + 1 ? 2 : 1;
        position = found;
      }
      return score;
    }

    /**
     * Assign one lane per commit by walking parents, so lines actually connect.
     *
     * A commit inherits the lane of the child that first references it; when a
     * commit has several children the lane stays with the newest child and extra
     * parents open fresh lanes. This is the layout step (pure, testable); drawing
     * is separate so the geometry can be asserted without a DOM.
     * @param {Array<{hash: string, parents: string[]}>} entries - commits, newest first.
     * @returns {{laneOf: Map<string, number>, laneCount: number}} lane assignment.
     */
    /**
     * Group consecutive commits that share one lane and no branch point.
     *
     * IDEA's graph can squeeze "nothing else is alive here" stretches into a
     * single row. The unit is a RUN, not a lane: a run ends at a merge or where
     * another lane starts, so folding never hides a fork or a branch tip.
     * @param {object[]} entries - commits in walk order.
     * @param {Map<string, number>} laneOf - lane per commit from assignGraphLanes.
     * @returns {Array<{hashes: string[], lane: number, merge: boolean, first: object}>} runs.
     */
    function linearRun(entries, laneOf) {
      const runs = [];
      for (const entry of entries) {
        const lane = laneOf.get(entry.hash) ?? 0;
        const merge = (entry.parents?.length ?? 0) > 1;
        const previous = runs[runs.length - 1];
        /* A run continues only while the lane is unchanged and neither row merges. */
        if (previous !== undefined && previous.lane === lane && previous.merge === false && merge === false) {
          previous.hashes.push(entry.hash);
          continue;
        }
        runs.push({ hashes: [entry.hash], lane, merge, first: entry });
      }
      return runs;
    }

    function assignGraphLanes(entries) {
      const laneOf = new Map();
      let laneCount = 0;
      /* Pass 1: every commit inherits its lane from its first child, so a branch's
         own history stays on one line. Tips get a lane as they are encountered. */
      for (const entry of entries) {
        if (!laneOf.has(entry.hash)) laneOf.set(entry.hash, laneCount++);
        const lane = laneOf.get(entry.hash);
        const first = entry.parents[0];
        if (first !== undefined && !laneOf.has(first)) laneOf.set(first, lane);
      }
      /* Pass 2: merge parents that pass 1 never reached open a forked lane. */
      for (const entry of entries) {
        for (const parent of entry.parents.slice(1)) {
          if (!laneOf.has(parent)) laneOf.set(parent, laneCount++);
        }
      }
      return { laneOf, laneCount };
    }

    /**
     * IDEA's commit graph: lanes that connect parent to child, plus ref badges.
     *
     * Each row draws its own lane marker and connector stubs for every parent it
     * has, so a fork reads as a fork instead of mere indentation.
     * @param {{t: Function, graph: object|null, onShow: Function, selected: string|null, onSelect: Function}} props - graph data.
     * @returns {object} the graph rows.
     */
    function CommitGraph({ t, graph, onShow, selected, onSelect, onPickRef }) {
      const entries = graph?.entries ?? [];
      /* IDEA can squeeze long single-lane stretches; off by default. */
      const [folded, setFolded] = React.useState(false);
      if (graph === null) return React.createElement('div', { style: styles.treeMessage }, t('editor.loading'));
      if (entries.length === 0) {
        /* An empty page means three different things: no commits at all, a branch
           filter that matched nothing, and a tag pointing outside the walk. */
        return React.createElement(
          'div',
          { style: styles.treeMessage },
          typeof graph?.branch === 'string' && graph.branch !== ''
            ? t('editor.graphNoCommitsOnBranch')
            : typeof graph?.at === 'string' && graph.at !== ''
              ? t('editor.graphNoCommitsOnRef')
              : t('editor.noCommits'),
        );
      }
      const lanes = assignGraphLanes(entries);
      const laneOf = lanes.laneOf;
      const head = typeof graph?.head === 'string' ? graph.head : null;
      /* Folding is opt-in: IDEA keeps the full graph by default too, and a folded
         row that hid a branch point would be worse than a long list. */
      const runs = linearRun(entries, laneOf);
      const rowsToDraw = folded ? runs : entries.map((entry) => ({ hashes: [entry.hash], lane: laneOf.get(entry.hash) ?? 0, merge: entry.parents.length > 1, first: entry }));
      return React.createElement(
        'div',
        {
          style: styles.commitGraph,
          role: 'listbox',
          'aria-label': t('editor.logGraph'),
          /* Leaving the list clears the hover, otherwise the last row the pointer
             crossed stays tinted while the keyboard cursor is somewhere else. */
          onMouseLeave: () => onSelect?.(null),
        },
        React.createElement(
          'div',
          { style: styles.graphFoldRow },
          React.createElement(
            'button',
            {
              type: 'button',
              style: { ...styles.graphFoldToggle, ...(folded ? styles.graphFoldToggleOn : null) },
              'aria-pressed': folded,
              title: t('editor.graphFoldChains'),
              onClick: () => setFolded((current) => !current),
            },
            t('editor.graphFoldChains'),
          ),
          folded
            ? React.createElement('span', { style: styles.graphFoldCount }, t('editor.graphFoldedCount', { count: rowsToDraw.length }))
            : null,
        ),
        rowsToDraw.map((run) => {
          const entry = run.first;
          const collapsed = run.hashes.length > 1;
          const lane = laneOf.get(entry.hash) ?? 0;
          const isMerge = entry.parents.length > 1;
          const active = selected === entry.hash;
          /* IDEA marks the checked-out commit with a HEAD badge: without it a row
             with a branch badge looks identical to the row you are standing on. */
          const isHead = head !== null && head === entry.hash;
          return React.createElement(
            'div',
            {
              key: entry.hash,
              ref: active ? scrollGraphRowIntoView : null,
              className: 'dsh-editor-commit-row dsh-editor-graph-row',
              role: 'option',
              'aria-selected': active,
              style: { ...styles.commitGraphRow, ...(active ? styles.commitGraphRowActive : null) },
              title: entry.hash,
              onClick: () => onShow?.(entry.hash),
              onMouseEnter: () => onSelect?.(entry.hash),
            },
            React.createElement(
              'span',
              { style: { ...styles.commitGraphLane, width: Math.max(12, (lane + 1) * 10) } },
              /* Only the columns up to this commit's lane: the rest would be empty gutters
                 that push the subject off a narrow tool window. */
              Array.from({ length: lane + 1 }, (_, index) =>
                React.createElement('span', {
                  key: index,
                  style: index === lane ? styles.commitGraphTrackActive : styles.commitGraphTrack,
                }),
              ),
              React.createElement('span', { style: styles.commitGraphNode },
                React.createElement(Icon, { name: isMerge ? 'graphMerge' : 'graphNode', size: 11 }),
              ),
            ),
            React.createElement('span', { style: styles.logHash }, entry.hash.slice(0, 7)),
            React.createElement(
              'span',
              { style: { minWidth: 0, flex: '1 1 auto', display: 'flex', flexDirection: 'column', gap: 1 } },
              React.createElement('span', { style: styles.logSubject }, entry.subject),
              /* A folded row must say how many commits it stands for; otherwise the
                 list looks like it lost history. */
              collapsed
                ? React.createElement('span', { style: styles.graphFoldBadge }, t('editor.graphFoldedRun', { count: run.hashes.length - 1 }))
                : null,
              React.createElement(
                'span',
                { style: { display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' } },
                isHead ? React.createElement('span', { style: styles.commitGraphHead, key: 'HEAD' }, 'HEAD') : null,
                /* IDEA's graph filters by clicking a ref badge; the badge names the
                   scope it applies, so clicking `main` shows main's history. */
                entry.refs.map((ref) => React.createElement(
                  'button',
                  {
                    key: ref,
                    type: 'button',
                    style: styles.commitGraphRef,
                    className: 'dsh-editor-graph-ref',
                    title: t('editor.graphFilterByRef', { ref }),
                    onClick: (event) => {
                      /* The row underneath opens the commit; the badge must not. */
                      event.stopPropagation();
                      onPickRef?.(ref);
                    },
                  },
                  ref,
                )),
                React.createElement('span', { style: styles.logMeta }, `${entry.author} · ${formatCommitDate(entry.date)}`),
              ),
            ),
          );
        }),
      );
    }

    /**
     * Turn a clicked ref badge into a graph scope (IDEA's "filter by ref").
     *
     * A branch badge means "walk that branch". A tag badge means "walk the
     * commit that tag points at" — tags have no line of their own, so the graph
     * shows the history *introduced by* the tag, which is what IDEA's
     * "Introduce tag" action does.
     * @param {string} ref - badge text (`main`, `origin/main`, `tag: v1`).
     * @param {object|null} graph - the loaded graph payload.
     * @returns {{branch: string, at: string}} scope for the next request.
     */
    function refScopeOf(ref, graph) {
      const value = typeof ref === 'string' ? ref.trim() : '';
      if (value === '') return { branch: '', at: '' };
      if (value.startsWith('tag: ')) {
        const name = value.slice(5).trim();
        const tag = (graph?.tagList ?? []).find((entry) => entry.name === name);
        /* An unknown tag is not a scope: better to stay put than to walk "" and
           look like the filter did nothing. */
        return tag === undefined ? { branch: '', at: '' } : { branch: '', at: tag.hash };
      }
      const known = (graph?.branchList ?? []).includes(value);
      return known ? { branch: value, at: '' } : { branch: '', at: '' };
    }

    /**
     * Keep the keyboard-selected graph row inside the scrolling list.
     *
     * Scrolls the list, not the page, so the surrounding tool window stays put.
     * @param {HTMLElement|null} node - the active row.
     * @returns {void}
     */
    function scrollGraphRowIntoView(node) {
      node?.scrollIntoView?.({ block: 'nearest' });
    }

    function CommitLog({
      t,
      scrollRefs,
      commits,
      loading,
      detail,
      onRefresh,
      onShow,
      onOpenFile,
      onShowCommitDiff,
      historyPath,
      onClearHistory,
      author,
      onAuthor,
      onLoadMore,
      exhausted,
      onContextMenu,
      onDirectoryMenu,
      highlighted,
      graph,
      onLoadGraph,
      onGraphBranch,
      onGraphRef,
      selected,
      logFailure = null,
      onRetry,
      onFileMenu,
    }) {
      /* Graph mode is a view preference: the flat list stays the default. */
      const [graphMode, setGraphMode] = React.useState(false);
      /* The row under the pointer; the graph highlights it so its lane is traceable. */
      const [graphHover, setGraphHover] = React.useState(null);
      /* IDEA walks the graph with ↑/↓: hovering changes the highlight, and Enter
         opens the detail, so the whole log is reachable without the mouse. */
      const [graphCursor, setGraphCursor] = React.useState(null);
      const [filter, setFilter] = React.useState('');
      const [showFilter, setShowFilter] = React.useState(false);
      const listRef = React.useRef(null);
      /* One query filters by subject, author and short hash; matches IDEA's log search box. */
      const needle = filter.trim().toLowerCase();
      const visible = needle === ''
        ? commits
        : commits.filter((commit) =>
            [commit.subject, commit.author, commit.hash].some((value) => typeof value === 'string' && value.toLowerCase().includes(needle)),
          );
      const graphEntries = graph?.entries ?? [];
      const graphIndex = graphCursor === null ? -1 : graphEntries.findIndex((entry) => entry.hash === graphCursor);
      /**
       * Move the graph cursor by one row, clamped to the loaded page.
       *
       * First ↓ from "no cursor" lands on the first row, which is where the eye
       * already is when the graph opens.
       * @param {number} delta - -1 to go up, 1 to go down.
       * @returns {void}
       */
      const moveGraphCursor = (delta) => {
        if (graphEntries.length === 0) return;
        /* Start from wherever the user last was — the pointer counts too, so the
           first ↓ after hovering continues from that row instead of jumping home. */
        const hoverIndex = graphHover === null ? -1 : graphEntries.findIndex((entry) => entry.hash === graphHover);
        const base = graphIndex >= 0 ? graphIndex : hoverIndex;
        const next = base < 0 ? (delta > 0 ? 0 : graphEntries.length - 1) : base + delta;
        const clamped = Math.max(0, Math.min(next, graphEntries.length - 1));
        /* The pointer is not where the user is looking any more: drop the hover so
           the keyboard cursor is what the highlight follows. */
        setGraphHover(null);
        setGraphCursor(graphEntries[clamped].hash);
        /* IDEA's log selects as you walk it: the details pane follows the arrow
           keys, so the commit you are looking at is the one shown below. */
        onShow?.(graphEntries[clamped].hash);
      };
      /* IDEA's Log tab stacks the commit table over the details: the tool window is
         narrow, so two side-by-side panes would each be too thin to read. */
      return React.createElement(
        'div',
        { style: styles.commitLogBody },
        React.createElement(
          'div',
          { style: styles.commitLogList },
          React.createElement(
            'div',
            { style: styles.logToolbar },
            React.createElement('span', { style: styles.panelTitle }, t('editor.tabLog')),
            showFilter
              ? React.createElement('input', {
                  style: styles.findInput,
                  autoFocus: true,
                  placeholder: t('editor.logFilterPlaceholder'),
                  value: filter,
                  onChange: (event) => setFilter(event.target.value),
                  onKeyDown: (event) => {
                    if (event.key === 'Escape') {
                      event.preventDefault();
                      setFilter('');
                      setShowFilter(false);
                    }
                  },
                })
              : null,
            graphMode
              ? React.createElement(
                  'select',
                  {
                    style: styles.graphBranchSelect,
                    /* A tag-filtered graph has no branch selected; the empty value
                       would otherwise scroll the picker back to "All branches"
                       while the list shows one tag's history. */
                    value: graph?.branch ?? '',
                    'aria-label': t('editor.graphBranch'),
                    title: t('editor.graphBranch'),
                    onChange: (event) => onGraphBranch?.(event.target.value),
                  },
                  React.createElement('option', { value: '' }, t('editor.graphAllBranches')),
                  (graph?.branchList ?? []).map((name) => React.createElement('option', { key: name, value: name }, name)),
                )
              : null,
            graphMode && typeof graph?.at === 'string' && graph.at !== ''
              ? React.createElement(
                  'span',
                  { style: styles.graphScopeChip, title: graph.at },
                  t('editor.graphAtChip', { hash: graph.at.slice(0, 7) }),
                  React.createElement(
                    'button',
                    {
                      type: 'button',
                      style: styles.historyChipClear,
                      'aria-label': t('editor.graphClearScope'),
                      onClick: () => onGraphBranch?.(''),
                    },
                    '×',
                  ),
                )
              : null,
            React.createElement('span', { style: styles.toolbarSpacer }),
            React.createElement('input', {
              style: { ...styles.findInput, width: 96 },
              placeholder: t('editor.logAuthorPlaceholder'),
              value: author ?? '',
              'aria-label': t('editor.logAuthor'),
              onChange: (event) => onAuthor?.(event.target.value),
            }),
            React.createElement(ToolbarButton, {
              icon: 'search',
              label: t('editor.logFilter'),
              onClick: () => setShowFilter((current) => !current),
            }),
            React.createElement(ToolbarButton, { icon: 'graph', label: t('editor.logGraph'), onClick: () => {
              const next = !graphMode;
              setGraphMode(next);
              if (next) {
                onLoadGraph?.(graph?.branch ?? '', graph?.at ?? '');
                /* IDEA's log takes the keyboard when it opens: ↑/↓ must work
                   without first clicking a row. The list owns the key handler,
                   so it needs focus even before the first page arrives. */
                window.setTimeout(() => listRef.current?.focus?.(), 0);
              }
            } }),
            React.createElement(ToolbarButton, { icon: 'refresh', label: t('editor.refresh'), onClick: () => onRefresh() }),
          ),
          React.createElement(
            'div',
            {
              ref: listRef,
              /* Keyboard focus must not paint a bright ring around the whole log;
                 IDEA marks the selected row, not the list container. */
              style: graphMode ? { ...styles.commitScroll, outline: 'none' } : styles.commitScroll,
              ref: scrollRefs?.log ?? null,
              tabIndex: graphMode ? 0 : undefined,
              /* IDEA pages the log in as you reach the end of the list. */
              onScroll: (event) => {
                const node = event.currentTarget;
                if (node.scrollHeight - node.scrollTop - node.clientHeight > 48) return;
                onLoadMore?.();
              },
              onKeyDown: graphMode
                ? (event) => {
                    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                      event.preventDefault();
                      moveGraphCursor(event.key === 'ArrowDown' ? 1 : -1);
                    } else if (event.key === 'Enter') {
                      if (graphIndex < 0) return;
                      event.preventDefault();
                      onShow?.(graphEntries[graphIndex].hash);
                    } else if (event.key === 'Home' || event.key === 'End') {
                      if (graphEntries.length === 0) return;
                      event.preventDefault();
                      setGraphCursor(graphEntries[event.key === 'Home' ? 0 : graphEntries.length - 1].hash);
                      onShow?.(graphEntries[event.key === 'Home' ? 0 : graphEntries.length - 1].hash);
                    }
                  }
                : undefined,
            },
            loading ? React.createElement('div', { style: styles.treeMessage }, t('editor.loading')) : null,
            /* A failed request must not look like an empty history: IDEA keeps the
               error in the log's status line and offers a retry. */
            logFailure !== null && !loading
              ? React.createElement(
                  'div',
                  { style: styles.logErrorRow, role: 'alert' },
                  React.createElement('span', { style: styles.logErrorText }, t('editor.logFailed', { message: logFailure })),
                  React.createElement(
                    'button',
                    { type: 'button', style: styles.conflictAction, onClick: () => onRetry?.() },
                    t('editor.logRetry'),
                  ),
                )
              : null,
            graphMode
              ? React.createElement(CommitGraph, {
                  t,
                  graph,
                  onShow,
                  selected: graphHover ?? graphCursor ?? selected,
                  onSelect: setGraphHover,
                  onPickRef: onGraphRef,
                })
              : null,
            graphMode ? null : commits.length > 0 && visible.length === 0 ? React.createElement('div', { style: styles.treeMessage }, t('editor.noMatches')) : null,
            /* The empty log only claims "no commits" when the request succeeded;
               otherwise the banner above already says what went wrong. */
            graphMode ? null : commits.length === 0 && !loading && logFailure === null ? React.createElement('div', { style: styles.treeMessage }, t('editor.noCommits')) : null,
            graphMode ? null : visible.map((commit) =>
              React.createElement(
                'div',
                {
                  key: commit.hash,
                  className: 'dsh-editor-commit-row',
                  /* The tooltip is the only place the log can advertise its right-click
                     actions; a bare hash tells the user nothing about what is available. */
                  title: `${commit.hash}\n${t('editor.logRowHint')}`,
                  ref: selected === commit.hash ? scrollGraphRowIntoView : null,
                  'aria-selected': selected === commit.hash,
                  onClick: () => onShow(commit.hash),
                  /* The detail pane says which commit it belongs to; without this the
                     list and the pane can disagree and the user cannot tell which
                     row is showing below. */
                  style: {
                    ...styles.commitFileRow,
                    paddingLeft: 10,
                    alignItems: 'flex-start',
                    height: 'auto',
                    paddingTop: 5,
                    paddingBottom: 5,
                    ...(selected === commit.hash ? styles.commitGraphRowActive : null),
                  },
                  /* The row we just committed stays tinted until another commit happens. */
                  ...(highlighted === commit.hash ? { 'data-dsh-log-new': '' } : null),
                  onContextMenu: (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    onShow(commit.hash);
                    onContextMenu?.({ commit, x: event.clientX, y: event.clientY });
                  },
                },
                React.createElement('span', { style: styles.logHash }, commit.hash.slice(0, 7)),
                React.createElement(
                  'span',
                  { style: { minWidth: 0, flex: '1 1 auto', display: 'flex', flexDirection: 'column', gap: 2 } },
                  React.createElement('span', { style: styles.logSubject }, commit.subject),
                  React.createElement('span', { style: styles.logMeta }, `${commit.author} · ${formatCommitDate(commit.date)}`),
                ),
              ),
            ),
            exhausted === true && visible.length > 0
              ? React.createElement('div', { style: styles.treeMessage }, t('editor.logEnd'))
              : null,
          ),
        ),
        React.createElement(
          'div',
          { style: styles.commitLogDetail },
          React.createElement(
            'div',
            { style: styles.logToolbar },
            React.createElement('span', { style: styles.panelTitle }, t('editor.commitDetails')),
            historyPath === null
              ? null
              : React.createElement(
                  'span',
                  { style: styles.historyChip, title: historyPath },
                  `${t('editor.fileHistory')}: ${basename(historyPath)}`,
                  /* IDEA's Log tab spells the way out: a `×` alone reads as "close the
                     chip", not "go back to the whole history". */
                  React.createElement(
                    'button',
                    {
                      type: 'button',
                      style: styles.historyChipShowAll,
                      title: t('editor.historyShowAll'),
                      onClick: () => onClearHistory?.(),
                    },
                    t('editor.historyShowAll'),
                  ),
                  React.createElement(
                    'button',
                    {
                      type: 'button',
                      style: styles.historyChipClear,
                      'aria-label': t('editor.clearHistory'),
                      title: t('editor.clearHistory'),
                      onClick: () => onClearHistory?.(),
                    },
                    '×',
                  ),
                ),
          ),
          React.createElement(
            'div',
            { style: styles.commitScroll },
            detail === null
              ? React.createElement('div', { style: styles.treeMessage }, t('editor.selectCommit'))
              : React.createElement(
                  'div',
                  { style: styles.logDetail },
                  React.createElement('div', { style: styles.logSubject }, detail.subject),
                  React.createElement('div', { style: styles.logMeta }, `${detail.author} · ${formatCommitDate(detail.date)}`),
                  detail.body === '' ? null : React.createElement('pre', { style: styles.logBody }, detail.body),
                  React.createElement(
                    'div',
                    { style: styles.logFiles },
                    detail.files.map((file) =>
                      React.createElement(
                        'div',
                        {
                          key: `${file.status}:${file.path}`,
                          style: styles.logFileRow,
                          className: 'dsh-editor-commit-row',
                          title: `${file.path} — ${t('editor.openAtRevision')}`,
                          /* IDEA opens the commit's diff on click; double-click opens the working copy. */
                          onClick: () => onShowCommitDiff?.({ hash: detail.hash, path: file.path }),
                          onDoubleClick: () => onOpenFile?.(file.path),
                          /* Right-click offers "Select in Project View": the working copy
                             is what the tree can show, not the revision's version. */
                          onContextMenu: (event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            onFileMenu?.({ path: file.path, x: event.clientX, y: event.clientY });
                          },
                        },
                        React.createElement('span', { style: { ...styles.statusBadge, color: gitStatusInfo(file.status)?.color ?? 'inherit' } }, file.status),
                        React.createElement('span', { style: styles.logFilePath }, file.path),
                      ),
                    ),
                  ),
                ),
          ),
        ),
      );
    }

    /** Compact absolute time for the log rows. */
    function formatCommitDate(value) {
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return value;
      const pad = (number) => String(number).padStart(2, '0');
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
    }

    /**
     * Load xterm.js and its fit addon once per page.
     *
     * The ESM builds are imported dynamically because Monaco installs a global
     * AMD `define`, which would otherwise capture a UMD xterm bundle.
     * @returns {Promise<{Terminal: Function, FitAddon: Function}>} constructors.
     */
    function loadXterm() {
      if (xtermPromise !== null) return xtermPromise;
      xtermPromise = (async () => {
        injectStylesheet('/api/dsh-editor/xterm/xterm.css', 'dsh-editor-xterm-css');
        const [xterm, fitAddon] = await Promise.all([
          import('/api/dsh-editor/xterm/xterm.mjs'),
          import('/api/dsh-editor/xterm/addon-fit.mjs'),
        ]);
        return { Terminal: xterm.Terminal, FitAddon: fitAddon.FitAddon };
      })();
      return xtermPromise;
    }

    /** Reuse a shared `<link>` for terminal styling. */
    function injectStylesheet(href, id) {
      if (document.getElementById(id) !== null) return;
      const link = document.createElement('link');
      link.id = id;
      link.rel = 'stylesheet';
      link.href = href;
      document.head.appendChild(link);
    }

    /** Contract of one running terminal view returned by the host terminal API. */
    const TERMINAL_POLL_MS = 16;

    /**
     * Read one SSE response body in chunks and hand each frame to a parser.
     * @param {Response} response - streaming response.
     * @param {(event: object) => void} onEvent - decoded event consumer.
     * @param {AbortSignal} signal - request lifetime.
     * @returns {Promise<void>} resolves when the stream ends.
     */
    async function readEventStream(response, onEvent, signal) {
      if (response.body === null) return;
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      const abort = () => {
        reader.cancel().catch(() => {});
      };
      signal.addEventListener('abort', abort, { once: true });
      try {
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let boundary = buffer.indexOf('\n\n');
          while (boundary >= 0) {
            const frame = buffer.slice(0, boundary);
            buffer = buffer.slice(boundary + 2);
            const payload = frame.startsWith('data: ') ? frame.slice(6) : frame;
            if (payload !== '') {
              try {
                onEvent(JSON.parse(payload));
              } catch {
                /* one malformed frame must not kill the terminal */
              }
            }
            boundary = buffer.indexOf('\n\n');
          }
        }
      } finally {
        signal.removeEventListener('abort', abort);
      }
    }

    /**
     * Terminal link grammar, loaded once from the module the test suite also imports.
     *
     * It ships as ESM and is imported dynamically for the same reason as xterm:
     * Monaco claims the global AMD `define`, so a static script tag would be captured.
     */
    let linkParserPromise = null;
    function loadLinkParser() {
      if (linkParserPromise === null) {
        linkParserPromise = import('/api/dsh-editor/shared/link-parser.mjs').catch(() => null);
      }
      return linkParserPromise;
    }

    /**
     * Build xterm's link provider for one emulator.
     *
     * The provider only shapes candidates locally; whether a path really exists is
     * asked from the host, so a missing file never becomes a dead underlined link.
     * @param {object} emulator - xterm Terminal instance.
     * @param {() => string} getCwd - current shell working directory.
     * @returns {{provideLinks: Function, dispose: Function}} provider handle.
     */
    function createTerminalLinkProvider(emulator, getCwd) {
      /* Existence cache: terminal lines are re-scanned while scrolling. */
      const cache = new Map();
      const pending = new Set();
      let disposed = false;

      /**
       * Ask the host which candidate paths exist, in one round trip.
       * @param {string[]} candidates - workspace-relative or absolute paths.
       * @returns {Promise<Map<string, object>>} verdicts keyed by candidate.
       */
      const resolveExistence = async (candidates) => {
        const unknown = candidates.filter((candidate) => !cache.has(candidate) && !pending.has(candidate));
        if (unknown.length > 0) {
          for (const candidate of unknown) pending.add(candidate);
          try {
            const value = await callFs({ op: 'exists', paths: unknown });
            for (const entry of value ?? []) cache.set(entry.requested, entry);
          } catch {
            /* an unreachable host simply leaves the link unconfirmed */
          } finally {
            for (const candidate of unknown) pending.delete(candidate);
          }
        }
        const verdicts = new Map();
        for (const candidate of candidates) {
          const entry = cache.get(candidate);
          if (entry !== undefined) verdicts.set(candidate, entry);
        }
        return verdicts;
      };

      return {
        provideLinks(bufferLineNumber, callback) {
          if (disposed) {
            callback(undefined);
            return;
          }
          const line = emulator.buffer.active.getLine(bufferLineNumber - 1);
          if (line === undefined) {
            callback(undefined);
            return;
          }
          void loadLinkParser().then((parser) => {
            if (disposed || parser === null) {
              callback(undefined);
              return;
            }
            const links = parser.parseTerminalLinks(line.translateToString(true));
            if (links.length === 0) {
              callback(undefined);
              return;
            }
            const pathLinks = links.filter((link) => link.kind === 'path');
            const candidates = pathLinks.map((link) => parser.resolveTerminalPath(getCwd(), link.path));
            void resolveExistence(candidates).then((verdicts) => {
              if (disposed) return;
              const decorated = [];
              for (const link of links) {
                /* xterm ranges are 1-based on both axes. */
                const range = { start: { x: link.start + 1, y: bufferLineNumber }, end: { x: link.end + 1, y: bufferLineNumber } };
                if (link.kind === 'url') {
                  decorated.push({
                    range,
                    text: link.text,
                    decorations: { pointerCursor: true, underline: true },
                    activate: () => window.open(link.text, '_blank', 'noopener,noreferrer'),
                  });
                  continue;
                }
                const candidate = parser.resolveTerminalPath(getCwd(), link.path);
                const verdict = verdicts.get(candidate);
                if (verdict === undefined || verdict.exists !== true || verdict.kind !== 'file') continue;
                decorated.push({
                  range,
                  text: link.text,
                  decorations: { pointerCursor: true, underline: true },
                  activate: () => openTerminalTarget({ path: verdict.path, line: link.line, column: link.column }),
                });
              }
              callback(decorated.length === 0 ? undefined : decorated);
            });
          });
        },
        dispose() {
          disposed = true;
          cache.clear();
          pending.clear();
        },
      };
    }

    /**
     * Open one terminal link target in the editor, optionally revealing a line.
     * Reaches the workspace React tree through a custom DOM event: the terminal
     * dock is a sibling of the editor surface, not a descendant.
     * @param {{path: string, line: number|null, column: number|null}} target - resolved target.
     */
    function openTerminalTarget(target) {
      if (typeof target.path !== 'string' || target.path === '') return;
      const host = document.querySelector('[data-dsh-editor-workspace]');
      host?.dispatchEvent(new CustomEvent('dsh-editor-open-file', { detail: target }));
    }

    /**
     * Every occurrence of one query inside the terminal's retained buffer.
     *
     * xterm exposes the scrollback as 0-based lines from the top of `buffer.active`;
     * trimming trailing blanks keeps the column offsets aligned with the printed text.
     * @param {object} emulator - xterm instance.
     * @param {string} needle - query.
     * @param {number} limit - safety ceiling for huge scrollbacks.
     * @returns {Array<{row: number, column: number}>} hits in buffer order.
     */
    function terminalMatches(emulator, needle, limit = 2000) {
      if (needle === '') return [];
      const buffer = emulator.buffer.active;
      const hits = [];
      for (let row = 0; row < buffer.length && hits.length < limit; row += 1) {
        const line = buffer.getLine(row);
        if (line === undefined) continue;
        const text = line.translateToString(true);
        let column = text.indexOf(needle);
        while (column >= 0) {
          hits.push({ row, column });
          column = text.indexOf(needle, column + Math.max(1, needle.length));
        }
      }
      return hits;
    }

    /**
     * Match count for the terminal find bar.
     * @param {object} emulator - xterm instance.
     * @param {string} needle - query.
     * @returns {number} occurrences.
     */
    function countTerminalMatches(emulator, needle) {
      return terminalMatches(emulator, needle).length;
    }

    /**
     * Select the next/previous occurrence of the find query inside the terminal buffer.
     *
     * xterm has no search API of its own, so the buffer is scanned line by line and
     * the hit is turned into a buffer selection; the count is kept in component state
     * so the bar can show `n/total` the way the editor find bar does.
     * @param {object|null} emulator - xterm instance.
     * @param {{query: string, index: number, total: number}} find - current find state.
     * @param {Function} setFind - state setter.
     * @param {number} direction - +1 next, -1 previous.
     * @returns {void}
     */
    function moveTerminalSelection(emulator, find, setFind, direction) {
      if (emulator === null || find.query === '') return;
      const needle = find.query;
      const hits = terminalMatches(emulator, needle);
      if (hits.length === 0) {
        setFind({ ...find, total: 0, index: 0 });
        return;
      }
      const index = ((find.index + direction) % hits.length + hits.length) % hits.length;
      const hit = hits[index];
      emulator.select(hit.column, hit.row, needle.length);
      emulator.scrollToLine(hit.row - Math.floor(emulator.rows / 2));
      setFind({ ...find, index, total: hits.length });
    }

    /**
     * IDEA-style terminal actions shared by the screen context menu and the tab menu.
     * @param {object} input - menu context.
     * @param {object} input.t - translator.
     * @param {object|null} input.emulator - xterm instance.
     * @param {object|null} input.active - active terminal description.
     * @param {Function} input.onSelectAll - select the whole buffer.
     * @param {Function} input.onClear - clear the screen.
     * @param {Function} input.onCreate - open a new terminal.
     * @returns {object|null} menu model.
     */
    function terminalMenuModel({ t, emulator, active, onSelectAll, onClear, onClearBuffer, onCreate, onClipboardError }) {
      if (emulator === null) return null;
      const selection = typeof emulator.getSelection === 'function' ? emulator.getSelection() : '';
      return {
        items: [
          {
            id: 'copy',
            label: t('editor.terminalCopy'),
            shortcut: '⌘C',
            disabled: selection === '',
            run: () => {
              if (selection !== '') void navigator.clipboard?.writeText(selection).catch(() => {});
            },
          },
          {
            id: 'paste',
            label: t('editor.terminalPaste'),
            shortcut: '⌘V',
            disabled: active === null || active.state === 'exited',
            run: () => void pasteIntoTerminal(emulator, active, t, onClipboardError),
          },
          { id: 'selectAll', label: t('editor.terminalSelectAll'), shortcut: '⌘A', run: onSelectAll },
          null,
          /* Two different clears, spelled out: ⌘K wipes the visible screen but keeps
             the scrollback, while this one throws the retained history away. The old
             labels ("清屏" vs "清除滚动缓冲") left the difference to the parenthetical. */
          { id: 'clear', label: t('editor.terminalClear'), shortcut: '⌘K', run: onClear },
          { id: 'clearBuffer', label: t('editor.terminalClearBuffer'), danger: true, run: onClearBuffer },
          { id: 'new', label: t('editor.terminalNew'), run: onCreate },
        ],
      };
    }

    /**
     * Context menu for one terminal tab, matching IDEA's tab actions.
     * @param {object} t - translator.
     * @param {object} terminal - terminal description.
     * @param {{rename: Function, close: Function, closeOthers: Function, duplicate: Function}} actions - callbacks.
     * @returns {object[]} menu items.
     */
    function terminalTabMenu(t, terminal, actions) {
      return [
        { id: 'rename', label: t('editor.terminalRename'), shortcut: '⇧F6', run: actions.rename },
        { id: 'color', label: t('editor.terminalColor'), run: actions.cycleColor },
        { id: 'duplicate', label: t('editor.terminalDuplicate'), run: actions.duplicate },
        { id: 'copyPath', label: t('editor.copyDirectoryPath'), run: () => void navigator.clipboard?.writeText(actions.cwd ?? terminal.cwd).catch(() => {}) },
        /* IDEA's terminal menu opens the directory's README, so a shell `cd`-ed into
           another package does not force a trip back to the tree. Disabled (not
           hidden) when the directory has none: the user can see it exists. */
        {
          id: 'openReadme',
          label: t('editor.openReadme'),
          /* Enabled until a resolve proves there is none: a first open must not
             require a pre-flight listing, and `''` is the "checked, missing" marker. */
          disabled: actions.readmePath === '',
          run: () => actions.openReadme?.(),
        },
        /* IDEA's tab menu opens the shell's directory in the system file manager;
           without it the only way to find it is to read the path off the title. */
        { id: 'revealCwd', label: t('editor.revealInFinder'), run: () => actions.revealCwd?.() },
        null,
        actions.splitRight === null
          ? null
          : { id: 'splitRight', label: t('editor.terminalSplitRight'), run: actions.splitRight },
        actions.reopen === null || actions.reopen === undefined
          ? null
          : { id: 'reopen', label: t('editor.terminalReopen'), run: actions.reopen },
        actions.moveToEditor === null || actions.moveToEditor === undefined
          ? null
          : { id: 'moveToEditor', label: t('editor.terminalMoveToEditor'), run: actions.moveToEditor },
        { id: 'close', label: t('editor.terminalClose'), run: actions.close },
        { id: 'closeOthers', label: t('editor.terminalCloseOthers'), run: actions.closeOthers },
      ].filter((item, index, list) => item !== null || (index > 0 && list[index - 1] !== null));
    }

    /**
     * Read the clipboard and hand the text to the active PTY.
     *
     * IDEA pastes multi-line text after a confirmation; a bracketed paste keeps
     * the shell from executing a pasted block line by line.
     * @param {object} emulator - xterm instance.
     * @param {object|null} active - active terminal.
     * @returns {Promise<void>} resolves once the text reached the PTY or was refused.
     */
    async function pasteIntoTerminal(emulator, active, t, onRefused) {
      if (active === null || active.state === 'exited') return;
      let text = '';
      try {
        text = (await navigator.clipboard?.readText()) ?? '';
      } catch {
        /* Refused or empty: tell the user instead of pretending the paste worked. */
        onRefused?.(t('editor.clipboardReadFailed'));
        return;
      }
      if (text === '') return;
      const lines = text.trimEnd().split('\n').length;
      /* IDEA's wording: say how much is about to be pasted before it runs. */
      if (lines > 1 && !window.confirm(t('editor.terminalPasteConfirm', { count: lines }))) return;
      await callTerminal({ op: 'write', id: active.id, data: text }).catch(() => {});
      emulator.focus();
    }

    /**
     * How many terminal tabs fit in the strip at IDEA's minimum tab width.
     *
     * The dock is narrow and the tab strip does not wrap, so past a handful of
     * shells every label is squeezed to an unreadable stub. Measuring the strip
     * against a fixed minimum lets the tab bar collapse the overflow into IDEA's
     * `»` dropdown instead of shrinking every tab.
     * @param {number} width - strip width in pixels, 0 when unmeasured.
     * @param {number} count - how many tabs exist.
     * @param {number} [reserve=30] - width kept for the `»` button itself.
     * @returns {number} how many leading tabs to render; `count` when all fit.
     */
    function visibleTabCount(width, count, reserve = 30) {
      if (!Number.isFinite(width) || width <= 0) return count;
      if (!Number.isFinite(count) || count <= 0) return 0;
      /* 92px is IDEA's practical minimum for a legible "zsh — project" label. */
      const perTab = 92;
      const fits = Math.max(0, Math.floor((width - reserve) / perTab));
      if (fits >= count) return count;
      return Math.max(1, fits);
    }

    /**
     * Split the dock's tabs into the visible strip and IDEA's `»` overflow list.
     *
     * The active tab always stays in the strip — a selected terminal whose tab
     * lives only in a dropdown looks like the click did nothing — so it displaces
     * the last plain tab of the visible run.
     * @param {object[]} terminals - tabs in their user-ordered sequence.
     * @param {number} visibleCount - how many fit (see {@link visibleTabCount}).
     * @param {string|null} activeId - the currently focused terminal's id.
     * @returns {{visible: object[], hidden: object[]}} strip and overflow tabs.
     */
    function overflowTabs(items, visibleCount, activeId, idOf = (item) => item?.id) {
      const list = Array.isArray(items) ? items : [];
      const keep = Math.max(0, Math.min(visibleCount, list.length));
      const visible = list.slice(0, keep);
      const active = list.find((item) => idOf(item) === activeId);
      if (active !== undefined && !visible.includes(active) && visible.length > 0) {
        visible[visible.length - 1] = active;
      }
      const shown = new Set(visible.map((item) => idOf(item)));
      /* Identity comes from `idOf`, NOT `.id`: file tabs carry `path` instead, and
         reading `.id` made every file look identical (`undefined`), so the overflow
         list came back empty and no `»` was ever rendered. */
      return { visible, hidden: list.filter((item) => !shown.has(idOf(item))) };
    }

    /**
     * An invisible xterm that only measures the dock's grid.
     *
     * Before the first shell exists there is no PTY and therefore no `cols`/`rows`
     * to spawn with — the old code guessed 80×24. zsh's PROMPT_SP pads its `%`
     * marker to the PTY width and erases it with a backspacing space, so a PTY
     * wider than the screen leaves that `%` wrapped onto the row above the
     * prompt. Fitting a real emulator to the real box gives the honest number.
     * @param {{fontSize: number, onGrid: Function}} props - font size and grid sink.
     * @returns {object} a zero-opacity xterm host.
     */
    function MeasuringScreen({ fontSize, onGrid }) {
      const hostRef = React.useRef(null);
      const handlersRef = React.useRef({ onGrid });
      handlersRef.current = { onGrid };
      React.useEffect(() => {
        const node = hostRef.current;
        if (node === null) return undefined;
        let disposed = false;
        let emulator = null;
        let observer = null;
        loadXterm().then(
          ({ Terminal, FitAddon }) => {
            if (disposed || node === null) return;
            emulator = new Terminal({
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
              fontSize,
              lineHeight: 1.25,
              scrollback: 1,
            });
            const fit = new FitAddon();
            emulator.loadAddon(fit);
            emulator.open(node);
            const measure = () => {
              if (node.clientWidth === 0 || node.clientHeight === 0) return;
              fit.fit();
              handlersRef.current.onGrid?.({ cols: Math.max(2, Math.min(500, emulator.cols)), rows: Math.max(1, Math.min(200, emulator.rows)) });
            };
            measure();
            if (typeof ResizeObserver !== 'undefined') {
              observer = new ResizeObserver(measure);
              observer.observe(node);
            }
          },
          () => {
            /* Measuring is an optimisation: a failure keeps the 80×24 fallback. */
          },
        );
        return () => {
          disposed = true;
          observer?.disconnect();
          emulator?.dispose();
        };
      }, [fontSize]);
      return React.createElement('div', {
        ref: hostRef,
        style: styles.terminalMeasure,
        'aria-hidden': 'true',
        'data-dsh-terminal-measure': '',
      });
    }

    /**
     * One xterm screen bound to a host terminal id.
     *
     * Used once for the dock and twice when the dock is split, so the effects that
     * own the emulator, the output stream, the PTY grid and the find highlight are
     * shared by both panes instead of being duplicated.
     */
    function TerminalScreen({
      terminalId,
      terminals,
      fontSize,
      find,
      onGrid,
      onError,
      onExit,
      onEmulator,
      onInput,
      onTitle,
      /* The shell's own directory reports (OSC 7); without it here the emulator
         would call an `undefined` name and take the pane down. */
      onCwd,
      getCwd,
    }) {
      const hostRef = React.useRef(null);
      const emulatorRef = React.useRef(null);
      const fitRef = React.useRef(null);
      const [ready, setReady] = React.useState(false);
      const sizeRef = React.useRef({ cols: 80, rows: 24 });
      const handlersRef = React.useRef({});
      /* Every callback the emulator mount may call must be registered here; a new one
         that is passed in but not listed stays `undefined` and fails silently (round
         122: `onCwd` was missing, so OSC 7 never reached the terminal state). */
      handlersRef.current = { onGrid, onError, onExit, onEmulator, onInput, onTitle, onCwd };

      /* Create the emulator once the screen node exists. */
      React.useEffect(() => {
        const node = hostRef.current;
        if (node === null) return;
        let disposed = false;
        loadXterm().then(
          ({ Terminal, FitAddon }) => {
            if (disposed || node === null) return;
            const emulator = new Terminal({
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
              fontSize,
              lineHeight: 1.25,
              cursorBlink: true,
              scrollback: 2000,
              theme: terminalTheme(node),
            });
            const fit = new FitAddon();
            emulator.loadAddon(fit);
            emulator.open(node);
            emulator.onData((data) => handlersRef.current.onInput?.(data));
            /* Shells publish their title over OSC 0/2; follow it like IDEA's terminal tabs. */
            emulator.onTitleChange((title) => handlersRef.current.onTitle?.(title));
            /* OSC 7 is how a shell reports `cd`; without it every menu action kept
               pointing at the tab's original directory. */
            /* `parser.registerOscHandler` exists on xterm 5.x; guard anyway, because a
               missing method here would take the whole emulator mount down. */
            if (typeof emulator.parser?.registerOscHandler === 'function') {
              emulator.parser.registerOscHandler(7, (payload) => {
                const cwd = cwdFromOsc7(payload);
                if (cwd !== null) handlersRef.current.onCwd?.(cwd);
                return true;
              });
            }
            /* IDEA underlines URLs and existing workspace files; both open on ⌘/Ctrl+click. */
            const linkDisposable = emulator.registerLinkProvider(createTerminalLinkProvider(emulator, () => getCwd()));
            emulatorRef.current = emulator;
            fitRef.current = fit;
            handlersRef.current.onEmulator?.(emulator);
            setReady(true);
            return () => linkDisposable.dispose();
          },
          (failure) => {
            if (!disposed) handlersRef.current.onError?.(failure instanceof Error ? failure.message : String(failure));
          },
        );
        return () => {
          disposed = true;
          emulatorRef.current?.dispose();
          emulatorRef.current = null;
          fitRef.current = null;
          handlersRef.current.onEmulator?.(null);
        };
      }, []);

      /* Follow this terminal's output stream, replaying its retained screen. */
      React.useEffect(() => {
        const emulator = emulatorRef.current;
        if (!ready || terminalId === null || emulator === null) return;
        const controller = new AbortController();
        emulator.reset();
        const sessionId = currentSessionId();
        const url = `api/dsh-editor/terminal/stream?sessionId=${encodeURIComponent(sessionId)}&id=${encodeURIComponent(terminalId)}`;
        fetch(url, { signal: controller.signal, headers: { accept: 'text/event-stream' } })
          .then((response) => {
            if (!response.ok) throw new Error(`terminal stream HTTP ${response.status}`);
            return readEventStream(
              response,
              (event) => {
                if (event.type === 'snapshot') {
                  emulator.reset();
                  emulator.write(event.data);
                } else if (event.type === 'data') {
                  emulator.write(event.data);
                } else if (event.type === 'exit') {
                  emulator.write(`\r\n[process exited${event.code === null ? '' : ` with code ${event.code}`}]\r\n`);
                  handlersRef.current.onExit?.(event.code ?? null);
                } else if (event.type === 'error') {
                  handlersRef.current.onError?.(event.message);
                }
              },
              controller.signal,
            );
          })
          .catch((failure) => {
            if (controller.signal.aborted) return;
            handlersRef.current.onError?.(failure instanceof Error ? failure.message : String(failure));
          });
        return () => controller.abort();
      }, [terminalId, ready]);

      /* Keep the PTY grid in step with the pane's real size. */
      React.useEffect(() => {
        const node = hostRef.current;
        const emulator = emulatorRef.current;
        if (!ready || node === null || emulator === null) return;
        const measure = () => {
          const fit = fitRef.current;
          if (fit === null) return;
          /* FitAddon needs a laid-out element; skip the frame where it has none. */
          if (node.clientWidth === 0 || node.clientHeight === 0) return;
          fit.fit();
          const cols = Math.max(2, Math.min(500, emulator.cols));
          const rows = Math.max(1, Math.min(200, emulator.rows));
          /* A measuring screen has no PTY yet: it still REPORTS the size, which is
             how a fresh shell is spawned at the real width instead of a guess. */
          if (cols === sizeRef.current.cols && rows === sizeRef.current.rows) return;
          sizeRef.current = { cols, rows };
          handlersRef.current.onGrid?.({ cols, rows });
          if (terminalId !== null) void callTerminal({ op: 'resize', id: terminalId, cols, rows }).catch(() => {});
        };
        measure();
        const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
        observer?.observe(node);
        return () => observer?.disconnect();
      }, [ready, terminalId]);

      /* Font size is a preference; xterm re-renders without touching the PTY. */
      React.useEffect(() => {
        const emulator = emulatorRef.current;
        if (!ready || emulator === null) return;
        emulator.options.fontSize = fontSize;
        fitRef.current?.fit();
      }, [fontSize, ready]);

      /* Follow the app's color scheme without restarting the shell. */
      React.useEffect(() => {
        if (!ready) return;
        const node = hostRef.current;
        const emulator = emulatorRef.current;
        if (node === null || emulator === null) return;
        const apply = () => {
          emulator.options.theme = terminalTheme(node);
        };
        const observer = new MutationObserver(apply);
        observer.observe(document.body, { attributes: true, attributeFilter: ['data-ds-dark-theme', 'class', 'style'] });
        return () => observer.disconnect();
      }, [ready]);

      /* Highlight and scroll to the requested find match inside this pane. */
      React.useEffect(() => {
        const emulator = emulatorRef.current;
        if (!ready || emulator === null || find === null) return;
        if (find.query === '') {
          emulator.clearSelection();
          return;
        }
        const hits = terminalMatches(emulator, find.query);
        if (hits.length === 0) {
          emulator.clearSelection();
          return;
        }
        const hit = hits[Math.min(find.index, hits.length - 1)];
        emulator.select(hit.column, hit.row, find.query.length);
        emulator.scrollToLine(hit.row - Math.floor(emulator.rows / 2));
      }, [ready, find?.query, find?.index]);

      return React.createElement('div', {
        ref: hostRef,
        style: styles.xtermHost,
        'data-dsh-terminal-pane': '',
        /* Never let one pane's focus steal the other pane's caret. */
        onClick: () => emulatorRef.current?.focus(),
      });
    }

    /**
     * IDEA-style terminal tool window body: xterm screen over the host PTY.
     *
     * The PTY lives on the host, so collapsing the panel, switching tool windows
     * or re-rendering never ends a shell — the view only re-attaches and replays
     * the retained screen.
     */
    /**
     * One terminal living in the EDITOR area, IDEA's "Move to Editor".
     *
     * The PTY and its screen buffer belong to the host, so this is just another
     * view onto the same id: moving a shell does not restart it, and moving it
     * back resumes with the output that ran meanwhile. The dock keeps the tab in
     * its list (its number shortcuts still address it) but stops rendering it.
     * @param {object} props - terminal identity plus the shared screen callbacks.
     * @returns {object} React element tree.
     */
    function EditorTerminalTab({ t, terminal, fontSize, onGrid, onError, onInput, onTitle, onCwd, onExit, onReturnToDock, getCwd }) {
      const [emulator, setEmulator] = React.useState(null);
      return React.createElement(
        'div',
        { style: styles.editorTerminalPane, 'data-dsh-editor-terminal-tab': terminal.id },
        React.createElement(
          'div',
          { style: styles.editorTerminalToolbar },
          React.createElement(Icon, { name: 'terminal', size: 12 }),
          React.createElement('span', { style: styles.editorTerminalTitle, title: `${terminal.title} — ${terminal.cwd}` }, terminal.title),
          React.createElement('span', { style: styles.toolbarSpacer }),
          /* IDEA keeps the reverse action right here: the same button sends the
             shell back to the dock, which is how the move is undone. */
          React.createElement(ToolbarButton, { icon: 'collapse', label: t('editor.terminalReturnToDock'), onClick: () => onReturnToDock(terminal) }),
          React.createElement(ToolbarButton, { icon: 'search', label: t('editor.find'), onClick: () => emulator?.focus() }),
        ),
        React.createElement(
          'div',
          { style: styles.editorTerminalScreen },
          React.createElement(TerminalScreen, {
            terminalId: terminal.id,
            terminals: [terminal],
            fontSize,
            find: null,
            getCwd,
            onGrid,
            onError,
            onExit,
            onEmulator: setEmulator,
            onInput: (data) => onInput(terminal.id, data),
            onTitle: (title) => onTitle(terminal.id, title),
            onCwd: (cwd) => onCwd(terminal.id, cwd),
          }),
        ),
      );
    }

    function TerminalPanel({ t, generation, startDirectory, workspaceRoot = '', onStartDirectoryUsed, onRequestNew, onRequestClose, onOpenFile, onEditorTerminals }) {
      const [terminals, setTerminals] = React.useState([]);
      /* The live directory per terminal, updated from OSC 7. The menu builds its
         items from a render snapshot, so a `cd` right before the click would
         otherwise be missed. */
      const terminalCwdRef = React.useRef(new Map());
      const [activeId, setActiveId] = React.useState(null);
      const [available, setAvailable] = React.useState(true);
      /* Resolved README per terminal, so the tab menu can disable the item when the
         shell's directory has none (the cwd alone is always a non-empty string). */
      const [readmePaths, setReadmePaths] = React.useState({});
      const [error, setError] = React.useState(null);
      const [busy, setBusy] = React.useState(false);
      /* Terminals that were moved INTO the editor area (IDEA's "Move to Editor").
         Their PTY keeps running; the dock stops rendering the tab. */
      const [editorIds, setEditorIds] = React.useState(() => readEditorTerminals());
      const editorIdsRef = React.useRef(editorIds);
      React.useEffect(() => {
        editorIdsRef.current = editorIds;
        writeEditorTerminals(editorIds);
      }, [editorIds]);
      /* Tell the workspace which terminals now belong in the editor area. The
         editor renders them; this component only knows the ids. */
      React.useEffect(() => {
        if (onEditorTerminals === undefined) return;
        onEditorTerminals(terminals.filter((terminal) => editorIds.includes(terminal.id)));
      }, [editorIds, onEditorTerminals, terminals]);
      /**
       * Send one terminal into the editor area (IDEA's Move to Editor).
       *
       * The dock keeps the process; it simply stops rendering the tab. A split
       * pane bound to that terminal is released first, or both areas would trace
       * the same PTY.
       * @param {object} terminal - terminal description from the tab.
       * @returns {void}
       */
      const moveTerminalToEditor = React.useCallback((terminal) => {
        if (terminal === null || terminal === undefined) return;
        setEditorIds((current) => (current.includes(terminal.id) ? current : [...current, terminal.id]));
        setSplitId((current) => (current === terminal.id ? null : current));
      }, []);

      /**
       * Bring one terminal back to the dock (the reverse of Move to Editor).
       * @param {object} terminal - terminal description.
       * @returns {void}
       */
      const returnTerminalToDock = React.useCallback((terminal) => {
        if (terminal === null || terminal === undefined) return;
        setEditorIds((current) => current.filter((id) => id !== terminal.id));
      }, []);
      /* IDEA splits the terminal dock: the right pane follows its own tab. */
      const [splitId, setSplitId] = React.useState(null);
      /* The split ratio survives a reload, like IDEA's dock proportions. */
      const [splitPercent, setSplitPercent] = React.useState(() => readStoredNumber('dsh-editor.terminal.splitPercent', 50));
      const [splitDragging, setSplitDragging] = React.useState(false);
      /* Which pane owns the keyboard; IDEA highlights that pane's tab. */
      const [focusedPane, setFocusedPane] = React.useState('left');
      /* Keyboard handlers are bound once, so they read the pane through a ref. */
      const focusedPaneRef = React.useRef('left');
      const splitIdRef = React.useRef(null);
      const tRef = React.useRef(t);
      tRef.current = t;
      React.useEffect(() => {
        splitIdRef.current = splitId;
      }, [splitId]);
      /**
       * The grid a NEW shell must start at.
       *
       * zsh's PROMPT_SP pads to the PTY width and erases its `%` marker with a
       * backspacing space; if the PTY is wider than the xterm that displays it,
       * that padded line wraps and the `%` is left stranded on the row above the
       * prompt. So the size is measured by the dock itself (see the measuring
       * screen below) instead of a hard-coded 80×24.
       */
      const measuredRef = React.useRef(null);
      /* Callers waiting for the first measurement (see `awaitMeasured`). */
      const measureWaiters = React.useRef([]);
      const reportGrid = React.useCallback((value) => {
        measuredRef.current = value;
        const waiters = measureWaiters.current;
        if (waiters.length === 0) return;
        measureWaiters.current = [];
        for (const resolve of waiters) resolve(value);
      }, []);
      /**
       * The grid a shell should be spawned at, waiting briefly for the screen.
       *
       * Fitting takes one async xterm load, while `+` can be clicked the moment
       * the dock appears. Spawning before the fit is done is exactly the 80-column
       * guess this fix removes, so the click waits — but only for a moment, and
       * the 80×24 fallback stands if xterm never loads.
       * @param {number} timeout - how long to wait for a measurement.
       * @returns {Promise<{cols: number, rows: number}>} the grid to spawn with.
       */
      const awaitMeasured = React.useCallback((timeout = 400) => {
        if (measuredRef.current !== null) return Promise.resolve(measuredRef.current);
        return new Promise((resolve) => {
          let settled = false;
          const finish = (value) => {
            if (settled) return;
            settled = true;
            resolve(value ?? { cols: 80, rows: 24 });
          };
          measureWaiters.current.push(finish);
          window.setTimeout(() => finish(measuredRef.current), timeout);
        });
      }, []);
      const [shells, setShells] = React.useState([]);
      const [shellMenu, setShellMenu] = React.useState(null);
      const [fontSize, setFontSize] = React.useState(() => readStoredNumber('dsh-editor.terminal.fontSize', 12));
      const [renaming, setRenaming] = React.useState(null);
      const [menu, setMenu] = React.useState(null);
      /* The tab strip's measured width; 0 until the first layout pass. */
      const [tabStripWidth, setTabStripWidth] = React.useState(0);
      const tabStripRef = React.useRef(null);
      /* The dock's find bar; its opening query comes from the last search. */
      const [find, setFind] = React.useState(null);
      /* The one-shot key listener needs to know whether the find bar is open. */
      const findRef = React.useRef(null);
      React.useEffect(() => {
        findRef.current = find;
      }, [find]);
      const lastTerminalQuery = React.useRef('');
      /* Clipboard outcomes are invisible otherwise; show the last one briefly. */
      const [clipboardNotice, setClipboardNotice] = React.useState(null);
      React.useEffect(() => {
        if (clipboardNotice === null) return undefined;
        const timer = window.setTimeout(() => setClipboardNotice(null), 2500);
        return () => window.clearTimeout(timer);
      }, [clipboardNotice]);
      /* IDEA collapses overflow tabs into `»`; that needs the strip's real width. */
      React.useLayoutEffect(() => {
        const node = tabStripRef.current;
        if (node === null) return undefined;
        const measure = () => setTabStripWidth(node.clientWidth);
        measure();
        if (typeof ResizeObserver === 'undefined') return undefined;
        const observer = new ResizeObserver(measure);
        observer.observe(node);
        return () => observer.disconnect();
      }, []);

      /**
       * Reveal one shell's working directory in the system file manager.
       *
       * The shell can `cd` outside the workspace, and the host only reveals paths
       * inside it — so a rejected reveal falls back to the workspace root instead
       * of doing nothing (a menu item that silently fails reads as broken).
       * @param {string} cwd - absolute directory the shell is in.
       * @returns {Promise<void>} resolves once the reveal was attempted.
       */
      /**
       * Open the README that sits in a shell's directory.
       *
       * The tab menu shows the item disabled when there is none, so this only runs
       * for a directory that has one; it still tolerates a race (the file deleted
       * between menu build and click) by reporting the failure instead of throwing.
       * @param {string} cwd - the shell's absolute working directory.
       * @returns {Promise<void>} resolves when the tab is opened or the failure is shown.
       */
      const openTerminalReadme = React.useCallback(async (cwd) => {
        const absolute = typeof cwd === 'string' ? cwd : '';
        if (absolute === '') return;
        const root = workspaceRoot;
        const prefix = root !== '' && absolute.startsWith(`${root}/`) ? root.length + 1 : -1;
        const relative = prefix > 0 ? absolute.slice(prefix) : absolute === root ? '' : null;
        if (relative === null) {
          setClipboardNotice(t('editor.terminalLinkFailed', { path: absolute }));
          return;
        }
        try {
          const listing = await callFs({ op: 'list', path: relative, showHidden: false, sort: 'name' });
          const names = (listing.entries ?? []).filter((entry) => entry.kind !== 'directory').map((entry) => entry.name);
          const path = readmeInDirectory(names, relative);
          setReadmePaths((current) => ({ ...current, [cwd]: path ?? '' }));
          if (path === null) {
            setClipboardNotice(t('editor.terminalLinkFailed', { path: relative === '' ? absolute : relative }));
            return;
          }
          await onOpenFile?.(path);
        } catch (failure) {
          setClipboardNotice(failure instanceof Error ? failure.message : String(failure));
        }
      }, [onOpenFile, t, workspaceRoot]);

      const revealTerminalDirectory = React.useCallback(async (cwd) => {
        const absolute = typeof cwd === 'string' ? cwd : '';
        if (absolute === '') return;
        try {
          /* Translate the absolute path back to the workspace-relative form the API
             wants; a directory outside the workspace (the shell can `cd /tmp`) is
             sent absolute instead of silently falling back to the root. */
          const root = workspaceRoot;
          const prefix = root !== '' && absolute.startsWith(`${root}/`) ? root.length + 1 : -1;
          const relative = prefix > 0 ? absolute.slice(prefix) : absolute === root ? '' : null;
          if (relative === null) await callFs({ op: 'reveal', path: absolute, absolute: true });
          else await callFs({ op: 'reveal', path: relative });
        } catch (failure) {
          const message = failure instanceof Error ? failure.message : String(failure);
          setClipboardNotice(hostErrorText(message, t, absolute));
        }
      }, [workspaceRoot]);

      /** Open the terminal find bar pre-filled with the previous query. */
      const openTerminalFind = (emulator) => {
        const query = lastTerminalQuery.current;
        const total = query === '' || emulator === null || emulator === undefined ? 0 : countTerminalMatches(emulator, query);
        setFind({ query, index: 0, total });
      };
      /* Tab drag-reorder state; IDEA lets you pull a terminal tab sideways. */
      const [dragId, setDragId] = React.useState(null);
      const [dragOverId, setDragOverId] = React.useState(null);
      const newButtonRef = React.useRef(null);
      /* Emulators are owned by TerminalScreen; these mirror them for menus and shortcuts. */
      const emulatorRef = React.useRef(null);
      const splitEmulatorRef = React.useRef(null);
      const activeRef = React.useRef(null);
      const terminalsRef = React.useRef([]);
      /* The link provider runs on xterm's schedule, so the cwd is read through a ref. */
      const cwdRef = React.useRef('');
      /* Input must reach the PTY in typing order, so writes ride one promise chain. */
      const writeChain = React.useRef(Promise.resolve());
      /* Whether the retained-terminal list has settled, so auto-start never doubles a tab.
         This is state, not a ref: the auto-start effect must re-run when it flips. */
      const [loaded, setLoaded] = React.useState(false);
      /* The persistence callback is declared after the list effect; the ref bridges them. */
      const rememberTerminalsRef = React.useRef(null);
      /* Whether this mount already auto-opened its first shell. */
      const openedRef = React.useRef(false);
      /* Recently closed terminals for this Session, newest first. */
      const [closedHistory, setClosedHistory] = React.useState(() => readClosedTerminals());
      /* Per-tab colour, an IDEA grouping aid; stored in the browser, not the host. */
      const [colors, setColors] = React.useState(() => readTerminalColors());
      /* The key handler is bound once, so it reads the history through a ref. */
      const closedHistoryRef = React.useRef(closedHistory);
      React.useEffect(() => {
        closedHistoryRef.current = closedHistory;
      }, [closedHistory]);

      React.useEffect(() => {
        activeRef.current = activeId;
      }, [activeId]);
      React.useEffect(() => {
        focusedPaneRef.current = focusedPane;
      }, [focusedPane]);
      React.useEffect(() => {
        terminalsRef.current = terminals;
        /* Keep the remembered profile in step with the live tabs. */
        if (terminals.length > 0) rememberTerminalsRef.current?.(terminals);
      }, [terminals]);

      /* Ask the host which terminals this Session still retains. */
      const refresh = React.useCallback(async () => {
        try {
          const value = await callTerminal({ op: 'list' });
          setAvailable(value.available !== false);
          setTerminals(value.terminals ?? []);
          setActiveId((current) => {
            if (current !== null && (value.terminals ?? []).some((terminal) => terminal.id === current)) return current;
            return value.terminals?.[0]?.id ?? null;
          });
          setError(null);
        } catch (failure) {
          setError(failure instanceof Error ? failure.message : String(failure));
        } finally {
          setLoaded(true);
        }
      }, []);

      React.useEffect(() => {
        void refresh();
      }, [refresh]);

      /* Renaming a tab clears the auto-title flag, so a later OSC title cannot undo it. */
      const renamedRef = React.useRef(new Set());
      /**
       * Adopt a shell-published title, unless the user renamed that tab by hand.
       *
       * OSC titles can arrive per prompt (zsh's precmd) or per command; the host
       * keeps the authoritative name so a remount replays the same tab label.
       * @param {string} id - terminal identity.
       * @param {string} title - title the shell published.
       */
      const syncTerminalTitle = React.useCallback(async (id, title) => {
        if (renamedRef.current.has(id)) return;
        const current = terminalsRef.current.find((terminal) => terminal.id === id);
        if (current === undefined || current.title === title) return;
        setTerminals((list) => list.map((terminal) => (terminal.id === id ? { ...terminal, title } : terminal)));
        void callTerminal({ op: 'rename', id, title, auto: true }).catch(() => {});
      }, []);

      /**
       * Follow the shell's own working directory (reported via OSC 7).
       *
       * The PTY metadata keeps the directory the tab was created in; the menu actions
       * need where the user actually is. Only the local list is updated, and only when
       * it changes, so typing does not re-render the dock on every prompt.
       * @param {string} id - terminal id.
       * @param {string} cwd - absolute directory the shell reported.
       * @returns {void}
       */
      const syncTerminalCwd = React.useCallback((id, cwd) => {
        if (typeof cwd !== 'string' || cwd === '') return;
        setTerminals((list) => {
          const target = list.find((terminal) => terminal.id === id);
          if (target === undefined || target.cwd === cwd) return list;
          return list.map((terminal) => (terminal.id === id ? { ...terminal, cwd } : terminal));
        });
        /* The tab menu reads `terminal.cwd` from the render snapshot; keep the host
           description in step too so a later re-read agrees. */
        terminalCwdRef.current.set(id, cwd);
      }, []);

      /** Queue one keystroke behind the previous one so the PTY sees typing order. */
      const sendInput = React.useCallback((id, data) => {
        writeChain.current = writeChain.current.then(() => callTerminal({ op: 'write', id, data })).catch(() => {});
        return writeChain.current;
      }, []);

      /**
       * Remember the open tabs' shells and working directories for the next mount.
       *
       * The host keeps the PTY and its screen buffer, but a host restart drops
       * both. Persisting only `shell` + `cwd` is enough to rebuild an equivalent
       * dock (IDEA reopens the last shell tabs without their scrollback too).
       */
      const rememberTerminals = React.useCallback((list) => {
        try {
          const profile = list
            .filter((terminal) => typeof terminal.shell === 'string' && terminal.shell !== '')
            .map((terminal) => ({ shell: terminal.shell, cwd: terminal.cwd ?? '', title: terminal.title ?? '' }));
          window.localStorage.setItem(`dsh-editor.terminal.profile:${currentSessionId()}`, JSON.stringify(profile));
        } catch {
          /* a storage-less browser simply does not restore */
        }
      }, []);
      /* Bridge for the list effect above, which runs before this callback exists. */
      rememberTerminalsRef.current = rememberTerminals;

      /**
       * Remember a terminal that was just closed, so it can be reopened.
       *
       * IDEA keeps closed tabs in the tab menu's history. Only the shell and cwd
       * can be restored — the PTY and its scrollback died with the close.
       * @param {{shell: string, cwd: string, title: string}} terminal - description before closing.
       */
      const rememberClosed = React.useCallback((terminal) => {
        if (terminal === null || typeof terminal.shell !== 'string') return;
        setClosedHistory((current) => {
          const entry = { shell: terminal.shell, cwd: terminal.cwd ?? '', title: terminal.title ?? '' };
          const next = [entry, ...current.filter((item) => !(item.shell === entry.shell && item.cwd === entry.cwd))].slice(0, 8);
          try {
            window.localStorage.setItem(`dsh-editor.terminal.closed:${currentSessionId()}`, JSON.stringify(next));
          } catch {
            /* storage-less browsers keep the in-memory list only */
          }
          return next;
        });
      }, []);

      /**
       * Turn a terminal-create rejection into a sentence the dock can act on.
       *
       * The host caps retained shells per Session; its wording ("at most 6
       * terminals are retained per Session") is accurate but does not say what to
       * do. IDEA tells you to close a tab, so that is what the dock says.
       * @param {unknown} failure - rejection from the host call.
       * @returns {string} message for the dock's status bar.
       */
      const describeCreateFailure = React.useCallback((failure) => {
        const message = failure instanceof Error ? failure.message : String(failure);
        return /at most \d+ terminals/iu.test(message) ? t('editor.terminalLimit') : message;
      }, [t]);

      const createTerminal = React.useCallback(async (shellPath, directory) => {
        setBusy(true);
        setError(null);
        try {
          const grid = await awaitMeasured();
          const value = await callTerminal({
            op: 'create',
            cols: grid.cols,
            rows: grid.rows,
            shellPath,
            /* An explicit directory (duplicate / "open in terminal") wins; otherwise the
               ambient start directory from the tree, which a plain new tab ignores
               unless "open in terminal" was used. */
            startPath: typeof directory === 'string' && directory !== ''
              ? directory
              : (shellPath === undefined && typeof startDirectory === 'string' ? startDirectory : ''),
          });
          const created = value.terminal;
          setTerminals((current) => [...current, created]);
          setActiveId(created.id);
          /* "Open in Terminal" from a directory: enter it once the shell is up. */
          if (shellPath === undefined && typeof startDirectory === 'string' && startDirectory !== '') onStartDirectoryUsed?.();
          return created;
        } catch (failure) {
          setError(describeCreateFailure(failure));
          return null;
        } finally {
          setBusy(false);
        }
      }, [awaitMeasured, describeCreateFailure, startDirectory, onStartDirectoryUsed]);

      /**
       * Cycle one tab through IDEA's colour palette (and back to no colour).
       *
       * The palette order is fixed so "next colour" is predictable, and the map is
       * written on every change so a reload restores the grouping.
       * @param {string} id - terminal identity.
       */
      const cycleTerminalColor = React.useCallback((id) => {
        setColors((current) => {
          const index = current[id] === undefined ? -1 : TERMINAL_COLORS.indexOf(current[id]);
          const next = { ...current };
          if (index === TERMINAL_COLORS.length - 1) delete next[id];
          else next[id] = TERMINAL_COLORS[index + 1];
          writeTerminalColors(next);
          return next;
        });
      }, []);

      /* Reopening a closed tab starts a fresh shell in the same directory. */
      const reopenClosed = React.useCallback(async (entry) => {
        const exists = await callTerminal({ op: 'shells' })
          .then((value) => (value.shells ?? []).some((shell) => shell.path === entry.shell))
          .catch(() => false);
        await createTerminal(exists ? entry.shell : undefined);
      }, [createTerminal]);


      /**
       * Recreate the remembered shell tabs, one PTY per entry.
       *
       * A shell that has since been uninstalled must not abort the restore, so
       * each entry is attempted independently and failures fall back to the
       * default shell instead of leaving the dock empty.
       * @param {Array<{shell: string, cwd: string}>} profile - remembered tabs.
       */
      const restoreTerminals = React.useCallback(async (profile) => {
        for (const entry of profile.slice(0, 4)) {
          const exists = await callTerminal({ op: 'shells' })
            .then((value) => (value.shells ?? []).some((shell) => shell.path === entry.shell))
            .catch(() => false);
          const created = await createTerminal(exists ? entry.shell : undefined);
          if (created === null) break;
        }
      }, [createTerminal]);


      /* "Return to dock" is fired from the editor area, which is a sibling
         component; the event carries the id and this panel owns the state.
         Listened for on `window`: the editor area dispatches from its own node,
         and a host re-render can replace that node between dispatches. */
      React.useEffect(() => {
        const onReturn = (event) => {
          const id = event.detail?.id;
          if (typeof id !== 'string' || id === '') return;
          setEditorIds((current) => current.filter((entry) => entry !== id));
        };
        window.addEventListener('dsh-editor-return-terminal', onReturn);
        return () => window.removeEventListener('dsh-editor-return-terminal', onReturn);
      }, []);

      /* The first terminal starts automatically, the way IDEA opens a shell tab. */
      React.useEffect(() => {
        if (!loaded || !available || busy || terminals.length > 0 || error !== null) return;
        if (openedRef.current) {
          /* Closing the last tab closes the tool window, exactly like IDEA. */
          onRequestClose?.();
          return;
        }
        openedRef.current = true;
        /* After a host restart the tab list is empty: rebuild what was open, with its shell. */
        const remembered = readTerminalProfile();
        if (remembered.length > 0) {
          void restoreTerminals(remembered);
          return;
        }
        void createTerminal();
        /* `createTerminal`/`restoreTerminals` are read through the closure on
           purpose: including them re-ran this on every parent render. `openedRef`
           makes the body idempotent, so no dependency on them is needed. */
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [available, busy, loaded, terminals.length, error, onRequestClose]);

      /**
       * `createTerminal` as it exists NOW, for the one-shot effects below.
       *
       * Its dependency list includes props the workspace passes inline, so its
       * identity changes on almost every render. An effect that depends on it
       * therefore re-fired on every render: pressing `+` started a new shell per
       * render, which is the "terminal freezes when you press +" report. The
       * ref keeps the latest callback without making the effect depend on it.
       */
      const createTerminalRef = React.useRef(createTerminal);
      createTerminalRef.current = createTerminal;

      /* A "new terminal" request from the dock header or the shortcut. */
      React.useEffect(() => {
        if (generation === 0) return;
        /* `createTerminal` only honours `startPath` when no shell is named, so a
           request carrying a directory ("Open in Terminal") must not pass one. */
        void createTerminalRef.current();
      }, [generation]);

      /* The arrow beside "+" lists installed shells without allocating a process. */
      const openShellMenu = React.useCallback(async () => {
        const rect = newButtonRef.current?.getBoundingClientRect();
        setBusy(true);
        try {
          const value = await callTerminal({ op: 'shells' });
          const entries = value.shells ?? [];
          setShells(entries);
          setShellMenu({
            x: rect?.left ?? 240,
            y: (rect?.bottom ?? 200) + 4,
            items: entries.length === 0
              ? [{ id: 'none', label: t('editor.terminalNoShell'), disabled: true, run: () => {} }]
              : entries.map((shell) => ({
                  id: shell.path,
                  label: shell.name,
                  shortcut: '',
                  run: () => void createTerminal(shell.path),
                })),
          });
        } catch (failure) {
          setError(failure instanceof Error ? failure.message : String(failure));
        } finally {
          setBusy(false);
        }
      }, [createTerminal, t]);

      /* Double-click a tab title to rename it, the way IDE terminals do. */
      const commitRename = React.useCallback(async () => {
        if (renaming === null) return;
        const title = renaming.value.trim();
        if (title === '' || title === renaming.previous) {
          setRenaming(null);
          return;
        }
        try {
          renamedRef.current.add(renaming.id);
          const value = await callTerminal({ op: 'rename', id: renaming.id, title });
          setTerminals((current) => current.map((terminal) => (terminal.id === renaming.id ? value.terminal : terminal)));
          setRenaming(null);
        } catch (failure) {
          setError(failure instanceof Error ? failure.message : String(failure));
        }
      }, [renaming]);

      const closeTerminal = React.useCallback(async (id) => {
        /* Record it first: after the host reaps it there is nothing left to describe. */
        const closing = terminalsRef.current.find((terminal) => terminal.id === id);
        if (closing !== undefined) rememberClosed(closing);
        setColors((current) => {
          if (current[id] === undefined) return current;
          const next = { ...current };
          delete next[id];
          writeTerminalColors(next);
          return next;
        });
        try {
          await callTerminal({ op: 'close', id });
        } catch {
          /* a terminal the host already reaped needs no further cleanup */
        }
        setTerminals((current) => {
          const remaining = current.filter((terminal) => terminal.id !== id);
          setActiveId((active) => (active === id ? remaining[0]?.id ?? null : active));
          return remaining;
        });
      }, [rememberClosed]);

      /* Reorder the dock's tabs locally first, then persist the order on the host. */
      const moveTab = React.useCallback(
        async (sourceId, targetId) => {
          const current = terminalsRef.current.map((terminal) => terminal.id);
          const from = current.indexOf(sourceId);
          const to = current.indexOf(targetId);
          if (from < 0 || to < 0 || from === to) return;
          const next = [...current];
          next.splice(from, 1);
          next.splice(to, 0, sourceId);
          setTerminals((list) => [...list].sort((left, right) => next.indexOf(left.id) - next.indexOf(right.id)));
          try {
            const value = await callTerminal({ op: 'reorder', ids: next });
            if (Array.isArray(value?.terminals)) setTerminals(value.terminals);
          } catch {
            /* the local order still matches what the user just did */
          }
        },
        [],
      );

      /* IDEA's "Close Other Terminals": keep one tab, reap the rest. */
      const closeOtherTerminals = React.useCallback(
        async (keepId) => {
          const doomed = terminals.filter((terminal) => terminal.id !== keepId);
          await Promise.all(doomed.map((terminal) => callTerminal({ op: 'close', id: terminal.id }).catch(() => {})));
          setTerminals((current) => current.filter((terminal) => terminal.id === keepId));
          setActiveId(keepId);
        },
        [terminals],
      );



      const active = terminals.find((terminal) => terminal.id === activeId) ?? null;
      /* The right pane's terminal; cleared when that tab is closed. */
      const splitTerminal = splitId === null ? null : terminals.find((terminal) => terminal.id === splitId) ?? null;
      React.useEffect(() => {
        cwdRef.current = active?.cwd ?? '';
      }, [active?.cwd]);
      React.useEffect(() => {
        /* A split always shows a DIFFERENT terminal: the same id would double the stream. */
        if (splitId !== null && (splitTerminal === null || splitId === activeId)) setSplitId(null);
        /* IDEA keeps the keyboard in the terminal: when the right pane closes, the
           focus goes back to the surviving one instead of being dropped. */
        if (splitId === null && focusedPane === 'right') setFocusedPane('left');
      }, [splitId, splitTerminal, activeId, focusedPane]);

      /** Open the screen context menu for one pane. */
      const openScreenMenu = (event, emulator, terminal) => {
        if (emulator === null || emulator === undefined) return;
        event.preventDefault();
        event.stopPropagation();
        const model = terminalMenuModel({
          t,
          emulator,
          active: terminal,
          onSelectAll: () => emulator.selectAll(),
          onClear: () => emulator.clear(),
          onClipboardError: (message) => setClipboardNotice(message),
          onClearBuffer: () => {
            /* Dispose the buffer by resetting, then drop any retained host output. */
            emulator.reset();
            emulator.clear();
          },
          onCreate: () => (onRequestNew === undefined ? void createTerminal() : onRequestNew()),
        });
        if (model !== null) setMenu({ ...model, x: event.clientX, y: event.clientY });
      };

      /* Recompute the match count whenever the query changes. */
      React.useEffect(() => {
        if (find === null) return;
        /* Remember the query so reopening the bar continues where the user left off. */
        lastTerminalQuery.current = find.query;
        if (emulatorRef.current === null) return;
        const total = countTerminalMatches(emulatorRef.current, find.query);
        setFind((current) => (current === null || current.total === total ? current : { ...current, total, index: Math.min(current.index, Math.max(0, total - 1)) }));
      }, [find?.query]);

      /* ⌘/Ctrl+F inside either terminal pane opens the dock's own find bar. */
      React.useEffect(() => {
        const onKeyDown = (event) => {
          if (!(event.metaKey || event.ctrlKey) || event.altKey || event.key.toLowerCase() !== 'f') return;
          if (document.activeElement?.closest('[data-dsh-terminal-pane]') == null) return;
          event.preventDefault();
          event.stopPropagation();
          if (findRef.current === null) openTerminalFind(focusedPaneRef.current === 'right' ? splitEmulatorRef.current : emulatorRef.current);
        };
        window.addEventListener('keydown', onKeyDown, true);
        return () => window.removeEventListener('keydown', onKeyDown, true);
      }, []);

      /* IDEA switches terminal tabs with ⌘1–⌘9 and walks them with ⌥←/→. */
      React.useEffect(() => {
        const onKeyDown = (event) => {
          if (document.activeElement?.closest('[data-dsh-editor-terminal]') == null) return;
          const meta = event.metaKey || event.ctrlKey;
          if (meta && !event.altKey && !event.shiftKey && /^[1-9]$/u.test(event.key)) {
            const index = Number(event.key) - 1;
            const target = terminalsRef.current[index];
            if (target === undefined) return;
            event.preventDefault();
            event.stopPropagation();
            /* With a split open the shortcut acts on the pane the caret is in;
               switching the other pane's tab looks like the key did nothing. */
            if (focusedPaneRef.current === 'right' && splitIdRef.current !== null) {
              if (target.id === splitIdRef.current) return;
              /* Picking the terminal the LEFT pane is showing swaps the panes:
                 binding both to one id makes the split guard collapse the dock. */
              if (target.id === activeRef.current) {
                setActiveId(splitIdRef.current);
                setSplitId(target.id);
                return;
              }
              setSplitId(target.id);
              return;
            }
            setActiveId(target.id);
            return;
          }
          /* ⌘⇧T reopens the most recently closed terminal, like IDEA's tab menu action. */
          if (meta && event.shiftKey && !event.altKey && event.key.toLowerCase() === 't') {
            const recent = closedHistoryRef.current[0];
            if (recent === undefined) return;
            event.preventDefault();
            event.stopPropagation();
            void reopenClosed(recent);
            return;
          }
          /* IDEA's ⌘K clears the focused terminal without killing the shell. */
          if (meta && !event.altKey && !event.shiftKey && event.key.toLowerCase() === 'k') {
            event.preventDefault();
            event.stopPropagation();
            const emulator = focusedPaneRef.current === 'right' ? splitEmulatorRef.current : emulatorRef.current;
            emulator?.clear();
            return;
          }
          /* ⌘G / ⇧⌘G walk the find bar's matches, IDEA's key for "next match".
             The bar had buttons only, so the keyboard path stopped at the count. */
          if (meta && !event.altKey && event.key.toLowerCase() === 'g') {
            const current = findRef.current;
            const emulator = focusedPaneRef.current === 'right' ? splitEmulatorRef.current : emulatorRef.current;
            if (current === null || emulator === null || emulator === undefined) return;
            event.preventDefault();
            event.stopPropagation();
            moveTerminalSelection(emulator, current, setFind, event.shiftKey ? -1 : 1);
            return;
          }
          /* ⌘A selects the whole buffer, matching the screen menu's advertised key.
             xterm keeps the native textarea selection, so the DOM selection is not
             the buffer; without this the menu item was the only way to select all. */
          if (meta && !event.altKey && !event.shiftKey && event.key.toLowerCase() === 'a') {
            const emulator = focusedPaneRef.current === 'right' ? splitEmulatorRef.current : emulatorRef.current;
            if (emulator === null || emulator === undefined) return;
            event.preventDefault();
            event.stopPropagation();
            emulator.selectAll();
            return;
          }
          /* ⇧F6 renames the focused tab, the key its own context menu prints. */
          if (!meta && !event.altKey && event.shiftKey && event.key === 'F6') {
            const id = focusedPaneRef.current === 'right' && splitIdRef.current !== null ? splitIdRef.current : activeRef.current;
            const terminal = terminalsRef.current.find((entry) => entry.id === id);
            if (terminal === undefined) return;
            event.preventDefault();
            event.stopPropagation();
            setRenaming({ id: terminal.id, value: terminal.title, previous: terminal.title });
            return;
          }
          /* ⌘⇧C copies the selection, ⌘⇧V pastes into the focused pane. */
          if (meta && event.shiftKey && !event.altKey && (event.key.toLowerCase() === 'c' || event.key.toLowerCase() === 'v')) {
            const emulator = focusedPaneRef.current === 'right' ? splitEmulatorRef.current : emulatorRef.current;
            if (emulator === null || emulator === undefined) return;
            if (event.key.toLowerCase() === 'c') {
              const selection = typeof emulator.getSelection === 'function' ? emulator.getSelection() : '';
              if (selection === '') return;
              event.preventDefault();
              event.stopPropagation();
              /* A refused clipboard write must say so; silence looks like "copied". */
              void Promise.resolve(navigator.clipboard?.writeText(selection))
                .then(() => setClipboardNotice(tRef.current('editor.copiedToClipboard')))
                .catch(() => setClipboardNotice(tRef.current('editor.clipboardWriteFailed')));
              return;
            }
            event.preventDefault();
            event.stopPropagation();
            const pane = focusedPaneRef.current === 'right' ? terminalsRef.current.find((terminal) => terminal.id === splitIdRef.current) : terminalsRef.current.find((terminal) => terminal.id === activeRef.current);
            if (pane !== undefined) void pasteIntoTerminal(emulator, pane, tRef.current, setClipboardNotice);
            return;
          }
          if (event.altKey && !meta && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) {
            const list = terminalsRef.current;
            if (list.length < 2) return;
            /* With a split open the walk belongs to the focused pane: cycling the
               left pane's tabs while the caret sits on the right looks inert. */
            const onRight = focusedPaneRef.current === 'right' && splitIdRef.current !== null;
            const current = list.findIndex((terminal) => terminal.id === (onRight ? splitIdRef.current : activeRef.current));
            const step = event.key === 'ArrowRight' ? 1 : -1;
            const next = list[(current + step + list.length) % list.length];
            event.preventDefault();
            event.stopPropagation();
            if (onRight) {
              /* Landing on the left pane's terminal would bind both panes to one
                 PTY (the split guard then collapses the dock), so swap instead. */
              if (next.id === activeRef.current) {
                setActiveId(splitIdRef.current);
                setSplitId(next.id);
                return;
              }
              setSplitId(next.id);
              return;
            }
            setActiveId(next.id);
          }
        };
        window.addEventListener('keydown', onKeyDown, true);
        return () => window.removeEventListener('keydown', onKeyDown, true);
      }, []);

      /**
       * Split the dock with a second tab, or close the existing split.
       *
       * IDEA splits with the next tab; a session holding a single shell gets a
       * fresh one in the right pane instead of a dead button. Unsplit keeps the
       * pane the user was typing in and drops the other one.
       */
      const toggleSplit = async () => {
        if (splitId !== null) {
          const keep = focusedPane === 'right' ? splitId : activeId;
          setSplitId(null);
          setFocusedPane('left');
          if (keep !== null) setActiveId(keep);
          return;
        }
        const candidate = terminals.find((terminal) => terminal.id !== activeId);
        if (candidate !== undefined) {
          setSplitId(candidate.id);
          setFocusedPane('left');
          return;
        }
        /* Keep the existing shell on the left: createTerminal() focuses the new one,
           and binding the SAME id to both panes would open two streams on one PTY. */
        const previous = activeId;
        if (previous === null) return;
        const created = await createTerminal();
        if (created === null || created.id === previous) return;
        setActiveId(previous);
        setSplitId(created.id);
        setFocusedPane('right');
      };

      /** Persist the split ratio once the drag settles. */
      const commitSplitPercent = (value) => {
        try {
          window.localStorage.setItem('dsh-editor.terminal.splitPercent', String(Math.round(value)));
        } catch {
          /* a storage-less browser keeps the in-memory ratio */
        }
      };

      /**
       * Send one terminal to the other split pane, or bring it into the split.
       *
       * IDEA lets you drag a tab across the divider: the tab becomes that pane's
       * terminal, and dragging the pane's own tab back reunites the dock.
       * @param {string} terminalId - tab being dragged.
       * @param {'left'|'right'} pane - pane that received the drop.
       */
      const moveToPane = React.useCallback(
        (terminalId, pane) => {
          if (pane === 'right') {
            if (terminalId === activeId) return;
            setSplitId(terminalId);
            setFocusedPane('right');
            return;
          }
          /* Dropping onto the left pane while it is the split's own tab means "unsplit". */
          if (terminalId === splitId) {
            setSplitId(null);
            setFocusedPane('left');
            return;
          }
          setActiveId(terminalId);
          setFocusedPane('left');
        },
        [activeId, splitId],
      );

      /**
       * Move keyboard focus between the two panes.
       *
       * The pane's own emulator handles the typing, so the state only drives the
       * tab highlighting and which terminal unsplit keeps.
       * @param {'left'|'right'} pane - pane that should own the caret.
       */
      const focusPane = (pane) => {
        if (splitId === null) {
          setFocusedPane('left');
          return;
        }
        setFocusedPane(pane);
        const emulator = pane === 'right' ? splitEmulatorRef.current : emulatorRef.current;
        emulator?.focus();
      };

      /* Tabs moved to the editor are not drawn in the dock: the same shell cannot
         be shown twice (two xterm views on one PTY double the output handling). */
      const dockTerminals = terminals.filter((terminal) => !editorIds.includes(terminal.id));
      /* One split for the render: which tabs stay in the strip and which go to `»`. */
      const tabLayout = overflowTabs(dockTerminals, visibleTabCount(tabStripWidth, dockTerminals.length), activeId);


      return React.createElement(
        'div',
        { style: styles.terminalPanel, 'data-dsh-editor-terminal': '' },
        React.createElement(
          'div',
          { style: styles.terminalTabStrip },
          React.createElement(
            'div',
            { ref: tabStripRef, style: styles.terminalTabs },
            /* IDEA keeps every tab legible and moves the rest into a `»` list. */
            tabLayout.visible.map((terminal) =>
              React.createElement(
                'div',
                {
                  key: terminal.id,
                  className: terminal.id === activeId ? 'dsh-editor-terminal-tab dsh-editor-terminal-tab-active' : 'dsh-editor-terminal-tab',
                  style: {
                    ...styles.terminalTab,
                    ...(terminal.id === activeId ? styles.terminalTabActive : null),
                    ...(dragOverId === terminal.id ? styles.terminalTabDrop : null),
                    ...(dragId === terminal.id ? styles.terminalTabDragging : null),
                  },
                  title: `${terminal.title} — ${terminal.cwd}`,
                  onClick: () => {
                    /* With a split open, clicking the right pane's tab focuses that pane. */
                    if (splitId !== null && terminal.id === splitId) {
                      focusPane('right');
                      return;
                    }
                    setActiveId(terminal.id);
                    setFocusedPane('left');
                  },
                  draggable: true,
                  onDragStart: (event) => {
                    setDragId(terminal.id);
                    event.dataTransfer?.setData('text/plain', terminal.id);
                    event.dataTransfer.effectAllowed = 'move';
                  },
                  onDragOver: (event) => {
                    if (dragId === null || dragId === terminal.id) return;
                    event.preventDefault();
                    event.dataTransfer.dropEffect = 'move';
                    setDragOverId(terminal.id);
                  },
                  onDragLeave: () => setDragOverId((current) => (current === terminal.id ? null : current)),
                  onDrop: (event) => {
                    event.preventDefault();
                    const source = dragId ?? event.dataTransfer?.getData('text/plain') ?? '';
                    setDragId(null);
                    setDragOverId(null);
                    if (source !== '' && source !== terminal.id) void moveTab(source, terminal.id);
                  },
                  onDragEnd: () => {
                    setDragId(null);
                    setDragOverId(null);
                  },
                  onContextMenu: (event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    setActiveId(terminal.id);
                    setMenu({
                      x: event.clientX,
                      y: event.clientY,
                      items: terminalTabMenu(t, terminal, {
                        rename: () => setRenaming({ id: terminal.id, value: terminal.title, previous: terminal.title }),
                        close: () => void closeTerminal(terminal.id),
                        closeOthers: () => void closeOtherTerminals(terminal.id),
                        /* A duplicate starts where the original is, not at the root. */
                        duplicate: () => void createTerminal(terminal.shell, terminalCwdRef.current.get(terminal.id) ?? terminal.cwd),
                        /* IDEA's "Split Right": this tab becomes the right pane. */
                        splitRight: terminal.id === activeId ? null : () => {
                          setSplitId(terminal.id);
                          setFocusedPane('right');
                        },
                        reopen: closedHistory.length === 0 ? null : () => void reopenClosed(closedHistory[0]),
                        /* IDEA's "Move to Editor": the shell becomes a tab in the
                           main editor area instead of a bottom-pane tab. */
                        moveToEditor: () => moveTerminalToEditor(terminal),
                        cycleColor: () => cycleTerminalColor(terminal.id),
                        revealCwd: () => void revealTerminalDirectory(terminalCwdRef.current.get(terminal.id) ?? terminal.cwd),
                        /* Resolved by the click; the item is enabled optimistically and a
                           missing README reports itself. Cheap enough for a menu. */
                        /* Live value first: `terminal.cwd` in this closure may predate a
                           `cd` that OSC 7 already reported. */
                        readmePath: readmePaths[terminalCwdRef.current.get(terminal.id) ?? terminal.cwd],
                        cwd: terminalCwdRef.current.get(terminal.id) ?? terminal.cwd,
                        openReadme: () => void openTerminalReadme(terminalCwdRef.current.get(terminal.id) ?? terminal.cwd),
                      }),
                    });
                  },
                },
                colors[terminal.id] === undefined
                  ? null
                  : React.createElement('span', { style: { ...styles.terminalTabStripe, background: colors[terminal.id] } }),
                React.createElement(Icon, { name: 'terminal', size: 12 }),
                renaming !== null && renaming.id === terminal.id
                  ? React.createElement('input', {
                      style: styles.terminalRenameInput,
                      value: renaming.value,
                      autoFocus: true,
                      onClick: (event) => event.stopPropagation(),
                      onChange: (event) => setRenaming((current) => (current === null ? current : { ...current, value: event.target.value })),
                      onBlur: () => void commitRename(),
                      onKeyDown: (event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          void commitRename();
                        } else if (event.key === 'Escape') {
                          event.preventDefault();
                          setRenaming(null);
                        }
                      },
                    })
                  : React.createElement(
                      'span',
                      {
                        style: { minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' },
                        onDoubleClick: (event) => {
                          event.stopPropagation();
                          setRenaming({ id: terminal.id, value: terminal.title, previous: terminal.title });
                        },
                      },
                      terminal.title,
                    ),
                terminal.state === 'exited' ? React.createElement('span', { style: styles.terminalExited }, `[${terminal.exitCode ?? '×'}]`) : null,
                React.createElement(
                  'button',
                  {
                    type: 'button',
                    style: styles.terminalTabClose,
                    'aria-label': t('editor.terminalClose'),
                    onClick: (event) => {
                      event.stopPropagation();
                      void closeTerminal(terminal.id);
                    },
                  },
                  '×',
                ),
              ),
            ),
            tabLayout.hidden.length === 0
              ? null
              : React.createElement(
                  'button',
                  {
                    type: 'button',
                    className: 'dsh-editor-terminal-overflow',
                    style: styles.terminalOverflow,
                    title: t('editor.terminalOverflow', { count: tabLayout.hidden.length }),
                    'aria-label': t('editor.terminalOverflow', { count: tabLayout.hidden.length }),
                    onClick: (event) => {
                      const rect = event.currentTarget.getBoundingClientRect();
                      setMenu({
                        x: Math.max(4, rect.left - 120),
                        y: rect.bottom + 4,
                        title: t('editor.terminalOverflowTitle'),
                        items: tabLayout.hidden.map((terminal) => ({
                          id: `tab:${terminal.id}`,
                          label: terminal.title,
                          /* The strip shows a colour stripe per tab; the dropdown must too,
                             or a colour-coded tab loses its identity when it overflows. */
                          ...(colors[terminal.id] === undefined ? {} : { swatch: colors[terminal.id] }),
                          shortcut: terminal.state === 'exited' ? '×' : '',
                          run: () => {
                            if (splitId !== null && terminal.id === splitId) focusPane('right');
                            else {
                              setActiveId(terminal.id);
                              setFocusedPane('left');
                            }
                          },
                        })),
                      });
                    },
                  },
                  '»',
                ),
          ),
          React.createElement('span', { style: styles.toolbarSpacer }),
          /* The clipboard notice and the new-tab button share one span so the
             toolbar's flex layout keeps them together at the end. Props go in the
             second argument — a `{ref, style}` object passed as a child is what
             made the whole dock throw React error #31 ("object with keys"). */
          React.createElement(
            'span',
            { ref: newButtonRef, style: { display: 'inline-flex', alignItems: 'center', gap: 6 } },
            clipboardNotice === null
              ? null
              : React.createElement('span', { style: styles.terminalClipboardNotice, role: 'status' }, clipboardNotice),
            React.createElement(ToolbarButton, {
              icon: 'newFile',
              label: t('editor.terminalNew'),
              onClick: () => (onRequestNew === undefined ? void createTerminal() : onRequestNew()),
              disabled: busy,
            }),
          ),
          React.createElement(ToolbarButton, { icon: 'chevronDown', label: t('editor.terminalShells'), onClick: () => void openShellMenu(), disabled: busy }),
          React.createElement(ToolbarButton, { icon: 'collapse', label: t('editor.terminalClear'), onClick: () => emulatorRef.current?.clear(), disabled: activeId === null }),
          React.createElement(ToolbarButton, {
            icon: 'settings',
            label: t('editor.terminalFontSize'),
            onClick: () => setFontSize((size) => storeFontSize(size)),
          }),
          React.createElement(ToolbarButton, {
            icon: 'split',
            label: splitId === null ? t('editor.terminalSplit') : t('editor.terminalUnsplit'),
            onClick: () => void toggleSplit(),
            /* A single shell is enough: splitting then opens a fresh tab on the right. */
            disabled: available === false || activeId === null,
          }),
          React.createElement(ToolbarButton, {
            icon: 'search',
            label: t('editor.find'),
            onClick: () => openTerminalFind(emulatorRef.current),
            disabled: available === false,
          }),
          React.createElement(ToolbarButton, { icon: 'refresh', label: t('editor.refresh'), onClick: () => void refresh() }),
          /* IDEA puts the tool window's hide control at the end of the strip that
             already carries its actions, so the dock needs no second title row. */
          onRequestClose === undefined
            ? null
            : React.createElement(ToolbarButton, { icon: 'hide', label: t('editor.hideTerminal'), onClick: () => onRequestClose() }),
        ),
        find === null
          ? null
          : React.createElement(
              'div',
              { style: styles.findBar },
              React.createElement('input', {
                style: styles.findInput,
                autoFocus: true,
                placeholder: t('editor.find'),
                value: find.query,
                onChange: (event) => setFind((current) => (current === null ? current : { ...current, query: event.target.value, index: 0 })),
                onKeyDown: (event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    moveTerminalSelection(emulatorRef.current, find, setFind, event.shiftKey ? -1 : 1);
                  } else if (event.key === 'Escape') {
                    event.preventDefault();
                    setFind(null);
                    emulatorRef.current?.focus();
                  }
                },
              }),
              React.createElement(
                'span',
                { style: styles.findCount },
                find.total === 0 ? t('editor.noMatches') : `${find.index + 1}/${find.total}`,
              ),
              React.createElement(ToolbarButton, {
                icon: 'chevronDown',
                label: t('editor.findNext'),
                onClick: () => moveTerminalSelection(emulatorRef.current, find, setFind, 1),
              }),
              React.createElement(ToolbarButton, {
                icon: 'chevronRight',
                label: t('editor.findPrevious'),
                onClick: () => moveTerminalSelection(emulatorRef.current, find, setFind, -1),
              }),
              React.createElement(
                'button',
                { type: 'button', style: styles.conflictAction, onClick: () => { setFind(null); emulatorRef.current?.focus(); } },
                '×',
              ),
            ),
        available
          ? React.createElement(
              'div',
              { style: { ...styles.terminalScreenArea, ...(splitId === null ? null : styles.terminalScreenSplit) } },
              React.createElement(
                'div',
                {
                  style: {
                    ...styles.terminalPane,
                    flex: splitId === null ? '1 1 0' : `0 0 ${splitPercent}%`,
                    /* IDEA outlines the pane that owns the caret. */
                    ...(splitId !== null && focusedPane === 'left' ? styles.terminalPaneFocused : null),
                  },
                  'data-dsh-terminal-pane-role': 'left',
                  onMouseDownCapture: () => focusPane('left'),
                  onDragOver: (event) => {
                    if (splitId === null) return;
                    event.preventDefault();
                    event.dataTransfer.dropEffect = 'move';
                  },
                  onDrop: (event) => {
                    event.preventDefault();
                    const source = event.dataTransfer?.getData('text/plain') ?? '';
                    if (source !== '') moveToPane(source, 'left');
                  },
                  onContextMenu: (event) => openScreenMenu(event, emulatorRef.current, active),
                },
                active === null
                  ? React.createElement(
                      React.Fragment,
                      null,
                      React.createElement(
                        'div',
                        { style: styles.terminalNotice },
                        React.createElement('span', null, busy ? t('editor.terminalStarting') : t('editor.terminalEmpty')),
                        React.createElement(
                          'button',
                          { type: 'button', style: styles.terminalAction, onClick: () => void createTerminal(), disabled: busy },
                          t('editor.terminalNew'),
                        ),
                      ),
                      /* No PTY yet, but the dock's grid is measurable: the first
                         shell must start at THIS width, not at a guessed 80 columns. */
                      React.createElement(MeasuringScreen, {
                        fontSize,
                        onGrid: reportGrid,
                      }),
                    )
                  : React.createElement(TerminalScreen, {
                      terminalId: activeId,
                      fontSize,
                      find,
                      getCwd: () => cwdRef.current,
                      /* Remember the grid a NEW shell should start at: a terminal
                         spawned narrower than its screen leaves zsh's PROMPT_SP `%`
                         marker on the row above the prompt. */
                      onGrid: reportGrid,
                      onError: (message) => setError(message),
                      onExit: (code) =>
                        setTerminals((current) =>
                          current.map((terminal) => (terminal.id === activeId ? { ...terminal, state: 'exited', exitCode: code } : terminal)),
                        ),
                      onEmulator: (emulator) => {
                        emulatorRef.current = emulator;
                      },
                      onInput: (data) => {
                        if (activeId !== null) void sendInput(activeId, data);
                      },
                      onTitle: (title) => {
                        const cleaned = title.trim();
                        if (activeId === null || cleaned === '') return;
                        void syncTerminalTitle(activeId, cleaned);
                      },
                      onCwd: (cwd) => {
                        if (activeId === null) return;
                        syncTerminalCwd(activeId, cwd);
                      },
                    }),
              ),
              splitId === null
                ? null
                : React.createElement(
                    'div',
                    {
                      style: { ...styles.terminalSplitHandle, cursor: splitDragging ? 'col-resize' : 'col-resize' },
                      title: t('editor.terminalSplitReset'),
                      /* Dragging is fiddly in a narrow dock; one gesture gets the
                         default ratio back, and it is persisted like a drag. */
                      onDoubleClick: () => {
                        setSplitPercent(50);
                        commitSplitPercent(50);
                      },
                      onMouseDown: (event) => {
                        event.preventDefault();
                        const area = event.currentTarget.parentElement;
                        if (area === null) return;
                        const total = area.getBoundingClientRect().width;
                        const startX = event.clientX;
                        const startPercent = splitPercent;
                        setSplitDragging(true);
                        const onMove = (moveEvent) => {
                          const delta = ((moveEvent.clientX - startX) / Math.max(1, total)) * 100;
                          /* Snap to the middle like IDEA's splitter, and clamp in one place. */
                          setSplitPercent(snapSplitPercent(startPercent + delta));
                        };
                        const onUp = () => {
                          setSplitDragging(false);
                          setSplitPercent((value) => {
                            commitSplitPercent(value);
                            return value;
                          });
                          window.removeEventListener('mousemove', onMove);
                          window.removeEventListener('mouseup', onUp);
                        };
                        window.addEventListener('mousemove', onMove);
                        window.addEventListener('mouseup', onUp);
                      },
                    },
                  ),
              splitTerminal === null
                ? null
                : React.createElement(
                    'div',
                    {
                      style: {
                        ...styles.terminalPane,
                        flex: '1 1 0',
                        ...(focusedPane === 'right' ? styles.terminalPaneFocused : null),
                      },
                      'data-dsh-terminal-pane-role': 'right',
                      onMouseDownCapture: () => focusPane('right'),
                      onDragOver: (event) => {
                        event.preventDefault();
                        event.dataTransfer.dropEffect = 'move';
                      },
                      onDrop: (event) => {
                        event.preventDefault();
                        const source = event.dataTransfer?.getData('text/plain') ?? '';
                        if (source !== '') moveToPane(source, 'right');
                      },
                      onContextMenu: (event) => openScreenMenu(event, splitEmulatorRef.current, splitTerminal),
                    },
                    /* IDEA lets the right pane follow any tab instead of the current one. */
                    React.createElement(
                      'div',
                      { style: styles.terminalPaneBar },
                      React.createElement(
                        'select',
                        {
                          style: styles.terminalPaneSelect,
                          value: splitId,
                          'aria-label': t('editor.terminalSplitPane'),
                          onChange: (event) => {
                            setSplitId(event.target.value);
                            focusPane('right');
                          },
                        },
                        terminals
                          .filter((terminal) => terminal.id !== activeId)
                          .map((terminal) => React.createElement('option', { key: terminal.id, value: terminal.id }, terminal.title)),
                      ),
                    ),
                    React.createElement(TerminalScreen, {
                      terminalId: splitId,
                      fontSize,
                      find,
                      getCwd: () => splitTerminal.cwd,
                      onGrid: reportGrid,
                      onError: (message) => setError(message),
                      onExit: (code) =>
                        setTerminals((current) =>
                          current.map((terminal) => (terminal.id === splitId ? { ...terminal, state: 'exited', exitCode: code } : terminal)),
                        ),
                      onEmulator: (emulator) => {
                        splitEmulatorRef.current = emulator;
                      },
                      onInput: (data) => {
                        if (splitId !== null) void sendInput(splitId, data);
                      },
                      onTitle: (title) => {
                        const cleaned = title.trim();
                        if (splitId === null || cleaned === '') return;
                        void syncTerminalTitle(splitId, cleaned);
                      },
                      onCwd: (cwd) => {
                        if (splitId === null) return;
                        syncTerminalCwd(splitId, cwd);
                      },
                    }),
                  ),
            )
          : React.createElement('div', { style: styles.terminalNotice }, t('editor.terminalUnavailable')),
        shellMenu === null ? null : React.createElement(ContextMenu, { menu: shellMenu, onClose: () => setShellMenu(null), t }),
        menu === null ? null : React.createElement(ContextMenu, { menu, onClose: () => setMenu(null), t }),
        /* No footer row: the cwd is already on the tab's tooltip and the PTY grid
           (`90×10`) is a diagnostic nobody reads. Both cost 20px of a short dock. */
        error === null
          ? null
          : React.createElement(
              'div',
              { style: styles.terminalStatusBar },
              React.createElement('span', { style: { color: 'var(--dsw-alias-state-error-primary)' } }, error),
            ),
      );
    }

    /** xterm palette derived from the live app tokens, so light/dark both read correctly. */
    function terminalTheme(node) {
      const style = getComputedStyle(node);
      const background = style.getPropertyValue('--dsw-alias-bg-base').trim() || (detectTheme() === 'vs-dark' ? '#1f1f1f' : '#ffffff');
      const foreground = style.getPropertyValue('--dsw-alias-label-primary').trim() || (detectTheme() === 'vs-dark' ? '#d4d4d4' : '#1f1f1f');
      return {
        background,
        foreground,
        cursor: foreground,
        cursorAccent: background,
        selectionBackground: style.getPropertyValue('--dsw-alias-interactive-bg-hover').trim() || 'rgba(127,127,127,0.35)',
      };
    }

    /**
     * Every occurrence offset of one plain-text query.
     * @param {string} text - haystack.
     * @param {string} query - needle; an empty query has no matches.
     * @returns {number[]} offsets.
     */
    function findMatches(text, query) {
      if (query === '') return [];
      const offsets = [];
      let index = text.indexOf(query);
      while (index >= 0) {
        offsets.push(index);
        index = text.indexOf(query, index + query.length);
      }
      return offsets;
    }

    /** Count occurrences of one plain-text query. */
    function countOccurrences(text, query) {
      return findMatches(text, query).length;
    }

    /**
     * Read the persisted expansion set for one workspace.
     * @param {string} root - absolute workspace root, used as the storage key.
     * @returns {string[]} workspace-relative directory paths.
     */
    function readExpanded(root) {
      if (root === '') return [];
      try {
        const raw = window.localStorage.getItem(`dsh-editor.expanded:${root}`);
        const parsed = raw === null ? null : JSON.parse(raw);
        return Array.isArray(parsed) ? parsed.filter((value) => typeof value === 'string' && value !== '') : [];
      } catch {
        return [];
      }
    }

    /**
     * Persist the expansion set for one workspace.
     * @param {string} root - absolute workspace root.
     * @param {Set<string>} expanded - workspace-relative directory paths.
     */
    function writeExpanded(root, expanded) {
      if (root === '') return;
      try {
        window.localStorage.setItem(`dsh-editor.expanded:${root}`, JSON.stringify([...expanded].filter((value) => value !== '')));
      } catch {
        /* a storage-less browser simply forgets the expansion */
      }
    }

    /**
     * The change-tree groups the user has collapsed in this workspace.
     *
     * IDEA remembers the fold state of its change tree; without it every refresh
     * (and every commit) re-expands the groups the user folded away.
     * @param {string} root - workspace root, used as part of the key.
     * @returns {Set<string>} collapse keys (`<group>:<directory path>`).
     */
    function readCollapsedGroups(root) {
      try {
        const raw = window.localStorage.getItem(`dsh-editor.collapsedGroups:${root}`);
        if (raw === null || raw === '') return new Set();
        const parsed = JSON.parse(raw);
        /* Storage is user-writable and survives upgrades: keep only strings. */
        return Array.isArray(parsed) ? new Set(parsed.filter((entry) => typeof entry === 'string')) : new Set();
      } catch {
        return new Set();
      }
    }

    /**
     * Persist the change-tree fold state for one workspace.
     * @param {string} root - workspace root.
     * @param {Set<string>} collapsed - collapse keys currently folded.
     * @returns {void}
     */
    function writeCollapsedGroups(root, collapsed) {
      if (root === '') return;
      try {
        window.localStorage.setItem(`dsh-editor.collapsedGroups:${root}`, JSON.stringify([...collapsed]));
      } catch {
        /* a storage-less browser simply forgets the fold state */
      }
    }

    /** Read a persisted number with a safe fallback. */
    function readStoredNumber(key, fallback) {
      try {
        const raw = window.localStorage.getItem(key);
        const value = raw === null ? NaN : Number(raw);
        return Number.isFinite(value) ? value : fallback;
      } catch {
        return fallback;
      }
    }

    /**
     * Read one persisted string preference.
     * @param {string} key - storage key.
     * @param {string} fallback - value used when nothing usable is stored.
     * @returns {string} stored value or the fallback.
     */
    function readStoredText(key, fallback) {
      try {
        const raw = window.localStorage.getItem(key);
        return raw === null || raw === '' ? fallback : raw;
      } catch {
        return fallback;
      }
    }

    /**
     * The files this workspace opened most recently, newest first.
     *
     * IDEA's ⌘E lists what you have actually been in, not every file in the tree:
     * a Go-to-File query only helps if you remember the path, and the point of
     * Recent Files is that you remember the file. Stored per workspace so two
     * projects do not pollute each other's lists.
     * @param {string} root - absolute workspace root.
     * @returns {string[]} workspace-relative paths, newest first.
     */
    function readRecentFiles(root) {
      if (root === '') return [];
      try {
        const raw = window.localStorage.getItem(`dsh-editor.recent:${root}`);
        const parsed = raw === null ? null : JSON.parse(raw);
        return Array.isArray(parsed) ? parsed.filter((value) => typeof value === 'string' && value !== '').slice(0, 30) : [];
      } catch {
        return [];
      }
    }

    /**
     * Persist the recent-file list for one workspace.
     * @param {string} root - absolute workspace root.
     * @param {string[]} list - workspace-relative paths, newest first.
     * @returns {void}
     */
    function writeRecentFiles(root, list) {
      if (root === '') return;
      try {
        window.localStorage.setItem(`dsh-editor.recent:${root}`, JSON.stringify(list.slice(0, 30)));
      } catch {
        /* a storage-less browser simply forgets the list */
      }
    }

    /**
     * Move one path to the head of a recent list (IDEA's MRU semantics).
     *
     * Re-opening a file that is already in the list must MOVE it, not duplicate
     * it, or the list grows one entry per visit and the most useful (newest)
     * position stops meaning anything.
     * @param {string[]} list - current list, newest first.
     * @param {string} path - path just opened.
     * @param {number} limit - maximum entries retained.
     * @returns {string[]} the new list, or the same array when nothing changed.
     */
    function pushRecent(list, path, limit = 30) {
      if (typeof path !== 'string' || path === '') return Array.isArray(list) ? list : [];
      const current = Array.isArray(list) ? list : [];
      if (current[0] === path) return current;
      return [path, ...current.filter((entry) => entry !== path)].slice(0, Math.max(1, limit));
    }

    /**
     * Which terminals live in the editor area rather than the dock.
     *
     * Only the IDS are remembered: the PTY itself belongs to the host and
     * survives either way, so a reload has to know which tab to render where,
     * not how to rebuild a shell. Stored per Session, like the tab profile.
     * @returns {string[]} terminal ids currently moved into the editor.
     */
    function readEditorTerminals() {
      try {
        const raw = window.localStorage.getItem(`dsh-editor.terminal.editor:${currentSessionId()}`);
        const parsed = raw === null ? null : JSON.parse(raw);
        return Array.isArray(parsed) ? parsed.filter((value) => typeof value === 'string' && value !== '') : [];
      } catch {
        return [];
      }
    }

    /**
     * Persist the set of terminals living in the editor area.
     * @param {string[]} ids - terminal ids.
     * @returns {void}
     */
    function writeEditorTerminals(ids) {
      try {
        window.localStorage.setItem(`dsh-editor.terminal.editor:${currentSessionId()}`, JSON.stringify(ids.filter((value) => typeof value === 'string' && value !== '')));
      } catch {
        /* a storage-less browser keeps the in-memory placement */
      }
    }

    /** Cycle 11 → 12 → 13 → 14 → 11 pt and persist the choice. */
    function storeFontSize(current) {
      const sizes = [11, 12, 13, 14];
      const next = sizes[(sizes.indexOf(current) + 1) % sizes.length];
      try {
        window.localStorage.setItem('dsh-editor.terminal.fontSize', String(next));
      } catch {
        /* a storage-less browser still gets the in-memory size */
      }
      return next;
    }

    /** Call the host terminal API. */
    async function callTerminal(payload) {
      const sessionId = currentSessionId();
      if (sessionId === '') throw new Error('no active Session');
      const response = await fetch('api/dsh-editor/terminal', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sessionId, ...payload }),
      });
      if (!response.ok) throw new Error(`terminal API HTTP ${response.status}`);
      const data = await response.json();
      if (data?.ok !== true) throw new Error(data?.error?.message ?? 'terminal API failed');
      return data.value;
    }

    /**
     * Read the in-progress commit message for one workspace.
     *
     * The draft is separate from the history: the history is what was committed,
     * the draft is what the user is still typing. Losing it on a Refresh or a
     * panel toggle is the one thing IDEA's message box never does.
     * @param {string} root - workspace root used as the storage key.
     * @returns {string} stored draft, or '' when none.
     */
    function readCommitDraft(root) {
      if (typeof root !== 'string' || root === '') return '';
      try {
        return window.localStorage.getItem(`dsh-editor.commitDraft:${root}`) ?? '';
      } catch {
        return '';
      }
    }

    /**
     * Persist (or clear) the draft for one workspace.
     * @param {string} root - workspace root used as the storage key.
     * @param {string} text - current message text.
     * @returns {void}
     */
    function writeCommitDraft(root, text) {
      if (typeof root !== 'string' || root === '') return;
      try {
        if (typeof text === 'string' && text !== '') window.localStorage.setItem(`dsh-editor.commitDraft:${root}`, text);
        else window.localStorage.removeItem(`dsh-editor.commitDraft:${root}`);
      } catch {
        /* a storage-less browser keeps the draft in memory only */
      }
    }

    /**
     * A cheap identity for one directory listing.
     *
     * The tree is refreshed from several places (the toolbar, a file operation,
     * the external-change watcher). Handing React a brand-new array every time
     * makes it re-render every row even when nothing changed, which is visible as
     * a flicker. Comparing this fingerprint first lets the caller keep the array
     * React already has, so an unchanged listing costs no render at all.
     * @param {object[]} entries - directory listing.
     * @returns {string} length-differentiated fingerprint.
     */
    function directorySignature(entries) {
      const list = Array.isArray(entries) ? entries : [];
      return list
        .map((entry) => `${entry?.path ?? ''}\u0001${entry?.kind ?? ''}\u0001${entry?.mtime ?? ''}\u0001${entry?.size ?? ''}`)
        .join('\u0002');
    }

    /**
     * Pick the array to hand to React for one directory listing.
     *
     * Returns the PREVIOUS array when the new listing is identical: same entries,
     * same order. React then sees the same reference and skips the subtree, which
     * is what stops the tree from flashing each time the panel is shown or the
     * watcher re-reads an untouched directory.
     * @param {object[]|undefined} previous - array currently in state, if any.
     * @param {object[]} next - freshly read listing.
     * @returns {object[]} previous when nothing changed, else `next`.
     */
    function keepUnchangedListing(previous, next) {
      if (Array.isArray(previous) && directorySignature(previous) === directorySignature(next)) return previous;
      return next;
    }

    /**
     * Every file path in a root listing, as a flat set.
     *
     * `refreshTree` only reloads the root, so this intentionally covers exactly
     * what "appeared at the root" means; deeper new files surface when their
     * parent directory is refreshed.
     * @param {object[]} entries - root listing.
     * @returns {string[]} file paths.
     */
    function collectFilePaths(entries) {
      return (Array.isArray(entries) ? entries : []).filter((entry) => entry?.kind === 'file' && typeof entry.path === 'string').map((entry) => entry.path);
    }

    /**
     * Read the remembered shell tabs for this Session.
     *
     * Only `shell` + `cwd` are trusted: the stored JSON is user-visible local
     * state, so anything malformed is dropped rather than handed to the host as
     * a `shellPath`.
     * @returns {Array<{shell: string, cwd: string, title: string}>} usable entries.
     */
    /** IDEA's terminal tab colours, cycled in order. */
    const TERMINAL_COLORS = ['#cf222e', '#bf8700', '#1a7f37', '#2f65ca', '#8250df', '#1b7c83'];

    /**
     * Read the colour assigned to each terminal tab of this Session.
     *
     * Colours are a view preference, so they live in the browser rather than on
     * the host: the host's terminal list stays a pure process description.
     * @returns {Record<string, string>} terminal id → CSS colour.
     */
    function readTerminalColors() {
      try {
        const raw = window.localStorage.getItem(`dsh-editor.terminal.colors:${currentSessionId()}`);
        const parsed = raw === null ? null : JSON.parse(raw);
        if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
        const colours = {};
        for (const [id, colour] of Object.entries(parsed)) {
          if (typeof id === 'string' && typeof colour === 'string' && TERMINAL_COLORS.includes(colour)) colours[id] = colour;
        }
        return colours;
      } catch {
        return {};
      }
    }

    /**
     * Persist the tab colour map for this Session.
     * @param {Record<string, string>} colours - terminal id → CSS colour.
     * @returns {void}
     */
    function writeTerminalColors(colours) {
      try {
        window.localStorage.setItem(`dsh-editor.terminal.colors:${currentSessionId()}`, JSON.stringify(colours));
      } catch {
        /* a storage-less browser keeps colours for this mount only */
      }
    }

    /**
     * Read the recently closed terminals for this Session.
     *
     * Same trust rules as the open-tab profile: the JSON is local state, so only
     * well-formed `{shell, cwd}` entries survive.
     * @returns {Array<{shell: string, cwd: string, title: string}>} usable entries, newest first.
     */
    function readClosedTerminals() {
      try {
        const raw = window.localStorage.getItem(`dsh-editor.terminal.closed:${currentSessionId()}`);
        if (raw === null || raw === '') return [];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed
          .filter((entry) => entry !== null && typeof entry === 'object' && typeof entry.shell === 'string' && entry.shell !== '')
          .map((entry) => ({ shell: entry.shell, cwd: typeof entry.cwd === 'string' ? entry.cwd : '', title: typeof entry.title === 'string' ? entry.title : '' }))
          .slice(0, 8);
      } catch {
        return [];
      }
    }

    function readTerminalProfile() {
      try {
        const raw = window.localStorage.getItem(`dsh-editor.terminal.profile:${currentSessionId()}`);
        if (raw === null || raw === '') return [];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed
          .filter((entry) => entry !== null && typeof entry === 'object' && typeof entry.shell === 'string' && entry.shell !== '')
          .map((entry) => ({ shell: entry.shell, cwd: typeof entry.cwd === 'string' ? entry.cwd : '', title: typeof entry.title === 'string' ? entry.title : '' }))
          .slice(0, 4);
      } catch {
        return [];
      }
    }

    /** Flatten the expanded tree into the single row list used by the tree and keyboard navigation. */
    function flattenRows(entries, children, expanded, projectName, root) {
      const rows = [{ name: projectName, path: '', kind: 'directory', root: true, depth: 0 }];
      if (!expanded.has('')) return rows;
      /**
       * Append one listing, inserting IDEA's "(empty)" placeholder for an expanded
       * directory with no children. Without it an empty folder looks identical to
       * one still loading, which reads as a bug.
       */
      const append = (list, depth, ancestors = []) => {
        list.forEach((entry, index) => {
          const last = index === list.length - 1;
          /* `continues[d]` = "the ancestor at depth d has another sibling below", which
             is what tells the renderer to draw that column's line in this row. */
          const continues = continuationFlags([...ancestors, last]);
          rows.push({ ...entry, depth, continues });
          if (entry.kind === 'directory' && expanded.has(entry.path)) {
            const kids = children[entry.path];
            if (kids === undefined) return;
            if (kids.length === 0) {
              rows.push({ name: '', path: `${entry.path}::empty`, kind: 'placeholder', depth: depth + 1, empty: true, continues: continuationFlags([...ancestors, last, true]) });
            } else {
              append(kids, depth + 1, [...ancestors, last]);
            }
          }
        });
      };
      append(entries, 1);
      /* The root itself can be empty (a bare workspace). */
      if (rows.length === 1) rows.push({ name: '', path: '::empty', kind: 'placeholder', depth: 1, empty: true, continues: [false] });
      return rows;
    }

    /**
     * One sentence describing a batch move: what moved, and what was refused.
     *
     * A drag that moves three files and refuses the fourth must not report only
     * the refusal — the tree looks different afterwards, and "already exists"
     * alone reads as if nothing happened. The wording comes from the plugin's own
     * translator (NOT `navigator.language`: the UI language is a plugin
     * preference, and the two disagree on a zh UI with an en-US browser).
     * @param {string[]} moved - destinations that were written.
     * @param {string} conflict - destination that was refused.
     * @param {(key: string, params?: object) => string} t - plugin translator.
     * @returns {string} the notice text.
     */
    function describeMoved(moved, conflict, t) {
      const done = Array.isArray(moved) ? moved.filter((path) => typeof path === 'string' && path !== '') : [];
      const blocked = typeof conflict === 'string' ? conflict : '';
      if (done.length === 0) return t('editor.moveConflict', { path: blocked });
      return t('editor.movePartial', { moved: done.join(', '), path: blocked });
    }

    /**
     * Replace a host error's bare English with a localised sentence.
     *
     * The file API answers in plain English (`path does not exist`), which reached a
     * Chinese UI verbatim. Only the two known machine messages are translated — every
     * other failure already carries its own context (a git error, a JSON parse hint)
     * and rewriting it would lose that.
     * @param {string} message - error text from the host.
     * @param {Function} translate - the plugin's translator.
     * @param {string} path - the path the action was about.
     * @returns {string} the text to show.
     */
    function hostErrorText(message, translate, path) {
      if (typeof message !== 'string' || message === '') return typeof message === 'string' ? message : '';
      if (message === 'path does not exist') return translate('editor.pathMissing', { path: String(path) });
      if (message === 'path escapes the workspace') return translate('editor.pathOutsideWorkspace');
      return message;
    }

    /**
     * Which diff hunk a line belongs to, for the diff toolbar's `n/total` label.
     *
     * IDEA labels the diff gutter `2/7` and its `⌥⌘↓` walks the hunks; Monaco's
     * `goToDiff` moves the widget but says nothing about where it landed, so the
     * index has to be derived from the same line-changes list the widget uses.
     * A mapping's modified range is half-open at the end, and an empty (pure
     * deletion) range still occupies the line it was removed at.
     * @param {{modifiedStartLineNumber?: number, modifiedEndLineNumber?: number}[]|null} changes - `getLineChanges()` output.
     * @param {number} line - 1-based line in the modified model.
     * @returns {{index: number, total: number}} 1-based hunk index (0 when outside every hunk).
     */
    function hunkAt(changes, line) {
      const list = Array.isArray(changes) ? changes : [];
      const total = list.length;
      const target = Number(line);
      if (!Number.isFinite(target) || total === 0) return { index: 0, total };
      for (let index = 0; index < total; index += 1) {
        const start = Number(list[index]?.modifiedStartLineNumber ?? 0);
        const end = Number(list[index]?.modifiedEndLineNumber ?? start);
        if (target >= start && target <= Math.max(start, end)) return { index: index + 1, total };
      }
      /* Between hunks: report the hunk just above, the way a gutter would. */
      let above = 0;
      for (let index = 0; index < total; index += 1) {
        if (Number(list[index]?.modifiedStartLineNumber ?? 0) <= target) above = index + 1;
      }
      return { index: above, total };
    }

    /**
     * What pressing Enter on a speed-search hit should do.
     *
     * `onToggle` CLOSES an expanded folder, so pressing Enter to jump to a directory
     * that was already open collapsed it — the opposite of "take me there". A file is
     * always opened; a folder is expanded only when it is closed.
     * @param {{kind?: string, open?: boolean}|null} hit - the matched row.
     * @returns {'open'|'expand'|'keep'|'none'} the action to take.
     */
    function revealInTree(hit) {
      if (hit === null || hit === undefined) return 'none';
      if (hit.kind === 'file') return 'open';
      if (hit.kind === 'directory') {
        /* `open` must be passed in: the row itself carries no such field, so reading
           `hit.open` always looked like "closed" and Enter re-expanded (or, before
           round 134, toggled) a folder that was already open. */
        return hit.open === true ? 'keep' : 'expand';
      }
      return 'none';
    }

    /**
     * What one indent column draws in a row: a full line, an elbow, or nothing.
     *
     * The LAST child of a subtree gets IDEA's corner (└): the line stops there and a
     * short horizontal arm points at the row. A plain gap reads as a rendering hole,
     * and a full line makes the next subtree look like a child of this one.
     * @param {{continues: boolean[], index: number, depth: number}} state - per-depth flags, the column, the row's depth.
     * @returns {'line'|'corner'|'none'} what to draw in that column.
     */
    function guideKind(state) {
      if (state === null || state === undefined) return 'none';
      const continues = Array.isArray(state.continues) ? state.continues : [];
      const index = Number(state.index);
      const depth = Number(state.depth);
      if (!Number.isFinite(index) || index < 0) return 'none';
      /* Only the deepest column can elbow: shallower ones belong to the ancestors. */
      if (index === depth - 1 && continues[index] === false) return 'corner';
      return continues[index] === false ? 'none' : 'line';
    }

    /**
     * Which indent columns still have something below them.
     *
     * IDEA draws one vertical line per ancestor, and the line under the LAST child of
     * a subtree stops at that row. Passing the flags straight through keeps the rule
     * in one place and lets the renderer stay a plain map.
     * @param {boolean[]} isLast - per depth, whether that ancestor has no sibling below.
     * @returns {boolean[]} per depth, whether the column's line continues.
     */
    function continuationFlags(isLast) {
      if (!Array.isArray(isLast)) return [];
      return isLast.map((last) => last !== true);
    }

    /**
     * The colour a tree row's name takes, detached from any letter.
     *
     * IDEA's tree has NO git letters: the "M" in its screenshots is the Markdown
     * file icon. A changed file or folder is shown by tinting its name, so the row
     * keeps a stable indent and the icon column stays aligned.
     * @param {{status?: string, selected?: boolean}|null} state - the row's porcelain status and selection.
     * @returns {string|null} a CSS colour, or null for "keep the default".
     */
    function treeNameColor(state) {
      if (state === null || state === undefined) return null;
      if (state.selected === true) return '#fff';
      const status = typeof state.status === 'string' ? state.status : '';
      if (status === '') return null;
      const info = gitStatusInfo(status);
      return info === null ? null : info.color;
    }

    /**
     * The colour a changed folder's name takes, with no letter.
     *
     * IDEA stamps M/A/D on FILES and only tints a folder whose contents changed: a
     * letter on a folder reads like the folder itself was modified, and it also
     * shifted every child row's icon. Precedence is conflict > deleted > added >
     * renamed > modified, and an all-untracked folder is grey.
     * @param {{path: string, status: string}[]|null} changes - changes inside the folder.
     * @returns {{color: string}|null} the tint, or null when the folder is clean.
     */
    function directoryTint(changes) {
      const inside = Array.isArray(changes) ? changes : [];
      if (inside.length === 0) return null;
      if (inside.some((change) => change.status === 'UU' || change.status === 'AA' || change.status === 'DD' || change.status === 'AU' || change.status === 'UA' || change.status === 'DU' || change.status === 'UD')) {
        return { color: '#cf222e' };
      }
      if (inside.every((change) => change.status === '??')) return { color: '#6e7781' };
      if (inside.some((change) => change.status.includes('D'))) return { color: '#cf222e' };
      if (inside.some((change) => change.status[0] === 'A')) return { color: '#1a7f37' };
      if (inside.some((change) => change.status.includes('R'))) return { color: '#8250df' };
      return { color: '#2f65ca' };
    }

    /**
     * The label a branch chip shows, detached HEAD included.
     *
     * `git rev-parse --abbrev-ref HEAD` answers the literal string "HEAD" when the
     * repository is detached, so the chip read "HEAD" — indistinguishable from a
     * branch of that name. IDEA labels the state instead.
     * @param {{branch?: string, detached?: boolean, hash?: string}|null} git - status payload.
     * @returns {string} the chip text, or '' when there is nothing to show.
     */
    function branchLabel(git) {
      if (git === null || git === undefined) return '';
      const branch = typeof git.branch === 'string' ? git.branch.trim() : '';
      if (git.detached === true) {
        const hash = typeof git.hash === 'string' ? git.hash.trim() : '';
        const short = hash === '' ? '' : hash.slice(0, 7);
        return short === '' ? 'detached HEAD' : `detached at ${short}`;
      }
      /* A repo with no commits answers "HEAD" too; treat it as no branch. */
      return branch === 'HEAD' ? '' : branch;
    }

    /**
     * Turn an OSC 7 payload into the working directory it reports.
     *
     * Shells print `ESC ] 7 ; file://host/path ST` after each prompt; xterm hands the
     * middleware the part after `7;`. That is the only way to follow `cd` — the PTY
     * handle exposes no pid and the host never asks the shell for its directory — so
     * the menu actions ("copy directory path", "reveal", "open README") can point at
     * where the user actually is rather than where the tab was created.
     * @param {string} payload - the OSC 7 payload.
     * @returns {string|null} the absolute path, or null when it is not a file URL.
     */
    function cwdFromOsc7(payload) {
      if (typeof payload !== 'string') return null;
      const match = /^file:\/\/[^/]*(\/.*)$/.exec(payload.trim());
      if (match === null) return null;
      try {
        return decodeURIComponent(match[1]);
      } catch {
        /* A malformed escape keeps the raw path rather than dropping the report. */
        return match[1];
      }
    }

    /**
     * Find the README in a directory listing, relative to that directory.
     *
     * IDEA's terminal menu opens the directory's README so a shell in another package
     * does not force the user back to the tree. Matching ignores case because the file
     * is spelled README.md / readme.md / Readme.md by different projects, and a
     * missing README must yield null so the menu item can be disabled instead of
     * opening a path that is not there.
     * @param {string[]} names - entries in the directory (basenames).
     * @param {string} directory - workspace-relative directory the shell is in.
     * @returns {string|null} the workspace-relative README path, or null.
     */
    function readmeInDirectory(names, directory) {
      if (!Array.isArray(names)) return null;
      const match = names.find((name) => typeof name === 'string' && /^readme(\.(md|markdown|txt|rst))?$/i.test(name));
      if (match === undefined) return null;
      const base = typeof directory === 'string' ? directory.replace(/^\/+|\/+$/g, '') : '';
      return base === '' ? match : `${base}/${match}`;
    }

    /**
     * IDEA's in-tree typeahead: pick the row a typed prefix lands on.
     *
     * Different from ⌘F speed search: no box opens, nothing filters, and the
     * search wraps around the list — you type `gr` and the selection jumps to
     * `graph.ts`, then `gr` again continues to the next match. Matching is a
     * prefix test on the name (IDEA does not match the middle of a name here).
     * @param {{name: string, path: string, kind: string}[]} rows - flattened rows in display order.
     * @param {string} buffer - the characters typed so far.
     * @param {string|null} fromPath - currently selected path (search starts here).
     * @param {boolean} advance - true to start AFTER `fromPath` (cycling repeats).
     * @returns {string|null} the path to select, or null when nothing matches.
     */
    function typeaheadMatch(rows, buffer, fromPath, advance) {
      const needle = typeof buffer === 'string' ? buffer.trim().toLowerCase() : '';
      if (needle === '') return null;
      const list = Array.isArray(rows) ? rows.filter((row) => row.kind !== 'placeholder' && typeof row.name === 'string') : [];
      if (list.length === 0) return null;
      const start = list.findIndex((row) => row.path === fromPath);
      /* `advance` steps past the current row; a fresh prefix may hit it again. */
      const from = start < 0 ? 0 : advance ? start + 1 : start;
      for (let step = 0; step < list.length; step += 1) {
        const row = list[(from + step) % list.length];
        if (row.name.toLowerCase().startsWith(needle)) return row.path;
      }
      return null;
    }

    /**
     * Fold one keystroke into the typeahead prefix and resolve what to select.
     *
     * Three rules, in this order:
     * 1. A fresh keystroke (or a pause past {@link TYPEAHEAD_RESET_MS}) starts a
     *    new prefix and may land on the row already selected.
     * 2. Otherwise the prefix grows — and growing must NOT skip the current row:
     *    typing `g` then `r` has to stay on `graph.ts`. Searching strictly after
     *    the selection sent `gr` to `grid.ts`, i.e. the selection ran away from
     *    the file being narrowed down.
     * 3. Repeating the LAST character cycles to the next match (`g` `g`, `gr` `r`),
     *    which is the classic typeahead gesture. A dead-end prefix that is not a
     *    repeat restarts from the new character, so `g` `x` `r` still finds
     *    `readme.md` instead of staying stuck on `gx`.
     * @param {{rows: object[], buffer: string, path: string|null, key: string, now: number, lastAt: number}} input - one keystroke's context.
     * @returns {{buffer: string, at: number, hit: string|null}} the next typeahead state.
     */
    function typeaheadStep(input) {
      const key = typeof input?.key === 'string' ? input.key : '';
      const rows = Array.isArray(input?.rows) ? input.rows : [];
      const previous = typeof input?.buffer === 'string' ? input.buffer : '';
      const path = input?.path ?? null;
      const now = Number(input?.now ?? 0);
      const lastAt = Number(input?.lastAt);
      const fresh = previous === '' || !Number.isFinite(lastAt) || now - lastAt > TYPEAHEAD_RESET_MS;
      if (fresh) return { buffer: key, at: now, hit: typeaheadMatch(rows, key, path, false) };
      /* Rule 3 first: "same letters again" means next match, not "grr". */
      if (key !== '' && key.toLowerCase() === previous.slice(-1).toLowerCase()) {
        return { buffer: previous, at: now, hit: typeaheadMatch(rows, previous, path, true) };
      }
      const grown = previous + key;
      const hit = typeaheadMatch(rows, grown, path, false);
      if (hit !== null) return { buffer: grown, at: now, hit };
      /* Dead end: restart from this one character rather than bury the key in `gx`. */
      const restarted = typeaheadMatch(rows, key, path, false);
      return { buffer: restarted === null ? '' : key, at: now, hit: restarted };
    }

    /**
     * Whether a speed search found nothing.
     *
     * `filterTreeRows` always keeps the root row (so the tree still has a frame), which
     * means "no hits" looks like exactly one row — the old `rows.length <= 1` test was a
     * proxy for that. Counting the non-root rows says what it means, and keeps working
     * if the root is ever filtered differently.
     * @param {{query: string, rows: {path: string}[]}|null} state - the query and the filtered rows.
     * @returns {boolean} true when the query is non-empty and nothing but the root matched.
     */
    function treeSearchMiss(state) {
      if (state === null || state === undefined) return false;
      const query = typeof state.query === 'string' ? state.query.trim() : '';
      if (query === '') return false;
      const rows = Array.isArray(state.rows) ? state.rows : [];
      return rows.every((row) => row === null || row === undefined || row.path === '');
    }

    /**
     * Summarise one completed drag so the tree can report it.
     *
     * A successful move used to be completely silent: five files disappeared from one
     * folder and appeared in another with no acknowledgement, which reads the same as
     * a drag that did nothing. The count is what makes the outcome visible.
     * @param {{moved: string[], conflicts: {to: string}[], target: string}|null} plan - what the move produced.
     * @returns {{done: number, target: string, blocked?: string}|null} the summary.
     */
    function describeMoveResult(plan) {
      if (plan === null || plan === undefined) return null;
      const moved = Array.isArray(plan.moved) ? plan.moved.filter((path) => typeof path === 'string' && path !== '') : [];
      const target = typeof plan.target === 'string' ? plan.target : '';
      const blocked = Array.isArray(plan.conflicts) && plan.conflicts.length > 0 ? plan.conflicts[0]?.to : undefined;
      const summary = { done: moved.length, target };
      if (typeof blocked === 'string' && blocked !== '') summary.blocked = blocked;
      return summary;
    }

    /**
     * Turn one drag's sources into an ordered, all-or-nothing move plan.
     *
     * The previous implementation renamed inside the loop, so the second entry's
     * "already exists" error surfaced after the first entry had already moved —
     * a drag could leave the tree half-applied. Planning first means the caller
     * can refuse the whole batch, or run exactly the moves that are safe, and the
     * conflict it reports names the exact destination (IDEA's wording).
     * @param {string[]} sources - dragged workspace-relative paths.
     * @param {string} targetDirectory - directory dropped onto ('' for the root).
     * @param {Set<string>} existing - every path that currently exists, including directories.
     * @returns {{moves: object[], conflicts: object[], intoSelf: string[], unchanged: string[]}} the plan.
     */
    function planMoves(sources, targetDirectory, existing) {
      const taken = existing instanceof Set ? existing : new Set();
      const target = typeof targetDirectory === 'string' ? targetDirectory : '';
      const plan = { moves: [], conflicts: [], intoSelf: [], unchanged: [] };
      const seen = new Set();
      const unique = [];
      for (const source of Array.isArray(sources) ? sources : []) {
        if (typeof source !== 'string' || source === '' || seen.has(source)) continue;
        seen.add(source);
        unique.push(source);
      }
      /* Moves land in one directory, so a duplicate basename inside the batch
         collides with itself before the filesystem is ever touched. */
      const destinations = new Set();
      for (const source of unique) {
        if (target === source || target.startsWith(`${source}/`)) {
          plan.intoSelf.push(source);
          continue;
        }
        const name = basename(source);
        const to = target === '' ? name : `${target}/${name}`;
        if (to === source) {
          plan.unchanged.push(source);
          continue;
        }
        if (destinations.has(to)) {
          plan.conflicts.push({ from: source, to, reason: 'duplicate' });
          continue;
        }
        if (taken.has(to)) {
          plan.conflicts.push({ from: source, to, reason: 'exists' });
          continue;
        }
        destinations.add(to);
        plan.moves.push({ from: source, to });
      }
      return plan;
    }

    /**
     * Split a tree label into plain and matched runs for IDEA's speed-search highlight.
     *
     * The whole row must not be tinted: a long path would be unreadable, and the
     * user needs to see WHICH characters matched. Matching is case-insensitive
     * but the returned text keeps the original casing. Every occurrence is
     * marked, so `a/a.ts` searching `a` lights up both.
     * @param {string} name - the label as rendered.
     * @param {string} query - typed search text.
     * @returns {Array<{text: string, match: boolean}>} runs to render in order.
     */
    function highlightParts(name, query) {
      const text = typeof name === 'string' ? name : '';
      const needle = typeof query === 'string' ? query.trim() : '';
      if (text === '') return [];
      if (needle === '') return [{ text, match: false }];
      const lower = text.toLowerCase();
      const target = needle.toLowerCase();
      const parts = [];
      let cursor = 0;
      for (;;) {
        const at = lower.indexOf(target, cursor);
        if (at < 0) break;
        if (at > cursor) parts.push({ text: text.slice(cursor, at), match: false });
        parts.push({ text: text.slice(at, at + target.length), match: true });
        cursor = at + target.length;
      }
      if (cursor < text.length) parts.push({ text: text.slice(cursor), match: false });
      return parts.length === 0 ? [{ text, match: false }] : parts;
    }

    /**
     * Keep only the rows matching a speed-search query, plus the directories above them.
     *
     * IDEA's Project search filters in place instead of opening a dialog, and a
     * match is only useful when its parent path is still visible — so every
     * ancestor of a hit is retained even though it does not match itself.
     * @param {object[]} rows - flattened tree rows, root first.
     * @param {string} query - case-insensitive substring of the entry name.
     * @returns {object[]} rows to render; the root row is always kept.
     */
    function filterTreeRows(rows, query) {
      const needle = query.trim().toLowerCase();
      if (needle === '') return rows;
      const keep = new Set();
      for (const row of rows) {
        if (row.path === '' || row.name.toLowerCase().includes(needle)) keep.add(row.path);
      }
      /* Retain ancestors so a deep hit is still reachable in the tree. */
      for (const path of [...keep]) {
        let parent = path;
        while (parent !== '') {
          parent = parent.includes('/') ? parent.slice(0, parent.lastIndexOf('/')) : '';
          keep.add(parent);
        }
      }
      /* "(empty)" describes the directory as it exists on disk — under a query it
         would claim the matched folder has no children, which is the opposite of
         what the hit means. */
      return rows.filter((row) => keep.has(row.path) && row.kind !== 'placeholder');
    }

    /** The editor workspace: activity stripe, Project/Commit/Terminal panels, tabs, Monaco. */
    function EditorWorkspace({ t }) {
      const [monacoReady, setMonacoReady] = React.useState(false);
      const [monacoError, setMonacoError] = React.useState(null);
      const [root, setRoot] = React.useState('');
      const [home, setHome] = React.useState('');
      const [entries, setEntries] = React.useState([]);
      const [children, setChildren] = React.useState({});
      const [expanded, setExpanded] = React.useState(() => new Set(['']));
      /* Restored once the workspace root is known, so keys can include it. */
      const expandedRestoredRef = React.useRef('');
      /* IDEA's project tree is multi-select: one primary row plus shift/⌘ extended rows. */
      const [selectedPath, setSelectedPathRaw] = React.useState(null);
      const [selection, setSelection] = React.useState(() => new Set());
      const selectionAnchor = React.useRef(null);
      const setSelectedPath = React.useCallback((next) => {
        setSelectedPathRaw(next);
        setSelection(next === null ? new Set() : new Set([next]));
        selectionAnchor.current = next;
      }, []);
      /**
       * Drop the whole selection (IDEA clears it when you click the tree's background).
       *
       * The anchor is reset too: leaving it behind makes the next Shift+click
       * extend from a row the user can no longer see highlighted.
       * @returns {void}
       */
      const clearTreeSelection = React.useCallback(() => {
        setSelectedPathRaw(null);
        setSelection(new Set());
        selectionAnchor.current = null;
      }, []);
      const [treeLoading, setTreeLoading] = React.useState(true);
      /* The flattened rows as of the last render, so the loader can decide whether a
         refresh needs a visible placeholder. */
      const rowsRef = React.useRef([]);
      /* A workspace switch must show the placeholder again: the previous root's rows
         are irrelevant to the new one. */
      const treeRootRef = React.useRef('');
      const [treeError, setTreeError] = React.useState(null);
      const [activity, setActivity] = React.useState('project');
      const [panelVisible, setPanelVisible] = React.useState(true);
      /* IDEA keeps one width per tool window; Commit needs far more room than Project. */
      const [toolWidths, setToolWidths] = React.useState({ project: 26, commit: 52 });
      const [sideDragging, setSideDragging] = React.useState(false);
      /* IDEA keeps the terminal in its own bottom dock, toggled by Alt+F12. */
      const [terminalOpen, setTerminalOpen] = React.useState(false);
      const [terminalHeight, setTerminalHeight] = React.useState(220);
      const [dockDragging, setDockDragging] = React.useState(false);
      const [terminalGeneration, setTerminalGeneration] = React.useState(0);
      /* Terminals living in the EDITOR area (IDEA's Move to Editor). The PTY is
         owned by the host, so only the description is needed here to render a
         second view onto the same shell. */
      const [editorTerminals, setEditorTerminals] = React.useState([]);
      /**
       * Rebuild the editor-area terminals after a reload.
       *
       * The dock reports what it moved, but a reload starts with the dock closed,
       * so nothing reports and the stored id renders nowhere. The PTY itself
       * survives in the host, so asking it for the list is enough: the placement
       * is remembered, the process was never ours to restart.
       * @returns {void}
       */
      React.useEffect(() => {
        const remembered = readEditorTerminals();
        if (remembered.length === 0) return;
        let cancelled = false;
        callTerminal({ op: 'list' })
          .then((value) => {
            if (cancelled) return;
            const listed = Array.isArray(value?.terminals) ? value.terminals : [];
            /* Only ids the host still holds: a terminal closed while the page was
               away must not be resurrected as a dangling tab. */
            setEditorTerminals(listed.filter((terminal) => remembered.includes(terminal.id)));
          })
          .catch(() => {});
        return () => {
          cancelled = true;
        };
      }, []);
      /* Directory "Open in Terminal" asked for, consumed by the next shell. */
      const pendingTerminalPath = React.useRef('');
      const [terminalStartDirectory, setTerminalStartDirectory] = React.useState('');
      const [createState, setCreateState] = React.useState(null);
      const [git, setGit] = React.useState(null);
      const [openFiles, setOpenFiles] = React.useState([]);
      const [activePath, setActivePath] = React.useState(null);
      /* The file tab strip's measured width, for IDEA's `»` overflow. */
      const [tabStripWidth, setTabStripWidth] = React.useState(0);
      const fileTabStripRef = React.useRef(null);
      const [editorError, setEditorError] = React.useState(null);
      const [saving, setSaving] = React.useState(false);
      /* IDEA's editor status bar: caret position, indentation and line-ending mode. */
      const [caret, setCaret] = React.useState({ line: 1, column: 1 });
      /* Line count and selection size for IDEA's status bar. */
      const [lineStats, setLineStats] = React.useState({ lines: 0, selected: 0 });
      const [fileMode, setFileMode] = React.useState({ tabSize: 2, insertSpaces: true, eol: 'LF', encoding: 'UTF-8' });
      const [commitMessage, setCommitMessage] = React.useState('');
      /* Recently used commit messages, recalled with ↑/↓ like IDEA's message box. */
      const [messageHistory, setMessageHistory] = React.useState([]);
      const [historyIndex, setHistoryIndex] = React.useState(-1);
      const [amend, setAmend] = React.useState(false);
      const [commitSelection, setCommitSelection] = React.useState(() => new Set());
      const [commitBusy, setCommitBusy] = React.useState(false);
      const [commitError, setCommitError] = React.useState(null);
      /* Git refuses to commit without an identity; say so before the message is written. */
      const [identityMissing, setIdentityMissing] = React.useState(false);
      /* The reason the last push failed; clears on a successful one. */
      const [pushError, setPushError] = React.useState(null);
      /* A push can take a while; it needs its own busy flag so Commit stays usable. */
      const [pushBusy, setPushBusy] = React.useState(false);
      /* Fetch and Update share the network cost of push, so each gets its own flag. */
      const [fetchBusy, setFetchBusy] = React.useState(false);
      const [updateBusy, setUpdateBusy] = React.useState(false);
      const [commitNotice, setCommitNotice] = React.useState(null);
      /* The message that was just committed, offered back as "Undo". */
      const [clearedMessage, setClearedMessage] = React.useState('');
      /* The draft the user was typing before they started walking the history with ↑. */
      const draftBeforeRecall = React.useRef(null);
      /* What the box held before Amend prefilled it, so unticking Amend can restore it. */
      const preAmendMessage = React.useRef(null);
      const [diffTarget, setDiffTarget] = React.useState(null);
      /* The Commit diff keeps ONE editor tab. `diffTarget` is what it shows;
         `diffActive` says whether that tab or a file tab owns the code area, so
         picking a file tab does not silently leave the diff on screen. */
      const [diffActive, setDiffActive] = React.useState(true);
      /* Per-line attribution for the open file (IDEA's Annotate). */
      const [annotateTarget, setAnnotateTarget] = React.useState(null);
      /* The change the Commit panel is showing, for ⌥⌘Z. Declared AFTER the state
         it mirrors: a ref synced in an effect placed above it hits the TDZ. */
      const selectedDiffPathRef = React.useRef(null);
      const selectedCommitPathRef = React.useRef(null);
      /* The change the Commit panel last pointed at, kept after the diff closes:
         ⌘D closes the diff, and pressing it again must reopen the same one rather
         than fall through to "no current change" and do nothing. */
      const lastChangePathRef = React.useRef(null);
      /* A newly opened diff takes the surface; the tab keeps its place when the
         user walks back to a file and returns. */
      React.useEffect(() => {
        if (diffTarget !== null) setDiffActive(true);
      }, [diffTarget]);
      React.useEffect(() => {
        selectedDiffPathRef.current = diffTarget === null ? null : diffTarget.path;
        if (diffTarget !== null) lastChangePathRef.current = { path: diffTarget.path, staged: diffTarget.staged === true };
      }, [diffTarget]);
      React.useEffect(() => {
        selectedCommitPathRef.current = annotateTarget === null ? null : annotateTarget.path;
      }, [annotateTarget]);
      const [annotateLines, setAnnotateLines] = React.useState([]);
      const [annotateLoading, setAnnotateLoading] = React.useState(false);
      const [annotateTruncated, setAnnotateTruncated] = React.useState(false);
      /* Keys carry the workspace root, so this starts empty and is restored below. */
      const [collapsedGroups, setCollapsedGroups] = React.useState(() => new Set());
      const [menu, setMenu] = React.useState(null);
      const [renameState, setRenameState] = React.useState(null);
      /* Hidden entries are shown BY DEFAULT: the tree hides only `.git`, because
         `.env` / `.github` / `.vscode` are files people actually open. The toggle
         still hides them for a compact view. */
      const [showHidden, setShowHidden] = React.useState(() => readStoredText('dsh-editor.project.showHidden', '1') !== '0');
      /* IDEA lets the Project view sort by name, type, or modification time. */
      const [sortMode, setSortMode] = React.useState(() => readStoredText('dsh-editor.project.sort', 'name'));
      /* IDEA's "Autoscroll from Source": the tree follows whichever tab is active. */
      const [autoScroll, setAutoScroll] = React.useState(() => readStoredText('dsh-editor.project.autoscroll', '1') === '1');
      const [conflict, setConflict] = React.useState(null);
      /* Open tabs whose file changed on disk since they were loaded. */
      const [externalChanges, setExternalChanges] = React.useState({});
      /* Open files that no longer exist on disk, shown with a strikethrough in the tree. */
      const [deletedPaths, setDeletedPaths] = React.useState(() => new Set());
      /* Files that appeared outside the editor since the last refresh. */
      const [newPaths, setNewPaths] = React.useState(() => new Set());
      /* Paths seen in the previous root listing; null until the baseline is established. */
      const knownPathsRef = React.useRef(null);
      /* Paths whose model is being replaced programmatically: that edit is not a user edit. */
      const silentReloadRef = React.useRef(new Set());
      const [replaceState, setReplaceState] = React.useState(null);
      const [quickOpen, setQuickOpen] = React.useState(null);
      /* IDEA's revision picker (Compare with Revision…), searchable. */
      const [revisionPicker, setRevisionPicker] = React.useState(null);
      /* IDEA's Recent Files (⌘E): the MRU list for this workspace. */
      const [recentFiles, setRecentFiles] = React.useState([]);
      /* The palette mode: 'files' is Go to File, 'recent' is Recent Files. */
      const [paletteMode, setPaletteMode] = React.useState('files');
      /* IDEA's in-window name prompt (New Branch / New Tag). */
      const [namePrompt, setNamePrompt] = React.useState(null);
      /* IDEA's "Move to…" (F6): a directory picker over the whole workspace. */
      const [moveTo, setMoveTo] = React.useState(null);
      const [commitMode, setCommitMode] = React.useState('changes');
      /* IDEA's "Group by" for the change list; persisted because it is a
         preference about how the user reads changes, not about one session. */
      const [groupBy, setGroupBy] = React.useState(() => readStoredText('dsh-editor.commit.groupBy', 'directory'));
      /* The change-list filter; deliberately NOT persisted — a filter left over
         from yesterday makes the list look like files went missing. */
      const [pathQuery, setPathQuery] = React.useState('');
      /* One remembered offset per Commit tab: switching tabs remounts the list, and
         IDEA keeps each tab where you left it. */
      const commitScrollRef = React.useRef({ changes: null, log: null });
      const commitChangesRef = React.useRef(null);
      const commitLogRef = React.useRef(null);
      /**
       * Record the outgoing tab's offset, then switch.
       * @param {'changes'|'log'} next - tab being opened.
       * @returns {void}
       */
      const switchCommitMode = React.useCallback((next) => {
        const node = commitMode === 'changes' ? commitChangesRef.current : commitLogRef.current;
        if (node !== null && node !== undefined) commitScrollRef.current[commitMode] = node.scrollTop;
        setCommitMode(next);
      }, [commitMode]);
      /**
       * Put the incoming tab back where the user left it.
       * @param {'changes'|'log'} mode - tab that just rendered.
       * @returns {void}
       */
      const rememberCommitScroll = React.useCallback((mode) => {
        const node = mode === 'changes' ? commitChangesRef.current : commitLogRef.current;
        if (node === null || node === undefined) return;
        const next = restoreScrollTop({ remembered: commitScrollRef.current[mode], max: node.scrollHeight - node.clientHeight });
        if (next === null) return;
        node.scrollTop = next;
      }, []);
      /* Apply the remembered offset once the active tab's list has rendered. */
      React.useEffect(() => {
        const frame = window.requestAnimationFrame(() => rememberCommitScroll(commitMode));
        return () => window.cancelAnimationFrame(frame);
      }, [commitMode, rememberCommitScroll]);
      const [commits, setCommits] = React.useState([]);
      /* The commit just created, highlighted in the log so the user sees it land. */
      const [highlightedCommit, setHighlightedCommit] = React.useState(null);
      const [logLoading, setLogLoading] = React.useState(false);
      const [logDetail, setLogDetail] = React.useState(null);
      /* The commit chosen in either the flat list or the graph; both views mark it. */
      const [selectedCommit, setSelectedCommit] = React.useState(null);

      const containerRef = React.useRef(null);
      const editorRef = React.useRef(null);
      const modelsRef = React.useRef(new Map());
      const activePathRef = React.useRef(null);
      /* Read by the window/Monaco shortcuts, which are registered once. */
      const diffActiveRef = React.useRef(true);
      const openFilesRef = React.useRef([]);
      const childrenRef = React.useRef({});
      const expandedRef = React.useRef(expanded);
      const rootRef = React.useRef('');
      /* Which workspace's fold state is currently loaded (see loadRoot). */
      const collapsedRestoredFor = React.useRef(null);
      const rowRefs = React.useRef(new Map());
      const treeRef = React.useRef(null);
      /* Read by the one-shot keyboard handlers, which must not re-bind per render. */
      const panelVisibleRef = React.useRef(true);
      const activityRef = React.useRef('project');
      const gitRef = React.useRef(null);
      const restageRef = React.useRef(async () => {});
      /* The sort the tree is currently laid out with, and the row to keep visible. */
      const sortAppliedRef = React.useRef('');
      const selectedPathRef = React.useRef(null);

      React.useEffect(() => {
        activePathRef.current = activePath;
      }, [activePath]);
      React.useEffect(() => {
        diffActiveRef.current = diffActive;
      }, [diffActive]);
      React.useEffect(() => {
        selectedPathRef.current = selectedPath;
      }, [selectedPath]);
      React.useEffect(() => {
        openFilesRef.current = openFiles;
      }, [openFiles]);
      React.useEffect(() => {
        childrenRef.current = children;
      }, [children]);
      React.useEffect(() => {
        expandedRef.current = expanded;
        if (expandedRestoredRef.current !== '') writeExpanded(expandedRestoredRef.current, expanded);
      }, [expanded]);
      React.useEffect(() => {
        rootRef.current = root;
      }, [root]);
      /* The keyboard shortcuts are registered once, so they read the panel state,
         the git snapshot and the stager through refs rather than stale closures. */
      React.useEffect(() => {
        panelVisibleRef.current = panelVisible;
      }, [panelVisible]);
      React.useEffect(() => {
        activityRef.current = activity;
      }, [activity]);
      React.useEffect(() => {
        gitRef.current = git;
      }, [git]);

      const activeFile = activePath === null ? null : openFiles.find((file) => file.path === activePath) ?? null;
      /* The diff preview is rendered only while its tab (or a freshly opened
         change) owns the code area. */
      const diffOpen = diffTarget !== null && diffActive;
      const projectName = basename(root) || 'Workspace';
      const rows = React.useMemo(() => flattenRows(entries, children, expanded, projectName, root), [entries, children, expanded, projectName, root]);
      /* Mirror the flattened rows for the loader (which runs outside render). */
      React.useEffect(() => {
        rowsRef.current = rows;
      }, [rows]);

      /**
       * Apply one click on a tree row, honouring IDEA's ⌘/Shift modifiers.
       *
       * A plain click replaces the selection; ⌘/Ctrl toggles one row; Shift takes
       * the whole visible range between the anchor and the clicked row, exactly
       * like the Project tool window's DnD and batch delete.
       * @param {object} row - flattened tree row.
       * @param {{metaKey?: boolean, ctrlKey?: boolean, shiftKey?: boolean}} event - click modifiers.
       */
      const selectRow = React.useCallback(
        (row, event) => {
          const path = row.path;
          const meta = event.metaKey === true || event.ctrlKey === true;
          if (event.shiftKey === true && selectionAnchor.current !== null) {
            const from = rows.findIndex((entry) => entry.path === selectionAnchor.current);
            const to = rows.findIndex((entry) => entry.path === path);
            if (from >= 0 && to >= 0) {
              const [start, end] = from <= to ? [from, to] : [to, from];
              setSelection(new Set(rows.slice(start, end + 1).map((entry) => entry.path)));
              setSelectedPathRaw(path);
              return;
            }
          }
          if (meta) {
            setSelection((current) => {
              const next = new Set(current);
              if (next.has(path)) next.delete(path);
              else next.add(path);
              setSelectedPathRaw(next.has(path) ? path : [...next].pop() ?? null);
              return next;
            });
            selectionAnchor.current = path;
            return;
          }
          setSelectedPath(path);
        },
        [rows, setSelectedPath],
      );

      /* Load Monaco once. */
      React.useEffect(() => {
        let cancelled = false;
        loadMonaco().then(
          () => {
            if (!cancelled) setMonacoReady(true);
          },
          (error) => {
            if (!cancelled) setMonacoError(error instanceof Error ? error.message : String(error));
          },
        );
        return () => {
          cancelled = true;
        };
      }, []);

      /* File tabs overflow like the terminal dock's: measure the strip, not the tabs. */
      React.useLayoutEffect(() => {
        const node = fileTabStripRef.current;
        if (node === null) return undefined;
        const measure = () => setTabStripWidth(node.clientWidth);
        measure();
        if (typeof ResizeObserver === 'undefined') return undefined;
        const observer = new ResizeObserver(measure);
        observer.observe(node);
        return () => observer.disconnect();
      }, []);

      const loadGit = React.useCallback(async () => {
        try {
          const value = await callGit({ op: 'status' });
          setGit(value);
          setCommitSelection(new Set((value?.changes ?? []).map((change) => change.path)));
          return value;
        } catch {
          setGit({ root: '', branch: '', prefix: '', changes: [] });
          setCommitSelection(new Set());
          return null;
        }
      }, []);

      /**
       * Common commit prefixes, IDEA's commit-message templates in miniature.
       *
       * The list is fixed rather than free-form on purpose: a template that the
       * user has to configure first would never be used, and these are the
       * conventional prefixes this repository's history already follows.
       */
      const COMMIT_TEMPLATES = ['feat', 'fix', 'refactor', 'docs', 'test', 'chore', 'perf', 'style'];

      /**
       * Insert one template prefix at the start of the message.
       *
       * Applying a template twice must not produce `feat: feat: …`, so an
       * existing prefix that is itself a template is replaced.
       * @param {string} prefix - template to apply.
       */
      const applyCommitTemplate = React.useCallback((prefix) => {
        setCommitMessage((current) => {
          const text = current ?? '';
          const match = /^([a-z]+)(\([^)]*\))?: ?/u.exec(text);
          const rest = match !== null && COMMIT_TEMPLATES.includes(match[1]) ? text.slice(match[0].length) : text;
          return `${prefix}: ${rest}`;
        });
        setHistoryIndex(-1);
      }, []);

      /* Log paging: IDEA loads the history in pages as you scroll. */
      const LOG_PAGE = 60;
      /* Declared before `loadLog`, which resets it: reading it later would hit the TDZ. */
      const [logExhausted, setLogExhausted] = React.useState(false);
      /* Why the last log/graph request failed; null while the view is healthy. */
      const [logError, setLogError] = React.useState(null);
      const [logAuthor, setLogAuthor] = React.useState('');
      const logAuthorRef = React.useRef('');
      React.useEffect(() => {
        logAuthorRef.current = logAuthor;
      }, [logAuthor]);
      const logHistoryRef = React.useRef(null);

      /**
       * Reload the first page of the log, honouring the author filter.
       * @returns {Promise<void>} resolves once the first page is set.
       */
      const loadLog = React.useCallback(async () => {
        setLogLoading(true);
        try {
          const value = await callGit({ op: 'log', limit: LOG_PAGE, skip: 0, author: logAuthorRef.current });
          const firstPage = value.commits ?? [];
          setCommits(firstPage);
          /* A short first page already ends the history: no scroll will find more. */
          setLogExhausted(firstPage.length < LOG_PAGE);
          setLogError(null);
        } catch (failure) {
          setCommits([]);
          /* An empty list alone reads as "this repo has no commits"; the reason
             git gave is the only thing that explains why the log went blank. */
          setLogError(failure instanceof Error ? failure.message : String(failure));
        } finally {
          setLogLoading(false);
        }
      }, []);

      /**
       * Append the next page when the list is scrolled to the bottom.
       *
       * A short page means the history ended, so the next scroll does not ask
       * again; the flag resets with every reload or filter change.
       */
      const loadingMoreRef = React.useRef(false);
      const loadMoreLog = React.useCallback(async () => {
        if (loadingMoreRef.current || logExhausted) return;
        loadingMoreRef.current = true;
        try {
          const value = await callGit({ op: 'log', limit: LOG_PAGE, skip: commits.length, author: logAuthorRef.current });
          const page = value.commits ?? [];
          setCommits((current) => {
            const known = new Set(current.map((commit) => commit.hash));
            return [...current, ...page.filter((commit) => !known.has(commit.hash))];
          });
          if (page.length < LOG_PAGE) setLogExhausted(true);
          setLogError(null);
        } catch (failure) {
          /* a failed page leaves the list as it was, but must say why */
          setLogError(failure instanceof Error ? failure.message : String(failure));
        } finally {
          loadingMoreRef.current = false;
        }
      }, [commits.length, logExhausted]);

      /**
       * Load the bounded commit graph for the Log tab's "Graph" toggle.
       *
       * Read on demand: a repository walk is heavier than the flat log, and most
       * log visits do not ask for lanes. The branch argument is the graph's own
       * filter — the flat log's author box must not leak into it.
       * @param {string} [branch] - local branch to walk; empty means every ref.
       * @returns {Promise<void>} resolves once the graph (or an error) is set.
       */
      const [graph, setGraph] = React.useState(null);
      const loadGraph = React.useCallback(async (branch, at) => {
        const branchValue = typeof branch === 'string' ? branch : '';
        const atValue = typeof at === 'string' ? at : '';
        setLogLoading(true);
        try {
          const value = await callGit({ op: 'graph', limit: 80, branch: branchValue, at: atValue });
          setGraph({
            entries: value?.entries ?? [],
            branches: value?.branches ?? [],
            tags: value?.tags ?? [],
            branchList: value?.branchList ?? [],
            tagList: Array.isArray(value?.tagList) ? value.tagList : [],
            head: typeof value?.head === 'string' ? value.head : null,
            branch: typeof value?.branch === 'string' ? value.branch : null,
            at: typeof value?.at === 'string' ? value.at : null,
          });
          setLogError(null);
        } catch (failure) {
          const message = failure instanceof Error ? failure.message : String(failure);
          setLogError(message);
          setGraph({
            entries: [],
            branches: [],
            tags: [],
            branchList: [],
            tagList: [],
            head: null,
            branch: branchValue !== '' ? branchValue : null,
            at: atValue !== '' ? atValue : null,
          });
        } finally {
          setLogLoading(false);
        }
      }, []);

      /**
       * Select one commit: load the detail AND keep the list on that row.
       *
       * The graph and the flat log are two views of the same selection. Walking
       * the graph with the keyboard used to fill the detail pane while the flat
       * list stayed where it was, so switching back to the list lost the commit
       * the user had just picked.
       * @param {string} hash - full commit hash.
       * @returns {Promise<void>} resolves once the detail is set.
       */
      const showCommit = React.useCallback(async (hash) => {
        setSelectedCommit(hash);
        try {
          setLogDetail(await callGit({ op: 'show', hash }));
        } catch (failure) {
          setCommitError(failure instanceof Error ? failure.message : String(failure));
        }
      }, []);

      /**
       * Open one file's version inside one commit as a diff in the editor area.
       *
       * This is IDEA's "Show Diff" from the log: it never touches the working
       * tree, so a commit that deleted the file still renders its full change.
       * @param {{hash: string, path: string}} target - commit and workspace path.
       */
      /**
       * Compare one workspace file with the current clipboard, IDEA's "Compare with Clipboard".
       *
       * The clipboard is read in the browser (the host never sees it) and handed
       * to the diff as a text target. An empty or unreadable clipboard is reported
       * instead of opening a diff against nothing.
       * @param {string} path - workspace-relative file path.
       * @returns {Promise<void>} resolves once the diff is open or the failure shown.
       */
      const compareWithClipboard = React.useCallback(async (path) => {
        if (typeof path !== 'string' || path === '') return;
        let text = '';
        try {
          text = (await navigator.clipboard?.readText()) ?? '';
        } catch {
          setEditorError(t('editor.clipboardUnavailable'));
          return;
        }
        if (text === '') {
          setEditorError(t('editor.clipboardEmpty'));
          return;
        }
        setDiffTarget({ path, clipboardText: text, label: 'clipboard', staged: false });
      }, [t]);

      /**
       * Offer the recent commits and compare the file against the chosen one.
       *
       * IDEA's "Compare with Revision" needs a revision first, so the picker is
       * the existing commit log rather than a free-form hash box: a typo would
       * otherwise become an "invalid commit id" error after two round trips.
       * @param {string} path - workspace-relative file path.
       */
      /**
       * Open IDEA's revision picker for one file ("Compare with Revision").
       *
       * The picker reads a full page (100) and is searchable, because a context
       * submenu could only offer a fixed handful and the commit you want is
       * usually older than that.
       * @param {string} path - workspace-relative file to compare.
       * @returns {Promise<void>} resolves once the picker has its first page.
       */
      const compareWithRevision = React.useCallback(async (path) => {
        if (typeof path !== 'string' || path === '') return;
        setRevisionPicker({ path, query: '', index: 0, commits: [], loading: true });
        try {
          const value = await callGit({ op: 'log', limit: 100 });
          setRevisionPicker((current) => (current === null ? current : { ...current, commits: value.commits ?? [], loading: false }));
        } catch (failure) {
          setEditorError(failure instanceof Error ? failure.message : String(failure));
          setRevisionPicker(null);
        }
      }, []);

      const showCommitDiff = React.useCallback((target) => {
        if (typeof target?.hash !== 'string' || typeof target?.path !== 'string') return;
        setDiffTarget({ path: target.path, commit: target.hash, staged: false });
        setDiffActive(true);
      }, []);

      /* IDEA's per-file history: a filtered log of the commits that touched one path. */
      const [historyPath, setHistoryPath] = React.useState(null);
      const showFileHistory = React.useCallback(async (path) => {
        if (typeof path !== 'string' || path === '') return;
        /* IDEA answers "Show History" by opening the Commit tool window's Log tab. */
        setActivity('commit');
        setPanelVisible(true);
        setCommitMode('log');
        setHistoryPath(path);
        setLogLoading(true);
        try {
          const value = await callGit({ op: 'fileHistory', path });
          setCommits(value.commits ?? []);
          setLogExhausted(true);
          setLogDetail(null);
        } catch (failure) {
          setCommitError(failure instanceof Error ? failure.message : String(failure));
          setCommits([]);
        } finally {
          setLogLoading(false);
        }
      }, []);
      /**
       * Apply the log's author filter, debounced so typing does not spawn a git per key.
       *
       * File history and the full log answer different questions, so switching the
       * filter drops back to the repository-wide log — matching IDEA's Log tab.
       */
      const authorTimer = React.useRef(null);
      const changeLogAuthor = React.useCallback((value) => {
        setLogAuthor(value);
        logAuthorRef.current = value;
        if (authorTimer.current !== null) window.clearTimeout(authorTimer.current);
        authorTimer.current = window.setTimeout(() => {
          authorTimer.current = null;
          setHistoryPath(null);
          void loadLog();
        }, 350);
      }, [loadLog]);
      React.useEffect(() => () => {
        if (authorTimer.current !== null) window.clearTimeout(authorTimer.current);
      }, []);

      const clearFileHistory = React.useCallback(() => {
        setHistoryPath(null);
        void loadLog();
      }, [loadLog]);

      /* Load the workspace root and its git status. */
      const loadRoot = React.useCallback(async () => {
        /* A silent refresh once there is something on screen: flipping the flag on
           every poll made the placeholder row appear above the list and shove the
           whole tree down (and back) every few seconds. */
        if (shouldShowTreeLoading({ loading: true, rowCount: treeRootRef.current === '' ? 0 : rowsRef.current.length })) setTreeLoading(true);
        try {
          const value = await callFs({ op: 'list', path: '', showHidden, sort: sortMode });
          const listing = Array.isArray(value.entries) ? value.entries : [];
          setRoot(value.root ?? '');
          setHome(value.home ?? '');
          treeRootRef.current = value.root ?? '';
          /* Keep the array React already holds when the listing is identical: a
             new array reference re-renders every row (a visible flash) even though
             nothing on disk changed. */
          setEntries((current) => keepUnchangedListing(current, listing));
          setTreeError(null);
          /* The fold keys embed the root, so they are restored here (not in the
             initialiser). Guarded by the root itself rather than by "first load":
             a poll must not overwrite folds made a moment ago, but switching to a
             different workspace still has to restore ITS folds. */
          if (collapsedRestoredFor.current !== (value.root ?? '')) {
            collapsedRestoredFor.current = value.root ?? '';
            setCollapsedGroups(readCollapsedGroups(value.root ?? ''));
          }
          const restored = readExpanded(value.root ?? '');
          setExpanded((current) => {
            let next = null;
            for (const path of ['', ...restored]) {
              if (current.has(path)) continue;
              if (next === null) next = new Set(current);
              next.add(path);
            }
            /* Same membership: return the SAME Set, or the flattened-row memo
               recomputes and every tree row re-renders on an idle poll. */
            return next ?? current;
          });
          expandedRestoredRef.current = value.root ?? '';
          /* Restored directories must also fetch their children, or they render empty. */
          const hydrated = {};
          for (const path of restored) {
            try {
              const listing = await callFs({ op: 'list', path, showHidden, sort: sortMode });
              hydrated[path] = listing.entries ?? [];
            } catch {
              /* a directory that vanished stays collapsed in effect */
            }
          }
          if (Object.keys(hydrated).length > 0) {
            setChildren((current) => {
              const next = { ...current };
              for (const [path, listing] of Object.entries(hydrated)) next[path] = keepUnchangedListing(current[path], listing);
              return next;
            });
          }
          /* Establish the "new file" baseline on load as well: refreshTree compares
             against it, and leaving it null until the first refresh means that
             refresh only re-baselines instead of reporting what appeared. */
          if (knownPathsRef.current === null) knownPathsRef.current = new Set(collectFilePaths(listing));
          await loadGit();
          return listing;
        } catch (error) {
          setTreeError(error instanceof Error ? error.message : String(error));
          return null;
        } finally {
          setTreeLoading(false);
        }
      }, [loadGit, showHidden, sortMode]);

      React.useEffect(() => {
        void loadRoot();
      }, [loadRoot, showHidden, sortMode]);

      /* Restore the per-workspace MRU list once the root is known. */
      React.useEffect(() => {
        if (root === '') return;
        setRecentFiles(readRecentFiles(root));
      }, [root]);

      /* Restore the per-workspace commit message history. */
      React.useEffect(() => {
        if (root === '') return;
        try {
          const raw = window.localStorage.getItem(`dsh-editor.commitHistory:${root}`);
          const parsed = raw === null ? [] : JSON.parse(raw);
          setMessageHistory(Array.isArray(parsed) ? parsed.filter((value) => typeof value === 'string') : []);
        } catch {
          setMessageHistory([]);
        }
        setHistoryIndex(-1);
      }, [root]);

      /* Restore the unsent draft when the workspace (and so its key) becomes known. */
      React.useEffect(() => {
        if (root === '') return;
        const draft = readCommitDraft(root);
        if (draft !== '') setCommitMessage((current) => (current === '' ? draft : current));
      }, [root]);

      /* Debounce writes: typing must not hit localStorage on every keystroke. */
      const draftTimer = React.useRef(null);
      React.useEffect(() => {
        if (root === '') return undefined;
        if (draftTimer.current !== null) window.clearTimeout(draftTimer.current);
        draftTimer.current = window.setTimeout(() => {
          draftTimer.current = null;
          writeCommitDraft(root, commitMessage);
        }, 400);
        return () => {
          if (draftTimer.current !== null) window.clearTimeout(draftTimer.current);
        };
      }, [commitMessage, root]);

      /**
       * Expand or collapse one directory, loading its children.
       *
       * Expanding always re-reads the directory: a cached listing goes stale the
       * moment something outside the editor creates or deletes a child, and the
       * tree would then keep hiding it forever (the entry never appears, even
       * after collapse + expand).
       * @param {string} path - workspace-relative directory path.
       * @returns {Promise<void>} resolves once the listing is applied.
       */
      const toggleDirectory = React.useCallback(async (path) => {
        /* Decide from the render's own `expanded` (this closure is rebuilt whenever it
           changes), never from a ref synced in an effect or from inside the updater:
           both are stale at click time, which silently skipped the fetch. */
        const willExpand = !expanded.has(path);
        setExpanded((current) => {
          const next = new Set(current);
          if (next.has(path)) next.delete(path);
          else next.add(path);
          return next;
        });
        if (path === '' || !willExpand) return;
        try {
          const value = await callFs({ op: 'list', path, showHidden, sort: sortMode });
          /* `children` is keyed by the same relative path the rows carry. */
          const listing = Array.isArray(value?.entries) ? value.entries : [];
          setChildren((current) => ({ ...current, [path]: listing }));
        } catch (error) {
          setTreeError(error instanceof Error ? error.message : String(error));
        }
      }, [expanded, showHidden, sortMode]);

      /* Open a file, reusing its existing tab. */
      /**
       * Paths whose read is in flight.
       *
       * A double-click fires two opens before either read resolves; without this
       * guard both appends land and the tab strip shows the same file twice.
       */
      const openingRef = React.useRef(new Set());
      /**
       * Note one visit in this workspace's MRU list (IDEA's Recent Files).
       *
       * Called for every open — including a file that is already in a tab, since
       * clicking a tab is exactly the "I was just here" signal ⌘E is for.
       * @param {string} path - workspace-relative path.
       * @returns {void}
       */
      const noteRecent = React.useCallback((path) => {
        if (typeof path !== 'string' || path === '') return;
        const workspace = rootRef.current;
        if (workspace === '') return;
        setRecentFiles((current) => {
          const next = pushRecent(current, path);
          /* Same array → same state → no re-render on an idle re-open. */
          if (next === current) return current;
          writeRecentFiles(workspace, next);
          return next;
        });
      }, []);

      const openFile = React.useCallback(async (path) => {
        setSelectedPath(path);
        /* The Commit diff is a tab of its own: picking a file shows that file and
           leaves the diff tab where it is, ready to be clicked back (IDEA). */
        setDiffActive(false);
        noteRecent(path);
        const existing = openFilesRef.current.find((file) => file.path === path);
        /* A second open of a file already being read just focuses it; the first
           read will place the tab. */
        if (existing === undefined && openingRef.current.has(path)) {
          setActivePath(path);
          return;
        }
        if (existing !== undefined) {
          /* Re-opening an already open file must NOT clear Annotate: clicking a
             blame row to inspect a commit while annotating would drop the reading
             mode the user just asked for. Diff still closes, since it replaces
             the same surface with a different file's change. */
          setActivePath(path);
          return;
        }
        openingRef.current.add(path);
        try {
          const value = await callFs({ op: 'read', path });
          const file = { path, content: value.content, dirty: false, mtime: value.mtime ?? null };
          /* Re-check on arrival: a parallel open may have appended it already. */
          setOpenFiles((current) => (current.some((entry) => entry.path === path) ? current : [...current, file]));
          setActivePath(path);
          setEditorError(null);
        } catch (error) {
          setEditorError(error instanceof Error ? error.message : String(error));
        } finally {
          openingRef.current.delete(path);
        }
      }, [noteRecent]);

      /* Save the active model. */
      const saveActive = React.useCallback(
        async (force = false) => {
          const path = activePathRef.current;
          if (path === null) return;
          const model = modelsRef.current.get(path);
          if (model === undefined) return;
          const file = openFilesRef.current.find((entry) => entry.path === path);
          setSaving(true);
          try {
            const value = await callFs({ op: 'write', path, content: model.getValue(), mtime: file?.mtime ?? undefined, force });
            setOpenFiles((current) =>
              current.map((entry) =>
                entry.path === path ? { ...entry, content: model.getValue(), dirty: false, mtime: value.mtime ?? entry.mtime } : entry,
              ),
            );
            setEditorError(null);
            setConflict(null);
            await loadGit();
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            if (/changed on disk|no longer exists/u.test(message)) {
              /* IDEA asks before clobbering someone else's edit. */
              setConflict({ path, message });
            } else {
              setEditorError(message);
            }
          } finally {
            setSaving(false);
          }
        },
        [loadGit],
      );

      /**
       * Flip the active model between spaces and tabs, IDEA's indentation chip.
       *
       * Monaco's own "convert indentation" actions rewrite the existing lines, so
       * the whole file follows the new setting instead of only new typing.
       * `model.detectIndentation` is deliberately NOT used: it re-detects from the
       * content and would immediately undo the user's choice.
       */
      const toggleIndentation = React.useCallback(() => {
        const editor = editorRef.current;
        const model = editor?.getModel();
        if (editor === null || editor === undefined || model === null || model === undefined) return;
        const options = model.getOptions();
        const insertSpaces = options.insertSpaces === false;
        model.updateOptions({ insertSpaces, tabSize: options.tabSize });
        const action = editor.getAction?.(insertSpaces ? 'editor.action.indentationToSpaces' : 'editor.action.indentationToTabs');
        void action?.run?.();
        model.updateOptions({ insertSpaces, tabSize: options.tabSize });
        setFileMode((current) => ({ ...current, insertSpaces }));
      }, []);

      /**
       * Switch the active model between LF and CRLF, IDEA's line-separator chip.
       *
       * Monaco's `pushEOL` takes the `EndOfLineSequence` enum (0 = LF, 1 = CRLF),
       * not the separator string: a string is silently treated as LF.
       */
      const toggleLineSeparator = React.useCallback(() => {
        const editor = editorRef.current;
        const model = editor?.getModel();
        const monaco = window.monaco;
        if (editor === null || editor === undefined || model === null || model === undefined) return;
        const next = model.getEOL() === '\r\n' ? '\n' : '\r\n';
        const sequence = monaco?.editor?.EndOfLineSequence;
        const value = next === '\r\n' ? (sequence?.CRLF ?? 1) : (sequence?.LF ?? 0);
        model.pushEOL(value);
        setFileMode((current) => ({ ...current, eol: next === '\r\n' ? 'CRLF' : 'LF' }));
      }, []);

      /**
       * Toggle the Annotate view for the active file.
       *
       * Annotate and diff are mutually exclusive: both replace the editor area,
       * so opening one closes the other instead of stacking two panes.
       */
      const toggleAnnotate = React.useCallback(async () => {
        const path = activePathRef.current;
        if (path === null) return;
        if (annotateTarget !== null) {
          setAnnotateTarget(null);
          return;
        }
        setDiffTarget(null);
        setAnnotateTarget({ path });
        setAnnotateLoading(true);
        setAnnotateLines([]);
        setAnnotateTruncated(false);
        try {
          const value = await callGit({ op: 'blame', path });
          setAnnotateLines(value?.lines ?? []);
          setAnnotateTruncated(value?.truncated === true);
        } catch (failure) {
          setCommitError(failure instanceof Error ? failure.message : String(failure));
        } finally {
          setAnnotateLoading(false);
        }
      }, [annotateTarget]);

      /**
       * Jump from an Annotate line to the commit that introduced it.
       *
       * IDEA answers the click by opening the change in its Log; here that means
       * the Commit tool window's Log tab with the commit selected, while the
       * annotate reading position is kept so the user can come back.
       * @param {string} hash - full commit hash from the blame row.
       * @returns {void}
       */
      const openCommitFromAnnotate = React.useCallback((hash) => {
        if (typeof hash !== 'string' || hash === '') return;
        setActivity('commit');
        setPanelVisible(true);
        setCommitMode('log');
        setHistoryPath(null);
        void loadLog();
        void showCommit(hash);
      }, [loadLog, showCommit]);

      /* Reveal a line requested by a terminal link once the model is bound. */
      const pendingReveal = React.useRef(null);
      const revealLines = React.useCallback((path, line, column) => {
        const editor = editorRef.current;
        const model = modelsRef.current.get(path);
        if (editor === null || model === undefined || typeof line !== 'number' || line < 1) return;
        const safeLine = Math.min(Math.max(1, line), model.getLineCount());
        const safeColumn = Math.min(Math.max(1, column ?? 1), model.getLineMaxColumn(safeLine));
        editor.setSelection(new window.monaco.Range(safeLine, safeColumn, safeLine, safeColumn));
        editor.revealLineInCenter(safeLine);
        editor.focus();
      }, []);

      /** Transient status-bar message, IDEA's its own "file(s) saved" hint. */
      const [statusNotice, setStatusNotice] = React.useState(null);
      const statusNoticeTimer = React.useRef(null);
      const flashStatus = React.useCallback((message) => {
        setStatusNotice(message);
        if (statusNoticeTimer.current !== null) window.clearTimeout(statusNoticeTimer.current);
        statusNoticeTimer.current = window.setTimeout(() => {
          statusNoticeTimer.current = null;
          setStatusNotice(null);
        }, 4000);
      }, []);
      React.useEffect(() => () => {
        if (statusNoticeTimer.current !== null) window.clearTimeout(statusNoticeTimer.current);
      }, []);

      /**
       * Save every dirty tab, IDEA's "Save All" (⌥⌘S / Ctrl+Alt+S).
       *
       * A tab whose file changed on disk is left alone: it keeps its conflict
       * banner instead of being force-written behind the user's back.
       * @returns {Promise<number>} how many files were written.
       */
      const saveAll = React.useCallback(async () => {
        const dirty = openFilesRef.current.filter((file) => file.dirty);
        let written = 0;
        for (const file of dirty) {
          const model = modelsRef.current.get(file.path);
          if (model === undefined) continue;
          try {
            const value = await callFs({ op: 'write', path: file.path, content: model.getValue(), mtime: file.mtime ?? undefined });
            setOpenFiles((current) =>
              current.map((entry) => (entry.path === file.path ? { ...entry, content: model.getValue(), dirty: false, mtime: value.mtime ?? entry.mtime } : entry)),
            );
            written += 1;
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            if (/changed on disk|no longer exists/u.test(message)) setConflict({ path: file.path, message });
            else setEditorError(message);
          }
        }
        if (written > 0) {
          flashStatus(t('editor.savedAll', { count: written }));
          await loadGit();
        }
        return written;
      }, [flashStatus, loadGit, t]);

      /* IDEA's "Go to Line" (⌘/Ctrl+L): accept `123` or `12:7`. */
      const [gotoState, setGotoState] = React.useState(null);
      const gotoLine = React.useCallback(() => {
        if (activePathRef.current === null) return;
        setGotoState({ value: '' });
      }, []);
      const commitGotoLine = React.useCallback(() => {
        const raw = gotoState?.value?.trim() ?? '';
        const match = /^(\d+)(?:\s*[:,]\s*(\d+))?$/u.exec(raw);
        const path = activePathRef.current;
        setGotoState(null);
        if (match === null || path === null) {
          setEditorError(t('editor.invalidName'));
          return;
        }
        revealLines(path, Number(match[1]), match[2] === undefined ? 1 : Number(match[2]));
      }, [gotoState, revealLines, t]);

      /* A terminal link asks the editor to open a workspace file at a location. */
      React.useEffect(() => {
        const host = document.querySelector('[data-dsh-editor-workspace]');
        if (host === null) return;
        const onOpen = (event) => {
          const detail = event.detail ?? {};
          const path = typeof detail.path === 'string' ? detail.path : '';
          if (path === '') return;
          pendingReveal.current = { path, line: detail.line ?? null, column: detail.column ?? null };
          void openFile(path);
        };
        host.addEventListener('dsh-editor-open-file', onOpen);
        return () => host.removeEventListener('dsh-editor-open-file', onOpen);
      }, [openFile]);

      /* Create Monaco once the container exists. */
      React.useEffect(() => {
        if (!monacoReady || containerRef.current === null) return;
        const monaco = window.monaco;
        if (monaco?.editor === undefined) return;
        const editor = monaco.editor.create(containerRef.current, {
          value: '',
          language: 'plaintext',
          theme: detectTheme(),
          automaticLayout: true,
          fontSize: 12,
          lineHeight: 20,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          wordWrap: 'off',
          tabSize: 2,
          renderWhitespace: 'selection',
          /* The tool window owns find/replace, so Monaco's own widget stays closed. */
          find: { addExtraSpaceOnTop: false, autoFindInSelection: 'never', seedSearchStringFromSelection: 'never' },
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
        });
        editorRef.current = editor;
        const saveAction = editor.addAction({
          id: 'dsh-editor.save',
          label: 'Save file',
          keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS],
          run: () => {
            void saveActive();
          },
        });
        /* Rebind Cmd/Ctrl+F to our bar and keep Monaco's widget out of the way. */
        const findAction = editor.addAction({
          id: 'dsh-editor.find',
          label: 'Find',
          keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyF],
          run: () => {
            /* ⌘F belongs to whatever has focus: the Project tree's speed search,
               the terminal's find bar, or this editor find bar — never two at once. */
            if (document.activeElement?.closest('.monaco-editor') == null) return;
            setReplaceState((current) => current ?? { find: '', replace: '', index: 0, total: 0, withReplace: false });
          },
        });
        /* IDEA's Save All, Go to Line and Close Tab, bound inside the editor too. */
        const saveAllAction = editor.addAction({
          id: 'dsh-editor.saveAll',
          label: 'Save All',
          keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyMod.Alt | monaco.KeyCode.KeyS],
          run: () => {
            void saveAll();
          },
        });
        const gotoAction = editor.addAction({
          id: 'dsh-editor.gotoLine',
          label: 'Go to Line',
          keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyL],
          run: () => {
            setGotoState({ value: '' });
          },
        });
        const closeTabAction = editor.addAction({
          id: 'dsh-editor.closeTab',
          label: 'Close Tab',
          keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyW],
          run: () => {
            /* ⌘W closes whichever editor tab is showing: the Commit diff while
               that tab is active, otherwise the open file. */
            if (diffActiveRef.current) setDiffTarget(null);
            else if (activePathRef.current !== null) closeFile(activePathRef.current);
          },
        });
        return () => {
          saveAction.dispose();
          findAction.dispose();
          saveAllAction.dispose();
          gotoAction.dispose();
          closeTabAction.dispose();
          editor.dispose();
          editorRef.current = null;
          for (const model of modelsRef.current.values()) model.dispose();
          modelsRef.current.clear();
        };
      }, [monacoReady, saveActive]);

      /* Bind the active file's model to the editor. */
      React.useEffect(() => {
        const monaco = window.monaco;
        const editor = editorRef.current;
        if (!monacoReady || monaco?.editor === undefined || editor === null) return;
        if (activePath === null) {
          editor.setModel(null);
          return;
        }
        const file = openFilesRef.current.find((entry) => entry.path === activePath);
        if (file === undefined) return;
        let model = modelsRef.current.get(activePath);
        if (model === undefined) {
          const uri = monaco.Uri.parse(`file:///${activePath.split('/').map(encodeURIComponent).join('/')}`);
          model = monaco.editor.createModel(file.content, safeLanguage(monaco, activePath), uri);
          modelsRef.current.set(activePath, model);
        }
        if (editor.getModel() !== model) editor.setModel(model);
        /* An inline create/rename in the tree keeps focus, and so does a plain tree
           click: IDEA opens the file but leaves the caret on the row you clicked, so
           the next arrow key walks the tree instead of the code. Focus is only
           pulled into the editor when it was already heading there (the editor, a
           terminal link, or the tab strip). */
        const activeNode = document.activeElement;
        const inlineEditing = activeNode?.closest('[data-dsh-editor-workspace] input') !== null
          && activeNode?.closest('.dsh-editor-tree-row, [data-dsh-editor-workspace] > div') !== null;
        const inTree = activeNode?.closest('[role="tree"]') != null;
        /* Clicking a file tab answers "show me this file"; the Commit panel's
           checkbox or tree must keep the caret where the user is working. */
        const inTabs = activeNode?.closest('[data-dsh-editor-tabstrip]') != null;
        if (!inlineEditing && !inTree && !inTabs) editor.focus();
        /* Reflect the file's own indentation and line endings in the status bar. */
        const options = model.getOptions?.() ?? {};
        setFileMode({
          tabSize: typeof options.tabSize === 'number' ? options.tabSize : 2,
          insertSpaces: options.insertSpaces !== false,
          eol: model.getEOL?.() === '\r\n' ? 'CRLF' : 'LF',
          encoding: 'UTF-8',
        });
        /* A terminal link may have asked for a specific line in this file. */
        const reveal = pendingReveal.current;
        if (reveal !== null && reveal.path === activePath) {
          pendingReveal.current = null;
          revealLines(activePath, reveal.line, reveal.column);
        }
        const subscription = editor.onDidChangeModelContent(() => {
          /* A reload from disk replaces the model; marking it dirty would fake unsaved work. */
          if (silentReloadRef.current.has(activePath)) return;
          const value = editor.getValue();
          setOpenFiles((current) =>
            current.map((entry) => (entry.path === activePath ? { ...entry, content: value, dirty: true } : entry)),
          );
        });
        const caretSubscription = editor.onDidChangeCursorPosition((event) => {
          setCaret({ line: event.position.lineNumber, column: event.position.column });
          setLineStats((current) => ({ ...current, selected: editor.getModel()?.getValueInRange(editor.getSelection() ?? new monaco.Range(1, 1, 1, 1))?.length ?? 0, lines: editor.getModel()?.getLineCount() ?? 0 }));
        });
        const position = editor.getPosition();
        if (position !== null) setCaret({ line: position.lineNumber, column: position.column });
        setLineStats({ lines: model.getLineCount(), selected: 0 });
        return () => {
          subscription.dispose();
          caretSubscription.dispose();
        };
      }, [activePath, diffActive, monacoReady, openFiles.length]);

      /**
       * Close one tab and dispose its model.
       *
       * IDEA asks before dropping unsaved edits, and the caller can bypass the
       * prompt when it already confirmed for a whole batch (Close All).
       * @param {string} path - tab identity.
       * @param {boolean} skipConfirm - close even when the model is dirty.
       */
      const closeFile = React.useCallback((path, skipConfirm = false) => {
        if (!skipConfirm) {
          const file = openFilesRef.current.find((entry) => entry.path === path);
          if (file?.dirty === true && !window.confirm(t('editor.unsavedTabsConfirm', { count: 1 }))) return;
        }
        const model = modelsRef.current.get(path);
        if (model !== undefined) {
          model.dispose();
          modelsRef.current.delete(path);
        }
        const remaining = openFilesRef.current.filter((file) => file.path !== path);
        setOpenFiles(remaining);
        if (activePathRef.current === path) {
          const next = remaining.length > 0 ? remaining[remaining.length - 1].path : null;
          setActivePath(next);
        }
      }, [t]);

      /** IDEA's "Close Other Tabs": keep one tab, drop the rest after one prompt. */
      const closeOtherTabs = React.useCallback(
        (keepPath) => {
          const doomed = openFilesRef.current.filter((file) => file.path !== keepPath);
          const dirty = doomed.filter((file) => file.dirty).length;
          if (dirty > 0 && !window.confirm(t('editor.unsavedTabsConfirm', { count: dirty }))) return;
          for (const file of doomed) closeFile(file.path, true);
        },
        [closeFile, t],
      );

      /** IDEA's "Close All Tabs". */
      const closeAllTabs = React.useCallback(() => {
        const doomed = openFilesRef.current;
        const dirty = doomed.filter((file) => file.dirty).length;
        if (dirty > 0 && !window.confirm(t('editor.unsavedTabsConfirm', { count: dirty }))) return;
        for (const file of doomed) closeFile(file.path, true);
      }, [closeFile, t]);

      /* Cmd/Ctrl+Shift+O opens "Go to File", IDEA's most-used navigation shortcut. */
      React.useEffect(() => {
        const onKeyDown = (event) => {
          if (!(event.metaKey || event.ctrlKey) || !event.shiftKey || event.key.toLowerCase() !== 'o') return;
          const host = document.querySelector('[data-dsh-editor-workspace]');
          if (host === null || !document.body.contains(host)) return;
          event.preventDefault();
          void openQuickOpen();
        };
        window.addEventListener('keydown', onKeyDown, true);
        return () => window.removeEventListener('keydown', onKeyDown, true);
      }, []);

      /* Load the palette's candidate list lazily, once per open. */
      const openQuickOpen = React.useCallback(async () => {
        setPaletteMode('files');
        setQuickOpen({ query: '', index: 0 });
        try {
          const value = await callFs({ op: 'files' });
          setQuickOpen((current) => (current === null ? current : { ...current, files: value.files ?? [], loading: false }));
        } catch {
          setQuickOpen((current) => (current === null ? current : { ...current, files: [], loading: false }));
        }
      }, []);

      /**
       * ⌘E — IDEA's Recent Files.
       *
       * The list is the MRU for this workspace, newest first, and it is shown
       * WITHOUT a filesystem walk: a recent-file popup that waits for a disk scan
       * before it can render defeats the point. Files that no longer exist are
       * still listed (IDEA keeps them); opening one reports the failure in the
       * usual status line instead of the row silently doing nothing.
       * @returns {void}
       */
      const openRecent = React.useCallback(() => {
        if (rootRef.current === '') return;
        setPaletteMode('recent');
        /* Read through the ref: the keydown handler closes over an older render. */
        const list = readRecentFiles(rootRef.current);
        setRecentFiles(list);
        setQuickOpen({ query: '', index: 0, files: list, loading: false });
      }, []);

      React.useEffect(() => {
        const onKeyDown = (event) => {
          const meta = event.metaKey || event.ctrlKey;
          if (!meta || event.altKey) return;
          if (event.key.toLowerCase() !== 'e') return;
          const host = document.querySelector('[data-dsh-editor-workspace]');
          if (host === null || !document.body.contains(host)) return;
          event.preventDefault();
          event.stopPropagation();
          openRecent();
        };
        window.addEventListener('keydown', onKeyDown, true);
        return () => window.removeEventListener('keydown', onKeyDown, true);
      }, [openRecent]);

      /* Cmd/Ctrl+F opens find; Cmd/Ctrl+Alt+F opens the same bar with replace. */
      React.useEffect(() => {
        const onKeyDown = (event) => {
          if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 'f') return;
          const host = document.querySelector('[data-dsh-editor-workspace]');
          if (host === null || !host.contains(document.activeElement)) return;
          /* The terminal dock owns ⌘F inside its own screen. */
          if (document.activeElement?.closest('[data-dsh-editor-terminal]') !== null && document.activeElement?.closest('[data-dsh-editor-terminal]') !== undefined) return;
          /* So does the Project tree: ⌘F there is the tree's speed search. */
          if (event.target instanceof Element && event.target.closest('[role="tree"]') !== null) return;
          if (document.activeElement?.closest('[role="tree"]') != null) return;
          event.preventDefault();
          setReplaceState((current) =>
            current === null ? { find: '', replace: '', index: 0, total: 0, withReplace: event.altKey } : { ...current, withReplace: event.altKey },
          );
        };
        window.addEventListener('keydown', onKeyDown, true);
        return () => window.removeEventListener('keydown', onKeyDown, true);
      }, []);

      /* Recompute match count whenever the query or the active file changes. */
      const updateFind = React.useCallback((patch) => {
        setReplaceState((current) => {
          if (current === null) return current;
          const next = { ...current, ...patch };
          const model = activePathRef.current === null ? undefined : modelsRef.current.get(activePathRef.current);
          const text = model?.getValue() ?? '';
          next.total = next.find === '' ? 0 : countOccurrences(text, next.find);
          next.index = Math.min(next.index, Math.max(0, next.total - 1));
          return next;
        });
      }, []);

      /* Move the editor selection to the next/previous match. */
      const jumpToMatch = React.useCallback((direction) => {
        const editor = editorRef.current;
        const model = editor?.getModel() ?? null;
        if (editor === null || model === null) return;
        setReplaceState((current) => {
          if (current === null || current.find === '') return current;
          const text = model.getValue();
          const matches = findMatches(text, current.find);
          if (matches.length === 0) return { ...current, total: 0, index: 0 };
          const index = ((current.index + direction) % matches.length + matches.length) % matches.length;
          const position = model.getPositionAt(matches[index]);
          editor.setSelection(new window.monaco.Range(position.lineNumber, position.column, position.lineNumber, position.column + current.find.length));
          editor.revealPositionInCenterIfOutsideViewport(position);
          return { ...current, index, total: matches.length };
        });
      }, []);

      const replaceAll = React.useCallback(() => {
        const editor = editorRef.current;
        const model = editor?.getModel() ?? null;
        if (model === null) return;
        setReplaceState((current) => {
          if (current === null || current.find === '') return current;
          const query = current.find;
          const next = current.replace;
          const before = model.getValue();
          const replaced = before.split(query).join(next);
          if (replaced !== before) {
            editor.executeEdits('dsh-editor-replace-all', [{ range: model.getFullModelRange(), text: replaced, forceMoveMarkers: true }]);
          }
          return { ...current, total: countOccurrences(replaced, query), index: 0 };
        });
      }, []);

      const closeFind = React.useCallback(() => {
        setReplaceState(null);
        editorRef.current?.focus();
      }, []);

      /* Discard local edits and take the on-disk contents, IDEA's "Load File from Disk". */
      /**
       * Re-read one open tab from disk, keeping it open and clean.
       *
       * `openFile` short-circuits when a path is already open, so anything that
       * rewrites a file behind the editor (restore-to-revision, checkout) needs
       * this instead — otherwise the tab keeps showing stale bytes.
       * @param {string} path - workspace-relative file path.
       * @returns {Promise<void>} resolves once the tab reflects the disk.
       */
      const reloadFile = React.useCallback(async (path) => {
        if (typeof path !== 'string' || path === '') return;
        try {
          const value = await callFs({ op: 'read', path });
          const model = modelsRef.current.get(path);
          if (model !== undefined) {
            silentReloadRef.current.add(path);
            try {
              model.setValue(value.content);
            } finally {
              silentReloadRef.current.delete(path);
            }
          }
          setOpenFiles((current) =>
            current.map((entry) => (entry.path === path ? { ...entry, content: value.content, dirty: false, mtime: value.mtime ?? null } : entry)),
          );
          setExternalChanges((current) => {
            if (current[path] === undefined) return current;
            const next = { ...current };
            delete next[path];
            return next;
          });
        } catch (error) {
          setEditorError(error instanceof Error ? error.message : String(error));
        }
      }, []);

      /**
       * Stop warning about one external change without touching the editor.
       *
       * Declared before `reloadActiveFromDisk` because that callback lists it as a
       * dependency: reading it later would hit the temporal dead zone.
       * @param {string} path - workspace-relative file path.
       */
      const dismissExternal = React.useCallback((path) => {
        setExternalChanges((current) => {
          if (current[path] === undefined) return current;
          const next = { ...current };
          delete next[path];
          return next;
        });
      }, []);

      const reloadActiveFromDisk = React.useCallback(async () => {
        const path = activePathRef.current;
        if (path === null) return;
        try {
          const value = await callFs({ op: 'read', path });
          const model = modelsRef.current.get(path);
          if (model !== undefined) {
            silentReloadRef.current.add(path);
            try {
              model.setValue(value.content);
            } finally {
              silentReloadRef.current.delete(path);
            }
          }
          setOpenFiles((current) =>
            current.map((entry) => (entry.path === path ? { ...entry, content: value.content, dirty: false, mtime: value.mtime ?? null } : entry)),
          );
          setConflict(null);
          setEditorError(null);
          dismissExternal(path);
          await loadGit();
        } catch (error) {
          setEditorError(error instanceof Error ? error.message : String(error));
        }
      }, [dismissExternal, loadGit]);

      /**
       * Reveal one path in the Project tree, expanding its ancestors.
       *
       * IDEA's "Select in Project View": the tree is where the file lives, so the
       * reveal has to expand what is collapsed instead of only moving the
       * selection to a row that may not be rendered yet.
       * @param {string} path - workspace-relative path to show.
       * @returns {Promise<void>} resolves once the tree shows the path.
       */
      /**
       * Make one path visible in the tree: expand its ancestors, select it, scroll to it.
       *
       * Deliberately does NOT touch the tool window's activity or visibility —
       * "Autoscroll from Source" runs this on every tab change and must not pop
       * the Commit panel back to Project or open a hidden tool window.
       * @param {string} path - workspace-relative path to show.
       * @returns {Promise<void>} resolves once the row is on screen.
       */
      const revealInProjectTree = React.useCallback(async (path) => {
        if (typeof path !== 'string' || path === '') return;
        const parts = path.split('/');
        let prefix = '';
        const nextExpanded = new Set(expandedRef.current);
        /* The root's own row is always present, so this stops before the last part. */
        for (let index = 0; index < parts.length - 1; index += 1) {
          prefix = prefix === '' ? parts[index] : `${prefix}/${parts[index]}`;
          nextExpanded.add(prefix);
          if (childrenRef.current[prefix] === undefined) {
            try {
              const value = await callFs({ op: 'list', path: prefix, showHidden, sort: sortMode });
              setChildren((current) => ({ ...current, [prefix]: value.entries ?? [] }));
            } catch {
              /* an unreadable ancestor still leaves the target selected */
            }
          }
        }
        setExpanded(nextExpanded);
        setSelectedPath(path);
        window.setTimeout(() => {
          rowRefs.current.get(path)?.scrollIntoView({ block: 'center' });
        }, 0);
      }, [setSelectedPath, showHidden, sortMode]);

      const revealPath = React.useCallback(async (path) => {
        if (typeof path !== 'string' || path === '') return;
        setActivity('project');
        setPanelVisible(true);
        await revealInProjectTree(path);
      }, [revealInProjectTree]);

      /**
       * IDEA's "Autoscroll from Source": the Project tree follows the active tab.
       *
       * Only while the Project view is actually on screen — silently reselecting
       * rows in a closed tool window would make the next glance at it feel random
       * (a selection nobody asked for, moved while the user was reading code).
       */
      React.useEffect(() => {
        if (!autoScroll || !panelVisible || activity !== 'project') return;
        if (activePath === null || activePath === '') return;
        void revealInProjectTree(activePath);
      }, [activePath, activity, autoScroll, panelVisible, revealInProjectTree]);

      /* The tab menu's "Select in Project View" acts on the open file. */
      const revealActive = React.useCallback(async () => {
        const path = activePathRef.current;
        if (path === null) return;
        await revealPath(path);
      }, [revealPath]);

      /**
       * Expand one directory without ever collapsing it, loading children on demand.
       * @param {string} path - workspace-relative directory ('' for the root).
       * @returns {Promise<void>} resolves once the tree shows the directory.
       */
      const expandTo = React.useCallback(async (path) => {
        setExpanded((current) => new Set([...current, '', ...ancestorsOf(path)]));
        for (const directory of [...ancestorsOf(path), path === '' ? null : path].filter((value) => typeof value === 'string')) {
          if (childrenRef.current[directory] !== undefined) continue;
          try {
            const value = await callFs({ op: 'list', path: directory, showHidden, sort: sortMode });
            setChildren((current) => ({ ...current, [directory]: value.entries ?? [] }));
          } catch {
            /* a vanished directory simply stays absent */
          }
        }
      }, [showHidden, sortMode]);

      /* Expand every directory under the root, bounded to keep huge repos responsive. */
      const expandAll = React.useCallback(async () => {
        const nextExpanded = new Set(expandedRef.current);
        const nextChildren = { ...childrenRef.current };
        const queue = entries.filter((entry) => entry.kind === 'directory').map((entry) => entry.path);
        let visited = 0;
        while (queue.length > 0 && visited < 200) {
          const path = queue.shift();
          if (nextChildren[path] === undefined) {
            try {
              const value = await callFs({ op: 'list', path, showHidden, sort: sortMode });
              nextChildren[path] = value.entries ?? [];
            } catch {
              continue;
            }
          }
          nextExpanded.add(path);
          for (const child of nextChildren[path] ?? []) if (child.kind === 'directory') queue.push(child.path);
          visited += 1;
        }
        setChildren(nextChildren);
        setExpanded(nextExpanded);
      }, [entries, showHidden, sortMode]);

      /* Clear every expansion state. */
      const collapseAll = React.useCallback(() => {
        setExpanded(new Set());
      }, []);

      /**
       * Re-read the tree from disk, keeping every unchanged listing as it is.
       *
       * This is the broad path: an explicit refresh, a git operation, or a
       * structural filesystem change. `only` narrows it to the directories that
       * actually changed on disk, which is what the watcher reports.
       * @param {string[]|null} [only] - workspace-relative directories to re-read; omitted for every expanded one.
       * @returns {Promise<void>} resolves once the listings are applied.
       */
      const refreshTree = React.useCallback(async (only) => {
        /* A toolbar button passes its click event here; anything but an array means
           "refresh everything". */
        const narrowed = Array.isArray(only) ? only : null;
        /* Re-read the root first: everything below it is keyed by paths in that
           listing, and a delete can invalidate an expanded directory outright. */
        const listing = await loadRoot();
        const nextChildren = {};
        /* Only expanded directories render rows, so re-reading a collapsed one buys
           nothing. `narrowed` may name collapsed directories (the watcher reports
           the disk, not the view), which this filter drops. */
        for (const path of narrowed ?? [...expandedRef.current]) {
          if (path === '' || !expandedRef.current.has(path)) continue;
          try {
            const value = await callFs({ op: 'list', path, showHidden, sort: sortMode });
            nextChildren[path] = value.entries ?? [];
          } catch {
            /* a directory that disappeared stays absent */
          }
        }
        /* Merge instead of replace: a directory expanded a moment ago may not be in
           `expandedRef` yet (that ref syncs in an effect), and replacing the whole map
           would drop its freshly fetched children until the next expand. */
        setChildren((current) => {
          let changed = false;
          const next = { ...current };
          for (const [path, rows] of Object.entries(nextChildren)) {
            /* An identical listing keeps the SAME array, so React skips those rows
               entirely — that is what makes a no-op refresh invisible. */
            const kept = keepUnchangedListing(current[path], rows);
            if (kept === current[path]) continue;
            next[path] = kept;
            changed = true;
          }
          /* A directory that disappeared leaves a cached listing behind: its rows
             stop rendering (the parent no longer lists it) but the entry keeps the
             old files, and re-creating the name would show them again for a frame.
             Prune only where the PARENT's listing was actually read this round —
             otherwise a collapsed branch's cache would be thrown away for free. */
          const read = new Map([['', Array.isArray(listing) ? listing : []], ...Object.entries(next)]);
          for (const path of Object.keys(next)) {
            const parent = dirname(path);
            const siblings = read.get(parent);
            if (siblings === undefined) continue;
            if (siblings.some((entry) => entry?.path === path)) continue;
            delete next[path];
            changed = true;
          }
          return changed ? next : current;
        });
        /* Files that appeared since the last refresh are marked "new" for one cycle. */
        setNewPaths((current) => {
          const known = knownPathsRef.current;
          if (known === null) {
            /* First refresh only establishes the baseline: nothing is "new" yet. */
            knownPathsRef.current = new Set(collectFilePaths(listing ?? []));
            return current;
          }
          const next = new Set(current);
          const visible = new Set(collectFilePaths(listing ?? []));
          for (const path of visible) if (!known.has(path)) next.add(path);
          /* A path that disappeared stops being "new". */
          for (const path of [...next]) if (!visible.has(path)) next.delete(path);
          knownPathsRef.current = visible;
          /* Same membership: keep the Set, so an idle refresh re-renders nothing. */
          if (next.size === current.size && [...next].every((path) => current.has(path))) return current;
          return next;
        });
        /* A tab whose file vanished outside the editor is marked, not silently kept. */
        const open = openFilesRef.current;
        if (open.length === 0) return;
        try {
          const described = await callFs({ op: 'exists', paths: open.map((file) => file.path) });
          const vanished = new Set((described ?? []).filter((entry) => entry.exists !== true).map((entry) => entry.path));
          setDeletedPaths((current) => {
            /* Same membership: keep the Set so React skips the re-render. */
            if (current.size === vanished.size && [...vanished].every((path) => current.has(path))) return current;
            return vanished;
          });
        } catch {
          /* an unreadable workspace keeps the previous marks */
        }
      }, [loadRoot, showHidden, sortMode]);

      /**
       * Write the editor's content back to a file that was deleted underneath it.
       *
       * "Reload from disk" cannot work here (there is nothing to read), so the
       * only sensible action is the opposite one: recreate the file from what the
       * user still has in front of them.
       * @returns {Promise<void>} resolves once the file exists again.
       */
      const recreateActive = React.useCallback(async () => {
        const path = activePathRef.current;
        if (path === null) return;
        const model = modelsRef.current.get(path);
        if (model === undefined) return;
        try {
          /* `create` is required: a deleted file cannot be "overwritten", only recreated. */
          const value = await callFs({ op: 'write', path, content: model.getValue(), force: true, create: true });
          setOpenFiles((current) =>
            current.map((entry) => (entry.path === path ? { ...entry, content: model.getValue(), dirty: false, mtime: value.mtime ?? entry.mtime } : entry)),
          );
          setExternalChanges((current) => {
            if (current[path] === undefined) return current;
            const next = { ...current };
            delete next[path];
            return next;
          });
          await refreshTree();
          await loadGit();
        } catch (error) {
          setEditorError(error instanceof Error ? error.message : String(error));
        }
      }, [loadGit, refreshTree]);


      /**
       * Check out one local branch and bring the editor back in sync.
       *
       * IDEA asks before switching when the working tree has changes, because a
       * checkout can carry them into the other branch or refuse outright.
       * @param {string} name - local branch name.
       */
      const checkoutBranch = React.useCallback(async (name) => {
        const dirty = (openFilesRef.current ?? []).some((file) => file.dirty === true);
        if (dirty && !window.confirm(t('editor.checkoutDirty'))) return;
        setCommitBusy(true);
        try {
          const value = await callGit({ op: 'checkout', branch: name });
          setGit(value);
          setCommitSelection(new Set((value?.changes ?? []).map((change) => change.path)));
          setDiffTarget(null);
          setExternalChanges({});
          await refreshTree();
          /* A checkout rewrites the history the Log tab is showing; leaving the old
             rows there means acting on another branch's commits. */
          setHistoryPath(null);
          await loadLog();
          setCommitNotice(t('editor.checkoutDone', { name }));
          /* A checkout can rewrite every file under the open tabs: re-read them all. */
          for (const file of openFilesRef.current) await reloadFile(file.path);
        } catch (failure) {
          setCommitError(failure instanceof Error ? failure.message : String(failure));
        } finally {
          setCommitBusy(false);
        }
      }, [loadLog, reloadFile, refreshTree, t]);

      /**
       * Open IDEA's branch popup: list local branches and check one out.
       *
       * The list is read on open (not cached) so a branch created in the terminal
       * shows up immediately; checking out one refreshes the tree because the
       * working files change under the editor.
       * @param {{x: number, y: number}} position - popup anchor in viewport coordinates.
       */
      const openBranchMenu = React.useCallback(async (position) => {
        setCommitBusy(true);
        setCommitError(null);
        try {
          const value = await callGit({ op: 'branches' });
          const names = Array.isArray(value?.branches) ? value.branches : [];
          const current = typeof value?.branch === 'string' ? value.branch : '';
          setMenu({
            x: position?.x ?? 220,
            y: position?.y ?? 120,
            items: [
              {
                id: 'newBranch',
                label: t('editor.newBranchAction'),
                run: () => setNamePrompt({
                  kind: 'branch',
                  title: t('editor.newBranchAction'),
                  placeholder: t('editor.newBranchPlaceholder'),
                  value: '',
                  error: '',
                }),
              },
              null,
              ...(names.length === 0
                ? [{ id: 'none', label: t('editor.noBranches'), disabled: true, run: () => {} }]
                : names.map((name) => ({
                    id: `branch:${name}`,
                    label: name,
                    shortcut: name === current ? '✓' : '',
                    run: () => {
                      if (name === current) return;
                      void checkoutBranch(name);
                    },
                  }))),
            ],
          });
        } catch (failure) {
          setCommitError(failure instanceof Error ? failure.message : String(failure));
        } finally {
          setCommitBusy(false);
        }
      }, [checkoutBranch, t]);

      /**
       * Create the branch named in the prompt, then refresh everything a switch touches.
       *
       * Errors land back in the prompt instead of the Commit error bar: the user is
       * still looking at the field they have to fix, and a message in the panel
       * behind a modal reads as "nothing happened".
       * @returns {Promise<void>} resolves once the branch exists or the error is shown.
       */
      const submitNamePrompt = React.useCallback(async () => {
        if (namePrompt === null) return;
        const name = namePrompt.value.trim();
        if (name === '') return;
        setCommitBusy(true);
        try {
          if (namePrompt.kind === 'tag') {
            /* A tag moves no HEAD and rewrites no file: only the graph's ref list
               changes, so the tree and open tabs stay untouched. */
            const tagValue = await callGit({ op: 'createTag', name, hash: namePrompt.hash });
            setGit((current) => (current === null ? current : { ...current, ...tagValue }));
            setNamePrompt(null);
            setCommitNotice(t('editor.tagCreated', { name: tagValue?.tag ?? name }));
            if (graph !== null) await loadGraph(graph.branch ?? '', graph.at ?? '');
            return;
          }
          const value = await callGit({ op: 'createBranch', name });
          setGit(value);
          setCommitSelection(new Set((value?.changes ?? []).map((change) => change.path)));
          setDiffTarget(null);
          setExternalChanges({});
          await refreshTree();
          setHistoryPath(null);
          await loadLog();
          setNamePrompt(null);
          setCommitNotice(t('editor.branchCreated', { name: value?.created ?? name }));
          for (const file of openFilesRef.current) await reloadFile(file.path);
        } catch (failure) {
          const message = failure instanceof Error ? failure.message : String(failure);
          setNamePrompt((current) => (current === null ? current : { ...current, error: message }));
        } finally {
          setCommitBusy(false);
        }
      }, [graph, loadGraph, loadLog, namePrompt, reloadFile, refreshTree, t]);

      /**
       * Run one stash operation and bring the changes list back in sync.
       *
       * Stashing is the one action that empties the panel on purpose, so the
       * selection is rebuilt from the fresh status instead of being left stale.
       * @param {'save'|'pop'} operation - stash action.
       */
      const runStash = React.useCallback(async (operation, ref) => {
        if (operation === 'pop' && !window.confirm(t('editor.stashPopConfirm'))) return;
        if (operation === 'drop' && !window.confirm(t('editor.stashDropConfirm', { ref: ref ?? '' }))) return;
        setCommitBusy(true);
        setCommitError(null);
        setCommitNotice(null);
        try {
          const value = await callGit({ op: 'stash', action: operation, ...(ref === undefined ? {} : { ref }) });
          setGit(value);
          setCommitSelection(new Set((value?.changes ?? []).map((change) => change.path)));
          setDiffTarget(null);
          setCommitNotice(
            operation === 'save'
              ? t('editor.stashed')
              : operation === 'apply'
                ? t('editor.stashApplied', { ref: ref ?? '' })
                : operation === 'drop'
                  ? t('editor.stashDropped', { ref: ref ?? '' })
                  : t('editor.stashPopped'),
          );
          await refreshTree();
        } catch (failure) {
          setCommitError(failure instanceof Error ? failure.message : String(failure));
        } finally {
          setCommitBusy(false);
        }
      }, [refreshTree, t]);

      /**
       * Open IDEA's stash menu: save the working tree, or pop the newest entry.
       *
       * The list is read on open so the "pop" row can name which stash it will
       * restore, and stays disabled when the stack is empty.
       * @param {{x: number, y: number}} position - popup anchor in viewport coordinates.
       */
      const openStashMenu = React.useCallback(async (position) => {
        setCommitBusy(true);
        setCommitError(null);
        try {
          const value = await callGit({ op: 'stash', action: 'list' });
          const entries = Array.isArray(value?.entries) ? value.entries : [];
          const newest = entries[0];
          setMenu({
            x: position?.x ?? 240,
            y: position?.y ?? 120,
            items: [
              {
                id: 'save',
                label: t('editor.stashSave'),
                disabled: (git?.changes ?? []).length === 0,
                run: () => void runStash('save'),
              },
              {
                id: 'pop',
                label: newest === undefined ? t('editor.stashEmpty') : t('editor.stashPop', { subject: newest.subject }),
                disabled: newest === undefined,
                run: () => void runStash('pop'),
              },
              /* IDEA lists the stack: applying keeps the entry (pop drops it), and a
                 drop is the only way to throw one away without touching the tree. */
              ...(entries.length === 0
                ? []
                : [null, ...entries.flatMap((entry) => [
                    {
                      id: `apply:${entry.ref}`,
                      label: t('editor.stashApply', { ref: entry.ref, subject: entry.subject }),
                      run: () => void runStash('apply', entry.ref),
                    },
                    {
                      id: `drop:${entry.ref}`,
                      label: t('editor.stashDrop', { ref: entry.ref }),
                      danger: true,
                      run: () => void runStash('drop', entry.ref),
                    },
                  ])]),
            ],
          });
        } catch (failure) {
          setCommitError(failure instanceof Error ? failure.message : String(failure));
        } finally {
          setCommitBusy(false);
        }
      }, [git, runStash, t]);

      /* Batch delete for the Project tool window's multi-row selection. */
      /**
       * Open tabs below one path that still hold unsaved edits.
       *
       * IDEA's delete dialog names them: deleting a directory silently throws away
       * the editor's copy of every dirty file under it, and "cannot be undone" does
       * not tell you WHAT is being lost.
       * @param {string} path - file or directory path being deleted.
       * @returns {string[]} workspace-relative paths with unsaved edits.
       */
      const dirtyUnder = React.useCallback((path) => {
        if (typeof path !== 'string') return [];
        return (openFilesRef.current ?? [])
          .filter((file) => file.dirty === true && (file.path === path || file.path.startsWith(`${path}/`)))
          .map((file) => file.path);
      }, []);

      const removeEntries = React.useCallback(
        async (paths) => {
          const targets = paths.filter((path) => path !== '');
          if (targets.length === 0) return;
          if (!window.confirm(t('editor.deleteSelectedConfirm', { count: targets.length }))) return;
          /* Name the unsaved tabs first: they are what the delete actually destroys. */
          const unsaved = targets.flatMap((path) => dirtyUnder(path));
          if (unsaved.length > 0 && !window.confirm(t('editor.deleteDirty', { count: unsaved.length, files: unsaved.join(', ') }))) return;
          setCommitBusy(true);
          try {
            for (const path of targets) {
              /* Deleting a parent first would make its children vanish from under us. */
              await callFs({ op: 'delete', path }).catch(() => {});
            }
            await refreshTree();
            await loadGit();
            setSelection(new Set());
            setSelectedPath(null);
            const active = activePathRef.current;
            if (active !== null && targets.some((path) => active === path || active.startsWith(`${path}/`))) closeFile(active);
          } catch (failure) {
            setTreeError(failure instanceof Error ? failure.message : String(failure));
          } finally {
            setCommitBusy(false);
          }
        },
        [closeFile, dirtyUnder, loadGit, refreshTree, setSelectedPath, t],
      );

      /* Delete one entry after confirmation, then refresh the tree and git status. */
      const removeEntry = React.useCallback(
        async (row) => {
          const label = row.path === '' ? projectName : row.path;
          if (!window.confirm(t('editor.deleteConfirm', { path: label }))) return;
          const unsaved = dirtyUnder(row.path);
          if (unsaved.length > 0 && !window.confirm(t('editor.deleteDirty', { count: unsaved.length, files: unsaved.join(', ') }))) return;
          try {
            await callFs({ op: 'delete', path: row.path });
            await refreshTree();
            await loadGit();
            setSelectedPath(null);
            if (activePathRef.current !== null && (activePathRef.current === row.path || activePathRef.current.startsWith(`${row.path}/`))) {
              closeFile(activePathRef.current);
            }
          } catch (failure) {
            setTreeError(failure instanceof Error ? failure.message : String(failure));
          }
        },
        [closeFile, dirtyUnder, loadGit, projectName, refreshTree, t],
      );

      /**
       * Compare each open tab's recorded mtime with the file on disk.
       *
       * IDEA reloads a clean file silently and only asks when the editor holds
       * unsaved work, so a clean tab adopts the new content and a dirty tab gets
       * the banner. A file that vanished stays listed so the banner can say so.
       * @returns {Promise<void>} resolves once every open tab has been checked.
       */
      const checkExternalChanges = React.useCallback(async () => {
        const open = openFilesRef.current.filter((file) => file.mtime !== null && file.mtime !== undefined);
        if (open.length === 0) return;
        let described;
        try {
          described = await callFs({ op: 'exists', paths: open.map((file) => file.path) });
        } catch {
          return;
        }
        const findings = {};
        for (const entry of described ?? []) {
          const current = open.find((file) => file.path === entry.path);
          if (current === undefined) continue;
          if (entry.exists !== true) {
            findings[current.path] = { missing: true, diskMtime: null };
            continue;
          }
          /* mtime is the cheap signal; an unchanged file costs nothing further. */
          if (typeof entry.mtime === 'number' && Math.abs(entry.mtime - current.mtime) <= 1) continue;
          findings[current.path] = { missing: false, diskMtime: entry.mtime ?? null };
        }
        const paths = Object.keys(findings);
        if (paths.length === 0) {
          setExternalChanges((current) => (Object.keys(current).length === 0 ? current : {}));
          return;
        }
        /* A clean tab silently adopts the disk version; only unsaved work needs a prompt. */
        const clean = paths.filter((path) => openFilesRef.current.find((file) => file.path === path)?.dirty !== true);
        for (const path of clean) {
          try {
            const value = await callFs({ op: 'read', path });
            const model = modelsRef.current.get(path);
            if (model !== undefined) {
              /* Replace content without marking the model dirty. */
              silentReloadRef.current.add(path);
              try {
                model.setValue(value.content);
                model.pushStackElement?.();
              } finally {
                silentReloadRef.current.delete(path);
              }
            }
            setOpenFiles((list) =>
              list.map((entry) => (entry.path === path ? { ...entry, content: value.content, dirty: false, mtime: value.mtime ?? entry.mtime } : entry)),
            );
            delete findings[path];
          } catch {
            /* an unreadable file keeps its banner instead of silently vanishing */
          }
        }
        setExternalChanges(findings);
      }, []);

      /**
       * Follow the workspace's real filesystem changes (SSE from the host).
       *
       * The 4-second git-signature poll this replaces had three faults: it missed
       * changes for up to 4s, it re-read the WHOLE tree on any change (which is
       * what made the list flash), and it never fired at all outside a repository.
       * The host now watches the directory tree and reports which directories
       * changed, so only those listings are re-read; unchanged ones keep their
       * array identity and re-render nothing.
       */
      React.useEffect(() => {
        if (root === '') return undefined;
        const sessionId = currentSessionId();
        if (sessionId === '') return undefined;
        const controller = new AbortController();
        let disposed = false;
        let chain = Promise.resolve();
        const handle = (event) => {
          if (disposed) return;
          if (event.type === 'change') {
            const dirs = Array.isArray(event.dirs) ? event.dirs : null;
            /* Serialize: two overlapping refreshes would interleave their state
               writes and one could resurrect a listing the other just dropped. */
            chain = chain
              .then(async () => {
                if (disposed) return;
                /* The watcher names the directories that changed; without that hint
                   only the root is re-read. */
                await refreshTree(dirs === null ? undefined : dirs);
                await loadGit();
                await checkExternalChanges();
              })
              .catch(() => {
                /* a Session that went away mid-refresh just stops reporting */
              });
            return;
          }
          if (event.type === 'error') {
            /* The watcher is best-effort: keep the tree usable without it. */
            console.warn('dsh-editor: file watch failed', event.message);
          }
        };
        const url = `api/dsh-editor/watch?sessionId=${encodeURIComponent(sessionId)}`;
        fetch(url, { signal: controller.signal, headers: { accept: 'text/event-stream' } })
          .then((response) => {
            if (!response.ok) throw new Error(`file watch HTTP ${response.status}`);
            return readEventStream(response, handle, controller.signal);
          })
          .catch((failure) => {
            if (controller.signal.aborted || disposed) return;
            console.warn('dsh-editor: file watch disconnected', failure instanceof Error ? failure.message : String(failure));
          });
        return () => {
          disposed = true;
          controller.abort();
        };
      }, [checkExternalChanges, loadGit, refreshTree, root]);

      /* Notice edits made outside the editor (another window, a shell, an agent).
         A slow backstop for the watcher: it still catches what `fs.watch` misses
         (network mounts, editors that swap the inode) and keeps git status fresh
         even when the filesystem is quiet. */
      const signatureRef = React.useRef('');
      const pollingRef = React.useRef(false);
      React.useEffect(() => {
        const interval = window.setInterval(async () => {
          if (pollingRef.current || document.visibilityState === 'hidden') return;
          pollingRef.current = true;
          try {
            const value = await callGit({ op: 'signature' });
            const signature = value?.signature ?? '';
            if (signature === '') return;
            if (signatureRef.current === '') {
              signatureRef.current = signature;
              return;
            }
            if (signature === signatureRef.current) return;
            signatureRef.current = signature;
            await loadGit();
            await refreshTree();
            await checkExternalChanges();
          } catch {
            /* a workspace that is not a repository has nothing to poll */
          } finally {
            pollingRef.current = false;
          }
        }, 8000);
        return () => window.clearInterval(interval);
      }, [checkExternalChanges, loadGit, refreshTree]);

      /* Cycle name → type → modified and reload the tree with the new ordering. */
      const cycleSort = React.useCallback(() => {
        setSortMode((current) => {
          const order = ['name', 'type', 'modified'];
          const next = order[(order.indexOf(current) + 1) % order.length];
          try {
            window.localStorage.setItem('dsh-editor.project.sort', next);
          } catch {
            /* a storage-less browser keeps the in-memory mode */
          }
          return next;
        });
      }, []);

      /**
       * Keep the selected row on screen across a re-sort.
       *
       * Changing the order re-reads the root, and the selected file lands wherever
       * the new order puts it — often below the fold. IDEA keeps the row you were
       * on visible, so the tree is scrolled back to it once the new listing has
       * rendered (the row may not exist for a frame, hence the bounded retry).
       * @returns {void}
       */
      React.useEffect(() => {
        if (sortAppliedRef.current === '') {
          sortAppliedRef.current = sortMode;
          return;
        }
        if (sortAppliedRef.current === sortMode) return;
        sortAppliedRef.current = sortMode;
        const path = selectedPathRef.current;
        if (path === null || path === '') return;
        let tries = 0;
        const tick = () => {
          const row = rowRefs.current.get(path);
          if (row !== undefined) {
            row.scrollIntoView({ block: 'nearest' });
            return;
          }
          tries += 1;
          if (tries < 20) window.requestAnimationFrame(tick);
        };
        window.requestAnimationFrame(tick);
      }, [sortMode]);

      /**
       * Flip IDEA's "Autoscroll from Source" and remember the choice.
       *
       * Turning it ON takes effect immediately (the effect re-runs on the new
       * value), so the tree jumps to the open file without a second click.
       * @returns {void}
       */
      const toggleAutoScroll = React.useCallback(() => {
        setAutoScroll((current) => {
          const next = !current;
          try {
            window.localStorage.setItem('dsh-editor.project.autoscroll', next ? '1' : '0');
          } catch {
            /* a storage-less browser keeps the in-memory choice */
          }
          return next;
        });
      }, []);

      /* Start the inline create row in the selected directory. */
      const startCreate = React.useCallback(
        (kind, explicitParent) => {
          let parent = typeof explicitParent === 'string' ? explicitParent : '';
          if (typeof explicitParent !== 'string') {
            const selected = selectedPath;
            if (selected !== null && selected !== '') {
              const row = rows.find((entry) => entry.path === selected);
              parent = row?.kind === 'directory' ? selected : dirname(selected);
            }
          }
          setActivity('project');
          setPanelVisible(true);
          /* Templates are on by default, like IDEA's New-from-Template dialog. */
          setCreateState({ kind, parent, value: '', template: true });
        },
        [rows, selectedPath],
      );

      const createEntry = React.useCallback(async () => {
        if (createState === null) return;
        const name = createState.value.trim();
        if (name === '' || name.includes('/') || name === '.' || name === '..') {
          setTreeError(t('editor.invalidNameNoSlashes'));
          return;
        }
        const path = createState.parent === '' ? name : `${createState.parent}/${name}`;
        try {
          await callFs({ op: 'create', path, kind: createState.kind });
          /* IDEA's "New from Template": a named file gets the language's skeleton
             instead of a zero-byte file. The host creates first and the content
             follows, so a template failure cannot leave no file at all. Only when
             the user kept the toggle on (it is on by default, as in IDEA). */
          if (createState.kind === 'file' && createState.template !== false) {
            const skeleton = templateFor(name);
            if (skeleton !== '') {
              await callFs({ op: 'write', path, content: skeleton, force: true, create: true }).catch(() => {});
            }
          }
          const value = await callFs({ op: 'list', path: createState.parent, showHidden, sort: sortMode });
          if (createState.parent === '') setEntries(value.entries ?? []);
          else setChildren((current) => ({ ...current, [createState.parent]: value.entries ?? [] }));
          setExpanded((current) => {
            const next = new Set(current);
            next.add(createState.parent);
            return next;
          });
          setSelectedPath(path);
          setCreateState(null);
          setTreeError(null);
          /* IDEA drops straight into "rename" on a freshly created entry. */
          setRenameState({ path, value: name, fresh: true });
          if (createState.kind === 'file') await openFile(path);
        } catch (error) {
          setTreeError(error instanceof Error ? error.message : String(error));
        }
      }, [createState, openFile, showHidden, sortMode, t]);

      /* IDEA's "Reveal in Finder": hand the absolute path to the platform file manager. */
      const revealInFinder = React.useCallback(async (path) => {
        try {
          await callFs({ op: 'reveal', path });
        } catch (failure) {
          setTreeError(failure instanceof Error ? failure.message : String(failure));
        }
      }, []);

      /**
       * IDEA's "Open in Terminal": reveal the dock and start a shell in that directory.
       *
       * The dock only knows the Session workspace, so a subdirectory is reached by
       * committing `cd <relative>` to the new shell — the same thing a user does.
       * @param {string} relativeDirectory - workspace-relative directory to enter.
       */
      const openInTerminal = React.useCallback(
        (relativeDirectory) => {
          pendingTerminalPath.current = relativeDirectory;
          setTerminalStartDirectory(relativeDirectory);
          setTerminalOpen(true);
          setTerminalGeneration((generation) => generation + 1);
        },
        [],
      );



      const restage = React.useCallback(
        async (paths, staged) => {
          if (paths.length === 0) return;
          setCommitBusy(true);
          setCommitError(null);
          try {
            const value = await callGit({ op: 'stage', paths, staged });
            setGit(value);
            setCommitSelection((current) => {
              const next = new Set([...current].filter((path) => (value?.changes ?? []).some((change) => change.path === path)));
              return next;
            });
            setDiffTarget(null);
          } catch (failure) {
            setCommitError(failure instanceof Error ? failure.message : String(failure));
          } finally {
            setCommitBusy(false);
          }
        },
        [],
      );
      /* The ⌘⇧A/⌥⌘A handler is registered once, so it reaches the stager by ref. */
      restageRef.current = restage;

      /**
       * The "Group by" menu: flat, module, or the full directory tree.
       *
       * IDEA puts this next to the change list, and the choice is a view
       * preference — it never changes what gets committed, only how the rows are
       * nested. The current mode carries a check mark so the popup says where
       * you are as well as where you can go.
       * @param {{x: number, y: number}} position - where to open the popup.
       * @returns {object} menu descriptor for the shared popup.
       */
      const changeGroupMenu = React.useCallback((position) => ({
        x: position.x,
        y: position.y,
        title: t('editor.groupByMenu'),
        items: ['flat', 'module', 'directory'].map((mode) => ({
          id: `groupBy:${mode}`,
          label: t(`editor.groupBy_${mode}`),
          shortcut: groupBy === mode ? '✓' : '',
          run: () => {
            setGroupBy(mode);
            try {
              window.localStorage.setItem('dsh-editor.commit.groupBy', mode);
            } catch {
              /* a storage-less browser keeps the in-memory mode */
            }
          },
        })),
      }), [groupBy, t]);

      /**
       * Open IDEA's "Move to…" picker for the current tree selection.
       *
       * The picker asks the host for every directory: building the list from the
       * expanded rows would hide any folder the user has not opened, which is
       * exactly the folder a move usually targets.
       * @param {string|string[]} [target] - one path or a batch; defaults to the selection.
       * @returns {Promise<void>} resolves once the picker is on screen.
       */
      const openMoveTo = React.useCallback(async (target) => {
        const raw = Array.isArray(target) ? target : target === undefined ? [...selection] : [target];
        /* The root row is a directory but moving the root into itself is meaningless. */
        const sources = raw.filter((path) => typeof path === 'string' && path !== '');
        if (sources.length === 0) return;
        const parent = sources.length === 1 ? dirname(sources[0]) : '';
        setMoveTo({ sources, parent, query: '', index: 0, loading: true, directories: [], rootName: projectName });
        try {
          const value = await callFs({ op: 'directories' });
          const directories = (value.directories ?? []).filter((path) => typeof path === 'string');
          setMoveTo((current) => (current === null ? current : { ...current, loading: false, directories }));
        } catch (failure) {
          setMoveTo(null);
          setTreeError(failure instanceof Error ? failure.message : String(failure));
        }
      }, [projectName, selection]);

      /* IDEA's project-tree context menu: new/rename/delete/reveal/copy path. */
      const buildTreeMenu = React.useCallback(
        ({ row, x, y }) => {
          const isDirectory = row.kind === 'directory';
          const isRoot = row.path === '';
          /* Where a NEW entry lands: beside the clicked entry, which is inside a
             clicked directory and next to a clicked file. Rename cannot reuse this
             — it keeps the entry in its own parent — so it derives its own
             destination (see `commitRename`). */
          const createParent = isDirectory ? row.path : dirname(row.path);
          /* A right-click inside a multi-row selection acts on all selected rows. */
          const selectedRows = selection.has(row.path) ? rows.filter((entry) => selection.has(entry.path) && entry.path !== '') : [];
          const batch = selectedRows.length > 1 ? selectedRows : [];
          return {
            x,
            y,
            /* IDEA tells you how many rows a context action will touch. */
            title: batch.length > 1 ? t('editor.selectionCount', { count: batch.length }) : null,
            items: [
              {
                id: 'newFile',
                label: t('editor.newFile'),
                shortcut: '⌥⌘N',
                /* Enabled on files too: the new entry goes beside the clicked
                   one. Greying it out on a file looked like "disabled because
                   something is wrong" and forced a trip through its folder. */
                disabled: batch.length > 1,
                run: () => startCreate('file', createParent),
              },
              {
                id: 'newFolder',
                label: t('editor.newFolder'),
                disabled: batch.length > 1,
                run: () => startCreate('directory', createParent),
              },
              null,
              {
                id: 'rename',
                label: t('editor.rename'),
                shortcut: '⇧F6',
                disabled: isRoot || batch.length > 1,
                run: () => setRenameState({ path: row.path, value: row.name }),
              },
              {
                id: 'moveTo',
                label: t('editor.moveTo'),
                shortcut: 'F6',
                disabled: isRoot,
                /* A batch keeps its members' names, so the picker collects them all. */
                run: () => void openMoveTo(batch.length > 1 ? batch.map((entry) => entry.path) : row.path),
              },
              {
                id: 'delete',
                label: batch.length > 1 ? t('editor.deleteSelected', { count: batch.length }) : t('editor.delete'),
                shortcut: '⌫',
                danger: true,
                disabled: isRoot,
                run: () => void (batch.length > 1 ? removeEntries(batch.map((entry) => entry.path)) : removeEntry(row)),
              },
              null,
              {
                id: 'open',
                label: isDirectory ? t('editor.expandFolder') : t('editor.openInEditor'),
                /* Multi-row selections act in bulk, so the single-row action is disabled. */
                disabled: isRoot || batch.length > 1,
                run: () => (isDirectory ? void toggleDirectory(row.path) : void openFile(row.path)),
              },
              {
                id: 'reveal',
                label: t('editor.reveal'),
                disabled: !isDirectory,
                run: () => setExpanded((current) => new Set([...current, row.path])),
              },
              {
                id: 'openTerminal',
                label: t('editor.openInTerminal'),
                run: () => void openInTerminal(isDirectory ? row.path : dirname(row.path)),
              },
              {
                id: 'refresh',
                label: t('editor.refresh'),
                shortcut: '⌘R',
                run: () => void refreshTree(),
              },
              {
                id: 'revealFinder',
                label: t('editor.revealInFinder'),
                run: () => void revealInFinder(row.path),
              },
              {
                id: 'history',
                label: t('editor.showHistory'),
                disabled: isRoot,
                run: () => void showFileHistory(row.path),
              },
              {
                id: 'compareClipboard',
                label: t('editor.compareWithClipboard'),
                disabled: isRoot || isDirectory,
                run: () => void compareWithClipboard(row.path),
              },
              {
                id: 'compareRevision',
                label: t('editor.compareWithRevision'),
                disabled: isRoot || isDirectory,
                run: () => void compareWithRevision(row.path),
              },
              {
                id: 'stageHere',
                label: t('editor.stageThisDirectory'),
                disabled: isRoot || !isDirectory || (git?.changes ?? []).length === 0,
                run: () => {
                  const inside = (git?.changes ?? []).filter((change) => change.path === row.path || change.path.startsWith(`${row.path}/`)).map((change) => change.path);
                  if (inside.length > 0) void restage(inside, false);
                },
              },
              {
                id: 'unstageHere',
                label: t('editor.unstageThisDirectory'),
                disabled: isRoot || !isDirectory || (git?.changes ?? []).length === 0,
                run: () => {
                  const inside = (git?.changes ?? []).filter((change) => (change.path === row.path || change.path.startsWith(`${row.path}/`)) && change.staged === true).map((change) => change.path);
                  if (inside.length > 0) void restage(inside, true);
                },
              },
              null,
              {
                id: 'copyPath',
                label: batch.length > 1 ? t('editor.copySelectedPaths', { count: batch.length }) : t('editor.copyPath'),
                run: () => {
                  const absolute = batch.length > 1
                    ? batch.map((entry) => `${root}/${entry.path}`).join('\n')
                    : row.path === '' ? root : `${root}/${row.path}`;
                  void navigator.clipboard?.writeText(absolute).catch(() => {});
                },
              },
              {
                id: 'copyPosition',
                label: t('editor.copyPathWithLine'),
                disabled: isRoot || isDirectory || batch.length > 1,
                run: () => {
                  /* Only the file actually open in the editor has a caret to quote;
                     quoting another file's caret would point at the wrong place. */
                  const target = pathWithLine(row.path, editorRef.current?.getPosition?.() ?? null, activePathRef.current === row.path);
                  void navigator.clipboard?.writeText(target).catch(() => {});
                },
              },
              {
                id: 'copyRelative',
                label: t('editor.copyRelativePath'),
                disabled: isRoot || batch.length > 1,
                run: () => void navigator.clipboard?.writeText(row.path).catch(() => {}),
              },
              {
                /* The absolute form is what you paste into a shell; quoting it keeps a
                   path with spaces one argument (IDEA's "Copy Path" behaves the same). */
                id: 'copyAbsolute',
                label: t('editor.copyAbsolutePath'),
                disabled: batch.length > 1,
                run: () => void navigator.clipboard?.writeText(shellQuote(root === '' ? row.path : `${root}/${row.path}`.replace(/\/+/g, '/'))).catch(() => {}),
              },
            ],
          };
        },
        [compareWithClipboard, compareWithRevision, git, openFile, openInTerminal, openMoveTo, refreshTree, removeEntries, removeEntry, restage, revealInFinder, root, rows, selection, showFileHistory, startCreate, t, toggleDirectory],
      );
      /* Move one entry into a directory by drag-and-drop, reusing the rename endpoint. */
      const moveEntry = React.useCallback(
        async (source, targetDirectory) => {
          /* A multi-row drag arrives as a list; a single row drag as one string. */
          const sources = (Array.isArray(source) ? source : [source]).filter((entry) => typeof entry === 'string' && entry !== '');
          if (sources.length === 0) return;
          /* Plan the whole selection first: a destination that already exists (or
             a batch whose members share a basename) is refused BEFORE the first
             rename, so a failed drag never leaves the tree half-moved.
             The candidate destinations are ASKED OF THE HOST, not read off the
             visible rows: a collapsed directory's children are not in `rows`, and
             a collision with one of them used to slip through and silently
             overwrite the file. */
          const candidate = sources
            .filter((entry) => !(targetDirectory === entry || targetDirectory.startsWith(`${entry}/`)))
            .map((entry) => (targetDirectory === '' ? basename(entry) : `${targetDirectory}/${basename(entry)}`));
          const described = candidate.length === 0
            ? []
            : await callFs({ op: 'exists', paths: candidate }).catch(() => []);
          const taken = new Set((described ?? []).filter((entry) => entry.exists === true).map((entry) => entry.path));
          const existing = new Set([...rows.map((row) => row.path), ...taken]);
          const plan = planMoves(sources, targetDirectory, existing);
          if (plan.moves.length === 0) {
            if (plan.intoSelf.length > 0) setTreeError(t('editor.moveIntoSelf'));
            else if (plan.conflicts.length > 0) setTreeError(t('editor.moveConflict', { path: plan.conflicts[0].to }));
            return;
          }
          const moved = {};
          try {
            for (const move of plan.moves) {
              await callFs({ op: 'rename', path: move.from, to: move.to });
              moved[move.from] = move.to;
            }
            const entries = Object.entries(moved);
            if (entries.length === 0) return;
            /* The refusal sentence names what DID move; built once, shown after
               the refresh (which clears `treeError`). */
            const summary = describeMoveResult({ moved: entries.map(([, to]) => to), conflicts: plan.conflicts, target: targetDirectory });
            const moveNotice = summary === null
              ? null
              : summary.blocked === undefined
                /* A clean move still needs an acknowledgement: silence reads like a no-op. */
                ? t('editor.movedCount', { count: summary.done, target: summary.target === '' ? t('editor.projectRoot') : summary.target })
                : describeMoved(entries.map(([, to]) => to), summary.blocked, t);
            /* Open tabs follow their files, whichever rows were dragged. */
            setOpenFiles((current) =>
              current.map((file) => {
                const hit = entries.find(([from, to]) => file.path === from || file.path.startsWith(`${from}/`));
                return hit === undefined ? file : { ...file, path: `${hit[1]}${file.path.slice(hit[0].length)}` };
              }),
            );
            setActivePath((current) => {
              const hit = entries.find(([from, to]) => current === from || current?.startsWith(`${from}/`) === true);
              return hit === undefined ? current : `${hit[1]}${current.slice(hit[0].length)}`;
            });
            setSelection(new Set(entries.map(([, to]) => to)));
            setSelectedPathRaw(entries[entries.length - 1][1]);
            await refreshTree();
            await loadGit();
            /* After the refresh, not before: `refreshTree` reloads the root and
               that reload clears `treeError`, so a message set first was wiped
               before it could be read. */
            setTreeError(moveNotice);
          } catch (failure) {
            setTreeError(failure instanceof Error ? failure.message : String(failure));
          }
        },
        [loadGit, refreshTree, rows, t],
      );

      /* Resolve one conflicted file by taking ours/theirs, then refresh the change list. */
      const resolveConflict = React.useCallback(
        async (paths, side) => {
          if (paths.length === 0) return;
          setCommitBusy(true);
          setCommitError(null);
          try {
            const value = await callGit({ op: 'resolve', paths, side });
            setGit(value);
            setCommitSelection(new Set((value?.changes ?? []).map((change) => change.path)));
            setDiffTarget(null);
            await refreshTree();
          } catch (failure) {
            setCommitError(failure instanceof Error ? failure.message : String(failure));
          } finally {
            setCommitBusy(false);
          }
        },
        [refreshTree],
      );

      /* IDEA's change-list menu: show diff, stage/unstage, roll back the working-tree edits. */
      /**
       * Apply one history rewrite action and bring the panel back in sync.
       *
       * A stopped cherry-pick or revert leaves the repository mid-operation, so
       * the failure stays visible as an error with git's own first line instead
       * of being reported as a generic success.
       * @param {'cherryPick'|'revert'} operation - git action to run.
       * @param {string} hash - commit to act on.
       */
      /**
       * Check out one commit (IDEA's "Checkout Revision").
       *
       * Detached HEAD is destructive-looking but reversible, so it asks once and then
       * refreshes both the tree and the graph — the working tree contents change.
       * @param {string} hash - commit to check out.
       * @returns {Promise<void>} resolves when the refresh finishes.
       */
      const checkoutRevision = React.useCallback(async (hash) => {
        if (typeof hash !== 'string' || hash === '') return;
        if (!window.confirm(t('editor.checkoutRevisionConfirm', { hash: hash.slice(0, 7) }))) return;
        setCommitBusy(true);
        setCommitError(null);
        setCommitNotice(null);
        try {
          const value = await callGit({ op: 'checkoutRevision', hash });
          setGit(value);
          setCommitSelection(new Set());
          setDiffTarget(null);
          setCommitNotice(t('editor.checkoutRevisionDone', { hash: hash.slice(0, 7) }));
          await refreshTree();
          await loadLog();
        } catch (failure) {
          setCommitError(failure instanceof Error ? failure.message : String(failure));
        } finally {
          setCommitBusy(false);
        }
      }, [loadLog, refreshTree, t]);

      const runHistoryAction = React.useCallback(async (operation, hash) => {
        if (typeof hash !== 'string' || hash === '') return;
        const label = operation === 'cherryPick' ? t('editor.cherryPick') : t('editor.revertCommit');
        if (!window.confirm(t('editor.historyActionConfirm', { action: label, hash: hash.slice(0, 7) }))) return;
        setCommitBusy(true);
        setCommitError(null);
        setCommitNotice(null);
        try {
          const value = await callGit({ op: operation, hash });
          setGit(value);
          setCommitSelection(new Set((value?.changes ?? []).map((change) => change.path)));
          setDiffTarget(null);
          setCommitNotice(t('editor.historyActionDone', { action: label }));
          await refreshTree();
          await loadLog();
        } catch (failure) {
          setCommitError(failure instanceof Error ? failure.message : String(failure));
        } finally {
          setCommitBusy(false);
        }
      }, [loadLog, refreshTree, t]);

      /**
       * Restore one file to its content at a commit, IDEA's "Revert Selected Changes".
       *
       * Only that one path is written; the working tree otherwise stays as it is.
       * @param {{hash: string, path: string}} input - revision and workspace path.
       */
      const restoreFileAtCommit = React.useCallback(async ({ hash, path }) => {
        if (typeof hash !== 'string' || typeof path !== 'string' || path === '') return;
        if (!window.confirm(t('editor.restoreFileConfirm', { path, hash: hash.slice(0, 7) }))) return;
        setCommitBusy(true);
        setCommitError(null);
        try {
          const value = await callGit({ op: 'restoreFile', hash, path });
          setGit(value);
          setCommitNotice(t('editor.restoreFileDone', { path }));
          await refreshTree();
          /* An open tab must not keep showing the pre-restore bytes. */
          if (openFilesRef.current.some((file) => file.path === path)) await reloadFile(path);
        } catch (failure) {
          setCommitError(failure instanceof Error ? failure.message : String(failure));
        } finally {
          setCommitBusy(false);
        }
      }, [reloadFile, refreshTree, t]);

      /* IDEA's Log row context menu: diff, history, cherry-pick and revert. */
      /**
       * Open the history of the first file touched by the RIGHT-CLICKED commit.
       *
       * Reading `logDetail` would use whatever commit happened to be selected
       * before the menu opened, which is often a different row — the user then
       * sees another commit's file history.
       * @param {string} hash - commit whose first changed file to follow.
       * @returns {Promise<void>} resolves once the history is shown.
       */
      const showCommitHistory = React.useCallback(async (hash) => {
        if (typeof hash !== 'string' || hash === '') return;
        try {
          const detail = await callGit({ op: 'show', hash });
          const first = (detail?.files ?? [])[0];
          if (first === undefined) {
            setCommitNotice(t('editor.noChangedFiles'));
            return;
          }
          void showFileHistory(first.path);
        } catch (failure) {
          setCommitError(failure instanceof Error ? failure.message : String(failure));
        }
      }, [showFileHistory, t]);

      /**
       * Context menu for a file row in a commit's detail pane.
       *
       * IDEA's version of this menu starts with "Jump to Source"; the tree is
       * this plugin's source view, so the first entry selects the working copy
       * there and the second opens it in the editor.
       * @param {{path: string, x: number, y: number}} payload - clicked file.
       * @returns {object} menu descriptor for the shared popup.
       */
      const buildCommitFileMenu = React.useCallback(
        ({ path, x, y }) => ({
          x,
          y,
          items: [
            { id: 'reveal', label: t('editor.revealInProject'), run: () => void revealPath(path) },
            { id: 'open', label: t('editor.openInEditor'), run: () => void openFile(path) },
            { id: 'history', label: t('editor.showHistory'), run: () => void showFileHistory(path) },
            { id: 'copyRelative', label: t('editor.copyRelativePath'), run: () => void navigator.clipboard?.writeText(path).catch(() => {}) },
          ],
        }),
        [openFile, revealPath, showFileHistory],
      );

      const buildLogMenu = React.useCallback(
        ({ commit, x, y }) => ({
          x,
          y,
          items: [
            {
              id: 'show',
              label: t('editor.openCommitDetails'),
              run: () => void showCommit(commit.hash),
            },
            {
              id: 'history',
              label: t('editor.fileHistoryOfCommit'),
              run: () => void showCommitHistory(commit.hash),
            },
            null,
            {
              id: 'cherryPick',
              label: t('editor.cherryPick'),
              run: () => void runHistoryAction('cherryPick', commit.hash),
            },
            {
              id: 'revert',
              label: t('editor.revertCommit'),
              danger: true,
              run: () => void runHistoryAction('revert', commit.hash),
            },
            null,
            {
              id: 'createTag',
              label: t('editor.createTagAction'),
              run: () => setNamePrompt({
                kind: 'tag',
                title: t('editor.createTagAction'),
                placeholder: t('editor.createTagPlaceholder'),
                value: '',
                hash: commit.hash,
                error: '',
              }),
            },
            null,
            {
              /* IDEA puts "Checkout Revision" in the log's context menu; without it a
                 revision can only be inspected, never returned to. */
              id: 'checkoutRevision',
              label: t('editor.checkoutRevision'),
              run: () => void checkoutRevision(commit.hash),
            },
            null,
            {
              id: 'copyHash',
              label: t('editor.copyHash'),
              run: () => void navigator.clipboard?.writeText(commit.hash).catch(() => {}),
            },
            {
              id: 'copySubject',
              label: t('editor.copySubject'),
              /* A log row always has a subject, but the menu is also built from
                 payloads the detail pane produces; an empty item is better than
                 copying the string "undefined". */
              disabled: typeof commit.subject !== 'string' || commit.subject === '',
              run: () => void navigator.clipboard?.writeText(commit.subject).catch(() => {}),
            },
          ],
        }),
        [runHistoryAction, showCommitHistory, t],
      );

      const buildChangeMenu = React.useCallback(
        ({ change, staged, x, y }) => ({
          x,
          y,
          items: [
            {
              id: 'diff',
              label: t('editor.showDiff'),
              shortcut: '⌘D',
              run: () => {
                setDiffTarget({ path: change.path, staged });
                setDiffActive(true);
              },
            },
            {
              id: 'open',
              label: t('editor.openInEditor'),
              run: () => void openFile(change.path),
            },
            null,
            {
              id: 'stage',
              label: staged ? t('editor.unstageAction') : t('editor.stageAction'),
              /* The key exists (⌘⇧A / ⌥⌘A); printing it is how it becomes
                 discoverable, the same way ⌥⌘Z is printed on Rollback. */
              shortcut: staged ? '⌥⌘A' : '⌘⇧A',
              run: () => void restage([change.path], staged),
            },
            null,
            isConflict(change)
              ? {
                  id: 'acceptOurs',
                  label: t('editor.acceptOurs'),
                  run: () => void resolveConflict([change.path], 'ours'),
                }
              : null,
            isConflict(change)
              ? {
                  id: 'acceptTheirs',
                  label: t('editor.acceptTheirs'),
                  run: () => void resolveConflict([change.path], 'theirs'),
                }
              : null,
            /* One "Rollback" entry with the two discards nested: two flat rows of
               destructive actions read like unrelated commands. */
            {
              id: 'rollback',
              label: t('editor.rollback'),
              danger: true,
              items: [
                ...(staged
                  ? [{ id: 'rollbackStaged', label: t('editor.rollbackStaged'), danger: true, run: () => void rollback([change.path], { staged: true }) }]
                  : []),
                { id: 'rollbackWorking', label: t('editor.rollbackWorking'), shortcut: '⌥⌘Z', danger: true, run: () => void rollback([change.path]) },
              ],
            },
            null,
            {
              id: 'copyPath',
              label: t('editor.copyRelativePath'),
              run: () => void navigator.clipboard?.writeText(change.path).catch(() => {}),
            },
          ],
        }),
        [openFile, resolveConflict, restage, t],
      );

      /* Rollback discards edits, so it asks first — IDEA does the same for modified files. */
      const rollback = React.useCallback(
        async (paths, options) => {
          if (paths.length === 0) return;
          const stagedOnly = options?.staged === true;
          if (!window.confirm(t(stagedOnly ? 'editor.rollbackStagedConfirm' : 'editor.rollbackConfirm', { count: paths.length }))) return;
          setCommitBusy(true);
          setCommitError(null);
          try {
            const value = await callGit({ op: 'rollback', paths, ...(stagedOnly ? { staged: true } : {}) });
            setGit(value);
            setCommitSelection(new Set((value?.changes ?? []).map((change) => change.path)));
            setDiffTarget(null);
            await refreshTree();
            if (activePathRef.current !== null && paths.includes(activePathRef.current)) {
              await openFile(activePathRef.current);
            }
          } catch (failure) {
            setCommitError(failure instanceof Error ? failure.message : String(failure));
          } finally {
            setCommitBusy(false);
          }
        },
        [openFile, refreshTree, t],
      );

      /**
       * Context menu for one directory node in the change tree.
       *
       * IDEA acts on a directory's whole subtree: stage/unstage every file below
       * it, or roll the lot back. The paths are collected by the row (it already
       * holds `row.changes`), so the menu never re-derives the tree. Declared
       * after `rollback` because its dependency array names it.
       * @param {{directory: string, changes: object[], group: string, x: number, y: number}} payload - clicked node.
       * @returns {object} menu descriptor for the shared popup.
       */
      const buildChangeDirMenu = React.useCallback(
        ({ directory, changes: inside, group, x, y }) => {
          const paths = (inside ?? []).map((change) => change.path);
          return {
            x,
            y,
            title: basename(directory),
            items: [
              ...(group === 'staged'
                ? [{ id: 'unstageDirectory', label: t('editor.unstageThisDirectory'), run: () => void restage(paths, true) }]
                : [{ id: 'stageDirectory', label: t('editor.stageThisDirectory'), run: () => void restage(paths, false) }]),
              null,
              {
                id: 'rollbackDirectory',
                label: t('editor.rollbackDirectory'),
                danger: true,
                disabled: paths.length === 0,
                run: () => void rollback(paths),
              },
              null,
              {
                id: 'openDirectory',
                label: t('editor.revealInProject'),
                run: () => void revealPath(directory),
              },
              {
                id: 'openTerminal',
                label: t('editor.openInTerminal'),
                run: () => openInTerminal(directory),
              },
            ],
          };
        },
        [openInTerminal, restage, revealPath, rollback, t],
      );

      /**
       * ⌥⌘Z — "revert the working copy" for the row the Commit panel is showing.
       *
       * The context menu has advertised this shortcut since the two discards were
       * split, but nothing listened for it. It acts on the change selected in the
       * panel (the one the detail pane is about), and steps aside whenever a text
       * field or the editor owns the keyboard.
       * @param {Event} event - keydown from the window capture phase.
       * @returns {void}
       */
      const rollbackWorkingShortcut = React.useCallback((event) => {
        const meta = event.metaKey || event.ctrlKey;
        if (!event.altKey || !meta || event.shiftKey || event.key.toLowerCase() !== 'z') return;
        const target = event.target instanceof Element ? event.target : null;
        /* A terminal, a rename field or the code editor must keep the key. */
        if (target?.closest('.monaco-editor') != null) return;
        if (target?.closest('input, textarea, [contenteditable="true"]') != null) return;
        if (target?.closest('[data-dsh-editor-terminal]') != null) return;
        const path = selectedDiffPathRef.current ?? selectedCommitPathRef.current ?? activePathRef.current;
        if (path === null || path === undefined || path === '') return;
        event.preventDefault();
        event.stopPropagation();
        void rollback([path]);
      }, [rollback]);

      React.useEffect(() => {
        window.addEventListener('keydown', rollbackWorkingShortcut, true);
        return () => window.removeEventListener('keydown', rollbackWorkingShortcut, true);
      }, [rollbackWorkingShortcut]);

      /**
       * ⌘⇧A — stage, ⌥⌘A — unstage the Commit panel's current change.
       *
       * IDEA's changelist is fully keyboard-driven: reaching for the row's
       * checkbox is the only way to move one file between the bands here. The
       * shortcut acts on the file the panel is showing (the diff target, the
       * annotated file, or the open tab) and stands aside for text fields.
       * @param {KeyboardEvent} event - window keydown.
       * @returns {void}
       */
      const stageShortcut = React.useCallback((event) => {
        const meta = event.metaKey || event.ctrlKey;
        if (!meta || event.shiftKey === event.altKey || event.key.toLowerCase() !== 'a') return;
        const target = event.target instanceof Element ? event.target : null;
        if (target?.closest('.monaco-editor') != null) return;
        if (target?.closest('input, textarea, [contenteditable="true"]') != null) return;
        if (target?.closest('[data-dsh-editor-terminal]') != null) return;
        /* No Commit panel on screen: the shortcut has nothing to act on. */
        if (!panelVisibleRef.current || activityRef.current !== 'commit') return;
        const remembered = lastChangePathRef.current;
        const path = selectedDiffPathRef.current ?? selectedCommitPathRef.current ?? remembered?.path ?? activePathRef.current;
        if (path === null || path === undefined || path === '') return;
        const change = (gitRef.current?.changes ?? []).find((entry) => entry.path === path);
        if (change === undefined) return;
        /* Already in the requested band: the reverse action would be a surprise. */
        const staged = change.status[0] !== ' ' && change.status[0] !== '?';
        if (staged === event.shiftKey) return;
        event.preventDefault();
        event.stopPropagation();
        void restageRef.current([path], staged);
      }, []);

      React.useEffect(() => {
        window.addEventListener('keydown', stageShortcut, true);
        return () => window.removeEventListener('keydown', stageShortcut, true);
      }, [stageShortcut]);

      /**
       * ⌘D — open the diff of the current change, IDEA's "Show Diff" key.
       *
       * The change row menu has printed `⌘D` since the diff existed, but the key
       * did nothing unless the row was already selected and clicked. This opens (or
       * closes) the diff for whatever the Commit panel is pointing at, so a file can
       * be reviewed from the keyboard after staging it.
       * @param {KeyboardEvent} event - window keydown.
       * @returns {void}
       */
      const showDiffShortcut = React.useCallback((event) => {
        if (!(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey || event.key.toLowerCase() !== 'd') return;
        const target = event.target instanceof Element ? event.target : null;
        if (target?.closest('.monaco-editor') != null) return;
        if (target?.closest('input, textarea, [contenteditable="true"]') != null) return;
        if (target?.closest('[data-dsh-editor-terminal]') != null) return;
        if (!panelVisibleRef.current || activityRef.current !== 'commit') return;
        const remembered = lastChangePathRef.current;
        const path = selectedDiffPathRef.current ?? selectedCommitPathRef.current ?? remembered?.path ?? activePathRef.current;
        if (path === null || path === undefined || path === '') return;
        const change = (gitRef.current?.changes ?? []).find((entry) => entry.path === path);
        if (change === undefined) return;
        event.preventDefault();
        event.stopPropagation();
        const staged = change.status[0] !== ' ' && change.status[0] !== '?';
        setDiffTarget((current) => (current !== null && current.path === path && current.staged === staged ? null : { path, staged }));
        setDiffActive(true);
      }, []);

      React.useEffect(() => {
        window.addEventListener('keydown', showDiffShortcut, true);
        return () => window.removeEventListener('keydown', showDiffShortcut, true);
      }, [showDiffShortcut]);

      /* Apply a rename from the inline editor row. */
      const commitRename = React.useCallback(async () => {
        if (renameState === null) return;
        const name = renameState.value.trim();
        if (name === '' || name.includes('/') || name === '.' || name === '..') {
          setTreeError(t('editor.invalidName'));
          return;
        }
        /* The destination is derived from the ORIGINAL path, not from a stored
           `parent`: a rename keeps the entry in its own directory, and deriving it
           here means no caller can hand in a `parent` equal to the entry itself
           (which produced `assets/assets` and an EINVAL from the host). */
        const parent = dirname(renameState.path);
        const next = parent === '' ? name : `${parent}/${name}`;
        if (next === renameState.path) {
          /* A freshly created entry that keeps its name simply leaves edit mode. */
          setRenameState(null);
          return;
        }
        try {
          await callFs({ op: 'rename', path: renameState.path, to: next });
          if (openFilesRef.current.some((file) => file.path === renameState.path)) {
            setOpenFiles((current) => current.map((file) => (file.path === renameState.path ? { ...file, path: next } : file)));
            setActivePath((current) => (current === renameState.path ? next : current));
          }
          setRenameState(null);
          setSelectedPath(next);
          await refreshTree();
          await loadGit();
        } catch (failure) {
          setTreeError(failure instanceof Error ? failure.message : String(failure));
        }
      }, [loadGit, refreshTree, renameState, t]);

      const selectActivity = React.useCallback(
        (next) => {
          if (next === 'terminal') {
            setTerminalOpen((open) => !open);
            return;
          }
          /* The terminal dock is PERSISTENT, matching IDEA: switching to Project or
             Commit leaves the open shells exactly where they are. Hiding the dock
             on every tool-window switch lost the user's terminal while they looked
             at a diff, and the shell's output was scrolled away when it came back. */
          if (next === activity) {
            setPanelVisible((visible) => !visible);
            return;
          }
          setActivity(next);
          setPanelVisible(true);
        },
        [activity],
      );

      /**
       * Alt+F12, Alt+1..3 and Ctrl+Shift+` — IDEA's tool-window keys.
       *
       * IDEA raises a tool window with `Alt+<digit>` and its terminal with
       * `Alt+F12`. The digits used to be dead here: nothing opened Project or
       * Commit without the mouse, which is the difference between "a panel" and
       * "an IDE". A key that raises the active window again hides it, exactly as
       * IDEA's toggle does; the terminal keeps its own open/close behaviour.
       * @param {KeyboardEvent} event - window keydown.
       * @returns {void}
       */
      React.useEffect(() => {
        const onKeyDown = (event) => {
          if (event.altKey && !event.metaKey && !event.ctrlKey && event.key === 'F12') {
            event.preventDefault();
            setTerminalOpen((open) => !open);
            return;
          }
          if (event.altKey && !event.metaKey && !event.ctrlKey && (event.key === '1' || event.key === '2' || event.key === '3')) {
            event.preventDefault();
            selectActivity(event.key === '1' ? 'project' : event.key === '2' ? 'commit' : 'terminal');
            return;
          }
          if (event.ctrlKey && event.shiftKey && (event.code === 'Backquote' || event.key === '`' || event.key === '~')) {
            event.preventDefault();
            setTerminalOpen(true);
            setTerminalGeneration((generation) => generation + 1);
          }
        };
        window.addEventListener('keydown', onKeyDown, true);
        return () => window.removeEventListener('keydown', onKeyDown, true);
      }, [selectActivity]);

      /* Keyboard navigation over the visible flattened rows. */
      /* The typeahead's pending prefix, and when the last key arrived. */
      const typeaheadBuffer = React.useRef('');
      const typeaheadAt = React.useRef(0);

      const onTreeKeyDown = React.useCallback(
        (event) => {
          /* The inline rename field and the create row live inside the tree, so their
             keydown bubbles here. Without this guard every letter typed into a rename
             would also run the typeahead and swallow the keystroke. */
          if (event.target instanceof Element && event.target.closest('input, textarea, select') !== null) return;
          if (rows.length === 0) return;
          /* IDEA's typeahead: a printable key moves the selection, and a pause of a
             second starts a new prefix. Modified keys (⌘N, ⌥…) are commands. */
          if (event.key.length === 1 && !event.metaKey && !event.ctrlKey && !event.altKey) {
            const step = typeaheadStep({
              rows,
              buffer: typeaheadBuffer.current,
              path: selectedPath,
              key: event.key,
              now: Date.now(),
              lastAt: typeaheadAt.current,
            });
            typeaheadBuffer.current = step.buffer;
            typeaheadAt.current = step.at;
            if (step.hit !== null) {
              event.preventDefault();
              setSelectedPath(step.hit);
              window.setTimeout(() => rowRefs.current.get(step.hit)?.scrollIntoView({ block: 'nearest' }), 0);
            }
            /* A prefix with no hit must not swallow the key: only claim it once
               something matched, so nothing else in the tree goes dead. */
            return;
          }
          /* Placeholder rows are not selectable, so arrow keys step over them. */
          const selectable = rows.filter((row) => row.kind !== 'placeholder');
          const currentIndex = selectedPath === null ? -1 : selectable.findIndex((row) => row.path === selectedPath);
          const current = currentIndex >= 0 ? selectable[currentIndex] : null;
          const focusRow = (index, extend = false) => {
            const row = selectable[Math.max(0, Math.min(index, selectable.length - 1))];
            if (row === undefined) return;
            if (extend) {
              /* Shift+Arrow grows the selection from the anchor, IDEA's range behaviour. */
              const anchor = selectionAnchor.current ?? selectedPath ?? row.path;
              const from = rows.findIndex((entry) => entry.path === anchor);
              const to = rows.findIndex((entry) => entry.path === row.path);
              if (from >= 0 && to >= 0) {
                const [start, end] = from <= to ? [from, to] : [to, from];
                setSelection(new Set(rows.slice(start, end + 1).map((entry) => entry.path)));
                setSelectedPathRaw(row.path);
              }
            } else {
              setSelectedPath(row.path);
            }
            window.setTimeout(() => rowRefs.current.get(row.path)?.scrollIntoView({ block: 'nearest' }), 0);
          };
          switch (event.key) {
            case 'ArrowDown':
              event.preventDefault();
              focusRow(currentIndex + 1, event.shiftKey);
              break;
            case 'ArrowUp':
              event.preventDefault();
              focusRow(currentIndex - 1, event.shiftKey);
              break;
            case 'ArrowRight':
              event.preventDefault();
              if (current?.kind === 'directory') {
                if (!expanded.has(current.path)) void toggleDirectory(current.path);
                else focusRow(currentIndex + 1);
              }
              break;
            case 'ArrowLeft':
              event.preventDefault();
              if (current?.kind === 'directory' && expanded.has(current.path)) {
                void toggleDirectory(current.path);
              } else if (current !== null && current.depth > 0) {
                for (let index = currentIndex - 1; index >= 0; index -= 1) {
                  if (rows[index].depth === current.depth - 1) {
                    focusRow(index);
                    break;
                  }
                }
              }
              break;
            case 'Enter':
              event.preventDefault();
              if (current === null) break;
              if (current.kind === 'directory') void toggleDirectory(current.path);
              else void openFile(current.path);
              break;
            case 'Home':
              event.preventDefault();
              focusRow(0);
              break;
            case 'End':
              event.preventDefault();
              focusRow(rows.length - 1);
              break;
            case 'F2':
              /* IDEA's ⇧F6 rename, reachable from the keyboard. */
              event.preventDefault();
              if (current !== null && current.path !== '') {
                setRenameState({ path: current.path, value: current.name });
              }
              break;
            case 'F6':
              /* ⇧F6 renames, F6 alone is IDEA's "Move to…". */
              if (current === null || current.path === '') break;
              event.preventDefault();
              if (event.shiftKey) {
                setRenameState({ path: current.path, value: current.name });
              } else {
                void openMoveTo(selection.size > 1 ? [...selection].filter((path) => path !== '') : current.path);
              }
              break;
            case 'Delete':
            case 'Backspace':
              event.preventDefault();
              if (selection.size > 1) void removeEntries([...selection]);
              else if (current !== null && current.path !== '') void removeEntry(current);
              break;
            case 'Escape':
              event.preventDefault();
              setRenameState(null);
              setCreateState(null);
              break;
            default:
              break;
          }
          /* ⌘/Ctrl+N opens a new file, ⌥⌘N a new directory — IDEA's Project shortcuts. */
          if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'n') {
            event.preventDefault();
            startCreate(event.altKey ? 'directory' : 'file');
          }
          /* ⌘R refreshes the tree, as the row menu advertises. */
          if ((event.metaKey || event.ctrlKey) && !event.altKey && !event.shiftKey && event.key.toLowerCase() === 'r') {
            event.preventDefault();
            void refreshTree();
          }
        },
        [expanded, openFile, openMoveTo, refreshTree, removeEntries, removeEntry, rows, selectedPath, selection, setSelectedPath, startCreate, toggleDirectory],
      );

      const toggleCommitPath = React.useCallback((path) => {
        setCommitSelection((current) => {
          const next = new Set(current);
          if (next.has(path)) next.delete(path);
          else next.add(path);
          return next;
        });
      }, []);

      /* One group's checkbox toggles every file in it, like IDEA's changelist node. */
      const toggleCommitGroup = React.useCallback(
        (group) => {
          const changes = git?.changes ?? [];
          const members = splitChanges(changes)[group] ?? [];
          setCommitSelection((current) => {
            const next = new Set(current);
            const all = members.length > 0 && members.every((change) => next.has(change.path));
            for (const change of members) {
              if (all) next.delete(change.path);
              else next.add(change.path);
            }
            return next;
          });
        },
        [git],
      );

      /* IDEA's "Add to .gitignore" from the unversioned node. */
      const addToGitignore = React.useCallback(
        async (paths) => {
          if (paths.length === 0) return;
          setCommitBusy(true);
          setCommitError(null);
          try {
            const value = await callGit({ op: 'ignore', paths });
            const added = value?.added ?? [];
            setCommitNotice(added.length === 0 ? t('editor.alreadyIgnored') : t('editor.addedToGitignore', { count: added.length }));
            await loadGit();
            await refreshTree();
          } catch (failure) {
            setCommitError(failure instanceof Error ? failure.message : String(failure));
          } finally {
            setCommitBusy(false);
          }
        },
        [loadGit, refreshTree, t],
      );

      /**
       * Flip one collapse key, or a whole list of them (the ⌥-click subtree case).
       *
       * Flipping a list against the SAME starting set is what makes the gesture
       * read as one action: deciding each key from a freshly read state would
       * toggle the first level and leave the rest in place.
       * @param {string|string[]} key - one collapse key or several.
       */
      const toggleCollapsedGroup = React.useCallback((key) => {
        const keys = Array.isArray(key) ? key : [key];
        if (keys.length === 0) return;
        setCollapsedGroups((current) => {
          const next = new Set(current);
          const collapse = !next.has(keys[0]);
          for (const entry of keys) {
            if (collapse) next.add(entry);
            else next.delete(entry);
          }
          writeCollapsedGroups(rootRef.current, next);
          return next;
        });
      }, []);

      /* Stage or unstage the ticked files without touching the rest of the index. */
      /* IDEA prefills the message box with the previous message while Amend is ticked. */
      /**
       * Toggle Amend, pre-filling the box from the previous commit.
       *
       * IDEA prefills subject AND body, and only when the box is empty: an amend
       * with a half-written new message must not be silently overwritten.
       */
      const toggleAmend = React.useCallback(
        (next) => {
          setAmend(next);
          if (!next) {
            /* Turning amend off restores what the user had before it was turned on. */
            if (preAmendMessage.current !== null) {
              setCommitMessage(preAmendMessage.current);
              preAmendMessage.current = null;
            }
            return;
          }
          const previous = git?.lastCommit;
          if (previous === null || previous === undefined) return;
          if (commitMessage.trim() !== '') return;
          preAmendMessage.current = commitMessage;
          const body = typeof previous.body === 'string' ? previous.body.trimEnd() : '';
          setCommitMessage(body === '' ? previous.subject : `${previous.subject}\n\n${body}`);
        },
        [commitMessage, git],
      );

      /**
       * Store one message in the per-workspace history, newest first.
       *
       * IDEA keeps roughly the last 20 messages; duplicates move to the top rather
       * than being appended twice, so ↑/↓ never cycles through the same text.
       * @param {string} message - submitted commit message.
       */
      const rememberMessage = React.useCallback(
        (message) => {
          const text = message.trim();
          if (text === '' || root === '') return;
          setMessageHistory((current) => {
            const next = [text, ...current.filter((entry) => entry !== text)].slice(0, 20);
            try {
              window.localStorage.setItem(`dsh-editor.commitHistory:${root}`, JSON.stringify(next));
            } catch {
              /* a storage-less browser keeps the in-memory history only */
            }
            return next;
          });
          setHistoryIndex(-1);
        },
        [root],
      );

      /**
       * Walk the message history with ↑/↓, returning to the draft after the oldest entry.
       * @param {number} direction - +1 older, -1 newer.
       */
      const recallMessage = React.useCallback(
        (direction) => {
          if (messageHistory.length === 0) return;
          /* Walking back past the newest entry must restore what the user had typed,
             not blank the box: the draft is not part of the history. */
          if (historyIndex === -1 && draftBeforeRecall.current === null) draftBeforeRecall.current = commitMessage;
          setHistoryIndex((current) => {
            const next = Math.max(-1, Math.min(messageHistory.length - 1, current + direction));
            if (next < 0) setCommitMessage(draftBeforeRecall.current ?? '');
            else setCommitMessage(messageHistory[next]);
            return next;
          });
        },
        [commitMessage, historyIndex, messageHistory],
      );

      /**
       * Put the just-committed message back into the box.
       *
       * IDEA's commit box has an undo for the clear; without it, a mis-click after
       * a long message means retyping it. The commit itself is never undone.
       */
      const restoreClearedMessage = React.useCallback(() => {
        if (clearedMessage === '') return;
        setCommitMessage(clearedMessage);
        setClearedMessage('');
        writeCommitDraft(root, clearedMessage);
      }, [clearedMessage, root]);

      /**
       * Push the current branch on its own, IDEA's "Push" action and the retry
       * path after a commit whose push was rejected.
       *
       * Publishing (no upstream yet) is handled by the host, so the failure the
       * user sees is the real reason rather than git's "no upstream" paragraph.
       */
      const pushNow = React.useCallback(async () => {
        setPushBusy(true);
        setPushError(null);
        try {
          const value = await callGit({ op: 'push' });
          setGit(value);
          setCommitNotice(value.published === true ? t('editor.pushedPublished', { branch: value.branch ?? '' }) : t('editor.pushed'));
          setCommitError(null);
        } catch (failure) {
          setPushError(failure instanceof Error ? failure.message : String(failure));
        } finally {
          setPushBusy(false);
        }
      }, [t]);

      /**
       * Fetch every remote without touching the working tree (IDEA's Fetch).
       *
       * Only remote-tracking refs move, so open buffers stay valid; the point of
       * running it is the refreshed `behind` count in the commit toolbar.
       * @returns {Promise<void>} resolves once the status has been refreshed.
       */
      const fetchNow = React.useCallback(async () => {
        setFetchBusy(true);
        setCommitError(null);
        try {
          const value = await callGit({ op: 'fetch' });
          setGit(value);
          setCommitNotice(t('editor.fetchDone', { count: (value?.remotes ?? []).length }));
          setPushError(null);
        } catch (failure) {
          setCommitError(failure instanceof Error ? failure.message : String(failure));
        } finally {
          setFetchBusy(false);
        }
      }, [t]);

      /**
       * IDEA's Update Project: fast-forward onto the upstream and re-read tabs.
       *
       * The working tree is rewritten by the update, so every open tab is read
       * again — otherwise the editor would show the pre-update text and the next
       * save would silently revert the update. Unsaved edits are confirmed first.
       * @returns {Promise<void>} resolves once the tree and tabs are refreshed.
       */
      const updateNow = React.useCallback(async () => {
        if ((openFilesRef.current ?? []).some((file) => file.dirty === true) && !window.confirm(t('editor.updateDirty'))) return;
        setUpdateBusy(true);
        setCommitError(null);
        setCommitNotice(null);
        try {
          const value = await callGit({ op: 'pull' });
          setGit(value);
          setDiffTarget(null);
          setExternalChanges({});
          await refreshTree();
          for (const file of openFilesRef.current) await reloadFile(file.path);
          /* The pull just moved HEAD: a Log tab still showing the old first page
             would hide the commits that arrived, so re-read it (and drop a file
             history filter, whose commit set the update may have rewritten). */
          setHistoryPath(null);
          await loadLog();
          setCommitNotice(t('editor.updateDone', { branch: value?.branch ?? '' }));
        } catch (failure) {
          setCommitError(failure instanceof Error ? failure.message : String(failure));
        } finally {
          setUpdateBusy(false);
        }
      }, [loadLog, reloadFile, refreshTree, t]);

      const commit = React.useCallback(
        async (push) => {
          const paths = [...commitSelection];
          if (commitMessage.trim() === '' || paths.length === 0) return;
          setCommitBusy(true);
          setCommitError(null);
          setCommitNotice(null);
          setPushError(null);
          try {
            const inspection = await callGit({ op: 'inspect', paths });
            /* inspect also reports the identity, so the guard costs no extra round trip. */
            setIdentityMissing(inspection.identity?.name === '' || inspection.identity?.email === '');
            if (inspection.conflicts.length > 0) {
              throw new Error(t('editor.commitConflicts', { count: inspection.conflicts.length }));
            }
            if (inspection.whitespace.length > 0 && !window.confirm(t('editor.commitWhitespace', { count: inspection.whitespace.length }))) {
              return;
            }
            /* IDEA warns that a commit leaves untracked files behind, but never blocks it. */
            const untrackedLeft = (git?.changes ?? []).filter((change) => change.status === '??' && !paths.includes(change.path));
            if (untrackedLeft.length > 0 && !window.confirm(t('editor.commitUntracked', { count: untrackedLeft.length }))) {
              return;
            }
            const value = await callGit({ op: 'commit', message: commitMessage, paths, amend, push });
            setGit(value);
            setCommitSelection(new Set((value?.changes ?? []).map((change) => change.path)));
            rememberMessage(commitMessage);
            /* Keep the text so the "cleared by mistake" case has a one-click undo. */
            setClearedMessage(commitMessage);
            setCommitMessage('');
            writeCommitDraft(root, '');
            setAmend(false);
            setDiffTarget(null);
            /* A rejected push keeps the commit: IDEA reports both outcomes separately. */
            setCommitNotice(t('editor.committed'));
            setCommitError(null);
            /* A rejected push keeps the commit: offer a dedicated retry rather than a bare message. */
            setPushError(value.pushError ?? null);
            setTreeError(null);
            /* IDEA refreshes the Log tab after a commit so the new row is there immediately. */
            await loadLog();
            /* Remember which commit we just made so the list can point at it. */
            const head = value?.lastCommit?.hash;
            if (typeof head === 'string' && head !== '') {
              setHighlightedCommit(head);
              setCommitMode('log');
            }
          } catch (error) {
            setCommitError(error instanceof Error ? error.message : String(error));
          } finally {
            setCommitBusy(false);
          }
        },
        [amend, commitMessage, commitSelection, git, loadLog, root, t],
      );

      const tabs = openFiles.map((file) => {
        const fileTabActive = diffActive === false && file.path === activePath;
        return React.createElement(
          'div',
          {
            key: file.path,
            className: fileTabActive ? 'dsh-editor-tab dsh-editor-tab-active' : 'dsh-editor-tab',
            style: { ...styles.tab, ...(fileTabActive ? styles.tabActive : null) },
            /* IDEA shows "name — full/path" and marks a dirty tab in its tooltip too. */
            title: file.dirty ? `${file.path} — ${t('editor.unsavedTitle')}` : file.path,
            onClick: () => {
              setActivePath(file.path);
              setDiffActive(false);
            },
            onAuxClick: (event) => {
              /* Middle-click closes a tab, like IDEA and every browser. */
              if (event.button !== 1) return;
              event.preventDefault();
              closeFile(file.path);
            },
            onContextMenu: (event) => {
              event.preventDefault();
              event.stopPropagation();
              setActivePath(file.path);
              setMenu({
                x: event.clientX,
                y: event.clientY,
                items: [
                  { id: 'close', label: t('editor.closeTab', { name: basename(file.path) }), shortcut: '⌘W', run: () => closeFile(file.path) },
                  { id: 'closeOthers', label: t('editor.closeOtherTabs'), run: () => closeOtherTabs(file.path) },
                  { id: 'closeAll', label: t('editor.closeAllTabs'), run: () => closeAllTabs() },
                  null,
                  { id: 'saveAll', label: t('editor.saveAll'), shortcut: '⌥⌘S', run: () => void saveAll() },
                  null,
                  { id: 'copyPath', label: t('editor.copyTabPath'), run: () => void navigator.clipboard?.writeText(root === '' ? file.path : `${root}/${file.path}`).catch(() => {}) },
                  { id: 'reveal', label: t('editor.revealInProject'), run: () => void revealActive(), disabled: file.path !== activePath },
                ],
              });
            },
          },
          React.createElement('span', null, basename(file.path)),
          file.dirty ? React.createElement('span', { style: { color: 'var(--dsw-alias-state-business-primary)' } }, '●') : null,
          React.createElement(
            'button',
            {
              type: 'button',
              style: styles.tabClose,
              'aria-label': t('editor.closeTab', { name: basename(file.path) }),
              onClick: (event) => {
                event.stopPropagation();
                closeFile(file.path);
              },
            },
            '×',
          ),
        );
      });

      /**
       * The diff's own editor tab, IDEA's "Commit: <name>".
       *
       * There is exactly ONE such tab: opening another change re-uses it and
       * swaps the content, the way IDEA replaces a single diff tab instead of
       * piling up one tab per changed file. A change or a commit's file reads
       * "Commit: <name>"; clipboard / revision comparisons read "Compare:".
       */
      const diffIsCompare = diffTarget !== null && (typeof diffTarget.clipboardText === 'string' || typeof diffTarget.revision === 'string');
      const diffTabName = diffTarget === null ? '' : t(diffIsCompare ? 'editor.compareTab' : 'editor.commitTab', { name: basename(diffTarget.path) });
      const diffTab =
        diffTarget === null
          ? null
          : React.createElement(
              'div',
              {
                key: 'dsh-editor-difftab',
                className: diffActive ? 'dsh-editor-tab dsh-editor-tab-active dsh-editor-diff-tab' : 'dsh-editor-tab dsh-editor-diff-tab',
                style: { ...styles.tab, ...(diffActive ? styles.tabActive : null) },
                title: `${diffTabName} — ${diffTarget.path}`,
                onClick: () => setDiffActive(true),
                onAuxClick: (event) => {
                  if (event.button !== 1) return;
                  event.preventDefault();
                  setDiffTarget(null);
                },
                onContextMenu: (event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  setDiffActive(true);
                  setMenu({
                    x: event.clientX,
                    y: event.clientY,
                    items: [
                      { id: 'close', label: t('editor.closeTab', { name: diffTabName }), shortcut: '⌘W', run: () => setDiffTarget(null) },
                      { id: 'openFile', label: t('editor.openInEditor'), run: () => void openFile(diffTarget.path) },
                    ],
                  });
                },
              },
              /* IDEA puts the diff glyph first: the tab reads as a change, not as
                 a file, and the name is clipped from the END so the prefix stays. */
              React.createElement(Icon, { name: 'commit', size: 11 }),
              React.createElement('span', { style: styles.tabLabel }, diffTabName),
              React.createElement(
                'button',
                {
                  type: 'button',
                  style: styles.tabClose,
                  'aria-label': t('editor.closeTab', { name: diffTabName }),
                  onClick: (event) => {
                    event.stopPropagation();
                    setDiffTarget(null);
                  },
                },
                '×',
              ),
            );

      /* One layout for this render: which tabs fit and which go to `»`. The diff
         tab is pinned FIRST, so the one tab the user is reading never overflows. */
      const allTabs = diffTab === null ? openFiles : [DIFF_TAB_KEY, ...openFiles];
      const activeTabKey = diffActive ? DIFF_TAB_KEY : activePath;
      const fileTabElement = (entry) => (entry === DIFF_TAB_KEY ? diffTab : tabs[openFiles.indexOf(entry)] ?? null);
      const fileTabLayout = overflowTabs(allTabs, visibleTabCount(tabStripWidth, allTabs.length), activeTabKey, (entry) => (entry === DIFF_TAB_KEY ? DIFF_TAB_KEY : entry.path));

      /* IDEA's breadcrumbs: workspace root › directories › the open file. */
      const breadcrumbSegments = activeFile !== null && diffOpen === false
        ? (() => {
            const parts = activeFile.path.split('/');
            const segments = [{ label: projectName, path: '', kind: 'root' }];
            let prefix = '';
            for (let index = 0; index < parts.length; index += 1) {
              prefix = prefix === '' ? parts[index] : `${prefix}/${parts[index]}`;
              segments.push({
                label: parts[index],
                path: prefix,
                kind: index === parts.length - 1 ? 'file' : 'directory',
              });
            }
            return segments;
          })()
        : [];

      return React.createElement(
        'div',
        { style: styles.root, 'data-dsh-editor-workspace': '' },
        /* No title/save/refresh bar: the tool-window toolbars already sit at the top,
           the breadcrumb strip names the open file, and saving belongs to ⌘/Ctrl+S
           (plus ⌥⌘S for "save all"), so a second row only cost vertical space. */
        menu === null ? null : React.createElement(ContextMenu, { menu, onClose: () => setMenu(null), t }),
        quickOpen === null
          ? null
          : React.createElement(QuickOpen, {
              t,
              mode: paletteMode,
              files: quickOpen.files ?? [],
              /* The palette marks changed files exactly like the tree does. */
              changes: new Map((git?.changes ?? []).map((change) => [change.path, change.status])),
              loading: quickOpen.loading === true,
              query: quickOpen.query,
              index: quickOpen.index,
              onQuery: (query) => setQuickOpen((current) => (current === null ? current : { ...current, query, index: 0 })),
              onMove: (direction, count) =>
                setQuickOpen((current) =>
                  current === null ? current : { ...current, index: count === 0 ? 0 : (current.index + direction + count) % count },
                ),
              onOpen: (path) => {
                setQuickOpen(null);
                void openFile(path);
              },
              onClose: () => setQuickOpen(null),
            }),
        namePrompt === null
          ? null
          : React.createElement(NamePrompt, {
              t,
              state: namePrompt,
              onChange: (value) => setNamePrompt((current) => (current === null ? current : { ...current, value, error: '' })),
              onSubmit: () => void submitNamePrompt(),
              onClose: () => setNamePrompt(null),
            }),
        moveTo === null
          ? null
          : React.createElement(MoveToPicker, {
              t,
              state: moveTo,
              onQuery: (query) => setMoveTo((current) => (current === null ? current : { ...current, query, index: 0 })),
              onMove: (direction, count) =>
                setMoveTo((current) =>
                  current === null ? current : { ...current, index: count === 0 ? 0 : (current.index + direction + count) % count },
                ),
              onPick: (directory) => {
                const sources = moveTo.sources ?? [];
                setMoveTo(null);
                void moveEntry(sources, directory);
              },
              onClose: () => setMoveTo(null),
            }),
        revisionPicker === null
          ? null
          : React.createElement(RevisionPicker, {
              t,
              state: revisionPicker,
              onQuery: (query) => setRevisionPicker((current) => (current === null ? current : { ...current, query, index: 0 })),
              onMove: (direction, count) =>
                setRevisionPicker((current) =>
                  current === null ? current : { ...current, index: count === 0 ? 0 : (current.index + direction + count) % count },
                ),
              onPick: (hash) => {
                const path = revisionPicker.path;
                setRevisionPicker(null);
                if (typeof hash === 'string' && hash !== '') setDiffTarget({ path, revision: hash, staged: false });
              },
              onClose: () => setRevisionPicker(null),
            }),
        React.createElement(
          'div',
          { style: styles.body },
          React.createElement(ActivityStripe, {
            activity,
            panelVisible,
            terminalOpen,
            onSelect: selectActivity,
            t,
          }),
          panelVisible
            ? React.createElement(
                'div',
                {
                  style: {
                    ...styles.sidePanel,
                    flex: `0 0 ${toolWidths[activity] ?? 25}%`,
                    cursor: sideDragging ? 'col-resize' : undefined,
                  },
                },
                activity === 'project'
                  ? React.createElement(ProjectPanel, {
                      t,
                      root,
                      home,
                      entries,
                      children,
                      expanded,
                      rows,
                      selectedPath,
                      selection,
                      git,
                      loading: treeLoading,
                      error: treeError,
                      createState,
                      onToggle: toggleDirectory,
                      onOpen: openFile,
                      onSelect: selectRow,
                      onNewFile: () => startCreate('file'),
                      onNewFolder: () => startCreate('directory'),
                      onGotoFile: () => void openQuickOpen(),
                      onRecent: () => openRecent(),
                      onCreateChange: (value) => setCreateState((current) => (current === null ? current : { ...current, value })),
                      onCreateCommit: createEntry,
                      onCreateCancel: () => setCreateState(null),
                      onCreateParent: (parent) => setCreateState((current) => (current === null ? current : { ...current, parent })),
                      onCreateTemplate: (template) => setCreateState((current) => (current === null ? current : { ...current, template })),
                      onReveal: revealActive,
                      onExpandAll: expandAll,
                      onCollapseAll: collapseAll,
                      onRefresh: refreshTree,
                      onHide: () => setPanelVisible(false),
                      rowRefs,
                      treeRef,
                      onTreeKeyDown,
                      onContextMenu: (payload) => setMenu(buildTreeMenu(payload)),
                      onDrop: (source, target) => void moveEntry(source, target),
                      onClearSelection: clearTreeSelection,
                      /* Rename is reached from the context menu and F2/⇧F6 only. */
                      showHidden,
                      sortMode,
                      onCycleSort: () => cycleSort(),
                      /* Remembered: whether dot-entries are visible is a reading
                         preference, not a per-session accident. */
                      onToggleHidden: () =>
                        setShowHidden((current) => {
                          const next = !current;
                          try {
                            window.localStorage.setItem('dsh-editor.project.showHidden', next ? '1' : '0');
                          } catch {
                            /* a storage-less browser keeps the in-memory choice */
                          }
                          return next;
                        }),
                      autoScroll,
                      onToggleAutoScroll: () => toggleAutoScroll(),
                      renameState,
                      onRenameChange: (value) => setRenameState((current) => (current === null ? current : { ...current, value })),
                      onRenameCommit: () => void commitRename(),
                      onRenameCancel: () => setRenameState(null),
                      deletedPaths,
                      newPaths,
                    })
                  : activity === 'commit'
                    ? React.createElement(CommitPanel, {
                        t,
                        git,
                        selectedPaths: commitSelection,
                        message: commitMessage,
                        amend,
                        busy: commitBusy,
                        error: commitError,
                        notice: commitNotice,
                        diffTarget,
                        collapsedGroups,
                        monacoReady,
                        onTogglePath: toggleCommitPath,
                        onToggleGroup: toggleCommitGroup,
                        onToggleDirectory: toggleCollapsedGroup,
                        onSelectDiff: (target) => {
                          /* Previewing from the panel always shows the diff, even
                             when the user had walked back to a file tab. A second
                             click on the same change toggles the preview off. */
                          const same = diffTarget !== null && diffActive && diffTarget.path === target.path && diffTarget.staged === target.staged;
                          setDiffTarget(same ? null : target);
                          setDiffActive(true);
                        },
                        onStage: (paths) => void restage(paths, false),
                        onUnstage: (paths) => void restage(paths, true),
                        onGitignore: (paths) => void addToGitignore(paths),
                        onContextMenu: (payload) => setMenu(payload.directory === undefined ? buildChangeMenu(payload) : buildChangeDirMenu(payload)),
                        mode: commitMode,
                        scrollRefs: { changes: commitChangesRef, log: commitLogRef },
                        onRestoreScroll: rememberCommitScroll,
                        onMode: (next) => {
                          switchCommitMode(next);
                          if (next === 'log') void loadLog();
                        },
                        commits,
                        logLoading,
                        logDetail,
                        onLoadLog: loadLog,
                        onSelectCommit: (hash) => void showCommit(hash),
                        onOpenFile: (path) => void openFile(path),

                        onShowCommitDiff: showCommitDiff,
                        historyPath,
                        onClearHistory: clearFileHistory,
                        logAuthor,
                        onLogAuthor: changeLogAuthor,
                        onLoadMoreLog: () => void loadMoreLog(),
                        logExhausted,
                        onLogContextMenu: (payload) => setMenu(buildLogMenu(payload)),
                        highlightedCommit,
                        graph,
                        onLoadGraph: () => void loadGraph(graph?.branch ?? '', graph?.at ?? ''),
                        onGraphBranch: (branch) => void loadGraph(branch, ''),
                        selected: selectedCommit,
                        logFailure: logError,
                        onFileMenu: (payload) => setMenu(buildCommitFileMenu(payload)),
                        onRetry: () => {
                          void loadLog();
                          if (graph !== null) void loadGraph(graph.branch ?? '', graph.at ?? '');
                        },
                        onGraphRef: (ref) => {
                          const scope = refScopeOf(ref, graph);
                          if (scope.branch === '' && scope.at === '') return;
                          void loadGraph(scope.branch, scope.at);
                        },
                        onMessage: (value) => {
                          setCommitMessage(value);
                          setHistoryIndex(-1);
                          /* Typing is the user taking over: the saved draft is no longer relevant. */
                          draftBeforeRecall.current = null;
                        },
                        history: messageHistory,
                        onRecall: (direction) => recallMessage(direction),
                        onAmend: toggleAmend,
                        onCommit: commit,
                        onRefresh: loadGit,
                        onHide: () => setPanelVisible(false),
                        projectName,
                        onBranchMenu: (position) => void openBranchMenu(position),
                        onStashMenu: (position) => void openStashMenu(position),
                        templates: COMMIT_TEMPLATES,
                        onTemplate: applyCommitTemplate,
                        identityMissing,
                        pushFailure: pushError,
                        onPush: () => void pushNow(),
                        undoMessage: clearedMessage,
                        onUndoMessage: restoreClearedMessage,
                        pushing: pushBusy,
                        fetching: fetchBusy,
                        updating: updateBusy,
                        onFetch: () => void fetchNow(),
                        onUpdate: () => void updateNow(),
                        groupBy,
                        pathQuery,
                        onPathQuery: setPathQuery,
                        onGroupByMenu: (position) => setMenu(changeGroupMenu(position)),
                      })
                    : null,
              )
            : null,
          panelVisible
            ? React.createElement('div', {
                style: styles.sideResize,
                title: t('editor.resizeToolWindow'),
                onMouseDown: (event) => {
                  event.preventDefault();
                  const body = event.currentTarget.parentElement;
                  if (body === null) return;
                  const total = body.getBoundingClientRect().width - 42;
                  const startX = event.clientX;
                  const startWidth = toolWidths[activity] ?? 25;
                  setSideDragging(true);
                  const onMove = (moveEvent) => {
                    const delta = ((moveEvent.clientX - startX) / Math.max(1, total)) * 100;
                    const next = Math.max(14, Math.min(72, startWidth + delta));
                    setToolWidths((current) => ({ ...current, [activity]: next }));
                  };
                  const onUp = () => {
                    setSideDragging(false);
                    window.removeEventListener('mousemove', onMove);
                    window.removeEventListener('mouseup', onUp);
                  };
                  window.addEventListener('mousemove', onMove);
                  window.addEventListener('mouseup', onUp);
                },
              })
            : null,
          React.createElement(
            'div',
            { style: styles.mainColumn },
            React.createElement(
              'div',
              { style: styles.editorSurface },
              React.createElement(
                'div',
                {
                  ref: fileTabStripRef,
                  style: styles.tabStrip,
                  /* Runtime-verifiable facts: how many tabs are open vs rendered. */
                  'data-dsh-open-tabs': String(openFiles.length + (diffTab === null ? 0 : 1)),
                  /* A NUL byte in an HTML attribute is asking for trouble: the diff
                     tab reports itself as `commit:`, the file paths as themselves. */
                  'data-dsh-open-list': allTabs.map((entry) => (entry === DIFF_TAB_KEY ? 'commit:' : entry.path)).join('|'),
                  'data-dsh-hidden-tabs': String(fileTabLayout.hidden.length),
                  'data-dsh-editor-tabstrip': '',
                },
                /* IDEA collapses what does not fit into a `»` list; the terminal dock
                   already does this, and a file tab you just opened must not scroll
                   out of view while the strip silently widens. */
                fileTabLayout.visible.map((entry) => fileTabElement(entry)),
                fileTabLayout.hidden.length === 0
                  ? null
                  : React.createElement(
                      'button',
                      {
                        type: 'button',
                        className: 'dsh-editor-tab-overflow',
                        style: styles.tabOverflow,
                        title: t('editor.tabsOverflow', { count: fileTabLayout.hidden.length }),
                        'aria-label': t('editor.tabsOverflow', { count: fileTabLayout.hidden.length }),
                        onClick: (event) => {
                          const rect = event.currentTarget.getBoundingClientRect();
                          const hidden = fileTabLayout.hidden;
                          setMenu({
                            x: Math.max(4, rect.left - 180),
                            y: rect.bottom + 4,
                            title: t('editor.tabsOverflowTitle'),
                            items: hidden.map((entry) =>
                              entry === DIFF_TAB_KEY
                                ? { id: 'tab:diff', label: diffTabName, run: () => setDiffActive(true) }
                                : {
                                    id: `tab:${entry.path}`,
                                    /* The full path, because two `index.ts` must stay apart. */
                                    label: entry.dirty ? `${entry.path} •` : entry.path,
                                    run: () => {
                                      setActivePath(entry.path);
                                      setDiffActive(false);
                                    },
                                  },
                            ),
                          });
                        },
                      },
                      '»',
                    ),
              ),
              /* IDEA's breadcrumb trail under the tabs; a directory segment reveals it in Project. */
              breadcrumbSegments.length === 0
                ? null
                : React.createElement(
                    'div',
                    { style: styles.breadcrumbBar, 'aria-label': t('editor.breadcrumb') },
                    breadcrumbSegments.map((segment, index) =>
                      React.createElement(
                        React.Fragment,
                        { key: `${segment.path}:${index}` },
                        index === 0
                          ? null
                          : React.createElement('span', { style: styles.breadcrumbSeparator }, '›'),
                        React.createElement(
                          'button',
                          {
                            type: 'button',
                            style: { ...styles.breadcrumbItem, ...(index === breadcrumbSegments.length - 1 ? styles.breadcrumbItemActive : null) },
                            title: segment.path === '' ? root : segment.path,
                            onClick: () => {
                              if (segment.kind === 'file') {
                                setActivePath(segment.path);
                                return;
                              }
                              /* IDEA reveals the directory in Project; it never collapses it. */
                              setActivity('project');
                              setPanelVisible(true);
                              setSelectedPath(segment.path === '');
                              void expandTo(segment.path);
                            },
                          },
                          index === 0
                            ? React.createElement(Icon, { name: 'project', size: 11 })
                            : segment.kind === 'directory'
                              ? React.createElement(Icon, { name: 'folder', size: 11 })
                              : React.createElement(Icon, { name: 'file', size: 11 }),
                          segment.label,
                        ),
                      ),
                    ),
                  ),
              gotoState === null
                ? null
                : React.createElement(
                    'div',
                    { style: styles.gotoLineBar },
                    React.createElement('span', { style: { ...styles.findCount, minWidth: 60 } }, t('editor.gotoLine')),
                    React.createElement('input', {
                      style: styles.findInput,
                      autoFocus: true,
                      placeholder: t('editor.gotoLinePlaceholder'),
                      value: gotoState.value,
                      onChange: (event) => setGotoState({ value: event.target.value }),
                      onKeyDown: (event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          commitGotoLine();
                        } else if (event.key === 'Escape') {
                          event.preventDefault();
                          setGotoState(null);
                          editorRef.current?.focus();
                        }
                      },
                    }),
                    React.createElement(
                      'button',
                      { type: 'button', style: styles.conflictAction, onClick: () => commitGotoLine() },
                      t('editor.gotoLine'),
                    ),
                    React.createElement(
                      'button',
                      { type: 'button', style: styles.conflictAction, onClick: () => setGotoState(null) },
                      '×',
                    ),
                  ),
              replaceState === null
                ? null
                : React.createElement(
                    'div',
                    { style: styles.findBar },
                    React.createElement('input', {
                      style: styles.findInput,
                      autoFocus: true,
                      placeholder: t('editor.find'),
                      value: replaceState.find,
                      onChange: (event) => updateFind({ find: event.target.value }),
                      onKeyDown: (event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault();
                          jumpToMatch(event.shiftKey ? -1 : 1);
                        } else if (event.key === 'Escape') {
                          event.preventDefault();
                          closeFind();
                        }
                      },
                    }),
                    React.createElement(
                      'span',
                      { style: styles.findCount },
                      replaceState.total === 0 ? t('editor.noMatches') : `${replaceState.index + 1}/${replaceState.total}`,
                    ),
                    React.createElement(ToolbarButton, { icon: 'chevronDown', label: t('editor.findNext'), onClick: () => jumpToMatch(1) }),
                    React.createElement(ToolbarButton, { icon: 'chevronRight', label: t('editor.findPrevious'), onClick: () => jumpToMatch(-1) }),
                    replaceState.withReplace === true
                      ? React.createElement('input', {
                          style: styles.findInput,
                          placeholder: t('editor.replace'),
                          value: replaceState.replace,
                          onChange: (event) => setReplaceState((current) => (current === null ? current : { ...current, replace: event.target.value })),
                        })
                      : null,
                    replaceState.withReplace === true
                      ? React.createElement(
                          'button',
                          { type: 'button', style: styles.conflictAction, onClick: () => replaceAll() },
                          t('editor.replaceAll'),
                        )
                      : null,
                    React.createElement(
                      'button',
                      { type: 'button', style: styles.conflictAction, onClick: () => closeFind() },
                      '×',
                    ),
                  ),
              monacoError !== null
                ? React.createElement('div', { style: styles.error }, `${t('editor.monacoError')}: ${monacoError}`)
                : null,
              editorError !== null ? React.createElement('div', { style: styles.error }, editorError) : null,
              activePath !== null && externalChanges[activePath] !== undefined && conflict === null
                ? React.createElement(
                    'div',
                    { style: styles.conflictBar },
                    React.createElement(
                      'span',
                      { style: { minWidth: 0, flex: '1 1 auto' } },
                      /* A deleted file cannot be "reloaded": say what happened, offer recreation. */
                      externalChanges[activePath].missing === true ? t('editor.externalDeleted') : t('editor.externalChanged'),
                    ),
                    externalChanges[activePath].missing === true
                      ? React.createElement(
                          'button',
                          { type: 'button', style: styles.conflictAction, onClick: () => void recreateActive() },
                          t('editor.recreateFile'),
                        )
                      : React.createElement(
                          'button',
                          { type: 'button', style: styles.conflictAction, onClick: () => void reloadActiveFromDisk() },
                          t('editor.reload'),
                        ),
                    React.createElement(
                      'button',
                      { type: 'button', style: styles.conflictAction, onClick: () => dismissExternal(activePath) },
                      t('editor.keepLocal'),
                    ),
                  )
                : null,
              conflict === null
                ? null
                : React.createElement(
                    'div',
                    { style: styles.conflictBar },
                    React.createElement('span', { style: { minWidth: 0, flex: '1 1 auto' } }, t('editor.saveConflict', { path: conflict.path })),
                    React.createElement(
                      'button',
                      { type: 'button', style: styles.conflictAction, onClick: () => void saveActive(true) },
                      t('editor.overwrite'),
                    ),
                    React.createElement(
                      'button',
                      { type: 'button', style: styles.conflictAction, onClick: () => reloadActiveFromDisk() },
                      t('editor.reloadFromDisk'),
                    ),
                    React.createElement(
                      'button',
                      { type: 'button', style: styles.conflictAction, onClick: () => setConflict(null) },
                      t('editor.dismiss'),
                    ),
                  ),
              /* A terminal in the editor area owns the surface: "no file open" is
                 then a lie, and the two boxes would split the height 50/50. */
              activeFile === null && diffOpen === false && annotateTarget === null && monacoError === null && editorTerminals.length === 0
                ? React.createElement('div', { style: styles.empty }, t('editor.noFile'))
                : null,
              React.createElement('div', {
                ref: containerRef,
                style: {
                  ...styles.editorContainer,
                  display: activeFile === null || diffOpen || annotateTarget !== null || editorTerminals.length > 0 ? 'none' : 'block',
                },
              }),
              /* A terminal moved into the editor owns the code area, the way IDEA's
                 editor tab does: one surface at a time, not a split. */
              editorTerminals.length === 0 || diffOpen || annotateTarget !== null
                ? null
                : React.createElement(EditorTerminalTab, {
                    t,
                    terminal: editorTerminals[editorTerminals.length - 1],
                    fontSize: 12,
                    getCwd: () => editorTerminals[editorTerminals.length - 1]?.cwd ?? '',
                    onGrid: () => {},
                    onError: (message) => setEditorError(message),
                    onInput: (id, data) => {
                      /* Typing has to reach the PTY the dock would have written to. */
                      void callTerminal({ op: 'write', id, data }).catch(() => {});
                    },
                    onTitle: () => {},
                    onCwd: () => {},
                    onExit: () => {},
                    onReturnToDock: (terminal) => {
                      window.dispatchEvent(new CustomEvent('dsh-editor-return-terminal', { detail: { id: terminal.id } }));
                    },
                  }),
              /* A change selected in the Commit tool window opens as a diff in the editor area. */
              diffOpen === false
                ? null
                : React.createElement(DiffPreview, {
                    t,
                    target: diffTarget,
                    monacoReady,
                    onClose: () => setDiffTarget(null),
                  }),
              annotateTarget === null
                ? null
                : React.createElement(AnnotatePreview, {
                    t,
                    target: annotateTarget,
                    lines: annotateLines,
                    loading: annotateLoading,
                    truncated: annotateTruncated,
                    onClose: () => setAnnotateTarget(null),
                    onOpenCommit: openCommitFromAnnotate,
                    selected: selectedCommit,
                  }),
              /* IDEA's editor status bar; a diff and an empty editor hide the caret facts. */
              activeFile === null || diffOpen || annotateTarget !== null
                ? null
                : React.createElement(
                    'div',
                    { style: styles.editorStatus },
                    React.createElement('span', { style: styles.statusItem }, t('editor.statusBarPosition', { line: caret.line, column: caret.column })),
                    React.createElement(
                      'button',
                      {
                        type: 'button',
                        style: { ...styles.statusItem, ...styles.statusButton },
                        title: t('editor.indentToggle'),
                        onClick: () => toggleIndentation(),
                      },
                      fileMode.insertSpaces ? `␣${fileMode.tabSize}` : `⇥${fileMode.tabSize}`,
                    ),
                    React.createElement(
                      'button',
                      {
                        type: 'button',
                        style: { ...styles.statusItem, ...styles.statusButton },
                        title: t('editor.toggleEol'),
                        onClick: () => toggleLineSeparator(),
                      },
                      fileMode.eol,
                    ),
                    React.createElement('span', { style: styles.statusItem }, fileMode.encoding),
                    React.createElement('span', { style: styles.statusItem }, t('editor.lineCount', { count: lineStats.lines })),
                    lineStats.selected > 0
                      ? React.createElement('span', { style: styles.statusItem }, t('editor.selectionInfo', { count: lineStats.selected }))
                      : null,
                    React.createElement('span', { style: styles.toolbarSpacer }),
                    statusNotice === null
                      ? null
                      : React.createElement('span', { style: styles.statusItem, role: 'status' }, statusNotice),
                    React.createElement(ToolbarButton, { icon: 'search', label: t('editor.gotoLine'), onClick: () => gotoLine() }),
                    React.createElement(ToolbarButton, { icon: 'annotate', label: t('editor.annotate'), onClick: () => void toggleAnnotate() }),
                    activeFile.dirty
                      ? React.createElement('span', { style: styles.statusItem }, t('editor.unsaved'))
                      : React.createElement('span', { style: styles.statusItem }, t('editor.saved')),
                  ),
            ),
            terminalOpen
              ? React.createElement(
                  'div',
                  { style: { ...styles.dock, height: terminalHeight } },
                  React.createElement('div', {
                    style: { ...styles.dockResize, cursor: dockDragging ? 'row-resize' : 'row-resize' },
                    title: t('editor.resizeTerminal'),
                    onMouseDown: (event) => {
                      event.preventDefault();
                      const startY = event.clientY;
                      const startHeight = terminalHeight;
                      setDockDragging(true);
                      const onMove = (moveEvent) => {
                        const next = startHeight + (startY - moveEvent.clientY);
                        setTerminalHeight(Math.max(96, Math.min(640, next)));
                      };
                      const onUp = () => {
                        setDockDragging(false);
                        window.removeEventListener('mousemove', onMove);
                        window.removeEventListener('mouseup', onUp);
                      };
                      window.addEventListener('mousemove', onMove);
                      window.addEventListener('mouseup', onUp);
                    },
                  }),
                  React.createElement(TerminalPanel, {
                    t,
                    generation: terminalGeneration,
                    startDirectory: terminalStartDirectory,
                    workspaceRoot: root,
                    /* TerminalPanel is a sibling: pass the opener instead of capturing it. */
                    onOpenFile: (path) => void openFile(path),
                    onStartDirectoryUsed: () => {
                      pendingTerminalPath.current = '';
                      setTerminalStartDirectory('');
                    },
                    onRequestNew: () => setTerminalGeneration((value) => value + 1),
                    onRequestClose: () => setTerminalOpen(false),
                    /* The editor area is a SIBLING of this panel, so a moved tab is
                       reported up rather than rendered down here. */
                    onEditorTerminals: (list) => setEditorTerminals(list),
                  }),
                )
              : null,
          ),
        ),
      );
    }

    /** Bounds of the chat column, in percent of the conversation area. */
    const CHAT_WIDTH_MIN = 15;
    const CHAT_WIDTH_MAX = 45;
    const CHAT_WIDTH_DEFAULT = 25;

    /**
     * Keep a requested chat width inside the usable range.
     *
     * Below ~15% the message list is unreadable; past ~45% the editor is no longer
     * an editor. A non-number falls back to the default so a corrupt stored value
     * cannot leave a zero-width column.
     * @param {number} value - requested width in percent.
     * @returns {number} clamped width.
     */
    function clampChatPercent(value) {
      if (!Number.isFinite(value)) return CHAT_WIDTH_DEFAULT;
      return Math.min(CHAT_WIDTH_MAX, Math.max(CHAT_WIDTH_MIN, value));
    }

    /**
     * The chat width the user last chose (percent), or the default.
     * @returns {number} width in percent.
     */
    function readChatWidth() {
      try {
        const raw = window.localStorage.getItem('dsh-editor.chatWidth');
        return raw === null ? CHAT_WIDTH_DEFAULT : clampChatPercent(Number(raw));
      } catch {
        return CHAT_WIDTH_DEFAULT;
      }
    }

    /**
     * Persist the chat width so the next Editor open starts where it left off.
     * @param {number} value - width in percent.
     * @returns {void}
     */
    function writeChatWidth(value) {
      try {
        window.localStorage.setItem('dsh-editor.chatWidth', String(Math.round(clampChatPercent(value) * 10) / 10));
      } catch {
        /* a storage-less browser keeps the in-memory width */
      }
    }

    /** Inject the small amount of global CSS the split layout and chrome need. */
    function installStyles() {
      const id = 'dsh-editor-styles';
      if (document.getElementById(id) !== null) return;
      const style = document.createElement('style');
      style.id = id;
      style.textContent = [
        /* Our custom tab is a normal flex child; keep it first even if React re-renders the row. */
        '[data-conversation-tabs] button[data-dsh-editor-tab] { order: -1 !important; }',
        /* The collapse button is absolutely positioned in the tab ROW (see
           `ensureChatToggle`), so the row must reserve its 28px + margin here — a
           free-floating button would sit on top of the last tab when the strip wraps.
           `box-sizing: border-box` matters because the row is `width: 100%`. */
        '[data-conversation-tabs] { padding-right: 40px; box-sizing: border-box; }',
        /* The row is our button's containing block. It already carries
           `position: relative` in the host CSS; this makes that contract explicit so
           a host restyle cannot turn our absolute button loose on the page. */
        '[data-conversation-tabs] { position: relative; }',
        /* The chat column shrinks to the right 1/4; the editor host fills the left 3/4.
           The slot wrapper is display:contents, so the width belongs to its two
           layout children: the View area and the composer seat. */
        '[data-dsh-editor-active] [data-slot="conversation.session"] > div {',
        '  width: var(--dsh-editor-chat-width, 25%) !important;',
        /* NOT `calc(100% - <the same %>)`: a percentage margin resolves against the
           containing block, so the column's own `width: 25%` and its `margin-left`
           percentage made the container's width depend on its child's — in a
           shrink-to-fit ancestor (a flex/grid item, which the session area is) the
           browser resolves that circular pair over several passes and the box GROWS
           a little on every re-render. That is the "tab row keeps getting wider"
           symptom: measured 9px of growth per pass at 25%. A second variable
           (`--dsh-editor-chat-offset`, set in JS from the same number) keeps the
           placement with no percentage margin at all. */
        '  margin-left: var(--dsh-editor-chat-offset, 75%) !important;',
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
        '  width: var(--dsh-editor-chat-width, 25%) !important;',
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
           editor owns the left 3/4. It must therefore stay transparent to the pointer,
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
        /* The Chat column and the composer keep receiving input; the empty left 3/4 lets clicks reach the editor host. */
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
        /* Maximized state: the editor owns the whole area, so give it the frame IDEA
           draws around a maximized tool window instead of an unexplained hard edge. */
        /* The composer seat must be pinned to the CONVERSATION AREA, not to the
           scroller: once the scroll body became `overflow-y: auto` it also became the
           containing block for the seat's `position: sticky; bottom: 0`, so any
           conversation longer than a screen stuck the input box to the container's TOP
           (measured at y=31, on top of the editor). Absolute positioning against the
           scroll region keeps it at the bottom in every case. */
        '[data-dsh-editor-chat-collapsed] [data-dsh-editor-host] {',
        '  border-right: 0.5px solid var(--dsw-alias-state-business-primary);',
        '}',
        '[data-dsh-editor-active] [data-width-handle] { display: none !important; }',
        /* The chat column's drag handle: a 6px grab strip on the divider. */
        '[data-dsh-editor-chat-handle] {',
        '  position: absolute;',
        '  top: 0;',
        '  bottom: 0;',
        '  width: 6px;',
        '  z-index: 3;',
        '  cursor: col-resize;',
        '  background: transparent;',
        '}',
        '[data-dsh-editor-chat-badge] {',
        '  position: absolute;',
        '  top: 12px;',
        '  z-index: 4;',
        '  padding: 1px 6px;',
        '  border-radius: 4px;',
        '  background: var(--dsw-alias-state-business-primary);',
        '  color: #fff;',
        '  font: 600 11px/1.6 ui-monospace, SFMono-Regular, Menlo, monospace;',
        '  pointer-events: none;',
        '}',
        '[data-dsh-editor-chat-handle]:hover,',
        '[data-dsh-editor-chat-handle][data-dragging] {',
        '  background: color-mix(in srgb, var(--dsw-alias-state-business-primary) 55%, transparent);',
        '}',
        /* The host sits below the chat column and composer, but only paints the left 3/4. */
        '[data-dsh-editor-host] {',
        '  position: absolute;',
        '  top: 0;',
        '  bottom: 0;',
        '  left: 0;',
        '  right: var(--dsh-editor-chat-width, 25%);',
        '  z-index: 0;',
        '  display: flex;',
        '  min-width: 0;',
        '  min-height: 0;',
        '  overflow: hidden;',
        '  background: var(--dsw-alias-bg-base);',
        '  border-right: 0.5px solid var(--dsw-alias-border-l3);',
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
        '[data-dsh-editor-active] [data-conversation-tabs] button[role="tab"][aria-selected="true"]:not([data-dsh-editor-tab]) {',
        '  color: var(--dsw-alias-label-tertiary) !important;',
        '}',
        '[data-dsh-editor-active] [data-conversation-tabs] button[role="tab"][aria-selected="true"]:not([data-dsh-editor-tab])::after {',
        '  background: transparent !important;',
        '}',
        /* Hover states live in CSS so inline layout styles stay small. */
        '.dsh-editor-toolbar-button:hover:enabled { background: var(--dsw-alias-interactive-bg-hover); }',
        '.dsh-editor-stripe-item:hover { background: var(--dsw-alias-interactive-bg-hover); }',
        '.dsh-editor-tree-row:hover { background: var(--dsw-alias-interactive-bg-hover); }',
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
        /* The commit just created, tinted so the user sees it land in the log. */
        '[data-dsh-log-new] { background: color-mix(in srgb, var(--dsw-alias-state-business-primary) 14%, transparent); }',
        '[data-dsh-log-new]:hover { background: color-mix(in srgb, var(--dsw-alias-state-business-primary) 22%, transparent); }',
        '.dsh-editor-commit-row:hover { background: var(--dsw-alias-interactive-bg-hover); }',
        '.dsh-editor-commit-row-active { background: var(--dsw-alias-interactive-bg-hover-solid); }',
        /* Conflict rows keep a red wash even while hovered or selected. */
        '.dsh-editor-commit-row-conflict { background: rgba(207, 34, 46, 0.08); }',
        '.dsh-editor-commit-row-conflict:hover { background: rgba(207, 34, 46, 0.14); }',
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
        /* A narrow tool window shows the change list only; the diff needs room to be useful. */
        '@container dsh-editor-side (max-width: 520px) { .dsh-editor-diff-pane { display: none !important; } }',
        '.dsh-editor-tab:hover { background: var(--dsw-alias-interactive-bg-hover); }',
        '.dsh-editor-tab-active:hover { background: var(--dsw-alias-bg-base); }',
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
    function shouldShowTreeLoading(state) {
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
    function isWorkspaceMenu(labels) {
      if (!Array.isArray(labels) || labels.length === 0) return false;
      const has = (pattern) => labels.some((label) => pattern.test(label));
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
    function restoreScrollTop(state) {
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
    function jumpBadgeLabel(count) {
      const value = Number(count);
      if (!Number.isFinite(value) || value <= 0) return '↓';
      if (value > 99) return '↓ 99+';
      return `↓ ${Math.floor(value)}`;
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
    function snapSplitPercent(value) {
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
    function jumpBadgeVisible(state) {
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
    function isNearBottom(state) {
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
    function wheelScrollTop(state) {
      if (state === null || state === undefined) return null;
      const current = Number(state.scrollTop);
      const delta = Number(state.deltaY);
      const max = Number(state.max);
      if (!Number.isFinite(current) || !Number.isFinite(delta) || !Number.isFinite(max)) return Number.isFinite(current) ? current : null;
      /* A wheel event is in CSS pixels; scrollTop is too, so a plain sum is right. */
      return Math.max(0, Math.min(max, current + delta));
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
    function pathWithLine(path, caret, isActive) {
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
    function shellQuote(value) {
      const path = typeof value === 'string' ? value : '';
      if (path === '') return "''";
      if (!/[\s'"$`\\!*?()\[\]{}<>|&;]/.test(path)) return path;
      return `'${path.split("'").join("'\\''")}'`;
    }

    /**
     * The chat column's width once the collapse state is applied.
     *
     * Collapsing gives the editor the full width; expanding restores whatever the
     * drag-handle width is, so the toggle never destroys the user's choice.
     * @param {number} width - the remembered width in percent (0 means collapsed).
     * @returns {string} a CSS width.
     */
    function collapsedChatWidth(width) {
      /* The variable IS the chat column's width, so collapsing it to 0% gives the
         editor the whole area (100% chat left the editor 0px wide). */
      return Number(width) === 0 ? '0%' : `${width}%`;
    }

    /**
     * The chat column's left offset, as the complement of its width.
     *
     * Emitted as its own variable instead of a `calc(100% - width)` margin because
     * a percentage MARGIN makes the parent's width depend on the child's, and a
     * shrink-to-fit parent then grows on every pass (the "row keeps widening"
     * bug). Collapsed means offset 100%, so the column sits entirely off to the
     * right and the editor owns the area.
     * @param {number} width - chat width in percent (0 when collapsed).
     * @returns {string} CSS length for the column's left offset.
     */
    function collapsedChatOffset(width) {
      const value = Number(width);
      if (!Number.isFinite(value) || value <= 0) return '100%';
      return `${Math.max(0, 100 - Math.min(100, value))}%`;
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
    function menuArrowTarget(activeIndex, key, selfIndex) {
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

    function pickMenuIcon(preferred, available) {
      if (!Array.isArray(preferred) || !(available instanceof Set)) return null;
      for (const id of preferred) {
        if (typeof id === 'string' && available.has(id)) return id;
      }
      return null;
    }

    function createController(ctx) {
      const t = translate(ctx.locale.bind(NS), { zh, en });
      let active = false;
      let host = null;
      let root = null;
      let baseClass = '';
      let activeClass = '';
      let button = null;
      /* Re-entrancy guard for `sync`: it writes DOM that its own observer watches. */
      let syncing = false;
      /* The chat column's drag handle and the width it currently applies. */
      let chatHandle = null;
      let chatWidth = CHAT_WIDTH_DEFAULT;
      /* The tab-strip button that hides/shows the chat column, and whether the chat
         is currently collapsed (remembered across sessions like the width). */
      let chatToggle = null;
      let chatCollapsed = (() => {
        try {
          return window.localStorage.getItem('dsh-editor.chatCollapsed') === '1';
        } catch {
          return false;
        }
      })();

      const findBody = () => document.querySelector('[data-conversation-region="chat"]');
      const findTablist = () => document.querySelector('[data-conversation-tabs]');

      function captureTabClasses(tablist) {
        const tabs = [...tablist.querySelectorAll('button[role="tab"]')];
        const selected = tabs.find((tab) => tab.getAttribute('aria-selected') === 'true');
        const sample = selected ?? tabs[0];
        if (sample === undefined) return;
        const classes = [...sample.classList];
        if (classes.length > 0) baseClass = classes[0];
        if (classes.length > 1) activeClass = classes[1];
        if (activeClass === '') {
          for (const tab of tabs) {
            for (const name of tab.classList) {
              if (name !== baseClass && /tabActive/i.test(name)) activeClass = name;
            }
          }
        }
      }

      function ensureButton(tablist) {
        if (button !== null && button.isConnected && button.parentElement === tablist) {
          if (tablist.firstElementChild !== button) tablist.insertBefore(button, tablist.firstElementChild);
          return button;
        }
        if (button !== null) button.remove();
        button = document.createElement('button');
        button.type = 'button';
        button.setAttribute('role', 'tab');
        button.setAttribute('data-dsh-editor-tab', '');
        button.setAttribute('aria-selected', 'false');
        button.textContent = VIEW_LABEL;
        button.addEventListener('click', (event) => {
          event.preventDefault();
          event.stopPropagation();
          if (active) setActive(false);
          else openEditorSplit();
        });
        tablist.insertBefore(button, tablist.firstElementChild);
        return button;
      }

      /**
       * Activate the editor split (the same thing the Editor tab does).
       *
       * Shared by the tab and by the workspace menu item, so both paths agree on
       * what "open the editor" means: the right quarter is the Chat view.
       * @returns {void}
       */
      function openEditorSplit() {
        setActive(true);
      }

      function applyButtonState() {
        if (button === null) return;
        button.className = active && activeClass !== '' ? `${baseClass} ${activeClass}` : baseClass;
        button.setAttribute('aria-selected', active ? 'true' : 'false');
      }

      /**
       * Push the current chat width into the CSS variable the layout reads.
       * @param {number} value - width in percent.
       * @returns {void}
       */
      function applyChatWidth(value) {
        chatWidth = clampChatPercent(value);
        applyChatCollapsed();
      }

      /**
       * Push the collapse state into the layout and the toggle's look.
       *
       * Collapsed means the editor takes the full width; the remembered percentage
       * is untouched so expanding restores it exactly.
       * @returns {void}
       */
      function applyChatCollapsed() {
        const body = document.body;
        const width = chatCollapsed ? 0 : chatWidth;
        body.style.setProperty('--dsh-editor-chat-width', collapsedChatWidth(width));
        /* The mirror of the width: `100% - width` computed in JS, so the layout never
           needs a percentage margin (see the rule's comment). */
        body.style.setProperty('--dsh-editor-chat-offset', collapsedChatOffset(width));
        if (chatCollapsed) body.setAttribute('data-dsh-editor-chat-collapsed', '');
        else body.removeAttribute('data-dsh-editor-chat-collapsed');
        if (chatToggle !== null) {
          /* A split-panel glyph reads as "show/hide this panel"; it points the way
             the panel will move (left icon = the chat sits on the right). */
          /* The sprite ships only `panel-left`, so the two states are told apart by
             glyph rather than by mirroring: split = chat visible, left panel = chat
             hidden (the editor alone). */
          const preferred = chatCollapsed
            ? ['dsw-icon-panel-left-outline-regular', 'dsw-icon-panel-left-outline-medium']
            : ['dsw-icon-compare-split-outline-regular', 'dsw-icon-panel-left-outline-regular'];
          const available = new Set([...document.querySelectorAll('symbol[id]')].map((symbol) => symbol.id));
          const chosen = pickMenuIcon(preferred, available);
          const markup = chosen === null
            ? (chatCollapsed ? '«' : '»')
            : `<svg width="16" height="16" aria-hidden="true"><use href="#${chosen}"></use></svg>`;
          /* Re-read the tab metrics: a theme or density switch can change them, and
             the strip is re-rendered by the host on view switches. */
          matchTabMetrics(chatToggle, chatToggle.parentElement);
          if (chatToggle.innerHTML !== markup) chatToggle.innerHTML = markup;
          chatToggle.setAttribute('aria-expanded', chatCollapsed ? 'false' : 'true');
          chatToggle.setAttribute('title', t(chatCollapsed ? 'editor.showChat' : 'editor.hideChat'));
          chatToggle.setAttribute('aria-label', t(chatCollapsed ? 'editor.showChat' : 'editor.hideChat'));
          chatToggle.setAttribute('data-collapsed', chatCollapsed ? '1' : '0');
        }
        /* The handle has no meaning while the column is gone. */
        if (chatHandle !== null && chatHandle.isConnected) chatHandle.style.display = chatCollapsed ? 'none' : '';
      }

      /**
       * Toggle the chat column, persisting the choice.
       * @returns {void}
       */
      function toggleChatCollapsed() {
        chatCollapsed = !chatCollapsed;
        try {
          window.localStorage.setItem('dsh-editor.chatCollapsed', chatCollapsed ? '1' : '0');
        } catch {
          /* a storage-less browser keeps the in-memory state */
        }
        applyChatCollapsed();
        if (!chatCollapsed) {
          const container = findBody();
          if (container !== null) placeChatHandle(container);
        }
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
       * Insert the collapse/expand button at the far right of the Editor/对话/轨迹 strip.
       *
       * It is NOT a `role="tab"`: the strip's tab semantics belong to the View
       * switcher, and joining it would move the Editor tab's slot around.
       * @param {HTMLElement} tablist - the conversation tab strip.
       * @returns {void}
       */
      function ensureChatToggle(tablist) {
        const row = tablist.parentElement ?? tablist;
        if (chatToggle !== null && chatToggle.isConnected && chatToggle.parentElement === row) {
          applyChatCollapsed();
          return;
        }
        chatToggle?.remove();
        chatToggle = document.createElement('button');
        chatToggle.type = 'button';
        chatToggle.setAttribute('data-dsh-editor-chat-toggle', '');
        chatToggle.addEventListener('click', (event) => {
          event.preventDefault();
          event.stopPropagation();
          toggleChatCollapsed();
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
        applyChatCollapsed();
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
        const left = rect.width * (1 - chatWidth / 100);
        const next = `${Math.max(0, left - 3)}px`;
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
        if (host !== null && host.isConnected && host.parentElement === body) {
          host.removeAttribute('data-dsh-editor-host-idle');
          return host;
        }
        destroyHost();
        host = document.createElement('div');
        host.setAttribute('data-dsh-editor-host', '');
        body.appendChild(host);
        root = createRoot(host);
        root.render(React.createElement(EditorWorkspace, { t }));
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
       * the SPLIT's geometry (a 25% column on the right). Leaving them attached
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
          /* The right 1/4 must always be the original Chat view, not Trajectory or another View. */
          const tablist = findTablist();
          if (tablist !== null) {
            const chatTab = [...tablist.querySelectorAll('button[role="tab"]')].find((tab) => tab !== button);
            if (chatTab !== undefined && chatTab.getAttribute('aria-selected') !== 'true') chatTab.click();
          }
        }
        active = next;
        const body = findBody();
        if (body === null) {
          destroyHost();
          applyButtonState();
          return;
        }
        if (active) {
          body.setAttribute('data-dsh-editor-active', '');
          applyChatWidth(readChatWidth());
          ensureHost(body);
          ensureChatHandle(body);
          ensureChatWheel(body);
          ensureChatJump(body);
          /* The flow mounts after the split's own first render, so keep trying for a
             short while (bounded) instead of pinning a scroller that is not there yet. */
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
        } else {
          body.removeAttribute('data-dsh-editor-active');
          /* Hide, do not unmount: a remount re-runs the tree load from scratch and
             the list flashes on every toggle. The tree stays mounted and current. */
          idleHost();
          detachChatChrome(body);
          /* Leaving the split restores the chat column: the collapse belongs to the
             editor layout, not to the conversation view. */
          document.body.style.removeProperty('--dsh-editor-chat-width');
          document.body.style.removeProperty('--dsh-editor-chat-offset');
          document.body.removeAttribute('data-dsh-editor-chat-collapsed');
        }
        applyButtonState();
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
        if (tablist === null) {
          button = null;
          return;
        }
        captureTabClasses(tablist);
        ensureButton(tablist);
        ensureChatToggle(tablist);
        applyButtonState();
        const body = findBody();
        if (body === null) {
          destroyHost();
          return;
        }
        if (active) {
          if (body.getAttribute('data-dsh-editor-active') === null) body.setAttribute('data-dsh-editor-active', '');
          ensureHost(body);
          ensureChatHandle(body);
          ensureChatJump(body);
          return;
        }
        /* The conversation body was replaced (a Session switch re-mounts it): an
           idle host still parented to the dead node would keep polling a workspace
           nobody is looking at. Drop it; the next activation mounts a fresh one. */
        if (host !== null && host.parentElement !== body) destroyHost();
      }

      /**
       * Insert an "Editor" item at the top of the workspace menu.
       *
       * The workspace row's `...` menu is rendered by the host app, not by this
       * plugin, so the item is injected into the menu's DOM as it appears. Clicking
       * it opens the same split the Editor tab does (the implementation is reused,
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
        clone.addEventListener('click', (event) => {
          event.preventDefault();
          event.stopPropagation();
          openEditorSplit();
          document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        });
        first.parentElement?.insertBefore(clone, first);

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
        if (tab === null || tab === button) return;
        if (active) setActive(false);
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
        sync();
        enhanceMenus();
        if (document.querySelector('[role="menu"]') !== null) scheduleMenuRescan();
      });
      observer.observe(document.body, { childList: true, subtree: true });
      document.addEventListener('click', onTabClick, true);
      sync();

      ctx.effect(
        () => () => {
          observer.disconnect();
          document.removeEventListener('click', onTabClick, true);
          const body = findBody();
          if (body !== null) detachChatChrome(body);
          destroyHost();
          if (button !== null) button.remove();
          chatToggle?.remove();
          chatToggle = null;
          document.body.style.removeProperty('--dsh-editor-chat-width');
          document.body.style.removeProperty('--dsh-editor-chat-offset');
          document.body.removeAttribute('data-dsh-editor-chat-collapsed');
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

    return {
      apply,
      inject,
    };
  },
});
