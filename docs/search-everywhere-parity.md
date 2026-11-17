# Search Everywhere / Find / Replace parity

## 证据

- IDEA 2026.2
  `/Applications/Intellij.app/Contents/lib/intellij.platform.ide.impl.jar`
  `messages/ActionsBundle.properties`
- 中文语言包
  `/Applications/Intellij.app/Contents/plugins/localization-zh/lib/localization-zh.jar`
- keymaps:
  - `$default.xml`
  - `Mac OS X 10.5+.xml`
  - `macOS System Shortcuts.xml`

## 可见 Action

| IDEA action id | DSH action id | 状态 | 执行路径 / 边界 |
|---|---|---|---|
| Find | find | 已实现 | 打开当前 Monaco Find |
| Replace | replace | 已实现 | 打开当前 Monaco Replace |
| FindNext | findNext | 已实现 | `editorFindStepRef` |
| FindPrevious | findPrevious | 已实现 | `editorFindStepRef` |
| FindWordAtCaret | findNextWordOccurrence | 已实现 | Monaco next selection match |
| FindPrevWordAtCaret | findPreviousWordOccurrence | 已实现 | Monaco previous selection match |
| ToggleFindInSelection | searchInSelectionOnly | 已实现 | 编辑器 Find selection scope |
| IncrementalSearch | incrementalSearch | 已实现 | 编辑器 Find |
| FindUsages | findUsages | 已实现 | workspace Find |
| ShowSettingsAndFindUsages | findUsagesSettings | disabled | DSH 文本搜索没有 language-aware scope；保留 IDEA 入口并说明原因 |
| FindUsagesInFile | findUsagesInFile | 已实现 | 当前编辑器 Find |
| FindInPath | findInFiles | 已实现 | IDEA 风格 Find in Files 浮层 |
| ReplaceInPath | replaceInFiles | 已实现 | 持久 Replace tool |
| SearchEverywhere | searchEverywhere | 已实现 | 现有 Search Everywhere opener |
| ShowSearchHistory | showSearchHistory | 已实现 | 弹框级 `Alt+ArrowDown` |
| UsageView.ShowRecentFindUsages | recentFindUsages | 已实现 | workspace Find Usages history |
| Vcs.Diff.ToggleSearchInChanges | searchInChanges | 已实现 | Diff Monaco `actions.find` |
| StructuralSearchPlugin.StructuralSearchAction | structuralSearch | disabled | Monaco 没有 language AST |
| StructuralSearchPlugin.StructuralReplaceAction | structuralReplace | disabled | Monaco 没有 language AST |
| ActivateFindToolWindow | findToolWindow | 已实现 | 底部持久 Find 工具窗；不宣称 `Alt+3`，该键在 DSH 用于 Commit |
| FindSelectionInPath | findSelectionInFiles | 已实现 | selection/caret → workspace Find |
| TextSearchAction | textSearch | 已实现 | Search Everywhere Text provider |

## 内部 Search Everywhere 行为

以下 IDEA Action 是弹框内部导航，不伪造为独立 Actions 行：

- `SearchEverywhere.NextTab`
- `SearchEverywhere.PrevTab`
- `SearchEverywhere.CompleteCommand`
- `SearchEverywhere.SelectItem`
- `SearchEverywhere.NavigateToNextGroup`
- `SearchEverywhere.NavigateToPrevGroup`
- `ShowSearchEverywhereItemInfo`

对应 DSH 行为：

- Tab/Group 导航复用 `searchEverywhereGroupNavigationDirection()`；
- `SearchEverywhere.CompleteCommand` 不再暴露输入级 provider 补全；
  scope 只由基础 tab 切换；
- 选择结果复用 `activateResult()`；
- Item Info 复用 `searchEverywhereItemInfo()`。

## Actions 过滤语义

- Action label 允许 IDEA 风格的模糊子序列匹配，用于 `rif` 等缩写；
- description 与 keywords 先转小写并按非字母数字分段，query 的每个词必须是
  某个目标词的连续前缀；不做跨词散字母模糊匹配；
