# dsh-editor 工程记忆

## 2026-11-17 — Find/Replace 按 live selection 自动收敛 scope

**作用域**：Monaco 正文右键菜单、编辑器 `Cmd/Ctrl+F`、`Cmd/Ctrl+R`、
Find/Replace 的 selection scope。

**用户目标**：

- 正文右键移除 `命令面板 / 增量搜索 / 仅在选区内搜索 /
  仅在选区内替换`；
- 有选区时按 `Cmd/Ctrl+F` 或 `Cmd/Ctrl+R` 自动只在选区搜索/替换；
- 无选区时同一快捷键回到整个文件；
- 不删除 Incremental Search、selection-only 的 Search Everywhere
  入口或底层能力。

**根因/缺口**：

- Incremental Search 和两个 selection-only 动作仍注册在 Monaco
  `navigation` context menu group；
- Command Palette 是 Monaco standalone 内置 action，无法通过
  `editor.addAction` 删除其菜单注册；
- `Cmd/Ctrl+F/R` 只打开 Find/Replace，选区 scope 仍取决于上一条
  Find 状态，无法明确表达“本次快捷键有选区/无选区”。

**最终修复**：

- 三个 DSH 自定义 action 移除 `contextMenuGroupId/contextMenuOrder`，
  但保留 action、keybinding 和 Search Everywhere 路由；
- `filterMonacoContextMenuActions()` 包装 ContextMenuController 的
  `_getMenuActions`，按 action id 隐藏
  `editor.action.quickCommand`，dispose 时恢复；
- 新增 `editorFindKeyboardRequest()`：一次性读取 live selection，
  返回 selection offset scope 和短选区的初始 query；
- Cmd/Ctrl+F、Cmd/Ctrl+R 统一调用
  `openEditorFindFromShortcut()`：有 scope 时使用
  `openEditorFindInSelection()`；无 scope 时传显式 `scopeOverride=null`
  给 `openEditorFind()`，清空旧 selection scope；
- Replace All 继续复用同一 `replaceState.scope`，没有第二套替换路径。

**回归**：

- 新增 round725：**4 pass / 0 fail**；
- 定向 round725 / 550 / 552 / 545 / 722 / 504 / 507 / 509 / 511 /
  577 / static-order / round671：**41 pass / 0 fail**；
- 全量 `npm test`：**2436 pass / 0 fail**。

**运行态证据**：

- Ego Browser / 隔离 r526：
  - Monaco 正文右键中
    `Command Palette / Incremental Search / Search in Selection Only /
    Replace in Selection Only` 均消失；
  - 选择 `TerminalHub` 后 `Cmd+F`：query 为该文本，
    Selection Only `aria-pressed=true`；
  - 清除选区后 `Cmd+F`：Selection Only 回到 `false`；
  - 选择 `TerminalHub` 后 `Cmd+R`：Replace 输入可见且聚焦，
    Selection Only `aria-pressed=true`；
  - 清除选区后 `Cmd+R`：Replace 输入可见且聚焦，
    Selection Only `aria-pressed=false`；
  - 临时 model `AAAA\nBBBB\nAAAA` 中选择第一个 `AAAA`，Replace All
    `ZZ` 后得到 `ZZ\nBBBB\nAAAA`，随后恢复原内容。

## 2026-11-17 — Project 目录展开卡顿与预取收敛到 1 层

**作用域**：Project 文件树目录展开、workspace 初次加载预取、
Compact Directories 连续链。

**症状/根因**：

- 点击目录后界面要等待明显时间才出现直属子项；
- `toggleDirectory()` 把 `prefetchDirectorySubtrees([path], depth=3)`
  放在可见展开的关键路径上，helper 会串行读取点击目录及最多 200 个
  后代目录，全部完成后才更新 children/expanded；
- workspace 首次加载也预取 3 层，进一步扩大启动请求与后续点击的
  竞争压力。

**最终修复**：

- 有 children 缓存时先立即 `setExpanded`，随后只刷新 clicked path
  自身一次 `list`；
- 无缓存时最多等待当前目录自己的直接 listing，不再等待多层 BFS；
- `PROJECT_PREFETCH_DEPTH` 从 3 改为 1，预取函数默认深度同步改为 1；
- 后台预取改为 `void`，使用 workspace 与 per-directory token 防止旧
  请求回写；
- Compact Directories 的连续单链解析抽到 `project.js`，缓存路径先
  立即解析，刷新后再按最新 listing 解析一次；
- 后台预取仍然只写 children，不写 expanded。

**回归**：

- round723 覆盖缓存立即展开、无缓存只等直接 listing、预取非阻塞；
- round690 覆盖一层预取、启动不展开和 Compact Directories；
- round694 / 206 / 723 的名称与断言已从三层更新为一层；
- 定向 round723 / 690 / 694 / 206 / 327 / project-toolwindow /
  round671：**38 pass / 0 fail**；
- 全量 `npm test`：**2432 pass / 0 fail**；
- `npm run check:client-build`、`node --check lib/client.js`、
  `node --check lib/index.js`、`git diff --check` 均通过。

**运行态证据**：

- Ego Browser / 隔离 r526；
- Project 初次打开只显示 `.idea / docs / src / README.md` 顶层行，
  目录均折叠；
- 测量点击 `src` 到直属 `app.js / nav-main.js / nav-target.js` 行
  出现约 **3.5ms**；
- 页面无 alert，展开后树结构与 fixture 一致。

## 2026-11-17 — 选区直填 Find in Files、右键菜单收敛与 Browser Search

**作用域**：Monaco live selection、Find/Replace in Files 快捷入口、
编辑器正文右键菜单、Search Everywhere Search Web 可见文案。

**用户目标**：

- 有选区时 `Cmd/Ctrl+Shift+F`、`Cmd/Ctrl+Shift+R` 与双击 Shift
  自动把选区原文填入查询框；
- 重复快捷键必须用编辑器最新选区覆盖现有 query；
- 正文右键移除 `Find in Files… / Replace in Files… / Replace… /
  Find Usages…`；
- `Search with Google` 可见文案改为 `Browser Search / 浏览器搜索`。

**缺口/根因**：

- 快捷 opener 固定传空 query；Find 已打开时只聚焦旧 query；
- 单行文本 input 会吞掉多行选区换行；
- 四个搜索动作虽然仍可右键执行，但用户认为它们是重复高频噪声；
- 可见 label 仍把浏览器搜索限定为 Google。

**修复**：

- 新增 `selectedEditorFindQuery()`，从当前 Monaco live selection
  读取未 trim 原文；
- Find/Replace opener 在选区非空时替换 query、清空旧结果并递增
  searchGeneration；无选区时保持原有空白/聚焦行为；
- 双击 Shift 与 CmdShiftF 共用 find opener，CmdShiftR 使用 replace
  opener；
- query 含换行时自动启用 Search New Line，切换到 textarea；
- 仅删除四个 Monaco action 的 contextMenuGroupId/order，保留动作、
  keybinding 和 Search Everywhere 入口；
- 可见文案改为 `Browser Search / 浏览器搜索`，keywords 保留
  `Search with Google / Search Web`。

**回归**：

- 新增 round722：**5 pass / 0 fail**；
- RED：初始 **0 pass / 4 fail**；
- 定向 round722 / 544 / 545 / 546 / 547 / 550 / 530 / 557 / 583 /
  628：**44 pass / 0 fail**；
- 全量 `npm test`：**2429 pass / 0 fail**。

**运行态证据**：

- Ego Browser / 隔离 r526：
  - 选区 `  constructor() {\n    ` 触发 CmdShiftF 后 query 完全一致，
    自动进入 textarea + New Line；
  - 再次选择 `}\n` 执行同一快捷键，query 被最新选区整体替换；
  - CmdShiftR 把 `export class Terminal` 填入 Replace in Files query；
  - 双击 Shift 把最新选区 `}` 填入 Find in Files；
  - Monaco 正文右键不再出现四个冗余项；
  - 同样右键中出现 `Browser Search`。

## 2026-11-17 — Project 首次打开禁止自动展开预取层

**作用域**：workspace `... → Editor` 首次打开、Project 树 expanded
恢复、初始 tab session restore、Always Select Opened File。

**用户澄清**：

- workspace 只预加载前 3 层目录节点信息；
- 首次打开 Editor 时不得自动展开这 3 层；
- 树默认只展开项目根，目录由用户点击后展开。

**根因**：

- prefetch helper 本身只填 children，但旧版展开 key
  `dsh-editor.expanded:<root>` 曾混入自动三层路径，升级后仍被恢复；
- 初始 editor session restore 会依次激活多个历史 tab
  （实测 `nav-target.js → README.md → nav-target.js`），
  Always Select Opened File 把这些恢复过程误当成用户 tab 切换，
  调 `revealInProjectTree()` 展开 `src/`；
- expanded effect 随后把自动展开写入持久化，下一次继续污染。

**修复**：

- expanded 改为版本化 key `dsh-editor.expanded.v2:<root>`，旧 key
  不再读取；用户之后手动展开会写 v2 并继续持久化；
- session restore 开始时关闭 Project autoscroll arm，恢复完成后下一
  macrotask 才 arm；restore 期间的 activePath 变化不触发 reveal；
- 用户后续切换 tab 仍走原 `revealInProjectTree()`，Always Select
  Opened File 的交互保留；
- prefetch 仍为 3 层 BFS，且仍不写 expanded。

**回归**：

- 新增 round721：**4 pass / 0 fail**；
- RED：初始 **0 pass / 3 fail**；补充 autoscroll 用例后 4 pass；
- 定向 round721 / 690 / 694 / 138 / 379 / project-toolwindow /
  round173：**31 pass / 0 fail**；
- 全量 `npm test`：**2424 pass / 0 fail**。

**运行态证据**：

- Ego Browser / 隔离 r526：
  - 注入旧 key `["src","src/lang","src/lang/base"]` 并删除 v2 后打开
    Editor；
  - 树仅有 `.idea / docs / src / README.md` 四个顶层行，
    所有目录 `aria-expanded=false`，无 level-2 行；
  - 旧 key 保留但被忽略，v2 初始为 `null`；
  - 手动展开 `src` 后 v2 写为 `["src"]`；
  - 用户先切 README、再切回 nav-target 后，autoscroll 正常展开
    `src` 并选中目标文件；
  - 验证后已收起 src 并删除测试 v2 key。

## 2026-11-17 — Find in Files 空结果选项提示与快捷键

**作用域**：IDEA `Cmd+Shift+F` 的 Find/Replace in Files 空结果状态、
搜索选项摘要、清除动作、File mask 命名和快捷键。

**缺口**：

- DSH 空结果只显示 `No matches`，没有 IDEA 的
  `Search option used / Clear option`；
- File mask 控件在 DSH 中仍叫 `File extension`，与 IDEA 实窗不一致；
- IDEA 在多选项时显示 `Search options used` 和每项清除快捷键，
  DSH 没有对应动作。

**IDEA CUA 证据**：

- `ZZZZ_NOT_FOUND_TOKEN` + File mask：
  `Nothing found. / Search option used: File mask / Clear option ⌥⇧⌫`；
- 再加 Match case：`Search option used: Match case / Clear option`；
- Match case + Words：
  `Search options used: Match case ⌃C  Words ⌃W / Clear all options ⌥⇧⌫`；
- 再加 Regex：
  `Match case ⌃C  Words ⌃W  Regex ⌃X`。

**修复**：

- Find in Files 复用 `searchEverywhereActiveOptionIds()`，避免两套
  active-option 判定漂移；
- floating popup 空结果显示 `Nothing found.`，并按单/多选项显示
  `Search option used(s)`；
- Clear 只重置 Match Case / Whole Words / Regex / File mask，保留 query、
  scope、Filter、Preserve case 和 Replace；
- query/replace 输入所在 Find 工具窗支持 `Ctrl+C / Ctrl+W / Ctrl+X`
  清对应选项、`Alt+Shift+Backspace` 清全部；有文本选区时不抢占复制；
- `File extension` 可见文案统一为 IDEA 的 `File mask / 文件掩码`。

**回归**：

- 新增 round720：**6 pass / 0 fail**；
- RED：初始 **0 pass / 6 fail**；
- 定向 round720 / 594 / 596 / 628 / 630 / 632 / 636 / 639 / 641 /
  648 / 649：**52 pass / 0 fail**；
- 全量 `npm test`：**2420 pass / 0 fail**。

**运行态证据**：

- Ego Browser / 隔离 r526 / `127.0.0.1:63237`：
  - 空结果显示 `Nothing found.`；
  - Match Case 单项显示 `Search option used: Match Case ⌃C`、
    `Clear option ⌥⇧⌫`；
  - Match Case + Regex 显示 `Search options used` 与
    `Clear all options ⌥⇧⌫`；
  - `Control+C` 只清除 Match Case，保留 Regex；
  - `Alt+Shift+Backspace` 清除剩余选项，query 保留且焦点回到查询框；
  - File mask 标签为 `File mask:`。

**下一轮风险**：

- IDEA 结果 Preview 标题行还提供 `Soft-Wrap Preview Editor`，DSH 当前
  没有对应直接动作；
- 需要继续检查 History 菜单和 File mask combo 的 IDEA 默认建议。

## 2026-11-17 — Harness 一级发送入口与 Monaco 选区引用

**作用域**：Project 文件树、编辑器标签、diff 标签、Monaco 正文右键菜单、
Harness composer 的 `@` reference 插入。

**症状/缺口**：

- 现有 Project/标签菜单把发送动作藏在 `Harness ›` 二级菜单里，文件树
  高频入口多一步；
- Monaco 正文右键菜单没有 Harness 入口，无法直接引用光标或选区；
- 运行态点击一级路径动作时 composer 返回
  `Could not insert the Harness reference`：span-based `insertReference`
  使用的 `draftRev` 在已有 Lexical chip/装饰稳定后已过期；
- 只支持 `L行:列`，选中多行时缺少起止范围。

**修复**：

- Project 根/行、左右编辑器标签、diff 标签的首项统一改为一级
  `Harness->`，删除 `sendPathToHarness` 等二级文案和菜单；
- Monaco Action 使用 `navigation` 组内 `contextMenuOrder: -100`，确保
  `Harness->` 位于右键菜单首项；
- `harnessEditorLocation()` 从真实 Monaco selection 读取光标，或将反向
  选区归一化为起止行列；
- reference plan 支持 `endLine/endColumn`，输出
  `L起行:起列-L止行:止列`，单点仍为 `L行:列`；
- composer bridge 优先调用公开的 `input.addFiles(references, [])`，避免
  span revision CAS 竞争；旧接口缺 `addFiles` 时才回退到原有插入链；
- 插入后保留 draft、聚焦 composer，且从不调用 submit。

**回归**：

- 新增 round719：**7 pass / 0 fail**；
- 定向 round717 / round719：**13 pass / 0 fail**；
- 全量 `npm test`：**2414 pass / 0 fail**；
- `npm run check:client-build`、`node --check lib/client.js`、
  `node --check lib/index.js`、`git diff --check` 通过。

**运行态证据**：

- Ego Browser / 隔离 r526 / `127.0.0.1:63237`：
  - Project 文件与目录右键菜单首项均为 `Harness->`，其后才是 New/Rename；
  - Monaco 正文右键菜单首项为 `Harness->`，其后为 Go to Declaration 等；
  - 光标 `5:2` 插入 `nav-target.js L5:2`；
  - 选区 `L2:1-L3:5` 插入 `nav-target.js L2:1-L3:5`；
  - 文件路径插入 `nav-target.js`，目录插入 `docs/`；
  - 原 `root draft` chip 保留，composer 获焦，消息数保持 `0`；
  - 验证后已用撤销恢复原 draft。

**适用环境**：

- DSH conversation input facade 提供 `addFiles` 的宿主；
- Monaco 0.52.2；
- 旧宿主若只有 `insertReference/insertText` 仍走兼容回退。

## 2026-11-16 — Project 树 Command 多选与取消选择

**作用域**：Project 文件树鼠标选择、`⌘/Ctrl` 单项增删、`Shift` 区间、
选择锚点与选中 primary 的同步。

**症状/风险**：

- 用户报告 Command 单击无法稳定多选，也无法再次点击取消选中；
- 普通点击应退出多选，只保留最后点击项；
- 旧实现只在 `click` 后提交选择，`mousedown` 遇到修饰键直接返回，既延后
  了视觉反馈，也没有在修饰键点击时主动把键盘焦点留在 Project 树；
- `selectedPath` 在 `setSelection(current => ...)` 的 updater 内更新，
  属于在状态计算期间产生另一个 state 副作用，重复/并发执行时容易出现
  选择集合与 primary 不一致。

**修复**：

- 新增纯函数 `projectTreeSelectionAfterPointer()`，统一处理：
  - 普通点击：`selection = { path }`；
  - `⌘/Ctrl`：仅 toggle 当前行，保留其他选择；
  - `Shift`：从 anchor 扩选可见连续区间；
  - 取消当前 primary 时选择最近的剩余可见行作为 primary/anchor。
- Project 行的选择迁移移到 `onMouseDown`，与 IDEA “按下即选”一致；所有
  左键点击都会先聚焦树，再提交选择；
- `onClick` 不再重复 toggle，只负责单击打开/目录展开等点击后语义；
- 用 `selectionRef` / `selectionPrimaryRef` 同步当前选择，`applyTreeSelection`
  在一次调用中同时更新 selection、primary 与 anchor，移除 state updater
  内的跨状态写入；
- filtered view、批量移动、删除、Shift+Arrow 等选择路径统一走同一迁移入口。

**IDEA CUA 证据**：

- 普通单击 `notes.md` 后单选；
- `⌘+单击` `graph.ts` 后状态栏显示 `2 elements selected`；
- 再 `⌘+单击` `r144-demo.ts` 后显示 `3 elements selected`；
- 再次 `⌘+单击` 已选中的 `graph.ts` 后显示 `2 elements selected`，其余两项
  保持选中；
- 松开 Command 后普通单击另一文件，状态栏不再显示多选计数，只保留当前项。

**回归**：

- 新增 round718：**7 pass / 0 fail**；
- RED：初始 **0 pass / 7 fail**；
- 定向 round718 / toolwindow-round11 / round173 / round378 / round379 /
  round563：**30 pass / 0 fail**；
- 全量 `npm test`：**2407 pass / 0 fail**；
- `npm run check:client-build`、`node --check lib/client.js`、
  `node --check lib/index.js`、`git diff --check` 均通过。

**运行态证据**：

- Ego Browser / 隔离 r526，真实 `Meta` 按下/释放：
  - 普通点击 `app.js` → `["src/app.js"]`；
  - Command 点击 `nav-main.js` → `["src/app.js","src/nav-main.js"]`；
  - Command 点击 `nav-target.js` → 三项；
  - Command 再点 `nav-main.js` → 取消该项，保留两项；
  - 松开 Command 后点击 `README.md` → 只剩 `README.md`；
  - 每一步 `activeElement` 都在 Project `role="tree"` 内。

## 2026-11-16 — Harness 右键菜单与 composer 文件引用

**作用域**：Project 根/文件/目录右键菜单、左右编辑器文件标签页、
差异标签页，以及 Harness Chat composer 的 `@` reference 插入。

**缺口**：

- 文件、目录和已打开文件没有把路径送入 Harness Chat 的菜单入口；
- 现有 Copy Path/Reference 只复制文本，不能创建 DSH 草稿中的结构化
  reference chip；
- 直接模拟 textarea/contenteditable 输入会覆盖草稿、丢失 chip 语义，且
  容易在菜单卸载时把焦点还给文件树。

**修复**：

- Project 根、Project 行、左/右编辑器标签和 diff 标签的首个菜单项统一
  为 `Harness ›`，沿用共享 `ContextMenu` 的二级菜单与键盘导航；
- `harnessReferencePlan()` 复用 DSH `@path` / `@"path with spaces"` 语法：
  workspace 文件/目录使用相对路径，项目根使用绝对路径，目录保留 `/`；
- 有真实 caret 时 `ref` 仍是合法 `@file`，chip 展示和消息投影加入
  `L行:列`，避免把位置拼进 DSH 文件解析 id；
- `insertHarnessReferencesIntoComposer()` 优先使用
  `sessions.scope(...) → conversation.input.for(...) →
  input.insertReference(...)`，保留已有 draft，只追加内容；
- 菜单 action 设置 `restoreFocus:false`，并在 Lexical 提交 chip 后通过
  timer / animation frame 重新聚焦 `[data-composer-input]`；
- 旧宿主缺少公开 input shell 时才退回 `execCommand('insertText')`；
- 插入链路从不调用 `submit`，因此不会自动发送消息。

**回归**：

- 新增 round717：**6 pass / 0 fail**；
- RED：初始 **0 pass / 6 fail**；
- 定向 round717 / 219 / 379：**14 pass / 0 fail**；
- 全量 `npm test`：**2400 pass / 0 fail**；
- `npm run check:client-build`、`node --check lib/client.js`、
  `node --check lib/index.js`、`git diff --check` 均通过。

**运行态证据**：

- Ego Browser / 隔离 r526：
  - Project 文件、目录、项目根和编辑器文件标签的首项均为
    `Harness ›`；
  - 目录插入 chip 为 `docs/`，保留 `folder draft`；
  - 项目根插入 chip 为 `dsh-editor-r526-fixture/`，保留 `root draft`；
  - `nav-target.js` 光标位于 `5:2` 时插入
    `nav-target.js L5:2` reference chip；
  - composer 获得焦点，已有 draft 未被覆盖，消息数保持 `0`。

## 2026-11-16 — Context-bound Scope 可用性与 Geometry 边界

**作用域**：Find in Files Scope selector 的 Git / Recently Viewed /
Open Files / Current File / Changed Files disabled 与 fallback，以及弹框
geometry 在超屏/缩窗时的 clamp。

**缺口**：

- Git 与 Recently Viewed 已按上下文 disabled，但 Open Files、Current File、
  Changed Files 无论是否有 open/active/changed context 都保持可执行；
- 持久化的不可用 Scope 虽有 effective fallback，但可用性函数没有覆盖新增
  的三类上下文 Scope；
- geometry 已有 resize clamp，但缺少源代码回归锁定 resize listener。

**修复**：

- `findSearchScopePresetAvailable()` 增加：
  - `openFileCount > 0`
  - `currentFileAvailable === true`
  - `changedFileCount > 0`
- FindToolWindow 把 `openFilePaths.length`、`activeFilePath !== null`、
  `changedFilePaths.length` 传入可用性模型；
- Scope option 使用同一条件设置 `disabled`；
- 不可用持久 Scope 继续通过 `effectiveScopePreset = projectFiles` 回退，
  不发出注定失败的搜索；
- viewport resize effect 继续 clamp popup geometry。

**回归**：

- 新增 round716：**4 pass / 0 fail**；
- RED：初始 **0 pass / 4 fail**；
- 定向 round716 / 715 / 702 / 691：**20 pass / 0 fail**；
- 全量 `npm test`：**2394 pass / 0 fail**；
- `npm run check:client-build`、`node --check lib/client.js`、
  `node --check lib/index.js`、`git diff --check` 均通过。

**运行态证据**：

- Ego Browser / 隔离 r526，临时清空 open session 与 MRU：
  - Scope select 回退为 `Project Files`；
  - `Recently Viewed Files`、`Open Files`、`Current File` 均为 disabled；
  - 持久化 Open Files Scope 自动改回 Project Files；
- 持久化超屏 geometry `{x:900,y:600,width:800,height:700}` 后：
  - viewport 1044×657 中最终 rect 为 `{x:236,y:8,width:800,height:625}`；
  - 右下边界保持在 8px 安全边距内；
- 测试后已恢复 open session、30 条 MRU、Scope 与 geometry storage。

## 2026-11-16 — Find in Files 可移动、可缩放并记忆 Geometry

**作用域**：`Cmd+Shift+F` / `Shift+Cmd+R` Find in Files floating popup
的位置、尺寸、标题栏拖动、八方向缩放和浏览器本地持久化。

**实现**：

- 默认 geometry 为 580×536 并按 viewport 居中；当前 viewport 太小时
  自动收缩并保留 8px 安全边距；
- 标题栏非交互区域拖动窗口，交互控件（button/input/select/link/menu item）
  不启动拖动；
- `n/s/e/w/ne/nw/se/sw` 八个内部 handle 提供缩放，最小尺寸 360×260；
- 拖动/缩放只在 pointerup 时写入
  `dsh-editor.find.popup.geometry.v1`，避免每帧 localStorage 写入；
- 窗口 resize 时重新 clamp 内存 geometry；下次打开、关闭重开和页面刷新
  都恢复上次位置与尺寸；
- popup 使用 `box-sizing: border-box`，保存外框 rect 后再次恢复不会因为
  border 宽高各加 2px 而持续膨胀。

**回归**：

- 新增 round715：**5 pass / 0 fail**；
- RED：初始 **0 pass / 5 fail**；
- 定向 round715 / 714 / 713：**14 pass / 0 fail**；
- 全量 `npm test`：**2390 pass / 0 fail**；
- `npm run check:client-build`、`node --check lib/client.js`、
  `node --check lib/index.js`、`git diff --check` 均通过。

**运行态证据**：

- Ego Browser / 隔离 r526：
  - 默认 popup 与 8 个 resize handle 正常渲染；
  - 标题栏真实鼠标拖动后 popup/storage 同步到新 x/y；
  - SE 放大与 NW 缩小后 width/height 与 storage 一致；
  - 缩小后再次向上/左拖动成功；
  - Escape 关闭再打开后恢复
    `{x:452,y:121,width:544,height:488}`，与 persisted geometry 完全一致；
  - border-box 修复前拖动一次会把 580×536 写成 582×538；修复后
    round-trip 不再膨胀。

## 2026-11-16 — Non-recursive Directory Scope Replace 验证

**作用域**：Directory recursive=false 下的 Search、dirty Monaco buffer、
Source Preview 与 Replace All 文件集一致性。

**验证**：

- host 搜索 direct scope fixture，recursive=false 只返回 `top.txt`；
- 用该结果集直接调用 guarded replace，只修改 `top.txt`，
  `nested/deep.txt` 保持原 token；
- `findToolPathMatchesScope()` 对 recursive=false 接受目标目录直属文件，
  拒绝 nested 子文件；recursive=true 两者都接受；
- dirty merge 和 Replace All 继续共用同一 `scopedMatches`：
  `scopedReplacementPaths` 只由 scoped matches 生成；
- recursive/scope 切换都会清空 files/matches/index、递增 generation 并
  立即清空 Preview active result。

**回归**：

- 新增 round714：**4 pass / 0 fail**；
- 定向 round714 / 713 / 712 / 702：**21 pass / 0 fail**；
- 全量 `npm test`：**2385 pass / 0 fail**；
- `npm run check:client-build`、`node --check lib/client.js`、
  `node --check lib/index.js`、`git diff --check` 均通过。

**运行态证据**：

- Ego Browser / 隔离 r526：
  - recursive=false 搜索 `R714_REPLACE_TOKEN` 只有 `top.txt` 一条，
    Preview 显示直属文件内容；
  - Replace All 后 `top.txt` 变为 `R714_REPLACE_DONE top`，
    `nested/deep.txt` 仍保留原 token；
  - nested dirty buffer 含同 token 时，recursive=false 仍为 `No matches`；
  - 直属 `top.txt` dirty buffer 含 token 时，结果重新出现 1 条，Preview
    直接显示 live buffer 的 `R714_REPLACE_TOKEN top dirty`；
- 临时 fixture、DSH host 与 Ego space 已清理。

## 2026-11-16 — Directory Scope 递归搜索开关

**作用域**：IDEA Find in Files 的 Directory scope、
`Search recursively in subdirectories`、host 文件枚举、dirty buffer merge、
Preview 和 Replace target。

**IDEA CUA 证据**：

- Directory scope 右侧存在独立目录树按钮，名称是
  `Search recursively in subdirectories`；
- fixture 的目录直属 `top.txt` 与 `nested/deep.txt` 都含同一 token；
- 递归状态搜索返回 2 matches / 2 files，关闭递归后只保留直属文件；
- 该状态属于 Find in Files Directory scope，而不是文件 mask 或 Filter。

**缺口**：

- 插件 Directory mode 一直递归 `listWorkspaceFiles()`；
- 没有递归按钮、没有 workspace 级持久化；
- host 和客户端 dirty merge 都没有 direct-child 约束；
- 切换递归状态不会主动失效当前结果。

**实现**：

- host `listWorkspaceFiles()` 接收 `recursive`；false 时目录只入队初始
  scope directory，不再 push 子目录；
- `workspaceSearchScope()` / `workspaceSearchPathMatchesScope()` 在
  recursive=false 时只接受 parent 等于 scope directory 的文件；
- client request 只在 Directory mode 下转发用户递归值，Project/Scope
  preset 始终按递归搜索，避免误伤 Open Files 等显式路径集；
- dirty merge 使用同一 `findToolPathMatchesScope()` direct-child 规则；
- 递归开关按 workspace 保存到
  `dsh-editor.find.directoryRecursive:<root>`，默认 true；
- 切换按钮有 `aria-pressed`，显示 IDEA 名称，变更后清空旧结果、重置 active
  row/Preview 并递增 searchGeneration；
- 按钮操作后焦点回到 Search query。

**回归**：

- 新增 round713：**5 pass / 0 fail**；
- RED：初始 **0 pass / 5 fail**；
- 定向 round713 / 712 / 702 / 630：**22 pass / 0 fail**；
- 全量 `npm test`：**2381 pass / 0 fail**；
- `npm run check:client-build`、`node --check lib/client.js`、
  `node --check lib/index.js`、`git diff --check` 均通过。

**运行态证据**：

- Ego Browser / 隔离 r526：
  - Directory=`r713-direct`、默认递归时返回 `top.txt` 与
    `nested/deep.txt` 两条命中，按钮 `aria-pressed=true`；
  - 关闭递归后只剩 `top.txt`，按钮 `aria-pressed=false`，
    storage 值变为 `0`，焦点回到 Search；
  - 页面 reload 后 Directory 与 recursive=false 均恢复，结果仍只有
    `top.txt`。

## 2026-11-16 — Find File mask / Filter / Scope 焦点闭环

**作用域**：IDEA `Cmd+Shift+F` 的 File mask 启用/禁用、mask history、
Filter Search Results、Directory/Scope mode 与 Scope preset 切换。

**IDEA CUA 证据**：

- File mask 从禁用切到启用后，焦点进入 mask 输入，可直接继续输入；
- 再次禁用后焦点回到 Search query，已输入的 mask draft 仍保留；
- File mask 历史和推荐项选择后应回到 mask 输入；
- Filter Search Results 选择 In Comments 后，菜单关闭且焦点回到 Search；
- 鼠标点击 Directory mode 后焦点仍在 Search，后续输入直接进入 query；
- 切换到 Scope mode 及选择 Scope preset 后同样保持 query 所有权。

**缺口**：

- 插件启用 mask 后焦点停在 checkbox；禁用后同样停在 checkbox；
- mask history/建议及 Clear 后焦点回到菜单 opener；
- Filter 选项执行后焦点回到 Filter 按钮；
- 鼠标切换 Scope mode / preset 后焦点停在按钮或 select。

**修复**：

- mask checkbox 根据 enabled 分支，在 state commit 后聚焦 mask 输入或
  query 输入；draft 保留；
- mask history、suggestion、Clear 统一 `acceptFileMask()` 后回焦 mask；
- Filter 选择先关闭菜单、提交 context filter，再回焦 query；
- Scope mode 的鼠标 `onClick` 在提交后回焦 query；键盘 `←/→` 仍由
  `moveFindScopeMode()` 聚焦对应 roving button；
- Scope preset `change` 提交后回焦 query；
- Scope 切换仍增加 `searchGeneration` 并设置 `loadedGeneration=-1`，
  旧 scope 的在途 response 不能写回新 scope。

**回归**：

- 新增 round712：**5 pass / 0 fail**；
- RED：初始 **1 pass / 4 fail**；
- 定向 round712 / 711 / 630 / 702：**23 pass / 0 fail**；
- 全量 `npm test`：**2376 pass / 0 fail**；
- `npm run check:client-build`、`node --check lib/client.js`、
  `git diff --check` 均通过。

**运行态证据**：

- Ego Browser / 隔离 r526：
  - 启用 mask 时 activeElement 为 mask 输入；禁用后为 Search，draft
    `*.js` 保留；
  - mask history 选择 `*.js` 后 mask 输入保持焦点；
  - Filter 选择 In Comments 后菜单关闭、query 获得焦点；
  - Directory mode 切换后 query 值 `R712_SCOPE_QUERY` 保留且获得焦点；
  - Scope preset 切到 Open Files 后仍回焦 query。

## 2026-11-16 — Search/Replace History 空条目与输入焦点

**作用域**：IDEA `Cmd+Shift+F` / `Shift+Cmd+R` 的 Find query history、
replacement history、Search Everywhere 替换历史，以及 History replay
后的键盘所有权。

**IDEA CUA 证据**：

- Find in Files 的 Search History 列表包含可选择空行；
- Down + Enter 选择空行后 query 被清空，焦点回到 Search 输入；
- Replace History 也包含空行；
- Down + Enter 选择空行后 replacement 被清空，焦点回到 Replace 输入；
- 空 replacement 是真实删除操作，不能从历史中过滤。

**缺口**：

- `rememberFindQueryHistory()` 与 `rememberReplacementHistory()` 过滤
  `''`，因此无法保存/回放 IDEA 的空条目；
- workspace recorder 同样拒绝空 query / replacement；
- read/write 使用 `''` 作为“只规范化、不新增”的哨兵，和合法空值冲突；
- History replay 菜单关闭后焦点回到历史按钮，而不是 IDEA 的输入框。

**修复**：

- 两个 history helper 接受任意 string，包括 `''`，并保持 exact dedupe、
  20 条上限和 newest-first；
- 使用 `undefined` 表示“只规范化存储数组”，read/write 改传
  `undefined`，避免读取时凭空新增空行；
- `rememberWorkspaceFindQuery()` / `rememberWorkspaceReplacement()`
  不再拒绝空字符串；
- Search Everywhere、Find Tool 与编辑器 Find 的历史项执行后，分别把
  焦点送回 query / replacement 输入；
- 空菜单项保留 24px 可点击行，label/aria-label 为空，与 IDEA 的空白
  历史行一致，不伪造“Delete History”等动作。

**回归**：

- 新增 round711：**6 pass / 0 fail**；
- RED：round711 初始 **1 pass / 4 fail**；
- 定向 round711 / 710 / 709 / 655 / 656 / 622 / 621 / 492 / 486：
  **33 pass / 0 fail**；
- 全量 `npm test`：**2371 pass / 0 fail**；
- `npm run check:client-build`、`node --check lib/client.js`、
  `git diff --check` 均通过。

**运行态证据**：

- Ego Browser / 隔离 r526，把 `R711_DELETE_TOKEN` Replace All 为空：
  - 文件内容从 `R711_DELETE_TOKEN remains?` 变为 ` remains?`；
  - `dsh-editor.replace.history:<root>` 首项为 `""`；
  - Replace History 首行为可点击空行；
  - 选择空行后 replacement 清空、菜单关闭、焦点回到 replacement 输入；
- Enter search history 的空条目后 query 为空，焦点回到 Search 输入；
- 从查询框按 `Alt+Down`、`Down`、`Enter` 也完成同一空 query replay；
- 临时 fixture 文件已删除。

## 2026-11-16 — Preview 首帧无跳动居中

**作用域**：Search Everywhere 与持久 Find 的 Source Preview 在切换
query/result、Soft-Wrap、resize 和 dock 重排时的滚动定位。

**症状**：

- 预览内容切换时，首个 paint 仍显示文件顶部；
- 原实现只在 `useEffect` 中调度 `requestAnimationFrame`，下一帧才把
  active match 滚到垂直中心，用户可感知一次跳动。

**修复**：

- 两处 Preview 居中改为 `React.useLayoutEffect`；
- `centerNow()` 在 layout 阶段同步设置 `scrollTop`，paint 前完成首次定位；
- 随后仍调用一次 rAF，按 ResizeObserver / Soft-Wrap 后的最终尺寸复核；
- ResizeObserver 回调继续走同一 `recenter()`，不丢失 resize 纠偏。

**回归**：

- 新增 round710：**3 pass / 0 fail**；
- 定向 round710 / 709 / 708 / 705 / 704：
  **23 pass / 0 fail**。
- 全量 `npm test`：**2365 pass / 0 fail**；
- `npm run check:client-build`、`node --check lib/client.js`、
  `git diff --check` 均通过。

**运行态证据**：

- Ego Browser / 隔离 r526，402 行文件；
- 临时把 `requestAnimationFrame` 替换为空实现后，第 402 行预览仍为
  `scrollTop=6738`、`scrollHeight=6860`、`clientHeight=122`，命中行可见；
- 尾部 clamp 后中心偏差 `30.7px`，属于滚动终点物理边界；
- 双击结果后编辑器状态栏定位 `402:10`。

## 2026-11-16 — dirty 搜索保存后由磁盘结果接替

**作用域**：Search Everywhere Text 的 dirty live buffer、保存、重新
搜索和 Preview 生命周期。

**验证**：

- `savePath()` 以 `model.getValue()` 写入，成功后同一 openFiles entry
  更新内容、`dirty=false` 和宿主返回的 mtime；
- Search Everywhere text request 同时绑定递增 requestId 与 `openFiles`
  dependency，旧 dirty response 不能覆盖保存后的状态；
- `mergeFindToolDirtyMatches()` 以 dirty path Set 移除同路径 host row；
  dirty result 和 disk result 不会并列重复；
- dirty Preview 直接读取 openFiles 中的 live content，保存后重新读取
  磁盘内容，仍按 active line 居中；
- 402 行文件末行命中窗口为 2..402，底部由 `previewLineScrollTop()`
  自然 clamp。

**回归**：

- 新增 round709：**6 pass / 0 fail**；
- 定向 round709 / 708 / 707 / 706 / 704：
  **24 pass / 0 fail**。

**运行态证据**：

- Ego Browser / 隔离 r526，402 行测试文件；
- dirty token 只存在于第 300 行 Monaco buffer 时显示 1 条 live result，
  Preview 居中且与 buffer 一致；
- `Meta+S` 后 dirty dot 消失、磁盘 token 为 1 处，重新搜索只返回 1 条
  host result；
- 搜索第 402 行 token 时 Preview 命中行可见，双击后编辑器定位
  `402:10`。

## 2026-11-16 — Preview 首尾边界与 dirty 生命周期矩阵

**作用域**：Search Everywhere / Find Preview 的 1 行、401 行、终端边界，
以及 dirty result 在保存、重载、请求竞态下的失效顺序。

**验证**：

- `searchEverywherePreviewWindow()`：
  - 1 行文件返回完整唯一行；
  - 401 行文件完整显示；
  - 402 行文件从 1..401 开始截断；
  - 1000 行文件首行窗口 1..401、中间 300..700、尾行 600..1000；
- `previewLineScrollTop()`：
  - 首行/顶部命中 clamp 到 0；
  - 尾行/底部命中 clamp 到 `scrollHeight-clientHeight`；
- Search Everywhere text effect 的 `openFiles` dependency 与 requestId
  失效保护仍存在；
- dirty Preview 在 openFiles 更新后立即重新读取 live buffer；
- save/reload 路径仍将 openFiles 的 `dirty` 置为 false；
- 所有文本结果打开入口继续传 path/line/column。

**回归**：

- 新增 round708：**6 pass / 0 fail**；
- 定向 round708 / 704 / 705 / 706 / 707：**22 pass / 0 fail**。
- 全量 `npm test`：**2356 pass / 0 fail**；
- `npm run check:client-build`：17 modules verified。

**运行态证据**：

- Ego Browser / 隔离 r526，1000 行文件：
  - 第 1 行命中：`scrollTop=0`，命中行可见；
  - 第 1000 行命中：`scrollTop=6738`，命中行可见；
  - 再切回第 1 行：`scrollTop=0`，没有残留旧偏移；
- 首尾行因 clamp 无法完全居中，但命中行始终在可视区；
- 临时测试文件已删除，fixture 恢复原状态。

## 2026-11-16 — Search Everywhere Replace 统一 Undo 历史

**作用域**：Search Everywhere Replace All 的 clean/dirty operation、
Find bounded Undo/Redo 历史和 dirty-only 不写盘语义。

**缺口**：

- Search Everywhere Replace All 已能通过 dirty plans 更新 Monaco model；
- 成功后只清空 Find undo/redo 栈，没有把本次 operation 写回；
- 因而 Search Everywhere 触发的修改无法进入统一 Undo Last Replace；
- replace 成功路径的 finally 曾重复释放 write guard。

**实现**：

- Replace 前记录 dirty plans 的 before/after：
  - before 来自 live model；
  - after 来自 replacement plan；
- 成功后生成与 Find 相同的 operation：
  - 稳定 host `operationId`；
  - clean 只在 host 实际修改文件时成立；
  - dirty model before/after；
  - files / replacements 数量；
- 新 operation 写入 bounded Find undo stack，并截断 redo；
- dirty model 仍通过 `commitFindToolDirtyPlans()` 建立独立 Monaco undo；
- write guard 在所有终态只释放一次。

**回归**：

- 新增 round707：
  - dirty before/after 记录；
  - bounded operation wiring；
  - dirty Monaco undo 独立；
  - guard 终态释放次数。
- round707：**4 pass / 0 fail**；
- 定向 round707 / 701 / 700 / 699 / 666 / 706：
  **29 pass / 0 fail**。
- 全量 `npm test`：**2350 pass / 0 fail**；
- `npm run check:client-build`：17 modules verified。

**运行态证据**：

- Ego Browser / 隔离 r526：
  - `r707-replace.txt` 磁盘内容不含测试 token；
  - Monaco dirty buffer 在第 20、40 行加入 `R707_DIRTY_TOKEN`；
  - Replace All 后模型变为 `R707_REPLACED`，磁盘文件保持不变；
  - Find toolbar 直接出现 `Undo Last Replace`；
  - 点击 Undo 后模型恢复两处 `R707_DIRTY_TOKEN`，替换文本消失；
  - 文件仍为 dirty，无 alert；
  - 临时测试文件已删除，fixture 恢复原状态。

## 2026-11-16 — Search Everywhere Text 合并 dirty buffer 与实时预览

**作用域**：Search Everywhere Text provider、dirty Monaco buffer、
Text result Preview 和后续 Replace All 结果集。

**缺口**：

- Find in Files 已合并宿主磁盘结果和 dirty Monaco buffer；
- Search Everywhere Text 仍只使用宿主磁盘搜索；
- dirty text result 的 Preview 仍通过 `read` 读取旧磁盘内容；
- 因此 Search Everywhere 会漏掉 dirty-only 命中或显示陈旧预览。

**实现**：

- Search Everywhere 接收当前 `openFiles`；
- Text effect 复用 `mergeFindToolDirtyMatches()`：
  - dirty path 用 live Monaco 内容覆盖磁盘命中；
  - Case / Whole Words / Regex / File Mask 与 Find 同一条件；
  - 复用同一 200 条结果上限和稳定排序；
- text result 增加 `dirty` 标记；
- Preview effect 对 dirty text result 直接读取 `openFiles` 的 live
  content，不调用磁盘 `read`；
- dirty buffer 内容变化会更新 Search Everywhere 搜索 effect，
  继续经过 180ms debounce；
- 现有中心滚动、ResizeObserver 和精确行列打开逻辑保持不变。

**回归**：

- 新增 round706：
  - dirty host result merge wiring；
  - dirty text preview live-content wiring；
  - Editor 向 Search Everywhere 传 `openFiles`；
  - dirty merge 的 search options 与 200 cap。
- round706：**4 pass / 0 fail**；
- 定向 round706 / 704 / 705 / 645 / 666：**18 pass / 0 fail**。
- 全量 `npm test`：**2346 pass / 0 fail**；
- `npm run check:client-build`：17 modules verified。

**运行态证据**：

- Ego Browser / 隔离 r526：
  - 磁盘 `r706-dirty.txt` 只有普通 `line-*`；
  - Monaco 未保存内容在第 60 行加入 `R706_DIRTY_TOKEN dirty only`；
  - Search Everywhere Text 返回 1 个 dirty-only 结果：
    `r706-dirty.txt:60:1`；
  - Preview 从 live buffer 显示 `R706_DIRTY_TOKEN`；
  - Preview `scrollTop=911`，命中行可见，中心偏差 `-0.3px`；
  - 无 alert；
  - 临时测试文件已删除，fixture 恢复原状态。

## 2026-11-16 — 预览布局变化后保持命中行居中

**作用域**：Search Everywhere / Find in Files 预览在 Soft-Wrap、面板尺寸
和 dock/popup 布局变化后的滚动定位。

**缺口**：

- 首次 active result 定位已居中，但只执行一次 requestAnimationFrame；
- Soft-Wrap 会改变匹配行高度，dock/popup resize 会改变预览可视区；
- 原 scrollTop 在新布局下会偏离命中行中心。

**实现**：

- 两处预览 effect 抽出本地 `recenter()`；
- preview body 增加 ResizeObserver；
- observer 回调重新执行同一 `centerPreviewLineInContainer()`；
- Search Everywhere / Find in Files 的 effect 显式依赖
  `previewSoftWrap`；
- effect cleanup 同时取消 pending frame 并 disconnect observer；
- `ResizeObserver` 不存在时仍保留首次 requestAnimationFrame 定位。

**回归**：

- 新增 round705：
  - 首行、尾行和零可滚动高度 clamp；
  - 两处 ResizeObserver wiring 与 observer cleanup；
  - soft-wrap dependency；
  - observer 可选降级。
- round705：**4 pass / 0 fail**；
- 定向 round705 / 704 / 465 / 498：**16 pass / 0 fail**。
- 全量 `npm test`：**2342 pass / 0 fail**；
- `npm run check:client-build`：17 modules verified。

**运行态证据**：

- Ego Browser / 隔离 r526，Find in Files 命中第 240 行；
- 初始 preview 高度 `121.6px`、`scrollTop=4018`、中心偏差 `-2.3px`；
- 将 preview body 调整为 `230px` 后：
  - ResizeObserver 自动重算 `scrollTop=3964`；
  - 命中行仍可见；
  - 中心偏差 `-2.5px`；
- 临时测试文件已删除，fixture 恢复原状态。

## 2026-11-16 — 搜索结果预览滚动到命中行中心

**作用域**：Search Everywhere / Find in Files 文本结果预览，以及从结果
打开文件到精确行列。

**症状与根因**：

- `searchEverywherePreviewWindow()` 已经把行窗口截在命中行附近；
- 但当文件短于 401 行时窗口包含整份文件，预览滚动容器仍保持
  `scrollTop=0`，因此只显示文件开头；
- Search Everywhere 与 Find in Files 都没有在 active result 变化后把
  命中行滚入可视区。

**实现**：

- 新增 `previewLineScrollTop()`：
  - 用匹配行中心与容器中心之差计算目标 `scrollTop`；
  - clamp 到 `0..scrollHeight-clientHeight`；
  - 文件首尾行自然贴边；
- 新增 `centerPreviewLineInContainer()`，在两处预览 effect 的下一帧执行；
- Search Everywhere 与 Find in Files 的预览行增加稳定
  `data-dsh-preview-line`；
- active result、preview content、focus line 或 loading 状态变化都会重算；
- 打开文本结果继续统一走 `openFileAtLocation()`：
  - Monaco caret/selection 使用命中行列；
  - `revealLineInCenter()` 把命中行放到编辑器中心；
  - 右侧 split 使用同一 `revealSplitLocation()`。

**回归**：

- 新增 round704：
  - 中心滚动数学和首尾 clamp；
  - Search Everywhere preview ref/effect/行号 wiring；
  - Find in Files preview ref/effect/行号 wiring；
  - 所有文本搜索结果保留 line-centered 打开路径。
- round704：**4 pass / 0 fail**；
- 定向 round704 / 465 / 498 / 464 / 687：**22 pass / 0 fail**。
- 全量 `npm test`：**2338 pass / 0 fail**；
- `npm run check:client-build`：17 modules verified。

**运行态证据**：

- Ego Browser / 隔离 r526：300 行 `r704-preview.txt`，命中第 240 行；
- 修复前：preview `scrollTop=0`，active line `top=4497.9`，
  可视区 `429.9..551.5`，`visible=false`；
- 修复后：preview `scrollTop=4016`，active line `481.9..498.9`，
  可视区 `429.9..551.5`，中心偏差 `-0.3px`；
- 双击结果打开右侧 split 后：
  - 右侧 textarea 从 `line-231` 开始展示；
  - caret/status 为 `240:1`；
  - Monaco 可见窗口包含第 240 行。

## 2026-11-16 — Find in Files File Mask 建议、快捷键隔离与弹框菜单命中

**作用域**：`Cmd+Shift+F` File mask 下拉、Project speed search、
Find 弹框 History/Filter/Mask 菜单定位和 Scope 可用态。

**症状与根因**：

- Project 的 `Cmd/Ctrl+F` 捕获器没有排除 Shift，会先于 Editor 的
  `Cmd/Ctrl+Shift+F` 处理并打开 Project speed search；
- IDEA File mask 下拉除历史外还显示项目扩展名建议，DSH 只有历史；
- Find 弹框的 transform 让 fixed 菜单的 `left/top` 实际按弹框局部坐标
  解释，ContextMenu 只按 viewport clamp，导致菜单绘制到弹框右侧/下方，
  但指针 hit-test 落到背后的聊天页面；
- 长 Search History 菜单没有 max-height，近底部条目不可点击。

**实现**：

- Project speed search 仅在 `meta/ctrl + f` 且未按 Shift 时接管；
- 新增 bounded `suggestFileMasks()`：
  - 复用 active/open/recent/changed 与当前搜索结果路径；
  - 按扩展出现频率生成 `*.ext`；
  - 不启动额外文件系统 walk；
  - 已存在历史 mask 去重；
- File mask 菜单顺序为 history → suggestions → Clear；
- 新增 `findToolMenuLeft/Top/MaxHeight()`：
  - 将 viewport anchor 转为弹框 transform 的本地坐标；
  - 左右和顶部限制在 Find 弹框内；
  - 高度按剩余弹框空间设置 max-height，长菜单内部滚动；
- ContextMenu 支持业务传入 `maxHeight` 与 `overflowY`；
- Git Scope 依据真实 Git 可用性 disabled，Recently Viewed 依据 MRU
  是否为空 disabled，不可用的持久化 Scope 回退 Project Files。

**回归**：

- 新增 round703：
  - File mask 建议排序、去重、非法扩展名过滤；
  - 菜单顺序与无额外 filesystem walk；
  - Project speed search 不截获 Shift chord；
  - Find 菜单局部坐标和高度 clamp；
  - Git/Recently Viewed Scope availability 与 fallback。
- round703：**7 pass / 0 fail**；
- 定向 round703 / 630 / 702 / 691：**23 pass / 0 fail**。
- 全量 `npm test`：**2334 pass / 0 fail**；
- `npm run check:client-build`：17 modules verified。

**运行态证据**：

- Ego Browser / 隔离 r526 / `127.0.0.1:63237`：
  - `Meta+Shift+F` 只打开 Find in Files，Project search input 不存在；
  - File mask 菜单显示 `*.txt`、`*.js`、`*.md`、`*.mjs`、`*.yml`；
  - 点击 `*.js` 后 mask checkbox 启用、输入值变为 `*.js`；
  - 菜单和 Search History 均完全位于 Find 弹框内；
  - Search History 菜单 `bottom=586.5`，Find 弹框 `bottom=596.5`；
  - `elementFromPoint` 命中菜单项本身，点击不再穿透到聊天页面；
  - Search History 菜单在弹框内滚动，首项可点击。

## 2026-11-16 — Find in Files IDEA Scope 预设补齐

**作用域**：`Cmd+Shift+F` Find/Replace 弹框的 Scope、Git 文件集、
Recently Viewed Files、dirty buffer 合并与替换范围。

**IDEA 对照**：

- IDEA 2026.2 `Replace in Files` Scope 列表包含
  `Project Files Excluding Git-ignored`、`Project Files Tracked by Git`、
  `Recently Viewed Files`、`Open Files`、`Current File`、
  `All Changed Files` 等；
- libraries、scratches、language class hierarchy 需要当前插件没有的语言
  索引，本轮不伪造。

**实现**：

- Scope 持久化与选择器新增 `recentlyViewedFiles`、`gitTrackedFiles`、
  `gitNonIgnoredFiles`；
- Recently Viewed Files 直接复用 workspace 的 30 条 MRU 文件列表；
- tracked scope 使用 `git ls-files --cached -z`；
- excluding ignored scope 使用
  `git ls-files --cached --others --exclude-standard -z`；
- 两个 Git scope 在宿主搜索开始前限制候选文件，避免范围外结果占满
  200 条上限；
- workspace 可能位于仓库子目录，Git 输出先按 `--show-prefix` 归一化；
- 浏览器把 dirty/open buffer 路径发给宿主；宿主返回这些路径与 Git scope
  的交集，客户端只合并交集内的未保存内容；
- Preview、单处 Replace 与 Replace All 继续消费同一批 scoped matches，
  不增加第二条范围判断链。

**回归**：

- 新增 round702：
  - 新 Scope 归一化与本地化入口；
  - tracked scope 只返回 Git 跟踪文件；
  - non-ignored scope 返回 tracked + untracked，不返回 gitignored；
  - workspace 子目录范围；
  - dirty buffer membership；
  - 客户端与宿主请求字段 wiring。
- round702：**7 pass / 0 fail**；
- 全量 `npm test`：**2327 pass / 0 fail**；
- `npm run check:client-build`：17 modules verified。

**运行态证据**：

- IDEA CUA 对照确认 Scope 名称与可用数据边界；
- Ego Browser / 隔离 r526 / `127.0.0.1:63237`：
  - tracked scope 搜索 `R702_SCOPE_TOKEN` 返回 1 文件；
  - excluding ignored 返回 tracked + untracked 共 2 文件；
  - Recently Viewed 返回刚打开的 `r702-tracked.txt`；
  - Replace All 写入 tracked + untracked，gitignored 文件不变；
  - 临时 fixture 文件与暂存项已清理。

## 2026-11-16 — Find in Files Bounded Multi-step Replace History

**作用域**：Find in Files / Replace in Files 的连续 Undo / Redo、clean
事务、dirty Monaco buffer、混合替换和历史内存预算。

**症状与根因**：

- 单槽 Undo/Redo 无法连续撤销多次 Replace；
- 客户端 dirty 历史使用 `length * 2` 估算内存，且单条超预算时仍会保留；
- 宿主新 Replace 清空 redo 数组时没有扣回其字节数，导致后续 history
  被错误淘汰；
- Undo/Redo 状态复用了 `{matches}` 参数，但文案使用 `{count}`，运行态
  显示字面量 `Undid {count} replacements...`。

**实现**：

- 宿主改为 per-workspace undo/redo 栈：20 条、16 MiB、64 workspace；
  clean operation 返回稳定 `operationId`，Undo/Redo 用该 id 校验目标；
- 新 Replace 先释放 redo 分支字节，再追加 undo；
- 客户端 dirty 栈使用 UTF-8 字节预算，严格清理超预算及更旧记录；
- clean 只有在 `operationId` 非空且确有宿主文件变化时才可走宿主 Undo，
  避免 dirty-only 操作误消费另一条 clean 历史；
- dirty-only、clean-only、mixed 操作分别以 before/after 校验后提交；
- Undo/Redo 完成文案改用 `{matches} / {matchUnit} / {files} / {fileUnit}`。

**回归**：

- 新增 round701：
  - 客户端 20 条上限、UTF-8 字节预算和超大最新记录清理；
  - 宿主 20 条淘汰、16 MiB 淘汰、连续 Undo/Redo；
  - 新 Replace 截断 redo、旧/错误 operationId 拒绝；
  - clean 记录必须绑定稳定 operationId、redo 字节释放；
  - Undo/Redo 单复数文案占位符。
- round701：**10 pass / 0 fail**；
- 全量 `npm test`：**2320 pass / 0 fail**；
- `npm run check:client-build`：17 modules verified；
- `node --check` 与 `git diff --check` 通过。

**运行态证据**：

- Ego Browser / 隔离 r526，clean-only：
  - Replace A、Replace B 后连续 Undo B、Undo A，再 Redo A、Redo B；
  - 新 Replace 后 overflow 中不再出现 Redo，分支被截断；
  - 外部修改后 Undo 报 `cannot undo because the file changed after replacement`，
    另一文件不写入。
- mixed clean + dirty：
  - 同一 Replace All 同时写 clean 文件和 dirty Monaco model；
  - Undo 同时恢复两侧，Redo 同时重放两侧。
- dirty-only：
  - Replace / Undo / Redo 只改 Monaco model，磁盘 clean 文件保持不变。
- 文案：
  - `Undid 1 occurrence in 1 file`；
  - `Redid 1 occurrence in 1 file`。

## 2026-11-16 — Find in Files Redo Last Replace

**作用域**：Replace / Replace All 的最近一次 Undo 与 Redo 往返。

**实现**：

- 宿主增加 per-workspace redo slot，与 undo slot 使用同一 16 MiB /
  64 workspace 上限；
- Undo 成功后把原 operation 转入 redo；Redo 前逐文件校验当前内容
  仍等于 undo 后 originalContent；
- Redo 成功写回 afterContent，再把同一 operation 转回 undo；
- 新 Replace 清理 redo；
- dirty Monaco 同样保存 before/after；Undo 校验 after，Redo 校验 before；
- floating Find header 只显示当前可用的 Undo 或 Redo 之一，
  保持 title row 不溢出；dock 中两项并存但按状态禁用。

**回归**：

- 新增 round700：
  - clean 多文件 Replace → Undo → Redo → Undo 往返；
  - Undo 后外部修改导致 Redo conflict；
  - UI 和 host operation wiring；
  - dirty before/after 方向校验。
- round700：**4 pass / 0 fail**；
- 全量 `npm test`：**2310 pass / 0 fail**；
- `npm run check:client-build`：17 modules verified；
- `node --check` 与 `git diff --check` 通过。

**运行态证据**：

- Ego Browser / 隔离 r526：
  - Replace All 2 文件后 header 显示 Undo；
  - Undo 后显示 Redo，文件恢复 needle；
  - Redo 后文件重新变为 omega，header 转回 Undo；
  - 再 Undo 后外部修改一个目标，Redo 报
    `cannot redo because the file changed after undo`，另一文件不写入。

## 2026-11-16 — Find in Files Undo Last Replace

**作用域**：Find in Files 单处 Replace、Replace All、dirty Monaco
buffer、clean 文件事务和外部修改冲突。

**实现**：

- 宿主仅为每个 workspace 保留最近一次 clean 文件替换快照，
  总内容上限 16 MiB，最多 64 个 workspace；
- 快照包含 originalContent、afterContent、after mtime 和 count，
  不通过 API 回传文件内容；
- `undoReplaceText` 在任何写入前逐文件校验当前内容仍等于 afterContent；
  文件缺失或外部修改返回 conflict，且不会部分回滚；
- clean 回滚复用 `commitWorkspaceReplacements()` 事务，失败时恢复
  afterContent；
- 浏览器记录同一操作的 dirty model before/after 内容；
- `Undo Last Replace` 先预检 dirty model，再调用宿主 clean 回滚，
  最后以独立 Monaco undo boundary 恢复 dirty buffer；
- Search Everywhere Replace 使用同一宿主 undo slot，因此开始新替换时
  会清空旧 Find undo；
- 页面 reload 清空客户端可撤销状态；宿主快照只保留最近一次替换。

**回归**：

- 新增 round699：
  - clean 多文件 Replace → Undo 精确恢复；
  - 外部修改后 Undo 拒绝且其他文件不先回滚；
  - UI action 只在快照存在时启用；
  - dirty 预检、host undo、dirty commit 和快照清空。
- round699：**4 pass / 0 fail**；
- 全量 `npm test`：**2306 pass / 0 fail**；
- `npm run check:client-build`：17 modules verified；
- `node --check` 与 `git diff --check` 通过。

**运行态证据**：

- Ego Browser / 隔离 r526：
  - `r699-undo/a.ts`（2 处）与 `b.ts`（1 处）执行 Replace All；
  - Undo 按钮启用，点击后两文件恢复为原始 `needle`；
  - 第二次 Replace All 后外部修改 `b.ts`；
  - Undo 显示 `cannot undo because the file changed after replacement`，
    `a.ts` 保持 `omega`，未被部分回滚。

## 2026-11-16 — Scope XML 显式导入/导出

**作用域**：Find in Files `Edit Scopes…` 的 IDEA Scope XML 互操作。

**实现**：

- Scope 编辑器新增 Import / Export 入口；
- 路径必须是 workspace-relative、长度有界、以 `.xml` 结尾且不含 `..`；
- 流程固定为 Path → Preview → 显式 Import/Export，不在选择文件后自动写入；
- Import：
  - 最多读取 256 KiB；
  - 预览支持 Scope 数、跳过的不支持表达式数和同名覆盖数；
  - 同名 Scope 由导入项替换，其他 Scope 保留；
- Export：
  - 只导出 `shared=true` 的 Scope；
  - Preview 显示最终 IDEA XML；
  - 用户点击 Export 后才调用现有 guarded write；
- 复杂 package/language scope 表达式继续跳过，不伪造成 file glob。

**回归**：

- round696 新增 transfer path 校验、skipped report、Import/Export UI
  和写文件 wiring；
- round696：**9 pass / 0 fail**；
- 全量 `npm test`：**2302 pass / 0 fail**；
- `npm run check:client-build`：17 modules verified；
- `node --check` 与 `git diff --check` 通过。

**运行态证据**：

- Ego Browser / 隔离 r526：
  - `.idea/scopes/imported.xml` 含 1 个支持 Scope + 1 个 package Scope；
  - Import Preview 显示 `Scopes: 1; skipped: 1; replacements: 0`；
  - 导入后 `Imported Sources` 出现在 Scope 列表，include=`r698-src/**`；
  - 搜索 2 files → 1 file；
  - Export Preview 显示 1 个 Shared Scope 和最终 XML；
  - `.idea/scopes/exported.xml` 与 Preview 一致。

## 2026-11-16 — Find in Files Shared Scope 与 IDEA XML

**作用域**：`Edit Scopes…` Shared Scope、workspace scope XML、
Local/Shared id 穩定性和 reload 恢复。

**问题**：

- Local Scope 先用浏览器生成 id，转成 Shared 后 XML 只保存
  name/pattern；刷新后重新解析会得到另一个 id，当前 Scope 选择丢失；
- Shared Scope 不能只是一个 UI 复选框，否则会留下“看似共享、
  实际只在本浏览器”的假状态。

**实现**：

- Scope 对象增加 `shared`；
- Shared Scope id 由名称稳定派生 `shared-<fnv36>`，保存前后与
  reload 后一致；
- `Share through VCS` 仅在用户保存 Scope 时写
  `.idea/scopes/dsh-editor.xml`，未勾选 Shared 的普通编辑不会创建文件；
- 启动时只读取该明确文件，Local 继续保存在
  `dsh-editor.find.customScopes.v1:<root>`；
- 实现无第三方依赖的有界 IDEA XML subset：
  - 读取 `<scope name pattern>`；
  - 支持 `file:path//*`、`file[...]:`、`||`、`&&!file:...`、
    XML entity；
  - 序列化 Shared Scope 为同一简单 file-scope 形式；
  - 含 package/language 或括号的复杂表达式跳过，不伪造语义；
- 文件内容最大读取 256 KiB，Scope/pattern 数量沿用既有上限。

**回归**：

- round696 新增 XML round-trip、shared id、local storage 隔离
  和 `.idea/scopes/dsh-editor.xml` wiring 断言；
- round696：**8 pass / 0 fail**；
- 全量 `npm test`：**2301 pass / 0 fail**；
- `npm run check:client-build`：17 modules verified；
- `node --check` 与 `git diff --check` 通过。

**运行态证据**：

- Ego Browser / 隔离 r526：
  - 创建 Shared Sources：include=`r697-src/**`，
    `Share through VCS=true`；
  - `.idea/scopes/dsh-editor.xml` 写入
    `pattern="file:r697-src/**"`；
  - 搜索结果 2 files → 1 file；
  - 整页 reload 后 Shared Scope 仍在，`custom:shared-lubpxq`
    保持选中，搜索仍为 1 file；
- 临时 fixture、scope XML 和本地 storage 测试项已移出/清理。

## 2026-11-16 — Find in Files Edit Scopes

**作用域**：IDEA Find in Files `Scope → Edit Scopes…`、
本地命名 Scope、include/exclude glob、宿主搜索和替换范围。

**IDEA 对照**：

- Scopes 对话框提供 Add Scope（Local/Shared）、Delete、Copy、
  Move Up/Down；
- Scope 详情包含 Name、include/exclude 树、pattern 输入和
  Share through VCS；
- DSH 只实现可通过浏览器 workspace 真实保存的 Local Scope，
  不伪造 Shared/VCS 或语言 module scope。

**实现**：

- `dsh-editor.find.customScopes.v1:<root>` 按 workspace 保存最多 30 个
  Scope；名称 80 字符、include/exclude 各最多 40 条且单条 512 字符；
- Scope preset 使用 `custom:<id>`，normalize 只接受安全 id；
- `Edit Scopes…` 浮层支持新增、复制、删除、上移、下移、Name、
  Include patterns、Exclude patterns；Cancel 不改 live state；
- glob 支持 `*`、`**`、`?`、basename/path 和 `file:path//*` 形式；
  空 include 表示全部，exclude 优先；
- host searchText、dirty buffer merge、handoff、单处 Replace、
  Replace All 和 host replaceText 全部使用同一 Scope 边界；
- 范围外 clean target 在 host preflight 被拒绝，不会写入；
- 删除当前选中的 Scope 后回退 Project Files。

**回归**：

- 新增 round696：
  - malformed/localStorage Scope 归一化；
  - custom preset 校验；
  - browser/host glob 语义一致；
  - host search 与 replace 的 include/exclude 边界；
  - Edit Scopes 对话框和请求传播。
- 定向 round696 / 695 / 644 / 691 / 634：
  **24 pass / 0 fail**；
- 全量 `npm test`：**2300 pass / 0 fail**；
- `npm run check:client-build`：17 modules verified；
- `node --check` 与 `git diff --check` 通过。

**运行态证据**：

- Ego Browser / 隔离 r526：
  - 创建 `Fixture Sources`，include=`r696-src/**`，
    exclude=`r696-src/generated/**`；
  - Scope 下拉出现 custom option，搜索由 3 files 收敛为 1 file；
  - Replace All 确认 `1 occurrence in 1 file` 后，
    `r696-src/a.ts` 变为 `omega`，generated/b.ts 与 docs/c.ts
    保持 `needle`。

## 2026-11-16 — Find in Files 词法上下文过滤

**作用域**：`Cmd/Ctrl+Shift+F` Find in Files 的
`Filter Search Results`、宿主 `searchText` / `replaceText`、
脏 Monaco buffer 搜索与替换。

**IDEA 对照**：

- 菜单固定六项：Anywhere、In Comments、In String Literals、
  Except Comments、Except String Literals、
  Except Comments and String Literals；
- IDEA 选择行后以 `Return` 应用并关闭过滤菜单，结果数立即重算；
- Anywhere → In Comments 后，结果从代码/字符串/注释混合集缩为注释命中。

**实现**：

- 新增共享语义但分别落在宿主与浏览器 bundle 的有界词法扫描：
  - 0=代码，1=注释，2=字符串；
  - 支持常见 C 系、Python、Shell/YAML、CSS、HTML/XML、
    SQL/Lua、PHP、Rust、Markdown；
  - 带转义、三引号、反引号、块注释、Rust 嵌套块注释处理；
  - 未知文件类型不猜测，按普通代码处理；
- 过滤发生在 200 条结果上限之前，前若干注释命中不会挤掉后续
  字符串或代码命中；
- `contextFilter` 写入搜索选项持久化；Find 搜索、dirty merge、
  单处 Replace、Replace All 和宿主替换全部传递同一值；
- 脏 Monaco buffer 的 `editorFindResult` / `editorReplaceAll` /
  `editorReplaceAt` 使用同一模式；
- 宿主正则 Replace All 对允许记录逆序重写；普通文本 Replace All
  只拼接允许 offset；单处 Replace 对 disallowed occurrence 报
  stale/conflict，不会误写。

**回归**：

- 新增 round695：
  - TS fixture 的六种模式分别返回 5/2/2/3/3/1 条；
  - Replace All 只改注释或只改纯代码；
  - disallowed exact occurrence 被拒绝；
  - dirty buffer 搜索与 Replace All 使用同一分类；
  - UI 六项均非 disabled，选中项显示 `✓`；
  - Find 搜索和四条替换请求全部携带 `contextFilter`。
- 定向 round695 / 632 / 479 / 480 / 481 / 482 / 483 / 484 /
  585 / 646 / 647 / 670：**49 pass / 0 fail**；
- 全量 `npm test`：**2293 pass / 0 fail**；
- `npm run check:client-build`：17 modules verified；
- `node --check` 与 `git diff --check` 通过。

**运行态证据**：

- IDEA CUA：Filter Search Results 六项真实可见；Anywhere 默认 checked；
  选择 In Comments 后结果数由 100+ / 13+ files 变为
  100+ / 44+ files，命中内容以注释为主；
- Ego Browser / 隔离 r526 重启宿主后：
  - `r695-context.ts` query=`needle`，Anywhere=5；
  - In Comments=2（第 2、4 行）；
  - In String Literals=2（第 1、3 行）；
  - Except Comments and String Literals=1（第 5 行）；
  - filter 菜单选中项为 `Except Comments and String Literals`；
  - Replace All 确认 `1 occurrence in 1 file` 后仅第 5 行变为
    `const c = omega;`，注释和字符串中的 needle 保留。

## 2026-11-16 — Project 三层懒加载澄清与 pinned Select Opened File

**作用域**：Project 初始目录读取、目录点击、展开手势和
`Select Opened File (⌥F1, 1)` 工具栏动作。

**用户澄清**：

- “默认加载三层”是指目录节点信息的递归读取上限，不是自动展开三层；
- 点击目录后以 clicked path 为新起点，执行同样的三层有界读取；
- 展开/收起仍遵循 IDEA：单击选择、双击展开，
  开启 `Open Directories with Single Click` 后才单击展开；
- Project 工具栏应有 IDEA 的靶心按钮，并在窄窗格中可见。

**原有缺口**：

- 三层 BFS 与 clicked-anchor 已存在，但缺少独立契约明确
  “prefetch 不得写 expanded”；
- Project 标题动作最大宽度为 76%，在最小 200px 工具窗中会占满
  可用宽度，靶心按钮被优先推进 `»`；
- `PanelToolbar` 只按前缀保留 left actions，不能表达 pinned 动作。

**修复**：

- Project title action 最大宽度收敛到 68%，为 pinned action
  预留实际槽位；
- `panelToolbarFit()` 新增 `pinnedLeftCount`，先为 pinned action
  留位，再按原规则保留右侧 Options / Hide 与 overflow；
- `PanelToolbar` 使用 `selectCompactActions()` 选择 left actions，
  pinned 靶心不会因为位置靠后而先溢出；
- Project `reveal` action 标记 `pinned: true`，继续复用
  `revealActive()`：切到 Project、打开面板、展开祖先、
  选中并滚动到当前文件；
- 三层加载继续只写 children，不写 expanded；点击目录只把
  用户点击的节点加入 expanded。

**回归**：

- 新增 round694：
  - 200px 宽度下 pinned action 优先保留；
  - `PanelToolbar` 使用共享 compact selection；
  - 靶心 action 的 pinned、disabled 和 reveal wiring；
  - prefetch helper 默认 `maxDepth=3` 且不调用 `setExpanded`；
  - clicked directory 仍以 `[path]` 为预取起点；
- 定向 round694 / 688 / 690 / 392 / 394 / 177 / 194 / 206：
  **34 pass / 0 fail**。
- 全量 `npm test`：**2287 pass / 0 fail**；
- `npm run check:client-build`：17 modules verified；
- `node --check` 与 `git diff --check` 通过。

**运行态证据**：

- Ego Browser / 隔离 r526，Project 宽 200px：
  - 工具栏直接显示 `Select Opened File (⌥F1, 1)`；
  - 虽仍有 `»`，靶心不再被标题路径挤掉；
- 创建 `r694-depth1/depth2/depth3/depth4/marker.txt`：
  - 初次刷新只显示 `r694-depth1`，且 `aria-expanded=false`；
  - 双击 `r694-depth1` 后仅该节点展开，
    `depth2` 仍为 `aria-expanded=false`；
  - 没有 alert、栈溢出或 render boundary；
- 收起 `src` 后点击靶心：
  - `src` 自动展开；
  - `src/nav-target.js` 可见且 `aria-selected=true`。

## 2026-11-16 — TypeScript extensionless import 假错误

**作用域**：Monaco TS/JS language defaults、`class_pool.ts` 等
workspace 相对 import 和 diagnostics。

**症状**：

- `import {logging} from "../../logging/logging";` 可正常 Go to
  Declaration；
- Monaco 同时显示 TS2792 `Cannot find module`，并建议
  `moduleResolution: nodenext` 或 `paths`。

**根因**：

- Monaco TS worker 只注册当前打开的 model，没有插件 workspace 的
  完整 tsconfig/project service；
- extensionless 相对 import 指向未打开文件时，worker 无法解析；
- 插件自己的 workspace 导航先读候选路径，所以点击可以成功，
  与 worker 的 module-not-found 诊断产生冲突。

**修复**：

- 新增 `configureMonacoLanguageDiagnostics()`；
- TS/JS defaults 设置：
  - `moduleResolution: NodeJs`；
  - `module: ESNext`；
  - `allowSyntheticDefaultImports` / `resolveJsonModule`；
- 只忽略 `TS2307` 与 `TS2792` 两类 module-not-found；
- 不设置 `noSemanticValidation` / `noSyntaxValidation`，
  其他语义错误和语法错误继续显示；
- Monaco 已加载与首次 AMD 加载两条路径都会应用配置。

**回归**：

- 新增 round693：
  - fake TS/JS defaults 验证诊断码与 compilerOptions；
  - loader 在 resolve Monaco 前调用配置；
- 定向 round693 / editor-round16 / round329 / static-order：
  **20 pass / 0 fail**；
- 全量 `npm test`：**2283 pass / 0 fail**；
- `npm run check:client-build`：17 modules verified；
- `node --check` 与 `git diff --check` 通过。

**运行态证据**：

- Ego Browser / 隔离 r526 加载真实
  `src/lang/base/object/class_pool.ts` 和 `logging.ts`：
  - `moduleErrors=[]`；
  - 剩余 markers 仅为 `6133` unused suggestions；
  - 人为追加 `const = ;` 后仍出现 `TS1134` 语法错误；
  - compilerOptions=`moduleResolution:2,module:99`。

## 2026-11-16 — Find in Files Current File Scope 与 Replace 行

**作用域**：`Cmd/Ctrl+Shift+F` floating Find in Files、Scope preset、
Replace 行和 Replace All allowedPaths。

**IDEA CUA 对照**：

- IDEA Find in Files 在 Search 模式也直接显示 Replace 行；
- IDEA Scope 预设包含 Current File；
- DSH 之前 floating 默认隐藏 Replace 行，Scope 只有
  Project Files / Open Files / Changed Files。

**实现**：

- `normalizeFindSearchScope()` 接受并持久化 `currentFile`；
- Scope 下拉新增 Current File；
- FindTool 的 currentFile allowedPaths 为当前 active file；
- EditorWorkspace 的 host searchText、dirty merge、单点 Replace、
  Replace All 共用 `currentCodePath()` 生成的 Current File allowedPaths；
- floating Find in Files 的 `replaceExpanded` 初始为 true；
- 持久 Find dock 仍从 compact search mode 开始，只在 replace mode 展开；
- 用户可继续使用 Replace toggle 收起 floating Replace 行。

**回归**：

- 新增 round691：
  - currentFile scope normalization；
  - Scope option；
  - host allowedPaths；
  - floating Replace default；
- 更新 round631 floating/dock contract；
- 定向 round691 / 628 / 630 / 631 / 633 / 644 / 651 /
  static-order：**39 pass / 0 fail**。

**运行态证据**：

- Ego Browser / 隔离 r526：
  - `Cmd+Shift+F` 初始 Replace 输入可见；
  - Scope 下拉含 `Current File`；
  - active file 为 `src/nav-main.js`；
  - query=`TerminalHub` 时只返回 2 matches in 1 file；
  - 结果两行都来自 `nav-main.js`，无 nav-target.js 命中。

## 2026-11-16 — Project 默认三层目录预取

**作用域**：Project 首次加载、目录点击、children 缓存、
expanded 状态和共享目录遍历 helper。

**用户要求**：

- 默认预加载前 3 层子目录的节点信息；
- 预加载不等于展开，后代目录仍保持 collapsed；
- 点击目录时以 clicked node 为根执行同样的预取；
- UI 只展开用户点击的目录，更深内容继续按需加载。

**实现**：

- 新增 `prefetchDirectorySubtrees()`：
  - 只返回 children 缓存；
  - 不包含 expanded；
  - 起点按第 1 层计算，默认预取 3 层；
- 新增 `PROJECT_PREFETCH_DEPTH = 3` 与
  `PROJECT_PREFETCH_VISIT_LIMIT = 200`；
- workspace 加载后从顶层目录静默预取三层，不写 expanded storage；
- `toggleDirectory()`：
  - 刷新 clicked directory；
  - 以 clicked path 为起点继续预取三层；
  - 只把 clicked path 加入 expanded；
  - Compact Directories 会把同一视觉单链路径视作一个节点；
- `expandDirectorySubtrees()` 继续只服务 Expand Selected / Expand All；
- flattenRows 的 iterative DFS、cycle guard 和 depth/row cap 保持不变。

**回归**：

- 新增 round690：
  - prefetch 精确读取 3 层；
  - prefetch 返回值没有 expanded；
  - clicked directory anchored prefetch；
  - startup prefetch 不修改可见 expanded；
  - compact chain 仍作为单一视觉节点；
- 更新 round206 compact-chain 契约；
- 定向 round690 / 327 / 206 / 27 / 688：
  **36 pass / 0 fail**；
- 全量 `npm test`：**2281 pass / 0 fail**；
- `npm run check:client-build`：17 modules verified；
- `node --check` 与 `git diff --check` 通过。

**运行态证据**：

- Ego Browser / 隔离 r526 创建
  `depth1/depth2/depth3/depth4` 临时链：
  - 首次打开只有 depth1/docs/src 等顶层 row；
  - depth1 保持 `aria-expanded=false`，三层后代没有出现在 UI；
  - 点击 depth1 后只展开 depth1，depth2 仍为 collapsed；
  - expanded 只新增 `depth1`；
  - 无 alert、无栈溢出。

## 2026-11-16 — Focused 文件 Tab 的 Go to Line/Column

**作用域**：Editor 文件 tab、左侧/右侧 Monaco、`⌘/Ctrl+L`
行列跳转浮层。

**用户要求**：

- focused 的文件 tab 中按 `⌘L` 打开行列输入框；
- 输入行或 `行:列` 后跳到对应编辑器位置；
- 交互参考 IDEA：Enter 跳转、Esc 关闭、非法输入可继续修正。

**根因 / 缺口**：

- `⌘L` 只存在于 Monaco action，焦点在 tab DOM 时不触发；
- 文件 tab 没有 `role="tab"` / `tabIndex`，不存在真正的 focused tab；
- 原 Go to Line 是插入文档流的 30px bar，会推动编辑器；
- invalid 输入会关闭输入条并复用“名称不能含斜杠”的错误。

**实现**：

- 新增 `parseGotoLinePosition()`：
  - 接受 `12`、`12:7`、`12,7`；
  - 行列必须为从 1 开始的安全整数；
- 新增 `gotoLineShortcutMatches()`，只匹配无 Alt/Shift 的
  `⌘/Ctrl+L`；
- 左右文件 tab 增加 `role="tab"`、`aria-selected`、
  active-tab roving `tabIndex` 和 focus-visible；
- tab 自身及 Editor workspace 捕获快捷键；Terminal、Diff、
  Find dock、Search Everywhere 保持自己的键盘域；
- `gotoState` 保存目标 `path` 与 `pane`，不再依赖随后变化的
  `focusedEditorRef`；
- Go to Line/Column 改为绝对定位浮层，不改变编辑器布局；
- 非法输入保留浮层、标记 `aria-invalid`、显示 alert 并选中输入；
- Enter 复用 `revealLines(path,line,column,pane)`，Esc 关闭并
  回焦对应 Monaco。

**回归**：

- 新增 round689 覆盖 parser、快捷键、tab 可聚焦、
  popup 语义、目标 path/pane 和 invalid 保留；
- 更新 round331 的 focused reveal 与 commit 契约；
- 定向 round689 / 331 / 329 / editor-round16 / round148 /
  static-order：**36 pass / 0 fail**；
- 全量 `npm test`：**2273 pass / 0 fail**；
- `npm run check:client-build`：17 modules verified；
- `node --check` 与 `git diff --check` 通过。

**运行态证据**：

- Ego Browser / 隔离 r526：
  - 点击 `nav-main.js` 后 activeElement 为该 `role="tab"`；
  - `⌘L` 打开 `role="dialog"`，输入框获得焦点；
  - 输入 `3:5` 后 Enter，Monaco caret=`3:5`，状态栏同步 `3:5`；
  - `⌘L` 输入 `bad` 后 Enter，浮层保留并显示
    `Enter a valid line or line:column`；
  - Esc 关闭浮层并回焦 Monaco；
  - 页面 URL 未变成浏览器地址栏编辑状态。

## 2026-11-16 — Project 树递归栈溢出

**作用域**：Editor Project view 的 `flattenRows()`、异常
`children` / `expanded` 数据和 React workspace error boundary。

**症状 / 原始错误**：

- `RangeError: Maximum call stack size exceeded`；
- 调用链在 `append -> Array.forEach -> append` 之间反复递归；
- 随后触发 `dsh-editor: workspace render failed`，整个 Editor
  surface 被 error boundary 替换。

**根因**：

- `flattenRows()` 使用函数递归展开目录；
- 如果 children 数据出现自身/祖先环，或 expanded 中存在超深路径，
  递归没有 visited、深度和总行数 guard；
- 该异常发生在 React render 期间，不能依赖运行后恢复。

**修复**：

- 将递归 `append()` 改为显式 DFS frame 栈；
- frame 保存 `depth`、祖先 `continues`、`pathTrace` 和手动排序位置；
- 子目录路径命中自身祖先链时跳过重复行，阻断 self/ancestor cycle；
- 最大展开深度 128，总行数上限 20000；
- 保留原排序、Compact Directories、空目录 placeholder、
  `depth` / `continues`、键盘和 A11y 数据契约。

**回归**：

- 新增 round688：
  - self-cycle 不再栈溢出；
  - 间接 ancestor cycle 被截断；
  - 300 层 chain 输出有界；
  - sibling + Compact Directory 输出保持稳定；
- RED：round688 初始 **1 pass / 3 fail**，两个 cycle 均复现
  `Maximum call stack size exceeded`；
- 定向 round688 / 27 / 132 / 206 / 242 / 272 / 562 / 664：
  **36 pass / 0 fail**；
- 全量 `npm test`：**2268 pass / 0 fail**；
- `npm run check:client-build`：17 modules verified；
- `node --check` 与 `git diff --check` 通过。

**同页 manifest 401 边界**：

- `http://192.168.2.172:3081/manifest.webmanifest` 返回 401，
  是 DSH Pocket 登录保护层在静态资源之前拦截；
- 该请求由浏览器在插件加载前后独立发出，`dsh-editor`
  客户端无法修改已经发生的 401；
- 正确 host 修复是让 `/manifest.webmanifest`（连同 favicon）
  通过未认证静态 allowlist，再交给 web frontend 的
  `serveWebDocument`；当前工作区没有 DSH Pocket host 源码，
  因此本轮不在插件里添加无效 workaround。

## 2026-11-16 — 声明跳转与编辑器 Back / Forward 历史

**作用域**：Editor 的 Go to Declaration、跨文件 import 定位、
多语言声明识别，以及 `⌘[ / ⌘]` 编辑位置导航历史。

**用户要求**：

- 点击 `TerminalHub` 时从
  `import { TerminalHub, encodeSse } from './terminal.js';`
  跳到 `terminal.js` 的 class 声明；
- 其他语言的函数、方法和类型也应类似解析；
- 跳转后 `⌘[` 后退、`⌘]` 前进，类似浏览器或 IDEA Back / Forward。

**实现**：

- JS/TS 命名 import、alias、default、namespace、CommonJS 和
  Python import 继续精确解析目标模块；
- 声明 regex 扩展到：
  JS/TS class method、Java/Kotlin/C#/Scala/Dart method、
  Swift function、C/C++ function/type、Go/Rust/PHP/Ruby/Shell；
- 工作区搜索回退增加 `symbol(` 查询，再由
  `findDefinitionInText()` 二次确认真实声明，覆盖自定义返回类型；
- 新增 `normalizeNavigationLocation()`、
  `navigationHistoryRecord()`、`navigationHistoryStep()`：
  - 新导航清空 forward；
  - back / forward 互相搬运当前位置；
  - 历史上限 200；
- `openFileAtLocation()` 统一记录来源；声明跳转传入实际点击
  `{path,line,column}`；
- 两个 Monaco editor group 均注册：
  `⌘[ / Ctrl+[` Back，`⌘] / Ctrl+]` Forward；
- `navigationCurrentLocationRef` 保持最近一次真实导航目标，
  避免异步 model 绑定期间读取到默认 `1:1`；
- 文件定位改用 `pendingReveal`，只在目标 model 已绑定后设置
  selection，修复“文件切换成功但光标落在第 1 行第 1 列”的竞态。

**回归**：

- round685 增加 Java 自定义返回类型、JS class method、C function、
  Swift function 和工作区回退确认；
- 新增 round687 覆盖历史栈、清空 forward、边界、快捷键、
  来源记录和历史遍历不递归；
- 更新 round530 / 545 / 547 / 548 / 671 的旧数量和模块清单；
- 定向 round685 / 687 / 530 / 545 / 547 / 548 / 671 /
  static-order：**38 pass / 0 fail**；
- 全量 `npm test`：**2264 pass / 0 fail**；
- `npm run check:client-build`：17 modules verified；
- `node --check` 与 `git diff --check` 通过。

**运行态证据**：

- Ego Browser / 隔离 r526：
  - `⌘+点击 TerminalHub` 后打开 `src/nav-target.js`，
    caret=`1:14`，落在 class `TerminalHub`；
  - `⌘[` 回到 `src/nav-main.js` 原点击位置 `1:11`；
  - `⌘]` 再回到 `src/nav-target.js` `1:14`；
  - `⌘+点击 encodeSse` 定位 function 声明 `7:17`；
  - 三次跳转后焦点均保持在 Monaco；
  - 无 alert / status 错误。

## 2026-11-16 — 状态栏路径前移与点击复制

**作用域**：Editor 底部状态栏、中文 locale、状态路径按钮和
剪贴板反馈。

**本轮最终行为**：

- 行列使用纯 `row:column`，中文和英文都不再附带“行 / 列”或
  `Ln / Col` 单位；
- 状态栏顺序固定为 `行列 → UTF-8 → 总行数 → 绝对路径 → 选区 → 操作`；
- 绝对路径改为原生 `button`，保留完整 `title`、
  `data-dsh-editor-status-path`、可见 hover/focus 状态和键盘激活；
- 点击成功后通过既有 transient status notice 显示精确文案
  `已复制`，失败显示 `浏览器拒绝了剪贴板写入`；
- 新增 `statusPathCopied` / `copyStatusPath` 双语文案，
  round114 将 `{line}:{column}` 视为语言中立的占位格式。

**回归**：

- 更新 round684，锁定中文 `{line}:{column}` 不再含单位；
- 新增 round686，锁定编码/行数位于路径前、路径按钮、
  clipboard 调用、精确 toast 和 hover/focus 契约；
- 定向 round114 / 684 / 686 / editor-round14 / editor-round16 /
  round148 / round676：**35 pass / 0 fail**；
- `node scripts/build-client.mjs`：17 modules；
- `git diff --check` 通过。

**运行态证据与边界**：

- Ego Browser / 隔离 r526 刷新后实际显示
  `1:1`、`UTF-8`、`10 lines`、绝对路径，顺序符合要求；
- 路径元素为带 `Copy path: <absolute>` 可访问名称的按钮；
- Ego 对随后用于回读的 `navigator.clipboard.readText()` 弹出
  浏览器剪贴板权限提示，因此本轮未完成 clipboard read-back；
  点击写入逻辑由 round686 契约覆盖；
- 全量测试为 **2252 pass / 6 fail**；6 项均为本任务之前已存在的
  round548 / round671 / round685 未完成契约，不属于本次状态栏改动。

## 2026-11-16 — 压缩文件路径栏与编辑器状态栏

**作用域**：Editor 文件 tabs、tabs 下方导航路径、状态栏、Markdown
模式切换和 Project 打开文件后的焦点归属。

**用户要求**：

- 删除文件内容上方单独的全路径/导航路径行；
- 绝对路径显示在状态栏行列之后；
- 行列使用 `行:列` 紧凑形式；
- 移除 `␣N`、`LF`、`Saved/Unsaved` 状态文字。

**实现**：

- 删除 breadcrumb render 与对应样式；
- 状态栏顺序改为 `行:列`、绝对路径、编码、行数；
- 中文 locale 使用 `{line}行:{column}列`，英文使用 `{line}:{column}`；
- 状态路径保留完整 `title` 和 `data-dsh-editor-status-path`；
- Markdown 模式切换迁移到 tabs 右侧 sticky 尾区，避免额外占一行；
- 状态文件改为“右侧 split 聚焦时取 split，否则取 active 文件”，
  防止 Project 打开新文件但焦点仍在树上时继续显示旧路径。

**运行态证据**：

- Ego Browser / 隔离 r526：
  - `Navigation path` 数量为 0；
  - `app.js` 状态栏显示 `1:1` 和绝对路径；
  - 切到 `README.md` 后路径同步更新；
  - 无 `␣N`、`LF`、`Saved/Unsaved`；
  - Markdown 三模式按钮在 tab strip 内可见；
  - 无 alert。

**回归**：

- 新增 round684，锁定状态栏路径顺序、路径行移除、紧凑 locale 和
  状态项删除；
- 更新 round332 的 split 焦点表达式；
- 更新 round59 tab strip 溢出断言覆盖新增 sticky 尾区。

**验证**：

```bash
npm run build:client
node --test tests/round684.test.mjs tests/editor-round14.test.mjs \
  tests/editor-round16.test.mjs tests/round148.test.mjs \
  tests/round676.test.mjs
git diff --check
```

- RED：round684 初始 **0 pass / 4 fail**；
- 定向：**28 pass / 0 fail**；
- 全量：**2246 pass / 0 fail**；
- 构建检查：16 modules verified。

## 2026-11-16 — Search Everywhere 零结果仍可转入 Find dock

**作用域**：Search Everywhere 的
`Open in Find Tool Window` 入口、零结果 handoff 和底部 Find dock。

**症状 / 根因**：

- 入口曾把 `fileMatches.length === 0` 也作为禁用条件；
- 这与 IDEA 不一致：非空 query 即使没有 Files/Text 结果，仍允许将查询
  转入持久 Find 工具窗；只有空 query 才应禁用。

**修复**：

- 禁用条件收窄为 `effectiveQuery === ''`；
- 零结果 handoff 继续传递原 query、搜索选项和空 `files` / `matches`；
- round683 锁定该条件，round467 / round488 同步更新。

**运行态证据**：

- IDEA CUA：输入不存在的非空 query 时入口可用，清空后才禁用；
- Ego Browser / 隔离 r526：
  - `r683_no_such_symbol_zzzz` 显示 `No matches`；
  - Open in Find Tool Window `disabled=false`；
  - 点击后 dock query 完全一致，active row 为 0；
  - layout=`split`，Preview 显示选择左侧结果提示，无 alert。

**验证**：

```bash
node --test tests/round683.test.mjs tests/round488.test.mjs \
  tests/round467.test.mjs tests/round500.test.mjs \
  tests/round501.test.mjs tests/round635.test.mjs
npm run check:client-build
git diff --check
```

- 定向：**24 pass / 0 fail**；
- 全量：**2242 pass / 0 fail**；
- 构建检查：16 modules verified。

## 2026-11-16 — 补齐文件名与扩展名语言着色映射

**作用域**：Monaco 编辑器、Diff、Search Preview 共用的
`languageFor()` / `safeLanguage()`。

**症状 / 根因**：

- `.mjs` 和 `.yml` 已有扩展名映射，但 `Cargo.lock`、`deno.lock`
  仅按 `lock` 扩展名解析，最终落到 plaintext；
- 特殊完整文件名、dotfile 和多种常见格式没有统一映射。

**修复**：

- 新增大小写不敏感的 `LANGUAGE_BY_FILENAME`；
- 明确：
  - `Cargo.lock -> yaml`；
  - `deno.lock -> json`；
  - Dockerfile/Containerfile、Gemfile/Rakefile/Podfile、
    go.mod/go.sum、常见 lock 和 rc 文件；
- `.env.*` 映射 INI；`Dockerfile.*` / `Containerfile.*` 映射 Dockerfile；
- 扩展映射补充 JSON5/JSONL/NDJSON/GeoJSON、GraphQL、Protobuf、
  HCL/Terraform、Solidity、reStructuredText、F#、Scala、Clojure、
  Elixir、Julia、CoffeeScript、Liquid、Handlebars、Pug、Razor、
  Tcl、VB、Pascal、Perl、BAT/CMD 等；
- MDX 改用 Monaco 原生 `mdx` language id；
- `safeLanguage()` 继续确保 Monaco 不支持的语言安全回退 plaintext。

**运行态证据**：

- Ego Browser / 隔离 r526：
  - `Cargo.lock` model language=`yaml`；
  - `deno.lock`=`json`；
  - `r682-config.YML`=`yaml`；
  - `r682-module.MJS`=`javascript`；
- 无 alert。

**验证**：

```bash
node --test tests/round682.test.mjs tests/round375.test.mjs \
  tests/round671.test.mjs
npm run build:client
```

- RED：round682 初始 **1 fail**；
- 定向：**9 pass / 0 fail**；
- 全量：**2240 pass / 0 fail**；
- 构建检查：16 modules verified。

## 2026-11-16 — 移除 Project 树 L 形缩进拐角

**作用域**：Editor Project tree 的缩进 guide，尤其是
`src/client/*.js` 这类深层文件行。

**症状 / 根因**：

- 子树最后一项被 `guideKind()` 标记为 `corner`；
- renderer 用 `indentGuideCorner` 同时绘制左边线和底部短线，形成 `└`；
- 深层目录文件最明显，看起来像文件左侧多了一个 `L` 图标。

**修复**：

- `guideKind()` 对最后一项返回 `none`；
- renderer 只保留 `indentGuide` 与 `indentGuideStop`；
- 删除 `indentGuideCorner` 样式，保留 14px 占位以维持层级对齐；
- round133 / round139 更新为禁止 elbow，round681 锁定该反馈。

**运行态证据**：

- fixture 中展开 `src/client/sample.js` 后：
  - guide `borderLeft: 1px`；
  - `borderBottom: 0px`；
  - `borderBottomLeftRadius: 0px`；
- JS 文件图标、名称和选中态正常，无 alert。

**验证**：

```bash
node --test tests/round681.test.mjs tests/round133.test.mjs \
  tests/round139.test.mjs
npm run build:client
```

- RED：round681 初始 **1 fail**；
- 全量：**2237 pass / 0 fail**；
- 构建检查：16 modules verified。

## 2026-11-16 — Project 顶层多选移动与删除保护

**作用域**：Project Files 顶层多选、F6 Move to…、批量 Delete 与
未保存 Editor tab。

**运行态证据**：

- 隔离 r526 顶层 `r680-a.txt`、`r680-b.txt` 与 `r680-dest`；
- Meta 多选两个文件后 F6 选择 `r680-dest`，两个文件都移动到该目录；
- 打开 `r680-dest/r680-a.txt` 并写入未保存内容；
- 多选两项 Delete：
  - 第一个确认显示 2 个选中项；
  - 第二个确认点名 dirty 文件；
  - 取消 dirty 确认后文件和 dirty tab 都保留；
- 无 alert；临时目录已清理。

**结论**：现有批量规划、move picker、dirty 二次确认顺序正确，本轮
不需要产品代码修改。对应契约由 round27 / round51 / round64 /
round113 覆盖。

**当前全量**：**2236 pass / 0 fail**。

## 2026-11-16 — 深色 tab close 焦点态与中键关闭

**作用域**：Editor 文件 tab close 控件、深色主题 media emulation 与
中键关闭。

**验证结论**：

- 新 Ego Page 首次导航前固定 `prefers-color-scheme: dark`，主题不会被
  reload 丢失；
- 深色 tab strip 与 focus 背景均为 `rgb(53, 54, 56)`；
- focus 边框 `rgba(255, 255, 255, 0.16)`，前景
  `rgb(249, 250, 251)`，圆角 `5px`；
- close 控件可通过键盘进入 `:focus-visible`；
- 中键点击 notes close 后 open list 从
  `src/app.js|docs/notes.md` 变为 `src/app.js`，无 alert。

**回归**：

- round679 锁定 focus CSS 必须使用宿主 alias token，并锁定文件 tab
  中键关闭只调用 `closeFile(file.path)`；
- round676 / round334 继续覆盖尺寸、焦点背景和右组中键关闭。

**验证**：

```bash
node --test tests/round679.test.mjs tests/round676.test.mjs \
  tests/round334.test.mjs
npm test
npm run check:client-build
git diff --check
```

- 定向：**8 pass / 0 fail**；
- 全量：**2236 pass / 0 fail**；
- 构建检查：16 modules verified。

## 2026-11-16 — Replace All 零结果后的 Find dock 状态

**作用域**：Replace in Files 成功后零结果、Open in Find Window 与底部
Find dock。

**验证结论**：

- 隔离 r526 中将两处 `R678_TOKEN` 全量替换为 `R678_DONE`；
- replacement 不再匹配 query 后 popup 显示 `0 matches in 0 files`；
- 非空 query 的 `Open in Find Window` 保持可用；
- 交接后 dock 保留 query/replacement，使用左右 split，active row 为 0，
  结果区显示 `No matches`，Preview 提示选择左侧结果；
- 无 alert。

**边界**：

- 本轮为行为审计，没有新增产品代码；
- 深色主题 tab focus 的 reload/emulation 时序不稳定，另行复核。

**验证**：

```bash
npm test
npm run build:client
```

- 当前全量：**2234 pass / 0 fail**；
- `build:client` 的 postbuild hook 已实跑通过。

## 2026-11-16 — build:client 自动触发完整回归

**作用域**：`package.json` 的浏览器客户端构建脚本与回归入口。

**症状 / 根因**：

- `build:client` 只生成 `lib/client.js`，不会自动验证生成后的插件；
- 仅执行构建成功无法发现静态契约、宿主 API 或 UI 行为回归；
- 开发者可能忘记在提交前再次运行 `npm test`。

**修复 / 固化**：

- 增加 npm 生命周期 hook：
  `postbuild:client: npm test`；
- `npm run build:client` 先生成 16 个模块的单产物，成功后自动运行完整
  `node --test --test-concurrency=1 "tests/*.test.mjs"`；
- 构建或任一测试失败都会使整个命令返回非零；
- `check:client-build` 仍只验证生成产物是否最新，保持快速检查语义；
- round677 锁定 build、postbuild 与 test 三条脚本契约。

**验证**：

```bash
node --test tests/round677.test.mjs
npm run build:client
```

- RED：round677 初始 **1 fail / 0 pass**；
- 实际 hook 链：
  - `build-client: 16 modules -> lib/client.js`；
  - `postbuild:client` -> `npm test`；
  - **2234 pass / 0 fail**；
- 第二次完整 hook 验证退出码为 **0**。

## 2026-11-16 — 文件 tab 关闭焦点态与新文件置顶

**作用域**：Editor 文件 tab strip、Diff tab、右侧 Split tab，以及
Project View 的 Open Files 顺序。

**症状 / 根因**：

- tab 关闭按钮只有 13px 字号与 2px 横向 padding，命中区过小；
- 内联样式背景透明，普通 CSS 焦点规则无法覆盖，键盘聚焦没有可见圆角态；
- 新文件使用 `[...current, file]` 追加，新 tab 和 Open Files 菜单项落在末尾。

**修复 / 固化**：

- `tabClose` 改为 `20×20`、`inline-flex`、`borderRadius: 5`，
  X 字号 15；
- 文件/Diff/Split 三类编辑器 tab 共用
  `dsh-editor-tab-close` class；
- hover 与 `:focus-visible` 使用 `!important` 覆盖内联透明背景，
  显示圆角背景、边框和高对比前景；
- 新打开文件改为 `[file, ...current]`；重新打开已存在文件仍只聚焦，
  不改变已有 tab 顺序；
- Open Files 继续直接投影 `openFiles` 顺序，因此与新 tab strip 一致。

**运行态证据**：

- Ego Browser / 隔离 r526：
  - 依次打开 README、notes、app 后，
    open list 为 `src/app.js|docs/notes.md|README.md`；
  - Project View `Open Files` 显示 `app.js / notes.md / README.md`；
  - close button 实际 `20×20`，圆角 `5px`；
  - 键盘聚焦后 `:focus-visible=true`，背景
    `rgb(241, 243, 245)`，边框 `rgba(0, 0, 0, 0.12)`；
  - 无 alert。

**验证**：

```bash
node --test tests/round676.test.mjs tests/round46.test.mjs \
  tests/round379.test.mjs tests/round314.test.mjs \
  tests/round333.test.mjs tests/round334.test.mjs \
  tests/round59.test.mjs tests/round659.test.mjs
npm test
npm run check:client-build
node --check lib/client.js
node --check lib/index.js
node --check lib/terminal.js
git diff --check
```

- RED：round676 初始 **2 fail / 0 pass**；
- 定向：**33 pass / 0 fail**；
- 全量：**2233 pass / 0 fail**；
- 构建检查：16 modules verified。

## 2026-11-16 — 单处 Replace 后推进 active result

**作用域**：Find in Files 的单一 `Replace`、自动重搜与 active result /
Preview 生命周期。

**症状 / 根因**：

- 单处 Replace 成功后只递增 `searchGeneration` 并保留当前索引；
- 当 replacement 仍包含原 query 时，重新搜索会把刚插入的文本作为同一
  row key 再次排在原位置；
- 因而 active row 与 Preview 停在刚替换的匹配上，没有推进到下一处。

**修复 / 固化**：

- 新增 `findToolReplaceAdvanceIndex()`：
  - 新结果中仍存在被替换 row key 时选择下一条并循环；
  - 被替换 row 不再匹配时使用原 index，自然落到下一条原始结果；
  - 空列表和非法 index 安全收敛；
- 单处 Replace 保存被替换 row key，并递增
  `replaceAdvanceRevision`；
- FindToolWindow 等待目标 generation 完成且退出 loading 后只消费一次
  advance request；
- round675 使用纯函数与静态契约覆盖推进、消失、末尾循环和空结果。

**运行态证据**：

- 隔离 r526 `r675-single.txt`：
  - 初始两处 `R675_TOKEN`；
  - single Replace 后第一行变为 `R675_TOKEN_NEXT one`；
  - active row 从第一行推进到第二行 `R675_TOKEN two`；
  - Preview 同步显示两行替换后内容；
  - replacement 输入继续持焦，无 alert；
  - 临时文件已删除，fixture 仅保留既有 `M README.md`。

**验证**：

```bash
node --test tests/round675.test.mjs tests/round674.test.mjs \
  tests/round673.test.mjs tests/round666.test.mjs \
  tests/round661.test.mjs tests/round654.test.mjs \
  tests/round653.test.mjs tests/round647.test.mjs
npm test
npm run check:client-build
node --check lib/client.js
node --check lib/index.js
node --check lib/terminal.js
git diff --check
```

- RED：round675 初始 **1 fail**；
- 定向：**17 pass / 0 fail**；
- 全量：**2231 pass / 0 fail**；
- 构建检查：16 modules verified。

## 2026-11-16 — Find 窗口零结果交接与取消替换焦点

**作用域**：`Cmd+Shift+F` Find in Files、Persistent Find dock、
Search Everywhere Replace 的确认取消与工具窗交接。

**症状 / 根因**：

- DSH 以 result row 数量禁用 `Open in Find Window`，但 IDEA 对非空
  query 的零结果仍允许把查询和空结果交接到 Find 窗口；只有空 query
  才禁用；
- Replace All 取消确认后仅释放写锁，焦点留在动作按钮；IDEA 的连续
  替换流应回到 replacement 输入；
- Search Everywhere 原先没有 replacement input ref，无法响应取消后的
  焦点恢复。

**修复 / 固化**：

- Find in Files 的 Open in Find Window 改为只校验
  `hasFindToolContentQuery(query)`；空 query 显示专用 tooltip；
- popup Replace All 取消时递增 `replaceFocusRequest`，沿用现有
  replacement focus effect；
- Search Everywhere 新增 replacement ref、`replaceFocusRequest`
  effect 和取消路径，不重建 query/results；
- round674 锁定零结果交接、两条取消焦点路径与 replacement ref；
  round488 / round635 更新旧的结果数量禁用契约。

**运行态证据**：

- IDEA CUA：
  - 非空零结果查询时 `Open in Find Window` enabled，
    `Replace All / Replace` disabled；
  - 空查询时 `Open in Find Window` disabled；
  - 查询恢复为 `dsh-editor`，真实项目未替换。
- Ego Browser / 隔离 r526：
  - `R674_NO_SUCH_TOKEN` 以 `0 matches in 0 files` 交接到底部 dock，
    query 保持，左右 split 与空 Preview 正常；
  - 取消 `Scoped -> ScopedNoWrite` 后，activeElement 为
    `Replace in files with…`，query/replacement/结果均保持；
  - `r674-lifecycle.txt` Replace All 后自动重搜 2 条结果，
    Open in Find Window 保留 query、replacement、active row 与 Preview；
  - 无 alert；临时文件已删除，fixture 仅保留既有 `M README.md`。

**验证**：

```bash
node --test tests/round674.test.mjs tests/round635.test.mjs \
  tests/round488.test.mjs tests/round673.test.mjs \
  tests/round647.test.mjs tests/round646.test.mjs \
  tests/round653.test.mjs tests/round654.test.mjs \
  tests/round661.test.mjs tests/round666.test.mjs
npm test
npm run check:client-build
node --check lib/client.js
node --check lib/index.js
node --check lib/terminal.js
git diff --check
```

- RED：round674 初始 **3 fail / 0 pass**；
- 定向：**19 pass / 0 fail**；
- 全量：**2228 pass / 0 fail**；
- 构建检查：16 modules verified。

## 2026-11-16 — Replace in Files 计数文案与 mixed 替换生命周期

**作用域**：`Cmd+Shift+F` Find/Replace in Files 浮层、持久 Find dock 与
单处 Replace 的确认和完成状态。

**症状 / 根因**：

- 替换确认框和完成状态直接使用 `occurrence(s) / file(s)`；
  IDEA 按实际数量显示自然单复数，单处结果和 mixed dirty/clean
  替换都不应出现占位括号；
- 三条替换路径各自拼接 `{matches, files}`，容易再次分叉。

**修复 / 固化**：

- 新增 `searchReplaceCountParams()`，统一归一化 matches/files，并从当前
  locale 选择 `occurrence / occurrences` 与 `file / files`；
- Search Everywhere Replace All、Find dock Replace All、popup
  Replace All 和单处 Replace 共用该 helper；
- 中文 locale 保留“个文件 / 处”语序，英文 locale 使用单位占位符；
- round673 同时锁定 helper 的输出和所有调用路径，round647 / round666
  更新为验证共享格式而非旧对象字面量。

**运行态证据**：

- IDEA CUA：`Replace in Files` 独立窗口具备 Search/Replace、筛选、
  Scope、Replace All/Replace 与结果 Preview；查询结束后已恢复原值；
- Ego Browser / 隔离 r526：
  - mixed dirty/clean 搜索为 `4 matches in 2 files`；
  - 确认框为 `Replace 4 occurrences in 2 files?`；
  - dirty model 与 clean 磁盘文件都正确替换，dirty sentinel 保留；
  - replacement 含原 query 时自动重搜得到 4 条新结果和 Preview；
  - 单处路径显示 `Replace 1 occurrence in 1 file?` 与
    `Replaced 1 occurrence in 1 file`；
  - 无 alert；临时 fixture 文件已删除，仅保留既有 `M README.md`。

**验证**：

```bash
node --test tests/round673.test.mjs tests/round666.test.mjs \
  tests/round661.test.mjs tests/round654.test.mjs \
  tests/round653.test.mjs tests/round647.test.mjs \
  tests/round646.test.mjs tests/round584.test.mjs \
  tests/round516.test.mjs tests/round467.test.mjs
npm test
npm run check:client-build
node --check lib/client.js
node --check lib/index.js
node --check lib/terminal.js
git diff --check
```

- RED：round673 初始 **1 fail**；
- 定向：**24 pass / 0 fail**；
- 全量：**2224 pass / 0 fail**；
- 构建检查：16 modules verified。

## 2026-11-16 — 浏览器客户端按业务拆分并保持单产物加载契约

**作用域**：`lib/client.js`、`src/client/*.js`、`scripts/build-client.mjs`、
`package.json` 的构建与打包入口。

**症状 / 根因**：

- 浏览器半长期集中为 36k 行的 `lib/client.js`，业务边界不可维护；
- 但 DSH lazy-CJS 客户端运行态只请求每个插件的一个
  `<package>/client.js`，不是 Node ESM 多模块入口；
- `lib/index.js` 是宿主半，可以正常 `import './terminal.js'`；
  这条规则不能直接套到浏览器半。

**修复 / 固化**：

- 按仓库内 `docs/dsh-gufa-code` 的既有模式，将 factory 内代码无损拆分为：
  foundation、locales、domain core、inline styles、editor core、
  UI primitives、project、menu、diff、commit、Search Everywhere、
  Find tool、terminal、editor workspace、injected CSS、controller；
- `src/client/*.js` 都在同一个 factory 作用域内执行，不写顶层
  `import/export`，共享 React 和闭包状态；
- `scripts/build-client.mjs` 使用显式模块清单固定 factory 执行顺序并生成
  `lib/client.js`；源码文件名保持语义化，不使用数字前缀；
- 构建脚本拒绝清单缺失文件和 `src/client` 中未登记的模块；
- `--check` 阻止生成产物过期；
- package 暴露 `build:client` / `check:client-build` 并随包分发源码与构建脚本；
- runtime 证据：页面只加载 combined plugin URL 中的
  `dsh-editor/client.js`；加载后 Editor、Project、Harness 和 Monaco 正常。

**验证**：

```bash
npm run build:client
npm run check:client-build
node --test tests/round671.test.mjs
npm test
node --check lib/client.js
node --check scripts/build-client.mjs
git diff --check
```

- round671：**4 pass / 0 fail**；
- 全量：**2222 pass / 0 fail**；
- 浏览器运行态：`workspace=1`、README tab 正常、Project 树正常、
  Harness active、无 alert；改名后复测仍由合并资源加载
  `dsh-editor/client.js`。

**边界**：

- `lib/index.js` 保持 ESM import 多个宿主模块；
- 浏览器 `lib/client.js` 仍是 DSH 要求生成单产物，不改成运行时多文件加载；
- 后续新增业务必须先落到 `src/client`，再重新构建。

## 2026-11-16 — Harness 激活态语义与可拖拽边界线

**作用域**：Activity Stripe 的 Harness 按钮、编辑器/聊天分隔条、
工具窗 side resize、Terminal split、底部 dock resize。

**症状 / 根因**：

- Harness 使用 `active: harnessCollapsed`，把“聊天隐藏”误画成激活亮色；
- 聊天 handle 默认透明，工具窗 handle 默认透明，Terminal split 只有
  0.5px 边框，拖拽边界不易识别。

**修复**：

- Harness 激活条件改为 `harnessCollapsed !== true`：
  - 聊天隐藏时 `aria-pressed=false`、透明背景/灰色 rail；
  - 聊天显示时 `aria-pressed=true`、亮色 active 背景；
- 聊天 handle 保持 8px 命中区，默认绘制 2px 中线；
- 工具窗 side resize 保持 5px 命中区，默认绘制 1px 中线；
- Terminal split 提升为 1px 左边界；
- dock resize 保持 6px 命中区，并绘制 1px 水平线；
- hover/drag 继续使用业务蓝色反馈。

**运行态证据**：

- Ego Browser / 隔离 r526：
  - 聊天可见：Harness `aria-pressed=true`，背景
    `rgb(255,255,255)`，标题 `Hide Harness chat`；
  - 点击隐藏：`aria-pressed=false`，背景透明，颜色
    `rgb(129,133,140)`，标题 `Show Harness chat`；
  - 再次点击：恢复 active；
  - chat handle 计算宽度 `8px`，含 2px `rgba(0,0,0,0.12)` 中线；
  - side resize 计算宽度 `5px`，含 1px 中线；
  - editor split/Terminal split 使用 1px 边界。

**回归**：

```bash
node --test tests/round667.test.mjs tests/round390.test.mjs \
  tests/round461.test.mjs tests/round397.test.mjs \
  tests/round84.test.mjs tests/round332.test.mjs \
  tests/round149.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
node --check lib/terminal.js
git diff --check
```

- RED：round667 初始 **3 fail / 0 pass**；
- 定向：**25 pass / 0 fail**；
- 全量：**2215 pass / 0 fail**。

## 2026-11-16 — Search Everywhere / Find Replace All 的 Dirty Buffer 与重搜刷新

**作用域**：Search Everywhere Replace All、`Cmd+Shift+F` Find popup、
dirty Monaco buffer、替换后搜索刷新。

**症状 / 根因**：

- 持久 Find dock 已支持 dirty model replacement；
- Search Everywhere 的 `replaceInFiles()` 仍先拒绝所有 dirty targets，
  与 IDEA 对未保存编辑器内容的替换语义不一致；
- 替换值本身仍包含原 query 时，必须重新搜索，否则结果与 Preview
  会错误地停留在旧状态。

**修复**：

- Search Everywhere 与 Find 共用 `planWorkspaceReplacements()` 按
  dirty/clean 拆分命中：
  - dirty path 使用 `editorReplaceAll()` 预检且不修改 model；
  - clean path 只提交给 host `replaceText`；
  - dirty models 通过 `commitFindToolDirtyPlans()` 一次性事务提交；
- replacement 在异步写入前固定为局部值，避免 busy 期间输入变化影响
  host 与 dirty model 的替换内容；
- 成功后同步 openFiles dirty content、Git 状态、历史与状态栏计数，
  递增 `textRevision` 触发原 query 重搜；
- 失败保留 query/replacement 并展示错误，write guard 始终释放。

**运行态证据**：

- Ego Browser / 隔离 r526：
  - 打开 `r666-refresh.txt`，Monaco model 改为未保存
    `R666_DIRTY unsaved / R666_DIRTY unsaved2`；
  - `Cmd+Shift+R` 搜索结果 2 条；
  - Replace All → `R666_DIRTY_DONE`：
    - model 立即变为 2 个 `R666_DIRTY_DONE`；
    - 结果与 Preview 自动刷新为替换后的新命中；
    - tab 保持 dirty；
    - 磁盘仍为原 `R666_TOKEN_DONE` 内容；
    - 状态栏 `Replaced 2 occurrence(s) in 1 file(s)`；
    - 无 alert；
  - 临时文件已删除，fixture 最终仅保留既有 `M README.md`。

**回归**：

```bash
node --test tests/round666.test.mjs tests/round584.test.mjs \
  tests/round670.test.mjs \
  tests/round467.test.mjs tests/round480.test.mjs \
  tests/round646.test.mjs tests/round647.test.mjs \
  tests/round653.test.mjs tests/round654.test.mjs \
  tests/round616.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
node --check lib/terminal.js
git diff --check
```

- RED：round666 初始 **2 fail / 1 pass**；
- round670 共享规划器定向：**25 pass / 0 fail**；
- 全量：**2218 pass / 0 fail**。

## 2026-11-16 — 根行移除后的项目根上下文菜单与选中态

**作用域**：Project 工具栏项目名、Project 树空白区域、项目根菜单。

**用户要求**：

- 删除重复的项目根行后，仍要保留根目录上下文菜单；
- 必须能在项目根层级新建文件/目录；
- 右键项目名时，项目名要显示 IDEA 蓝色选中背景。

**修复**：

- 项目名按钮右键、`ContextMenu`/`Shift+F10` 打开同一个根菜单；
- Project 树空白区域右键也打开根菜单，但不会清除现有树选择；
- 根菜单复用 `buildTreeMenu()`，payload 为
  `{ path: '', kind: 'directory', root: true }`，因此 New File / New
  Directory 的 `createParent` 为 `''`；
- 根菜单带 `owner: 'project-root'`；
- 菜单打开期间项目名按钮使用
  `--dsw-alias-state-business-primary` 蓝底白字，关闭后恢复。

**运行态证据**：

- Ego Browser / 隔离 r526：
  - 右键项目名时按钮背景 `rgb(65,118,230)`、文字白色；
  - `data-dsh-project-root-context-active="true"`；
  - New File / New Directory 均 enabled；
  - 树空白区域右键出现同一 17 项根菜单；
  - 点击 New File 后创建行父目录 value 为 `''`，显示项目根名称；
  - fixture 未写入新文件，最终仅保留既有 `M README.md`。

**回归**：

```bash
node --test tests/round665.test.mjs tests/round664.test.mjs \
  tests/round662.test.mjs tests/round373.test.mjs \
  tests/round76.test.mjs tests/round153.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
node --check lib/terminal.js
git diff --check
```

- RED：round665 初始 **3 fail / 0 pass**；
- 定向：**12 pass / 0 fail**；
- 全量：**2209 pass / 0 fail**。

## 2026-11-16 — Project 树移除重复的项目根行

**作用域**：Project 工具窗的文件树、名称搜索结果和三个 Project View。

**用户要求**：工具栏已经显示项目名和完整路径，树中项目根文件夹整行属于
重复信息，直接移除。

**修复**：

- `flattenRows()` 不再创建 `path: ''`、`root: true` 的合成根行；
- 真实顶层目录/文件直接使用 `depth: 0`，原有第二层从 `depth: 1` 开始；
- 空项目树直接在 `depth: 0` 显示空占位，不再额外保留根行；
- Project Speed Search 经同一 flattener 渲染，结果树也不再带根行；
- Project Files / Open Files / All Changed Files 均不再显示项目根行。

**运行态证据**：

- Ego Browser / 隔离 r526：
  - Project Files 行为 `docs / docs/notes.md / src / README.md`；
  - 根路径行数量为 `0`；
  - 顶层 `docs`、`src`、`README.md` 的 `aria-level=1`；
  - Open Files 与 All Changed Files 均只显示实际文件；
  - 工具栏仍显示根文件夹名和完整路径；
  - fixture 最终仅保留既有 `M README.md`。

**回归**：

```bash
node --test tests/round664.test.mjs tests/round662.test.mjs \
  tests/round27.test.mjs tests/round242.test.mjs \
  tests/round272.test.mjs tests/round562.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
node --check lib/terminal.js
git diff --check
```

- RED：round664 初始 **3 fail / 0 pass**；
- 定向：**27 pass / 0 fail**；
- 全量：**2206 pass / 0 fail**。

**边界**：

- 不删除工具栏中的项目名、复制路径或视图菜单；
- 不伪造新的根节点；
- 顶层目录仍可展开，子层缩进从 `depth: 1` 开始。

## 2026-11-16 — 统一代码预览 gutter、2px 间距与工具窗栏灰底

**作用域**：Monaco 编辑器、Search Everywhere Preview、Find 弹窗与
Find dock 的右侧 Preview、Project / Commit / Terminal / Harness
活动栏。

**症状 / 根因**：

- Monaco gutter 用 `border-right`，分隔线与正文直接相接，没有内容间距；
- Search Everywhere 与 Find Preview 是自定义 DOM，不经过 Monaco：
  - 正文整块使用 `bg-layer-1`；
  - 行号没有独立 gutter、分隔线和 2px 留白；
  - 内容没有语言着色；
- Activity Stripe 使用 `bg-layer-1`，当前宿主浅色主题下接近白色。

**修复 / 固化**：

- 在 `[data-dsh-editor-gutter-surface="idea"]` 下定义共享变量：
  `--dsh-editor-gutter-fill`、`--dsh-editor-gutter-divider`、
  `--dsh-editor-content-fill`、`--dsh-editor-gutter-gap: 2px`；
- Monaco `.margin` 改用共享背景渐变：灰 gutter → 1px 分隔线 →
  2px 正文底色留白；
- Search Everywhere 与 Find Preview 共用
  `dsh-editor-code-preview*` class，复用相同 gutter/divider/gap/正文底色；
- 预览复用 `monaco.editor.colorize()` 和当前 Monaco theme 做语法着色，
  不再维护第二套语言配色；
- Find 命中高亮在 colorize 后通过 DOM Range 标成
  `dsh-editor-code-preview-match`，保持原搜索强调；
- Activity Stripe 背景改为与 editor tab strip 相同的
  `--dsw-alias-interactive-bg-hover-solid`。

**运行态证据**：

- Ego Browser / 隔离 r526：
  - Monaco margin 背景渐变包含
    `divider calc(100% - 3px) calc(100% - 2px)` 和
    `content-fill calc(100% - 2px)`，共享 gap 为 `2px`；
  - Find 右侧预览正文为 `rgb(255,255,255)`；
  - gutter 为 `rgb(241,243,245)`，含同一分隔线与 2px 留白；
  - Markdown 标题使用 Monaco token 色 `rgb(0,0,255)`；
  - Find 命中节点保留 `data-dsh-find-preview-match="1"`；
  - Activity Stripe 计算背景为 `rgb(241,243,245)`；
  - Find dock 仍保持左结果/右预览 split。

**回归**：

```bash
node --test tests/round663.test.mjs tests/round659.test.mjs \
  tests/round658.test.mjs tests/round639.test.mjs \
  tests/round652.test.mjs tests/round465.test.mjs \
  tests/round468.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
node --check lib/terminal.js
git diff --check
```

- RED：round663 初始 **3 fail / 0 pass**；
- 定向：**21 pass / 0 fail**；
- 全量：**2203 pass / 0 fail**。

**边界**：

- 不为 Search/Find Preview 引入第二套语法解析器；
- 不为预览创建额外 Monaco editor 实例；
- Monaco、Search Preview、Find Preview 共用 gutter/divider/content 规则；
- fixture 只读验证，最终仅保留既有 `M README.md`。

## 2026-11-16 — Project 标题复制、三项视图与根行收紧

**作用域**：Project 工具窗标题、Project View 选择器、项目根行。

**用户要求**：

- 视图菜单只保留有真实数据源的 `Project Files / Open Files /
  All Changed Files`；
- 写死的 `Project:` 标题改为项目根文件夹名；
- 点击根文件夹名复制完整项目路径，悬浮显示完整路径；
- 项目根行不再显示展开/收起箭头，并利用空出的列向左收紧。

**实现**：

- `normalizeProjectView()` 只接受三项视图；旧值 `project` 及已移除视图
  迁移为 `projectFiles`；
- `projectViewDefinitions()` 删除 Packages / Production / Tests /
  Scratches 等无可信数据源的占位项；
- 标题拆成“项目名复制按钮 + 独立的视图菜单箭头”；
- 复制复用 `copySearchResultText(root, onNotify, t)`，不再另造剪贴板路径；
- 根行不渲染 chevron，单击、双击、Enter、← 也不会收起根目录；
- 根行第一个图标从原来的箭头之后开始，实测 x 坐标为面板左沿 `317`。

**运行态证据**：

- Ego Browser / 隔离 r526：
  - 菜单项仅为 `Project Files / Open Files / All Changed Files`；
  - 三项分别切换成功，树内容和视图标题同步；
  - 标题文本为 `dsh-editor-r526-fixture`；
  - `title` 为 `/private/tmp/dsh-editor-r526-fixture`；
  - 点击后系统剪贴板实测为该完整路径；
  - 根行 `chevronCount=0`，无 `Collapse folder` 按钮；
  - fixture 最终只保留既有 `M README.md`。

**回归**：

```bash
node --test tests/round662.test.mjs tests/round377.test.mjs \
  tests/round378.test.mjs tests/round82.test.mjs \
  tests/round454.test.mjs tests/round194.test.mjs \
  tests/round198.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
node --check lib/terminal.js
git diff --check
```

- RED：round662 初始 **4 fail / 0 pass**；
- 定向：**20 pass / 0 fail**；
- 全量：**2200 pass / 0 fail**。

**边界**：

- 不伪造 Packages / Production / Tests / Scratches 数据源；
- 不把“复制路径”和“打开视图菜单”合并成一个点击手势；
- 项目根目录固定展开，避免移除 chevron 后出现无法恢复的折叠状态。

## 2026-11-16 — Find 结果打开不得污染 Search Everywhere 历史

**作用域**：Find result open、Find query history、Search Everywhere
recent search、`openFindTool()` handoff。

**症状 / 根因**：

- Find 搜索本身已正确写入
  `dsh-editor.find.query.history:<root>`；
- 但双击/Enter 打开 Find result 时，`onOpen` 仍调用
  `rememberSearchEverywhereQuery(findTool.query)`；
- 运行态确认 `R660_TOKEN` 打开结果后，Search Everywhere history 首项
  从 `Scoped` 被改写为 `R660_TOKEN`，两个历史源重新串流；
- `openFindTool()` 另用 `query.trim()`，内部 handoff 仍可能丢首尾空白。

**修复 / 固化**：

- 删除 Find result open 对 Search Everywhere history 的写入；
- Find query 只由 `dsh-editor.find.query.history:<root>` 记录；
- Search Everywhere 仍只通过自身 `onRememberQuery` 记录；
- `openFindTool()` 改用 `findToolContentQuery(query)`，只把非字符串归一为空；
- 新增 round660 精确 handoff 与历史所有权回归。

**运行态证据**：

- Ego Browser / 隔离 r526：
  - Find 搜索 `R660_TOKEN` 得到 `1 match in 1 file`；
  - before Search Everywhere history 20 条，首项 `Scoped`；
  - 双击 Find result 打开 `r660-token.txt` 后：
    - Search Everywhere history 20 条逐项和顺序完全不变；
    - Find history 保留 `R660_TOKEN`；
    - Find dock 保持打开；
    - 无 alert；
  - 运行前先复现了旧逻辑会污染 Search history，修复后同流程通过；
  - 临时 fixture 文件已删除，最终仅剩既有 `M README.md`。

**回归**：

```bash
node --test tests/round660.test.mjs tests/round655.test.mjs \
  tests/round656.test.mjs tests/round492.test.mjs \
  tests/round503.test.mjs tests/round590.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
node --check lib/terminal.js
git diff --check
```

- RED：round660 初始 **2 fail / 1 pass**；
- 定向：**19 pass / 0 fail**；
- 全量：**2193 pass / 0 fail**。

**已排除方案**：

- 不在 Find result open 时继续写 Search Everywhere history；
- 不让 Search Everywhere history 充当 Find 的共享查询存储；
- 不在内部 `openFindTool()` handoff 中 trim query；
- 不修改 Search Everywhere 自身已有的 query/history 语义。

## 2026-11-16 — 编辑器 tabbar / gutter 灰底与 gutter 分割线

**作用域**：Editor 文件 tab strip、右侧 split 头、Monaco line-number
gutter、repository preview、diff 两侧编辑器。

**IDEA 视觉证据**：

- CUA 截图显示 IDEA 的 editor tab bar 为灰色 strip；
- 行号 gutter 使用同层级灰底；
- gutter 与正文之间存在一条细竖分割线；
- 当前 DSH 基线实测：
  - tab strip `rgb(255,255,255)`；
  - Monaco margin `rgb(255,255,254)`；
  - margin `border-right` 为 `0px none`。

**修复**：

- `tabStrip` 和 `editorSplitHeader` 改用
  `--dsw-alias-interactive-bg-hover-solid` 灰色 surface；
- inactive tab 背景改为 `transparent`，让整条 tab bar 保持统一灰底，
  active tab 继续使用 `--dsw-alias-bg-base`；
- 新增全局 `.monaco-editor .margin` 规则：
  - 背景使用同一个灰 surface；
  - `border-right: 1px solid --dsw-alias-border-l3`；
  - `box-sizing: border-box`，不让边框改变 Monaco 计算的 gutter 宽度；
- 全局选择器覆盖主编辑器、split、repository preview 与 diff 内层编辑器。

**运行态证据**：

- Ego Browser / 隔离 r526：
  - tab strip computed background 为 `rgb(241,243,245)`；
  - active tab 保持 `rgb(255,255,255)`；
  - Monaco margin background 同为 `rgb(241,243,245)`；
  - margin computed border 为
    `1px solid rgba(0,0,0,0.12)`；
  - margin/content 边界位置相接于 `x=579`，没有横向裂纹；
  - 无 alert。
- `data-dsh-editor-gutter-surface="idea"` 可在运行态确认样式标记。

**回归**：

```bash
node --test tests/round659.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
node --check lib/terminal.js
git diff --check
```

- RED：round659 初始 **3 fail / 0 pass**；
- 定向：**3 pass / 0 fail**；
- 全量：**2190 pass / 0 fail**。

**已排除方案**：

- 不使用 `--dsw-alias-bg-layer-1`，该 token 在当前宿主实际为白色；
- 不让 inactive tab 以白色块覆盖灰色 tab bar；
- 不把 gutter 规则限定到单个编辑器实例；
- 不在 Monaco theme 中写死 light/dark 的 RGB，继续跟随宿主 alias token。

## 2026-11-16 — Find 工具窗左右结果与预览分屏

**作用域**：持久 Find tool window 的 result list、Preview Source、
单击选择、双击打开和窄 editor dock 布局。

**症状 / 根因**：

- dock 的 `previewOpen` 初始值跟随 `floating`，持久工具窗默认没有预览；
- listbox 与 Preview Source 是纵向兄弟节点，预览使用 `borderTop`；
- 行上的 `onMouseDown` 只更新 active index，不主动聚焦；
- 因此搜索结果进入 Find 工具窗后不能形成“左结果、右预览”，
  单击也没有明确的聚焦语义。

**修复 / 固化**：

- dock 默认开启 Preview Source；
- dock 内新增 `data-dsh-find-results-layout="split"` 横向容器；
- 左侧 `data-dsh-find-results-pane` 独立滚动，右侧 preview 使用左边框；
- 分屏宽度为结果自适应、预览约 46%，窄 dock 下仍同时保留两侧；
- 单击结果更新 active 并聚焦该 option，只刷新右侧预览；
- 双击或 Enter 才调用 `openFindResult()` 打开上方编辑器；
- popup 保留原纵向 stack，并继续自动预览 active hit。

**运行态证据**：

- Ego Browser / 隔离 r526：
  - `Scoped` 返回 `1 match in 1 file`，Open in Find Window 后
    `data-dsh-find-results-layout=split`；
  - 左侧结果 pane 与右侧 preview pane 同时存在，窄 editor dock 下
    实测约 `136×147px / 118×147px`；
  - 打开 dock 时仍为 `No file open`；
  - 单击 `3:1 Scoped appears here. Second end line.` 后 activeElement
    是该 option，右侧 Preview 显示 README 第 1–5 行及命中高亮；
  - 单击后仍为 `No file open`；
  - 双击同一结果后 README 文件 tab 出现，Find dock 仍保持打开，无 alert。
- IDEA CUA 对照确认持久 Find 工具窗有独立 Preview Source 控件；
  查找界面检查后已隐藏。

**回归**：

```bash
node --test tests/round658.test.mjs tests/round652.test.mjs \
  tests/round639.test.mjs tests/round638.test.mjs \
  tests/round586.test.mjs tests/round497.test.mjs \
  tests/round496.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
node --check lib/terminal.js
git diff --check
```

- RED：round658 初始 **3 fail / 1 pass**；
- 定向：**31 pass / 0 fail**；
- 全量：**2187 pass / 0 fail**。

**已排除方案**：

- 不把 list 与 preview 继续保持为上下堆叠；
- 不让 Preview Source 固定最小 220px 挤占左侧结果；
- 不在单次点击时调用 openFindResult；
- 不为 dock 与 popup 拆出第二套结果导航或预览实现。

## 2026-11-16 — Find 在途请求与 Workspace 切换隔离

**作用域**：Find in Files 异步 `searchText`、workspace 切换、
Find query history、过期成功/失败响应。

**症状 / 根因**：

- workspace root effect 会关闭 Find 并加载新项目的明确历史；
- 但 Find 搜索成功后在状态更新之外执行 `rememberCurrentFindQuery()`；
- root 切换时没有立即递增 `findToolRequestRef`，旧响应仍可通过原有
  requestId 检查；
- `setFindTool(current => current === null ? current : ...)` 虽不会重开
  已关闭 UI，随后 history 写入却使用新的 `rootRef.current`，旧项目 query
  可能进入新项目历史；
- 只比较 requestId 不能表达“请求发起后 workspace 已改变”。

**修复 / 固化**：

- 新增 `findToolRequestIsCurrent()`，同时比较 requestId 与 workspace root；
- Find search 在 I/O 前捕获 `requestRoot`，success/catch 均通过该 helper
  校验；
- workspace root effect 在 `setFindTool(null)` 前立即递增
  `findToolRequestRef.current`；
- 保持 `dsh-editor.find.query.history:<root>` 与结果、scope 的按 workspace
  边界不变。

**运行态证据**：

- Ego Browser / 隔离 r526：
  - 在 r526 workspace 发起 `R657_SLOW` 搜索，并用页面 fetch 延迟 1500ms；
  - 请求已开始后切换到无会话的 r657 workspace；
  - 切换后 Find popup 关闭，按钮 workspace 显示 `r657-fixture`；
  - r526 history 保持 `R657_SLOW`，r657 history 为空；
  - 没有 alert；
- 随后在 r657 正常搜索 `R657_ALPHA`：
  - 返回 `1 match in 1 file`；
  - r657 history 只新增 `R657_ALPHA`；
  - r526 history 没有新增该 query；
- 临时第二 workspace、测试文件和 workspace storage 注入均已清理；
  r526 fixture 最终仅保留既有 `M README.md`。

**回归**：

```bash
node --test tests/round657.test.mjs tests/round656.test.mjs \
  tests/round655.test.mjs tests/round650.test.mjs \
  tests/round648.test.mjs tests/round627.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
node --check lib/terminal.js
git diff --check
```

- RED：round657 初始 **3 fail**；
- 定向：**19 pass / 0 fail**；
- 全量：**2183 pass / 0 fail**。

**已排除方案**：

- 不只比较 requestId 而忽略 workspace root；
- 不在 root effect 中等待旧响应自行收敛；
- 不让旧搜索的 success 路径在任何情况下写入新 workspace history；
- 不复用 Search Everywhere 的 request ref 或历史键代替 Find 的边界。

## 2026-11-16 — Replacement History 保留空白与多行精确值

**作用域**：Replace in Files / Find dock 的 replacement history、
空白替换、多行替换、History replay。

**症状 / 根因**：

- Replace 输入本身支持 New Line，且可以直接执行纯空白或首尾带空白的替换；
- 但 `rememberWorkspaceReplacement()` 使用 `replacement.trim() === ''`
  作为拒绝条件，`rememberReplacementHistory()` 读取时也丢弃纯空白值；
- 运行态实际把 `R656_TOKEN` 替换成 `" \n "` 后，文件内容正确更新，
  但 `dsh-editor.replace.history:<root>` 没有出现该 replacement，
  History 无法精确重放。

**修复 / 固化**：

- 新增 `normalizeReplacementHistoryEntry()`：只把非字符串和 `''`
  归一为空；其他值完全保留；
- `rememberReplacementHistory()` 使用该 helper 过滤、去重和截断；
- `rememberWorkspaceReplacement()` 只拒绝真正空字符串，不再 trim；
- Replace All 与单点 Replace 继续在成功后写入同一 workspace history。

**运行态证据**：

- Ego Browser / 隔离 r526：
  - 查询 `R656_TOKEN` 返回 `1 match in 1 file`；
  - 开启 Replace New Line 并输入 `" \n "`；
  - Replace All 后文件字节为 `20 0a 20 0a ...`，替换确实执行；
  - `dsh-editor.replace.history:<root>` 新增首项 `" \n "`；
  - Replace History 菜单项文本/aria-label 均为 `" \n "`；
  - 清空 replacement 后选择该历史项，输入恢复为 `" \n "`；
  - 临时 fixture 文件已删除，最终仅保留既有 `M README.md`。

**回归**：

```bash
node --test tests/round656.test.mjs tests/round655.test.mjs \
  tests/round486.test.mjs tests/round492.test.mjs \
  tests/round622.test.mjs tests/round654.test.mjs \
  tests/round653.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
node --check lib/terminal.js
git diff --check
```

- RED：Ego Browser 运行态空白 replacement 执行成功但 history 未新增；
- 定向：**23 pass / 0 fail**；
- 全量：**2180 pass / 0 fail**。

**已排除方案**：

- 不在 replacement history 中 trim 后保存；
- 不因为 `trim() === ''` 丢弃纯空白替代文本；
- 不用 query history 代替 replacement history；
- ~~不把空字符串也保留成可回放条目，空 replacement 仍由当前输入直接
  表达。~~ **已被第 711 轮修正**：IDEA CUA 证明空 replacement 是真实
  删除操作，当前实现保留空历史条目并支持 replay。

## 2026-11-16 — Find 历史精确 replay 与 Workspace 隔离

**作用域**：Find in Files / Replace in Files 的查询历史、首尾空白和换行、
History replay、workspace 切换。

**症状 / 根因**：

- Find 搜索与替换已经按原始 query 匹配，不 trim；
- 但 Find 历史复用了 Search Everywhere 的 `recentSearches`，
  `normalizeRecentSearchEntry()` 会删除首尾空格和换行；
- 因此 `\nScoped appears here.\n` 搜索成功后从 History 选择会变成
  `Scoped appears here.`，无法重放原搜索条件。

**修复 / 固化**：

- 新增 Find-only 精确历史 `normalizeFindQueryHistoryEntry()` 与
  `rememberFindQueryHistory()`；
- 按 workspace 保存到
  `dsh-editor.find.query.history:<workspace-root>`，newest-first、
  exact dedupe、最多 20 条；第 711 轮进一步允许 IDEA 可回放的空 query
  条目；
- Find 搜索、Replace All 和单点 Replace 成功后写入该历史；
  `FindToolWindow.queryHistory` 使用 `recentFindQueries`；
- workspace root effect 切换时重新加载当前项目的精确历史；
- Search Everywhere 继续使用
  `dsh-editor.search.history:<workspace-root>` 的 trim 语义。

**运行态证据**：

- Ego Browser / 隔离 r526，查询
  `\nScoped appears here. Second end line.\n`；
- 搜索返回 `1 match in 1 file`；
- `dsh-editor.find.query.history:<root>` 中保存完整原值；
- 原 Search Everywhere history 的 20 条记录完全未变化；
- 清空 query 后 History 菜单显示带首尾换行的原始条目，选择后 query
  原样恢复并重新搜索，仍为 `1 match in 1 file`；
- 无 alert，fixture 最终仅保留既有 `M README.md`。

**回归**：

```bash
node --test tests/round655.test.mjs tests/round654.test.mjs \
  tests/round650.test.mjs tests/round648.test.mjs \
  tests/round644.test.mjs tests/round620.test.mjs \
  tests/round492.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
node --check lib/terminal.js
git diff --check
```

- RED：round655 初始 **3 fail**；
- 定向：**20 pass / 0 fail**；
- 全量：**2177 pass / 0 fail**。

**已排除方案**：

- 不改变 Search Everywhere 既有 trim 历史语义来迁就 Find；
- 不复用同一个 localStorage key 混存两种不同 query 语义；
- 不在 History replay 时 trim、规范化或重写 query；
- 不把 Find 精确历史做成跨 workspace 的全局列表。

## 2026-11-16 — 多 Dirty Model 独立 Undo 与事务提交

**作用域**：Find in Files Replace All 的多个 dirty Monaco models、
active/inactive tab 切换、openFiles 同步。

**验证前状态**：

- 每个 dirty plan 原先直接在主流程中 push/edit；
- 单 model undo 已验证，但多个 model 的切换撤销、同步与后续 model
  应用失败后的回滚边界尚未固化。

**修复 / 固化**：

- 新增 `commitFindToolDirtyPlans()`：
  - 每个 dirty model 保留独立 `pushStackElement()` undo boundary；
  - 任一 model 应用失败时逆序恢复已修改 model；
  - rollback 失败追加到 primary error；
  - 成功后一次性返回 contents、paths 和 replacement count；
- `replaceInFindTool()` 只在 host 成功后调用该 helper，并用返回值统一
  更新 openFiles；
- round646/647/653 旧断言更新为新事务边界。

**运行态证据**：

- Ego Browser / 隔离 r526：
  - dirty A/B 都包含两个 `R654_TOKEN`；
  - Find 返回 `4 matches in 2 files`；
  - Replace All 后：
    - A=`R654_DONE A0-live\nR654_DONE A1-live\nUNSAVED_A\n`；
    - B=`R654_DONE B0-live\nR654_DONE B1-live\nUNSAVED_B\n`；
  - B 的 `⌘Z` 只恢复 B，A 仍为 DONE；
  - 切到 A 后 `⌘Z` 再恢复 A；
  - 两 tab 始终保持 dirty 标记，无 alert；
  - 临时 fixture 文件已删除，最终仅 `M README.md`。

**回归**：

```bash
node --test tests/round654.test.mjs tests/round653.test.mjs \
  tests/round652.test.mjs tests/round651.test.mjs \
  tests/round650.test.mjs tests/round647.test.mjs \
  tests/round646.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
node --check lib/terminal.js
git diff --check
```

- RED：round654 初始 **3 fail**；
- 定向：**22 pass / 0 fail**；
- 全量：**2174 pass / 0 fail**。

**已排除方案**：

- 不把所有 dirty models 合并成一个共享 model；
- 不在一个 undo boundary 中批量修改全部 tabs；
- 不在 host 失败时应用 dirty plans；
- 不在 dirty model 部分失败后保留前半批内存修改。

## 2026-11-16 — Replace All clean 写入事务回滚

**作用域**：host `replaceWorkspaceText()`、多 clean-file Replace All、
dirty/clean 混合写入失败。

**症状 / 风险**：

- client 已保证 host 成功后才应用 dirty model；
- host 原先逐个写入 clean targets，若第二个文件失败，第一个文件可能已经落盘；
- 这会形成“dirty 没变，但 clean 只改了一半”的部分事务。

**修复**：

- staged replacement 保存 `originalContent`；
- 新增 `commitWorkspaceReplacements()`：
  - 顺序写入所有 staged targets；
  - 任一写入失败时逆序恢复所有 attempted files；
  - 若 rollback 自身失败，在 primary error 后追加失败路径并保留
    `rollbackFailures` 元数据；
- `replaceWorkspaceText()` 的最终写入统一走该事务 helper；
- dirty Monaco model 仍只由 client 在 host 成功后应用。

**运行态证据**：

- Ego Browser / 隔离 r526：
  - 打开 `dirty-r653.txt`，live model 为
    `R653_TOKEN dirty-live\nUNSAVED_R653_SENTINEL\n`；
  - clean-a、clean-b、dirty 共 `3 matches in 3 files`；
  - 搜索后外部修改 clean-b 并推进 mtime；
  - Replace All 确认后 error 为
    `the file changed on disk since it was searched: clean-r653-b.txt`；
  - clean-a 仍为原内容，clean-b 保持外部内容；
  - dirty model 完全未变化；
  - query、3 条结果、replacement=`R653_DONE` 和 replacement 焦点保持；
  - 临时 fixture 文件已删除，最终仅 `M README.md`。

**回归**：

```bash
node --test tests/round653.test.mjs tests/round652.test.mjs \
  tests/round651.test.mjs tests/round650.test.mjs \
  tests/round647.test.mjs tests/round646.test.mjs \
  tests/git-operations.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
node --check lib/terminal.js
git diff --check
```

- RED：round653 因缺少 helper 导出初始失败；
- 定向：**30 pass / 0 fail**；
- 全量：**2171 pass / 0 fail**。

**已排除方案**：

- 不只依赖“先 host、后 dirty”的顺序而忽略 clean 内部部分写入；
- 不在失败时删除或重建用户文件；
- 不让 rollback failure 覆盖 primary failure；
- 不在 host 失败后应用任何 dirty model plan。

## 2026-11-16 — Find Preview 命中区间高亮

**作用域**：Find in Files Source Preview、单行/跨行 query、Regex、
Preview 行号与 active line。

**症状 / 根因**：

- IDEA Preview 会标记实际 query 命中；
- DSH 原先只给 active result 的起始行加整行背景，代码文本仍是单个普通
  span；
- Ego Browser 实测 query=`end` 时 `data-dsh-find-preview-match=0`，
  用户看不出具体命中范围，多行 query 更明显。

**修复**：

- 新增 `findToolTextLineStarts()`：
  - 在原始 LF 偏移上计算每一物理行起点；
  - CRLF 只把 `\n` 当作下一行起点，保持绝对 offset 正确；
- 新增 `findToolPreviewLineParts()`：
  - 把 match 的绝对 offset 裁成当前行可见交集；
  - 合并重叠区间；
  - 零长度 Regex match 不生成不可见高亮；
- Preview 对当前 401 行 window 调用一次 `editorFindResult()`，
  复用 Case / Whole Words / Regex；
- 命中 span 使用 `findToolHighlight`，并暴露
  `data-dsh-find-preview-match` 供运行态和回归检查；
- 新增 round652 纯函数与静态契约。

**运行态证据**：

- Ego Browser / 隔离 r526：
  - query=`end`：Preview 高亮片段为 `['end']`，无 alert；
  - 跨行 query=`\nR652_ALPHA\nR652_BETA\n`：
    `1 match in 1 file`，Preview 高亮
    `['R652_ALPHA','R652_BETA']`；
  - Regex `R652_(ALPHA|BETA)`：
    `2 matches in 1 files`，同样高亮两段；
  - 行号 `1..5`、active line 保持；
  - 临时 fixture 文件已删除，fixture 仅剩既有 `M README.md`。

**回归**：

```bash
node --test tests/round652.test.mjs tests/round651.test.mjs \
  tests/round650.test.mjs tests/round649.test.mjs \
  tests/round645.test.mjs tests/round639.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
node --check lib/terminal.js
git diff --check
```

- RED：round652 初始 **3 fail**；
- 定向：**21 pass / 0 fail**；
- 全量：**2167 pass / 0 fail**。

**已排除方案**：

- 不复用只支持单行、且会 trim query 的 `highlightParts()`；
- 不为每一行重复编译/执行 query；
- 不把跨行 match 只标在起始行；
- 不为零长度 Regex 伪造可见字符高亮。

## 2026-11-16 — Find scope 键盘与 ARIA 对齐

**作用域**：Find in Files popup/dock 的 scope mode 控件、键盘焦点与
workspace scope 持久化路径。

**偏差**：

- IDEA CUA 的 scope 区是独立 `Action Toolbar`，四个互斥模式位于同一组；
- DSH 原先四个按钮都进入 Tab 顺序，没有组名称、roving focus 或方向键；
- Module 当前 disabled，但键盘用户需要在其它三个模式之间额外绕行。

**修复**：

- scope mode 按钮包进本地化 `role="group"`：
  - 中文 `搜索范围`；
  - 英文 `Search scope`；
- 采用 roving tabIndex，只有当前模式 `tabIndex=0`；
- 新增 `findToolScopeModeTarget()`：
  - `ArrowRight`：Project → Directory → Scope → Project；
  - `ArrowLeft` 反向；
  - `Home/End` 到 Project/Scope；
  - Module 不进入可用序列；
- 键盘移动复用 `selectFindScopeMode()`，因此 scope 持久化、旧 generation
  失效、host scoped search、Preview 和 active result 生命周期不分叉；
- 新增 round651 纯函数、ARIA 与实页回归。

**运行态证据**：

- Ego Browser / 隔离 r526：
  - group 名称=`Search scope`；
  - Project：`tabIndex=[0,-1,-1,-1]`，Module disabled；
  - `→` 后焦点和 pressed 均为 Directory；
  - 再 `→` 为 Scope；
  - `Home/End` 分别到 Project/Scope；
  - query=`end` 保持，初始结果 `5 matches in 3 files`；
  - 无 alert；
  - 验证后恢复 Project 并关闭弹框。

**回归**：

```bash
node --test tests/round651.test.mjs tests/round644.test.mjs \
  tests/round643.test.mjs tests/round639.test.mjs \
  tests/round634.test.mjs tests/round628.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
node --check lib/terminal.js
git diff --check
```

- RED：round651 初始 **3 fail**；
- 定向：**33 pass / 0 fail**；
- 全量：**2164 pass / 0 fail**。

**已排除方案**：

- 不保留四个 scope 按钮各自进入 Tab 顺序；
- 不把 disabled Module 设为方向键停靠点；
- 不在键盘切换时另建 scope 更新或搜索路径；
- 不用普通 `group` 之外的自定义 ARIA 键盘状态替代原生 button。

## 2026-11-16 — Find in Files 精确保留多行 query

**作用域**：Find in Files Search/Replace textarea、跨行 literal、空白 query、
host `searchText` / `replaceText`。

**症状 / 根因**：

- round649 已让 popup 使用 New Line textarea，但真实请求仍读取
  `findTool.query.trim()`；
- 首尾空格/换行被静默删除，textarea 显示值与实际搜索/替换内容不一致；
- host 搜索与替换也以 `trim() === ''` 拒绝仅含空白的合法字面 query。

**IDEA 证据**：

- IDEA CUA 的 Find in Files Search 接受包含换行的值；
- Search 和 Replace 各有一个 New Line checkbox；
- 搜索字段应作为字面内容保留，而不是在提交前重写用户输入。

**修复**：

- 新增 `findToolContentQuery()` 原样保留字符串；
- 新增 `hasFindToolContentQuery()`，只把真正空字符串视为空查询；
- Find 搜索、dirty buffer 合并、Replace All、单点 Replace 和精确
  occurrence 校验共用未 trim 的 query；
- host `searchWorkspaceText()` / `replaceWorkspaceText()` 不再 trim query，
  仅拒绝 `''`；
- Search Everywhere 的独立 2 字符门禁与 trim 历史语义保持不变；
- 更新 round491 / round639 / round648 旧断言，新增 round650。

**运行态证据**：

- 隔离 r526 host 使用 `ELECTRON_RUN_AS_NODE=1` 和
  `/private/tmp/dsh-editor-r526-home` 重启；
- Ego Browser / `/private/tmp/dsh-editor-r526-fixture`：
  - Search textarea query=`\nR650_ALPHA\nR650_BETA\n`；
  - 返回 `1 match in 1 file`，命中 `search-r650.txt`；
  - Replace 使用同一原样 query 和
    replacement=`\nR650_LEFT\nR650_RIGHT\n`；
  - 确认后文件从 `R650_ALPHA\nR650_BETA` 精确变为
    `R650_LEFT\nR650_RIGHT`，无 alert；
  - 仅含 `\n` 的 query 返回 `12 matches in 4 files`；
  - 临时 fixture 文件与隔离 Electron 目录已清理，fixture 恢复为仅
    既有 `M README.md`。

**回归**：

```bash
node --test tests/round650.test.mjs tests/round649.test.mjs \
  tests/round648.test.mjs tests/round647.test.mjs \
  tests/round646.test.mjs tests/round639.test.mjs \
  tests/round491.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
node --check lib/terminal.js
git diff --check
```

- RED：round650 / round639 / round648 初始 **5 fail**；
- 定向：**24 pass / 0 fail**；
- 全量：**2161 pass / 0 fail**。

**已排除方案**：

- 不只保留内部换行而继续 trim 首尾；
- 不让 Search Everywhere 与 Find 共用同一个 query gate；
- 不在 host 层重新构造或规范化 query；
- 不为跨行输入另建一套 search/replace API。

## 2026-11-16 — Find in Files 弹框恢复 Search/Replace New Line

**作用域**：Find in Files popup 的 Search 行、Replace 行、多行输入与动作快捷键。

**症状 / 偏差**：

- IDEA CUA 的 `Find in Files` 独立窗口同时显示两个 `New Line`；
- DSH 只在持久 Find dock 渲染 New Line，`Cmd+Shift+F` / `⇧⌘R`
  打开的弹框无法输入多行 search/replace 文本。

**根因**：

- round641 依据一次视觉判断把 popup 的 New Line 误判为 dock-only；
- 后续 IDEA accessibility tree 明确列出 Search 与 Replace 各一个
  `New Line` checkbox，旧结论不再符合当前实窗证据。

**修复**：

- popup Search 行恢复 `New Line`，Replace toggle 仍保持 dock-only；
- popup Replace 行恢复独立的 `New Line`；
- 两个 checkbox 分别使用 `data-dsh-find-search-new-line` /
  `data-dsh-find-replace-new-line`，并暴露 `aria-label`；
- 复用已有 `searchNewLine` / `replaceNewLine` 状态与 textarea 切换：
  普通 Enter 插入换行，`⌘⏎` / `⌥⇧⏎` 仍调用原来的打开/替换动作；
- 更新 round641 旧断言，新增 round649 回归。

**运行态证据**：

- Ego Browser / 隔离 r526 / `127.0.0.1:63237`：
  - Find in Files popup 中 Search New Line 可见；
  - 勾选后 Search control 从 `INPUT` 变为 `TEXTAREA`；
  - 输入 `end` 后普通 Enter 得到 `end\n`，popup 保持打开且 alerts=[]；
  - `⇧⌘R` 后 Search/Replace 两条 New Line 同时存在；
  - 关闭 Search New Line、开启 Replace New Line 后，Search 为
    `INPUT`、Replace 为 `TEXTAREA`，证明状态独立；
  - Replace 普通 Enter 得到 `x\n`，未执行替换；
  - 420px 视口下 popup 396px，业务行无横向溢出；
  - fixture 仅保留既有 `M README.md`，未产生额外写入。

**回归**：

```bash
node --test tests/round649.test.mjs tests/round641.test.mjs \
  tests/round631.test.mjs tests/round639.test.mjs \
  tests/round648.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
node --check lib/terminal.js
git diff --check
```

- RED：round649 / round641 初始 **3 fail**；
- 定向：**18 pass / 0 fail**；
- 全量：**2158 pass / 0 fail**。

**已排除方案**：

- 不让 Search 与 Replace 共用一个 New Line 状态；
- 不把 New Line 继续藏在持久 dock；
- 不让普通 Enter 吞掉 `⌘⏎` / `⌥⇧⏎`；
- 不为多行支持另建一套 Find 输入或搜索模型。

## 2026-11-16 — Find in Files 单字符查询

**作用域**：Find in Files query gate、empty state、Preview、Rerun。

**IDEA 证据**：

- IDEA Find in Files 接受单字符；
- Search Everywhere Text provider 与 Find in Files 是两个表面，DSH
  原有的 2 字符限制只适合 Search Everywhere Text。

**修复**：

- Find tool 的 query gate 从 `< 2` 改为 `< 1`：
  - host search request；
  - Rerun disabled；
  - empty/no-match 分支；
  - Preview 条件；
  - live result status。
- 中英文 `findToolEmptyQuery` 改为至少 1 个字符；
- `searchTextHint` 与 Search Everywhere Text 的 2 字符阈值保持不变；
- 更新 round639 / round491 旧断言，新增 round648。

**运行态证据**：

- Ego Browser / 隔离 r526：
  - Find in Files 输入 `e`；
  - 16 matches / 3 files；
  - Source Preview 显示；
  - 无 alert。

**回归**：

```bash
node --test tests/round648.test.mjs tests/round647.test.mjs \
  tests/round646.test.mjs tests/round639.test.mjs \
  tests/round491.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
git diff --check
```

- RED：round648 初始 **1 fail**；
- 定向：**18 pass / 0 fail**；
- 全量：**2155 pass / 0 fail**。

**已排除方案**：

- 不为 Find 与 Search Everywhere Text 共用一个最小长度常量；
- 不只改搜索结果而保留 empty-state/Preview 的 2 字符门禁；
- 不把单个字符自动扩展成前缀或模糊查询。

## 2026-11-16 — 混合 Dirty/Clean 与多 Dirty Tab Replace All

**作用域**：Find in Files Replace All 的 dirty/clean 混合事务边界、
多 dirty tab model 更新。

**约束**：

- clean path 由宿主 guarded disk write 处理；
- dirty path 只能更新 Monaco model；
- 确认前所有 dirty rewrite 必须预检；
- confirm 取消或预检失败不得产生任何 model/disk 部分修改；
- 状态栏必须合并 clean + dirty 的文件数和替换数。

**运行态证据**：

- 隔离 r526 fixture：
  - README dirty buffer 2 个 `end`，docs/app clean；
  - Project 共 5 matches / 3 files；
  - Replace All `ENDMIX` 后 README model 更新、docs/app 磁盘更新，
    状态栏 5 occurrences / 3 files；
- 多 dirty tab：
  - README 与 docs 各 2 个 `ENDMIX`，app clean 2 个；
  - Replace All `ALLBOTH` 后 active docs 和 inactive README model
    均真实更新；
  - app 磁盘更新，状态栏 6 occurrences / 3 files；
  - 两个 tab 保持 dirty 标记；
- 验证后 README/docs/app 从隔离备份恢复。

**回归**：

```bash
node --test tests/round647.test.mjs tests/round646.test.mjs \
  tests/round645.test.mjs tests/round584.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
git diff --check
```

- 定向：**15 pass / 0 fail**；
- 全量：**2153 pass / 0 fail**。

**已排除方案**：

- 不先修改 dirty model 再等待 clean host 写入；
- 不把 confirm 放到 dirty model mutation 之后；
- 不用 active editor 只更新当前 tab；
- 不分别报告 dirty/clean 两个状态栏而不是合并结果。

## 2026-11-16 — Dirty Buffer Replace 与独立 Undo 边界

**作用域**：Find in Files 的 Replace All、单处 Replace、脏 Monaco model。

**IDEA 对照**：

- dirty virtual document 的 Replace 应直接更新内存内容；
- clean 文件仍使用磁盘写入保护；
- 每次 Replace / Replace All 应可作为独立编辑撤销。

**修复**：

- Replace All 将 matches 拆成 dirty/clean：
  - dirty path 先 `editorReplaceAll()` 预检；
  - host 仅接收 cleanTargets；
  - dirty/clean 的替换数和文件数合并到状态栏；
- 单处 Replace 对 dirty occurrence 使用
  `textOffsetAtLineColumn()` + `editorReplaceAt()`；
- dirty model 使用 `pushEditOperations()`，并在调用前
  `pushStackElement()` 建立 undo 边界；
- clean 文件 mtime、exact occurrence、file-mask 保护不变。

**关键根因**：

- `model.applyEdits()` 对未挂载 editor 的 model 可改文本，但不会形成
  可用的 undo element；
- 只同步 openFiles state、不同步 Monaco model 会让搜索与编辑器分叉；
- 连续 dirty Replace 若不 push undo element boundary 会合并为一个撤销步。

**运行态证据**：

- 隔离 r526 fixture / Open Files scope：
  - 2 个 `UNSAVED_ONLY_TOKEN` → Replace All `ALL_TOKEN`，
    model 两处更新，状态栏 2 occurrences / 1 file；
  - 单处 `ALL_TOKEN` → `SINGLE_TOKEN`，只更新第一处；
  - 单次 `model.undo()` 恢复单处替换前内容；
  - Replace All 后单次 undo 完整恢复两个原始 token；
  - 磁盘 README 未被修改；
  - 刷新页面后未保存编辑丢弃，fixture 恢复预期状态。

**回归**：

```bash
node --test tests/round646.test.mjs tests/round645.test.mjs \
  tests/round644.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
git diff --check
```

- RED：round646 初始 **3 fail**；
- 定向：**9 pass / 0 fail**；
- 全量：**2150 pass / 0 fail**。

**已排除方案**：

- 不用 `applyEdits()` 冒充可撤销的 dirty Replace；
- 不只改 openFiles content 而不改 model；
- 不让 host 接收 dirty target；
- 不把 Replace All 和下一次单处 Replace 合并成一个 undo step。

## 2026-11-16 — Find 合并未保存 Buffer 与 Preview 实时内容

**作用域**：Find in Files 搜索、Open Files scope、Source Preview 与
Replace 的脏文件边界。

**症状 / 根因**：

- 宿主 `searchText` 只读取磁盘，未保存编辑器内容不会出现在 Find；
- Preview 也会 `callFs read`，即使结果来自内存也无法显示真实内容；
- 第一版实现把 `openFilesRef`、`modelsRef` 用在 `FindToolWindow` 中但
  未作为 prop 传入，实页报 `openFilesRef is not defined` /
  `modelsRef is not defined`。

**修复**：

- 新增 `textSearchFileMatches()`，复用 `editorFindResult()` 的 smart case、
  Whole Words、Regex 语义；
- 新增 `mergeFindToolDirtyMatches()`：dirty path 的磁盘命中替换为内存
  命中，dirty 结果优先占用 200 条上限，scope/mask 继续生效；
- host 响应后与 `openFilesRef.current` 中 dirty content 合并；
- Preview 的 dirty 分支直接读取 open file 的实时 content；
- `FindToolWindow` 显式接收 `openFilesRef`，Preview 不再依赖未传入的
  `modelsRef`；
- `Replace in Files` 仍保留脏文件 save-or-close 保护。

**运行态证据**：

- Ego Browser / 隔离 r526 fixture：
  - README 写入仅存在于未保存 buffer 的 `UNSAVED_ONLY_TOKEN`；
  - Open Files 返回 `README.md:3:1`；
  - Preview 显示未保存 4 行 buffer；
  - 磁盘 README 未变化；
  - `⌥⇧⏎` 显示
    `Save or close these modified files before Replace in Files: README.md`；
  - 刷新页面后内存编辑丢弃，fixture 保持预期状态。

**回归**：

```bash
node --test tests/round645.test.mjs tests/round644.test.mjs \
  tests/round643.test.mjs tests/round639.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
git diff --check
```

- RED：round645 初始 **3 fail**；
- 定向：**16 pass / 0 fail**；
- 全量：**2147 pass / 0 fail**。

**已排除方案**：

- 不只搜索磁盘再把脏文件当作缺失；
- 不让 dirty Preview 回落到磁盘；
- 不在组件内引用未传入的上层 ref；
- 本轮不伪称已完成 dirty Replace。

## 2026-11-16 — Find Scope 按 Workspace 持久化与 allowedPaths 实页验收

**作用域**：Find in Files 的 Open Files / Changed Files scope、scope 重启
恢复、窄视口工具状态。

**IDEA 对照**：

- Open/Changed Files scope 会重新生成结果，active result 与 Preview 跟随
  新范围收敛；
- Scope 是 Find 配置的一部分，关闭重开或刷新后应保留；
- Scope 必须按 workspace 隔离。

**修复**：

- 新增 `normalizeFindSearchScope()`，只允许 Project/Directory/Scope 与
  Project Files/Open Files/Changed Files；
- Directory 拒绝 absolute、`..` 和空路径段，非法值回退 Project；
- 以 `dsh-editor.find.scope.v1:<workspace-root>` 持久化 scope；
- `openFindTool()` 恢复 scope，`changeFindToolScope()` 持久化同一规范化值；
- 修正 round643 对默认 scope 的静态假设，新增 round644。

**运行态证据**：

- Ego Browser / r526 / `127.0.0.1:63237`：
  - Project 搜索 `end`：5 matches / 3 files；
  - Open Files 请求 `allowedPaths=["README.md"]`，2 matches；
  - 临时修改 docs 后，Changed Files 请求
    `allowedPaths=["docs/notes.md","README.md"]`，3 matches / 2 files；
  - Changed Files active 收敛到 `docs/notes.md:3:1`，Preview 显示该文件；
  - 关闭 Find 后重开、再整页刷新，Scope pressed=true、
    preset=`changedFiles` 均恢复；
  - 420px 视口下 popup 宽 398px，`scrollWidth=innerWidth=420`，
    Scope 按钮同行且无横向溢出；
  - dock 中 `Settings…` 保持直接动作，同时使用 `More actions` overflow。

**回归**：

```bash
node --test tests/round644.test.mjs tests/round643.test.mjs \
  tests/round642.test.mjs tests/round630.test.mjs \
  tests/round590.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
git diff --check
```

- RED：round644 初始 **3 fail**；
- 定向：**19 pass / 0 fail**；
- 全量：**2144 pass / 0 fail**。

**已排除方案**：

- 不把 scope 存在全局 key 下；
- 不在非法 Directory 时静默当作 workspace root；
- 不让 scope 依赖 Find surface 是否存活；
- 不为持久化复制第二套搜索请求或结果模型。

## 2026-11-16 — Find Scope 下沉宿主与 r526 宿主机重启方式

**作用域**：Find in Files 的 Directory / Open Files / Changed Files scope、
`⇧⌘R` 状态生命周期、隔离 r526 宿主验证。

**症状 / 根因**：

- Directory scope 原先只在浏览器端过滤已返回的全局前 200 条结果；
  范围外文件先占满 `maxMatches` 时，范围内会错误显示 `No matches`；
- `⇧⌘R` 使用新的 Find state，清空 query 的同时把 host scope 重置为
  Project；UI 仍显示旧 Directory，但后续请求不再是 scoped；
- 只修改 `lib/index.js` 后直接刷新页面仍会运行旧宿主模块，必须重启
  DSH host。

**修复**：

- 宿主 `searchText` 增加 `directory` 和 `allowedPaths`：
  - Directory 从目标目录开始扫描；
  - allowed-path scope 直接搜索选中文件；
  - scope 在 200 条命中上限之前生效；
  - 路径拒绝 absolute / `..`。
- Find tool 将 scope 写入共享 state，搜索请求携带 live scope，
  scope 变化提升 generation 并清空旧结果；
- 新增编辑器侧 preserve-scope `⇧⌘R` opener：只清空 query/replacement，
  保留 Directory/Scope 和搜索选项；
- round643 覆盖宿主目录/路径 scope、请求转发、generation 和快捷键状态。

**运行态证据**：

- 隔离 r526 fixture 中新增范围外文件，含 260 个 `end`：
  - Project 返回 200 条并占满上限；
  - Directory=`docs` 仍返回 `docs/notes.md:3:1` 1 条；
- `⇧⌘R` 后 query 为空、Directory=`docs`、0 结果；重新输入 `end`
  仍只返回 docs 的 1 条；
- `⌥⇧⏎` 确认后只写入 `docs/notes.md`，Replace 后 scope 保持、
  结果 0、无 alert；README/src 未变化，fixture 已恢复。

**r526 host 重启**：

- 隔离 home：`/private/tmp/dsh-editor-r526-home`；
- 必须使用包里 CLI，并在持久 PTY 中运行：

```bash
export DSH_HOME=/private/tmp/dsh-editor-r526-home
/Applications/Harness.app/Contents/Resources/runtime/cli/bin/dsh \
  --profile r526 --host 127.0.0.1 --port 63237 --no-open
```

- 直接启动 `.app/Contents/MacOS/DeepSeek Harness ... cli.js` 在当前环境会
  静默退出；`nohup` 启动也不保持。使用统一 `dsh` launcher 和持久 PTY，
  启动日志会打印带 token 的本地 URL。

**回归**：

```bash
node --test tests/round643.test.mjs tests/round642.test.mjs \
  tests/round636.test.mjs tests/round630.test.mjs \
  tests/round506.test.mjs tests/round590.test.mjs \
  tests/round468.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
git diff --check
```

- 定向：**26 pass / 0 fail**；
- 全量：**2141 pass / 0 fail**。

**已排除方案**：

- 不在客户端对全局截断结果做 scope 事后过滤；
- 不为允许路径重新遍历整个 workspace；
- 不让 `⇧⌘R` 重置 Directory/Scope；
- 不把 invalid scope path 当成 workspace root。

## 2026-11-16 — Find 工具窗 Settings 与 Directory Replace 边界

**作用域**：持久 Find 工具窗工具栏、Find/Replace 配置弹框状态交接、
Directory scope 的 Replace All 真实写入。

**IDEA 证据**：

- IDEA 持久 Find 工具栏顺序为 `Rerun / Previous Occurrence /
  Next Occurrence / Settings… / Group By / Expand All / Collapse All /
  Preview Source`；
- `Settings…` 会重新打开当前查询的 Find/Replace 配置弹框；
- Replace Occurrences 工具窗进入时，弹框保留 Replace 模式与填充文本。

**修复**：

- 仅 dock 增加直接 `Settings…` 动作，popup 继续只保留 Filter/Pin；
- `openFindToolSettings()` 仅把 surface 切回 popup，明确保留
  query、replacement、mode、files/matches、active index 与搜索选项；
- 动作顺序收敛到 IDEA 的 Rerun → Previous → Next → Settings → Group By；
- 增加 round642 回归，锁定动作存在、顺序与状态交接。

**运行态证据**：

- Ego Browser / r526 / `127.0.0.1:63237`：
  - dock 直接动作含 `Rerun Search / Settings… / Group Search Results By`；
  - Find 模式 Settings 往返保留 query=`end`、active=`README.md:3:29`
    与 4 条结果；
  - Replace 模式往返保留 title=`Replace in Files`、replacement=`ENDX`、
    active result 与 4 条结果；
  - Directory=`docs` 时只显示 `docs/notes.md:3:1`；
  - 真实 Replace All 仅修改 `docs/notes.md`，`README.md` 与
    `src/app.js` 未变化；验证后已恢复 fixture。

**回归**：

```bash
node --test tests/round642.test.mjs tests/round641.test.mjs \
  tests/round639.test.mjs tests/round640.test.mjs \
  tests/round636.test.mjs tests/round637.test.mjs \
  tests/round633.test.mjs tests/round468.test.mjs \
  tests/round167.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
node --check lib/terminal.js
git diff --check
```

- 定向：**34 pass / 0 fail**；
- 全量：**2137 pass / 0 fail**；
- 三个 `node --check` 与 `git diff --check` 通过。

**已排除方案**：

- 不在 popup 中重复显示 Settings；
- 不复用 `openFindInFilesFromShortcut()` 强制切回 find 模式；
- 不为 Settings 复制第二份 query/results 状态；
- 不绕过 Directory scope 的 allowed-path 集合直接替换整文件。

## 2026-11-16 — Replace in Files 弹框标题与 Replace 行收敛

**作用域**：`⇧⌘R` 打开的 transient Replace in Files popup。

**IDEA 证据**：

- `⇧⌘R` 仍打开约 571×536 的同一 Replace in Files 窗口；
- 标题从 `Find in Files` 切换为 `Replace in Files`；
- Replace 行是 replace 图标 + replacement input + history 下拉 +
  Preserve case；New Line 不在 popup 视觉行中；
- 底部依次是 Open results in new tab、`⌘⏎`、Open in Find Window、
  Replace All、Replace。

**修复**：

- floating popup 的 title 按 `state.mode` 选择
  `editor.replaceInFilesTitle` / `editor.findInFilesTitle`；
- popup Replace row 的 New Line checkbox 改为只在 dock 渲染；
- Replace row 左图标改为 `replace`，历史按钮在 popup 使用
  `chevronDown`，dock 继续使用 `history`；
- flat results、auto preview、Filter/Pin 标题动作继续复用 round639 的
  popup contract，不恢复 tree/group header。

**运行态证据**：

- Ego Browser / r526 / `127.0.0.1:63237`：
  - `⇧⌘R` 后 aria title=`Replace in Files`；
  - query=`end`：rows=4、groups=0、preview=1、replaceInput=1；
  - Replace row 按钮仅 `Replace History` / `Preserve case`；
  - `newLineInReplaceRow=false`；
  - popup rect 582×538；
  - 等待 5 秒 workspace/popup 仍存在且无 alert。
- host 连续移除/重挂 3 次，每次 same host/workspace/Monaco control=true。

**回归**：`tests/round641.test.mjs` 与 round631/639/640。

**已排除方案**：

- 不在 Replace popup 中显示 dock 的 New Line；
- 不让 Replace 模式退回 Find 标题；
- 不为 replace mode 复制第二套结果或 preview 实现。

## 2026-11-16 — Find in Files 弹框平铺结果与 Editor host 稳定复用

**作用域**：`Cmd/Ctrl+Shift+F` / 双击 Shift 打开的 Find in Files 弹框、
Editor React host 在宿主布局重渲染时的生命周期。

**症状**：

- Find in Files 弹框曾表现为 780px 偏宽 sheet，内部沿用持久 Find dock 的
  directory/file tree；active occurrence 的背景被拉成大块蓝色，匹配文本
  在约 190px 列内换行，和 IDEA 的平铺结果列表不符。
- 用户报告 Editor 打开后双击 Shift 弹出 Find，几秒后整个 Editor 区域变
  空白。诊断日志同期出现 `activeFilePath is not defined` 的
  `react-render-error`；宿主重建 conversation 布局父节点时，
  `ensureHost()` 还会销毁并重建整个 React root。

**根因**：

- `styles` 中 `findToolPreview` 定义了两次；第二个 Preview pane 样式覆盖了
  occurrence row 的文本样式。
- Transient popup 与 persistent dock 共用了同一套 tree/group rendering，
  但 IDEA 的 Find in Files 弹框是 flat result list + automatic preview。
- `ensureHost()` 只在 `host.parentElement === hostParent` 时复用；父节点
  一旦被宿主替换，就 `destroyHost()`、`createRoot()` 重建整棵树。后台
  mutation/布局更新会把一次局部 parent 变化放大成全 Editor 卸载。

**修复**：

- 弹框改为 `min(580px, 100vw - 24px) × min(536px, 100vh - 32px)`、
  双向居中；标题行只保留 Filter/Pin，查询行只保留清空/历史/
  Match Case/Whole Words/Regex，Scope 行和底部动作继续保持 IDEA 顺序。
- Popup 使用 flat `popupOccurrences`；每行左侧为高亮匹配，右侧为
  `文件名 行号`。Dock 继续使用 file/directory tree 和 Group By。
- 弹框默认自动打开 active text match 的 Source Preview；空查询不显示
  preview pane。修正重复 style key，Preview pane 改名为
  `findToolPreviewPane`。
- `ensureHost()` 在 `host`/`root` 都存在时，仅把同一个 host 节点
  `appendChild` 到新的稳定父节点，再恢复位置观察；只有 host/root 真正
  丢失时才销毁重建。清理 stale host 时也排除当前 host。
- 删除查询行在 popup 中的 Replace/New Line 噪音；Replace row 由
  Replace 入口或 `⇧⌘R` 的 replace mode 展开，dock 仍保留开关。

**运行态证据**：

- IDEA CUA：Find in Files 空查询窗口为 571×536；有结果时平铺显示
  `return …  file.py 51`，下方自动显示 Source Preview。
- Ego Browser / r526 fixture / `127.0.0.1:63237`：
  - popup rect `{ width: 582, height: 538 }`（含 border）；
  - query=`end`：4 个 flat rows、0 个 dock group、preview=true；
  - active row 文本为 `Scoped appears here. Second end line. README.md 3`；
  - filter/pin 是标题行仅有的 toolbar 动作；
  - Escape 关闭后双击 Shift 可重新打开；
  - 主动移除 Editor host 后，下一次 reconciliation 重挂的是同一 host、
    同一 workspace、同一 Monaco 控件；随后打开 Find 并等待 10 秒，
    host/workspace/popup 均保持存在且无 alert。

**回归**：

```bash
node --test tests/round639.test.mjs tests/round640.test.mjs \
  tests/round167.test.mjs tests/round451.test.mjs \
  tests/round461.test.mjs tests/round491.test.mjs \
  tests/round631.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
node --check lib/terminal.js
git diff --check
```

- 定向：**29 pass / 0 fail**；
- 全量：**2131 pass / 0 fail**；
- 三个 `node --check` 与 `git diff --check` 通过。

**已排除方案**：

- 不在 popup 中复用 dock 的 tree/Group By；二者语义不同。
- 不靠清空 `innerHTML`、重设 `textContent` 或重建 host 来“恢复” Editor。
- 不在每次 host parent 变化时 remount Monaco/xterm/Project tree。
- 不重新引入周期性 host 健康检查或 watchdog。

## 2026-11-16 — Find Rerun 状态恢复与 Preview/右侧定位

**作用域**：持久 Find Rerun、Preview Source、Open results in new tab。

**IDEA 证据**：

- Preview Source 是持久 Find 工具窗的直接工具栏动作；
- Rerun 是同一结果窗口内的刷新，应保留工具窗上下文；
- 文本结果可在新 tab 中打开到真实行列，同时 Find 工具窗继续存在。

**修复**：

- Rerun 前记录 active rowKey、path、index 和目标 search generation；
- 只有新 generation 的 `loadedGeneration === searchGeneration` 后才恢复，
  避免中间空 results 清空选择；
- 目标在折叠文件中时先展开该组；目标消失时退化到原 index clamp；
- Rerun loading 期间 Preview 状态不清空；
- dock header 将 Preview Source 设为直接动作；
- `Open results in new tab` 持久化到
  `dsh-editor.find.openInNewTab`，跨 popup/dock remount 保持；
- 文本结果继续通过 `openInRightSplit(path, {line,column})` 定位，
  open 动作不关闭 Find dock。

**运行态证据**：

- Ego Browser / r526 fixture / `127.0.0.1:63237`：
  - Directory/file results 中 active=`README.md:4:1`；
  - Preview 内容为 README.md 5 行原文；
  - Rerun 后 active descendant、Preview 文本完全一致；
  - 折叠 `docs/notes.md` 后 Rerun，aria-expanded 仍为 false；
  - `dsh-editor.find.openInNewTab=1`；
  - 双击文本结果后右侧 split 打开 README.md，状态为 Ln 4 Col 1，
    Find dock 保持打开。

**回归**：

```bash
node --test tests/round638.test.mjs tests/round636.test.mjs \
  tests/round635.test.mjs tests/round637.test.mjs \
  tests/round633.test.mjs tests/round468.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
node --check lib/terminal.js
git diff --check
```

- 定向：**25 pass / 0 fail**；
- 全量：**2122 pass / 0 fail**；
- 三个 `node --check` 与 `git diff --check` 通过。

**已排除方案**：

- 不在 Rerun 前半段就按空 occurrence 修改 index；
- 不为 Preview 复制另一份文件读取状态；
- 不让 Open results in new tab 关闭 Find dock；
- 不让 openInNewTab 在 popup → dock 时退回默认值。

## 2026-11-16 — Find Group By 文件/目录结构

**作用域**：持久 Find 工具窗结果分组、Group By 菜单与键盘切换。

**IDEA 证据**：

- IDEA Find 工具窗 Group By 菜单包含：
  - Directory Structure `⌃D`；
  - File Structure `⌃S`；
  - Module、Flatten Modules、Package、Production/Test、Usage Type、
    Merge Usages from the Same Line；
- DSH 文本搜索没有 Module/Package/AST 模型，只能诚实实现前两项。

**修复**：

- 新增 `findGroupBy: 'file'|'directory'`，持久化到
  `dsh-editor.find.groupBy`；
- `findToolVisibleRows()` 在 Directory 模式按目录和文件路径稳定排序；
- 结果列表增加 display-only 目录标题和聚合命中数，不把这些标题塞进
  occurrence keyboard sequence；
- dock toolbar 增加 Group By 菜单：
  - Directory/File 可切换并显示 checked；
  - 语言级分组项可见但 disabled；
- 支持 `Ctrl+D / Ctrl+S`，且只在 Find 工具窗非 input/textarea/select/menu
  区域生效；
- groupBy 变化后 active index 收敛到新顺序，handoff target 也按当前
  groupBy 计算。

**运行态证据**：

- Ego Browser / r526 fixture / `127.0.0.1:63237`：
  - query=`end`、无 File mask 时 4 matches / 3 files；
  - Directory Structure 显示 `Project root 2 matches / docs 1 match /
    src 1 match`；
  - File Structure 下目录标题消失，文件组顺序恢复；
  - 菜单 Directory checked=true、File checked=false；
  - `Ctrl+D` 切回 Directory，`dsh-editor.find.groupBy=directory`。

**回归**：

```bash
node --test tests/round637.test.mjs tests/round635.test.mjs \
  tests/round636.test.mjs tests/round633.test.mjs \
  tests/round468.test.mjs tests/round502.test.mjs \
  tests/round614.test.mjs tests/round634.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
node --check lib/terminal.js
git diff --check
```

- 定向：**19 pass / 0 fail**；
- 全量：**2118 pass / 0 fail**；
- 三个 `node --check` 与 `git diff --check` 通过。

**已排除方案**：

- 不把 Module/Package 分组伪装成目录分组；
- 不让目录标题进入 aria-activedescendant 或结果替换序列；
- 不在文本输入框里抢占 Ctrl+D/Ctrl+S；
- 不复制第二套 Find result state。

## 2026-11-16 — Find 快捷键、Rerun 与目录选择

**作用域**：Find in Files 底部快捷键、持久 Find 工具栏和 Directory scope。

**IDEA 证据**：

- 弹框底部 `⌘⏎` 与 Open in Find Window 同组；
- Replace All 的 Help 为 `⌥⇧⏎`；
- 持久 Find 工具窗有独立 Rerun；
- Directory scope 的 Select Directory 按钮 Help 为 `⇧⏎`；
- 目录选择列表来自完整工作区目录，而不是 Project 已展开节点。

**修复**：

- query 输入中 `Cmd/Ctrl+Enter` 在有结果时复用
  `requestOpenInFindWindow()`；按钮同步 `aria-keyshortcuts`;
- `replaceInputAction()` 新增 IDEA 主快捷键 `Alt+Shift+Enter`；
  保留 Cmd/Ctrl+Enter 兼容，Shift+Enter / Alt+Enter 单独使用仍不触发；
- Replace All 按钮增加 `⌥⇧⏎` tooltip 和 ARIA；
- dock toolbar 增加 Rerun，复用 `onQuery(query)`，不复制搜索状态；
- 泛化既有 `MoveToPicker` 的 title/placeholder/currentLabel；
- Directory scope 复用 host `callFs({op:'directories'})`，
  `Select Directory` 与目录输入框 `Shift+Enter` 打开同一选择器；
- 选择目录后写回 scope input，并保持 directory scope 激活。

**运行态证据**：

- Ego Browser / r526 fixture / `127.0.0.1:63237`：
  - query=`end` 后按 `Cmd+Enter` 从 popup 进入 dock；
  - query 与 active descendant 保留，dock toolbar 显示 Rerun Search；
  - Rerun 后 surface 仍为 dock、query 仍为 `end`；
  - Directory 按钮打开 `Select Directory`，placeholder 为
    `Select a workspace directory…`；
  - 搜索并选择 `src` 后 Directory=`src`、Directory scope pressed=true，
    summary 仍为 `1 match in 1 file`；
  - Directory input `Shift+Enter` 同样打开选择器，Esc 可关闭。

**回归**：

```bash
node --test tests/round636.test.mjs tests/round635.test.mjs \
  tests/round634.test.mjs tests/round633.test.mjs \
  tests/round631.test.mjs tests/round617.test.mjs \
  tests/round144.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
node --check lib/terminal.js
git diff --check
```

- 定向包括既有 Find、目录选择器和 replace intent 回归；
- 全量：**2114 pass / 0 fail**；
- 三个 `node --check` 与 `git diff --check` 通过。

**已排除方案**：

- 不为 Rerun 复制第二套 query/results；
- 不用 Project 已展开 rows 冒充目录选择列表；
- 不让 Alt+Enter 或 Shift+Enter 单独触发 Replace All；
- 不只显示快捷键文本而不接真实键盘路径。

## 2026-11-16 — Open in Find Window 持久结果面

**作用域**：Find in Files 弹框底部动作、Search Everywhere Find tool handoff、
底部 Find 工具窗。

**症状 / IDEA 对照**：

- DSH 的 `Open in Find Window` 永久 disabled，并错误声称结果已经在
  Find in Files 弹框中；
- IDEA 实窗有结果时该按钮可用；点击后弹框关闭，结果进入底部
  `Occurrences of 'return' Tool Window`；
- IDEA 持久窗保留结果树、Preview、Rerun、上一处/下一处、Settings、
  Group By、Expand/Collapse 和 Hide；
- IDEA 超过结果阈值时先显示 `Too Many Results` 确认。

**修复**：

- `findTool` 增加 `surface: 'popup' | 'dock'`；
  `Cmd+Shift+F`、双击 Shift 与普通 Find/Replace handoff 默认仍为 popup；
- 新增 `openFindToolInDock()`，保留 query/results/options/active
  descendant，仅切换 surface，并关闭 Terminal dock；
- 新增 `data-dsh-find-tool-dock` 底部工具窗，复用同一个
  `FindToolWindow`，高度默认 280px、可在 180–720px 内调整并持久化到
  `dsh-editor.find.height`；
- dock 关闭弹框专属的外部点击关闭、Pin 和底部打开结果动作；
- `Open in Find Window` 有结果时启用；无结果显示 disabled reason；
  超过既有 200 条阈值时复用 `searchTooManyResults` 确认；
- Search Everywhere 的 `Open in Find Tool Window`、`Find Tool Window`
  Action 与 `Show Usages` pin 都改为打开 dock；
- 在 dock 上再次按 `Cmd+Shift+F` 会恢复 popup，保留同一 query 和 active
  descendant，保证常用快捷键仍打开轻量弹框。

**运行态证据**：

- Ego Browser / r526 fixture / `127.0.0.1:63237`：
  - 查询 `end` 后弹框 Open in Find Window 从 disabled 变为 enabled；
  - 点击后 popup=false、dock=true、surface=dock；
  - query=`end`，标题为 `Occurrences of 'end'`；
  - active descendant `text:src/app.js:1:26` 在转换前后保持一致；
  - dock 高 281px，无弹框底部栏和 Pin；
  - 点击 Project 后 dock 保持，未因外部点击关闭；
  - 再按 `Cmd+Shift+F` 后恢复 popup，query 和 active descendant 保留；
  - 拖动 dock 上沿后高度从 281px 变为 329px，
    `dsh-editor.find.height=328`，query 保持 `end`。

**回归**：

```bash
node --test tests/round635.test.mjs tests/round634.test.mjs \
  tests/round633.test.mjs tests/round632.test.mjs \
  tests/round631.test.mjs tests/round630.test.mjs \
  tests/round628.test.mjs tests/round487.test.mjs \
  tests/round467.test.mjs tests/round494.test.mjs \
  tests/round495.test.mjs tests/round496.test.mjs \
  tests/round520.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
node --check lib/terminal.js
git diff --check
```

- 定向：**61 pass / 0 fail**；
- 全量：**2109 pass / 0 fail**；
- 三个 `node --check` 与 `git diff --check` 通过。

**已排除方案**：

- 不把 Open in Find Window 继续当作永久 disabled 的解释性按钮；
- 不复制第二套 query/results 状态；
- 不让外部点击关闭 dock；
- 不让 Cmd+Shift+F 默认直接打开 dock；
- 不把 Search Everywhere 的显式 Find Tool Window 入口伪装成 transient popup。

## 2026-11-16 — Cmd+Shift+F 查找弹框形态对齐

**作用域**：Find in Files 浮层外壳、Search/Replace 行、标题工具栏、
Scope 行和底部动作栏。

**症状 / IDEA 对照**：

- DSH 的 `Cmd+Shift+F` 浮层固定为 900×680，空查询时留下大面积空白；
- 弹框带 `0 0 0 100vmax` 暗色扩散阴影，看起来像全屏模态遮罩；
- Replace 行常驻，底部 Replace / Replace All 也常驻，与 IDEA 默认的
  Search-only 查找弹框不符；
- IDEA CUA 实窗确认 Filter / Pin 位于标题行，AX 中出现的隐藏 Replace
  控件不能证明 Replace 行可见；
- IDEA 默认 In Project 只显示四个 scope 入口，不常驻空 `…`。

**修复**：

- `findToolPopup` 改为 `maxHeight` 约束下的自动高度，移除整屏遮罩，
  只保留普通窗口阴影；
- 删除独立 `findToolActionBar` 行；Filter / Pin 固定显示在标题行，
  其余结果动作进入同一标题行 `CompactActionBar` 的 `»` overflow；
- Replace 行由 `replaceExpanded` 按需展开：默认隐藏，Search 行提供
  `Show Replace / Hide Replace` toggle；Search Everywhere 和 Replace
  入口仍会自动展开并复用同一个 replacement input；
- Scope 行移除多余的 `In` 独立标签，第一项直接显示 `In Project`；
  Project 模式不再渲染禁用的空 `…`；
- 底部查找模式只保留 Open results in new tab、`⌘⏎` 与
  Open in Find Window；Replace / Replace All 仅在 Replace 行展开时出现；
- 重复 `Cmd+Shift+F` 只回焦 Search，不重置已展开的 Replace 行和查询。

**运行态证据**：

- Ego Browser / r526 fixture / `127.0.0.1:63237`：
  - 默认弹框高度 186px，Replace input 不存在；
  - 标题行直接按钮为 Filter Search Results / Pin Window / More actions；
  - Scope 行 4 个按钮，文本为 In Project / Module / Directory / Scope；
  - bottom bar 文本只有 Open results in new tab / `⌘⏎` /
    Open in Find Window；
  - 点击 Show Replace 后高度 219px，Replace input 可见，
    bottom bar 追加 Replace All / Replace；
  - Replace 展开后再次按 `Cmd+Shift+F`，焦点回到 Search，
    Replace 行保持可见。
  - `Escape` 关闭弹框后，焦点回编辑器时连续按两次 Shift 仍可重新打开
    同一 Search-only 弹框。

**回归**：

```bash
node --test tests/round634.test.mjs tests/round633.test.mjs \
  tests/round632.test.mjs tests/round631.test.mjs \
  tests/round630.test.mjs tests/round628.test.mjs \
  tests/round494.test.mjs tests/round495.test.mjs \
  tests/round496.test.mjs tests/round520.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
node --check lib/terminal.js
git diff --check
```

**已排除方案**：

- 不把 IDEA AX 中隐藏的 Replace 控件当成可见 UI；
- 不为复刻 Search-only 默认形态而删除 Replace 能力；
- 不保留固定 680px 空白结果区和整屏暗色遮罩；
- 不把 Filter / Pin 和其余结果动作拆成两套独立状态。

## 2026-11-16 — Find in Files 底部动作栏与 Directory scope

**作用域**：Replace 动作栏、Open results in new tab、Directory scope 输入。

**修复**：

- Replace/Replace All 从 Replace row 移动到独立 bottom bar；
- bottom bar 还显示 Open results in new tab 与 Open in Find Window；
- Open in Find Window 因结果已经在 Find in Files 浮层中，保持 disabled；
- openResultsInNewTab=true 时，结果通过右侧编辑面打开；
- Directory scope 增加工作区相对路径输入和“使用当前文件目录”按钮；
- Directory path 支持根目录空值 / `.` 与 `./src/` 归一化。

**运行态证据**：

- bottom bar 标签：
  Open results in new tab / Open in Find Window / Replace All / Replace；
- Open in Find Window disabled；
- Replace/All 根据当前结果启用；
- Directory=`src` 后结果仅 `src/app.js`，1 match / 1 file。

**回归**：

```bash
node --test tests/round633.test.mjs tests/round632.test.mjs \
  tests/round631.test.mjs tests/round630.test.mjs \
  tests/round494.test.mjs tests/round495.test.mjs \
  tests/round496.test.mjs tests/round520.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
node --check lib/terminal.js
git diff --check
```

- 全量：**2098 pass / 0 fail**。

**已排除方案**：

- 不在 Replace row 和 bottom bar 重复放 Replace；
- 不伪造当前架构不存在的第二个 Open in Find Window 结果面板；
- 不允许 Directory 路径绕过工作区过滤；
- 不把 `.` 当成无结果目录。

## 2026-11-16 — Find in Files Filter、Pin 与 Scope 顺序

**作用域**：Find in Files 工具栏、Filter Search Results、Pin Window、
Scope 行顺序。

**IDEA CUA 证据**：

- Filter Search Results 菜单项：
  Anywhere / In Comments / In String Literals / Except Comments /
  Except String Literals / Except Comments and String Literals；
- Pin Window 是独立 toolbar button；
- scope 行位于 Search/Replace 输入之后。

**实现**：

- 新增 Filter Search Results toolbar 和 ContextMenu：
  - Anywhere 选中；
  - 语言相关 5 项显式 disabled，不伪造 AST；
- 新增 Pin Window：
  - `dsh-editor.find.pinned` 持久化；
  - unpinned 时 window capture mousedown 检查 popup/menu 外部并关闭；
  - pinned 时保留；
- Scope 行移动到 Replace 行之后。

**运行态证据**：

- Search/Replace/Scope 的 top 分别为 118/151/184；
- Filter 菜单按钮 disabled 状态：Anywhere=false，其余 5 项=true；
- Pin 后点击外部 popup 保持；
- Unpin 后点击外部 popup 关闭。

**回归**：

```bash
node --test tests/round632.test.mjs tests/round631.test.mjs \
  tests/round630.test.mjs tests/round628.test.mjs \
  tests/round584.test.mjs tests/round487.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
node --check lib/terminal.js
git diff --check
```

- 全量：**2094 pass / 0 fail**。

**已排除方案**：

- 不伪造 comments/string token 过滤；
- 不让 Pin 只有视觉状态而无外部点击差异；
- 不把 Scope 留在 Replace 前；
- 不让 ContextMenu 点击被 outside-close 逻辑误关闭。

## 2026-11-16 — Find in Files New Line 与双输入常驻

**作用域**：Find in Files Search/Replace 输入、New Line、Preserve case。

**症状 / IDEA 对照**：

- DSH 只在 replace mode 显示 Replace 行；
- IDEA CUA 的 Find in Files 顶部同时暴露 Search 和 Replace；
- 两者均有 New Line 复选框，勾选后 Enter 应插入换行。

**修复**：

- Replace 行从 `replaceMode ? ... : null` 改为常驻；
- 新增 `searchNewLine` / `replaceNewLine`；
- New Line 开启时 input 切换为 textarea，普通 Enter 放行默认换行；
- Preserve case 移入 Replace row；
- 仍然保留 Cmd/Ctrl+Enter 替换执行能力。

**运行态证据**：

- Search/Replace 行同时存在；
- New Line 标签两个；
- Preserve case 按钮存在；
- Search New Line 后 textarea=true；
- `end↵Value` 实际写入 query（含换行）。

**回归**：

```bash
node --test tests/round631.test.mjs tests/round630.test.mjs \
  tests/round628.test.mjs tests/round584.test.mjs \
  tests/round487.test.mjs tests/round467.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
node --check lib/terminal.js
git diff --check
```

- 全量：**2090 pass / 0 fail**。

**已排除方案**：

- 不只在 Replace mode 显示 Replace；
- 不让 New Line 模式下的 Enter 打开结果/触发替换；
- 不在 Replace 行重复 Preserve case toolbar；
- 不用 textarea 但继续消费 Enter。

## 2026-11-16 — CmdShiftF 修正为 IDEA 浮层并增加 File mask 历史

**作用域**：Find in Files 呈现形态、File extension 历史、scope 浮层布局。

**症状 / 用户纠正**：

- DSH 把 `Cmd+Shift+F` 实现为 Editor 底部持久 dock；
- IDEA CUA 实窗显示这是独立 `Find in Files` 浮层窗口，顶部右侧是
  File mask checkbox/input，查询和替换筛选位于窗口内，scope 行在下方；
- 用户明确要求搜索使用弹框模式，底部 dock 形态不正确。

**修复**：

- Parent 删除 Find dock wrapper、resize handle 和 stored height；
- Find in Files 使用 `findToolPopup`：
  - position fixed；
  - `min(900px,92vw)` × `min(680px,76vh)`；
  - 圆角、阴影、四周遮罩；
- 保留 Combo/input、scope、results 和 replace 状态模型；
- File extension 历史：
  - `dsh-editor.find.fileMasks`；
  - `rememberFileMaskHistory` 去重、newest-first、最多 10；
  - Enter accept 和 input blur 写入；
  - dropdown 可选择历史或 Clear。

**IDEA / 运行态证据**：

- IDEA AX：`Find in Files`、File mask checkbox/combobox、Search/Replace、
  Match case/Words/Regex、In Project/Module/Directory/Scope。
- DSH：popup=true、dock=false、position=fixed、query 自动聚焦；
- width≈902px、height≈501px（当前 viewport）；
- File extension 历史菜单显示 `.js` 和 Clear；
- `.js` 过滤后仅 `src/app.js`。

**回归**：

```bash
node --test tests/round630.test.mjs tests/round467.test.mjs \
  tests/round628.test.mjs tests/round487.test.mjs \
  tests/round483.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
node --check lib/terminal.js
git diff --check
```

- 全量：**2086 pass / 0 fail**。

**已排除方案**：

- 不继续使用底部 dock；
- 不恢复 Find height 拖拽状态；
- 不在输入每次字符变化时污染 mask history；
- 不用无历史的下拉箭头占位。

## 2026-11-16 — Find in Files Scope 行与快捷键幂等回焦

**作用域**：Find in Files scope 过滤、Replace All target、双击 Shift 与
CmdShiftF 重复触发、Editor scope 参数传递。

**症状 / 风险**：

- Find in Files 缺少截图中的 Project/Module/Directory/Scope 行；
- 重复按快捷键会重新调用 `openFindTool('', 'find')`，清空 query/filter；
- 首次接入 scope 时父层 shorthand 使用未定义 `activeFilePath`，运行态
  显示 `Editor failed to load: activeFilePath is not defined`。

**修复**：

- 新增 `findToolPathMatchesScope()`：
  - Project 全工作区；
  - Directory 使用活动文件目录前缀；
  - Scope 使用 Project Files / Open Files / Changed Files 允许集合；
- FindToolWindow 新增 activeFilePath/openFilePaths/changedFilePaths；
- 结果 rows、计数、handoff target、Replace All target 全部使用 scoped
  files/matches；
- Parent 传参固定为 `activeFilePath: activePath`；
- shortcut callback 在 Find 已打开时只设置 find mode 并聚焦 query，
  不重建 findTool 初始状态。

**运行态证据**：

- Scope 行显示 Project / Module(disabled) / Directory / Scope；
- Presets 为 Project Files / Open Files / Changed Files；
- Open Files scope 无命中显示 `No matches`；
- 重复 CmdShiftF 后 query=`end`、scopeMode=`scope`、
  scopePreset=`openFiles`，query 输入保持焦点；
- Editor 加载错误消失。

**回归**：

```bash
node --test tests/round628.test.mjs tests/round502.test.mjs \
  tests/round520.test.mjs tests/round614.test.mjs \
  tests/round487.test.mjs tests/round483.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
node --check lib/terminal.js
git diff --check
```

- 全量：**2081 pass / 0 fail**。

**已排除方案**：

- 不伪造 Module 模型；
- 不让 scope 只影响显示而漏掉 Replace All；
- 不在 Find 已打开时用空 query 重置整窗；
- 不保留运行态 shorthand 变量错误。

## 2026-11-16 — 双 Shift 与 CmdShiftF 统一到 Find in Files

**作用域**：Editor 全局搜索快捷键、Find in Files 顶部筛选布局、
File extension/Files provider、Action/Files 的 case/whole-word 匹配。

**用户决策**：

- 双击 Shift 保留快捷键注册，但不再打开 Search Everywhere；
- 双击 Shift 与 `Cmd/Ctrl+Shift+F` 必须调用同一个 Find in Files handler；
- 大小写、全词、文件后缀是共用筛选条件，按 IDEA `Find in Files`
  截图放在顶部右侧；查询行右侧为 `Cc / W / .*`。

**修复**：

- 新增 `openFindInFilesFromShortcut()` 作为单入口；
- 双击 Shift effect 和 Cmd/Ctrl+Shift+F 分支都调用该 callback；
- Find in Files 顶部右上增加 File mask checkbox + 后缀输入；
- 删除单独 File Mask 行；
- Query 行右端增加 Match Case / Whole Words / Regex group；
- extension `.ts, .md` 规范化为 `*.ts,*.md`；Files provider 和 Text
  search 都使用该 filter；
- `fuzzyScore` 支持 caseSensitive/wholeWords，Search Everywhere 的
  Actions/Files 与 Text 共用条件；
- Search/Replace handoff 全部发送规范化 mask。

**运行态证据**：

- 双击 Shift：Find in Files 打开，Search Everywhere=false；
- Cmd+Shift+F：Find in Files 打开，Search Everywhere=false；
- File mask 距右 8px，Regex 距右 10px，mask 在 query row 上方；
- `end`：5 matches / 3 files；
- File extension `.js`：app.js；
- Whole Words：`end` 从 2 处收敛为 1 处；
- mask 外 target 在 replace 中被拒绝。

**回归**：

```bash
node --test tests/round628.test.mjs tests/round627.test.mjs \
  tests/round626.test.mjs tests/round464.test.mjs \
  tests/round483.test.mjs tests/round487.test.mjs \
  tests/round488.test.mjs tests/round508.test.mjs \
  tests/round616.test.mjs tests/round114.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
node --check lib/terminal.js
git diff --check
```

- 全量：**2078 pass / 0 fail**。

**已排除方案**：

- 不保留双 Shift 旧 Search Everywhere 调用；
- 不为两个快捷键复制两套 Find 初始化；
- 不把 File mask 留在 query 下方独立整行；
- 不让 extension 只过滤 Text 而漏掉 Files provider。

## 2026-11-16 — 清理 slash provider 死代码与极窄 Search Everywhere

**作用域**：Search Everywhere 输入语义、CompactActionBar 槽位测量、
极窄视口 tab/toolbar、工作区切换时的双 Shift 状态。

**症状 / 风险**：

- UI 已改为 tab-only，但生产代码仍保留完整 slash provider parser 和
  provider hint，形成第二套不可达语义；
- Search Everywhere 工具栏以 26px 槽位测量，实际样式为 24px 按钮 +
  6px gap；220px 视口下 7 个动作越出 207px 容器但 overflow 未触发；
- tablist 在极窄视口 scrollWidth 大于 clientWidth，页签可能越出边界；
- 工作区 root 变化只关闭弹框，没有显式清空半完成的双 Shift 手势。

**修复**：

- 删除 5 个旧 provider parser helper 与 8 条中英文 hint；
- `CompactActionBar` 新增 `slotWidth` 参数，Search Everywhere 使用 30px；
  默认 26px 保持其它工具窗口行为；
- tablist 增加 `overflowX:auto`、`scrollbarWidth:none` 与 WebKit 隐藏
  滚动条规则；
- root effect 先清空 `doubleShiftAtRef`，再重置搜索/usage/Find 状态；
- 旧 provider 测试改为明确断言 helper 和文案已不存在。

**运行态证据**：

- 220×680：
  - dialog 208px；
  - tablist client 175px / scroll 192px / overflowX auto；
  - toolbar client=scroll=207px；
  - 可见动作：Include non-project、Match Case、Whole Words、Filter、
    Open in Find Tool Window、More actions；
  - overflow 菜单入口真实出现。
- Query Tab：`all → files → text → actions → all`，
  Shift+Tab 反向到 Actions。

**回归**：

```bash
node --test tests/round627.test.mjs tests/round626.test.mjs \
  tests/round178.test.mjs tests/round240.test.mjs \
  tests/round387.test.mjs tests/round455.test.mjs \
  tests/round487.test.mjs tests/round488.test.mjs \
  tests/round611.test.mjs tests/round619.test.mjs \
  tests/round618.test.mjs tests/round114.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
node --check lib/terminal.js
git diff --check
```

- 定向：**58 pass / 0 fail**；
- 全量：**2069 pass / 0 fail**。

**已排除方案**：

- 不为 Search Everywhere 单独复制一个工具栏 overflow 实现；
- 不缩小按钮或继续压缩 gap 强行容纳全部动作；
- 不隐藏溢出的 tab 内容，保留横向滚动与完整键盘访问；
- 不保留仅供测试调用的 slash provider 纯函数。

## 2026-11-16 — Double Shift 稳定性、searchText 重试与 Search Everywhere 布局

**作用域**：Editor 显示期间的双 Shift 全局手势、workspace file API 的
`searchText` 调用、Search Everywhere 顶部页签/工具栏/查询行布局。

**症状**：

- 只有焦点位于 Editor 内部时双 Shift 才响应；Escape 后焦点通常落在
  BODY，下一次双 Shift 像“监听器被消费”一样不再打开；
- Search Everywhere 输入文本时偶发 `unknown operation "searchText"`；
- 页签行和工具栏被 flex 压缩，四页签、七个工具按钮和查询/File Mask
  行堆叠得过密。

**根因**：

- 全局 keydown handler 使用
  `host.contains(document.activeElement)`，把 focus 错当成 Editor 可见性；
- effect 依赖 `searchEverywhereOpen`，弹框开关会重建监听器；
- 浏览器 client 与 host hot-reload 期间可能短暂看到旧 operation table；
- header 子项没有固定 flex basis，dialog 达到 max-height 时 tabs row
  被压缩到约 19px，原 14px gap 和 12px 字号显得拥挤。

**修复**：

- 新增 `visibleEditorWorkspace()`，只认活动 host 的连接与
  `getClientRects()`：Editor 可见即可响应，不要求 focus；
- 双 Shift effect 使用 `searchEverywhereOpenRef`，监听器只注册一次；
  Escape/关闭/窗口 blur 都清空手势状态；
- `callFs` 对 `unknown operation "searchText"` 延时 60ms 重试一次；
- host 对 operation trim，并兼容 `textSearch / search-text` 别名；
- 三个 text-search 消费者共用 `searchTextFailureMessage()`；
- 页签行固定 `flex: 0 0 44px`，gap 22、font 13、padding 16；
  工具栏高度 34、gap 6；查询行 47px；
- 页面提示从 slash command 改为 tab 语义。

**运行态证据**：

- Editor 可见、焦点在外部按钮：双 Shift 打开；
- Escape 后 activeElement=`BODY`：双 Shift 再次打开；
- Editor 隐藏、idle host 存在：双 Shift 不打开；
- Editor 重开后立即可再次打开；
- 连续查询 `en / end / scoped / value / end`：8 条结果、无 alert；
- DOM：tabs row 45px、tablist 44px、toolbar 34px、query row 47px、
  tab font 13px、tab gap 22px。

**回归**：

```bash
node --test tests/round626.test.mjs tests/round508.test.mjs \
  tests/round616.test.mjs tests/round624.test.mjs \
  tests/round464.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
node --check lib/terminal.js
git diff --check
```

- 定向：**35 pass / 0 fail**；
- 全量：**2064 pass / 0 fail**。

**已排除方案**：

- 不以 body/全局 focus 作为双 Shift 条件；
- 不在每次 Escape 后重新注册全局监听器；
- 不把 text-search 持续失败静默为空结果；
- 不靠缩小字号/减少 padding 换取 header 可容纳，改为固定行高并让列表
  承担剩余高度。

## 2026-11-16 — Search Everywhere 收敛为 tab 驱动并校正 Action category

**作用域**：Search Everywhere 的 `All / Files / Text / Actions` result scope、
slash 输入行为、recent search、Action category inventory 和 disabled
Item Info。

**症状 / 决策变化**：

- 旧实现把 `/all`、`/actions`、`/files`、`/text`、唯一前缀补全、
  provider help row 和帮助下按 Enter 补全混入输入框；
- 用户明确要求只保留基础 tab 对齐方式：tab 决定 provider，query 只做
  当前 tab 内的普通文本匹配，不用输入完成 provider/category 选择；
- 旧 category 把 IDEA 的 `Navigate` 写成 `Navigation`，并把 Find Usages
  家族错误地默认成 `Edit | Find`；
- catch-all category 会让新增 Action 在无 IDEA 证据时自动获得分类。

**修复**：

- SearchEverywhere dialog 改为：
  - `const effectiveTab = state.tab;`
  - `const effectiveQuery = query;`
  - 删除 provider command help/suggestion/completion/result 行；
  - query 输入 `Tab / ⇧Tab` 只循环基础页签；
  - tab 点击只 `onTab(tab.id)`，不改写 query；
- `Text…` Action 保留 query 后切到 Text tab；background text search
  直接使用当前 tab 的 literal query；
- recent search 的 `normalizeRecentSearchEntry()` 只 trim，slash 文本原样
  重放，不再推断 provider；
- 新增 33 项显式 `SEARCH_EVERYWHERE_ACTION_CATEGORY_KEYS`：
  - Navigate：6 项；
  - Edit | Find：18 项；
  - Edit | Find Usages：6 项；
  - 无 category：Find Tool Window、Incremental Search、Search with Google；
- disabled Action 的 Item Info meta 由 category 与 disabled reason 组成；
- category 不进入 `rankSearchActions()` 或 result scope 判定。

**IDEA / 运行态证据**：

- IDEA 2026.2 CUA 实窗：
  - Search Everywhere 行分类为 `Navigate`；
  - Find Usages、Show Usages、Find Usages Settings、Find Usages in File、
    Highlight Usages in File、Recent Find Usages 为 `Edit | Find Usages`；
  - Occurrence / Replace / Find in Files 家族为 `Edit | Find`；
  - Tool Window `Find` 与 `Incremental Search` 在 Actions 中无 category。
- DSH Ego Browser：
  - Actions + `replace`：7 个 Action；
  - Files + `README`：1 个文件；
  - Text + `end`：5 条文本命中；
  - All + `/actions`：tab 仍为 All，2 个普通 Action 命中，
    无 provider help/command 行。

**回归**：

```bash
node --test tests/round624.test.mjs tests/round623.test.mjs \
  tests/round620.test.mjs tests/round619.test.mjs \
  tests/round618.test.mjs tests/round612.test.mjs \
  tests/round579.test.mjs tests/round576.test.mjs \
  tests/round571.test.mjs tests/round570.test.mjs \
  tests/round569.test.mjs tests/round474.test.mjs \
  tests/round466.test.mjs tests/round114.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
node --check lib/terminal.js
git diff --check
```

- 定向：**50 pass / 0 fail**；
- 全量：**2058 pass / 0 fail**；
- fixture README/docs/app SHA-256 与基线一致。

**已排除方案**：

- 不在 query 中实现 `/navigate`、`/find-usages` 等 category/provider 语法；
- 不让 category 参与 Action 排名、过滤或结果资格；
- 不为无 IDEA category 的 Tool Window / Incremental Search /
  Search with Google 伪造默认分类；
- 不让最近搜索重放时推断或重写 slash provider。

## 2026-11-16 — Search Everywhere Action category 与窄布局

**作用域**：Search Everywhere Actions 行的 IDEA category 展示、tooltip、
Item Info、响应式布局和本地化。

**症状**：IDEA 2026.2 的 `/replace` Action 结果在快捷键左侧显示
`Edit | Find`，`Search Everywhere`、`Go to File`、`Text` 等显示
`Navigation`；DSH 的 Action 行只有名称、描述和快捷键，缺少可对照的分类
信息，也不能让用户在窄窗口中判断动作归属。

**修复**：

- 新增 `searchEverywhereActionCategory()`，只为有 IDEA 对应语义的
  Search/Replace Action 返回 category：
  - Navigation：Search Everywhere、Go to File、Recent Files、Text、
    Find Action、Show Search History；
  - Edit | Find：Find/Replace、Structural、Selection、Usages、
    Occurrence、Find Next/Previous、Search In Changes、Find/Replace in Files。
- Action row 的 category 放在名称/描述之后、快捷键之前；
- category 同时写入 tooltip 与 Item Info meta；
- 不把文件或文本结果标记成 Action category，不伪造 Java/language-only
  分类；
- 新增 `searchCategoryNavigation` / `searchCategoryEditFind` 中英文文案；
- Action row 使用 `container-type: inline-size`，row 小于 460px 时隐藏
  category；viewport 较窄时再作为 fallback 隐藏，名称、描述、快捷键优先。

**运行态证据**：

- Search Everywhere 查询 `/replace`：7 个结果均显示 `Edit | Find`；
- 查询 `Search Everywhere`：主动作、Find Action、Text 均显示
  `Navigation`；
- 500px viewport、460px row 宽时 category 的 computed style 为
  `display:none`，主信息与快捷键未被挤出。

**回归**：

```bash
node --test tests/round623.test.mjs tests/round622.test.mjs \
  tests/round621.test.mjs tests/round620.test.mjs \
  tests/round619.test.mjs tests/round618.test.mjs \
  tests/round617.test.mjs tests/round114.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
node --check lib/terminal.js
git diff --check
```

- 最终定向：**27 pass / 0 fail**；
- 全量：**2053 pass / 0 fail**；
- fixture README/docs/app SHA-256 与基线一致，未留下运行态修改。

**已排除方案**：

- 不给 Action 之外的 File/Text 结果伪造 category；
- 不把分类放在快捷键之后或挤占名称描述；
- 不在窄布局隐藏名称、描述或快捷键；
- 不新增没有 IDEA 证据的语言相关 category。

## 2026-11-16 — Recent search 历史旧 slash 格式迁移

**作用域**：Search Everywhere 工作区 recent search history。

**症状**：旧版本把 `/replace`、`/te`、`/` 等 slash 输入原样写入
`dsh-editor.search.history:<workspace-root>`。新语义下 `/replace` 是内容
query，`/te`/`/` 只是 provider 帮助，不应作为可重放搜索项。

**修复**：

- 新增 `normalizeRecentSearchEntry()`：
  - 未知 slash 内容去前导 `/`；
  - provider 后缀取内容 query；
  - provider-only/help 返回空；
- 新增 `rememberRecentSearchHistory()`，在归一化后按 newest-first 去重；
- recent search 的 read/write、workspace recorder 和 Editor callback 使用
  wrapper；
- Find Usages history 继续使用原 helper，不改变 symbol query；
- 读取只归一化内存，不写 localStorage；下一次历史写入才持久化。

**运行态证据**：

- 旧值包含 `/replace`、`/te`、`/`；
- 菜单显示 `replace`，且 `/te`、`/` 消失；
- 菜单打开前后 localStorage 原值一致。
- 全量：**2043 pass / 0 fail**。

**回归**：

```bash
node --test tests/round620.test.mjs tests/round619.test.mjs \
  tests/round466.test.mjs tests/round537.test.mjs \
  tests/round609.test.mjs tests/round114.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
node --check lib/terminal.js
git diff --check
```

**已排除方案**：

- 不在页面加载/读取历史时立即改写存储；
- 不把 Find Usages history 一并 slash 归一化；
- 不保留 provider-only 条目作为空 recent search。

## 2026-11-16 — Slash 文本误入 Actions-only 与 Action 菜单对照

**作用域**：Search Everywhere slash query、All 结果混排、background text search。

**症状**：DSH 把任意 `/replace`、`/end` 都当作 Actions command mode：

- 文件与文本结果被隐藏；
- `searchEverywhereTextQuery.startsWith('/')` 直接跳过 background search；
- IDEA 2026.2 CUA 实窗 `/replace` 实际仍显示文件结果与 Action 结果。

**修复**：

- 新增 `searchEverywhereContentQuery(query)`：
  - provider help/唯一前缀返回空；
  - 已知 provider 返回后缀 query；
  - 其它 slash 文本去掉前导 `/` 后继续作为 All 跨 provider query；
- SearchEverywhere 删除 commandMode Actions-only 分支；
- background text search 与 UI effective query 共用同一 helper；
- disabled Action 仍保留并由键盘 traversal 跳过。

**运行态证据**：

- `/end` 同时出现 Action 和 README/docs/src 的 5 条文本命中；
- `/replace` 保持 7 个真实相关 Action；
- IDEA Action 结果右键无业务菜单，`Shift+F10` 显示 Assign Shortcut；
  DSH 的只读 Item Info 不扩展 Run/Refactor。
- 全量：**2037 pass / 0 fail**。

**回归**：

```bash
node --test tests/round618.test.mjs tests/round617.test.mjs \
  tests/round466.test.mjs tests/round473.test.mjs \
  tests/round474.test.mjs tests/round475.test.mjs \
  tests/round114.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
node --check lib/terminal.js
git diff --check
```

**已排除方案**：

- 不把所有 slash 输入都取消为普通查询；provider 命令仍保留 scope；
- 不让 background search 继续接收带 `/` 的 query；
- 不在 Action 右键中伪造 IDEA 当前没有的 Run/Refactor 菜单项。

## 2026-11-16 — `/replace` Action 噪声与替换 Enter 修饰键

**作用域**：Search Everywhere Actions 过滤、FindNext/FindPrevious 描述、
Search Everywhere 与 Find 的 replacement input 键盘语义。

**症状**：

- DSH `/replace` 混入 Incremental Search、Previous Occurrence、Find Usages
  等不含连续 `replace` 词的 Action；
- 根因是 description/keywords 也使用整段散字母 fuzzy subsequence；
- Find replacement 只识别 `metaKey`，Windows `Ctrl+Enter` 会错走单处替换；
- Shift+Enter、Alt+Enter 也会触发 Search Everywhere/Find 替换写入。

**实现**：

- label 继续允许 IDEA 模糊缩写；
- description/keywords 归一化为词序列，query 每词必须命中目标词前缀；
- FindNext/FindPrevious/FindInPath/ReplaceInPath 使用 ActionsBundle
  英文/中文原文 description；
- 新增 `replaceInputAction(event, plainEnter)`：
  - 无修饰 Enter 按调用面语义解析；
  - Meta 或 Ctrl 统一解析为 Replace All；
  - Shift、Alt、IME composing 返回 null；
- 两个 replacement input 共用该 helper。

**运行态证据**：

- `/replace` 从 9 条噪声结果收敛到 7 条真实相关 Action；
- `Replace in Files…` Enter 后 Find replace mode 打开，query 焦点正确；
- Shift/Alt+Enter `replaceText=0`，Ctrl+Enter 触发 1 次。
- 全量：**2034 pass / 0 fail**。

**回归**：

```bash
node --test tests/round617.test.mjs tests/round543.test.mjs \
  tests/round531.test.mjs tests/round528.test.mjs \
  tests/round474.test.mjs tests/round473.test.mjs \
  tests/round472.test.mjs tests/round114.test.mjs \
  tests/round503.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
node --check lib/terminal.js
git diff --check
```

**已排除方案**：

- 不移除 label 模糊搜索；
- 不把 description 的散字母匹配继续保留为弱结果；
- 不让 Ctrl+Enter 依赖 macOS Meta 专用判断；
- 不用 Shift/Alt+Enter 猜测上一处替换等未验证语义。

## 2026-11-16 — Monaco 初始化读取未声明 Search Everywhere 的 TDZ

**作用域**：Editor 初次打开、Monaco 搜索回调和 Search Everywhere 初始化顺序。

**症状**：真实 DSH Web 显示 `Editor failed to load`，错误为
`Cannot access 'openSearchEverywhere' before initialization`。

**根因**：

- Monaco 初始化 `useEffect` 在 JSX 末尾的 `openSearchEverywhere`
  声明之前执行；
- effect body 内的回调本身可延后执行，但其 dependency array 在 render
  时立即读取 `openSearchEverywhere`，因此命中 TDZ；
- 静态正则测试和 `node --check` 不能发现这类运行时初始化顺序问题。

**修复**：

- 新增 `openSearchEverywhereRef`，Monaco 的 `onSearchText` 只通过
  ref 调用；
- 删除两个 Monaco effect dependency array 中的直接变量引用；
- provider 声明后同步 `openSearchEverywhereRef.current`；
- round616 增加声明前不得直接引用 `openSearchEverywhere` 的回归。

**运行态证据**：

- 修复前 Editor 启动失败；
- 修复后 reload 可正常加载 Project、Find 和 Monaco；
- 双 Shift 打开 Search Everywhere，`end` 查询与 `⌘R` handoff 正常。

## 2026-11-16 — Replace 写入同步守卫与确认路径

**作用域**：Search Everywhere Replace All、Find Replace All、Find 单处 Replace。

**症状**：两个同一 task 内的 `Enter / Meta+Enter` 可以在 React
`replaceBusy` commit 前同时进入 Replace handler，形成重复确认或重复
`replaceText` 请求。

**修复**：

- 新增共享 `replaceWriteBusyRef`；
- `claimReplaceAttempt()` 同步占位，`releaseReplaceAttempt()` 显式释放；
- 三条替换路径在执行确认/写入前 claim；
- confirm cancel 立即 release，成功与失败统一在 `finally` 释放；
- 原有 React busy state 继续只负责 disabled UI 和提示。

**回归**：

```bash
node --test tests/round616.test.mjs tests/round521.test.mjs \
  tests/round520.test.mjs tests/round518.test.mjs \
  tests/round516.test.mjs tests/round513.test.mjs \
  tests/round467.test.mjs tests/round584.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
node --check lib/terminal.js
git diff --check
```

- RED：**3 fail**；
- 定向：**24 pass / 0 fail**；
- 全量：**2029 pass / 0 fail**；
- 运行态取消：Find 打开、query/replacement/结果数/替换输入焦点保留；
- 运行态重入：快速两次 `Meta+Enter` = `confirmCalls:1`,
  `replaceText:1`；
- 运行态成功：5 处/3 文件写入，Monaco 和状态栏刷新；
- fixture 原始 SHA-256 已恢复。

**已排除方案**：

- 不只依赖 React `replaceBusy`（state commit 存在时间窗）；
- 不在 confirm cancel 后把 ref 永久锁死；
- 不为三条替换路径各造一个独立 guard；
- 不把运行态 fixture 的临时替换写入留在磁盘。

## 2026-11-16 — Find tool 根级 Escape 与关闭回焦

**作用域**：持久 Find tool 的 File Mask、预览工具栏、动作栏和窗口关闭焦点。

**症状**：查询、替换和结果行已有局部 `Escape`，但 File Mask、预览按钮和
工具栏没有统一关闭路径；Find 整个卸载后浏览器可能把焦点落到 `body`，
当前 Monaco 的全局快捷键随即失效。

**实现**：

- FindToolWindow 根增加 `Escape` 处理器：
  - `defaultPrevented` 的局部处理器保持优先；
  - 菜单目标继续交给 `ContextMenu` capture listener；
  - 其它控件调用窗口统一 `onClose`。
- replacement input 的 `Escape` 增加 `stopPropagation`，防止根级二次关闭；
- 新增 `closeFindToolWindow()`：
  - `setFindTool(null)` 后异步聚焦 `currentCodeEditor()`；
  - `Hide`、`Escape` 与工具栏 overflow 中的关闭动作共用；
- 不改 `CompactActionBar`、Search Everywhere handoff 或搜索状态。

**回归**：

```bash
node --test tests/round615.test.mjs tests/round614.test.mjs \
  tests/round613.test.mjs tests/round612.test.mjs \
  tests/round497.test.mjs tests/round487.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
node --check lib/terminal.js
git diff --check
```

- RED：**3 fail**；
- 定向：**24 pass / 0 fail**；
- 全量：**2025 pass / 0 fail**。

**已排除方案**：

- 不在每个工具栏按钮上分别复制关闭逻辑；
- 不让 replacement input 冒泡触发窗口根二次关闭；
- 不在卸载前同步 `focus()` 已失效控件；
- 不为运行态验收接管仍由用户控制的 TaskSpace 133。

## 2026-11-16 — Find tool 菜单回焦 fallback

**作用域**：持久 Find tool 的 Query/Replace History 与 Result ContextMenu。

**实现**：

- FindToolWindow 增加 `queryInputRef`；
- query history fallback → query input；
- replace history fallback → replacement input，缺失时 query；
- result menu fallback → query；
- opener 有效时继续使用 ContextMenu 原回焦；
- handoff active descendant 与滚动定位不变。

**回归**：

```bash
node --test tests/round614.test.mjs tests/round613.test.mjs \
  tests/round589.test.mjs tests/round533.test.mjs tests/round492.test.mjs
npm test
node --check lib/client.js
git diff --check
```

- RED：**3 fail**；
- 定向：**19 pass / 0 fail**。

**已排除方案**：

- 不在结果刷新时强制把焦点从 opener 抢到 query；
- 不让 replacement history 错回 query；
- 不允许焦点落到 `body`；
- 不修改 handoff active descendant 的既有 revision 机制。

## 2026-11-16 — Search Everywhere ContextMenu 回焦 fallback

**作用域**：Search Everywhere History、Filter、Result 菜单关闭后的焦点恢复。

**症状**：ContextMenu 原本只在 opener 仍 `isConnected` 时恢复焦点；过滤或异步刷新导致 opener 卸载后，焦点可能落到 `body`。

**实现**：

- `ContextMenu` menu 元数据新增 `fallbackFocus`：
- opener 有效时保持原回焦；
- opener 失效时调用 fallback；
- Search Everywhere 的 Filter、Query/Find Usages/Replace History、Result menu 全部 fallback 到 query；
- Item Info 继续独立地从关闭按钮回 query。

**回归**：

```bash
node --test tests/round613.test.mjs tests/round612.test.mjs \
  tests/round589.test.mjs tests/round533.test.mjs tests/round492.test.mjs
npm test
node --check lib/client.js
git diff --check
```

- RED：**2 fail**；
- 定向：**19 pass / 0 fail**；
- ContextMenu 兼容回归：**47 pass / 0 fail**；
- 全量：**2018 pass / 0 fail**。

**已排除方案**：

- 不把 `document.body` 当作回焦目标；
- 不改变 opener 仍有效时的原有回焦语义；
- 不让 Item Info 依赖已被关闭的 Result menu opener。

## 2026-11-16 — Search Everywhere 模态焦点循环

**作用域**：Search Everywhere 弹框内非查询控件的 Tab 焦点边界。

**实现**：

- 新增 `searchEverywhereNextFocusIndex()`：
  - 正向/反向循环；
  - 空列表返回 null；
  - 失效 index 收敛到首/尾。
- dialog root 新增 `trapSearchEverywhereFocus()`：
  - 过滤 disabled 与不可见 focusable；
  - 在弹框内部首尾回绕；
  - 不泄漏焦点到背后 Editor/Chat。
- query input 的 Tab 处理仍是更高优先级：
  - provider 唯一前缀补全；
  - provider tab 正反循环；
  - stopPropagation 后不进入通用 trap。
- dialog key 顺序：focus trap → Item Info Escape → History fallback。

**回归**：

```bash
node --test tests/round612.test.mjs tests/round610.test.mjs \
  tests/round609.test.mjs tests/round608.test.mjs
npm test
node --check lib/client.js
git diff --check
```

- RED：**3 fail**；
- 定向：**17 pass / 0 fail**；
- 全量：**2014 pass / 0 fail**。

**已排除方案**：

- 不抢查询框的 provider Tab 语义；
- 不把隐藏/disabled 控件纳入焦点循环；
- 不在弹框外注册第二套 focus trap。

## 2026-11-16 — Search/Find/Replace ActionsBundle parity 闭环

**作用域**：IDEA 2026.2 搜索/查找/替换相关 ActionsBundle 与本插件入口的最终静态分类。

**实现**：

- 新增 `docs/search-everywhere-parity.md`：
  - 22 个可见 Action 到 DSH id 的映射；
  - disabled 的 settings、structural search/replace 边界；
  - 内部 Search Everywhere 行为；
  - 不适用于 DSH 的补全、Java 重构、Finder、SpeedSearch 等；
- round611 测试要求文档、client action id 和内部行为函数保持一致。

**回归**：

```bash
node --test tests/round611.test.mjs tests/round610.test.mjs tests/round609.test.mjs
npm test
node --check lib/client.js
git diff --check
```

- RED：**4 fail**；
- 定向：**13 pass / 0 fail**；
- 全量：**2010 pass / 0 fail**。

**已排除方案**：

- 不把 Search Everywhere 内部 Tab/Group/SelectItem 伪造成独立 Action；
- 不为 language AST 或 language-aware usage scope 伪造实现；
- 不让 parity 只停留在一次聊天结论，必须进入 docs 和回归。

## 2026-11-16 — Item Info 焦点闭环与 shortcut 执行矩阵

**作用域**：Search Everywhere Item Info 的键盘焦点，以及 Action shortcut 到真实执行路径的回归覆盖。

**实现**：

- `resultInfoCloseRef`：
  - Info 打开后焦点进入关闭按钮；
  - 关闭时回焦 query。
- `handleSearchEverywhereDialogKeyDown()`：
  - resultInfo 存在时在 dialog 层处理 Escape；
  - 无 Info 时仍调用 Show Search History helper；
  - 避免 Tab 到关闭按钮后 Escape 误关整个 Search Everywhere。
- round610 增加 shortcut execution matrix：
  - 21 个可见 shortcut Action 逐项断言真实执行 API；
  - disabled Settings 断言 `disabled: true`；
  - Action ID 保持唯一。

**回归**：

```bash
node --test tests/round610.test.mjs tests/round609.test.mjs \
  tests/round608.test.mjs tests/round478.test.mjs
npm test
node --check lib/client.js
git diff --check
```

- RED：**2 fail**；
- 定向：**16 pass / 0 fail**；
- 全量：**2006 pass / 0 fail**。

**已排除方案**：

- 不让 Info 的 Escape 依赖 query/list 当前焦点；
- 不新增第二套 Search Everywhere key handler；
- 不把 shortcut 矩阵做成仅文档说明而不进入回归。

## 2026-11-16 — Show Search Everywhere Item Info

**作用域**：Search Everywhere Action、File、Text 三类结果的 Item Info 入口和真实元数据展示。

**证据**：

- IDEA 2026.2 English ActionsBundle：
  `Show Search Everywhere Item Info`；
- 中文语言包：
  `显示“随处搜索”条目信息`；
- Action 没有默认 keybinding。

**实现**：

- `searchEverywhereItemInfo()` 只生成 DSH 已有数据：
  - Action：label / description / shortcut / disabled reason；
  - File：basename + workspace path；
  - Text：basename + `path:line:column` + preview。
- Action/File/Text 结果菜单都提供同一入口；
- Action 行现在也支持右键与 `Shift+F10`；
- Info panel 使用 `role="status"`、`aria-live="polite"` 和关闭按钮；
- Escape 收起 Info 并回焦查询框，query/tab 变化清除旧 Info；
- Find tool 不注册 Info 菜单项，避免有入口无面板。

**回归**：

```bash
node --test tests/round609.test.mjs tests/round608.test.mjs \
  tests/round607.test.mjs tests/round477.test.mjs \
  tests/round478.test.mjs tests/round496.test.mjs \
  tests/round497.test.mjs tests/round499.test.mjs \
  tests/round500.test.mjs tests/round588.test.mjs tests/round589.test.mjs
npm test
node --check lib/client.js
git diff --check
```

- RED：**5 fail**；
- 定向：**41 pass / 0 fail**；
- 全量：**2002 pass / 0 fail**。

**已排除方案**：

- 不伪造 class/symbol/module 元数据；
- 不在 Find tool 中显示无实现的 Info 项；
- 不复用 hover tooltip 替代可访问的显式入口；
- 不把无 keybinding 的 IDEA Action 强行绑定快捷键。

## 2026-11-16 — Show Search History 覆盖整个 Search Everywhere

**作用域**：Search Everywhere `Show Search History / ⌥↓` 在弹框内部不同焦点区域的执行一致性。

**症状 / 根因**：

- Action 行展示 `⌥↓`；
- 旧实现只在 query input 的 `onKeyDown` 中打开查询历史；
- Results listbox、Tabs、工具栏或其他弹框控件获得焦点后，同一
  shortcut 无响应。

**实现**：

- 新增 `searchHistoryShortcutMatches()`，严格匹配 alt+ArrowDown；
- SearchEverywhere dialog root 统一处理该 chord；
- Query input 保留本地 handler；
- Replace input 增加 `data-dsh-search-replace-input`，继续使用替换
  历史；
- File Mask、Tabs、工具栏与 Listbox 使用查询历史；
- 菜单锚点继续复用 Search input 的几何位置和现有
  `openQueryHistoryMenuAt()`。

**回归**：

```bash
node --test tests/round608.test.mjs tests/round607.test.mjs \
  tests/round492.test.mjs tests/round533.test.mjs \
  tests/round582.test.mjs tests/round556.test.mjs
npm test
node --check lib/client.js
git diff --check
```

- RED：**3 fail**；
- 定向：**23 pass / 0 fail**；
- 全量：**1997 pass / 0 fail**。

**已排除方案**：

- 不用 window-level 第二套 Search Everywhere handler；
- 不让替换输入框 Alt+Down 错开查询历史；
- 不修改 recentSearches 数据结构；
- 不在弹框外抢占 Alt+Down。

## 2026-11-16 — Diff surface 独占 Search In Changes

**作用域**：Commit/Compare Diff 内 Cmd/Ctrl+F 与源码编辑器全局 Search 快捷键的上下文边界。

**症状 / 根因**：

- Search Everywhere Action 宣称 `⌘F`，DiffPreview 也提供 Monaco
  `actions.find`；
- 但编辑器全局 Cmd/Ctrl+F 捕获器注册更早，可能先打开隐藏源码编辑器
  的 Find；
- Diff 工具栏/header 获得焦点时，旧 `insideDiffPane` 判断不会进入
  Search In Changes；
- Find Next 的 F3 备用键也可能在 Diff 中操作旧 source editor。

**实现**：

- DiffPreview 根节点增加 `data-dsh-editor-diff-surface`；
- Cmd/Ctrl+F 使用 `insideDiffSurface`，覆盖 Monaco、side header 与
  工具栏；
- 编辑器全局 search family 在 target/activeElement 位于 Diff surface
  时立即 return；
- Find step 的 blocked selector 加入 Diff surface；
- 继续复用 DiffPreview 原 `searchInChanges()` 与 Monaco `actions.find`。

**回归**：

```bash
node --test tests/round607.test.mjs tests/round606.test.mjs \
  tests/round205.test.mjs tests/round208.test.mjs \
  tests/round172.test.mjs tests/round203.test.mjs \
  tests/round285.test.mjs tests/round292.test.mjs \
  tests/round507.test.mjs tests/round598.test.mjs
npm test
node --check lib/client.js
git diff --check
```

- RED：**4 fail**；
- 定向：**32 pass / 0 fail**；
- 全量：**1993 pass / 0 fail**。

**已排除方案**：

- 不新增第二个 Diff Find；
- 不在编辑器全局捕获器里直接调用 Diff runner；
- 不允许 F3 操作 Diff 后隐藏的源码编辑器；
- 不改变 Diff 既有 F7、Escape、undo/redo 所有权。

## 2026-11-16 — Find Next/Previous 的 IDEA 备用 chord

**作用域**：Search Everywhere Actions 与编辑器 Find 的上一处/下一处快捷键。

**证据**：IDEA 2026.2 keymap 需要分层读取：

- `$default.xml`；
- `Mac OS X 10.5+.xml`；
- `macOS System Shortcuts.xml`。

`Mac OS X 10.5+.xml` 中：

- `FindNext = F3; control L; meta G`；
- `FindPrevious = shift F3; control shift L; meta shift G`；
- `GotoFile = meta shift O`；
- `FindInPath = meta shift F`；
- `ReplaceInPath = meta shift R`。

**实现**：

- Action 可见主 chord 继续显示 `⌘G / ⇧⌘G`；
- 新增 `ideaFindStepShortcutAction()`：
  - `F3 / ⇧F3` 全平台可用；
  - `Control+L / Control+Shift+L` 仅 macOS；
- 使用 `editorFindQueryActiveRef`，只有编辑器 Find 有非空 query 时
  才消费备用键；
- Terminal、Project、Commit、Find tool 和普通输入框不让路；
- 复用现有 `editorFindStepRef.current()`，不复制步进算法；
- 非 macOS 的 `Ctrl+L` 继续由 Monaco Go to Line 使用。

**回归**：

```bash
node --test tests/round606.test.mjs tests/round605.test.mjs \
  tests/round509.test.mjs tests/round511.test.mjs \
  tests/round542.test.mjs tests/round469.test.mjs tests/round146.test.mjs
npm test
node --check lib/client.js
git diff --check
```

- RED：**3 fail**；
- 定向：**30 pass / 0 fail**；
- 全量：**1988 pass / 0 fail**。

**已排除方案**：

- 不用 F3 在无活动 Find 时抢浏览器查找；
- 不在非 macOS 抢占 `Ctrl+L` Go to Line；
- 不新增第二套 Find match 算法；
- 不把 F3 备选 chord 拼进 Action 可见 shortcut。

## 2026-11-16 — Usage 家族 macOS 主 chord 与备用 chord

**作用域**：Search Everywhere Actions 中 Find Usages / Show Usages / Find Usages Settings 的平台键位与执行路径。

**证据**：

- IDEA 2026.2 `$default.xml`：
  - `FindUsages = alt F7`；
  - `ShowUsages = control alt F7`；
  - `ShowSettingsAndFindUsages = control shift alt F7`。
- `macOS System Shortcuts.xml`：
  - `FindUsages = ctrl U; alt F7`；
  - `ShowUsages = ctrl alt U; meta alt F7`；
  - `ShowSettingsAndFindUsages =
    control shift alt U; meta shift alt F7`。

**实现**：

- `ideaUsageFamilyShortcut()` 是 Actions 可见 shortcut 的唯一来源：
  - macOS 主 chord `⌃U / ⌃⌥U / ⌃⇧⌥U`；
  - 其他平台 `⌥F7 / ⌃⌥F7 / ⌃⇧⌥F7`。
- `ideaUsageFamilyShortcutAction()` 同时匹配主 chord 与 macOS
  备用 chord；
- 真实 dispatch 仅接受 `[data-dsh-editor-file-surface]` 内 Monaco
  source editor 的焦点；
- 复用现有 `openFindUsages()` / `openShowUsages()`；
- Settings 仍 disabled，命中时不会消费事件。

**回归**：

```bash
node --test tests/round605.test.mjs tests/round604.test.mjs \
  tests/round603.test.mjs tests/round602.test.mjs \
  tests/round529.test.mjs tests/round579.test.mjs \
  tests/round586.test.mjs tests/round587.test.mjs tests/round556.test.mjs
npm test
node --check lib/client.js
git diff --check
```

- RED：**4 fail**；
- 定向：**38 pass / 0 fail**；
- 全量：**1984 pass / 0 fail**。

**已排除方案**：

- 不在 macOS 继续把默认 keymap chord 当作主快捷键；
- 不从输入框、Terminal、Project、Commit 或 Diff 抢 Usage chord；
- 不为 disabled Settings 伪造执行路径；
- 不复制 Find Usages / Show Usages 的搜索或弹框实现。

## 2026-11-16 — Usage Action 的 macOS 备用 chord

**作用域**：源码编辑器中 Find Usages in File / Highlight Usages in File 的 IDEA macOS 备用快捷键。

**证据**：

- `macOS System Shortcuts.xml`：
  - `FindUsagesInFile = ctrl shift U; meta F7`；
  - `HighlightUsagesInFile = ctrl meta U; meta shift F7`。
- Monaco 0.52.2：
  - `CtrlCmd+U` 是 cursor undo；
  - `CtrlCmd+K, CtrlCmd+U` 是注释 chord；
  - 未发现 `Control+Shift+U` / `Control+Meta+U` 默认绑定。

**实现**：

- macOS 的 `dsh-editor.findUsagesInFile.*` 接受：
  - `Meta+F7`；
  - `Control+Shift+U`；
- macOS 的 `dsh-editor.highlightUsagesInFile.*` 接受：
  - `Shift+Meta+F7`；
  - `Control+Meta+U`；
- 非 macOS 保持单个默认 chord；
- Action 行只展示主 shortcut，不把备用 chord 拼入可见文本；
- 备用 chord 仍只存在于 Monaco source action，不新增 window listener。

**回归**：

```bash
node --test tests/round604.test.mjs tests/round603.test.mjs \
  tests/round602.test.mjs tests/round329.test.mjs tests/round530.test.mjs
npm test
node --check lib/client.js
git diff --check
```

- RED：**2 fail**；
- 定向：**19 pass / 0 fail**；
- 全量：**1979 pass / 0 fail**。

**已排除方案**：

- 不覆盖 Monaco 既有 `CtrlCmd+U` cursor undo；
- 不在非 macOS 添加 IDEA macOS 专有 U chord；
- 不把备用 chord 加入 Actions visible metadata；
- 不新增第二套 window-level usage shortcut handler。

## 2026-11-16 — 搜索 Action 的真实 Monaco keybinding

**作用域**：Search Everywhere 中 5 个可直接执行的搜索/查找 Action 在源码编辑器内的真实快捷键。

**实现**：

- `ideaControlKeyModifier()` 区分 IDEA 物理 Control：
  - macOS → Monaco `KeyMod.WinCtrl`；
  - 其他平台 → `KeyMod.CtrlCmd`；
- 两个源码 Monaco group 注册：
  - `Text… = Control+Shift+Alt+E`；
  - `Find Usages in File = Meta+F7`（macOS）/`Control+F7`；
  - `Highlight Usages in File = Shift+Meta+F7`（macOS）；
  - 下一处 occurrence `= Control+F3`；
  - 上一处 occurrence `= Control+Shift+F3`；
- `Text…` 复用 `openSearchEverywhere('text')`，并延迟回焦
  `data-dsh-search-query`；
- 不增加 window-level F7/F3 listener，因此 Terminal、Project tree、
  Commit Changes/Log、输入框与 Diff 保持原有键盘所有权。

**回归**：

```bash
node --test tests/round603.test.mjs tests/round602.test.mjs \
  tests/round329.test.mjs tests/round530.test.mjs \
  tests/round549.test.mjs tests/round531.test.mjs tests/round529.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
git diff --check
```

- RED：**4 fail**；
- 定向：**30 pass / 0 fail**；
- 全量：**1975 pass / 0 fail**。

**已排除方案**：

- 不用 `CtrlCmd` 表示 macOS 的 `⌃F3`，否则会错误变成 `⌘F3`；
- 不新增全局 F7/F3 捕获；
- 不在 `Text…` 快捷键里复制第二套 Search Everywhere；
- 不把快捷键挂到 Diff 或旧 source editor 上。

**环境限制**：Ego TaskSpace `133` 仍是 `agentDelegatedToUser`，权限提示未由用户处理，本轮未做 DSH Web 键盘运行态验收。

## 2026-11-16 — Search Everywhere 搜索动作 keymap 元数据

**作用域**：Search Everywhere Actions 中直接可执行搜索/替换动作的快捷键展示与 ARIA。

**证据**：本机 IDEA 2026.2
`/Applications/Intellij.app/Contents/lib/intellij.platform.ide.impl.jar`：

- `keymaps/$default.xml`：
  - `TextSearchAction = control shift alt E`；
  - `FindUsagesInFile = control F7`；
  - `HighlightUsagesInFile = control shift F7`；
  - `FindWordAtCaret = control F3`；
  - `FindPrevWordAtCaret = control shift F3`；
- `keymaps/macOS System Shortcuts.xml`：
  - `FindUsagesInFile` 覆盖为 `ctrl shift U; meta F7`；
  - `HighlightUsagesInFile` 覆盖为 `ctrl meta U; meta shift F7`；
  - `TextSearchAction = shift ctrl alt E`。

**实现**：

- `textSearch` 显示 `⌃⇧⌥E`；
- `findUsagesInFile` 显示 macOS 主 chord `⌘F7`；
- `highlightUsagesInFile` 显示 macOS 主 chord `⇧⌘F7`；
- `findNextWordOccurrence` 显示 `⌃F3`；
- `findPreviousWordOccurrence` 显示 `⌃⇧F3`；
- 全部复用 `searchEverywhereAriaKeyShortcuts()` 生成 ARIA；
- `findToolWindow` 不宣称 `Alt+3`，因为 DSH 已把该键用于 Commit。

**回归**：

```bash
node --test tests/round602.test.mjs tests/round601.test.mjs \
  tests/round600.test.mjs tests/round556.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
git diff --check
```

- RED：**2 fail**（metadata 缺失、测试函数提取器 SyntaxError）；
- 定向：**12 pass / 0 fail**。

**已排除方案**：

- 不把默认 keymap 的 `⌃F7 / ⌃⇧F7` 错误显示到 macOS；
- 不把 Search Everywhere 内部 Tab/Group/SelectItem chord 变成独立 Action；
- 不让 Find tool window 冒充 `Alt+3`；
- 不修改 production 逻辑迎合错误的测试函数提取器。

## 2026-11-16 — Find Action 全局工作台 chord

**作用域**：Search Everywhere 外的 Editor 工作台 Find Action 快捷键。

**实现**：

- 复用 `findActionShortcutMatches()`：
  - macOS Meta+Shift+A / Meta+Shift+P；
  - 非 macOS Control+Shift+A；
- `findActionShortcutBlockedByChildContext()` 让路给：
  - Monaco；
  - input/textarea/contenteditable；
  - Terminal；
  - Commit/Changes panel；
  - Commit Log；
  - Project tree；
- Editor 全局 capture listener：
  - Search Everywhere 已打开时退出，由弹框内 listener 处理；
  - 只在 `[data-dsh-editor-workspace]` 含 activeElement 时生效；
  - 子上下文拥有 chord 时退出；
  - 空闲上下文调用 `openSearchEverywhere('actions')`；
  - `preventDefault/stopPropagation`；
  - 延迟回焦查询框。

**冲突边界**：

- Commit `⌘⇧A` stage 必须优先；
- Terminal `⌘A`/自有快捷键不被抢占；
- Monaco 与输入框保留自身行为；
- Project tree typeahead 与 Log/Changes filter 不被干扰。

**回归**：

```bash
node --test tests/round601.test.mjs tests/round600.test.mjs \
  tests/round239.test.mjs tests/round44.test.mjs tests/round205.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
git diff --check
```

- RED：**3 fail**；
- 定向：**14 pass / 0 fail**；
- 全量：**1968 pass / 0 fail**。

**已排除方案**：

- 不在全局重定义第二套 Search Everywhere；
- 不抢 Commit stage / Terminal / tree / filter；
- 不在 Search Everywhere 已打开时由外部 listener 再处理；
- 不关闭后重开弹框。

## 2026-11-16 — Find Action keymap 对齐

**作用域**：Search Everywhere 中 `Find Action…` 的快捷键元数据和 chord。

**证据**：

- `intellij.platform.ide.impl.jar!keymaps/$default.xml`：
  `GotoAction = control shift A`；
- `keymaps/macOS System Shortcuts.xml`：
  `GotoAction` 同时包含 `meta shift P` 与 `meta shift A`；
- ActionsBundle 文案已对齐 `Find Action… / 查找操作…`。

**实现**：

- `findActionShortcutMatches()` 统一平台判断：
  - macOS Meta+Shift+A / Meta+Shift+P；
  - 非 macOS Control+Shift+A；
  - 排除 Alt、无 Shift、IME composing；
- `findAction` Action 行显示 `⇧⌘A`，现有 ARIA normalizer 生成
  `Shift+Meta+A`；
- Search Everywhere 内新增 window capture listener：
  - preventDefault/stopPropagation；
  - query 清空；
  - tab=`actions`；
  - 回焦查询框；
  - 弹框保持打开，不写历史。

**回归**：

```bash
node --test tests/round600.test.mjs tests/round599.test.mjs \
  tests/round598.test.mjs tests/round597.test.mjs tests/round556.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
git diff --check
```

- RED：**3 fail**；
- 定向：**14 pass / 0 fail**；
- 全量：**1965 pass / 0 fail**。

**已排除方案**：

- 不把 macOS `meta shift P` 显示成主 shortcut；
- 不在非 macOS 接受 Meta+Shift+A；
- 不让输入法 composing 状态触发；
- 不关闭 Search Everywhere 后重新打开。

## 2026-11-16 — Search Everywhere 顶层 Actions 入口

**作用域**：Search Everywhere Actions 中的顶层 Search Everywhere action。

**证据**：

- `ActionsBundle`：
  `action.SearchEverywhere.text=Search Everywhere`；
- 中文语言包：`随处搜索`；
- 原 description 宣称搜索 classes/files/tool windows/actions/preferences；
- DSH 真实的 Search Everywhere 只有 files/text/actions，故 description 使用
  `Search files, text, and actions / 搜索文件、文本和操作`，不伪造缺失索引。

**实现**：

- Actions 新增第 33 项 `searchEverywhere`；
- 复用现有 `openSearchEverywhere('all')`，没有复制第二套 opener；
- keepOpen；
- query 清空、tab=`all`、index=0；
- 延迟回焦 `[data-dsh-search-query]`；
- rememberQuery=false；
- 双击 Shift 仍是唯一外部 opener。

**回归**：

```bash
node --test tests/round599.test.mjs tests/round598.test.mjs \
  tests/round597.test.mjs tests/round553.test.mjs tests/round555.test.mjs \
  tests/round557.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
git diff --check
```

- RED：**2 fail**；
- 定向：**21 pass / 0 fail**；
- 全量：**1962 pass / 0 fail**。

**已排除方案**：

- 不复制 Search Everywhere 初始化逻辑；
- 不在 action description 中宣称 Classes/Symbols/Preferences；
- 不关闭弹框后再重开；
- 不把双击 Shift 定义成普通 keymap chord。

## 2026-11-16 — Search In Changes Actions 入口

**作用域**：Search Everywhere Actions 中的 IDEA Diff 搜索入口。

**证据**：

- `ActionsBundle`：
  `action.Vcs.Diff.ToggleSearchInChanges.text=Search In Changes`；
- 中文语言包：`在更改中搜索`；
- 该 action 是 Diff 编辑器查找，不是 Commit changes path filter。

**实现**：

- DiffPreview 把现有 `searchInChanges` 注册到
  `searchInChangesRef`，unmount 时只在仍指向自身时清理；
- Editor 持有稳定 `diffSearchInChangesRef` 并传入 DiffPreview；
- Search Everywhere Actions 新增 `searchInChanges`：
  - shortcut `⌘F`；
  - 仅真实可见 Diff 时启用；
  - repository-version 只读预览禁用；
  - 执行后关闭 Search Everywhere、保持 Commit/Diff 可见，延迟调用
    Diff runner；
- runner 继续调用 modified Monaco editor 的 `actions.find`；
- 文案同步 IDEA 原文，并补 disabled reason。

**回归**：

```bash
node --test tests/round598.test.mjs tests/round205.test.mjs \
  tests/round553.test.mjs tests/round555.test.mjs tests/round557.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
git diff --check
```

- RED：**3 fail**；
- 定向：**19 pass + 21 pass / 0 fail**；
- 全量：**1960 pass / 0 fail**。

**已排除方案**：

- 不把 Search In Changes 错接到 Commit change filter；
- 不在 repository-version 预览上启用无 runner 的 action；
- 不复制 Monaco find，只复用 DiffPreview 原 runner；
- 不修改 diff 模型、选择或 commit selection。

## 2026-11-16 — Search Everywhere ActionsBundle 最终差异审计

**作用域**：Search Everywhere Actions 中搜索/替换入口与 IDEA 2026.2
`ActionsBundle` 的身份对齐。

**证据**：

- 直接解析
  `/Applications/Intellij.app/Contents/lib/intellij.platform.ide.impl.jar`
  的 `messages/ActionsBundle.properties`；
- 中文文案来自 `localization-zh.jar`；
- 关键原文：
  - `GotoAction.text=Find Action… / 查找操作…`；
  - `ActivateFindToolWindow.text=Find / 查找`；
  - `FindSelectionInPath.text=Find in Files / 在文件中查找`；
- 其余 SearchEverywhere 内部 keymap action 已由弹框键盘行为覆盖，
  不需要伪装成独立 Actions 行。

**实现**：

- Actions 新增 `findAction`（第 31 项）：
  - keepOpen；
  - query 清空；
  - tab 切到 actions；
  - 回焦查询框；
  - 不写命令历史；
- `findToolWindow` label 改为 IDEA `Find / 查找`；
- `findSelectionInFiles` label 改为 IDEA
  `Find in Files / 在文件中查找`；
- 两个旧名称保留为 keywords，仍可搜索到同一 action；
- 更新 README inventory 与 round555 availability matrix 到 31 项。

**回归**：

```bash
node --test tests/round597.test.mjs tests/round553.test.mjs \
  tests/round569.test.mjs tests/round536.test.mjs tests/round557.test.mjs \
  tests/round583.test.mjs
node --test tests/round555.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
git diff --check
```

- RED：**3 fail**；
- 定向：**20 pass + 22 pass / 0 fail**；
- 全量：**1956 pass / 0 fail**。

**已排除方案**：

- 不把内部 Tab/Group/SelectItem keymap action 变成独立 Actions 行；
- 不新增第二套 action dialog；
- 不删除旧名称，而是保留为 keywords；
- 不改变 Find Tool Window 与 selection Find 的底层执行路径。

## 2026-11-16 — Text 空结果已用搜索选项明细

**作用域**：Search Everywhere Text 页零结果时的 option explanation。

**IDEA 证据**：

- `SeTextTabEmptyResultInfoProvider` 在 Clear all options 前显示
  “used options”；
- 顺序为 Match Case、Whole Words、Regex、File Mask；
- `message.nothingFound.used.options=Search options used:`，中文
  `搜索已用选项:`；
- File mask 短标签来自 `find.popup.filemask.label`。

**实现**：

- 新增 `searchEverywhereActiveOptionIds()` 作为唯一 active-option 判定：
  固定顺序、File Mask trim 后非空；
- `searchEverywhereOffersClearOptions()` 复用该 helper；
- Text 空结果摘要使用现有 Match Case / Whole Words / Regex 文案和新增
  File mask 短标签；
- 摘要与 Clear all options 共用 `showClearOptionsFallback`，不会出现
  “有明细但无 clear”或“有 clear 但无明细”；
- 摘要为次级文本，不修改 query、scope、Preserve case、Filter、历史
  或 Find tool 状态。

**回归**：

```bash
node --test tests/round596.test.mjs tests/round595.test.mjs \
  tests/round594.test.mjs tests/round593.test.mjs tests/round592.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
git diff --check
```

- RED：**3 fail**；
- 定向：**15 pass / 0 fail**；
- 全量：**1953 pass / 0 fail**。

**已排除方案**：

- 不复制第二套 option predicate；
- 不复用 File Mask 的长 placeholder 文案；
- 不在没有 active option 时显示空摘要；
- 不把摘要做成可点击的第二套 Clear action。

## 2026-11-16 — All/Text 空结果 scope expansion

**作用域**：Search Everywhere All/Text 空结果中的 workspace scope 扩大入口。

**IDEA 证据**：

- `SeEmptyResultInfoProvider.showResetScope()` 仅在
  `SearchEverywhereToggleAction` 存在且 `!isEverywhere()` 时显示；
- reset 只调用 `setEverywhere(!isEverywhere())`；
- Text 页的 scope reset 与 Clear all options 是两个独立 action；
- IDEA scope 文案为 `All Places / 所有位置`。

**能力边界**：

- DSH 没有 IDEA 的全局索引和库 scope；
- 真实可扩大范围仅是当前 workspace 内原本跳过的排除目录；
- 因此使用 `Search all workspace places / 搜索工作区中的所有位置`，
  不宣称能搜工作区外任意路径。

**实现**：

- 新增 `searchEverywhereOffersScopeExpansion()`：
  - All/Text 页；
  - 非空 query；Text 至少 2 字符，All 至少 1 字符；
  - 零结果、非 loading；
  - Include non-project 尚未开启；
- 空结果区在 Reset filter 前增加 scope action；
- 点击只调用 `onToggleIncludeNonProject()`；
- 保留 query、Case、Whole Words、Regex、Preserve case、File Mask、
  Filter、历史和 Find tool 状态；
- 复用现有文件候选 scope cache、Text 搜索 effect 和 option
  persistence；
- 按钮阻断 Enter/Space 冒泡并回焦查询框。

**回归**：

```bash
node --test tests/round595.test.mjs tests/round594.test.mjs \
  tests/round593.test.mjs tests/round592.test.mjs tests/round591.test.mjs \
  tests/round470.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
git diff --check
```

- RED：**3 fail**；
- 定向：**19 pass / 0 fail**；
- 全量：**1950 pass / 0 fail**。

**已排除方案**：

- 不在 Files/Actions 页显示 scope expansion；
- 不把 Clear all options 与 scope reset 合成一个动作；
- 不在 Include non-project 已开启时再显示；
- 不沿用 IDEA “All Places” 文案冒充工作区外搜索能力。

## 2026-11-16 — Text 空结果 Clear all options

**作用域**：Search Everywhere Text 页零结果时的搜索选项恢复入口。

**IDEA 证据**：

- IDEA 2026.2.3 的 `SeTextTabEmptyResultInfoProvider`；
- 生效选项只看 File Mask、Match Case、Whole Words、Regex；
- 点击分别执行 resetType/resetCase/resetWords/resetRegexp；
- scope reset 是独立入口，不包含在 Clear all options 内；
- 文案 `find.popup.clear.all.options=Clear all options`，中文
  `清除所有选项`。

**症状**：Text 搜索因 Case/Whole Words/Regex/File Mask 无结果时，DSH
只显示“没有匹配结果”，用户需要逐项打开工具按钮或清 File Mask。

**实现**：

- 新增 `searchEverywhereOffersClearOptions()` 作为唯一可见性判断：
  Text 页、query 至少 2 字符、零结果、非 loading，且至少一项搜索选项
  生效；
- Text 空结果区增加 `Clear all options`；
- 点击复用现有 `onToggleCaseSensitive`、`onToggleWholeWords`、
  `onToggleRegex`、`onFileMaskChange`；
- 只清除四项，保留 query、Include non-project scope、
  Preserve case、Filter、历史和 Find tool 状态；
- 选项变化继续由现有持久化 effect 写入
  `dsh-editor.search.options.v1`；
- 按钮阻断 Enter/Space 冒泡并回焦查询框。

**回归**：

```bash
node --test tests/round594.test.mjs tests/round593.test.mjs \
  tests/round592.test.mjs tests/round584.test.mjs tests/round585.test.mjs \
  tests/round470.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
git diff --check
```

- RED：**3 fail**；
- 定向：**23 pass / 0 fail**；
- 全量：**1947 pass / 0 fail**。

**已排除方案**：

- 不在 All/Files/Actions 页显示 Text 专属 Clear all options；
- 不在 query 少于 2 字符时把“请继续输入”误报为选项导致无结果；
- 不连带清 Include scope 或 Preserve case；
- 不复制第二套 search option state。

## 2026-11-16 — Files 空结果移交 persistent Find

**作用域**：Search Everywhere Files 页无文件名命中时的 IDE 空结果回退。

**IDEA 证据**：

- IDEA 2026.2.3；
- `SeFilesTab.canBeShownInFindResults()` 固定返回 true；
- Files 空结果使用 `SeEmptyResultInfoProvider`，文案
  `searcheverywhere.try.to.find.in.files=Find in Files`；
- 中文语言包为 `在文件中查找`；
- Text 页使用独立的 `SeTextTabEmptyResultInfoProvider`，入口是
  `Clear all options`，不是 Find in Files。

**症状**：Files 页已有真实 query 但没有文件名命中时，DSH 只显示“没有
匹配结果”，无法像 IDEA 一样把同一查询移交给全文 Find。

**根因**：

- 现有 handoff 只覆盖“已有结果”与“空白 Replace”；
- 普通空结果 request 的 `files/matches` 为空，`openFindTool` 会把
  `loadedGeneration` 设为 0，导致它认为结果已加载，不会重跑搜索。

**实现**：

- 新增 `searchEverywhereOffersFindInFiles()`，仅 Files 页、非空 query、
  零结果且非 loading 时返回 true；
- 空结果区增加 `Find in Files` 按钮，复用 `openSearchResultsInFind`；
- handoff 保留 query、Include scope、Case、Whole Words、Regex、
  Preserve case 与 File Mask；
- 空结果回退 request 加 `refresh:true`；
- `openFindTool` 对 refresh handoff 使用 `loadedGeneration:-1`，让持久
  Find 真正执行后台 `searchText`；
- Reset filter 限定到 All 页，避免 Files 页显示一个与当前结果无关的
  provider filter 重置入口；
- 按钮阻断 Enter/Space 冒泡，保留 listbox 内原生键盘激活。

**回归**：

```bash
node --test tests/round593.test.mjs tests/round592.test.mjs \
  tests/round590.test.mjs tests/round500.test.mjs tests/round557.test.mjs \
  tests/round465.test.mjs tests/round472.test.mjs tests/round469.test.mjs \
  tests/round478.test.mjs
node --test tests/round499.test.mjs tests/round501.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
git diff --check
```

- RED：**3 fail**；
- 定向：**28 pass + 22 pass / 0 fail**；
- 全量：**1944 pass / 0 fail**。

**环境边界**：

- Computer Use 仍报告 macOS locked；
- Ego TaskSpace 133 仍为 `agentDelegatedToUser`；
- 本轮未接管、未新建 space，DSH Web 运行态留待权限恢复后补验。

**已排除方案**：

- 不在 Text/Actions/All 页伪造同一个 Find in Files 入口；
- 不把空结果 request 当成已加载结果；
- 不为空结果回退新增第二套 Find 工具窗口；
- 不让 Files 页显示只作用于 All 页 provider filter 的 Reset filter。

## 2026-11-16 — Search Everywhere 空结果 Reset filter

**作用域**：Search Everywhere 空结果状态中的 IDEA provider filter 重置入口。

**IDEA 证据**：

- 本机 IDEA 2026.2.3（`IU-262.10968.63`）；
- `searcheverywhere.reset.filters=Reset filter`；
- 中文语言包对应 `重置筛选器`；
- 反编译 `SeEmptyResultInfoProvider` 确认入口仅在
  `SearchEverywhereFiltersAction.isActive()` 时显示；
- 点击调用
  `PersistentSearchEverywhereContributorFilter.setSelectedToAllElements(true)`；
- 查询文本、Include scope、布尔选项和 File Mask 均保持不变。

**症状**：DSH 的 All 页可以连续关闭 Files/Text/Actions filter，但空结果
区只显示“没有匹配结果”，用户只能重新打开 Filter 菜单逐项恢复。

**实现**：

- 新增统一的
  `defaultSearchEverywhereFilters()` /
  `searchEverywhereFiltersNeedReset()`；
- 仅在 All 页且一个或多个 provider 被隐藏时显示 Reset filter；
- 点击原子恢复 `{files:true,text:true,actions:true}`；
- 保留 query、Include non-project、Match Case、Whole Words、Regex、
  Preserve case 和 File Mask；
- 关闭 Filter 菜单并回焦查询框；
- 按钮位于 listbox 内，Enter/Space 必须 `stopPropagation()`，否则
  listbox 的导航 handler 会吞掉原生按钮激活。

**回归**：

```bash
node --test tests/round592.test.mjs tests/round465.test.mjs \
  tests/round472.test.mjs tests/round469.test.mjs tests/round478.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
git diff --check
```

- RED：**3 fail**；
- 定向：**15 pass / 0 fail**；
- 全量：**1941 pass / 0 fail**。

**环境边界**：

- Ego TaskSpace 133 仍为 `agentDelegatedToUser`；
- 本轮未接管、未新建 space，DSH Web 运行态留待权限恢复后补验。

**已排除方案**：

- 不把 Reset filter 扩展成重置 query/options/mask；
- 不与 IDEA 的 `Try to reset scope` 合并；
- 不在结果非空时显示空状态入口；
- 不让 Enter/Space 冒泡到结果列表导航。

## 2026-11-16 — Include non-project scope 持久化与候选缓存隔离

**作用域**：Search Everywhere / Find 的统一搜索选项持久化，以及
Search Everywhere 文件候选缓存。

**症状**：Include non-project items 只影响当前弹框，移交 Find 后虽能
继续搜索，但关闭并重新打开 Search Everywhere / Find 时 scope 丢失；
若把 scope 直接加入共享存储，默认 scope 下缓存的候选文件又可能被
包含排除目录的新 scope 错误复用。

**触发条件**：

- 在 Search Everywhere 开启 Include non-project items；
- 切换到 Find 或关闭后重新打开；
- 或先以默认 scope 加载文件候选，再恢复 `includeExcluded:true`。

**根因**：

- `normalizeSearchOptions` / `readSearchOptions` 没有 scope 字段；
- Search Everywhere 的 `includeNonProject` 固定初值 `false`；
- Find 的显式 handoff 与本地默认值没有清晰优先级；
- `searchEverywhereFilesRef` 只缓存文件数组，没有记录数组所属 scope。

**最终修复**：

- 统一搜索选项新增规范化布尔 `includeExcluded`；
- 兼容旧 `includeNonProject` 别名，但当前 UI 布尔值优先，避免
  `includeExcluded:true` 遗留值把已经关闭的 scope 写回；
- `searchFindHandoff.request.includeExcluded` 始终是显式布尔值；
- Search Everywhere 打开时恢复 scope；
- Find 空打开时恢复本地 scope，显式 handoff 优先；
- 文件候选缓存增加 `searchEverywhereFilesScopeRef` 和请求序号；
- 缓存的 scope 不匹配时重新请求；迟到响应、workspace 切换均不能
  覆盖当前 scope；
- Search Everywhere / Find 的持久化 effect 依赖 scope 字段。

**回归**：

```bash
node --test tests/round591.test.mjs tests/round590.test.mjs \
  tests/round484.test.mjs tests/round500.test.mjs tests/round470.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
git diff --check
```

- RED：**4 fail**；
- 定向：**18 pass / 0 fail**；
- 全量：**1938 pass / 0 fail**。

**环境边界**：

- Ego TaskSpace 133 仍为 `agentDelegatedToUser`，原因是上一轮
  Clipboard 权限提示尚未由用户处理；
- 本轮未 `takeOverTaskSpace`，也未新建 space 绕过；
- DSH Web 运行态留待同一 TaskSpace 恢复控制后补验。

**已排除方案**：

- 不把 `includeExcluded` 继续作为“仅 true 时附加”的请求字段；
- 不共享不同 scope 的文件候选数组；
- 不用一个未带 scope 身份的空数组判断缓存已失效；
- 不让旧存储值覆盖 Search Everywhere 的显式 handoff scope。

## 2026-11-16 — Include non-project scope 在 Search Everywhere / Find 间一致

**作用域**：Search Everywhere 把文本结果移交给持久 Find 时的搜索 scope。

**症状**：Search Everywhere 开启 Include non-project items 后，移交 Find
会丢掉 `includeExcluded`；下一次 Find 刷新又回到默认目录集合。

**实现**：

- `searchFindHandoff` 增加 `includeExcluded`，仅在 true 时写入 request；
- Search Everywhere 的普通 Find/Replace handoff 和空白 Replace 请求都
  携带 `state.includeNonProject`；
- `openFindTool` 用 handoff 初始化 `state.includeExcluded`；
- Find 工具栏增加 Include non-project items toggle；
- 切换时清空 files/matches、重置 index、etag generation，并触发重搜；
- Find searchText 请求转发 `includeExcluded`；
- 该 scope 使用现有 host 边界：排除 `.git/.hg/.svn`、保持文件/大小/
  命中上限，只纳入原本被跳过的重目录。

**回归**：

```bash
node --test tests/round590.test.mjs tests/round470.test.mjs \
  tests/round500.test.mjs tests/round586.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
git diff --check
```

- RED：**4 fail**；
- 定向：**16 pass / 0 fail**；
- 全量：**1934 pass / 0 fail**。

**环境边界**：

- Ego TaskSpace 133 仍被 Clipboard 权限提示占用；
- 本轮运行态改由 host 既有 includeExcluded 测试与静态/handoff 测试闭环；
- 未接管用户的 TaskSpace，也未创建新 space 绕过提示。

**已排除方案**：

- 不在 Find 中重新定义“项目目录”集合；
- 不在 scope 切换后保留旧文件/命中列表；
- 不把 VCS 元数据纳入 Search Everywhere。

## 2026-11-16 — Show Usages 菜单焦点与 Clipboard 边界

**作用域**：Show Usages 结果菜单关闭后的焦点归还，以及 Clipboard
权限提示对运行态验收的影响。

**实现**：

- 右键 handler 在打开菜单前调用 `event.currentTarget.focus()`；
- 共享 `ContextMenu` 已具备通用 opener 恢复：
  - mount 时记录 `document.activeElement`；
  - unmount 时仅在 opener 仍 connected 时回焦；
  - 明确转移焦点的命令可通过 `skipReturnFocusRef` 抑制；
- 因此右键菜单返回 usage row，键盘从 query 打开时返回 query；
- 复制动作只 `setResultMenu(null)`，不调用 popup `onClose`；
- 导航动作仍先关闭 popup 再打开右分屏/Project 定位；
- `copySearchResultText` 对 missing API、同步异常、Promise reject
  都只调用 `onNotify`，不关闭 popup。

**回归**：

```bash
node --test tests/round589.test.mjs tests/round588.test.mjs \
  tests/round586.test.mjs tests/round497.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
git diff --check
```

- RED：**1 fail**；
- 定向：**18 pass / 0 fail**；
- 全量：**1930 pass / 0 fail**。

**环境边界**：

- Ego Browser 在 clipboard 写入时弹出权限提示；
- TaskSpace ownership 变为 `agentDelegatedToUser`；
- 在用户明确处理提示前不得 `takeOverTaskSpace`，也不得新建 space 绕过；
- 权限成功/拒绝的最终运行态留到 round590。

**已排除方案**：

- 不复制 ContextMenu 的 focus restore；
- 不在右键时依赖 row 的浏览器默认聚焦；
- 不让 clipboard 失败关闭 popup。

## 2026-11-16 — Show Usages 共享结果菜单

**作用域**：Show Usages transient popup 中的结果行右键、键盘 ContextMenu
和复制/导航动作生命周期。

**实现**：

- `ShowUsagesPopup` 增加本地 `resultMenu`；
- `openUsageMenuAt` 把 usage row 映射为 `kind:'text'` 后复用
  `searchResultContextItems`；
- 支持鼠标 `contextmenu`、`ContextMenu` 和 `Shift+F10`；
- 菜单动作：
  - 导航动作先 `onClose()`，再打开右侧拆分或执行 Project 定位；
  - 复制动作只关闭菜单，不关闭 popup，不改变 filter/active row；
- 菜单渲染在 popup dialog 内部，菜单点击不会触发 backdrop 关闭。

**回归**：

```bash
node --test tests/round588.test.mjs tests/round586.test.mjs \
  tests/round477.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
git diff --check
```

- RED：**4 fail**；
- 定向：**13 pass / 0 fail**；
- 全量：**1926 pass / 0 fail**。

**运行态**：

- Show Usages popup 加载 2 条 usage；
- 查询框 `Shift+F10` 打开完整共享菜单；
- 菜单包含 Open in Right Split / Open in editor / Copy relative path /
  Path with Line Number / Select in Project View。

**环境边界**：

- 执行 Copy relative path 时 Ego Browser 弹出 Clipboard 权限提示，
  TaskSpace 转用户控制；
- 这是浏览器权限流程，不是菜单或产品错误；
- 复制 helper 的 missing API、同步异常、Promise resolve/reject 已有单测；
- 授权后的成功路径和拒绝路径仍需 round589 运行态收尾。

**已排除方案**：

- 不为 usage popup 复制第三套结果菜单；
- 不让复制动作关闭瞬态 popup；
- 不让右键事件先激活/打开 result。

## 2026-11-16 — Find Usages Settings 的真实能力边界

**作用域**：Search Everywhere Actions 中 IDEA `ShowSettingsAndFindUsages`
入口的可见性、快捷键和 enabled reason。

**IDEA 证据**：

- `action.ShowSettingsAndFindUsages.text=Find Usages Settings…`；
- 默认 keymap：`control shift alt F7`；
- macOS System Shortcuts keymap：`meta shift alt F7`；
- settings 面向 language-aware module/directory/scope 和 usage 选项。

**审计结论**：

- DSH 当前只有文本 workspace search；
- 没有 module、directory scope、language element、usage option persistence
  或独立 Find Usages setting 对象；
- 复用普通 Find options 会制造错误语义，因此不启用。

**实现**：

- Actions 增加 `findUsagesSettings`：
  - label=`Find Usages Settings…`；
  - shortcut=`⌃⇧⌥F7`；
  - keyword=`ShowSettingsAndFindUsages`；
  - `disabled:true`；
  - reason 明确说明 text-search 缺少 language-aware scope/settings；
- action 始终可见，键盘遍历跳过，Enter 不会关闭 Search Everywhere；
- Actions 总数 29 → 30，README/矩阵同步。

**回归**：

```bash
node --test tests/round587.test.mjs tests/round114.test.mjs \
  tests/round553.test.mjs tests/round555.test.mjs \
  tests/round557.test.mjs tests/round556.test.mjs \
  tests/round579.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
git diff --check
```

- RED：**2 fail**；
- 定向：**22 pass / 0 fail**；
- 全量：**1922 pass / 0 fail**。

**运行态**：DSH Web query=`Find Usages Settings` 命中唯一 disabled action，
`aria-keyshortcuts=Control+Shift+Alt+F7`，tooltip/description 给出真实原因，
Enter 后弹框保持打开。

**已排除方案**：

- 不把普通 Find 的 Match Case/Whole Words/File Mask 宣称为 Find Usages
  Settings；
- 不伪造 module/directory/language scope；
- 不因 action disabled 就从 Actions provider 中隐藏。

## 2026-11-16 — Show Usages 独立 transient popup

**作用域**：Search Everywhere Actions、`⌃⌥F7`、workspace usage 浏览和
Find tool handoff。

**IDEA 证据**：

- `ShowUsages` 是独立 action，默认 `Control+Alt+F7`；
- 它与持久 `FindUsages` Usage View 不同，是 transient popup；
- popup 含过滤、结果导航和 pin-to-Find 能力。

**实现**：

- 新增 `filterUsageMatches`、`usageMatchRowKey`、
  `normalizeUsageMatchIndex`；
- `ShowUsagesPopup`：
  - 只过滤已加载结果，不重复扫描 workspace；
  - ↑/↓ 环形导航，Enter 打开并关闭，Esc 关闭；
  - combobox/listbox/aria-activedescendant；
  - `Open in Find Tool Window` 把同一 query、matches 和 truncated
    状态交给持久 Find；
- `openShowUsages` 使用现有 `searchText`，最多 200 条；
- Search Everywhere Actions 增加 `Show Usages` 和
  `⌃⌥F7`；全局 Control+Alt+F7 与 action 走同一 runner；
- `Find Usages` 仍保持独立的持久 tool window 路径。

**回归**：

```bash
node --test tests/round586.test.mjs tests/round553.test.mjs \
  tests/round555.test.mjs tests/round557.test.mjs \
  tests/round569.test.mjs tests/round556.test.mjs \
  tests/round579.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
git diff --check
```

- RED：**5 fail**；
- 定向：**27 pass / 0 fail**；
- 全量：**1918 pass / 0 fail**。

**运行态**：

- `dshUsageToken` 在 `usage-a.txt` 与 `usage-b.txt` 中各出现一次；
- `⌃⌥F7` popup 显示 2 条；
- filter=`usage-b` 后剩 1 条；
- Enter 打开 `usage-b.txt:1:8` 并关闭 popup；
- pin 后 Find 保留 query 与 2 条结果；
- Search Everywhere 的 `Show Usages` action 显示
  `aria-keyshortcuts=Control+Alt+F7`，执行走同一 popup。

**已排除方案**：

- 不把 Show Usages 映射成 Find Usages 的别名；
- 不在 filter 时发起第二次 workspace search；
- 不让 popup 打开结果后继续留在屏幕上。

## 2026-11-16 — Preserve case 扩展到编辑器内 Find/Replace

**作用域**：Monaco 编辑器自建 Find toolbar 的单处替换、Replace All 与
selection scope 替换。

**IDEA 证据**：`find.options.replace.preserve.case` 属于 Replace 通用选项，
不只作用于 Find in Files。

**实现**：

- `editorApplyPreserveCase` 与宿主保持同一语义：
  - 全大写、全小写、首字母大写分别跟随；
  - 混合大小写保留输入；
- `editorRegexReplacementText` 先在单个匹配文本上展开 `$1/$&` 等 native
  replacement token；
- `editorReplaceAll` 非 scope 路径使用 `String.replace` 回调逐匹配适配；
- `editorReplaceAt` 用于单处替换，scope 路径继续逆序调用它，因此三条
  替换路径复用同一逻辑；
- 编辑器 replace row 仅在 `withReplace=true` 时显示 `Preserve case`；
- 该状态复用 `dsh-editor.search.options.v1`，刷新后恢复。

**回归**：

```bash
node --test tests/round585.test.mjs tests/round485.test.mjs \
  tests/round535.test.mjs tests/round532.test.mjs \
  tests/round551.test.mjs tests/round550.test.mjs \
  tests/round552.test.mjs tests/round484.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
git diff --check
```

- RED：**5 fail**；
- 定向：**33 pass / 0 fail**；
- 全量：**1913 pass / 0 fail**。

**运行态**：DSH Web 打开 `case-editor.txt`，编辑器 `⌘R` 后
`Preserve case` 为 checked；`foo FOO Foo fOo` Replace All 为
`bar BAR Bar bar`，保存后磁盘一致。

**已排除方案**：

- 不在 find-only 模式显示无效 Replace 选项；
- 不先适配整个 replacement template 再展开捕获组；
- 不为 scope 路径复制第二套替换实现。

## 2026-11-16 — Replace Preserve case 与宿主重载边界

**作用域**：Search Everywhere / Find in Files 的 Replace 大小写保持，以及
`lib/client.js` 与 `lib/index.js` 的不同热更新生命周期。

**IDEA 证据**：`FindBundle.properties`：

- `find.options.replace.preserve.case=Pr&eserve case`；
- 该选项属于 Replace，而不是搜索匹配条件。

**实现**：

- `normalizeSearchOptions`、Search Everywhere→Find handoff 和三条 workspace
  replace 请求都携带单一 `preserveCase`；
- Search Everywhere 的 Replace 行和持久 Find 的 replace mode 提供
  `Preserve case` action；
- 宿主新增 `applyPreserveCase`：
  - 全大写 → 大写替换；
  - 全小写 → 小写替换；
  - 首字母大写 → 首字母大写替换；
  - 混合大小写 → 保留输入；
- Regex 先在每个匹配上展开捕获组，再适配该匹配的大小写；
- literal Replace All、Regex Replace All 和单处 occurrence Replace
  共用同一规则。

**症状/根因**：

- 第一次 DSH Web 运行态仍把 `foo FOO Foo fOo` 写成 `bar bar bar bar`；
- 原因是 DSH Web 进程在修改 `lib/index.js` 之前已经启动，浏览器刷新只加载
  新 `client.js`，宿主模块仍执行旧代码；
- profile 的 `link:` 依赖只保证路径指向源码，不提供宿主模块热重载。

**修复/验证**：

- 修改宿主 `lib/index.js` 后必须停止并重启同一 DSH profile；
- 重启后 Preserve case toggle 为 checked，Replace All 得到
  `bar BAR Bar bar`；
- Regex 捕获样本得到
  `id-12 ID-34 Id-56 id-78`。

**回归**：

```bash
node --test tests/round584.test.mjs tests/round500.test.mjs \
  tests/round484.test.mjs tests/round479.test.mjs \
  tests/round480.test.mjs tests/round481.test.mjs \
  tests/round482.test.mjs tests/round483.test.mjs \
  tests/round532.test.mjs tests/round553.test.mjs \
  tests/round555.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
git diff --check
```

- RED：**6 fail**；
- 定向：**45 pass / 0 fail**；
- 全量：**1908 pass / 0 fail**。

## 2026-11-16 — Search Everywhere IDEA Action 文案与旧别名

**作用域**：双击 Shift 后 Search Everywhere Actions 的动作可发现性与 IDEA 2026.2 文案。

**IDEA 证据**：安装包 `ActionsBundle.properties`：

- `SearchStructurally…`；
- `ReplaceStructurally…`；
- `Search with Google`；
- `Next Occurrence of the Word at Caret`；
- `Add Selection for Next Occurrence`；
- `Unselect Occurrence`。

**症状/根因**：插件使用旧的自定义名称作为 action label，用户按 IDEA
Action 原名搜索时虽然执行逻辑存在，却无法按原文命中。

**修复**：

- label 改为 IDEA 2026.2 原文；
- 旧名保留在 `keywords`：
  `Structural Search`、`Structural Replace`、`Search Web`、
  `Find Word at Caret`、`Select Next Occurrence`、
  `Unselect Previous Occurrence`；
- Monaco 右键菜单继续复用同一 localization key；
- 中文使用 IDEA 简体中文资源对应文案。

**回归**：

```bash
node --test tests/round583.test.mjs tests/round531.test.mjs \
  tests/round541.test.mjs tests/round543.test.mjs \
  tests/round544.test.mjs tests/round546.test.mjs \
  tests/round549.test.mjs tests/round553.test.mjs \
  tests/round554.test.mjs tests/round557.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
git diff --check
```

- RED：**3 fail**；
- 定向：**34 pass / 0 fail**；
- 全量：**1902 pass / 0 fail**。

**运行态**：DSH Web `r526` profile 中，IDEA 原名与旧别名均落到同一
`action:*` option id。Computer Use 仍被 macOS 锁屏阻断。

## 2026-11-16 — Search Everywhere macOS 分组导航与 ARIA 方向键

**作用域**：Search Everywhere 的 Provider 分组导航快捷键和快捷键
辅助技术元数据。

**IDEA 证据**：`Mac OS X 10.5+.xml`：

- `SearchEverywhere.NavigateToNextGroup = PAGE_DOWN / meta DOWN`；
- `SearchEverywhere.NavigateToPrevGroup = PAGE_UP / meta UP`；
- `ShowSearchHistory = alt down`。

**症状/根因**：

- 插件只识别 `Control+Arrow`，macOS 上 IDEA 默认的 `Meta+Arrow` 无效；
- 新增方向键 shortcut 后，ARIA 元数据曾输出 `Alt+↓`，不是合法的
  WAI-ARIA `ArrowDown` 名称。

**修复**：

- 新增 `searchEverywhereGroupNavigationDirection(event, mac)`；
- macOS 使用 Meta+Arrow，其他平台保留 Control+Arrow；
- PageUp/PageDown 共用；
- Alt/Shift 或额外主修饰键不抢占；
- `Show Search History` 增加 `⌥↓`；
- 方向 glyph 规范化为 `ArrowUp/ArrowDown/ArrowLeft/ArrowRight`。

**回归**：

```bash
node --test tests/round582.test.mjs tests/round575.test.mjs \
  tests/round576.test.mjs tests/round556.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
git diff --check
```

- RED：**3 fail**；
- 定向：**12 pass / 0 fail**；
- 全量：**1898 pass / 0 fail**。

**运行态**：query=`read` 时 `Meta+ArrowDown` 从 Actions 组进入
`README.md` Files 组，`Meta+ArrowUp` 返回 Actions；Show Search History
的 `aria-keyshortcuts=Alt+ArrowDown`。

## 2026-11-16 — Terminal Block Keyboard Navigation

**作用域**：Terminal block selection 的 Up/Down 与 Shift+Up/Down 键盘模式。

**IDEA 证据**：

- Select Block Above/Below 支持 Up/Down block-mode 键位；
- Expand Block Selection Above/Below 使用 EditorUp/DownWithSelection；
- shell prompt 的普通 Up/Down 仍用于 command history。

**实现**：

- `terminalBlockKeyboardAction(event, hasSelection, findOpen)`：
  - 无 selection 或 Find 打开 → null；
  - ArrowUp/Down → selectAbove/Below；
  - Shift+ArrowUp/Down → expandAbove/Below；
  - Meta/Ctrl/Alt 组合 → null。
- terminal keydown：
  - 当前 selection position 解析 block range；
  - select 用 `terminalAdjacentBlockRange`；
  - expand 用 `terminalExpandBlockRange`；
  - 上限限制到当前 prompt 前；
  - selectLines 后回焦 terminal。

**回归**：

```bash
node --test tests/round581.test.mjs tests/round580.test.mjs \
  tests/round579.test.mjs tests/round573.test.mjs \
  tests/round574.test.mjs tests/round572.test.mjs \
  tests/round344.test.mjs tests/round300.test.mjs \
  tests/static-order.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
git diff --check
```

- RED：**2 fail**；
- 定向：**30 pass / 0 fail**。

**运行态**：

- 手动选择 `BLOCK-ONE-A/B`；
- ArrowDown 进入下方 block；
- Shift+ArrowUp 扩展到两个完整输出块；
- 清除 selection 后 ArrowUp 不再建立 block selection。

**已排除方案**：

- 不在无 selection 时抢占 shell history；
- 不在 Terminal Find 打开时抢占箭头；
- 不将 Meta/Ctrl 组合误当作 block navigation。

## 2026-11-16 — Terminal Adjacent Block Selection

**作用域**：Terminal IDE block 相邻选择、扩展选择和右键 selection 保持。

**IDEA 证据**：

- `Terminal.SelectBlockAbove/Below` 存在独立 action；
- `Terminal.ExpandBlockSelectionAbove/Below` 使用 EditorUp/DownWithSelection；
- block 模式支持 Up/Down、Meta/Ctrl+Up 等导航键。

**实现**：

- 新增：
  - `terminalBlockRangeAt`
  - `terminalSelectionBlockRange`
  - `terminalAdjacentBlockRange`
  - `terminalExpandBlockRange`
- 相邻块只搜索当前 prompt 之前的连续非空行；
- Terminal 菜单增加 Select Block Above/Below 与 Expand Block Selection Above/Below；
- disabled 状态由真实相邻块和 `selectLines` 能力决定；
- `screenSelectionPositionRef` 在 right mousedown 时保存每个 pane 的
  `getSelectionPosition()`，contextmenu 传入菜单，避免右键清空 selection；
- 本轮不抢普通 Up/Down，避免破坏 shell history。

**回归**：

```bash
node --test tests/round580.test.mjs tests/round579.test.mjs \
  tests/round573.test.mjs tests/round574.test.mjs \
  tests/round572.test.mjs tests/round344.test.mjs \
  tests/round300.test.mjs tests/static-order.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
git diff --check
```

- RED：**3 fail**；
- 定向：**28 pass / 0 fail**。
- 全量：**1892 pass / 0 fail**。

**运行态**：

- 两个空行分隔的输出块；
- 右键 Select Block Above 选最近块；
- 再右键 Select Block Above 选中 `BLOCK-ONE-A/B`；
- Expand Block Selection Above 最终覆盖两个完整块；
- right-mousedown selection position 保留修复生效。

**已排除方案**：

- 不用 Up/Down 无条件覆盖 shell history；
- 不跨 prompt 选相邻块；
- 不解析 shell-integration 私有序列。

## 2026-11-16 — Show Usages 审计与 Provider Suggestions

**作用域**：Search Everywhere 的 ShowUsages 入口审计与 provider command 建议。

**IDEA 证据**：

- `FindUsages` = `Alt+F7`，进入持久 Usage View；
- `ShowUsages` = `Control+Alt+F7`，是独立 transient usages popup；
- `ShowUsagesAction` 自带 table/filter/pin/settings 导航模型；
- 另有 `ShowSettingsAndFindUsages` action。

**结论**：

- DSH 没有独立 usage popup 模型；
- 将 ShowUsages 映射为 Find Usages 会制造伪重复入口；
- 本轮不新增 `showUsages`，并在 Actions 代码旁记录原因。

**实现**：

- 新增 `searchEverywhereProviderCommandSuggestions`：
  - 仅接受单个未完成 `/provider-prefix`；
  - 返回匹配的 provider tab id；
  - `/te` → text、`/fil` → files、`/act` → actions、`/al` → all；
  - `/` → 全部；`/find`、参数 query、普通 query → 空。
- `providerCommandResults` 按建议集过滤；
- `showProviderCommands` 在 `/` 或 provider 建议存在时启用；
- 精确别名 `/t /f /a` 仍优先走 providerCommand，不显示帮助；
- `/find` 等不匹配 provider 的 slash 输入继续走 action command search。

**回归**：

```bash
node --test tests/round579.test.mjs tests/round570.test.mjs \
  tests/round571.test.mjs tests/round576.test.mjs \
  tests/static-order.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
git diff --check
```

- RED：**3 fail**；
- 定向：**17 pass / 0 fail**。
- 全量：**1888 pass / 0 fail**。

**运行态**：

- `/te` 首项 `/text` 建议；
- Enter 后 `/text `、Text tab；
- `/find` 首项仍是 Find action。

**已排除方案**：

- 不增加重复 ShowUsages；
- 不让 provider suggestion 劫持所有 slash action query；
- 不复制第三方 usage popup UI。

## 2026-11-16 — Toggle Find in Selection Action Metadata

**作用域**：Search Everywhere Actions 中 `Search in Selection Only` 的 IDEA 同义词。

**IDEA 证据**：

- IDEA action 名称为 `ToggleFindInSelection`；
- 默认 keymap 为 `control alt E`；
- Search Everywhere Actions 会索引 action 名称和快捷键。

**实现**：

- 复用已有 `searchInSelectionOnly` 执行路径；
- 增加：
  - `shortcut: '⌃⌥E'`；
  - `keywords: t('editor.toggleFindInSelectionSynonym')`；
- 本地化：
  - zh：`切换仅在选区内查找`；
  - en：`Toggle Find in Selection`；
- ARIA 快捷键继续由共享 `searchEverywhereAriaKeyShortcuts` 生成 `Control+Alt+E`。

**回归**：

```bash
node --test tests/round578.test.mjs tests/round535.test.mjs \
  tests/round552.test.mjs tests/round553.test.mjs \
  tests/round555.test.mjs tests/round556.test.mjs \
  tests/round557.test.mjs tests/static-order.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
git diff --check
```

- RED：**2 fail**；
- 定向：**34 pass / 0 fail**。
- 全量：**1885 pass / 0 fail**。

**运行态**：

- README 在 Monaco 中全选；
- 双击 Shift 后查询 `Toggle Find in Selection`；
- 首项为 `searchInSelectionOnly`；
- 可见文本含 `⌃⌥E`，`aria-keyshortcuts=Control+Alt+E`；
- `aria-disabled=false`。

**已排除方案**：

- 不新增第二个 selection-scope action；
- 不伪造 Show Usages 语义；
- 不改动 selection scope 的匹配/替换链路。

## 2026-11-16 — Toggle Find in Selection

**作用域**：编辑器 Find/Replace 的 selection scope 快捷键与状态切换。

**IDEA 证据**：

- 默认 keymap：`ToggleFindInSelection` = `control alt E`；
- `find.selection.only=Search In Selection`；
- IDEA scope 是 Find toolbar 的 toggle，同时约束 Find 与 Replace。

**实现**：

- 新增 `editorFindSelectionShortcutAction`：
  - Find 已开 → `toggle`；
  - Find 未开但存在非空 Monaco 选区 → `open`；
  - 其他 → null。
- 新增 `Control+Alt+E` keydown：
  - 只在大 workspace 内且 target 位于 Monaco/编辑器 Find 输入框时接管；
  - 排除 Search Everywhere、persistent Find tool 与 Terminal；
  - open 复用 `openEditorFindInSelection`；
  - toggle 复用现有 `toggleFindSelectionScope`。

**回归**：

```bash
node --test tests/round577.test.mjs tests/round535.test.mjs \
  tests/round538.test.mjs tests/round552.test.mjs \
  tests/round555.test.mjs tests/round557.test.mjs \
  tests/static-order.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
git diff --check
```

- RED：**2 fail**；
- 定向：**28 pass / 0 fail**。
- 全量：**1881 pass / 0 fail**。

**运行态**：

- README 在 Monaco 中全选；
- 第一次 `Control+Alt+E` 打开 Find，scope button `aria-pressed=true`；
- 第二次保持 Find 打开，scope button 变为 `false`；
- active element 始终是 `[data-dsh-editor-find-input]`。

**已排除方案**：

- 不另写 selection 匹配器；
- 不在 Project/Commit 树或 Terminal 内抢占该键；
- 不在 Search Everywhere 或 persistent Find 中输入时误触发编辑器 scope。

## 2026-11-16 — Search Everywhere CompleteCommand

**作用域**：Search Everywhere `/` provider command 的 Tab 补全。

**IDEA 证据**：

- `SearchEverywhere.CompleteCommand` 默认键位为 `Tab`；
- `SearchEverywhere.NextTab / PrevTab` 也复用 `Tab / Shift+Tab`；
- IDEA 根据 query 是否处于 command completion 状态分派这两个动作。

**实现**：

- `searchEverywhereProviderCompletion`：
  - 只匹配单个 `/provider-prefix` token；
  - 在 `all/actions/files/text` 全名中找唯一前缀；
  - 返回带尾随空格的 completion，例如 `/te` → `/text `；
  - `/a`、`/`、带参数、未知命令返回 null。
- Search Everywhere query keydown：
  - 无修饰键 Tab 先尝试 completion；
  - 成功时 onQuery 并下一帧恢复 focus/caret；
  - 失败时继续现有 NextTab/PrevTab。

**回归**：

```bash
node --test tests/round576.test.mjs tests/round570.test.mjs \
  tests/round571.test.mjs tests/round569.test.mjs \
  tests/round575.test.mjs tests/static-order.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
git diff --check
```

- RED：**2 fail**；
- 定向：**21 pass / 0 fail**。
- 全量：**1879 pass / 0 fail**。

**运行态**：

- DSH Web Search Everywhere 输入 `/te`；
- Tab 后 query 变为 `/text `、caret=6、Text tab 激活；
- 补全过程没有 `searchText` 或文件扫描请求；
- 普通 query=`read` 的 Tab 仍只切换 All→Files。

**已排除方案**：

- 不把 Tab 在所有输入情况下都改成补全；
- 不在 `/a` 的 All/Actions 歧义中擅自选择；
- 不执行命令或搜索来“顺便验证”补全。

## 2026-11-16 — Search Everywhere Group Navigation

**作用域**：双击 Shift 打开的 Search Everywhere 结果组键盘导航。

**IDEA 证据**：

- 默认 keymap：
  - `SearchEverywhere.NavigateToNextGroup` = `PAGE_DOWN` / `control DOWN`；
  - `SearchEverywhere.NavigateToPrevGroup` = `PAGE_UP` / `control UP`；
- 同一 Search Everywhere keymap 还定义 NextTab、PrevTab、CompleteCommand、SelectItem。

**实现**：

- `searchEverywhereResultGroupKey`：
  - `history:true` → `recent`；
  - 普通 action/file/text 按 kind 分组；
  - 未知行 → `other`。
- `searchEverywhereGroupTargetIndex`：
  - 先找当前连续组边界；
  - Next/Previous 只进入相邻组；
  - 目标组内跳过 disabled Action；
  - 无相邻组返回 null，不从列表尾回绕到列表头。
- `handleSearchResultKeyDown`：
  - `PageDown` 或 `Ctrl+ArrowDown` → 下一组；
  - `PageUp` 或 `Ctrl+ArrowUp` → 上一组；
  - 分组判断位于普通 ArrowUp/Down 之前。

**回归**：

```bash
node --test tests/round575.test.mjs tests/round475.test.mjs \
  tests/round487.test.mjs tests/round553.test.mjs \
  tests/round555.test.mjs tests/round557.test.mjs \
  tests/static-order.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
git diff --check
```

- RED：**3 fail**；
- 定向：**27 pass / 0 fail**。
- 全量：**1877 pass / 0 fail**。

**运行态**：

- DSH Web 在 Editor Project 树内聚焦后双击 Shift，Search Everywhere 正常打开；
- query=`read` 时 PageDown 从 Actions 组跳到当前文件结果 `README.md`；
- PageUp 回到 Actions 首个 enabled 项；
- Control+Down 也进入 Files 组。

**已排除方案**：

- 不为 `Show Usages` 增加与 Find Usages 完全相同的伪入口；
- 不把 disabled Action 当成组跳转停点；
- 不实现跨首尾回绕，避免与 IDEA 的组边界语义混淆。

## 2026-11-16 — Terminal Copy Block 与 Wrapped Prompt Shortcuts

**作用域**：Terminal block/prompt 快捷键、Copy Block 与 wrapped prompt 选择。

**IDEA 证据**：

- `Terminal.CopyBlock.text=Copy Block`；
- `Terminal.SelectLastBlock` 使用 macOS `Meta+Up`；
- `Terminal.SelectPrompt` 使用 macOS `Meta+Down`；
- `Terminal.CopyBlock` 使用 `Meta+C`；
- 同组还有 `Select Block Above/Below`、`Expand Block Selection Above/Below`。

**实现**：

- `directTerminalShortcut`：
  - 有选区 `⌘C` → `copy`；
  - 无选区 `⌘C` → `copyBlock`；
- `terminalMenuModel` 新增 `Copy Block`，复用 `terminalLastBlockSelection`；
- terminal keydown：
  - `Meta/Ctrl+Up` → Select Last Block；
  - `Meta/Ctrl+Down` → Select Prompt；
  - 只在 terminal pane 持焦时接管，动作后回焦 xterm；
- `terminalPromptStartRow` 沿 `line.isWrapped` 回溯逻辑 prompt 首行；
- 多行 prompt 用 `selectLines(firstRow,cursorRow)`；
- `terminalLastBlockSelection` 从完整逻辑 prompt 上方开始找块，
  防止 wrapped prompt 上半行被误认为单独输出块。

**回归**：

```bash
node --test tests/round574.test.mjs tests/round573.test.mjs \
  tests/round572.test.mjs tests/round344.test.mjs \
  tests/round300.test.mjs tests/static-order.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
git diff --check
```

- RED：round574/round344 **5 fail**；
- 定向：**21 pass / 0 fail**。
- 全量：**1874 pass / 0 fail**。

**运行态**：

- DSH Web 新 Terminal 执行 `printf 'ROUND574-A\nROUND574-B\n\n'`；
- `Meta+Down` 选中两行逻辑 prompt；
- `Meta+Up` 选中命令回显与两行输出；
- 清除选区后 `Meta+C` Copy Block 的截获文本与 Meta+Up 选区完全一致；
- `Copy Block / Select Last Block / Select Prompt` 三项同时出现在屏幕菜单；
- 关注点始终回到 `xterm-helper-textarea`。

**已排除方案**：

- 不解析 shell prompt 私有序列；
- 不用正则猜 prompt；
- 不把 `isWrapped` 视行当作独立逻辑行；
- 不另造 block 执行器。

## 2026-11-16 — Terminal Select Last Block / Select Prompt

**作用域**：Terminal 屏幕菜单的 IDEA block/prompt 选择动作。

**IDEA 证据**：

- `TerminalBundle.properties`：
  - `action.Terminal.SelectLastBlock.text=Select Last Block`；
  - `action.Terminal.SelectPrompt.text=Select Prompt`；
  - `action.Terminal.CopyBlock.text=Copy Block`；
- `Terminal.SelectPrompt` 对应 macOS `Meta+Down`。

**实现**：

- `terminalPromptSelection(buffer, cursorY, cursorX)`：
  - 选择 cursor 所在行从 0 到 `cursorX`；
  - 无 buffer 或非法坐标返回 `null`。
- `terminalLastBlockSelection(buffer, cursorY)`：
  - 从 cursor 上一行开始；
  - 跳过尾部空行；
  - 收集最近连续非空行，返回 inclusive `{start,end}`；
  - cursor 在第 0 行且上方没有内容时返回 `null`。
- `terminalMenuModel` 在 Select All 后增加两项：
  - `selectLastBlock` → `selectLines(start,end)`；
  - `selectPrompt` → `select(column,row,length)`；
  - 执行后 `focus()` 回 xterm；
  - disabled 判定不直接调用外部 helper，兼容旧测试单独抽取菜单函数。
- 中英文 `Select Last Block / Select Prompt` 与中文 `选择上一命令块 / 选择命令行` 已同步。

**回归**：

```bash
node --test tests/round573.test.mjs tests/round572.test.mjs \
  tests/round300.test.mjs tests/round344.test.mjs tests/static-order.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
git diff --check
```

- RED：round573 初始 **4 fail**；
- 定向：**17 pass / 0 fail**；
- 全量：**1870 pass / 0 fail**；
- round573 内的菜单夹具曾把相邻非空行误写成只选一行，按计划语义修正为 `selectLines(0,1)`。

**运行态**：

- DSH Web 新 Terminal 执行 `printf 'ALPHA\nBETA\n'`；
- 右键菜单出现 `Select Last Block` / `Select Prompt`；
- 从 xterm 内部实例读取：
  - block selection 覆盖当前命令块；
  - prompt selection 覆盖当前 wrapped prompt 末行到 caret；
  - 两次执行后焦点都回到 `xterm-helper-textarea`。
- 宽字符和换行 prompt 可跨 buffer 行，当前实现只取 cursor 所在末行；
  下一轮应结合 xterm `isWrapped` 扩展完整 prompt 选择。

**已排除方案**：

- 不根据 shell 文本猜测 prompt 正则；
- 不新增命令执行/块解析器；
- 不读取 PTY 私有 shell-integration 序列。

## 2026-11-16 — Terminal Page/Line Scrolling

**作用域**：Terminal 屏幕菜单滚动动作与 focused-pane 键位。

**IDEA 证据**：

- `TerminalBundle.properties`：
  - `Terminal.PageUp = Page Up`；
  - `Terminal.PageDown = Page Down`；
  - `Terminal.LineUp = Line Up`；
  - `Terminal.LineDown = Line Down`；
- `Terminal.ReworkedTerminalContextMenu` 在 Clear 后排列
  Page Up/Down，再分隔排列 Line Up/Down；
- Page Up/Down keymap 为 `Shift+PageUp / Shift+PageDown`。

**实现**：

- `terminalMenuModel` 增加：
  - `pageUp/pageDown` 调用 xterm `scrollPages(-1/1)`；
  - `lineUp/lineDown` 调用 `scrollLines(-1/1)`；
  - 方法缺失时保持可见但 disabled；
  - 执行后回焦 terminal；
- Terminal capture keydown：
  - focused pane 内 `Shift+PageUp/PageDown`；
  - 调用同一 `scrollPages`；
  - preventDefault/stopPropagation，不写入 PTY；
- 中英文案补齐。

**回归**：

```bash
node --test tests/round572.test.mjs tests/round300.test.mjs \
  tests/round344.test.mjs tests/static-order.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
git diff --check
```

- RED：round572 初始 **3 fail**；
- 定向 round572/300/344/static-order **13 pass / 0 fail**；
- 全量 `npm test` = **1866 pass / 0 fail**。

**运行态**：

- 在首个 terminal 执行 `seq 1 200`；
- 屏幕菜单出现 Page Up/Down、Line Up/Down；
- 点击 Page Up 后可见末行从 `200` 变为 `193`；
- 聚焦 terminal 按 `Shift+PageDown` 后回到 `193..200` 与当前 prompt；
- 菜单关闭后 focus 仍回 terminal；
- Computer Use 仍因 macOS 锁屏无法读取 IDEA 实窗。

**下一轮计划**：继续 Terminal 的 IDEA block 选择动作，
优先实现 Select Last Block/Select Prompt，并复用 xterm buffer API，
不引入独立命令执行解析器。

## 2026-11-16 — Provider Command Help 与 Short Aliases

**作用域**：Search Everywhere `/` provider 命令发现、短别名和 command history。

**实现**：

- `searchEverywhereProviderCommand` 增加：
  - `/t` → Text；
  - `/f` → Files；
  - `/a` → Actions；
  - 完整命令 `/text /files /actions /all` 保持不变；
- query 严格等于 `/` 时：
  - 不进入普通 action command mode；
  - 不请求 Text 正文搜索；
  - 显示四条 provider command row：
    `/all`、`/text`、`/files`、`/actions`；
- command row：
  - `keepOpen: true`；
  - `rememberCommand: false`；
  - 执行后补全为 `<command> `，并回焦 query；
  - 不立即发起内容搜索；
- result activation 现在尊重 `rememberCommand`，帮助项不污染最近 Action 历史；
- zh/en provider descriptions 完整覆盖。

**回归**：

```bash
node --test tests/round571.test.mjs tests/round570.test.mjs \
  tests/round569.test.mjs tests/round466.test.mjs \
  tests/static-order.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
git diff --check
```

- 定向 round571/570/569/466/static-order **20 pass / 0 fail**；
- 全量 `npm test` = **1863 pass / 0 fail**。

**运行态**：

- 输入 `/`：显示 4 条 provider command，状态为 4 results，
  未扫描文件/正文；
- 点击 `/text`：query 补全为 `/text ` 且焦点留在 query；
- 继续输入 `end`：Text tab 选中，状态 5 results；
- `/a Find Tool Window`：Actions tab 选中，活动项正确；
- Computer Use 仍因 macOS 锁屏无法读取 IDEA 实窗。

**下一轮计划**：暂停继续扩展 Search Everywhere，转向 Terminal tab，
用 IDEA Terminal 工具窗口的现有 action/键位做只读差异审计，
选择仍缺失且可复用 PTY/session 实现的交互补齐。

## 2026-11-16 — Search Everywhere Provider Commands

**作用域**：Search Everywhere 命令前缀、provider 页签定位、Text action 焦点。

**IDEA 语义**：

- Search Everywhere 的 All/Files/Text/Actions 是不同 provider；
- IDEA 对话框支持在查询中限定当前 provider；
- Text tab 只显示文本出现项，Find tool window 则是独立持久搜索面。

**实现**：

- 新增纯函数 `searchEverywhereProviderCommand`：
  - `/text query` → Text；
  - `/files query` → Files；
  - `/actions query` → Actions；
  - `/all query` → All；
  - 前缀保留在 input 中，实际 result query 使用后缀；
- `SearchEverywhere`：
  - 使用 `effectiveTab/effectiveQuery` 生成 action/file/text results；
  - tab `aria-selected` 跟随 effective provider；
  - 点击页签时先去掉 provider 前缀，再保留内容 query；
  - Find handoff 使用 effective query；
- 背景 Text 搜索同样消费 provider 后缀，不再把 `/text` 当搜索内容；
- Text action：
  - 如果当前 query 是 provider command，先剥离前缀；
  - 再切到 Text、聚焦 `[data-dsh-search-query]`；
  - 普通 query 保持原值。

**回归**：

```bash
node --test tests/round570.test.mjs tests/round569.test.mjs \
  tests/round553.test.mjs tests/round555.test.mjs \
  tests/round557.test.mjs tests/static-order.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
git diff --check
```

- 定向 round570/569/553/555/557/static-order **24 pass / 0 fail**；
- 全量 `npm test` = **1859 pass / 0 fail**。

**运行态**：

- `/text end`：Text tab 选中，input 保留 `/text end`，状态显示 5 results；
- `/files README`：Files tab 选中，显示 README.md；
- `/actions Find Tool Window`：Actions tab 选中，active row 为
  `Find Tool Window`；
- 执行 Text action（query `/actions Text`）后：
  - Text tab 选中；
  - input 去除命令前缀并变为 `Text`；
  - active element 是 Search Everywhere query input；
- Computer Use 仍因 macOS 锁屏无法读取 IDEA 实窗。

**下一轮计划**：补 Search Everywhere 的 `/` 命令帮助和常用短别名，
让 provider 前缀在不记忆完整命令时也可发现；继续复用现有 provider
routing，不新增搜索实现。

## 2026-11-16 — Text Search 与 Find Tool Window Entries

**作用域**：Search Everywhere Actions 的 Text provider 与持久 Find 入口。

**IDEA 证据**：

- `action.TextSearchAction.text=Text…`；
- `action.TextSearchAction.description=Show text occurrences in Search Everywhere`；
- `action.ActivateFindToolWindow.text=Find`；
- IDEA 将 Text provider 的页内切换和持久 Find tool window 作为两个不同入口。

**实现**：

- searchEverywhereActions 从 26 项扩展到 28 项：
  - `textSearch`：
    - label `Text…`；
    - `keepOpen: true`、`rememberQuery: false`；
    - 只把当前弹框 tab 切到 `text` 并重置索引；
    - 不清空 query，不关闭 Search Everywhere；
  - `findToolWindow`：
    - label `Find Tool Window`；
    - 先关闭瞬时 Search Everywhere；
    - 复用 `openFindTool('', 'find')` 打开空白持久 Find；
- 双语 label/description；
- 更新 action matrix、README inventory 和测试约束为 28 项。

**回归**：

```bash
node --test tests/round569.test.mjs tests/round553.test.mjs \
  tests/round555.test.mjs tests/round557.test.mjs \
  tests/static-order.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
git diff --check
```

- RED：README 28-entry contract 初始失败，其他新增行为测试先锁为红；
- 定向 round569/553/555/557/static-order **20 pass / 0 fail**；
- 全量 `npm test` = **1855 pass / 0 fail**。

**运行态**：

- 双击 Shift 打开 Search Everywhere；
- 空查询 Actions 列表出现 `Text…` 与 `Find Tool Window`；
- 点击 `Text…` 后弹框保持打开、query 保持为空、Text tab
  `aria-selected=true`，切换到 Text provider 的空查询提示；
- Actions 中查询 `Find Tool Window` 并执行后：
  - Search Everywhere 关闭；
  - 持久 `Find in Files…` 面板打开；
  - 查询为空并显示 `Type at least 2 characters to search file contents`；
- Computer Use 仍因 macOS 锁屏无法读取 IDEA 实窗；文案来自
  `ActionsBundle.properties`。

**下一轮计划**：审计 Search Everywhere 的命令/provider 前缀
（如 `/text`、`/files`、`/actions`）与 Text action 的 query 聚焦，
补与 IDEA 页签/provider 切换一致的命令模式行为。

## 2026-11-16 — Open Repository Version

**作用域**：Commit 详情文件菜单、只读 revision 标签、Git blob 读取。

**IDEA 证据**：

- `action.Vcs.Log.OpenRepositoryVersion.text=按修订显示文件`；
- `OpenRepositoryVersionFromHistoryAction` 使用
  `FileHistoryUtil.createVcsVirtualFile(model.createRevision(detail))`
  创建 VCS virtual file，再通过 `OpenFileDescriptor` 打开；
- revision 中不存在该文件时 action disabled。

**实现**：

- 宿主新增 `gitRepositoryVersion`：
  - `requireRevision` 校验 commit；
  - `resolveInside` 校验 workspace path；
  - `gitBlobMaybe` 读取 revision/path；
  - 缺失文件返回 `that revision does not contain this file`；
  - 超过 4 MiB 拒绝；
  - 返回 `{ path, hash, content, binary }`；
- Git 路由增加 `repositoryVersion`；
- Commit 文件菜单增加 `Open Repository Version / 按修订显示文件`；
- Client 新增 `RepositoryVersionPreview`：
  - Monaco `readOnly: true`；
  - 只渲染宿主返回的 blob，不写入 `openFiles`/磁盘；
  - toolbar 显示路径、短哈希、只读提示；
  - 提供 Open Local Version 与 Close；
  - 二进制文件显示明确占位；
- 复用 `DIFF_TAB_KEY` inspection tab：
  - tab 标题 `Version: <name> (<hash>)`；
  - diff 和 version 不会同时占用代码区；
  - Esc/关闭按钮/中键继续走现有 closeDiff 链。

**回归**：

```bash
node --test tests/round568.test.mjs tests/round295.test.mjs \
  tests/round321.test.mjs tests/round66.test.mjs \
  tests/round25.test.mjs tests/round567.test.mjs \
  tests/static-order.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
git diff --check
```

- RED：round568 初始 **1 fail**（宿主函数未导出）；
- 定向 round568/295/321/66/25/567/static-order
  **26 pass / 0 fail**；
- 全量 `npm test` = **1851 pass / 0 fail**。

**运行态**：

- baseline 的 README 文件行右键出现 `Open Repository Version`；
- 点击后打开 `Version: README.md (8d5451a)` 标签；
- toolbar 显示 `Version in commit 8d5451a (read-only)`；
- Monaco model 内容为提交版本：
  `# r526 fixture / End appears here. Second end line.`；
- Monaco API 返回 `readOnly=true`，键盘输入不修改 model；
- 工作区原 `M README.md` 与 HEAD 均未变化；
- Computer Use 仍因 macOS 锁屏无法读取 IDEA 实窗；动作语义由安装包
  ActionsBundle 与 decompiled `OpenRepositoryVersionFromHistoryAction` 核对。

**下一轮计划**：回到用户重点的 Search Everywhere 搜索/替换入口，
用 IDEA 安装包 ActionsBundle 对现有 26 项 action matrix 做反向审计，
补仍缺失且能在 Monaco/workspace 搜索链上真实落地的入口。

## 2026-11-16 — Compare Revisions

**作用域**：Commit Log 多提交选择、双提交聚合差异、Graph/flat 选择一致性。

**IDEA 证据**：

- `action.Vcs.Log.CompareRevisions.text=比较版本`；
- `Vcs.Log.ContextMenu` 的首组声明 `Vcs.Log.CompareRevisions`；
- `CompareRevisionsFromLogAction`：
  - 仅在恰好选择 2 个 commit 时可见；
  - 两个 commit 必须属于同一 repository root；
  - 调用 `showDiffForPaths(root, affectedPaths, commits[1], commits[0])`；
  - 文件范围是两个提交 affected paths 的并集。

**实现**：

- 新增纯函数 `commitSelectionAfterClick`：
  - 普通点击替换选择；
  - Meta/Ctrl toggle；
  - Shift 从 anchor 到目标做 inclusive range；
  - 选择顺序始终来自当前可见 Log 顺序；
- flat Log 与 Graph 都接入同一选择模型；
- 支持 `⌘/Ctrl+A` 选择当前可见全部提交；
- 右键未选行收敛为单行，右键已选行保留当前多选；
- 新增 `orderedRevisionPair`：
  - 只有两个已加载 hash 时返回；
  - 返回 `newer, older`，用于右侧/左侧方向；
- 新增 `compareCommitRevisions`：
  - 拉取两个 commit detail；
  - 合并 affected paths；
  - entry 携带 `originalRevision` + `modifiedRevision`；
- `gitCombinedDiff` 支持双 revision：
  - 复用 `gitBlobMaybe`；
  - 新增/删除路径允许一侧为 `''`；
  - files 保留 `missing/headExists`；
- diff 标题/提示/tab 标题显示 `Compare Revisions · N files`；
- 左右标题与文件 heading 显示 `older → newer`。

**回归**：

```bash
node --test tests/round567.test.mjs tests/round566.test.mjs \
  tests/round565.test.mjs tests/round46.test.mjs \
  tests/round295.test.mjs tests/static-order.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
git diff --check
```

- RED：round567 初始 **4 fail**；
- 定向 round567/566/565/46/295/static-order
  **25 pass / 0 fail**；
- 全量 `npm test` = **1848 pass / 0 fail**。

**运行态**：

- 临时提交 `r567 older revision` 与 `r567 newer revision`；
- Meta 点击后 DOM 中两个 Log row 同时 `aria-selected=true`；
- Shift 点击可从 newer 区间扩展到 baseline，三行同时选中；
- 双选后右键菜单首项为 `Compare Revisions`；
- 打开 `Compare Revisions · 1 files`；
- 左右标题为 `08addef / e890a09`；
- Monaco 左侧为 `one`，右侧为 `two`；
- 验证后 `git reset --mixed` 回原 baseline，并删除临时文件；
  fixture 恢复为 HEAD `8d5451a`、`M README.md`；
- Computer Use 仍因 macOS 锁屏无法读取 IDEA 实窗；本轮语义由
  `ActionsBundle.properties`、`Vcs.Log.ContextMenu` 与 decompiled
  `CompareRevisionsFromLogAction` 交叉核对。

**下一轮计划**：补齐 Commit 详情文件菜单的 IDEA
`Vcs.OpenRepositoryVersion`，用只读标签打开所选提交中的文件版本，
复用现有 Monaco model 与 Git blob 数据源。

## 2026-11-16 — Compare Commit with Local

**作用域**：Commit Log 的单提交本地比较、aggregate diff 的 revision side。

**IDEA 证据**：

- `action.Vcs.ShowDiffWithLocal.text=与本地比较`；
- `action.Vcs.ShowDiffWithLocal.description=将所选修订中的版本与当前版本进行比较`；
- `Vcs.Log.ContextMenu` 在 Compare Revisions 后声明 `Vcs.ShowDiffWithLocal`；
- `ShowDiffAfterWithLocalFromLogActionProvider` 只允许单选 commit，
  并调用 `showDiffForPaths(root, affectedPaths, commitHash, null)`。

**实现**：

- Client 新增 `commitLocalDiffEntries`：
  - 只使用 `gitShowCommit` 返回的 affected paths；
  - 每项携带 `path/revision/heading`，不扫描无关工作区文件；
- `gitCombinedDiff` 的 entry 支持 `revision`：
  - 复用单文件 revision/local 读取；
  - 抽出 `gitDiffAtRevisionAgainstWorkingCopy`；
  - 单文件 Compare with Revision 仍拒绝 revision 中不存在的路径；
  - 提交聚合允许缺文件侧为 `''`，因此删除提交不会中断整个 diff；
- Commit Log 菜单增加 `Compare with Local`；
- 操作打开只读 combined diff：
  - 标题 `Compare with Local · N files`；
  - 左右标题为 `短哈希 / Current version`；
  - 提示 `Commit <hash> against the current working tree (read-only)`；
  - 复用现有文件级 Previous/Next、hunk、搜索和折叠控制。

**回归**：

```bash
node --test tests/round566.test.mjs tests/round25.test.mjs \
  tests/round321.test.mjs tests/round565.test.mjs \
  tests/round564.test.mjs tests/round66.test.mjs \
  tests/static-order.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
git diff --check
```

- RED：round566 初始 **3 fail**；
- 定向 round566/25/321/565/564/66/static-order
  **30 pass / 0 fail**；
- 全量 `npm test` = **1844 pass / 0 fail**。

**运行态**：

- baseline Commit 右键出现 `Compare with Local`；
- 执行后打开 `Compare with Local · 3 files` 只读聚合 diff；
- 左侧README为提交内容 `End appears here...`；
- 右侧README为当前工作区内容 `Scoped appears here... End again.`；
- 文件导航显示 `1/3`，可切换到提交影响的 docs/src 路径；
- 操作前后 HEAD 仍为 `8d5451a`，原有 `M README.md` 未变化；
- Computer Use 仍因 macOS 锁屏无法读取 IDEA 实窗；动作语义由安装包
  `ActionsBundle.properties`、`intellij.platform.vcs.log.impl.xml` 与
  decompiled `ShowDiffAfterWithLocalFromLogActionProvider` 交叉核对。

**下一轮计划**：补齐 Commit Log 多选与 IDEA `Compare Revisions`，
复用当前 aggregate diff 的文件/方向模型，不新增第二套比较引擎。

## 2026-11-16 — Go to Parent / Child Commit

**作用域**：Commit Log 的父子提交导航、提交图键盘交互。

**IDEA 证据**：

- `intellij.platform.vcs.log.impl.xml` 的 `Vcs.Log.ContextMenu`
  在 Compare/Diff 动作后依次声明 `Vcs.Log.GoToChild`、
  `Vcs.Log.GoToParent`；
- `VcsLogBundle.properties`：
  - `action.Vcs.Log.GoToChild.text=转到子提交`；
  - `action.Vcs.Log.GoToParent.text=转到父提交`；
- 默认 keymap：`GoToParent=RIGHT`，`GoToChild=LEFT`。

**实现**：

- `gitLog` format 增加 `%P`，返回完整 `parents`；
- Client 新增 `commitRelationTargets` / `commitRelationTarget`：
  - parent 只取当前 commit 已记录的父 hash；
  - child 从当前已加载 entries 中反查 parent 指向；
  - 不把上下相邻行误当父子关系；
- Commit Log 菜单增加：
  - `Go to Child Commit`，快捷键显示 `←`；
  - `Go to Parent Commit`，快捷键显示 `→`；
  - 单目标直接导航；merge 多父/多子生成真实候选子菜单；
  - 未加载目标时 disabled；
- flat log 与 Graph listbox 都接管 `← / →`；
- 菜单/键盘导航复用 `showCommit`，同步 selected row、详情和滚动位置；
- Graph mode 下 selected 变化会同步 graph cursor，避免下一次方向键从旧提交出发。

**回归**：

```bash
node --test tests/round565.test.mjs tests/round18.test.mjs \
  tests/round47.test.mjs tests/round65.test.mjs tests/round67.test.mjs \
  tests/round295.test.mjs tests/round560.test.mjs \
  tests/round561.test.mjs tests/round564.test.mjs \
  tests/static-order.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
git diff --check
```

- RED：round565 初始 **4 fail**；
- 定向 round565/18/47/65/67/295/560/561/564/static-order
  **45 pass / 0 fail**；
- 全量 `npm test` = **1841 pass / 0 fail**；

**运行态**：

- fixture 临时创建两个 empty commits，工作区仍只有原有 `M README.md`；
- Log 菜单显示 `Go to Child Commit ←` 与 `Go to Parent Commit →`；
- 从第二个提交点击 Parent 后，详情切到第一个提交；
- flat log 聚焦后 `←` 切到子提交，`→` 切回父提交；
- 验证后 `git reset --mixed` 回到原 baseline，HEAD 和
  `M README.md` 状态均恢复；
- Computer Use 仍因 macOS 锁屏无法读取 IDEA 实窗，文案与 keymap
  使用安装包 XML/properties 静态证据。

**下一轮计划**：实现 IDEA `Vcs.ShowDiffWithLocal` 的提交级本地差异入口，
复用现有 commit diff 与聚合 diff 数据源，不另造比较模型。

## 2026-11-16 — Create Patch from Commit

**作用域**：Commit Log 单提交补丁导出、宿主 Git 路由、浏览器下载。

**IDEA 证据**：

- `action.name.create.patch=创建补丁…`；
- `action.description.create.patch.for.selected.revisions=为所选修订创建补丁`；
- `create.patch.commit.action.progress=正在创建补丁…`。

**实现**：

- 宿主新增 `gitCommitPatch`，先 `rev-parse --verify <rev>^{commit}`；
- 使用 `git format-patch -1 --stdout --binary --no-signature --no-color`；
- 返回 `{ patch, hash, subject }`，全程只读，不移动 HEAD/index/工作区；
- Git 路由增加 `commitPatch`；
- Client 提取 `downloadPatchBlob`，本地更改与提交补丁共用 Blob/download/revoke 链；
- 文件名 `dsh-editor-<short-hash>-<safe-subject>.patch`：
  - subject 的控制字符与 `/ : * ? " < > | \` 等替换为 `-`；
  - 空白折叠，最多 48 个字符；
  - 不同提交至少由短哈希区分；
- Commit Log 菜单新增 `Create Patch from Commit…`，成功/失败复用 Commit notice/error。

**回归**：

```bash
node --test tests/round564.test.mjs tests/round322.test.mjs \
  tests/round321.test.mjs tests/round560.test.mjs \
  tests/round561.test.mjs tests/static-order.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
git diff --check
```

- RED：`tests/round564.test.mjs` 因 `gitCommitPatch` 未导出而 **1 fail**；
- 定向 round564/322/321/560/561/65/67/18/static-order
  **42 pass / 0 fail**；
- 全量 `npm test` = **1837 pass / 0 fail**；
- `node --check lib/client.js`、`node --check lib/index.js`、
  `git diff --check` 均通过。

**运行态**：

- Ego Browser 实际右键 `8d5451a baseline`，菜单出现
  `Create Patch from Commit…`；
- 浏览器 download 事件返回
  `dsh-editor-8d5451a-baseline.patch`，保存为
  `/private/tmp/dsh-editor-r564-baseline.patch`；
- 文件含完整 `From/Subject/diff --git` 与三个新增文件 hunk；
- Commit 工具栏显示 `Created a patch for commit 8d5451a`；
- 生成后 fixture 仍为同一 `HEAD` 且原有 `M README.md` 未变化；
- `Shift+F10` 从 Log listbox 打开同一菜单，入口可键盘到达；
- Computer Use 因 macOS 锁屏无法读取 IDEA 实窗，本轮 IDEA 文案采用安装包
  `localization-zh.jar` 的 `VcsBundle.properties` 静态证据。

**下一轮计划**：审计 Commit Log 的本地/远程分支与提交详情操作，优先补齐
IDEA 中仍缺失且可运行态验证的单提交动作。

## 2026-11-16 — Manual Order Keyboard 与 Reset

**作用域**：Project Manual Order 键盘重排与顺序重置。

**实现**：

- `⌥↑ / ⌥↓` 仅 manual 模式接管；
- 同父 sibling 选择块按 adjacent boundary 移动；
- 移动后保持 selected row 并滚入视野；
- Sort By 增加 Reset Manual Order；
- reset 只清空 manual map，保持 manual 模式；
- 焦点回 Project tree。

**验证**：

- 定向 round563/562/199/207/static-order
  **21 pass / 0 fail**；
- 全量 `npm test` = **1832 pass / 0 fail**；
- DSH Web 验证上下移动、selected row、focus、localStorage 与 reset。

**下一轮计划**：Commit Log `Create Patch from Commit…`。

## 2026-11-16 — Project Manual Order

**作用域**：Project 树 Manual Order 视图排序。

**实现**：

- Sort By 增加 Manual Order；
- per-workspace 保存 parent → child path 顺序；
- 未知新条目保持 host 顺序并排在已知项之后；
- flattenRows 逐层应用手动顺序；
- 拖拽仅重排同父目录 siblings，多选作为连续块；
- 提供 before/after 插入指示；
- manual 拖拽不调用磁盘 moveEntry；
- 跨目录拖拽给出明确提示。

**验证**：

- 定向 round562/199/201/207/project-round13/static-order
  **27 pass / 0 fail**；
- 全量 `npm test` = **1829 pass / 0 fail**；
- DSH Web 拖拽 README 到 docs 前并刷新保持；
- 磁盘目录顺序/文件位置未变化。

**下一轮计划**：增加 keyboard reorder 与 Reset Manual Order。

## 2026-11-16 — Reset Current Branch to Here

**作用域**：Commit Log 的 branch reset。

**实现**：

- `gitResetToRevision` 只接受 soft/mixed/hard；
- 验证 commit 后执行对应 `git reset`；
- Commit Log 增加三模式子菜单；
- detached HEAD disabled；
- Hard 确认显示短哈希与未保存标签数；
- Hard 后重载打开文件，Soft/Mixed 保留工作区；
- 刷新 tree/log/changes/external state。

**验证**：

- 定向 round561/560/65/67/18/static-order
  **31 pass / 0 fail**；
- 全量 `npm test` = **1824 pass / 0 fail**；
- DSH Web 验证三模式菜单、Hard 强确认取消路径、Soft 执行路径。

**下一轮计划**：实现 Project Manual Order 视图排序。

## 2026-11-16 — New Branch from Commit

**作用域**：Commit Log 从任意提交创建分支。

**实现**：

- `gitCreateBranch` 增加 `startPoint`；
- `rev-parse --verify <rev>^{commit}` 先验证历史提交；
- checkout 与不 checkout 两种模式都支持指定 start point；
- Commit Log 增加 `New Branch from {hash}…`；
- 复用 branch name prompt，携带目标 hash；
- `submitNamePrompt` 转发 `startPoint` 并刷新现有视图。

**验证**：

- 定向 round560/65/67/static-order **15 pass / 0 fail**；
- 全量 `npm test` = **1818 pass / 0 fail**；
- DSH Web 创建并切换到测试分支，随后切回 main 并删除。

**下一轮计划**：实现 Reset Current Branch to Here 的三种 reset 模式。

## 2026-11-16 — Terminal Scrollback Recovery

**作用域**：Terminal host 重启后的 tab/scrollback 恢复。

**实现**：

- TerminalScreen 累计 snapshot/data 到 bounded buffer；
- 每 tab 最多 64 KiB 字符、最多 4 tab；
- 仅写当前浏览器 tab 的 sessionStorage，不写 workspace/磁盘；
- 恢复时按 profile 顺序绑定新 PTY；
- seed 只消费一次，避免 reconnect 重复回放；
- Clear screen and scrollback 同步清除 sessionStorage；
- 关闭最后一个终端清空 scope；
- 首次挂载空列表不再覆盖已有快照。

**验证**：

- 定向 round559/terminal-round15/terminal-links/static-order
  **19 pass / 0 fail**；
- 全量 `npm test` = **1814 pass / 0 fail**；
- 宿主同端口重启后 xterm 恢复唯一 marker；
- clear-buffer 后 xterm 与 sessionStorage 同时无 marker。

**边界**：浏览器 tab 关闭后 sessionStorage 由浏览器清除；输出可能含敏感信息，
因此不入 shared workspace/localStorage。

**下一轮计划**：审计 Commit/Project 的下一项可验证 IDEA 差异。

## 2026-11-16 — Atomic File Write

**作用域**：Editor/Project 文本保存与跨文件 Replace 写入。

**实现**：

- `atomicWriteTextFile` 在目标同目录创建 `wx` 临时文件；
- 写入后 `fsync`、关闭、rename；
- 保留原权限位；
- symlink 解析真实目标，保留链接；
- 失败时关闭 handle 并删除临时文件；
- guarded write、create 与 replace 全部复用该路径。

**验证**：

- 定向 round558/write-guard/154/480/483 **26 pass / 0 fail**；
- 全量 `npm test` = **1809 pass / 0 fail**；
- DSH Web 保存后 inode 变化、权限 0644 保持、无临时文件残留；
- fixture 测试后恢复。

**下一轮计划**：审计并实现 bounded terminal scrollback 恢复。

## 2026-11-16 — Search Acceptance 与 IDE 缺口审计

**作用域**：搜索/替换最终验收与后续 IDE 缺口排序。

**验收结果**：

- 26 项 Search Everywhere action 已锁定 ID、状态、双语文案、
  disabled reason 与 `aria-keyshortcuts`；
- Monaco 右键搜索链已覆盖 usage、occurrence、selection-only、
  Find/Replace、Files 与 Search Web；
- Structural Search/Replace 明确作为 AST unavailable 边界；
- README 旧 action 名称与漏列项已修正，并新增 round557 文档一致性测试。

**剩余缺口**：

- Terminal PTY 依赖宿主 provider；宿主重启不恢复 scrollback；
- Editor/Project 写入仍为非原子覆盖；
- Monaco TypeScript Worker 可能受代理限制；
- Structural Search/Replace 缺 language AST。

**验证**：

- 定向 round557/556/555/553/114/static-order
  **22 pass / 0 fail**；
- 全量 `npm test` = **1806 pass / 0 fail**；
- 语法和 whitespace gate 通过。

**下一轮计划**：实现同目录临时文件 + atomic rename 的安全写入。

## 2026-11-16 — Search Action Shortcut Accessibility

**作用域**：Search Everywhere Actions 的快捷键辅助元数据。

**实现**：

- 新增 `searchEverywhereAriaKeyShortcuts`：
  - glyph 映射到 ARIA modifier；
  - 保留 glyph 顺序；
  - 单字符键转大写；
- action 行增加 `aria-keyshortcuts`；
- 视觉 shortcut、tooltip 与辅助属性保持同源。

**验证**：

- 定向 round556/555/553/542/489/447/static-order
  **28 pass / 0 fail**；
- 全量 `npm test` = **1804 pass / 0 fail**；
- DSH Web：
  - `⌘R` → `Meta+R`；
  - `⇧⌘R` → `Shift+Meta+R`；
  - `⌃⌘G` → `Control+Meta+G`；
  - `⌥F7` → `Alt+F7`。

**下一轮计划**：完成搜索/替换最终验收，并转向剩余 IDE tab 差异。

## 2026-11-16 — Search Action State Matrix

**作用域**：26 项 Search Everywhere search/replace actions 的可用性矩阵。

**实现**：

- 新增 round555 矩阵测试，覆盖：
  - editor-only；
  - selection-only；
  - symbol actions；
  - find-step；
  - Structural disabled；
  - workspace always enabled。

**验证**：

- 定向 round555/554/553/528/114/static-order
  **23 pass / 0 fail**；
- 全量 `npm test` = **1801 pass / 0 fail**；
- DSH Web：
  - 无文件：Incremental disabled、Find in Files enabled、
    Structural disabled；
  - 普通光标：selection-only disabled、word-at-caret enabled；
  - 真实选区：selection-only Find/Replace enabled。

**下一轮计划**：审计 Search Everywhere action 辅助功能元数据。

## 2026-11-16 — Structural Search/Replace Boundary

**作用域**：Search Everywhere Actions 的 Structural Search/Replace。

**实现**：

- 增加 `Structural Search…` 与 `Structural Replace…`；
- Monaco 无 language AST，两项固定 disabled；
- disabled reason 明示 AST 要求；
- run 为 no-op，且不写 command history；
- round553 覆盖清单更新为 26 项。

**验证**：

- 定向 round554/553/552/528/472/114/static-order
  **25 pass / 0 fail**；
- 全量 `npm test` = **1795 pass / 0 fail**；
- DSH Web：query=`Structural`：
  - 两项可见、`aria-disabled=true`；
  - disabled reason 可通过 `aria-description` 读取；
  - ArrowDown 不进入下一禁用项；
  - Enter 不关闭 Search Everywhere。

**下一轮计划**：完成 26 项 action 的最终状态矩阵审计。

## 2026-11-16 — Search Action Coverage Audit

**作用域**：Search Everywhere Actions 的搜索/替换功能清单。

**实现**：

- round553 锁定 24 个搜索/替换 action ID；
- 校验 ID 唯一、label/description 完整；
- `disabled` 与 `disabledReason` 数量一致；
- action 引用的双语 key 必须同时存在于 zh/en。

**验证**：

- 定向 round553/552/550/545/114/488/528/static-order
  **31 pass / 0 fail**；
- 全量 `npm test` = **1793 pass / 0 fail**；
- DSH Web（700×900）：
  - Actions 对话框 646px；
  - query=`Replace` 有 8 个结果，行宽 644px；
  - ArrowDown 顺序移动且 `aria-activedescendant` 同步。

**下一轮计划**：显式暴露 Structural Search/Replace 的 unsupported 边界。

## 2026-11-16 — Selection-only Context Menu

**作用域**：Monaco 右键菜单的 selection-scoped editor Find/Replace。

**实现**：

- `navigation` 菜单增加 `Search in Selection Only`（2.4）与
  `Replace in Selection Only`（2.5）；
- 独立 precondition 要求真实选区与非空 symbol query；
- 新增 `selectionFindContextRunnerRef`，复用
  `editorFindSelectionScope`、`findUsagesSearchTarget`、
  `openEditorFindInSelection`；
- selection Find 支持显式 query 与 `query|replace` focus target；
- 两个编辑组传入本地化标题和模式 handler。

**验证**：

- 定向 round552/551/550/549/548/545/538/535/static-order
  **35 pass / 0 fail**；
- 全量 `npm test` = **1789 pass / 0 fail**；
- DSH Web：
  - Search in Selection Only：query=`Scoped`、scope active、`1/1`；
  - query 改为 `e` 后仍 `1/1`，未统计文件其他 8 个 `e`；
  - Replace in Selection Only：scope active、replacement input 聚焦；
    选区内 `Scoped → ScopEd`，其他 `e` 不变；
  - 只有光标、无选区时两项隐藏。

**下一轮计划**：补 Search Everywhere 搜索/替换 action 覆盖清单测试。

## 2026-11-16 — Editor Replace Enter

**作用域**：编辑器 Find 的 replacement input 键盘交互。

**实现**：

- replacement input 的 Enter 在
  `error === null && total > 0` 时调用现有 `replaceCurrent()`；
- Escape 关闭编辑器 Find；
- 输入法组合态不拦截 Enter/Escape；
- 单处替换继续复用 `replaceCurrent` / `editorReplaceAt`，
  不新增写入路径；
- 编辑器单处替换是同步操作，没有 workspace Find 的 replaceBusy 状态。

**验证**：

- 定向 round551/550/549/548/545/485/518/521/static-order
  **29 pass / 0 fail**；
- 全量 `npm test` = **1784 pass / 0 fail**；
- DSH Web：
  - `Scoped → Range`，Enter 后模型更新，replacement input 保持焦点，
    Find 变为 `No matches`，文件标记 Unsaved 且未写盘；
  - 零匹配时 Enter 不修改模型。

**下一轮计划**：增加 selection-only Find/Replace 上下文入口。

## 2026-11-16 — Replace 与 Incremental Search Context Menu

**作用域**：Monaco 右键菜单到编辑器 Find/Replace 的交接。

**实现**：

- `navigation` 菜单增加 `Replace…`（2.2）与
  `Incremental Search`（2.3）；
- 泛化 `editorFindContextRunnerRef` 与 `openEditorFind`：
  - 支持 `withReplace`；
  - 支持 `focusTarget = query | replace`；
- 编辑器 replacement input 增加
  `data-dsh-editor-find-replace-input`；
- 两个编辑组传入本地化标题和模式 handler。

**验证**：

- 定向 round550/549/548/547/545/540/532/static-order
  **29 pass / 0 fail**；
- 全量 `npm test` = **1781 pass / 0 fail**；
- DSH Web：
  - Replace：query=`Scoped`，replace 行显示，
    replacement input 聚焦，`1/1`；
  - Incremental Search：query=`Scoped`，query 聚焦，
    不显示 replace 行，`1/1`；
  - 选区保持 `[3,1 -> 3,7]`；
  - 空白行无符号时两项隐藏。

**下一轮计划**：实现编辑器 Replace 输入框的 Enter 替换行为。

## 2026-11-16 — Word Occurrence Context Menu

**作用域**：Monaco 右键菜单的 next/previous word occurrence。

**实现**：

- `navigation` 菜单增加 `Find Word at Caret`（2.0）与
  `Previous Occurrence of the Word at Caret`（2.1）；
- 复用 selection/caret context key 和 `runSearchCommand`；
- 分别调用 `editor.action.nextSelectionMatchFindAction` 与
  `editor.action.previousSelectionMatchFindAction`；
- 两个编辑组传入本地化标题。

**验证**：

- 定向 round549/548/547/546/545/531/static-order
  **27 pass / 0 fail**；
- 全量 `npm test` = **1778 pass / 0 fail**；
- DSH Web：
  - 选区 `e` 从 `[3,5]` 前进到 `[3,11]`，Previous 回到 `[3,5]`；
  - 焦点保持在 Monaco；
  - 空白行无符号时两项隐藏。

**下一轮计划**：增加 Replace 与 Incremental Search 上下文入口。

## 2026-11-16 — In-file Usages Context Menu

**作用域**：Monaco 右键菜单的 in-file usage search/highlight。

**实现**：

- `navigation` 菜单增加 `Find Usages in File`（1.8）与
  `Highlight Usages in File`（1.9）；
- Find Usages in File 新增 `editorFindContextRunnerRef`，
  调用现有 `openEditorFind(false, query)`；
- Highlight Usages in File 复用
  `editor.action.wordHighlight.trigger`；
- 两个编辑组传入本地化标题与 handler；
- 编辑器 Find 聚焦同样延后 40ms，避开 Monaco 菜单焦点恢复。

**验证**：

- 定向 round548/547/546/545/540/539/530/static-order
  **29 pass / 0 fail**；
- 全量 `npm test` = **1775 pass / 0 fail**；
- DSH Web：
  - Find Usages in File：query=`Scoped`，输入聚焦，`1/1`；
  - Highlight Usages in File：模型出现 `wordHighlightText` 装饰，
    焦点回 Monaco，编辑器 Find 未打开；
  - 选区保持 `[3,1 -> 3,7]`；
  - 空白行无符号时两项隐藏。

**下一轮计划**：增加 Find/Previous Word at Caret 上下文入口。

## 2026-11-16 — Find/Replace in Files Context Menu

**作用域**：Monaco 编辑器右键菜单到 workspace Find 工具窗口的交接。

**实现**：

- `navigation` 菜单增加 `Find in Files…`（1.6）与
  `Replace in Files…`（1.7）；
- 复用 selection/caret context key；
- 新增 `findToolContextRunnerRef`，在 `openFindTool` 声明后注入；
- Find 模式聚焦 query，Replace 模式聚焦 replacement input；
- 发现并修复 Monaco 菜单关闭后抢回编辑器焦点的问题：
  Find 工具聚焦延后到 40ms。

**验证**：

- 定向 round547/546/545/544/539/530/static-order
  **25 pass / 0 fail**；
- 全量 `npm test` = **1771 pass / 0 fail**；
- DSH Web：
  - Find in Files：query=`Scoped`，query 聚焦，`1 match in 1 file`；
  - Replace in Files：query=`Scoped`，replace 行显示，
    replacement input 聚焦；
  - 选区始终为 `[3,1 -> 3,7]`；
  - 空白行无符号时两项隐藏。

**下一轮计划**：增加 Find Usages in File 与 Highlight Usages in File
上下文入口。

## 2026-11-16 — Search Web Context Menu

**作用域**：Monaco 编辑器右键菜单的 IDEA `Search Web`。

**实现**：

- `navigation` 菜单增加 `Search Web`，order `1.5`；
- 复用 selection/caret context key 与 `findUsagesSearchTarget`；
- 两个编辑组传入本地化标题；
- 新标签使用编码 URL、`_blank`、`noopener,noreferrer`。

**验证**：

- 定向 round546 系列 **18 pass / 0 fail**；
- 全量 `npm test` = **1767 pass / 0 fail**；
- DSH Web：选区 `Scoped` 右键后保持 `[3,1 -> 3,7]`；
  - 菜单包含 `Search Web`；
  - 调用 URL=`https://www.google.com/search?q=Scoped`；
  - Search Everywhere 未打开；
  - 空白行无符号时菜单隐藏该项。

**下一轮计划**：在 Monaco 右键菜单增加 Find/Replace in Files。

## 2026-11-16 — Multiple-caret Context Menu

**作用域**：Monaco 编辑器右键菜单的 multiple-caret 搜索。

**实现**：

- `createCodeEditorGroup` 增加 `runSearchCommand`；
- `navigation` 菜单增加：
  - `Select All Occurrences` → `editor.action.selectHighlights`；
  - `Select Next Occurrence` → `editor.action.addSelectionToNextFindMatch`；
  - `Unselect Previous Occurrence` → `cursorUndo`；
- 与 `Find Usages` 共用 selection/caret context key；
- 两个编辑组分别传入本地化标题。

**验证**：

- 定向 round546/545/544/530/static-order **18 pass / 0 fail**；
- 全量 `npm test` = **1767 pass / 0 fail**；
- DSH Web：
  - 选区内部右键不清除选区；
  - Select All 1→9，Select Next 1→2，Unselect Previous 2→1；
  - 空白行无符号时三项隐藏；
  - 右键和动作均不打开 Search Everywhere。

**下一轮计划**：将 `Search Web` 加入 Monaco 右键菜单。

## 2026-11-16 — Search Web

**作用域**：Search Everywhere Actions 的 IDEA `Search Web`。

**实现**：

- 复用 selection/caret resolver；无编辑器或无符号时 disabled；
- 关闭 Search Everywhere 后打开 Google 搜索；
- query 经 `encodeURIComponent`；
- 新标签使用 `_blank` + `noopener,noreferrer`。

**验证**：

- 定向 round544 系列 **25 pass / 0 fail**；
- 全量 `npm test` = **1760 pass / 0 fail**；
- DSH Web：选区 `Scoped`：
  - 调用 `https://www.google.com/search?q=Scoped`；
  - target=`_blank`，features=`noopener,noreferrer`；
  - Search Everywhere 关闭。

**下一轮计划**：将 multiple-caret 搜索动作加入 Monaco 右键菜单。

## 2026-11-16 — Find/Replace in Path Synonyms 与 Find Word at Caret

**作用域**：Search Everywhere Actions 的排序同义词与 word-at-caret 文案。

**实现**：

- `rankSearchActions` 将 `keywords` 纳入 fuzzy match；
- Find in Files：`Find in Path / 在路径中查找`；
- Replace in Files：`Replace in Path / 在路径中替换`；
- 下一个 word 动作改为 IDEA `Find Word at Caret / 查找文本光标处的字`；
- 使用专用 `findWordAtCaretHint`。

**验证**：

- 定向 round543 系列 **32 pass / 0 fail**；
- 全量 `npm test` = **1757 pass / 0 fail**；
- DSH Web：两个 Path synonym 分别命中 Find/Replace in Files；
  `Find Word at Caret` 显示 IDEA 文案。

**下一轮计划**：增加 IDEA `Search Web`。

## 2026-11-16 — IDEA macOS Multiple-caret Shortcuts

**作用域**：编辑器 macOS 快捷键与 Search Everywhere multiple-caret actions。

**对照**：IntelliJ IDEA 2026.2 `keymaps/Mac OS X 10.5+.xml`：

- `SelectNextOccurrence`=`control G`；
- `UnselectPreviousOccurrence`=`control shift G`；
- `SelectAllOccurrences`=`meta control G`。

**实现**：

- 纯函数 `isMacPlatform` 识别 macOS；
- 通用 Find Next 处理器先放行 Control+G 家族；
- 专用监听器复用 `runWordOccurrence`：
  - `editor.action.addSelectionToNextFindMatch`；
  - `cursorUndo`；
  - `editor.action.selectHighlights`；
- Action 行显示对应快捷键。

**验证**：

- 定向 round542 系列 **18 pass / 0 fail**；
- 全量 `npm test` = **1753 pass / 0 fail**；
- DSH Web：`⌃G` 1→2、`⌃⇧G` 2→1、`⌃⌘G` 1→9，
  Monaco 保持焦点。

**下一轮计划**：补 Find/Replace in Path 同义词与 IDEA word 文案。

## 2026-11-16 — Multiple-caret Search Actions

**作用域**：Search Everywhere Actions 的 multiple-caret 搜索。

**实现**：

- `Select All Occurrences` → `editor.action.selectHighlights`；
- `Select Next Occurrence` → `editor.action.addSelectionToNextFindMatch`；
- `Unselect Previous Occurrence` → `cursorUndo`；
- 全部复用 selection/caret resolver、disabled reason 和
  `runWordOccurrence` 焦点归还链。

**验证**：

- 定向 round544/543/542/541/540/114/static-order
  **25 pass / 0 fail**；
- 全量 `npm test` = **1753 pass / 0 fail**；
- DSH Web：1→9、9→2、2→1 个选区，焦点保持在 Monaco。

**下一轮计划**：对齐 IDEA macOS multiple-caret 快捷键。

## 2026-11-16 — Incremental Search

**作用域**：Search Everywhere Actions 的 IDEA `Incremental Search` 入口与
当前编辑器 Find 交接。

**实现**：

- 新增 `incrementalSearch` Action；无 Monaco model 时 disabled；
- query 复用选区或光标处标识符，无标识符时允许空查询；
- `openEditorFind` 区分显式 query：
  - 显式 query 覆盖已有 Find 草稿；
  - index 归零并清除旧 selection scope；
  - 保留搜索选项和替换文本；
- Find 查询输入增加 `data-dsh-editor-find-input`；
- Action 关闭 Search Everywhere 后聚焦 Find 查询输入。

**验证**：

- RED：round540 **0 pass / 3 fail**；
- 定向 **89 pass / 0 fail**；
- 全量 `npm test` = **1745 pass / 0 fail**；
- `git diff --check` 通过；
- DSH Web：
  - 无活动文件时 disabled，原因显示先打开文件；
  - README 打开后 enabled；
  - 选区 `Scoped`、原 Find 草稿 `End`；
  - 执行后 Search Everywhere 关闭，Find query=`Scoped`，scope 关闭，
    输入聚焦，结果 `1/1`。

**IDEA 对照**：IntelliJ IDEA 2026.2 `ActionsBundle.properties` 中
`action.IncrementalSearch.text=增量搜索`，描述为输入时搜索字符串。当前
macOS 锁屏，Computer Use 无法读取 IDEA 原生窗口；本轮使用安装包文案与
DSH Web 运行态交叉验证。

**下一轮计划**：对齐 `Select All Occurrences`、`Select Next Occurrence`、
`Unselect Previous Occurrence`，复用 Monaco 原生 multiple-caret 搜索命令。

## 2026-11-16 — Replace Selection in Files

**作用域**：Search Everywhere Actions 的 workspace replace handoff。

**实现**：

- 增加 `Replace Selection in Files`；
- selection/caret resolver 提供初始 query；
- `openFindTool` 增加 `focusTarget`：
  - query 默认；
  - replace 使用 `data-dsh-find-replace-input`；
- Action 直接打开 replace mode，复用现有确认和写入链。

**验证**：

- RED：round539 **0 pass / 3 fail**；
- 定向 **64 pass / 0 fail**；
- 全量 `npm test` = **1742 pass / 0 fail**；
- 语法检查和 `git diff --check` 通过；
- DSH Web：
  - selection=`Range` 时 action enabled；
  - workspace Find query=`Range`、replace mode、replace input 聚焦；
  - 真实 1 match / 1 file；
  - replacement=`Scoped`，确认 Replace All 后结果 No matches；
  - 编辑器与磁盘第 3 行均更新，第 4 行不变。

**自动化限制**：复用 r535 host 时 SearchText 曾卡 Loading；干净的 r526 host
完成真实结果和写入闭环。

**下一轮计划**：增加 IDEA `Incremental Search` Action，复用编辑器 Find。

## 2026-11-16 — Replace in Selection Only

**作用域**：Search Everywhere Actions 的 selection-scoped editor Replace。

**实现**：

- 增加 `Replace in Selection Only`；
- `openEditorFindInSelection(scope, withReplace = null)`：
  - 默认保留当前 replace-row 状态；
  - Replace Action 显式传入 true；
- 无选区时 disabled；
- 查询、导航和两条替换路径继续复用 selection scope。

**验证**：

- RED：round538 **0 pass / 3 fail**；
- 定向 **80 pass / 0 fail**；
- 全量 `npm test` = **1739 pass / 0 fail**；
- 语法检查和 `git diff --check` 通过；
- DSH Web：
  - selection 为 README 第 3 行；
  - Action 打开 Find + Replace，scope active；
  - Scoped→Range Replace All 只修改第 3 行；
  - 第 4 行 `End again.` 不变；
  - `⌘S` 后磁盘同步。

**下一轮计划**：增加 `Replace Selection in Files`，将选区 query
直接带入 workspace Replace。

## 2026-11-16 — Recent Find Usages 与动作起点排序

**作用域**：Find Usages workspace history、Actions history menu 和
同名前缀 Action 排序。

**实现**：

- 新增 `dsh-editor.findUsages.history:<root>` 独立 workspace history；
- `openFindUsages()` 统一记录 query 后复用 workspace Find；
- Search Everywhere、`⌥F7`、Monaco 右键和历史重跑全部走该 runner；
- 增加 keep-open `Recent Find Usages` Action 和专用 history ContextMenu；
- ranking 对 label 前缀命中给予高于中段/后缀命中的权重。

**问题证据**：

- 初始 RED：round537 **0 pass / 5 fail**；
- 运行态 query=`Find Usages` 时 Recent Find Usages 排在 Find Usages 前；
- 原因是两条 label 的 direct substring score 相同，原顺序把 Recent
  排前；
- 新增排序回归后 RED：**5 pass / 1 fail**。

**修复**：label 起点命中 rank=3，中段命中 rank=2，仅 fuzzy label=1，
描述 fallback=0。

**验证**：

- 定向 **66 pass / 0 fail**；
- 全量 `npm test` = **1736 pass / 0 fail**；
- 语法检查和 `git diff --check` 通过；
- DSH Web：
  - Find Usages 记录 `[\"Scoped\"]` 并打开真实 workspace Find；
  - Recent Find Usages 菜单显示 Scoped；
  - 选择后 workspace Find query=`Scoped`、1 match / 1 file。

**下一轮计划**：增加 `Replace in Selection Only` Action，
直接打开 selection-scoped Replace。

## 2026-11-16 — Find Selection in Files

**作用域**：Search Everywhere Actions 的所选文本 workspace 搜索。

**实现**：

- 增加 `Find Selection in Files`；
- 复用 `findUsagesSearchTarget()` 的 selection/caret query 和 disabled reason；
- Action 标记 `rememberQuery: false`；
- 执行复用 `openFindTool(query, 'find')`，不打开 editor Find。

**验证**：

- RED：round536 **0 pass / 3 fail**；
- 定向 **72 pass / 0 fail**；
- 全量 `npm test` = **1730 pass / 0 fail**；
- 语法检查和 `git diff --check` 通过；
- DSH Web：
  - selection=`Scoped` 时 action enabled；
  - Enter 后 workspace Find query=`Scoped`；
  - 真实结果 1 match / 1 file，位置 `README.md:3:1`；
  - editor Find 不存在，焦点在 workspace Find 输入框。

**下一轮计划**：增加独立 workspace Find Usages 历史与
`Recent Find Usages` Actions 入口。

## 2026-11-16 — Search in Selection Only

**作用域**：编辑器 Find 的 selection scope、导航和替换。

**实现**：

- `editorFindSelectionScope()` 将非空 Monaco selection 转为 model offsets；
- `editorFindResult()` 在全部 literal/regex matches 上统一过滤 scope；
- Find state 增加 `scope`，toolbar target 按钮可开/关；
- Search Everywhere Actions 增加 `Search in Selection Only`；
- scoped Replace All 对已过滤 matches 从后向前执行；
- single/all replace 后按 replacement delta 调整 scope end。

**验证**：

- RED：round535 **0 pass / 6 fail**；
- 定向 **83 pass / 0 fail**；
- 全量 `npm test` = **1727 pass / 0 fail**；
- 语法检查和 `git diff --check` 通过；
- DSH Web：
  - 选择 README 第 3 行后 Action 打开 scope Find；
  - query=`End` 仅 1/1，第 4 行同词被排除；
  - `⌘R` 后 scope 保持；
  - Replace All=`Scoped` 只改第 3 行；
  - 第 4 行保持 `End again.`；
  - `⌘S` 后磁盘内容与编辑器一致。

**下一轮计划**：增加 IDEA `Find Selection in Files` Action，
复用同一 selection/caret query 但进入 workspace Find。

## 2026-11-16 — Highlight Usages in File

**作用域**：Search Everywhere Actions 的活动文件 usage highlight。

**实现**：

- 增加 `Highlight Usages in File`；
- 复用 `findUsagesSearchTarget()` 的 selection/caret availability；
- Action 关闭 Search Everywhere 后回焦 Monaco，调用
  `editor.action.wordHighlight.trigger`；
- 标记 `rememberQuery: false`，不污染搜索历史；
- 不打开编辑器 Find 或 workspace Find。

**验证**：

- RED：round534 **0 pass / 4 fail**；
- 定向 **60 pass / 0 fail**；
- 全量 `npm test` = **1721 pass / 0 fail**；
- 语法检查和 `git diff --check` 通过；
- DSH Web：
  - cursor=`End` 时 action enabled；
  - Enter 后 Search Everywhere 关闭，焦点回 Monaco；
  - 生成两处 `wordHighlightText`；
  - trace 确认执行了 `editor.action.wordHighlight.trigger`。

**下一轮计划**：实现 IDEA `Search in Selection Only`，让编辑器 Find
的匹配、导航与替换共享 selection scope。

## 2026-11-16 — Show Search History keep-open Action

**作用域**：Search Everywhere Actions 的 IDEA `Show Search History` 入口、
history menu 复用和 action 激活语义。

**实现**：

- 引入 `keepOpen` action 标记，激活 action 时只在未标记 keepOpen 时关闭
  Search Everywhere；
- 新增 `searchHistoryRequest` 计数器和 `handledHistoryRequestRef`；
- Action 切到 All 页后请求打开现有 query-history `ContextMenu`；
- 菜单打开不修改 draft，Esc 回焦查询框；
- Show Search History action 标记 `rememberQuery: false`，不污染搜索历史。

**问题边界**：

- Search Everywhere query history opener 是 inline callback，每次 render
  身份都会变化；如果只看 callback dependency，菜单会重复打开；
- 用已处理 request 编号收敛，保证一个 Action 请求只打开一次菜单。

**验证**：

- RED：round533 **0 pass / 4 fail**；
- 定向 **56 pass / 0 fail**；
- 全量 `npm test` = **1717 pass / 0 fail**；
- 语法检查和 `git diff --check` 通过；
- DSH Web：
  - Show Search History 后弹框与 query draft 保持；
  - history menu 打开并聚焦首项；
  - Esc 后菜单关闭、焦点回查询框；
  - 键盘选择 `End` 后 All 页显示 README 两处真实结果；
  - `Show Search History` 未写入 localStorage 历史。

**下一轮计划**：增加 `Highlight Usages in File`，复用同一 selection/caret
resolver 和 Monaco occurrence highlight。

## 2026-11-16 — Find Usages in File 复用编辑器 Find

**作用域**：Search Everywhere Actions 的 file-scoped usage search。

**实现**：

- 增加 `Find Usages in File`；
- 复用 `findUsagesSearchTarget()` 的 selection/caret query；
- `openEditorFind()` 增加 optional `initialQuery`，显式 query 优先于选区；
- action 关闭 Search Everywhere 后只打开 Monaco Find，不调用 workspace
  Find。

**验证**：

- RED：round532 **0 pass / 4 fail**；
- 同步 round464 的 `selectedFind` 静态断言；
- 定向 **45 pass / 0 fail**；
- 全量 `npm test` = **1713 pass / 0 fail**；
- 语法检查和 `git diff --check` 通过；
- DSH Web：
  - query=`Find Usages in File` 时唯一 action enabled；
  - Enter 后 workspace Find 不存在；
  - 编辑器 Find query=`End`，计数 `1/2`；
  - 焦点进入编辑器 Find 输入框。

**下一轮计划**：审计 IDEA `Show Search History` Action，
复用现有 query history 菜单和 workspace 存储。

## 2026-11-16 — Word at Caret occurrence 与 Action label 排序

**作用域**：Search Everywhere Actions 的 next/previous word occurrence
及命令排序。

**实现**：

- 增加 `Next Occurrence of the Word at Caret` /
  `Previous Occurrence of the Word at Caret`；
- 复用 `findUsagesSearchTarget()` 的 selection/caret query；
- 执行时关闭弹框并调用 Monaco `nextSelectionMatchFindAction` /
  `previousSelectionMatchFindAction`，完成后回焦编辑器；
- `rankSearchActions` 优先 label 命中，description 仅作 fallback。

**问题证据**：

- 初始 RED：round531 **0 pass / 4 fail**；
- 真实 query=`Previous Occurrence` 时，Next action 排在 Previous 前；
- 原因：两条 action 的 description 都含
  `next or previous occurrence`，`fuzzyScore` 的 combined-string 分数让
  Next 错排；
- 新增排序回归后 RED：**4 pass / 1 fail**。

**修复**：label 有匹配时使用 `2000 + labelScore`，只有 label 不匹配时才
使用 `label + description` 分数。

**验证**：

- 定向 round531/530/529/528/527/464/469/471/472/488：
  **41 pass / 0 fail**；
- 全量：`npm test` = **1709 pass / 0 fail**；
- 语法检查和 `git diff --check` 通过；
- DSH Web：
  - Next occurrence 执行后选中下一处匹配并回焦 Monaco；
  - Previous 查询 active row 正确，执行后反向回绕到末个 occurrence；
  - Search Everywhere 关闭且无残留；
  - Monaco selection-match 实测大小写不敏感。

**下一轮计划**：增加 `Find Usages in File`，复用当前编辑器 Find，
不打开 workspace Find。

## 2026-11-16 — Monaco 右键 Find Usages、context key 与 TDZ

**作用域**：Monaco editor context menu 的自定义 action、per-editor
precondition、Find Usages 处理器和 editor group 生命周期。

**原始错误**：

- 打开 Editor 后出现：
  `Cannot access 'openFindTool' before initialization`；
- 首版右键菜单完全不出现 `Find Usages…`；
- 运行态发现 `monaco.editor.createContextKey` 为 `undefined`。

**根因**：

1. editor group 的创建 effect 声明在 `openFindTool` 之前，dependency array
   在 render 阶段直接读取 `openFindTool`，触发 const TDZ；
2. Monaco 0.52.2 的 context-key factory 在 editor instance 上，即
   `editor.createContextKey()`，不在 `monaco.editor` namespace；
3. custom action precondition=false 时，Monaco 原生右键菜单会省略该项，
   不提供 disabled 行或 disabled tooltip。

**修复**：

- 新增 `findUsagesRunnerRef`，在 `openFindTool` 就绪后的 effect 中赋值；
- 两个 editor group 只转发 `editor` 到 runner，effect 不再读取 TDZ 变量；
- 每个 group 使用唯一的 `editor.createContextKey()` precondition；
- precondition 统一由 `findUsagesSearchTarget(editor)` 更新；
- action 放入 Monaco `navigation` menu group，右键执行不修改 selection。

**回归**：

- round530 初始 RED **0 pass / 3 fail**；
- round329/530 定向 **8 pass / 0 fail**；
- 搜索链路 **33 pass / 0 fail**；
- 全量 `npm test` = **1704 pass / 0 fail**；
- 语法检查和 `git diff --check` 通过。

**运行态**：

- README 光标在 `End` 时右键，菜单首项为 `Find Usages…`；
- 点击后 Find query=`End`，真实 1 match / 1 file；
- 空行无符号时原生菜单不显示该项。

**下一轮计划**：增加 word-at-caret 的 next/previous occurrence
Actions，复用 Monaco `nextSelectionMatchFindAction` /
`previousSelectionMatchFindAction`。

## 2026-11-16 — Find Usages 复用工作区 Find

**作用域**：Search Everywhere Actions、编辑器 `⌥F7`、当前选区/光标符号
到 workspace Find 的查询派生。

**实现**：

- `findUsagesSearchTarget(editor)` 是唯一 query 派生入口：
  - editor/model 缺失 -> `reason='editor'`；
  - 非空单行选区 -> trim 后作为 query；
  - 多行/空选区 -> 回退到 `getWordAtPosition()`；
  - 无 word -> `reason='symbol'`；
- Actions 增加 `Find Usages… ⌥F7`，执行时调用现有
  `openFindTool(query, 'find')`；
- 工作区 `⌥F7` 共用同一 resolver；
- 中英文补 action、hint、missing-symbol 文案。

**问题证据**：

- 初始 RED：round529 **0 pass / 6 fail**；
- 首版实现把多行选区 `\\nEn` 先 trim 成 `En`，真实 Find query 也错误为
  `En`；
- 新增边界测试后 RED：**6 pass / 1 fail**；
- 根因是换行校验发生在 trim 之后。

**修复**：先拒绝原始值中的 `\\r/\\n`，再 trim 和做长度校验。

**验证**：

- 定向 round529/527/528/472/488：**21 pass / 0 fail**；
- 搜索链路 round529/527/528/464/469/472/488：
  **29 pass / 0 fail**；
- 全量：`npm test` = **1700 pass / 0 fail**；
- 语法检查和 `git diff --check` 通过；
- DSH Web：
  - 光标所在 word=`End` 时 Actions enabled；
  - Enter 打开 Find，query=`End`，真实 1 match / 1 file；
  - `⌥F7` 得到同一结果；
  - 空行无符号时 disabled，tooltip 为
    `Select text or place the caret on a symbol`。

**下一轮计划**：在编辑器右键菜单复用
`findUsagesSearchTarget()`，保持选区/光标不变，并与 Actions、`⌥F7`
使用同一 Find 交接。

## 2026-11-16 — Search Everywhere 禁用提示与窄动作条复核

**作用域**：双击 Shift Actions 中 Find/Replace family 的可用状态、
disabled tooltip、键盘遍历，以及 Search Everywhere 头部动作 overflow。

**运行态证据**：

- 打开 README 并执行编辑器 Find `end` 后：
  - Find/Replace enabled；
  - Find Next/Previous 在存在活动 query 后 enabled；
- 关闭最后一个文件后：
  - Find/Replace、Find Next/Previous disabled；
  - Find in Files/Replace in Files 保持 enabled；
  - Find tooltip 为 `Open a file in the editor first`；
  - 无活动 Find query 时 Find Next tooltip 为
    `Open Find and enter a query first`；
- ArrowUp/ArrowDown 跳过 disabled action，并在 enabled 项间闭环；
- 360px 视口仍直接显示全部 7 个头部动作；
- 强制动作条 140px 后：
  - 直接动作是 Include non-project/Match Case/Filter/Open Find + `»`；
  - overflow 含 Whole Words/Regex/Preview；
  - Esc 后焦点回到 `»`。

**结论**：第 527 轮的可用性和第 488 轮的响应式 overflow 在真实页面中
均成立，本轮无需修改产品代码。

**回归**：`tests/round528.test.mjs`；定向 **14 pass / 0 fail**；
全量 `npm test` = **1693 pass / 0 fail**。

**下一轮计划**：对照 IDEA Actions 增加 `Find Usages…`，复用当前
workspace Find；选区优先，否则读取光标单词。

## 2026-11-16 — Search Everywhere 编辑器动作可用性

**作用域**：双击 Shift Actions 中的 Find/Replace、Find Next/Previous、
Find in Files/Replace in Files，以及没有活动 Monaco model 时的状态。

**问题证据**：

- Find/Replace 与 Find Next/Previous 依赖当前编辑器；
- 无打开文件时仍可执行 Find/Replace，会打开没有模型的查找条；
- Find in Files/Replace in Files 属于 workspace 搜索，不依赖编辑器；
- 两类动作不能共用同一个 disabled 条件。

**实现**：

- Editor 渲染时读取 `currentCodeEditor()?.getModel?.()`；
- Find/Replace/Find Next/Previous 在没有 model 时 disabled；
- disabled reason 使用新增 `findEditorRequired` 本地化文案；
- Find in Files/Replace in Files 保持可用；
- Actions memo 依赖 `hasEditorModel`，打开/关闭文件后立即刷新。

**验证**：

- RED：`tests/round527.test.mjs` 初始 **1 pass / 2 fail**；
- GREEN：round527/464/469/520/521/523/dictionaries/static-order
  定向 **21 pass / 0 fail**；
- 全量：`npm test` = **1689 pass / 0 fail**。
- DSH Web（无文件）：
  - Actions query=Find：Find 和 Next/Previous disabled，
    Find in Files enabled；
  - Actions query=Replace：Replace disabled，Replace in Files enabled。

**下一轮计划**：

1. 用真实 workspace row 打开已加载文件树并验证动作恢复 enabled；
2. 在 700px 视口验证 Search Everywhere 头部动作 overflow；
3. 验证 disabled Action tooltip 和键盘跳过；
4. 补 round528 和全量回归。

## 2026-11-16 — 干净 host 下 busy mask 成功结果

**作用域**：真实 SearchText、Replace All busy、File Mask 修改和成功结果刷新。

**环境**：

- fixture：`/private/tmp/dsh-editor-r526-fixture`；
- home/profile：`/private/tmp/dsh-editor-r526-home` / `r526`；
- DSH Web：`127.0.0.1:63210`。

**运行态证据**：

- 真实 Search Everywhere：query=`end`、mask 空、5 个结果；
- Find 打开后 mask 仍为空；
- replaceText 延迟 1000ms 成功；
- busy 中 mask 改为 `*.md`；
- 响应完成后：
  - replaceText 只启动 1 次；
  - query 保持 end；
  - mask 保持 `*.md`；
  - 真实结果收敛为 README 两处和 docs/notes 一处；
  - alert 为空；
  - 焦点在 File Mask 输入。

**结论**：干净 host 下，成功替换响应不会覆盖 busy 中修改的 mask，
后续搜索按新 mask 返回真实 3 个 Markdown 结果。

**下一轮计划**：

1. 回到双击 Shift 的主链路，审计 Actions 搜索/替换入口；
2. 检查无活动编辑器时 Find/Replace Action 的禁用与提示；
3. 检查窄视口下搜索/替换动作条；
4. 补 round527 和全量回归。

## 2026-11-16 — busy 中 mask 修改与成功响应状态保持

**作用域**：Replace All busy、File Mask 修改、成功响应后的 query/mask 与焦点。

**运行态证据**：

- 延迟 1000ms 的 replaceText 成功响应；
- busy 中将 File Mask 从空改为 `*.md`；
- busy 中 replaceText 只启动 1 次；
- 响应完成后：
  - query 保持当前值；
  - mask 保持 `*.md`；
  - alert 为空；
  - 焦点留在 File Mask 输入。

**自动化限制**：

- 复用 r520 host 时真实 SearchText 再次卡在 Loading；
- 为继续验证 client generation 行为，临时注入固定 searchText 结果；
- 固定响应不遵守 mask，因此 5 条结果数量只证明状态未被覆盖，
  不证明新 mask 的真实结果集合。

**结论**：成功响应不会覆盖 busy 期间的新 query/mask，也不会抢走 mask 焦点；
mask 对应的真实结果集合仍需干净 host 复测。

**下一轮计划**：

1. 新建干净 profile/home，避免复用 r520 host；
2. 真实搜索 query=end、mask=空，再 busy 中改 `*.md`；
3. 验证成功后真实结果从 5 收敛为 3；
4. 补 round526 和全量回归。

## 2026-11-16 — busy 期间修改 File Mask 不接收过期失败

**作用域**：Replace All busy、File Mask 修改、searchGeneration 和旧请求失败。

**运行态证据**：

- Find 初始 query=`end`、mask 为空、5 个结果；
- 延迟 1000ms 的 replaceText 随后失败；
- busy 中将 File Mask 改为 `*.md`；
- busy 中 replaceText 只启动 1 次；
- 旧请求失败后：
  - query 仍为 end；
  - mask 仍为 `*.md`；
  - 新结果为 3 个 Markdown occurrence；
  - alert 为空；
  - 焦点留在 File Mask 输入；
  - `stale option failure` 没有污染新选项结果。

**结论**：选项变化触发的 searchGeneration 已被 `replaceFailureState()` 正确识别，
旧替换失败只解除 busy，不覆盖当前结果或抢焦点。

**下一轮计划**：

1. 用成功响应复测 busy 中 File Mask 修改；
2. 验证成功后仍按新 mask 刷新结果；
3. 检查 replacement 和 active row 收敛；
4. 补 round525 和全量回归。

## 2026-11-16 — 过期 Replace 失败不污染新查询

**作用域**：替换请求进行中修改 query/options、旧请求失败后的错误归属和焦点。

**问题证据**：

- 替换请求开始时捕获旧 query；
- 用户在 busy 期间修改 query 会递增 searchGeneration；
- 旧 replaceText 失败后的 catch 仍无条件把错误和替换焦点写回当前 state；
- 新查询结果会被一个属于旧请求的 alert 污染。

**实现**：

- 新增纯函数 `replaceFailureState(current, requestGeneration, message)`：
  - generation 相同：设置 error、结束 busy、请求替换焦点；
  - generation 已变化：只结束 busy，不设置 error，不抢焦点；
- Replace All 与单处 Replace 在发请求前捕获 requestGeneration；
- 两条 catch 共用该 helper，并通过现有状态栏报告失败文本。

**验证**：

- RED：`tests/round523.test.mjs` 初始 **0 pass / 3 fail**；
- GREEN：round523/521/520/518/516/513/static-order 定向
  **17 pass / 0 fail**；
- 全量：`npm test` = **1686 pass / 0 fail**。
- DSH Web：
  - busy 期间 query `end` → `Value`，旧请求延迟失败；
  - 新查询保持 `Value`、1 个结果、alert 为空；
  - 焦点留在新查询；
  - 同一 query 的延迟失败仍显示 alert，并恢复到替换输入焦点。

**下一轮计划**：

1. busy 期间切换 Match Case/Whole Words/Regex/File Mask；
2. 验证旧失败不会污染新选项结果；
3. 验证成功响应与选项变化的 generation 一致性；
4. 补 round524 和全量回归。

## 2026-11-16 — busy 期间修改查询不丢新结果

**作用域**：延迟 Replace All 成功响应、busy 中 query 修改和结果刷新。

**运行态证据**：

- 受控 replaceText 延迟 1000ms；
- 请求期间 query 从 `end` 改成 `Value`；
- busy 时按钮保持 Loading/disabled；
- 旧请求完成后 query 仍为 `Value`；
- 新查询结果正确为 `app.js:1:17`，1 match；
- alert 为空，replaceText 只启动 1 次。

**结论**：成功响应使用当前 state spread 并触发新 generation 搜索，
没有覆盖 busy 期间的新 query。

**下一轮计划**：

1. 用延迟失败复测 query 变化；
2. 检查旧失败 alert 是否污染新查询；
3. 检查焦点归属；
4. 补 round523。

## 2026-11-16 — Replace busy 期间保持替换输入焦点

**作用域**：Replace All/单处 Replace 的 busy 起始状态、confirmation 关闭后的
焦点和延迟失败恢复。

**问题证据**：

- 接受 confirmation 后 `replaceBusy` 正确阻止再次提交；
- 但 busy 起始 state 只设置 `replaceBusy` 和 `error`，没有焦点请求；
- Ego 实测 busy 期间焦点从替换输入回到 `Find in files…` query，
  连续键盘替换被打断。

**实现**：

- Replace All 与单处 Replace 的 busy 起始 patch 同时递增
  `replaceFocusRequest`；
- 复用已有 FindToolWindow 焦点 effect，立即聚焦
  `Replace in files with…`；
- 不改变 confirmation、busy guard、写入或结果更新。

**验证**：

- RED：`tests/round521.test.mjs` 初始 **0 pass / 2 fail**；
- GREEN：round521/520/518/516/513/static-order 定向 **14 pass / 0 fail**；
- 全量：`npm test` = **1683 pass / 0 fail**。
- DSH Web（延迟后失败）：
  - `replaceText` 启动 1 次；
  - busy 时按钮 Loading/disabled；
  - query=`end`、replacement=`done`、5 个结果保持；
  - busy 和失败后焦点均为 `Replace in files with…`；
  - 失败 alert=`simulated replace failure`，按钮恢复 enabled；
  - fixture 未发生 done 写入。

**下一轮计划**：

1. busy 期间修改 query/options；
2. 验证旧请求完成后不会覆盖新查询结果；
3. 验证 busy 期间导航和 active row 一致；
4. 补 round522 和全量回归。

## 2026-11-16 — Replace All busy 状态与单次提交运行态

**作用域**：clean fixture 的真实 Replace All、受控延迟下的 `replaceBusy`
UI、确认幂等和焦点。

**环境**：

- fixture：`/private/tmp/dsh-editor-r520-fixture`；
- home/profile：`/private/tmp/dsh-editor-r520-home` / `r520`；
- DSH Web：`127.0.0.1:63199`。

**真实写入**：

- 只派发一次 `⌘Enter`；
- confirmation：`Replace 5 occurrence(s) in 3 file(s)?`；
- 接受后 5 处全部变为 `end`；
- Find 结果 0，alert 为空；
- 没有出现 stale 页面或 `Failed to fetch`。

**受控 busy 状态**：

- 临时拦截 `replaceText` fetch，延迟 600ms；
- 接受 confirmation 后立即：
  - `replaceText` 只启动 1 次；
  - Replace All 按钮显示 `Loading…` 且 disabled；
  - query=`end`、replacement=`done`、5 个结果保持；
  - 焦点仍在替换输入；
- 延迟完成后：
  - fetch 启动次数仍为 1；
  - alert 为空；
  - Replace All 恢复 enabled。

**回归**：

- `tests/round520.test.mjs` 锁定 busy 时 `Loading…` 与 disabled；
- 定向 round520/518/516/513：**8 pass / 0 fail**。
- 全量：`npm test` = **1681 pass / 0 fail**。

**下一轮计划**：

1. 模拟 `replaceText` 延迟后失败，验证 loading 解除和错误恢复；
2. 验证失败时 query/results/replacement/focus 保持；
3. 验证 busy 期间导航/query 编辑不会造成陈旧响应覆盖；
4. 补 round521 和全量回归。

## 2026-11-16 — Replace All 快速 ⌘Enter 的确认幂等边界

**作用域**：Find 替换输入框快速重复 `⌘Enter`、原生 confirmation、
Replace All busy guard 和批量写入。

**运行态证据**：

- 复用 r517 fixture/home，剩余 2 处 `needle`；
- 快速连续提交两次 `⌘Enter`：
  - 第一次打开唯一 confirmation：
    `Replace 2 occurrence(s) in 1 file(s)?`；
  - 第二次在 confirmation 打开期间被浏览器对话框机制阻止，
    没有出现第二个确认；
- 接受后 `src/app.js` 两处 `needle` 均变为 `end`；
- 没有发生第二批重复写入。

**自动化限制**：

- 第二次按键在 JS confirm 打开时触发 Ego `PageDialogOpenedError`，
  随后短时间页面 evaluate 超时；
- 通过 `acceptDialog()` 恢复后磁盘写入正确，但自动化造成一次临时
  `Failed to fetch` 和 stale Find 列表，未作为产品运行态结论。

**结论**：快速重复 `⌘Enter` 只产生一个确认和一批写入；失败后的
query/results/focus 仍需要在更洁净的自动化路径中复测。

**下一轮计划**：

1. 新建干净 fixture，避免复用已修改文件和 stale 页面；
2. 每次只派发一次 `⌘Enter`，接受确认后再检查 busy/结果/焦点；
3. 用受控延迟或并发请求验证 busy guard 的 UI 状态；
4. 补 round520 和全量回归。

## 2026-11-16 — 快速连续 Enter 的单处替换幂等门禁

**作用域**：Find 替换输入框快速重复 Enter、`replaceBusy` 并发保护和结果推进。

**运行态证据**：

- 同一替换输入框连续发送两次 Enter：
  - 结果 4 → 3；
  - 只推进一个 occurrence；
  - 焦点仍在替换输入；
- 同一 JavaScript task 内同步派发两次 keydown Enter：
  - 仍只替换 docs/notes 一处；
  - 结果 3 → 2；
  - active 推进到 src/app.js；
- 磁盘只发生一次 `needle → zip`，没有双写。

**回归**：

- `findTool.replaceBusy === true` 在 Replace All 与单处 Replace 入口
  均短路第二次提交；
- `tests/round518.test.mjs` 锁定两条入口的 busy guard；
- 定向 round518/516/513/480：**11 pass / 0 fail**。
- 全量：`npm test` = **1680 pass / 0 fail**。

**下一轮计划**：

1. 快速重复 `⌘Enter` 验证 Replace All 只产生一批写入；
2. 验证 Replace All 的 confirmation 不会重复弹出；
3. 验证并发保护失败后 query/results/focus 保持；
4. 补 round519 和全量回归。

## 2026-11-16 — 单处 Replace 键盘路径运行态

**作用域**：Find 替换输入框 `Enter`、dirty/mtime guard、成功推进和焦点连续替换。

**环境**：

- fixture：`/private/tmp/dsh-editor-r517-fixture`；
- home/profile：`/private/tmp/dsh-editor-r517-home` / `r517`；
- DSH Web：`127.0.0.1:63188`。

**运行态证据**：

- dirty README 命中：
  - 在替换输入框按 Enter；
  - dirty guard 生效，结果数 5、activeDesc 和 replacement 保持；
  - alert 为 dirty-file 原因，焦点仍在
    `Replace in files with…`；
- 保存并重新搜索后：
  - active 为 `README.md:3:1`，5 个结果；
  - 在替换输入框按 Enter；
  - README 当前命中写为 `pin`；
  - 结果缩为 4；
  - active 自动推进到 `README.md:3:26`；
  - alert 为空，焦点保持在替换输入。

**结论**：键盘 Enter 与按钮路径在 dirty guard、成功写入、结果推进和
连续替换焦点上保持一致。

**下一轮计划**：

1. 连续快速按 Enter，验证 `replaceBusy` 阻止并发双写；
2. 验证只产生一次磁盘替换和一个结果推进；
3. 快速 Enter 与 query 变化交错时保持 active 一致；
4. 补 round518 和全量回归。

## 2026-11-16 — 单处 Replace 后保持连续替换上下文

**作用域**：Find 工具窗口单处 Replace 成功后的结果推进、焦点和键盘连续性。

**问题证据**：

- 单处 Replace 成功后会刷新搜索结果并推进 active occurrence；
- 点击 Replace 按钮的成功路径没有明确焦点 owner，最终焦点落到 `<body>`；
- 用户要进行下一处替换时必须重新点回替换输入。

**实现**：

- 单处 Replace 成功 state patch 继续保留
  `index: activeIndex + searchGeneration/loadedGeneration` 的结果推进；
- 同时递增 `replaceFocusRequest`；
- 既有 FindToolWindow focus effect 把焦点恢复到
  `Replace in files with…`；
- 不改变磁盘写入、mtime/occurrence 校验或结果数量。

**验证**：

- RED：`tests/round516.test.mjs` 初始 **0 pass / 2 fail**；
- GREEN：round516/513/514/480/static-order 定向 **15 pass / 0 fail**；
- 全量：`npm test` = **1678 pass / 0 fail**；
- DSH Web：
  - 搜索剩余 2 个 `needle`，active=`README.md`；
  - 单处 Replace 后结果缩为 1，active 自动推进到 `src/app.js`；
  - README 当前命中写为 `pin`；
  - 焦点保持在 `Replace in files with…`，alert 为空。

**下一轮计划**：

1. 用替换输入框 `Enter` 触发单处 Replace，而不是点击按钮；
2. 验证成功推进和焦点连续替换；
3. 验证 dirty/mtime 失败时 Enter 路径同样保留 active row；
4. 补 round517 和全量回归。

## 2026-11-16 — 单处 Replace 的安全与推进运行态

**作用域**：Find 单处 Replace 的脏文件保护、mtime conflict、
active occurrence、结果数量和成功推进。

**运行态证据**：

- fixture/home：`/private/tmp/dsh-editor-r515-fixture`、
  `/private/tmp/dsh-editor-r515-home`，DSH Web `63177`；
- 先对 clean `docs/notes.md` 单处替换：
  - 替换成功，证明 dirty README 不会误伤其他 clean 文件；
  - active 推进到下一个 file/occurrence；
- 选中 dirty README 的单处命中：
  - 显示 `Save or close these modified files...`；
  - active descendant、3 个结果和 replace 焦点全部保留；
- 保存并重新搜索后，外部修改 README：
  - 单处 Replace 被宿主 mtime 校验拒绝；
  - active descendant、3 个结果和 replace 焦点保留；
  - README 未写入；
- 再次重新搜索后执行成功单处 Replace：
  - README 当前命中变为 `pin`；
  - 结果由 3 减为 2；
  - active 推进到 README 下一命中；
  - alert 为空。

**结论**：单处 Replace 的 clean-file 精确写入、dirty/mtime 拒绝、
active 推进和连续替换上下文均真实工作。

**下一轮计划**：

1. 用 `Enter` 键触发单处 Replace；
2. 验证键盘路径与按钮路径结果/焦点一致；
3. 验证失败后 Enter 不会误触发下一处；
4. 补 round517 和全量回归。

## 2026-11-16 — Find 替换错误随查询或选项变化清除

**作用域**：Find 工具窗口的 query、Match Case、Whole Words、Regex、
File Mask 与旧替换错误生命周期。

**问题证据**：

- Replace All 因脏文件或 mtime 冲突失败后，`state.error` 显示 alert；
- 只改 query/options 时旧 state patch 没有清 `error`；
- 用户下一次输入已经改变了搜索条件，但旧错误仍可能留在工具窗口。

**实现**：

- query 变化时立即写入 `error: null`；
- Match Case、Whole Words、Regex、File Mask 变化也立即清错；
- 继续递增 search generation、清空旧 files/matches，不改变查询/替换历史。

**验证**：

- RED：`tests/round514.test.mjs` 初始 **0 pass / 2 fail**；
- GREEN：round514/513/508/480/static-order 定向 **16 pass / 0 fail**；
- 全量：`npm test` = **1676 pass / 0 fail**；
- DSH Web：
  - 脏文件失败后 alert 保留，replace 输入仍聚焦；
  - query 从 `needle` 改为 `need` 后 alert 立即消失；
  - replacement=`pin` 保留。

**下一轮计划**：

1. 运行态复测单处 Replace 的脏文件和 mtime 冲突；
2. 验证单处失败后 active row、结果集与 replace 焦点保持；
3. 区分 Replace All 与单处 Replace 的错误文案/恢复路径；
4. 补 round515 和全量回归。

## 2026-11-16 — Find 替换失败保留替换输入焦点

**作用域**：Replace All/单处 Replace 的脏文件保护、mtime conflict、
错误恢复和替换输入焦点。

**问题证据**：

- 失败分支只设置 `replaceBusy=false` 与 `error`；
- 点击 Replace All 失败后 alert 虽然出现，但焦点落到 `<body>`；
- 用户需要重新点击替换输入，键盘连续操作被中断。

**实现**：

- Replace All 和单处 Replace 的 dirty/catch 分支递增
  `replaceFocusRequest`；
- FindToolWindow 监听该 revision，在 replace mode 下把焦点恢复到
  `Replace in files with…`；
- revision 只控制焦点，不重建 query、结果或替换草稿。

**验证**：

- RED：`tests/round513.test.mjs` 初始 **0 pass / 3 fail**；
- GREEN：round513/508/480/467/static-order 定向 **18 pass / 0 fail**；
- DSH Web：
  - 脏文件 Replace All 失败；
  - alert 显示 dirty-file 原因；
  - query=`needle`、5 个结果保留；
  - 焦点为 `Replace in files with…`；
  - mtime conflict 同样保留 alert、query、5 个结果和替换焦点，
    三个 fixture 文件均未被写入。

**下一轮计划**：

1. 运行态复测单处 Replace 的失败路径；
2. 检查失败后当前 active occurrence 是否保持；
3. 检查成功单处替换后仍推进到下一处；
4. 补 round515 和全量回归。

## 2026-11-16 — Replace in Files 脏文件与 mtime 冲突门禁

**作用域**：Find/Replace in Files 的未保存标签保护、外部修改冲突、
错误提示、结果保留和写入安全。

**运行态证据**：

- 新隔离 fixture/home：`/private/tmp/dsh-editor-r512-fixture`、
  `/private/tmp/dsh-editor-r512-home`，DSH Web `63166`；
- README 在 Monaco 中改成未保存状态：
  - Replace All 不弹确认框；
  - Find 保留 query=`needle`、replace=`pin`、5 个结果；
  - `role="alert"` 显示
    `Save or close these modified files before Replace in Files: README.md`；
- 保存后重新搜索，Find 再次得到 5 个结果；
- 在外部 shell 向 README 追加内容后点击 Replace All：
  - 先出现正常的 `Replace 5 occurrence(s) in 3 file(s)?` 确认；
  - 接受后宿主按 mtime 拒绝；
  - Find 保留 query、replacement 和 5 个结果；
  - alert 显示
    `the file changed on disk since it was searched: README.md`；
  - 三个 fixture 文件均未发生 `needle` 写入。

**结论**：

- 脏文件保护在确认框之前执行；
- mtime 冲突在宿主 preflight 拒绝，不会只写部分文件；
- 两类失败都保留当前 Find 上下文，用户仍可调整 query 后重新搜索。

**下一轮计划**：

1. 审计失败后的键盘焦点归属，避免 alert 出现后焦点落到 `<body>`；
2. 区分用户点击 Replace All 与替换输入框 `⌘Enter` 的焦点恢复；
3. 检查错误清除时机，确保下一次有效查询不会遗留旧 alert；
4. 补 round513、全量回归和隔离 DSH Web 门禁。

## 2026-11-16 — Search Everywhere Find Next 恢复编辑器焦点

**作用域**：Search Everywhere 打开时的 `⌘G / ⇧⌘G`、编辑器 Find 步进和焦点归属。

**问题证据**：

- `editorFindStepRef` 已有 Find Next/Previous 实现，但只由 Search Everywhere Actions 调用；
- 弹框内按 `⌘G` 没有全局入口，不能像 IDEA 一样直接跳到下一处；
- 即使补上步进，弹框卸载后焦点会落到 `<body>`，用户还需要再点编辑器。

**实现**：

- Editor 搜索快捷键扩展为 `f / r / g`；
- `⌘G / ⇧⌘G` 在 workspace 内调用 `editorFindStepRef.current(±1)`；
- 从 Search Everywhere 触发时先关闭弹框，再步进，并在下一任务把焦点还给
  `currentCodeEditor()`；
- Terminal、Project/Changes/Log、Persistent Find 继续拥有各自输入框的按键。

**验证**：

- RED：`tests/round511.test.mjs` 初始 **1 pass / 1 fail**；
- GREEN：round511/509/508/507/506/504/493/static-order 定向
  **25 pass / 0 fail**；
- 全量：`npm test` = **1671 pass / 0 fail**；
- 隔离 DSH Web：README 中 `pin` 为 `1/2`，打开 Search Everywhere 后按
  `⌘G`，弹框关闭、计数变为 `2/2`，焦点为 `编辑器内容`。

**下一轮计划**：

1. 复测 Replace in Files 对打开且未保存文件的拒绝路径；
2. 复测搜索后文件被外部修改时的 mtime 冲突；
3. 检查失败后 Find 结果、query 和焦点是否保持；
4. 补 round512 和全量回归。

## 2026-11-16 — Replace in Files 真实宿主写入闭环

**作用域**：Search Everywhere → Find 的 Replace All、确认框、宿主写入、
结果刷新和 Git 状态。

**运行态证据**：

- fixture Search 返回 `5 matches in 3 files`；
- 替换输入设为 `pin` 后 `⌘Enter` 打开原生 confirmation：
  `Replace 5 occurrence(s) in 3 file(s)?`；
- 接受后状态栏显示 `Replaced 5 occurrence(s) in 3 file(s)`；
- Find 结果刷新为 `No matches`；
- 磁盘内容：
  - README 两处 `needle` 变为 `pin`；
  - docs/notes 一处变为 `pin`；
  - src/app.js 两处变为 `pin`；
- `git status` 只出现预期的三个修改文件，没有额外写入。

**结论**：client Replace All、confirmation、宿主 guarded replace、
打开文件重载和 Git 刷新链路均真实通过。

## 2026-11-16 — Search Everywhere 全局 Find Next/Previous

**作用域**：Search Everywhere 的 `⌘G / ⇧⌘G`、编辑器 Find 匹配步进。

**问题证据**：

- Search Everywhere Actions 已列出 Find Next/Previous；
- 弹框打开时没有对应全局快捷键，浏览器默认 Find Next 可能接管；
- Actions 的 `editorFindStepRef` 只在执行 Action 时调用。

**实现**：

- 搜索快捷键范围扩展为 `f / r / g`；
- 统一 host containment 和输入区域排除；
- `⌘G` 调用 `editorFindStepRef.current(1)`，`⇧⌘G` 调用 `-1`；
- 从 Search Everywhere 触发时关闭弹框，再执行步进。

**验证**：

- RED：`tests/round509.test.mjs` 初始 **0 pass / 3 fail**；
- GREEN：round509/508/507/506/504/493 定向 **19 pass / 0 fail**；
- 隔离 DSH Web：编辑器 Find 为 `1/2`，Search Everywhere 中按 `⌘G`
  后弹框关闭且变为 `2/2`；随后聚焦编辑器按 `⇧⌘G` 回到 `1/2`。

## 2026-11-16 — 打开 Find 工具窗口时恢复查询焦点

**作用域**：`openFindTool()`、Shift+Cmd+F、Search Everywhere Actions
和 Project tree 的 Focus Text Filter 竞争。

**问题证据**：

- Find 工具打开后输入框依赖 React `autoFocus`；
- 从 Search Everywhere/Project 快捷键打开时，宿主 Project speed search
  可能在随后抢走焦点，最终活动元素为 `Search in Project`；
- 工具窗口已显示，但键盘输入会进入错误的搜索框。

**实现**：

- `openFindTool()` 设置 state 后，以 0ms 任务显式聚焦
  `[data-dsh-find-tool-window] input[role="combobox"]`；
- 不改搜索 query、结果、handoff revision 或 mode；
- 不新增第二套搜索生命周期。

**验证**：

- RED：`tests/round508.test.mjs` 初始 **1 pass / 2 fail**；
- GREEN：round508/507/506/504/503/502/501/499 定向 **26 pass / 0 fail**；
- 隔离 DSH Web：Search Everywhere 中 `⇧⌘F` 后 Find 打开，
  焦点为 `Find in files…`，Project speed search 未打开。

## 2026-11-16 — Search Everywhere 保留 Cmd/Ctrl+F

**作用域**：Search Everywhere 内的 `⌘F / ⇧⌘F` 与全局编辑器 Find 竞争。

**问题证据**：

- 第 504 轮为 Replace 快捷键加了 `searchEverywhereOpen` 全局提前返回；
- 该返回同时挡住了 `⌘F / ⇧⌘F`，使 Actions 展示的 Find 快捷键失效；
- 普通 `⌘F` 还需要先关闭 Search Everywhere，不能把弹框留在编辑器 Find 上方。

**实现**：

- 全局搜索 handler 只把 `r` 让给 Search Everywhere；
- `⌘F` 关闭 Search Everywhere 后打开当前 Monaco Find；
- `⇧⌘F` 继续打开持久 Find in Files；
- host containment 和 Terminal/Project/Changes/Log/Persistent Find
  的输入所有权保持不变。

**验证**：

- RED：逐步确认 guard 抢键 1 fail、弹框未关闭 1 fail；
- GREEN：round507/506/504/503/502/499/493 定向 **24 pass / 0 fail**；
- 隔离 DSH Web：
  - Search Everywhere 中 `⌘F` 后弹框关闭，焦点进入 Monaco
    `Find` 输入；
  - `⇧⌘F` 打开持久 Find，并在第 508 轮修复焦点归属。

## 2026-11-16 — Search Everywhere Shift+Replace in Files

**作用域**：Search Everywhere 内 `⇧⌘R / Ctrl+Shift+R` 与普通 Replace 的分流。

**问题证据**：

- 第 504 轮的 Replace key handler 没有区分 Shift；
- `⇧⌘R` 被当作普通 Replace，错误执行 active-result handoff；
- Actions 的 `Replace in Files… ⇧⌘R` 应打开空白内容替换工具。

**实现**：

- 抽出唯一 `openBlankReplaceInFiles()` 请求构造；
- `⇧⌘R` 优先执行空白 Replace in Files；
- 普通 `⌘R` 继续保留 active content result、query 和搜索选项移交。

**验证**：

- RED：`tests/round506.test.mjs` 初始 **1 pass / 2 fail**；
- GREEN：round506/504/503/502/501/500/499 定向 **25 pass / 0 fail**；
- 隔离 DSH Web：
  - 选中 docs/notes 后 `⇧⌘R`，Find query 为空、0 结果、replace mode；
  - 同一路径普通 `⌘R`，Find query=`needle`，且 docs/notes active。

## 2026-11-16 — Search Everywhere 接管 Replace 快捷键

**作用域**：Search Everywhere 打开时的 `⌘R / Ctrl+R`、Actions 的
`Replace… ⌘R`、全局编辑器 Find/Replace handler 和内容结果移交。

**问题证据**：

- Search Everywhere Actions 向用户展示 `Replace… ⌘R`；
- Search Everywhere 自身未消费 Meta/Ctrl+R，Editor 捕获阶段的
  全局 Find handler 会先执行，打开当前 Monaco 的 Replace；
- 因此对话框里按 ⌘R 既没有执行 Search Everywhere Replace，
  还会把键盘上下文切到编辑器；
- 文本结果应继续走 active-result handoff；动作查询等非内容查询
  则应该打开空白 Replace in Files，不能把动作过滤词带入内容输入。

**实现**：

- Search Everywhere 增加 window capture keydown：
  - 仅处理 Meta/Ctrl+R；
  - preventDefault + stopPropagation；
  - 有 Files/Text 内容结果时调用
    `openSearchResultsInFind('replace', activeResult)`；
  - 无内容结果时打开空 query 的 Replace in Files；
- Editor 全局 Find/Replace handler 在 `searchEverywhereOpen` 时直接返回，
  不再抢 Search Everywhere 的快捷键；
- 大结果 confirmation 和现有 handoff 模型保持不变。

**验证**：

- RED：`tests/round504.test.mjs` 初始 **0 pass / 3 fail**；
- GREEN：round504/503/502/501/500/499/495/493 定向
  **31 pass / 0 fail**；
- 全量：`npm test` = **1658 pass / 0 fail**；
- `node --check lib/client.js`、`lib/index.js`、`lib/terminal.js` 与
  `git diff --check` 通过；
- 运行态限制：多次重建同一隔离 DSH host 后，后续页面导航被宿主
  既有 `/api/dsh-editor/fs|git` 请求死锁阻塞；本轮未能取得
  `⌘R` 的最终浏览器证据，未把静态测试冒充运行态通过。
- CUA `getState()` 仍返回 Mac 锁屏；IDEA 对照使用 2026.2.3 安装包契约。

**下一轮计划**：

1. 用纯 Node 静态 fixture 启动新的隔离 DSH home，避开复用 host 的请求死锁；
2. 复测 Search Everywhere 文本结果 `⌘R`：Find replace mode、query、
   active descendant 与结果保持；
3. 复测 Actions 的 Replace 快捷键在无内容结果时打开空白替换工具；
4. 补 round505 运行态门禁，并继续审计 Find 文件组内的局部替换动作。

## 2026-11-16 — Search Everywhere Actions 不再泄漏动作过滤词

**作用域**：Search Everywhere Actions 的 `Find in Files…`、
`Replace in Files…`，以及 Actions 与内容结果移交的查询语义。

**问题证据**：

- Actions 页的查询词用于过滤动作名称，不是文件内容查询；
- `Find in Files…` / `Replace in Files…` 的 run 闭包此前把
  `searchEverywhere.query` 传给 `openFindTool()`；
- 在 Actions 页输入 `Replace in Files` 并执行后，Find 工具窗口
  把动作过滤词当成内容查询，带入 `Replace in Files` 输入框；
- 内容结果的 Header Open Find 与文本菜单 Replace 是另一条语义，
  仍必须保留真正的搜索 query、结果和 active row。

**实现**：

- Actions 的 `Find in Files…` 固定调用 `openFindTool('', 'find')`；
- Actions 的 `Replace in Files…` 固定调用
  `openFindTool('', 'replace')`；
- actions memo 移除已无用途的 `searchEverywhere?.query` 依赖；
- 内容结果的 `searchFindHandoff()`、active row、查询和选项移交保持不变。

**验证**：

- RED：`tests/round503.test.mjs` 初始 **1 pass / 2 fail**；
- GREEN：round503/502/501/500/499/464/467/468 定向
  **30 pass / 0 fail**；
- 全量：`npm test` = **1655 pass / 0 fail**；
- 隔离 DSH Web（固定 Files/Text 响应验证客户端动作）：
  Search Everywhere Actions 输入 `Replace in Files` 并 Enter 后，
  Find 以 replace mode 打开，query 为空、结果为空，查询输入获得焦点；
  动作过滤词没有进入内容搜索框。
- `node --check lib/client.js`、`lib/index.js`、`lib/terminal.js` 与
  `git diff --check` 通过；
- CUA `getState()` 仍返回 Mac 锁屏；IDEA 对照使用 2026.2.3 安装包契约。

**下一轮计划**：

1. 审计 Search Everywhere 打开时的 `⌘R / Ctrl+R` 是否与 Actions 的
   `Replace… ⌘R` 一致；
2. 确认全局编辑器 Find handler 不会抢走 Search Everywhere 内的替换快捷键；
3. 文本结果按 `⌘R` 应走现有 Replace 移交，非内容查询应打开空白替换工具；
4. 补 round504、全量回归和隔离 DSH Web 门禁。

## 2026-11-16 — Find 交接展开折叠目标组并保持 Replace 上下文

**作用域**：Search Everywhere → Find 的重复交接、目标文本组折叠、
active index 收敛、Replace mode 切换和结果滚动。

**问题证据**：

- `openFindTool()` 只把 active index 传到 Find option 序列；
- Find 已打开且目标文本组被用户折叠时，可见 option 序列变短，
  原 index 会被 clamp 到另一个仍可见结果；
- 后续 Search Everywhere 再次移交同一命中时，旧折叠状态仍然存在，
  祖先组不会自动展开，active descendant 与用户选择不一致。

**实现**：

- `openFindTool()` 为每次移交写入单调递增的 `handoffRevision`；
- 新增 `findToolHandoffTarget()`，先在未折叠的完整 Files + Text 序列中
  按 index 恢复目标 rowKey；
- Find 在收敛 active index 前先移除目标文本组的折叠状态；
- 目标恢复可见后，按 rowKey 找到新的可见索引并更新选中行、descendant
  和滚动位置；
- active index 收敛 effect 在本次 handoff 完成前暂停，避免先一步把
  state index 改到错误结果；
- Replace mode 只切换模式与聚焦替换输入，不重建 handoff、结果或折叠状态。

**验证**：

- RED：`tests/round502.test.mjs` 初始 **1 pass / 3 fail**；
- GREEN：round502/501/500/499/498/497/496/480/469/467 定向
  **46 pass / 0 fail**；
- 全量：`npm test` = **1652 pass / 0 fail**；
- `node --check lib/client.js`、`lib/index.js`、`lib/terminal.js` 与
  `git diff --check` 通过；
- 宿主纯函数：`searchWorkspaceText()` 对 fixture 的 `needle` 查询
  10ms 返回 README 两处和 `docs/notes.md` 一处；
- 隔离 DSH Web（固定 Files/Text 响应验证客户端交接）：
  - 首次 Open Find 后目标 `docs/notes.md:2:1` 被选中；
  - 手动折叠 `docs/notes.md` 后可见结果收敛到 README；
  - 再次 Search Everywhere 选择同一命中并 Open Find，
    `docs/notes.md` 组自动展开，`aria-selected=true`、
    active descendant 和滚动可见行都恢复为该命中；
  - 文本结果 `Replace…` 后替换输入获得焦点，
    README/docs 两组展开状态、active descendant 和结果集不变。
- CUA `getState()` 仍返回 Mac 锁屏；IDEA 对照使用 2026.2.3 安装包契约。

**下一轮计划**：

1. 审计 Search Everywhere Actions 的 `Replace in Files…` 是否保留当前
   query、Files/Text 结果、active result 和搜索选项；
2. 审计 `⌘R` 在 Search Everywhere 文本结果和 Find 文本结果上的入口一致性；
3. 补一个直接 Action 与文本菜单共用同一 handoff 的运行态契约；
4. 补 round503、全量回归和隔离 DSH Web 门禁。

## 2026-11-16 — Find 交接保留 Search Everywhere 活动结果

**作用域**：Search Everywhere → Find/Replace 的 active result 移交、
`openFindTool()` initial index 收敛和文本结果菜单定位。

**问题证据**：

- Header Open Find 与文本结果 `Replace…` 虽保留 query、结果和选项，
  但 Find 固定从结果序列第 0 行开始；
- 用户已选中的 `docs/notes.md:2:1` 在交接后丢失活动上下文，
  需要再次在 Find 中寻找同一命中；
- 文件结果与文本结果共用 Find option 序列，若只按 Text 索引移交，
  会与 `fileResults + matches` 的真实顺序错位。

**实现**：

- `searchFindHandoff()` 接受 `activeRowKey`，复用最终 option rowKey
  计算 `index`，无匹配或越界时回退 0；
- Search Everywhere Header 使用当前 `activeResult`，文本结果菜单
  `Replace…` 使用被点击的 result，两者继续共享确认和移交逻辑；
- `openFindTool()` 保存 initial index，并按 Files + Text 总数收敛；
- Find 打开后 active descendant、选中行和 replace mode 指向同一结果；
- 不新增第二套结果顺序、确认阈值或替换写入路径。

**验证**：

- RED：`tests/round501.test.mjs` 初始 **0 pass / 4 fail**；
- GREEN：round501/500/499/468/467 定向 **20 pass / 0 fail**；
- 全量：`npm test` = **1648 pass / 0 fail**；
- `node --check lib/client.js`、`lib/index.js`、`lib/terminal.js` 与
  `git diff --check` 通过；
- 隔离 DSH Web：
  - 文本结果 `docs/notes.md:2:1` 选择 `Replace…` 后，Find 以
    replace mode 打开，query=`needle`，active descendant 与
    `aria-selected=true` 均指向 `docs/notes.md:2:1`；
  - Header Open Find 前先激活同一结果，Find 打开后仍选中该行，
    且保持 find mode。
- CUA `getState()` 仍返回 Mac 锁屏；IDEA 对照使用 2026.2.3 安装包契约。

**下一轮计划**：

1. 审计 initial active text result 所属文件组折叠时是否自动展开祖先组；
2. 审计 initial active file result 的 listbox descendant 与滚动位置；
3. 验证 Replace mode 打开后组折叠状态和 active row 持续稳定；
4. 补 round502、全量回归和隔离 DSH Web 运行态门禁。

## 2026-11-16 — Search Everywhere → Find 统一交接模型

**作用域**：Search Everywhere Header Open Find、文本菜单 Replace、
结果集、mode、搜索选项和大结果确认。

**问题证据**：

- Header 与结果菜单此前各自组装 Find initial、mode 和选项，容易分叉；
- Regex 与 Whole Words 的互斥只在 UI toggle 层处理，交接模型未防守；
- 大结果 confirmation 与 request 字段没有单一纯对象可测试；
- 选项组合需要通过重复静态断言才能覆盖。

**实现**：

- 新增 `searchFindHandoff()` 纯函数：
  - 输出 `{ needsConfirmation, total, request }`；
  - request 与 `openFindTool()` initial 契约一致；
  - find/replace mode、withReplace、query、files/matches、truncated；
  - caseSensitive、wholeWords、regex、fileMask；
  - regex=true 时 wholeWords 强制 false；
  - 复用现有 `searchEverywhereRequiresResultConfirmation()`。
- `openSearchResultsInFind(mode)` 只负责确认和 callback；
- Header Open Find 与文本菜单 Replace 共用该函数；
- Replace menu 仍只对 text result 渲染一次。

**验证**：

- RED：`tests/round500.test.mjs` 初始 **0 pass / 4 fail**；
- GREEN：round500/499/498/483/482/469 定向 **25 pass / 0 fail**；
- 全量：`npm test` = **1644 pass / 0 fail**；
- `node --check lib/client.js`、`lib/index.js`、`lib/terminal.js` 与
  `git diff --check` 通过；
- 隔离 DSH Web：
  - Whole Words + `*.md` 经 Replace 交接后 Find 仍为
    wholeWords=true、regex=false、mask=`*.md`、replace mode；
  - 再开启 Regex 后交接为 regex=true、wholeWords=false、
    Whole Words 按钮 disabled、mask 保留、replace mode 保留。
- CUA `getState()` 仍返回 Mac 锁屏；IDEA 对照使用 2026.2.3 安装包契约。

**下一轮计划**：

1. 交接时保留 Search Everywhere 当前活动结果；
2. `openFindTool` initial 支持 active row/index，Find 打开后定位同一命中；
3. Replace 入口使用被点击的文本结果，Header 使用当前 active result；
4. 补 round501、全量回归和隔离 DSH Web 运行态门禁。

## 2026-11-16 — 文本结果 Replace 入口与 mode 聚焦

**作用域**：Search Everywhere/Find 文本结果 `Replace…`、Find handoff、
替换 mode 切换、替换输入焦点和大结果确认。

**问题证据**：

- 结果菜单只有导航/复制，没有 IDEA 的文本替换入口；
- Search Everywhere Header 的 Open Find 逻辑已包含大结果确认和选项移交，
  结果菜单若复制一份会产生两套规则；
- Find 从 find mode 切 replace mode 时，替换输入尚未挂载，
  直接 focus 会落空；
- 切换 mode 若重建 Find state 会丢结果和 active descendant。

**实现**：

- `searchResultContextItems()` 增加可选 `onReplace`，
  仅 text 结果渲染 `Replace…`；
- Search Everywhere 抽取 `openSearchResultsInFind(mode)`，
  Header 与结果菜单共用大结果确认、结果集和搜索选项移交；
- 菜单 Replace 传 `mode: 'replace'`，确认取消时搜索弹框保持打开；
- Find 增加 `onReplaceMode`、`replaceInputRef`、
  `replaceFocusPendingRef` 和 `focusReplaceInput()`；
- find mode 下先置 pending 再切 mode，replace 输入挂载后 focus；
- 已处于 replace mode 时直接聚焦，不重建结果。

**验证**：

- RED：`tests/round499.test.mjs` 初始 **0 pass / 4 fail**；
- GREEN：round499/498/497/496/480 定向 **22 pass / 0 fail**；
- 全量：`npm test` = **1640 pass / 0 fail**；
- `node --check lib/client.js`、`lib/index.js`、`lib/terminal.js` 与
  `git diff --check` 通过；
- 隔离 DSH Web：
  - 文本结果菜单为 6 项，包含 `Replace…`；
  - Search Everywhere `needle` 选择 Replace 后 Find 打开，
    query 保留 `needle`、6 条结果和 descendant 保留；
  - Find find-mode 文本结果选择 Replace 后出现替换输入，
    焦点落在替换输入，6 条结果与 descendant 不变。
- CUA `getState()` 仍返回 Mac 锁屏；IDEA 对照使用 2026.2.3 安装包契约。

**下一轮计划**：

1. 检查 Replace 交接在 Whole Words/Regex/File Mask 组合下的一致性；
2. 为大结果确认取消补显式运行态/契约验证；
3. 审计 Replace 入口在文件结果中隐藏、文本结果中仅出现一次；
4. 补 round500、全量回归和隔离 DSH Web 运行态门禁。

## 2026-11-16 — 文本结果右侧拆分定位与右键激活修复

**作用域**：Search Everywhere/Find 文本结果 Open in Right Split、
拆分模型绑定后的行列定位、结果行右键主键判断。

**问题证据**：

- Open in Right Split 只传 path，文本结果进入右侧后停在 1:1；
- 拆分编辑器创建/换 model 是异步的，过早 setSelection 会被后续绑定覆盖；
- 运行态还发现 Search Everywhere 行的 `onMouseDown` 不区分鼠标键，
  右键会先执行 `activateResult` 并关闭弹框，结果菜单来不及出现。

**实现**：

- `openInRightSplit(target, location = null)` 增加可选位置对象；
- 文本菜单传 `{ path, line, column }`，文件结果传 `null`；
- 新增 `revealSplitLocation()`：
  - 等待 split editor 与 `modelsRef` 中同一 model；
  - 行列按 model 边界收敛；
  - 连续 3 帧应用 selection/reveal，避免异步换 model 覆盖；
  - 最后聚焦 split editor；
- Search Everywhere 结果 `onMouseDown` 只在 `event.button === 0`
  时激活，右键保留给 `contextmenu`；
- Editor 的 Search/Find callback 同时转发 path 和 location。

**验证**：

- RED：`tests/round498.test.mjs` 初始终止于未实现定位与右键守卫；
- GREEN：round498/497/496/477 定向 **18 pass / 0 fail**；
- 全量：`npm test` = **1636 pass / 0 fail**；
- `node --check lib/client.js`、`lib/index.js`、`lib/terminal.js` 与
  `git diff --check` 通过；
- 隔离 DSH Web：
  - Search Everywhere `needle` 的 `docs/notes.md:2:1` 右键菜单可打开；
  - Open in Right Split 后右编辑器选中 `2:1` 并获得焦点；
  - 左编辑器位置仍为 `1:1`，弹框关闭但 split 正常；
  - Find 同文本结果 Open in Right Split 仍选中 `2:1`，
    Find 保持打开，descendant 仍为 `docs/notes.md:2:1`。
- CUA `getState()` 仍返回 Mac 锁屏；IDEA 对照使用 2026.2.3 安装包契约。

**下一轮计划**：

1. 为文本结果上下文菜单增加 `Replace…` 入口；
2. 从 Search Everywhere 打开时进入 Replace in Files，
   保留当前 query 与搜索选项；
3. Find 内只聚焦替换输入，不丢失当前结果和 active descendant；
4. 补 round499、全量回归和隔离 DSH Web 运行态门禁。

## 2026-11-16 — 搜索复制失败边界与结果菜单焦点

**作用域**：Search Everywhere/Find 共享复制 helper、query/结果菜单
`Shift+F10`、Esc 焦点恢复和视口定位。

**问题证据**：

- `navigator.clipboard.writeText()` 在部分权限/策略环境会同步抛错；
  旧 helper 只处理 `undefined` 和 rejected Promise，会把异常抛给 React；
- query 与结果行都能打开菜单，但需要确认 Esc 分别回到 query/当前行；
- 结果菜单只有复用 `ContextMenu` 才能继承 viewport clamp。

**实现**：

- `copySearchResultText()` 用 try/catch 包住 `writeText()` 调用；
- 无 API、同步 throw、Promise reject 统一通知
  `clipboardWriteFailed`，resolve 通知 `copiedToClipboard`；
- Find query `Shift+F10` 使用 active option 的稳定 row rect 打开菜单；
- 结果行菜单保存行 opener，Esc 由 `ContextMenu` 恢复该行；
- Find result menu 继续走现有 `ContextMenu` layout clamp：
  `innerWidth/innerHeight - rect - 8`，不新增第二套定位代码。

**验证**：

- RED：`tests/round497.test.mjs` 初始 **3 pass / 2 fail**；
- GREEN：round497/496/478/477 定向 **16 pass / 0 fail**；
- 全量：`npm test` = **1631 pass / 0 fail**；
- `node --check lib/client.js`、`lib/index.js`、`lib/terminal.js` 与
  `git diff --check` 通过；
- 隔离 DSH Web：
  - Search Everywhere query `Shift+F10` 打开 5 项菜单，Esc 后焦点回
    combobox；
  - Find 结果行 `Shift+F10` 菜单 Esc 后焦点回同一 option；
  - stub Clipboard resolve 时 Copy relative path 捕获 `README.md`，
    Path with Line Number 捕获 `README.md:3:1`；
  - stub Clipboard reject 时状态栏出现
    `The browser refused the clipboard write`；
  - 最后一个结果行菜单矩形完全位于 viewport 内；
  - Find 始终保持打开，active descendant 不丢失。
- CUA `getState()` 仍返回 Mac 锁屏；IDEA 对照使用 2026.2.3 安装包契约。

**下一轮计划**：

1. 修正文本结果 Open in Right Split 的定位：
   当前只传 path，未把 `line/column` 带到拆分编辑器；
2. 复用现有查找到达位置逻辑，让右侧 pane 打开后居中并聚焦命中；
3. 保持 Search Everywhere/Find 菜单、焦点和右侧拆分生命周期；
4. 补 round498、全量回归和隔离 DSH Web 运行态门禁。

## 2026-11-16 — Find 结果上下文菜单复用 Search Everywhere

**作用域**：Find 文件/文本结果右键、`Shift+F10/ContextMenu`、
结果复制、右侧拆分、Project reveal 和状态通知。

**问题证据**：

- Find 行只能双击/Eenter 打开，没有 IDEA 的结果上下文菜单；
- Search Everywhere 已有一套 5 项结果菜单，若复制一份会形成两套行为；
- Find 是持久工具窗口，导航后不能像模态 Search Everywhere 一样关闭；
- 复制失败/成功需要沿用现有状态栏通知，而不是静默失败。

**实现**：

- 抽取 `copySearchResultText()` 与 `searchResultContextItems()`，
  Search Everywhere 和 Find 共用同一菜单模型；
- 菜单项固定为 Open in Right Split、Open in editor、
  Copy relative path、Path with Line Number、Select in Project View；
- 文本复制使用真实 `path:line:column`，文件使用纯路径；
- Find 增加 `resultMenu` 和 `openFindResultMenuAt()`；
- 行 `onContextMenu`、行 `Shift+F10/ContextMenu` 与 query 输入快捷键
  都打开同一菜单；
- Find 导航不调用 `onClose`，工具窗口、当前行和 descendant 保持不变；
- Editor 传入现有右侧拆分、Project reveal 和状态栏通知回调。

**验证**：

- RED：`tests/round496.test.mjs` 初始 **0 pass / 4 fail**；
- GREEN：round496/495/494/477/478 定向 **19 pass / 0 fail**；
- 全量：`npm test` = **1626 pass / 0 fail**；
- `node --check lib/client.js`、`lib/index.js`、`lib/terminal.js` 与
  `git diff --check` 通过；
- 隔离 DSH Web：
  - Find 文件结果右键菜单显示 5 项；
  - 菜单 Esc 后 Find 保持打开，active descendant 不变；
  - 聚焦结果行 `Shift+F10` 打开同一菜单；
  - 选择 Open in Right Split 后 split 出现，Find 与 descendant 保持；
  - Search Everywhere 原结果菜单静态契约继续通过。
- CUA `getState()` 仍返回 Mac 锁屏；IDEA 对照使用 2026.2.3 安装包契约。

**下一轮计划**：

1. 实测 Find/Search Everywhere 的 Copy relative path 与
   Path with Line Number 通知，覆盖剪贴板权限拒绝；
2. 复核 query 输入 `Shift+F10` 与焦点行 Esc/Enter 的焦点归属；
3. 审计 ContextMenu 在窄 Find 窗口中的视口翻转；
4. 补 round497、全量回归和隔离 DSH Web 运行态门禁。

## 2026-11-16 — Find 完整结果边界与文件组交接

**作用域**：Find 命中 `Home/End`、文件结果到文本组头边界、活动索引同步。

**问题证据**：

- 命中行没有 `Home/End`，离开 query 后不能快速跳首尾；
- 文件结果行 `↓` 直接跳到下一条 occurrence，会跳过中间的文本文件组头；
- 文件结果和文本命中虽然共享活动索引，但上下边界没有统一语义。

**实现**：

- 新增 `findToolNextTextGroupPath()`：
  仅当文件结果下一行是文本命中时返回其 path；
- 命中行 `Home/End` 调用 `focusOccurrenceByIndex(0|length-1)`；
- 文件结果 `↓` 优先用该 helper 聚焦首个文本组头；
- 文本组仍由 `findToolGroupBoundaryTarget()` 处理组首/组末；
- 文件结果与文本命中都保持 roving `tabIndex`、onFocus 活动索引同步、
  Enter 打开和 Esc 关闭。

**验证**：

- RED：`tests/round495.test.mjs` 初始 **1 pass / 3 fail**；
- GREEN：round495/494/493/491 定向 **17 pass / 0 fail**；
- 全量：`npm test` = **1622 pass / 0 fail**；
- `node --check lib/client.js`、`lib/index.js`、`lib/terminal.js` 与
  `git diff --check` 通过；
- 隔离 DSH Web：
  - Search Everywhere 查询 `app` 后移交 Find，结果为
    `src/app.js` 文件行与 README 文本组；
  - 文件行 `↓` 进入 README 组头；
  - 文件行 `End` 聚焦末条可见命中并同步 descendant；
  - 末条命中 `Home` 回到 `src/app.js` 文件行并同步 descendant。
- CUA `getState()` 仍返回 Mac 锁屏；IDEA 对照使用 2026.2.3 安装包契约。

**下一轮计划**：

1. 为 Find 文件/文本结果补与 Search Everywhere 一致的右键和
   `Shift+F10/ContextMenu` 菜单；
2. 复用 Open in Right Split、Copy relative path、Path with Line Number、
   Select in Project View 与现有通知；
3. 菜单关闭后保持当前 Find 行和查询上下文；
4. 补 round496、全量回归和隔离 DSH Web 运行态门禁。

## 2026-11-16 — Find 组与命中统一键盘路径

**作用域**：Find 文件组头、文本命中行、文件结果行、listbox 活动项和
替换/打开键盘入口。

**问题证据**：

- 组头虽有 roving 焦点，但 `↓` 只在组之间移动，不能进入本组命中；
- 命中行不是焦点停点，用户离开 query 后无法继续用方向键浏览结果；
- 组首/组末缺少回到组头、进入下一组的树状边界语义；
- 文件结果和文本命中共用一个 listbox 活动索引，但只有 query 路径同步它。

**实现**：

- 新增 `findToolGroupBoundaryTarget()`，把组首 `↑` 路由到组头、
  组末 `↓` 路由到下一组头；
- 新增 `occurrenceRefs`、`focusOccurrenceByIndex()` 和
  `focusAdjacentOccurrence()`；
- 文件结果与文本命中行都使用
  `tabIndex: position === activeIndex ? 0 : -1`；
- 行获得焦点时调用 `onMove(0, occurrences.length, position)`，
  同步 listbox 活动项与 combobox descendant；
- 组头 `↓` 优先进入本组首条可见命中，折叠/空组继续走组间移动；
- 命中 `↑/↓` 使用组边界 helper，Enter 打开当前行，Esc 关闭 Find；
- query 输入原有 `↑/↓`、单处 Replace、Replace All、Preview 和 History
  保持不变。

**验证**：

- RED：`tests/round494.test.mjs` 初始 **0 pass / 4 fail**；
- GREEN：round494/493/491/480 定向 **17 pass / 0 fail**；
- 全量：`npm test` = **1618 pass / 0 fail**；
- `node --check lib/client.js`、`lib/index.js`、`lib/terminal.js` 与
  `git diff --check` 通过；
- 隔离 DSH Web：
  - README 组头 `↓` 聚焦 `README.md:3:1`，descendant 同步；
  - 命中 `↓` 到 `README.md:4:8`，`↑` 回 `README.md:3:1`；
  - 组首 `↑` 回到 README 组头；
  - README 组末 `↓` 进入 `docs/notes.md` 组头；
  - 收起 docs 后从组头 `↓` 跳过隐藏命中，落到 `src/app.js` 组头。
- IDEA 对照仍受 Mac 锁屏限制；CUA `getState()` 返回 native apps 不可用，
  本轮使用 IDEA 2026.2.3 安装包既有树/折叠契约与 DSH 运行态证据。

**下一轮计划**：

1. 把 Find 的 `Home/End` 扩展到完整可见结果序列，
   同时覆盖文件结果与文本命中；
2. 复核文件结果行与文本组头之间的上下边界；
3. 保持 `aria-activedescendant`、Enter、Replace、Preview 和 History；
4. 补 round495、全量回归和隔离 DSH Web 运行态门禁。

## 2026-11-16 — Find 文件组 roving 焦点与折叠收敛

**作用域**：持久 Find 的文件分组头、组内命中折叠展开、活动结果索引
和组合框 descendant。

**问题证据**：

- 文件组只有鼠标可点的折叠按钮，没有组间键盘移动或边界语义；
- 折叠当前活动命中所在文件后，`state.index` 仍可能指向旧位置，
  查询 combobox 与 listbox 只能靠 clamped 索引暂时掩盖；
- 每个组按钮都是独立 Tab 停点，缺少 roving `tabIndex`；
- 另造树组件会重复现有 listbox/option、结果排序和折叠投影。

**实现**：

- 新增 `findToolGroupId()` 与 `findToolGroupTarget()`；
- 每组渲染为 listbox 内 `role="group"` 容器，组头按钮作为唯一组停点；
- 组按钮使用 `tabIndex` roving、`aria-expanded`、`aria-controls`
  和 `data-dsh-find-group-path`；
- `↑/↓` 在组间夹取移动，`Home/End` 跳首尾；
- `←` 收起、`→` 展开、`Enter/Space` 切换，操作后焦点保持在组头；
- 新增 `state.index !== activeIndex` effect，复用现有 `onMove`
  绝对索引接口同步到可见行；
- 不修改 `findToolVisibleRows()` 的分组与隐藏模型。

**验证**：

- RED：`tests/round493.test.mjs` 初始 **0 pass / 5 fail**；
- GREEN：round493/492/491/468/480 定向 **18 pass / 0 fail**；
- 全量：`npm test` = **1614 pass / 0 fail**；
- `node --check lib/client.js`、`lib/index.js`、`lib/terminal.js` 与
  `git diff --check` 通过；
- 隔离 DSH Web：
  - `needle` 结果 6 处/3 文件，组为
    `README.md / docs/notes.md / src/app.js`；
  - 3 个组按钮 roving 状态为 `[0, -1, -1]`；
  - `↓` 到 `docs/notes.md`，End 到 `src/app.js`，Home 回
    `README.md`；
  - `←` 收起 README 后 `aria-expanded=false`、README option 为 0；
    活动 descendant 自动变为仍可见的 `docs/notes.md:2:1`；
  - `→` 重新展开后 README option 恢复为 2，组头焦点仍在 README；
  - Enter 连续收起/展开成功，焦点不转移。
- IDEA 对照：本机 IntelliJ IDEA `2026.2.3 / IU-262.10968.63` 安装包提供
  Find 结果树/折叠 action 契约；CUA `getState()` 仍返回 Mac 锁屏，
  原生点击对照无法执行，本轮以 DSH Web 运行态与安装包契约完成验证。

**下一轮计划**：

1. 把组头与组内命中纳入同一键盘路径：
   组头 `↓` 进入首条命中，首条命中 `↑` 返回组头；
2. 为可见命中行补 roving `tabIndex`，避免方向键只在 query 输入时有效；
3. 保持现有 query `↑/↓`、单处 Replace、Preview 和折叠索引收敛；
4. 补 round494、全量回归和隔离 DSH Web 运行态门禁。

## 2026-11-16 — Search Everywhere 查询历史入口

**作用域**：Search Everywhere 查询字段、workspace recent searches、
History 菜单与焦点恢复。

**问题证据**：

- Search Everywhere 空查询虽显示 recent searches，但查询字段本身没有
  Find 已有的 History 按钮和 `⌥↓`；
- 已输入查询时没有快捷入口恢复最近搜索；
- 若另建存储，会与当前 workspace search history 分叉。

**实现**：

- 新增 `queryHistoryMenu` 与 `openQueryHistoryMenu()`；
- 查询字段 `⌥↓` 与 History 按钮共用同一菜单；
- 直接复用 `recentSearches`，不新增存储键；
- 空历史显示 disabled `No history yet`；
- 选择菜单项调用 `onQuery(value)`，查询回到第 0 条活动结果；
- Esc 不改 draft，`ContextMenu` 关闭后回焦查询框；
- 查询历史与 replacement history 仍是两个独立菜单。

**验证**：

- RED：`tests/round492.test.mjs` 初始 **0 pass / 3 fail**；
- GREEN：round492/491/490/489 定向 **16 pass / 0 fail**；
- 全量：`npm test` = **1609 pass / 0 fail**；
- `node --check lib/client.js`、`lib/index.js`、`lib/terminal.js` 与
  `git diff --check` 通过；
- 隔离 DSH Web：
  - 双击 Shift 打开空 Search Everywhere；
  - `⌥↓` 菜单按 newest-first 显示
    `zzzzzzzz-no-find-result / needle / alpha / app`；
  - Esc 后查询值仍为空、Search Everywhere 保持打开、焦点回 combobox；
  - 再次打开菜单并键盘选择首项后查询更新为
    `zzzzzzzz-no-find-result`，焦点仍回 combobox；
  - 现有 query combobox/listbox 与页签 roving 语义未回归。

**下一轮计划**：

1. 审计 Find 文件分组头的键盘展开/收起，补 tree/treeitem 语义；
2. 折叠文件组后把活动命中收敛到仍可见结果，展开时保持文件上下文；
3. 复核分组按钮、listbox 方向键和单处 Replace 的焦点交接；
4. 补 round493、全量回归和隔离 DSH Web 运行态门禁。

## 2026-11-16 — Find 工具窗口 combobox/listbox 与 live status

**作用域**：持久 Find/Replace in Files 的查询框、文件结果、文本命中、
活动结果和结果状态。

**问题证据**：

- Find 查询框只有普通 input，结果 listbox 与活动 option 没有
  `aria-activedescendant` 关联；
- 文件行和文本行没有稳定 DOM id，辅助技术只能看到视觉高亮；
- 加载、短查询、空结果和命中计数没有 live region；
- Search Everywhere 已具备该语义，但持久 Find 未对称。

**实现**：

- Find 查询输入增加 `role=combobox`、`aria-autocomplete=list`、
  `aria-controls` 与活动 option 的 `aria-activedescendant`；
- listbox 使用固定 id `dsh-editor-find-tool-listbox`；
- 新增 `findToolOptionId(rowKey)`，文件行和文本命中行都使用
  `encodeURIComponent(rowKey)` 生成 collision-safe id；
- listbox 同步 `aria-activedescendant`，查询框与 listbox 在
  `↑/↓` 后指向同一活动 option；
- 隐藏 live region 使用 `role=status`、`aria-live=polite`、
  `aria-atomic=true`，覆盖 loading、短查询、无匹配与命中/文件计数；
- 可见 loading/empty 文本保持原样，避免重复播报。

**验证**：

- RED：`tests/round491.test.mjs` 初始 **0 pass / 4 fail**；
- GREEN：round491/490/489/486 定向 **17 pass / 0 fail**；
- 全量：`npm test` = **1606 pass / 0 fail**；
- `node --check lib/client.js`、`lib/index.js`、`lib/terminal.js` 与
  `git diff --check` 通过；
- 隔离 DSH Web：
  - Shift+⌘R 打开 Replace in Files，查询 `needle` 命中 6 处/3 文件；
  - 查询 combobox 的 `aria-controls` 指向 Find listbox；
  - input/listbox 的 `aria-activedescendant` 都指向当前
    `aria-selected=true` option；
  - 6 个 option id 全唯一；
  - 查询框 `ArrowDown` 和 listbox `ArrowUp` 都移动同一活动项；
  - live status 为 `6 matches in 3 files`；
  - 无匹配查询后 descendant 清空、`aria-expanded=false`，
    live status 为 `No matches`。

**下一轮计划**：

1. 为 Search Everywhere 查询字段补与 Find 一致的 History 按钮和
   `⌥↓` 最近搜索入口；
2. 审计 Find 文件分组头的键盘展开/收起和活动命中保留；
3. 复核历史菜单、查询 combobox 与结果 listbox 的焦点交接；
4. 补 round492 契约、全量回归和隔离 DSH Web 运行态门禁。

## 2026-11-16 — Search Everywhere 替换历史与结果 live status

**作用域**：Search Everywhere Replace 输入、workspace replacement history、
搜索结果 live region 与截断提示。

**问题证据**：

- Search Everywhere 的 Replace 行只有输入和 Replace All，没有 Find/编辑器
  已有的 replacement history 入口；
- 结果加载、空结果与计数只靠视觉文本，辅助技术无法稳定获知更新；
- 同一 branch 若给可见 loading/empty 节点再加 live，会和隐藏状态重复播报。

**实现**：

- `SearchEverywhere` 接收 Editor 的 `recentReplacements` 作为
  `replaceHistory`；
- Replace 输入 `⌥↓` 与 History 按钮共用 `openReplaceHistoryMenu()`；
- 空历史显示 disabled `No history yet`，选择项才调用 `onReplaceChange()`；
- Esc 关闭历史不修改 draft，并由 `ContextMenu` 恢复 opener 焦点；
- 增加 `screenReaderOnly` 结果状态：
  `role=status`、`aria-live=polite`、`aria-atomic=true`，
  播报 loading、无结果或 `searchResultCount`；
- 可见 loading/empty 文本不重复加 live，截断提示单独使用 `role=status`；
- Replace 历史菜单复用同一个 `ContextMenu`，不新增第二套菜单系统。

**验证**：

- RED：`tests/round490.test.mjs` 初始 **0 pass / 4 fail**；
- GREEN：round490/489/486/474 定向 **16 pass / 0 fail**；
- 全量：`npm test` = **1602 pass / 0 fail**；
- `node --check lib/client.js`、`lib/index.js`、`lib/terminal.js` 与
  `git diff --check` 通过；
- 隔离 DSH Web：
  - Search Everywhere 查询 `needle` 时 live region 文本为 `6 results`，
    `aria-atomic=true` 且视觉宽度为 1px；
  - Actions 页输入无匹配命令时 live region 为 `No matches`；
  - Find 工具窗口的 replacement history 为 `omega`，`⌥↓` 打开菜单后
    Esc 保持空 draft 并回焦替换输入，选择历史项后值为 `omega`；
- 当前 Search Everywhere 的 `withReplace` 分支没有直接 UI 入口，
  本轮运行态通过共享 replacement history 的 Find 工具窗口验证，
  静态契约覆盖 Search Everywhere 同分支，避免冒充已点击验证。

**下一轮计划**：

1. 把 Search Everywhere 已完成的 combobox/listbox、
   `aria-activedescendant` 和 live status 语义对称落到持久 Find 工具窗口；
2. 为 Find 结果文件行与文本命中行生成稳定 option id；
3. 查询框 `aria-controls/aria-activedescendant` 与 listbox 同步；
4. 保持现有 Find 单处替换、Replace All、History 与焦点返回行为；
5. 补 round491 契约、全量回归和隔离 DSH Web 运行态门禁。

## 2026-11-16 — Search Everywhere 键盘与辅助技术语义

**作用域**：Search Everywhere 页签、查询 combobox、结果 listbox/option 和
结果上下文菜单的键盘与 ARIA 语义。

**问题证据**：

- 页签只有 `role=tab` / `aria-selected`，没有 roving `tabIndex`，
  也不能在页签获得焦点后用方向键导航；
- 查询输入没有 combobox/listbox 关联，活动结果只靠视觉高亮，
  辅助技术无法从输入框获知当前 option；
- 结果 listbox 自身不可聚焦，`aria-activedescendant` 缺失；
- 用位置生成 id 会在结果重排时漂移，用路径原文又可能含特殊字符。

**实现**：

- 页签增加 `data-dsh-search-tab-id`，活动项 `tabIndex=0`、其余 `-1`；
- `searchEverywhereTabTarget()` 统一计算 `←/→` 循环和 `Home/End`；
- 页签 `Enter/Space` 激活当前项，切换后用局部 tablist ref 恢复焦点；
- 查询输入使用 `role=combobox`、`aria-autocomplete=list`、
  `aria-controls` 和活动 option 的 `aria-activedescendant`；
- 结果 listbox 使用固定 id、`tabIndex=0` 和同一活动 option id；
- option id 用 `searchEverywhereOptionId(rowKey)` 编码，路径标点不会撞 id；
- 查询框和结果列表复用 `handleSearchResultKeyDown`：`↑/↓`、Enter、
  Escape、`Shift+F10/ContextMenu` 行为一致；
- Filter 关闭继续回焦查询框；overflow/结果菜单继续由 `ContextMenu`
  恢复 opener 焦点。

**验证**：

- RED：`tests/round489.test.mjs` 初始 **0 pass / 5 fail**；
- GREEN：round489/488/487/474/472 定向 **19 pass / 0 fail**；
- 全量：`npm test` = **1598 pass / 0 fail**；
- `node --check lib/client.js`、`lib/index.js`、`lib/terminal.js` 与
  `git diff --check` 通过；
- 隔离 DSH Web（`127.0.0.1:63097`）：
  - 4 个页签中只有活动项 `tabIndex=0`；
  - `→` 到 Files、End 到 Actions、Home 回 All、All 上 `←` 循环到 Actions，
    焦点和 `aria-selected` 同步；
  - 查询 `needle` 后 combobox/listbox 的活动 id 都指向当前 option；
  - input 上 `ArrowDown` 与 listbox 上 `ArrowUp` 都移动同一活动项；
  - 结果 listbox 上 `Shift+F10` 打开 5 项结果菜单，Esc 关闭菜单后
    焦点仍回到 listbox。
- IDEA 证据：本机 `/Applications/Intellij.app` 为 IntelliJ IDEA
  `2026.2.3 / IU-262.10968.63`，对应
  `intellij.platform.searchEverywhere*.jar` 仍采用 tab/popup/list 交互模型；
  Mac 当前锁屏，CUA `getState()` 明确返回无法自动解锁，运行态对照改用
  DSH Web 与安装包资源，不把锁屏视为整体目标 blocked。

**下一轮计划**：

1. 审计 Search Everywhere 的 Tab 顺序，避免 roving 页签、查询/替换字段
   与工具栏动作之间出现不可达或重复停点；
2. 为加载中、空结果、截断、结果计数补充可读的 live/status 语义；
3. 对齐替换字段的键盘行为与 Search Everywhere/Find 的状态反馈；
4. 补静态契约、全量回归和隔离 DSH Web 键盘验证。

## 2026-11-15 — Search Everywhere Header 响应式收敛

**作用域**：Search Everywhere 顶部搜索/预览/筛选动作、窄视口与
`CompactActionBar` overflow。

**问题证据**：

- 7 个动作手写在页签行内，760px 以下会挤压页签和查询入口；
- Filter 只能从直接按钮打开，进入 overflow 后没有统一入口；
- 直接与 overflow 若各自保存快照，响应式重排后菜单会过期。

**实现**：

- Header 改用 `CompactActionBar`，动作顺序为
  `Include non-project / Match Case / Whole Words / Regex / Preview /
   Filter / Open Find`；
- Filter、Open Find pinned；窄宽度下其余动作进入 `»`；
- 页签行保持完整，动作条独占下一行；
- Filter 直接点击与 overflow 共用 `openFilterAt()`，无 event 时回退到
  查询输入 rect；
- overflow 菜单只保存坐标，按当前 hidden 集合实时生成菜单项。

**验证**：

- RED：`tests/round488.test.mjs` 初始 **0 pass / 4 fail**；
- GREEN：round488/487/467 定向 **24 pass / 0 fail**；
- 全量：`npm test` = **1593 pass / 0 fail**；
- 隔离 DSH Web：
  - 760px 时 7 个动作全部直接可见；
  - 140px 时 Include/Match/Filter/Open Find + `»`；
  - 24px 时仅 `»`，菜单仍含全部 7 个动作；
  - 从 overflow 打开 Filter 后 Files/Text/Actions 可用，
    Esc 关闭并回焦查询框；
  - 恢复宽度后全部动作重新直接显示。

## 2026-11-15 — Persistent Find 工具栏响应式收敛

**作用域**：Find/Replace in Files 工具栏、搜索选项、结果动作、
History/Replace 输入行和 `CompactActionBar` overflow。

**问题证据**：

- 新增 Match Case / Whole Words / Regex / History 后，Find 工具栏仍手写固定按钮；
- 实际 255px 工具栏中新增按钮可能被裁出父边界；
- 把动作条塞进 title row 后仅分到 45px，只能显示 `»`；
- 旧 overflow 菜单在点击时保存 hidden 快照，响应式重排后菜单可能过期；
- 本轮中途还发现一个 JSX 等价属性对象缺少 `}`，导致整个 client bundle
  `Unexpected token ')'`，Editor 注入消失。

**实现**：

- `CompactActionBar` 支持可选 style override；
- Persistent Find 将动作条放在独立满宽行，不复用 title row 的争抢空间；
- Find actions 顺序：
  - Previous / Next / Expand / Collapse / Preview；
  - Match Case / Whole Words / Regex；
  - Hide；
- Previous/Next/Hide pinned，窄宽度其余进入 `»`；
- overflow 状态只保存菜单坐标，渲染时按当前 hidden 集合生成 items；
- search/replace rows 增加 `flexWrap`，History 与 Replace 控件可换行；
- 修复 CompactActionBar createElement 属性对象缺 `}` 的语法错误。

**验证**：

- RED：`tests/round487.test.mjs` 初始 **0 pass / 4 fail**；
- GREEN：round387/393/418/447/455/486/487 定向 **16 pass / 0 fail**；
- 全量：`npm test` = **1589 pass / 0 fail**；
- `node --check lib/client.js`、`lib/index.js`、`lib/terminal.js` 通过；
- `git diff --check` 通过；
- DSH Web：
  - 均分宽度 255px 时 9 个动作全部直接可见；
  - 强制 140px 时直接保留 Previous/Next/Expand/Hide + `»`；
  - overflow 菜单显示 Collapse/Preview/Match Case/Whole Words/Regex；
  - ArrowDown 移动到 Preview Source，Esc 回到 `»` 按钮；
  - 恢复宽度后 9 个动作全部重新出现。

**下一轮计划**：

1. 审计 Search Everywhere 顶部动作在窄视口下的可见性；
2. 让 Include non-project / Match Case / Whole Words / Regex / Preview /
   Filter / Open Find 按 IDEA 优先级收敛到 overflow；
3. 保持页签、查询输入和结果键盘导航不受影响；
4. 补窄视口、overflow、焦点和全量回归门禁。

## 2026-11-15 — Find/Replace 历史下拉

**作用域**：持久 Find 与编辑器 Find 的查询/替换历史、workspace 隔离、
`⌥↓` 菜单、draft 保持和跨刷新恢复。

**问题证据**：

- IDEA `FindBundle` 提供 `find.search.history` / `find.replace.history`；
- 现有搜索历史只存在 Search Everywhere 空结果页，Find 字段没有历史入口；
- 输入框直接占用 ↑/↓ 导航结果，不能再用同一按键做历史；
- 替换字符串可能包含有意义的首尾空白，不能像 query 一样 trim 后保存。

**实现**：

- 查询继续使用 `dsh-editor.search.history:<root>`；
- 新增 `dsh-editor.replace.history:<root>`；
- `rememberReplacementHistory()`：
  - 非空字符串；
  - 保留原始内容，只把纯空白视为不记录；
  - 去重、newest-first、最多 20 条。
- `rememberWorkspaceSearchQuery()` / `rememberWorkspaceReplacement()` 写入并更新 UI；
- Find 搜索成功时记录 query，实际 Replace/Replace All 成功时记录 replacement；
- 编辑器 Find 的 Enter、Replace、Replace All 同步记录；
- Persistent Find 与编辑器 Find 查询/替换字段都增加 History 按钮；
- 输入框 `⌥↓` 打开历史菜单；
- ContextMenu 提供方向键、Enter、Esc 和 opener focus 恢复；
- 空历史显示 disabled `No history yet`；
- menu 打开/关闭本身不修改输入 draft。

**验证**：

- RED：`tests/round486.test.mjs` 初始 **0 pass / 4 fail**；
- GREEN：round467/484/485/486 定向 **15 pass / 0 fail**；
- 全量：`npm test` = **1585 pass / 0 fail**；
- `node --check lib/client.js`、`lib/index.js`、`lib/terminal.js` 通过；
- `git diff --check` 通过；
- 替换历史去重、限量、空白保留、workspace key 通过；
- 隔离 DSH Web：
  - Find 查询菜单 newest-first 为 `needle / alpha / app`；
  - replacement 菜单为 `omega`；
  - Esc 后 draft 仍为 `alpha`，焦点回到 Find 输入；
  - 键盘选择第二项后 query 恢复为 `needle`；
  - 页面刷新后 query/replacement 历史仍恢复；
  - 编辑器 Find 的 `⌥↓` 打开同一 workspace 查询历史。

**下一轮计划**：

1. 审计 Persistent Find toolbar 在窄窗口下的新搜索选项可见性；
2. 复用现有 toolbar overflow 能力，把 Whole Words/Regex/History 纳入响应式动作；
3. 保持 Search History/Replace History 与主要 Replace 动作可键盘到达；
4. 补窄宽度、overflow 菜单、焦点和全量回归门禁。

## 2026-11-15 — 编辑器 Find/Replace 搜索选项

**作用域**：当前 Monaco 文件查找、跳转、单处替换、Replace All、
Match Case、Whole Words、Regex 和窄面板布局。

**问题证据**：

- 当前文件 Find 仅支持大小写敏感的字面量，和 workspace Find 的能力分叉；
- IDEA `find.case.sensitive` / `find.whole.words` / `find.regex` 同时适用于
  当前文件查找；
- 直接把三个 24px 按钮加入现有横向 find bar 后，窄编辑区会把
  Regex、Replace All 和关闭按钮裁出可见区域；
- 单处替换所需 match 长度不能用 query.length 推导，Regex 命中长度可变化。

**实现**：

- 新增纯函数 `editorFindResult()`：
  - literal 转义；
  - smart case；
  - Unicode Whole Words lookaround；
  - Regex 256 字符限制与 nested-repeat 防护；
  - zero-length match 按 code point 推进；
  - 返回 offset/length/text 或可显示错误。
- 新增 `editorReplaceAll()` 和 `editorReplaceAt()`：
  - 复用同一 matcher；
  - 支持 `$1/$&`；
  - 单处替换用 sticky regex 绑定指定 offset。
- `replaceState` 增加 caseSensitive/wholeWords/regex/error；
- 打开编辑器 Find 时读取共享搜索选项；
- 切换 Match Case/Whole Words/Regex 后重算命中并写回共享 storage；
- Regex 开启时自动关闭并禁用 Whole Words；
- 非法 pattern 显示 `role="alert"`，Replace 和 Replace All 禁用；
- find bar 改为 `flexWrap:wrap`，窄面板中所有控件都可达。

**验证**：

- RED：`tests/round485.test.mjs` 初始 **0 pass / 3 fail**；
- GREEN：round464/484/485 定向 **11 pass / 0 fail**；
- 全量：`npm test` = **1581 pass / 0 fail**；
- `node --check lib/client.js`、`lib/index.js`、`lib/terminal.js` 通过；
- `git diff --check` 通过；
- 纯函数 smart case、Whole Words、Regex、`$1` Replace All/单处替换通过；
- 隔离 DSH Web：
  - 编辑器内 `needle(\w*)` Regex 为 3 条；
  - Whole Words 自动禁用；
  - 非法 `[` 显示 alert 且 Replace 禁用；
  - 单处 Replace 后继续保留命中，Replace All 后命中清空；
  - Monaco model 变为 `item-Value / item-` 后刷新回磁盘原内容；
  - 254px 宽 find bar 自动换行，所有 8 个按钮都在可见边界内。

**下一轮计划**：

1. 为 Find 查询和替换字段增加 IDEA 历史下拉；
2. 搜索历史与替换历史分开、按 workspace 隔离且有界；
3. 支持键盘选择历史项并恢复当前 draft；
4. 补持久化、键盘、边界和运行态门禁。

## 2026-11-15 — 搜索选项跨打开与刷新持久化

**作用域**：Search Everywhere 与 Find 的 Match Case、Whole Words、Regex、
File Mask 浏览器本地状态。

**问题证据**：

- 搜索选项此前只存在于单个弹框/工具窗口 state，关闭即丢失；
- 页面刷新后用户每次都要重新配置同一组开关与 mask；
- 直接信任 localStorage JSON 会让数组、字符串、超大 mask 或
  `regex+wholeWords` 冲突状态进入搜索请求。

**实现**：

- 新增 `dsh-editor.search.options.v1`；
- `normalizeSearchOptions()`：
  - 非对象/数组回退默认值；
  - 三个布尔项只接受 `true`；
  - Regex 为 true 时强制 Whole Words=false；
  - fileMask 只接受不超过 512 字符的 string；
- `readSearchOptions()` 对损坏 JSON 和 storage 异常安全回退；
- Search Everywhere 每次打开读取持久化选项；
- Find 无移交结果时读取持久化选项；有移交时使用移交值；
- 两个界面的四个选项变化通过 effect 写回同一 key；
- 只保存选项，不保存 query、replace text 或结果集。

**验证**：

- RED：`tests/round484.test.mjs` 初始 **0 pass / 3 fail**；
- GREEN：round467/479/481/482/483/484 定向 **25 pass / 0 fail**；
- 全量：`npm test` = **1577 pass / 0 fail**；
- `node --check lib/client.js`、`lib/index.js`、`lib/terminal.js` 通过；
- `git diff --check` 通过；
- 损坏值、错误类型、超大 mask 和 regex/wholeWords 冲突归一化通过；
- 隔离 DSH Web：
  - 设置 Match Case=true、Whole Words=true、mask=`*.md`；
  - 关闭并重开 Search Everywhere 后三项保持；
  - 页面 reload 后在 Find 中仍保持三项；
  - 写入损坏 JSON 后重开 Find，四项恢复默认并重写有效存储。

**下一轮计划**：

1. 把 Match Case / Whole Words / Regex 接入当前编辑器 Find/Replace；
2. 复用浏览器本地搜索选项，不建立第二套偏好；
3. 非法 regex 在编辑器 Find 内显示错误并禁止替换；
4. 补 replace current/all、选区与无匹配运行态门禁。

## 2026-11-15 — Search Everywhere / Find File Mask

**作用域**：Search Everywhere Text、Find/Replace in Files 的 File Mask、
glob 过滤、排除模式和替换目标防越界。

**问题证据**：

- IDEA `FindBundle` 提供 `find.popup.filemask` 和 `File mask` 输入；
- 文本搜索原本只能扫描 workspace 内全部候选文件；
- 如果搜索按 mask 过滤、替换却只依赖旧结果 target，mask 状态与写入边界可能分叉；
- 引入 glob 语法必须保持字符串匹配，不能把用户 mask 当作文件系统路径。

**实现**：

- 宿主新增 `compileWorkspaceFileMask()`：
  - 逗号分隔，最多 16 项、总长 512；
  - 支持 `* / ? / **`；
  - 无 `/` 的项匹配 basename，含 `/` 的项匹配完整 workspace 相对路径；
  - `!pattern` 排除；
  - 只有排除项时默认包含其余全部；
  - `[] / {}` 等尚未支持语法显式报 `unsupported file mask syntax`；
- `searchWorkspaceText()` 在读取文件前过滤 `listWorkspaceFiles()` 候选；
- `replaceWorkspaceText()` 对每个 target 再验证 mask，mask 外 target 拒绝写入；
- Search Everywhere 与 Find 增加 File Mask 输入；
- 搜索、Replace All、单处 Replace 和 Open in Find Tool Window 都透传 mask；
- mask 编辑后清空旧结果并重跑搜索。

**验证**：

- RED：`tests/round483.test.mjs` 初始 **0 pass / 4 fail**；
- GREEN：round467/481/482/483 定向 **17 pass / 0 fail**；
- 全量：`npm test` = **1574 pass / 0 fail**；
- `node --check lib/client.js`、`lib/index.js`、`lib/terminal.js` 通过；
- `git diff --check` 通过；
- `*.ts` 只返回 TS 文件；
- `src/**` 返回 src 下所有文件；
- `*.ts,!src/nested/**` 排除嵌套目录；
- mask 外 Replace target 被拒绝；
- 隔离 DSH Web：
  - `needle` 无 mask 为 6 条；
  - `*.md` 为 3 条 / 2 文件；
  - 移交 Find 后 mask 保持 `*.md`；
  - 改为 `*.js` 后为 3 条 / 1 文件；
  - 非法 `[*` 显示 mask 语法错误并清空结果。

**下一轮计划**：

1. 持久化 Match Case / Whole Words / Regex / File Mask；
2. Search Everywhere 与 Find 打开时恢复最近搜索选项；
3. 损坏或旧版本存储值安全回退默认值；
4. 补持久化、工作区隔离/共享策略和运行态门禁。

## 2026-11-15 — Search Everywhere / Find Regex

**作用域**：Search Everywhere、Find/Replace in Files 的 Regex 选项、
pattern 校验、捕获组替换与 ReDoS 防护。

**问题证据**：

- IDEA `FindBundle` 提供 `find.regex` / `find.regex.label`；
- 现有搜索只支持字面量与 Whole Words，无法表达 `\d+`、分支和捕获组；
- 如果搜索与替换各自编译 pattern，大小写、flags 或 zero-length 推进可能分叉；
- JavaScript 回溯正则在 workspace 文件上运行时必须限制 pattern 尺寸并拒绝常见
  嵌套量词爆炸形状。

**实现**：

- 宿主新增 `compileWorkspaceRegex()`：
  - 最大 256 字符；
  - Unicode `u` flag；
  - smart case 决定是否加 `i`；
  - 编译错误返回 `invalid regular expression: ...`；
  - 拒绝 `(a+)+` 等常见 nested-repeat ReDoS 形状；
- 新增 `regexMatchRecords()`：
  - global regex 枚举；
  - zero-length match 按 Unicode code point 推进；
  - 搜索按剩余 maxMatches 截断；
- 搜索、Replace All 和 sticky 单处 Replace 复用同一 compile 入口；
- Replace All 使用 JavaScript `$1/$&` 捕获替换；
- 单处 Replace 用 sticky regex 精确验证 line/column；
- Search Everywhere 和 Find 增加 `.*` 切换；
- Regex 开启时自动关闭并禁用 Whole Words；
- 选项切换清空旧结果并重跑，移交 Find 时继承 regex。

**验证**：

- RED：`tests/round482.test.mjs` 初始 **0 pass / 5 fail**；
- GREEN：round467/480/481/482 定向 **17 pass / 0 fail**；
- 全量：`npm test` = **1570 pass / 0 fail**；
- `node --check lib/client.js`、`lib/index.js`、`lib/terminal.js` 通过；
- `git diff --check` 通过；
- 正则 `foo-(\d+)` 的 smart case / case-sensitive 搜索通过；
- 非法 `[` 与 `(a+)+$` 在执行扫描前失败；
- Replace All `$1:$2` 和单处 sticky 替换通过；
- 隔离 DSH Web：
  - `needleValue|// needle` 在 Regex 下得到 2 条；
  - Whole Words 自动禁用；
  - 移交 Find 后 Regex 保持按下、仍为 2 条；
  - `[abc` 显示宿主正则解析错误；
  - 恢复合法 pattern 后回到 2 条 / 1 个文件。

**下一轮计划**：

1. 增加 IDEA File Mask 搜索过滤；
2. 复用 workspace 文件清单，在扫描前按 glob 过滤；
3. 搜索与替换共享 mask 状态并随 Find 移交；
4. 补 mask 语法、非法 mask、运行态和文档门禁。

## 2026-11-15 — Search Everywhere / Find Whole Words

**作用域**：Search Everywhere、Find/Replace in Files 的 Unicode Whole Words、
搜索选项移交和替换边界一致性。

**问题证据**：

- IDEA `FindBundle` 明确提供 `find.whole.words` 与 `find.whole.words.label`；
- 当前文本搜索只有 smart case，`needle` 会命中 `needleValue`；
- 若只过滤搜索结果而不过滤替换，单处 Replace 和 Replace All 会改写非整词命中。

**实现**：

- 宿主新增 Unicode word-character 判断：
  - 字母、数字、组合符和下划线属于 word character；
  - 按 code point 处理 emoji/代理对；
  - query 首尾为 word character 时才要求对应侧为边界；
- `literalMatchOffsets()` 和 `replaceLiteralOccurrences()` 共用 wholeWords；
- `searchWorkspaceText()`、Replace All、精确 occurrence Replace 都接收并验证
  `wholeWords`；
- Search Everywhere 与 Find 工具增加 `W` 切换；
- 选项切换后清空旧结果、重置活动项并重跑搜索；
- Open in Find Tool Window 继承 wholeWords；
- 所有 Search Everywhere/Find 搜索和替换请求透传该字段。

**验证**：

- RED：`tests/round481.test.mjs` 初始 **0 pass / 4 fail**；
- GREEN：round467/479/480/481 定向 **17 pass / 0 fail**；
- 全量：`npm test` = **1565 pass / 0 fail**；
- `node --check lib/client.js`、`lib/index.js`、`lib/terminal.js` 通过；
- `git diff --check` 通过；
- ASCII 回归 `cat concatenate cats cat_cat cat`：仅第 1、30 列命中；
- CJK 回归 `猫。猫 猫猫`：仅第 1、3 列命中；
- Replace All 只改两个整词，`concatenate / cats / cat_cat` 保持不变；
- 隔离 DSH Web：
  - `needle` 默认 6 条；
  - Whole Words 开启后 5 条，`needleValue` 被排除；
  - 移交 Find 后仍为 5 条且按钮按下；
  - 关闭后恢复 6 条 / 3 个文件。

**下一轮计划**：

1. 增加 IDEA Regex 搜索选项；
2. 宿主先校验 pattern，再在有界 workspace 扫描中复用；
3. Replace All/单处 Replace 共享 regex 捕获替换语义；
4. 补 ReDoS/长度/错误 pattern 防护、运行态验证和文档。

## 2026-11-15 — 持久 Find 单处替换

**作用域**：Find/Replace in Files 活动 occurrence、精确 line/column 写入、
mtime 冲突和替换后的结果推进。

**问题证据**：

- 持久 Find 工具此前只有 Replace All，缺少 IDEA
  `find.popup.replace.selected.button` 对应的当前命中替换；
- 搜索结果只是快照，若直接在浏览器里改文件会绕过已有 mtime 防护；
- 只按路径重写会把同文件的其他命中一起替换，无法保持 IDEA 的单处语义。

**实现**：

- Find 工具替换行增加单处 `Replace` 按钮；
- 输入框 Enter 执行当前命中替换，Meta+Enter 保持 Replace All；
- 当前行不是文本 occurrence、搜索加载中或替换 busy 时按钮禁用；
- Editor 新增 `replaceFindToolOccurrence()`：
  - 继续拒绝 dirty buffer；
  - 只提交一个 target 和 `{line,column}`；
  - 复用 `replaceText`、`reloadFile()` 和 `loadGit()`；
- 宿主 `replaceWorkspaceText()` 支持 `occurrence`：
  - 只允许一个目标文件；
  - 将一基 line/column 转为字符串 offset；
  - 在同一大小写规则下重新验证 query；
  - 不匹配时返回 `dsh-editor/conflict`；
  - 写入仍走 `writeTextFileGuarded()`；
- 替换成功后重启 Find 搜索并把 index 留在原槽位，从而推进到下一处。

**验证**：

- RED：`tests/round480.test.mjs` 初始 **0 pass / 4 fail**；
- GREEN：round467/479/480 定向 **13 pass / 0 fail**；
- 全量：`npm test` = **1561 pass / 0 fail**；
- `node --check lib/client.js`、`lib/index.js`、`lib/terminal.js` 通过；
- `git diff --check` 通过；
- 隔离 DSH Web：
  - Find 中 `needle` 为 6 条，活动项 README.md:3:1；
  - 单处 Replace 后只剩 5 条，仅 README 第 3 行变为 `omega`；
  - 当前项自动推进到 README.md:4:8；
  - app.js 与 docs/notes.md 的其他命中保持不变；
  - 状态栏显示 `Replaced 1 occurrence(s) in 1 file(s)`；
  - fixture 已恢复。

**下一轮计划**：

1. 对照 IDEA `find.whole.words` 增加 Whole Words；
2. 搜索和替换共用 Unicode 单词边界语义；
3. Search Everywhere 与持久 Find 同步选项状态；
4. 补边界回归、运行态门禁和文档。

## 2026-11-15 — Search Everywhere / Find 统一 Match Case

**作用域**：Search Everywhere 文本搜索、持久 Find 工具、Replace in Files
的大小写选项，以及结果移交时的查询状态继承。

**问题证据**：

- 宿主 `searchWorkspaceText()` 已支持显式 `caseSensitive`，但客户端从未发送；
- 宿主 `replaceWorkspaceText()` 固定使用 smart case，与加大小写开关后的搜索
  可能分叉：搜索只命中小写，替换却同时改写大写文本；
- `Open in Find Tool Window` 只移交 query/results，不继承 Search Everywhere
  搜索选项，工具窗口按钮状态会与已有结果不一致。

**实现**：

- Search Everywhere 和 FindToolWindow 增加 `Match Case` 切换按钮（`Aa`）；
- 默认关闭，保持既有 smart case；
- 开启时 `searchText` 与 `replaceText` 都传 `caseSensitive:true`；
- 关闭时省略该字段，由宿主继续执行 smart case，而不是强制大小写不敏感；
- `replaceWorkspaceText()` 增加 options 参数并由宿主路由透传；
- 结果移交 Find 工具时携带 `caseSensitive`，打开后按钮和结果保持同一状态；
- 切换选项会清空旧结果、重置活动项并重新请求搜索。

**验证**：

- `tests/round479.test.mjs`：**5 pass / 0 fail**；
- round467/478/479 定向：**11 pass / 0 fail**；
- 全量：`npm test` = **1557 pass / 0 fail**；
- `node --check lib/client.js`、`lib/index.js`、`lib/terminal.js` 通过；
- `git diff --check` 通过；
- 隔离 DSH Web：
  - 查询 `needle` 默认 smart case 为 6 条，开启 Match Case 后为 4 条；
  - 按钮 `aria-pressed` 从 `false` 变为 `true`；
  - `Open in Find Tool Window` 后仍为 4 条且 Match Case 为 `true`；
  - 在 Find 工具关闭 Match Case 后恢复 6 条，汇总同步为
    `6 matches in 3 files`。

**下一轮计划**：

1. 对照 IDEA `find.popup.replace.selected.button` 实现单处替换；
2. 宿主替换接口支持精确 occurrence 位置，并继续校验 mtime；
3. Find 工具替换当前命中后保留结果集并推进到下一处；
4. 补回归、运行态验证并同步文档。

## 2026-11-15 — Search Everywhere 结果菜单键盘入口与复制通知

**作用域**：Search Everywhere 文件/文本结果上下文菜单、活动结果键盘入口、
相对路径/带位置路径复制反馈，以及 Editor 现有状态栏通知接线。

**问题证据**：

- round477 只提供鼠标右键入口，键盘用户无法对活动文件/文本结果打开同一菜单；
- 路径复制调用是 fire-and-forget，浏览器剪贴板 API 被拒绝时没有任何反馈；
- 搜索弹框与 Editor 通知系统分属两个组件，直接 `navigator.clipboard` 成功/失败
  不会进入现有状态栏。

**实现**：

- 查询输入框捕获 `Shift+F10` / `ContextMenu`，只对当前活动 `file` / `text` 行打开菜单；
- 菜单锚点取 `[data-search-everywhere-active="1"]` 的真实矩形，缺失时回退到安全坐标；
- 文件和文本结果继续共用 round477 的 `openResultMenuAt()`，不复制菜单动作；
- 新增 `copySearchResultText()`：
  - clipboard API 不存在时立即报告失败；
  - Promise 成功报告 `editor.copiedToClipboard`；
  - Promise 失败报告 `editor.clipboardWriteFailed`；
- SearchEverywhere 新增 `onNotify`，Editor 接到现有 `flashStatus`；
- 复制后只关闭菜单，不关闭搜索弹框，查询框保持可继续输入。

**验证**：

- RED：`tests/round478.test.mjs` 初始 **0 pass / 3 fail**；
- GREEN：round476/477/478 定向 **11 pass / 0 fail**；
- 全量：`npm test` = **1552 pass / 0 fail**；
- 语法：`node --check lib/client.js`、`lib/index.js`、`lib/terminal.js` 通过；
- `git diff --check` 通过；
- 隔离 DSH Web：
  - 双击 Shift 后输入 `Needle`，出现 README 与 app.js 文本命中；
  - 活动结果按 `Shift+F10` 出现
    `Open in Right Split / Open in editor / Copy relative path /
    Path with Line Number / Select in Project View`；
  - 执行 `Copy relative path` 后 Search Everywhere 保持打开，
    `document.activeElement` 回到查询框；
  - 状态栏显示 `Copied to clipboard`。

**下一轮计划**：

1. 用 IDEA 安装包资源与 DSH 源码对照 Find/Replace 大小写选项；
2. 在 Search Everywhere Text 与持久 Find 工具中统一 `Match Case` 语义；
3. 保证替换操作复用同一大小写规则，避免搜索与替换分叉；
4. 保持全量回归并同步文档。

## 2026-11-15 — Search Everywhere 结果右键导航

**作用域**：Search Everywhere 文件/文本结果右键菜单、右侧拆分、
编辑器打开、路径复制和 Project 定位。

**实现**：

- SearchEverywhere 增加本地 `resultMenu`；
- 文件和文本结果 `onContextMenu` 打开 ContextMenu；
- 菜单项复用现有能力：
  - `Open in Right Split` -> `openInRightSplit(path)`；
  - `Open in editor` -> 现有结果激活；
  - `Copy relative path` -> 相对路径；
  - `Path with Line Number` -> 文本命中 `path:line:column`；
  - `Select in Project View` -> `revealPath(path)`；
- 导航动作先关闭 Search Everywhere 再执行，避免模态遮挡；
- 路径复制动作只关闭菜单，搜索框仍可继续使用；
- 菜单复用 ContextMenu 的视口收敛和键盘导航。

**验证**：

- RED：`tests/round477.test.mjs` 初始 **0 pass / 4 fail**；
- GREEN：round475/476/477 定向 **12 pass / 0 fail**；
- 全量：`npm test` = **1549 pass / 0 fail**；
- 隔离 DSH Web：
  - `Needle` 文本结果右键菜单顺序为
    `Open in Right Split / Open in editor / Copy relative path /
    Path with Line Number / Select in Project View`；
  - 选择 Open in Right Split 后 Search Everywhere 关闭；
  - 编辑器出现 2 个 Monaco 实例，Split Close 控件存在。

**下一轮计划**：

1. 补结果右键菜单的 Shift+F10 / ContextMenu 键盘入口；
2. 检查复制成功/失败的通知反馈；
3. 对照 IDEA 对 File 与 Text 结果的菜单差异；
4. 保持全量回归并同步文档。

## 2026-11-15 — Search Everywhere Action tooltip 延迟与定位

**作用域**：Search Everywhere Action hover tooltip、disabled 说明、
视口边界和最近命令跨会话持久化。

**实现**：

- 新增 `searchEverywhereTooltipPosition()`：
  - 默认放在结果行下方 4px；
  - 下方空间不足时翻到行上方；
  - left/top 都收敛到视口 4px 安全边距；
- SearchEverywhere 增加 `resultTooltip` 和 450ms hover timer；
- tooltip 使用 `position:fixed`、`pointer-events:none`；
- 鼠标移出、滚动、查询变化、点击和组件卸载都会取消 timer/tooltip；
- native title 改为 `aria-description` + 自定义 tooltip，避免双提示；
- command history 仍写 `dsh-editor.search.commandHistory`，
  页面重载后从 localStorage 恢复。

**验证**：

- RED：`tests/round476.test.mjs` 初始 **2 pass / 2 fail**；
- GREEN：round474/475/476 定向 **11 pass / 0 fail**；
- 全量：`npm test` = **1545 pass / 0 fail**；
- 隔离 DSH Web：
  - 写入 commandHistory 后 reload；
  - Replace… 仍排在 Actions 第一条；
  - hover Replace 500ms 后 tooltip 出现；
  - tooltip 文本为 `Replace… — Replace with — ⌘R`；
  - tooltip rect 位于 1044×657 视口内。

**下一轮计划**：

1. 对照 IDEA tooltip 的精确延迟和主题视觉；
2. 复核 Filter 菜单在窄窗口中的方向键与首项焦点；
3. 检查最近命令历史清理/重置入口；
4. 保持全量回归并同步文档。

## 2026-11-15 — Search Everywhere 空查询分组与 Action tooltip

**作用域**：Search Everywhere 空查询/命令模式的 visual section、
Action tooltip、Filter 菜单键盘契约。

**实现**：

- 新增 `searchEverywhereSection()`：
  - 空 All 页将最近搜索与 Actions 分成 `Recent searches / Actions`；
  - 命令模式结果标记为 Actions；
  - 普通有查询结果不插分组标题；
- 分组标题是普通 `div[data-search-everywhere-section]`，不是
  `role=option`，不进入 `↑/↓`、Enter 或 activeIndex；
- 新增 `searchEverywhereResultTooltip()`：
  - disabled Action 显示 disabled 原因；
  - 普通 Action 显示 `名称 — 描述 — 快捷键`；
- Filter 菜单继续复用 ContextMenu：
  - 打开后首项可聚焦；
  - `↑/↓` 跳过 disabled；
  - Esc/关闭后按 round474 的路径回到查询框。

**验证**：

- RED：`tests/round475.test.mjs` 初始 **1 pass / 3 fail**；
- GREEN：round473/474/475 定向 **10 pass / 0 fail**；
- 全量：`npm test` = **1541 pass / 0 fail**；
- 隔离 DSH Web：
  - 打开 `app` 结果后重开空查询；
  - 分组标题为 `RECENT SEARCHES`、`ACTIONS`；
  - option 数仍为 9，分组标题不计数；
  - `Replace…` tooltip 为
    `Replace… — Replace with — ⌘R`。

**下一轮计划**：

1. 检查 `/` 命令模式最近排序的跨会话持久化；
2. 复核 Filter 菜单首项焦点与方向键在窄窗口中的表现；
3. 对照 IDEA Actions tooltip 的延迟与定位；
4. 保持全量回归并同步文档。

## 2026-11-15 — Search Everywhere Filter 菜单焦点返回

**作用域**：Search Everywhere Filter 菜单的连续切换、Esc/外部关闭、
焦点恢复与 `/` 命令排序输入。

**问题证据**：

- Filter 菜单使用 keepOpen 连续切换，关闭时 ContextMenu 默认把焦点
  还给 Filter 按钮；
- 这会打断随后的键盘搜索：用户关闭菜单后必须再点击查询框；
- IDEA 的搜索输入仍是主键盘表面，Esc 关闭临时菜单后应能继续输入。

**实现**：

- SearchEverywhere 新增 `searchInputRef`；
- 新增 `closeFilterMenu()`：
  - 关闭 Filter 菜单；
  - 下一帧把焦点交回查询输入框；
- Filter ContextMenu 的 `onClose` 统一走该函数；
- keepOpen 选中分类时仍不关闭菜单；
- `/` 命令模式仍通过去掉 slash 后的 `commandQuery` 进入最近命令排序。

**验证**：

- RED：`tests/round474.test.mjs` 初始 **2 pass / 1 fail**；
- GREEN：round465/473/474 定向 **9 pass / 0 fail**；
- 全量：`npm test` = **1537 pass / 0 fail**；
- 隔离 DSH Web：
  - 打开 Filter 并切换 Text；
  - 菜单保持打开，Text 的 `aria-checked=false`；
  - 按 Esc 后菜单消失；
  - `document.activeElement` 回到
    `Search files, text and actions…` 输入框。

**下一轮计划**：

1. 对照 IDEA Actions 空查询分组与 tooltip 文案；
2. 检查 Filter 菜单方向键和首项焦点；
3. 复核 `/` 命令模式最近排序的跨会话持久化；
4. 保持全量回归并同步文档。

## 2026-11-15 — Search Everywhere Filter 索引收敛与命令模式 disabled

**作用域**：Filter 分类切换后的活动项归一、`/` 命令模式的
disabled Action 展示和键盘遍历。

**问题证据**：

- Filter 关闭 `Actions` 后结果可能变成空集或大幅缩短；
- 旧活动索引仍可能大于新结果数，或落到 disabled Action；
- `/find` 命令模式会匹配到 Find Next/Previous，但无活动
  Find 条件时它们仍必须是 disabled。

**实现**：

- 新增 `normalizeSearchResultIndex()`：
  - 先 clamp 到当前可见行；
  - 当前行 disabled 时向后找最近可执行行；
  - 全部 disabled 或空集时保持合法索引 0；
- Search Everywhere 用归一索引计算 `activeResult`；
- effect 在 `state.index !== activeIndex` 时回写父状态；
- `/` 命令模式继续保留 disabled Action，不先过滤掉；
- 键盘遍历继续使用 `nextEnabledSearchResultIndex()`。

**验证**：

- RED：`tests/round473.test.mjs` 初始 **1 pass / 2 fail**；
- GREEN：round471/472/473 定向 **9 pass / 0 fail**；
- 全量：`npm test` = **1534 pass / 0 fail**；
- 隔离 DSH Web：
  - 空查询移动到 `Replace…`；
  - Filter 关闭 Actions 后结果数为 0；
  - 重新开启 Actions，活动项回到首条可执行
    `Go to File`，不是旧索引；
  - `/find` 保留 `Find Next/Previous`，两者
    `aria-disabled=true`；
  - 从 `Find…` 按 `↓` 跳过 disabled 项，落到
    `Find in Files…`。

**下一轮计划**：

1. 对照 IDEA Actions 空查询分组与 tooltip 文案；
2. 检查 Filter 菜单打开时键盘焦点与 Esc 返回路径；
3. 复核 `/` 命令模式与最近命令排序组合；
4. 保持全量回归并同步文档。

## 2026-11-15 — Search Everywhere disabled Action 键盘边界

**作用域**：Search Everywhere Actions 的上下键遍历、disabled 原因、
鼠标/Enter 激活守卫，以及最近命令排序与筛选组合。

**IDEA 对照**：

- disabled Action 仍可看见并解释为何不可用；
- 键盘选择不能落到 Enter 必然无效的 disabled 行；
- 最近命令排序应先于 Filter 展示，不被分类过滤重新打乱。

**实现**：

- 新增 `nextEnabledSearchResultIndex()`：
  - 循环查找下一个非 disabled 结果；
  - 支持首尾回绕；
  - 全部 disabled 时返回 null，保持当前选择；
- Search Everywhere 的 `↑/↓` 统一调用 `moveSearchSelection()`；
- Find Next/Previous 增加 `disabledReason`：
  - 中文：先在编辑器中打开查找并输入查询条件；
  - 英文：Open Find and enter a query first；
- disabled 行 title 展示原因，`aria-disabled=true`；
- 激活函数继续在 disabled 时提前返回；
- `rankSearchActions()` 在 Filter 之前执行，筛选不会绕过最近命令排序。

**验证**：

- RED：`tests/round472.test.mjs` 初始 **1 pass / 2 fail**；
- GREEN：round469/471/472 定向 **9 pass / 0 fail**；
- 全量：`npm test` = **1531 pass / 0 fail**；
- 隔离 DSH Web：
  - 初始活动项为 Go to File；
  - 连续按 4 次 ↓：Recent Files → Find… → Replace… →
    Find in Files…，两个 disabled Find Next/Previous 被跳过；
  - 两个 disabled 行 title 均为
    `Open Find and enter a query first`。

**下一轮计划**：

1. 对照 IDEA Actions 空查询分组与 tooltip 文案；
2. 复核 Filter 开关期间活动索引收敛与当前项选择；
3. 检查 `/` 命令模式下的 disabled Action 展示；
4. 保持全量回归并同步文档。

## 2026-11-15 — Search Actions 最近使用排序与 disabled

**作用域**：Search Everywhere Actions 的历史记忆、空查询排序、
Find Next/Previous 可用状态和激活守卫。

**IDEA 对照**：

- Actions 空查询会优先展示常用/最近执行的命令；
- Find Next / Previous 在没有活动查找条件时是 disabled；
- disabled 项不能通过 Enter、鼠标或菜单回调执行。

**实现**：

- 新增 `rememberCommandHistory()`：去空、去重、最新在前、最多 12 条；
- 历史保存在 `dsh-editor.search.commandHistory`；
- 新增 `rankSearchActions()`：
  - 先按文本匹配分数；
  - 同分时按最近执行顺序；
  - 空查询所有分相同，因此最近命令自然置顶；
- Search Everywhere 在执行 Action 时记录 action id；
- Find Next/Find Previous 在没有 `replaceState` 或查询为空时标记
  `disabled`；
- 列表行输出 `aria-disabled`，激活函数在 disabled 时直接返回；
- 中英文文案、README 同步。

**验证**：

- RED：`tests/round471.test.mjs` 初始 **0 pass / 3 fail**；
- GREEN：round466/469/470/471 定向 **13 pass / 0 fail**；
- 全量：`npm test` = **1528 pass / 0 fail**；
- 隔离 DSH Web：
  - 清空命令历史后，Find Next/Previous 的
    `aria-disabled=true`；
  - 执行 `Replace…` 后历史写入 `["replace"]`；
  - 重新打开空 Search Everywhere，最近搜索 `replace` 在最上，
    Actions 中 `Replace…` 排到其余命令之前；
  - Find in Files / Replace in Files 顺序保持稳定。

**下一轮计划**：

1. 补 Find/Replace 结果动作的键盘导航边界；
2. 对照 IDEA Actions 空查询分组、disabled 文案与 tooltip；
3. 检查 Search Everywhere 筛选器与最近命令排序的组合；
4. 保持全量回归并同步文档。

## 2026-11-15 — Search Everywhere Include non-project items

**作用域**：Search Everywhere 的 Include non-project items、workspace
排除目录扫描、Files/Text 搜索预算和宿主边界。

**IDEA 实窗证据**：

- Search Everywhere 工具栏有 `Include non-project items` 复选框；
- 它扩展搜索范围到常规项目索引之外，但仍是 IDE 已知/有界范围，
  不是任意磁盘路径浏览器。

**实现边界**：

- DSH 没有第二套语言索引或外部 content root；
- 因此该开关映射为“重新纳入当前 workspace 内被快速搜索跳过的排除目录”：
  `node_modules / dist / build / out / target / .cache / venv` 等；
- `.git / .hg / .svn` 元数据永不纳入；
- 所有路径仍经 `resolveInside(root)`，浏览器不能传入外部绝对路径；
- 文件上限从 2000 提升到 5000，单文件仍为 1 MiB，文本命中仍最多 200 条。

**实现**：

- `listWorkspaceFiles()` 新增 `includeExcluded` 选项，并把
  `showExcluded` 传给 `listDirectory()`；
- `searchWorkspaceText()` 复用同一 walk 与预算；
- host `fs.files` / `fs.searchText` 接受布尔 `includeExcluded`；
- Search Everywhere 新增 IDEA 同名切换按钮，切换时同时刷新 Files
  和 Text 结果；
- 中英文文案、README、工程记忆同步。

**验证**：

- RED：`tests/round470.test.mjs` 初始 **0 pass / 3 fail**；
- GREEN：round148/464/466/469/470 定向 **24 pass / 0 fail**；
- 全量：`npm test` = **1525 pass / 0 fail**；
- 隔离 DSH Web：
  - 在 fixture 的 `node_modules/dsh-editor-r470/` 创建
    `excluded.txt`，内容 `R470_EXCLUDED_ITEM`；
  - 开关关闭时搜索该文本无结果；
  - 点击 `Include non-project items` 后，
    `node_modules/dsh-editor-r470/excluded.txt:1:1` 出现，
    按钮 `aria-pressed=true`；
  - `.git` 仍不在扫描结果中；
  - 测试文件已清理。

**下一轮计划**：

1. 完善 `/` 命令模式分类与最近命令优先排序；
2. 对照 IDEA Actions 空查询默认顺序、disabled 状态与分组；
3. 补 Find/Replace 相关结果动作的键盘导航边界；
4. 保持全量回归并同步文档。

## 2026-11-15 — Search Everywhere 查找导航入口与超大结果确认

**作用域**：Search Everywhere Actions 的 Find Next/Previous、
`Open in Find Tool Window` 结果规模确认和动作文案。

**IDEA 实窗证据**：

- Actions 搜索结果中明确出现
  `Find Next / Move to Next Occurrence ⌘G`、
  `Find Previous / Move to Previous Occurrence ⇧⌘G`、
  `Replace… ⌘R` 与 `Replace in Files… ⇧⌘R`；
- 一千条以上结果进入 Find 工具窗口前会先弹出
  `Too Many Results` 确认。

**修复前差异**：

- DSH Actions 只有 Find/Find in Files，没有 Find Next/Previous；
- Search Everywhere 的尺寸有界，但 Files/Text 合计仍可能超过 200 条，
  `Open in Find Tool Window` 会直接 materialize，没有规模确认；
- 原 `Next match` 文案在搜索 `find` 时无法命中 IDEA 同名动作。

**实现**：

- 新增 `searchEverywhereRequiresResultConfirmation()` 纯函数；
- `Open in Find Tool Window` 在 Files/Text 合计大于 200 时先确认；
- Actions 新增：
  - `Find Next / Move to Next Occurrence ⌘G`；
  - `Find Previous / Move to Previous Occurrence ⇧⌘G`；
- 动作通过 `editorFindStepRef` 调用现有 `jumpToMatch()`，不复制匹配逻辑；
- 补齐中英文动作名称与提示。

**验证**：

- RED：`tests/round469.test.mjs` 初始 **0 pass / 3 fail**；
- GREEN：round464/466/468/469 定向 **14 pass / 0 fail**；
- 隔离 DSH Web：
  - 搜索 `find` 时 Actions 顺序为
    `Find… / Find Next / Find Previous / Find in Files…`；
  - 创建 210 个临时匹配文件后，Files/Text 合计 280 条；
  - 点击 `Open in Find Tool Window` 实际出现
    `Found 280 results. Open them in the Find tool window?`；
  - 选择取消后 Search Everywhere 保持打开，Find 未误打开；
  - 临时 bulk fixture 已清理。

**下一轮计划**：

1. 设计 Include non-project items 的宿主授权路径与扫描边界；
2. 完善 `/` 命令模式分类与最近命令优先排序；
3. 对照 IDEA 的 Actions 空查询默认顺序和 disabled 状态；
4. 保持 1522+ 全量回归并同步文档。

## 2026-11-15 — Find 工具窗口折叠、全部展开/收起与 Preview Source

**作用域**：持久 Find 工具窗口的文件分组、可见命中遍历、源码预览和
软换行。

**IDEA 实窗证据**：

- Find 工具窗口工具栏包含
  `Previous Occurrence / Next Occurrence / Expand All / Collapse All /
  Preview Source`；
- 文件结果是可折叠节点，收起后其 occurrence 行不再显示；
- Preview Source 打开只读源码面板，并显示当前命中文件与行号；
- 预览编辑器提供软换行开关。

**实现**：

- 新增 `findToolVisibleRows()` 纯函数：
  - Files 结果始终可见；
  - 收起的 Text 文件只隐藏自己的 occurrence；
  - 可见行顺序继续复用 `groupFindMatches()` 的稳定文件分组；
- `FindToolWindow` 新增 `collapsedFiles / previewOpen / previewSoftWrap`
  本地状态；
- 文件组标题前增加展开/收起箭头；工具栏新增
  `Expand All / Collapse All`，并根据折叠状态控制 disabled；
- `Preview Source` 复用宿主 `fs.read`、`searchEverywherePreviewWindow()`
  与现有只读代码行样式；文本命中居中并高亮目标行；
- `↑/↓`、Previous/Next 和 Enter 只操作当前可见结果；
- 补齐中英文文案，不引入新的搜索或预览实现。

**验证**：

- RED：`tests/round468.test.mjs` 初始 **1 pass / 1 fail**，
  缺少 `findToolVisibleRows()`；
- GREEN：round467/468 与 Preview 相关定向 **9 pass / 0 fail**；
- 全量：`npm test` = **1519 pass / 0 fail**；
- `node --check lib/client.js`、`lib/index.js`、`lib/terminal.js`
  与 `git diff --check` 通过；
- 隔离 DSH Web：
  - `Needle` 显示 2 个文件、2 条命中；
  - 收起 `README.md` 后可见 option 从 2 变为 1，
    `Expand All` 启用；
  - `Expand All` 恢复 2 条；
  - `Collapse All` 后 option 为 0、`Collapse All` 禁用，
    再展开恢复 2 条；
  - `Preview Source` 显示 `src/app.js`，目标第 1 行高亮；
  - 软换行开关存在；
- 截图：`/private/tmp/dsh-editor-r468-find-preview-collapse.png`。

**下一轮计划**：

1. 实现 Include non-project items 的可信扫描边界，仍以宿主明确授权路径
   为限，不扫描浏览器任意路径；
2. 对照 IDEA `Too Many Results` 的结果规模确认与截断提示；
3. 完善 `/` 命令模式分类、最近命令优先排序和 Actions 顺序；
4. 保持 1519+ 全量回归并同步文档。

## 2026-11-15 — Search Everywhere `Open in Find Tool Window`

**作用域**：Search Everywhere 的搜索结果持久化、Find/Replace in Files
入口、底部 Find 工具窗口与 Terminal 底栏互斥。

**IDEA 实窗证据**：

- Search Everywhere 工具栏包含 `Preview / Filter / Open in Find Tool Window`；
- 点击后弹框关闭，底部 `Find` 工具窗口保留查询与结果；
- 结果按文件分组，工具栏提供
  `Previous Occurrence / Next Occurrence / Hide`；
- `Find in Files` 与 `Replace in Files` 属于工具窗口语义，
  不是一次性弹框。

**修复前差异**：

- DSH 的 `⇧⌘F / ⇧⌘R` 与 Actions 入口仍打开 Search Everywhere 的
  Text 页；
- 关闭弹框后结果和查询丢失，不能继续逐条走命中；
- Search Everywhere 没有 IDEA 的 `Open in Find Tool Window`。

**实现**：

- `SearchEverywhere` 增加 `Open in Find Tool Window`，仅在非命令模式、
  查询非空且已有 Files/Text 结果时启用；
- 新增 `groupFindMatches()` 纯函数，按首次出现顺序稳定地按文件分组；
- 新增 `FindToolWindow` 持久底栏：
  - 文件分组、行内搜索词高亮；
  - `Previous/Next Occurrence`、`↑/↓`、Enter 打开、Esc 隐藏；
  - Replace 模式复用宿主 `replaceText`，保留 dirty tab 与 mtime 防护；
- `Find in Files…`、`Replace in Files…` 及 `⇧⌘F / ⇧⌘R`
  改为打开持久 Find 底栏；
- Find 与 Terminal 共用底部工具窗口位置：打开一方收起另一方，
  但 Terminal PTY 与 Find 查询状态均保留；
- Find 高度写入 `dsh-editor.find.height`。

**验证**：

- RED：`tests/round467.test.mjs` = **0 pass / 4 fail**；
- 定向：round464/465/466/467 = **16 pass / 0 fail**；
- 全量：`npm test` = **1517 pass / 0 fail**；
- `node --check lib/client.js`、`lib/index.js`、`lib/terminal.js`
  与 `git diff --check` 通过；
- 隔离 DSH Web：
  - Search Everywhere 输入 `Needle` 后出现可用的
    `Open in Find Tool Window`；
  - 点击后弹框关闭，Find 底栏显示
    `2 matches in 2 files`，按 `README.md` / `src/app.js` 分组；
  - `↑/↓` 选择第二条后 Enter 打开 `src/app.js`，状态栏为
    `Ln 1, Col 29`；
  - `⇧⌘F` 直接聚焦 Find 查询框；
  - `⇧⌘R` 显示替换输入，Replace All 经确认后替换 2 个文件中的
    2 处，结果自动刷新为 `No matches`；
  - 测试文件已按原 SHA-1 恢复。
- 截图：
  `/private/tmp/dsh-editor-r467-find-tool-window.png`、
  `/private/tmp/dsh-editor-r467-find-second-opened.png`、
  `/private/tmp/dsh-editor-r467-replace-done.png`。

**下一轮计划**：

1. 补 IDEA Find 工具窗口的文件分组折叠、`Expand All / Collapse All`
   与 `Preview Source`；
2. 为 `Too Many Results` 和 Include non-project items 设计可信边界；
3. 完善命令模式分类与最近命令优先排序；
4. 保持 1517+ 全量回归并同步 README / engineering-memory。

## 2026-11-15 — Search Everywhere `/` 命令模式与搜索历史

**作用域**：Search Everywhere 命令输入、最近搜索和文件内容搜索触发条件。

**问题证据**：

- 弹框已经显示 IDEA 的 `Type / to see commands`；
- 旧实现输入 `/replace` 仍按普通文本搜索文件和内容，
  即提示入口与真实行为不一致；
- 每次打开 Search Everywhere 都从空列表开始，没有 IDEA 的最近搜索。

**实现**：

- 新增 `searchEverywhereCommandQuery()`：
  - `/` -> 空命令，显示全部 Actions；
  - `/find` -> 以 `find` 过滤 Actions；
  - 非 `/` 输入仍走普通 Files/Text/Actions 搜索；
- 命令模式下结果只来自现有 Actions 注册表，不再请求
  `searchText`，避免无意义的磁盘扫描；
- 新增 `rememberSearchHistory()`：
  - 去空、去重、最新在前、最多 20 条；
- 按 workspace 保存到
  `dsh-editor.search.history:<workspace-root>`；
- Search Everywhere 空输入时先显示最近搜索，点击可恢复查询；
- 成功打开文件、文本命中或执行动作时记录查询；
- 历史查询自身不重复写入。

**验证**：

- RED：`tests/round466.test.mjs` = **0 pass / 4 fail**；
- 定向：round464/465/466 = **12 pass / 0 fail**；
- 隔离 DSH Web：
  - `/replace` 只显示
    `Replace… ⌘R`、`Replace in Files… ⇧⌘R`；
  - 打开 `Needle` 文本命中后 localStorage 写入 `["Needle"]`；
  - 重新打开空 Search Everywhere，首行为
    `Needle · Recent search`；
  - 键盘 Enter 打开 `app` 后历史变为 `["app","Needle"]`；
- 截图：
  `/private/tmp/dsh-editor-r466-search-slash.png`、
  `/private/tmp/dsh-editor-r466-search-history.png`。

**下一轮计划**：

1. 实现 IDEA 的 `Open in Find Tool Window` 持久结果页；
2. 设计 Include non-project items 的可信扫描边界；
3. 补充命令模式分类和最近命令优先排序；
4. 保持全量回归并同步文档。

## 2026-11-15 — Search Everywhere Preview 与 Filter

**作用域**：Search Everywhere 的结果预览、内容读取、分类过滤和
可复用的保持展开菜单项。

**IDEA 实窗证据**：

- Search Everywhere 顶部 Preview 按钮打开下半区只读编辑器；
- 选中 README 文件时显示文件内容、行号和搜索词高亮；
- Preview 工具栏有 `Soft-Wrap Preview Editor`；
- Filter 菜单用于筛选 All 页结果类型；
- 预览底部显示完整路径和 `Open In Right Split`。

**实现**：

- `SearchEverywhere` 增加 Preview 开关和只读代码预览：
  - 文件/文本结果通过 `callFs({ op: 'read', path })` 读取；
  - 预览最多 401 行，避免在弹框中复制完整 Monaco；
  - 文本命中居中并高亮真实行；
  - 文件命中从首行开始；
  - 支持 Soft-Wrap，默认开启；
  - 动作结果显示动作说明；
- 新增纯函数 `searchEverywherePreviewWindow()`；
- 新增 Filter 按钮和 `Files / Text / Actions` 分类过滤：
  - 只影响 `All`；
  - 专用页签不因过滤而消失；
  - 菜单项使用 `keepOpen: true` 连续切换；
  - 当前启用项显示 `✓`；
- `ContextMenu` 支持 `keepOpen`：过滤项点击后菜单不关闭；
- 新增 IDEA 风格 Preview 和 Filter 图标；
- Classes / Symbols / Include non-project items 继续不伪造。

**验证**：

- RED：`tests/round465.test.mjs` = **0 pass / 3 fail**；
- 全量：`npm test` = **1509 pass / 0 fail**；
- `node --check lib/client.js`、`lib/index.js`、`lib/terminal.js`
  与 `git diff --check` 通过；
- 隔离 DSH Web：
  - `Needle` 预览路径为 `README.md`；
  - 高亮行内容为 `3 Needle appears here.`；
  - Filter 初始 `Files/Text/Actions` 全部 checked；
  - 点击 Text 后菜单保持打开，`Text=false`，All 结果实时变为 0；
  - Preview 打开后弹框仍保持在同一屏幕内；
- 截图：
  `/private/tmp/dsh-editor-r465-search-preview.png`、
  `/private/tmp/dsh-editor-r465-search-filter.png`。

**下一轮计划**：

1. 实现 IDEA 的 `Open in Find Tool Window` 持久结果页；
2. 搜索输入 `/` 命令模式与最近搜索历史；
3. 加入 Include non-project items 之前先确认宿主可用的非项目扫描源；
4. 保持 1509+ 全量回归并同步文档。

## 2026-11-15 — Search Everywhere 与 IDEA 搜索/替换入口

**作用域**：双击 Shift Search Everywhere、文件/文本/动作搜索、
编辑器 Find/Replace、Find/Replace in Files。

**IDEA 实窗证据**：

- 双击 `Shift` 打开 Search Everywhere；
- 页签顺序为 `All / Classes / Files / Symbols / Actions / Text`；
- `All` 同时显示文件名和文本命中；
- Actions 搜索 `Replace` 出现：
  - `Replace… ⌘R`
  - `Replace in Files… ⇧⌘R`

**实现**：

- 新增纯函数 `doubleShiftAction()`：只接受两次裸 Shift，
  400ms 内有效；其他按键、修饰键和 auto-repeat 会重置；
- 新增 `SearchEverywhere` 弹框：
  - `All / Files / Text / Actions` 四页；
  - 不伪造无从实现的 Classes / Symbols；
  - `Tab / Shift+Tab` 循环页签，`↑/↓` 移动，Enter 激活，Esc 关闭；
  - 文件结果显示 git 状态；文本结果显示 `path:line:column`；
- `Files` 复用既有 `fs.files`；`Actions` 复用现有编辑器/Project 命令；
- 新增宿主 `searchWorkspaceText()`：
  - 复用 `listWorkspaceFiles()`，不另造目录遍历；
  - 最多 2000 文件、单文件 1 MiB、200 命中；
  - 跳过二进制、依赖和构建目录；
  - smart case；
- 新增宿主 `replaceWorkspaceText()`：
  - 目标来自搜索结果，不接受浏览器任意路径；
  - 写入前验证所有目标的 mtime；
  - 只写工作区文本；
- 文本命中通过 `openFileAtLocation()` 打开并定位；已打开的活动标签
  也会移动光标，不再依赖 active-path 变化副作用；
- Search Everywhere Actions 提供：
  - Go to File `⌘⇧O`
  - Recent Files `⌘E`
  - Find `⌘F`
  - Replace `⌘R`
  - Find in Files `⇧⌘F`
  - Replace in Files `⇧⌘R`
- 编辑器查找：
  - `⌘R` 打开 replace，旧 `⌥⌘F` 保留；
  - 打开时带入单行选区；
  - 新增单次 `Replace`，与 `Replace All` 分离；
- Replace in Files：
  - 拒绝有未保存修改的打开文件；
  - 使用浏览器确认框显示文件数/命中数；
  - 成功后重载相关打开文件并刷新 Git。

**验证**：

- RED：`tests/round464.test.mjs` = **0 pass / 5 fail**；
- 定向：`round464 + round242 + round347/348 + 搜索相关回归`
  = **56 pass / 0 fail**；
- 全量：`npm test` = **1506 pass / 0 fail**；
- `node --check lib/client.js`、`lib/index.js`、`lib/terminal.js`
  与 `git diff --check` 通过；
- 隔离 DSH Web（`/private/tmp/dsh-editor-r464-home`，
  fixture `/private/tmp/dsh-editor-r464-fixture`）：
  - 双击 Shift 出现四页签弹框；
  - 输入 `Needle` 命中 `README.md:3:1`、`src/app.js:1:29`；
  - 选择文本命中的真实 editor position 为 `src/app.js:1:29`；
  - Actions 搜索 `Replace` 顺序为 `Replace…`、`Replace in Files…`；
  - Replace in Files 确认后只替换 smart-case 匹配的 2 处；
  - `⌘R` 打开 Find + Replace，单次 Replace 将 Monaco 模型从
    `Needle` 改为 `Omega`，磁盘保持不变直到保存；
  - 替换输入中 Escape 关闭 Search Everywhere；
- 截图：
  `/private/tmp/dsh-editor-r464-search-everywhere-empty.png`、
  `/private/tmp/dsh-editor-r464-search-everywhere-text.png`、
  `/private/tmp/dsh-editor-r464-search-actions-replace.png`、
  `/private/tmp/dsh-editor-r464-replace-in-files-preview.png`。

**下一轮计划**：

1. 对照 IDEA Search Everywhere 的 Preview 面板与 Filter；
2. 实现 `Open in Find Tool Window` 的持久结果页；
3. 补充 `/` 命令模式、历史与 Include non-project items；
4. 保持 1506+ 全量回归并同步文档。

## 2026-11-15 — Commit Diff 模式切换对齐 IDEA 双按钮

**作用域**：Commit / Compare diff 工具栏、Unified 与 Side-by-side
视图切换、窄工具栏响应式布局。

**IDEA 实窗证据**：

- IntelliJ IDEA Commit diff 顶部右侧有两个相邻模式按钮：
  统一行视图与左右并排视图；
- 当前模式有独立选中视觉，点击另一个按钮直接切换；
- 模式按钮不是普通 overflow 命令，正常宽度下始终可见。

**DSH 修复前**：

- 只有一个 `diffViewToggle` ToolbarButton；
- 图标会随当前模式在 `split` / `hide` 间变化；
- 用户看不到 IDEA 的两种模式及当前选择，只能从提示文字推断。

**修复**：

- 删除通用 `id: 'view'` diff action；
- 新增 `DiffViewModeControl`，正常宽度渲染两个相邻
  `ToolbarButton`：
  - `unified` 图标，`aria-label = Unified view`；
  - `split` 图标，`aria-label = Side-by-side view`；
  - 两者用 `aria-pressed` 表达真实模式；
- 新增 `diffViewModeControlForWidth()`：
  - `>= 280px` 使用双按钮；
  - `< 280px` 退化为单按钮，避免固定控件把 Close 挤出；
- 模式控制作为 `data-dsh-diff-fixed` 控件参与工具栏宽度测量；
- 新增 IDEA 风格的 unified 图标；
- side-by-side / unified 偏好仍写 `dsh-editor.diff.sideBySide`。

**验证**：

- RED：`tests/round463.test.mjs` = **0 pass / 3 fail**；
- 更新 round197/365/382/441/444 的旧单按钮契约；
- 全量：`npm test` = **1501 pass / 0 fail**；
- 隔离 DSH Web 255px 工具栏：
  - 自动退化为单按钮；
  - 点击后 label 从 `统一视图` 变为 `并排视图`，
    localStorage 从 `1` 变为 `0`；
  - Close right `773`，toolbar right `777`，未被裁切；
- 隔离 DSH Web 512px 工具栏：
  - 两个按钮同时显示；
  - `统一视图 pressed=true`、`并排视图 pressed=false`；
  - mode switch right `918`，Close right `1030`，
    toolbar right `1034`，未被裁切；
- 截图：
  `/private/tmp/dsh-editor-r463-paired-mode-final.png`、
  `/private/tmp/dsh-editor-r463-paired-wide-final.png`；
- `node --check lib/client.js` 与 `git diff --check` 通过。

**下一轮计划**：

1. 对照 IDEA diff 顶部的 Previous / Next Difference 边界 disabled；
2. 检查文件导航 `n / total files` 的完整文案与窄宽降级；
3. 复核模式按钮在 280px 展开时的实际 Rect 与溢出；
4. 保持 1501+ 全量回归并同步文档。

## 2026-11-15 — Monaco Canceled Promise 不再作为未处理异常输出

**作用域**：Editor / Diff 的 Monaco dispose、restoreViewState、
`unhandledrejection` 诊断。

**症状/原始错误**：

```text
Canceled: Canceled
    at i.cancel (.../monaco/vs/editor/editor.main.js:122:13889)
    at i.dispose (.../monaco/vs/editor/editor.main.js:122:14018)
    at P.dispose (.../monaco/vs/editor/editor.main.js:722:24461)
```

打开 Editor 或销毁/恢复 diff 时，控制台出现
`Uncaught (in promise) Canceled: Canceled`，同时诊断被记为
`unhandled-rejection`。

**根因**：

- 该 rejection 由 Monaco 内部在 view/model 被 dispose 或 restore view state
  时产生；此时原 Promise owner 已不存在，属于预期的取消，不是编辑器功能失败；
- 旧处理只匹配 `Canceled: Canceled + editor.main.js` 后跳过日志写入，
  但没有调用 `event.preventDefault()`，浏览器仍会打印
  `Uncaught (in promise)`；
- 归档中的真实 stack 明确落在
  `api/dsh-editor/monaco/vs/editor/editor.main.js`，不是业务异常。

**修复**：

- 新增 `isMonacoCancellation(reason, stack)`；
- 仅当 stack 含 `monaco/vs/editor/editor.main.js`，message 为
  `Canceled` / `Canceled: Canceled` 或 name 为
  `Canceled` / `CanceledError`，且不是 `TypeError` 等错误类型时返回 true；
- `onUnhandledRejection` 命中后先 `event.preventDefault()` 再返回，
  不写诊断、不进入 `console.error`；
- 其他 `unhandledrejection` 行为不变，仍记录 reason、stack 和最近动作。

**回归测试**：

- `tests/round462.test.mjs`：
  - 使用归档中的真实 Monaco stack 验证识别；
  - TypeError 和非 Monaco 同名错误不被误吞；
  - handler 必须先 `preventDefault()` 后 `return`；
- 更新 `tests/round460.test.mjs`：Monaco cancellation 应被消费而不是记录。

**验证**：

- RED：`tests/round462.test.mjs` = **0 pass / 2 fail**；
- 定向：`round462 + round460 + round457` = **9 pass / 0 fail**；
- 全量：`npm test` = **1498 pass / 0 fail**；
- `node --check lib/client.js`、`lib/index.js`、`lib/terminal.js`
  与 `git diff --check` 通过；
- 隔离 DSH Web 中构造真实形态 rejection，结果为
  `defaultPrevented=true`、stack 含 `monaco/vs/editor/editor.main.js`；
- 隔离 home 诊断文件没有新增 `unhandled-rejection`；
- 截图：`/private/tmp/dsh-editor-r462-monaco-cancel.png`。

## 2026-11-15 — Editor 空白根因闭环：稳定 mainPanel 宿主替代 watchdog 重建

**作用域**：Editor React host 生命周期、Chat body 重渲染、
workspace/session 切换、`Project / Commit / Terminal / Harness` 工具窗。

**症状与原始证据**：

- 从左侧工作区菜单打开 Editor 后，工具窗会周期性整体变空，Chat 仍正常；
- 归档日志
  `/Users/chan/.dsh/logs/dsh-editor-diagnostics.jsonl.r460-real-repro-20261115-212055`
  共记录 11 次 `host-unhealthy`、11 次 `host-rebuild`、11 次
  `host-recovered`；
- 故障间隔约 5–13 秒，`recentActions=[]`，期间没有用户操作；
- 现场为 `active=true`、`bodyActive=true`，但
  `hostConnected=false`、`workspace/stripe=false`。

**根因**：

- Editor host 直接挂在 `[data-conversation-region="chat"]` 下；
- 该 Chat body 会随会话、View 和宿主布局更新被 React 替换；
- 替换会连同外部注入的 host 一起移除，700ms watchDog 只能事后
  销毁并重建整个 React root，因此表现为周期性空白和状态丢失；
- 首次 commit 空壳判断、激活重试和健康检查都只是修补症状，
  不是可靠的宿主集成方式。

**最终修复**：

- `findHostParent()` 从 `[data-slot="main.conversation"]` 向上寻找
  第一个 `display != contents` 且有真实尺寸的稳定布局祖先；
  当前 DSH 版本稳定落在 `.PIRFFq_mainPanel`；
- Editor host 使用 `position: fixed`，按 live Chat body 的
  `getBoundingClientRect()` 写入 left/top/width/height；
- `ResizeObserver` 只跟踪尺寸和布局变化，不拥有 React root；
- Chat body 仍负责 `data-dsh-editor-active`、拖动柄、滚轮和
  jump badge，但不再承载 Editor；
- 会话 body 替换时保留同一个 host/root，Project、Commit、
  Terminal 与 Monaco/xterm 状态不丢失；
- 删除 `recoverUnhealthyEditorHost`、700ms interval、
  `hostHealthFailures`、`hostRecoveryPending`、空壳重建、
  激活 rAF 重试和 `hostMountGeneration/Pending/Frame`；
- 保留错误边界与真实运行错误日志，日志 action ring 改作
  `react-render-error / window-error / unhandled-rejection` 的上下文。

**回归测试**：

- `tests/round461.test.mjs`：稳定 parent、fixed 几何、
  Chat chrome 边界、旧 watchdog/空壳/重试彻底移除；
- 更新 round167/451/456/457/458/460/83/plugin-contract，
  移除与新架构冲突的旧断言；
- 运行：

```bash
node --test tests/round461.test.mjs tests/round460.test.mjs \
  tests/round458.test.mjs tests/round457.test.mjs \
  tests/round456.test.mjs tests/round451.test.mjs \
  tests/round167.test.mjs tests/round83.test.mjs \
  tests/plugin-contract.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
node --check lib/terminal.js
git diff --check
```

**运行态验证**：

- 隔离 DSH Web（`/tmp/dsh-editor-r456-home-20261115-205936`，
  `127.0.0.1:63096`）从 hero 打开 Editor；
- host parent=`PIRFFq_mainPanel`，`position=fixed`；
  host 矩形 `280,40,497.59375,617` 与 Chat body 左侧编辑区一致；
- 连续 3 轮切换 `Commit → Terminal → Project → Harness →
  Harness` 并等待 12 秒，host probe、React workspace 和
  parent probe 均未变化；
- 在 `dsh-editor` 工作区新建会话后，Chat body probe 消失并出现
  新 body，证明 React 确实替换了 body；Editor host probe、
  parent probe、workspace 仍存在，Project 已切到 `dsh-editor`；
- 隔离 home 的 diagnostics 在本次运行期间没有新增
  `host-unhealthy` 或 `window-error`；
- 截图：`/private/tmp/dsh-editor-r461-stable-after-20s.png`。

**门禁结果**：`npm test` = **1496 pass / 0 fail**；
`node --check lib/client.js / lib/index.js / lib/terminal.js`
与 `git diff --check` 均通过。

## 2026-11-15 — DSH 稳定会话锚点验证

**作用域**：Editor host 最终架构、`main.conversation` slot、
conversation body 重渲染与诊断期 DOM 修补替换。

**运行态证据**：

- 克隆真实会话中标记 `[data-slot="main.conversation"]`；
- 完成对话/轨迹 View 切换、工作区菜单开关、新建空会话、
  返回原会话后，标记仍在同一节点；
- slot wrapper 为 `display:contents`、0×0；
- 其上级 `.PIRFFq_mainPanel` 为真实 764×657 flex 布局节点，
  当前 `position:static`；
- 向 slot wrapper 和 mainPanel 分别插入外部探针节点；
- 完成同样操作后探针均存在，mainPanel 子节点数保持 2。

**设计结论**：

- `data-conversation-region="chat"` 的 `kiGsTW_body` 会随会话/View
  重渲染，当前 direct injection 生命周期天然脆弱；
- `main.conversation` slot / mainPanel 比 conversation body 稳定；
- 最终应把 Editor host 放到 mainPanel 或独立 body portal layer，
  并根据 conversation body 的实时 rect 更新 fixed overlay；
- mainPanel 目前无定位上下文，直接加 `position:relative`
  可能影响宿主既有绝对定位子节点，需先验证 fixed overlay；
- 本轮只取证，不改实现；等真实空白日志后迁移并移除 watchdog、
  direct conversation-body injection 和重复 MutationObserver 修补。

## 2026-11-15 — 工作区激活与聊天 body 的挂载竞态

**作用域**：工作区菜单 `... → Editor`、`setActive(true)`、
聊天 body 挂载、Editor 初始 watchdog 宽限。

**真实日志证据**：

- 重启实际 Harness 后从工作区菜单打开 Editor；
- `dsh-editor-diagnostics.jsonl` 记录：
  - `active=true`
  - `splitWanted=true`
  - `bodyActive=true`
  - `hostConnected=false`
  - `hostChildCount=0`
  - `workspaceExists=false`
  - `stripeExists=false`
- 原 `setActive(true)` 在 `findBody() === null` 时只调用
  `destroyHost()` 后返回；
- 如果随后没有新的 DOM mutation，`sync()` 不会再运行，
  Editor 会一直缺失，而 split 宽度和右侧 Chat 仍保留。

**修复**：

- 激活时找不到聊天 body，不再直接放弃；
- `scheduleActiveMountRetry()` 使用有界
  `requestAnimationFrame`，最多 120 帧等待 body；
- body 出现后重新应用聊天宽度并调用统一 `sync()`；
- 关闭 Editor、切换 View、插件卸载时取消待执行重试；
- `editorActivatedAt` 提供 2.5 秒首次挂载宽限期，
  watchdog 不把正常的 body 挂载过渡误报为 unhealthy；
- Activity Stripe 增加 `data-dsh-editor-activity-stripe`
  供健康检查与日志使用。

**验证**：

```bash
node --test tests/round458.test.mjs tests/round457.test.mjs \
  tests/round456.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
git diff --check
```

- RED：`tests/round458.test.mjs` 初始 **0 pass / 3 fail**；
- 定向与相邻回归：**13 pass / 0 fail**；
- 全量：`npm test` = **1489 pass / 0 fail**；
- 实际 Harness 刷新到最新 client 后从项目右键 Editor 打开；
- 等待 8 秒，Activity Stripe、Project 树和工具窗正常；
- 修复前同路径立即产生 unhealthy/rebuild；
- 修复后活动诊断文件保持 0 条新增事件，没有初开误报；
- 旧日志保留为
  `dsh-editor-diagnostics.jsonl.pre-r458-*`，活动文件已清空。

**设计债务**：

- 本次修复锁定了一个真实竞态，但 watchdog 和 DOM 修补仍是
  临时保护层；
- 根因日志完整后应转向稳定宿主 slot / portal，
  并删除重复的 DOM/MutationObserver 修补；
- 后续真实复现优先读取活动 JSONL，不再盲目叠加新 watchdog。

## 2026-11-15 — Editor 空白诊断日志

**作用域**：Editor host watchdog、React 错误边界、窗口级异常和
宿主 JSONL 诊断文件。

**背景**：

- Editor 仍可能在随机交互后进入“分屏启用但左侧宿主失效”的空白态；
- 单靠现场截图无法区分 host 被移除、React 子树为空、CSS 隐藏
  或尺寸归零；
- 用户要求保留可持久化日志，后续复现时直接按日志定位；
- 日志必须排除聊天正文、文件内容和 DOM 文案。

**实现**：

- 宿主新增 `POST /api/dsh-editor/diagnostics`；
- 写入 `$DSH_HOME/logs/dsh-editor-diagnostics.jsonl`，
  无 DSH_HOME 时回退 `~/.dsh/logs/dsh-editor-diagnostics.jsonl`；
- 客户端 `reportEditorDiagnostic()` 记录稳定事件名、时间、序号、
  技术状态，并以 best-effort fetch 上报；
- 客户端内存 ring 最多 50 条；
- 宿主单请求上限 64 KiB、每批最多 20 条；
- details 超过 8 KiB 时截断为 preview；
- 事件：
  - `host-unhealthy`
  - `host-rebuild`
  - `host-recovered`
  - `react-render-error`
  - `window-error`
  - `unhandled-rejection`
- 忽略高频无害的
  `ResizeObserver loop completed with undelivered notifications`。

**记录字段**：

- active、splitWanted、bodyActive、bodyChildCount；
- chatWidthValue、harnessCollapsed；
- hostConnected、hostParentIsBody、hostChildCount、hostIdle；
- hostWidth、hostHeight、hostDisplay、hostVisibility；
- hostTextLength、hostGeneration、hostMountPending；
- workspaceExists、stripeExists、activity；
- window error 的 message/stack，React error 的 componentStack。

不记录聊天文本、文件正文、HTML 或请求内容。

**验证**：

```bash
node --test tests/round457.test.mjs tests/round456.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
git diff --check
```

- RED：`tests/round457.test.mjs` 初始 **0 pass / 3 fail**；
- 目标与相邻回归：**14 pass / 0 fail**；
- 全量：`npm test` = **1486 pass / 0 fail**；
- 克隆真实“问候”会话运行态：
  - 主动将 host 设为 `visibility:hidden`；
  - 依次写入 `host-unhealthy → host-rebuild → host-recovered`；
  - host 最终恢复为 visible、1 个子节点，Stripe/workspace 均存在；
- JSONL 文件实际写出 6 条测试事件，字段完整且不含正文。

**设计债务**：

- 当前 watchdog、DOM 注入和 MutationObserver 是抓现场用的临时保护；
- 根因确认后需要移除重复修补，改用稳定的宿主 slot/portal；
- 在真实复现日志拿到前，不再继续叠加新的补丁层。

**后续**：

- 等待用户再次触发空白后读取该 JSONL；
- 根据 unhealthy 时的 body/host/workspace/stripe/generation 组合
  定位是哪一层被移除或隐藏；
- 完成根因修复后删除不必要的 watchdog 和 DOM 修补。

## 2026-11-15 — Changes 视图与组级菜单展开语义

**作用域**：Commit Changes 的 `View Options`、三个 Changes 组的
`More actions for …`、CompactActionBar popup 元数据和组菜单 owner。

**运行态证据**：

- `View Options` 能打开真实 `role=menu`，但按钮没有
  `aria-haspopup` / `aria-expanded`；
- 200px Changes 面板中 Staged / Unstaged / Unversioned Files
  三个 `More actions` 都会打开组级菜单，按钮同样缺少语义；
- 这两类入口都是实际弹出菜单，不是普通命令。

**修复**：

- 全局菜单 owner 增加 `changes-view-options`；
- CommitPanel 接收 `viewOptionsOpen`；
- CompactActionBar 将 action 的
  `ariaHasPopup / ariaExpanded` 透传给直接按钮；
- 组菜单 owner 使用 `group-actions:<group-id>`；
- 组级 More actions 直接绑定
  `groupActionMenu?.owner === \`group-actions:${group.id}\``；
- 不改菜单动作、disabled、分组、位置或视觉。

**no-commit 首开验证**：

- 临时工作区 HEAD 为 unborn；
- `README.md` 已暂存，`note.txt` 未纳入版本控制；
- 从 `... → Editor` 打开后每秒采样，连续 10 秒：
  - `hostConnected=true`；
  - `hostChildren=1`；
  - `workspaceConnected=true`；
  - `workspaceId=r455-workspace`；
- 页面 `error` 与 `unhandledrejection` 均为 0；
- Project 正确显示该 no-commit 工作区，而不是空 `Workspace`。

**回归**：

```bash
node --test tests/round455.test.mjs tests/round454.test.mjs \
  tests/round453.test.mjs tests/round250.test.mjs
npm test
node --check lib/client.js
git diff --check
```

- RED：`tests/round455.test.mjs` 初始 **0 pass / 3 fail**；
- 目标与相邻回归：**9 pass / 0 fail**；
- 受影响组菜单回归：**8 pass / 0 fail**；
- 全量：`npm test` = **1480 pass / 0 fail**；
- Changes 200px 运行态：
  - View Options：`aria-haspopup=menu`，
    false → true（菜单打开）→ false（Esc）；
  - 三个组按钮都暴露 `aria-haspopup=menu / aria-expanded=false`；
  - Staged More actions：false → true → false；
  - 菜单内容、组分组和动作顺序不变。

**适用边界**：

- `group-actions:<id>` 只绑定当前打开的组，不共享 expanded；
- View Options owner 只服务 Changes 视图菜单；
- CompactActionBar 的临时 overflow 项不伪造 popup 状态，
  状态属于稳定可见的直接按钮。

**下一步**：

- 对照 IDEA Project / Commit 工具栏 tooltip 快捷键格式；
- 检查 Project 视图菜单与 branch popup 的键盘初始焦点；
- 验证一个组菜单打开后切换另一组时旧菜单关闭；
- 保持 1480+ 全量回归。

## 2026-11-15 — Project 视图与分支下拉展开语义

**作用域**：Project 视图选择器、Commit 分支 chip、
`PanelToolbar` 的 badge popup 元数据、分支菜单 owner。

**运行态证据**：

- Project 视图按钮已有 `aria-haspopup=menu`，但缺少
  `aria-expanded`；
- Commit 分支 chip 会打开真实 `role=menu`，但修复前没有
  `aria-haspopup` / `aria-expanded`；
- 两者都是工具窗内的实际弹出菜单，和 Options 一样需要
  可感知的展开状态。

**修复**：

- Project 视图按钮使用本地状态：
  `'aria-expanded': viewMenu !== null`；
- `PanelToolbar` 新增可选
  `badgeHasPopup / badgeExpanded`，只用于带 `onBadge` 的按钮；
- 分支菜单打开时写入 owner `branch-menu`；
- CommitPanel 接收 `branchMenuOpen`，并透传给 badge；
- 静态 branch badge 不声明 popup/expanded；
- 不修改分支列表、checkout、当前分支检查或菜单内容。

**回归**：

```bash
node --test tests/round454.test.mjs tests/round453.test.mjs \
  tests/round452.test.mjs tests/round20.test.mjs
npm test
node --check lib/client.js
git diff --check
```

- RED：`tests/round454.test.mjs` 初始 **0 pass / 3 fail**；
- 目标与相邻回归：**8 pass / 0 fail**；
- 补跑 `round20` 后相关回归：**13 pass / 0 fail**；
- 全量：`npm test` = **1477 pass / 0 fail**；
- Project 视图运行态：
  - false → true（菜单打开）→ false（Esc）；
- Commit 分支 chip 运行态：
  - `aria-haspopup=menu`；
  - false → true（分支菜单打开）→ false（Esc）；
- 分支 chip 的可见文本、当前分支 checkmark 和 checkout 行为不变。

**适用边界**：

- badge 只有传入 `onBadge` 时才是 popup；
- `badgeHasPopup === undefined` 时 React 不输出 popup/expanded；
- owner 只用于 UI 状态，不进入菜单动作。

**下一步**：

- 继续完成 no-commit 隔离工作区首开等待验证；
- 对照 IDEA Project / Commit 工具栏 tooltip 的快捷键格式；
- 检查 Commit `View Options` 与 Changes 组级 `More actions`
  的 popup/expanded 语义；
- 保持 1477+ 全量回归。

## 2026-11-15 — 工具窗 Options 菜单展开语义

**作用域**：Project 直接 `Options`、Commit 顶部直接 `Options`、
共用的 `PanelToolbar` 动作按钮和全局 ContextMenu owner。

**运行态证据**：

- Project `选项` 能打开真实 `role=menu`；
- 修复前按钮没有 `aria-haspopup`，打开菜单后也没有
  `aria-expanded=true`；
- Commit 的溢出 `More actions` 已有
  `aria-haspopup=menu / aria-expanded=false`；
- Commit 拓宽到 416px 后直接 `Options` 同样缺失 popup/expanded；
- Project Options 内部 `行为 / 外观` 子菜单的 role 与
  expanded 状态本身正确。

**修复**：

- 全局菜单对象增加 owner：
  `project-options` / `commit-options`；
- Project、Commit 的 Options action 声明
  `ariaHasPopup: 'menu'` 与 `ariaExpanded: optionsOpen === true`；
- `PanelToolbar.renderAction` 把 action 的
  `ariaHasPopup / ariaExpanded` 透传给 `ToolbarButton`；
- ProjectPanel 和 CommitPanel 根据
  `menu?.owner` 计算 `optionsOpen`；
- 不改菜单动作、顺序、位置、disabled 或视觉样式。

**回归**：

```bash
node --test tests/round453.test.mjs tests/round452.test.mjs
npm test
node --check lib/client.js
git diff --check
```

- RED：`tests/round453.test.mjs` 初始 **0 pass / 3 fail**；
- 目标与相邻回归：**5 pass / 0 fail**；
- 全量：`npm test` = **1474 pass / 0 fail**；
- Project Options 运行态：
  - 打开前 `aria-haspopup=menu / aria-expanded=false`；
  - 打开后 `aria-expanded=true`；
  - Esc 后恢复 false；
- Commit 416px 运行态：
  - 直接 `Options` 按钮出现；
  - 同样完成 false → true → false 的 expanded 闭环；
- owner 只用于识别菜单来源，不会被渲染成 DOM 属性。

**适用边界**：

- 本轮只处理 Project/Commit 的 Options；Project 视图下拉、
  Commit 分支 chip、Changes `View Options` 仍使用各自状态；
- `aria-expanded` 只对实际打开菜单的直接按钮为 true；
- Options 被收进 `»` 时仍从同一 action 回调打开，
  但 expanded 语义属于直接按钮，不给临时溢出项伪造状态。

**下一步**：

- 继续完成 no-commit 工作区首开等待验证；
- 核对 IDEA Project / Commit 工具栏 tooltip 的快捷键格式；
- 检查 Project 视图下拉与 Commit 分支 chip 的
  `aria-haspopup/expanded`；
- 保持 1474+ 全量回归。

## 2026-11-15 — 菜单可访问名称与快捷键分离

**作用域**：Project / Commit / Diff / Terminal 共用的 ContextMenu，
顶层与子菜单动作的可访问名称、role、快捷键和子菜单语义。

**IDEA 对照与问题证据**：

- IDEA Project 工具栏顺序为
  `New File or Directory… / Select Opened File / Expand Selected /
  Collapse All / Options / Hide`；
- DSH 260px 工具窗仍按既有优先级直接保留后四项，
  `New / Select Opened` 按原顺序进入 `»`；
- DSH 301px 时六项全部直接恢复；
- Commit 模板行等效 90% 缩放时宽 259.75px，125% 时宽 184px，
  两种宽度下 8 个 chip 都保持单行、铺满且无裁切；
- Commit Change 菜单运行态名称原先为
  `回滚更改›`、`显示差异⌘D`、`取消暂存所选⌥⌘A`；
- 名称把可见快捷键和子菜单箭头拼进 accessible name，
  又与 `aria-keyshortcuts` 重复，屏幕阅读器缺少干净的动作名。

**修复**：

- ContextMenu 顶层按钮增加 `aria-label: item.label`；
- 子菜单按钮增加 `aria-label: child.label`；
- 可见 shortcut、`›`、`aria-keyshortcuts`、`aria-haspopup`、
  `aria-expanded`、`role=menuitem/menuitemcheckbox`、`aria-checked`
  和 disabled 全部保留；
- 不修改动作顺序、回调、菜单布局或视觉样式。

**回归**：

```bash
node --test tests/round452.test.mjs tests/round448.test.mjs \
  tests/round449.test.mjs tests/round450.test.mjs \
  tests/round451.test.mjs
npm test
node --check lib/client.js
git diff --check
```

- RED：`tests/round452.test.mjs` 初始 **1 pass / 1 fail**；
- 目标与相邻回归：**9 pass / 0 fail**；
- 全量：`npm test` = **1471 pass / 0 fail**；
- 运行态 Change 菜单：
  - `aria-label=回滚更改`，`aria-haspopup=menu`；
  - `aria-label=显示差异`，`aria-keyshortcuts=Meta+D Control+D`；
  - `aria-label=取消暂存所选`，
    `aria-keyshortcuts=Alt+Meta+A Control+Alt+A`；
  - 可见文本仍是 `显示差异⌘D / 取消暂存所选⌥⌘A`；
- Project 文件菜单同理：
  - `新建文件` + `Alt+Meta+N Control+Alt+N`；
  - `重命名` + `Shift+F6`；
  - `移动到…` + `F6`；
- Rollback 子菜单项名称为
  `丢弃暂存版本（保留工作区改动）`，不再混入 `›`。

**适用边界**：

- `aria-label` 只提供动作语义，不替代可见快捷键；
- `aria-keyshortcuts` 仍是辅助技术读取快捷键的唯一标准来源；
- 切换类动作继续由 `active` 决定 `menuitemcheckbox` 与
  `aria-checked`，普通命令仍是 `menuitem`。

**下一步**：

- 使用 no-commit 隔离工作区复核 `... → Editor` 首开后等待 10 秒；
- 核对 Project Options 与 Commit 顶部 Options/More actions
  弹出菜单的 name/role/expanded；
- 检查 IDEA Project / Commit 工具栏 tooltip 的快捷键格式；
- 保持 1471+ 全量回归。

## 2026-11-15 — 工作区菜单打开 Editor 后随机空白

**作用域**：工作区 `... → Editor` 入口、Editor React root 生命周期、
EditorWorkspace 渲染异常、右侧 Chat 隔离。

**症状**：

- 从左侧会话列表的项目行右键选择 `Editor`；
- 数秒后或连续切换 Harness、工具窗口、hero Editor 按钮后，
  左侧 Editor 整个区域变空白；
- 右侧宿主 Chat 仍正常，说明 DSH 页面本身没有整体卸载。

**运行态证据**：

- 隔离 DSH Web（profile `editor-test`、端口 `63113`）从工作区菜单打开；
- 连续执行 README、Commit、Project、Harness 和 20 次快速 Editor 开关；
- MutationObserver 直接记录到宿主节点仍 connected、但
  `childElementCount: 0` 且 `[data-dsh-editor-workspace]` 消失；
- 修复后的挂载守卫在随后 3ms 内重建出完整 Project/编辑器树；
- 页面无 `error` / `unhandledrejection`，Chat 始终保留。

**根因**：

- React 18 `createRoot().render()` 到首次 commit 之间存在宿主合法为
  0 子节点的窗口；
- DSH 的对话区和注入 DOM 会持续触发 MutationObserver；
- 原 `ensureHost()` 只以 `childElementCount > 0` 判断 root 可用，
  可能把刚创建、尚在挂载中的 root 当成 stale shell 卸载；
- 工作台自身也没有局部错误边界，任何渲染异常都会卸载整棵
  EditorWorkspace，而 Chat 由宿主独立渲染，所以只剩右侧面板。

**修复**：

- 新增 `hostMountPending`、`hostMountGeneration`、`hostMountFrame`；
- React 初始 commit 前直接复用挂载中的 host，不执行
  `root.unmount()`；
- 等待两个 animation frame 后仍为 0 子节点才判定 root 真正损坏并重建；
- `destroyHost()` 取消待执行 frame 并使旧 generation 失效；
- 新增 `EditorErrorBoundary`，只包裹 EditorWorkspace；
- 渲染异常时显示 `编辑器加载失败`、错误摘要和
  `重新加载编辑器`，Chat 不进入错误边界；
- 切换 workspace 时错误边界自动清除旧错误并重试。

**回归**：

```bash
node --test tests/round451.test.mjs tests/round167.test.mjs \
  tests/static-order.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
git diff --check
```

- RED：`tests/round451.test.mjs` 初始 **0 pass / 3 fail**；
- 目标与相邻回归：**13 pass / 0 fail**；
- 全量：`npm test` = **1469 pass / 0 fail**；
- 运行态压力：快速开关 Editor 20 次、Harness 收起/展开、
  Commit/Project 切换、打开 README、连续切换侧栏；
- 最终 Editor host 为 1 个子节点、workspace 可见，错误与 Promise
  rejection 均为 0；
- 实际 desktop Harness 刷新后从 `dsh-editor` 工作区菜单打开，
  等待 8 秒仍保持 Project 文件树和代码区结构。

**适用边界**：

- 该守卫只改变注入 root 的“空壳”判定，不改变 Editor 关闭时
  `idleHost()` 保活策略；
- 错误边界只承担可见恢复，不吞掉错误；`componentDidCatch` 仍输出
  `dsh-editor: workspace render failed` 方便后续定位；
- 渲染错误恢复按钮会重建 EditorWorkspace 子树，右侧 Chat 和
  Project/Commit 的后端接口不受影响。

**下一步**：

- 用 no-commit 工作区补一次右键 Editor 的运行态回归；
- 继续 Project 260–300px 动作恢复顺序与 90%/125% 缩放验证；
- 检查 Commit/Project 其余菜单的 name/role 一致性；
- 保持 1469+ 全量回归。

## 2026-11-15 — Commit Change 行菜单快捷键语义

**作用域**：Commit Changes 文件行右键菜单，
Rollback Working / Show Diff / Stage/Unstage 的
`aria-keyshortcuts`。

**问题证据**：

- 菜单已有可见快捷键：`⌥⌘Z`、`⌘D`、`⌥⌘A`、`⌘⇧A`；
- ContextMenu 已支持 `ariaKeyShortcuts`，但 Change 菜单没有填充；
- 屏幕阅读器只能读到符号，无法获得标准键位表达。

**修复**：

- Rollback Working：
  `Alt+Meta+Z Control+Alt+Z`；
- Show Diff：
  `Meta+D Control+D`；
- Unstage：
  `Alt+Meta+A Control+Alt+A`；
- Stage：
  `Meta+Shift+A Control+Shift+A`；
- removalOnly 的删除未跟踪文件动作不伪造快捷键；
- 可见文本、disabled、菜单分组不变。

**回归**：

- 新增 `tests/round450.test.mjs`；
- RED：**0 pass / 1 fail**；
- 目标与相邻回归：**8 pass / 0 fail**；
- 全量：`npm test` = **1465 pass / 0 fail**。

**运行态验证**：

- 隔离 DSH Web（profile `editor-test`、端口 63113）；
- 右键 README.md Change 行；
- Show Diff 输出 `Meta+D Control+D`；
- Stage/Unstage 项输出对应组合；
- Rollback 子菜单按 staged/working 状态显示正确子项；
- 其余菜单项 role、disabled 和分组保持。

**下一步**：

- 运行态验证 Project 260–300px 动作恢复顺序；
- 验证模板行在 90%/125% 浏览器缩放下的单行稳定性；
- 检查其余 Commit 行菜单动作的 name/role；
- 保持 1465+ 全量回归并同步 README / engineering-memory / 计划。

## 2026-11-15 — Project 树上下文菜单快捷键语义

**作用域**：Project 文件/目录右键菜单，
New/Rename/Move/Delete/Open/Refresh 的 `aria-keyshortcuts`。

**问题证据**：

- 菜单 item 已有可见 shortcut 文本；
- 但 ContextMenu item 没有 `ariaKeyShortcuts`，
  屏幕阅读器只能朗读快捷键字符，无法得到标准键位表达；
- 同一轮已让 ContextMenu 支持顶层/子菜单的 `aria-keyshortcuts`。

**修复**：

- New：`Alt+Meta+N Control+Alt+N`；
- Rename：`Shift+F6`；
- Move：`F6`；
- Delete：`Backspace`；
- 文件 Open：`F4`，目录 Open 保持无快捷键；
- Refresh：`Meta+R Control+R`；
- 可见 shortcut、disabled 与菜单执行逻辑不变。

**回归**：

- 新增 `tests/round449.test.mjs`；
- RED：**0 pass / 1 fail**；
- 目标与相邻回归：**7 pass / 0 fail**；
- 全量：`npm test` = **1464 pass / 0 fail**。

**运行态验证**：

- 隔离 DSH Web（profile `editor-test`、端口 63113）；
- 右键 README.md 行；
- New/Rename/Move/Delete/Open/Refresh 均输出预期
  `aria-keyshortcuts`；
- `定位当前文件` 仍 disabled；
- 目录专用 stage/unstage 继续保持 disabled。

**下一步**：

- 运行态验证 Project 260–300px 动作恢复顺序；
- 验证模板行在 90%/125% 浏览器缩放下的单行稳定性；
- 检查其余 Commit Change 行菜单快捷键语义；
- 保持 1464+ 全量回归并同步 README / engineering-memory / 计划。

## 2026-11-15 — Commit 模板按钮铺满整行

**作用域**：Commit 提交信息模板 buttons 的 flex 布局。

**用户反馈**：

- “紧凑”不是把 8 个按钮挤在左侧；
- 正确效果是按整条可用宽度自动铺满。

**修复**：

- template chip 从 `flex: 0 1 auto` 改为 `flex: 1 1 auto`；
- 保留 `minWidth: 0`，文字仍决定基础宽度；
- `justifyContent: center` 与 `textAlign: center` 让扩展出的空间
  均匀留在文字两侧；
- 字号 clamp、nowrap、hover/focus 保持不变。

**回归**：

- 新增 `tests/round448.test.mjs`；
- 同步 round442 的 chip flex 契约；
- RED：**0 pass / 1 fail**；
- 目标与相邻回归：**10 pass / 0 fail**；
- 全量：`npm test` = **1463 pass / 0 fail**。

**运行态验证**：

- 200px Commit，模板 row 宽 184px；
- row 内容区 left=327、right=507；
- 第一个 chip left=327，最后一个 chip right=507；
- 8 个 chip 使用完整内容宽度，间隔 2px；
- 所有 chip 顶边相同且 `scrollWidth <= clientWidth`。

**下一步**：

- 验证模板行 90%/125% 浏览器缩放；
- 运行态验证 Project 260–300px 动作恢复；
- 检查 Project 树上下文动作 name/role；
- 保持 1463+ 全量回归并同步 README / engineering-memory / 计划。

## 2026-11-15 — 工具栏 overflow 保留快捷键元数据

**作用域**：PanelToolbar / CompactActionBar / ContextMenu、
Project Select Opened File 在 `»` 中的快捷键语义。

**问题证据**：

- 直接工具栏已经输出 `aria-keyshortcuts`；
- 动作进入 `»` 后，menu item builder 只保留 label/active/disabled，
  `Alt+F1 1` metadata 丢失；
- 200px Project 工具窗中 Select Opened File 正位于 overflow。

**修复**：

- PanelToolbar overflow item 透传 `ariaKeyShortcuts`；
- CompactActionBar 的可见/隐藏动作都透传；
- ContextMenu 顶层与子菜单 button 输出
  `aria-keyshortcuts`；
- 原有禁用与标签文案保持不变。

**回归**：

- 新增 `tests/round447.test.mjs`；
- RED：**0 pass / 2 fail**；
- 目标与相邻回归：**17 pass / 0 fail**；
- 全量：`npm test` = **1462 pass / 0 fail**。

**运行态验证**：

- 隔离 DSH Web（profile `editor-test`、端口 63113、200px Project）；
- `»` 菜单中：
  - `新建文件或目录…` enabled；
  - `定位当前文件 (⌥F1, 1)` disabled=true，
    `aria-keyshortcuts="Alt+F1 1"`；
  - `展开所选` disabled=true；
- 快捷键元数据不再因动作移入 overflow 而丢失。

**下一步**：

- 运行态验证 Project 260–300px 的动作恢复顺序；
- 验证模板行在 90%/125% 浏览器缩放下的单行稳定性；
- 检查 Project 树上下文动作的 name/role；
- 保持 1462+ 全量回归并同步 README / engineering-memory / 计划。

## 2026-11-15 — Project Select Opened File 快捷键语义

**作用域**：Project 工具栏 `Select Opened File`、
`aria-keyshortcuts`、disabled 状态。

**IDEA 对照**：

- IDEA Project Tool Window 显示 `Select Opened File (⌥F1, 1)`；
- 没有活动编辑器文件时该动作 disabled；
- 快捷键是两段式 `Alt+F1` 后 `1`，不是单组合键。

**修复**：

- ToolbarButton 新增可选 `ariaKeyShortcuts`；
- PanelToolbar 将 action 的 `ariaKeyShortcuts` 透传到真实 button；
- Project reveal 动作声明 `aria-keyshortcuts="Alt+F1 1"`；
- disabled 条件继续使用 `hasActiveFile !== true`；
- 标签文字仍包含 IDEA 的 `(⌥F1, 1)` 提示。

**回归**：

- 新增 `tests/round446.test.mjs`；
- 同步 round177、round328 的多行 action 契约；
- RED：**0 pass / 2 fail**；
- 目标与相邻回归：**16 pass / 0 fail**；
- 全量：`npm test` = **1460 pass / 0 fail**。

**运行态验证**：

- 隔离 DSH Web（profile `editor-test`、端口 63113）；
- Project toolbar 临时扩到 610px；
- `定位当前文件 (⌥F1, 1)`：
  - disabled=true（当前没有活动文件）；
  - `aria-keyshortcuts="Alt+F1 1"`；
- New 仍为 `新建文件或目录…`；
- 后续 Expand/Collapse/Options/Hide 顺序保持。

**下一步**：

- 运行态验证 Project 260–300px 的动作恢复顺序；
- 验证模板行在 90%/125% 浏览器缩放下的单行稳定性；
- 检查 Project 树其余上下文动作的 name/role；
- 保持 1460+ 全量回归并同步 README / engineering-memory / 计划。

## 2026-11-15 — IDEA Project New 动作组合命名

**作用域**：Project 主工具栏 New 动作、双语字典、直接 tooltip/ARIA。

**IDEA 对照**：

- Computer Use 读取本机 IDEA Project Tool Window；
- IDEA 直接工具栏首项为 `New File or Directory…`，
  不是两个并列动作 `New File / New Folder`；
- 后续顺序为 `Select Opened File / Expand Selected / Collapse All /
  Options / Hide`。

**修复**：

- 新增双语 `newFileOrDirectory`；
- 中文 `新建文件或目录…`，英文 `New File or Directory…`；
- Project `newEntry` 的 label 改为该单一键；
- 创建菜单和菜单内的文件/目录分支保持不变。

**回归**：

- 新增 `tests/round445.test.mjs`；
- RED：**0 pass / 1 fail**；
- 目标与相邻回归：**16 pass / 0 fail**；
- 全量：`npm test` = **1458 pass / 0 fail**。

**运行态验证**：

- 隔离 DSH Web（profile `editor-test`、端口 63113）；
- 临时把 Project toolbar 宽度扩到 600px 触发直接动作恢复；
- 首项 ARIA/title 均为 `新建文件或目录…`；
- 后续按钮仍为 `定位当前文件 / 展开所选 / 全部收起 / 选项 / 隐藏`；
- 同时确认宽 Diff 中 Settings：
  - `aria-haspopup=menu`；
  - 打开后 `aria-expanded=true`；
  - 五个设置项均保留 checkbox/checked。

**下一步**：

- 继续检查 Project `Select Opened File` 的 name/shortcut/disabled 语义；
- 复核 Project 直接/overflow 动作在 260–300px 的恢复顺序；
- 验证模板行在 90%/125% 浏览器缩放下的单行稳定性；
- 保持 1458+ 全量回归并同步 README / engineering-memory / 计划。

## 2026-11-15 — Diff 中宽度恢复与直接 Settings 菜单语义

**作用域**：Commit / Compare Diff 工具栏中等宽度动作恢复、
直接 Settings 子菜单的 `aria-haspopup` / `aria-expanded`。

**审计结果**：

- 生产动作顺序在 320/360/400/520px 下依次恢复：
  - 320：View
  - 360：View + Apply Left Side
  - 400：View + Apply + Swap + Editing Lock
  - 520：继续恢复 Opposite Pane、Reload、Find；
- `Open Local Version` 不会在 520px 前抢占动作槽；
- 直接 Settings 原先只是普通 command，没有暴露子菜单语义。

**修复**：

- `openDiffActionSubmenu()` 增加固定 `actionId`；
- Settings 直接入口传 `actionId='settings'`；
- 直接工具栏中带 `items` 的动作输出
  `aria-haspopup="menu"`；
- `aria-expanded` 只在
  `diffActionMenu.actionId === action.id` 时为 true，
  不会因为 hunk/overflow 菜单打开而误报 Settings 展开。

**回归**：

- 新增 `tests/round444.test.mjs`；
- 同步 round361 的 Settings 子菜单契约；
- RED：**0 pass / 2 fail**；
- 目标与相邻回归：**15 pass / 0 fail**；
- 全量：`npm test` = **1457 pass / 0 fail**。

**下一步**：

- 在更宽 Diff fixture 中运行态确认直接 Settings 的
  `aria-haspopup/expanded`；
- 检查 Project 工具栏剩余 name/role 一致性；
- 复核模板行在浏览器缩放 90%/125% 下的单行稳定性；
- 保持 1457+ 全量回归并同步 README / engineering-memory / 计划。

## 2026-11-15 — Commit 模板 chip 的 hover 与键盘 focus

**作用域**：Commit 提交信息模板按钮、hover/focus-visible、
单行自适应模板条。

**问题证据**：

- 模板 chip 的内联 `background: transparent` 和 border 简写
  压住了普通 CSS hover；
- 浏览器默认键盘焦点仍是系统样式，与 IDEA accent 交互不一致；
- 首次运行态验证 hover 只有浅底，border 仍为灰色。

**修复**：

- 从内联 style 移除 `background`；
- 新增 `.dsh-editor-template-chip` 基态 transparent；
- hover 使用主题 `interactive-bg-hover`；
- hover border 使用 `!important` 覆盖内联 border-color；
- focus-visible 使用 1px accent outline、offset 1px；
- 模板 chip 的尺寸、8px 最小字号和单行布局保持不变。

**回归**：

- 新增 `tests/round443.test.mjs`；
- RED：**0 pass / 2 fail**；
- 目标与相邻回归：**9 pass / 0 fail**；
- 全量：`npm test` = **1455 pass / 0 fail**。

**运行态验证**：

- 隔离 DSH Web（profile `editor-test`、端口 63113）；
- hover：背景 `rgba(38, 49, 72, 0.06)`，
  border `rgb(65, 118, 230)`；
- 从 textarea 按 Tab 进入首个 `feat` chip：
  focused=true、outline accent 1px、offset 1px；
- 模板仍维持 8 个 chip 单行。

**下一步**：

- 验证中等宽度下 Diff View / Apply / Swap / Reload 恢复顺序；
- 检查 Project 与 Diff 工具条剩余 name/role 一致性；
- 保持 1455+ 全量回归并同步 README / engineering-memory / 计划。

## 2026-11-15 — Commit 图标统一、移除主题计数、模板单行自适应

**作用域**：Commit Changes 文件/目录图标、提交信息区、
`feat / fix / refactor / ...` 模板按钮。

**问题证据**：

- Commit 目录使用独立的 14px 文件夹图标，Project 目录为 18px，
  文件图标外层均为 16px，两个工具窗视觉不一致；
- 提交框下方稳定显示 `Subject N/50` 和短主题警告；
- 模板按钮 `flexWrap: wrap`，200px 工具窗会换到多行。

**修复**：

- Commit 目录改用与 Project 相同的 `EntryIcon`；
- 目录 18px、文件 16px，两个工具窗实测 SVG 尺寸一致；
- 删除 subject/body 计数行和短主题警告；
- 删除不再使用的 `COMMIT_SUBJECT_LIMIT` /
  `COMMIT_SUBJECT_HARD_LIMIT`；
- 模板行改为单行容器查询：
  `containerType: inline-size`、`flexWrap: nowrap`、`gap: 2`；
- 模板 chip 使用 `flex: 0 1 auto`、`minWidth: 0` 和
  `font-size: clamp(8px, 4.4cqw, 10px)`；
- 保留点击模板替换前缀的既有语义。

**回归**：

- 新增 `tests/round442.test.mjs`；
- RED：**0 pass / 3 fail**；
- 同步 round19、round24 的旧计数 UI 契约；
- 目标与相邻回归：**22 pass / 0 fail**；
- 全量：`npm test` = **1453 pass / 0 fail**。

**运行态验证**：

- 隔离 DSH Web（profile `editor-test`、端口 63113、200px Commit）；
- `Subject 0/50` 与 `Subject is very short` 均不存在；
- 模板行宽 184px，`flexWrap=nowrap`，高度 20px；
- 8 个 chip 顶部均为 y=579，全部在同一条基线上；
- 字号 8px，所有 chip 的 `scrollWidth <= clientWidth`；
- Project/Commit 目录图标均为 18px；
- README.md 文件图标均为 16px。

**下一步**：

- 继续验证中等宽度下 Diff View/Apply/Swap/Reload 的恢复顺序；
- 检查 Project 与 Diff 工具条剩余 name/role 一致性；
- 复核模板 chip 的 hover/focus 可见性；
- 保持 1453+ 全量回归并同步 README / engineering-memory / 计划。

## 2026-11-15 — Diff 动作槽优先恢复高频视图控制

**作用域**：Commit / Compare Diff 工具栏、窄宽度动作恢复顺序、
`Open Local Version` / `Settings` overflow 顺序。

**IDEA 对照**：

- Computer Use 打开本机 IDEA `Commit: settings.gradle` Diff；
- IDEA Diff 的头部以比较视图控制与差异导航为主，
  EditSource 是文件级入口，不作为第一个恢复的工具栏动作；
- DSH 旧实现把 `openLocalVersion` 放在动作数组首位，
  宽度只能容纳一个恢复动作时会先出现低频入口。

**修复**：

- `openLocalVersion` 从数组首位移动到 `settings` 之后；
- 直接动作恢复优先级改为
  `View Mode / Apply Left Side / Swap Sides / ... / Settings / Open Local Version`；
- `F4` 快捷键、缺失文件的 disabled 状态和 overflow 可用性保持不变；
- `Open Local Version` 在 `»` 中继续显示在 Settings 之后。

**回归**：

- 新增 `tests/round441.test.mjs`；
- 同步 round395 的代表性动作顺序 fixture；
- RED：**0 pass / 2 fail**；
- 目标与相邻回归：**18 pass / 0 fail**；
- 全量：`npm test` = **1450 pass / 0 fail**。

**运行态验证**：

- 隔离 DSH Web（profile `editor-test`、端口 63113）；
- README Commit diff 工具栏宽约 204px；
- 直接动作现在为：
  `View Mode / Apply Left Side / » / Close`；
- 不再由 `Open Local Version` 抢占首个动作槽；
- `»` 顺序后半段为：
  `Settings → Open Local Version F4 → Undo → Redo`；
- checkbox、disabled、`aria-checked` 与 F4 行为保持不变。

**下一步**：

- 继续验证中等宽度下 View / Apply / Swap / Reload 的恢复顺序；
- 检查项目与 diff 工具条剩余 name/role 一致性；
- 复核 Diff Settings 子菜单在 `»` 中的 current 表达；
- 保持 1450+ 全量回归并同步 README / engineering-memory / 计划。

## 2026-11-15 — Group by 三种模式的树深度回归

**作用域**：Commit Changes 的 `Nothing / Module / Directory`
分组、`changeTreeOf()`、`flattenChangeTree()` 的 depth 语义。

**审计结果**：

- `Nothing`：所有文件 depth=0，目录不作为节点；
- `Module`：只生成第一段目录 depth=0，目录内文件 depth=1；
- `Directory`：保留完整目录链
  `docs(depth0) / docs/nested(depth1) / deep.txt(depth2)`；
- 上一轮加入的 `paddingLeft: 22 + row.depth * 14`
  在三模式下都基于同一 depth，没有各自复制的缩进状态；
- IDEA Changes 的单树缩进与 Group by 只改变树的截断深度，
  不改变节点类型和选择/勾选语义；当前实现符合该边界。

**运行态补充**：

- 隔离 DSH Web（profile `editor-test`、端口 63113）；
- 主选中文件继续 hover 时仍保持 accent 12%；
- Commit Diff 窄宽度工具栏只剩 `» / Previous / Next / Close`，
  全部次级动作进入 `»`；
- `»` 中 `Collapse Unchanged` 暴露
  `menuitemcheckbox + aria-checked=true`，
  Swap/View/Disable Editing 同样保留 checkbox 语义；
- Apply Left Side、Find、Settings、Undo/Redo 的 menu role
  与 disabled 状态未发生回退。

**回归**：

- 新增 `tests/round440.test.mjs`；
- 三种 Group by 树的 kind/path/depth 顺序全部固化；
- 目标与相邻回归：**12 pass / 0 fail**；
- 全量：`npm test` = **1448 pass / 0 fail**。

**下一步**：

- 复核 Diff 动作优先级：Open Local Version 目前排在 view/swap 之前，
  只有 1 个动作槽恢复时会先出现低频入口；
- 对照 IDEA Diff 头部的实际直接动作顺序；
- 保持 disabled / current / checkbox 语义；
- 保持 1448+ 全量回归并同步 README / engineering-memory / 计划。

## 2026-11-15 — Changes 全层级 hover 与主选中底色

**作用域**：Commit 工具窗 Changes 组头、目录、文件行，
hover、主选中和 range 多选底色。

**IDEA 对照**：

- Computer Use 读取本机 IDEA 2026.2 Commit 工具窗；
- IDEA 的 Changes 根节点、项目/目录节点和文件节点都属于同一棵树，
  任意层级都有一致的 hover 反馈；
- 主选中行保持自身选择底色，悬停不会把它降级为普通 hover。

**问题证据**：

- 旧 CSS 只为 `.dsh-editor-commit-row:hover` 提供 hover；
- Changes 组头和目录行没有 hover；
- 单选文件时 `selectedInRange` 与 `selectedForChange` 同时为真，
  range 样式在 selected 之后应用，覆盖了主选中 accent 底色；
- 运行态实测主行背景从 accent 12% 变成了灰色 range 78%。

**修复**：

- 组头、目录、文件统一增加
  `dsh-editor-change-tree-row`；
- 新增统一 hover：
  `.dsh-editor-change-tree-row:hover`；
- range 背景仅在
  `selectedInRange && !selectedForChange` 时应用；
- 主选中继续使用 accent 12%，并高于 hover；
- conflict 行 hover 仍由其更具体的红色规则覆盖。

**回归**：

- 新增 `tests/round439.test.mjs`；
- RED：**0 pass / 1 fail**；
- 目标与相邻回归：**16 pass / 0 fail**；
- 全量：`npm test` = **1445 pass / 0 fail**。

**运行态验证**：

- 隔离 DSH Web（profile `editor-test`、端口 63113、200px Commit）；
- 组头、目录、文件静止背景均为 transparent；
- 分别 hover 三层后背景均为 `rgba(38, 49, 72, 0.06)`；
- 主选中 `docs/sort-a.txt` 背景为 accent
  `color(srgb 0.254902 0.462745 0.901961 / 0.12)`；
- 主选中行继续 hover 后背景保持同一 accent 值；
- 文件仍为 `aria-selected=true`，选中/范围逻辑未改。

**下一步**：

- 复核 Group by 的 directory/module/flat 三种模式下 depth 缩进；
- Computer Use 对照 Commit Diff 工具栏窄宽度动作顺序；
- 检查 Diff overflow 中 disabled 与 current/check 状态一致性；
- 保持 1445+ 全量回归并同步 README / engineering-memory / 计划。

## 2026-11-15 — Changes 英文界面、去除状态字母与层级缩进

**作用域**：Commit 工具窗 `Change` 模式、双语输出、
Changes 文件/目录行、200px 窄布局。

**IDEA 对照**：

- Computer Use 读取本机 IntelliJ IDEA 2026.2 Commit 工具窗；
- IDEA 的 Changes 区显示英文：
  `Changes / Unversioned Files / Amend / Commit / Commit and Push…`；
- 文件行只有展开/勾选、文件类型图标、名称、父路径和行数，
  没有 Git porcelain 的 `M / U / A / D` 字母；
- 组头下的直接子项共享一级缩进，展开目录后的文件再递进。

**修复**：

- 新增仅作用于 Commit 工具窗的 `commitEnglish`；
  它读取插件 `en` 字典并复用 `{name}` 插值，不改变共享 zh 文案；
- CommitPanel 的 `t` 改绑 `commitEnglish`，Project / Terminal / Diff
  继续跟随宿主语言；
- Commit 文件数使用英文单复数：`1 file` / `N files`；
- Changes 文件行删除 porcelain `statusBadge`；
- 目录行同步删除原本用于对齐状态列的空占位；
- 网格由
  `12px 16px 16px 16px max-content minmax(0,1fr) max-content`
  收为 `12px 16px 16px max-content minmax(0,1fr) max-content`；
- `flattenChangeTree()` 保留真实 `depth`，目录和文件行使用
  `paddingLeft: 22 + row.depth * 14`；
- `aria-level` 使用 `row.depth + 2`，视觉层级与辅助技术层级一致。

**回归**：

- 新增 `tests/round438.test.mjs`；
- RED：**0 pass / 3 fail**；
- 同步 round19、round182、round430 的旧扁平树/状态列契约；
- 目标与相邻回归：**17 pass / 0 fail**；
- 全量：`npm test` = **1443 pass / 0 fail**。

**运行态验证**：

- 隔离 DSH Web（profile `editor-test`、端口 63113、200px Commit）；
- 组头实际显示：
  `Staged 1 file` / `Unstaged 0 files` / `Unversioned Files 6 files`；
- 搜索框显示 `Filter by path…`，提交区显示
  `Amend / Enter a commit message… / Subject / Commit`；
- 文件行没有 `M/U/A/D` 状态 span；
- `docs` 一级目录复选框 left=`356`；
- 展开后 `docs/sort-a.txt`、`sort-b.md`、`sort-c.ts`
  aria-level=`3`，复选框 left=`370`，比一级项缩进 14px；
- fixture 保持原 HEAD、staged README 和既有 untracked 文件。

**下一步**：

- 对照 IDEA Changes 的 hover、选中底色和组头 `N files` 排版；
- 复核 Group by 的 directory/module/flat 三种模式下层级缩进不回退；
- Computer Use 对照 Commit Diff 工具栏窄宽度动作顺序；
- 保持 1443+ 全量回归并同步 README / engineering-memory / 计划。

## 2026-11-15 — Changes 工具栏补入 IDEA Shelve Silently

**作用域**：Commit 工具窗 Changes 动作条、200px 直接动作、
`»` 溢出菜单、现有 shelf 菜单。

**IDEA 对照**：

- Computer Use 读取本机 IntelliJ IDEA 2026.2 Commit 工具窗的
  Changes Action Toolbar；
- IDEA 直接动作顺序为
  `Refresh / Rollback… / Show Diff / Changelists / Shelve Silently /
  View Options / Select Opened File in Changes View / Expand All /
  Collapse All`；
- DSH 已有 Shelf 功能，但此前只藏在 Commit 顶层 Options 中，
  Changes 动作条缺少 IDEA 的 Shelve 入口。

**修复**：

- 在 `Show Diff` 之后插入 `Shelve Silently`，复用现有 `stash` 图标；
- 动作回调仍走 `openShelveMenu()`，没有新增 Git 实现；
- shelf 菜单继续使用当前 commit 勾选路径，恢复时保留 index/worktree 两侧；
- busy 或没有回调时动作禁用；
- 200px 直接动作优先序更新为
  `刷新 / 还原 / 显示差异 / 静默搁置 / 合并差异 / 视图选项 / »`；
- Copy Patch、Create Patch、Stage All、Select Opened、Expand/Collapse
  继续可从 `»` 访问。

**回归**：

- 新增 `tests/round437.test.mjs`；
- RED：**0 pass / 2 fail**；
- 同步 round391 的 IDEA 语义组顺序；
- 目标与相邻回归：**24 pass / 0 fail**；
- 全量：`npm test` = **1440 pass / 0 fail**。

**运行态验证**：

- 隔离 DSH Web（profile `editor-test`、端口 63113、200px Commit）；
- Changes 动作条直接按钮实际顺序为
  `刷新 / 还原所选更改 / 显示差异 / 静默搁置… / 合并差异 / 视图选项 / 更多操作`；
- 点击 `静默搁置…` 打开现有 shelf 菜单：
  `搁置所选更改` 与空状态 `没有已搁置的更改`；
- `»` 仍包含 Copy Patch、Create Patch、Stage All、
  Select Opened、Expand、Collapse；
- 关闭菜单后 Commit/Changes 工具条保持挂载，未触发其他工作台动作。

**下一步**：

- Computer Use 对照 IDEA Commit Diff 工具栏的窄宽度动作顺序；
- 复核 DSH Diff 的文件导航、hunk 导航、Swap Sides、Settings、
  Apply Left Side 与 Close 的直接/overflow 优先级；
- 检查 disabled 与 current/check 状态在 overflow 中是否一致；
- 保持 1440+ 全量回归并同步 README / engineering-memory / 计划。

## 2026-11-15 — Commit Change / Commit 标签 roving 键盘焦点

**作用域**：Commit 工具条内嵌模式标签、键盘焦点、200px 窄布局。

**IDEA 对照**：

- Computer Use 读取本机 IntelliJ IDEA 2026.2 的 Commit 工具窗；
- IDEA 的当前 Changes 列表使用选中行 + 独立工具栏，
  没有 DSH 用户要求的 `Change / Commit` 双模式 tab；
- 该双标签是用户指定的适配，因此交互按 IDEA/JBTabs 的共同键盘习惯实现：
  单一 Tab stop、方向键移动、首尾键、Enter/Space 激活、
  accent focus ring；
- Terminal 标签已有同类的 roving 语义，本轮复用同一交互模型，
  不引入第二套焦点状态。

**修复**：

- 两个模式 tab 带 `role="tab"`、`aria-selected`、`data-dsh-commit-mode`；
- 当前模式 `tabIndex=0`，另一模式 `tabIndex=-1`；
- `←/→` 切换相邻模式，`Home/End` 跳首尾，`Enter/Space` 激活；
- 切换后同步更新内容并把 DOM focus 放到新标签；
- 指针点击也显式聚焦当前 tab，避免后续方向键丢失上下文；
- 新增 `.dsh-editor-commit-mode-tab:focus-visible`，使用主题 accent
  1px 内描边，替换浏览器默认黑色 outline。

**回归**：

- 新增 `tests/round436.test.mjs`；
- RED：**0 pass / 3 fail**；
- 目标与相邻回归：**18 pass / 0 fail**；
- 全量：`npm test` = **1438 pass / 0 fail**。

**运行态验证**：

- 隔离 DSH Web（profile `editor-test`、端口 63113）；
- 初始 `Change`：selected=true、tabIndex=0、focused=true；
  `Commit`：selected=false、tabIndex=-1；
- `→` 后切换到 Commit，日志详情出现，焦点同步到 Commit；
- `Home` 回到 Change，Changes 面板出现；
- `End` 回到 Commit；`←` 回到 Change；
- 在 Change 左边界继续按 `←` 不越界；
- 指向 `Commit` 后按 Space 可激活并同步内容与焦点；
- 键盘焦点显示主题 accent 内描边，不再出现浏览器默认黑框。

**下一步**：

- 对照 IDEA Commit Changes 工具栏在 200px 下的动作优先级；
- 复核 Show Diff / Rollback / View Options 的直接可见性；
- 检查 Project 工具栏剩余动作的 name/role 一致性；
- 保持 1438+ 全量回归并同步 README / engineering-memory / 计划。

## 2026-11-15 — Commit 工具条内嵌 Change / Commit 模式标签

**作用域**：Commit 工具窗口顶部工具条、`mode='changes'|'log'`
内容切换、200px 最窄宽度布局。

**问题证据**：

- 原界面第一行是带固定 `Commit` 标题的工具条；
- 第二行单独放“更改 / 日志”tablist，额外占用 26px；
- 用户要求把两个模式标签移到第一行，移除固定标题；
- 200px 实测初版虽然移动成功，但 tablist 被 flex 压缩到 71px，
  `Commit` 标签与分支徽章重叠。

**修复**：

- `PanelToolbar` 新增可选 `titleActionStyle`，只覆盖当前调用方的
  title action 布局；
- Commit 工具条通过 `titleAction` 渲染 `Change | Commit` tablist，
  不再渲染 `icon: 'commit'` 和固定 `title` 文本；
- 删除原独立 tab 行，原 `mode`、`aria-selected`、更改计数、
  scroll refs 与来源跳转逻辑保持不变；
- 双语字典中的 `tabChanges` / `tabLog` 统一显示用户指定的
  `Change` / `Commit`；
- `commitToolbarTitleAction` 禁止 tablist 被压缩；
- `panelToolbarFit()` 在分配动作槽前预留固定分支徽章，
  窄宽度时 `options / refresh / hide` 收入 `»`，不挤压标签。

**回归**：

- 新增 `tests/round435.test.mjs`，RED 为 **0 pass / 5 fail**；
- 同步更新 round20、round114、round185、round186、round392、
  round400 的旧结构契约；
- 定向与相邻回归：**37 pass / 0 fail**；
- 全量：`npm test` = **1435 pass / 0 fail**。

**运行态验证**：

- 隔离 DSH Web（`DSH_HOME=/private/tmp/dsh-editor-r219-20261114-185936-home`，
  profile `editor-test`，端口 63113）；
- 200px 工具条只有一个 tablist，两个 tab 均在工具栏边界内：
  `Change 7` 与 `Commit`；
- `Change` 下仍显示 changes pane，点击 `Commit` 后 changes pane 移除、
  日志详情出现，再点 `Change` 正常返回；
- 200px 下工具条动作收进 `»`，菜单仍含“选项 / 刷新 / 隐藏”，
  分支徽章 `main` 保持可见。

**下一步**：

- 对照 IDEA 为顶部 Change / Commit 标签补齐 roving focus 与方向键切换；
- 复核标签在更宽工具条下是否应保留独立动作文字；
- 继续检查 Project 与 Diff 工具栏最窄宽度的动作优先级；
- 保持 1435+ 全量回归并同步 README / engineering-memory / 计划。

## 2026-11-15 — Apply Left Side macOS 快捷键修正

**作用域**：Commit / Compare Diff 的 `Diff.ApplyLeftSide` 菜单提示、
`⌃⌘→` 键盘路由与运行态验证。

**问题证据**：

- round433 使用了 IntelliJ `$default` keymap 的
  `control alt R`；
- 本机默认 macOS keymap 明确定义：
  `Diff.ApplyLeftSide = control meta RIGHT`；
- 菜单因此显示了错误的 `⌃⌥R`，macOS 用户按 IDEA 原生组合无响应。

**修复**：

- `applyLeftSide` 菜单 shortcut 改为 `⌃⌘→`；
- Diff surface 改为拦截：
  `control + meta + ArrowRight`；
- 不再把 `control + alt + R` 当作 Apply Left Side；
- 应用逻辑、可写 guard、undo 和写回链保持不变；
- 新增 `tests/round434.test.mjs`，并更新 round433 契约。

**运行态验证**：

- 同一临时双 hunk MM fixture：
  - overflow 显示 `从左侧应用更改⌃⌘→`；
  - 初始差异 `1/2`；
- 旧 `⌃⌥R` 没有执行 Apply Left Side，文件两处改动都保留；
- `⌃⌘→`：
  - diff 变为 `1/1`；
  - 当前 hunk 内容写回工作区；
- fixture 恢复到原 HEAD、staged README 和 untracked 状态。

**回归**：

```bash
node --test tests/round434.test.mjs tests/round433.test.mjs \
  tests/round432.test.mjs tests/round292.test.mjs \
  tests/syntax.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
git diff --check
```

- GREEN：目标与相邻回归 **14 pass / 0 fail**；
- 全量：`npm test` = **1429 pass / 0 fail**；
- `node --check` 与 `git diff --check` 通过。

**下一步**：

- `Diff.AppendLeftSide` 无默认 macOS shortcut，且语义是追加左块，
  与当前 replacement 不同，先继续只读核对；
- 检查 Project 工具条剩余命令的 name/role 一致性；
- 复核 Diff Settings 父项在超窄 `»` 中的 current 表达；
- 保持 1429+ 全量回归并同步 README / engineering-memory / 计划。

## 2026-11-15 — IDEA Apply Left Side 动作与快捷键

**作用域**：Commit / Compare Diff 的 `Diff.ApplyLeftSide`、
当前 hunk/selection 应用、`⌃⌘→`、写回和 undo。

**IDEA 对照证据**：

- IntelliJ 默认 macOS keymap：
  `Diff.ApplyLeftSide = control meta RIGHT`；
- `SimpleDiffViewer.ApplySelectedChangesActionBase` 只在目标侧可编辑时可见；
- 有选区时对选中 changes 执行，否则由当前 change 选择逻辑定位；
- 本地单侧可编辑 diff 的实际操作是把左侧内容替换到右侧。

**原缺口**：

- DSH 已有 Monaco gutter 块还原和选区还原；
- 但没有 IDEA 对应的可发现菜单动作；
- `⌃⌘→` 无响应，用户不知道可应用当前更改。

**修复**：

- 新增 `lineChangeRangeMappings(change)`，把当前 Monaco line change
  转成 `revertRangeMappings()` 接受的映射；
- 新增 `applyLeftSide()`：
  - 有有效选区时应用选区覆盖 changes；
  - 无选区时应用 `hunks.index` 对应的当前 change；
- Diff 工具栏/`»` 增加 `applyLeftSide`：
  - label `从左侧应用更改` / `Apply Left Side`；
  - shortcut `⌃⌘→`；
  - 只读、Swap Sides、Disable Editing 时 disabled；
- Diff surface 拦截 `⌃⌘→` 并只调用该动作；
- 复用既有 `persistRestored()` 写回、undo/redo 和计数刷新链路；
- 新增 `tests/round433.test.mjs`，更新键盘 effect 依赖契约。

**运行态验证**：

- 临时 MM fixture：index 20 行稳定内容，工作区第 2/18 行改动；
- 打开 unstaged diff：
  - overflow 含 `从左侧应用更改⌃⌘→`；
  - 初始差异 `1/2`；
- 在第一个 change 执行 `⌃⌘→`：
  - 差异变为 `1/1`；
  - 工作区第 2 行恢复 `line-02 stable`；
  - 第 18 行仍为 `line-18 CHANGED`；
- `⌘Z`：
  - 差异回到 `1/2`；
  - 第 2 行恢复 `line-02 CHANGED`；
- fixture 恢复到原 HEAD、staged README 和 untracked 状态。

**回归**：

```bash
node --test tests/round433.test.mjs tests/round432.test.mjs \
  tests/round292.test.mjs tests/round298.test.mjs \
  tests/round361.test.mjs tests/round398.test.mjs \
  tests/syntax.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
git diff --check
```

- RED：`round433` 初始 **4 fail / 0 pass**；
- GREEN：目标与相邻回归 **22 pass / 0 fail**；
- 全量：`npm test` = **1427 pass / 0 fail**；
- `node --check` 与 `git diff --check` 通过。

**下一步**：

- 核对 IDEA `Diff.AppendLeftSide` / `Diff.IgnoreLeftSide` 是否可在当前模型精确表达；
- 检查 Project 工具条剩余命令的 name/role 一致性；
- 复核 Diff Settings 父项在超窄 `»` 中的 current 表达；
- 保持 1427+ 全量回归并同步 README / engineering-memory / 计划。

## 2026-11-15 — IDEA Previous/Next Change 快捷键

**作用域**：Commit / Compare Diff 键盘路由、普通 diff 的
`Diff.PrevChange` / `Diff.NextChange`、combined diff 文件导航例外。

**IDEA 对照证据**：

- IntelliJ 默认 macOS keymap：
  - `Diff.PrevChange = control shift LEFT`；
  - `Diff.NextChange = control shift RIGHT`；
  - `NextDiff = F7`；
  - `PreviousDiff = shift F7`。

**原缺口**：

- F7 / ⇧F7 已映射 hunk；
- 普通 diff 没有处理 `⌃⇧←/→`；
- 同一组合键只在 combined diff 中被用于文件导航；
- IDEA 默认快捷键在普通 diff 中没有响应。

**修复**：

- Diff surface 统一拦截 `⌃⇧←/→`；
- combined diff 有 `navigationPosition` 时继续切换更改文件；
- 普通 diff 调用现有 `walkHunk('previous'|'next')`；
- F7 / ⇧F7、工具栏 hunk 箭头与 Go To Change 均不改；
- 新增 `tests/round432.test.mjs`，更新 round317 契约。

**运行态验证**：

- 临时 `MM` fixture：
  - index 为 20 行稳定内容；
  - 工作区只修改相隔较远的第 2/18 行；
  - unstaged diff 为两个 hunk；
- diff 计数器初始 `1/2`；
- `⌃⇧→` 后为 `2/2`；
- `⌃⇧←` 后回到 `1/2`；
- F7 / ⇧F7 仍在 `2/2` 与 `1/2` 间工作；
- fixture 恢复到原 HEAD、staged README 和 untracked 状态。

**回归**：

```bash
node --test tests/round432.test.mjs tests/round317.test.mjs \
  tests/round283.test.mjs tests/round289.test.mjs \
  tests/round162.test.mjs tests/round319.test.mjs \
  tests/syntax.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
git diff --check
```

- RED：`round432` 初始 **1 fail / 1 pass**；
- GREEN：目标与相邻回归 **25 pass / 0 fail**；
- 全量：`npm test` = **1423 pass / 0 fail**；
- `node --check` 与 `git diff --check` 通过。

**下一步**：

- 核对 IDEA `Diff.ApplyLeftSide` 等剩余 diff keymap 动作；
- 检查 Project 工具条剩余命令的 name/role 一致性；
- 复核 Diff Settings 父项在超窄 `»` 中的 current 表达；
- 保持 1423+ 全量回归并同步 README / engineering-memory / 计划。

## 2026-11-15 — Project 与 Changes 的同级位置语义

**作用域**：Project tree、Commit Changes tree、可视行的
`aria-posinset` / `aria-setsize`、过滤与折叠后的同级集合。

**原缺口**：

- 节点已有 `aria-level`；
- 但没有 `aria-posinset/aria-setsize`；
- 辅助技术无法播报“第 2 个，共 6 个”等 IDEA 树位置；
- Project 的扁平渲染仍保留真实 depth，Changes 也有稳定分组边界，
  数据足以计算但不能凭视觉缩进推断。

**修复**：

- 新增纯函数 `projectTreePosition(rows, index)`：
  - 最近的前序更浅节点作为父节点；
  - 同一父块内同 depth 的非 placeholder 行为同级；
  - 返回 level / posinset / setsize；
- Project row 统一读取该结果；
- Changes group header：
  - `posinset=groupIndex+1`；
  - `setsize=visibleGroups.length`；
- Changes 目录/文件行：
  - `posinset=rowIndex+1`；
  - `setsize=rows.length`；
- 只影响 AX 元数据；视觉顺序、过滤、折叠、键盘与 selection 不变；
- 新增 `tests/round431.test.mjs`，并更新受 map 签名变化影响的旧测试。

**运行态验证**：

- Project：
  - 根目录 `1/1`；
  - docs `1/6`、src `2/6`；
  - docs 内文件 `1/4` 至 `4/4`；
  - 根目录文件按 `3/6` 至 `6/6`；
- Changes：
  - 已暂存 `1/3`；
  - 未暂存 `2/3`；
  - 未纳入版本控制 `3/3`；
  - staged README `1/1`；
  - 当前可见 unversioned 条目 `1/4` 至 `4/4`。

**回归**：

```bash
node --test tests/round431.test.mjs tests/round430.test.mjs \
  tests/round429.test.mjs tests/round428.test.mjs \
  tests/round403.test.mjs tests/static-order.test.mjs \
  tests/syntax.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
git diff --check
```

- RED：`round431` 初始 **3 fail / 0 pass**；
- GREEN：目标与相邻回归 **21 pass / 0 fail**；
- 全量：`npm test` = **1421 pass / 0 fail**；
- `node --check` 与 `git diff --check` 通过。

**下一步**：

- 检查 Project 工具条剩余命令的 name/role 一致性；
- 复核 Diff Settings 父项在超窄 `»` 中的 current 表达；
- 将后续重点转回可见交互/快捷键缺口，减少纯 ARIA 轮次；
- 保持 1421+ 全量回归并同步 README / engineering-memory / 计划。

## 2026-11-15 — Project 与 Changes 的树层级 aria-level

**作用域**：Project tree、Commit Changes tree、treeitem 层级、
目录/文件可访问结构。

**原缺口**：

- Project 与 Changes 的节点已有 `role="treeitem"`；
- Project 渲染保留了真实的 `row.depth`；
- Changes 也有稳定的组/条目两级结构；
- 但两者都没有 `aria-level`，AX 无法判断节点深度。

**修复**：

- Project row 增加：
  `aria-level = max(1, row.depth + 1)`；
- Changes group header 增加 `aria-level = 1`；
- Changes directory/file row 增加 `aria-level = 2`；
- 不改变视觉缩进、键盘顺序、selection、折叠或点击行为；
- 新增 `tests/round430.test.mjs`。

**运行态验证**：

- Project：
  - 项目根 level `1`；
  - `docs` / `src` level `2`；
  - `docs` 内文件 level `3`；
  - 根目录文件 level `2`；
- Changes：
  - 已暂存 / 未暂存 / 未纳入版本控制组 level `1`；
  - README 文件 level `2`；
  - `docs` 目录 level `2`；
  - 根级未跟踪文件 level `2`。

**回归**：

```bash
node --test tests/round430.test.mjs tests/round428.test.mjs \
  tests/round429.test.mjs tests/round403.test.mjs \
  tests/static-order.test.mjs tests/syntax.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
git diff --check
```

- RED：`round430` 初始 **2 fail / 0 pass**；
- GREEN：目标与相邻回归 **18 pass / 0 fail**；
- 全量：`npm test` = **1418 pass / 0 fail**；
- `node --check` 与 `git diff --check` 通过。

**下一步**：

- 检查 Project 工具条剩余命令的 name/role 一致性；
- 复核 Diff Settings 父项在超窄 `»` 中的 current 表达；
- 审计 Project tree 的 `aria-posinset/setsize` 是否可由可见行稳定计算；
- 保持 1418+ 全量回归并同步 README / engineering-memory / 计划。

## 2026-11-15 — Changes 目录行键盘可达性

**作用域**：Commit Changes 的目录树节点、roving 键盘导航、
目录折叠/展开、Shift+F10/ContextMenu 和可见焦点。

**原缺口**：

- 目录行已是 `treeitem`，但不在 Changes 的键盘行集合中；
- 现有 `↑/↓/Home/End` 只遍历组头与文件；
- 目录只能靠鼠标展开/右键；
- 目录节点没有 Shift+F10 菜单入口，也没有可见键盘焦点。

**修复**：

- 目录行增加 `data-dsh-change-directory` 与 `tabIndex=-1`；
- `onChangesKeyDown` 的行集合加入目录节点；
- 当前索引优先取真正聚焦的行，而不是旧 selection；
- 聚焦目录时清空 group/file selection，避免旧文件继续响应 Enter；
- 目录 `→` 展开、`←` 收起；
- 目录 Shift+F10 / ContextMenu 复用目录右键菜单；
- typeahead 显式过滤为 `[data-dsh-change-path]` 文件行；
- 目录 `:focus-visible` 使用 accent 1px 内描边；
- 更新 round50 / round52 / round247 的旧固定窗口/选择器契约。

**运行态验证**：

- 从 README 文件行连续 `↓`：
  - 未暂存组；
  - 未纳入版本控制组；
  - `docs` 目录；
- 目录获得焦点时：
  - `role=treeitem`；
  - `data-dsh-change-directory=docs`；
- `→` 后 `aria-expanded=true`；
- `Shift+F10`：
  - 菜单打开；
  - 首项 `暂存此目录`；
- Esc 后焦点回到 `docs` 目录；
- `←` 后 `aria-expanded=false`，焦点仍在目录节点。

**回归**：

```bash
node --test tests/round429.test.mjs tests/round247.test.mjs \
  tests/round248.test.mjs tests/round250.test.mjs \
  tests/round168.test.mjs tests/round346.test.mjs \
  tests/round428.test.mjs tests/static-order.test.mjs \
  tests/syntax.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
git diff --check
```

- RED：`round429` 初始 **3 fail / 0 pass**；
- GREEN：目标与相邻回归 **29 pass / 0 fail**；
- 全量：`npm test` = **1416 pass / 0 fail**；
- `node --check` 与 `git diff --check` 通过。

**下一步**：

- 检查 Project 工具条剩余命令的 name/role 一致性；
- 复核 Diff Settings 父项在超窄 `»` 中的 current 表达；
- 审计 Project 树与 Changes 目录在 `aria-level` 上的层级表达；
- 保持 1416+ 全量回归并同步 README / engineering-memory / 计划。

## 2026-11-15 — Changes 目录与文件行补齐 treeitem 语义

**作用域**：Commit Changes 的 `role="tree"`、组头/目录/文件三类节点、
`aria-selected`、`aria-expanded`、roving `tabIndex` 与键盘导航。

**原缺口**：

- Changes 容器是 `role="tree"`；
- 组头已是 `treeitem`；
- 目录行和文件行只有普通 `div`，却分别携带
  `aria-expanded` 或 `aria-selected/tabIndex`；
- AX 树把目录与文件显示为无角色的 container，
  与其真实树行为不一致。

**修复**：

- 目录行增加 `role="treeitem"` 与 `aria-expanded=row.open`；
- 文件行增加 `role="treeitem"`；
- 文件行保留 `aria-selected=selectedForChange`
  与 `tabIndex=selectedForChange ? 0 : -1`；
- 点击、双击、右键、键盘导航、selection 和折叠状态不变；
- 新增 `tests/round428.test.mjs`。

**运行态验证**：

- Changes tree 名称为 `更改`；
- 组头、`docs` 目录及全部文件行都暴露为 `treeitem`；
- 点击 `README.md`：
  - `role=treeitem`；
  - `aria-selected=true`；
  - `tabIndex=0`；
- `docs` 目录：
  - 初始 `role=treeitem`、`aria-expanded=true`；
  - 点击后 `aria-expanded=false`。

**回归**：

```bash
node --test tests/round428.test.mjs tests/round247.test.mjs \
  tests/round248.test.mjs tests/round250.test.mjs \
  tests/round424.test.mjs tests/round425.test.mjs \
  tests/round427.test.mjs tests/static-order.test.mjs \
  tests/syntax.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
git diff --check
```

- RED：`round428` 初始 **2 fail / 0 pass**；
- GREEN：目标与相邻回归 **25 pass / 0 fail**；
- 全量：`npm test` = **1413 pass / 0 fail**；
- `node --check` 与 `git diff --check` 通过。

**下一步**：

- 检查 Project 工具条剩余命令的 name/role 一致性；
- 复核 Diff Settings 父项在超窄 `»` 中的 current 表达；
- 审计 Changes 目录行的键盘可达性（当前主要依赖鼠标/右键）；
- 保持 1413+ 全量回归并同步 README / engineering-memory / 计划。

## 2026-11-15 — Changes 过滤器清除按钮可访问名

**作用域**：Commit Changes 路径过滤框、有内容时显示的 `×`
清除按钮、点击后焦点回落。

**原缺口**：

- `×` 按钮只有字形，没有 `aria-label` 或 tooltip；
- 辅助技术无法说明它会清除 Changes 过滤器；
- Esc 已有清空路径，但鼠标/键盘聚焦按钮时没有名称。

**修复**：

- 新增双语：
  - `clearChangeFilter`：`清除更改过滤器`；
  - `Clear changes filter`；
- 按钮增加相同文案的 `title` 与 `aria-label`；
- onClick 继续复用 `clearChangeFilter()`；
- Esc 清理、选中行/树容器回焦逻辑保持不变；
- 新增 `tests/round427.test.mjs`。

**运行态验证**：

- Commit 工具窗宽 `200px`；
- 输入 `README` 后出现清除按钮：
  - `aria-label=清除更改过滤器`；
  - `title=清除更改过滤器`；
  - 可见字形仍为 `×`；
- 点击后：
  - 过滤值恢复空字符串；
  - 焦点回到
    `dsh-editor-commit-row dsh-editor-commit-row-selected
    dsh-editor-commit-row-range`；
- 原有 Esc 清空路径仍由既有回归覆盖。

**回归**：

```bash
node --test tests/round427.test.mjs tests/round227.test.mjs \
  tests/round233.test.mjs tests/round347.test.mjs \
  tests/round424.test.mjs tests/round425.test.mjs \
  tests/round426.test.mjs tests/syntax.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
git diff --check
```

- RED：`round427` 初始 **2 fail / 0 pass**；
- GREEN：目标与相邻回归 **22 pass / 0 fail**；
- 全量：`npm test` = **1411 pass / 0 fail**；
- `node --check` 与 `git diff --check` 通过。

**下一步**：

- Changes 文件行虽有 `aria-selected` / `tabIndex`，但仍缺少
  `role="treeitem"`；目录行同样需要补齐 tree semantics；
- 复核 Project 工具条剩余命令的 name/role 一致性；
- 审计 Diff Settings 父项在超窄 `»` 中的 current 表达；
- 保持 1411+ 全量回归并同步 README / engineering-memory / 计划。

## 2026-11-15 — Commit Amend 复选框显式可访问名

**作用域**：Commit 提交信息区 `修正上一次提交` 复选框、
Amend 预填/恢复和键盘焦点。

**原缺口**：

- checkbox 嵌套在带文字的原生 `<label>` 中；
- 但当前 AX 树仍把 input 暴露为无名 checkbox；
- 辅助技术无法确认该控件就是 IDEA 的 Amend 动作。

**修复**：

- input 增加 `aria-label: t('editor.amend')`；
- `checked`、`onChange`、Amend 预填和取消恢复逻辑不变；
- 提交信息 textarea、历史按钮和提交按钮保持原语义；
- 新增 `tests/round426.test.mjs`。

**运行态验证**：

- checkbox 名称：`修正上一次提交`；
- 初始：
  - `checked=false`；
  - 提交消息为空；
- 勾选：
  - `checked=true`；
  - 消息预填 `baseline`；
- 取消：
  - `checked=false`；
  - 消息恢复空字符串；
  - `document.activeElement` 仍是 checkbox。

**回归**：

```bash
node --test tests/round426.test.mjs tests/round33.test.mjs \
  tests/round19.test.mjs tests/round18.test.mjs \
  tests/round424.test.mjs tests/round425.test.mjs \
  tests/syntax.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
git diff --check
```

- RED：`round426` 初始 **1 fail / 0 pass**；
- GREEN：目标与相邻回归 **27 pass / 0 fail**；
- 全量：`npm test` = **1409 pass / 0 fail**；
- `node --check` 与 `git diff --check` 通过。

**下一步**：

- 检查 Project 工具条剩余命令的 name/role 一致性；
- 复核 Diff Settings 父项在超窄 `»` 中的 current 表达；
- 审计 Commit 过滤器清除 `×` 按钮的可访问名；
- 保持 1409+ 全量回归并同步 README / engineering-memory / 计划。

## 2026-11-15 — Changes 文件与目录复选框的可访问名

**作用域**：Commit Changes 文件行提交复选框、目录暂存复选框、
`MM` 同路径 staged/unstaged 区分和双语名称。

**原缺口**：

- 文件行提交复选框没有 `aria-label`，AX 只显示无语义 checkbox；
- 目录复选框只用 `row.name` 作为名称，没有说明复选框会
  stage、unstage 还是 add-to-VCS；
- `MM` 路径可能同时出现在 staged 与 unstaged，两侧 checkbox
  需要靠组语义区分；
- 目录复选框并不控制提交包含，不能套用普通文件项的命名。

**修复**：

- 文件复选框新增：
  - `includeFileInCommit`：
    `将 {path}（{group}）包含到提交` /
    `Include {path} from {group} in commit`；
- 目录复选框按组动态命名：
  - `stageDirectoryFiles`；
  - `unstageDirectoryFiles`；
  - `addDirectoryToVcs`；
- 文件名、目录路径、组名和真实动作全部进入可访问名；
- checkbox 的 checked / indeterminate / onChange /
  stopPropagation 行为不变；
- 新增 `tests/round425.test.mjs`。

**运行态验证**：

- Commit 工具窗宽 `200px`；
- staged 文件：
  - `将 README.md（已暂存）包含到提交`；
- unversioned 文件：
  - `将 docs/sort-a.txt（未纳入版本控制）包含到提交`；
  - 其余未跟踪文件同样带完整路径与组名；
- unversioned 目录：
  - `将目录 docs 中的所有文件添加到 VCS`；
- 原有组复选框名称仍保持：
  - `选择 已暂存 中的所有文件`；
  - `选择 未暂存 中的所有文件`；
  - `选择 未纳入版本控制 中的所有文件`；
- 运行态 AX 中所有 Changes 文件/目录复选框均有名称。

**回归**：

```bash
node --test tests/round425.test.mjs tests/round424.test.mjs \
  tests/round250.test.mjs tests/round248.test.mjs \
  tests/round247.test.mjs tests/round245.test.mjs \
  tests/round243.test.mjs tests/round52.test.mjs \
  tests/static-order.test.mjs tests/syntax.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
git diff --check
```

- RED：`round425` 初始 **3 fail / 0 pass**；
- GREEN：目标与相邻回归 **29 pass / 0 fail**；
- 全量：`npm test` = **1408 pass / 0 fail**；
- `node --check` 与 `git diff --check` 通过。

**下一步**：

- Commit 提交信息区的 `修正上一次提交` 复选框仍无 `aria-label`；
- 检查 Project 工具条剩余命令的 name/role 一致性；
- 复核 Diff Settings 父项在超窄 `»` 中的 current 表达；
- 保持 1408+ 全量回归并同步 README / engineering-memory / 计划。

## 2026-11-15 — Changes 组头可访问名包含动作与目标

**作用域**：Commit Changes 三个组头的展开按钮、组全选复选框、
200px 窄窗组级 `更多操作` 与双语可访问名称。

**原缺口**：

- 组头展开按钮的 `aria-label` 只有组名（如“已暂存”），
  没有说明按钮会展开还是收起；
- 组全选复选框同样只有组名，没有说明它选择整个组；
- 三个组的窄窗按钮都叫“更多操作”，辅助技术无法区分
  它将操作哪个组；
- 运行态 AX 中三组 `更多操作` 完全同名。

**修复**：

- 新增双语模板：
  - `expandGroupNamed`：`展开 {group}` / `Expand {group}`；
  - `collapseGroupNamed`：`收起 {group}` / `Collapse {group}`；
  - `selectGroupFiles`：`选择 {group} 中的所有文件` /
    `Select all files in {group}`；
  - `moreActionsFor`：`{group}的更多操作` /
    `More actions for {group}`；
- 展开按钮根据 `groupOpen` 在展开/收起文案间切换；
- 组全选复选框使用组级选择文案；
- 窄窗组级 `更多操作` 带入组名；
- 组头点击、键盘、折叠状态、菜单动作和 disabled 判定不变。

**运行态验证**：

- Commit 工具窗宽度 `200px`；
- 三组行宽均为 `200px`；
- 展开态：
  - `收起 已暂存`；
  - `收起 未暂存`；
  - `收起 未纳入版本控制`；
- 折叠 `已暂存` 后：
  - 名称为 `展开 已暂存`；
  - `aria-expanded=false`；
  - 再展开后恢复 `收起 已暂存 / true`；
- 组复选框：
  - `选择 已暂存 中的所有文件`；
  - `选择 未暂存 中的所有文件`；
  - `选择 未纳入版本控制 中的所有文件`；
- 组级按钮：
  - `已暂存的更多操作`；
  - `未暂存的更多操作`；
  - `未纳入版本控制的更多操作`；
- 运行态 AX 确认三组名称互不相同。

**回归**：

```bash
node --test tests/round424.test.mjs tests/round250.test.mjs \
  tests/round248.test.mjs tests/round247.test.mjs \
  tests/round245.test.mjs tests/round243.test.mjs \
  tests/round52.test.mjs tests/static-order.test.mjs \
  tests/syntax.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
git diff --check
```

- RED：`round424` 初始 **2 fail / 0 pass**；
- GREEN：目标与相邻回归 **26 pass / 0 fail**；
- 全量：`npm test` = **1405 pass / 0 fail**；
- `node --check` 与 `git diff --check` 通过。

**下一步**：

- 文件行提交复选框当前仍没有可访问名，下一轮补齐路径与组语义；
- 复核 Directory 复选框应表达“暂存/取消暂存目录”还是提交包含；
- 检查 Project 工具条剩余命令的 name/role 一致性；
- 保持 1405+ 全量回归并同步 README / engineering-memory / 计划。

## 2026-11-15 — Commit Diff `»` 的键盘入口与 popup 语义

**作用域**：Commit / Compare Diff 窄工具栏 `»`、隐藏动作菜单、
Shift+F10 / ContextMenu、`aria-haspopup/expanded` 和切换项角色。

**IDEA 对照边界**：

- Computer Use 本轮再次被 macOS 锁屏阻止：
  `The Mac is locked and automatic unlock could not unlock it`；
- 复用此前已确认的 IDEA Diff Viewer 工具栏/overflow 与
  `menuitemcheckbox` 语义，不修改锁屏、权限或 IDEA 配置。

**原缺口**：

- Project `PanelToolbar` 与 Changes `CompactActionBar` 的 `»`
  已在 round418 支持点击、Shift+F10、ContextMenu 和
  `aria-haspopup/expanded`；
- Diff `»` 仍只有点击入口；
- 键盘按 Shift+F10 会落回浏览器默认 context menu；
- button 没有 `aria-haspopup` / `aria-expanded`；
- 菜单内已有的 `menuitem` / `menuitemcheckbox` 映射本身正确。

**修复**：

- Diff 抽出 `openDiffActionMenu(rect)`；
- 点击、Shift+F10、ContextMenu 共用同一 builder；
- `»` 暴露 `aria-haspopup="menu"` 和
  `aria-expanded=diffActionMenu !== null`；
- 菜单动作顺序、分组、disabled、restoreFocus、快捷键和
  boolean active 映射保持不变；
- 新增 `tests/round423.test.mjs`。

**运行态验证**：

- Commit 工具窗 `200px`，diff 工具栏宽 `203.953125px`；
- 关闭态 `»`：
  - `aria-haspopup=menu`；
  - `aria-expanded=false`；
- 聚焦后 Shift+F10：
  - `aria-expanded=true`；
  - 菜单打开；
  - 首项为 `menuitem`；
- 菜单项：
  - `切换双栏/单栏对比`：`menuitemcheckbox / false`；
  - `交换对比方向`：`menuitemcheckbox / false`；
  - `禁用编辑`：`menuitemcheckbox / false`；
  - `展开未修改区域✓`：`menuitemcheckbox / true`；
  - 普通命令仍为 `menuitem`；
- 右键 `»` 同样打开菜单：
  - `aria-expanded=true`；
  - 首项获得焦点；
  - 首项角色为 `menuitem`。

**回归**：

```bash
node --test tests/round423.test.mjs tests/round418.test.mjs \
  tests/round398.test.mjs tests/round395.test.mjs \
  tests/round382.test.mjs tests/round298.test.mjs \
  tests/round230.test.mjs tests/round221.test.mjs \
  tests/round197.test.mjs tests/syntax.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
git diff --check
```

- RED：`round423` 初始 **2 fail / 1 pass**；
- GREEN：目标与相邻回归 **29 pass / 0 fail**；
- 全量：`npm test` = **1403 pass / 0 fail**；
- `node --check` 与 `git diff --check` 通过。

**下一步**：

- 检查 Project / Commit 工具条剩余命令的 name/role 一致性；
- 复核 Commit Changes 组头按钮在 200px 下的可访问名；
- 复核 Diff Settings 父项在超窄 `»` 中的 current 表达；
- 保持 1403+ 全量回归并同步 README / engineering-memory / 计划。

## 2026-11-15 — IDEA 工具窗口条的 ARIA 结构

**作用域**：Editor 左侧 Activity Stripe、Project 与 Commit 顶部
`PanelToolbar`、辅助技术可访问名称和 pressed 语义。

**IDEA 对照证据**：

- 本轮尝试 Computer Use 读取 IDEA 时 macOS 锁屏：
  `The Mac is locked and automatic unlock could not unlock it`；
- 改用本机
  `/Applications/Intellij.app/Contents/lib/intellij.platform.ide.impl.jar`；
- 包内 `idea/PlatformActions.xml` 的 `ProjectViewToolbar` 为
  `separator / SelectInProjectView / ExpandRecursively /
  ExpandAll / CollapseAll`；
- 当前 DSH Project 直接动作顺序与既有 IDEA 实窗证据一致：
  `New File or Directory / Select Opened File / Expand Selected /
  Collapse All / Options / Hide`；
- 200px 运行态直接保留
  `全部收起 / 选项 / 隐藏 / 更多操作`，`»` 为
  `新建文件/新建目录… / 定位当前文件 / 展开所选` 且保持语义分隔；
- 因此 Project 动作优先级无需改动，本轮转向真实语义缺口。

**原缺口**：

- Activity Stripe 使用 `role="tablist"`，但子项是带
  `aria-pressed` 的原生按钮，没有 `role="tab"`；
- Project / Commit 的 `PanelToolbar` 根节点没有 toolbar role
  或可访问名称；
- Diff 和 Changes 工具条已有 `role="toolbar"`，同一编辑器内语义不一致；
- Activity Stripe 的可访问名是硬编码英文
  `Editor tool windows`。

**修复**：

- Activity Stripe 改为
  `role="toolbar"`、`aria-orientation="vertical"`、
  `aria-label=t('editor.toolWindows')`；
- Project / Commit 的 `PanelToolbar` 增加可选 `ariaLabel`，
  根节点改为横向 `role="toolbar"`；
- Project 传 `editor.project`，Commit 传 `editor.commit`；
- 新增双语 `toolWindows: 工具窗口 / Tool windows`；
- StripeItem 的按钮、`aria-pressed`、顺序和回调全部保持不变；
- 更新 `round20` 的旧函数签名契约。

**运行态验证**：

- Activity Stripe：
  - `role=toolbar`；
  - `aria-orientation=vertical`；
  - `aria-label=工具窗口`；
  - Project `pressed=true`，其余三项 `pressed=false`；
- 切到 Commit 后 Project `pressed=false`、Commit `pressed=true`；
- Project 面板工具条：
  - `role=toolbar`；
  - `aria-orientation=horizontal`；
  - `aria-label=Project`；
- Commit 面板工具条：
  - `role=toolbar`；
  - `aria-label=Commit`；
- 普通工具栏命令仍无 `aria-pressed`；
- Changes 的真实“显示差异”切换项仍保留 `aria-pressed=false`。

**回归**：

```bash
node --test tests/round422.test.mjs tests/round390.test.mjs \
  tests/round397.test.mjs tests/round401.test.mjs \
  tests/round219.test.mjs tests/round400.test.mjs \
  tests/round394.test.mjs tests/round418.test.mjs \
  tests/syntax.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
git diff --check
```

- RED：`round422` 初始 **3 fail / 0 pass**；
- GREEN：目标与相邻回归 **32 pass / 0 fail**；
- 全量：`npm test` = **1400 pass / 0 fail**；
- `node --check` 与 `git diff --check` 通过。

**下一步**：

- 复核 Commit Diff 在窄宽度下 `»` 内切换项的可访问状态；
- 继续检查 Project / Commit 工具条内剩余命令的 name/role 一致性；
- 保持 1400+ 全量回归并同步 README / engineering-memory / 计划。

## 2026-11-15 — Markdown alert 在窄代码/预览分栏中的可用宽度

**作用域**：Markdown / MDX 的 `代码和预览` 模式、预览内容容器、
Markdown 本地链接错误条与超窄 pane 可读性。

**原缺口**：

- `markdownPreviewContent` 固定 `padding: 20px 24px 48px`；
- 左代码右预览时预览 pane 实测约 `102px`；
- 两侧各 24px 后，正文与 alert 只剩约 `48.5px`；
- 长路径错误被压成 `685px` 高的窄列，虽然没有横向溢出，
  但阅读成本明显过高。

**修复**：

- Markdown preview pane 标记为 `container-type: inline-size`；
- 内容水平内边距改为
  `clamp(8px, 12cqw, 24px)`；
- 宽预览仍使用 24px 阅读边距；
- 窄分栏按容器宽度收缩边距，把空间留给正文和 alert；
- alert 的完整路径、`role=alert`、`overflow-wrap:anywhere`、
  `word-break:break-word` 与无横向溢出不改动。

**运行态验证**：

- 预览独占：
  - pane `203.953125px`；
  - 内容左右 padding 均 `24px`；
  - alert `154.953125px`，高度 `143.5px`；
- 代码/预览分栏：
  - pane `102.484375px`，内容
    `padding-left/right=12.1781px`；
  - alert 从修复前 `48.484375px` 提升到 `72.140625px`；
  - alert 高度从 `685.375px` 降到 `366.625px`；
  - 路径末尾 `segmentsegmentsegment.md` 仍完整；
  - pane 与 alert 均无横向溢出；
- 代码模式：预览 pane `display:none`，代码区占满约 `204px`。

**回归**：

```bash
node --test tests/round421.test.mjs tests/round409.test.mjs \
  tests/round404.test.mjs tests/round399.test.mjs \
  tests/round396.test.mjs tests/round385.test.mjs \
  tests/syntax.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
git diff --check
```

- RED：`round421` 初始 **2 fail / 0 pass**；
- GREEN：目标与相邻回归 **22 pass / 0 fail**；
- 全量：`npm test` = **1396 pass / 0 fail**；
- `node --check` 与 `git diff --check` 通过。

**下一步**：

- 复核 Project 工具栏同类 IDEA 动作优先级；
- 审计 Activity Stripe 的 `tablist` 与按钮 pressed 语义是否一致；
- 保持 1396+ 全量回归并同步 README / engineering-memory / 计划。

## 2026-11-15 — 工具栏普通命令不再伪装成未按下切换按钮

**作用域**：`ToolbarButton`、Project `PanelToolbar`、Commit Changes
`CompactActionBar`、Commit/Compare Diff 直接工具栏及辅助技术语义。

**原缺口**：

- `ToolbarButton.active` 默认 `false`，并始终输出 `aria-pressed`；
- 普通“刷新 / 隐藏 / 打开本地版本 / 关闭差异编辑器”被辅助技术读成
  “未按下的切换按钮”；
- Project、Changes 与 Diff 的动态映射又把
  `action.active === true` 写给按钮，把“未声明”强制成 `false`；
- overflow 菜单本身已有正确的 `menuitem` /
  `menuitemcheckbox` 区分，直接工具栏却没有同等语义。

**修复**：

- `ToolbarButton.active` 默认值改为 `undefined`；
- pressed class、背景样式和 `aria-pressed` 都只在
  `active === true` 或 `typeof active === 'boolean'` 时生效；
- 新增 `toolbarActionActive(action)`，只保留 boolean 的
  `true/false`，普通命令继续返回 `undefined`；
- Project、Changes、Diff 三个直接动作映射统一复用该函数；
- overflow 菜单、disabled、键盘入口和动作顺序保持不变。

**运行态验证**：

- Project 直接工具栏：
  - `全部收起 / 选项 / 隐藏 / 更多操作`
    均为 `aria-pressed=null`；
- Commit Diff 直接工具栏：
  - `打开本地版本 / 更多操作 / 关闭差异编辑器`
    均为 `aria-pressed=null`；
  - 真实“切换双栏/单栏对比”为 `aria-pressed=true`；
- 切到单栏后 overflow：
  - “切换双栏/单栏对比”为 `aria-checked=false`；
  - “展开未修改区域”仍为 `aria-checked=true`；
- 普通菜单项仍为 `menuitem`，复选项仍为 `menuitemcheckbox`。

**回归**：

```bash
node --test tests/round420.test.mjs tests/round418.test.mjs \
  tests/round313.test.mjs tests/round396.test.mjs \
  tests/round397.test.mjs tests/syntax.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
git diff --check
```

- RED：`round420` 初始 **3 fail / 0 pass**；
- GREEN：目标与相邻回归 **19 pass / 0 fail**；
- 全量：`npm test` = **1394 pass / 0 fail**；
- `node --check` 与 `git diff --check` 通过。

**下一步**：

- 复核 Markdown alert 在代码/预览分栏模式中的宽度变化；
- 复核 Project 工具栏同类 IDEA 动作优先级；
- 保持 1394+ 全量回归并同步 README / engineering-memory / 计划。

## 2026-11-15 — 工具栏 overflow 菜单键盘入口

**作用域**：Project `PanelToolbar`、Commit Changes
`CompactActionBar` 的 `»` 按钮、自定义菜单和 ARIA popup 语义。

**原缺口**：

- Terminal `»` 已支持 Shift+F10/ContextMenu；
- Project 与 Changes 的 `»` 只响应点击/Enter；
- Shift+F10 不会打开自定义 overflow 菜单，可能落回浏览器默认菜单；
- overflow 按钮没有 `aria-haspopup` / `aria-expanded`。

**修复**：

- `ToolbarButton` 增加可选：
  - `onKeyDown`；
  - `onContextMenu`；
  - `ariaHasPopup`；
  - `ariaExpanded`；
- `PanelToolbar` 与 `CompactActionBar` 分别抽出
  `openOverflowMenu(rect)`；
- 点击、Shift+F10、ContextMenu 共用同一 builder；
- 所有 overflow opener 暴露
  `aria-haspopup="menu"` 与实时 `aria-expanded`；
- 原有动作顺序、分组、disabled 和焦点恢复不变。

**运行态验证**：

- Project `»`：
  - `aria-haspopup=menu`；
  - Shift+F10 后 `aria-expanded=true`；
  - 菜单项 `新建文件/目录 / 定位当前文件 / 展开所选`；
  - 1 条语义分隔；
  - 首焦点 `newEntry`；
- Changes `»`：
  - `aria-haspopup=menu`；
  - Shift+F10 后 `aria-expanded=true`；
  - 菜单项 `创建补丁 / 暂存所有已跟踪 / 选择打开文件 /
    展开所有 / 收起所有`；
  - 2 条语义分隔；
  - 首焦点 `selectOpened`。

**回归**：

```bash
node --test tests/round418.test.mjs tests/round392.test.mjs \
  tests/round394.test.mjs tests/round400.test.mjs \
  tests/round387.test.mjs tests/syntax.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
git diff --check
```

- RED：`round418` 初始 **3 fail / 0 pass**；
- GREEN：目标与相邻回归 **21 pass / 0 fail**；
- 全量：`npm test` = **1391 pass / 0 fail**；
- `node --check` 与 `git diff --check` 通过。

**下一步**：

- 复核 Markdown alert 在代码/预览分栏模式中的宽度变化；
- 复核 Project 工具栏同类 IDEA 动作优先级；
- 保持 1391+ 全量回归并同步 README / engineering-memory / 计划。

## 2026-11-15 — Terminal 标签可访问名与拖拽焦点

**作用域**：Terminal 可见 tab、辅助技术名称、拖拽重排和
roving keyboard focus。

**原缺口**：

- tab 的可见内容同时包含标题、exited 标记和关闭 `×`，
  没有稳定 `aria-label` 时名称可能混入关闭控件文字；
- HTML5 dragstart 不会像 click 一样可靠聚焦 roving tab；
- 拖拽 reorder 后若焦点离开标签，方向键/Shift+F10 的上下文不明确。

**修复**：

- 每个 `role=tab` 增加 `aria-label=terminal.title`；
- dragstart 立即 `currentTarget.focus()`；
- dragend 同样确保焦点留在被拖标签；
- activeId、tabIndex、拖拽排序和 PTY 生命周期不变。

**运行态验证**：

- Harness 收起后，Terminal tab strip 宽 `258px`；
- 两个标签均可访问：
  - fixture shell：`aria-label` 为完整 shell 地址；
  - `zsh`：`aria-label=zsh`；
- 真实 `dragAndDrop` 前顺序：
  `fixture shell → zsh`；
- 拖拽后顺序：
  `zsh → fixture shell`；
- active tab 仍为 fixture shell；
- 拖拽结束焦点：
  - `role=tab`；
  - `aria-selected=true`；
  - `tabIndex=0`；
  - `aria-label` 为完整 fixture shell 地址。

**回归**：

```bash
node --test tests/round417.test.mjs tests/round410.test.mjs \
  tests/round416.test.mjs tests/round342.test.mjs \
  tests/round114.test.mjs tests/syntax.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
git diff --check
```

- RED：`round417` 初始 **2 fail / 0 pass**；
- GREEN：目标与相邻回归 **18 pass / 0 fail**；
- 全量：`npm test` = **1388 pass / 0 fail**；
- `node --check` 与 `git diff --check` 通过。

**下一步**：

- 复核 Markdown alert 在代码/预览分栏模式中的宽度变化；
- 复核 Project 工具栏同类 IDEA 动作优先级；
- 保持 1388+ 全量回归并同步 README / engineering-memory / 计划。

## 2026-11-15 — Terminal `»` 菜单键盘入口

**作用域**：Terminal tab strip 的 `»` 溢出按钮、隐藏终端菜单、
Shift+F10/ContextMenu、菜单锚点。

**审计结论**：

- Project 主工具栏顺序已与 IDEA 一致；
- Terminal 可见 tab 已支持 Shift+F10/ContextMenu；
- `»` 原本只支持 Enter/点击，标准 Shift+F10 不会打开隐藏标签菜单；
- 旧菜单 x 使用 `anchor.left - 120`，菜单右缘与按钮不对齐。

**修复**：

- 抽出 `openTerminalOverflowMenu(anchor)`；
- 点击、Shift+F10、ContextMenu 共用同一 builder；
- 菜单 x 改为 `anchor.right - 188`，与 IDEA 工具栏右缘锚定一致；
- 隐藏终端仍带颜色条、标题和 exited 标记；
- 选择隐藏终端后沿用 round 410 的焦点回写。

**运行态验证**：

- DSH Web（隔离 `DSH_HOME`、profile `editor-test`、端口 `63113`）；
- Terminal 有两个标签，`»` aria-label 为
  `还有 1 个终端标签`；
- `»` 聚焦后 Shift+F10：
  - 菜单打开；
  - 菜单项为隐藏终端 `zsh`；
  - 首焦点 `tab:<id>`；
  - overflow rect right `610px`，menu rect right `612px`；
- 按 Enter 选择隐藏终端：
  - 菜单关闭；
  - 新终端成为活动可见 tab；
  - 焦点为 `role=tab`、`aria-selected=true`、`tabIndex=0`。

**回归**：

```bash
node --test tests/round416.test.mjs tests/round410.test.mjs \
  tests/round342.test.mjs tests/round114.test.mjs \
  tests/round214.test.mjs tests/syntax.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
git diff --check
```

- RED：`round416` 初始 **2 fail / 0 pass**；
- GREEN：目标与相邻回归 **19 pass / 0 fail**；
- 全量：`npm test` = **1386 pass / 0 fail**；
- `node --check` 与 `git diff --check` 通过。

**下一步**：

- 复核 Markdown alert 在代码/预览分栏模式中的宽度变化；
- 审计 Terminal tab 的拖拽重排与 roving focus 组合行为；
- 复核 Project 工具栏同类 IDEA 动作优先级；
- 保持 1386+ 全量回归并同步 README / engineering-memory / 计划。

## 2026-11-15 — Changes 工具栏按 IDEA 优先级排序

**作用域**：Commit Changes 紧凑动作条、200px 直接按钮、
`»` 溢出菜单和语义动作组。

**IDEA 对照证据**：

- IDEA Commit Changes 直接工具栏顺序：
  `Refresh / Rollback / Show Diff / Changelists / Shelve /
  View Options / Select Opened File / Expand All / Collapse All`；
- DSH 旧实现把 Rollback 放在所有视图和还原动作之后；
- 宽工具栏与溢出菜单都没有反映 IDEA 的高频动作优先级。

**修复**：

- DSH 已实现动作统一重排为：
  `Refresh / Rollback / Show Diff / Combined Diff /
  Copy Patch / Create Patch / Stage All Tracked /
  View Options / Select Opened / Expand Changes / Collapse Changes`；
- Rollback 从 trailing `destructive` 组移到 `local` 组；
- Refresh / View Options 继续 pinned；
- disabled、计数文案、二次确认、active 和回调语义不变。

**运行态验证**：

- DSH Web（隔离 `DSH_HOME`、profile `editor-test`、端口 `63113`）；
- Commit Changes 工具栏宽度 `200px`；
- 直接按钮顺序：
  `刷新 / 还原所选更改 / 显示差异 / 显示所选文件的合并差异 /
  作为补丁复制到剪贴板 / 视图选项 / 更多操作`；
- `»` 菜单顺序：
  - `从本地更改创建补丁…`
  - `暂存所有已跟踪文件`
  - `在更改视图中选择打开的文件`
  - `展开所有更改`
  - `收起所有更改`
- 菜单含 2 条真实语义分隔，首焦点落到
  `selectOpened`。

**回归**：

```bash
node --test tests/round415.test.mjs tests/round387.test.mjs \
  tests/round391.test.mjs tests/round400.test.mjs \
  tests/round282.test.mjs tests/syntax.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
git diff --check
```

- RED：`round415` 初始 **2 fail / 0 pass**；
- GREEN：目标与相邻回归 **20 pass / 0 fail**；
- 全量：`npm test` = **1384 pass / 0 fail**；
- `node --check` 与 `git diff --check` 通过。

**下一步**：

- 复核 Markdown alert 在代码/预览分栏模式中的宽度变化；
- 审计 Terminal tab 的拖拽重排与 roving focus 组合行为；
- 复核 Project 工具栏的同类 IDEA 动作优先级；
- 保持 1384+ 全量回归并同步 README / engineering-memory / 计划。

## 2026-11-15 — Commit 详情切换提交后的双向复位

**作用域**：Commit Log 详情 `region`、纵向长正文、横向长路径、
提交切换与同 hash 刷新。

**后续缺口**：

- round 411 已在新提交时把 `scrollTop` 归零；
- round 412 允许详情横向滚动完整文件路径；
- 如果用户横向滚到长路径末尾再选择另一条提交，
  旧 `scrollLeft` 会保留，新提交左侧状态列和路径开头落到视口外；
- 同 hash 的文件可用性刷新仍应保留两个轴的位置。

**修复**：

- `detail.hash` 变化时同时设置：
  - `scrollTop=0`；
  - `scrollLeft=0`；
- effect 仍只依赖 `detail?.hash`；
- 不监听整个 `detail`，避免局部刷新跳位。

**运行态验证**：

- 隔离 fixture 临时提交长路径
  `docs/round414-horizontal-reset-segment×7.ts`；
- 长路径详情横向滚到 `scrollLeft=305`；
- 切换到 baseline：
  - `scrollLeft=0`；
  - `scrollTop=0`；
  - 详情从主体标题与左侧状态列开始显示；
- 再切回长路径提交，设置 `scrollLeft=200` 并触发同 hash
  文件状态刷新，3.4 秒后仍为 `200`；
- fixture 分支恢复到原 `HEAD e3df56d`；
- 原 staged README 与 untracked 文件状态保持不变。

**回归**：

```bash
node --test tests/round414.test.mjs tests/round411.test.mjs \
  tests/round412.test.mjs tests/round413.test.mjs \
  tests/syntax.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
git diff --check
```

- RED：`round414` 初始 **2 fail / 1 pass**；
- GREEN：目标与相邻回归 **12 pass / 0 fail**；
- 全量：`npm test` = **1382 pass / 0 fail**；
- `node --check` 与 `git diff --check` 通过。

**下一步**：

- 复核 IDEA 中 Project / Commit 工具栏在 200px 下的剩余动作优先级；
- 复核 Markdown alert 在代码/预览分栏模式中的宽度变化；
- 审计 Terminal tab 的拖拽重排与 roving focus 组合行为；
- 保持 1382+ 全量回归并同步 README / engineering-memory / 计划。

## 2026-11-15 — Project / Commit Shift+Wheel 横向读取

**作用域**：Project tree、Commit Changes、Commit Log list、
Commit Log 详情、横向 overflow 与鼠标滚轮。

**审计结论**：

- Project 树行没有 `tabIndex` 是设计而非缺陷：
  虚拟焦点由 `role=tree` 容器持有，方向键更新选中并滚动；
- Project / Changes / Log 均已有横向 overflow；
- 普通鼠标只有 `deltaY`，缺少明确的横向读取入口。

**原实现问题**：

- 首版使用 React `onWheel` 将 Shift+Wheel 的 `deltaY`
  映射到 `scrollLeft`；
- 运行态 Changes 同时出现 `scrollLeft=48` 和 `scrollTop=35`；
- Chromium 对 React 委托的 wheel 监听带有被动语义，
  `preventDefault()` 没有可靠阻止纵向默认滚动。

**修复**：

- 新增纯函数 `shiftWheelScrollLeft()`：
  - 非 Shift 返回 null；
  - `deltaY` 映射到 `scrollLeft`；
  - 按 `scrollWidth - clientWidth` 夹紧；
- 新增 `applyShiftWheelScroll()`；
- 新增 `bindShiftWheelScroll()`，显式注册
  `addEventListener('wheel', ..., { passive:false })`；
- ProjectPanel、CommitPanel Changes、CommitLog list 和
  CommitLog detail 分别绑定/清理原生监听。

**运行态验证**：

- Project：
  - `clientWidth=200`、`scrollWidth=604`、max `404`；
  - Shift+Wheel 后 `scrollLeft=181`、`scrollTop=0`；
- Changes：
  - max `48`；
  - Shift+Wheel 后 `scrollLeft=48`、`scrollTop=0`；
- 不再出现横向与纵向同时滚动。

**回归**：

```bash
node --test tests/round413.test.mjs tests/round412.test.mjs \
  tests/round411.test.mjs tests/round406.test.mjs \
  tests/round403.test.mjs tests/syntax.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
git diff --check
```

- RED：`round413` 初始 **1 fail / 0 pass**；
- GREEN：目标与相邻回归 **16 pass / 0 fail**；
- 全量：`npm test` = **1380 pass / 0 fail**；
- `node --check` 与 `git diff --check` 通过。

**下一步**：

- 复核 IDEA 中 Project / Commit 工具栏在 200px 下的剩余动作优先级；
- 复核 Markdown alert 在代码/预览分栏模式中的宽度变化；
- 审计 Terminal tab 的拖拽重排与 roving focus 组合行为；
- 保持 1380+ 全量回归并同步 README / engineering-memory / 计划。

## 2026-11-15 — Commit Log 文件详情长路径

**作用域**：Commit Log 提交详情文件列表、长路径、
200px 工具窗横向读取。

**原缺口**：

- 文件详情路径使用 `text-overflow: ellipsis`；
- 长路径尾部被隐藏，窗口内无法完整读取，只能依赖 title；
- 详情区域本身已有横向 overflow 和主题滚动条，
  却没有让文件内容使用它；
- IDEA Log 文件表使用横向列读取完整路径。

**修复**：

- `logFiles`：`width:max-content`、`minWidth:100%`；
- 文件行：`width:max-content`、`minWidth:max-content`；
- 路径：`flex:0 0 auto`、`minWidth:max-content`、
  `overflow:visible`、`textOverflow:clip`；
- 详情 `region` 继续作为唯一横向滚动容器；
- 短路径仍至少铺满详情宽度。

**运行态验证**：

- 隔离 fixture 临时提交
  `docs/very-long-log-path-segment×8.ts`；
- DSH Commit 工具窗保持 200px：
  - 详情 `clientWidth=200`、`scrollWidth=508`；
  - `overflow-x=auto`；
  - `scrollLeft` 可从 `0` 到 `308` 末端；
  - 文件行 `clientWidth=scrollWidth=498`；
  - 路径文本长度 `83`，`clientWidth=scrollWidth=467`；
  - `overflow=visible`、`textOverflow=clip`；
  - 路径末尾 `...segment.ts` 完整保留；
- 测试后 fixture 分支恢复到原 `HEAD e3df56d`；
- 原 staged README 与 untracked 文件状态保持不变。

**回归**：

```bash
node --test tests/round412.test.mjs tests/round411.test.mjs \
  tests/round408.test.mjs tests/round407.test.mjs \
  tests/round406.test.mjs tests/syntax.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
git diff --check
```

- RED：`round412` 初始 **1 fail / 1 pass**；
- GREEN：目标与相邻回归 **15 pass / 0 fail**；
- 全量：`npm test` = **1378 pass / 0 fail**；
- `node --check` 与 `git diff --check` 通过。

**下一步**：

- 复核 IDEA 中 Project / Commit 工具栏在 200px 下的剩余动作优先级；
- 复核 Markdown alert 在代码/预览分栏模式中的宽度变化；
- 审计 Terminal tab 的拖拽重排与 roving focus 组合行为；
- 保持 1378+ 全量回归并同步 README / engineering-memory / 计划。

## 2026-11-15 — Commit 详情切换提交后的滚动复位

**作用域**：Commit Log 详情 `region`、长提交正文、提交切换和
同 hash 局部刷新。

**原缺口**：

- 详情区是可滚动 `region`，但内容替换不会自动重置 `scrollTop`；
- 用户滚到长提交正文中部后选择另一条提交，新提交可能从中间开始，
  标题、作者和文件列表开头不可见；
- 若监听整个 `detail` 对象，文件可用性轮询造成的同提交重渲染
  会把用户阅读位置错误地拉回顶部。

**修复**：

- 新增 `detailScrollRef`；
- `detail.hash` 变化时设置 `region.scrollTop = 0`；
- effect 仅依赖 `detail?.hash`，同一提交的局部重渲染保留位置；
- 不影响 Log 列表自身的滚动 offset 恢复。

**运行态验证**：

- 隔离 fixture 中临时创建带 90 行正文的空提交；
- 选择长提交并将详情滚到底：
  - `scrollTop=2788`；
  - `scrollHeight=3061`；
  - `clientHeight=273`；
- 切换到 baseline：
  - baseline 详情 `scrollTop=0`；
  - 标题/作者/文件列表从顶部显示；
- 再切回长提交，设置 `scrollTop=500` 并触发同 hash 的文件可用性刷新：
  - 3.4 秒后仍为 `scrollTop=500`；
- 测试完成后 fixture 分支恢复到原 `HEAD e3df56d`，
  暂存 README 与原有 untracked 状态保持不变。

**回归**：

```bash
node --test tests/round411.test.mjs tests/round408.test.mjs \
  tests/round407.test.mjs tests/round406.test.mjs \
  tests/syntax.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
git diff --check
```

- RED：`round411` 初始 **2 fail / 0 pass**；
- GREEN：目标与相邻回归 **13 pass / 0 fail**；
- 全量：`npm test` = **1376 pass / 0 fail**；
- `node --check` 与 `git diff --check` 通过。

**下一步**：

- 复核 IDEA 中 Project / Commit 工具栏在 200px 下的剩余动作优先级；
- 复核 Markdown alert 在代码/预览分栏模式中的宽度变化；
- 审计 Terminal tab 的拖拽重排与 roving focus 组合行为；
- 保持 1376+ 全量回归并同步 README / engineering-memory / 计划。

## 2026-11-15 — Terminal 标签键盘与 roving focus

**作用域**：Terminal dock 可见标签、`»` 溢出菜单、键盘焦点和
标签上下文菜单。

**原缺口**：

- 可见终端标签是普通 `div`，没有 `role=tab`、
  `aria-selected` 或 roving `tabIndex`；
- 键盘只能依赖全局 `⌘1–9` / `⌥←→`，无法 Tab 进入标签栏后
  用方向键操作；
- 可见标签没有键盘入口打开其上下文菜单；
- `»` 和可见标签之间没有方向键衔接；
- 从 `»` 选择隐藏标签后，原按钮随重新布局消失，焦点会掉回页面。

**修复**：

- Terminal tabs 容器使用 `role=tablist` 与
  `aria-label=终端标签`；
- 可见标签使用 `role=tab`、`aria-selected`、
  `data-dsh-terminal-tab-id`；
- roving `tabIndex`：活动标签 `0`，其他可见标签 `-1`；
- `←/→` 移动并激活可见标签，`Home/End` 跳首尾，
  `Enter/Space` 激活；
- `Shift+F10` / ContextMenu 锚定当前标签打开现有菜单；
- 最后一个可见标签按 `→` 聚焦 `»`；
  `»` 按 `←` 返回最后可见标签；
- 从 `»` 选择隐藏标签后，下一次渲染主动聚焦新可见 tab；
- 鼠标和键盘共用 `openTerminalTabMenu()`，保留 Split Right、
  Move to Editor、焦点切换、颜色、README 等 disabled 语义。

**运行态验证**：

- DSH Web（隔离 `DSH_HOME`、profile `editor-test`、端口 `63113`）；
- Terminal 可见标签：
  - `role=tab`；
  - `aria-selected=true`；
  - `tabIndex=0`；
  - 存在 1 个隐藏标签，`»` 标签为
    `还有 1 个终端标签`；
- 聚焦活动 tab 后按 `Shift+F10`：
  - 菜单打开并聚焦 `rename`；
  - 菜单包含移动、复制、README、Move to Editor、
    Switch Focus To Editor、Close 等 IDEA 动作；
- `→`：焦点进入
  `BUTTON.dsh-editor-terminal-overflow / 还有 1 个终端标签`；
- `←`：焦点回到 `DIV[role=tab][tabIndex=0]`；
- `»` 上按 Enter 打开隐藏标签菜单，再按 Enter：
  - 菜单关闭；
  - 被选终端成为活动可见 tab；
  - 焦点为新 tab，`role=tab`、`aria-selected=true`、
    `tabIndex=0`。

**回归**：

```bash
node --test tests/round410.test.mjs tests/round212.test.mjs \
  tests/round342.test.mjs tests/round114.test.mjs \
  tests/round214.test.mjs tests/round50.test.mjs \
  tests/syntax.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
git diff --check
```

- RED：`round410` 初始 **3 fail / 0 pass**；
- GREEN：目标与相邻回归 **26 pass / 0 fail**；
- 全量：`npm test` = **1374 pass / 0 fail**；
- `node --check` 与 `git diff --check` 通过。

**下一步**：

- 复核 IDEA 中 Project / Commit 工具栏在 200px 下的剩余动作优先级；
- 复核 Commit Log 详情在长提交正文下的滚动位置恢复；
- 复核 Markdown alert 在代码/预览分栏模式中的宽度变化；
- 保持 1374+ 全量回归并同步 README / engineering-memory / 计划。

## 2026-11-15 — Markdown 链接错误长路径换行

**作用域**：Markdown 预览本地链接错误条、窄编辑器内容区、
无空格长路径与错误消息完整可读性。

**原缺口**：

- `markdownLinkError` 只有 `whiteSpace: pre-wrap`；
- 没有 `overflowWrap` / `wordBreak` / `maxWidth`；
- 本地化消息包含完整工作区相对路径；无空格长文件名在
  约 200px 的预览内容区可能产生横向溢出；
- 截断或省略路径会破坏用户定位失败目标的能力。

**修复**：

- 错误条增加：
  - `boxSizing: border-box`；
  - `maxWidth: 100%`；
  - `overflowWrap: anywhere`；
  - `wordBreak: break-word`；
- 保留 `whiteSpace: pre-wrap`、完整消息和 `role=alert`；
- 不使用 ellipsis，超长路径通过多行展示。

**运行态验证**：

- fixture 创建 `alert-long-probe.md`，链接到
  `docs/` 下 180 字符、无空格且不存在的 `.md` 路径；
- 实际编辑器打开预览后，Markdown 预览 pane：
  - `clientWidth=253`、`scrollWidth=253`；
- 错误条：
  - 文本长度 `206`；
  - `clientWidth=203`、`scrollWidth=203`；
  - `alertWidth=204.609375px`；
  - 高度 `143.5px`，约 9 行；
  - 末尾仍是完整 `.md` 路径，没有遗漏或省略；
- 计算样式：
  - `overflow-wrap=anywhere`；
  - `word-break=break-word`；
  - `white-space=pre-wrap`。

**回归**：

```bash
node --test tests/round409.test.mjs tests/round404.test.mjs \
  tests/round399.test.mjs tests/round396.test.mjs \
  tests/round385.test.mjs tests/syntax.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
git diff --check
```

- RED：`round409` 初始 **1 fail / 1 pass**；
- GREEN：目标与相邻回归 **20 pass / 0 fail**；
- 全量：`npm test` = **1371 pass / 0 fail**；
- `node --check` 与 `git diff --check` 通过。

**下一步**：

- 复核 IDEA 中 Project / Commit 工具栏在 200px 下的剩余动作优先级；
- 审计 Terminal 标签在超窄 dock 下的 `»` 菜单锚点与键盘顺序；
- 复核 Commit Log 详情在长提交正文下的滚动位置恢复；
- 保持 1371+ 全量回归并同步 README / engineering-memory / 计划。

## 2026-11-15 — Log 详情滚动面与 Terminal 溢出语义

**作用域**：Commit Log 提交详情滚动区、键盘焦点；Terminal 标签栏
的 `»` 溢出行为。

**IDEA 对照**：

- Computer Use AX 检查 IDEA Git Log：
  - 提交表和详情区各自是独立 `scroll area`；
  - 每个 scroll area 都提供自身滚动条；
- IDEA Terminal 标签保持固定可读宽度，放不下的标签进入
  `»` 下拉，不启用整条标签栏的横向滚动。

**原缺口**：

- Commit Log 列表已经有 `dsh-editor-tool-scroll`；
- 提交详情仍直接使用 `styles.commitScroll`，没有主题化滚动条；
- 详情区域没有独立 `region` 语义和 Tab 焦点入口；
- Terminal tabs 已通过 `overflowTabs + »` 正确表达溢出，
  不应为了“统一滚动”误改成横向滚动。

**修复**：

- 详情滚动面增加：
  - `dsh-editor-tool-scroll`；
  - `role="region"`；
  - `aria-label=提交详情`；
  - `tabIndex=0`；
- 保持 `styles.commitScroll` 的 `overflow: auto` 和既有布局；
- Terminal tabs 保持 `overflow: hidden`，隐藏标签进入
  `dsh-editor-terminal-overflow` 菜单。

**运行态验证**：

- DSH Web（隔离 `DSH_HOME`、profile `editor-test`、端口 `63113`）：
  - Commit → Log → 选择 `baseline`；
  - 详情 `role=region`、`aria-label=提交详情`；
  - `tabIndex=0`，`clientWidth=200`；
  - `className=dsh-editor-tool-scroll`；
  - `overflow-x/y=auto`、`scrollbar-width=thin`；
  - WebKit scrollbar height `8px`；
  - 键盘 `focus + ArrowDown` 后活动元素仍为该 region；
- Terminal 标签仍使用 `overflow: hidden` + `»`，
  `overflowTabs(dockTerminals, ...)` 逻辑未变。

**回归**：

```bash
node --test tests/round408.test.mjs tests/round407.test.mjs \
  tests/round406.test.mjs tests/round50.test.mjs \
  tests/round148.test.mjs tests/round214.test.mjs \
  tests/syntax.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
git diff --check
```

- RED：`round408` 初始 **1 fail / 1 pass**；
- GREEN：目标与相邻回归 **29 pass / 0 fail**；
- 全量：`npm test` = **1369 pass / 0 fail**；
- `node --check` 与 `git diff --check` 通过。

**下一步**：

- 复核 Markdown 预览内部 alert 的宽度与长路径换行；
- 复核 IDEA 中 Project / Commit 工具栏在 200px 下的剩余动作优先级；
- 审计 Terminal 标签在超窄 dock 下的 `»` 菜单锚点与键盘顺序；
- 保持 1369+ 全量回归并同步 README / engineering-memory / 计划。

## 2026-11-15 — Commit Log 重复 ref 修复

**作用域**：Commit Log flat/Graph 列表、键盘焦点、`Shift+F10`
上下文菜单锚点、Changes/Log 滚动位置恢复。

**症状与触发条件**：

- Commit Log 的 `role="listbox"` props 同时声明：
  - `ref: listRef`；
  - 后面的 `ref: scrollRefs?.log`；
- 对象字面量中后一个 `ref` 覆盖前一个；
- React 只写 `commitLogRef.current`，本地 `listRef.current` 永远为空；
- 表现为：
  - 打开提交图后焦点仍停在 Graph 工具栏按钮；
  - Graph/Flat 的 `Shift+F10` 找不到当前行，菜单可能落到
    `x=4, y=0`；
  - 点击日志行时无法把键盘焦点还给列表。

**根因**：

- 同一 React element 不支持两个 `ref` prop；
- 父层滚动 ref 与组件内焦点 ref 都需要同一个 DOM 节点，
  但旧实现用重复键分别传递。

**修复**：

- 新增稳定 callback ref：

  ```js
  const logScrollRef = scrollRefs?.log ?? null;
  const setLogListRef = React.useCallback((node) => {
    listRef.current = node;
    if (logScrollRef !== null) logScrollRef.current = node;
  }, [logScrollRef]);
  ```

- Log list 只保留 `ref: setLogListRef`；
- 本地焦点和父层滚动恢复共享同一真实节点；
- 不改变 Changes/Log 已有滚动 offset 的保存与恢复逻辑。

**运行态验证**：

- DSH Web（隔离 `DSH_HOME`、profile `editor-test`、端口 `63113`）：
  - Commit → Log → 提交图；
  - `document.activeElement` 为
    `DIV / role=listbox / aria-label=日志`；
  - `ArrowDown` 后选中 Graph 行；
  - `Shift+F10`：
    - 行 rect `top=156, bottom=207`；
    - 菜单 rect `left=317, top=207`；
    - 菜单紧贴当前行底部，未回落到 `x=4, y=0`；
  - 鼠标点击 Graph 行后焦点再次为 Log `listbox`。

**回归**：

```bash
node --test tests/round407.test.mjs tests/round406.test.mjs \
  tests/round350.test.mjs tests/round287.test.mjs \
  tests/round227.test.mjs tests/syntax.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
git diff --check
```

- RED：`round407` 初始 **2 fail / 0 pass**；
- GREEN：目标与相邻回归 **17 pass / 0 fail**；
- 全量：`npm test` = **1367 pass / 0 fail**；
- `node --check` 与 `git diff --check` 通过。

**下一步**：

- 复核 Terminal 标签与 Project/Commit 的横向滚动交互一致性；
- 复核 Markdown 预览内部 alert 的宽度与长路径换行；
- 复核 IDEA 中 Project / Commit 工具栏在 200px 下的剩余动作优先级；
- 保持 1367+ 全量回归并同步 README / engineering-memory / 计划。

## 2026-11-15 — Project / Commit 工具窗滚动条主题化

**作用域**：Project 文件树、Commit Changes 列表、Commit Log 列表、
长路径横向滚动与浅色/深色主题。

**IDEA 对照**：

- Computer Use 原生 AX 检查 IDEA Changes 工具窗；
- `scroll area` 子树同时暴露横向与纵向 `scroll bar`；
- IDEA 在窄工具窗中保留可拖动的横向滚动通道，
  不只依赖系统 overlay 手势。

**原缺口**：

- Project 与 Commit 已有 `overflow-x: auto`，长行可滚动；
- macOS/Chromium 空闲时不显示 overlay scrollbar，
  用户看不到还有横向内容；
- 浏览器默认 scrollbar 与 DSH 主题 token 脱节。

**修复**：

- Project tree、Changes、Log 共用
  `.dsh-editor-tool-scroll` marker class；
- Firefox 使用 `scrollbar-width: thin` 和
  `scrollbar-color`；
- Chromium/WebKit 使用 8px 轨道、透明 track、
  2px 内缩的圆角 thumb；
- 静止 thumb 使用 `label-tertiary` 48%，
  hover 使用 `label-secondary` 68%，
  active 使用 `state-business-primary`；
- `background-clip: content-box` 保留可点击轨道，
  同时不把 thumb 画成 8px 实心条；
- overlay 绘制不缩窄内容区，200px 工具窗仍保持 200px。

**运行态验证**：

- DSH Web（隔离 `DSH_HOME`、profile `editor-test`、端口 `63113`）：
  - Project：
    - `clientWidth=200`、`scrollWidth=604`；
    - `overflow-x=auto`、`scrollbar-width=thin`；
    - WebKit scrollbar height `8px`；
    - thumb 解析为 label-tertiary 48%；
  - Commit Changes：
    - `clientWidth=200`、`scrollWidth=248`；
    - 真实横向 wheel 后 `scrollLeft=48`，到达末端；
    - scrollbar height `8px`，内容宽度未被 overlay 缩窄；
- 截图在 macOS overlay scrollbar 空闲态可能不捕获 thumb，
  以 computed pseudo/scrollbar 样式和真实 wheel 行为作为运行证据。

**回归**：

```bash
node --test tests/round406.test.mjs tests/round403.test.mjs \
  tests/round169.test.mjs tests/round147.test.mjs tests/syntax.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
git diff --check
```

- RED：`round406` 初始 **3 fail / 0 pass**；
- GREEN：目标与相邻回归 **24 pass / 0 fail**；
- 全量：`npm test` = **1365 pass / 0 fail**；
- `node --check` 与 `git diff --check` 通过。

**下一步**：

- 复核 Terminal 标签与 Project/Commit 的横向滚动交互一致性；
- 复核 Markdown 预览内部 alert 的宽度与长路径换行；
- 复核 IDEA 中 Project / Commit 工具栏在 200px 下的剩余动作优先级；
- 评估 Log 列表重复 `ref` 的清理风险，先只读核实实际生效引用；
- 保持 1365+ 全量回归并同步 README / engineering-memory / 计划。

## 2026-11-15 — 子菜单 hover 焦点不再掉到 body

**作用域**：`ContextMenu` 顶层父项 hover、已打开二级菜单、
键盘焦点恢复、子菜单锚点更新。

**症状与触发条件**：

- 通过键盘进入 Diff Settings 等二级菜单后，焦点位于子项；
- 鼠标 hover 顶层 `重新加载差异` 等另一个父项；
- React 卸载旧子菜单，但旧实现只更新 `itemRect` / `submenu`，
  没有在卸载前转移焦点；
- `document.activeElement` 可能变成 `<body>`，后续方向键和 Esc
  不再属于菜单。

**根因**：

- 子菜单按钮是已打开 popup 的焦点所有者，hover 切换顶层项会先卸载它；
- 旧 `onMouseEnter` 没有区分“普通顶层 hover”和“从子菜单移出”，
  也没有恢复键盘焦点。

**修复**：

- 仅在当前焦点位于子菜单时，hover 才调用
  `event.currentTarget.focus()`；
- 随后仍更新父项 `itemRect` 和 `submenu`，保证新子菜单锚点正确；
- 普通顶层项之间 hover 不主动抢焦点；
- Enter/Space 打开子菜单、Esc 分层关闭、方向键导航保持原行为。

**IDEA 对照**：

- Computer Use 原生 AX 树检查 IntelliJ IDEA
  `View → Tool Windows / Appearance / Status Bar Widgets`，确认菜单为
  明确的嵌套 popup 层级，Esc 逐层取消；
- DSH 采用同样的“子菜单拥有焦点时焦点留在菜单模型内”策略；
- `orca` CLI 当前未安装，本次对照使用内置 Computer Use AX 接口。

**运行态验证**：

- DSH Web（隔离 `DSH_HOME`、profile `editor-test`、端口 `63113`）：
  - 打开 Editor → Commit → README diff → `»`；
  - Settings 用 Enter 展开后，焦点为
    `menuitemcheckbox / whitespace / 忽略空白差异`；
  - 真实 `page.mouse.move()` hover `reloadDiff` 后：
    - 子菜单 DOM 消失，`aria-expanded=false`；
    - 焦点为 `reloadDiff / 重新加载差异`；
    - `document.activeElement` 不是 `<body>`；
  - 无子菜单时从 `reloadDiff` hover `find`：
    焦点仍停留在 `reloadDiff`，菜单数量保持 1；
- Harness 路由复验：
  - 活动条顺序为 `Project / Commit / Terminal / Harness`；
  - 收起后 host 从 `496.609375px` 扩到 `764px`，
    chat width 为 `0%`、composer 为 `display:none`；
  - 再点恢复 `35%` 和 `496.609375px`。

**回归**：

```bash
node --test tests/round405.test.mjs tests/round86.test.mjs \
  tests/round402.test.mjs tests/round393.test.mjs \
  tests/round398.test.mjs tests/syntax.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
git diff --check
```

- RED：`round405` 初始 **2 fail / 1 pass**；
- GREEN：目标与相邻回归 **19 pass / 0 fail**；
- 全量：`npm test` = **1362 pass / 0 fail**；
- `node --check` 与 `git diff --check` 通过。

**下一步**：

- 评估横向滚动条的可见性提示是否需要主题增强；
- 复核 Terminal 标签与 Project/Commit 的横向滚动交互一致性；
- 复核 Markdown 预览内部 alert 的宽度与长路径换行；
- 继续保持全量回归并同步 README / engineering-memory / 计划。

## 2026-11-15 — Markdown 链接错误在成功打开后清除

**作用域**：Markdown 预览 `linkError` 生命周期、同文档有效链接、
预览模式和打开列表稳定性。

**运行态验证**：

- fixture 同时包含：
  - `Missing` → `missing-target.md`；
  - `Self` → 当前 `clear-probe.md`；
- 点击 Missing 后：
  - alert 为
    `Markdown 链接目标无法打开：docs/missing-target.md`；
  - open list 为 `docs/clear-probe.md`；
  - mode 为 `preview`；
- 随后点击 Self：
  - alert 变为 `null`；
  - open list 仍为 `docs/clear-probe.md`；
  - mode 仍为 `preview`；
  - 预览 path 仍为 `docs/clear-probe.md`。

**结论**：

- 现有 `openLocal` 在每次有效链接尝试前 `setLinkError(null)`；
- 只有 `opened === false` 或 Promise reject 时才重新设置错误；
- 成功打开不会保留上一次失败提示；
- 本轮无生产代码变更，新增 `tests/round404.test.mjs` 固化错误清除
  生命周期。

**回归**：

```bash
node --test tests/round404.test.mjs tests/round399.test.mjs \
  tests/round396.test.mjs tests/syntax.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
git diff --check
```

- 目标与相关回归 **11 pass / 0 fail**；
- 全量：`npm test` = **1359 pass / 0 fail**；
- `node --check lib/client.js`、`node --check lib/index.js` 与
  `git diff --check` 通过。

**下一步**：

- 复核子菜单鼠标 hover、键盘进入和离开的焦点策略；
- 评估横向滚动条的可见性提示是否需要主题增强；
- 复核 Terminal 标签与 Project/Commit 的横向滚动交互一致性；
- 复核 Markdown 预览内部 alert 的宽度与长路径换行；
- 保持 1359+ 全量回归并继续同步文档。

## 2026-11-15 — Project / Commit 长行横向读取验证

**作用域**：Project 树、Commit Changes 列表、200px 工具窗中的长路径与
极端长文件名。

**运行态验证**：

- Project tree：
  - `role=tree`，`aria-label=Project`；
  - `clientWidth=200`；
  - `scrollWidth=604`；
  - 可滚动到 `scrollLeft=404`；
  - `overflow-x=auto`；
- Commit Changes：
  - `[data-dsh-changes-list]` 是可聚焦的 `role=tree`；
  - `clientWidth=195`；
  - `scrollWidth=248`；
  - 可滚动到 `scrollLeft=53`；
  - `overflow-x=auto`；
- Project 行的 `min-width/width=max-content` 继续保护完整名称；
- Commit 文件名保持 `max-content`，父路径负责收缩。

**结论**：

- 200px 下极端长行并非永久裁切，两个列表都有横向滚动通道；
- 不需要引入第二套横向滚动/提示组件；
- 本轮无生产代码变更，新增 `tests/round403.test.mjs` 固化滚动容器和
  键盘可聚焦树契约。

**回归**：

```bash
node --test tests/round403.test.mjs tests/round169.test.mjs \
  tests/round147.test.mjs tests/syntax.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
git diff --check
```

- 目标与相关回归 **21 pass / 0 fail**；
- 全量：`npm test` = **1357 pass / 0 fail**；
- `node --check lib/client.js`、`node --check lib/index.js` 与
  `git diff --check` 通过。

**下一步**：

- 补测 Markdown 链接错误在下次成功打开时自动清除；
- 复核子菜单鼠标 hover、键盘进入和离开的焦点策略；
- 评估横向滚动条的可见性提示是否需要主题增强；
- 复核 Terminal 标签与 Project/Commit 的横向滚动交互一致性；
- 保持 1357+ 全量回归并继续同步文档。

## 2026-11-15 — 子菜单键盘激活、锚点与 Esc 往返

**作用域**：`ContextMenu` 子菜单父项、Settings 菜单、键盘 Enter/Space、
子菜单锚点和 Esc 分层关闭。

**原缺口**：

- `→` 已经会调用 `openSubmenu()`，设置父项坐标并把焦点放到首个子项；
- 但 Enter/Space 触发的是父项 `onClick`，原实现只 `setSubmenu`：
  - 没有更新 `itemRect`，子菜单没有可靠锚点；
  - 焦点留在父项，键盘用户还要再按一次方向键才进入子菜单。

**修复**：

- onClick 捕获父按钮 DOM；
- 打开子菜单前更新 `itemRect`；
- 原生 click 的 `event.detail === 0` 视为键盘激活：
  - React 提交子菜单后查找首个 enabled button；
  - 自动把焦点移入子菜单；
- 鼠标点击仍不主动抢焦点；
- 原有 Esc 分层关闭逻辑保持不变。

**运行态验证**：

- `» → 设置` 后用 Enter 打开：
  - 父项 `aria-expanded=false → true`；
  - 焦点进入 `whitespace`，角色 `menuitemcheckbox`；
  - 父项 rect `718–906 × 239–263`；
  - 子菜单 rect `538–718 × 102–239`；
  - 子菜单右边缘与父项左边缘相接，锚点正确；
- 第一次 Esc：
  - 子菜单 DOM 消失；
  - 父项 `aria-expanded=false`；
  - 焦点回到 `settings`；
  - 顶层 `»` 菜单仍打开；
- 第二次 Esc：顶层菜单关闭，页面菜单数 `0`。

**回归**：

```bash
node --test tests/round402.test.mjs tests/round389.test.mjs \
  tests/round393.test.mjs tests/round398.test.mjs \
  tests/round86.test.mjs tests/syntax.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
git diff --check
```

- RED：round402 初始 **2 fail / 1 pass**；
- GREEN：目标与相关回归 **21 pass / 0 fail**；
- 全量：`npm test` = **1354 pass / 0 fail**；
- `node --check lib/client.js`、`node --check lib/index.js` 与
  `git diff --check` 通过。

**下一步**：

- 评估极端长文件名的横向读取方式是否应增加滚动提示；
- 补测 Markdown 链接错误在下次成功打开时自动清除；
- 复核 Project / Commit 行在 200px 下的横向可发现性；
- 复核子菜单鼠标 hover、键盘进入和离开的焦点策略；
- 保持 1354+ 全量回归并继续同步文档。

## 2026-11-15 — Harness 关闭工具按钮的键盘顺序与焦点环

**作用域**：Harness 收起态 Activity Stripe 底部关闭按钮、Tab 顺序、
`:focus-visible` 视觉反馈。

**原缺口**：

- 关闭按钮是原生 `<button>`，可以进入 Tab 顺序；
- 但没有插件级焦点样式，只依赖浏览器默认 outline；
- 该按钮的内联 `background:transparent` 还会覆盖普通 CSS 背景。

**修复**：

- 新增 `.dsh-editor-stripe-close:focus-visible`；
- 使用 IDEA accent 色 1px outline；
- `outline-offset:-3px` 保持描边完全落在 36px stripe 内；
- 焦点背景使用 `interactive-bg-hover`，并加 `!important` 覆盖内联
  transparent。

**运行态验证**：

- 从 Project 开始连续 `Tab`：
  `Project → Commit → Terminal → Harness →
   关闭编辑器工作台 → Project 视图`；
- 关闭按钮获得键盘焦点后：
  - `outline-style=solid`；
  - `outline-width=1px`；
  - `outline-color=rgb(65, 118, 230)`；
  - `outline-offset=-3px`；
  - 背景为 `rgba(38, 49, 72, 0.06)`。

**回归**：

```bash
node --test tests/round401.test.mjs tests/round397.test.mjs \
  tests/syntax.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
git diff --check
```

- RED：round401 初始 **1 fail / 1 pass**；
- GREEN：目标与相关回归 **9 pass / 0 fail**；
- 全量：`npm test` = **1351 pass / 0 fail**；
- `node --check lib/client.js`、`node --check lib/index.js` 与
  `git diff --check` 通过。

**下一步**：

- 复核 Diff Settings 子菜单父项的键盘展开/Esc 往返；
- 评估极端长文件名的横向读取方式是否应增加滚动提示；
- 补测 Markdown 链接错误在下次成功打开时自动清除；
- 复核 Project / Commit 行在 200px 下的横向可发现性；
- 保持 1351+ 全量回归并继续同步文档。

## 2026-11-15 — Project / Commit 200px 最终密度审计

**作用域**：Project、Commit 工具窗口的最小 200px 宽度、工具栏、
Changes 动作条、过滤框、提交信息和底部提交按钮。

**运行态证据**：

- Project 面板实测 `201px`、toolbar `200px`：
  - 标题 `Project:项目` 宽 `85.5px`；
  - 直接按钮 `全部收起 / 选项 / 隐藏 / »`；
  - 最后一个 `»` 右边缘 `516.5px`，面板右边缘 `518px`；
  - 无工具栏裁切；
- Commit 面板实测 `201px`：
  - `scrollWidth = clientWidth = 200px`；
  - 顶部直接按钮 `选项 / 刷新 / 隐藏`，右边缘均不超过 `512px`；
  - Changes 直接按钮包含
    `显示差异 / 合并差异 / 复制补丁 / 创建补丁 / 刷新 /
    视图选项 / »`；
  - 过滤输入框宽度 `172px`，右边缘 `511px`；
  - 提交信息历史按钮右边缘 `509px`；
  - `提交` / `提交并推送…` 位于 `325–509px`，均在面板内。

**边界结论**：

- 工具栏、操作条和可执行按钮没有越过 200px 面板；
- 根目录行与极长文件名仍可超出可视区：
  - Project root 行实测宽 `603.6875px`；
  - `round243-unversioned.txt` 行宽 `209.40625px`；
- 这是既有策略“根路径可收缩、文件名不使用省略号”的极端宽度边界，
  行 `title` 保留完整路径；
- 本轮没有证据支持继续压缩图标、复选框或按钮，避免为了隐藏溢出而
  破坏 IDEA 的点击密度。

**回归**：

```bash
node --test tests/round400.test.mjs tests/round387.test.mjs \
  tests/round392.test.mjs tests/round184.test.mjs \
  tests/syntax.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
git diff --check
```

- 目标与相关回归 **17 pass / 0 fail**；
- 全量：`npm test` = **1349 pass / 0 fail**；
- `node --check lib/client.js`、`node --check lib/index.js` 与
  `git diff --check` 通过。

**结论**：

- 200px 工具栏与提交操作链已满足当前 IDEA 密度目标，无需新增生产代码；
- 新增 `tests/round400.test.mjs` 固化 200px 最小宽度和 pinned action
  契约。

**下一步**：

- 复核 Harness 关闭工具按钮的 Tab 顺序与可见焦点环；
- 复核 Diff Settings 子菜单父项的键盘展开/Esc 往返；
- 评估极端长文件名的横向读取方式是否应增加滚动提示；
- 补测 Markdown 链接错误在下次成功打开时自动清除；
- 保持 1349+ 全量回归并继续同步文档。

## 2026-11-15 — Markdown 缺失链接使用本地化内联反馈

**作用域**：Markdown 预览中的工作区本地链接、`openFile` 错误路径、
预览内 alert。

**原缺口**：

- 点击工作区内缺失文件链接时，`openFile` 捕获异常并写入
  `editorError`；
- 界面直接显示宿主原始错误：
  `ENOENT: no such file or directory, stat '…'`；
- 文案未本地化，也没有明确说明是 Markdown 链接目标。

**修复**：

- 新增双语文案：
  - `Markdown 链接目标无法打开：{path}`；
  - `Could not open the Markdown link target: {path}`；
- `MarkdownPreviewPane` 新增 `linkError` 状态：
  - 消费 `onOpenFile` 的异步 false 结果；
  - 在预览内容顶部显示 `role="alert"`；
  - 标记 `data-dsh-markdown-link-error`；
- `openFile(path, { silentError: true })` 允许 Markdown 链接自己处理错误，
  不再写入全局原始 `editorError`；
- 其他 `openFile` 调用保持原有错误路径，不改变 Project/Commit 行为。

**运行态验证**：

- fixture：`docs/missing-link.md` 指向不存在的
  `docs/missing-target.md`；
- 点击后：
  - 打开列表仍为 `docs/missing-link.md`；
  - 预览中出现
    `Markdown 链接目标无法打开：docs/missing-target.md`；
  - `role=alert`；
  - 编辑器 workspace 文本不再包含 `ENOENT`；
  - 没有第二个全局 error alert。

**回归**：

```bash
node --test tests/round399.test.mjs tests/round396.test.mjs \
  tests/round385.test.mjs tests/round23.test.mjs \
  tests/syntax.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
git diff --check
```

- RED：round399 初始 **2 fail / 0 pass**；
- GREEN：目标与相关回归 **23 pass / 0 fail**；
- 全量：`npm test` = **1346 pass / 0 fail**；
- `node --check lib/client.js`、`node --check lib/index.js` 与
  `git diff --check` 通过。

**下一步**：

- 复核 Project / Commit 工具窗口在 200px 的最终密度；
- 复核 Harness 关闭工具按钮的 Tab 顺序与可见焦点环；
- 复核 Diff Settings 子菜单父项的键盘展开/Esc 往返；
- 评估 Markdown 链接错误在下次成功打开时自动清除的回归覆盖；
- 保持 1346+ 全量回归并继续同步文档。

## 2026-11-15 — Diff Settings 子菜单 current 与 popup 语义

**作用域**：Commit Diff `»` 菜单、Diff Settings 子菜单、
`ContextMenu` 的 checkbox 与 ARIA popup 属性。

**原缺口**：

- Settings 的五个 toggle 已有 `✓`，但没有 boolean `active`；
- ContextMenu 子菜单因此把它们暴露成普通 `menuitem`，辅助技术无法
  判断当前选中的显示设置；
- Settings 父项和所有带子菜单的菜单项都没有 `aria-haspopup` /
  `aria-expanded`。

**修复**：

- `editorSettingsItems` 为五项设置增加真实 boolean：
  - `ignoreWhitespace`；
  - `showWhitespaces`；
  - `showLineNumbers`；
  - `showIndentGuides`；
  - `softWrap`；
- ContextMenu 继续用 boolean active 生成
  `menuitemcheckbox` + `aria-checked`；
- 所有带子菜单的父项增加：
  - `aria-haspopup="menu"`；
  - `aria-expanded=true|false`；
- 主菜单与二级菜单的父项使用同一规则，不改变点击和键盘行为。

**运行态验证**：

- Settings 父项：
  - `role=menuitem`；
  - `aria-haspopup=menu`；
  - 关闭时为 `aria-expanded=false`；
  - 子菜单打开后为 `aria-expanded=true`；
- 子菜单五项：
  - 全部为 `menuitemcheckbox`；
  - `lineNumbers` 默认 `aria-checked=true`；
  - 其余默认 false；
- `ignoreWhitespace`：
  - 初始 `aria-checked=false`、localStorage `0`；
  - Enter 后变为 `true / 1`；
  - 再 Enter 后恢复 `false / 0`；
- 焦点进入 Settings 子菜单时落在首个可用项，方向键逻辑不变。

**回归**：

```bash
node --test tests/round398.test.mjs tests/round393.test.mjs \
  tests/round395.test.mjs tests/round361.test.mjs \
  tests/syntax.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
git diff --check
```

- RED：round398 初始 **2 fail / 1 pass**；
- GREEN：目标与相关回归 **16 pass / 0 fail**；
- 全量：`npm test` = **1344 pass / 0 fail**；
- `node --check lib/client.js`、`node --check lib/index.js` 与
  `git diff --check` 通过。

**下一步**：

- 补一次 Markdown 缺失本地目标的用户反馈验证；
- 复核 Project / Commit 工具窗口在 200px 的最终密度；
- 复核 Harness 关闭工具按钮的 Tab 顺序与可见焦点环；
- 复核 Diff Settings 子菜单父项的键盘展开/Esc 往返；
- 保持 1344+ 全量回归并继续同步文档。

## 2026-11-15 — Harness 收起后仍可关闭 Editor

**作用域**：Harness 聊天最小化、Editor View 行开关、左侧 Activity Stripe、
关闭 Editor 的键盘/鼠标可达性。

**原缺口**：

- Editor 的常规关闭按钮位于 `[data-conversation-tabs]` 右侧；
- Harness 收起把聊天 session 容器整体设为 `display:none`；
- 关闭按钮因此随 View 标签行一起消失，收起态无法直接关闭 Editor；
- 空白会话甚至没有 View 标签行，问题更明显。

**修复**：

- `ActivityStripe` 新增 `onCloseEditor`；
- 仅在 `harnessCollapsed === true` 时，在工具窗口项之后渲染一个
  IDEA 式图标工具按钮：
  - 无文字；
  - `×` 线性图标；
  - 固定到 stripe 底部；
  - `aria-label/title = 关闭编辑器工作台`；
- `EditorWorkspace` 接收 `onCloseEditor`，宿主传入现有
  `setActive(false)` 关闭路径；
- Harness 展开时该按钮消失，原 View 行关闭按钮继续使用，不增加第二套
  常驻关闭入口。

**运行态验证**：

- Harness 收起：
  - stripe 顺序为
    `Project / Commit / Terminal / Harness / 关闭编辑器工作台`；
  - 关闭按钮实测 `36×38px`，位于 stripe 底部；
  - 文本为空，`aria-label` 与 `title` 均为“关闭编辑器工作台”；
- 点击关闭按钮后：
  - 活动 Editor body 数从 1 变为 0；
  - host 进入 `data-dsh-editor-host-idle`；
  - `data-dsh-editor-harness-collapsed` 清除；
  - `--dsh-editor-chat-width` 清除，聊天恢复；
- 重新打开 Editor：
  - 临时 Harness 收起状态继续恢复；
  - chat width 回到 `0%`，host 为 `764px`；
  - 底部关闭工具按钮重新可见；
- Harness 再展开：
  - 工具按钮消失；
  - chat width 恢复 `35%`，host 恢复 `496.609375px`。

**回归**：

```bash
node --test tests/round397.test.mjs tests/round390.test.mjs \
  tests/round95.test.mjs tests/round186.test.mjs \
  tests/round187.test.mjs tests/round188.test.mjs \
  tests/round219.test.mjs tests/syntax.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
git diff --check
```

- RED：round397 初始 **3 fail / 0 pass**；
- GREEN：目标与相关回归 **33 pass / 0 fail**；
- 全量：`npm test` = **1341 pass / 0 fail**；
- `node --check lib/client.js`、`node --check lib/index.js` 与
  `git diff --check` 通过。

**适用边界**：

- 该按钮只在 Harness 收起态出现，不改变 Project/Commit/Terminal 的
  工具窗口 tab 顺序；
- 关闭仍复用原 `setActive(false)`，不会新增独立的 Editor 生命周期；
- Harness 临时状态在 Editor 关闭/重新打开后仍保留，这是既有行为。

**下一步**：

- 复核 Diff Settings 父项在超窄 `»` 中的 current 表达；
- 补一次 Markdown 缺失本地目标的用户反馈验证；
- 复核 Project / Commit 工具窗口在 200px 的最终密度；
- 复核 Harness 关闭工具按钮的键盘 Tab 顺序与可见焦点环；
- 保持 1341+ 全量回归并继续同步文档。

## 2026-11-15 — Markdown 三态窄宽度与本地链接边界验证

**作用域**：Markdown / MDX 的三态切换、约 200px 编辑器内容区、
预览中的本地文件链接和越界链接。

**IDEA 对照证据**：

- Computer Use 读取 IDEA Markdown 编辑器工具栏，确认三个动作：
  `Editor / Editor and Preview / Preview`；
- 本机 IDEA 的 `Editor and Preview` 实际为上下布局；
- 用户先前明确要求 DSH 使用“左代码右预览”，因此继续以用户指定布局
  为准，不把当前 IDEA 的上下布局覆盖到插件上。

**运行态验证**：

- Harness 收起后，把 Project 面板加宽，使 Markdown 内容区实测
  `198px`；
- 三态按钮仍全部可见：
  - 代码 `24×20px`；
  - 代码和预览 `24×20px`；
  - 预览 `24×20px`；
  - 整组 `80px`，右边缘 `1035px`，breadcrumb 右边缘 `1043px`，
    无裁切；
- 模式切换：
  - `代码和预览`：`mode=split`，左右约 `96.5px / 97.5px`；
  - `预览`：`mode=preview`，编辑器 `display:none`，预览占满；
  - `代码`：`mode=code`，预览 `display:none`，编辑器占满；
- `aria-pressed` 始终只有当前模式为 true。

**本地链接验证**：

- 在隔离 fixture 中创建：
  - `docs/link-probe.md`；
  - `docs/inside-target.md`；
- 点击 `Inside file`（`../README.md`）后：
  - 打开列表从 `docs/link-probe.md` 变为
    `docs/link-probe.md|README.md`；
  - 无错误条；
- 点击 `Outside`（`../../../outside.md`）后：
  - 打开列表不变；
  - 页面 URL 不变；
  - 无错误条，越界链接被安全拒绝；
- 预览中的本地链接由宿主 `MarkdownText` 渲染为 file button，
  继续复用 `MarkdownDelegateProvider.openFile`；
- 外部链接仍使用 `_blank` + `noopener,noreferrer`。

**结论**：

- 三态按钮和本地链接链路已经满足本轮目标，无需新增生产代码；
- 新增 `tests/round396.test.mjs` 固化按钮尺寸、本地链接守卫和外部链接
  安全打开契约。

**回归**：

```bash
node --test tests/round396.test.mjs tests/round385.test.mjs \
  tests/round386.test.mjs tests/syntax.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
git diff --check
```

- 目标与相关回归 **17 pass / 0 fail**；
- 全量：`npm test` = **1338 pass / 0 fail**；
- `node --check lib/client.js`、`node --check lib/index.js` 与
  `git diff --check` 通过。

**下一步**：

- 评估并修复 Harness 收起时 Editor 关闭入口不可达的问题；
- 复核 Diff Settings 父项在超窄 `»` 中的 current 表达；
- 补一次 Markdown 缺失本地目标的用户反馈验证；
- 复核 Project / Commit 工具窗口在 200px 的最终密度；
- 保持 1338+ 全量回归并继续同步文档。

## 2026-11-15 — Diff 中宽动作实测恢复与 Settings 子菜单分隔

**作用域**：Commit Diff 工具栏 320–520px、`»` 菜单、Diff Settings
子菜单、`ContextMenu` 子菜单 separator。

**IDEA 对照证据**：

- IDEA Diff 工具栏包含独立的 open / mode / selection / inspect /
  history 动作组；
- 固定导航与关闭控件始终保留，放不下的动作进入 `»`；
- Diff Settings 是一个子菜单，选项组之间使用真实分隔线。

**运行态差集**：

- 修复前使用单一 520px compact/full 阈值；
- 实测 `521px` 被判定为 full，而动作组实际宽
  `524.265625px`，连同文件导航、hunk 导航、提示和关闭按钮后，
  动作组右边缘到 `1050.265625px`，超过工具栏右边缘 `1043px`；
- 尾部动作被 `overflow:hidden` 裁掉；
- `ContextMenu` 的二级子菜单把 `null` 直接跳过，Settings 中
  “忽略空白差异”与“显示空白字符”之间没有真实 separator。

**修复**：

- 新增 `diffDirectActionCountForWidth(width, fixedWidth, actions)`：
  - 按 24px 动作槽、5px 分隔线、2px gap 和一个 `»` 槽计算；
  - 为工具栏 padding、组间距和标题最小边距预留 44px；
  - 从完整动作集向下寻找能真正容纳的最大前缀；
- Diff 固定控件标记 `data-dsh-diff-fixed`：
  - hint、文件导航、Diff summary；
  - hunk 导航、关闭按钮；
- 工具栏测量固定控件真实宽度，只把隐藏动作切片传给 `»`；
- 直接动作仍按 IDEA action group 插入 separator；
- Settings 子菜单的 `null` 渲染为 `role="separator"`；
- 新增 `tests/round395.test.mjs`；
- 更新 round197 / 200 / 221 / 230 / 298 / 313 / 382 旧单阈值契约。

**运行态验证**：

- `521px`：
  - 动作组右边缘 `1039px`，工具栏右边缘 `1043px`，无裁切；
  - 直接动作：
    `打开本地版本 / 切换双栏/单栏对比 / 交换对比方向 /
    禁用编辑 / 选择对侧差异面板 / »`；
  - 其余动作在 `»`；
- 调整 Commit 工具窗口宽度后：
  - `314px`：`打开本地版本 / 切换双栏/单栏对比 /
    交换对比方向 / »`，无裁切；
  - `394px`、`474px`：与 314px 相同；
  - `514px`：恢复 `禁用编辑 / 选择对侧差异面板`；
- 所有采样宽度均满足
  `actions.right <= toolbar.right + 0.5px`；
- Settings 子菜单 DOM：
  `忽略空白差异 / separator / 显示空白字符 / 显示行号✓ /
  显示缩进参考线 / 自动换行`；
- 键盘 `→` 打开 Settings 后焦点落在“忽略空白差异”；
  `↓` 跳过 separator，落到“显示空白字符”；
- `»` 顶层仍保留 inspect/history 组之间的 separator。

**回归**：

```bash
node --test tests/round395.test.mjs tests/round197.test.mjs \
  tests/round200.test.mjs tests/round221.test.mjs \
  tests/round230.test.mjs tests/round298.test.mjs \
  tests/round313.test.mjs tests/round361.test.mjs \
  tests/round382.test.mjs tests/round393.test.mjs \
  tests/round394.test.mjs tests/round86.test.mjs \
  tests/static-order.test.mjs tests/syntax.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
git diff --check
```

- RED：`diffDirectActionCountForWidth` 缺失，round395 初始 1 fail；
- GREEN：目标与相关回归 **43 pass / 0 fail**；
- 全量：`npm test` = **1335 pass / 0 fail**；
- `node --check lib/client.js`、`node --check lib/index.js` 与
  `git diff --check` 通过。

**验证边界**：

- 本轮尝试 Computer Use 时 macOS 仍处于锁屏状态，原生 IDEA
  截图/AX 读取被系统阻止；
- IDEA 分组与工具窗口语义沿用已有 Computer Use 证据和本机
  IntelliJ 平台 XML；
- 未修改锁屏、权限或用户 IDEA 配置。

**下一步**：

- 复核 Markdown 三态按钮在 200px 编辑器内的收缩优先级；
- 补一次真实 Markdown 本地链接打开与工作区越界拒绝；
- 评估 Harness 收起时 Editor 关闭入口不可达的修复方案；
- 复核 Diff Settings 在超窄 `»` 中的父级 active/current 表达；
- 保持 1335+ 全量回归并继续同步文档。

## 2026-11-15 — Project 中宽工具栏恢复与 IDEA 动作组分隔

**作用域**：Project 工具窗口 220–400px、`PanelToolbar` 直接动作恢复、
`»` 溢出菜单、`ContextMenu` separator 可访问性。

**IDEA 对照证据**：

- 既有 Computer Use 读取到的 Project 工具窗口直接顺序为
  `New File or Directory / Select Opened File / Expand Selected /
  Collapse All / Options / Hide`；
- 本机 `intellij.platform.ide.impl.jar` 的 `idea/PlatformActions.xml`
  定义 `ProjectViewToolbar`：前置 separator，随后是
  `SelectInProjectView / ExpandRecursively / ExpandAll / CollapseAll`；
- 因而“新建”与导航类动作属于不同呈现组，窄窗进入 `»` 后不能合并成
  一条无语义边界的列表。

**运行态差集**：

- 修复前 220px 的 `»` 顺序为
  `新建文件 / 定位当前文件 / 展开所选`，三者之间没有分组；
- 中宽恢复本身已正确：
  - 220px：`全部收起 / 选项 / 隐藏 / »`；
  - 260px：恢复 `展开所选`；
  - 300px：六个直接动作全部恢复；
- 因 `PanelToolbar` 只是按动作顺序输出，overflow 没有沿用
  Changes 工具栏已有的 `groupCompactActions()` 语义。

**修复**：

- Project 动作声明 IDEA 分组：
  - `newEntry`：`create`；
  - `reveal / expandSelected / collapse`：`navigation`；
  - `options / hide`：`window`；
- `PanelToolbar` 的 overflow 使用现有 `groupCompactActions(hidden)`，
  只在真实组变化处插入 `null`，不改变直接动作顺序、恢复阈值或回调；
- `ContextMenu` 将 `null` 渲染为 `role="separator"`，方向键继续只遍历
  `button[data-menu-item-id]:not(:disabled)`，跳过分隔线和 disabled；
- 新增 `tests/round394.test.mjs`；
- 更新 round86 / 177 / 328 / 363 / 371 / 393 的旧源码契约。

**运行态验证**：

- Harness 收起后 Editor host 为 `764px`，Project 面板按精确宽度复验：
  - `220.984375px`：
    - 直接按钮 `全部收起 / 选项 / 隐藏 / »`；
    - `»` 为 `新建文件 / separator / 定位当前文件 / 展开所选`；
  - `261px`：
    - 直接按钮 `展开所选 / 全部收起 / 选项 / 隐藏 / »`；
    - `»` 为 `新建文件 / separator / 定位当前文件`；
  - `301px`：
    - 直接按钮恢复为
      `新建文件 / 定位当前文件 / 展开所选 / 全部收起 / 选项 / 隐藏`；
    - 无 `»`；
  - 打开 README 后，`定位当前文件` 变为 enabled；
  - `↓` 从“新建文件”跳到“定位当前文件”，跳过 separator；
    再按 `↓` 首尾回绕到“新建文件”。

**回归**：

```bash
node --test tests/round394.test.mjs tests/round393.test.mjs \
  tests/round392.test.mjs tests/round391.test.mjs \
  tests/round177.test.mjs tests/round328.test.mjs \
  tests/round363.test.mjs tests/round371.test.mjs \
  tests/round86.test.mjs tests/toolwindow-round11.test.mjs \
  tests/terminal-links.test.mjs tests/static-order.test.mjs \
  tests/syntax.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
git diff --check
```

- RED：round394 初始 **3 fail / 1 pass**；
- GREEN：目标与相关回归 **50 pass / 0 fail**；
- 全量：`npm test` = **1332 pass / 0 fail**；
- `node --check lib/client.js`、`node --check lib/index.js` 与
  `git diff --check` 通过。

**验证边界**：

- 本轮尝试再次用 Computer Use 读取 IDEA 时 macOS 已锁屏，
  `getScreenshot()` / `getAXState()` 均被系统阻止；
- IDEA 顺序使用此前 Computer Use 的实窗读取结果，分组边界使用本机
  IntelliJ XML 静态证据交叉确认；
- 未修改屏幕锁定、权限或用户 IDEA 配置。

**下一步**：

- 对照 IDEA Commit Diff 在 320–520px 中宽区间的动作恢复与 overflow；
- 复核 Diff Settings 子菜单在 medium-width `»` 中的分组和键盘顺序；
- 复核 Markdown 三态按钮在 200px 编辑器内的收缩优先级；
- 补一次真实 Markdown 本地链接打开与越界拒绝；
- 保持 1332+ 全量回归并继续同步文档。

## 2026-11-15 — 工具栏 overflow 保留切换项的 active/current 语义

**作用域**：Project / Changes / Diff 工具栏的 `»` 溢出菜单、
`PanelToolbar`、`CompactActionBar`、`ContextMenu` 与键盘导航。

**IDEA 对照证据**：

- IDEA 的 Options、Diff 视图选项等切换动作在直接工具栏与 `»`
  中表达同一个 current 状态；
- 菜单中的复选/切换项应暴露 `menuitemcheckbox` 与 `aria-checked`，
  普通命令仍是 `menuitem`；
- 当前项视觉标记（`✓`）、可访问名称和键盘可达性不能因为动作
  从工具栏进入 overflow 而丢失。

**运行态差集**：

- Project 与 Changes 的 overflow 已把 `active === true` 显示成 `✓`，
  但没有把 boolean active 传给 `ContextMenu`；
- Diff overflow 有相同问题；
- 菜单项因此始终只有 `menuitem` 语义，辅助技术无法判断
  “已启用/已选中”与“普通命令”的差异；
- 首版修复把缺省 active 全量映射成 `false`，导致普通动作也被渲染成
  checkbox，已收回到“只有 boolean 才使用 checkbox”。

**修复**：

- `PanelToolbar`、`CompactActionBar` 与 Diff overflow 只在
  `typeof action.active === 'boolean'` 时转发 `active`；
- `ContextMenu` 对 boolean active 使用 `role="menuitemcheckbox"` 和
  `aria-checked="true|false"`；
- 无 active 的普通动作继续使用 `role="menuitem"`，不生成
  `aria-checked`；
- 菜单键盘遍历统一匹配
  `button[data-menu-item-id]:not(:disabled)`，同时覆盖
  `menuitem` 与 `menuitemcheckbox`，继续跳过 separator 和 disabled。

**回归**：

```bash
node --test tests/round393.test.mjs tests/round178.test.mjs \
  tests/round180.test.mjs tests/round245.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
git diff --check
```

- RED：round393 初始 **3 fail / 0 pass**；
- GREEN：目标与相关回归 **19 pass / 0 fail**；
- 全量：`npm test` = **1328 pass / 0 fail**；
- DSH Web 运行态：
  - `打开本地版本`：`menuitem`，无 `aria-checked`；
  - `切换双栏/单栏对比`：`menuitemcheckbox`，
    `aria-checked="true"`，显示 `✓`；
  - `交换对比方向`：`menuitemcheckbox`，`aria-checked="false"`；
  - `禁用编辑`：`menuitemcheckbox`，`aria-checked="false"`；
  - `选择对侧差异面板 / 重新加载 / 查找 / 设置 / undo / redo`：
    普通 `menuitem`；
  - `展开未修改区域`：`menuitemcheckbox`，`aria-checked="true"`；
  - 方向键从 `打开本地版本 → 切换双栏 → 交换方向` 正常移动；
- `node --check lib/client.js` 与 `git diff --check` 通过。

**适用边界**：

- `active` 表示“切换状态已知”；调用方不传或传非 boolean 时不推断
  为 false；
- `✓` 仍由各动作生成器决定，避免把普通动作误画成当前项；
- checkbox 语义只影响菜单角色与可访问性，不改变点击回调。

**下一步**：

- 复核 Project 在 260–400px 中宽时中间动作恢复与标题收缩；
- 复核 Markdown 三态按钮在 200px 编辑器内的收缩优先级；
- 补一次真实 Markdown 本地链接打开与越界拒绝；
- 评估修复 Harness 收起时 Editor 关闭入口不可达的问题；
- 保持 1328+ 全量回归并继续同步文档。

## 2026-11-15 — Project 200px 工具栏优先保留末尾 IDEA 动作

**作用域**：Project 工具窗口 PanelToolbar、200px 宽度、标题与
Options/Hide action priority。

**IDEA 对照证据**：

- IDEA Project 实窗工具栏顺序为
  `New File or Directory / Select Opened File / Expand Selected /
  Collapse All / Options / Hide`；
- 窄宽度优先保留工具窗口末尾控制与一个 `»`，中部动作进入 overflow；
- 标题中的 Project View 选择器可以让出文字宽度，不能反过来吞掉
  Options/Hide 的槽位。

**运行态差集**：

- 修复前 200px DSH Project 工具栏只剩
  `Project View / »`；
- `新建 / 定位 / 展开所选 / 全部收起 / 选项 / 隐藏` 全部进入 `»`；
- 根因：
  - titleAction 使用 `84%` 最大宽度，几乎占满 200px；
  - `PanelToolbar` 先分配左侧动作，再尝试右侧固定组，导致末尾动作先失去槽位。

**修复**：

- 新增纯函数 `panelToolbarFit()`：
  - 全套动作放不下时先预留 `»` 的 25px；
  - 从右向左优先保留末尾动作；
  - 剩余槽位才分配给左侧/中部动作；
  - badge 只在仍有余量时保留；
- Project View titleAction 最大宽度从 `84%` 收敛到 `45%`；
- 直接顺序、动作 id、disabled、快捷键和 overflow 菜单不变。

**回归**：

```bash
node --test tests/round392.test.mjs tests/round177.test.mjs \
  tests/round186.test.mjs tests/toolwindow-round11.test.mjs \
  tests/terminal-links.test.mjs tests/static-order.test.mjs \
  tests/syntax.test.mjs
npm test
node --check lib/client.js
git diff --check
```

- RED：`panelToolbarFit` 缺失，round392 初始 1 fail；
- GREEN：目标与相关回归 **28 pass / 0 fail**；
- 全量：`npm test` = **1325 pass / 0 fail**；
- DSH Web 200px / 实测侧栏 201px：
  - 标题 `Project:所有更改的文件` 宽 85.5px；
  - 直接按钮：
    `全部收起 / 选项 / 隐藏 / »`；
  - `»` 菜单：
    `新建文件 / 新建目录… / 定位当前文件 / 展开所选`；
  - Options/Hide 不再被放入菜单；
- `node --check lib/client.js` 与 `git diff --check` 通过。

**适用边界**：

- 右侧动作固定是从“最右动作”开始保留；
- 标题较长时会被省略，action tooltip 与菜单仍保留完整文案；
- 计算采用当前 24/25px 视觉槽位模型，不替代真实 CSS layout。

**下一步**：

- 复核 Project 在更宽 260–400px 时恢复更多中间动作且不挤压标题；
- 为 Changes `»` 菜单补充 active/current 的可访问性表达；
- 复核 Markdown 三态按钮在 200px 编辑器内的收缩优先级；
- 保持 1325+ 全量回归并继续同步文档。

## 2026-11-15 — Changes 200px 溢出菜单按 IDEA 动作组分隔

**作用域**：Commit 工具窗 Changes 动作条、200px `»` 菜单、
ContextMenu 键盘导航。

**IDEA 对照证据**：

- IDEA Commit Changes 直接工具栏顺序仍为
  `Refresh / Rollback / Show Diff / Changelists / Shelve /
  View Options / Select Opened / Expand All / Collapse All`；
- IDEA action group 是呈现边界，窄宽度进入 overflow 后仍应保留组语义，
  不能把所有隐藏动作混成一个无边界列表。

**原缺口**：

- DSH 的直接动作有 `pinned` 优先级，但 `»` 中所有隐藏动作无分隔；
- 暂存、视图控制、回滚混在一列，难以扫读；
- 菜单 disabled 已生效，但缺少针对分组后的键盘顺序回归。

**实现**：

- Commit Changes 动作增加 `group`：
  - `diff`：Show Diff / Combined Diff；
  - `patch`：Copy Patch / Create Patch；
  - `refresh`：Refresh；
  - `local`：Stage All Tracked；
  - `view`：View Options / Select Opened / Expand / Collapse；
  - `destructive`：Rollback；
- 新增 `groupCompactActions(actions)`，只在 group 变化处插入 `null`；
- CompactActionBar 的 `»` 菜单使用该结果，ContextMenu 将 null 渲染为真实分隔线；
- 直接动作选择、顺序、图标、disabled 和回调均不变。

**回归**：

```bash
node --test tests/round391.test.mjs tests/round387.test.mjs \
  tests/round232.test.mjs tests/round240.test.mjs \
  tests/static-order.test.mjs tests/syntax.test.mjs
npm test
node --check lib/client.js
git diff --check
```

- RED：`groupCompactActions` 缺失，round391 初始 1 fail；
- GREEN：目标与相关回归 **20 pass / 0 fail**；
- 全量：`npm test` = **1322 pass / 0 fail**；
- DSH Web 200px：
  - 直接按钮仍为
    `显示差异 / 合并差异 / 复制补丁 / 创建补丁 / 刷新 / 视图选项 / »`；
  - `»` 菜单 DOM：
    `暂存所有已跟踪文件(disabled) | separator |
    选择打开文件 / 展开 / 收起 | separator | 还原(disabled)`；
  - 初始焦点落在首个可用项“选择打开文件”；
  - `↓` 只在可用菜单项间移动，跳过分隔线和 disabled；
- `node --check lib/client.js` 与 `git diff --check` 通过。

**适用边界**：

- 分组只影响 overflow 呈现，不改变宽屏直接按钮顺序；
- 未知 group 与相邻 group 不同会自然产生分隔，所有动作应显式声明 group；
- ContextMenu 的 null 始终表示真实视觉分隔。

**下一步**：

- 验证更窄宽度下 diff/patch/refresh 也进入 overflow 时的完整组分隔；
- 复核 Project 200px 工具栏 `Options / Hide` 与左侧动作优先级；
- 复核 Markdown 三态按钮在 200px 编辑器内的收缩优先级；
- 保持 1322+ 全量回归并继续同步文档。

## 2026-11-15 — Harness 活动条开关最小化聊天区域

**作用域**：Editor 左侧活动条、右侧 Harness Chat 列、composer、
chat 拖拽分隔条、Editor host 全宽布局。

**用户需求**：

- 在 Project / Commit / Terminal 后新增 **Harness** 入口；
- 点击后最小化最右侧 Harness 聊天区域，把空间让给代码；
- 再次点击恢复到最小化前的聊天宽度；
- 不改变 Project / Commit / Terminal 与 Editor 的内容和生命周期。

**实现**：

- ActivityStripe 顺序固定为
  `Project / Commit / Terminal / Harness`；
- Harness 使用独立 `harness` 图标和双语 tooltip；
- React `harnessCollapsed` 状态由布局控制器返回值同步；
- 控制器维护临时 `harnessCollapsed`，不写入 localStorage；
- 新增 `chatLayoutWidth(collapsed, chatWidth)`：
  - collapsed 时返回 `0`；
  - expanded 时重新 `clampChatPercent(chatWidth)`；
- `applyChatLayout()` 用 layoutWidth 写
  `--dsh-editor-chat-width` 与 `--dsh-editor-chat-offset`；
- Harness 折叠时设置 `data-dsh-editor-harness-collapsed`；
- CSS 隐藏 conversation session、composer 和 chat resize handle；
- Editor host 的 `right` 随 width=0 变为 0，从而占满工作区；
- Editor 关闭时清理临时布局属性，但内存中的折叠状态保留，
  再次打开仍按同一 Harness 状态恢复。

**运行态发现与修复**：

- 首版 CSS 把 `[data-dsh-editor-active]` 与
  `[data-dsh-editor-harness-collapsed]` 写成同一元素选择器；
- 实际两个属性分别位于 conversation body 与 document body；
- 宽度变量已生效，但 composer 仍保持 `display:flex`；
- 改为
  `[data-dsh-editor-harness-collapsed] [data-dsh-editor-active] ...`
  后代选择器后，composer 真正退出布局。

**回归**：

```bash
node --test tests/round390.test.mjs tests/round114.test.mjs \
  tests/round95.test.mjs tests/round183.test.mjs \
  tests/round190.test.mjs tests/round97.test.mjs \
  tests/round219.test.mjs tests/static-order.test.mjs \
  tests/syntax.test.mjs
npm test
node --check lib/client.js
git diff --check
```

- RED：round390 初始 **5 fail / 0 pass**；
- GREEN：目标与相关回归 **29 pass / 0 fail**；
- 全量：`npm test` = **1319 pass / 0 fail**；
- DSH Web 运行态：
  - 活动条顺序为
    `Project / Commit / Terminal / Harness`；
  - 初始 Editor host `496.609375px`、chat seat `264.9375px`、
    chat width `35%`；
  - 点击 Harness 后：
    - `aria-pressed=true`；
    - chat width `0%`、offset `100%`；
    - chat seat display `none`、宽度 `0px`；
    - Editor host 扩到 `764px`（工作区满宽）；
  - 再次点击：
    - `aria-pressed=false`；
    - chat width 恢复 `35%`；
    - chat seat 恢复 `264.9375px / display:flex`；
    - Editor host 恢复 `496.609375px`；
  - 额外以 40% 自定义宽度复验：
    `40% → 0% → 40%`，host `458.40625px → 764px → 458.40625px`，
    localStorage 始终保留 `40`；
  - 真实拖拽 chat 分隔条后宽度为 `39.973821989528794%`
    （存储值 `40`），Harness 收起后恢复同一实际宽度，
    host 为 `458.609375px`、seat 为 `302.59375px`；
  - `dsh-editor.chatWidth.v2` 未被 Harness 折叠覆盖；
- `node --check lib/client.js` 与 `git diff --check` 通过。

**适用边界**：

- Harness 折叠状态当前是会话内 UI 状态，不跨页面刷新持久化；
- 若用户没有手动拖宽，恢复值是默认 35%；
- Harness 只最小化 Chat，不关闭 Editor 工作台，也不改变工具窗口选择。

**下一步**：

- 用自定义拖拽宽度验证 Harness collapse/restore 精确恢复；
- 复核 Editor 关闭再打开时 Harness 临时状态和聊天宽度；
- 回到 Changes 200px `»` 菜单动作组与键盘顺序；
- 保持 1319+ 全量回归并继续同步文档。

## 2026-11-15 — Project / Changes 共用 Copy Path/Reference 与子菜单 disabled

**作用域**：Project 文件菜单、Commit Changes 文件菜单、
`ContextMenu` 二级子菜单、路径复制与剪贴板动作。

**IDEA 对照证据**：

- 本机 IntelliJ：
  `/Applications/Intellij.app/Contents/lib/intellij.platform.ide.impl.jar`
  的 `idea/PlatformActions.xml` 定义 `CopyReferencePopupGroup`；
- 组内顺序为
  `CopyAbsolutePath / CopyFileName / separator /
  CopyPathWithLineNumber / CopyContentRootPath / CopySourceRootPath`；
- 其后才是 `CopyTBXReference` 外部引用组。

**原缺口**：

- Project 已经实现 IDEA 路径复制语义，但 Changes 只有单一“复制相对路径”；
- 两处若各自维护文案、批量和 caret 规则，后续必然漂移；
- 运行态进一步发现 `ContextMenu` 的二级子菜单只渲染 `label`，
  没有传递 `disabled`，所以多选时位置型复制动作看起来可用，
  点击也会执行。

**修复**：

- 新增共享纯函数
  `copyReferenceMenuItems({ entries, root, t, editor, editorPath, writeText })`；
- Project 和 Changes 都通过该函数生成子菜单；
- 支持 IDEA 的 Absolute Path / File Name / Path with Line /
  Content Root Path，并保留 DSH 的 shell-safe Absolute Path；
- 多选只允许绝对路径和文件名；Path with Line、Content Root、
  shell-safe Absolute 自动 disabled；
- caret 只取自当前聚焦编辑器，非活动文件复制 plain path；
- 二级菜单按钮现在渲染 `disabled`、disabled 样式和执行守卫；
- 键盘导航原本只查询 `:not(:disabled)`，补上真实 disabled 后会自动跳过。

**回归**：

```bash
node --test tests/round389.test.mjs tests/round31.test.mjs \
  tests/round326.test.mjs tests/round331.test.mjs \
  tests/round388.test.mjs tests/round222.test.mjs \
  tests/round223.test.mjs tests/round225.test.mjs \
  tests/round228.test.mjs tests/static-order.test.mjs \
  tests/syntax.test.mjs
npm test
node --check lib/client.js
git diff --check
```

- RED 1：共享 helper 缺失，round389 初始 **4 fail / 0 pass**；
- RED 2：运行态发现子菜单 disabled 未渲染，
  新增契约 **1 fail / 4 pass**；
- GREEN：目标与相关回归 **29 pass / 0 fail**；
- 全量：`npm test` = **1314 pass / 0 fail**；
- DSH Web 运行态：
  - Project 与 Changes 的 Copy Path/Reference 均显示相同
    `绝对路径 / 文件名 / 带行号的路径 / 来自内容根的路径 /
    复制绝对路径（可直接粘进终端）`；
  - 多选 README 与 `docs/sort-a.txt` 后：
    绝对路径与文件名 enabled，其余三项 disabled；
  - 拦截 `navigator.clipboard.writeText` 后点击 Absolute Path，
    实际参数为
    `/private/tmp/dsh-editor-r219-20261114-185936-fixture/README.md`；
  - Ego 的系统剪贴板权限提示未授权，已用页面内 writeText 拦截完成
    写入参数验证，不修改系统权限；
- `node --check lib/client.js` 与 `git diff --check` 通过。

**适用边界**：

- 暂未实现 IDEA `CopySourceRootPath` 和 TBX external reference；
- DSH 的 shell-safe Absolute Path 是额外便利动作，不等同 IDEA 原动作；
- 子菜单 disabled 修复作用于所有 ContextMenu 子菜单，不只路径复制。

**下一步**：

- 审计 200px Changes `»` 菜单的动作组、分隔线和 disabled 顺序；
- 复核 Markdown 三态按钮在 200px 编辑器内的收缩优先级；
- 补一次真实 Markdown 本地链接点击与越界拒绝；
- 保持 1314+ 全量回归并继续同步文档。

## 2026-11-15 — Changes 文件菜单按 IDEA VcsActions 分组重排

**作用域**：Commit 工具窗 Changes 文件行右键菜单、Shift+F10/ContextMenu
键盘菜单、多选 disabled 状态。

**IDEA 对照证据**：

- 本机 IntelliJ 的
  `/Applications/Intellij.app/Contents/lib/intellij.platform.vcs.impl.jar`
  内 `META-INF/VcsActions.xml` 将 `ChangesViewPopupMenu` 定义为真实动作组；
- 可用动作顺序为
  `CheckinFiles / Revert / RevertFiles / Move / Diff.ShowDiff /
  Diff.ShowStandaloneDiff / EditSource / CopyReferencePopupGroup /
  separator / Delete / AddUnversioned / RemoveDeleted / Edit /
  separator / changelist actions / CreatePatch / CreatePatchToClipboard /
  Shelve / separator / Refresh / separator / VersionControlsGroup`；
- 补丁顺序是 `Create Patch` 在前、`Create Patch to Clipboard` 在后；
- Revision/HEAD/Clipboard 比较属于底部 `VersionControlsGroup`。

**运行态差集**：

- DSH 旧菜单把 Compare 放在 Stage 前，把 Copy Path 放在最底部；
- 补丁顺序是 Copy Patch 在 Create Patch 前；
- 条件动作使用 `condition ? action : null`，在条件不成立时会留下
  多余分隔线，可能形成连续双分隔线。

**修复**：

- 只重排 DSH 已实现的动作，不新增 Changelists、Shelve、Move、Delete；
- `Rollback` 置顶，随后是 Diff/Combined Diff/EditSource/Copy Reference；
- Stage/RemoveDeleted/Add to `.gitignore` 保持在中部组；
- `Create Patch` → `Copy Patch to Clipboard`；
- History/Reveal/Terminal 组成导航组；
- Compare Revision/HEAD/Clipboard 移到菜单底部；
- conditional actions 改为 spread 数组，未出现时不会产生 null 分隔线；
- 不改动作 id、执行回调、disabled 判定或快捷键。

**回归**：

```bash
node --test tests/round388.test.mjs tests/round225.test.mjs \
  tests/round228.test.mjs tests/round223.test.mjs \
  tests/round222.test.mjs tests/round173.test.mjs \
  tests/round86.test.mjs tests/round320.test.mjs \
  tests/round277.test.mjs tests/static-order.test.mjs \
  tests/syntax.test.mjs
npm test
node --check lib/client.js
git diff --check
```

- RED：round388 初始 **2 fail / 1 pass**；
- GREEN：目标与相关回归 **29 pass / 0 fail**；
- 全量：`npm test` = **1309 pass / 0 fail**；
- DSH Web 200px 单行菜单实际子项顺序：
  `回滚 › | 显示差异 ⌘D / 合并差异(disabled) / 在编辑器中打开 /
  复制相对路径 | 取消暂存 ⌥⌘A | Create Patch / Copy Patch |
  历史 / Project / Terminal | Compare Revision / HEAD / Clipboard`；
- 菜单 DOM 共 5 条真实分隔线，无连续双分隔；
- 多选 README + docs/sort-a 后 Combined Diff 启用，
  Revision/HEAD/Clipboard 全部 disabled；
- Esc 关闭菜单后焦点回到 `docs/sort-a.txt` 文件行；
- `node --check lib/client.js` 与 `git diff --check` 通过。

**适用边界**：

- Compare 底部组对应 IDEA `VersionControlsGroup`，但 DSH 只实现
  Revision/HEAD/Clipboard 三项；
- ContextMenu 仍是插件自有 React 菜单，不是 IntelliJ ActionPopup；
- 未实现的动作不会用空壳菜单冒充 IDEA 能力。

**下一步**：

- 对照 IDEA `CopyReferencePopupGroup`，把 Changes 菜单单一“复制相对路径”
  扩为 Absolute Path / File Name / Path with Line / Content Root Path；
- 复核 Project 与 Changes 两个 Copy Path/Reference 子菜单复用同一实现；
- 复核 200px `»` 菜单中的 disabled、分隔线和键盘跳过规则；
- 保持 1309+ 全量回归并继续同步文档。

## 2026-11-15 — Changes 200px 工具栏固定高频动作与溢出优先级

**作用域**：Commit 工具窗口 Changes 动作条、`»` 溢出菜单、200px 工具窗宽度。

**IDEA 对照证据**：

- IntelliJ Commit 工具窗顶部固定 `Options / Hide`；
- Changes 直接工具栏顺序为
  `Refresh / Rollback… / Show Diff / Changelists / Shelve /
  View Options / Select Opened File / Expand All / Collapse All`；
- `Show Combined Diff`、补丁与暂存类动作属于较低频动作，不得把
  `Refresh / Show Diff / View Options` 等高频入口挤出直接工具栏。

**运行态差集**：

- DSH Commit 工具窗宽度 200px；
- 修复前直接按钮为
  `显示差异 / 合并差异 / 复制补丁 / 创建补丁 / 刷新 / 暂存所有已跟踪文件 / »`；
- IDEA 直接提供的 `视图选项` 被挤进 `»`；
- 原因是 `CompactActionBar` 无条件保留动作数组前缀，只按尾部截断，
  没有“高频动作固定、低频动作优先溢出”的语义。

**修复**：

- 新增纯函数 `selectCompactActions(actions, directLimit)`；
- `pinned: true` 的动作先占用直接槽位，其余槽位按原动作顺序填充；
- 可见动作仍按原顺序渲染，所有未选中动作按原顺序进入 `»`；
- 宽工具栏不重排完整动作序列；窄工具栏才启用固定动作选择；
- `刷新`与`视图选项`标记为 pinned；
- 不改变动作 id、图标、文案、`disabled`、快捷键或执行链。

**回归**：

```bash
node --test tests/round387.test.mjs tests/round240.test.mjs \
  tests/round232.test.mjs tests/round282.test.mjs \
  tests/round381.test.mjs tests/round382.test.mjs \
  tests/static-order.test.mjs tests/syntax.test.mjs
npm test
node --check lib/client.js
git diff --check
```

- RED：round387 初始 **4 fail / 0 pass**；
- GREEN：目标与相关回归 **21 pass / 0 fail**；
- 全量：`npm test` = **1306 pass / 0 fail**；
- DSH Web 200px 实际直接按钮：
  `显示差异 / 合并差异 / 复制补丁 / 创建补丁 / 刷新 / 视图选项 / »`；
- 溢出菜单：
  `暂存所有已跟踪文件 / 在更改视图中选择打开的文件 /
  展开所有更改 / 收起所有更改 / 还原所选更改`；
- `视图选项`菜单可打开 `更改列表的分组方式 ›`；
- 键盘按 Enter 打开 `»` 后方向键可进入可执行菜单项，
  Esc 关闭后焦点回到 `更多操作` 按钮；
- `node --check lib/client.js` 与 `git diff --check` 通过。

**适用边界**：

- 固定动作只保证在仍有直接槽位时优先保留；极窄到只能显示溢出处时，
  所有动作仍可从 `»` 访问；
- 固定动作不改变动作状态，disabled 状态由调用方继续唯一决定。

**下一步**：

- 对照 IDEA Changes 文件上下文菜单，审计
  Show Diff / Compare / Stage / Rollback / Patch / Copy Path 顺序；
- 复核 200px `»` 菜单分组、disabled 与键盘跳过规则；
- 复核 Markdown 三态按钮在 200px 编辑器内的收缩优先级；
- 保持 1306+ 全量回归并继续同步文档。

## 2026-11-15 — Markdown 分栏代码与预览双向滚动同步

**作用域**：Editor 中 Markdown / MDX 的 `代码和预览` 模式，Monaco 代码区与宿主
`MarkdownText` 预览。

**IDEA 对照证据**：

- IntelliJ README 工具栏仍是 `Editor / Editor and Preview / Preview` 三个互斥动作；
- 分栏阅读时，代码与预览是同一文档的两个视图，滚动应保持相同阅读位置；
- 模式切换与滚动同步不应重建 Monaco model，也不应改变现有三态持久化。

**实现**：

- 新增纯函数 `markdownScrollRatio()` 与 `markdownScrollTopForRatio()`：
  用 `scrollTop / (scrollHeight - clientHeight)` 映射阅读位置；
- 输入非数值、不可滚动或越界时分别收敛到 `0` / `1`，避免除零和负值；
- 分栏模式监听 Monaco `onDidScrollChange` 与预览 DOM `scroll`；
- 任一侧成为驱动方后按比例更新另一侧；
- 程序更新目标侧时记录一次性 echo 锁，目标侧首个回显事件被丢弃，
  不会形成双向滚动自激；
- 预览 ref 跟随当前 Markdown 文档重建，effect 在切换文件、模式或文件表面时重新绑定；
- 不重建 editor/model，不改三态按钮、快捷键或 `dsh-editor.markdown.mode`。

**回归**：

```bash
node --test tests/round386.test.mjs tests/round385.test.mjs \
  tests/round329.test.mjs tests/dictionary.test.mjs \
  tests/static-order.test.mjs tests/syntax.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
git diff --check
```

- RED：`markdownScrollRatio should exist`；新增契约 1 fail；
- GREEN：目标与相关回归 **22 pass / 0 fail**；
- 全量：`npm test` = **1302 pass / 0 fail**；
- DSH Web 运行态（隔离 editor-test，README 注入 160 个长段落）：
  - 代码区连续 `PageDown` 后，
    editor ratio `0.08342819970726947`、preview ratio `0.08342595619483491`；
  - 在预览区执行真实鼠标滚轮上滚 1200px 后，
    editor ratio `0.063750203285087`、preview ratio `0.0638117031709709`；
  - 观察 400ms 后位置稳定，没有来回抖动；
  - `.view-line` 计算字体以 `"Trebuchet MS"` 开头；
  - Project 树行与 Commit 文件行计算字体均为
    `"Trebuchet MS", "PingFang SC", "Microsoft YaHei UI", sans-serif`；
  - 三态布局：预览模式 editor 0 / preview 254px，
    代码模式 editor 254px / preview 0，
    分栏 editor 126px / preview 127px。

**适用边界**：

- 同步使用整体阅读比例，不做 Markdown 标题级的源映射；
- `代码` / `预览` 单表面模式不安装滚动监听；
- 右侧独立的通用 editor split 不参与 Markdown 预览同步。

**下一步**：

- 对照 IDEA Changes 工具栏 action priority，复核 200px Commit 工具窗的
  Show Diff / Combined Diff / Patch / Refresh / Stage All 顺序；
- 复核编辑器 200px 宽度下三态按钮与面包屑的收缩优先级；
- 补一次真实 Markdown 本地链接打开验证；
- 保持 1302+ 全量回归并同步文档。

## 2026-11-15 — Trebuchet MS 默认字体与 Markdown 三态预览

**作用域**：Editor 工作台字体、Project / Commit 工具窗口、Monaco 代码区、Diff 编辑器、Markdown / MDX 预览。

**IDEA 对照证据**：

- IntelliJ README 编辑器工具栏提供
  `Editor / Editor and Preview / Preview` 三个互斥模式；
- 该入口属于 Markdown 编辑器自身，不是第二套文件打开机制。

**实现**：

- 新增 `EDITOR_UI_FONT`：
  `"Trebuchet MS", "PingFang SC", "Microsoft YaHei UI", sans-serif`；
- `EditorWorkspace` 根节点、按钮/input/textarea/select 通过 workspace CSS 继承；
- `createCodeEditorGroup` 与 Monaco Diff editor 的 `fontFamily` 使用同一常量；
- 新增 `normalizeMarkdownMode`、`isMarkdownPath`、`resolveMarkdownLink`；
- Markdown / MDX 文件面包屑右侧显示
  `代码 / 代码和预览 / 预览` 三态按钮；
- 模式写入 `dsh-editor.markdown.mode`，刷新后恢复；
- 代码 Monaco 与预览表面始终挂载：
  - 代码：编辑器占满；
  - 分栏：左代码右预览；
  - 预览：编辑器 `display:none`，预览占满；
- 预览复用 `primitives.MarkdownText` 和 `MarkdownDelegateProvider`，没有引入第二套 Markdown 解析器；
- 本地 Markdown 链接按当前文档目录解析，并阻止 `..` 逃出工作区；
- 隐藏 Monaco 切换回可见时主动调用 `layout()`。

**回归**：

```bash
node --test tests/round385.test.mjs tests/round329.test.mjs \
  tests/round330.test.mjs tests/round332.test.mjs \
  tests/dictionary.test.mjs tests/static-order.test.mjs \
  tests/syntax.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
git diff --check
```

- RED：round385 初始 6 fail；
- GREEN：目标与相关回归通过；
- 全量：`npm test` = **1299 pass / 0 fail**；
- DSH Web 运行态：
  - Monaco `.view-line` 计算字体以 `Trebuchet MS` 开头；
  - Project 树行与 Commit 文件行计算字体均为
    `"Trebuchet MS", "PingFang SC", "Microsoft YaHei UI", sans-serif`；
  - README 初始恢复已保存的 `split` 模式；
  - 分栏模式编辑区约 126px、预览约 127px；
  - 预览模式编辑区 `display:none`，预览占满约 254px；
  - 代码模式预览 `display:none`，编辑区占满约 254px；
  - 在 Monaco 输入 `preview-sync` 后预览实时出现同一文本；
  - `⌘Z` 后预览文本同步撤销。

**适用边界**：

- Markdown 预览沿用宿主 `MarkdownText` 的能力与样式，不在插件内扩展新的 Markdown 方言；
- 当前三态是工作区偏好，不是每个文件单独保存；
- 图片仍受 DSH Markdown delegate 的本地媒体能力限制。

**下一步**：

- 对照 IDEA Markdown 预览的滚动同步与工具栏密度；
- 复核 200px 编辑器宽度下三态按钮与面包屑的收缩优先级；
- 继续 IDEA Changes 工具栏 action priority 与 overflow 顺序；
- 保持全量回归并同步文档。

## 2026-11-15 — recursive watcher 修复 FSEvents 关闭风暴与 Harness 卡死

**作用域**：宿主 `WorkspaceWatcher`、`/api/dsh-editor/watch` SSE、Editor 打开/关闭与 Harness 退出。

**症状**：

- 打开 Editor 后 desktop Harness 宿主进程持续占用约 18–23% CPU，Web 页面接近卡死；
- Harness 选择退出后长时间不结束；
- `sample` 的 **1990 / 1992** 个主线程样本停在
  `uv_fs_event_stop → uv__fsevents_close`，不是普通 React 重渲染循环；
- Zygisksdk workspace 有 `node_modules` / `target` 等大量目录。

**根因**：

- `WorkspaceWatcher` 对每个目录建立一个 `fs.watch`，上限 2000；
- 大 workspace 实际建立 **2000 个 watcher**；
- `close()` 同步逐个关闭 handle，隔离复现中关闭耗时约 **19 秒**；
- SSE 断开、Editor 关闭或应用退出都会触发这条同步关闭路径，宿主事件循环因此长时间阻塞。

**修复**：

- 默认优先创建一个递归 watcher：
  `this.watchImpl(this.root, { recursive: true, persistent: false }, …)`；
- recursive 模式不再递归遍历目录创建 watcher，也不再额外创建 `.git/index` watcher；
- 平台不支持 recursive 时才回退旧的逐目录实现，回退上限从 2000 收紧为 **256**；
- recursive 回调有相对路径时精确上报 `dirname(path)`；
- macOS 只返回 basename 或空 filename 时上报 `dirs:null`，客户端刷新当前已展开目录，避免误报根目录导致漏更新；
- `.git` 事件继续触发现有 Git status 刷新；
- `close()` 对 recursive 模式只关闭一个 handle。

**回归**：

```bash
node --test tests/round383.test.mjs tests/round152.test.mjs \
  tests/round148.test.mjs tests/round165.test.mjs \
  tests/round219.test.mjs tests/round221.test.mjs \
  tests/static-order.test.mjs tests/syntax.test.mjs
npm test
node --check lib/index.js
git diff --check
```

- RED：round383 初始 3 fail（无 recursiveWatcher、仍创建多个 watcher、cap 仍为 2000）；
- GREEN：目标与相关回归 **39 pass / 0 fail**；
- 全量：`npm test` = **1292 pass / 0 fail**；
- 同 workspace 隔离复现：
  - 修复前 watcher 数 **2000**，close 约 **19 s**；
  - 修复后 watcher 数 **1**，start **0 ms**，close **13 ms**；
- 临时目录真实 recursive 事件在 3 秒内到达，嵌套文件产生 `dirs:null` 的保守刷新；
- desktop Harness 加载修复后：
  - 打开 Editor 后样本不再落在 `uv_fs_event_stop`；
  - Editor 可立即关闭；
  - Editor 关闭后宿主保留约 7% 的既有后台基线，说明剩余 CPU 不是 watcher 关闭循环。

**适用边界**：

- 支持 recursive `fs.watch` 的平台使用单 handle；
- 不支持的平台使用最多 256 个目录 watcher，其余由 8 秒 git signature poll 兜底；
- recursive API 只给文件名时，客户端会刷新所有已展开目录，优先正确性而非最小刷新。

**下一步**：

- 继续第 383 轮原计划：IDEA Changes 工具栏 action priority 与 200px overflow 顺序；
- 在 watcher 相关改动后额外观察一次真实文件树更新与 Commit 状态刷新；
- 保持全量回归并同步 README / engineering-memory / 计划。

## 2026-11-15 — Diff 工具栏按 IDEA action group 分组

**作用域**：Commit / Compare Diff 宽工具栏与窄宽度 `»` 菜单。

**IDEA 对照证据**：

- IntelliJ `PlatformActions.xml` 把 Diff 动作拆入
  `Diff.DiffModes / Diff.ViewerToolbar / Diff.ViewerSettings /
  Diff.ViewerPopupMenu` 等独立 group；
- 宽工具栏和弹出菜单都不是无边界的一整条平铺命令；
- 动作分组不改变 `Diff.FocusOppositePane` 的 `⌃⇧Tab`、F7 导航或现有执行链。

**原缺口**：

- DSH Diff 的所有动作按钮平铺在一行，`»` 菜单也没有分隔；
- 视觉上无法区分对比模式、对侧选择、检查设置与还原历史。

**实现**：

- `diffToolbarActions` 增加 `open / mode / selection / inspect / history`
  语义组；
- 新增纯函数 `groupDiffToolbarActions()`，只在 group 变化处插入 `null`；
- 宽工具栏把 `null` 渲染为带 `role="separator"` 的 1×16px 竖线；
- 窄宽度 `»` 复用同一分组结果，由 ContextMenu 渲染菜单分隔；
- 不改动作 id、顺序、图标、文案、disabled、快捷键或回调。

**回归**：

```bash
node --test tests/round382.test.mjs tests/round197.test.mjs \
  tests/round221.test.mjs tests/round294.test.mjs \
  tests/round335.test.mjs tests/round361.test.mjs \
  tests/round369.test.mjs tests/round381.test.mjs \
  tests/static-order.test.mjs tests/syntax.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
git diff --check
```

- RED：`tests/round382.test.mjs` 初始 2 fail，修正测试作用域后
  `groupDiffToolbarActions` 缺失仍为 RED；
- GREEN：目标与相关回归 **36 pass / 0 fail**；
- 全量：`npm test` = **1288 pass / 0 fail**；
- DSH Web 宽 Diff（615px）：
  - 渲染 4 个 vertical separator；
  - 顺序为 `打开本地版本 | 模式 | 对侧选择 | 检查/设置 | 历史`；
  - 上一个/下一个更改与关闭按钮仍在固定末端；
- DSH Web 窄 Diff（254px）：
  - `»` 菜单同样有 4 个分隔；
  - 菜单顺序和文案不变，固定 hunk/close 控件仍可见。

**下一步**：

- 对照 IDEA Commit Changes 工具栏的 action priority 与 overflow 顺序；
- 检查 200px 宽度下 Show Diff / Combined Diff / Patch / Refresh / Stage All
  哪些应固定、哪些应先进入 `»`；
- 只调整有真实运行态差集的 action 优先级，不改变现有业务能力。

## 2026-11-15 — Commit / Diff 动作图标语义拆分

**作用域**：Commit 更改操作栏与 Diff 工具栏的图标映射。

**运行态观察**：

- Commit 工具栏的 `显示差异` 与 `显示所选文件的合并差异` 都使用 commit 图标；
- `作为补丁复制到剪贴板` 与 `从本地更改创建补丁…` 都使用普通文件图标；
- Diff 工具栏的 `选择对侧差异面板` 与切换双栏/单栏共用 split 图标；
- IDEA 中这些动作各有可辨识图形，窄宽度收进 `»` 后文案仍须保持原动作名。

**实现**：

- `Icon` 新增 `diff`、`combinedDiff`、`clipboard`、`patchExport`、`switchPane`；
- Commit 工具栏四个动作改用对应专用图标；
- Diff 的 `focusOppositePane` 改用 `switchPane`；
- 动作 id、文案、disabled、快捷键和点击行为不变。

**回归**：

```bash
node --test tests/round381.test.mjs tests/round294.test.mjs \
  tests/round221.test.mjs tests/round335.test.mjs \
  tests/round171.test.mjs tests/round178.test.mjs \
  tests/round232.test.mjs tests/round240.test.mjs \
  tests/round316.test.mjs tests/round321.test.mjs \
  tests/round322.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
git diff --check
```

- RED：`tests/round381.test.mjs` 初始 2 fail；补 `switchPane` 契约后再次 1 fail；
- GREEN：目标与相关回归 **42 pass / 0 fail**；
- 全量：`npm test` = **1285 pass / 0 fail**；
- DSH Web（editor-test 63101，200px Commit 工具窗）：
  - 四个 Commit 动作 SVG 路径互不相同；
  - 选中 `README.md` 后 `显示差异 / 复制补丁 / 创建补丁` 启用，合并差异保持单选禁用；
  - 七个工具按钮在 200px 宽度内均可点击；
- DSH Diff（1600px 临时视口）：
  - `选择对侧差异面板` 使用独立双面板双向箭头图标；
  - 点击后活动 Monaco pane 从 index 1 切换到 0，焦点行为不变。

**下一步**：

- 继续审计 IDEA Diff 工具栏与 DSH 的图标/动作顺序差集；
- 优先选择有真实运行态差异、且不改现有快捷键语义的动作；
- 复核 200px 下 Commit 工具栏的 overflow 顺序与 IDEA 主次动作优先级。

## 2026-11-15 — 开发 profile 改为 link 依赖，消除 Harness 源码副本

**作用域**：desktop / editor-test Harness profile 的 `dsh-editor` 安装方式与源码刷新链路。

**症状**：

- desktop Harness 已打开 Editor，但页面仍是旧实现；
- profile 的 `package.json` 声明 `dsh-editor: file:/Users/chan/Documents/project/dsh-editor`；
- pnpm 把 `file:` 解包到 `node_modules/dsh-editor`，该副本的 `client.js`
  与 `index.js` 哈希和仓库不一致；
- 继续修改仓库不会自动进入已启动的 Harness。

**根因**：

- `file:` 是目录快照安装，不是开发链接；
- Harness 宿主半在进程启动时加载，客户端半也需要刷新页面重新获取。

**修复**：

- 将 profile 依赖改为
  `link:/Users/chan/Documents/project/dsh-editor`；
- desktop profile 使用 pnpm 重新生成符号链接，隔离 `editor-test` profile
  同步改为链接；
- 两个 profile 的 `node_modules/dsh-editor` 均解析到工作区源码；
- 重启 desktop Harness 后，Project 视图选择器等最新入口可见。

**验证**：

```bash
stat -f '%HT %N -> %Y' ~/.dsh/profiles/desktop/node_modules/dsh-editor
shasum -a 256 \
  lib/client.js \
  ~/.dsh/profiles/desktop/node_modules/dsh-editor/lib/client.js
shasum -a 256 \
  lib/index.js \
  ~/.dsh/profiles/desktop/node_modules/dsh-editor/lib/index.js
```

- desktop 与 editor-test 的 `stat` 均为 `Symbolic Link`；
- 两个 `client.js` 哈希一致，两个 `index.js` 哈希一致；
- editor-test 新宿主可正常挂载 Editor；
- desktop Harness 重启后可打开 Editor，`Project:`、视图选择器和八个视图项正常显示。

**适用边界**：

- `link:` 只消除源码副本；修改 `lib/index.js` / `lib/terminal.js`
  等宿主半后必须重启 Harness；
- 只修改 `lib/client.js`、locale 或前端资源时，刷新页面即可；
- 不要再对开发 profile 使用 `file:` 安装。

## 2026-11-15 — 过滤视图行级定位、Auto Scroll 竞争与 Open Files 同步

**作用域**：Project filtered views 的文件右键菜单、显式 Reveal 与 Auto Scroll、Open Files 随 tab 生命周期同步。

**原缺口**：

- 过滤视图右键任意文件时，`reveal` 项仍按“定位活动文件”语义处理；
- 非活动文件该项 disabled，无法从 Changed Files 直接跳到对应真实树行；
- 即使用显式 row reveal，切回 Project Files 触发的 Auto Scroll 仍可能把 selection
  改回活动 tab；
- `Open Files` 的关闭/重排同步缺少运行态证据。

**实现**：

- 过滤视图文件行的右键 `reveal` 改为 **在 Project 中定位**：
  - label 使用 `editor.revealInProject`；
  - 对文件行启用；
  - 运行 `revealPath(row.path)`，作用对象是被右键的行；
- 目录行仍保留 `Expand Folder`；
- `revealPath()` 设置 `suppressAutoScrollRef=true`，Auto Scroll effect 在顶部让行；
  reveal 完成后 250ms 清除；
- Auto Scroll effect 的依赖移除 `rows` / `projectTreeActionsAvailable`：
  它应响应活动文件变化，而不是视图切换或过滤行重建；
- `buildTreeMenu` 依赖加入 `filteredView` 与 `revealPath`。

**运行态发现并修复**：

- 首次右键 Changed Files 的 README → “在 Project 中定位”后，虽然切回 Project Files，
  选中行仍被 Auto Scroll 改回活动 `note.txt`；
- 根因是 Auto Scroll 的依赖包含过滤视图行和 `projectTreeActionsAvailable`，
  视图切换导致 effect 重新执行；
- 移除这两个依赖并保留一次 explicit-reveal 抑制后，最终选中 README。

**回归**：

```bash
node --test tests/round379.test.mjs tests/round378.test.mjs \
  tests/round377.test.mjs tests/static-order.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
git diff --check
```

- RED：`tests/round379.test.mjs` 初始 3 fail；
- GREEN：目标与相关回归 19 pass / 0 fail；
- 全量：`npm test` = **1282 pass / 0 fail**；
- DSH Web 运行态：
  - Changed Files 右键 README，菜单 `在 Project 中定位` enabled；
  - 点击后切回 Project Files，最终 selected 为 README，活动 tab 仍为 note；
  - Open Files 初始 `note / README`，关闭 README tab 后只保留 note，
    选中行同步为 note；
  - 页面无插件异常；
- profile 同步后完成运行态验证。

**下一步**：

- 继续用真实鼠标/键盘自动化验证 Shift/⌘ 多选跨过滤视图迁移；
- 复核过滤视图右键菜单的其余路径动作与目录动作 disabled 状态；
- 检查 200px 左右宽度下 Project 视图按钮、标题与 `»` 的优先级。

## 2026-11-15 — 过滤视图选择隔离与 Select Opened File 回退

**作用域**：Project `Open Files` / `All Changed Files` 的选择集、选择 anchor、快捷定位与真实树视图回退。

**IDEA 对照证据**：

- 在 All Changed Files 中执行 `Select Opened File (⌥F1, 1)`，当前 `package.json`
  不属于更改列表时，IDEA 离开过滤视图并回到最近使用的真实 `Project Files` 树；
- 目标属于当前过滤视图时，动作应继续留在该视图并选中目标。

**原缺口**：

- 视图切换只修正主 selectedPath，multi-selection 仍可能包含新视图里不存在的旧路径；
- selection anchor 也可能指向隐藏路径，随后 Shift 多选无法正确展开；
- `revealPath()` 固定切回 `Project`，丢失 IDEA 最近使用的 `Project Files` 语义。

**实现**：

- 新增纯函数 `filteredViewSelection()`：
  - 只保留当前视图 rowPaths 内的选择；
  - 主行优先当前 selectedPath，其次是活动编辑器文件，再取第一行；
  - 选择没有变化时返回原 Set，避免无意义重渲染；
- 过滤视图用一个 effect 原子地清理 selection、主行与 `selectionAnchor`；
- 新增 `lastProjectTreeViewRef`，只记住最近使用的真实树视图；
- `revealPath()` 从过滤视图退出时回到该 ref，而不是固定 `Project`；
- `revealActive()` 若目标在当前过滤行内则原地选中，否则走真实树回退。

**回归**：

```bash
node --test tests/round378.test.mjs tests/round377.test.mjs \
  tests/static-order.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
git diff --check
```

- RED：`tests/round378.test.mjs` 初始因 helper 缺失整体失败；
- GREEN：目标与相关回归通过；
- 全量：`npm test` = **1278 pass / 0 fail**；
- DSH Web 运行态：
  - 在 `Open Files` 中打开 `docs/note.txt` 后按 `⌥F1, 1`，
    视图保持 `Open Files`，`note.txt` 被选中；
  - 切到 `All Changed Files` 后活动文件仍为 `docs/note.txt`，
    按 `⌥F1, 1` 自动回到 `Project Files`，展开 `docs` 并选中 `note.txt`；
  - 页面无 React/ReferenceError；
- profile 同步后完成运行态验证。

**下一步**：

- 用真实鼠标/键盘自动化补齐 Shift/⌘ 多选跨过滤视图迁移的运行态证据；
- 核对过滤视图中右键菜单的 `Select Opened File` 与单行路径动作；
- 继续检查 200px 左右宽度下 Project 标题和 `»` 动作优先级。

## 2026-11-15 — Project 标题补 IDEA 视图选择器与可靠过滤视图

**作用域**：Project 工具窗口标题、IDEA 视图选择器、Project/Project Files/Open Files/All Changed Files 行来源、过滤视图搜索与树动作。

**IDEA 对照证据**：

- Project 标题栏显示 `Project:` + 当前视图按钮；
- 下拉顺序为 `Project / Packages / Project Files / Production / Tests / Open Files / All Changed Files / Scratches and Consoles`；
- 当前 JS/TS 仓库的 `Packages` 视图为空；
- `Project Files` 仍是真实项目树，`Open Files` 只列当前打开的 `package.json`，
  `All Changed Files` 按目录/文件列出 Git 变更。

**原缺口**：

- DSH Project 标题只有静态 `Project`，没有视图语义；
- 所有文件树操作只支持一套完整目录树，Open Files 与 Changed Files 没有入口。

**实现**：

- `PanelToolbar` 支持可选 `titleAction`，只由 Project 使用；Commit 工具栏不变；
- Project 标题增加 `Project:` 与当前视图按钮，菜单保持 IDEA 八项顺序，当前项 `✓`；
- 新增纯函数 `normalizeProjectView()`、`projectViewIsTree()`、`projectViewRows()`：
  - `Project` / `Project Files` 返回原 `projectRows`；
  - `Open Files` 按现有 `openFiles` tab 顺序投影；
  - `All Changed Files` 对 `git.changes` 去重并路径排序；
  - `Packages / Production / Tests / Scratches` 保持可见但 disabled；
- 过滤视图的空列表显示 `没有打开的文件` / `没有更改的文件`；
- 过滤视图搜索只过滤当前行，不调用 `fs.search`；
- 过滤视图禁用 `Expand Selected / Collapse All / Options → Expand All`；
- 新建位置下拉仍使用未被过滤的真实 `projectRows`；
- 视图选择写入 `dsh-editor.project.view`，刷新/重开 Editor 后恢复。

**运行态发现并修复**：

- 首次打开 Editor 报 `ReferenceError: Cannot access 'applyProjectView' before initialization`；
- 根因是 `revealPath` 的 `useCallback` 依赖数组在渲染期读取了后面才声明的
  `applyProjectView`；
- 把 `applyProjectView` 声明移动到 Project 偏好 state 之后，保持 hook 依赖顺序稳定。

**回归**：

```bash
node --test tests/round377.test.mjs tests/round359.test.mjs \
  tests/round363.test.mjs tests/round371.test.mjs tests/static-order.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
git diff --check
```

- RED：`tests/round377.test.mjs` 初始缺失 helper / selector；
- GREEN：目标与相关回归通过；
- 全量：`npm test` = **1273 pass / 0 fail**；
- DSH Web 运行态：
  - Project 按钮显示 `项目`，菜单八项顺序正确；
  - `Packages / Production / Tests / Scratches` disabled；
  - 打开 README 与 `.hidden-note.txt` 后，`Open Files` 只显示这两个文件；
  - `All Changed Files` 显示 7 个去重后的 Git 路径，`Expand Selected / Collapse All` 在 `»` 中为 disabled；
  - 关闭全部 tab 后 `Open Files` 显示“没有打开的文件”；
  - 页面无 React/ReferenceError；`dsh-editor.project.view` 记录当前选择；
- profile 同步后完成运行态验证。

**下一步**：

- 在可用视图中补齐当前文件定位：Open Files 内直接选中活动 tab，
  Changed Files 中无目标时切回 Project；
- 评估 Project Files 是否需要展示 IDEA 的 `Extensions` 顶层节点；没有真实外部库数据时不伪造；
- 继续核对 Project 视图按钮在 200px 左右工具窗口中的标签截断与 `»` 动作优先级。

## 2026-11-15 — 工作区菜单进入 Editor 时默认收起左侧会话栏

**作用域**：工作区 `... → Editor` 入口、宿主左侧工作区/会话列表栏、编辑器可用宽度。

**用户意图**：

- 从工作区行右键/菜单选择 `Editor` 进入编辑器时，默认收起左侧会话列表栏；
- 给 Project 文件树、代码区和 Chat 留出更多横向空间。

**实现**：

- 仅修改工作区菜单注入的 Editor 入口，不影响 hero Editor 按钮和 View-row Editor 开关；
- `collapseConversationSidebar()` 直接复用宿主 `[data-sidebar-toggle]`，不手改宿主 grid；
- 通过 `[data-slot="sidebar"]` 父列的实际宽度判断状态：
  `sidebarNeedsCollapse(width)` 只在有限宽度且 `> 96px` 时返回 true；
- 已收起的 56px 图标轨道保持不动，避免把侧栏重新点开；
- 先收起侧栏，再调用原 `openEditorSplit(workspaceId)`，继续复用现有 workspace 绑定、
  Project/Commit/Terminal 与 chat split。

**回归**：

```bash
node --test tests/round376.test.mjs tests/round91.test.mjs tests/round92.test.mjs tests/round93.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
git diff --check
```

- RED：`tests/round376.test.mjs` 初始 3 fail；
- GREEN：目标与相关回归 14 pass / 0 fail；
- 全量：`npm test` = **1267 pass / 0 fail**；
- DSH Web 运行态：
  - 打开菜单前侧栏宽 280px、按钮标签为 `收起侧边栏`；
  - 点击注入的 `Editor` 后按钮标签变为 `打开侧边栏`；
  - 指针移出侧栏并等待收起动画后，侧栏为 56px；
  - 宿主 grid 从 `280px 764px 0px` 变为 `56px 988px 0px`；
  - 同一个 Editor host 宽度从 `496.6px` 增至 `642.2px`；
  - 菜单自动关闭，Project 根目录仍是被点击的 `r219-fixture` 工作区；
- profile 同步后完成运行态验证。

**下一步**：

- 继续第 376 轮原计划中的 IDEA Project 视图选择器；
- 优先验证 `Project Files`、`Open Files`、`All Changed Files` 能否复用现有树/tab/git 数据；
- 不伪造 `Packages / Production / Tests / Scratches`，并保持 1267+ 全量回归。

## 2026-11-15 — 编辑器文件 tab 增加 IDEA 同源文件类型图标

**作用域**：Editor 左侧文件 tab、右侧 split tab 的文件名前图标；Project 树 `FileTypeIcon` 复用；dirty 标记语义。

**IDEA 对照证据**：

- IDEA 编辑器中的 `package.json` 文件 tab 在文件名前显示 16px 文件类型图标；
- 文件 tab 的类型图标与 Project 树使用同一套文件类型图形；
- 修改状态由 tab 自身的状态提示表达，不应把普通文件 tab 换成 diff/commit 图标。

**原实现**：

- 左侧文件 tab 只有文件名、dirty `●` 和关闭按钮，没有文件类型图标；
- 右侧 split tab 使用通用 `file` SVG，dirty 时甚至切换成 `commit` 图标；
- 与 Project 树已有的 `EntryIcon` / 宿主 `primitives.FileTypeIcon` 不一致。

**修复**：

- 左侧文件 tab 在文件名前复用：
  `EntryIcon({ entry: { path, kind: 'file' }, expanded: false })`；
- 右侧 split tab 使用同一 `EntryIcon`，dirty 仍只显示文件名后的 `●`；
- 不新增第二套扩展名映射、图标资源或 tab 组件；
- 图标保持 16px，tab 现有 gap 6px 负责图标与文字间距。

**回归**：

```bash
node --test tests/round375.test.mjs tests/round178.test.mjs tests/round311.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
git diff --check
```

- RED：`tests/round375.test.mjs` 初始 2 fail；
- GREEN：目标与相关回归 15 pass / 0 fail；
- 全量：`npm test` = **1264 pass / 0 fail**；
- DSH Web 运行态：
  - `README.md` tab 的第一个子元素是 16×16 Markdown `FileTypeIcon`；
  - `.hidden-note.txt` tab 的第一个子元素是 16×16 通用文件 `FileTypeIcon`；
  - 文件名、dirty/关闭控件与 tab 溢出布局保持不变；
- profile 同步后完成运行态验证。

**下一步**：

- 继续 IDEA Project 左上角视图选择器取证与语义映射；
- 仅用现有 Project 树、open tabs 与 git changes 数据实现可靠视图，不伪造 Packages/Production/Tests；
- 优先确认 `Project Files`、`Open Files`、`All Changed Files` 的可用映射。

## 2026-11-15 — Project 多选与无活动文件状态已对齐（验证轮）

**作用域**：Project 目录+文件多选、`Expand Selected`、无活动编辑器文件时的 `Select Opened File`。

**IDEA 对照证据**：

- IDEA 中范围多选 18 个目录/文件后，`Expand Selected` 仍 enabled；
- 关闭全部编辑器标签后，窗口无活动文件，`Select Opened File (⌥F1, 1)` disabled；
- 重新打开 package.json 后该动作恢复 enabled。

**DSH 运行态**：

- 目录 `docs` + 文件 `README.md` 多选成功；
- `»` 菜单中的 `展开所选` enabled；
- 关闭全部 DSH 文件标签后：
  - `定位当前文件 (⌥F1, 1)` disabled；
  - workspace 显示“未打开文件”；
- 重新打开文件后恢复；
- 与 IDEA 当前状态一致。

**结论**：

- 本轮无需代码改动；
- `projectCanExpandSelection(rows, selection)` 已按“选中项中存在目录”判断；
- `hasActiveFile: activePath !== null` 已正确驱动 `Select Opened File` disabled。

**回归基线**：

```bash
npm test
```

- **1262 pass / 0 fail**。

**下一步**：

- 核对 IDEA Project 左上角视图选择器（`Project:` 后的 Project 下拉）；
- 对照 DSH 是否只支持单一 Project 树，确认是否可用现有 Group by 语义实现
  Project / Packages / Project Files 等视图，而不复制文件树实现。

## 2026-11-15 — Project 树背景点击保留选择（IDEA 对齐）

**作用域**：Project 树背景点击、选择 anchor、空选区、根目录拖放区域。

**IDEA 对照证据**：

- 选中 Project 根节点后，在树下方空白区域左键点击；
- IDEA 仍保持根节点 selected，不产生空选区；
- 树背景仍是 Project 的空白区域，可执行背景级操作。

**原实现**：

- Project 树容器的 `onClick` 在未命中 `.dsh-editor-tree-row` 时调用
  `onClearSelection()`；
- `clearTreeSelection()` 同时清空 `selectedPath`、`selection` 和
  `selectionAnchor`；
- 这与当前 IDEA 的“选择始终保留一个主行”不一致。

**修复**：

- 删除 Project 树容器的背景清选分支；
- 删除 `clearTreeSelection` 及 `onClearSelection` prop；
- 保留树背景的 `onDragOver / onDrop`，拖到空白区域仍移动到工作区根；
- 点击背景时浏览器原生焦点仍落到 `role="tree"` 容器；
- 更新 round74 旧契约，新增 `tests/round373.test.mjs`。

**回归**：

```bash
node --test tests/round373.test.mjs tests/round74.test.mjs \
  tests/round372.test.mjs tests/round359.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
git diff --check
```

- RED：`tests/round373.test.mjs` 初始 1 fail（仍存在背景清选）；
- GREEN：目标与相关回归 8 pass / 0 fail；
- 全量：`npm test` = **1262 pass / 0 fail**；
- DSH Web 运行态：
  - 选中 `.hidden-note.txt`；
  - 点击树背景；
  - 该行仍为 `aria-selected="true"`；
  - 焦点元素为 `role="tree"` 的 Project 容器；
  - 背景拖放监听仍存在。

**下一步**：

- 核对目录 + 文件多选组合在 IDEA 中 `Expand Selected` 的状态；
- 检查 `Select Opened File` 在没有任何活动编辑器文件时的可见/disabled；
- 继续复用现有 selection helper，不新增选择状态。

## 2026-11-15 — Project 根节点 Expand Selected 与 Collapse All 状态（IDEA 对齐）

**作用域**：Project `Expand Selected`、`Collapse All`、根目录递归展开和文件-only/空选区 disabled。

**IDEA 对照证据**：

- 选中 Project 根节点时，`Expand Selected` 真实可点击；
- 点击后 IDEA 递归展开 `.idea / docs / src / node_modules` 等整棵项目；
- 选中文件时图标呈禁用态；
- 存在展开目录时 `Collapse All` enabled，全部收起后 disabled。

**原缺口**：

- `projectCanExpandSelection` 显式排除 `row.root === true`；
- 因此 DSH 根节点选中时错误禁用 `展开所选`；
- 但 `expandSelectedTree` 已会把目录路径转换为 `['', ...ancestors, path]`，
  对根路径本来就能执行有界递归展开。

**修复**：

- `projectCanExpandSelection` 接受任意已选目录：
  `row.root === true || row.path !== ''`；
- 文件-only 与空选区继续 disabled；
- 根节点动作复用现有 `expandSubtrees([''])`，不新增整树遍历实现；
- 更新 round359 旧契约，新增 `tests/round372.test.mjs`；
- 同步 README 中“根-only 禁用”的旧描述。

**回归**：

```bash
node --test tests/round372.test.mjs tests/round359.test.mjs \
  tests/round363.test.mjs tests/round371.test.mjs tests/round370.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
git diff --check
```

- RED：`tests/round372.test.mjs` 初始 1 fail（root=false）；
- GREEN：目标与相关回归 14 pass / 0 fail；
- 全量：`npm test` = **1262 pass / 0 fail**；
- DSH Web 运行态：
  - 折叠根目录并选中根：`展开所选` enabled；
  - 点击后 root/docs/src 展开；
  - 选择 `note.txt` 文件：`展开所选` disabled；
  - 存在展开目录时 `全部收起` enabled；
  - 点击后全部收起，再打开 `»` 时 `全部收起` disabled。

**下一步**：

- 继续用 IDEA 实窗检查空选区与多选目录组合；
- 核对 `Select Opened File` 在无活动文件时是否隐藏或仅 disabled；
- 优先复用现有 selection / helper，不新增状态模型。

## 2026-11-15 — Project 主工具栏移除重复 Expand All，并修复 Options 作用域错误

**作用域**：Project 主工具栏、`»` 溢出菜单、Project Options 的“全部展开”、EditorWorkspace 与 ProjectPanel 状态边界。

**IDEA 对照证据**：

- IDEA Project 实窗工具栏为：
  `New File or Directory… / Select Opened File (⌥F1, 1) /
  Expand Selected / Collapse All / Options / Hide`；
- 安装包 `idea/PlatformActions.xml` 的 `ProjectViewToolbar` 仍引用
  `SelectInProjectView / ExpandRecursively / ExpandAll / CollapseAll`；
- 当前 Experimental UI 实窗以 `Expand Selected` 替代并隐藏 `Expand All`；
- 因此 DSH 仅在 Options 中保留“全部展开”，主工具栏和 `»` 不再重复。

**实现**：

- 删除 ProjectPanel 主工具栏的 `expandAll` action；
- 保留 Options 顶层的 `expandAll`；
- 在 EditorWorkspace 中统一计算：
  `const projectExpandAllAvailable = projectCanExpandAll(entries, children, expanded);`
- Options 的 disabled 改为读取 `projectExpandAllAvailable`；
- 删除 ProjectPanel 已无使用的 `canExpandAll` prop；
- 更新 round326 / round363 的旧工具栏契约；
- 新增 `tests/round371.test.mjs`。

**运行态发现的附加缺陷**：

- 点击 Project `Options` 后控制台报：
  `canExpandAll is not defined`；
- 根因是 `canExpandAll` 只是 ProjectPanel prop，但 Options 回调位于
  EditorWorkspace 作用域，却直接引用该名字；
- 修复后在 EditorWorkspace 作用域计算同一状态，ProjectPanel 与 Options
  不再跨作用域读取；
- Options 菜单恢复可用。

**回归**：

```bash
node --test tests/round371.test.mjs tests/round363.test.mjs \
  tests/round328.test.mjs tests/round370.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
git diff --check
```

- RED：`tests/round371.test.mjs` 首先因主工具栏仍有重复 Expand All 失败；
- 再做作用域 RED：因缺少 EditorWorkspace 级 `projectExpandAllAvailable` 失败；
- GREEN：目标与相关回归 13 pass / 0 fail；
- 全量：`npm test` = **1260 pass / 0 fail**；
- DSH Web 运行态：
  - Project 主工具栏无独立“全部展开”；
  - `»` 仅含“展开所选 / 全部收起”；
  - Options 正常打开并含“全部展开”；
  - 折叠 docs 后 Options 的“全部展开”启用；
  - 点击后 docs 重新展开，无控制台错误。

**下一步**：

- 继续以 IDEA Project 实窗核对 `Expand Selected` 和 `Collapse All` 在
  文件-only、目录、空选区和全展开状态下的 disabled；
- 优先复用 `projectCanExpandSelection`、`projectCanCollapseAll`，不为单次
  状态新增第二套判断。

## 2026-11-15 — Project Select Opened File 的 Alt+F1, 1 快捷键

**作用域**：Project 工具窗口、活动编辑器文件、工具窗口全局键盘路由。

**IDEA 对照证据**：

- IDEA Project 工具栏的 `Select Opened File` 可访问名称明确包含 `(⌥F1, 1)`；
- 工具栏顺序为 `New File or Directory… / Select Opened File / Expand Selected /
  Collapse All / Options / Hide`；
- DSH 已有同名按钮和真实 `revealActive()`，但此前没有 IDEA 快捷键。

**实现**：

- 新增 `selectOpenedChordAction(event, armedAt, now, hasActiveFile)`：
  - 有活动文件时，无修饰 `Alt+F1` 返回 `arm`；
  - 1.5 秒内按无修饰 `1` 返回 `reveal`；
  - 超时或其他按键返回 `clear`；
  - 无活动文件时不接管 `Alt+F1`；
- `revealActiveRef` 保存当前真实的 `revealActive` 回调，避免把回调加入旧的
  工具窗口快捷键 effect 依赖而改变已有绑定生命周期；
- `Alt+F1` 后按 `1` 调用同一个 `revealActive()`：
  - 切回 Project；
  - 展开活动文件的祖先；
  - 选中并滚动到该行；
- `Alt+1` 仍是工具窗口键，和第二段无修饰 `1` 明确区分；
- Project 按钮 tooltip/aria-label 更新为 `定位当前文件 (⌥F1, 1)` /
  `Select Opened File (⌥F1, 1)`；
- 新增 `tests/round370.test.mjs`。

**回归**：

```bash
node --test tests/round370.test.mjs tests/round143.test.mjs \
  tests/round193.test.mjs tests/round192.test.mjs tests/round328.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
git diff --check
```

- RED：`tests/round370.test.mjs` 初始 4 fail；
- GREEN：目标与相关回归 23 pass / 0 fail；
- 全量：`npm test` = **1257 pass / 0 fail**；
- DSH Web 运行态：
  - 先折叠 Project 根目录；
  - 切到 Commit；
  - 按 `⌥F1` 再按 `1`；
  - 活动切回 Project，根目录重新展开；
  - 树选中当前活动文件 `docs/note.txt`；
  - 随后 `⌥1` 仍正常切换 Project 工具窗口。

**下一步**：

- 继续对齐 IDEA 当前 Project 主工具栏动作集；
- 当前 IDEA 实窗主工具栏没有独立 `Expand All`，只有
  `Expand Selected / Collapse All`，其 `Expand All` 是否应只保留在 Options
  需在下一轮实窗复核后决定。

## 2026-11-15 — Commit diff 的文件级差异包含摘要（IDEA 对齐）

**作用域**：Commit 本地更改 diff 的工具条摘要、文件勾选状态、窄窗布局。

**IDEA 对照证据**：

- `Commit: README.md` 未勾选时工具条显示 `36 differences, 0 included`；
- 在 Changes 中勾选 `engineering-memory.md` 后，diff 切换为该文件，
  工具条只显示 `2 differences`，不再出现 `0 included`；
- 因而当前可确认的语义是文件级零包含/全部包含，不需要臆造逐 hunk included 数。

**实现**：

- `DiffPreview` 增加 `includedInCommit`，由真实 `commitSelection.has(path)` 传入；
- 新增 `diffIncludedSummaryState(total, included)`：
  - 无 hunk 返回 `null`；
  - 未包含返回 `none`；
  - 已包含返回 `all`；
- 摘要只用于本地 Commit 更改，不用于 commit history / revision / clipboard /
  combined diff；
- 文案：
  - `N 个差异，0 个已包含`；
  - `N 个差异`；
  - tooltip 明确写明“文件级提交勾选”；
- `diffSummaryVisibleForWidth` 在实测宽度 `<380px` 时隐藏摘要，避免挤压
  文件导航、hunk 导航和关闭按钮；
- 新增 `tests/round369.test.mjs`。

**回归**：

```bash
node --test tests/round369.test.mjs tests/round138.test.mjs \
  tests/round176.test.mjs tests/round324.test.mjs \
  tests/round368.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
git diff --check
```

- RED：`tests/round369.test.mjs` 初始 5 fail；
- GREEN：目标与相关回归 29 pass / 0 fail；
- 全量：`npm test` = **1253 pass / 0 fail**；
- 浏览器运行态：
  - 未勾选 README：`1 个差异，0 个已包含`；
  - 勾选后：`1 个差异`；
  - tooltip 分别为“尚未包含 / 已包含”；
  - 307px 窄工具栏隐藏摘要，468px 宽工具栏恢复显示；
  - Commit 活动和 `README.md` 过滤词保持。

**适用边界**：

- 当前只有整文件提交勾选；不宣称支持逐 hunk inclusion；
- 如果未来实现逐 hunk 包含，必须用真实 included hunk 数替换当前 all/none 状态。

**下一步**：

- 回到 Project 工具窗口，用 CUA 实窗取证工具栏、Options 与树选择动作的当前差异；
- 只选择可复用现有文件树/选择模型实现的 IDEA 交互，先写 RED 再落地。

## 2026-11-15 — Diff 的 Esc 关闭与浮层优先权（IDEA 对齐）

**作用域**：Commit / Compare diff 的键盘路由、关闭按钮文案、ContextMenu 与 Monaco 查找/建议浮层。

**IDEA 证据**：

- 当前 IntelliJ IDEA 的 Search Everywhere 明确列出 `Close Diff Editor ⎋`；
- 实窗在 `Commit: README.md` diff 编辑器中按 `Esc`，diff 标签关闭并回到原编辑器标签；
- IDEA 的 diff 工具条同时显示 `N differences, M included`，关闭动作不需要鼠标。

**原缺口**：

- DSH 的 diff 只支持工具栏关闭与 `⌘W`，`Esc` 没有任何处理；
- README 中“IDEA 实窗复测 Esc 不关闭 diff”的旧结论已过期。

**修复**：

- 新增 `isDiffCloseShortcut(event, insideDiffPane, popupOwnsEscape)`：
  - 仅接受 diff 表面内的无修饰 `Escape`；
  - Control/Meta/Alt/Shift 组合键不触发；
- 监听器在组合 diff 的 `Ctrl+Escape` 之后处理普通 `Escape`；
- `popupOwnsEscape` 只认真正的 `[role="menu"]` 和 Monaco `.find-widget.visible` /
  `.suggest-widget.visible`；
- 不把所有 `[role="dialog"]` 都当成阻塞：Monaco 的“无结果”容器本身是可见 dialog，
  泛化会永久吞掉 Esc；
- 关闭按钮文案改为 `关闭差异编辑器 (Esc)` / `Close Diff Editor (Esc)`。

**回归**：

```bash
node --test tests/round368.test.mjs tests/round367.test.mjs tests/round324.test.mjs
npm test
node --check lib/client.js
git diff --check
```

- RED：`tests/round368.test.mjs` 初始 3 fail；
- GREEN：目标与相关回归 8 pass / 0 fail；
- 全量：`npm test` = **1248 pass / 0 fail**；
- 浏览器运行态：打开 README diff → `⌘F` 打开 Monaco 查找 → `Esc` 只关闭查找、
  diff 仍在 → 再按 `Esc` 关闭 diff；Commit 活动和 `README.md` 过滤词保持；
- 菜单运行态：打开 diff `»` 菜单后 `Esc` 只关闭菜单，diff 不关闭。

**下一步**：

- 取证 IDEA `N differences, M included` 的语义，确认是否能用现有
  file-level commit selection 正确表达；
- 在不能可靠表达 per-hunk inclusion 前，不伪造“已包含”计数。

## 2026-11-15 — Binary diff 的 TDZ / hidden 崩溃导致 Editor 重挂载

**作用域**：Commit binary diff、DiffPreview 首次渲染、EditorWorkspace 活动与 Changes 过滤保持。

**症状**：

- Commit 中过滤 `binary.bin` 后按 Enter：
  - Commit 活动有时能保留，但 Changes 过滤词被清空；
  - binary diff 标签/工具栏不出现；
- 浏览器 MutationObserver 记录宿主 `[data-dsh-editor-host]` 删除后重新添加，
  `[data-dsh-editor-workspace]` 重新挂载。

**根因证据**：

- 浏览器捕获到未处理错误：
  `ReferenceError: Cannot access 'diffLoadedRef' before initialization`；
- 来源为 Round 365 新增的 `diffUnavailable` 在渲染期读取了后面才声明的
  `const diffLoadedRef`，触发 TDZ，React 整棵树被卸载；
- 修复声明顺序后，继续捕获到 `ReferenceError: hidden is not defined`；
- `hidden` 是旧 DiffPreview 的二进制宿主可见性判定，重构时被误删，但 return 仍读取。

**修复**：

- `diffLoadedRef` 提前到 DiffPreview 顶部、所有 render-time 状态计算之前；
- 恢复并显式声明：
  `const hidden = target === null || state.binary;`；
- 失败态仍只让 Monaco model 依赖动作 disabled，Reload / Open Local 保持可用；
- 没有扩大持久化范围，没有把 `diffTarget` 临时模型或 undo 栈写入 localStorage。

**回归**：

```bash
node --test tests/round367.test.mjs tests/round365.test.mjs tests/round366.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
git diff --check
```

- RED：`tests/round367.test.mjs` 先因 `diffLoadedRef` 声明晚于读取失败 1 项；
- 修声明后，再因 `hidden` 未声明失败 1 项；
- GREEN：目标与相关回归 9 pass / 0 fail；
- 全量：`npm test` 最终 = **1248 pass / 0 fail**；
- 浏览器运行态：binary Enter 后宿主新增次数 0、未捕获错误 0；
- Changes 过滤保持 `binary.bin`，显示 `提交: binary.bin` 和“二进制文件不显示差异”；
- `»` 菜单中 View / Swap / Disable Editing / Find / Settings / Undo / Redo 均 disabled，
  Reload 与打开本地版本可用。

**下一步**：

- 后续 diff 渲染改动必须保持“先声明、后读取”的 TDZ 边界；
- 新增 Render-time 标识符时先跑 `tests/round367.test.mjs` 与
  `tests/static-order.test.mjs`，不要把“宿主重建”误判为活动状态问题。

## 2026-11-15 — Commit diff 活动窗口不变量（部分闭环）

**作用域**：Commit Changes 的 Show Diff、预览点击、键盘 Enter、`diffTarget` effect。

**症状**：

- binary fixture 的 Show Diff/Enter 后，运行态回到 Project 工具窗口；
- Diff 标签和工具栏没有稳定保留，说明仅设置 `diffTarget` 不足以证明活动窗口
  不变量。

**已确认缺口**：

- `onShowDiff` 与 `onSelectDiff` 没有显式保持 Commit activity；
- `onChangesKeyDown` 的 Enter 分支只设置 `diffTarget`/`diffActive`；
- `diffTarget` effect 只设置 `diffActive`，没有再次确认 activity 与 panelVisible。

**修复**：

- Show Diff、Changes 预览、Enter 三条入口显式：
  - `setActivity('commit')`；
  - `setPanelVisible(true)`；
  - `setDiffTarget(...)`；
  - `setDiffActive(true)`；
- `diffTarget` 非空 effect 再次设置 Commit + visible；
- 新增 `tests/round366.test.mjs` 锁定三条入口和 effect 不变量。

**回归**：

```bash
node --test tests/round366.test.mjs tests/round171.test.mjs \
  tests/round172.test.mjs tests/round365.test.mjs \
  tests/static-order.test.mjs tests/syntax.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
git diff --check
```

- RED：`tests/round366.test.mjs` 初始 2 fail；
- GREEN：目标与相关回归 18 pass / 0 fail；
- 全量：`npm test` = **1242 pass / 0 fail**；
- 语法、空白和 profile 一致性通过。

**运行态限制**：

- 重新打开临时 binary fixture 后，Enter 仍回到 Project；
- 说明已补的三个入口守卫不是完整根因，或运行态操作仍命中了其他活动切换路径；
- 临时 fixture 已移除；
- 本轮只把“入口必须显式保持 Commit”闭环，不宣称 binary diff 已修复。

**下一步**：

- 改用受版本控制的 binary fixture，避免 untracked 文件在状态刷新中消失；
- 在 `selectActivity`/ActivityStripe 与 `setActivity('project')` 四个调用点增加
  临时可观测标记，定位最后一次活动写入来源；
- 找到根因后再补真正的 RED-GREEN 与 binary 运行态证据。

## 2026-11-15 — Diff 无模型状态 disabled

**作用域**：Commit / Compare diff 工具栏和 `»` 菜单，binary、缺失文件、首次加载中。

**原缺陷**：

- Diff 没有 Monaco model 时，视图切换、Swap Sides、Disable Editing、
  Settings、查找、折叠和 undo/redo 仍显示可执行；
- 这些动作内部大多直接 return，形成静默 no-op；
- 只有 `重新加载差异` 和 `打开本地版本` 是有效恢复路径。

**实现**：

- 新增 `diffUnavailable`：
  `target === null || state.binary || state.missing ||
  diffLoadedRef.current === null`；
- 以下动作统一使用该状态 disabled：
  - view / swapSides / disableEditing；
  - focusOppositePane / selectPositionInOppositePane；
  - find / collapse / combined file collapse；
  - settings；
  - undo / redo；
- actionable selection 同时要求 `!diffUnavailable`；
- `重新加载差异` 保持 enabled；
- `打开本地版本` 只由 `localPathAvailable` 决定，文件仍存在时继续可用；
- 不把普通操作提示（例如“没有可撤销的块还原”）误判为模型不可用。

**回归**：

```bash
node --test tests/round365.test.mjs tests/round362.test.mjs \
  tests/round361.test.mjs tests/round202.test.mjs \
  tests/round208.test.mjs tests/round266.test.mjs \
  tests/round313.test.mjs tests/round156.test.mjs \
  tests/round319.test.mjs tests/static-order.test.mjs \
  tests/syntax.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
git diff --check
```

- RED：`tests/round365.test.mjs` 初始 1 fail
  （缺少 `diffUnavailable`）；
- GREEN：相关回归通过，最终全量 **1238 pass / 0 fail**；
- 语法、空白和 profile 一致性门禁通过。

**运行态限制**：

- 创建临时 binary fixture 后，Commit `Show Diff` 的现有活动切换路径回到了
  Project，未能稳定进入 binary diff 工具栏；
- 临时文件已删除；
- 因此本轮不宣称 binary UI disabled 已由运行态证明，只记录静态契约、全量回归
  和该切换问题，留给下一轮定位。

**已排除方案**：

- 保留无模型动作并依赖内部 return；
- 在 binary 状态隐藏整个 Diff 工具栏，连关闭/恢复入口一起移除；
- 把普通操作错误当作“模型不可用”。

## 2026-11-15 — Terminal New Predefined Session 与字号动作

**作用域**：Terminal 工具栏、可用 shell 菜单、Terminal Options 字号设置。

**IDEA 证据**：

- `TerminalBundle.properties`：
  - `action.Terminal.NewTab.text=New Tab`；
  - `action.TerminalNewPredefinedSession.text=New Predefined Session`；
- `ActionsBundle.properties`：
  - `action.TerminalIncreaseFontSize.text=Increase Font Size`；
  - `action.TerminalDecreaseFontSize.text=Decrease Font Size`；
  - `action.TerminalResetFontSize.text=Reset Font Size`；
- IDEA 使用三个独立动作，而不是一个循环字号按钮。

**原缺陷**：

- DSH shell 下拉仍显示“选择 shell / Choose shell”，与 IDEA 的
  `New Predefined Session` 不一致；
- Options 只有一个“切换字号 / Cycle font size”，无法明确增大、减小或重置。

**实现**：

- shell 下拉正式文案改为
  `新建预定义会话` / `New Predefined Session`；
- 保留现有真实 shell 列表，不伪造 IDEA 专属 session 配置；
- 新增 `terminalFontSize(current, action)`：
  - `increase`：+1，最多 24；
  - `decrease`：−1，最少 8；
  - `reset`：恢复 12；
- Terminal Options 改为三个独立动作：
  - `增大字号 / Increase Font Size`；
  - `减小字号 / Decrease Font Size`；
  - `重置字号 / Reset Font Size`；
- 每次变化继续写入 `dsh-editor.terminal.fontSize`。

**回归**：

```bash
node --test tests/round364.test.mjs tests/round215.test.mjs \
  tests/round149.test.mjs tests/round150.test.mjs \
  tests/round70.test.mjs tests/round34.test.mjs \
  tests/round343.test.mjs tests/dictionary.test.mjs \
  tests/static-order.test.mjs tests/syntax.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
git diff --check
```

- RED：`tests/round364.test.mjs` 初始 1 fail
  （缺少 `terminalFontSize`）；
- GREEN：相关回归 **31 pass / 0 fail**；
- 全量：`npm test` = **1236 pass / 0 fail**；
- 语法、空白和 profile 一致性门禁通过。

**运行态**：

- 63101 `editor-test` profile 已同步；
- Terminal 工具条显示 `新建预定义会话`；
- Terminal Options 显示
  `清屏 / 增大字号 / 减小字号 / 重置字号 / 刷新`；
- 执行增大字号后菜单和终端仍正常，随后执行重置回到 12pt。

**已排除方案**：

- 继续用“Cycle font size”代替 IDEA 三个动作；
- 把 shell 列表包装成不存在的 IDE 预定义 Session 配置；
- 让字号无限增大或越过可用范围。

## 2026-11-15 — Project Expand All / Collapse All disabled 边界

**作用域**：Project 工具栏、`»` 菜单、Options 顶层“全部展开”、树展开状态。

**IDEA 证据**：

- `ExpandAllAction.update()` 使用
  `TreeExpander.isExpandAllVisible()` 与 `isExpandAllEnabled()`；
- `actionPerformed()` 只在 `TreeExpander.canExpand()` 为真时执行；
- `CollapseAllAction.update()` 使用 `isCollapseAllVisible()` 与
  `canCollapse()`；
- 因此两个按钮都必须反映树的真实展开能力，而不是始终可执行。

**实现**：

- 新增纯函数 `projectCanExpandAll(entries, children, expanded)`：
  - 递归检查当前已知目录；
  - 发现任一未展开目录，或某个已展开目录尚未加载 listing 时返回 `true`；
  - 所有已知目录均已展开且 listing 完整时返回 `false`；
- 新增 `projectCanCollapseAll(expanded)`：
  - expanded 集合为空时返回 `false`；
- Project 工具栏：
  - `全部展开` 使用 `disabled: !canExpandAll`；
  - `全部收起` 使用 `disabled: !canCollapseAll`；
- Options 顶层的“全部展开”复用同一个 `canExpandAll`；
- 不改变展开算法、树缓存或持久化键。

**回归**：

```bash
node --test tests/round363.test.mjs tests/round326.test.mjs \
  tests/round327.test.mjs tests/round177.test.mjs \
  tests/round185.test.mjs tests/round199.test.mjs \
  tests/round198.test.mjs tests/round312.test.mjs \
  tests/dictionary.test.mjs tests/static-order.test.mjs \
  tests/syntax.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
git diff --check
```

- RED：`tests/round363.test.mjs` 初始 1 fail
  （缺少 `projectCanExpandAll`）；
- GREEN：相关回归 **43 pass / 0 fail**；
- 全量：`npm test` = **1233 pass / 0 fail**；
- 语法、空白与 profile 一致性门禁通过。

**运行态**：

- 63101 `editor-test` profile 已同步；
- 树完全展开时 `»` 显示
  `展开所选 disabled / 全部展开 disabled / 全部收起 enabled`；
- 执行“全部收起”后 docs/src 收起，“全部展开”恢复 enabled；
- 随后重新全部展开并恢复 Always Select Opened File 的测试前状态。

**已排除方案**：

- 只在按钮点击函数里做 no-op，仍向用户显示可执行入口；
- 把 Expand All 从 DSH 删除；当前 IDEA action registry 仍声明该动作；
- 用 `rows.length` 猜测是否能展开，导致未加载的深层目录被漏算。

## 2026-11-15 — Diff Disable Editing

**作用域**：可写 Commit diff、Monaco modified 编辑器、块还原、undo/redo 和选区还原。

**IDEA 证据**：

- `SimpleDiffViewer.createToolbarActions()` 创建 `MyReadOnlyLockAction`；
- 该动作继承 `TextDiffViewerUtil$EditorReadOnlyLockAction`；
- `SimpleDiffViewer$MyReadOnlyLockAction.doApply()` 在切换后调用
  `SimpleDiffModel.updateGutterActions(true)`，说明锁定必须同步影响 gutter 操作；
- `DiffBundle.properties` 的正式文案为 `disable.editing=Disable Editing`；
- IDEA 同时提供 `synchronize.scrolling=Synchronize Scrolling`，但 Monaco 的
  diff editor 没有公开的解耦滚动 API，本轮不伪造该动作。

**实现**：

- 新增每个 Diff widget 内的 `editLocked` 状态，默认 `false`、不持久化；
- 新增纯函数 `diffEditingEnabled({writable, swapped, locked})`：
  - 只读比较、Swap Sides 或显式锁定时均返回 `false`；
- `readOnly`、`renderMarginRevertIcon`、`glyphMargin` 全部由该 helper 统一计算；
- Diff 工具栏/`»` 增加 `disableEditing`：
  - 图标 `unlock` / `lock`；
  - 当前状态用 `✓` 表示；
  - Swap Sides 时 disabled；
- 锁定时：
  - modified 侧不可编辑；
  - 块还原 gutter 箭头关闭；
  - undo/redo 菜单项和 `⌘Z / ⇧⌘Z` 键盘入口失效；
  - 选区还原失效；
- 再次点击恢复编辑，不改变文件或索引。

**回归**：

```bash
node --test tests/round362.test.mjs tests/round361.test.mjs \
  tests/round266.test.mjs tests/round156.test.mjs \
  tests/round172.test.mjs tests/round205.test.mjs \
  tests/round203.test.mjs tests/round292.test.mjs \
  tests/round202.test.mjs tests/round208.test.mjs \
  tests/round335.test.mjs tests/static-order.test.mjs \
  tests/syntax.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
git diff --check
```

- RED：`tests/round362.test.mjs` 初始 1 fail
  （缺少 `diffEditingEnabled`）；
- GREEN：最终相关回归 **49 pass / 0 fail**；
- 全量：`npm test` = **1230 pass / 0 fail**；
- 语法、空白和 profile 一致性门禁通过。

**运行态**：

- 63101 `editor-test` profile 已同步；
- `Commit: README.md` 的 `»` 菜单显示 `禁用编辑`；
- 鼠标和键盘（`↓↓↓ Enter`）均可切换；
- 锁定时 `禁用编辑 ✓`，同时
  `撤销上次块还原 / 重做上次块还原` 显示 disabled；
- 再切换一次恢复编辑。

**已排除方案**：

- 只把 Monaco `readOnly` 设为 true，但仍保留块还原箭头和快捷键；
- 把 `Synchronize Scrolling` 做成无行为的假开关；
- 持久化锁定状态，导致下次进入 Diff 时意外只读。

## 2026-11-15 — Diff Settings 子菜单与对侧文案对齐

**作用域**：Commit / 比较 diff 工具栏、`»` 溢出菜单、Monaco 显示设置、焦点恢复。

**IDEA 证据**：

- `SimpleDiffViewer.createRightToolbarActions()` 把
  `SetEditorSettingsActionGroup` 作为单一动作加入右侧工具栏；
- 该组构造器使用 `DiffBundle.message("editor.settings")` 与
  `AllIcons.General.GearPlain`；
- `SetEditorSettingsActionGroup$AppearanceGroup` 的四个显示动作按顺序为：
  `EditorToggleShowWhitespaces / EditorToggleShowLineNumbers /
  EditorToggleShowIndentLines / EditorToggleUseSoftWraps`；
- `DiffBundle.properties`：
  - `editor.settings=Settings`；
  - `settings.appearance=Appearance`；
- `ActionsBundle.properties`：
  `action.Diff.FocusOppositePane.text=Select Opposite Diff Pane`。

**原缺陷**：

- DSH 把行号、Soft-Wrap、缩进线、空白字符和忽略空白散在差异主菜单；
- 对侧焦点动作仍使用内部 action id 的近似文案
  `Focus Opposite Pane`，与 IDEA 的 UI 文案不一致；
- 设置子项原先设置 `restoreFocus: false`，运行态点击后焦点落到页面根。

**实现**：

- 新增 `editorSettingsItems`，集中：
  - `Ignore Whitespaces`；
  - `Show Whitespaces`；
  - `Show Line Numbers`；
  - `Show Indent Guides`；
  - `Soft-Wrap`；
- `diffToolbarActions` 只保留一个 `settings` 齿轮动作；
- 宽布局点击齿轮由 `openDiffActionSubmenu()` 打开设置菜单；
- 窄布局 `»` 菜单通过 `items: action.items` 打开同一子菜单；
- 子项使用 `✓` 表示当前值并保持独立持久化；
- 移除子项的 `restoreFocus: false`，让 ContextMenu 走默认回焦链；
- 中文/英文文案改为 `选择对侧差异面板` /
  `Select Opposite Diff Pane`。

**回归**：

```bash
node --test tests/round361.test.mjs tests/round355.test.mjs \
  tests/round356.test.mjs tests/round357.test.mjs \
  tests/round210.test.mjs tests/round211.test.mjs \
  tests/round294.test.mjs tests/static-order.test.mjs \
  tests/syntax.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
git diff --check
```

- RED：`tests/round361.test.mjs` 初始 **3 fail**；
- 追加焦点契约后，`restoreFocus: false` 使该用例再次 **1 fail**；
- GREEN：最终相关回归 **26 pass / 0 fail**；
- 全量：`npm test` = **1227 pass / 0 fail**；
- 语法与空白门禁通过。

**运行态**：

- 63101 `editor-test` profile 已同步最新 client；
- `Commit: README.md` 的 `»` 菜单出现单一 `设置 ›`；
- 子菜单顺序为
  `忽略空白差异 / 显示空白字符 / 显示行号✓ / 显示缩进参考线 / 自动换行`；
- 切换“显示行号”后 `✓` 消失，再次切换恢复；
- 菜单关闭后焦点回到差异编辑器，而不是页面根；
- 对侧动作显示 `选择对侧差异面板 ⌃⇧⇥`。

**已排除方案**：

- 继续把五个设置平铺在主菜单，只补一个无行为的齿轮图标；
- 为 IDEA 的 Appearance 分组复制一层假配置；
- 保留 `Focus Opposite Pane` 文案或只改英文不改中文。

## 2026-11-15 — Project AutoscrollToSource 去重与偏好迁移

**作用域**：Project `Options → 行为`、Project 文件单击打开、旧版偏好存储。

**症状与触发条件**：

- 行为菜单同时出现「单击打开文件」和「自动滚动到源文件」；
- 两个入口都指向 Project 选择/打开文件，用户无法判断差异，且与当前 IDEA
  只有一个 `ProjectView.AutoscrollToSource` 行为项不一致。

**IDEA 证据**：

- 当前本地 IDEA 的 `ActionsBundle.properties`：
  - `action.ProjectView.AutoscrollToSource.text=Open Files with Single Click`；
  - description 为 “When a file is selected, open it for editing”；
- `AutoscrollToSource` 是 action id，不是第二个 UI 文案；
- 插件此前已有 `singleClickOpen`，其 UI 文案与行为才对应这个 action。

**根因**：

- 第 358 轮把 action id 误当成一个新的用户可见偏好；
- 新增 `autoScrollToSource` 后与既有 `singleClickOpen` 形成重复入口。

**修复**：

- 删除独立的 `autoScrollToSource` state、selection effect、toggle 和菜单项；
- Behavior 只保留一个
  `{ id: 'singleClickOpen', label: t('editor.openFilesSingleClick') }`；
- 新增纯函数 `projectSingleClickPreference(current, legacy)`；
- 新增 `readProjectSingleClickOpen()`：
  - 旧 key `dsh-editor.project.autoscrollToSource === '1'` 会迁移为
    `dsh-editor.project.singleClickOpen === '1'`；
  - 迁移后删除旧 key；
- 用户以后关闭该偏好时也会删除旧 key，避免下次启动被旧值重新启用；
- 删除不再使用的 `projectAutoScrollTarget` 与两份旧文案。

**回归**：

```bash
node --test tests/round360.test.mjs tests/round358.test.mjs \
  tests/round199.test.mjs tests/round198.test.mjs \
  tests/round194.test.mjs tests/round311.test.mjs \
  tests/round312.test.mjs tests/round177.test.mjs \
  tests/round185.test.mjs tests/dictionary.test.mjs \
  tests/static-order.test.mjs tests/syntax.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
git diff --check
```

- RED：`tests/round360.test.mjs` 初始在
  `projectSingleClickPreference is missing` 处失败；
- GREEN：目标与相关回归 **43 pass / 0 fail**；
- 全量：`npm test` = **1224 pass / 0 fail**；
- 语法与空白门禁通过。

**适用环境**：

- 当前 IDEA 2025/2026 action registry；
- DSH 旧用户可能已保存 `dsh-editor.project.autoscrollToSource`，迁移必须保留。

**运行态**：

- 最新 `lib/client.js` 已同步到 63101 的 `editor-test` profile；
- 刷新后 Project `选项 → 行为` 只剩：
  `启用预览标签页 / 单击打开文件 / 单击展开目录 / 始终选择打开的文件`；
- 在 `单击打开文件` 开启时，单击 `docs/note.txt` 后新增并选中该文件标签，
  证明统一行为项仍真实可用。

**已排除方案**：

- 保留两个行为项并只改其中一个文案；
- 直接删除旧 key 而不迁移，导致用户已有偏好静默丢失；
- 继续让 `autoscrollToSource` 同时承担单击与键盘选区打开两种语义。

## 2026-11-15 — Project Expand Selected 非根目录 disabled 边界

**作用域**：Project 工具栏 `Expand Selected`、多选、文件/项目根/空选区。

**症状与触发条件**：

- 文件-only 选区仍显示可用动作，点击后没有任何变化；根-only 选区也会把
  `''` 当作递归起点，语义上等于整树展开，和“展开所选”的作用域不一致。
- 上述状态均不应向用户展示为可执行命令。

**根因**：

- 旧 disabled 判断只检查 `selection.size === 0`；
- 动作调用链没有把“至少一个可递归的非根目录”提炼成可测试条件。

**修复**：

- 新增 `projectCanExpandSelection(rows, selection)`：
  - 仅当选中集合包含 `kind === 'directory'`、`root !== true` 且 `path !== ''`
    的行时返回 `true`；
  - 文件-only、根-only、空选区与文件+根混合选区均返回 `false`；
- Project 工具栏使用
  `disabled: !projectCanExpandSelection(rows, selection)`；
- 不改递归遍历、文件树缓存、`Expand All` 或右键菜单行为。

**回归**：

```bash
node --test tests/round359.test.mjs tests/round177.test.mjs \
  tests/round327.test.mjs tests/round326.test.mjs \
  tests/round190.test.mjs tests/static-order.test.mjs \
  tests/syntax.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
git diff --check
```

- RED：新增根-only 断言后，`tests/round359.test.mjs` 得到
  `true !== false`，确认旧判断未覆盖该边界；
- GREEN：定向 29 pass / 0 fail；
- 全量：`npm test` = **1221 pass / 0 fail**；
- `node --check lib/client.js`、`node --check lib/index.js`、
  `git diff --check` 均通过。

**适用环境**：

- DSH web 插件当前 Project 行模型把项目根表示为
  `{ path: '', kind: 'directory', root: true }`；
- 运行态仍受 Ego 93 的 Chromium clipboard permission prompt 阻塞，本轮没有
  伪造 UI 运行成功证据。

**已排除方案**：

- 只改文案而不改 toolbar disabled；
- 继续允许文件-only 点击并依赖动作内部静默 no-op；
- 把根-only 当作“展开全部”的隐式别名。

## 2026-11-15 — Project Autoscroll to Source

**作用域**：Project 树选择、编辑器跟随、Project View 行为选项。

**IDEA 证据**：

- ProjectView action registry 同时存在：
  - `ProjectView.AutoscrollFromSource`；
  - `ProjectView.AutoscrollToSource`；
- 插件此前只实现前者（Always Select Opened File）。

**实现**：

- 新增 `autoScrollToSource`，默认关闭：
  `dsh-editor.project.autoscrollToSource`；
- 新增纯函数 `projectAutoScrollTarget`：
  - 只对 `kind === 'file'` 且非根路径返回目标；
  - 目录/根只改变选择，不在编辑器里打开空内容；
- Project 可见时，选中文件会调用既有 `openFile`；
- 与 `activePathRef` 去重，避免重复打开当前文件；
- Behavior 菜单增加带 `✓` 的 Autoscroll to Source。

**回归**：

```bash
node --test tests/round358.test.mjs tests/round209.test.mjs \
  tests/round138.test.mjs tests/static-order.test.mjs \
  tests/syntax.test.mjs
npm test
```

- RED：`tests/round358.test.mjs` 初始缺少 helper；
- 目标与相关回归 **28 pass / 0 fail**；
- 全量 **1219 pass / 0 fail**。

**运行态**：

- 代码已同步到 63101 profile；
- Ego 93 仍由 Chromium clipboard permission prompt 占用。

## 2026-11-15 — Diff Show Indent Guides

**作用域**：Commit/比较 diff 工具栏、两侧 Monaco 编辑器。

**IDEA 证据**：

- 通用编辑器动作 `EditorToggleShowIndentLines.text=Sh_ow Indent Guides`；
- IntelliJ diff settings 单独保存 indent-guide 显示状态。

**实现**：

- 新增 `showIndentGuides`，默认关闭：
  `dsh-editor.diff.showIndentGuides`；
- 创建 diff 时设置 `guides.indentation`；
- 切换时 original / modified 两侧同步 `updateOptions`；
- 工具栏/`»` 增加 active 动作与缩进参考线图标；
- 与行号、soft-wrap、空白设置独立持久化。

**回归**：

```bash
node --test tests/round357.test.mjs tests/round356.test.mjs \
  tests/round355.test.mjs tests/static-order.test.mjs \
  tests/syntax.test.mjs
npm test
```

- RED：`tests/round357.test.mjs` 初始 **2 fail**；
- 目标与相关回归 **14 pass / 0 fail**；
- 全量 **1216 pass / 0 fail**。

**运行态**：

- 代码已同步到 63101 profile；
- Ego 93 仍由 Chromium clipboard permission prompt 占用。

## 2026-11-15 — Diff Soft-Wrap

**作用域**：Commit/比较 diff 工具栏、两侧 Monaco 编辑器、显示偏好。

**IDEA 证据**：

- 通用编辑器动作 `EditorToggleUseSoftWraps.text=Soft-Wrap`；
- IntelliJ `TextDiffSettings` 单独保存 `isUseSoftWraps`。

**实现**：

- 新增 `softWrap`，默认关闭，key：`dsh-editor.diff.softWrap`；
- 创建 diff 时设置 `wordWrap: 'on' | 'off'`；
- 切换时分别更新 original / modified 两侧 `wordWrap`，确保双栏同步；
- 工具栏/`»` 增加 `softWrap` active 动作与自动换行图标；
- 偏好独立于 Show Line Numbers、Whitespace 与 Ignore Whitespace。

**回归**：

```bash
node --test tests/round356.test.mjs tests/round355.test.mjs \
  tests/round337.test.mjs tests/static-order.test.mjs \
  tests/syntax.test.mjs
npm test
```

- RED：`tests/round356.test.mjs` 初始 **2 fail**；
- 目标与相关回归 **17 pass / 0 fail**；
- 全量 **1214 pass / 0 fail**。

**运行态**：

- 代码已同步到 63101 profile；
- Ego 93 仍由 Chromium clipboard permission prompt 占用。

## 2026-11-15 — Diff Show Line Numbers

**作用域**：Commit/比较 diff 工具栏、窄面板正文宽度、显示偏好。

**审计结论**：

- IDEA `Vcs.Diff.ToggleDiffAligningMode` 依赖 IntelliJ 自有
  `AlignedDiffModel`；Monaco 没有等价结构化模型，暂不伪造；
- IDEA 通用编辑器设置提供 `EditorToggleShowLineNumbers`；
- 行号切换可在 Monaco diff 的 original/modified editors 上精确实现，
  并能释放窄工具窗口的正文宽度。

**实现**：

- 新增 `showLineNumbers`，默认开启，key：
  `dsh-editor.diff.showLineNumbers`；
- 创建 diff 时设置 `lineNumbers: 'on' | 'off'`；
- 切换时 `diff.updateOptions({ lineNumbers })` 并持久化；
- 工具栏/`»` 增加 `lineNumbers` 动作，带 active 状态和专用图标；
- 中英文 `diffLineNumbers` 文案。

**回归**：

```bash
node --test tests/round355.test.mjs tests/round335.test.mjs \
  tests/round337.test.mjs tests/static-order.test.mjs \
  tests/syntax.test.mjs
npm test
```

- RED：`tests/round355.test.mjs` 初始 **2 fail**；
- 目标与相关回归 **20 pass / 0 fail**；
- 全量 **1212 pass / 0 fail**。

**运行态**：

- 代码已同步到 63101 profile；
- Ego 93 仍由 Chromium clipboard permission prompt 占用。

## 2026-11-15 — Folded Graph 导航只遍历可见代表行

**作用域**：Commit Graph 折叠单线提交、键盘 cursor、Home/End/Enter、上下文菜单。

**根因**：

- graph 折叠状态原先在 CommitGraph 内部；
- CommitLog 的 `↑/↓/Home/End/Enter/Shift+F10` 仍遍历完整 `graphEntries`；
- 方向键能进入折叠后未渲染的提交，菜单也可能锚定不存在的 row。

**实现**：

- 新增纯函数 `graphDisplayEntries(entries, folded)`：
  - expanded 返回全部提交；
  - folded 复用 `assignGraphLanes + linearRun`，只返回每个 run 的 `first`；
- 折叠状态上提到 CommitLog；
- `graphRows` 成为 keyboard cursor、Home/End、Enter 和上下文菜单的唯一集合；
- CommitGraph 只负责绘制，不再私藏 folded 状态；
- 折叠变化会清除 hover，隐藏 cursor 自动落到首个可见代表行。

**回归**：

```bash
node --test tests/round354.test.mjs tests/round353.test.mjs \
  tests/round352.test.mjs tests/round69.test.mjs \
  tests/round42.test.mjs tests/round45.test.mjs \
  tests/round46.test.mjs tests/static-order.test.mjs \
  tests/syntax.test.mjs
npm test
```

- RED：`tests/round354.test.mjs` 初始缺少 `graphDisplayEntries`；
- 目标与相关回归 **33 pass / 0 fail**；
- 全量 **1210 pass / 0 fail**。

**运行态**：

- 代码已同步到 63101 profile；
- Ego 93 仍由 Chromium clipboard permission prompt 占用。

## 2026-11-15 — Graph 行鼠标右键菜单

**作用域**：Commit Graph 鼠标右键、graph cursor 同步、菜单动作复用。

**实现**：

- `CommitGraph` 接入 `onContextMenu`，不在行内维护第二套菜单；
- graph option 右键先 `preventDefault` / `stopPropagation`，并打开该提交详情；
- CommitLog 的 graph wrapper 在打开菜单前：
  - `setGraphCursor(payload.commit.hash)`；
  - `setGraphHover(null)`；
  - 再调用现有 `onContextMenu(payload)`；
- 鼠标坐标直接作为菜单锚点；键盘路径继续使用真实行矩形。

**回归**：

```bash
node --test tests/round353.test.mjs tests/round352.test.mjs \
  tests/round42.test.mjs tests/round45.test.mjs \
  tests/static-order.test.mjs tests/syntax.test.mjs
npm test
```

- RED：`tests/round353.test.mjs` 初始 **2 fail**；
- 目标与相关回归 **23 pass / 0 fail**；
- 全量 **1207 pass / 0 fail**。

**运行态**：

- 代码已同步到 63101 profile；
- Ego 93 仍由 Chromium clipboard permission prompt 占用。

## 2026-11-15 — Graph Log 键盘上下文菜单

**作用域**：Commit Graph 键盘 cursor、提交菜单、过滤/刷新后的目标回退。

**实现**：

- 新增 `graphLogMenuTarget(entries, cursor, selected)`：
  - 优先 graph keyboard cursor；
  - cursor 缺失或刷新后失效时回退到当前详情提交；
  - hover 不参与，避免鼠标划过的行偷走键盘菜单目标；
- graph list 捕获 ContextMenu / Shift+F10；
- 通过 `data-dsh-graph-hash` 查找真实 graph 行并锚定菜单；
- 复用现有 `onContextMenu({ commit, x, y })`；
- graph option 增加 `aria-haspopup=menu`。

**回归**：

```bash
node --test tests/round352.test.mjs tests/round351.test.mjs \
  tests/round42.test.mjs tests/round45.test.mjs \
  tests/static-order.test.mjs tests/syntax.test.mjs
npm test
```

- RED：`tests/round352.test.mjs` 初始缺少 `graphLogMenuTarget`；
- 目标与相关回归 **23 pass / 0 fail**；
- 全量 **1205 pass / 0 fail**。

**运行态**：

- 代码已同步到 63101 profile；
- Ego 93 仍由 Chromium clipboard permission prompt 占用。

## 2026-11-15 — Flat Log 键盘上下文菜单

**作用域**：Commit Log flat 提交行、右键菜单复用、键盘锚点。

**实现**：

- flat 列表捕获 `ContextMenu` 与 `Shift+F10`；
- 目标提交通过 `flatLogTarget(visible, selected, 'current')` 取得，
  因此过滤后不会对隐藏提交打开菜单；
- 通过 `data-dsh-log-hash` 找到当前真实行，菜单锚到行下方；
- 复用现有 `onContextMenu({ commit, x, y })`，菜单动作无第二套实现；
- flat option 增加 `aria-haspopup=menu`。

**回归**：

```bash
node --test tests/round351.test.mjs tests/round350.test.mjs \
  tests/round36.test.mjs tests/static-order.test.mjs \
  tests/syntax.test.mjs
npm test
```

- RED：`tests/round351.test.mjs` 初始 **2 fail**；
- 目标与相关回归 **17 pass / 0 fail**；
- 全量 **1202 pass / 0 fail**。

**运行态**：

- 代码已同步到 63101 profile；
- Ego 93 仍由 Chromium clipboard permission prompt 占用。

## 2026-11-15 — Flat Commit Log 键盘导航

**作用域**：Commit Log 默认提交列表、过滤后的可见序列、详情同步。

**根因**：

- graph 模式已有 `↑/↓/Home/End/Enter`；
- 默认 flat 列表容器不可聚焦，行也没有 keyboard cursor，导致鼠标点击后才能
  “看日志”，键盘用户不能遍历提交；
- 过滤后的列表与完整 `commits` 不同，导航必须使用可见子集。

**实现**：

- 新增纯函数 `flatLogTarget(commits, selected, action)`：
  - 支持 next / previous / first / last / current；
  - 未知选中项从对应边界进入；
  - 到达边界后 clamp，不越出可见列表；
- Log list 永远 `tabIndex=0`，增加 `role=listbox`；
- flat 模式方向键、Home/End、Enter 使用 `visible` 并调用既有 `onShow`；
- flat 行增加 `role=option`；
- 点击行时 `onMouseDown` 把键盘焦点还给列表，后续方向键立即可用。

**回归**：

```bash
node --test tests/round350.test.mjs tests/round45.test.mjs \
  tests/round46.test.mjs tests/round348.test.mjs \
  tests/static-order.test.mjs tests/syntax.test.mjs
npm test
```

- RED：`tests/round350.test.mjs` 初始缺少 `flatLogTarget`；
- 目标与相关回归 **30 pass / 0 fail**；
- 全量 **1200 pass / 0 fail**。

**运行态**：

- 代码已同步到 63101 profile；
- Ego 93 仍由 Chromium clipboard permission prompt 占用。

## 2026-11-15 — Log 搜索关闭时清空隐形过滤

**作用域**：Commit Log 文本过滤、搜索按钮、Esc。

**根因**：

- 工具栏搜索按钮只切换 `showFilter`；
- 输入框隐藏后 `filter` 仍参与 `visible` 计算，界面会留下用户看不见的
  过滤条件；
- `Cmd+F` 再次打开输入时，隐藏查询会突然重新出现并改变结果。

**实现**：

- 搜索按钮打开时继续 focus + select；
- 搜索按钮关闭时同步 `setFilter('')`，与 Esc 的 clear-and-hide 语义一致；
- 过滤框隐藏时不再存在未显示的 active query。

**回归**：

```bash
node --test tests/round349.test.mjs tests/round348.test.mjs \
  tests/round347.test.mjs tests/static-order.test.mjs \
  tests/syntax.test.mjs
npm test
```

- RED：`tests/round349.test.mjs` 初始 **1 fail**；
- 目标与相关回归 **18 pass / 0 fail**；
- 全量 **1196 pass / 0 fail**。

**运行态**：

- 代码已同步到 63101 profile；
- Ego 93 仍由 Chromium clipboard permission prompt 占用，
  运行态留待权限恢复后统一补验。

## 2026-11-15 — Commit Log ⌘F Focus Text Filter

**作用域**：Commit Log 文本过滤、编辑器全局查找、Changes 快捷键互斥。

**IDEA 证据**：

- `ActionsBundle.properties` 包含
  `action.Vcs.Log.FocusTextFilter.text`；
- Log 的文本过滤是工具窗口动作，不应落到 Monaco 查找。

**实现**：

- CommitLog 根节点标记 `data-dsh-log-panel`；
- 新增 `logFilterInputRef`；
- Log pane 内捕获 `⌘/Ctrl+F`：
  - `preventDefault` / `stopPropagation`；
  - `setShowFilter(true)`；
  - 下一帧 focus + select 隐藏过滤输入；
- 工具栏搜索按钮也执行同样的 focus + select；
- 编辑器全局查找显式让出 `data-dsh-log-panel`；
- 中英文 `logFilterHint` 在输入 tooltip 中广告 `⌘F`。

**回归**：

```bash
node --test tests/round348.test.mjs tests/round347.test.mjs \
  tests/round18.test.mjs tests/static-order.test.mjs \
  tests/syntax.test.mjs
npm test
```

- RED：`tests/round348.test.mjs` 初始 **4 fail**；
- 目标与相关回归 **26 pass / 0 fail**；
- 全量 **1194 pass / 0 fail**。

**运行态**：

- 代码已同步到 63101 profile；
- Ego 93 仍由 Chromium clipboard permission prompt 占用，
  Changes / Log 的 `⌘F` 与 typeahead 运行态待恢复后统一补验。

## 2026-11-15 — Commit Changes 的 ⌘F 焦点归属

**作用域**：Commit tool window、Changes path filter、编辑器全局查找。

**根因**：

- Commit 激活时 ProjectPanel 并不挂载，因此不存在 Project 搜索抢键；
- 真正缺口是 Changes pane 没有 `⌘F` 动作：在树行上按 `⌘F` 时，
  编辑器查找监听会让出 `role="tree"`，最终没有焦点落点；
- 过滤框本身可见，但只能鼠标点击。

**实现**：

- CommitPanel 新增 `changeFilterRef`；
- Changes pane 标记 `data-dsh-changes-panel`；
- Changes 模式下捕获 `⌘/Ctrl+F`，只对 pane 内焦点生效：
  - `preventDefault` / `stopPropagation`；
  - focus 并 select 路径过滤框；
- 编辑器全局查找明确让出 `data-dsh-changes-panel`；
- 过滤框 `title` 使用中英双语 `changeFilterHint` 广告 `⌘F`。

**回归**：

```bash
node --test tests/round347.test.mjs tests/round346.test.mjs \
  tests/round18.test.mjs tests/static-order.test.mjs \
  tests/syntax.test.mjs
npm test
```

- RED：`tests/round347.test.mjs` 初始 **4 fail**；
- 目标与相关回归 **25 pass / 0 fail**；
- 全量 **1190 pass / 0 fail**。

**运行态**：

- 代码已同步到 63101 profile；
- Ego 93 仍在 Chromium clipboard permission prompt 的用户控制中，
  Changes typeahead 与 ⌘F 的 UI 运行态待恢复后一起补验。

## 2026-11-15 — Changes 树 Typeahead

**作用域**：Commit Changes 树键盘导航、路径过滤、分组/目录折叠。

**实现**：

- 新增纯函数 `changeTypeaheadRows`：
  - 从当前 DOM 中可见的 `data-dsh-change-path` 行生成候选；
  - 用 basename 做前缀匹配；
  - identity 用 `staged:<path>` / `unstaged:<path>`，兼容 `MM`
    同时出现在暂存与未暂存两组；
- `onChangesKeyDown` 复用 Project 已有的 `typeaheadStep`：
  - 不另写第二套匹配或回绕算法；
  - 只在当前渲染出的文件行中移动，自然遵守路径过滤、分组和目录折叠；
  - 1 秒停手后重置；同前缀重复按键跳到下一个命中；
- `Space` 仍只用于提交勾选，不进入 typeahead；输入框、textarea、select
  保持原生键盘行为；
- 命中后选择文件、滚入视野并把焦点留在 Changes 行。

**回归**：

```bash
node --test tests/round346.test.mjs tests/round138.test.mjs \
  tests/round168.test.mjs tests/round247.test.mjs \
  tests/static-order.test.mjs tests/syntax.test.mjs
npm test
```

- RED：`tests/round346.test.mjs` 初始缺少 `changeTypeaheadRows`；
- 目标与相关回归 **35 pass / 0 fail**；
- 全量 **1186 pass / 0 fail**。

**运行态**：

- 代码已同步到 63101 profile；
- Ego 93 仍为 `agentDelegatedToUser`，Chromium clipboard permission prompt
  尚未由用户处理；没有继续操作用户控制的页面，Changes typeahead 的
  UI 运行态待权限恢复后补验。

**未采用方案**：

- 不复用 Project 的 typeahead refs：两个树的 ESC/计时状态会互相污染；
  只复用纯 `typeaheadStep` / `typeaheadMatch`；
- 不遍历完整 `git.changes`：应匹配用户此刻能看到的行，折叠和过滤后的
  不可见项不能被 typeahead 跳进去。

## 2026-11-15 — Diff Select Position in Opposite Pane

**作用域**：Commit/比较 diff 的双栏键盘与工具栏交互。

**IDEA 证据**：

- `intellij.platform.ide.impl.jar!/META-INF/ActionsBundle.properties`：
  - `action.Diff.FocusOppositePane.text=Select Opposite Diff Pane`
  - `action.Diff.FocusOppositePaneAndScroll.text=Select Position in Opposite Diff Pane`
- `intellij.platform.diff.impl.jar` 的
  `TwosideTextDiffViewer$MyFocusOppositePaneAction`：
  `myScrollToPosition=true` 时先 `transferPosition`，
  目标侧 `CaretModel.moveToOffset`，再 `scrollToCaret` 并切焦点。

**实现**：

- 新增纯函数 `transferDiffLine(line, side, changes)`：
  - 未修改区域保持行号；
  - 修改块内按目标块范围映射；
  - 后续行累计插入/删除 delta；
  - 支持 Monaco 用 `start > end` 表示的零长度插入/删除块；
- `DiffPreview` 记录最近真正聚焦的 diff 侧，工具栏按钮点击后仍知道
  应从哪一侧转移，不会把 toolbar button 的 DOM focus 当成编辑器侧；
- 新增 `selectPositionInOppositeDiffPane`：映射行号、按目标行长度收敛列、
  `setPosition`、滚到可见并聚焦；原有 Focus Opposite Pane 保持只切焦点；
- 运行态发现 `»` ContextMenu 关闭时会抢回工具栏按钮焦点，两个 focus diff
  动作现在显式 `restoreFocus:false`，菜单执行后由 Monaco 持有焦点。

**回归**：

```bash
node --test tests/round345.test.mjs tests/round294.test.mjs \
  tests/static-order.test.mjs tests/syntax.test.mjs
npm test
```

- RED：`tests/round345.test.mjs` 初始缺少 `transferDiffLine`；
- 目标与相关回归 **16 pass / 0 fail**；
- 全量 **1183 pass / 0 fail**。

**运行态**：

- 原 Ego 空间 92 关闭后，新建 Ego 93 并同步 63101 profile；
- modified 第 3 行执行 `» → 在对侧选择相同位置` 后，original 成为 active
  editor，caret 落到对应行；再次执行回到 modified，形成双向验证；
- 菜单关闭后焦点仍留在 Monaco textarea，未被工具栏按钮抢回。

**未采用方案**：

- 不把“对侧相同屏幕行”当作同一位置；插入/删除后会产生错误行；
- 不只调用 `focus()`；那只是现有的 Focus Opposite Pane，不满足 IDEA
  Select Position 的 caret transfer 语义。

## 2026-11-15 — Terminal macOS 直接快捷键 ⌘T / ⌘C / ⌘V

**作用域**：Terminal 键盘路由、xterm focused pane、剪贴板动作。

**实现**：

- 新增纯函数 `directTerminalShortcut(event, hasSelection)`：
  - `⌘T` → `newTab`；
  - 有选区时 `⌘C` → `copy`；
  - `⌘V` → `paste`；
  - 仅接受 Meta 且无 Ctrl/Alt/Shift，避免把 `Ctrl+C` 从 SIGINT 改成复制；
- 直接快捷键只作用于 `data-dsh-terminal-pane` 内的 focused xterm；
  查找框等 dock 表单保留原生剪贴板行为；
- New 菜单同步显示 IDEA 的 `⌘T`；
- 原有 `⌘⇧C` / `⌘⇧V` 路径保留。

**IDEA 证据**：

- `terminal.jar!/META-INF/plugin.xml`：
  - `Terminal.NewTab` 在 macOS keymap 为 `meta T`；
  - `Terminal.CopySelectedText` 使用 macOS Copy 快捷键；
  - `Terminal.Paste` 使用终端 Paste 动作；
- `TerminalBundle.properties` 的 New Tab / Copy / Paste 文案与动作 ID 对应。

**回归**：

```bash
node --test tests/round344.test.mjs tests/round300.test.mjs \
  tests/static-order.test.mjs tests/syntax.test.mjs
npm test
```

- RED：`tests/round344.test.mjs` 初始因缺少
  `directTerminalShortcut` 失败；
- 目标与相关回归 **14 pass / 0 fail**；
- 全量 **1178 pass / 0 fail**。

**运行态**：

- Ego Browser 63101 聚焦 Terminal 后按 `⌘T`；
  terminal overflow 计数从“还有 2 个终端标签”变为 3，
  证明新建 PTY tab 生效；
- Ego 93 中 `⌘A` 后 `⌘C`，Terminal 状态显示“已复制到剪贴板”，
  焦点仍留在 xterm；
- `page.keyboard.paste(...)` 触发 `⌘V` 时再次出现 Chromium clipboard
  permission prompt，`⌘V` 的完整粘贴/执行链仍需用户允许权限后补验。

**未采用方案**：

- 不用缓冲区文本猜测 IDEA command block 边界；
  IDEA 的 `SelectLastBlock` / `CopyBlock` 依赖
  `TerminalSelectionModel + CommandBlock` 的结构化 model，
  当前 xterm 只有 terminal buffer，近似实现会选错命令或输出。

## 2026-11-15 — Terminal Interrupt Command 与 Clear Command Prompt

**作用域**：Terminal 屏幕右键、命令运行控制、dock split 的 focused-pane routing。

**实现**：

- 新增 IDEA 对应动作：
  - `Interrupt Command` → 当前 xterm pane `input('\u0003', true)`；
  - `Clear Command Prompt` → `input('\u0015', true)`，只清 shell 行编辑器，
    不清屏、不清 scrollback；
- 两项都通过 `terminalMenuModel` 的 focused pane emulator 执行，
  shell exited 或 active 缺失时禁用；
- 文案键为 `terminalInterruptCommand`、`terminalClearPrompt`，中英文双语。

**IDEA 证据**：

- `/Applications/Intellij.app/Contents/plugins/terminal/lib/terminal.jar`
  的 `messages/TerminalBundle.properties`：
  - `action.Terminal.InterruptCommand.text=Interrupt Command`
  - `action.Terminal.ClearPrompt.text=Clear Command Prompt`
- 对应类为 `TerminalInterruptCommandAction` / `TerminalClearPrompt`；
  IDEA 的 clear prompt 语义是清空当前命令行，而不是清屏。

**回归**：

```bash
node --test tests/round343.test.mjs tests/round300.test.mjs \
  tests/round291.test.mjs tests/static-order.test.mjs \
  tests/syntax.test.mjs
npm test
```

- 目标与相关回归 **16 pass / 0 fail**；
- 全量 **1174 pass / 0 fail**。

**运行态**：

- Ego Browser 63101 左侧 pane 运行 `sleep 30` 后执行 `Interrupt Command`：
  输出 `^C` 并返回 prompt，随后 `printf INTERRUPT_OK` 成功；
- split 后右 pane 输入未提交内容，执行 `Clear Command Prompt`，
  再执行 `printf RIGHT343_OK` 得到正确输出；pane 数保持 2，
  证明动作只作用于 focused right pane 且不会触发 split guard。

**环境限制**：

- 本轮 CUA `getState()` 两次超时，`orca` CLI 不在 PATH；
  IDEA 菜单外观未做桌面截图对照，动作语义与名称以本地
  `TerminalBundle.properties` 和 JAR class 证据为准。

## 2026-11-15 — Terminal Split Tab Context Menu 焦点路由

**作用域**：Terminal dock 分屏、tab 右键、active/focused identity。

**根因**：

- terminal tab 的 `onContextMenu` 无条件执行 `setActiveId(terminal.id)`；
- 若右键的是右侧 split pane 自己的 tab，`activeId` 与 `splitId` 会变成
  同一个 PTY；
- split guard 随后主动清空 splitId，表现为“只是打开右侧 tab 菜单，
  分屏就被收掉”；同时菜单还会错误提供 Split Right。

**实现**：

- 新增纯函数 `terminalTabContextFocus(terminalId, _activeId, splitId)`：
  - tab 是 splitId → `{ pane: 'right', activate: false }`；
  - 其余 tab → `{ pane: 'left', activate: true }`；
- tab context menu 先计算 focus：
  - 只有 activate=true 才更新 activeId；
  - 总是把 focusedPane 指向 tab 所属 pane；
- `splitRight` 在 `terminal.id === activeId || terminal.id === splitId`
  时返回 null，右侧已有 tab 不再显示重复动作；
- 不修改 terminal order、PTY id 或 stream。

**IDEA 证据**：

- `/Applications/Intellij.app/Contents/plugins/terminal/lib/terminal.jar`
  的 `TerminalBundle.properties` 包含
  `action.Terminal.MoveToolWindowTabLeft/Right`、`RenameSession`、
  `MoveToEditor`、`InterruptCommand`、`ClearPrompt` 等动作；
- 本轮只修复现有菜单作用于错误 pane 的缺陷，不重复添加已有动作。

**回归**：

```bash
node --test tests/round342.test.mjs tests/round212.test.mjs \
  tests/round302.test.mjs tests/round288.test.mjs \
  tests/static-order.test.mjs tests/syntax.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
git diff --check
```

- RED：`tests/round342.test.mjs` 初始 **1 fail**；
- 目标与相关回归 **21 pass / 0 fail**；
- 全量 **1170 pass / 0 fail**。

**运行态**：

- Ego Browser 63101 创建 2 个 shell 并 split；
- 收起 Project 后 tab strip 可同时显示 2 个 tab；
- 对右侧 split tab 派发 contextmenu：
  - pane 数保持 2，没有因菜单打开而自动 unsplit；
  - 菜单中没有“向右拆分”；
  - 可见动作包括 Rename、Color、Duplicate、Move Left/Right、Copy Path、
    README、Reveal、Reopen、Move to Editor、Switch Focus、Close、
    Close Others。

## 2026-11-15 — Tab 菜单 Move Left / Move Right

**作用域**：左侧 file tab、右侧 split tab 的右键菜单重排。

**实现**：

- 新增 `moveEditorTabByOffset(group, path, direction)`：
  - 分别读取 `openFilesRef` / `splitTabsRef`；
  - 目标为相邻 tab；
  - 复用 `moveEditorTab(group, path, target, direction > 0)`；
- 左侧文件 tab 菜单使用 `openFiles` 中的真实 index：
  - 首项 Move Left disabled；
  - 末项 Move Right disabled；
- 右侧 split tab 菜单使用 `splitTabIndex`：
  - 同样按首尾禁用；
- 文案复用已有双语 `terminalMoveLeft / terminalMoveRight`，避免新增同义 key；
- 排序仍自动进入 workspace tab session。

**回归**：

```bash
node --test tests/round341.test.mjs tests/round340.test.mjs \
  tests/round339.test.mjs tests/static-order.test.mjs \
  tests/syntax.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
git diff --check
```

- RED：`tests/round341.test.mjs` 初始 **4 fail**；
- 目标与相关回归 **20 pass / 0 fail**；
- 全量 **1166 pass / 0 fail**。

**运行态**：

- 左侧 `marker / sort-a / README`，active sort-a：
  - 打开 sort-a tab 菜单并执行 Move Left；
  - open list 变为 `sort-a / marker / README`；
  - active 仍 sort-a，editor 数不变；
  - 此时 sort-a 为第一项，Move Left 实际 `disabled=true`、opacity 0.4；
- 右侧 `README / sort-a / marker`，active README：
  - 执行 Move Right；
  - session 顺序变为 `sort-a / README / marker`；
  - active 仍 README，editor 数不变。

## 2026-11-15 — 编辑器 Tab 拖拽重排

**作用域**：左侧 file tab strip、右侧 split tab strip。

**实现**：

- 新增纯函数 `reorderTabPaths(items, source, target, after, idOf)`：
  - 移除 source 后重新定位 target；
  - 按 pointer 位于目标左/右半边决定 before/after；
  - invalid / no-op drop 返回原数组引用，避免整条 strip 重渲染；
- EditorWorkspace 新增：
  - `editorTabDrag` / `editorTabDragRef`；
  - `editorTabDrop`；
  - `beginEditorTabDrag` / `dragOverEditorTab` / `dropEditorTab`；
  - `moveEditorTab(group, source, target, after)`；
- 左右 group 独立重排：
  - left 更新 `openFiles`/`openFilesRef`；
  - right 更新 `splitTabs`/`splitTabsRef`；
  - active path 不变；
  - 不创建、不 dispose Monaco model/editor；
- 目标 tab 根据 pointer half 显示左/右 2px accent 插入线；
- 来源 tab 拖动时 opacity 0.55；
- openFiles/splitTabs 顺序变化自动进入 round339 session 持久化。

**回归**：

```bash
node --test tests/round340.test.mjs tests/round339.test.mjs \
  tests/round338.test.mjs tests/static-order.test.mjs \
  tests/syntax.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
git diff --check
```

- RED：`tests/round340.test.mjs` 初始 **1 fail**；
- 目标与相关回归 **20 pass / 0 fail**；
- 全量 **1162 pass / 0 fail**。

**运行态**：

- Ego Browser 63101 左侧 `sort-a / marker / README`：
  - 将 marker 拖到 sort-a 左侧；
  - open list 变为 `marker / sort-a / README`；
  - active 仍 sort-a，editor 数仍为 2；
- 右侧 `sort-a / marker / README`，active README：
  - 临时收起 Project、扩大右侧 pane 后，将 README 拖到 sort-a 左侧；
  - split 顺序变为 `README / sort-a / marker`；
  - active 仍 README，editor 数不变；
  - session 立即记录同样 split order；
  - reload 后左 open 顺序保持 marker/sort-a/README，右侧隐藏菜单顺序为
    sort-a/marker，证明 README 已是 split 第一项。

## 2026-11-15 — 编辑器 Tab Session 持久化

**作用域**：左侧 clean tabs、active path、右侧 split tabs、active split、splitPercent。

**实现**：

- 新增 `normalizeEditorSession`：
  - 只接受非空、非绝对、无 `.`/`..` segment 的相对 path；
  - open paths 去重且上限 50；
  - active 必须属于 open，否则回落首个；
  - split paths 必须是 opened subset；
  - splitPercent clamp 20–80；
- `readEditorSession(root)` / `writeEditorSession(root, value)` 使用
  `dsh-editor.editor.session:<root>`；
- EditorWorkspace 新增：
  - `sessionRestoredFor`；
  - `sessionRestoringRef`；
  - `sessionRestoreGeneration`，防止 workspace 切换中的旧异步恢复写回；
- root 已知后通过正常 `openFile(path)` 逐个重开 requested paths：
  - 读取失败的文件跳过；
  - openFiles 重新按 stored 顺序排列；
  - active/split active 只引用成功恢复的 path；
  - stored splitPercent 存在时恢复；
- persistence effect 250ms debounce，并且：
  - 根目录未知时不写；
  - initial restore 未完成时不写；
  - `openFiles.filter(file => file.dirty !== true)`；
  - splitTabs 仅保留 clean opened paths；

**回归**：

```bash
node --test tests/round339.test.mjs tests/round333.test.mjs \
  tests/round337.test.mjs tests/static-order.test.mjs \
  tests/syntax.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
git diff --check
```

- RED：`tests/round339.test.mjs` 初始 **1 fail**；
- 目标与相关回归 **22 pass / 0 fail**；
- 全量 **1158 pass / 0 fail**。

**运行态**：

- Ego Browser 63101 保存：
  `note / sort-a / marker / README`，active note，split active README，
  splitPercent 49；
- reload 后自动恢复同一 open 顺序、active、split active 和 2 个 editor；
- 在内存中把 note 改 dirty 后等待 debounce，localStorage 自动移除 note，
  active 回落到 sort-a；
- 再次 reload 后只打开 `sort-a / marker / README`，active sort-a，
  split active README，且没有伪造 dirty 标记。

## 2026-11-15 — 右侧 Split Tab Strip 溢出

**作用域**：窄 split editor group 的 tab strip、active tab 可见性、隐藏 tab 激活。

**根因**：

- 右侧 pane 只有约 120px，header 还要放 split 图标和整体关闭按钮；
- 原 tab 使用 `flex: none; maxWidth: 180`，所以一个 tab 的实际宽度就可能
  超过 strip，后续 tab 和 `»` 都被 `overflow: hidden` 裁掉；
- 用户无法发现右侧还有已打开文件。

**实现**：

- 新增 `splitTabStripWidth` / `splitTabStripRef`；
- ResizeObserver 实测 strip，而不是 pane 或 tab；
- 复用已有 `visibleTabCount` 和 `overflowTabs`：
  - active split path 永远留在 visible；
  - hidden 为其余 path；
- strip 使用 `position: relative` 和 28px 右侧 reserve；
- 有 hidden 时 visible tab 设 `maxWidth: 100%`，在剩余空间内收缩；
- `»` 绝对定位到 strip 右缘，菜单列出 hidden path；
- 点击 hidden path 只更新 `splitPathRef` / `splitPath`，不创建 editor/model；
- 整体 `关闭拆分` 按钮仍在 strip 外部，避免误关。

**回归**：

```bash
node --test tests/round338.test.mjs tests/round334.test.mjs \
  tests/round333.test.mjs tests/static-order.test.mjs \
  tests/syntax.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
git diff --check
```

- RED：`tests/round338.test.mjs` 初始 **4 fail**；
- 目标与相关回归 **21 pass / 0 fail**；
- 全量 **1154 pass / 0 fail**。

**运行态**：

- Ego Browser 63101 右侧 4 个文件、split pane 约 122px：
  - strip 74.5px，active README tab 收缩到 60.5px；
  - `»` 24×28px 固定在右缘；
  - hidden count = 3，菜单为
    `docs/note.txt / docs/sort-a.txt / src/marker.ts`；
  - 选择 note 后 active 切到 note，hidden 仍为 3；
  - DOM 中始终只有 1 个 split Monaco editor，证明切换未重建 editor；
  - 截图确认 `»` 不再被 pane 裁掉。

## 2026-11-15 — Commit Diff 每目标 View State

**作用域**：Commit diff target 往返、关闭重开、Swap Sides、双栏/单栏切换。

**根因**：

- DiffPreview 复用同一个 Monaco diff editor，但每次 target 载入都会
  `revealFirstDiff()` 并重新聚焦首 hunk；
- 仅依赖 Monaco 的 opaque view state 不足以稳定恢复 cursor；
- Swap effect 原先把 `target` 放进依赖，target 变化时会误把旧文件
  view state 写进新 target 的 key，运行时表现为“打开 README line 5，
  查看 sort-a 后返回 README 却停在 sort-a 的 line 2”。

**实现**：

- 新增 `diffViewStateKey(target, swapped)`：
  - 区分 working / staged / commit / revision / clipboard / combined；
  - 区分 original / swapped orientation；
  - path 和 combined entries 都进入稳定 key；
- EditorWorkspace 持有 `diffViewStatesRef`，生命周期跨 diff tab；
- DiffPreview 同时保存：
  - original/modified Monaco `saveViewState()`；
  - 两个 editor 的 caret position；
  - scrollTop；
- restore 时 clamp 到当前 model 行数，再恢复 view state、position 和 scroll；
- target 载入前 capture 旧 key，载入完成后优先 restore；没有历史才
  `focusFirstHunk`；
- unmount cleanup 在 `diff.setModel(null)` 前 capture 最终状态；
- Swap 使用 `diffTargetRef` 生成下一个 key，并把 swap effect 从 `target`
  依赖中解耦；双栏/单栏切换也 capture/restore 同一 key。

**回归**：

```bash
node --test tests/round337.test.mjs tests/round335.test.mjs \
  tests/round307.test.mjs tests/round285.test.mjs \
  tests/round162.test.mjs tests/round172.test.mjs \
  tests/plugin-contract.test.mjs tests/static-order.test.mjs \
  tests/syntax.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
git diff --check
```

- RED：`tests/round337.test.mjs` 初始 **1 fail**；
- 目标与相关回归 **39 pass / 0 fail**；
- 全量 **1150 pass / 0 fail**。

**运行态**：

- Ego Browser 63101：
  - README staged diff 修改侧 caret 设到第 5 行；
  - 切到 sort-a diff 并设到第 2 行；
  - 返回 README 后仍为第 5 行；
  - Swap Sides 后修订侧按自身行数落到第 2 行，Swap 回来恢复第 5 行；
  - unified/side-by-side 往返都保持第 5 行；
  - 关闭 README diff 后重开仍恢复第 5 行。
- 首次运行态复测确实发现 README 返回后错误停在 sort-a 的第 2 行；
  通过解耦 Swap effect 的 target 依赖修正后重测通过。

## 2026-11-15 — Project 多选 Open in Right Split

**作用域**：Project 右键菜单、多选文件、右侧 editor group 批量打开。

**IDEA 证据**：

- `intellij.platform.ide.impl.jar` 的动作表：
  `OpenInRightSplit` → `com.intellij.ide.actions.OpenInRightSplitAction`；
- 本项目已有持久选区、可见行顺序和右侧 tab 历史，批量动作只复用这些 SSOT，
  不另建文件打开队列。

**实现**：

- 新增纯函数 `projectRightSplitPaths(rows, selection, clickedPath)`：
  - 选区外右键只作用于 clicked row；
  - 只保留 file，忽略 root/directory/placeholder；
  - 按 `rows` 当前可见顺序输出；
  - 按 path 去重；
- `buildTreeMenu` 的 `openRightSplit`：
  - `disabled` 取决于是否至少有一个 file candidate；
  - 批量菜单仍使用现有 `selectionCount` 标题；
  - 调用 `openInRightSplit(splitCandidates)`；
- `openInRightSplit` 接收 string 或有序 string[]：
  - 顺序读取并加入共享 `openFiles`；
  - 每个 path 只在 `splitTabsRef` 中出现一次；
  - 最后激活原可见顺序中的最后成功文件；
  - 完成后恢复调用前的左侧 `activePath`；
  - 失败文件跳过，不影响其余已成功文件。

**回归**：

```bash
node --test tests/round336.test.mjs tests/round330.test.mjs \
  tests/round333.test.mjs tests/round328.test.mjs \
  tests/round326.test.mjs tests/static-order.test.mjs \
  tests/syntax.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
git diff --check
```

- RED：`tests/round336.test.mjs` 初始 **4 fail**；
- 目标与相关回归 **25 pass / 0 fail**；
- 全量 **1145 pass / 0 fail**。

**运行态**：

- Ego Browser 63101：
  - 左侧先打开 `docs/note.txt`；
  - Project 多选 `docs` / `note.txt` / `sort-a.txt` / `src/marker.ts` /
    `README.md`，菜单标题为“已选 5 项”；
  - Open in Right Split 后右侧顺序严格为
    `note.txt → sort-a.txt → marker.ts → README.md`，目录被忽略；
  - 左侧 active 仍为 `note.txt`，DOM 始终为 2 个 Monaco editor；
  - 再执行同一批操作后右侧仍只有这 4 项，无重复；
  - 截图确认四文件已加入左侧共享 open list，右侧窄 tab strip
    只展示当前可见项。
- CUA `getState()` 60s/90s 各超时一次，已按最多重试 2 次停止。

## 2026-11-15 — Commit Diff Swap Sides 与作用域误替换

**作用域**：Commit diff 工具栏、model 方向切换、只读还原保护。

**IDEA 证据**：

- 本机 `/Applications/Intellij.app/Contents/lib/intellij.platform.ide.impl.jar`
  的动作表包含：
  `SwapSidesInDiffWindow` → `SwapDiffSidesAction`，
  `add-to-group group-id="Diff.ViewerToolbar"`；
- 英文资源为 `action.SwapSidesInDiffWindow.text=Swap Sides`。

**实现**：

- `DiffPreview` 新增 `swapSides` / `swapSidesRef` 与
  `diffModelsRef`；
- Git diff 只请求一次并创建 `original` / `modified` 两个 model；
- `applyDiffSideOrder(swapped)` 仅 `diff.setModel(...)` 交换绑定顺序，
  不创建请求、model 或 editor；
- 左右列标题使用 `displayedSideLabels` 同步交换；
- swapped 时 `canRestore = false`，Monaco `readOnly`、revert gutter、
  selection restore、undo/redo 全部关闭；
- 换回原方向后恢复可写、revert gutter 与原有 undo/redo 历史；
- target 改变时自动重置为原方向。

**确认到的缺陷**：

- 为 `closeFile` 补 `closeSplitTab` 依赖时，泛化的
  `}, [t]);` patch 误命中了 `DiffPreview` 内两个无关 callback，
  运行时点击 Show Diff 抛：
  `Uncaught ReferenceError: closeSplitTab is not defined`；
- 根因是闭包处于组件局部作用域，`closeSplitTab` 只存在于
  `EditorWorkspace`；
- 已恢复这两个依赖为 `[t]`，并新增
  “DiffPreview never captures closeSplitTab” 源码回归。

**回归**：

```bash
node --test tests/round335.test.mjs tests/round202.test.mjs \
  tests/round208.test.mjs tests/round162.test.mjs \
  tests/round156.test.mjs tests/static-order.test.mjs \
  tests/syntax.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
git diff --check
```

- RED：`tests/round335.test.mjs` 初始 **4 fail**；
- 目标与相关回归 **41 pass / 0 fail**；
- 全量 **1141 pass / 0 fail**。

**运行态**：

- Ego Browser 63101 staged `README.md` diff：
  - 初始标题 `HEAD / 索引`；
  - Swap 后 `索引 / HEAD`，DOM 仍为 2 个 diff editor；
  - overflow 菜单中出现 `交换对比方向✓`，undo/redo 消失；
  - 再 Swap 回 `HEAD / 索引`，undo/redo 恢复。
- unstaged `docs/sort-a.txt` diff：
  - 初始 `HEAD / 当前版本`；
  - Swap 后 `当前版本 / HEAD`，editor 数不变，undo 仍隐藏。

## 2026-11-15 — 右侧 Tab 组菜单、区间关闭与键盘切换

**作用域**：split editor group 的 tab context menu、中键关闭、`Alt+Left/Right`。

**实现**：

- `closeSplitTabs(paths)` 对一批右侧 tab 只确认一次 dirty，不 dispose
  `openFiles` 中的共享 model；
- 右侧 tab 右键提供 `Close / Close Others / Close Left / Close Right /
  Close All / Save / Copy Relative Path / Reveal in Project`；
- 菜单里的区间关闭只调用 `closeSplitTabs`，不会误用左 editor 的
  `closePaths`；
- 中键复用单项 `closeSplitTab`；
- `cycleSplitTab(step)` 只在 `splitTabsRef` 内循环，首尾回绕；
- window capture 的 `splitTabShortcut` 仅当事件 target 位于
  `splitContainerRef` 内时接管 `Alt+Left/Right`，避免抢 Project 树或左侧
  editor 的键盘。

**回归**：

```bash
node --test tests/round334.test.mjs tests/round333.test.mjs \
  tests/round332.test.mjs tests/round331.test.mjs \
  tests/round330.test.mjs tests/static-order.test.mjs \
  tests/syntax.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
git diff --check
```

- RED：`tests/round334.test.mjs` 初始 **4 fail**；
- 目标与相关回归 **30 pass / 0 fail**；
- 全量 **1136 pass / 0 fail**。

**运行态**：

- Ego Browser 63101 右侧历史为
  `src/marker.ts → docs/note.txt → docs/sort-a.txt`；
- 右侧持焦连续按 `Alt+ArrowLeft` 从 sort-a 到 note、再到 marker，再回绕
  sort-a，DOM 一直是 2 个 Monaco editor；
- 右键 `关闭左侧标签页` 后右侧只剩 note/sort-a，左侧 `data-dsh-open-list`
  仍是四个文件；
- 右键 `关闭其他标签页` 后右侧只剩 sort-a，`openFiles` 仍为
  `README.md|src/marker.ts|docs/note.txt|docs/sort-a.txt`；
- 中键关闭最后一个右侧 tab 后 editor 降为 1，README 仍为左侧 active；
- CUA `getState()` 30s/60s 各超时一次，已达本轮重试上限；IDEA 对照继续
  使用本机动作表/bytecode 证据。

## 2026-11-15 — 右侧 Editor Group 独立 Tab 历史

**作用域**：split editor group 的多 tab 切换、关闭回退、共享 model 生命周期、文件 rename/close 同步。

**根因**：

- 第 330–332 轮的右侧 group 只保存一个 `splitPath`，每次 Project
  `Open in Right Split` 都替换当前文件，无法表达 IDEA 每个 editor group
  各自维护 tab 顺序的模型；
- 右侧 tab 切换若沿用“`splitPath` 变化就创建 group”的 effect，会销毁并
  重建 Monaco editor，导致 caret、view state、action 生命周期和 focus
  无谓重置；
- 文件关闭/重命名只处理左侧 `openFiles` 和单一 `splitPath`，会产生
  指向已删除路径或旧路径的 split tab。

**实现**：

- 新增 `splitTabs` / `splitTabsRef`；`splitPath` 只表示右侧 active tab；
- `openInRightSplit(path)`：
  - 文件先加入共享 `openFiles`；
  - 右侧历史去重追加，并同步 ref；
  - 激活新 tab，但恢复调用前的左侧 `activePath`；
- 右侧 pane 渲染真实 tab strip：
  - basename、完整路径 title、dirty `●`、单项 `×`；
  - 点击只切换右侧 active；
  - 整体 `关闭拆分` 保留；
- `closeSplitTab(path)`：
  - 从右侧历史移除，不 dispose 共享 model/openFiles；
  - active 被关闭时选择原 index 的相邻 tab；
  - 最后一个 tab 关闭时隐藏 split 并把 focused identity 还给左侧；
- split editor creation effect 与 active tab binding 分离：
  - group 仅在右侧从空变非空时创建；
  - active tab 变化只执行 `editor.setModel(model)`；
  - content/focus listener 动态读取 `splitPathRef`；
- `closeFile` / `closePaths` / rename move / openFiles lifecycle 同步维护
  `splitTabs`、`splitPath` 和 ref。

**回归**：

```bash
node --test tests/round333.test.mjs tests/round332.test.mjs \
  tests/round331.test.mjs tests/round330.test.mjs \
  tests/static-order.test.mjs tests/syntax.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
git diff --check
```

- RED：`tests/round333.test.mjs` 初始 **5 fail**；
- 目标与相关回归 **26 pass / 0 fail**；
- 全量 **1132 pass / 0 fail**。

**运行态**：

- Ego Browser 63101：
  - 左侧 README；Project 右键依次把 `src/marker.ts`、`docs/note.txt`
    打开到右侧，右侧历史为两项；
  - 点击 marker 后右侧 model 文本为 `export const marker = 219;`，
    DOM 中始终是 **2 个 Monaco editor**（左 + 右）；
  - 点 note、再关闭 note 后 active 落到 marker，editor 仍为 2；
  - 整体关闭 split 后 editor 降为 1，左侧 README 保持 active 并获得焦点；
  - 重新打开 marker 后右侧仅一项，证明历史按 path 去重。
- CUA `getState()` 本轮连续两次 30s/60s 超时，按其“单轮最多重试 2 次”
  约束停止；IDEA 对照继续复用本机 2026.2.3 动作/UI 证据，不把超时当验证结果。

## 2026-11-15 — Editor Split 比例与 Focus 提示

**作用域**：左右 editor group 的垂直分隔条、比例持久化、focused group 视觉。

**实现**：

- 新增 `editorSplitPercent` 与 `editorSplitDragging`；
- 左右 pane 间加入 `role=separator` 的 5px 垂直分隔条；
- mousedown/mousemove 只更新 flex 比例，不重建 editor/model；
- 比例默认 50%，无尺寸信息时限制 20%–80%；
- 有实际 row width 时额外保证两侧各至少 96px，并计入分隔条 7px；
- pointer up 写入 `dsh-editor.editor.splitPercent`；
- left flex 使用
  `clamp(96px, percent%, calc(100% - 103px))`，窗口缩小时仍不会压扁一侧；
- focused group 顶部显示 2px accent 线，另一侧透明；
- FOUC/syntax 风险：分隔条与 split pane 初版出现多一个 ternary 冒号，
  `node --check` 在 render 处捕获；改为显式 `React.createElement(...)` 后恢复。

**回归**：

```bash
node --test tests/round332.test.mjs tests/round331.test.mjs \
  tests/round330.test.mjs tests/static-order.test.mjs \
  tests/syntax.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
git diff --check
```

- RED：`tests/round332.test.mjs` 初始 **4 fail**；
- 纯函数验证 20/50/80 与 250px 宽度下 41–59 的像素安全范围；
- 目标与相关回归 **21 pass / 0 fail**；
- 全量 **1127 pass / 0 fail**。

**运行态**：

- Ego Browser 63101，Editor row 254px；
- 默认 50%：left/divider/right = `127 / 7 / 120px`；
- 拖到右限后 clamp 为 59%，宽度 `151 / 7 / 96px`；
- 向左拖后比例 49%，宽度 `124 / 7 / 123px`，localStorage = `49`；
- Reload 并重新打开 split 后仍为 49%，宽度 `124 / 7 / 122px`；
- 右 focus 时 split top border 为 `rgb(65, 118, 230)`、left 透明；
  左 focus 后两者反转。

## 2026-11-15 — Split Focus 与命令路由

**作用域**：左右 editor group focus、Find/Replace、Go to Line、Copy Path:Line。

**根因**：

- 第二轮 group 虽然已有独立 editor，但全局命令仍固定读取
  `editorRef + activePathRef`；
- 右侧 focus 时执行 `⌘F / ⌘L / Copy Path:Line` 会错误地访问左侧文档。

**实现**：

- 新增 `focusedEditorRef` / `focusedPathRef`，左右 focus handler 写同一记录；
- 新增 `currentCodeEditor()` / `currentCodePath()`；
  focused editor 无有效 model 时回退主 editor；
- Find / Replace 的 model、jump/replace 的 editor、Go to Line 的 path、
  Copy Path:Line 的 path/caret 全部改走 focused identity；
- split 关闭、Close Tab、Close Paths 时把 focused identity 恢复左侧；
- 状态栏继续显示最近聚焦 group 的 caret、行数、dirty。

**回归**：

```bash
node --test tests/round331.test.mjs tests/round330.test.mjs \
  tests/round326.test.mjs tests/round31.test.mjs \
  tests/static-order.test.mjs tests/syntax.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
git diff --check
```

- RED：`tests/round331.test.mjs` 初始 **4 fail**；
- 目标与相关回归 **21 pass / 0 fail**；
- 全量 **1123 pass / 0 fail**。

**运行态**：

- Ego Browser 63101，左 README / 右 sort-a；
- 右侧输入 `UNIQUE_RIGHT` 后 `⌘F` 得到 `1/1`，证明搜索读取右侧 model；
- 右侧 `⌘L → 1` 后状态栏为第 1 行/3 行；
- Copy Path:Line 剪贴板为 `docs/sort-a.txt:1:1`；
- 关闭 split 后查询 README 的 `fixture readme` 仍得到 `1/1`，
  说明命令已回到左侧 focused editor。

## 2026-11-15 — Project Open in Right Split

**作用域**：Project 文件右键、第二 Monaco editor group、共享 model。

**IDEA 证据**：

- `ActionsBundle` 文案：
  `Open in Right Split` / `在右侧拆分部分打开`；
- 动作语义是把编辑器区拆成两个 tab group，并在右侧打开当前文件。

**实现**：

- EditorWorkspace 新增第二个真实 Monaco group：
  - `splitPath` / `splitPathRef`；
  - `splitEditorRef` / `splitContainerRef`；
  - 复用 `createCodeEditorGroup` 与 `ensureEditorModel`；
- 两侧共享 `modelsRef` 中的同一 workspace model；
- Project 文件右键增加 `openRightSplit`，文件和批量/目录状态正确禁用；
- 打开 split 时：
  - 文件加入共享 openFiles；
  - 左侧 activePath 恢复为目标打开前的值；
  - 右侧 focus，文件头显示路径、dirty 和关闭按钮；
- split 自己的 Save/Find/Save All/Go to Line/Close Tab 已注册；
- 状态栏按最近 focus 的 editor 更新 caret、缩进、EOL、行数和 dirty；
- 关闭 split 只销毁右侧 editor/action，保留共享 model 和文件 tab；
- Close Tab / Close Paths 同步清理 split，并先解绑 model；
- 文件移动/重命名会 remap splitPath。

**回归**：

```bash
node --test tests/round330.test.mjs tests/round329.test.mjs \
  tests/round328.test.mjs tests/round326.test.mjs \
  tests/round148.test.mjs tests/round145.test.mjs \
  tests/round44.test.mjs tests/static-order.test.mjs \
  tests/syntax.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
git diff --check
```

- RED：`tests/round330.test.mjs` 初始 **5 fail**；
- 目标与相关回归 **52 pass / 0 fail**；
- 全量 **1119 pass / 0 fail**。

**运行态**：

- Ego Browser 63101：
  - README.md 在左侧打开；
  - Project 右键 `docs/sort-a.txt` 出现 `在右侧拆分部分打开`；
  - 执行后出现 2 个 Monaco editor，左侧仍为 README，右侧为 sort-a；
  - 右侧输入后 dirty `●` 出现；
  - 右侧 `⌘S` 写盘为 `b\na`，左侧文本未变；
  - 状态栏随右 focus 显示 3 行，关闭 split 后回到 README 的 5 行；
  - 关闭 split 后 editor 数为 1，README/sort-a 两个文件 tab 均保留。
- 验证后 `docs/sort-a.txt` 已恢复为原始 `a`。

**仍待补齐**：

- Find / Replace / Go to Line 的 global handler 仍主要绑定左侧 activePath；
  下一轮需要用 focused editor identity 统一路由。
- 右侧暂无独立 tab strip；当前是 Project 动作打开的单文件第二 group。

## 2026-11-15 — 可复用 Editor Group 与共享 Model 边界

**作用域**：Monaco editor instance/action 生命周期、workspace model registry。

**目标**：

- 为未来真正的双 editor split 抽出可复用 group；
- 当前不增加第二个 pane 或 `Open in Right Split` 菜单；
- 先证明多个 editor 可共享一个 model，且销毁一个 group 不会销毁共享文档。

**实现**：

- 新增 `createCodeEditorGroup(monaco, container, handlers)`：
  - 集中 editor option；
  - 注册 Save / Find / Save All / Go to Line / Close Tab；
  - 返回 `{ editor, dispose }`；
  - dispose 幂等，只销毁自身 action/editor，不碰 model；
- 新增 `ensureEditorModel(monaco, models, path, content)`：
  - 按 workspace path 复用 model；
  - URI/language 规则与旧实现一致；
- EditorWorkspace 的当前单 editor 与 model binding 均改用上述 helper；
- `modelsRef` 仍是 model 唯一 owner，EditorWorkspace 卸载时才统一 dispose。

**回归**：

```bash
node --test tests/round329.test.mjs tests/round328.test.mjs \
  tests/round327.test.mjs tests/static-order.test.mjs \
  tests/syntax.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
git diff --check
```

- RED：`tests/round329.test.mjs` 初始 **4 fail**；
- fake Monaco 验证两个 group 共享 model、单侧 dispose 不销毁 model；
- 五个 action handler 均正确转发，group/action 幂等 dispose；
- 目标与相关回归 **20 pass / 0 fail**；
- 全量 **1114 pass / 0 fail**。

**运行态**：

- Ego Browser 63101，新建 `r329-save.txt`；
- 使用重构后的 group 打开文件；
- Monaco 输入后显示 `●`/`未保存`；
- `⌘S` 后磁盘内容变为 `two\none\n`，状态回到 `已保存`；
- 验证后文件已移出 fixture。

## 2026-11-15 — Open in Right Split 架构审计与 Select Opened 状态

**作用域**：Project `Select Opened File` 状态、Editor host split 可行性。

**IDEA 证据**：

- `SelectFileAction.update` 的 `SelectOpenedFileInProjectView` 分支以
  `PlatformDataKeys.LAST_ACTIVE_FILE_EDITOR` 是否为空决定 enabled；
- `OpenInRightSplit` 属于编辑器分组动作，不是 Project 树自身能力。

**当前 DSH 架构事实**：

- `EditorWorkspace` 只有一个 `editorRef`、一个 `containerRef`、
  一个 `modelsRef` 和一个活动文件 provider；
- 文件 tab、breadcrumb、find/replace、status bar、diff/annotate 都围绕单一
  `activePath` 与 `diffActive`；
- 宿主顶部 `分栏` 是 Editor/Chat 分栏，不是第二个代码编辑器组；
- 因此没有可复用的第二 group，不能安全地只加一个菜单项伪装
  `Open in Right Split`。

**本轮实现**：

- ProjectPanel 新增 `hasActiveFile`；
- `定位当前文件` 在 false 时 disabled；
- EditorWorkspace 以 `activePath !== null` 传入真实状态；
- 不新增 `OpenInRightSplit` 入口。

**回归**：

```bash
node --test tests/round328.test.mjs tests/round326.test.mjs \
  tests/round327.test.mjs tests/round177.test.mjs \
  tests/static-order.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
git diff --check
```

- RED：`tests/round328.test.mjs` 初始 **2 fail**；
- 目标与相关回归 **22 pass / 0 fail**；
- 全量 **1110 pass / 0 fail**。

**运行态**：

- Ego Browser 63101，Project 初始无打开文件：
  `定位当前文件` 实际 `disabled=true`；
- 双击 README.md 后 open-list 为 `README.md`，
  同一按钮变为 `disabled=false`。

## 2026-11-15 — Project Expand Selected 递归语义

**作用域**：Project 工具栏 `Expand Selected`、项目树递归加载、多选/root。

**IDEA 证据**：

- `PlatformActions.xml` 将 `ExpandRecursively` 绑定到
  `ExpandRecursivelyAction`；
- bytecode 调用
  `TreeUtil.promiseExpand(tree, Integer.MAX_VALUE, predicate)`；
- predicate 接受所有已选路径及其后代；
- `update` 仅要求树有选中项，不按文件/目录类型禁用。

**实现**：

- 新增可测试的 `expandDirectorySubtrees`：
  - BFS 加载全部后代；
  - 合并多起点、去重、跳过失败目录；
  - 默认 200 目录安全上限；
  - 保留现有 children 缓存，未缓存目录才读取；
- `Expand Selected` 处理整个 Project selection；
  - 目录加入根与祖先后递归；
  - root `''` 可递归展开整个项目；
  - 文件选择不产生 start，保持安全 no-op；
- `Expand All` 复用同一 traversal，不再维护第二套 while 循环；
- 工具栏动作在 `selection.size === 0` 时禁用，与 IDEA update 对齐。

**回归**：

```bash
node --test tests/round327.test.mjs tests/round326.test.mjs \
  tests/round177.test.mjs tests/round199.test.mjs \
  tests/static-order.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
git diff --check
```

- RED：`tests/round327.test.mjs` 初始 **5 fail**；
- 目标与相关回归 **24 pass / 0 fail**；
- 全量 **1107 pass / 0 fail**。

**运行态**：

- Ego Browser 63101 临时 fixture：
  `r327/nested/deep/file.txt`、`r327/top.txt`；
- 选择 `r327` 后执行 `展开所选`：
  `r327`、`r327/nested`、`r327/nested/deep` 全部 `aria-expanded=true`，
  `file.txt` 与 `top.txt` 实际出现；
- 全部收起后选择项目根并执行 `展开所选`，同一深层路径重新全部展开；
- 验证后 fixture 已移出工作区。

## 2026-11-15 — Project Toolbar Expand All 与 Copy Path/Reference

**作用域**：Project 工具栏、项目树右键菜单、Copy Path 动作层级。

**IDEA 证据**：

- `PlatformActions.xml` 的 `ProjectViewToolbar` 顺序为
  `SelectInProjectView / ExpandRecursively / ExpandAll / CollapseAll`；
- `CopyReferencePopupGroup` 文案为 `Copy Path/Reference…`；
- 子项包括 `Absolute Path / File Name / Path with Line Number /
  Path from Content Root / Path from Source Root`；
- `OpenInRightSplit` 需要两个编辑器组，当前 DSH Editor host 只有一个代码区，
  本轮不实现假入口。

**实现**：

- Project 工具栏在 `Expand Selected` 与 `Collapse All` 之间补 `Expand All`，
  复用现有 `onExpandAll`；窄窗下三个动作按原顺序进入 `»`；
- 右键菜单把 Copy Path 系列收进 `复制路径/引用…` 子菜单；
- 子菜单顺序：`绝对路径 / 文件名 / 带行号的路径 / 来自内容根的路径`；
- DSH 已有的 shell-ready 绝对路径保留为最后一项；
- 绝对路径批量复制继续保留 `已选 N 项` 语义；
- 文件名支持批量复制，其余路径语义与原有 helper 不变。

**回归**：

```bash
node --test tests/round326.test.mjs tests/round177.test.mjs \
  tests/round290.test.mjs tests/round99.test.mjs \
  tests/toolwindow-round11.test.mjs tests/static-order.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
git diff --check
```

- RED：`tests/round326.test.mjs` 初始 **3 fail**；
- 目标与相关回归 **23 pass / 0 fail**；
- 全量 **1102 pass / 0 fail**。

**运行态**：

- Ego Browser 63101，Project 工具栏 200px 宽时 `»` 菜单顺序为
  `展开所选 / 全部展开 / 全部收起`；
- README 文件右键出现 `复制路径/引用… ›` 子菜单；
- 子菜单实际显示：
  `绝对路径 / 文件名 / 带行号的路径 / 来自内容根的路径 /
  复制绝对路径（可直接粘进终端）`；
- 点击 `文件名` 后系统剪贴板为 `README.md`。

## 2026-11-15 — Apply Patch / Apply Patch from Clipboard

**作用域**：Commit Options、统一 diff 应用、Host Git API、浏览器 file chooser。

**IDEA 证据**：

- `VcsActions.xml` 将 `ChangesView.ApplyPatch` 绑定到
  `ApplyPatchAction`，将 `ChangesView.ApplyPatchFromClipboard` 绑定到
  `ApplyPatchFromClipboardAction`；
- `ApplyPatchAction` 先保存文档，再从 patch 文件或文件选择器进入应用对话框；
- `ApplyPatchFromClipboardAction` 只有 `PatchReader.isPatchContent` 通过才进入
  应用对话框；
- 文案为 `Apply Patch… / Apply Patch from Clipboard…`。

**实现**：

- 新增 host `gitApplyPatch` 和 route `applyPatch`；
- 输入限制 4 MiB、200 个 workspace 内文件，空 patch / NUL 快速失败；
- 补丁写到系统临时目录，先 `git apply --numstat -z` 确认只触及当前
  workspace，再 `git apply --check`，最后普通 `git apply`；
- 不启用 `--reject` / `--3way` / `--unsafe-paths`，失败保持 Git 原子性；
- 默认只修改工作区，不 stage；成功后刷新 Git、Project 树和所有已打开文件；
- Commit Options 提供 `应用补丁…` 与 `从剪贴板应用补丁…`；
- 两个入口复用 `applyPatchText`，文件入口通过浏览器 file chooser。

**边界修复**：

- `git diff` / clipboard 常丢失最后一个换行，Git 会报 `corrupt patch`；
  宿主在检查大小前统一补上末尾换行；
- 嵌套 workspace 中 workspace 外路径会被 `git apply --numstat` 过滤为空，
  明确返回“patch does not touch files in this workspace”，不会写到 workspace 外。

**回归**：

```bash
node --test tests/round325.test.mjs tests/round322.test.mjs \
  tests/round321.test.mjs tests/round114.test.mjs \
  tests/static-order.test.mjs tests/commit-round12.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
git diff --check
```

- RED：`tests/round325.test.mjs` 初始因缺少 `gitApplyPatch` 失败；
- 临时仓库覆盖普通修改、新文件、冲突、workspace 外路径、空/超限 patch；
- 全量 **1098 pass / 0 fail**。

**运行态**：

- host 路由变更后同步 `client.js` / `index.js` 到 editor-test profile，
  并以相同 `DSH_HOME`、profile、端口重启宿主；
- Ego Browser 63101，Commit Options 显示 `应用补丁…` 和
  `从剪贴板应用补丁…`；
- 通过 file chooser 应用新文件 patch；
- Git 显示 `?? applied-patch.txt`，内容为两行 patch 文本，
  `git diff --cached` 为空；
- Changes 显示 `已应用 1 个文件的补丁`；
- 验证后将生成文件移出 fixture。

## 2026-11-15 — Combined Diff Ctrl+Escape

**作用域**：Commit Combined Diff 当前文件折叠快捷键。

**IDEA 证据**：

- `META-INF/VcsActions.xml` 的
  `Vcs.CombinedDiff.ToggleCollapseBlock` 在 `$default` keymap 中绑定
  `control ESCAPE`；
- `ActionsBundle.properties` 文案为 `Collapse File / Expand File`。

**实现**：

- 新增 `isCombinedFileCollapseShortcut`，只接受差异面板内的
  literal Control+Escape，并排除 Meta/Alt/Shift 与普通 Escape；
- 键盘处理器复用 `toggleCombinedFileCollapse`，没有第二套 hidden-area 逻辑；
- 工具栏当前文件动作增加 `⌃Esc`；
- 单文件 diff、`Ctrl+Shift+Left/Right` 文件导航与 Reload 清理逻辑不变。

**回归**：

```bash
node --test tests/round324.test.mjs tests/round318.test.mjs \
  tests/round319.test.mjs tests/round317.test.mjs \
  tests/round195.test.mjs tests/round172.test.mjs \
  tests/round203.test.mjs tests/round205.test.mjs \
  tests/round292.test.mjs tests/static-order.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
git diff --check
```

- RED：`tests/round324.test.mjs` 初始 **3 fail**；
- 目标与相关回归 **31 pass / 0 fail**；
- 全量 **1092 pass / 0 fail**。

**运行态**：

- Ego Browser 63101，r219 fixture，两个文件的 combined diff；
- 单栏 modified 侧可见行从 10 降到 5，两个文件名头都保留；
- 再次按 `Ctrl+Escape` 恢复 10 行；
- 文件导航 `Ctrl+Shift+Right/Left` 在 `2/2` 与 `1/2` 间往返；
- 折叠所有文件后每侧只剩 3 行文件名头，展开后恢复 7/10；
- 执行 Reload 后 hidden areas 清空，菜单回到 `折叠当前文件 ⌃Esc`。

## 2026-11-15 — Remove from VCS 与 CommitPanel 作用域回归

**作用域**：Commit Changes 删除文件、文件行/未暂存组菜单、`gitStage` 复用。

**IDEA 证据**：

- `META-INF/VcsActions.xml` 将 `ChangesView.RemoveDeleted` 绑定到
  `ScheduleForRemovalAction`；
- `AbstractMissingFilesAction.update` 只在 `MISSING_FILES_DATA_KEY`
  非空时显示并启用；
- `ScheduleForRemovalAction.processFiles` 调用
  `scheduleMissingFileForDeletion`；
- 文案为 `Remove from VCS / 从 VCS 移除`，默认 keymap 无快捷键。

**实现**：

- 新增 `pathsScheduledForRemoval`：仅接受未暂存且 porcelain
  `status[1] === 'D'` 的路径；`D `、`DD`、普通修改和 untracked 排除；
- 文件行菜单与未暂存组菜单复用 `restage(paths, false)`，最终仍走 host
  `gitStage`，没有新增 Git 写路径；
- 动作使用 General.Remove 语义图标，不显示未经证实的快捷键；
- `CommitPanel` 从 `git.changes` 本地建立 path map，避免误用
  `EditorWorkspace` 的 `changesByPathRef`。

**运行态根因**：

- 首次实现把父组件的 `changesByPathRef` 用在 `CommitPanel.renderGroup`；
  切换到 Commit 时抛出 `ReferenceError: changesByPathRef is not defined`，
  面板保持 Project，React 子树无法渲染；
- 修复为组件内 map，并新增“CommitPanel 不得引用 changesByPathRef”回归。

**回归**：

```bash
node --test tests/round323.test.mjs tests/round320.test.mjs \
  tests/round173.test.mjs tests/round225.test.mjs \
  tests/round228.test.mjs tests/round245.test.mjs \
  tests/static-order.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
git diff --check
```

- RED：`tests/round323.test.mjs` 初始 **2 fail**；运行态又发现
  `changesByPathRef` 的 **1 fail**；
- 目标与相关回归通过；
- 全量 **1089 pass / 0 fail**。

**运行态**：

- Ego Browser 63101，r219 fixture，`docs/note.txt` 从工作区移出；
- Changes 文件行右键出现 `从 VCS 移除`，且没有快捷键；
- 执行后该行进入已暂存组并显示 `D`；
- Git 最终为 `D  docs/note.txt`，文件保持不存在，`README.md` 的既有 staged
  修改和其他 untracked 文件不变；
- 验证后已移回文件并取消暂存，fixture 恢复原状。

## 2026-11-15 — Create Patch from Local Changes

**作用域**：Commit Changes patch 下载、Chrome 下载验证。

**IDEA 证据**：

- `ChangesView.CreatePatch` =
  `Create Patch from Local Changes…`。

**实现**：

- `requestSelectedPatch` 为 copy/save 共用数据源；
- Create Patch 使用 Blob URL + `<a download>`；
- 文件名 `dsh-editor-changes-YYYYMMDD-HHmmss.patch`；
- Changes 动作条、文件行右键、组菜单三处入口；
- 成功后显示 `已创建 N 个文件的补丁`，不修改 index/工作区/剪贴板。

**回归**：

```bash
node --test tests/round322.test.mjs tests/round321.test.mjs \
  tests/round114.test.mjs tests/static-order.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
git diff --check
```

- RED：`tests/round322.test.mjs` 初始 **3 fail**；
- 目标与相关回归 **13 pass / 0 fail**；
- 全量 **1085 pass / 0 fail**。

**运行态**：

- 右键未跟踪文件执行 Create Patch；
- Changes 状态显示 `已创建 1 个文件的补丁`；
- `~/Downloads/dsh-editor-changes-20261115-063717.patch`
  含正确新文件 patch。

## 2026-11-15 — Copy as Patch to Clipboard

**作用域**：Commit Changes patch 导出、Host Git API、剪贴板反馈。

**IDEA 证据**：

- `ChangesView.CreatePatchToClipboard` =
  `Copy as Patch to Clipboard`。

**实现**：

- 宿主新增 `gitSelectedPatch`；
- staged / unstaged 使用原生 `git diff`，untracked 使用只读
  `git diff --no-index --binary -- /dev/null <path>`；
- 最多 100 项，路径经过 `resolveInside`；
- Changes 动作条、文件行右键、组菜单共用同一 host op 和剪贴板函数；
- 空 patch 与剪贴板拒绝均显示本地化错误。

**回归**：

```bash
node --test tests/round321.test.mjs tests/round320.test.mjs \
  tests/round114.test.mjs tests/static-order.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
git diff --check
```

- RED：`tests/round321.test.mjs` 初始 **1 fail**；
- 目标与相关回归 **15 pass / 0 fail**；
- 全量 **1082 pass / 0 fail**。

**运行态**：

- Ego Browser 对未跟踪文件执行 `作为补丁复制到剪贴板`；
- 后续 browser clipboard 读取触发权限提示，未接受；
- 系统 `pbpaste` 已确认包含该文件的新文件 patch 头。

## 2026-11-15 — 未跟踪文件 Add to VCS

**作用域**：Commit Changes 未纳入版本控制组、文件行右键。

**IDEA 证据**：

- `ChangesView.AddUnversioned` = `Add to VCS`，简中 `添加到 VCS`；
- 描述为 `Schedule selected files to be added to VCS`。

**取舍**：

- IDEA `ToggleDiffAligningModeAction` 仅对 `SimpleDiffViewer` 生效；
- Monaco side-by-side 始终用 view zones 对齐未修改行，没有等价的独立开关，
  因此没有新增只改文案、不改行为的假 Align 按钮。

**实现**：

- 未跟踪组批量动作使用 `添加到 VCS`；
- 未跟踪文件行 stage 菜单使用 `添加到 VCS`，批量显示文件数；
- 执行仍复用 `restage(paths, false)`；
- 已暂存/未暂存组文案不变。

**回归**：

```bash
node --test tests/round320.test.mjs tests/round319.test.mjs \
  tests/round114.test.mjs tests/static-order.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
git diff --check
```

- RED：`tests/round320.test.mjs` 初始 **2 fail**；
- 目标与相关回归 **12 pass / 0 fail**。
- 全量 **1079 pass / 0 fail**。

**运行态**：

- 未跟踪组更多菜单首项为 `添加到 VCS`；
- 未跟踪文件行菜单为 `添加到 VCS ⌘⇧A`；
- 两者 enabled，Git stage 执行路径未变。

## 2026-11-15 — 合并差异全部折叠与状态隔离

**作用域**：Combined diff 批量折叠、Reload 生命周期、Diff toolbar。

**IDEA 证据**：

- `Vcs.CombinedDiff.ToggleCollapseAllBlock` = `Collapse All Files`；
- 描述为 `Toggle collapse all files in Combined Diff`。

**实现**：

- 新增 `collapseAllCombinedFiles` 动作；
- 全折叠状态显示 `Expand All Files ✓`，否则显示 `Collapse All Files`；
- 一次操作把折叠集合设为全部索引或空集合；
- target 或 `reloadGeneration` 改变时清空折叠集合和两侧 hidden areas。

**回归**：

```bash
node --test tests/round319.test.mjs tests/round318.test.mjs \
  tests/round317.test.mjs tests/round316.test.mjs \
  tests/round114.test.mjs tests/static-order.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
git diff --check
```

- RED：`tests/round319.test.mjs` 初始 **3 fail**；
- 目标与相关回归 **20 pass / 0 fail**。
- 全量 **1077 pass / 0 fail**。

**运行态**：

- 全部折叠后两侧 view-line 从 7 行降为 3 行；
- 文件名头保留，菜单变为 `展开所有文件✓`；
- 展开后恢复 7/7；
- Reload 后恢复 7/7 且菜单回到 `折叠所有文件`。

## 2026-11-15 — 合并差异当前文件折叠

**作用域**：Combined diff 文件正文、Monaco hidden areas、Diff toolbar。

**IDEA 证据**：

- `Vcs.CombinedDiff.ToggleCollapseBlock` = `Collapse File`；
- 默认 keymap 未发现该动作的快捷键。

**实现**：

- `gitCombinedDiff` 为两侧文件返回 header/end line；
- 新增 `combinedFileHiddenRange`，隐藏 header 之后到正文结束的范围；
- DiffPreview 维护 `collapsedCombinedFiles`，只对当前文件切换；
- `setHiddenAreas` 同时应用到 original/modified editor；
- target 或 reload 变化时清空折叠集合和 hidden areas；
- 工具栏动作根据状态显示 `Collapse File / Expand File` 与 `✓`。

**回归**：

```bash
node --test tests/round318.test.mjs tests/round317.test.mjs \
  tests/round316.test.mjs tests/round114.test.mjs \
  tests/static-order.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
git diff --check
```

- RED：`tests/round318.test.mjs` 初始 **3 fail**；
- 目标与相关回归 **17 pass / 0 fail**。
- 全量 **1074 pass / 0 fail**。

**运行态**：

- Ego Browser 折叠当前文件后，两侧 view-line 从 7 行降为 5 行；
- 两个文件头仍可见；
- 展开后恢复 7 行，菜单动作同步为 `展开当前文件✓`。

## 2026-11-15 — 合并差异文件导航

**作用域**：Combined diff 文件头、DiffPreview file-nav、Monaco caret。

**IDEA 证据**：

- `Vcs.CombinedDiff.CaretToNextBlock` = `Next File`；
- `Vcs.CombinedDiff.CaretToPrevBlock` = `Previous File`。

**实现**：

- 宿主 `gitCombinedDiff` 为每个文件返回修改侧文件头 `line`；
- 新增纯函数 `combinedFileIndexAtLine`，按当前 caret 行定位文件；
- DiffPreview 复用原 file-nav capsule/双箭头展示 `n/total`；
- 工具栏箭头、Enter/Shift+Enter、左右箭头和
  `Ctrl+Shift+Left/Right` 均跳到对应文件头；
- 单文件 diff 继续使用 Changes 序列导航。

**回归**：

```bash
node --test tests/round317.test.mjs tests/round316.test.mjs \
  tests/round207.test.mjs tests/round197.test.mjs \
  tests/static-order.test.mjs tests/round114.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
git diff --check
```

- RED：`tests/round317.test.mjs` 初始 **3 fail**；
- 目标与相关回归 **21 pass / 0 fail**。
- 全量 **1071 pass / 0 fail**。

**运行态**：

- Ego Browser 合并两个文件后计数器为 `1/2`；
- 点击“下一个文件”变为 `2/2`；
- `Ctrl+Shift+Left` 返回 `1/2`。

## 2026-11-15 — Commit 多文件合并差异

**作用域**：Commit Changes 多选、Host Git API、Monaco DiffPreview。

**IDEA 证据**：

- `Vcs.Diff.ShowCombinedDiff` 为 `Show Combined Diff`，描述是
  `Show diff for all selected changes in one place`；
- IDEA 另有 `CaretToNextBlock / CaretToPrevBlock` 文件级导航动作。

**实现**：

- 宿主新增 `gitCombinedDiff`，复用 `gitDiff`，最多 100 个文件；
- 两侧文本使用相同文件头和二进制占位，避免把聚合文本误判为内容改动；
- Changes 工具栏与行右键菜单提供 `显示所选文件的合并差异`；
- combined target 固定只读，隐藏块还原、undo/redo、Open Local Version；
- Monaco 使用 synthetic `combined-diff.txt` Model URI，不依赖单文件路径。

**运行态问题**：

- 首个版本打开后约 200ms 自动消失；
- 根因不是请求失败，而是 Git status 协调逻辑对所有非 commit/revision/
  clipboard target 调用单文件 band 检查；combined target 没有 `path`，
  被误判为已离开变更组并 `setDiffTarget(null)`；
- 修复为 `current.combined === true` 时保留聚合 target。

**回归**：

```bash
node --test tests/round316.test.mjs \
  tests/round225.test.mjs tests/round232.test.mjs \
  tests/round313.test.mjs tests/round314.test.mjs \
  tests/round315.test.mjs tests/round114.test.mjs \
  tests/static-order.test.mjs
npm test
node --check lib/client.js
node --check lib/index.js
git diff --check
```

- RED：`tests/round316.test.mjs` 初始导入失败；
- 目标与相关回归 **37 pass / 0 fail**；
- 全量 **1068 pass / 0 fail**。

**运行态**：

- Ego Browser 选择两个 Changes 文件执行合并差异；
- 标题、只读提示、两个文件头均可见；
- hunk 导航与关闭可用；`»` 中没有还原或本地版本动作。

## 2026-11-15 — 移动/重命名后的编辑状态一致性

**作用域**：Project 内联重命名、拖放/移动操作、预览标签、Monaco Model、
Diff/Annotate 目标和 Recent Files。

**问题/根因**：

- 重命名与移动只更新 `openFiles` 和 `activePath`；
- `modelsRef` 仍以旧路径为键，下一次激活会新建重复 Model 并泄漏旧 Model；
- `previewPath` 留旧路径，预览标签失去斜体/可替换语义；
- `diffTarget`、`annotateTarget` 与 Recent Files 仍指向旧路径。

**修复**：

- 新增纯函数 `remapPathAfterMove`，精确匹配文件、前缀匹配目录；
- 新增 `remapEditorPaths`，统一同步 Model 键、文件标签、活动路径、预览、
  Diff/Annotate 目标和 Recent Files；
- 内联重命名与批量移动都复用该回调，不再各写一套路径映射。

**回归**：

```bash
node --test tests/round315.test.mjs tests/round311.test.mjs \
  tests/round314.test.mjs tests/static-order.test.mjs \
  tests/round114.test.mjs
npm test
node --check lib/client.js
git diff --check
```

- RED：`tests/round315.test.mjs` 初始 **3 fail**；
- 目标与相关回归 **16 pass / 0 fail**。

**运行态**：

- Ego Browser：预览 `note.txt` 重命名为 `note-r315.txt` 后，
  标签文本和预览 class 同步；
- 再改回 `note.txt` 后状态仍一致；
- fixture 文件名已恢复。

## 2026-11-15 — 预览标签 Keep Tab Open

**作用域**：编辑器文件标签右键菜单、Project 预览标签状态。

**IDEA 证据**：

- IDEA 2026.2.3 `idea/PlatformActions.xml` 的 `EditorTabsGroup`
  在关闭动作组之前提供 `KeepTabOpen`；
- `KeepTabOpenAction.actionPerformed` 对当前 `EditorComposite` 调用
  `setPreview(false)`，`update` 只在 `isPreview()` 为真时保留动作；
- IDEA 简中资源为 `保持标签页打开`，英文为 `Keep Tab Open`，无默认快捷键。

**实现**：

- 预览文件标签右键菜单首项增加 `保持标签页打开`；
- 动作只清空 `previewPath`，将标签转为普通标签；
- 普通文件标签不显示该动作；
- 不改变文件内容、激活标签、标签顺序或滚动位置。

**回归**：

```bash
node --test tests/round314.test.mjs tests/round311.test.mjs \
  tests/round148.test.mjs tests/round114.test.mjs \
  tests/static-order.test.mjs
npm test
node --check lib/client.js
git diff --check
```

- RED：`tests/round314.test.mjs` 初始 **3 fail**；
- 目标与相关回归 **22 pass / 0 fail**。

**运行态**：

- Ego Browser 实测预览 `note.txt` 菜单首项为 `保持标签页打开`；
- 执行后预览 class 清零；
- 再打开 `sort-a.txt` 时 `note.txt` 保留，新文件成为唯一预览；
- 普通标签菜单不再显示该动作。

## 2026-11-15 — Diff 禁用态与路径复制语义

**作用域**：Commit diff 工具栏、本地版本可用性、Commit Log 文件菜单复制路径。

**问题/根因**：

- Diff 宽屏按钮映射 `ToolbarButton` 时只传 `active`，漏传 `disabled`；
- `»` 菜单正确传递禁用态，导致同一 `Open Local Version` 动作在宽屏显示为
  可点击、窄屏却禁用；
- 行为层本身有 F4 与 `run` 守卫，因此这是反馈与真实状态不一致，不是误写文件。

**修复**：

- 宽屏 `diffToolbarActions` 映射补传 `disabled: action.disabled === true`；
- 新增回归同时断言可见按钮和 `»` 菜单的映射契约；
- 明确 Commit Log 的复制相对/绝对路径只依赖路径字符串，不因本地文件或父目录
  缺失而禁用。

**回归**：

```bash
node --test tests/round313.test.mjs tests/round298.test.mjs \
  tests/round303.test.mjs tests/round304.test.mjs \
  tests/round305.test.mjs tests/round207.test.mjs \
  tests/round197.test.mjs tests/static-order.test.mjs
npm test
node --check lib/client.js
git diff --check
```

- RED：`tests/round313.test.mjs` 初始 **1 fail**；
- 目标与相关回归 **21 pass / 0 fail**；
- 全量 **1058 pass / 0 fail**。

**运行态**：

- Ego Browser 打开 Commit `README.md` diff；
- 临时 2400px 视口下可见按钮从 enabled → 本地文件移除后 disabled →
  恢复文件后 enabled；
- fixture 与备份已恢复；Diff target 的本地可用性 effect 以取消标记和
  `target.path` 依赖隔离快速切换。

## 2026-11-15 — Project Options IDEA 分组和顺序

**作用域**：Project `Options → Behavior / Appearance`、共享 ContextMenu。

**证据**：

- IntelliJ IDEA 2026.2.3
  `intellij.platform.ide.impl.jar` 的
  `ProjectView.ToolWindow.Behavior.Actions` 顺序为
  `OpenInPreviewTab / AutoscrollToSource /
  OpenDirectoriesWithSingleClick / AutoscrollFromSource`；
- `Appearance.Actions` 以 `Show` 分区承载显示类动作，再以 `Sort By` 分区承载
  四种排序与 `Folders Always on Top`。

**症状/根因**：

- DSH 的 Behavior 条目仍保留旧平铺顺序；
- Appearance 把显示项和排序项混在同一层，缺少 IDEA 的分区层级；
- 回归测试 `tests/round312.test.mjs` 同时断言顺序、分区和非交互标题。

**修复**：

- ContextMenu 支持 `kind: 'section'` 的非交互标题，顶层和子菜单都跳过焦点；
- Behavior 按 IDEA action XML 重排；
- Appearance 改为 `Show`、`Sort By` 两个分区，排序与目录置顶归入后者；
- 中英文案补齐，不改偏好键、排序数据或文件树行为。

**回归**：

```bash
node --test tests/round312.test.mjs tests/round311.test.mjs \
  tests/round199.test.mjs tests/round185.test.mjs \
  tests/round180.test.mjs tests/round245.test.mjs \
  tests/static-order.test.mjs tests/round114.test.mjs
npm test
node --check lib/client.js
git diff --check
```

- RED：`tests/round312.test.mjs` 初始 **4 fail**；
- 目标与相关回归 **29 pass / 0 fail**；
- 全量 **1055 pass / 0 fail**。

**运行态**：

- Ego Browser（63101，r219 fixture）实测 Behavior 顺序正确；
- Appearance 的分区标题为 `role=presentation`，方向键只遍历可执行项；
- 执行排序后焦点回到 Project 树。

## 2026-11-15 — Project 预览标签页

**作用域**：Project 单击打开、编辑器文件标签、Project Options 偏好。

**实现**：

- `Options → 行为` 新增 IDEA `Enable Preview Tab`；
- 单击打开创建可替换的单一预览标签，标签斜体并以
  `dsh-editor-tab-preview` 标记；
- 编辑内容或将同一文件重新显式打开时转为普通标签；
- 默认关闭，与 IDEA `UISettingsState.openInPreviewTabIfPossible = false` 一致。

**回归**：

```bash
node --test tests/round311.test.mjs tests/round199.test.mjs \
  tests/round310.test.mjs tests/round305.test.mjs \
  tests/round304.test.mjs tests/round303.test.mjs \
  tests/round299.test.mjs
```

- RED：`tests/round311.test.mjs` 初始 **1 fail**；
- 目标与相关回归 **15 pass / 0 fail**。

**运行态**：

- Ego Browser：`note.txt` 被 `sort-b.md` 替换，始终只有一个预览标签；
- 输入后预览 class 消失且显示未保存状态。

**环境限制**：

- 当时 macOS 已锁屏，原生 IDEA 无法重新截图；IDEA 语义改由本机安装包中的
  action XML 与 `UISettingsState` 字节码取证。

## 2026-11-15 — Reload/Retry 实窗闭环与状态错误修复

**作用域**：Commit status 错误传播、Retry、Diff Reload 与 Ego workspace 恢复。

**症状/根因**：

- `loadGit()` 的 catch 只清空 git/selection，未写 `commitError`；
- Retry UI 虽存在，但 status 失败永远到不了它；
- 旧 63099 Ego profile 的 auth/workspace 恢复不稳定，运行态无法进行。

**修复**：

- 成功 status 时清除 `commitError`；
- 失败时保留清理并写入 `setCommitError(failure.message)`；
- 运行态改用 63100 新端口，并通过 workspace picker 显式选择 `r219-fixture`。

**回归**：

```bash
node --check lib/client.js
node --test tests/round310.test.mjs tests/round309.test.mjs \
  tests/round308.test.mjs tests/static-order.test.mjs \
  tests/round114.test.mjs
npm test
git diff --check
```

- RED：`tests/round310.test.mjs` 初始 **1 fail**；
- 实现后目标与相关回归 **10 pass / 0 fail**；
- 全量 **1048 pass / 0 fail**。

**运行态**（隔离 DSH，63100）：

- 外部追加内容后 Reload 立即更新 diff，`Commit:` 标签保持；
- 阻断 Git fetch 后 refresh 显示错误和“重试”；
- 恢复 fetch 后点击重试，错误消失并重新显示 8 个 change paths。

## 2026-11-15 — Commit 状态错误重试

**作用域**：Commit/Log 工具窗级 Git 错误与恢复动作。

**实现**：

- CommitPanel 新增 `onRetryStatus`；
- Git 错误条显示本地化“重试”按钮，调用现有 `loadGit()`；
- Log 自身失败重试路径不变；
- 与 20 秒 Git timeout 配合，把不可恢复 loading 变成可操作错误状态。

**回归**：

```bash
node --check lib/client.js
node --test tests/round309.test.mjs tests/round308.test.mjs \
  tests/round307.test.mjs tests/static-order.test.mjs \
  tests/round114.test.mjs
git diff --check
```

- RED：`tests/round309.test.mjs` 初始 **1 fail**；
- 实现后目标与相关回归 **10 pass / 0 fail**。
- 第 309 轮全量收尾 **1047 pass / 0 fail**。

**运行态限制**：

- Ego profile 的认证/workspace 恢复仍不稳定；
- Retry 按钮尚未完成实窗点击验证。

## 2026-11-15 — Git 请求超时与挂起诊断

**作用域**：客户端 `callGit`、Commit/Log loading 与宿主 Git 路由诊断。

**证据**：

- 直接调用 `gitStatus` / `gitLog` 约 74ms / 5ms 返回；
- 带鉴权 cookie 的 `curl /api/dsh-editor/git` 使用
  `workspaceId=r219-workspace, op=status` 返回真实 7 个 changes；
- fixture、Git 命令与宿主路由均正常；
- 上一轮页面在 token reload 后没有恢复有效编辑器上下文，
  且客户端 Git fetch 无超时，界面可无限 loading。

**实现**：

- `callGit` 增加 `AbortController` 与 20 秒 timer；
- fetch 携带 signal；
- abort 后抛出 `git request timed out after 20 seconds`；
- finally 清理 timer。

**回归**：

```bash
node --check lib/client.js
node --test tests/round308.test.mjs tests/round307.test.mjs \
  tests/static-order.test.mjs tests/round114.test.mjs
npm test
git diff --check
```

- RED：`tests/round308.test.mjs` 初始 **1 fail**；
- 实现后目标与相关回归 **9 pass / 0 fail**。
- 全量 **1046 pass / 0 fail**。

**运行态限制**：

- 宿主 API 直连验证通过；
- Ego workspace 选择未恢复有效编辑器上下文；
- Diff Reload 内容刷新仍未完成实窗验证。

## 2026-11-15 — Diff Reload

**作用域**：Diff 工具栏 / 溢出菜单与外部文件变化后的重载。

**IDEA 证据**：

- `DiffBundle.properties`：`button.reload.diff.request=Reload`。

**实现**：

- DiffPreview 新增 `reloadGeneration`；
- 工具栏 / `»` 菜单增加“重新加载差异”；
- action 递增 generation，使现有 loader effect 重新读取 original / modified；
- 不关闭 `Commit:` 标签，也不改变 target。

**回归**：

```bash
node --check lib/client.js
node --test tests/round307.test.mjs tests/round294.test.mjs \
  tests/round298.test.mjs tests/round303.test.mjs \
  tests/static-order.test.mjs tests/round114.test.mjs
git diff --check
```

- RED：`tests/round307.test.mjs` 初始 **1 fail**；
- 实现后目标与相关回归 **14 pass / 0 fail**。
- 第 307 轮全量收尾 **1045 pass / 0 fail**。

**运行态限制**：

- 隔离 profile 的 Git status/log 请求持续停在 loading；
- 重启同 profile 后仍复现；
- 因此本轮未完成 Reload 内容刷新的 Ego Browser 实例验证。

## 2026-11-15 — Terminal 粘贴历史空态

**作用域**：Terminal 屏幕菜单的 Paste from History。

**实现**：

- 空历史时不再删除“从历史粘贴…”入口；
- 入口保持可见并设置 `disabled=true`；
- 有历史时继续渲染动态子菜单和原有去重置顶逻辑。

**回归**：

```bash
node --check lib/client.js
node --test tests/round306.test.mjs tests/round300.test.mjs \
  tests/round291.test.mjs tests/round34.test.mjs \
  tests/static-order.test.mjs tests/round114.test.mjs
git diff --check
```

- RED：`tests/round306.test.mjs` 初始 **1 fail**；
- 实现后目标与相关回归 **15 pass / 0 fail**。
- 第 306 轮全量收尾 **1044 pass / 0 fail**。

**运行态**（隔离 DSH，63099）：

- 新终端菜单包含“从历史粘贴…”；
- 空历史时按钮 `disabled=true`。

## 2026-11-15 — Commit Log 本地状态刷新

**作用域**：Commit Log 文件 / 父目录存在性、Open Local Version 与 Open in Terminal。

**实现**：

- 详情打开时同时查询每个文件及其父目录；
- 每 3 秒复查一次，窗口 focus 时立即复查；
- Map 内容相等时保留原 state，避免周期性无意义重渲染；
- 文件缺失禁用 EditSource；父目录缺失禁用 Open in Terminal；
- 文件/目录恢复后菜单状态自动解除禁用。

**回归**：

```bash
node --check lib/client.js
node --test tests/round305.test.mjs tests/round304.test.mjs \
  tests/round296.test.mjs tests/round287.test.mjs \
  tests/round286.test.mjs tests/round295.test.mjs \
  tests/round47b.test.mjs tests/static-order.test.mjs \
  tests/round114.test.mjs
git diff --check
```

- RED：`tests/round305.test.mjs` 初始 **2 fail**；
- 实现后目标与相关回归 **21 pass / 0 fail**。
- 第 305 轮全量收尾 **1043 pass / 0 fail**。

**运行态**（隔离 DSH，63099）：

- 移走整个 `docs/` 后，菜单中两个入口均 `disabled=true`；
- 恢复目录后两者自动 `disabled=false`，详情保持打开。

## 2026-11-15 — Commit Log 本地文件状态

**作用域**：Commit Log 提交详情文件行与 Open Local Version。

**实现**：

- 详情变化时批量调用 `fs exists` 检查该提交的全部路径；
- 维护 `localFileAvailability`，未知状态仍乐观允许；
- 本地文件缺失时 `F4` / 双击不打开错误，菜单项保持可见但禁用；
- 文件菜单 payload 携带 `localExists`，编辑器侧不再重复查询；
- cancelled 保护避免旧提交结果覆盖新详情。

**回归**：

```bash
node --check lib/client.js
node --test tests/round304.test.mjs tests/round296.test.mjs \
  tests/round287.test.mjs tests/round290.test.mjs \
  tests/round295.test.mjs tests/static-order.test.mjs \
  tests/round114.test.mjs
git diff --check
```

- RED：`tests/round304.test.mjs` 初始 **2 fail**；
- 实现后目标与相关回归 **15 pass / 0 fail**。
- 第 303–304 轮合并收尾全量 **1041 pass / 0 fail**。

**运行态**（隔离 DSH，63099）：

- 删除 `docs/note.txt` 后打开提交详情菜单；
- “打开本地版本F4”`disabled=true`；
- fixture 验证后恢复。

## 2026-11-15 — Diff 本地版本双向同步

**作用域**：Diff EditSource 的存在性同步。

**症状/根因**：

- 第 301 轮只在文件缺失时轮询；
- 文件恢复后轮询停止，同一 diff 中文件再次删除时状态会继续显示可用。

**修复**：

- 缺失状态 1.5 秒复查，存在状态 3 秒复查；
- 每次结果同时写回 true/false；
- focus 复查与 cleanup/cancellation 保持不变。

**回归**：

```bash
node --check lib/client.js
node --test tests/round303.test.mjs tests/round301.test.mjs \
  tests/round298.test.mjs tests/static-order.test.mjs \
  tests/round114.test.mjs
git diff --check
```

- RED：`tests/round303.test.mjs` 初始 **1 fail**；
- 实现后目标与相关回归 **11 pass / 0 fail**。

**运行态**（隔离 DSH，63099）：

- 提交 diff 打开期间删除 `docs/note.txt`，按钮在 3 秒内禁用；
- 恢复文件后按钮重新启用，diff 始终未关闭。

## 2026-11-15 — Terminal 标签菜单禁用状态

**作用域**：Terminal 标签右键菜单的复制、重开与关闭其他。

**实现**：

- 标签菜单保留不可用动作，不再隐藏 `Reopen`；
- 达到宿主 6 个 shell 上限时禁用“复制终端”；
- 只有一个标签时禁用“关闭其他终端”；
- 无关闭历史时禁用“重新打开已关闭的终端”；
- TerminalPanel 传入 `canDuplicate` / `canCloseOthers`。

**回归**：

```bash
node --check lib/client.js
node --test tests/round302.test.mjs tests/round288.test.mjs \
  tests/round34.test.mjs tests/round26.test.mjs \
  tests/toolwindow-round11.test.mjs tests/static-order.test.mjs \
  tests/round114.test.mjs
git diff --check
```

- RED：`tests/round302.test.mjs` 初始 **2 fail**；
- 实现后目标与相关回归 **28 pass / 0 fail**。
- 第 301–302 轮合并收尾全量 **1038 pass / 0 fail**。

**运行态**（隔离 DSH，63099）：

- 单标签菜单中“关闭其他终端”`disabled=true`；
- “复制终端”在未达 6 个上限时保持可用。

## 2026-11-15 — Diff 本地文件恢复

**作用域**：Diff 的 `localPathAvailable` 恢复与异步清理。

**实现**：

- 仅在已知 `localPathAvailable === false` 时启动 1.5 秒复查；
- 窗口 focus 时立即复查；
- 文件重新出现后禁用状态自动解除，effect 随即清理 interval；
- cleanup 同时处理 cancellation、interval 与 focus listener。

**回归**：

```bash
node --check lib/client.js
node --test tests/round301.test.mjs tests/round298.test.mjs \
  tests/round294.test.mjs tests/static-order.test.mjs \
  tests/round114.test.mjs
git diff --check
```

- RED：`tests/round301.test.mjs` 初始 **1 fail**；
- 实现后目标与相关回归 **13 pass / 0 fail**。

**运行态**（隔离 DSH，63099）：

- 删除 `docs/note.txt` 后打开该提交 diff，“打开本地版本”禁用；
- 恢复文件但不关闭 diff，1.5 秒内按钮恢复 `disabled=false`。

## 2026-11-15 — Terminal 菜单顺序与 Close Tab

**作用域**：Terminal 屏幕上下文菜单与 `⌘W`。

**IDEA 证据**：

- `Terminal.ReworkedTerminalContextMenu`：
  `Find / NewTab / CloseTab / Copy / Paste / PasteFromHistory / SelectAll /
  ClearBuffer`；
- `Terminal.CloseTab` 复用 `CloseContent`，macOS 为 `⌘W`。

**实现**：

- 屏幕菜单按 IDEA 顺序重排，并保留本插件的历史搜索、两种清屏、
  分屏、移动与焦点动作；
- 新增“关闭终端⌘W”，复用 `closeTerminal`；
- `⌘W` 只关闭当前持焦 pane；最后一个 shell 关闭后由既有 effect
  收起 Terminal 工具窗口；
- pane 可选动作先聚合成数组，避免全部为空时末尾留下分隔符。

**回归**：

```bash
node --check lib/client.js
node --test tests/round300.test.mjs tests/round291.test.mjs \
  tests/round288.test.mjs tests/round277.test.mjs \
  tests/toolwindow-round11.test.mjs tests/static-order.test.mjs \
  tests/round114.test.mjs
git diff --check
```

- RED：`tests/round300.test.mjs` 初始 **2 fail**；
- 实现后目标与相关回归 **21 pass / 0 fail**。
- 第 299–300 轮合并收尾全量 **1035 pass / 0 fail**。

**运行态**（隔离 DSH，63099）：

- 屏幕菜单前四项为“查找⌘F / 在命令历史中搜索⌃R / 新建终端 /
  关闭终端⌘W”；
- 终端持焦按 `⌘W` 后 pane 关闭；最后一个 shell 关闭后工具窗口收起。

## 2026-11-15 — Project Options IDEA 文案

**作用域**：Project Options 的 Appearance / hidden files 与排序菜单文案。

**IDEA 证据**：

- `ProjectView.SortByName.text=Sort by Name`；
- `ProjectView.SortByType.text=Sort by Type`；
- `SortByTimeDescending.text=Sort by Modification Time (Newest First)`；
- `SortByTimeAscending.text=Sort by Modification Time (Oldest First)`；
- FileChooser：`Show Hidden Files and Directories`。

**实现**：

- 英文排序项改成 IDEA 的 Title Case 与完整句式；
- 中英文隐藏项补上“目录 / and Directories”；
- localStorage key、sort 值、action id 与菜单层级未改变。

**回归**：

```bash
node --check lib/client.js
node --test tests/round299.test.mjs tests/round186.test.mjs \
  tests/round201.test.mjs tests/round209.test.mjs \
  tests/static-order.test.mjs tests/round114.test.mjs
git diff --check
```

- RED：`tests/round299.test.mjs` 初始 **1 fail**；
- 实现后目标与相关回归 **19 pass / 0 fail**。
- 第 297–299 轮合并收尾全量 **1033 pass / 0 fail**。

## 2026-11-15 — Diff 已删除文件与菜单 disabled 透传

**作用域**：Diff 的 EditSource、`localPathAvailable` 与 `»` 菜单 action 映射。

**症状/根因**：

- 工作区文件删除后，“打开本地版本 / F4”仍可触发，只会打开一个读取错误；
- `diffActionMenu` 构造 ContextMenu 项时只复制了 id/label/shortcut/run，
  漏掉 `disabled`，所以即使 toolbar action 已禁用，菜单按钮仍可点击；
- 工作区没有本地 VFS 文件时，IDEA 的本地版本动作不应假装可用。

**修复**：

- target path 变化时调用 `callFs({ op: 'exists', paths: [target.path] })`；
- 新增 `localPathAvailable`；已知不存在时按钮禁用、`F4` 直接返回；
- 查询失败保持 unknown，实际打开时仍由 `openFile` 给出错误；
- cleanup 防止上一个 target 的异步结果覆盖当前 target；
- diff 溢出菜单显式透传 `disabled: action.disabled === true`。

**回归**：

```bash
node --check lib/client.js
node --test tests/round298.test.mjs tests/round197.test.mjs \
  tests/round202.test.mjs tests/round294.test.mjs \
  tests/round292.test.mjs tests/static-order.test.mjs \
  tests/round114.test.mjs
git diff --check
```

- RED：`tests/round298.test.mjs` 初始 **2 fail**；
- 实现后目标与相关回归 **20 pass / 0 fail**。
- 第 297–298 轮合并收尾全量 **1032 pass / 0 fail**。

**运行态**（隔离 DSH，63099）：

- 删除 fixture 的 `docs/note.txt`，打开其工作区 diff；
- “打开本地版本F4”按钮 `disabled=true`；
- `F4` 不关闭 diff、不打开文件；
- fixture 在验证后恢复。

## 2026-11-15 — Commit Log 双击 EditSource

**作用域**：Commit Log 文件行的双击动作。

**实现**：

- `onDoubleClick` 从通用 `onOpenFile` 改为 `onEditSource`；
- 与 `F4` 共用 `editLocalVersion(path)`，打开后聚焦 Monaco；
- 单击显示提交 diff、`Shift+F10` / ContextMenu 菜单保持不变。

**回归**：

```bash
node --check lib/client.js
node --test tests/round297.test.mjs tests/round296.test.mjs \
  tests/round295.test.mjs tests/round290.test.mjs \
  tests/round287.test.mjs tests/static-order.test.mjs \
  tests/round114.test.mjs
git diff --check
```

- RED：`tests/round297.test.mjs` 初始 **1 fail**；
- 实现后目标与相关回归 **14 pass / 0 fail**。

**运行态**（隔离 DSH，63099）：

- 双击 Log 文件行打开 `README.md`；
- activeElement 为编辑器内容区，diff pane 为 0。

## 2026-11-15 — Commit Log EditSource

**作用域**：Commit Log 提交详情文件行、本地版本菜单和编辑器焦点交接。

**实现**：

- 新增 `editLocalVersion(path)`：复用 `openFile(path)` 后显式聚焦 Monaco；
- CommitPanel 透传 `onEditSource`，CommitLog 文件行支持 `F4`；
- Log 文件菜单“打开本地版本”复用同一 helper，并显示 `F4`；
- 双击与 `Shift+F10` / ContextMenu 菜单保持原有语义。

**回归**：

```bash
node --check lib/client.js
node --test tests/round296.test.mjs tests/round295.test.mjs \
  tests/round290.test.mjs tests/round287.test.mjs \
  tests/round286.test.mjs tests/round293.test.mjs \
  tests/static-order.test.mjs tests/round114.test.mjs
git diff --check
```

- RED：`tests/round296.test.mjs` 初始 **2 fail**；
- 实现后目标与相关回归 **17 pass / 0 fail**。
- 第 294–296 轮合并收尾全量 **1029 pass / 0 fail**。

**运行态**（隔离 DSH，63099）：

- Log 文件行聚焦后按 `F4`；
- 打开 `README.md` 标签，activeElement 为
  `textarea[aria-label="编辑器内容"]`，diff pane 数为 0。

## 2026-11-15 — Commit Log 在终端中打开

**作用域**：Commit Log 提交详情文件行的上下文菜单。

**实现**：

- `buildCommitFileMenu` 在“在 Project 中定位”后增加“在终端中打开”；
- 复用 `openInTerminal(dirname(path))`，shell cwd 指向文件目录；
- 菜单依赖数组补 `openInTerminal`。

**回归**：

```bash
node --check lib/client.js
node --test tests/round295.test.mjs tests/round287.test.mjs \
  tests/round286.test.mjs tests/round290.test.mjs \
  tests/round294.test.mjs tests/static-order.test.mjs \
  tests/round114.test.mjs
git diff --check
```

- RED：`tests/round295.test.mjs` 初始 **1 fail**；
- 实现后目标与相关回归 **16 pass / 0 fail**。

**运行态**（隔离 DSH，63099）：

- Log 文件详情菜单出现“在终端中打开”；
- 点击后 Terminal Dock 与 PTY pane 各为 1，终端获得焦点。

## 2026-11-15 — Diff Focus Opposite Pane

**作用域**：双栏 Diff 的键盘焦点、工具栏/溢出菜单。

**IDEA 证据**：

- `Mac OS X.xml` 与 `Mac OS X 10.5+.xml`：
  `Diff.FocusOppositePane = control shift TAB`；
- `intellij.platform.diff.impl.jar` 包含
  `com/intellij/diff/actions/impl/FocusOppositePaneAction`。

**实现**：

- Monaco diff 的 original / modified editor 通过 `getDomNode()` 判断当前焦点；
- modified 持焦时切到 original，否则切回 modified；
- 双栏模式工具栏 / `»` 增加“将焦点切换到对侧⌃⇧⇥”；
- `⌃⇧Tab` 只在 diff pane 内拦截，不会切走宿主页面标签。

**回归**：

```bash
node --check lib/client.js
node --test tests/round294.test.mjs tests/round172.test.mjs \
  tests/round203.test.mjs tests/round205.test.mjs \
  tests/round292.test.mjs tests/static-order.test.mjs \
  tests/round114.test.mjs
git diff --check
```

- RED：`tests/round294.test.mjs` 初始 **3 fail**；
- 实现后目标与相关回归 **22 pass / 0 fail**。

**运行态**（隔离 DSH，63099）：

- 双栏 README diff 的 `»` 菜单包含“将焦点切换到对侧⌃⇧⇥”；
- modified 侧持焦后按 `⌃⇧Tab`，activeElement 移入 `.editor.original`；
- diff pane 保持打开。

## 2026-11-15 — Project EditSource

**作用域**：Project 树键盘动作、文件行上下文菜单与编辑器焦点交接。

**IDEA 证据**：

- `intellij.platform.ide.impl.jar` 包含
  `com/intellij/ide/actions/ProjectViewEditSourceAction.class`；
- `keymaps/$default.xml` 与 `Mac OS X 10.5+.xml`：`EditSource=F4`，
  macOS 键位还包含 `⌘↓`。

**实现**：

- Project 树持焦、当前行为文件时，`F4` / `⌘↓` 打开该文件；
- 打开完成后显式聚焦 `editorRef`，区别于普通树点击刻意保留树焦点；
- 目录行不执行 EditSource；
- 文件行菜单“在编辑器中打开”标 `F4`，目录的“展开目录”不标快捷键。

**回归**：

```bash
node --check lib/client.js
node --test tests/round293.test.mjs tests/round178.test.mjs \
  tests/round179.test.mjs tests/round180.test.mjs \
  tests/round281.test.mjs tests/static-order.test.mjs \
  tests/round114.test.mjs
npm test
git diff --check
```

- RED：`tests/round293.test.mjs` 初始 **2 fail**；
- 实现后目标与相关回归 **30 pass / 0 fail**。
- 第 291–293 轮合并收尾全量 **1023 pass / 0 fail**。

**运行态**（隔离 DSH，63099）：

- Project 树选中 `README.md`，树保持焦点；
- 按 `F4` 后打开 `README.md` 标签；
- activeElement 变为 `textarea[aria-label="编辑器内容"]`，无 diff pane。

## 2026-11-15 — Diff EditSource / Open Local Version

**作用域**：Commit/工作区/暂存 diff 工具栏、`F4` 键盘路径与本地文件跳转。

**IDEA 证据**：

- `intellij.platform.ide.impl.jar/keymaps/$default.xml`：
  `EditSource` 绑定 `F4`；
- `Mac OS X 10.5+.xml` 同样保留 `EditSource=F4`；
- 已有“打开本地版本”动作复用 `openFile(path)`。

**症状/根因**：

- `openLocalVersion` 最初只加入只读 diff；
- 工作区/暂存 diff 是用户最常进入的修改入口，却只能回到 Changes
  右键菜单或关闭 diff 后手动找文件，缺少 IDEA 的 EditSource 路径。

**修复**：

- 只要 target 有本地 path 且 `onOpenLocal` 可用，工具栏和窄屏 `»`
  菜单均显示“打开本地版本F4”；
- Diff 表面持焦时 `F4` 调用同一 `onOpenLocal(target)`；
- 键盘处理要求 `insideDiffPane`，不劫持 Project、Terminal 与表单；
- effect 依赖补 `target`、`onOpenLocal`。

**回归**：

```bash
node --check lib/client.js
node --test tests/round292.test.mjs tests/round285.test.mjs \
  tests/round202.test.mjs tests/round197.test.mjs \
  tests/round162.test.mjs tests/static-order.test.mjs \
  tests/round114.test.mjs
npm test
git diff --check
```

- RED：`tests/round292.test.mjs` 初始 **2 fail**；
- 实现后目标与相关回归 **28 pass / 0 fail**。

**运行态**（隔离 DSH，63099）：

- 打开工作区 README diff，窄工具栏 `»` 首项为“打开本地版本F4”；
- 关闭菜单后按 `F4`，diff pane 消失，`README.md` 文件标签为 active；
- 焦点进入 `textarea[aria-label="编辑器内容"]`，证明打开的是工作区文件。

## 2026-11-15 — Terminal 命令历史搜索

**作用域**：Terminal 屏幕上下文菜单、xterm 输入链路与 shell 历史搜索。

**IDEA 证据**：

- `terminal.jar/messages/TerminalBundle.properties`：
  `action.Terminal.SearchInCommandHistory.text=Search in Command History`；
- `terminal.jar/META-INF/plugin.xml`：
  `Terminal.SearchInCommandHistory` 在 macOS 使用 `control R`。

**实现**：

- Terminal 屏幕菜单在“查找”后增加 `searchHistory`；
- 菜单向当前 xterm `input('\u0012', true)`，直接复用 shell/readline 的
  reverse-i-search，不新增插件侧历史索引；
- 当前 shell 为空或已退出时禁用，动作后聚焦当前 xterm；
- 使用 `restoreFocus:false`，菜单关闭时不抢回旧焦点。

**回归**：

```bash
node --check lib/client.js
node --check lib/index.js
node --test tests/round291.test.mjs tests/round288.test.mjs \
  tests/static-order.test.mjs tests/round114.test.mjs
npm test
git diff --check
```

- RED：`tests/round291.test.mjs` 初始 **2 fail**；
- 实现后目标与相关回归 **13 pass / 0 fail**。
- 全量 **1019 pass / 0 fail**；`node --check`、`git diff --check` 通过。

**运行态**（隔离 DSH，63099）：

- 真实 PTY 执行 `echo round291-history-marker`；
- 屏幕右键菜单显示“在命令历史中搜索⌃R”；
- 点击后输入 `round291`，终端显示 `bck-i-search: round291_`；
- 焦点保持在 `textarea[aria-label="Terminal input"]`。

## 2026-11-15 — Log 复制绝对路径与过滤态 Stage All

**作用域**：Commit Log 文件详情菜单、Changes 路径过滤与 Stage All。

**实现**：

- Log 文件详情菜单在“复制相对路径”后增加“复制绝对路径”；
- 路径拼接复用 `shellQuote(root === '' ? path : root/path)`，
  含空格/引号的路径可直接粘进终端；
- 菜单依赖补 `root`。

**回归**：

```bash
node --check lib/client.js
node --test tests/round290.test.mjs tests/round287.test.mjs \
  tests/round286.test.mjs tests/round47b.test.mjs \
  tests/static-order.test.mjs tests/round114.test.mjs
npm test
git diff --check
```

- RED：`tests/round290.test.mjs` 初始 **1 fail**；
- 实现后目标与相关回归 **15 pass / 0 fail**。
- 全量 **1017 pass / 0 fail**；`node --check`、`git diff --check` 通过。

**运行态 Stage All**（隔离 DSH，63099）：

- 路径过滤 `sort-a`，未跟踪组因命中自动展开；
- Commit Options → 全部暂存后：
  - 查询仍为 `sort-a`；
  - 可见组变为 staged，`docs/sort-a.txt` 为 checked + selected；
  - footer 仍为“已选择全部更改”；
  - git status 显示 7 个文件全部 staged；
- fixture 已恢复到测试前的 `M README + 6 ??` 状态。

**运行态复制绝对路径限制**：

- Log 文件菜单已打开到新增项；
- 点击后读取 clipboard 触发 Chromium 的剪贴板权限提示，
  Ego Browser 按协议把 task space 交给用户控制；
- 本轮未绕过权限提示，因此不宣称剪贴板文本已实读验证；
- 路径生成表达式由 `tests/round290.test.mjs` 回归覆盖。

## 2026-11-15 — Diff Go To Change 菜单生命周期

**作用域**：Diff 的 Go To Change ContextMenu、文件间导航、hunk 数量刷新。

**症状/根因**：

- hunk 菜单构建的是当时文件的更改列表；
- 菜单打开时仍可能触发 `⌃⇧← / →` 等全局 diff 导航；
- `jumpToDiffHunk()` 会读取新文件当前 hunk，但菜单文案仍属于旧文件，
  用户看到的项目与最终目标脱节。

**修复**：

- DiffPreview 增加
  `React.useEffect(() => setHunkMenu(null), [target, hunks.total])`；
- target 切换或 Monaco 重新计算 hunk 总数时关闭旧菜单；
- `jumpToDiffHunk()` 继续每次读取 `diffRef.current.getLineChanges()`，
  不复用打开菜单时的旧数组。

**回归**：

```bash
node --check lib/client.js
node --test tests/round289.test.mjs tests/round283.test.mjs \
  tests/static-order.test.mjs tests/round114.test.mjs
npm test
git diff --check
```

- RED：`tests/round289.test.mjs` 初始目标用例 **1 fail**；
- 修复后目标与相关回归 **12 pass / 0 fail**。
- 全量 **1016 pass / 0 fail**；`node --check`、`git diff --check` 通过。

**运行态**（隔离 DSH，63099）：

- 构造包含第 5、80 行两个 hunk 的 `round289-diff.txt`；
- 打开工作区 diff，文件导航为 `3/9`，Go To Change 列出两个 hunk；
- 菜单打开时按 `⌃⇧→`，文件导航切到 `4/9`（`sort-a.txt`）；
- hunk 菜单自动关闭，`data-menu-item-id^="change:"` 数量归零；
- fixture 已恢复到测试前状态。

## 2026-11-15 — Terminal Switch Focus To Editor

**作用域**：Terminal 屏幕/标签菜单、Editor 与 Diff 焦点所有权。

**IDEA 证据**：

- `terminal.jar/messages/TerminalBundle.properties` 定义
  `action.Terminal.SwitchFocusToEditor.text=Switch Focus To Editor`；
- 当前终端菜单缺少从 Terminal 主动交还编辑器焦点的入口。

**实现**：

- `terminalMenuModel` 与 `terminalTabMenu` 增加
  `switchFocusToEditor`，均设置 `restoreFocus:false`，避免菜单关闭时
  ContextMenu 又把焦点还给终端；
- TerminalPanel 新增 `onSwitchFocusToEditor` prop；
- EditorWorkspace 新增 `focusEditorFromTerminal()`：
  - 当前 diff active → 向当前 workspace host 派发
    `dsh-editor-focus-diff`；
  - 否则直接 `editorRef.current.focus()`；
- DiffPreview 监听 `dsh-editor-focus-diff`，调用
  `focusDiffRef` 聚焦修改侧，不聚焦隐藏的主 Monaco；
- Dock 不关闭，终端 PTY 与输出保持原状；
- 中英文案补齐。

**回归**：

```bash
node --check lib/client.js
node --test tests/round288.test.mjs tests/static-order.test.mjs \
  tests/round114.test.mjs tests/round252.test.mjs \
  tests/round145.test.mjs
npm test
git diff --check
```

- RED：`tests/round288.test.mjs` 初始 **4 fail**；
- 实现后目标与相关回归 **26 pass / 0 fail**。
- 全量 **1014 pass / 0 fail**；`node --check`、`git diff --check` 通过。

**运行态**（隔离 DSH，63099）：

- README 文件打开后 Alt+F12 打开 Terminal；
- 屏幕右键菜单包含“将焦点切换到编辑器”；
- 点击后 Dock 仍为 1，焦点落到 `textarea[aria-label="编辑器内容"]`，
  终端不再持有焦点；
- 再打开 staged README diff，终端 Dock 保持；
- 从终端菜单再次切换焦点后，activeElement 位于
  `.dsh-editor-diff-pane`，证明聚焦的是 diff 修改侧而不是隐藏主编辑器；
- 本轮未修改 fixture。

## 2026-11-15 — Log 文件详情键盘菜单与 Open Local Version

**作用域**：Commit Log 提交详情文件行、右键/键盘菜单、本地文件动作。

**IDEA 证据**：

- `GitBundle.properties` 的 `Git.Stage.Show.Local` 将工作区文件称作
  “Show Local Version”；
- 同一 staged VFS 文案使用 `Open local version`；
- Log 文件行的“在编辑器中打开”语义就是打开工作区本地版本，因此菜单
  改为 IDEA 术语，避免与 `HEAD` / index 版本混淆。

**实现**：

- Log 文件行增加 `tabIndex=0`；
- `Shift+F10` / ContextMenu 键与右键复用同一 payload：
  `{path, hash: detail.hash, x, y}`；
- 键盘打开前显式聚焦当前行，菜单锚定在行底部；
- 菜单项从 `open` / “在编辑器中打开”改为
  `openLocalVersion` / “打开本地版本”，仍复用 `openFile(path)`；
- “显示差异 / Project 定位 / 历史 / 复制相对路径”保持原顺序。

**回归**：

```bash
node --check lib/client.js
node --test tests/round287.test.mjs tests/round286.test.mjs \
  tests/round47b.test.mjs tests/static-order.test.mjs \
  tests/round114.test.mjs
npm test
git diff --check
```

- RED：`tests/round287.test.mjs` 初始 **2 fail**；
- 实现后目标与相关回归 **14 pass / 0 fail**。
- 全量 **1010 pass / 0 fail**；`node --check`、`git diff --check` 通过。

**运行态**（隔离 DSH，63099）：

- Log 详情 README 行的 `tabIndex=0`；
- 聚焦后按 `Shift+F10` 打开菜单，顺序为
  `显示差异 / 在 Project 中定位 / 打开本地版本 / 显示历史 / 复制相对路径`；
- 点击“打开本地版本”后菜单关闭，普通 `README.md` 标签 active，
  diff pane 不存在，Monaco 文本为当前工作区内容；
- 本轮未修改 fixture。

## 2026-11-15 — Commit Log 文件详情 Show Diff

**作用域**：Commit Log 下方提交详情的变更文件右键菜单。

**IDEA 证据**：

- `vcs-git.jar/META-INF/plugin.xml` 的 `Git.Log.ContextMenu`
  包含 `Diff.ShowDiff`；
- 当前插件单击文件行可看提交 diff，但右键菜单只有
  reveal/open/history/copy，缺少显式“显示差异”。

**实现**：

- CommitLog 的 file row context payload 增加所属 `detail.hash`；
- `buildCommitFileMenu` 接收 `{path, hash, x, y}`；
- 菜单首项新增 `diff`，调用既有
  `showCommitDiff({ hash, path })`，复用单一只读 Commit diff 标签；
- 无 hash 时 disabled，其他 IDEA 单文件动作保持原顺序。

**运行态发现并修复**：

- 首次实现把依赖/调用误写成组件内不存在的 `onShowCommitDiff`；
- 浏览器实际抛出 `ReferenceError: onShowCommitDiff is not defined`，
  Editor host 已挂载但 React 子树为空；
- 改为 EditorWorkspace 已声明的 `showCommitDiff`，回归同时断言
  `showCommitDiff({ hash, path })` 且不得出现 `[onShowCommitDiff,`。

**回归**：

```bash
node --check lib/client.js
node --test tests/round286.test.mjs tests/round148.test.mjs \
  tests/round159.test.mjs tests/round163.test.mjs \
  tests/round164.test.mjs tests/round165.test.mjs \
  tests/static-order.test.mjs
npm test
git diff --check
```

- RED：`tests/round286.test.mjs` 初始 **2 fail**；
- 实现后目标与相关回归 **25 pass / 0 fail**。
- 全量 **1008 pass / 0 fail**；`node --check`、`git diff --check` 通过。

**运行态**（隔离 DSH，63099）：

- 修复后 Editor 正常挂载；
- 打开 Commit → 日志，选择 baseline 提交；
- README 文件行右键菜单顺序为
  `显示差异 / 在 Project 中定位 / 在编辑器中打开 / 显示历史 / 复制相对路径`；
- 点击“显示差异”后打开 `提交: README.md`，提示
  `提交 e3df56d 中的改动`，无残留菜单；
- 本轮未改 fixture。

## 2026-11-15 — 只读 Diff 的 Open Local Version

**作用域**：Commit revision/clipboard/HEAD diff、Diff 工具栏与 `»` 溢出动作。

**IDEA 证据**：

- `GitBundle.properties` 定义
  `action.Git.Stage.Show.Local.text=Show Local Version`；
- 同 bundle 的 staged VFS 通知提供
  `stage.vfs.editor.notification.link=Open local version`。

**虚拟版本标签评估**：

- 现有 `openFiles` 标签同时驱动磁盘读取、mtime、dirty、保存、外部修改和关闭清理；
- 直接加入 staged virtual model 会让这些副作用误作用到非磁盘内容；
- 本轮不复制第二套编辑器生命周期，先实现风险更低的本地版本入口。

**实现**：

- `DiffPreview` 新增 `onOpenLocal` prop；
- 只有 read-only 的 commit/revision/clipboard target 才加入
  `openLocalVersion` 动作；
- 工具栏与 `»` 共用该动作，文案为“打开本地版本”；
- 父层复用既有 `openFile(localTarget.path)`，由它退出 diff active、
  载入磁盘内容和普通文件标签；
- 中英文案补齐。

**回归**：

```bash
node --check lib/client.js
node --test tests/round285.test.mjs tests/round197.test.mjs \
  tests/round162.test.mjs tests/round166.test.mjs \
  tests/round283.test.mjs tests/static-order.test.mjs \
  tests/round114.test.mjs
npm test
git diff --check
```

- RED：`tests/round285.test.mjs` 初始 **2 fail**；
- 实现后目标与相关回归 **28 pass / 0 fail**。
- 全量 **1006 pass / 0 fail**；`node --check`、`git diff --check` 通过。

**运行态**（隔离 DSH，63099）：

- `MM README.md` 打开 Compare with HEAD 的只读 diff；
- 窄 diff 的 `»` 首项为“打开本地版本”；
- 点击后 Compare 标签失去 active，普通 `README.md` 文件标签成为 active；
- diff pane 消失，Monaco 模型文本包含工作区独有行
  `round 285 local version`；
- menu 关闭；fixture 已恢复到测试前状态。

## 2026-11-15 — Commit 文件 Compare with HEAD Version

**作用域**：Commit Changes 文件菜单、HEAD/本地组合 diff、revision 只读标签。

**IDEA 证据**：

- `intellij.vcs.git.shared.jar/messages/GitBundle.properties` 定义
  `action.Git.Stage.Compare.Staged.Head.text=Compare with HEAD Version`；
- 现有 staged diff 只显示 HEAD→index，unstaged diff 只显示 index→worktree；
  文件菜单缺少一次展示 HEAD→当前本地内容的组合对照。

**实现**：

- 新增 `canCompareWithHead(change)`：排除 `??` 以及 index 状态
  `A/R/C`，因为 `HEAD:<path>` 对它们无法解析，菜单不提供必败动作；
- 新增 `compareWithHead()`，复用
  `{ path, revision: 'HEAD', staged: false }` 的单 revision diff 标签；
- 文件菜单在“与修订比较…”后增加“与 HEAD 版本比较”；
- 多选时 disabled，单文件且 HEAD 含该路径时可用；
- 复用现有只读 diff、Compare 标签、hunk 导航和 Go To Change，不新增比较引擎。

**回归**：

```bash
node --check lib/client.js
node --test tests/round284.test.mjs tests/round225.test.mjs \
  tests/round25.test.mjs tests/round223.test.mjs \
  tests/static-order.test.mjs tests/round114.test.mjs
npm test
git diff --check
```

- RED：`tests/round284.test.mjs` 初始 **3 fail**；
- 实现后目标与相关回归 **20 pass / 0 fail**。
- 全量 **1004 pass / 0 fail**；`node --check`、`git diff --check` 通过。

**运行态**（隔离 DSH，63099）：

- `README.md` 为 `MM`：索引含 3 行已暂存改动，工作区另有
  `round 284 local only`；
- 未暂存行 Shift+F10 菜单中“与 HEAD 版本比较”可用；
- 打开后标签为 `比较: README.md`，提示“与修订 HEAD 比较”，
  无 writable revert gutter；
- 右侧模型同时包含已暂存三段内容与 `round 284 local only`，
  证明是 HEAD→本地组合 diff；
- 未跟踪文件菜单中该项 `disabled=true`；
- fixture 已恢复到测试前状态。

## 2026-11-15 — Diff Go To Change

**作用域**：Commit diff 工具栏、`»` 溢出菜单、hunk 直接导航。

**IDEA 证据**：

- `/Applications/Intellij.app/Contents/lib/intellij.platform.diff.jar`
  `messages/DiffBundle.properties` 定义
  `action.presentation.go.to.change.text=Go To Change`；
- 既有 `n/总数` 和 F7/⇧F7 已覆盖前后移动，但缺少 IDEA 的可列举更改选择器。

**实现**：

- `DiffPreview` 复用 Monaco 当前 `getLineChanges()`，不重算 diff；
- hunk 计数器成为可聚焦 `role=button`：点击、Enter/Space、右键打开
  “转到更改…”；
- 菜单按 `更改 n/总数 · 第 L 行` 列出全部 hunk，当前项带 `✓`；
- 选择后 `setPosition` 到 modification side 的 hunk 行，
  `revealPositionInCenterIfOutsideViewport` 并聚焦 Monaco；
- 菜单项设置 `restoreFocus:false`，避免 ContextMenu 清理阶段把焦点从
  编辑器抢回 opener；
- `»` 动作列表加入同一 `goToChange`，极窄布局仍可访问；
- 中英文案同步。

**回归**：

```bash
node --check lib/client.js
node --test tests/round283.test.mjs tests/round166.test.mjs \
  tests/round162.test.mjs tests/round196.test.mjs \
  tests/round197.test.mjs tests/round208.test.mjs \
  tests/static-order.test.mjs tests/round114.test.mjs
npm test
git diff --check
```

- RED：`tests/round283.test.mjs` 初始 **3 fail**；
- 实现后目标与相关回归 **34 pass / 0 fail**。
- 全量 **1001 pass / 0 fail**；`node --check`、`git diff --check` 通过。

**运行态**（隔离 DSH，63099，200px Commit）：

- 构造一个索引/本地均为 `A` 的 100 行文件，含第 5、80 行两个 hunk；
- 窄布局 `»` 中出现“转到更改…”，菜单列出
  `更改 1/2 · 第 5 行✓` 与 `更改 2/2 · 第 80 行`；
- 选择第二项后菜单关闭，hunk 计数 `1/2 → 2/2`，
  焦点进入 Monaco textarea，修改侧滚动到第 80 行；
- fixture 已恢复到测试前状态。

## 2026-11-15 — IDEA Stage All / Stage All Tracked

**作用域**：Commit Changes 操作条、Commit Options、工作区侧暂存语义。

**IDEA 证据**：

- `/Applications/Intellij.app/Contents/plugins/vcs-git/lib/vcs-git.jar`
  `META-INF/plugin.xml` 的 `Git.Stage.Toolbar` 包含
  `Git.Stage.Add.Tracked`；
- 同文件 `Git.Stage.Add.All` 提供“Add all unstaged changes and untracked
  files to index”动作；
- `intellij.vcs.git.shared.jar/messages/GitBundle.properties` 定义
  `Stage All` 与 `Stage All Tracked`。

**缺口**：

- Commit 只能对现有勾选/选区逐项暂存；没有 IDEA 的全局 Stage All；
- `MM` 路径的 porcelain `staged=true`，若按该布尔值筛选会漏掉其较新的
  工作区内容，无法真正暂存所有已跟踪改动。

**实现**：

- 新增纯函数 `stageAllTargets(changes, trackedOnly)`，复用
  `splitChanges()` 的 unstaged/unversioned band；`MM` 留在 unstaged，
  tracked-only 排除 `??`；
- Changes 操作条按 IDEA 顺序放置 `Stage All Tracked`，无候选时 disabled；
- Commit Options 增加 `Stage All`，同时处理工作区改动与 `??` 文件；
- 两个动作复用 `restage(paths, false)` 的 `git add -A -- <paths>`，
  成功后把路径并入 `commitSelection`，避免“已暂存但提交框仍为空”的假成功；
- 中英文案同时补齐。

**回归**：

```bash
node --check lib/client.js
node --test tests/round282.test.mjs tests/round185.test.mjs \
  tests/round186.test.mjs tests/static-order.test.mjs \
  tests/plugin-contract.test.mjs tests/round114.test.mjs
npm test
git diff --check
```

- RED：`tests/round282.test.mjs` 初始 **4 fail**（helper/action/menu/i18n 均缺失）；
- 实现后目标回归 **4 pass / 0 fail**；相关静态与契约回归 **29 pass / 0 fail**。
- 全量 **998 pass / 0 fail**；`node --check`、`git diff --check` 通过。

**运行态**（隔离 DSH，63099，200px Commit）：

- `MM README.md` + 6 个 `??` 文件；
- 点击 `Stage All Tracked` 后 `git status` 为 `M  README.md` + 6 个 `??`，
  未暂存组 0 个文件，未跟踪组保持 6 个文件；
- Commit Options 的“全部暂存”可用，执行后 7 个文件全部 staged，
  未跟踪组消失，全部行仍 checked；
- fixture 已恢复到测试前的 `M  README.md` + 6 个 `??` 状态。

## 2026-11-15 — Changes 组菜单组级回滚

**作用域**：Changes group menu、staged/unstaged/unversioned rollback。

**实现**：

- group menu 增加 danger 色 rollbackGroup；
- 标签按 band 使用丢弃暂存版本 / 还原工作区 / 删除未跟踪文件，
  多文件时复用既有 count 文案；
- 无 checked member 时 disabled；
- 父层按 group 分流 `rollback(paths, {staged|unversioned})`，复用现有
  confirmation、checkbox reconcile、tree refresh 链。

**回归**：

```bash
node --test tests/round279.test.mjs tests/round250.test.mjs \
  tests/round245.test.mjs tests/static-order.test.mjs
npm test
git diff --check
```

- 目标回归 **10 pass / 0 fail**；
- 全量 **994 pass / 0 fail**；
- Ego Browser：staged 组菜单显示 danger 回滚；空 unstaged 组回滚 disabled；
  展开/收起仍可用。

## 2026-11-15 — IDEA TreeSpeedSearch 匹配边界确认

**作用域**：Project speed search 是否应支持路径片段。

**静态证据**：本机 `com.intellij.ui.TreeSpeedSearch`（`intellij.platform.ide.impl.jar`）
通过 `myPresentableStringFunction` / `getElementText(TreePath)` 取得匹配文本；
其元素来源是树节点的 presentation string，而不是 root-relative full path。

**结论**：

- 当前 Project 按条目 name 匹配与 IDEA TreeSpeedSearch 一致；
- 不应在没有额外需求/证据时把 `/` 路径片段匹配塞进该项目搜索；
- 文件路径搜索已有 Go to File / 宿主 `fs.search` 的其他入口。

**验证**：本轮为 IDEA 静态源码/class 签名审计，无源码变更；
最新全量保持 **992 pass / 0 fail**。

## 2026-11-15 — Changes 文件行键盘右键菜单

**作用域**：Changes file row、Shift+F10/ContextMenu。

**修复**：文件行 onKeyDown 复用鼠标菜单的 payload/selection 逻辑；非当前 range
选择时先替换当前文件选择，再在行底部打开文件菜单。

**回归**：

```bash
node --test tests/round277.test.mjs tests/round173.test.mjs \
  tests/round168.test.mjs tests/static-order.test.mjs
npm test
git diff --check
```

- 目标回归 **16 pass / 0 fail**；
- 全量 **992 pass / 0 fail**；
- Ego Browser：Shift+F10 打开文件菜单，首焦点“显示差异 ⌘D”，
  当前行保持 selected。

## 2026-11-15 — Project 搜索设置变化后的焦点保持

**作用域**：Project speed search 与 Options/Appearance 设置组合。

**症状/根因**：

- 搜索框打开时切换排序，查询和结果会更新；
- Project Options 的 `focusProjectAfterOption()` 在立即和 120ms 后两次聚焦树，
  覆盖搜索框的焦点；
- UI 呈现“搜索框可见但未聚焦”的分裂状态。

**修复**：搜索打开期间，显示设置变化后在 160ms 重新聚焦搜索框，
晚于 Options 的第二阶段 tree focus。

**回归**：

```bash
node --test tests/round275.test.mjs tests/round242.test.mjs tests/static-order.test.mjs
npm test
git diff --check
```

- 目标回归 **9 pass / 0 fail**；
- 全量 **991 pass / 0 fail**；
- Ego Browser：搜索 `sort-` 期间切到 type，查询保留、结果重排，
  焦点回到“在 Project 中搜索” input；测试后 sort 恢复 name。
- round276：搜索 `note` 时关闭隐藏文件，结果从
  `.hidden-note.txt + docs/note.txt` 更新为 `docs/note.txt`，
  查询和搜索焦点保持；hidden 偏好已恢复。

## 2026-11-15 — Project 搜索视图沿用 Compact Directories

**作用域**：Project speed search 合成树、Compact Directories 偏好。

**症状**：`searchEntryRows` 调用 `flattenRows(..., false)`，搜索结果始终展开
目录链，与 Project 树的紧凑目录设置不一致。

**修复**：`searchEntryRows()` 接受 compactDirectories，并传给现有
`flattenRows()`；ProjectPanel 把当前偏好作为参数传入。

**回归**：

```bash
node --test tests/round272.test.mjs tests/round242.test.mjs tests/static-order.test.mjs
npm test
git diff --check
```

- 目标回归 **10 pass / 0 fail**；
- 全量 **990 pass / 0 fail**；
- 单测覆盖 `docs/nested/deep/note.txt` 在关闭/开启 Compact 时分别显示
  三段目录与合并 `docs/nested/deep` 行。
- round273 UI 验证：普通结果 docs/compactchain/deep/target 四层，
  Compact 后合并为 `docs/compactchain/deep` + target；偏好已恢复。

## 2026-11-15 — Changes 空组节点可选择与键盘菜单

**作用域**：Changes 空 staged/unstaged 节点、Shift+F10/ContextMenu、stale selection。

**症状/根因**：

- git refresh effect 对所有空组都清除 selectedGroup；
- staged/unstaged 组即使为空也始终渲染，选择被立即清空导致 aria-selected=false；
- 空组因此无法稳定使用 Shift+F10 打开组菜单。

**修复**：

- 仅当空 unversioned 组从树中消失时清理 selectedGroup；
- 空 staged/unstaged 继续作为合法、可选树节点；
- 组节点新增 Shift+F10 / ContextMenu 键盘入口，复用右键 group menu。

**回归**：

```bash
node --test tests/round271.test.mjs tests/round248.test.mjs \
  tests/round247.test.mjs tests/static-order.test.mjs
npm test
git diff --check
```

- 目标回归 **11 pass / 0 fail**；
- 全量 **988 pass / 0 fail**；
- Ego Browser：空 unstaged 组 Shift+F10 打开菜单，aria-selected=true，
  首焦点为可用“展开更改组”，Esc 后焦点仍回组节点。

## 2026-11-15 — Changes 组右键菜单焦点闭环

**作用域**：Changes group header context menu、return-focus。

**症状/根因**：右键组头只调用 onSelectGroup，没有同步聚焦该组节点；
ContextMenu 捕获的 opener 可能仍是之前的文件行，Esc 后焦点回到旧文件。

**修复**：onContextMenu 先 `event.currentTarget.focus()`，再移动 group
selection 并打开菜单。

**回归**：

```bash
node --test tests/round268.test.mjs tests/round250.test.mjs \
  tests/round247.test.mjs tests/static-order.test.mjs
npm test
git diff --check
```

- 目标回归 **11 pass / 0 fail**；
- 全量 **987 pass / 0 fail**；
- Ego Browser：先选文件行，再右键 unstaged 组；菜单打开后首焦点是菜单项，
  Esc 后焦点回到 `unstaged` 组节点而非旧文件行。
- round269 进一步验证动作执行：组 stage 项 disabled 时首焦点落到展开命令；
  执行展开/收起后菜单关闭，组 aria-expanded 更新，焦点仍回组节点。

## 2026-11-15 — Diff 溢出菜单补齐 undo/redo 快捷键标签

**作用域**：Commit diff `»` 菜单。

**修复**：撤销/重做动作已有真实键盘路径，但菜单未显示键位；补
`shortcut: '⌘Z'` 与 `shortcut: '⇧⌘Z'`。

**回归**：

```bash
node --test tests/round266.test.mjs tests/round197.test.mjs \
  tests/round156.test.mjs tests/static-order.test.mjs
npm test
git diff --check
```

- 目标回归 **18 pass / 0 fail**；
- 全量 **986 pass / 0 fail**；
- Ego Browser：240px 时 `»` 菜单显示
  `撤销上次块还原 ⌘Z` / `重做上次块还原 ⇧⌘Z`。
- round267 验证首焦点为 view，ArrowUp 回绕到 redo、ArrowDown 回首项，
  Esc 关闭并回焦 `更多操作`。

## 2026-11-15 — Project 搜索截断可见性

**作用域**：Project speed search 的 200 命中/访问预算上限。

**症状**：宿主返回 `truncated:true`，客户端只消费 entries，用户无法知道结果不完整。

**修复**：ProjectPanel 记录 searchTruncated，并在树中显示
“匹配过多，仅显示前 200 项；请继续输入以缩小范围”。

**回归**：

```bash
node --test tests/round264.test.mjs tests/round242.test.mjs tests/static-order.test.mjs
npm test
git diff --check
```

- 目标回归 **9 pass / 0 fail**；
- 全量 **985 pass / 0 fail**；
- Ego Browser：201 个命中时显示截断提示、行数 203（根+目录+200 命中），
  且不显示“无匹配”；bulk fixture 测试后已移出工作区。
- round265 验证 Esc 后搜索框关闭、提示消失、完整树恢复为 12 行，
  焦点回到 Project 树。
- round270 修正提示文案：`truncated` 也可能由访问预算而非 200 命中上限触发，
  因此改为“搜索结果已截断”，不再虚报具体数量。

## 2026-11-15 — Project speed search 沿用排序偏好

**作用域**：Project 递归 speed search 的排序。

**症状**：客户端合成搜索结果时重新按目录/名称排序，覆盖了 Project 的
名称/类型/修改时间与 Folders Always on Top 设置。

**修复**：

- `fs.search` 透传 `sort` / `foldersFirst`；
- 宿主递归遍历用 `listDirectory` 的当前排序；
- 客户端不再二次 name sort，保留命中返回顺序并据此合成父链。

**回归**：

```bash
node --test tests/round258.test.mjs tests/round242.test.mjs tests/static-order.test.mjs
npm test
git diff --check
```

- 目标回归 **10 pass / 0 fail**；
- 全量 **982 pass / 0 fail**；
- round262 已用专用 fixture 验证 name/type/modified 顺序不同；
  页面内 `fs.search` 也返回对应顺序，Folders Always on Top 由单测覆盖。
- round263 已完成 UI 层验证：name 显示 a.txt/b.md/c.ts，type 显示
  b.md/c.ts/a.txt，父目录 docs 保持正确；测试后恢复 name 偏好。

## 2026-11-15 — Terminal 屏幕 Split 动作语义修正

**作用域**：Terminal 屏幕右键 Split Right。

**根因**：屏幕菜单沿用了标签菜单的 `setSplitId(terminal.id)`，但屏幕只显示
active/right terminal；在 right pane 上点击只会再次绑定同一 split，属于 no-op。

**修复**：屏幕 Split 改为调用工具栏同一个 `toggleSplit()`：无分屏时复用另一
标签或新建 shell；已有分屏时隐藏该菜单项。

**回归**：

```bash
node --test tests/round256.test.mjs tests/round253.test.mjs \
  tests/round251.test.mjs tests/static-order.test.mjs
npm test
git diff --check
```

- 目标回归 **7 pass / 0 fail**；
- 全量 **980 pass / 0 fail**；
- round257 已补运行态：无 split 时菜单出现该项，执行后 pane 1→2；
  right pane 菜单隐藏该项，Escape 正常关闭菜单。

## 2026-11-15 — Terminal 屏幕菜单补分屏与 Move to Editor

**作用域**：Terminal 屏幕右键、已存在的 split/move 动作发现性。

**修复**：屏幕菜单新增 `splitRight` 与 `moveToEditor`，复用标签菜单同一
回调；当前 pane 已是 active terminal 时 split 项隐藏，移到编辑器始终可用。

**回归**：

```bash
node --test tests/round253.test.mjs tests/round251.test.mjs \
  tests/round70.test.mjs tests/round34.test.mjs tests/static-order.test.mjs
npm test
git diff --check
```

- 目标回归 **11 pass / 0 fail**；
- 全量 **979 pass / 0 fail**；
- 后续 round255 已补运行态：Terminal stripe 打开后，屏幕菜单包含
  `移动到编辑器`；点击后菜单关闭、编辑器终端出现；`移回终端 Dock`
  后 editor placement 恢复为 `[]`。

## 2026-11-15 — Terminal 菜单查找焦点回收

**作用域**：Terminal 屏幕右键“查找 `⌘F`”、ContextMenu return-focus。

**症状/根因**：菜单项执行后查找栏出现，但 ContextMenu 卸载时把焦点还给
终端，覆盖了 input 的 `autoFocus`，用户仍需再次点击输入框。

**修复**：为查找输入框增加 `findInputRef`；查找栏打开时在下一拍显式聚焦，
晚于 ContextMenu 的 return-focus。

**回归**：

```bash
node --check lib/client.js
node --test tests/round252.test.mjs tests/round251.test.mjs \
  tests/round34.test.mjs tests/static-order.test.mjs
npm test
git diff --check
```

- 目标回归 **9 pass / 0 fail**；
- 全量 **978 pass / 0 fail**；
- Ego Browser：右键终端菜单点击“查找”后输入框存在、菜单关闭、
  `document.activeElement` 为该输入框。

## 2026-11-15 — Terminal 屏幕菜单增加查找入口

**作用域**：Terminal 屏幕右键、查找栏入口。

**修复**：`terminalMenuModel` 增加 `find` 项（`⌘F`），复用
`openTerminalFind(emulator)`，与已有快捷键打开同一查找栏。

**回归**：

```bash
node --test tests/round251.test.mjs tests/round70.test.mjs \
  tests/round34.test.mjs tests/static-order.test.mjs
npm test
git diff --check
```

- 目标回归 **10 pass / 0 fail**；
- 全量 **977 pass / 0 fail**；
- 本轮类型为静态源码与回归验证，未新增 Terminal 运行态断言。

## 2026-11-15 — Changes 组头右键菜单

**作用域**：Changes group node 右键、组级动作、展开/折叠。

**修复**：

- 右键组头先选择 group node，再以指针位置打开现有 ContextMenu；
- 菜单复用组 action（暂存/取消暂存、gitignore），新增展开/收起更改组；
- 窄窗 `»` 与右键菜单共用同一 `groupMenuItems`，顺序和 disabled 状态不漂移。

**回归**：

```bash
node --check lib/client.js
node --test tests/round250.test.mjs tests/round249.test.mjs \
  tests/round243.test.mjs tests/static-order.test.mjs
npm test
git diff --check
```

- 目标回归 **11 pass / 0 fail**；
- 全量 **976 pass / 0 fail**；
- 运行态：右键未暂存组后组节点 selected=true，菜单为
  `暂存所选 / 收起更改组`，Down+Enter 收起组且菜单关闭。

## 2026-11-15 — Changes 过滤无结果时清除 group selection

**作用域**：Changes group selection、路径过滤、Show Diff/rollback enablement。

**症状**：选中组节点后输入无命中过滤，组头消失但没有可见节点保持 selected，
父层仍可能保留不可见的选择上下文。

**修复**：

- `chooseGroup(null)` 作为显式 clear 语义；
- 过滤结果为零且存在 selectedGroup 时调用 `onSelectGroup(null)`；
- 过滤仍有目标时继续由既有逻辑选择首个可见文件并清除组选择。

**回归**：

```bash
node --check lib/client.js
node --test tests/round249.test.mjs tests/round248.test.mjs \
  tests/round247.test.mjs tests/static-order.test.mjs
npm test
git diff --check
```

- 目标回归 **12 pass / 0 fail**；
- 全量 **974 pass / 0 fail**；
- 运行态：选中未暂存组后过滤 `does-not-exist`，selectedGroups 为空，
  Show Diff/rollback 均 disabled。

## 2026-11-15 — Changes group node 方向键与失效清理

**作用域**：Changes group selection、左右键展开折叠、git 刷新后的状态回落。

**修复**：

- 聚焦组节点时，`→` 展开折叠组，`←` 收起展开组；
- 操作使用组自身的 `aria-expanded`，不另建第二份折叠状态；
- git 刷新后若当前组已无成员，清除 selectedGroup 和 ref，避免 stale id；
- 过滤后若有可见文件目标，既有过滤 effect 会切换到首个文件并清除组选择。

**回归**：

```bash
node --check lib/client.js
node --test tests/round248.test.mjs tests/round247.test.mjs tests/static-order.test.mjs
npm test
git diff --check
```

- 目标回归 **10 pass / 0 fail**；
- 全量 **972 pass / 0 fail**；`git diff --check` 通过。

**运行态**（隔离 DSH）：

- 未暂存组展开时按 `←`：`aria-expanded` 变为 false，组内文件行隐藏；
- 再按 `→`：恢复 true 和组内文件行；
- 两次操作后焦点仍在 `unstaged` 组节点。

## 2026-11-15 — Changes 组节点选择与文件动作隔离

**作用域**：Commit Changes 组节点、文件行选择、Show Diff/rollback/快捷键。

**证据/症状**：

- 本机 IntelliJ `ChangesTree` 继承 Swing `Tree`，并公开
  `addSelectionListener` / `setSelectedChanges`；
- DSH 组头原先没有选择状态，只有 chevron、checkbox 和动作按钮；
- 简单给组头加高亮会让父层仍保留旧 `selectedChange`，`⌘D`、`⌥⌘Z`
  和 toolbar 都可能继续操作上一次文件。

**修复**：

- EditorWorkspace 新增独立 `selectedGroup` / `selectedGroupRef`；
- 文件行 `chooseChange` 清除 group selection；
- `chooseGroup` 只移动节点选择，清除文件与范围选择，不触碰 commit checkbox；
- 组头成为 `role=treeitem`，暴露 `data-dsh-change-group`、
  `aria-selected`、`aria-expanded` 和 roving `tabIndex`；
- 组名区域点击选择组，chevron / checkbox / 动作按钮保持自身语义；
- Changes 键盘导航统一遍历 group + file 行；ArrowDown 从组节点进入首个文件；
- file-only 快捷键在 group selection 下直接返回，避免操作隐藏的旧文件。

**回归**：

```bash
node --check lib/client.js
node --test tests/round247.test.mjs tests/round173.test.mjs \
  tests/round245.test.mjs tests/static-order.test.mjs
npm test
git diff --check
```

- RED：round247 初始 4 fail；
- 修复后目标回归 **16 pass / 0 fail**；
- 全量 **970 pass / 0 fail**；`git diff --check` 通过。

**运行态**（隔离 DSH，200px Commit）：

- 点击“未暂存”组名：组节点 `aria-selected=true`、`tabIndex=0`；
- 文件行失去 selected，Show Diff 与还原所选均 disabled；
- 三个组复选框保持原 checked 状态，组选择不改提交 inclusion；
- group selection 下 `⌘D` 不打开旧 diff，`⌥⌘Z` 不弹回滚确认，
  仓库状态保持不变；
- ArrowDown 后“未暂存 README.md”成为唯一文件当前行，Show Diff 恢复 enabled。

## 2026-11-15 — Changes 组头动作无勾选时禁用

**作用域**：Commit Changes 三类组头、暂存/取消暂存、.gitignore、窄窗 `»`。

**症状/根因**：

- 取消未跟踪组全部勾选后，组头“暂存所选”仍为 enabled；
- 点击后调用 `onStage([])`，不会修改仓库，但菜单关闭、界面无反馈；
- 组头 action 的 disabled 只看 `group.changes.length`，没有检查
  `selectedInGroup`，与“对所选执行”的现有契约冲突。

**修复**：

- 组头主 action 改为 `disabled: selectedInGroup.length === 0`；
- `.gitignore` 继续使用同一 selection guard；
- 所有项都 disabled 时，`ContextMenu` 找不到可聚焦项，焦点留在 `»`；
  Esc 后仍由既有 return-focus 回到 `»`；
- 重新勾选任一文件后动作立即恢复 enabled，首焦点回到“暂存所选”。

**回归**：

```bash
node --check lib/client.js
node --test tests/round245.test.mjs tests/round243.test.mjs \
  tests/round187.test.mjs tests/static-order.test.mjs
npm test
git diff --check
```

- RED：round245 的 disabled 契约断言失败；
- 修复后目标回归 **14 pass / 0 fail**；
- 全量 **966 pass / 0 fail**；`git diff --check` 通过。

**运行态**（隔离 DSH，200px Commit）：

- 未跟踪组取消全选后，`»` 菜单两项均为 disabled，焦点留在 `更多操作`；
- Esc 关闭菜单并保持 `更多操作` 焦点；
- 重新全选后两项 enabled，首焦点为“暂存所选”；
- IDEA Computer Use 仍被 macOS 锁屏阻塞。

## 2026-11-15 — Diff 文件导航按宽度三级降级

**作用域**：Commit diff 工具栏、文件间导航、200–260px 窄面板、极端窄宽度。

**症状/证据**：

- 200–260px 目标区间实际以侧栏到 diff pane 的剩余宽度为准；
- pane 193px 时完整文件导航占 88px，关闭按钮右边界到 796px，面板只到 775px；
- pane 174px 时关闭按钮溢出 40px；pane 134px 时仍会裁切；
- `toolbar.scrollWidth > clientWidth`，且 toolbar 使用 `overflow:hidden`，被裁按钮不可达。

**修复**：

- `DiffPreview` 除 compact actions 外记录实测 `diffToolbarWidth`；
- 新增 `diffFileNavModeForWidth()`：
  - `>=224px`：完整 `‹ n/总数 ›`；
  - `160–223px`：单个可点击文件计数胶囊；
  - `<160px`：隐藏文件导航，保留 `⌃⇧←/→` 快捷键；
- 文件计数胶囊支持点击 / Enter 下一个、Shift+Enter 或右键上一个、
  ←/→ 双向切换；
- `»`、hunk 胶囊、关闭按钮保持固定末端，不参与文件导航降级。

**回归**：

```bash
node --check lib/client.js
node --test tests/round244.test.mjs tests/round230.test.mjs \
  tests/round221.test.mjs tests/round197.test.mjs tests/static-order.test.mjs
npm test
git diff --check
```

- RED：round244 初始缺少 helper，测试进程直接失败；
- 修复后目标回归 **15 pass / 0 fail**；
- 全量 **964 pass / 0 fail**；`git diff --check` 通过。

**运行态**（隔离 DSH，staged README diff）：

- pane 253px / 233px：完整文件导航，关闭按钮 right=771 < pane right=775；
- pane 213px / 194px / 174px：文件导航为 `1/5` 胶囊，toolbar 无 overflow，
  `» / hunk / close` 全部在 pane 内；
- pane 134px：文件导航隐藏，仅剩 `» / hunk / close`，关闭 right=771；
- 胶囊焦点按 Enter 从 `1/5` 切到 `2/5`；
- 快速搜索 `n → note` 只显示最终查询结果；搜索打开时切换
  “显示隐藏文件”会重新搜索并加入 `.hidden-note.txt`；
- unversioned 组 gitignore disabled 时，`»` 首焦点仍落在“暂存所选”，
  下键不会停在 disabled 项，Esc 回焦。

## 2026-11-15 — Changes 组头双动作在窄窗收进 `»`

**作用域**：Commit Changes 的 staged / unstaged / unversioned 组头动作、200px 最小工具窗。

**症状/证据**：

- 200px Commit 工具窗中，`未纳入版本控制` 组头的
  `暂存所选 / 添加到 .gitignore` 两个按钮右边界到 562px；
- 组头/面板右边界为 517px，两个动作被裁出 45px，鼠标不可达；
- staged / unstaged 各只有一个组头动作，原本可以完整显示。

**修复**：

- 组头动作统一由 `groupActions` 描述；
- 单动作组继续渲染直接按钮；
- 双动作组同时渲染宽窗直接按钮与窄窗 `»` 按钮，240px 以下由容器规则
  隐藏直接按钮、显示 `»`，并隐藏该组次要文件数；
- `»` 复用 `ContextMenu`，菜单项保持 `暂存所选 / 添加到 .gitignore`
  原顺序和 disabled 语义；
- 宽窗恢复到 240px 以上时直接按钮和文件数自动恢复。

**回归**：

```bash
node --check lib/client.js
node --test tests/round243.test.mjs tests/round240.test.mjs \
  tests/round187.test.mjs tests/static-order.test.mjs
npm test
git diff --check
```

- RED：round243 初始 3 fail；
- 修复后目标回归 **14 pass / 0 fail**；
- 全量 **961 pass / 0 fail**；`git diff --check` 通过。

**运行态**（隔离 DSH，200px / 320px）：

- 200px：
  - staged 保留 `取消暂存所选`，右边界 509px；
  - unstaged 保留 `暂存所选`，右边界 509px；
  - unversioned 只显示 `»`，右边界 509px，文件数 `display:none`；
  - `»` 菜单顺序为 `暂存所选 / 添加到 .gitignore`，两项可用；
  - Esc 关闭菜单并把焦点返回 `»`。
- 320px：unversioned 恢复两个直接按钮，文件数重新显示，所有动作在 637px
  面板边界内。

## 2026-11-15 — Project speed search 覆盖折叠目录

**作用域**：Project `⌘/Ctrl+F` speed search、宿主 `fs` 路由、折叠目录中的文件导航。

**症状/根因**：

- speed search 只过滤 `flattenRows()` 已产生的可见行；
- 目录折叠后，其子项尚未加载，搜索 `note` 会把真实存在的
  `docs/note.txt` 错报为「无匹配」；
- 客户端的行过滤无法知道未加载目录内容，必须在宿主侧补递归名称搜索。

**修复**：

- `fs` 路由增加 `op: 'search'`；
- `searchWorkspaceEntries()` 复用 `listDirectory()`，因此 hidden / excluded /
  symlink 语义与 Project 树一致；
- 搜索跳过 `WALK_IGNORED` 重型目录，最多返回 200 条并限制访问 50,000 项；
- 客户端输入后 160ms 防抖请求宿主，并用递增 request id 丢弃过期响应；
- `searchEntryRows()` 用宿主命中合成父目录链，所有键盘导航继续复用
  `speedSearchHitRows()` / `speedSearchTarget()`；
- 搜索等待期间不显示「无匹配」；宿主失败时保留已加载行的本地过滤结果并显示
  错误，不把树清空。

**回归**：

```bash
node --check lib/client.js
node --check lib/index.js
node --test tests/round242.test.mjs tests/round231.test.mjs \
  tests/round116.test.mjs tests/client-pure.test.mjs tests/static-order.test.mjs
npm test
git diff --check
```

- RED：round242 初始 4 fail（缺少宿主 search、客户端合成树和接线）；
- 修复后目标回归 **22 pass / 0 fail**；
- 全量 **958 pass / 0 fail**；`git diff --check` 通过。

**运行态**（隔离 DSH，workspace `r219-fixture`）：

- `docs` 保持折叠时搜索 `note`，显示根 / `docs` / `note.txt`；
- `note.txt` 自动成为当前行，父目录显示展开态，不再出现「无匹配」；
- Enter 后搜索框关闭、`note.txt` 打开且 Monaco 显示 `project file`、
  键盘焦点回到 Project 树；
- 无命中查询在等待期间不显示「无匹配」，宿主返回后才显示；清空恢复完整树，
  Esc 后焦点回到 Project 树；
- 页面无搜索错误。

**环境**：DSH web + ego-browser；macOS 锁屏继续阻塞 IDEA 实窗复查。

## 2026-11-15 — Changes 最小宽度优先保留文件身份

**作用域**：Commit Changes 窄工具窗、行数统计、文件行网格。

**症状/边界**：

- 已有 210px 规则只保留主要一侧行数，但工具窗最小宽度约 200px；
- 长文件名与剩余行数仍可能在 190–205px 区间争夺空间；
- 旧工程记忆记录了“窄于约 190px 时固定行数列可能被裁”的边界。

**修复**：

- 新增容器规则：
  `@container dsh-editor-side (max-width: 205px)`；
- 在该宽度下整体隐藏 `.dsh-editor-line-counts`；
- 文件名称、状态、复选框与父路径优先保留，完整 `+N −M` 仍在行
  tooltip 中；
- 更宽窗口继续沿用 210px 的单侧计数规则和正常双计数。

**回归**：

```bash
node --check lib/client.js
node --test tests/round240.test.mjs tests/round182.test.mjs tests/static-order.test.mjs
npm test
git diff --check
```

- RED：round240 初始缺 205px 规则，目标 1 fail；
- 修复后目标回归 **9 pass / 0 fail**；
- 全量 **954 pass / 0 fail**。

**运行态**（隔离 DSH，Commit width=14% -> 200px）：

- action bar 宽 200px，所有动作右边界仍在工具条内；
- `conflict.txt` 行仍完整显示文件名与状态列；
- `.dsh-editor-line-counts` 的计算样式为 `display:none`；
- 没有出现行数被裁到面板外的横向溢出。

**旧边界更新**：2026-11-12 条目中的 `<190px` 行数裁切风险已由本规则解决。

## 2026-11-15 — Terminal Move to Editor 单一视图

**作用域**：Terminal Dock、Move to Editor、Return to Dock、workspace scope。

**症状/根因**：

- 终端移动到编辑区后，Dock 和编辑区同时出现可见 `Terminal input`；
- `active` / `splitTerminal` 从全部 terminals 查找，而不是 dockTerminals；
- 移动 active 标签后没有选择剩余 Dock 标签；
- Return 只派发 window event，Dock 关闭时 TerminalPanel 未挂载，事件丢失。

**修复**：

- Dock 的 active/split 终端仅从 `dockTerminals` 解析；
- 移动 active 标签时激活另一个 Dock 标签或清空活动屏；
- 返回时设置该标签为 Dock active；
- EditorWorkspace 直接移除 editor placement、写回 localStorage、派发兼容事件，
  并打开/聚焦 Dock。

**回归**：

```bash
node --check lib/client.js
node --test tests/round237.test.mjs tests/round165.test.mjs \
  tests/round25.test.mjs tests/static-order.test.mjs
npm test
git diff --check
```

- RED：round237 初始 4 fail；
- 修复后目标回归 **19 pass / 0 fail**；
- 全量 **952 pass / 0 fail**。

**运行态**（隔离 DSH，workspace B）：

- profile/colors/editor placement 均使用 `workspace:r220-workspace-b`；
- 移动后只有 1 个可见 Terminal input；
- 返回 Dock 后自动打开 Dock、1 个 tab、仍只有 1 个可见 xterm，
  editor placement 为 `[]`。

**环境**：DSH web + ego-browser；macOS 锁屏仅影响 IDEA 实窗复查。

## 2026-11-15 — 过滤自动展开被折叠的当前 Change

**作用域**：Commit Changes 路径过滤、折叠组/目录、当前行、diff/Group by reveal。

**症状/根因**：

- `filteredTargets` 表示查询命中的 change，不等于折叠树中的可见行；
- 组或目录折叠时，Round 233 的自动选中仍可能落到隐藏 identity；
- diff 导航和 Group by 各自实现同一套 group/ancestor reveal，容易漂移。

**修复**：

- 新增共享 `revealChangeRow(target)`：
  - `changeRowGroup()` 计算分组；
  - `revealCollapseKeys()` 计算折叠键；
  - 删除键并写回 collapsedGroups。
- diff file navigation、Group by 切换、Changes 路径过滤统一调用该回调；
- CommitPanel 自动选择 filtered target 前先调用 `onRevealChange`。

**回归**：

```bash
node --check lib/client.js
node --test tests/round236.test.mjs tests/round224.test.mjs \
  tests/round234.test.mjs tests/round233.test.mjs tests/static-order.test.mjs
npm test
git diff --check
```

- RED：round236 初始 3 fail；
- 修复后目标回归 **16 pass / 0 fail**；
- 全量 **948 pass / 0 fail**。

**运行态**（隔离 DSH，端口 63099）：

- 折叠 `未纳入版本控制` 组后，文件行不在 DOM；
- 过滤 `alpha` 后组自动展开，`filter-alpha.txt` 成为当前行；
- 焦点仍在路径过滤输入框，collapsedGroups 清空。

**环境**：DSH web + ego-browser；临时 filter fixture 验证后移出仓库。

## 2026-11-15 — 提交信息历史下拉

**作用域**：Commit 提交信息输入框、最近 20 条消息历史、快捷键与焦点。

**IDEA 证据**：

- Commit 输入框工具栏包含 `Commit Message History`；
- 该按钮只选择已使用的提交文本，不直接提交或修改仓库。

**症状/缺口**：

- DSH 只有首行 `↑` / 末行 `↓` 回溯，没有显式入口；
- 用户不知道快捷键时无法发现历史；
- 只能逐条走，无法在列表中直接选一条。

**修复**：

- 新增 `commitMessageHistory` 中英文案与 `history` 时钟图标；
- CommitPanel 在 Amend 行右侧增加历史按钮，空历史禁用；
- 点击后复用 ContextMenu 显示每条消息首行，子项 `restoreFocus:false`；
- `selectHistoryMessage(index)` 保存当前草稿、设置 `historyIndex`、写入 textarea；
- 选择后把焦点送回 textarea，后续 `↓` 仍可回到原草稿。

**回归**：

```bash
node --check lib/client.js
node --test tests/round235.test.mjs tests/round25.test.mjs \
  tests/round182.test.mjs tests/round129.test.mjs tests/static-order.test.mjs
npm test
git diff --check
```

- RED：round235 初始 4 fail；
- 修复后目标回归 **21 pass / 0 fail**；
- 全量 **945 pass / 0 fail**。

**运行态**（隔离 DSH，端口 63099）：

- 预置三条提交信息历史并输入草稿 `draft text`；
- 打开 `提交信息历史`，选择 `docs: older subject`；
- textarea 值变为该消息，焦点仍在 textarea；
- 连续 `↓` 后恢复 `draft text`。

**环境**：DSH web + ego-browser；测试历史仅写入隔离 localStorage。

## 2026-11-15 — Group by 切换保留当前行

**作用域**：Commit Changes Group by、折叠键、当前行与键盘焦点。

**症状/根因**：

- Group by 仅改变 `changeTreeOf` 的深度，没有处理旧分组留下的折叠键；
- 目录模式的 `unversioned:deep/inner` 在切换模块模式后仍可隐藏目标；
- ContextMenu 关闭会尝试恢复触发器焦点，可能覆盖新树的当前行焦点；
- unversioned 的 staged 身份散落在 diff 导航与分组 reveal 两处。

**修复**：

- 新增 `changeRowGroup(change, staged)` 统一分组身份；
- `applyChangeGroupBy(mode)` 持久化模式、清除目标路径的
  group/ancestor collapse keys、记录待聚焦目标；
- `groupByFocusRef` effect 在新树提交后按 row key 聚焦；row-ref 缺失时用
  `data-dsh-change-path + data-dsh-change-staged` 找到同一行；
- Group by 菜单子项设 `restoreFocus:false`，避免菜单 cleanup 抢回焦点；
- `navigateDiffFile` 复用 `changeRowGroup()`。

**回归**：

```bash
node --check lib/client.js
node --test tests/round234.test.mjs tests/round146.test.mjs \
  tests/round224.test.mjs tests/static-order.test.mjs
npm test
git diff --check
```

- RED：round234 初始 3 fail；
- 修复后目标回归 **18 pass / 0 fail**；
- 全量 **941 pass / 0 fail**。

**运行态**（隔离 DSH，端口 63099）：

- 目录模式选中 `deep/inner/filter-target.txt`，折叠 `inner`；
- 切换到按模块后目标行可见、`aria-selected=true`；
- localStorage `collapsedGroups=[]`；
- 焦点落在 `[data-dsh-change-path="deep/inner/filter-target.txt"]`。

**环境**：DSH web + ego-browser；测试 fixture 的嵌套文件验证后移出仓库。

## 2026-11-15 — Changes 过滤当前行与方向键

**作用域**：Commit Changes 路径过滤、当前行、Show Diff/Stage/Rollback 目标、
提交复选框。

**症状/根因**：

- 过滤只影响 `visibleGroups`，没有校正 `selectedChange`；
- 当原当前行被过滤隐藏时，快捷键与工具栏仍可能按旧 identity 操作；
- 过滤输入框的上下方向键没有命中导航，用户必须离开输入框。

**修复**：

- `changeFilterTargets(groups)` 将当前可见组扁平化为带 staged 身份的目标；
- `cycleChangeTarget(targets, current, direction)` 在可见目标内循环，当前目标
  不在集合时回退首个；
- CommitPanel 在非空过滤下自动选择首个可见目标；
- 过滤框 `↑/↓` 调用同一 helper，保持输入焦点；
- 只更新当前行与 anchor，`selectedPaths` 的提交勾选保持不变。

**回归**：

```bash
node --check lib/client.js
node --test tests/round233.test.mjs tests/round226.test.mjs \
  tests/round227.test.mjs tests/round167.test.mjs tests/static-order.test.mjs
npm test
git diff --check
```

- RED：round233 初始 4 fail；
- 修复后目标回归 **17 pass / 0 fail**；
- 全量 **938 pass / 0 fail**。

**运行态**（隔离 DSH，端口 63099）：

- 三个更改（1 staged + 2 unversioned）初始均勾选；
- 过滤 `filter`：alpha 自动成为当前行，alpha/beta 仍 checked，焦点在过滤框；
- `↓`：beta 成为当前行，焦点仍在过滤框；
- 先选 `conflict.txt` 再过滤 `alpha`：当前行自动切到
  `filter-alpha.txt`，旧隐藏行不再充当动作目标。

**环境**：DSH web + ego-browser；临时 fixture 文件验证后移出仓库。

## 2026-11-15 — Changes 工具栏 View Options

**作用域**：Commit Changes 动作条、Group by、本地化文案。

**IDEA 证据**：

- Changes Action Toolbar 包含 `View Options`；
- Group by 是 change list 的视图偏好，不能要求用户切到工具窗口顶部菜单。

**症状/缺口**：

- DSH 仅在 Commit Options 中提供 Group by；
- Changes 动作条没有 IDEA 的 View Options 入口；
- 直接复制一份 Group by 状态会形成两个持久化源。

**修复**：

- 新增中英文 `viewOptions` 文案；
- Changes action list 在 Show Diff 后增加 `视图选项`，使用设置图标；
- 新入口调用 `openChangesViewMenu()`，菜单内复用 `changeGroupMenu()` 的
  `items`，因此 `flat / module / directory` 和当前 `✓` 只有一个来源；
- CommitPanel 新增 `onViewOptionsMenu` prop，由 EditorWorkspace 注入。

**回归**：

```bash
node --check lib/client.js
node --test tests/round232.test.mjs tests/round146.test.mjs \
  tests/round186.test.mjs tests/round171.test.mjs tests/static-order.test.mjs
npm test
git diff --check
```

- RED：round232 初始 3 fail；
- 修复后目标回归 **24 pass / 0 fail**；
- 全量 **934 pass / 0 fail**。

**运行态**（隔离 DSH，端口 63099）：

- Changes 动作条显示 `视图选项`；
- 点击后菜单为 `视图选项 → 更改列表的分组方式`；
- 子菜单为 `不分组 / 按模块 / 按目录 ✓`；
- 选择 `不分组` 后菜单关闭，localStorage
  `dsh-editor.commit.groupBy=flat`；
- 验证后恢复为 `directory`。

**环境**：DSH web + ego-browser；macOS 锁屏阻止 IDEA 实窗复查，采用既有 AX
记录作为 IDEA 证据。

## 2026-11-15 — Project speed search 当前行与方向键

**作用域**：Project 树 `⌘/Ctrl+F` speed search、过滤结果、当前行与键盘焦点。

**症状/根因**：

- 过滤只生成 `visibleRows`，没有把当前行移动到真实命中；
- Enter 固定读取 `visibleRows.find(...)`，所以用户无法先选择第二个命中；
- `visibleRows` 为保留树结构还包含仅作为父链出现的目录，若直接导航会停在
  没有名称匹配的目录上。

**修复**：

- `speedSearchHitRows(rows, query)` 只返回真实匹配的文件/目录，排除根路径和
  placeholder；
- `speedSearchTarget(rows, query, currentPath, direction)` 负责 first / next /
  previous，并在命中集合内循环；
- 查询变化时若当前行不是命中，选择首个命中并滚入可见区；
- 搜索框 `↑/↓` 调用同一 target 函数并保持输入焦点；
- Enter 打开当前命中；Esc 和 `×` 共用关闭函数并把焦点还给 Project 树。

**回归**：

```bash
node --check lib/client.js
node --test tests/round231.test.mjs tests/round79.test.mjs \
  tests/round96.test.mjs tests/round116.test.mjs \
  tests/round134.test.mjs tests/client-pure.test.mjs tests/static-order.test.mjs
npm test
git diff --check
```

- RED：round231 四项失败；旧契约 round79/96/134 也需从旧源码结构迁移；
- 修复后目标回归 **20 pass / 0 fail**；
- 全量 **931 pass / 0 fail**。

**运行态**（隔离 DSH，端口 63099）：

- fixture 有 `conflict-a.txt`、`conflict-b.txt`、`conflict.txt` 三个命中；
- 输入 `conflict`：筛出三个文件，`conflict-a.txt` 自动选中，焦点仍在输入框；
- 按 `↓`：唯一选中项变为 `conflict-b.txt`；
- Enter：搜索框关闭，打开 `conflict-b.txt`，焦点回到 `role=tree`；
- 再搜索后 Esc：搜索值清空，`conflict-b.txt` 保持选中，焦点回到树。

**环境**：DSH web + ego-browser；本轮 macOS 锁屏，IDEA 实窗读取被系统拦截，
交互语义沿用已有 IDEA speed-search 证据，DSH 侧全部以真实页面状态验证。

## 2026-11-15 — 差异工具栏宽度迟滞

**作用域**：Commit diff 次要动作、`»` 溢出、工具窗口/浏览器缩放。

**症状/根因**：

- diff toolbar 每次测量都直接写 `node.clientWidth < 520`；
- 当分栏停在 520px 附近时，亚像素宽度变化会让 React 在完整动作条与
  `»` 菜单之间反复切换；
- 菜单锚点可能在打开时被卸载，键盘焦点也会跳到另一个按钮集合。

**修复**：

- 新增纯函数 `diffActionsCompactForWidth(width, currentlyCompact)`：
  展开态低于 520px 收起，收起态只有达到 536px 才展开；
- `ResizeObserver`、`mousemove` 和 `resize` 回退路径统一用函数式状态更新
  读取当前模式，保持单一判定入口；
- 更新 round197/221 的旧固定阈值契约。

**回归**：

```bash
node --check lib/client.js
node --test tests/round230.test.mjs tests/round221.test.mjs \
  tests/round197.test.mjs tests/round200.test.mjs tests/static-order.test.mjs
npm test
git diff --check
```

- RED：round230 缺 helper 与测量接线；
- 修复后目标回归 **12 pass / 0 fail**；
- 全量 **927 pass / 0 fail**。

**运行态**（隔离 DSH，端口 63099，CDP 视口扫描）：

- 收起态：viewport 1400/1440/1460/1480/1500 对应工具栏宽
  `485/511/524/537/550`，`485–537` 保持 `»`，`550` 展开；
- 展开态：`550 → 517.5` 仍保持直接动作，降到 `485` 才收进 `»`；
- 默认 1280px 窗口中仍正确显示 `»`，菜单内的查找、双栏、空白和 undo/redo
  动作均可访问。

**环境**：macOS Chromium/DSH web，`dsh 0.2.2-rc.2`；使用
`Emulation.setDeviceMetricsOverride` 仅改变测试视口，不改用户窗口设置。

## 2026-11-15 — 冲突解决后选中结果行并归还焦点

**作用域**：Commit Changes 冲突右键、`resolve` 刷新后的行选择、键盘焦点。

**IDEA 证据**：

- IDEA 的 Changes 树始终保留一个当前行；
- 冲突解决完成后面向的是新索引状态，继续按 `⌘⇧A` / `⌥⌘A`、方向键或
  `⌘D` 时应直接作用于该文件，而不是让选择停留在已消失的冲突身份上。

**症状/根因**：

- `resolveConflict()` 收到 Git 返回的新快照后只 `setGit(value)`；
- 旧 `selectedChange` / `selectedChanges` 仍指向 `UU` 的 `staged/unstaged`
  组合身份；
- 刷新后没有新的行焦点，右键菜单关闭后键盘所有权不明确。

**修复**：

- 用 `resolvedPaths` 在新 `changes` 中定位本次路径；
- 新状态位于 index 侧时设置 `selectedChange` 和单行 `selectedChanges`，
  同步 `selectedChangesRef` 与 `changeSelectionAnchorRef`；
- `await refreshTree()` 后通过 `changeRowRefs` 找到刷新后的
  `staged:<path>` 行并聚焦；
- 沿用现有选择与 row-ref 数据流，不新增持久状态或 DOM 查询源。

**回归**：

```bash
node --check lib/client.js
node --test tests/round229.test.mjs tests/round228.test.mjs \
  tests/round227.test.mjs tests/round226.test.mjs tests/static-order.test.mjs
npm test
git diff --check
```

- RED：round229 初始 2 fail（缺结果行选中、缺刷新后焦点归还）；
- 修复后目标回归 **12 pass / 0 fail**；
- 全量 **925 pass / 0 fail**。

**运行态**（隔离 conflicted fixture，端口 63099）：

- 初始 `git status --short` 为 `UU conflict.txt`；
- 右键菜单执行 `解决冲突 › 接受传入更改`；
- 刷新后只有 `staged=true` 的 `M conflict.txt` 行，`aria-selected=true`、
  `tabindex=0`；
- `document.activeElement` 的 `data-dsh-change-path=conflict.txt`，
  键盘可立即继续操作；
- fixture 保留 merge 现场，未提交或改写仓库历史。

## 2026-11-14 — 冲突解决收进 Commit 文件子菜单

**作用域**：Commit Changes 冲突文件右键、Accept Yours/Theirs、Git index 后果。

**IDEA 证据**：

- `changes.nodetitle.merge.conflicts=Merge Conflicts`；
- `changes.view.conflicts.banner.default.resolve.action=Resolve…`；
- 合并工具文案 `multiple.file.merge.dialog.command.name.accept.yours=Accept Yours`、
  `...accept.theirs=Accept Theirs`。

**症状/缺口**：

- 当前 DSH 把 Accept Yours/Theirs 作为两个平铺项插在 Stage 与 Rollback 之间；
- 动作位置与普通 changelist 操作混在一起，不能体现“先 Resolve，再选边”的层级。

**修复**：

- 冲突时在 `Open in Editor` 后增加 `解决冲突 ›` 子菜单；
- 子菜单复用现有 `resolveConflict(paths, 'ours'|'theirs')`；
- 移除原平铺的 acceptOurs/acceptTheirs 项；
- 非冲突文件不显示该子菜单；多选冲突仍对整组路径执行同一侧解析。

**回归**：

```bash
node --check lib/client.js
node --test tests/round228.test.mjs tests/round222.test.mjs \
  tests/round223.test.mjs tests/round225.test.mjs tests/static-order.test.mjs
npm test
git diff --check
```

- RED：round228 初始缺 `resolveConflicts` 文案与子菜单结构；
- 修复后目标回归 **14 pass / 0 fail**；全量 **923 pass / 0 fail**。

**运行态**（隔离 conflicted git fixture，workspace C）：

- 初始冲突文件 `conflict.txt` 状态为 `UU`；
- 菜单顶层为 `显示差异 / 在编辑器中打开 / 解决冲突› / 与修订比较… / …`；
- 子菜单为 `接受当前更改 / 接受传入更改`；
- 执行「接受传入更改」后 Git 状态变为已暂存 `M `，冲突标记消失，
  工作区内容采用 side 版本；
- 临时 merge 已 abort，fixture 恢复。

## 2026-11-14 — Changes 过滤清除后的焦点归还

**作用域**：Commit Changes 路径过滤、Esc/清除按钮、Changes 树键盘导航。

**症状/根因**：

- 过滤输入框按 Esc 或点 `×` 只把 `pathQuery` 清空；
- 焦点仍留在输入框，用户继续按方向键时 Changes 树没有键盘所有权；
- 目标行被过滤隐藏时也没有合理的回退焦点位置。

**修复**：

- `CommitPanel` 新增 `clearChangeFilter()`；
- 清空过滤后优先聚焦当前 `selectedChange` 对应行；
- 行已因过滤被卸载或断开时，回退聚焦 `scrollRefs.changes.current`（Changes tree 容器）；
- Esc 与 `×` 共用该函数，全部通过 `requestAnimationFrame` 后的 `setTimeout(0)` 等待 React 重绘。

**回归**：

```bash
node --check lib/client.js
node --test tests/round227.test.mjs tests/round226.test.mjs \
  tests/round147.test.mjs tests/static-order.test.mjs
npm test
git diff --check
```

- RED：round227 初始缺 `clearChangeFilter()` 与焦点回退；
- 修复后目标回归 **20 pass / 0 fail**；全量 **921 pass / 0 fail**。

**运行态**（隔离 workspace B，端口 63098）：

- 过滤 `untracked` 后按 Esc：过滤值为空，`activeElement.role=tree`；
- 再次过滤后点击 `×`：过滤值为空，`activeElement.role=tree`；
- 两种路径都不会把焦点留成 `body` 或已卸载输入框。

## 2026-11-14 — diff 文件导航跟随路径过滤

**作用域**：Commit Changes 路径过滤、单 diff 标签文件导航、`⌃⇧← / ⌃⇧→`。

**症状/根因**：

- Changes 路径过滤只收窄了可见树，`diffChangeSequence` 仍使用全量 changes；
- 当前文件被过滤隐藏时仍显示 `1/N`，下一次导航还可能跳到用户看不见的文件。

**修复**：

- 新增纯函数 `filterChangeSequence(sequence, query)`：
  大小写不敏感、只按 path 过滤、保留原提交顺序与 staged/working 身份；
- `diffChangeSequence` 先算全量 Changes 顺序，再用当前 `pathQuery` 过滤；
- `diffFilePosition` 自然跟随结果：当前目标被过滤掉时返回 null，文件导航区域隐藏；
- 清空过滤后恢复完整序列和原计数。

**回归**：

```bash
node --check lib/client.js
node --test tests/round226.test.mjs tests/round225.test.mjs \
  tests/round224.test.mjs tests/round167.test.mjs tests/static-order.test.mjs
npm test
git diff --check
```

- RED：round226 初始缺 `filterChangeSequence()`，且序列未依赖 `pathQuery`；
- 修复后目标回归 **15 pass / 0 fail**；全量 **919 pass / 0 fail**。

**运行态**（隔离 workspace B，端口 63098）：

- 无过滤：README diff 显示 `1/2`，可见行 README + untracked-b；
- 过滤 `untracked`：README diff 保持打开，文件导航隐藏，可见行只剩 untracked-b；
- 过滤 `README`：文件导航为 `1/1`，可见行只剩 README；
- 清空过滤：恢复 `1/2`，两行重新可见。

## 2026-11-14 — Commit 文件比较动作与 Terminal 三 scope 审计

**作用域**：Commit Changes 文件右键、修订/剪贴板 diff、Terminal workspace/session registry。

**实现**：

- Commit 文件菜单新增：
  - `与修订比较…` → 复用 `compareWithRevision(path)` 与既有 revision picker；
  - `与剪贴板比较` → 复用 `compareWithClipboard(path)`；
- 两项都只对单文件启用，多选 `paths.length > 1` 时禁用；
- 菜单依赖数组同步加入两个回调。

**Terminal scope 审计**（隔离 DSH，端口 63098）：

- workspace B：terminal id `32ba73d7…`，registry key
  `workspace:r220-workspace-b`，cwd 为 fixture B；
- workspace A：terminal id `a19f2d8e…`，registry key
  `workspace:r219-workspace`，cwd 为 fixture A；
- 再切回 B 时 B 的原 terminal id 仍在，A 不覆盖 B；
- 普通 session 入口（Editor root 无 workspaceId）：terminal id `e49049b4…`，
  registry key 为 session id；workspace A 的原终端仍独立保留。
- IDEA 对照：Terminal 属于当前 Project/会话工作面，Project 切换不应复用另一项目的 shell。

**运行态（Commit 菜单）**：

- `README.md` 右键菜单顺序：
  显示差异 / 在编辑器中打开 / 与修订比较… / 与剪贴板比较 /
  暂存所选 / 回滚更改 / 显示历史 / 在 Project 中定位 /
  在终端中打开 / 复制相对路径；
- 点击「与修订比较…」打开 `role=dialog` 的 revision picker，并列出当前提交。

**回归**：

```bash
node --check lib/client.js
node --test tests/round225.test.mjs tests/round224.test.mjs \
  tests/round223.test.mjs tests/round222.test.mjs tests/round86.test.mjs tests/static-order.test.mjs
npm test
git diff --check
```

- RED：round225 初始缺少两个比较动作；实现后目标回归 **17 pass / 0 fail**。
- 全量：**917 pass / 0 fail**。

## 2026-11-14 — diff 文件导航自动展开隐藏目标

**作用域**：Commit diff 的 `⌃⇧← / ⌃⇧→`、Changes 分组/目录折叠、折叠状态持久化。

**症状/根因**：

- 折叠“未纳入版本控制”组或目标目录后，从另一个 diff 使用文件导航，
  `chooseChange()` 能更新选中身份，但对应行被折叠，视觉上像没有跳转；
- 原导航只更新 `diffTarget`，没有把目标文件所在的组和祖先目录从
  `collapsedGroups` 中移除。

**修复**：

- 新增纯函数 `revealCollapseKeys(group, path)`：返回组 key 及每一级祖先目录 key；
- `navigateDiffFile()` 在 `chooseChange()` 之前按目标身份确定
  `staged / unstaged / unversioned` 组，删除这些折叠 key；
- 折叠集合实际发生变化时调用 `writeCollapsedGroups(root, revealed)`，
  让自动展开在刷新后仍然有效；
- 没有折叠变化时返回原 Set，避免无意义重渲染。

**回归**：

```bash
node --check lib/client.js
node --test tests/round224.test.mjs tests/round223.test.mjs \
  tests/round222.test.mjs tests/round71.test.mjs tests/static-order.test.mjs
npm test
git diff --check
```

- RED：round224 初始缺 `revealCollapseKeys()` 与导航前展开步骤；
- 修复后目标回归 **15 pass / 0 fail**；全量 **915 pass / 0 fail**。

**运行态**（隔离 workspace B，端口 63098）：

- 初始折叠“未纳入版本控制”，`untracked-b.txt` 行不可见；
- 打开 `README.md` diff 后按 `⌃⇧→`；
- 未跟踪组自动展开，`untracked-b.txt` 可见且 `aria-selected=true`；
- 文件计数变为 `2/2`，diff 标题切换为 `untracked-b.txt`；
- `collapsedGroups` localStorage 被清为空数组。

## 2026-11-14 — 未跟踪文件右键补 Add to .gitignore

**作用域**：Commit Changes 文件右键、未纳入版本控制组、`.gitignore` 写入。

**症状/缺口**：

- 组头已有「添加到 .gitignore」，但单独右键未跟踪文件没有该动作；
- `addToGitignore` 回调原先定义在 `buildChangeMenu` 之后，直接把回调加入菜单依赖会触发 TDZ。

**修复**：

- 把 `addToGitignore` 回调前移到 `buildChangeMenu` 之前；
- 只有选区里的文件全部是 `??` 时显示「添加到 .gitignore」，动作对当前全部路径执行；
- 已跟踪/混合选区不显示该动作，避免把普通工作区修改静默加入 ignore。

**IDEA 对照**：

- 未跟踪文件在 IDEA Changes 中可从行级菜单加入 ignore；
- 该动作只改变仓库忽略规则，不直接删除磁盘文件。

**回归**：

```bash
node --check lib/client.js
node --test tests/round223.test.mjs tests/round222.test.mjs \
  tests/git-ignore.test.mjs tests/commit-round12.test.mjs tests/static-order.test.mjs
npm test
git diff --check
```

- RED：round223 同时报告菜单缺项和 `addToGitignore` 定义晚于菜单；
- 修复后目标回归 **16 pass / 0 fail**；全量 **913 pass / 0 fail**。

**运行态**（隔离 workspace B，端口 63098）：

- `README.md`（已跟踪）菜单不含该动作；
- `untracked-b.txt` 菜单含「添加到 .gitignore」；
- 执行后写入 `.gitignore` 内容 `untracked-b.txt`，Change 列表变为
  `README.md + .gitignore`，磁盘上的被忽略文件仍保留；
- 测试 fixture 的临时 `.gitignore` 已移除，恢复为 `M README.md + ?? untracked-b.txt`。

## 2026-11-14 — Commit 文件菜单补齐 IDEA 动作，终端改为 workspace scope

**作用域**：Commit Changes 文件右键、历史/Project/Terminal 跳转、Terminal PTY registry、终端本地偏好。

**IDEA 证据**：

- IDEA 动作资源包含 `Show History`、`Select in Project View`、`Open in Terminal`；
  Commit 文件菜单应能以单行目标执行这些动作，多选时不伪造单文件语义。

**症状/根因**：

- 插件 Commit 文件右键此前只有 Diff/Open/Stage/Rollback/Copy 五项。
- 从 workspace B 的 Commit 菜单点「在终端中打开」后，PTY cwd 落在当前聊天会话所属的
  workspace A。根因是 Terminal API 仍只用 `sessionId`，`TerminalHub` 和 localStorage
  偏好也都按 session 分键；显式 workspace 入口没有自己的终端 scope。

**修复**：

- Commit 文件菜单新增：
  - 显示历史 → 现有 `showFileHistory(path)`；
  - 在 Project 中定位 → 现有 `revealPath(path)`；
  - 在终端中打开 → `openInTerminal(dirname(path))`。
  多选时三项禁用；批量 Stage/Rollback 保持原语义。
- 宿主新增 `terminalScopeForRequest()`：
  - 显式 `workspaceId` → `workspace:<id>`；
  - 否则回落到原 `sessionId`。
- Terminal create/list/write/resize/rename/reorder/close 与 SSE stream 全走同一 scope；
  Host 根目录仍通过 `workspaceRootForRequest()` 的 allow-list 解析。
- 浏览器新增 `currentTerminalScope()`；`callTerminal` 和 stream URL 透传 workspaceId，
  profile/closed/editor-placement/colors 的 localStorage 键也按同一 scope 隔离。

**回归**：

```bash
node --check lib/client.js
node --check lib/index.js
node --test tests/round222.test.mjs tests/plugin-contract.test.mjs \
  tests/round123.test.mjs tests/round149.test.mjs tests/round193.test.mjs \
  tests/static-order.test.mjs
npm test
git diff --check
```

- RED：round222 初始缺三项菜单动作与 `terminalScopeForRequest()`；随后旧终端偏好测试按 session key 失败。
- 修复后目标回归 **26 pass / 0 fail**；全量 **911 pass / 0 fail**。

**运行态**（隔离 workspace B，端口 63098）：

- 单文件菜单顺序：显示差异 / 在编辑器中打开 / 暂存所选 / 回滚更改 /
  显示历史 / 在 Project 中定位 / 在终端中打开 / 复制相对路径；
- 多选 2 行时后三项 `disabled=true`；
- 显示历史切到日志页并显示 `文件历史: README.md`；
- 在 Project 中定位切到 Project 并选中 `README.md`；
- 在终端中打开后 Terminal API registry key 为 `workspace:r220-workspace-b`，
  PTY cwd 为 `/private/tmp/dsh-editor-r220-fixture-b-…`，不再使用会话 A 的目录。

## 2026-11-14 — workspace registry 惰性解析与窄 diff 工具栏溢出

**作用域**：workspace-aware Project/Commit API、无会话工作区、Commit diff 工具栏。

**症状**：

- 工作区 B 已出现在左侧树中，但右键 Editor 后 Commit 显示 `0` 个更改；
  直接请求 `/api/dsh-editor/git` 返回 `workspace "r220-workspace-b" is not registered`。
- diff 宽 254px 时工具条内容右边界到 892px，而面板右边界只有 776px；
  关闭按钮、撤销/重做和多个 toggle 被 `overflow: hidden` 裁掉。

**根因**：

- 宿主在插件注入回调启动时执行 `const workspaceRegistry = ...`，把当次结果永久缓存。
  DSH 的 workspaceRegistry 可异步晚于插件激活，此时缓存的是 `null`；
  后续所有 workspaceId 请求都走 allow-list 失败，直到再次重启宿主碰巧赶上就绪时序。
- diff 次要动作的紧凑阈值是 210px；但文件导航新增 88px 后，254px 仍显示全部动作，
  fixed 控件从面板右侧溢出。

**修复**：

- `serviceOf()` 同时查询注入子 scope 与插件 context，兼容服务挂载位置。
- 新增 `workspaceRegistryNow()`；FS、Git、watch 每个请求都重新解析
  `workspaceRegistry` / `workspaces`，不再缓存启动时的 `null`。
- diff 次要动作阈值改为 520px：低于该宽度时收进 `»`，文件导航、hunk 胶囊和关闭按钮保持固定。

**IDEA 对照**：

- Computer Use 实窗确认 IDEA diff 顶部左侧显示 `1/38 files` 与前后文件按钮，
  右侧始终保留全屏/单栏和设置等末端动作；窄窗时次要动作进入溢出而不是裁掉末端控件。

**回归**：

```bash
node --check lib/index.js
node --check lib/client.js
node --test tests/round221.test.mjs tests/round219.test.mjs \
  tests/round197.test.mjs tests/round200.test.mjs tests/static-order.test.mjs
npm test
git diff --check
```

- RED：round221 同时复现启动时 registry 缓存和 210px 溢出阈值。
- 修复后目标回归 **17 pass / 0 fail**；全量 **907 pass / 0 fail**。

**运行态**（隔离 home，端口 63098）：

- workspace B 无独立活动会话，Git API 返回 `ok=true` 且 root 为 B 的真实路径；
  Changes 显示 `README.md` 和 `untracked-b.txt`，不再是 0。
- viewport 1044px / diff 254px：工具条无任何按钮越过面板右边界；
  `‹ 1/2 ›`、`»`、`1/1`、关闭按钮全部可见。
- viewport 990px / diff 219px：仍无越界，`‹ 1/2 ›`、`»`、`1/1`、关闭按钮保留。

## 2026-11-14 — Commit diff 增加 IDEA 跨文件导航，并修复未跟踪 diff 被状态轮询关闭

**作用域**：Commit Changes、单 diff 标签、文件导航、`git status` 轮询后的 diff 目标对账。

**IDEA 证据**：

- `intellij.platform.ide.impl.jar` 的动作文案：
  `action.Diff.PrevChange.text=Compare Previous File`、
  `action.Diff.NextChange.text=Compare Next File`。
- IDEA Find Action 实窗显示两个动作的默认快捷键为 `⌃⇧←` / `⌃⇧→`；
  组合 diff 标题栏显示当前文件和总数（例如 `1/37 files`）。

**症状/根因**：

- 插件此前只有 hunk 的 `F7 / ⇧F7` 导航，没有 IDEA 的“上一个/下一个更改文件”。
- 新增文件导航后运行态发现：切到 `??` 未跟踪文件的 diff 后，下一次状态轮询会立刻关闭。
- `loadGit()` 对账时把行的 `unstaged:` 选择命名空间只映射到
  `bands.unstaged`，但未跟踪文件实际在 `bands.unversioned`，因此被当成已消失。

**修复**：

- 新增纯函数 `changeSequenceOf()` / `changePositionOf()`：按 Changes 当前的
  Group by 顺序生成已暂存、未暂存、未纳入版本控制的文件序列；
  `MM` 的索引和工作区两侧是两个独立目标。
- Diff 标题栏显示 `‹ n/total ›`；按钮和 `⌃⇧← / ⌃⇧→` 共用同一条切文件路径，
  同步更新 Changes 选择并继续使用同一个 Commit diff 标签。
- 新增 `listedInChangeBand()`，让 `unstaged:` 命名空间同时认可
  `bands.unstaged` 与 `bands.unversioned`；diff 目标、当前行和批量选择的对账
  都走这一个判断，未跟踪 diff 不再被轮询错误关闭。

**回归**：

```bash
node --check lib/client.js
node --test tests/round220.test.mjs tests/round165.test.mjs \
  tests/round172.test.mjs tests/round203.test.mjs tests/round205.test.mjs
npm test
git diff --check
```

- RED：`round220` 初始因缺少 `changeSequenceOf()`、文件导航和 `listedInChangeBand()` 失败。
- 修复后目标回归 **19 pass / 0 fail**；全量 **904 pass / 0 fail**。

**运行态**（隔离 workspace B，端口 63098）：

- 打开 `README.md` 的未暂存 diff，标题栏显示 `1/2`；
- 点击“下一个文件”或按 `⌃⇧→` 切到 `untracked-b.txt`，显示 `2/2`，等待
  2.5 秒经过状态轮询后 diff 仍保持打开；
- 点击“上一个文件”或按 `⌃⇧←` 返回 `README.md`，显示 `1/2`；
- Changes 选中行随文件导航同步移动。

## 2026-11-14 — 工作区菜单打开 Editor 时绑定入口工作区

**作用域**：左侧工作区 `... → Editor` 入口、Project / Commit 的 workspace scope、文件监听。

**症状**：

- 在没有活动会话的工作区上右键 `... → Editor` 后，Project 只显示根行
  `Workspace`，没有真实文件列表。
- 从 A 工作区行打开 Editor 时，Project 仍可能显示当前会话所属的 B 工作区。

**根因**：

- FS / Git / watch API 只接受 `sessionId`，根目录由会话 `cwd` 反推。
- 工作区菜单入口没有把被点击行的 `data-row-key="workspace:<id>"` 传入 Editor；
  无活动会话时 `sessionId` 为空，`callFs` 直接失败，`root` 保持 `''`，
  根行因此回落到 `basename(root) || 'Workspace'`。

**修复**：

- 工作区菜单注入项在打开时记录点击行的 workspace id，并把 Editor React root
  的入口 scope 固定为该 workspace；切换入口 workspace 时重建 Editor root。
- Editor root 通过 `data-dsh-workspace-id` 携带 scope；`callFs` / `callGit` /
  `/watch` 均透传 `workspaceId`。
- 宿主新增 `workspaceRootForRequest()`：有 `workspaceId` 时通过
  `workspaceRegistry` 的 allow-list 解析路径，不再依赖 live session；只有
  workspaceId 缺失时才回落到原有 session cwd。
- 未知 workspace id 直接拒绝，浏览器不能借此读取任意绝对路径。

**回归**：

```bash
node --check lib/client.js
node --check lib/index.js
node --test tests/round219.test.mjs
npm test
git diff --check
```

- RED：`round219` 初始因 `workspaceRootForRequest` 尚未导出而失败。
- 修复后目标回归 **4 pass / 0 fail**；全量 **900 pass / 0 fail**。

**运行态**（隔离 home `/private/tmp/dsh-editor-r219-20261114-185936-home`，
fixture `/private/tmp/dsh-editor-r219-20261114-185936-fixture`，端口 63098）：

- workspace `sessionIds=[]`，没有活动会话；
- 右键 `r219-fixture` 工作区 → Editor；
- Editor root 的 `data-dsh-workspace-id=r219-workspace`；
- Project 显示真实根目录 `…/dsh-editor-r219-…-fixture` 及 `docs`、`src`、
  `README.md`，不再出现空 `Workspace`；
- 在 fixture 中修改 `README.md` 后切到 Commit，Changes 仍显示
  `README.md`（`+1 −0`），证明 Git status 也绑定同一入口 workspace。

**复用证据**：`docs/dsh-gufa-code` 已采用相同的 workspace-aware 入口思路
（记录 workspace key，再通过宿主 workspace registry 解析目标路径）。

## 2026-11-14 — Terminal 增加 Paste from History

**作用域**：Terminal 屏幕右键菜单、粘贴路径、历史去重。

**IDEA 证据**：

- `terminal.jar`：`action.Terminal.PasteFromHistory.text=Past_e from History…`。
- 该动作与 Paste 同级，用于复用最近粘贴内容。

**实现**：

- TerminalPanel 新增内存态 `pasteHistory`，最多 10 条，不写 localStorage；
- `pushPasteHistory()` 去重置顶；`pasteHistoryPreview()` 将换行显示为 `↵`
  并限制菜单文本长度；
- 普通菜单 Paste 和 `⌘⇧V` 成功后记录历史；
- 历史项复用 `writeTerminalText()` 的 multiline 确认与 PTY 写入，
  不再读取系统剪贴板；
- 空历史时不渲染“从历史粘贴…”子菜单。

**回归**：

```bash
node --check lib/client.js
node --test tests/round218.test.mjs tests/round34.test.mjs \
  tests/round41.test.mjs tests/round18.test.mjs \
  tests/terminal-round15.test.mjs tests/static-order.test.mjs
npm test
```

全量：**896 pass / 0 fail**；`git diff --check` 通过。

**运行态**（轻量 home，Ego Browser，63097）：

- stub `navigator.clipboard.readText()` 返回 `echo HISTORY_OK`；
- 第一次菜单 Paste 后，clipboard read 计数=1；
- 再次右键出现“从历史粘贴… › echo HISTORY_OK”；
- 选择历史项后 read 计数仍为 1，证明没有第二次读取系统剪贴板。

## 2026-11-14 — Commit 未跟踪文件使用删除语义

**作用域**：Commit Changes 右键 Rollback、确认文案。

**问题**：

- 未暂存文件统一显示“还原工作区（回到索引版本）”；
- Git 对 `??` 未跟踪文件的 rollback 实际是删除，并不存在索引版本；
- 菜单和确认框没有说清真实副作用。

**修复**：

- 新增 `allPathsUnversioned()`：只对非空、全部 `status === '??'` 的集合返回 true；
- 全未跟踪时 Rollback 子项改为
  “删除未纳入版本控制的文件” / 批量数量文案；
- `rollback(paths, { unversioned: true })` 使用专用确认：
  “删除 N 个未纳入版本控制的文件？此操作不可撤销。”；
- 混合集合、已跟踪未暂存、已暂存路径继续使用原还原文案；
- 底层仍复用 `gitRollback`，没有新增删除 API。

**回归**：

```bash
node --check lib/client.js
node --test tests/round217.test.mjs tests/round173.test.mjs \
  tests/git-operations.test.mjs tests/round88.test.mjs tests/static-order.test.mjs
npm test
```

全量：**893 pass / 0 fail**；`git diff --check` 通过。

**运行态**（轻量 home，Ego Browser，63097）：

- 隔离 `untracked-demo.txt` 显示 `??`；
- Rollback 子菜单为“删除未纳入版本控制的文件 ⌥⌘Z”；
- 点击后确认文案为“删除 1 个未纳入版本控制的文件？此操作不可撤销。”；
- stub confirm 返回 false，文件仍在 Changes 中；fixture 随后清理。

## 2026-11-14 — 修复紧凑目录菜单缺失 copyPath 文案

**作用域**：Project 树右键菜单、zh/en locale 完整性。

**运行态发现**：

- Compact Directories 合并行 `chain-a/chain-b` 的路径动作均正确使用最深目录：
  - 相对路径=`chain-a/chain-b`
  - 绝对路径=`…/chain-a/chain-b`
  - Open in Terminal 新 shell cwd=`…/chain-a/chain-b`
- 菜单中 Copy Path 一项却显示原始 key `editor.copyPath`。
- 扫描 332 个静态 `t('editor.*')` 调用后，zh/en 两边都只缺 `copyPath`。

**修复**：

- zh：`copyPath: '复制路径'`；
- en：`copyPath: 'Copy path'`；
- round216 新增“所有静态引用的 editor key 必须在两套字典存在”的回归，
  不再只验证两套字典彼此 keys 相同。
- 更新 round115：tree copyPath 只要求不与 terminal 的 directory 文案冲突，
  不再禁止 `copyPath` 本身存在。

**回归**：

```bash
node --check lib/client.js
node --test tests/round216.test.mjs tests/round206.test.mjs \
  tests/round115.test.mjs tests/round76.test.mjs tests/static-order.test.mjs
npm test
```

全量：**890 pass / 0 fail**；`git diff --check` 通过。

**运行态**（轻量 home，Ego Browser，63097）：

- 紧凑目录菜单显示“复制路径”，不再出现 `editor.copyPath`；
- 点击后复制值仍为最深真实目录的绝对路径；
- fixture、compact 偏好和测试 terminal 均已恢复。

## 2026-11-14 — Terminal 低频动作收进 IDEA Options

**作用域**：Terminal toolbar 密度、清屏/字号/刷新入口。

**IDEA 证据**：

- Computer Use AX：IDEA Terminal 直接动作区为
  `New Tab / New Predefined Session / AI Agents / Options / Hide`。
- `terminal.jar`：`action.Terminal.Settings.text=Settings`。

**实现**：

- 直接工具按钮只保留：
  new / shell selector / split / find / Options / hide。
- clear、font size cycle、refresh 收进 `Terminal 选项` 菜单。
- 清屏项继续显示 `⌘K`；键盘 handler 不变。
- 共享 ContextMenu 负责定位、Esc/方向键和外部点击关闭。
- 不改变 PTY、tab DND、split、find 或 host API。

**回归**：

```bash
node --check lib/client.js
node --test tests/round215.test.mjs tests/round98.test.mjs \
  tests/round34.test.mjs tests/round85.test.mjs tests/round149.test.mjs \
  tests/static-order.test.mjs
npm test
```

全量：**888 pass / 0 fail**；`git diff --check` 通过。

**运行态**（轻量 home，Ego Browser，63097）：

- 直接按钮为 `新建终端 / 选择 shell / 拆分终端 / 查找 / Terminal 选项 / 隐藏终端面板`；
- 页面中不再有直接 clear/font 按钮；
- Options 菜单项为 `清屏（保留滚动缓冲）⌘K / 切换字号 / 刷新`；
- 从 Options 切换字号后偏好由 `12`→`13`，再循环恢复；测试后键已删除。

## 2026-11-14 — Terminal 增加 IDEA 式固定工具窗口标题

**作用域**：Terminal Dock 标签栏 identity、窄容器响应。

**IDEA 证据**：

- Computer Use AX 中 IDEA Terminal 工具窗口有独立 `Terminal:` / `Local` 文本。
- `terminal.jar` 的 bundle：`local.terminal.default.name=Local`。
- 标题不随 shell OSC 标题或 CWD 变化。

**实现**：

- Terminal strip 最左侧增加固定 label：
  “终端: 本地” / `Terminal: Local`。
- 标题 `title` 也是完整固定文案；shell 标签仍独立显示并继续跟随 OSC/重命名。
- 新增 `dsh-editor-terminal-title`；编辑器容器 `max-width: 440px` 时隐藏，
  避免占用 active tab、`»` 与工具按钮的空间。
- 不改变 tab 测量、DnD、Move Left/Right、关闭、分屏或 xterm grid。

**回归**：

```bash
node --check lib/client.js
node --test tests/round214.test.mjs tests/round85.test.mjs \
  tests/terminal-round15.test.mjs tests/round212.test.mjs tests/static-order.test.mjs
npm test
```

全量：**885 pass / 0 fail**；`git diff --check` 通过。

**运行态**（轻量 home，Ego Browser，63097）：

- 实际 245.8px Terminal panel：标题存在但 CSS `display:none`，active tab 正常；
- 临时 1600px viewport 下 Terminal panel 575.0px：标题 `display:block`，
  文本=`终端: 本地`，tab 数量仍为 1；
- 测试后 device metrics override 已清除。

## 2026-11-14 — Commit 行双击不劫持复选框/按钮

**作用域**：Commit Changes 文件行双击、Show Diff 交互分层。

**问题**：

- 文件行 `onDoubleClick` 无条件调用 `onSelectDiff`；
- 双击行内 checkbox 会先切换提交勾选，再冒泡打开该文件 diff；
- 用户只想快速切换勾选时出现第二个非预期副作用。

**修复**：

- `onDoubleClick` 先检查 target 是否位于
  `input, button, a, [role="checkbox"]`；
- 命中交互控件时直接返回，不调用 Show Diff；
- 文件名/行空白区域双击仍打开 diff；单击选择、Show Diff、Enter、`⌘D` 不变。

**回归**：

```bash
node --check lib/client.js
node --test tests/round213.test.mjs tests/round162.test.mjs \
  tests/round167.test.mjs tests/static-order.test.mjs
npm test
```

全量：**882 pass / 0 fail**；`git diff --check` 通过。

**运行态**（轻量 home，Ego Browser，63097）：

- unstaged `src/sample.txt`：双击 checkbox 前后 diffPanes 均为 `0`，
  checkbox 双击后最终仍为原勾选值；
- 再双击该行文件名，diffPanes=`1`，toolbar 标题为
  `sample.txt / 工作区改动 / 1/1`。

## 2026-11-14 — Terminal 标签菜单增加 Move Tab Left/Right

**作用域**：Terminal 标签右键菜单、宿主 order 持久化。

**IDEA 静态证据**：

- `terminal.jar` 的 `messages/TerminalBundle.properties` 声明：
  - `action.Terminal.MoveToolWindowTabLeft.text=Move Tab Left`
  - `action.Terminal.MoveToolWindowTabRight.text=Move Tab Right`
- 这两个动作与 Close Tab / Move to Editor 同属 Terminal 标签操作。

**实现**：

- 新增纯函数 `terminalMoveTarget(terminals, id, direction)`，
  首/末标签返回 `null`，未知 id 同样返回 `null`。
- 标签菜单增加 `moveLeft` / `moveRight`；边界项保持可见但 disabled。
- 动作复用现有 `moveTab(sourceId, targetId)` 与宿主 `reorder`，
  没有引入第二份顺序状态。
- 拖拽重排、`⌥←/→` 切换、关闭/复制/颜色动作保持不变。

**回归**：

```bash
node --check lib/client.js
node --test tests/round212.test.mjs tests/round85.test.mjs \
  tests/terminal-round15.test.mjs tests/static-order.test.mjs
npm test
```

全量：**880 pass / 0 fail**；`git diff --check` 通过。

**运行态**（轻量 home，Ego Browser，63097）：

- 宿主保留 5 个终端，窄 Dock 只显示 active 标签 + `» 还有 4 个标签`；
- active 首标签菜单 Move Left disabled、Move Right enabled；
- Move Right 后宿主 order 从 `2920, a6e9, …` 变为 `a6e9, 2920, …`；
- Move Left 后 order 恢复；
- 测试创建的 4 个额外 shell 已通过宿主 close API 清理，只保留原终端。

## 2026-11-14 — Diff 增加 IDEA Show Whitespaces

**作用域**：Diff toolbar、Monaco 两侧 editor options、偏好持久化。

**IDEA 静态证据**：

- `messages/ActionsBundle.properties`：
  `action.EditorToggleShowWhitespaces.text=Sh_ow Whitespaces`。
- 该动作只绘制空白字符，不改变 diff 的 ignore 或 restore 判定。

**实现**：

- Diff state 新增 `showWhitespaces`，默认 `0`；
  偏好键 `dsh-editor.diff.showWhitespaces`。
- 创建 diff 时传入 `renderWhitespace: 'all'|'none'`。
- 运行态切换必须对 `getOriginalEditor()` 与 `getModifiedEditor()`
  分别 `updateOptions({ renderWhitespace })`；只对 DiffEditorWidget
  顶层调用在该 Monaco 版本中虽能读到 option=`all`，但 overlay 不刷新。
- 工具栏使用专用 whitespace 图标与 active 状态；窄布局进入 `»`。
- 与 Ignore Whitespaces 独立：一个控制差异计算，一个控制字符绘制。

**回归**：

```bash
node --check lib/client.js
node --test tests/round211.test.mjs tests/round210.test.mjs \
  tests/round205.test.mjs tests/round197.test.mjs tests/static-order.test.mjs
npm test
```

全量：**877 pass / 0 fail**；`git diff --check` 通过。

**运行态**（轻量 home，Ego Browser，63097）：

- 隔离 index/worktree 缩进差异 `2 spaces` vs `4 spaces`；
- Show Whitespaces 关闭时 overlay whitespace circles=`0`；
- 开启后 circles=`6`、`aria-pressed=true`、偏好=`1`；关闭恢复 `0`；
- 128.7px diff 的 `»` 菜单显示 `显示空白字符 ✓`；
- 测试后文件、index、commit 宽度与偏好均已恢复。

## 2026-11-14 — Diff 增加 IDEA Ignore Whitespaces

**作用域**：Diff toolbar、Monaco diff options、偏好持久化。

**IDEA 静态证据**：

- `intellij.platform.diff.jar` 的 bundle：
  `option.ignore.policy.whitespaces=Ignore whitespaces`。
- 该动作只改变差异查看策略，不修改文件内容。

**实现**：

- Diff state 新增 `ignoreWhitespace`，默认 `0`；
  偏好键 `dsh-editor.diff.ignoreWhitespace`。
- `createDiffEditor` 和 `updateOptions` 都传入
  `ignoreTrimWhitespace`。
- toolbar action 使用已有 `ignore` 图标，active 与 `✓` 一致，
  窄布局随其它动作进入 `»`。
- 工作区、暂存区、提交历史、修订和剪贴板比较都可使用；
  不改变 restore、hunk、find 或 read-only 语义。

**回归**：

```bash
node --check lib/client.js
node --test tests/round210.test.mjs tests/round208.test.mjs \
  tests/round205.test.mjs tests/round197.test.mjs tests/static-order.test.mjs
npm test
```

全量：**874 pass / 0 fail**；`git diff --check` 通过。

**运行态**（轻量 home，Ego Browser，63097）：

- 隔离 fixture 使用 index 中的 `alpha / beta` 与 worktree 中的
  `alpha / beta␠␠␠` 形成仅空白差异；
- 默认 diff hunk=`1/1`，Ignore Whitespaces=`false`；
- 开启后 hunk 导航消失，`aria-pressed=true`，偏好=`1`；
- 关闭后恢复 `1/1` 与偏好 `0`；
- 再开启并刷新，偏好仍为 `1`；测试后文件、index 与偏好均已恢复。

## 2026-11-14 — Project Behavior 使用 IDEA 固定 action label

**作用域**：Project `选项 → 行为` 的 autoscroll 菜单项。

**IDEA 静态证据**：

- `messages/ActionsBundle.properties`：
  `action.ProjectView.AutoscrollFromSource.text=Always Select Opened File`。
- 同级 `Open Files with Single Click`、`Open Directories with Single Click`
  都以固定动作名显示，状态只放在 `✓`。

**问题**：

- 旧菜单按状态显示“自动跟随…已开启 / 已关闭”，像说明文字而不是命令；
- 同一 Behavior 子菜单中其它两项使用固定 label，语义层级不一致；
- 切换后菜单项本身改名，键盘/视觉定位不稳定。

**修复**：

- locale 增加固定 `alwaysSelectOpenedFile`：
  “始终选择打开的文件” / `Always select opened file`。
- 菜单 label 固定，`autoScroll === false ? '' : '✓'` 单独表达状态。
- 删除 `autoScrollOn/Off` 两个状态 narrative key。
- 保留 `dsh-editor.project.autoscroll` 偏好键和即时跟随逻辑。

**回归**：

```bash
node --check lib/client.js
node --test tests/round209.test.mjs tests/round199.test.mjs \
  tests/round194.test.mjs tests/round187.test.mjs tests/static-order.test.mjs
npm test
```

全量：**871 pass / 0 fail**；`git diff --check` 通过。

**运行态**（轻量 home，Ego Browser，63097）：

- 默认 label=`始终选择打开的文件`，右侧 `✓`；
- Enter 后偏好写为 `0`、菜单关闭、焦点回 `role=tree`；
- 再打开时 label 不变且无 `✓`；
- 恢复测试偏好后写为 `1`。

## 2026-11-14 — read-only Diff 不再拦截块还原快捷键

**作用域**：`DiffPreview` 键盘 handler、历史/提交/剪贴板 comparison。

**问题**：

- 工具栏和 Monaco gutter 已按 writable 隐藏 undo/redo/选区还原；
- 但 `⌘Z` / `⇧⌘Z` 仍在 read-only diff 中被全局 handler 捕获，
  调用空的 restore 历史并显示“没有可撤销的块还原”；
- 这与 IDEA read-only comparison 的语义不一致，属于无效错误反馈。

**修复**：

- handler 增加 `editableHistory = diffReadOnly === false`。
- `⌘Z`、`⇧⌘Z`、`Ctrl+Y` 只在 writable diff 中进入 restore undo/redo。
- `⌘F`、`F7`、`⇧F7`、`⌘W` 继续作用于 read-only diff。
- 工具栏/`»` 仍由同一 `diffReadOnly` action 数组过滤；
  Monaco 仍使用 `readOnly=true` + `renderMarginRevertIcon=false`。
- 增加回归断言：一个 diff target 只允许一次 `callGit(request)`。

**回归**：

```bash
node --check lib/client.js
node --test tests/round208.test.mjs tests/round205.test.mjs \
  tests/round203.test.mjs tests/round202.test.mjs tests/round197.test.mjs \
  tests/static-order.test.mjs
npm test
```

全量：**869 pass / 0 fail**；`git diff --check` 通过。

**运行态**（轻量 home，Ego Browser，63097）：

- Commit Log → baseline → README.md 打开 read-only commit diff；
- toolbar 只有 view / find / fold / previous / next / close；
- undo、redo、选区还原按钮数量 0，`.revertButton` 数量 0，hunk=`1/1`；
- modified Monaco 中合成 `⌘Z` 与 `⇧⌘Z`：
  `defaultPrevented=false`，没有 restore-empty 错误。

## 2026-11-14 — Project 补齐修改时间升序/降序

**作用域**：Project Appearance → Sort By、Host `sortEntries`、排序循环。

**IDEA 静态证据**：

- `messages/ActionsBundle.properties` 同时声明：
  - `action.ProjectView.SortByTimeDescending.text=Sort by Modification Time (Newest First)`
  - `action.ProjectView.SortByTimeAscending.text=Sort by Modification Time (Oldest First)`
- 两者都属于 Project Appearance 的 `Sort By`，不是单一 `modified` 开关。

**实现**：

- 保留 `modified` 作为最新优先的兼容值，新增 `modified-asc` 最早优先。
- Host `sortEntries()` 的两个方向共用同一 comparator；`foldersFirst` 仍在外层生效。
- Project `选项 → 外观` 增加两个 IDEA 文案值，当前值显示 `✓`。
- 工具栏循环为 Name → Type → Newest First → Oldest First；
  旧 localStorage 的 `modified` 无需迁移。
- locale key 使用 `sort_modified` / `sort_modified_asc`；
  菜单把 `modified-asc` 映射到后者，避免 `editor.sort_modified-asc`
  这个不存在的扁平 key。

**回归**：

```bash
node --check lib/client.js
node --check lib/index.js
node --test tests/round207.test.mjs tests/project-round13.test.mjs \
  tests/round201.test.mjs tests/round199.test.mjs tests/round177.test.mjs \
  tests/round186.test.mjs tests/static-order.test.mjs
npm test
```

全量：**865 pass / 0 fail**；`git diff --check` 通过。

**运行态**（轻量 home，Ego Browser，63097）：

- fixture 文件固定 mtime：`zz-newest.txt=3000000000`、
  `mm-middle.txt=2000000000`、`aa-oldest.txt=1000000000`；
- 最新优先：`zz / mm / aa`，localStorage=`modified`；
- 最早优先：`aa / mm / zz`，localStorage=`modified-asc`；
- 刷新后最新优先顺序保留；切回 Name 后恢复 `aa / mm / zz`。

## 2026-11-14 — Project 增加 IDEA Compact Directories

**作用域**：Project Appearance、懒加载树展开、紧凑行真实路径语义。

**IDEA 静态证据**：

- `intellij.platform.ide.impl.jar` 的 `messages/ActionsBundle.properties` 声明
  `action.ProjectView.CompactDirectories.text=Compact Directories`，描述为
  `Merge two similar directories to a single node if the first directory contains only a second directory`。
- `ViewSettings` 默认 `isCompactDirectories()` 返回 `false`。

**实现**：

- 新增 `dsh-editor.project.compactDirectories`，缺省 `0`；
  Project `选项 → 外观 → 紧凑目录` 显示当前 `✓`。
- `compactDirectoryChain()` 只沿“已加载、恰好一个子项、子项仍为目录”的链条合并；
  遇到文件、多个子项或未加载目录立即停止，最大深度 64。
- `flattenRows()` 用最深目录作为 `row.path`，显示名只用于链条摘要；
  展开、拖放、右键动作与选中均使用真实路径。
- `toggleDirectory()` 在选项开启时继续读取并同步展开单子目录链，
  避免第一次点击只把 `chain-a` 变成仍折叠的 `chain-a/chain-b`。
- `⇧F6` 的初值改用 `basename(row.path)`，不会把显示摘要误当成文件名。

**回归**：

```bash
node --check lib/client.js
node --test tests/round206.test.mjs tests/round201.test.mjs \
  tests/round199.test.mjs tests/round194.test.mjs tests/round27.test.mjs \
  tests/static-order.test.mjs
npm test
```

全量：**861 pass / 0 fail**；`git diff --check` 通过。

**运行态**（轻量 home，Ego Browser，63097）：

- 隔离 fixture 造 `chain-a/chain-b/file.txt`、
  `branch-a/one.txt`、`branch-a/two/file.txt`；
- 开启紧凑目录后单击 `chain-a`，一次展开得到
  `chain-a/chain-b` + `file.txt`，合并行 title 为真实路径；
- `branch-a` 有文件和子目录两个兄弟，保持原层级，不发生合并；
- 刷新页面后 `compactDirectories=1` 与展开结果保留；
- 从同一 Appearance 菜单关闭后偏好写为 `0`，树立即恢复
  `chain-a / chain-b / file.txt` 三层。

## 2026-11-14 — Diff 增加 IDEA Search In Changes

**作用域**：DiffPreview 查找动作、⌘F 焦点边界。

**IDEA 静态证据**：

- `ActionsBundle.properties` 的 `Vcs.Diff.ToggleSearchInChanges`:
  `Search In Changes`。

**实现**：

- `searchInChanges()` 聚焦 modified editor 并触发 Monaco
  `actions.find`。
- Diff toolbar action array 增加 `find/search/⌘F`；窄布局随其它动作进入 `»`。
- 键盘 handler 在 `insideDiffPane` 时捕获 `⌘/Ctrl+F`，阻止浏览器查找；
  Terminal、Project、输入框等外部焦点继续放行。

**回归**：

```bash
node --check lib/client.js
node --test tests/round205.test.mjs tests/round195.test.mjs \
  tests/round197.test.mjs tests/static-order.test.mjs
npm test
```

全量：**855 pass / 0 fail**；`git diff --check` 通过。

**运行态**（轻量 home，Ego Browser，63097）：

- Diff modified editor 持焦时合成 `⌘F`：`defaultPrevented=true`；
- Monaco `.find-widget` 出现且可见；
- 174px 的 `»` 菜单显示“在更改中查找 / ⌘F”。

## 2026-11-14 — Project 增加 Show Excluded Files

**作用域**：Project Appearance、FS list 排除目录过滤。

**IDEA 静态证据**：

- `ActionsBundle.properties` 的 `ProjectView.ShowExcludedFiles`:
  `Show Excluded Files`，与 Sort By / Folders Always on Top 同属 Appearance。

**实现**：

- Host 新增 `PROJECT_EXCLUDED_DIRECTORIES`，复用 `WALK_IGNORED` 去掉 `.git`。
- `listDirectory` 在 `showExcluded !== true` 时跳过这些目录；`.git` 仍由
  `IGNORED_DIRECTORIES` 无条件隐藏。
- FS list 路由兼容默认：`showExcluded: body?.showExcluded !== false`。
- Client 新增 `dsh-editor.project.showExcludedFiles`，缺省 `'1'` 以保持现状；
  `Options → 外观 → 显示排除项` 显示当前 `✓`。
- 全部 Project tree list 请求携带当前值，切换后立即重读根目录。

**回归**：

```bash
node --check lib/client.js
node --check lib/index.js
node --test tests/round204.test.mjs tests/round148.test.mjs \
  tests/round199.test.mjs tests/static-order.test.mjs
npm test
```

全量：**852 pass / 0 fail**；`git diff --check` 通过。

**运行态**（轻量 home，Ego Browser，63097）：

- 在隔离 fixture 创建 `dist/marker.txt`；
- 默认显示排除项：根目录包含 `dist / docs / src / README.md`；
- 关闭后 `dist` 消失，偏好写为 `0`；
- 再开启后 `dist` 恢复，偏好写为 `1`；临时 `dist` 已清理。

## 2026-11-14 — Diff 选区还原接入 ⌥⌘Z；修复 hook 依赖 TDZ

**作用域**：DiffPreview 选区还原键盘入口、`actionableSelection` 初始化顺序。

**实现**：

- Diff 持焦且 `actionableSelection` 为 true 时，`⌥⌘Z` 调用
  `restoreSelection()`；Commit 的全局行回滚本来就会让出 `.monaco-editor`。
- `»` 菜单的 selection action 显示 `⌥⌘Z`；工具栏、菜单和键盘共享同一动作。
- `actionableSelection` 提前到 `selectionRange` 状态之后、键盘 effect 之前初始化。

**发现并修复的回归**：

- 第一版把 `actionableSelection` 放到组件后部，但键盘 effect 的 dependency array
  已引用它，首轮渲染触发：
  `ReferenceError: Cannot access 'actionableSelection' before initialization`。
- 该错误使 Commit diff 完全无法挂载；round203 增加“declaration index < effect
  dependency index”回归，避免再次出现 hook 依赖 TDZ。

**回归**：

```bash
node --check lib/client.js
node --test tests/round203.test.mjs tests/round202.test.mjs \
  tests/round156.test.mjs tests/static-order.test.mjs
npm test
```

全量：**849 pass / 0 fail**；`git diff --check` 通过。

**运行态**（轻量 home，Ego Browser，63097）：

- changed line 3 selection 下合成 `⌥⌘Z`：`defaultPrevented=true`，
  `revertRangeMappings` 调用 1 次；测试中替换该方法，避免改写 fixture。
- 未修改 line 1 selection 下同一快捷键：`defaultPrevented=false`，调用次数保持 1。
- 修复 TDZ 后 Commit diff 可正常挂载。

## 2026-11-14 — 选区还原入口必须由 writable + 实际 changed ranges 双重门控

**作用域**：DiffPreview selection restore 工具栏/`»` 动作与防御写回入口。

**问题**：

- 旧逻辑只要 `selectionRange !== null` 就添加“还原选区内的更改”，即使选区落在
  未修改行；点击后才报“没有可还原内容”。
- 只读的历史/剪贴板 diff 也可能保留一个非空选区，工具栏仍会暴露写回动作；
  Monaco native selection revert 则由 `readOnly/renderMarginRevertIcon` 控制。

**修复**：

- 新增 `actionableSelection`：
  - `selectionRange !== null`；
  - `!diffReadOnly`；
  - `selectedCharChanges(currentLineChanges, selectionRange).length > 0`。
- 工具栏和 `»` 共用该 action 数组，因此两处入口同时出现/消失。
- `restoreSelection()` 增加 `diffLoadedRef.current?.side === null` 防御守卫，
  即使被其它路径调用也不会在只读 diff 上执行写回。

**回归**：

```bash
node --check lib/client.js
node --test tests/round202.test.mjs tests/round156.test.mjs \
  tests/round196.test.mjs tests/round197.test.mjs tests/static-order.test.mjs
npm test
```

全量：**845 pass / 0 fail**；`git diff --check` 通过。

**运行态**（轻量 home，Ego Browser，63097）：

- 在 modified side 选中未修改 line 1：工具栏选区还原数量 0；
- 选中 changed line 3 的 `1..5` 列：工具栏选区还原数量 1；
- 窄到 174px 后 `»` 菜单出现“还原选区内的更改”。
- Native gutter 的选区按钮仍由 Monaco 自身生成；程序化 `setSelection` 下该轮仅观察到
  普通块还原箭头，未观察到独立 selection 箭头。工具栏/`»` 入口与写回守卫已独立验证。

## 2026-11-14 — Project 增加 Folders Always on Top，host/client 完整透传

**作用域**：Project Appearance sorting、FS list API、懒加载/刷新参数。

**IDEA 静态证据**：

- `ActionsBundle.properties` 的 `ProjectView.FoldersAlwaysOnTop`：
  `Folders Always on Top`，描述为“Sort files and folders separately”。
- 它与 Sort By / Show Hidden Files 同属 Project Appearance。

**实现**：

- 新增应用级 `dsh-editor.project.foldersFirst`，缺省 `'1'`。
- `Options → 外观 → 目录始终置顶` 显示当前 `✓`。
- Host `sortEntries(entries, mode, foldersFirst = true)`；FS list 路由透传
  `foldersFirst: body?.foldersFirst !== false`。
- Client 的全部 Project tree list 请求携带该值；关闭时目录和文件使用同一 comparator。
- 该开关只影响 Project View，不改变 Commit Changes 树的目录分组。
- 切换时用 `foldersFirstRef` + `loadRoot(next)` 立即重读，避免仅依赖异步 state
  effect 导致首帧顺序仍旧。

**回归**：

```bash
node --check lib/client.js
node --check lib/index.js
node --test tests/round201.test.mjs tests/project-round13.test.mjs \
  tests/round199.test.mjs tests/static-order.test.mjs
npm test
```

全量：**842 pass / 0 fail**；`git diff --check` 通过。

**运行态**（轻量 home，Ego Browser，63097）：

- Name 排序、目录置顶开启：根顺序 `docs / src / README.md`；
- 关闭“目录始终置顶”后偏好为 `0`，顺序变为 `docs / README.md / src`；
- 再次开启后恢复 `docs / src / README.md`。

## 2026-11-14 — Diff restore gutter hover/focus 反馈；溢出菜单随布局恢复关闭

**作用域**：Monaco `.revertButton`、Diff `<210px` 的 `»` 弹层生命周期。

**实现**：

- Monaco 动态创建的 `.revertButton` 增加：
  - `cursor:pointer`；
  - accent hover 背景与前景区分；
  - `focus-visible` 描边；
  - 0.09s 的背景色/文字色过渡。
- 这些样式只作用于 `.dsh-editor-diff-pane`，不污染普通 Monaco 编辑器或其它按钮。
- Diff 工具栏从 compact 恢复为正常宽度时，`diffActionsCompact=false` 的 effect
  自动清除 `diffActionMenu`，避免 `»` 消失后留下无锚点菜单。

**回归**：

```bash
node --check lib/client.js
node --test tests/round200.test.mjs tests/round196.test.mjs \
  tests/round197.test.mjs tests/static-order.test.mjs
npm test
```

全量：**838 pass / 0 fail**；`git diff --check` 通过。

**运行态**（轻量 home，Ego Browser，63097）：

- staged diff 的 revertButton：cursor=`pointer`；
- 指针移到箭头中心后背景变为 `rgb(65, 118, 230)`、文字 `rgb(255, 255, 255)`；
- 174px 打开 `»` 后恢复 254px，菜单自动关闭、`»` 消失，视图/折叠/undo/redo/关闭
  按原顺序恢复。

## 2026-11-14 — Project Options 按 IDEA Behavior/Appearance 分组；子菜单回焦不依赖 rAF

**作用域**：Project Options 二级菜单、ContextMenu 子菜单 Esc/← 回焦。

**IDEA 静态证据**：

- `ActionsBundle.properties` 将 Project View 选项分成 `Behavior`、
  `Appearance` 与 `Appearance → Sort By / Show`。
- `Open Files with Single Click`、`Open Directories with Single Click`、
  `Always Select Opened File` 属于行为；排序和隐藏文件属于外观。

**实现**：

- Project Options 顶层保留刷新、转到文件、最近文件、全部展开；
- 新增“行为”子菜单：自动跟随、单击打开文件、单击展开目录；
- 新增“外观”子菜单：名称/类型/修改时间排序、显示隐藏文件；
- 叶子动作继续使用 `runProjectOption()`，执行后焦点回 Project 树。
- 修复 ContextMenu 子菜单 `←` / `Esc` 回焦：从
  `requestAnimationFrame` 改为 `setTimeout(..., 0)`。Ego 后台页面观察到 rAF
  不派发，导致焦点未回父行；timeout 在后台和前台都能执行。

**回归**：

```bash
node --check lib/client.js
node --test tests/round199.test.mjs tests/round187.test.mjs \
  tests/round194.test.mjs tests/round198.test.mjs tests/static-order.test.mjs
npm test
```

全量：**835 pass / 0 fail**；`git diff --check` 通过。

**运行态**（轻量 home，Ego Browser，63097）：

- 顶层 Options 仅含 Refresh / Go to File / Recent / Expand All / 行为 / 外观；
- `→` 进入“行为”首项 autoscroll，`↓` 到单击打开文件、再 `↓` 到单击展开目录；
  Enter 执行后偏好更新，焦点回到 `role=tree`；
- “外观”子菜单依次为 name/type/modified 排序与隐藏文件；
- `Esc` 从子菜单返回“外观”，再 `Esc` 关闭菜单并回“选项”按钮；
- Diff 极窄 `»` 菜单 `Enter → view`、`↓ → collapse`、`Esc → 更多操作`，
  与 Project 菜单共用同一键盘路径。

## 2026-11-13 — Project 目录默认双击展开；IDEA 二进制资源给出确定证据

**作用域**：Project View 目录行手势、Project Options。

**IDEA 静态证据**：

- `/Applications/Intellij.app/Contents/lib/intellij.platform.ide.impl.jar`
  的 `messages/ActionsBundle.properties` 声明：
  `Open Files with Single Click`、`Open Directories with Single Click`、
  `Always Select Opened File`。
- `intellij.platform.lang.impl.jar` 的 `ProjectViewImpl` 根据
  `myOpenDirectoriesWithSingleClick.isSelected()` 调用
  `myTree.setToggleClickCount(1)`，否则调用 `setToggleClickCount(2)`。
- 因而文件与目录是两个独立偏好；目录默认单击选择、双击切换展开状态。

**实现**：

- 新增应用级 `dsh-editor.project.openDirectoriesSingleClick`，缺省 `'0'`。
- Project Options 增加“单击展开目录”，当前值 `✓`。
- 目录行默认单击仅选择，双击 toggle；偏好开启后单击 toggle。
- 目录箭头独立处理 click 并 `stopPropagation()`，无论偏好如何都可一次点击展开/收起。
- 文件偏好 `singleClickOpen` 保持独立，不被目录设置影响。

**回归**：

```bash
node --check lib/client.js
node --test tests/round198.test.mjs tests/round194.test.mjs \
  tests/round57.test.mjs tests/static-order.test.mjs
npm test
```

全量：**830 pass / 0 fail**；`git diff --check` 通过。

**运行态**（轻量 home，Ego Browser，63097）：

- 默认 `openDirectoriesSingleClick=0`：单击 `src` 后 `aria-expanded=false`、
  `aria-selected=true`，子文件仍不可见；双击后展开。
- 直接点击目录箭头可收起，选中状态保持。
- Options 打开“单击展开目录”后偏好为 `1`，单击 `src` 立即展开。
- 刷新页面后偏好仍为 `1`；文件与目录选项分别显示在 Project Options 中。

## 2026-11-13 — 极窄 Diff 工具栏使用 IDEA 式 `»` 溢出

**作用域**：DiffPreview toolbar 在 `<210px` 时的动作布局。

**证据/问题**：

- 旧工具栏靠标题无限收缩容纳图标；约 200px 以下标题已无空间，动作会越过右边界
  被 `overflow:hidden` 裁掉。
- IDEA 保留固定末端动作，并把装不下的动作放进 `»`。

**实现**：

- 视图切换、未修改区域折叠、undo/redo、选区还原建模为 `diffToolbarActions`。
- toolbar 自身宽度 `<210px` 时只渲染 `更多操作 »`、hunk 胶囊和关闭。
- `»` 复用 ContextMenu，当前激活项带 `✓`；宽度恢复后按原顺序展开。
- 嵌入式 webview 中 ResizeObserver 在 splitter 拖动时可能不派发，因此同时监听
  window `mousemove`/`resize`，16ms 合并后重测；卸载时全部清理。

**回归**：

```bash
node --check lib/client.js
node --test tests/round197.test.mjs tests/round162.test.mjs \
  tests/round195.test.mjs tests/round196.test.mjs tests/static-order.test.mjs
npm test
```

全量：**826 pass / 0 fail**；`git diff --check` 通过。

**运行态**（轻量 home，Ego Browser，63097）：

- 254px：依次显示视图/折叠/undo/redo/关闭，无 `»`；
- 174px：动作区只剩 `更多操作 »` 与关闭，hunk `1/1` 保留；
- `»` 菜单包含 `切换双栏/单栏对比 ✓`、`展开未修改区域 ✓`、撤销、重做；
- 恢复 254px 后 `»` 消失，原动作全部恢复。

## 2026-11-13 — Monaco restore gutter 与窄 hunk 胶囊的键盘语义

**作用域**：DiffPreview 的 `.revertButton`、窄布局 `.dsh-editor-hunk-capsule`。

**证据/问题**：

- Monaco 的 revert gutter 是动态创建的普通 `div.revertButton`，只有英文
  `title=Revert Change`；没有 `role`、`aria-label`、`tabIndex`，键盘不可达。
- 窄布局把 hunk 导航收成 `n/n` 胶囊，但胶囊只有 click，没有键盘激活。

**实现**：

- Diff host 内扫描 `.revertButton`，按 Monaco 原 title 区分单块/选区还原，
  写入本地化 `title`、`aria-label`、`role=button`、`tabIndex=0`。
- 宿主 MutationObserver 只在 diff host 子树监听 `childList`，覆盖 Monaco
  重算/选区变化后重建的箭头；设置属性不会触发自身循环。
- Diff host 统一处理 Enter/Space，命中箭头时调用其原生 `click()`，不复制还原逻辑。
- Hunk 胶囊补 `tabIndex=0`、包含当前 `n/total` 的 `aria-label`/tooltip、
  Enter/Space、左右方向键和 focus-visible 描边。

**回归**：

```bash
node --check lib/client.js
node --test tests/round196.test.mjs tests/round162.test.mjs \
  tests/round166.test.mjs tests/round195.test.mjs tests/static-order.test.mjs
npm test
```

全量：**823 pass / 0 fail**；`git diff --check` 通过。

**运行态**（轻量 home，Ego Browser，63097）：

- staged diff 的 `.revertButton`：`title/aria=还原此更改`、`role=button`、
  `tabIndex=0`；Enter 的 `defaultPrevented=true`，捕获监听确认分发 1 次 click，
  未实际改写 fixture。
- 窄 panel hunk 胶囊为 `1/1`、`role=button`、`tabIndex=0`，aria/title 包含
  Enter/Shift+Enter/F7 说明；Enter 被插件接收，diff 保持 `1/1`。

## 2026-11-13 — Diff 快捷键必须让位于 Terminal / 树 / 表单焦点

**作用域**：DiffPreview 的 `⌘W`、`⌘Z`、`⇧⌘Z`、`F7` window-capture handler。

**症状/证据**：

- Diff 打开后，快捷键 handler 只排除了少数输入框；焦点位于 Terminal emulator、
  Project/Changes 树时仍会捕获按键。
- 因此 Terminal 中的 `F7` 会被当作“下一个差异”，`⌘W` 会误关比较页。

**修复**：

- keydown 顶部统一解析 `event.target`：
  - `.dsh-editor-diff-pane` 内为 diff 自有键盘面；
  - `[data-dsh-editor-terminal]`、`[role="tree"]`、`input`、`textarea`、
    `select`、`contenteditable` 为外部交互面。
- 不在 diff 且命中外部交互面时立即 `return`，不 `preventDefault`、不停止冒泡。
- 差异内查找框/文本输入仍保留 `⌘W`、撤销/重做保护；F7 仍在 diff 内工作。

**回归**：

```bash
node --check lib/client.js
node --test tests/round195.test.mjs tests/round191.test.mjs tests/static-order.test.mjs
npm test
```

全量：**819 pass / 0 fail**；`git diff --check` 通过。

**运行态**（轻量 home，Ego Browser，63097）：

- staged diff 与 Terminal 同时打开，Terminal 持焦时合成 `F7`、`⌘W`：
  两者 `defaultPrevented=false`，diff 仍打开，hunk 保持 `1/1`。
- Project 树作为事件目标时同样不拦截 `F7`/`⌘W`，diff 保留。
- 回到 diff 编辑器后 `F7` 的 `defaultPrevented=true`，插件快捷键恢复。

## 2026-11-13 — Project 默认双击打开；移除误入 ProjectPanel 的终端 helper

**作用域**：Project View 文件行手势、Project Options、round76/134/153/194 回归。

**证据/问题**：

- 文件树此前无条件在单击时调用 `onOpen`，与 IDEA 默认的
  `Open Files with Single Click = off` 不一致；双击只停止冒泡，不能承担打开动作。
- 第 193 轮定位源码时发现 ProjectPanel 的 ⌘F effect 内残留了一份
  `rememberTerminalOrigin`；它引用 EditorWorkspace 的 `editorRef` /
  `terminalReturnFocusRef`，因从未调用而未抛错，却让旧测试误命中同名文本。

**实现**：

- Project View 新增应用级偏好
  `dsh-editor.project.singleClickOpen`，缺省 `'0'`：
  - 关闭：文件单击只选择，双击打开；
  - 打开：文件单击直接打开；
  - 目录行单击仍展开/收起。
- Project Options 增加 `单击打开文件 / Open files with single click`，
  当前值以 `✓` 回显；执行后用既有 `runProjectOption()` 把焦点还给 Project 树。
- 双击文件在偏好开启时不再重复调用 `onOpen`；双击仍只打开，不进入重命名。
- 删除 ProjectPanel 内残留的终端 origin helper，快捷键 origin 只保留在
  EditorWorkspace 的唯一作用域。

**回归**：

```bash
node --check lib/client.js
node --test tests/round194.test.mjs tests/round134.test.mjs \
  tests/round76.test.mjs tests/round153.test.mjs tests/static-order.test.mjs
npm test
```

全量：**816 pass / 0 fail**；`git diff --check` 通过。

**运行态**（轻量 home，Ego Browser，63097）：

- 默认 `singleClickOpen=0`：单击 `README.md` 后 tab 数 0、选中行为成功；
  双击后打开 `README.md`。
- 通过 Project Options 开启后菜单项显示 `✓`，单击 `sample.txt` 立即新增
  `sample.txt` tab；刷新页面后偏好仍为 `1`。
- 再关闭后偏好回到 `0`，菜单关闭且焦点回到 `role=tree`。

## 2026-11-13 — 终端快捷键只切换 Dock；同名 helper 让测试误命中 Project 面板

**作用域**：EditorWorkspace 的 `Alt+F12` / `Ctrl+Shift+\``、Terminal origin focus、
round176/178/192/193 静态回归。

**症状/证据**：

- `Ctrl+Shift+\`` 在 Terminal 已打开时仍执行 `setTerminalOpen(true)` 并递增
  `terminalGeneration`，重复按下会创建新 shell，且没有关闭分支。
- EditorWorkspace 的快捷键 effect 调用了 `rememberTerminalOrigin()`，但作用域内
  没有定义该函数；ProjectPanel 另有一个同名局部 helper。
- 旧测试按 `const rememberTerminalOrigin` 搜索源码，命中了前面的 ProjectPanel
  helper，因此快捷键测试曾对错误代码误报通过。

**修复**：

- 新增纯函数 `terminalShortcutAction(open, focusInsideTerminal)`：
  - 已打开 → 关闭；仅当焦点原本在终端内时恢复来源焦点；
  - 已关闭 → 打开，不创建新 shell。
- EditorWorkspace 快捷键 effect 内定义唯一的 `rememberTerminalOrigin /
  restoreTerminalOrigin / toggleTerminalDock`，两条快捷键共用。
- `Ctrl+Shift+\`` 不再调用 `setTerminalGeneration`。
- round176/178/192/193 测试改用 `toggleTerminalDock` 与唯一注释锚点，
  不再用可能命中 ProjectPanel 的同名文本。

**回归**：

```bash
node --check lib/client.js
node --test tests/round176.test.mjs tests/round178.test.mjs \
  tests/round192.test.mjs tests/round193.test.mjs tests/static-order.test.mjs
npm test
```

**运行态**（轻量 home，Ego Browser，63097）：

- Commit 更改行 `src/sample.txt` 获得焦点后按 `Alt+F12`：Dock 打开且焦点进入
  terminal；再按一次关闭，焦点回到同一更改行。
- `Ctrl+Shift+\`` 连续执行开 → 关 → 开：tab 数始终为 1，shell 没有被重开。
- Terminal 打开时切换 Project / Commit 并打开 staged diff：Dock 与 1 个 tab 保持；
  关闭 Dock 后 diff 仍在。

## 2026-11-13 — Diff 行/字符高亮必须走 Monaco 主题，Project 溢出顺序已对齐

**作用域**：Commit diff canvas 高亮、Project 200px 工具栏。

**证据**：

- Monaco 的 insert/delete line 与 character highlight 绘制在 canvas 上，DOM 中没有
  `.line-insert` / `.char-insert` 类可供 CSS 覆盖。
- 200px Project 工具栏实际可见：
  `新建文件/目录… / 定位当前文件 / 选项 / 隐藏 / 更多操作`；
  `»` 内只有 `展开所选 / 全部收起`。

**实现**：

- 新增 `ensureDiffTheme(monaco)`：
  - light: `dsh-editor-diff-light`
  - dark: `dsh-editor-diff-dark`
  - `inherit: true` 保留宿主语法色，只覆盖 diff line/text/gutter/overview 颜色。
- DiffPreview 的 `createDiffEditor` 使用该 scoped theme，不调用全局 `setTheme`。
- Project toolbar 顺序保持 IDEA：
  left `newEntry / reveal`；right `expandSelected / collapse / options / hide`。

**回归**：

```bash
node --check lib/client.js
node --test tests/round191.test.mjs tests/round190.test.mjs tests/round188.test.mjs \
  tests/static-order.test.mjs
npm test
```

全量：**807 pass / 0 fail**；`git diff --check` 通过。

**运行态**：

- staged diff editor 实际主题名为 `dsh-editor-diff-light`。
- hunk `1/1`、hidden widget 2 个、无 Editor tab。
- 页面仅出现浏览器自身的 ResizeObserver 提示，无插件 ReferenceError。

## 2026-11-13 — Project 工具栏顺序与 Commit diff 折叠行视觉收口

**作用域**：Project 可见工具栏、Commit diff side headers / unchanged-region widget。

**实现**：

- 固定 Project 分组顺序：
  - 左：`newEntry / reveal`
  - 右：`expandSelected / collapse / options / hide`
  与 IDEA 的 `New File or Directory… / Select Opened File / Expand Selected /
  Collapse All / Options / Hide` 一致。
- diff 两列标题之间加 hairline divider，右侧“索引/当前版本”不再和左侧连成一块。
- Monaco `diff-hidden-lines-widget` 使用 host surface / tertiary tokens、10px 字号，
  不再使用 Monaco 自带灰色横条。

**回归**：

```bash
node --check lib/client.js
node --test tests/round190.test.mjs tests/round188.test.mjs tests/round187.test.mjs \
  tests/round95.test.mjs tests/round97.test.mjs tests/static-order.test.mjs
npm test
```

全量：**805 pass / 0 fail**；`git diff --check` 通过。

**运行态**（轻量 home，63097）：

- staged `sample.txt` diff：`HEAD / 索引`，hunk `1/1`；
- 2 个 hidden-region widget；
- widget bg `rgb(255,255,255)`、text `rgb(129,133,140)`、font `10px`；
- 右侧 header 有 1px 左分隔线；
- 页面仍无 Editor tab。

## 2026-11-13 — Commit Options 作用域错误；Project 子菜单与 Changes 窄窗实测

**作用域**：EditorWorkspace、Commit Options、Project Options 键盘、Changes 200px 行。

**症状**：

- 在轻量隔离宿主中打开 Editor 时，`EditorWorkspace` 抛：
  `ReferenceError: fetching is not defined`，Editor host 存在但为空。
- Project 排序子菜单能打开，但 `→` 后焦点仍停在父行。

**根因**：

- Commit Options 聚合时把 `EditorWorkspace` 的 `fetchBusy/updateBusy` 误写成
  `fetching/updating`（后者只是 CommitPanel 的局部 prop）。
- 子菜单首项聚焦放在 `requestAnimationFrame` 中，可能早于 React 提交新子菜单 DOM。

**修复**：

- Commit Options 改用 `fetchBusy/updateBusy`；回归锁住不得出现裸 `fetching/updating`。
- 子菜单聚焦改为 `setTimeout(..., 0)`，确保 React 已提交 child buttons。
- 删除旧 `dsh-editor.chatCollapsed` 状态、toggle、持久化键和 CSS cue；View-row
  按钮现在只负责 Editor open/close，历史 0% 聊天宽度不能再静默生效。

**回归**：

```bash
node --check lib/client.js
node --test tests/round188.test.mjs tests/round187.test.mjs tests/round186.test.mjs \
  tests/round180.test.mjs tests/static-order.test.mjs
npm test
```

全量：**801 pass / 0 fail**；`git diff --check` 通过。

**运行态**（轻量 home `/private/tmp/dsh-editor-r189-home`，session 为空，端口 63097）：

- Editor 打开后无 `fetching is not defined`；Project 工具窗口正常挂载。
- Project Options：`→` 后焦点为 `sort:name`；`↓` 到 `sort:type`；`Enter`
  执行后菜单关闭，焦点回到 `role=tree`，`README.md` 保持选中。
- Changes 面板宽 201px；文件行宽 200px；`+N` 右边界 509px，侧栏右边界 517px；
  `−M` 为 `display:none`，tooltip 保留 `+N −M`。
- View 行没有 Editor tab。

## 2026-11-13 — 高频 DOM 维护会让 Harness renderer 卡死

**作用域**：`createController()` 的 body MutationObserver、Editor/View chrome 对账。

**症状**：

- DeepSeek Harness 实机 UI 卡死。
- `sample` 显示 renderer PID 49325 持续约 **103% CPU、14.2GB physical footprint**，
  主线程处于 V8 微任务/函数调用链。
- 同类 Ego Page 随后在 `Input.dispatchMouseEvent` / `Page.getFrameTree` 上超时。

**根因/放大风险**：

- 插件对 `document.body` 做 `{ childList: true, subtree: true }` 观察，原回调每次 mutation
  都同步执行完整 `sync()` 与菜单扫描。
- 聊天/终端流式输出会产生大量零碎 mutation；在超长会话中反复扫描整个页面 DOM，
  足以持续占用主线程并放大微任务风暴。

**修复**：

- 新增纯函数 `maintenanceDelay(lastAt, now, 80)`。
- MutationObserver 只登记一个 timer；80ms 窗口内的 mutation 合并成一次
  `sync + enhanceMenus + menuRescan`，approximately 12.5 次/秒上限。
- unmount 时取消未执行的 timer。

**回归**：

```bash
node --check lib/client.js
node --test tests/round188.test.mjs tests/round187.test.mjs tests/round186.test.mjs \
  tests/round95.test.mjs tests/static-order.test.mjs
npm test
```

全量：**805 pass / 0 fail**；`git diff --check` 通过。

**运行态**：

- 终止失控 renderer 后重启 Harness；加载最新 desktop profile 副本。
- 启动 12 秒后 renderer 为 **0.1% CPU / 2.0% memory**，不再持续满载。
- Computer Use 前景实测：点击 `打开编辑器工作台` 后按钮变为
  `关闭编辑器工作台`；再次点击恢复 `打开编辑器工作台`。往返后 renderer 为
  **0.0% CPU / 2.0% memory**。

**边界**：本次采样证明 renderer 已进入高频 JS 执行；插件 observer 是明确可修复的放大器，
但旧进程已卡死，无法在修复前继续做“禁用该 observer”的单变量 A/B。若再次出现，
下一步应以插件禁用/启用两组运行态对照确认是否还有其它来源。

## 2026-11-13 — 对话 View 行只保留 Editor 开关；子菜单键盘进入/退出

**作用域**：desktop profile 安装副本、View 行 Editor 控制、Project/Commit 二级菜单键盘。

**用户反馈**：

- 实机 View 行仍出现 `Editor / 对话 / 轨迹 / 上下文 / 编队`，要求删除 Editor tab，
  改为在对话页内直接显示/隐藏 Editor。
- 源码已不含 tab 注入；旧 desktop profile 副本（716,588 B）仍含
  `ensureButton()` / `data-dsh-editor-tab`。file 依赖是复制安装，不跟随工作区。

**修复**：

- 最新 client 同步到 desktop profile（795,212 B）。
- View 行最右端按钮语义改为：
  - 未打开：`打开编辑器工作台`；
  - 已打开：`关闭编辑器工作台`；
  - 普通 button，不是 `role=tab`，不加入宿主 View 组。
- ContextMenu 补真实键盘二级菜单：
  - `→` 打开子菜单并把焦点放到首个 enabled 行；
  - `←` 只关闭子菜单并把焦点还给父行；
  - `↑/↓` 在当前父菜单或当前子菜单内部循环；
  - `Esc` 同样按层级关闭；
  - 每个 menu row 带 `data-menu-item-id`，不依赖数组下标与分隔符。

**回归**：

```bash
node --check lib/client.js
node --test tests/round187.test.mjs tests/round186.test.mjs tests/round180.test.mjs \
  tests/round87.test.mjs tests/round86.test.mjs tests/round95.test.mjs tests/static-order.test.mjs
npm test
```

全量：**801 pass / 0 fail**；`git diff --check` 通过。

**实机证据**：Computer Use 读取当前 Harness，View tab 只有
`对话 / 轨迹 / 上下文 / 编队`，另有独立 `button 打开编辑器工作台`；
desktop profile 副本不再匹配 tab 注入代码。

**尚未闭环**：前景 UI 中点击按钮的 open/close 往返仍需下一轮实测。

## 2026-11-13 — 桌面 profile 必须重新同步；View 行只保留 Editor 开关

**作用域**：desktop profile 安装副本、对话 View 标签行、Editor 显示/隐藏、Project/Commit Options。

**症状/用户反馈**：

- 源码已经移除 Editor tab，但用户实机仍看到“Editor / 对话 / 轨迹 / 上下文 / 编队”的 Editor tab。
- 用户要求不要在 View 行新增 tab，而是在“对话”页内直接显示/隐藏 dsh-editor。

**根因**：

- `~/.dsh/profiles/desktop/node_modules/dsh-editor/lib/client.js` 是 file 依赖的安装副本，
  仍是 11 月 11 日版本（716,588 B），含 `ensureButton()` 和
  `data-dsh-editor-tab` 注入；工作区源码（793,855 B）不含这些代码。
- 只改工作区不会自动更新 file 依赖的 profile 副本。

**修复**：

- 将最新 `lib/client.js` 同步到 desktop profile 安装副本。
- View 行最右侧图标改为 Editor 显示/隐藏控制：
  - 未打开：`打开编辑器工作台`，点击进入分栏；
  - 已打开：`关闭编辑器工作台`，点击回到完整对话；
  - 它仍是普通 button，不加入 `role=tab`，不产生 Editor tab。
- Project `排序方式` 改为带 `✓` 的 Name/Type/Modified 二级菜单；
  `显示隐藏文件` 保持 value-menu 语义。
- Commit 工具栏收口为 `Options / Refresh / Hide`，Fetch、Update、Stash、Shelve、
  Group by 全部进入 Commit Options。

**回归**：

```bash
node --check lib/client.js
node --test tests/round186.test.mjs tests/round95.test.mjs tests/round177.test.mjs \
  tests/round179.test.mjs tests/round48.test.mjs tests/round146.test.mjs
npm test
```

全量：**796 pass / 0 fail**；`git diff --check` 通过。

**运行态**：

- Computer Use 读取当前 Harness 实机：View 行的 tab 只有
  `对话 / 轨迹 / 上下文 / 编队`，没有 Editor；右侧存在
  `button 打开编辑器工作台`。
- desktop profile 安装副本已更新，`rg` 不再命中 `data-dsh-editor-tab` 或 `ensureButton`。

**注意**：以后修改 `lib/client.js` 后，本地开发验证与 desktop profile 必须分别同步；
file 依赖安装副本不会自动跟随源目录。

## 2026-11-13 — Project Options 执行后焦点应回树；diff 折叠守恒

**作用域**：Project Options 菜单、ContextMenu 通用回焦、Monaco diff 折叠/滚动、Commit 工具条窄窗。

**症状**：

- 在 Project `选项` 中执行“按名称/类型排序”等命令后，菜单关闭、选中行仍是 `README.md`，
  但 `document.activeElement` 落到 `<body>` 或工具栏按钮；方向键无法继续操作树。
- diff 的未修改区域折叠/展开后，需要确认 hunk counter 不被重置，双栏滚动仍同步。

**根因**：

- ContextMenu 卸载时会统一把焦点还给 opener；这一 cleanup 可能晚于命令自己的
  `requestAnimationFrame`，再次把焦点从树抢走。
- Project 选中文件行的 `tabIndex` 是 `-1`（`0` tab stop 在 tree 容器上），直接
  `row.focus()` 是 no-op。

**修复**：

- ContextMenu 支持 `restoreFocus: false`；Project Options 的自管理动作会跳过 opener 回焦。
- `focusProjectAfterOption()` 只在行自身 `tabIndex >= 0` 时聚焦行，否则聚焦 tree 容器；
  同时在动作后立即与 120ms 后各写一次，覆盖 Sort/Expand 引起的异步重渲染。
- 转到文件、最近文件不套用该回焦，仍由各自弹窗拥有键盘。

**回归**：

```bash
node --check lib/client.js
node --test tests/round185.test.mjs tests/round177.test.mjs tests/round180.test.mjs \
  tests/round181.test.mjs tests/round162.test.mjs tests/static-order.test.mjs
npm test
```

全量：**791 pass / 0 fail**；`git diff --check` 通过。

**运行态**：

- Project 选中 `README.md`，从 `选项 → 按类型排序` 执行后，菜单关闭，选中行仍为
  `README.md`，`activeElement` 为 `role="tree"` 的 Project 容器。
- Commit staged diff 在未修改区域“展开 → 折叠 → 再展开”过程中 hunk 始终 `1/1`；
  展开后 original 滚到 260、modified 同步 260，modified 滚到 520、两侧同步落到 266。
- 201px Commit 工具条保留分支、刷新、隐藏和 `»`；`»` 中为 Fetch / Update / Stash /
  Shelve / Group by，末端 Hide 未被挤出。

## 2026-11-13 — Project 侧栏需要像素下限；Changes 窄窗只保留一侧行数

**作用域**：Editor 工具窗口宽度、Commit Changes 行数栅格、Monaco 双栏 diff 滚动。

**症状**：

- 窄 Editor host（约 496px）里 Project 虽然写了 `minWidth: 180`，实际仍只有约 180px，
  根目录名称和路径很快被裁切；Gufa 的 Explorer 默认约 260px、最小约 190px。
- Commit Changes 约 200px 时，行尾 `+N −N` 仍可能只剩一个 `+` 或被裁掉。
- 双栏 diff 没有显式同步代码，需要确认隐藏区域展开后两栏是否仍原生联动。

**根因**：

- 工具窗口 inline `flex: 0 0 <percent>%` 只按百分比计算，CSS `minWidth` 只能兜底，
  无法表达“窄窗口像素优先、宽窗口按比例”。
- 行数容器仍尝试同时绘制 `+N` 和 `−M`；窄容器把弹性路径挤到 0 后，最后两段仍争抢
  固定的 max-content 列。

**修复**：

- 新增 `toolPanelFlex()`：`0 0 clamp(200px, <saved>%, 420/480px)`；Project 默认 28%，
  Commit 默认 25%，拖动仍按百分比持久化。
- `LineCounts` 增加稳定 class；`dsh-editor-side ≤ 210px` 时把字体/间距压缩为 9px/1px，
  有新增时只显示 `+N`，纯删除时只显示 `−M`；完整 `+N −M` 保留在 `title`。
- Monaco 双栏滚动不增加重复桥接：运行态确认 native diff editor 已双向同步。

**回归**：

```bash
node --check lib/client.js
node --test tests/round184.test.mjs tests/round156.test.mjs tests/round182.test.mjs \
  tests/round50.test.mjs tests/plugin-contract.test.mjs tests/static-order.test.mjs
npm test
```

全量：**787 pass / 0 fail**；`git diff --check` 通过。

**运行态**：

- 隔离 fixture 中 Commit 侧栏宽 **201px**；行数容器右边界 509px，侧栏右边界 518px，
  没有越界；容器内 `+N` 可见，`−M` 的计算样式为 `display:none`，`title` 仍为完整读数。
- 展开全部未修改区域后，Monaco native 双栏：
  `original.setScrollTop(260)` 后两侧均 260；`modified.setScrollTop(520)` 后两侧收敛到 278。
  因此不需要新增 scroll listener。

**适用边界**：容器查询依赖 `containerName: dsh-editor-side`；宿主若移除 container 支持，
行数仍可显示但不会执行窄窗单侧降级。

## 2026-11-13 — 空白会话需从 hero 进入工作台；Editor 不再占用 View 标签行

**作用域**：`lib/client.js` 的会话 hero、工作区菜单、Editor 激活/同步、聊天列宽度；README 与插件契约测试。

**症状/用户反馈**：

- 新建会话只有 hero、composer 和 `[data-conversation-region="chat"]`，没有
  `[data-conversation-tabs]`；Project / Commit / Terminal 在首次聊天前无法从可见界面进入。
- 原 `syncInner()` 在找不到 tablist 时立刻 `button = null; return`，即使通过工作区菜单打开了
  Editor，宿主重渲染后也不会继续对账 host。
- 把 Editor 作为第四个人工 DOM 标签插进“对话 / 轨迹 / 上下文”行，既污染宿主 View 语义，
  也与用户要求的 Gufa 式工作台入口不一致。
- 聊天列默认 25%，在 764px 的内容区里只剩 191px，hero 与消息明显挤压。

**根因**：

- Editor 的唯一入口被绑定在 `[data-conversation-tabs]` 上，而空会话宿主不会渲染该节点。
- 激活与 DOM 对账共用同一个 tablist 门禁，导致“能通过菜单打开但不能稳定保持”。
- 聊天宽度默认与边界仍固定为旧版 25% / 15%–45%。

**修复**：

- 在宿主的 `[data-slot="conversation.hero.options"]` 注入 26px 图标式 Editor 开关；
  点击调用现有 `openEditorSplit()` / `setActive(false)`，hero 重渲染后自动补回。
- 彻底移除 `[data-conversation-tabs]` 中的 `data-dsh-editor-tab` 注入；View 行只保留宿主自己的
  “对话 / 轨迹 / 上下文”和聊天列收起按钮。
- `syncInner()` 不再因 tablist 缺失提前返回：hero launcher、Editor host、聊天 chrome 都继续对账。
- 聊天列默认 35%，拖动边界 28%–44%；旧 `dsh-editor.chatWidth` 中恰好为 25 的未定制默认值
  一次性迁移到 `dsh-editor.chatWidth.v2 = 35`，其它旧值保留。

**回归**：

```bash
node --check lib/client.js
node --test tests/round183.test.mjs tests/round83.test.mjs tests/round95.test.mjs \
  tests/round102.test.mjs tests/plugin-contract.test.mjs tests/static-order.test.mjs
npm test
```

全量 `npm test`：**784 pass / 0 fail**；`git diff --check` 通过。

**运行态**：

- 隔离 home `/private/tmp/dsh-editor-r183-home`、Git fixture `/private/tmp/dsh-editor-r183-fixture`、
  宿主 `127.0.0.1:63096`。新会话 hero 出现 26×26 Editor 图标，打开后
  `data-dsh-editor-active=true`、聊天列 35%、Editor host 496.6px；View 标签行无
  `data-dsh-editor-tab`，页面内只有 Project / Commit / Terminal 三个活动项。
- Project 打开 `README.md` 后 Monaco 正常渲染 2 行；终端执行
  `printf 'R183_TERMINAL_OK\n'` 可见回显；Commit 选中 staged 文件后打开
  `HEAD / 索引` 双栏 diff，hunk 为 `1/1`。
- 同一入口再次点击可退出，host 仅置 idle（`visibility:hidden`），不会卸载树状态。

**已知边界**：空会话入口依赖宿主的 `conversation.hero.options` 槽；未来若宿主移除该槽，
工作区 `... → Editor` 仍可用，但 hero 快捷入口需要随宿主契约重新适配。

## 2026-11-12 — Commit Changes 目录/文件列对齐与窄窗行数裁切

**作用域**：Commit Changes 的目录行、文件行、列栅格与窄工具窗口。

**症状**：

- 目录行和文件行的状态、图标、名称、父路径、行数各自按内容宽度排布，长名称会让列位置漂移；
- 初次改网格时目录少一个状态槽，文件行会折成两行；
- 190px 左右 Changes 面板下，`+N −N` 的右端仍可能被裁切。

**根因**：

- 原来是两套 flex 行：目录行和文件行 DOM 子项数量不同，无法形成稳定列；
- 只有文件行有 porcelain 状态槽；目录行直接进入文件夹图标；
- 名称、父路径、行数都参与内容宽度分配，没有明确的“固定列 + 弹性路径列”。

**修复**：

- 新增 `styles.commitTreeNode` 网格：`12px 16px 16px 16px max-content minmax(0,1fr) max-content`，目录和文件共用；
- 目录补空状态槽，文件补空 chevron 槽；这样文件夹/文件图标、名称、父路径与行数落在同一列；
- 名称与父路径分到不同 grid cell，父路径列吸收剩余宽度并 ellipsis，行数固定右端；
- `tests/round182.test.mjs` 锁住共享网格、空槽对齐和路径/名称分列；旧 `round50` 的目录 subtotal 扫描窗口扩展到覆盖整个目录块。

**验证**：

```bash
node --check lib/client.js
node --test tests/round182.test.mjs tests/round50.test.mjs tests/static-order.test.mjs
```

运行态（隔离 `/private/tmp/dsh-editor-r182-fixture`，端口 63094）：

- `MM sample.txt`、` M second.txt` 在 Changes 中渲染为单行；
- 目录组与文件行的状态/图标/名称/父路径对齐；
- `pageerror` 无运行时异常（页面仍可继续切换 Project/Commit）。

**已知边界（已解决）**：Changes 窄于约 190px 时的行数列裁切已由 2026-11-15 的
205px 行数隐藏规则处理；当前运行态在 200px 工具窗中不再横向裁切。

## 2026-11-12 — CommitPanel 越界引用导致整块崩溃；diff 未修改区域折叠

**作用域**：Commit Changes 动作条、批量 Rollback、DiffPreview、Editor host 生命周期。

**症状**：

- 切换到 Commit 工具窗口时整块面板空白，浏览器异常为
  `ReferenceError: chosenChanges is not defined`，调用栈落在 `CommitPanel`；
- 长文件 diff 默认全量展开，差异附近缺少 IDEA 的未修改区域折叠；
- 宿主切换/重渲染后可能留下零子节点的 Editor host。

**根因**：

- 上一轮把动作条 Rollback 改成批量选择时，`CommitPanel` 直接调用了
  `EditorWorkspace` 作用域里的 `chosenChanges`，跨组件边界没有 prop。
- Monaco 的 `hideUnchangedRegions` 已存在，但之前没有启用或暴露开关。
- `ensureHost` 只处理激活态的 stale shell，非激活态没有主动丢弃空 host。

**修复**：

- `EditorWorkspace` 传 `chosenChangeList: chosenChanges(selectedChange)`；
  `CommitPanel` 只读 prop，不再引用外层函数。
- Diff 使用 Monaco `hideUnchangedRegions`，默认开启，参数
  `minimumLineCount:4 / contextLineCount:2 / revealLineCount:10`；工具栏开关持久化到
  `dsh-editor.diff.collapseUnchanged`。
- 非激活时 `discardEmptyHost` 销毁空 root；激活时清除 body 下所有 stale host。

**回归**：

```bash
node --test tests/round181.test.mjs tests/round167.test.mjs tests/round179.test.mjs tests/round37b.test.mjs tests/static-order.test.mjs
npm test
```

**运行态**（r179 fixture，63092/63093）：

- `sample.txt` diff 有 4 个 `diff-hidden-lines-widget`；展开后 0 个、存储 `0`；
  再折叠恢复 4 个、存储 `1`；
- 双栏/单栏切换保持折叠 `1` 与 4 个隐藏区；
- Commit 三行正常渲染，`chosenChanges is not defined` 不再出现。
- 全量门禁：776 pass / 0 fail；静态检查与 `git diff --check` 通过。

## 2026-11-12 — Shelve 必须使用 index-aware 恢复；菜单键盘与空 host 修复

**作用域**：Commit Shelve、Changes 批量 Rollback、通用 ContextMenu、Editor host 重建。

**症状/实验**：

- `git stash push --include-untracked -- paths` 能按路径搁置，但普通 `stash apply`
  会把 `MM` 文件退化成只有工作区改动；
- 同一实验里显式 `stash apply --index` 恢复为 `MM`，证明无需自写补丁格式；
- 菜单原先只有方向键处理子菜单，没有上下移动、首项聚焦、关闭回焦；
- ESC 或宿主重挂载后 body 里可能留下零子节点的旧 host，工具窗口看似存在但空白。

**修复**：

- 新增 `gitShelve`，shelve 使用专属 subject 前缀，save 只接收调用方路径，
  apply 固定 `--index`；普通 `gitStash` 保持不变。
- Commit 动作条接入 `Shelve Silently…`，保存当前勾选路径；同菜单提供 Apply/Drop。
- 动作条 Rollback 改为按 Changes 选择集过滤工作区行，保留一次确认/刷新。
- `menuStep` + `ContextMenu` 补 Up/Down、首项聚焦和 Esc 回焦。
- `ensureHost` 移除同 body 所有 stale host 后再重建 React root。

**回归**：

```bash
node --test tests/round179.test.mjs tests/round180.test.mjs tests/round171.test.mjs tests/round167.test.mjs tests/static-order.test.mjs
npm test
```

**运行态**：

- r179 fixture 中搁置 `sample.txt` 后 `second.txt` 保留；恢复后 `sample.txt`
  `staged`/`unstaged` 两行同时回来；
- Project `»` 菜单首项落到可用的 `全部收起`，下键到 `选项`，Esc 回焦到 `»`。
- `PanelToolbar` 的隐藏动作没有 DOM event；新增树区域 anchor 回落后，
  键盘 Enter 执行 `选项` 能打开二级菜单并聚焦首项。

## 2026-11-12 — Commit 动作条溢出与宿主文件图标接入

**作用域**：Commit Changes 动作条、分组标题宽度、Project 文件类型图标、
Terminal 的 Alt+F12 焦点闭环。

**症状**：

- 窄 Commit 面板里 `已暂存 / 未暂存` 被压成 `已… / 未…`；
- 动作条新增动作后没有 `»`，缩窄时按钮越过面板右边界；
- 文件树仍是字母徽标，而参考插件使用宿主官方文件类型图形；
- `Alt+F12` 的静态实现已存在，但缺少真实 PTY 往返证据。

**根因**：

- 组名复用了会 `minWidth: 0 + ellipsis` 的标签样式；
- 固定动作条直接内联六个按钮，没有宽度测量；
- 宽度测量 effect 首轮在 `»` 出现前运行，且依赖只有动作 id，
  ResizeObserver 后续变化不会触发可用数量重算；
- 宿主 `FileTypeIcon` 未声明在 `dsh.client.inject`，客户端也没有可选 require。

**修复**：

- `commitGroupLabel` 改为 `flex: none` + `minWidth: max-content`；
- 抽出 `CompactActionBar`，按面板宽度保留头部动作，剩余进入 `»`；
  effect 依赖加入 `visibleCount`，动作条 `width: 100%` + `box-sizing: border-box`；
- `package.json` 声明 `@deepseek-ai/dsh-client-ui-primitives`，客户端可选
  `require` 宿主 `FileTypeIcon`，失败时保留扩展名徽标；
- `Select Opened File` / `Expand All` / `Collapse All` 接入现有选择与折叠模型。

**回归**：

```bash
node --test tests/round178.test.mjs tests/round171.test.mjs tests/round147.test.mjs tests/round37b.test.mjs tests/static-order.test.mjs
npm test
```

**运行态**（隔离 `/private/tmp/dsh-editor-r178-fixture`，端口 63086/63087）：

- Monaco ↔ xterm `Alt+F12` 连续三次往返；
- 同一 PTY `37fd60a2…` 输出 `R178-FINAL-PTY`，重新打开 Dock 后仍存在；
- 190.75px 动作条六项不越界；120px 时 `»` 为
  `展开所有更改 / 收起所有更改 / 还原所选更改`；
- 组名恢复 36px 完整宽度；文件行渲染宿主 SVG；`pageerror []`。

## 2026-11-12 — Project 工具条窄宽度下保存了错误的一端

**作用域**：`PanelToolbar` 右侧动作组、Project 工具窗口的 IDEA 动作密度。

**症状**：

- Project 工具窗口变窄后，`»` 菜单只有 `选项` 与 `隐藏`；新建、展开所选、
  全部收起等常用动作消失。
- 可见工具条原先平铺刷新、排序、隐藏文件、自动跟随、新建文件、新建目录等动作，
  与 IDEA 的 `New… / Select Opened File / Expand Selected / Collapse All /
  Options / Hide` 不一致。

**根因**：

- 右侧动作组的溢出算法与左侧共用“保留头部”的规则，窄宽度时先丢掉尾部
  `Options / Hide`；`»` 本身又被当作尾部动作，结果只剩低频入口。
- IDEA 的右侧动作组在宽度不足时应保留尾部控制，牺牲中部动作。

**修复**：

- `PanelToolbar` 对右侧组按尾部保留：可见 `right.slice(right.length - fits.right)`，
  隐藏 `right.slice(0, right.length - fits.right)`；左侧仍保留头部动作。
- Project 工具条收口为 `新建文件/目录… / 定位当前文件 / 展开所选 /
  全部收起 / 选项 / 隐藏`，低频动作集中到 `Options`。
- `展开所选` 仅对目录启用，复用 `expandTo`；新建菜单复用
  `startCreate('file'|'directory')`。

**回归**：

```bash
node --test tests/round177.test.mjs tests/round125.test.mjs tests/round145.test.mjs tests/round138.test.mjs tests/static-order.test.mjs
npm test
```

**运行态**（隔离 `/private/tmp/dsh-editor-r177-fixture`，端口 63084/63085）：

- 窄工具条可见 `新建文件 / 新建目录… / 定位当前文件 / 选项 / 隐藏 / 更多操作`；
  `»` 为 `展开所选 / 全部收起`。
- 新建菜单为 `新建文件 ⌘N / 新建目录 ⌥⌘N`。
- 选中 `src` 后 `展开所选` 可用，执行后加载并展开 `nested / a.txt`；
  `pageerror` 为空。
- 空会话没有宿主会话标签栏时，运行态验收需先用页面内空标签栏触发插件注入；
  这是 fixture/宿主边界，不记作 Project 工具条缺陷。

## 2026-11-12 — 批量回滚后选行/勾选语义 & fixture 会话恢复阻塞

**作用域**：Commit Changes 的批量回滚、选择集与提交勾选；ego 运行态 fixture。

**症状**：

- 批量回滚后，主行可能指向已消失的路径，下一次方向键或 `⌘D` 没有落点。
- 原 rollback 无条件 `setCommitSelection(全部 changes)`，会把用户刻意取消的勾选恢复。
- ego 新 Page 在恢复旧 fixture session 时落到「选择工作区」，新建会话只有 Chat，
  没有 Editor 多视图标签，导致标签关闭/回滚的 UI 复测无法继续。

**根因**：

- 回滚只更新 git 数据，没有根据操作前的可视化行序做选择对账。
- `commitSelection` 是提交内容，不是行范围；rollback 不应重选全部。
- fixture 可以复制出多个历史 session；只改写字面量 r45-repo 会漏掉旧 fixture cwd。
  新会话也不会自动继承已有多视图标签。

**修复**：

- `reconcileChangeSelection(changes, removedKeys)`：优先保留仍存在的已选行，
  否则从被移除位置向后找最近存活行；无存活行才清空。
- `rollback` 操作前记录选中键，操作后对账；`setCommitSelection` 只过滤不存在路径，
  不重新全选。
- `prepare-editor-fixture.sh` 扩展 session cwd 重写，覆盖历史 fixture 路径。

**回归**：

```bash
node --test tests/round173.test.mjs tests/round174.test.mjs tests/static-order.test.mjs
npm test
```

**运行态边界**：

- 本轮全量 742 pass / 0 fail；静态门禁通过。
- ego 页面在会话恢复后停在「选择工作区」，新会话无 Editor 多视图；
  宿主端口存活但没有可复用的多视图会话。标签左右关闭最终点击、回滚后 UI
  选行没有可接受的运行态证据，留到下一轮用稳定 fixture 复测。

## 2026-11-12 — 编辑器标签批量关闭会互相覆盖，关闭 diff 不激活相邻标签

**作用域**：Editor 文件标签、Commit/Compare diff 标签、标签右键关闭菜单。

**症状**：

- 关闭其他/全部标签时，循环调用 `closeFile` 只留下最后一次状态更新，
  部分标签可能实际未关闭。
- 文件标签没有 IDEA 的「关闭左侧 / 右侧」。
- 关闭 diff 后只清 `diffTarget`，`diffActive` 仍可能指向不存在的固定标签，
  用户看到空编辑器而不是相邻文件。

**根因**：

- `closeOtherTabs` / `closeAllTabs` 在同一个渲染快照上逐个 `setOpenFiles`，
  每次 updater 都基于旧 ref；最后一个写入覆盖前面结果。
- 标签栏固定把 diff 排在文件前，但没有统一的 `allTabs` 范围关闭函数。
- diff 的关闭路径分散，部分只调用 `setDiffTarget(null)`。

**修复**：

- 引入 `closePaths`：一次计算剩余列表、一次 `setOpenFiles`，脏文件只确认一次；
  当前标签被关闭时按原索引激活相邻标签。
- 引入 `closeEditorTabs(keys)`：以 `allTabs`（diff + files）为顺序执行范围关闭，
  只有 keys 包含 `DIFF_TAB_KEY` 时才清 diff；关闭文件侧不会误清左侧 diff。
- 文件标签菜单加关闭左右；diff 菜单加关闭其他/右侧/全部。
- 所有 diff 关闭入口统一为 `closeDiff()`，同时清 `diffActive` 并回到相邻文件或
  Changes 行。
- 修正 `prepare-editor-fixture.sh`：复制 home 里可能有多个历史 fixture session，
  原脚本只改字面量 `r45-repo`，会把旧 fixture 的真实工作区路径漏过去。

**回归**：

```bash
node --test tests/round174.test.mjs tests/round148.test.mjs tests/editor-round16.test.mjs tests/static-order.test.mjs
npm test
```

**运行态**：

- 隔离 fixture 打开 `CLAUDE.md|graph.ts|notes.md`，再打开 `tmp.txt` diff：
  `commit:|CLAUDE.md|graph.ts|notes.md`。
- `⌘W`：diff 关闭，列表 `CLAUDE.md|graph.ts|notes.md`，`notes.md` 激活，
  focus 进入 Monaco。
- 文件标签右键菜单已出现左侧/右侧关闭；首次复测发现关闭 `graph.ts` 右侧会误清
  左侧 diff，已修复并加入回归断言。
- 该轮后续 ego `reload` 连续 30s/60s 超时；宿主端口 curl 返回 303、进程存活。
  运行态剩余菜单点击验证留待第 175 轮，不能据此宣称全部标签关闭场景已实测。

## 2026-11-12 — Changes 只有单行选择，右键无法批量作用

**作用域**：Commit Changes 的行选择、右键菜单与批量 stage/rollback 快捷键。

**症状**：

- Shift 点击或 Shift+↑/↓ 只移动一行，无法像 IDEA 一样形成连续范围。
- 右键只对点击的那一行生效，即使左侧看起来像多选；
- 暂存/取消暂存与 `⌥⌘Z` 只处理单个路径。

**根因**：

- workspace 只有 `selectedChange`（主行），没有独立于提交勾选的选择集和锚点。
- 右键 payload 只携带 `change`，菜单没有读取其他选中行。
- 快捷键直接取主行 `path`，没有批量过滤 staged/unstaged band。

**修复**：

- 新增 `selectedChanges` 集合与 `changeSelectionAnchorRef`，键为
  `<staged|unstaged>:<path>`；普通点击重置锚点，Shift 扩选，⌘/Ctrl 增减。
- 行新增 `dsh-editor-commit-row-range`；主行仍用 `dsh-editor-commit-row-selected`
  与 `aria-selected`，提交 checkbox 模型不变。
- 右键落在选区外时同步收敛为单行，并直接将该单行传给菜单，避免状态更新竞态。
- 批量菜单显示 `{count}`，stage/rollback/conflict 按选择集执行；
  混合 band 禁用单向 stage；⌘⇧A/⌥⌘A/⌥⌘Z 只处理匹配 band 的选中路径。
- git 刷新时剔除失效选择键。

**回归**：

```bash
node --test tests/round173.test.mjs tests/round172.test.mjs tests/round168.test.mjs tests/round167.test.mjs tests/round143.test.mjs tests/round88.test.mjs tests/round81.test.mjs tests/static-order.test.mjs
npm test
```

**运行态（隔离 fixture，63083）**：

- 单点 `spark/note.md`：1 行 selected；
- Shift 点击 `notes.md`：2 行 range，`notes.md` 为主行；
- ⌘ 点击形成两行选择，右键菜单：
  `已选择 2 个更改 / 显示差异 / 在编辑器中打开 / 取消暂存所选的 2 个文件 / 回滚更改 / 复制相对路径`。

**环境注意**：同一浏览器持久页面在客户端热载后可能保留旧注入实例，
出现“点击有事件但旧 handler 不更新”的假象；运行态验收应强制新页面或重启宿主，
不能据此判定新代码失败。

## 2026-11-12 — Show Diff 没有把焦点交给差异，⌘W 无法关闭差异

**作用域**：Commit Changes 的 `显示差异`、`DiffPreview` 的键盘焦点与关闭路径。

**症状**：

- 选中 Changes 行后打开差异，焦点仍停在 Commit 面板；F7 / 方向键 / 文本选择都不生效，
  用户必须再点一次右侧比较区。
- 差异页没有 `⌘W` 处理；普通 Monaco 编辑器的 Close Tab action 不作用于 diff widget，
  比较页打开后只能点工具栏关闭。
- 关闭差异后，Changes 行的键盘上下文丢失，下一次方向键没有落点。

**根因**：

- diff widget 在挂载时创建、跨 target 复用，但模型换入后的成功回调只有“定位首个 hunk”，
  没有 `modifiedEditor.focus()`。
- `⌘W` 只有普通 Monaco 编辑器内部的 action；diff 页是另一个 widget。
- Changes 的选中状态与 DOM 行没有为 diff 保存“返回焦点”的引用。

**修复**：

- `DiffPreview` 在每次 `waitForDiff()` 完成后定位首个差异并聚焦修改侧；
  `focusDiffRef` 在 diff widget 创建之后赋值，避免挂载阶段读不到 modified editor。
- DiffPreview 的 capture 键盘处理增加 `⌘W` / `Ctrl+W`，文本字段持焦时让键通过，
  其他情况阻止默认行为并调用 `onClose()`。
- workspace 记录 Show Diff / Enter / 双击的来源行；关闭差异时若普通文件标签存在，
  焦点回到文件编辑器，否则回到来源 Changes 行（失效时回落到当前 `selectedChange`）。
- IDEA 实窗验证 `Esc` 不关闭 diff，因此没有把 `Esc` 加入关闭手势。

**回归**：

```bash
node --test tests/round172.test.mjs tests/round171.test.mjs tests/round168.test.mjs tests/round167.test.mjs tests/round166.test.mjs tests/round162.test.mjs
npm test
```

**运行态（隔离 fixture，63083）**：

- `tmp.txt` → `显示差异`：活动元素是 diff 修改侧 Monaco `textarea`；
  `focusedEditors=[false,true]`，hunk `1/1`，tab list `commit:`。
- `F7`：焦点保持修改侧，hunk 计数仍为 `1/1`。
- `ControlOrMeta+W`：diff 关闭、`data-dsh-open-list=""`、活动元素回到
  `.dsh-editor-commit-row-selected`（`tmp.txt`，`aria-selected=true`）。

## 2026-11-11 — Commit 动作条与只读 diff 列头语义

**作用域**：Commit 的 Changes 动作区、工作区 / 暂存区 / 提交 / 修订 / 剪贴板 diff。

**症状**：

- IDEA 的 Changes 工具栏有独立 `Show Diff`，DSH 只能双击或按 `⌘D`，选中行后没有可见入口。
- 提交详情 diff 的左右列头仍写 `HEAD / 当前版本`，读者会误以为它在看工作区；修订与剪贴板比较也有同样问题。

**根因**：动作条完全依赖行手势与快捷键；`sideLabels` 只区分 staged/unstaged，没有读取 `commit`、`revision`、`clipboardText`。

**修复**：

- Changes 列表上方新增 28px 动作条：`刷新`常开，`显示差异`和`还原所选更改`由 `selectedChange` 启停；`显示差异`在目标与选中行一致时保持 pressed。
- `Show Diff` 对同一行是幂等打开，不像双击那样再次触发关闭。
- 列头改为按目标生成：提交详情 `短哈希 / 提交版本`，修订比较 `短哈希 / 当前版本`，剪贴板 `剪贴板 / 当前版本`；工作区与暂存区保持原语义。
- `clampTerminalHeight` 改成与 round170 契约一致的箭头函数，Terminal 高度持久化测试恢复通过。

**回归**：

```bash
node --test tests/round170.test.mjs tests/round171.test.mjs tests/round162.test.mjs tests/round167.test.mjs
npm test
```

**运行态（DSH Web editor-test，63081）**：

- 未选中时动作条为 `刷新可用 / 显示差异禁用 / 还原所选更改禁用`；选中 `tmp.txt` 后两项启用。
- 点击 `显示差异`：`aria-pressed=true`，diff 标签为 `提交: tmp.txt`，双栏列头 `HEAD / 当前版本`，undo/redo 与逐块还原提示存在。
- 日志选中 `aada221` 后打开 `notes.md`：列头 `aada221 / 提交版本`，undo、redo、还原提示均不渲染。
- Terminal 高度拖动后 `localStorage['dsh-editor.terminal.height']='150'`；刷新并重开 Dock 后实测高度 151px
  （含 0.5px 上边框与取整），说明高度确实由持久化值恢复，而不是回落到 220px。

## 2026-11-11 — Project 树长文件名被 ellipsis 截断

**作用域**：Project 工具窗口树行。

**症状**：长文件名在 190px 树中显示为省略号，而 IDEA 保持名称完整并让整棵树横向滚动。

**根因**：`treeName` 的 `minWidth: 0 + ellipsis` 让名称成为最先被压缩的元素，行也没有 intrinsic 宽度。

**修复**：`treeScroll` 明确横向滚动；`treeRow` / `treeName` 使用 `max-content`，
名称 `flex: 0 0 auto` 且 `overflow: visible`。Commit 列表的既有规则保持不变。

**验证**：

```bash
node --test tests/round169.test.mjs
```

运行态：名称 414/414px 完整，树 476/190px 可滚动；方向键/typeahead/展开不受影响。

## 2026-11-11 — Changes 刷新覆盖用户勾选，且键盘列表缺少焦点模型

**作用域**：Commit Changes 列表。

**症状**：手动取消一个文件后，下一次 git status/watcher 刷新又回到“全部选中”；
列表没有键盘选中与 Space 勾选，键盘用户只能依赖鼠标。

**根因**：

- `loadGit()` 无条件 `setCommitSelection(new Set(changes.map(path)))`，把 watcher 刷新当成了
  首次加载。
- Changes 滚动区没有 tabIndex/row identity，行与列表也不共享键盘状态。

**修复**：

- 首次加载才默认全选；后续刷新只保留仍存在的路径，维护用户选择。
- 列表 `role=tree` + `tabIndex=0`，行带 path/staged 标识；↑/↓/Home/End 选中，
  Enter 打开，Space 在 keyup 切换勾选。
- `changeRowRefs` 通过 prop 传入，修复 ReferenceError。

**回归**：

```bash
node --test tests/round168.test.mjs tests/round37b.test.mjs
```

运行态：筛选 `beta` 时仅一行且方向键不越界；Space 取消 `beta` 后 footer 为 2 个文件，
刷新不回弹。

## 2026-11-11 — Commit 单击即开 diff，且 selectedChange 漏解构会清空面板

**作用域**：Commit Changes 列表选择模型与快捷键目标。

**问题**：IDEA 先选中、再双击/Show Diff；旧实现单击直接打开，导致 ⌘D/stage/rollback 只能依赖
上次打开的 diff。新增 `selectedChange` 后还发现 `CommitPanel` 运行时 ReferenceError，
原因是 prop 已传入但函数参数漏了解构，React 把面板渲染为空。

**修复**：

- 单击只选中，双击打开；选中与打开的 diff 用两套 class 区分。
- 快捷键优先作用于 `selectedChangeRef`。
- `loadGit` 同步清理失效的选中行。
- `CommitPanel` 参数补 `selectedChange`；`ensureHost` 对空 React host 重建 root。

**验证**：

```bash
node --test tests/round167.test.mjs tests/round37b.test.mjs
```

运行态：单击选中不打开；双击打开；单击另一行后 ⌘D 打开对应文件；无 pageerror。

## 2026-11-11 — 窄 diff 的 hunk 胶囊只能前进

**作用域**：Commit `DiffPreview` 在 ≤440px 编辑器列下的 hunk 导航。

**症状**：完整工具栏有 ↑/↓，但窄面板只显示一个 `n/total` 胶囊，点击永远前进，无法回退。

**修复**：胶囊左键 `walkHunk('next')`，`⇧`+左键与右键 `walkHunk('previous')`；右键 `preventDefault`。
宽面板箭头与 F7/⇧F7 继续走同一个 `goToDiff` 路径。

**验证**：

```bash
node --test tests/round166.test.mjs tests/round162.test.mjs
```

三 hunk 运行态：完整箭头 `1→2→3→1` / `1→3→2`；360px 胶囊
`2→3`、`⇧` `3→2`、右键 `2→1`，无 pageerror。

## 2026-11-11 — 外部 stage/reset 不改变 mtime，Commit 不会自己刷新

**作用域**：Commit 的 watcher/signature 刷新；diff target 的存活校验。

**症状**：在外部执行 `git add` 或 `git reset` 后，Commit 的 staged/unstaged 分组长时间不变；
已打开的 staged diff 可能仍挂着已消失的 index 侧，后续块还原指向错误状态。

**根因**：

- 递归 rescan 跳过 `.git`；signature 只看 HEAD、变更路径数和文件 mtime。纯索引操作不改工作文件，
  三个字段都不变。
- `diffTarget` 对账只比较路径，不比较 `staged` 侧。

**修复**：

- signature 加入 `.git/index` 的 mtime/size。
- `WorkspaceWatcher` 通过 `git rev-parse --git-path index` 单独 watch index，变更时触发根目录刷新。
- `loadGit` 用 `splitChanges` 核对目标路径仍在它原来的组里；否则关闭 diff。

**回归**：

```bash
node --test tests/round165.test.mjs tests/round152.test.mjs
```

运行态：外部 `git reset` 后 4ms 列表收敛，旧 staged diff 自动关闭，无 pageerror。

## 2026-11-11 — Commit 删除后失效 diff 与 null dispose

**作用域**：Commit 的文件监听刷新、`DiffPreview` 的 Monaco 模型清理。

**症状**：Project watcher 已能刷新 Commit 列表；但正在打开的 diff 可能继续指向已不再出现在
changes 里的路径。清理 listener 时出现 `Cannot read properties of null (reading 'dispose')` 风险。

**根因**：

- Commit 复用了同一个 `WorkspaceWatcher`，`refreshTree + loadGit` 都会执行；问题是 `loadGit`
  没有核对已打开的 `diffTarget` 是否仍有对应的 change 行。
- 清理判断写的是 `!== undefined`，`null` 会漏过去并直接调用 `.dispose()`。

**修复**：

- `loadGit` 的 updater 检查 `value.changes` 是否仍含 `diffTarget.path`；不再包含则关闭 diff。
- 所有 listener / model 清理改为 `!= null` + `dispose?.()`，保留 `setModel(null)` 先 detach 的顺序。

**回归与运行态**：

```bash
node --test tests/round165.test.mjs tests/round89.test.mjs
```

外部删除后列表变 `D`、diff 保留；提交删除后 diff 自动关闭，无 pageerror。

## 2026-11-11 — 跨文件 undo 必须同时切回目标 diff

**作用域**：Commit diff 的 workspace 级 undo/redo 历史。

**症状**：在一个文件还原一块、切到另一个文件后按 `⌘Z`，历史记录写回了正确文件，但界面仍停在
第二个 diff，用户看到的像是 undo 无效。

**根因**：`DiffPreview` 的 `onNavigateRef` 只被调用，父组件却从未传入 `onNavigate`；
历史有 `path/side/staged`，但没有改变 `diffTarget`。

**修复**：父组件传入 `onNavigate(entry)`，把 `diffTarget` 切回 `{path, staged}` 并激活 diff 标签；
回调存入 ref，避免父组件重渲染重绑模型 effect。

**验证**：

```bash
node --test tests/round164.test.mjs
```

运行态（隔离 fixture）：在 `a.txt` 还原后切到 `b.txt`，`⌘Z` 自动回到 `a.txt` 并恢复，
`b.txt` 不变；`⇧⌘Z` 同样回到 `a.txt` 重做。

## 2026-11-11 — Commit 还原实验必须使用隔离 fixture

**作用域**：Commit diff 的 `▸`、undo、redo 运行态验证。

**问题**：真实项目常有未提交改动，直接在 UI 点还原会把开发中的文件写回，且 staged 侧还会改 index；
测试 home 的默认 workspace 也指向真实 `r45-repo`，仅启动测试 profile 不足以保证隔离。

**方案**：用 `scripts/prepare-editor-fixture.sh` 创建 `/private/tmp` 下的 Git fixture，
复制测试 home 后把 workspace/session cwd 全部改指向 fixture；旧目录统一 `mv` 成
`*.previous-<timestamp>`，不删除。运行态测试前先收起会话列表与聊天窗口。

**回归测试**：`tests/round163.test.mjs`

```bash
bash -n scripts/prepare-editor-fixture.sh
node --test tests/round163.test.mjs
```

**已验证**：unstaged `▸` 只写 worktree，`⌘Z` / `⇧⌘Z` 同步；staged `▸` 只写 index，
worktree 两次都保持不变；刷新页面后仍是 `M↓ sample.txt +2 −2`。

## 2026-11-11 — Commit diff 的 hunk 起点与 25% toolbar 溢出

**作用域**：`lib/client.js` 的 `DiffPreview`；Commit 工作区 / 暂存区 diff。

**症状**：

- IDEA 实窗打开差异显示 `1/7`，DSH 在 177px 宽的 Commit diff 里显示 `0/38`。
- 工具栏宽度 177px，但 hunk 计数与关闭按钮的 rect 落到 `701/731px`；`overflow: hidden`
  看不出来，实际无法点击。
- 窄面板下路径提示虽隐藏，文件名仍可能被 toolbar 的非收缩控件挤到 0px。

**根因**：

- `hunkAt` 对“光标在首个 hunk 之前”返回 0；Monaco `revealFirstDiff()` 只滚动，
  不保证 modified caret 已进入首个差异，计数在异步 diff 计算完成前还可能读到旧值。
- toolbar 是单个 flex 行，所有子控件 `flex: none`；当总固有宽度超过 pane 时，
  flex 不会自动换行，只会把尾部控件排到右边界外，再由 `overflow: hidden` 裁掉。
- 动作组的 `flex: 0 1 auto` 压缩的是组容器，不是组内不可收缩的按钮，内部控件仍然溢出。

**修复**：

- `hunkAt` 在存在差异时最小返回 1（无差异仍 `{index: 0, total: 0}`）。
- `waitForDiff()` 后显式把 modified caret 放到首个差异，并刷新计数。
- toolbar 拆成“可收缩标题 + 固定动作组”；≤440px 时隐藏模式文字/路径提示，
  hunk 导航收敛为点击前进的 `n/total` 胶囊；F7 / ⇧F7 保持双向跳转。
- 双栏新增 `HEAD / 索引`、`HEAD / 当前版本` 列头；单栏模式隐藏。

**回归测试**：`tests/round138.test.mjs`、`tests/round162.test.mjs`

```bash
node --check lib/client.js
node --test tests/round138.test.mjs tests/round162.test.mjs
npm test
```

**运行态验证**：editor-test 63081，Commit diff pane 177px：
`actions.right=675 <= pane.right=679`，关闭按钮 24×24 完整可见；
胶囊 `1/1`，双栏列头 `HEAD / 当前版本`；`tmp.txt` 行保持 active；无控制台错误。

大画布验收约定：Commit 测试前先收起左侧会话列表与右侧聊天窗口。按该约定复测时
diff pane 258px，`actions.right=563 <= pane.right=567`，提示行 18px，仍保持
`1/1` 与 `HEAD / 当前版本`。

**注意**：还原类实验优先在 `/private/tmp/dsh-editor-r155-fixture` 等临时 Git 仓库进行，
不要直接对当前真实项目工作区执行回退。

## 2026-11-11 — Monaco diff 的逐块还原按钮在窄面板里是 0×0

**作用域**：`lib/client.js` 的 `DiffPreview`，Commit 的工作区 / 暂存区 diff。

**症状**：已设置 `renderMarginRevertIcon: true`、`renderGutterMenu: false`、`readOnly: false`，
DOM 中也能找到 `.revertButton[title="还原更改"]`，但按钮计算样式为 `display: none`，
所有 rect 都是 `0×0`。

**根因**：diff 的内层 modified editor 在窄面板下没有 glyph margin。Monaco 的
`GlyphMarginWidgets.prepareRender` 在 `glyphMargin === false` 时直接清空渲染请求，
还原按钮因此永远不可见。外层 diff editor 的宽度不足以让这个内层选项自动变宽。

**修复**：创建和更新 diff editor 时显式设置 `glyphMargin: true`。仅对可写回的工作区 /
暂存 diff 开启；历史与比较 diff 保持只读且不显示还原手势。

**验证命令**：

```bash
node --check lib/client.js
npm test
```

运行态验证：editor-test 中 213px 单侧宽度下，按钮 rect 为 19×19，点击后只还原对应块。

## 2026-11-11 — staged diff 将工作区内容误当成 index 右侧

**作用域**：`lib/index.js` 的 `gitDiff({ staged: true })`。

**症状**：同一文件已暂存与未暂存都有改动时，staged diff 的右侧显示工作区的最新内容；
逐块还原会把未暂存内容写进 index。

**根因**：`original` 读取 `HEAD`，`modified` 却统一读取磁盘工作区；staged 模式没有读 index。

**修复**：staged 模式以 `git show :<path>` 作为右侧。新增 `gitApplyChunk` / `gitWriteIndex`：
工作区写文件，index 写 blob 后用 `update-index --cacheinfo` 更新单一路径；写入前比较调用方
加载时的内容，避免覆盖并发改动。

**回归测试**：`tests/git-operations.test.mjs`

```bash
node --test tests/git-operations.test.mjs
```

覆盖未暂存写工作区、已暂存只写索引、根提交新增文件写索引、stale 内容冲突。

## 2026-11-11 — 还原后刷新 diff 触发 Monaco 重复 model URI

**作用域**：`DiffPreview` 的模型装载与还原成功回调。

**症状**：逐块还原后面板出现 `ModelService: Cannot add model because it already exists!`，
diff 短暂变空。

**根因**：还原成功把新的 git status 写回父组件，触发 `target` 引用变化并重跑装载 effect；
旧 model 尚未完成释放时，新 model 使用完全相同的 URI 再次创建。

**修复**：每次装载追加单调递增的 `load` fragment；把“还原成功”和“采用 git status”拆成两个
回调，状态更新不再改变 diff target 的装载身份。

**验证**：同一 `tmp.txt` 两个改动块连续点击 `▸`，磁盘逐块收敛，diff 最终清空，控制台无
`ModelService` 错误。

## 2026-11-11 — 块还原后 `⌘Z` 只回退屏幕、不回退文件

**作用域**：`DiffPreview` 的块还原写回与撤销。

**症状**：点击 `▸` 后按 `⌘Z`，Monaco 界面偶尔显示旧内容，但磁盘仍是还原后的内容；
有时撤销栈直接为空，工具栏“撤销”提示“没有可撤销的块还原”。

**根因（三层叠在一起）**：

1. Monaco 的 diff `revert` 会清空 modified model 自己的 undo stack，原生 `⌘Z` 不一定可用。
2. 一次还原可能触发两次 `onDidChangeContent`；旧的 `savingRef` 在第一次写回期间直接丢弃第二次，
   导致模型与磁盘分叉。
3. 写回成功后更新父组件的 git status，而 `DiffPreview` 的装载 effect 依赖内联的
   `onRestored/onStatus` 回调，父组件重渲染就会重载 diff 并清空撤销记录。

**修复**：

- 显式 `restoreUndoRef`：每次成功还原记录 `{before, after}`，`⌘Z` / 工具栏按钮复用它调用
  `applyChunk`，写回成功后再更新 git status。
- `writeChainRef` 串行化所有还原写回；不再用一个布尔值丢弃并发事件。
- 回调放进 `onRestoredRef/onStatusRef/onNoticeRef`，装载 effect 只依赖 `target`。
- 一次手势用 `activeRestoreRef` 去重，成功后才压入一条撤销记录。

**验证**：

```bash
node --test tests/round156.test.mjs
npm test
```

运行态：`tmp.txt` 两块改动，点第一块后剩 1 块；工具栏撤销或 `⌘Z` 后两块恢复，
模型与磁盘均为 `alpha\nBETA\ngamma\ndelta\nEPSILON\n`。

## 2026-11-11 — 显式撤销栈必须同时维护 redo，且 redo 不能绕过 expected 校验

**作用域**：`DiffPreview` 的 undo/redo。

**症状/缺口**：块还原的原生 Monaco undo stack 已被 `revert` 清空；如果只自建 undo，
用户撤销后无法恢复该还原，等于丢失一个 IDEA 支持的编辑动作。

**修复**：

- `restoreRedoRef` 与 `restoreUndoRef` 对称：undo 成功把 entry 移到 redo，redo 成功移回 undo；
  新块还原清空 redo。
- redo 只改 modified model，再由 `writeChainRef` + `applyChunk(expected: current.modified)` 写回，
  不要直接写文件或索引，否则会被外部修改保护绕过。
- 快捷键同时接受 `⇧⌘Z` 与 `Ctrl+Y`，且仅在事件目标不是输入框/查找框时接管。

**验证**：

```bash
node --test tests/round156.test.mjs
npm test
```

运行态：`tmp.txt` 还原一块 → undo（2 块回来）→ redo（回到 1 块），磁盘同步；
空 redo 栈提示「没有可重做的块还原」。

## 2026-11-11 — 工具窗口宽度默认与持久化

**作用域**：Editor 的 Project / Commit 工具窗口宽度。

**症状**：Commit 默认占 52%，只是打开更改列表就吃掉半个工作区；拖动后的宽度刷新即丢失。

**修复**：

- 默认宽度 Project 26%、Commit 25%。
- `dsh-editor.toolWidth.<project|commit>:<workspace root>` 记忆每个工作区的最近宽度；
  读取时 clamp 到 14%–72%，非法值回落默认。
- 拖动中用 state 实时重排，mouseup 从 `toolWidthsRef` 读最终值再写入，避免闭包里旧的 state；
  `loadRoot` 仅在 root 变化时恢复，不覆盖当前拖动。

**验证**：Commit 默认分隔条 x≈505.75 / 工作区 751px；拖到 41.2% 后持久化，刷新恢复 x≈627.4。

## 2026-11-11 — 选区还原必须构造 Monaco 的嵌套 range 形状

**作用域**：`selectedCharChanges` + `revertRangeMappings`。

**症状**：按钮出现、选区正确，但点击后没有任何变化。

**根因**：`getLineChanges().charChanges` 是扁平字段，而
`DiffEditorWidget.revertRangeMappings()` 读取 `c.modifiedRange` / `c.originalRange`。
直接传扁平对象时两个 range 都是 `undefined`，widget 静默 no-op。

**修复**：每个结果同时保留扁平字段供测试/调试，并补 `{originalRange, modifiedRange}` 嵌套对象；
整行替换的 endColumn=1 落在下一行，按 line interval 判交集，避免列比较漏掉。

**验证**：选中 `BETA` 行点「还原选区内的更改」后，模型和磁盘只剩 `EPSILON`；undo/redo 同步正确。

## 2026-11-11 — 25% Commit 的 diff gutter 与工具栏挤压

**作用域**：Commit diff 在默认四分之一工具窗口里的布局。

**症状**：单侧编辑器约 200px，Monaco 默认 margin 65px（glyph 19 + 行号 36 + 装饰 10），
正文只剩 135px；工具栏的「双栏对比」文字再把 hunk/undo/redo/close 挤出可视区。

**修复**：

- diff 内层编辑器 `lineNumbersMinChars: 2`、`lineDecorationsWidth: 4`，margin 降到 37px，
  正文 163px；`glyphMargin: true` 保持 19px 还原按钮列。
- 编辑器主列命名为 `dsh-editor-editor` 容器，≤440px 隐藏模式文字、只留 27px 图标按钮。
- 不要用 `dsh-editor-side` 容器测量 diff：diff 属于编辑器列，不属于 Commit 树列。

**验证**：`getLayoutInfo()` 为 glyph 19 / line numbers 14 / decorations 4 / content 163；
模式按钮 71→27px；`▸` 仍可见。`npm test` 688 pass。

## 2026-11-11 — staged diff 的 ▸ 是 index-only block revert

**作用域**：Commit 已暂存 diff 的方块还原。

**语义**：IDEA 的 `>>`/`▸` 是统一的 block revert；staged 侧左侧是 HEAD、右侧是 index，
所以点击后只把 index 中的这一块还原成 HEAD 内容。它不是一个额外的 “stage this hunk” 手势。

**实现**：`DiffPreview` 依 `target.staged` 显示不同提示；`applyChunk(side: 'index')` 用
`hash-object` + `update-index --cacheinfo` 写 index。undo/redo 记录里也保留 `side: 'index'`，
因此三条路径都不会写工作区。

**运行态验证**：

```text
before: index alpha/beta/gamma/delta ; worktree alpha/BETA/gamma/delta/EPSILON
▸      : index tmp ; worktree unchanged
⌘Z     : index alpha/beta/gamma/delta ; worktree unchanged
⇧⌘Z    : index tmp ; worktree unchanged
```

**注意**：测试 fixture 的 `BETA` 是未暂存改动，staged 还原后它仍在工作区，这是正确语义，
不是“还原失败”。
