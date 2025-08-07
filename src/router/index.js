import { createRouter, createWebHistory } from 'vue-router'
import HomePage from '../Views/HomePage.vue'
// 导入模式处理函数和路由初始化函数
import { initRouter, loadGeneratedModes, generateModePage } from '../utils/generateModePage'

// 创建路由实例
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

// 关键：初始化路由实例到模式生成工具中
initRouter(router);

// 获取存储的模式
const getStoredModes = () => {
  return loadGeneratedModes() || [];
};

// 动态注册模式路由
const registerModeRoutes = () => {
  const storedModes = getStoredModes();
  
  storedModes.forEach(mode => {
    const routeName = `Mode-${mode.id}`;
    
    // 检查路由是否已存在
    if (!router.hasRoute(routeName)) {
      // 生成并注册路由（确保传递完整的模式信息）
      generateModePage({
        id: mode.id,
        name: mode.name,
        routePath: mode.path,
        // 添加基本的默认属性，确保模式能正常工作
        level: 2,
        permissions: {
          card: {
            addCard: true,
            deleteCard: true,
            editTitle: true,
            editOptions: true
          }
        },
        cardData: [],
        syncStatus: 'unsynced',
        lastSyncTime: null
      });
    }
  });
};

// 执行路由注册
registerModeRoutes();

// 监听路由变化，确保动态路由正确加载
router.beforeEach((to, from, next) => {
  // 检查是否是模式页面但路由未注册
  if (to.path.startsWith('/mode/') && !router.hasRoute(to.name)) {
    registerModeRoutes();
  }
  next();
});

export default router
