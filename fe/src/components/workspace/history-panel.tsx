import { defineComponent, type PropType } from 'vue';

import type { CommitSummary } from '../../types/git.types';

const getRefLabel = (reference: string) => reference.replace('refs/heads/', '').replace('refs/remotes/', '').replace('refs/tags/', '');

const getRefClass = (reference: string) => {
  if (reference.startsWith('refs/tags/')) return 'is-tag border-amber-700/70 bg-amber-950/60 text-amber-300';
  if (reference.startsWith('refs/remotes/')) return 'is-remote border-indigo-800 bg-indigo-950/60 text-indigo-300';
  return 'is-local border-cyan-800 bg-cyan-950/60 text-cyan-300';
};

export const HistoryPanel = defineComponent({
  name: 'HistoryPanel',
  props: {
    commits: {
      type: Array as PropType<CommitSummary[]>,
      default: () => [],
    },
    selectedSha: {
      type: String,
      required: true,
    },
  },
  emits: {
    select: (sha: string) => Boolean(sha),
  },
  setup: (props, { emit }) => {
    const handleSelect = (sha: string) => {
      emit('select', sha);
    };

    return () => (
      <section class="dash-history-panel flex min-h-0 flex-col border-b border-[#192b43] bg-[#081427]">
        <div class="dash-history-table-header grid grid-cols-[4.25rem_minmax(18rem,1fr)_10rem_9rem] border-b border-[#182b43] px-4 py-2 text-[11px] text-slate-500">
          <span class="dash-history-column-graph">图谱</span>
          <span class="dash-history-column-summary">描述</span>
          <span class="dash-history-column-author">作者</span>
          <span class="dash-history-column-date">日期</span>
        </div>
        <ol class="dash-history-list min-h-0 flex-1 overflow-auto">
          {props.commits.map((commit, index) => (
            <li class="dash-history-item" key={commit.sha}>
              <button
                class={[
                  'dash-history-row grid w-full grid-cols-[4.25rem_minmax(18rem,1fr)_10rem_9rem] items-stretch border-b border-[#101f35] px-4 text-left text-xs',
                  commit.sha === props.selectedSha ? 'is-selected bg-[#11273e]' : 'hover:bg-[#0d1b31]',
                ]}
                type="button"
                onClick={() => handleSelect(commit.sha)}
              >
                <div class="dash-history-graph relative min-h-[2.75rem]">
                  <span class="dash-history-graph-rail absolute -bottom-px left-3.5 top-0 w-px bg-cyan-700/70" />
                  {index > 1 && <span class="dash-history-graph-branch absolute -bottom-px left-7 top-0 w-px bg-fuchsia-700/50" />}
                  <span
                    class={[
                      'dash-history-graph-node absolute left-2.5 top-1/2 size-2.5 -translate-y-1/2 rounded-full border-2',
                      commit.sha === props.selectedSha ? 'border-cyan-300 bg-cyan-500' : 'border-cyan-600 bg-slate-950',
                    ]}
                  />
                </div>
                <div class="dash-history-summary min-w-0 py-2">
                  <div class="dash-history-references mb-1 flex flex-wrap items-center gap-1">
                    {commit.refs.map((reference) => (
                      <span
                        class={['dash-history-reference rounded border px-1.5 py-0.5 text-[10px]', getRefClass(reference)]}
                        key={reference}
                      >
                        {getRefLabel(reference)}
                      </span>
                    ))}
                  </div>
                  <p class="dash-history-message truncate text-slate-200">{commit.summary}</p>
                </div>
                <span class="dash-history-author flex items-center truncate py-2 text-slate-400">{commit.author.name}</span>
                <time class="dash-history-date flex items-center py-2 text-slate-500" datetime={new Date(commit.authored_at).toISOString()}>
                  {new Date(commit.authored_at).toLocaleDateString('zh-CN')}
                </time>
              </button>
            </li>
          ))}
        </ol>
      </section>
    );
  },
});
