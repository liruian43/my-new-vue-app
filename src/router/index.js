import { createRouter, createWebHistory } from 'vue-router'
import HomePage from '../Views/HomePage.vue' // 保持原有路径
import { getModeComponent } from '../utils/generateModePage' // 导入模式页面组件获取方法

// 保留你原有的基础路由配置
const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'Home',
      component: HomePage
    },

    // ✅ 新增：直接添加一条静态路由，让 /root_admin 指向 src/root_admin/root_admin.vue
    {
      path: '/root_admin',
      name: 'RootAdminHomePage',
      component: () => import('../root_admin/root_admin.vue') // 推荐懒加载
      // 如果你不想懒加载，也可以直接导入，例如：
      // import RootAdminHomePage from '../root_admin/root_admin.vue'
      // component: RootAdminHomePage
    }
  ]
})

// ✅ 保留：你原来的获取 modeIds 方法（绝对不动）
const getModeIds = () => {
  return JSON.parse(localStorage.getItem('modeIds') || '[]')
}

// ✅ 保留：你原来的动态注册模式路由逻辑（绝对不动）
const registerModeRoutes = () => {
  const modeIds = getModeIds()
  
  modeIds.forEach(modeId => {
    const routeName = `Mode-${modeId}`
    const routePath = `/mode/${modeId}`
    
    if (!router.hasRoute(routeName)) {
      router.addRoute({
        path: routePath,
        name: routeName,
        component: getModeComponent(modeId)
      })
    }
  })
}

// ✅ 保留：你原来的动态路由注册调用（绝对不动）
registerModeRoutes()

// ✅ 导出路由实例（保持原有导出方式）
export default router