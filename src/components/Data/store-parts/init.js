export async function initialize(store) {
  store.loading = true
  store.error = null
  try {
    if (!store.dataManager) {
      // DataManager 仍在原处实例化，兼容
    }
    const storedModes = localStorage.getItem('app_user_modes')
    store.modes = storedModes ? JSON.parse(storedModes) : []
    await store.initRootMode()
    await store.loadQuestionBank()
    await store.loadEnvironmentConfigs()
    await store.loadSubModeInstances()

    if (store.currentModeId) store.loadSessionCards(store.currentModeId)
    else { store.currentModeId = 'root_admin'; store.loadSessionCards('root_admin') }

    store.loadAllMediumCards()
    store.loadPresetMappings()
    store.tempCards = []

    store.initializeModeRoutes()

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