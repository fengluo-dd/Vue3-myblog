import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import './styles/main.css'

// 创建应用 -> 装上状态管理 -> 装上路由 -> 挂载到 index.html 里那个 id="app" 的 div
createApp(App).use(createPinia()).use(router).mount('#app')
