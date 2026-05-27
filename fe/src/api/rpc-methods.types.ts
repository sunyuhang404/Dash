import type {
  GitCheckoutParams,
  GitCommitParams,
  GitConflictDetailParams,
  GitConflictDetailResult,
  GitDiffParams,
  GitDiffResult,
  GitFetchParams,
  GitLogParams,
  GitLogResult,
  GitMergeParams,
  GitPullParams,
  GitPushParams,
  GitRefsResult,
  GitResolveConflictParams,
  GitStashesResult,
  GitStashParams,
  GitStatusResult,
  GitUndoLastCommitParams,
  GitUndoLastCommitResult,
  HunksParams,
  PathsParams,
  RepoRequest,
  StashOperationParams,
} from '../types/git.types';
import type {
  AppCapabilitiesResult,
  RepoAddParams,
  RepoAddResult,
  RepoCloneParams,
  RepoCloneResult,
  RepoCloseParams,
  RepoCloseResult,
  RepoListResult,
  RepoOpenParams,
  RepoOpenResult,
} from '../types/repository.types';

interface RpcOperation<TParams, TResult> {
  params: TParams;
  result: TResult;
}

export interface RpcMethodMap {
  'app.capabilities': RpcOperation<Record<string, never>, AppCapabilitiesResult>;
  'repo.list': RpcOperation<Record<string, never>, RepoListResult>;
  'repo.add': RpcOperation<RepoAddParams, RepoAddResult>;
  'repo.clone': RpcOperation<RepoCloneParams, RepoCloneResult>;
  'repo.open': RpcOperation<RepoOpenParams, RepoOpenResult>;
  'repo.close': RpcOperation<RepoCloseParams, RepoCloseResult>;
  'git.status': RpcOperation<RepoRequest, GitStatusResult>;
  'git.refs': RpcOperation<RepoRequest, GitRefsResult>;
  'git.log': RpcOperation<GitLogParams, GitLogResult>;
  'git.diff': RpcOperation<GitDiffParams, GitDiffResult>;
  'git.stashes': RpcOperation<RepoRequest, GitStashesResult>;
  'git.conflictDetail': RpcOperation<GitConflictDetailParams, GitConflictDetailResult>;
  'git.stage': RpcOperation<PathsParams, { staged: string[] }>;
  'git.unstage': RpcOperation<PathsParams, { unstaged: string[] }>;
  'git.stageHunks': RpcOperation<HunksParams, { staged_hunks: string[] }>;
  'git.unstageHunks': RpcOperation<HunksParams, { unstaged_hunks: string[] }>;
  'git.commit': RpcOperation<GitCommitParams, { sha: string }>;
  'git.undoLastCommit': RpcOperation<GitUndoLastCommitParams, GitUndoLastCommitResult>;
  'git.checkout': RpcOperation<GitCheckoutParams, { branch: string; sha: string }>;
  'git.merge': RpcOperation<GitMergeParams, { head_sha?: string; conflicted: boolean }>;
  'git.stash': RpcOperation<GitStashParams, { stash_id: string }>;
  'git.stashApply': RpcOperation<StashOperationParams, { applied: boolean; conflicted: boolean }>;
  'git.stashPop': RpcOperation<StashOperationParams, { applied: boolean; dropped: boolean; conflicted: boolean }>;
  'git.fetch': RpcOperation<GitFetchParams, { remote: string; ahead: number; behind: number }>;
  'git.pull': RpcOperation<GitPullParams, { head_sha?: string; updated: boolean; conflicted: boolean }>;
  'git.push': RpcOperation<GitPushParams, { remote: string; target_branch: string; pushed: boolean }>;
  'git.resolveConflict': RpcOperation<GitResolveConflictParams, { resolved: true; staged: true }>;
}

export type RpcMethod = keyof RpcMethodMap;
export type RpcParams<TMethod extends RpcMethod> = RpcMethodMap[TMethod]['params'];
export type RpcResult<TMethod extends RpcMethod> = RpcMethodMap[TMethod]['result'];
