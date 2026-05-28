import { defineComponent } from 'vue';

import { DashIcon, type DashIconName } from '../ui/dash-icon';

interface ToolbarAction {
  label: string;
  tooltip: string;
  icon: DashIconName;
  tone?: 'primary' | 'default' | 'muted';
  disabled?: boolean;
}

const toolbarActions: ToolbarAction[] = [
  { label: 'Fetch', tooltip: '获取远程最新信息，但不修改当前工作区', icon: 'fetch' },
  { label: 'Pull', tooltip: '拉取远程提交并合并到当前分支', icon: 'pull' },
  { label: 'Push', tooltip: '将本地分支推送到选定的远程分支', icon: 'push' },
  { label: 'Merge', tooltip: '将选定分支合并到当前分支', icon: 'merge' },
  { label: 'Commit', tooltip: '提交已暂存的文件变更', icon: 'commit', tone: 'primary' },
  { label: 'Undo', tooltip: '撤销最近一次未推送的提交，并选择改动恢复位置', icon: 'undo', tone: 'muted', disabled: true },
  { label: 'Stash', tooltip: '临时保存当前未提交的文件改动', icon: 'stash' },
];

export const RepoToolbar = defineComponent({
  name: 'RepoToolbar',
  setup: () => {
    return () => (
      <section class="dash-repo-toolbar flex h-14 shrink-0 items-center justify-between border-b border-[#172a42] bg-[#09162a] px-4">
        <div class="dash-repo-toolbar-actions flex items-center gap-2" aria-label="Git 操作">
          {toolbarActions.map((action) => (
            <button
              class={[
                'dash-repo-toolbar-action flex items-center gap-2 rounded-md px-3 py-2 text-xs',
                action.tone === 'primary' && 'is-primary',
                action.tone === 'muted' && 'is-muted',
              ]}
              type="button"
              key={action.label}
              title={action.tooltip}
              disabled={action.disabled}
            >
              <DashIcon name={action.icon} />
              {action.label}
            </button>
          ))}
          <button
            class="dash-repo-toolbar-more flex size-9 items-center justify-center rounded-md border border-[#233751] text-slate-300 hover:bg-[#12243b]"
            type="button"
            title="更多操作"
          >
            <DashIcon name="more" />
          </button>
        </div>
        <div class="dash-repo-toolbar-tools flex items-center gap-2">
          <label class="dash-repo-toolbar-search flex w-52 items-center gap-2 rounded-md border border-[#20324d] bg-[#071326] px-3 py-2 text-slate-500">
            <DashIcon name="search" />
            <input
              class="dash-repo-toolbar-search-input min-w-0 flex-1 bg-transparent text-xs text-slate-300 outline-none placeholder:text-slate-500"
              placeholder="搜索提交"
              aria-label="搜索提交"
            />
            <kbd class="dash-repo-toolbar-shortcut rounded border border-[#253650] px-1.5 py-0.5 text-[10px] leading-none text-slate-500">
              ⌘ K
            </kbd>
          </label>
          <button
            class="dash-repo-toolbar-filter flex size-9 items-center justify-center rounded-md border border-[#20324d] text-slate-400 hover:bg-[#12243b] hover:text-slate-100"
            type="button"
            title="筛选历史"
          >
            <DashIcon name="filter" />
          </button>
        </div>
      </section>
    );
  },
});
