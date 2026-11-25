# dsh-editor 工程记忆

本文件只记录长期有效的架构约束、设计规范、关键根因和回归边界。单轮命令输出、
临时端口、PR 过程、重复测试数字不在这里长期保留。

## 2026-11-25：纯空白查询/替换历史项仍显示为空白菜单行

- 作用域：Search Everywhere、Find Tool、Editor Find 的 query/replace history
  菜单，以及纯空格、Tab、换行历史项的可访问名称。
- 症状：空字符串历史项已显示 `Empty query` / `Empty replacement`，但纯空白字符
  仍直接作为 label，24px 菜单行视觉上接近空白，`aria-label` 也只是空白字符。
- 根因：`searchHistoryMenuLabel` 只判断 `value === ''`，没有覆盖
  `value.trim() === ''` 的真实历史值。
- 修复：纯空白历史项显示 `Whitespace` / `空白字符`；空字符串仍按 query/replace
  区分；普通文本保持原文。历史存储、去重、回填和替换语义不变。
- 回归：`tests/search-find-query-history-records-deduplicates-one-empty-entry.test.mjs`
  新增空格、Tab、换行断言。
- 真实 Web：向 demo replacement history 注入纯空格项后，Search Everywhere 的
  Replace History 显示 `Whitespace`，`aria-label` 同样非空；测试后已恢复
  localStorage。

## 2026-11-25：空查询/空替换历史项渲染为空白菜单行

- 作用域：Search Everywhere、Find Tool、Editor Find 的 query/replace history
  菜单，以及空字符串历史项的可访问名称。
- 症状：空 replacement 是真实历史项（用于重放删除），但菜单直接使用原始值作为
  label，渲染成空白行且 `aria-label` 为空；用户无法识别或通过屏幕阅读器选择它。
- 根因：三处历史菜单都使用 `label: value`，没有区分“空历史值”和“无历史记录”。
- 修复：新增共享 `searchHistoryMenuLabel(value, kind, t)`；空 query 显示
  `Empty query` / `空查询`，空 replacement 显示 `Empty replacement` / `空替换`，
  非空值保持原文。Search Everywhere、Find Tool 和 Editor Find 统一复用。
- 回归：`tests/search-find-query-history-records-deduplicates-one-empty-entry.test.mjs`
  新增 helper 断言，并更新三处菜单接线断言。
- 真实 Web：向 demo 的 replacement history 注入空项后，Search Everywhere 的
  Replace History 显示 `Empty replacement`，`aria-label` 同样非空；测试后已恢复
  localStorage。

## 2026-11-25：Project speed search 文件命中后焦点错误留在 tree

- 作用域：Project speed search 按 Enter 打开文件/目录后的键盘归属、EditSource
  与 Project tree 的焦点边界。
- 症状：在 Open Files 或 Project Files 中搜索文件并按 Enter，文件 tab 已切换，
  但焦点仍被写回 Project tree；用户还要再点一次编辑器才能继续输入。
- 根因：Enter 路径统一调用 `onOpen`（只切换 active tab）并无条件
  `treeRef.current?.focus()`；目录命中需要 tree 焦点，文件命中却应等价于
  IDEA EditSource。
- 修复：文件命中改走 `onOpenEditSource`，由现有 `focusEditorOnNextFrame`
  在 Monaco 就绪后聚焦编辑器；打开失败时回退到 Project tree。目录命中、
  无命中 Enter、Escape 和视图切换仍回到 tree。
- 回归：`tests/search-after-enter-speed-search-tree-takes-keyboard-back.test.mjs`、
  `tests/search-enter-speed-search-opens-hit-not-just-highlights.test.mjs`、
  `tests/project-double-clicking-project-file-opens-editsource-focuses-editor.test.mjs`。
- 真实 Web：Open Files 搜索 `read` 后 Enter，`README.md` 打开且
  `document.activeElement` 是 Monaco textarea；Project Files 搜索 `src` 后
  Enter，`src` 展开且焦点仍在 Project tree。
- IDEA 对照：文件命中是 EditSource，编辑器拥有键盘；目录命中留在 tree 继续
  展开和方向键导航。

## 2026-11-25：Project speed search 切换视图丢失搜索前 selection

- 作用域：Project Files / Open Files / All Changed Files 的 speed search、
  视图切换、selection/primary 恢复和 filtered-view fallback。
- 症状：在 Open Files 中选中 `util.ts`，搜索 `read` 后 cursor 自动移到
  `README.md`；此时切到 All Changed Files，搜索关闭后选中了第一行
  `.idea/vcs.xml`，而不是搜索前的 `util.ts`。
- 根因：视图切换 effect 只清空搜索状态，没有恢复 `searchReturnSelectionRef`；
  同时父级 `filteredViewSelection` effect 会先按当前搜索命中做可见性收敛，
  子组件立即恢复 selection 会被父级 effect 覆盖。
- 修复：新增 `projectSpeedSearchSelectionAfterViewChange`，仅当搜索前 primary
  仍存在于新视图完整行集合时恢复搜索前 selection；ProjectPanel 在视图切换后
  用 request id 保护的 0ms 任务恢复 selection，确保父级 filtered-view 收敛
  先完成，再落回用户真实导航上下文。primary 不可见时仍交给
  `filteredViewSelection` 选择可见回退行。
- 回归：`tests/project-speed-search-selection-uses-filtered-row-universe.test.mjs`
  覆盖可见恢复、不可见回退和 ProjectPanel 接线。
- 真实 Web：Open Files 选中 `util.ts`，搜索 `read` 自动命中 `README.md`，
  切到 All Changed Files 后 `util.ts` 恢复选中，搜索框关闭且焦点回到 Project
  tree；Enter 打开 `new-feature.ts` 与 Escape 恢复 `new-feature.ts` 仍正常。
- IDEA 对照：切换 Project 视图会结束临时 speed search，用户应回到搜索前的
  导航上下文；只有该行在新视图不可见时才允许回退到可见行。

## 2026-11-25：Commit Graph hover 改写 aria-selected 且 scope 切换可能覆盖 cursor

- 作用域：Commit Log Graph 的鼠标 hover、键盘 cursor、selected commit、branch
  scope 切换和 `aria-selected`。
- 症状：鼠标移到另一条 commit 时，`aria-selected` 跟着 hover 行移动，屏幕阅读器
  会把悬停误报为选中；同时 scope 切换时 cursor 回退逻辑可能覆盖仍可见的 selected
  commit，造成高亮行和 detail pane 分叉。
- 根因：`CommitLog` 把 `graphHover ?? graphCursor ?? selected` 作为 Graph 的
  `selected`，而 `CommitGraphRow` 用同一个 `active` 同时控制视觉高亮和
  `aria-selected`；cursor 回退 effect 也没有优先保留仍可见的 selected commit。
- 修复：Graph 新增独立 `hovered` 输入，hover 只影响视觉背景，`aria-selected`
  只跟随 cursor/selection；新增 `commitLogGraphPreferredCursor`，scope 变化时
  优先保留仍可见的 selected commit，再回退到 cursor 或第一行。
- 回归：`tests/commit-commitgraphrow-owns-row-semantics-idea-decorations.test.mjs`、
  `tests/commit-graph-cursor-stays-valid-row-falls-back-first-row.test.mjs`、
  `tests/commit-graph-text-filter-narrows-visible-rows.test.mjs`。
- 真实 Web：demo 选中 baseline 后 hover `a63ebad`，视觉背景变化但
  `aria-selected` 仍为 baseline；切换 main scope 后移开指针，cursor 和 detail
  都保持 baseline。临时 `demo-old` 分支已删除。
- IDEA 对照：IDEA 的 hover 是临时视觉反馈，不会改变当前 commit 选择；DSH 现在
  保持同一语义。

## 2026-11-25：Changes 多选 Show Diff 只打开当前行

- 作用域：Commit Changes 工具栏 Show Diff、Changes 多行选择、Diff 文件导航和
  差异计数。
- 症状：Changes 中同时选中多个文件后点击 Show Diff，DSH 只把 `selectedChange`
  传给 diff，文件导航显示 `1/1`；IDEA 对同一多选会打开单窗口 diff，并允许在
  所选文件之间前后导航。
- 根因：`CommitPanel` 的 Show Diff action 只调用
  `onShowDiff(selectedChange)`，没有把 `chosenChangeList` 转成
  `navigationEntries`；`DiffTarget` 已支持该字段，但 Changes 工具栏没有使用。
- 修复：新增 `diffNavigationEntries(targets)`，过滤无效路径并保留视觉顺序；
  Show Diff 使用 `chosenChangeList` 生成导航集合，以 `selectedChange` 为主行，
  单行选择仍得到 `1/1`。按钮启用条件改为当前有可见选中行。
- 回归：`tests/commit-changes-toolbar-exposes-idea-diff-selected-row.test.mjs`
  新增导航集合顺序断言，并更新 Show Diff action 断言。
- 真实 Web：demo 同时选中 `README.md` 与 `src/util.ts` 后 Show Diff 显示
  `2/2`；Previous file 回到 `README.md` 并显示 `1/2`。验收后关闭 diff，未执行
  Rollback；临时 README 改动已恢复。
- IDEA 对照：IDEA 多文件 Show Diff 是单窗口 + 文件导航，不是多个独立 diff
  窗口；DSH 现在保持同一交互模型。

## 2026-11-25：混合 tracked/unversioned Rollback 确认文案隐藏删除后果

- 作用域：Commit Changes 工具栏 Rollback、混合选择 tracked 与 unversioned 文件、
  `rollbackDialogConfirmKey` 和 Rollback Changes 对话框确认文案。
- 症状：同时选择 `src/util.ts` 与未纳入版本控制的 `.idea/*`、`src/new-feature.ts`
  后，Rollback 会删除 unversioned 文件，但对话框只显示
  `Discard uncommitted changes in 4 file(s)?`，没有说明其中文件会被删除。
- 根因：`rollbackDialogConfirmKey` 只在“全部都是 unversioned”时选择删除文案；
  混合 band 直接落到通用 `rollbackConfirm`，而 Host 的 `all` 模式仍会删除
  unversioned 文件。
- 修复：新增 `editor.rollbackMixedUnversionedConfirm`，当 entries 同时包含
  unversioned 与其他 band 时明确说明“回滚未提交修改并删除其中未纳入版本控制的
  文件”。纯 unversioned、纯 staged、纯 all 的既有文案保持不变。
- 回归：`tests/commit-rollback-confirmation-dialog.test.mjs` 新增混合 band 文案
  断言，并检查中英文字典各存在一次。
- 真实 Web：demo 同时选择 4 个变更后，Rollback 对话框显示
  `Roll back uncommitted changes in 4 file(s) and delete the unversioned files
among them? This cannot be undone.`；验收后取消对话框，未执行 Rollback。
- IDEA 对照：IDEA Rollback Changes 对话框只列出 tracked change，unversioned
  文件不进入该对话框；DSH 保留显式删除能力，但必须把破坏性后果写进确认文案。

## 2026-11-25：Rollback Show Diff 文件导航忽略目录分组顺序

- 作用域：Commit Changes → Rollback Changes → Group by directory → Show Diff 的
  文件导航、差异计数和上一/下一文件动作。
- 症状：对话框按目录分组后，视觉顺序已经变为 `.idea/*`、`src/*`，但 Show Diff
  仍按原始 entries 顺序导航；从 `src/util.ts` 点 Next file 会跳到
  `.idea/vcs.xml`，差异计数也显示 `1/4` 而不是视觉上的 `3/4`。
- 根因：`rollbackNavigationEntries` 直接 `entries.map(...)`，没有使用
  `rollbackDialogVisualEntryIndices`；`rollbackDiffTarget` 也没有接收
  `decision.groupByDirectory`，所以 diff 导航和对话框视觉顺序分叉。
- 修复：`rollbackNavigationEntries(entries, groupByDirectory)` 在分组时按
  `rollbackDialogVisualEntryIndices` 生成导航身份；`rollbackDiffTarget` 透传
  `groupByDirectory`，EditorWorkspace 使用 `decision.groupByDirectory`。
- 回归：`tests/commit-rollback-confirmation-dialog.test.mjs` 新增目录分组导航
  顺序断言，并更新 `rollbackDiffTarget` 调用断言。
- 真实 Web：demo 4 个变更开启 Directory 分组后，`src/util.ts` 的 diff 显示
  `3/4`；Next file 进入 `src/new-feature.ts` 并显示 `4/4`。验收后关闭 diff 和
  对话框，未执行 Rollback，demo 改动保持不变。
- IDEA 对照：IDEA Rollback Changes 的目录树顺序就是 diff 文件导航顺序；DSH
  保持扁平 listbox，但导航身份必须与用户看到的视觉顺序一致。

## 2026-11-25：Rollback 目录分组偏好只在单次 Show Diff 会话内保留

- 作用域：Commit Changes → Rollback Changes 的 `Group by directory`、对话框关闭/
  重开、Show Diff 往返和浏览器刷新后的恢复。
- 症状：在 Rollback 对话框中开启目录分组后，关闭对话框再重新打开会回到未分组；
  Show Diff 往返能保留，但跨对话框调用丢失，和 IDEA 的持久 Group By 行为不一致。
- 根因：`groupByDirectory` 只存在于 `confirmRollback` 的局部变量和 Show Diff
  session 中；对话框没有读取或写入任何持久偏好，`initial.groupByDirectory`
  缺省时直接按 `false` 处理。
- 修复：新增 `readRollbackDialogGroupByDirectory` /
  `writeRollbackDialogGroupByDirectory`，使用
  `dsh-editor.rollback.groupByDirectory` 保存布尔偏好；对话框初始化使用
  `initial.groupByDirectory ?? readRollbackDialogGroupByDirectory()`，用户切换时
  立即写入。localStorage 被禁用或抛错时回退为未分组，不阻断对话框。
