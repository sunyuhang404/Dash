import { defineComponent } from 'vue';

export const AddRepositoryModal = defineComponent({
  name: 'AddRepositoryModal',
  props: {
    open: {
      type: Boolean,
      default: false,
    },
  },
  setup: (props) => {
    return () =>
      props.open ? (
        <section
          class="dash-add-repository-backdrop fixed inset-0 flex items-center justify-center bg-black/60 p-8"
          aria-label="添加仓库"
        >
          <form class="dash-add-repository-modal w-full max-w-xl rounded-xl border border-slate-700 bg-slate-900 p-5">
            <header class="dash-add-repository-header mb-4 flex items-center justify-between">
              <h2 class="dash-add-repository-title text-base font-semibold text-slate-100">添加本地仓库</h2>
              <button class="dash-add-repository-close text-slate-400" type="button" aria-label="关闭添加仓库弹窗">
                x
              </button>
            </header>
            <label class="dash-add-repository-path-label block text-xs text-slate-400" for="repository-path">
              仓库路径
            </label>
            <input
              class="dash-add-repository-path-input mt-2 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-200"
              id="repository-path"
              placeholder="选择一个 Git 仓库目录"
            />
            <footer class="dash-add-repository-footer mt-5 flex justify-end gap-2">
              <button class="dash-add-repository-cancel rounded-md px-3 py-2 text-sm text-slate-300" type="button">
                取消
              </button>
              <button class="dash-add-repository-submit rounded-md bg-cyan-600 px-3 py-2 text-sm text-white" type="button">
                添加
              </button>
            </footer>
          </form>
        </section>
      ) : null;
  },
});
