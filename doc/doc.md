# 📑 项目技术规范书：跨平台 Git 桌面客户端 Dash (CEF + Vue 3 + Libgit2)

## 1. 角色定义与核心目标

你是一位精通底层系统架构与前端大前端开发的资深专家。你的任务是实现一款专门运行在 Windows 和 macOS 上的高性能、跨平台 Git 桌面客户端。
该应用的架构设计为：使用 **CEF (Chromium Embedded Framework)** 作为原生外壳容器，前端渲染层采用 **Vue 3 (TS) + Tailwind CSS**，底层的 Git 核心引擎采用 **Libgit2 (C++) 静态库**。

---

## 2. 系统架构设计

```
+-----------------------------------------------------------------------+
|                    UI 渲染进程 (Chromium V8 Engine)                   |
|  [Vue 3 应用] -> [Pinia 状态] -> [虚拟滚动列表] -> [Monaco 编辑器]       |
+-----------------------------------------------------------------------+
                                   │  ▲
                                   │  │ CEF 异步高级 IPC 管道
                                   ▼  │ (CefMessageRouter / 原生桥接器)
+-----------------------------------------------------------------------+
|                    浏览器主进程 (Native C++ 主线程)                     |
|  [CefBrowserHost] -> [窗口管理器] -> [IPC 路由核心] -> [C++ 线程池]    |
+-----------------------------------------------------------------------+
                                   │  ▲
                                   │  │ C++ 原生 API / FFI 自由调用
                                   ▼  │
+-----------------------------------------------------------------------+
|                        Git 核心内核层 (Libgit2)                       |
|       [操作系统文件 I/O 读写] <---------> [.git 底层二进制数据库]      |
+-----------------------------------------------------------------------+

```

### 2.1 多线程与并发限制规则（极度核心）

1. **UI 线程安全第一**：CEF 的浏览器 UI 线程（Browser UI Thread）以及 JavaScript V8 引擎线程**绝对不能**被任何 Git 耗时操作阻塞。
2. **异步工作线程池**：所有涉及 Libgit2 的 API 调用（如 status, log, diff, commit 等）必须全部指派、调度到自定义的后台 **C++ Worker 线程池**中异步运行。
3. **线程同步回调**：后台任务执行完毕后，必须在执行 JS 回调之前，通过 `CefPostTask` 将计算结果安全地投递回 CEF UI 线程，再进行数据返回。

---

## 3. 技术栈选型与模块详细规范

### 3.1 前端渲染层 (Render Process)

- **核心框架**：Vue 3 (Composition API) + TypeScript + Vite 构建工具。
- **样式表现**：Tailwind CSS（优先适配暗黑模式，满足程序员审美）。
- **Git 分支网络图（Git Graph）**：必须使用 **HTML5 Canvas** 进行独立全量绘制，外部包裹一层虚拟滚动（Virtual Scroll）视口组件。**严禁**将每个 Commit 节点直接渲染为 DOM 节点，以防海量提交导致页面卡死。
- **代码差异对比（Diff）**：集成 **Monaco Editor** 的 Diff 模式，利用其内置的硬件加速和语法高亮，完美承载超大文本的 Diff 差异高亮和行折叠。

### 3.2 原生外壳层 (Browser Process)

- **外壳框架**：CEF (Chromium Embedded Framework) 官方标准轻量化发行版。
- **IPC 桥接**：采用 `CefMessageRouterBrowserSide` 组件，在前端通过 `window.cefQuery` 管道，遵循 **JSON-RPC 2.0** 协议进行异步消息吞吐。
- **窗口外观控制**：
- **macOS 端**：实现全无边框窗口（设置 `titlebarAppearsTransparent = true`、`fullSizeContentView = true`），前端手写 HTML 模拟红绿灯控制按钮。
- **Windows 端**：拦截并处理 `WM_NCCALCSIZE` 消息实现现代无边框窗口，同时在 CEF 初始化时开启 `CefEnableHighDPISupport()` 以完美适配高分屏（High DPI）缩放。

### 3.3 Git 内核层 (Libgit2)

- **核心引擎**：Libgit2 静态链接库（C 语言实现，无进程开销）。
- **字符集与路径编码**：前端统一通过 **UTF-8** 字符串传递路径。在 Windows 平台上，C++ 宿主在调用 Windows 操作系统原生文件 API 前，必须先转换为 **UTF-16 (WCHAR)**；但在将路径传给 Libgit2 函数（如 `git_repository_open`）时，需要恢复并保持 **UTF-8** 编码。

