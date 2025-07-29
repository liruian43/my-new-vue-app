import { createRouter, createWebHistory } from 'vue-router'
import HomePage from '../Views/HomePage.vue'
import DataManagement from '../components/DataManagement/DataManagement.vue'

const router = createRouter({
  history: createWebHistory('/'), // 直接使用根路径
  routes: [
    {
      path: '/',
      name: 'Home',
      component: HomePage
    },
    {
      path: '/data-management',
      name: 'DataManagement',
      component: DataManagement
    }
  ]
})

export default router