- 回归：`tests/commit-rollback-group-by-preference-persists.test.mjs`，并更新
  `tests/commit-rollback-diff-inclusion-round-trip.test.mjs` 的恢复断言。
- 真实 Web：demo 的 `src/util.ts` Rollback 对话框中开启 Directory 分组后，
  localStorage 写入 `1`，列表出现 `src` group；关闭并重新打开仍为选中；
  刷新页面后再次打开仍为选中。验收后已关闭对话框并清除测试偏好，未执行 Rollback。
- IDEA 对照：IDEA Rollback Changes 的 Group By 选择在关闭并重新打开对话框后
  仍保留；DSH 保留扁平 listbox 语义，只持久化目录分组偏好，不复制 IDEA 的
  Module 分组或完整树。

## 2026-11-25：Rollback Diff 窄宽度工具栏挤掉差异计数和关闭按钮

- 作用域：Commit Changes → Rollback Changes → Show Diff 的窄 Editor 分栏、
  `Include in rollback` 复选框、差异计数、关闭按钮和工具栏容量测量。
- 症状：311px 宽的 Rollback diff 中，`Include in rollback` 文本占 111px，
  工具栏 `scrollWidth=389` 大于 `clientWidth=311`；差异计数 `1/1` 和
  `Close Diff Editor` 被 `overflow:hidden` 裁掉，用户只能依赖 Esc。
- 根因：工具栏只对右侧动作组做容量收缩，固定控件中的 rollback 标签文本没有
  响应式降级；同时 `diffFixedLayoutKey` 没有包含 rollback inclusion 是否出现，
  复选框挂载时不会重新测量固定宽度。
- 修复：新增 `diffRollbackIncludeLabelVisibleForWidth`，窄宽度只保留带
  `aria-label` 的复选框并隐藏文本；把 rollback inclusion 和标签可见性加入
  `diffFixedLayoutKey`，确保固定宽度变化触发重新测量。
- 回归：`tests/commit-rollback-diff-toolbar-keeps-close-and-hunk-controls.test.mjs`。
- 真实 Web：demo 的 `src/util.ts` Rollback Show Diff 在 311px 宽度下
  `scrollWidth=311`，`Include in rollback` 复选框仍可访问，差异计数 `1/1`
  和关闭按钮可见；关闭 diff 后 Rollback 对话框恢复并聚焦 `src/util.ts` 行。
- IDEA 对照：IDEA 的 Rollback diff 是独立宽窗口，顶部保留
  `Include in rollback`、差异计数和关闭窗口；DSH 在窄分栏中保留同一组
  核心动作，只折叠标签文字，不隐藏真实状态。

## 2026-11-25：Persisted Commit Graph scope 失效后进入不可恢复错误态

- 作用域：Commit Graph 的 persisted branch/commit scope、Graph 加载失败、
  scope 清理和状态提示。
- 症状：localStorage 保存的分支被删除后，Graph 请求直接失败；branch select
  显示空值、Graph 为空，用户只能手动切回 All branches，且没有说明旧 scope
  已失效。
- 根因：`loadGraph` 把 persisted scope 当作当前有效 ref 直接请求 Host；
  Host 对未知 branch / 不可达 commit 返回 stale-ref 错误，客户端没有区分
  这类错误与网络/权限失败，也没有清理失效 scope。
- 修复：新增 `requestCommitGraphWithScopeFallback`，只在
  `unknown branch`、`bad revision`、`bad object` 等 stale-ref 错误上重试；
  先保留 commit 去掉 branch，再退到全部分支。成功后写回规范化 scope，并用
  `graphScopeBranchReset` / `graphScopeBranchAtReset` /
  `graphScopeRevisionReset` / `graphScopeReset` 提示真实回退。Graph payload
  归一化和空 scope 构造抽到
  `commit-log-view-model.ts`，避免 `editor-workspace.tsx` 越过 12600 行守卫。
- 回归：`tests/commit-graph-stale-scope-falls-back.test.mjs`，并更新
  `editor-graph-refresh-failure-preserves-same-scope`、
  `editor-broken-head-makes-log-fail-instead-reading-empty`、
  `commit-graph-reports-parents-refs-branch-heads` 的 loadGraph 替身。
- 真实 Web：demo 写入 `{ branch: "deleted-branch", at: null }` 后刷新并打开
  Commit Graph，scope 被清除，branch select 回到 All branches，Graph 显示
  3 条真实提交，并提示 `Branch deleted-branch no longer exists; showing all
branches`。
- 真实 Web：demo 写入失效 branch + 有效 commit 后，scope 规范化为
  `{ branch: null, at: "<hash>" }`，Graph 保留该提交历史，并提示
  `Branch deleted-branch no longer exists; showing history at a63ebad`。

## 2026-11-25：Rollback 对话框缺少目录分组且分组后键盘顺序错位

- 作用域：Commit Changes → Rollback Changes 文件列表、Group by directory、
  Arrow/Home/End 导航、Shift 范围选择、Show Diff 往返。
- 症状：IDEA 的 Rollback Changes 可按 Directory/Module 分组；DSH 只有扁平
  列表。首次实现目录分组后，视觉顺序按目录排序，但 ArrowDown 仍按原始
  entries 顺序移动，`src/util.ts` 会跳到 `.idea/vcs.xml` 而不是同组的
  `src/new-feature.ts`。
- 根因：分组只改变 DOM 渲染顺序，`selectRow` 和键盘导航仍使用
  `entries.map(...)` 的原始顺序；Shift 范围选择也沿用了同一错误顺序。
- 修复：新增 `rollbackDialogDisplayRows` 和
  `rollbackDialogVisualEntryIndices`，分组时按目录排序并保留 entry index；
  `selectRow`、Arrow/Home/End 和 Shift 范围选择统一使用视觉 entry 顺序。
  Group by directory 状态写入 Show Diff session，关闭 diff 后恢复分组和
  当前行。DSH 不伪造 Module 分组，因为当前数据源没有模块模型。
- 回归：`tests/commit-rollback-confirmation-dialog.test.mjs`、
  `tests/commit-rollback-diff-inclusion-round-trip.test.mjs`。
- 真实 Web：demo 4 个变更按 `.idea` / `src` 分组；`src/util.ts` 按
  ArrowDown 到 `src/new-feature.ts`；Space 切换 inclusion 后 Show Diff，
  关闭 diff 后分组仍开启且焦点回到 `src/new-feature.ts`；取消分组后恢复
  原始顺序并回到 `.idea/vcs.xml`。
- IDEA 对照：IDEA Group By 菜单提供 Directory 和 Module；DSH 只实现有真实
  数据源的 Directory，并保留扁平 listbox 语义，不复制完整树。

## 2026-11-25：Search Everywhere 单独切换 Preserve case 不持久化

- 作用域：Search Everywhere More actions 的 Preserve case、搜索选项
  localStorage、Find Tool 与 Search Everywhere 的选项一致性。
- 症状：在 Search Everywhere 中只切换 Preserve case 后关闭/刷新，下一次打开
  仍恢复旧值；Find Tool 的 Preserve case 却能正常持久化。
- 根因：`writeSearchOptions(searchEverywhere)` 的 effect 依赖数组包含
  caseSensitive、wholeWords、regex、includeNonProject、fileMask，却漏掉
  `preserveCase`。状态本身已更新，但 effect 不会因该字段单独变化而执行。
- 修复：把 `searchEverywhere?.preserveCase` 加入同一持久化 effect 依赖；
  Find Tool 的现有依赖保持不变。
- 回归：`tests/search-everywhere-preserve-case-persists-on-toggle.test.mjs`。
- 真实 Web：Search Everywhere 中把 Preserve case 从 true 切到 false 后，
  `dsh-editor.search.options.v1` 立即写入 `preserveCase:false`；刷新后重新
  打开 Search Everywhere，More actions 中 Preserve case 仍为未选中。

## 2026-11-25：Project 过滤视图 speed search 污染隐藏的真实树展开状态

- 作用域：Project 的 Open Files / All Changed Files speed search、Enter 打开
  命中、Project Files 展开状态。
- 症状：在 All Changed Files 中搜索 `util` 并按 Enter 打开文件后，切回
  Project Files，原本折叠的 `src` 被展开；用户没有在真实树中执行展开操作。
- 根因：speed search Enter 路径无条件调用 `onRevealPath`，而该回调是
  `revealInProjectTree`，会为路径祖先执行 `setExpanded`。过滤视图的行已经
  是扁平可见行，不需要也不应该修改隐藏的真实树。
- 修复：新增 `projectSpeedSearchShouldRevealInTree(filteredView)`；只有真实
  Project Files 视图在打开命中后 reveal，过滤视图只打开文件并保留原树状态。
- 回归：`tests/project-speed-search-selection-uses-filtered-row-universe.test.mjs`。
- 真实 Web：Project Files 中折叠 `src`，切到 All Changed Files 搜索 `util`
  并 Enter 打开 `src/util.ts`，再切回 Project Files，`src` 仍保持折叠。

## 2026-11-25：Persisted commit scope 仍被标成 tag scope

- 作用域：Commit Graph 的 persisted `at` scope、tag badge、scope chip 和
  screen-reader announcement。
- 症状：tag 被删除后，localStorage 中仍保存 commit hash scope，但 chip 继续显示
  `History of tag at <hash>`，让用户误以为 tag 仍然存在。
- 根因：scope 存储只保存 `branch` / `at`，不保存 ref 名称；UI 对所有 `at`
  scope 使用 tag 文案。
- 修复：将 chip 和 announcement 改为 commit 语义：`History at <hash>` /
  `Commit graph limited to history at <hash>`，中文同步为“提交 <hash> 的历史”。
  这样 tag 删除后仍能准确描述当前 commit scope。
- 回归：`tests/search-scope-visual-label-removed-duplicate-screen-reader-output.test.mjs`、
  `tests/search-scope-announcement-real-zh-en-dictionaries.test.mjs`。

## 2026-11-25：Commit Log 搜索退出后 Graph 模式未恢复

- 作用域：Commit Log 全历史搜索、Graph 模式、搜索框清空、Graph scope 重载。
- 症状：Graph 模式开启后输入搜索，Graph 被临时关闭；清空搜索后仍停留在 flat
  log，用户需要再次手动打开 Graph。
- 根因：搜索 effect 只执行 `if (searchMode && graphMode) setGraphMode(false)`，
  没有记录搜索前的 Graph 状态，也没有在搜索退出时恢复。
- 修复：新增 `graphModeBeforeSearchRef`；搜索开始时记录并关闭 Graph，搜索清空后
  恢复 Graph 并重新调用 `onLoadGraph` 加载当前 branch/at scope。
- 回归：`tests/commit-log-full-history-search.test.mjs`。
- 真实 Web：Graph 开启后搜索 `baseline`，Graph 临时关闭且按钮 disabled；清空
  query 后 Graph 自动恢复，graph rows 重新出现。

## 2026-11-25：Commit Log 搜索与 author filter 被 Git OR 合并

- 作用域：Commit Log 全历史搜索、subject/author/hash 查询、独立 author filter。
- 症状：query=`baseline`、author=`Demo` 时返回该 author 的全部提交，而不是只返回
  subject 命中的 `baseline: add demo application`。
- 根因：`gitLogSearch` 的 author 查询同时传入了 author filter 和 query 的
  `--author=`；Git 对多个 `--author` 是 OR，导致 author filter 把所有该 author
  的提交都带进结果。最终 JS filter 只能过滤 author，无法恢复被 OR 扩大的集合。
- 修复：author 查询只传 query 的 `--author=`，不再传 author filter；author filter
  继续由最终 JS 过滤执行。subject 查询仍保留 author filter，避免扫描无关 author。
- 回归：`tests/git-log-search-full-history.test.mjs`。
- 真实 Web：Commit Log 中 query=`baseline`、author=`Demo`，结果只剩
  `f311737 baseline: add demo application`。

## 2026-11-25：Project speed search 跨视图切换残留旧查询

- 作用域：Project 工具窗的 Project Files / Open Files / All Changed Files
  视图切换、speed search、selection 恢复和焦点。
- 症状：在 Open Files 中输入 speed search 后切到 All Changed Files，旧 query
  仍留在搜索框，新视图被旧过滤条件压成 `No matches`，用户必须手动清空。
- 根因：speed search 只在显式关闭、Enter 或 inline edit 时清理；视图切换只改变
  `projectView`，没有关闭查询。`filteredView` 对 Open Files / Changed Files
  都是 true，不能作为视图身份。
- 修复：ProjectPanel 跟踪 `projectView` 变化；切换视图时清空 query-owned
  status、关闭搜索并聚焦 Project tree，但不恢复旧视图的 selection。
- 回归：`tests/project-speed-search-close-clears-stale-status.test.mjs`。
- 真实 Web：Open Files 中搜索 `app` 后切到 All Changed Files，搜索框关闭，
  列表恢复 `vcs.xml` / `workspace.xml` / `new-feature.ts` / `util.ts`，焦点回到
  Project tree。

## 2026-11-25：Search Everywhere Replace 入口不可达与成功替换后焦点丢失

- 作用域：Search Everywhere 的 Replace row、More actions 工具栏、Replace All
  成功/失败后的焦点、dirty model 替换。
- 症状：`withReplace` 只在 `SearchEverywhere` 内部渲染，但所有
  `openSearchEverywhere` 调用都传 `false`，Replace row 实际不可达；通过
  More actions 打开后，Replace All 成功会把焦点留在 Replace All 按钮而不是
  replacement 输入。
- 根因：缺少真实 toggle 入口；确认对话框关闭时把焦点还给 opener，成功状态只
  更新结果和 busy，没有在 busy 结束后重新聚焦 replacement 输入。
