# RPC Mock Data

这些 JSON 文件表示 JSON-RPC 响应中的 `result` 业务数据，不包含外层的 `jsonrpc` 和 `id`。

在 CEF 与 libgit2 接入前，前端通过这些固定数据练习仓库列表、工作区状态、历史、Diff 和冲突解决界面。后续实现 `MockRpcTransport` 时，应按 `src/api/rpc-methods.types.ts` 的方法映射返回相应文件内容。
