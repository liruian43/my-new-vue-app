import { createRouter, createWebHistory } from 'vue-router'
import HomePage from '../Views/HomePage.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'Home',
      component: HomePage
    },
    {
      path: '/root_admin',
      name: 'RootAdminHomePage',
      component: () => import('../root_admin/root_admin.vue')
    }
  ]
})

// 移除所有动态路由相关逻辑，只保留基础路由配置

export default router
    