import { defineComponent, type PropType } from 'vue';

import type { DiffLine, GitDiffResult } from '../../types/git.types';

const getLineMarker = (line: DiffLine) => {
  if (line.origin === 'addition') return '+';
  if (line.origin === 'deletion') return '-';
  return ' ';
};

type RenderedDiffLine = {
  line: DiffLine;
  oldLineNumber: number | null;
  newLineNumber: number | null;
};

const getRenderedDiffLines = (hunk: GitDiffResult['hunks'][number]): RenderedDiffLine[] => {
  let oldLineNumber = hunk.old_start;
  let newLineNumber = hunk.new_start;

  return hunk.lines.map((line) => {
    const renderedLine: RenderedDiffLine = {
      line,
      oldLineNumber: line.origin === 'addition' ? null : oldLineNumber,
      newLineNumber: line.origin === 'deletion' ? null : newLineNumber,
    };

    if (line.origin !== 'addition') oldLineNumber += 1;
    if (line.origin !== 'deletion') newLineNumber += 1;

    return renderedLine;
  });
};

export const DiffPanel = defineComponent({
  name: 'DiffPanel',
  props: {
    diff: {
      type: Object as PropType<GitDiffResult>,
      required: true,
    },
  },
  setup: (props) => {
    return () => (
      <section class="dash-diff-panel flex min-h-0 flex-col overflow-hidden bg-[#09162a]">
        <header class="dash-diff-header flex items-center justify-between border-b border-[#182b43] px-4 py-3">
          <h2 class="dash-diff-title truncate text-sm font-semibold text-slate-100">{props.diff.file_path}</h2>
          <p class="dash-diff-stats ml-3 text-xs text-slate-400">
            <span class="dash-diff-additions text-emerald-400">+{props.diff.stats.additions}</span>
            {' / '}
            <span class="dash-diff-deletions text-rose-400">-{props.diff.stats.deletions}</span>
          </p>
        </header>
        <div class="dash-diff-content flex-1 overflow-auto p-3 font-mono text-xs">
          {props.diff.hunks.map((hunk) => (
            <article class="dash-diff-hunk mb-3 overflow-hidden border border-[#182b43] bg-[#081427]" key={hunk.hunk_id}>
              <p class="dash-diff-hunk-header bg-[#071224] px-3 py-2 text-cyan-400">{hunk.header}</p>
              {getRenderedDiffLines(hunk).map(({ line, oldLineNumber, newLineNumber }, index) => (
                <p
                  class={[
                    'dash-diff-line grid text-slate-300',
                    {
                      'is-addition bg-emerald-950/50 text-emerald-300': line.origin === 'addition',
                      'is-deletion bg-rose-950/50 text-rose-300': line.origin === 'deletion',
                    },
                  ]}
                  key={`${hunk.hunk_id}-${index}`}
                >
                  <span class="dash-diff-line-number is-old">{oldLineNumber ?? ''}</span>
                  <span class="dash-diff-line-number is-new">{newLineNumber ?? ''}</span>
                  <span class="dash-diff-line-marker">{getLineMarker(line)}</span>
                  <span class="dash-diff-line-content whitespace-pre">{line.content}</span>
                </p>
              ))}
            </article>
          ))}
        </div>
      </section>
    );
  },
});