- label 命中始终排在 description/keywords 命中之前；
- `FindNext`、`FindPrevious`、`FindInPath`、`ReplaceInPath` 使用 IDEA
  ActionsBundle 英文/中文原文 description；
- `/replace` 运行态只保留 Replace、Replace in Files、Replace Structurally、
  Replace in Selection Only、Replace Selection in Files、Find Next、
  Find Previous，不再混入 Incremental Search、Previous Occurrence、
  Find Usages 等散字母噪声；
- 替换输入只接受无修饰 `Enter` 或 `Meta/Ctrl+Enter`；
  `Shift+Enter`、`Alt+Enter` 与 IME composing 不触发写入。

## Slash 文本语义

- slash 不再承担 provider 命令、唯一前缀补全或 scope 切换语义；
- Search Everywhere 只使用基础 `All / Files / Text / Actions` tab 决定
  result provider；
- `/actions`、`/text`、`/files`、`/all`、`/replace`、`/` 都作为普通文本
  query 在当前 tab 内参与匹配；
- recent search 原样保存 trim 后的 query，不推断或重写 provider。

## Action 结果菜单

- IDEA `/replace` Action 结果右键不会出现独立业务菜单；
- `Shift+F10` 显示选中 Action，并在底部提供 `Assign Shortcut ⌥⏎`；
- DSH 额外提供 `Show Search Everywhere Item Info` 属于只读信息增强，
  不伪造 Run、Refactor 等 IDEA 未在该表面提供的菜单项。

## Action Category

- Navigate：
  `SearchEverywhere / GoToFile / RecentFiles / Text /
  FindAction / ShowSearchHistory`
- Edit | Find：
  Find、Replace、Structural Search、Selection Search、Occurrences、
  Find Next/Previous、Search In Changes、Find/Replace in Files。
- Edit | Find Usages：
  Recent Find Usages、Find Usages、Show Usages、Find Usages Settings、
  Find Usages in File、Highlight Usages in File。
- 无 category：
  Find Tool Window、Incremental Search、Browser Search。
- category 显示在 Action row 右侧，进入 tooltip 和 Item Info meta。
- row width < 460px 时通过 container query 先隐藏 category；
  viewport < 640px 时通过 media query 隐藏，避免挤压名称、描述和快捷键。

## Tab 收敛约束

- Search Everywhere 只保留基础 tab 作为 result scope：
  `All` 混排文件、文本和 Action，`Files` 只显示文件，`Text` 只显示文本，
  `Actions` 只显示 Action。
- query 只做当前 tab 内的普通文本匹配；tab 由用户显式切换。
- 输入级 slash provider 命令、provider 唯一前缀补全和 help row 不作为
  Search Everywhere 操作路径，`/actions`、`/text` 等不再改变 tab。
- Action category 是展示元数据，不参与 query 解析、过滤或排序。
- 不通过输入 category 名称切换 Action 子集；Action 仍按名称、描述和
  关键词的普通文本匹配。

## 稳定性与布局

- 双击 Shift 保留注册，但与 `Cmd/Ctrl+Shift+F` 调用同一个 Find in Files
  handler；两者都不再打开 Search Everywhere。
- 活动 Editor 可见时两个手势均可用，不要求焦点位于 Monaco；Editor
  host 隐藏/空闲时均不触发。
- `searchText` 遇到 host hot-reload 的瞬时
  `unknown operation "searchText"` 时自动重试一次；持续失败显示本地化
  恢复提示，不把原始 host operation 文本暴露给用户。
- Search Everywhere header 使用独立、不可压缩的页签行和工具栏行：
  tabs 44px / gap 22px / 13px，toolbar 34px / gap 6px，查询行 47px。
- 极窄视口下页签行横向滚动；工具栏使用 30px 槽位测量并折叠到
  `More actions`，不会让按钮越出弹框。
- 输入框提示只说明 tab 语义，不再提示已经移除的 slash command。

## Find in Files 筛选

