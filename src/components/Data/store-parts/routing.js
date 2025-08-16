// src/components/Data/store-parts/routing.js
import OtherModeTemplate from '../../Othermodes/OtherModeTemplate.vue'

let routerInstance = null

export function initRouter(store, router) {
  routerInstance = router
}

export function generateModePage(store, mode) {
  if (!routerInstance) {
    console.error('路由实例未初始化，请先调用initRouter()')
    return null
  }
  if (!mode || !mode.id) {
    console.error('生成模式页面失败：缺少模式ID')
    return null
  }

  const standardizedPath = `/mode/${mode.id}`
  const modeWithStandardPath = { ...mode, routePath: standardizedPath }

  const modeComponent = {
    id: modeWithStandardPath.id,
    name: `${modeWithStandardPath.id}-component`,
    path: modeWithStandardPath.routePath,
    component: createModeComponent(modeWithStandardPath)
  }

  registerModeRoute(modeComponent)
  saveGeneratedMode(modeComponent)

  console.log(`已生成模式页面: ${mode.name} (${mode.id})`)
  return modeComponent
}

export function createModeComponent(mode) {
  return {
    template: `<OtherModeTemplate :mode-id="modeId" />`,
    data() {
      return { modeId: mode.id }
    },
    components: { OtherModeTemplate }
  }
}

export function registerModeRoute(modeComponent) {
  if (!routerInstance) return

  const routeExists = routerInstance.getRoutes().some(
    route => route.path === modeComponent.path
  )

  if (!routeExists) {
    routerInstance.addRoute({
      path: modeComponent.path,
      name: modeComponent.name,
      component: modeComponent.component,
      meta: { modeId: modeComponent.id, requiresAuth: true }
    })
  }
}

export function saveGeneratedMode(modeComponent) {
  let generatedModes = JSON.parse(localStorage.getItem('generated_modes') || '[]')
  const index = generatedModes.findIndex(m => m.id === modeComponent.id)
  if (index !== -1) {
    generatedModes[index] = modeComponent
  } else {
    generatedModes.push({
      id: modeComponent.id,
      name: modeComponent.name,
      path: modeComponent.path
    })
  }
  localStorage.setItem('generated_modes', JSON.stringify(generatedModes))
}

export function deleteModePage(store, modeId) {
  if (!routerInstance) return

  // 从路由中移除
  const route = routerInstance.getRoutes().find(r => r.meta?.modeId === modeId)
  if (route) {
    routerInstance.removeRoute(route.name)
  }

  // 从存储中移除
  let generatedModes = JSON.parse(localStorage.getItem('generated_modes') || '[]')
  generatedModes = generatedModes.filter(m => m.id !== modeId)
  localStorage.setItem('generated_modes', JSON.stringify(generatedModes))

  console.log(`已彻底删除模式页面数据: ${modeId}`)
}

export function loadGeneratedModes() {
  return JSON.parse(localStorage.getItem('generated_modes') || '[]')
}

export function navigateToMode(store, modeId) {
  if (!routerInstance) {
    console.error('路由实例未初始化')
    return
  }

  const targetPath = `/mode/${modeId}`
  routerInstance.push(targetPath).catch(err => {
    if (!err.message.includes('Avoided redundant navigation')) {
      console.error('导航到模式页面失败:', err)
    }
  })
}

// —— 模式路由记录 —— //

export function initializeModeRoutes(store) {
  store.modes.forEach(mode => {
    if (!store.modeRoutes[mode.id]) {
      const routeName = `Mode-${mode.id}`
      const path = mode.path || `/mode/${mode.id}`
      store.modeRoutes[mode.id] = { routeName, path }
    }
  })
}

export function addModeRoute(store, modeId, routeName, path) {
  store.modeRoutes[modeId] = { routeName, path }
}

export function generateModeRoutePath(modeId) {
  return `/mode/${modeId}`
}

export function getModeRoute(store, modeId) {
  return store.modeRoutes[modeId] || null
}