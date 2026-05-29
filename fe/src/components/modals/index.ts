import { createApp, defineComponent, h, ref } from 'vue';
import type { App as VueApp, Component } from 'vue';

import { AddRepositoryModal } from './add-repository-modal';
import type { RepoAddParams } from '../../types/repository.types';

interface OpenModalOptions {
  props?: Record<string, unknown>;
  closeDelay?: number;
}

const DEFAULT_CLOSE_DELAY = 240;

const createModal = <TPayload>(component: Component) => {
  return async (options: OpenModalOptions = {}): Promise<TPayload> =>
    new Promise<TPayload>((resolve, reject) => {
      const container = document.createElement('div');
      const visible = ref(true);
      const closeDelay = options.closeDelay ?? DEFAULT_CLOSE_DELAY;
      let settled = false;
      let app: VueApp<Element> | null = null;

      document.body.appendChild(container);

      const cleanup = () => {
        window.setTimeout(() => {
          app?.unmount();
          container.remove();
        }, closeDelay);
      };

      const close = () => {
        visible.value = false;
        cleanup();
      };

      const cancel = () => {
        if (settled) return;

        settled = true;
        close();
        reject(new Error('用户关闭弹框了'));
      };

      const submit = (payload: TPayload) => {
        if (settled) return;

        settled = true;
        close();
        resolve(payload);
      };

      app = createApp(
        defineComponent({
          name: 'DashModalHost',
          setup: () => {
            return () =>
              h(component, {
                ...options.props,
                open: visible.value,
                onClose: cancel,
                onSubmit: submit,
              });
          },
        }),
      );

      app.mount(container);
    });
};

export const openAddRepositoryModal = createModal<RepoAddParams>(AddRepositoryModal);
