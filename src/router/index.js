import { createRouter, createWebHistory } from 'vue-router'
import HomePage from '../Views/HomePage.vue'
import { useCardStore } from '../components/Data/store'

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

// 动态注册模式路由
const registerModeRoutes = (cardStore) => {
  const storedModes = cardStore.modes || [];
  
  storedModes.forEach(mode => {
    const routeName = `Mode-${mode.id}`;
    
    if (!router.hasRoute(routeName)) {
      const ModeComponent = () => import('../root_admin/ModeManagement.vue');
      
      router.addRoute({
        path: mode.path,
        name: routeName,
        component: ModeComponent,
        props: {
          modeId: mode.id,
          modeName: mode.name,
          modeData: mode
        }
      });
      
      // 检查方法是否存在再调用
      if (typeof cardStore.registerModeRoute === 'function') {
        cardStore.registerModeRoute(mode.id, routeName, mode.path);
      }
    }
  });
};

router.beforeEach((to, from, next) => {
  const cardStore = useCardStore();
  
  // 检查方法是否存在再调用，避免错误
  if (!cardStore.router && typeof cardStore.setRouterInstance === 'function') {
    cardStore.setRouterInstance(router);
  } else if (!cardStore.router) {
    // 如果没有setRouterInstance方法，直接给store添加router属性
    cardStore.router = router;
  }
  
  if (to.path.startsWith('/mode/') && !router.hasRoute(to.name)) {
    registerModeRoutes(cardStore);
  }
  
  next();
});

export default router
    