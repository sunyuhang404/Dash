export interface RepoRequest {
  repo_id: string;
}

export type GitFileState =
  | 'unmodified'
  | 'new'
  | 'modified'
  | 'deleted'
  | 'renamed'
  | 'typechange'
  | 'conflicted'
  | 'ignored';

export interface StatusFile {
  path: string;
  index_status: GitFileState;
  worktree_status: GitFileState;
  old_path: string | null;
}

export interface GitStatusResult {
  branch: string;
  ahead: number;
  behind: number;
  is_clean: boolean;
  files: StatusFile[];
}

export interface GitReference {
  name: string;
  sha: string;
  is_head?: boolean;
}

export interface GitRefsResult {
  locals: GitReference[];
  remotes: GitReference[];
  tags: GitReference[];
}

export interface GitLogParams extends RepoRequest {
  ref?: string;
  limit: number;
  cursor?: string;
}

export interface CommitAuthor {
  name: string;
  email: string;
}

export interface CommitSummary {
  sha: string;
  parents: string[];
  author: CommitAuthor;
  authored_at: number;
  summary: string;
  refs: string[];
}

export interface GitLogResult {
  commits: CommitSummary[];
  next_cursor: string | null;
}

export type DiffTargetKind = 'head' | 'index' | 'worktree' | 'commit';

export interface DiffTarget {
  kind: DiffTargetKind;
  sha?: string;
}

export interface GitDiffParams extends RepoRequest {
  file_path: string;
  source: DiffTarget;
  target: DiffTarget;
}

export type DiffSelectionAction = 'stage' | 'unstage' | 'readonly';
export type DiffLineOrigin = 'context' | 'deletion' | 'addition';

export interface DiffLine {
  origin: DiffLineOrigin;
  content: string;
}

export interface DiffHunk {
  hunk_id: string;
  old_start: number;
  old_lines: number;
  new_start: number;
  new_lines: number;
  header: string;
  lines: DiffLine[];
}

export interface GitDiffResult {
  file_path: string;
  old_path: string | null;
  binary: boolean;
  truncated: boolean;
  diff_token: string;
  selection_action: DiffSelectionAction;
  stats: {
    additions: number;
    deletions: number;
  };
  hunks: DiffHunk[];
}

export interface StashItem {
  stash_id: string;
  message: string;
  created_at: number;
  file_count: number;
}

export interface GitStashesResult {
  stashes: StashItem[];
}

export interface GitConflictDetailParams extends RepoRequest {
  file_path: string;
}

export interface ConflictSource {
  label: string;
  ref: string;
  content: string;
}

export interface GitConflictDetailResult {
  file_path: string;
  incoming: ConflictSource;
  current: ConflictSource;
  result: {
    content: string;
  };
  conflict_blocks: Array<{
    block_id: string;
    resolved: boolean;
  }>;
  conflict_token: string;
}

export interface PathsParams extends RepoRequest {
  paths: string[];
}

export interface HunksParams extends RepoRequest {
  file_path: string;
  hunk_ids: string[];
  diff_token: string;
}

export interface GitCommitParams extends RepoRequest {
  message: string;
}

export interface GitUndoLastCommitParams extends RepoRequest {
  expected_head_sha: string;
  restore_mode: 'staged' | 'unstaged';
}

export interface GitUndoLastCommitResult {
  previous_head_sha?: string;
  restored_state: 'staged' | 'unstaged';
  unborn_head?: boolean;
}

export interface GitCheckoutParams extends RepoRequest {
  branch: string;
}

export interface GitMergeParams extends RepoRequest {
  source_ref: string;
}

export interface GitStashParams extends RepoRequest {
  message?: string;
  include_untracked: boolean;
}

export interface StashOperationParams extends RepoRequest {
  stash_id: string;
}

export interface GitFetchParams extends RepoRequest {
  remote?: string;
}

export interface GitPullParams extends RepoRequest {
  remote?: string;
  branch?: string;
}

export interface GitPushParams extends RepoRequest {
  remote: string;
  source_branch: string;
  target_branch: string;
  set_upstream: boolean;
}

export interface GitResolveConflictParams extends RepoRequest {
  file_path: string;
  result_content: string;
  conflict_token: string;
}
