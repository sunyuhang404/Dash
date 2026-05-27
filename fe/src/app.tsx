import { defineComponent } from 'vue';

export const App = defineComponent({
  name: 'App',
  setup: () => {
    return () => (
      <main class="dash-app min-h-screen bg-slate-950 p-8 text-slate-100 sm:p-12">
        <section
          class="dash-welcome mx-auto flex min-h-[calc(100vh-6rem)] max-w-6xl items-center justify-center rounded-3xl border border-slate-800 bg-slate-900/50 p-8 shadow-2xl shadow-black/30"
          aria-label="Dash 学习起始页"
        >
          <div class="dash-welcome-content w-full max-w-xl rounded-2xl border border-slate-800 bg-slate-900 p-8 shadow-xl shadow-black/20">
            <p class="dash-welcome-step mb-4 text-xs font-semibold tracking-[0.22em] text-cyan-400 uppercase">
              Step 6 / Semantic Class Names
            </p>
            <h1 class="dash-welcome-title mb-3 text-6xl font-semibold tracking-tight text-white">
              Dash
            </h1>
            <p class="dash-welcome-status mb-6 text-xl text-slate-200">语义类名规则已建立</p>
            <p class="dash-welcome-note border-t border-slate-800 pt-5 text-sm leading-6 text-slate-400">
              dash-* 描述元素职责，Tailwind 工具类描述视觉。下一步将把工作台区域拆分为独立 TSX 组件。
            </p>
          </div>
        </section>
      </main>
    );
  },
});
