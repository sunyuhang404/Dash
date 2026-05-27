export type RpcId = string;

export interface RpcRequest<TParams> {
  jsonrpc: '2.0';
  id: RpcId;
  method: string;
  params: TParams;
}

export interface RpcSuccess<TResult> {
  jsonrpc: '2.0';
  id: RpcId;
  result: TResult;
}

export interface RpcErrorData {
  libgit2_code?: number;
  git_class?: string;
  operation?: string;
  [key: string]: unknown;
}

export interface RpcFailure {
  jsonrpc: '2.0';
  id: RpcId;
  error: {
    code: RpcErrorCode;
    message: string;
    data?: RpcErrorData;
  };
}

export type RpcResponse<TResult> = RpcSuccess<TResult> | RpcFailure;

export const RPC_ERROR_CODES = {
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  REPOSITORY_NOT_FOUND: 1001,
  REPOSITORY_CLOSED: 1002,
  OPERATION_CANCELLED: 1003,
  REPOSITORY_ALREADY_ADDED: 1004,
  GIT_CONFLICT: 1101,
  DIRTY_WORKTREE: 1102,
  NOTHING_TO_COMMIT: 1103,
  UNDO_COMMIT_NOT_ALLOWED: 1104,
  HEAD_CHANGED: 1105,
  DIFF_BASE_CHANGED: 1106,
  UNRESOLVED_CONFLICTS: 1107,
  REMOTE_AUTH_REQUIRED: 1201,
  REMOTE_UNAVAILABLE: 1202,
  PUSH_REJECTED: 1203,
  INTERNAL_ERROR: 1900,
} as const;

export type RpcErrorCode = (typeof RPC_ERROR_CODES)[keyof typeof RPC_ERROR_CODES];

export interface RepoChangedPayload {
  repo_id: string;
  reason: 'filesystem' | 'operation';
  sequence: number;
}

export interface RepoHeadChangedPayload {
  repo_id: string;
  branch: string;
  sha: string;
}

export interface RepoRemoteSummaryChangedPayload {
  repo_id: string;
  ahead: number;
  behind: number;
  checked_at: number;
}

export interface RepoConflictsChangedPayload {
  repo_id: string;
  unresolved_count: number;
}

export interface AppThemeChangedPayload {
  theme: 'dark' | 'light';
}

export interface RpcEventMap {
  'repo.changed': RepoChangedPayload;
  'repo.headChanged': RepoHeadChangedPayload;
  'repo.remoteSummaryChanged': RepoRemoteSummaryChangedPayload;
  'repo.conflictsChanged': RepoConflictsChangedPayload;
  'app.themeChanged': AppThemeChangedPayload;
}

export type RpcEventName = keyof RpcEventMap;

export type RpcEvent<TName extends RpcEventName = RpcEventName> = {
  [TEventName in TName]: {
    event: TEventName;
    payload: RpcEventMap[TEventName];
  };
}[TName];