- 修复：More actions 增加 `Replace` 复选动作，Files/Actions 页禁用；新增
  `searchEverywhereReplaceToggleState` 统一切换 `withReplace` 和
  `replaceFocusRequest`。成功状态递增 focus request，并在 `replaceBusy`
  true→false 时再次聚焦 replacement 输入，覆盖确认对话框的 opener 恢复。
- 回归：`tests/search-everywhere-replace-row-toggle.test.mjs`。
- 真实 Web：dirty `src/app.ts` 中 Replace All 成功，模型内容更新，焦点回到
  `Replace with…` 输入；More actions 中 Replace 状态可切换。
- 补充修复：All 页 fast partial text search 从 `git grep` 候选读取文件后把
  `mtime` 写成 `0`，Replace 的 mtime 校验必然失败。现在读取候选文件后同时
  `stat`，返回真实 `mtimeMs`；回归
  `tests/search-fast-partial-text-mtime-replace.test.mjs`。
- 真实 Web：clean `src/new-feature.ts` 在 All 页 Replace All 成功，文件写入，
  焦点回到 `Replace with…` 输入，不再出现 stale mtime 错误。

## 2026-11-25：Changes 跨 staged/unstaged 的 Shift+Arrow 范围选择丢失

- 作用域：Commit Changes 树、staged/unstaged/unversioned 分组、Shift+Arrow
  范围选择、Rollback 对话框和 Show Diff 文件导航。
- 症状：从 staged 文件按 Shift+ArrowDown 时，焦点先落到 Unstaged 分组标题；
  分组选择会清空 range anchor，继续按 Shift+ArrowDown 只选中目标文件，原
  staged 行丢失。混合 band 的批量 Rollback 因此无法用键盘建立完整选择。
- 根因：`onChangesKeyDown` 把分组标题当作普通可移动行；`chooseGroup` 按设计
  清空 `selectedChanges` 和 `changeSelectionAnchorRef`，但 Shift+Arrow 不应
  经过分组标题。
- 修复：新增纯模型 `nextChangeFileRowIndex`，Shift+Arrow 只移动到下一个文件行，
  跳过 group/directory 标题；普通 Arrow 仍可选中分组。该 helper 同时从
  `components/ui/index.tsx` 和 `scripts/build-client.mjs` 的 `uiExports` 导出，
  避免 workspace 运行时出现未定义符号。
- 回归：`tests/commit-changes-rows-track-range-selection-separately-commit-checkboxes.test.mjs`。
- 真实 Web：demo 中 staged+unstaged `src/util.ts` 用 Shift+ArrowDown 同时选中；
  Rollback 对话框按路径合并为一行 `Staged + working tree`。staged added
  `src/new-feature.ts` 与 `src/util.ts` 同时选中时，对话框显示 2 个文件，
  `Delete local copies of added files` 可用；Show Diff 从 `1/2` 导航到 `2/2`，
  取消 util.ts inclusion 后 added 选项仍可用，取消 added 行后立即禁用并清空。
- IDEA 对照：IDEA Rollback Changes 对同一路径只列一行，Show Diff 使用
  `HEAD` 对 `Current version`；DSH 保留 staged/unstaged 分组，但在 Rollback
  对话框中按路径合并，避免同一文件重复回滚。

## 2026-11-25：Replace partial-success 错误被自动重跑清空

- 作用域：Find in Files / Search Everywhere Replace All、partial success、
  自动重跑、replacement 焦点和 Preview。
- 症状：clean 文件已经写入、dirty model 随后失败时，错误提示只出现一瞬；
  自动重跑开始/成功后把 `error` 清空，用户只看到剩余结果，不知道部分文件已替换。
- 根因：搜索 effect 在开始和成功时无条件 `error: null`；partial-success 只把
  错误写进 `error`，没有独立保存可跨自动重跑恢复的消息。
- 修复：`FindToolState` 增加 `replacePartialFailureMessage`；partial state 同时
  设置 `replacePartialFailure=true` 和消息；搜索 effect 在 partial-success 期间
  从该字段恢复 `error`，查询/选项变化或新替换开始时清空。Search Everywhere
  partial state 同时清空 `index` 和 `activeRowKey`，避免旧 text row 身份残留。
- 回归：`tests/search-replace-partial-success-records-committed-dirty-undo.test.mjs`、
  `tests/search-find-search-options-transition-model.test.mjs`。
- 真实 Web：demo 中 53 个文件 Replace All，确认后 dispose 当前 dirty model；
  clean 文件已写入，dirty 文件失败。自动重跑后错误仍显示
  `Replace did not complete fully: Model is disposed!`，焦点仍在 replacement
  输入，Preview 显示当前 dirty 内容；修改查询后错误才清除。

## 2026-11-25：Project 过滤视图 Select Opened File 污染树展开状态

- 作用域：Project 的 Open Files / All Changed Files 过滤视图、Select Opened File、
  Project Files 展开状态。
- 症状：`src` 在 Project Files 中已折叠；切到 Open Files 执行 Select Opened File
  后再切回 Project Files，`src` 被展开，用户原有折叠状态被改写。
- 根因：过滤视图复用了 `revealInProjectTree`，该函数会为路径的每个祖先执行
  `callFs` 并 `setExpanded`；但过滤视图的行是扁平模型，目标行已经渲染，不需要
  展开真实树。
- 修复：新增 `revealProjectRow`，只负责 `setSelectedPath`、滚动目标行和把焦点
  交回 Project tree；`revealInProjectTree` 在展开/加载祖先之后复用它；
  `revealActive` 在过滤视图且目标行存在时直接走 `revealProjectRow`，目标不在
  过滤行时仍走 `revealPath` 切回真实树并展开。
- 回归：`tests/editor-select-opened-file-chord-arms-reveals-clears-expires.test.mjs`。
- 真实 Web：Open Files 中 Select Opened File 选中 `app.ts` 后切回 Project Files，
  `src` 仍折叠；All Changed Files 中目标不在过滤行时，仍切回 Project Files 并
  展开 `src` 显示 `app.ts`。

## 2026-11-25：Commit Log 全历史搜索退出后选中行不可见

- 作用域：Commit Log 全历史搜索、清空 query、恢复分页列表、选中 commit 与详情。
- 症状：在 70 条提交中搜索并选中首屏之外的旧提交后清空 query，详情和
  `aria-selected` 仍保留，但列表 `scrollTop=0`，选中的行不可见。
- 根因：搜索模式替换了可见行集合；退出搜索后 React 重新挂载完整列表，但
  没有在布局完成后把当前选中行滚回可视区。行级 `ref` 的
  `scrollIntoView` 在搜索行卸载/完整行挂载的同一帧里不可靠。
- 修复：`commit-log-view-model` 新增 `revealCommitLogSelection`，按稳定的
  `commitLogOptionId` 查找选中行并 `scrollIntoView({ block: 'nearest' })`；
  `CommitLog` 在非 graph、非 search 模式下用 `requestAnimationFrame` 在
  行集合变化后执行，依赖 `selected` 与 `visible.length`。
- 回归：`tests/commit-log-search-selection-reveal.test.mjs`。
- 真实 Web：70-commit demo 搜索 `f75c8fd` 并选中 `needle-old commit`，
  清空 query 后 `scrollTop=3341`，选中行位于 listbox 可视区内。

## 2026-11-25：Rollback 对话框捕获层吞掉行导航键

- 作用域：Rollback Changes 对话框、文件 listbox、Arrow/Home/End、Space、
  Show Diff 往返焦点。
- 症状：真实 Web 中点击 Rollback 文件行后按 `End`、`ArrowDown` 或
  `Shift+ArrowUp` 没有任何反应；Space 只切换当前行，无法按多行选择批量
  inclusion。
- 根因：backdrop 的 `keydown` 监听使用 capture，并在所有非 Space 键上先
  `stopPropagation()`；行自己的 keydown handler 永远收不到导航键。Show Diff
  关闭后重新打开对话框时又固定聚焦 Cancel，丢失上次查看行。
- 修复：新增 `rollbackDialogRowOwnsKey`，让行拥有的
  `Space/Spacebar/ArrowDown/ArrowUp/Home/End` 在 capture 层直接放行；
  新增 `rollbackDialogInitialFocusTarget`，从 diff 恢复时聚焦
  `rows[selectedIndex]`，首次打开仍聚焦 Cancel。
- 回归：`tests/commit-rollback-confirmation-dialog.test.mjs`、
  `tests/commit-rollback-diff-inclusion-round-trip.test.mjs`。
- 真实 Web：`End` 聚焦最后一行，`Shift+ArrowUp` 选中最后两行，Space 同时
  取消两行 inclusion；Show Diff 关闭后焦点回到 `unstaged:src/util.ts` 行。

## 2026-11-25：Terminal tab 激活刷新 cwd

- 作用域：Terminal tab 点击、overflow 菜单激活、tab tooltip、Host cwd fallback。
- 症状：无 OSC 7 的 shell `cd` 后，只有打开 tab 菜单才会刷新 cwd；直接切换
  tab 时 tooltip 仍显示旧目录。
- 根因：`activateTerminalTab` 只更新 activeId/focusedPane，没有触发 Host cwd
  查询；overflow 菜单还绕过了 `activateTerminalTab`，直接 `setActiveId`。
- 修复：新增 `terminalCwdRefreshDue` 和 `refreshTerminalCwdIfStale`，tab
  激活时按 2 秒节流查询 Host cwd；overflow 菜单改为复用
  `activateTerminalTab(terminal)`，确保所有激活入口走同一路径。
- 回归：`tests/terminal-host-cwd-fallback.test.mjs`、
  `tests/terminal-tabs-expose-localized-tablist-roving-tab-semantics.test.mjs`。
- 真实 Web：`exec /bin/sh` + `cd /tmp` 后切到 Terminal 1，再通过 overflow
  切回 Terminal 5，tab tooltip 更新为 `/private/tmp`，无需打开 tab 菜单。

## 2026-11-25：Rollback 对话框多行 inclusion 批量切换

- 作用域：Rollback Changes 文件列表、Shift/Cmd 多选、Space 批量 inclusion。
- 症状：对话框只能操作当前行；多文件回滚时，用户必须逐行点击 checkbox，
  无法像 IDEA 的 Changes 树一样先选中多行再统一切换。
- 根因：`selectRow` 只维护一个 `selectedIndex`，Space 直接点击当前行
  checkbox，没有独立的多行选择集合。
- 修复：复用 `commitSelectionAfterClick` 维护 `selectedRowKeys` 和 anchor；
  Shift/Cmd 点击与 Shift+方向键扩展选择；Space 通过
  `rollbackDialogToggleInclusion` 对全部选中行执行“任一未选则全选，否则全清”。
  `aria-selected` 仍只表示 inclusion，视觉 active 表示多行选择，tab stop 仍
  只有当前行。
- 回归：`tests/commit-rollback-confirmation-dialog.test.mjs`。
- 真实 Web：demo 中选中 `src/util.ts` 与 `src/new-feature.ts`，Rollback
  对话框 Shift 选中两行后按 Space，两行 checkbox 同时取消；再按 Space
  同时恢复，`aria-selected` 与 inclusion 保持一致。

## 2026-11-25：Rollback Show Diff 恢复滚动位置

- 作用域：Rollback Changes 多文件对话框、Show Diff、关闭 diff 后恢复对话框。
- 症状：在长 Rollback 文件列表中滚动到下方并查看某个 diff，关闭后列表回到
  顶部；当前行虽然恢复，但用户仍要重新滚动。
- 根因：`showDiff` 结果只携带当前行和 inclusion，没有保存 listbox 的
  `scrollTop`；重新打开对话框时也没有恢复滚动位置。
- 修复：`RollbackDialogResult.showDiff` 和 `RollbackDialogInitial` 增加
  `scrollTop`；`RollbackDiffSession` 保存并回传该值；对话框 append 到 DOM
  后恢复 `list.scrollTop`。
- 回归：`tests/commit-rollback-diff-inclusion-round-trip.test.mjs`、
  `tests/commit-diff-moves-keyboard-focus-into-comparison.test.mjs`。
- 真实 Web：临时创建 30 个 unversioned 文件，Rollback 对话框共 33 行；
  滚动到 `scrollTop=219` 并查看 `src/scroll-demo-20.ts`，关闭 diff 后
  `scrollTop` 仍为 `219`，当前行仍是该文件。验收后已删除临时文件。

## 2026-11-25：Terminal 无 OSC 7 的 Host cwd fallback

- 作用域：Terminal tab 菜单、复制目录路径、Duplicate、Reveal、README、
  `TerminalHub`、`/api/dsh-editor/terminal`。
- 症状：shell 不发送 OSC 7 时，`cd` 后标签菜单仍使用终端启动目录；复制路径、
  Duplicate、Reveal 和 README 都指向旧目录。
- 根因：浏览器只从 OSC 7 更新 cwd；Host 的 `TerminalSession` 只保存创建时的
  `meta.cwd`，没有查询 live process cwd 的入口。
- 修复：Host 新增 `terminalProcessCwd(pid)`，Linux 读取
  `/proc/<pid>/cwd`，macOS 使用 `/usr/sbin/lsof -a -p <pid> -d cwd -Fn`；
  `TerminalHub.cwd` 更新 `meta.cwd` 并返回当前目录；terminal route 新增
  `op: 'cwd'`。浏览器在打开 tab 菜单前调用 `refreshTerminalCwd`，成功时同步
  `terminalCwdRef`/state，失败才回落到启动目录。
- 回归：`tests/terminal-host-cwd-fallback.test.mjs`、
  `tests/terminal-every-emulator-callback-registered-destructured.test.mjs`、
  `tests/terminal-tab-menu-reveal-shell-directory.test.mjs`。
- 真实 Web：新建终端后执行 `exec /bin/sh`、`cd /tmp`，打开 tab 菜单，标签
  tooltip 从启动目录更新为 `/private/tmp`；菜单中的复制路径、Duplicate、
  Reveal 和 README 使用同一 cwd。
