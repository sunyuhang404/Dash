export type Platform = 'windows' | 'macos';
export type RemoteSummaryState = 'unknown' | 'checking' | 'known' | 'error';

export type AppFeature =
  | 'repository_list'
  | 'clone'
  | 'status'
  | 'log'
  | 'diff'
  | 'partial_stage'
  | 'branch'
  | 'tag'
  | 'merge'
  | 'conflict_resolver'
  | 'stash'
  | 'commit'
  | 'undo_commit'
  | 'revert'
  | 'cherry_pick'
  | 'fetch'
  | 'pull'
  | 'push'
  | 'watch';

export interface AppCapabilitiesResult {
  protocol_version: string;
  platform: Platform;
  app_version: string;
  features: AppFeature[];
}

export interface RemoteSummary {
  behind: number;
  ahead: number;
  checked_at?: number;
  state: RemoteSummaryState;
}

export interface RepositoryRecord {
  repository_key: string;
  root_path: string;
  display_name: string;
  group?: string;
  initial: string;
  auto_fetch_on_open: boolean;
  remote_summary?: RemoteSummary;
}

export interface RepoListResult {
  repositories: RepositoryRecord[];
}

export interface RepoAddParams {
  path: string;
  display_name?: string;
  group?: string;
  auto_fetch_on_open: boolean;
}

export type RepoAddResult = RepositoryRecord;

export interface RepoCloneParams {
  url: string;
  target_path: string;
  display_name?: string;
  group?: string;
  open_after_clone: boolean;
}

export interface RepoCloneResult {
  repository_key: string;
  root_path: string;
  display_name: string;
  cloned: boolean;
  opened: boolean;
}

export interface RepoOpenParams {
  repository_key: string;
}

export interface RepositoryHead {
  branch: string;
  sha: string;
  detached: boolean;
}

export interface RepoOpenResult {
  repo_id: string;
  repository_key: string;
  root_path: string;
  display_name: string;
  head: RepositoryHead;
}

export interface RepoCloseParams {
  repo_id: string;
}

export interface RepoCloseResult {
  closed: boolean;
}
