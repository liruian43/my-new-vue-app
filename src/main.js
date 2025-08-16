import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router'
import App from './App.vue'

// 移除generateModePage相关导入

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)

// 移除路由初始化调用

app.mount('#app')