- 边界：Windows 暂不提供进程 cwd fallback；OSC 7 仍是首选，Host 查询只在
  菜单打开时按需执行，避免持续轮询进程表。

## 2026-11-25：Replace partial-success 后结果行失效

- 作用域：Search Everywhere Replace All、Find Replace All、Find 单处 Replace、
  partial-success 错误状态、Preview 和 active row。
- 症状：部分文件已经替换、随后 dirty commit 或刷新失败时，错误提示正确出现，
  但旧结果行、Preview 和 active row 仍指向替换前的内容；用户继续点击会看到
  过期位置。
- 根因：`replaceFailureState` / `replaceFailureSettlement` 只结束 busy 并写入
  error，没有区分“完全失败”和“已有写入落地”的 partial success。
- 修复：新增 `replaceCommitTrackerHasChanges` 判断 clean/dirty 是否已有提交；
  `searchEverywherePartialReplaceState` 清空 `textMatches` 并推进
  `textRevision`；`findToolPartialReplaceState` 清空 `matches/files`、重置
  `index`、推进 `searchGeneration` 并设置 `loadedGeneration=-1`。两个
  dispatcher 只在 tracker 有真实写入时失效结果，纯失败仍保留原结果。
- 回归：`tests/search-replace-partial-success-records-committed-dirty-undo.test.mjs`。
- 行为边界：partial success 仍保留本地化错误和 Undo/Redo 记录；下一次搜索
  自动针对新内容重跑，不把旧行伪装成当前结果。

## 2026-11-25：Rollback Show Diff 的 Include in rollback 往返

- 作用域：Commit Changes 工具栏 Rollback、Rollback Changes 对话框、
  Rollback Show Diff、Diff 工具栏、`use-rollback-diff-session`。
- 症状：从 Rollback 对话框打开 diff 后只能查看，不能像 IDEA 一样在 diff
  工具栏取消/恢复 `Include in rollback`；关闭 diff 后重新打开对话框时，
  之前的 inclusion 选择丢失。
- 根因：Show Diff 只返回单个 entry，没有携带当前 checkbox 选择；diff 没有
  rollback session，关闭 diff 时直接回到编辑器/Changes，而不是恢复对话框。
- 修复：`RollbackDialogResult.showDiff` 携带 `selectedEntries` 和
  `deleteAdded`；`confirmRollback` 接受 `initial.selectedKeys` /
  `initial.deleteAdded`；新增 `use-rollback-diff-session` 保存 entries、
  selectedKeys、deleteAdded 和 resume 回调；Diff 工具栏在 rollback session
  存在时显示 `Include in rollback`，关闭 diff 时用当前 session 重新打开
  Rollback Changes 对话框。初始 inclusion 同时驱动 row checkbox、
  `aria-selected`、Select all 三态和 Rollback disabled。
- 回归：`tests/commit-rollback-diff-inclusion-round-trip.test.mjs`、
  `tests/commit-rollback-confirmation-dialog.test.mjs`、
  `tests/commit-diff-moves-keyboard-focus-into-comparison.test.mjs`。
- 真实 Web：demo 的 `src/util.ts` 打开 Rollback Show Diff 后 checkbox 默认
  勾选；取消后关闭 diff，对话框行 checkbox 为未勾选、`aria-selected=false`、
  Rollback 禁用；重新勾选并再次 Show Diff 后 checkbox 保持勾选，关闭后
  Rollback 恢复可用。
- IDEA 对照：IDEA 的 Rollback diff 工具栏提供同名 checkbox；DSH 用
  “关闭 diff 后恢复对话框”的 Web 安全往返替代 IDEA 的独立 diff 窗口，
  不把 modal 对话框和编辑器同时暴露给指针输入。

## 2026-11-25：Rollback Show Diff 恢复当前行

- 作用域：Rollback Changes 多文件对话框、Show Diff、关闭 diff 后恢复对话框。
- 症状：在多文件 Rollback 对话框中从第二行打开 diff，关闭后对话框总是把
  第一行设为当前行，用户需要重新定位刚才检查的文件。
- 根因：`confirmRollback` 虽然计算了 `selectedIndex`，但初始化时仍调用
  `selectRow(0, false)`；diff session 也没有保存当前 diff 对应的 rollback
  entry key。
- 修复：新增 `rollbackDialogInitialIndex`，按 `group:path` 恢复当前行；
  `RollbackDiffSession` 保存 `selectedKey`，diff 文件导航时同步更新；
  关闭 diff 时把 `selectedKey` 传回对话框，并调用
  `selectRow(selectedIndex, false)`。
- 回归：`tests/commit-rollback-diff-inclusion-round-trip.test.mjs`、
  `tests/commit-diff-moves-keyboard-focus-into-comparison.test.mjs`。
- 真实 Web：demo 同时选择 `src/util.ts` 和 `src/new-feature.ts`，在对话框
  第二行打开 Show Diff（`2/2`），关闭后对话框当前行仍是
  `src/new-feature.ts`，不是第一行。

## 2026-11-25：Rollback band 文案与 Show Diff 导航范围

- 作用域：Commit Changes 工具栏 Rollback、Rollback Changes 对话框、
  `rollbackDialogGroupForChange`、`rollbackDialogConfirmKey`、Diff 文件导航。
- 症状：对只有工作区修改的 `src/util.ts` 执行工具栏 Rollback 时，对话框把
  行标成 `Staged + working tree`，确认文案也声称会丢弃暂存内容；从 Rollback
  对话框点 Show Diff 后，diff 工具栏显示 `1/4`，把对话框范围误报成整个
  Changes 列表。
- 根因：`all=true` 被直接映射成 `group='all'`，没有读取 porcelain 两列；
  `diffChangeSequence` 只从 `git.changes` 派生，没有携带 Rollback 对话框的
  文件范围。
- 修复：`all` 模式按 `status[0]` / `status[1]` 区分 staged、unstaged、both
  和 unversioned；新增 `rollbackDialogConfirmKey`，按实际 entries 选择确认
  文案；`RollbackDialogResult.showDiff` 携带 entries；`DiffTarget` 增加
  `navigationEntries`，`diffNavigationSequence` 优先使用该范围，文件导航和
  `onNavigate` 保留同一 scope。普通 Changes Show Diff 仍回退到完整 Changes
  序列。
- 回归：`tests/commit-rollback-confirmation-dialog.test.mjs`、
  `tests/commit-diff-file-navigation-follows-visible-path-filter-result.test.mjs`、
  `tests/commit-unversioned-detection-nothing-rejects-empty-mixed-sets.test.mjs`。
- 真实 Web：demo 的 unstaged `src/util.ts` 显示 `Working tree` 和
  `Discard uncommitted changes...`；暂存后显示 `Staged`；Rollback 对话框的
  Show Diff 显示 `1/1`，普通 Changes Show Diff 仍显示 `1/4`。
- IDEA 对照：IDEA Rollback Changes 的 Show Diff 只围绕对话框中的文件；DSH
  现在对齐文件范围，但尚未实现 IDEA diff 工具栏里的 `Include in rollback`
  复选框。

## 2026-11-25：搜索索引测试只断言持久不变量

- 作用域：项目索引增量更新、启动校验、文本搜索测试。
- 症状：全量测试中 `search-text-uses-persisted-content-during-index-update`
  偶发失败，单文件运行稳定通过。
- 根因：测试把“搜索期间更新仍在进行”当成调度时序保证；高负载下更新可能
  在搜索完成前结束，`truncated` 和 `skippedStats` 的瞬时值不再固定。
- 修复：测试保留“搜索必须命中持久快照”的核心断言，同时接受两种真实完成
  路径：stale-safe 搜索报告 truncation，或更新已完成并由完整快照提供全部
  文件；路径 sidecar 修复测试使用稳定的 in-process watcher，隔离 OS watcher
  资源波动。
- 回归：`tests/search-text-uses-persisted-content-during-index-update.test.mjs`、
  `tests/search-index-path-sidecar-header-repair.test.mjs`。

## 2026-11-25：Commit Log 文本过滤改为全历史搜索

- 作用域：Commit Log 文本过滤、Host `gitLogSearch`、客户端搜索 hook、分页与
  Graph 模式。
- 症状：文本过滤只作用于已经加载的 60 条提交；旧提交必须反复点 Load More
  才能找到，和 IDEA 的完整历史搜索不一致。
- 根因：过滤完全在浏览器侧对 `commits` 数组执行，Host 没有按 query 搜索历史
  的入口。
- 修复：Host 新增 `gitLogSearch`，并行执行 subject `--grep`、author 搜索和
  hash 前缀解析，合并去重后按日期倒序返回最多 200 条；客户端新增
  `useCommitLogSearch`，250ms 防抖、AbortController 取消、独立 loading/error/
  truncated 状态。搜索模式替换已加载页，禁用 Load More 和 Graph，清空 query
  后恢复原分页列表；达到 200 条时显示“仅显示前 200 条匹配”。
- 回归：`tests/git-log-search-full-history.test.mjs`、
  `tests/commit-log-full-history-search.test.mjs`。
- 真实 Web：70-commit 临时仓库中过滤 `needle-old`，首屏 60 条之外的旧提交
  直接出现，无需 Load More；清空过滤后恢复原分页列表和 Load More。
- IDEA 对照：IDEA Git Log 的搜索框直接过滤完整历史；DSH 现在用有界 Host
  搜索实现同一语义，不把“已加载页”伪装成完整历史。

## 2026-11-25：Rollback 对话框的 added-file 删除选项

- 作用域：Commit Changes 工具栏 Rollback、staged added 文件、Rollback Changes
  对话框、Host `gitRollback` 的 `all` 模式。
- 症状：上一轮为避免静默删除，staged added 文件在 `all` 回滚中只取消暂存并保留
  本地副本；IDEA 的 Rollback Changes 提供 `Delete local copies of added files`
  复选框，用户需要显式选择是否删除。
- 根因：对话框没有 added 文件元数据，也没有把删除意图传给 Host；Host 只能
  固定保留 added 文件。
- 修复：`RollbackDialogEntry` 增加 `added`；对话框新增
  `Delete local copies of added files` 复选框，只有存在 added 行时启用，默认
  关闭；结果携带 `deleteAdded`。Host `gitRollback` 在 `all + deleteAdded` 时
  先取消暂存再删除 added 文件；未勾选时仍保留本地副本。
- 回归：`tests/commit-rollback-confirmation-dialog.test.mjs`、
  `tests/editor-staged-only-change-discarded-index-not-file.test.mjs`。
- 真实 Web 验收：demo 的 `src/new-feature.ts` 暂存后，Rollback 对话框中的
  `Delete local copies of added files` 可用且默认未勾选；勾选并确认后文件从
  磁盘和索引消失，`git status` 不再包含该路径。验收后已用保存内容恢复文件。
- 同一轮复核 added 文件的 Show Diff：现有 `HEAD / Current version` 双栏已经
  正确显示新文件正文，不需要额外伪造“新文件”占位。
- 复选框启用状态跟随当前选中行：取消勾选 added 行后立即禁用并清空
  `Delete local copies of added files`，避免对已排除文件保留删除意图。
- IDEA 对照：IDEA Rollback Changes 在 added 文件存在时启用同名复选框；DSH
  现在采用相同默认值和安全边界。

## 2026-11-25：Commit 工具栏 Rollback 同时处理暂存与工作区

- 作用域：Commit Changes 工具栏 Rollback、staged-only 选择、Rollback Changes
  对话框、Host `gitRollback`、已暂存新增文件。
- 症状：只选中 staged 文件时工具栏 Rollback 被禁用；即使通过分组菜单执行，
  也只撤出索引，工作区修改仍在。IDEA 的 Rollback Changes 会把 staged 文件
  列入同一回滚对话框并丢弃两侧修改。
- 根因：`onRollbackSelected` 主动过滤 `entry.staged !== true`，Host 只有
  `staged`（只撤索引）和 worktree（只还原工作区）两种模式，没有“两侧一起回滚”。
- 修复：Host `gitRollback` 新增 `all` 模式；tracked 文件先
  `git restore --staged` 再 `git checkout --`，untracked 文件删除，staged
  added/renamed/copied 文件只取消暂存并保留本地副本。工具栏 Rollback 传递完整
  选择并调用 `{ all: true }`；对话框新增 `Staged + working tree` 分组和
  `rollbackAllConfirm` 文案。
- 回归：`tests/editor-staged-only-change-discarded-index-not-file.test.mjs`、
  `tests/commit-rollback-confirmation-dialog.test.mjs`、
  `tests/commit-changes-toolbar-exposes-idea-diff-selected-row.test.mjs`。
- 真实 Web 验收：demo 的 `src/util.ts` 暂存后，工具栏 Rollback 对话框显示
  `Staged + working tree`；确认后 `git status` 不再包含 `util.ts`，文件内容
  回到 HEAD。验收后已用保存的 patch 恢复 demo 的未暂存修改。
- IDEA 对照：IDEA Rollback Changes 在 staged `util.ts` 上仍列出该文件并允许
  Rollback；DSH 现在采用同样的工具栏语义，但对 staged added 文件默认保留本地
  副本，避免在没有 IDEA `Delete local copies of added files` 复选框时静默删除。

## 2026-11-25：Rollback 对话框的 band 身份与 ARIA 选择语义

- 作用域：Commit Changes 的 Rollback Changes 对话框、逐文件 checkbox、
  `aria-selected`、Show Diff、Select all 和最终 Host rollback 路径。
- 症状：对话框用 `path` 作为选择键，同一路径若同时出现在 staged/unstaged
  两个 band 会共享一个 checkbox 状态；同时 `aria-selected` 被当作键盘焦点
  标记，方向键移动后已勾选行会被读成未选中。
