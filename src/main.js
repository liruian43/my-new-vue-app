// src/main.js
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router'
import App from './App.vue'

import { useCardStore } from './components/Data/store'
import { ensureMinimumSession } from './components/Data/boot'

const app = createApp(App)
const pinia = createPinia()
app.use(pinia)
app.use(router)

;(async () => {
  const store = useCardStore()

  try {
    // 1) 先跑你的异步初始化（如果存在）
    if (typeof store.initialize === 'function') {
      await store.initialize()
    }

    // 2) 可选：恢复当前模式下的会话卡片（如果你的初始化没有做这一步）
    if (typeof store.loadSessionCards === 'function' && store.currentModeId) {
      await store.loadSessionCards(store.currentModeId)
    }

    // 3) 关键兜底：保证台面至少有“一张卡 + 一条选项”
    ensureMinimumSession(store)
  } catch (e) {
    console.error('App init failed:', e)
    // 出错也不要卡住挂载，至少保证一个可编辑位
    try { 
      ensureMinimumSession(store) 
    } catch {
      // 允许空块：此处无需处理，仅为避免初始化失败时阻断应用挂载
    }
  }

  app.mount('#app')
})()
