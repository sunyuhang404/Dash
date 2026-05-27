# Dash 技术规格书：跨平台 Git 桌面客户端（CEF + Vue 3 TSX + libgit2）

## 1. 产品定位与完整功能

本文档先定义 Dash 的完整产品设计，包括全部规划功能、页面交互、数据契约和原生实现约束；文档末尾再从完整设计中划分首期 MVP 与逐步实施路径。MVP 是交付顺序，不是总体设计的上限。

Dash 是面向 Windows 与 macOS 的桌面 Git 客户端。应用以 CEF 作为原生窗口和 Chromium 渲染容器，以 Vue 3 + TypeScript + TSX 构建交互界面，以 libgit2 提供本地仓库读取及写入能力。

### 1.1 产品愿景

- 提供接近 IDE 与成熟 Git GUI 的仓库浏览、提交、同步与冲突解决体验。
- 允许用户同时打开多个仓库，在一个桌面工作台内快速切换上下文。
- 对复杂 Git 行为提供可理解的中文解释、明确的风险确认和可恢复的操作流程。
- 在大型仓库、较长历史和较大 Diff 场景下保持流畅交互。

### 1.2 完整功能地图

| 功能域 | 完整设计能力 |
| --- | --- |
| 仓库管理 | 添加本地仓库、克隆远程仓库、移除列表记录、分组、最近访问、自动检查远程更新 |
| 多仓库工作台 | 左侧仓库菜单、折叠导航、多页签打开、各页签独立选择/滚动/视图状态、待拉取徽标 |
| 工作区与暂存区 | 文件状态、文件级 `Stage`/`Unstage`、按 hunk 的 `Stage Selected`/`Unstage Selected`、提交信息输入 |
| 历史与引用 | Commit Graph、分页历史、提交详情、分支、远程分支、Tag、搜索与过滤 |
| 本地提交与恢复 | `Commit`、`Undo` 最近未推送提交并选择恢复到 staged/unstaged、后续可扩展 `Revert`/`Cherry-pick` |
| 分支工作流 | `Branch`、`Checkout`、`Merge`、冲突处理；复杂 rebase 作为高级能力设计项 |
| 远程同步 | `Fetch`、`Pull`、`Push`，支持选择 remote 与目标分支、upstream 管理、认证提示 |
| 临时改动管理 | `Stash`、stash 列表、`Apply`、`Pop`，冲突时进入统一合并流程 |
| Diff 与合并 | 普通 Diff、修改块选择应用、三栏冲突合并、逐块接收、结果编辑与 `Mark Resolved` |
| 系统能力 | 目录监听自动刷新、暗色主题、无边框窗口、高 DPI、日志与错误诊断、发布与更新能力 |
| 平台集成扩展 | 代码托管平台登录、PR/MR 工作流、submodule 管理与高级历史整理，可在基础能力稳定后接入 |

### 1.3 主要用户流程

1. 用户通过“添加仓库”或克隆入口，把仓库加入左侧列表。
2. 双击一个或多个仓库，右侧为每个仓库创建独立工作页签。
3. 在活动仓库中查看工作区、按文件或修改块暂存内容并执行 `Commit`；提交错误时使用 `Undo` 安全撤销。
4. 浏览历史图谱和 Diff，通过 `Branch`、`Checkout`、`Merge` 管理本地开发流。
5. 通过 `Fetch` 检查远程变化，选择明确目标执行 `Pull` 或 `Push`。
6. 使用 `Stash` 临时保存工作，之后通过 `Apply` 或 `Pop` 恢复。
7. 遇到冲突时进入三栏合并编辑器，选择两侧修改形成 `Result` 并标记解决。

### 1.4 设计原则

- **不阻塞界面**：Git 查询、磁盘扫描及大型 Diff 计算不得运行在 CEF UI 线程或渲染主线程。
- **接口先行**：Vue 只依赖稳定的 RPC 契约，不直接感知 libgit2 类型或平台实现。
- **默认安全**：写操作必须由明确用户动作触发，危险操作需要二次确认，并对路径与参数做校验。
- **可观测且可测试**：每个原生请求均携带请求标识、耗时与可诊断错误信息。
- **完整设计、分期交付**：页面与接口先围绕整体产品能力规划，MVP 只挑选其中优先实现的一部分，不通过临时设计阻碍后续扩展。

---

## 2. 总体架构

```text
+----------------------------------------------------------------------------+
| Renderer Process                                                           |
| Vue 3 TSX UI | Pinia Stores | Canvas Git Graph | Monaco Diff | RPC Client     |
+------------------------------------+---------------------------------------+
                                     | window.cefQuery (JSON-RPC request)
                                     | process message / event bridge
+------------------------------------v---------------------------------------+
| Browser Process                                                            |
| Window Host | CefMessageRouter Handler | RPC Dispatcher | Event Publisher  |
+------------------------------------+---------------------------------------+
                                     | enqueue / cancellation / result
+------------------------------------v---------------------------------------+
| Native Service Layer                                                       |
| Worker Pool | Repository Sessions | File Watcher | DTO Serialization       |
+------------------------------------+---------------------------------------+
                                     | libgit2 API / OS file notification
+------------------------------------v---------------------------------------+
| Repository and Platform Layer                                              |
| .git / working tree | Windows filesystem APIs | macOS filesystem APIs       |
+----------------------------------------------------------------------------+
```

### 2.1 进程与职责边界

| 模块 | 所属位置 | 核心职责 | 禁止事项 |
| --- | --- | --- | --- |
| Vue TSX UI | Renderer Process | 视图、交互、状态展示、虚拟列表 | 直接执行文件系统或 Git 操作 |
| RPC Client | Renderer Process | 参数封装、超时、取消、错误映射 | 拼装平台相关路径行为 |
| RPC Dispatcher | Browser Process | 路由、校验、调用调度、响应发送 | 在 UI 线程执行耗时任务 |
| Native Service | Browser Process 内的后台工作线程 | 调用 libgit2、构造 DTO、维护仓库会话 | 操作 Vue 状态或 V8 对象 |
| File Watcher | 原生后台服务 | 监听仓库变化、合并通知 | 将每次文件变化原样推送到前端 |

总体架构默认将 Native Service 放在 Browser Process 内，通过工作线程执行任务。若未来需要增强崩溃隔离，可将 Git 服务拆分为独立辅助进程，RPC 契约无需改变。

### 2.2 线程模型与生命周期

1. `main` 启动时初始化 CEF；在 Git 服务正式接受请求前调用一次 `git_libgit2_init()`。
2. CEF UI 线程仅负责窗口、路由注册、请求入队与结果回传。
3. 所有仓库打开、状态读取、历史遍历、Diff 生成及写操作均提交至有界 Worker Pool。
4. 每个请求持有 `request_id`、取消令牌、仓库会话句柄与截止时间。界面离开仓库或新查询替代旧查询时，可以取消仍在排队的任务；正在执行且不可中断的 libgit2 调用，其结果应被丢弃。
5. Worker 返回纯 DTO 后，Browser Process 必须切回正确的 CEF 线程再完成 `CefMessageRouter` 回调或事件发送，不得跨线程访问浏览器对象或 V8 上下文。
6. 应用退出时先停止接收请求，关闭 watcher，等待或取消后台任务，释放仓库句柄，最后成对调用 `git_libgit2_shutdown()`。

### 2.3 仓库会话

打开仓库成功后，原生层为其创建 `repo_id`，前端后续请求优先传递该标识而不是反复发送绝对路径。

- `repo_id` 只在当前应用进程有效，不持久化为用户配置。
- 原生层保存规范化后的仓库根目录，并校验所有文件参数仍位于工作树内。
- 同一仓库的写操作串行执行；只读查询可并发执行，但刷新型查询应通过版本号丢弃旧结果。
- 最近打开仓库列表只持久化路径和显示名称，不保存凭据。

---

## 3. 技术选型与工程结构

### 3.1 技术栈

| 领域 | 选型 | 说明 |
| --- | --- | --- |
| 开发 IDE | CLion | 用于代码编辑、CMake Profile 管理、构建与调试入口；不替代 C++ 编译器 |
| 原生外壳 | C++20 + CEF | 窗口、进程生命周期、IPC |
| Windows 工具链 | MSVC x64 + Windows SDK | 由 Visual Studio 安装提供，在 CLion 中配置使用；适配 CEF Windows SDK |
| 构建系统 | CMake + CMake Presets | 作为工程构建真源，供 CLion 与命令行共同使用 |
| Git 引擎 | libgit2 静态或随应用分发的动态库 | 版本在构建配置中固定并记录许可证 |
| 前端 | Vue 3 + TypeScript + TSX + Vite | Composition API、`.tsx` 组件与严格类型；不使用 `.vue` SFC |
| 状态管理 | Pinia | 仓库、选择项、查询状态分离 |
| 样式 | Tailwind CSS | 暗色优先；所有可控页面元素保留语义类名，便于统一调整 |
| 提交图 | Canvas 2D + 虚拟滚动 | 避免为完整历史创建大量 DOM |
| Diff 查看 | Monaco Diff Editor | 支持只读查看、语言识别、延迟装载 |
| JSON | 原生成熟 JSON 库，如 `nlohmann/json` | 禁止手工拼接 JSON |
| 测试 | Vitest + Playwright + CTest | 前端单元/界面测试与原生服务测试 |

### 3.2 推荐目录结构

```text
Dash/
  CMakeLists.txt
  CMakePresets.json
  CMakeUserPresets.json      # 本机 CEF_ROOT 等个人配置，不提交
  cmake/
  native/
    app/                 # CEF 初始化、进程入口和应用生命周期
    window/              # Windows/macOS 窗口适配
    bridge/              # RPC dispatcher、事件通道、DTO
    git/                 # libgit2 封装、仓库会话和操作服务
    watcher/             # 平台目录监听
    tests/
  fe/
    src/
      api/               # RPC client 与类型声明
      stores/
      pages/
      components/
        graph/
        diff/
      composables/
      types/
      mocks/
    tests/
  resources/             # 图标、CEF 资源和打包资源
  doc/
    doc.md
```

CLion 直接打开仓库根目录中的 CMake 工程。仓库提交通用 `CMakePresets.json`，本机的 CEF 路径和 CLion 调试配置通过不提交的 `CMakeUserPresets.json` 或本地 Profile 管理；`.idea/` 和 `cmake-build-*/` 应加入 `.gitignore`。

### 3.3 平台实现约束

#### Windows

- 支持 Windows 10 及以上 x64 版本；首个版本不承诺 ARM64。
- Windows 开发环境使用 CLion 打开 CMake 工程，并以 MSVC x64 + Windows SDK 作为编译链接工具链；构建输出必须与官方 CEF Windows x64 分发包兼容。
- 自定义标题栏时正确处理 `WM_NCCALCSIZE`、窗口拖动、最大化区域、DPI 变化及系统缩放。
- CEF 初始化时启用高 DPI 支持，布局尺寸仍由前端按 CSS 像素表达。
- UI 与 RPC 传输中的路径统一使用 UTF-8。调用 Win32 文件系统接口时在原生边界转换为 UTF-16；传入 libgit2 的路径必须使用已验证可工作的 UTF-8 形式，并覆盖含中文路径的集成测试。