- 根因：选择身份没有包含 band；`selectRow` 把焦点状态写进 `aria-selected`，
  而 checkbox 的 inclusion 状态没有同步到 option 语义。
- 修复：新增 `rollbackDialogEntryKey`，选择集合、checkbox map、Select all 和
  Host 提交都使用 `group:path` 身份；`aria-selected` 只跟随 checkbox inclusion，
  键盘焦点继续由真实 DOM focus、`tabIndex` 和视觉 active 样式表达。
- 回归：`tests/commit-rollback-confirmation-dialog.test.mjs`。
- 真实 Web 验收：两行 rollback 对话框中，焦点从 `src/util.ts` 移到
  `src/new-feature.ts` 后两行 `aria-selected` 仍为 `true`；取消勾选
  `src/new-feature.ts` 后该行变为 `false`，Select all 进入 indeterminate。
- IDEA 对照：IDEA Rollback Changes 使用带 checkbox 的 Changes 树；DSH 保持
  现有紧凑 listbox 布局，但把 inclusion 与 focus 语义分开，不复制 IDEA 的树
  容器。

## 2026-11-25：Commit Log 过滤后显式 Load More

- 作用域：Commit Log 的本地 subject/author/hash 过滤、60 条分页、滚动加载、
  `No matches` 状态和 footer。
- 症状：过滤条件只匹配尚未加载的旧提交时，当前页被过滤成 0 行；列表没有
  滚动条，`onScroll` 无法触发下一页，用户被永久困在 `No matches`。
- 根因：分页只依赖滚动事件，而过滤后的可见行数可以小于视口；`No matches`
  没有区分“已加载页无命中”和“全部历史无命中”。
- 修复：新增 `commitLogLoadMorePlacement` 纯模型；过滤后 0 行时在状态区显示
  显式 `Load more`，有可见行但历史未结束时在 footer 显示同一动作；加载中
  复用共享 `logLoading` 显示 Loading 并阻止重复请求，取消/完成时统一释放。
- 回归：`tests/commit-log-load-more-explicit-action.test.mjs`、
  `tests/commit-commitlogliststate-owns-loading-errors-empty-states-footer.test.mjs`。
- 真实 Web 验收：70-commit 临时仓库首屏 60 条；过滤 `needle-old` 命中第 6 条
  旧提交时显示 `No matches` + `Load more`，点击后加载第二页并显示
  `needle-old commit`；清空过滤并刷新后 footer 也出现 `Load more`。
- IDEA 对照：IDEA Git Log 的搜索框直接过滤完整历史；DSH 没有 Git log 索引，
  因此保留本地过滤并用显式 Load More 作为有界、可解释的替代，不伪造全历史
  搜索已完成。

## 2026-11-25：Terminal 关闭/重开保留手动标题

- 作用域：Terminal 标签关闭历史、`Reopen Closed Terminal`、`⌘⇧T`、Host
  `rename`、自动 OSC 标题。
- 症状：手动重命名的终端关闭后，从关闭历史重开时标题退回 shell 自动标题；
  自动标题的终端则不应在重开时被冻结成旧标题。
- 根因：关闭历史只保存 `shell/cwd/title`，没有保存标题是否由用户手动重命名；
  重开路径只重建 PTY，没有把手动标题重新写回 Host。
- 修复：`TerminalRestoreEntry` 与 `readClosedTerminals` 保留 `manualTitle`；
  `rememberClosed` 写入该标记；`reopenClosed` 仅在 `manualTitle === true` 且标题
  非空时调用 Host `rename`，成功后更新本地 terminal 并加入 `renamedRef`，失败
  不阻止 shell 恢复和焦点恢复。自动标题不写回，继续跟随 shell OSC。
- 回归：`tests/terminal-reopen-closed-terminal-restores-manual-title.test.mjs`、
  `tests/terminal-readterminalprofile-well-formed-entries-drops-rest.test.mjs`。
- 真实 Web 验收：demo 终端 `cd src` 后手动重命名为 `Reopen Probe`，关闭后从
  标签菜单重开，标题恢复为 `Reopen Probe`；localStorage 关闭历史包含
  `manualTitle: true`。本次 demo shell 未发送 OSC 7，关闭历史 cwd 仍为启动目录，
  因此 cwd 往返需由 shell integration 或后续 Host 侧 cwd 探测单独覆盖。

## 2026-11-25：Replace partial-success 的 dirty Undo 与索引失效

- 作用域：Search Everywhere / Find 的 Replace All、单处 Replace、dirty Monaco
  buffer、clean host 写入、Undo Last Replace / Redo Last Replace、持久搜索索引。
- 症状：dirty buffer 已经成功替换，但随后刷新磁盘文件或 Git 状态失败时，catch
  只记录 clean host transaction；dirty 修改没有进入 Undo 历史，Redo 栈也没有
  清空。单处 Replace 的 dirty 成功路径同样没有记录 undo。
- 根因：partial-success 的 catch 只根据 `hostChanged` 构造 host-only operation，
  没有区分 dirty plan 是否已经 commit；`dirtyUndo` 在失败时被丢弃。
- 修复：新增 `committedReplaceOperation`，只把真正 commit 的 dirty plan 写入
  operation；Replace All 与单处 Replace 的 catch 统一用它记录 host-only、
  dirty-only 或 combined operation，并在有提交结果时清空 Redo 栈。失败文案使用
  operation 的实际文件数，dirty-only partial success 也会显示 partial-success。
  `ReplaceCommitTracker` 把 host/dirty 提交边界收敛到共享模型，避免
  `editor-workspace.tsx` 因重复状态变量越过 12600 行模块守卫。
- 回归：`tests/search-replace-partial-success-records-committed-dirty-undo.test.mjs`、
  `tests/search-mixed-replace-host-success-dirty-failure-refreshes-host.test.mjs`、
  `tests/search-index-text-provider-watcher-freshness.test.mjs`。
- 真实 Web 验收：demo 项目临时文件 Replace All 后磁盘内容更新；随后搜索新内容
  命中、旧内容 0 命中；探针文件已删除。

## 2026-11-25：Terminal 快照重放与手动标题往返

- 作用域：Terminal 的 Move to Editor、Return to Dock、页面刷新、关闭/重开，
  以及 OSC 0/2/7 标题和 cwd 元数据。
- 症状：终端在 Editor 中 `cd src` 后返回 Dock，事件携带的 `cwd` 正确，但 Dock
  被重放快照里的旧 OSC 7 覆盖回项目根目录；手动重命名后的终端移动到 Editor
  时，Editor 标签又被 shell 的 OSC 标题覆盖。
- 根因：Host 的 `snapshot` 事件重放原始 PTY 输出，其中包含历史 OSC 序列；
  `TerminalScreen` 把重放输出和实时输出走同一回调，旧 OSC 会覆盖当前状态。
  同时 Host 内部已有 `manualTitle`，但 `describe()` 没有暴露，Editor 侧无法
  区分手动标题与 shell 自动标题。
- 修复：`terminalSnapshotMetadata` 只提取快照中最后一条 OSC 标题和 cwd；
  `TerminalScreen` 在快照重放期间抑制 OSC 回调，重放完成后只提交最终元数据，
  实时数据排队到重放结束。Host `describe()` 暴露 `manualTitle`，TerminalPanel
  和 Editor 描述符携带该标记；Editor 对手动标题忽略后续 OSC 标题。
- 回归：`tests/terminal-snapshot-metadata-replay.test.mjs`、
  `tests/terminal-manual-title-survives-editor-round-trip.test.mjs`。
- 真实 Web 验收：`cd src` 后 Move to Editor → Return to Dock，Dock 标题和
  tooltip 的 cwd 均为 `src`；手动重命名 `My Shell` 后 Move to Editor，Editor
  标签保持 `My Shell`，刷新后仍保持，Return to Dock 后仍为 `My Shell`。

## 2026-11-25：Select Opened File 的 Project 焦点

- 作用域：Project 工具栏 `Select Opened File`、Alt+F1,1、Project Files / Open Files
  过滤视图。
- 症状：点击 Select Opened File 后目标行虽然选中，但键盘焦点仍停在工具栏按钮；
  过滤视图和普通 Project Files 视图都存在。
- 根因：Project 行本身没有 `tabIndex`，真正的键盘所有者是 Project tree 容器；
  reveal 逻辑只滚动/选中行，没有把焦点交给 tree，也没有在过滤视图复用同一
  reveal 路径。
- 修复：`revealInProjectTree` 在选中并滚动后聚焦 `[data-dsh-project-tree]`；
  过滤视图直接复用 `revealInProjectTree`，让 `aria-activedescendant` 与选中行
  保持一致。
- 回归：`tests/editor-select-opened-file-chord-arms-reveals-clears-expires.test.mjs`、
  `tests/project-active-editor-tabs-not-auto-reveal-themselves.test.mjs`。
- 真实 Web 验收：Open Files 视图点击 Select Opened File 后焦点进入 Project tree，
  `aria-activedescendant` 指向 `src/app.ts`；切回 Project Files 后同样聚焦 tree。

## 2026-11-25：Changes 过滤视图下的 Rollback 焦点与顺序

- 作用域：Commit Changes path filter、Rollback 后主行选择、清空过滤器后的焦点。
- 症状：过滤 `app` 后回滚 `src/app.ts`，列表变成 `No matches`，焦点落到
  Changes 树容器；清空过滤器后虽然选中了 `src/util.ts`，但焦点仍停在过滤输入框。
- 根因：过滤视图的 DOM 顺序只包含当前可见行，Rollback 收敛无法从完整 Changes
  顺序找到最近存活行；清空过滤器时又只读取一次尚未挂载的行引用。
- 修复：Rollback 同时捕获过滤后的可见顺序和 `changeSequenceOf` 的完整顺序；
  有可见存活行时优先可见顺序，否则使用完整顺序。无可见行时焦点回退到 Changes
  过滤输入框；清空过滤器改用 `focusSurfaceWhenReady`，等待选中行挂载后再聚焦。
- 回归：`tests/commit-changes-rows-track-range-selection-separately-commit-checkboxes.test.mjs`、
  `tests/commit-esc-clear-button-clear-changes-filter-return-focus-tree.test.mjs`。
- 真实 Web 验收：过滤 `app` 回滚 `src/app.ts` 后焦点进入过滤输入框；清空过滤器
  后选中并聚焦完整顺序中的最近存活行 `src/util.ts`。

## 2026-11-25：Rollback 跨暂存/工作区身份跟随

- 作用域：Commit Changes 的 staged-only rollback、working-tree rollback、
  MM 文件、批量与目录回滚后的主行选择。
- 症状：对 staged 文件执行“丢弃暂存版本”后，文件移动到 Unstaged，但选择跳到
  下一个无关文件；对 MM 文件还原工作区后，选择也没有跟随到仍存在的 Staged 行。
- 根因：收敛模型只按视觉顺序寻找最近存活行，没有识别同一路径从
  `staged:` 移到 `unstaged:`（或反向）的身份变化。
- 修复：`reconcileChangeSelectionModel` 在最近存活行之前优先检查首个被删除
  key 的对侧 band 同路径 key；存在时选择该行。批量/目录回滚仍保留原有最近
  存活行逻辑。
- 回归：`tests/commit-change-nearest-row-after-removal.test.mjs`。
- 真实 Web 验收：staged-only 回滚 `src/app.ts` 后选中并聚焦
  `unstaged:src/app.ts`；MM 文件还原工作区后选中并聚焦
  `staged:src/app.ts`；批量回滚 `src/util.ts` + `src/new-feature.ts` 后选中
  `.idea/.gitignore`；目录回滚 `.idea` 后选中 `src/app.ts`。

## 2026-11-25：Rollback 后 Changes 行焦点与隐藏行展开

- 作用域：Commit Changes 的 Rollback 完成、最近存活行焦点、Unversioned 行引用。
- 症状：Rollback 后选中行虽然更新，但键盘焦点落到 Changes 树容器或 BODY；
  最近存活行位于折叠目录时，选中行不可见，方向键无法从该行继续。
- 根因：`CommitPanel` 的 `changeRowRefs` 使用原始 `group.id` 作为 key，
  Unversioned 行存成 `unversioned:<path>`，而选择模型统一使用
  `unstaged:<path>`，导致 `changeRowRefs.current.get(next.primary)` 查不到行；
  同时收敛逻辑没有先展开隐藏该行的 group/directory。
- 修复：行引用统一使用规范化 `changeKey`；Rollback 收敛后先通过
  `revealChangeRowRef` 展开 group/directory，再用 `focusSurfaceWhenReady`
  聚焦最近存活行，找不到行时回退到 Changes 树容器。
- 回归：`tests/commit-changes-rows-track-range-selection-separately-commit-checkboxes.test.mjs`。
- 真实 Web 验收：折叠 `.idea` 后回滚 `src/util.ts`，自动展开并聚焦
  `.idea/.gitignore`；删除最后一行 `src/new-feature.ts` 后聚焦
  `.idea/vcs.xml`；焦点不再落到 BODY。

## 2026-11-25：Rollback 后 Changes 最近存活行

- 作用域：Commit Changes 的 Rollback 完成、行选择收敛、UI bundle 导出。
- 症状：Rollback 对话框关闭后文件确实被回滚，但 Changes 列表没有任何选中行；
  删除最后一行时也无法落到最近的上一行。
- 根因：`editor-workspace.tsx` 新增的 `changeSelectionKey` /
  `reconcileChangeSelectionModel` 没有加入 `scripts/build-client.mjs` 的
  `uiExports`，运行时抛 `ReferenceError`，Rollback 后续收敛逻辑被中断；
  同时收敛函数在操作完成后才读取 DOM，已删除行无法作为“最近行”锚点。
