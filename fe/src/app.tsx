import { computed, defineComponent, ref } from 'vue';
import { Pane, Splitpanes } from 'splitpanes';
import 'splitpanes/dist/splitpanes.css';

import { AddRepositoryModal } from './components/modals/add-repository-modal';
import { CommitDetailPanel } from './components/workspace/commit-detail-panel';
import { DiffPanel } from './components/workspace/diff-panel';
import { HistoryPanel } from './components/workspace/history-panel';
import { RepoToolbar } from './components/workspace/repo-toolbar';
import { RepositoryExplorer } from './components/workspace/repository-explorer';
import { RepositoryNav } from './components/workspace/repository-nav';
import { RepositoryTabs, type RepositoryTabItem } from './components/workspace/repository-tabs';
import diffMock from './mocks/rpc/git.diff.json';
import logMock from './mocks/rpc/git.log.json';
import refsMock from './mocks/rpc/git.refs.json';
import stashesMock from './mocks/rpc/git.stashes.json';
import statusMock from './mocks/rpc/git.status.json';
import repoListMock from './mocks/rpc/repo.list.json';
import repoOpenMock from './mocks/rpc/repo.open.json';
import type { GitDiffResult, GitLogResult, GitRefsResult, GitStashesResult, GitStatusResult } from './types/git.types';
import type { RepoListResult, RepoOpenResult } from './types/repository.types';

const repositoryList = repoListMock as RepoListResult;
const activeRepository = repoOpenMock as RepoOpenResult;
const workingTreeStatus = statusMock as GitStatusResult;
const currentDiff = diffMock as GitDiffResult;
const commitHistory = logMock as GitLogResult;
const repositoryRefs = refsMock as GitRefsResult;
const stashes = stashesMock as GitStashesResult;
const defaultCommit = commitHistory.commits[0];
const openTabs: RepositoryTabItem[] = [
  {
    repositoryKey: activeRepository.repository_key,
    displayName: activeRepository.display_name,
    branch: activeRepository.head.branch,
    active: true,
    dirty: !workingTreeStatus.is_clean,
  },
];

export const App = defineComponent({
  name: 'App',
  setup: () => {
    const selectedCommitSha = ref(defaultCommit.sha);
    const selectedCommit = computed(
      () => commitHistory.commits.find((commit) => commit.sha === selectedCommitSha.value) ?? defaultCommit,
    );

    const handleSelectCommit = (sha: string) => {
      selectedCommitSha.value = sha;
    };

    return () => (
      <main class="dash-app flex h-screen overflow-hidden bg-slate-950 text-slate-100">
        <RepositoryNav repositories={repositoryList.repositories} />
        <section class="dash-workspace-preview flex min-w-0 flex-1 flex-col">
          <RepositoryTabs tabs={openTabs} />
          <div class="dash-repository-workspace flex min-h-0 flex-1">
            <Splitpanes class="dash-repository-splitpanes min-h-0 flex-1">
              <Pane size={15} minSize={12} maxSize={28}>
                <RepositoryExplorer status={workingTreeStatus} refs={repositoryRefs} stashes={stashes} />
              </Pane>
              <Pane size={85} minSize={60}>
                <section class="dash-history-workspace flex h-full min-w-0 flex-col">
                  <RepoToolbar />
                  <Splitpanes class="dash-history-splitpanes min-h-0 flex-1" horizontal>
                    <Pane size={58} minSize={24}>
                      <HistoryPanel
                        commits={commitHistory.commits}
                        selectedSha={selectedCommit.value.sha}
                        onSelect={handleSelectCommit}
                      />
                    </Pane>
                    <Pane size={42} minSize={28}>
                      <div class="dash-history-selection grid h-full min-h-0 grid-cols-[23rem_minmax(20rem,1fr)] border-t border-[#182b43]">
                        <CommitDetailPanel commit={selectedCommit.value} diff={currentDiff} />
                        <DiffPanel diff={currentDiff} />
                      </div>
                    </Pane>
                  </Splitpanes>
                </section>
              </Pane>
            </Splitpanes>
          </div>
        </section>
        <AddRepositoryModal open={false} />
      </main>
    );
  },
});
