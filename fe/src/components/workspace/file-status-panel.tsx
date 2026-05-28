import { defineComponent, ref, type PropType } from 'vue';

import { DashIcon } from '../ui/dash-icon';
import type { DiffLine, GitDiffResult, GitFileState, GitStatusResult, StatusFile } from '../../types/git.types';

type FileStatusSection = 'staged' | 'unstaged';
const FILES_PANEL_DEFAULT_WIDTH = 350;
const FILES_PANEL_MIN_WIDTH = 340;
const FILES_PANEL_MAX_WIDTH = 560;

interface RenderedDiffLine {
  line: DiffLine;
  oldLineNumber: number | null;
  newLineNumber: number | null;
}

const getStateLabel = (state: GitFileState) => {
  const labels: Record<GitFileState, string> = {
    unmodified: '未修改',
    new: '新增',
    modified: '修改',
    deleted: '删除',
    renamed: '重命名',
    typechange: '类型变更',
    conflicted: '冲突',
    ignored: '忽略',
  };

  return labels[state];
};

const getFileDisplayState = (file: StatusFile, section: FileStatusSection) =>
  section === 'staged' ? file.index_status : file.worktree_status;

const getFileStateClass = (state: GitFileState) => {
  if (state === 'new') return 'is-new';
  if (state === 'deleted') return 'is-deleted';
  if (state === 'conflicted') return 'is-conflicted';
  return 'is-modified';
};

const clampFilesPanelWidth = (width: number) =>
  Math.min(FILES_PANEL_MAX_WIDTH, Math.max(FILES_PANEL_MIN_WIDTH, width));

const getRenderedDiffLines = (diff: GitDiffResult): RenderedDiffLine[] =>
  diff.hunks.flatMap((hunk) => {
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
  });

const renderFileRow = (
  file: StatusFile,
  section: FileStatusSection,
  selectedPath: string,
  onSelect: (path: string) => void,
  diff: GitDiffResult,
) => {
  const state = getFileDisplayState(file, section);
  const isSelected = file.path === selectedPath;
  const stats = file.path === diff.file_path ? diff.stats : { additions: 1, deletions: state === 'new' ? 0 : 1 };

  return (
    <li class="dash-file-status-file-item" key={`${section}-${file.path}`}>
      <button
        class={[
          'dash-file-status-file-row',
          isSelected && 'is-selected',
          getFileStateClass(state),
        ]}
        type="button"
        onClick={() => onSelect(file.path)}
      >
        <span class="dash-file-status-check" aria-hidden="true" />
        <span class="dash-file-status-file-icon">
          <DashIcon name={state === 'new' ? 'plus' : state === 'conflicted' ? 'status' : 'file'} />
        </span>
        <span class="dash-file-status-file-main">
          <span class="dash-file-status-file-name">{file.path.split('/').pop()}</span>
          <span class="dash-file-status-file-path">{file.path}</span>
        </span>
        <span class="dash-file-status-file-state">{getStateLabel(state)}</span>
        <span class="dash-file-status-file-stats">
          <span class="dash-file-status-additions">+{stats.additions}</span>
          <span class="dash-file-status-deletions">-{stats.deletions}</span>
        </span>
        <span class="dash-file-status-file-action" title={section === 'staged' ? '取消暂存' : '暂存文件'}>
          {section === 'staged' ? '-' : '+'}
        </span>
      </button>
    </li>
  );
};

