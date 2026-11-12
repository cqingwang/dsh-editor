# dsh-editor 工程记忆

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

**已知边界**：Changes 窄于约 190px 时，固定行数列仍可能被裁；下一轮按 IDEA 的窄窗策略降级行数或改用更紧凑显示，并补真实宽度断言。

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