#### macOS

- 支持当前构建环境确定的最低 macOS 版本，并同时规划 Apple Silicon 与 Intel 架构产物。
- 原生窗口使用透明标题栏和 full-size content view；窗口关闭、最小化、全屏仍调用系统能力。
- 文件变更监听使用 FSEvents，并将批量事件合并到仓库级刷新事件。

---

## 4. 前端交互与状态模型

### 4.1 页面布局

页面采用“左侧仓库菜单栏 + 右侧多页签仓库工作区”的桌面布局。应用启动时右侧不默认打开仓库，用户双击左侧仓库项后创建或激活对应仓库页签。

| 区域 | 内容 | 关键交互 |
| --- | --- | --- |
| 左侧仓库菜单栏 | 添加仓库按钮、仓库列表、折叠/展开按钮 | 添加、双击打开仓库、切换导航栏宽度 |
| 右侧空状态 | 初始欢迎提示和操作引导 | 未打开仓库时提示“从左侧双击仓库开始工作” |
| 右侧页签栏 | 已打开仓库页签、活动页签、关闭入口 | 多开仓库、切换仓库、关闭页签 |
| 仓库工具栏 | 当前分支与 Git 相关操作按钮 | `Fetch`、`Pull`、`Push`、`Merge`、`Commit`、`Undo`、`Stash`、`Branch`、`Checkout`、`Refresh` 等 |
| 仓库内容区 | 文件状态、提交历史/图谱、提交详情和 Diff | 类似常规 Git GUI 的浏览和操作工作流 |

布局结构示意：

```text
+------------------+-------------------------------------------------------------+
| + 添加仓库        | [仓库 A x] [仓库 B x]                           窗口控件   |
+------------------+-------------------------------------------------------------+
| 仓库 A        3↓  | 仓库 A/main Fetch Pull Push Merge Commit Undo Stash Refresh |
| 仓库 B            +----------------------+--------------------------------------+
| 仓库 C        1↓  | 文件状态/分支/标签     | 提交历史 + Graph / 提交详情 + Diff   |
|                  |                      |                                      |
|                  +----------------------+--------------------------------------+
|              [<] | 提交信息输入 / 暂存文件 / 提交操作                            |
+------------------+-------------------------------------------------------------+
```

未打开仓库时：

```text
+------------------+-------------------------------------------------------------+
| + 添加仓库        |                                                             |
+------------------+            欢迎使用 Dash                                     |
| 仓库 A            |          从左侧双击仓库开始工作                               |
| 仓库 B            |                                                             |
|              [<] |                                                             |
+------------------+-------------------------------------------------------------+
```

#### 4.1.1 左侧仓库菜单栏

- 左侧菜单栏仅负责管理用户已添加的仓库列表，不在这里混放当前仓库的分支和标签。
- 展开状态默认宽度建议为 `240 px`，顶部固定显示带 `+` 图标的“添加仓库”按钮。
- 仓库项展示仓库小图标、仓库显示名称和远程待拉取徽标。默认图标可使用 `div` 绘制圆角方块，内容取仓库显示名称的首个可见字符；未来允许用户为仓库配置自定义图标。
- 双击仓库项：若该仓库尚未打开，在右侧新增页签并激活；若已经打开，仅激活已有页签，不重复创建。
- 菜单底部右侧固定一个折叠按钮。折叠后宽度建议为 `80 px`，只显示添加按钮图标、仓库首字母图标和展开按钮；仓库名称通过 hover tooltip 展示。
- 展开/折叠状态应持久化为用户界面偏好，下次启动沿用上次选择。
- 待拉取徽标使用例如 `3↓` 的紧凑形式；鼠标悬浮显示“远程有 3 个提交可拉取”。仅当已知 `behind > 0` 时显示。
- `behind` 数量基于最近一次成功 `Fetch` 后的本地远程跟踪引用计算。未执行 `Fetch` 时不得把数量描述为远程实时状态，可显示“尚未检查远程更新”提示。

#### 4.1.2 添加仓库弹窗

点击菜单栏顶部“添加仓库”按钮，打开中文弹窗。弹窗提供“添加本地仓库”和“克隆远程仓库”两个标签页。

“添加本地仓库”字段：

| 字段 | 必填 | 输入方式 | 规则与说明 |
| --- | --- | --- | --- |
| 仓库路径 | 是 | 文本框 + “选择文件夹”按钮 | 绝对目录；选择后校验是否可被识别为 Git 仓库 |
| 显示名称 | 否 | 文本框 | 默认取目录名称；只影响客户端列表和页签名称，不修改仓库 |
| 分组 | 否 | 下拉选择/可新建 | 如“工作”“个人”，默认归入未分组 |
| 打开后自动检查远程更新 | 否 | 开关 | 开启后打开页签时自动执行一次 `Fetch`，可能触发网络和认证 |

“克隆远程仓库”字段：

| 字段 | 必填 | 输入方式 | 规则与说明 |
| --- | --- | --- | --- |
| 仓库地址 | 是 | 文本框 | 支持 HTTPS/SSH URL；提交前校验格式 |
| 本地保存目录 | 是 | 文本框 + “选择文件夹”按钮 | 指定克隆目标父目录或完整目标路径 |
| 显示名称 | 否 | 文本框 | 默认由仓库地址推导；不修改远程仓库名称 |
| 分组 | 否 | 下拉选择/可新建 | 克隆完成后写入左侧菜单分组 |
| 克隆后打开仓库 | 否 | 开关 | 默认开启，完成后直接创建右侧页签 |

弹窗操作与状态：

- 标题、标签和校验信息使用中文，例如“添加本地仓库”“请选择一个有效的 Git 仓库目录”。
- “添加本地仓库”标签页底部按钮为“取消”和“添加”。路径未通过校验前，“添加”按钮不可用。
- “克隆远程仓库”标签页执行按钮使用英文 `Clone`，中文 tooltip 为“从远程地址克隆仓库到本地目录”；URL 或目录未通过校验时按钮不可用。
- 若仓库已在列表中，提示“该仓库已添加”，并提供“打开仓库”动作，不新增重复记录。
- 添加或克隆成功后仓库出现在左侧列表中；根据用户选择决定是否立即打开对应页签。

#### 4.1.3 右侧空状态与多仓库页签

- 未打开任何仓库时，右侧仅显示空状态，可使用一行主提示“从左侧双击仓库开始工作”和辅助提示“也可以点击 + 添加本地仓库”。
- 每个打开的仓库对应一个页签，页签展示图标、显示名称、当前分支简写以及关闭按钮。
- 存在未提交变更时，页签显示小圆点或状态提示；关闭页签只关闭界面会话，不应丢弃仓库修改。
- 活动页签决定右侧内容和命令工具栏指向的 `repo_id`。不同页签的选中提交、Diff 文件和滚动位置分别保留。
- 关闭最后一个页签后，右侧恢复空状态。

#### 4.1.4 单个仓库页签内部布局

仓库页签内容参考常见 Git GUI（如 SourceTree）的信息组织方式，但样式和交互实现保持 Dash 自身一致：

| 区域 | 内容 | 设计内容 |
| --- | --- | --- |
| 命令工具栏 | 仓库名、分支名、`Fetch`、`Pull`、`Push`、`Merge`、`Commit`、`Undo`、`Stash`、`Branch`、`Checkout`、`Refresh` | 操作入口清晰、状态可禁用、具有中文 tooltip |
| 内部左栏 | 文件状态入口、分支、本地/远程引用、标签、贮藏列表 | 与全局仓库菜单栏区分；只属于活动仓库 |
| 工作区视图 | 未暂存、已暂存文件列表、冲突列表和提交消息输入 | 支持 Stage/Unstage、分块暂存、冲突处理与 Commit 流程 |
| 历史视图 | Commit Graph 与提交摘要列表 | 支持选择提交和滚动分页 |
| 详情/Diff 视图 | 选中提交信息、变更文件和 Monaco Diff | 填充可读的主要查看空间 |

仓库内容区将“工作区”和“历史”作为主要中文视图标签；用户选中文件或提交后，在右侧显示详情/Diff。

#### 4.1.5 文案与 Git 操作按钮语言规则

- 客户端常规界面文案全部使用中文，包括弹窗、标签、空状态、错误提示、设置项及视图名称。
- 只要按钮会读取、比较或修改 Git 仓库状态，按钮文字都使用英文，不要求它必须是 Git CLI 的原生命令。例如 `Clone`、`Fetch`、`Pull`、`Push`、`Merge`、`Commit`、`Stage`、`Unstage`、`Stash`、`Apply`、`Pop`、`Branch`、`Checkout`、`Undo`、`Refresh`。
- 与 Git 操作无关的客户端界面按钮仍使用中文，例如“添加仓库”“取消”“关闭页签”“展开”“收起”。
- `Undo` 是 Dash 对“撤销最近一次本地提交”能力提供的英文操作名称；中文 tooltip 和确认框说明必须明确其作用，避免与 `Revert`/`Reset` 混淆。
- 每个英文 Git 操作按钮必须提供中文 tooltip，并可补充禁用原因和执行结果。

| 按钮 | 中文悬浮说明 |
| --- | --- |
| `Clone` | “从远程地址克隆仓库到本地目录” |
| `Fetch` | “获取远程最新信息，但不修改当前工作区” |
| `Pull` | “拉取远程提交并合并到当前分支” |
| `Push` | “将本地分支推送到选定的远程分支” |
| `Merge` | “将选定分支合并到当前分支” |
| `Commit` | “提交已暂存的文件变更” |
| `Undo` | “撤销最近一次未推送的提交，并选择将改动恢复到已暂存区或未暂存区” |
| `Stage` | “将所选文件加入暂存区” |
| `Unstage` | “将所选文件移出暂存区” |
| `Stash` | “临时保存当前未提交的文件改动” |
| `Apply` | “应用所选贮藏内容，并保留该贮藏记录” |
| `Pop` | “应用所选贮藏内容，成功后移除该贮藏记录” |
| `Branch` | “创建或管理分支” |
| `Checkout` | “切换到其它分支或提交” |
| `Refresh` | “重新读取当前仓库状态” |
| `Stage Selected` | “仅将选中的修改点加入暂存区” |
| `Unstage Selected` | “仅将选中的修改点移出暂存区” |
| `Apply Selected` | “将冲突两侧当前勾选的修改应用到结果内容” |
| `Mark Resolved` | “确认当前文件冲突已解决，并将结果加入暂存区” |

`Unstage` 只表示从已暂存区移回未暂存区。`Apply` 和 `Pop` 属于 `Stash` 列表中的操作：二者都会应用暂存的贮藏内容，区别在于 `Apply` 保留贮藏记录，`Pop` 在应用成功后移除记录。

#### 4.1.6 `Undo` 操作交互定义

本项目中的 `Undo` 特指**撤销当前分支最近一次由本地完成、且尚未推送到上游的 `Commit` 操作**。它不是丢弃代码修改，也不是针对任意历史提交生成反向提交。