- 修复：把共享选择模型导出到 UI bundle；Rollback 在 Host 写操作前捕获
  Changes 视觉顺序，并用对话框实际勾选结果生成 `staged:` / `unstaged:`
  身份；收敛逻辑改为纯模型 `reconcileChangeSelectionModel`，保留仍存活的多选，
  主行消失时选择最近的下一个存活行，末尾删除回退到最近的上一行。
- 回归：`tests/commit-change-nearest-row-after-removal.test.mjs`、
  `tests/commit-changes-rows-track-range-selection-separately-commit-checkboxes.test.mjs`、
  `tests/commit-rollback-confirmation-dialog.test.mjs`、
  `tests/commit-helpers-live-reusable-typescript-model.test.mjs`。
- 真实 Web 验收：删除中间 `README.md` 后选中下一行 `.idea/.gitignore`；
  删除最后一行 `src/new-feature.ts` 后选中上一行 `.idea/modules.xml`；
  无 `ReferenceError`，Rollback 实际写入 Host。

## 2026-11-25：Commit Log 分页恢复

- 作用域：Commit Log 持久化选择、分页加载、detail pane 恢复。
- 症状：持久化 commit 不在首屏 60 条时，列表没有该行，detail pane 空白；
  原逻辑只在 `logExhausted` 后清空选择，不会继续加载下一页。
- 根因：恢复 effect 只在已加载 `commits` 中查找，没有把“未找到”转换为分页请求。
- 修复：新增 `commit-log-selection-restore.ts` 纯决策模型与 hook；未找到时在
  10 页预算内自动 `loadMore`，加载中/失败等待，历史耗尽或预算用完才清空；
  找到后恢复 detail。选择存储继续由 `commit-log-view-preferences.ts` 管理。
- 回归：`tests/commit-log-selection-restore-pagination.test.mjs`、
  `tests/commit-log-selected-commit-persists-across-reload.test.mjs`。
- 真实 Web 验收：70-commit demo 持久化最老 commit `d5ee0a7`，首屏 60 条后
  自动加载到 70 条，选中行与 detail `commit 1` 均恢复；Changes → Log 后焦点
  进入 listbox。

## 2026-11-25：Commit Log reload 选择与键盘入口

- 作用域：Commit Log 的 reload 恢复、可见行选择、Log 面板键盘入口。
- 症状：reload 后 detail pane 恢复了 commit，但列表行 `aria-selected=false`、
  没有选中底色；从 Changes 切到 Log 后焦点仍停在 tab，方向键不能直接浏览 commit。
- 根因：`selectedCommit` 从 storage 恢复，但 `logSelectedCommits` 初始化为空；
  `CommitLog` 面板由 hidden 变为可见时没有主动把焦点交给 listbox。
- 修复：`logSelectedCommits` 从同一 storage 初始化；恢复的 commit 失效或仓库消失时
  一并清空；`hidden` 变为 false 时聚焦 Commit Log listbox。选择存储抽到
  `commit-log-view-preferences.ts`，避免 `editor-workspace.tsx` 继续膨胀。
- 回归：`tests/commit-log-selected-commit-persists-across-reload.test.mjs`、
  `tests/commit-log-visible-panel-focuses-list.test.mjs`。
- 真实 Web 验收：reload 后 `f311737` 行 `aria-selected=true` 且 detail 正常；
  Changes → Log 后焦点进入 listbox；Home 选中 `a63ebad` 并更新 detail。

## 2026-11-25：Diff 文件导航快捷键对齐 IDEA

- 作用域：Commit Diff 的 `Control+Shift+Left/Right`、文件导航提示、hunk 导航。
- 症状：普通 Commit Diff 中 `Control+Shift+Left/Right` 切换 hunk，但工具栏提示
  和 IDEA 实窗都把它用于切换文件；F7/Shift+F7 才是 hunk 导航。
- 根因：Diff key handler 只在 combined diff 且 `navigationPosition` 非空时走
  文件导航，普通 diff 落入 `walkHunk` 分支。
- 修复：只要 `navigationPosition` 非空，`Control+Shift+Left/Right` 统一调用
  Previous/Next file；没有文件序列的单文件比较保留 hunk fallback；
  F7/Shift+F7 继续负责 hunk。
- 回归：`tests/commit-normal-diff-surfaces-map-control-shift-arrows-idea-previous.test.mjs`。
- 真实 Web 验收：`app.ts` 3/10 经 `Control+Shift+Right` 到 `util.ts` 4/10，
  `Control+Shift+Left` 返回；F7 只移动 hunk 1/2 → 2/2；Escape 关闭 Diff 后
  焦点回到当前 `src/app.ts` Changes 行。

## 2026-11-25：Rollback 逐文件选择与键盘语义

- 作用域：Commit Changes 的 Rollback 确认、文件勾选、Show Diff 目标、键盘焦点。
- 症状：Rollback 对话框只能整体确认；行获得焦点后 Space 不切换勾选；行内
  checkbox 形成第二个 Tab 停点；点击 checkbox 不更新当前行，Show Diff 可能
  打开上一行的 diff。
- 根因：backdrop 的捕获阶段 keydown 处理器无条件 `stopPropagation()`，Space
  在到达行之前被截断；checkbox 仍保留默认 tab stop；checkbox click 只阻止冒泡，
  没有同步 `selectedIndex`。
- 修复：Rollback 行支持 Space/Spacebar 切换；checkbox 设为 `tabIndex=-1`，
  由行作为唯一 Tab 停点；checkbox click 同步当前行；Select all 使用真实
  checked/indeterminate；零选择时 Rollback 原生 disabled；Rollback 只提交
  `decision.entries` 中的路径。
- 回归：`tests/commit-rollback-confirmation-dialog.test.mjs`。
- 真实 Web 验收：Space 可勾选/取消；部分选择显示 indeterminate；全部取消后
  Rollback disabled；点击第二行 checkbox 后 Show Diff 打开 `Commit: util.ts`；
  实际 Rollback 只移除 `src/util.ts`，保留 `src/app.ts` 的 staged/unstaged
  改动；demo 文件已恢复。

## 2026-11-25：Commit 默认勾选策略

- 作用域：Commit Changes 首次加载、提交勾选、Commit Options。
- 症状：DSH 首次打开 Commit 时默认全选所有更改，IDEA 默认不勾选；提交范围和
  按钮计数因此与 IDEA 不一致。
- 根因：`loadGit` 首次状态加载无条件 `new Set(changes.map(...))`，没有用户偏好。
- 修复：新增 workspace 级 `dsh-editor.commit.selectAllByDefault:<root>` 偏好，
  默认关闭；Commit Options 提供 `Select all changes by default` 复选项。开启时
  立即选中当前更改，关闭时立即清空；零选择状态显示 `No files selected`。
- 回归：`tests/commit-default-selection-preference.test.mjs`。
- 真实 Web 验收：默认全部未勾选；开启后全部选中；刷新后偏好保持；关闭后恢复
  全部未勾选。

## 2026-11-25：Diff 专注布局

- 作用域：Commit Diff 工具栏、Editor 与 Chat 分栏、工具窗可见性。
- 症状：Chat 占 35%、工具窗占 25% 时，Diff 只剩约 311px，双栏每侧约 155px，
  代码对比体验明显弱于 IDEA。
- 根因：DSH 没有显式 Diff 专注模式；Chat 宽度由 controller 持有，工具窗可见性
  由 Editor 持有，Diff 自身无法临时释放这两块布局。
- 修复：新增 `components/editor/use-diff-focus-layout.ts`，保存进入前的
  chat/tool-window 状态；`Focus Diff` 临时收起 Chat 与工具窗，退出、关闭 Diff
  或用户手动重新打开任一表面时恢复原布局。持久化 Chat/工具窗宽度不被覆盖。
  Diff 工具栏新增真实 toggle action，文案为 `Focus Diff / Exit Focus Diff`。
- 回归：`tests/commit-diff-focus-layout.test.mjs`。
- 真实 Web 验收：Editor host `554px → 852px`，Diff `311px → 815px`，
  Chat `35% → 0%`，工具窗隐藏；退出后全部恢复；专注模式下关闭 Diff 也恢复。

## 2026-11-25：Commit Rollback 文件列表确认对话框

- 作用域：Commit Changes 的 Rollback 确认、Show Diff 交接、焦点恢复。
- 症状：Rollback 仍使用浏览器 `window.confirm`，只显示文件数量；用户看不到
  待回滚文件、分组和 diff，也无法在确认前检查具体改动。
- 根因：Rollback 是早期直接调用原生 confirm 的路径，没有接入共享 modal /
  focus-trap / diff 交接模型。
- 修复：新增 `components/commit/rollback-confirmation.ts`，提供 IDEA 风格
  `alertdialog`：文件 listbox、Staged / Working tree / Unversioned 分组、
  Show Diff、Cancel 初始焦点、Tab 闭环、Escape 取消和 opener 焦点恢复。
  Show Diff 关闭确认框并返回目标，由 Editor 打开普通 diff；Rollback 才执行
  Host 写操作。`editor-workspace.tsx` 不再对 Rollback 使用 `window.confirm`。
- 回归：`tests/commit-rollback-confirmation-dialog.test.mjs`，以及既有
  staged / working / unversioned rollback 测试。
- 真实 Web 验收：Cancel 初始聚焦；Escape 关闭后焦点回到 Rollback 按钮；
  Show Diff 关闭对话框并打开 `Commit: app.ts`；Rollback 只移除工作区改动，
  保留 staged 改动。

## 2026-11-25：Diff 工具栏状态语义与 macOS 搜索快路径

- 作用域：Commit Diff 工具栏、Undo/Redo 历史、未修改区域折叠、差异摘要、
  Host 正文候选 grep 快路径、Editor 焦点辅助函数。
- 症状：空历史时 Undo/Redo 仍可点击；未修改区域折叠时
  `Show unchanged regions` 反而显示勾选；单个差异显示 `1 differences`；
  macOS BSD grep 下正文候选快路径返回空结果；`editor-workspace.tsx` 超过模块
  行数守卫。
- 根因：跨 Diff 标签的 undo/redo 只存在 ref 中，ref 变更不会触发工具栏重渲染；
  折叠动作把“要执行的动作文案”和“当前勾选状态”混在同一个 `active` 上；差异
  摘要只有复数文案；grep 解析依赖 GNU 的 `-Z` NUL 分隔；焦点辅助函数长期留在
  工作区单体文件中。
- 修复：用 `historyDepth` 镜像 undo/redo 栈深度并在每次 push/pop 后同步；
  `Show unchanged regions` 使用稳定文案，`active = !collapseUnchanged`；新增
  单数差异 locale key；grep 改为可移植的 `path:line:text` 输出，并按已知绝对
  路径前缀解析；把 `focusEditorOnNextFrame` / `focusWorkspaceFallback` 抽到
  `components/ui/focus-surface.ts`。
- 回归：`tests/commit-diff-toolbar-history-and-unchanged-state.test.mjs`、
  `tests/search-text-grep-candidate-fast-path.test.mjs`、Terminal 元数据测试桩、
  模块行数守卫。真实 Web 验收确认空历史时 Undo/Redo 为原生 disabled，
  折叠时 `Show unchanged regions` 未勾选，单差异显示 `1 difference`；执行一次
  块还原后 Undo 可用、Redo 禁用。

## 2026-11-22：Search Everywhere 分栏与文本命中定位

- 作用域：Search Everywhere 结果列表、预览面板、`EditorSplitDivider`、文本搜索
  结果激活与 Monaco reveal。
- 症状：列表/预览比例不可调整；单击文本命中后只显示文件，未稳定定位到命中
  行列，甚至停在文件头部。
- 根因：上下区域原先没有独立分隔条；文本结果缺少命中长度，激活链路只传单点；
  model 绑定 effect 与首帧 reveal 竞争，并会丢弃待恢复的范围。
- 修复：共享分隔条支持水平方向并按 Y 轴计算，比例写入 workspace UI 偏好；
  Host 文本命中携带 `matchLength`，客户端对旧响应回退计算；Monaco 使用
  `column + matchLength` 建立选区；打开文件后等待 model 绑定并重试，绑定 effect
  透传 `endLine/endColumn`，最终 `revealLineInCenter`。
- 回归：`tests/search-everywhere-preview-split-and-match-highlight.test.mjs`，
  以及共享分隔条、导航历史和预览定位测试。真实 LAN 验收覆盖拖动后重开恢复，
  以及精确行列、关键词选区和居中显示。

## 2026-11-22：大文件预览与索引重进

- 作用域：Search Everywhere / Find 预览、Project 自动索引更新、workspace watcher。
- 症状：超过 4 MiB 的文件无法预览；拖动分栏会切换命中；每次重新进入 Editor
  都重新显示索引进度。
- 根因：预览错误复用编辑器整文件 `read`；拖动中的行 hover 仍更新 active row；
  客户端自动索引 hook 不读取 Host 验证状态，watcher 释放又会立即撤销索引
  freshness，造成重新进入后的重复扫描。
- 修复：新增流式 `readPreview`（目标行前后各 200 行）；拖动期间冻结结果 hover；
  自动更新只在 Host 快照不完整时启动；SSE 释放 watcher 后保留 30 分钟粘滞期，
  期间文件事件仍会 invalidate，重新进入则复用连续 watcher 证明。
- 回归：`tests/search-preview-large-file-window.test.mjs`、
  `tests/project-search-index-auto-progress.test.mjs`，以及 Search/Find 预览取消、
  窗口和 memo 测试。

## 2026-11-22：All 页负预览回退与 Find 浮动分栏

- 作用域：Search Everywhere All 页正文 provider、floating Find 弹窗布局。
- 症状：All 页对 `registerDataSetObserver` 返回“没有匹配（结果不完整）”，
  Find 弹窗能看到结果；Find 弹窗上下列表/预览不能拖动。
