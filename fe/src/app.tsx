import { defineComponent, onMounted } from 'vue';
import { storeToRefs } from 'pinia';
import { Pane, Splitpanes } from 'splitpanes';
import 'splitpanes/dist/splitpanes.css';

import { openAddRepositoryModal } from './components/modals';
import { CommitDetailPanel } from './components/workspace/commit-detail-panel';
import { DiffPanel } from './components/workspace/diff-panel';
import { FileStatusPanel } from './components/workspace/file-status-panel';
import { HistoryPanel } from './components/workspace/history-panel';
import { RepoToolbar } from './components/workspace/repo-toolbar';
import { RepositoryExplorer } from './components/workspace/repository-explorer';
import { RepositoryNav } from './components/workspace/repository-nav';
import { RepositoryTabs } from './components/workspace/repository-tabs';
import { useWorkspaceStore } from './stores/workspace.store';

export const App = defineComponent({
  name: 'App',
  setup: () => {
    const workspaceStore = useWorkspaceStore();
    const {
      repositoryList,
      workingTreeStatus,
      currentDiff,
      commitHistory,
      repositoryRefs,
      stashes,
      activeExplorerView,
      selectedStatusFilePath,
      selectedCommit,
      openTabs,
      activeRepository,
      workspaceLoading,
      workspaceError,
    } = storeToRefs(workspaceStore);

    onMounted(() => {
      void workspaceStore.initializeWorkspace();
    });

    const addRepository = async () => {
      try {
        const params = await openAddRepositoryModal();
        await workspaceStore.addRepository(params);
      } catch {
        // User cancelled the dialog.
      }
    };

    const renderWorkspaceBody = () => {
      if (workspaceError.value) {
        return (
          <div class="dash-workspace-state flex h-full flex-col items-center justify-center gap-3 text-sm text-slate-400">
            <strong class="text-slate-100">工作区加载失败</strong>
            <span>{workspaceError.value}</span>
            <button
              class="rounded-md border border-[#27405f] px-3 py-2 text-slate-200 hover:border-cyan-500"
              type="button"
              onClick={() => {
                void workspaceStore.initializeWorkspace();
              }}
            >
              重试
            </button>
          </div>
        );
      }

      if (workspaceLoading.value && !activeRepository.value) {
        return <div class="dash-workspace-state flex h-full items-center justify-center text-sm text-slate-400">正在通过 Mock RPC 加载仓库...</div>;
      }

      if (!activeRepository.value) {
        return <div class="dash-workspace-state flex h-full items-center justify-center text-sm text-slate-400">还没有打开仓库</div>;
      }

      return activeExplorerView.value === 'status' ? (
        <FileStatusPanel
          status={workingTreeStatus.value}
          diff={currentDiff.value}
          selectedPath={selectedStatusFilePath.value}
          onSelectFile={(path) => {
            void workspaceStore.selectStatusFile(path);
          }}
        />
      ) : (
        <Splitpanes class="dash-history-splitpanes min-h-0 flex-1" horizontal>
          <Pane size={58} minSize={24}>
            <HistoryPanel
              commits={commitHistory.value.commits}
              selectedSha={selectedCommit.value?.sha ?? ''}
              onSelect={workspaceStore.selectCommit}
            />
          </Pane>
          <Pane size={42} minSize={28}>
            {selectedCommit.value ? (
              <div class="dash-history-selection grid h-full min-h-0 grid-cols-[23rem_minmax(20rem,1fr)] border-t border-[#182b43]">
                <CommitDetailPanel commit={selectedCommit.value} diff={currentDiff.value} />
                <DiffPanel diff={currentDiff.value} />
              </div>
            ) : (
              <div class="dash-workspace-state flex h-full items-center justify-center text-sm text-slate-400">暂无提交历史</div>
            )}
          </Pane>
        </Splitpanes>
      );
    };

    return () => (
      <main class="dash-app flex h-screen overflow-hidden bg-slate-950 text-slate-100">
        <RepositoryNav
          repositories={repositoryList.value.repositories}
          activeRepositoryKey={activeRepository.value?.repository_key}
          onAddRepository={() => {
            void addRepository();
          }}
          onSelectRepository={(repositoryKey) => {
            void workspaceStore.openRepository(repositoryKey);
          }}
        />
        <section class="dash-workspace-preview flex min-w-0 flex-1">
          <Splitpanes class="dash-repository-splitpanes min-h-0 flex-1">
            <Pane size={15} minSize={14} maxSize={28}>
              <RepositoryExplorer
                status={workingTreeStatus.value}
                refs={repositoryRefs.value}
                stashes={stashes.value}
                activeView={activeExplorerView.value}
                onSelectView={workspaceStore.selectExplorerView}
              />
            </Pane>
            <Pane size={85} minSize={60}>
              <section class="dash-history-workspace flex h-full min-w-0 flex-col">
                <RepositoryTabs tabs={openTabs.value} />
                <RepoToolbar />
                {renderWorkspaceBody()}
              </section>
            </Pane>
          </Splitpanes>
        </section>
      </main>
    );
  },
});