共同行为：

- 回退当前分支 `HEAD` 到最近一次提交之前的位置。
- 不删除文件内容修改；用户必须在确认弹窗中选择撤销后改动所处的状态。
- 不删除工作区中提交之后产生的额外修改；若当前状态使 `Undo` 结果难以安全表达，应禁止操作并提示原因。
- 成功后自动切换到“工作区”视图，突出显示恢复的文件，并根据用户选择显示对应中文结果提示。

恢复方式：

| 选项 | 界面说明 | Git 语义 | 成功后的文件状态 |
| --- | --- | --- | --- |
| 恢复到已暂存 | “撤销提交，改动保留在已暂存区，可直接重新提交” | 等价于 `git reset --soft HEAD~1` | 被撤销提交的改动位于 staged |
| 恢复到未暂存 | “撤销提交，改动保留在未暂存区，可继续编辑后重新暂存” | 等价于 `git reset --mixed HEAD~1` | 被撤销提交的改动位于 unstaged |

“恢复到未暂存”会将 index 重置到父提交状态。如果用户在最近提交之后又暂存了新的改动，这些额外暂存内容也会变为未暂存，不会删除文件内容；确认框中必须提示这项影响。

启用条件与风险限制：

- 仅在当前分支存在可撤销的最近一次提交时显示为可用。
- `Undo` 只允许撤销**尚未推送**的本地提交。点击 `Undo` 前必须成功刷新上游状态，或能够确认当前分支没有上游；当最近提交已经包含在上游远程分支中时，`Undo` 按钮禁用，tooltip 显示“该提交已推送，不能直接撤销提交记录”。
- 对已经推送的提交，未来可另行提供符合共享历史安全原则的 `Revert` 功能；它会创建新提交，不属于本次 `Undo` 定义。
- 当前分支处于冲突、合并进行中、rebase 进行中或无法确定 upstream 状态时，不允许执行 `Undo`。
- 初始提交的撤销需要单独处理 unborn branch/index 行为：撤销后分支恢复为尚无提交状态，同时按照用户选择保留 staged 或 unstaged 改动。

确认弹窗：

| 内容 | 要求 |
| --- | --- |
| 标题 | “Undo 最近一次提交？” |
| 提交摘要 | 展示将撤销的短 SHA、提交说明和提交时间 |
| 恢复方式 | 必选单选项：“恢复到已暂存”与“恢复到未暂存”；默认选择“恢复到已暂存” |
| 影响说明 | 根据所选方式说明改动将进入已暂存区或未暂存区；选择未暂存时额外说明现有 staged 内容也将取消暂存 |
| 风险校验结果 | 展示“尚未推送，可以 Undo”或禁用原因 |
| 按钮 | 非 Git 操作按钮为“取消”；执行撤销提交的确认按钮文字为 `Undo` |

#### 4.1.7 `Push`、`Merge` 与 `Stash` 交互定义

##### `Push` 目标选择

点击 `Push` 后打开中文确认弹窗，用户应能确认推送来源与目标，而不是始终隐式推送到同名分支。

| 字段 | 默认值 | 说明 |
| --- | --- | --- |
| 本地分支 | 当前分支，只读 | 本次将被推送的本地引用 |
| 远程仓库 | 当前 upstream 对应 remote；没有 upstream 时默认为 `origin` | 支持从已配置 remote 中选择 |
| 目标分支 | 与本地分支同名 | 允许选择已有远程分支或输入新的远程分支名称 |
| 设置为 upstream | 当前无 upstream 时默认开启 | 推送成功后将当前本地分支追踪到所选远程目标 |

- 目标分支与本地分支不同或目标已有不兼容历史时，弹窗显示明确中文警告。
- 主工具栏不提供强制推送选项；发生 non-fast-forward 拒绝时，提示用户先 `Fetch`/`Pull` 或检查目标分支。若将来提供 force push，只能放在高级操作中并进行强风险确认。

##### `Merge`

- `Merge` 按钮打开中文弹窗，当前分支作为接收合并结果的目标分支并只读展示。
- 用户选择要合入的本地分支或远程跟踪分支；默认优先 fast-forward，无法 fast-forward 时创建普通 merge commit。
- 标准 `Merge` 默认不执行 squash merge、rebase merge 和强制覆盖；高级历史整理功能可在独立高级入口中提供。产生冲突时自动进入三栏冲突处理视图。

##### `Stash`、`Apply` 与 `Pop`

- `Stash` 按钮为当前工作区创建贮藏，弹窗支持输入可选中文备注，并明确是否包含未跟踪文件；默认不包含 ignored 文件。
- 仓库内部左栏显示“贮藏”分组和 stash 记录列表，列表项展示备注、创建时间与变更文件数量。
- 选中一条 stash 后显示英文操作按钮 `Apply` 和 `Pop`；`Apply` 应用内容但保留记录，`Pop` 仅在应用成功且无未解决冲突时移除记录。
- `Apply`/`Pop` 产生冲突时进入三栏冲突处理视图，stash 记录状态保持可追踪，避免内容丢失。

页面实现约束：

- 产品为桌面客户端，设计基准尺寸为 `1440 x 900`；宽度较小时允许右侧 Diff 区域优先压缩。
- 仓库菜单栏、添加仓库弹窗、仓库页签栏、仓库工具栏、Push/Merge/Stash 弹窗、仓库内部导航、历史列表、Diff 面板、冲突三栏编辑器和工作区面板拆为独立 Vue TSX 组件。
- 完整交互设计覆盖无仓库空状态、展开/折叠菜单、待拉取徽标、多仓库页签、部分暂存和三栏冲突处理。
- 动画、可拖拽面板尺寸和更细的视觉优化不得破坏既定信息结构与 Git 操作流程。

### 4.2 TSX 组件与 Tailwind 类名规范

前端样式全部使用 Tailwind CSS 编写。为了后期可以快速定位并整体修改某个区域的样式，每个由项目模板直接创建、且会被布局或交互控制的 HTML 元素，都必须包含一个稳定的语义类名，同时附加 Tailwind 工具类。

#### TSX 组件规则

- UI 组件文件统一使用 `.tsx`，例如 `repository-nav.tsx`、`add-repository-modal.tsx`、`repository-tabs.tsx`；不得创建 `.vue` 单文件组件。
- 使用 Vue 3 Composition API 与 `defineComponent`；新组件通过 `setup: (props, context) => () => (...)` 返回 JSX/TSX 渲染内容。
- 组件、事件处理器和渲染辅助函数使用 `const` 箭头函数；保持 TypeScript 严格类型，不使用 `any` 规避数据结构定义。
- 类型导入使用 `import type`；DTO、store 与组件 props 的边界必须显式定义。
- 渲染表达式中不执行 RPC、状态写入、计时器或路由跳转等副作用；异步操作放在具名 handler 或 store action 中。
- 列表渲染提供稳定 `key`；交互元素优先使用语义化标签并提供 `type="button"`、`aria-label` 或 tooltip。

#### 命名规则

- 语义类名前缀统一为 `dash-`，格式为 `dash-区域-元素[-状态]`，例如 `dash-repo-nav-add-button`、`dash-repo-tab`、`dash-history-row`、`dash-worktree-commit-button`。
- 语义类名描述元素职责，不描述颜色和尺寸；禁止命名为 `dash-blue-box`、`dash-w-240` 等与视觉值绑定的名称。
- Vue TSX 组件根节点必须有与组件职责对应的类名，例如 `repository-nav.tsx` 根节点使用 `dash-repository-nav`。
- 循环列表中的相同结构复用相同语义类名，并通过 `data-*` 或状态类标识业务状态，例如 `dash-history-row is-selected`。
- 状态样式优先使用 TSX 中对象或数组形式的 `class` 条件绑定；状态标记类允许使用 `is-selected`、`is-loading`、`has-conflict`，便于调试定位。
- Monaco 内部生成的 DOM、第三方组件内部结构和 Canvas 内绘制对象不要求逐元素增加类名；包裹它们的项目容器仍必须命名。

#### TSX 组件示例

```tsx
import { defineComponent, type PropType } from 'vue';

interface RepositoryNavItem {
  id: string;
  name: string;
  initial: string;
  behind: number;
}

export const RepositoryNav = defineComponent({
  name: 'RepositoryNav',
  props: {
    repositories: {
      type: Array as PropType<RepositoryNavItem[]>,
      default: () => [],
    },
  },
  emits: {
    add: () => true,
  },
  setup: (props, { emit }) => {
    const handleAdd = () => {
      emit('add');
    };

    return () => (
      <aside class="dash-repository-nav flex w-60 flex-col border-r border-slate-800 bg-slate-950">
        <button
          class="dash-repo-nav-add-button m-3 rounded-md px-3 py-2 text-sm text-slate-200 hover:bg-slate-800"
          type="button"
          onClick={handleAdd}
        >
          + 添加仓库
        </button>
        {props.repositories.map((repository) => (
          <div
            class="dash-repo-nav-item flex items-center gap-2 px-3 py-2 text-slate-100"
            key={repository.id}
          >
            <div class="dash-repo-nav-icon flex size-9 items-center justify-center rounded-lg bg-slate-700">
              {repository.initial}
            </div>
            <span class="dash-repo-nav-name truncate">{repository.name}</span>
            {repository.behind > 0 && (
              <span class="dash-repo-nav-behind-badge ml-auto text-xs text-sky-400">
                {repository.behind}↓
              </span>
            )}
          </div>
        ))}
      </aside>
    );
  },
});
```

#### Code Review 检查项

- 新增 TSX 元素是否同时具备 `dash-*` 语义类名和所需 Tailwind 工具类。
- 新增 UI 文件是否为 `.tsx`，且没有引入 `.vue` SFC 或 Options API 写法。
- 是否出现大量自定义 CSS 替代 Tailwind；只有 Monaco、Canvas 尺寸同步或操作系统拖动区域等特殊场景允许补充少量 CSS。
- 类名是否能从浏览器开发工具中快速判断所属区域和用途。
- 修改布局时是否只改动对应组件，未将通用样式复制散落到多个视图。

### 4.3 Pinia 状态拆分

- `repositoryStore`：已添加仓库列表、折叠菜单状态、各仓库远程更新徽标、已打开页签、活动 `repo_id`、路径、分支和监听状态。
- `workingTreeStore`：状态文件集合、选中修改块、暂存/提交/Stash 操作中的 loading 与错误。
- `historyStore`：提交分页结果、引用过滤器、图形 lane 数据和当前选择提交。
- `diffStore`：当前文件、比较目标、hunk 勾选状态、Diff 基线版本、加载状态及大文件警告。
- `mergeStore`：冲突文件列表、当前三栏内容、来源引用、冲突块选择和已解决状态。
- `appStore`：主题、窗口状态、全局通知和原生能力版本。

Store 只调用 `src/api` 中的类型化客户端。组件不直接发出 `cefQuery` 请求，以免错误处理和取消逻辑散落。

### 4.4 提交图渲染规则

