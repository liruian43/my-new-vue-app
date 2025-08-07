import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router'
import App from './App.vue'
// 导入路由初始化函数
import { initRouter } from './utils/generateModePage'

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)

// 初始化路由实例，供generateModePage使用
initRouter(router)

app.mount('#app')
