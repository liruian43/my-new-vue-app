// src/router/index.js
import { createRouter, createWebHistory } from 'vue-router'
import HomePage from '../Views/HomePage.vue' // 确保路径正确（大写 Views）

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'Home',
      component: HomePage
    }
    // 移除 DataManagement 路由
  ]
})

export default router