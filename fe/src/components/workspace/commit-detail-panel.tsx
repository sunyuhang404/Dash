import { defineComponent, type PropType } from 'vue';

import type { CommitSummary, GitDiffResult } from '../../types/git.types';

export const CommitDetailPanel = defineComponent({
  name: 'CommitDetailPanel',
  props: {
    commit: {
      type: Object as PropType<CommitSummary>,
      required: true,
    },
    diff: {
      type: Object as PropType<GitDiffResult>,
      required: true,
    },
  },
  setup: (props) => {
    return () => (
      <section class="dash-commit-detail-panel flex min-h-0 flex-col border-r border-[#182b43] bg-[#09162a]">
        <header class="dash-commit-detail-header border-b border-[#182b43] px-4 py-3">
          <p class="dash-commit-detail-label text-sm font-semibold text-slate-200">
            提交 <span class="dash-commit-detail-sha ml-2 font-mono text-xs text-slate-400">{props.commit.sha}</span>
          </p>
          <h2 class="dash-commit-detail-title mt-4 text-sm text-slate-100">{props.commit.summary}</h2>
        </header>
        <dl class="dash-commit-detail-meta space-y-3 border-b border-[#182b43] px-4 py-3 text-xs">
          <div class="dash-commit-detail-meta-row flex justify-between gap-3">
            <dt class="dash-commit-detail-meta-key text-slate-500">作者</dt>
            <dd class="dash-commit-detail-meta-value truncate text-slate-300">{props.commit.author.name}</dd>
          </div>
        </dl>
        <div class="dash-commit-detail-files min-h-0 flex-1 p-3">
          <p class="dash-commit-detail-files-title mb-2 text-xs text-slate-500">包含的变更</p>
          <button
            class="dash-commit-detail-file is-selected flex w-full items-center justify-between rounded-md border border-cyan-900 bg-cyan-950/30 px-3 py-2 text-xs"
            type="button"
          >
            <span class="dash-commit-detail-file-name truncate text-slate-200">{props.diff.file_path}</span>
            <span class="dash-commit-detail-file-stats ml-3 shrink-0">
              <span class="dash-commit-detail-file-additions text-emerald-400">+{props.diff.stats.additions}</span>
              {' '}
              <span class="dash-commit-detail-file-deletions text-rose-400">-{props.diff.stats.deletions}</span>
            </span>
          </button>
        </div>
      </section>
    );
  },
});
