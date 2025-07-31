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
    }
  ]
})

// 新增：动态// 1. 获取所有已创建的模式ID（从本地存储）
const getModeIds = () => {
  return JSON.parse(localStorage.getItem('modeIds') || '[]')
}

// 2. 动态注册模式路由（只做映射，不生成模板）
const registerModeRoutes = () => {
  const modeIds = getModeIds()
  
  modeIds.forEach(modeId => {
    const routeName = `Mode-${modeId}`
    const routePath = `/mode/${modeId}`
    
    // 避免重复注册路由
    if (!router.hasRoute(routeName)) {
      router.addRoute({
        path: routePath,
        name: routeName,
        component: getModeComponent(modeId) // 由generateModePage提供组件
      })
    }
  })
}

// 3. 初始化时注册已有的模式路由
registerModeRoutes()

// 导出路由实例（保持原有导出方式）
export default router