export const FileStatusPanel = defineComponent({
  name: 'FileStatusPanel',
  props: {
    status: {
      type: Object as PropType<GitStatusResult>,
      required: true,
    },
    diff: {
      type: Object as PropType<GitDiffResult>,
      required: true,
    },
    selectedPath: {
      type: String,
      required: true,
    },
  },
  emits: {
    selectFile: (path: string) => Boolean(path),
  },
  setup: (props, { emit }) => {
    const filesCollapsed = ref(false);
    const filesPanelWidth = ref(FILES_PANEL_DEFAULT_WIDTH);
    const filesResizing = ref(false);

    const handleSelectFile = (path: string) => {
      emit('selectFile', path);
    };

    const handleFilesResizeStart = (event: PointerEvent) => {
      if (filesCollapsed.value) return;

      event.preventDefault();
      filesResizing.value = true;

      const startX = event.clientX;
      const startWidth = filesPanelWidth.value;
      const previousCursor = document.body.style.cursor;
      const previousUserSelect = document.body.style.userSelect;

      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';

      const handlePointerMove = (moveEvent: PointerEvent) => {
        filesPanelWidth.value = clampFilesPanelWidth(startWidth + moveEvent.clientX - startX);
      };

      const handlePointerUp = () => {
        filesResizing.value = false;
        document.body.style.cursor = previousCursor;
        document.body.style.userSelect = previousUserSelect;
        window.removeEventListener('pointermove', handlePointerMove);
        window.removeEventListener('pointerup', handlePointerUp);
      };

      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp);
    };

    return () => {
      const stagedFiles = props.status.files.filter((file) => file.index_status !== 'unmodified');
      const unstagedFiles = props.status.files.filter((file) => file.worktree_status !== 'unmodified');
      const selectedFile = props.status.files.find((file) => file.path === props.selectedPath) ?? props.status.files[0];
      const renderedDiffLines = getRenderedDiffLines(props.diff);

      const renderFilesPanel = () => (
        <div class="dash-file-status-files flex h-full min-h-0 flex-col border-r border-[#14263d]">
          <div class="dash-file-status-files-top">
            <span class="dash-file-status-files-title">文件状态</span>
            <button
              class="dash-file-status-collapse-button"
              type="button"
              title="收起文件状态区域"
              aria-label="收起文件状态区域"
              onClick={() => {
                filesCollapsed.value = true;
              }}
            >
              <DashIcon name="sidebarCollapse" />
            </button>
          </div>
          <div class="dash-file-status-file-sections min-h-0 flex-1">
            <section class="dash-file-status-section is-staged">
              <header class="dash-file-status-section-header">
                <h2 class="dash-file-status-section-title">已暂存文件 <span>{stagedFiles.length} 文件</span></h2>
                <div class="dash-file-status-section-actions">
                  <button type="button" disabled>取消所有暂存</button>
                  <button type="button" disabled>取消选定暂存</button>
                </div>
              </header>
              {stagedFiles.length === 0 ? (
                <div class="dash-file-status-empty">暂存文件后会出现在这里</div>
              ) : (
                <ul class="dash-file-status-file-list">
                  {stagedFiles.map((file) => renderFileRow(file, 'staged', props.selectedPath, handleSelectFile, props.diff))}
                </ul>
              )}
            </section>

            <section class="dash-file-status-section is-unstaged">
              <header class="dash-file-status-section-header">
                <h2 class="dash-file-status-section-title">未暂存文件 <span>{unstagedFiles.length} 文件</span></h2>
                <div class="dash-file-status-section-actions">
                  <button type="button">暂存所有</button>
                  <button type="button">暂存所选</button>
                </div>
              </header>
              <ul class="dash-file-status-file-list">
                {unstagedFiles.map((file) => renderFileRow(file, 'unstaged', props.selectedPath, handleSelectFile, props.diff))}
              </ul>
            </section>
          </div>

          <footer class="dash-file-status-commit">
            <div class="dash-file-status-commit-top">
              <div class="dash-file-status-author flex min-w-0 items-center gap-2">
                <span class="dash-file-status-avatar">S</span>
                <span class="dash-file-status-author-text">
                  <strong>Sun Yuhang</strong>
                  <span>&lt;sunyuhang123256@pwrd.com&gt;</span>
                </span>
              </div>
              <button class="dash-file-status-options" type="button">提交选项</button>
            </div>
            <div class="dash-file-status-commit-main">
              <textarea class="dash-file-status-message" placeholder="输入提交说明" />
              <button class="dash-file-status-submit" type="button" disabled>Commit</button>
            </div>
            <div class="dash-file-status-commit-checks">
              <label class="dash-file-status-checkbox"><input type="checkbox" /> 立即推送到 origin/main</label>
              <label class="dash-file-status-checkbox"><input type="checkbox" /> 修改最后一次提交</label>
            </div>
          </footer>
        </div>
      );

      const renderCollapsedRail = () => (
        <aside class="dash-file-status-collapsed-rail">
          <button
            class="dash-file-status-collapsed-toggle"
            type="button"
            title="展开文件状态区域"
            aria-label="展开文件状态区域"
            onClick={() => {
              filesCollapsed.value = false;
            }}
          >
            <DashIcon name="sidebarExpand" />
          </button>
          <span class="dash-file-status-collapsed-title">文件状态</span>
          <div class="dash-file-status-collapsed-section">
            <span class="dash-file-status-collapsed-heading is-staged" title="已暂存文件">已</span>
            {stagedFiles.length === 0 ? (
              <span class="dash-file-status-collapsed-empty">0</span>
            ) : (
              stagedFiles.map((file) => (
                <button
                  class={[
                    'dash-file-status-collapsed-file',
                    file.path === props.selectedPath && 'is-selected',
                    getFileStateClass(file.index_status),
                  ]}
                  type="button"
                  title={file.path}
                  key={`collapsed-staged-${file.path}`}
                  onClick={() => handleSelectFile(file.path)}
                >
                  <span>{file.path.split('/').pop()?.charAt(0).toUpperCase() ?? '?'}</span>
                  <span class="dash-file-status-collapsed-tooltip">{file.path}</span>
                </button>
              ))
            )}
          </div>
          <div class="dash-file-status-collapsed-section">
            <span class="dash-file-status-collapsed-heading is-unstaged" title="未暂存文件">未</span>
            {unstagedFiles.map((file) => (
              <button
                class={[
                  'dash-file-status-collapsed-file',
                  file.path === props.selectedPath && 'is-selected',
                  getFileStateClass(file.worktree_status),
                ]}
                type="button"
                title={file.path}
                key={`collapsed-unstaged-${file.path}`}
                onClick={() => handleSelectFile(file.path)}
              >
                <span>{file.path.split('/').pop()?.charAt(0).toUpperCase() ?? '?'}</span>
                <span class="dash-file-status-collapsed-tooltip">{file.path}</span>
              </button>
            ))}
          </div>
        </aside>
      );

      const renderDiffSection = () => (
        <section class="dash-side-by-side-diff flex min-w-0 flex-col">
          <header class="dash-side-by-side-diff-header">
            <div class="dash-side-by-side-diff-title">
              <DashIcon name="file" />
              <span>{selectedFile?.path ?? props.diff.file_path}</span>
              <mark>Modified</mark>
            </div>
            <div class="dash-side-by-side-diff-meta">
              <span class="dash-diff-deletions">-{props.diff.stats.deletions}</span>
              <span class="dash-diff-additions">+{props.diff.stats.additions}</span>
              <span>1 difference</span>
            </div>
          </header>
          <div class="dash-side-by-side-diff-tools">
            <button type="button">↑</button>
            <button type="button">↓</button>
            <button type="button">编辑</button>
            <button type="button">Side-by-side viewer</button>
            <button type="button">Do not ignore</button>
            <button type="button">Highlight words</button>
            <button type="button" aria-label="Diff 设置"><DashIcon name="settings" /></button>
          </div>
          <div class="dash-side-by-side-diff-labels">
            <span>HEAD</span>
            <span>Current version</span>
          </div>
          <div class="dash-side-by-side-diff-body">
            <div class="dash-side-by-side-code-pane is-old" aria-label="旧版本代码">
              {renderedDiffLines.map(({ line, oldLineNumber }, index) => (
                <p
                  class={[
                    'dash-side-by-side-code-line',
                    line.origin === 'deletion' && 'is-deletion',
                    line.origin === 'addition' && 'is-blank',
                  ]}
                  key={`old-${index}`}
                >
                  <span class="dash-side-by-side-line-number">{oldLineNumber ?? ''}</span>
                  <code>{line.origin === 'addition' ? '' : line.content}</code>
                </p>
              ))}
            </div>
            <div class="dash-side-by-side-change-gutter" aria-hidden="true">
              {renderedDiffLines.map(({ line }, index) => (
                <span
                  class={[
                    'dash-side-by-side-change-marker',
                    line.origin !== 'context' && 'is-changed',
                  ]}
                  key={`gutter-${index}`}
                >
                  {line.origin !== 'context' ? '›' : ''}
                </span>
              ))}
            </div>
            <div class="dash-side-by-side-code-pane is-new" aria-label="当前版本代码">
              {renderedDiffLines.map(({ line, newLineNumber }, index) => (
                <p
                  class={[
                    'dash-side-by-side-code-line',
                    line.origin === 'addition' && 'is-addition',
                    line.origin === 'deletion' && 'is-blank',
                  ]}
                  key={`new-${index}`}
                >
                  <span class="dash-side-by-side-line-number">{newLineNumber ?? ''}</span>
                  <code>{line.origin === 'deletion' ? '' : line.content}</code>
                </p>
              ))}
            </div>
            <div class="dash-side-by-side-minimap" aria-hidden="true">
              <span class="is-top" />
              <span class="is-bottom" />
            </div>
          </div>
        </section>
      );

      return (
        <section class="dash-file-status-panel flex h-full min-h-0 flex-col bg-[#081427]">
          <div class="dash-file-status-toolbar flex h-11 shrink-0 items-center justify-between border-b border-[#14263d] px-4">
            <div class="dash-file-status-filter flex items-center gap-2">
              <button class="dash-file-status-filter-button" type="button">
                待定的文件，已按照文件状态排序
              </button>
              <button class="dash-file-status-view-button" type="button" aria-label="切换文件状态视图">
                <DashIcon name="filter" />
              </button>
            </div>
            <p class="dash-file-status-summary text-xs text-slate-500">
              {unstagedFiles.length} 个未暂存变更 · {stagedFiles.length} 个已暂存
            </p>
          </div>

          <div
            class={[
              'dash-file-status-content min-h-0 flex-1',
              filesCollapsed.value && 'is-files-collapsed',
              filesResizing.value && 'is-resizing',
            ]}
            style={{
              gridTemplateColumns: filesCollapsed.value
                ? '3.05rem 0px minmax(0, 1fr)'
                : `${filesPanelWidth.value}px 7px minmax(0, 1fr)`,
            }}
          >
            {filesCollapsed.value ? renderCollapsedRail() : renderFilesPanel()}
            <div
              class="dash-file-status-resizer"
              role="separator"
              aria-orientation="vertical"
              aria-label="调整文件状态区域宽度"
              onPointerdown={handleFilesResizeStart}
            />
            {renderDiffSection()}
          </div>

        </section>
      );
    };
  },
});
