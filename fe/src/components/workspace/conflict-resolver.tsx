import { defineComponent, type PropType } from 'vue';

import type { ConflictSource, GitConflictDetailResult } from '../../types/git.types';

const renderSource = (title: string, source: ConflictSource) => (
  <section class="dash-conflict-source flex min-w-0 flex-col border border-slate-800 bg-slate-950">
    <header class="dash-conflict-source-header border-b border-slate-800 px-3 py-2">
      <h3 class="dash-conflict-source-title text-xs font-semibold text-slate-200">{title}</h3>
      <p class="dash-conflict-source-ref text-xs text-slate-500">{source.ref}</p>
    </header>
    <pre class="dash-conflict-source-content flex-1 overflow-auto p-3 text-xs text-slate-300">{source.content}</pre>
  </section>
);

export const ConflictResolver = defineComponent({
  name: 'ConflictResolver',
  props: {
    detail: {
      type: Object as PropType<GitConflictDetailResult>,
      required: true,
    },
  },
  setup: (props) => {
    return () => (
      <section class="dash-conflict-resolver flex min-h-0 flex-col overflow-hidden border border-slate-800 bg-slate-900/60">
        <header class="dash-conflict-header flex items-center justify-between border-b border-slate-800 px-4 py-3">
          <h2 class="dash-conflict-title text-sm font-semibold text-slate-100">冲突解决 / {props.detail.file_path}</h2>
          <span class="dash-conflict-unresolved text-xs text-amber-300">
            {props.detail.conflict_blocks.filter((block) => !block.resolved).length} 个未解决
          </span>
        </header>
        <div class="dash-conflict-columns grid min-h-44 flex-1 grid-cols-3 gap-2 p-3">
          {renderSource(props.detail.incoming.label, props.detail.incoming)}
          <section class="dash-conflict-result flex min-w-0 flex-col border border-cyan-900 bg-slate-950">
            <header class="dash-conflict-result-header border-b border-cyan-900 px-3 py-2">
              <h3 class="dash-conflict-result-title text-xs font-semibold text-cyan-300">Result</h3>
              <p class="dash-conflict-result-ref text-xs text-slate-500">合并结果</p>
            </header>
            <pre class="dash-conflict-result-content flex-1 overflow-auto p-3 text-xs text-slate-300">
              {props.detail.result.content}
            </pre>
          </section>
          {renderSource(props.detail.current.label, props.detail.current)}
        </div>
      </section>
    );
  },
});
