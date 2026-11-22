# dsh-editor 工程记忆

本文件只记录长期有效的架构约束、设计规范、关键根因和回归边界。单轮命令输出、
临时端口、PR 过程、重复测试数字不在这里长期保留。

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
