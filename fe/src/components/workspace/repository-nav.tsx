import { defineComponent, ref, type PropType } from 'vue';

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
    const collapsed = ref(false);
    const hoveredRepositoryKey = ref<string | null>(null);

    const toggleCollapsed = () => {
      collapsed.value = !collapsed.value;
      hoveredRepositoryKey.value = null;
    };

    const showRepositoryTooltip = (repositoryKey: string) => {
      if (collapsed.value) {
        hoveredRepositoryKey.value = repositoryKey;
      }
    };

    const hideRepositoryTooltip = () => {
      hoveredRepositoryKey.value = null;
    };

    return () => (
      <aside
        class={[
          'dash-repository-nav flex shrink-0 flex-col border-r border-[#15263d] bg-[#081326] transition-[width] duration-200 ease-out',
          collapsed.value ? 'is-collapsed w-16 overflow-visible' : 'w-[13.25rem] overflow-hidden',
        ]}
        aria-expanded={!collapsed.value}
      >
        <header class={['dash-repo-nav-brand flex h-12 items-center px-4', collapsed.value ? 'justify-center' : 'justify-between']}>
          {!collapsed.value && (
            <div class="dash-repo-nav-brand-title flex items-center gap-2">
              <span class="dash-repo-nav-brand-mark" aria-hidden="true">
                <span>D</span>
              </span>
              <span class="dash-repo-nav-brand-name text-base font-semibold text-slate-100">Dash</span>
              <span class="dash-repo-nav-brand-status size-2 rounded-full border border-slate-400" />
            </div>
          )}
          {collapsed.value && (
            <span class="dash-repo-nav-brand-mark" aria-hidden="true">
              <span>D</span>
            </span>
          )}
        </header>
        {!collapsed.value && (
          <label class="dash-repo-nav-search mx-3 mb-3 flex items-center gap-2 rounded-md border border-[#20314b] bg-[#101d33] px-2.5 py-1.5 text-slate-500">
            <DashIcon name="search" />
            <input
              class="dash-repo-nav-search-input min-w-0 flex-1 bg-transparent text-xs text-slate-300 outline-none placeholder:text-slate-500"
              placeholder="Search repositories"
              aria-label="搜索仓库"
            />
          </label>
        )}
        <nav class={['dash-repo-nav-list flex-1 space-y-2 px-2', collapsed.value ? 'overflow-visible' : '']} aria-label="已添加仓库">
          {props.repositories.map((repository, index) => (
            <button
              class={[
                'dash-repo-nav-item relative flex w-full rounded-lg text-left transition-colors',
                collapsed.value
                  ? 'group items-center justify-center px-0 py-2'
                  : 'items-start gap-3 px-2.5 py-2.5',
                index === 0 ? 'is-active bg-[#12233a]' : 'hover:bg-[#0e1b30]',
              ]}
              type="button"
              key={repository.repository_key}
              title={repository.display_name}
              onMouseover={() => showRepositoryTooltip(repository.repository_key)}
              onMouseout={hideRepositoryTooltip}
              onFocusin={() => showRepositoryTooltip(repository.repository_key)}
              onFocusout={hideRepositoryTooltip}
            >
              <span class="dash-repo-nav-icon flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#182b44] text-sm font-semibold text-cyan-300">
                {repository.initial}
              </span>
              {collapsed.value && (
                <span
                  class={[
                    'dash-repo-nav-tooltip pointer-events-none absolute left-[3.75rem] top-1/2 z-20 -translate-y-1/2 whitespace-nowrap rounded-md border border-[#223753] bg-[#101d32] px-2.5 py-1.5 text-xs text-slate-100 shadow-lg shadow-black/30 transition-opacity duration-150',
                    hoveredRepositoryKey.value === repository.repository_key ? 'opacity-100' : 'opacity-0',
                  ]}
                >
                  {repository.display_name}
                </span>
              )}
              {!collapsed.value && (
                <>
                  <span class="dash-repo-nav-content min-w-0 flex-1">
                    <span class="dash-repo-nav-name block truncate text-sm text-slate-100">{repository.display_name}</span>
                    <span class="dash-repo-nav-path mt-1 block truncate text-[11px] text-slate-500">
                      {getProjectPath(repository.root_path)}
                    </span>
                  </span>
                  <span class="dash-repo-nav-current-branch mt-1 text-[10px] text-cyan-400">main</span>
                </>
              )}
              {collapsed.value && index === 0 && (
                <span class="dash-repo-nav-collapsed-current absolute right-2 top-2 size-1.5 rounded-full bg-cyan-400" />
              )}
            </button>
          ))}
        </nav>
        <footer
          class={[
            'dash-repo-nav-footer flex items-center border-t border-[#15263d]',
            collapsed.value ? 'flex-col gap-3 px-0 py-3' : 'justify-between px-4 py-4',
          ]}
        >
          <button
            class={[
              'dash-repo-nav-add-button flex items-center text-slate-400 hover:text-slate-100',
              collapsed.value ? 'justify-center' : 'gap-2 text-xs',
            ]}
            type="button"
            title="添加仓库"
            aria-label="添加仓库"
          >
            <DashIcon name="plus" />
            {!collapsed.value && '添加仓库'}
          </button>
          <button class="dash-repo-nav-settings text-slate-400 hover:text-slate-100" type="button" title="设置" aria-label="设置">
            <DashIcon name="settings" />
          </button>
          <button
            class="dash-repo-nav-collapse-toggle text-slate-400 hover:text-slate-100"
            type="button"
            title={collapsed.value ? '展开仓库列表' : '收起仓库列表'}
            aria-label={collapsed.value ? '展开仓库列表' : '收起仓库列表'}
            aria-pressed={collapsed.value}
            onClick={toggleCollapsed}
          >
            <DashIcon name={collapsed.value ? 'sidebarExpand' : 'sidebarCollapse'} />
          </button>
        </footer>
      </aside>
    );
  },
});