- 根因：All 页 Git 快速预览在零候选时直接返回不完整空结果，没有回退完整扫描；
  Find 分隔条只在 dock 模式渲染，floating 结果区和预览区又使用 auto/固定 flex，
  且误用了 120 px 宽度下限，使可拖动范围接近无效。
- 修复：Git 快速预览只接受正命中，零候选回退完整 workspace 搜索；floating Find
  改用水平分隔条和零基 flex 比例，并以 60 px 高度下限计算可拖动范围。
- 回归：`tests/search-git-index-partial-text-fast-path.test.mjs`、
  `tests/search-find-floating-preview-split.test.mjs`。

## 1. 项目定位

- DSH 的 Chat 是宿主能力；Editor 是嵌入的分栏工作台，不替换 Chat。
- 对标 IDEA 的范围是 Project、Commit、Terminal、Editor、Find/Search/Replace。
- DSH 没有数据源的功能不做空壳；状态、菜单和可访问名称必须真实。
- 当前阶段冻结新功能，优先缺陷、性能、可访问性和 UI 对齐。

## 2. 源码与构建边界

- 修改 `src/client`，不要手改 `lib/client.js`。
- 浏览器源码使用 TS/TSX；React 组件用 `.tsx`，纯模型用 `.ts`。
- DSH 最终只加载一个 `lib/client.js`；manifest 模块和 TSX module graph 都由
  `scripts/build-client.mjs` 合成。
- 自定义 client build 不支持 namespace import；浏览器共享能力使用显式符号或
  单对象导出。
- 不用显式 `any`、`@ts-ignore`、`eslint-disable` 绕过诊断。
- 共享客户端配置来自 `tsconfig.client.json`；Monaco worker 不传显式 `lib`，
  使用 `target: ESNext` 默认库，先加载 `editor.main` 再加载 `tsMode`。
- Monaco cancellation 只消费明确来自 Monaco 的 `Canceled`，其他异常继续上报。

## 3. 单一职责与复用

- 共享容器唯一拥有通用交互：floating popup、menu、focus trap、toolbar、
  FileTreeView、resize handle、主题 token、viewport clamp。
- 业务组件只拥有查询、结果、选择、焦点和数据语义。
- 菜单、快捷键、disabled 条件、selection transition、sizing 和持久化优先抽成纯
  模型或共享组件。
- 修缺陷先查共享根因；不要在多个调用方复制相同逻辑。
- 新组件必须能独立解释自己的输入、输出、焦点所有权和持久化边界。

## 4. 交互与可访问性

- 焦点必须可见、可预测、可恢复。菜单/弹层关闭后回到真实 opener；opener 已
  卸载时回到编辑器、当前工具窗或稳定 fallback，不允许落到 `BODY`。
- button / tab / tree / listbox / menu / checkbox 使用真实语义；
  `aria-pressed`、`aria-expanded`、`aria-activedescendant` 不得互相冒充。
- 键盘导航跳过 disabled 项；首尾循环、Home/End、ContextMenu、Shift+F10 的行为
  必须和可见动作一致。
- 长任务必须可取消。关闭 Search Everywhere、Find、Quick Open、Show Usages 或
  切换 workspace 后，旧 generation、debounce timer 和 AbortController 一起失效。
- 不得用客户端 abort 冒充服务端回滚。无法回滚的 destructive 操作不显示 Cancel。
- 错误和截断文案必须保守：“至少 N 个”、结果不完整、失败原因要区分，不能把
  截断结果说成全局无匹配。
- 代码 token 共享 400–500 字重；IDEA Light 不用 bold token。

## 5. 布局与视觉规范

- Editor 外层约 65% / Chat 35%；Chat 宽度限制在 28%–44% 并持久化。
- Project tree 约 25%，Monaco 约 75%；工具窗保存宽度且保留 200px 像素下限。
- Project、Changes、Log 使用统一细滚动条、hover/selection 层级和 Shift+Wheel
  横向滚动。
- Project tree 使用编辑器护眼底色；Monaco gutter 保持独立灰面；Commit 使用冷灰
  工具窗底色。
- 标题/工具/筛选/计数尽量压在一行；长标题可省略，关闭按钮和关键动作不得消失。
- 编辑器行号紧凑，gutter 最小宽度、装饰区和折叠箭头尺寸保持一致。

## 6. Project

- Project 是唯一真实磁盘树；`Open Files` / `All Changed Files` 是过滤投影，
  不得发起全项目 tree 操作。
- 文件树只排除 `.git`；隐藏文件默认显示；重目录只在快速打开/遍历时跳过。
- 普通点击不自动跟随编辑器活动文件。展开、选中和滚动只在显式
  Select Opened File / Reveal 时改变。
- 多选以 primary + selection set + anchor 表达；普通点击替换选择，Cmd/Ctrl
  切换单项，Shift 扩选。行选择与 Commit checkbox 独立。
- 目录折叠时隐藏后代选择必须被裁剪；选中项消失后落到最近可用的可见行。
- search exclusion 状态向文件后代继承；显式 include 的后代恢复正常，父目录可
  保持“部分子目录仍包含”的状态。
- symlink 按目标文件和目录参与 Project / Search / Replace；断链隐藏，循环不遍历，
  替换写目标并保留 link。
- Project selection 按 workspace root 持久化；失效路径恢复为空，不制造幽灵选择。
- View 切换后过滤无效选择，`Select Opened File` 只有在目标确实属于当前过滤视图时
  才留在该视图，否则回到最近的真实树视图。

## 7. 搜索与替换

- 三个用户面分工必须保持：
  - Search Everywhere：跨 provider 的快速搜索入口。
  - Find in Files：持久结果窗口、多 tab、preview、replace。
  - Quick Open：本地文件导航。
- 文件枚举、正文搜索、preview 读取和 replace 都拥有独立 request identity /
  AbortSignal；关闭用户面后不得继续后台工作。
- 搜索预算必须先应用 scope、Git ignore、file mask 和硬排除，再计入文件/字节预算。
  “达到上限”与“全局穷尽”必须区分。
- dirty buffer 优先于磁盘内容；preview、Find、Replace 和搜索索引都不得展示
  已被 live editor 修改掩盖的旧内容。
- Replace 必须快照预检 dirty models 和 clean targets。确认后若文件、模型、
  workspace 或 generation 变化，必须整体中止或明确 partial-success。
- 单处 Replace 和 Replace All 共用同步写入守卫；取消、失败、成功都释放守卫。
- Undo/Redo Last Replace 要保留 clean Host 事务和 dirty snapshot；part-success
  场景反映真实已提交状态。

### 持久索引

- 索引位置：`DSH_HOME/indexes/dsh-editor/<workspace-sha256>.json.gz`；正文索引
  旁的 `<workspace-sha256>.paths.json.gz` 是路径投影 sidecar，正文与路径分账。
- 正文索引是 NDJSON + gzip，路径 sidecar 是紧凑 NUL 分隔路径流 + gzip；特殊
  文件名不得经对象原型键丢失。文件名/路径查询只读 sidecar，不得为路径命中解码
  128 MiB 正文缓存。正文搜索可以合并 sidecar 路径与被验证的正文缓存。
- 同一 workspace 的索引读取按 key 单飞；Search Everywhere 的文件查询与正文查询
  并发时只能解码一次，不能重复争用 CPU 与内存。
- 缓存优先；miss / invalid / 不完整时才实时搜索，并在可取消生命周期内回写。
- Scope、Git ignore、file identity、symlink target、mtime/size 变化都必须失效。
- Project 打开后先等待 workspace watcher 就绪，再执行一次增量索引更新；已有
  索引只重读变化/新增文件，未变化正文直接复用，禁止每次打开都全量重读。
- 默认索引范围与搜索排除共用同一路径过滤：`.git` / `.hg` / `.svn`、Git 元数据
  文件（`.gitignore`、`.gitattributes`、`.gitmodules` 等）、Git ignore 路径、
  重目录和系统生成文件默认不进入索引；Project 树仍可显示与打开它们。
- 首次重建没有可用快照时搜索降级为实时扫描；已有完整索引的增量更新允许继续
  使用持久快照。新进程尚未完成正文校验时，正文搜索先使用持久内容并明确标记为
  incomplete，后台更新完成后再进入已验证快路径。Project 顶部进度条只展示 Host
  真实 files/bytes，未知总量不伪造百分比。
- workspace watcher 必须把任意路径段中的 `.git` 识别为 Git 元数据；嵌套仓库 /
  submodule 的 `index.lock` churn 不得撤销搜索索引新鲜度，否则真实大仓库会持续
  被降级。回归：`tests/search-index-text-provider-watcher-freshness.test.mjs`。
- 目录遍历确实被系统资源或调用方预算截断时，必须保存受限索引并报告
  `pathScanComplete=false`；不能把截断快照当成完整索引，也不能因为正文缓存
  预算耗尽就重复全量重建。
- 文件路径索引不设 50,000 文件数硬上限；`pathTruncated` 与
  `contentTruncated` 必须分开。正文缓存 128 MiB 预算耗尽只产生 path-only 条目，
  后续正文查询按需读取，不能因此把完整路径索引报告成文件列表截断。
- 浏览器初始文件候选响应可以有传输上限，但 Host 必须返回 `scopeComplete`：
  完整索引上的 typed query 通过索引继续搜索全部路径，UI 不得显示“项目文件缺失”。
- 文件名查询不得先把 `.paths.json.gz` 展开成数十万个对象后再过滤。Interactive
  query 直接在已解码的 NUL 分隔路径流上做转义后的 Unicode 正则扫描，只提取命中
  记录；宽泛查询用 max-heap 只保留最优的 `maxMatches + 2 * statBatch` 条，避免
  对几十万命中执行全量 `localeCompare` 排序。回归：
  `tests/search-index-path-query-stream-fast-path.test.mjs`。
- 正文查询缓存只能绑定 active watcher、browser search session、search revision
  和 index generation；命中时返回同一完整快照，watcher 失效或 Host 写入后必须
  重新扫描。零命中查询不进入缓存，避免把一次 bounded/incomplete 扫描误当永久结论。
- Search Everywhere 的 All 页只渲染 24 个文件行和 40 个正文行，Host 请求必须
  使用同一可见预算，不能继续扫描到 200 条再丢弃 160 条。Text 页仍使用 200
  条正文预算；切换页签时按新预算重新请求。回归：
  `tests/search-everywhere-all-text-budget-matches-visible-cap.test.mjs`。
- Search Everywhere 的 typed file query 一旦返回完整路径索引命中，必须立即写入
  当前 `includeNonProject` scope；不得等待较慢的基础文件列表建立 scope。否则
  项目刚打开时索引命中会被 `searchEverywhereFilesForScope` 过滤，表现成只有
  正文命中或完全无结果。回归：
  `tests/search-everywhere-file-candidates-preserve-truncation.test.mjs`。
- Search Everywhere 的 query 每次变化必须立即清空上一轮 `textMatches`、
  `textTruncated` 与 text-owned error，并在查询长度达到 2 时进入 loading；
  不得在新 query 的 180 ms debounce 窗口继续展示旧正文行。files-owned error
  属于另一 provider，必须保留。回归：
  `tests/search-everywhere-query-transition-clears-stale-provider-state.test.mjs`。
- Find 的“文件”scope 是路径搜索，不得只对初始最多 2,000 个文件候选做本地
  fuzzy 过滤；必须把 query、File Mask、Scope 和 Git ignore 一起发给 Host 的
  持久路径索引，再在返回候选上执行大小写/整词模糊过滤。否则索引中第 2,001
  个之后的真实文件名会永久不可达。回归：
  `tests/search-find-file-scope-mask-filters-before-cap.test.mjs`。
- Find 与 Search Everywhere 的文件结果必须共用 `SearchFileResultItem`：
  主标题是 `basename(path)`，右侧次要信息是 `dirname(path)`。文件列表、
  Project/Directory/Scope 的文件组头、浮窗 file/text 结果都不得再把完整路径
  当主标题，也不得把文件名放到右侧。回归：
  `tests/search-find-file-result-name-first-path-second.test.mjs`。
- 持久路径 sidecar 即使 `complete=false`，只要 workspace watcher、scope
  signature 与 epoch 有效，仍应参与 typed filename query，返回已存在的部分命中
  并标记 `truncated=true`。不得退回 50,000 目录项实时遍历后把可达路径错误报告
  为零；未完整快照只限制完整性声明，不限制已有候选的可用性。回归：
  `tests/search-index-incomplete-path-query-remains-useful.test.mjs`。
- 正文索引与路径 sidecar 是原子替换的独立文件。增量更新在 `unchanged` 时必须
  校验路径 sidecar 的轻量 JSON header（updatedAt、complete、directoriesComplete、
  contentScanVerified、scope、truncation 等）与正文索引一致，不能只检查 sidecar
  是否存在；否则正文已完整而状态会永久显示 `pathScanComplete=false`。仅 header
  漂移时从内存正文索引重写路径投影，不重新读取工作区正文。真实 Zygisksdk 修复后
  状态为 434,220 文件 / 133,157 目录且 `pathScanComplete=true`。回归：
  `tests/search-index-path-sidecar-header-repair.test.mjs`。
- 文件名/路径排序热路径必须复用创建的 `Intl.Collator`，不能在每次比较时调用
  `String.localeCompare`。ZygiskSdk 38.5 万次比较实测从约 1 s 降到约 18 ms；
  同时路径匹配应流式进入有界 Top-N，不得先构造数十万个中间命中对象。回归：
  `tests/search-index-path-query-stream-fast-path.test.mjs`。
- typed path query 的正结果可以进入有界内存 LRU；键必须绑定 path sidecar
  identity、query-view epoch、scan invalidation revision、index generation、
  path index dirtyRevision 与 scope。Host 删除测试必须让缓存立即 miss。
  未完整快照的 file-list provider 只返回文件，可复用已有 file 记录并标记
  `truncated=true`，不必等待目录流完整。回归：
  `tests/search-index-path-query-stream-fast-path.test.mjs`。
