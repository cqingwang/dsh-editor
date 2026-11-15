# dsh-editor 工程记忆

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
