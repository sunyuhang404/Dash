import { defineComponent, ref, type PropType } from 'vue';

import { DashIcon } from '../ui/dash-icon';
import type { GitRefsResult, GitStashesResult, GitStatusResult } from '../../types/git.types';

type ExplorerGroup = 'locals' | 'remotes' | 'tags' | 'stashes';

const renderChevron = (expanded: boolean) => (
  <svg
    class={['dash-repository-explorer-chevron size-3 transition-transform', expanded ? 'rotate-90' : 'rotate-0']}
    viewBox="0 0 12 12"
    fill="none"
    aria-hidden="true"
  >
    <path d="M4 2.25L7.75 6 4 9.75" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
  </svg>
);

export const RepositoryExplorer = defineComponent({
  name: 'RepositoryExplorer',
  props: {
    status: {
      type: Object as PropType<GitStatusResult>,
      required: true,
    },
    refs: {
      type: Object as PropType<GitRefsResult>,
      required: true,
    },
    stashes: {
      type: Object as PropType<GitStashesResult>,
      required: true,
    },
  },
  setup: (props) => {
    const expandedGroups = ref<Record<ExplorerGroup, boolean>>({
      locals: true,
      remotes: true,
      tags: true,
      stashes: true,
    });

    const toggleGroup = (group: ExplorerGroup) => {
      expandedGroups.value[group] = !expandedGroups.value[group];
    };

    return () => (
      <aside class="dash-repository-explorer flex h-full min-h-0 w-full shrink-0 flex-col bg-[#101d32]">
        <section class="dash-repository-explorer-views mx-2 flex shrink-0 flex-col gap-[5px] border-b border-[#162941] py-2">
            <button
              class="dash-repository-explorer-view is-selected flex w-full items-center gap-2 rounded-md bg-[#172b45] px-3 py-1.5 text-sm font-medium text-slate-100"
              type="button"
            >
              <DashIcon name="workspace" />
              <span class="dash-repository-explorer-view-name">工作区</span>
            </button>
            <button
              class="dash-repository-explorer-view flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-sm text-slate-400 hover:bg-[#122238] hover:text-slate-100"
              type="button"
              aria-current="page"
            >
              <DashIcon name="history" />
              <span class="dash-repository-explorer-view-name">历史</span>
            </button>
        </section>

        <nav class="dash-repository-explorer-navigation min-h-0 flex-1 overflow-auto px-2 pb-2" aria-label="仓库引用与贮藏">
          <section class="dash-repository-explorer-group mt-2">
            <button
              class="dash-repository-explorer-group-toggle mb-1 flex w-full items-center justify-between rounded-md py-1 text-xs font-semibold text-slate-400 hover:text-slate-200"
              type="button"
              aria-expanded={expandedGroups.value.locals}
              onClick={() => toggleGroup('locals')}
            >
              <span class="dash-repository-explorer-group-heading flex items-center gap-2">
                {renderChevron(expandedGroups.value.locals)}
                <DashIcon name="branch" />
                <span class="dash-repository-explorer-group-name">本地分支</span>
              </span>
              <span class="dash-repository-explorer-group-count text-slate-600">{props.refs.locals.length}</span>
            </button>
            <div
              class={[
                'dash-repository-explorer-collapse grid transition-[grid-template-rows,opacity] duration-200 ease-out',
                expandedGroups.value.locals ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
              ]}
              aria-hidden={!expandedGroups.value.locals}
              inert={!expandedGroups.value.locals}
            >
              <ul class="dash-repository-explorer-items min-h-0 overflow-hidden">
                {props.refs.locals.map((branch) => (
                  <li class="dash-repository-explorer-item" key={branch.name}>
                    <button
                      class={[
                        'dash-repository-explorer-reference flex w-full items-center gap-2 rounded-md px-3 py-1 text-sm',
                        branch.is_head ? 'is-current text-cyan-200' : 'text-slate-400 hover:text-slate-100',
                      ]}
                      type="button"
                    >
                      <span
                        class={[
                          'dash-repository-explorer-reference-dot size-1.5 rounded-full',
                          branch.is_head ? 'bg-cyan-400' : 'border border-slate-500',
                        ]}
                      />
                      <span class="dash-repository-explorer-reference-name truncate text-xs">{branch.name}</span>
                      {branch.is_head && (
                        <span class="dash-repository-explorer-reference-head ml-auto rounded bg-cyan-950 px-1.5 py-0.5 text-[10px] text-cyan-300">
                          HEAD
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <section class="dash-repository-explorer-group mt-2">
            <button
              class="dash-repository-explorer-group-toggle mb-1 flex w-full items-center justify-between rounded-md py-1 text-xs font-semibold text-slate-400 hover:text-slate-200"
              type="button"
              aria-expanded={expandedGroups.value.remotes}
              onClick={() => toggleGroup('remotes')}
            >
              <span class="dash-repository-explorer-group-heading flex items-center gap-2">
                {renderChevron(expandedGroups.value.remotes)}
                <DashIcon name="branch" />
                <span class="dash-repository-explorer-group-name">远程分支</span>
              </span>
              <span class="dash-repository-explorer-group-count text-slate-600">{props.refs.remotes.length}</span>
            </button>
            <div
              class={[
                'dash-repository-explorer-collapse grid transition-[grid-template-rows,opacity] duration-200 ease-out',
                expandedGroups.value.remotes ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
              ]}
              aria-hidden={!expandedGroups.value.remotes}
              inert={!expandedGroups.value.remotes}
            >
              <ul class="dash-repository-explorer-items min-h-0 overflow-hidden">
                {props.refs.remotes.map((branch) => (
                  <li class="dash-repository-explorer-item" key={branch.name}>
                    <button
                      class="dash-repository-explorer-reference flex w-full items-center gap-2 rounded-md px-3 py-1 text-xs text-slate-400 hover:text-slate-100"
                      type="button"
                    >
                      <span class="dash-repository-explorer-reference-dot size-1.5 rounded-full bg-indigo-400" />
                      <span class="dash-repository-explorer-reference-name truncate">{branch.name}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <section class="dash-repository-explorer-group mt-2">
            <button
              class="dash-repository-explorer-group-toggle mb-1 flex w-full items-center justify-between rounded-md py-1 text-xs font-semibold text-slate-400 hover:text-slate-200"
              type="button"
              aria-expanded={expandedGroups.value.tags}
              onClick={() => toggleGroup('tags')}
            >
              <span class="dash-repository-explorer-group-heading flex items-center gap-2">
                {renderChevron(expandedGroups.value.tags)}
                <DashIcon name="tag" />
                <span class="dash-repository-explorer-group-name">标签</span>
              </span>
              <span class="dash-repository-explorer-group-count text-slate-600">{props.refs.tags.length}</span>
            </button>
            <div
              class={[
                'dash-repository-explorer-collapse grid transition-[grid-template-rows,opacity] duration-200 ease-out',
                expandedGroups.value.tags ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
              ]}
              aria-hidden={!expandedGroups.value.tags}
              inert={!expandedGroups.value.tags}
            >
              <ul class="dash-repository-explorer-items min-h-0 overflow-hidden">
                {props.refs.tags.map((tag) => (
                  <li class="dash-repository-explorer-item" key={tag.name}>
                    <button
                      class="dash-repository-explorer-reference flex w-full items-center gap-2 rounded-md px-3 py-1 text-xs text-slate-400 hover:text-slate-100"
                      type="button"
                    >
                      <span class="dash-repository-explorer-tag-mark rounded-sm border border-amber-500/70 px-1 text-[10px] text-amber-400">
                        tag
                      </span>
                      <span class="dash-repository-explorer-reference-name truncate">{tag.name}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <section class="dash-repository-explorer-group mt-2">
            <button
              class="dash-repository-explorer-group-toggle mb-1 flex w-full items-center justify-between rounded-md py-1 text-xs font-semibold text-slate-400 hover:text-slate-200"
              type="button"
              aria-expanded={expandedGroups.value.stashes}
              onClick={() => toggleGroup('stashes')}
            >
              <span class="dash-repository-explorer-group-heading flex items-center gap-2">
                {renderChevron(expandedGroups.value.stashes)}
                <DashIcon name="stash" />
                <span class="dash-repository-explorer-group-name">贮藏</span>
              </span>
              <span class="dash-repository-explorer-group-count text-slate-600">{props.stashes.stashes.length}</span>
            </button>
            <div
              class={[
                'dash-repository-explorer-collapse grid transition-[grid-template-rows,opacity] duration-200 ease-out',
                expandedGroups.value.stashes ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
              ]}
              aria-hidden={!expandedGroups.value.stashes}
              inert={!expandedGroups.value.stashes}
            >
              <ul class="dash-repository-explorer-items min-h-0 overflow-hidden">
                {props.stashes.stashes.map((stash) => (
                  <li class="dash-repository-explorer-item" key={stash.stash_id}>
                    <button
                      class="dash-repository-explorer-stash w-full truncate rounded-md px-3 py-1 text-left text-xs text-slate-400 hover:bg-slate-800/60 hover:text-slate-100"
                      type="button"
                    >
                      <span class="dash-repository-explorer-stash-name block truncate">{stash.message}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        </nav>
      </aside>
    );
  },
});