- 历史数据按页请求，默认一页 `100` 条，向下滚动接近尾部时预加载下一页。
- DOM 仅渲染当前视口内的行文本；拓扑线和节点由 Canvas 绘制。
- 原生层返回 commit 与 parent SHA，前端图算法分配 lane；分页边界必须保留未闭合父节点的 lane 状态。
- Canvas 适配 `devicePixelRatio`，缩放或主题改变后重绘。
- 单次视口重绘目标不超过 `16 ms`；搜索或切换引用时取消过期分页请求。

### 4.5 Diff 展示规则

- Monaco 采用延迟加载，用户首次打开 Diff 面板时再加载编辑器资源。
- 对二进制文件返回元数据而不显示文本 Diff。
- 对超过阈值的文本 Diff（建议初始值为 `2 MB` 或 `20,000` 行）先显示大小警告，由用户确认后加载。
- 普通文件 Diff 参考 IntelliJ IDEA 的修改块交互：按 hunk/修改点列出每个变更块，并在边栏展示新增、删除、修改标记。
- 用户可勾选“全选修改点”，也可仅选择一个或多个 hunk；选择结果仅作用于当前文件和当前比较上下文。
- 在“未暂存”文件 Diff 中，对选中 hunk 显示 `Stage Selected`，将选中的修改块加入 index；在“已暂存”文件 Diff 中显示 `Unstage Selected`，将选中的修改块移出 index。
- 文件级 `Stage`/`Unstage` 与修改块级 `Stage Selected`/`Unstage Selected` 同时存在；所有操作按钮为英文，tooltip 与结果提示为中文。
- 应用选中修改块前记录 Diff 基线版本；若文件在查看期间已变化，拒绝应用旧 patch 并提示刷新 Diff，避免将修改应用到错误内容。

### 4.6 冲突三栏合并视图

当 `Pull`、`Merge`、`Apply` 或 `Pop` 产生冲突时，冲突文件不再显示普通双栏 Diff，而进入三栏合并模式：

```text
+--------------------------+--------------------------+--------------------------+
| Incoming / Theirs        | Result                   | Current / Ours           |
| 合入来源的修改             | 最终要保存并 Stage 的内容   | 当前本地分支的修改          |
| [x] 选择此修改块           | 可编辑合并结果             | [x] 选择此修改块           |
+--------------------------+--------------------------+--------------------------+
| Previous Conflict | Next Conflict | Apply Selected | Mark Resolved | 取消   |
+--------------------------------------------------------------------------------+
```

#### 布局与含义

- 左侧为 `Incoming / Theirs`，即被合入来源的内容；右侧为 `Current / Ours`，即当前检出分支已有内容；中间为 `Result`，表示用户最终准备保留的结果文件。
- “其他人的修改”和“自己的修改”只适用于常见的 pull/普通 merge 理解方式。界面必须在左右标题下展示实际来源引用名称，例如 `origin/main` 与 `feature/login`，以免在特殊流程中误判。
- 三栏分别支持同步滚动、高亮冲突块和上一处/下一处冲突导航。中间 `Result` 可编辑，并即时展示是否仍有未解决冲突。

#### 选择与完成流程

- 对每个冲突块，用户可从左侧勾选应用 incoming 修改、从右侧勾选应用 current 修改，也可两侧均选后在中间手工调整组合结果。
- 支持对当前文件选择“全部采用 Incoming”或“全部采用 Current”；按钮文字为 `Accept All Incoming` 与 `Accept All Current`，中文 tooltip 解释影响。
- `Apply Selected` 将当前选中的侧边修改写入中间结果，但不自动标记整个文件已解决。
- 仅当中间结果已不包含未处理冲突且用户点击 `Mark Resolved` 后，才将结果写入工作树并 `Stage` 该文件。
- 冲突流程未完成前禁用 `Commit`，并在工作区清晰展示仍待解决的文件数量。

---

## 5. IPC 与 JSON-RPC 2.0 契约

### 5.1 传输规则

- Renderer 通过 `window.cefQuery` 发送 JSON 字符串，Browser Process 使用 `CefMessageRouterBrowserSide` 处理请求。
- 请求和响应的业务负载遵循 JSON-RPC 2.0；`cefQuery` 自带的失败回调用于传输失败或桥接器不可用，业务错误放入 JSON-RPC `error`。
- 所有方法名采用 `namespace.action` 格式，例如 `repo.open`、`git.status`。
- 所有时间戳均使用 Unix 毫秒；文本为 UTF-8；路径分隔符在响应中统一为 `/`。
- 日志不得输出文件内容、提交消息全文或未来可能出现的凭据。

### 5.2 TypeScript 客户端封装示例

```ts
type RpcId = string;

interface RpcRequest<T> {
  jsonrpc: "2.0";
  id: RpcId;
  method: string;
  params: T;
}

interface RpcSuccess<T> {
  jsonrpc: "2.0";
  id: RpcId;
  result: T;
}

interface RpcFailure {
  jsonrpc: "2.0";
  id: RpcId;
  error: {
    code: number;
    message: string;
    data?: Record<string, unknown>;
  };
}

export const callNative = <P, R>(method: string, params: P): Promise<R> => {
  const id = crypto.randomUUID();
  const request: RpcRequest<P> = { jsonrpc: "2.0", id, method, params };

  return new Promise((resolve, reject) => {
    window.cefQuery({
      request: JSON.stringify(request),
      onSuccess: (raw: string) => {
        const response = JSON.parse(raw) as RpcSuccess<R> | RpcFailure;
        if ("error" in response) reject(response.error);
        else resolve(response.result);
      },
      onFailure: (code: number, message: string) => {
        reject({ code, message, transport: true });
      },
    });
  });
};
```

实际实现还应加入超时、取消、schema 校验以及 Mock transport，使浏览器开发模式无需启动 CEF 即可工作。

### 5.3 通用错误码

| Code | 名称 | 使用场景 |
| ---: | --- | --- |
| `-32600` | `INVALID_REQUEST` | JSON-RPC 结构无效 |
| `-32601` | `METHOD_NOT_FOUND` | 未注册的方法 |
| `-32602` | `INVALID_PARAMS` | 参数缺失、类型错误或路径非法 |
| `1001` | `REPOSITORY_NOT_FOUND` | 路径不是可打开的 Git 仓库 |
| `1002` | `REPOSITORY_CLOSED` | `repo_id` 已释放或不存在 |
| `1003` | `OPERATION_CANCELLED` | 请求被取消或结果已过期 |
| `1004` | `REPOSITORY_ALREADY_ADDED` | 添加的仓库路径已存在于左侧列表 |
| `1101` | `GIT_CONFLICT` | Git 操作产生冲突，需要进入三栏解决流程 |
| `1102` | `DIRTY_WORKTREE` | 操作要求干净工作区 |
| `1103` | `NOTHING_TO_COMMIT` | 没有可提交的暂存内容 |
| `1104` | `UNDO_COMMIT_NOT_ALLOWED` | 最近提交已推送、无法验证上游或仓库处于不可 Undo 状态 |
| `1105` | `HEAD_CHANGED` | 用户确认后当前 HEAD 已变化，必须刷新后重新操作 |
| `1106` | `DIFF_BASE_CHANGED` | 展示 Diff 后文件或 index 已变化，选中修改块不能继续应用 |
| `1107` | `UNRESOLVED_CONFLICTS` | 仓库仍含未解决冲突，当前操作不能继续 |
| `1201` | `REMOTE_AUTH_REQUIRED` | 远程操作需要认证或当前认证无效 |
| `1202` | `REMOTE_UNAVAILABLE` | 远程地址或网络暂时不可用 |
| `1203` | `PUSH_REJECTED` | 目标远程分支拒绝当前推送，例如 non-fast-forward |
| `1900` | `INTERNAL_ERROR` | 未归类的原生层错误 |

原生层错误响应应包含可展示的中文消息和诊断字段，例如 `libgit2_code`、`git_class` 与 `operation`，但不得泄露敏感环境数据。

### 5.4 通用能力接口

除 `app.capabilities` 展示完整请求和响应报文外，下述接口示例中的参数和返回内容分别表示 JSON-RPC 外层中的 `params` 与 `result` 字段。

#### `app.capabilities`

首次加载时调用，用于前端确认宿主及协议兼容性。

```json
{
  "jsonrpc": "2.0",
  "id": "req-1",
  "method": "app.capabilities",
  "params": {}
}
```

```json
{
  "jsonrpc": "2.0",
  "id": "req-1",
  "result": {
    "protocol_version": "1.0",
    "platform": "windows",
    "app_version": "0.1.0",
    "features": ["repository_list", "clone", "status", "log", "diff", "partial_stage", "branch", "tag", "merge", "conflict_resolver", "stash", "commit", "undo_commit", "revert", "cherry_pick", "fetch", "pull", "push", "watch"]
  }
}
```

#### `repo.list`

用于加载左侧仓库菜单栏。此接口返回的是用户已添加记录，仓库不一定已在右侧打开。

```json
{
  "repositories": [
    {
      "repository_key": "saved-repo-01",
      "root_path": "D:/workspace/Dash",
      "display_name": "Dash",
      "group": "工作",
      "initial": "D",
      "auto_fetch_on_open": false,
      "remote_summary": {
        "behind": 3,
        "ahead": 1,
        "checked_at": 1779835200000,
        "state": "known"
      }
    }
  ]
}
```

`remote_summary.state` 值为 `unknown | checking | known | error`。只有 `known` 且 `behind > 0` 时，左侧显示可拉取数量徽标。

#### `repo.add`

- **Params**：`{ path: string, display_name?: string, group?: string, auto_fetch_on_open: boolean }`
- **行为**：校验本地 Git 仓库、保存到仓库菜单列表中，并返回对应记录。路径已经存在时返回可识别错误，由前端提示打开已有仓库。

```json
{
  "repository_key": "saved-repo-01",
  "root_path": "D:/workspace/Dash",
  "display_name": "Dash",
  "group": "工作",
  "initial": "D",
  "auto_fetch_on_open": false
}
```

#### `repo.clone`

- **Params**：`{ url: string, target_path: string, display_name?: string, group?: string, open_after_clone: boolean }`
- **行为**：克隆远程仓库、保存左侧列表记录，并根据用户选择打开新页签。认证要求通过结构化错误向 UI 返回。

```json
{
  "repository_key": "saved-repo-02",
  "root_path": "D:/workspace/new-project",
  "display_name": "new-project",
  "cloned": true,
  "opened": true
}
```

#### `repo.open`

```json
{
  "repository_key": "saved-repo-01"
}
```

```json
{
  "repo_id": "repo-01HQ...",
  "repository_key": "saved-repo-01",
  "root_path": "D:/workspace/Dash",
  "display_name": "Dash",
  "head": {
    "branch": "main",
    "sha": "a1b2c3d4e5f67890",
    "detached": false
  }
}
```

#### `repo.close`

参数为 `{ "repo_id": "repo-01HQ..." }`。调用后释放监听器和原生会话资源，返回 `{ "closed": true }`。

关闭页签调用 `repo.close`，但不会从左侧仓库列表中移除保存的记录。列表移除行为另设用户确认操作，并不得删除磁盘上的仓库文件。