- File mask 复选框与 mask 输入位于顶部右侧；`.ts, .md` 会转换为
  `*.ts,*.md`，同时兼容 `*.ts`、`src/**`。
- Query 行右端固定 Match Case / Whole Words / Regex。
- Find in Files 接受单字符 query；Search Everywhere 的 Text provider
  保留自己的 2 字符阈值，两者不复用同一个最小长度门禁。
- File extension 同时过滤 Files provider 和 Text search；Case / Whole
  Words 参与文件路径与文本匹配。
- Search、Replace All 和单点 Replace 使用同一规范化和作用域条件。
- Scope 行提供 `In Project / Module / Directory / Scope`：
  Module 因缺少语言模块模型保持禁用；Directory 使用活动文件目录；
  Scope 提供 Project Files / Project Files Excluding Git-ignored /
  Project Files Tracked by Git / Recently Viewed Files / Open Files /
  Current File / Changed Files。
- Git-backed scopes 在宿主搜索前使用 `git ls-files` 生成候选文件，
  tracked 只含索引文件，excluding ignored 还包含 Git 未忽略的 untracked
  文件；workspace 位于仓库子目录时按仓库 prefix 归一化。
- Recently Viewed Files 复用 workspace 的 MRU；Git scopes 的 dirty buffer
  只合并宿主确认属于该文件集的路径。
- Scope、File extension、Case、Whole Words 和 Regex 会同时限制结果、
  handoff target 与 Replace All targets。
- Directory scope 提供 IDEA `Search recursively in subdirectories` 开关：
  默认递归，关闭后 host 在文件枚举阶段只读取目标目录直属文件，客户端
  dirty buffer merge 也用同一 direct-child 规则；开关按 workspace 保存，
  切换时清空旧结果并递增 request generation。Replace All 的 allowed path
  集只来自过滤后的 scoped matches，因此 non-recursive 模式不会写入 nested
  子目录；直属 dirty buffer 仍会进入结果/Preview，nested dirty buffer 被
  排除。
- Directory 和 Open/Changed Files scope 会传入宿主搜索，在 200 条命中
  上限之前生效；allowed-path scope 直接搜索选中文件，不让范围外结果
  占满上限。
- `⇧⌘R` 清空内容 query 与 replacement，但保留 Directory/Scope 配置；
  后续搜索和 `⌥⇧⏎` 仍只作用于该范围。
- Find scope 按 workspace 持久化到
  `dsh-editor.find.scope.v1:<workspace-root>`；关闭重开和页面刷新后恢复
  Project/Directory/Scope 与 Project/Open/Changed Files preset。非法
  Directory 路径安全回退 Project。
- Workspace 搜索会合并宿主磁盘结果与所有已打开的未保存缓冲区；
  dirty path 以内存文本替换磁盘命中，Source Preview 也读取该缓冲区。
  `Replace` / `Replace All` 对 dirty path 直接更新 Monaco model，并为
  每次动作建立独立 undo 边界；clean path 继续使用宿主受保护磁盘写入。
- Search Everywhere 的 Replace All 与持久 Find/popup 的 Replace All
  使用同一 `planWorkspaceReplacements()` dirty/clean 拆分和
  `commitFindToolDirtyPlans()` 事务：
  clean targets 先走 host，之后一次性提交 dirty models；任一 dirty
  model 预检或应用失败都不会产生部分 dirty 修改。
- Find 已打开时重复双击 Shift / CmdShiftF 只回焦 query，不重置现有
  query、scope 或筛选条件。
- IDEA CUA 显示 `Cmd+Shift+F` 为独立的 Find in Files 窗口；DSH 使用
  默认 `580×536`、居中 fixed-position 的弹框，而不是底部 dock。
- Floating Find 支持标题栏拖动和 n/s/e/w/ne/nw/se/sw 八方向缩放；
  geometry 保存到 `dsh-editor.find.popup.geometry.v1`，关闭重开及刷新后
  恢复。恢复时按当前 viewport clamp，最小尺寸 360×260（小视口自动收缩）；
  `border-box` 保证拖动/保存 round-trip 不会每次膨胀 2px。