- All-tab Git 正命中预览可以有界缓存为内存结果，并绑定 content/scan revision
  与 generation；仍必须返回 `truncated=true`，不得写入持久完整结果缓存。
  零结果不缓存。回归：
  `tests/search-git-index-partial-text-fast-path.test.mjs`。
- All-tab Git 快路径的 exit code 1 是“无匹配”，不是命令失败；必须快速返回
  `matches=[] / truncated=true / fastPartialTextSearchNegative=true`，不得回退
  到 43 万路径的完整扫描。Git 不搜索 symlink 目标，所以该空结果只属于不完整
  preview；Text 页仍必须执行完整扫描并找到符号链接目标内容。回归同上。
- 索引状态轮询的文件/目录计数按索引对象 `dirtyRevision` 缓存，路径 mutation
  必须推进 revision；禁止每次 status 请求对 46 万键重新 `Object.keys`。
- 批量目录遍历已经把 `realpath` identity 交给 `listDirectory`，不得对同一目录
  再次 `stat + realpath`。ZygiskSdk 43.4 万文件 / 13.3 万目录纯枚举约 9.2 s，
  冷启动完整索引校验约 15.9 s；此前约 23.6 s。
- All 页可先使用 Git 工作树/未跟踪索引做有界正文预览：`git grep -l` 只负责
  找出正命中文件，Host 再读取这些文件生成真实行列与预览。只要得到正结果即可
  返回，但必须 `truncated=true` 并标记 `fastPartialTextSearch=true`，不得写入
  持久查询缓存；Git 未命中、非 Git workspace、存在 dirty buffer、正则、整词、
  Directory/Scope/Mask 等复杂条件时回退完整扫描。回归：
  `tests/search-git-index-partial-text-fast-path.test.mjs`。
- 正文正结果还会持久化到 `<workspace-sha256>.queries.v8.gz`。持久键只包含
  完整查询与搜索选项，不能包含浏览器 `searchSessionId` / `searchRevision`；
  读取门槛是 watcher 已验证、路径与正文快照均未更新且项目打开增量更新已结束。
  文件指纹同时绑定正文 `updatedAt/files/contentBytes/scopeSignature` 和路径
  sidecar 的 `updatedAt/complete`，原子写入、权限 `0600`，零结果不落盘，
  watcher、Host 写入、rebuild 或 clear 都必须使旧缓存失效。回归：
  `tests/search-text-query-cache-persists-across-processes.test.mjs`。
- 查询缓存 v2 还保存正文/路径 sidecar 的 `mtimeMs/size/dev/ino` snapshot。
  项目打开增量验证完成后才 arm 该 snapshot；跨进程命中时只 `stat` 两个 sidecar
  并读取小型 `.queries.v8.gz`，不得为了验证缓存再解码 200+ MiB 正文 V8 或
  60 MiB 路径流。watcher、Host 写入、rebuild、clear、索引更新开始和 snapshot
  变化都必须同步 disarm。ZygiskSdk 实测跨重启命中由约 2 s 降到约 6 ms。
- 正文遍历与索引正文预算跳过已知图片、压缩包、音视频、字体、编译产物和数据库
  扩展名；文件名搜索仍保留这些路径。未知扩展名不得被启发式排除。
- 已索引项目的 ASCII 字面正文搜索可以在候选路径上启动有界 GNU grep 并行
  候选发现：候选必须已经应用 Scope、Git ignore、file mask、系统生成文件与
  二进制扩展过滤；grep 只输出文件/行号/行文本，最终列号、preview 和结果上限
  仍由 Host 的 JS 匹配器生成。达到 `maxMatches` 后立即终止全部 grep 子进程；
  正则、整词、有限 `maxBytes`、dirty buffer 或 grep 异常时回退完整扫描。
  ZygiskSdk 未缓存 `Application.java` Text 查询实测约 25 s 降至约 3.9 s。
  回归：`tests/search-text-grep-candidate-fast-path.test.mjs`。
- trigram sketch 跳过同时属于“跳过 stat”的优化，`skippedStats` 必须计入该
  路径；`sketchesSkipped` 只补充跳过原因，不能出现总跳过数小于 cached-hit 数
  的矛盾状态。回归：
  `tests/search-index-text-provider-watcher-freshness.test.mjs`。
- 正文搜索默认不设 64 MiB 单请求总读取预算，也不使用旧的 2,000 文件实时候选
  上限；已知路径与 live 发现路径都必须进入同一无上限候选集合。
- 正文搜索默认不因单文件超过 1 MiB 而跳过文本；
  显式 `maxBytes` 仍可用于测试或调用方限定。大文件只探测前缀排除二进制，文本文件
  按需读取搜索但不进入 128 MiB 热缓存。匹配数仍是 UI 上限，达到后使用“至少 N 个
  结果”语义，不得冒充文件路径不完整。回归：
  `tests/search-text-has-no-default-aggregate-byte-cap.test.mjs`。
- 索引写入按 workspace 串行；generation + dirtyRevision 阻止 stale write。
- rebuild / clear 期间 suspend 新写入；最终状态只能是完整快照或明确清理。
- rebuild 保留 Project search scope；clear 删除索引和崩溃遗留临时文件。
- 后台 status 不得把 “rebuild 中” 或旧索引伪装成完整新索引。
- Clear 是删除文件，客户端 abort 无法回滚已提交删除；UI 不提供虚假 Cancel。
- Search Everywhere 的 “Open in Find Tool Window” 只转移 query/options，并从
  空结果集启动一次新 Find 搜索；不得把 transient 结果数组直接塞入 dock 造成
  handoff/render 竞争。回归：
  `tests/search-everywhere-open-find-refresh-avoids-stale-handoff.test.mjs`。
- ZygiskSdk 实测优化前文件名冷查询约 2.1 s、heap +190 MiB；改为路径流扫描后
  约 0.20 s、heap 约 63 MiB。初始 2,000 文件列表由约 2 s 降到约 0.18 s。
  同一正文查询首次仍需读取未缓存文本，重复查询在 watcher-protected 页面内命中
  query cache 后接近 0 ms；缓存不得用于证明首次扫描完整。
- 增量更新仍需遍历目录并 stat 每个已知文件以发现外部修改。ZygiskSdk 当前
  434,220 文件在 `/mnt/fs` 上约 19.5～30.5 s；无变化时 `reusedFiles=434220`，
  `changedFiles=0` 且 `updatedAt` 不变，不得误报为正文全量重建。
- 不要用 SQLite FTS5 `trigram` 直接保存 ZygiskSdk 全量正文：包含 symlink/ROM
  重复路径时约 6.7 GiB 文本在未完成构建时已产生 12 GiB 主库与 WAL，单个文件
  仍可能继续增长。该方案已实测否决并清理。正文候选索引必须采用紧凑 sketch、
  token/gram 后置表或按唯一 inode 去重的方案，不能复制完整正文。

## 8. Commit 与 Git

- Commit 工具窗只有 Changes / Log 两个模式，模式、activity 和选中 commit 可恢复。
- Author filter 和 Graph branch/at scope 按 Project root 持久化；Graph mode 仍按需
  打开，但下次 Graph 使用上次 scope。
- Commit Log 的 selection、`aria-activedescendant`、detail pane 必须指向同一
  commit；失效 hash 自动清空。
- Log 首屏、分页、author reload、File History 和 Graph 共用 request lifecycle；
  stale response 不得覆盖新 scope。
- Project 文件控制权和 Git 状态由 Host 维护；浏览器不能凭 tree 猜测 Git 语义。
- Commit / Update / Fetch / Push / Stage / Restore / Patch / Stash / Shelve 等写操作
  必须共享 working-tree / network single-flight 和 repository-disappearance 清理。
- destructive Git 动作必须确认；非 Git workspace 中 Git-only actions 保持可见但
  有真实 disabled 原因。
- Diff 分为本地 staged/unstaged、提交 revision、普通 revision、clipboard 和
  combined diff。只读侧不能出现可写 restore/undo affordance。
- Diff 工具栏优先 IDEA 顺序；窄宽度只收起动作，不挤压标题或丢失关闭能力。

## 9. Terminal

- PTY 属于 Host；任何 Dock/Editor 移动都只是第二个 view，不得 create 新 shell。
- Terminal Dock 和 Editor Terminal 共享 terminal id、title、cwd 和颜色；两处不得
  同时渲染同一 PTY。
- Move to Editor 的 placement 和 active tab 可恢复；Host 关闭的 PTY 必须从 placement
  中剪除。
- Return to dock 必须跨 TerminalPanel unmount 保留 pending activation，并在 Host
  确认 live id 后激活；同时带回最新 title/cwd。
- Host list 刷新必须合并本地 OSC title/cwd metadata，不得把用户当前目录重置为
  PTY 启动目录。
- Dock 的 Close Other Terminals 只关闭 Dock 其他 tab；Move to Editor 的 PTY 不受影响。
- 关闭/移动 active dock terminal 时优先选择其他可见 Dock tab，不选中已移入 Editor
  的 terminal，也不误收无关 split。
- Terminal focus 是 round-trip：打开 Dock、切换 Activity、打开 Diff 或返回 Editor
  必须回到进入前仍有效的 surface。
- profile 恢复最多 4 个 tab，保留 shell/cwd；Host 重启不等于用户主动关闭全部 tab，
  不得提前清空 profile。

## 10. Editor 与持久化

- Editor session 保存 clean tabs、active tab、split tabs、split path 和 split percent；
  dirty buffer 不跨 reload 假装恢复。
- Project / Commit activity、Commit mode、selected commit、Project selection 等
  workspace UI 状态必须校验后恢复。
- 通用 scope 规则：
  - workspace 级：Project root。
  - session/terminal scope：`currentTerminalScope()`。
  - browser-wide：字体、diff 显示选项等真正跨 workspace 的偏好。
- Web 中 `workspaceId` 可能为空；不要把空 scope 当成“持久化已关闭”。
- storage 值必须归一化；损坏 JSON、失效 path、失效 PTY/hash 回退安全默认。
- 相同值不重复写 localStorage，避免轮询/渲染造成写抖动。
- 诊断日志只记录低频技术错误和脱敏 action ring；不记录聊天正文、文件内容或密钥。

## 11. 异步与并发

- 每个长请求都有 AbortController；每个状态写入都有 generation/request id。
- timer、controller、generation 和 “operation owned” 状态一起失效。
- `Promise.all` 批量操作必须限制并发，不能按文件数无限打满。
- stale success、stale failure、workspace switch、unmount 和 supersede 都必须有
  明确测试。
- 单个 busy boolean 不足以表达并发；共享 busy 使用 operation count 或 claim。
- 用户关闭 surface 后不等待下一条 React render 才取消后台工作。

## 12. Build、Test 与 Package

- 编辑后运行：

```bash
node scripts/build-client.mjs
npm run lint:client-types
npm run check:client-build
npm run check:format:client-components
npm test
npm pack --dry-run
git diff --check
node --check lib/index.js
node --check lib/client.js
```

- 测试文件命名：`<module>-<feature>.test.mjs`，不使用 `roundNN`、日期或批次号。
- 业务测试执行真实函数/行为；源码正则只用于 wiring/构建形状，不代替行为断言。
- 构建一致性测试只能验证生成产物、模块顺序和打包形状，不能反过来证明源码逻辑。
- Prettier 要求 JSX 属性逐行展开；新增长 JSX 不要压缩成难审查的单行。
- npm package 只应包含运行所需源码、生成物、locale、README 和构建脚本。
- 搜索索引测试在 full suite 调度压力下不能依赖单次状态读取：grep 候选快路径重试
  时必须重建索引以清掉 fallback query cache；sidecar header repair 测试应等待
  `pathScanComplete`、`directoryScanComplete`、`contentScanVerified` 三态成立。

## 13. 运行态验证

- 不重启用户当前 `3081` Host。
- 创建独立 `DSH_HOME` 和最小 Web profile，`node_modules/dsh-editor` 使用
  `link:` 指向当前工作区。
- 使用 3099 端口；Host/Client 构建变化后重启隔离 Host，再刷新页面。
- ego-browser 复查使用足够宽视口；两侧栏收起后不要为了截图再次扩大聊天气泡。
- 验证真实 UI 操作、localStorage、Host API、索引文件、PTY 或网络 signal，
  不能只看源码。
- 完成后停止 Host、关闭浏览器任务、删除临时 `DSH_HOME`。

## 14. 已知环境问题

- 3081 Host 是独立进程；插件源码重建不会自动更新已有 Host。
- `manifest.webmanifest 401` 与 `dsh-rea duplicate factory` 通常表示旧 Host /
  重复 bundle load；先确认 Host 重启和单一 client bundle。
- 旧 Host 不认识新索引 operation 时显示重启指引，不展示原始 unknown operation。
- Monaco worker 被代理或 CSP 拦截时 TypeScript 语言服务不可用，但纯文本编辑仍应工作。
- Terminal 依赖 Host subprocess provider；provider 缺失时显示本地化提示和 Refresh。
- 文本预览限制 4 MiB；Project 上传按 10 MiB 分片，单片大小不等于文本预览上限。

## 15. 修改检查表

1. 职责是否落在正确 owner？
2. 是否复用了共享容器/模型，而不是复制第二套实现？
3. 键盘、焦点、菜单语义、ARIA 和 disabled reason 是否真实？
4. 关闭/切换/卸载后是否还有后台请求或 stale write？
5. 持久化 scope 是否正确，失效数据是否能安全回退？
6. 是否有 RED/GREEN 行为回归？
7. 运行态是否覆盖用户实际路径，而不只是构造单测？
8. 构建、lint、format、test、package、diff、syntax 是否全部通过？