### 5.5 Git 只读接口

#### `git.status`

- **Params**：`{ repo_id: string }`
- **libgit2 行为**：使用 `git_status_list_new()`，启用 untracked 与 rename 等所需选项。

```json
{
  "branch": "main",
  "ahead": 1,
  "behind": 0,
  "is_clean": false,
  "files": [
    {
      "path": "src/main.ts",
      "index_status": "unmodified",
      "worktree_status": "modified",
      "old_path": null
    },
    {
      "path": "src/components/new-file.tsx",
      "index_status": "unmodified",
      "worktree_status": "new",
      "old_path": null
    }
  ]
}
```

状态值固定为 `unmodified | new | modified | deleted | renamed | typechange | conflicted | ignored`，避免前端直接依赖 libgit2 枚举名称。

#### `git.refs`

- **Params**：`{ repo_id: string }`
- **Result**：本地分支、远程跟踪分支及标签列表。

```json
{
  "locals": [{ "name": "main", "sha": "a1b2c3", "is_head": true }],
  "remotes": [{ "name": "origin/main", "sha": "a1b2c3" }],
  "tags": [{ "name": "v0.1.0", "sha": "82ac21" }]
}
```

#### `git.log`

- **Params**：`{ repo_id: string, ref?: string, limit: number, cursor?: string }`
- **约束**：`limit` 默认 `100`，最大 `500`。`cursor` 为原生层生成的不透明分页游标。
- **libgit2 行为**：以目标引用启动 `git_revwalk`，排序至少包含拓扑顺序与时间顺序，以保证分页展示稳定。

```json
{
  "commits": [
    {
      "sha": "a1b2c3d4e5f67890",
      "parents": ["e5f6a7b8c9d01234"],
      "author": { "name": "Sun Yuhang", "email": "yuhang@example.com" },
      "authored_at": 1716727200000,
      "summary": "feat: implement graph rendering",
      "refs": ["refs/heads/main", "refs/remotes/origin/main"]
    }
  ],
  "next_cursor": "opaque-cursor-or-null"
}
```

#### `git.diff`

- **Params**：`{ repo_id: string, file_path: string, source: DiffTarget, target: DiffTarget }`
- **DiffTarget**：`{ kind: "head" | "index" | "worktree" | "commit", sha?: string }`
- **libgit2 行为**：根据比较对象选择 tree-to-tree、tree-to-index 或 index-to-workdir Diff。

```json
{
  "file_path": "src/main.ts",
  "old_path": null,
  "binary": false,
  "truncated": false,
  "diff_token": "opaque-diff-baseline-token",
  "selection_action": "stage",
  "stats": { "additions": 1, "deletions": 1 },
  "hunks": [
    {
      "hunk_id": "hunk-1",
      "old_start": 10,
      "old_lines": 3,
      "new_start": 10,
      "new_lines": 3,
      "header": "@@ -10,3 +10,3 @@",
      "lines": [
        { "origin": "context", "content": "function init() {" },
        { "origin": "deletion", "content": "  console.log('old');" },
        { "origin": "addition", "content": "  console.log('dash init');" },
        { "origin": "context", "content": "}" }
      ]
    }
  ]
}
```

`content` 不包含 Git patch 的 `+`、`-` 前缀；展示符号由 UI 根据 `origin` 绘制。`diff_token` 用于修改块操作前验证基线是否仍有效；`selection_action` 值为 `stage | unstage | readonly`，其中 commit-to-commit 等历史比较为只读。

#### `git.stashes`

- **Params**：`{ repo_id: string }`
- **Result**：当前仓库的 stash 列表，用于内部左栏“贮藏”分组。

```json
{
  "stashes": [
    {
      "stash_id": "refs/stash@{0}",
      "message": "修复登录表单之前的临时改动",
      "created_at": 1779835200000,
      "file_count": 4
    }
  ]
}
```

#### `git.conflictDetail`

- **Params**：`{ repo_id: string, file_path: string }`
- **Result**：三栏冲突编辑器使用的来源、结果初稿和冲突块 DTO。

```json
{
  "file_path": "src/api/session.ts",
  "incoming": { "label": "Incoming / Theirs", "ref": "origin/main", "content": "..." },
  "current": { "label": "Current / Ours", "ref": "feature/login", "content": "..." },
  "result": { "content": "..." },
  "conflict_blocks": [{ "block_id": "conflict-1", "resolved": false }],
  "conflict_token": "opaque-conflict-baseline-token"
}
```

### 5.6 Git 写接口

所有写请求执行前都必须检查 `repo_id`、路径范围和当前仓库状态，并在成功后触发一次状态刷新事件。

| Method | Params | Result | 主要校验 |
| --- | --- | --- | --- |
| `git.stage` | `{ repo_id, paths: string[] }` | `{ staged: string[] }` | 文件属于工作树；空列表无效 |
| `git.unstage` | `{ repo_id, paths: string[] }` | `{ unstaged: string[] }` | HEAD 尚不存在时需采用初始仓库逻辑 |
| `git.stageHunks` | `{ repo_id, file_path: string, hunk_ids: string[], diff_token: string }` | `{ staged_hunks: string[] }` | 当前为未暂存 Diff；基线未变化；hunk 有效 |
| `git.unstageHunks` | `{ repo_id, file_path: string, hunk_ids: string[], diff_token: string }` | `{ unstaged_hunks: string[] }` | 当前为已暂存 Diff；基线未变化；hunk 有效 |
| `git.commit` | `{ repo_id, message: string }` | `{ sha: string }` | 消息非空；存在 staged 变更；签名配置可用 |
| `git.undoLastCommit` | `{ repo_id, expected_head_sha: string, restore_mode: "staged" \| "unstaged" }` | `{ previous_head_sha?: string, restored_state: "staged" \| "unstaged", unborn_head?: boolean }` | HEAD 未变化；提交尚未推送；不处于冲突/合并/rebase |
| `git.checkout` | `{ repo_id, branch: string }` | `{ branch: string, sha: string }` | 有未提交覆盖风险时拒绝并返回 `DIRTY_WORKTREE` |
| `git.merge` | `{ repo_id, source_ref: string }` | `{ head_sha?: string, conflicted: boolean }` | 当前分支明确；source ref 存在；冲突时进入解决流程 |
| `git.stash` | `{ repo_id, message?: string, include_untracked: boolean }` | `{ stash_id: string }` | 存在可贮藏修改；不处于冲突处理流程 |
| `git.stashApply` | `{ repo_id, stash_id: string }` | `{ applied: boolean, conflicted: boolean }` | stash 存在；冲突时保留 stash |
| `git.stashPop` | `{ repo_id, stash_id: string }` | `{ applied: boolean, dropped: boolean, conflicted: boolean }` | 仅应用成功且无未解决冲突时移除 stash |
| `git.fetch` | `{ repo_id, remote?: string }` | `{ remote: string, ahead: number, behind: number }` | 网络和认证可用；不直接修改工作区 |
| `git.pull` | `{ repo_id, remote?: string, branch?: string }` | `{ head_sha?: string, updated: boolean, conflicted: boolean }` | 明确合并策略；冲突时进入解决流程 |
| `git.push` | `{ repo_id, remote: string, source_branch: string, target_branch: string, set_upstream: boolean }` | `{ remote: string, target_branch: string, pushed: boolean }` | 来源为当前分支；目标已确认；禁止 force；认证成功 |
| `git.resolveConflict` | `{ repo_id, file_path: string, result_content: string, conflict_token: string }` | `{ resolved: true, staged: true }` | 基线未变化；文件无残留冲突块；结果写入并暂存 |

删除分支、硬重置、强制 checkout、force push 等破坏性操作不能出现在默认工具栏；若在高级功能中提供，必须显示影响范围、目标引用与二次确认。

`Undo` 实现约束：

- UI 显示名称为 `Undo`，RPC 方法名称使用 `git.undoLastCommit`，明确它只针对当前分支最新一次提交。
- 当 `restore_mode` 为 `staged` 时，对最新提交的父节点执行 soft reset：移动当前分支引用/`HEAD`，保留 index 和 working tree。在 libgit2 中可基于 `git_reset(..., GIT_RESET_SOFT, ...)` 实现。
- 当 `restore_mode` 为 `unstaged` 时，对最新提交的父节点执行 mixed reset：移动当前分支引用/`HEAD`，将 index 重置为目标树，同时保留 working tree 文件内容。在 libgit2 中可基于 `git_reset(..., GIT_RESET_MIXED, ...)` 实现。
- 请求携带确认弹窗展示时的 `expected_head_sha`。执行时若当前 `HEAD` 不再等于该值，返回 `HEAD_CHANGED`，避免撤销用户未确认过的新提交。
- 有 upstream 的分支在 `Undo` 检查前应先成功刷新远程状态；网络或认证失败时不得猜测安全性，应拒绝执行并显示中文原因。
- 成功执行后刷新 status/log/refs 和页签状态；根据 `restored_state` 将用户视线引导到已暂存或未暂存文件列表。

远程操作补充约束：

- `Fetch` 成功后更新当前仓库的 `ahead`/`behind`，同步刷新左侧菜单徽标和活动页签提示。
- `Pull` 默认不得隐式执行会造成历史重写的策略；默认采用明确的普通合并或 fast-forward 策略，发生冲突时进入解决流程。
- `Push` 必须使用弹窗确认 `source_branch` 与 `target_branch`；默认目标为远程同名分支，但允许用户选择或输入其它目标分支。
- `Push` 不允许默认强制推送；强制推送不进入默认工具栏。
- 如果远程认证尚未配置，按钮可以展示并在执行时以中文提示认证能力尚待接入，不伪装为成功。

修改块与冲突操作补充约束：

- `git.stageHunks`/`git.unstageHunks` 根据选中 hunk 构造补丁后再更新 index；执行前必须校验 `diff_token`，失败时返回 `DIFF_BASE_CHANGED` 并要求用户刷新。
- `git.merge`、`git.pull`、`git.stashApply` 和 `git.stashPop` 产生冲突时，前端通过 `git.conflictDetail` 加载三栏数据，并在用户完成选择后调用 `git.resolveConflict`。
- `git.resolveConflict` 仅用于单文件冲突完成；仓库中所有冲突文件均解决后，才允许继续生成 merge commit 或完成相应流程。

### 5.7 扩展 Git 能力接口规划

以下能力属于完整产品设计的一部分。它们可以晚于基础工作流交付，但页面区域、协议命名和安全模型应提前预留。

| Method | 目标能力 | 核心约束 |
| --- | --- | --- |
| `git.branchCreate` / `git.branchRename` / `git.branchDelete` | 创建、重命名、删除本地分支 | 删除未合并分支必须明确风险并二次确认 |
| `git.tagCreate` / `git.tagDelete` | 管理标签 | 区分轻量标签与附注标签；远程删除单独确认 |
| `git.revertCommit` | 对已共享的提交创建反向提交 | 不改写已发布历史；发生冲突进入合并视图 |
| `git.cherryPick` | 将指定提交应用到当前分支 | 展示来源提交；冲突进入合并视图 |
| `git.rebase` | 高级历史整理 | 仅在高级流程提供；每个危险动作提供中止/继续状态 |
| `git.remoteList` / `git.remoteUpdate` | remote 与 upstream 管理 | 修改 URL 前展示当前值与认证影响 |
| `git.submoduleStatus` / `git.submoduleUpdate` | 子模块管理 | 明确父仓库与子仓库状态边界 |

