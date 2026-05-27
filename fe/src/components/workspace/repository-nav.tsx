import { defineComponent, type PropType } from 'vue';

import { DashIcon } from '../ui/dash-icon';
import type { RepositoryRecord } from '../../types/repository.types';

const getProjectPath = (path: string) =>
  path.replace('D:/workspace', '~/Projects').replace('D:/Workspace', '~/Projects').replace('/Dash', '/dash');

export const RepositoryNav = defineComponent({
  name: 'RepositoryNav',
  props: {
    repositories: {
      type: Array as PropType<RepositoryRecord[]>,
      default: () => [],
    },
  },
  setup: (props) => {
    return () => (
      <aside class="dash-repository-nav flex w-[13.25rem] shrink-0 flex-col border-r border-[#15263d] bg-[#081326]">
        <header class="dash-repo-nav-brand flex h-12 items-center justify-between px-4">
          <div class="dash-repo-nav-brand-title flex items-center gap-2">
            <span class="dash-repo-nav-brand-name text-base font-semibold text-slate-100">Dash</span>
            <span class="dash-repo-nav-brand-status size-2 rounded-full border border-slate-400" />
          </div>
          <button class="dash-repo-nav-sync text-slate-400 hover:text-slate-100" type="button" title="同步状态">
            <DashIcon name="fetch" />
          </button>
        </header>
        <label class="dash-repo-nav-search mx-3 mb-3 flex items-center gap-2 rounded-md border border-[#20314b] bg-[#101d33] px-2.5 py-1.5 text-slate-500">
          <DashIcon name="search" />
          <input
            class="dash-repo-nav-search-input min-w-0 flex-1 bg-transparent text-xs text-slate-300 outline-none placeholder:text-slate-500"
            placeholder="Search repositories"
            aria-label="搜索仓库"
          />
        </label>
        <nav class="dash-repo-nav-list flex-1 space-y-2 px-2" aria-label="已添加仓库">
          {props.repositories.map((repository, index) => (
            <button
              class={[
                'dash-repo-nav-item flex w-full items-start gap-3 rounded-lg px-2.5 py-2.5 text-left transition-colors',
                index === 0 ? 'is-active bg-[#12233a]' : 'hover:bg-[#0e1b30]',
              ]}
              type="button"
              key={repository.repository_key}
              title={repository.display_name}
            >
              <span class="dash-repo-nav-icon flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#182b44] text-sm font-semibold text-cyan-300">
                {repository.initial}
              </span>
              <span class="dash-repo-nav-content min-w-0 flex-1">
                <span class="dash-repo-nav-name block truncate text-sm text-slate-100">{repository.display_name}</span>
                <span class="dash-repo-nav-path mt-1 block truncate text-[11px] text-slate-500">
                  {getProjectPath(repository.root_path)}
                </span>
              </span>
              <span class="dash-repo-nav-current-branch mt-1 text-[10px] text-cyan-400">main</span>
            </button>
          ))}
        </nav>
        <footer class="dash-repo-nav-footer flex items-center justify-between border-t border-[#15263d] px-4 py-4">
          <button class="dash-repo-nav-add-button flex items-center gap-2 text-xs text-slate-400 hover:text-slate-100" type="button">
            <DashIcon name="plus" />
            添加仓库
          </button>
          <button class="dash-repo-nav-settings text-slate-400 hover:text-slate-100" type="button" title="设置">
            <DashIcon name="settings" />
          </button>
        </footer>
      </aside>
    );
  },
});
