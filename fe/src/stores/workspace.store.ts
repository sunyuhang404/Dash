import { computed, ref } from 'vue';
import { defineStore } from 'pinia';

import { callNative } from '../api/native-rpc';
import type { CommitSummary, GitDiffResult, GitLogResult, GitRefsResult, GitStashesResult, GitStatusResult } from '../types/git.types';
import type { RepoAddParams, RepoListResult, RepoOpenResult, RepositoryRecord } from '../types/repository.types';

export type RepositoryWorkspaceView = 'status' | 'history';

export interface RepositoryTabItem {
  repositoryKey: string;
  displayName: string;
  branch: string;
  active: boolean;
  dirty: boolean;
}

const getFirstCommit = (commitHistory: GitLogResult): CommitSummary => {
  const [firstCommit] = commitHistory.commits;

  if (!firstCommit) {
    throw new Error('Dash commit history must include at least one commit before selecting a commit.');
  }

  return firstCommit;
};

const createEmptyStatus = (): GitStatusResult => ({
  branch: '',
  ahead: 0,
  behind: 0,
  is_clean: true,
  files: [],
});

const createEmptyDiff = (): GitDiffResult => ({
  file_path: '',
  old_path: null,
  binary: false,
  truncated: false,
  diff_token: '',
  selection_action: 'readonly',
  stats: {
    additions: 0,
    deletions: 0,
  },
  hunks: [],
});

const createEmptyLog = (): GitLogResult => ({
  commits: [],
  next_cursor: null,
});

const createEmptyRefs = (): GitRefsResult => ({
  locals: [],
  remotes: [],
  tags: [],
});

const createEmptyStashes = (): GitStashesResult => ({
  stashes: [],
});

export const useWorkspaceStore = defineStore('workspace', () => {
  const repositoryList = ref<RepoListResult>({ repositories: [] });
  const activeRepository = ref<RepoOpenResult | null>(null);
  const workingTreeStatus = ref<GitStatusResult>(createEmptyStatus());
  const currentDiff = ref<GitDiffResult>(createEmptyDiff());
  const commitHistory = ref<GitLogResult>(createEmptyLog());
  const repositoryRefs = ref<GitRefsResult>(createEmptyRefs());
  const stashes = ref<GitStashesResult>(createEmptyStashes());
  const activeExplorerView = ref<RepositoryWorkspaceView>('status');
  const selectedCommitSha = ref('');
  const selectedStatusFilePath = ref('');
  const workspaceLoading = ref(false);
  const workspaceError = ref<string | null>(null);
  const initialized = ref(false);

  const selectedCommit = computed(() =>
    commitHistory.value.commits.find((commit) => commit.sha === selectedCommitSha.value) ?? commitHistory.value.commits[0] ?? null,
  );

  const openTabs = computed<RepositoryTabItem[]>(() =>
    activeRepository.value
      ? [
          {
            repositoryKey: activeRepository.value.repository_key,
            displayName: activeRepository.value.display_name,
            branch: activeRepository.value.head.branch,
            active: true,
            dirty: !workingTreeStatus.value.is_clean,
          },
        ]
      : [],
  );

  const loadDiff = async (filePath: string) => {
    if (!activeRepository.value || !filePath) return;

    currentDiff.value = await callNative('git.diff', {
      repo_id: activeRepository.value.repo_id,
      file_path: filePath,
      source: { kind: 'head' },
      target: { kind: 'worktree' },
    });
    selectedStatusFilePath.value = filePath;
  };

  const refreshActiveRepository = async () => {
    if (!activeRepository.value) return;

    const repoRequest = { repo_id: activeRepository.value.repo_id };
    const [status, refs, history, stashList] = await Promise.all([
      callNative('git.status', repoRequest),
      callNative('git.refs', repoRequest),
      callNative('git.log', { ...repoRequest, limit: 80 }),
      callNative('git.stashes', repoRequest),
    ]);

    workingTreeStatus.value = status;
    repositoryRefs.value = refs;
    commitHistory.value = history;
    stashes.value = stashList;
    selectedCommitSha.value = getFirstCommit(history).sha;

    const firstChangedFile = status.files[0]?.path ?? '';
    selectedStatusFilePath.value = firstChangedFile;

    if (firstChangedFile) {
      await loadDiff(firstChangedFile);
    } else {
      currentDiff.value = createEmptyDiff();
    }
  };

  const openRepository = async (repositoryKey: string) => {
    workspaceLoading.value = true;
    workspaceError.value = null;

    try {
      activeRepository.value = await callNative('repo.open', { repository_key: repositoryKey });
      await refreshActiveRepository();
    } catch (error) {
      workspaceError.value = error instanceof Error ? error.message : '打开仓库失败';
    } finally {
      workspaceLoading.value = false;
    }
  };

  const initializeWorkspace = async () => {
    if (initialized.value || workspaceLoading.value) return;

    workspaceLoading.value = true;
    workspaceError.value = null;

    try {
      repositoryList.value = await callNative('repo.list', {});

      const firstRepository = repositoryList.value.repositories[0];
      if (firstRepository) {
        activeRepository.value = await callNative('repo.open', { repository_key: firstRepository.repository_key });
        await refreshActiveRepository();
      }

      initialized.value = true;
    } catch (error) {
      workspaceError.value = error instanceof Error ? error.message : '加载工作区失败';
    } finally {
      workspaceLoading.value = false;
    }
  };

  const addRepository = async (params: RepoAddParams): Promise<RepositoryRecord | null> => {
    workspaceLoading.value = true;
    workspaceError.value = null;

    try {
      const addedRepository = await callNative('repo.add', params);
      repositoryList.value = await callNative('repo.list', {});
      await openRepository(addedRepository.repository_key);

      return addedRepository;
    } catch (error) {
      workspaceError.value = error instanceof Error ? error.message : '添加仓库失败';

      return null;
    } finally {
      workspaceLoading.value = false;
    }
  };

  const selectCommit = (sha: string) => {
    selectedCommitSha.value = sha;
  };

  const selectStatusFile = async (path: string) => {
    await loadDiff(path);
  };

  const selectExplorerView = (view: RepositoryWorkspaceView) => {
    activeExplorerView.value = view;
  };

  return {
    repositoryList,
    activeRepository,
    workingTreeStatus,
    currentDiff,
    commitHistory,
    repositoryRefs,
    stashes,
    activeExplorerView,
    selectedCommitSha,
    selectedStatusFilePath,
    workspaceLoading,
    workspaceError,
    initialized,
    selectedCommit,
    openTabs,
    initializeWorkspace,
    openRepository,
    addRepository,
    selectCommit,
    selectStatusFile,
    selectExplorerView,
  };
});
