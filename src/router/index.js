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
    },
    {
      path: '/mode/:modeId',
      name: 'SubMode',
      component: () => import('../components/Othermodes/SubMode.vue'),
      props: true
    }
  ]
})

export default router