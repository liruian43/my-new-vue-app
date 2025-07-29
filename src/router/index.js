import { createRouter, createWebHistory } from 'vue-router'
import DataManagement from '../components/DataManagement/DataManagement.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'Home',
      component: () => import('../App.vue') // 直接使用App.vue作为首页
    },
    {
      path: '/data-management',
      name: 'DataManagement',
      component: DataManagement
    }
  ]
})

export default router    