### 5.8 事件与刷新策略

原生层通过事件桥接向 Renderer 推送通知；事件 envelope 统一为：

```json
{
  "event": "repo.changed",
  "payload": {
    "repo_id": "repo-01HQ...",
    "reason": "filesystem",
    "sequence": 12
  }
}
```

| Event | 触发时机 | 前端动作 |
| --- | --- | --- |
| `repo.changed` | watcher 检测到 `.git` 或工作树变更并完成防抖 | 重新请求 `git.status`，必要时刷新 refs/log |
| `repo.headChanged` | commit、Undo 或 checkout 成功 | 刷新状态、历史与分支选择 |
| `repo.remoteSummaryChanged` | `Fetch` 成功并重新计算 ahead/behind | 更新左侧待拉取徽标与页签状态 |
| `repo.conflictsChanged` | Merge/Pull/Apply/Pop 产生冲突，或文件被标记 resolved | 更新冲突数量并进入或退出三栏解决视图 |
| `app.themeChanged` | 系统主题变化 | 切换 Tailwind/Monaco 主题并重绘 Canvas |

文件监听器以仓库为单位合并事件，推荐防抖窗口为 `150-300 ms`。提交或暂存等应用自身写操作可立即刷新，并忽略紧随其后的重复 watcher 通知。

---

## 6. 原生服务实现要求

### 6.1 libgit2 封装

- 对 `git_repository*`、`git_diff*`、`git_status_list*` 等资源使用 RAII wrapper，保证错误路径也释放资源。
- libgit2 返回码在服务层统一映射为 RPC 错误；C++ 异常不得越过 RPC dispatcher。
- 不将 libgit2 的裸指针、枚举或错误文本直接暴露给 UI。
- 写操作结束后清理 index/引用缓存，并产生仓库变更事件。
- libgit2 没有单独的一步式 `pull` 业务命令；实现 `git.pull` 时必须明确组合 `fetch` 与 merge/fast-forward 策略，并为冲突路径设计错误返回。
- 分块 `Stage`/`Unstage` 应基于 libgit2 Diff 结果构造仅包含选中 hunk 的补丁并应用到 index；不得以字符串查找替代 hunk 标识和基线校验。
- 三栏冲突编辑器从 index conflict entries 读取 ancestor/ours/theirs 内容，并将用户确认后的 `Result` 写回工作树及 index；在全部冲突解决前保留仓库冲突状态。
- `git.push` 根据用户确认的 `source_branch` 与 `target_branch` 生成明确 refspec，并拒绝任何隐式 force 行为。
- stash 的 `Apply` 与 `Pop` 必须保持语义差异：只有 `Pop` 成功完成应用后才删除对应 stash 记录，冲突场景不得提前删除。

### 6.2 调度与取消

- Worker Pool 应有固定上限，建议初期设置为 `clamp(hardware_concurrency - 1, 2, 8)`。
- 同一 `repo_id` 的写队列串行；只读操作不应等待无关仓库的任务。
- `git.log`、`git.diff` 等界面选择驱动的任务必须支持逻辑取消：当 `request_id` 已失效，不再向 UI 回传数据。
- 超过阈值的 Diff 需在原生层截断或返回确认标记，避免先序列化巨量内容再由 UI 拒绝。

### 6.3 路径与输入安全

- `repo.add` 只接受绝对目录路径；规范化后验证 `.git` 仓库可打开，并持久化展示信息。
- `repo.open` 接受已添加仓库的 `repository_key`，通过原生已保存记录解析真实路径，不信任 UI 自行替换路径。
- 接收 `file_path` 时只允许仓库相对路径，禁止 `..` 越界以及指向仓库外部的符号链接写入操作。
- 提交消息限制最大长度并保留原始换行，不把消息插入命令行，因为 Git 服务不通过 shell 调用 Git。
- 日志展示用户路径时可显示仓库根目录，崩溃和遥测记录应按隐私策略处理。

### 6.4 窗口与系统集成

- 无边框窗口必须保留可访问的拖动区域、双击最大化行为和系统快捷键。
- 系统文件选择器由原生层打开，返回用户选择的目录后交由添加仓库弹窗调用 `repo.add`。
- 退出应用、关闭仓库或切换仓库时清理 watcher，避免后台继续访问已释放会话。

---

## 7. 性能、可用性与质量指标

### 7.1 性能预算

| 场景 | 数据规模 | 目标 |
| --- | --- | --- |
| 首次显示工作区状态 | 5,000 个已跟踪文件、200 个变更 | `P95 < 500 ms`，界面不冻结 |
| 提交历史首屏 | 100 条提交 | `P95 < 300 ms`（本地已打开仓库） |
| Graph 视口滚动 | 10,000 条已加载提交 | 典型设备滚动保持接近 `60 fps` |
| 普通文本 Diff | 5,000 行 | `P95 < 500 ms` 展示 |
| watcher 刷新 | 单次保存文件 | 防抖后 `500 ms` 内反映状态 |

以上指标需在测试仓库和测试设备信息固定后进一步基线化；首期至少记录耗时日志以便验证。

### 7.2 错误与空状态

- 未打开仓库时显示清晰入口，不发起 Git 查询。
- 左侧仓库菜单始终可使用；右侧未打开页签时显示中文空状态提示。
- 仓库路径被删除、权限丢失或 `.git` 损坏时，将会话标记失效并提示重新打开。
- Detached HEAD、无提交的新仓库、冲突文件及二进制文件都必须提供明确状态展示。
- RPC 失败时保留上一次成功内容，并向用户提供重试操作，不显示原生堆栈。
- Git 操作按钮名称保持英文，所有解释、结果提示和失败原因使用中文。

### 7.3 可访问性与键盘操作

- 提供可见焦点样式以及键盘选择提交/文件的能力。
- 自定义标题栏按钮具备可访问名称，且遵循操作系统的窗口行为。
- 文本和状态标记不只依赖颜色区分，Diff 同时使用符号或文字标签。

---

## 8. 完整设计的质量与测试策略

### 8.1 自动化测试分层

| 层级 | 覆盖重点 | 建议工具 |
| --- | --- | --- |
| Vue TSX 单元测试 | TSX 组件、Store、RPC 类型映射、lane 算法、hunk 选择和合并状态 | Vitest |
| Mock UI 集成测试 | 多仓库、Push 弹窗、Stash、选择性 Stage 以及三栏冲突交互 | Playwright |
| C++ 单元测试 | 参数校验、错误映射、DTO 序列化、路径规范化 | CTest + 测试框架 |
| libgit2 集成测试 | status/log/diff/hunk stage、stash、merge/conflict、push refspec、commit/checkout | CTest |
| 桌面冒烟测试 | CEF 加载前端、IPC 往返、窗口行为、watcher | Windows/macOS CI 或发布前设备 |

### 8.2 必测仓库场景

- 空仓库首次提交前的状态、暂存和提交。
- 添加重复仓库、仓库导航折叠后 tooltip、双击多仓库页签和关闭活动页签后的空状态恢复。
- 从 HTTPS/SSH 地址执行 `Clone` 的成功、认证失败、目标目录冲突与克隆后打开页签行为。
- 含中文、空格及较长目录名的仓库路径与文件路径。
- renamed、deleted、untracked、conflicted、binary 文件状态。
- merge commit 与多分支历史的图形连接线。
- 大历史和大 Diff 的分页、截断及取消行为。
- 单文件存在多个 hunk 时，能全选或只 Stage/Unstage 指定修改块；文件变化后旧选择因基线失效而被拒绝。
- `Stash` 后的 `Apply` 保留 stash 记录，`Pop` 成功后移除记录；二者冲突时均可进入解决流程且不丢失 stash 内容。
- `Push` 默认选择远程同名分支，也可指定其它远程目标分支；non-fast-forward 和认证失败均能正确提示。
- `Merge` 无冲突时正确更新历史；发生冲突时显示 Incoming/Result/Current 三栏并能逐块选择及完成 resolved 状态。
- 工作区未提交变更存在时切换分支被正确拒绝。
- `Undo` 未推送的最近一次提交后，选择“已暂存”时改动准确恢复到 staged 区，选择“未暂存”时准确恢复到 unstaged 区且不丢失文件内容。
- 最近提交已推送、远程状态无法验证、HEAD 已在确认后变化或处于冲突流程时，`Undo` 被正确拒绝。
- `Fetch` 更新 behind 数量并刷新左侧徽标；远程认证失败时显示中文提示且不误报状态。

### 8.3 完整产品验收关注点

- Windows 与 macOS 可启动应用、选择并打开本地仓库。
- 能通过弹窗添加或克隆仓库；左侧菜单可折叠/展开；双击不同仓库能创建并切换多个右侧页签。
- 工作区状态、历史、refs 与 Diff 均使用真实 libgit2 数据返回。
- Git 查询期间 UI 可持续交互，且不存在在 CEF UI 线程执行 Git 的代码路径。
- 文件级与修改块级暂存/取消暂存、Stash Apply/Pop、提交、Merge 和安全分支切换成功，并可由状态界面验证结果。
- `Push` 弹窗允许确认远程仓库及同名或自定义目标分支，不暴露强制推送入口。
- 冲突文件可在三栏视图中按修改块合并到 Result，且仅解决完成后允许继续提交。
- `Undo` 可以安全撤销最近一次未推送的 `Commit`，并按确认框选择将文件改动恢复到已暂存区或未暂存区；已推送提交不会被直接改写历史。
- 所有涉及 Git 状态读取或变更的操作按钮均使用英文名称，中文 tooltip 准确；已完成 `Fetch` 的仓库能显示可拉取数量。
- 外部修改文件后状态能够自动刷新；关闭仓库后不继续发送其事件。
- 分支/标签管理、`Revert`、`Cherry-pick` 以及高级能力在引入后遵循相同风险确认和冲突解决流程。
- 协议错误、Git 错误及特殊仓库状态具有可理解的提示与测试覆盖。

---

## 9. 本机开发环境准备

### 9.1 当前机器与安装目标

本项目当前开发机器为 Windows x64，选择 **CLion** 作为 C++ 开发 IDE。CLion 负责编辑、CMake 配置、构建入口和调试界面，但实际编译仍由 **MSVC x64 + Windows SDK** 完成。开发依赖集中安装于 `E:\software\DashDev`，不将第三方大体积 SDK 提交到 Git 仓库。

当前已确认 CLion、CMake、CEF SDK、Visual Studio 2022 的 MSVC x64 组件和 Windows SDK 均已存在；进入原生工程阶段后，需要在 CLion 中建立工具链与 CMake Profile，并通过最小工程的 configure/build 验证组合配置。

