import { defineComponent, type PropType } from 'vue';

import type { GitStatusResult, StatusFile } from '../../types/git.types';

const getStatusLabel = (file: StatusFile) => {
  if (file.index_status !== 'unmodified') return file.index_status;
  return file.worktree_status;
};

export const WorkingTreePanel = defineComponent({
  name: 'WorkingTreePanel',
  props: {
    status: {
      type: Object as PropType<GitStatusResult>,
      required: true,
    },
  },
  setup: (props) => {
    return () => (
      <section class="dash-working-tree-panel flex min-h-0 flex-col border border-slate-800 bg-slate-900/60">
        <header class="dash-working-tree-header flex items-center justify-between border-b border-slate-800 px-4 py-3">
          <h2 class="dash-working-tree-title text-sm font-semibold text-slate-100">工作区</h2>
          <span class="dash-working-tree-count text-xs text-slate-400">{props.status.files.length} 个变更</span>
        </header>
        <div class="dash-working-tree-files flex-1 space-y-1 p-2">
          {props.status.files.map((file) => (
            <button
              class={[
                'dash-working-tree-file flex w-full items-center justify-between rounded-md px-2 py-2 text-left text-xs hover:bg-slate-800',
                file.worktree_status === 'conflicted' ? 'has-conflict text-rose-300' : 'text-slate-300',
              ]}
              type="button"
              key={file.path}
            >
              <span class="dash-working-tree-file-path truncate">{file.path}</span>
              <span class="dash-working-tree-file-status ml-3 uppercase text-slate-500">
                {getStatusLabel(file)}
              </span>
            </button>
          ))}
        </div>
        <footer class="dash-working-tree-footer border-t border-slate-800 p-3">
          <textarea
            class="dash-working-tree-message h-16 w-full resize-none rounded-md border border-slate-700 bg-slate-950 p-2 text-xs text-slate-300 placeholder:text-slate-600"
            placeholder="输入提交信息"
            aria-label="提交信息"
          />
          <button
            class="dash-working-tree-commit-button mt-2 w-full rounded-md bg-cyan-600 px-3 py-2 text-sm font-medium text-white hover:bg-cyan-500"
            type="button"
            title="提交已暂存的文件变更"
          >
            Commit
          </button>
        </footer>
      </section>
    );
  },
});