- 弹框结果按 IDEA 平铺：左侧是匹配行/高亮，右侧是 `文件名 行号`；
  不再套用 dock 的 file/directory tree header。当前 active match 自动
  打开下方 Source Preview，并随上/下选择切换。
- IDEA CUA 显示空结果时显示 `Nothing found.`；若有搜索选项生效，会列出
  `Search option used:` / `Search options used:` 和 `Clear option` /
  `Clear all options`。DSH Find in Files 复用同一 active-option 判定并
  显示 `Match Case ⌃C / Whole Words ⌃W / Regex ⌃X`；`⌃C / ⌃W / ⌃X`
  分别清除对应布尔选项，`⌥⇧⌫` 清除全部四个搜索选项。清除动作保留
  query、scope、Filter、Preserve case 和 Replace 文本，并回焦查询框；
  有文本选区时快捷键不抢占复制。
- Source Preview 的行窗口仍按固定上限截取，但容器会以 active match 的
  垂直中心设置 `scrollTop`。短文件也定位到命中的第 N 行，而不是停在第
  1 行；首尾行按可滚动范围自然 clamp。
- Preview 的首次居中在 layout effect 内同步执行，随后在下一帧按最终
  ResizeObserver / soft-wrap 尺寸复核；切换 query 或 result 时不会先
  绘制顶部再跳到命中行。
- Preview body 使用 ResizeObserver 监听可见尺寸变化；Soft-Wrap 切换、
  dock/popup 重排或预览面板 resize 后会再次居中 active match。
  ResizeObserver 不可用时保留首次 requestAnimationFrame 定位。
- Search Everywhere Text 与 Find in Files 共用 dirty buffer merge：
  Monaco 未保存内容会覆盖同路径磁盘命中，并继续受 Case / Whole Words /
  Regex / File Mask 与 200 条上限约束。dirty text result 的 Preview 直接
  读取 live buffer，因此 dirty-only 命中也能显示并居中。
- dirty 命中保存后，`openFiles` 的 `dirty=false` 与请求 generation 共同
  触发重搜：live-buffer row 由同路径磁盘 row 接替，列表不出现重复项，
  Preview 读取新磁盘内容并继续定位到同一命中行。
- Search Everywhere Replace All 成功后发布与 Find 相同的 operation：
  clean 记录稳定 host `operationId`，dirty 记录 model before/after；
  find undo/redo 栈继续使用 20 条和 16 MiB 预算。dirty-only Replace All
  只更新 Monaco model，不写盘，并保留模型自己的 Monaco undo 边界。
- 从文本结果双击、Enter、结果菜单或 Open in Right Split 打开文件时，
  精确行列继续交给 `openFileAtLocation()`；编辑器使用
  `revealLineInCenter()`，因此 caret、选中位置和视口中心保持一致。
- 弹框标题行只保留 Filter Search Results 和 Pin Window；查询行右端只
  保留清空、Search History、Match Case、Whole Words、Regex。Replace
  row 只在 Replace 入口/`⇧⌘R` 进入 replace mode 时出现，标题同时切为
  `Replace in Files`；popup Replace 行使用 replace 图标、历史下拉、
  Preserve case 和独立的 New Line。bottom dock 仍保留自己的 Replace
  toggle 与 tree/Group By 能力。
- File extension 输入带最近 mask 下拉；历史按 newest-first 去重，最多
  10 条，只在 Enter 接受或 blur 时写入。
- File mask 启用后焦点进入 mask 输入，禁用后回到 Search query；历史/
  建议回放也回到 mask 输入。Filter Search Results 选项、鼠标 Scope mode
  与 Scope preset 切换后回到 query；键盘 `←/→` Scope mode 导航仍把焦点
  留在对应 roving button。
- File extension 下拉还会从 active/open/recent/changed 与当前搜索结果中
  生成 `*.ext` 建议，按出现频率排序并排除已存在的历史 mask；生成过程不
  触发新的 workspace walk。