| 工具/环境 | 选定方案 | 存放位置 | 作用 |
| --- | --- | --- | --- |
| CLion | `2025.3.5` Windows x64 | `E:\software\Clion\CLion 2025.3.5` | 主要开发 IDE |
| MSVC + Windows SDK | Visual Studio Community 2022 安装组件 | `E:\software\VisualStudio` | Windows C++ 编译、链接与 SDK 头文件/库 |
| CMake | `4.3.2` Windows x64 ZIP | `E:\software\DashDev\cmake-4.3.2-windows-x86_64` | CMake 工程配置与构建生成 |
| CEF | `147.0.14+g76d2442+chromium-147.0.7727.138` Windows 64-bit Standard Distribution | `E:\software\DashDev\cef\cef_binary_147.0.14+g76d2442+chromium-147.0.7727.138_windows64` | Chromium 原生宿主 SDK 和运行资源 |

CEF 没有类似普通桌面软件的安装向导。对开发项目而言，“安装 CEF”是下载并解压官方 binary distribution，然后在 CMake 中设置其根目录，让工程链接 SDK 与运行时资源。

### 9.2 环境准备与 CLion 配置流程

| 步骤 | 操作 | 你需要理解的内容 | 完成标志 |
| ---: | --- | --- | --- |
| 1 | 确认系统架构和 IDE | 开发依赖与工具链必须匹配目标平台架构 | Windows x64，使用 CLion 开发 |
| 2 | 创建 `E:\software\DashDev` | 工具依赖与源代码分离，仓库保持干净 | 目标目录可读写 |
| 3 | 从 CMake 官方下载 Windows x64 ZIP 并解压 | CMake 是生成构建工程的工具，不是 C++ 编译器 | 可执行 `cmake --version` |
| 4 | 将 CMake `bin` 添加到用户 PATH | PATH 使任意终端可定位可执行文件；新终端才会读取更新 | 新终端能直接运行 `cmake` |
| 5 | 从 CEF Automated Builds 下载稳定版 Standard Distribution 并解压 | CEF SDK 同时含编译输入和运行时资源；Standard 包适合学习示例 | 目录内存在 `include`、`cmake`、`Release`、`Resources` |
| 6 | 验证 MSVC 与 Windows SDK | CLion 不是编译器，Windows 上仍需要可链接 CEF 的原生工具链 | Visual Studio 提供 x64 MSVC、Windows SDK 和 `vcvars64.bat` |
| 7 | 在 CLion 配置 MSVC Toolchain | CLion Toolchain 组合编译器、调试器、CMake 与构建工具 | CLion 能识别 MSVC 环境并使用指定 CMake |
| 8 | 在 CMake User Preset/Profile 中引用 CEF 根目录 | 依赖放在仓库外，工程通过本机配置找到它 | CLion 可 configure CEF 工程 |

官方来源：

- CMake 下载页：<https://cmake.org/download/>
- CEF Automated Builds：<https://cef-builds.spotifycdn.com/index.html>
- CLion Windows 配置说明：<https://www.jetbrains.com/help/clion/quick-tutorial-on-configuring-clion-on-windows.html>
- CLion Toolchains 说明：<https://www.jetbrains.com/help/clion/how-to-create-toolchain-in-clion.html>

### 9.3 本机安装结果（2026-05-27）

在环境准备开始之前，命令行中未检测到可用的 `cmake`；以下为完成安装和校验后的实际状态。

| 项目 | 安装及验证结果 |
| --- | --- |
| CLion | `2025.3.5`，路径为 `E:\software\Clion\CLion 2025.3.5\bin\clion64.exe` |
| Visual Studio / MSVC | 已检测到 Visual Studio Community 2022：`E:\software\VisualStudio`；MSVC x64 组件与 Windows SDK 已由安装器识别 |
| MSVC 环境入口 | 已确认存在 `E:\software\VisualStudio\VC\Auxiliary\Build\vcvars64.bat`，供 CLion 的 Visual Studio/MSVC toolchain 使用 |
| CMake 可执行目录 | `E:\software\DashDev\cmake-4.3.2-windows-x86_64\bin` |
| CMake 验证 | `cmake version 4.3.2`；ZIP SHA-256 为 `83D20C23F5C5F64B3B328785E35B23C532E33057A97ED6294ACACA3781B78A01`，与官方清单匹配 |
| CMake PATH | 已加入当前用户 `PATH`；新打开的终端可直接执行 `cmake --version` |
| CEF SDK 根目录 | `E:\software\DashDev\cef\cef_binary_147.0.14+g76d2442+chromium-147.0.7727.138_windows64` |
| CEF 验证 | TAR.BZ2 SHA-1 为 `D92F18E900D6E7C301A36C026D26FD4172129D0B`，与官方下载校验文件匹配；已确认存在 `include`、`cmake`、`Release`、`Resources` |

后续在 CLion 打开 CMake 工程时，可以将 CEF 路径以本机 `CMakeUserPresets.json` 的 cache variable 表达，避免将个人机器路径硬编码在通用构建文件中：

```json
{
  "cacheVariables": {
    "CEF_ROOT": "E:/software/DashDev/cef/cef_binary_147.0.14+g76d2442+chromium-147.0.7727.138_windows64"
  }
}
```

`CMakeUserPresets.json`、`.idea/` 和 `cmake-build-*/` 应加入 `.gitignore`；仓库提供不包含具体盘符的通用 `CMakePresets.json`，供 CLion 与命令行共同加载。

### 9.4 CLion 工具链配置与验证要求

CEF 与 CMake 本身不足以完成 C++ 编译。Windows 端采用 CLion + MSVC 的开发方式：

1. 在 CLion 的 Toolchains 设置中选择或新建 Visual Studio/MSVC 工具链，目标架构使用 `amd64/x64`。
2. 将 CMake 可执行文件指向 `E:\software\DashDev\cmake-4.3.2-windows-x86_64\bin\cmake.exe`，确保 IDE 与命令行使用相同版本。
3. 使用 CLion 支持的 Ninja 或 MSVC 构建工具生成构建目录；构建配置以 CMake Presets 为准。
4. 在本机 User Preset 或 CLion Profile 中提供 `CEF_ROOT`，并区分 `Debug`/`Release` 配置。
5. 用最小 CEF 窗口工程完成 configure、build、run 和 debugger attach 验证，才视为原生环境配置完成。

不应将 CLion 误写成编译器，也不应因为使用 CLion 而改用与 CEF 分发包不匹配的 ABI/运行库方案。

---

## 10. 从整体设计到落地的学习式实施步骤

以下步骤按“先实现完整交互原型，再接通原生能力，随后完成核心版本，最后扩展完整能力”的顺序安排。每一步只引入少量新概念，完成验收后再进入下一步。第 11 节会明确哪些步骤构成首次 MVP 交付。

### A. 建立开发基础

| Step | 学习目标 | 动手内容 | 验收结果 |
| ---: | --- | --- | --- |
| 0 | 理解产品要解决的问题 | 阅读完整功能地图、页面区域和安全原则，并标记各能力之间的依赖关系 | 能说明 Dash 完整工作流及为何需要分期实现 |
| 1 | 理解 IDE 与工具链的区别 | 按第 9 节检查 CLion、CMake、CEF 与 MSVC/Windows SDK；在 CLion 配置 MSVC toolchain | 能区分 CLion、CMake、MSVC、CEF 和 libgit2 的职责 |
| 2 | 学习 Git 仓库的最小工程管理 | 建立目录骨架与 `.gitignore`，排除 `build/`、前端依赖目录和本地 SDK 路径 | 仓库只保留源码、文档和配置 |
| 3 | 理解协议先行的价值 | 将第 5 节接口整理为 TypeScript 类型文件和 Mock JSON 数据 | 前端数据结构与未来原生返回结构一致 |

### B. 完成 `fe` 前端整体交互原型

| Step | 学习目标 | 动手内容 | 验收结果 |
| ---: | --- | --- | --- |
| 4 | 创建 Vue TSX 工程 | 在 `fe/` 初始化 Vue 3 + TypeScript + Vite 项目，配置 Vue JSX/TSX 插件和基础脚本 | `npm run dev` 可渲染 `.tsx` 根页面 |
| 5 | 使用 Tailwind 工具类布局 | 在 `fe/` 接入 Tailwind，创建暗色背景、字体和主题基础设置 | 页面能显示暗色应用容器 |
| 6 | 建立可维护的类名习惯 | 按 4.2 节要求，为每个自建 HTML 元素添加 `dash-*` 语义类名并配合 Tailwind 工具类 | 浏览器开发工具中可按语义类名定位所有区域 |
| 7 | 学习 TSX 组件拆分 | 创建 `repository-nav.tsx`、`repository-tabs.tsx`、`repo-toolbar.tsx`、`diff-panel.tsx`、`conflict-resolver.tsx`、`working-tree-panel.tsx` 与所需弹窗组件 | 每个区域均是独立 TSX 组件且具有根类名，不存在 `.vue` 文件 |
| 8 | 建立工作台布局 | 实现第 4.1 节的仓库菜单栏、右侧空状态、多页签和单仓库内容布局 | 在 `1440 x 900` 下空状态和已打开仓库状态均布局正确 |
| 9 | 练习交互状态 | 实现菜单折叠/展开、添加仓库弹窗、双击仓库打开或激活页签、关闭页签 | 收起后显示图标 tooltip，多个仓库可同时保留页签 |
| 10 | 理解集中状态管理 | 添加 Pinia，管理仓库列表、远程徽标、打开页签、活动仓库、历史和 Diff 状态 | 切换活动页签会恢复各自工作区视图状态 |
| 11 | 理解接口抽象 | 实现 `RpcTransport`、`MockRpcTransport` 和 `callNative` 类型化入口，并模拟 `repo.list/add/open` 与远程摘要 | 页面数据来自模拟 RPC，而非组件内部硬编码 |
| 12 | 理解列表性能 | 构造数千条提交 Mock 数据，先完成历史行虚拟滚动，再为可见视口叠加 Canvas 图线 | 大列表滚动无明显卡顿，提交选中态生效 |
| 13 | 学习复杂 Diff 交互 | 延迟加载 Monaco，模拟多 hunk 勾选、`Stage Selected`/`Unstage Selected` 与 Push/Merge/Stash 弹窗 | 可选择全部或部分修改点，Git 操作按钮文案符合规则 |
| 14 | 学习冲突解决界面 | 使用 Mock 冲突数据实现 Incoming/Result/Current 三栏布局、逐块选择和 resolved 状态 | 可在中间结果区组合两侧修改并显示未解决数量 |
| 15 | 建立前端质量习惯 | 为弹窗、菜单收起、多页签、hunk 选择、三栏冲突、RPC 映射和 store 添加 Vitest/Playwright 测试 | Mock 前端原型可以稳定回归 |

完成 Step 15 后，应先实际审阅整体页面原型，记录需要调整的面板尺寸、信息密度和颜色层次，再进入 CEF 接入。

### C. 建立 CEF 原生外壳与通信

