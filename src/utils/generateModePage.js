import OtherModeTemplate from '../components/Othermodes/OtherModeTemplate.vue';

let routerInstance = null;

export const initRouter = (router) => {
  routerInstance = router;
};

export const generateModePage = (mode) => {
  if (!routerInstance) {
    console.error('路由实例未初始化，请先调用initRouter()');
    return null;
  }
  
  if (!mode || !mode.id) {
    console.error('生成模式页面失败：缺少模式ID');
    return null;
  }
  
  // 标准化路由路径：统一使用`/mode/${mode.id}`格式
  const standardizedPath = `/mode/${mode.id}`;
  // 更新模式的routePath为标准化路径
  const modeWithStandardPath = { ...mode, routePath: standardizedPath };
  
  const modeComponent = {
    id: modeWithStandardPath.id,
    name: `${modeWithStandardPath.id}-component`,
    path: modeWithStandardPath.routePath,
    component: createModeComponent(modeWithStandardPath)
  };
  
  registerModeRoute(modeComponent);
  saveGeneratedMode(modeComponent);
  
  console.log(`已生成模式页面: ${mode.name} (${mode.id})`);
  return modeComponent;
};

const createModeComponent = (mode) => {
  return {
    template: `<OtherModeTemplate :mode-id="modeId" />`,
    data() {
      return { modeId: mode.id };
    },
    components: { OtherModeTemplate }
  };
};

const registerModeRoute = (modeComponent) => {
  if (!routerInstance) return;
  
  const routeExists = routerInstance.getRoutes().some(
    route => route.path === modeComponent.path
  );
  
  if (!routeExists) {
    routerInstance.addRoute({
      path: modeComponent.path,
      name: modeComponent.name,
      component: modeComponent.component,
      meta: { modeId: modeComponent.id, requiresAuth: true }
    });
  }
};

const saveGeneratedMode = (modeComponent) => {
  let generatedModes = JSON.parse(localStorage.getItem('generated_modes') || '[]');
  
  const index = generatedModes.findIndex(m => m.id === modeComponent.id);
  if (index !== -1) {
    generatedModes[index] = modeComponent;
  } else {
    generatedModes.push({
      id: modeComponent.id,
      name: modeComponent.name,
      path: modeComponent.path
    });
  }
  
  localStorage.setItem('generated_modes', JSON.stringify(generatedModes));
};

// 核心修复：彻底删除模式相关的路由和存储数据
export const deleteModePage = (modeId) => {
  if (!routerInstance) return;
  
  // 1. 从路由中移除
  const route = routerInstance.getRoutes().find(r => r.meta?.modeId === modeId);
  if (route) {
    routerInstance.removeRoute(route.name);
  }
  
  // 2. 从生成的模式列表中移除
  let generatedModes = JSON.parse(localStorage.getItem('generated_modes') || '[]');
  generatedModes = generatedModes.filter(m => m.id !== modeId);
  localStorage.setItem('generated_modes', JSON.stringify(generatedModes));
  
  console.log(`已彻底删除模式页面数据: ${modeId}`);
};

export const loadGeneratedModes = () => {
  return JSON.parse(localStorage.getItem('generated_modes') || '[]');
};

// 新增：跳转到模式页面的函数，确保路径正确
export const navigateToMode = (modeId) => {
  if (!routerInstance) {
    console.error('路由实例未初始化');
    return;
  }
  
  const targetPath = `/mode/${modeId}`;
  routerInstance.push(targetPath).catch(err => {
    // 忽略重复导航错误
    if (!err.message.includes('Avoided redundant navigation')) {
      console.error('导航到模式页面失败:', err);
    }
  });
};