---

## 4. 原生通信接口契约 (IPC JSON-RPC 2.0)

Vue 3 与 C++ 之间的每一次通信必须严格遵守以下 JSON 格式契约：

### 4.1 前端请求模板

```javascript
window.cefQuery({
  request: JSON.stringify({
    jsonrpc: "2.0",
    method: "git.operation_name", // 命名空间格式: git.[具体动作]
    id: Date.now(),
    params: {
      /* 针对每个方法的特定入参 */
    },
  }),
  onSuccess: function (response) {
    /* 成功时的 Promise Resolve */
  },
  onFailure: function (errorCode, errorMessage) {
    /* 失败时的 Promise Reject */
  },
});
```

### 4.2 核心核心 API 响应报文定义

#### 1. `git.status` (获取当前工作区状态)

- **参数 (Params)**：`{ repo_path: string }`
- **C++ 底层行为**：调用 Libgit2 的 `git_status_list_new()` 函数。
- **成功返回 Payload**：

```json
{
  "is_clean": false,
  "files": [
    { "path": "src/main.ts", "status": "WT_MODIFIED" },
    { "path": "package.json", "status": "INDEX_MODIFIED" },
    { "path": "src/components/NewFile.vue", "status": "WT_NEW" }
  ]
}
```

#### 2. `git.log` (获取分支网络树拓扑数据)

- **参数 (Params)**：`{ repo_path: string, limit: number, skip: number }`
- **C++ 底层行为**：初始化 `git_revwalk_new()`，压入 `HEAD`，并设置排序方式为 `GIT_SORT_TOPOLOGICAL`。
- **成功返回 Payload**：

```json
{
  "commits": [
    {
      "sha": "a1b2c3d4e5f6...",
      "parents": ["e5f6g7h8..."],
      "author": "Sun Yuhang",
      "email": "yuhang@example.com",
      "time": 1716727200,
      "message": "feat: 完美实现高性能 git graph 渲染内核",
      "refs": ["refs/heads/main", "refs/remotes/origin/main"]
    }
  ]
}
```

#### 3. `git.diff` (获取单文件 Diff 差异块)

- **参数 (Params)**：`{ repo_path: string, file_path: string, sha_base?: string, sha_target?: string }`
- **C++ 底层行为**：利用 `git_diff_tree_to_workdir()` 或 `git_diff_tree_to_tree()` 生成增量 diff。
- **成功返回 Payload**：

```json
{
  "file_path": "src/main.ts",
  "hunks": [
    {
      "old_start": 10,
      "old_lines": 3,
      "new_start": 10,
      "new_lines": 4,
      "lines": [
        { "type": "context", "content": "function init() {" },
        { "type": "deletion", "content": "-   console.log('old');" },
        {
          "type": "addition",
          "content": "+   console.log('cef-git-client init');"
        },
        { "type": "context", "content": "}" }
      ]
    }
  ]
}
```

---

## 5. 阶段性实现路线图（供 AI 分步执行）

请按照以下递进步骤分阶段编写和生成代码：

- **第一阶段：构建前端 Mock 沙盒**：独立编写 Vue 3 应用。使用本规范书“第4节”中定义的 JSON 报文格式编写一套硬编码的 Mock 数据。优先调通 **Canvas 分支树的平滑绘制** 与 **Monaco Diff 编辑器的完美嵌入**，确保全量滚动达到 60fps。
- **第二阶段：搭建 CEF C++ 宿主骨架**：配置 CMake 跨平台编译工程。实现 Windows 和 macOS 的无边框窗口外壳、阴影及原生缩放逻辑，并在浏览器主进程中成功注册 `CefMessageRouter` 异步拦截器。
- **第三阶段：打通 Libgit2 核心绑定**：将 Libgit2 静态库引入 C++ 项目，初始化后台工作线程池。编写 C++ 的业务逻辑层，解析接收到的 `git.status` 和 `git.log` 请求，实时查询物理磁盘仓库后将其序列化为 JSON 字符串返回给 Vue 3。
- **第四阶段：联动优化与体验微调**：在 C++ 层实现系统级的目录监控器（Windows 端 `ReadDirectoryChangesW` / Mac 端 `FSEvents`）。一旦检测到项目目录发生代码修改，立即防抖并通过 `browser->ExecuteJavaScript` 主动向前端渲染进程发送刷新通知，实现工作区的无缝实时刷新。