- Git Scope 在 workspace 不是 Git 仓库时保持可见但 disabled；
  Recently Viewed / Open Files / Current File / Changed Files 分别在 MRU、
  打开文件、活动文件或变更集缺失时 disabled。已持久化的不可用 Scope
  回退 Project Files，不发出注定失败的搜索。
- Project speed search 的 `⌘/Ctrl+F` 只处理无 Shift 手势；
  `Cmd/Ctrl+Shift+F` 始终进入 Find in Files，不再同时打开 Project 搜索框。
- Find 弹框内 Search/Replace History、Filter 和 File mask 菜单按弹框
  transform 的本地坐标定位，并限制在弹框可命中区域内。长历史菜单自身
  滚动；菜单扩展到弹框外时不会再把 pointer hit-test 穿透到聊天页面。
- Find in Files floating 弹框默认同时显示 Search 与 Replace 行，仍可用
  Replace toggle 收起；持久 Find dock 只在 replace mode 自动展开。
  popup 与 dock 的 Search/Replace New Line
  都是独立开关，启用后对应输入使用 textarea 并让普通 Enter 插入换行，
  `⌘⏎` / `⌥⇧⏎` 等动作快捷键不被普通 Enter 分支吞掉。
- Find 的 Search/Replace query 按字面值原样传递，不 trim 首尾空格或
  换行；只有 `''` 才是空查询。因此跨行 literal、首尾带换行的 literal
  以及仅含空格/换行的 query 都与 textarea 可见内容一致。
- Find 查询历史独立于 Search Everywhere：按 workspace 保存到
  `dsh-editor.find.query.history:<workspace-root>`，原样保留首尾空格、
  换行、跨行文本和 IDEA 可回放的空 query 条目；成功搜索、Replace All
  与单点 Replace 都会记录，History replay 恢复原文后重新执行搜索并
  回焦查询框。
- 从 Find 结果打开文件只更新 Find 自己的查询历史；不会调用
  `rememberSearchEverywhereQuery()`，因此 Search Everywhere history
  不会被 Find 查询污染。`openFindTool()` 的内部 query handoff 使用
  `findToolContentQuery()`，不会 trim 传入文本。
- Search Everywhere 继续使用独立的
  `dsh-editor.search.history:<workspace-root>`，并保留既有 trim 语义；
  Find 的精确历史不会改变其记录、排序或 replay 行为。
- Replacement history 同样按 workspace 保存到
  `dsh-editor.replace.history:<workspace-root>`，并保留执行时的精确值：
  首尾空格、换行、纯空白、跨行和空 replacement 都原样进入 History。
  空条目表示删除操作；History replay 原样回填 Replace 输入并回焦该输入，
  不做 trim 或规范化，因而删除/空白替换不会被改写成另一种操作。
- Find 异步搜索同时绑定 requestId 与发起时的 workspace root。
  workspace 切换会立即递增 Find request generation；旧项目仍在途的
  success/error 响应不得更新新项目的 Find UI、query history 或结果。
  同一 requestId 但 root 不同也按过期响应丢弃，避免跨项目历史污染。
- 持久 Find 工具窗内部采用 IDEA 左右分屏：左侧结果列表独立滚动，
  右侧 Preview Source 使用左边框并随 active result 更新。
  dock 默认开启预览；单击结果只聚焦该行并加载右侧预览，不打开编辑器；
  双击或 Enter 才把命中位置交接到工具窗上方的编辑器，Find dock 保持打开。
  Transient popup 继续使用纵向结果/预览布局，不与 dock 分屏混用。
- Scope mode 使用命名 `group` 与 roving tabIndex：只有当前模式进入
  Tab 顺序，`←/→` 在 Project/Directory/Scope 间循环，`Home/End`
  跳首尾，并跳过 disabled Module；切换继续复用同一 scope 持久化与重搜路径。
