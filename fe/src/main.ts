import { createApp } from 'vue';
import { createPinia } from 'pinia';

import { App } from './app';
import './styles/base.css';

createApp(App).use(createPinia()).mount('#app');
