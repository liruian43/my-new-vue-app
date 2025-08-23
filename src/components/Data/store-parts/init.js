export async function initialize(store) {
  store.loading = true
  store.error = null
  try {
    if (!store.dataManager) {
      // 保留DataManager兼容处理
    }
    // 单模式下不需要加载用户模式，只加载必要配置
    const storedModes = localStorage.getItem('app_user_modes')
    store.modes = storedModes ? JSON.parse(storedModes) : []
    
    // 初始化根模式
    await store.initRootMode()
    // 加载题库
    await store.loadQuestionBank()
    // 加载环境配置
    await store.loadEnvironmentConfigs()
    
    // 固定使用root_admin模式
    store.currentModeId = 'root_admin'
    await store.loadSessionCards('root_admin')

    // 加载中期卡片和预设映射
    store.loadAllMediumCards()
    store.loadPresetMappings()
    store.tempCards = []

    // 【关键修复】删除不存在的initializeModeRoutes调用

    // 保留存储监听逻辑
    window.addEventListener('storage', (e) => {
      if (e.key?.startsWith(store.sessionStorageEnhancer.sessionId) && e.key.includes(store.currentModeId)) {
        store.loadSessionCards(store.currentModeId)
      }
    })
  } catch (error) {
    console.error('初始化失败:', error)
    store.error = '数据加载失败，请刷新页面重试'
    throw error
  } finally {
    store.loading = false
  }
}
    