- Source Preview 对当前 401 行窗口计算一次与 Find 同选项的 match：
  单行命中高亮实际字符，跨行 query 按行裁剪交集并合并重叠区间；
  零长度 regex、窗口外命中和普通文本不伪造高亮。
- Replace in Files 的 clean targets 先全部预检，再通过可回滚事务顺序写入；
  后续写入失败会逆序恢复本批已尝试文件。dirty Monaco models 仅在 host
  事务成功后应用，因此 host 失败时既不留下 clean 部分替换，也不产生
  dirty 半更新。
- 多个 dirty models 通过独立 undo boundary 的事务 helper 应用；每个 tab
  的 `⌘Z` 只撤销自己的 Replace All 结果，后续 model 应用失败时已修改
  model 会逆序恢复，成功结果再一次性同步回 openFiles。
- Preserve case 位于 Replace 行，不再依赖 replace mode 工具栏。
- Filter Search Results 六项均可用：`Anywhere`、`In Comments`、
  `In String Literals`、`Except Comments`、`Except String Literals`、
  `Except Comments and String Literals`；shared host/client lexical
  scanner applies the same filter before result caps and before
  Replace / Replace All writes.
- Pin Window 可固定浮层；pinned 时点击外部保持，unpinned 时外部点击关闭。
- Scope 行顺序固定为 Search → Replace → Scope。
- `Edit Scopes…` 支持浏览器本地命名 Scope、复制/删除/排序和
  逐行 include/exclude glob；scope patterns 在 host search 和
  Replace 前生效，排除优先。
- `Share through VCS` 把当前 Scope 写入
  `.idea/scopes/dsh-editor.xml`；简单 IDEA file-scope XML
  (`file:path//*`, `||`, `&&!file:...`) 可在 reload 后恢复，
  复杂 package/language 表达式不伪造。
- `Edit Scopes…` 提供显式 Import / Export：路径必须是 workspace-relative
  `.xml`，先 Preview 再写入；导入显示支持/跳过/同名覆盖数量，
  导出只包含 Shared Scope 并预览最终 XML。
- 成功 Replace / Replace All 后提供多步 `Undo Last Replace`：每个
  workspace 的宿主栈与 dirty Monaco 栈最多保留最近 20 条操作，总内容
  预算 16 MiB，按最旧记录淘汰；失败或外部修改不会部分回滚。
- clean 与 dirty 操作通过稳定 `operationId` 对齐；Undo 成功后同一操作
  转入 `Redo Last Replace` 栈，Redo 前重新校验 undo 后内容，成功后转回
  Undo 栈。新 Replace 截断 redo 分支，失配或已淘汰的 operationId
  整体拒绝、不误撤销。
- 查找模式的底部动作栏提供 Open results in new tab、`⌘⏎` 与
  Open in Find Window；Replace / Replace All 只在 Replace 行展开时出现。
- Open in Find Window 只要求非空 query；有结果时把同一 query、results、
  options 与 active descendant 转入可调整高度的底部持久 Find 工具窗并
  关闭弹框，零结果时也把 query/options/空结果一并交接；空 query
  disabled，超过 200 条时先确认；`⌘⏎` 调用同一路径。
- 取消 Replace All 的确认框后，popup 与 Search Everywhere 都把焦点
  返回 replacement 输入；Search Everywhere 通过独立的
  `replaceFocusRequest` 和 replacement ref 完成，不重建搜索状态。
- Replace All 使用 IDEA 的 `⌥⇧⏎`，同时兼容 Cmd/Ctrl+Enter；
  持久 Find 工具窗的 Rerun 复用当前 query，不另建搜索状态。
- Replace All 成功后若 replacement 仍包含原 query，结果会按原 query
  立即重搜；新结果、Preview 与 dirty tab 状态保持同步。
- 单处 Replace 会记录被替换行的 row identity；若 replacement 仍匹配
  原 query，重搜后跳过刚插入的同一匹配并推进到下一处。
  若 replacement 不再匹配，原 active index 自然指向下一条原始结果。