| Step | 学习目标 | 动手内容 | 验收结果 |
| ---: | --- | --- | --- |
| 16 | 理解 CLion 与 CMake 工程生成 | 创建根 `CMakeLists.txt`、通用 preset、User Preset 与 `native/` 目录；在 CLion Profile 中配置外部 CEF 根路径 | CLion 使用 MSVC toolchain 完成 CMake configure |
| 17 | 理解 CEF 进程结构与调试 | 参考 CEF 示例建立最小应用入口和浏览器窗口，使用 CLion build/run/debug 加载静态测试页 | 能从 CLion 启动原生窗口并进入断点调试 |
| 18 | 加载前端产物 | 设计开发环境加载 Vite URL、生产环境加载本地构建资源的两种路径 | CEF 窗口内能显示 Step 15 的页面 |
| 19 | 理解 Renderer 与 Browser 通信 | 注册 `CefMessageRouterBrowserSide`，实现 `app.capabilities` 的请求解析与响应 | Vue 页面能显示来自 C++ 的平台/版本能力 |
| 20 | 形成可靠 RPC 层 | 加入请求 ID、参数校验、错误 envelope、超时和原生日志 | 错误方法或非法参数能得到结构化提示 |
| 21 | 管理仓库列表与会话 | 实现系统目录选择、`repo.list`、`repo.add`、`repo.open` 与 `repo.close` | 左侧添加记录可持久化，双击页签持有独立 `repo_id` |

### D. 引入 libgit2 的真实 Git 数据

| Step | 学习目标 | 动手内容 | 验收结果 |
| ---: | --- | --- | --- |
| 22 | 理解 C 库资源管理 | 引入 libgit2，封装初始化/关闭和 RAII 指针释放 | 打开、关闭仓库无资源泄漏或崩溃 |
| 23 | 理解线程隔离 | 创建有界 Worker Pool，将 Git 请求移出 CEF UI 线程 | 读取较大仓库时窗口仍可交互 |
| 24 | 读取工作区状态 | 实现 `git.status`，将 libgit2 枚举映射为稳定 DTO | 页面显示 staged/unstaged/untracked/conflicted 文件 |
| 25 | 读取引用与提交历史 | 实现 `git.refs` 与分页 `git.log`，接回提交图列表 | 可浏览分支及真实提交图数据 |
| 26 | 理解比较对象与修改块 | 实现 `git.diff` 的 hunk 标识、基线 token、HEAD/index/worktree/commit 比较 | Monaco 能列举真实修改点并区分可操作和只读 Diff |
| 27 | 读取 stash 与冲突详情 | 实现 `git.stashes` 和 `git.conflictDetail` DTO | UI 可展示贮藏列表及真实三栏冲突内容 |
| 28 | 学习异步查询治理 | 为历史翻页和 Diff/冲突切换实现逻辑取消与过期结果丢弃 | 快速选择不会回显旧内容 |

### E. 添加安全写操作和刷新能力

| Step | 学习目标 | 动手内容 | 验收结果 |
| ---: | --- | --- | --- |
| 29 | 理解 index 与 patch | 实现文件级及 `git.stageHunks`/`git.unstageHunks`，操作完成刷新 Diff/status | 可全选或仅移动指定修改点；过期 token 被拒绝 |
| 30 | 理解提交对象 | 实现 `git.commit`，校验提交消息、签名和暂存状态 | 新提交出现于历史列表，空提交被拒绝 |
| 31 | 理解撤销提交与保留改动 | 实现 `Undo` 与 `git.undoLastCommit`，在确认框选择 soft/mixed reset 语义 | 未推送提交被撤销且可分别恢复到 staged/unstaged；已推送或状态未知时拒绝执行 |
| 32 | 理解 checkout 风险 | 实现安全的 `git.checkout`，遇到会覆盖修改的情况拒绝操作 | 脏工作区不会因切换分支而丢内容 |
| 33 | 理解贮藏工作流 | 实现 `git.stash`、`git.stashApply`、`git.stashPop` | `Apply` 保留记录；`Pop` 成功后删除；冲突不丢 stash |
| 34 | 理解远程跟踪引用 | 实现 `git.fetch` 及 ahead/behind 计算，更新左侧仓库待拉取徽标 | `Fetch` 后正确出现如 `3↓` 的数量提示 |
| 35 | 理解 Push refspec | 实现带 remote/source/target/upstream 参数的 `git.push` 弹窗和调用 | 可推送到同名或选定目标分支；没有强推入口 |
| 36 | 理解合并与冲突解决 | 实现 `git.pull`、`git.merge` 和 `git.resolveConflict` | 冲突能在三栏中选择、编辑并 Mark Resolved |
| 37 | 理解文件系统通知 | 使用 `ReadDirectoryChangesW` 监听 Windows 仓库，加入防抖并发送 `repo.changed` | 外部编辑文件后页面在目标时间内刷新 |
| 38 | 处理真实边界条件 | 覆盖中文路径、空仓库、冲突三栏、Stash、部分 Stage、Push 目标、Undo 拒绝路径及大 Diff | 第 8.2 节场景均有测试或人工验收记录 |

### F. 核心版本验收与发布学习

| Step | 学习目标 | 动手内容 | 验收结果 |
| ---: | --- | --- | --- |
| 39 | 学习性能测量 | 使用固定测试仓库记录 status/log/diff、冲突编辑器和 Graph 滚动指标 | 能与第 7.1 节预算对照并定位慢点 |
| 40 | 理解运行时分发 | 在 CLion Release Profile 下确认 CEF 必需 DLL/资源、libgit2 和前端资源进入可运行目录 | 在未配置开发路径的环境也能启动 |
| 41 | 理解桌面发布安全 | 梳理许可证、崩溃日志隐私、Windows 签名及 macOS 后续签名/公证事项 | 发布前清单完整可执行 |
| 42 | 完成核心版本验收 | 逐项执行第 11 节 MVP 清单，保存问题记录与修复验证 | 形成首个可试用安装包 |

### G. 完整产品能力扩展

| Step | 学习目标 | 动手内容 | 验收结果 |
| ---: | --- | --- | --- |
| 43 | 理解克隆与认证入口 | 实现 `repo.clone`、克隆进度、HTTPS/SSH 认证反馈 | 可从添加仓库弹窗克隆并自动打开远程仓库 |
| 44 | 完善引用管理 | 实现分支创建/重命名/删除、Tag 管理和 remote 配置页面 | 常用引用管理具备风险确认和中文解释 |
| 45 | 理解共享历史恢复 | 实现 `Revert` 与 `Cherry-pick`，统一复用三栏冲突解决流程 | 已推送提交可安全反向处理，挑选提交可应用 |
| 46 | 引入高级历史整理 | 设计并实现可中止/继续的 `Rebase` 高级流程 | 操作过程透明，冲突与恢复路径明确 |
| 47 | 扩展仓库类型支持 | 引入 submodule 状态与更新能力，并完善跨平台发布集成 | 复杂仓库状态展示和操作可验证 |
| 48 | 完整产品验收 | 对照第 8 节执行完整功能、性能、安全与双平台验证 | 整体设计中的规划能力具有可交付实现 |

---

## 11. 首期 MVP 版本定义

MVP 从上述完整设计中选择一条可用于真实本地开发的闭环路径。它保留用户已明确要求的核心交互，不代表未纳入能力会从总体设计中移除。

### 11.1 MVP 纳入范围

| 范围 | MVP 交付内容 | 对应步骤 |
| --- | --- | --- |
| 桌面框架 | CLion + MSVC/CMake 构建链、CEF 窗口、Vue 3 TSX 页面、Tailwind 语义类名、中文界面与英文 Git 操作按钮 | `1, 4-21` |
| 仓库工作台 | 添加本地仓库、左侧折叠菜单、多仓库页签、空状态、仓库会话 | `7-24` |
| 浏览能力 | status、refs、log、Canvas Graph、普通 Diff 与大文件保护 | `23-28` |
| 本地修改流 | 文件及 hunk 级 `Stage`/`Unstage`、`Commit`、两种恢复模式的 `Undo` | `29-31` |
| 分支与远程 | 安全 `Checkout`、`Fetch`、目标分支可选择的 `Push`、普通策略的 `Pull`/`Merge` | `32, 34-36` |
| 暂存与冲突 | `Stash`、`Apply`、`Pop`、Incoming/Result/Current 三栏冲突解决 | `33, 36` |
| 桌面体验 | 文件变化自动刷新、错误处理、基础性能验证与安装包准备 | `37-42` |

### 11.2 MVP 暂缓范围

| 能力 | 暂缓原因 | 完整设计中的位置 |
| --- | --- | --- |
| 克隆远程仓库 | 首期可先通过外部 Git 获取仓库，集中验证本地工作流与远程同步 | `repo.clone`、Step `43` |
| 分支删除/重命名、Tag 与 remote 设置界面 | 需要更多危险操作确认与设置页面设计 | Step `44` |
| `Revert`、`Cherry-pick`、交互式 `Rebase` | 历史编辑能力风险较高，需要冲突流程稳定后引入 | Step `45-46` |
| submodule 管理与平台 PR/MR 集成 | 不阻碍基本仓库操作闭环 | Step `47` 及后续规划 |

### 11.3 MVP 验收清单

- Windows 可启动应用、添加并打开本地仓库；macOS 架构保持可移植并在可用设备上执行冒烟验证。
- 左侧仓库菜单可折叠/展开；双击不同仓库能够创建并切换多个右侧页签。
- 工作区状态、历史、refs、Diff 与 Graph 使用真实 libgit2 数据返回，查询期间界面保持可交互。
- 文件级和修改块级 `Stage`/`Unstage`、`Commit`、`Undo` 两种恢复方式均正确工作。
- `Fetch` 更新左侧待拉取徽标；`Push` 可选择远程同名或自定义目标分支；`Pull`/`Merge` 不隐式改写历史。
- `Stash`、`Apply` 与 `Pop` 语义正确，冲突文件可以在三栏视图中完成解决并 `Mark Resolved`。
- 所有涉及 Git 状态读取或变更的按钮显示英文，中文 tooltip、确认信息与错误提示准确。
- 目录监听自动刷新、协议错误处理、特殊路径、较大历史和较大 Diff 场景具有覆盖验证。

---

## 12. 待决策事项

以下事项应在进入原生工程搭建前确定，并记录为架构决策（ADR）：

| 主题 | 待决定内容 |
| --- | --- |
| 依赖分发 | CEF/libgit2 的下载、缓存、许可证与打包方式 |
| 支持平台 | Windows 架构与最低 macOS 版本、是否提供 universal build |
| 前端资源加载 | 开发阶段 dev server 与发布阶段本地资源映射方式 |
| 凭据与远程 | 后续 fetch/push 的认证方案及凭据保存边界 |
| 事件通道 | C++ 到 Renderer 的固定事件桥接实现及协议版本升级策略 |
| 发布体系 | Windows 签名、macOS 签名与 notarization、自动更新策略 |

文档中的协议版本从 `1.0` 起步。任何破坏前端兼容性的接口变更都必须更新协议版本，并同步修改 Mock 数据与自动化测试。
