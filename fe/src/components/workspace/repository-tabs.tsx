import { defineComponent, type PropType } from 'vue';

import { DashIcon } from '../ui/dash-icon';

export interface RepositoryTabItem {
  repositoryKey: string;
  displayName: string;
  branch: string;
  active: boolean;
  dirty: boolean;
}

export const RepositoryTabs = defineComponent({
  name: 'RepositoryTabs',
  props: {
    tabs: {
      type: Array as PropType<RepositoryTabItem[]>,
      default: () => [],
    },
  },
  setup: (props) => {
    return () => (
      <header class="dash-repository-tabs flex h-11 shrink-0 items-end border-b border-[#172a42] bg-[#071224] px-2">
        <div class="dash-repository-tab-list flex h-full items-end gap-1" role="tablist" aria-label="打开的仓库">
          {props.tabs.map((tab) => (
            <div
              class={[
                'dash-repository-tab flex h-10 items-center gap-2 rounded-t-lg border border-b-0 px-3 text-sm',
                tab.active
                  ? 'is-active border-[#233852] bg-[#101d32] text-white'
                  : 'border-transparent text-slate-400',
              ]}
              role="tab"
              aria-selected={tab.active}
              key={tab.repositoryKey}
            >
              <span class="dash-repository-tab-name">{tab.displayName}</span>
              <span class="dash-repository-tab-branch text-xs text-slate-400">{tab.branch}</span>
              {tab.dirty && (
                <span class="dash-repository-tab-dirty size-1.5 rounded-full bg-amber-400" title="存在未提交变更" />
              )}
              <button
                class="dash-repository-tab-close ml-1 text-slate-500 hover:text-slate-200"
                type="button"
                title="关闭页签"
                aria-label={`关闭 ${tab.displayName} 页签`}
              >
                <DashIcon name="close" />
              </button>
            </div>
          ))}
          <button
            class="dash-repository-tab-add flex h-10 w-10 items-center justify-center rounded-t-lg border border-b-0 border-[#1b2d46] text-slate-500 hover:bg-[#101d32] hover:text-slate-200"
            type="button"
            title="打开仓库页签"
            aria-label="打开仓库页签"
          >
            <DashIcon name="plus" />
          </button>
        </div>
      </header>
    );
  },
});