- Replace 的确认框、完成状态和单处替换共用
  `searchReplaceCountParams()`：英文按真实数量输出
  `occurrence / occurrences` 与 `file / files`，中文继续使用
  `处 / 个文件`，不再显示 `occurrence(s) / file(s)` 占位写法。
- 持久 Find 的 Group By 提供真实的 `Directory Structure ⌃D` 与
  `File Structure ⌃S`；目录模式按目录稳定排序并插入目录标题与命中计数。
  Module、Package、Production/Test、Usage Type、Merge Same Line 等语言级
  分组保持可见但 disabled，因为当前文本搜索没有对应 AST/lang model。
- Rerun 先记录 active rowKey/index/path，等目标 generation 加载完成后再
  恢复；折叠组与 Preview 内容不会因中间空 results 被清掉。
- 持久 Find 工具栏按 IDEA 顺序提供 Rerun、Previous、Next、`Settings…`、
  Group By、Expand/Collapse 与 Preview Source；`Settings…` 把同一
  query、replacement、mode、results 和 active result 返回配置弹框。
- `Preview Source` 在 dock 中作为直接工具栏动作。
- `Open results in new tab` 持久化到 `dsh-editor.find.openInNewTab`；
  文本结果通过右侧 split 的真实行列定位打开，Find dock 保持可用。
- Search Everywhere 的 `Open in Find Tool Window`、`Find Tool Window`
  action 和 `Show Usages` 的 pin 操作共用同一底部持久 Find 工具窗。
- Search Everywhere 的 `Open in Find Tool Window` 只要求非空 query；
  Files/Text 零结果时也把 query、options 与空结果交接到持久 Find 窗口，
  空 query 才禁用，与 IDEA CUA 行为一致。
- Open results in new tab 通过右侧编辑面打开当前结果。
- Directory scope 同时接受工作区相对路径和完整目录选择器；
  选择器复用宿主的 `directories` 结果，目录输入框 `⇧⏎` 与
  `Select Directory` 按钮共用入口；空路径与 `.` 代表根目录。

## 不进入 Search Everywhere 的 Action

以下 ActionsBundle 文本包含 Search/Find/Replace，但属于其它编辑器语义或 IDE 内部功能，不进入本插件搜索入口：

- `EditorChooseLookupItemReplace`：补全列表；
- `ReplaceMethodWithMethodObject`：Java 重构；
- `ReplaceInheritanceWithDelegation`：Java 重构；
- `ShowLog.Finder`：Finder 系统动作；
- `SpeedSearch`：树/列表内部快速搜索；
- `TestSearchContributors`、`FindUnusedTestData`、`ImageDuplicates`：
  IDE 测试或语言专用功能。

## 回归

```bash
node --test tests/round660.test.mjs tests/round658.test.mjs \
  tests/round657.test.mjs tests/round656.test.mjs \
  tests/round655.test.mjs tests/round654.test.mjs \
  tests/round611.test.mjs tests/round639.test.mjs \
  tests/round640.test.mjs
node --test tests/round710.test.mjs tests/round709.test.mjs \
  tests/round708.test.mjs tests/round705.test.mjs \
  tests/round704.test.mjs
node --test tests/round711.test.mjs tests/round710.test.mjs \
  tests/round709.test.mjs tests/round655.test.mjs \
  tests/round656.test.mjs tests/round622.test.mjs \
  tests/round621.test.mjs tests/round492.test.mjs \
  tests/round486.test.mjs
node --test tests/round712.test.mjs tests/round711.test.mjs \
  tests/round630.test.mjs tests/round702.test.mjs
node --test tests/round713.test.mjs tests/round712.test.mjs \
  tests/round702.test.mjs tests/round630.test.mjs
node --test tests/round714.test.mjs tests/round713.test.mjs \
  tests/round712.test.mjs tests/round702.test.mjs
node --test tests/round715.test.mjs tests/round714.test.mjs \
  tests/round713.test.mjs
node --test tests/round716.test.mjs tests/round715.test.mjs \
  tests/round702.test.mjs tests/round691.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
git diff --check
```
